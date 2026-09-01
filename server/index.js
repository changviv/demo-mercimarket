import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { publicConfig, configReport, getTenant, TENANTS } from './lib/tenants.js';
import * as toast from './lib/toast.js';
import * as pay from './lib/payments.js';
import * as store from './lib/orders.js';
import { fallbackPricing, daysUntil } from './lib/pricing.js';
import { stripeWebhook, toastWebhook } from './routes/webhooks.js';

const app = express();
const PORT = process.env.PORT || 8787;

app.disable('x-powered-by');

/* Webhooks need the RAW body to verify their signature, so they are mounted
   before express.json(). Parsing first destroys the bytes the signature covers
   and every verification silently fails. */
app.post('/api/webhooks/stripe/:locationId', express.raw({ type: 'application/json' }), stripeWebhook);
app.post('/api/webhooks/toast', express.raw({ type: 'application/json' }), toastWebhook);

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));
app.use(express.json({ limit: '256kb' }));

/* Security headers. A stricter CSP belongs at the CDN, but these are the ones
   that must be right for a page that embeds Stripe. */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self)');
  next();
});

const ok = (res, body) => res.json(body);
const fail = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

function requireTenant(req, res) {
  const t = getTenant(req.params.locationId);
  if (!t) {
    fail(res, 404, 'unknown_location', 'No such location.');
    return null;
  }
  return t;
}

/* ---- Config --------------------------------------------------------------
   Publishable key + capability flags. Audited: no secret may appear here. */

app.get('/api/config/:locationId', (req, res) => {
  const cfg = publicConfig(req.params.locationId);
  if (!cfg) return fail(res, 404, 'unknown_location', 'No such location.');
  return ok(res, cfg);
});

app.get('/api/health', (_req, res) =>
  ok(res, { status: 'ok', locations: configReport() })
);

/* ---- Menu ---------------------------------------------------------------- */

app.get('/api/menu/:locationId', async (req, res) => {
  const t = requireTenant(req, res);
  if (!t) return undefined;

  if (!toast.toastConfigured(t.id)) {
    return ok(res, {
      source: 'fixture',
      note: `Toast is not configured for ${t.name}. Set TOAST_CLIENT_ID_${t.envSuffix}, TOAST_CLIENT_SECRET_${t.envSuffix} and TOAST_RESTAURANT_GUID_${t.envSuffix}. The app is serving its bundled menu.`,
      categories: null,
    });
  }

  try {
    const categories = await toast.fetchMenu(t.id);
    return ok(res, { source: 'toast', categories });
  } catch (e) {
    // A menu outage must not take the ordering page down — fall back visibly.
    return ok(res, { source: 'fixture', note: e.message, categories: null });
  }
});

app.get('/api/stock/:locationId', async (req, res) => {
  const t = requireTenant(req, res);
  if (!t) return undefined;
  if (!toast.toastConfigured(t.id)) return ok(res, { source: 'none', stock: {} });
  try {
    return ok(res, { source: 'toast', stock: await toast.fetchStock(t.id) });
  } catch (e) {
    return ok(res, { source: 'none', stock: {}, note: e.message });
  }
});

/* ---- Pricing -------------------------------------------------------------
   Toast owns tax. When it is unreachable the response says so rather than
   quietly inventing a rate. */

app.post('/api/orders/price', async (req, res) => {
  const { locationId } = req.body || {};
  const t = getTenant(locationId);
  if (!t) return fail(res, 400, 'unknown_location', 'Pick a location first.');

  if (!toast.toastConfigured(t.id)) {
    return ok(res, fallbackPricing(req.body));
  }
  try {
    return ok(res, await toast.priceOrder(t.id, req.body));
  } catch (e) {
    return ok(res, { ...fallbackPricing(req.body), note: e.message });
  }
});

/* ---- Create an order -----------------------------------------------------
   Order of operations matters:
     1. price it with Toast   (authoritative amount)
     2. create/find the Stripe customer
     3. create the manual-capture intent for THAT amount
     4. store the row
   Toast is not told about the order until the card is authorized — the webhook
   does that — so a failed card never produces a ticket in the kitchen. */

app.post('/api/orders', async (req, res) => {
  const body = req.body || {};
  const t = getTenant(body.locationId);
  if (!t) return fail(res, 400, 'unknown_location', 'Pick a location first.');
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return fail(res, 400, 'empty_order', 'There is nothing on this order.');
  }
  if (!body.contact?.email) {
    return fail(res, 400, 'missing_contact', 'A contact email is required.');
  }

  let pricing;
  try {
    pricing = toast.toastConfigured(t.id)
      ? await toast.priceOrder(t.id, body)
      : fallbackPricing(body);
  } catch {
    pricing = fallbackPricing(body);
  }

  const lead = daysUntil(body.date);
  const strategy = pay.authStrategy(lead);

  const row = store.create({
    locationId: t.id,
    locationName: t.name,
    guests: body.guests,
    lines: body.lines,
    fulfillment: body.fulfillment,
    date: body.date,
    time: body.time,
    contact: body.contact,
    address: body.address,
    notes: body.notes,
    subtotal: pricing.subtotal,
    tax: pricing.tax,
    authorizedAmount: pricing.total,
    strategy,
    changeCutoffLabel: '6pm the night before',
    changeLocked: false,
  });

  if (!pay.stripeConfigured(t.id)) {
    // No Stripe yet: the order exists for the kitchen, but say plainly that no
    // card is held rather than implying one is.
    store.update(row.id, { paymentStatus: 'no_payment_configured' });
    return ok(res, {
      orderId: row.id,
      reference: row.reference,
      clientSecret: null,
      pricing,
      note: `Stripe is not configured for ${t.name}. Set STRIPE_SECRET_KEY_${t.envSuffix}.`,
    });
  }

  try {
    const customer = await pay.upsertCustomer(t.id, body.contact);
    const intent = await pay.createIntent(t.id, {
      amountCents: Math.round(pricing.total * 100),
      customerId: customer?.id,
      orderRef: row.reference,
      strategy,
    });

    store.update(row.id, {
      stripeIntentId: intent.id,
      stripeCustomerId: customer?.id || null,
      paymentStatus: strategy === 'saved' ? 'card_to_be_saved' : 'awaiting_authorization',
    });

    return ok(res, {
      orderId: row.id,
      reference: row.reference,
      clientSecret: intent.client_secret,
      strategy,
      pricing,
    });
  } catch (e) {
    return fail(res, e.status || 502, e.code || 'payment_setup_failed', e.message);
  }
});

/* ---- Read / change / cancel ---------------------------------------------- */

app.get('/api/orders/:orderId', (req, res) => {
  const row = store.get(req.params.orderId);
  if (!row) return fail(res, 404, 'not_found', 'No order with that reference.');
  return ok(res, publicOrder(row));
});

app.patch('/api/orders/:orderId', async (req, res) => {
  const row = store.get(req.params.orderId);
  if (!row) return fail(res, 404, 'not_found', 'No order with that reference.');
  if (row.status === 'cancelled') {
    return fail(res, 409, 'cancelled', 'That order was cancelled.');
  }
  if (row.changeLocked) {
    return fail(res, 409, 'change_locked', 'Changes closed for this order.');
  }

  const guests = Number(req.body?.guests);
  if (!guests || guests < 1) return fail(res, 400, 'bad_guests', 'Give a headcount of 1 or more.');

  /* Recompute from the server's own line prices and the posted QUANTITIES.
     Quantities are the client's to change; prices are not. A total posted by a
     browser is a discount coupon with extra steps. */
  const posted = Array.isArray(req.body?.lines) ? req.body.lines : null;
  const lines = row.lines.map((l, i) => ({
    ...l,
    qty: posted ? Math.max(0, Math.min(50, Number(posted[i]?.qty ?? l.qty))) : l.qty,
  }));

  const subtotal = lines.reduce(
    (n, l) => n + (l.unit === 'box' ? l.price * l.qty : l.price * guests * l.qty),
    0
  );
  const rate = row.subtotal ? row.tax / row.subtotal : 0;
  const tax = round2(subtotal * rate);
  const total = round2(subtotal + tax);

  // Raising past the hold needs a fresh authorization; lowering never does.
  if (total > row.authorizedAmount && pay.stripeConfigured(row.locationId) && row.stripeIntentId) {
    try {
      const fresh = await pay.reauthorize(row.locationId, {
        oldIntentId: row.stripeIntentId,
        amountCents: Math.round(total * 100),
        customerId: row.stripeCustomerId,
        paymentMethodId: row.paymentMethodId,
        orderRef: row.reference,
        strategy: row.strategy,
      });
      store.update(row.id, { stripeIntentId: fresh.id, authorizedAmount: total });
    } catch (e) {
      return fail(
        res,
        402,
        're_auth_failed',
        `The card would not authorize the higher amount, so the order is unchanged at ${row.guests}. ${e.message}`
      );
    }
  }

  const next = store.update(row.id, {
    guests,
    lines,
    subtotal: round2(subtotal),
    tax,
    ...(total <= row.authorizedAmount ? {} : { authorizedAmount: total }),
  });
  return ok(res, publicOrder(next));
});

app.post('/api/orders/:orderId/cancel', async (req, res) => {
  const row = store.get(req.params.orderId);
  if (!row) return fail(res, 404, 'not_found', 'No order with that reference.');

  if (row.stripeIntentId && pay.stripeConfigured(row.locationId)) {
    await pay.releaseIntent(row.locationId, row.stripeIntentId).catch(() => {});
  }
  if (row.toastOrderGuid) {
    await toast.voidOrder(row.locationId, row.toastOrderGuid).catch(() => {});
  }

  const next = store.update(row.id, {
    status: 'cancelled',
    paymentStatus: 'released',
    cancelReason: req.body?.reason || 'customer_request',
  });
  return ok(res, publicOrder(next));
});

/* ---- Fulfillment: capture what was actually served ------------------------
   Staff-facing. Protect it behind the client's own staff auth before shipping —
   an open capture endpoint charges cards. */

app.post('/api/orders/:orderId/capture', requireStaff, async (req, res) => {
  const row = store.get(req.params.orderId);
  if (!row) return fail(res, 404, 'not_found', 'No order with that reference.');
  if (!row.stripeIntentId) return fail(res, 409, 'no_intent', 'No authorization on this order.');

  const finalTotal = Number(req.body?.finalTotal) || row.authorizedAmount;
  try {
    const captured = await pay.captureIntent(
      row.locationId,
      row.stripeIntentId,
      Math.round(finalTotal * 100)
    );
    const next = store.update(row.id, {
      status: 'captured',
      paymentStatus: 'captured',
      capturedAmount: captured.amount_received / 100,
    });
    return ok(res, publicOrder(next));
  } catch (e) {
    return fail(res, 502, 'capture_failed', e.message);
  }
});

/* Money is rounded at every boundary. Float arithmetic on prices otherwise
   leaks values like 391.85999999999996 into a Stripe amount and a receipt. */
const round2 = (n) => Math.round(n * 100) / 100;

function requireStaff(req, res, next) {
  const expected = process.env.STAFF_API_TOKEN;
  if (!expected) {
    return fail(res, 503, 'staff_auth_unset', 'STAFF_API_TOKEN is not set on the server.');
  }
  const given = req.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  // Constant-time-ish: compare lengths first, then every byte.
  if (given.length !== expected.length) return fail(res, 401, 'unauthorized', 'Not authorized.');
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return fail(res, 401, 'unauthorized', 'Not authorized.');
  return next();
}

/** Strip anything internal before an order goes to a browser. */
function publicOrder(row) {
  const {
    stripeCustomerId,
    paymentMethodId,
    toastOrderGuid,
    stripeIntentId,
    ...safe
  } = row;
  return { ...safe, hasAuthorization: Boolean(stripeIntentId) };
}

app.use((req, res) => fail(res, 404, 'not_found', `No route for ${req.method} ${req.path}`));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[api]', err.message);
  fail(res, err.status || 500, err.code || 'server_error', 'Something went wrong.');
});

app.listen(PORT, () => {
  console.log(`Merci Market catering API on :${PORT}`);
  console.table(configReport());
  const unset = Object.values(TENANTS).filter((t) => !t.stripeSecretKey || !t.toastClientId);
  if (unset.length) {
    console.log(
      `\n${unset.length} of 6 locations still need keys. Copy .env.example to .env and fill them in.`
    );
  }
});

export default app;
