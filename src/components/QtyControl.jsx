/* The inline quantity control that replaces "Add" once an item is in the
   basket — round outline buttons either side of the count, per the menu
   artifact.

   Distinct from Stepper on purpose. Stepper is a NUMBER FIELD: it has a typed
   input, a floor and a ceiling, and it is how you say "42 guests". This is a
   two-button affordance whose decrement at 1 REMOVES the line rather than
   clamping — pressing minus on a quantity of one means "I don't want this",
   and a control that just refuses is how an item you cannot delete ends up in
   someone's order. Same shape, different contract. */

export default function QtyControl({ qty, onInc, onDec, name }) {
  return (
    <span className="qty">
      <button type="button" onClick={onDec} aria-label={`Remove one ${name}`}>
        −
      </button>
      <span className="qty__n" aria-live="polite">
        {qty}
      </span>
      <button type="button" onClick={onInc} aria-label={`Add one ${name}`}>
        +
      </button>
    </span>
  );
}
