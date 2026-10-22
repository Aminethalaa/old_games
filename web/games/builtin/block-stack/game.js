/* Block Stack — falling-blocks classic, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors;
  var COLS = 10, ROWS = 20, CELL = 16;
  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };
  var COLOR = { I: C.cyan, O: C.yellow, T: C.purple, S: C.lime, Z: C.red, J: C.blue, L: C.orange };
  var LINE_SCORE = [0, 100, 300, 500, 800];

  var grid, piece, nextType, bag, lines, fall, lockT, lockResets, clearing, softDrop;

  function emptyGrid() { var g = []; for (var y = 0; y < ROWS; y++) g.push(new Array(COLS).fill(null)); return g; }
  function rotateCW(m) { var n = m.length, r = m.map(function () { return new Array(n).fill(0); }); for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) r[x][n - 1 - y] = m[y][x]; return r; }
  function nextFromBag() { if (!bag.length) bag = R.util.shuffle(Object.keys(SHAPES)); return bag.pop(); }
  function gravity() { var l = R.level - 1; return Math.max(0.035, Math.pow(0.8 - l * 0.007, l)); }

  function collides(m, px, py) {
    for (var y = 0; y < m.length; y++) for (var x = 0; x < m[y].length; x++) {
      if (!m[y][x]) continue;
      var gx = px + x, gy = py + y;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
      if (gy >= 0 && grid[gy][gx]) return true;
    }
    return false;
  }

  function spawn() {
    var t = nextType; nextType = nextFromBag();
    var m = SHAPES[t].map(function (r) { return r.slice(); });
    piece = { t: t, m: m, x: Math.floor((COLS - m.length) / 2), y: t === 'I' ? -1 : 0 };
    fall = 0; lockT = 0; lockResets = 0;
    if (collides(piece.m, piece.x, piece.y)) { piece.y--; if (collides(piece.m, piece.x, piece.y)) { R.gameOver(); return false; } }
    return true;
  }

  function tryMove(dx, dy) {
    if (collides(piece.m, piece.x + dx, piece.y + dy)) return false;
    piece.x += dx; piece.y += dy;
    if (dx && lockT > 0 && lockResets < 12) { lockT = 0; lockResets++; }
    return true;
  }

  function tryRotate() {
    if (piece.t === 'O') return;
    var m = rotateCW(piece.m), kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collides(m, piece.x + kicks[i], piece.y)) {
        piece.m = m; piece.x += kicks[i]; R.sfx.play('rotate');
        if (lockT > 0 && lockResets < 12) { lockT = 0; lockResets++; }
        return;
      }
      if (!collides(m, piece.x + kicks[i], piece.y - 1)) { piece.m = m; piece.x += kicks[i]; piece.y -= 1; R.sfx.play('rotate'); return; }
    }
  }

  function ghostY() { var y = piece.y; while (!collides(piece.m, piece.x, y + 1)) y++; return y; }

  function lockPiece() {
    for (var y = 0; y < piece.m.length; y++) for (var x = 0; x < piece.m[y].length; x++) {
      if (piece.m[y][x] && piece.y + y >= 0) grid[piece.y + y][piece.x + x] = piece.t;
    }
    R.sfx.play('land'); R.vibrate(10);
    var full = [];
    for (var r = 0; r < ROWS; r++) if (grid[r].every(function (c) { return c; })) full.push(r);
    piece = null;
    if (full.length) {
      clearing = { rows: full, t: 0.28 };
      R.sfx.play('line'); R.vibrate(25 * full.length);
      full.forEach(function (row) { for (var c = 0; c < COLS; c++) R.fx.burst(c * CELL + CELL / 2, row * CELL + CELL / 2, { n: 2, color: [C.white, C.yellow], speed: 50, life: 0.5, gravity: 120 }); });
      if (full.length === 4) { R.fx.shake(3, 0.3); R.achieve('quad'); }
    } else spawn();
  }

  function finishClear() {
    var rows = clearing.rows; clearing = null;
    rows.sort(function (a, b) { return a - b; }).forEach(function (row) { grid.splice(row, 1); grid.unshift(new Array(COLS).fill(null)); });
    var n = rows.length;
    R.addScore(LINE_SCORE[n] * R.level);
    lines += n; R.hud.extra = lines;
    R.fx.text(80, 60, '+' + (LINE_SCORE[n] * R.level), C.yellow);
    if (lines >= 1) R.achieve('first-line');
    var lvl = 1 + Math.floor(lines / 10);
    if (lvl > R.level) { R.level = lvl; R.sfx.play('powerup'); R.fx.flash(C.white, 0.2); if (lvl >= 5) R.achieve('level5'); }
    if (R.score >= 5000) R.achieve('score5000');
    spawn();
  }

  function hardDrop() {
    var gy = ghostY(), d = gy - piece.y;
    piece.y = gy; R.addScore(2 * d); R.sfx.play('drop'); R.fx.shake(1.5, 0.1);
    lockPiece();
  }

  R.game({
    layout: 'classic', size: [COLS * CELL, ROWS * CELL], bg: '#0b1020', music: 'puzzle',
    levelLabel: null,

    reset: function () {
      grid = emptyGrid(); bag = []; lines = 0; clearing = null; piece = null; fall = 0; lockT = 0; lockResets = 0;
      nextType = nextFromBag();
      R.level = 1; R.hud.extraLabel = 'LINES'; R.hud.extra = 0;
      spawn();
    },

    update: function (dt) {
      if (clearing) { clearing.t -= dt; if (clearing.t <= 0) finishClear(); return; }
      if (!piece) return;
      if (R.input.rep('left', 160, 50)) tryMove(-1, 0) && R.sfx.play('move');
      if (R.input.rep('right', 160, 50)) tryMove(1, 0) && R.sfx.play('move');
      if (R.input.pressed('a') || R.input.pressed('up')) tryRotate();
      if (R.input.pressed('b')) { hardDrop(); return; }
      softDrop = R.input.held.down;
      var interval = softDrop ? Math.min(gravity(), 0.04) : gravity();
      fall += dt;
      while (fall >= interval) {
        fall -= interval;
        if (!tryMove(0, 1)) break;
        if (softDrop) R.addScore(1);
      }
      if (collides(piece.m, piece.x, piece.y + 1)) {
        lockT += dt;
        if (lockT >= (softDrop ? 0.08 : 0.45)) lockPiece();
      } else lockT = 0;
    },

    render: function (ctx, W, H) {
      var x, y;
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#0d1326' : '#0b1020'; ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
        var c = grid[y][x];
        if (!c) continue;
        if (clearing && clearing.rows.indexOf(y) >= 0) { ctx.fillStyle = Math.floor(clearing.t * 30) % 2 ? C.white : COLOR[c]; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
        else R.draw.block(ctx, x * CELL, y * CELL, CELL, COLOR[c]);
      }
      if (piece) {
        var gy = ghostY(), col = COLOR[piece.t];
        for (y = 0; y < piece.m.length; y++) for (x = 0; x < piece.m[y].length; x++) {
          if (!piece.m[y][x]) continue;
          if (gy + y >= 0) R.draw.frame(ctx, (piece.x + x) * CELL + 1, (gy + y) * CELL + 1, CELL - 2, CELL - 2, col, 1);
        }
        for (y = 0; y < piece.m.length; y++) for (x = 0; x < piece.m[y].length; x++) {
          if (piece.m[y][x] && piece.y + y >= 0) R.draw.block(ctx, (piece.x + x) * CELL, (piece.y + y) * CELL, CELL, col);
        }
      }
    },

    renderNext: function (ctx, w, h) {
      if (!nextType) return;
      var m = SHAPES[nextType], s = 10, cw = m[0].length * s, ch = m.length * s;
      // trim empty rows so the piece is centred
      var minY = 9, maxY = -1;
      m.forEach(function (row, y) { if (row.some(function (v) { return v; })) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); } });
      var offY = (h - (maxY - minY + 1) * s) / 2 - minY * s;
      for (var y = 0; y < m.length; y++) for (var x = 0; x < m[y].length; x++) if (m[y][x]) R.draw.block(ctx, (w - cw) / 2 + x * s, offY + y * s, s, COLOR[nextType]);
    },

    serialize: function () {
      return { grid: grid, piece: piece, next: nextType, bag: bag, lines: lines };
    },
    restore: function (s) {
      grid = s.grid; piece = s.piece; nextType = s.next; bag = s.bag; lines = s.lines; clearing = null; fall = 0; lockT = 0; lockResets = 0;
      R.hud.extraLabel = 'LINES'; R.hud.extra = lines;
      if (!piece) spawn();
    }
  });
})();
