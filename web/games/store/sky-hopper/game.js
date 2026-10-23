/* Sky Hopper — bounce up from the clouds into space, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164, WRAP = W;
  var G = 520, BOUNCE = 272, SPRING_V = 440, STOMP_V = 255, MAXVX = 98, ACC = 640, FRIC = 520;
  var HW = 5, HH = 12;                                          // hero hit-box: half width, height (feet at hero.y)
  var CAM_LINE = 0.42, AMMO_MAX = 5, AMMO_REFILL = 1.35;
  var PROP_V = 135, PROP_T = 3.2, ROCKET_V = 300, ROCKET_T = 2.0;
  var START_Y = 146;

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function shade(h, amt) { var n = parseInt(h.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; function f(c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); } return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }

  /* ------------------------------------------------------------------ sprites */
  function outline(lines) {
    var h = lines.length, w = lines[0].length, y, x, out = [];
    function at(x, y) { return (y < 0 || y >= h || x < 0 || x >= w) ? '.' : lines[y].charAt(x); }
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
  function grid(w, h) { var g = [], x, y; for (y = 0; y < h; y++) { var r = []; for (x = 0; x < w; x++) r.push('.'); g.push(r); } return g; }
  function rows(g) { return g.map(function (r) { return r.join(''); }); }

  var HERO_PAL = { o: '#4a1d0a', '#': '#ff9a3c', d: '#d96a1f', h: '#ffc27a', B: '#ffe8b0', W: '#ffffff', K: '#1d2b53', P: '#ff77a8', R: '#ff3d6e', a: '#d96a1f', m: '#4a1d0a', F: '#d96a1f' };
  function heroRows(falling) {
    var w = 14, h = 17, g = grid(w, h), x, y;
    function put(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var dx = (x - 6.5) / 6.4, dy = (y - 9.8) / 7.0;
      if (dx * dx + dy * dy <= 1) put(x, y, (dx * 0.6 + dy * 0.8 > 0.5) ? 'd' : (dx + dy < -1.05 ? 'h' : '#'));
    }
    [[6, 0], [7, 0], [6, 1], [7, 1]].forEach(function (p) { put(p[0], p[1], 'R'); });
    put(6, 2, 'a'); put(7, 2, 'a'); put(6, 3, 'a'); put(7, 3, 'a');
    var arms = falling ? [[0, 6], [0, 7], [1, 7], [13, 6], [13, 7], [12, 7]] : [[0, 11], [0, 12], [1, 11], [13, 11], [13, 12], [12, 11]];
    arms.forEach(function (p) { put(p[0], p[1], 'F'); });
    var feet = falling ? [[1, 15], [2, 16], [3, 16], [4, 16], [10, 16], [11, 16], [12, 16], [12, 15], [0, 16]] : [[3, 16], [4, 16], [5, 16], [8, 16], [9, 16], [10, 16]];
    feet.forEach(function (p) { put(p[0], p[1], 'F'); });
    // belly
    for (y = 11; y <= 14; y++) for (x = 5; x <= 9; x++) { var bx = (x - 7) / 2.8, by = (y - 12.6) / 2.3; if (bx * bx + by * by <= 1) put(x, y, 'B'); }
    // eyes (looking right)
    [[3, 6], [4, 6], [5, 6], [3, 7], [4, 7], [5, 7], [3, 8], [4, 8], [5, 8], [8, 6], [9, 6], [10, 6], [8, 7], [9, 7], [10, 7], [8, 8], [9, 8], [10, 8]].forEach(function (p) { put(p[0], p[1], 'W'); });
    [[5, 7], [5, 8], [4, 8], [10, 7], [10, 8], [9, 8]].forEach(function (p) { put(p[0], p[1], 'K'); });
    put(3, 10, 'P'); put(4, 10, 'P'); put(10, 10, 'P'); put(11, 10, 'P');
    put(6, 10, 'm'); put(7, 10, 'm'); put(8, 10, 'm');
    return outline(rows(g));
  }
  var BLOB_PAL = { o: '#10401c', '#': '#5fe36b', d: '#2fae4a', h: '#b8ffb0', W: '#ffffff', K: '#1d2b53', T: '#fff1e8', m: '#10401c' };
  function blobRows(squash) {
    var w = 16, h = squash ? 10 : 12, g = grid(w, h), x, y, cy = h - 1;
    function put(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var dx = (x - 7.5) / (squash ? 8.0 : 7.6), dy = (y - cy) / (h - 0.6);
      if (dx * dx + dy * dy <= 1) put(x, y, y >= h - 3 ? 'd' : (dx + dy < -0.85 ? 'h' : '#'));
    }
    var ey = h - 7;
    [[4, ey], [5, ey], [4, ey + 1], [5, ey + 1], [10, ey], [11, ey], [10, ey + 1], [11, ey + 1]].forEach(function (p) { put(p[0], p[1], 'W'); });
    [[5, ey + 1], [10, ey + 1], [5, ey], [10, ey]].forEach(function (p) { put(p[0], p[1], 'K'); });
    put(5, ey - 1, 'm'); put(4, ey - 1, 'm'); put(10, ey - 1, 'm'); put(11, ey - 1, 'm');
    put(6, h - 3, 'm'); put(7, h - 3, 'm'); put(8, h - 3, 'm'); put(9, h - 3, 'm');
    put(6, h - 2, 'T'); put(9, h - 2, 'T');
    return outline(rows(g));
  }
  var UFO_PAL = { o: '#2a0f4a', '#': '#a85cff', d: '#6a2fb0', h: '#d9b0ff', G: '#9fe8ff', g: '#5fb8d8', Y: '#ffec27', y: '#ff9f1c', K: '#1d2b53', W: '#ffffff' };
  function ufoRows(f) {
    var w = 18, h = 11, g = grid(w, h), x, y;
    function put(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; }
    for (y = 0; y < 5; y++) for (x = 0; x < w; x++) { var dx = (x - 8.5) / 4.7, dy = (y - 4.5) / 4.6; if (dx * dx + dy * dy <= 1) put(x, y, dx + dy < -0.7 ? 'W' : 'G'); }
    for (y = 4; y < 10; y++) for (x = 0; x < w; x++) { var ex = (x - 8.5) / 8.7, ey = (y - 6.2) / 3.3; if (ex * ex + ey * ey <= 1) put(x, y, y >= 8 ? 'd' : (ex + ey < -0.9 ? 'h' : '#')); }
    put(8, 2, 'K'); put(9, 2, 'K'); put(8, 3, 'K'); put(9, 3, 'K');                     // the pilot's eye
    [[3, 7], [8, 8], [13, 7]].forEach(function (p, i) { put(p[0], p[1], (i + f) % 2 ? 'Y' : 'y'); put(p[0] + 1, p[1], (i + f) % 2 ? 'Y' : 'y'); });
    return outline(rows(g));
  }
  var S = {};
  function buildSprites() {
    S.hero = [R.sprite(heroRows(false), HERO_PAL), R.sprite(heroRows(true), HERO_PAL)];
    S.blob = [R.sprite(blobRows(false), BLOB_PAL), R.sprite(blobRows(true), BLOB_PAL)];
    S.ufo = [R.sprite(ufoRows(0), UFO_PAL), R.sprite(ufoRows(1), UFO_PAL)];
  }

  /* ------------------------------------------------------------- sky palettes */
  var KF = [
    { h: 0, a: '#3d9bf0', b: '#cdeeff', cloud: '#ffffff' },
    { h: 900, a: '#ff7fb0', b: '#ffd9a0', cloud: '#fff0f0' },
    { h: 1800, a: '#4b1f90', b: '#d46fc4', cloud: '#e9b8f0' },
    { h: 3000, a: '#03041a', b: '#171c58', cloud: '#5a5a9a' },
    { h: 99999, a: '#03041a', b: '#171c58', cloud: '#5a5a9a' }
  ];
  KF.forEach(function (k) { k.a = hex(k.a); k.b = hex(k.b); k.cloud = hex(k.cloud); });
  var SKY = { bands: [], cloud: '#fff', space: 0 };
  function setSky(h) {
    var i = 0; while (i < KF.length - 2 && h > KF[i + 1].h) i++;
    var a = KF[i], b = KF[i + 1], t = U.clamp((h - a.h) / (b.h - a.h), 0, 1);
    var ta = mix(a.a, b.a, t), tb = mix(a.b, b.b, t);
    SKY.bands.length = 0;
    for (var s = 0; s < 14; s++) SKY.bands.push(rgb(mix(ta, tb, Math.pow(s / 13, 1.1))));
    SKY.cloud = rgb(mix(a.cloud, b.cloud, t));
    SKY.space = U.clamp((h - 1700) / 1500, 0, 1);
    SKY.cloudA = U.clamp(1 - (h - 2000) / 900, 0, 1);
  }
  var CLOUD_BIG = [[3, 9], [1, 13], [0, 17], [0, 20], [2, 21], [4, 22]];
  var CLOUD_SM = [[2, 6], [0, 9], [0, 12], [1, 13]];

  /* -------------------------------------------------------------------- state */
  var hero, plats, mons, bullets, debris, clouds, stars, camY, genY, lastSolid, maxH, bonus, ammo, ammoT, kills, monCd, deadT, t, zone, pulse;

  function difficulty() { return U.clamp(maxH / 4200, 0, 1); }

  function addPlat(force) {
    var d = difficulty(), n = plats.length, easy = n < 5;
    var gap = easy ? U.rand(28, 36) : U.rand(30, U.lerp(46, 62, d));
    genY = Math.max(genY - gap, lastSolid - 60);          // every platform stays within one jump of the last non-crumbling one
    var w = Math.round(U.lerp(30, 22, d)), x = U.rand(2, W - w - 2), type = 'normal', h = START_Y - genY, r = Math.random();
    if (!easy && h > 450 && r < 0.12 + 0.12 * d) type = 'moving';
    else if (!easy && h > 800 && r > 0.88 - 0.1 * d) type = 'crumble';
    var p = { x: x, y: genY, w: w, type: type, dir: Math.random() < 0.5 ? -1 : 1, spd: U.rand(18, 32) + 16 * d, crumble: -1, broken: false, shake: 0, spring: null, item: null };
    if (type === 'normal' && !easy) {
      if (Math.random() < 0.09) p.spring = { off: U.randInt(3, w - 10), t: 0 };
      else if (h > 700 && Math.random() < 0.04) p.item = { kind: Math.random() < 0.62 ? 'prop' : 'rocket', off: U.randInt(4, w - 12), got: false };
    }
    if (type !== 'crumble') lastSolid = genY;
    plats.push(p);
    // monsters hover in the gap below this platform
    monCd--;
    if (!easy && h > 420 && monCd <= 0) {
      monCd = U.randInt(7, 13) - Math.round(4 * d);
      var ufo = h > 900 && Math.random() < 0.45;
      mons.push({ kind: ufo ? 'ufo' : 'blob', ox: U.rand(14, W - 14), x: 0, y: genY + Math.min(gap, 50) * 0.5, w: ufo ? 18 : 16, h: ufo ? 9 : 12, hp: ufo ? 2 : 1, t: U.rand(0, 6), hit: 0 });
      mons[mons.length - 1].x = mons[mons.length - 1].ox;
    }
  }

  function bounce(p, v, spring) {
    hero.vy = -v; hero.squash = 0.12;
    if (spring) {
      R.sfx.tone(300, 0.25, { type: 'square', vol: 0.1, slide: 1000 }); R.vibrate(18);
      R.fx.burst(hero.x, hero.y, { n: 10, color: ['#ffec27', '#ffffff', '#ff9f1c'], speed: 70, life: 0.45, size: 1, gravity: 100 });
    } else {
      R.sfx.tone(300, 0.14, { type: 'square', vol: 0.09, slide: 560 });
      R.fx.burst(hero.x, hero.y + 1, { n: 4, color: ['#ffffff', '#cfeeff'], speed: 30, life: 0.3, size: 1, gravity: 40 });
    }
  }

  function killMon(m, how) {
    m.dead = true; kills++;
    R.sfx.play('explode'); R.vibrate(25); R.fx.shake(1.5, 0.12);
    var col = m.kind === 'ufo' ? ['#a85cff', '#9fe8ff', '#ffec27', '#ffffff'] : ['#5fe36b', '#b8ffb0', '#ffffff', '#2fae4a'];
    R.fx.burst(m.x, m.y, { n: 18, color: col, speed: 85, life: 0.55, size: 2, gravity: 120 });
    var pts = m.kind === 'ufo' ? 30 : 20; bonus += pts; R.fx.text(m.x, m.y - 8, '+' + pts, C.yellow);
    if (kills >= 3) R.achieve('monster-hunter');
  }

  function die(fall) {
    if (hero.dead) return;
    hero.dead = true; hero.fly = null;
    deadT = fall ? 0.5 : 0.95;
    R.sfx.play('hit'); R.vibrate(90);
    if (!fall) { hero.vy = -170; R.fx.shake(3, 0.3); R.fx.burst(hero.x, hero.y - 8, { n: 16, color: ['#ff9a3c', '#ffe8b0', '#ffffff', '#ff3d6e'], speed: 80, life: 0.6, gravity: 140, size: 2 }); }
  }

  function shoot() {
    ammo--; ammoT = 0;
    bullets.push({ x: hero.x, y: hero.y - HH - 4, vy: -300, life: 0.55 });
    R.sfx.play('shoot'); R.fx.burst(hero.x, hero.y - HH - 4, { n: 3, color: ['#3de2ff', '#ffffff'], speed: 24, life: 0.2, size: 1 });
  }

  function newClouds() {
    clouds = [];
    for (var i = 0; i < 6; i++) clouds.push({ x: U.rand(-10, W), y: i * 30 + U.rand(-10, 10), big: Math.random() < 0.5, z: U.rand(0.35, 0.6) });
    stars = []; for (i = 0; i < 40; i++) stars.push({ x: U.rand(0, W), y: U.rand(0, H), ph: U.rand(0, 6.28), z: U.rand(0.05, 0.22) });
  }

  R.game({
    layout: 'full', size: [W, H], bg: '#3d9bf0', music: 'space',

    _dbg: function () { return { hero: hero, plats: plats, mons: mons, camY: camY, maxH: maxH, ammo: ammo, K: { G: G, BOUNCE: BOUNCE, MAXVX: MAXVX, HW: HW, HH: HH, W: W, H: H, WRAP: WRAP }, warp: function (hh) { maxH = hh; } }; }, /*DBG*/

    init: function () { buildSprites(); },

    reset: function () {
      hero = { x: 68, y: START_Y, vx: 0, vy: -BOUNCE, face: 1, fly: null, dead: false, squash: 0, spin: 0 };
      plats = []; mons = []; bullets = []; debris = [];
      camY = 0; genY = START_Y; lastSolid = START_Y; maxH = 0; bonus = 0; ammo = AMMO_MAX; ammoT = 0; kills = 0; monCd = 6; deadT = 0; t = 0; zone = 1; pulse = 0;
      plats.push({ x: 48, y: START_Y, w: 40, type: 'normal', dir: 1, spd: 0, crumble: -1, broken: false, shake: 0, spring: null, item: null });
      while (genY > camY - 50) addPlat();
      newClouds(); setSky(0);
      R.level = 1; R.lives = null; R.score = 0;
    },

    update: function (dt) {
      var inp = R.input, i, j, p, m;
      t += dt;
      if (hero.dead) {
        hero.vy += G * dt; hero.y += hero.vy * dt; hero.spin += dt * 9;
        deadT -= dt; if (deadT <= 0) R.gameOver();
        updateDebris(dt);
        return;
      }
      /* steering */
      var ax = inp.axisX();
      if (ax) { hero.vx += ax * ACC * (Math.sign(hero.vx) === -ax ? 1.6 : 1) * dt; hero.face = ax; }
      else { var f = FRIC * dt; hero.vx = Math.abs(hero.vx) <= f ? 0 : hero.vx - Math.sign(hero.vx) * f; }
      hero.vx = U.clamp(hero.vx, -MAXVX, MAXVX);
      /* shooting */
      if ((inp.pressed('a') || inp.pressed('b')) && ammo > 0) shoot();
      if (ammo < AMMO_MAX) { ammoT += dt; if (ammoT >= AMMO_REFILL) { ammoT = 0; ammo++; R.sfx.tone(1500, 0.03, { vol: 0.05 }); } } else ammoT = 0;
      /* flight / gravity */
      var prevY = hero.y;
      if (hero.fly) {
        var fl = hero.fly, tv = fl.kind === 'rocket' ? ROCKET_V : PROP_V;
        fl.t -= dt; hero.vy += (-tv - hero.vy) * Math.min(1, dt * 7);
        if (fl.kind === 'rocket') R.fx.burst(hero.x - hero.face * 4, hero.y + 2, { n: 2, color: ['#ffec27', '#ff9f1c', '#ff3d6e'], speed: 40, life: 0.3, size: 2, gravity: 160 });
        else if (Math.random() < 0.5) R.fx.burst(hero.x, hero.y - 17, { n: 1, color: ['#ffffff', '#cfeeff'], speed: 18, life: 0.25, size: 1 });
        if (fl.t <= 0) { hero.fly = null; hero.vy = -110; }
      } else hero.vy += G * dt;
      hero.y += hero.vy * dt; hero.x += hero.vx * dt;
      if (hero.x > W) hero.x -= WRAP; else if (hero.x < 0) hero.x += WRAP;
      if (hero.squash > 0) hero.squash -= dt;
      pulse -= dt;

      /* platforms */
      for (i = 0; i < plats.length; i++) {
        p = plats[i];
        if (p.type === 'moving') { p.x += p.dir * p.spd * dt; if (p.x < 0) { p.x = 0; p.dir = 1; } else if (p.x > W - p.w) { p.x = W - p.w; p.dir = -1; } }
        if (p.crumble >= 0) {
          p.crumble -= dt; p.shake = 1;
          if (p.crumble < 0) {
            p.broken = true; p.crumble = -1;
            R.sfx.noise(0.18, { vol: 0.08, freq: 1200, sweep: 200 });
            for (j = 0; j < 4; j++) debris.push({ x: p.x + (j + 0.5) * p.w / 4, y: p.y, vx: U.rand(-25, 25), vy: U.rand(-40, 0), w: Math.ceil(p.w / 4), h: 5, col: '#b06a3b', rot: 0 });
          }
        }
        if (p.spring && p.spring.t > 0) p.spring.t -= dt;
        if (p.broken || hero.fly || hero.vy <= 0) continue;
        if (prevY <= p.y + 1.5 && hero.y >= p.y) {
          var hit = false, hx = hero.x, sx = 0, k, xs = [hx, hx - WRAP, hx + WRAP];
          for (k = 0; k < 3; k++) if (xs[k] + HW > p.x && xs[k] - HW < p.x + p.w) { hit = true; sx = xs[k]; break; }
          if (!hit) continue;
          hero.y = p.y;
          if (p.spring && sx > p.x + p.spring.off - 3 && sx < p.x + p.spring.off + 11) { p.spring.t = 0.35; bounce(p, SPRING_V, true); }
          else if (p.type === 'crumble') { bounce(p, BOUNCE * 0.92, false); if (p.crumble < 0) p.crumble = 0.2; }
          else bounce(p, BOUNCE, false);
          break;
        }
      }
      /* pick-ups */
      for (i = 0; i < plats.length; i++) {
        p = plats[i];
        if (!p.item || p.item.got || p.broken) continue;
        var ix = p.x + p.item.off + 4, iy = p.y - 6;
        if (Math.abs(ix - hero.x) < HW + 5 && Math.abs(iy - (hero.y - HH / 2)) < HH / 2 + 6) {
          p.item.got = true;
          hero.fly = { kind: p.item.kind, t: p.item.kind === 'rocket' ? ROCKET_T : PROP_T, max: p.item.kind === 'rocket' ? ROCKET_T : PROP_T };
          R.sfx.play('powerup'); R.vibrate(30); R.fx.flash('#ffffff', 0.12);
          R.fx.burst(ix, iy, { n: 12, color: ['#ffec27', '#ffffff', '#3de2ff'], speed: 70, life: 0.5, size: 2 });
          R.achieve('rocketeer');
        }
      }
      /* monsters */
      for (i = mons.length - 1; i >= 0; i--) {
        m = mons[i]; m.t += dt; if (m.hit > 0) m.hit -= dt;
        if (m.kind === 'ufo') m.x = m.ox + Math.sin(m.t * 1.1) * 30; else m.y += Math.sin(m.t * 3) * 7 * dt;
        if (m.dead) { mons.splice(i, 1); continue; }
        var ov = Math.abs(m.x - hero.x) < m.w / 2 + HW - 1 && hero.y > m.y - m.h / 2 && hero.y - HH < m.y + m.h / 2;
        if (!ov) continue;
        if (hero.fly) killMon(m);
        else if (hero.vy > 30 && prevY <= m.y - m.h / 2 + 5) { killMon(m); hero.vy = -STOMP_V; R.sfx.tone(500, 0.1, { vol: 0.1, slide: 900 }); }
        else { die(false); return; }
      }
      /* bullets */
      for (i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i]; b.y += b.vy * dt; b.life -= dt;
        var gone = b.life <= 0;
        for (j = 0; j < mons.length && !gone; j++) {
          m = mons[j];
          if (!m.dead && Math.abs(b.x - m.x) < m.w / 2 + 2 && Math.abs(b.y - m.y) < m.h / 2 + 3) {
            gone = true; m.hp--; m.hit = 0.12;
            R.fx.burst(b.x, b.y, { n: 5, color: ['#3de2ff', '#ffffff'], speed: 50, life: 0.2, size: 1 });
            if (m.hp <= 0) killMon(m); else R.sfx.tone(240, 0.08, { type: 'sawtooth', vol: 0.1 });
          }
        }
        if (gone) bullets.splice(i, 1);
      }
      updateDebris(dt);

      /* camera, height, zones */
      if (hero.y < camY + H * CAM_LINE) camY = hero.y - H * CAM_LINE;
      var h = START_Y - hero.y; if (h > maxH) maxH = h;
      var sc = Math.floor(maxH / 4) + bonus; if (sc > R.score) R.score = sc;
      if (R.score >= 500) R.achieve('high-flyer');
      var z = 1 + (maxH >= 900 ? 1 : 0) + (maxH >= 1800 ? 1 : 0) + (maxH >= 3000 ? 1 : 0);
      if (z > zone) {
        zone = z; R.level = z; R.sfx.play('powerup'); R.fx.flash('#ffffff', 0.15); R.fx.text(W / 2, 44, ['', 'SUNSET', 'TWILIGHT', 'OUTER SPACE'][z - 1], C.white);
        if (z === 4) R.achieve('stargazer');
      }
      setSky(maxH);
      /* world generation & cleanup */
      while (genY > camY - 50) addPlat();
      while (plats.length && plats[0].y > camY + H + 40) plats.shift();
      for (i = mons.length - 1; i >= 0; i--) if (mons[i].y > camY + H + 40) mons.splice(i, 1);
      /* parallax clouds */
      for (i = 0; i < clouds.length; i++) {
        var cl = clouds[i], sy = cl.y - camY * cl.z;
        if (sy > H + 24) { cl.y -= H + 60 + U.rand(0, 40); cl.x = U.rand(-8, W - 10); cl.big = Math.random() < 0.5; }
      }
      if (hero.y > camY + H + 14) die(true);
    },

    render: function (ctx, w, h) {
      var i, x, y, bandH = Math.ceil(h / SKY.bands.length);
      for (i = 0; i < SKY.bands.length; i++) { ctx.fillStyle = SKY.bands[i]; ctx.fillRect(0, i * bandH, w, bandH + 1); }
      /* stars + planet */
      if (SKY.space > 0) {
        for (i = 0; i < stars.length; i++) {
          var st = stars[i], sy = ((st.y - camY * st.z) % h + h) % h;
          ctx.globalAlpha = SKY.space * (0.5 + 0.5 * Math.sin(t * 2.2 + st.ph)); ctx.fillStyle = '#fff1e8';
          ctx.fillRect(Math.floor(st.x), Math.floor(sy), st.z > 0.15 ? 2 : 1, st.z > 0.15 ? 2 : 1);
        }
        ctx.globalAlpha = SKY.space; drawPlanet(ctx); ctx.globalAlpha = 1;
      }
      /* clouds */
      if (SKY.cloudA > 0) {
        ctx.globalAlpha = SKY.cloudA;
        for (i = 0; i < clouds.length; i++) {
          var cl = clouds[i], spans = cl.big ? CLOUD_BIG : CLOUD_SM, cy = Math.round(cl.y - camY * cl.z), cx = Math.round(cl.x);
          ctx.fillStyle = SKY.cloud;
          for (var r = 0; r < spans.length; r++) ctx.fillRect(cx + spans[r][0], cy + r, spans[r][1] - spans[r][0] + 1, 1);
        }
        ctx.globalAlpha = 1;
      }
      /* platforms */
      var oy = Math.round(camY);
      for (i = 0; i < plats.length; i++) if (!plats[i].broken) drawPlat(ctx, plats[i], oy);
      for (i = 0; i < debris.length; i++) { var d = debris[i]; ctx.fillStyle = d.col; ctx.fillRect(Math.round(d.x), Math.round(d.y - oy), d.w, d.h); }
      for (i = 0; i < mons.length; i++) drawMon(ctx, mons[i], oy);
      for (i = 0; i < bullets.length; i++) { var b = bullets[i]; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y - oy) - 3, 3, 6); ctx.fillStyle = '#3de2ff'; ctx.fillRect(Math.round(b.x), Math.round(b.y - oy) - 3, 1, 6); }
      drawHero(ctx, oy);
      /* HUD */
      R.draw.topBar(ctx);
      for (i = 0; i < AMMO_MAX; i++) {
        var on = i < ammo;
        ctx.fillStyle = on ? '#3de2ff' : 'rgba(255,255,255,0.22)'; ctx.fillRect(3 + i * 5, 15, 3, 6);
        if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(3 + i * 5, 15, 1, 6); }
        else if (i === ammo) { ctx.fillStyle = '#3de2ff'; var fh = Math.floor(6 * ammoT / AMMO_REFILL); ctx.fillRect(3 + i * 5, 21 - fh, 3, fh); }
      }
      if (hero.fly) {
        var fl = hero.fly, wd = Math.max(0, Math.round(30 * fl.t / fl.max));
        if (fl.t > 0.7 || Math.floor(t * 8) % 2) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(w - 35, 15, 32, 5); ctx.fillStyle = fl.kind === 'rocket' ? '#ff6a3d' : '#ffec27'; ctx.fillRect(w - 34, 16, wd, 3); }
      }
    }
  });

  function updateDebris(dt) {
    for (var i = debris.length - 1; i >= 0; i--) { var d = debris[i]; d.vy += 420 * dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.y > camY + H + 20) debris.splice(i, 1); }
  }

  /* ------------------------------------------------------------------ drawing */
  function drawPlanet(ctx) {
    var drift = (maxH - 2400) * 0.08, idx = Math.floor(drift / 330), sy = drift - idx * 330 - 60, i;
    if (sy < -40 || sy > H + 30) return;
    var px = 36 + hash(idx + 5) * 64, pal = [['#7c4dff', '#a98bff', '#5d33c9', '#ffd6f5'], ['#ff7a45', '#ffb085', '#c9501f', '#ffe3a8'], ['#2fd6a5', '#8af5d8', '#169c78', '#d6fff3']][((idx % 3) + 3) % 3];
    ctx.fillStyle = pal[0]; disc(ctx, px, sy, 15);
    ctx.fillStyle = pal[1]; disc(ctx, px - 4, sy - 4, 8);
    ctx.fillStyle = pal[2]; for (i = 0; i < 3; i++) ctx.fillRect(px - 11 + i * 2, sy + 4 + i * 3, 22 - i * 4, 2);
    ctx.fillStyle = pal[3]; ctx.fillRect(px - 25, sy + 1, 50, 2); ctx.fillStyle = pal[1]; ctx.fillRect(px - 21, sy + 3, 42, 1);
    ctx.fillStyle = pal[1]; for (i = -14; i <= 14; i++) ctx.fillRect(px + i, sy - 3 + (i * i > 100 ? 0 : 0), 1, 1);
  }
  function disc(ctx, cx, cy, r) { for (var y = -r; y <= r; y++) { var half = Math.floor(Math.sqrt(r * r + 0.5 - y * y)); ctx.fillRect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1); } }

  function drawPlat(ctx, p, oy) {
    var x = Math.round(p.x), y = Math.round(p.y) - oy, w = p.w, sh = p.shake ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
    if (y < -12 || y > H + 12) return;
    x += sh;
    if (p.type === 'normal') {
      ctx.fillStyle = '#2f9e44'; ctx.fillRect(x, y + 2, w, 4);
      ctx.fillStyle = '#6be04a'; ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = '#b6ff7a'; ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + 1, y + 5, w - 2, 2);
      ctx.fillStyle = '#3f7a2e'; for (var i = 3; i < w - 3; i += 6) ctx.fillRect(x + i, y + 3, 2, 1);
    } else if (p.type === 'moving') {
      ctx.fillStyle = '#1d6fb8'; ctx.fillRect(x, y + 1, w, 5);
      ctx.fillStyle = '#3da9fc'; ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = '#b8e4ff'; ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = '#ffffff'; var mid = x + (w >> 1);
      ctx.fillRect(mid - 6, y + 3, 3, 1); ctx.fillRect(mid + 3, y + 3, 3, 1); ctx.fillRect(mid - 7, y + 2, 1, 3); ctx.fillRect(mid + 6, y + 2, 1, 3);
    } else {
      ctx.fillStyle = '#7a4524'; ctx.fillRect(x, y + 2, w, 4);
      ctx.fillStyle = '#c07a42'; ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = '#e0a468'; ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = '#4a2a14'; ctx.fillRect(x + 5, y + 1, 1, 4); ctx.fillRect(x + 6, y + 4, 2, 1); ctx.fillRect(x + w - 9, y, 1, 3); ctx.fillRect(x + w - 8, y + 3, 2, 1); ctx.fillRect(x + (w >> 1), y + 2, 1, 4);
    }
    if (p.spring) {
      var sx = x + p.spring.off, up = p.spring.t > 0;
      ctx.fillStyle = '#9aa3b5'; ctx.fillRect(sx, y - 1, 8, 1);
      ctx.fillStyle = '#d0d6e4'; ctx.fillRect(sx + 1, y - (up ? 7 : 4), 6, up ? 6 : 3);
      ctx.fillStyle = '#7a8398'; for (var s = 0; s < (up ? 3 : 2); s++) ctx.fillRect(sx + 1, y - 2 - s * 2, 6, 1);
      ctx.fillStyle = '#ff3d6e'; ctx.fillRect(sx - 1, y - (up ? 9 : 6), 10, 2); ctx.fillStyle = '#ff9fb4'; ctx.fillRect(sx - 1, y - (up ? 9 : 6), 10, 1);
    }
    if (p.item && !p.item.got) {
      var ix = x + p.item.off, bob = Math.round(Math.sin(t * 5 + p.x) * 1);
      if (p.item.kind === 'prop') {
        ctx.fillStyle = '#ff3d6e'; ctx.fillRect(ix + 1, y - 5 + bob, 6, 4); ctx.fillStyle = '#ffec27'; ctx.fillRect(ix + 3, y - 7 + bob, 2, 2);
        ctx.fillStyle = '#ffffff'; var bl = Math.floor(t * 12) % 2 ? 8 : 4; ctx.fillRect(ix + 4 - bl / 2, y - 8 + bob, bl, 1);
      } else {
        ctx.fillStyle = '#e8ecf5'; ctx.fillRect(ix + 2, y - 12 + bob, 4, 9); ctx.fillStyle = '#ff3d6e'; ctx.fillRect(ix + 3, y - 14 + bob, 2, 2); ctx.fillRect(ix + 2, y - 12 + bob, 4, 1);
        ctx.fillStyle = '#3da9fc'; ctx.fillRect(ix + 3, y - 9 + bob, 2, 2); ctx.fillStyle = '#ff3d6e'; ctx.fillRect(ix, y - 5 + bob, 2, 3); ctx.fillRect(ix + 6, y - 5 + bob, 2, 3);
        ctx.fillStyle = '#ffec27'; ctx.fillRect(ix + 3, y - 3 + bob, 2, 2);
      }
    }
  }
  function drawMon(ctx, m, oy) {
    var spr = m.kind === 'ufo' ? S.ufo[Math.floor(m.t * 4) & 1] : S.blob[Math.floor(m.t * 3.5) & 1];
    var x = Math.round(m.x - spr.width / 2), y = Math.round(m.y - oy - spr.height / 2);
    if (m.hit > 0) { ctx.globalAlpha = 0.55; }
    if (m.kind === 'blob') y += (S.blob[0].height - spr.height) >> 1;
    R.draw.sprite(ctx, spr, x, y);
    ctx.globalAlpha = 1;
  }
  function drawHero(ctx, oy) {
    var falling = hero.vy > 30, spr = S.hero[falling ? 1 : 0], y = Math.round(hero.y - oy), i;
    var sq = hero.squash > 0 ? 1 : 0;
    var passes = [hero.x];
    if (hero.x > W - 10) passes.push(hero.x - WRAP); else if (hero.x < 10) passes.push(hero.x + WRAP);
    for (i = 0; i < passes.length; i++) {
      var x = Math.round(passes[i]);
      ctx.save();
      if (hero.dead) { ctx.translate(x, y - 8); ctx.rotate(hero.spin); ctx.translate(-8, -9); ctx.imageSmoothingEnabled = false; ctx.drawImage(S.hero[1], 0, 0); ctx.restore(); continue; }
      if (hero.fly) drawGear(ctx, x, y);
      if (hero.face < 0) { ctx.translate(x + 8, y - 17 + sq); ctx.scale(-1, 1); ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, 0, 0); }
      else { ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, x - 8, y - 17 + sq); }
      ctx.restore();
      if (hero.fly) drawHat(ctx, x, y);
    }
  }
  function drawGear(ctx, x, y) {
    if (hero.fly.kind !== 'rocket') return;
    var bx = x - hero.face * 9, fl = Math.floor(t * 20) % 2;
    ctx.fillStyle = '#e8ecf5'; ctx.fillRect(bx - 2, y - 14, 4, 9); ctx.fillStyle = '#ff3d6e'; ctx.fillRect(bx - 1, y - 16, 2, 2); ctx.fillRect(bx - 2, y - 14, 4, 1);
    ctx.fillStyle = '#ff3d6e'; ctx.fillRect(bx - 4, y - 8, 2, 3); ctx.fillRect(bx + 2, y - 8, 2, 3);
    ctx.fillStyle = '#ffec27'; ctx.fillRect(bx - 1, y - 5, 2, 3 + fl * 2); ctx.fillStyle = '#ff9f1c'; ctx.fillRect(bx, y - 5, 1, 5 + fl * 2);
  }
  function drawHat(ctx, x, y) {
    if (hero.fly.kind !== 'prop') return;
    var bl = Math.floor(t * 16) % 2 ? 14 : 6;
    ctx.fillStyle = '#ff3d6e'; ctx.fillRect(x - 4, y - 20, 8, 3); ctx.fillStyle = '#ffec27'; ctx.fillRect(x - 1, y - 23, 2, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - bl / 2, y - 24, bl, 1); ctx.fillStyle = '#3da9fc'; ctx.fillRect(x - bl / 2 + 1, y - 25, bl - 2, 1);
  }
})();
