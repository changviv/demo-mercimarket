/* A section's heading and its one-line intro, on a constrained measure.

   The artifact holds every section heading to ~60ch and pairs it with a single
   sub-paragraph. Doing that inline meant the measure was set in six places and
   already differed in two of them. */

export default function SectionHead({ id, title, children }) {
  return (
    <div className="shead">
      <h2 id={id}>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}
