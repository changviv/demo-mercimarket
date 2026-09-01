/* A −/+ number control.

   Extracted because this existed five times: the guest count on the menu, the
   quantity and the vegetarian-sandwich count in the item sheet, and the guest
   count and per-line quantities on order management. Five copies is five places
   for the floor, the ceiling, the disabled state or the label to drift apart.

   The input is a real <input type="number">, so it takes a typed value, a
   pasted one, and the keyboard's own up/down — the buttons are an addition, not
   the only way in. */

export default function Stepper({
  value,
  onChange,
  min = 1,
  max = 500,
  label,
  id,
  size,
  decLabel,
  incLabel,
}) {
  const clamp = (n) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));

  return (
    <div className={`guests__control${size === 'sm' ? ' guests__control--sm' : ''}`}>
      <button
        type="button"
        className="guests__step"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={decLabel || `Fewer ${label}`}
      >
        −
      </button>
      <input
        id={id}
        className="guests__input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        aria-label={id ? undefined : label}
      />
      <button
        type="button"
        className="guests__step"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={incLabel || `More ${label}`}
      >
        +
      </button>
    </div>
  );
}
