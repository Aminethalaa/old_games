#!/usr/bin/env node
/*
 * Tests the bundled emulator players (web/emulators) end to end in headless Chromium — with the app's strict CSP —
 * using two tiny programs made by tools/make_test_roms.py (no commercial game files involved):
 *   NES: red screen, green while A is held      Game Boy: white screen, black while A is held
 *
 *   node tools/test/emulators.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createServer, ROOT, CSP } = require('../dev-server.cjs');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-emu-'));
execFileSync('python3', [path.join(__dirname, '..', 'make_test_roms.py'), path.join(tmp, 'roms')], { stdio: 'ignore' });

function makeEntry(core, id, romFile) {
  const dir = path.join(tmp, 'games', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'emulators', core, 'rom-index.html'), path.join(dir, 'index.html'));
  fs.copyFileSync(path.join(tmp, 'roms', romFile), path.join(dir, 'rom.bin'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id, name: 'Test Program', version: '1.0.0', sdk: 1, layout: 'full', category: 'other', color: '#29adff', controls: { dpad: 'Move', a: 'A (A+B = Select)', b: 'B', start: 'Start' } }));
}
makeEntry('nes', 'rom-test-nes', 'nes-test.nes');
makeEntry('gb', 'rom-test-gb', 'gb-test.gb');

const pixel = (page) => page.evaluate(() => {
  const c = document.getElementById('rc-field'), g = c.getContext('2d');
  const d = g.getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return [d[0], d[1], d[2]];
});

async function run(browser, base, id, expect) {
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 408, height: 492 } });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/installed/${id}/index.html?test=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Retro && Retro.mode === 'ready', null, { timeout: 8000 });
  await page.waitForTimeout(800);                         // wasm + game file load asynchronously
  await page.evaluate(() => { Retro.test.start(); Retro.test.step(150); });
  const idle = await pixel(page);
  await page.evaluate(() => { Retro.test.press('a'); Retro.test.step(30); });
  const held = await pixel(page);
  await page.evaluate(() => { Retro.test.release('a'); Retro.test.step(30); });
  const back = await pixel(page);
  await page.evaluate(() => { Retro._n.cmd('reset'); Retro.test.start(); Retro.test.step(120); });   // RESET key: power-cycle the game
  const afterReset = await pixel(page);
  const csp = await page.evaluate(() => window.__csp);
  await ctx.close();
  const problems = [...errs];
  if (csp.length) problems.push('CSP violations: ' + [...new Set(csp)].join(' | '));
  if (!expect.idle(idle)) problems.push('idle screen wrong: ' + idle);
  if (!expect.held(held)) problems.push('screen while A held wrong: ' + held);
  if (!expect.idle(back)) problems.push('screen after releasing A wrong: ' + back);
  if (!expect.idle(afterReset)) problems.push('screen after RESET wrong: ' + afterReset);
  return { problems, note: `idle=${idle} held=${held}` };
}

(async () => {
  if (!CSP) { console.error('could not read the app CSP'); process.exit(2); }
  const server = createServer({ csp: true, extraInstalled: path.join(tmp, 'games') });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let failed = 0;
  const cases = [
    ['NES  (jsnes)', 'rom-test-nes', { idle: ([r, g, b]) => r > g + 40 && r > b + 40, held: ([r, g, b]) => g > r + 40 && g > b + 40 }],
    ['GB   (binjgb)', 'rom-test-gb', { idle: ([r, g, b]) => r > 190 && g > 190 && b > 190, held: ([r, g, b]) => r < 70 && g < 70 && b < 70 }],
  ];
  for (const [label, id, expect] of cases) {
    let res;
    try { res = await run(browser, base, id, expect); } catch (e) { res = { problems: ['harness: ' + e.message], note: '' }; }
    const ok = res.problems.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${res.note}`);
    res.problems.forEach((p) => console.log('      - ' + p));
  }
  await browser.close(); server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
