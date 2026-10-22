/* Merge 2048 — slide colourful tiles, merge equal numbers, reach the 2048 tile. Built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util, D = R.draw;

  var N = 4, TILE = 56, GAP = 4, BOARD = N * TILE + (N + 1) * GAP;      // 244
  var BX = Math.round((272 - BOARD) / 2), BY = 66;
  var SLIDE = 0.09, POP = 0.2, BORN = 0.17, MAX_UNDO = 3, HIST_MAX = 3, STUCK_WAIT = 1.7;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];                            // 0 up · 1 right · 2 down · 3 left

  // value → [fill, text]
  var TILE_COL = {
    2: ['#58d6ff', '#10243a'], 4: ['#3be3b0', '#0c2e28'], 8: ['#86e84a', '#17300c'], 16: ['#d9ec3a', '#2d3008'],
    32: ['#ffd23a', '#33270a'], 64: ['#ffa032', '#fff'], 128: ['#ff6f4a', '#fff'], 256: ['#ff4d7e', '#fff'],
    512: ['#e04bd6', '#fff'], 1024: ['#a066ff', '#fff'], 2048: ['#5f7cff', '#ffec27']
  };

  var tiles, nextId, sliding, slideT, queuedDir, queuedUndo, hist, undoLeft, maxTile, won, bannerT, stuckT, swipe, swipeDir;

  /* ------------------------------------------------------------ helpers */
  function colOf(v) { return (TILE_COL[v] || ['#fff1e8', '#c4601a'])[0]; }
  function txtOf(v) { return (TILE_COL[v] || ['#fff1e8', '#c4601a'])[1]; }
  function cx(c) { return BX + GAP + c * (TILE + GAP); }
  function cy(r) { return BY + GAP + r * (TILE + GAP); }
  function easeOut(x) { x = U.clamp(x, 0, 1); return 1 - (1 - x) * (1 - x); }
  function backOut(x) { x = U.clamp(x, 0, 1) - 1; return 1 + 2.70158 * x * x * x + 1.70158 * x * x; }
  function log2(v) { return Math.round(Math.log(v) / Math.LN2); }

  function mk(v, r, c, hidden) {
    var t = { id: nextId++, v: v, r: r, c: c, fr: r, fc: c, dead: false, merging: false, nv: 0, hidden: !!hidden, age: 9, pop: 9 };
    if (!hidden) t.age = 0;
    tiles.push(t);
    return t;
  }

  function occupancy() {
    var g = [], r, c;
    for (r = 0; r < N; r++) g.push([null, null, null, null]);
    tiles.forEach(function (t) { if (!t.dead) g[t.r][t.c] = t; });
    return g;
  }
  function logicalCells() {
    var g = [], r;
    for (r = 0; r < N; r++) g.push([0, 0, 0, 0]);
    tiles.forEach(function (t) { if (!t.dead) g[t.r][t.c] = t.merging ? t.nv : t.v; });
    return g;
  }
  function loadCells(cells, animate) {
    tiles = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var v = cells[r][c];
      if (v) { var t = mk(v, r, c, false); if (animate) { t.age = BORN * 0.45; t.pop = 0; } else t.age = 9; }
    }
  }

  function spawn(hidden) {
    var g = occupancy(), free = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!g[r][c]) free.push([r, c]);
    if (!free.length) return null;
    var p = U.pick(free);
    return mk(Math.random() < 0.9 ? 2 : 4, p[0], p[1], hidden);
  }

  function canMove() {
    var g = logicalCells();
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (!g[r][c]) return true;
      if (c + 1 < N && g[r][c + 1] === g[r][c]) return true;
      if (r + 1 < N && g[r + 1][c] === g[r][c]) return true;
    }
    return false;
  }

  function topTile() { var m = 0; logicalCells().forEach(function (row) { row.forEach(function (v) { if (v > m) m = v; }); }); return m; }

  /* ------------------------------------------------------------ moves */
  function tryMove(dir) {
    if (stuckT > 0) return;
    var dx = DX[dir], dy = DY[dir];
    var snap = { cells: logicalCells(), score: R.score };
    tiles.forEach(function (t) { t.fr = t.r; t.fc = t.c; });
    var g = occupancy(), rs = [0, 1, 2, 3], cs = [0, 1, 2, 3], moved = false, gain = 0;
    if (dx === 1) cs.reverse();
    if (dy === 1) rs.reverse();
    function inb(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
    rs.forEach(function (r) {
      cs.forEach(function (c) {
        var t = g[r][c];
        if (!t) return;
        var nr = r, nc = c;
        while (inb(nr + dy, nc + dx) && !g[nr + dy][nc + dx]) { nr += dy; nc += dx; }
        var nxt = inb(nr + dy, nc + dx) ? g[nr + dy][nc + dx] : null;
        g[r][c] = null;
        if (nxt && nxt.v === t.v && !nxt.merging) {
          t.r = nxt.r; t.c = nxt.c; t.dead = true; nxt.merging = true; nxt.nv = nxt.v * 2; gain += nxt.nv; moved = true;
        } else {
          g[nr][nc] = t; t.r = nr; t.c = nc;
          if (nr !== r || nc !== c) moved = true;
        }
      });
    });
    if (!moved) {                      // blocked: restore bookkeeping
      tiles.forEach(function (t) { t.fr = t.r; t.fc = t.c; });
      R.sfx.tone(130, 0.06, { vol: 0.08, type: 'triangle' });
      return;
    }
    hist.push(snap); if (hist.length > HIST_MAX) hist.shift();
    R.addScore(gain);
    spawn(true);                       // chosen now (so save/restore is exact), shown when the slide ends
    sliding = true; slideT = 0;
    R.sfx.play('move');
  }

  function finishSlide() {
    sliding = false;
    var merged = [];
    tiles = tiles.filter(function (t) { return !t.dead; });
    tiles.forEach(function (t) {
      if (t.merging) { t.v = t.nv; t.merging = false; t.pop = 0; merged.push(t); }
      if (t.hidden) { t.hidden = false; t.age = 0; }
      t.fr = t.r; t.fc = t.c;
    });
    if (merged.length) {
      var best = 0;
      merged.forEach(function (t) {
        best = Math.max(best, t.v);
        R.fx.burst(cx(t.c) + TILE / 2, cy(t.r) + TILE / 2, { n: 8 + Math.min(10, log2(t.v)), color: [colOf(t.v), C.white], speed: 95, life: 0.5, size: 3, gravity: 120 });
        R.fx.text(cx(t.c) + TILE / 2, cy(t.r) + 6, '+' + t.v, '#fff');
      });
      var f = 300 + 52 * log2(best);
      R.sfx.tone(f, 0.11, { vol: 0.12 });
      R.sfx.tone(f * 1.5, 0.16, { vol: 0.09, delay: 0.06, type: 'triangle' });
      R.vibrate(best >= 128 ? 22 : 8);
    }
    checkMilestones();
    if (!canMove()) beginStuck();
  }

  function checkMilestones() {
    var m = topTile();
    if (m > maxTile) {
      var first = maxTile === 0;
      maxTile = m;
      R.level = Math.max(1, log2(m));
      if (!first) {
        if (m >= 64 && undoLeft < MAX_UNDO) { undoLeft = MAX_UNDO; R.fx.text(136, BY - 12, 'UNDO REFILLED', C.lime); }
        if (m >= 128) { R.sfx.play('powerup'); R.fx.flash(colOf(m), 0.16); R.vibrate(30); }
      }
    }
    if (m >= 256) R.achieve('tile-256');
    if (m >= 512) R.achieve('tile-512');
    if (m >= 1024) R.achieve('tile-1024');
    if (m >= 2048) {
      R.achieve('tile-2048');
      if (!won) {
        won = true; bannerT = 3;
        R.sfx.play('win'); R.fx.flash(C.yellow, 0.4); R.fx.shake(4, 0.4); R.vibrate(80);
        for (var i = 0; i < 6; i++) R.fx.burst(U.rand(40, 232), U.rand(80, 280), { n: 14, color: [C.yellow, C.pink, C.cyan, C.lime, C.orange], speed: 120, life: 1.1, size: 3, gravity: 90 });
      }
    }
  }

  function beginStuck() {
    stuckT = STUCK_WAIT; R.sfx.play('hit'); R.vibrate(40); R.fx.shake(2, 0.2);
  }

  function undo() {
    if (!hist.length || undoLeft <= 0) { R.sfx.tone(130, 0.06, { vol: 0.08, type: 'triangle' }); return; }
    var s = hist.pop();
    loadCells(s.cells, true);
    R.score = s.score;
    undoLeft--; stuckT = 0; sliding = false; queuedDir = null;
    R.sfx.play('rotate'); R.vibrate(12);
  }

  /* ------------------------------------------------------------ game */
  function drawTile(ctx, x, y, s, v) {
    var col = colOf(v), b = Math.max(2, Math.round(s / 14));
    ctx.fillStyle = col; ctx.fillRect(x, y, s, s);
    ctx.fillStyle = U.shade(col, 0.42); ctx.fillRect(x, y, s, b); ctx.fillRect(x, y, b, s);
    ctx.fillStyle = U.shade(col, -0.38); ctx.fillRect(x, y + s - b, s, b); ctx.fillRect(x + s - b, y, b, s);
    var str = String(v), size = str.length <= 3 ? 16 : str.length === 4 ? 12 : 8;
    var tc = txtOf(v);
    var tx = x + s / 2, ty = y + s / 2 - size / 2 + 1;
    if (tc === '#fff') {                                   // light text gets a dark outline (also keeps it readable in the mono LCD modes)
      var ow = size >= 16 ? 2 : 1;
      for (var ox = -ow; ox <= ow; ox += ow) for (var oy = -ow; oy <= ow; oy += ow) if (ox || oy) D.text(ctx, str, tx + ox, ty + oy, { size: size, color: '#1a1030', align: 'center' });
    }
    D.text(ctx, str, tx, ty, { size: size, color: tc, align: 'center' });
  }

  function renderHud(ctx) {
    D.text(ctx, 'SCORE', 14, 8, { size: 8, color: '#8fa3c8' });
    D.text(ctx, String(R.score), 14, 20, { size: 16, color: C.yellow });
    D.text(ctx, 'BEST', 258, 8, { size: 8, color: '#8fa3c8', align: 'right' });
    D.text(ctx, String(Math.max(R.hud.hi, R.score)), 258, 20, { size: 16, color: C.white, align: 'right' });
    // undo pips + top tile chip
    D.text(ctx, 'UNDO', 14, 46, { size: 8, color: '#8fa3c8' });
    for (var i = 0; i < MAX_UNDO; i++) {
      var px = 62 + i * 14, on = i < undoLeft;
      ctx.fillStyle = on ? C.orange : '#2a3358'; ctx.fillRect(px + 3, 45, 4, 10);
      ctx.fillRect(px, 48, 10, 4);
      if (on) { ctx.fillStyle = C.yellow; ctx.fillRect(px + 4, 47, 2, 2); }
    }
    D.text(ctx, 'TOP', 196, 46, { size: 8, color: '#8fa3c8', align: 'right' });
    var tv = maxTile || 2;
    ctx.fillStyle = colOf(tv); ctx.fillRect(202, 43, 56, 14);
    ctx.fillStyle = U.shade(colOf(tv), 0.4); ctx.fillRect(202, 43, 56, 2);
    D.text(ctx, String(tv), 230, 46, { size: 8, color: txtOf(tv), align: 'center' });
  }

  R.game({
    layout: 'full', size: [272, 328], bg: '#0e1226', music: 'chill',

    reset: function () {
      tiles = []; nextId = 1; sliding = false; slideT = 0; queuedDir = null; queuedUndo = false; hist = []; undoLeft = MAX_UNDO;
      maxTile = 0; won = false; bannerT = 0; stuckT = 0; swipe = null; swipeDir = -1;
      R.level = 1;
      spawn(false); spawn(false);
      maxTile = topTile();
    },

    update: function (dt) {
      var i;
      for (i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        if (!t.hidden && t.age < 9) t.age += dt;
        if (t.pop < 9) t.pop += dt;
      }
      if (bannerT > 0) bannerT -= dt;
      if (sliding) { slideT += dt; if (slideT >= SLIDE) finishSlide(); }

      var dir = swipeDir; swipeDir = -1;
      if (R.input.pressed('up')) dir = 0;
      if (R.input.pressed('right')) dir = 1;
      if (R.input.pressed('down')) dir = 2;
      if (R.input.pressed('left')) dir = 3;
      if (R.input.pressed('b')) { if (sliding) queuedUndo = true; else undo(); }
      if (dir >= 0) { if (sliding) queuedDir = dir; else tryMove(dir); }

      if (!sliding) {
        if (queuedUndo) { queuedUndo = false; undo(); }
        else if (queuedDir !== null) { var q = queuedDir; queuedDir = null; tryMove(q); }
      }

      if (stuckT > 0 && !sliding) {
        stuckT -= dt;
        if (stuckT <= 0) { stuckT = 0; R.gameOver(); }
      }
    },

    render: function (ctx, W, H) {
      renderHud(ctx);
      // board
      D.rect(ctx, BX - 3, BY - 3, BOARD + 6, BOARD + 6, '#2a3558');
      D.rect(ctx, BX, BY, BOARD, BOARD, '#1a2142');
      var r, c;
      for (r = 0; r < N; r++) for (c = 0; c < N; c++) D.rect(ctx, cx(c), cy(r), TILE, TILE, '#232c55');
      // tiles: consumed ones first so the merged tile lands on top
      var p = sliding ? easeOut(slideT / SLIDE) : 1;
      var order = tiles.slice().sort(function (a, b) { return (a.dead ? 0 : 1) - (b.dead ? 0 : 1) || (a.merging ? 1 : 0) - (b.merging ? 1 : 0); });
      order.forEach(function (t) {
        if (t.hidden) return;
        var rr = t.fr + (t.r - t.fr) * p, cc = t.fc + (t.c - t.fc) * p;
        var sc = 1;
        if (t.age < BORN) sc *= backOut(t.age / BORN);
        if (t.pop < POP) sc *= 1 + 0.2 * Math.sin(Math.PI * t.pop / POP);
        if (sc <= 0.02) return;
        var s = Math.round(TILE * sc), x = Math.round(cx(cc) + (TILE - s) / 2), y = Math.round(cy(rr) + (TILE - s) / 2);
        drawTile(ctx, x, y, s, t.v);
      });
      D.text(ctx, 'ARROWS SLIDE   B UNDO', 136, 318, { size: 6, color: '#5d6d99', align: 'center' });

      if (bannerT > 0) {
        D.rect(ctx, BX, BY + 80, BOARD, 84, 'rgba(8,10,24,.9)');
        D.frame(ctx, BX, BY + 80, BOARD, 84, C.yellow, 2);
        D.text(ctx, '2048!', 136, BY + 94, { size: 16, color: C.yellow, align: 'center', shadow: '#000' });
        D.text(ctx, 'YOU DID IT', 136, BY + 118, { size: 8, color: C.white, align: 'center' });
        if (Math.floor(bannerT * 3) % 2) D.text(ctx, 'KEEP GOING!', 136, BY + 138, { size: 8, color: C.lime, align: 'center' });
      }
      if (stuckT > 0) {
        D.rect(ctx, BX, BY + 80, BOARD, 84, 'rgba(24,6,12,.92)');
        D.frame(ctx, BX, BY + 80, BOARD, 84, C.red, 2);
        D.text(ctx, 'NO MOVES', 136, BY + 96, { size: 16, color: C.red, align: 'center', shadow: '#000' });
        if (undoLeft > 0 && hist.length) D.text(ctx, 'B: UNDO x' + undoLeft, 136, BY + 128, { size: 8, color: C.orange, align: 'center' });
      }
    },

    onPointer: function (e) {
      if (e.type === 'down') swipe = { x: e.x, y: e.y };
      else if (e.type === 'up' && swipe) {
        var dx = e.x - swipe.x, dy = e.y - swipe.y; swipe = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        swipeDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      }
    },

    serialize: function () {
      return { cells: logicalCells(), undo: undoLeft, hist: hist, max: maxTile, won: won };
    },
    restore: function (s) {
      loadCells(s.cells, false);
      hist = (s.hist || []).slice(-HIST_MAX); undoLeft = U.clamp(s.undo | 0, 0, MAX_UNDO);
      maxTile = s.max || topTile(); won = !!s.won;
      sliding = false; slideT = 0; queuedDir = null; queuedUndo = false; bannerT = 0; stuckT = 0; swipeDir = -1;
      R.level = Math.max(1, log2(maxTile || 2));
      if (!canMove()) stuckT = STUCK_WAIT;
    }
  });
})();
