/* Capsule Clinic — drop two-colour capsules into the bottle, line up four of a colour, wipe out the germs.
   Original game for the Retro SDK. */
(function () {
  'use strict';
  var R = Retro, C = R.colors, U = R.util;

  var COLS = 8, ROWS = 16, CELL = 16, FW = COLS * CELL, FH = ROWS * CELL;
  var DX = [1, 0, -1, 0], DY = [0, -1, 0, 1];            // 0 right, 1 up, 2 left, 3 down
  var COL = ['#ff4d6d', '#ffd23f', '#3fa9ff'];           // red, yellow, blue
  var FALL_STEP = 0.055;                                 // seconds per row while loose halves settle
  var CLEAR_TIME = 0.34;
  var MAX_GERMS = 48;

  /* ---------------------------------------------------------------- seeded RNG (no Math.random in game logic) */
  var seed = (function () {
    var m = /[?&]seed=(\d+)/.exec(location.search);
    return m ? (+m[1]) >>> 0 : (Math.random() * 4294967296) >>> 0;
  })();
  function rnd() {
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rndInt(n) { return Math.floor(rnd() * n); }

  /* ------------------------------------------------------------------------------------------- germ sprites */
  // body half-widths per row (14 rows, mirrored around the centre)
  var BODY = [
    [0, 0, 3, 5, 6, 7, 7, 7, 7, 7, 6, 5, 3, 0],          // gloop (red): round blob with antennae
    [0, 0, 0, 2, 4, 5, 5, 5, 5, 5, 4, 2, 0, 0],          // spike (yellow): spiky ball
    [0, 3, 5, 6, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0]           // squid (blue): dome with wiggly legs
  ];
  var EYE_Y = [4, 5, 4];
  var germSprites = [];                                  // [colour][mood][frame] -> canvas

  function germRows(kind, frame, mood) {
    var g = [], mask = [], x, y;
    for (y = 0; y < 14; y++) { g.push([]); mask.push([]); for (x = 0; x < 14; x++) { g[y].push('.'); mask[y].push(false); } }
    function put(px, py, ch) { if (px >= 0 && px < 14 && py >= 0 && py < 14) g[py][px] = ch; }
    function inMask(px, py) { return py >= 0 && py < 14 && px >= 0 && px < 14 && mask[py][px]; }
    var dy = kind === 0 && frame ? 1 : 0, hw = BODY[kind], top = -1;
    for (y = 0; y < 14; y++) {
      var yy = y - dy, w = yy >= 0 && yy < 14 ? hw[yy] : 0;
      for (x = 7 - w; x < 7 + w; x++) mask[y][x] = true;
      if (w && top < 0) top = y;
    }
    for (y = 0; y < 14; y++) for (x = 0; x < 14; x++) {
      if (!mask[y][x]) continue;
      var edge = !inMask(x - 1, y) || !inMask(x + 1, y) || !inMask(x, y - 1) || !inMask(x, y + 1), ch = 'o';
      if (!edge) {
        var lx = x; while (inMask(lx - 1, y)) lx--;
        ch = 'b';
        if (x - lx <= 2 && y - top <= 3) ch = 'l';
        else if (!inMask(x, y + 2)) ch = 's';
      }
      g[y][x] = ch;
    }
    // decorations
    if (kind === 0) {
      if (!frame) { put(4, 1, 'a'); put(3, 0, 'l'); put(9, 1, 'a'); put(10, 0, 'l'); }
      else { put(4, 2, 'a'); put(4, 1, 'a'); put(4, 0, 'l'); put(9, 2, 'a'); put(9, 1, 'a'); put(9, 0, 'l'); }
    } else if (kind === 1) {
      var sp = frame ?
        [[3, 3], [2, 2], [1, 1], [10, 3], [11, 2], [12, 1], [3, 11], [2, 12], [1, 13], [10, 11], [11, 12], [12, 13]] :
        [[6, 2], [7, 2], [6, 1], [7, 1], [6, 12], [7, 12], [6, 13], [7, 13], [1, 6], [1, 7], [0, 6], [0, 7], [12, 6], [12, 7], [13, 6], [13, 7]];
      sp.forEach(function (p) { put(p[0], p[1], 'a'); });
    } else {
      [2, 5].forEach(function (x0) {
        var pts = frame ? [[x0, 11], [x0 + 1, 12], [x0 + 1, 13]] : [[x0, 11], [x0, 12], [x0 - 1, 13]];
        pts.forEach(function (p) { put(p[0], p[1], 'a'); put(13 - p[0], p[1], 'a'); });
      });
    }
    // face
    var ey = EYE_Y[kind] + dy, ym = ey + 3;
    if (mood === 'hurt') {
      put(3, ey, 'k'); put(4, ey, 'b'); put(3, ey + 1, 'b'); put(4, ey + 1, 'k');
      put(10, ey, 'k'); put(9, ey, 'b'); put(10, ey + 1, 'b'); put(9, ey + 1, 'k');
      put(6, ym, 'k'); put(7, ym, 'k'); put(6, ym + 1, 'k'); put(7, ym + 1, 'k');
    } else {
      put(3, ey, 'w'); put(4, ey, 'w'); put(3, ey + 1, 'w'); put(4, ey + 1, 'k');
      put(10, ey, 'w'); put(9, ey, 'w'); put(10, ey + 1, 'w'); put(9, ey + 1, 'k');
      if (mood === 'laugh') {
        put(5, ym, 'k'); put(6, ym, 'k'); put(7, ym, 'k'); put(8, ym, 'k');
        put(5, ym + 1, 'k'); put(6, ym + 1, 't'); put(7, ym + 1, 't'); put(8, ym + 1, 'k');
      } else { put(5, ym, 'k'); put(8, ym, 'k'); put(6, ym + 1, 'k'); put(7, ym + 1, 'k'); }
    }
    return g.map(function (r) { return r.join(''); });
  }

  function buildSprites() {
    germSprites = [];
    for (var c = 0; c < 3; c++) {
      var m = COL[c];
      var pal = { o: U.shade(m, -0.62), b: m, l: U.shade(m, 0.55), s: U.shade(m, -0.22), a: U.shade(m, -0.3), w: '#ffffff', k: '#1b1033', t: '#ff7aa8' };
      germSprites.push({});
      ['happy', 'laugh', 'hurt'].forEach(function (mood) {
        germSprites[c][mood] = [R.sprite(germRows(c, 0, mood), pal, 1), R.sprite(germRows(c, 1, mood), pal, 1)];
      });
    }
  }

  /* --------------------------------------------------------------------------------------------- state */
  var grid, cap, nextCap, phase, phaseT, fallT, level, germs, chain, capCount, lockT, lockMoves, fallAcc;
  var needRelease, lost, banner, visT = 0, popT = 0;

  function emptyGrid() { var g = []; for (var y = 0; y < ROWS; y++) { g.push([]); for (var x = 0; x < COLS; x++) g[y].push(null); } return g; }
  function inB(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }
  function free(x, y) { return inB(x, y) && !grid[y][x]; }
  function randC() {                                    // mild bias towards colours that still have germs
    var cnt = [1, 1, 1], x, y, tot;
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (grid[y][x] && grid[y][x].k === 0) cnt[grid[y][x].c] += 0.4;
    tot = cnt[0] + cnt[1] + cnt[2];
    var r = rnd() * tot;
    return r < cnt[0] ? 0 : r < cnt[0] + cnt[1] ? 1 : 2;
  }
  function animT() {
    if (R.mode === 'over' || R.mode === 'ready') { visT += 1 / 60; return visT; }
    return R.time;
  }
  function gravityInterval() {
    return Math.max(0.085, (0.68 - 0.035 * (level - 1)) * Math.pow(0.97, Math.floor(capCount / 6)));
  }

  /* ---------------------------------------------------------------------------------------------- level */
  function runLen(x, y, c, dx, dy) {
    var n = 0;
    while (inB(x, y) && grid[y][x] && grid[y][x].c === c) { n++; x += dx; y += dy; }
    return n;
  }
  function makesRun3(x, y, c) {
    var h = 1 + runLen(x - 1, y, c, -1, 0) + runLen(x + 1, y, c, 1, 0);
    var v = 1 + runLen(x, y - 1, c, 0, -1) + runLen(x, y + 1, c, 0, 1);
    return h >= 3 || v >= 3;
  }
  function placeGerms(n, minRow) {
    var cells = [], x, y, i, placed = 0, counts = [0, 0, 0];
    for (y = minRow; y < ROWS; y++) for (x = 0; x < COLS; x++) cells.push([x, y]);
    for (i = cells.length - 1; i > 0; i--) { var j = rndInt(i + 1), t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    for (i = 0; i < cells.length && placed < n; i++) {
      var order = [0, 1, 2].map(function (c) { return { c: c, k: counts[c] + rnd() * 1.6 }; }).sort(function (a, b) { return a.k - b.k; });
      for (var o = 0; o < 3; o++) {
        var c = order[o].c;
        if (!makesRun3(cells[i][0], cells[i][1], c)) {
          grid[cells[i][1]][cells[i][0]] = { k: 0, c: c, l: -1 };
          counts[c]++; placed++;
          break;
        }
      }
    }
    return placed;
  }

  function startLevel(n) {
    level = n; R.level = Math.min(99, n);
    grid = emptyGrid();
    var want = Math.min(MAX_GERMS, 3 + 3 * n), minRow = Math.max(5, 9 - Math.floor(n / 2));
    germs = placeGerms(want, minRow);
    R.hud.extra = germs;
    nextCap = [randC(), randC()];
    capCount = 0; chain = 0; cap = null; lost = false;
    banner = { t: 1.7, a: 'LEVEL ' + n, b: germs + ' GERMS' };
    spawn();
  }

  function spawn() {
    cap = { x: 3, y: 0, o: 0, c: nextCap };
    nextCap = [randC(), randC()];
    capCount++; lockT = 0; lockMoves = 0; fallAcc = 0; phase = 'drop';
    if (!free(3, 0) || !free(4, 0)) { lose(); return false; }
    return true;
  }

  function lose() {
    lost = true; phase = 'over';
    R.fx.shake(3, 0.5); R.vibrate(150);
    R.gameOver();
  }

  /* --------------------------------------------------------------------------------------------- capsule */
  function capCells(c) { return [[c.x, c.y], [c.x + DX[c.o], c.y + DY[c.o]]]; }
  function capFits(x, y, o) { return free(x, y) && free(x + DX[o], y + DY[o]); }
  function grounded() { return !capFits(cap.x, cap.y + 1, cap.o); }
  function bumpLock() { if (lockT > 0 && lockMoves < 15) { lockT = 0; lockMoves++; } }

  function tryMove(dx) {
    if (!capFits(cap.x + dx, cap.y, cap.o)) return false;
    cap.x += dx; bumpLock(); R.sfx.play('move');
    return true;
  }

  function rotate(dir) {                                  // dir +1 = clockwise (A), -1 = anticlockwise (B)
    var no = (cap.o + (dir > 0 ? 3 : 1)) % 4;
    var tries = [[0, 0], [-DX[no], -DY[no]]];
    for (var i = 0; i < tries.length; i++) {
      var nx = cap.x + tries[i][0], ny = cap.y + tries[i][1];
      if (capFits(nx, ny, no)) {
        cap.x = nx; cap.y = ny; cap.o = no; bumpLock();
        R.sfx.play('rotate');
        return true;
      }
    }
    return false;
  }

  function lockCapsule() {
    var cells = capCells(cap);
    for (var i = 0; i < 2; i++) {
      var p = cells[i];
      if (inB(p[0], p[1])) grid[p[1]][p[0]] = { k: 1, c: cap.c[i], l: i === 0 ? cap.o : (cap.o + 2) % 4 };
    }
    cap = null; needRelease = R.input.held.down;
    R.sfx.play('land'); R.vibrate(10);
    chain = 0;
    afterFall();
  }

  /* ------------------------------------------------------------------------------------- match & gravity */
  function findMatches() {
    var mark = {}, list = [], x, y;
    function add(px, py) { var key = py * COLS + px; if (!mark[key]) { mark[key] = 1; list.push([px, py]); } }
    for (y = 0; y < ROWS; y++) {
      x = 0;
      while (x < COLS) {
        var cell = grid[y][x];
        if (!cell) { x++; continue; }
        var e = x; while (e + 1 < COLS && grid[y][e + 1] && grid[y][e + 1].c === cell.c) e++;
        if (e - x + 1 >= 4) for (var k = x; k <= e; k++) add(k, y);
        x = e + 1;
      }
    }
    for (x = 0; x < COLS; x++) {
      y = 0;
      while (y < ROWS) {
        var cl = grid[y][x];
        if (!cl) { y++; continue; }
        var f = y; while (f + 1 < ROWS && grid[f + 1][x] && grid[f + 1][x].c === cl.c) f++;
        if (f - y + 1 >= 4) for (var m = y; m <= f; m++) add(x, m);
        y = f + 1;
      }
    }
    return list;
  }

  function fixLinks() {
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      var c = grid[y][x];
      if (!c || c.k !== 1 || c.l < 0) continue;
      var px = x + DX[c.l], py = y + DY[c.l];
      var p = inB(px, py) ? grid[py][px] : null;
      if (!p || p.k !== 1 || p.l !== (c.l + 2) % 4) c.l = -1;
    }
  }

  function fallStep() {
    var moved = false, x, y;
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (grid[y][x]) grid[y][x].mv = false;
    for (y = ROWS - 2; y >= 0; y--) {
      for (x = 0; x < COLS; x++) {
        var c = grid[y][x];
        if (!c || c.k !== 1 || c.l === 2 || c.l === 3) continue;
        if (c.l === -1) {
          if (free(x, y + 1)) { grid[y + 1][x] = c; grid[y][x] = null; c.mv = true; moved = true; }
        } else if (c.l === 0) {
          if (free(x, y + 1) && free(x + 1, y + 1)) {
            var p = grid[y][x + 1];
            grid[y + 1][x] = c; grid[y + 1][x + 1] = p; grid[y][x] = null; grid[y][x + 1] = null;
            c.mv = true; p.mv = true; moved = true;
          }
        } else if (c.l === 1) {
          if (free(x, y + 1)) {
            var up = grid[y - 1][x];
            grid[y + 1][x] = c; grid[y][x] = up; grid[y - 1][x] = null;
            c.mv = true; up.mv = true; moved = true;
          }
        }
      }
    }
    return moved;
  }

  function startClear(list) {
    chain++;
    var g = 0, h = 0, sx = 0, sy = 0;
    list.forEach(function (p) {
      var c = grid[p[1]][p[0]];
      c.clr = true;
      if (c.k === 0) g++; else h++;
      sx += p[0]; sy += p[1];
    });
    var mult = Math.min(chain, 8), pts = (g * 100 + h * 10) * mult;
    R.addScore(pts);
    germs = Math.max(0, germs - g); R.hud.extra = germs;
    var cx = sx / list.length * CELL + CELL / 2, cy = sy / list.length * CELL;
    R.fx.text(U.clamp(cx, 24, FW - 24), Math.max(10, cy - 6), '+' + pts, chain > 1 ? C.orange : C.yellow);
    if (chain > 1) {
      R.fx.text(FW / 2, 26, 'CHAIN x' + chain, C.pink);
      R.achieve('chain'); R.fx.shake(2 + Math.min(chain, 4), 0.25);
    }
    if (g) { R.achieve('first-germ'); R.sfx.play('coin'); }
    R.sfx.tone(440 * Math.pow(1.122, Math.min(chain, 7) * 2), 0.09, { vol: 0.13, type: 'square' });
    R.sfx.tone(660 * Math.pow(1.122, Math.min(chain, 7) * 2), 0.14, { vol: 0.12, type: 'triangle', delay: 0.07 });
    R.vibrate(20 + 10 * Math.min(chain, 4));
    phase = 'clear'; phaseT = CLEAR_TIME;
  }

  function finishClear() {
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      var c = grid[y][x];
      if (c && c.clr) {
        R.fx.burst(x * CELL + CELL / 2, y * CELL + CELL / 2, { n: c.k === 0 ? 9 : 5, color: [COL[c.c], '#ffffff'], speed: 70, life: 0.55, gravity: 160, size: 2 });
        grid[y][x] = null;
      }
    }
    fixLinks();
    phase = 'fall'; fallT = FALL_STEP;
  }

  function afterFall() {
    var list = findMatches();
    if (list.length) { startClear(list); return; }
    chain = 0;
    if (germs <= 0) startWin(); else spawn();
  }

  function startWin() {
    phase = 'win'; phaseT = 2.6; cap = null;
    var bonus = 500 * level;
    R.addScore(bonus);
    R.achieve('squeaky-clean');
    R.sfx.play('win'); R.fx.flash(C.white, 0.25); R.vibrate(80);
    for (var i = 0; i < 6; i++) R.fx.burst(U.clamp(16 + i * 19, 16, FW - 16), FH * 0.4 + (i % 2) * 30, { n: 14, color: [C.yellow, C.pink, C.cyan, C.lime, C.white], speed: 90, life: 0.9, gravity: 90, size: 2 });
    banner = { t: 2.5, a: 'BOTTLE CLEAN', b: '+' + bonus, win: true };
  }

  function nextLevel() {
    if (level + 1 >= 5) R.achieve('level5');
    R.sfx.play('powerup');
    startLevel(level + 1);
  }

  /* ------------------------------------------------------------------------------------------- drawing */
  function rrect(ctx, x0, y0, x1, y1, a, b, c, d) {          // radii: TL TR BR BL
    ctx.beginPath();
    ctx.moveTo(x0 + a, y0);
    ctx.lineTo(x1 - b, y0); ctx.arcTo(x1, y0, x1, y0 + b, b);
    ctx.lineTo(x1, y1 - c); ctx.arcTo(x1, y1, x1 - c, y1, c);
    ctx.lineTo(x0 + d, y1); ctx.arcTo(x0, y1, x0, y1 - d, d);
    ctx.lineTo(x0, y0 + a); ctx.arcTo(x0, y0, x0 + a, y0, a);
    ctx.closePath();
  }

  function drawHalf(ctx, px, py, s, c, link, alpha) {
    var base = COL[c], light = U.shade(base, 0.6), dark = U.shade(base, -0.38), edge = U.shade(base, -0.7);
    var m = Math.max(1, Math.round(s / 16)), r = s * 0.38;
    var x0 = px + m, y0 = py + m, x1 = px + s - m, y1 = py + s - m;
    if (link === 0) x1 = px + s; else if (link === 2) x0 = px; else if (link === 1) y0 = py; else if (link === 3) y1 = py + s;
    var a = (link === 1 || link === 2) ? 0 : r, b = (link === 1 || link === 0) ? 0 : r;
    var cc = (link === 3 || link === 0) ? 0 : r, d = (link === 3 || link === 2) ? 0 : r;
    var band = Math.max(2, Math.round(s / 6));
    if (alpha != null) ctx.globalAlpha = alpha;
    rrect(ctx, x0, y0, x1, y1, a, b, cc, d);
    ctx.fillStyle = base; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = light;
    if (link !== 1) ctx.fillRect(x0, y0, x1 - x0, band);
    if (link !== 2) ctx.fillRect(x0, y0, band, y1 - y0);
    ctx.fillStyle = dark;
    if (link !== 3) ctx.fillRect(x0, y1 - band, x1 - x0, band);
    if (link !== 0) ctx.fillRect(x1 - band, y0, band, y1 - y0);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    var sx = link === 2 ? px + s * 0.55 : px + s * 0.26, sy = link === 1 ? py + s * 0.55 : py + s * 0.26;
    ctx.fillRect(Math.round(sx), Math.round(sy), Math.max(2, Math.round(s / 8)), Math.max(2, Math.round(s / 8)));
    rrect(ctx, x0 + 0.5, y0 + 0.5, x1 - 0.5, y1 - 0.5, a, b, cc, d);
    ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke();
    if (alpha != null) ctx.globalAlpha = 1;
  }

  function drawBottle(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, '#0f1d3d'); g.addColorStop(1, '#091226');
    ctx.fillStyle = g; ctx.fillRect(0, 0, FW, FH);
    ctx.fillStyle = 'rgba(80,130,200,.10)';
    for (var x = 1; x < COLS; x++) ctx.fillRect(x * CELL, 0, 1, FH);
    for (var y = 1; y < ROWS; y++) ctx.fillRect(0, y * CELL, FW, 1);
    ctx.fillStyle = 'rgba(190,230,255,.07)'; ctx.fillRect(3, 0, 5, FH); ctx.fillRect(FW - 7, 0, 2, FH);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, 0, FW, CELL);
    ctx.fillStyle = 'rgba(190,230,255,.22)'; ctx.fillRect(0, CELL * 2 - 1, FW, 1);
    // danger glow when the pile climbs near the neck
    var topRow = ROWS;
    for (var yy = 0; yy < ROWS && topRow === ROWS; yy++) for (var xx = 0; xx < COLS; xx++) if (grid[yy][xx] && !grid[yy][xx].mv) { topRow = yy; break; }
    if (topRow <= 4) {
      ctx.fillStyle = 'rgba(255,40,80,' + (0.10 + 0.08 * Math.sin(t * 8)) + ')'; ctx.fillRect(0, 0, FW, (5 - topRow) * CELL * 0.6 + CELL);
    }
  }

  function drawGerm(ctx, cell, x, y, t, py) {
    var mood = lost ? 'laugh' : cell.clr ? 'hurt' : 'happy';
    var fr = lost ? Math.floor(t * 9 + x) & 1 : Math.floor(t * 2.4 + x * 0.7 + y * 0.45) & 1;
    var spr = germSprites[cell.c][mood][fr];
    var by = lost ? Math.round(Math.sin(t * 16 + x * 1.7 + y) * 1) : 0;
    R.draw.sprite(ctx, spr, x * CELL + 1, py + 1 + by);
  }

  function drawBanner(ctx) {
    if (!banner || R.mode === 'ready' || R.mode === 'over') return;
    var a = U.clamp(banner.t / 0.4, 0, 1);
    ctx.globalAlpha = a;
    var y = banner.win ? FH * 0.34 : FH * 0.3;
    ctx.fillStyle = 'rgba(5,10,24,.78)'; ctx.fillRect(4, y - 6, FW - 8, banner.win ? 52 : 34);
    R.draw.frame(ctx, 4, y - 6, FW - 8, banner.win ? 52 : 34, banner.win ? C.lime : C.cyan, 1);
    R.draw.text(ctx, banner.a, FW / 2, y, { size: banner.win ? 8 : 8, color: banner.win ? C.lime : C.white, align: 'center', shadow: '#000' });
    R.draw.text(ctx, banner.b, FW / 2, y + 14, { size: 8, color: C.yellow, align: 'center', shadow: '#000' });
    if (banner.win) R.draw.text(ctx, 'NEXT BOTTLE...', FW / 2, y + 32, { size: 6, color: '#b9c6de', align: 'center' });
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------------------------------------- game */
  function updateDrop(dt) {
    if (!cap) return;
    if (R.input.rep('left', 150, 55)) tryMove(-1);
    if (R.input.rep('right', 150, 55)) tryMove(1);
    if (R.input.pressed('a') || R.input.pressed('up')) rotate(1);
    if (R.input.pressed('b')) rotate(-1);
    if (!R.input.held.down) needRelease = false;
    var soft = R.input.held.down && !needRelease;
    var interval = soft ? 0.035 : gravityInterval();
    fallAcc += dt;
    while (fallAcc >= interval) {
      fallAcc -= interval;
      if (grounded()) { fallAcc = 0; break; }
      cap.y++;
      if (soft) R.addScore(1);
    }
    if (grounded()) {
      lockT += dt;
      if (lockT >= (soft ? 0.05 : 0.38)) lockCapsule();
    } else lockT = 0;
  }

  R.game({
    layout: 'classic', size: [FW, FH], bg: '#091226', music: 'chill',

    init: function () { buildSprites(); },

    reset: function () {
      R.hud.extraLabel = 'GERMS'; R.hud.extra = 0;
      needRelease = false; banner = null; lost = false; phaseT = 0; fallT = 0; fallAcc = 0;
      startLevel(1);
    },

    update: function (dt) {
      popT += dt;
      if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
      if (phase === 'drop') updateDrop(dt);
      else if (phase === 'clear') { phaseT -= dt; if (phaseT <= 0) finishClear(); }
      else if (phase === 'fall') {
        fallT += dt;
        if (fallT >= FALL_STEP) { fallT = 0; if (!fallStep()) afterFall(); }
      } else if (phase === 'win') { phaseT -= dt; if (phaseT <= 0) nextLevel(); }
    },

    render: function (ctx, W, H) {
      var t = animT(), x, y;
      drawBottle(ctx, t);
      var off = phase === 'fall' ? -(1 - U.clamp(fallT / FALL_STEP, 0, 1)) * CELL : 0;
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
        var cell = grid[y][x];
        if (!cell) continue;
        var py = y * CELL + (cell.mv ? off : 0);
        if (cell.k === 0) drawGerm(ctx, cell, x, y, t, py);
        else drawHalf(ctx, x * CELL, py, CELL, cell.c, cell.l);
        if (cell.clr && Math.floor(phaseT * 26) % 2) {
          ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x * CELL + 2, py + 2, CELL - 4, CELL - 4);
        }
        if (phase === 'win' && cell.k === 1) { ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.25 * Math.sin(t * 12 + x)) + ')'; ctx.fillRect(x * CELL + 2, py + 2, CELL - 4, CELL - 4); }
      }
      if (cap) {
        var gy = cap.y;
        while (capFits(cap.x, gy + 1, cap.o)) gy++;
        if (gy > cap.y) {
          for (var i = 0; i < 2; i++) {
            var gx = cap.x + (i ? DX[cap.o] : 0), gyy = gy + (i ? DY[cap.o] : 0);
            drawHalf(ctx, gx * CELL, gyy * CELL, CELL, cap.c[i], i === 0 ? cap.o : (cap.o + 2) % 4, 0.2);
          }
        }
        for (var j = 0; j < 2; j++) {
          var cx = cap.x + (j ? DX[cap.o] : 0), cy = cap.y + (j ? DY[cap.o] : 0);
          drawHalf(ctx, cx * CELL, cy * CELL, CELL, cap.c[j], j === 0 ? cap.o : (cap.o + 2) % 4);
        }
      }
      if (lost) { ctx.fillStyle = 'rgba(140,0,50,.28)'; ctx.fillRect(0, 0, FW, FH); }
      drawBanner(ctx);
    },

    renderNext: function (ctx, w, h) {
      if (!nextCap) return;
      var s = 20, ox = (w - 2 * s) / 2, oy = (h - s) / 2 + Math.round(Math.sin(popT * 3) * 1);
      drawHalf(ctx, ox, oy, s, nextCap[0], 0);
      drawHalf(ctx, ox + s, oy, s, nextCap[1], 2);
    },

    serialize: function () {
      return {
        g: grid.map(function (row) { return row.map(function (c) { return c ? [c.k, c.c, c.l] : 0; }); }),
        cap: phase === 'drop' && cap ? { x: cap.x, y: cap.y, o: cap.o, c: cap.c } : null,
        next: nextCap, level: level, caps: capCount
      };
    },

    restore: function (s) {
      grid = s.g.map(function (row) { return row.map(function (c) { return c ? { k: c[0], c: c[1], l: c[2] } : null; }); });
      fixLinks();
      level = s.level; R.level = Math.min(99, level);
      nextCap = s.next; capCount = s.caps || 0;
      germs = 0; grid.forEach(function (row) { row.forEach(function (c) { if (c && c.k === 0) germs++; }); });
      R.hud.extraLabel = 'GERMS'; R.hud.extra = germs;
      lost = false; banner = null; chain = 0; needRelease = true; lockT = 0; lockMoves = 0; fallAcc = 0;
      if (s.cap) { cap = s.cap; phase = 'drop'; } else { cap = null; phase = 'fall'; fallT = FALL_STEP; }
    },

    onGameOver: function () { lost = true; }
  });
})();
