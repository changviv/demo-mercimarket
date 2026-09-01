import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useOrder, lineTotal } from '../state/OrderContext.jsx';
import { getLocation } from '../data/locations.js';
import { DELIVERY_WINDOWS, TAX_RATE } from '../data/site.js';
import { money, daysUntil, plural } from '../lib/format.js';
import { priceOrder, createOrder } from '../lib/api.js';
import StripePayment from '../components/StripePayment.jsx';

/* Prototype section 5 — "Toast + Stripe, per location".

   Four steps, one screen. An accordion rather than a wizard, because the whole
   form stays visible as a list of what is still to answer, and any completed
   step can be reopened with Edit without losing the ones after it.

   The hold copy is the honest part, and it changes with the date. A card
   authorization does not live forever: roughly 7 days on the major networks,
   extendable to about 30 where the card and account support it, and nothing
   beyond that. Catering is routinely booked further out than any of those
   windows, so the wording has to say what will actually happen. */

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
    2: pick(errors, order.fulfillment === 'delivery' ? ['line1'] : []),
    3: pick(errors, ['name', 'email', 'phone']),
    4: {},
  };

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
          address: order.fulfillment === 'delivery' ? order.address : null,
          notes: order.notes,
          lines: order.lines.map((l) => ({
            itemId: l.itemId,
            qty: l.qty,
            selections: l.selections,
            allergies: l.allergies,
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

  const summaries = {
    1: order.date && order.time ? `${order.date} · ${order.time}` : null,
    2:
      order.fulfillment === 'delivery'
        ? order.address.line1
          ? `Delivery to ${order.address.line1}`
          : 'Deliver to me'
        : `Pickup · ${location.addr}`,
    3: order.contact.name ? `${order.contact.name} · ${order.contact.email}` : null,
    4: null,
  };

  return (
    <div className="shell co">
      <div className="co__main">
        <div className="co__intro">
          <h1>Checkout</h1>
          <p>
            Four steps, one screen, nothing hidden until the end. The card is authorized
            now and charged when the order goes out — so a headcount that moves does not
            mean a refund. Built against your Toast and Stripe setup: one Toast restaurant
            and one Stripe account per location.
          </p>
        </div>

        <div className="lock">
          <span aria-hidden="true" className="lock__i" />
          <span>
            <strong>
              Ordering from Merci Market {location.name} · {location.addr}
            </strong>
            <span>
              This order goes to {location.name}&rsquo;s kitchen and is paid to{' '}
              {location.name}. Items from another store need their own order.
            </span>
          </span>
        </div>

        {error && (
          <p className="note note--stop" role="alert">
            <span>{error}</span>
          </p>
        )}

        <div className="steps3">
          {STEPS.map((s) => {
            const open = step === s.n;
            const complete = done[s.n];
            const errs = touched[s.n] ? stepErrors[s.n] : {};

            return (
              <section key={s.n} className={`step3${open ? ' step3--open' : ''}`}>
                <h2 className="step3__h">
                  <button
                    type="button"
                    className="st-head"
                    aria-expanded={open}
                    onClick={() => setStep(open ? 0 : s.n)}
                  >
                    <span className="st-n" aria-hidden="true">
                      {complete ? '✓' : s.n}
                    </span>
                    <span className="st-t">
                      <strong>{s.title}</strong>
                      <span className="st-sum">{summaries[s.n] || s.fallback}</span>
                    </span>
                    <span className="st-edit">{complete && !open ? 'Edit' : ''}</span>
                  </button>
                </h2>

                {open && (
                  <div className="st-body">
                    {s.n === 1 && (
                      <>
                        <div className="grid grid--2">
                          <Field
                            label={order.fulfillment === 'delivery' ? 'Delivery date' : 'Pickup date'}
                            id="date"
                            type="date"
                            min={tomorrowISO()}
                            value={order.date}
                            onChange={(v) => dispatch({ type: 'setField', field: 'date', value: v })}
                            hint="Earliest available is tomorrow."
                            error={errs.date}
                          />
                          <p className="field">
                            <label className="field__label" htmlFor="time">
                              {order.fulfillment === 'delivery' ? 'Delivery window' : 'Pickup window'}
                            </label>
                            <select
                              id="time"
                              className="select"
                              value={order.time}
                              onChange={(e) =>
                                dispatch({ type: 'setField', field: 'time', value: e.target.value })
                              }
                              aria-invalid={errs.time ? 'true' : undefined}
                            >
                              <option value="">Choose a window</option>
                              {DELIVERY_WINDOWS.map((w) => (
                                <option key={w}>{w}</option>
                              ))}
                            </select>
                            {errs.time ? (
                              <span className="field__error">{errs.time}</span>
                            ) : (
                              <span className="field__hint">
                                Windows shown are placeholders pending your real cut-off
                                rules.
                              </span>
                            )}
                          </p>
                        </div>
                        <StepFoot onNext={() => advance(1)} busy={busy} />
                      </>
                    )}

                    {s.n === 2 && (
                      <>
                        <div className="segment">
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
                              className={`segment__o${order.fulfillment === o.id ? ' segment__o--on' : ''}`}
                            >
                              <input
                                type="radio"
                                name="fulfillment"
                                checked={order.fulfillment === o.id}
                                onChange={() =>
                                  dispatch({ type: 'setField', field: 'fulfillment', value: o.id })
                                }
                              />
                              <span className="segment__label">{o.label}</span>
                              <span className="segment__sub">{o.sub}</span>
                            </label>
                          ))}
                        </div>

                        {order.fulfillment === 'delivery' && (
                          <>
                            <Field
                              label="Delivery address"
                              id="addr1"
                              value={order.address.line1}
                              onChange={(v) => dispatch({ type: 'setAddress', patch: { line1: v } })}
                              error={errs.line1}
                              autoComplete="address-line1"
                            />
                            <Field
                              label="Notes for the driver"
                              id="deliv"
                              optional
                              value={order.notes}
                              onChange={(v) => dispatch({ type: 'setField', field: 'notes', value: v })}
                              placeholder="e.g. reception on 12, ask for Dana"
                            />
                          </>
                        )}

                        <StepFoot onNext={() => advance(2)} busy={busy} />
                      </>
                    )}

                    {s.n === 3 && (
                      <>
                        <div className="grid grid--2">
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
                          onClick={() => setUseSaved(true)}
                          aria-pressed={useSaved}
                        >
                          <span className="saved__mk" aria-hidden="true" />
                          <span>
                            <strong>Visa ending 4242</strong>
                            <span>Saved from your last {location.name} order</span>
                          </span>
                        </button>

                        <button
                          type="button"
                          className={`saved${!useSaved ? ' saved--on' : ''}`}
                          onClick={() => setUseSaved(false)}
                          aria-pressed={!useSaved}
                        >
                          <span className="saved__mk" aria-hidden="true" />
                          <span>
                            <strong>Use a different card</strong>
                            <span>Entered securely with Stripe</span>
                          </span>
                        </button>

                        {!useSaved && (
                          <div className="pm">
                            <StripePayment
                              locationId={location.id}
                              clientSecret={clientSecret}
                              onReady={(fn) => {
                                confirmCard.current = fn;
                              }}
                              onError={setError}
                            />
                            <p className="meta">
                              Card details go straight to Stripe from your browser, keyed to{' '}
                              {location.name}&rsquo;s own Stripe account. They never reach
                              Merci Market&rsquo;s servers.
                            </p>
                          </div>
                        )}

                        <HoldBand lead={lead} total={total} />

                        <div className="stepfoot">
                          <button
                            type="button"
                            className="btn btn--primary btn--lg"
                            onClick={place}
                            disabled={busy}
                          >
                            {busy ? 'Placing the order…' : `Place order · ${money(total)}`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* ---- Your order ------------------------------------------------------ */}
      <aside className="co__side" aria-labelledby="co-sum">
        <div className="card card--pad">
          <h2 id="co-sum" className="summary__h">
            Your order
          </h2>
          <p className="summary__meta">
            {location.name} · {plural(order.guests, 'guest')}
          </p>

          <ul className="summary__list">
            {order.lines.map((l) => (
              <li key={l.uid} className="summary__line summary__line--flat">
                <span className="summary__name">
                  {l.name}
                  <span className="summary__qty">
                    {l.unit === 'box'
                      ? `${l.qty} ${l.qty === 1 ? 'box' : 'boxes'} · serves ${l.serves * l.qty}`
                      : `${order.guests} guests${
                          Object.values(l.selections || {}).flat().length
                            ? ` · ${Object.values(l.selections).flat().join(', ')}`
                            : ''
                        }`}
                  </span>
                </span>
                <span className="summary__amt money">{money(lineTotal(l, order.guests))}</span>
              </li>
            ))}
          </ul>

          <dl className="tot">
            <div className="tot__row">
              <dt>Subtotal</dt>
              <dd className="money">{money(subtotal)}</dd>
            </div>
            {order.fulfillment === 'delivery' && (
              <div className="tot__row tot__row--pending">
                <dt>Delivery fee</dt>
                <dd>To be confirmed</dd>
              </div>
            )}
            <div className="tot__row">
              <dt>Sales tax ({(TAX_RATE * 100).toFixed(3)}%)</dt>
              <dd className="money">{money(tax)}</dd>
            </div>
            <div className="tot__row tot__row--strong">
              <dt>Estimated total</dt>
              <dd className="money">{money(total)}</dd>
            </div>
          </dl>

          <p className="meta">
            Tax is calculated by Toast at each location, not hard-coded here.
            {order.fulfillment === 'delivery' &&
              ' The delivery fee is the one number still missing from your side.'}
          </p>

          <Link to={`/menu/${location.id}`} className="btn btn--quiet">
            Edit order
          </Link>
        </div>
      </aside>
    </div>
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
    <div className="hold">
      <span className="hold__i" aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        <span>{body}</span>
      </span>
    </div>
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

function Field({ label, id, value, onChange, error, optional, hint, type = 'text', ...rest }) {
  return (
    <p className="field">
      <label className="field__label" htmlFor={id}>
        {label} {optional && <span className="field__opt">optional</span>}
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

function EmptyBasket() {
  return (
    <div className="shell section">
      <div className="empty card card--pad">
        <h1>There is nothing on this order yet</h1>
        <p>Pick a kitchen and add a platter, and this page will have something to check out.</p>
        <Link to="/" className="btn btn--primary">
          Choose your store
        </Link>
      </div>
    </div>
  );
}

const pick = (obj, keys) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

function validate(order) {
  const e = {};
  if (!order.date) e.date = 'Choose a date.';
  if (!order.time) e.time = 'Choose a window.';
  if (order.fulfillment === 'delivery' && !order.address.line1.trim())
    e.line1 = 'We need an address to deliver to.';
  if (!order.contact.name.trim()) e.name = 'Who should we ask for?';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(order.contact.email.trim()))
    e.email = 'Check that email address.';
  if (order.contact.phone.replace(/\D/g, '').length < 10) e.phone = 'Ten digits, please.';
  return e;
}
