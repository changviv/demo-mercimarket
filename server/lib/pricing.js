import { MENU_FIXTURE } from './menu-fixture.js';

/* Fallback pricing, used only when Toast cannot be reached.

   It deliberately does NOT guess tax. New York City's combined rate on prepared
   food is well known, but the rate that matters is the one the register applies
   — which varies by item category and by any service charge configured on the
   restaurant. Printing a number we made up, next to a card field, is how a
   customer ends up disputing a charge. So: subtotal only, and a flag the UI
   turns into "Tax is calculated by the kitchen". */

export function fallbackPricing(order) {
  const guests = Number(order?.guests) || 1;
  let subtotal = 0;

  for (const line of order?.lines || []) {
    const item = MENU_FIXTURE[line.itemId];
    if (!item) continue;
    const units = item.unit === 'box' ? line.qty : guests * line.qty;
    subtotal += units * item.price;
  }

  // Round to cents at the boundary. Float arithmetic on prices leaks values
  // like 391.85999999999996 into a Stripe amount and into a receipt.
  const cents = Math.round(subtotal * 100) / 100;

  return {
    subtotal: cents,
    tax: 0,
    serviceCharges: 0,
    total: cents,
    taxKnown: false,
    source: 'fallback',
  };
}

export function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`) - today) / 86400000);
}
