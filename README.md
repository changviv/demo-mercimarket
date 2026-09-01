# Merci Market NYC — catering ordering

React front end for `catering38.mercimarketnyc.com`, with a Node API that talks to
Toast POS and Stripe — one Toast restaurant and one Stripe account per location.

```bash
npm install
cp .env.example .env      # fill in keys; see "Secrets" below
npm run dev               # front end on :5173
npm run dev:api           # API on :8787 (separate terminal)
```

The app runs with **no keys at all**: menus come from the bundled fixture and the
payment step says plainly that Stripe is not configured rather than pretending a
card is held.

---

## The six sections

| Route | Section |
|---|---|
| `/` | Catering proposition **and** the six-location picker |
| `/menu/:locationId` | Menu browse — 76 items, headcount pricing, search, filters |
| `/menu/:locationId/item/:itemId` | Item configurator with enforced option rules |
| `/checkout` | Four-step checkout, Stripe manual capture |
| `/orders/:orderId` | Order management — change headcount, reorder, cancel |
| `*` | 404 that routes back into the funnel |

### Why the catering page is not its own route

This is a subdomain whose only job is catering — everyone who lands has already
self-selected. Splitting the pitch from the picker puts a click between the
visitor and the funnel and gives two pages the same primary CTA, which makes the
analytics unable to tell you which page earned the order.

So `/` is one page in the order a buyer reasons: **pick your kitchen first**
(every price and lead time depends on it), then the proposition below the fold
for anyone still deciding. The pitch is reachable by scroll and by the "How
catering works" link; it never blocks the person who arrived ready to order.

### Why there is no mobile tab bar

A tab bar is right when a product has parallel destinations. Catering is a
linear funnel — pick a kitchen, build an order, check out — with nothing to tab
between, and the one thing a person needs at every step is the state of the
order and the way forward.

A tab bar would also fight the primary CTA for the thumb zone. On a 390×844
screen, a 56px tab bar plus a 74px action bar plus the header spends 198px — a
quarter of the viewport — on chrome before any food appears.

What ships instead (`src/components/ActionBar.jsx`) is a single fixed bar that
always carries the running order state and the one most useful action for where
the person is. Site navigation lives in the header drawer, one tap away and free
when unused. Both disappear at ≥900px, where the sticky order summary and the
real header nav take over.

---

## Secrets

**Nothing secret is ever in the browser bundle.** The rule is enforced three ways:

1. Every credential is read in `server/lib/tenants.js` from `process.env`, in the
   Node process. Nothing under `src/` imports it — `npm run audit:secrets` fails
   the build if anything does.
2. No secret carries a `VITE_` prefix, so Vite cannot inline it.
3. `GET /api/config/:locationId` returns only the Stripe **publishable** key
   (`pk_…`, public by design) and boolean capability flags.

Card numbers never reach this origin either: Stripe's PaymentElement renders in
Stripe's own iframe and tokenises directly, which keeps the deployment in **PCI
SAQ-A** rather than SAQ-D.

```bash
npm run audit:secrets   # after npm run build
```

`.env` is gitignored. In production do not ship a `.env` at all — inject from
your platform's secret manager.

### Keys needed, per location

Suffixes: `GREENWICH_VILLAGE`, `UNION_SQUARE`, `CHELSEA`, `MURRAY_HILL`,
`BRYANT_PARK`, `CENTRAL_PARK`.

| Variable | Secret? | What it is |
|---|---|---|
| `TOAST_RESTAURANT_GUID_*` | no | sent as `Toast-Restaurant-External-ID` |
| `TOAST_CLIENT_ID_*` / `TOAST_CLIENT_SECRET_*` | **yes** | client-credentials auth |
| `TOAST_DINING_OPTION_GUID_*` | no | which dining option catering lands in |
| `TOAST_REVENUE_CENTER_GUID_*` | no | which revenue centre |
| `TOAST_WEBHOOK_SECRET` | **yes** | one per integration, not per store |
| `STRIPE_SECRET_KEY_*` | **yes** | `sk_…` |
| `STRIPE_PUBLISHABLE_KEY_*` | no | `pk_…`, served to the browser |
| `STRIPE_WEBHOOK_SECRET_*` | **yes** | `whsec_…` |
| `STAFF_API_TOKEN` | **yes** | guards the capture endpoint |

---

## Toast

`server/lib/toast.js`. The shape is dictated by how Toast actually behaves:

- **Menus API v3** (`/menus/v3/menus`), not v2 — v3 returns the whole published
  tree in one document, which is what makes six restaurants tractable.
- Auth is client credentials; tokens are cached per restaurant and refreshed
  before expiry.
- Every request carries `Toast-Restaurant-External-ID`. Omit it and you get
  another restaurant's data.
- **`/orders/v2/prices` before any card is touched.** Toast owns tax and service
  charges; computing them here would eventually disagree with the register, and
  the register is right. When Toast is unreachable the fallback returns the
  subtotal and flags `taxKnown: false` — it does not guess a tax rate next to a
  card field.
- Menus change without warning: subscribe to the menus webhook **and** poll
  `/menus/v3/metadata` every 30 minutes as a backstop.
- Modifier rules map straight across: `minSelection ≥ 1` → required,
  `maxSelection === 1` → radios, otherwise "choose up to n". `isDefault` and
  `allowsDuplicates` are carried through.

### Can Toast drive the item selector?

Yes — Stock API plus its webhook. Toast reports `IN_STOCK`, `QUANTITY` (with a
number) and `OUT_OF_STOCK`; treat `QUANTITY ≤ 5` as low. `GET /api/stock/:id`
exposes it, normalised.

---

## Stripe

`server/lib/payments.js`. Six independent accounts, **not** Connect — each store
settles to its own bank.

**Authorize at checkout, capture on fulfillment** (`capture_method: 'manual'`).
Catering headcounts move, and this is the only model where a customer who drops
from 20 to 16 pays for 16 without a refund cycle.

The window is the part that bites, and the checkout copy changes with the date:

| Lead time | What actually happens | What the customer is told |
|---|---|---|
| ≤ 7 days | normal authorization | "Your card is held, not charged." |
| 8–30 days | extended authorization requested | "Your event is *n* days out… we request an extended authorization." |
| > 30 days | SetupIntent — card saved, no hold | "No hold is placed this far ahead." |

Telling someone their card is held for a booking six weeks out would be a plain
lie; no network holds that long.

**Capture is one shot.** You may capture less than authorized, but the remainder
is released, not retained — so capture when the count is final. Raising a
headcount past the authorization creates a *new* intent and cancels the old one
only after the new one succeeds (`reauthorize`).

The kitchen ticket is only created on
`payment_intent.amount_capturable_updated` — a declined card never produces food
nobody paid for.

Webhook endpoint, one per Stripe account:
`POST /api/webhooks/stripe/<location-id>`, subscribed to
`payment_intent.amount_capturable_updated`, `.succeeded`, `.payment_failed`,
`.canceled`, and `setup_intent.succeeded`.

---

## Design system

`src/styles/tokens.css` is the only file allowed to contain a raw colour. Ships
the approved **Variation B cream** palette only — the dark Variation A is not
carried, since maintaining a second theme doubles the contrast surface for no
product benefit.

```bash
npm run audit:tokens
```

Fails on any hex, `rgb()`, `hsl()`, hard-coded font stack or px radius outside
`tokens.css`, on inline colour styles in components, and on any `var(--x)` that
is referenced but never defined.

---

## Before this goes live

Code-complete, business-incomplete. Six answers are still owed, and each one is
marked amber in the UI rather than invented:

1. **Catering lead time** — checkout currently accepts same-day and flags it.
2. **Delivery radius and fee** — delivery is present but labelled not-live.
3. **Cancellation window and fee** — cancelling currently releases in full.
4. **Change-lock time** — placeholder is 6pm the night before.
5. **`Breakfast Wraps` variety limit** — the live site sets none.
6. **Photography** — three real photos exist site-wide, all used on `/`. The 76
   menu cards are typographic by necessity, not by choice.

Two live-site prices need confirming and are flagged in the UI: **Smoked Salmon
Platter** listed at `$2599` (assumed `$25.99`), and **Bottled Water** showing a
`$2.49–$3.75` range with no selectable sizes.

`server/lib/orders.js` is an in-memory `Map`. Replace it before launch — a lost
Stripe intent id is a hold on a customer's card that nobody can release.
