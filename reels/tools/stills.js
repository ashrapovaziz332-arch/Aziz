// Usage: node stills.js outDir t1 t2 ...  — saves PNG kadrlar
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const [out, ...ts] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => console.log('console:', m.text()));
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?render=1');
  await page.evaluate(() => window.REEL.ready);
  for (const t of ts) {
    await page.evaluate(t => window.REEL.render(t), +t);
    await page.locator('#c').screenshot({ path: path.join(out, `t${(+t).toFixed(2).padStart(6, '0')}.png`) });
  }
  await browser.close();
})();
