/* The badge set, in one place.

   Three tones exist in the menu artifact and each one means something
   different, which is the reason to name them rather than pass colours:
     pop   honey   — a claim about popularity
     veg   basil   — a dietary fact
     min   sunken  — a packaging/minimum constraint

   They had been written inline on the item card, the category head and the
   item sheet, which is how the honey one ended up at three different radii. */

export default function Badge({ tone = 'min', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

/* The badges an item carries, derived once so the card, the sheet and the
   summary cannot disagree about what an item is. `indiv` is a property of the
   CATEGORY, not the item — individually packed is how a section is served. */
export function ItemBadges({ item, indiv }) {
  if (!item.popular && !item.vegetarian && !indiv) return null;
  return (
    <div className="badges">
      {item.popular && <Badge tone="pop">Most popular</Badge>}
      {item.vegetarian && <Badge tone="veg">Vegetarian</Badge>}
      {indiv && <Badge tone="min">Individually packed</Badge>}
    </div>
  );
}
