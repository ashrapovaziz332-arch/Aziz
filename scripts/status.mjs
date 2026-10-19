#!/usr/bin/env node
// Barcha loyihalar holati yoki bitta loyiha: npm run status [-- 001]
import fs from "node:fs";
import path from "node:path";
import { ROOT, pipeline, projectDir, readJson } from "./lib.mjs";

const icon = { todo: "·", in_progress: "▶", review: "?", changes_requested: "✗", done: "✔" };
const p = pipeline();
const ids = process.argv[2] ? [path.basename(projectDir(process.argv[2]))] : fs.readdirSync(path.join(ROOT, "projects")).sort();

for (const slug of ids) {
  const proj = readJson(path.join(ROOT, "projects", slug, "project.json"));
  console.log(`\n№${proj.id} — ${proj.title}`);
  for (const s of p.stages) {
    const st = proj.stages[s.key];
    const blockedBy = s.dependsOn.filter((d) => proj.stages[d].status !== "done");
    const ready = st.status === "todo" && blockedBy.length === 0 ? "  ← boshlashga tayyor" : "";
    const wait = st.status === "todo" && blockedBy.length ? `  (kutmoqda: ${blockedBy.join(", ")})` : "";
    console.log(`  ${icon[st.status] ?? "?"} ${s.folder.padEnd(13)} ${s.agent.padEnd(20)} ${st.status}${ready}${wait}`);
  }
}
