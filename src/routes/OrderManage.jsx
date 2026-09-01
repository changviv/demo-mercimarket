import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrder, updateOrder, cancelOrder } from '../lib/api.js';
import { money, dateLong, plural } from '../lib/format.js';
import { MINIMUM_GUESTS, TAX_RATE } from '../data/site.js';

/* Prototype section 6 — "Change it, and see the cost".

   Every edit states its payment effect BEFORE you commit to it. That is the
   whole screen. A Stripe authorization can be captured once, for up to the
   amount authorized, so the three outcomes are genuinely different:

     under the hold   capture less — nothing to re-authorize
     over the hold    a fresh authorization, old one released after it clears
     empty / under 8  not a change at all; it is a cancellation or a blocker

   Showing that at the moment of the edit is the difference between a customer
   who understands their bill and one who disputes it. */

export default function OrderManage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    let live = true;
    getOrder(orderId)
      .then((o) => {
        if (!live) return;
        setOrder(o);
        setDraft({ guests: o.guests, lines: o.lines.map((l) => ({ ...l })) });
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const view = useMemo(() => (order && draft ? assess(order, draft) : null), [order, draft]);

  if (error) {
    return (
      <div className="shell section">
        <div className="empty card card--pad">
          <h1>We could not load that order</h1>
          <p>{error}</p>
          <Link to="/" className="btn btn--primary">
            Start a new order
          </Link>
        </div>
      </div>
    );
  }

  if (!order || !draft || !view) {
    return (
      <div className="shell section">
        <p className="note" role="status">
          <span>Loading your order…</span>
        </p>
      </div>
    );
  }

  const locked = order.status === 'cancelled' || order.changeLocked;

  async function save() {
    setBusy(true);
    try {
      const updated = await updateOrder(orderId, { guests: draft.guests, lines: draft.lines });
      setOrder(updated);
      setDraft({ guests: updated.guests, lines: updated.lines.map((l) => ({ ...l })) });
      setToast(
        view.kind === 'warn'
          ? 'Saved. A new hold was placed for the higher amount; the old one is released once it clears.'
          : 'Saved. Your kitchen has the change.'
      );
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function doCancel() {
    setBusy(true);
    try {
      await cancelOrder(orderId, 'customer_request');
      setOrder({ ...order, status: 'cancelled' });
      setToast('Cancelled. The hold on your card is released — no charge was taken.');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    setConfirmCancel(false);
  }

  const setLineQty = (i, q) =>
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l, k) => (k === i ? { ...l, qty: Math.max(0, q) } : l)),
    }));

  return (
    <div className="shell om">
      <div className="om__main">
        <header className="om__head">
          <p className="om__who">
            {order.contact?.name || 'Your order'} · {order.locationName}
          </p>
          <p className="eyebrow">Order {order.reference}</p>
          <h1>{order.title || `${plural(order.guests, 'guest')} at ${order.locationName}`}</h1>
          <p className="lede">
            {order.fulfillment === 'delivery' ? 'Delivering' : 'Ready for pickup'}{' '}
            {dateLong(order.date)}, {order.time}
            {order.address?.line1 ? ` to ${order.address.line1}` : ''}. You can still change
            it — here is exactly what each change does to your payment.
          </p>
        </header>

        {toast && (
          <p className="note note--go" role="status">
            <span>{toast}</span>
          </p>
        )}

        {/* ---- Where it is -------------------------------------------------- */}
        <section className="card card--pad om__block" aria-labelledby="om-where">
          <h2 id="om-where">Where it is</h2>
          <p className="om__sub">
            {order.locationName} has the order. Nothing has been cooked yet.
          </p>

          <ol className="track">
            {(
              order.track || [
                { t: 'Order placed', d: 'card authorized, not charged', state: 'done' },
                {
                  t: 'Confirmed by the kitchen',
                  d: `sent to ${order.locationName}'s Toast`,
                  state: 'done',
                },
                {
                  t: 'Changes still open',
                  d: `Until ${order.changeCutoffLabel}`,
                  state: 'now',
                },
                { t: 'In the kitchen', d: 'the morning of', state: 'next' },
                {
                  t: order.fulfillment === 'delivery' ? 'Out for delivery' : 'Ready for pickup',
                  d: 'card charged as it leaves',
                  state: 'next',
                },
              ]
            ).map((s) => (
              <li key={s.t} className={`track__i track__i--${s.state}`}>
                <span className="track__dot" aria-hidden="true" />
                <span className="track__t">{s.t}</span>
                <span className="track__d">{s.d}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- Change this order --------------------------------------------- */}
        {!locked && (
          <section className="card card--pad om__block" aria-labelledby="om-change">
            <h2 id="om-change">Change this order</h2>
            <p className="om__sub">
              Adjust anything below. The payment consequence updates as you go — no
              surprises at the end.
            </p>

            <div className="chg">
              <div className="chg__row chg__row--guests">
                <span className="chg__name">
                  Guests
                  <span className="chg__sub">Every per-person item recalculates</span>
                </span>
                <Stepper
                  value={draft.guests}
                  min={1}
                  max={300}
                  label="Guests"
                  onChange={(g) => setDraft((d) => ({ ...d, guests: g }))}
                />
                <span />
              </div>

              {draft.lines.map((l, i) => (
                <div key={l.id || l.name} className="chg__row">
                  <span className="chg__name">
                    {l.name}
                    <span className="chg__sub">
                      {[l.selections?.join?.(', '), unitLabel(l)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Stepper
                    value={l.qty}
                    min={0}
                    max={50}
                    label={l.name}
                    onChange={(q) => setLineQty(i, q)}
                  />
                  <span className="chg__amt money">{money(lineOf(l, draft.guests))}</span>
                </div>
              ))}
            </div>

            <div className={`consq consq--${view.kind}`} role="status">
              <strong>{view.title}</strong>
              <span>{view.body}</span>
            </div>

            <div className="row">
              <button
                type="button"
                className="btn btn--primary"
                onClick={save}
                disabled={busy || !view.changed || view.blocked}
              >
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() =>
                  setDraft({ guests: order.guests, lines: order.lines.map((l) => ({ ...l })) })
                }
                disabled={!view.changed}
              >
                Undo
              </button>
            </div>
          </section>
        )}

        {/* ---- Order this again ---------------------------------------------- */}
        <section className="card card--pad om__block" aria-labelledby="om-again">
          <h2 id="om-again">Order this again</h2>
          <p className="om__sub">
            Your {dayName(order.date)} order, same items, same store. Pick a new date and it
            is done — the saved {order.card?.brand || 'Visa'} ending{' '}
            {order.card?.last4 || '4242'} is already on file at {order.locationName}.
          </p>
          <Link to={`/menu/${order.locationId}`} className="btn btn--ghost">
            Reorder for next week
          </Link>
        </section>

        {!locked && (
          <section className="om__block om__danger" aria-labelledby="om-cancel">
            <h2 id="om-cancel">Cancel this order</h2>
            <p className="note note--ask">
              <span>
                <strong>The cancellation window is not set yet.</strong> Until the kitchens
                confirm it, cancelling here releases the authorization in full and takes no
                fee.
              </span>
            </p>
            {confirmCancel ? (
              <div className="row">
                <button type="button" className="btn btn--primary" onClick={doCancel} disabled={busy}>
                  Yes, cancel order {order.reference}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmCancel(false)}>
                  Keep it
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmCancel(true)}>
                Cancel this order
              </button>
            )}
          </section>
        )}
      </div>

      {/* ---- Payment panel ---------------------------------------------------- */}
      <aside className="om__side">
        <div className="card card--pad">
          <p className="om__paystate">{view.changed ? 'Hold needs updating' : 'Hold placed'}</p>
          <p className="om__payamt money">{money(order.authorizedAmount)}</p>
          <p className="meta">
            {view.changed
              ? `Currently holding ${money(order.authorizedAmount)} on ${order.card?.brand || 'Visa'} ${order.card?.last4 || '4242'}. Save your changes and we will re-authorize for ${money(view.total)}.`
              : `Authorized on ${order.card?.brand || 'Visa'} ${order.card?.last4 || '4242'}. Released in full if you cancel.`}
          </p>

          <dl className="tot">
            <div className="tot__row">
              <dt>Subtotal</dt>
              <dd className="money">{money(view.sub)}</dd>
            </div>
            {order.fulfillment === 'delivery' && (
              <div className="tot__row tot__row--pending">
                <dt>Delivery fee</dt>
                <dd>To be confirmed</dd>
              </div>
            )}
            <div className="tot__row">
              <dt>Sales tax ({(TAX_RATE * 100).toFixed(3)}%)</dt>
              <dd className="money">{money(view.tax)}</dd>
            </div>
            <div className="tot__row tot__row--strong">
              <dt>{view.changed ? 'New total' : 'Order total'}</dt>
              <dd className="money">
                {view.changed && (
                  <span className="was">{money(order.authorizedAmount)}</span>
                )}
                {money(view.total)}
              </dd>
            </div>
          </dl>

          <p className="meta">
            {order.fulfillment === 'delivery' && 'Delivery fee still to be confirmed. '}
            Tax comes from {order.locationName}&rsquo;s Toast configuration.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Stepper({ value, min, max, label, onChange }) {
  return (
    <div className="guests__control">
      <button
        type="button"
        className="guests__step"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Fewer ${label}`}
      >
        −
      </button>
      <input
        className="guests__input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        aria-label={label}
      />
      <button
        type="button"
        className="guests__step"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`More ${label}`}
      >
        +
      </button>
    </div>
  );
}

const unitLabel = (l) =>
  l.unit === 'box' ? `${money(l.price)} per box` : `${money(l.price)} per person`;

const lineOf = (l, guests) => (l.unit === 'box' ? l.price * l.qty : l.price * guests * l.qty);

function dayName(iso) {
  if (!iso) return 'weekly';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
}

/** What does this edit do to the money? */
function assess(order, draft) {
  const sub = draft.lines.reduce((n, l) => n + lineOf(l, draft.guests), 0);
  const tax = sub * TAX_RATE;
  const total = sub + tax;
  const auth = order.authorizedAmount;

  const changed =
    draft.guests !== order.guests ||
    draft.lines.some((l, i) => l.qty !== order.lines[i]?.qty);
  const empty = draft.lines.every((l) => l.qty === 0);

  const base = { sub, tax, total, changed };

  if (!changed) {
    return {
      ...base,
      kind: 'ok',
      blocked: false,
      title: 'Nothing changed yet',
      body: `Your card is holding ${money(auth)}. Change anything above and I will tell you what it does to that hold.`,
    };
  }

  if (empty) {
    return {
      ...base,
      kind: 'stop',
      blocked: true,
      title: 'That empties the order',
      body: 'Remove everything and this becomes a cancellation. Use Cancel this order below instead, so the hold is released properly.',
    };
  }

  if (draft.guests < MINIMUM_GUESTS) {
    return {
      ...base,
      kind: 'stop',
      blocked: true,
      title: `${draft.guests} guests is under the minimum`,
      body: `Catering platters need at least ${MINIMUM_GUESTS} people. Raise the guest count or cancel and order from the regular menu instead.`,
    };
  }

  if (total <= auth) {
    return {
      ...base,
      kind: 'ok',
      blocked: false,
      title: 'Covered by the hold already on your card',
      body: `Your new total is ${money(total)}, which is ${money(auth - total)} less than we are holding. We will simply charge the lower amount when the order goes out. No new card step.`,
    };
  }

  return {
    ...base,
    kind: 'warn',
    blocked: false,
    title: 'This is more than we are holding',
    body: `Your new total is ${money(total)} — ${money(total - auth)} above the ${money(auth)} hold. Saving this places a fresh hold for the new amount and releases the old one. Your card is on file, so it is one tap.`,
  };
}
