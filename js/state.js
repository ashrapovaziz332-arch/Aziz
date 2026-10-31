// Loyiha holati (snapshot), to'r yordamchilari va sof (three.js'siz) tahrirlash amallari
import { SITE, VX, VZ, NX, NZ, HALF_W, HALF_D, C, HARD, PLANTS, OBJECTS } from './config.js';

export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const idx = (ix, iz) => iz * VX + ix;
export const vx = (ix) => -HALF_W + ix * SITE.CELL;
export const vz = (iz) => -HALF_D + iz * SITE.CELL;
export const inSite = (x, z, m = 0) => x >= -HALF_W + m && x <= HALF_W - m && z >= -HALF_D + m && z <= HALF_D - m;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function emptySnapshot() {
  return {
    name: 'Yangi loyiha',
    heights: new Float32Array(VX * VZ),
    h0: new Float32Array(VX * VZ),
    cover: new Uint8Array(VX * VZ),
    plants: [],
    objects: [],
    nets: { irr: [], light: [], drain: [], wells: [] },
  };
}

export function cloneSnap(s) {
  return {
    name: s.name,
    heights: s.heights.slice(),
    h0: s.h0.slice(),
    cover: s.cover.slice(),
    plants: s.plants.map((p) => ({ ...p })),
    objects: s.objects.map((o) => ({ ...o })),
    nets: {
      irr: s.nets.irr.map((a) => a.slice()),
      light: s.nets.light.map((a) => a.slice()),
      drain: s.nets.drain.map((a) => a.slice()),
      wells: s.nets.wells.map((a) => a.slice()),
    },
  };
}

export function serialize(s) {
  return {
    name: s.name,
    heights: Array.from(s.heights, (v) => Math.round(v * 1000)),
    h0: Array.from(s.h0, (v) => Math.round(v * 1000)),
    cover: Array.from(s.cover),
    plants: s.plants.map((p) => [p.t, +p.x.toFixed(2), +p.z.toFixed(2), +p.s.toFixed(2), +p.rot.toFixed(2)]),
    objects: s.objects.map((o) => [o.t, +o.x.toFixed(2), +o.z.toFixed(2), +(o.rot || 0).toFixed(3)]),
    nets: s.nets,
  };
}

export function deserialize(d) {
  const s = emptySnapshot();
  s.name = d.name || 'Loyiha';
  if (d.heights?.length === VX * VZ) s.heights.set(d.heights.map((v) => v / 1000));
  if (d.h0?.length === VX * VZ) s.h0.set(d.h0.map((v) => v / 1000));
  if (d.cover?.length === VX * VZ) s.cover.set(d.cover);
  s.plants = (d.plants || []).filter((p) => PLANTS[p[0]]).map((p) => ({ t: p[0], x: p[1], z: p[2], s: p[3], rot: p[4] }));
  s.objects = (d.objects || []).filter((o) => OBJECTS[o[0]]).map((o) => ({ t: o[0], x: o[1], z: o[2], rot: o[3] }));
  s.nets = Object.assign({ irr: [], light: [], drain: [], wells: [] }, d.nets || {});
  return s;
}

// --- Namuna olish -------------------------------------------------------
export function heightAt(s, x, z) {
  const fx = clamp((x + HALF_W) / SITE.CELL, 0, NX - 1e-6);
  const fz = clamp((z + HALF_D) / SITE.CELL, 0, NZ - 1e-6);
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const h = s.heights;
  const a = h[idx(ix, iz)], b = h[idx(ix + 1, iz)], c = h[idx(ix, iz + 1)], d = h[idx(ix + 1, iz + 1)];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

export function coverAt(s, x, z) {
  const ix = clamp(Math.round((x + HALF_W) / SITE.CELL), 0, NX);
  const iz = clamp(Math.round((z + HALF_D) / SITE.CELL), 0, NZ);
  return s.cover[idx(ix, iz)];
}

// Radius ichidagi to'r tugunlarini aylanib chiqish: cb(i, d, x, z)
export function forEachInRadius(x, z, r, cb) {
  const ix0 = clamp(Math.floor((x - r + HALF_W) / SITE.CELL), 0, NX);
  const ix1 = clamp(Math.ceil((x + r + HALF_W) / SITE.CELL), 0, NX);
  const iz0 = clamp(Math.floor((z - r + HALF_D) / SITE.CELL), 0, NZ);
  const iz1 = clamp(Math.ceil((z + r + HALF_D) / SITE.CELL), 0, NZ);
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const px = vx(ix), pz = vz(iz);
      const d = Math.hypot(px - x, pz - z);
      if (d <= r) cb(idx(ix, iz), d, px, pz);
    }
  }
}

export const falloff = (d, r) => (d >= r ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * d) / r));

// --- Relyef amallari ----------------------------------------------------
export function raise(s, x, z, r, dh) {
  forEachInRadius(x, z, r, (i, d) => { s.heights[i] += dh * falloff(d, r); });
}

export function flatten(s, x, z, r, target, k) {
  forEachInRadius(x, z, r, (i, d) => {
    const f = falloff(d, r) * k;
    s.heights[i] += (target - s.heights[i]) * Math.min(1, f);
  });
}

export function smooth(s, x, z, r, k) {
  const h = s.heights;
  const upd = [];
  forEachInRadius(x, z, r, (i, d) => {
    const ix = i % VX, iz = (i / VX) | 0;
    let sum = 0, n = 0;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const jx = ix + ox, jz = iz + oz;
      if (jx < 0 || jz < 0 || jx > NX || jz > NZ) continue;
      sum += h[idx(jx, jz)]; n++;
    }
    upd.push([i, h[i] + (sum / n - h[i]) * Math.min(1, falloff(d, r) * k)]);
  });
  for (const [i, v] of upd) h[i] = v;
}

export function flattenRect(s, x0, z0, x1, z1, margin = 2) {
  let sum = 0, n = 0;
  const pts = [];
  for (let iz = 0; iz <= NZ; iz++) for (let ix = 0; ix <= NX; ix++) {
    const x = vx(ix), z = vz(iz);
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
    const d = Math.hypot(dx, dz);
    if (d === 0) { sum += s.heights[idx(ix, iz)]; n++; }
    if (d <= margin) pts.push([idx(ix, iz), d]);
  }
  if (!n) return;
  const target = sum / n;
  for (const [i, d] of pts) {
    const f = d === 0 ? 1 : falloff(d, margin);
    s.heights[i] += (target - s.heights[i]) * f;
  }
}

// --- Qoplama amallari ---------------------------------------------------
export function paintCircle(s, x, z, r, cover) {
  forEachInRadius(x, z, r, (i) => { s.cover[i] = cover; });
  if (cover === C.WATER) digWater(s, x, z, r);
}

export function digWater(s, x, z, r) {
  forEachInRadius(x, z, r + 1.2, (i, d) => {
    const depth = d <= r ? 0.6 : 0.6 * (1 - (d - r) / 1.2);
    s.heights[i] = Math.min(s.heights[i], s.h0[i] - depth);
  });
}

export function paintRect(s, x0, z0, x1, z1, cover) {
  for (let iz = 0; iz <= NZ; iz++) for (let ix = 0; ix <= NX; ix++) {
    const x = vx(ix), z = vz(iz);
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) s.cover[idx(ix, iz)] = cover;
  }
}

export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L = dx * dx + dz * dz;
  let t = L ? ((px - ax) * dx + (pz - az) * dz) / L : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export function distToPolyline(px, pz, pts) {
  let m = Infinity;
  for (let k = 0; k < pts.length - 1; k++) {
    const d = distToSegment(px, pz, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
    if (d < m) m = d;
  }
  return m;
}

export function paintPolyline(s, pts, width, cover) {
  const half = width / 2;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let iz = 0; iz <= NZ; iz++) {
    const z = vz(iz);
    if (z < z0 - half || z > z1 + half) continue;
    for (let ix = 0; ix <= NX; ix++) {
      const x = vx(ix);
      if (x < x0 - half || x > x1 + half) continue;
      if (distToPolyline(x, z, pts) <= half) s.cover[idx(ix, iz)] = cover;
    }
  }
}

// Catmull-Rom egri chiziq
export function spline(ctrl, step = 0.5) {
  if (ctrl.length < 2) return ctrl.slice();
  const out = [];
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  for (let k = 1; k < P.length - 2; k++) {
    const [p0, p1, p2, p3] = [P[k - 1], P[k], P[k + 1], P[k + 2]];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1].slice());
  return out;
}

// --- Inshoot geometriyasi ----------------------------------------------
export function objectRect(o) {
  const def = OBJECTS[o.t];
  const c = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0);
  const hw = def.w / 2, hd = def.d / 2;
  // aylantirilgan to'rtburchakning chegaraviy qutisi
  const ex = Math.abs(c) * hw + Math.abs(sn) * hd;
  const ez = Math.abs(sn) * hw + Math.abs(c) * hd;
  return { x0: o.x - ex, x1: o.x + ex, z0: o.z - ez, z1: o.z + ez };
}

export function distToRect(x, z, r) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
  return Math.hypot(dx, dz);
}

// --- O'simliklar uchun fazoviy xesh ------------------------------------
export class SpatialHash {
  constructor(cell = 1) { this.cell = cell; this.map = new Map(); }
  key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  insert(id, x, z) {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(id);
  }
  query(x, z, r, cb) {
    const c = this.cell;
    const ix0 = Math.floor((x - r) / c), ix1 = Math.floor((x + r) / c);
    const iz0 = Math.floor((z - r) / c), iz1 = Math.floor((z + r) / c);
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const a = this.map.get(this.key(ix, iz));
      if (a) for (const id of a) cb(id);
    }
  }
}

export function plantRadius(p) { return PLANTS[p.t].r * p.s; }
export function plantHeight(p) { return PLANTS[p.t].h * p.s; }

// Joy bo'shmi? (bir xil "qavat"dagi o'simliklar bilan to'qnashuvni tekshiradi)
const layerOf = (g) => (g === 'tree' ? 2 : g === 'shrub' ? 1 : 0);
export function canPlace(s, hash, t, x, z, k = 0.85) {
  const def = PLANTS[t];
  if (!inSite(x, z, 0.3)) return false;
  if (HARD.has(coverAt(s, x, z))) return false;
  for (const o of s.objects) {
    if (o.t === 'lamp' || o.t === 'sprinkler') continue;
    if (distToRect(x, z, objectRect(o)) < def.r * 0.6 + 0.3) return false;
  }
  const lay = layerOf(def.group);
  let ok = true;
  hash.query(x, z, def.r + 3.5, (id) => {
    if (!ok) return;
    const p = s.plants[id];
    if (!p) return;
    const pd = PLANTS[p.t];
    const pl = layerOf(pd.group);
    if (pl !== lay && !(lay === 2 && pl === 1) && !(lay === 1 && pl === 2)) return;
    const need = (def.r + pd.r * p.s) * (pl === lay ? k : 0.6);
    if (Math.hypot(p.x - x, p.z - z) < need) ok = false;
  });
  return ok;
}

export function buildHash(s) {
  const h = new SpatialHash(1.5);
  s.plants.forEach((p, i) => h.insert(i, p.x, p.z));
  return h;
}

export function addPlant(s, hash, t, x, z, r) {
  const p = { t, x, z, s: 0.85 + r() * 0.3, rot: r() * Math.PI * 2 };
  s.plants.push(p);
  if (hash) hash.insert(s.plants.length - 1, x, z);
  return p;
}

// --- Statistika ---------------------------------------------------------
export function earthwork(s) {
  const a = SITE.CELL * SITE.CELL;
  let cut = 0, fill = 0;
  for (let i = 0; i < s.heights.length; i++) {
    const d = s.heights[i] - s.h0[i];
    if (d > 0) fill += d * a; else cut -= d * a;
  }
  return { cut, fill };
}

export function plantStats(s) {
  const byType = {}, byGroup = {};
  for (const p of s.plants) {
    byType[p.t] = (byType[p.t] || 0) + 1;
    const g = PLANTS[p.t].group;
    byGroup[g] = (byGroup[g] || 0) + 1;
  }
  return { total: s.plants.length, byType, byGroup };
}

export function coverAreas(s) {
  const a = {};
  const cellA = SITE.CELL * SITE.CELL;
  for (let iz = 0; iz < VZ; iz++) for (let ix = 0; ix < VX; ix++) {
    const w = (ix === 0 || ix === NX ? 0.5 : 1) * (iz === 0 || iz === NZ ? 0.5 : 1);
    const c = s.cover[idx(ix, iz)];
    a[c] = (a[c] || 0) + w * cellA;
  }
  return a;
}

export function netLength(segs) {
  let L = 0;
  for (const [a, b, c, d] of segs) L += Math.hypot(c - a, d - b);
  return L;
}
