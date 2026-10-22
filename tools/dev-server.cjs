#!/usr/bin/env node
/*
 * Dev server that mirrors the URL layout the Android app serves to its game WebView:
 *   /sdk/*              -> web/sdk
 *   /shell/*            -> web/shell        (console home screen)
 *   /builtin/<id>/*     -> web/games/builtin/<id>
 *   /installed/<id>/*   -> web/games/store/<id>   (store games behave like "installed" ones)
 *   /__library.json     -> what the native shell would hand to the home screen
 *
 * Usage: node tools/dev-server.cjs [port]      then open http://localhost:8080/
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'web');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm',
};

function listGames(dir, kind) {
  const base = path.join(ROOT, 'games', dir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(base, d, 'manifest.json'))).sort().map((id) => {
    const m = JSON.parse(fs.readFileSync(path.join(base, id, 'manifest.json'), 'utf8'));
    return { ...m, id, url: `/${kind}/${id}/${m.entry || 'index.html'}`, builtin: dir === 'builtin', installed: true, hi: 0, isNew: false };
  });
}

function library() {
  return { sdk: 1, lang: 'en', games: [...listGames('builtin', 'builtin'), ...listGames('store', 'installed')] };
}

let EXTRA_INSTALLED = null;   // optional extra folder of "installed" games (tests put generated game-file entries here)

function resolveFile(urlPath) {
  let m;
  if (urlPath.startsWith('/emu/')) return path.join(ROOT, 'emulators', urlPath.slice(5));
  if (EXTRA_INSTALLED && (m = urlPath.match(/^\/installed\/([^/]+)\/(.*)$/))) {
    const extra = path.join(EXTRA_INSTALLED, m[1], m[2] || 'index.html');
    if (fs.existsSync(extra)) return extra;
  }
  if (urlPath.startsWith('/sdk/')) return path.join(ROOT, 'sdk', urlPath.slice(5));
  if (urlPath.startsWith('/shell/')) return path.join(ROOT, 'shell', urlPath.slice(7));
  if ((m = urlPath.match(/^\/builtin\/([^/]+)\/(.*)$/))) return path.join(ROOT, 'games', 'builtin', m[1], m[2] || 'index.html');
  if ((m = urlPath.match(/^\/installed\/([^/]+)\/(.*)$/))) return path.join(ROOT, 'games', 'store', m[1], m[2] || 'index.html');
  return null;
}

function indexPage() {
  const lib = library().games;
  const rows = lib.map((g) => `<li><a href="${g.url}?autoplay=0">${g.name}</a> <small>${g.category} · ${g.builtin ? 'built-in' : 'store'}</small></li>`).join('');
  return `<!doctype html><meta charset=utf-8><title>Retro dev</title><body style="font:16px sans-serif;background:#10131c;color:#e8f1ff;padding:24px">
<h2>Retro Console — dev server</h2><p><a style="color:#ffec27" href="/shell/home.html">Console home screen</a> · query flags: <code>?lcd=gb|brick</code> <code>?grid=1</code> <code>?lang=fr|ar</code> <code>?sound=0</code> <code>?autoplay=1</code> <code>?test=1</code></p>
<ul>${rows}</ul><p>Keys: arrows/WASD move · Z/Space = A · X = B · Enter/P = START · R = reset · M = sound</p>`;
}

// The exact Content-Security-Policy the Android app attaches to every local HTML document (single source of truth: WebPaths.kt).
function appCsp() {
  try {
    const kt = fs.readFileSync(path.resolve(__dirname, '..', 'android/app/src/main/java/com/retroconsole/app/console/WebPaths.kt'), 'utf8');
    const block = kt.slice(kt.indexOf('const val CSP ='));
    const lines = block.split('\n').slice(0, 4).join('\n');
    return [...lines.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join('');
  } catch (e) { return ''; }
}
const CSP = appCsp();

function createServer(opts = {}) {
  if (opts.extraInstalled) EXTRA_INSTALLED = opts.extraInstalled;
  const csp = opts.csp !== false && CSP;
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    if (p === '/') { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end(indexPage()); }
    if (p === '/__library.json') { res.writeHead(200, { 'Content-Type': MIME['.json'] }); return res.end(JSON.stringify(library())); }
    let file = resolveFile(p);
    if (!file || !(file.startsWith(ROOT) || (EXTRA_INSTALLED && file.startsWith(EXTRA_INSTALLED)))) { res.writeHead(404); return res.end('not found'); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
      if (csp && path.extname(file) === '.html') headers['Content-Security-Policy'] = csp;
      res.writeHead(200, headers);
      res.end(buf);
    });
  });
}

module.exports = { createServer, library, ROOT, CSP };

if (require.main === module) {
  const port = Number(process.argv[2]) || 8080;
  createServer().listen(port, () => console.log(`Retro dev server: http://localhost:${port}/`));
}
