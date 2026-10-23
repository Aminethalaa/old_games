/* Rock Blaster — neon asteroids, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 272, H = 328, TAU = Math.PI * 2;
  var SIZES = [{ r: 22, pts: 20, n: 11 }, { r: 12, pts: 50, n: 9 }, { r: 6.5, pts: 100, n: 8 }];
  var NEON = ['#3de2ff', '#7dff7a', '#ff77a8', '#ffa300', '#b455ff', '#ffec27'];
  var SHIP = [[0, -10.5], [7.5, 8], [0, 4], [-7.5, 8]];
  var SAUCER = [[-10, 1.5], [-6, -2.5], [-3, -6], [3, -6], [6, -2.5], [10, 1.5], [6, 5], [-6, 5]];
  var HYPER_CD = 6;

  var ship, rocks, bullets, ebullets, saucer, parts, debris, rings, stars;
  var wave, waveState, waveDelay, bannerT, saucerT, nextLife, tAnim, thrustSnd, humT, speedMul;

  /* ------------------------------------------------------------ helpers */
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function wrap(o) {
    if (o.x < 0) o.x += W; else if (o.x >= W) o.x -= W;
    if (o.y < 0) o.y += H; else if (o.y >= H) o.y -= H;
  }
  /** wrapped distance (shortest way round the torus) */
  function wdist(ax, ay, bx, by) {
    var dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (dx > W / 2) dx = W - dx;
    if (dy > H / 2) dy = H - dy;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function eachWrap(x, y, r, fn) {
    var xs = [0], ys = [0], i, j;
    if (x < r) xs.push(W); else if (x > W - r) xs.push(-W);
    if (y < r) ys.push(H); else if (y > H - r) ys.push(-H);
    for (i = 0; i < xs.length; i++) for (j = 0; j < ys.length; j++) fn(x + xs[i], y + ys[j]);
  }
  function poly(ctx, pts, x, y, ang, sc, col, fill, lw) {
    var c = Math.cos(ang), s = Math.sin(ang), i;
    ctx.beginPath();
    for (i = 0; i < pts.length; i++) {
      var px = pts[i][0] * sc, py = pts[i][1] * sc, rx = x + px * c - py * s, ry = y + px * s + py * c;
      if (i) ctx.lineTo(rx, ry); else ctx.moveTo(rx, ry);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(col, 0.2); ctx.lineWidth = lw * 3.4; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
  }
  function spark(x, y, vx, vy, life, col, size) { parts.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, col: col, size: size || 2 }); if (parts.length > 260) parts.shift(); }
  function ring(x, y, max, col, life) { rings.push({ x: x, y: y, r: 0, max: max, col: col, life: life || 0.4, t: 0 }); }

  /* ------------------------------------------------------------ rocks */
  function makeRock(size, x, y, vx, vy, col) {
    var d = SIZES[size], pts = [], n = d.n;
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU + U.rand(-0.16, 0.16), rr = d.r * U.rand(0.74, 1.1);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return { size: size, x: x, y: y, vx: vx, vy: vy, a: U.rand(0, TAU), va: U.rand(-1.2, 1.2), pts: pts, col: col, r: d.r };
  }

  function spawnWave() {
    waveState = 'play'; bannerT = 1.7;
    speedMul = Math.min(1.7, 1 + 0.06 * (wave - 1));
    R.level = wave;
    var n = Math.min(3 + wave, 9);
    rocks = [];
    for (var i = 0; i < n; i++) {
      var x, y, tries = 0;
      do { x = U.rand(0, W); y = U.rand(0, H); tries++; } while (tries < 40 && wdist(x, y, ship.x, ship.y) < 110);
      var a = U.rand(0, TAU), sp = U.rand(22, 40) * speedMul;
      rocks.push(makeRock(0, x, y, Math.cos(a) * sp, Math.sin(a) * sp, NEON[i % NEON.length]));
    }
    U.shuffle(rocks);
    saucerT = U.rand(11, 17);
  }

  function splitRock(r, hitAngle) {
    if (r.size >= 2) return;
    var a0 = (hitAngle == null ? U.rand(0, TAU) : hitAngle) + U.rand(-0.4, 0.4);
    for (var k = 0; k < 2; k++) {
      var a = a0 + (k ? Math.PI : 0) + U.rand(-0.5, 0.5);
      var sp = (r.size === 0 ? U.rand(38, 62) : U.rand(60, 95)) * speedMul;
      rocks.push(makeRock(r.size + 1, r.x, r.y, r.vx * 0.35 + Math.cos(a) * sp, r.vy * 0.35 + Math.sin(a) * sp, r.col));
    }
  }

  function breakRock(r, award, hitAngle) {
    var d = SIZES[r.size];
    if (award) { R.addScore(d.pts); checkLife(); }
    R.fx.burst(r.x, r.y, { n: [20, 13, 8][r.size], color: [r.col, C.white, r.col], speed: [95, 80, 65][r.size], life: 0.6, size: 2 });
    ring(r.x, r.y, d.r * 1.7, r.col, 0.35);
    if (r.size === 0) { R.sfx.noise(0.38, { vol: 0.26, freq: 1800, sweep: 110 }); R.sfx.tone(80, 0.3, { type: 'sawtooth', vol: 0.1, slide: 35 }); R.fx.shake(1.5, 0.12); R.vibrate(22); }
    else if (r.size === 1) { R.sfx.noise(0.22, { vol: 0.22, freq: 2600, sweep: 200 }); R.vibrate(12); }
    else { R.sfx.noise(0.12, { vol: 0.18, freq: 4000, sweep: 500 }); R.vibrate(7); }
    var idx = rocks.indexOf(r);
    if (idx >= 0) rocks.splice(idx, 1);
    splitRock(r, hitAngle);
    if (R.score >= 5000) R.achieve('score5000');
  }

  function checkLife() {
    if (R.score >= nextLife) {
      nextLife += 10000;
      if (R.lives < 6) { R.lives++; R.sfx.play('powerup'); R.fx.text(W / 2, H / 2 - 30, '1UP!', C.lime); }
    }
  }

  /* ------------------------------------------------------------ ship */
  function newShip() {
    return { x: W / 2, y: H / 2, vx: 0, vy: 0, a: 0, alive: true, invuln: 0, cool: 0, hyperT: 0, hyperCd: 0, deadT: 0, thrust: false };
  }

  function safeToSpawn() {
    for (var i = 0; i < rocks.length; i++) if (wdist(rocks[i].x, rocks[i].y, W / 2, H / 2) < rocks[i].r + 55) return false;
    if (saucer && wdist(saucer.x, saucer.y, W / 2, H / 2) < 70) return false;
    for (i = 0; i < ebullets.length; i++) if (wdist(ebullets[i].x, ebullets[i].y, W / 2, H / 2) < 40) return false;
    return true;
  }

  function killShip() {
    var s = ship;
    if (!s.alive) return;
    s.alive = false; s.deadT = 1.6; R.lives = Math.max(0, R.lives - 1);
    var c = Math.cos(s.a), sn = Math.sin(s.a);
    for (var i = 0; i < SHIP.length; i++) {
      var p0 = SHIP[i], p1 = SHIP[(i + 1) % SHIP.length], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      var wx = s.x + mx * c - my * sn, wy = s.y + mx * sn + my * c, a = U.rand(0, TAU), sp = U.rand(25, 70);
      debris.push({ x: wx, y: wy, vx: s.vx * 0.5 + Math.cos(a) * sp, vy: s.vy * 0.5 + Math.sin(a) * sp, a: U.rand(0, TAU), va: U.rand(-5, 5),
        len: Math.sqrt((p1[0] - p0[0]) * (p1[0] - p0[0]) + (p1[1] - p0[1]) * (p1[1] - p0[1])) / 2, life: 1.5, max: 1.5, col: '#3de2ff' });
    }
    R.fx.burst(s.x, s.y, { n: 24, color: ['#3de2ff', '#fff1e8', '#ffec27', '#ff77a8'], speed: 110, life: 0.9, size: 2 });
    ring(s.x, s.y, 46, '#3de2ff', 0.6);
    R.sfx.play('explode'); R.vibrate(120); R.fx.shake(4, 0.4); R.fx.flash(C.white, 0.14);
  }

  function startHyper() {
    var s = ship;
    s.hyperT = 0.4; s.hyperCd = HYPER_CD; s.invuln = Math.max(s.invuln, 0.5);
    ring(s.x, s.y, 34, '#b455ff', 0.4);
    R.fx.burst(s.x, s.y, { n: 12, color: ['#b455ff', '#fff1e8', '#3de2ff'], speed: 80, life: 0.4, size: 2 });
    R.sfx.tone(180, 0.35, { type: 'triangle', vol: 0.12, slide: 1500 });
    R.vibrate(25);
    R.achieve('warp');
  }
  function finishHyper() {
    var s = ship, best = null, bd = -1e9;
    for (var i = 0; i < 16; i++) {
      var x = U.rand(24, W - 24), y = U.rand(34, H - 24), md = 1e9;
      for (var j = 0; j < rocks.length; j++) md = Math.min(md, wdist(x, y, rocks[j].x, rocks[j].y) - rocks[j].r);
      if (saucer) md = Math.min(md, wdist(x, y, saucer.x, saucer.y) - 30);
      if (md > bd) { bd = md; best = { x: x, y: y }; }
    }
    s.x = best.x; s.y = best.y; s.vx = 0; s.vy = 0; s.invuln = 0.9;
    ring(s.x, s.y, 34, '#3de2ff', 0.4);
    R.fx.burst(s.x, s.y, { n: 12, color: ['#3de2ff', '#fff1e8'], speed: 70, life: 0.4, size: 2 });
    R.sfx.tone(1300, 0.25, { type: 'triangle', vol: 0.1, slide: 300 });
  }

  function fire() {
    var s = ship, dx = Math.sin(s.a), dy = -Math.cos(s.a);
    bullets.push({ x: s.x + dx * 11.5, y: s.y + dy * 11.5, vx: s.vx * 0.4 + dx * 320, vy: s.vy * 0.4 + dy * 320, life: 0.85 });
    s.cool = 0.18;
    R.sfx.tone(920, 0.09, { type: 'square', vol: 0.07, slide: 240 });
  }

  /* ------------------------------------------------------------ saucer */
  function spawnSaucer() {
    var small = (wave >= 3 && Math.random() < 0.5) || (R.score > 6000 && Math.random() < 0.6);
    var dir = Math.random() < 0.5 ? 1 : -1;
    saucer = { x: dir > 0 ? -16 : W + 16, y: U.rand(40, H - 40), vx: dir * (small ? 78 : 52), vy: 0, small: small, fireT: 1.0, wobT: 1, hp: 1 };
    R.sfx.tone(400, 0.2, { type: 'square', vol: 0.06, slide: 700 });
  }

  function killSaucer() {
    var sc = saucer.small ? 0.7 : 1;
    R.addScore(saucer.small ? 1000 : 200); checkLife();
    R.fx.text(saucer.x, saucer.y - 10, saucer.small ? '1000' : '200', C.yellow);
    R.fx.burst(saucer.x, saucer.y, { n: 24, color: ['#ff77a8', '#ffec27', '#fff1e8', '#ff004d'], speed: 110, life: 0.8, size: 2 });
    for (var i = 0; i < SAUCER.length; i++) {
      var p0 = SAUCER[i], p1 = SAUCER[(i + 1) % SAUCER.length], a = U.rand(0, TAU), sp = U.rand(25, 80);
      debris.push({ x: saucer.x + (p0[0] + p1[0]) / 2 * sc, y: saucer.y + (p0[1] + p1[1]) / 2 * sc, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: U.rand(0, TAU), va: U.rand(-5, 5),
        len: 4 * sc, life: 1.1, max: 1.1, col: '#ff77a8' });
    }
    ring(saucer.x, saucer.y, 40, '#ff77a8', 0.45);
    R.sfx.play('explode'); R.sfx.play('coin'); R.vibrate(45); R.fx.shake(2.5, 0.2);
    R.achieve('saucer'); if (R.score >= 5000) R.achieve('score5000');
    saucer = null;
  }

  /* ------------------------------------------------------------ update */
  function updateEffects(dt) {
    var i, o;
    for (i = parts.length - 1; i >= 0; i--) { o = parts[i]; o.life -= dt; if (o.life <= 0) { parts.splice(i, 1); continue; } o.x += o.vx * dt; o.y += o.vy * dt; }
    for (i = debris.length - 1; i >= 0; i--) { o = debris[i]; o.life -= dt; if (o.life <= 0) { debris.splice(i, 1); continue; } o.x += o.vx * dt; o.y += o.vy * dt; o.a += o.va * dt; wrap(o); }
    for (i = rings.length - 1; i >= 0; i--) { o = rings[i]; o.t += dt; if (o.t >= o.life) { rings.splice(i, 1); continue; } o.r = o.max * (o.t / o.life); }
  }

  function updateShip(dt) {
    var s = ship, i, r;
    if (!s.alive) {
      s.deadT -= dt;
      if (s.deadT <= 0) {
        if (R.lives <= 0) { R.gameOver(); return; }
        if (safeToSpawn() || s.deadT < -2.5) { var hc = s.hyperCd; ship = newShip(); ship.invuln = 2.4; ship.hyperCd = Math.max(0, hc - 2); }
      }
      return;
    }
    s.cool -= dt; s.hyperCd -= dt; s.invuln -= dt;
    if (s.hyperT > 0) { s.hyperT -= dt; if (s.hyperT <= 0) finishHyper(); return; }

    s.a += R.input.axisX() * 4.4 * dt;
    s.thrust = !!R.input.held.up;
    if (s.thrust) {
      var dx = Math.sin(s.a), dy = -Math.cos(s.a);
      s.vx += dx * 190 * dt; s.vy += dy * 190 * dt;
      for (i = 0; i < 2; i++) {
        var back = U.rand(70, 130), jit = U.rand(-0.35, 0.35), ca = Math.cos(jit), sa = Math.sin(jit);
        var bx = -dx * ca + dy * sa, by = -dy * ca - dx * sa;
        spark(s.x - dx * 6 + U.rand(-1, 1), s.y - dy * 6 + U.rand(-1, 1), s.vx * 0.3 + bx * back, s.vy * 0.3 + by * back, U.rand(0.2, 0.45), U.pick(['#ffa300', '#ffec27', '#ff4d00', '#fff1e8']), 3);
      }
      thrustSnd -= dt;
      if (thrustSnd <= 0) { thrustSnd = 0.07; R.sfx.noise(0.08, { vol: 0.05, freq: 800, sweep: 250 }); }
    }
    var f = Math.max(0, 1 - 0.5 * dt);
    s.vx *= f; s.vy *= f;
    var sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > 220) { s.vx *= 220 / sp; s.vy *= 220 / sp; }
    s.x += s.vx * dt; s.y += s.vy * dt; wrap(s);

    if ((R.input.pressed('a') || R.input.held.a) && s.cool <= 0 && bullets.length < 4) fire();
    if (R.input.pressed('b') && s.hyperCd <= 0) { startHyper(); return; }

    if (s.invuln <= 0) {
      for (i = 0; i < rocks.length; i++) {
        r = rocks[i];
        if (wdist(s.x, s.y, r.x, r.y) < r.r * 0.85 + 5) { breakRock(r, false, Math.atan2(r.y - s.y, r.x - s.x)); killShip(); return; }
      }
      for (i = 0; i < ebullets.length; i++) {
        if (wdist(s.x, s.y, ebullets[i].x, ebullets[i].y) < 7) { ebullets.splice(i, 1); killShip(); return; }
      }
      if (saucer && wdist(s.x, s.y, saucer.x, saucer.y) < (saucer.small ? 11 : 14)) { killSaucer(); killShip(); return; }
    }
  }

  function updateSaucer(dt) {
    if (!saucer) return;
    var sc = saucer;
    humT -= dt;
    if (humT <= 0) { humT = 0.13; R.sfx.tone(Math.floor(tAnim / 0.13) % 2 ? (sc.small ? 760 : 430) : (sc.small ? 680 : 380), 0.1, { type: 'square', vol: 0.035 }); }
    sc.wobT -= dt;
    if (sc.wobT <= 0) { sc.wobT = U.rand(0.9, 1.7); sc.vy = U.pick([-45, 0, 45]); }
    sc.x += sc.vx * dt; sc.y += sc.vy * dt;
    if (sc.y < 0) sc.y += H; else if (sc.y >= H) sc.y -= H;
    if (sc.x < -22 || sc.x > W + 22) { saucer = null; return; }
    sc.fireT -= dt;
    if (sc.fireT <= 0 && ship.alive && ship.hyperT <= 0) {
      sc.fireT = sc.small ? U.rand(0.9, 1.4) : U.rand(1.3, 2.0);
      var ang = Math.atan2(ship.y - sc.y, ship.x - sc.x);
      ang += sc.small ? U.rand(-1, 1) * Math.max(0.06, 0.28 - wave * 0.025) : U.rand(-0.9, 0.9);
      ebullets.push({ x: sc.x, y: sc.y, vx: Math.cos(ang) * 125, vy: Math.sin(ang) * 125, life: 1.9 });
      R.sfx.tone(340, 0.12, { type: 'sawtooth', vol: 0.07, slide: 120 });
    }
  }

  function updateBullets(dt) {
    var i, j, b, r, hit;
    for (i = bullets.length - 1; i >= 0; i--) {
      b = bullets[i]; b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt; wrap(b);
      hit = false;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }
      for (j = 0; j < rocks.length; j++) {
        r = rocks[j];
        if (wdist(b.x, b.y, r.x, r.y) < r.r * 0.92 + 1.5) { breakRock(r, true, Math.atan2(b.vy, b.vx)); hit = true; break; }
      }
      if (!hit && saucer && wdist(b.x, b.y, saucer.x, saucer.y) < (saucer.small ? 9 : 12)) { killSaucer(); hit = true; }
      if (hit) bullets.splice(i, 1);
    }
    for (i = ebullets.length - 1; i >= 0; i--) {
      b = ebullets[i]; b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt; wrap(b);
      if (b.life <= 0) { ebullets.splice(i, 1); continue; }
      // enemy shots also smash rocks (no score)
      for (j = 0; j < rocks.length; j++) {
        r = rocks[j];
        if (wdist(b.x, b.y, r.x, r.y) < r.r * 0.9) { breakRock(r, false, Math.atan2(b.vy, b.vx)); ebullets.splice(i, 1); break; }
      }
    }
  }

  /* ------------------------------------------------------------ game */
  R.game({
    layout: 'full', size: [W, H], bg: '#070716', music: 'space',

    reset: function () {
      var i;
      stars = [];
      for (i = 0; i < 64; i++) stars.push({ x: U.rand(0, W), y: U.rand(0, H), s: Math.random() < 0.2 ? 2 : 1, ph: U.rand(0, 6) });
      ship = newShip(); rocks = []; bullets = []; ebullets = []; saucer = null; parts = []; debris = []; rings = [];
      wave = 1; waveState = 'play'; waveDelay = 0; nextLife = 10000; tAnim = 0; thrustSnd = 0; humT = 0; speedMul = 1;
      R.lives = 3; R.level = 1;
      spawnWave();
    },

    update: function (dt) {
      var i, r;
      tAnim += dt;
      if (bannerT > 0) bannerT -= dt;
      updateEffects(dt);

      for (i = 0; i < rocks.length; i++) { r = rocks[i]; r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.va * dt; wrap(r); }
      updateShip(dt);
      if (R.mode !== 'play') return;
      updateSaucer(dt);
      updateBullets(dt);

      // saucer visits
      if (waveState === 'play') {
        if (!saucer) { saucerT -= dt; if (saucerT <= 0) { spawnSaucer(); saucerT = Math.max(7, U.rand(15, 25) - wave * 1.2); } }
        if (!rocks.length) {
          waveState = 'clear'; waveDelay = 2.0;
          if (saucer) { R.fx.burst(saucer.x, saucer.y, { n: 10, color: '#ff77a8', speed: 60, life: 0.5 }); saucer = null; }
          ebullets.length = 0;
          R.addScore(100 * wave); checkLife();
          R.fx.text(W / 2, H / 2 - 20, '+' + (100 * wave), C.yellow);
          R.sfx.play('win'); R.achieve('wave1');
          if (R.score >= 5000) R.achieve('score5000');
        }
      } else {
        waveDelay -= dt;
        if (waveDelay <= 0) { wave++; spawnWave(); R.sfx.play('start'); }
      }
    },

    render: function (ctx) {
      var i, o;
      // backdrop
      for (i = 0; i < stars.length; i++) {
        o = stars[i];
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(tAnim * 1.4 + o.ph);
        ctx.fillStyle = o.s > 1 ? '#8fb5ff' : '#cfd8ff'; ctx.fillRect(o.x, o.y, o.s, o.s);
      }
      ctx.globalAlpha = 1;

      // rocks
      for (i = 0; i < rocks.length; i++) {
        o = rocks[i];
        (function (rk) { eachWrap(rk.x, rk.y, rk.r, function (x, y) { poly(ctx, rk.pts, x, y, rk.a, 1, rk.col, rgba(rk.col, 0.1), 1.4); }); })(o);
      }

      // saucer
      if (saucer) {
        var sc = saucer.small ? 0.7 : 1, sx = saucer.x, sy = saucer.y, col = saucer.small ? '#ff004d' : '#ff77a8';
        poly(ctx, SAUCER, sx, sy, 0, sc, col, rgba(col, 0.14), 1.4);
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - 10 * sc, sy + 1.5 * sc); ctx.lineTo(sx + 10 * sc, sy + 1.5 * sc); ctx.stroke();
        ctx.fillStyle = Math.floor(tAnim / 0.12) % 2 ? '#ffec27' : '#fff1e8';
        ctx.fillRect(Math.round(sx - 5 * sc), Math.round(sy + 2.5 * sc), 1.5, 1.5); ctx.fillRect(Math.round(sx), Math.round(sy + 2.5 * sc), 1.5, 1.5); ctx.fillRect(Math.round(sx + 4 * sc), Math.round(sy + 2.5 * sc), 1.5, 1.5);
      }

      // shots
      for (i = 0; i < bullets.length; i++) {
        o = bullets[i];
        ctx.fillStyle = 'rgba(255,236,39,.22)'; ctx.beginPath(); ctx.arc(o.x, o.y, 4.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffec27'; ctx.beginPath(); ctx.arc(o.x, o.y, 2.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff1e8'; ctx.beginPath(); ctx.arc(o.x, o.y, 1.1, 0, TAU); ctx.fill();
      }
      for (i = 0; i < ebullets.length; i++) {
        o = ebullets[i];
        ctx.fillStyle = 'rgba(255,0,77,.25)'; ctx.beginPath(); ctx.arc(o.x, o.y, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = Math.floor(tAnim / 0.08) % 2 ? '#ff004d' : '#ffa300'; ctx.beginPath(); ctx.arc(o.x, o.y, 2.4, 0, TAU); ctx.fill();
      }

      // debris & rings
      for (i = 0; i < debris.length; i++) {
        o = debris[i];
        var da = o.life / o.max, ddx = Math.cos(o.a) * o.len, ddy = Math.sin(o.a) * o.len;
        ctx.strokeStyle = rgba(o.col, da); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(o.x - ddx, o.y - ddy); ctx.lineTo(o.x + ddx, o.y + ddy); ctx.stroke();
      }
      for (i = 0; i < rings.length; i++) {
        o = rings[i];
        ctx.strokeStyle = rgba(o.col, 1 - o.t / o.life); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.stroke();
      }

      // ship
      var s = ship;
      if (s.alive && s.hyperT <= 0 && (s.invuln <= 0 || Math.floor(tAnim / 0.09) % 2 === 0)) {
        eachWrap(s.x, s.y, 12, function (x, y) {
          if (s.thrust) {
            var fl = 5 + Math.random() * 6;
            poly(ctx, [[-3.5, 5.5], [0, 5.5 + fl], [3.5, 5.5]], x, y, s.a, 1, '#ffa300', 'rgba(255,163,0,.35)', 1.2);
          }
          poly(ctx, SHIP, x, y, s.a, 1, '#3de2ff', 'rgba(61,226,255,.16)', 1.5);
          var cx = x + Math.sin(s.a) * -1.5, cy = y - Math.cos(s.a) * -1.5;
          ctx.fillStyle = '#fff1e8'; ctx.fillRect(Math.round(cx - 0.5), Math.round(cy - 0.5), 1.5, 1.5);
        });
      }

      // additive sparks (thrust flame etc.)
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < parts.length; i++) {
        o = parts[i];
        ctx.globalAlpha = Math.max(0, o.life / o.max) * 0.9; ctx.fillStyle = o.col;
        ctx.fillRect(Math.round(o.x - o.size / 2), Math.round(o.y - o.size / 2), o.size, o.size);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

      // wave banner
      if (bannerT > 0 && R.mode === 'play') {
        ctx.globalAlpha = Math.min(1, bannerT * 2);
        R.draw.text(ctx, 'WAVE ' + wave, W / 2, H / 2 - 52, { size: 16, color: '#3de2ff', align: 'center', shadow: '#000' });
        ctx.globalAlpha = 1;
      } else if (waveState === 'clear' && R.mode === 'play') {
        R.draw.text(ctx, 'FIELD CLEAR', W / 2, H / 2 - 52, { size: 16, color: C.lime, align: 'center', shadow: '#000' });
      }

      drawHud(ctx);
    }
  });

  function drawHud(ctx) {
    var i;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, 15);
    R.draw.text(ctx, 'SC ' + U.pad(R.score, 5), 5, 4, { size: 8, color: C.yellow });
    R.draw.text(ctx, 'HI ' + U.pad(R.hud.hi, 5), W - 5, 4, { size: 8, color: C.silver, align: 'right' });
    var n = Math.min(R.lives || 0, 6), x0 = W / 2 - n * 7;
    for (i = 0; i < n; i++) poly(ctx, SHIP, x0 + i * 14 + 7, 8, 0, 0.55, '#3de2ff', null, 1);
    // hyperspace charge
    var cd = ship ? Math.max(0, ship.hyperCd) : 0, ready = cd <= 0;
    R.draw.text(ctx, 'B:WARP', W - 5, H - 17, { size: 6, color: ready ? '#b455ff' : '#5f574f', align: 'right' });
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(W - 45, H - 8, 40, 3);
    ctx.fillStyle = ready ? (Math.floor(tAnim / 0.3) % 2 ? '#b455ff' : '#e6b8ff') : '#7e6ba6'; ctx.fillRect(W - 45, H - 8, Math.round(40 * (1 - cd / HYPER_CD)), 3);
    R.draw.text(ctx, 'WAVE ' + wave, 5, H - 14, { size: 6, color: '#5f7ab5' });
  }
})();
