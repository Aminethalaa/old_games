/* Star Fighter — swooping-swarm space shooter, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 160, H = 320, PLAYER_Y = 298, FDX = 14, FDY = 14, FY0 = 48, STEP16 = Math.PI / 8;
  var ROW_TYPE = [0, 1, 1, 2, 2];          // rows: boss, butterfly, butterfly, bee, bee
  var HP = [2, 1, 1];
  var SCORE_FORM = [150, 80, 50], SCORE_DIVE = [400, 160, 100];
  var COLORS = [['#00e436', '#b455ff', '#fff1e8'], ['#ff004d', '#ff77a8', '#fff1e8'], ['#ffec27', '#29adff', '#fff1e8']];
  /* formation slots [row, col], delivered in five entry groups of eight */
  var SLOT_GROUPS = [
    [[0, 3], [0, 4], [0, 5], [0, 6], [1, 3], [1, 4], [1, 5], [1, 6]],
    [[1, 1], [1, 2], [1, 7], [1, 8], [2, 3], [2, 4], [2, 5], [2, 6]],
    [[2, 1], [2, 2], [2, 7], [2, 8], [3, 3], [3, 4], [3, 5], [3, 6]],
    [[3, 0], [3, 1], [3, 2], [3, 7], [3, 8], [3, 9], [4, 4], [4, 5]],
    [[4, 0], [4, 1], [4, 2], [4, 3], [4, 6], [4, 7], [4, 8], [4, 9]]
  ];
  function mirror(pts) { return pts.map(function (p) { return [W - p[0], p[1]]; }); }
  var A = [[28, -14], [34, 56], [56, 126], [104, 160], [124, 126], [100, 92]];
  var B = [[-14, 210], [46, 196], [104, 170], [130, 128], [102, 96]];
  var CC = [[80, -14], [82, 50], [126, 104], [92, 160], [40, 132], [62, 92]];
  var ENTRY_DEFS = [A, mirror(A), B, mirror(B), CC];
  var CH1 = [[30, -14], [30, 50], [112, 96], [48, 152], [116, 208], [60, 262], [60, 346]];
  var CH3 = [[-14, 88], [70, 96], [126, 140], [90, 190], [40, 150], [74, 100], [150, 60], [176, 40]];
  var CH5 = [[80, -14], [112, 60], [48, 130], [112, 200], [48, 270], [80, 346]];
  var CHAL_DEFS = [CH1, mirror(CH1), CH3, mirror(CH3), CH5];
  var CHAL_TYPES = [2, 1, 2, 1, 0];

  /* ---------------------------------------------------------- pixel art */
  var BEE = [[
    '.k.......k.', '.wk.yyy.kw.', 'ww.yyyyy.ww', 'wwyybybyyww', '.wyyyyyyyw.',
    '..yyyyyyy..', '...yoyoy...', '..y.yyy.y..', '.....y.....'], [
    '...........', '.k.yyyyy.k.', 'wwyyyyyyyww', 'wwyybybyyww', '.wyyyyyyyw.',
    '..yyyyyyy..', '...yoyoy...', '..y.yyy.y..', '.....y.....']];
  var BEE_PAL = { y: '#ffec27', b: '#29adff', o: '#ffa300', w: '#fff1e8', k: '#10131c' };
  var BUT = [[
    '.m.......m.', '.mm.rrr.mm.', 'mmmrrrrrmmm', 'mmrrwrwrrmm', '.mrrrrrrrm.',
    '..brrrrrb..', '...bwrwb...', '..b..r..b..', '.....r.....'], [
    '...........', 'mm..rrr..mm', 'mmmrrrrrmmm', 'mmrrwrwrrmm', '.mrrrrrrrm.',
    '..brrrrrb..', '...bwrwb...', '.b...r...b.', '.....r.....']];
  var BUT_PAL = { m: '#ff77a8', r: '#ff004d', b: '#29adff', w: '#fff1e8' };
  var BOSS = [[
    '..p.......p..', '.ppg.....gpp.', 'ppgggg.ggggpp', 'pgllwgggwllgp', '.gggggbggggg.', '..gggbbbggg..',
    '...ggggggg...', '..gg.ggg.gg..', '..g..ggg..g..', '.g...ggg...g.', '.....ggg.....'], [
    '.p.........p.', '.ppg.....gpp.', 'ppgggg.ggggpp', 'pgllwgggwllgp', '.gggggbggggg.', '..gggbbbggg..',
    '...ggggggg...', '..gg.ggg.gg..', '.gg..ggg..gg.', '.g...ggg...g.', '.....ggg.....']];
  var BOSS_PAL = { g: '#00e436', l: '#7dff7a', p: '#b455ff', b: '#29adff', w: '#fff1e8' };
  var BOSS_HURT_PAL = { g: '#29adff', l: '#9bdcff', p: '#ff77a8', b: '#ffec27', w: '#fff1e8' };
  var SHIP = [
    '......w......', '......w......', '.....wcw.....', '.....wcw.....', '.r...wcw...r.', '.r..wwcww..r.',
    '.rr.wwcww.rr.', 'wrrwwwcwwwrrw', 'wrrwwwwwwwrrw', 'wwwwbwwwbwwww', '.bw.......wb.', '.b.........b.'];
  var SHIP_PAL = { w: '#fff1e8', c: '#3de2ff', r: '#ff004d', b: '#29adff' };
  var CAPT_PAL = { w: '#ffb3c6', c: '#ff004d', r: '#ff77a8', b: '#ff004d' };
  var CAPSULE = [
    '.bbbbbbb.', 'bwwwwwwwb', 'bwwbbbwwb', 'bwwbwwbwb', 'bwwbwwbwb', 'bwwbbbwwb', 'bwwwwwwwb', '.bbbbbbb.'];
  var CAPSULE_PAL = { b: '#29adff', w: '#fff1e8' };
  var SPR = { enemy: [], boss: null, bossHurt: null, ship: null, capt: null, capsule: null };

  /* ---------------------------------------------------------- paths */
  function makePath(pts) {
    var n = pts.length, P = [pts[0]].concat(pts, [pts[n - 1]]), dense = [], i, k;
    for (i = 0; i < n - 1; i++) {
      var p0 = P[i], p1 = P[i + 1], p2 = P[i + 2], p3 = P[i + 3];
      for (k = 0; k < 14; k++) {
        var t = k / 14, t2 = t * t, t3 = t2 * t;
        dense.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    dense.push(pts[n - 1]);
    var cum = [0];
    for (i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    return { p: dense, c: cum, len: cum[cum.length - 1] };
  }
  /** position and heading at distance s along a path */
  function pathAt(path, s, out) {
    if (s <= 0) { out.x = path.p[0][0]; out.y = path.p[0][1]; }
    var lo = 0, hi = path.c.length - 1;
    s = Math.max(0, Math.min(s, path.len));
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (path.c[mid] <= s) lo = mid; else hi = mid; }
    var seg = path.c[hi] - path.c[lo] || 1, f = (s - path.c[lo]) / seg, a = path.p[lo], b = path.p[hi];
    out.x = a[0] + (b[0] - a[0]) * f; out.y = a[1] + (b[1] - a[1]) * f;
    out.ang = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2;
  }

  /* ---------------------------------------------------------- state */
  var enemies, pbullets, ebullets, capsules, stars, player, form, bombFx, freed;
  var wave, ws, wsT, challenge, chHits, chTotal, diveT, shootT, bossKills, nextLife, tAnim, bombId, beamSnd;
  var ENTRY_PATHS, CHAL_PATHS;

  function isChallenge(n) { return n % 4 === 0; }
  function slotX(c) { var b = 1 + 0.07 * form.amp * Math.sin(form.t * 1.3); return 80 + (c - 4.5) * FDX * b + Math.sin(form.t * 0.7) * 6 * (0.4 + 0.6 * form.amp); }
  function slotY(r) { return FY0 + r * FDY; }

  function makeStars() {
    stars = [];
    var layers = [{ n: 26, v: 12, s: 1, c: '#34447a' }, { n: 18, v: 32, s: 1, c: '#7f95d6' }, { n: 9, v: 66, s: 2, c: '#cfe0ff' }], i, l;
    for (l = 0; l < layers.length; l++) for (i = 0; i < layers[l].n; i++) {
      stars.push({ x: U.rand(0, W), y: U.rand(0, H), v: layers[l].v, s: layers[l].s, c: Math.random() < 0.12 ? U.pick(['#ff77a8', '#3de2ff', '#ffec27']) : layers[l].c });
    }
  }

  function newPlayer() {
    return { x: W / 2, y: PLAYER_Y, mode: 'alive', cool: 0, invuln: 0, dual: false, deadT: 0, ang: 0, capBoss: null, capT: 0 };
  }

  function setupWave() {
    challenge = isChallenge(wave);
    R.level = wave;
    enemies = []; ebullets.length = 0; pbullets.length = 0; capsules.length = 0; freed = null; bombFx = null;
    form.amp = 0; chHits = 0; chTotal = 0;
    var G = challenge ? 2.3 : Math.max(1.5, 2.2 - 0.06 * wave), speed = Math.min(205, 142 + 5 * wave);
    SLOT_GROUPS.forEach(function (grp, gi) {
      grp.forEach(function (sl, k) {
        var type = challenge ? CHAL_TYPES[gi] : ROW_TYPE[sl[0]];
        enemies.push({
          type: type, c: sl[1], r: sl[0], group: gi, state: 'wait', delay: 0.6 + gi * G + k * 0.15, x: -30, y: -30, ang: 0,
          hp: challenge ? 1 : HP[type], flap: Math.random() * 6, s: 0, speed: speed, path: challenge ? CHAL_PATHS[gi] : ENTRY_PATHS[gi],
          capt: false, hurt: 0, bomb: 0, shots: 0, fireT: 0, beamT: 0, kind: ''
        });
      });
    });
    chTotal = enemies.length;
    ws = 'intro'; wsT = 1.7;
    diveT = 2.4; shootT = 2.2;
  }

  function aliveCount() { return enemies.length; }

  /* ---------------------------------------------------------- helpers */
  function hw(e) { return e.type === 0 ? 6.5 : 5.5; }
  function hh(e) { return e.type === 0 ? 5.5 : 4.5; }

  function checkLife() {
    if (R.score >= nextLife) {
      nextLife += 15000;
      if (R.lives < 6) { R.lives++; R.sfx.play('powerup'); R.fx.text(W / 2, 250, '1UP!', C.lime); }
    }
  }
  function boom(x, y, cols, n, speed) { R.fx.burst(x, y, { n: n || 14, color: cols, speed: speed || 80, life: 0.55, size: 2 }); }

  function playerBox() {
    var p = player, hwid = p.dual ? 12 : 5;
    return { x: p.x - hwid, y: PLAYER_Y - 6, w: hwid * 2, h: 12 };
  }

  function moveToward(e, tx, ty, speed, dt) {
    var dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy), st = speed * dt;
    if (d <= st) { e.x = tx; e.y = ty; return true; }
    e.x += dx / d * st; e.y += dy / d * st;
    e.ang = Math.atan2(dy, dx) - Math.PI / 2;
    return false;
  }

  /* ---------------------------------------------------------- enemy actions */
  function enemyShoot(e, aimed) {
    var maxEB = Math.min(6, 2 + Math.floor(wave / 2));
    if (ebullets.length >= maxEB || player.mode !== 'alive') return;
    var a = Math.atan2(PLAYER_Y - e.y, player.x - e.x) + (aimed ? U.rand(-0.1, 0.1) : U.rand(-0.35, 0.35));
    if (Math.sin(a) < 0.4) a = Math.PI / 2 + (Math.cos(a) < 0 ? 0.5 : -0.5);
    var sp = Math.min(135, 76 + wave * 4);
    ebullets.push({ x: e.x, y: e.y + 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
    R.sfx.tone(560, 0.08, { type: 'sawtooth', vol: 0.045, slide: 220 });
  }

  function diveWaypoints(e, kind) {
    var x0 = e.x, y0 = e.y, px = player.x, s = x0 < W / 2 ? 1 : -1;
    function cl(x) { return U.clamp(x, 10, W - 10); }
    if (kind === 'bee') return [[x0, y0], [cl(x0 + s * 26), y0 - 14], [cl(x0 + s * 40), y0 + 36], [cl((x0 + px) / 2 + s * 20), 120], [cl(px - s * 26), 176], [cl(px), 240], [cl(px + s * 10), 300], [cl(px), 346]];
    if (kind === 'butterfly') return [[x0, y0], [cl(x0 - s * 20), y0 + 22], [cl(x0 + s * 26), y0 + 62], [cl(px + s * 34), 118], [cl(px - s * 34), 168], [cl(px + s * 26), 220], [cl(px - s * 10), 282], [cl(px), 346]];
    if (kind === 'boss') return [[x0, y0], [cl(x0 + s * 30), y0 - 10], [cl(x0 + s * 44), y0 + 40], [cl(px), 118], [cl(px - s * 28), 178], [cl(px + s * 18), 240], [cl(px), 346]];
    // tractor-beam approach
    return [[x0, y0], [cl(x0 + s * 24), y0 + 24], [cl((x0 + px) / 2), 112], [cl(px), 178]];
  }

  function launchDive(e, kind, delay) {
    e.state = 'dive'; e.kind = kind;
    e.path = makePath(diveWaypoints(e, kind));
    e.speed = Math.min(176, 98 + 7 * wave) * (kind === 'bee' ? 1.15 : kind === 'boss' ? 0.9 : 1);
    e.s = -(delay || 0) * e.speed; e.shots = 0; e.fireT = U.rand(0.5, 1.1);
    if (kind === 'tractor') e.speed = 105;
    R.sfx.tone(760, 0.22, { type: 'triangle', vol: 0.05, slide: 280 });
  }

  function pickDiver() {
    var ready = enemies.filter(function (e) { return e.state === 'form'; });
    if (!ready.length) return;
    var bosses = ready.filter(function (e) { return e.type === 0; });
    var buts = ready.filter(function (e) { return e.type === 1; });
    var bees = ready.filter(function (e) { return e.type === 2; });
    var roll = Math.random(), e;
    if (bosses.length && (roll < 0.2 || (!buts.length && !bees.length))) {
      e = U.pick(bosses);
      var beamBusy = enemies.some(function (o) { return o.state === 'dive' && o.kind === 'tractor' || o.state === 'beam'; });
      var hasCaptive = enemies.some(function (o) { return o.capt; }) || (player.mode === 'captured');
      if (wave >= 2 && !beamBusy && !hasCaptive && !player.dual && !e.capt && player.mode === 'alive' && Math.random() < 0.5) { launchDive(e, 'tractor'); return; }
      launchDive(e, 'boss');
      // butterflies fly along as escorts
      var esc = buts.slice().sort(function (a, b) { return Math.abs(a.x - e.x) - Math.abs(b.x - e.x); }).slice(0, 2);
      esc.forEach(function (o, i) { launchDive(o, 'butterfly', 0.28 * (i + 1)); });
      return;
    }
    if (buts.length && (roll < 0.55 || !bees.length)) { launchDive(U.pick(buts), 'butterfly'); return; }
    if (bees.length) launchDive(U.pick(bees), 'bee');
  }

  function startBeam(e) {
    e.state = 'beam'; e.beamT = 3.0; e.x = Math.round(e.x); e.ang = 0;
  }
  function beamHalfWidth(e, y) { return 3 + (y - e.y) * 0.13; }

  function killEnemy(e, byBomb) {
    if (e.dead) return;
    e.dead = true;
    var t = e.type, diving = e.state === 'dive' || e.state === 'beam' || e.state === 'back' || e.state === 'return';
    var pts = challenge ? 100 : (diving ? SCORE_DIVE[t] : SCORE_FORM[t]);
    R.addScore(pts); checkLife();
    if (challenge) { chHits++; R.fx.text(e.x, e.y - 8, '100', C.yellow); }
    else if (diving && t === 0) R.fx.text(e.x, e.y - 8, '' + pts, C.yellow);
    boom(e.x, e.y, COLORS[t], t === 0 ? 20 : 12, t === 0 ? 100 : 80);
    R.sfx.noise(0.16, { vol: 0.17, freq: 2800, sweep: 260 });
    R.sfx.tone(380, 0.1, { type: 'square', vol: 0.06, slide: 90 });
    R.vibrate(t === 0 ? 20 : 8);
    if (t === 0) {
      bossKills++; R.fx.shake(1.5, 0.1);
      if (bossKills >= 5) R.achieve('boss5');
      if (e.capt) {
        if (e.state === 'form' && !byBomb) {
          freed = { x: e.x, y: e.y - 14, t: 0, ang: 0 };
          R.fx.text(U.clamp(e.x, 36, 124), e.y - 22, 'RESCUED!', C.cyan); R.sfx.play('powerup');
        } else { boom(e.x, e.y - 14, ['#ff004d', '#ff77a8', '#fff1e8'], 14, 80); R.sfx.play('explode'); }
        e.capt = false;
      } else if (!challenge && !player.dual && diving && Math.random() < 0.35) capsules.push({ x: e.x, y: e.y, t: 0 });
    }
  }

  function hitEnemy(e, byBomb) {
    if (e.dead) return;
    e.hp--;
    if (e.hp <= 0) { killEnemy(e, byBomb); return; }
    e.hurt = 0.14;
    R.fx.burst(e.x, e.y, { n: 6, color: ['#fff1e8', '#29adff'], speed: 50, life: 0.3, size: 2 });
    R.sfx.play('hit'); R.vibrate(10);
  }

  /* ---------------------------------------------------------- player actions */
  function gainDual() {
    var p = player;
    if (p.dual) { R.addScore(1000); R.fx.text(U.clamp(p.x, 20, 140), PLAYER_Y - 18, '1000', C.yellow); return; }
    p.dual = true; p.x = U.clamp(p.x, 15, W - 15);
    R.fx.text(U.clamp(p.x, 56, 104), PLAYER_Y - 20, 'DUAL FIGHTER!', C.cyan);
    R.sfx.play('powerup'); R.fx.flash(C.white, 0.1); R.vibrate(30);
    R.achieve('dual');
  }

  function hitPlayer() {
    var p = player;
    if (p.mode !== 'alive' || p.invuln > 0) return;
    if (p.dual) {
      p.dual = false; p.invuln = 1.8;
      boom(p.x + 7, PLAYER_Y, ['#3de2ff', '#fff1e8', '#ff004d'], 18, 90);
      R.sfx.play('explode'); R.vibrate(80); R.fx.shake(3, 0.3); R.fx.text(U.clamp(p.x, 40, 120), PLAYER_Y - 18, 'DUAL LOST', C.red);
      return;
    }
    p.mode = 'dead'; p.deadT = 1.6; R.lives = Math.max(0, R.lives - 1);
    boom(p.x, PLAYER_Y, ['#3de2ff', '#fff1e8', '#ff004d', '#ffec27'], 28, 110);
    R.sfx.play('explode'); R.vibrate(120); R.fx.shake(4, 0.4); R.fx.flash(C.white, 0.14);
    ebullets.length = 0;
  }

  function doBomb() {
    var p = player;
    R.hud.extra = Math.max(0, (R.hud.extra | 0) - 1);
    bombId++; bombFx = { x: p.x, y: PLAYER_Y, r: 6, id: bombId };
    R.sfx.play('explode'); R.sfx.noise(0.5, { vol: 0.2, freq: 600, sweep: 3500 });
    R.sfx.tone(120, 0.5, { type: 'sawtooth', vol: 0.1, slide: 900 });
    R.fx.flash('#bfe9ff', 0.2); R.fx.shake(2.5, 0.25); R.vibrate(60);
  }

  function respawn() {
    player = newPlayer(); player.invuln = 2.2;
  }

  /* ---------------------------------------------------------- update */
  function updateStars(dt) {
    var boost = ws === 'clear' ? 7 : 1, i, s;
    for (i = 0; i < stars.length; i++) { s = stars[i]; s.y += s.v * boost * dt; if (s.y > H) { s.y -= H; s.x = U.rand(0, W); } }
  }

  function updatePlayer(dt) {
    var p = player, i;
    if (p.mode === 'alive') {
      var half = p.dual ? 15 : 7;
      p.x = U.clamp(p.x + R.input.axisX() * 105 * dt, half, W - half);
      p.cool -= dt; p.invuln -= dt;
      var maxB = p.dual ? 4 : 2;
      if ((R.input.pressed('a') || R.input.held.a) && p.cool <= 0 && pbullets.length <= maxB - (p.dual ? 2 : 1)) {
        if (p.dual) { pbullets.push({ x: p.x - 7, y: PLAYER_Y - 10 }, { x: p.x + 7, y: PLAYER_Y - 10 }); }
        else pbullets.push({ x: p.x, y: PLAYER_Y - 10 });
        p.cool = 0.15; R.sfx.tone(1150, 0.07, { type: 'square', vol: 0.06, slide: 320 });
      }
      if (R.input.pressed('b') && (R.hud.extra | 0) > 0 && !bombFx) doBomb();
      // hazards
      if (p.invuln <= 0) {
        var box = playerBox();
        for (i = 0; i < ebullets.length; i++) {
          var b = ebullets[i];
          if (b.x > box.x - 1 && b.x < box.x + box.w + 1 && b.y > box.y && b.y < box.y + box.h) { ebullets.splice(i, 1); hitPlayer(); return; }
        }
        for (i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          if (e.state === 'wait' || e.state === 'form' || e.state === 'pass' || e.dead) continue;
          if (e.y > PLAYER_Y - 18 && U.overlap({ x: e.x - hw(e), y: e.y - hh(e), w: hw(e) * 2, h: hh(e) * 2 }, box)) { killEnemy(e); hitPlayer(); return; }
        }
      }
    } else if (p.mode === 'captured') {
      p.capT += dt; p.ang += 9 * dt;
      var bs = p.capBoss;
      if (!bs || bs.dead) { p.mode = 'dead'; p.deadT = 1.0; boom(p.x, p.y, ['#3de2ff', '#fff1e8'], 14, 70); return; }
      p.y -= 58 * dt; p.x += (bs.x - p.x) * Math.min(1, 3 * dt);
      if (p.y <= bs.y + 15) {
        bs.capt = true; bs.state = 'back'; bs.beamT = 0;
        p.mode = 'gone'; p.deadT = 1.4;
        R.sfx.tone(200, 0.3, { type: 'square', vol: 0.08, slide: 600 });
      }
    } else {
      p.deadT -= dt;
      if (p.deadT <= 0) {
        if (R.lives <= 0) { R.gameOver(); return; }
        respawn();
      }
    }
  }

  function updateEnemies(dt) {
    var i, e, tmp = { x: 0, y: 0, ang: 0 }, allIn = true;
    form.t += dt;
    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      e.flap += dt; if (e.hurt > 0) e.hurt -= dt;
      switch (e.state) {
        case 'wait':
          allIn = false;
          e.delay -= dt;
          if (e.delay <= 0 && ws !== 'intro') {
            e.state = challenge ? 'pass' : 'entry'; e.s = 0; pathAt(e.path, 0, tmp); e.x = tmp.x; e.y = tmp.y; e.ang = tmp.ang;
          }
          break;
        case 'entry':
          allIn = false;
          e.s += e.speed * dt; pathAt(e.path, e.s, tmp); e.x = tmp.x; e.y = tmp.y; e.ang = tmp.ang;
          if (e.s >= e.path.len) e.state = 'settle';
          if (!challenge && wave >= 2 && Math.random() < dt * 0.25 * Math.min(1.5, wave * 0.18)) enemyShoot(e, true);
          break;
        case 'settle':
          allIn = false;
          if (moveToward(e, slotX(e.c), slotY(e.r), 130, dt)) { e.state = 'form'; e.ang = 0; }
          break;
        case 'pass':
          e.s += e.speed * dt; pathAt(e.path, e.s, tmp); e.x = tmp.x; e.y = tmp.y; e.ang = tmp.ang;
          if (e.s >= e.path.len) e.dead = true;
          break;
        case 'form':
          e.x = slotX(e.c); e.y = slotY(e.r); e.ang = 0;
          break;
        case 'dive':
          allIn = false;
          e.s += e.speed * dt;
          pathAt(e.path, Math.max(0, e.s), tmp); e.x = tmp.x; e.y = tmp.y; if (e.s > 0) e.ang = tmp.ang;
          if (e.s > 0 && !challenge) {
            e.fireT -= dt;
            if (e.fireT <= 0 && e.shots < 2 && e.y > 60 && e.y < 230 && e.kind !== 'tractor') { enemyShoot(e, true); e.shots++; e.fireT = U.rand(0.5, 0.9); }
          }
          if (e.s >= e.path.len) {
            if (e.kind === 'tractor') startBeam(e);
            else { e.state = 'return'; e.x = slotX(e.c); e.y = -16; e.ang = 0; }
          }
          break;
        case 'beam':
          allIn = false;
          e.beamT -= dt; e.ang = 0;
          if (player.mode === 'captured' && player.capBoss === e) e.beamT = Math.max(e.beamT, 1.2);
          if (e.beamT > 0 && e.beamT < 2.5) {
            beamSnd -= dt; if (beamSnd <= 0) { beamSnd = 0.11; R.sfx.tone(150 + 90 * Math.abs(Math.sin(tAnim * 9)), 0.1, { type: 'sine', vol: 0.06 }); }
            var p = player;
            if (p.mode === 'alive' && p.invuln <= 0 && !p.dual && Math.abs(p.x - e.x) < beamHalfWidth(e, PLAYER_Y) - 1) {
              p.mode = 'captured'; p.capBoss = e; p.capT = 0; p.y = PLAYER_Y; p.ang = 0;
              R.lives = Math.max(0, R.lives - 1);
              R.sfx.tone(520, 0.9, { type: 'sawtooth', vol: 0.1, slide: 70 }); R.vibrate(80); R.fx.shake(2, 0.3);
              R.fx.text(U.clamp(p.x, 40, 120), PLAYER_Y - 20, 'CAPTURED!', C.red);
              ebullets.length = 0;
            }
          }
          if (e.beamT <= 0 && player.mode !== 'captured') e.state = 'back';
          break;
        case 'back':
          allIn = false;
          if (moveToward(e, slotX(e.c), slotY(e.r), 100, dt)) { e.state = 'form'; e.ang = 0; }
          break;
        case 'return':
          allIn = false;
          if (moveToward(e, slotX(e.c), slotY(e.r), 120, dt)) { e.state = 'form'; e.ang = 0; }
          break;
      }
    }
    return allIn;
  }

  function updateBullets(dt) {
    var i, j, b, e;
    for (i = pbullets.length - 1; i >= 0; i--) {
      b = pbullets[i]; b.y -= 340 * dt;
      var hit = false;
      if (b.y < -8) { pbullets.splice(i, 1); continue; }
      for (j = 0; j < enemies.length; j++) {
        e = enemies[j];
        if (e.dead || e.state === 'wait') continue;
        if (Math.abs(b.x - e.x) < hw(e) + 1 && b.y - 6 < e.y + hh(e) && b.y > e.y - hh(e) - 1) { hitEnemy(e); hit = true; break; }
      }
      if (hit) pbullets.splice(i, 1);
    }
    for (i = ebullets.length - 1; i >= 0; i--) {
      b = ebullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H + 6 || b.x < -6 || b.x > W + 6) ebullets.splice(i, 1);
    }
    for (i = capsules.length - 1; i >= 0; i--) {
      b = capsules[i]; b.y += 40 * dt; b.t += dt;
      if (b.y > H + 8) { capsules.splice(i, 1); continue; }
      if (player.mode === 'alive' && Math.abs(b.x - player.x) < (player.dual ? 16 : 11) && Math.abs(b.y - PLAYER_Y) < 10) { gainDual(); capsules.splice(i, 1); }
    }
  }

  function updateFreed(dt) {
    if (!freed) return;
    freed.t += dt; freed.ang += 10 * dt;
    if (player.mode !== 'alive') { freed.y += 0; return; }
    var tx = player.x, ty = PLAYER_Y;
    var dx = tx - freed.x, dy = ty - freed.y, d = Math.sqrt(dx * dx + dy * dy), st = 125 * dt;
    if (d <= st + 6 && freed.t > 0.5) { freed = null; gainDual(); return; }
    freed.x += dx / d * st + Math.cos(freed.t * 12) * 30 * dt; freed.y += dy / d * st;
  }

  function updateBomb(dt) {
    if (!bombFx) return;
    bombFx.r += 250 * dt;
    var i, e, b;
    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      if (e.dead || e.state === 'wait' || e.bomb === bombFx.id) continue;
      if (Math.hypot(e.x - bombFx.x, e.y - bombFx.y) < bombFx.r) { e.bomb = bombFx.id; hitEnemy(e, true); }
    }
    for (i = ebullets.length - 1; i >= 0; i--) {
      b = ebullets[i];
      if (Math.hypot(b.x - bombFx.x, b.y - bombFx.y) < bombFx.r) { R.fx.burst(b.x, b.y, { n: 4, color: ['#ff77a8', '#fff1e8'], speed: 40, life: 0.3, size: 1 }); ebullets.splice(i, 1); }
    }
    if (bombFx.r > 340) bombFx = null;
  }

  R.game({
    layout: 'classic', size: [W, H], bg: '#05060f', music: 'adventure', levelLabel: 'WAVE',

    init: function () {
      SPR.enemy = [
        BOSS.map(function (r) { return R.sprite(r, BOSS_PAL); }),
        BUT.map(function (r) { return R.sprite(r, BUT_PAL); }),
        BEE.map(function (r) { return R.sprite(r, BEE_PAL); })];
      SPR.bossHurt = BOSS.map(function (r) { return R.sprite(r, BOSS_HURT_PAL); });
      SPR.ship = R.sprite(SHIP, SHIP_PAL); SPR.capt = R.sprite(SHIP, CAPT_PAL); SPR.capsule = R.sprite(CAPSULE, CAPSULE_PAL);
      ENTRY_PATHS = ENTRY_DEFS.map(makePath);
      CHAL_PATHS = CHAL_DEFS.map(makePath);
    },

    reset: function () {
      R.lives = 3; R.level = 1; R.hud.extraLabel = 'BOMBS'; R.hud.extra = 1;
      wave = 1; bossKills = 0; nextLife = 7500; tAnim = 0; bombId = 0; beamSnd = 0;
      pbullets = []; ebullets = []; capsules = []; bombFx = null; freed = null;
      form = { t: 0, amp: 0 };
      makeStars(); player = newPlayer();
      setupWave();
      // preview the full formation behind the READY card
      enemies.forEach(function (e) { e.state = 'form'; e.x = slotX(e.c); e.y = slotY(e.r); });
      ws = 'preview';
    },

    update: function (dt) {
      var allIn;
      if (ws === 'preview') setupWave();
      tAnim += dt;
      updateStars(dt);
      updatePlayer(dt);
      if (R.mode !== 'play') return;
      updateBullets(dt); updateFreed(dt); updateBomb(dt);

      if (ws === 'intro') {
        wsT -= dt;
        form.t += dt;
        if (wsT <= 0) ws = 'entry';
      } else if (ws === 'entry' || ws === 'battle') {
        allIn = updateEnemies(dt);
        if (ws === 'entry' && allIn && !challenge) { ws = 'battle'; }
        if (ws === 'battle') {
          form.amp = Math.min(1, form.amp + dt * 0.6);
          // dives
          if (player.mode === 'alive' || player.mode === 'gone' || player.mode === 'dead') {
            var maxDivers = Math.min(5, 1 + Math.floor(wave / 2) + (aliveCount() < 8 ? 1 : 0));
            var divers = enemies.filter(function (e) { return e.state === 'dive' || e.state === 'beam' || e.state === 'back' || e.state === 'return'; }).length;
            diveT -= dt;
            if (diveT <= 0 && divers < maxDivers && player.mode === 'alive') { pickDiver(); diveT = Math.max(0.55, 2.5 - 0.17 * wave) * U.rand(0.75, 1.25) * (aliveCount() < 8 ? 0.7 : 1); }
          }
          // formation fire
          shootT -= dt;
          if (shootT <= 0) {
            var pool = enemies.filter(function (e) { return e.state === 'form' && e.r >= 2; });
            if (pool.length) enemyShoot(U.pick(pool), false);
            shootT = Math.max(0.5, 2.2 - 0.14 * wave) * U.rand(0.7, 1.3);
          }
        }
        enemies = enemies.filter(function (e) { return !e.dead; });
        if (!enemies.length) {
          if (challenge) {
            ws = 'result'; wsT = 3.2;
            var perfect = chHits >= chTotal;
            R.achieve('challenge');
            if (perfect) { R.addScore(5000); R.hud.extra = Math.min(3, (R.hud.extra | 0) + 1); R.sfx.play('trophy'); }
            else { R.addScore(chHits * 50); R.sfx.play('win'); }
            checkLife();
          } else {
            ws = 'clear'; wsT = 2.2;
            R.addScore(100 * wave); checkLife();
            R.sfx.play('win'); R.achieve('wave1');
            if (wave % 3 === 0) { R.hud.extra = Math.min(3, (R.hud.extra | 0) + 1); R.fx.text(W / 2, 200, '+1 BOMB', C.cyan); }
          }
        }
      } else if (ws === 'clear' || ws === 'result') {
        wsT -= dt; form.t += dt;
        if (wsT <= 0) { wave++; setupWave(); R.sfx.play('start'); }
      }
    },

    render: function (ctx) {
      var i, e, s;
      // star field
      for (i = 0; i < stars.length; i++) { s = stars[i]; ctx.fillStyle = s.c; ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s); }

      // tractor beams
      for (i = 0; i < enemies.length; i++) {
        e = enemies[i];
        if (e.state === 'beam' && e.beamT > 0 && e.beamT < 2.5) drawBeam(ctx, e);
      }

      // enemies
      for (i = 0; i < enemies.length; i++) {
        e = enemies[i];
        if (e.state === 'wait') continue;
        var frame = Math.floor((e.flap + i * 0.1) / 0.32) % 2, spr = e.type === 0 && e.hp < 2 && !challenge ? SPR.bossHurt[frame] : SPR.enemy[e.type][frame];
        if (e.hurt > 0 && Math.floor(e.hurt / 0.04) % 2 === 0) { ctx.globalAlpha = 0.45; }
        drawRot(ctx, spr, e.x, e.y, e.ang);
        ctx.globalAlpha = 1;
        if (e.capt) drawRot(ctx, SPR.capt, e.x, e.y - 14, 0);
      }

      // capsules
      for (i = 0; i < capsules.length; i++) {
        var cp = capsules[i];
        ctx.fillStyle = 'rgba(41,173,255,.25)'; ctx.fillRect(Math.round(cp.x) - 6, Math.round(cp.y) - 6, 12, 12);
        R.draw.sprite(ctx, SPR.capsule, Math.round(cp.x) - 4, Math.round(cp.y) - 4);
        R.draw.text(ctx, 'D', Math.round(cp.x), Math.round(cp.y) - 3, { size: 6, color: Math.floor(tAnim / 0.15) % 2 ? '#ff004d' : '#29adff', align: 'center' });
      }

      // rescued fighter
      if (freed) drawRot(ctx, SPR.ship, freed.x, freed.y, freed.ang);

      // bullets
      for (i = 0; i < pbullets.length; i++) {
        var b = pbullets[i];
        ctx.fillStyle = 'rgba(61,226,255,.3)'; ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 6, 4, 10);
        ctx.fillStyle = '#fff1e8'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 5, 2, 7);
      }
      for (i = 0; i < ebullets.length; i++) {
        var eb = ebullets[i];
        ctx.fillStyle = 'rgba(255,0,77,.3)'; ctx.beginPath(); ctx.arc(eb.x, eb.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = Math.floor(tAnim / 0.07) % 2 ? '#ff77a8' : '#ffa300'; ctx.fillRect(Math.round(eb.x) - 1, Math.round(eb.y) - 2, 3, 4);
        ctx.fillStyle = '#fff1e8'; ctx.fillRect(Math.round(eb.x), Math.round(eb.y) - 1, 1, 2);
      }

      // player ship(s)
      var p = player;
      if (p.mode === 'alive' && (p.invuln <= 0 || Math.floor(tAnim / 0.07) % 2 === 0)) {
        if (p.dual) { drawRot(ctx, SPR.ship, p.x - 7, PLAYER_Y, 0); drawRot(ctx, SPR.ship, p.x + 7, PLAYER_Y, 0); }
        else drawRot(ctx, SPR.ship, p.x, PLAYER_Y, 0);
      } else if (p.mode === 'captured') drawRot(ctx, SPR.ship, p.x, p.y, p.ang);

      // smart bomb shockwave
      if (bombFx) {
        var a = Math.max(0, 1 - bombFx.r / 340);
        ctx.strokeStyle = 'rgba(191,233,255,' + a.toFixed(2) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(bombFx.x, bombFx.y, bombFx.r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(61,226,255,' + (a * 0.6).toFixed(2) + ')'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(bombFx.x, bombFx.y, bombFx.r - 4, 0, Math.PI * 2); ctx.stroke();
      }

      // banners
      if (R.mode === 'play') {
        if (ws === 'intro') {
          if (challenge) {
            R.draw.text(ctx, 'CHALLENGE', W / 2, 150, { size: 16, color: C.yellow, align: 'center', shadow: '#000' });
            R.draw.text(ctx, 'STAGE ' + wave, W / 2, 174, { size: 8, color: C.white, align: 'center', shadow: '#000' });
          } else {
            R.draw.text(ctx, 'WAVE ' + wave, W / 2, 150, { size: 16, color: C.cyan, align: 'center', shadow: '#000' });
            R.draw.text(ctx, 'GET READY', W / 2, 174, { size: 8, color: C.white, align: 'center', shadow: '#000' });
          }
        } else if (ws === 'clear') {
          R.draw.text(ctx, 'WAVE CLEAR!', W / 2, 150, { size: 8, color: C.lime, align: 'center', shadow: '#000' });
        } else if (ws === 'result') {
          R.draw.text(ctx, 'NUMBER OF HITS', W / 2, 140, { size: 8, color: C.white, align: 'center', shadow: '#000' });
          R.draw.text(ctx, chHits + '/' + chTotal, W / 2, 156, { size: 16, color: C.yellow, align: 'center', shadow: '#000' });
          if (chHits >= chTotal) R.draw.text(ctx, 'PERFECT! +5000', W / 2, 182, { size: 8, color: C.lime, align: 'center', shadow: '#000' });
          else R.draw.text(ctx, 'BONUS ' + chHits * 50, W / 2, 182, { size: 8, color: C.cyan, align: 'center', shadow: '#000' });
        }
      }
    }
  });

  /* ---------------------------------------------------------- drawing helpers */
  function drawRot(ctx, spr, x, y, ang) {
    var w = spr.width, h = spr.height;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (ang) ctx.rotate(Math.round(ang / STEP16) * STEP16);
    ctx.drawImage(spr, -Math.floor(w / 2), -Math.floor(h / 2));
    ctx.restore();
  }

  function drawBeam(ctx, e) {
    var y0 = e.y + 6, y1 = PLAYER_Y + 10, k, a = Math.min(1, (3.0 - e.beamT) * 4, e.beamT * 2);
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillStyle = 'rgba(61,226,255,.14)';
    ctx.beginPath(); ctx.moveTo(e.x - 3, y0); ctx.lineTo(e.x + 3, y0); ctx.lineTo(e.x + beamHalfWidth(e, y1), y1); ctx.lineTo(e.x - beamHalfWidth(e, y1), y1); ctx.closePath(); ctx.fill();
    for (k = 0; k < 9; k++) {
      var yy = y0 + ((k * 14 - tAnim * 70) % 126 + 126) % 126;
      if (yy > y1) continue;
      var hwid = beamHalfWidth(e, yy);
      ctx.fillStyle = k % 2 ? 'rgba(143,226,255,.75)' : 'rgba(255,255,255,.6)';
      ctx.fillRect(Math.round(e.x - hwid), Math.round(yy), Math.round(hwid * 2), 1);
    }
    ctx.fillStyle = 'rgba(61,226,255,.6)';
    ctx.fillRect(Math.round(e.x - beamHalfWidth(e, y1)), y1 - 1, 1, 1);
    ctx.globalAlpha = 1;
  }
})();
