import crypto from 'node:crypto';
import { getTenant, TENANTS, TOAST_WEBHOOK_SECRET } from '../lib/tenants.js';
import { stripeFor, stripeConfigured } from '../lib/payments.js';
import * as toast from '../lib/toast.js';
import * as store from '../lib/orders.js';

/* Webhooks.

   Both handlers take the RAW request body — signatures cover the exact bytes
   sent, and JSON.parse followed by JSON.stringify does not reproduce them. They
   are mounted before express.json() in server/index.js for that reason.

   An unverified webhook is an unauthenticated POST from the internet that moves
   money. Verification is not optional, and an unset secret is a hard 503, not a
   quiet skip. */

export async function stripeWebhook(req, res) {
  const { locationId } = req.params;
  const t = getTenant(locationId);
  if (!t) return res.status(404).send('unknown location');
  if (!t.stripeWebhookSecret) {
    return res.status(503).send(`STRIPE_WEBHOOK_SECRET_${t.envSuffix} is not set`);
  }
  if (!stripeConfigured(locationId)) {
    return res.status(503).send('stripe not configured');
  }

  const stripe = stripeFor(locationId);
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.get('stripe-signature'),
      t.stripeWebhookSecret
    );
  } catch (e) {
    return res.status(400).send(`signature verification failed: ${e.message}`);
  }

  const intent = event.data?.object;
  const row = intent?.id ? store.findByIntent(intent.id) : null;

  switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      // The hold is in place. NOW the kitchen gets a ticket — not before, so a
      // declined card never produces food nobody paid for.
      if (row && !row.toastOrderGuid) {
        store.update(row.id, {
          paymentStatus: 'authorized',
          status: 'authorized',
          paymentMethodId: intent.payment_method,
          card: cardOf(intent),
        });
        if (toast.toastConfigured(row.locationId)) {
          try {
            const { toastOrderGuid } = await toast.submitOrder(row.locationId, row);
            store.update(row.id, { toastOrderGuid, status: 'in_kitchen' });
          } catch (e) {
            // Card is held but the kitchen has no ticket — loud, not silent.
            console.error(`[toast] order ${row.reference} not submitted:`, e.message);
            store.update(row.id, { kitchenError: e.message });
          }
        }
      }
      break;
    }

    case 'payment_intent.succeeded':
      if (row) {
        store.update(row.id, {
          status: 'captured',
          paymentStatus: 'captured',
          capturedAmount: intent.amount_received / 100,
        });
      }
      break;

    case 'payment_intent.payment_failed':
      if (row) {
        store.update(row.id, {
          paymentStatus: 'failed',
          paymentError: intent.last_payment_error?.message || 'Card declined.',
        });
      }
      break;

    case 'payment_intent.canceled':
      if (row) store.update(row.id, { status: 'cancelled', paymentStatus: 'released' });
      break;

    case 'setup_intent.succeeded':
      // Far-future booking: card saved, nothing held. Charge on the day.
      if (row) {
        store.update(row.id, {
          paymentStatus: 'card_saved',
          status: 'authorized',
          paymentMethodId: intent.payment_method,
        });
      }
      break;

    default:
      break;
  }

  return res.json({ received: true });
}

function cardOf(intent) {
  const c = intent?.charges?.data?.[0]?.payment_method_details?.card;
  return c ? { brand: c.brand, last4: c.last4 } : null;
}

/* ---- Toast menu + stock webhook ------------------------------------------
   Toast signs the body with an HMAC-SHA256 of the shared secret, base64. One
   secret per integration, not per restaurant. */

export async function toastWebhook(req, res) {
  if (!TOAST_WEBHOOK_SECRET) {
    return res.status(503).send('TOAST_WEBHOOK_SECRET is not set');
  }

  const signature = req.get('toast-signature') || '';
  const expected = crypto
    .createHmac('sha256', TOAST_WEBHOOK_SECRET)
    .update(req.body)
    .digest('base64');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(400).send('signature verification failed');
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).send('bad json');
  }

  // Menus and stock both change without warning; drop the cache and re-pull
  // lazily on the next request rather than fetching six trees right now.
  const guid = payload?.restaurantGuid;
  const hit = Object.values(TENANTS).find((t) => t.toastRestaurantGuid === guid);
  if (hit) toast.invalidateMenu(hit.id);

  return res.json({ received: true });
}

/* Backstop for missed webhooks: poll /menus/v3/metadata every 30 minutes.
   Metadata is cheap; the full tree is not. Started from server/index.js in
   production deployments where a scheduler is not already doing it. */
export function startMenuPolling(intervalMs = 30 * 60 * 1000) {
  return setInterval(async () => {
    for (const t of Object.values(TENANTS)) {
      if (!toast.toastConfigured(t.id)) continue;
      try {
        await toast.menuMetadata(t.id);
        toast.invalidateMenu(t.id);
      } catch (e) {
        console.error(`[toast] metadata poll failed for ${t.id}:`, e.message);
      }
    }
  }, intervalMs);
}
