import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { MENU, findItem } from '../data/menu.js';
import { getLocation } from '../data/locations.js';
import { useOrder, useSyncLocation, lineTotal } from '../state/OrderContext.jsx';
import { money, plural } from '../lib/format.js';
import { MINIMUM_GUESTS, MAIN_SITE } from '../data/site.js';
import ItemSheet from '../components/ItemSheet.jsx';
import ActionBar from '../components/ActionBar.jsx';
import Stepper from '../components/Stepper.jsx';
import EmptyState from '../components/EmptyState.jsx';

/* Prototype section 3 — "76 items, guest-count pricing".

   The headcount is a control, not a sentence. Set it once and every one of the
   76 prices restates as "$90.00 for 12", so nobody multiplies in their head or
   discovers the real number at checkout.

   Filters are the three the prototype names — Most popular, Vegetarian,
   Individually packed — which map to flags that actually exist in the data,
   rather than invented facets. */

const FILTERS = [
  { id: 'popular', label: 'Most popular' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'individual', label: 'Individually packed' },
];

export default function Menu() {
  const { locationId } = useParams();
  const location = getLocation(locationId);
  const { order, dispatch, totals } = useOrder();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState([]);
  const [active, setActive] = useState(MENU[0].id);
  const [sheetId, setSheetId] = useState(null);
  const sectionRefs = useRef({});

  useSyncLocation(location?.id);

  const toggleFilter = (id) =>
    setFilters((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MENU.map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => {
        if (q && !`${it.name} ${it.desc}`.toLowerCase().includes(q)) return false;
        if (filters.includes('popular') && !it.popular) return false;
        if (filters.includes('vegetarian') && !it.vegetarian) return false;
        if (filters.includes('individual') && !cat.indiv) return false;
        return true;
      }),
    })).filter((cat) => cat.items.length > 0);
  }, [query, filters]);

  /* Scroll-spy. Deliberately a scroll listener rather than an
     IntersectionObserver: an observer only reports sections that CHANGED
     state, so a jump — an anchor click, or scrolling straight back to the top —
     can fire with nothing intersecting and leave the rail stuck on whatever it
     last saw. Recomputing from positions is jump-proof. */
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Must sit below where an anchor jump parks a section (scroll-margin-top),
      // or the section you just jumped to reads as "not reached yet".
      const line = 150;
      let current = shown[0]?.id || MENU[0].id;
      for (const cat of shown) {
        const el = sectionRefs.current[cat.id];
        if (el && el.getBoundingClientRect().top <= line) current = cat.id;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        const last = [...shown].reverse().find((c) => sectionRefs.current[c.id]);
        if (last) current = last.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shown]);

  /* An occasion card on the catering page jumps into the category that serves
     it, rather than dropping people at the top of a 76-item list. */
  useEffect(() => {
    const cat = sessionStorage.getItem('mm.jumpCat');
    if (!cat) return;
    sessionStorage.removeItem('mm.jumpCat');
    const el = document.getElementById(cat);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, []);

  const resultCount = shown.reduce((n, c) => n + c.items.length, 0);
  const filtering = Boolean(query.trim()) || filters.length > 0;
  const sheetItem = sheetId ? findItem(sheetId) : null;

  if (!location) return <Navigate to="/" replace />;

  const belowMin = order.guests < MINIMUM_GUESTS;

  return (
    <>
      {/* ---- Store bar ------------------------------------------------------ */}
      <div className="storebar">
        <div className="shell storebar__in">
          <h1 className="storebar__store">
            <span className="storebar__name">{location.name}</span>
            <span className="storebar__addr">· {location.addr}</span>
          </h1>
          <p className="storebar__links">
            <Link to="/" className="storebar__link">
              Change store
            </Link>
            <a href={`${MAIN_SITE}/locations/`} className="btn btn--ghost">
              Locations
            </a>
          </p>
        </div>
      </div>

      {/* ---- Guests + filters ----------------------------------------------- */}
      <div className="menubar">
        <div className="shell menubar__in">
          <div className="guests">
            <label className="guests__label" htmlFor="guests">
              Guests
            </label>
            <Stepper
              id="guests"
              value={order.guests}
              min={1}
              max={500}
              onChange={(g) => dispatch({ type: 'setGuests', guests: g })}
              decLabel="One fewer guest"
              incLabel="One more guest"
            />
          </div>

          <div className="tools__search">
            <label className="visually-hidden" htmlFor="q">
              Search the menu
            </label>
            <input
              id="q"
              className="input"
              type="search"
              placeholder="Search the menu…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="tools__filters" role="group" aria-label="Filter the menu">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chip${filters.includes(f.id) ? ' chip--on' : ''}`}
                aria-pressed={filters.includes(f.id)}
                onClick={() => toggleFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {belowMin && (
          <div className="shell">
            <p className="note note--ask menubar__warn" role="status">
              Platters need {MINIMUM_GUESTS} people or more. At {plural(order.guests, 'guest')}{' '}
              you can still order individually packed breakfast, boxed lunches and
              beverages — use the <strong>Individually packed</strong> filter.
            </p>
          </div>
        )}
      </div>

      <div className="shell layout">
        {/* ---- Category rail ------------------------------------------------ */}
        <nav className="rail" aria-labelledby="rail-head">
          <div className="rail__inner">
            <h2 className="rail__head" id="rail-head">
              Categories
            </h2>
            <ul className="rail__list">
              {MENU.map((cat) => (
                <li key={cat.id}>
                  <a
                    href={`#${cat.id}`}
                    className={`rail__link${active === cat.id ? ' rail__link--on' : ''}`}
                    aria-current={active === cat.id ? 'true' : undefined}
                  >
                    {cat.name}
                    <span className="rail__count">{cat.items.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* ---- Menu ---------------------------------------------------------- */}
        <div className="menu">
          <p className="tools__result" role="status" aria-live="polite">
            {filtering
              ? `${resultCount} of 76 items`
              : `76 items, priced for ${plural(order.guests, 'guest')}`}
            {filtering && (
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => {
                  setQuery('');
                  setFilters([]);
                }}
              >
                Clear
              </button>
            )}
          </p>

          {resultCount === 0 && (
            <EmptyState
              heading="h2"
              title="Nothing matches that"
              action={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setQuery('');
                    setFilters([]);
                  }}
                >
                  Show the whole menu
                </button>
              }
            >
              <p>
                Try a shorter word, or clear the filters. Every one of the 76 items is
                still here.
              </p>
            </EmptyState>
          )}

          {shown.map((cat) => (
            <section
              key={cat.id}
              id={cat.id}
              className="cat"
              ref={(el) => {
                sectionRefs.current[cat.id] = el;
              }}
              aria-labelledby={`${cat.id}-h`}
            >
              <div className="cat__head">
                <h3 id={`${cat.id}-h`}>{cat.name}</h3>
                {cat.indiv ? (
                  <span className="badge badge--min">Individually packed</span>
                ) : (
                  <span className="cat__note">{cat.note}</span>
                )}
              </div>

              <ul className="cards grid">
                {cat.items.map((it) => (
                  <li key={it.id}>
                    <ItemCard item={it} guests={order.guests} onOpen={() => setSheetId(it.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* ---- Your order ---------------------------------------------------- */}
        <aside className="summary" aria-labelledby="sum-h">
          <div className="summary__inner card">
            <h2 id="sum-h" className="summary__h">
              Your order
            </h2>
            <p className="summary__meta">
              Catering order
              <span>For {plural(order.guests, 'guest')}</span>
            </p>

            {order.lines.length === 0 ? (
              <p className="summary__empty">
                Nothing added yet. Set your guest count first — every price below
                recalculates to a real total.
              </p>
            ) : (
              <ul className="summary__list">
                {order.lines.map((l) => (
                  <li key={l.uid} className="summary__line">
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
                    <button
                      type="button"
                      className="summary__x"
                      onClick={() => dispatch({ type: 'removeLine', uid: l.uid })}
                    >
                      <span aria-hidden="true">×</span>
                      <span className="visually-hidden">Remove {l.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="summary__total">
              <span>Estimated subtotal</span>
              <span className="money">{money(totals.subtotal)}</span>
            </p>

            <Link
              to="/checkout"
              className={`btn btn--primary btn--block${totals.count === 0 ? ' btn--off' : ''}`}
              aria-disabled={totals.count === 0}
              onClick={(e) => {
                if (totals.count === 0) e.preventDefault();
              }}
            >
              Continue to delivery
            </Link>

            <p className="summary__tax">
              Lead time, delivery radius and fee are still to be confirmed — they belong
              here, above the button.
            </p>
          </div>
        </aside>
      </div>

      {sheetItem && (
        <ItemSheet
          key={sheetItem.id}
          item={sheetItem}
          guests={order.guests}
          onClose={() => setSheetId(null)}
          onAdd={(line) => {
            dispatch({ type: 'addLine', line });
            setSheetId(null);
          }}
        />
      )}

      <ActionBar
        count={totals.count}
        total={totals.subtotal}
        summary={location.name}
        detail={plural(order.guests, 'guest')}
        actionLabel={totals.count === 0 ? 'Add something' : 'Continue to delivery'}
        to={totals.count > 0 ? '/checkout' : undefined}
        onAction={() =>
          document.getElementById(MENU[0].id)?.scrollIntoView({ behavior: 'smooth' })
        }
      />
    </>
  );
}

function ItemCard({ item, guests, onOpen }) {
  const units = item.unit === 'box' ? 1 : guests;
  const total = item.price * units;

  return (
    <article className="item">
      <div className="item__top">
        <h4 className="item__name">{item.name}</h4>
        <span className="item__badges">
          {item.popular && <span className="badge badge--pop">Most popular</span>}
          {item.vegetarian && <span className="badge badge--veg">Vegetarian</span>}
        </span>
      </div>

      <p className="item__desc">{item.desc}</p>

      {item.rule && <p className="item__rule">{item.rule}</p>}

      {item.dataFlag && (
        <p className="item__flag">
          <strong>Check this price.</strong> {item.dataFlag}
        </p>
      )}

      <div className="item__price">
        <span className="item__unit money">
          <strong>{money(item.price)}</strong>
          <em>{item.unit === 'box' ? `per box · serves ${item.serves}` : 'per person'}</em>
          <span className="item__line">
            {item.unit === 'box' ? money(total) : `${money(total)} for ${guests}`}
          </span>
        </span>
        <button type="button" className="add" onClick={onOpen}>
          Add
          <span className="visually-hidden"> {item.name}</span>
        </button>
      </div>
    </article>
  );
}
