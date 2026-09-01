import { useLocation, useNavigate } from 'react-router-dom';

/* An in-app anchor.

   The masthead used to link out to mercimarketnyc.com, which threw people out
   of a half-finished order. Now every nav item names a section inside this app:

   - already on that route  -> smooth-scroll to the section
   - on a different route   -> navigate, then scroll once the section exists

   The href is still a real URL, so middle-click, cmd-click and "copy link
   address" all behave, and the link is announced correctly by a screen reader.
   Only the plain left-click is intercepted. */

export default function NavAnchor({ to, hash, className, children, onNavigate, ...rest }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const href = hash ? `${to}#${hash}` : to;

  function scrollTo(id) {
    if (!id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Move the reading position too, not just the viewport.
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    return true;
  }

  function onClick(e) {
    // Let the browser handle the intents that mean "open this somewhere else".
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    onNavigate?.();

    if (pathname === to) {
      scrollTo(hash);
      return;
    }

    navigate(to);
    // The target only exists after the new route paints. Two frames is enough
    // for React to commit; the retry covers a slow first render.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!scrollTo(hash)) setTimeout(() => scrollTo(hash), 220);
      })
    );
  }

  return (
    <a href={href} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
