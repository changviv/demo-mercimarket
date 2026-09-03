import { useEffect, useRef, useState } from 'react';
import { LOCATIONS, locationStatus } from '../data/locations.js';
import { Clock } from './Icons.jsx';

/* "Change store", as a menu rather than a trip back to the home page.

   Why this replaces two controls with one. The ordering masthead carried both
   "Change store" and a "Locations" button, which are the same job twice: both
   ended at the six-store picker on the home page. Worse, getting there meant
   leaving the menu — you lost your scroll position and the store you were
   already looking at, to do something that takes one click.

   THE THING THAT SHAPES THIS DESIGN: switching store clears the order. Prices,
   stock and lead times are per-kitchen, so the basket cannot survive the move
   (see setLocation in OrderContext). A dropdown makes that one click away,
   which is exactly why it must not be silent. So:

     - with an empty order, choosing a store just switches. No ceremony.
     - with items on the order, the panel asks once, names the store you are
       moving to and the number of items it will cost, and makes the
       destructive option the one you have to reach for.

   That is the whole trade: the speed is worth having, the silence is not.

   TWO PRESENTATIONS, ONE COMPONENT. On a desktop masthead this is a dropdown
   under a trigger. On a phone the masthead has room for the wordmark and the
   burger and nothing else, so the same list renders open inside the drawer
   (`inline`) — same six stores, same confirmation, same copy. Writing the
   phone one separately is how the two drift apart. */

export default function StoreMenu({ current, onChoose, inline = false, onDone }) {
  const [open, setOpen] = useState(inline);
  const [confirming, setConfirming] = useState(null);
  const [clears, setClears] = useState(0);

  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  const close = () => {
    setConfirming(null);
    if (inline) {
      onDone?.();
      return;
    }
    setOpen(false);
  };

  /* Click outside and Escape both close. Escape is handled at the document so
     it works wherever focus has landed inside the panel. Neither applies to the
     inline list: it has no outside, and Escape there belongs to the drawer. */
  useEffect(() => {
    if (!open || inline) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, inline]);

  /* Opening moves focus into the list, at the store you are on. A menu that
     opens and leaves focus on the trigger is unusable from a keyboard. The
     inline list is already on the page, so stealing focus into it would fight
     the drawer's own focus handling. */
  useEffect(() => {
    if (!open || confirming || inline) return;
    const items = listRef.current?.querySelectorAll('[role="menuitem"]');
    if (!items?.length) return;
    const at = [...items].findIndex((i) => i.dataset.id === current?.id);
    items[at > -1 ? at : 0].focus();
  }, [open, confirming, inline, current?.id]);

  /* Up/Down move, Home/End jump, and both ends wrap. */
  const onListKey = (e) => {
    const items = [...(listRef.current?.querySelectorAll('[role="menuitem"]') || [])];
    if (!items.length) return;
    const at = items.indexOf(document.activeElement);
    const go = (n) => {
      e.preventDefault();
      items[(n + items.length) % items.length].focus();
    };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
  };

  const attempt = (loc) => {
    if (loc.id === current?.id) {
      close();
      return;
    }
    const n = onChoose(loc, { dryRun: true });
    if (n > 0) {
      setClears(n);
      setConfirming(loc);
      return;
    }
    onChoose(loc);
    close();
  };

  const commit = () => {
    onChoose(confirming);
    close();
  };

  return (
    <div className={`storemenu${inline ? ' storemenu--inline' : ''}`} ref={wrapRef}>
      {!inline && (
        <button
          type="button"
          ref={triggerRef}
          className="storemenu__trigger"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => (open ? close() : setOpen(true))}
        >
          Change store
          <svg
            className="storemenu__caret"
            width="10"
            height="7"
            viewBox="0 0 10 7"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1.5L5 5.5L9 1.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {open && !confirming && (
        <div className="storemenu__panel" role="menu" ref={listRef} onKeyDown={onListKey}>
          <p className="storemenu__head">Order from</p>
          <ul className="storemenu__list">
            {LOCATIONS.map((loc) => {
              const st = locationStatus(loc);
              const here = loc.id === current?.id;
              return (
                <li key={loc.id}>
                  <button
                    type="button"
                    role="menuitem"
                    data-id={loc.id}
                    className={`storemenu__item${here ? ' storemenu__item--here' : ''}`}
                    aria-current={here ? 'true' : undefined}
                    onClick={() => attempt(loc)}
                  >
                    <span className="storemenu__name">
                      {loc.name}
                      {here && <span className="storemenu__here">Current</span>}
                    </span>
                    <span className="storemenu__addr">{loc.addr}</span>
                    <span className={`storemenu__hours${st.open ? '' : ' storemenu__hours--shut'}`}>
                      <Clock />
                      {st.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* The confirmation only ever appears when there is something to lose,
          and it says what and how much rather than "are you sure?". */}
      {open && confirming && (
        <div
          className="storemenu__panel storemenu__panel--ask"
          role="alertdialog"
          aria-label="Confirm changing store"
        >
          <p className="storemenu__askhead">Switch to {confirming.name}?</p>
          <p className="storemenu__askbody">
            The {clears === 1 ? '1 item' : `${clears} items`} on this order will be
            cleared. Each kitchen has its own prices and lead times, so an order
            cannot move between them.
          </p>
          <div className="storemenu__askrow">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirming(null)}>
              Keep my order
            </button>
            <button type="button" className="btn btn--primary" onClick={commit}>
              Switch and clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
