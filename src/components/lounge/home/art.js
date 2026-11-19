// Every sprite Home, the boat and the name beacon use, in one place, so new art is a one-line
// swap. r6 art (art/r6/manifest.json) where it exists; B's sprites otherwise.
import { FACE } from '../name-fit.js';
import { winter } from './season.js';

const b = (f) => new URL(`../b/assets/${f}`, import.meta.url).href;
const h = (f) => new URL(`./art/${f}`, import.meta.url).href;
/* Literal URLs let Vite include the sprites in standalone builds. */
const R6 = {
  'boat-day.webp': new URL('../art/r6/boat-day.webp', import.meta.url).href,
  'boat-night.webp': new URL('../art/r6/boat-night.webp', import.meta.url).href,
  'boat-day.avif': new URL('../art/r6/boat-day.avif', import.meta.url).href,
  'boat-night.avif': new URL('../art/r6/boat-night.avif', import.meta.url).href,
  'lantern-unlit.webp': new URL('../art/r6/lantern-unlit.webp', import.meta.url).href,
  'kite-mine.webp': new URL('../art/r6/kite-mine.webp', import.meta.url).href,
};
const r6 = (f) => R6[f];

/* Pair source paths before bundling: production file hashes differ between themes. */
const themeArt = import.meta.glob(
  ['./art/*.{avif,webp}', '../art/r6/*.{avif,webp}', '../b/assets/*.{avif,webp}'],
  { eager: true, query: '?url', import: 'default' }
);
const themePartners = new Map();
for (const [path, url] of Object.entries(themeArt)) {
  const partner = path.includes('-day')
    ? path.replace(/-day(?=[-.])/, '-night')
    : path.replace(/-night(?=[-.])/, '-day');
  if (partner !== path && themeArt[partner])
    themePartners.set(new URL(url, location.href).href, themeArt[partner]);
}
export const otherThemeArt = (url) => themePartners.get(url);

/* Winter (season.js) swaps in the -winter- twin of a sprite (boat-day -> boat-winter-day).
   The twins pair day <-> night above like any other art. A missing twin falls back to the
   year-round file, so the build works with or without the winter art. */
const winterOf = (path) =>
  winter ? themeArt[path.replace(/-(day|night)(?=[-.])/, '-winter-$1')] : undefined;
const hw = (f) => winterOf(`./art/${f}`) ?? h(f);
const r6w = (f) => winterOf(`../art/r6/${f}`) ?? r6(f);

/* Graded plates (B's, regraded by _design/sketches/grade.py; night 12% darker). */
export const PLATE = {
  /* Winter plates swap as a set: both widths, or neither (never a mixed srcset). */
  set(mode, ext) {
    const [s, l] = [900, 1536].map((w) => winterOf(`./art/plate-${mode}-${w}.${ext}`));
    if (s && l) return `${s} 900w, ${l} 1536w`;
    return `${h(`plate-${mode}-900.${ext}`)} 900w, ${h(`plate-${mode}-1536.${ext}`)} 1536w`;
  },
  src: (mode) => winterOf(`./art/plate-${mode}-1536.webp`) ?? h(`plate-${mode}-1536.webp`),
  /* Where things sit on the plate (fractions of its box). */
  horizon: 0.335,
  moon: { x: 0.8024, y: 0.0825, w: 0.1 },
};

/* The boat. lamp = the flame's centre as fractions of the sprite (manifest centroid). */
export const BOAT = {
  day: r6w('boat-day.webp'),
  night: r6w('boat-night.webp'),
  avif: { day: r6w('boat-day.avif'), night: r6w('boat-night.avif') },
  ratio: 800 / 328,
  lamp: { x: 0.585, y: 0.212 }, // art/r6/manifest.json boat-night.lamp
};

/* r6 boat-moored (bow to the LEFT), 400w; night graded by grade.py and dimmed. */
export const MOORED = {
  day: hw('moored-day.webp'),
  night: hw('moored-night.webp'),
  avif: { day: hw('moored-day.avif'), night: hw('moored-night.avif') },
  ratio: 400 / 145,
};

/* The member's lantern and kite (r6 kite-mine: wide cream diamond for the name). Change
   src, ratio and face here and the name fit follows. */
export const LANTERN = { src: b('lantern.webp'), ratio: 480 / 621, face: FACE.lantern };
export const LANTERN_UNLIT = r6('lantern-unlit.webp');
export const KITE_MINE = { src: r6('kite-mine.webp'), ratio: 520 / 650, face: FACE.kiteMine };
export const KITES = [b('kite0.webp'), b('kite1.webp'), b('kite2.webp')];
export const LANTERN_FAR = h('lantern-far.webp');

export const SUN = b('sun.webp');
export const MOON = b('moon.webp');
export const BIRDS = b('birds.webp');
export const CLOUDS = [b('cloud0.webp'), b('cloud1.webp'), b('cloud2.webp')];
/* r6 mangrove, 440w for Home. */
export const MANGROVE = {
  day: hw('mangrove-day.webp'),
  night: hw('mangrove-night.webp'),
  avif: { day: hw('mangrove-day.avif'), night: hw('mangrove-night.avif') },
  ratio: 640 / 1047,
};
