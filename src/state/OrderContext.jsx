import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { MINIMUM_GUESTS } from '../data/site.js';

/* One order in progress: which kitchen, how many people, what is on it.

   Persisted to sessionStorage so a reload mid-flow does not lose the basket.
   sessionStorage rather than localStorage on purpose — a catering basket is a
   task in progress, not a saved preference, and a stale basket from last week
   surfacing on a shared office machine is a support ticket. */

const KEY = 'mm.order.v1';

const empty = {
  locationId: null,
  guests: MINIMUM_GUESTS,
  lines: [], // { uid, itemId, name, price, qty, selections: {groupId: [opt]}, unit, serves }
  fulfillment: 'pickup', // 'pickup' | 'delivery'
  date: '',
  time: '',
  contact: { name: '', company: '', email: '', phone: '' },
  address: { line1: '', line2: '', zip: '' },
  notes: '',
};

function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return { ...empty, ...parsed, contact: { ...empty.contact, ...parsed.contact } };
  } catch {
    return empty;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'setLocation':
      // Changing kitchen invalidates the basket: prices and stock are per-store.
      return state.locationId === action.id
        ? state
        : { ...state, locationId: action.id, lines: [] };

    case 'setGuests':
      return { ...state, guests: Math.max(1, Math.min(500, action.guests || 1)) };

    case 'addLine': {
      const uid = `${action.line.itemId}-${Date.now().toString(36)}`;
      return { ...state, lines: [...state.lines, { ...action.line, uid }] };
    }

    case 'updateLine':
      return {
        ...state,
        lines: state.lines.map((l) => (l.uid === action.uid ? { ...l, ...action.patch } : l)),
      };

    case 'removeLine':
      return { ...state, lines: state.lines.filter((l) => l.uid !== action.uid) };

    case 'setField':
      return { ...state, [action.field]: action.value };

    case 'setContact':
      return { ...state, contact: { ...state.contact, ...action.patch } };

    case 'setAddress':
      return { ...state, address: { ...state.address, ...action.patch } };

    case 'reset':
      return { ...empty };

    default:
      return state;
  }
}

const Ctx = createContext(null);

export function OrderProvider({ children }) {
  const [order, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(order));
    } catch {
      /* private mode, quota, or storage blocked — the basket still works in memory */
    }
  }, [order]);

  const totals = useMemo(() => computeTotals(order), [order]);

  const value = useMemo(() => ({ order, dispatch, totals }), [order, totals]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrder() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOrder must be used inside <OrderProvider>');
  return v;
}

/* Keep order.locationId in step with the :locationId in the URL. The URL is the
   source of truth — someone can deep-link or reload into any screen.
 *
 * EVERY route under /menu/:locationId must call this, not just the menu itself.
 * `setLocation` clears the basket by design (prices are per-kitchen), so if the
 * item page skipped this sync, adding from a deep-linked item left the order
 * with locationId still null — and the menu page then "changed" location on
 * arrival and wiped the line that was just added. */
export function useSyncLocation(locationId) {
  const { order, dispatch } = useOrder();
  useEffect(() => {
    if (locationId && order.locationId !== locationId) {
      dispatch({ type: 'setLocation', id: locationId });
    }
  }, [locationId, order.locationId, dispatch]);
}

/* ---- Pricing --------------------------------------------------------------
   Per-person items multiply by guest count. Box items (coffee, tea) are priced
   per box and multiply by their own quantity only.

   These are DISPLAY figures. The authoritative total comes from Toast's
   /prices endpoint before any card is touched — see server/lib/toast.js. Tax
   is deliberately not guessed here; the server fills it in.                  */

export function lineTotal(line, guests) {
  const units = line.unit === 'box' ? line.qty : guests * line.qty;
  return units * line.price;
}

export function computeTotals(order) {
  const subtotal = order.lines.reduce((sum, l) => sum + lineTotal(l, order.guests), 0);
  const count = order.lines.reduce((n, l) => n + l.qty, 0);
  return { subtotal, count, items: order.lines.length };
}
