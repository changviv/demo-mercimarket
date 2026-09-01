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

/* A worked example so /orders/preview renders the way the prototype's section 6
   does — a real order mid-flight, with a hold on it. Demo data, clearly marked.
   Delete this with the Map when a real store goes in. */
const PREVIEW = {
  id: 'preview',
  reference: 'MM-BP-4820',
  title: 'Thursday breakfast for the 12th floor',
  status: 'in_kitchen',
  paymentStatus: 'authorized',
  locationId: 'bryant-park',
  locationName: 'Bryant Park',
  guests: 12,
  fulfillment: 'delivery',
  date: nextThursdayISO(),
  time: '8:00 – 9:00 am',
  contact: { name: 'Dana Reyes', email: 'dana@example.com', phone: '2125551234' },
  address: { line1: '101 Park Ave', line2: '', zip: '10178' },
  changeCutoffLabel: '6:00 pm the night before',
  changeLocked: false,
  card: { brand: 'Visa', last4: '4242' },
  lines: [
    { id: 'l1', name: 'Fresh Start Breakfast', price: 13.99, qty: 1, unit: 'person', selections: ['Regular Coffee'] },
    { id: 'l2', name: 'Fruit Platter', price: 9.5, qty: 1, unit: 'person', selections: ['Vegetarian'] },
    { id: 'l3', name: 'Box of Coffee', price: 31.99, qty: 2, unit: 'box', serves: 12, selections: [] },
  ],
  subtotal: 345.86,
  tax: 30.7,
  authorizedAmount: 376.56,
  demo: true,
};

function nextThursdayISO() {
  const d = new Date();
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

orders.set('preview', PREVIEW);

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
