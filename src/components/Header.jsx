import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SITE_NAV } from '../data/site.js';
import { useOrder } from '../state/OrderContext.jsx';
import { getLocation } from '../data/locations.js';
import logo from '/img/logo-tomato.webp';

/* Header + mobile drawer.

   The drawer is a dialog: it traps focus, closes on Escape and on backdrop
   click, restores focus to the trigger, and locks body scroll while open.
   A hamburger that merely reveals a div does none of that, and on iOS the page
   behind it scrolls while the menu sits still. */

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { order } = useOrder();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const location = order.locationId ? getLocation(order.locationId) : null;

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
    <header className="mast">
      <div className="shell mast__inner">
        <Link to="/" className="mast__brand" aria-label="Merci Market NYC catering — home">
          <img src={logo} alt="" width="132" height="34" />
          <span className="mast__sub">Catering</span>
        </Link>

        <nav className="mast__nav" aria-label="Main">
          <ul className="mast__list">
            {SITE_NAV.map((n) => (
              <li key={n.label}>
                {n.external ? (
                  <a href={n.href} className="mast__link">
                    {n.label}
                  </a>
                ) : (
                  <Link
                    to={n.to}
                    className="mast__link"
                    aria-current={pathname === n.to ? 'page' : undefined}
                  >
                    {n.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="mast__end">
          {location ? (
            <Link to={`/menu/${location.id}`} className="mast__store">
              <span className="mast__store-label">Ordering from</span>
              <span className="mast__store-name">{location.name}</span>
            </Link>
          ) : (
            <Link to="/" className="btn btn--ghost mast__cta">
              Order Pickup
            </Link>
          )}
          <Link to="/catering" className="btn btn--primary mast__cta">
            Start a Catering Order
          </Link>
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
            <ul className="drawer__list">
              {SITE_NAV.map((n) => (
                <li key={n.label}>
                  {n.external ? (
                    <a href={n.href} className="drawer__link">
                      {n.label}
                    </a>
                  ) : (
                    <Link to={n.to} className="drawer__link">
                      {n.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <Link to="/catering" className="btn btn--primary btn--block">
              Start a Catering Order
            </Link>
            {location && (
              <Link to={`/menu/${location.id}`} className="btn btn--ghost btn--block drawer__second">
                Back to the {location.name} menu
              </Link>
            )}
          </div>
        </>
      )}
    </header>
  );
}
