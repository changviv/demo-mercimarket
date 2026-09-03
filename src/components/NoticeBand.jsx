/* A tinted band: an icon, one line that makes a claim, and the sentence that
   backs it up.

   The checkout artifact (42bdcee2) draws two of these — the basil band that
   locks the order to one kitchen, and the honey band that explains what a card
   hold is — with the same anatomy and different tints. So it is one component
   with a tone rather than two boxes that drift apart.

   ONE DEPARTURE, recorded in audit-artifact.mjs: the artifact gives the two
   bands slightly different metrics (16px radius / 15×18 padding / 13px gap for
   the lock, 12 / 14×16 / 12 for the hold, and a half-pixel of type size
   between their bodies). Both render at the lock's values here. Two boxes in
   one flow that differ by two pixels read as a mistake, not as a decision. */

export default function NoticeBand({ tone = 'go', icon, title, children, className = '' }) {
  return (
    <div className={`band band--${tone}${className ? ` ${className}` : ''}`}>
      {icon && (
        <span className="band__i" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="band__t">
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </div>
  );
}
