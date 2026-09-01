/* Browser-side API client.

   Every call goes to this app's own /api, never to Toast or Stripe directly.
   That is the whole security posture in one sentence: the browser has no
   credential for either vendor, so there is nothing in the bundle to steal.

   The one Stripe value that IS allowed in the browser is the publishable key
   (pk_...), which Stripe designs to be public. It is fetched per location from
   /api/config rather than baked in, because there is one Stripe account per
   store and the correct key is not known until a store is chosen. */

const base = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const err = new Error(payload?.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = payload?.error?.code;
    throw err;
  }
  return payload;
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
