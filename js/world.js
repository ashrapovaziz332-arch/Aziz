// 3D sahna: relyef, suv, o'simliklar, inshootlar, tarmoqlar, gorizontallar, kun/tun
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SITE, VX, VZ, NX, NZ, HALF_W, HALF_D, COVERS, C, PLANTS, OBJECTS } from './config.js';
import { idx, vx, vz, heightAt, rng } from './state.js';

const coverColors = COVERS.map((c) => new THREE.Color(c.color));
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

// --- O'simlik qismlari geometriyasi (normallashtirilgan: radius 1 = r, balandlik 1 = h)
function partGeo(kind, opt = {}) {
  let g;
  switch (kind) {
    case 'trunk': {
      const H = opt.h ?? 0.4;
      g = new THREE.CylinderGeometry(0.05, 0.08, H, 6); g.translate(0, H / 2, 0); break;
    }
    case 'cone': {
      const { r = 1, y0 = 0, y1 = 1, seg = 8 } = opt;
      g = new THREE.ConeGeometry(r, y1 - y0, seg); g.translate(0, (y0 + y1) / 2, 0); break;
    }
    case 'blob': {
      const { r = 1, sy = 0.5, y = 0.5, detail = 1 } = opt;
      g = new THREE.IcosahedronGeometry(1, detail); g.scale(r, sy, r); g.translate(0, y, 0); break;
    }
    case 'disc': {
      g = new THREE.CylinderGeometry(1, 1, 1, 7); g.translate(0, 0.5, 0); break;
    }
  }
  return g;
}

const PARTS = {
  conifer: [
    { geo: partGeo('trunk', { h: 0.25 }), col: 'trunk' },
    { geo: partGeo('cone', { r: 1, y0: 0.12, y1: 0.7 }), col: 'crown' },
    { geo: partGeo('cone', { r: 0.72, y0: 0.38, y1: 0.86 }), col: 'crown2' },
    { geo: partGeo('cone', { r: 0.42, y0: 0.62, y1: 1 }), col: 'crown' },
  ],
  pine: [
    { geo: partGeo('trunk', { h: 0.72 }), col: 'trunk' },
    { geo: partGeo('blob', { r: 1, sy: 0.16, y: 0.72 }), col: 'crown' },
    { geo: partGeo('blob', { r: 0.7, sy: 0.13, y: 0.86 }), col: 'crown2' },
    { geo: partGeo('blob', { r: 0.6, sy: 0.1, y: 0.6 }), col: 'crown2' },
  ],
  column: [
    { geo: partGeo('blob', { r: 1, sy: 0.5, y: 0.5 }), col: 'crown' },
  ],
  deciduous: [
    { geo: partGeo('trunk', { h: 0.5 }), col: 'trunk' },
    { geo: partGeo('blob', { r: 1, sy: 0.3, y: 0.66 }), col: 'crown' },
    { geo: partGeo('blob', { r: 0.6, sy: 0.2, y: 0.84 }), col: 'crown2' },
  ],
  shrub: [{ geo: partGeo('blob', { r: 1, sy: 0.55, y: 0.45 }), col: 'crown' }],
  perennial: [{ geo: partGeo('blob', { r: 1, sy: 0.5, y: 0.5, detail: 0 }), col: 'crown' }],
  veg: [{ geo: partGeo('blob', { r: 1, sy: 0.5, y: 0.5, detail: 0 }), col: 'crown' }],
  ground: [{ geo: partGeo('disc'), col: 'crown' }],
  grass: [{ geo: partGeo('cone', { r: 1, y0: 0, y1: 1, seg: 6 }), col: 'crown' }],
};

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.25, 'rgba(255,200,120,0.55)'); gr.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1200);
    this.camera.position.set(42, 40, 52);
    this.controls = null; // main.js o'z hodisalarini avval ulaydi, keyin initControls()

    this.night = false;
    this.viewMode = 'surface'; // surface | xray | nets
    this.layers = { terrain: true, tree: true, shrub: true, perennial: true, ground: true, grass: true, veg: true, objects: true, irr: true, light: true, drain: true, contours: false, markers: true, boundary: true };

    this._initEnv();
    this._initTerrain();
    this.plantGroup = new THREE.Group(); this.scene.add(this.plantGroup);
    this.objGroup = new THREE.Group(); this.scene.add(this.objGroup);
    this.netGroup = new THREE.Group(); this.scene.add(this.netGroup);
    this.markerGroup = new THREE.Group(); this.scene.add(this.markerGroup);
    this.glowGroup = new THREE.Group(); this.scene.add(this.glowGroup);
    this.selGroup = new THREE.Group(); this.scene.add(this.selGroup);
    this.glowTex = glowTexture();
    this.plantMeshes = [];
    this.lampLights = [];
    this._initCursor();
    this.resize();
  }

  initControls() {
    const c = this.controls = new OrbitControls(this.camera, this.canvas);
    c.target.set(0, 0, 0);
    c.enableDamping = true; c.dampingFactor = 0.08;
    c.maxPolarAngle = Math.PI * 0.495; c.minDistance = 3; c.maxDistance = 220;
    c.screenSpacePanning = false;
    c.update();
  }

  _initEnv() {
    const s = this.scene;
    // Osmon gradienti
    this.skyU = { top: { value: new THREE.Color('#cfdcd8') }, bottom: { value: new THREE.Color('#eef1ea') } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(vP.y*1.6+0.1,0.,1.); gl_FragColor = vec4(mix(bottom, top, t),1.); }',
    }));
    s.add(sky);
    s.fog = new THREE.Fog('#e6eae2', 140, 420);

    this.hemi = new THREE.HemisphereLight('#f1f6ff', '#5a6a45', 1.1); s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff4e2', 2.4);
    sun.position.set(38, 60, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 1; sc.far = 200;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
    s.add(sun); s.add(sun.target);

    // Atrofdagi yer
    const outer = this.outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: '#c3cbb3', roughness: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03; outer.receiveShadow = true;
    s.add(outer);
  }

  _initTerrain() {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(VX * VZ * 3), col = new Float32Array(VX * VZ * 3);
    for (let iz = 0; iz < VZ; iz++) for (let ix = 0; ix < VX; ix++) {
      const i = idx(ix, iz); pos[i * 3] = vx(ix); pos[i * 3 + 2] = vz(iz);
    }
    const ind = [];
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const a = idx(ix, iz), b = idx(ix + 1, iz), c = idx(ix, iz + 1), d = idx(ix + 1, iz + 1);
      ind.push(a, c, b, b, c, d);
    }
    g.setIndex(ind);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.terrain = new THREE.Mesh(g, this.terrainMat);
    this.terrain.receiveShadow = true; this.terrain.castShadow = true;
    this.scene.add(this.terrain);
    // tugunlar uchun barqaror "shovqin" (rang tebranishi)
    const r = rng(3);
    this.noise = new Float32Array(VX * VZ).map(() => r());

    // Uchastka chegarasi
    this.boundary = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.9 }));
    this.scene.add(this.boundary);

    this.waterMat = new THREE.MeshStandardMaterial({ color: '#3f86a8', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.82 });
    this.water = new THREE.Mesh(new THREE.BufferGeometry(), this.waterMat);
    this.water.receiveShadow = true;
    this.scene.add(this.water);

    this.contours = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#3d2e22', transparent: true, opacity: 0.45 }));
    this.contours.visible = false;
    this.scene.add(this.contours);
  }

  _initCursor() {
    const N = 64;
    this.cursor = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)),
      new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.95 }));
    this.cursor.renderOrder = 10; this.cursor.visible = false;
    this.scene.add(this.cursor);
  }

  setCursor(snap, x, z, r, visible = true) {
    this.cursor.visible = visible;
    if (!visible) return;
    const p = this.cursor.geometry.attributes.position;
    const N = p.count;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      p.setXYZ(k, px, heightAt(snap, px, pz) + 0.08, pz);
    }
    p.needsUpdate = true;
  }

  // --- Yangilash ---------------------------------------------------------
  setSnapshot(s) {
    this.snap = s;
    this.updateTerrain();
    this.updateWater();
    this.updatePlants();
    this.updateObjects();
    this.updateNets();
    this.updateContours();
    this.clearMarkers();
  }

  updateTerrain(colorsToo = true) {
    const s = this.snap, g = this.terrain.geometry;
    const pos = g.attributes.position.array, col = g.attributes.color.array;
    for (let i = 0; i < VX * VZ; i++) {
      pos[i * 3 + 1] = s.heights[i];
      if (colorsToo) {
        const c = coverColors[s.cover[i]] || coverColors[0];
        const n = this.noise[i];
        const k = s.cover[i] === C.WATER ? 0.8 : 0.9 + n * 0.16;
        col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
      }
    }
    g.attributes.position.needsUpdate = true;
    if (colorsToo) g.attributes.color.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere(); g.computeBoundingBox();
    // chegara chizig'i
    const bp = [];
    const push = (x, z) => bp.push(x, heightAt(s, x, z) + 0.06, z);
    for (let x = -HALF_W; x <= HALF_W; x += 1) push(x, -HALF_D);
    for (let z = -HALF_D; z <= HALF_D; z += 1) push(HALF_W, z);
    for (let x = HALF_W; x >= -HALF_W; x -= 1) push(x, HALF_D);
    for (let z = HALF_D; z >= -HALF_D; z -= 1) push(-HALF_W, z);
    this.boundary.geometry.dispose();
    this.boundary.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    this.boundary.computeLineDistances();
  }

  updateWater() {
    const s = this.snap;
    // Umumiy tugunli (indeksli) sirt — kataklar orasida tirqish bo'lmasin.
    // Sath: hovuzning har bir bog'liq qismi uchun bitta (eng past qirg'oq belgisi - 0,15 m).
    const isW = (i) => s.cover[i] === C.WATER;
    const comp = new Int32Array(VX * VZ).fill(-1);
    const levels = [];
    for (let i0 = 0; i0 < VX * VZ; i0++) {
      if (!isW(i0) || comp[i0] >= 0) continue;
      const id = levels.length; let sum = 0, n = 0;
      const st = [i0]; comp[i0] = id;
      while (st.length) {
        const i = st.pop(); sum += s.h0[i]; n++;
        const ix = i % VX, iz = (i / VX) | 0;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const jx = ix + ox, jz = iz + oz;
          if (jx < 0 || jz < 0 || jx > NX || jz > NZ) continue;
          const j = idx(jx, jz);
          if (isW(j) && comp[j] < 0) { comp[j] = id; st.push(j); }
        }
      }
      levels.push(sum / n - 0.15);
    }
    const pos = new Float32Array(VX * VZ * 3);
    const ind = [];
    for (let iz = 0; iz < VZ; iz++) for (let ix = 0; ix < VX; ix++) {
      const i = idx(ix, iz);
      pos[i * 3] = vx(ix); pos[i * 3 + 2] = vz(iz);
      pos[i * 3 + 1] = comp[i] >= 0 ? levels[comp[i]] : s.heights[i] - 0.05;
    }
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const a = idx(ix, iz), b = idx(ix + 1, iz), c = idx(ix, iz + 1), d = idx(ix + 1, iz + 1);
      const n = isW(a) + isW(b) + isW(c) + isW(d);
      if (n < 3) continue;
      // qirg'oqdagi quruq tugunni suv sathiga tortamiz
      const lv = levels[Math.max(comp[a], comp[b], comp[c], comp[d])];
      for (const v of [a, b, c, d]) if (comp[v] < 0) pos[v * 3 + 1] = lv;
      ind.push(a, c, b, b, c, d);
    }
    this.water.geometry.dispose();
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(ind);
    g.computeVertexNormals();
    this.water.geometry = g;
  }

  updatePlants() {
    for (const m of this.plantMeshes) { this.plantGroup.remove(m); m.dispose(); }
    this.plantMeshes = [];
    const s = this.snap;
    const bySp = new Map();
    s.plants.forEach((p, i) => { let a = bySp.get(p.t); if (!a) bySp.set(p.t, (a = [])); a.push(i); });
    if (!this.plantMat) this.plantMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true });
    for (const [t, list] of bySp) {
      const d = PLANTS[t];
      const parts = PARTS[d.cat];
      const crown = new THREE.Color(d.color);
      const crown2 = crown.clone().offsetHSL(0.01, 0.02, 0.06);
      const trunk = new THREE.Color(d.trunk || '#5d4330');
      const big = d.group === 'tree' || d.group === 'shrub';
      for (const part of parts) {
        const im = new THREE.InstancedMesh(part.geo, this.plantMat, list.length);
        im.castShadow = big || d.group === 'grass';
        im.receiveShadow = true;
        im.userData = { plantIdx: list, group: d.group };
        list.forEach((pi, k) => {
          const p = s.plants[pi];
          const h = d.h * p.s, rr = d.r * p.s;
          tmpP.set(p.x, heightAt(s, p.x, p.z) - (big ? 0.05 : 0), p.z);
          tmpQ.setFromAxisAngle(UP, p.rot);
          tmpS.set(rr, h, rr);
          tmpM.compose(tmpP, tmpQ, tmpS);
          im.setMatrixAt(k, tmpM);
          const base = part.col === 'trunk' ? trunk : part.col === 'crown2' ? crown2 : crown;
          const v = 0.86 + ((pi * 2654435761) % 1000) / 1000 * 0.24;
          tmpC.copy(base).multiplyScalar(v);
          im.setColorAt(k, tmpC);
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
        im.visible = this.layers[d.group] !== false && this.viewMode !== 'nets';
        this.plantGroup.add(im);
        this.plantMeshes.push(im);
      }
    }
  }

  // --- Inshootlar --------------------------------------------------------
  _mat(key, opts) {
    this._mats ||= {};
    if (!this._mats[key]) this._mats[key] = new THREE.MeshStandardMaterial(opts);
    return this._mats[key];
  }

  makeObject(o) {
    const g = new THREE.Group();
    const def = OBJECTS[o.t];
    const add = (geo, mat, x = 0, y = 0, z = 0, cast = true) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m;
    };
    const wood = this._mat('wood', { color: '#8b6b4b', roughness: 0.8 });
    const darkWood = this._mat('dwood', { color: '#4a3a2e', roughness: 0.8 });
    const stone = this._mat('stone', { color: '#8d8a85', roughness: 0.9 });
    const win = this._mat('win', { color: '#2a3238', roughness: 0.2, metalness: 0.3, emissive: '#ffcc80', emissiveIntensity: 0 });
    switch (o.t) {
      case 'house': {
        const wall = this._mat('wall', { color: '#3b3f44', roughness: 0.75 });
        const roof = this._mat('roof', { color: '#24272b', roughness: 0.6 });
        add(new THREE.BoxGeometry(def.w, 0.5, def.d), stone, 0, 0.25, 0);
        add(new THREE.BoxGeometry(def.w, 4.6, def.d), wall, 0, 2.8, 0);
        const sh = new THREE.Shape(); sh.moveTo(-def.d / 2 - 0.5, 0); sh.lineTo(def.d / 2 + 0.5, 0); sh.lineTo(0, 3); sh.closePath();
        const rg = new THREE.ExtrudeGeometry(sh, { depth: def.w + 0.8, bevelEnabled: false });
        rg.rotateY(Math.PI / 2); rg.translate(-def.w / 2 - 0.4, 5.1, 0);
        add(rg, roof);
        for (let k = 0; k < 4; k++) {
          const x = -def.w / 2 + 1.8 + k * (def.w - 3.6) / 3;
          add(new THREE.BoxGeometry(1.4, 1.8, 0.08), win, x, 2.6, def.d / 2 + 0.03, false);
          add(new THREE.BoxGeometry(1.4, 1.4, 0.08), win, x, 4.4, def.d / 2 + 0.03, false);
          add(new THREE.BoxGeometry(1.4, 1.8, 0.08), win, x, 2.6, -def.d / 2 - 0.03, false);
        }
        add(new THREE.BoxGeometry(0.08, 1.8, 1.4), win, def.w / 2 + 0.03, 2.6, 0, false);
        add(new THREE.BoxGeometry(0.08, 1.8, 1.4), win, -def.w / 2 - 0.03, 2.6, 0, false);
        break;
      }
      case 'gazebo': {
        add(new THREE.CylinderGeometry(2.3, 2.3, 0.25, 8), wood, 0, 0.12, 0);
        for (let k = 0; k < 4; k++) {
          const a = Math.PI / 4 + k * Math.PI / 2;
          add(new THREE.BoxGeometry(0.16, 2.6, 0.16), darkWood, Math.cos(a) * 1.8, 1.5, Math.sin(a) * 1.8);
        }
        const rf = add(new THREE.ConeGeometry(2.9, 1.3, 4), this._mat('groof', { color: '#3a2f28', roughness: 0.7 }), 0, 3.4, 0);
        rf.rotation.y = 0;
        add(new THREE.BoxGeometry(2.2, 0.08, 1), wood, 0, 0.8, 0);
        break;
      }
      case 'pergola': {
        for (const [x, z] of [[-1.4, -1.9], [1.4, -1.9], [-1.4, 1.9], [1.4, 1.9]]) add(new THREE.BoxGeometry(0.14, 2.5, 0.14), darkWood, x, 1.25, z);
        for (let k = -4; k <= 4; k++) add(new THREE.BoxGeometry(3.3, 0.12, 0.08), wood, 0, 2.55, k * 0.45);
        add(new THREE.BoxGeometry(0.1, 0.16, 4.2), darkWood, -1.4, 2.45, 0); add(new THREE.BoxGeometry(0.1, 0.16, 4.2), darkWood, 1.4, 2.45, 0);
        break;
      }
      case 'bench': {
        add(new THREE.BoxGeometry(1.8, 0.08, 0.5), wood, 0, 0.45, 0);
        add(new THREE.BoxGeometry(1.8, 0.4, 0.06), wood, 0, 0.75, -0.24);
        add(new THREE.BoxGeometry(0.08, 0.45, 0.45), darkWood, -0.8, 0.22, 0); add(new THREE.BoxGeometry(0.08, 0.45, 0.45), darkWood, 0.8, 0.22, 0);
        break;
      }
      case 'shed': {
        add(new THREE.BoxGeometry(def.w, 2.2, def.d), wood, 0, 1.1, 0);
        const rf = add(new THREE.BoxGeometry(def.w + 0.4, 0.15, def.d + 0.5), darkWood, 0, 2.35, 0); rf.rotation.x = 0.12;
        add(new THREE.BoxGeometry(0.9, 1.8, 0.05), darkWood, 0, 0.9, def.d / 2 + 0.02, false);
        break;
      }
      case 'greenhouse': {
        const glass = this._mat('glass', { color: '#d9eef2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.38 });
        add(new THREE.BoxGeometry(def.w, 1.6, def.d), glass, 0, 0.8, 0, false);
        const sh = new THREE.Shape(); sh.moveTo(-def.w / 2, 0); sh.lineTo(def.w / 2, 0); sh.lineTo(0, 0.9); sh.closePath();
        const rg = new THREE.ExtrudeGeometry(sh, { depth: def.d, bevelEnabled: false }); rg.translate(0, 1.6, -def.d / 2);
        add(rg, glass, 0, 0, 0, false);
        const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(def.w, 1.6, def.d)), new THREE.LineBasicMaterial({ color: '#f4f4f4' }));
        frame.position.y = 0.8; g.add(frame);
        break;
      }
      case 'firepit': {
        add(new THREE.TorusGeometry(0.55, 0.16, 6, 12).rotateX(Math.PI / 2), stone, 0, 0.16, 0);
        const fire = add(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 10), this._mat('fire', { color: '#3a2a20', emissive: '#ff7a2a', emissiveIntensity: 0 }), 0, 0.12, 0, false);
        fire.userData.fire = true;
        break;
      }
      case 'lamp': {
        add(new THREE.CylinderGeometry(0.05, 0.07, 0.85, 6), this._mat('pole', { color: '#2d3033', roughness: 0.5, metalness: 0.4 }), 0, 0.42, 0, false);
        const head = add(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 8), this._mat('bulb', { color: '#f2ead8', emissive: '#ffd08a', emissiveIntensity: 0 }), 0, 0.92, 0, false);
        head.userData.bulb = true;
        break;
      }
      case 'sprinkler': {
        add(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 8), this._mat('spr', { color: '#2f6fb0', roughness: 0.4 }), 0, 0.07, 0, false);
        break;
      }
    }
    g.position.set(o.x, heightAt(this.snap, o.x, o.z), o.z);
    g.rotation.y = -(o.rot || 0);
    return g;
  }

  updateObjects() {
    for (const c of [...this.objGroup.children]) { this.objGroup.remove(c); c.traverse((m) => m.geometry?.dispose()); }
    for (const c of [...this.glowGroup.children]) this.glowGroup.remove(c);
    for (const l of this.lampLights) this.scene.remove(l);
    this.lampLights = [];
    const s = this.snap;
    s.objects.forEach((o, i) => {
      const g = this.makeObject(o);
      g.userData.objIdx = i;
      this.objGroup.add(g);
      if (o.t === 'lamp' || o.t === 'firepit') {
        const y = heightAt(s, o.x, o.z);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.position.set(o.x, y + (o.t === 'lamp' ? 0.92 : 0.4), o.z);
        sp.scale.setScalar(o.t === 'lamp' ? 1.6 : 2.6);
        this.glowGroup.add(sp);
        // yerdagi yorug'lik dog'i
        const spot = new THREE.Mesh(new THREE.CircleGeometry(o.t === 'lamp' ? 2.6 : 3.4, 24).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
        spot.position.set(o.x, y + 0.07, o.z);
        this.glowGroup.add(spot);
        if (this.lampLights.length < 10) {
          const L = new THREE.PointLight('#ffc27a', 0, 9, 1.6);
          L.position.set(o.x, y + 1.1, o.z);
          this.lampLights.push(L); this.scene.add(L);
        }
      }
    });
    this.applyNight();
    this.applyVisibility();
  }

  updateNets() {
    for (const c of [...this.netGroup.children]) { this.netGroup.remove(c); c.geometry.dispose(); }
    const s = this.snap;
    const mk = (segs, color, key, depth) => {
      const p = [];
      for (const [a, b, c, d] of segs) {
        const L = Math.hypot(c - a, d - b), n = Math.max(1, Math.ceil(L / 1.5));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          const x0 = a + (c - a) * t0, z0 = b + (d - b) * t0, x1 = a + (c - a) * t1, z1 = b + (d - b) * t1;
          p.push(x0, heightAt(s, x0, z0) - depth, z0, x1, heightAt(s, x1, z1) - depth, z1);
        }
      }
      const ls = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
      ls.userData.layer = key;
      this.netGroup.add(ls);
    };
    mk(s.nets.irr, '#2f8fe0', 'irr', 0.35);
    mk(s.nets.light, '#f2b632', 'light', 0.55);
    mk(s.nets.drain, '#a05a2c', 'drain', 0.9);
    if (s.nets.wells.length) {
      const geo = new THREE.CylinderGeometry(0.4, 0.4, 1, 10);
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#7d5132' }), s.nets.wells.length);
      s.nets.wells.forEach(([x, z], k) => { tmpM.makeTranslation(x, heightAt(s, x, z) - 0.45, z); im.setMatrixAt(k, tmpM); });
      im.userData.layer = 'drain';
      this.netGroup.add(im);
    }
    this.applyVisibility();
  }

  // Gorizontallar (marching squares), qadam 0,25 m
  updateContours(step = 0.25) {
    const s = this.snap, h = s.heights;
    const p = [];
    let mn = Infinity, mx = -Infinity;
    for (const v of h) { if (v < mn) mn = v; if (v > mx) mx = v; }
    for (let lv = Math.ceil(mn / step) * step; lv <= mx; lv += step) {
      for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
        const a = h[idx(ix, iz)], b = h[idx(ix + 1, iz)], c = h[idx(ix + 1, iz + 1)], d = h[idx(ix, iz + 1)];
        const pts = [];
        const edge = (h1, h2, x1, z1, x2, z2) => {
          if ((h1 < lv) !== (h2 < lv)) { const t = (lv - h1) / (h2 - h1); pts.push(x1 + (x2 - x1) * t, lv + 0.04, z1 + (z2 - z1) * t); }
        };
        const x0 = vx(ix), x1 = vx(ix + 1), z0 = vz(iz), z1 = vz(iz + 1);
        edge(a, b, x0, z0, x1, z0); edge(b, c, x1, z0, x1, z1); edge(c, d, x1, z1, x0, z1); edge(d, a, x0, z1, x0, z0);
        if (pts.length >= 6) p.push(...pts.slice(0, 6));
        if (pts.length === 12) p.push(...pts.slice(6, 12));
      }
    }
    this.contours.geometry.dispose();
    this.contours.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    this.contourSegs = p;
  }

  // --- Normakontrol belgilari -------------------------------------------
  setMarkers(indices) {
    this.clearMarkers();
    if (!indices.length) return;
    const s = this.snap;
    const geo = new THREE.ConeGeometry(0.35, 0.8, 8).rotateX(Math.PI).translate(0, 0.4, 0);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#e5322d' }), indices.length);
    indices.forEach((pi, k) => {
      const p = s.plants[pi];
      const d = PLANTS[p.t];
      tmpM.makeTranslation(p.x, heightAt(s, p.x, p.z) + d.h * p.s + 0.3, p.z);
      im.setMatrixAt(k, tmpM);
    });
    this.markerGroup.add(im);
    this.markerGroup.visible = this.layers.markers;
  }
  clearMarkers() { for (const c of [...this.markerGroup.children]) { this.markerGroup.remove(c); c.dispose?.(); } }

  setSelection(sel) {
    for (const c of [...this.selGroup.children]) { this.selGroup.remove(c); c.geometry.dispose(); }
    if (!sel) return;
    const s = this.snap;
    let x, z, r;
    if (sel.kind === 'plant') { const p = s.plants[sel.index]; if (!p) return; x = p.x; z = p.z; r = PLANTS[p.t].r * p.s + 0.2; }
    else { const o = s.objects[sel.index]; if (!o) return; x = o.x; z = o.z; r = Math.max(OBJECTS[o.t].w, OBJECTS[o.t].d) * 0.6 + 0.3; }
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.15, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe04a', depthTest: false, transparent: true }));
    ring.position.set(x, heightAt(s, x, z) + 0.1, z); ring.renderOrder = 11;
    this.selGroup.add(ring);
  }

  // --- Ko'rinish rejimlari ----------------------------------------------
  applyVisibility() {
    const L = this.layers, vm = this.viewMode;
    const terrainVis = L.terrain && vm !== 'nets';
    this.terrain.visible = terrainVis || vm === 'xray';
    this.terrainMat.transparent = vm === 'xray';
    this.terrainMat.opacity = vm === 'xray' ? 0.35 : 1;
    this.terrainMat.depthWrite = vm !== 'xray';
    this.terrainMat.needsUpdate = true;
    this.water.visible = this.terrain.visible && vm !== 'xray';
    for (const m of this.plantMeshes) m.visible = L[m.userData.group] !== false && vm !== 'nets';
    this.objGroup.visible = L.objects && vm !== 'nets';
    this.glowGroup.visible = this.objGroup.visible && this.night;
    for (const c of this.netGroup.children) {
      c.visible = L[c.userData.layer] !== false && vm !== 'surface';
      if (c.material) { c.material.depthTest = vm === 'surface'; }
    }
    this.contours.visible = L.contours && vm !== 'nets';
    this.markerGroup.visible = L.markers;
    this.boundary.visible = L.boundary;
    this.outer.visible = vm !== 'nets';
  }

  setNight(on) { this.night = on; this.applyNight(); this.applyVisibility(); }

  applyNight() {
    const n = this.night;
    this.skyU.top.value.set(n ? '#0b1422' : '#cfdcd8');
    this.skyU.bottom.value.set(n ? '#1d2a33' : '#eef1ea');
    this.scene.fog.color.set(n ? '#121b24' : '#e6eae2');
    this.hemi.intensity = n ? 0.16 : 1.1;
    this.hemi.color.set(n ? '#7a90c0' : '#f1f6ff');
    this.sun.intensity = n ? 0.25 : 2.4;
    this.sun.color.set(n ? '#9fb4e8' : '#fff4e2');
    this.outer.material.color.set(n ? '#5d6657' : '#c3cbb3');
    this.renderer.toneMappingExposure = n ? 1.25 : 1.05;
    this.objGroup.traverse((m) => {
      if (!m.material) return;
      if (m.userData.bulb) { m.material.emissiveIntensity = n ? 3 : 0; }
      if (m.userData.fire) { m.material.emissiveIntensity = n ? 2.5 : 0; }
    });
    if (this._mats?.win) this._mats.win.emissiveIntensity = n ? 1.2 : 0;
    for (const l of this.lampLights) l.intensity = n ? 6 : 0;
  }

  // --- Kamera ------------------------------------------------------------
  flyTo(pos, target, ms = 700) {
    const c = this.controls;
    const p0 = this.camera.position.clone(), t0 = c.target.clone();
    const p1 = new THREE.Vector3(...pos), t1 = new THREE.Vector3(...target);
    const st = performance.now();
    this._fly = (now) => {
      let k = Math.min(1, (now - st) / ms); k = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.camera.position.lerpVectors(p0, p1, k); c.target.lerpVectors(t0, t1, k);
      if (k >= 1) this._fly = null;
    };
  }

  view(name, ms) {
    const k = this.camera.aspect < 1 ? 1.9 : 1; // tor (telefon) ekranda uzoqroqdan
    if (name === 'all') this.flyTo([42 * k, 40 * k, 52 * k], [0, 0, 0], ms);
    if (name === 'front') this.flyTo([0, 7, 44 * k], [0, 2, 0], ms);
    if (name === 'top') this.flyTo([0, 88 * k, 0.1], [0, 0, 0], ms);
    if (name === 'side') this.flyTo([62 * k, 14, 0], [0, 1, 0], ms);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // Yuqori sifatli kadr (render)
  renderImage(scale = 2) {
    const r = this.renderer;
    const pr = r.getPixelRatio();
    const ms = this.sun.shadow.mapSize.x;
    r.setPixelRatio(Math.min(4, pr * scale));
    this.sun.shadow.mapSize.set(4096, 4096); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    this.cursor.visible = false;
    const sel = this.selGroup.visible; this.selGroup.visible = false;
    r.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    r.setPixelRatio(pr);
    this.sun.shadow.mapSize.set(ms, ms); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    this.selGroup.visible = sel;
    this.resize();
    return url;
  }

  // Eksport uchun: instanced o'simliklarni oddiy meshlarga "pishirish"
  bakeForExport() {
    const root = new THREE.Group();
    const t = this.terrain.clone(); t.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }); t.name = 'Relyef'; root.add(t);
    if (this.water.geometry.attributes.position?.count) { const w = this.water.clone(); w.name = 'Suv'; root.add(w); }
    let tris = 0;
    const byGroup = new Map();
    for (const im of this.plantMeshes) {
      const g = im.geometry.index ? im.geometry.toNonIndexed() : im.geometry;
      const P = g.attributes.position, N = g.attributes.normal;
      const out = byGroup.get(im.userData.group) || { pos: [], nor: [], col: [] };
      const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), c = new THREE.Color();
      for (let k = 0; k < im.count; k++) {
        im.getMatrixAt(k, m); nm.getNormalMatrix(m); im.getColorAt(k, c);
        for (let j = 0; j < P.count; j++) {
          v.fromBufferAttribute(P, j).applyMatrix4(m); out.pos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(N, j).applyMatrix3(nm).normalize(); out.nor.push(v.x, v.y, v.z);
          out.col.push(c.r, c.g, c.b);
        }
        tris += P.count / 3;
      }
      byGroup.set(im.userData.group, out);
    }
    for (const [grp, o] of byGroup) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
      m.name = `Osimliklar_${grp}`; root.add(m);
    }
    const objs = this.objGroup.clone(); objs.name = 'Inshootlar';
    objs.traverse((m) => { if (m.isLineSegments) m.visible = false; });
    root.add(objs);
    return { root, tris };
  }

  render(dt) {
    if (this._fly) this._fly(performance.now());
    if (this.controls?.enabled) this.controls.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
