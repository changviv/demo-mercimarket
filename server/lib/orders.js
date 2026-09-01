/* Order records.

   THIS IS A STUB. It keeps orders in a Map so the app runs end to end without a
   database. Every function here is the seam where a real store goes — Postgres,
   Dynamo, whatever the client already runs.

   What must be true of the real implementation:
   - the order row is the source of truth for amounts, not the browser;
   - it holds the Stripe intent id, the Toast order GUID, and the location, so a
     capture or a void can always find its counterpart;
   - it survives a restart, because a lost intent id means a hold on a
     customer's card that nobody can release.

   Restarting this server loses every in-flight order. Do not ship it. */

const orders = new Map();

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

export function newReference() {
  let s = '';
  for (let i = 0; i < 6; i += 1) {
    s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return `MM-${s}`;
}

export function create(order) {
  const id = newReference();
  const row = {
    id,
    reference: id,
    status: 'pending',
    paymentStatus: 'awaiting_authorization',
    createdAt: new Date().toISOString(),
    ...order,
  };
  orders.set(id, row);
  return row;
}

export function get(id) {
  return orders.get(id) || null;
}

export function update(id, patch) {
  const row = orders.get(id);
  if (!row) return null;
  const next = { ...row, ...patch, updatedAt: new Date().toISOString() };
  orders.set(id, next);
  return next;
}

export function findByIntent(intentId) {
  for (const row of orders.values()) {
    if (row.stripeIntentId === intentId) return row;
  }
  return null;
}

export function all() {
  return [...orders.values()];
}
