#!/usr/bin/env node
// Foydalanish: npm run new-project -- 002 "Yapon bog'i"
import fs from "node:fs";
import path from "node:path";
import { ROOT, pipeline } from "./lib.mjs";

const [id, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(" ");
if (!/^\d{3}$/.test(id ?? "") || !title) {
  console.error('Foydalanish: npm run new-project -- <3 xonali raqam> "<nom>"');
  process.exit(1);
}
const slug = `${id}-${title.toLowerCase().normalize("NFKD").replace(/[ʻʼ'`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
const dir = path.join(ROOT, "projects", slug);
if (fs.existsSync(dir)) {
  console.error(`Allaqachon mavjud: ${dir}`);
  process.exit(1);
}
const p = pipeline();
for (const s of p.stages) fs.mkdirSync(path.join(dir, s.folder), { recursive: true });
for (const sub of ["04-motion/renders", "05-edit/exports", "assets/music", "assets/sfx", "assets/footage", "assets/renders-3d"]) {
  fs.mkdirSync(path.join(dir, sub), { recursive: true });
}
const stages = Object.fromEntries(p.stages.map((s) => [s.key, { agent: s.agent, status: "todo", notes: "" }]));
fs.writeFileSync(
  path.join(dir, "project.json"),
  JSON.stringify(
    { id, slug, title, channel: p.channel, format: { ...p.format, targetDurationSec: 30 }, createdAt: new Date().toISOString().slice(0, 10), stages },
    null,
    2,
  ) + "\n",
);
fs.writeFileSync(path.join(dir, "00-brief.md"), `# №${id} — ${title} · Brief\n\n## Maqsad\n\n## Asosiy g'oya\n\n## Cheklovlar\n\n## Muvaffaqiyat mezonlari\n`);
const tpl = JSON.parse(fs.readFileSync(path.join(ROOT, "studio/templates/script.template.json"), "utf8"));
fs.writeFileSync(path.join(dir, "01-creative/script.json"), JSON.stringify({ ...tpl, projectId: id, title }, null, 2) + "\n");
console.log(`✔ Yaratildi: projects/${slug}`);
console.log("Keyingi qadam: 00-brief.md ni to'ldiring va creative-director agentini chaqiring.");
