import { useEffect, useMemo, useRef, useState } from 'react';
import { groupOptions } from '../data/menu.js';
import { GROUP_NOTES, groupSatisfied } from '../data/options.js';
import { money } from '../lib/format.js';

/* Prototype section 4 — the item configurator, as a sheet over the menu.

   It is a sheet and not a page because that is how the prototype behaves: you
   are choosing sides for a platter, not navigating somewhere. Losing your place
   in a 76-item list to pick three salads is the friction this removes.

   Three things the live site does not do, and this does:

   1. The rule is the control. "Choose 1" renders as radios; "choose up to 3"
      renders as checkboxes that disable the remainder at three, with a live
      "0 OF 3" counter. Add stays off, naming what is missing, until every
      required group is satisfied.

   2. "1 Vegetarians / 2 Vegetarians / 3 Vegetarians / 4 Vegetarians" — four
      independent tick boxes on the live site — becomes one counter bounded by
      the guest count. It is a number, so it gets a number control.

   3. Allergies get a real field, which travels with the line item to the
      kitchen, instead of being a sentence someone types into a general notes
      box at the very end (or nowhere). */

export default function ItemSheet({ item, guests, onAdd, onClose }) {
  const [selections, setSelections] = useState(() =>
    Object.fromEntries((item.groups || []).map((g) => [g.id, []]))
  );
  const [veg, setVeg] = useState(0);
  const [allergies, setAllergies] = useState('');
  const [qty, setQty] = useState(1);

  const panelRef = useRef(null);
  const closeRef = useRef(null);

  const missing = useMemo(
    () => (item.groups || []).filter((g) => g.req && !groupSatisfied(g, selections[g.id])),
    [item.groups, selections]
  );

  /* A sheet is a dialog: Escape closes it, focus is trapped inside while it is
     open, the page behind does not scroll, and focus goes back where it came
     from on close. */
  useEffect(() => {
    const prev = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = [
        ...panelRef.current.querySelectorAll(
          'a[href], button:not(:disabled), input:not(:disabled), textarea, [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [onClose]);

  const units = item.unit === 'box' ? qty : guests * qty;
  const total = units * item.price;
  const blocked = missing.length > 0;

  function pick(group, option) {
    setSelections((s) => {
      const cur = s[group.id] || [];
      if (group.type === 'one') return { ...s, [group.id]: [option] };
      if (cur.includes(option)) return { ...s, [group.id]: cur.filter((o) => o !== option) };
      if (group.max > 0 && cur.length >= group.max) return s;
      return { ...s, [group.id]: [...cur, option] };
    });
  }

  function submit() {
    if (blocked) return;
    onAdd({
      itemId: item.id,
      name: item.name,
      price: item.price,
      qty,
      unit: item.unit || 'person',
      serves: item.serves,
      selections,
      vegetarian: veg,
      allergies: allergies.trim(),
    });
  }

  return (
    <>
      <div className="sheet__scrim" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        ref={panelRef}
      >
        <header className="sheet__head">
          <div>
            <span className="sheet__badges">
              {item.popular && <span className="badge badge--pop">Most popular</span>}
              {item.vegetarian && <span className="badge badge--veg">Vegetarian</span>}
            </span>
            <h2 id="sheet-title">{item.name}</h2>
            <p className="sheet__desc">{item.desc}</p>
          </div>
          <button type="button" className="sheet__x" onClick={onClose} ref={closeRef}>
            <span aria-hidden="true">×</span>
            <span className="visually-hidden">Close</span>
          </button>
        </header>

        <div className="sheet__body">
          {item.dataFlag && (
            <p className="note note--ask">
              <span>
                <strong>Price needs confirming.</strong> {item.dataFlag}
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

            return (
              <fieldset key={group.id} className="group">
                <legend className="group__legend">
                  <span className="group__title">{group.title}</span>
                  {group.type === 'upto' && group.max > 0 && (
                    <span className="group__count">
                      {chosen.length} of {group.max}
                    </span>
                  )}
                </legend>

                <p className="group__rule">
                  {group.type === 'one'
                    ? 'Pick one.'
                    : group.max > 0
                      ? `Pick up to ${group.max}.`
                      : 'Pick as many as you like.'}
                </p>

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
                        <label
                          className={`opt${on ? ' opt--on' : ''}${disabled ? ' opt--off' : ''}`}
                        >
                          <input
                            type={group.type === 'one' ? 'radio' : 'checkbox'}
                            name={`${item.id}-${group.id}`}
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
              </fieldset>
            );
          })}

          {/* The live site asks this as four separate tick boxes. It is a
              number, so it gets a number. */}
          {item.categoryId === 'sandwich-platters' && (
            <fieldset className="group">
              <legend className="group__legend">
                <span className="group__title">Vegetarian sandwiches</span>
              </legend>
              <p className="group__rule">
                How many of the sandwiches should be vegetarian? The live site asks this as
                four separate tick boxes.
              </p>
              <div className="row">
                <div className="guests__control">
                  <button
                    type="button"
                    className="guests__step"
                    onClick={() => setVeg((v) => Math.max(0, v - 1))}
                    disabled={veg <= 0}
                    aria-label="Fewer vegetarian sandwiches"
                  >
                    −
                  </button>
                  <input
                    className="guests__input"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={guests}
                    value={veg}
                    onChange={(e) =>
                      setVeg(Math.max(0, Math.min(guests, Number(e.target.value) || 0)))
                    }
                    aria-label="Vegetarian sandwiches"
                  />
                  <button
                    type="button"
                    className="guests__step"
                    onClick={() => setVeg((v) => Math.min(guests, v + 1))}
                    disabled={veg >= guests}
                    aria-label="More vegetarian sandwiches"
                  >
                    +
                  </button>
                </div>
                <span className="meta">of {guests} guests</span>
              </div>
            </fieldset>
          )}

          <div className="field">
            <label className="field__label" htmlFor="allergies">
              Allergies or special requests
            </label>
            <textarea
              id="allergies"
              className="textarea"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              aria-describedby="allergies-hint"
            />
            <span className="field__hint" id="allergies-hint">
              Anything the kitchen should know. This travels with the line item to the
              store.
            </span>
          </div>
        </div>

        <footer className="sheet__foot">
          {blocked && (
            <p className="sheet__missing" role="status">
              Still to choose: {missing.map((g) => g.title.toLowerCase()).join(', ')}.
            </p>
          )}

          <div className="sheet__money">
            <strong className="money">{money(total)}</strong>
            <span>
              {item.unit === 'box'
                ? `${money(item.price)} × ${qty} ${qty === 1 ? 'box' : 'boxes'}`
                : `${money(item.price)} × ${guests} guests`}
            </span>
          </div>

          <div className="sheet__actions">
            <div className="guests__control">
              <button
                type="button"
                className="guests__step"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="Fewer"
              >
                −
              </button>
              <input
                className="guests__input"
                type="number"
                inputMode="numeric"
                min="1"
                max="50"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                aria-label="Quantity"
              />
              <button
                type="button"
                className="guests__step"
                onClick={() => setQty((q) => Math.min(50, q + 1))}
                disabled={qty >= 50}
                aria-label="More"
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="btn btn--primary btn--lg sheet__add"
              onClick={submit}
              disabled={blocked}
            >
              Add to order
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
