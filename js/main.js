// Floran 3D — asosiy ilova: interfeys, asboblar, agent, modallar
import * as THREE from 'three';
import { SITE, COVERS, C, PLANTS, OBJECTS, GROUPS, HARD, HALF_W, HALF_D, fmt } from './config.js';
import {
  rng, cloneSnap, heightAt, coverAt, raise, flatten, smooth, paintCircle, buildHash, canPlace, addPlant,
  earthwork, plantStats, coverAreas, netLength, objectRect, distToRect, inSite, deserialize, forEachInRadius,
} from './state.js';
import { makeBase, generateLayout, drawThumb, STYLES } from './generator.js';
import { checkNorms, scoreVariant, RULES } from './norms.js';
import { autoEngineering, applyEngineering } from './engineering.js';
import { parse as parseCmd, HELP } from './agent.js';
import { World } from './world.js';
import { icon } from './icons.js';
import { download, downloadDataURL, plantScheduleCSV, normsCSV, toDXF, toOBJ, toGLB, projectJSON } from './exporters.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STORE = 'floran3d.project.v1';
const AREA = SITE.W * SITE.D;

// ---------------------------------------------------------------- holat
const app = {
  base: null, project: null, shown: 'project',
  tab: 'tarkib', cat: 'relief',
  tool: { relief: 'view', cover: 'view', plants: 'view', objects: 'view', irr: 'view', light: 'view' },
  radius: 4, strength: 0.6, species: 'lavender', density: 2.5, rot: 0,
  undo: [], redo: [], sel: null, stroke: null, walk: null, norms: null,
  chat: [{ who: 'bot', text: "Salom! Men bog' agentiman. Buyruqni oddiy so'z bilan yozing — men uni modelda bajaraman.\nMasalan: «Tepalik qo'sh: balandligi 1,2 m, R 6 m» yoki «Chegara bo'ylab 10 ta qarag'ay ek»." }],
};
const cur = () => (app.shown === 'base' ? app.base : app.project);
const editable = () => app.shown === 'project' && !app.walk;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (d?.app === 'floran3d') { app.project = deserialize(d.project); app.base = deserialize(d.base); app.project.meta = d.meta; return; }
  } catch (e) { console.warn('Saqlangan loyiha o\'qilmadi', e); }
  resetDemo();
}
function resetDemo() {
  app.base = makeBase(7);
  app.project = generateLayout(app.base, { style: 'natural' }, 5);
  app.project.name = "Bog' — Namuna loyiha";
}
let saveT = 0;
function scheduleSave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      const j = JSON.parse(projectJSON(app.project, app.base)); j.meta = app.project.meta;
      localStorage.setItem(STORE, JSON.stringify(j));
    } catch (e) { console.warn('Saqlash xatosi', e); }
  }, 700);
}

function pushUndo() {
  app.undo.push(cloneSnap(app.project));
  if (app.undo.length > 30) app.undo.shift();
  app.redo = [];
}
function undo() {
  if (!app.undo.length) return toast("Bekor qilinadigan amal yo'q");
  app.redo.push(cloneSnap(app.project));
  app.project = app.undo.pop();
  app.sel = null; refreshAll(); toast('Bekor qilindi');
}
function redo() {
  if (!app.redo.length) return;
  app.undo.push(cloneSnap(app.project));
  app.project = app.redo.pop();
  refreshAll();
}

// ---------------------------------------------------------------- 3D
load();
const canvas = $('#view');
const world = new World(canvas);
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, world.camera);
}
function hitTerrain(e) {
  pick(e);
  const h = world.terrain.visible ? ray.intersectObject(world.terrain, false)[0] : null;
  if (h) return { x: h.point.x, z: h.point.z };
  const p = new THREE.Vector3();
  if (ray.ray.intersectPlane(ground, p) && inSite(p.x, p.z)) return { x: p.x, z: p.z };
  return null;
}
function hitSelectable(e) {
  pick(e);
  const objs = [...world.plantMeshes.filter((m) => m.visible)];
  if (world.objGroup.visible) objs.push(world.objGroup);
  const hits = ray.intersectObjects(objs, true);
  for (const h of hits) {
    if (h.object.isInstancedMesh && h.object.userData.plantIdx) return { kind: 'plant', index: h.object.userData.plantIdx[h.instanceId] };
    let o = h.object;
    while (o && o.userData.objIdx === undefined) o = o.parent;
    if (o) return { kind: 'object', index: o.userData.objIdx };
  }
  return null;
}

// ---------------------------------------------------------------- asboblar
const BRUSH = new Set(['raise', 'lower', 'flatten', 'smooth', 'scatter', 'erase', ...COVERS.map((c) => 'cv_' + c.key)]);
const curTool = () => app.tool[app.cat];
const isBrush = () => BRUSH.has(curTool());

const CATS = [
  { id: 'relief', name: 'Relyef', icon: 'relief' },
  { id: 'cover', name: 'Qoplamalar', icon: 'cover' },
  { id: 'plants', name: "O'simliklar", icon: 'plant' },
  { id: 'objects', name: 'Kichik shakllar', icon: 'bench' },
  { id: 'irr', name: "Sug'orish", icon: 'drop' },
  { id: 'light', name: 'Yoritish', icon: 'bulb' },
];
const VIEW_TOOL = { id: 'view', name: "Ko'rish va tanlash", icon: 'pointer' };
const TOOLS = {
  relief: [VIEW_TOOL, { id: 'raise', name: "Ko'tarish", icon: 'up' }, { id: 'lower', name: 'Pasaytirish', icon: 'down' }, { id: 'flatten', name: 'Tekislash', icon: 'flat' }, { id: 'smooth', name: 'Silliqlash', icon: 'smooth' }],
  cover: [VIEW_TOOL, ...COVERS.map((c) => ({ id: 'cv_' + c.key, name: c.name, swatch: c.color }))],
  plants: [VIEW_TOOL, { id: 'plant', name: 'Bittalab ekish', icon: 'pin' }, { id: 'scatter', name: "Mo'yqalam bilan", icon: 'brush' }, { id: 'erase', name: "O'chirish", icon: 'erase' }],
  objects: [VIEW_TOOL, ...['gazebo', 'pergola', 'bench', 'shed', 'greenhouse', 'firepit'].map((t) => ({ id: 'obj_' + t, name: OBJECTS[t].name, icon: t === 'bench' ? 'bench' : 'cube' }))],
  irr: [VIEW_TOOL, { id: 'obj_sprinkler', name: "Purkagich qo'yish", icon: 'drop' }, { id: 'auto_irr', name: "Avto-sug'orish", icon: 'wand', action: true }, { id: 'clear_irr', name: 'Tarmoqni tozalash', icon: 'trash', action: true }],
  light: [VIEW_TOOL, { id: 'obj_lamp', name: "Chiroq qo'yish", icon: 'bulb' }, { id: 'auto_light', name: 'Avto-yoritish', icon: 'wand', action: true }, { id: 'clear_light', name: 'Tarmoqni tozalash', icon: 'trash', action: true }],
};

function renderCats() {
  $('#cats').innerHTML = CATS.map((c) => `<button data-cat="${c.id}" class="${app.cat === c.id ? 'on' : ''}">${icon(c.icon)}<span>${c.name}</span></button>`).join('');
}
function renderPalette() {
  const tools = TOOLS[app.cat];
  let h = `<div class="tools">${tools.map((t) => `<button class="tool ${curTool() === t.id ? 'on' : ''} ${t.action ? 'act' : ''}" data-tool="${t.id}" title="${esc(t.name)}">${t.swatch ? `<span class="sw" style="background:${t.swatch}"></span>` : icon(t.icon)}<span>${esc(t.name)}</span></button>`).join('')}</div>`;
  const tl = curTool();
  if (isBrush()) {
    h += `<div class="params"><label>Radius <input type="range" id="pRad" min="0.5" max="12" step="0.5" value="${app.radius}"><b id="vRad">${fmt(app.radius, 1)} m</b></label>`;
    if (app.cat === 'relief' && tl !== 'smooth') h += `<label>Kuch <input type="range" id="pStr" min="0.1" max="2" step="0.1" value="${app.strength}"><b id="vStr">${fmt(app.strength, 1)}</b></label>`;
    if (tl === 'scatter') h += `<label>Zichlik <input type="range" id="pDen" min="0.2" max="6" step="0.1" value="${app.density}"><b id="vDen">${fmt(app.density, 1)}/m²</b></label>`;
    h += '</div>';
  }
  if (app.cat === 'plants' && (tl === 'plant' || tl === 'scatter')) {
    const groups = {};
    for (const [id, d] of Object.entries(PLANTS)) (groups[d.group] ||= []).push([id, d]);
    h += Object.entries(groups).map(([g, list]) => `<div class="chips"><span class="muted" style="font-size:11px;width:100%">${GROUPS[g]}</span>${list.map(([id, d]) => `<button class="chip ${app.species === id ? 'on' : ''}" data-sp="${id}"><span class="dot" style="background:${d.color}"></span>${esc(d.name)}</button>`).join('')}</div>`).join('');
  }
  if (app.cat === 'objects' && tl.startsWith('obj_')) {
    h += `<div class="params"><label>Burilish <input type="range" id="pRot" min="0" max="345" step="15" value="${Math.round(app.rot * 180 / Math.PI)}"><b id="vRot">${Math.round(app.rot * 180 / Math.PI)}°</b></label><span>Klik — joylashtirish · <span class="kbd">R</span> — burish</span></div>`;
  }
  $('#palette').innerHTML = h;
  world.setCursor(cur(), 0, 0, 1, false);
}

$('#cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  app.cat = b.dataset.cat; renderCats(); renderPalette(); renderStatus();
  if (app.cat === 'irr' || app.cat === 'light') setViewMode('xray', true);
});
$('#palette').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tool]');
  if (t) {
    const id = t.dataset.tool;
    if (id === 'auto_irr') return openEngineering({ irr: true, light: false, drain: false });
    if (id === 'auto_light') return openEngineering({ irr: false, light: true, drain: false });
    if (id === 'clear_irr' || id === 'clear_light') {
      if (!editable()) return toast('Mavjud holat faqat ko\'rish uchun');
      pushUndo();
      if (id === 'clear_irr') { app.project.nets.irr = []; app.project.objects = app.project.objects.filter((o) => o.t !== 'sprinkler'); }
      else { app.project.nets.light = []; app.project.objects = app.project.objects.filter((o) => o.t !== 'lamp'); }
      refreshAll(); return toast('Tarmoq tozalandi');
    }
    app.tool[app.cat] = id; renderPalette(); renderStatus(); return;
  }
  const sp = e.target.closest('[data-sp]');
  if (sp) { app.species = sp.dataset.sp; renderPalette(); }
});
$('#palette').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  if (e.target.id === 'pRad') { app.radius = v; $('#vRad').textContent = fmt(v, 1) + ' m'; }
  if (e.target.id === 'pStr') { app.strength = v; $('#vStr').textContent = fmt(v, 1); }
  if (e.target.id === 'pDen') { app.density = v; $('#vDen').textContent = fmt(v, 1) + '/m²'; }
  if (e.target.id === 'pRot') { app.rot = v * Math.PI / 180; $('#vRot').textContent = v + '°'; }
});

// ---------------------------------------------------------------- sichqoncha
let down = null;
canvas.addEventListener('pointerdown', (e) => {
  hideMenu();
  if (app.walk) { down = { x: e.clientX, y: e.clientY, look: true }; canvas.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0) return;
  const hit = hitTerrain(e);
  down = { x: e.clientX, y: e.clientY, hit };
  if (isBrush() && hit) {
    if (!editable()) { toast("«Mavjud» rejimida tahrirlab bo'lmaydi — «Loyiha»ga o'ting"); return; }
    world.controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    pushUndo();
    app.stroke = { p: hit, last: null, target: heightAt(app.project, hit.x, hit.z), hash: buildHash(app.project), r: rng(Date.now() & 0xffff), t: 0 };
    applyStrokeAt(hit, 1 / 30);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (app.walk) {
    if (down?.look) {
      app.walk.yaw -= (e.clientX - down.x) * 0.004; app.walk.pitch -= (e.clientY - down.y) * 0.004;
      app.walk.pitch = Math.max(-1.2, Math.min(1.2, app.walk.pitch));
      down.x = e.clientX; down.y = e.clientY;
    }
    return;
  }
  const hit = hitTerrain(e);
  if (hit) {
    const s = cur();
    $('#coords').textContent = `X ${fmt(hit.x, 1)} · Y ${fmt(-hit.z, 1)} · H ${fmt(heightAt(s, hit.x, hit.z), 2)} m · ${COVERS[coverAt(s, hit.x, hit.z)].name}`;
  } else $('#coords').textContent = '';
  if (isBrush() && hit) world.setCursor(cur(), hit.x, hit.z, app.radius, true);
  else world.setCursor(cur(), 0, 0, 1, false);
  if (app.stroke && hit) {
    app.stroke.p = hit;
    if (app.cat !== 'relief') applyStrokeAt(hit, 0);
  }
});
canvas.addEventListener('pointerleave', () => { $('#coords').textContent = ''; if (!app.stroke) world.setCursor(cur(), 0, 0, 1, false); });
window.addEventListener('pointerup', (e) => {
  if (app.walk) { down = null; return; }
  if (app.stroke) { endStroke(); down = null; return; }
  if (!down || e.target !== canvas) { down = null; return; }
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved < 6 && e.button === 0) onClick(e, down.hit);
  down = null;
});

function applyStrokeAt(p, dt) {
  const s = app.project, st = app.stroke, tl = curTool(), R = app.radius;
  if (app.cat === 'relief') {
    const k = app.strength * dt * 1.5;
    if (tl === 'raise') raise(s, p.x, p.z, R, k);
    if (tl === 'lower') raise(s, p.x, p.z, R, -k);
    if (tl === 'flatten') flatten(s, p.x, p.z, R, st.target, dt * 4 * app.strength);
    if (tl === 'smooth') smooth(s, p.x, p.z, R, dt * 6);
    world.updateTerrain(false);
    st.dirty = true;
    return;
  }
  if (st.last && Math.hypot(p.x - st.last.x, p.z - st.last.z) < Math.max(0.25, R * 0.25)) return;
  st.last = p;
  if (tl.startsWith('cv_')) {
    const c = COVERS.find((cv) => 'cv_' + cv.key === tl).id;
    paintCircle(s, p.x, p.z, R, c);
    world.updateTerrain(true);
    if (c === C.WATER) world.updateWater();
    st.dirty = true;
  } else if (tl === 'scatter') {
    const tries = Math.ceil(app.density * Math.PI * R * R * 0.25) + 2;
    let added = 0;
    for (let k = 0; k < tries; k++) {
      const a = st.r() * Math.PI * 2, d = Math.sqrt(st.r()) * R;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      // zichlikka qarab minimal masofa
      const kk = Math.max(0.5, Math.min(1.6, 1 / Math.sqrt(app.density) / (PLANTS[app.species].r * 2)));
      if (canPlace(s, st.hash, app.species, x, z, kk)) { addPlant(s, st.hash, app.species, x, z, st.r); added++; }
    }
    if (added) st.plantsDirty = true;
  } else if (tl === 'erase') {
    const n = s.plants.length;
    s.plants = s.plants.filter((pl) => Math.hypot(pl.x - p.x, pl.z - p.z) > R);
    if (s.plants.length !== n) { st.plantsDirty = true; st.hash = buildHash(s); app.sel = null; world.setSelection(null); }
  }
}

function endStroke() {
  world.controls.enabled = true;
  const st = app.stroke; app.stroke = null;
  world.updateTerrain(true); world.updateWater(); world.updateContours();
  world.updatePlants(); world.updateObjects(); world.updateNets();
  world.clearMarkers();
  if (!st.dirty && !st.plantsDirty) app.undo.pop();
  afterEdit();
}

function onClick(e, hit) {
  const tl = curTool();
  if (tl === 'view' || !hit) {
    app.sel = hitSelectable(e);
    world.setSelection(app.sel);
    if (app.sel) { app.tab = 'xossa'; renderTabs(); }
    renderTab();
    return;
  }
  if (!editable()) return toast("«Mavjud» rejimida tahrirlab bo'lmaydi — «Loyiha»ga o'ting");
  const s = app.project;
  if (tl === 'plant') {
    if (HARD.has(coverAt(s, hit.x, hit.z))) return toast("Qattiq qoplamaga ekib bo'lmaydi");
    pushUndo();
    addPlant(s, null, app.species, hit.x, hit.z, rng(Date.now() & 0xffff));
    app.sel = { kind: 'plant', index: s.plants.length - 1 };
    world.updatePlants(); world.setSelection(app.sel); afterEdit();
  } else if (tl.startsWith('obj_')) {
    const t = tl.slice(4);
    pushUndo();
    s.objects.push({ t, x: hit.x, z: hit.z, rot: app.rot });
    app.sel = { kind: 'object', index: s.objects.length - 1 };
    world.updateObjects(); world.setSelection(app.sel); afterEdit();
  }
}

function afterEdit() {
  app.norms = null;
  renderStatus(); renderHeader(); renderTab(); scheduleSave();
}

function refreshAll() {
  world.setSnapshot(cur());
  world.setSelection(app.sel);
  renderHeader(); renderStatus(); renderTab(); renderRail(); scheduleSave();
}

// ---------------------------------------------------------------- klaviatura
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) { if (e.key === 'Escape') e.target.blur(); return; }
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); return redo(); }
  if (app.walk) {
    if (k === 'escape') return exitWalk();
    keys.add(e.code); return;
  }
  if (k === 'escape') { hideMenu(); closeModal(); app.sel = null; world.setSelection(null); renderTab(); }
  if ((k === 'delete' || k === 'backspace') && app.sel) { e.preventDefault(); deleteSel(); }
  if (k === 'r') {
    if (app.sel?.kind === 'object' && editable()) { pushUndo(); app.project.objects[app.sel.index].rot = ((app.project.objects[app.sel.index].rot || 0) + Math.PI / 12) % (Math.PI * 2); world.updateObjects(); world.setSelection(app.sel); afterEdit(); }
    else if (app.cat === 'objects') { app.rot = (app.rot + Math.PI / 12) % (Math.PI * 2); renderPalette(); }
  }
  if (k === 'n') setNight(!world.night);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

function deleteSel() {
  if (!app.sel || !editable()) return;
  pushUndo();
  if (app.sel.kind === 'plant') app.project.plants.splice(app.sel.index, 1);
  else app.project.objects.splice(app.sel.index, 1);
  app.sel = null;
  world.updatePlants(); world.updateObjects(); world.setSelection(null); world.clearMarkers();
  afterEdit(); toast("O'chirildi");
}

// ---------------------------------------------------------------- sayr rejimi
function enterWalk() {
  closeModal(); hideMenu();
  const s = cur();
  const gate = s.meta?.gate || [0, HALF_D];
  app.walk = { x: gate[0], z: HALF_D - 1.5, yaw: 0, pitch: -0.05, vel: 0 };
  world.controls.enabled = false;
  document.body.classList.add('walking');
  $('#walkhud').hidden = false;
  world.setCursor(s, 0, 0, 1, false);
}
function exitWalk() {
  if (!app.walk) return;
  app.walk = null; keys.clear();
  document.body.classList.remove('walking');
  $('#walkhud').hidden = true;
  world.controls.enabled = true;
  world.view('all');
  renderRail();
}
const pad = new Set();
$('#walkhud').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  if (b.dataset.k === 'exit') return exitWalk();
  pad.add(b.dataset.k);
});
window.addEventListener('pointerup', () => pad.clear());

function stepWalk(dt) {
  const w = app.walk;
  const f = (keys.has('KeyW') || keys.has('ArrowUp') || pad.has('fw') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') || pad.has('bw') ? 1 : 0);
  const sd = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const turn = (keys.has('ArrowLeft') || pad.has('lt') ? 1 : 0) - (keys.has('ArrowRight') || pad.has('rt') ? 1 : 0);
  w.yaw += turn * dt * 1.6;
  const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 6 : 2.6) * dt;
  const fx = -Math.sin(w.yaw), fz = -Math.cos(w.yaw);
  const rx = Math.cos(w.yaw), rz = -Math.sin(w.yaw); // o'ng tomon vektori
  w.x += (fx * f + rx * sd) * sp;
  w.z += (fz * f + rz * sd) * sp;
  w.x = Math.max(-HALF_W - 4, Math.min(HALF_W + 4, w.x)); w.z = Math.max(-HALF_D - 4, Math.min(HALF_D + 4, w.z));
  const s = cur();
  const gy = inSite(w.x, w.z) ? Math.max(heightAt(s, w.x, w.z), coverAt(s, w.x, w.z) === C.WATER ? heightAt(s, w.x, w.z) + 0.45 : -99) : 0;
  const cam = world.camera;
  cam.position.set(w.x, gy + 1.7, w.z);
  const look = new THREE.Vector3(w.x + Math.sin(w.yaw) * -Math.cos(w.pitch), gy + 1.7 + Math.sin(w.pitch), w.z - Math.cos(w.yaw) * Math.cos(w.pitch));
  cam.lookAt(look);
}

// ---------------------------------------------------------------- ko'rinish
function setNight(on) { world.setNight(on); renderRail(); toast(on ? 'Tungi rejim — chiroqlar yoqildi' : 'Kunduzgi rejim'); }
function setViewMode(m, quiet) {
  world.viewMode = m; world.applyVisibility(); renderRail();
  if (!quiet) toast({ surface: "Yuza: yer, o'simliklar va inshootlar", xray: "Ochilgan: yer shaffof, yer osti tarmoqlari ko'rinadi", nets: 'Faqat tarmoqlar' }[m]);
}

function renderRail() {
  const b = (id, ic, tip, on) => `<button class="ibtn ${on ? 'on' : ''}" data-r="${id}" data-tip="${tip}">${icon(ic)}</button>`;
  $('#rail').innerHTML = [
    b('views', 'compass', "Ko'rinishlar"),
    b('layers', 'layers', 'Qatlamlar', app.tab === 'qatlam'),
    b('mode', 'cube', "Ko'rinish rejimi: yuza / ochilgan / tarmoqlar", world.viewMode !== 'surface'),
    b('contours', 'contour', 'Belgilar va gorizontallar', world.layers.contours),
    b('night', world.night ? 'moon' : 'sun', 'Kun / tun', world.night),
    '<div class="sep"></div>',
    b('walk', 'walk', "Bog' bo'ylab sayr", !!app.walk),
    b('render', 'camera', 'Render (surat)'),
    b('norms', 'check', 'Normakontrol', world.markerGroup.children.length > 0),
    b('plan', 'sparkle', 'Avto-rejalash'),
    b('eng', 'pipe', 'Avto-injeneriya'),
  ].join('');
}
$('#rail').addEventListener('click', (e) => {
  const b = e.target.closest('[data-r]'); if (!b) return;
  const r = b.dataset.r;
  if (r === 'views') showMenu(b, [
    { t1: 'Butun uchastka', t2: 'Yuqoridan 3/4 ko\'rinish', icon: 'compass', fn: () => world.view('all') },
    { t1: "Old tomondan", t2: "Ko'cha tomondan perspektiva", icon: 'eye', fn: () => world.view('front') },
    { t1: 'Reja (yuqoridan)', t2: 'Bosh reja ko\'rinishi', icon: 'cover', fn: () => world.view('top') },
    { t1: "Yon tomondan", t2: 'Sharqiy fasad', icon: 'cube', fn: () => world.view('side') },
    { t1: "Bog' bo'ylab sayr", t2: "Ko'z balandligida · Esc — chiqish", icon: 'walk', fn: enterWalk },
    { t1: 'Render…', t2: 'Modeldan surat', icon: 'camera', fn: openRender },
  ]);
  if (r === 'layers') { app.tab = 'qatlam'; renderTabs(); renderTab(); renderRail(); }
  if (r === 'mode') showMenu(b, [
    { t1: 'Yuza', t2: "Yer, o'simliklar va inshootlar qanday bo'lsa", icon: 'eye', on: world.viewMode === 'surface', fn: () => setViewMode('surface') },
    { t1: 'Ochilgan', t2: "Yer shaffof, yer osti tarmoqlari ko'rinadi", icon: 'layers', on: world.viewMode === 'xray', fn: () => setViewMode('xray') },
    { t1: 'Faqat tarmoqlar', t2: "Yer va inshootlarsiz tarmoqlar", icon: 'pipe', on: world.viewMode === 'nets', fn: () => setViewMode('nets') },
  ]);
  if (r === 'contours') { world.layers.contours = !world.layers.contours; world.applyVisibility(); renderRail(); toast(world.layers.contours ? "Gorizontallar: har 0,25 m" : 'Gorizontallar yashirildi'); }
  if (r === 'night') setNight(!world.night);
  if (r === 'walk') enterWalk();
  if (r === 'render') openRender();
  if (r === 'norms') openNorms();
  if (r === 'plan') openAutoplan();
  if (r === 'eng') openEngineering();
});

// ---------------------------------------------------------------- menyu / modal / toast
function showMenu(anchor, items) {
  const m = $('#menu');
  m.innerHTML = items.map((it, i) => `<button class="mi ${it.on ? 'on' : ''}" data-i="${i}">${icon(it.icon || 'pointer')}<div><div class="t1">${esc(it.t1)}</div>${it.t2 ? `<div class="t2">${esc(it.t2)}</div>` : ''}</div></button>`).join('');
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = r.left - mw - 10, top = r.top;
  if (left < 8) left = Math.min(window.innerWidth - mw - 8, r.left);
  if (left === r.left) top = r.bottom + 8;
  m.style.left = Math.max(8, left) + 'px';
  m.style.top = Math.max(8, Math.min(window.innerHeight - mh - 8, top)) + 'px';
  m.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; hideMenu(); items[+b.dataset.i].fn(); };
}
function hideMenu() { $('#menu').hidden = true; }
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#menu') && !e.target.closest('[data-r]') && !e.target.closest('#btnExport')) hideMenu(); });

function openModal(title, body, foot = []) {
  $('#mtitle').textContent = title;
  const mb = $('#mbody'); mb.innerHTML = ''; if (typeof body === 'string') mb.innerHTML = body; else mb.append(body);
  const mf = $('#mfoot'); mf.innerHTML = '';
  for (const f of foot) {
    const b = document.createElement('button'); b.className = 'btn ' + (f.cls || ''); b.textContent = f.label; b.onclick = f.fn; mf.append(b);
  }
  $('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; }
$('#mclose').onclick = closeModal;
$('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });

let toastT = 0;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
}

// ---------------------------------------------------------------- sarlavha va holat
function renderHeader() {
  const s = cur();
  $('#projName').textContent = app.shown === 'base' ? "Mavjud holat (syomka)" : s.name;
  $('#projSub').textContent = `${fmt(AREA)} m² · ${fmt(AREA / 100)} sotix · ${fmt(s.plants.length)} o'simlik`;
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === app.shown));
}
$('#modeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]'); if (!b) return;
  app.shown = b.dataset.mode; app.sel = null;
  refreshAll();
  toast(app.shown === 'base' ? "Mavjud holat: tahrir o'chirilgan" : 'Loyiha');
});

function renderStatus() {
  const s = cur();
  const el = $('#status');
  if (app.cat === 'relief') {
    const { cut, fill } = earthwork(s);
    const bal = fill - cut;
    const changed = cut + fill > 0.05;
    const title = !changed ? "Relyef o'zgarishsiz" : bal > 0.5 ? 'Grunt yetmaydi' : bal < -0.5 ? 'Ortiqcha grunt' : 'Grunt balansi';
    el.innerHTML = `<div class="grow"><div class="ttl">${title}</div><div class="lbl">${changed ? `O'zgargan: ${fmt(Math.abs(bal), 1)} m³ ${bal > 0 ? 'olib kelish' : 'olib ketish'}` : "Maydon yoki mo'yqalam qo'shing"}</div></div>
      <div><div class="lbl">Qazish</div><div class="num ${cut < 0.05 ? 'ok' : ''}">${fmt(cut, 1)} m³</div></div>
      <div><div class="lbl">To'kish</div><div class="num ${fill < 0.05 ? 'ok' : ''}">${fmt(fill, 1)} m³</div></div>`;
    return;
  }
  if (app.cat === 'irr' || app.cat === 'light') {
    const L1 = netLength(s.nets.irr), L2 = netLength(s.nets.light), L3 = netLength(s.nets.drain);
    el.innerHTML = `<div class="grow"><div class="ttl">Tarmoqlar</div><div class="lbl">${fmt(s.objects.filter((o) => o.t === 'lamp').length)} chiroq · ${fmt(s.objects.filter((o) => o.t === 'sprinkler').length)} purkagich</div></div>
      <div><div class="lbl">Sug'orish</div><div class="big">${fmt(L1)} m</div></div><div><div class="lbl">Kabel</div><div class="big">${fmt(L2)} m</div></div><div><div class="lbl">Drenaj</div><div class="big">${fmt(L3)} m</div></div>`;
    return;
  }
  const st = plantStats(s);
  const g = st.byGroup;
  el.innerHTML = `<div class="grow"><div class="ttl">O'simliklar</div><div class="lbl">${fmt(st.total)} loyihada</div></div>
    <div><div class="lbl">Daraxt</div><div class="big">${fmt(g.tree || 0)}</div></div>
    <div><div class="lbl">Buta</div><div class="big">${fmt(g.shrub || 0)}</div></div>
    <div><div class="lbl">Ko'p yillik</div><div class="big">${fmt((g.perennial || 0) + (g.grass || 0))}</div></div>
    <div><div class="lbl">Yer qopl.</div><div class="big">${fmt(g.ground || 0)}</div></div>`;
}

// ---------------------------------------------------------------- yorliqlar (tabs)
const TABS = [['agent', 'Agent'], ['tarkib', 'Tarkib'], ['xossa', 'Xossalar'], ['qatlam', 'Qatlamlar'], ['uchastka', 'Uchastka']];
function renderTabs() { $('#tabs').innerHTML = TABS.map(([id, n]) => `<button data-tab="${id}" class="${app.tab === id ? 'on' : ''}">${n}</button>`).join(''); }
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  app.tab = b.dataset.tab; renderTabs(); renderTab(); renderRail();
  $('#sheet').classList.remove('min');
});
$('#grab').addEventListener('click', () => $('#sheet').classList.toggle('min'));

function renderTab() {
  const s = cur(), tb = $('#tabbody');
  if (app.tab === 'agent') {
    tb.innerHTML = `<div class="chat" id="chat">${app.chat.map((m) => `<div class="msg ${m.who}">${m.html || esc(m.text)}</div>`).join('')}</div>
      <div class="chips" style="margin-top:10px">${HELP.slice(0, 6).map((h) => `<button class="chip" data-ask="${esc(h)}">${esc(h)}</button>`).join('')}</div>
      <form class="agentbar" id="agentForm"><input class="field" id="agentIn" placeholder="Buyruq yozing… masalan: hovuz R 4" autocomplete="off"><button class="ibtn primary">${icon('send')}</button></form>`;
    tb.scrollTop = tb.scrollHeight;
    return;
  }
  if (app.tab === 'tarkib') {
    const st = plantStats(s);
    const rows = Object.entries(st.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<tr><td><span class="dot" style="background:${PLANTS[t].color}"></span>${esc(PLANTS[t].name)} <small>${esc(PLANTS[t].latin)}</small></td><td>${fmt(n)} dona</td></tr>`).join('');
    const ca = coverAreas(s);
    const cv = COVERS.filter((c) => ca[c.id] > 0.1).map((c) => `<tr><td><span class="dot" style="background:${c.color};border-radius:3px"></span>${c.name}</td><td>${fmt(ca[c.id], 1)} m²</td></tr>`).join('');
    const oc = {}; for (const o of s.objects) oc[o.t] = (oc[o.t] || 0) + 1;
    const ob = Object.entries(oc).map(([t, n]) => `<tr><td>${OBJECTS[t].name}</td><td>${n} dona</td></tr>`).join('');
    const { cut, fill } = earthwork(s);
    tb.innerHTML = `<div class="card"><div class="k">Loyiha varianti</div><div class="v">${esc(app.shown === 'base' ? 'Mavjud holat' : s.name)}</div><div class="muted" style="font-size:12px;margin-top:3px">Uchastka ${SITE.W} × ${SITE.D} m · ${fmt(AREA)} m² · qazish ${fmt(cut, 1)} m³ / to'kish ${fmt(fill, 1)} m³</div></div>
      <h4>Ko'kalamzorlashtirish vedomosti</h4><table class="t"><tr><td><b>Ekishlar jami</b></td><td>${fmt(st.total)} dona</td></tr>${rows || '<tr><td class="muted">Hali o\'simlik yo\'q</td><td></td></tr>'}</table>
      <h4>Qoplamalar</h4><table class="t">${cv}</table>
      <h4>Inshootlar va kichik shakllar</h4><table class="t">${ob || '<tr><td class="muted">Yo\'q</td><td></td></tr>'}</table>
      <h4>Muhandislik tarmoqlari</h4><table class="t"><tr><td><span class="dot" style="background:#2f8fe0"></span>Sug'orish</td><td>${fmt(netLength(s.nets.irr), 1)} m</td></tr><tr><td><span class="dot" style="background:#f2b632"></span>Yoritish kabeli</td><td>${fmt(netLength(s.nets.light), 1)} m</td></tr><tr><td><span class="dot" style="background:#a05a2c"></span>Drenaj</td><td>${fmt(netLength(s.nets.drain), 1)} m · ${s.nets.wells.length} quduq</td></tr></table>
      <div class="row" style="margin-top:12px"><button class="btn sm" data-act="csv">${'Vedomost CSV'}</button><button class="btn sm" data-act="norms">Normakontrol</button></div>`;
    return;
  }
  if (app.tab === 'xossa') {
    const sel = app.sel;
    if (sel?.kind === 'plant' && s.plants[sel.index]) {
      const p = s.plants[sel.index], d = PLANTS[p.t];
      tb.innerHTML = `<div class="card"><div class="k">${GROUPS[d.group]}</div><div class="v">${esc(d.name)}</div><div class="muted">${esc(d.ru)} · <i>${esc(d.latin)}</i></div></div>
        <table class="t"><tr><td>Balandlik</td><td>${fmt(d.h * p.s, 1)} m</td></tr><tr><td>Toj diametri</td><td>${fmt(d.r * p.s * 2, 1)} m</td></tr>
        <tr><td>Koordinata</td><td>X ${fmt(p.x, 2)} · Y ${fmt(-p.z, 2)}</td></tr><tr><td>Yer belgisi</td><td>${fmt(heightAt(s, p.x, p.z), 2)} m</td></tr><tr><td>Qoplama</td><td>${COVERS[coverAt(s, p.x, p.z)].name}</td></tr></table>
        <h4>Turini almashtirish</h4><select class="field" id="selSpecies">${Object.entries(PLANTS).map(([id, dd]) => `<option value="${id}" ${id === p.t ? 'selected' : ''}>${esc(dd.name)} — ${GROUPS[dd.group]}</option>`).join('')}</select>
        <div class="row" style="margin-top:10px"><button class="btn danger" data-act="del">${icon('trash')} O'chirish</button></div>`;
      return;
    }
    if (sel?.kind === 'object' && s.objects[sel.index]) {
      const o = s.objects[sel.index], d = OBJECTS[o.t];
      tb.innerHTML = `<div class="card"><div class="k">Inshoot</div><div class="v">${esc(d.name)}</div></div>
        <table class="t"><tr><td>O'lcham</td><td>${fmt(d.w, 1)} × ${fmt(d.d, 1)} m, h ${fmt(d.h, 1)} m</td></tr><tr><td>Koordinata</td><td>X ${fmt(o.x, 2)} · Y ${fmt(-o.z, 2)}</td></tr><tr><td>Burilish</td><td>${Math.round((o.rot || 0) * 180 / Math.PI)}°</td></tr></table>
        <div class="row" style="margin-top:10px"><button class="btn" data-act="rot">${icon('rotate')} Burish 15°</button>${o.t !== 'house' ? `<button class="btn danger" data-act="del">${icon('trash')} O'chirish</button>` : ''}</div>`;
      return;
    }
    tb.innerHTML = `<p class="muted">Modelda o'simlik yoki inshootni tanlang (asbob: <b>Ko'rish va tanlash</b>). Tanlangan obyektni <span class="kbd">Delete</span> bilan o'chirish, <span class="kbd">R</span> bilan burish mumkin.</p>
      <h4>Boshqaruv</h4><table class="t"><tr><td>Aylantirish</td><td>chap tugma + sudrash</td></tr><tr><td>Siljitish</td><td>o'ng tugma / 2 barmoq</td></tr><tr><td>Masshtab</td><td>g'ildirak / chimchilash</td></tr><tr><td>Bekor qilish</td><td><span class="kbd">Ctrl+Z</span></td></tr><tr><td>Kun / tun</td><td><span class="kbd">N</span></td></tr></table>`;
    return;
  }
  if (app.tab === 'qatlam') {
    const L = world.layers;
    const ck = (k, n, sw) => `<label class="check"><input type="checkbox" data-layer="${k}" ${L[k] ? 'checked' : ''}>${sw ? `<span class="dot" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${sw}"></span>` : ''}${n}</label>`;
    tb.innerHTML = `<h4>Ko'rinish rejimi</h4><div class="seg" style="display:inline-flex">${[['surface', 'Yuza'], ['xray', 'Ochilgan'], ['nets', 'Tarmoqlar']].map(([m, n]) => `<button data-vm="${m}" class="${world.viewMode === m ? 'on' : ''}">${n}</button>`).join('')}</div>
      <h4>Relyef</h4>${ck('terrain', 'Yer yuzasi va qoplamalar')}${ck('contours', 'Gorizontallar (0,25 m)')}${ck('boundary', 'Uchastka chegarasi')}
      <h4>O'simliklar</h4>${Object.entries(GROUPS).map(([g, n]) => ck(g, n)).join('')}
      <h4>Inshootlar</h4>${ck('objects', 'Uy, shiypon, kichik shakllar, chiroqlar')}
      <h4>Yer osti tarmoqlari</h4>${ck('irr', "Sug'orish", '#2f8fe0')}${ck('light', 'Yoritish kabeli', '#f2b632')}${ck('drain', 'Drenaj', '#a05a2c')}
      <h4>Tekshiruv</h4>${ck('markers', 'Normakontrol belgilari', '#e5322d')}`;
    return;
  }
  if (app.tab === 'uchastka') {
    let mn = Infinity, mx = -Infinity; for (const v of s.heights) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    tb.innerHTML = `<h4>Loyiha nomi</h4><input class="field" id="pname" value="${esc(app.project.name)}">
      <h4>Uchastka</h4><table class="t"><tr><td>O'lcham</td><td>${SITE.W} × ${SITE.D} m</td></tr><tr><td>Maydon</td><td>${fmt(AREA)} m² (${fmt(AREA / 100)} sotix)</td></tr><tr><td>Belgilar oralig'i</td><td>${fmt(mn, 2)} … ${fmt(mx, 2)} m</td></tr><tr><td>Balandlik farqi</td><td>${fmt(mx - mn, 2)} m</td></tr><tr><td>Relyef to'ri</td><td>${SITE.CELL} m</td></tr></table>
      <h4>Loyiha</h4><div class="row wrap"><button class="btn sm" data-act="saveJson">${icon('save')} Faylga saqlash</button><button class="btn sm" data-act="openJson">${icon('folder')} Fayldan ochish</button></div>
      <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="empty">Bo'sh loyiha (mavjud holatdan)</button><button class="btn sm" data-act="demo">Namuna loyiha</button></div>
      <p class="muted" style="margin-top:14px">Loyiha brauzerda avtomatik saqlanadi. Floran 3D — relyef, qoplamalar, o'simliklar va yer osti tarmoqlari bitta 3D modelda.</p>`;
  }
}

$('#tabbody').addEventListener('click', (e) => {
  const ask = e.target.closest('[data-ask]');
  if (ask) { runAgent(ask.dataset.ask); return; }
  const vm = e.target.closest('[data-vm]');
  if (vm) { setViewMode(vm.dataset.vm); renderTab(); return; }
  const a = e.target.closest('[data-act]')?.dataset.act;
  if (!a) return;
  if (a === 'csv') download(`${app.project.name}-vedomost.csv`, plantScheduleCSV(cur()), 'text/csv');
  if (a === 'norms') openNorms();
  if (a === 'del') deleteSel();
  if (a === 'rot' && editable()) { pushUndo(); const o = app.project.objects[app.sel.index]; o.rot = ((o.rot || 0) + Math.PI / 12) % (Math.PI * 2); world.updateObjects(); world.setSelection(app.sel); afterEdit(); }
  if (a === 'saveJson') saveJson();
  if (a === 'openJson') $('#fileOpen').click();
  if (a === 'empty') { pushUndo(); app.project = cloneSnap(app.base); app.project.name = 'Yangi loyiha'; app.project.meta = app.base.meta; app.shown = 'project'; refreshAll(); toast("Bo'sh loyiha yaratildi (Ctrl+Z — qaytarish)"); }
  if (a === 'demo') { pushUndo(); const b = app.base; app.project = generateLayout(b, { style: 'natural' }, 5); app.project.name = "Bog' — Namuna loyiha"; app.shown = 'project'; refreshAll(); toast('Namuna loyiha yuklandi'); }
});
$('#tabbody').addEventListener('change', (e) => {
  if (e.target.dataset.layer) { world.layers[e.target.dataset.layer] = e.target.checked; world.applyVisibility(); renderRail(); }
  if (e.target.id === 'selSpecies' && app.sel?.kind === 'plant' && editable()) { pushUndo(); app.project.plants[app.sel.index].t = e.target.value; world.updatePlants(); world.setSelection(app.sel); afterEdit(); }
  if (e.target.id === 'pname') { app.project.name = e.target.value || 'Loyiha'; renderHeader(); scheduleSave(); }
});
$('#tabbody').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#agentIn').value.trim(); if (v) runAgent(v);
});

// ---------------------------------------------------------------- agent
function bestSpot(s, r, pos = {}) {
  let best = [0, 0], bs = -Infinity;
  for (let z = -HALF_D + r; z <= HALF_D - r; z += 1.5) for (let x = -HALF_W + r; x <= HALF_W - r; x += 1.5) {
    if (pos.x !== undefined && Math.abs(x - pos.x) > 9) continue;
    if (pos.z !== undefined && Math.abs(z - pos.z) > 7) continue;
    let sc = 0, bad = 0;
    forEachInRadius(x, z, r, (i) => { if (HARD.has(s.cover[i]) || s.cover[i] === C.BED) bad++; else sc++; });
    for (const o of s.objects) if (o.t !== 'lamp' && o.t !== 'sprinkler') sc -= Math.max(0, r + 2 - distToRect(x, z, objectRect(o))) * 30;
    for (const p of s.plants) if (PLANTS[p.t].group === 'tree') sc -= Math.max(0, r - Math.hypot(p.x - x, p.z - z)) * 3;
    sc -= bad * 4;
    if (sc > bs) { bs = sc; best = [x, z]; }
  }
  return best;
}

function runAgent(text) {
  app.chat.push({ who: 'me', text });
  const reply = (t) => app.chat.push({ who: 'bot', html: t });
  const c = parseCmd(text);
  const needEdit = ['hill', 'pond', 'flatten', 'plant', 'removePlants'].includes(c.intent);
  if (needEdit && app.shown !== 'project') { app.shown = 'project'; refreshAll(); }
  const s = app.project;
  switch (c.intent) {
    case 'hill': {
      const [x, z] = c.pos.center || (c.pos.x === undefined && c.pos.z === undefined) ? bestSpot(s, c.r, c.pos) : bestSpot(s, c.r, c.pos);
      pushUndo();
      const before = earthwork(s);
      raise(s, x, z, c.r, c.h);
      const after = earthwork(s);
      const dv = (after.fill - before.fill) - (after.cut - before.cut);
      world.setSnapshot(s); app.cat = 'relief'; renderCats(); renderPalette();
      world.flyTo([x + c.r * 3, Math.max(8, c.r * 2.4), z + c.r * 3.4], [x, Math.max(0, c.h / 2), z]);
      reply(`Tayyor: ${c.h > 0 ? 'tepalik' : 'chuqurlik'} ${fmt(Math.abs(c.h), 1)} m, R ${fmt(c.r, 1)} m — nuqta X ${fmt(x, 1)}, Y ${fmt(-z, 1)}.\n${c.h > 0 ? "To'kish" : 'Qazish'}: <b>${fmt(Math.abs(dv), 1)} m³</b> — ${c.h > 0 ? 'shuncha grunt olib kelish kerak' : 'shuncha grunt chiqariladi'}.`);
      break;
    }
    case 'pond': {
      const [x, z] = bestSpot(s, c.r + 1, c.pos);
      pushUndo();
      paintCircle(s, x, z, c.r, C.WATER);
      const n0 = s.plants.length;
      s.plants = s.plants.filter((p) => Math.hypot(p.x - x, p.z - z) > c.r);
      world.setSnapshot(s);
      world.flyTo([x + c.r * 3, c.r * 2.5 + 4, z + c.r * 3.5], [x, 0, z]);
      reply(`Hovuz qazildi: R ${fmt(c.r, 1)} m, suv yuzasi ≈ <b>${fmt(Math.PI * c.r * c.r, 1)} m²</b>, chuqurlik 0,6 m.${n0 - s.plants.length ? `\nHovuz o'rnidagi ${n0 - s.plants.length} ta o'simlik olib tashlandi.` : ''}`);
      break;
    }
    case 'flatten': {
      const [x, z] = bestSpot(s, c.r, c.pos);
      pushUndo();
      flatten(s, x, z, c.r, heightAt(s, x, z), 1);
      world.setSnapshot(s);
      reply(`R ${fmt(c.r, 1)} m maydon ${fmt(heightAt(s, x, z), 2)} m belgida tekislandi.`);
      break;
    }
    case 'plant': {
      pushUndo();
      const d = PLANTS[c.species];
      const r = rng(Date.now() & 0xffff);
      const hash = buildHash(s);
      let n = 0;
      const tall = d.group === 'tree' ? (d.h >= 8 ? 4.2 : 2.2) : 1.2;
      for (let k = 0; k < c.n * 60 && n < c.n; k++) {
        let x, z;
        if (c.pos.border) {
          const per = 2 * (SITE.W + SITE.D) - 8 * tall;
          let t = r() * per;
          const w = SITE.W - 2 * tall, dd = SITE.D - 2 * tall;
          if (t < w) { x = -HALF_W + tall + t; z = -HALF_D + tall; }
          else if ((t -= w) < dd) { x = HALF_W - tall; z = -HALF_D + tall + t; }
          else if ((t -= dd) < w) { x = HALF_W - tall - t; z = HALF_D - tall; }
          else { t -= w; x = -HALF_W + tall; z = HALF_D - tall - t; }
          // chegaradan ichkariga 0–3 m polosa
          const inset = r() * 3;
          x += x <= -HALF_W + tall + 0.01 ? inset : x >= HALF_W - tall - 0.01 ? -inset : 0;
          z += z <= -HALF_D + tall + 0.01 ? inset : z >= HALF_D - tall - 0.01 ? -inset : 0;
        } else {
          const cx = c.pos.x ?? 0, cz = c.pos.z ?? 0;
          const spread = c.pos.x !== undefined || c.pos.z !== undefined ? 10 : 28;
          x = cx + (r() - 0.5) * 2 * spread; z = cz + (r() - 0.5) * 2 * Math.min(spread, 18);
        }
        if (canPlace(s, hash, c.species, x, z, 0.9)) { addPlant(s, hash, c.species, x, z, r); n++; }
      }
      if (!n) { app.undo.pop(); reply(`${esc(d.name)} uchun bo'sh joy topilmadi. Avval joy bo'shating yoki boshqa hududni ko'rsating.`); break; }
      world.updatePlants();
      reply(`Ekildi: <b>${n} ta ${esc(d.name)}</b>${c.pos.border ? " — chegara bo'ylab, normaga muvofiq masofada" : ''}.${n < c.n ? `\n(${c.n - n} tasiga joy yetmadi.)` : ''}`);
      break;
    }
    case 'removePlants': {
      const all = /barch|hamma|все|all/.test(text.toLowerCase());
      if (!c.species && !all) { reply("Qaysi turni o'chiray? Masalan: «qayinlarni o'chir». Hammasini o'chirish uchun: «barcha o'simliklarni o'chir»."); break; }
      pushUndo();
      const n0 = s.plants.length;
      s.plants = all ? [] : s.plants.filter((p) => p.t !== c.species);
      world.updatePlants(); app.sel = null; world.setSelection(null);
      reply(`${n0 - s.plants.length} ta o'simlik o'chirildi. Qaytarish: Ctrl+Z yoki «bekor qil».`);
      break;
    }
    case 'night': setNight(c.value); reply(c.value ? "Tungi rejim: chiroqlar va deraza yoritilishi yoqildi." : 'Kunduzgi rejim.'); break;
    case 'norms': reply('Normakontrolni ochyapman…'); openNorms(); break;
    case 'engineering': reply("Avto-injeneriya oynasini ochyapman — sug'orish, yoritish va drenajni hisoblayman."); openEngineering(); break;
    case 'autoplan': reply('Avto-rejalash oynasini ochyapman.'); openAutoplan(); break;
    case 'walk': reply("Sayr rejimi: WASD bilan yuring, Esc — chiqish."); enterWalk(); break;
    case 'render': reply('Render oynasi.'); openRender(); break;
    case 'undo': undo(); reply('Oxirgi amal bekor qilindi.'); break;
    case 'help': reply('Men quyidagilarni tushunaman:\n• ' + HELP.join('\n• ') + '\n\nO\'zbek, rus yoki ingliz tilida yozish mumkin.'); break;
    default: reply(c.hint || "Buyruqni tushunmadim. «yordam» deb yozing — misollarni ko'rsataman.");
  }
  afterEdit();
  app.tab = 'agent'; renderTabs(); renderTab();
  setTimeout(() => $('#agentIn')?.focus(), 0);
}

// ---------------------------------------------------------------- normakontrol
function openNorms() {
  const s = cur();
  const res = app.norms = checkNorms(s);
  const body = `<p class="muted">Variant «${esc(app.shown === 'base' ? 'Mavjud holat' : s.name)}»: ekishlar, inshootlar va tarmoqlar SP/SNiP talablari bo'yicha tekshirildi.</p>
    <div class="card"><div class="k">Topilgan chetlanishlar</div><div class="v" style="color:${res.total ? 'var(--red)' : 'var(--green-2)'};font-size:22px">${fmt(res.total)}</div></div>
    <div class="rules">${RULES.map((r) => `<div class="rule"><div><b>${r.name}</b><small>${r.ref} · ${r.hint}</small></div><span class="n ${res.byRule[r.id].length ? '' : 'ok'}">${res.byRule[r.id].length}</span></div>`).join('')}</div>`;
  openModal('Normakontrol', body, [
    { label: 'CSV', fn: () => download(`${s.name}-normakontrol.csv`, normsCSV(s, res), 'text/csv') },
    { label: 'Belgilarni olib tashlash', fn: () => { world.clearMarkers(); renderRail(); closeModal(); } },
    { label: 'Hammasini modelda belgilash', cls: 'primary', fn: () => {
      const all = [...new Set(Object.values(res.byRule).flat())];
      world.layers.markers = true; world.setMarkers(all); renderRail(); closeModal();
      toast(`${all.length} ta o'simlik qizil belgi bilan ko'rsatildi`);
    } },
  ]);
}

// ---------------------------------------------------------------- avto-rejalash
function openAutoplan() {
  const o = { terrace: true, rest: true, garden: true, utility: true, pond: true };
  const body = document.createElement('div');
  body.innerHTML = `<p class="muted">Dastur uchastkani o'rganadi — quyosh, soya, nishab, qo'shnilar, mavjud uy va daraxtlar — va tanlangan zonalar bilan o'nlab rejalash variantlarini quradi. Har bir variant nazorat varaqasi (10 band) va normakontrol bo'yicha baholanadi.</p>
    <div class="row wrap">${[['terrace', 'Uy oldida terrasa'], ['rest', 'Dam olish zonasi + shiypon'], ['garden', 'Ekin maydoni va issiqxona'], ['utility', "Xo'jalik zonasi"], ['pond', 'Suv havzasi']].map(([k, n]) => `<label class="check" style="width:48%"><input type="checkbox" data-o="${k}" checked>${n}</label>`).join('')}</div>
    <h4>Uslub</h4><div class="chips" id="styles"><button class="chip on" data-st="all">Barcha uslublar</button>${Object.entries(STYLES).map(([k, v]) => `<button class="chip" data-st="${k}">${v.name}</button>`).join('')}</div>
    <div id="apOut"></div>`;
  let style = 'all';
  body.addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; style = b.dataset.st; body.querySelectorAll('[data-st]').forEach((x) => x.classList.toggle('on', x === b)); });
  body.addEventListener('change', (e) => { if (e.target.dataset.o) o[e.target.dataset.o] = e.target.checked; });
  let chosen = null, variants = [];
  const make = () => {
    if (!chosen) return toast('Avval variantni tanlang');
    pushUndo();
    const v = chosen.snap;
    v.name = `Variant ${chosen.name.replace(". ", " · ")}`;
    app.project = v; app.shown = 'project'; app.sel = null;
    closeModal(); refreshAll(); world.view('all');
    toast(`«${chosen.name}» yaratildi · baho ${chosen.sc.score}`);
  };
  const run = async () => {
    const out = body.querySelector('#apOut');
    const N = 36;
    out.innerHTML = `<div class="progress"><i id="apBar"></i></div><div class="muted" id="apTxt">Hisoblanmoqda…</div>`;
    variants = [];
    const styles = style === 'all' ? Object.keys(STYLES) : [style];
    const seed0 = (Date.now() % 10000);
    for (let k = 0; k < N; k++) {
      const st = styles[k % styles.length];
      const snap = generateLayout(app.base, { ...o, style: st }, seed0 + k * 17);
      const sc = scoreVariant(snap);
      variants.push({ snap, sc, style: st });
      if (k % 3 === 2) {
        out.querySelector('#apBar').style.width = ((k + 1) / N * 100) + '%';
        out.querySelector('#apTxt').textContent = `Ko'rib chiqildi: ${k + 1} / ${N} variant`;
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    variants.sort((a, b) => b.sc.score - a.sc.score);
    const top = variants.slice(0, 6);
    top.forEach((v, i) => { v.name = `${i + 1}. ${STYLES[v.style].name}`; });
    out.innerHTML = `<p class="muted" style="margin-top:12px">${N} ta rejalash ko'rib chiqildi. Eng yaxshi 6 tasi — bahosi bo'yicha. Variantni tanlang.</p><div class="vgrid">${top.map((v, i) => `<button class="vcard ${i === 0 ? 'on' : ''}" data-v="${i}"><canvas width="300" height="200"></canvas><div class="vt">${esc(v.name)}<span class="sc">${v.sc.score}</span></div><div class="vs">Nazorat varaqasi ${v.sc.passed}/10 · chetlanish ${v.sc.normTotal} · ${v.sc.species} tur · ${fmt(v.snap.plants.length)} o'simlik</div></button>`).join('')}</div>`;
    out.querySelectorAll('canvas').forEach((cv, i) => drawThumb(cv, top[i].snap));
    chosen = top[0];
    out.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
      chosen = top[+b.dataset.v];
      out.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
      const btn = $('#mfoot .primary'); if (btn) btn.textContent = `Variantni yaratish: ${chosen.name}`;
    }));
    const btn = $('#mfoot .primary'); if (btn) { btn.textContent = `Variantni yaratish: ${chosen.name}`; btn.onclick = make; }
  };
  openModal('Noldan rejalash', body, [
    { label: 'Yopish', fn: closeModal },
    { label: 'Variantlarni hisoblash', cls: 'primary', fn: () => run() },
  ]);
}

// ---------------------------------------------------------------- avto-injeneriya
function openEngineering(pre) {
  if (app.shown !== 'project') { app.shown = 'project'; refreshAll(); }
  const o = Object.assign({ irr: true, light: true, drain: true }, pre || {});
  const body = document.createElement('div');
  body.innerHTML = `<p class="muted">Sug'orish, yoritish, suv quvuri va drenajni rejaga qarab yotqizaman: nima allaqachon bor — saqlanadi va to'ldiriladi.</p>
    <div class="row wrap">${[['irr', "Avtosug'orish"], ['light', 'Yoritish'], ['drain', 'Drenaj']].map(([k, n]) => `<label class="check" style="margin-right:14px"><input type="checkbox" data-o="${k}" ${o[k] ? 'checked' : ''}>${n}</label>`).join('')}</div><div id="engOut"></div>`;
  body.addEventListener('change', (e) => { if (e.target.dataset.o) o[e.target.dataset.o] = e.target.checked; });
  let res = null;
  const calc = () => {
    res = autoEngineering(app.project, o);
    const sw = (c) => `<span class="sw" style="background:${c}"></span>`;
    let h = '<div class="res">';
    if (res.irr) h += `<div class="h">${sw('#2f8fe0')}Avtosug'orish</div><div>Magistral quvur</div><div class="v">${fmt(res.irr.length)} m</div><div>Purkagichlar (maysa)</div><div class="v">${res.irr.sprinklers} dona</div><div>Tomchilatib sug'orish</div><div class="v">${res.irr.dripLines} chiziq · ${fmt(res.irr.dripLength)} m</div>`;
    if (res.light) h += `<div class="h">${sw('#f2b632')}Yoritish</div><div>Chiroqlar (jami / yangi)</div><div class="v">${res.light.lamps} / ${res.newLamps.length}</div><div>Kabel</div><div class="v">${fmt(res.light.length)} m · ${res.light.lines} liniya</div>`;
    if (res.drain) h += `<div class="h">${sw('#a05a2c')}Suv o'tkazish va drenaj</div><div>Quvurlar</div><div class="v">${fmt(res.drain.length)} m</div><div>Quduqlar</div><div class="v">${res.drain.wells.length} dona</div><div>Transheya hajmi</div><div class="v">${fmt(res.drain.trench, 1)} m³</div>`;
    h += `</div><div class="card"><div class="k">Taxminiy narx (materiallar va montaj)</div><div class="price">≈ ${fmt(res.cost / 1e6, 1)} mln so'm</div></div><canvas id="engCv" width="600" height="400" style="width:100%;border-radius:12px"></canvas>`;
    body.querySelector('#engOut').innerHTML = h;
    const cv = body.querySelector('#engCv');
    drawThumb(cv, app.project);
    const g = cv.getContext('2d');
    const tx = (x) => (x + HALF_W) / SITE.W * cv.width, tz = (z) => (z + HALF_D) / SITE.D * cv.height;
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(0, 0, cv.width, cv.height);
    const draw = (segs, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (const [a, b, c2, d] of segs) { g.moveTo(tx(a), tz(b)); g.lineTo(tx(c2), tz(d)); } g.stroke(); };
    if (res.drain) draw(res.drain.segs, '#a05a2c', 2.5);
    if (res.irr) draw(res.irr.segs, '#2f8fe0', 2);
    if (res.light) { draw(res.light.segs, '#e0a020', 2); g.fillStyle = '#f2b632'; for (const [x, z] of res.newLamps) { g.beginPath(); g.arc(tx(x), tz(z), 4, 0, 7); g.fill(); } }
    const btn = $('#mfoot .primary'); btn.textContent = "Shu variantga yotqizish"; btn.onclick = apply;
  };
  const apply = () => {
    if (!res) return;
    pushUndo();
    applyEngineering(app.project, res);
    closeModal(); refreshAll(); setViewMode('xray', true);
    toast(`Tarmoqlar yotqizildi · ≈ ${fmt(res.cost / 1e6, 1)} mln so'm. Ko'rinish: «Ochilgan»`);
  };
  openModal('Muhandislik tarmoqlari — avtomatik', body, [
    { label: 'Yopish', fn: closeModal },
    { label: 'Hisoblash', cls: 'primary', fn: calc },
  ]);
}

// ---------------------------------------------------------------- render
function openRender() {
  const body = document.createElement('div');
  body.innerHTML = `<p class="muted">Joriy kamera ko'rinishidan yuqori sifatli surat (soyalar 4K, 2× o'lcham). Kamerani xohlagan burchakka qo'yib, «Sayr» rejimida ham render qilish mumkin.</p>
    <div class="row wrap"><label class="check"><input type="radio" name="rt" value="day" ${world.night ? '' : 'checked'}> Kunduzi</label><label class="check" style="margin-left:14px"><input type="radio" name="rt" value="night" ${world.night ? 'checked' : ''}> Kechasi</label>
    <label class="check" style="margin-left:14px">Sifat <select class="field" id="rq" style="width:auto;padding:4px 8px"><option value="1.5">Qoralama</option><option value="2" selected>Yuqori</option><option value="3">Maksimal</option></select></label></div><div id="rOut"></div>`;
  let url = null;
  openModal('Render — modeldan surat', body, [
    { label: 'Yopish', fn: closeModal },
    { label: 'Render qilish', cls: 'primary', fn: () => {
      const night = body.querySelector('input[name=rt]:checked').value === 'night';
      const prev = world.night;
      world.setNight(night);
      url = world.renderImage(parseFloat(body.querySelector('#rq').value));
      world.setNight(prev);
      body.querySelector('#rOut').innerHTML = `<img class="render-img" src="${url}" alt="render">`;
      const b = $('#mfoot .primary'); b.textContent = 'PNG yuklab olish'; b.onclick = () => downloadDataURL(`${app.project.name}-render.png`, url);
    } },
  ]);
}

// ---------------------------------------------------------------- eksport
function saveJson() { download(`${app.project.name}.floran3d.json`, projectJSON(app.project, app.base), 'application/json'); toast('Loyiha faylga saqlandi'); }
$('#fileOpen').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.app !== 'floran3d') throw new Error('format');
    pushUndo();
    app.project = deserialize(d.project); app.base = deserialize(d.base); app.shown = 'project'; app.sel = null;
    refreshAll(); toast(`«${app.project.name}» ochildi`);
  } catch (err) { toast('Faylni ochib bo\'lmadi: Floran 3D loyihasi emas'); }
  e.target.value = '';
});
async function exportModel(fmtName) {
  toast('Model tayyorlanmoqda…');
  await new Promise((r) => setTimeout(r, 30));
  const { root, tris } = world.bakeForExport();
  const name = app.project.name;
  if (fmtName === 'obj') download(`${name}.obj`, toOBJ(root), 'text/plain');
  else { const glb = await toGLB(root); download(`${name}.glb`, new Blob([glb], { type: 'model/gltf-binary' })); }
  toast(`Eksport: ${fmtName.toUpperCase()} · o'simliklar soddalashtirilgan · ${fmt(Math.round(tris / 1000))} ming uchburchak`);
}
$('#btnExport').addEventListener('click', (e) => showMenu(e.currentTarget, [
  { t1: 'Ko\'rinish surati — PNG', t2: 'Joriy kamera', icon: 'image', fn: () => downloadDataURL(`${app.project.name}.png`, world.renderImage(1)) },
  { t1: 'Chizmalar — DXF', t2: 'AutoCAD / ArchiCAD: chegaralar, gorizontallar, ekishlar, tarmoqlar', icon: 'ruler', fn: () => download(`${app.project.name}.dxf`, toDXF(cur(), world.contourSegs), 'application/dxf') },
  { t1: '3D model — OBJ', t2: '3ds Max, ArchiCAD, Twinmotion, Revit, Blender', icon: 'cube', fn: () => exportModel('obj') },
  { t1: '3D model — GLB (glTF)', t2: 'Blender, Unreal Engine, Twinmotion, SketchUp', icon: 'cube', fn: () => exportModel('glb') },
  { t1: 'Vedomostlar — CSV', t2: "O'simliklar, qoplamalar, tarmoqlar (Excel)", icon: 'table', fn: () => download(`${app.project.name}-vedomost.csv`, plantScheduleCSV(cur()), 'text/csv') },
  { t1: 'Loyiha fayli — JSON', t2: 'Keyinroq ochish uchun', icon: 'save', fn: saveJson },
  { t1: 'Loyihani ochish…', t2: '.floran3d.json fayldan', icon: 'folder', fn: () => $('#fileOpen').click() },
]));
$('#btnSave').addEventListener('click', saveJson);
$('#btnUndo').addEventListener('click', undo);

// ---------------------------------------------------------------- ishga tushirish
$('#btnUndo').innerHTML = icon('undo');
$('#btnExport').innerHTML = icon('export');
$('#btnSave').innerHTML = icon('save');
world.initControls();
world.setSnapshot(cur());
renderTabs(); renderCats(); renderPalette(); renderHeader(); renderStatus(); renderTab(); renderRail();
if (window.innerWidth <= 760) $('#sheet').classList.add('min');
world.view('all', 1);
window.addEventListener('resize', () => world.resize());
new ResizeObserver(() => world.resize()).observe(canvas);

let last = performance.now(), plantT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (app.walk) stepWalk(dt);
  if (app.stroke) {
    if (app.cat === 'relief' && app.stroke.p) applyStrokeAt(app.stroke.p, dt);
    plantT += dt;
    if (plantT > 0.12) {
      plantT = 0;
      if (app.stroke.plantsDirty || (app.cat === 'relief' && app.stroke.dirty)) { world.updatePlants(); app.stroke.plantsDirty = false; renderStatus(); }
    }
    if (app.stroke.p) world.setCursor(app.project, app.stroke.p.x, app.stroke.p.z, app.radius, true);
  }
  world.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.floran = { app, world }; // konsoldan tekshirish uchun
