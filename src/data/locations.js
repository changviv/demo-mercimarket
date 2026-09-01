/* The six Merci Market locations.
   Addresses and hours are the client's own, taken from
   https://mercimarketnyc.com/locations/

   `toastGuid` and `stripeAccountLabel` are the per-location integration keys.
   They are IDENTIFIERS, not secrets — the GUID appears in the
   Toast-Restaurant-External-ID request header and the Stripe label only names
   which server-side credential set to use. The actual API keys never appear in
   this file, or anywhere else under src/. See server/lib/tenants.js. */

export const LOCATIONS = [
  {
    id: 'greenwich-village',
    name: 'Greenwich Village',
    addr: '45 University Pl',
    city: 'New York, NY 10003',
    hours: { weekday: [6, 24], weekend: [7, 24] },
    toastGuid: import.meta.env.VITE_TOAST_GUID_GREENWICH_VILLAGE || '',
    stripeAccountLabel: 'greenwich_village',
  },
  {
    id: 'union-square',
    name: 'Union Square',
    addr: '59 5th Ave',
    city: 'New York, NY 10003',
    hours: { weekday: [6, 24], weekend: [7, 24] },
    toastGuid: import.meta.env.VITE_TOAST_GUID_UNION_SQUARE || '',
    stripeAccountLabel: 'union_square',
  },
  {
    id: 'chelsea',
    name: 'Chelsea',
    addr: '168 7th Ave',
    city: 'New York, NY 10011',
    hours: '24',
    toastGuid: import.meta.env.VITE_TOAST_GUID_CHELSEA || '',
    stripeAccountLabel: 'chelsea',
  },
  {
    id: 'murray-hill',
    name: 'Murray Hill',
    addr: '136 E 34th St',
    city: 'New York, NY 10016',
    hours: { weekday: [6, 22.5], weekend: [6, 22.5] },
    toastGuid: import.meta.env.VITE_TOAST_GUID_MURRAY_HILL || '',
    stripeAccountLabel: 'murray_hill',
  },
  {
    id: 'bryant-park',
    name: 'Bryant Park',
    addr: '1017 6th Ave',
    city: 'New York, NY 10018',
    hours: '24',
    toastGuid: import.meta.env.VITE_TOAST_GUID_BRYANT_PARK || '',
    stripeAccountLabel: 'bryant_park',
  },
  {
    id: 'central-park',
    name: 'Central Park',
    addr: '1413 6th Ave',
    city: 'New York, NY 10019',
    hours: '24',
    toastGuid: import.meta.env.VITE_TOAST_GUID_CENTRAL_PARK || '',
    stripeAccountLabel: 'central_park',
  },
];

export function getLocation(id) {
  return LOCATIONS.find((l) => l.id === id) || null;
}

/* ---- Live open/closed, evaluated in the store's own timezone -------------- */

const TZ = 'America/New_York';

function nyNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const o = {};
  parts.forEach((p) => {
    o[p.type] = p.value;
  });
  let h = parseInt(o.hour, 10);
  if (h === 24) h = 0;
  return { day: o.weekday, t: h + parseInt(o.minute, 10) / 60 };
}

function fmtHour(x) {
  const h = Math.floor(x) % 24;
  const m = Math.round((x - Math.floor(x)) * 60);
  const ap = h >= 12 ? 'pm' : 'am';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return hh + (m ? `:${String(m).padStart(2, '0')}` : '') + ap;
}

export function locationStatus(location) {
  if (location.hours === '24') {
    return { open: true, label: 'Open 24 hours', today: 'Open 24 hours' };
  }
  const now = nyNow();
  const weekend = now.day === 'Sat' || now.day === 'Sun';
  const [from, to] = weekend ? location.hours.weekend : location.hours.weekday;
  const today = `${fmtHour(from)} – ${fmtHour(to)}`;
  const open = now.t >= from && now.t < to;
  return {
    open,
    label: open ? `Open until ${fmtHour(to)}` : `Opens ${fmtHour(from)}`,
    today,
  };
}
