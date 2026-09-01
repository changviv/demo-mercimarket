import { getTenant, TOAST_API_BASE } from './tenants.js';

/* Toast integration.

   WHY THESE SPECIFIC ENDPOINTS — the shape of this file is dictated by how
   Toast actually works, not by convenience:

   - Menus API **v3** (`/menus/v2/menus` is the older shape; v3 is
     `/menus/v3/menus`). v3 returns the whole published menu tree — groups,
     items, modifier groups, prices — in one document, which is what makes a
     six-restaurant catering site tractable. Do not "upgrade" this to v2.

   - Auth is client credentials against `/authentication/v1/authentication/login`,
     which returns a bearer token with a finite life. Tokens are cached per
     restaurant and refreshed before expiry.

   - Every request carries `Toast-Restaurant-External-ID: <restaurant GUID>`.
     Omit it and you get another restaurant's data or a 4xx.

   - Prices come from `/orders/v2/prices` BEFORE any card is touched. Toast owns
     tax, service charges and any item-level pricing rules; computing them in
     this app would eventually disagree with the register, and the register is
     right.

   - Menus change without telling you. Subscribe to the menus webhook, and poll
     `/menus/v3/metadata` every 30 minutes as a backstop — metadata is a cheap
     "has anything changed" check that avoids pulling the full tree.

   - Availability is the Stock API plus its webhook. Toast reports IN_STOCK,
     QUANTITY (with a number) and OUT_OF_STOCK. Treat QUANTITY <= 5 as low. */

const tokens = new Map(); // locationId -> { token, expiresAt }
const menuCache = new Map(); // locationId -> { data, fetchedAt, etag }

const MENU_TTL_MS = 30 * 60 * 1000;

class ToastError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code || 'toast_error';
  }
}

export function toastConfigured(locationId) {
  const t = getTenant(locationId);
  return Boolean(t?.toastRestaurantGuid && t?.toastClientId && t?.toastClientSecret);
}

async function getToken(locationId) {
  const t = getTenant(locationId);
  if (!t) throw new ToastError('Unknown location', 404, 'unknown_location');

  const cached = tokens.get(locationId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await fetch(`${TOAST_API_BASE}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: t.toastClientId,
      clientSecret: t.toastClientSecret,
      userAccessType: 'TOAST_MACHINE_CLIENT',
    }),
  });

  if (!res.ok) {
    throw new ToastError(`Toast auth failed for ${t.name}`, 502, 'toast_auth_failed');
  }

  const body = await res.json();
  const token = body?.token?.accessToken;
  const ttl = (body?.token?.expiresIn || 3600) * 1000;
  if (!token) throw new ToastError('Toast returned no access token', 502, 'toast_auth_failed');

  tokens.set(locationId, { token, expiresAt: Date.now() + ttl });
  return token;
}

async function toastFetch(locationId, path, options = {}) {
  const t = getTenant(locationId);
  const token = await getToken(locationId);

  const res = await fetch(`${TOAST_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Toast-Restaurant-External-ID': t.toastRestaurantGuid,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Token rejected — drop it so the next call re-authenticates, then fail.
    tokens.delete(locationId);
    throw new ToastError('Toast rejected the access token', 502, 'toast_unauthorized');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ToastError(
      `Toast ${options.method || 'GET'} ${path} failed (${res.status}) ${text.slice(0, 200)}`,
      502,
      'toast_request_failed'
    );
  }

  return res.status === 204 ? null : res.json();
}

/* ---- Menus ---------------------------------------------------------------- */

/** Has the published menu changed since we last pulled it? Cheap. */
export async function menuMetadata(locationId) {
  return toastFetch(locationId, '/menus/v3/metadata');
}

export async function fetchMenu(locationId, { force = false } = {}) {
  const cached = menuCache.get(locationId);
  if (!force && cached && Date.now() - cached.fetchedAt < MENU_TTL_MS) {
    return cached.data;
  }

  const raw = await toastFetch(locationId, '/menus/v3/menus');
  const data = normalizeMenu(raw);
  menuCache.set(locationId, { data, fetchedAt: Date.now() });
  return data;
}

/** Called by the menus webhook and by the 30-minute poll. */
export function invalidateMenu(locationId) {
  menuCache.delete(locationId);
}

/* Map Toast's menu tree onto the shape src/data/menu.js uses, so the UI does
   not care whether a menu came from Toast or from the bundled fixture.

   Toast expresses selection rules on the modifier group as:
     minSelection      0 = optional, >=1 = required
     maxSelection      1 = "choose one", n = "choose up to n", null = unlimited
     isDefault         pre-selected
     allowsDuplicates  same option can be taken more than once
   The UI's `type: 'one' | 'upto'` is derived from those, never guessed. */
export function normalizeMenu(raw) {
  const menus = raw?.menus || [];
  const categories = [];

  for (const menu of menus) {
    for (const group of menu.menuGroups || []) {
      const items = (group.menuItems || []).map((item) => {
        const groups = (item.modifierGroups || []).map((mg) => {
          const min = mg.minSelection ?? 0;
          const max = mg.maxSelection ?? 0;
          return {
            id: mg.guid,
            title: mg.name,
            type: max === 1 ? 'one' : 'upto',
            max: max === 1 ? 0 : max,
            req: min >= 1,
            allowsDuplicates: Boolean(mg.allowsDuplicates),
            options: (mg.modifierOptions || []).map((o) => ({
              id: o.guid,
              name: o.name,
              price: o.price ?? 0,
              isDefault: Boolean(o.isDefault),
            })),
          };
        });

        return {
          id: item.guid,
          toastGuid: item.guid,
          name: item.name,
          price: item.price ?? 0,
          desc: item.description || '',
          unit: item.unitOfMeasure === 'NONE' ? 'person' : 'person',
          groups,
        };
      });

      categories.push({
        id: group.guid,
        name: group.name,
        note: group.description || '',
        min: 1, // Toast has no "8 person minimum" concept; see MINIMUM_GUESTS.
        items,
      });
    }
  }

  return categories;
}

/* ---- Stock ---------------------------------------------------------------- */

export async function fetchStock(locationId) {
  const raw = await toastFetch(locationId, '/stock/v1/inventory');
  const out = {};
  for (const row of raw?.inventory || raw || []) {
    const qty = row.quantity ?? null;
    out[row.itemGuid || row.guid] = {
      status: row.status, // IN_STOCK | QUANTITY | OUT_OF_STOCK
      quantity: qty,
      low: row.status === 'QUANTITY' && qty !== null && qty <= 5,
      available: row.status !== 'OUT_OF_STOCK',
    };
  }
  return out;
}

/* ---- Orders --------------------------------------------------------------- */

function toToastOrder(locationId, order) {
  const t = getTenant(locationId);
  return {
    ...(t.toastRevenueCenterGuid ? { revenueCenter: { guid: t.toastRevenueCenterGuid } } : {}),
    ...(t.toastDiningOptionGuid ? { diningOption: { guid: t.toastDiningOptionGuid } } : {}),
    promisedDate: order.date && order.time ? `${order.date}T${order.time}:00.000+0000` : undefined,
    customer: {
      firstName: (order.contact?.name || '').split(' ')[0] || 'Catering',
      lastName: (order.contact?.name || '').split(' ').slice(1).join(' ') || 'Customer',
      email: order.contact?.email,
      phone: (order.contact?.phone || '').replace(/\D/g, ''),
    },
    ...(order.address
      ? {
          deliveryInfo: {
            address1: order.address.line1,
            address2: order.address.line2,
            zipCode: order.address.zip,
          },
        }
      : {}),
    checks: [
      {
        customer: { email: order.contact?.email },
        selections: (order.lines || []).map((l) => ({
          itemGuid: l.toastGuid || l.itemId,
          quantity: l.unit === 'box' ? l.qty : l.qty * (order.guests || 1),
          modifiers: Object.entries(l.selections || {}).flatMap(([groupId, picks]) =>
            (picks || []).map((p) => ({
              optionGroupGuid: groupId,
              itemGuid: typeof p === 'string' ? p : p.id,
              quantity: 1,
            }))
          ),
        })),
      },
    ],
  };
}

/** Authoritative pricing. Always call this before touching a card. */
export async function priceOrder(locationId, order) {
  const payload = toToastOrder(locationId, order);
  const priced = await toastFetch(locationId, '/orders/v2/prices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const check = priced?.checks?.[0] || {};
  return {
    subtotal: check.amount ?? 0,
    tax: check.taxAmount ?? 0,
    serviceCharges: (check.appliedServiceCharges || []).reduce(
      (n, s) => n + (s.chargeAmount || 0),
      0
    ),
    total: check.totalAmount ?? 0,
    source: 'toast',
  };
}

/** Fire the order into the kitchen. Only after the card is authorized. */
export async function submitOrder(locationId, order) {
  const payload = toToastOrder(locationId, order);
  const created = await toastFetch(locationId, '/orders/v2/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { toastOrderGuid: created?.guid, raw: created };
}

export async function voidOrder(locationId, toastOrderGuid) {
  return toastFetch(locationId, `/orders/v2/orders/${toastOrderGuid}`, {
    method: 'DELETE',
  });
}

export { ToastError };
