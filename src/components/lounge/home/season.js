// Winter on the river: snow, mist and the winter art (art.js), from 1 November to the last day
// of February in India. Independent of day and night: both themes have a winter look.
const IST_MS = 5.5 * 3600e3;

/* ?winter forces it on (to preview it any day), ?winter=0 forces it off. No member toggle. */
export function isWinter(now = new Date(), search = location.search) {
  const params = new URLSearchParams(search);
  if (params.has('winter')) return params.get('winter') !== '0';
  /* Months in Asia/Kolkata (no DST, so a fixed offset): Nov, Dec, Jan, Feb. 29 Feb is
     still February, so leap years need nothing. */
  const month = new Date(now.getTime() + IST_MS).getUTCMonth();
  return month >= 10 || month <= 1;
}

/* Decided once per page load: art and snow never change season under a member's eyes. */
export const winter = isWinter();
