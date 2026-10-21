// Reklamani kadrma-kadr MP4 videoga aylantiradi: node render.js [soniya] [fps]
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const dir = __dirname;
const seconds = Number(process.argv[2] || 10), fps = Number(process.argv[3] || 30);
const W = 1086, H = 1448;

(async () => {
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
  path.join(dir, 'aziz-floran-ad.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });

for (let i = 0; i < seconds * fps; i++) {
  const t = (i / fps) * 1000;
  await page.evaluate(t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }), t);
  ff.stdin.write(await page.screenshot({ type: 'png' }));
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
})();
