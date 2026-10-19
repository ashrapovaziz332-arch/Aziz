import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const pipeline = () => readJson(path.join(ROOT, "studio/pipeline.json"));

/** "001" yoki "001-islomiy-landshaft" → loyiha papkasi */
export const projectDir = (id) => {
  const dir = path.join(ROOT, "projects");
  const match = fs.readdirSync(dir).find((d) => d === id || d.startsWith(`${id}-`));
  if (!match) throw new Error(`Loyiha topilmadi: ${id}`);
  return path.join(dir, match);
};

/** Oddiy glob: faqat fayl nomida "*" ni qo'llab-quvvatlaydi (masalan renders/*.mp4) */
export const globFiles = (base, pattern) => {
  const dir = path.join(base, path.dirname(pattern));
  if (!fs.existsSync(dir)) return [];
  const re = new RegExp("^" + path.basename(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f));
};
