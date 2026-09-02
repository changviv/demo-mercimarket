/* The category navigator, in its two forms.

   Desktop: a sticky column of links, each with a live count of what the
   current filters leave in it.

   Mobile: the same links as a horizontally scrolling chip row at the top of
   the list — LABELLED, with counts. The artifact's design note is explicit
   that the live site's mobile jump control collapses to an unlabelled beige
   bar, and that this is the fix. The previous build had no mobile form at all;
   it reused the desktop rail as a sticky scroller and dropped the counts.

   Both are the same data and the same active state, so the two cannot drift. */

export default function CategoryRail({
  categories,
  active,
  counts,
  variant = "rail",
}) {
  const mobile = variant === "mobile";

  const links = categories.map((cat) => {
    const n = counts ? counts[cat.id] : cat.items.length;
    const on = active === cat.id;
    return (
      <li key={cat.id}>
        <a
          href={`#${cat.id}`}
          className={
            mobile
              ? `railmob__link${on ? " railmob__link--on" : ""}`
              : `rail__link${on ? " rail__link--on" : ""}`
          }
          aria-current={on ? "true" : undefined}
        >
          {/* The space is the artifact's, and it is load-bearing: with a 10px
              flex gap and a 159px content box, "Individual Breakfast " plus the
              count wraps to two lines in the rail. Without it the label stays
              on one line and every rail entry below sits at a different height
              from the design. */}
          {`${cat.name} `}
          <i className={mobile ? "railmob__count" : "rail__count"}>{n}</i>
        </a>
      </li>
    );
  });

  if (mobile) {
    return (
      <nav className="railmob" aria-label="Menu categories">
        <ul className="railmob__list">{links}</ul>
      </nav>
    );
  }

  return (
    <nav className="rail" aria-labelledby="rail-head">
      <h2 className="rail__head" id="rail-head">
        Categories
      </h2>
      <ul className="rail__list">{links}</ul>
    </nav>
  );
}
