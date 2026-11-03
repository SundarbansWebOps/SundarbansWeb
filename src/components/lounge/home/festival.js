// Festival window for the Lounge's Diwali layer. Tiny on purpose: Home imports only this, and
// the layer itself (DiwaliLayer.vue, fireworks.js) is a separate chunk fetched only while the
// window is open. Outside it, members download nothing.

/* Lakshmi Puja (main Diwali night) by year, as an IST calendar date. Add next year's date
   before October; a year without an entry shows nothing. */
const DIWALI = { 2026: '2026-11-08' };
const DAYS_BEFORE = 5;
const DAYS_AFTER = 3;
const IST_MS = 5.5 * 3600e3;
const DAY_MS = 864e5;

/* ?diwali=1 forces the layer on (to preview it any day), ?diwali=0 forces it off. */
export function diwaliOn(now = new Date(), search = location.search) {
  const force = new URLSearchParams(search).get('diwali');
  if (force === '1') return true;
  if (force === '0') return false;
  const ist = new Date(now.getTime() + IST_MS);
  const date = DIWALI[ist.getUTCFullYear()];
  if (!date) return false;
  const [y, m, d] = date.split('-').map(Number);
  const today = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const offset = (today - Date.UTC(y, m - 1, d)) / DAY_MS;
  return offset >= -DAYS_BEFORE && offset <= DAYS_AFTER;
}
