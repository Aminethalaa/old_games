/* Dino Dash — endless desert runner, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164, GROUND = 130, DX = 16;                 // view size, ground surface y, dino screen x
  var GRAV = 900, VJUMP = 306, VCUT = 130, FASTFALL = 2.2, MINHOLD = 0.06, JUMP_BUF = 0.1;
  var SPEED0 = 78, SPEED_RISE = 98, CYCLE = 700;               // px/s, px/s, score per day/night cycle
  var BIRD_VB = 22, ROCK_VB = 40;                              // extra speed of birds / boulders

  /* ------------------------------------------------------------------ sprites */
  function outline(lines) {
    var h = lines.length, w = 0, y, x;
    lines.forEach(function (l) { w = Math.max(w, l.length); });
    var g = lines.map(function (l) { while (l.length < w) l += '.'; return l; });
    function at(x, y) { return (y < 0 || y >= h || x < 0 || x >= w) ? '.' : g[y].charAt(x); }
    var out = [];
    for (y = -1; y <= h; y++) {
      var r = '';
      for (x = -1; x <= w; x++) {
        var c = at(x, y);
        if (c === '.') c = (at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.') ? 'o' : '.';
        r += c;
      }
      out.push(r);
    }
    return out;
  }
  function cactusSil(tw, h, al, ar) {
    var w = tw + (al ? 3 : 0) + (ar ? 3 : 0), x0 = al ? 3 : 0, g = [], x, y;
    for (y = 0; y < h; y++) { var row = []; for (x = 0; x < w; x++) row.push('.'); g.push(row); }
    for (y = 0; y < h; y++) for (x = 0; x < tw; x++) {
      if (y === 0 && (x === 0 || x === tw - 1)) continue;
      g[y][x0 + x] = x === 0 ? 'H' : x === tw - 1 ? 'g' : '#';
    }
    function arm(vx, bx, tip, join) { for (var yy = tip; yy <= join + 1; yy++) { g[yy][vx] = '#'; g[yy][vx + 1] = '#'; } g[join][bx] = '#'; g[join + 1][bx] = '#'; }
    if (al) arm(0, 2, al[0], al[1]);
    if (ar) arm(w - 2, w - 3, ar[0], ar[1]);
    return g.map(function (r) { return r.join(''); });
  }
  function rockRows(f) {
    var n = 14, c = 6.5, rows = [], a0 = -f * Math.PI / 4, spots = [[3.5, 0.4], [4.5, 2.3], [2.5, 4.1], [4.8, 5.4]];
    var spot = {};
    spots.forEach(function (s) {
      var x = Math.round(c + s[0] * Math.cos(s[1] + a0)), y = Math.round(c + s[0] * Math.sin(s[1] + a0));
      spot[x + ',' + y] = 1; spot[(x + 1) + ',' + y] = 1;
    });
    for (var y = 0; y < n; y++) {
      var r = '';
      for (var x = 0; x < n; x++) {
        var dx = x - c, dy = y - c;
        if (Math.sqrt(dx * dx + dy * dy) > 6.9) { r += '.'; continue; }
        var ch = '#', l = dx + dy;
        if (l < -5) ch = 'L'; else if (l > 5) ch = 'g';
        if (spot[x + ',' + y]) ch = 'k';
        r += ch;
      }
      rows.push(r);
    }
    return outline(rows);
  }

  var DINO_PAL = { o: '#0d5c3e', '#': '#3ddc84', g: '#25a864', B: '#fff1a8', S: '#ff8a3d', W: '#ffffff', K: '#1d2b53', P: '#ff77a8', m: '#0d5c3e', X: '#ff004d' };
  var BODY = [
    '.........#######..', '........#########.', '........####WW####', '........####WK####', '........#PP#######', '........########mm',
    '.......#########..', '.....SS##########.', '...SS############.', '.SS.#############.', '#########BBBBB##..', '.########BBBBBB##.',
    '..#######BBBBBB#..', '..#######BBBBB##..'];
  var LEGS_A = ['....###..###......', '....###..###......', '...####..####.....'];
  var LEGS_B = ['.....###...###.....', '....###....###....', '....####...####...'];
  var LEGS_J = ['....###....###.....', '...###......###...', '..###........###..'];
  var DUCK_TOP = [
    '.................#####..', '................#######.', '...S..S..S......####WW##', '..###############WK####',
    '.################PP#####', '################BBB#mm##.', '.###############BBBB###..'];
  var BIRD_PAL = { o: '#4a0f5c', '#': '#e052a0', g: '#8a2bd6', B: '#ffc2e0', b: '#ffa300', W: '#ffffff', K: '#1d2b53' };
  var BIRD_BODY = ['....#######...', 'bbb#########..', 'bbbW#K#######.', '..b########...', '...######.....'];
  var BLANK14 = '..............';
  var CACTUS_PAL = { o: '#0d4f33', '#': '#2fd26b', H: '#8af5b0', g: '#1b9a4c' };
  var ROCK_PAL = { o: '#3b2418', '#': '#a8714a', L: '#d9a273', g: '#7a4a2e', k: '#4d2f1f' };
  var CLOUD_BIG = [[3, 9], [1, 13], [0, 17], [0, 20], [2, 21], [4, 22]];     // row spans (x0, x1)
  var CLOUD_SM = [[2, 6], [0, 9], [0, 12], [1, 13]];
  var S = {};

  function buildSprites() {
    function pad(rows, w) { return rows.map(function (r) { while (r.length < w) r += '.'; return r; }); }
    function mk(top, legs) { return R.sprite(outline(pad(top.concat(legs), 18)), DINO_PAL); }
    S.run = [mk(BODY, LEGS_A), mk(BODY, LEGS_B)];
    S.jump = mk(BODY, LEGS_J);
    S.dead = mk(BODY.map(function (r) { return r.replace('WW', 'XX').replace('WK', 'XX').replace('mm', 'Xm'); }), LEGS_A);
    S.duck = [
      R.sprite(outline(pad(DUCK_TOP.concat(['..###..###', '..####.####']), 24)), DINO_PAL),
      R.sprite(outline(pad(DUCK_TOP.concat(['...###...###', '...####..####']), 24)), DINO_PAL)];
    S.bird = [
      R.sprite(outline(['.......gg.....', '......ggg.....', '.....gggg.....', '....ggggg.....'].concat(BIRD_BODY, [BLANK14, BLANK14, BLANK14])), BIRD_PAL),
      R.sprite(outline([BLANK14, BLANK14, BLANK14, BLANK14].concat(BIRD_BODY, ['.....ggggg....', '......gggg....', '.......ggg....'])), BIRD_PAL)];
    S.cactus = [
      R.sprite(outline(cactusSil(3, 10, null, null)), CACTUS_PAL),
      R.sprite(outline(cactusSil(4, 13, null, [4, 7])), CACTUS_PAL),
      R.sprite(outline(cactusSil(4, 19, [6, 12], [3, 9])), CACTUS_PAL),
      R.sprite(outline(cactusSil(5, 23, [7, 14], [4, 10])), CACTUS_PAL)];
    S.rock = [];
    for (var f = 0; f < 8; f++) S.rock.push(R.sprite(rockRows(f), ROCK_PAL));
  }

  /* -------------------------------------------------- day / night palettes */
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mkKF(p, d, o) { var k = { p: p, d: d }; for (var key in o) k[key] = hex(o[key]); return k; }
  var DAY = { skyT: '#3a9bf0', skyB: '#bfe6ff', far: '#8fb4de', near: '#e8c47e', gA: '#f2d391', gB: '#d9a95c', spk: '#b98a42', cloud: '#ffffff' };
  var DUSK = { skyT: '#6a3d9a', skyB: '#ff9360', far: '#7a4a84', near: '#c9753f', gA: '#d79a55', gB: '#a8683a', spk: '#82502d', cloud: '#ffc0a0' };
  var NIGHT = { skyT: '#080d2b', skyB: '#24387a', far: '#1a2250', near: '#2f2c62', gA: '#4b4b82', gB: '#34346a', spk: '#25254f', cloud: '#46538c' };
  var KF = [mkKF(0, 1, DAY), mkKF(0.34, 1, DAY), mkKF(0.46, 0.45, DUSK), mkKF(0.58, 0, NIGHT), mkKF(0.82, 0, NIGHT), mkKF(0.92, 0.45, DUSK), mkKF(1, 1, DAY)];
  var KEYS = ['skyT', 'skyB', 'far', 'near', 'gA', 'gB', 'spk', 'cloud'];
  var P = {};                                                   // current palette (css strings) + d
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function setPhase(ph) {
    var i = 0;
    while (i < KF.length - 2 && ph > KF[i + 1].p) i++;
    var a = KF[i], b = KF[i + 1], t = U.clamp((ph - a.p) / (b.p - a.p), 0, 1);
    P.d = U.lerp(a.d, b.d, t);
    KEYS.forEach(function (k) { P[k + 'Raw'] = mix(a[k], b[k], t); P[k] = rgb(P[k + 'Raw']); });
    P.skyBands = [];
    var n = 13;
    for (var s = 0; s < n; s++) P.skyBands.push(rgb(mix(P.skyTRaw, P.skyBRaw, Math.pow(s / (n - 1), 1.25))));
    P.hi = rgb(mix(P.gARaw, [255, 255, 255], 0.35));
  }
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function tri(x) { x = x - Math.floor(x); return x < 0.5 ? x * 2 : 2 - x * 2; }

  /* -------------------------------------------------------------------- state */
  var dino, obs, speed, dist, spawnIn, planned, last, nextCP, cpT, dead, deadT, clouds, stars, anim, dustT;
  var birdsPassed, rocksPassed, scroll;

  function newCloud(x) { return { x: x, y: U.rand(16, 66), big: Math.random() < 0.5, v: U.rand(2, 9) }; }

  /* ---------------------------------------------------------------- spawning */
  function wpick(list) {
    var tot = 0, i; for (i = 0; i < list.length; i++) tot += list[i][1];
    var r = Math.random() * tot;
    for (i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i][0]; }
    return list[0][0];
  }
    function clearPx(h) {                     // distance (px) a full-height jump stays above height h, at the current speed
    var peak = VJUMP * VJUMP / (2 * GRAV);
    return h >= peak ? 0 : 2 * Math.sqrt(2 * (peak - h) / GRAV) * speed;
  }
  function makeSpec() {
    var sc = R.score, kinds = [['cactus', 10]];
    if (sc >= 110) kinds.push(['bird', 4]);
    if (sc >= 330) kinds.push(['rock', 3]);
    var kind = wpick(kinds);
    if (last && last.kind === kind && kind !== 'cactus' && Math.random() < 0.7) kind = 'cactus';
    var spec = { kind: kind, parts: [], w: 0, h: 0, vb: 0 };
    if (kind === 'cactus') {
      var n = sc < 60 ? 1 : wpick([[1, 5], [2, sc < 200 ? 3 : 4], [3, sc < 200 ? 0 : 3]]), x = 0, tall = 0, maxH = 0, i;
      for (i = 0; i < n; i++) {
        var t = wpick([[0, 2], [1, 5], [2, sc >= 40 ? 4 : 0], [3, sc >= 150 ? 3 : 0]]);
        if (t === 3 && tall) t = 2;
        var sw = S.cactus[t].width, sh = S.cactus[t].height;
        // the whole group must stay clearable with one jump, with at least ~0.16 s of timing slack
        if (i > 0 && clearPx(Math.max(maxH, sh - 2) + 1) < x + sw - 2 + 14 + 0.16 * speed) break;
        if (t === 3) tall++;
        maxH = Math.max(maxH, sh - 2);
        spec.parts.push({ t: t, dx: x, hit: { x: x + 2, y: -(sh - 2), w: sw - 4, h: sh - 3 } });   // y measured up from the ground
        x += sw + (i < n - 1 ? U.randInt(0, 3) : 0);
      }
      spec.w = x; spec.h = 27;
    } else if (kind === 'bird') {
      var lv = wpick([['low', 4], ['mid', 5], ['high', sc >= 260 ? 4 : 0]]);
      var bottom = lv === 'low' ? 4 : lv === 'mid' ? 11 : 30;
      spec.lv = lv; spec.vb = BIRD_VB; spec.w = 16; spec.h = 14;
      spec.parts.push({ t: 0, dx: 0, hit: { x: 3, y: -(bottom + 6), w: 10, h: 6 } });
      spec.by = bottom + 6;               // body top above ground; sprite is drawn relative to it
    } else {
      spec.vb = ROCK_VB; spec.w = 16; spec.h = 16;
      spec.parts.push({ t: 0, dx: 0, hit: { x: 3, y: -13, w: 10, h: 12 } });
    }
    return spec;
  }
  function gapFor(prev, next) {
    var p = U.clamp((speed - SPEED0) / SPEED_RISE, 0, 1);
    var lo = U.lerp(1.0, 0.52, p), hi = U.lerp(1.85, 1.1, p);
    var minGap = Math.max(0.46 * speed, 38);
    if (next.lv === 'high' && prev.lv !== 'high') minGap = Math.max(minGap, 0.8 * speed);     // never force a jump into a high bird
    if (next.vb) minGap += next.vb * (W + 10 - DX) / (speed + next.vb) + 6;                    // faster movers close the gap while approaching
    return Math.max(minGap + 4, U.rand(lo, hi) * speed);
  }
  function spawnObstacle(spec) {
    var o = { kind: spec.kind, x: W + 10, w: spec.w, h: spec.h, vb: spec.vb, parts: spec.parts, lv: spec.lv, by: spec.by, passed: false, roll: 0 };
    obs.push(o);
    return spec;
  }

  /* ------------------------------------------------------------------ dino */
  function dinoBoxes() {
    var x = DX, ph = dino.duck && !dino.air ? S.duck[0].height : S.run[0].height, y = dino.y - ph + 1;
    if (dino.duck && !dino.air) return [{ x: x + 18, y: y + 2, w: 7, h: 6 }, { x: x + 3, y: y + 4, w: 16, h: 7 }];
    return [{ x: x + 10, y: y + 2, w: 8, h: 7 }, { x: x + 4, y: y + 9, w: 11, h: 9 }];
  }
  function hits(o) {
    var boxes = dinoBoxes();
    for (var i = 0; i < o.parts.length; i++) {
      var p = o.parts[i], hb = { x: o.x + p.hit.x, y: GROUND + p.hit.y, w: p.hit.w, h: p.hit.h };
      for (var j = 0; j < boxes.length; j++) if (U.overlap(hb, boxes[j])) return true;
    }
    return false;
  }
  function jump() {
    dino.vy = -VJUMP; dino.air = true; dino.airT = 0; dino.buf = 0; dino.duck = false;
    R.sfx.play('jump'); R.vibrate(8);
    R.fx.burst(DX + 8, GROUND, { n: 5, color: [P.gA || C.peach, P.hi || C.white], speed: 40, life: 0.35, size: 1, gravity: -30 });
  }
  function die() {
    dead = true; deadT = 0.75;
    R.sfx.play('hit'); R.vibrate(90); R.fx.shake(3, 0.3);
    R.fx.burst(DX + 10, dino.y - 10, { n: 22, color: [C.white, '#3ddc84', '#fff1a8', '#ff8a3d'], speed: 95, life: 0.65, gravity: 220, size: 2 });
  }

  /* -------------------------------------------------------------------- game */
  R.game({
    layout: 'full', size: [W, H], bg: '#3a9bf0', music: 'retro',

    _dbg: function () { return { dino: dino, obs: obs, speed: speed, K: { GROUND: GROUND, DX: DX, GRAV: GRAV, VJUMP: VJUMP, VCUT: VCUT, FASTFALL: FASTFALL, MINHOLD: MINHOLD, W: W }, warp: function (d) { dist = d; scroll = d; R.score = Math.floor(d / 5); nextCP = Math.floor(d / 500) * 100 + 100; }, hitAt: function (y, duck, air, o) { var sy = dino.y, sd = dino.duck, sa = dino.air; dino.y = y; dino.duck = duck; dino.air = air; var r = hits(o); dino.y = sy; dino.duck = sd; dino.air = sa; return r; } }; }, /*DBG*/
    init: function () { buildSprites(); },

    reset: function () {
      dino = { y: GROUND, vy: 0, air: false, airT: 0, duck: false, buf: 0 };
      obs = []; speed = SPEED0; dist = 0; spawnIn = 110; last = null; nextCP = 100; cpT = 0; dead = false; deadT = 0;
      birdsPassed = 0; rocksPassed = 0; scroll = 0; anim = 0; dustT = 0;
      clouds = [newCloud(10), newCloud(52), newCloud(95), newCloud(130)];
      stars = []; for (var i = 0; i < 26; i++) stars.push({ x: U.rand(0, W), y: U.rand(14, 84), ph: U.rand(0, 6.28) });
      planned = null;
      setPhase(0);
      R.level = 1; R.score = 0; R.lives = null;
      if (S.run) planned = makeSpec();
    },

    update: function (dt) {
      var inp = R.input, i;
      if (dead) {
        deadT -= dt;
        if (deadT <= 0) R.gameOver();
        return;
      }
      /* speed & score */
      var sc = Math.floor(dist / 5);
      var target = SPEED0 + SPEED_RISE * (1 - Math.exp(-sc / 1500));
      speed += (target - speed) * Math.min(1, dt * 0.8);
      dist += speed * dt; scroll += speed * dt; anim += dt * (6 + speed / 14);
      sc = Math.floor(dist / 5);
      if (sc > R.score) R.score = sc;
      R.level = 1 + Math.floor(sc / 300);
      if (sc >= nextCP) {
        nextCP += 100; cpT = 0.8;
        R.sfx.tone(880, 0.07, { vol: 0.1 }); R.sfx.tone(1320, 0.12, { vol: 0.1, delay: 0.07 });
        R.fx.flash('#ffffff', 0.1);
        if (nextCP > 200) R.sfx.tone(1760, 0.1, { vol: 0.07, delay: 0.16 });
        if (sc >= 100) R.achieve('warm-up');
        if (sc >= 1000) R.achieve('marathon');
      }
      if (cpT > 0) cpT -= dt;
      setPhase((dist / 5 / CYCLE) % 1);

      /* input + dino physics */
      var jp = inp.pressed('a') || inp.pressed('up'), holdJ = inp.held.a || inp.held.up, wantDuck = inp.held.down || inp.held.b;
      dino.buf = jp ? JUMP_BUF : dino.buf - dt;
      if (!dino.air) {
        dino.duck = wantDuck;
        if (dino.buf > 0) jump();
        else {
          dustT -= dt;
          if (dustT <= 0) { dustT = 0.09; R.fx.burst(DX + 3, GROUND - 1, { n: 1, color: P.hi, speed: 16, life: 0.3, size: 1, gravity: -10 }); }
        }
      }
      if (dino.air) {
        dino.airT += dt;
        if (dino.vy < -VCUT && !holdJ && dino.airT > MINHOLD) dino.vy = -VCUT;
        dino.vy += GRAV * (wantDuck ? 1 + FASTFALL : 1) * dt;
        dino.y += dino.vy * dt;
        if (dino.y >= GROUND) {
          dino.y = GROUND; dino.vy = 0; dino.air = false;
          R.sfx.tone(120, 0.05, { type: 'triangle', vol: 0.09 });
          R.fx.burst(DX + 8, GROUND, { n: 6, color: [P.hi, P.gA], speed: 36, life: 0.3, size: 1, gravity: -20 });
          if (wantDuck) R.fx.burst(DX + 8, GROUND, { n: 4, color: P.hi, speed: 50, life: 0.25, size: 1 });
          dino.duck = wantDuck;
          if (dino.buf > 0) jump();
        }
      }

      /* obstacles */
      spawnIn -= speed * dt;
      if (spawnIn <= 0) {
        var cur = spawnObstacle(planned);
        planned = makeSpec();
        last = cur;
        spawnIn = cur.w + gapFor(cur, planned);
      }
      for (i = obs.length - 1; i >= 0; i--) {
        var o = obs[i];
        o.x -= (speed + o.vb) * dt;
        if (o.kind === 'rock') o.roll += o.vb * dt;
        if (o.x + o.w < -6) { obs.splice(i, 1); continue; }
        if (hits(o)) { die(); return; }
        if (!o.passed && o.x + o.w < DX + 2) {
          o.passed = true;
          if (o.kind === 'bird') { birdsPassed++; if (birdsPassed >= 10) R.achieve('bird-brain'); }
          if (o.kind === 'rock') { rocksPassed++; if (rocksPassed >= 5) R.achieve('rock-hopper'); R.fx.text(DX + 14, GROUND - 30, 'ROCK!', C.orange); }
        }
      }

      /* scenery */
      for (i = 0; i < clouds.length; i++) {
        var c = clouds[i];
        c.x -= (speed * 0.07 + c.v) * dt;
        if (c.x < -26) { c.x = W + U.rand(4, 50); c.y = U.rand(16, 66); c.big = Math.random() < 0.5; c.v = U.rand(2, 9); }
      }
      for (i = 0; i < stars.length; i++) { stars[i].x -= speed * 0.01 * dt; if (stars[i].x < 0) stars[i].x += W; }
    },

    render: function (ctx, w, h) {
      var i, x, y, t = R.time;
      /* sky */
      var bandH = Math.ceil((GROUND - 0) / P.skyBands.length);
      for (i = 0; i < P.skyBands.length; i++) { ctx.fillStyle = P.skyBands[i]; ctx.fillRect(0, i * bandH, w, bandH + 1); }
      /* stars */
      var na = U.clamp((0.5 - P.d) * 2, 0, 1);
      if (na > 0) {
        for (i = 0; i < stars.length; i++) {
          var st = stars[i], tw = 0.55 + 0.45 * Math.sin(t * 2.4 + st.ph);
          ctx.globalAlpha = na * tw; ctx.fillStyle = '#fff1e8';
          ctx.fillRect(Math.floor(st.x), Math.floor(st.y), 1, 1);
          if (i % 5 === 0) ctx.fillRect(Math.floor(st.x) - 1, Math.floor(st.y), 3, 1);
        }
        ctx.globalAlpha = 1;
      }
      /* sun & moon */
      var sx = 104, sunY = 30 + (1 - P.d) * 60, moonY = 30 + P.d * 60;
      if (P.d > 0.06) {
        ctx.globalAlpha = 0.28; disc(ctx, sx, sunY, 11, '#ffec27'); ctx.globalAlpha = 1;
        disc(ctx, sx, sunY, 7, P.d > 0.8 ? '#fff08a' : '#ffb347'); disc(ctx, sx, sunY, 5, P.d > 0.8 ? '#ffec27' : '#ffd36b');
      }
      if (P.d < 0.94) {
        ctx.globalAlpha = U.clamp(1 - P.d * 1.1, 0, 1);
        disc(ctx, sx, moonY, 7, '#fff1e8'); ctx.fillStyle = '#c2c3c7'; ctx.fillRect(sx - 3, moonY - 3, 2, 2); ctx.fillRect(sx + 1, moonY + 1, 3, 2); ctx.fillRect(sx + 2, moonY - 4, 2, 1);
        ctx.globalAlpha = 1;
      }
      /* far mountains (slow) + clouds + near dunes */
      var off = Math.floor(scroll * 0.1), col = 2;
      ctx.fillStyle = P.far;
      for (x = 0; x < w; x += col) {
        var wx = x + off, mh = 16 + 20 * tri(wx / 110) + 9 * tri(wx / 43 + 0.3);
        ctx.fillRect(x, GROUND - 4 - Math.floor(mh), col, Math.floor(mh) + 4);
      }
      for (i = 0; i < clouds.length; i++) drawCloud(ctx, clouds[i]);
      off = Math.floor(scroll * 0.32); ctx.fillStyle = P.near;
      for (x = 0; x < w; x += col) {
        var dh = 6 + 7 * tri((x + off) / 70) + 3 * tri((x + off) / 29 + 0.6);
        ctx.fillRect(x, GROUND - Math.floor(dh), col, Math.floor(dh) + 1);
      }
      /* ground */
      ctx.fillStyle = P.gA; ctx.fillRect(0, GROUND, w, 7);
      ctx.fillStyle = P.hi; ctx.fillRect(0, GROUND, w, 1);
      ctx.fillStyle = P.gB; ctx.fillRect(0, GROUND + 7, w, h - GROUND - 7);
      ctx.fillStyle = P.spk; ctx.fillRect(0, GROUND + 7, w, 1);
      var gs = Math.floor(scroll), cell = 14, c0 = Math.floor(gs / cell);
      for (i = 0; i < Math.ceil(w / cell) + 2; i++) {
        var ci = c0 + i, hx = hash(ci * 7 + 3), hy = hash(ci * 13 + 5), hz = hash(ci * 31 + 9);
        var px = ci * cell - gs + Math.floor(hx * cell);
        ctx.fillStyle = P.spk; ctx.fillRect(px, GROUND + 2 + Math.floor(hy * 4), 2 + Math.floor(hz * 3), 1);
        ctx.fillRect(px + 5, GROUND + 10 + Math.floor(hz * 20), 1, 1);
        if (hy > 0.55) ctx.fillRect(px + 2, GROUND + 13 + Math.floor(hx * 16), 3, 1);
        if (hz > 0.7) { ctx.fillStyle = P.hi; ctx.fillRect(px - 3, GROUND + 18 + Math.floor(hy * 12), 2, 1); }
      }
      /* obstacles */
      for (i = 0; i < obs.length; i++) drawObstacle(ctx, obs[i]);
      /* dino */
      drawDino(ctx);
      /* HUD */
      R.draw.topBar(ctx);
      if (cpT > 0 && Math.floor(cpT * 10) % 2 === 0) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 55, 12);
        R.draw.text(ctx, 'SC ' + U.pad(R.score, 5), 3, 3, { size: 6, color: C.white });
      }
    }
  });

  function disc(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (var y = -r; y <= r; y++) { var half = Math.floor(Math.sqrt(r * r + 0.5 - y * y)); ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1); }
  }
  function drawCloud(ctx, c) {
    var spans = c.big ? CLOUD_BIG : CLOUD_SM, x = Math.round(c.x), y = Math.round(c.y), i;
    ctx.fillStyle = P.cloud;
    for (i = 0; i < spans.length; i++) ctx.fillRect(x + spans[i][0], y + i, spans[i][1] - spans[i][0] + 1, 1);
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    var last = spans.length - 1; ctx.fillRect(x + spans[last][0], y + last, spans[last][1] - spans[last][0] + 1, 1);
    ctx.globalAlpha = 1;
  }
  function drawObstacle(ctx, o) {
    var i, p, x = Math.round(o.x);
    if (o.kind === 'cactus') {
      for (i = 0; i < o.parts.length; i++) {
        p = o.parts[i]; var spr = S.cactus[p.t];
        R.draw.sprite(ctx, spr, x + p.dx, GROUND - spr.height + 1);
      }
    } else if (o.kind === 'bird') {
      var fr = Math.floor(R.time * 9) & 1, spr2 = S.bird[fr];
      R.draw.sprite(ctx, spr2, x, GROUND - o.by - 5);
    } else {
      var f = Math.floor(o.roll / (Math.PI * 14 / 8)) & 7;
      R.draw.sprite(ctx, S.rock[f], x, GROUND - 15);
    }
  }
  function drawDino(ctx) {
    var spr, y;
    if (dead) spr = S.dead;
    else if (dino.air) spr = S.jump;
    else if (dino.duck) spr = S.duck[Math.floor(anim) & 1];
    else spr = S.run[Math.floor(anim) & 1];
    if (R.mode === 'ready') spr = S.run[0];
    y = dino.y - spr.height + 1;
    R.draw.rect(ctx, DX + 2, GROUND + 1, 14, 1, 'rgba(0,0,0,0.18)');
    R.draw.sprite(ctx, spr, DX, Math.round(y));
  }
})();
