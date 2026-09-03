/* Form fields, to the checkout artifact's metrics (42bdcee2): a 13px bold
   label, a 6px gap, a 48px sunken control with a 1.5px hairline that goes
   tomato on focus, and a hint or an error underneath — never both, because the
   hint is what you needed before you got it wrong and the error is what you
   need after.

   Rendered as a <div>, not a <p>. base.css caps every paragraph at 68ch so
   running text keeps a readable measure; a field is a control, and that rule
   has twice squashed a row it leaked into. */

export function Field({
  label,
  id,
  value,
  onChange,
  error,
  optional,
  hint,
  type = 'text',
  ...rest
}) {
  const described = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`field${error ? ' field--bad' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {optional && <span className="field__hint field__opt"> optional</span>}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={described}
        {...rest}
      />
      {hint && !error && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  );
}

export function SelectField({ label, id, value, onChange, error, hint, children }) {
  const described = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`field${error ? ' field--bad' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={described}
      >
        {children}
      </select>
      {hint && !error && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  );
}

export default Field;
