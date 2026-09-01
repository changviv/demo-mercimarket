import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { MENU } from '../data/menu.js';
import { getLocation, locationStatus } from '../data/locations.js';
import { useOrder, useSyncLocation, lineTotal } from '../state/OrderContext.jsx';
import { money, plural } from '../lib/format.js';
import { MINIMUM_GUESTS } from '../data/site.js';
import ActionBar from '../components/ActionBar.jsx';

/* Section 3 — menu browse.

   Three things the live site does not do, and this does:
   1. Headcount is a control, not a sentence. Set it once; all 76 prices
      restate as "$13.99 x 14 = $195.86" so nobody multiplies in their head.
   2. Categories are a rail with scroll-spy, so at 76 items you always know
      where you are.
   3. The 8-person minimum is enforced at the point it applies — on the platter
      categories — instead of being printed as a note and ignored. */

const FILTERS = [
  { id: 'popular', label: 'Popular' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'nomin', label: 'No minimum' },
];

export default function Menu() {
  const { locationId } = useParams();
  const location = getLocation(locationId);
  const { order, dispatch, totals } = useOrder();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState([]);
  const [active, setActive] = useState(MENU[0].id);
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
        if (filters.includes('nomin') && cat.min > 1) return false;
        return true;
      }),
    })).filter((cat) => cat.items.length > 0);
  }, [query, filters]);

  /* Scroll-spy for the category rail.

     Deliberately a scroll listener rather than an IntersectionObserver. An
     observer only tells you which sections CHANGED state, so a jump — an anchor
     click, or scrolling straight back to the top — can fire a callback in which
     nothing is intersecting, and the rail then keeps highlighting whatever it
     last saw. Recomputing from actual positions is jump-proof, and eight
     sections behind a rAF costs nothing. */
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      // Must sit BELOW where an anchor jump parks a section, or the section you
      // just jumped to reads as "not reached yet" and the rail highlights the
      // one above it. .cat sets scroll-margin-top: header + 60px = 128px.
      const line = 150;
      let current = MENU[0].id;
      for (const cat of MENU) {
        const el = sectionRefs.current[cat.id];
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = cat.id;
      }
      // At the very bottom the last section may never cross the line.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        const last = [...MENU].reverse().find((c) => sectionRefs.current[c.id]);
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

  const resultCount = shown.reduce((n, c) => n + c.items.length, 0);
  const filtering = Boolean(query.trim()) || filters.length > 0;

  if (!location) return <Navigate to="/" replace />;

  const st = locationStatus(location);
  const belowMin = order.guests < MINIMUM_GUESTS;

  return (
    <>
      <div className="menubar">
        <div className="shell menubar__inner">
          <div className="menubar__where">
            <Link to="/" className="menubar__back">
              ← All locations
            </Link>
            {/* The store name is this page's h1 — it is what the page is about,
                and without it the menu jumped straight to h2 category headings. */}
            <h1 className="menubar__store">
              <span className="menubar__name">{location.name}</span>
              <span className="menubar__addr">{location.addr}</span>
              <span className={`pill ${st.open ? 'pill--open' : 'pill--shut'}`}>{st.label}</span>
            </h1>
          </div>

          <div className="guests">
            <label className="guests__label" htmlFor="guests">
              How many people?
            </label>
            <div className="guests__control">
              <button
                type="button"
                className="guests__step"
                onClick={() => dispatch({ type: 'setGuests', guests: order.guests - 1 })}
                disabled={order.guests <= 1}
                aria-label="One fewer guest"
              >
                −
              </button>
              <input
                id="guests"
                className="guests__input"
                type="number"
                inputMode="numeric"
                min="1"
                max="500"
                value={order.guests}
                onChange={(e) => dispatch({ type: 'setGuests', guests: Number(e.target.value) })}
              />
              <button
                type="button"
                className="guests__step"
                onClick={() => dispatch({ type: 'setGuests', guests: order.guests + 1 })}
                disabled={order.guests >= 500}
                aria-label="One more guest"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {belowMin && (
          <div className="shell">
            <p className="note note--ask menubar__warn" role="status">
              Platters need {MINIMUM_GUESTS} people or more. At {plural(order.guests, 'guest')}{' '}
              you can still order individually packed breakfast, boxed lunches and
              beverages — use the <strong>No minimum</strong> filter.
            </p>
          </div>
        )}
      </div>

      <div className="shell layout">
        {/* ---- Category rail ---------------------------------------------- */}
        <nav className="rail" aria-label="Menu categories">
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
        </nav>

        {/* ---- Menu -------------------------------------------------------- */}
        <div className="menu">
          <div className="tools">
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
            <div className="empty card card--pad">
              <h2>Nothing matches that</h2>
              <p>
                Try a shorter word, or clear the filters. Every one of the 76 items is
                still here.
              </p>
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
            </div>
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
                <h2 id={`${cat.id}-h`}>{cat.name}</h2>
                <p className="cat__note">{cat.note}</p>
              </div>

              <ul className="cards grid">
                {cat.items.map((it) => (
                  <li key={it.id}>
                    <ItemCard item={it} cat={cat} locationId={location.id} guests={order.guests} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* ---- Sticky summary (desktop) ------------------------------------ */}
        <aside className="summary" aria-labelledby="sum-h">
          <div className="summary__inner card">
            <h2 id="sum-h" className="summary__h">
              Your order
            </h2>
            {order.lines.length === 0 ? (
              <p className="summary__empty">
                Nothing added yet. Prices below already include your headcount, so what
                you see is what you pay.
              </p>
            ) : (
              <>
                <ul className="summary__list">
                  {order.lines.map((l) => (
                    <li key={l.uid} className="summary__line">
                      <span className="summary__name">
                        {l.name}
                        <span className="summary__qty">
                          {l.unit === 'box'
                            ? `${l.qty} × box`
                            : `${order.guests} × ${money(l.price)}`}
                          {l.qty > 1 && l.unit !== 'box' ? ` × ${l.qty}` : ''}
                        </span>
                      </span>
                      <span className="summary__amt money">
                        {money(lineTotal(l, order.guests))}
                      </span>
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
                <p className="summary__total">
                  <span>Subtotal</span>
                  <span className="money">{money(totals.subtotal)}</span>
                </p>
                <p className="summary__tax">Tax and any delivery fee are added at checkout.</p>
                <Link to="/checkout" className="btn btn--primary btn--block">
                  Review and check out
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>

      <ActionBar
        count={totals.count}
        total={totals.subtotal}
        summary={location.name}
        detail={plural(order.guests, 'guest')}
        actionLabel={totals.count === 0 ? 'Add something' : 'Check out'}
        to={totals.count > 0 ? '/checkout' : undefined}
        onAction={() =>
          document.getElementById(MENU[0].id)?.scrollIntoView({ behavior: 'smooth' })
        }
      />
    </>
  );
}

function ItemCard({ item, cat, locationId, guests }) {
  const units = item.unit === 'box' ? 1 : guests;
  const total = item.price * units;

  return (
    <Link to={`/menu/${locationId}/item/${item.id}`} className="card2">
      <span className="card2__top">
        <span className="card2__name">{item.name}</span>
        <span className="card2__tags">
          {item.popular && <span className="pill pill--pop">Popular</span>}
          {item.vegetarian && <span className="pill pill--veg">Vegetarian</span>}
        </span>
      </span>

      <span className="card2__desc">{item.desc}</span>

      {item.rule && <span className="card2__rule">{item.rule}</span>}

      {item.dataFlag && (
        <span className="card2__flag">
          <strong>Check this price.</strong> {item.dataFlag}
        </span>
      )}

      <span className="card2__foot">
        <span className="card2__price money">
          <strong>{money(item.price)}</strong>
          <span className="card2__per">
            {item.unit === 'box' ? `per box · serves ${item.serves}` : 'per person'}
          </span>
        </span>
        <span className="card2__calc money">
          {item.unit === 'box' ? money(total) : `${money(item.price)} × ${guests} = ${money(total)}`}
        </span>
      </span>

      <span className="card2__cta" aria-hidden="true">
        {item.groups.length ? 'Choose options →' : 'Add to order →'}
      </span>
    </Link>
  );
}
