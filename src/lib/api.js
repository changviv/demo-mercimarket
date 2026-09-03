/* Browser-side API client.

   Every call goes to this app's own /api, never to Toast or Stripe directly.
   That is the whole security posture in one sentence: the browser has no
   credential for either vendor, so there is nothing in the bundle to steal.

   The one Stripe value that IS allowed in the browser is the publishable key
   (pk_...), which Stripe designs to be public. It is fetched per location from
   /api/config rather than baked in, because there is one Stripe account per
   store and the correct key is not known until a store is chosen. */

const base = import.meta.env.VITE_API_BASE || '/api';

/* Three different failures used to arrive as the same sentence — "Request
   failed (500)" — which told a customer nothing and an engineer less:

   1. THE API IS NOT RUNNING. `npm run dev` starts Vite only. Vite's dev proxy
      then cannot reach localhost:8787, and it answers 500 with an HTML body.
      This was the actual cause of the 500 on checkout, and it is a local setup
      problem, not a bug in the page — see `npm run dev:all`.
   2. The API is running and genuinely broke — a 5xx WITH a JSON error body.
   3. The request never left the browser: offline, DNS, a dropped connection.

   A person reading the checkout needs to know whether to try again, fix
   something, or phone the store, and those are three different answers. So each
   case gets its own sentence, and `err.cause` keeps the machine-readable reason
   for the console. */
const OFFLINE = 'offline';
const UNREACHABLE = 'api_unreachable';

const failure = (message, { status, code, cause }) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.cause = cause;
  return err;
};

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(base + path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (e) {
    throw failure(
      "We could not reach Merci Market. Check your connection and try again — nothing has been charged and your order is still here.",
      { code: OFFLINE, cause: e }
    );
  }

  /* Read the body as text first. A proxy or a 502 page answers with HTML, and
     calling res.json() on that throws inside a catch that then blamed the
     status code for a parse error. */
  const raw = await res.text().catch(() => '');
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (res.ok) {
    if (payload === null && raw) {
      throw failure(
        'The ordering service sent something we could not read. Please try again, or call the store to place this order.',
        { status: res.status, code: UNREACHABLE }
      );
    }
    return payload;
  }

  if (payload?.error?.message) {
    throw failure(payload.error.message, {
      status: res.status,
      code: payload.error.code,
    });
  }

  /* No JSON error body on a failed response means nothing answered as the API:
     the ordering service is down or not started. */
  if (import.meta.env.DEV) {
    console.error(
      `[api] ${options.method || 'GET'} ${base}${path} -> ${res.status} with no JSON error body.\n` +
        'The API server is probably not running. `npm run dev` starts Vite only;\n' +
        'use `npm run dev:all`, or `npm run dev:api` in a second terminal.'
    );
  }
  throw failure(
    'The ordering service is not responding, so we cannot confirm this order. Nothing has been charged. Please try again in a moment, or call the store.',
    { status: res.status, code: UNREACHABLE }
  );
}

/** Publishable Stripe key + feature flags for one location. No secrets. */
export const getConfig = (locationId) => request(`/config/${locationId}`);

/** Live menu from Toast, normalized. Falls back to the bundled fixture. */
export const getMenu = (locationId) => request(`/menu/${locationId}`);

/** Per-item availability from Toast's Stock API. */
export const getStock = (locationId) => request(`/stock/${locationId}`);

/** Authoritative pricing — Toast computes tax and service charges, not us. */
export const priceOrder = (body) => request('/orders/price', { method: 'POST', body });

/** Creates the Toast order and a manual-capture Stripe PaymentIntent. */
export const createOrder = (body) => request('/orders', { method: 'POST', body });

export const getOrder = (orderId) => request(`/orders/${orderId}`);

export const updateOrder = (orderId, body) =>
  request(`/orders/${orderId}`, { method: 'PATCH', body });

export const cancelOrder = (orderId, reason) =>
  request(`/orders/${orderId}/cancel`, { method: 'POST', body: { reason } });
