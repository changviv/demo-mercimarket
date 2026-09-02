/* The mobile navigation bar.

   DECISION — why this and not a five-icon tab bar.

   A tab bar is the right pattern when a product has several parallel
   destinations a person moves between freely: Home / Search / Saved / Profile.
   Catering is not that shape. It is one funnel, entered once, traversed in
   order, and abandoned if it stalls: pick a kitchen, build a platter order,
   check out. There is nothing to tab between — and the one thing a person does
   need at every step is the state of the order and the way forward.

   A tab bar would also fight the primary CTA. Both want the thumb zone. On a
   390x844 screen a 56px tab bar plus a 74px action bar plus the sticky header
   spends 198px — roughly a quarter of the viewport — on chrome, before any food
   appears. So: no tab bar. Site navigation lives in the header drawer, where
   it is one tap away and costs nothing when unused.

   What ships instead is this: one fixed bar, always the single most useful
   action for where the person is, always carrying the running order state so
   they never wonder what they have. It hands over to the sticky order summary
   beside the menu as soon as that column exists — `variant="menu"` keeps it
   alive until 1240px rather than 900px, because between those two widths the
   summary is not on the page yet and the total would otherwise be nowhere. */

import { Link } from 'react-router-dom';
import { money } from '../lib/format.js';

export default function ActionBar({
  summary,
  detail,
  actionLabel,
  to,
  onAction,
  disabled = false,
  total,
  count,
  variant,
}) {
  const label = actionLabel || 'Continue';

  const inner = (
    <>
      <span className="abar__text">
        <span className="abar__summary">{summary}</span>
        {detail && <span className="abar__detail">{detail}</span>}
      </span>
      <span className="abar__cta">{label}</span>
    </>
  );

  return (
    <div
      className={`abar${variant ? ` abar--${variant}` : ''}`}
      role="region"
      aria-label="Order actions"
    >
      {typeof count === 'number' && (
        <p className="abar__running">
          <span>
            {count === 0
              ? 'Nothing added yet'
              : `${count} ${count === 1 ? 'item' : 'items'} on this order`}
          </span>
          {typeof total === 'number' && total > 0 && (
            <span className="abar__total money">{money(total)}</span>
          )}
        </p>
      )}

      {to && !disabled ? (
        <Link className="abar__btn" to={to}>
          {inner}
        </Link>
      ) : (
        <button type="button" className="abar__btn" onClick={onAction} disabled={disabled}>
          {inner}
        </button>
      )}
    </div>
  );
}
