/* Neon Runner — synthwave 3-lane runner with a pseudo-3D road, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164;
  var HZ = 56, CX = 68, PY = 142, CAMD = 95, LANE_W = 34;   // horizon y, centre x, player feet y, camera distance, lane width at the player plane
  var Z_SPAWN = 350, Z_FADE = 250;                           // objects appear at Z_SPAWN and fade in over the last stretch
  var GRAV = 900, JUMP_V = 240, SLIDE_T = 0.55;
  var LOW_H = 12, BEAM_LO = 15, BEAM_HI = 31, STAND_H = 26, SLIDE_H = 11;
  var LANE_HIT = 0.62, INVULN = 1.7;
  var CYAN = '#3de2ff', MAG = '#ff2fd0', PINK = '#ff5ea8', YEL = '#ffe45e', ORG = '#ff9e3d', VIO = '#7a2bff';

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }

  /* ------------------------------------------------------------------ sprites */
  var RUN_PAL = { H: '#35208a', h: '#6a4bff', c: '#3de2ff', m: '#ff2fd0', J: '#1e1658', j: '#3a2c9a', P: '#150f40', s: '#3de2ff', k: '#ffccaa', w: '#ffffff' };
  function runnerRows(frame) {
    var w = 16, h = 24, g = [], x, y;
    for (y = 0; y < h; y++) { var r = []; for (x = 0; x < w; x++) r.push('.'); g.push(r); }
    function put(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; }
    function box(x0, y0, x1, y1, c) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) put(xx, yy, c); }
    for (y = 0; y < 11; y++) for (x = 0; x < w; x++) {          // helmet
      var dx = (x - 7.5) / 5.4, dy = (y - 5.3) / 5.5;
      if (dx * dx + dy * dy <= 1) put(x, y, (dx < -0.45 && dy < 0.2) ? 'h' : 'H');
    }
    box(7, 1, 8, 8, 'c'); put(7, 9, 'm'); put(8, 9, 'm');
    box(7, 10, 8, 11, 'k');                                       // neck
    box(4, 12, 11, 17, 'J'); box(3, 11, 12, 13, 'J'); box(3, 11, 4, 13, 'j'); box(11, 11, 12, 13, 'j');
    box(7, 12, 8, 17, 'm'); box(4, 17, 11, 17, 'c');             // spine light + belt
    if (frame === 2) {                                            // jump: arms up, legs tucked
      box(1, 7, 2, 12, 'J'); put(1, 6, 'c'); put(2, 6, 'c'); box(13, 7, 14, 12, 'J'); put(13, 6, 'c'); put(14, 6, 'c');
      box(5, 18, 7, 21, 'P'); box(8, 18, 10, 21, 'P'); box(5, 22, 7, 22, 's'); box(8, 22, 10, 22, 's');
    } else {
      var a = frame === 0;
      box(a ? 2 : 12, 12, a ? 3 : 13, 17, 'J'); box(a ? 2 : 12, 18, a ? 3 : 13, 19, 'c');          // swinging arms
      box(a ? 12 : 2, 12, a ? 13 : 3, 15, 'J'); box(a ? 12 : 2, 16, a ? 13 : 3, 16, 'c');
      box(a ? 5 : 9, 18, a ? 7 : 11, 22, 'P'); box(a ? 5 : 9, 22, a ? 7 : 11, 23, 's');            // planted leg
      box(a ? 9 : 5, 18, a ? 11 : 7, 20, 'P'); box(a ? 9 : 5, 20, a ? 11 : 7, 21, 's');            // raised leg
    }
    return g.map(function (r) { return r.join(''); });
  }
  var S = {};
  function buildSprites() { S.run = [R.sprite(runnerRows(0), RUN_PAL), R.sprite(runnerRows(1), RUN_PAL), R.sprite(runnerRows(2), RUN_PAL)]; }

  /* -------------------------------------------------------------------- state */
  var objs, px, tl, jy, jvy, sliding, slideQ, jbuf, dist, speed, time, nextRow, nextPower, coins, magnetT, shieldT, invuln, dead, deadT;
  var anim, hitFlash, magnetCoins, camX, powerFlip;

  function proj(z) { return CAMD / (CAMD + z); }
  function sy(p) { return HZ + (PY - HZ) * p; }
  function sx(lane, p) { return CX + (lane - camX) * LANE_W * p; }
  function difficulty() { return U.clamp(dist / 6500, 0, 1); }

  /* ------------------------------------------------------------------ spawning */
  function add(k, lane, z, h) { var o = { k: k, lane: lane, z: z, h: h || 0, checked: false, dead: false, spin: U.rand(0, 6) }; objs.push(o); return o; }
  function pickKind(d, allowBlock) {
    var opts = [['low', 4], ['high', 3]];
    if (allowBlock && d > 0.04) opts.push(['block', 2]);
    var tot = 0, i; for (i = 0; i < opts.length; i++) tot += opts[i][1];
    var r = Math.random() * tot;
    for (i = 0; i < opts.length; i++) { r -= opts[i][1]; if (r <= 0) return opts[i][0]; }
    return 'low';
  }
  function spawnRow() {
    var d = difficulty(), z = Z_SPAWN, len = 0, i, lane, pats = [['single', 4], ['coins', 3], ['jumpcoins', 2]];
    if (d > 0.08) pats.push(['double', 4]);
    if (d > 0.22) pats.push(['wall', 2]);
    var tot = 0; pats.forEach(function (p) { tot += p[1]; });
    var r = Math.random() * tot, pat = pats[0][0];
    for (i = 0; i < pats.length; i++) { r -= pats[i][1]; if (r <= 0) { pat = pats[i][0]; break; } }
    if (time > nextPower) { pat = 'power'; nextPower = time + U.rand(16, 24); }
    if (pat === 'single') { lane = U.randInt(-1, 2); add(pickKind(d, true), lane, z); if (Math.random() < 0.5) { var cl = U.randInt(-1, 2); if (cl !== lane) for (i = 0; i < 4; i++) add('coin', cl, z + i * 11, 9); } }
    else if (pat === 'double') {
      var free = U.randInt(-1, 2), blockUsed = false;
      for (lane = -1; lane <= 1; lane++) if (lane !== free) { var kd = pickKind(d, !blockUsed); if (kd === 'block') blockUsed = true; add(kd, lane, z); }
      for (i = 0; i < 4; i++) add('coin', free, z - 14 + i * 12, 9);
      len = 24;
    } else if (pat === 'wall') {
      var kw = Math.random() < 0.55 ? 'low' : 'high';
      for (lane = -1; lane <= 1; lane++) add(kw, lane, z);
      for (i = 0; i < 3; i++) add('coin', U.randInt(-1, 2), z + 16 + i * 10, kw === 'low' ? 22 : 9);
    } else if (pat === 'coins') {
      lane = U.randInt(-1, 2); var n = U.randInt(5, 9);
      for (i = 0; i < n; i++) add('coin', lane, z + i * 11, 9);
      len = n * 11;
    } else if (pat === 'jumpcoins') {
      lane = U.randInt(-1, 2); add('low', lane, z);
      [[-24, 9], [-12, 19], [0, 27], [12, 19], [24, 9]].forEach(function (c) { add('coin', lane, z + c[0], c[1]); });
      len = 24;
    } else if (pat === 'power') {
      lane = U.randInt(-1, 2); powerFlip = !powerFlip;
      add(powerFlip ? 'magnet' : 'shield', lane, z, 12);
      for (i = 1; i <= 3; i++) add('coin', lane, z + i * 12, 9);
      var other = lane === 0 ? 1 : 0; if (Math.random() < 0.5) add('low', other === lane ? -1 : other, z + 20);
      len = 36;
    }
    nextRow = len + speed * U.rand(1.0, 1.5 - 0.2 * d);
  }

  function addCoins(n, how) {
    coins += n; R.addScore(5 * n);
    if (how === 'magnet') { magnetCoins += n; if (magnetCoins >= 10) R.achieve('magnet-master'); }
    if (coins >= 40) R.achieve('coin-rush');
  }

  function hurt(o) {
    if (invuln > 0 || dead) return;
    if (shieldT > 0) {
      shieldT = 0; invuln = 1.0; R.achieve('shield-saver');
      R.sfx.play('powerup'); R.vibrate(30); R.fx.flash(CYAN, 0.15);
      R.fx.burst(CX, PY - 14, { n: 20, color: [CYAN, '#ffffff', '#9affc8'], speed: 90, life: 0.5, size: 2 });
      o.dead = true; return;
    }
    R.lives = Math.max(0, R.lives - 1);
    o.dead = true;
    R.sfx.play('hit'); R.vibrate(80); R.fx.shake(3, 0.3); hitFlash = 0.25;
    R.fx.burst(CX, PY - 12, { n: 20, color: [PINK, '#ffffff', ORG, MAG], speed: 100, life: 0.5, size: 2, gravity: 80 });
    if (R.lives <= 0) { dead = true; deadT = 0.85; sliding = 0; R.fx.flash('#ffffff', 0.2); }
    else invuln = INVULN;
  }

  R.game({
    layout: 'full', size: [W, H], bg: '#0a0225', music: 'action',

    _dbg: function () { return { objs: objs, px: px, tl: tl, jy: jy, sliding: sliding, speed: speed, dist: dist, dead: dead, lives: R.lives, invuln: invuln, K: { LOW_H: LOW_H, LANE_HIT: LANE_HIT } }; }, /*DBG*/

    init: function () { buildSprites(); },

    reset: function () {
      objs = []; px = 0; tl = 0; jy = 0; jvy = 0; sliding = 0; slideQ = false; jbuf = 0; dist = 0; speed = 88; time = 0; nextRow = 70; nextPower = 14;
      coins = 0; magnetT = 0; shieldT = 0; invuln = 0; dead = false; deadT = 0; anim = 0; hitFlash = 0; magnetCoins = 0; camX = 0; powerFlip = false;
      R.lives = 3; R.level = 1; R.score = 0;
    },

    update: function (dt) {
      var inp = R.input, i, o;
      time += dt;
      if (dead) { deadT -= dt; anim += dt * 4; if (deadT <= 0) R.gameOver(); return; }
      speed = 88 + 92 * (1 - Math.exp(-time / 75));
      dist += speed * dt; anim += dt * (7 + speed / 16);
      R.level = 1 + Math.floor(time / 20);
      /* lane change */
      if (inp.pressed('left') && tl > -1) { tl--; R.sfx.tone(380, 0.05, { vol: 0.06, type: 'triangle', slide: 560 }); }
      if (inp.pressed('right') && tl < 1) { tl++; R.sfx.tone(380, 0.05, { vol: 0.06, type: 'triangle', slide: 560 }); }
      var dx = tl - px, step = 7.2 * dt;
      px += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
      camX += (px * 0.55 - camX) * Math.min(1, dt * 8);
      /* jump / slide */
      var wantJump = inp.pressed('a') || inp.pressed('up'), wantSlide = inp.pressed('b') || inp.pressed('down');
      jbuf = wantJump ? 0.12 : jbuf - dt;
      var air = jy > 0 || jvy > 0;
      if (!air && jbuf > 0) { jvy = JUMP_V; jy = 0.01; sliding = 0; jbuf = 0; R.sfx.play('jump'); R.vibrate(8); R.fx.burst(CX, PY, { n: 6, color: [CYAN, MAG], speed: 50, life: 0.3, size: 1, gravity: 40 }); air = true; }
      if (wantSlide) {
        if (air) { slideQ = true; jvy = Math.min(jvy, -90); }                  // dive: fall fast, slide on landing
        else if (!sliding) { sliding = SLIDE_T; R.sfx.tone(300, 0.2, { type: 'sawtooth', vol: 0.06, slide: 90 }); }
      }
      if (air || jy > 0) {
        var gmul = slideQ ? 3.2 : 1;
        jvy -= GRAV * gmul * dt; jy += jvy * dt;
        if (jy <= 0) {
          jy = 0; jvy = 0;
          R.fx.burst(CX, PY, { n: 5, color: [CYAN, '#ffffff'], speed: 40, life: 0.25, size: 1, gravity: 30 });
          if (slideQ) { sliding = SLIDE_T; slideQ = false; R.sfx.tone(300, 0.2, { type: 'sawtooth', vol: 0.06, slide: 90 }); }
        }
      }
      if (sliding > 0) {
        sliding = Math.max(0, sliding - dt);
        if (Math.random() < 0.6) R.fx.burst(CX, PY - 1, { n: 1, color: [YEL, ORG, '#ffffff'], speed: 45, life: 0.25, size: 1, gravity: 120 });
      }
      if (invuln > 0) invuln -= dt;
      if (hitFlash > 0) hitFlash -= dt;
      if (magnetT > 0) magnetT -= dt;
      if (shieldT > 0) shieldT -= dt;
      /* world */
      nextRow -= speed * dt;
      if (nextRow <= 0) spawnRow();
      var pcy = jy + (sliding > 0 ? SLIDE_H / 2 : 13);
      for (i = objs.length - 1; i >= 0; i--) {
        o = objs[i];
        o.z -= speed * dt; o.spin += dt * 6;
        if (o.k === 'coin' && magnetT > 0 && o.z < 130 && o.z > -4) {
          o.lane += (px - o.lane) * Math.min(1, 6 * dt); o.z -= 70 * dt; o.h += (pcy - o.h) * Math.min(1, 6 * dt);
        }
        if (!o.checked && o.z <= 0) {
          o.checked = true;
          var near = Math.abs(px - o.lane) < (o.k === 'coin' || o.k === 'magnet' || o.k === 'shield' ? 0.75 : LANE_HIT);
          if (near && !o.dead) {
            if (o.k === 'coin') {
              if (Math.abs(o.h - pcy) < 17) { o.dead = true; addCoins(1, magnetT > 0 ? 'magnet' : null); R.sfx.play('coin'); R.vibrate(6); R.fx.burst(sx(o.lane, 1), PY - o.h, { n: 6, color: [YEL, '#ffffff', ORG], speed: 55, life: 0.35, size: 1 }); }
            } else if (o.k === 'magnet' || o.k === 'shield') {
              o.dead = true; R.sfx.play('powerup'); R.vibrate(20); R.fx.flash('#ffffff', 0.1);
              R.fx.burst(sx(o.lane, 1), PY - 14, { n: 14, color: [CYAN, '#ffffff', YEL], speed: 70, life: 0.5, size: 2 });
              if (o.k === 'magnet') { magnetT = 7; R.fx.text(CX, PY - 40, 'MAGNET!', CYAN); } else { shieldT = 10; R.fx.text(CX, PY - 40, 'SHIELD!', '#9affc8'); }
            } else if (o.k === 'low') { if (jy < LOW_H) hurt(o); }
            else if (o.k === 'high') { var top = jy + (sliding > 0 ? SLIDE_H : STAND_H); if (top > BEAM_LO && jy < BEAM_HI) hurt(o); }
            else if (o.k === 'block') hurt(o);
            if (dead) return;
          }
        }
        if (o.z < -26) objs.splice(i, 1);
      }
      if (R.score >= 1500) R.achieve('synth-rider');
    },

    render: function (ctx, w, h) {
      var i;
      drawBackdrop(ctx, w);
      drawGround(ctx, w, h);
      drawRoad(ctx);
      var far = [], near = [];
      for (i = 0; i < objs.length; i++) { if (objs[i].dead) continue; (objs[i].z > -2 ? far : near).push(objs[i]); }
      far.sort(function (a, b) { return b.z - a.z; });
      for (i = 0; i < far.length; i++) drawObj(ctx, far[i]);
      drawPlayer(ctx);
      for (i = 0; i < near.length; i++) drawObj(ctx, near[i]);
      /* HUD */
      R.draw.topBar(ctx);
      ctx.fillStyle = YEL; ctx.fillRect(w - 24, 16, 5, 5); ctx.fillStyle = '#a85a00'; ctx.fillRect(w - 23, 17, 3, 3); ctx.fillStyle = '#fff6b0'; ctx.fillRect(w - 23, 17, 1, 2);
      R.draw.text(ctx, String(coins), w - 3, 15, { size: 6, color: YEL, align: 'right', shadow: '#000' });
      if (magnetT > 0 && (magnetT > 1.5 || Math.floor(time * 8) % 2)) hudBar(ctx, 3, 15, magnetT / 7, CYAN, 'MAG');
      if (shieldT > 0 && (shieldT > 1.5 || Math.floor(time * 8) % 2)) hudBar(ctx, 3, magnetT > 0 ? 24 : 15, shieldT / 10, '#9affc8', 'SHD');
      if (hitFlash > 0) { ctx.globalAlpha = hitFlash * 1.6; ctx.fillStyle = '#ff2040'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    }
  });

  /* ------------------------------------------------------------------ drawing */
  function hudBar(ctx, x, y, f, col, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, 30, 7);
    ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round(28 * f)), 5);
    R.draw.text(ctx, label, x + 2, y + 1, { size: 5, color: '#10131c' });
  }
  var SKY = ['#0a0225', '#14043a', '#210552', '#36086a', '#520b7c', '#7a1088', '#a51a8c', '#cf2c84', '#f04a78', '#ff7168', '#ff9a5a', '#ffbd5e'];
  function drawBackdrop(ctx, w) {
    var i, bh = Math.ceil(HZ / SKY.length);
    for (i = 0; i < SKY.length; i++) { ctx.fillStyle = SKY[i]; ctx.fillRect(0, i * bh, w, bh + 1); }
    // stars
    for (i = 0; i < 34; i++) {
      var sxp = Math.floor(hash(i * 7 + 1) * w), syp = Math.floor(hash(i * 13 + 5) * 30), tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.7 + i));
      ctx.globalAlpha = tw * (1 - syp / 36); ctx.fillStyle = '#ffffff'; ctx.fillRect(sxp, syp, 1, 1);
    }
    ctx.globalAlpha = 1;
    // sun with cut-out stripes
    var sc = 26, cx = CX - Math.round(camX * 3), r;
    for (var y = HZ - sc; y < HZ; y++) {
      var j = HZ - y, half = Math.floor(Math.sqrt(sc * sc - j * j + 0.5));
      if (j < 20 && (j % 5) < Math.floor((20 - j) / 5)) continue;
      var t = (y - (HZ - sc)) / sc;
      ctx.fillStyle = rgb(mix(hex('#fff27a'), hex('#ff3fa0'), Math.pow(t, 0.9)));
      ctx.fillRect(cx - half, y, half * 2, 1);
    }
    // skyline
    var off = Math.round(camX * 6), x;
    for (x = -10; x < w + 10; x += 9) {
      var bi = Math.floor((x + off + 1000) / 9), bhh = 6 + Math.floor(hash(bi * 5 + 3) * 18), bx = bi * 9 - off - 1000;
      if (Math.abs(bx + 4 - CX) < 22 && bhh > 12) bhh = 8 + (bhh % 5);
      ctx.fillStyle = '#16043a'; ctx.fillRect(bx, HZ - bhh, 8, bhh);
      ctx.fillStyle = '#2a0a5a'; ctx.fillRect(bx, HZ - bhh, 8, 1);
      for (var wy = HZ - bhh + 3; wy < HZ - 2; wy += 4) if (hash(bi * 11 + wy) > 0.55) { ctx.fillStyle = hash(bi + wy) > 0.5 ? CYAN : PINK; ctx.fillRect(bx + 2 + (wy % 3) * 2, wy, 2, 1); }
    }
    // horizon glow line
    ctx.fillStyle = '#ffd0a0'; ctx.fillRect(0, HZ, w, 1);
  }
  function drawGround(ctx, w, h) {
    var i, n = 10;
    for (i = 0; i < n; i++) { ctx.fillStyle = rgb(mix(hex('#3a0a64'), hex('#0b0220'), Math.pow(i / (n - 1), 0.7))); ctx.fillRect(0, HZ + 1 + Math.floor(i * (h - HZ) / n), w, Math.ceil((h - HZ) / n) + 1); }
    // horizontal grid lines scrolling toward the camera
    var GS = 40, o = dist % GS, k;
    for (k = -1; k < 12; k++) {
      var z = k * GS - o; if (z > 560 || z < -24) continue;
      var p = proj(z), y = Math.round(sy(p));
      ctx.globalAlpha = U.clamp(0.9 * p + 0.1, 0.12, 0.85); ctx.fillStyle = MAG; ctx.fillRect(0, y, w, 1);
    }
    ctx.globalAlpha = 1;
    // converging verticals outside the road
    ctx.lineWidth = 1;
    for (var l = -12; l <= 12; l++) {
      if (Math.abs(l) < 2) continue;
      var lane = l * 1.2;
      ctx.globalAlpha = 0.5; ctx.strokeStyle = MAG;
      ctx.beginPath(); ctx.moveTo(sx(lane, 0.02), sy(0.02)); ctx.lineTo(sx(lane, 1.35), sy(1.35)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function quad(ctx, l0, l1, zA, zB, col) {
    var pa = proj(zA), pb = proj(zB);
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(sx(l0, pa), sy(pa)); ctx.lineTo(sx(l1, pa), sy(pa)); ctx.lineTo(sx(l1, pb), sy(pb)); ctx.lineTo(sx(l0, pb), sy(pb)); ctx.closePath(); ctx.fill();
  }
  function drawRoad(ctx) {
    var i, ZN = -26, ZF = 3000;
    quad(ctx, -1.5, 1.5, ZF, ZN, '#120628');
    quad(ctx, -1.5, 1.5, 260, ZN, '#190a38');
    // horizontal rungs on the road
    var GS = 40, o = dist % GS;
    for (i = -1; i < 9; i++) {
      var z = i * GS - o; if (z > 360 || z < -24) continue;
      var p = proj(z), y = Math.round(sy(p));
      ctx.globalAlpha = 0.28 * p + 0.06; ctx.fillStyle = CYAN; ctx.fillRect(Math.round(sx(-1.5, p)), y, Math.round(sx(1.5, p) - sx(-1.5, p)), 1);
    }
    ctx.globalAlpha = 1;
    // lane dividers (dashes)
    var D = 22, od = (dist * 1) % (D * 2), k;
    for (k = -1; k < 14; k++) {
      var za = k * D * 2 - od, zb = za + D; if (za < ZN) za = ZN; if (zb < ZN || za > 420) continue;
      var pa = proj(za), alpha = U.clamp(pa * 1.2, 0.2, 1);
      ctx.globalAlpha = alpha; quad(ctx, -0.5 - 0.025, -0.5 + 0.025, zb, za, '#d9f6ff'); quad(ctx, 0.5 - 0.025, 0.5 + 0.025, zb, za, '#d9f6ff');
    }
    ctx.globalAlpha = 1;
    // neon edges (glow + core)
    var pF = 0.02, pN = 1.4, e;
    for (e = -1; e <= 1; e += 2) {
      var col = e < 0 ? CYAN : MAG, lane = 1.5 * e;
      ctx.strokeStyle = col; ctx.globalAlpha = 0.28; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sx(lane, pF), sy(pF)); ctx.lineTo(sx(lane, pN), sy(pN)); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx(lane, pF), sy(pF)); ctx.lineTo(sx(lane, pN), sy(pN)); ctx.stroke();
    }
    ctx.lineWidth = 1;
    // roadside pylons
    var PS = 70, op = dist % PS;
    for (k = 6; k >= -1; k--) {
      var zp = k * PS - op; if (zp < -20 || zp > 380) continue;
      var pp = proj(zp), side;
      for (side = -1; side <= 1; side += 2) {
        var x = Math.round(sx(side * 2.0, pp)), y = Math.round(sy(pp)), ph = Math.max(2, Math.round(30 * pp)), pw = Math.max(1, Math.round(3 * pp));
        ctx.globalAlpha = U.clamp(pp * 1.5, 0.25, 1);
        ctx.fillStyle = '#2a0f5a'; ctx.fillRect(x - pw, y - ph, pw * 2, ph);
        ctx.fillStyle = side < 0 ? CYAN : MAG; ctx.fillRect(x - pw, y - ph, pw * 2, Math.max(1, Math.round(3 * pp)));
        ctx.globalAlpha = 0.25 * U.clamp(pp * 1.5, 0.25, 1); ctx.fillRect(x - pw - 1, y - ph - 1, pw * 2 + 2, Math.max(2, Math.round(5 * pp)));
        ctx.globalAlpha = 1;
      }
    }
  }

  function glowRect(ctx, x, y, w, h, col, core) {
    ctx.globalAlpha = 0.28; ctx.fillStyle = col; ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
    if (core) { ctx.fillStyle = core; ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(1, Math.min(h - 2, 2))); }
  }
  function drawObj(ctx, o) {
    var p = proj(o.z); if (p > 2.2) return;
    var x = sx(o.lane, p), y = sy(p), fade = o.z > Z_FADE ? U.clamp(1 - (o.z - Z_FADE) / (Z_SPAWN - Z_FADE + 20), 0, 1) : 1;
    ctx.globalAlpha = fade;
    var bw = 26 * p, i;
    if (o.k === 'low') {
      var hh = LOW_H * p, pw = Math.max(1, 2.6 * p);
      ctx.globalAlpha = fade * 0.35; ctx.fillStyle = '#000'; ctx.fillRect(x - bw / 2, y - 1, bw, Math.max(1, 3 * p));
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#2b0a4a'; ctx.fillRect(x - bw / 2, y - hh, pw, hh); ctx.fillRect(x + bw / 2 - pw, y - hh, pw, hh);
      glowRect(ctx, x - bw / 2, y - hh, bw, Math.max(2, 4.5 * p), MAG, '#ffd0f4');
      ctx.fillStyle = PINK; ctx.fillRect(x - bw / 2, y - hh * 0.45, bw, Math.max(1, 1.6 * p));
    } else if (o.k === 'high') {
      var pw2 = Math.max(1, 2.6 * p), top = 34 * p;
      ctx.globalAlpha = fade * 0.35; ctx.fillStyle = '#000'; ctx.fillRect(x - bw / 2, y - 1, bw, Math.max(1, 3 * p));
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#10305a'; ctx.fillRect(x - bw / 2 - pw2, y - top, pw2, top); ctx.fillRect(x + bw / 2, y - top, pw2, top);
      ctx.fillStyle = CYAN; ctx.fillRect(x - bw / 2 - pw2, y - top, 1, top); ctx.fillRect(x + bw / 2 + pw2 - 1, y - top, 1, top);
      var by0 = y - BEAM_HI * p, bh = (BEAM_HI - BEAM_LO) * p;
      glowRect(ctx, x - bw / 2 - pw2, by0, bw + pw2 * 2, bh, CYAN, '#d9fbff');
      ctx.fillStyle = '#0a2a4a';
      for (i = 0; i < 6; i++) ctx.fillRect(x - bw / 2 + i * (bw / 6) + 1, by0 + bh * 0.45, Math.max(1, bw / 12), Math.max(1, bh * 0.45));
    } else if (o.k === 'block') {
      var bh2 = 34 * p, bwd = 27 * p;
      ctx.globalAlpha = fade * 0.4; ctx.fillStyle = '#000'; ctx.fillRect(x - bwd / 2, y - 1, bwd, Math.max(1, 3 * p));
      ctx.globalAlpha = 1 * fade;
      glowRect(ctx, x - bwd / 2, y - bh2, bwd, bh2, ORG, null);
      ctx.fillStyle = '#4a1060'; ctx.fillRect(x - bwd / 2 + 2 * p, y - bh2 + 2 * p, bwd - 4 * p, bh2 - 4 * p);
      ctx.fillStyle = '#ffd08a'; ctx.fillRect(x - bwd / 2, y - bh2, bwd, Math.max(1, 3 * p));
      ctx.strokeStyle = ORG; ctx.lineWidth = Math.max(1, 2 * p);
      ctx.beginPath(); ctx.moveTo(x - bwd / 2 + 3 * p, y - bh2 + 5 * p); ctx.lineTo(x + bwd / 2 - 3 * p, y - 3 * p); ctx.moveTo(x + bwd / 2 - 3 * p, y - bh2 + 5 * p); ctx.lineTo(x - bwd / 2 + 3 * p, y - 3 * p); ctx.stroke(); ctx.lineWidth = 1;
    } else if (o.k === 'coin') {
      var cy = y - o.h * p, rw = Math.max(1, 5.5 * p * Math.abs(Math.cos(o.spin))), rh = 5.5 * p;
      ctx.globalAlpha = fade * 0.3; ctx.fillStyle = YEL; ctx.beginPath(); ctx.ellipse(x, cy, rw + 1.5, rh + 1.5, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = fade; ctx.fillStyle = YEL; ctx.beginPath(); ctx.ellipse(x, cy, rw, rh, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#a85a00'; ctx.beginPath(); ctx.ellipse(x, cy, Math.max(0.5, rw * 0.5), rh * 0.55, 0, 0, 7); ctx.fill();
      if (rw > 2) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(x - rw * 0.6, cy - rh * 0.5, Math.max(1, p), Math.max(1, rh * 0.6)); }
      ctx.globalAlpha = fade * 0.25; ctx.fillStyle = '#000'; ctx.fillRect(x - 3 * p, y - 1, 6 * p, Math.max(1, p));
    } else {
      var cy2 = y - (14 + Math.sin(time * 4 + o.z * 0.1) * 2) * p, s = 9 * p, magnet = o.k === 'magnet', col2 = magnet ? CYAN : '#9affc8';
      ctx.globalAlpha = fade * 0.3; ctx.fillStyle = col2; ctx.beginPath(); ctx.arc(x, cy2, s * 1.5, 0, 7); ctx.fill();
      ctx.globalAlpha = fade; ctx.fillStyle = '#10131c'; ctx.beginPath(); ctx.arc(x, cy2, s * 1.1, 0, 7); ctx.fill();
      ctx.strokeStyle = col2; ctx.lineWidth = Math.max(1, 1.5 * p); ctx.beginPath(); ctx.arc(x, cy2, s * 1.1, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      if (magnet) {
        ctx.fillStyle = '#ff3d6e'; ctx.fillRect(x - s * 0.7, cy2 - s * 0.7, Math.max(1, s * 0.4), s * 0.8); ctx.fillStyle = '#3d9bff'; ctx.fillRect(x + s * 0.3, cy2 - s * 0.7, Math.max(1, s * 0.4), s * 0.8);
        ctx.fillStyle = '#dfe8ff'; ctx.fillRect(x - s * 0.7, cy2 + s * 0.05, s * 1.4, Math.max(1, s * 0.35));
      } else {
        ctx.fillStyle = '#9affc8'; ctx.beginPath(); ctx.moveTo(x - s * 0.6, cy2 - s * 0.6); ctx.lineTo(x + s * 0.6, cy2 - s * 0.6); ctx.lineTo(x + s * 0.6, cy2 + s * 0.1); ctx.lineTo(x, cy2 + s * 0.75); ctx.lineTo(x - s * 0.6, cy2 + s * 0.1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#10131c'; ctx.fillRect(x - s * 0.15, cy2 - s * 0.35, Math.max(1, s * 0.3), s * 0.7);
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawPlayer(ctx) {
    var x = Math.round(sx(px, 1)), y = Math.round(PY - jy), fr = jy > 1 ? 2 : (Math.floor(anim) & 1);
    // shadow
    ctx.globalAlpha = 0.45 * U.clamp(1 - jy / 40, 0.3, 1); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, PY + 1, 9, 2.2, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    // speed glow under feet
    ctx.globalAlpha = 0.25; ctx.fillStyle = CYAN; ctx.fillRect(x - 6, PY, 12, 1); ctx.globalAlpha = 1;
    if (invuln > 0 && !dead && Math.floor(time * 14) % 2) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (dead) { ctx.translate(x, y - 2); ctx.rotate(Math.min(1.3, anim * 0.9)); ctx.translate(-8, -22); ctx.drawImage(S.run[2], 0, 0); }
    else if (sliding > 0 && jy < 1) { ctx.translate(x, y); ctx.scale(1.3, 0.5); ctx.rotate(-0.0); ctx.drawImage(S.run[0], -8, -24); }
    else ctx.drawImage(S.run[fr], x - 8, y - 24);
    ctx.restore();
    if (shieldT > 0) {
      var a = 0.45 + 0.25 * Math.sin(time * 8), cy = y - (sliding > 0 ? 6 : 13);
      ctx.globalAlpha = (shieldT > 1.5 || Math.floor(time * 10) % 2) ? a : 0.1; ctx.strokeStyle = '#9affc8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, cy, 12, sliding > 0 ? 9 : 17, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = '#9affc8'; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
  }
})();
