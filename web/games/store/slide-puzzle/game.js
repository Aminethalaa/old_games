/* Slide Puzzle — rainbow number tiles, 3x3 → 4x4 → 5x5. Built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util, D = R.draw;

  var BX = 12, BY = 52, BOARD = 248, GAP = 4;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];                  // 0 up · 1 right · 2 down · 3 left (direction the TILE moves)
  var BASE = { 3: 150, 4: 400, 5: 800 }, PAR = { 3: 30, 4: 80, 5: 150 }, SHUFFLE = { 3: 40, 4: 90, 5: 150 };
  // rainbow themes: hue at the top-left tile, hue travelled to the bottom-right tile (one theme per level)
  var THEMES = [
    { h: 345, span: 290 }, { h: 190, span: 250 }, { h: 100, span: 270 }, { h: 265, span: 300 }
  ];

  var n, board, tiles, gap, moves, hist, phase, phaseT, lvl, timer, timerOn, shufLeft, shufPrev, tileSz, clock, bestNow, solveInfo;

  /* ------------------------------------------------------------ helpers */
  function sizeFor(l) { return 3 + ((l - 1) % 3); }
  function hsl(h, sat, l) {
    h = ((h % 360) + 360) % 360 / 360;
    function f(p, q, t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    var q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
  }
  function rgb(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
  function shadeRGB(c, amt) { return amt < 0 ? c.map(function (v) { return v * (1 + amt); }) : c.map(function (v) { return v + (255 - v) * amt; }); }
  function tileColor(val) {
    var th = THEMES[(lvl - 1) % THEMES.length], hr = Math.floor((val - 1) / n), hc = (val - 1) % n;
    var u = n > 1 ? hc / (n - 1) : 0, v = n > 1 ? hr / (n - 1) : 0;
    return hsl(th.h + th.span * (0.7 * u + 0.3 * v), 0.85, 0.62 - 0.1 * v);
  }
  function cellPos(i) { return { x: BX + GAP + (i % n) * (tileSz + GAP), y: BY + GAP + Math.floor(i / n) * (tileSz + GAP) }; }
  function isSolved() {
    for (var i = 0; i < n * n - 1; i++) if (board[i] !== i + 1) return false;
    return true;
  }
  function correctCount() { var k = 0; for (var i = 0; i < n * n - 1; i++) if (board[i] === i + 1) k++; return k; }

  /* ------------------------------------------------------------ board */
  function buildTiles() {
    tiles = {};
    for (var i = 0; i < n * n; i++) {
      var v = board[i]; if (!v) continue;
      var p = cellPos(i);
      tiles[v] = { v: v, x: p.x, y: p.y, pop: 9 };
    }
  }

  function startLevel(l) {
    lvl = l; R.level = l; n = sizeFor(l);
    tileSz = Math.floor((BOARD - (n + 1) * GAP) / n);
    board = []; for (var i = 0; i < n * n - 1; i++) board.push(i + 1); board.push(0);
    gap = n * n - 1; moves = 0; hist = []; timer = 0; timerOn = false; solveInfo = null;
    bestNow = R.store.get('best' + n, 0);
    buildTiles();
    phaseT = 0;
  }

  function legalGapMoves() {
    var r = Math.floor(gap / n), c = gap % n, out = [];
    for (var d = 0; d < 4; d++) {                     // d = direction the neighbour tile slides into the gap
      var sr = r - DY[d], sc = c - DX[d];
      if (sr >= 0 && sc >= 0 && sr < n && sc < n) out.push({ d: d, src: sr * n + sc });
    }
    return out;
  }

  function applyMove(d) {                              // slide the tile opposite to d into the gap, moving in direction d
    var r = Math.floor(gap / n), c = gap % n, sr = r - DY[d], sc = c - DX[d];
    if (sr < 0 || sc < 0 || sr >= n || sc >= n) return -1;
    var src = sr * n + sc, v = board[src];
    board[gap] = v; board[src] = 0;
    var from = gap; gap = src;
    return { v: v, cell: from };
  }

  function scrambleOne() {
    var opts = legalGapMoves().filter(function (o) { return o.src !== shufPrev; });
    var o = U.pick(opts);
    shufPrev = gap;
    var m = applyMove(o.d);
    return m;
  }

  function beginShuffle() {
    var total = SHUFFLE[n] + 10 * Math.floor((lvl - 1) / 3);
    shufLeft = total; shufPrev = -1; phase = 'shuffle'; phaseT = 0;
    R.sfx.play('rotate');
  }

  function instantShuffle() {
    var total = SHUFFLE[n] + 10 * Math.floor((lvl - 1) / 3);
    shufPrev = -1;
    do { for (var i = 0; i < total; i++) scrambleOne(); } while (isSolved());
    buildTiles();
    phase = 'play';
  }

  function tryMove(d) {
    var m = applyMove(d);
    if (m === -1) { R.sfx.tone(120, 0.05, { vol: 0.07, type: 'triangle' }); return; }
    hist.push(d); moves++; timerOn = true;
    var t = tiles[m.v], p = cellPos(m.cell);
    R.sfx.play('move'); R.vibrate(5);
    // landed on its home cell?
    if (m.v === m.cell + 1) {
      R.sfx.tone(900, 0.07, { vol: 0.1, type: 'triangle' });
      R.fx.burst(p.x + tileSz / 2, p.y + tileSz / 2, { n: 6, color: [C.white, C.yellow], speed: 55, life: 0.35, size: 2 });
      t.pop = 0; R.vibrate(10);
    }
    if (isSolved()) onSolved();
  }

  function undo() {
    if (!hist.length) { R.sfx.tone(120, 0.05, { vol: 0.07, type: 'triangle' }); return; }
    var d = hist.pop();
    applyMove((d + 2) % 4);                            // the same tile slides back
    moves--;
    R.sfx.tone(320, 0.04, { vol: 0.07, slide: 200, type: 'triangle' });
  }

  function onSolved() {
    var par = PAR[n], bonus = Math.max(0, par - moves) * 10;
    var pts = BASE[n] + bonus;
    R.addScore(pts);
    var secs = Math.floor(timer);
    var isBest = !bestNow || moves < bestNow;
    if (isBest) { R.store.set('best' + n, moves); bestNow = moves; }
    solveInfo = { pts: pts, moves: moves, best: isBest, time: secs };
    phase = 'solved'; phaseT = 2.6; timerOn = false;
    R.sfx.play('win'); R.vibrate(70); R.fx.flash(C.white, 0.2); R.fx.shake(3, 0.3);
    for (var i = 0; i < 7; i++) R.fx.burst(U.rand(30, 240), U.rand(60, 290), { n: 12, color: [C.yellow, C.pink, C.cyan, C.lime, C.orange], speed: 110, life: 1, size: 3, gravity: 80 });
    R.achieve('solve-' + n);
    if (n === 3 && timer < 20) R.achieve('quick');
  }

  /* ------------------------------------------------------------ drawing */
  function drawTile(ctx, t, i) {
    var s = tileSz, col = tileColor(t.v), x = Math.round(t.x), y = Math.round(t.y);
    var sc = t.pop < 0.25 ? 1 + 0.1 * Math.sin(Math.PI * t.pop / 0.25) : 1;
    if (sc !== 1) { var ns = Math.round(s * sc); x -= Math.round((ns - s) / 2); y -= Math.round((ns - s) / 2); s = ns; }
    // pixel-banded vertical gradient
    var bands = 6, bh = s / bands;
    for (var b = 0; b < bands; b++) {
      var k = b / (bands - 1);
      ctx.fillStyle = rgb(shadeRGB(col, 0.28 - k * 0.5));
      ctx.fillRect(x, Math.round(y + b * bh), s, Math.ceil(bh) + 1);
    }
    var bv = Math.max(2, Math.round(s / 16));
    ctx.fillStyle = rgb(shadeRGB(col, 0.55)); ctx.fillRect(x, y, s, bv); ctx.fillRect(x, y, bv, s);
    ctx.fillStyle = rgb(shadeRGB(col, -0.5)); ctx.fillRect(x, y + s - bv, s, bv); ctx.fillRect(x + s - bv, y, bv, s);
    var str = String(t.v), size = n === 3 ? 32 : n === 4 ? 24 : 16;
    var tx = x + s / 2, ty = y + s / 2 - size / 2 + 1, ow = size >= 24 ? 3 : 2;
    for (var ox = -ow; ox <= ow; ox += ow) for (var oy = -ow; oy <= ow; oy += ow) if (ox || oy) D.text(ctx, str, tx + ox, ty + oy, { size: size, color: '#141838', align: 'center' });
    D.text(ctx, str, tx, ty, { size: size, color: '#ffffff', align: 'center' });
    // "home" marker
    if (phase !== 'shuffle' && t.v === i + 1) {
      ctx.fillStyle = '#fff'; ctx.fillRect(x + s - bv - 7, y + bv + 3, 4, 4);
      ctx.fillStyle = '#00e436'; ctx.fillRect(x + s - bv - 6, y + bv + 4, 2, 2);
    }
  }

  function drawArrow(ctx, cx, cy, dir, sz, col) {
    ctx.fillStyle = col; ctx.beginPath();
    if (dir === 0) { ctx.moveTo(cx, cy - sz); ctx.lineTo(cx + sz, cy + sz); ctx.lineTo(cx - sz, cy + sz); }
    else if (dir === 1) { ctx.moveTo(cx + sz, cy); ctx.lineTo(cx - sz, cy + sz); ctx.lineTo(cx - sz, cy - sz); }
    else if (dir === 2) { ctx.moveTo(cx, cy + sz); ctx.lineTo(cx + sz, cy - sz); ctx.lineTo(cx - sz, cy - sz); }
    else { ctx.moveTo(cx - sz, cy); ctx.lineTo(cx + sz, cy + sz); ctx.lineTo(cx + sz, cy - sz); }
    ctx.closePath(); ctx.fill();
  }

  function fmtTime(t) { t = Math.floor(t); return Math.floor(t / 60) + ':' + U.pad(t % 60, 2); }

  function renderHud(ctx) {
    D.rect(ctx, 0, 0, 272, 42, '#0c1030'); D.rect(ctx, 0, 41, 272, 1, '#2a3558');
    D.text(ctx, 'SC ' + U.pad(R.score, 5), 8, 5, { size: 8, color: C.yellow });
    D.text(ctx, n + 'x' + n + ' LV' + lvl, 136, 5, { size: 8, color: C.cyan, align: 'center' });
    D.text(ctx, 'HI ' + U.pad(Math.max(R.hud.hi, R.score), 5), 264, 5, { size: 8, color: '#8fa3c8', align: 'right' });
    D.text(ctx, 'MOVES ' + moves, 8, 19, { size: 8, color: C.white });
    D.text(ctx, bestNow ? 'BEST ' + bestNow : 'BEST --', 136, 19, { size: 8, color: C.lime, align: 'center' });
    D.text(ctx, fmtTime(timer), 264, 19, { size: 8, color: C.pink, align: 'right' });
    // progress bar: tiles in place
    var f = (n * n - 1) ? correctCount() / (n * n - 1) : 0;
    D.rect(ctx, 8, 32, 256, 5, '#1d2650'); D.rect(ctx, 8, 32, Math.round(256 * f), 5, C.cyan);
    D.rect(ctx, 8, 32, Math.round(256 * f), 2, 'rgba(255,255,255,.35)');
  }

  R.game({
    layout: 'full', size: [272, 328], bg: '#0b0e26', music: 'chill',

    reset: function () {
      clock = 0;
      startLevel(1);
      instantShuffle();
    },

    update: function (dt) {
      clock += dt;
      var inp = { d: -1 };
      if (R.input.rep('up', 170, 85)) inp.d = 0;          // press UP: the tile below the gap slides up
      if (R.input.rep('right', 170, 85)) inp.d = 1;
      if (R.input.rep('down', 170, 85)) inp.d = 2;
      if (R.input.rep('left', 170, 85)) inp.d = 3;
      var undoP = R.input.rep('b', 260, 80);

      // tiles chase their cells
      var k = 1 - Math.exp(-dt * (phase === 'shuffle' ? 45 : 28)), i;
      for (i = 0; i < n * n; i++) {
        var v = board[i]; if (!v) continue;
        var t = tiles[v], p = cellPos(i);
        t.x += (p.x - t.x) * k; t.y += (p.y - t.y) * k;
        if (t.pop < 9) t.pop += dt;
      }
      if (timerOn && phase === 'play') timer += dt;

      if (phase === 'shuffle') {
        var per = Math.max(1, Math.ceil((SHUFFLE[n] + 10 * Math.floor((lvl - 1) / 3)) / 45));
        for (i = 0; i < per && shufLeft > 0; i++) { scrambleOne(); shufLeft--; }
        if (Math.floor(clock * 30) % 2 === 0) R.sfx.play('tick');
        if (shufLeft <= 0) {
          if (isSolved()) { shufLeft = 6; return; }
          phase = 'play'; R.sfx.play('select');
        }
      } else if (phase === 'play') {
        if (inp.d >= 0) tryMove(inp.d);
        if (phase === 'play' && undoP) undo();
        if (phase === 'play' && R.input.pressed('a')) { startLevel(lvl); beginShuffle(); }
      } else if (phase === 'solved') {
        phaseT -= dt;
        if (Math.random() < dt * 8) R.fx.burst(U.rand(20, 250), U.rand(50, 300), { n: 6, color: [C.yellow, C.pink, C.lime], speed: 70, life: 0.7, size: 2, gravity: 60 });
        if (phaseT <= 0) { R.sfx.play('powerup'); startLevel(lvl + 1); beginShuffle(); }
      }
    },

    render: function (ctx, W, H) {
      renderHud(ctx);
      // board frame + slots
      D.rect(ctx, BX - 3, BY - 3, BOARD + 6, BOARD + 6, '#2a3558');
      D.rect(ctx, BX, BY, BOARD, BOARD, '#141a40');
      var i, v;
      for (i = 0; i < n * n; i++) { var p = cellPos(i); D.rect(ctx, p.x, p.y, tileSz, tileSz, '#0e1230'); }
      for (i = 0; i < n * n; i++) { v = board[i]; if (v) drawTile(ctx, tiles[v], i); }
      // direction hints: arrows inside the empty cell show which way each neighbouring tile would slide
      if (phase === 'play' && moves < 12 && R.mode === 'play') {
        var gr = Math.floor(gap / n), gc = gap % n, gp = cellPos(gap);
        for (var d = 0; d < 4; d++) {
          var sr = gr - DY[d], sc = gc - DX[d];
          if (sr < 0 || sc < 0 || sr >= n || sc >= n) continue;
          var off = tileSz / 2 - (n === 5 ? 9 : 12);
          drawArrow(ctx, gp.x + tileSz / 2 - DX[d] * off, gp.y + tileSz / 2 - DY[d] * off, d, n === 5 ? 4 : 6, 'rgba(255,255,255,' + (0.45 + 0.35 * Math.sin(clock * 6)) + ')');
        }
      }
      D.text(ctx, 'ARROWS: TILE SLIDES THAT WAY', 136, 307, { size: 6, color: '#5d6d99', align: 'center' });
      D.text(ctx, 'A SHUFFLE   B UNDO', 136, 317, { size: 6, color: '#5d6d99', align: 'center' });
      if (phase === 'solved') {
        D.rect(ctx, 20, 108, 232, 100, 'rgba(6,10,28,.9)'); D.frame(ctx, 20, 108, 232, 100, C.yellow, 2);
        D.text(ctx, 'SOLVED!', 136, 120, { size: 16, color: C.yellow, align: 'center', shadow: '#000' });
        D.text(ctx, solveInfo.moves + ' MOVES  ' + fmtTime(solveInfo.time), 136, 148, { size: 8, color: C.white, align: 'center' });
        D.text(ctx, '+' + solveInfo.pts + ' POINTS', 136, 166, { size: 8, color: C.lime, align: 'center' });
        if (solveInfo.best) D.text(ctx, 'NEW BEST!', 136, 184, { size: 8, color: C.pink, align: 'center' });
      }
    },

    serialize: function () {
      if (phase === 'solved') return { lvl: lvl + 1, fresh: true };
      return { lvl: lvl, b: board.slice(), moves: moves, time: timer, h: hist.join('') };
    },
    restore: function (s) {
      startLevel(s.lvl || 1);
      if (s.fresh || !s.b || s.b.length !== n * n) { instantShuffle(); return; }
      board = s.b.slice(); gap = board.indexOf(0);
      moves = s.moves | 0; timer = +s.time || 0; timerOn = timer > 0 || moves > 0;
      hist = String(s.h || '').split('').map(Number).filter(function (d) { return d >= 0 && d < 4; });
      buildTiles(); phase = 'play';
    }
  });
})();
