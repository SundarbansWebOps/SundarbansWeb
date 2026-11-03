// Diwali fireworks over the Home sky: one 2D canvas, no library. Cost rules (spec: lightweight,
// one-shot moments over perpetual motion):
// - The frame loop runs only while something is in the air, then clears and stops.
// - It stops while the tab is hidden, unfocused or held behind the sign-in door (motion.js),
//   and resumes without a time jump.
// - Sparks live in fixed typed arrays (no per-frame allocation); the device pixel ratio is
//   capped at 1.5; lite devices get fewer sparks.
// - Colours are the Lounge tokens, read from the canvas at each burst, so the theme switch
//   recolours the next burst.
import { lite, motionActive, onMotionChange } from './motion.js';

const CAP = 900;
/* Index 1 is the "gold" (willows, flashes, rocket heads). By day the pale flame core would
   vanish into the sky, so day bursts use the deeper inks. */
const NIGHT = ['--lamp', '--lamp-core', '--live', '--indigo-t', '--w-talks'];
const DAY = ['--verm', '--lamp', '--indigo', '--w-talks', '--accent'];

export function createFireworks(canvas) {
  const ctx = canvas.getContext('2d');
  const x = new Float32Array(CAP);
  const y = new Float32Array(CAP);
  const vx = new Float32Array(CAP);
  const vy = new Float32Array(CAP);
  const life = new Float32Array(CAP); // 1 → 0
  const fade = new Float32Array(CAP); // life lost per second
  const drag = new Float32Array(CAP); // velocity decay per second (exponential)
  const grav = new Float32Array(CAP);
  const width = new Float32Array(CAP);
  const flick = new Uint8Array(CAP); // glitter: drawn on random frames
  const col = new Uint8Array(CAP);
  let n = 0;
  let palette = ['#f4b04a'];
  let night = true;
  const rockets = [];
  const flashes = [];
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;
  let dead = false;
  const density = lite ? 0.6 : 1;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = r.width;
    h = r.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function readPalette() {
    night = document.documentElement.dataset.theme === 'dark';
    const cs = getComputedStyle(canvas);
    const found = (night ? NIGHT : DAY).map((t) => cs.getPropertyValue(t).trim()).filter(Boolean);
    if (found.length) palette = found;
  }

  function spark(px, py, svx, svy, c, ttl, dr, g, lw, fl) {
    if (n >= CAP) return;
    x[n] = px;
    y[n] = py;
    vx[n] = svx;
    vy[n] = svy;
    life[n] = 1;
    fade[n] = 1 / ttl;
    drag[n] = dr;
    grav[n] = g;
    width[n] = lw;
    flick[n] = fl ? 1 : 0;
    col[n] = c;
    n++;
  }

  const pick = () => Math.floor(Math.random() * palette.length);

  function explode(bx, by) {
    readPalette();
    /* Radius scales with the sky, so a phone's short sky still frames the whole burst. */
    const reach = Math.min(w * 0.3, h * 0.5) * (0.85 + Math.random() * 0.3);
    const lw = night ? 2 : 3.8;
    const roll = Math.random();
    const c1 = pick();
    let c2 = pick();
    if (c2 === c1) c2 = (c1 + 2) % palette.length;
    if (roll < 0.25) {
      /* Willow: gold, slow, long falling trails that glitter out. */
      const k = 1.5;
      const count = Math.round(48 * density);
      const gold = palette.length > 1 ? 1 : 0;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const v = reach * k * (0.7 + Math.random() * 0.3);
        spark(bx, by, Math.cos(a) * v, Math.sin(a) * v, i % 3 ? gold : 0, 2.2, k, 70, lw, true);
      }
    } else if (roll < 0.45) {
      /* Ring, tilted like a plate seen from below, with a core of the second colour. */
      const k = 2.4;
      const count = Math.round(36 * density);
      const tilt = 0.45 + Math.random() * 0.3;
      const turn = Math.random() * Math.PI;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const ox = Math.cos(a);
        const oy = Math.sin(a) * tilt;
        const v = reach * k;
        const rx = ox * Math.cos(turn) - oy * Math.sin(turn);
        const ry = ox * Math.sin(turn) + oy * Math.cos(turn);
        spark(bx, by, rx * v, ry * v, c1, 1.25, k, 40, lw, false);
      }
      for (let i = 0; i < 12 * density; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = reach * k * 0.3 * Math.random();
        spark(bx, by, Math.cos(a) * v, Math.sin(a) * v, c2, 1, k, 40, lw, true);
      }
    } else {
      /* Peony: a full sphere in two tones; some bursts end in glitter. */
      const k = 2.2;
      const count = Math.round(60 * density);
      const glitter = Math.random() < 0.4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.15;
        const v = reach * k * (0.55 + Math.random() * 0.45);
        spark(
          bx,
          by,
          Math.cos(a) * v,
          Math.sin(a) * v,
          i % 4 ? c1 : c2,
          1.3 + Math.random() * 0.4,
          k,
          55,
          lw,
          glitter
        );
      }
    }
    if (night) flashes.push({ x: bx, y: by, r: reach * 0.7, life: 1 });
  }

  /* One rocket: rises from below the treeline to a point in the sky, then bursts. */
  function launch(at) {
    if (dead || !w || !h) return;
    readPalette();
    const tx = at ?? w * (0.1 + Math.random() * 0.8);
    rockets.push({
      x0: tx + (Math.random() - 0.5) * w * 0.08,
      x1: tx,
      y0: h + 8,
      y1: h * (0.2 + Math.random() * 0.35),
      t: 0,
      dur: 0.8 + Math.random() * 0.35,
      c: pick(),
    });
    kick();
  }

  function kick() {
    if (raf || dead || !motionActive()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    if (dead) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    ctx.clearRect(0, 0, w, h);
    /* Additive light by night; plain ink by day, where adding would bleach to white. */
    ctx.globalCompositeOperation = night ? 'lighter' : 'source-over';
    ctx.lineCap = 'round';
    const tail = night ? 0.025 : 0.05;

    /* The burst's flash: a soft disc, night only, gone in ~0.25s. */
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= dt * 4;
      if (f.life <= 0) {
        flashes.splice(i, 1);
        continue;
      }
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, palette[1] || palette[0]);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = f.life * 0.22;
      ctx.fillStyle = g;
      ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t += dt / r.dur;
      const e = 1 - (1 - Math.min(1, r.t)) ** 3;
      const rx = r.x0 + (r.x1 - r.x0) * e;
      const ry = r.y0 + (r.y1 - r.y0) * e;
      /* Its tail: short, dim, falling embers. */
      spark(rx, ry, (Math.random() - 0.5) * 20, 30, r.c, 0.4, 3, 60, 1.4, true);
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette[1] || palette[0];
      ctx.beginPath();
      ctx.arc(rx, ry, night ? 1.8 : 2.2, 0, Math.PI * 2);
      ctx.fill();
      if (r.t >= 1) {
        rockets.splice(i, 1);
        explode(rx, ry);
      }
    }

    for (let i = 0; i < n;) {
      life[i] -= fade[i] * dt;
      if (life[i] <= 0) {
        /* Swap-remove: the last spark takes this slot. */
        n--;
        x[i] = x[n];
        y[i] = y[n];
        vx[i] = vx[n];
        vy[i] = vy[n];
        life[i] = life[n];
        fade[i] = fade[n];
        drag[i] = drag[n];
        grav[i] = grav[n];
        width[i] = width[n];
        flick[i] = flick[n];
        col[i] = col[n];
        continue;
      }
      const d = Math.exp(-drag[i] * dt);
      vx[i] *= d;
      vy[i] = vy[i] * d + grav[i] * dt;
      const px = x[i];
      const py = y[i];
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      const l = life[i];
      if (!flick[i] || l > 0.5 || Math.random() < 0.55) {
        /* Light fades fast at night; ink holds its strength by day, then drops off. */
        ctx.globalAlpha = night ? l * l : Math.min(1, l * 1.4);
        ctx.strokeStyle = palette[col[i]] || palette[0];
        ctx.lineWidth = width[i] * (0.5 + l * 0.5);
        ctx.beginPath();
        /* A streak from a little behind the last position reads as motion blur; longer by
           day so the ink holds up against the painted sky. */
        ctx.moveTo(px - vx[i] * tail, py - vy[i] * tail);
        ctx.lineTo(x[i], y[i]);
        ctx.stroke();
      }
      i++;
    }

    if (n || rockets.length || flashes.length) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, w, h);
  }

  const unsubscribe = onMotionChange((active) => {
    if (!active && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (active && (n || rockets.length || flashes.length)) {
      kick();
    }
  });

  function destroy() {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    unsubscribe();
  }

  return { launch, destroy };
}
