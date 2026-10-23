// Screenshots the console home screen (menu + boot animation). Usage: node tools/test/home-shot.cjs [lcd]
const path = require('path'); const fs = require('fs');
const { createServer } = require('../dev-server.cjs');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }
(async () => {
  const lcd = process.argv[2] || 'color';
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  const server = createServer(); await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 408, height: 492 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`${base}/shell/home.html?boot=1&lcd=${lcd}`);
  await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, `home-boot1-${lcd}.png`) });
  await page.waitForTimeout(1500); await page.screenshot({ path: path.join(out, `home-boot2-${lcd}.png`) });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(out, `home-menu-${lcd}.png`) });
  for (let i = 0; i < 7; i++) await page.evaluate(() => Retro._n.button('right', true) || Retro._n.button('right', false));
  await page.evaluate(() => { Retro._n.button('down', true); Retro._n.button('down', false); });
  await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, `home-menu2-${lcd}.png`) });
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close(); server.close();
})();
