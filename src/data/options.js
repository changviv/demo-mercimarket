/* Modifier pools, transcribed from the live configurator.

   The live site renders EVERY group as checkboxes, including groups whose own
   description says "choose 1", and it enforces no maximum. Here the pool is
   just the list of choices; the rule lives on the item's group
   (`type: 'one' | 'upto'`, `max`, `req`) so the UI can actually enforce it.

   In production these come from Toast modifier groups, where the same rules are
   expressed as minSelection / maxSelection / isDefault / allowsDuplicates.
   server/lib/toast.js maps Toast's fields onto this shape. */

export const OPTION_POOLS = {
  BEV: [
    'Regular Coffee',
    'Decaf Coffee',
    'French Vanilla Coffee',
    'Herbal Tea',
    'Tropicana OJ',
  ],
  CC: ['Plain', 'Vegetable', 'Scallion', 'Lox'],
  COFFEE: ['Regular Coffee', 'Decaf Coffee', 'French Vanilla Coffee'],
  FILL: [
    'Bacon',
    'Turkey Bacon',
    'Sausage',
    'Turkey Sausage',
    'Beef Sausage',
    'Ham',
    'Turkey',
    'American Cheese',
    'Swiss Cheese',
    'Cheddar Cheese',
    'Provolone Cheese',
  ],
  SIDES: [
    'Garden Salad',
    'Caesar Salad',
    'Greek Salad',
    'Penne Pesto',
    'Cheese Tortellini',
    'Roasted Corn Salad',
    'Tuna Shell Pasta Salad',
    'Potato Salad',
    'Tomato & Avocado Salad',
    'Fruit Salad',
    'Coleslaw',
    'Cookie & Brownie Tray',
  ],
  WRAPS: [
    'Egg White Delight',
    'Turkey BLT',
    'Turkey BLT w/ Egg White',
    'Pastrami Hash',
    'Pastrami Hash w/ Egg White',
    'Athens',
    'Athens w/ Egg White',
  ],
};

/* Groups where the live site states no limit and the client still owes an
   answer. `max: 0` means unlimited; the UI shows this note rather than
   inventing a number. */
export const GROUP_NOTES = {
  wrap: 'The live site sets no limit here — confirm how many varieties come on one platter.',
};

/** Human-readable rule for a group, e.g. "Choose 1" / "Choose up to 3". */
export function ruleLabel(group) {
  if (group.type === 'one') return 'Choose 1';
  if (group.max > 0) return `Choose up to ${group.max}`;
  return 'Choose any';
}

/** Is a group's current selection valid? */
export function groupSatisfied(group, selected) {
  const n = selected?.length || 0;
  if (group.type === 'one') return n === 1;
  if (!group.req) return true;
  if (n < 1) return false;
  if (group.max > 0 && n > group.max) return false;
  return true;
}
