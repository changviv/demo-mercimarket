import Stripe from 'stripe';
import { getTenant } from './tenants.js';

/* Stripe, one account per location.

   Six independent Stripe accounts, not Stripe Connect: each store settles to
   its own bank account and the client asked for exactly that. Practically it
   means a Stripe client per location, keyed by the store's secret key, and no
   cross-account API call is ever possible.

   THE PAYMENT MODEL — authorize now, capture on fulfillment:

   `capture_method: 'manual'` places a hold instead of taking the money. When
   the food goes out, capture the amount actually served. Catering headcounts
   move, and this is the only model where a customer who drops from 20 to 16
   pays for 16 without a refund cycle.

   THE WINDOW — this is the part that bites:

   A card authorization does not live forever. On Visa, Mastercard, Amex and
   Discover a customer-initiated authorization holds for about 7 days. Stripe
   can request an extended authorization out to roughly 30 days where the card
   and account support it. Beyond that no hold survives, so the honest design is
   to save the card and charge on the day instead of pretending to hold it.

   Capture is ONE SHOT. You may capture less than authorized (partial capture)
   but you get one attempt — the remainder is released, not held. So the final
   capture must happen when the count is final. Overcapture, where eligible,
   allows capturing modestly above the authorization; do not rely on it. */

const clients = new Map();

export function stripeConfigured(locationId) {
  const t = getTenant(locationId);
  return Boolean(t?.stripeSecretKey);
}

export function stripeFor(locationId) {
  const t = getTenant(locationId);
  if (!t) throw new Error(`Unknown location ${locationId}`);
  if (!t.stripeSecretKey) {
    const e = new Error(
      `Stripe is not configured for ${t.name}. Set STRIPE_SECRET_KEY_${t.envSuffix}.`
    );
    e.status = 503;
    e.code = 'stripe_not_configured';
    throw e;
  }
  if (!clients.has(locationId)) {
    clients.set(
      locationId,
      new Stripe(t.stripeSecretKey, {
        apiVersion: '2024-12-18.acacia',
        appInfo: { name: 'Merci Market Catering', version: '1.0.0' },
      })
    );
  }
  return clients.get(locationId);
}

/** How far out is this event, and what can we actually promise? */
export function authStrategy(daysAhead) {
  if (daysAhead == null) return 'hold';
  if (daysAhead <= 7) return 'hold';
  if (daysAhead <= 30) return 'extended';
  return 'saved';
}

/** Find or create the Stripe Customer for this email, in THIS store's account. */
export async function upsertCustomer(locationId, contact) {
  const stripe = stripeFor(locationId);
  const email = (contact?.email || '').trim().toLowerCase();
  if (!email) return null;

  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length) return existing.data[0];

  return stripe.customers.create({
    email,
    name: contact.name,
    phone: contact.phone,
    metadata: { company: contact.company || '', locationId },
  });
}

/**
 * Create the PaymentIntent for an order.
 *
 * amountCents must come from Toast's /prices response, never from the browser.
 * A total posted by a client is a discount coupon with extra steps.
 */
export async function createIntent(locationId, { amountCents, customerId, orderRef, strategy, metadata }) {
  const stripe = stripeFor(locationId);

  const base = {
    amount: Math.round(amountCents),
    currency: 'usd',
    customer: customerId || undefined,
    metadata: { orderRef, locationId, strategy, ...(metadata || {}) },
    description: `Merci Market catering ${orderRef}`,
    automatic_payment_methods: { enabled: true },
  };

  if (strategy === 'saved') {
    // Too far out to hold. Collect and store the card; charge on the day.
    return stripe.setupIntents.create({
      customer: customerId || undefined,
      usage: 'off_session',
      metadata: base.metadata,
    });
  }

  return stripe.paymentIntents.create({
    ...base,
    capture_method: 'manual',
    ...(strategy === 'extended'
      ? { payment_method_options: { card: { request_extended_authorization: 'if_available' } } }
      : {}),
  });
}

/**
 * Capture on fulfillment. `finalCents` may be lower than the authorization —
 * that is the normal case when the headcount drops.
 *
 * One shot: whatever is not captured here is released.
 */
export async function captureIntent(locationId, intentId, finalCents) {
  const stripe = stripeFor(locationId);
  return stripe.paymentIntents.capture(intentId, {
    ...(finalCents ? { amount_to_capture: Math.round(finalCents) } : {}),
  });
}

/** Headcount went up past the hold: authorize the new amount, release the old. */
export async function reauthorize(locationId, { oldIntentId, amountCents, customerId, paymentMethodId, orderRef, strategy }) {
  const stripe = stripeFor(locationId);

  const fresh = await stripe.paymentIntents.create({
    amount: Math.round(amountCents),
    currency: 'usd',
    customer: customerId || undefined,
    payment_method: paymentMethodId,
    capture_method: 'manual',
    confirm: true,
    off_session: true,
    metadata: { orderRef, locationId, strategy, replaces: oldIntentId },
  });

  // Only release the original once the replacement has actually succeeded.
  if (fresh.status === 'requires_capture' && oldIntentId) {
    await stripe.paymentIntents.cancel(oldIntentId).catch(() => {});
  }

  return fresh;
}

export async function releaseIntent(locationId, intentId, reason = 'requested_by_customer') {
  const stripe = stripeFor(locationId);
  return stripe.paymentIntents.cancel(intentId, { cancellation_reason: reason });
}
