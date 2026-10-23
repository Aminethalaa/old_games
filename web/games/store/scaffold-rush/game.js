/* Scaffold Rush — single-screen tower-climbing arcade, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util, D = R.draw;
  var W = 136, H = 164;
  var SPD = 38, CLIMB = 32, JUMP_V = 118, GRAV = 360, BELT = 12, MAXFALL = 30, BONUS0 = 5000, MALLET_T = 8;
  var NAMES = ['GIRDERS', 'CONVEYORS', 'LIFTS', 'RIVETS'];
  var HINTS = ['CLIMB TO THE FLAG', 'BEWARE THE BELTS', 'RIDE THE LIFTS', 'REMOVE ALL RIVETS'];

  /* ------------------------------------------------------------ helpers */
  function grid(w, h, fn) { var rows = [], x, y, r; for (y = 0; y < h; y++) { r = ''; for (x = 0; x < w; x++) r += fn(x, y); rows.push(r); } return rows; }
  function mirror(half) { return half.map(function (r) { return r + r.split('').reverse().join(''); }); }
  function checkRows(name, rows, w, h) {
    if (rows.length !== h) throw new Error('sprite ' + name + ' has ' + rows.length + ' rows, want ' + h);
    rows.forEach(function (r, i) { if (r.length !== w) throw new Error('sprite ' + name + ' row ' + i + ' has ' + r.length + ' chars, want ' + w); });
  }
  function hsh(x, y, s) { var n = (x * 374761393 + y * 668265263 + s * 144665) | 0; n = (n ^ (n >> 13)) * 1274126177 | 0; return ((n ^ (n >> 16)) >>> 0) % 100; }
  function gy(g, x) { return g.y2 === g.y1 ? g.y1 : g.y1 + (g.y2 - g.y1) * (x - g.x1) / (g.x2 - g.x1); }
  function mkG(x1, y1, x2, y2, o) {
    var g = { x1: x1, y1: y1, x2: x2, y2: y2, flow: 0, belts: [], exit: null, fall: 0, vy: 0 }, k;
    if (o) for (k in o) g[k] = o[k];
    if (!g.flow) g.flow = y2 > y1 ? 1 : -1;
    return g;
  }
  function mkL(x, up, low, broken) { return { x: x, up: up, low: low, y1: gy(up, x), y2: gy(low, x), broken: !!broken }; }

  /* ------------------------------------------------------------ sprites */
  var HP = { h: '#ffd23a', H: '#c98a00', s: '#ffccaa', e: '#1d2b53', v: '#ff7a2a', V: '#ffec27', b: '#29adff', B: '#1c6fb0', k: '#5a3a1a', w: '#ffffff' };
  var HERO = {
    walkA: ['..hhhh..', '.hhhhhh.', 'HHHHHHHH', '..ssss..', '..sssse.', '..ssss..', '.vvVVvv.', '.vvvvvv.', '.bbbbbb.', '..bbbb..', '..b..b..', '.kk..kk.'],
    walkB: ['..hhhh..', '.hhhhhh.', 'HHHHHHHH', '..ssss..', '..sssse.', '..ssss..', '.vvVVvv.', '.vvvvvv.', '.bbbbbb.', '..bbbb..', '...bb...', '..kkkk..'],
    jump: ['..hhhh..', '.hhhhhh.', 'HHHHHHHH', '..ssss..', '..sssse.', '..ssss..', 'svvVVvvs', '.vvvvvv.', '.bbbbbb.', '..bbbb..', '.bb..bb.', '.kk..kk.'],
    front: ['..hhhh..', '.hhhhhh.', 'HHHHHHHH', '..ssss..', '..sese..', '..ssss..', '.vvVVvv.', '.vvvvvv.', '.bbbbbb.', '..bbbb..', '..b..b..', '.kk..kk.']
  };
  var ROBOT_HALF = ['......y', '......k', '.sssssS', 'sSSSSSS', 'sSrrSSS', 'sSrwSSS', 'sSSSSSS', 'sSkwkwk', '.sSSSSS', '..bbbbb', '.bBBBBB', '.bBBBBR', '.bBBBBB', '.bbbbbb', '..kk.kk', '..kk.kk'];
  var ROBOT_PAL = { y: '#ffec27', k: '#1d2b53', s: '#6d7ba0', S: '#c2c3c7', r: '#ff004d', w: '#ffffff', b: '#b04a1a', B: '#ff7a2a', R: '#ffec27' };
  var ITEM = {
    hat: ['..hhhh..', '.hhhhhh.', 'hhhhhhhh', 'HHHHHHHH', '........'],
    box: ['..kkkk..', '.k....k.', 'rrrrrrrr', 'rRRRRRRr', 'rrrYYrrr', 'rrrrrrrr'],
    umb: ['..pppp..', '.pPpPpP.', 'ppPpPpPp', 'pppppppp', '...k....', '...k....', '...k.k..', '....kk..']
  };
  var ITEM_PAL = { hat: { h: '#ffd23a', H: '#c98a00' }, box: { k: '#8a5a2a', r: '#ff4d6d', R: '#ff9aa8', Y: '#ffec27' }, umb: { p: '#b455ff', P: '#ff77a8', k: '#8a5a2a' } };
  var BARREL_FR = [], BARREL_PAL = { k: '#3a1a08', g: '#5f574f', h: '#ffec27', s: '#ffa300', t: '#b4551a' };
  var WILD_PAL = { k: '#3a0614', g: '#7a2030', h: '#ffffff', s: '#ff9aa8', t: '#d01f4a' };
  var NFR = 6;
  var MALLET_PICK = ['..gggg..', '.gGGGGg.', '.gGGGGg.', '..gggg..', '...kk...', '...kk...', '...kk...', '...kk...'];
  var MALLET_PAL = { g: '#8a92b8', G: '#e8f0ff', k: '#a05a20' };
  var BALL_ROWS = ['..kkkk..', '.kyyyyk.', 'kyYYyyyk', 'kyYwyyyk', 'kyyyyyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..'];
  var BALL_PAL = { k: '#5a1a00', y: '#ff7a2a', Y: '#ffc040', w: '#ffffff' };
  var SPARK_FR = [['..y..y..', '.yYyyYy.', '..yOOy..', '.yOwwOy.', '.yOwwOy.', '..yOOy..', '.yYyyYy.', '..y..y..'], ['.y....y.', '..yyyy..', '.yYOOYy.', 'yOOwwOOy', 'yOOwwOOy', '.yYOOYy.', '..yyyy..', '.y....y.']];
  var SPARK_PAL = { y: '#ff4d1a', Y: '#ff9a2a', O: '#ffec27', w: '#ffffff' };
  var spriteCache = {};
  function S_(key, rows, pal) { return spriteCache[key] || (spriteCache[key] = R.sprite(rows, pal, 1)); }
  function mkBarrelFrames() {
    var f, out = [];
    for (f = 0; f < NFR; f++) {
      var rot = f / NFR * Math.PI / 2;
      out.push(grid(8, 8, function (x, y) {
        var dx = x - 3.5, dy = y - 3.5, r = Math.sqrt(dx * dx + dy * dy);
        if (r > 3.9) return '.'; if (r > 2.8) return 'k';
        if (r < 1.1) return 'h';
        var a = Math.atan2(dy, dx) - rot, spoke = Math.abs(Math.sin(a * 2)) < 0.38;
        return spoke ? 's' : 't';
      }));
    }
    return out;
  }
  function barrelSprite(fr, wild) { return S_((wild ? 'bw' : 'bn') + fr, BARREL_FR[fr], wild ? WILD_PAL : BARREL_PAL); }

  /* ------------------------------------------------------------ screens */
  function buildGirders() {
    var G0 = mkG(0, 158, 136, 154, { exit: 'L' }), G1 = mkG(0, 129, 120, 135), G2 = mkG(16, 111, 136, 105), G3 = mkG(0, 81, 120, 87), G4 = mkG(16, 63, 136, 57);
    var GR = mkG(100, 40, 136, 40, { flow: -1 }), GL = mkG(0, 40, 44, 40, { flow: 1 });
    var s = { type: 0, girders: [G0, G1, G2, G3, G4, GR, GL], movers: [], rivets: [], bg: ['#0b1230', '#1d3366'],
      ladders: [mkL(104, G1, G0), mkL(36, G1, G0, true), mkL(28, G2, G1), mkL(96, G2, G1), mkL(20, G3, G2), mkL(100, G3, G2), mkL(32, G4, G3), mkL(116, G4, G3), mkL(34, GL, G4)],
      start: { x: 22, g: G0 }, goal: { x: 9, g: GL }, robot: { x: 120, g: GR, rail: false },
      itemSpec: [{ k: 'hat', g: G1, x: 62 }, { k: 'box', g: G3, x: 62 }, { k: 'umb', g: G4, x: 70 }, { k: 'mallet', g: G1, x: 14 }, { k: 'mallet', g: G3, x: 108 }], bin: true };
    return s;
  }
  function buildConveyors() {
    var F0 = mkG(0, 156, 136, 156, { exit: 'L', flow: -1 });
    var F1 = mkG(0, 132, 136, 132, { flow: 1, belts: [{ x1: 0, x2: 68, dir: 1 }, { x1: 68, x2: 136, dir: -1 }] });
    var F2a = mkG(0, 108, 48, 108, { flow: -1, belts: [{ x1: 0, x2: 48, dir: -1 }] });
    var F2b = mkG(88, 108, 136, 108, { flow: -1, belts: [{ x1: 88, x2: 136, dir: 1 }] });
    var F3 = mkG(0, 84, 136, 84, { flow: 1, belts: [{ x1: 0, x2: 40, dir: 1 }, { x1: 96, x2: 136, dir: -1 }] });
    var F4a = mkG(0, 60, 48, 60, { flow: -1 }), F4b = mkG(88, 60, 136, 60, { flow: -1, belts: [{ x1: 88, x2: 136, dir: -1 }] });
    var GR = mkG(104, 40, 136, 40, { flow: -1 }), GL = mkG(0, 40, 44, 40, { flow: 1 });
    return { type: 1, girders: [F0, F1, F2a, F2b, F3, F4a, F4b, GR, GL], rivets: [], bg: ['#0f1a1c', '#24443f'],
      movers: [{ kind: 'ferry', x: 56, y: 108, w: 16, vx: 14, min: 56, max: 80 }, { kind: 'ferry', x: 80, y: 60, w: 16, vx: -14, min: 56, max: 80 }],
      ladders: [mkL(108, F1, F0), mkL(24, F1, F0), mkL(116, F2b, F1), mkL(36, F3, F2a), mkL(100, F3, F2b), mkL(122, F4b, F3), mkL(22, F4a, F3, true), mkL(30, GL, F4a)],
      start: { x: 14, g: F0 }, goal: { x: 9, g: GL }, robot: { x: 124, g: GR, rail: false },
      itemSpec: [{ k: 'hat', g: F1, x: 56 }, { k: 'box', g: F3, x: 60 }, { k: 'umb', g: F2b, x: 112 }, { k: 'mallet', g: F1, x: 12 }, { k: 'mallet', g: F3, x: 120 }], bin: true };
  }
  function buildLifts() {
    var P0 = mkG(0, 156, 30, 156, { flow: 1 }), P1 = mkG(52, 116, 82, 116, { flow: 1 }), P2 = mkG(104, 92, 136, 92, { flow: -1 }), P3 = mkG(52, 68, 82, 68, { flow: 1 }), P4 = mkG(0, 44, 30, 44, { flow: 1 });
    var movers = [], i;
    for (i = 0; i < 4; i++) {
      movers.push({ kind: 'lift', x: 41, y: 178 - i * 37, w: 16, vy: -15, min: 34, max: 182 });
      movers.push({ kind: 'lift', x: 93, y: 160 - i * 37, w: 16, vy: -15, min: 34, max: 182 });
    }
    return { type: 2, girders: [P0, P1, P2, P3, P4], ladders: [], rivets: [], movers: movers, bg: ['#1a0f33', '#41307a'], lifts: true,
      start: { x: 10, g: P0 }, goal: { x: 9, g: P4 }, robot: { x: 90, y: 30, rail: true, min: 30, max: 126 },
      itemSpec: [{ k: 'hat', g: P1, x: 67 }, { k: 'box', g: P3, x: 67 }, { k: 'umb', g: P2, x: 124 }, { k: 'mallet', g: P3, x: 56 }, { k: 'mallet', g: P2, x: 112 }] };
  }
  function buildRivets() {
    var F0 = mkG(0, 156, 136, 156), F1 = mkG(8, 128, 128, 128), F2 = mkG(8, 100, 128, 100), F3 = mkG(8, 72, 128, 72), F4 = mkG(8, 44, 128, 44);
    var rv = [], gs = [F1, F2, F3, F4];
    gs.forEach(function (g) { rv.push({ g: g, x: 16, got: false }); rv.push({ g: g, x: 120, got: false }); });
    return { type: 3, girders: [F0, F1, F2, F3, F4], movers: [], rivets: rv, bg: ['#2a0f1c', '#5e2a3a'],
      ladders: [mkL(60, F1, F0), mkL(44, F2, F1), mkL(92, F2, F1), mkL(60, F3, F2), mkL(44, F4, F3), mkL(92, F4, F3), mkL(26, F1, F0, true)],
      start: { x: 20, g: F0 }, goal: null, robot: { x: 68, g: F4, rail: false },
      itemSpec: [{ k: 'hat', g: F2, x: 68 }, { k: 'box', g: F3, x: 30 }, { k: 'umb', g: F1, x: 104 }, { k: 'mallet', g: F1, x: 34 }, { k: 'mallet', g: F3, x: 104 }] };
  }
  var BUILD = [buildGirders, buildConveyors, buildLifts, buildRivets];

  /* ------------------------------------------------------------ state */
  var scr, hero, haz, phase, phaseT, bonus, bonusT, bonusStep, stage, tier, clock, robot, items, spawnT, hid, nextLife;
  var clearInfo, collapseT, respawn, stats, bgCache = {};

  function tierOf(st) { return Math.floor((st - 1) / 4); }
  function addScore(n) {
    R.addScore(n);
    if (R.score >= nextLife) { nextLife += 10000; if (R.lives < 5) R.lives++; R.sfx.play('powerup'); R.fx.text(W / 2, 90, '1UP!', C.lime); }
  }

  function makeBg(s) {
    var key = s.bg[0], cv = bgCache[key];
    if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), y, x, i;
    var a = parseInt(s.bg[0].slice(1), 16), b = parseInt(s.bg[1].slice(1), 16);
    for (y = 0; y < H; y += 4) {
      var t = y / H, ch = function (sh) { return Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); };
      g.fillStyle = 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')'; g.fillRect(0, y, W, 4);
    }
    for (i = 0; i < 40; i++) { g.fillStyle = hsh(i, 3, 5) > 50 ? '#ffffff' : '#9ab4ff'; g.globalAlpha = 0.5; g.fillRect(hsh(i, 1, 2) * 1.36 | 0, 14 + hsh(i, 2, 7) * 0.9 | 0, 1, 1); }
    g.globalAlpha = 1;
    // skyline silhouettes
    var bx = 0;
    while (bx < W) {
      var bw = 10 + hsh(bx, 1, 9) % 14, bh = 14 + hsh(bx, 2, 4) % 38;
      g.fillStyle = 'rgba(8,10,28,.75)'; g.fillRect(bx, H - bh, bw, bh);
      for (y = H - bh + 3; y < H - 3; y += 5) for (x = bx + 2; x < bx + bw - 2; x += 4) if (hsh(x, y, 11) > 60) { g.fillStyle = 'rgba(255,220,120,.55)'; g.fillRect(x, y, 2, 2); }
      bx += bw + 1;
    }
    // structural columns
    g.fillStyle = 'rgba(255,255,255,.06)';
    [2, 66, 132].forEach(function (cx) { g.fillRect(cx, 0, 2, H); });
    bgCache[key] = cv;
    return cv;
  }

  function loadScreen() {
    scr = BUILD[(stage - 1) % 4]();
    bakeGirders(scr);
    tier = tierOf(stage);
    R.level = stage;
    items = scr.itemSpec.map(function (sp) { return { k: sp.k, x: sp.x, y: gy(sp.g, sp.x), got: false, bob: U.rand(0, 6) }; });
    scr.movers.forEach(function (m) { m.px = m.x; m.py = m.y; });
    robot = { x: scr.robot.x, y: scr.robot.rail ? 30 : gy(scr.robot.g, scr.robot.x), st: 'idle', t: 1.6, anim: 0, tx: scr.robot.x, vx: 0, falling: 0 };
    collapseT = 0; clearInfo = null;
    bonusStep = Math.max(0.8, 1.5 - 0.06 * ((stage - 1) % 4 + tier * 4));
    resetRun();
    phase = 'intro'; phaseT = 2.0;
    R.sfx.play('start');
  }

  function resetRun() {
    haz = []; hid = 0;
    hero = { x: scr.start.x, y: gy(scr.start.g, scr.start.x), vx: 0, vy: 0, st: 'ground', face: 1, sup: scr.start.g, lad: null, anim: 0, coy: 0, fallY: 0, mallet: 0, swing: 0, combo: 0, jumped: [], spin: 0, moving: false };
    bonus = BONUS0; bonusT = bonusStep; spawnT = 1.8; respawn = [];
    robot.st = 'idle'; robot.t = 1.4; robot.falling = 0;
    scr.movers.forEach(function (m) { if (m.kind === 'ferry') m.x = m.min; });
    if (scr.type === 3) { spawnSparks(); }
  }

  function spawnSparks() {
    var n = Math.min(5, 2 + tier), i, gs = scr.girders.slice(1);
    for (i = 0; i < n; i++) {
      var g = gs[(i * 2 + 1) % gs.length], x = 30 + (i * 37) % 80;
      haz.push({ t: 'spark', x: x, y: gy(g, x) - 4, g: g, dir: i % 2 ? 1 : -1, spd: 20 + tier * 3 + i, st: 'walk', lad: null, cool: 1, anim: U.rand(0, 1), r: 3.2, id: ++hid });
    }
  }

  /* ------------------------------------------------------------ support / physics helpers */
  function findSupport(x, y, tol) {
    var best = null, bd = 999, i, d, g, m;
    for (i = 0; i < scr.girders.length; i++) {
      g = scr.girders[i];
      if (x < g.x1 - 0.01 || x > g.x2 + 0.01) continue;
      d = Math.abs(gy(g, x) - y - g.fall);
      if (d <= tol && d < bd) { bd = d; best = { o: g, y: gy(g, x) + g.fall }; }
    }
    for (i = 0; i < scr.movers.length; i++) {
      m = scr.movers[i];
      if (x < m.x - m.w / 2 - 0.01 || x > m.x + m.w / 2 + 0.01) continue;
      d = m.y - y;                                       // lifts may be a touch below the hero's feet (a short step down is fine)
      if (d >= -tol && d <= tol + 3 && Math.abs(d) < bd) { bd = Math.abs(d); best = { o: m, y: m.y }; }
    }
    return best;
  }
  function findLanding(x, py, ny) {
    var best = null, i, g, m, yy;
    for (i = 0; i < scr.girders.length; i++) {
      g = scr.girders[i];
      if (x < g.x1 - 0.01 || x > g.x2 + 0.01) continue;
      yy = gy(g, x);
      if (py <= yy + 1.2 && ny >= yy - 0.01 && (!best || yy < best.y)) best = { o: g, y: yy };
    }
    for (i = 0; i < scr.movers.length; i++) {
      m = scr.movers[i];
      if (x < m.x - m.w / 2 - 0.01 || x > m.x + m.w / 2 + 0.01) continue;
      if (py - m.py <= 1.2 && ny - m.y >= -0.01 && (!best || m.y < best.y)) best = { o: m, y: m.y };
    }
    return best;
  }
  function beltAt(sup, x) {
    if (!sup || !sup.belts) return 0;
    var i; for (i = 0; i < sup.belts.length; i++) { var b = sup.belts[i]; if (x >= b.x1 && x <= b.x2) return b.dir; }
    return 0;
  }
  function flowDir(g) { return g.y2 > g.y1 + 0.5 ? 1 : g.y2 < g.y1 - 0.5 ? -1 : g.flow; }

  function updMovers(dt) {
    scr.movers.forEach(function (m) {
      m.px = m.x; m.py = m.y; m.wrapped = false;
      if (m.kind === 'ferry') {
        m.x += m.vx * dt;
        if (m.x < m.min) { m.x = m.min; m.vx = -m.vx; } else if (m.x > m.max) { m.x = m.max; m.vx = -m.vx; }
      } else {
        m.y += m.vy * dt;
        if (m.y < m.min) { m.y += m.max - m.min; m.py = m.y; m.wrapped = true; }
      }
    });
    if (hero && hero.st === 'ground' && hero.sup && hero.sup.kind) {
      var m = hero.sup;
      if (m.wrapped) { hero.st = 'air'; hero.vy = 0; hero.coy = 0; hero.fallY = hero.y; hero.sup = null; }
      else { hero.x = U.clamp(hero.x + (m.x - m.px), 4, W - 4); hero.y = m.y; }
    }
  }

  /* ------------------------------------------------------------ hero */
  function die(why) {
    if (hero.st === 'dead' || phase !== 'play') return;
    hero.st = 'dead'; hero.vy = -95; hero.vx = -hero.face * 14; hero.spin = 0; hero.mallet = 0;
    phase = 'dying'; phaseT = 1.5;
    R.lives = Math.max(0, R.lives - 1);
    R.sfx.play('hit'); R.sfx.tone(300, 0.5, { type: 'triangle', slide: 80, vol: 0.14, delay: 0.1 }); R.vibrate(90); R.fx.shake(3, 0.3);
    R.fx.burst(hero.x, hero.y - 6, { n: 16, color: [C.yellow, C.orange, C.white, C.red], speed: 70, life: 0.7, size: 2, gravity: 90 });
    if (why === 'time') R.fx.text(W / 2, 70, 'TIME UP', C.red);
    else if (why === 'splat') R.fx.text(hero.x, hero.y - 16, 'SPLAT', C.red);
  }

  function landHero(land) {
    var fd = land.y - hero.fallY;
    if (fd > MAXFALL) { hero.y = land.y; hero.sup = land.o; die('splat'); return; }
    hero.y = land.y; hero.sup = land.o; hero.st = 'ground'; hero.vy = 0;
    hero.combo = 0;
    if (fd > 3) { R.sfx.play('land'); R.fx.burst(hero.x, hero.y, { n: 4, color: ['#c2c3c7', '#ffffff'], speed: 25, life: 0.25, size: 1 }); }
  }

  function startJump() {
    hero.st = 'air'; hero.vy = -JUMP_V; hero.vx = R.input.axisX() * SPD; hero.coy = 0; hero.fallY = hero.y; hero.sup = null; hero.combo = 0; hero.jumped = [];
    R.sfx.play('jump');
  }

  function updHero(dt) {
    var dx = R.input.axisX(), dy = R.input.axisY(), i, l;
    if (hero.mallet > 0) { hero.mallet -= dt; hero.swing += dt; if (hero.mallet <= 0) { hero.mallet = 0; R.sfx.tone(200, 0.15, { vol: 0.08, type: 'triangle' }); } }
    hero.anim += dt;
    hero.moving = false;
    if (hero.st === 'ground') {
      if (dx) hero.face = dx;
      var belt = beltAt(hero.sup, hero.x) * BELT, nx = U.clamp(hero.x + (dx * SPD + belt) * dt, 4, W - 4);
      if (dx) hero.moving = true;
      var s = findSupport(nx, hero.y, 5);
      if (s) { hero.x = nx; hero.y = s.y; hero.sup = s.o; }
      else { hero.x = nx; hero.st = 'air'; hero.vy = 0; hero.vx = dx * SPD + belt; hero.coy = 0.14; hero.fallY = hero.y; hero.sup = null; }
      if (hero.st === 'ground') {
        if ((R.input.pressed('a') || R.input.pressed('b')) && hero.mallet <= 0) startJump();
        else if (dy && hero.mallet <= 0) {
          for (i = 0; i < scr.ladders.length; i++) {
            l = scr.ladders[i];
            if (l.broken || Math.abs(hero.x - l.x) > 4) continue;
            if ((dy < 0 && Math.abs(hero.y - l.y2 - (l.low.fall || 0)) <= 3.5) || (dy > 0 && Math.abs(hero.y - l.y1 - (l.up.fall || 0)) <= 3.5)) {
              hero.st = 'ladder'; hero.lad = l; hero.x = l.x; hero.y = dy < 0 ? l.y2 : l.y1; hero.sup = null; R.sfx.play('tick'); break;
            }
          }
        }
      }
    } else if (hero.st === 'ladder') {
      l = hero.lad; hero.face = 1;
      if (dy) { hero.y += dy * CLIMB * dt; hero.moving = true; }
      if (hero.y <= l.y1) { hero.y = l.y1; if (dy < 0) { hero.st = 'ground'; hero.sup = l.up; hero.y = gy(l.up, hero.x); hero.lad = null; } }
      else if (hero.y >= l.y2) { hero.y = l.y2; if (dy > 0) { hero.st = 'ground'; hero.sup = l.low; hero.y = gy(l.low, hero.x); hero.lad = null; } }
    } else if (hero.st === 'air') {
      hero.vx += (dx * SPD - hero.vx) * Math.min(1, 3.5 * dt);
      if (hero.vx) hero.face = hero.vx > 0 ? 1 : -1;
      if (hero.coy > 0) {
        hero.coy -= dt;
        if (R.input.pressed('a') || R.input.pressed('b')) { startJump(); hero.vx = hero.vx || dx * SPD; return; }
      } else hero.vy += GRAV * dt;
      var py = hero.y;
      hero.x = U.clamp(hero.x + hero.vx * dt, 4, W - 4); hero.y += hero.vy * dt;
      if (hero.coy > 0) {                                   // stepping across a small gap: re-attach to a ledge or lift at about the same height
        var ss = findSupport(hero.x, hero.y, 5);
        if (ss) { hero.st = 'ground'; hero.sup = ss.o; hero.y = ss.y; hero.vy = 0; return; }
      }
      if (hero.vy >= 0 || hero.coy > 0) { var land = findLanding(hero.x, py, hero.y); if (land) landHero(land); }
      if (hero.st === 'air' && hero.y > H + 14) die('fell');
    }
  }

  function hitRect(h) {
    var x0 = hero.x - 3, y0 = hero.y - 11, nx = U.clamp(h.x, x0, x0 + 6), ny = U.clamp(h.y, y0, y0 + 11), dx = h.x - nx, dy = h.y - ny;
    return dx * dx + dy * dy < h.r * h.r;
  }

  /* ------------------------------------------------------------ hazards */
  function throwHazard() {
    var tt = scr.type, rx = robot.x, b;
    if (tt === 2) {
      haz.push({ t: 'ball', x: rx, y: robot.y + 4, vx: U.rand(-14, 14), vy: 10, r: 3.4, bounces: 0, id: ++hid });
      R.sfx.tone(520, 0.1, { vol: 0.08, slide: 260 });
      return;
    }
    var wild = tier >= 1 && Math.random() < 0.25 + 0.1 * Math.min(tier, 4);
    b = { t: 'barrel', x: rx - 14, y: robot.y - 8, r: 3.5, g: null, st: 'fall', dir: -1, vy: 0, rot: 0, spd: Math.min(62, 33 + tier * 4 + (scr.type === 1 ? 2 : 0)) * (wild ? 1.28 : 1), wild: wild, lad: null, last: null, id: ++hid };
    haz.push(b);
    if (tier >= 2 && Math.random() < 0.3) haz.push({ t: 'barrel', x: rx - 14, y: robot.y - 22, r: 3.5, g: null, st: 'fall', dir: -1, vy: -20, rot: 0, spd: b.spd * 0.9, wild: false, lad: null, last: null, id: ++hid });
    R.sfx.tone(190, 0.12, { vol: 0.09, type: 'triangle', slide: 120 });
  }

  function updRobot(dt) {
    var r = scr.robot;
    robot.anim += dt;
    if (robot.falling) return;
    if (r.rail) {
      var dir = robot.tx - robot.x;
      robot.x += U.clamp(dir, -44 * dt, 44 * dt);
    }
    if (phase !== 'play') return;
    robot.t -= dt;
    if (robot.st === 'idle') {
      if (robot.t <= 0) {
        robot.st = 'grab'; robot.t = 0.65;
        if (r.rail) robot.tx = U.clamp(hero.x + U.rand(-16, 16), r.min, r.max);
        R.sfx.tone(260, 0.2, { vol: 0.06, type: 'sawtooth', slide: 380 });
      }
    } else if (robot.st === 'grab') {
      if (robot.t <= 0) { robot.st = 'throw'; robot.t = 0.25; throwHazard(); }
    } else if (robot.t <= 0) {
      robot.st = 'idle'; robot.t = Math.max(1.0, 2.3 - 0.2 * tier - 0.03 * (stage % 4)) * U.rand(0.8, 1.2);
    }
  }

  function barrelLand(b, g) {
    b.g = g; b.st = 'roll'; b.y = gy(g, b.x) - b.r; b.vy = 0; b.dir = flowDir(g); b.last = null;
  }

  function updHazards(dt) {
    var i, j, b, g;
    for (i = haz.length - 1; i >= 0; i--) {
      b = haz[i];
      if (b.t === 'barrel') {
        if (b.st === 'roll') {
          g = b.g;
          var belt = beltAt(g, b.x) * BELT;
          var step = (b.dir * b.spd + belt) * dt;
          b.x += step; b.rot += step / b.r;
          b.y = gy(g, b.x) + g.fall - b.r;
          if (!g.fall) for (j = 0; j < scr.ladders.length; j++) {
            var l = scr.ladders[j];
            if (l.broken || l.up !== g || l === b.last) continue;
            if (Math.abs(b.x - l.x) <= Math.abs(step) + 0.6) {
              b.last = l;
              if (Math.random() < Math.min(0.55, 0.16 + 0.07 * tier + (b.wild ? 0.2 : 0))) { b.st = 'ladder'; b.lad = l; b.x = l.x; break; }
            }
          }
          if (b.st === 'roll' && (b.x < g.x1 - 1 || b.x > g.x2 + 1)) {
            if (g.exit && ((g.exit === 'L' && b.x < 0) || (g.exit === 'R' && b.x > W))) { R.fx.burst(Math.max(2, Math.min(W - 2, b.x)), b.y, { n: 6, color: ['#ff7a2a', '#ffec27'], speed: 40, life: 0.35, size: 2 }); haz.splice(i, 1); continue; }
            b.st = 'fall'; b.vy = 0; b.x = U.clamp(b.x, 4, W - 4); b.last = null;
          }
        } else if (b.st === 'ladder') {
          b.y += 30 * dt; b.rot += 0.4;
          if (b.y + b.r >= b.lad.y2) { b.x = b.lad.x; barrelLand(b, b.lad.low); }
        } else {
          b.vy += GRAV * 0.8 * dt; var py = b.y; b.y += b.vy * dt; b.rot += 0.2;
          var land = null, k;
          for (k = 0; k < scr.girders.length; k++) {
            g = scr.girders[k];
            if (b.x < g.x1 - 0.01 || b.x > g.x2 + 0.01) continue;
            var yy = gy(g, b.x) + g.fall;
            if (py + b.r <= yy + 1.5 && b.y + b.r >= yy - 0.01 && (!land || yy < land.y)) land = { g: g, y: yy };
          }
          if (land && b.vy >= 0) barrelLand(b, land.g);
          else if (b.y > H + 12) { haz.splice(i, 1); continue; }
        }
      } else if (b.t === 'ball') {
        b.vy += GRAV * dt; var pby = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
        var hit = findLanding(b.x, pby + b.r, b.y + b.r);
        if (hit && b.vy > 0) { b.y = hit.y - b.r; b.vy = -(105 - b.bounces * 6); b.bounces++; R.sfx.tone(180, 0.04, { vol: 0.05, type: 'triangle' }); if (b.vx === 0) b.vx = U.rand(-10, 10); }
        if (b.y > H + 12 || b.x < -8 || b.x > W + 8 || b.bounces > 9) { haz.splice(i, 1); continue; }
      } else if (b.t === 'spark') {
        updSpark(b, dt);
      }
    }
  }

  function updSpark(b, dt) {
    var g = b.g, i, l;
    b.anim += dt; b.cool -= dt;
    if (b.st === 'walk') {
      b.x += b.dir * b.spd * dt;
      if (b.x < g.x1 + 4) { b.x = g.x1 + 4; b.dir = 1; } else if (b.x > g.x2 - 4) { b.x = g.x2 - 4; b.dir = -1; }
      b.y = gy(g, b.x) - 4;
      if (b.cool <= 0) {
        for (i = 0; i < scr.ladders.length; i++) {
          l = scr.ladders[i];
          if (l.broken || (l.up !== g && l.low !== g) || Math.abs(b.x - l.x) > 1.2) continue;
          var up = l.low === g, heroAbove = hero.y < g.y1 - 6, want = up ? heroAbove : !heroAbove;
          if (Math.random() < (want ? 0.6 : 0.12)) { b.st = 'ladder'; b.lad = l; b.up = up; b.x = l.x; b.cool = 1.2; break; }
          b.cool = 0.5;
        }
      }
    } else {
      l = b.lad;
      b.y += (b.up ? -1 : 1) * 24 * dt;
      if (b.up && b.y + 4 <= l.y1) { b.st = 'walk'; b.g = l.up; b.y = gy(l.up, b.x) - 4; b.dir = Math.random() < 0.5 ? -1 : 1; }
      else if (!b.up && b.y + 4 >= l.y2) { b.st = 'walk'; b.g = l.low; b.y = gy(l.low, b.x) - 4; b.dir = Math.random() < 0.5 ? -1 : 1; }
    }
  }

  function checkHazards() {
    var i, h, hx0, hy0, mh;
    if (hero.mallet > 0) { mh = { x: hero.face > 0 ? hero.x + 1 : hero.x - 12, y: hero.y - 14, w: 11, h: 15 }; }
    for (i = haz.length - 1; i >= 0; i--) {
      h = haz[i];
      if (mh && h.x + h.r > mh.x && h.x - h.r < mh.x + mh.w && h.y + h.r > mh.y && h.y - h.r < mh.y + mh.h) { smash(h); haz.splice(i, 1); continue; }
      if (hero.st !== 'dead' && hitRect(h)) { die(); return; }
      // jumping over
      var sameLevel = h.t === 'ball' || (h.st === 'roll' && Math.abs(hero.fallY - (h.y + h.r)) < 7);
      if (hero.st === 'air' && !h.jumped && h.t !== 'spark' && sameLevel && hero.y < h.y - h.r + 1 && hero.y > h.y - 26 && Math.abs(hero.x - h.x) < 5) {
        h.jumped = true; hero.combo++;
        var pts = hero.combo === 1 ? 100 : hero.combo === 2 ? 300 : 500;
        addScore(pts); R.fx.text(hero.x, hero.y - 16, '+' + pts, hero.combo > 1 ? C.pink : C.yellow); R.sfx.play('coin');
        stats.jumps++; if (stats.jumps >= 10) R.achieve('leaper');
      }
    }
  }
  function smash(h) {
    R.sfx.play('explode'); R.vibrate(25); R.fx.shake(1.5, 0.12);
    R.fx.burst(h.x, h.y, { n: 12, color: [C.orange, C.yellow, C.white, C.red], speed: 70, life: 0.45, size: 2, gravity: 60 });
    addScore(300); R.fx.text(h.x, h.y - 10, '+300', C.pink);
    stats.smashed++; if (stats.smashed >= 5) R.achieve('mallet-man');
    if (h.t === 'spark') respawn.push(5);
  }

  /* ------------------------------------------------------------ items, goal, rivets */
  function checkPickups() {
    var i, it, hx = hero.x, hy = hero.y - 6;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (it.got) continue;
      if (Math.abs(hx - it.x) < 7 && Math.abs(hy - (it.y - 4)) < 9) {
        it.got = true;
        if (it.k === 'mallet') { hero.mallet = MALLET_T; hero.swing = 0; R.sfx.play('powerup'); R.fx.text(it.x, it.y - 14, 'MALLET!', C.cyan); }
        else {
          var pts = it.k === 'hat' ? 300 : it.k === 'box' ? 500 : 800;
          addScore(pts); R.sfx.play('coin'); R.vibrate(10); R.fx.text(it.x, it.y - 14, '+' + pts, C.yellow);
          R.fx.burst(it.x, it.y - 4, { n: 8, color: [C.yellow, C.white], speed: 40, life: 0.4, size: 1 });
        }
      }
    }
    // rivets
    var left = 0;
    for (i = 0; i < scr.rivets.length; i++) {
      var rv = scr.rivets[i];
      if (rv.got) continue;
      left++;
      if (hero.st === 'ground' && hero.sup === rv.g && Math.abs(hero.x - rv.x) < 4) {
        rv.got = true; left--;
        addScore(100); R.sfx.play('coin'); R.vibrate(12); R.fx.text(rv.x, rv.g.y1 - 14, '+100', C.yellow);
        R.fx.burst(rv.x, rv.g.y1 - 2, { n: 8, color: [C.yellow, C.orange, C.white], speed: 45, life: 0.4, size: 1, gravity: 40 });
      }
    }
    if (scr.type === 3 && left === 0 && phase === 'play') startCollapse();
    // goal
    if (scr.goal && hero.st === 'ground' && hero.sup === scr.goal.g && Math.abs(hero.x - scr.goal.x) < 6) startClear();
  }

  function startCollapse() {
    phase = 'collapse'; phaseT = 2.6; collapseT = 0;
    haz.forEach(function (h) { R.fx.burst(h.x, h.y, { n: 8, color: [C.orange, C.yellow], speed: 50, life: 0.4, size: 2 }); });
    haz = []; hero.mallet = 0;
    R.sfx.play('explode'); R.fx.shake(4, 1.0); R.fx.flash(C.white, 0.25); R.vibrate(80);
    robot.falling = 0.01;
  }

  function startClear() {
    if (phase !== 'play' && phase !== 'collapse') return;
    var bonusPts = bonus;
    phase = 'clear'; phaseT = 2.8; haz = [];
    clearInfo = { bonus: bonusPts, shown: 0, name: NAMES[scr.type], tick: 0 };
    R.sfx.play('win'); R.vibrate(50);
    R.fx.flash(C.yellow, 0.2);
    var i; for (i = 0; i < 5; i++) R.fx.burst(U.rand(20, 116), U.rand(30, 120), { n: 12, color: [C.yellow, C.pink, C.cyan, C.lime, C.white], speed: 80, life: 1, size: 2, gravity: 50 });
    if (scr.type === 0) R.achieve('top-climber');
    if (scr.type === 3) R.achieve('tower-down');
  }

  /* ------------------------------------------------------------ update */
  function updRespawn(dt) {
    var i;
    for (i = respawn.length - 1; i >= 0; i--) {
      respawn[i] -= dt;
      if (respawn[i] <= 0) {
        respawn.splice(i, 1);
        var g = scr.girders[4];
        haz.push({ t: 'spark', x: 68, y: gy(g, 68) - 4, g: g, dir: Math.random() < 0.5 ? -1 : 1, spd: 20 + tier * 3, st: 'walk', lad: null, cool: 1.5, anim: 0, r: 3.2, id: ++hid });
        R.fx.burst(68, gy(g, 68) - 4, { n: 8, color: [C.orange, C.yellow], speed: 40, life: 0.3, size: 1 });
      }
    }
  }

  R.game({
    layout: 'full', size: [W, H], bg: '#0b1230', music: 'retro',

    init: function () {
      BARREL_FR = mkBarrelFrames();
      Object.keys(HERO).forEach(function (k) { checkRows('hero ' + k, HERO[k], 8, 12); });
      checkRows('robot', mirror(ROBOT_HALF), 14, 16);
      Object.keys(ITEM).forEach(function (k) { checkRows('item ' + k, ITEM[k], 8, ITEM[k].length); });
      checkRows('mallet', MALLET_PICK, 8, 8); checkRows('ball', BALL_ROWS, 8, 8);
      SPARK_FR.forEach(function (r, i) { checkRows('spark' + i, r, 8, 8); });
    },

    reset: function () {
      stage = 1; clock = 0; nextLife = 10000; stats = { jumps: 0, smashed: 0 };
      R.lives = 3; R.level = 1;
      loadScreen();
    },

    update: function (dt) {
      clock += dt;
      var i;
      if (phase === 'intro') {
        phaseT -= dt; updMovers(dt); robot.anim += dt; hero.anim += dt;
        if (phaseT <= 0) { phase = 'play'; R.sfx.play('select'); }
        return;
      }
      if (phase === 'play') {
        bonusT -= dt;
        if (bonusT <= 0) { bonusT += bonusStep; bonus = Math.max(0, bonus - 100); if (bonus <= 1000 && bonus % 500 === 0 && bonus > 0) R.sfx.tone(900, 0.06, { vol: 0.07 }); }
        updMovers(dt);
        updHero(dt);
        if (scr.type !== 3) updRobot(dt); else robot.anim += dt;
        updHazards(dt);
        if (phase === 'play') checkHazards();
        if (phase === 'play') checkPickups();
        if (phase === 'play') updRespawn(dt);
        if (phase === 'play' && bonus <= 0) die('time');
        return;
      }
      if (phase === 'dying') {
        phaseT -= dt; hero.vy += GRAV * dt; hero.y += hero.vy * dt; hero.x = U.clamp(hero.x + hero.vx * dt, 4, W - 4); hero.spin += dt * 14;
        updMovers(dt); robot.anim += dt;
        if (phaseT <= 0) {
          if (R.lives <= 0) { R.gameOver(); phaseT = 99; }
          else { resetRun(); phase = 'intro'; phaseT = 1.1; }
        }
        return;
      }
      if (phase === 'collapse') {
        phaseT -= dt; collapseT += dt; robot.anim += dt;
        scr.girders.forEach(function (g, i) { if (i > 0 && collapseT > 0.5 + i * 0.12) { g.vy += 220 * dt; g.fall += g.vy * dt; } });
        if (hero.sup && hero.sup.fall !== undefined && hero.sup !== scr.girders[0]) hero.y = gy(hero.sup, hero.x) + hero.sup.fall;
        if (robot.falling) { robot.falling += dt; }
        if (Math.random() < dt * 20) R.fx.burst(U.rand(10, 126), U.rand(30, 150), { n: 4, color: [C.orange, C.yellow, '#ffffff'], speed: 60, life: 0.5, size: 2, gravity: 80 });
        hero.anim += dt;
        if (phaseT <= 0) { hero.x = 68; hero.sup = scr.girders[0]; hero.y = gy(scr.girders[0], 68); hero.st = 'ground'; startClear(); }
        return;
      }
      if (phase === 'clear') {
        phaseT -= dt; robot.anim += dt; hero.anim += dt; updMovers(dt);
        if (clearInfo.shown < clearInfo.bonus) {
          var inc = Math.min(clearInfo.bonus - clearInfo.shown, Math.ceil(clearInfo.bonus * dt / 1.0 / 100) * 100);
          clearInfo.shown += inc; addScore(inc);
          clearInfo.tick -= dt; if (clearInfo.tick <= 0) { clearInfo.tick = 0.06; R.sfx.tone(1300, 0.03, { vol: 0.05 }); }
        }
        if (phaseT <= 0) { stage++; loadScreen(); }
      }
    },

    /* ------------------------------------------------------------ render */
    render: function (ctx, w, h) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(makeBg(scr), 0, 0);
      drawGirders(ctx);
      drawLadders(ctx);
      drawGoal(ctx);
      drawItems(ctx);
      drawMovers(ctx);
      drawRobot(ctx);
      drawHazards(ctx);
      drawHero(ctx);
      drawHud(ctx);
      if (phase === 'intro' && R.mode === 'play') {
        ctx.fillStyle = 'rgba(5,8,20,.72)'; ctx.fillRect(14, 62, 108, 40); D.frame(ctx, 14, 62, 108, 40, '#ff7a2a', 1);
        D.text(ctx, 'STAGE ' + stage, W / 2, 68, { size: 8, color: C.yellow, align: 'center', shadow: '#000' });
        D.text(ctx, NAMES[scr.type], W / 2, 80, { size: 8, color: C.white, align: 'center', shadow: '#000' });
        D.text(ctx, HINTS[scr.type], W / 2, 92, { size: 6, color: C.cyan, align: 'center' });
      }
      if (phase === 'clear' && clearInfo) {
        ctx.fillStyle = 'rgba(5,8,20,.78)'; ctx.fillRect(10, 58, 116, 48); D.frame(ctx, 10, 58, 116, 48, C.yellow, 1);
        D.text(ctx, scr.type === 3 ? 'TOWER DOWN!' : 'STAGE CLEAR', W / 2, 64, { size: 8, color: C.yellow, align: 'center', shadow: '#000' });
        D.text(ctx, 'BONUS ' + clearInfo.bonus, W / 2, 80, { size: 8, color: C.lime, align: 'center' });
        D.text(ctx, 'NEXT: ' + NAMES[stage % 4], W / 2, 94, { size: 6, color: '#9fb2d0', align: 'center' });
      }
    }
  });

  /* ------------------------------------------------------------ drawing */
  function drawGirderBody(ctx, g, shake) {
    var x, y;
    for (x = Math.ceil(g.x1); x < g.x2; x++) {
      y = Math.round(gy(g, x + 0.5) + g.fall) + shake;
      ctx.fillStyle = '#ff9a5a'; ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = '#e8551f'; ctx.fillRect(x, y + 1, 1, 2);
      ctx.fillStyle = '#7a2a12'; ctx.fillRect(x, y + 3, 1, 1);
      if ((x - Math.ceil(g.x1)) % 8 === 4) { ctx.fillStyle = '#ffd9b0'; ctx.fillRect(x, y + 1, 1, 1); }
    }
    ctx.fillStyle = 'rgba(180,70,30,.45)';                       // truss under the girder
    for (x = Math.ceil(g.x1) + 4; x < g.x2 - 4; x += 8) {
      y = Math.round(gy(g, x) + g.fall) + shake;
      ctx.fillRect(x - 3, y + 4, 1, 1); ctx.fillRect(x - 2, y + 5, 1, 1); ctx.fillRect(x - 1, y + 6, 1, 1); ctx.fillRect(x, y + 5, 1, 1); ctx.fillRect(x + 1, y + 4, 1, 1);
    }
  }
  function bakeGirders(s) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    s.girders.forEach(function (g) { drawGirderBody(c, g, 0); });
    s.cache = cv;
  }

  function drawGirders(ctx) {
    var i, x, y, g, j, b, falling = scr.type === 3 && (phase === 'collapse' || phase === 'clear');
    if (!falling && scr.cache) ctx.drawImage(scr.cache, 0, 0);
    for (i = 0; i < scr.girders.length; i++) {
      g = scr.girders[i];
      if (falling) drawGirderBody(ctx, g, phase === 'collapse' && collapseT < 0.5 + i * 0.12 ? Math.round(Math.sin(clock * 60 + i) * 1.2) : 0);
      for (j = 0; j < g.belts.length; j++) {
        b = g.belts[j];
        for (x = b.x1; x < b.x2; x++) {
          y = Math.round(gy(g, x) + g.fall);
          var ph = ((x - clock * b.dir * 14) % 6 + 6) % 6;
          ctx.fillStyle = ph < 3 ? '#ffd23a' : '#5a4a10'; ctx.fillRect(x, y - 1, 1, 1);
          ctx.fillStyle = '#2a2a38'; ctx.fillRect(x, y, 1, 2);
        }
        // arrows on belts
        ctx.fillStyle = '#ffffff';
        for (x = b.x1 + 6; x < b.x2 - 4; x += 18) {
          y = Math.round(gy(g, x) + g.fall);
          var ax = x + Math.round(Math.sin(clock * 3) * 0);
          if (b.dir > 0) { ctx.fillRect(ax, y - 4, 1, 3); ctx.fillRect(ax + 1, y - 3, 1, 1); } else { ctx.fillRect(ax + 1, y - 4, 1, 3); ctx.fillRect(ax, y - 3, 1, 1); }
        }
      }
      // exit bin
      if (g.exit === 'L' && scr.bin) {
        y = Math.round(gy(g, 0));
        ctx.fillStyle = '#5f574f'; ctx.fillRect(0, y - 8, 9, 8); ctx.fillStyle = '#8a92b8'; ctx.fillRect(0, y - 8, 9, 1); ctx.fillStyle = '#ff7a2a'; ctx.fillRect(1, y - 11 - (Math.floor(clock * 8) % 2), 2, 3); ctx.fillRect(4, y - 12 + (Math.floor(clock * 8) % 2), 3, 4); ctx.fillStyle = '#ffec27'; ctx.fillRect(2, y - 9, 1, 1); ctx.fillRect(5, y - 10, 1, 2);
      }
    }
    // rivets
    for (i = 0; i < scr.rivets.length; i++) {
      var rv = scr.rivets[i]; if (rv.got) continue;
      var ry = Math.round(rv.g.y1 + rv.g.fall) - 2;
      ctx.fillStyle = '#7a5a10'; ctx.fillRect(rv.x - 2, ry - 1, 5, 4); ctx.fillStyle = Math.floor(clock * 4) % 2 ? '#ffec27' : '#ffffff'; ctx.fillRect(rv.x - 1, ry - 2, 3, 3);
    }
  }

  function drawLadders(ctx) {
    if (scr.type === 3 && (phase === 'collapse' || phase === 'clear')) return;
    scr.ladders.forEach(function (l) {
      var y, top = Math.round(l.y1) + 3, bot = Math.round(l.y2);
      if (l.broken) top = Math.round((l.y1 + l.y2) / 2);
      ctx.fillStyle = '#9fe8ff'; ctx.fillRect(l.x - 3, top, 1, bot - top); ctx.fillRect(l.x + 3, top, 1, bot - top);
      ctx.fillStyle = '#3da8e8';
      for (y = bot - 3; y > top; y -= 4) ctx.fillRect(l.x - 2, y, 5, 1);
    });
  }

  function drawGoal(ctx) {
    if (!scr.goal) return;
    var g = scr.goal, y = Math.round(gy(g.g, g.x)), blink = Math.floor(clock * 4) % 2;
    ctx.fillStyle = '#c2c3c7'; ctx.fillRect(g.x, y - 17, 1, 17);
    ctx.fillStyle = blink ? '#00e436' : '#ffec27'; ctx.fillRect(g.x + 1, y - 17, 7, 3); ctx.fillRect(g.x + 1, y - 14, 5, 2); ctx.fillRect(g.x + 1, y - 12, 3, 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(g.x + 2, y - 17, 1, 1);
    if (phase === 'play' && Math.floor(clock * 3) % 2) D.text(ctx, 'GOAL', g.x + 12, y - 15, { size: 6, color: C.lime, shadow: '#000' });
  }

  function drawItems(ctx) {
    items.forEach(function (it) {
      if (it.got) return;
      var by = Math.round(it.y - 1 + Math.sin(clock * 5 + it.bob) * 0.9);
      if (it.k === 'mallet') ctx.drawImage(S_('mal', MALLET_PICK, MALLET_PAL), Math.round(it.x - 4), by - 9);
      else { var rows = ITEM[it.k]; ctx.drawImage(S_('it' + it.k, rows, ITEM_PAL[it.k]), Math.round(it.x - 4), by - rows.length); }
      if (Math.floor(clock * 3 + it.bob) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(it.x + 3), by - 9, 1, 1); }
    });
  }

  function drawMovers(ctx) {
    scr.movers.forEach(function (m) {
      var x = Math.round(m.x - m.w / 2), y = Math.round(m.y);
      var lift = m.kind === 'lift';
      ctx.fillStyle = lift ? '#c8b0ff' : '#8fe8d0'; ctx.fillRect(x, y, m.w, 1);
      ctx.fillStyle = lift ? '#8a5ae0' : '#2fb89a'; ctx.fillRect(x, y + 1, m.w, 2);
      ctx.fillStyle = lift ? '#3a1f80' : '#14604f'; ctx.fillRect(x, y + 3, m.w, 1);
      ctx.fillStyle = '#ffffff';
      if (lift) { ctx.fillRect(x + 7, y + 1, 2, 1); ctx.fillRect(x + 6, y + 2, 4, 1); } else { ctx.fillRect(x + 4, y + 2, 2, 1); ctx.fillRect(x + 10, y + 2, 2, 1); }
    });
    if (scr.lifts) {
      ctx.fillStyle = 'rgba(200,176,255,.16)'; ctx.fillRect(33, 20, 1, 140); ctx.fillRect(49, 20, 1, 140); ctx.fillRect(85, 20, 1, 140); ctx.fillRect(101, 20, 1, 140);
    }
  }

  function drawRobot(ctx) {
    var r = robot, x = Math.round(r.x), y = Math.round(r.y), rows = mirror(ROBOT_HALF), spr = S_('robot', rows, ROBOT_PAL);
    var shake = (r.st === 'grab' ? Math.round(Math.sin(clock * 50)) : 0);
    var fall = 0;
    if (r.falling) { fall = r.falling * r.falling * 120; if (y + fall > H + 20) fall = H + 20 - y; }
    var bob = r.st === 'idle' && Math.floor(r.anim * 3) % 2 ? 1 : 0;
    ctx.save();
    ctx.translate(x + shake, y + fall - bob);
    if (r.falling) ctx.rotate(r.falling * 3);
    ctx.drawImage(spr, -7, -16);
    // arms
    ctx.fillStyle = '#6d7ba0';
    if (r.st === 'grab' || r.st === 'throw') {
      ctx.fillRect(-9, -12, 2, 6); ctx.fillRect(7, -12, 2, 6);
      if (r.st === 'grab') { ctx.drawImage(scr.type === 2 ? S_('ball', BALL_ROWS, BALL_PAL) : barrelSprite(0, false), -4, -28); ctx.fillRect(-9, -22, 2, 10); ctx.fillRect(7, -22, 2, 10); }
      else { ctx.fillRect(-12, -10, 4, 2); ctx.fillRect(-12, -12, 2, 4); }
    } else {
      var wave = Math.floor(r.anim * 4) % 2;
      ctx.fillRect(-9, -11, 2, 7); ctx.fillRect(7, wave ? -12 : -11, 2, wave ? 8 : 7);
    }
    ctx.restore();
    if (!r.falling && (r.st === 'grab') && Math.floor(clock * 10) % 2) D.text(ctx, '!', x + 10, y - 24, { size: 8, color: C.red, shadow: '#000' });
  }

  function drawHazards(ctx) {
    haz.forEach(function (b) {
      var x = Math.round(b.x), y = Math.round(b.y);
      if (b.t === 'barrel') {
        var fr = Math.floor(((b.rot % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2) / (Math.PI / 2) * NFR) % NFR;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; if (b.st === 'roll') ctx.fillRect(x - 3, y + 3, 7, 1);
        ctx.drawImage(barrelSprite(fr, b.wild), x - 4, y - 4);
      } else if (b.t === 'ball') {
        ctx.drawImage(S_('ball', BALL_ROWS, BALL_PAL), x - 4, y - 4);
      } else {
        var fr2 = Math.floor(b.anim * 8) % 2;
        ctx.drawImage(S_('sp' + fr2, SPARK_FR[fr2], SPARK_PAL), x - 4, y - 4);
      }
    });
  }

  function drawHero(ctx) {
    var x = Math.round(hero.x), y = Math.round(hero.y), key, spr;
    if (hero.st === 'dead') {
      ctx.save(); ctx.translate(x, y - 6); ctx.rotate(hero.spin); ctx.drawImage(S_('hfront', HERO.front, HP), -4, -6); ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,.25)'; if (hero.st === 'ground') ctx.fillRect(x - 3, y, 6, 1);
    if (hero.st === 'ladder') key = 'front';
    else if (hero.st === 'air') key = 'jump';
    else key = hero.moving && Math.floor(hero.anim * 8) % 2 ? 'walkB' : 'walkA';
    spr = S_('h' + key, HERO[key], HP);
    var flip = hero.face < 0 && hero.st !== 'ladder';
    if (phase === 'clear') { spr = S_('hfront', HERO.front, HP); flip = false; if (Math.floor(clock * 6) % 2) y -= 2; }
    if (flip) { ctx.save(); ctx.translate(x + 4, y - 12); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0); ctx.restore(); }
    else ctx.drawImage(spr, x - 4, y - 12);
    if (hero.st === 'ladder') {
      var a = Math.floor(hero.y / 4) % 2;
      ctx.fillStyle = '#ffccaa'; ctx.fillRect(x - 5, y - (a ? 9 : 6), 2, 2); ctx.fillRect(x + 3, y - (a ? 6 : 9), 2, 2);
    }
    if (hero.mallet > 0) {
      var up = Math.floor(hero.swing * 7) % 2, f = hero.face;
      var hx = f > 0 ? x + 3 : x - 4;
      if (hero.mallet < 1.5 && Math.floor(hero.mallet * 10) % 2) return;
      ctx.fillStyle = '#a05a20';
      if (up) { ctx.fillRect(hx + (f > 0 ? 0 : 0), y - 15, 2, 9); ctx.fillStyle = '#8a92b8'; ctx.fillRect(hx + (f > 0 ? -2 : -3), y - 19, 8, 5); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(hx + (f > 0 ? -2 : -3), y - 19, 8, 1); }
      else { ctx.fillRect(f > 0 ? hx : hx - 6, y - 8, 8, 2); ctx.fillStyle = '#8a92b8'; ctx.fillRect(f > 0 ? hx + 6 : hx - 12, y - 11, 5, 8); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(f > 0 ? hx + 6 : hx - 12, y - 11, 5, 1); }
    }
  }

  function drawHud(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, 13);
    D.text(ctx, 'SC ' + U.pad(R.score, 5), 3, 4, { size: 6, color: C.yellow });
    var low = bonus <= 1000;
    D.text(ctx, 'B ' + U.pad(bonus, 4), 56, 4, { size: 6, color: low && Math.floor(clock * 4) % 2 ? C.red : C.cyan });
    var i;
    ctx.drawImage(S_('hheart', ['.xx.xx.', 'xhxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'], { x: '#ff3a4d', h: '#ffc0c8' }), 96, 3);
    D.text(ctx, 'x' + R.lives, 105, 4, { size: 6, color: C.pink });
    D.text(ctx, 'L' + stage, W - 3, 4, { size: 6, color: C.white, align: 'right' });
    if (hero.mallet > 0) {
      ctx.drawImage(S_('mal', MALLET_PICK, MALLET_PAL), 3, 15);
      ctx.fillStyle = '#2a3558'; ctx.fillRect(13, 18, 30, 3); ctx.fillStyle = C.cyan; ctx.fillRect(13, 18, Math.round(30 * hero.mallet / MALLET_T), 3);
    }
  }
})();
