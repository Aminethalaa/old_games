#!/usr/bin/env node
/*
 * Headless smoke test for every game in web/games/{builtin,store}.
 *
 *   node tools/test/smoke.cjs                 # all games
 *   node tools/test/smoke.cjs block-stack     # one or more ids
 *   FRAMES=3000 SHOTS=1 node tools/test/smoke.cjs
 *
 * For each game: validates manifest.json, loads the page, checks the READY screen, plays with
 * random button mashing for N fixed frames (deterministic, no wall-clock), fails on any JS error,
 * verifies the field is not blank, round-trips save/resume when the game supports it, and (SHOTS=1)
 * stores screenshots in tools/test/out/.
 */
const fs = require('fs');
const path = require('path');
const { createServer, ROOT, CSP } = require('../dev-server.cjs');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }

const FRAMES = Number(process.env.FRAMES) || 2400;
const SHOTS = !!process.env.SHOTS;
const OUT = path.join(__dirname, 'out');
const CATEGORIES = ['classic', 'arcade', 'puzzle', 'action'];

// tiny seeded RNG so failures are reproducible
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function validateManifest(id, m) {
  const errs = [];
  if (m.id !== id) errs.push(`id "${m.id}" must equal folder name "${id}"`);
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(m.id || '')) errs.push('id must match ^[a-z0-9][a-z0-9-]{1,40}$');
  for (const k of ['name', 'version', 'description', 'author', 'category', 'color', 'layout']) if (!m[k]) errs.push(`missing "${k}"`);
  if (m.sdk !== 1) errs.push('"sdk" must be 1');
  if (m.category && !CATEGORIES.includes(m.category)) errs.push(`category must be one of ${CATEGORIES.join(',')}`);
  if (m.layout && !['classic', 'full'].includes(m.layout)) errs.push('layout must be classic|full');
  if (m.version && !/^\d+\.\d+\.\d+$/.test(m.version)) errs.push('version must be x.y.z');
  if (m.name && m.name.length > 22) errs.push('name too long (max 22)');
  if (m.short && m.short.length > 11) errs.push('short too long (max 11)');
  const ic = m.icon;
  if (!ic || !Array.isArray(ic.rows) || !ic.palette) errs.push('icon {rows,palette} required');
  else {
    const w = ic.rows[0].length;
    if (ic.rows.length < 8 || ic.rows.length > 16) errs.push('icon needs 8-16 rows');
    if (ic.rows.some((r) => r.length !== w)) errs.push('icon rows must have equal length');
    if (w !== ic.rows.length) errs.push('icon must be square');
    const used = new Set(ic.rows.join('').replace(/[. ]/g, ''));
    for (const ch of used) if (!ic.palette[ch]) errs.push(`icon uses "${ch}" but palette lacks it`);
  }
  if (m.achievements) for (const a of m.achievements) if (!a.id || !a.name || !a.desc) errs.push('achievement needs id,name,desc');
  return errs;
}

function listGames() {
  const out = [];
  for (const kind of ['builtin', 'store']) {
    const base = path.join(ROOT, 'games', kind);
    if (!fs.existsSync(base)) continue;
    for (const id of fs.readdirSync(base).sort()) {
      if (id.startsWith('_') || !fs.existsSync(path.join(base, id, 'manifest.json'))) continue;
      out.push({ id, kind, url: `/${kind === 'builtin' ? 'builtin' : 'installed'}/${id}/index.html` });
    }
  }
  return out;
}

async function testGame(browser, base, g, seed) {
  const result = { id: g.id, kind: g.kind, errors: [], notes: [] };
  const dir = path.join(ROOT, 'games', g.kind, g.id);
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch (e) { result.errors.push('manifest.json unreadable: ' + e.message); return result; }
  result.errors.push(...validateManifest(g.id, manifest).map((e) => 'manifest: ' + e));
  if (!fs.existsSync(path.join(dir, 'index.html'))) { result.errors.push('index.html missing'); return result; }

  const ctx = await browser.newContext({ viewport: { width: 408, height: 492 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });

  const url = `${base}${g.url}?test=1`;
  await page.goto(url, { waitUntil: 'load' });
  try { await page.waitForFunction(() => window.Retro && Retro.mode === 'ready', null, { timeout: 8000 }); }
  catch (e) { result.errors.push('never reached READY state'); result.errors.push(...errs); await ctx.close(); return result; }

  if (SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, `${g.id}-1-ready.png`) }); }

  const r = rng(seed);
  const btns = ['up', 'down', 'left', 'right', 'a', 'b'];
  let maxScore = 0, overs = 0, minPixels = 99, shotsTaken = 0, saved = null;
  await page.evaluate(() => Retro.test.start());
  for (let f = 0; f < FRAMES; f += 20) {
    const actions = [];
    for (let i = 0; i < 3; i++) if (r() < 0.6) actions.push([btns[Math.floor(r() * btns.length)], r() < 0.5]);
    const st = await page.evaluate(({ actions, steps }) => {
      for (const [b, down] of actions) { down ? Retro.test.press(b) : Retro.test.release(b); }
      Retro.test.step(steps);
      return { ...Retro.test.state(), px: Retro.test.fieldPixels() };
    }, { actions, steps: 20 });
    maxScore = Math.max(maxScore, st.score);
    minPixels = Math.min(minPixels, st.px);
    if (st.mode === 'over') { overs++; await page.evaluate(() => { Retro.test.step(40); Retro.test.start(); }); }
    if (SHOTS && shotsTaken === 0 && f >= 400) { await page.screenshot({ path: path.join(OUT, `${g.id}-2-play.png`) }); shotsTaken++; }
    if (!saved && f >= 600) {
      saved = await page.evaluate(() => { Retro.saveNow(); return window.__retroLog.filter((m) => m.type === 'save' && m.data).length; });
    }
  }
  const end = await page.evaluate(() => ({ ...Retro.test.state(), px: Retro.test.fieldPixels() }));
  result.notes.push(`maxScore=${maxScore} overs=${overs} end=${end.mode}`);
  if (end.px < 3) result.errors.push('field looks blank (<3 colors) at end');
  if (minPixels < 2 && end.mode === 'play') result.errors.push('field was a single flat color during play');

  // pause overlay + screenshot
  await page.evaluate(() => { Retro.test.release('left'); Retro.test.release('right'); Retro.test.release('up'); Retro.test.release('down'); });
  if (SHOTS) {
    await page.evaluate(() => { if (Retro.mode === 'over') Retro.test.start(); Retro.test.step(60); });
    await page.screenshot({ path: path.join(OUT, `${g.id}-3-late.png`) });
  }

  // save / resume round trip (only for games that persist state)
  if (saved) {
    await page.evaluate(() => { if (Retro.mode === 'over') { Retro.test.step(40); Retro.test.start(); Retro.test.step(60); } Retro.test.step(1); });
    const hasSave = await page.evaluate(() => { Retro.saveNow(); return !!Retro.init.save; });
    if (hasSave) {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.Retro && Retro.mode === 'ready', null, { timeout: 8000 });
      const cont = await page.evaluate(() => { Retro.test.press('start'); Retro.test.release('start'); Retro.test.step(2); return Retro.mode; });
      if (cont !== 'pause' && cont !== 'play') result.errors.push('continue after reload did not resume (mode=' + cont + ')');
      else {
        await page.evaluate(() => { Retro.test.press('start'); Retro.test.step(120); });
        result.notes.push('save/resume ok');
      }
    } else result.notes.push('no save (game has no serialize)');
  }

  // LCD modes must not throw
  for (const lcd of ['gb', 'brick']) {
    await page.evaluate((m) => Retro._n.cmd('lcd', m), lcd);
    if (SHOTS && g.id === 'block-stack') await page.screenshot({ path: path.join(OUT, `${g.id}-lcd-${lcd}.png`) });
  }
  await page.evaluate(() => Retro._n.cmd('sound', true));
  await page.evaluate(() => { Retro.sfx.names.forEach((n) => Retro.sfx.play(n)); });

  result.errors.push(...errs.filter((e, i) => errs.indexOf(e) === i));
  await ctx.close();
  return result;
}

/** Second pass: behave like the Android WebView — strict CSP + window.RetroNative bridge. */
async function nativePass(browser, base, g, result) {
  const ctx = await browser.newContext({ viewport: { width: 408, height: 492 } });
  await ctx.addInitScript((id) => {
    window.__native = []; window.__csp = [];
    window.RetroNative = {
      getInit: () => JSON.stringify({ gameId: id, lang: 'fr', sound: true, volume: 0.5, lcd: 'color', grid: false, vibrate: true, hi: 1234, save: null, unlocked: [] }),
      getLibrary: () => JSON.stringify({ games: [] }),
      postMessage: (s) => window.__native.push(JSON.parse(s)),
    };
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  }, g.id);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('native pageerror: ' + e.message));
  await page.goto(`${base}${g.url}?test=1`, { waitUntil: 'load' });
  try { await page.waitForFunction(() => window.Retro && Retro.mode === 'ready', null, { timeout: 8000 }); }
  catch (e) { result.errors.push('native pass: never READY'); await ctx.close(); return; }
  const hi = await page.evaluate(() => Retro.hud.hi);
  if (hi !== 1234) result.errors.push('native pass: hi-score from getInit not applied (' + hi + ')');
  await page.evaluate(() => Retro.test.start());
  for (let i = 0; i < 40; i++) await page.evaluate(() => { Retro.test.press('a'); Retro.test.press('left'); Retro.test.step(30); Retro.test.release('left'); Retro.test.release('a'); Retro.test.step(5); });
  await page.evaluate(() => Retro.saveNow());
  const msgs = await page.evaluate(() => ({ native: window.__native.map((m) => m.type), csp: window.__csp }));
  if (!msgs.native.includes('ready')) result.errors.push('native pass: no "ready" message posted to the shell');
  if (msgs.csp.length) result.errors.push('CSP violations: ' + [...new Set(msgs.csp)].join(' | '));
  const unexpected = msgs.native.filter((t) => !['ready', 'state', 'played', 'save', 'hiscore', 'gameover', 'achievement', 'vibrate', 'sound', 'reset', 'error'].includes(t));
  if (unexpected.length) result.errors.push('native pass: unknown bridge message types ' + [...new Set(unexpected)].join(','));
  if (msgs.native.includes('error')) result.errors.push('native pass: game reported errors through the bridge');
  result.errors.push(...errs);
  result.notes.push('bridge msgs: ' + [...new Set(msgs.native)].join(','));
  await ctx.close();
}

/** The console home screen as the Android WebView runs it: library via RetroNative, strict CSP. */
async function homePass(browser, base) {
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 408, height: 492 } });
  await ctx.addInitScript(() => {
    window.__native = []; window.__csp = [];
    const icon = { palette: { R: '#ff004d' }, rows: ['RR......', 'RR......', '........', '........', '........', '........', '........', '........'] };
    const games = ['a', 'b', 'c', 'd'].map((id, i) => ({ id: 'game-' + id, name: 'Game ' + id, short: 'G' + id, category: 'arcade', color: '#29adff', description: 'desc ' + id, hi: i * 100, isNew: i === 3, icon }));
    window.RetroNative = {
      getInit: () => JSON.stringify({ gameId: '', lang: 'en', sound: true, volume: 0.7, lcd: 'color', grid: false, vibrate: true }),
      getLibrary: () => JSON.stringify({ games }),
      postMessage: (s) => window.__native.push(JSON.parse(s)),
    };
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('home pageerror: ' + e.message));
  await page.goto(`${base}/shell/home.html?boot=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.RetroHome, null, { timeout: 5000 });
  await page.waitForTimeout(3600); // boot animation (≈2.8 s) finishes on its own
  const n = await page.evaluate(() => RetroHome.items().length);
  if (n !== 8) errors.push(`home: expected 4 games + 4 special tiles, got ${n}`);
  await page.evaluate(() => { Retro._n.button('right', true); Retro._n.button('right', false); Retro._n.button('a', true); Retro._n.button('a', false); });
  let msgs = await page.evaluate(() => window.__native);
  const launch = msgs.find((m) => m.type === 'launch');
  if (!launch || launch.id !== 'game-b') errors.push('home: A on the 2nd tile should post launch game-b, got ' + JSON.stringify(launch));
  for (const [steps, target] of [[3, 'store'], [1, 'trophies'], [1, 'settings'], [1, 'import']]) {
    await page.evaluate((k) => { for (let i = 0; i < k; i++) { Retro._n.button('right', true); Retro._n.button('right', false); } Retro._n.button('start', true); Retro._n.button('start', false); }, steps);
  }
  msgs = await page.evaluate(() => window.__native);
  const opens = msgs.filter((m) => m.type === 'open').map((m) => m.target).join(',');
  if (opens !== 'store,trophies,settings,import') errors.push('home: special tiles posted open=' + opens);
  const csp = await page.evaluate(() => window.__csp);
  if (csp.length) errors.push('home CSP violations: ' + csp.join(' | '));
  await page.goto(`${base}/shell/home.html?last=game-c`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.RetroHome && RetroHome.items().length, null, { timeout: 5000 });
  const selected = await page.evaluate(() => RetroHome.selected());
  if (selected !== 2) errors.push('home: ?last=game-c should select tile 2, got ' + selected);
  await ctx.close();
  return errors;
}

(async () => {
  const filter = process.argv.slice(2);
  const games = listGames().filter((g) => !filter.length || filter.includes(g.id));
  if (filter.includes('home') && !games.length) games.push(...[]);
  if (!games.length && !filter.includes('home')) { console.error('no games found'); process.exit(2); }
  if (!CSP) { console.error('could not read the app CSP from WebPaths.kt'); process.exit(2); }
  const server = createServer({ csp: true });
  await new Promise((res) => server.listen(0, res));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let failed = 0;
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    let res;
    try { res = await testGame(browser, base, g, 1234 + i); } catch (e) { res = { id: g.id, errors: ['harness: ' + e.message], notes: [] }; }
    try { await nativePass(browser, base, g, res); } catch (e) { res.errors.push('native pass harness: ' + e.message); }
    const ok = res.errors.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${g.id.padEnd(16)} ${res.notes.join(' | ')}`);
    for (const e of res.errors) console.log('      - ' + e);
  }
  let homeErrors = [];
  if (!filter.length || filter.includes('home')) {
    homeErrors = await homePass(browser, base);
    console.log(`${homeErrors.length ? 'FAIL' : 'PASS'}  home screen`);
    homeErrors.forEach((e) => console.log('      - ' + e));
    if (homeErrors.length) failed++;
  }
  await browser.close();
  server.close();
  console.log(`\n${games.length - failed + (homeErrors.length ? 1 : 0)}/${games.length} games passed`);
  process.exit(failed ? 1 : 0);
})();
