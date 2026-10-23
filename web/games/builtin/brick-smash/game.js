/* Brick Smash — breakout-style brick buster with power-ups, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 160, H = 320, COLS = 10, BW = 16, BH = 8, BY0 = 30;
  var PY = 292, PH = 7, BR = 3, PW_BASE = 28, PW_WIDE = 46;
  var MAXV = 250, ACC = 1500, FRIC = 1900;
  var MAX_BALLS = 6, MAX_LIVES = 5;
  var RAINBOW = ['#ff004d', '#ff8c1a', '#ffec27', '#00e436', '#3de2ff', '#5b7bff', '#b455ff'];

  /* Wall layouts. '.' empty, '1'..'3' = hit points (colour comes from the row), 'X' = indestructible steel. */
  var LEVELS = [
    { name: 'RAINBOW', rows: [
      '2222222222',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111'] },
    { name: 'DIAMOND', rows: [
      '....11....',
      '...1221...',
      '..122221..',
      '.12233221.',
      '.12233221.',
      '..122221..',
      '...1221...',
      '....11....'] },
    { name: 'CHECKERS', rows: [
      '1212121212',
      '2121212121',
      '1212121212',
      'XX......XX',
      '2121212121',
      '1212121212',
      '2121212121'] },
    { name: 'FORTRESS', rows: [
      'XX......XX',
      'X.222222.X',
      'X.211112.X',
      'X.213312.X',
      'X.211112.X',
      'X.222222.X',
      'XX......XX'] },
    { name: 'INVADER', rows: [
      '..1....1..',
      '...1..1...',
      '..222222..',
      '.22.22.22.',
      '2222222222',
      '2.222222.2',
      '2.2....2.2',
      '...22.22..'] }
  ];

  var POWER = {
    W: { col: '#29adff', label: 'WIDE!' },
    M: { col: '#ffec27', label: 'MULTI!' },
    S: { col: '#00e436', label: 'SLOW!' },
    L: { col: '#ff77a8', label: '1UP!' }
  };

  var shadeCache = {};
  function shade(hex, amt) {
    var key = hex + amt;
    if (shadeCache[key]) return shadeCache[key];
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); }
    return (shadeCache[key] = 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')');
  }

  var lvl, bricks, alive, balls, caps, px, pv, pw, wideT, slowT, phase, clearT, serveT, combo, rampHits, curSp, lifeDropped;
  var enterT, flashT, stars, hitFlash;

  function ping(freq, dur, vol) { R.sfx.tone(freq, dur || 0.05, { vol: vol || 0.1, type: 'square' }); }

  function ballBase() { return 150 + Math.min(110, (lvl - 1) * 9); }
  function targetSpeed() { return ballBase() * (1 + Math.min(0.3, rampHits * 0.012)) * (slowT > 0 ? 0.68 : 1); }

  function buildLevel(l) {
    var def = LEVELS[(l - 1) % LEVELS.length], loop = Math.floor((l - 1) / LEVELS.length), r, c;
    bricks = []; alive = 0;
    for (r = 0; r < def.rows.length; r++) {
      var row = [];
      for (c = 0; c < COLS; c++) {
        var ch = def.rows[r].charAt(c);
        if (ch === '.') row.push(null);
        else if (ch === 'X') row.push({ steel: true, row: r, col: c });
        else {
          var hp = parseInt(ch, 10);
          if (loop > 0 && r < 2 && hp < 3) hp++;          // later rounds: armoured top rows
          row.push({ hp: hp, max: hp, row: r, col: c, flash: 0 }); alive++;
        }
      }
      bricks.push(row);
    }
    R.hud.extra = alive;
  }

  function newBall(stuck) { return { x: px, y: PY - BR, vx: 0, vy: 0, stuck: !!stuck, trail: [] }; }

  function serve() {
    phase = 'serve'; serveT = 0; balls = [newBall(true)]; caps = []; combo = 0; rampHits = 0;
    curSp = targetSpeed();
  }

  function launch() {
    var a = U.clamp(pv / MAXV * 0.5, -0.5, 0.5) + U.rand(-0.14, 0.14);
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i]; if (!b.stuck) continue;
      b.stuck = false; b.vx = Math.sin(a) * curSp; b.vy = -Math.cos(a) * curSp;
    }
    phase = 'play';
    ping(660, 0.06, 0.1); ping(990, 0.08, 0.1);
  }

  /* ---- bricks ---- */
  function brickRect(br) { return { x: br.col * BW, y: BY0 + br.row * BH }; }

  function brickAt(b) {
    var c0 = Math.max(0, Math.floor((b.x - BR) / BW)), c1 = Math.min(COLS - 1, Math.floor((b.x + BR) / BW));
    var r0 = Math.max(0, Math.floor((b.y - BR - BY0) / BH)), r1 = Math.min(bricks.length - 1, Math.floor((b.y + BR - BY0) / BH));
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var br = bricks[r][c]; if (!br) continue;
      var x0 = c * BW, y0 = BY0 + r * BH;
      var dx = b.x - U.clamp(b.x, x0, x0 + BW), dy = b.y - U.clamp(b.y, y0, y0 + BH);
      if (dx * dx + dy * dy < BR * BR) return br;
    }
    return null;
  }

  function hitBrick(br) {
    var p = brickRect(br), cx = p.x + BW / 2, cy = p.y + BH / 2;
    if (br.steel) {
      ping(1500, 0.03, 0.06);
      R.fx.burst(cx, cy, { n: 3, color: [C.white, C.silver], speed: 50, life: 0.25, size: 1 });
      return;
    }
    br.hp--; br.flash = 0.1;
    var col = RAINBOW[br.row % 7];
    if (br.hp > 0) {
      ping(380 + br.hp * 60, 0.05, 0.1);
      R.fx.burst(cx, cy, { n: 4, color: [C.white, col], speed: 55, life: 0.3, size: 1 });
      R.addScore(2);
      return;
    }
    // destroyed
    bricks[br.row][br.col] = null; alive--; combo++;
    var pts = 10 * br.max + 5 * Math.min(combo, 10);
    R.addScore(pts);
    ping(520 + (6 - br.row % 7) * 70, 0.07, 0.12);
    R.vibrate(8);
    R.fx.burst(cx, cy, { n: 10, color: [col, C.white, shade(col, 0.4)], speed: 85, life: 0.55, gravity: 130 });
    if (combo >= 3) R.fx.text(cx, cy - 8, 'x' + combo, combo >= 8 ? C.yellow : C.white);
    if (combo >= 10) R.achieve('combo10');
    R.hud.extra = alive;
    maybeDrop(cx, cy);
    if (alive <= 0) levelClear();
  }

  function maybeDrop(x, y) {
    if (Math.random() > 0.2) return;
    var r = Math.random() * 100, t = r < 32 ? 'W' : r < 60 ? 'M' : r < 90 ? 'S' : 'L';
    if (t === 'L' && (lifeDropped || R.lives >= MAX_LIVES)) t = 'M';
    if (t === 'L') lifeDropped = true;
    caps.push({ x: x, y: y, t: t });
  }

  function applyPower(t) {
    var P = POWER[t];
    R.fx.text(U.clamp(px, 24, W - 24), PY - 14, P.label, P.col);
    R.fx.burst(px, PY, { n: 14, color: [P.col, C.white], speed: 80, life: 0.5, gravity: 40 });
    R.sfx.play('powerup'); R.vibrate(20);
    if (t === 'W') wideT = 15;
    else if (t === 'S') slowT = 10;
    else if (t === 'L') {
      if (R.lives < MAX_LIVES) R.lives++; else R.addScore(300);
    } else if (t === 'M') {
      var src = null, i;
      for (i = 0; i < balls.length; i++) if (!balls[i].stuck) { src = balls[i]; break; }
      if (src) {
        var base = Math.atan2(src.vx, -src.vy), sp = curSp;
        [-0.5, 0.5].forEach(function (d) {
          if (balls.length >= MAX_BALLS) return;
          var a = base + d, nb = newBall(false);
          nb.x = src.x; nb.y = src.y; nb.vx = Math.sin(a) * sp; nb.vy = -Math.cos(a) * sp;
          balls.push(nb);
        });
      }
      if (balls.length >= 3) R.achieve('juggler');
    }
    R.addScore(25);
  }

  function levelClear() {
    phase = 'clear'; clearT = 1.9;
    var bonus = 100 * lvl + 50 * R.lives;
    R.addScore(bonus);
    R.sfx.play('line'); R.sfx.play('win'); R.vibrate(40);
    R.fx.flash(C.white, 0.2); R.fx.shake(2, 0.2);
    R.fx.text(W / 2, 150, 'WALL CLEARED!', C.yellow);
    R.fx.text(W / 2, 166, '+' + bonus, C.white);
    if (lvl === 1) R.achieve('wall-down');
    balls.forEach(function (b) { R.fx.burst(b.x, b.y, { n: 10, color: C.white, speed: 60, life: 0.5 }); });
    balls = []; caps = [];
  }

  function nextLevel() {
    lvl++; R.level = lvl; lifeDropped = false;
    if (lvl >= 6) R.achieve('round2');
    buildLevel(lvl); enterT = 0; wideT = Math.min(wideT, 3); slowT = 0;
    serve();
    R.fx.text(W / 2, 150, 'LEVEL ' + lvl, C.cyan);
  }

  function loseBall() {
    R.sfx.play('hit'); R.vibrate(90); R.fx.shake(4, 0.3); R.fx.flash(C.red, 0.12);
    R.lives--;
    if (R.lives <= 0) { R.gameOver(); return; }
    R.fx.text(W / 2, 200, R.lives + (R.lives === 1 ? ' LIFE LEFT' : ' LIVES LEFT'), C.pink);
    wideT = 0; slowT = 0;
    serve();
  }

  /* ---- per-frame updates ---- */
  function updatePaddle(dt) {
    var ax = R.input.axisX();
    if (ax) {
      var against = (ax > 0 && pv < 0) || (ax < 0 && pv > 0);
      pv += ax * ACC * (against ? 1.8 : 1) * dt;
    } else {
      var fr = FRIC * dt;
      if (Math.abs(pv) <= fr) pv = 0; else pv -= (pv > 0 ? 1 : -1) * fr;
    }
    pv = U.clamp(pv, -MAXV, MAXV);
    pw += U.clamp((wideT > 0 ? PW_WIDE : PW_BASE) - pw, -110 * dt, 110 * dt);
    px += pv * dt;
    var lo = pw / 2, hi = W - pw / 2;
    if (px < lo) { px = lo; pv = 0; } else if (px > hi) { px = hi; pv = 0; }
  }

  function paddleHit(b) {
    var rel = U.clamp((b.x - px) / (pw / 2 + 2), -1, 1);
    var a = U.clamp(rel * 1.08 + pv / MAXV * 0.15 + U.rand(-0.05, 0.05), -1.15, 1.15);
    if (Math.abs(a) < 0.1) a = (Math.random() < 0.5 ? -1 : 1) * 0.1;          // never bounce dead-vertical (avoids endless loops)
    b.vx = Math.sin(a) * curSp; b.vy = -Math.cos(a) * curSp;
    b.y = PY - BR;
    combo = 0; rampHits++; hitFlash = 0.12;
    ping(300 + Math.min(10, rampHits) * 22, 0.06, 0.12);
    R.vibrate(6);
    R.fx.burst(b.x, PY, { n: 4, color: [C.white, C.cyan], speed: 45, life: 0.25, size: 1 });
  }

  function stepBall(b, ds) {
    var ox = b.x, oy = b.y;
    b.x += b.vx * ds;
    if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); ping(200, 0.03, 0.06); }
    else if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx); ping(200, 0.03, 0.06); }
    var hit = brickAt(b);
    if (hit) { b.x = ox; b.vx = -b.vx; hitBrick(hit); }
    var oy2 = b.y;
    b.y += b.vy * ds;
    if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); ping(240, 0.03, 0.06); }
    hit = brickAt(b);
    if (hit) { b.y = oy2; b.vy = -b.vy; hitBrick(hit); }
    if (b.vy > 0 && b.y + BR >= PY && b.y - BR <= PY + PH - 2 && b.x > px - pw / 2 - BR && b.x < px + pw / 2 + BR) paddleHit(b);
  }

  function updateBalls(dt) {
    curSp += (targetSpeed() - curSp) * Math.min(1, dt * 5);
    for (var i = balls.length - 1; i >= 0; i--) {
      var b = balls[i];
      if (b.stuck) { b.x = px; b.y = PY - BR; continue; }
      var m = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
      b.vx *= curSp / m; b.vy *= curSp / m;
      if (Math.abs(b.vy) < curSp * 0.22) b.vy = (b.vy < 0 ? -1 : 1) * curSp * 0.22;    // never glide horizontally for ever
      var n = Math.max(1, Math.ceil(curSp * dt / 1.5));
      for (var k = 0; k < n && phase === 'play'; k++) stepBall(b, dt / n);
      if (phase !== 'play') return;
      b.trail.push(b.x, b.y); if (b.trail.length > 14) b.trail.splice(0, 2);
      if (b.y > H + 8) balls.splice(i, 1);
    }
    if (phase === 'play' && balls.length === 0) loseBall();
  }

  function updateCaps(dt) {
    for (var i = caps.length - 1; i >= 0; i--) {
      var c = caps[i]; c.y += 62 * dt;
      if (c.y + 4 >= PY && c.y - 4 <= PY + PH && c.x > px - pw / 2 - 8 && c.x < px + pw / 2 + 8) { caps.splice(i, 1); applyPower(c.t); continue; }
      if (c.y > H + 8) caps.splice(i, 1);
    }
  }

  /* ---- drawing ---- */
  function drawBrick(ctx, br, x, y) {
    var col = br.steel ? '#8e97ad' : RAINBOW[br.row % 7];
    var w = BW - 1, h = BH - 1;
    ctx.fillStyle = shade(col, -0.5); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, w - 1, h - 1);
    ctx.fillStyle = shade(col, 0.5); ctx.fillRect(x, y, w - 1, 1); ctx.fillRect(x, y, 1, h - 1);
    ctx.fillStyle = shade(col, -0.3); ctx.fillRect(x + 1, y + h - 2, w - 2, 1); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
    if (br.steel) {
      ctx.fillStyle = '#4b5368'; ctx.fillRect(x + 2, y + 2, 2, 2); ctx.fillRect(x + w - 5, y + 2, 2, 2);
      ctx.fillStyle = '#d7dcec'; ctx.fillRect(x + 2, y + 2, 1, 1); ctx.fillRect(x + w - 5, y + 2, 1, 1);
      return;
    }
    if (br.hp >= 2) {         // armour plating
      var rim = br.hp >= 3 ? '#ffd23a' : '#e4e8f4', rimD = br.hp >= 3 ? '#b8770a' : '#7f869c';
      ctx.fillStyle = rimD; ctx.fillRect(x, y + h - 2, w, 1); ctx.fillRect(x + w - 2, y, 1, h);
      ctx.fillStyle = rim; ctx.fillRect(x, y, w - 1, 1); ctx.fillRect(x, y, 1, h - 1); ctx.fillRect(x, y + h - 3, w - 1, 1); ctx.fillRect(x + w - 3, y, 1, h - 2);
      if (br.hp >= 3) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x + (w >> 1) - 1, y + 3, 2, 1); }
    } else {
      ctx.fillStyle = shade(col, 0.7); ctx.fillRect(x + 2, y + 2, 3, 1);
    }
    if (br.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillRect(x, y, w, h); }
  }

  function drawBricks(ctx) {
    var shine = (R.time * 80) % 320, r, c;
    for (r = 0; r < bricks.length; r++) for (c = 0; c < COLS; c++) {
      var br = bricks[r][c]; if (!br) continue;
      var x = c * BW, y = BY0 + r * BH;
      if (enterT < 2) {
        var t = U.clamp((enterT - r * 0.06 - c * 0.012) / 0.35, 0, 1);
        if (t <= 0) continue;
        y -= (1 - t) * (1 - t) * 60;
      }
      drawBrick(ctx, br, x, y);
      var d = (x + y) - shine;
      if (d > 0 && d < 7 && !br.steel) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 1, y + 1, 4, BH - 3); }
    }
  }

  function drawPaddle(ctx) {
    var x = Math.round(px - pw / 2), w = Math.round(pw), y = PY;
    var accent = wideT > 0 ? '#29adff' : '#ff77a8';
    if (wideT > 0 && wideT < 3 && Math.floor(R.time * 8) % 2) accent = '#ffffff';
    ctx.fillStyle = shade(accent, -0.2); ctx.globalAlpha = 0.35; ctx.fillRect(x + 2, y + PH + 1, w - 4, 2); ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a3550'; ctx.fillRect(x, y + 2, w, PH - 2);
    ctx.fillStyle = '#c7d2ea'; ctx.fillRect(x + 4, y, w - 8, PH - 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, y, w - 8, 1);
    ctx.fillStyle = '#7f8ba8'; ctx.fillRect(x + 4, y + PH - 3, w - 8, 1);
    ctx.fillStyle = accent; ctx.fillRect(x, y + 1, 5, PH - 1); ctx.fillRect(x + w - 5, y + 1, 5, PH - 1);
    ctx.fillStyle = shade(accent, 0.5); ctx.fillRect(x, y + 1, 5, 1); ctx.fillRect(x + w - 5, y + 1, 5, 1);
    ctx.fillStyle = shade(accent, -0.4); ctx.fillRect(x + 1, y + PH, 4, 1); ctx.fillRect(x + w - 5, y + PH, 4, 1);
    if (hitFlash > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x, y, w, PH); }
  }

  function drawBall(ctx, b) {
    var i, n = b.trail.length / 2;
    for (i = 0; i < n; i++) {
      var a = (i + 1) / (n + 1);
      ctx.globalAlpha = a * 0.45; ctx.fillStyle = slowT > 0 ? '#00e436' : '#3de2ff';
      var s = 1 + a * 3;
      ctx.fillRect(Math.round(b.trail[i * 2] - s / 2), Math.round(b.trail[i * 2 + 1] - s / 2), Math.round(s), Math.round(s));
    }
    ctx.globalAlpha = 1;
    R.draw.circle(ctx, b.x, b.y, BR + 1, 'rgba(255,255,255,.25)');
    R.draw.circle(ctx, b.x, b.y, BR, '#ffffff');
    ctx.fillStyle = '#9fd8ff'; ctx.fillRect(Math.round(b.x), Math.round(b.y) + 1, 2, 1);
  }

  function drawCap(ctx, c) {
    var P = POWER[c.t], x = Math.round(c.x - 9), y = Math.round(c.y - 4);
    ctx.fillStyle = shade(P.col, -0.5); ctx.fillRect(x, y + 1, 18, 8); ctx.fillRect(x + 1, y, 16, 10);
    ctx.fillStyle = P.col; ctx.fillRect(x + 1, y + 1, 16, 8); ctx.fillRect(x + 2, y, 14, 10);
    ctx.fillStyle = shade(P.col, 0.55); ctx.fillRect(x + 2, y + 1, 14, 1);
    R.draw.text(ctx, c.t, x + 9, y + 2, { size: 6, color: '#10131c', align: 'center' });
    if (Math.floor(R.time * 10) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 15, y + 1, 1, 1); }
  }

  function drawHudStrip(ctx) {
    var def = LEVELS[(lvl - 1) % LEVELS.length];
    R.draw.text(ctx, def.name, 4, 5, { size: 6, color: 'rgba(255,255,255,.35)' });
    var x = W - 4;
    if (wideT > 0) { drawChip(ctx, x, 'W', POWER.W.col, wideT / 15); x -= 20; }
    if (slowT > 0) { drawChip(ctx, x, 'S', POWER.S.col, slowT / 10); }
  }
  function drawChip(ctx, right, ch, col, frac) {
    var x = right - 16;
    ctx.fillStyle = col; ctx.fillRect(x, 3, 16, 8);
    R.draw.text(ctx, ch, x + 8, 4, { size: 6, color: '#10131c', align: 'center' });
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x, 13, 16, 2);
    ctx.fillStyle = col; ctx.fillRect(x, 13, Math.round(16 * frac), 2);
  }

  R.game({
    layout: 'classic', size: [W, H], bg: '#0a0a24', music: 'adventure',

    init: function () {
      stars = [];
      for (var i = 0; i < 46; i++) stars.push({ x: U.rand(0, W), y: U.rand(0, H), s: U.rand(0.3, 1), a: U.rand(0.15, 0.5) });
    },

    reset: function () {
      lvl = 1; px = W / 2; pv = 0; pw = PW_BASE; wideT = 0; slowT = 0; lifeDropped = false; hitFlash = 0; enterT = 9; clearT = 0;
      R.level = 1; R.lives = 3; R.hud.extraLabel = 'BRICKS';
      buildLevel(1);
      serve();
    },

    update: function (dt) {
      var i;
      enterT += dt; hitFlash -= dt;
      for (i = 0; i < stars.length; i++) { stars[i].y += stars[i].s * 14 * dt; if (stars[i].y > H) stars[i].y -= H; }
      for (var r = 0; r < bricks.length; r++) for (var c = 0; c < COLS; c++) { var br = bricks[r][c]; if (br && br.flash > 0) br.flash -= dt; }
      if (wideT > 0) wideT -= dt;
      if (slowT > 0) slowT -= dt;
      updatePaddle(dt);
      if (phase === 'serve') {
        serveT += dt;
        for (i = 0; i < balls.length; i++) { balls[i].x = px; balls[i].y = PY - BR; }
        if (R.input.pressed('a') || R.input.pressed('up')) launch();
        updateCaps(dt);
      } else if (phase === 'play') {
        updateBalls(dt);
        if (phase === 'play') updateCaps(dt);
      } else if (phase === 'clear') {
        clearT -= dt;
        if (clearT <= 0) nextLevel();
      }
    },

    render: function (ctx) {
      var i, g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#190b3a'); g.addColorStop(0.55, '#0a0a24'); g.addColorStop(1, '#050a1c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (i = 0; i < stars.length; i++) { ctx.globalAlpha = stars[i].a; ctx.fillStyle = '#cfe0ff'; ctx.fillRect(Math.round(stars[i].x), Math.round(stars[i].y), stars[i].s > 0.7 ? 2 : 1, stars[i].s > 0.7 ? 2 : 1); }
      ctx.globalAlpha = 1;
      // faint lane markers under the paddle
      ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(0, PY + PH + 4, W, 1);
      drawHudStrip(ctx);
      drawBricks(ctx);
      for (i = 0; i < caps.length; i++) drawCap(ctx, caps[i]);
      drawPaddle(ctx);
      for (i = 0; i < balls.length; i++) drawBall(ctx, balls[i]);
      if (phase === 'serve') {
        // aim guide + prompt
        var bx = balls.length ? balls[0].x : px;
        for (i = 1; i <= 4; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.5 - i * 0.1) + ')'; ctx.fillRect(Math.round(bx - 1), PY - 6 - i * 9, 2, 3); }
        if (Math.floor(serveT * 2.5) % 2 === 0) R.draw.text(ctx, 'PRESS A', W / 2, PY - 56, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
      }
    },

    serialize: function () {
      return {
        lvl: lvl,
        hp: bricks.map(function (row) { return row.map(function (b) { return !b ? 0 : b.steel ? -1 : b.hp; }); }),
        balls: balls.map(function (b) { return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, stuck: b.stuck }; }),
        caps: caps, px: px, pw: pw, wideT: wideT, slowT: slowT, phase: phase, clearT: clearT, combo: combo,
        rampHits: rampHits, lifeDropped: lifeDropped, curSp: curSp
      };
    },
    restore: function (s) {
      lvl = s.lvl; buildLevel(lvl);
      alive = 0;
      for (var r = 0; r < bricks.length; r++) for (var c = 0; c < COLS; c++) {
        var v = s.hp[r][c], br = bricks[r][c];
        if (!br || br.steel) continue;
        if (v <= 0) bricks[r][c] = null; else { br.hp = v; alive++; }
      }
      balls = s.balls.map(function (b) { return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, stuck: b.stuck, trail: [] }; });
      caps = s.caps || []; px = s.px; pw = s.pw; pv = 0; wideT = s.wideT; slowT = s.slowT; phase = s.phase; clearT = s.clearT || 0;
      combo = s.combo || 0; rampHits = s.rampHits || 0; lifeDropped = !!s.lifeDropped; curSp = s.curSp || ballBase();
      enterT = 9; serveT = 0; hitFlash = 0;
      R.level = lvl; R.hud.extraLabel = 'BRICKS'; R.hud.extra = alive;
      if (phase === 'serve' && !balls.length) serve();
    }
  });
})();
