import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { MINIMUM_GUESTS } from '../data/site.js';

/* One order in progress: which kitchen, how many people, what is on it.

   Persisted to sessionStorage so a reload mid-flow does not lose the basket.
   sessionStorage rather than localStorage on purpose — a catering basket is a
   task in progress, not a saved preference, and a stale basket from last week
   surfacing on a shared office machine is a support ticket. */

const KEY = 'mm.order.v1';

const empty = {
  locationId: null,
  guests: MINIMUM_GUESTS,
  lines: [], // { uid, itemId, name, price, qty, selections: {groupId: [opt]}, unit, serves }
  fulfillment: 'pickup', // 'pickup' | 'delivery'
  date: '',
  time: '',
  contact: { name: '', company: '', email: '', phone: '' },
  address: { line1: '', line2: '', zip: '' },
  notes: '',
};

function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return { ...empty, ...parsed, contact: { ...empty.contact, ...parsed.contact } };
  } catch {
    return empty;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'setLocation':
      // Changing kitchen invalidates the basket: prices and stock are per-store.
      return state.locationId === action.id
        ? state
        : { ...state, locationId: action.id, lines: [] };

    case 'setGuests':
      return { ...state, guests: Math.max(1, Math.min(500, action.guests || 1)) };

    case 'addLine': {
      const uid = `${action.line.itemId}-${Date.now().toString(36)}`;
      return { ...state, lines: [...state.lines, { ...action.line, uid }] };
    }

    /* Add or step a line straight from a menu card, the way the menu artifact
       does it: Add becomes −/n/+ in place, no sheet in between.
       Only ever touches a line with NO selections. An item configured with
       "no onions" and one without are different things on the order, so the
       plain card must not silently increment somebody's configured line —
       it appends its own instead. */
    case 'bumpItem': {
      const i = state.lines.findIndex(
        (l) => l.itemId === action.item.itemId && !hasSelections(l)
      );
      if (i === -1) {
        if (action.by < 0) return state;
        const uid = `${action.item.itemId}-${Date.now().toString(36)}`;
        return { ...state, lines: [...state.lines, { ...action.item, qty: 1, uid }] };
      }
      const qty = state.lines[i].qty + action.by;
      if (qty <= 0) return { ...state, lines: state.lines.filter((_, n) => n !== i) };
      return {
        ...state,
        lines: state.lines.map((l, n) => (n === i ? { ...l, qty } : l)),
      };
    }

    case 'updateLine':
      return {
        ...state,
        lines: state.lines.map((l) => (l.uid === action.uid ? { ...l, ...action.patch } : l)),
      };

    case 'removeLine':
      return { ...state, lines: state.lines.filter((l) => l.uid !== action.uid) };

    case 'setField':
      return { ...state, [action.field]: action.value };

    case 'setContact':
      return { ...state, contact: { ...state.contact, ...action.patch } };

    case 'setAddress':
      return { ...state, address: { ...state.address, ...action.patch } };

    case 'reset':
      return { ...empty };

    default:
      return state;
  }
}

export function hasSelections(line) {
  return Object.values(line.selections || {}).some((v) => (v || []).length > 0);
}

const Ctx = createContext(null);

export function OrderProvider({ children }) {
  const [order, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(order));
    } catch {
      /* private mode, quota, or storage blocked — the basket still works in memory */
    }
  }, [order]);

  const totals = useMemo(() => computeTotals(order), [order]);

  const value = useMemo(() => ({ order, dispatch, totals }), [order, totals]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrder() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOrder must be used inside <OrderProvider>');
  return v;
}

/* Keep order.locationId in step with the :locationId in the URL. The URL is the
   source of truth — someone can deep-link or reload into any screen.
 *
 * EVERY route under /menu/:locationId must call this, not just the menu itself.
 * `setLocation` clears the basket by design (prices are per-kitchen), so if the
 * item page skipped this sync, adding from a deep-linked item left the order
 * with locationId still null — and the menu page then "changed" location on
 * arrival and wiped the line that was just added. */
export function useSyncLocation(locationId) {
  const { order, dispatch } = useOrder();
  useEffect(() => {
    if (locationId && order.locationId !== locationId) {
      dispatch({ type: 'setLocation', id: locationId });
    }
  }, [locationId, order.locationId, dispatch]);
}

/* ---- Pricing --------------------------------------------------------------
   Per-person items multiply by guest count. Box items (coffee, tea) are priced
   per box and multiply by their own quantity only.

   These are DISPLAY figures. The authoritative total comes from Toast's
   /prices endpoint before any card is touched — see server/lib/toast.js. Tax
   is deliberately not guessed here; the server fills it in.                  */

export function lineTotal(line, guests) {
  const units = line.unit === 'box' ? line.qty : guests * line.qty;
  return units * line.price;
}

/* A line is "under" when its category needs more people than the order has.
   The artifact blocks checkout on this rather than letting it surface at the
   kitchen: a platter minimum is not a suggestion, and finding out after paying
   is the worst possible moment. Box-priced items (coffee, beverages) carry no
   minimum, so they never block. */
export function underMinimum(line, guests) {
  return line.unit !== 'box' && guests < (line.min || 1);
}

export function computeTotals(order) {
  const subtotal = order.lines.reduce((sum, l) => sum + lineTotal(l, order.guests), 0);
  const count = order.lines.reduce((n, l) => n + l.qty, 0);
  const under = order.lines.filter((l) => underMinimum(l, order.guests));
  return {
    subtotal,
    count,
    items: order.lines.length,
    under: under.length,
    needs: under.reduce((m, l) => Math.max(m, l.min || 0), 0),
    blocked: under.length > 0,
  };
}
