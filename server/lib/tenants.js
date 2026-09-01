import 'dotenv/config';

/* One Toast restaurant and one Stripe account per location.

   THE RULE THIS FILE EXISTS TO ENFORCE:
   every secret is read from process.env here, on the server, and never leaves
   this process. Nothing under src/ imports this module — it cannot, Vite would
   refuse — and no secret is ever put in a response body. The only Stripe value
   that reaches a browser is the publishable key, which Stripe publishes by
   design.

   Placeholders live in .env.example. Copy it to .env and fill in the real
   values, or inject them from your secret manager in production. .env is
   gitignored and must stay that way. */

const IDS = [
  ['greenwich-village', 'GREENWICH_VILLAGE', 'Greenwich Village'],
  ['union-square', 'UNION_SQUARE', 'Union Square'],
  ['chelsea', 'CHELSEA', 'Chelsea'],
  ['murray-hill', 'MURRAY_HILL', 'Murray Hill'],
  ['bryant-park', 'BRYANT_PARK', 'Bryant Park'],
  ['central-park', 'CENTRAL_PARK', 'Central Park'],
];

export const TENANTS = Object.fromEntries(
  IDS.map(([id, suffix, name]) => [
    id,
    {
      id,
      name,
      envSuffix: suffix,

      // ---- Toast -------------------------------------------------------
      // The restaurant GUID is an identifier, sent as the
      // Toast-Restaurant-External-ID header. Not a secret, but per-store.
      toastRestaurantGuid: process.env[`TOAST_RESTAURANT_GUID_${suffix}`] || '',
      // Toast auth is a client-credentials exchange. These two ARE secrets.
      toastClientId: process.env[`TOAST_CLIENT_ID_${suffix}`] || '',
      toastClientSecret: process.env[`TOAST_CLIENT_SECRET_${suffix}`] || '',
      // Dining option + revenue centre the catering orders should land in.
      toastDiningOptionGuid: process.env[`TOAST_DINING_OPTION_GUID_${suffix}`] || '',
      toastRevenueCenterGuid: process.env[`TOAST_REVENUE_CENTER_GUID_${suffix}`] || '',

      // ---- Stripe ------------------------------------------------------
      stripeSecretKey: process.env[`STRIPE_SECRET_KEY_${suffix}`] || '',
      stripePublishableKey: process.env[`STRIPE_PUBLISHABLE_KEY_${suffix}`] || '',
      stripeWebhookSecret: process.env[`STRIPE_WEBHOOK_SECRET_${suffix}`] || '',
    },
  ])
);

export const TOAST_API_BASE =
  process.env.TOAST_API_BASE || 'https://ws-sandbox-api.eng.toasttab.com';

/* Shared across all six restaurants: Toast signs menu and stock webhooks with
   one secret per integration, not per restaurant. */
export const TOAST_WEBHOOK_SECRET = process.env.TOAST_WEBHOOK_SECRET || '';

export function getTenant(locationId) {
  return TENANTS[locationId] || null;
}

/** Public, browser-safe subset. Never add a secret to this function. */
export function publicConfig(locationId) {
  const t = getTenant(locationId);
  if (!t) return null;
  return {
    locationId: t.id,
    locationName: t.name,
    envSuffix: t.envSuffix,
    stripePublishableKey: t.stripePublishableKey, // pk_… — public by design
    toastConfigured: Boolean(t.toastRestaurantGuid && t.toastClientId && t.toastClientSecret),
    stripeConfigured: Boolean(t.stripeSecretKey && t.stripePublishableKey),
  };
}

/** Startup report: which locations are wired up, without printing any value. */
export function configReport() {
  return Object.values(TENANTS).map((t) => ({
    location: t.id,
    toast: Boolean(t.toastRestaurantGuid && t.toastClientId && t.toastClientSecret),
    stripe: Boolean(t.stripeSecretKey && t.stripePublishableKey),
    stripeWebhook: Boolean(t.stripeWebhookSecret),
  }));
}
