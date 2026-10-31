// Eksport: PNG, OBJ, GLB, DXF (AutoCAD/ArchiCAD), CSV vedomostlar, JSON loyiha
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { PLANTS, OBJECTS, GROUPS, COVERS, HALF_W, HALF_D, NX, NZ, HARD, fmt } from './config.js';
import { plantStats, coverAreas, netLength, objectRect, idx, vx, vz, serialize } from './state.js';
import { RULES } from './norms.js';

export function download(name, data, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function downloadDataURL(name, url) {
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

const csvRow = (a) => a.map((v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(';');

export function plantScheduleCSV(s) {
  const st = plantStats(s);
  const rows = [['№', 'Guruh', 'Nomi', 'Ruscha', 'Lotincha', 'Balandlik, m', 'Soni, dona']];
  Object.entries(st.byType).sort((a, b) => b[1] - a[1]).forEach(([t, n], i) => {
    const d = PLANTS[t];
    rows.push([i + 1, GROUPS[d.group], d.name, d.ru, d.latin, d.h, n]);
  });
  rows.push([], ['', '', 'Jami', '', '', '', st.total]);
  rows.push([], ['Qoplamalar', 'Maydon, m²']);
  const a = coverAreas(s);
  for (const c of COVERS) if (a[c.id]) rows.push([c.name, a[c.id].toFixed(1)]);
  rows.push([], ['Tarmoqlar', 'Uzunlik, m']);
  rows.push(["Sug'orish", netLength(s.nets.irr).toFixed(1)], ['Yoritish kabeli', netLength(s.nets.light).toFixed(1)], ['Drenaj', netLength(s.nets.drain).toFixed(1)]);
  return '﻿' + rows.map(csvRow).join('\n');
}

export function normsCSV(s, res) {
  const rows = [['Qoida', 'Manba', "O'simlik", 'X, m', 'Y, m']];
  for (const r of RULES) for (const i of res.byRule[r.id]) {
    const p = s.plants[i];
    rows.push([r.name, r.ref, PLANTS[p.t].name, p.x.toFixed(2), (-p.z).toFixed(2)]);
  }
  return '﻿' + rows.map(csvRow).join('\n');
}

// --- DXF (R12 ASCII). Reja koordinatalari: X = x, Y = -z (shimol yuqorida)
export function toDXF(s, contourSegs = []) {
  const out = [];
  const g = (code, v) => out.push(String(code), String(v));
  const layers = ['CHEGARA', 'GORIZONTAL', 'QOPLAMA', 'DARAXT', 'BUTA', 'GULZOR', 'INSHOOT', 'SUGORISH', 'YORITISH', 'DRENAJ', 'MATN'];
  const colors = { CHEGARA: 7, GORIZONTAL: 8, QOPLAMA: 9, DARAXT: 3, BUTA: 94, GULZOR: 6, INSHOOT: 5, SUGORISH: 4, YORITISH: 2, DRENAJ: 30, MATN: 7 };
  g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.length);
  for (const L of layers) { g(0, 'LAYER'); g(2, L); g(70, 0); g(62, colors[L]); g(6, 'CONTINUOUS'); }
  g(0, 'ENDTAB'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const line = (L, x1, z1, x2, z2) => { g(0, 'LINE'); g(8, L); g(10, x1.toFixed(3)); g(20, (-z1).toFixed(3)); g(11, x2.toFixed(3)); g(21, (-z2).toFixed(3)); };
  const circle = (L, x, z, r) => { g(0, 'CIRCLE'); g(8, L); g(10, x.toFixed(3)); g(20, (-z).toFixed(3)); g(40, r.toFixed(3)); };
  const text = (L, x, z, h, t) => { g(0, 'TEXT'); g(8, L); g(10, x.toFixed(3)); g(20, (-z).toFixed(3)); g(40, h); g(1, t); };

  line('CHEGARA', -HALF_W, -HALF_D, HALF_W, -HALF_D); line('CHEGARA', HALF_W, -HALF_D, HALF_W, HALF_D);
  line('CHEGARA', HALF_W, HALF_D, -HALF_W, HALF_D); line('CHEGARA', -HALF_W, HALF_D, -HALF_W, -HALF_D);

  for (let k = 0; k + 5 < contourSegs.length; k += 6) line('GORIZONTAL', contourSegs[k], contourSegs[k + 2], contourSegs[k + 3], contourSegs[k + 5]);

  // qoplama chegaralari (katak qirralari bo'yicha)
  const key = (ix, iz) => s.cover[idx(ix, iz)];
  for (let iz = 0; iz <= NZ; iz++) for (let ix = 0; ix <= NX; ix++) {
    const c = key(ix, iz);
    if (ix < NX && key(ix + 1, iz) !== c && (HARD.has(c) || HARD.has(key(ix + 1, iz)) || c === 3 || key(ix + 1, iz) === 3)) {
      const xm = (vx(ix) + vx(ix + 1)) / 2; line('QOPLAMA', xm, vz(iz) - 0.25, xm, vz(iz) + 0.25);
    }
    if (iz < NZ && key(ix, iz + 1) !== c && (HARD.has(c) || HARD.has(key(ix, iz + 1)) || c === 3 || key(ix, iz + 1) === 3)) {
      const zm = (vz(iz) + vz(iz + 1)) / 2; line('QOPLAMA', vx(ix) - 0.25, zm, vx(ix) + 0.25, zm);
    }
  }
  for (const p of s.plants) {
    const d = PLANTS[p.t];
    const L = d.group === 'tree' ? 'DARAXT' : d.group === 'shrub' ? 'BUTA' : 'GULZOR';
    circle(L, p.x, p.z, d.r * p.s);
    if (d.group === 'tree') circle(L, p.x, p.z, 0.15);
  }
  for (const o of s.objects) {
    const rc = objectRect(o);
    if (o.t === 'lamp' || o.t === 'sprinkler') { circle(o.t === 'lamp' ? 'YORITISH' : 'SUGORISH', o.x, o.z, 0.2); continue; }
    line('INSHOOT', rc.x0, rc.z0, rc.x1, rc.z0); line('INSHOOT', rc.x1, rc.z0, rc.x1, rc.z1);
    line('INSHOOT', rc.x1, rc.z1, rc.x0, rc.z1); line('INSHOOT', rc.x0, rc.z1, rc.x0, rc.z0);
    text('MATN', rc.x0 + 0.2, rc.z1 - 0.3, 0.4, OBJECTS[o.t].name);
  }
  for (const [a, b, c, d] of s.nets.irr) line('SUGORISH', a, b, c, d);
  for (const [a, b, c, d] of s.nets.light) line('YORITISH', a, b, c, d);
  for (const [a, b, c, d] of s.nets.drain) line('DRENAJ', a, b, c, d);
  for (const [x, z] of s.nets.wells) circle('DRENAJ', x, z, 0.5);
  text('MATN', -HALF_W, -HALF_D - 2, 1, `${s.name} — Floran 3D`);
  g(0, 'ENDSEC'); g(0, 'EOF');
  return out.join('\r\n');
}

export function toOBJ(root) { return new OBJExporter().parse(root); }

export function toGLB(root) {
  return new Promise((res, rej) => new GLTFExporter().parse(root, (r) => res(r), rej, { binary: true }));
}

export function projectJSON(project, base) {
  return JSON.stringify({ app: 'floran3d', version: 1, project: serialize(project), base: serialize(base) });
}

export function summaryText(s) {
  const st = plantStats(s);
  return `${fmt(st.total)} o'simlik · ${Object.keys(st.byType).length} tur`;
}
