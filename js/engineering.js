// Avto-injeneriya: sug'orish, yoritish, drenaj tarmoqlarini avtomatik yotqizish
import { PLANTS, C, VX, NX, NZ, PRICES, HALF_W, HALF_D } from './config.js';
import { idx, vx, vz, objectRect, coverAt, netLength, inSite, distToRect } from './state.js';

// Prim algoritmi bo'yicha minimal ulash daraxti (MST)
export function mst(points, root = 0) {
  const n = points.length;
  if (n < 2) return [];
  const inT = new Uint8Array(n), best = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1);
  best[root] = 0;
  const segs = [];
  for (let k = 0; k < n; k++) {
    let u = -1, bu = Infinity;
    for (let i = 0; i < n; i++) if (!inT[i] && best[i] < bu) { bu = best[i]; u = i; }
    if (u < 0) break;
    inT[u] = 1;
    if (from[u] >= 0) segs.push([points[from[u]][0], points[from[u]][1], points[u][0], points[u][1]]);
    for (let i = 0; i < n; i++) {
      if (inT[i]) continue;
      const d = Math.hypot(points[i][0] - points[u][0], points[i][1] - points[u][1]);
      if (d < best[i]) { best[i] = d; from[i] = u; }
    }
  }
  return segs;
}

// Tarmoqni "L" shaklida (to'g'ri burchakli) qilib chizish — real trassalarga yaqinroq
const orthogonal = (segs) => segs.flatMap(([a, b, c, d]) =>
  (Math.abs(a - c) < 0.2 || Math.abs(b - d) < 0.2) ? [[a, b, c, d]] : [[a, b, c, b], [c, b, c, d]]);

function inlet(s) {
  const h = s.objects.find((o) => o.t === 'house');
  if (!h) return [0, HALF_D - 1];
  const rc = objectRect(h);
  return [rc.x1 + 0.5, rc.z1 + 0.5];
}

export function autoEngineering(s, opts = { irr: true, light: true, drain: true }) {
  const out = { irr: null, light: null, drain: null, cost: 0, newLamps: [], newSprinklers: [] };
  const src = inlet(s);

  if (opts.irr) {
    // O'simliklarni 3 m kataklarga guruhlash -> har bir katak uchun tomchilatgich
    const cells = new Map();
    for (const p of s.plants) {
      const k = `${Math.floor(p.x / 3)},${Math.floor(p.z / 3)}`;
      const c = cells.get(k) || [0, 0, 0];
      c[0] += p.x; c[1] += p.z; c[2]++;
      cells.set(k, c);
    }
    const pts = [src];
    let dripN = 0;
    for (const [x, z, n] of cells.values()) { pts.push([x / n, z / n]); dripN++; }
    // Maysa uchun purkagichlar (7 m to'r)
    const spr = [];
    for (let z = -HALF_D + 3.5; z < HALF_D; z += 7) for (let x = -HALF_W + 3.5; x < HALF_W; x += 7) {
      if (coverAt(s, x, z) !== C.GRASS) continue;
      if (s.objects.some((o) => o.t !== 'lamp' && o.t !== 'sprinkler' && distToRect(x, z, objectRect(o)) < 1.5)) continue;
      if (s.plants.some((p) => PLANTS[p.t].group === 'tree' && Math.hypot(p.x - x, p.z - z) < PLANTS[p.t].r * p.s)) continue;
      spr.push([x, z]); pts.push([x, z]);
    }
    const segs = orthogonal(mst(pts, 0));
    const L = netLength(segs);
    const dripL = dripN * 9;
    out.irr = { segs, length: L, sprinklers: spr.length, dripLines: dripN, dripLength: dripL };
    out.newSprinklers = spr;
    out.cost += L * PRICES.irrPipe + spr.length * PRICES.sprinkler + dripL * PRICES.drip;
  }

  if (opts.light) {
    // Yo'lak tugunlari bo'ylab har ~6 m da chiroq
    const lamps = s.objects.filter((o) => o.t === 'lamp').map((o) => [o.x, o.z]);
    const cand = [];
    for (let iz = 1; iz < NZ; iz += 2) for (let ix = 1; ix < NX; ix += 2) {
      const c = s.cover[idx(ix, iz)];
      if (c !== C.GRAVEL && c !== C.PAVING) continue;
      // yo'lak cheti: qo'shni tugunlardan biri yumshoq qoplama
      const edge = [[2, 0], [-2, 0], [0, 2], [0, -2]].some(([ox, oz]) => {
        const jx = ix + ox, jz = iz + oz;
        if (jx < 0 || jz < 0 || jx > NX || jz > NZ) return false;
        const cc = s.cover[idx(jx, jz)];
        return cc !== C.GRAVEL && cc !== C.PAVING;
      });
      if (edge) cand.push([vx(ix), vz(iz)]);
    }
    const all = lamps.slice();
    for (const p of cand) {
      if (all.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 6)) { all.push(p); out.newLamps.push(p); }
    }
    const segs = orthogonal(mst([src, ...all], 0));
    const L = netLength(segs);
    out.light = { segs, length: L, lamps: all.length, lines: Math.max(1, Math.ceil(all.length / 6)) };
    out.cost += out.newLamps.length * PRICES.lamp + L * PRICES.cable;
  }

  if (opts.drain) {
    // Pastqam joylar va qattiq qoplamalardan suv yig'ish
    let low = null, lowH = Infinity;
    const pts = [];
    for (let iz = 2; iz < NZ - 1; iz += 6) for (let ix = 2; ix < NX - 1; ix += 6) {
      const i = idx(ix, iz);
      const h = s.heights[i];
      const c = s.cover[i];
      if (c === C.WATER) continue;
      let isMin = true;
      for (const [ox, oz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
        const jx = ix + ox, jz = iz + oz;
        if (jx < 0 || jz < 0 || jx > NX || jz > NZ) continue;
        if (s.heights[idx(jx, jz)] < h - 0.02) isMin = false;
      }
      if (isMin || c === C.PAVING) pts.push([vx(ix), vz(iz)]);
      if (h < lowH && inSite(vx(ix), vz(iz), 2)) { lowH = h; low = [vx(ix), vz(iz)]; }
    }
    const all = [low, ...pts.filter((p) => p !== low)];
    const segs = orthogonal(mst(all, 0));
    const L = netLength(segs);
    const wells = all.filter((_, i) => i === 0 || i % 4 === 0);
    out.drain = { segs, length: L, wells, trench: L * 0.4 * 0.6 };
    out.cost += L * PRICES.drainPipe + wells.length * PRICES.well;
  }
  return out;
}

export function applyEngineering(s, res) {
  if (res.irr) {
    s.nets.irr = res.irr.segs;
    s.objects = s.objects.filter((o) => o.t !== 'sprinkler');
    for (const [x, z] of res.newSprinklers) s.objects.push({ t: 'sprinkler', x, z, rot: 0 });
  }
  if (res.light) {
    s.nets.light = res.light.segs;
    for (const [x, z] of res.newLamps) s.objects.push({ t: 'lamp', x, z, rot: 0 });
  }
  if (res.drain) {
    s.nets.drain = res.drain.segs;
    s.nets.wells = res.drain.wells;
  }
}
