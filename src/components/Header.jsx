import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SITE_NAV } from '../data/site.js';
import { useOrder } from '../state/OrderContext.jsx';
import { getLocation } from '../data/locations.js';
import NavAnchor from './NavAnchor.jsx';
import StoreMenu from './StoreMenu.jsx';
import { Shield } from './Icons.jsx';
import logo from '/img/logo-tomato.webp';

/* Masthead, in two modes.

   MARKETING — the approved hero artifact (37aef8e5): 78px tall, 42px logo,
   nav, then Order Pickup (outline) + Start a Catering Order (solid) pushed
   right. Used on / and /catering.

   Two things that artifact does that the earlier build did not:
   - the logo stands alone. No "Catering" label beside it; the wordmark is the
     brand and a second word next to it reads as a different company.
   - nav items are in-app anchors (see NavAnchor) rather than links off to
     mercimarketnyc.com.

   ORDERING — every artifact in the ordering flow (menu 06cbed02, item
   84ab8175, checkout 42bdcee2, order 8c40fafa) drops the nav and the CTAs and
   carries the ORDER'S context instead: logo, then who and where, then one
   escape hatch. The menu artifact is the one that specifies it fully — the
   store's name and address with "Change store" beneath, and a single Locations
   button.

   ONE DEPARTURE FROM THAT ARTIFACT, recorded in audit-artifact.mjs: the
   Locations button is gone. It and "Change store" both ended at the same
   six-store picker on the home page, so the masthead asked the same question
   twice and answered it by throwing you out of the order. "Change store" is now
   a menu (see StoreMenu) that switches store in place, which leaves the button
   with nothing to do that the menu does not do better.

   That is not a stylistic difference. Once someone is inside an order, the
   masthead's job stops being "here is the rest of the site" and becomes "here
   is which kitchen you are ordering from", because every price and lead time on
   the page below depends on that answer. Selling the site to someone already
   buying is how a funnel leaks. It also removes a whole row of chrome: the
   build previously repeated the store name, Change store and Locations in a
   second bar under a masthead that was already 79px tall.

   The drawer is a real dialog: focus trapped, Escape closes, focus restored to
   the trigger, body scroll locked. A hamburger that only reveals a div does
   none of that, and on iOS the page behind it scrolls while the menu sits
   still. */

const ORDERING = /^\/(menu|checkout|orders)\b/;
const PAYING = /^\/checkout\b/;

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { order } = useOrder();
  const navigate = useNavigate();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const location = order.locationId ? getLocation(order.locationId) : null;
  const ordering = ORDERING.test(pathname);
  const paying = PAYING.test(pathname);

  /* The URL owns the store — useSyncLocation dispatches setLocation when
     :locationId changes, and setLocation is what clears the basket. So choosing
     a store is a navigation, not a dispatch; doing both would clear twice.

     dryRun answers "what would this cost me?" without doing it, so StoreMenu
     can ask before it is too late. Zero means switch silently. */
  const chooseStore = (loc, { dryRun } = {}) => {
    if (loc.id === order.locationId) return 0;
    if (dryRun) return order.lines.length;
    navigate(`/menu/${loc.id}`);
    return 0;
  };

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = panelRef.current.querySelectorAll(
        'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
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

    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector('a, button')?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className={`mast${ordering ? ' mast--order' : ''}`}>
      <div className="shell mast__inner">
        <Link to="/" className="mast__brand" aria-label="Merci Market NYC — home">
          <img src={logo} alt="Merci Market NYC" width="163" height="42" />
        </Link>

        {ordering ? (
          location && (
            <div className="mast__store">
              <b className="mast__store-name">
                {location.name} · {location.addr}
              </b>
              <StoreMenu current={location} onChoose={chooseStore} />
            </div>
          )
        ) : (
          <nav className="mast__nav" aria-label="Main">
            <ul className="mast__list">
              {SITE_NAV.map((n) => (
                <li key={n.label}>
                  <NavAnchor to={n.to} hash={n.hash} className="mast__link">
                    {n.label}
                  </NavAnchor>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="mast__end">
          {/* The checkout artifact (42bdcee2) puts one reassurance in the
              masthead and nothing else: whose payment rails these are. It is
              the only page where that question is being asked, so it is the
              only page that answers it. Below 900px the masthead is a wordmark
              and a burger with no room for a sentence, and the same claim is
              made in full inside the payment step. */}
          {paying && (
            <span className="mast__secure">
              <Shield />
              Payments secured by Stripe
            </span>
          )}
          {!ordering && (
            <>
              <NavAnchor to="/" hash="pick" className="btn btn--ghost mast__cta mast__cta--out">
                Order Pickup
              </NavAnchor>
              <Link to="/catering" className="btn btn--primary mast__cta">
                Start a Catering Order
              </Link>
            </>
          )}
          <button
            type="button"
            ref={triggerRef}
            className="mast__burger"
            aria-expanded={open}
            aria-controls="site-drawer"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" className={`burger${open ? ' burger--x' : ''}`}>
              <i />
              <i />
              <i />
            </span>
            <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="drawer__scrim" onClick={() => setOpen(false)} />
          <div
            id="site-drawer"
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            ref={panelRef}
          >
            {/* The phone masthead has room for a wordmark and a burger, so the
                store block — and with it the store menu — is not on screen.
                The drawer is where that control lives instead, open rather than
                behind a second tap, since the drawer IS the tap. */}
            {ordering && location && (
              <div className="drawer__store">
                <p className="drawer__storehead">
                  Ordering from <b>{location.name}</b>
                </p>
                <StoreMenu
                  current={location}
                  onChoose={chooseStore}
                  inline
                  onDone={() => setOpen(false)}
                />
              </div>
            )}

            <ul className="drawer__list">
              {SITE_NAV.map((n) => (
                <li key={n.label}>
                  <NavAnchor
                    to={n.to}
                    hash={n.hash}
                    className="drawer__link"
                    onNavigate={() => setOpen(false)}
                  >
                    {n.label}
                  </NavAnchor>
                </li>
              ))}
            </ul>
            <Link to="/catering" className="btn btn--primary btn--block">
              Start a Catering Order
            </Link>
            {location && (
              <Link
                to={`/menu/${location.id}`}
                className="btn btn--ghost btn--block drawer__second"
              >
                Back to the {location.name} menu
              </Link>
            )}
          </div>
        </>
      )}
    </header>
  );
}
