// Draws a member's certificate to a PNG, adapted from ../lounge-a/cert.js (Raja liked it):
// the scroll's paper and lotus band, the crest pressed as a seal, a vermilion stamp. Round 4
// changes: the event's community figure is painted in, the community is named in its own
// colour, the verify address is spelled out in full, and long names and titles shrink to fit.
// Prototype only: the real certificate is issued by the backend. Lounge E: Anek Latin Lounge only (no
// monospace); the name is required (never the roll number).
import CREST from '../../assets/crest.webp';
import { ASSET } from '../../lib/pat.js';
import { verifyHref } from './events.js';

const W = 1600;
const H = 1130;
const INK = '#1d1915';
const INK2 = '#54483c';
const VERM = '#a52d16';
/* Community colours as print inks (light-theme wing tokens). */
const COMM_INK = {
  cultural: '#9a5200',
  technical: '#2f4f9e',
  esports: '#b8341b',
  girls: '#a3245c',
  house: '#7e3474',
};

const img = (src) =>
  new Promise((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = no;
    i.src = src;
  });

function fit(c, text, weight, size, min, max) {
  let fs = size;
  c.font = `${weight} ${fs}px "Anek Latin Lounge"`;
  while (c.measureText(text).width > max && fs > min)
    c.font = `${weight} ${(fs -= 2)}px "Anek Latin Lounge"`;
}

function stamp(c, x, y, r, rot) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.globalAlpha = 0.88;
  c.strokeStyle = VERM;
  c.fillStyle = VERM;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(0, 0, r - 12, 0, Math.PI * 2);
  c.stroke();
  c.font = '800 21px "Anek Latin Lounge"';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const ring = 'SUNDARBANS HOUSE · ATTENDED · ';
  for (let k = 0; k < ring.length; k++) {
    c.save();
    c.rotate((k / ring.length) * Math.PI * 2);
    c.fillText(ring[k], 0, -(r - 30));
    c.restore();
  }
  c.font = '800 30px "Anek Latin Lounge"';
  c.fillText('THE', 0, -12);
  c.font = '800 26px "Anek Latin Lounge"';
  c.fillText('LOUNGE', 0, 18);
  c.restore();
}

/* cert: { id, minutes, event: { name, community, starts_at, precision } }, when: date words. */
export async function renderCertificate({
  name,
  roll,
  region,
  cert,
  when,
  commKey,
  commLabel,
  art,
}) {
  await Promise.all([
    document.fonts.load('800 80px "Anek Latin Lounge"'),
    document.fonts.load('600 30px "Anek Latin Lounge"'),
  ]).catch(() => {});
  const [crest, band, edge, grain, plate] = await Promise.all([
    img(CREST),
    img(ASSET.band),
    img(ASSET.edge),
    img(ASSET.grain),
    art ? img(art).catch(() => null) : null,
  ]);

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');

  // Paper and grain.
  c.fillStyle = '#f0dfc0';
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = c.createPattern(grain, 'repeat');
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';

  // Lotus band top and bottom, lotus edges left and right, a double keyline inside.
  const bh = 44;
  for (let x = 0; x < W; x += band.width) {
    c.drawImage(band, x, 0, band.width, bh);
    c.drawImage(band, x, H - bh, band.width, bh);
  }
  const ew = 40;
  const eh = (edge.height / edge.width) * ew;
  for (let y = bh; y < H - bh; y += eh) {
    c.drawImage(edge, 0, y, ew, eh);
    c.drawImage(edge, W - ew, y, ew, eh);
  }
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.strokeRect(ew + 22, bh + 22, W - 2 * ew - 44, H - 2 * bh - 44);
  c.lineWidth = 1.2;
  c.strokeRect(ew + 32, bh + 32, W - 2 * ew - 64, H - 2 * bh - 64);

  // Crest as a marigold seal ringed with vermilion dots.
  const cx = W / 2;
  c.fillStyle = '#eaa53c';
  c.beginPath();
  c.arc(cx, 186, 64, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 3;
  c.stroke();
  c.save();
  c.beginPath();
  c.arc(cx, 186, 50, 0, Math.PI * 2);
  c.clip();
  c.drawImage(crest, cx - 50, 136, 100, 100);
  c.restore();
  c.fillStyle = '#b8341b';
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    c.beginPath();
    c.arc(cx + Math.cos(a) * 57, 186 + Math.sin(a) * 57, 2.6, 0, Math.PI * 2);
    c.fill();
  }

  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillStyle = INK2;
  c.font = '650 24px "Anek Latin Lounge"';
  c.fillText('SUNDARBANS HOUSE  ·  IIT MADRAS BS DEGREE', cx, 292);
  c.fillStyle = INK;
  c.font = '800 68px "Anek Latin Lounge"';
  c.fillText('Certificate of participation', cx, 372);

  c.fillStyle = INK2;
  c.font = '500 28px "Anek Latin Lounge"';
  c.fillText('This certifies that', cx, 436);

  /* Callers only render with a name: a certificate never prints the roll in its place. */
  const who = name;
  c.fillStyle = VERM;
  fit(c, who, 800, 92, 50, 1000);
  c.fillText(who, cx, 530, 1000);
  c.fillStyle = INK;
  for (let x = cx - 260; x <= cx + 260; x += 14) {
    c.beginPath();
    c.arc(x, 560, 2.6, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = INK2;
  c.font = '600 26px "Anek Latin Lounge"';
  c.fillText(name ? `Roll no. ${roll}  ·  ${region} region` : `${region} region`, cx, 604);

  c.fillStyle = INK;
  c.font = '500 30px "Anek Latin Lounge"';
  c.fillText('took part in', cx, 664);
  fit(c, cert.event.name, 750, 46, 28, 1080);
  c.fillText(cert.event.name, cx, 722, 1080);

  // Community, in its own ink, then the date and minutes present.
  c.font = '800 22px "Anek Latin Lounge"';
  const label = `${commLabel.toUpperCase()} COMMUNITY`;
  const lw = c.measureText(label).width + 36;
  c.fillStyle = COMM_INK[commKey] ?? INK;
  c.beginPath();
  c.roundRect(cx - lw / 2, 746, lw, 36, 18);
  c.fill();
  c.fillStyle = '#fff6e6';
  c.fillText(label, cx, 772);
  c.font = '500 27px "Anek Latin Lounge"';
  c.fillStyle = INK2;
  c.fillText(`held ${when}  ·  present for ${cert.minutes} minutes`, cx, 826);

  // The community figure, bottom left; the stamp, bottom right.
  if (plate) {
    const pw = 330;
    const ph = (plate.height / plate.width) * pw;
    c.drawImage(plate, ew + 62, H - bh - 66 - ph, pw, ph);
  }
  stamp(c, W - ew - 190, H - bh - 186, 92, -0.18);

  // Signature lines.
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.font = '600 22px "Anek Latin Lounge"';
  c.fillStyle = INK2;
  for (const [x, label2] of [
    [cx - 150, 'House Secretary'],
    [cx + 150, 'Regional Coordinator'],
  ]) {
    c.beginPath();
    c.moveTo(x - 115, 922);
    c.lineTo(x + 115, 922);
    c.stroke();
    c.fillText(label2, x, 952);
  }

  c.font = '500 20px "Anek Latin Lounge"';
  c.fillStyle = INK2;
  c.fillText(`${cert.id}  ·  verify at ${location.host}${verifyHref(cert.id)}`, cx, H - bh - 50);

  return cv.toDataURL('image/png');
}

/* An organizer's signed blank template, with the confirmed name and verify line pressed on.
   Templates carry no placement metadata, so the name sits on the centre line; organizers are
   asked to leave that band clear. Storage serves templates with CORS, so the canvas stays
   exportable; a template that cannot load rejects and the caller shows its retry state. */
export async function renderOnTemplate({ templateUrl, name, certId }) {
  await document.fonts.load('800 80px "Anek Latin Lounge"').catch(() => {});
  const t = await new Promise((ok, no) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => ok(i);
    i.onerror = no;
    i.src = templateUrl;
  });
  const w = t.naturalWidth;
  const h = t.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  c.drawImage(t, 0, 0, w, h);
  c.fillStyle = INK;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fit(c, name, 800, Math.round(w * 0.055), Math.round(w * 0.025), w * 0.8);
  c.fillText(name, w / 2, h / 2);
  c.fillStyle = INK2;
  c.font = `600 ${Math.max(12, Math.round(w * 0.011))}px "Anek Latin Lounge"`;
  c.fillText(`${certId}  ·  verify at ${location.host}${verifyHref(certId)}`, w / 2, h * 0.95);
  return cv.toDataURL('image/png');
}
