/* Gem Stack — vertical triples of shaped gems fall into a 6x13 well; match 3+ in any direction.
   Original game for the Retro SDK. */
(function () {
  'use strict';
  var R = Retro, C = R.colors, U = R.util;

  var COLS = 6, ROWS = 13, CELL = 24, FW = COLS * CELL, FH = ROWS * CELL;
  var SPAWN_X = 2, MAGIC = 6;
  var FALL_STEP = 0.05, CLEAR_TIME = 0.42, LEVEL_GEMS = 24;
  var GEM_COL = ['#ff3b5c', '#ffd23f', '#2fe06b', '#3d9bff', '#b066ff', '#e3f1ff'];

  /* ---------------------------------------------------------------- seeded RNG (no Math.random in logic) */
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

  /* ---------------------------------------------------------------------------------------------- state */
  var grid, piece, nextPiece, phase, phaseT, fallT, fallAcc, lockT, lockMoves, level, cleared, chain, pieces, sinceMagic;
  var needRelease, banner, visT = 0, popT = 0, lost;

  function emptyGrid() { var g = []; for (var y = 0; y < ROWS; y++) { g.push([]); for (var x = 0; x < COLS; x++) g[y].push(null); } return g; }
  function inB(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }
  function free(x, y) { return inB(x, y) && !grid[y][x]; }
  function animT() { if (R.mode === 'over' || R.mode === 'ready') { visT += 1 / 60; return visT; } return R.time; }
  function interval() { return Math.max(0.06, 0.55 * Math.pow(0.87, level - 1)); }

  function makePiece() {
    sinceMagic++;
    if (sinceMagic > 8 && rnd() < 0.06) { sinceMagic = 0; return { g: [MAGIC, MAGIC, MAGIC], magic: true }; }
    return { g: [rndInt(6), rndInt(6), rndInt(6)], magic: false };
  }

  function spawn() {
    piece = { x: SPAWN_X, y: 0, g: nextPiece.g.slice(), magic: nextPiece.magic };
    nextPiece = makePiece();
    pieces++; lockT = 0; lockMoves = 0; fallAcc = 0; phase = 'drop';
    if (!free(SPAWN_X, 0) || !free(SPAWN_X, 1) || !free(SPAWN_X, 2)) { lose(); return false; }
    return true;
  }

  function lose() {
    lost = true; phase = 'over';
    R.fx.shake(4, 0.5); R.vibrate(160);
    R.gameOver();
  }

  /* ------------------------------------------------------------------------------------------- piece */
  function fits(x, y) { return free(x, y) && free(x, y + 1) && free(x, y + 2); }
  function grounded() { return !fits(piece.x, piece.y + 1); }
  function bumpLock() { if (lockT > 0 && lockMoves < 15) { lockT = 0; lockMoves++; } }

  function tryMove(dx) {
    if (!fits(piece.x + dx, piece.y)) return;
    piece.x += dx; bumpLock(); R.sfx.play('move');
  }
  function cycle(dir) {                                 // dir +1: bottom gem jumps to the top (A); -1: top gem to the bottom (B)
    var g = piece.g;
    if (piece.magic) return;
    piece.g = dir > 0 ? [g[2], g[0], g[1]] : [g[1], g[2], g[0]];
    bumpLock(); R.sfx.play('rotate');
  }

  function lockPiece() {
    for (var i = 0; i < 3; i++) grid[piece.y + i][piece.x] = { g: piece.g[i] };
    var wasMagic = piece.magic, px = piece.x, py = piece.y;
    piece = null; needRelease = R.input.held.down;
    R.sfx.play('land'); R.vibrate(10);
    R.fx.burst(px * CELL + CELL / 2, (py + 3) * CELL, { n: 5, color: ['#ffffff', '#c9b3ff'], speed: 40, life: 0.3, gravity: 60, size: 2 });
    chain = 0;
    if (wasMagic) magicResolve(px, py);
    else afterFall();
  }

  /* --------------------------------------------------------------------------------- matching & gravity */
  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  function findMatches() {
    var mark = {}, list = [], diag = false, x, y, d;
    function add(px, py) { var k = py * COLS + px; if (!mark[k]) { mark[k] = 1; list.push([px, py]); } }
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
      var c = grid[y][x];
      if (!c || c.g === MAGIC) continue;
      for (d = 0; d < 4; d++) {
        var dx = DIRS[d][0], dy = DIRS[d][1], bx = x - dx, by = y - dy;
        if (inB(bx, by) && grid[by][bx] && grid[by][bx].g === c.g) continue;       // not the start of the run
        var n = 1;
        while (inB(x + dx * n, y + dy * n) && grid[y + dy * n][x + dx * n] && grid[y + dy * n][x + dx * n].g === c.g) n++;
        if (n >= 3) {
          for (var k = 0; k < n; k++) add(x + dx * k, y + dy * k);
          if (dx && dy) diag = true;
        }
      }
    }
    return { list: list, diag: diag };
  }

  function fallStep() {
    var moved = false, x, y;
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (grid[y][x]) grid[y][x].mv = false;
    for (y = ROWS - 2; y >= 0; y--) for (x = 0; x < COLS; x++) {
      var c = grid[y][x];
      if (c && !grid[y + 1][x]) { grid[y + 1][x] = c; grid[y][x] = null; c.mv = true; moved = true; }
    }
    return moved;
  }

  function startClear(list, opts) {
    opts = opts || {};
    chain++;
    var n = list.length, sx = 0, sy = 0;
    list.forEach(function (p) { grid[p[1]][p[0]].clr = true; sx += p[0]; sy += p[1]; });
    var mult = Math.min(chain, 10);
    var pts = (n * 10 + (n > 3 ? (n - 3) * 15 : 0)) * mult * level * (opts.magic ? 2 : 1);
    R.addScore(pts);
    var cx = U.clamp(sx / n * CELL + CELL / 2, 28, FW - 28), cy = Math.max(12, sy / n * CELL - 4);
    R.fx.text(cx, cy, '+' + pts, chain > 1 ? C.orange : C.yellow);
    if (chain > 1) { R.fx.text(FW / 2, 22, 'COMBO x' + chain, C.pink); R.fx.shake(1.5 + Math.min(chain, 4), 0.25); }
    if (chain >= 3) R.achieve('combo3');
    if (opts.diag) { R.achieve('diagonal'); R.fx.text(FW / 2, 38, 'DIAGONAL!', C.cyan); }
    R.sfx.play('line');
    R.sfx.tone(520 * Math.pow(1.122, Math.min(chain, 7) * 2), 0.12, { vol: 0.12, type: 'triangle', delay: 0.05 });
    R.vibrate(18 + 8 * Math.min(chain, 5));
    phase = 'clear'; phaseT = CLEAR_TIME;
  }

  function finishClear() {
    var n = 0;
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      var c = grid[y][x];
      if (c && c.clr) {
        var col = c.g === MAGIC ? ['#ff3b5c', '#ffd23f', '#2fe06b', '#3d9bff', '#b066ff'] : [GEM_COL[c.g], '#ffffff'];
        R.fx.burst(x * CELL + CELL / 2, y * CELL + CELL / 2, { n: 7, color: col, speed: 85, life: 0.6, gravity: 150, size: 2 });
        grid[y][x] = null; n++;
      }
    }
    cleared += n; R.hud.extra = cleared;
    var lvl = Math.min(99, 1 + Math.floor(cleared / LEVEL_GEMS));
    if (lvl > level) {
      level = lvl; R.level = level;
      R.sfx.play('powerup'); R.fx.flash(C.white, 0.2); R.vibrate(40);
      banner = { t: 1.4, a: 'LEVEL ' + level, b: 'FASTER!' };
      if (level >= 5) R.achieve('level5');
    }
    phase = 'fall'; fallT = FALL_STEP;
  }

  function afterFall() {
    var m = findMatches();
    if (m.list.length) { startClear(m.list, { diag: m.diag }); return; }
    chain = 0;
    spawn();
  }

  function magicResolve(px, py) {
    var below = py + 3, target = -1, x, y;
    if (below < ROWS && grid[below][px]) target = grid[below][px].g;
    else {                                              // landed on the floor: wipe out the most common colour
      var cnt = [0, 0, 0, 0, 0, 0];
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (grid[y][x] && grid[y][x].g < 6) cnt[grid[y][x].g]++;
      var best = 0; for (var i = 1; i < 6; i++) if (cnt[i] > cnt[best]) best = i;
      if (cnt[best] > 0) target = best;
    }
    var list = [];
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (grid[y][x] && (grid[y][x].g === MAGIC || (target >= 0 && grid[y][x].g === target))) list.push([x, y]);
    R.achieve('magic');
    R.fx.flash(target >= 0 ? GEM_COL[target] : C.white, 0.3);
    R.fx.text(FW / 2, 54, 'MAGIC!', C.yellow);
    R.sfx.play('powerup');
    startClear(list, { magic: true });
  }

  /* ---------------------------------------------------------------------------------------------- gems */
  function poly(ctx, pts, fill) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function outline(ctx, col) { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke(); }
  function glint(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(x - r * 0.15, y - r * 0.5, r * 0.3, r);
    ctx.fillRect(x - r * 0.5, y - r * 0.15, r, r * 0.3);
  }

  var DRAW = [
    function diamond(ctx, cx, cy, r, col) {
      var t = [cx, cy - r * 1.08], rt = [cx + r * 0.92, cy], b = [cx, cy + r * 1.08], l = [cx - r * 0.92, cy], m = [cx, cy];
      poly(ctx, [t, rt, b, l], col);
      poly(ctx, [t, l, m], U.shade(col, 0.5));
      poly(ctx, [t, rt, m], U.shade(col, 0.2));
      poly(ctx, [rt, b, m], U.shade(col, -0.32));
      poly(ctx, [l, b, m], U.shade(col, -0.1));
      poly(ctx, [t, rt, b, l]); outline(ctx, U.shade(col, -0.62));
      glint(ctx, cx - r * 0.38, cy - r * 0.38, r * 0.4);
    },
    function orb(ctx, cx, cy, r, col) {
      ctx.fillStyle = U.shade(col, -0.45); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx - r * 0.1, cy - r * 0.1, r * 0.86, 0, 6.2832); ctx.fill();
      ctx.fillStyle = U.shade(col, 0.45); ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.28, r * 0.5, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); outline(ctx, U.shade(col, -0.62));
      glint(ctx, cx - r * 0.42, cy - r * 0.42, r * 0.38);
    },
    function emerald(ctx, cx, cy, r, col) {
      var a = r * 0.98, k = r * 0.38;
      var oct = [[cx - a + k, cy - a], [cx + a - k, cy - a], [cx + a, cy - a + k], [cx + a, cy + a - k], [cx + a - k, cy + a], [cx - a + k, cy + a], [cx - a, cy + a - k], [cx - a, cy - a + k]];
      poly(ctx, oct, U.shade(col, -0.25));
      var i2 = r * 0.58;
      poly(ctx, [[cx - i2, cy - i2], [cx + i2, cy - i2], [cx + i2, cy + i2], [cx - i2, cy + i2]], col);
      poly(ctx, [oct[0], oct[1], [cx + i2, cy - i2], [cx - i2, cy - i2]], U.shade(col, 0.5));
      poly(ctx, [oct[6], oct[0], [cx - i2, cy - i2], [cx - i2, cy + i2]], U.shade(col, 0.25));
      poly(ctx, [oct[4], oct[5], [cx - i2, cy + i2], [cx + i2, cy + i2]], U.shade(col, -0.5));
      poly(ctx, oct); outline(ctx, U.shade(col, -0.68));
      glint(ctx, cx - r * 0.3, cy - r * 0.3, r * 0.34);
    },
    function triangle(ctx, cx, cy, r, col) {
      var t = [cx, cy - r * 1.05], rt = [cx + r * 1.08, cy + r * 0.86], lt = [cx - r * 1.08, cy + r * 0.86], bm = [cx, cy + r * 0.86], m = [cx, cy + r * 0.2];
      poly(ctx, [t, rt, lt], col);
      poly(ctx, [t, lt, m], U.shade(col, 0.45));
      poly(ctx, [t, rt, m], U.shade(col, 0.1));
      poly(ctx, [lt, rt, m], U.shade(col, -0.4));
      poly(ctx, [t, rt, lt]); outline(ctx, U.shade(col, -0.65));
      glint(ctx, cx - r * 0.3, cy - r * 0.1, r * 0.34);
    },
    function hexagon(ctx, cx, cy, r, col) {
      var pts = [], i, sh = [0.5, 0.25, -0.12, -0.42, -0.2, 0.1];
      for (i = 0; i < 6; i++) { var a = -Math.PI / 2 + i * Math.PI / 3; pts.push([cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 1.08]); }
      poly(ctx, pts, col);
      for (i = 0; i < 6; i++) poly(ctx, [pts[i], pts[(i + 1) % 6], [cx, cy]], U.shade(col, sh[i]));
      poly(ctx, pts, null); outline(ctx, U.shade(col, -0.65));
      poly(ctx, [[cx - r * 0.35, cy - r * 0.5], [cx + r * 0.35, cy - r * 0.5], [cx + r * 0.2, cy - r * 0.15], [cx - r * 0.5, cy - r * 0.15]], 'rgba(255,255,255,.28)');
      glint(ctx, cx - r * 0.4, cy - r * 0.45, r * 0.34);
    },
    function star(ctx, cx, cy, r, col) {
      var pts = [], i;
      for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 0.52 : 1.16) * r; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
      poly(ctx, pts, col);
      ctx.save(); poly(ctx, pts); ctx.clip();
      ctx.fillStyle = 'rgba(80,120,200,.38)'; ctx.fillRect(cx, cy - r * 1.3, r * 1.4, r * 2.8);
      ctx.fillStyle = 'rgba(80,120,200,.25)'; ctx.fillRect(cx - r * 1.4, cy + r * 0.25, r * 2.8, r * 1.2);
      ctx.restore();
      poly(ctx, pts); outline(ctx, '#5a74b8');
      glint(ctx, cx - r * 0.28, cy - r * 0.3, r * 0.34);
    }
  ];

  function drawMagic(ctx, cx, cy, r, t, seedY) {
    var hue = (t * 260 + seedY * 7) % 360;
    ctx.fillStyle = 'hsl(' + hue + ',90%,38%)'; ctx.beginPath(); ctx.arc(cx, cy, r * 1.02, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'hsl(' + ((hue + 70) % 360) + ',95%,58%)'; ctx.beginPath(); ctx.arc(cx - r * 0.1, cy - r * 0.1, r * 0.8, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'hsl(' + ((hue + 150) % 360) + ',100%,76%)'; ctx.beginPath(); ctx.arc(cx - r * 0.2, cy - r * 0.22, r * 0.42, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.02, 0, 6.2832); outline(ctx, '#ffffff');
    var sp = 0.5 + 0.5 * Math.sin(t * 9 + seedY);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * sp) + ')';
    var s = r * (0.5 + 0.5 * sp);
    ctx.fillRect(cx - s * 0.12, cy - s, s * 0.24, s * 2); ctx.fillRect(cx - s, cy - s * 0.12, s * 2, s * 0.24);
  }

  function drawGem(ctx, k, px, py, s, o) {
    o = o || {};
    var cx = px + s / 2, cy = py + s / 2, r = s * 0.4 * (o.scale || 1);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (k === MAGIC) drawMagic(ctx, cx, cy, r, o.t || 0, o.sy || 0);
    else DRAW[k](ctx, cx, cy, r, GEM_COL[k]);
    if (o.flash) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.95, 0, 6.2832); ctx.fill(); }
    if (o.alpha != null || o.flash) ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------------------------------ drawing */
  function drawWell(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, '#1a1236'); g.addColorStop(1, '#0c0820');
    ctx.fillStyle = g; ctx.fillRect(0, 0, FW, FH);
    for (var x = 0; x < COLS; x++) {
      ctx.fillStyle = x % 2 ? 'rgba(160,120,255,.045)' : 'rgba(160,120,255,.015)';
      ctx.fillRect(x * CELL, 0, CELL, FH);
    }
    ctx.fillStyle = 'rgba(160,130,255,.12)';
    for (var xx = 1; xx < COLS; xx++) ctx.fillRect(xx * CELL, 0, 1, FH);
    for (var y = 1; y < ROWS; y++) ctx.fillRect(0, y * CELL, FW, 1);
    // spawn marker
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(SPAWN_X * CELL, 0, CELL, CELL * 3);
    // danger glow when the stack nears the spawn column
    var top = ROWS;
    for (var yy = 0; yy < ROWS; yy++) if (grid[yy][SPAWN_X] && !grid[yy][SPAWN_X].mv) { top = yy; break; }
    if (top <= 6) { ctx.fillStyle = 'rgba(255,50,100,' + (0.07 + 0.06 * Math.sin(t * 8)) + ')'; ctx.fillRect(0, 0, FW, CELL * 3); }
  }

  function drawBanner(ctx) {
    if (!banner || R.mode === 'ready' || R.mode === 'over') return;
    ctx.globalAlpha = U.clamp(banner.t / 0.4, 0, 1);
    var y = FH * 0.3;
    ctx.fillStyle = 'rgba(8,4,24,.82)'; ctx.fillRect(10, y - 6, FW - 20, 34);
    R.draw.frame(ctx, 10, y - 6, FW - 20, 34, '#c46bff', 1);
    R.draw.text(ctx, banner.a, FW / 2, y, { size: 8, color: C.white, align: 'center', shadow: '#000' });
    R.draw.text(ctx, banner.b, FW / 2, y + 14, { size: 8, color: C.yellow, align: 'center', shadow: '#000' });
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------------------------------- update */
  function updateDrop(dt) {
    if (!piece) return;
    if (R.input.rep('left', 150, 55)) tryMove(-1);
    if (R.input.rep('right', 150, 55)) tryMove(1);
    if (R.input.pressed('a') || R.input.pressed('up')) cycle(1);
    if (R.input.pressed('b')) cycle(-1);
    if (!R.input.held.down) needRelease = false;
    var soft = R.input.held.down && !needRelease;
    var iv = soft ? 0.035 : interval();
    fallAcc += dt;
    while (fallAcc >= iv) {
      fallAcc -= iv;
      if (grounded()) { fallAcc = 0; break; }
      piece.y++;
      if (soft) R.addScore(1);
    }
    if (grounded()) {
      lockT += dt;
      if (lockT >= (soft ? 0.06 : 0.4)) lockPiece();
    } else lockT = 0;
  }

  R.game({
    layout: 'classic', size: [FW, FH], bg: '#0c0820', music: 'retro',

    reset: function () {
      grid = emptyGrid(); level = 1; cleared = 0; chain = 0; pieces = 0; sinceMagic = 0;
      R.level = 1; R.hud.extraLabel = 'GEMS'; R.hud.extra = 0;
      needRelease = false; banner = null; lost = false; phaseT = 0; fallT = 0; piece = null;
      nextPiece = makePiece(); sinceMagic = 0;
      spawn();
    },

    update: function (dt) {
      popT += dt;
      if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
      if (phase === 'drop') updateDrop(dt);
      else if (phase === 'clear') { phaseT -= dt; if (phaseT <= 0) finishClear(); }
      else if (phase === 'fall') {
        fallT += dt;
        if (fallT >= FALL_STEP) { fallT = 0; if (!fallStep()) afterFall(); }
      }
    },

    render: function (ctx, W, H) {
      var t = animT(), x, y;
      drawWell(ctx, t);
      var off = phase === 'fall' ? -(1 - U.clamp(fallT / FALL_STEP, 0, 1)) * CELL : 0;
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
        var c = grid[y][x];
        if (!c) continue;
        var o = { t: t, sy: y };
        if (c.clr) {
          var on = Math.floor(phaseT * 22) % 2;
          o.flash = on; o.scale = 1 + 0.18 * Math.sin((1 - phaseT / CLEAR_TIME) * Math.PI);
        }
        drawGem(ctx, c.g, x * CELL, y * CELL + (c.mv ? off : 0), CELL, o);
      }
      if (piece) {
        var gy = piece.y;
        while (fits(piece.x, gy + 1)) gy++;
        if (gy > piece.y) {
          ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(piece.x * CELL, (piece.y + 3) * CELL, CELL, (gy - piece.y) * CELL);
          R.draw.frame(ctx, piece.x * CELL + 1, gy * CELL + 1, CELL - 2, CELL * 3 - 2, 'rgba(255,255,255,.35)', 1);
        }
        for (var i = 0; i < 3; i++) drawGem(ctx, piece.g[i], piece.x * CELL, (piece.y + i) * CELL, CELL, { t: t, sy: i });
      }
      if (lost) { ctx.fillStyle = 'rgba(120,0,60,.3)'; ctx.fillRect(0, 0, FW, FH); }
      drawBanner(ctx);
    },

    renderNext: function (ctx, w, h) {
      if (!nextPiece) return;
      var s = 16, ox = (w - s) / 2, oy = (h - 3 * s) / 2, t = popT;
      for (var i = 0; i < 3; i++) drawGem(ctx, nextPiece.g[i], ox, oy + i * s, s, { t: t, sy: i });
    },

    serialize: function () {
      return {
        g: grid.map(function (row) { return row.map(function (c) { return c ? c.g : -1; }); }),
        piece: phase === 'drop' && piece ? { x: piece.x, y: piece.y, g: piece.g, magic: piece.magic } : null,
        next: nextPiece, level: level, cleared: cleared, pieces: pieces, sm: sinceMagic
      };
    },

    restore: function (s) {
      grid = s.g.map(function (row) { return row.map(function (v) { return v >= 0 ? { g: v } : null; }); });
      level = s.level; cleared = s.cleared || 0; pieces = s.pieces || 0; sinceMagic = s.sm || 0; chain = 0;
      R.level = level; R.hud.extraLabel = 'GEMS'; R.hud.extra = cleared;
      nextPiece = s.next; banner = null; lost = false; needRelease = true; lockT = 0; lockMoves = 0; fallAcc = 0;
      if (s.piece) { piece = s.piece; phase = 'drop'; } else { piece = null; phase = 'fall'; fallT = FALL_STEP; }
    },

    onGameOver: function () { lost = true; }
  });
})();
