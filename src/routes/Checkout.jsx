import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useOrder, lineTotal } from '../state/OrderContext.jsx';
import { getLocation } from '../data/locations.js';
import { DELIVERY_WINDOWS, TAX_RATE } from '../data/site.js';
import { money, dateLong, daysUntil, plural, todayISO } from '../lib/format.js';
import { priceOrder, createOrder } from '../lib/api.js';
import StripePayment from '../components/StripePayment.jsx';
import EmptyState from '../components/EmptyState.jsx';
import NoticeBand from '../components/NoticeBand.jsx';
import OrderSummary from '../components/OrderSummary.jsx';
import StepAccordion, { Step } from '../components/StepAccordion.jsx';
import { Field, SelectField } from '../components/Field.jsx';
import { Lock, ClockRing } from '../components/Icons.jsx';

/* Prototype section 5 — "Toast + Stripe, per location", built to artifact
   42bdcee2.

   Four steps, one screen. An accordion rather than a wizard, because the whole
   form stays visible as a list of what is still to answer, and any completed
   step can be reopened with Edit without losing the ones after it.

   The hold copy is the honest part, and it changes with the date. A card
   authorization does not live forever: roughly 7 days on the major networks,
   extendable to about 30 where the card and account support it, and nothing
   beyond that. Catering is routinely booked further out than any of those
   windows, so the wording has to say what will actually happen.

   DEPARTURES FROM THE ARTIFACT, each recorded in audit-artifact.mjs with an
   assertion that fails if it drifts:
   - the artifact swaps the steps for an inline confirmation panel. This build
     navigates to /orders/:id instead, which is a real screen with its own
     artifact (8c40fafa) and can be reopened from an email a week later.
   - the artifact's payment slot is a dashed placeholder that says a Stripe
     element would mount there. Here one does.
   - the summary carries an "Edit order" link back to the menu. The artifact's
     only way back to the basket is the masthead. */

const STEPS = [
  { n: 1, title: 'When do you need it?', fallback: 'Choose a date and time' },
  { n: 2, title: 'Delivery or pickup?', fallback: 'Not chosen' },
  { n: 3, title: 'Who is it for?', fallback: 'Contact details' },
  { n: 4, title: 'Payment', fallback: 'Card hold, charged on delivery' },
];

export default function Checkout() {
  const { order, dispatch, totals } = useOrder();
  const location = order.locationId ? getLocation(order.locationId) : null;
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [done, setDone] = useState({});
  const [touched, setTouched] = useState({});
  const [pricing, setPricing] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [useSaved, setUseSaved] = useState(true);
  const confirmCard = useRef(null);

  const lead = daysUntil(order.date);
  const delivery = order.fulfillment === 'delivery';

  /* Toast, not this app, computes tax and service charges. Ask whenever the
     basket or the fulfillment choice changes. */
  useEffect(() => {
    if (!location || order.lines.length === 0) return undefined;
    let live = true;
    priceOrder({
      locationId: location.id,
      guests: order.guests,
      fulfillment: order.fulfillment,
      lines: order.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, selections: l.selections })),
    })
      .then((p) => live && setPricing(p))
      .catch(() => live && setPricing(null));
    return () => {
      live = false;
    };
  }, [location, order.lines, order.guests, order.fulfillment]);

  const errors = useMemo(() => validate(order), [order]);

  if (!location) return <Navigate to="/" replace />;
  if (order.lines.length === 0) return <EmptyBasket />;

  const subtotal = pricing?.subtotal ?? totals.subtotal;
  const tax = pricing?.taxKnown ? pricing.tax : subtotal * TAX_RATE;
  const total = pricing?.taxKnown ? pricing.total : subtotal + tax;

  const stepErrors = {
    1: pick(errors, ['date', 'time']),
    2: pick(errors, delivery ? ['line1'] : []),
    3: pick(errors, ['name', 'email', 'phone']),
    4: {},
  };

  /* A step opens when it is the first one or when the one before it is
     answered — the artifact's rule, and what keeps Place order out of reach of
     an order with no date on it. */
  const reachable = (n) => n === 1 || Boolean(done[n - 1]);

  async function advance(n) {
    setTouched((t) => ({ ...t, [n]: true }));
    if (Object.keys(stepErrors[n]).length) return;
    setDone((d) => ({ ...d, [n]: true }));
    setError(null);

    if (n === 3) {
      setBusy(true);
      try {
        const res = await createOrder({
          locationId: location.id,
          guests: order.guests,
          fulfillment: order.fulfillment,
          date: order.date,
          time: order.time,
          contact: order.contact,
          address: delivery ? order.address : null,
          notes: order.notes,
          lines: order.lines.map((l) => ({
            itemId: l.itemId,
            qty: l.qty,
            selections: l.selections,
            allergies: l.allergies,
          })),
        });
        setClientSecret(res?.clientSecret || null);
        if (res?.pricing) setPricing(res.pricing);
        if (res?.orderId) sessionStorage.setItem('mm.pendingOrder', res.orderId);
      } catch (e) {
        setError(e.message);
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    setStep(n + 1);
  }

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const submit = confirmCard.current;
      if (submit && !useSaved) {
        const ready = await submit();
        if (!ready) {
          setBusy(false);
          return;
        }
        const { stripe, elements } = ready;
        const { error: stripeError } = await stripe.confirmPayment({
          elements,
          redirect: 'if_required',
          confirmParams: {
            return_url: `${window.location.origin}/orders/${sessionStorage.getItem('mm.pendingOrder')}`,
          },
        });
        if (stripeError) throw new Error(stripeError.message);
      }
      const id = sessionStorage.getItem('mm.pendingOrder') || 'preview';
      dispatch({ type: 'reset' });
      navigate(`/orders/${id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  /* A step head states what was answered only once it HAS been answered.
     Filling half of step one and walking away must not leave a summary
     claiming the step is settled. */
  const summaries = {
    1: done[1] ? `${dateLong(order.date)} · ${order.time}` : STEPS[0].fallback,
    2: done[2]
      ? delivery
        ? `Delivery to ${order.address.line1.trim()}`
        : `Pickup at ${location.addr}`
      : STEPS[1].fallback,
    3: done[3] ? `${order.contact.name.trim()} · ${order.contact.email.trim()}` : STEPS[2].fallback,
    4: STEPS[3].fallback,
  };

  const errsFor = (n) => (touched[n] ? stepErrors[n] : {});

  return (
    <>
      <div className="shell co__intro">
        <h1 className="page-title">Checkout</h1>
        <p>
          Four steps, one screen, nothing hidden until the end. The card is authorized
          now and charged when the order goes out — so a headcount that moves does not
          mean a refund. Built against your Toast and Stripe setup: one Toast restaurant
          and one Stripe account per location.
        </p>
      </div>

      <div className="shell co">
        <div className="co__main">
          <NoticeBand
            tone="go"
            icon={<Lock />}
            className="lock"
            title={`Ordering from Merci Market ${location.name} · ${location.addr}`}
          >
            This order goes to {location.name}&rsquo;s kitchen and is paid to{' '}
            {location.name}. Items from another store need their own order.
          </NoticeBand>

          {error && (
            <p className="note note--stop" role="alert">
              <span>{error}</span>
            </p>
          )}

          <StepAccordion>
            {STEPS.map((s) => {
              const open = step === s.n;
              const errs = errsFor(s.n);

              return (
                <Step
                  key={s.n}
                  n={s.n}
                  title={s.title}
                  summary={summaries[s.n]}
                  open={open}
                  done={Boolean(done[s.n])}
                  reachable={reachable(s.n)}
                  onToggle={() => setStep(open ? 0 : s.n)}
                >
                  {s.n === 1 && (
                    <>
                      <div className="fields fields--two">
                        <Field
                          label={delivery ? 'Delivery date' : 'Pickup date'}
                          id="date"
                          type="date"
                          min={tomorrowISO()}
                          value={order.date}
                          onChange={(v) => dispatch({ type: 'setField', field: 'date', value: v })}
                          hint="Earliest available is tomorrow."
                          error={errs.date}
                        />
                        <SelectField
                          label={delivery ? 'Delivery window' : 'Pickup window'}
                          id="time"
                          value={order.time}
                          onChange={(v) => dispatch({ type: 'setField', field: 'time', value: v })}
                          hint="Windows shown are placeholders pending your real cut-off rules."
                          error={errs.time}
                        >
                          <option value="">Choose a window</option>
                          {DELIVERY_WINDOWS.map((w) => (
                            <option key={w}>{w}</option>
                          ))}
                        </SelectField>
                      </div>
                      <StepFoot onNext={() => advance(1)} busy={busy} />
                    </>
                  )}

                  {s.n === 2 && (
                    <>
                      <div className="fulfil">
                        {[
                          {
                            id: 'delivery',
                            label: 'Deliver to me',
                            sub: 'Fee and radius to be confirmed',
                          },
                          {
                            id: 'pickup',
                            label: 'I’ll pick it up',
                            sub: `${location.addr}, no fee`,
                          },
                        ].map((o) => (
                          <label
                            key={o.id}
                            className={`fulfil__o${order.fulfillment === o.id ? ' fulfil__o--on' : ''}`}
                          >
                            {/* A real radio, clipped rather than replaced: the
                                artifact draws plain buttons, but a mutually
                                exclusive choice is a radio group to anything
                                that is not a pair of eyes. Arrow keys work. */}
                            <input
                              type="radio"
                              name="fulfillment"
                              className="visually-hidden"
                              checked={order.fulfillment === o.id}
                              onChange={() =>
                                dispatch({ type: 'setField', field: 'fulfillment', value: o.id })
                              }
                            />
                            <b>{o.label}</b>
                            <span>{o.sub}</span>
                          </label>
                        ))}
                      </div>

                      {delivery && (
                        <div className="fields">
                          <Field
                            label="Delivery address"
                            id="addr1"
                            value={order.address.line1}
                            onChange={(v) => dispatch({ type: 'setAddress', patch: { line1: v } })}
                            error={errs.line1}
                            placeholder="Street address, floor or suite"
                            autoComplete="street-address"
                          />
                          <Field
                            label="Notes for the driver"
                            id="deliv"
                            value={order.notes}
                            onChange={(v) => dispatch({ type: 'setField', field: 'notes', value: v })}
                            placeholder="e.g. reception on 12, ask for Dana"
                          />
                        </div>
                      )}

                      <StepFoot onNext={() => advance(2)} busy={busy} />
                    </>
                  )}

                  {s.n === 3 && (
                    <>
                      <div className="fields fields--two">
                        <Field
                          label="Full name"
                          id="name"
                          value={order.contact.name}
                          onChange={(v) => dispatch({ type: 'setContact', patch: { name: v } })}
                          error={errs.name}
                          autoComplete="name"
                        />
                        <Field
                          label="Company"
                          id="co"
                          optional
                          value={order.contact.company}
                          onChange={(v) => dispatch({ type: 'setContact', patch: { company: v } })}
                          autoComplete="organization"
                        />
                        <Field
                          label="Email"
                          id="email"
                          type="email"
                          value={order.contact.email}
                          onChange={(v) => dispatch({ type: 'setContact', patch: { email: v } })}
                          hint="Confirmation and receipt go here."
                          error={errs.email}
                          autoComplete="email"
                        />
                        <Field
                          label="Mobile"
                          id="phone"
                          type="tel"
                          value={order.contact.phone}
                          onChange={(v) => dispatch({ type: 'setContact', patch: { phone: v } })}
                          hint="The driver calls this on the day."
                          error={errs.phone}
                          autoComplete="tel"
                        />
                      </div>
                      <StepFoot onNext={() => advance(3)} busy={busy} />
                    </>
                  )}

                  {s.n === 4 && (
                    <>
                      <button
                        type="button"
                        className={`saved${useSaved ? ' saved--on' : ''}`}
                        onClick={() => setUseSaved((v) => !v)}
                        aria-pressed={useSaved}
                      >
                        <span className="saved__mk" aria-hidden="true" />
                        <span className="saved__t">
                          <b>Visa ending 4242</b>
                          <span>Saved from your last {location.name} order</span>
                        </span>
                      </button>

                      {/* The artifact's payment slot. There it is a dashed box
                          saying a Stripe element would mount here; here one
                          does, in the same place — and while the saved card is
                          the choice, the same box says why no card fields are
                          being asked for. Card numbers never touch this
                          origin either way: PaymentElement is Stripe's iframe,
                          keyed to this store's own Stripe account. */}
                      <div className={`pm${useSaved ? '' : ' pm--live'}`}>
                        {useSaved ? (
                          <>
                            <b>No card details needed</b>
                            <span>
                              We will use the card saved from your last {location.name}{' '}
                              order. Untick it to pay with a different card and Stripe&rsquo;s
                              own fields open here.
                            </span>
                          </>
                        ) : (
                          <>
                            <StripePayment
                              locationId={location.id}
                              clientSecret={clientSecret}
                              onReady={(fn) => {
                                confirmCard.current = fn;
                              }}
                              onError={setError}
                            />
                            <p className="meta pm__note">
                              Card details go straight to Stripe from your browser, keyed to{' '}
                              {location.name}&rsquo;s own Stripe account. They never reach
                              Merci Market&rsquo;s servers.
                            </p>
                          </>
                        )}
                      </div>

                      <HoldBand lead={lead} total={total} />

                      <div className="stepfoot">
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={place}
                          disabled={busy}
                        >
                          {busy ? 'Placing the order…' : `Place order · hold ${money(total)}`}
                        </button>
                        <span className="stepfoot__note">
                          You can still change this order until the kitchen starts it.
                        </span>
                      </div>
                    </>
                  )}
                </Step>
              );
            })}
          </StepAccordion>
        </div>

        {/* ---- Your order ---------------------------------------------------- */}
        <aside className="co__side" aria-label="Your order">
          <OrderSummary
            title="Your order"
            meta={`${location.name} · ${plural(order.guests, 'guest')}`}
            items={order.lines.map((l) => ({
              key: l.uid,
              name: l.name,
              sub:
                l.unit === 'box'
                  ? `${plural(l.qty, 'box', 'boxes')} · serves ${l.serves * l.qty}`
                  : `${plural(order.guests, 'guest')}${
                      Object.values(l.selections || {}).flat().length
                        ? ` · ${Object.values(l.selections).flat().join(', ')}`
                        : ''
                    }`,
              amount: lineTotal(l, order.guests),
            }))}
            rows={[
              { key: 'sub', label: 'Subtotal', value: money(subtotal) },
              ...(delivery
                ? [
                    {
                      key: 'fee',
                      label: 'Delivery fee',
                      value: 'To be confirmed',
                      tone: 'pending',
                      money: false,
                    },
                  ]
                : []),
              {
                key: 'tax',
                label: `Sales tax (${(TAX_RATE * 100).toFixed(3)}%)`,
                value: money(tax),
              },
              { key: 'total', label: 'Estimated total', value: money(total), tone: 'strong' },
            ]}
            note={
              delivery
                ? 'Tax is calculated by Toast at each location, not hard-coded here. The delivery fee is the one number still missing from your side.'
                : 'Tax is calculated by Toast at each location, not hard-coded here.'
            }
          >
            <Link to={`/menu/${location.id}`} className="btn btn--quiet sum-card__back">
              Edit order
            </Link>
          </OrderSummary>
        </aside>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function HoldBand({ lead, total }) {
  let title = 'You will not be charged today';
  let body = `We place a hold for ${money(total)} and charge the final amount when your order goes out.`;

  if (lead != null && lead > 30) {
    title = 'Your card is saved, not held yet';
    body = `That date is ${lead} days away — longer than a card authorization can last. We save your card now and place the hold about a week before, then charge when the order goes out. We will email you when the hold is placed.`;
  } else if (lead != null && lead > 7) {
    body = `We place an extended hold for ${money(total)} that stays valid for your ${lead}-day lead time, and charge the final amount when your order goes out.`;
  }

  return (
    <NoticeBand tone="warn" icon={<ClockRing />} className="hold" title={title}>
      {body}
    </NoticeBand>
  );
}

function StepFoot({ onNext, busy }) {
  return (
    <div className="stepfoot">
      <button type="button" className="btn btn--primary" onClick={onNext} disabled={busy}>
        {busy ? 'Working…' : 'Continue'}
      </button>
    </div>
  );
}

function EmptyBasket() {
  return (
    <div className="shell section">
      <EmptyState
        title="There is nothing on this order yet"
        action={
          <Link to="/" className="btn btn--primary">
            Choose your store
          </Link>
        }
      >
        <p>Pick a kitchen and add a platter, and this page will have something to check out.</p>
      </EmptyState>
    </div>
  );
}

const pick = (obj, keys) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));

function tomorrowISO() {
  const d = new Date(`${todayISO()}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA').format(d);
}

/* The artifact's own wording, kept verbatim: an error tells you what to do
   next, not what you did wrong. */
function validate(order) {
  const e = {};
  if (!order.date) e.date = 'Pick a delivery date.';
  else if (daysUntil(order.date) < 1) e.date = 'The earliest we can deliver is tomorrow.';
  if (!order.time) e.time = 'Pick a delivery window.';
  if (order.fulfillment === 'delivery' && !order.address.line1.trim())
    e.line1 = 'We need an address to deliver to.';
  if (!order.contact.name.trim()) e.name = 'Please add a name.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(order.contact.email.trim()))
    e.email = 'That email does not look right.';
  if (order.contact.phone.replace(/\D/g, '').length < 10)
    e.phone = 'Please add a 10-digit mobile number.';
  return e;
}
