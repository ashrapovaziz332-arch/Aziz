#!/usr/bin/env node
// Avtomatik sifat nazorati: npm run qc -- 001
// Natija: projects/<id>/06-qc/qc-report.md (qo'lda tekshiruv bo'limi saqlanadi)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { globFiles, pipeline, projectDir, readJson } from "./lib.mjs";

const id = process.argv[2];
if (!id) {
  console.error("Foydalanish: npm run qc -- <loyiha raqami>");
  process.exit(1);
}
const dir = projectDir(id);
const p = pipeline();
const results = []; // { stage, level: pass|warn|fail, msg }
const add = (stage, level, msg) => results.push({ stage, level, msg });

// 1) Har bosqichning majburiy fayllari
for (const s of p.stages) {
  if (s.key === "qc") continue;
  for (const out of s.requiredOutputs) {
    const found = out.includes("*") ? globFiles(path.join(dir, s.folder), out) : [path.join(dir, s.folder, out)].filter(fs.existsSync);
    add(s.key, found.length ? "pass" : "fail", `${s.folder}/${out} ${found.length ? "mavjud" : "YO'Q"}`);
  }
}

// 2) script.json mantiqi
const scriptPath = path.join(dir, "01-creative/script.json");
let script = null;
if (fs.existsSync(scriptPath)) {
  try {
    script = readJson(scriptPath);
  } catch (e) {
    add("creative", "fail", `script.json JSON xato: ${e.message}`);
  }
}
if (script) {
  if (["seed", "draft"].includes(script.status)) add("creative", "warn", `script.json holati "${script.status}" — Creative Director yakunlamagan`);
  let t = 0;
  for (const sc of script.scenes) {
    if (Math.abs(sc.startSec - t) > 0.001) add("creative", "fail", `${sc.id}: startSec=${sc.startSec}, kutilgan ${t} (bo'shliq yoki ustma-ust)`);
    t = sc.startSec + sc.durationSec;
    const words = sc.onScreenText.split(/\s+/).filter(Boolean).length;
    if (words && sc.durationSec / words < 0.4) add("creative", "warn", `${sc.id}: matn o'qish uchun tez (${words} so'z / ${sc.durationSec} s)`);
    if (/[oOgG]'/.test(sc.onScreenText)) add("creative", "warn", `${sc.id}: imlo — "o'"/"g'" o'rniga "oʻ"/"gʻ" (U+02BB) ishlating: "${sc.onScreenText}"`);
    if (!sc.landscapeNeeds) add("creative", "warn", `${sc.id}: landscapeNeeds bo'sh`);
  }
  if (Math.abs(t - script.durationSec) > 0.001) add("creative", "fail", `Sahnalar yig'indisi ${t} s ≠ durationSec ${script.durationSec} s`);
  else add("creative", "pass", `Sahna vaqtlari uzluksiz, jami ${t} s`);
  if (t > p.format.maxDurationSec) add("creative", "fail", `Davomiylik ${t} s > ${p.format.maxDurationSec} s`);
  if (!script.music?.license) add("edit", "warn", "Musiqa litsenziyasi ko'rsatilmagan (script.json → music.license)");
}

// 3) Landshaft: zonalar uchastka ichida, o'simliklar CSV ustunlari
const planPath = path.join(dir, "02-landscape/plan.json");
if (fs.existsSync(planPath)) {
  const plan = readJson(planPath);
  for (const z of plan.zones ?? []) {
    if (z.x < 0 || z.y < 0 || z.x + z.w > plan.site.width + 1e-6 || z.y + z.h > plan.site.length + 1e-6)
      add("landscape", "fail", `Zona ${z.id} (${z.name}) uchastka chegarasidan chiqadi`);
    if (z.type === "path" && Math.min(z.w, z.h) < 1.2) add("landscape", "fail", `Yo'lak ${z.id} eni < 1.2 m`);
  }
  add("landscape", "pass", `plan.json: ${plan.zones?.length ?? 0} zona tekshirildi`);
}
const plantsPath = path.join(dir, "02-landscape/plants.csv");
if (fs.existsSync(plantsPath)) {
  const header = fs.readFileSync(plantsPath, "utf8").split(/\r?\n/)[0].trim();
  const want = "latin,uz_name,qty,spacing_m,height_m,zone,season_note";
  add("landscape", header === want ? "pass" : "fail", header === want ? "plants.csv ustunlari to'g'ri" : `plants.csv sarlavhasi "${header}", kutilgan "${want}"`);
}

// 4) 3D sahnalar script bilan mos
const scenesPath = path.join(dir, "03-3d/scenes.json");
if (fs.existsSync(scenesPath) && script) {
  const scenes = readJson(scenesPath).scenes ?? [];
  const ids3d = new Set(scenes.map((s) => s.sceneId));
  for (const sc of script.scenes) if (!ids3d.has(sc.id)) add("visualization", "fail", `scenes.json da ${sc.id} yo'q`);
  for (const s of scenes) {
    if (s.renderStatus === "done" && !(s.renderFile && fs.existsSync(path.join(dir, s.renderFile))))
      add("visualization", "fail", `${s.sceneId}: renderStatus=done, lekin fayl topilmadi (${s.renderFile || "ko'rsatilmagan"})`);
  }
}

// 5) Videolar: o'lcham, fps, davomiylik, kodek
const probe = (f) => {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,codec_name,pix_fmt:format=duration", "-of", "json", f]);
  const j = JSON.parse(out.toString());
  const [n, d] = j.streams[0].r_frame_rate.split("/").map(Number);
  return { ...j.streams[0], fps: n / d, duration: Number(j.format.duration) };
};
const videos = [
  ["motion", globFiles(path.join(dir, "04-motion"), "renders/*.mp4")],
  ["edit", globFiles(path.join(dir, "05-edit"), "exports/*.mp4")],
];
for (const [stage, files] of videos) {
  for (const f of files) {
    const v = probe(f);
    const name = path.relative(dir, f);
    const errs = [];
    if (v.width !== p.format.width || v.height !== p.format.height) errs.push(`o'lcham ${v.width}×${v.height}`);
    if (Math.abs(v.fps - p.format.fps) > 0.01) errs.push(`fps ${v.fps}`);
    if (v.codec_name !== "h264") errs.push(`kodek ${v.codec_name}`);
    if (!["yuv420p", "yuvj420p"].includes(v.pix_fmt)) errs.push(`pix_fmt ${v.pix_fmt}`);
    if (v.duration > p.format.maxDurationSec) errs.push(`davomiylik ${v.duration.toFixed(1)} s`);
    if (script && Math.abs(v.duration - script.durationSec) > 0.5) errs.push(`davomiylik ${v.duration.toFixed(1)} s ≠ script ${script.durationSec} s`);
    add(stage, errs.length ? "fail" : "pass", `${name}: ${errs.length ? errs.join(", ") : `${v.width}×${v.height}, ${v.fps} fps, ${v.duration.toFixed(1)} s, ${v.codec_name}`}`);
  }
}

// Hisobot
const mark = { pass: "✅", warn: "⚠️", fail: "❌" };
const counts = Object.fromEntries(["pass", "warn", "fail"].map((l) => [l, results.filter((r) => r.level === l).length]));
const lines = [
  `# QC hisobot — №${id}`,
  "",
  `<!-- AUTO:START — bu bo'lim scripts/qc.mjs tomonidan qayta yoziladi -->`,
  `Avtomatik tekshiruv: ${new Date().toISOString()} · ✅ ${counts.pass} · ⚠️ ${counts.warn} · ❌ ${counts.fail}`,
  "",
];
for (const s of p.stages) {
  const rs = results.filter((r) => r.stage === s.key);
  if (!rs.length) continue;
  lines.push(`## ${s.folder} (${s.agent})`, ...rs.map((r) => `- ${mark[r.level]} ${r.msg}`), "");
}
lines.push("<!-- AUTO:END -->");
const reportPath = path.join(dir, "06-qc/qc-report.md");
let manual = "\n\n## Qo'lda tekshiruv (Quality Controller)\n\n_Hali o'tkazilmagan._\n";
if (fs.existsSync(reportPath)) {
  const old = fs.readFileSync(reportPath, "utf8");
  const i = old.indexOf("<!-- AUTO:END -->");
  if (i >= 0) manual = old.slice(i + "<!-- AUTO:END -->".length);
}
fs.writeFileSync(reportPath, lines.join("\n") + manual);
console.log(lines.slice(3).join("\n").replace("<!-- AUTO:END -->", ""));
console.log(`Hisobot: ${path.relative(process.cwd(), reportPath)}`);
process.exit(counts.fail ? 1 : 0);
