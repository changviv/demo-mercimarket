import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { findItem } from '../data/menu.js';
import { groupOptions } from '../data/menu.js';
import { GROUP_NOTES, ruleLabel, groupSatisfied } from '../data/options.js';
import { getLocation } from '../data/locations.js';
import { useOrder, useSyncLocation } from '../state/OrderContext.jsx';
import { money, plural } from '../lib/format.js';
import { MINIMUM_GUESTS } from '../data/site.js';
import ActionBar from '../components/ActionBar.jsx';

/* Section 4 — the item configurator.

   The live site renders every modifier group as checkboxes with no limit, even
   where its own description says "choose 1", and even where four checkboxes
   read "1 Vegetarians", "2 Vegetarians", "3 Vegetarians", "4 Vegetarians".

   Here the rule on the group is the rule in the DOM:
     type 'one'  -> radios, exactly one, required
     type 'upto' -> checkboxes that disable the unselected rest at max
   and Add stays off, with a named reason, until every required group is
   satisfied. */

export default function Item() {
  const { locationId, itemId } = useParams();
  const item = findItem(itemId);
  const location = getLocation(locationId);
  const { order, dispatch, totals } = useOrder();
  const navigate = useNavigate();

  // Must run here too, not only on the menu: without it a deep-linked item is
  // added while the order has no location, and the menu then clears the basket
  // the moment it loads.
  useSyncLocation(location?.id);

  const [selections, setSelections] = useState(() =>
    Object.fromEntries((item?.groups || []).map((g) => [g.id, []]))
  );
  const [qty, setQty] = useState(1);

  const missing = useMemo(
    () => (item?.groups || []).filter((g) => g.req && !groupSatisfied(g, selections[g.id])),
    [item, selections]
  );

  if (!location) return <Navigate to="/" replace />;
  if (!item) return <Navigate to={`/menu/${locationId}`} replace />;

  const units = item.unit === 'box' ? qty : order.guests * qty;
  const total = units * item.price;
  const blockedByMin = item.min > 1 && order.guests < item.min;

  function pick(group, option) {
    setSelections((s) => {
      const cur = s[group.id] || [];
      if (group.type === 'one') return { ...s, [group.id]: [option] };
      if (cur.includes(option)) return { ...s, [group.id]: cur.filter((o) => o !== option) };
      if (group.max > 0 && cur.length >= group.max) return s;
      return { ...s, [group.id]: [...cur, option] };
    });
  }

  function add() {
    if (missing.length || blockedByMin) return;
    dispatch({
      type: 'addLine',
      line: {
        itemId: item.id,
        name: item.name,
        price: item.price,
        qty,
        unit: item.unit || 'person',
        serves: item.serves,
        selections,
      },
    });
    navigate(`/menu/${locationId}`);
  }

  return (
    <>
      <div className="shell crumbs">
        <Link to={`/menu/${locationId}`} className="crumbs__back">
          ← {item.categoryName}
        </Link>
      </div>

      <div className="shell config">
        <div className="config__main">
          <header className="config__head">
            <div className="row">
              {item.popular && <span className="pill pill--pop">Popular</span>}
              {item.vegetarian && <span className="pill pill--veg">Vegetarian</span>}
              <span className="pill">{item.note}</span>
            </div>
            <h1>{item.name}</h1>
            <p className="lede">{item.desc}</p>
          </header>

          {item.dataFlag && (
            <p className="note note--ask">
              <span>
                <strong>Price needs confirming.</strong> {item.dataFlag}
              </span>
            </p>
          )}

          {blockedByMin && (
            <p className="note note--stop" role="status">
              <span>
                <strong>{item.categoryName} needs {item.min} people or more.</strong> You are
                set to {plural(order.guests, 'guest')}. Raise the headcount below, or go
                back and look at the no-minimum categories.
              </span>
            </p>
          )}

          {item.groups.length === 0 && (
            <p className="note">
              <span>No choices to make on this one — it comes as described.</span>
            </p>
          )}

          {item.groups.map((group) => {
            const opts = groupOptions(group);
            const chosen = selections[group.id] || [];
            const atMax = group.type === 'upto' && group.max > 0 && chosen.length >= group.max;
            const ok = groupSatisfied(group, chosen);

            return (
              <fieldset key={group.id} className="group">
                <legend className="group__legend">
                  <span className="group__title">{group.title}</span>
                  <span className={`group__rule${ok ? ' group__rule--ok' : ''}`}>
                    {ruleLabel(group)}
                    {group.type === 'upto' && group.max > 0 && (
                      <span className="group__count">
                        {' '}
                        · {chosen.length} of {group.max}
                      </span>
                    )}
                    {group.req && !ok && <span className="group__req"> · required</span>}
                  </span>
                </legend>

                {GROUP_NOTES[group.id] && (
                  <p className="note note--ask group__note">
                    <span>{GROUP_NOTES[group.id]}</span>
                  </p>
                )}

                <ul className="opts">
                  {opts.map((option) => {
                    const on = chosen.includes(option);
                    const disabled = !on && atMax;
                    return (
                      <li key={option}>
                        <label className={`opt${on ? ' opt--on' : ''}${disabled ? ' opt--off' : ''}`}>
                          <input
                            type={group.type === 'one' ? 'radio' : 'checkbox'}
                            name={group.id}
                            checked={on}
                            disabled={disabled}
                            onChange={() => pick(group, option)}
                          />
                          <span className="opt__label">{option}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>

                {atMax && (
                  <p className="group__max" role="status">
                    That is {group.max}. Unpick one to swap it.
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>

        {/* ---- Add panel ---------------------------------------------------- */}
        <aside className="config__side">
          <div className="card card--pad config__box">
            <p className="config__price">
              <strong className="money">{money(item.price)}</strong>
              <span>{item.unit === 'box' ? `per box · serves ${item.serves}` : 'per person'}</span>
            </p>

            <div className="field">
              <label className="field__label" htmlFor="qty">
                {item.unit === 'box' ? 'How many boxes?' : 'How many platters?'}
              </label>
              <div className="guests__control">
                <button
                  type="button"
                  className="guests__step"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  aria-label="One fewer"
                >
                  −
                </button>
                <input
                  id="qty"
                  className="guests__input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                />
                <button
                  type="button"
                  className="guests__step"
                  onClick={() => setQty((q) => Math.min(50, q + 1))}
                  disabled={qty >= 50}
                  aria-label="One more"
                >
                  +
                </button>
              </div>
              <span className="field__hint">
                {item.unit === 'box'
                  ? `Serves about ${item.serves * qty} cups.`
                  : `Priced for ${plural(order.guests, 'guest')} — change the headcount on the menu.`}
              </span>
            </div>

            <p className="config__total">
              <span>Adds to your order</span>
              <span className="money">{money(total)}</span>
            </p>

            {missing.length > 0 && (
              <p className="config__missing" role="status">
                Still to choose: {missing.map((g) => g.title.toLowerCase()).join(', ')}.
              </p>
            )}

            <button
              type="button"
              className="btn btn--primary btn--block btn--lg"
              onClick={add}
              disabled={missing.length > 0 || blockedByMin}
            >
              Add to order
            </button>

            {order.guests < MINIMUM_GUESTS && item.min > 1 && (
              <button
                type="button"
                className="btn btn--ghost btn--block config__raise"
                onClick={() => dispatch({ type: 'setGuests', guests: MINIMUM_GUESTS })}
              >
                Set headcount to {MINIMUM_GUESTS}
              </button>
            )}
          </div>
        </aside>
      </div>

      <ActionBar
        count={totals.count}
        total={totals.subtotal}
        summary={item.name}
        detail={missing.length ? `Choose ${missing[0].title.toLowerCase()}` : money(total)}
        actionLabel="Add to order"
        onAction={add}
        disabled={missing.length > 0 || blockedByMin}
      />
    </>
  );
}
