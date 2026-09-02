import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { MENU, findItem } from "../data/menu.js";
import { getLocation } from "../data/locations.js";
import {
  useOrder,
  useSyncLocation,
  lineTotal,
  underMinimum,
  hasSelections,
} from "../state/OrderContext.jsx";
import { money, plural } from "../lib/format.js";
import { MINIMUM_GUESTS } from "../data/site.js";
import ItemSheet from "../components/ItemSheet.jsx";
import ActionBar from "../components/ActionBar.jsx";
import Stepper from "../components/Stepper.jsx";
import EmptyState from "../components/EmptyState.jsx";
import CategoryRail from "../components/CategoryRail.jsx";
import FilterChips from "../components/FilterChips.jsx";
import QtyControl from "../components/QtyControl.jsx";
import ControlCapsule, { SearchIcon } from "../components/ControlCapsule.jsx";
import { ItemBadges } from "../components/Badge.jsx";

/* Prototype section 3 — "76 items, guest-count pricing", built to the approved
   menu artifact (06cbed02).

   The headcount is a control, not a sentence. Set it once and every one of the
   76 prices restates as "$90.00 for 12", so nobody multiplies in their head or
   discovers the real number at checkout.

   Three things the artifact specifies that the earlier build got wrong:

   1 ONE bar, not two. The build carried a store bar AND a control bar under a
     masthead that already named the store — three rows of chrome and the store
     name printed twice. The artifact puts the store in the masthead (see
     Header's ordering mode) and gives this route a single sticky control bar.

   2 Add is an OUTLINE button that becomes a −/n/+ in place. The build made it
     a solid primary, which is the loudest thing on screen repeated 76 times,
     and routed every add through the option sheet even for an item with no
     options to choose. Items that genuinely carry option groups still open the
     sheet — that is section 4's job and the artifact has no answer for it —
     but a bowl of oatmeal now adds in one tap.

   3 The minimum is enforced, not mentioned. Under eight guests, a platter's
     Add reads "Needs 8+" and is disabled, anything already on the order is
     flagged in the summary, and checkout is blocked. The build printed a
     paragraph and let you carry on.

   Filters are the three the artifact names — Most popular, Vegetarian,
   Individually packed — which map to flags that actually exist in the data,
   rather than invented facets. */

const FILTERS = [
  { id: "popular", label: "Most popular" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "individual", label: "Individually packed" },
];

const TOTAL_ITEMS = MENU.reduce((n, c) => n + c.items.length, 0);

export default function Menu() {
  const { locationId } = useParams();
  const location = getLocation(locationId);
  const { order, dispatch, totals } = useOrder();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState([]);
  const [active, setActive] = useState(MENU[0].id);
  const [sheetId, setSheetId] = useState(null);
  const sectionRefs = useRef({});

  useSyncLocation(location?.id);

  const toggleFilter = (id) =>
    setFilters((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id],
    );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MENU.map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => {
        if (q && !`${it.name} ${it.desc} ${cat.name}`.toLowerCase().includes(q))
          return false;
        if (filters.includes("popular") && !it.popular) return false;
        if (filters.includes("vegetarian") && !it.vegetarian) return false;
        if (filters.includes("individual") && !cat.indiv) return false;
        return true;
      }),
    })).filter((cat) => cat.items.length > 0);
  }, [query, filters]);

  /* The rail lists all eight categories at all times and its counts track the
     FILTERED list, so a category a filter has emptied reads 0 rather than
     disappearing. That is the artifact's behaviour and the better one: a rail
     that loses rows as you type makes the remaining rows jump under the
     pointer, and it hides the fact that a filter emptied a section instead of
     saying so. */
  const counts = useMemo(() => {
    const byId = Object.fromEntries(shown.map((c) => [c.id, c.items.length]));
    return Object.fromEntries(MENU.map((c) => [c.id, byId[c.id] || 0]));
  }, [shown]);

  /* Scroll-spy. Deliberately a scroll listener rather than an
     IntersectionObserver: an observer only reports sections that CHANGED
     state, so a jump — an anchor click, or scrolling straight back to the top —
     can fire with nothing intersecting and leave the rail stuck on whatever it
     last saw. Recomputing from positions is jump-proof. */
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      /* Must sit at or below where an anchor jump parks a section — its
         scroll-margin-top, 160px — or the section you just jumped to reads as
         "not reached yet" and the rail highlights the one above it.

         The +2 is not padding for its own sake: a jump lands the section top at
         exactly 160, and getBoundingClientRect returns a float, so 160.0000001
         failed a `<= 160` test and left the rail one category behind on every
         jump to the last section. */
      const line = 162;
      let current = shown[0]?.id || MENU[0].id;
      for (const cat of shown) {
        const el = sectionRefs.current[cat.id];
        if (el && el.getBoundingClientRect().top <= line) current = cat.id;
      }
      if (
        window.innerHeight + window.scrollY >=
        document.body.scrollHeight - 2
      ) {
        const last = [...shown]
          .reverse()
          .find((c) => sectionRefs.current[c.id]);
        if (last) current = last.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shown]);

  /* An occasion card on the catering page jumps into the category that serves
     it, rather than dropping people at the top of a 76-item list. */
  useEffect(() => {
    const cat = sessionStorage.getItem("mm.jumpCat");
    if (!cat) return;
    sessionStorage.removeItem("mm.jumpCat");
    const el = document.getElementById(cat);
    if (el)
      setTimeout(
        () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
        80,
      );
  }, []);

  const resultCount = shown.reduce((n, c) => n + c.items.length, 0);
  const filtering = Boolean(query.trim()) || filters.length > 0;
  const sheetItem = sheetId ? findItem(sheetId) : null;

  /* Quantity already on the order for a card, counting only unconfigured
     lines — the card's −/n/+ owns those and nothing else. */
  const plainQty = (itemId) =>
    order.lines
      .filter((l) => l.itemId === itemId && !hasSelections(l))
      .reduce((n, l) => n + l.qty, 0);

  const clearAll = () => {
    setQuery("");
    setFilters([]);
  };

  if (!location) return <Navigate to="/" replace />;

  return (
    <>
      {/* ---- Control bar ----------------------------------------------------
          Sticky beneath the masthead: search, headcount, filters and the count
          stay reachable through 10,000px of menu. */}
      {/* The artifact has no h1 on this screen — it is a fragment of a page, so
          nothing named the document. Every route needs exactly one, and this
          one is the Bryant Park catering menu. Clipped rather than drawn: the
          masthead already says the store name in the design, and adding a
          second visible title would change a layout that is otherwise exact. */}
      <h1 className="visually-hidden">Catering menu — {location.name}</h1>

      <div className="controls">
        <div className="shell controls__in">
          <ControlCapsule>
            <SearchIcon />
            <label className="visually-hidden" htmlFor="q">
              Search the catering menu
            </label>
            <input
              id="q"
              type="search"
              placeholder={`Search ${TOTAL_ITEMS} items`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </ControlCapsule>

          <ControlCapsule className="ctl--guests">
            <label htmlFor="guests">Guests</label>
            <Stepper
              id="guests"
              value={order.guests}
              min={MINIMUM_GUESTS}
              max={500}
              size="sm"
              onChange={(g) => dispatch({ type: "setGuests", guests: g })}
              decLabel="One fewer guest"
              incLabel="One more guest"
            />
          </ControlCapsule>

          <FilterChips
            options={FILTERS}
            value={filters}
            onToggle={toggleFilter}
            label="Filter the menu"
          />

          <p className="result-count" role="status" aria-live="polite">
            {filtering
              ? `${resultCount} of ${TOTAL_ITEMS} items`
              : `${TOTAL_ITEMS} items`}
            {filtering && (
              <button
                type="button"
                className="btn btn--quiet"
                onClick={clearAll}
              >
                Clear
              </button>
            )}
          </p>
        </div>
      </div>

      <div className="shell layout">
        <CategoryRail categories={MENU} active={active} counts={counts} />

        <div className="menu">
          <CategoryRail
            categories={MENU}
            active={active}
            counts={counts}
            variant="mobile"
          />

          {resultCount === 0 && (
            <EmptyState
              heading="h2"
              title="Nothing matches that"
              action={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={clearAll}
                >
                  Show the whole menu
                </button>
              }
            >
              <p>
                Try a shorter word, or clear the filters. Every one of the{" "}
                {TOTAL_ITEMS} items is still here.
              </p>
            </EmptyState>
          )}

          {shown.map((cat) => (
            <section
              key={cat.id}
              id={cat.id}
              className="cat"
              ref={(el) => {
                sectionRefs.current[cat.id] = el;
              }}
              aria-labelledby={`${cat.id}-h`}
            >
              <div className="cat__head">
                <h2 id={`${cat.id}-h`}>{cat.name}</h2>
                <span className="cat__note">{cat.note}</span>
              </div>

              <ul className="items">
                {cat.items.map((it) => (
                  <li key={it.id}>
                    <ItemCard
                      item={it}
                      cat={cat}
                      guests={order.guests}
                      qty={plainQty(it.id)}
                      onOpen={() => setSheetId(it.id)}
                      onBump={(by) =>
                        dispatch({
                          type: "bumpItem",
                          by,
                          item: {
                            itemId: it.id,
                            name: it.name,
                            price: it.price,
                            unit: it.unit,
                            serves: it.serves,
                            min: cat.min,
                            selections: {},
                          },
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* ---- Your order --------------------------------------------------- */}
        <aside className="summary" aria-labelledby="sum-h">
          <h2 id="sum-h" className="summary__h">
            Your order
          </h2>
          <div className="sum-card">
            <div className="sum-head">
              <b>Catering order</b>
            </div>
            <p className="sum-guests">For {plural(order.guests, "guest")}</p>

            {/* Rendered even when empty, as the artifact does: its 14px
                  bottom margin is part of the card's resting height, and
                  dropping the element made the card 14px shorter than the
                  design. */}
            <ul className="lines">
              {order.lines.map((l) => {
                const low = underMinimum(l, order.guests);
                return (
                  <li key={l.uid} className={low ? "low" : undefined}>
                    <span className="ln">
                      <b>{l.name}</b>
                      <span>
                        {l.unit === "box"
                          ? `${plural(l.qty, "box", "boxes")} · serves ${l.serves * l.qty}`
                          : `${plural(order.guests, "guest")}${l.qty > 1 ? ` × ${l.qty}` : ""}`}
                        {Object.values(l.selections || {}).flat().length
                          ? ` · ${Object.values(l.selections).flat().join(", ")}`
                          : ""}
                        {low ? ` · needs ${l.min}+` : ""}
                      </span>
                    </span>
                    <span className="amt money">
                      {money(lineTotal(l, order.guests))}
                    </span>
                    <button
                      type="button"
                      className="rm"
                      aria-label={`Remove ${l.name}`}
                      onClick={() =>
                        dispatch({ type: "removeLine", uid: l.uid })
                      }
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>

            {order.lines.length === 0 && (
              <p className="sum-empty">
                Nothing added yet. Set your guest count first — every price
                below recalculates to a real total.
              </p>
            )}

            {totals.blocked && (
              <p className="sum-warn" role="alert">
                {totals.under === 1
                  ? "1 item needs"
                  : `${totals.under} items need`}{" "}
                at least {totals.needs} guests. Raise the guest count or remove{" "}
                {totals.under === 1 ? "it" : "them"} to continue.
              </p>
            )}

            <div className="sum-total">
              <span>Estimated subtotal</span>
              <b className="money">{money(totals.subtotal)}</b>
            </div>

            <Link
              to="/checkout"
              className={`btn btn--primary btn--block${
                totals.count === 0 || totals.blocked ? " btn--off" : ""
              }`}
              aria-disabled={totals.count === 0 || totals.blocked}
              onClick={(e) => {
                if (totals.count === 0 || totals.blocked) e.preventDefault();
              }}
            >
              Continue to delivery
            </Link>

            <p className="pending">
              Lead time, delivery radius and fee are still to be confirmed —
              they belong here, above the button.
            </p>
          </div>
        </aside>
      </div>

      {sheetItem && (
        <ItemSheet
          key={sheetItem.id}
          item={sheetItem}
          guests={order.guests}
          onClose={() => setSheetId(null)}
          onAdd={(line) => {
            dispatch({ type: "addLine", line });
            setSheetId(null);
          }}
        />
      )}

      <ActionBar
        variant="menu"
        count={totals.count}
        total={totals.subtotal}
        summary={location.name}
        detail={plural(order.guests, "guest")}
        actionLabel={
          totals.count === 0 ? "Add something" : "Continue to delivery"
        }
        to={totals.count > 0 && !totals.blocked ? "/checkout" : undefined}
        onAction={() =>
          document
            .getElementById(MENU[0].id)
            ?.scrollIntoView({ behavior: "smooth" })
        }
      />
    </>
  );
}

/* One menu card.

   Child order is the artifact's: badges, name, description, the choose-rule,
   the data flag, then the price row pushed to the bottom with margin-top:auto
   so every card in a row lines its price up regardless of description length. */
function ItemCard({ item, cat, guests, qty, onOpen, onBump }) {
  const units = item.unit === "box" ? 1 : guests;
  const total = item.price * units;
  const blocked = item.unit !== "box" && guests < (cat.min || 1);
  const configurable = (item.groups || []).length > 0;

  return (
    <article className={`item${qty > 0 ? " item--in" : ""}`}>
      <ItemBadges item={item} indiv={cat.indiv} />

      <h3>{item.name}</h3>
      <p className="desc">{item.desc}</p>
      {item.rule && <p className="choose">{item.rule}</p>}
      {item.dataFlag && <p className="flag">{item.dataFlag}</p>}

      <div className="price">
        <span className="unit money">
          <b>{money(item.price)}</b>
          <em>
            {item.unit === "box"
              ? `per box · serves ${item.serves}`
              : "per person"}
          </em>
          {/* The whole point of the headcount control: the per-head price is
              what the kitchen quotes, this is what you actually pay. Hidden
              when the order cannot legally be placed at this size, because a
              total for eight people you are not ordering for is a lie. */}
          {!blocked && item.unit !== "box" && (
            <span className="line">
              {money(total)} for {guests}
            </span>
          )}
        </span>

        <span className="act">
          {blocked ? (
            <button type="button" className="add" disabled>
              Needs {cat.min}+
            </button>
          ) : qty > 0 ? (
            <QtyControl
              qty={qty}
              name={item.name}
              onInc={() => (configurable ? onOpen() : onBump(1))}
              onDec={() => onBump(-1)}
            />
          ) : (
            /* aria-label, not visually-hidden text: the button must READ
               "Add" like the artifact's, while still announcing which item it
               adds — seventy-six buttons all called "Add" is what a screen
               reader would otherwise get. */
            <button
              type="button"
              className="add"
              aria-label={`Add ${item.name}`}
              onClick={() => (configurable ? onOpen() : onBump(1))}
            >
              Add
            </button>
          )}
        </span>
      </div>
    </article>
  );
}
