/* Jump Hero — a small side-scrolling platformer, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164, T = 8, TOP = 12;                      // view, tile size, HUD band height
  var HW = 3, HH = 11;                                         // hero hit-box half width / height (feet at hero.y)
  var WALK_V = 60, RUN_V = 92, ACC_G = 520, ACC_A = 300, FRIC_G = 620, FRIC_A = 90;
  var JUMP_V = 232, GRAV_UP = 760, GRAV_CUT = 2100, GRAV_DN = 1150, MAX_FALL = 270;
  var COYOTE = 0.1, JBUF = 0.11, INVULN = 1.7;

  /* ------------------------------------------------------------------ levels */
  /* legend:  # ground   = platform   ? coin block   o coin   h heart   ^ spikes   ~ lava   T torch
              e walker   b bat   k spike-back (armoured)   P start   C checkpoint   F goal flag   . empty  */
  var LEVELS = [
    { name: 'GRASSLAND', theme: 'grass', map: [
      '............................................................................................................................',
      '............................................................................................................................',
      '............................................................................................................................',
      '............................................................................................................................',
      '............................................................................................................................',
      '............................................................................................................................',
      '............................................................................................................................',
      '............................................................................................................................',
      '..................................................................................h.........................................',
      '.................................................................................===........................................',
      '..............ooo...................ooo.................................ooo...............ooo............ooo.ooooo..........',
      '....................oo.......................oo..............................ooo............................................',
      '.........ooo.o...o..==.......???...o...o........................oo.....o...o.===.........o...o...??.....o...o..###..........',
      '.............................................##.................==............................................####..........',
      '...P.....................e...............e.######...e..e....C...........^^.............e..............e..^^..#####.....F....',
      '##############..####################...########################....#######################...###############################',
      '##############..####################...########################....#######################...###############################',
      '##############..####################...########################....#######################...###############################',
      '##############..####################...########################....#######################...###############################'] },
    { name: 'CRYSTAL CAVE', theme: 'cave', map: [
      '########################################################################################################################################',
      '########################################################################################################################################',
      '......##.....#.....##......#.....#......##.....#.......##......#......#.....##.......#......#......##.......#.....#.....#.....##........',
      '......##.....#.....##......#.....#......##.....#.......##......#......#.....##.......#......#......##.......#.....#.....#.....##........',
      '.......#...........#.............#.......#.............#..............#......#.......#.............#..............#...........#.........',
      '........................................................................................................................................',
      '........................................................................................................................................',
      '........................................................................................................................................',
      '...............................................................................................h........................................',
      '...............................................................................b..............===.......................................',
      '...........................ooo....................b.................ooo...b........ooo...............................b...oo.............',
      '...........................................ooo............................................ooo...........................o..o............',
      '........ooo...............o...o............===.??........oo........o...o..........o...o...===...................oo.....o....o...........',
      '.........................................................==.....................................................==......................',
      '...P...........T......e..........T.e...##...........e............C..^^......e.......................e...k...............^^^...T..k...F..',
      '###########################...##########################....#######################...#########################....#####################',
      '###########################...##########################....#######################...#########################....#####################',
      '###########################...##########################....#######################...#########################....#####################',
      '###########################...##########################....#######################...#########################....#####################'] },
    { name: 'FIRE CASTLE', theme: 'castle', map: [
      '####################################################################################################################################################',
      '....................................................................................................................................................',
      '....................................................................................................................................................',
      '....................................................................................................................................................',
      '....................................................................................................................................................',
      '....................................................................................................................................................',
      '....................................................................................................................................................',
      '....................................................................................................................................................',
      '................................................................................................h...................................................',
      '................................................................................b..............===..................................................',
      '..................................................ooo.....................b...............................................oo.......b................',
      '.........................................................................................................................o..o.......................',
      '........ooo......................................o...o...........................??........===..........................o....o......................',
      '.......................oo.oo...............##.....................oo.oo..................................oo.oo......................................',
      '...P.........T....k....==.==..T..e...e...######...^^....k...C.T...==.==.....e..........k............Te...==.==...e..k....^^^...e........T..k....F...',
      '######################~~~~~~~####################################~~~~~~#################################~~~~~~######################################',
      '######################.......####################################......#################################......######################################',
      '######################.......####################################......#################################......######################################',
      '######################.......####################################......#################################......######################################'] }
  ];
  var THEMES = {
    grass: { a: '#3d9bf0', b: '#cdeeff', body: '#9a5b2e', bodyDk: '#7a4522', top: '#5be04a', topHi: '#b6ff7a', brick: '#e0903a', far: '#9cc8ec', mid: '#74c476', near: '#4aa84e', cloud: '#ffffff', kind: 'grass' },
    cave: { a: '#070a1e', b: '#1a2350', body: '#4d5a82', bodyDk: '#363f62', top: '#93a2d0', brick: '#7a55b8', far: '#10173a', mid: '#18214e', near: '#222c64', cloud: '#2a3470', kind: 'rock' },
    castle: { a: '#1c0618', b: '#531433', body: '#6e5f80', bodyDk: '#4c4060', top: '#a090b8', brick: '#9a3c3c', far: '#2a0c28', mid: '#3f1239', near: '#561a48', cloud: '#7a2a5a', kind: 'rock' }
  };

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function tri(x) { x = x - Math.floor(x); return x < 0.5 ? x * 2 : 2 - x * 2; }

  /* ------------------------------------------------------------------ sprites */
  function outline(lines) {
    var h = lines.length, w = 0, y, x, out = [];
    lines.forEach(function (l) { w = Math.max(w, l.length); });
    var g = lines.map(function (l) { while (l.length < w) l += '.'; return l; });
    function at(x, y) { return (y < 0 || y >= h || x < 0 || x >= w) ? '.' : g[y].charAt(x); }
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
  var HERO_PAL = { o: '#2a1038', R: '#ff3d5e', r: '#b01f3a', k: '#ffd0a8', K: '#1d2b53', P: '#ff8fa8', S: '#ffd23a', B: '#2f8bff', b: '#1c5fc0', Y: '#ffd23a', L: '#3a2a8a', N: '#8a4a22', X: '#ff3d5e', W: '#ffffff' };
  var HERO_TOP = [
    '...RRRR...', '..RRRRRR..', '.RRRRRRRrr', '..kkkkkkk.', '..kkKkKkk.', '..kPkkkkk.', 'SS.BBBBBb.', '.SBBBBBBk.', '..BBBBBBb.', '..BYYYYBb.', '..bBBBBb..'];
  var HERO_LEGS = {
    idle: ['..LL..LL..', '..LL..LL..', '.NNN..NNN.'],
    run1: ['..LL...LL.', '.LL.....L.', '.NN....NN.'],
    run2: ['...LL.LL..', '...L..LL..', '..NN..NNN.'],
    jump: ['..LL...LL.', '.LL....NN.', 'NN........'],
    fall: ['.LL....LL.', '.LL....LL.', '.NN....NN.']
  };
  var WALK_PAL = { o: '#2a0a3a', P: '#b04bd0', p: '#7c2aa0', W: '#ffffff', K: '#1d2b53', F: '#4a1a60', b: '#2a0a3a' };
  var WALK_A = ['..PPPP..', '.PPPPPP.', 'bPWKPWKb', 'PPbbbbPP', 'PPPPPPPP', 'ppppppp.', '.FF..FF.'];
  var WALK_B = ['..PPPP..', '.PPPPPP.', 'bPWKPWKb', 'PPbbbbPP', 'PPPPPPPP', 'ppppppp.', 'FF....FF'];
  var WALK_D = ['........', '........', '........', '.PPPPPP.', 'PWKbbKWP', 'pppppppp', '.F....F.'];
  var BAT_PAL = { o: '#1a0a2a', '#': '#5a3a8a', d: '#3a2260', e: '#ff3d5e', w: '#7a52b0', t: '#ffffff' };
  var BAT_UP = ['w........w', 'ww.#..#.ww', 'www####www', '.wwd##dww.', '..#e##e#..', '...#tt#...'];
  var BAT_DN = ['..........', '..#....#..', '.w#e##e#w.', 'www####www', 'ww.d##d.ww', 'w..#tt#..w'];
  var KB_PAL = { o: '#2a1208', S: '#c8ccd8', s: '#8a90a8', R: '#e8602a', r: '#a8381a', k: '#ffd0a0', K: '#1d2b53', F: '#7a3a1a' };
  var KB_A = ['.S..S..S..', '.sS.sS.sS.', 'RRRRRRRRR.', 'RrRRRRRrRk', 'RRRRRRRRkk', 'rrrrrrrrKk', '.FF...FF..'];
  var KB_B = ['.S..S..S..', '.sS.sS.sS.', 'RRRRRRRRR.', 'RrRRRRRrRk', 'RRRRRRRRkk', 'rrrrrrrrKk', 'FF.....FF.'];
  var HEART = ['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
  var S = {};
  function buildSprites() {
    var legs = HERO_LEGS;
    function hero(l) { return R.sprite(outline(HERO_TOP.concat(l)), HERO_PAL); }
    S.hero = { idle: hero(legs.idle), run: [hero(legs.run1), hero(legs.idle), hero(legs.run2), hero(legs.idle)], jump: hero(legs.jump), fall: hero(legs.fall) };
    var dead = HERO_TOP.map(function (r) { return r.replace('KkK', 'XkX').replace('K', 'X'); }).concat(legs.fall);
    S.hero.dead = R.sprite(outline(dead), HERO_PAL);
    S.walk = [R.sprite(outline(WALK_A), WALK_PAL), R.sprite(outline(WALK_B), WALK_PAL), R.sprite(outline(WALK_D), WALK_PAL)];
    S.bat = [R.sprite(outline(BAT_UP), BAT_PAL), R.sprite(outline(BAT_DN), BAT_PAL)];
    S.kb = [R.sprite(outline(KB_A), KB_PAL), R.sprite(outline(KB_B), KB_PAL)];
    S.heart = R.sprite(outline(HEART), { o: '#5a0a1a', R: '#ff3d6e', W: '#ffc0d0' });
  }

  /* -------------------------------------------------------------------- state */
  var lv, th, levelIdx, loop, phase, phaseT, hero, enemies, coins, hearts, fireballs, bumps, camX, time, levelTime, banner, lives;
  var coinCount, kills, fireKills, check, combo, fade, flagY, stomped, shake0;

  function tile(tx, ty) { if (tx < 0 || tx >= lv.w) return '#'; if (ty < 0 || ty >= lv.h) return '.'; return lv.t[ty][tx]; }
  function isSolid(c) { return c === '#' || c === '=' || c === '?' || c === '!'; }
  function solidAt(tx, ty) { return isSolid(tile(tx, ty)); }

  function parseLevel(def) {
    var rows = def.map, h = rows.length, w = rows[0].length, x, y;
    var L = { def: def, w: w, h: h, t: [], ents: [], coins: [], hearts: [], spawn: { x: 24, y: 120 }, flag: null, checks: [] };
    for (y = 0; y < h; y++) {
      var row = [];
      for (x = 0; x < w; x++) {
        var ch = rows[y].charAt(x), keep = '.';
        if (ch === '#' || ch === '=' || ch === '?' || ch === '^' || ch === '~' || ch === 'T') keep = ch;
        else if (ch === 'o') L.coins.push({ x: x * T + 4, y: y * T + 4, got: false, ph: hash(x * 3 + y) * 6 });
        else if (ch === 'h') L.hearts.push({ x: x * T + 4, y: y * T + 4, got: false });
        else if (ch === 'e' || ch === 'b' || ch === 'k') L.ents.push({ kind: ch, tx: x, ty: y });
        else if (ch === 'P') L.spawn = { x: x * T + 4, y: (y + 1) * T };
        else if (ch === 'F') L.flag = { tx: x, ty: y };
        else if (ch === 'C') L.checks.push({ tx: x, ty: y, on: false });
        row.push(keep);
      }
      L.t.push(row);
    }
    return L;
  }

  function spawnEnemies() {
    var mult = 1 + 0.22 * loop;
    enemies = lv.ents.map(function (s) {
      var e = { kind: s.kind, x: s.tx * T + 4, y: (s.ty + 1) * T, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, alive: true, sq: 0, t: hash(s.tx) * 6, ox: s.tx * T + 4, oy: s.ty * T + 4, mult: mult, w: 7, h: 6 };
      if (s.kind === 'e') { e.vx = 15 * mult; e.w = 7; e.h = 7; }
      else if (s.kind === 'k') { e.vx = 13 * mult; e.w = 9; e.h = 8; }
      else { e.w = 8; e.h = 6; }
      return e;
    });
  }

  function startLevel(i) {
    levelIdx = i; lv = parseLevel(LEVELS[i]); th = THEMES[lv.def.theme];
    lv.checks.forEach(function (c) { c.on = false; });
    coins = lv.coins; hearts = lv.hearts; spawnEnemies();
    fireballs = []; bumps = []; check = null; levelTime = 0; banner = 2.2; combo = 0; flagY = 0;
    placeHero(lv.spawn.x, lv.spawn.y);
    camX = U.clamp(hero.x - 52, 0, lv.w * T - W);
    R.level = loop * LEVELS.length + i + 1;
    phase = 'play'; phaseT = 0; fade = 1;
  }
  function placeHero(x, y) {
    hero = { x: x, y: y, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, jbuf: 0, invuln: INVULN, anim: 0, runDust: 0, throwT: 0, dead: false };
    fireballs = [];
  }
  function respawn() {
    var p = check ? { x: check.tx * T + 4, y: (check.ty + 1) * T } : lv.spawn;
    spawnEnemies(); placeHero(p.x, p.y); phase = 'play'; phaseT = 0; combo = 0;
    camX = U.clamp(hero.x - 52, 0, lv.w * T - W);
  }

  /* ----------------------------------------------------------------- collision */
  function moveX(e, dx, hw, hh) {
    e.x += dx;
    var top = e.y - hh, bot = e.y - 0.01, ty0 = Math.floor(top / T), ty1 = Math.floor(bot / T), ty, tx;
    if (dx > 0) { tx = Math.floor((e.x + hw) / T); for (ty = ty0; ty <= ty1; ty++) if (solidAt(tx, ty)) { e.x = tx * T - hw - 0.001; return true; } }
    else if (dx < 0) { tx = Math.floor((e.x - hw) / T); for (ty = ty0; ty <= ty1; ty++) if (solidAt(tx, ty)) { e.x = (tx + 1) * T + hw + 0.001; return true; } }
    return false;
  }
  function moveY(e, dy, hw, hh) {            // returns 1 if landed, -1 if bumped head (sets e.bumpTx)
    e.y += dy;
    var tx0 = Math.floor((e.x - hw + 0.01) / T), tx1 = Math.floor((e.x + hw - 0.01) / T), tx, ty;
    if (dy >= 0) {
      ty = Math.floor(e.y / T);
      for (tx = tx0; tx <= tx1; tx++) if (solidAt(tx, ty) && (e.y - dy) <= ty * T + 0.01) { e.y = ty * T; return 1; }
    } else {
      ty = Math.floor((e.y - hh) / T);
      var best = -1, bd = 99;
      for (tx = tx0; tx <= tx1; tx++) if (solidAt(tx, ty)) { var d = Math.abs(tx * T + 4 - e.x); if (d < bd) { bd = d; best = tx; } }
      if (best >= 0) { e.y = (ty + 1) * T + hh; e.bumpTx = best; e.bumpTy = ty; return -1; }
    }
    return 0;
  }

  /* -------------------------------------------------------------------- hero */
  function hurt(why) {
    if (hero.invuln > 0 || hero.dead || phase !== 'play') return;
    hero.dead = true; phase = 'dying'; phaseT = 0; hero.vy = -210; hero.vx = 0;
    lives = Math.max(0, lives - 1); R.lives = lives;
    R.sfx.play('hit'); R.vibrate(90); R.fx.shake(3, 0.3);
    R.fx.burst(hero.x, hero.y - 6, { n: 16, color: ['#ff3d5e', '#ffd0a8', '#ffffff', '#2f8bff'], speed: 80, life: 0.6, gravity: 150, size: 2 });
  }
  function killEnemy(e, how) {
    e.alive = false; e.sq = 0.35; kills++;
    var pts = how === 'stomp' ? 50 * Math.pow(2, Math.min(combo, 3)) : 50;
    R.addScore(pts); R.fx.text(e.x, e.y - 12, '+' + pts, C.yellow);
    R.sfx.play(how === 'stomp' ? 'hit' : 'explode'); R.vibrate(18);
    R.fx.burst(e.x, e.y - 4, { n: 12, color: e.kind === 'b' ? ['#5a3a8a', '#ff3d5e', '#ffffff'] : ['#b04bd0', '#ffffff', '#7c2aa0'], speed: 70, life: 0.45, gravity: 120, size: 2 });
    if (how === 'stomp') { combo++; R.achieve('stomper'); }
    else { fireKills++; if (fireKills >= 5) R.achieve('fire-starter'); }
  }
  function collectCoin(c) {
    c.got = true; coinCount++; R.addScore(10); R.sfx.play('coin'); R.vibrate(5);
    R.fx.burst(c.x, c.y, { n: 6, color: ['#ffec27', '#ffffff', '#ffa300'], speed: 45, life: 0.35, size: 1 });
    if (coinCount >= 30) R.achieve('coin-hoarder');
  }
  function bumpBlock(tx, ty) {
    var c = tile(tx, ty);
    bumps.push({ tx: tx, ty: ty, t: 0.18 });
    if (c === '?') {
      lv.t[ty][tx] = '!'; coinCount++; R.addScore(10); R.sfx.play('coin'); R.fx.text(tx * T + 4, ty * T - 4, '+10', C.yellow);
      R.fx.burst(tx * T + 4, ty * T, { n: 8, color: ['#ffec27', '#ffffff'], speed: 50, life: 0.4, size: 1, gravity: 100 });
      if (coinCount >= 30) R.achieve('coin-hoarder');
    } else R.sfx.tone(160, 0.05, { type: 'square', vol: 0.07 });
  }
  function throwFire() {
    if (fireballs.length >= 2) return;
    fireballs.push({ x: hero.x + hero.face * 5, y: hero.y - 7, vx: hero.face * 135, vy: 30, t: 0 });
    hero.throwT = 0.15; R.sfx.play('shoot'); R.vibrate(4);
    R.fx.burst(hero.x + hero.face * 6, hero.y - 7, { n: 3, color: ['#ffa300', '#ffec27'], speed: 24, life: 0.2, size: 1 });
  }

  function heroUpdate(dt) {
    var inp = R.input, h = hero;
    var ax = inp.axisX(), run = inp.held.b, maxV = run ? RUN_V : WALK_V;
    var jumpHeld = inp.held.a || inp.held.up;
    if (ax) {
      var acc = h.ground ? ACC_G : ACC_A, along = h.vx * ax;
      if (along < 0) acc *= 2;
      if (along < maxV) along = Math.min(maxV, along + acc * dt);
      else along = Math.max(maxV, along - (h.ground ? FRIC_G : FRIC_A) * dt);
      h.vx = along * ax; h.face = ax;
    } else {
      var f = (h.ground ? FRIC_G : FRIC_A) * dt;
      h.vx = Math.abs(h.vx) <= f ? 0 : h.vx - Math.sign(h.vx) * f;
    }
    if (inp.pressed('b')) throwFire();
    h.coyote = h.ground ? COYOTE : h.coyote - dt;
    h.jbuf = (inp.pressed('a') || inp.pressed('up')) ? JBUF : h.jbuf - dt;
    if (h.jbuf > 0 && h.coyote > 0) {
      h.vy = -JUMP_V - Math.abs(h.vx) * 0.12; h.ground = false; h.coyote = 0; h.jbuf = 0;
      R.sfx.play('jump'); R.vibrate(6);
      R.fx.burst(h.x, h.y, { n: 4, color: ['#ffffff', '#d9c7a0'], speed: 30, life: 0.25, size: 1, gravity: 20 });
    }
    var g = h.vy < 0 ? (jumpHeld ? GRAV_UP : GRAV_CUT) : GRAV_DN;
    h.vy = Math.min(MAX_FALL, h.vy + g * dt);
    moveX(h, h.vx * dt, HW, HH);
    if (h.x < HW) { h.x = HW; h.vx = 0; }
    var wasGround = h.ground, r = moveY(h, h.vy * dt, HW, HH);
    if (r === 1) {
      if (!wasGround && h.vy > 60) { R.fx.burst(h.x, h.y, { n: 5, color: ['#ffffff', '#d9c7a0'], speed: 36, life: 0.25, size: 1, gravity: 20 }); }
      h.vy = 0; h.ground = true; combo = 0;
    } else { h.ground = false; if (r === -1) { h.vy = Math.max(h.vy, 40); bumpBlock(h.bumpTx, h.bumpTy); } }
    if (h.ground && Math.abs(h.vx) > 45) { h.runDust -= dt; if (h.runDust <= 0) { h.runDust = 0.12; R.fx.burst(h.x - h.face * 3, h.y, { n: 1, color: '#e8e0c8', speed: 14, life: 0.25, size: 1, gravity: -12 }); } }
    h.anim += dt * (Math.abs(h.vx) / 9 + 3);
    if (h.invuln > 0) h.invuln -= dt;
    if (h.throwT > 0) h.throwT -= dt;
    // safety: ground check when standing still next to ledges
    if (!h.ground && h.vy >= 0 && solidAt(Math.floor(h.x / T), Math.floor((h.y + 0.5) / T)) && false) h.ground = true;
  }

  /* ----------------------------------------------------------------- enemies */
  function enemyUpdate(e, dt) {
    if (!e.alive) { e.sq -= dt; return; }
    e.t += dt;
    if (e.kind === 'b') {
      e.x = e.ox + Math.sin(e.t * 0.9) * 30; e.y = e.oy + 4 + Math.sin(e.t * 2.3) * 7; e.dir = Math.cos(e.t * 0.9) > 0 ? 1 : -1;
      return;
    }
    e.vy = Math.min(MAX_FALL, e.vy + 900 * dt);
    var onGround = moveY(e, e.vy * dt, e.w / 2 - 0.5, e.h) === 1;
    if (onGround) e.vy = 0;
    var sp = (e.kind === 'e' ? 15 : 13) * e.mult;
    if (onGround) {
      // turn around at ledges
      var fx = e.x + e.dir * (e.w / 2 + 1), below = solidAt(Math.floor(fx / T), Math.floor((e.y + 1) / T));
      if (!below) e.dir = -e.dir;
    }
    if (moveX(e, e.dir * sp * dt, e.w / 2 - 0.5, e.h)) e.dir = -e.dir;
    if (e.y > lv.h * T + 40) e.alive = false;
  }

  function checkEnemyHeroHits() {
    var h = hero, i, e;
    for (i = 0; i < enemies.length; i++) {
      e = enemies[i]; if (!e.alive) continue;
      var ex0 = e.x - e.w / 2, ex1 = e.x + e.w / 2, ey0 = e.y - e.h, ey1 = e.y;
      if (e.kind === 'b') { ey0 = e.y - 3; ey1 = e.y + 3; }
      if (h.x + HW > ex0 + 0.5 && h.x - HW < ex1 - 0.5 && h.y > ey0 && h.y - HH < ey1) {
        var stompable = e.kind !== 'k';
        if (h.vy > 20 && h.y - 4 < ey0 + e.h * 0.6 && stompable) { killEnemy(e, 'stomp'); h.vy = (R.input.held.a || R.input.held.up) ? -235 : -160; h.ground = false; }
        else hurt('enemy');
      }
    }
  }

  function fireballUpdate(dt) {
    for (var i = fireballs.length - 1; i >= 0; i--) {
      var f = fireballs[i], gone = false, k;
      f.t += dt; f.vy = Math.min(250, f.vy + 650 * dt);
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (solidAt(Math.floor((f.x + Math.sign(f.vx) * 2) / T), Math.floor(f.y / T))) gone = true;
      else if (f.vy > 0 && solidAt(Math.floor(f.x / T), Math.floor((f.y + 2) / T))) { f.y = Math.floor((f.y + 2) / T) * T - 2; f.vy = -105; }
      for (k = 0; k < enemies.length && !gone; k++) {
        var e = enemies[k]; if (!e.alive) continue;
        var by = e.kind === 'b' ? e.y : e.y - e.h / 2;
        if (Math.abs(f.x - e.x) < e.w / 2 + 2 && Math.abs(f.y - by) < e.h / 2 + 3) {
          gone = true;
          if (e.kind === 'k') { R.sfx.tone(900, 0.05, { vol: 0.06 }); R.fx.burst(f.x, f.y, { n: 4, color: ['#c8ccd8', '#ffffff'], speed: 50, life: 0.2, size: 1 }); }
          else killEnemy(e, 'fire');
        }
      }
      if (f.t > 1.8 || f.x < camX - 20 || f.x > camX + W + 20 || f.y > lv.h * T + 20) gone = true;
      if (gone) { R.fx.burst(f.x, f.y, { n: 4, color: ['#ffa300', '#ffec27'], speed: 36, life: 0.2, size: 1 }); fireballs.splice(i, 1); }
    }
  }

  /* -------------------------------------------------------------------- game */
  R.game({
    layout: 'full', size: [W, H], bg: '#3d9bf0', music: 'adventure',

    _dbg: function () { return { hero: hero, enemies: enemies, lv: lv, phase: phase, levelIdx: levelIdx, loop: loop, coins: coins, lives: lives, camX: camX, K: { T: T, HW: HW, HH: HH }, solidAt: solidAt, tile: tile, goto: function (i) { startLevel(i); } }; }, /*DBG*/

    init: function () { buildSprites(); },

    reset: function () {
      loop = 0; lives = 3; coinCount = 0; kills = 0; fireKills = 0; time = 0; shake0 = 0;
      R.lives = 3; R.score = 0;
      startLevel(0); fade = 0;
    },

    update: function (dt) {
      var i;
      time += dt;
      if (banner > 0) banner -= dt;
      if (fade > 0 && phase === 'play') fade = Math.max(0, fade - dt * 2.2);
      if (phase === 'dying') {
        phaseT += dt;
        hero.vy = Math.min(300, hero.vy + 800 * dt); hero.y += hero.vy * dt;
        if (phaseT > 1.05) { if (lives <= 0) R.gameOver(); else respawn(); }
        return;
      }
      if (phase === 'clear') {
        phaseT += dt;
        var poleX = lv.flag.tx * T + 4, groundY = (lv.flag.ty + 1) * T;
        if (phaseT < 0.8) { hero.x = poleX - 3; hero.y = Math.min(groundY, hero.y + 55 * dt); flagY = Math.min(1, phaseT / 0.8); hero.vx = 0; }
        else if (phaseT < 1.6) { hero.x += 28 * dt; hero.face = 1; hero.anim += dt * 8; hero.y = groundY; }
        if (phaseT > 0.9 && phaseT < 2.0 && Math.random() < 0.25) R.fx.burst(poleX + U.rand(-24, 24), groundY - U.rand(30, 60), { n: 14, color: ['#ffec27', '#ff3d5e', '#3de2ff', '#7cff6a', '#ffffff'], speed: 70, life: 0.7, gravity: 60, size: 2 });
        if (phaseT > 2.0) fade = Math.min(1, (phaseT - 2.0) / 0.4);
        if (phaseT > 2.4) {
          if (levelIdx < LEVELS.length - 1) startLevel(levelIdx + 1);
          else { phase = 'win'; phaseT = 0; fade = 0; R.sfx.play('win'); R.achieve('hero-of-the-land'); R.addScore(1000); R.toast('WORLD CLEAR!  +1000', 2200); }
        }
        camX += (U.clamp(hero.x - 52, 0, lv.w * T - W) - camX) * Math.min(1, dt * 4);
        return;
      }
      if (phase === 'win') {
        phaseT += dt; hero.anim += dt * 8;
        if (Math.random() < 0.3) R.fx.burst(U.rand(camX + 10, camX + W - 10), U.rand(30, 90), { n: 14, color: ['#ffec27', '#ff3d5e', '#3de2ff', '#7cff6a', '#ffffff'], speed: 70, life: 0.7, gravity: 60, size: 2 });
        if (phaseT > 3.4) { loop++; startLevel(0); fade = 1; }
        return;
      }
      levelTime += dt;
      heroUpdate(dt);
      for (i = 0; i < enemies.length; i++) enemyUpdate(enemies[i], dt);
      if (phase !== 'play') return;
      checkEnemyHeroHits();
      fireballUpdate(dt);
      for (i = bumps.length - 1; i >= 0; i--) { bumps[i].t -= dt; if (bumps[i].t <= 0) bumps.splice(i, 1); }
      /* pickups */
      var h = hero;
      for (i = 0; i < coins.length; i++) { var c = coins[i]; if (!c.got && Math.abs(c.x - h.x) < 7 && Math.abs(c.y - (h.y - 6)) < 9) collectCoin(c); }
      for (i = 0; i < hearts.length; i++) {
        var hr = hearts[i];
        if (!hr.got && Math.abs(hr.x - h.x) < 8 && Math.abs(hr.y - (h.y - 6)) < 10) {
          hr.got = true; lives = Math.min(5, lives + 1); R.lives = lives; R.addScore(100); R.sfx.play('powerup'); R.vibrate(25); R.fx.text(hr.x, hr.y - 8, '1UP', '#ff8fa8');
          R.fx.burst(hr.x, hr.y, { n: 12, color: ['#ff3d6e', '#ffc0d0', '#ffffff'], speed: 60, life: 0.5, size: 2 });
        }
      }
      for (i = 0; i < lv.checks.length; i++) {
        var ck = lv.checks[i];
        if (!ck.on && h.x > ck.tx * T) { ck.on = true; check = ck; R.sfx.play('select'); R.fx.text(ck.tx * T + 4, ck.ty * T - 10, 'CHECKPOINT', '#7cff6a'); R.fx.burst(ck.tx * T + 4, ck.ty * T - 8, { n: 10, color: ['#7cff6a', '#ffffff'], speed: 50, life: 0.5, size: 1 }); }
      }
      /* hazards: spikes, lava, pits */
      var tx0 = Math.floor((h.x - HW) / T), tx1 = Math.floor((h.x + HW) / T), ty0 = Math.floor((h.y - HH) / T), ty1 = Math.floor((h.y - 0.5) / T), tx, ty;
      for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
        var tc = tile(tx, ty);
        if (tc === '^' && h.y > ty * T + 3 && h.y - HH < (ty + 1) * T) hurt('spikes');
        else if (tc === '~' && h.y > ty * T + 2) hurt('lava');
      }
      if (h.y > lv.h * T + 18) hurt('pit');
      /* goal */
      if (lv.flag) {
        var fx = lv.flag.tx * T + 4, fy = (lv.flag.ty + 1) * T;
        if (Math.abs(h.x - fx) < HW + 3 && h.y > fy - 5 * T && h.y - HH < fy) {
          phase = 'clear'; phaseT = 0; hero.vx = 0; hero.vy = 0; fireballs = [];
          var bonus = Math.round(U.clamp(1000 - levelTime * 8, 100, 1000) / 10) * 10;
          R.addScore(bonus); R.sfx.play('win'); R.vibrate(40); R.fx.text(fx, fy - 50, 'CLEAR +' + bonus, C.yellow);
          R.toast('LEVEL CLEAR!  +' + bonus, 1800);
        }
      }
      /* camera */
      var target = U.clamp(h.x - 52 + h.face * 12, 0, lv.w * T - W);
      camX += (target - camX) * Math.min(1, dt * 5);
    },

    render: function (ctx, w, h) {
      var i;
      drawBackdrop(ctx, w, h);
      var cx = Math.round(camX);
      ctx.save(); ctx.translate(-cx, TOP);
      drawTiles(ctx, cx);
      drawDecor(ctx, cx);
      for (i = 0; i < coins.length; i++) if (!coins[i].got && coins[i].x > cx - 8 && coins[i].x < cx + w + 8) drawCoin(ctx, coins[i]);
      for (i = 0; i < hearts.length; i++) if (!hearts[i].got) drawHeart(ctx, hearts[i]);
      for (i = 0; i < enemies.length; i++) if (enemies[i].x > cx - 20 && enemies[i].x < cx + w + 20) drawEnemy(ctx, enemies[i]);
      for (i = 0; i < fireballs.length; i++) drawFire(ctx, fireballs[i]);
      drawHero(ctx);
      ctx.restore();
      drawHud(ctx, w, h);
    }
  });

  /* ------------------------------------------------------------------ drawing */
  function drawBackdrop(ctx, w, h) {
    var i, n = 14, bh = Math.ceil(h / n), a = hex(th.a), b = hex(th.b), x;
    for (i = 0; i < n; i++) { ctx.fillStyle = rgb(mix(a, b, Math.pow(i / (n - 1), 1.15))); ctx.fillRect(0, i * bh, w, bh + 1); }
    var base = TOP + 15 * T;                       // y of the ground surface on screen
    var o1 = Math.floor(camX * 0.18), o2 = Math.floor(camX * 0.35), o3 = Math.floor(camX * 0.55);
    if (th.kind === 'grass') {
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9;
      for (i = 0; i < 6; i++) { var cxp = ((i * 61 - Math.floor(camX * 0.12)) % (w + 60) + w + 60) % (w + 60) - 30, cyp = 22 + (i * 17) % 40; ctx.fillRect(cxp, cyp, 18, 4); ctx.fillRect(cxp + 4, cyp - 3, 10, 3); ctx.fillRect(cxp + 2, cyp + 4, 14, 1); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = th.far;
      for (x = 0; x < w; x += 2) { var hh = 20 + 22 * tri((x + o1) / 120) + 8 * tri((x + o1) / 40 + 0.3); ctx.fillRect(x, base - hh, 2, hh); }
      ctx.fillStyle = th.mid;
      for (x = 0; x < w; x += 2) { var hm = 8 + 14 * tri((x + o2) / 70 + 0.2) + 4 * tri((x + o2) / 23); ctx.fillRect(x, base - hm, 2, hm); }
      ctx.fillStyle = th.near;
      for (x = 0; x < w; x += 2) { var hn = 2 + 6 * tri((x + o3) / 44 + 0.6); ctx.fillRect(x, base - hn, 2, hn); }
    } else if (th.kind === 'rock' && lv.def.theme === 'cave') {
      ctx.fillStyle = th.far;
      for (x = 0; x < w; x += 2) { var sh = 6 + 22 * tri((x + o1) / 53) * tri((x + o1) / 131 + 0.4); ctx.fillRect(x, TOP + 12, 2, sh); }
      ctx.fillStyle = th.mid;
      for (x = 0; x < w; x += 2) { var sm = 4 + 16 * tri((x + o2) / 37 + 0.2); ctx.fillRect(x, TOP + 12, 2, sm); }
      for (x = 0; x < w; x += 2) { var fh = 14 + 24 * tri((x + o2) / 90 + 0.5); ctx.fillStyle = th.far; ctx.fillRect(x, base - fh, 2, fh); }
      // glowing crystals
      for (i = 0; i < 9; i++) {
        var gx = ((i * 41 - o2) % (w + 40) + w + 40) % (w + 40) - 20, gy = base - 10 - (i * 29) % 40, pulse = 0.5 + 0.5 * Math.sin(time * 2 + i * 1.7);
        var cc = i % 2 ? '#3de2ff' : '#ff6bd6';
        ctx.globalAlpha = 0.25 + 0.25 * pulse; ctx.fillStyle = cc; ctx.fillRect(gx - 2, gy - 6, 5, 10);
        ctx.globalAlpha = 0.9; ctx.fillRect(gx, gy - 5, 1, 7); ctx.fillRect(gx - 1, gy - 2, 3, 3); ctx.globalAlpha = 1;
      }
    } else {
      // castle: tall arched windows + brick rows
      ctx.fillStyle = th.far;
      for (x = 0; x < w; x += 2) { var bl = 16 + 20 * tri((x + o1) / 90); ctx.fillRect(x, base - bl - 30, 2, bl + 30); }
      for (i = 0; i < 4; i++) {
        var wx = ((i * 50 - o2) % (w + 60) + w + 60) % (w + 60) - 30, wy = TOP + 38;
        ctx.fillStyle = '#12040f'; ctx.fillRect(wx, wy, 16, 40); ctx.fillRect(wx + 2, wy - 3, 12, 4); ctx.fillRect(wx + 4, wy - 5, 8, 3);
        ctx.fillStyle = '#ff7a3a'; ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 3 + i); ctx.fillRect(wx + 3, wy + 4, 10, 34); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = th.mid;
      for (x = 0; x < w; x += 2) { var bm = 6 + 14 * tri((x + o2) / 60 + 0.3); ctx.fillRect(x, base - bm, 2, bm); }
    }
  }
  function drawTiles(ctx, cx) {
    var tx0 = Math.max(0, Math.floor(cx / T)), tx1 = Math.min(lv.w - 1, tx0 + Math.ceil(W / T) + 1), tx, ty, c;
    for (ty = 0; ty < lv.h; ty++) for (tx = tx0; tx <= tx1; tx++) {
      c = lv.t[ty][tx]; if (c === '.') continue;
      var x = tx * T, y = ty * T;
      if (c === '#') drawSolid(ctx, x, y, tx, ty);
      else if (c === '=') { R.draw.block(ctx, x, y, T, th.brick); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 1, y + 4, T - 2, 1); }
      else if (c === '?' || c === '!') {
        var by = y; for (var b = 0; b < bumps.length; b++) if (bumps[b].tx === tx && bumps[b].ty === ty) by -= Math.round(Math.sin(bumps[b].t / 0.18 * Math.PI) * 4);
        R.draw.block(ctx, x, by, T, c === '?' ? '#ffd23a' : '#8a8a96');
        if (c === '?') R.draw.text(ctx, '?', x + 1, by + 1, { size: 6, color: '#a85a00' });
      } else if (c === '^') {
        ctx.fillStyle = '#9aa0b4'; for (var s = 0; s < 4; s++) { ctx.fillRect(x + s * 2, y + 3, 2, 5); ctx.fillStyle = '#e8ecf5'; ctx.fillRect(x + s * 2, y + 3, 1, 2); ctx.fillStyle = '#9aa0b4'; ctx.fillRect(x + s * 2, y + 1 + (s % 2), 2, 2); }
        ctx.fillStyle = '#5a6076'; ctx.fillRect(x, y + 7, T, 1);
      } else if (c === '~') {
        var wob = Math.floor(Math.sin(time * 4 + tx * 1.3) * 1.2);
        ctx.fillStyle = '#ff5a1f'; ctx.fillRect(x, y + 3 + wob, T, T - 3 - wob);
        ctx.fillStyle = '#ffc83a'; ctx.fillRect(x, y + 3 + wob, T, 2);
        ctx.fillStyle = '#ff8a2a'; ctx.fillRect(x + ((tx + Math.floor(time * 3)) % 3) * 2, y + 6, 2, 1);
        for (var below = ty + 1; below < lv.h && lv.t[below][tx] === '.'; below++) { ctx.fillStyle = '#d83a10'; ctx.fillRect(x, below * T, T, T); }
        if (Math.random() < 0.01) R.fx.burst(x + 4, TOP + y, { n: 2, color: ['#ffc83a', '#ff5a1f'], speed: 30, life: 0.5, size: 1, gravity: 90 });
      }
    }
  }
  function drawSolid(ctx, x, y, tx, ty) {
    var above = !solidAt(tx, ty - 1);
    ctx.fillStyle = th.body; ctx.fillRect(x, y, T, T);
    if (th.kind === 'grass') {
      ctx.fillStyle = th.bodyDk;
      var hv = hash(tx * 7 + ty * 13); ctx.fillRect(x + Math.floor(hv * 6), y + 3 + Math.floor(hash(tx + ty * 5) * 4), 2, 1);
      if (hv > 0.6) ctx.fillRect(x + 5, y + 6, 1, 1);
      if (above) {
        ctx.fillStyle = th.top; ctx.fillRect(x, y, T, 3); ctx.fillStyle = th.topHi; ctx.fillRect(x, y, T, 1);
        ctx.fillStyle = th.top; if (hv > 0.3) ctx.fillRect(x + 1, y + 3, 2, 1); if (hv < 0.7) ctx.fillRect(x + 5, y + 3, 2, 2);
      }
    } else {
      ctx.fillStyle = th.bodyDk; ctx.fillRect(x, y + 7, T, 1); ctx.fillRect(x + (ty % 2 ? 3 : 7), y, 1, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, T, 1);
      if (above) { ctx.fillStyle = th.top; ctx.fillRect(x, y, T, 2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, T, 1); }
      if (!solidAt(tx, ty + 1) && ty < lv.h - 1 && ty > 2) { ctx.fillStyle = th.bodyDk; ctx.fillRect(x, y + 6, T, 2); }
    }
  }
  function drawDecor(ctx, cx) {
    var tx0 = Math.max(0, Math.floor(cx / T)), tx1 = Math.min(lv.w - 1, tx0 + Math.ceil(W / T) + 1), tx, ty;
    for (ty = 0; ty < lv.h; ty++) for (tx = tx0; tx <= tx1; tx++) {
      if (lv.t[ty][tx] !== 'T') continue;
      var x = tx * T, y = ty * T, fl = Math.floor(time * 10 + tx) % 3;
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x + 3, y + 3, 2, 5); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 2, y + 2, 4, 2);
      ctx.fillStyle = '#ff7a1a'; ctx.fillRect(x + 3, y - 1 - (fl === 1 ? 1 : 0), 2, 4); ctx.fillStyle = '#ffd23a'; ctx.fillRect(x + 3, y + (fl === 0 ? 0 : 1), 2, 2);
      ctx.globalAlpha = 0.12 + (fl ? 0.04 : 0); ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.arc(x + 4, y + 1, 13, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    for (var i = 0; i < lv.checks.length; i++) {
      var ck = lv.checks[i], px = ck.tx * T + 3, py = (ck.ty + 1) * T;
      ctx.fillStyle = '#c8ccd8'; ctx.fillRect(px, py - 20, 2, 20);
      ctx.fillStyle = ck.on ? '#7cff6a' : '#3d9bff'; var wv = Math.floor(Math.sin(time * 6) * 1);
      ctx.fillRect(px + 2, py - 20, 7, 3); ctx.fillRect(px + 2, py - 17 + wv, 5, 3); ctx.fillRect(px + 2, py - 14, 3, 1);
    }
    if (lv.flag) {
      var fx = lv.flag.tx * T + 3, fy = (lv.flag.ty + 1) * T, ph = 5 * T;
      ctx.fillStyle = '#c8ccd8'; ctx.fillRect(fx, fy - ph, 2, ph); ctx.fillStyle = '#ffd23a'; ctx.fillRect(fx - 1, fy - ph - 3, 4, 3);
      var down = phase === 'clear' ? flagY * (ph - 14) : 0, wv2 = Math.floor(Math.sin(time * 8) * 1);
      ctx.fillStyle = '#ff3d5e'; ctx.fillRect(fx + 2, fy - ph + 1 + down, 12, 8); ctx.fillRect(fx + 2, fy - ph + 9 + down, 8 + wv2, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(fx + 5, fy - ph + 3 + down, 3, 3);
      ctx.fillStyle = '#5a6076'; ctx.fillRect(fx - 2, fy - 2, 6, 2);
    }
  }
  function drawCoin(ctx, c) {
    var wv = [3, 2, 1, 2][Math.floor(time * 7 + c.ph) & 3], x = Math.round(c.x), y = Math.round(c.y + Math.sin(time * 4 + c.ph) * 0.8);
    ctx.fillStyle = '#a85a00'; ctx.fillRect(x - wv - 1, y - 4, wv * 2 + 2, 8);
    ctx.fillStyle = '#ffec27'; ctx.fillRect(x - wv, y - 3, wv * 2, 6);
    if (wv > 1) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(x - wv, y - 3, 1, 3); ctx.fillStyle = '#ffa300'; ctx.fillRect(x + wv - 1, y - 3, 1, 6); }
  }
  function drawHeart(ctx, o) { R.draw.sprite(ctx, S.heart, Math.round(o.x - 4.5), Math.round(o.y - 4 + Math.sin(time * 5) * 1.5)); }
  function drawEnemy(ctx, e) {
    var spr, x, y;
    if (e.kind === 'e') {
      if (!e.alive) { if (e.sq <= 0) return; spr = S.walk[2]; } else spr = S.walk[Math.floor(e.t * 5) & 1];
      x = Math.round(e.x - spr.width / 2); y = Math.round(e.y - spr.height + 1);
      R.draw.sprite(ctx, spr, x, y, { flipX: e.dir > 0 });
    } else if (e.kind === 'k') {
      if (!e.alive) return;
      spr = S.kb[Math.floor(e.t * 4) & 1]; x = Math.round(e.x - spr.width / 2); y = Math.round(e.y - spr.height + 1);
      R.draw.sprite(ctx, spr, x, y, { flipX: e.dir < 0 });
    } else {
      if (!e.alive) return;
      spr = S.bat[Math.floor(e.t * 7) & 1]; x = Math.round(e.x - spr.width / 2); y = Math.round(e.y - spr.height / 2);
      R.draw.sprite(ctx, spr, x, y);
    }
  }
  function drawFire(ctx, f) {
    var x = Math.round(f.x), y = Math.round(f.y), fl = Math.floor(f.t * 20) & 1;
    ctx.fillStyle = 'rgba(255,163,0,0.35)'; ctx.fillRect(x - Math.sign(f.vx) * 5 - 1, y - 1, 3, 2);
    ctx.fillStyle = '#ff6a1a'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = fl ? '#ffec27' : '#ffa300'; ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  function drawHero(ctx) {
    var h = hero, spr;
    if (h.dead) spr = S.hero.dead;
    else if (!h.ground) spr = h.vy < 0 ? S.hero.jump : S.hero.fall;
    else if (Math.abs(h.vx) > 6) spr = S.hero.run[Math.floor(h.anim) & 3];
    else spr = S.hero.idle;
    if (phase === 'clear' && phaseT < 0.8) spr = S.hero.fall;
    if (h.invuln > 0 && !h.dead && Math.floor(time * 16) % 2) return;
    var x = Math.round(h.x - spr.width / 2), y = Math.round(h.y - spr.height + 1);
    R.draw.rect(ctx, Math.round(h.x - 4), Math.round(h.y), 8, 1, 'rgba(0,0,0,0.0)');
    R.draw.sprite(ctx, spr, x, y, { flipX: h.face < 0 });
    if (h.throwT > 0) { ctx.fillStyle = '#ffa300'; ctx.fillRect(Math.round(h.x + h.face * 6), Math.round(h.y - 8), 2, 2); }
  }
  function drawHud(ctx, w, h) {
    R.draw.topBar(ctx);
    ctx.fillStyle = '#ffec27'; ctx.fillRect(3, 15, 5, 5); ctx.fillStyle = '#a85a00'; ctx.fillRect(4, 16, 3, 3); ctx.fillStyle = '#fff6b0'; ctx.fillRect(4, 16, 1, 2);
    R.draw.text(ctx, String(coinCount), 10, 15, { size: 6, color: '#ffec27', shadow: '#000' });
    R.draw.text(ctx, (loop * LEVELS.length + levelIdx + 1 > 3 ? 'L' + (loop * LEVELS.length + levelIdx + 1) : 'L' + (levelIdx + 1)), w - 3, 15, { size: 6, color: '#ffffff', align: 'right', shadow: '#000' });
    if (banner > 0 && phase === 'play') {
      var a = Math.min(1, banner * 2);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 50, w, 36); ctx.globalAlpha = a;
      R.draw.text(ctx, 'LEVEL ' + (loop * LEVELS.length + levelIdx + 1), w / 2, 56, { size: 8, color: '#ffec27', align: 'center', shadow: '#000' });
      R.draw.text(ctx, lv.def.name, w / 2, 70, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (phase === 'win') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 48, w, 52);
      R.draw.text(ctx, 'YOU WIN!', w / 2, 55, { size: 16, color: '#ffec27', align: 'center', shadow: '#a85a00' });
      R.draw.text(ctx, 'LOOP ' + (loop + 2) + ' - HARDER', w / 2, 80, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
    }
    if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }
})();
