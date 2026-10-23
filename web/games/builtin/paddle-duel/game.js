/* Paddle Duel — neon pong against the CPU, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 160, H = 320, BR = 3, PH = 6;
  var PY = 298, CY = 16;                       // paddle top edges (player bottom / cpu top)
  var PW = 32, PW_WIDE = 46;
  var MAXV = 280, ACC = 1800, FRIC = 2200;
  var COL_P = '#3de2ff', COL_C = '#ff3df2', COL_S = '#ffec27';
  var MAX_SPEED = 340;

  var px, pv, pwP, pwPT, smashT, smashCd;                 // player paddle
  var cpu;                                                // cpu paddle {x, vx, w, wT, target, think, err, freeze}
  var ball, trail, hits, lastHit, phase, phaseT, serveDir;
  var orb, orbT, waves, pointsWon, cpuPts, bgT, hitFlashP, hitFlashC, bestRally, widePT, frozenP;

  function ballBase() { return 150 + (R.level - 1) * 11; }
  function ballSpeed() { return Math.min(MAX_SPEED, ballBase() * (1 + 0.05 * hits)); }
  // CPU skill ramps with the level but stays beatable: it chases the ball with limited speed and imperfect foresight
  function cpuMax() { return Math.min(260, 92 + R.level * 14); }
  function cpuLook() { return Math.min(0.5, 0.05 + R.level * 0.035); }          // seconds of look-ahead
  function cpuErr() { return Math.max(5, 26 - R.level * 2.2); }
  function cpuReact() { return Math.max(0.04, 0.3 - R.level * 0.02); }
  function cpuAim() { return Math.min(0.75, Math.max(0, (R.level - 2) * 0.17)); }

  function ping(freq, dur, vol, type) { R.sfx.tone(freq, dur || 0.05, { vol: vol || 0.1, type: type || 'square' }); }
  function wave(x, y, col) { waves.push({ x: x, y: y, t: 0, col: col }); }

  function newBall(dir) {
    var a = U.rand(-0.5, 0.5), sp = ballBase();
    return { x: W / 2, y: H / 2, vx: Math.sin(a) * sp, vy: dir * Math.cos(a) * sp, smash: false };
  }

  function startServe(dir) {
    phase = 'serve'; phaseT = 0.95; serveDir = dir; hits = 0; lastHit = null; trail = [];
    ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, smash: false };
    cpu.freeze = 0;
  }

  function scorePoint(who) {
    phase = 'point'; phaseT = 1.1;
    var bx = U.clamp(ball.x, 8, W - 8);
    if (who === 'p') {
      pointsWon++;
      var pts = 100 * R.level + 15 * hits;
      R.addScore(pts);
      R.hud.extra = pointsWon;
      R.sfx.play('coin'); R.vibrate(25);
      R.fx.burst(bx, 8, { n: 22, color: [COL_C, C.white, COL_C], speed: 110, life: 0.7, gravity: 40 });
      R.fx.text(W / 2, 52, 'POINT +' + pts, COL_C);
      R.fx.shake(2, 0.2);
      R.achieve('first-point');
      if (ball.smash) R.achieve('smash-point');
      var lvl = 1 + Math.floor(pointsWon / 5);
      if (lvl > R.level) {
        R.level = lvl;
        R.sfx.play('powerup'); R.fx.flash(C.white, 0.18);
        R.fx.text(W / 2, 150, 'LEVEL ' + lvl, C.yellow);
        R.fx.text(W / 2, 166, 'CPU GETS TOUGHER', COL_C);
        if (lvl >= 4) R.achieve('level4');
      }
      serveDir = -1;                          // the rival who just lost receives the next serve
    } else {
      cpuPts++;
      R.lives--;
      R.sfx.play('hit'); R.vibrate(80); R.fx.shake(4, 0.3); R.fx.flash(C.red, 0.12);
      R.fx.burst(bx, H - 8, { n: 22, color: [COL_C, C.white, C.red], speed: 110, life: 0.7, gravity: -30 });
      R.fx.text(W / 2, 252, 'MISS!', C.red);
      if (R.lives <= 0) { R.gameOver(); return; }
      serveDir = 1;
    }
    ball.vx = ball.vy = 0; ball.hidden = true;
  }

  /* ---- paddles ---- */
  function updatePlayer(dt) {
    var ax = frozenP > 0 ? 0 : R.input.axisX();
    if (ax) pv += ax * ACC * ((ax > 0 && pv < 0) || (ax < 0 && pv > 0) ? 1.8 : 1) * dt;
    else { var fr = FRIC * dt; if (Math.abs(pv) <= fr) pv = 0; else pv -= (pv > 0 ? 1 : -1) * fr; }
    pv = U.clamp(pv, -MAXV, MAXV);
    pwP += U.clamp(pwPT - pwP, -90 * dt, 90 * dt);
    px += pv * dt;
    var lo = pwP / 2 + 2, hi = W - pwP / 2 - 2;
    if (px < lo) { px = lo; pv = 0; } else if (px > hi) { px = hi; pv = 0; }
    if (smashCd > 0) smashCd -= dt;
    if (smashT > 0) smashT -= dt;
    if (frozenP <= 0 && R.input.pressed('a') && smashCd <= 0) { smashT = 0.24; smashCd = 0.95; ping(520, 0.07, 0.08, 'sawtooth'); }
  }

  function updateCpu(dt) {
    cpu.w += U.clamp((cpu.wT > 0 ? PW_WIDE : PW) - cpu.w, -90 * dt, 90 * dt);
    if (cpu.wT > 0) cpu.wT -= dt;
    var want;
    if (cpu.freeze > 0) { cpu.freeze -= dt; want = 0; }
    else {
      var incoming = phase === 'rally' && ball.vy < 0;
      if (incoming) {
        if (!cpu.incoming) { cpu.incoming = true; cpu.err = U.rand(-1, 1) * cpuErr(); cpu.react = cpuReact(); }
        cpu.react -= dt;
        if (cpu.react <= 0) {
          var aim = (px > W / 2 ? -1 : 1) * cpuAim() * (cpu.w / 2);        // steer the return away from the player
          cpu.target = U.clamp(ball.x + ball.vx * cpuLook() + cpu.err - aim, 6, W - 6);
        }
      } else { cpu.incoming = false; cpu.target = W / 2 + Math.sin(bgT * 0.7) * 22; }
      want = U.clamp((cpu.target - cpu.x) * 7, -cpuMax(), cpuMax());
    }
    cpu.vx += U.clamp(want - cpu.vx, -2200 * dt, 2200 * dt);
    cpu.x += cpu.vx * dt;
    var lo = cpu.w / 2 + 2, hi = W - cpu.w / 2 - 2;
    if (cpu.x < lo) { cpu.x = lo; cpu.vx = 0; } else if (cpu.x > hi) { cpu.x = hi; cpu.vx = 0; }
  }

  /* ---- ball ---- */
  function hitPaddle(who) {
    var cx = who === 'p' ? px : cpu.x, w = who === 'p' ? pwP : cpu.w, v = who === 'p' ? pv : cpu.vx;
    var rel = U.clamp((ball.x - cx) / (w / 2 + 2), -1, 1);
    var a = U.clamp(rel * 1.0 + v / MAXV * 0.12 + U.rand(-0.04, 0.04), -1.1, 1.1);
    if (Math.abs(a) < 0.08) a = (Math.random() < 0.5 ? -1 : 1) * 0.08;
    hits++; lastHit = who;
    var sp = ballSpeed(), smash = false;
    if (who === 'p' && smashT > 0) { smash = true; sp = Math.min(MAX_SPEED * 1.15, sp * 1.35); smashT = 0; }
    ball.smash = smash;
    ball.vx = Math.sin(a) * sp; ball.vy = (who === 'p' ? -1 : 1) * Math.cos(a) * sp;
    ball.y = who === 'p' ? PY - BR : CY + PH + BR;
    if (who === 'p') hitFlashP = 0.12; else hitFlashC = 0.12;
    wave(ball.x, ball.y, who === 'p' ? COL_P : COL_C);
    if (smash) {
      R.sfx.play('shoot'); R.fx.shake(2.5, 0.15); R.vibrate(30);
      R.fx.burst(ball.x, ball.y, { n: 14, color: [COL_S, C.white], speed: 100, life: 0.4 });
      R.fx.text(ball.x, ball.y - 14 * (who === 'p' ? 1 : -1), 'SMASH!', COL_S);
    } else {
      ping(300 + Math.min(14, hits) * 26, 0.06, 0.12);
      R.vibrate(who === 'p' ? 8 : 0);
      R.fx.burst(ball.x, ball.y, { n: 5, color: [who === 'p' ? COL_P : COL_C, C.white], speed: 55, life: 0.3, size: 1 });
    }
    if (hits > bestRally) bestRally = hits;
    if (hits >= 12) R.achieve('rally12');
  }

  function stepBall(ds) {
    ball.x += ball.vx * ds;
    if (ball.x < BR + 2) { ball.x = BR + 2; ball.vx = Math.abs(ball.vx); ping(190, 0.04, 0.07, 'triangle'); wave(2, ball.y, '#ffffff'); }
    else if (ball.x > W - BR - 2) { ball.x = W - BR - 2; ball.vx = -Math.abs(ball.vx); ping(190, 0.04, 0.07, 'triangle'); wave(W - 2, ball.y, '#ffffff'); }
    ball.y += ball.vy * ds;
    if (ball.vy > 0 && ball.y + BR >= PY && ball.y - BR <= PY + PH - 1 && Math.abs(ball.x - px) <= pwP / 2 + BR) hitPaddle('p');
    else if (ball.vy < 0 && ball.y - BR <= CY + PH && ball.y + BR >= CY + 1 && Math.abs(ball.x - cpu.x) <= cpu.w / 2 + BR) hitPaddle('c');
  }

  function updateBall(dt) {
    var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy), n = Math.max(1, Math.ceil(sp * dt / 1.5));
    for (var k = 0; k < n && phase === 'rally'; k++) {
      stepBall(dt / n);
      if (orb && lastHit && Math.abs(ball.x - orb.x) < BR + 7 && Math.abs(ball.y - orb.y) < BR + 7) takeOrb();
      if (ball.y > H + 6) { scorePoint('c'); return; }
      if (ball.y < -6) { scorePoint('p'); return; }
    }
    if (phase !== 'rally') return;
    trail.push(ball.x, ball.y); if (trail.length > 20) trail.splice(0, 2);
  }

  function takeOrb() {
    var kind = orb.kind, who = lastHit, col = kind === 'W' ? '#3dff9a' : '#7fd8ff';
    orb = null; orbT = U.rand(7, 12);
    R.sfx.play('powerup'); R.fx.burst(ball.x, ball.y, { n: 16, color: [col, C.white], speed: 90, life: 0.5 });
    if (kind === 'W') {                                     // wide paddle for whoever hit the ball last
      if (who === 'p') { pwPT = PW_WIDE; widePT = 9; R.fx.text(W / 2, 236, 'WIDE PADDLE!', col); }
      else { cpu.wT = 7; R.fx.text(W / 2, 90, 'CPU WIDE!', COL_C); }
    } else {                                                // freeze the other side for a moment
      if (who === 'p') { cpu.freeze = 1.4; R.fx.text(W / 2, 90, 'CPU FROZEN!', col); }
      else { frozenP = 0.8; pv = 0; R.fx.text(W / 2, 236, 'FROZEN!', C.red); }
    }
  }

  /* ---- drawing ---- */
  function drawBackground(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d0a3c'); g.addColorStop(0.5, '#0a0426'); g.addColorStop(1, '#04162e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // synthwave grid: static verticals, scrolling horizontals
    ctx.fillStyle = 'rgba(180,120,255,.07)';
    var i, off = (bgT * 14) % 20;
    for (i = 0; i <= W; i += 20) ctx.fillRect(i, 0, 1, H);
    for (i = -20 + off; i < H; i += 20) ctx.fillRect(0, Math.round(i), W, 1);
    // goal glows
    var gg = ctx.createLinearGradient(0, 0, 0, 26); gg.addColorStop(0, 'rgba(255,61,242,.35)'); gg.addColorStop(1, 'rgba(255,61,242,0)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, 26);
    gg = ctx.createLinearGradient(0, H, 0, H - 26); gg.addColorStop(0, 'rgba(61,226,255,.35)'); gg.addColorStop(1, 'rgba(61,226,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(0, H - 26, W, 26);
    // side walls: pink on the CPU half, cyan on yours
    ctx.fillStyle = 'rgba(255,61,242,.25)'; ctx.fillRect(0, 0, 4, H / 2); ctx.fillRect(W - 4, 0, 4, H / 2);
    ctx.fillStyle = 'rgba(61,226,255,.25)'; ctx.fillRect(0, H / 2, 4, H / 2); ctx.fillRect(W - 4, H / 2, 4, H / 2);
    ctx.fillStyle = COL_C; ctx.fillRect(0, 0, 2, H / 2); ctx.fillRect(W - 2, 0, 2, H / 2);
    ctx.fillStyle = COL_P; ctx.fillRect(0, H / 2, 2, H / 2); ctx.fillRect(W - 2, H / 2, 2, H / 2);
    // net
    for (i = 4; i < W - 4; i += 10) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(i, H / 2 - 1, 5, 2); }
    // scoreboard (dim)
    R.draw.text(ctx, String(pointsWon), W / 2, H / 2 + 22, { size: 16, color: 'rgba(61,226,255,.22)', align: 'center' });
    R.draw.text(ctx, String(cpuPts), W / 2, H / 2 - 38, { size: 16, color: 'rgba(255,61,242,.22)', align: 'center' });
    if (hits > 1) R.draw.text(ctx, 'RALLY ' + hits, W / 2, H / 2 + 46, { size: 6, color: 'rgba(255,255,255,.4)', align: 'center' });
  }

  function glowRect(ctx, x, y, w, h, col, core) {
    ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.globalAlpha = 0.28; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = core || '#ffffff'; ctx.fillRect(x + 2, y + 1, w - 4, 1);
  }

  function drawPaddles(ctx) {
    var pc = smashT > 0 ? COL_S : COL_P, x = Math.round(px - pwP / 2);
    glowRect(ctx, x, PY, Math.round(pwP), PH, pc);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 1, PY + PH - 2, Math.round(pwP) - 2, 2);
    if (hitFlashP > 0) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x, PY, Math.round(pwP), PH); }
    if (pwPT > PW && widePT < 2 && Math.floor(R.time * 8) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(x, PY, 2, PH); ctx.fillRect(x + Math.round(pwP) - 2, PY, 2, PH); }
    // smash cooldown bar
    var f = U.clamp(1 - smashCd / 0.95, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, PY + PH + 3, Math.round(pwP), 2);
    ctx.fillStyle = f >= 1 ? COL_S : 'rgba(255,236,39,.55)'; ctx.fillRect(x, PY + PH + 3, Math.round(pwP * f), 2);
    var cx = Math.round(cpu.x - cpu.w / 2), cc = cpu.freeze > 0 ? '#9fe8ff' : COL_C;
    glowRect(ctx, cx, CY, Math.round(cpu.w), PH, cpu.freeze > 0 ? '#9fe8ff' : '#ff3df2');
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(cx + 1, CY + PH - 2, Math.round(cpu.w) - 2, 2);
    if (hitFlashC > 0) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(cx, CY, Math.round(cpu.w), PH); }
    if (cpu.freeze > 0) { ctx.fillStyle = '#ffffff'; for (var k = 0; k < 4; k++) ctx.fillRect(cx + 4 + k * Math.round((cpu.w - 8) / 3.2), CY - 3 + (Math.floor(R.time * 12 + k) % 2), 1, 2); }
  }

  function drawBall(ctx) {
    if (ball.hidden) return;
    var col = ball.smash ? COL_S : (lastHit === 'p' ? COL_P : lastHit === 'c' ? COL_C : '#ffffff');
    var i, n = trail.length / 2;
    for (i = 0; i < n; i++) {
      var a = (i + 1) / (n + 1), s = 2 + a * 5;
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(trail[i * 2], trail[i * 2 + 1], s / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.3; R.draw.circle(ctx, ball.x, ball.y, BR + 3, col);
    ctx.globalAlpha = 0.5; R.draw.circle(ctx, ball.x, ball.y, BR + 1.5, col);
    ctx.globalAlpha = 1; R.draw.circle(ctx, ball.x, ball.y, BR, '#ffffff');
    if (phase === 'serve' && Math.floor(phaseT * 8) % 2) R.draw.circle(ctx, ball.x, ball.y, BR + 5, 'rgba(255,255,255,.25)');
  }

  function drawOrb(ctx) {
    if (!orb) return;
    var pulse = 1 + Math.sin(R.time * 6) * 0.15, col = orb.kind === 'W' ? '#3dff9a' : '#7fd8ff';
    if (orb.t < 2 && Math.floor(R.time * 8) % 2) return;
    ctx.globalAlpha = 0.25; R.draw.circle(ctx, orb.x, orb.y, 10 * pulse, col);
    ctx.globalAlpha = 0.5; R.draw.circle(ctx, orb.x, orb.y, 7.5 * pulse, col);
    ctx.globalAlpha = 1; R.draw.circle(ctx, orb.x, orb.y, 5.5, '#10131c'); R.draw.circle(ctx, orb.x, orb.y, 4.5, col);
    R.draw.text(ctx, orb.kind, orb.x + 0.5, orb.y - 2.5, { size: 6, color: '#10131c', align: 'center' });
  }

  function drawWaves(ctx) {
    for (var i = 0; i < waves.length; i++) {
      var w = waves[i], r = 3 + w.t * 60, a = Math.max(0, 1 - w.t / 0.35);
      ctx.globalAlpha = a * 0.7; ctx.strokeStyle = w.col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  R.game({
    layout: 'classic', size: [W, H], bg: '#06021a', music: 'space',

    reset: function () {
      px = W / 2; pv = 0; pwP = PW; pwPT = PW; smashT = 0; smashCd = 0; widePT = 0; frozenP = 0;
      cpu = { x: W / 2, vx: 0, w: PW, wT: 0, target: W / 2, react: 0, incoming: false, err: 0, freeze: 0 };
      trail = []; waves = []; orb = null; orbT = U.rand(7, 11); pointsWon = 0; cpuPts = 0; bgT = 0; hitFlashP = 0; hitFlashC = 0; bestRally = 0;
      R.level = 1; R.lives = 3; R.hud.extraLabel = 'WINS'; R.hud.extra = 0;
      startServe(-1);
    },

    update: function (dt) {
      bgT += dt; hitFlashP -= dt; hitFlashC -= dt;
      var i;
      for (i = waves.length - 1; i >= 0; i--) { waves[i].t += dt; if (waves[i].t > 0.35) waves.splice(i, 1); }
      updatePlayer(dt);
      if (frozenP > 0) { frozenP -= dt; pv = 0; }
      if (widePT > 0) { widePT -= dt; if (widePT <= 0) pwPT = PW; }
      updateCpu(dt);
      if (phase === 'serve') {
        phaseT -= dt;
        if (phaseT <= 0) {
          var a = U.rand(-0.45, 0.45), sp = ballBase();
          ball.vx = Math.sin(a) * sp; ball.vy = serveDir * Math.cos(a) * sp; phase = 'rally';
          ping(660, 0.05, 0.08);
        }
      } else if (phase === 'rally') {
        updateBall(dt);
        if (phase === 'rally') {
          // orb spawning / ageing
          if (orb) { orb.t -= dt; if (orb.t <= 0) { orb = null; orbT = U.rand(6, 10); } }
          else { orbT -= dt; if (orbT <= 0) { orb = { x: U.rand(30, W - 30), y: U.rand(110, 210), kind: Math.random() < 0.5 ? 'W' : 'F', t: 8 }; R.sfx.tone(1200, 0.06, { vol: 0.06 }); } }
        }
      } else if (phase === 'point') {
        phaseT -= dt;
        if (trail.length) trail.splice(0, 2);
        if (phaseT <= 0) { orb = null; startServe(serveDir); }
      }
    },

    render: function (ctx) {
      drawBackground(ctx);
      drawOrb(ctx);
      drawWaves(ctx);
      drawPaddles(ctx);
      drawBall(ctx);
      if (phase === 'serve') R.draw.text(ctx, 'GET READY', W / 2, H / 2 + 8, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
    }
  });
})();
