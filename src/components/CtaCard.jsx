/* A centred card that closes a page with one clear next step.

   Shared because the catering page already ended with this exact shape, and the
   home page now needs it too. One component, so the two cannot drift the way
   the store picker did.

   `tone="cream"` inverts it for use on a white band; the default sits on the
   page ground. */

export default function CtaCard({ id, headingId, title, body, actions, tone = 'surface' }) {
  return (
    <section
      className="shell section section--tight"
      id={id}
      aria-labelledby={headingId}
    >
      <div className={`closecta closecta--${tone}`}>
        <h2 id={headingId}>{title}</h2>
        <p>{body}</p>
        <div className="row closecta__row">{actions}</div>
      </div>
    </section>
  );
}
