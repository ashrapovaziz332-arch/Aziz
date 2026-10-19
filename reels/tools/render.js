// MP4 eksport: node tools/render.js [out.mp4] [fps] [workers]
// Kadrlarni headless Chromium'da chizadi, ffmpeg bilan H.264 ga yig'adi (jim AAC trek bilan — Instagram uchun).
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2] || 'aziz-floran-12-uslub.mp4'), FPS = +(process.argv[3] || 30), N = +(process.argv[4] || 4);
const DUR = 72, TOTAL = DUR * FPS, tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'reel-'));
const ff = (args, input) => new Promise((res, rej) => { const p = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] }); p.on('exit', c => c ? rej(new Error('ffmpeg ' + c)) : res()); if (input) input(p.stdin); });
(async () => {
  const browser = await chromium.launch();
  const seg = Math.ceil(TOTAL / N); let done = 0;
  await Promise.all(Array.from({ length: N }, async (_, w) => {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?render=1');
    await page.evaluate(() => window.REEL.ready);
    const a = w * seg, b = Math.min(TOTAL, a + seg);
    await ff(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), path.join(tmp, `s${w}.mp4`)], async stdin => {
      for (let f = a; f < b; f++) {
        await page.evaluate(t => window.REEL.render(t), f / FPS);
        const buf = await page.screenshot({ type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
        if (!stdin.write(buf)) await new Promise(r => stdin.once('drain', r));
        if (++done % 150 === 0) console.log(`${done}/${TOTAL}`);
      }
      stdin.end();
    });
  }));
  await browser.close();
  fs.writeFileSync(path.join(tmp, 'list.txt'), Array.from({ length: N }, (_, w) => `file 's${w}.mp4'`).join('\n'));
  await ff(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', OUT]);
  console.log('Tayyor:', OUT);
})().catch(e => { console.error(e); process.exit(1); });
