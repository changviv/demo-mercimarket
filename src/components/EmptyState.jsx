/* The "there is nothing here" card, with a way out.

   Four screens need one: an empty basket, a filtered menu with no matches, an
   order that could not load, and the 404. Each had its own markup. */

export default function EmptyState({ eyebrow, title, children, action, heading = 'h1' }) {
  const H = heading;
  return (
    <div className="empty card card--pad">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <H>{title}</H>
      {children}
      {action}
    </div>
  );
}
