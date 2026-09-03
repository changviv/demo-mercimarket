/* The checkout accordion from artifact 42bdcee2.

   Four steps, one screen. An accordion rather than a wizard, because the whole
   form stays on screen as a list of what is still to answer, and any answered
   step reopens with Edit without throwing away the ones after it.

   Steps open in order. A step is reachable when it is the first one or when the
   step before it is done — the artifact's own rule, and the reason the Place
   order button cannot be reached before there is a date to place it against.
   The artifact makes an unreachable head a silent no-op; this marks it
   aria-disabled as well, so a screen reader is told what the pointer already
   knows. */

export default function StepAccordion({ children, ...rest }) {
  return (
    <div className="steps3" {...rest}>
      {children}
    </div>
  );
}

export function Step({ n, title, summary, open, done, reachable = true, onToggle, children }) {
  return (
    <section className={`step3${open ? ' step3--open' : ''}${done ? ' step3--done' : ''}`}>
      <h2 className="step3__h">
        <button
          type="button"
          className="st-head"
          aria-expanded={open}
          aria-disabled={reachable ? undefined : 'true'}
          onClick={() => reachable && onToggle()}
        >
          <span className="st-n" aria-hidden="true">
            {n}
          </span>
          <span className="st-t">
            <strong>{title}</strong>
            <span className="st-sum">{summary}</span>
          </span>
          <span className="st-edit">Edit</span>
        </button>
      </h2>
      {open && <div className="st-body">{children}</div>}
    </section>
  );
}
