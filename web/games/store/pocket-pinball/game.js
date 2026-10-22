/* Pocket Pinball — a space-themed pinball table with fixed-step, sub-stepped ball physics.
   Original game for the Retro SDK. */
(function () {
  'use strict';
  var R = Retro, C = R.colors, U = R.util;

  /* ------------------------------------------------------------------------------------------ constants */
  var TW = 160, TH = 320, BR = 4, MX = 147;                 // table size, ball radius, mirror axis (x' = MX - x)
  var GRAV = 560, SUB = 10, VMAX = 900, DRAG = 0.12;
  var PI = Math.PI, TAU = PI * 2;
  var LANE_X = 149, REST_Y = 306, DRAIN_Y = TH + 8;
  var REST_A = 33 * PI / 180, UP_A = -15 * PI / 180, W_UP = 24, W_DOWN = 14, FL_LEN = 30;
  var SAUCER = { x: 28, y: 118 }, SPINNER = { x: 73.5, y: 150, hw: 9 };
  var RAMP = [[13, 182], [11, 152], [10, 112], [12, 74], [20, 48], [32, 34]];
  var RAMP_TIME = 0.85;
  var BALLS_PER_GAME = 3, MAX_LIVES = 6;
  var BUMPER_COL = ['#ff4f8b', '#ffb02e', '#3bd6ff'];
  var TARGET_COL = ['#3bd6ff', '#7dff6b', '#ffe44d', '#ff77c8'];

  function mx(x) { return MX - x; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ----------------------------------------------------------------------------------------- table geometry */
  var segs, circles, bumpers, slings, targets, flippers, railPath, outerPath, rampLen, stars = [];
  var lanesABC = [{ x0: 51, x1: 66 }, { x0: 66, x1: 81 }, { x0: 81, x1: 96 }];
  var SENS = {
    outL: { x0: 5, x1: 22, y0: 208, y1: 228 }, inL: { x0: 22, x1: 38, y0: 208, y1: 228 },
    inR: { x0: 109, x1: 125, y0: 208, y1: 228 }, outR: { x0: 125, x1: 142, y0: 208, y1: 228 },
    ramp: { x0: 6, x1: 21, y0: 166, y1: 192 }
  };

  function addSeg(x1, y1, x2, y2, o) {
    o = o || {};
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), th = o.th == null ? 1.4 : o.th, pad = BR + th + 3;
    var s = { x1: x1, y1: y1, x2: x2, y2: y2, dx: dx, dy: dy, len: len, len2: len * len, th: th, e: o.e == null ? 0.42 : o.e,
      kick: o.kick || 0, kind: o.kind || 'wall', on: true, ow: null, target: o.target == null ? -1 : o.target, sling: o.sling == null ? -1 : o.sling,
      minx: Math.min(x1, x2) - pad, maxx: Math.max(x1, x2) + pad, miny: Math.min(y1, y2) - pad, maxy: Math.max(y1, y2) + pad };
    if (o.oneway) { var nx = dy / len, ny = -dx / len; if (ny > 0) { nx = -nx; ny = -ny; } s.ow = { nx: nx, ny: ny }; }
    segs.push(s);
    return s;
  }
  function chain(pts, o) { for (var i = 0; i + 1 < pts.length; i++) addSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o); }
  function arcPts(cx, cy, r, a0, a1, n) {
    var p = [];
    for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return p;
  }
  function addCircle(x, y, r, e) { circles.push({ x: x, y: y, r: r, e: e == null ? 0.5 : e }); }

  function makeFlipper(px, py, s) {
    var f = { px: px, py: py, s: s, a: REST_A, L: FL_LEN, rp: 5, rt: 2.8, tx: 0, ty: 0, tx0: 0, ty0: 0, held: false };
    f.tx = f.tx0 = px + s * Math.cos(f.a) * f.L; f.ty = f.ty0 = py + Math.sin(f.a) * f.L;
    return f;
  }

  function buildTable() {
    segs = []; circles = []; bumpers = []; slings = []; targets = [];
    var i;
    // outer boundary: left wall, top-left arc, ceiling, top-right arc, right wall
    var outer = [[5, 345], [5, 45]].concat(arcPts(45, 45, 40, PI, 1.5 * PI, 14).slice(1), arcPts(115, 45, 40, 1.5 * PI, TAU, 14), [[155, 345]]);
    chain(outer, { kind: 'rail' });
    chain([[142, 345], [142, 72]], { kind: 'rail' });                       // lane divider
    addSeg(142, 319, 155, 319, { kind: 'rail', th: 0.5 });                  // plunger lane floor
    addSeg(137, 66, 155, 60, { kind: 'gate', oneway: true, th: 0.6, e: 0.2 }); // one-way gate at the top of the lane
    // inlane / outlane guides
    chain([[22, 214], [22, 246], [39.5, 288]], { kind: 'rail' });
    chain([[mx(22), 214], [mx(22), 246], [mx(39.5), 288]], { kind: 'rail' });
    addCircle(22, 214, 2, 0.5); addCircle(mx(22), 214, 2, 0.5);
    // top lane guards
    [51, 66, 81, 96].forEach(function (x) { addSeg(x, 5, x, 26, { kind: 'rail', th: 0.9 }); addCircle(x, 26, 1.6, 0.5); });
    // slingshots (left, right)
    [[38, 226, 38, 250, 54, 262], [mx(38), 226, mx(38), 250, mx(54), 262]].forEach(function (t, k) {
      addSeg(t[0], t[1], t[2], t[3], { kind: 'sling', e: 0.3, th: 1.2 });
      addSeg(t[2], t[3], t[4], t[5], { kind: 'sling', e: 0.3, th: 1.2 });
      var face = addSeg(t[0], t[1], t[4], t[5], { kind: 'sling', e: 0.4, th: 1.8, kick: 250, sling: k });
      slings.push({ pts: [[t[0], t[1]], [t[2], t[3]], [t[4], t[5]]], face: face, flash: 0, cd: 0 });
    });
    // drop targets on the right wall
    for (i = 0; i < 4; i++) {
      var y0 = 118 + 10 * i;
      var s = addSeg(138.4, y0, 138.4, y0 + 9, { kind: 'target', th: 1.4, e: 0.4, target: i });
      targets.push({ seg: s, y: y0, down: false, flash: 0 });
    }
    // pop bumpers
    [[48, 78], [99, 78], [73.5, 104]].forEach(function (b, k) { bumpers.push({ x: b[0], y: b[1], r: 8, flash: 0, col: BUMPER_COL[k] }); });
    flippers = [makeFlipper(39.5, 288, 1), makeFlipper(mx(39.5), 288, -1)];

    // static paths for drawing
    railPath = new Path2D();
    segs.forEach(function (sg) { if (sg.kind === 'rail') { railPath.moveTo(sg.x1, sg.y1); railPath.lineTo(sg.x2, sg.y2); } });
    outerPath = new Path2D();
    outerPath.rect(-4, -4, TW + 8, TH + 8);
    outerPath.moveTo(outer[0][0], outer[0][1]);
    for (i = 1; i < outer.length; i++) outerPath.lineTo(outer[i][0], outer[i][1]);
    outerPath.closePath();
    rampLen = 0;
    for (i = 0; i + 1 < RAMP.length; i++) rampLen += Math.hypot(RAMP[i + 1][0] - RAMP[i][0], RAMP[i + 1][1] - RAMP[i][1]);
    // starfield (cosmetic, fixed layout)
    stars = [];
    var sd = 12345;
    for (i = 0; i < 70; i++) {
      sd = (sd * 1103515245 + 12345) & 0x7fffffff; var sx = sd % TW;
      sd = (sd * 1103515245 + 12345) & 0x7fffffff; var sy = sd % TH;
      sd = (sd * 1103515245 + 12345) & 0x7fffffff;
      stars.push({ x: sx, y: sy, sz: sd % 5 === 0 ? 2 : 1, sp: 1 + (sd % 7) * 0.4, ph: sd % 10 });
    }
  }

  function rampPos(u) {
    var d = clamp(u, 0, 1) * rampLen;
    for (var i = 0; i + 1 < RAMP.length; i++) {
      var l = Math.hypot(RAMP[i + 1][0] - RAMP[i][0], RAMP[i + 1][1] - RAMP[i][1]);
      if (d <= l || i === RAMP.length - 2) { var t = l ? d / l : 0; return [RAMP[i][0] + (RAMP[i + 1][0] - RAMP[i][0]) * t, RAMP[i][1] + (RAMP[i + 1][1] - RAMP[i][1]) * t]; }
      d -= l;
    }
    return RAMP[RAMP.length - 1];
  }

  /* ------------------------------------------------------------------------------------------------ state */
  var balls, phase, phaseT, pull, saverT, saucerCd, saucerLit, multiball, mbQueue, laneLit, inLit, outLit, tgtDown, mult, stats;
  var rampTotal, msg, anim, visT = 0, bonusInfo, spin, lightT;
  var dbg = { rescues: 0, oob: 0, saved: 0, ev: {}, pos: [] };
  function ev(n) { dbg.ev[n] = (dbg.ev[n] || 0) + 1; }

  function newBallObj(x, y, vx, vy, st) {
    return { x: x, y: y, vx: vx, vy: vy, px: x, py: y, st: st, t: 0, auto: 0, trail: [], ax: x, ay: y, at: 0, rescues: 0 };
  }
  function animT() { if (R.mode === 'over' || R.mode === 'ready') { visT += 1 / 60; return visT; } return R.time; }
  function showMsg(text, col, t) { msg = { text: text, col: col || C.white, t: t || 1.6, t0: t || 1.6 }; }
  function award(n, x, y) {
    var v = Math.round(n * (multiball ? 2 : 1));
    R.addScore(v);
    if (R.score >= 50000) R.achieve('score50k');
    if (x != null && n >= 500) R.fx.text(clamp(x, 22, TW - 22), clamp(y, 10, TH - 20), '' + v, C.yellow);
    return v;
  }
  function lightUp(name, t) { lightT[name] = t || 0.5; }

  function resetTargets() {
    tgtDown = [false, false, false, false];
    targets.forEach(function (t) { t.seg.on = true; });
  }

  function newBall() {
    balls = [newBallObj(LANE_X, REST_Y, 0, 0, 'plunger')];
    phase = 'serve'; phaseT = 0; pull = 0; saverT = 0; saucerCd = 0; saucerLit = false; multiball = false; mbQueue = null;
    laneLit = [false, false, false]; inLit = [false, false]; outLit = [false, false];
    mult = 1; R.level = 1; stats = { bump: 0, tgt: 0, ramp: 0, spin: 0, lanes: 0 };
    resetTargets();
    spin.w = 0;
  }

  function plungerBall() {
    var b = null;
    balls.forEach(function (x) { if (!b && x.st === 'plunger' && x.auto <= 0) b = x; });
    return b;
  }

  function launch(power, ball) {
    var b = ball || plungerBall();
    if (!b) return;
    var v = 480 + 380 * clamp(power, 0, 1);
    if (!b.fromSave) saverT = Math.max(saverT, 9);
    b.st = 'play'; b.vx = 0; b.vy = -v; b.auto = 0; b.ax = b.x; b.ay = b.y; b.at = 0;
    if (phase === 'serve') { phase = 'play'; }
    R.sfx.play('jump'); R.sfx.tone(120, 0.12, { type: 'sawtooth', vol: 0.1, slide: 60 });
    R.vibrate(20 + power * 25);
  }

  /* ------------------------------------------------------------------------------------------------ physics */
  function reflect(b, nx, ny, e) {
    var vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return 0;
    var ee = -vn < 40 ? 0 : e;
    b.vx -= (1 + ee) * vn * nx; b.vy -= (1 + ee) * vn * ny;
    return vn;
  }

  function hitSeg(b, s) {
    if (!s.on || b.x < s.minx || b.x > s.maxx || b.y < s.miny || b.y > s.maxy) return null;
    var ax = s.x1, ay = s.y1, dx = s.dx, dy = s.dy;
    if (s.ow && (b.x - ax) * s.ow.nx + (b.y - ay) * s.ow.ny <= 0) return null;       // one-way gate: pass from below
    var t = ((b.x - ax) * dx + (b.y - ay) * dy) / s.len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var qx = ax + dx * t, qy = ay + dy * t, nx = b.x - qx, ny = b.y - qy, d2 = nx * nx + ny * ny, rad = BR + s.th;
    if (d2 >= rad * rad) {
      // safety net against tunnelling: did the centre cross the line since the last sub-step?
      if (!s.ow) {
        var s0 = (b.px - ax) * dy - (b.py - ay) * dx, s1 = (b.x - ax) * dy - (b.y - ay) * dx;
        if (s0 * s1 < 0) {
          var u = s0 / (s0 - s1), ix = b.px + (b.x - b.px) * u, iy = b.py + (b.y - b.py) * u;
          var tt = ((ix - ax) * dx + (iy - ay) * dy) / s.len2;
          if (tt >= -0.02 && tt <= 1.02) {
            var cx = dy / s.len, cy = -dx / s.len;
            if (s0 < 0) { cx = -cx; cy = -cy; }
            b.x = ix + cx * rad; b.y = iy + cy * rad;
            return { nx: cx, ny: cy, vn: reflect(b, cx, cy, s.e) };
          }
        }
      }
      return null;
    }
    var d = Math.sqrt(d2);
    if (d < 1e-6) { nx = dy / s.len; ny = -dx / s.len; d = 0; } else { nx /= d; ny /= d; }
    b.x += nx * (rad - d); b.y += ny * (rad - d);
    return { nx: nx, ny: ny, vn: reflect(b, nx, ny, s.e) };
  }

  function hitCircle(b, cx, cy, r, e) {
    var dx = b.x - cx, dy = b.y - cy, rr = BR + r, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return null;
    var d = Math.sqrt(d2), nx, ny;
    if (d < 1e-6) { nx = 0; ny = -1; } else { nx = dx / d; ny = dy / d; }
    b.x = cx + nx * rr; b.y = cy + ny * rr;
    return { nx: nx, ny: ny, vn: reflect(b, nx, ny, e) };
  }

  function hitFlipper(b, f, h) {
    var dx = f.tx - f.px, dy = f.ty - f.py, l2 = dx * dx + dy * dy;
    var t = ((b.x - f.px) * dx + (b.y - f.py) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var qx = f.px + dx * t, qy = f.py + dy * t, rad = f.rp + (f.rt - f.rp) * t, md = BR + rad;
    var nx = b.x - qx, ny = b.y - qy, d2 = nx * nx + ny * ny;
    if (d2 >= md * md) return false;
    var d = Math.sqrt(d2);
    if (d < 1e-6) { nx = 0; ny = -1; d = 0; } else { nx /= d; ny /= d; }
    b.x += nx * (md - d); b.y += ny * (md - d);
    var fvx = t * (f.tx - f.tx0) / h, fvy = t * (f.ty - f.ty0) / h;
    var rvx = b.vx - fvx, rvy = b.vy - fvy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      var e = -vn < 30 ? 0 : 0.32;
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      if (Math.abs(vn) > 160 && f.flipSound !== true) { f.flipSound = true; R.sfx.tone(180, 0.04, { type: 'square', vol: 0.06 }); }
    }
    return true;
  }

  function moveFlipper(f, h) {
    f.tx0 = f.tx; f.ty0 = f.ty;
    var target = f.held ? UP_A : REST_A;
    if (f.a > target) f.a = Math.max(target, f.a - W_UP * h);
    else if (f.a < target) f.a = Math.min(target, f.a + W_DOWN * h);
    f.tx = f.px + f.s * Math.cos(f.a) * f.L; f.ty = f.py + Math.sin(f.a) * f.L;
  }

  function collideBall(b, h) {
    var i, r, k;
    for (var iter = 0; iter < 2; iter++) {
      for (i = 0; i < segs.length; i++) {
        var s = segs[i];
        r = hitSeg(b, s);
        if (!r) continue;
        if (s.kind === 'target' && r.vn < -25) onTarget(s.target, b);
        else if (s.kick && r.vn < -35) onSling(slings[s.sling], r, b);
      }
      for (i = 0; i < circles.length; i++) hitCircle(b, circles[i].x, circles[i].y, circles[i].r, circles[i].e);
      for (i = 0; i < bumpers.length; i++) {
        var bp = bumpers[i];
        r = hitCircle(b, bp.x, bp.y, bp.r, 0.55);
        if (r) {
          var vn2 = b.vx * r.nx + b.vy * r.ny;
          if (vn2 < 240) { b.vx += r.nx * (240 - vn2); b.vy += r.ny * (240 - vn2); }
          if (bp.flash <= 0.05) onBumper(bp, i);
        }
      }
      for (k = 0; k < flippers.length; k++) hitFlipper(b, flippers[k], h);
    }
  }

  function integrate(b, h) {
    b.vy += GRAV * h;
    var kd = 1 - DRAG * h; b.vx *= kd; b.vy *= kd;
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; }
    b.px = b.x; b.py = b.y;
    b.x += b.vx * h; b.y += b.vy * h;
  }

  function ballBall() {
    for (var i = 0; i < balls.length; i++) for (var j = i + 1; j < balls.length; j++) {
      var a = balls[i], b = balls[j];
      if (a.st !== 'play' || b.st !== 'play') continue;
      var dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, md = BR * 2;
      if (d2 >= md * md) continue;
      var d = Math.sqrt(d2), nx, ny;
      if (d < 1e-6) { nx = 1; ny = 0; d = 0; } else { nx = dx / d; ny = dy / d; }
      var push = (md - d) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      var vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vrel < 0) {
        var j2 = (1 + 0.88) * vrel / 2;
        a.vx += j2 * nx; a.vy += j2 * ny; b.vx -= j2 * nx; b.vy -= j2 * ny;
        if (vrel < -60) R.sfx.tone(900, 0.03, { vol: 0.05 });
      }
    }
  }

  function stepPhysics(dt) {
    var h = dt / SUB, any = false, i;
    for (i = 0; i < balls.length; i++) if (balls[i].st === 'play') any = true;
    for (var s = 0; s < SUB; s++) {
      for (i = 0; i < flippers.length; i++) moveFlipper(flippers[i], h);
      if (!any) continue;
      for (i = 0; i < balls.length; i++) { var b = balls[i]; if (b.st === 'play') { integrate(b, h); collideBall(b, h); } }
      ballBall();
    }
    flippers.forEach(function (f) { f.flipSound = false; });
  }

  /* ------------------------------------------------------------------------------------------------ events */
  function onBumper(bp, i) {
    bp.flash = 0.18; stats.bump++; ev('bumper');
    award(100); lightUp('bump', 0.2);
    R.sfx.tone(520 + i * 140, 0.07, { type: 'square', vol: 0.11, slide: 760 + i * 140 });
    R.vibrate(6);
    R.fx.burst(bp.x, bp.y, { n: 5, color: [bp.col, '#ffffff'], speed: 70, life: 0.3, size: 2 });
  }
  function onSling(sl, r, b) {
    if (sl.cd > 0) return;
    sl.cd = 0.12; sl.flash = 0.16; ev('sling');
    var vn = b.vx * r.nx + b.vy * r.ny;
    if (vn < 260) { b.vx += r.nx * (260 - vn); b.vy += r.ny * (260 - vn); }
    award(50);
    R.sfx.tone(260, 0.06, { type: 'sawtooth', vol: 0.1, slide: 520 });
    R.vibrate(8);
  }
  function onTarget(i, b) {
    if (tgtDown[i]) return;
    tgtDown[i] = true; targets[i].seg.on = false; targets[i].flash = 0.5; stats.tgt++; ev('target');
    award(500, 130, targets[i].y);
    R.sfx.play('coin'); R.vibrate(12);
    R.fx.burst(138, targets[i].y + 4, { n: 8, color: [TARGET_COL[i], '#ffffff'], speed: 70, life: 0.4, size: 2 });
    if (tgtDown[0] && tgtDown[1] && tgtDown[2] && tgtDown[3]) {
      ev('bank'); saucerLit = true; award(5000, 100, 140); lightUp('bank', 1.2);
      showMsg('SAUCER LIT', C.cyan, 1.8);
      R.sfx.play('powerup'); R.vibrate(30);
    }
  }
  function lanesComplete() {
    stats.lanes++; ev('abc');
    laneLit = [false, false, false];
    mult = Math.min(5, mult + 1); R.level = mult;
    award(5000, 73, 40);
    lightUp('lanes', 1.2);
    showMsg(mult >= 5 ? 'BONUS X5 MAX' : 'BONUS X' + mult, C.yellow, 1.6);
    R.achieve('lanes'); R.sfx.play('powerup'); R.vibrate(35);
  }
  function laneHit(i) {
    if (!laneLit[i]) {
      laneLit[i] = true; award(250); lightUp('lane' + i, 0.4);
      R.sfx.tone(700 + i * 160, 0.08, { type: 'triangle', vol: 0.12 });
      if (laneLit[0] && laneLit[1] && laneLit[2]) lanesComplete();
    } else award(25);
  }
  function startMultiball(b) {
    ev('multiball'); saucerLit = false; multiball = true; saverT = Math.max(saverT, 12);
    award(10000, SAUCER.x, SAUCER.y); resetTargets();
    showMsg('MULTIBALL!', C.pink, 2.2);
    R.achieve('multiball'); R.fx.flash(C.white, 0.2); R.fx.shake(2.5, 0.3);
    R.sfx.play('win'); R.vibrate(60);
    mbQueue = { left: 2, t: 0.45 };
  }
  function ejectAngle(k) { return (-63 - [0, 17, -15][k % 3]) * PI / 180; }
  function ejectBall(b, k) {
    var a = ejectAngle(k), sp = 330;
    b.st = 'play'; b.x = SAUCER.x + Math.cos(a) * 7; b.y = SAUCER.y + Math.sin(a) * 7;
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.px = b.x; b.py = b.y; b.ax = b.x; b.ay = b.y; b.at = 0;
    saucerCd = 0.7; lightUp('saucer', 0.5);
    R.sfx.play('shoot'); R.vibrate(18);
    R.fx.burst(SAUCER.x, SAUCER.y, { n: 8, color: [C.cyan, C.white], speed: 80, life: 0.35, size: 2 });
  }
  function captureSaucer(b) {
    ev('saucer'); b.st = 'saucer'; b.x = SAUCER.x; b.y = SAUCER.y; b.vx = b.vy = 0; b.t = 0.9;
    R.sfx.play('land'); R.vibrate(15);
    if (saucerLit) startMultiball(b);
    else if (multiball) { award(10000, SAUCER.x, SAUCER.y); showMsg('JACKPOT!', C.yellow, 1.4); R.sfx.play('powerup'); }
    else { award(2500, SAUCER.x, SAUCER.y); R.sfx.play('coin'); }
    lightUp('saucer', 0.6);
  }
  function enterRamp(b) {
    ev('ramp'); b.st = 'ramp'; b.t = 0; b.vx = b.vy = 0;
    R.sfx.tone(300, 0.5, { type: 'triangle', vol: 0.11, slide: 900 }); R.vibrate(12);
  }
  function finishRamp(b) {
    b.st = 'play'; b.x = RAMP[RAMP.length - 1][0]; b.y = RAMP[RAMP.length - 1][1]; b.vx = 100; b.vy = 40;
    b.px = b.x; b.py = b.y; b.ax = b.x; b.ay = b.y; b.at = 0;
    stats.ramp++; rampTotal++;
    award(2500, 40, 60); lightUp('ramp', 0.8);
    R.sfx.play('powerup'); R.vibrate(25);
    if (rampTotal % 3 === 0) {
      if (R.lives < MAX_LIVES) { ev('extra'); R.lives = R.lives + 1; showMsg('EXTRA BALL!', C.lime, 2); R.achieve('extra-ball'); R.sfx.play('win'); R.fx.flash(C.lime, 0.2); }
      else award(10000, 70, 60);
    } else showMsg('RAMP SHOT', C.cyan, 1.1);
  }
  function spinnerTurn(vy) {
    spin.w = Math.min(34, spin.w + 6 + Math.abs(vy) * 0.045);
  }

  /* ------------------------------------------------------------------------------------------ ball lifecycle */
  function spawnToPlunger(auto) {
    var b = newBallObj(LANE_X, REST_Y, 0, 0, 'plunger'), wait = 0;
    balls.forEach(function (o) { if (o.st === 'plunger' && o.auto > wait) wait = o.auto; });
    b.auto = (auto || 0.8) + (wait > 0 ? wait : 0); b.fromSave = true;
    balls.push(b);
    return b;
  }

  function drained(b) {
    var idx = balls.indexOf(b);
    if (idx >= 0) balls.splice(idx, 1);
    if (saverT > 0) {
      dbg.saved++; showMsg('BALL SAVED', C.cyan, 1.4);
      spawnToPlunger(0.8);
      R.sfx.play('select'); R.vibrate(30);
      return;
    }
    R.sfx.tone(220, 0.35, { type: 'triangle', vol: 0.12, slide: 70 });
    if (balls.length > 0) {
      if (balls.length === 1 && multiball) { multiball = false; showMsg('MULTIBALL OVER', C.lavender, 1.2); }
      return;
    }
    endBall();
  }

  function endBall() {
    var raw = stats.bump * 5 + stats.tgt * 50 + stats.ramp * 200 + stats.spin * 2 + stats.lanes * 250;
    var total = raw * mult;
    R.addScore(total);
    if (R.score >= 50000) R.achieve('score50k');
    bonusInfo = { raw: raw, mult: mult, total: total }; msg = null;
    phase = 'bonus'; phaseT = 2.4;
    R.sfx.play('lose'); R.vibrate(70); R.fx.shake(2, 0.2);
  }

  function endBonus() {
    R.lives = Math.max(0, R.lives - 1);
    if (R.lives <= 0) { phase = 'over'; R.gameOver(); return; }
    newBall();
  }

  function rescue(b) {
    dbg.rescues++; if (dbg.pos.length < 40) dbg.pos.push([Math.round(b.x), Math.round(b.y), Math.round(Math.hypot(b.vx, b.vy)), flippers[0].held ? 1 : 0, flippers[1].held ? 1 : 0]); b.rescues++; b.at = 0; b.ax = b.x; b.ay = b.y;
    if (b.rescues <= 2) {
      b.vx = (b.x < 73.5 ? 1 : -1) * 90; b.vy = -280;
      R.sfx.tone(300, 0.12, { type: 'square', vol: 0.08, slide: 600 });
    } else {
      b.x = 73.5; b.y = 128; b.px = b.x; b.py = b.y; b.vx = (b.rescues % 2 ? 50 : -50); b.vy = 0; b.rescues = 0;
    }
  }

  /* ---------------------------------------------------------------------------------------------- update */
  function updateSensors(b, dt) {
    var i, ln;
    if (b.y < 28 && b.y > 7) {
      for (i = 0; i < 3; i++) { ln = lanesABC[i]; if (b.x > ln.x0 + 1 && b.x < ln.x1 - 1) laneHit(i); }
    }
    var pk;
    for (pk in { outL: 1, inL: 1, inR: 1, outR: 1 }) {
      var z = SENS[pk];
      if (b.x > z.x0 && b.x < z.x1 && b.y > z.y0 && b.y < z.y1 && b.vy > 0) {
        var isIn = pk.charAt(0) === 'i', idx = pk.charAt(pk.length - 1) === 'L' ? 0 : 1, arr = isIn ? inLit : outLit;
        if (!arr[idx]) {
          arr[idx] = true; award(isIn ? 250 : 500); lightUp(pk, 0.5);
          R.sfx.tone(isIn ? 880 : 440, 0.06, { type: 'triangle', vol: 0.09 });
          if (isIn && inLit[0] && inLit[1]) { inLit = [false, false]; award(1000, 73, 215); showMsg('LANE BONUS', C.lime, 1); R.sfx.play('coin'); }
        }
      }
    }
    // spinner: crossing the bar line
    if (Math.abs(b.x - SPINNER.x) < SPINNER.hw + 1 && ((b.py < SPINNER.y && b.y >= SPINNER.y) || (b.py > SPINNER.y && b.y <= SPINNER.y))) spinnerTurn(b.vy);
    // ramp mouth: must be travelling up the left side
    var rz = SENS.ramp;
    if (b.x > rz.x0 && b.x < rz.x1 && b.y > rz.y0 && b.y < rz.y1 && b.vy < -90) { enterRamp(b); return; }
    // saucer
    if (saucerCd <= 0) {
      var dx = b.x - SAUCER.x, dy = b.y - SAUCER.y;
      if (dx * dx + dy * dy < 20 && b.vx * b.vx + b.vy * b.vy < 520 * 520) captureSaucer(b);
    }
  }

  function updateBalls(dt) {
    for (var i = balls.length - 1; i >= 0; i--) {
      var b = balls[i];
      if (b.st === 'plunger') {
        b.x = LANE_X; b.y = REST_Y + pull * 8; b.px = b.x; b.py = b.y;
        if (b.auto > 0) { b.auto -= dt; if (b.auto <= 0) { b.auto = 0; launch(0.95, b); } }
        continue;
      }
      if (b.st === 'saucer') { b.t -= dt; if (b.t <= 0) ejectBall(b, 0); continue; }
      if (b.st === 'ramp') {
        b.t += dt / RAMP_TIME;
        var p = rampPos(b.t); b.x = p[0]; b.y = p[1];
        if (b.t >= 1) finishRamp(b);
        continue;
      }
      // st === 'play'
      if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy) || b.x < -2 || b.x > TW + 2 || b.y < -8) { dbg.oob++; b.vx = b.vy = 0; b.x = 73.5; b.y = 128; b.px = b.x; b.py = b.y; b.rescues = 0; continue; }
      b.trail.push(b.x, b.y); if (b.trail.length > 14) b.trail.splice(0, 2);
      if (b.y > DRAIN_Y) { drained(b); continue; }
      // back at the plunger after a weak launch
      if (b.x > 143 && b.y > 296 && b.vx * b.vx + b.vy * b.vy < 3600 && !balls.some(function (o) { return o !== b && o.st === 'plunger'; })) {
        b.st = 'plunger'; b.vx = b.vy = 0; b.x = LANE_X; b.y = REST_Y; b.auto = 0; pull = 0; continue;
      }
      updateSensors(b, dt);
      if (b.st !== 'play') continue;
      // stuck watchdog
      var mdx = b.x - b.ax, mdy = b.y - b.ay;
      if (mdx * mdx + mdy * mdy > 36) { b.ax = b.x; b.ay = b.y; b.at = 0; }
      else { b.at += dt; if (b.at > 3) rescue(b); }
    }
  }

  function updateTimers(dt) {
    bumpers.forEach(function (b) { if (b.flash > 0) b.flash -= dt; });
    slings.forEach(function (s) { if (s.flash > 0) s.flash -= dt; if (s.cd > 0) s.cd -= dt; });
    targets.forEach(function (t) { if (t.flash > 0) t.flash -= dt; });
    for (var k in lightT) if (lightT[k] > 0) lightT[k] -= dt;
    if (saucerCd > 0) saucerCd -= dt;
    if (saverT > 0) { saverT -= dt; }
    if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
    // spinner
    if (spin.w > 0.05) {
      var da = spin.w * dt; spin.a += da;
      var half = Math.floor(spin.a / PI);
      while (spin.half < half) { spin.half++; stats.spin++; ev('spin'); award(50); if (spin.half % 2 === 0) R.sfx.play('tick'); }
      spin.w *= Math.pow(0.35, dt);
    } else spin.w = 0;
    // queued multiball balls
    if (mbQueue) {
      mbQueue.t -= dt;
      if (mbQueue.t <= 0) {
        var b = newBallObj(SAUCER.x, SAUCER.y, 0, 0, 'play');
        balls.push(b); ejectBall(b, mbQueue.left === 2 ? 1 : 2);
        mbQueue.left--; mbQueue.t = 0.4;
        if (mbQueue.left <= 0) mbQueue = null;
      }
    }
  }

  function setFlipperInputs() {
    var inp = R.input, L = inp.held.left || inp.held.a, Rr = inp.held.right || inp.held.b;
    if (phase === 'bonus' || phase === 'over') { L = Rr = false; }
    if (L && !flippers[0].held) R.sfx.tone(150, 0.035, { type: 'square', vol: 0.06 });
    if (Rr && !flippers[1].held) R.sfx.tone(150, 0.035, { type: 'square', vol: 0.06 });
    // lane change: flipper buttons rotate the lit top lanes
    if (phase === 'play' || phase === 'serve') {
      if (inp.pressed('left') || inp.pressed('a')) laneLit = [laneLit[1], laneLit[2], laneLit[0]];
      if (inp.pressed('right') || inp.pressed('b')) laneLit = [laneLit[2], laneLit[0], laneLit[1]];
    }
    flippers[0].held = !!L; flippers[1].held = !!Rr;
  }

  function reallyUpdate(dt) {
    setFlipperInputs();
    // plunger
    var pl = plungerBall();
    if (pl && phase !== 'bonus') {
      if (R.input.held.down) pull = Math.min(1, pull + dt / 0.75);
      else if (pull > 0) { var p = pull; pull = 0; if (p > 0.04) launch(p); }
    } else if (!pl) pull = 0;
    if (phase === 'bonus') {
      phaseT -= dt;
      if (phaseT <= 0) endBonus();
    }
    stepPhysics(dt);
    updateBalls(dt);
    updateTimers(dt);
    if (stats && phase !== 'over' && R.score >= 50000) R.achieve('score50k');
  }

  /* -------------------------------------------------------------------------------------------- drawing */
  function blob(ctx, x, y, r, col) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function lamp(ctx, x, y, r, on, col, t) {
    if (on) {
      blob(ctx, x, y, r * 2.4, col.replace('rgb', 'rgba').replace(')', ',.45)'));
      ctx.fillStyle = col;
    } else ctx.fillStyle = 'rgba(40,50,100,.8)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = on ? 'rgba(255,255,255,.9)' : 'rgba(120,140,220,.5)'; ctx.lineWidth = 0.8; ctx.stroke();
    if (on) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); ctx.fill(); }
  }

  var bgCache = null;
  function paintBackground(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, TH);
    g.addColorStop(0, '#070b28'); g.addColorStop(0.55, '#150a3a'); g.addColorStop(1, '#0a0526');
    ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH);
    blob(ctx, 38, 92, 72, 'rgba(120,60,230,.22)'); blob(ctx, 118, 205, 82, 'rgba(30,140,255,.15)'); blob(ctx, 60, 262, 64, 'rgba(255,60,170,.12)');
    // ringed planet
    var px = 104, py = 176, pr = 26;
    var pg = ctx.createRadialGradient(px - 8, py - 9, 2, px, py, pr);
    pg.addColorStop(0, '#ffb86b'); pg.addColorStop(0.55, '#d9548a'); pg.addColorStop(1, '#3b1a6e');
    ctx.globalAlpha = 0.42; ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,180,.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(px, py, pr + 14, 7, -0.35, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    R.draw.text(ctx, 'POCKET', 73.5, 186, { size: 8, color: 'rgba(160,190,255,.22)', align: 'center' });
    R.draw.text(ctx, 'PINBALL', 73.5, 196, { size: 8, color: 'rgba(160,190,255,.22)', align: 'center' });
  }

  function drawBackground(ctx, t) {
    if (!bgCache) {
      try {
        bgCache = document.createElement('canvas'); bgCache.width = TW * 3; bgCache.height = TH * 3;
        var bc = bgCache.getContext('2d'); bc.scale(3, 3); paintBackground(bc);
      } catch (e) { bgCache = null; }
    }
    if (bgCache) {
      ctx.imageSmoothingEnabled = true; ctx.drawImage(bgCache, 0, 0, TW, TH); ctx.imageSmoothingEnabled = false;
    } else paintBackground(ctx);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], a = 0.35 + 0.35 * Math.sin(t * s.sp + s.ph);
      ctx.fillStyle = 'rgba(220,235,255,' + a + ')'; ctx.fillRect(s.x, s.y, s.sz, s.sz);
    }
  }

  function drawRamp(ctx, t) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(RAMP[0][0], RAMP[0][1]);
    for (var i = 1; i < RAMP.length; i++) ctx.lineTo(RAMP[i][0], RAMP[i][1]);
    ctx.strokeStyle = 'rgba(150,215,255,.34)'; ctx.lineWidth = 12; ctx.stroke();
    ctx.strokeStyle = 'rgba(20,30,90,.55)'; ctx.lineWidth = 9; ctx.stroke();
    // chevrons running up the ramp
    var lit = lightT.ramp > 0;
    for (var k = 0; k < 6; k++) {
      var u = ((k / 6) + t * (lit ? 1.4 : 0.35)) % 1, p = rampPos(u), q = rampPos(Math.min(1, u + 0.03));
      ctx.fillStyle = lit ? 'rgba(255,240,120,.95)' : 'rgba(120,200,255,.5)';
      var ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(2.4, 0); ctx.lineTo(-1.6, -2.4); ctx.lineTo(-1.6, 2.4); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  function drawBumper(ctx, b, t) {
    var f = clamp(b.flash / 0.18, 0, 1), r = b.r + f * 1.8;
    blob(ctx, b.x, b.y, r * 2.2, f > 0 ? 'rgba(255,255,255,.4)' : 'rgba(255,120,200,.16)');
    ctx.fillStyle = '#10163a'; ctx.beginPath(); ctx.arc(b.x, b.y, r + 2, 0, TAU); ctx.fill();
    var g = ctx.createRadialGradient(b.x - 2.5, b.y - 3, 1, b.x, b.y, r);
    g.addColorStop(0, f > 0 ? '#ffffff' : U.shade(b.col, 0.55)); g.addColorStop(0.6, b.col); g.addColorStop(1, U.shade(b.col, -0.5));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.58, 0, TAU); ctx.stroke();
    // little star in the middle
    ctx.fillStyle = f > 0 ? '#ffd23a' : 'rgba(255,255,255,.9)';
    ctx.beginPath();
    for (var i = 0; i < 10; i++) { var a = -PI / 2 + i * PI / 5, rr = i % 2 ? 1.4 : 3.2; ctx.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  function drawSling(ctx, sl) {
    var f = clamp(sl.flash / 0.16, 0, 1), p = sl.pts;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.closePath();
    ctx.fillStyle = 'rgba(255,196,0,.28)'; ctx.fill();
    ctx.strokeStyle = '#ff8a00'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[2][0], p[2][1]);
    ctx.strokeStyle = f > 0 ? '#ffffff' : '#ffe14a'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = f > 0 ? 'rgba(255,255,255,.9)' : 'rgba(255,120,0,.8)'; ctx.lineWidth = 1; ctx.stroke();
    // chevron arrows
    var cx = (p[0][0] + p[1][0] + p[2][0]) / 3, cy = (p[0][1] + p[1][1] + p[2][1]) / 3;
    ctx.fillStyle = f > 0 ? '#ffffff' : 'rgba(255,230,120,.8)';
    ctx.beginPath(); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx - 3, cy - 1); ctx.lineTo(cx + 3, cy - 1); ctx.closePath(); ctx.fill();
  }

  function drawFlipper(ctx, f) {
    var ang = Math.atan2(f.ty - f.py, f.tx - f.px), nx = -Math.sin(ang), ny = Math.cos(ang), rp = f.rp, rt = f.rt;
    function shape(grow) {
      ctx.beginPath(); ctx.arc(f.px, f.py, rp + grow, 0, TAU); ctx.moveTo(f.tx + rt + grow, f.ty); ctx.arc(f.tx, f.ty, rt + grow, 0, TAU);
      ctx.moveTo(f.px + nx * (rp + grow), f.py + ny * (rp + grow));
      ctx.lineTo(f.tx + nx * (rt + grow), f.ty + ny * (rt + grow));
      ctx.lineTo(f.tx - nx * (rt + grow), f.ty - ny * (rt + grow));
      ctx.lineTo(f.px - nx * (rp + grow), f.py - ny * (rp + grow));
      ctx.closePath();
    }
    ctx.fillStyle = '#5a2400'; shape(1); ctx.fill();
    ctx.fillStyle = f.held ? '#ffc247' : '#ff9a1f'; shape(0); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,170,.9)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f.px - nx * rp * 0.45 + Math.cos(ang) * 2, f.py - ny * rp * 0.45 + Math.sin(ang) * 2);
    ctx.lineTo(f.tx - nx * rt * 0.4 - Math.cos(ang) * 1, f.ty - ny * rt * 0.4 - Math.sin(ang) * 1); ctx.stroke();
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(f.px, f.py, 1.8, 0, TAU); ctx.fill();
  }

  function drawBall(ctx, b, big) {
    var r = BR * (big || 1);
    var tr = b.trail;
    for (var i = 0; i + 1 < tr.length; i += 2) {
      var a = (i / tr.length) * 0.3;
      ctx.fillStyle = 'rgba(180,215,255,' + a + ')'; ctx.beginPath(); ctx.arc(tr[i], tr[i + 1], r * (0.4 + 0.5 * i / tr.length), 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(b.x + 1, b.y + 1.5, r, 0, TAU); ctx.fill();
    var g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, 0.4, b.x, b.y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#cfdcf0'); g.addColorStop(1, '#5b6a92');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,30,70,.8)'; ctx.lineWidth = 0.6; ctx.stroke();
  }

  function drawTargets(ctx) {
    for (var i = 0; i < 4; i++) {
      var t = targets[i], col = TARGET_COL[i];
      if (tgtDown[i]) {
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(139, t.y, 3, 9);
        if (t.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + clamp(t.flash / 0.5, 0, 1) + ')'; ctx.fillRect(134, t.y, 8, 9); }
      } else {
        blob(ctx, 138, t.y + 4.5, 9, 'rgba(255,255,255,.12)');
        ctx.fillStyle = col; ctx.fillRect(136.2, t.y, 5.8, 9);
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(136.2, t.y, 1.5, 9);
        ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 0.8; ctx.strokeRect(136.2, t.y, 5.8, 9);
      }
    }
  }

  function drawPlunger(ctx, t) {
    var lg = ctx.createLinearGradient(0, 40, 0, 130);
    lg.addColorStop(0, 'rgba(0,0,10,0)'); lg.addColorStop(1, 'rgba(0,0,10,.55)');
    ctx.fillStyle = lg; ctx.fillRect(143, 40, 12, 90);
    ctx.fillStyle = 'rgba(0,0,10,.55)'; ctx.fillRect(143, 130, 12, 190);
    var plb = null;
    balls.forEach(function (b) { if (b.st === 'plunger') plb = b; });
    var headY = REST_Y + 4 + pull * 8;
    // spring
    ctx.strokeStyle = '#9fb2d0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(146, headY + 1);
    var n = 5, h = (319 - headY - 1) / n;
    for (var i = 0; i < n; i++) { ctx.lineTo(i % 2 ? 146 : 152, headY + 1 + h * (i + 0.5)); ctx.lineTo(149, headY + 1 + h * (i + 1)); }
    ctx.stroke();
    ctx.fillStyle = '#ff5f6d'; ctx.fillRect(145, headY, 8, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(145, headY, 8, 1);
    // power meter
    if (plb && plb.auto <= 0 && phase !== 'bonus') {
      var segs8 = 14, lit = Math.round(pull * segs8);
      for (var k = 0; k < segs8; k++) {
        var yy = 292 - k * 7.5, on = k < lit, col = k < 5 ? '#3df08a' : k < 10 ? '#ffe03a' : '#ff4a4a';
        ctx.fillStyle = on ? col : 'rgba(255,255,255,.1)'; ctx.fillRect(145, yy - 5, 8, 5);
      }
    }
  }

  function drawLights(ctx, t) {
    var i;
    // top lanes A-B-C
    var letters = ['A', 'B', 'C'];
    for (i = 0; i < 3; i++) {
      var cx = (lanesABC[i].x0 + lanesABC[i].x1) / 2, on = laneLit[i] || lightT['lane' + i] > 0 || (lightT.lanes > 0 && Math.floor(t * 12) % 2);
      lamp(ctx, cx, 17, 5.2, on, 'rgb(255,226,70)', t);
      R.draw.text(ctx, letters[i], cx, 14, { size: 6, color: on ? '#5a3a00' : 'rgba(150,170,255,.8)', align: 'center' });
    }
    // in / out lane lamps
    var lane = [[13.5, outLit[0], 'outL'], [30, inLit[0], 'inL'], [mx(30), inLit[1], 'inR'], [mx(13.5), outLit[1], 'outR']];
    for (i = 0; i < 4; i++) lamp(ctx, lane[i][0], 220, 2.6, lane[i][1] || lightT[lane[i][2]] > 0, i === 0 || i === 3 ? 'rgb(255,90,120)' : 'rgb(110,240,140)', t);
    // bonus multiplier lights
    for (i = 2; i <= 5; i++) {
      var lx = 73.5 + (i - 3.5) * 11, on2 = mult >= i || (lightT.lanes > 0 && Math.floor(t * 10) % 2);
      lamp(ctx, lx, 238, 3.2, on2, 'rgb(255,160,40)', t);
      R.draw.text(ctx, '' + i, lx, 235.5, { size: 6, color: on2 ? '#4a2400' : 'rgba(150,170,255,.7)', align: 'center' });
    }
    R.draw.text(ctx, 'BONUS', 73.5, 245, { size: 6, color: 'rgba(160,190,255,.45)', align: 'center' });
    // ball saver lamp
    lamp(ctx, 73.5, 258, 3, saverT > 0 && Math.floor(t * (saverT < 3 ? 10 : 3)) % 2 === 0, 'rgb(80,220,255)', t);
    R.draw.text(ctx, 'SAVE', 73.5, 264, { size: 6, color: 'rgba(160,190,255,.45)', align: 'center' });
    // arrows towards ramp, saucer
    var pulse = Math.floor(t * 4) % 3;
    for (i = 0; i < 3; i++) {
      ctx.fillStyle = (i === pulse) ? 'rgba(120,230,255,.95)' : 'rgba(80,140,220,.35)';
      ctx.beginPath(); ctx.moveTo(26 - i * 0, 196 - i * 8); ctx.lineTo(22, 200 - i * 8); ctx.lineTo(30, 200 - i * 8); ctx.closePath(); ctx.fill();
    }
  }

  function drawSaucerAndSpinner(ctx, t) {
    var lit = saucerLit, pulse = lit ? 0.5 + 0.5 * Math.sin(t * 10) : 0;
    if (lit || lightT.saucer > 0) blob(ctx, SAUCER.x, SAUCER.y, 22, lit ? 'rgba(80,255,255,' + (0.25 + 0.3 * pulse) + ')' : 'rgba(255,255,255,.3)');
    ctx.fillStyle = '#04030f'; ctx.beginPath(); ctx.arc(SAUCER.x, SAUCER.y, 6.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = lit ? 'rgb(' + Math.round(80 + 175 * pulse) + ',255,255)' : '#7e8fc8'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(SAUCER.x, SAUCER.y, 3.4, 0, TAU); ctx.stroke();
    // spinner bar (seen from above: its apparent depth follows |cos|)
    var c = Math.cos(spin.a), dep = 1.2 + 3.8 * Math.abs(c), x0 = SPINNER.x - SPINNER.hw;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x0, SPINNER.y - 0.6, SPINNER.hw * 2, 1.2);
    ctx.fillStyle = c > 0 ? '#ffe36a' : '#ff9f4a'; ctx.fillRect(x0, SPINNER.y - dep / 2, SPINNER.hw * 2, dep);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x0, SPINNER.y - dep / 2, SPINNER.hw * 2, 0.8);
    ctx.fillStyle = '#c2c3c7'; ctx.fillRect(x0 - 2, SPINNER.y - 1.5, 2, 3); ctx.fillRect(x0 + SPINNER.hw * 2, SPINNER.y - 1.5, 2, 3);
  }

  function drawMessage(ctx) {
    if (msg) {
      var a = clamp(msg.t / 0.35, 0, 1), y = 168;
      ctx.globalAlpha = a;
      var w = msg.text.length * 8 + 10;
      ctx.fillStyle = 'rgba(5,8,30,.8)'; ctx.fillRect(73.5 - w / 2, y - 4, w, 16);
      R.draw.frame(ctx, 73.5 - w / 2, y - 4, w, 16, msg.col, 1);
      R.draw.text(ctx, msg.text, 73.5, y, { size: 8, color: msg.col, align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (phase === 'bonus' && bonusInfo) {
      ctx.fillStyle = 'rgba(5,8,30,.9)'; ctx.fillRect(14, 112, 132, 84);
      R.draw.frame(ctx, 14, 112, 132, 84, C.yellow, 1);
      R.draw.text(ctx, 'END OF BALL', 80, 121, { size: 8, color: C.white, align: 'center' });
      R.draw.text(ctx, 'BONUS ' + bonusInfo.raw, 80, 141, { size: 8, color: C.cyan, align: 'center' });
      R.draw.text(ctx, 'X ' + bonusInfo.mult, 80, 157, { size: 8, color: C.yellow, align: 'center' });
      R.draw.text(ctx, '= ' + bonusInfo.total, 80, 175, { size: 8, color: C.lime, align: 'center' });
    }
  }

  function render(ctx, W, H) {
    var t = animT(), i;
    drawBackground(ctx, t);
    drawPlunger(ctx, t);
    drawRamp(ctx, t);
    drawLights(ctx, t);
    slings.forEach(function (s) { drawSling(ctx, s); });
    drawSaucerAndSpinner(ctx, t);
    drawTargets(ctx);
    bumpers.forEach(function (b) { drawBumper(ctx, b, t); });
    // rails
    ctx.fillStyle = '#04061c'; ctx.fill(outerPath, 'evenodd');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(70,170,255,.32)'; ctx.lineWidth = 5; ctx.stroke(railPath);
    ctx.strokeStyle = '#2c58c8'; ctx.lineWidth = 2.8; ctx.stroke(railPath);
    ctx.strokeStyle = '#a5ecff'; ctx.lineWidth = 0.9; ctx.stroke(railPath);
    // one-way gate
    ctx.strokeStyle = 'rgba(210,235,255,.95)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(137, 66); ctx.lineTo(155, 60); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(155, 60, 1.6, 0, TAU); ctx.fill();
    // lane posts
    for (i = 0; i < circles.length; i++) { ctx.fillStyle = '#d8f4ff'; ctx.beginPath(); ctx.arc(circles[i].x, circles[i].y, circles[i].r, 0, TAU); ctx.fill(); }
    flippers.forEach(function (f) { drawFlipper(ctx, f); });
    for (i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (b.st === 'saucer') continue;
      drawBall(ctx, b, b.st === 'ramp' ? 1.15 : 1);
    }
    // top-lane hint while waiting for the plunger
    if (phase === 'serve' && pull < 0.02 && Math.floor(t * 2) % 2 === 0 && R.mode !== 'ready') {
      R.draw.text(ctx, 'HOLD DOWN', 73.5, 112, { size: 8, color: C.white, align: 'center', shadow: '#000' });
      R.draw.text(ctx, 'RELEASE!', 73.5, 124, { size: 8, color: C.yellow, align: 'center', shadow: '#000' });
    }
    drawMessage(ctx);
  }

  /* ------------------------------------------------------------------------------------------------ game */
  R.game({
    layout: 'classic', size: [TW, TH], bg: '#070b28', music: 'space', levelLabel: 'MULT',

    init: function () { buildTable(); },

    reset: function () {
      lightT = {}; spin = { a: 0, w: 0, half: 0 }; rampTotal = 0; msg = null; bonusInfo = null; anim = 0;
      flippers.forEach(function (f) { f.a = REST_A; f.held = false; f.tx = f.tx0 = f.px + f.s * Math.cos(f.a) * f.L; f.ty = f.ty0 = f.py + Math.sin(f.a) * f.L; });
      slings.forEach(function (s) { s.flash = 0; s.cd = 0; });
      bumpers.forEach(function (b) { b.flash = 0; });
      targets.forEach(function (t) { t.flash = 0; });
      R.lives = BALLS_PER_GAME; R.level = 1; R.hud.extra = null; R.hud.extraLabel = null;
      newBall();
    },

    update: function (dt) {
      anim += dt;
      if (phase === 'over') return;
      reallyUpdate(dt);
    },

    render: render
  });
})();
