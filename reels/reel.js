// AZIZ FLORAN — "Landshaftning 12 mashhur uslubi" Reels animatsiyasi.
// Hammasi bitta deterministik render(t) funksiyasi: brauzerda ko'rish ham, kadrma-kadr MP4 eksport ham shundan.
'use strict';
(() => {
const W = 1080, H = 1920;
// Sahna uzunliklari (s): timing.js orqali diktor ovoziga moslab o'zgartiriladi
const TM = window.REEL_TIMING || { hook: 4, scenes: Array(12).fill(5), finale: 8 };
const STARTS = []; { let a = TM.hook; for (const d of TM.scenes) { STARTS.push(a); a += d; } }
const FIN = STARTS[11] + TM.scenes[11], DUR = FIN + TM.finale;
const C = {
  cream: '#F3ECDF', paper: '#F1E9DA', ink: '#1F3D2B', green: '#2F5D3A', gold: '#B8913A', goldL: '#D9B867',
  text: '#3A4A3E', lawn: '#8FB165', stone: '#E7DCC5', stone2: '#D3C3A3', water: '#6FB4C9', terra: '#C4693F',
  earth: '#CDBE9C', wall: '#E8DDC8', white: '#FBF8F1', hedge: '#3B6A3E'
};

// ---------- matematika ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const prog = (t, a, d) => clamp((t - a) / d);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const normz = (x, z) => { const l = Math.hypot(x, z); return l < 1e-6 ? [1, 0] : [x / l, z / l]; };
function rng(seed) { let s = (seed * 2654435761) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- rang ----------
const CC = new Map();
function hex(c) { if (c[0] !== '#') return c.match(/[\d.]+/g).slice(0, 3).map(Number); const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgb = a => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
function shade(c, f) { const k = c + 's' + f.toFixed(3); let v = CC.get(k); if (!v) { const a = hex(c); v = rgb(f < 0 ? a.map(x => x * (1 + f)) : a.map(x => x + (255 - x) * f)); CC.set(k, v); } return v; }
function mul(c, f) { const k = c + 'm' + f.toFixed(2); let v = CC.get(k); if (!v) { v = rgb(hex(c).map(x => Math.min(255, x * f))); CC.set(k, v); } return v; }
function mixc(c1, c2, t) { const a = hex(c1), b = hex(c2); return rgb(a.map((v, i) => v + (b[i] - v) * t)); }
const LI = norm([-.45, .8, .42]);
const lit = (c, n) => mul(c, .62 + .44 * Math.max(0, dot(n, LI)));

// ---------- geometriya (reja koordinatalari: x — chap/o'ng, z — uy(-) / darvoza(+)) ----------
const circ = (cx, cz, r, n = 36) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
const ell = (cx, cz, rx, rz, n = 36) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]; });
const circClosed = (cx, cz, r, n = 40) => { const p = circ(cx, cz, r, n); return [...p.slice(n / 4), ...p.slice(0, n / 4 + 1)]; };
const ellClosed = (cx, cz, rx, rz, n = 40) => { const p = ell(cx, cz, rx, rz, n); p.push(p[0]); return p; };
const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const closedRect = (x0, x1, z0, z1) => { const m = (x0 + x1) / 2; return [[m, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0], [m, z0]]; };
const octa = (cx, cz, r) => Array.from({ length: 8 }, (_, i) => { const a = (i + .5) / 8 * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
function blob(cx, cz, rx, rz, seed, j = .18, n = 44) {
  const R = rng(seed), ph = [R() * 6, R() * 6, R() * 6];
  return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; const k = 1 + j * (Math.sin(a * 2 + ph[0]) * .6 + Math.sin(a * 3 + ph[1]) * .3 + Math.sin(a * 5 + ph[2]) * .2); return [cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]; });
}
function smooth(p, seg = 8) {
  const out = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(p[p.length - 1]);
  return out;
}
function samplePath(line, step) {
  const out = []; let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc <= l) { const t = acc / l; out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), normz(b[0] - a[0], b[1] - a[1])]); acc += step; }
    acc -= l;
  }
  return out;
}
// Chiziq bo'ylab p qismigacha "chizilgan" lenta (yo'lak, kanal, to'siq)
function ribbon(line, w, p) {
  const n = line.length; if (n < 2) return null;
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const tot = L[n - 1] * p; if (tot < .03) return null;
  const pts = [line[0]];
  for (let i = 1; i < n; i++) {
    if (L[i] < tot) pts.push(line[i]);
    else { const t = (tot - L[i - 1]) / (L[i] - L[i - 1] || 1); pts.push([lerp(line[i - 1][0], line[i][0], t), lerp(line[i - 1][1], line[i][1], t)]); break; }
  }
  const m = pts.length, Lf = [], Rt = [];
  for (let i = 0; i < m; i++) {
    let nx, nz, sc = 1;
    if (i > 0 && i < m - 1) {
      const d1 = normz(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]), d2 = normz(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      let ax = -d1[1] - d2[1], az = d1[0] + d2[0]; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
      sc = 1 / Math.max(ax * -d1[1] + az * d1[0], .35); nx = ax; nz = az;
    } else {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m - 1, i + 1)], d = normz(b[0] - a[0], b[1] - a[1]); nx = -d[1]; nz = d[0];
    }
    const o = w / 2 * sc;
    Lf.push([pts[i][0] + nx * o, pts[i][1] + nz * o]); Rt.push([pts[i][0] - nx * o, pts[i][1] - nz * o]);
  }
  return Lf.concat(Rt.reverse());
}

// ---------- kamera va proyeksiya ----------
let X = null, cam = null;
function makeCam(o) {
  const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
  const pos = [o.tx + o.dist * cp * Math.sin(o.yaw), o.ty + o.dist * sp, o.tz + o.dist * cp * Math.cos(o.yaw)];
  const f = norm(sub([o.tx, o.ty, o.tz], pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  return { ...o, F: o.dist * o.scale, pos, f, r, u };
}
function toCam(p) { const d = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]]; return [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)]; }
const pj = q => [cam.cx + cam.F * q[0] / q[2], cam.cy - cam.F * q[1] / q[2]];
function P3(x, y, z) { const q = toCam([x, y, z]); return q[2] > .3 ? pj(q) : null; }
const depth = (x, y, z) => toCam([x, y, z])[2];
function clipNear(q, n = .5) {
  const out = [];
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length], ai = a[2] > n, bi = b[2] > n;
    if (ai) out.push(a);
    if (ai !== bi) { const t = (n - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, n]); }
  }
  return out;
}
function pathW(pts3) {
  const q = clipNear(pts3.map(toCam)); if (q.length < 3) return false;
  X.beginPath();
  for (let i = 0; i < q.length; i++) { const s = pj(q[i]); i ? X.lineTo(s[0], s[1]) : X.moveTo(s[0], s[1]); }
  X.closePath(); return true;
}
const W3 = (pts, y) => pts.map(p => [p[0], y, p[1]]);
function fillGround(pts, y, fill, stroke, lw = 1.3) {
  if (!pathW(W3(pts, y))) return false;
  X.fillStyle = fill; X.fill();
  if (stroke) { X.strokeStyle = stroke; X.lineWidth = lw; X.stroke(); }
  return true;
}
function scalePts(pts, s) {
  let cx = 0, cz = 0; pts.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length;
  return pts.map(p => [cx + (p[0] - cx) * s, cz + (p[1] - cz) * s]);
}
function strokeW(pts, y, col, wm, closedP) {
  const ps = pts.map(p => P3(p[0], y, p[1])); if (ps.some(p => !p)) return;
  const d = depth(pts[0][0], y, pts[0][1]);
  X.strokeStyle = col; X.lineWidth = Math.max(.8, cam.F * wm / d); X.lineCap = 'round'; X.lineJoin = 'round';
  X.beginPath(); ps.forEach((s, i) => i ? X.lineTo(s[0], s[1]) : X.moveTo(s[0], s[1])); if (closedP) X.closePath(); X.stroke();
}

// ---------- 3D primitivlar ----------
function sphere(x, y, z, r, col) {
  const q = toCam([x, y, z]); if (q[2] < .5) return;
  const s = pj(q), R = cam.F * r / q[2]; if (R < .35) return;
  if (R < 5) { X.fillStyle = col; X.beginPath(); X.arc(s[0], s[1], R, 0, 6.2832); X.fill(); return; }
  const g = X.createRadialGradient(s[0] - R * .38, s[1] - R * .42, R * .08, s[0], s[1], R);
  g.addColorStop(0, shade(col, .3)); g.addColorStop(.62, col); g.addColorStop(1, shade(col, -.32));
  X.fillStyle = g; X.beginPath(); X.arc(s[0], s[1], R, 0, 6.2832); X.fill();
}
function sortDraw(items) {
  items.map(it => ({ it, d: depth(it[0], it[1], it[2]) })).sort((a, b) => b.d - a.d).forEach(o => sphere(...o.it));
}
function crown(x, y, z, r, col, seed, flat = 1, n = 6) {
  const R = rng(seed + 99), items = [[x, y, z, r * .8, col]];
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.2832 + R() * .6;
    items.push([x + Math.cos(a) * r * .52, y + (R() - .45) * r * .55 * flat, z + Math.sin(a) * r * .52, r * (.44 + R() * .14), shade(col, (R() - .5) * .16)]);
  }
  items.push([x - r * .14, y + r * .36 * flat, z - r * .1, r * .5, shade(col, .06)]);
  sortDraw(items);
}
function trunk(pts, w, col = '#6E523D') {
  const ps = pts.map(p => P3(...p)); if (ps.some(p => !p)) return;
  const d = depth(...pts[0]);
  X.strokeStyle = col; X.lineWidth = Math.max(1, cam.F * w / d); X.lineCap = 'round'; X.lineJoin = 'round';
  X.beginPath(); ps.forEach((s, i) => i ? X.lineTo(s[0], s[1]) : X.moveTo(s[0], s[1])); X.stroke();
}
function face(pts, col, ref) {
  const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]);
  let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  if (ref && dot(n, sub(c, ref)) < 0) n = n.map(v => -v);
  if (dot(n, sub(cam.pos, c)) <= 0) return false;
  if (!pathW(pts)) return false;
  X.fillStyle = lit(col, n); X.fill(); return true;
}
function box(x0, x1, z0, z1, y0, y1, col, top) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  const ref = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  [[3, 2, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [0, 3, 7, 4]].forEach(f => face(f.map(i => v[i]), col, ref));
  face([4, 5, 6, 7].map(i => v[i]), top || col, ref);
}
function disc(x, z, r, y, col, n = 18) { fillGround(circ(x, z, r, n), y, col); }

// ---------- vertikal obyektlar (daraxt, buta, uy...) ----------
const FRUIT = ['#D4452C', '#E9A23B'];
function drawV(e, s, g, T) {
  const x = e.x, z = e.z, y0 = e.y0 || 0;
  switch (e.type) {
    case 'round': case 'fruit': {
      const h = e.h * s, r = e.r * s, cy = y0 + h - r;
      trunk([[x, y0, z], [x, y0 + Math.max(0, cy - r * .2), z]], .16 + e.r * .06);
      crown(x, cy, z, r, e.col, e.seed || ((x * 13 + z * 7) | 0));
      if (e.type === 'fruit' && s > .5) {
        const R = rng((e.seed || 3) + 7);
        for (let i = 0; i < 11; i++) {
          const a = R() * 6.2832, b = (R() - .3) * 1.4, d = [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)];
          const p = [x + d[0] * r * .92, cy + d[1] * r * .8, z + d[2] * r * .92];
          if (dot(d, sub(cam.pos, p)) > 0) sphere(p[0], p[1], p[2], .13 * s, e.fruit || FRUIT[i % 2]);
        }
      }
      break;
    }
    case 'maple': {
      const h = e.h * s, r = e.r * s;
      trunk([[x, y0, z], [x + .3 * s, h * .4, z - .1], [x - .1, h - r * .7, z]], .18);
      crown(x, y0 + h - r * .7, z, r, e.col || '#B9452F', 5, .55, 7);
      break;
    }
    case 'olive': {
      const h = e.h * s, r = e.r * s;
      trunk([[x, y0, z], [x - .3 * s, h * .35, z + .1], [x + .2 * s, h - r * .6, z]], .3, '#7B6A55');
      crown(x, y0 + h - r * .6, z, r, e.col || '#9BA67F', 21, .7, 5);
      break;
    }
    case 'multi': {
      const h = e.h * s, r = e.r * s, R = rng(e.seed || 4), items = [];
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + .4, tx = x + Math.cos(a) * r * .45, tz = z + Math.sin(a) * r * .45;
        trunk([[x, y0, z], [tx, y0 + h * .6, tz]], .09, '#CFC6B4');
        items.push([tx, y0 + h * (.62 + R() * .2), tz, r * .55, shade(e.col || '#9DBB6E', (R() - .5) * .14)]);
      }
      items.push([x, y0 + h * .9, z, r * .5, shade(e.col || '#9DBB6E', .08)]);
      sortDraw(items);
      break;
    }
    case 'cone': {
      const it = []; for (let i = 0; i < 5; i++) it.push([x, y0 + e.h * s * (.12 + i * .19), z, e.r * s * (1 - .18 * i), e.col || '#2F5D3A']);
      sortDraw(it); break;
    }
    case 'cypress': {
      trunk([[x, y0, z], [x, y0 + .4 * s, z]], .12);
      const it = []; for (let i = 0; i < 7; i++) it.push([x, y0 + e.h * s * (.12 + i * .135), z, e.r * s * (1 - .11 * i), shade(e.col || '#2E5636', i * .02)]);
      sortDraw(it); break;
    }
    case 'ball': sphere(x, y0 + e.r * s * .95, z, e.r * s, e.col || '#3F7040'); break;
    case 'shrub': sphere(x, y0 + e.r * s * .7, z, e.r * s, e.col || '#4D7B3F'); break;
    case 'flower': {
      const hy = (e.y || .32) * s;
      if (e.stem) trunk([[x, y0, z], [x, y0 + hy, z]], .03, '#6C8A45');
      sphere(x, y0 + hy, z, (e.r || .2) * s, e.col); break;
    }
    case 'tuft': {
      const R = rng(e.seed || ((x * 31 + z * 17) | 0)), h = (e.h || 1) * s, d = depth(x, y0, z);
      X.strokeStyle = e.col || '#B9AE7C'; X.lineWidth = Math.max(.8, cam.F * .035 / d); X.lineCap = 'round';
      const b = P3(x, y0, z); if (!b) break;
      const tips = [];
      X.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = R() * 6.2832, l = .25 + R() * .3, t = P3(x + Math.cos(a) * l * h, y0 + h * (.7 + R() * .3), z + Math.sin(a) * l * h);
        if (!t) continue; X.moveTo(b[0], b[1]); X.quadraticCurveTo((b[0] + t[0]) / 2, t[1], t[0], t[1]); tips.push(t);
      }
      X.stroke();
      if (e.seedc) { X.fillStyle = e.seedc; const rr = Math.max(1.2, cam.F * .07 / d); tips.forEach(t => { X.beginPath(); X.ellipse(t[0], t[1], rr * .7, rr * 1.4, 0, 0, 6.2832); X.fill(); }); }
      break;
    }
    case 'rock': case 'tallrock': {
      const n = e.type === 'tallrock' ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const r = e.r * s * (1 - k * .22), yy = y0 + (e.type === 'tallrock' ? e.h * s * (.18 + k * .3) : r * .42);
        const q = toCam([x + (k % 2 ? .2 : -.1) * r, yy, z]); if (q[2] < .5) continue;
        const c = pj(q), R0 = cam.F * r / q[2], R = rng(e.seed || ((x * 5 + z * 3) | 0) + k);
        const g2 = X.createLinearGradient(c[0] - R0, c[1] - R0, c[0] + R0, c[1] + R0);
        g2.addColorStop(0, e.col ? shade(e.col, .25) : '#C9C4B9'); g2.addColorStop(1, e.col ? shade(e.col, -.3) : '#7F7A70');
        X.fillStyle = g2; X.beginPath();
        for (let i = 0; i < 9; i++) { const a = i / 9 * 6.2832, rr = R0 * (.78 + R() * .3); const px = c[0] + Math.cos(a) * rr, py = c[1] + Math.sin(a) * rr * .78; i ? X.lineTo(px, py) : X.moveTo(px, py); }
        X.closePath(); X.fill();
        if (e.type === 'tallrock' && R0 > 6) { X.fillStyle = 'rgba(60,58,52,.55)'; X.beginPath(); X.ellipse(c[0] + R0 * .2, c[1] - R0 * .1, R0 * .18, R0 * .26, .4, 0, 6.2832); X.fill(); }
      }
      break;
    }
    case 'lantern': {
      const k = s; box(x - .3 * k, x + .3 * k, z - .3 * k, z + .3 * k, 0, .2 * k, '#A9A499');
      box(x - .1 * k, x + .1 * k, z - .1 * k, z + .1 * k, .2 * k, .9 * k, '#B3AEA2');
      box(x - .26 * k, x + .26 * k, z - .26 * k, z + .26 * k, .9 * k, 1.28 * k, '#E9E1C9');
      box(x - .45 * k, x + .45 * k, z - .45 * k, z + .45 * k, 1.28 * k, 1.42 * k, '#8E897F');
      sphere(x, 1.52 * k, z, .1 * k, '#8E897F'); break;
    }
    case 'fountain': {
      const r = e.r * Math.min(1, s * 1.2), wf = clamp(g * 1.4 - .25);
      if (!e.jetOnly) {
        fillGround(circ(x, z, r, 40), y0, shade(C.stone2, -.22));
        fillGround(circ(x, z, r, 40), y0 + .45, C.stone2, shade(C.stone2, -.3));
        if (wf > 0) { fillGround(circ(x, z, r * .82 * easeOut(wf), 40), y0 + .44, C.water); }
        box(x - .18, x + .18, z - .18, z + .18, y0, y0 + .9 * s, C.stone);
      }
      const jf = clamp(g * 2 - 1); if (jf <= 0) break;
      const jh = e.jh * jf, b = P3(x, y0 + .9, z), t = P3(x, y0 + .9 + jh, z);
      if (b && t) { X.strokeStyle = 'rgba(235,248,252,.85)'; X.lineWidth = Math.max(1.5, cam.F * .08 / depth(x, y0, z)); X.beginPath(); X.moveTo(b[0], b[1]); X.lineTo(t[0], t[1]); X.stroke(); }
      for (let d = 0; d < 8; d++) {
        const a = d / 8 * 6.2832;
        for (let k = 0; k < 6; k++) {
          const ph = (T * .9 + k / 6 + d * .13) % 1, rr = (e.r ? e.r * .6 : 1.4) * ph;
          sphere(x + Math.cos(a) * rr, y0 + .9 + jh + jh * .25 - jh * 1.25 * ph * ph, z + Math.sin(a) * rr, .07, '#E4F4F8');
        }
      }
      break;
    }
    case 'pavilion': {
      const k = s, c = '#A33B2E';
      box(x - 2 * k, x + 2 * k, z - 2 * k, z + 2 * k, 0, .35 * k, C.stone2, C.stone);
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(x + dx * 1.45 * k - .12, x + dx * 1.45 * k + .12, z + dz * 1.45 * k - .12, z + dz * 1.45 * k + .12, .35 * k, 2.7 * k, c);
      const ap = [x, 4.1 * k, z], cr = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => [x + dx * 2.35 * k, 3.05 * k, z + dz * 2.35 * k]);
      const mid = i => { const a = cr[i], b = cr[(i + 1) % 4]; return [(a[0] + b[0]) / 2, 2.72 * k, (a[2] + b[2]) / 2]; };
      const faces = [0, 1, 2, 3].map(i => [cr[i], mid(i), cr[(i + 1) % 4], ap]);
      faces.map(f => ({ f, d: depth(...mid(faces.indexOf(f))) })).sort((a, b) => b.d - a.d).forEach(o => face(o.f, '#46555A', [x, 2.6 * k, z]));
      sphere(x, 4.15 * k, z, .14 * k, C.gold); break;
    }
    case 'pergola': {
      const k = s, w = e.w / 2, d = e.d / 2, h = e.h * k, wd = '#9C7350';
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(x + dx * w - .1, x + dx * w + .1, z + dz * d - .1, z + dz * d + .1, 0, h, wd);
      for (const dz of [-1, 1]) box(x - w - .3, x + w + .3, z + dz * d - .09, z + dz * d + .09, h - .2, h, wd);
      for (let i = 0; i < 7; i++) { const xx = x - w + i * (2 * w / 6); box(xx - .06, xx + .06, z - d - .4, z + d + .4, h, h + .14, shade(wd, .12)); }
      const R = rng(9); for (let i = 0; i < 6; i++) sphere(x - w + R() * 2 * w, h + .2, z - d + R() * 2 * d, .5 * k, '#6F8F48');
      break;
    }
    case 'pot': {
      const k = s, h = (e.h || .7) * k, rb = (e.r || .35) * .72 * k, rt = (e.r || .35) * k;
      for (let i = 0; i <= 5; i++) disc(x, z, lerp(rb, rt, i / 5), y0 + h * i / 5, shade(C.terra, -.22 + i * .05), 14);
      disc(x, z, rt * .85, y0 + h + .01, '#6B4E36', 14);
      if (e.plant === 'lemon') { crown(x, y0 + h + .55 * k, z, .45 * k, '#4F7D3B', 2, 1, 4); sphere(x + .2 * k, y0 + h + .6 * k, z + .2 * k, .09 * k, '#F1D04A'); sphere(x - .15 * k, y0 + h + .75 * k, z + .1 * k, .09 * k, '#F1D04A'); }
      else if (e.plant) sphere(x, y0 + h + .25 * k, z, rt * 1.05, e.plant);
      break;
    }
    case 'bench': { const k = s, wd = '#9C7350'; box(x - .9 * k, x + .9 * k, z - .25, z + .25, .38 * k, .48 * k, wd); box(x - .9 * k, x + .9 * k, z + .2, z + .3, .48 * k, .95 * k, wd); break; }
    case 'box': box(e.x0, e.x1, e.z0, e.z1, y0, y0 + e.h * s, e.col, e.top); break;
    case 'palm': {
      const h = e.h * s, lean = e.lean || .6, top = [x + lean * s, y0 + h, z - lean * .3 * s];
      trunk([[x, y0, z], [x + lean * .3 * s, y0 + h * .5, z], top], .26, '#8B7158');
      const fr = [];
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * 6.2832 + (e.seed || 0), L = 2.5 * s, pts = [];
        for (let t = 0; t <= 1.001; t += .2) pts.push([top[0] + Math.cos(a) * L * t, top[1] + L * (.45 * t - 1.05 * t * t), top[2] + Math.sin(a) * L * t]);
        fr.push({ pts, d: depth(...pts[3]), c: i % 2 ? '#3E7A3A' : '#4E8E42' });
      }
      fr.sort((a, b) => b.d - a.d).forEach(f => { trunk(f.pts, .36 * s, f.c); trunk(f.pts, .05 * s, shade(f.c, .3)); });
      break;
    }
    case 'banana': {
      const k = s * (e.sc || 1), lv = [];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * 6.2832 + (e.seed || 0), dx = Math.cos(a), dz = Math.sin(a);
        const b = [x, y0 + .3 * k, z], tip = [x + dx * 1.9 * k, y0 + (1.6 + (i % 2) * .5) * k, z + dz * 1.9 * k];
        const m = [x + dx * 1.0 * k, y0 + 1.5 * k, z + dz * 1.0 * k], px = -dz * .55 * k, pz = dx * .55 * k;
        lv.push({ p: [b, [m[0] + px, m[1], m[2] + pz], tip, [m[0] - px, m[1], m[2] - pz]], d: depth(...m), c: i % 2 ? '#4C8E3A' : '#3D7A35', rib: [b, tip] });
      }
      lv.sort((a, b) => b.d - a.d).forEach(l => { if (pathW(l.p)) { X.fillStyle = l.c; X.fill(); } trunk(l.rib, .04 * k, shade(l.c, .35)); });
      break;
    }
    case 'willow': {
      const h = e.h * s, r = e.r * s;
      trunk([[x, 0, z], [x, h - r * .5, z]], .22);
      crown(x, h - r * .6, z, r, '#A3BF6E', 12, .8, 6);
      X.strokeStyle = 'rgba(140,170,90,.9)'; X.lineWidth = Math.max(1, cam.F * .05 / depth(x, h, z));
      for (let i = 0; i < 14; i++) { const a = i / 14 * 6.2832, p1 = P3(x + Math.cos(a) * r * .9, h - r * .7, z + Math.sin(a) * r * .9), p2 = P3(x + Math.cos(a) * r * 1.05, h - r * 1.9, z + Math.sin(a) * r * 1.05); if (p1 && p2) { X.beginPath(); X.moveTo(p1[0], p1[1]); X.lineTo(p2[0], p2[1]); X.stroke(); } }
      break;
    }
    case 'bamboo': {
      const R = rng(e.seed || 5), it = [];
      for (let i = 0; i < 9; i++) {
        const bx = x + (R() - .5) * 1.4, bz = z + (R() - .5) * 1.4, hh = e.h * s * (.75 + R() * .25), tx = bx + (R() - .5) * .8, tz = bz + (R() - .5) * .8;
        trunk([[bx, 0, bz], [tx, hh, tz]], .08, '#7E9B4A');
        for (let j = 0; j < 3; j++) it.push([lerp(bx, tx, .55 + j * .2) + (R() - .5) * .4, hh * (.55 + j * .2), lerp(bz, tz, .55 + j * .2), .4 * s, '#8DB55A']);
      }
      sortDraw(it); break;
    }
    case 'pine': {
      const h = e.h * s, r = e.r * s;
      trunk([[x, 0, z], [x + .5 * s, h * .45, z - .2], [x - .3 * s, h * .8, z + .1]], .2, '#5E4A3A');
      const pads = [[x + .9 * s, h * .48, z + .3 * s, r * .55], [x - .7 * s, h * .7, z - .2 * s, r * .5], [x - .2 * s, h * .92, z + .1 * s, r * .42], [x + .5 * s, h * .82, z - .6 * s, r * .3]];
      pads.map(p => ({ p, d: depth(p[0], p[1], p[2]) })).sort((a, b) => b.d - a.d).forEach(({ p }) => {
        fillGround(blob(p[0], p[2], p[3], p[3] * .8, 7, .12, 18), p[1] - .25 * s, '#2C4F33');
        fillGround(blob(p[0], p[2], p[3], p[3] * .8, 7, .12, 18), p[1], '#3F6A43');
      });
      break;
    }
    case 'house': house(); break;
    case 'wall': box(e.x0, e.x1, e.z0, e.z1, 0, e.h, e.col, e.top || shade(e.col, .12)); break;
  }
}
function house() {
  const wc = '#F5EFE4', rc = '#56645A';
  box(-6, 6, -12.5, -8, 0, 4.2, wc);
  if (cam.pos[2] > -8 && cam.pitch < 1.45) {
    const zf = -7.97, q = (x0, x1, y0, y1, c) => { if (pathW([[x0, y0, zf], [x1, y0, zf], [x1, y1, zf], [x0, y1, zf]])) { X.fillStyle = c; X.fill(); X.strokeStyle = '#FFFFFF'; X.lineWidth = 2; X.stroke(); } };
    for (const cx of [-4.3, -2.3, 2.3, 4.3]) q(cx - .6, cx + .6, 1.4, 2.9, '#4A626B');
    q(-.75, .75, 0, 2.5, '#6B5240');
  }
  const e = [[-6.5, 4.2, -13], [6.5, 4.2, -13], [6.5, 4.2, -7.5], [-6.5, 4.2, -7.5]], rA = [-4, 6.3, -10.25], rB = [4, 6.3, -10.25], ref = [0, 4.6, -10.25];
  face([e[3], e[2], rB, rA], rc, ref); face([e[0], e[1], rB, rA], rc, ref); face([e[0], e[3], rA], rc, ref); face([e[1], e[2], rB], rc, ref);
  const a = P3(...rA), b = P3(...rB); if (a && b) { X.strokeStyle = shade(rc, .25); X.lineWidth = 2; X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.stroke(); }
}
function wallItems(w) {
  const out = [], h = w.h, col = w.col, add = (x0, x1, z0, z1) => out.push({ k: 'v', type: 'wall', x: (x0 + x1) / 2, z: (z0 + z1) / 2, x0, x1, z0, z1, h, col, at: -1 });
  for (let z = -8; z < 12; z += 2.5) { const z1 = Math.min(z + 2.5, 12.15); add(-10.15, -9.85, z, z1); add(9.85, 10.15, z, z1); }
  for (let x = -10.15; x < -1.6; x += 2.9) add(x, Math.min(x + 2.9, -1.6), 11.85, 12.15);
  for (let x = 1.6; x < 10.15; x += 2.9) add(x, Math.min(x + 2.9, 10.15), 11.85, 12.15);
  out.push({ k: 'v', type: 'box', x: -1.75, z: 12, x0: -1.95, x1: -1.45, z0: 11.75, z1: 12.25, h: h + .45, col: shade(col, -.1), at: -1 });
  out.push({ k: 'v', type: 'box', x: 1.75, z: 12, x0: 1.45, x1: 1.95, z0: 11.75, z1: 12.25, h: h + .45, col: shade(col, -.1), at: -1 });
  return out;
}

// ---------- uslub elementlari konstruktorlari ----------
const poly = (pts, fill, at, o = {}) => ({ k: 'poly', pts, fill, at, d: .55, ...o });
const water = (pts, at, o = {}) => ({ k: 'poly', pts, fill: C.water, water: 1, at, d: .8, ...o });
const rib = (pts, w, fill, at, o = {}) => ({ k: 'rib', pts, w, fill, at, d: .8, edge: 1, ...o });
const wrib = (pts, w, at, o = {}) => rib(pts, w, C.water, at, { water: 1, ...o });
const hedge = (pts, w, h, at, o = {}) => ({ k: 'hedge', pts, w, h, col: C.hedge, at, d: .7, ...o });
const line = (pts, col, wm, at, o = {}) => ({ k: 'line', pts, col, wm, at, d: .5, ...o });
const guide = (pts, at) => ({ k: 'guide', pts, at, d: .6 });
const tiles = (x0, x1, z0, z1, step, col, at, o = {}) => ({ k: 'tiles', x0, x1, z0, z1, step, col, at, d: .5, ...o });
const slab = (x0, x1, z0, z1, h, top, side, at, o = {}) => ({ k: 'slab', x0, x1, z0, z1, h, top, side, at, d: .55, ...o });
const V = (type, x, z, at, o = {}) => ({ k: 'v', type, x, z, at, d: .6, ...o });

function buildStyles() {
  const S = [];
  // 1. Klassik — regular
  {
    const els = [guide([[0, 11.6], [0, -7.6]], .2), rib([[0, 12], [0, -8]], 2.2, C.stone, .3, { d: .75 }), rib([[-10, 2], [10, 2]], 1.8, C.stone, .6, { d: .6 })];
    let k = 0;
    for (const sx of [-1, 1]) for (const [z0, z1] of [[-7, .8], [3.2, 11]]) {
      const x0 = Math.min(sx * 1.7, sx * 8.8), x1 = Math.max(sx * 1.7, sx * 8.8), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      els.push(hedge(closedRect(x0, x1, z0, z1), .45, .55, .95 + k * .08));
      els.push(poly(circ(cx, cz, 1.35), '#D9C9A8', 1.05 + k * .08));
      els.push(hedge(circClosed(cx, cz, 1.5), .35, .45, 1.15 + k * .08));
      els.push(V('ball', cx, cz, 1.55 + k * .06, { r: .85 }));
      for (const zz of [z0 + .8, z1 - .8]) els.push(V('cone', sx * 2.5, zz, 1.35 + k * .06, { r: .6, h: 2.4 }));
      k++;
    }
    els.push(V('fountain', 0, 2, .8, { r: 2.0, jh: 1.7, d: 1.1 }));
    for (const sx of [-1, 1]) for (const z of [-5.6, -1.6, 5, 8.8]) els.push(V('round', sx * 9.05, z, 1.6 + (z + 6) * .02, { r: .95, h: 3.6, col: '#3E6B3B', seed: (z * 7 + sx * 3) | 0 }));
    S.push({ name: 'Klassik (regular)', short: 'Klassik', desc: 'Simmetriya, to‘g‘ri yo‘laklar va geometrik shakllar.', base: C.lawn, trans: 'path', els,
      calls: [{ p: [0, .1, -4.6], t: 'Simmetriya o‘qi' }, { p: [5.25, .55, -3.1], t: 'Geometrik gazon' }] });
  }
  // 2. Ingliz peyzaj
  {
    const path = smooth([[.3, 12], [2.6, 8.5], [1.8, 4.6], [-2.6, 1.6], [-3.6, -2.6], [-1.2, -6], [0, -8]], 10);
    const els = [rib(path, 1.5, '#E2D2AE', .3, { d: 1.05 }),
      poly(blob(5.4, .4, 3.3, 2.4, 11, .15), '#77A052', .8), water(blob(5.4, .4, 2.9, 2.0, 11, .15), .95, { d: .9 }),
      V('round', -7.3, -4.6, 1.2, { r: 2.2, h: 6.4, col: '#3C6A39', seed: 1 }), V('round', -8.4, -.8, 1.35, { r: 1.5, h: 4.8, col: '#5A8442', seed: 2 }),
      V('round', -5.6, -6.6, 1.45, { r: 1.25, h: 4.2, col: '#6E9448', seed: 3 }), V('round', 7.2, 7.6, 1.3, { r: 2.3, h: 6.2, col: '#2F5A35', seed: 4 }),
      V('round', 8.6, 4.2, 1.5, { r: 1.4, h: 4.4, col: '#6C9046', seed: 5 }), V('round', 5.4, 10.3, 1.6, { r: 1.2, h: 3.8, col: '#4C7B3E', seed: 6 }),
      V('round', 7.4, -5.6, 1.4, { r: 1.8, h: 5.4, col: '#46753D', seed: 7 }), V('round', -6.2, 7.6, 1.5, { r: 2.0, h: 5.8, col: '#3A6638', seed: 8 })];
    [[-9, 3.8, .7], [-8.8, 10.6, .8], [3.6, -6.9, .7], [9.1, 1.4, .6], [-3.4, 10.8, .6], [2.8, -3, .5], [-9.1, -7, .6]].forEach(([x, z, r], i) => els.push(V('shrub', x, z, 1.7 + i * .05, { r, col: i % 2 ? '#55803F' : '#6A9147' })));
    [[3, 1.6], [3.4, -.6], [7.8, 2.2], [8.2, -1.2]].forEach(([x, z], i) => els.push(V('flower', x, z, 1.9 + i * .04, { col: ['#F1E7D0', '#D98AA0'][i % 2], r: .3 })));
    S.push({ name: 'Ingliz peyzaj', short: 'Ingliz', desc: 'Egri yo‘laklar, keng maysazor va tabiiy daraxt guruhlari.', base: '#8DB462', trans: 'path', els,
      calls: [{ p: [-2.6, .1, 1.6], t: 'Egri yo‘lak' }, { p: [-7.3, 5.3, -4.6], t: 'Daraxt guruhlari' }] });
  }
  // 3. Fransuz
  {
    const els = [guide([[0, 11.6], [0, -7.6]], .2), rib([[0, 12], [0, -8]], 2.8, '#F1EADA', .3, { d: .7 }), rib([[-10, .3], [10, .3]], 1.6, '#F1EADA', .5, { d: .6 }),
      poly(rect(-1.25, 1.25, 3.4, 10.2), C.stone2, .7), water(rect(-.95, .95, 3.7, 9.9), .85, { d: .8 }), V('fountain', 0, -3.6, .8, { r: 1.5, jh: 1.6, d: 1 })];
    let k = 0;
    for (const [x0, x1] of [[-8.2, -2.0], [2.0, 8.2]]) for (const [z0, z1] of [[-7.2, -.7], [1.3, 10.8]]) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, at = .9 + k * .1;
      els.push(poly(rect(x0, x1, z0, z1), '#D9BD98', at, { anim: 'fade' }));
      els.push(hedge(closedRect(x0, x1, z0, z1), .35, .5, at + .1));
      els.push(hedge(ellClosed(cx, cz, w * .2, d * .17), .3, .4, at + .25));
      els.push(poly(ell(cx, cz, w * .11, d * .09), '#B8503D', at + .45));
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
        els.push(hedge(smooth([[cx + sx * w * .4, cz + sz * d * .42], [cx + sx * w * .38, cz + sz * d * .14], [cx + sx * w * .17, cz + sz * d * .3], [cx + sx * w * .07, cz + sz * d * .41]], 6), .26, .38, at + .35));
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) els.push(V('cone', cx + sx * (w / 2), cz + sz * (d / 2), 1.45 + k * .05, { r: .55, h: 2.6 }));
      k++;
    }
    for (const sx of [-1, 1]) for (let z = -6.6; z < 11; z += 2.3) els.push(V('ball', sx * 9.15, z, 1.7 + (z + 7) * .015, { r: .72, col: '#355F38', y0: .4 }));
    S.push({ name: 'Fransuz', short: 'Fransuz', desc: 'Regular uslubning tarixiy ko‘rinishi: bezakli parterlar, kesilgan butalar, markaziy o‘q.', base: '#E8DFCB', trans: 'tree', els,
      calls: [{ p: [-5.1, .4, -4], t: 'Parter naqshi' }, { p: [0, .1, 6.8], t: 'Markaziy o‘q' }] });
  }
  // 4. Italyan
  {
    const sT = '#DCCBA8', sS = '#B49B74';
    const els = [slab(-9.85, 9.85, -8, -3, 1.6, sT, sS, .3), slab(-9.85, 9.85, -3, 3, .8, '#8FB165', sS, .5),
      slab(-1.5, 1.5, -3, -2.55, 1.4, sT, sS, .75), slab(-1.5, 1.5, -2.55, -2.1, 1.2, sT, sS, .8), slab(-1.5, 1.5, -2.1, -1.65, 1.0, sT, sS, .85),
      slab(-1.5, 1.5, 3, 3.45, .6, sT, sS, .8), slab(-1.5, 1.5, 3.45, 3.9, .4, sT, sS, .85), slab(-1.5, 1.5, 3.9, 4.35, .2, sT, sS, .9),
      tiles(-9.8, 9.8, -8, -3, 1.25, 'rgba(150,128,96,.45)', .6, { y: 1.6 }),
      rib([[0, -1.65], [0, 3]], 2.4, C.stone, .95, { y: .8, layer: 2, d: .4 }), rib([[0, 4.35], [0, 12]], 2.4, C.stone, .95, { d: .5 }),
      V('fountain', 0, .6, 1.0, { r: 1.5, jh: 1.4, y0: .8, d: 1 }), V('fountain', 0, 8.2, 1.15, { r: 1.9, jh: 1.9, d: 1 })];
    for (let x = -9.85; x < 9.8; x += 2.05) { if (Math.abs(x + 1.02) < 1.6) continue; els.push(V('box', x + 1.02, -3.08, .9, { x0: x, x1: Math.min(x + 2.05, 9.85), z0: -3.2, z1: -2.96, h: .55, col: '#EADFC6', y0: 1.6 })); }
    for (const sx of [-1, 1]) {
      els.push(V('cypress', sx * 8.6, -5.6, 1.4, { r: .75, h: 6.2, y0: 1.6 }), V('cypress', sx * 8.6, 0, 1.5, { r: .7, h: 5.6, y0: .8 }), V('cypress', sx * 7.9, 6.4, 1.6, { r: .7, h: 5.4 }), V('cypress', sx * 7.9, 10.4, 1.7, { r: .65, h: 5 }));
      for (const px of [3, 5.6]) els.push(V('pot', sx * px, 2.4, 1.8, { y0: .8, plant: 'lemon' }));
      els.push(V('pot', sx * 3.6, -4, 1.85, { y0: 1.6, plant: '#5E8A47' }));
    }
    S.push({ name: 'Italyan', short: 'Italyan', desc: 'Terrasalar, zinapoyalar, tosh devorlar va favvoralar.', base: C.lawn, trans: 'water', els,
      calls: [{ p: [6.2, 1.6, -3], t: 'Terrasa va tosh devor' }, { p: [0, 1.2, 8.2], t: 'Favvora' }] });
  }
  // 5. Islomiy — chorbog'
  {
    const els = [rib([[0, 12], [0, -8]], 3.0, C.stone, .3, { d: .7 }), rib([[-10, 2], [10, 2]], 3.0, C.stone, .45, { d: .6 }),
      poly(octa(0, 2, 2.7), C.stone2, .6), water(octa(0, 2, 2.2), .75, { d: .5 }),
      wrib([[0, 4.25], [0, 11.8]], .8, 1.0, { d: .9 }), wrib([[0, -.25], [0, -7.85]], .8, 1.0, { d: .9 }), wrib([[2.25, 2], [9.8, 2]], .8, 1.0, { d: .9 }), wrib([[-2.25, 2], [-9.8, 2]], .8, 1.0, { d: .9 }),
      V('fountain', 0, 2, 1.2, { r: 0, jh: 1.5, jetOnly: 1, d: 1 })];
    let k = 0;
    for (const sx of [-1, 1]) for (const cz of [-3, 7.25]) {
      const cx = sx * 5.75;
      for (const dx of [-2, 2]) for (const dz of [-2, 2]) {
        const back = cz < 0;
        els.push(V(back ? 'round' : 'fruit', cx + dx, cz + dz, 1.3 + k * .03, back ? { r: 1.55, h: 5, col: '#2F5D36', seed: k + 1 } : { r: 1.1, h: 3.3, col: '#4F7D3E', seed: k + 1, fruit: '#C8392B' }));
        k++;
      }
      for (let i = 0; i < 6; i++) els.push(V('flower', sx * 1.95, cz - 3.5 + i * 1.4, 1.8 + i * .03, { col: i % 2 ? '#D84A62' : '#F2D0D6', r: .26 }));
    }
    S.push({ name: 'Islomiy · chorbog‘', short: 'Chorbog‘', desc: 'To‘rt qismli kompozitsiya, suv yo‘llari, soya va ichki hovli.', note: 'Chorbog‘ — islomiy bog‘ shakllaridan biri, yagonasi emas',
      base: '#86AD5E', wall: { h: 1.9, col: '#D8C5A2' }, trans: 'water', els,
      calls: [{ p: [0, .1, 8], t: 'Suv yo‘llari' }, { p: [5.75, 3.6, -3], t: 'To‘rt qism va soya' }] });
  }
  // 6. Yapon
  {
    const sp = smooth([[0, 11.4], [1.2, 9], [.3, 6.5], [1.4, 4], [-.2, 1.2], [.3, -2], [-1, -5], [0, -7.3]], 8);
    const els = [poly(blob(-7.5, -5, 2.4, 1.8, 3), '#6F8F4C', .35, { anim: 'fade' }), poly(blob(7.4, 8.8, 2.4, 2.6, 4), '#6F8F4C', .4, { anim: 'fade' }), poly(blob(-7.8, 9.2, 1.8, 1.6, 6), '#78965A', .45, { anim: 'fade' }),
      poly(blob(-4.2, 4, 3.8, 2.7, 21, .2), '#A3A79A', .55), water(blob(-4.2, 4, 3.35, 2.25, 21, .2), .75, { fill: '#5B97A6', d: 1 })];
    [1.9, 2.5, 3.1].forEach((r, i) => els.push(line(circClosed(4, -2, r, 48), '#CBC1AB', .07, .85 + i * .1)));
    for (let z = 2.2; z < 7.4; z += .55) els.push(line([[2.6, z], [9.4, z]], '#CFC6B1', .06, 1.0 + (z - 2) * .04));
    samplePath(sp, 1.05).forEach((p, i) => els.push(poly(blob(p[0] + (i % 2 ? .25 : -.25), p[1], .45, .38, i + 30, .12, 16), '#B8B1A2', .3 + i * .06, { d: .3 })));
    els.push(V('rock', 4, -2, 1.1, { r: 1.0 }), V('rock', 4.9, -1.3, 1.2, { r: .6 }), V('rock', 3.3, -2.8, 1.25, { r: .45 }), V('rock', -1.6, 5.6, 1.3, { r: .55 }), V('rock', -7.2, 2.6, 1.35, { r: .7 }),
      V('maple', -6.8, -4.8, 1.4, { r: 1.7, h: 4.3 }), V('pine', 7.2, 8, 1.5, { r: 2.2, h: 4.2 }), V('lantern', -1.4, 2.3, 1.7),
      V('ball', -7.4, 6.8, 1.8, { r: .6, col: '#4C7A3F' }), V('ball', -1.5, 7.2, 1.85, { r: .5, col: '#567F43' }), V('ball', 8.3, -6.4, 1.9, { r: .7, col: '#4C7A3F' }), V('ball', 6.6, -6.9, 1.95, { r: .5, col: '#5D8746' }));
    S.push({ name: 'Yapon', short: 'Yapon', desc: 'Tosh, suv, bo‘shliq va puxta muvozanat.', base: '#E9E4D8', wall: { h: 1.2, col: '#CFC3A8' }, trans: 'tree', els,
      calls: [{ p: [6, 0, 4.6], t: 'Bo‘shliq' }, { p: [-4.2, .2, 4], t: 'Tosh va suv' }] });
  }
  // 7. Xitoy
  {
    const els = [rib(smooth([[.3, 12], [-1.4, 9.6], [-2.4, 7.4]], 6), 1.2, C.stone, .3, { d: .5 }), rib([[.2, -2.4], [.7, -5], [0, -8]], 1.2, C.stone, .45, { d: .4 }),
      poly(blob(.6, 2.3, 6.7, 4.4, 31, .16), '#A9A79B', .4), water(blob(.6, 2.3, 6.1, 3.9, 31, .16), .6, { fill: '#5E9CA8', d: 1.1 }),
      rib([[-2.4, 7.4], [-.6, 5.5], [-2.2, 3.7], [-.2, 1.8], [-1.6, 0], [.2, -2.4]], 1.0, '#B24A3A', 1.1, { y: .32, layer: 2, d: .8 })];
    [[3.2, 4.6], [4.2, 3.8], [2.6, 5.4], [-3.8, 2.4], [-4.6, 3.4]].forEach(([x, z], i) => els.push(poly(circ(x, z, .4, 14), '#5E8F4A', 1.4 + i * .06, { d: .3 })));
    els.push(V('pavilion', 4.8, -1.4, 1.3), V('tallrock', -5.4, -3.6, 1.4, { h: 3.2, r: .9 }), V('tallrock', -7.7, 2.6, 1.5, { h: 2.2, r: .7 }), V('rock', -4.4, -2.3, 1.55, { r: .6 }), V('tallrock', 7.8, 7.3, 1.6, { h: 2.6, r: .8 }),
      V('willow', -6.4, 8, 1.65, { r: 2, h: 5 }), V('bamboo', 8.4, 10.2, 1.7, { h: 5.5 }), V('bamboo', -8.7, -6.8, 1.75, { h: 5 }), V('round', 8, -5.8, 1.6, { r: 1.6, h: 5, col: '#355F3A', seed: 9 }));
    for (const [x0, x1] of [[-9.85, -6.6], [-5, -3.2]]) for (let x = x0; x < x1 - .01; x += 1.7) els.push(V('box', (x + Math.min(x + 1.7, x1)) / 2, -6, .5, { x0: x, x1: Math.min(x + 1.7, x1), z0: -6.15, z1: -5.85, h: 1.7, col: '#F1EEE7', top: '#3F4A4E', d: .5 }));
    S.push({ name: 'Xitoy', short: 'Xitoy', desc: 'Hovuz, qoyatosh, pavilon va ketma-ket ochiladigan manzaralar.', base: '#86A962', wall: { h: 1.7, col: '#F1EEE7' }, trans: 'water', els,
      calls: [{ p: [4.8, 3.6, -1.4], t: 'Pavilon' }, { p: [-5.4, 2.6, -3.6], t: 'Qoyatosh' }] });
  }
  // 8. O'rta yer dengizi
  {
    const els = [poly(rect(-8, 8, -8, -4), '#DCC7A1', .25, { anim: 'fade' }), tiles(-8, 8, -8, -4, 1, 'rgba(160,135,95,.5)', .4),
      rib([[0, 12], [.6, 7], [-.4, 2], [0, -4]], 1.8, '#D6C19B', .4, { d: .7 }), poly(rect(-8.9, -2.1, 0, 10.8), '#C9B590', .6, { anim: 'fade' })];
    let k = 0;
    for (let z = .7; z < 10.6; z += 1.45) for (let x = -8.3; x < -2.4; x += .74) { els.push(V('flower', x, z, .95 + k * .012, { r: .4, y: .3, col: (k % 5) ? '#8E7DBA' : '#A596CC', d: .4 })); k++; }
    els.push(V('olive', 5.4, 2.4, 1.3, { r: 1.7, h: 3.8 }), V('olive', 7.8, 7, 1.45, { r: 1.5, h: 3.4 }), V('olive', 4.4, 9.4, 1.6, { r: 1.2, h: 3.0 }),
      V('pergola', -5, -6, 1.2, { w: 4.6, d: 3.0, h: 2.6 }), V('cypress', -2.4, 11.1, 1.7, { r: .6, h: 5 }), V('cypress', 2.4, 11.1, 1.75, { r: .6, h: 5 }), V('cypress', 9.1, -6.6, 1.8, { r: .65, h: 5.5 }));
    [[2.6, -3.4, .45, '#5E8A47'], [3.5, -3.6, .32, '#E46E8C'], [3.1, -2.7, .28, '#E46E8C'], [-1.6, -3.5, .4, '#6E8A5A'], [-2.4, -3.1, .28, '#E46E8C'], [9.2, -1.2, .4, '#5E8A47'], [9.2, 1.3, .36, '#E46E8C'], [1.5, 10.6, .4, '#E46E8C'], [-1.5, 10.6, .4, '#5E8A47']]
      .forEach(([x, z, r, p], i) => els.push(V('pot', x, z, 1.5 + i * .06, { r, h: r * 2, plant: p })));
    [[2.4, 4.2], [2.6, 6.2], [-1.8, 6], [2.2, 1.4]].forEach(([x, z], i) => els.push(V('shrub', x, z, 1.9 + i * .04, { r: .5, col: '#6E8A5A' })));
    S.push({ name: 'O‘rta yer dengizi', short: 'O‘rta yer', desc: 'Terrakota tuvaklar, tosh yo‘laklar va xushbo‘y o‘simliklar.', base: '#E8D9BA', wall: { h: 1.0, col: '#EFE3CB' }, trans: 'path', els,
      calls: [{ p: [3.1, .9, -3.3], t: 'Terrakota tuvaklar' }, { p: [-5.5, .4, 5.2], t: 'Lavanda, rozmarin' }] });
  }
  // 9. Rustik — qishloq
  {
    const path = smooth([[0, 12], [-1.6, 8.6], [.8, 4.6], [-.6, .6], [.6, -3.4], [0, -8]], 10);
    const els = [rib(path, 1.3, '#C9AD84', .3, { d: 1 }), poly(blob(-6, 7.6, 3, 2.6, 5), '#A4BE74', .6, { anim: 'fade' })];
    [[-5.6, -4.2], [-1.8, -.4]].forEach(([z0, z1], i) => {
      els.push(slab(-8.8, -4.4, z0, z1, .45, '#6E5236', '#A57A4E', .55 + i * .12));
      for (let x = -8.3; x < -4.6; x += .6) els.push(V('shrub', x, (z0 + z1) / 2, 1.0 + i * .1 + x * -.005, { r: .28, col: i ? '#7FB04B' : '#5F9A44', y0: .45, d: .4 }));
    });
    [[4.8, -4.6, 0], [8.2, -1.4, 1], [4.6, 1.8, 0], [8.3, 5.2, 1], [5, 8.6, 0]].forEach(([x, z, f], i) => els.push(V('fruit', x, z, 1.25 + i * .1, { r: 1.4, h: 3.6, col: '#4E7F3C', seed: i + 11, fruit: FRUIT[f] })));
    const fc = ['#E26D8A', '#F2C14E', '#FBF8F1', '#B565A7', '#F08A4B'];
    samplePath(path, .9).forEach((p, i) => { const n = [-p[2][1], p[2][0]]; for (const sd of [-1, 1]) els.push(V('flower', p[0] + n[0] * sd * 1.05, p[1] + n[1] * sd * 1.05, .7 + i * .045, { col: fc[(i * 2 + (sd > 0)) % 5], r: .24, d: .35 })); });
    const R = rng(77); for (let i = 0; i < 26; i++) { const a = R() * 6.28, rr = Math.sqrt(R()); els.push(V('flower', -6 + Math.cos(a) * rr * 2.6, 7.6 + Math.sin(a) * rr * 2.2, 1.5 + i * .02, { col: fc[i % 5], r: .26, y: .4, stem: 1, d: .35 })); }
    els.push(V('bench', 6.6, 10.6, 1.9));
    S.push({ name: 'Rustik · qishloq', short: 'Rustik', desc: 'Tabiiy materiallar, gullar va mevali daraxtlar.', base: '#93B566', wall: { h: 1.0, col: '#9C7450' }, trans: 'tree', els,
      calls: [{ p: [8.2, 3.2, -1.4], t: 'Mevali daraxtlar' }, { p: [-6, .4, 7.6], t: 'Gulzor' }] });
  }
  // 10. Zamonaviy minimalist
  {
    const els = [poly(rect(-9.85, 9.85, -8, -4.6), '#ECE9E2', .25, { anim: 'fade', stroke: 1 })];
    let k = 0; for (let z = 11.1; z > -4.4; z -= 1.75) { els.push(poly(rect(-1.5, 1.5, z - .5, z + .5), '#E9E6DF', .35 + k * .07, { d: .35, stroke: 1 })); k++; }
    els.push(poly(rect(2.6, 8.6, -3.6, .4), '#3F4744', .6), water(rect(2.9, 8.3, -3.3, .1), .8, { fill: '#6A97A2' }),
      slab(-8.6, -3, -.3, .7, .45, '#55604F', '#8D918A', .7));
    for (let x = -8.2; x < -3.2; x += .55) els.push(V('tuft', x, .2, 1.1 + (x + 8) * .03, { y0: .45, h: 1.1, col: '#B5AE80', seedc: '#DCD2A4', d: .4 }));
    els.push(V('multi', -6.2, 6.4, 1.4, { r: 1.6, h: 4.8 }), V('multi', 6.2, 4.6, 1.55, { r: 1.5, h: 4.5, seed: 6 }), V('multi', 6.8, 9.6, 1.7, { r: 1.3, h: 4.1, seed: 8 }),
      V('box', -5.5, -5.9, 1.8, { x0: -7.6, x1: -3.4, z0: -6.2, z1: -5.6, h: .45, col: '#D8D4CC' }));
    S.push({ name: 'Zamonaviy minimalist', short: 'Minimalist', desc: 'Sodda geometriya, kam turdagi o‘simlik va ochiq maydon.', base: '#8FB367', wall: { h: 1.6, col: '#6A6D68' }, trans: 'path', els,
      calls: [{ p: [-4.6, 0, 8.8], t: 'Ochiq maydon' }, { p: [5.6, 0, -1.6], t: 'Sodda geometriya' }] });
  }
  // 11. Naturalistik
  {
    const els = [rib(smooth([[0, 12], [2.2, 8.4], [-1, 4.4], [1.6, .4], [-.6, -4], [0, -8]], 10), 1.5, '#B6CB88', .3, { d: 1 })];
    const drifts = [[-6.4, -5, 3, 2.3, '#CDBA86', 'g'], [-7, 1.2, 2.5, 2.5, '#A891BF', '#8E6FB5'], [-5.8, 7.6, 3.1, 2.5, '#CCB173', 'g'], [5.6, -4.8, 3.1, 2.3, '#CDAA60', '#D99A3A'],
      [6.4, 1.8, 2.8, 2.3, '#C4BEA0', 'g'], [5.9, 8.3, 3, 2.6, '#A891BF', '#9273B8'], [2.8, -6.6, 1.6, 1.1, '#D9A3B0', '#E08FA3'], [-2.8, 10.6, 1.4, 1.1, '#D9A3B0', '#D47D96']];
    drifts.forEach(([x, z, rx, rz, col, kind], i) => {
      const at = .55 + i * .07;
      els.push(poly(blob(x, z, rx, rz, 40 + i), col, at, { anim: 'fade' }));
      const R = rng(i + 50);
      for (let j = 0; j < 15; j++) {
        const a = R() * 6.28, rr = Math.sqrt(R()) * .85, px = x + Math.cos(a) * rx * rr, pz = z + Math.sin(a) * rz * rr;
        if (kind === 'g' || j % 3 === 0) els.push(V('tuft', px, pz, at + .5 + j * .04, { h: 1 + R() * .6, col: '#BCAA73', seedc: '#E8D9A8', d: .45 }));
        else els.push(V('flower', px, pz, at + .5 + j * .04, { col: kind, r: .2, y: .7 + R() * .3, stem: 1, d: .45 }));
      }
    });
    els.push(V('multi', -8, -6.8, 1.3, { r: 1.4, h: 5, col: '#A4C075' }), V('round', 8.2, -6.9, 1.4, { r: 1.5, h: 5, col: '#5A8446', seed: 3 }));
    S.push({ name: 'Naturalistik', short: 'Naturalistik', desc: 'Boshoqli o‘tlar va ko‘p yillik o‘simliklarning tabiiy qatlamlari.', base: '#9BB16E', wall: { h: 1.0, col: '#D7CBB2' }, trans: 'tree', els,
      calls: [{ p: [-5.8, 1, 7.6], t: 'Boshoqli o‘tlar' }, { p: [5.9, .9, 8.3], t: 'Ko‘p yillik gullar' }] });
  }
  // 12. Tropik
  {
    const els = [poly(rect(-6.5, 6.5, -8, -4.8), '#B8875B', .25, { anim: 'fade' }), tiles(-6.5, 6.5, -8, -4.8, .55, 'rgba(110,75,45,.45)', .4, { dir: 'z' }),
      poly(rect(-3.4, 4.4, -4.2, -.2), '#EDE6D8', .45), water(rect(-3, 4, -3.8, -.6), .6, { fill: '#5CC2CB' }),
      poly(blob(-8.2, 2.5, 1.9, 9.6, 61, .1), '#4C7B3C', .5, { anim: 'fade' }), poly(blob(8.2, 3, 1.9, 9.4, 62, .1), '#4C7B3C', .55, { anim: 'fade' })];
    let k = 0; for (let z = 11.2; z > .6; z -= 1.3) { els.push(poly(rect(-.7, .7, z - .35, z + .35), '#D9D2C3', .3 + k * .05, { d: .3 })); k++; }
    els.push(V('palm', -8.4, -6.4, 1.2, { h: 6.5, lean: .7 }), V('palm', 8.4, -6.6, 1.3, { h: 7, lean: -.8, seed: .3 }), V('palm', -8.6, 4.6, 1.4, { h: 6, lean: .6, seed: .6 }), V('palm', 8.6, 8.8, 1.5, { h: 6.6, lean: -.6, seed: .2 }), V('palm', 6.8, 2.4, 1.6, { h: 5, lean: -.5, seed: .9 }),
      V('banana', -7, 1, 1.5, { seed: .2 }), V('banana', -7.4, 8.8, 1.6, { seed: .5 }), V('banana', 7.6, -2.6, 1.65, { seed: .1 }), V('banana', 5.6, 7, 1.7, { seed: .7, sc: .9 }), V('banana', -8.6, -2.6, 1.75, { seed: .4, sc: .85 }));
    [[-9, -4, .9], [-8.9, 6.8, .8], [9, -4.2, .9], [9.1, 5.6, .8], [-9, 10.6, .9], [9, 10.9, .8], [-6.4, -3.2, .7], [7, -.4, .7], [-6.2, 5.2, .7], [6.8, 10.8, .7]]
      .forEach(([x, z, r], i) => els.push(V('shrub', x, z, 1.8 + i * .03, { r, col: i % 2 ? '#2E6B3A' : '#3B7A3F' })));
    [[-6.6, 3.2, '#E2543F'], [-6, -3.8, '#F08A2B'], [6.4, 5.4, '#E2543F'], [6.2, -2, '#F08A2B'], [-7.8, 11, '#E2543F'], [7.6, 11.3, '#F08A2B']]
      .forEach(([x, z, c], i) => els.push(V('flower', x, z, 2.0 + i * .03, { col: c, r: .28, y: .9, stem: 1 })));
    S.push({ name: 'Tropik', short: 'Tropik', desc: 'Yirik barglar, zich yashillik va qatlamli ekish.', note: 'Vizual yo‘nalish: hovlida qishga chidamli o‘simliklar va tuvaklar bilan moslanadi',
      base: '#6E9D4D', wall: { h: 1.6, col: '#E9E2D2' }, trans: 'tree', els,
      calls: [{ p: [-7, 1.8, 1], t: 'Yirik barglar' }, { p: [8.2, 2.2, 4.6], t: 'Qatlamli ekish' }] });
  }
  S.forEach(st => { st.wall = st.wall || { h: .9, col: C.wall }; st.walls = wallItems(st.wall); });
  return S;
}
const S = buildStyles();
const EMPTY = { base: '#C9BF9B', els: [], wall: { h: .9, col: C.wall } }; EMPTY.walls = wallItems(EMPTY.wall);

// ---------- sahna renderi ----------
const growth = (e, lt) => e.at < 0 ? 1 : clamp((lt - e.at) / e.d);
function renderScene(st, lt, cm, planAmt, T, vw = W, vh = H) {
  cam = cm;
  X.fillStyle = C.paper; X.fillRect(0, 0, vw, vh);
  if (planAmt < 1) {
    const g = X.createLinearGradient(0, 0, 0, vh); g.addColorStop(0, '#E4EBE2'); g.addColorStop(.5, '#F2EDE2'); g.addColorStop(1, '#ECE2CF');
    X.globalAlpha = 1 - planAmt; X.fillStyle = g; X.fillRect(0, 0, vw, vh); X.globalAlpha = 1;
  }
  fillGround(rect(-90, 90, -90, 90), -.03, mixc(C.paper, '#E3D6BB', 1 - planAmt));
  if (planAmt < 1) { // hovli tashqarisidagi yumshoq daraxtlar silueti
    X.globalAlpha = 1 - planAmt;
    for (let i = 0; i < 9; i++) sphere(-13 + i * 3.25, 1.6 + (i % 3) * .4, -16 - (i % 2) * 1.5, 1.9, i % 2 ? '#9DB287' : '#AFC097');
    X.globalAlpha = 1;
  }
  fillGround(rect(-10, 10, -12.5, 12.15), 0, C.earth, shade(C.earth, -.2));
  const bg = clamp((lt - .12) / .45);
  if (st.base && bg > 0) { X.globalAlpha = bg; fillGround(rect(-10, 10, -8, 12), 0, st.base); X.globalAlpha = 1; }
  drawV({ type: 'house' }, 1, 1, T);
  const els = st.els, vs = [];
  const ground = l => { for (const e of els) if ((e.layer || 0) === l && (e.k === 'poly' || e.k === 'rib' || e.k === 'line' || e.k === 'tiles')) drawGround(e, growth(e, lt), T); };
  ground(0);
  for (const e of els) if (e.k === 'v') { const g = growth(e, lt); if (g > 0) vs.push({ e, g, s: easeBack(g) }); }
  X.fillStyle = 'rgba(40,62,40,.17)';
  for (const v of vs) { const e = v.e, r = (e.r || .5) * v.s; if (['round', 'fruit', 'maple', 'olive', 'multi', 'pine', 'willow', 'palm', 'banana', 'cypress', 'cone', 'ball', 'pavilion'].includes(e.type)) { const rr = e.type === 'palm' ? 2 * v.s : e.type === 'banana' ? 1.5 * v.s : e.type === 'pavilion' ? 2.3 * v.s : r; if (pathW(W3(circ(e.x + rr * .5, e.z - rr * .3, rr * 1.05, 16), (e.y0 || 0) + .02))) X.fill(); } }
  for (const e of els) if (e.k === 'slab') { const g = growth(e, lt); if (g > 0) { X.globalAlpha = clamp(g * 3); box(e.x0, e.x1, e.z0, e.z1, 0, e.h * easeOut(g), e.side, e.top); X.globalAlpha = 1; } }
  ground(2);
  for (const e of els) if (e.k === 'hedge') drawHedge(e, growth(e, lt));
  for (const w of st.walls) vs.push({ e: w, g: 1, s: 1 });
  vs.forEach(v => { v.d = depth(v.e.x, (v.e.y0 || 0) + 1, v.e.z); });
  vs.sort((a, b) => b.d - a.d).forEach(v => drawV(v.e, v.s, v.g, T));
  if (planAmt > 0) { // reja to'ri va o'q chiziqlari
    X.globalAlpha = planAmt * .22; X.strokeStyle = '#8F8065'; X.lineWidth = 1; X.beginPath();
    for (let x = -14; x <= 14; x += 1) { const a = P3(x, .05, -17), b = P3(x, .05, 16); if (a && b) { X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); } }
    for (let z = -17; z <= 16; z += 1) { const a = P3(-14, .05, z), b = P3(14, .05, z); if (a && b) { X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); } }
    X.stroke(); X.globalAlpha = 1;
    for (const e of els) if (e.k === 'guide') {
      const g = growth(e, lt); if (g <= 0) continue;
      const a = P3(e.pts[0][0], .1, e.pts[0][1]), b = P3(lerp(e.pts[0][0], e.pts[1][0], g), .1, lerp(e.pts[0][1], e.pts[1][1], g));
      X.save(); X.globalAlpha = planAmt; X.setLineDash([16, 12]); X.strokeStyle = C.gold; X.lineWidth = 3; X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.stroke(); X.restore();
    }
  }
}
function drawGround(e, g, T) {
  if (g <= 0) return;
  const y = e.y || 0;
  if (e.k === 'poly') {
    let pts = e.pts;
    if (e.anim === 'fade') X.globalAlpha = g; else pts = scalePts(pts, e.water ? easeOut(g) : easeBack(g));
    const ok = fillGround(pts, y, e.fill, e.water ? shade(e.fill, -.25) : (e.stroke ? shade(e.fill, -.15) : null), e.water ? 2 : 1.2);
    X.globalAlpha = 1;
    if (ok && e.water) shimmer(T);
  } else if (e.k === 'rib') {
    const p = ribbon(e.pts, e.w, e.water ? g : ease(g)); if (!p) return;
    const ok = fillGround(p, y, e.fill, e.edge ? shade(e.fill, e.water ? -.3 : -.16) : null, e.water ? 2 : 1.3);
    if (ok && e.water) shimmer(T);
  } else if (e.k === 'line') {
    const n = e.pts.length, m = Math.max(2, Math.ceil(n * g)); strokeW(e.pts.slice(0, m), y + .02, e.col, e.wm);
  } else if (e.k === 'tiles') {
    X.globalAlpha = g; X.strokeStyle = e.col; X.lineWidth = 1.2; X.beginPath();
    const seg = (a, b) => { const p = P3(a[0], y + .02, a[1]), q = P3(b[0], y + .02, b[1]); if (p && q) { X.moveTo(p[0], p[1]); X.lineTo(q[0], q[1]); } };
    if (e.dir !== 'z') for (let z = e.z0 + e.step; z < e.z1 - .01; z += e.step) seg([e.x0, z], [e.x1, z]);
    for (let x = e.x0 + e.step; x < e.x1 - .01; x += e.step) seg([x, e.z0], [x, e.z1]);
    X.stroke(); X.globalAlpha = 1;
  }
}
function shimmer(T) { // suv yuzidagi yaltiroq to'lqinlar (oxirgi chizilgan yo'l ichida)
  X.save(); X.clip(); X.strokeStyle = 'rgba(255,255,255,.35)'; X.lineWidth = 2.2;
  for (let k = 0; k < 6; k++) { const x = ((T * 70 + k * 190) % 1300) - 110; X.beginPath(); X.moveTo(x, 0); X.lineTo(x + 420, 1920); X.stroke(); }
  X.restore();
}
function drawHedge(e, g) {
  if (g <= 0) return;
  const p = ribbon(e.pts, e.w, ease(g)); if (!p) return;
  const h = e.h;
  fillGround(p, 0, shade(e.col, -.38)); fillGround(p, h * .35, shade(e.col, -.25)); fillGround(p, h * .7, shade(e.col, -.12)); fillGround(p, h, shade(e.col, .1), shade(e.col, -.3), 1);
}

// ---------- kamera rejasi ----------
const PS = 45; // perspektivada nishondagi px/metr
function sceneCam(i, lt) {
  const tilt = ease(prog(lt, 2.25, .85)), orb = ease(prog(lt, 2.7, 2.6)), side = i % 2 ? 1 : -1;
  return makeCam({
    yaw: side * (-.12 + .34 * orb) * tilt, pitch: lerp(1.5605, .72, tilt), dist: lerp(170, 50, tilt) - 4 * orb,
    scale: lerp(38 + 1.4 * prog(lt, 0, 2.3), PS, tilt) + orb * 2.2, tx: 0, ty: lerp(0, .5, tilt), tz: lerp(-.25, 1.6, tilt), cx: 540, cy: 1100
  });
}
const finalCam = i => sceneCam(i, 5);

// ---------- matn va grafika ----------
function txt(s, x, y, font, col, align = 'left', ls = 0, alpha = 1) {
  if (alpha <= 0) return;
  X.font = font; X.fillStyle = col; X.textAlign = align; X.textBaseline = 'alphabetic'; X.letterSpacing = ls + 'px'; X.globalAlpha = alpha;
  X.fillText(s, x, y); X.globalAlpha = 1; X.letterSpacing = '0px';
}
function wrap(s, font, maxW) {
  X.font = font; const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (X.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function rrect(x, y, w, h, r) { X.beginPath(); X.roundRect(x, y, w, h, r); }
function logo(y, alpha = 1, big = 1) {
  X.save(); X.globalAlpha = alpha;
  X.font = `600 ${22 * big}px MS`; X.letterSpacing = `${7 * big}px`; const tw = X.measureText('AZIZ FLORAN').width;
  const x0 = 540 - (tw + 34 * big) / 2;
  X.translate(x0 + 12 * big, y - 8 * big); X.rotate(-.6); X.fillStyle = C.gold;
  X.beginPath(); X.moveTo(0, -13 * big); X.quadraticCurveTo(10 * big, 0, 0, 13 * big); X.quadraticCurveTo(-10 * big, 0, 0, -13 * big); X.fill();
  X.strokeStyle = C.cream; X.lineWidth = 1.5; X.beginPath(); X.moveTo(0, -9 * big); X.lineTo(0, 10 * big); X.stroke();
  X.setTransform(1, 0, 0, 1, 0, 0); X.restore();
  txt('AZIZ FLORAN', x0 + 34 * big, y, `600 ${22 * big}px MS`, C.ink, 'left', 7 * big, alpha * .92);
}
function topScrim() {
  const g = X.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, C.cream); g.addColorStop(.8, 'rgba(243,236,223,.96)'); g.addColorStop(1, 'rgba(243,236,223,0)');
  X.fillStyle = g; X.fillRect(0, 0, W, 720);
  const b = X.createLinearGradient(0, 1500, 0, 1660); b.addColorStop(0, 'rgba(243,236,223,0)'); b.addColorStop(1, C.cream);
  X.fillStyle = b; X.fillRect(0, 1500, W, 420);
}
function progressBar(idx, a) {
  const n = 12, sw = 38, gap = 8, x0 = 540 - (n * sw + (n - 1) * gap) / 2;
  X.globalAlpha = a;
  for (let i = 0; i < n; i++) { X.fillStyle = i < idx ? '#9DB38A' : i === idx ? C.gold : '#DDD3C0'; rrect(x0 + i * (sw + gap), 262, sw, 5, 3); X.fill(); }
  X.globalAlpha = 1;
}
function header(st, idx, lt, alpha) {
  if (alpha <= 0 || lt < 0) return;
  const p1 = easeOut(prog(lt, .15, .4)); txt(`USLUB № ${String(idx + 1).padStart(2, '0')}`, 540, 338 + (1 - p1) * 18, '700 27px MS', C.gold, 'center', 5, alpha * p1);
  let size = 96; X.font = `700 ${size}px PF`; while (X.measureText(st.name).width > 900) { size -= 3; X.font = `700 ${size}px PF`; }
  const p2 = easeOut(prog(lt, .25, .55));
  X.save(); X.beginPath(); X.rect(0, 340, W * clamp(p2 * 1.15), 120); X.clip();
  txt(st.name, 540, 432 + (1 - p2) * 14, `700 ${size}px PF`, C.ink, 'center', 0, alpha); X.restore();
  const p3 = ease(prog(lt, .45, .5)); if (p3 > 0) { X.globalAlpha = alpha; X.strokeStyle = C.gold; X.lineWidth = 3; X.beginPath(); X.moveTo(540 - 80 * p3, 462); X.lineTo(540 + 80 * p3, 462); X.stroke(); X.globalAlpha = 1; }
  const p4 = easeOut(prog(lt, .6, .45));
  wrap(st.desc, '500 35px MS', 880).forEach((l, i) => txt(l, 540, 515 + i * 47 + (1 - p4) * 14, '500 35px MS', C.text, 'center', 0, alpha * p4));
  // pastki chap burchakdagi "Reja / Hajmli ko'rinish" yorlig'i
  const tilt = ease(prog(lt, 2.25, .85));
  modeTag('REJA · TEPADAN', alpha * (1 - tilt) * prog(lt, .3, .3)); modeTag('HAJMLI KO‘RINISH', alpha * tilt);
  if (st.note) {
    const pn = easeOut(prog(lt, 1.1, .5)); if (pn > 0) {
      X.globalAlpha = alpha * pn; const lines = wrap(st.note, '600 25px MS', 780), h = 26 + lines.length * 34;
      X.fillStyle = 'rgba(31,61,43,.88)'; rrect(120, 1478 - h, 840, h, 18); X.fill();
      lines.forEach((l, i) => txt(l, 540, 1478 - h + 42 + i * 34, '600 25px MS', '#F3ECDF', 'center', 0, alpha * pn));
      X.fillStyle = C.goldL; X.beginPath(); X.arc(150, 1478 - h / 2, 6, 0, 6.3); X.fill(); X.globalAlpha = 1;
    }
  }
}
function modeTag(s, a) {
  if (a <= 0.01) return;
  X.globalAlpha = a; X.font = '700 21px MS'; X.letterSpacing = '4px'; const w = X.measureText(s).width + 36;
  X.fillStyle = 'rgba(251,248,241,.9)'; rrect(100, 1508, w, 44, 22); X.fill(); X.strokeStyle = C.gold; X.lineWidth = 1.5; X.stroke(); X.letterSpacing = '0px';
  txt(s, 118, 1538, '700 21px MS', C.ink, 'left', 4, a); X.globalAlpha = 1;
}
function callouts(st, lt) {
  const fade = 1 - prog(lt, 4.55, .3);
  st.calls.forEach((c, i) => {
    const p = prog(lt, 3.3 + i * .5, .5); if (p <= 0 || fade <= 0) return;
    const q = toCam(c.p); if (q[2] < .5) return;
    const s = pj(q), dir = s[0] < 540 ? 1 : -1;
    X.font = '700 30px MS'; const tw = X.measureText(c.t).width + 44;
    let lx = s[0] + dir * 70, ly = s[1] - 120 - i * 10;
    let bx = dir > 0 ? lx : lx - tw; bx = clamp(bx, 90, 930 - tw); ly = clamp(ly, 760, 1440);
    const e = easeOut(p);
    X.globalAlpha = fade;
    X.strokeStyle = C.white; X.lineWidth = 3; X.beginPath(); X.moveTo(s[0], s[1]); const ex = lerp(s[0], dir > 0 ? bx : bx + tw, e), ey = lerp(s[1], ly + 26, e); X.lineTo(ex, ey); X.stroke();
    X.fillStyle = C.gold; X.beginPath(); X.arc(s[0], s[1], 9 + 3 * Math.sin(lt * 8), 0, 6.3); X.fill(); X.strokeStyle = C.white; X.lineWidth = 3; X.stroke();
    const pb = easeBack(prog(lt, 3.45 + i * .5, .4));
    if (pb > 0) {
      X.save(); const cx = dir > 0 ? bx : bx + tw; X.translate(cx, ly + 26); X.scale(pb, pb); X.translate(-cx, -(ly + 26));
      X.shadowColor = 'rgba(30,50,35,.25)'; X.shadowBlur = 14; X.shadowOffsetY = 4;
      X.fillStyle = 'rgba(251,248,241,.96)'; rrect(bx, ly, tw, 52, 26); X.fill(); X.shadowColor = 'transparent';
      X.strokeStyle = C.gold; X.lineWidth = 2; X.stroke();
      txt(c.t, bx + 22, ly + 37, '700 30px MS', C.ink, 'left', 0, fade); X.restore();
    }
    X.globalAlpha = 1;
  });
}

// ---------- o'tishlar: yo'lak chizig'i, suv, daraxt toji ----------
function transition(type, p, drawOld, drawNew, T) {
  drawOld();
  const e = ease(p);
  X.save(); X.beginPath();
  if (type === 'path') {
    const bx = lerp(-300, W + 300, e), f = y => bx + 120 * Math.sin(y / 380 + 1.2) - (y - H / 2) * .14;
    X.moveTo(-500, 0); for (let y = 0; y <= H; y += 40) X.lineTo(f(y), y); X.lineTo(-500, H); X.closePath(); X.clip(); drawNew(); X.restore();
    const band = (dx, col, lw) => { X.strokeStyle = col; X.lineWidth = lw; X.beginPath(); for (let y = -40; y <= H + 40; y += 40) X.lineTo(f(y) + dx, y); X.stroke(); };
    X.save(); X.lineJoin = 'round'; band(-46, C.stone, 92); band(-92, C.gold, 5); band(0, C.gold, 5); X.restore();
  } else if (type === 'water') {
    const by = lerp(H + 160, -160, e), f = x => by + 26 * Math.sin(x / 95 + T * 7) + 14 * Math.sin(x / 41 - T * 5);
    X.moveTo(0, H + 400); for (let x = 0; x <= W; x += 30) X.lineTo(x, f(x)); X.lineTo(W, H + 400); X.closePath(); X.clip(); drawNew(); X.restore();
    X.save(); X.beginPath(); for (let x = 0; x <= W; x += 30) X.lineTo(x, f(x)); for (let x = W; x >= 0; x -= 30) X.lineTo(x, f(x) + 90); X.closePath();
    const g = X.createLinearGradient(0, by, 0, by + 90); g.addColorStop(0, 'rgba(160,214,228,.95)'); g.addColorStop(1, 'rgba(70,140,170,0)'); X.fillStyle = g; X.fill();
    X.strokeStyle = '#FFFFFF'; X.lineWidth = 5; X.beginPath(); for (let x = 0; x <= W; x += 30) X.lineTo(x, f(x)); X.stroke(); X.restore();
  } else {
    const R = lerp(0, 1500, e), cx = 540, cy = 1100, rr = a => R * (1 + .07 * Math.sin(9 * a + T * 2) + .035 * Math.sin(17 * a + 2));
    for (let i = 0; i <= 90; i++) { const a = i / 90 * 6.2832; X.lineTo(cx + Math.cos(a) * rr(a), cy + Math.sin(a) * rr(a)); } X.closePath(); X.clip(); drawNew(); X.restore();
    X.save(); X.lineJoin = 'round';
    for (const [k, col, lw] of [[1, '#2F5D3A', 58], [.975, '#5E8C4E', 16]]) { X.strokeStyle = col; X.lineWidth = lw; X.beginPath(); for (let i = 0; i <= 90; i++) { const a = i / 90 * 6.2832; X.lineTo(cx + Math.cos(a) * rr(a) * k, cy + Math.sin(a) * rr(a) * k); } X.closePath(); X.stroke(); }
    X.restore();
  }
}

// ---------- kirish (hook) 0–4 s ----------
const HOOK = [{ st: EMPTY, t0: -1 }, { st: S[2], t0: 1.05, n: 'Fransuz' }, { st: S[5], t0: 1.95, n: 'Yapon' }, { st: S[11], t0: 2.85, n: 'Tropik' }];
const hookCam = T => makeCam({ yaw: lerp(-.2, .12, ease(prog(T, 0, 4.4))), pitch: lerp(.62, .74, prog(T, 0, 4.2)), dist: lerp(58, 48, easeOut(prog(T, 0, 4.4))), scale: PS, tx: 0, ty: .5, tz: 1.6, cx: 540, cy: 1100 });
function hookScene(T) {
  const cm = hookCam(T); let k = 0; HOOK.forEach((h, i) => { if (T >= h.t0) k = i; });
  const draw = j => renderScene(HOOK[j].st, j ? 1.3 + (T - HOOK[j].t0) * 2.3 : 5, cm, 0, T);
  if (k > 0 && T < HOOK[k].t0 + .4) {
    draw(k - 1);
    const e = ease((T - HOOK[k].t0) / .4), R = e * 1300;
    X.save(); X.beginPath(); X.arc(540, 1100, R, 0, 6.3); X.clip(); draw(k); X.restore();
    X.strokeStyle = C.gold; X.lineWidth = 6; X.beginPath(); X.arc(540, 1100, R, 0, 6.3); X.stroke();
    X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 2; X.beginPath(); X.arc(540, 1100, Math.max(0, R - 10), 0, 6.3); X.stroke();
  } else draw(k);
}
function hookText(T, alpha) {
  if (alpha <= 0) return;
  const a = easeOut(prog(T, .1, .45)), b = easeOut(prog(T, .75, .45)), c = easeOut(prog(T, 2.0, .45));
  txt('Bitta hovli —', 540, 360 + (1 - a) * 24, '700 92px PF', C.ink, 'center', 0, alpha * a);
  if (b > 0) {
    X.save(); X.translate(540, 470); const sc = .85 + .15 * easeBack(b); X.scale(sc, sc);
    X.font = '700 104px PF'; const w1 = X.measureText('12').width, w2 = X.measureText(' xil ko‘rinish.').width, x0 = -(w1 + w2) / 2;
    txt('12', x0, 0, '700 104px PF', C.gold, 'left', 0, alpha * b); txt(' xil ko‘rinish.', x0 + w1, 0, '700 104px PF', C.ink, 'left', 0, alpha * b); X.restore();
  }
  txt('Siz qaysi birini tanlaysiz?', 540, 556 + (1 - c) * 16, '600 44px MS', C.text, 'center', 0, alpha * c);
  HOOK.forEach((h, i) => {
    if (!i) return; const p = prog(T, h.t0 + .1, .3), q = 1 - prog(T, (HOOK[i + 1] ? HOOK[i + 1].t0 : 3.75) + .05, .2), v = Math.min(easeBack(p), q);
    if (v <= 0) return;
    X.save(); X.translate(540, 1462); X.scale(v, v); X.globalAlpha = alpha;
    X.font = '700 34px MS'; const w = X.measureText(h.n).width + 60; X.fillStyle = C.ink; rrect(-w / 2, -32, w, 64, 32); X.fill();
    txt(h.n, 0, 12, '700 34px MS', C.cream, 'center', 1, alpha); X.restore();
  });
}

// ---------- yakun 64–72 s ----------
const CR = { x: 30, y: 690, w: 1020, h: 786 };
const CELL = { w: 262, h: 202, gx: 20, gy: 20, x0: (W - (3 * 262 + 2 * 20)) / 2, y0: 432 };
const cellRect = k => ({ x: CELL.x0 + (k % 3) * (CELL.w + CELL.gx), y: CELL.y0 + Math.floor(k / 3) * (CELL.h + CELL.gy), w: CELL.w, h: CELL.h });
let thumbs = [], lastFull = null;
function prerender() {
  const fc = document.createElement('canvas'); fc.width = W; fc.height = H; const fx = fc.getContext('2d');
  const keep = X;
  S.forEach((st, i) => {
    X = fx; renderScene(st, 5, finalCam(i), 0, 0);
    const t = document.createElement('canvas'); t.width = 524; t.height = 404; t.getContext('2d').drawImage(fc, CR.x, CR.y, CR.w, CR.h, 0, 0, 524, 404); thumbs.push(t);
    if (i === 11) { lastFull = document.createElement('canvas'); lastFull.width = W; lastFull.height = H; lastFull.getContext('2d').drawImage(fc, 0, 0); }
  });
  X = keep;
}
function cell(k, r, a, hl) {
  X.save(); X.globalAlpha = a;
  X.shadowColor = 'rgba(31,61,43,.22)'; X.shadowBlur = 18; X.shadowOffsetY = 6; X.fillStyle = C.white; rrect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 20); X.fill(); X.shadowColor = 'transparent';
  X.save(); rrect(r.x, r.y, r.w, r.h, 16); X.clip(); X.drawImage(thumbs[k], r.x, r.y, r.w, r.h);
  X.fillStyle = 'rgba(243,236,223,.92)'; X.fillRect(r.x, r.y + r.h - 44, r.w, 44);
  txt(S[k].short, r.x + r.w / 2 + 16, r.y + r.h - 14, '700 23px MS', C.ink, 'center', 0, a); X.restore();
  X.fillStyle = C.gold; X.beginPath(); X.arc(r.x + 30, r.y + 30, 23, 0, 6.3); X.fill(); X.strokeStyle = C.white; X.lineWidth = 3; X.stroke();
  txt(String(k + 1), r.x + 30, r.y + 40, '800 26px MS', C.white, 'center', 0, a);
  if (hl > 0) { X.globalAlpha = a * hl; X.strokeStyle = C.gold; X.lineWidth = 7; rrect(r.x - 8, r.y - 8, r.w + 16, r.h + 16, 22); X.stroke(); }
  X.restore();
}
const HL = [3, 7, 0, 10, 5, 1, 8, 11, 2, 6, 4, 9];
function finale(T) {
  const ft = T - 64;
  X.fillStyle = C.cream; X.fillRect(0, 0, W, H);
  X.globalAlpha = .5; X.strokeStyle = '#E3D8C4'; X.lineWidth = 1; X.beginPath(); for (let x = 0; x <= W; x += 54) { X.moveTo(x, 0); X.lineTo(x, H); } for (let y = 0; y <= H; y += 54) { X.moveTo(0, y); X.lineTo(W, y); } X.stroke(); X.globalAlpha = 1;
  logo(232);
  const pt = easeOut(prog(ft, .3, .5));
  txt('Bitta hovli —', 540, 336 + (1 - pt) * 16, '700 56px PF', C.ink, 'center', 0, pt);
  X.font = '700 56px PF'; const w1 = X.measureText('12').width, w2 = X.measureText(' xil ko‘rinish').width, x0 = 540 - (w1 + w2) / 2;
  txt('12', x0, 400 + (1 - pt) * 16, '700 56px PF', C.gold, 'left', 0, pt); txt(' xil ko‘rinish', x0 + w1, 400 + (1 - pt) * 16, '700 56px PF', C.ink, 'left', 0, pt);
  const hlI = ft > 2.6 && ft < 7.2 ? HL[Math.floor((ft - 2.6) / .38) % 12] : -1;
  for (let k = 0; k < 11; k++) {
    const p = prog(ft, .2 + k * .07, .5); if (p <= 0) continue;
    const r = cellRect(k), s = easeBack(p);
    X.save(); X.translate(r.x + r.w / 2, r.y + r.h / 2); X.scale(s, s); X.translate(-(r.x + r.w / 2), -(r.y + r.h / 2)); cell(k, r, clamp(p * 2), k === hlI ? 1 : 0); X.restore();
  }
  const sp = ease(prog(ft, 0, 1.0)), r = cellRect(11);
  if (sp < 1) {
    const sc = lerp(1, r.w / CR.w, sp), ccx = lerp(540, r.x + r.w / 2, sp), ccy = lerp(960, r.y + r.h / 2, sp);
    const srcCx = lerp(540, CR.x + CR.w / 2, sp), srcCy = lerp(960, CR.y + CR.h / 2, sp);
    const cw = lerp(W, r.w, sp), ch = lerp(H, r.h, sp);
    X.save(); rrect(ccx - cw / 2, ccy - ch / 2, cw, ch, lerp(0, 16, sp)); X.clip();
    X.translate(ccx, ccy); X.scale(sc, sc); X.translate(-srcCx, -srcCy); X.drawImage(lastFull, 0, 0); X.restore();
  } else cell(11, r, 1, hlI === 11 ? 1 : 0);
  const pc = easeOut(prog(ft, 1.3, .6)), pulse = 1 + .03 * Math.sin(ft * 5) * prog(ft, 2, .5);
  txt('Qaysi uslub sizniki?', 540, 1388 + (1 - pc) * 20, '700 66px PF', C.ink, 'center', 0, pc);
  const pd = easeOut(prog(ft, 1.7, .6));
  if (pd > 0) {
    X.save(); X.translate(540, 1450); X.scale(pulse, pulse); X.font = '700 38px MS'; const w = X.measureText('Raqamini kommentga yozing!').width + 70;
    X.globalAlpha = pd; X.fillStyle = C.gold; rrect(-w / 2, -40, w, 76, 38); X.fill();
    txt('Raqamini kommentga yozing!', 0, 12, '700 38px MS', C.white, 'center', 0, pd); X.restore();
  }
}

// ---------- asosiy kadr ----------
const main = document.getElementById('c').getContext('2d');
const TW = .35;
// sahna ichidagi animatsiyalar 5 soniyalik shkalada yozilgan — uzun sahnada mutanosib cho'ziladi
const localT = (i, T) => (T - STARTS[i]) * 5 / TM.scenes[i], hookT = T => T * 4 / TM.hook;
function drawStyle(i, lt, T) { renderScene(S[i], Math.max(0, lt), sceneCam(i, lt), 1 - clamp(ease(prog(lt, 2.25, .85)) * 1.5), T); callouts(S[i], lt); }
function render(T) {
  X = main; X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1;
  T = clamp(T, 0, DUR - 1e-4);
  if (T >= FIN) { finale(T - FIN + 64); return; }
  const n = STARTS.findIndex(b => Math.abs(T - b) < TW), inTr = n >= 0;
  let cur = -1; STARTS.forEach((b, i) => { if (T >= b) cur = i; });
  const drawIdx = j => j < 0 ? hookScene(hookT(T)) : drawStyle(j, localT(j, T), T);
  if (inTr) transition(S[n].trans, (T - STARTS[n] + TW) / (2 * TW), () => drawIdx(n - 1), () => drawIdx(n), T);
  else drawIdx(cur);
  topScrim(); logo(232);
  if (T < TM.hook + TW) hookText(hookT(T), 1 - prog(T, TM.hook - .25, .3));
  if (T > TM.hook - TW) {
    progressBar(inTr ? n : cur, prog(T, TM.hook - .1, .3) * (1 - prog(T, FIN - .3, .3)));
    if (inTr) {
      if (n >= 1) header(S[n - 1], n - 1, localT(n - 1, T), 1 - prog(T, STARTS[n] - TW, TW));
      header(S[n], n, localT(n, T), 1);
    } else if (cur >= 0) header(S[cur], cur, localT(cur, T), 1 - prog(T, FIN - .35, .3));
  }
}

// ---------- ishga tushirish ----------
const fontsReady = Promise.all(['700 40px PF', '400 40px PF', '500 40px MS', '600 40px MS', '700 40px MS', '800 40px MS'].map(f => document.fonts.load(f, 'AZ‘o')));
const ready = fontsReady.then(() => { prerender(); render(0); });
// ---------- Reels muqovasi (1080×1920; asosiy qismi profildagi 4:5 kesimga — y 285–1635 ga sig'adi) ----------
function cover() {
  X = main; X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1;
  X.fillStyle = C.cream; X.fillRect(0, 0, W, H);
  X.globalAlpha = .55; X.strokeStyle = '#E3D8C4'; X.lineWidth = 1; X.beginPath(); for (let x = 0; x <= W; x += 54) { X.moveTo(x, 0); X.lineTo(x, H); } for (let y = 0; y <= H; y += 54) { X.moveTo(0, y); X.lineTo(W, y); } X.stroke(); X.globalAlpha = 1;
  logo(352, 1, 1.15);
  txt('Bitta hovli —', 540, 482, '700 100px PF', C.ink, 'center');
  X.font = '700 116px PF'; const w1 = X.measureText('12').width, w2 = X.measureText(' xil ko‘rinish').width, x0 = 540 - (w1 + w2) / 2;
  txt('12', x0, 604, '700 116px PF', C.gold, 'left'); txt(' xil ko‘rinish', x0 + w1, 604, '700 116px PF', C.ink, 'left');
  txt('LANDSHAFTNING MASHHUR USLUBLARI', 540, 670, '700 30px MS', C.gold, 'center', 5);
  const cw = 226, ch = 174, g = 14, gx = (W - (4 * cw + 3 * g)) / 2, gy = 712;
  for (let k = 0; k < 12; k++) {
    const r = { x: gx + (k % 4) * (cw + g), y: gy + Math.floor(k / 4) * (ch + g), w: cw, h: ch };
    X.save(); X.shadowColor = 'rgba(31,61,43,.2)'; X.shadowBlur = 14; X.shadowOffsetY = 5; X.fillStyle = C.white; rrect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 16); X.fill(); X.restore();
    X.save(); rrect(r.x, r.y, r.w, r.h, 12); X.clip(); X.drawImage(thumbs[k], r.x, r.y, r.w, r.h); X.restore();
    X.fillStyle = C.gold; X.beginPath(); X.arc(r.x + 24, r.y + 24, 19, 0, 6.3); X.fill(); X.strokeStyle = C.white; X.lineWidth = 2.5; X.stroke();
    txt(String(k + 1), r.x + 24, r.y + 32, '800 21px MS', C.white, 'center');
  }
  X.font = '700 40px MS'; const t = 'Qaysi biri sizniki?', bw = X.measureText(t).width + 90;
  X.fillStyle = C.ink; rrect(540 - bw / 2, 1316, bw, 84, 42); X.fill();
  txt(t, 540, 1371, '700 40px MS', C.cream, 'center');
  txt('Klassik · Yapon · Chorbog‘ · Minimalist va boshqalar', 540, 1462, '500 30px MS', C.text, 'center');
}

window.REEL = { DUR, render, ready, cover };
if (new URLSearchParams(location.search).has('render')) { document.body.classList.add('render'); return; }
let playing = true, t0 = performance.now(), cur = 0;
const sc = document.getElementById('sc'), tm = document.getElementById('tm'), pp = document.getElementById('pp'); sc.max = DUR;
pp.onclick = () => { playing = !playing; pp.textContent = playing ? 'Pauza' : 'Ijro'; t0 = performance.now() - cur * 1000; };
sc.oninput = () => { cur = +sc.value; t0 = performance.now() - cur * 1000; render(cur); tm.textContent = cur.toFixed(1) + 's'; };
ready.then(() => {
  const loop = now => { if (playing) { cur = ((now - t0) / 1000) % DUR; sc.value = cur; tm.textContent = cur.toFixed(1) + 's'; render(cur); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
})();
