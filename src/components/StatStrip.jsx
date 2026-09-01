/* The four-figure strip.

   One component, two grounds: the home page runs it on white, the catering page
   on cream. Both draw their dividers the same way — a 1px grid gap over the
   rule colour, so the hairlines are the gap itself rather than six borders that
   have to be cancelled at the edges.

   `tone` is the only difference between the two, which is exactly why they
   should not have been two blocks of markup. */

export default function StatStrip({ stats, tone = 'surface', label }) {
  return (
    <section className={`facts facts--${tone}`} aria-label={label}>
      <div className="shell">
        <ul className="facts__grid">
          {stats.map((s) => (
            <li key={s.n} className="fact">
              <b>{s.n}</b>
              <span>{s.t}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
