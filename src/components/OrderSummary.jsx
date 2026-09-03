import { money } from '../lib/format.js';

/* "Your order" — the card that follows the order down the page.

   Same card as the browse screen's (`.sum-card`, `.lines`, `.ln`, `.amt`): the
   menu artifact (06cbed02) and the checkout artifact (42bdcee2) draw the same
   object, so it is one component rather than two that drift. What changes
   between screens is what sits under the lines — a subtotal and a button on the
   menu, the full arithmetic here — so those arrive as data.

   A row's tone carries meaning, not decoration: `pending` is a number nobody
   has yet, drawn in tomato so it reads as an open question rather than a zero,
   and `total` is the one figure the card exists to state. */

export default function OrderSummary({ title, meta, items, rows, note, children }) {
  return (
    <div className="sum-card">
      <div className="sum-head">
        <b>{title}</b>
      </div>
      <p className="sum-guests">{meta}</p>

      <ul className="lines">
        {items.map((l) => (
          <li key={l.key}>
            <span className="ln">
              <b>{l.name}</b>
              <span>{l.sub}</span>
            </span>
            <span className="amt money">{money(l.amount)}</span>
          </li>
        ))}
      </ul>

      <dl className="tot">
        {rows.map((r) => (
          <div
            key={r.key}
            className={`tot__row${r.tone ? ` tot__row--${r.tone}` : ''}`}
          >
            <dt>{r.label}</dt>
            <dd className={r.money === false ? undefined : 'money'}>{r.value}</dd>
          </div>
        ))}
      </dl>

      {note && <p className="pending">{note}</p>}
      {children}
    </div>
  );
}
