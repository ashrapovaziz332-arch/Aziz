// Muqova PNG/JPG: node tools/cover.js reels-muqova.jpg
const path = require('path'), { chromium } = require('playwright');
(async () => {
  const out = path.resolve(process.argv[2] || 'reels-muqova.jpg');
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?render=1');
  await p.evaluate(async () => { await window.REEL.ready; window.REEL.cover(); });
  await p.locator('#c').screenshot({ path: out, ...(out.endsWith('.jpg') ? { type: 'jpeg', quality: 95 } : {}) });
  await b.close(); console.log(out);
})();
