/* Mine Finder — a portrait minesweeper with a D-pad cursor. Built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util, D = R.draw;

  var COLS = 9, ROWS = 11, CELL = 25, BX = 24, BY = 36, TOTAL = COLS * ROWS;
  var NUM_COL = [null, '#29adff', '#00e436', '#ff004d', '#b455ff', '#ffa300', '#3de2ff', '#ff77a8', '#fff1e8'];

  var BOMB = ['....k....', '.k..k..k.', '..kkkkk..', '.kkwwkkk.', 'kkkwkkkkk', '.kkkkkkk.', '..kkkkk..', '.k..k..k.', '....k....'];
  var BOMB_DARK = { k: '#10131c', w: '#fff1e8' };
  var BOMB_LIGHT = { k: '#9aa2c0', w: '#ffffff' };
  var FLAG = ['...rr....', '...rrrr..', '...rrrrrr', '...rrrr..', '...rr....', '...w.....', '...w.....', '..www....', '.wwwww...'];
  var FLAG_PAL = { r: '#ff004d', w: '#fff1e8' };

  var cells, cur, placed, timer, phase, phaseT, mineCount, flagCount, opened, lvl, dyingList, dyingNext, boomAt, wrongShown, clock, firstOpen;

  /* ------------------------------------------------------------ helpers */
  function idx(x, y) { return y * COLS + x; }
  function inb(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
  function minesFor(l) { return Math.round(TOTAL * Math.min(0.28, 0.10 + 0.0165 * (l - 1))); }
  function cx(x) { return BX + x * CELL; }
  function cy(y) { return BY + y * CELL; }
  function eachNb(x, y, fn) {
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (inb(x + dx, y + dy)) fn(x + dx, y + dy, cells[idx(x + dx, y + dy)]);
    }
  }
  function fmt(n, len) { n = Math.max(0, Math.floor(n)); return U.pad(n, len); }

  function blank() {
    cells = [];
    for (var i = 0; i < TOTAL; i++) cells.push({ m: 0, n: 0, s: 0, a: 9, boom: false, wrong: false });
  }

  function newBoard(level) {
    lvl = level; R.level = level;
    blank();
    mineCount = minesFor(level); placed = false; timer = 0; phase = 'play'; phaseT = 0; flagCount = 0; opened = 0;
    dyingList = []; dyingNext = 0; boomAt = -1; wrongShown = false; firstOpen = true;
    cur = { x: 4, y: 5, dx: cx(4), dy: cy(5) };
    if (level >= 5) R.achieve('level5');
  }

  function computeNumbers() {
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      var n = 0;
      eachNb(x, y, function (nx, ny, c) { if (c.m) n++; });
      cells[idx(x, y)].n = n;
    }
  }

  function placeMines(sx, sy) {
    var pool = [];
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) continue;     // the first click and its ring are always safe
      pool.push(idx(x, y));
    }
    U.shuffle(pool);
    for (var i = 0; i < mineCount; i++) cells[pool[i]].m = 1;
    placed = true;
    computeNumbers();
  }

  /* ------------------------------------------------------------ actions */
  function reveal(x, y) {
    var c = cells[idx(x, y)];
    if (c.s !== 0) return;
    if (!placed) placeMines(x, y);
    if (c.m) { lose(x, y); return; }
    // flood fill with a distance so the reveal ripples out
    var q = [[x, y, 0]], seen = {}, count = 0, maxD = 0;
    seen[idx(x, y)] = true;
    while (q.length) {
      var p = q.shift(), cc = cells[idx(p[0], p[1])];
      cc.s = 1; cc.a = -p[2] * 0.03; opened++; count++; maxD = Math.max(maxD, p[2]);
      if (cc.n === 0) {
        eachNb(p[0], p[1], function (nx, ny, n2) {
          var k = idx(nx, ny);
          if (!seen[k] && n2.s === 0 && !n2.m) { seen[k] = true; q.push([nx, ny, p[2] + 1]); }
        });
      }
    }
    R.addScore(count * 2 * lvl);
    if (count > 6) { R.sfx.play('line'); R.vibrate(20); }
    else R.sfx.tone(520 + c.n * 70, 0.05, { vol: 0.1 });
    var col = c.n ? NUM_COL[c.n] : C.cyan;
    R.fx.burst(cx(x) + CELL / 2, cy(y) + CELL / 2, { n: 5, color: [col, C.white], speed: 50, life: 0.35, size: 2 });
    checkClear();
  }

  function chord(x, y) {
    var c = cells[idx(x, y)], f = 0, todo = [];
    if (c.s !== 1 || c.n === 0) return;
    eachNb(x, y, function (nx, ny, n2) { if (n2.s === 2) f++; else if (n2.s === 0) todo.push([nx, ny]); });
    if (f !== c.n || !todo.length) { R.sfx.tone(180, 0.05, { vol: 0.08, type: 'triangle' }); return; }
    R.achieve('chord');
    for (var i = 0; i < todo.length && phase === 'play'; i++) reveal(todo[i][0], todo[i][1]);
  }

  function toggleFlag(x, y) {
    var c = cells[idx(x, y)];
    if (c.s === 1) return;
    if (c.s === 0) { c.s = 2; flagCount++; R.sfx.play('blip'); R.vibrate(10); c.a = 0; }
    else { c.s = 0; flagCount--; R.sfx.play('tick'); }
  }

  function act(x, y) {
    var c = cells[idx(x, y)];
    if (c.s === 2) { R.sfx.tone(150, 0.06, { vol: 0.08, type: 'triangle' }); return; }
    if (c.s === 1) chord(x, y); else reveal(x, y);
  }

  function checkClear() {
    if (phase !== 'play' || opened < TOTAL - mineCount) return;
    phase = 'clear'; phaseT = 2.1;
    var bonus = 100 * lvl + Math.max(0, 120 - Math.floor(timer)) * lvl;
    R.addScore(bonus);
    cells.forEach(function (c) { if (c.m) { c.s = 2; c.a = 0; } });
    flagCount = mineCount;
    R.sfx.play('win'); R.vibrate(60); R.fx.flash(C.lime, 0.25);
    for (var i = 0; i < 6; i++) R.fx.burst(U.rand(30, 240), U.rand(60, 280), { n: 14, color: [C.lime, C.yellow, C.cyan, C.pink, C.white], speed: 110, life: 1, size: 3, gravity: 80 });
    R.fx.text(136, 108, '+' + bonus, C.yellow);
    R.achieve('first-sweep');
    if (timer < 60) R.achieve('speedy');
  }

  function lose(x, y) {
    phase = 'dying'; phaseT = 0; boomAt = idx(x, y);
    var c = cells[boomAt]; c.s = 1; c.a = 0; c.boom = true;
    R.sfx.play('explode'); R.vibrate(150); R.fx.shake(5, 0.5); R.fx.flash(C.red, 0.2);
    explodeFx(x, y);
    dyingList = [];
    cells.forEach(function (cc, i) {
      if (cc.m && cc.s === 0 && i !== boomAt) dyingList.push(i);
      if (cc.s === 2 && !cc.m) cc.wrong = true;
    });
    dyingList.sort(function (a, b) {
      var ax = a % COLS - x, ay = Math.floor(a / COLS) - y, bx = b % COLS - x, by = Math.floor(b / COLS) - y;
      return ax * ax + ay * ay - bx * bx - by * by;
    });
    dyingNext = 0;
  }

  function explodeFx(x, y) {
    R.fx.burst(cx(x) + CELL / 2, cy(y) + CELL / 2, { n: 26, color: [C.red, C.orange, C.yellow, C.white], speed: 150, life: 0.8, size: 3, gravity: 110 });
  }

  /* ------------------------------------------------------------ drawing */
  function drawNumber(ctx, x, y, n) {
    D.text(ctx, String(n), x + CELL / 2, y + CELL / 2 - 7, { size: 16, color: NUM_COL[n], align: 'center', shadow: 'rgba(0,0,0,.5)' });
  }

  function drawCell(ctx, i) {
    var x = i % COLS, y = Math.floor(i / COLS), c = cells[i], px = cx(x), py = cy(y), chk = (x + y) % 2;
    var shown = c.s === 1 && c.a >= 0;
    if (c.boom) {
      D.rect(ctx, px, py, CELL, CELL, '#ff004d');
      D.sprite(ctx, BOMB, px + 4, py + 4, { palette: BOMB_DARK, scale: 2 });
      return;
    }
    if (shown) {
      D.rect(ctx, px, py, CELL, CELL, c.exploded ? '#b4103a' : chk ? '#1a2152' : '#151b48');
      if (c.m) D.sprite(ctx, BOMB, px + 4, py + 4, { palette: c.exploded ? BOMB_DARK : BOMB_LIGHT, scale: 2 });
      else if (c.n) drawNumber(ctx, px, py, c.n);
      if (c.a < 0.14) { ctx.globalAlpha = (1 - c.a / 0.14) * 0.55; D.rect(ctx, px, py, CELL, CELL, '#fff'); ctx.globalAlpha = 1; }
      return;
    }
    // hidden tile (also used while a reveal ripple has not reached the cell yet)
    D.block(ctx, px, py, CELL, chk ? '#6c7cf0' : '#5f70e4');
    if (c.s === 2) {
      var bob = c.a < 0.12 && c.a >= 0 ? -2 : 0;
      D.sprite(ctx, FLAG, px + 4, py + 3 + bob, { palette: FLAG_PAL, scale: 2 });
    }
  }

  function renderBar(ctx) {
    D.rect(ctx, 0, 0, 272, 34, '#0c1030');
    D.rect(ctx, 0, 33, 272, 1, '#2a3558');
    D.sprite(ctx, FLAG, 5, 3, { palette: FLAG_PAL, scale: 2 });
    var left = mineCount - flagCount;
    D.text(ctx, (left < 0 ? '-' : '') + fmt(Math.abs(left), 2), 28, 5, { size: 16, color: left < 0 ? C.red : C.yellow });
    D.text(ctx, 'LV' + lvl, 136, 5, { size: 8, color: C.lime, align: 'center' });
    D.text(ctx, 'M' + mineCount, 136, 16, { size: 8, color: '#8fa3c8', align: 'center' });
    D.text(ctx, fmt(Math.min(999, timer), 3), 266, 5, { size: 16, color: C.cyan, align: 'right' });
    D.text(ctx, 'SC ' + fmt(R.score, 5), 6, 24, { size: 6, color: '#9fb2d0' });
    D.text(ctx, 'HI ' + fmt(Math.max(R.hud.hi, R.score), 5), 266, 24, { size: 6, color: '#9fb2d0', align: 'right' });
  }

  /* ------------------------------------------------------------ game */
  R.game({
    layout: 'full', size: [272, 328], bg: '#0a0e26', music: 'puzzle',

    reset: function () {
      clock = 0;
      newBoard(1);
    },

    update: function (dt) {
      clock += dt;
      var i, c;
      for (i = 0; i < TOTAL; i++) { c = cells[i]; if (c.a < 9) c.a += dt; }
      // smooth cursor
      cur.dx += (cx(cur.x) - cur.dx) * Math.min(1, dt * 30); cur.dy += (cy(cur.y) - cur.dy) * Math.min(1, dt * 30);

      if (phase === 'play') {
        if (placed) timer += dt;
        var mx = 0, my = 0;
        if (R.input.rep('left', 180, 70)) mx = -1;
        if (R.input.rep('right', 180, 70)) mx = 1;
        if (R.input.rep('up', 180, 70)) my = -1;
        if (R.input.rep('down', 180, 70)) my = 1;
        if (mx || my) {
          cur.x = (cur.x + mx + COLS) % COLS; cur.y = (cur.y + my + ROWS) % ROWS;
          R.sfx.play('move');
        }
        if (R.input.pressed('a')) act(cur.x, cur.y);
        if (phase === 'play' && R.input.pressed('b')) toggleFlag(cur.x, cur.y);
      } else if (phase === 'dying') {
        phaseT += dt;
        var step = Math.min(0.1, 0.9 / Math.max(1, dyingList.length));
        while (dyingNext < dyingList.length && phaseT > 0.25 + dyingNext * step) {
          var k = dyingList[dyingNext++], cc = cells[k];
          cc.s = 1; cc.a = 0; cc.exploded = true;
          explodeFx(k % COLS, Math.floor(k / COLS));
          if (dyingNext % 3 === 1) { R.sfx.play('hit'); R.vibrate(15); }
        }
        if (phaseT > 0.25 + dyingList.length * step + 0.9) R.gameOver();
      } else if (phase === 'clear') {
        phaseT -= dt;
        if (Math.random() < dt * 10) R.fx.burst(U.rand(20, 250), U.rand(50, 280), { n: 8, color: [C.lime, C.yellow, C.pink], speed: 80, life: 0.7, size: 2, gravity: 60 });
        if (phaseT <= 0) { R.sfx.play('powerup'); newBoard(lvl + 1); }
      }
    },

    render: function (ctx, W, H) {
      renderBar(ctx);
      var i;
      D.rect(ctx, BX - 2, BY - 2, COLS * CELL + 4, ROWS * CELL + 4, '#2a3558');
      for (i = 0; i < TOTAL; i++) drawCell(ctx, i);
      for (i = 0; i < TOTAL; i++) {
        var c = cells[i];
        if (c.wrong && phase === 'dying' && phaseT > 0.3) {
          var x = cx(i % COLS), y = cy(Math.floor(i / COLS));
          D.line(ctx, x + 4, y + 4, x + CELL - 4, y + CELL - 4, '#ff004d', 3);
          D.line(ctx, x + CELL - 4, y + 4, x + 4, y + CELL - 4, '#ff004d', 3);
        }
      }
      // cursor
      if (phase === 'play') {
        var pulse = 0.5 + 0.5 * Math.sin(clock * 9), t = pulse > 0.5 ? 3 : 2;
        D.frame(ctx, Math.round(cur.dx) - 1, Math.round(cur.dy) - 1, CELL + 2, CELL + 2, C.yellow, t);
        D.frame(ctx, Math.round(cur.dx) + 1, Math.round(cur.dy) + 1, CELL - 2, CELL - 2, 'rgba(0,0,0,.45)', 1);
      }
      D.text(ctx, 'A OPEN   B FLAG', 136, 316, { size: 6, color: '#5d6d99', align: 'center' });
      if (phase === 'clear') {
        D.rect(ctx, 20, 120, 232, 64, 'rgba(6,24,10,.88)');
        D.frame(ctx, 20, 120, 232, 64, C.lime, 2);
        D.text(ctx, 'CLEARED!', 136, 132, { size: 16, color: C.lime, align: 'center', shadow: '#000' });
        D.text(ctx, 'NEXT: ' + minesFor(lvl + 1) + ' MINES', 136, 158, { size: 8, color: C.white, align: 'center' });
      }
    },

    onPointer: function (e) {
      if (e.type !== 'down' || phase !== 'play') return;
      var x = Math.floor((e.x - BX) / CELL), y = Math.floor((e.y - BY) / CELL);
      if (!inb(x, y)) return;
      if (cur.x === x && cur.y === y) act(x, y); else { cur.x = x; cur.y = y; R.sfx.play('move'); }
    },

    serialize: function () {
      var s = { lvl: lvl, cx: cur.x, cy: cur.y };
      if (phase === 'clear') { s.lvl = lvl + 1; s.fresh = true; return s; }           // saved between boards: next one is a fresh board
      s.placed = placed; s.timer = timer;
      s.m = cells.map(function (c) { return c.m ? '1' : '0'; }).join('');
      s.st = cells.map(function (c) { return c.s; }).join('');
      if (phase === 'dying') { s.dead = boomAt; }
      return s;
    },
    restore: function (s) {
      newBoard(s.lvl || 1);
      cur.x = U.clamp(s.cx | 0, 0, COLS - 1); cur.y = U.clamp(s.cy | 0, 0, ROWS - 1); cur.dx = cx(cur.x); cur.dy = cy(cur.y);
      if (s.fresh || !s.m) return;
      var i;
      placed = !!s.placed; timer = s.timer || 0;
      for (i = 0; i < TOTAL; i++) { cells[i].m = s.m.charAt(i) === '1' ? 1 : 0; cells[i].s = +s.st.charAt(i) || 0; cells[i].a = 9; }
      if (placed) computeNumbers();
      opened = 0; flagCount = 0;
      cells.forEach(function (c) { if (c.s === 1) opened++; else if (c.s === 2) flagCount++; });
      if (s.dead != null && s.dead >= 0 && cells[s.dead]) lose(s.dead % COLS, Math.floor(s.dead / COLS));
    }
  });
})();
