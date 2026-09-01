import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useOrder, lineTotal } from '../state/OrderContext.jsx';
import { getLocation } from '../data/locations.js';
import { money, dateLong, daysUntil, todayISO, plural } from '../lib/format.js';
import { priceOrder, createOrder } from '../lib/api.js';
import StripePayment from '../components/StripePayment.jsx';
import ActionBar from '../components/ActionBar.jsx';

/* Section 5 — checkout.

   Four steps, because four things genuinely have to be decided and bundling
   them into one 14-field form is how catering carts get abandoned.

   The payment copy is not decoration. Stripe holds a card authorization for a
   limited window, and catering is routinely ordered further out than that
   window. So the wording changes with the date:
     <= 7 days   normal authorization, captured on fulfillment
     8-30 days   extended authorization requested
     > 30 days   no hold is possible; the card is saved and charged on the day
   Telling someone their card is "held" for a booking six weeks out would be a
   straightforward lie. */

const STEPS = ['When and where', 'Who to contact', 'Payment', 'Confirm'];

export default function Checkout() {
  const { order, dispatch, totals } = useOrder();
  const location = order.locationId ? getLocation(order.locationId) : null;
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [pricing, setPricing] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);
  const confirmCard = useRef(null);

  const lead = daysUntil(order.date);
  const authMode = lead == null ? null : lead <= 7 ? 'hold' : lead <= 30 ? 'extended' : 'saved';

  /* Toast, not this app, computes tax and service charges. Ask it whenever the
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

  const errors = useMemo(() => validate(order, step), [order, step]);
  const stepValid = Object.keys(errors).length === 0;

  if (!location) return <Navigate to="/" replace />;
  if (order.lines.length === 0) return <EmptyBasket />;

  const displayTotal = pricing?.total ?? totals.subtotal;

  async function next() {
    setTouched(true);
    if (!stepValid) return;
    setTouched(false);
    setError(null);

    if (step === 1) {
      // Entering payment: create the Toast order and the manual-capture intent.
      setBusy(true);
      try {
        const res = await createOrder({
          locationId: location.id,
          guests: order.guests,
          fulfillment: order.fulfillment,
          date: order.date,
          time: order.time,
          contact: order.contact,
          address: order.fulfillment === 'delivery' ? order.address : null,
          notes: order.notes,
          lines: order.lines.map((l) => ({
            itemId: l.itemId,
            qty: l.qty,
            selections: l.selections,
          })),
        });
        setClientSecret(res.clientSecret || null);
        if (res.pricing) setPricing(res.pricing);
        sessionStorage.setItem('mm.pendingOrder', res.orderId);
      } catch (e) {
        setError(e.message);
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const submit = confirmCard.current;
      if (submit) {
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

  return (
    <div className="shell co">
      <div className="co__main">
        <ol className="steps2" aria-label="Checkout progress">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`steps2__i${i === step ? ' steps2__i--on' : ''}${i < step ? ' steps2__i--done' : ''}`}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="steps2__n" aria-hidden="true">
                {i < step ? '✓' : i + 1}
              </span>
              <span className="steps2__l">{s}</span>
            </li>
          ))}
        </ol>

        {error && (
          <p className="note note--stop" role="alert">
            <span>{error}</span>
          </p>
        )}

        {/* ---- Step 1 ---------------------------------------------------- */}
        {step === 0 && (
          <section aria-labelledby="s1">
            <h1 id="s1">When and where</h1>

            <div className="field">
              <span className="field__label" id="ff-label">
                How do you want it?
              </span>
              <div className="segment" role="radiogroup" aria-labelledby="ff-label">
                {[
                  { id: 'pickup', label: 'Pick up', sub: `${location.name} · ${location.addr}` },
                  { id: 'delivery', label: 'Delivery', sub: 'Radius and fee not yet set' },
                ].map((o) => (
                  <label key={o.id} className={`segment__o${order.fulfillment === o.id ? ' segment__o--on' : ''}`}>
                    <input
                      type="radio"
                      name="fulfillment"
                      checked={order.fulfillment === o.id}
                      onChange={() => dispatch({ type: 'setField', field: 'fulfillment', value: o.id })}
                    />
                    <span className="segment__label">{o.label}</span>
                    <span className="segment__sub">{o.sub}</span>
                  </label>
                ))}
              </div>
            </div>

            {order.fulfillment === 'delivery' && (
              <>
                <p className="note note--ask">
                  <span>
                    <strong>Delivery is not live yet.</strong> The radius and the fee are
                    still to be set. You can enter an address and the kitchen will call to
                    confirm before anything is charged.
                  </span>
                </p>
                <Field
                  label="Street address"
                  id="addr1"
                  value={order.address.line1}
                  onChange={(v) => dispatch({ type: 'setAddress', patch: { line1: v } })}
                  error={touched && errors.line1}
                  autoComplete="address-line1"
                />
                <div className="grid grid--2">
                  <Field
                    label="Floor, suite, buzzer"
                    id="addr2"
                    optional
                    value={order.address.line2}
                    onChange={(v) => dispatch({ type: 'setAddress', patch: { line2: v } })}
                    autoComplete="address-line2"
                  />
                  <Field
                    label="ZIP"
                    id="zip"
                    value={order.address.zip}
                    onChange={(v) => dispatch({ type: 'setAddress', patch: { zip: v } })}
                    error={touched && errors.zip}
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </div>
              </>
            )}

            <div className="grid grid--2">
              <Field
                label="Date"
                id="date"
                type="date"
                min={todayISO()}
                value={order.date}
                onChange={(v) => dispatch({ type: 'setField', field: 'date', value: v })}
                error={touched && errors.date}
              />
              <Field
                label={order.fulfillment === 'pickup' ? 'Pickup time' : 'Delivery time'}
                id="time"
                type="time"
                value={order.time}
                onChange={(v) => dispatch({ type: 'setField', field: 'time', value: v })}
                error={touched && errors.time}
              />
            </div>

            {lead != null && lead <= 0 && (
              <p className="note note--ask">
                <span>
                  <strong>That is today.</strong> Lead time has not been set by the
                  kitchens yet, so a same-day order is accepted here and flagged for a
                  callback rather than silently promised.
                </span>
              </p>
            )}

            <div className="field">
              <label className="field__label" htmlFor="notes">
                Anything the kitchen should know? <span className="field__opt">Optional</span>
              </label>
              <textarea
                id="notes"
                className="textarea"
                value={order.notes}
                onChange={(e) => dispatch({ type: 'setField', field: 'notes', value: e.target.value })}
                placeholder="Allergies, where to leave it, who to ask for."
              />
            </div>
          </section>
        )}

        {/* ---- Step 2 ---------------------------------------------------- */}
        {step === 1 && (
          <section aria-labelledby="s2">
            <h1 id="s2">Who to contact</h1>
            <p className="lede">One person the kitchen can reach on the day.</p>

            <div className="grid grid--2">
              <Field
                label="Your name"
                id="name"
                value={order.contact.name}
                onChange={(v) => dispatch({ type: 'setContact', patch: { name: v } })}
                error={touched && errors.name}
                autoComplete="name"
              />
              <Field
                label="Company"
                id="company"
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
                error={touched && errors.email}
                autoComplete="email"
                hint="Your receipt and any change confirmation go here."
              />
              <Field
                label="Mobile"
                id="phone"
                type="tel"
                value={order.contact.phone}
                onChange={(v) => dispatch({ type: 'setContact', patch: { phone: v } })}
                error={touched && errors.phone}
                autoComplete="tel"
                hint="Used only if there is a problem on the day."
              />
            </div>
          </section>
        )}

        {/* ---- Step 3 ---------------------------------------------------- */}
        {step === 2 && (
          <section aria-labelledby="s3">
            <h1 id="s3">Payment</h1>

            <AuthExplainer mode={authMode} lead={lead} date={order.date} total={displayTotal} />

            <StripePayment
              locationId={location.id}
              clientSecret={clientSecret}
              onReady={(fn) => {
                confirmCard.current = fn;
              }}
              onError={setError}
            />

            <p className="meta co__pci">
              Card details go straight to Stripe from your browser. They never reach Merci
              Market&rsquo;s servers.
            </p>
          </section>
        )}

        {/* ---- Step 4 ---------------------------------------------------- */}
        {step === 3 && (
          <section aria-labelledby="s4">
            <h1 id="s4">Confirm</h1>

            <dl className="review">
              <Row k="Kitchen" v={`${location.name} — ${location.addr}`} />
              <Row
                k={order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}
                v={`${dateLong(order.date)} at ${order.time}`}
              />
              {order.fulfillment === 'delivery' && (
                <Row k="Address" v={`${order.address.line1} ${order.address.line2} ${order.address.zip}`} />
              )}
              <Row k="Headcount" v={plural(order.guests, 'person', 'people')} />
              <Row k="Contact" v={`${order.contact.name} · ${order.contact.email} · ${order.contact.phone}`} />
              {order.notes && <Row k="Notes" v={order.notes} />}
            </dl>

            <AuthExplainer mode={authMode} lead={lead} date={order.date} total={displayTotal} compact />

            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={place}
              disabled={busy}
            >
              {busy
                ? 'Placing the order…'
                : `Place order · ${pricing?.taxKnown ? '' : 'from '}${money(displayTotal)}`}
            </button>
          </section>
        )}

        {/* ---- Step nav ---------------------------------------------------- */}
        {step < 3 && (
          <div className="co__nav row row--between">
            {step === 0 ? (
              <Link to={`/menu/${location.id}`} className="btn btn--ghost">
                ← Back to menu
              </Link>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setStep((s) => s - 1)}>
                ← Back
              </button>
            )}
            <button type="button" className="btn btn--primary btn--lg" onClick={next} disabled={busy}>
              {busy ? 'Working…' : step === 1 ? 'Continue to payment' : 'Continue'}
            </button>
          </div>
        )}

        {touched && !stepValid && (
          <p className="field__error" role="alert">
            Fill in the highlighted fields to continue.
          </p>
        )}
      </div>

      {/* ---- Order summary ------------------------------------------------ */}
      <aside className="co__side" aria-labelledby="co-sum">
        <div className="card card--pad">
          <h2 id="co-sum" className="summary__h">
            {plural(totals.count, 'item')} for {plural(order.guests, 'person', 'people')}
          </h2>
          <ul className="summary__list">
            {order.lines.map((l) => (
              <li key={l.uid} className="summary__line">
                <span className="summary__name">
                  {l.name}
                  <span className="summary__qty">
                    {Object.values(l.selections || {}).flat().join(', ') || '—'}
                  </span>
                </span>
                <span className="summary__amt money">{money(lineTotal(l, order.guests))}</span>
              </li>
            ))}
          </ul>

          <dl className="tot">
            <TotRow k="Subtotal" v={money(pricing?.subtotal ?? totals.subtotal)} />
            {pricing?.serviceCharges > 0 && <TotRow k="Service" v={money(pricing.serviceCharges)} />}
            {/* Gate on taxKnown, not on `pricing`. The fallback response IS a
                pricing object, with tax: 0 — rendering that as "$0.00" states a
                tax figure we do not have, next to a card field. */}
            <TotRow
              k="Tax"
              v={pricing?.taxKnown ? money(pricing.tax) : 'Set by the kitchen'}
            />
            <TotRow
              k={pricing?.taxKnown ? 'Total' : 'Total before tax'}
              v={money(displayTotal)}
              strong
            />
          </dl>

          {!pricing?.taxKnown && (
            <p className="meta">
              Tax is applied at {location.name}&rsquo;s own register rate and appears on
              your receipt. We do not estimate it here rather than show you a number that
              turns out to be wrong.
            </p>
          )}

          <Link to={`/menu/${location.id}`} className="btn btn--quiet">
            Edit order
          </Link>
        </div>
      </aside>

      <ActionBar
        summary={STEPS[step]}
        detail={money(displayTotal)}
        actionLabel={step === 3 ? 'Place order' : 'Continue'}
        onAction={step === 3 ? place : next}
        disabled={busy}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AuthExplainer({ mode, lead, date, total, compact }) {
  if (!mode) return null;

  const copy = {
    hold: {
      cls: 'note--go',
      title: 'Your card is held, not charged.',
      body: `We authorize ${money(total)} now and charge it when the food goes out on ${dateLong(date)}. If your final headcount is lower, you are charged the lower amount.`,
    },
    extended: {
      cls: 'note',
      title: 'Extended authorization.',
      body: `Your event is ${lead} days out, past the usual 7-day hold. We request an extended authorization so the hold survives to ${dateLong(date)}. If your bank declines the extension we will email you to re-confirm before the day.`,
    },
    saved: {
      cls: 'note--ask',
      title: 'No hold is placed this far ahead.',
      body: `${dateLong(date)} is ${lead} days out — beyond what any card network will hold. Your card is saved securely with Stripe and charged on the day instead. Nothing is taken now.`,
    },
  }[mode];

  return (
    <div className={`note ${copy.cls}`}>
      <span>
        <strong>{copy.title}</strong> {!compact && copy.body}
        {compact && ` ${money(total)} on ${dateLong(date)}.`}
      </span>
    </div>
  );
}

function Field({ label, id, value, onChange, error, optional, hint, type = 'text', ...rest }) {
  return (
    <p className="field">
      <label className="field__label" htmlFor={id}>
        {label} {optional && <span className="field__opt">Optional</span>}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {hint && !error && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </p>
  );
}

const Row = ({ k, v }) => (
  <div className="review__row">
    <dt>{k}</dt>
    <dd>{v}</dd>
  </div>
);

const TotRow = ({ k, v, strong }) => (
  <div className={`tot__row${strong ? ' tot__row--strong' : ''}`}>
    <dt>{k}</dt>
    <dd className="money">{v}</dd>
  </div>
);

function EmptyBasket() {
  return (
    <div className="shell section">
      <div className="empty card card--pad">
        <h1>There is nothing on this order yet</h1>
        <p>Pick a kitchen and add a platter, and this page will have something to check out.</p>
        <Link to="/" className="btn btn--primary">
          Pick a location
        </Link>
      </div>
    </div>
  );
}

function validate(order, step) {
  const e = {};
  if (step === 0) {
    if (!order.date) e.date = 'Pick a date.';
    if (!order.time) e.time = 'Pick a time.';
    if (order.fulfillment === 'delivery') {
      if (!order.address.line1.trim()) e.line1 = 'Where should it go?';
      if (!/^\d{5}$/.test(order.address.zip.trim())) e.zip = 'Five digits.';
    }
  }
  if (step === 1) {
    if (!order.contact.name.trim()) e.name = 'Who should we ask for?';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(order.contact.email.trim()))
      e.email = 'Check that email address.';
    if (order.contact.phone.replace(/\D/g, '').length < 10) e.phone = 'Ten digits, please.';
  }
  return e;
}
