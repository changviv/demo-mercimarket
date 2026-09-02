/* A toggle-chip row.

   `aria-pressed` rather than a checkbox group because these are not a form —
   nothing is submitted, the list below changes as you press. A pressed chip
   that only differs by colour is invisible to a screen reader; this one
   announces its state. */

export default function FilterChips({ options, value, onToggle, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip${value.includes(o.id) ? ' chip--on' : ''}`}
          aria-pressed={value.includes(o.id)}
          onClick={() => onToggle(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
