/* Road Hopper — cross the road, ride the river, reach home. Built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 132, H = 164, TILE = 12, COLS = 11, TOP = 12, ROWS = 12, BOARD_H = ROWS * TILE;
  var START_ROW = 11, START_X = 5 * TILE + TILE / 2;
  var BAYS = [1, 3, 5, 7, 9].map(function (c) { return c * TILE + TILE / 2; });   // bay centres (x)

  /* lane definitions: type, direction, speed (px/s) and spacing (px) */
  var LANE_DEFS = {
    1: { type: 'log', dir: 1, v: 14, w: 48, gap: 38 },
    2: { type: 'turtle', dir: -1, v: 19, n: 3, gap: 34, sink: 0.5 },
    3: { type: 'log', dir: 1, v: 25, w: 72, gap: 46 },
    4: { type: 'log', dir: -1, v: 16, w: 36, gap: 36 },
    5: { type: 'turtle', dir: 1, v: 21, n: 2, gap: 28, sink: 0.7 },
    7: { type: 'car', dir: -1, v: 24, w: 16, gap: 48 },
    8: { type: 'truck', dir: 1, v: 17, w: 30, gap: 58 },
    9: { type: 'car', dir: -1, v: 38, w: 16, gap: 78 },
    10: { type: 'car', dir: 1, v: 28, w: 16, gap: 44 }
  };

  /* ---------------------------------------------------------- pixel art */
  function rotCW(rows) {
    var n = rows.length, m = rows[0].length, out = [];
    for (var x = 0; x < m; x++) { var s = ''; for (var y = n - 1; y >= 0; y--) s += rows[y].charAt(x); out.push(s); }
    return out;
  }
  var FROG = [[
    '..ww..ww..', '.wkw..wkw.', '.gggggggg.', 'gg.gllg.gg', 'g..gllg..g',
    '...gggg...', '..gggggg..', '.ggGggGgg.', 'ggg.gg.ggg', 'gg..gg..gg'], [
    '..ww..ww..', '.wkw..wkw.', '.gggggggg.', 'g.gglggg.g', 'g.gggggg.g',
    '..gGggGg..', '..gggggg..', '.gg.gg.gg.', '.g..gg..g.', '.g......g.']];
  var FROG_PAL = { g: '#2bd64a', G: '#0b8f33', l: '#a8ff8a', w: '#fff1e8', k: '#10131c' };
  var CAR = [
    '....bbbbbbbb....', '...bwwwbwwwwb...', '..bbwwwbwwwwbb..', '.bbbbbbbbbbbbbby',
    'rbbbbbbbbbbbbbby', 'rBBBBBBBBBBBBBBB', '.kkkk......kkkk.', '.kwwk......kwwk.', '..kk........kk..'];
  var CAR_COLORS = [['#ff004d', '#a8002f'], ['#ffec27', '#c9a227'], ['#29adff', '#1a6fb0'], ['#ff77a8', '#c24a7a']];
  var TRUCK = (function () {
    var t0 = 'TTTTTTTTTTTTTTTTTTTT', t1 = 'tttttttttttttttttttt', t5 = 'tuuuuuuuuuuuuuuuuuut';
    var cab = ['..cccc...', '.cccwwww.', 'ccccwwwwy', 'ccccccccy', 'ccccccccc', 'cccccccc.', 'ccccccccc'];
    var rows = [
      t0 + '.' + cab[0], t1 + '.' + cab[1], t1 + '.' + cab[2], t1 + 'k' + cab[3],
      t5 + 'k' + cab[4], t1 + 'k' + cab[5], t0 + 'k' + cab[6],
      '..kkkk..kkkk........kkkk...'.padEnd(30, '.'), '...kk....kk..........kk....'.padEnd(30, '.')];
    return rows;
  })();
  var TURTLE = [[
    '....gggg....', '..ggGggGgg..', '.gGggGGggGg.', 'hhgggGGggggg',
    'hhhgGggGgggg', '.hgggggggggg', '..f.gggg.f..', '.f........f.'], [
    '....gggg....', '..ggGggGgg..', '.gGggGGggGg.', 'hhgggGGggggg',
    'hhhgGggGgggg', '.hgggggggggg', '.f..gggg..f.', '..f......f..']];
  var TURTLE_PAL = { g: '#00b552', G: '#00743a', h: '#9bff7a', f: '#7dff7a' };
  var TURTLE_SINK_PAL = { g: '#0b6a6e', G: '#074a52', h: '#4fb59a', f: '#4fb59a' };

  var SPR = { frog: [], car: [], truck: [], turtle: [], turtleSink: [], logs: {} };

  function makeLogSprite(w) {
    if (SPR.logs[w]) return SPR.logs[w];
    var cv = document.createElement('canvas'); cv.width = w; cv.height = 10;
    var g = cv.getContext('2d'), i;
    g.fillStyle = '#6b2f1d'; g.fillRect(1, 0, w - 2, 10); g.fillRect(0, 2, w, 6);
    g.fillStyle = '#ab5236'; g.fillRect(1, 1, w - 2, 8); g.fillRect(0, 2, w, 6);
    g.fillStyle = '#d98a55'; g.fillRect(2, 1, w - 4, 2);
    g.fillStyle = '#7a3b25'; g.fillRect(1, 8, w - 2, 2);
    g.fillStyle = '#8c4329';
    for (i = 0; i < w / 9; i++) { var gx = 6 + ((i * 37 + w * 3) % Math.max(1, w - 14)); g.fillRect(gx, 4 + (i % 3) * 1.5, 5, 1); }
    g.fillStyle = '#e8b27a'; g.fillRect(0, 3, 2, 4); g.fillRect(w - 2, 3, 2, 4);
    g.fillStyle = '#9a5a35'; g.fillRect(0, 4, 1, 2); g.fillRect(w - 1, 4, 1, 2);
    SPR.logs[w] = cv;
    return cv;
  }

  /* ---------------------------------------------------------- state */
  var lanes, homes, frog, stt, stT, hopQ, level, bestRow, timeLeft, timeMax, flyT, tAnim, nextLife, bgCanvas, snake, speedMul, ripple, homeCount, tickSnd, deathKind;

  function laneObjX(lane, o) { var x = ((o.u + lane.off) % lane.L + lane.L) % lane.L; return x - lane.w; }

  function buildLanes() {
    lanes = {};
    Object.keys(LANE_DEFS).forEach(function (k) {
      var d = LANE_DEFS[k], w = d.type === 'turtle' ? d.n * TILE : d.w;
      var gap = d.gap * ((d.type === 'car' || d.type === 'truck') ? Math.max(0.78, 1 - 0.05 * (level - 1)) : 1);
      var period = w + gap, n = Math.ceil((W + w + 14) / period), objs = [];
      for (var i = 0; i < n; i++) objs.push({ u: i * period, col: (i + (+k)) % 4, ph: U.rand(0, 8), sink: d.type === 'turtle' && Math.random() < d.sink });
      lanes[k] = { row: +k, def: d, w: w, L: n * period, off: U.rand(0, period), objs: objs, v: d.v * speedMul * d.dir };
    });
  }

  /* turtle cycle: surface -> warning dip -> submerged -> rising */
  function turtleState(lane, o) {
    if (!o.sink) return 'up';
    var under = 1.2 + 0.1 * Math.min(level, 6), cyc = 4.2 + 0.9 + under + 0.7;
    var ph = (tAnim + o.ph) % cyc;
    if (ph < 4.2) return 'up';
    if (ph < 5.1) return 'warn';
    if (ph < 5.1 + under) return 'down';
    return 'rise';
  }

  function yOf(row) { return TOP + row * TILE; }

  function newFrog() {
    return { x: START_X, y: yOf(START_ROW) + TILE / 2, row: START_ROW, face: 0, hop: null, t: 0, carried: 0 };
  }

  function respawn() {
    frog = newFrog(); hopQ = null; bestRow = START_ROW; stt = 'play';
    timeMax = Math.max(16, 30 - 1.5 * (level - 1)); timeLeft = timeMax; tickSnd = 0;
  }

  function startLevel() {
    speedMul = Math.min(2.1, 1 + 0.12 * (level - 1));
    R.level = level;
    homes = BAYS.map(function () { return { filled: false }; });
    homeCount = 0; flyT = U.rand(5, 8);
    buildLanes();
    snake = level >= 2 ? { x: U.rand(0, W), dir: Math.random() < 0.5 ? 1 : -1, v: 20 + level * 2 } : null;
    respawn();
  }

  function checkLife() {
    if (R.score >= nextLife) {
      nextLife += 5000;
      if (R.lives < 6) { R.lives++; R.sfx.play('powerup'); R.fx.text(W / 2, H / 2, '1UP!', C.lime); }
    }
    if (R.score >= 3000) R.achieve('score3000');
  }

  /* ---------------------------------------------------------- hopping */
  function tryHop(btn) {
    var f = frog;
    var tx = f.x, ty = f.row, face = f.face;
    if (btn === 'up') { ty = f.row - 1; face = 0; }
    else if (btn === 'down') { ty = f.row + 1; face = 2; }
    else if (btn === 'left') { tx = f.x - TILE; face = 3; }
    else if (btn === 'right') { tx = f.x + TILE; face = 1; }
    else return false;
    f.face = face;
    if (ty > START_ROW) return false;
    if (tx < TILE / 2 - 1 || tx > W - TILE / 2 + 1) { R.sfx.tone(120, 0.05, { type: 'square', vol: 0.06 }); return false; }
    if (ty === 0) {
      // only the bays are open; hedges block the way
      var bi = -1, i;
      for (i = 0; i < BAYS.length; i++) if (Math.abs(f.x - BAYS[i]) <= 6) bi = i;
      if (bi < 0 || homes[bi].filled) { R.sfx.tone(140, 0.08, { type: 'square', vol: 0.08, slide: 90 }); R.fx.shake(1, 0.08); return false; }
      tx = BAYS[bi];
    }
    f.hop = { t: 0, fx: f.x, fy: f.y, tx: tx, ty: yOf(ty) + TILE / 2, row: ty };
    R.sfx.tone(ty < f.row ? 480 : 340, 0.07, { type: 'square', vol: 0.06, slide: ty < f.row ? 880 : 520 });
    return true;
  }

  function land() {
    var f = frog, h = f.hop;
    f.x = h.tx; f.y = h.ty; f.row = h.row; f.hop = null;
    if (f.row < bestRow && f.row >= 1) { R.addScore(10); bestRow = f.row; checkLife(); }
    if (f.row === 0) { reachHome(); return; }
    if (hopQ) { var q = hopQ; hopQ = null; tryHop(q); }
  }

  function reachHome() {
    var bi = 0, i;
    for (i = 0; i < BAYS.length; i++) if (Math.abs(frog.x - BAYS[i]) < 2) bi = i;
    var hm = homes[bi];
    hm.filled = true; homeCount++;
    var pts = 50 + Math.round(timeLeft) * 2;
    R.addScore(pts);
    R.fx.text(BAYS[bi], yOf(0) + 14, '' + pts, C.yellow);
    R.fx.burst(BAYS[bi], yOf(0) + 6, { n: 14, color: ['#2bd64a', '#fff1e8', '#ffec27', '#a8ff8a'], speed: 60, life: 0.6, size: 2, gravity: 60 });
    R.sfx.play('coin'); R.vibrate(25);
    R.achieve('first-home');
    if (hm.fly) {
      hm.fly = 0; R.addScore(200); R.fx.text(BAYS[bi], yOf(0) + 26, 'FLY +200', C.pink);
      R.sfx.play('powerup'); R.achieve('fly');
    }
    checkLife();
    if (homeCount >= homes.length) {
      stt = 'clear'; stT = 2.3;
      R.addScore(1000); checkLife();
      R.sfx.play('win'); R.fx.flash(C.white, 0.15); R.achieve('level-clear');
    } else { stt = 'home'; stT = 0.6; }
  }

  function killFrog(kind) {
    if (stt !== 'play') return;
    stt = 'dying'; stT = 1.15; deathKind = kind;
    frog.hop = null; hopQ = null;
    R.lives = Math.max(0, R.lives - 1);
    var x = frog.x, y = frog.y;
    if (kind === 'drown') {
      R.fx.burst(x, y, { n: 16, color: ['#29adff', '#8fd8ff', '#fff1e8'], speed: 70, life: 0.7, size: 2, gravity: 90 });
      R.sfx.noise(0.35, { vol: 0.2, freq: 1400, sweep: 250 }); R.sfx.tone(420, 0.35, { type: 'sine', vol: 0.1, slide: 90 });
      R.vibrate(45);
    } else {
      R.fx.burst(x, y, { n: 16, color: ['#2bd64a', '#ff004d', '#fff1e8', '#a8ff8a'], speed: 80, life: 0.7, size: 2, gravity: 80 });
      R.sfx.play('hit'); R.vibrate(80); R.fx.shake(2, 0.2);
    }
  }

  /* ---------------------------------------------------------- update */
  function updateWorld(dt) {
    var k, lane;
    for (k in lanes) { lane = lanes[k]; lane.off += lane.v * dt; if (lane.off > 1e6) lane.off %= lane.L; }
    if (snake) { snake.x += snake.dir * snake.v * dt; if (snake.x < -24) snake.x = W + 24; else if (snake.x > W + 24) snake.x = -24; }
    ripple += dt;
  }

  function updateFrog(dt) {
    var f = frog, lane, i, o, ox, fx0, fx1;
    if (f.hop) {
      f.hop.t += dt / 0.11;
      var t = Math.min(1, f.hop.t);
      f.x = f.hop.fx + (f.hop.tx - f.hop.fx) * t; f.y = f.hop.fy + (f.hop.ty - f.hop.fy) * t;
      if (f.hop.t >= 1) { land(); if (stt !== 'play') return; }
      else return;
    }
    if (!f.hop && hopQ) { var q = hopQ; hopQ = null; tryHop(q); if (f.hop) return; }
    if (!f.hop) {
      fx0 = f.x - 4; fx1 = f.x + 4;
      if (f.row >= 7 && f.row <= 10) {
        lane = lanes[f.row];
        for (i = 0; i < lane.objs.length; i++) {
          ox = laneObjX(lane, lane.objs[i]);
          if (fx1 > ox + 1.5 && fx0 < ox + lane.w - 1.5) { killFrog('car'); return; }
        }
      } else if (f.row >= 1 && f.row <= 5) {
        lane = lanes[f.row];
        var ride = false;
        for (i = 0; i < lane.objs.length; i++) {
          o = lane.objs[i]; ox = laneObjX(lane, o);
          if (f.x > ox + 2 && f.x < ox + lane.w - 2) {
            if (lane.def.type === 'turtle' && turtleState(lane, o) === 'down') continue;
            ride = true; break;
          }
        }
        if (!ride) { killFrog('drown'); return; }
        f.x += lane.v * dt;
        if (f.x < 1 || f.x > W - 1) { killFrog('drown'); return; }
      } else if (f.row === 6 && snake) {
        if (fx1 > snake.x - 8 && fx0 < snake.x + 8) { killFrog('car'); return; }
      }
    }
  }

  R.game({
    layout: 'full', size: [W, H], bg: '#05070f', music: 'puzzle',

    init: function () {
      SPR.frog = [0, 1, 2, 3].map(function (d) {
        return FROG.map(function (rows) {
          var r2 = rows, n = d; while (n-- > 0) r2 = rotCW(r2);
          return R.sprite(r2, FROG_PAL);
        });
      });
      SPR.car = CAR_COLORS.map(function (c) { return R.sprite(CAR, { b: c[0], B: c[1], w: '#bfe9ff', k: '#10131c', y: '#ffec27', r: '#ff004d' }); });
      SPR.truck = CAR_COLORS.map(function (c) { return R.sprite(TRUCK, { t: '#e4e6ec', T: '#aeb2bd', u: c[0], c: c[0], w: '#bfe9ff', k: '#10131c', y: '#ffec27' }); });
      SPR.turtle = TURTLE.map(function (rows) { return R.sprite(rows, TURTLE_PAL); });
      SPR.turtleSink = TURTLE.map(function (rows) { return R.sprite(rows, TURTLE_SINK_PAL); });
      bgCanvas = buildBackground();
    },

    reset: function () {
      level = 1; nextLife = 5000; tAnim = 0; ripple = 0;
      R.lives = 3; R.level = 1;
      startLevel();
    },

    onPress: function (btn) {
      if (stt !== 'play' || !frog) return;
      if (btn !== 'up' && btn !== 'down' && btn !== 'left' && btn !== 'right') return;
      if (frog.hop) { hopQ = btn; return; }
      tryHop(btn);
    },

    update: function (dt) {
      tAnim += dt;
      updateWorld(dt);
      // fly in a random free bay
      if (stt === 'play' || stt === 'home') {
        flyT -= dt;
        if (flyT <= 0) {
          var free = [];
          homes.forEach(function (h, i) { if (!h.filled) free.push(i); });
          homes.forEach(function (h) { h.fly = 0; });
          if (free.length) { homes[U.pick(free)].fly = 5.5; }
          flyT = U.rand(9, 14);
        }
        homes.forEach(function (h) { if (h.fly > 0) { h.fly -= dt; if (h.fly <= 0) h.fly = 0; } });
      }
      if (stt === 'play') {
        timeLeft -= dt;
        if (timeLeft < 6 && timeLeft > 0) { tickSnd -= dt; if (tickSnd <= 0) { tickSnd = 1; R.sfx.play('tick'); } }
        if (timeLeft <= 0) { killFrog('time'); return; }
        updateFrog(dt);
      } else if (stt === 'dying') {
        stT -= dt;
        if (stT <= 0) { if (R.lives <= 0) { R.gameOver(); return; } respawn(); }
      } else if (stt === 'home') {
        stT -= dt; if (stT <= 0) respawn();
      } else if (stt === 'clear') {
        stT -= dt;
        if (stT <= 0) { level++; startLevel(); R.sfx.play('start'); }
      }
    },

    render: function (ctx) {
      var i, k, lane, o, x, y;
      ctx.drawImage(bgCanvas, 0, TOP);

      // water ripples
      for (i = 0; i < 5; i++) {
        var ry = yOf(1 + i);
        ctx.fillStyle = 'rgba(143,216,255,.28)';
        for (k = 0; k < 4; k++) {
          var rx = ((k * 41 + i * 17 + ripple * (i % 2 ? 9 : -9)) % W + W) % W;
          ctx.fillRect(Math.round(rx), ry + 2 + ((k + i) % 3) * 3, 6, 1);
        }
      }

      // bays: flies and homed frogs
      for (i = 0; i < homes.length; i++) {
        var hm = homes[i], bx = BAYS[i];
        if (hm.filled) R.draw.sprite(ctx, SPR.frog[0][0], bx - 5, yOf(0) + 1);
        else if (hm.fly > 0 && (hm.fly > 1.5 || Math.floor(tAnim / 0.1) % 2)) drawFly(ctx, bx, yOf(0) + 6 + Math.round(Math.sin(tAnim * 5 + i)));
      }

      // river objects
      for (k = 1; k <= 5; k++) {
        lane = lanes[k];
        for (i = 0; i < lane.objs.length; i++) {
          o = lane.objs[i]; x = laneObjX(lane, o);
          if (x > W || x + lane.w < 0) continue;
          y = yOf(k) + 1;
          if (lane.def.type === 'log') ctx.drawImage(makeLogSprite(lane.w), Math.round(x), y);
          else drawTurtles(ctx, lane, o, Math.round(x), y);
        }
      }

      // snake on the median
      if (snake) drawSnake(ctx);

      // road vehicles
      for (k = 7; k <= 10; k++) {
        lane = lanes[k];
        for (i = 0; i < lane.objs.length; i++) {
          o = lane.objs[i]; x = laneObjX(lane, o);
          if (x > W || x + lane.w < 0) continue;
          var spr = lane.def.type === 'truck' ? SPR.truck[o.col] : SPR.car[o.col];
          R.draw.sprite(ctx, spr, Math.round(x), yOf(k) + 2, { flipX: lane.def.dir < 0 });
        }
      }

      drawFrog(ctx);

      // banners
      if (R.mode === 'play' && stt === 'clear') R.draw.text(ctx, 'LEVEL CLEAR!', W / 2, yOf(5) + 2, { size: 8, color: C.yellow, align: 'center', shadow: '#000' });
      if (R.mode === 'play' && stt === 'dying' && deathKind === 'time') R.draw.text(ctx, 'TIME UP', W / 2, yOf(5) + 2, { size: 8, color: C.red, align: 'center', shadow: '#000' });

      // time bar
      var fr = U.clamp(timeLeft / timeMax, 0, 1);
      R.draw.text(ctx, 'TIME', 3, H - 8, { size: 6, color: '#8fb5ff' });
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(30, H - 8, 70, 5);
      ctx.fillStyle = fr > 0.5 ? '#00e436' : fr > 0.25 ? '#ffec27' : (Math.floor(tAnim / 0.15) % 2 ? '#ff004d' : '#ff9a9a');
      ctx.fillRect(30, H - 8, Math.round(70 * fr), 5);
      R.draw.text(ctx, 'LV' + level, W - 3, H - 8, { size: 6, color: '#8fb5ff', align: 'right' });
      R.draw.topBar(ctx);
    }
  });

  /* ---------------------------------------------------------- drawing helpers */
  function buildBackground() {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = BOARD_H;
    var g = cv.getContext('2d'), r, x;
    // water (rows 0..5) and bays
    for (r = 0; r <= 5; r++) { g.fillStyle = r % 2 ? '#1a3fc4' : '#1d47d4'; g.fillRect(0, r * TILE, W, TILE); }
    // hedge row
    for (x = 0; x < COLS; x++) {
      if (x % 2 === 1) {
        g.fillStyle = '#0c2a8a'; g.fillRect(x * TILE, 0, TILE, TILE);
        g.fillStyle = '#00b552'; g.fillRect(x * TILE + 2, 6, 8, 4); g.fillRect(x * TILE + 3, 5, 6, 6);   // lily pad
        g.fillStyle = '#0c2a8a'; g.fillRect(x * TILE + 6, 5, 3, 3);
        g.fillStyle = '#7dff7a'; g.fillRect(x * TILE + 3, 6, 2, 1);
      } else {
        g.fillStyle = '#0a5a2a'; g.fillRect(x * TILE, 0, TILE, TILE);
        g.fillStyle = '#12873d'; g.fillRect(x * TILE + 1, 1, TILE - 2, TILE - 3);
        g.fillStyle = '#25c25a';
        g.fillRect(x * TILE + 2, 2, 3, 2); g.fillRect(x * TILE + 7, 4, 3, 2); g.fillRect(x * TILE + 3, 7, 3, 2); g.fillRect(x * TILE + 8, 8, 2, 1);
        g.fillStyle = '#073d1c'; g.fillRect(x * TILE, TILE - 2, TILE, 2);
      }
    }
    // median grass
    g.fillStyle = '#12873d'; g.fillRect(0, 6 * TILE, W, TILE);
    g.fillStyle = '#0a5a2a'; g.fillRect(0, 6 * TILE, W, 1); g.fillRect(0, 6 * TILE + TILE - 1, W, 1);
    g.fillStyle = '#25c25a';
    for (x = 0; x < W; x += 6) g.fillRect(x + ((x / 6) % 2) * 2, 6 * TILE + 3 + ((x / 6) % 3) * 2, 2, 1);
    // road
    for (r = 7; r <= 10; r++) { g.fillStyle = r % 2 ? '#2b2f3a' : '#343845'; g.fillRect(0, r * TILE, W, TILE); }
    g.fillStyle = '#c9a227'; g.fillRect(0, 7 * TILE, W, 1); g.fillRect(0, 11 * TILE - 1, W, 1);
    g.fillStyle = '#8a90a0';
    for (r = 8; r <= 10; r++) for (x = 3; x < W; x += 14) g.fillRect(x, r * TILE, 7, 1);
    // start strip
    g.fillStyle = '#12873d'; g.fillRect(0, 11 * TILE, W, TILE);
    g.fillStyle = '#0a5a2a'; g.fillRect(0, 11 * TILE + TILE - 1, W, 1);
    g.fillStyle = '#25c25a';
    for (x = 2; x < W; x += 6) g.fillRect(x, 11 * TILE + 3 + ((x / 6) % 3) * 2, 2, 1);
    var fl = ['#ff77a8', '#ffec27', '#fff1e8'];
    for (x = 0; x < 9; x++) { g.fillStyle = fl[x % 3]; g.fillRect(6 + x * 15, 11 * TILE + 2 + (x % 2) * 5, 2, 2); }
    return cv;
  }

  function drawTurtles(ctx, lane, o, x, y) {
    var st = turtleState(lane, o), n = lane.def.n, i;
    var frame = Math.floor((tAnim + o.ph) / 0.45) % 2;
    var left = lane.def.dir < 0;
    for (i = 0; i < n; i++) {
      var tx = x + i * TILE, ty = y;
      if (st === 'down') {
        ctx.fillStyle = 'rgba(143,216,255,.45)';
        ctx.fillRect(tx + 3 + (Math.floor(tAnim * 6 + i) % 3), ty + 5, 2, 1); ctx.fillRect(tx + 7, ty + 3 + (Math.floor(tAnim * 5 + i) % 3), 1, 1);
        continue;
      }
      var dark = st === 'warn' && Math.floor(tAnim / 0.12) % 2;
      R.draw.sprite(ctx, dark ? SPR.turtleSink[frame] : SPR.turtle[frame], tx, ty + (st === 'warn' ? 1 : st === 'rise' ? 2 : 0), { flipX: !left, alpha: st === 'rise' ? 0.75 : undefined });
    }
  }

  function drawFly(ctx, x, y) {
    ctx.fillStyle = '#10131c'; ctx.fillRect(x - 1, y - 1, 2, 3);
    ctx.fillStyle = Math.floor(tAnim / 0.06) % 2 ? '#fff1e8' : '#bfe9ff';
    ctx.fillRect(x - 4, y - 3, 3, 2); ctx.fillRect(x + 1, y - 3, 3, 2);
    ctx.fillStyle = '#ff004d'; ctx.fillRect(x, y - 1, 1, 1);
  }

  function drawSnake(ctx) {
    var s = snake, y0 = yOf(6) + TILE / 2, i;
    for (i = 0; i < 9; i++) {
      var sx = s.x - s.dir * i * 2.2, sy = y0 + Math.sin(tAnim * 9 - i * 0.9) * 2;
      ctx.fillStyle = i % 2 ? '#ffec27' : '#7dff7a'; if (i === 8) ctx.fillStyle = '#00a845';
      ctx.fillRect(Math.round(sx - 1), Math.round(sy - 1.5), 3, 3);
    }
    var hx = s.x + s.dir * 2, hy = y0 + Math.sin(tAnim * 9 + 0.9) * 2;
    ctx.fillStyle = '#c6ff4a'; ctx.fillRect(Math.round(hx - 2), Math.round(hy - 2), 5, 4);
    ctx.fillStyle = '#10131c'; ctx.fillRect(Math.round(hx + (s.dir > 0 ? 1 : -2)), Math.round(hy - 1), 1, 1);
    if (Math.floor(tAnim / 0.25) % 2) { ctx.fillStyle = '#ff004d'; ctx.fillRect(Math.round(hx + s.dir * 3 - (s.dir < 0 ? 1 : 0)), Math.round(hy), 2, 1); }
  }

  function drawFrog(ctx) {
    var f = frog;
    if (!f) return;
    var x = Math.round(f.x), y = Math.round(f.y);
    if (stt === 'dying') {
      var t = 1.15 - stT;
      if (deathKind === 'drown') {
        for (var r = 0; r < 3; r++) {
          var rt = t - r * 0.18; if (rt <= 0 || rt > 0.7) continue;
          ctx.strokeStyle = 'rgba(200,235,255,' + (1 - rt / 0.7).toFixed(2) + ')'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y + 1, 2 + rt * 14, 0, Math.PI * 2); ctx.stroke();
        }
        if (t < 0.25) { ctx.globalAlpha = 1 - t / 0.25; R.draw.sprite(ctx, SPR.frog[f.face][0], x - 5, y - 5); ctx.globalAlpha = 1; }
      } else {
        // squashed flat
        ctx.save(); ctx.translate(x, y + 2);
        ctx.fillStyle = '#2bd64a'; ctx.fillRect(-5, -2, 10, 4);
        ctx.fillStyle = '#0b8f33'; ctx.fillRect(-4, 0, 8, 1);
        ctx.fillStyle = '#ff004d'; ctx.fillRect(-6, -1, 1, 2); ctx.fillRect(5, -1, 1, 2); ctx.fillRect(-2, 2, 4, 1);
        ctx.fillStyle = '#fff1e8'; ctx.fillRect(-3, -2, 1, 1); ctx.fillRect(2, -2, 1, 1);
        ctx.restore();
        if (Math.floor(t / 0.1) % 2 === 0 && t < 0.6) { ctx.fillStyle = '#ffec27'; ctx.fillRect(x - 7, y - 4, 1, 1); ctx.fillRect(x + 6, y - 5, 1, 1); ctx.fillRect(x, y - 7, 1, 1); }
      }
      return;
    }
    if (stt === 'home' || stt === 'clear') return;
    var lift = 0, frame = 0;
    if (f.hop) { var p = Math.min(1, f.hop.t); lift = Math.sin(p * Math.PI) * 3; frame = 1; }
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x - 4, y + 3, 8, 2);
    R.draw.sprite(ctx, SPR.frog[f.face][frame], x - 5, Math.round(y - 5 - lift));
  }
})();
