import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrder, updateOrder, cancelOrder } from '../lib/api.js';
import { money, dateLong, plural } from '../lib/format.js';
import ActionBar from '../components/ActionBar.jsx';

/* Section 6 — order management.

   The point of this screen is that changing a catering order has a payment
   consequence, and the customer should see it BEFORE they commit, not in an
   email afterwards.

   Three states, driven by the numbers:
     go    lowering the count — capture less than the authorization, always fine
     ask   raising within what the existing authorization covers
     stop  raising past the authorization — needs a fresh one, and the original
           hold is released only after the new one succeeds

   A Stripe authorization can be captured once, for up to the authorized amount
   (or a little over where overcapture is available). Every rule on this screen
   comes from that constraint. */

export default function OrderManage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [guests, setGuests] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    let live = true;
    getOrder(orderId)
      .then((o) => {
        if (!live) return;
        setOrder(o);
        setGuests(o.guests);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [orderId]);

  const change = useMemo(() => {
    if (!order || guests == null) return null;
    return assess(order, guests);
  }, [order, guests]);

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

  if (!order) {
    return (
      <div className="shell section">
        <p className="note" role="status">
          <span>Loading your order…</span>
        </p>
      </div>
    );
  }

  async function save() {
    setBusy(true);
    try {
      const updated = await updateOrder(orderId, { guests });
      setOrder(updated);
      setDone(
        change.kind === 'stop'
          ? 'Updated. A new authorization was requested for the higher amount; the original hold is released once it clears.'
          : 'Updated. Your kitchen has the new count.'
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
      setDone('Cancelled. The authorization on your card is released — no charge was taken.');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    setConfirmCancel(false);
  }

  const locked = order.status === 'cancelled' || order.changeLocked;

  return (
    <div className="shell om">
      <div className="om__main">
        <header className="om__head">
          <p className="eyebrow">Order {order.reference}</p>
          <h1>
            {plural(order.guests, 'person', 'people')} at {order.locationName}
          </h1>
          <p className="lede">
            {dateLong(order.date)} at {order.time} ·{' '}
            {order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}
          </p>
          <span className={`pill ${order.status === 'cancelled' ? 'pill--shut' : 'pill--open'}`}>
            {statusLabel(order.status)}
          </span>
        </header>

        {done && (
          <p className="note note--go" role="status">
            <span>{done}</span>
          </p>
        )}

        <section className="card card--pad om__block" aria-labelledby="om-items">
          <h2 id="om-items">What is on it</h2>
          <ul className="summary__list">
            {order.lines.map((l) => (
              <li key={l.id} className="summary__line">
                <span className="summary__name">
                  {l.name}
                  <span className="summary__qty">{l.selections?.join(', ') || '—'}</span>
                </span>
                <span className="summary__amt money">{money(l.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="tot">
            <div className="tot__row">
              <dt>Subtotal</dt>
              <dd className="money">{money(order.subtotal)}</dd>
            </div>
            <div className="tot__row">
              <dt>Tax</dt>
              <dd className="money">{money(order.tax)}</dd>
            </div>
            <div className="tot__row tot__row--strong">
              <dt>Authorized</dt>
              <dd className="money">{money(order.authorizedAmount)}</dd>
            </div>
          </dl>
        </section>

        {!locked && (
          <section className="card card--pad om__block" aria-labelledby="om-change">
            <h2 id="om-change">Change the headcount</h2>
            <p>
              Changes are open until {order.changeCutoffLabel}. Adjust the number and the
              payment consequence appears before you commit to it.
            </p>

            <div className="guests__control om__guests">
              <button
                type="button"
                className="guests__step"
                onClick={() => setGuests((g) => Math.max(1, g - 1))}
                disabled={guests <= 1}
                aria-label="One fewer person"
              >
                −
              </button>
              <input
                className="guests__input"
                type="number"
                inputMode="numeric"
                min="1"
                max="500"
                value={guests}
                onChange={(e) => setGuests(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                aria-label="Headcount"
              />
              <button
                type="button"
                className="guests__step"
                onClick={() => setGuests((g) => Math.min(500, g + 1))}
                disabled={guests >= 500}
                aria-label="One more person"
              >
                +
              </button>
            </div>

            {change && change.kind !== 'none' && (
              <div className={`note note--${change.kind === 'go' ? 'go' : change.kind === 'ask' ? 'ask' : 'stop'}`} role="status">
                <span>
                  <strong>{change.title}</strong> {change.body}
                </span>
              </div>
            )}

            <div className="row">
              <button
                type="button"
                className="btn btn--primary"
                onClick={save}
                disabled={busy || !change || change.kind === 'none'}
              >
                {busy ? 'Saving…' : 'Save the new count'}
              </button>
              {change && change.kind !== 'none' && (
                <button type="button" className="btn btn--quiet" onClick={() => setGuests(order.guests)}>
                  Reset
                </button>
              )}
            </div>
          </section>
        )}

        <section className="card card--pad om__block" aria-labelledby="om-again">
          <h2 id="om-again">Order this again</h2>
          <p>
            Same items, same choices, new date. The headcount comes across and you change
            it before you confirm.
          </p>
          <Link to={`/menu/${order.locationId}`} className="btn btn--ghost">
            Reorder from {order.locationName}
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

      <aside className="om__side">
        <div className="card card--pad">
          <h2 className="summary__h">Payment</h2>
          <dl className="tot">
            <div className="tot__row">
              <dt>Card</dt>
              <dd>
                {order.card?.brand} ···· {order.card?.last4}
              </dd>
            </div>
            <div className="tot__row">
              <dt>Status</dt>
              <dd>{order.paymentStatus}</dd>
            </div>
            <div className="tot__row">
              <dt>Charged on</dt>
              <dd>{dateLong(order.date)}</dd>
            </div>
          </dl>
          <p className="meta">
            You are charged what the kitchen actually hands over, up to the authorized
            amount. A lower final count means a lower charge, with no action from you.
          </p>
        </div>
      </aside>

      <ActionBar
        summary={`Order ${order.reference}`}
        detail={`${money(order.authorizedAmount)} · ${statusLabel(order.status)}`}
        actionLabel="Save changes"
        onAction={save}
        disabled={busy || locked || !change || change.kind === 'none'}
      />
    </div>
  );
}

function statusLabel(s) {
  return (
    {
      authorized: 'Card held',
      saved_card: 'Card saved',
      captured: 'Paid',
      cancelled: 'Cancelled',
      in_kitchen: 'In the kitchen',
    }[s] || s
  );
}

/** What does changing to `guests` do to the money? */
function assess(order, guests) {
  if (guests === order.guests) return { kind: 'none' };

  const perHead = order.subtotal / order.guests;
  const newSubtotal = perHead * guests;
  const newTotal = newSubtotal * (1 + order.tax / order.subtotal);

  if (guests < order.guests) {
    return {
      kind: 'go',
      title: `Down to ${plural(guests, 'person', 'people')}.`,
      body: `You will be charged ${money(newTotal)} instead of ${money(order.authorizedAmount)}. Nothing to re-authorize — we simply capture less.`,
    };
  }

  if (newTotal <= order.authorizedAmount) {
    return {
      kind: 'ask',
      title: `Up to ${plural(guests, 'person', 'people')}.`,
      body: `${money(newTotal)} still fits inside the ${money(order.authorizedAmount)} already held, so your existing authorization covers it.`,
    };
  }

  return {
    kind: 'stop',
    title: `That is more than the hold covers.`,
    body: `${money(newTotal)} is above the ${money(order.authorizedAmount)} authorized. Saving this requests a new authorization on the same card; the original is released once the new one clears. If the card declines, the order stays at ${plural(order.guests, 'person', 'people')}.`,
  };
}
