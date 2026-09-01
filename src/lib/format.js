const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const money = (n) => USD.format(Number(n) || 0);

export const dateLong = (iso) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';

export const dateShort = (iso) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '';

/** Whole days from today to an ISO date, in the store's timezone. */
export function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

export const todayISO = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
