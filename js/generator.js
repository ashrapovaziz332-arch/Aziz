// Uchastka va avto-rejalash variantlari generatori
import { C, HALF_W, HALF_D, VX, VZ, NX, NZ, PLANTS, HARD } from './config.js';
import {
  rng, emptySnapshot, cloneSnap, idx, vx, vz, raise, flattenRect, paintCircle, paintRect,
  paintPolyline, spline, buildHash, canPlace, addPlant, coverAt, inSite, distToPolyline,
  objectRect, distToRect, forEachInRadius,
} from './state.js';

// Mavjud holat: yengil relyef, maysa, uy va bir nechta eski daraxtlar
export function makeBase(seed = 7) {
  const r = rng(seed);
  const s = emptySnapshot();
  s.name = "Bog' — mavjud holat";
  const p1 = r() * 6, p2 = r() * 6, p3 = r() * 6;
  for (let iz = 0; iz < VZ; iz++) for (let ix = 0; ix < VX; ix++) {
    const x = vx(ix), z = vz(iz);
    const ex = Math.min(1, (HALF_W - Math.abs(x)) / 6), ez = Math.min(1, (HALF_D - Math.abs(z)) / 6);
    const edge = Math.max(0, Math.min(ex, ez));
    let h = 0.55 * Math.sin(x * 0.09 + p1) * Math.cos(z * 0.11 + p2)
      + 0.25 * Math.sin(x * 0.23 + z * 0.17 + p3)
      - 0.012 * z * 8 / 8;
    h = h * edge;
    s.heights[idx(ix, iz)] = h;
  }
  // O'tloq dog'lari
  for (let k = 0; k < 4; k++) paintCircle(s, -25 + r() * 50, -16 + r() * 32, 3 + r() * 4, C.MEADOW);
  // Uy (mavjud)
  s.objects.push({ t: 'house', x: -6, z: -10, rot: 0 });
  flattenRect(s, -12.5, -15.5, 0.5, -4.5, 3);
  s.h0.set(s.heights);
  // Eski daraxtlar
  const hash = buildHash(s);
  const old = [['birch', 20, -14], ['birch', 23, -11], ['pine', -24, 15], ['pine', 25, 14], ['spruce', -25, -15]];
  for (const [t, x, z] of old) if (canPlace(s, hash, t, x, z)) addPlant(s, hash, t, x, z, r);
  return s;
}

export const STYLES = {
  natural: {
    name: 'Tabiiy',
    trees: ['birch', 'maple', 'pine', 'spruce'], border: ['spruce', 'pine', 'thuja'],
    shrubs: ['spiraea', 'barberry', 'juniper'], perennials: ['rudbeckia', 'lavender', 'sage', 'hosta'],
    grasses: ['miscanthus', 'fescue'], ground: ['sedum', 'thyme'], path: C.GRAVEL, curvy: 1,
  },
  regular: {
    name: 'Muntazam',
    trees: ['apple', 'cherry', 'maple'], border: ['thuja'],
    shrubs: ['rose', 'barberry'], perennials: ['lavender', 'sage'],
    grasses: ['fescue'], ground: ['thyme'], path: C.PAVING, curvy: 0,
  },
  japanese: {
    name: 'Yapon',
    trees: ['pine', 'cherry', 'maple'], border: ['pine', 'spruce'],
    shrubs: ['juniper', 'barberry'], perennials: ['hosta'],
    grasses: ['fescue', 'miscanthus'], ground: ['sedum'], path: C.GRAVEL, curvy: 1.3,
  },
  forest: {
    name: "O'rmon",
    trees: ['spruce', 'pine', 'birch'], border: ['spruce', 'pine'],
    shrubs: ['juniper', 'spiraea'], perennials: ['hosta', 'rudbeckia'],
    grasses: ['miscanthus'], ground: ['sedum', 'thyme'], path: C.GRAVEL, curvy: 1.6,
  },
};

const pick = (r, a) => a[Math.floor(r() * a.length)];

function shuffle(r, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function densify(pts, step = 0.5) {
  const out = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [a, b] = pts[k], [c, d] = pts[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(c - a, d - b) / step));
    for (let j = 0; j < n; j++) out.push([a + (c - a) * j / n, b + (d - b) * j / n]);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

function nearestOnPolyline(pts, x, z) {
  let best = pts[0], bd = Infinity;
  for (const p of pts) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = p; } }
  return best;
}

// Asosiy generator: base'dan yangi dizayn variantini yaratadi
export function generateLayout(base, opts = {}, seed = 1) {
  const o = Object.assign({ terrace: true, rest: true, garden: true, utility: true, pond: true, style: 'natural' }, opts);
  const st = STYLES[o.style] || STYLES.natural;
  const r = rng(seed * 9301 + 49297);
  const s = cloneSnap(base);
  s.name = `Variant · ${st.name}`;
  s.nets = { irr: [], light: [], drain: [], wells: [] };
  const house = s.objects.find((ob) => ob.t === 'house') || { x: -6, z: -10, rot: 0 };
  const hr = objectRect({ ...house, t: 'house' });
  const zones = {};

  // 1. Terrasa
  const tz0 = hr.z1, tz1 = hr.z1 + (o.style === 'regular' ? 4.5 : 3.5 + r() * 1.5);
  const terrace = { x0: hr.x0 - 1, x1: hr.x1 + 1, z0: tz0, z1: tz1 };
  if (o.terrace) { paintRect(s, terrace.x0, terrace.z0, terrace.x1, terrace.z1, C.PAVING); zones.terrace = terrace; }
  const tcx = (terrace.x0 + terrace.x1) / 2;

  // 2. Darvoza va asosiy yo'lak
  const gate = [Math.round(-12 + r() * 24), HALF_D];
  let mainPts;
  if (st.curvy === 0) {
    mainPts = densify([[gate[0], HALF_D], [gate[0], (tz1 + HALF_D) / 2], [tcx, (tz1 + HALF_D) / 2], [tcx, tz1]]);
  } else {
    const mz = (tz1 + HALF_D) / 2;
    mainPts = spline([gate, [gate[0] + (r() - 0.5) * 10 * st.curvy, HALF_D - 5],
      [(gate[0] + tcx) / 2 + (r() - 0.5) * 12 * st.curvy, mz], [tcx + (r() - 0.5) * 4, tz1]]);
  }
  paintPolyline(s, mainPts, o.style === 'regular' ? 2 : 1.6, st.path);
  zones.main = mainPts;

  // 3. Zonalar uchun joylar
  const spots = shuffle(r, [[-21, 9], [21, 9], [-22, -14], [21, -13], [16, 1], [-20, 0]])
    .filter(([x, z]) => distToRect(x, z, hr) > 6 && Math.abs(x - gate[0]) + Math.abs(z - HALF_D) > 8);
  const take = () => spots.shift();
  const branch = (x, z, w = 1.2) => {
    const n = nearestOnPolyline(mainPts, x, z);
    const pts = st.curvy === 0 ? densify([[n[0], n[1]], [x, n[1]], [x, z]])
      : spline([n, [(n[0] + x) / 2 + (r() - 0.5) * 4, (n[1] + z) / 2 + (r() - 0.5) * 4], [x, z]]);
    paintPolyline(s, pts, w, st.path);
    return pts;
  };
  const paths = [mainPts];

  if (o.rest) {
    const sp = take();
    if (sp) {
      const [x, z] = sp;
      paths.push(branch(x, z));
      paintCircle(s, x, z, 3.2, C.PAVING);
      s.objects.push({ t: 'gazebo', x, z, rot: o.style === 'regular' ? 0 : r() * 0.6 });
      s.objects.push({ t: 'firepit', x: x + (x > 0 ? -4.6 : 4.6), z: z + 0.5, rot: 0 });
      paintCircle(s, x + (x > 0 ? -4.6 : 4.6), z + 0.5, 1.6, C.GRAVEL);
      s.objects.push({ t: 'bench', x: x + (x > 0 ? -4.6 : 4.6), z: z + 2.4, rot: 0 });
      zones.rest = [x, z];
    }
  }
  if (o.pond) {
    const sp = take();
    if (sp) {
      const [x, z] = sp;
      const R = o.style === 'japanese' ? 4.5 : 3 + r() * 1.2;
      for (let k = 0; k < 3; k++) paintCircle(s, x + (r() - 0.5) * R, z + (r() - 0.5) * R * 0.6, R * (0.6 + r() * 0.3), C.WATER);
      // qirg'oq
      forEachInRadius(x, z, R * 1.6, (i) => { if (s.cover[i] === C.GRASS) s.cover[i] = o.style === 'japanese' ? C.SAND : C.BED; });
      forEachInRadius(x, z, R * 1.6, (i) => {
        if (s.cover[i] !== C.WATER) {
          // suv atrofida 1 m qirg'oq qoldiramiz, qolganini maysaga qaytaramiz
          const ix = i % VX, iz = (i / VX) | 0;
          let near = false;
          for (let oz = -2; oz <= 2 && !near; oz++) for (let ox = -2; ox <= 2; ox++) {
            const jx = ix + ox, jz = iz + oz;
            if (jx >= 0 && jz >= 0 && jx <= NX && jz <= NZ && s.cover[idx(jx, jz)] === C.WATER) { near = true; break; }
          }
          if (!near && (s.cover[i] === C.BED || s.cover[i] === C.SAND)) s.cover[i] = C.GRASS;
        }
      });
      zones.pond = [x, z, R];
      paths.push(branch(x + (x > 0 ? -R - 1.5 : R + 1.5), z, 1.1));
    }
  }
  if (o.garden) {
    const sp = take();
    if (sp) {
      const [x, z] = sp;
      paths.push(branch(x, z + 4));
      s.objects.push({ t: 'greenhouse', x: x + (x > 0 ? 3 : -3), z: z - 0.5, rot: 0 });
      paintRect(s, x - 5, z - 4, x + 5, z + 3.5, C.GRAVEL);
      const bx = x + (x > 0 ? -2.5 : 2.5);
      for (let k = 0; k < 4; k++) {
        const bz = z - 3.2 + k * 1.7;
        paintRect(s, bx - 1.6, bz, bx + 1.6, bz + 1.0, C.BED);
      }
      zones.garden = [x, z];
    }
  }
  if (o.utility) {
    const sp = take();
    if (sp) {
      const [x, z] = sp;
      paths.push(branch(x, z));
      paintRect(s, x - 2.6, z - 2.4, x + 2.6, z + 2.4, C.PAVING);
      s.objects.push({ t: 'shed', x, z, rot: 0 });
      zones.utility = [x, z];
    }
  }

  // Inshootlar ostidagi joyni tekislash
  for (const ob of s.objects) if (ob.t !== 'house' && ob.t !== 'bench') {
    const rc = objectRect(ob); flattenRect(s, rc.x0, rc.z0, rc.x1, rc.z1, 1.5);
  }

  // Qattiq qoplamaga tushib qolgan eski o'simliklarni olib tashlash
  s.plants = s.plants.filter((p) => !HARD.has(coverAt(s, p.x, p.z)));
  const hash = buildHash(s);
  const tryAdd = (t, x, z, k) => (canPlace(s, hash, t, x, z, k) ? addPlant(s, hash, t, x, z, r) : null);
  const nearPath = (x, z, d) => paths.some((p) => distToPolyline(x, z, p) < d);

  // 4. Chegara bo'ylab ignabarglilar
  const off = 2 + r() * 2.2;
  const step = o.style === 'regular' ? 2.2 : 3.6 + r() * 1.2;
  const perim = [];
  for (let x = -HALF_W + off; x <= HALF_W - off; x += step) { perim.push([x, -HALF_D + off]); perim.push([x, HALF_D - off]); }
  for (let z = -HALF_D + off + step; z <= HALF_D - off - step; z += step) { perim.push([-HALF_W + off, z]); perim.push([HALF_W - off, z]); }
  for (const [x, z] of perim) {
    if (Math.abs(x - gate[0]) < 4 && z > 0) continue;
    const t = o.style === 'regular' ? 'thuja' : pick(r, st.border);
    const j = o.style === 'regular' ? 0 : 1;
    tryAdd(t, x + (r() - 0.5) * j * 1.5, z + (r() - 0.5) * j * 1.5, 0.7);
  }

  // 5. Daraxt guruhlari
  const groupsN = o.style === 'forest' ? 10 : 5 + Math.floor(r() * 3);
  for (let g = 0; g < groupsN; g++) {
    const cx = -HALF_W + 7 + r() * (2 * HALF_W - 14), cz = -HALF_D + 6 + r() * (2 * HALF_D - 12);
    if (distToRect(cx, cz, hr) < 6) continue;
    const t = pick(r, st.trees);
    let n = 2 + Math.floor(r() * 4);
    const tries = n * 3;
    for (let k = 0; k < tries; k++) {
      const a = r() * Math.PI * 2, d = r() * 5;
      if (tryAdd(t, cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.8)) { if (--n <= 0) break; }
    }
    // tagiga yer qoplovchilar
    const gc = pick(r, st.ground);
    for (let k = 0; k < 260; k++) {
      const a = r() * Math.PI * 2, d = 1.2 + Math.sqrt(r()) * 5;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!nearPath(x, z, 1)) tryAdd(gc, x, z, 0.9);
    }
  }
  if (st.trees.includes('apple') || o.style === 'regular') {
    // muntazam uslubda yo'lak bo'ylab xiyobon
    for (let k = 4; k < mainPts.length - 2; k += 10) {
      const [x, z] = mainPts[k];
      tryAdd(pick(r, st.trees), x + 2.4, z, 0.8);
      tryAdd(pick(r, st.trees), x - 2.4, z, 0.8);
    }
  }

  // 6. Gulzorlar (uy oldida va yo'laklar bo'yida)
  const beds = [];
  if (o.terrace) {
    beds.push([terrace.x0 + 2, terrace.z1 + 2.2, 2.2], [terrace.x1 - 2, terrace.z1 + 2.2, 2.2]);
  }
  for (let k = 0; k < 12; k++) {
    const p = pick(r, mainPts.slice(3, -3).length ? mainPts.slice(3, -3) : mainPts);
    const side = r() < 0.5 ? -1 : 1;
    beds.push([p[0] + side * (3 + r() * 2), p[1] + (r() - 0.5) * 3, 1.6 + r() * 1.6]);
  }
  for (const [bx, bz, br] of beds) {
    if (!inSite(bx, bz, 2) || distToRect(bx, bz, hr) < 1) continue;
    const soft = (i) => s.cover[i] === C.GRASS || s.cover[i] === C.MEADOW;
    if (o.style === 'regular') {
      forEachInRadius(bx, bz, br * 1.2, (i, d, x, z) => { if (Math.abs(z - bz) <= br * 0.6 && soft(i)) s.cover[i] = C.BED; });
    } else {
      const wob = r() * 6;
      forEachInRadius(bx, bz, br * 1.3, (i, d, x, z) => {
        const a = Math.atan2(z - bz, x - bx);
        if (d <= br * (1 + 0.25 * Math.sin(a * 3 + wob)) && soft(i)) s.cover[i] = C.BED;
      });
    }
  }
  // gulzorlarni ko'p yilliklar bilan to'ldirish (driftlar)
  const drifts = st.perennials.concat(st.grasses);
  const BS = 0.38; // gulzor ekish qadami
  for (let z = -HALF_D + 0.3; z < HALF_D - 0.3; z += BS) for (let x = -HALF_W + 0.3; x < HALF_W - 0.3; x += BS) {
    if (coverAt(s, x, z) !== C.BED) continue;
    const px = x + (r() - 0.5) * 0.15, pz = z + (r() - 0.5) * 0.15;
    const zoneV = zones.garden && Math.hypot(px - zones.garden[0], pz - zones.garden[1]) < 6;
    if (zoneV) { tryAdd('veg', px, pz, 0.9); continue; }
    const k = Math.floor((Math.sin(px * 0.55) + Math.cos(pz * 0.5) + 2) / 4 * drifts.length) % drifts.length;
    tryAdd(drifts[k], px, pz, 0.8);
  }

  // 7. Butalar: terrasa va yo'laklar bo'yida
  for (const p of paths) {
    for (let k = 2; k < p.length - 2; k += 4) {
      if (r() < 0.45) continue;
      const [x, z] = p[k];
      const [nx, nz] = p[k + 1];
      const dx = nx - x, dz = nz - z, L = Math.hypot(dx, dz) || 1;
      const side = r() < 0.5 ? -1 : 1;
      const d = 1.8 + r() * 1.2;
      tryAdd(pick(r, st.shrubs), x - (dz / L) * d * side, z + (dx / L) * d * side, 0.9);
    }
  }
  if (zones.pond) {
    const [px, pz, R] = zones.pond;
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, d = R + 1 + r() * 2;
      tryAdd(pick(r, st.grasses.concat(st.perennials)), px + Math.cos(a) * d, pz + Math.sin(a) * d * 0.8, 0.9);
    }
  }

  // 8. Yoritish: asosiy yo'lak bo'ylab
  for (let k = 6, sd = 1; k < mainPts.length - 2; k += 12, sd = -sd) {
    const [x, z] = mainPts[k];
    const [nx, nz] = mainPts[k + 1];
    const dx = nx - x, dz = nz - z, L = Math.hypot(dx, dz) || 1;
    s.objects.push({ t: 'lamp', x: x - (dz / L) * 1.3 * sd, z: z + (dx / L) * 1.3 * sd, rot: 0 });
  }
  if (o.terrace) {
    s.objects.push({ t: 'lamp', x: terrace.x0 + 0.4, z: terrace.z1 - 0.4, rot: 0 });
    s.objects.push({ t: 'lamp', x: terrace.x1 - 0.4, z: terrace.z1 - 0.4, rot: 0 });
    s.objects.push({ t: 'bench', x: tcx - 3, z: terrace.z0 + 1.5, rot: 0 });
  }

  s.meta = { zones, gate, style: o.style, opts: o };
  return s;
}

// Yuqoridan ko'rinish eskizi (variant kartalari uchun)
export function drawThumb(canvas, s) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(VX, VZ);
  const pal = {
    0: [111, 159, 71], 1: [203, 187, 152], 2: [168, 162, 154], 3: [94, 70, 52], 4: [47, 111, 147], 5: [221, 203, 152], 6: [142, 166, 83],
  };
  for (let i = 0; i < VX * VZ; i++) {
    const c = pal[s.cover[i]] || pal[0];
    const sh = 1 + (s.heights[i] - s.h0[i]) * 0.15;
    img.data[i * 4] = c[0] * sh; img.data[i * 4 + 1] = c[1] * sh; img.data[i * 4 + 2] = c[2] * sh; img.data[i * 4 + 3] = 255;
  }
  const tmp = document.createElement('canvas'); tmp.width = VX; tmp.height = VZ;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, W, H);
  const sx = W / (2 * HALF_W), sz = H / (2 * HALF_D);
  const toX = (x) => (x + HALF_W) * sx, toY = (z) => (z + HALF_D) * sz;
  for (const ob of s.objects) {
    if (ob.t === 'lamp' || ob.t === 'sprinkler') continue;
    const rc = objectRect(ob);
    ctx.fillStyle = ob.t === 'house' ? '#3a3d42' : ob.t === 'greenhouse' ? '#cfe6ee' : '#8a6a4a';
    ctx.fillRect(toX(rc.x0), toY(rc.z0), (rc.x1 - rc.x0) * sx, (rc.z1 - rc.z0) * sz);
  }
  for (const p of s.plants) {
    const d = PLANTS[p.t];
    if (d.group !== 'tree' && d.group !== 'shrub') continue;
    ctx.fillStyle = d.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), Math.max(1, d.r * p.s * sx), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
