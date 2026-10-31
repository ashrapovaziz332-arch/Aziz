// Normakontrol: SP 53.13330 / SP 42.13330 / SNiP 2.07.01 ga asoslangan soddalashtirilgan qoidalar
import { PLANTS, HARD, HALF_W, HALF_D, C } from './config.js';
import { coverAt, objectRect, distToRect, distToSegment, buildHash } from './state.js';

export const RULES = [
  { id: 'nets', name: "Muhandislik tarmoqlari ustida ekish", ref: 'SP 42.13330.2016, 9.6-jadval', hint: "Daraxt tarmoqdan ≥ 1,5 m, buta ≥ 1 m" },
  { id: 'path', name: "Yo'lak yoki plitka ustida ekish", ref: 'SP 82.13330.2016', hint: "Qattiq qoplamada o'simlik bo'lmasligi kerak" },
  { id: 'border', name: 'Uchastka chegarasiga yaqin', ref: 'SP 53.13330.2019, 6.7', hint: "Baland daraxt ≥ 4 m, o'rta ≥ 2 m, buta ≥ 1 m" },
  { id: 'house', name: 'Binoga yaqin ekish', ref: 'SP 42.13330.2016, 9.6-jadval', hint: "Daraxt devordan ≥ 5 m, buta ≥ 1,5 m" },
  { id: 'lamp', name: 'Yoritish ustuniga yaqin daraxt', ref: 'SP 42.13330.2016', hint: "Daraxt ustundan ≥ 1,5 m" },
  { id: 'dense', name: "Haddan tashqari zich ekilgan daraxtlar", ref: 'Agrotexnik tavsiya', hint: "Tojlar 50 % dan ko'p ustma-ust tushmasin" },
];

export function checkNorms(s) {
  const res = Object.fromEntries(RULES.map((r) => [r.id, []]));
  const builds = s.objects.filter((o) => ['house', 'shed', 'gazebo', 'greenhouse'].includes(o.t)).map((o) => ({ o, rc: objectRect(o) }));
  const lamps = s.objects.filter((o) => o.t === 'lamp');
  const nets = [...s.nets.light, ...s.nets.drain];
  const hash = buildHash(s);

  s.plants.forEach((p, i) => {
    const d = PLANTS[p.t];
    const h = d.h * p.s;
    const isTree = d.group === 'tree';
    const isShrub = d.group === 'shrub';
    const isSmall = !isTree && !isShrub;

    if (HARD.has(coverAt(s, p.x, p.z))) res.path.push(i);

    if (!isSmall || d.group === 'grass') {
      const db = Math.min(p.x + HALF_W, HALF_W - p.x, p.z + HALF_D, HALF_D - p.z);
      const need = isTree ? (h >= 8 ? 4 : 2) : isShrub ? 1 : 0.5;
      if (db < need) res.border.push(i);
    }

    if (isTree || isShrub) {
      for (const { o, rc } of builds) {
        const need = o.t === 'house' ? (isTree ? 5 : 1.5) : (isTree ? 2 : 0.5);
        if (distToRect(p.x, p.z, rc) < need) { res.house.push(i); break; }
      }
    }

    if (isTree || isShrub) {
      const need = isTree ? 1.5 : 1;
      let bad = false;
      for (const [a, b, c2, e] of nets) {
        if (distToSegment(p.x, p.z, a, b, c2, e) < need) { bad = true; break; }
      }
      // sug'orish quvuri o'simlikka yaqin bo'lishi tabiiy — faqat daraxt tanasi ostida bo'lsa xato
      if (!bad && isTree) for (const [a, b, c2, e] of s.nets.irr) {
        if (distToSegment(p.x, p.z, a, b, c2, e) < 0.7) { bad = true; break; }
      }
      if (bad) res.nets.push(i);
    }

    if (isTree) {
      for (const l of lamps) if (Math.hypot(l.x - p.x, l.z - p.z) < 1.5) { res.lamp.push(i); break; }
      let dense = false;
      hash.query(p.x, p.z, 8, (j) => {
        if (dense || j === i) return;
        const q = s.plants[j];
        if (PLANTS[q.t].group !== 'tree') return;
        const r1 = d.r * p.s, r2 = PLANTS[q.t].r * q.s;
        if (Math.hypot(q.x - p.x, q.z - p.z) < 0.5 * (r1 + r2)) dense = true;
      });
      if (dense) res.dense.push(i);
    }
  });
  const total = Object.values(res).reduce((a, b) => a + b.length, 0);
  return { byRule: res, total };
}

// Variant bahosi va nazorat varaqasi (10 band)
export function scoreVariant(s, norms) {
  const n = norms || checkNorms(s);
  const z = s.meta?.zones || {};
  const species = new Set(s.plants.map((p) => p.t)).size;
  let lawn = 0, all = 0;
  for (let i = 0; i < s.cover.length; i++) { all++; if (s.cover[i] === C.GRASS || s.cover[i] === C.MEADOW) lawn++; }
  const lawnShare = lawn / all;
  const checks = [
    ['Terrasa uy oldida', !!z.terrace],
    ["Dam olish zonasi", !!z.rest],
    ['Ekin maydoni / issiqxona', !!z.garden],
    ["Xo'jalik zonasi", !!z.utility],
    ['Suv havzasi', !!z.pond],
    ["Darvozadan uyga yo'lak", !!z.main],
    ['Normadan chetlanish < 15', n.total < 15],
    ["Turlar xilma-xilligi ≥ 8", species >= 8],
    ['Maysa ulushi 30–65 %', lawnShare >= 0.3 && lawnShare <= 0.65],
    ["Yo'lak yoritilgan", s.objects.some((o) => o.t === 'lamp')],
  ];
  const passed = checks.filter((c) => c[1]).length;
  const score = Math.max(0, Math.round(passed * 8 + 20 - n.total * 0.8 + Math.min(species, 12)));
  return { score: Math.min(100, score), passed, checks, normTotal: n.total, species, lawnShare };
}
