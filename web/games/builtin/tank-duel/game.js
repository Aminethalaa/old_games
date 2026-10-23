/* Tank Duel — defend the star base from waves of enemy tanks, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var CS = 12, SS = 6, GW = 13, GH = 26, SW = GW * 2, SH = GH * 2, FW = GW * CS, FH = GH * CS;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];                 // 0 up, 1 right, 2 down, 3 left
  var EMPTY = 0, BRICK = 1, STEEL = 2, WATER = 3, FOREST = 4;
  var HQ_X = 6 * CS, HQ_Y = 25 * CS;
  var SPAWNS = [[0, 0], [6, 0], [12, 0]];
  var P_START = [4, 25];

  /* Wall layouts, 13 x 26 cells.  . empty  B brick  S steel  W water  F forest  H headquarters
     u/d/l/r = half bricks (up, down, left, right).  Row 0-1 stay clear for enemy spawns. */
  var MAPS = [
    { name: 'MEADOW', rows: [
      '.............',
      '.............',
      '.BB.BB.BB.BB.',
      '.BB.BB.BB.BB.',
      '.BB.BB.BB.BB.',
      '.BB.BB.BB.BB.',
      '.............',
      '.............',
      'FF.........FF',
      'FF..SSSSS..FF',
      '....B...B....',
      '.BB.B.S.B.BB.',
      '.BB.B...B.BB.',
      '....B...B....',
      '.............',
      'WW.........WW',
      'WW.BB...BB.WW',
      '...BB...BB...',
      '.............',
      '.BB.......BB.',
      '.BB.......BB.',
      '.............',
      '.BB.......BB.',
      '.BB.......BB.',
      '.....BBB.....',
      '.....BHB.....'] },
    { name: 'RIVER RUN', rows: [
      '.............',
      '.............',
      'BB...BBB...BB',
      'BB...BBB...BB',
      '.............',
      '..SS.....SS..',
      '..SS..F..SS..',
      '......F......',
      'B.B.......B.B',
      'B.B..WWW..B.B',
      'B.B..WWW..B.B',
      '.....WWW.....',
      'WWWW.....WWWW',
      'WWWW.....WWWW',
      '.....uuu.....',
      '..SS.....SS..',
      '..SS.BBB.SS..',
      '.............',
      'BBB.......BBB',
      'B.B.......B.B',
      'B.B...F...B.B',
      '.............',
      '..BB.....BB..',
      '..BB.....BB..',
      '.....BBB.....',
      '.....BHB.....'] },
    { name: 'STEEL GATE', rows: [
      '.............',
      '.............',
      '.S.B.B.B.B.S.',
      '.B.B.B.B.B.B.',
      '.B.B.B.B.B.B.',
      '.............',
      'SSS.......SSS',
      '.....FFF.....',
      '.....FFF.....',
      'B...........B',
      'BB.........BB',
      '.BB.SSSSS.BB.',
      '..B.B...B.B..',
      '..B.B...B.B..',
      '.....WWW.....',
      '.WW..WWW..WW.',
      '.WW.......WW.',
      '.............',
      'BBBB.....BBBB',
      'B..B.....B..B',
      'B..B..S..B..B',
      '.............',
      '.B.B.....B.B.',
      '.B.B.....B.B.',
      '.....BBB.....',
      '.....BHB.....'] }
  ];

  /* ---------------------------------------------------------------- sprites */
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  // 12x12 tank facing up. T/t tread stripes (animated), B hull, L/D hull light and shadow edge, U turret, K barrel
  var TANK = [
    '.....KK.....',
    '.....KK.....',
    'TTTLBKKBDTTT',
    'tttLBUUBDttt',
    'TTTLUUUUDTTT',
    'tttLUUUUDttt',
    'TTTLUUUUDTTT',
    'tttLUUUUDttt',
    'TTTLBUUBDTTT',
    'tttLBBBBDttt',
    'TTTLBDDBDTTT',
    'tttLBBBBDttt'];
  function tankRows(frame) {
    return TANK.map(function (r) {
      return r.replace(/[Tt]/g, function (c) { var dark = (c === 'T'); if (frame) dark = !dark; return dark ? 'T' : 't'; });
    });
  }
  function rotateRows(rows, dir) {
    var n = rows.length, out = rows, k, y, x;
    for (k = 0; k < dir; k++) {
      var next = [];
      for (y = 0; y < n; y++) { var s = ''; for (x = 0; x < n; x++) s += out[n - 1 - x].charAt(y); next.push(s); }
      out = next;
    }
    return out;
  }
  function tankPal(body, tread) {
    return { B: body, L: shade(body, 0.4), D: shade(body, -0.38), U: shade(body, 0.22), K: shade(body, 0.75), T: tread || '#2a2d3a', t: shade(tread || '#2a2d3a', 0.55) };
  }
  var cache = {};
  function tankSprite(body, tread, dir, frame) {
    var key = body + tread + dir + frame;
    return cache[key] || (cache[key] = R.sprite(rotateRows(tankRows(frame), dir), tankPal(body, tread), 1));
  }
  var PLAYER_BODY = ['#e8b81a', '#f3c829', '#ffd84a', '#ffe97a'];            // star 0..3
  var ARMOR_BODY = [null, '#ff4a4a', '#ff9f1c', '#2fc45a'];                    // by hit points left
  var HQ_ALIVE = [
    'DDDDDDDDDDDD',
    'DBBBBBBBBBBD',
    'DBBBBYYBBBBD',
    'DBBBBYYBBBBD',
    'DBBYYYYYYBBD',
    'DBYYYYYYYYBD',
    'DBBYYYYYYBBD',
    'DBBBYYYYBBBD',
    'DBBYYBBYYBBD',
    'DBBYBBBBYBBD',
    'DBBBBBBBBBBD',
    'DDDDDDDDDDDD'];
  var HQ_PAL = { D: '#1d2b53', B: '#29adff', Y: '#ffec27' };
  var HQ_DEAD = [
    '............',
    '............',
    '....DD......',
    '...DKDD..D..',
    '..DDKKDDDKD.',
    '.DKKDDKKDDD.',
    '.DDKDDDKKKD.',
    '.DKKKDDDDKD.',
    'DDDKDDKKDDDD',
    'DKDDDKKDKKDD',
    'DDKKDDDDDDKD',
    'DDDDDDDDDDDD'];
  var HQ_DEAD_PAL = { D: '#3a3f50', K: '#161820' };
  var PICK_ICONS = {
    S: { col: '#ffec27', rows: ['....YY....', '....YY....', '...YYYY...', 'YYYYYYYYYY', '.YYYYYYYY.', '..YYYYYY..', '..YYYYYY..', '.YYYY.YYY.', '.YY....YY.', 'YY......YY'] },
    H: { col: '#3de2ff', rows: ['..CCCCCC..', '.CWWCCCCC.', 'CWWCCCCCCC', 'CWCCCCCCCC', 'CCCCCCCCCC', 'CCCCCCCCCC', '.CCCCCCCC.', '..CCCCCC..', '...CCCC...', '....CC....'] },
    L: { col: '#ff77a8', rows: ['..PP..PP..', '.PPPPPPPP.', 'PPWPPPPPPP', 'PPWPPPPPPP', 'PPPPPPPPPP', '.PPPPPPPP.', '..PPPPPP..', '...PPPP...', '....PP....', '..........'] },
    F: { col: '#7fd8ff', rows: ['....BB....', '.B..BB..B.', '..B.BB.B..', '...BBBB...', 'BBBBBBBBBB', 'BBBBBBBBBB', '...BBBB...', '..B.BB.B..', '.B..BB..B.', '....BB....'] }
  };
  var PICK_PAL = { Y: '#ffec27', C: '#3de2ff', W: '#ffffff', P: '#ff77a8', B: '#bfeaff' };

  /* ---------------------------------------------------------------- state */
  var T, terr, tctx, waters, forests, mapIdx;
  var hq, player, enemies, bullets, pickups, booms, queue, spawnT, spawnIdx, phase, phaseT, stage, starLevel, starsGot, shieldT, freezeT;
  var killsTotal, lastDir, tick, bannerT;

  function getT(sx, sy) { return (sx < 0 || sy < 0 || sx >= SW || sy >= SH) ? STEEL : T[sy * SW + sx]; }

  /* ---- terrain painting (bricks and steel live on an off-screen canvas, redrawn only where they change) ---- */
  function paintSub(sx, sy) {
    var x = sx * SS, y = sy * SS, v = T[sy * SW + sx], c = tctx;
    c.clearRect(x, y, SS, SS);
    if (v === BRICK) {
      c.fillStyle = '#c8502c'; c.fillRect(x, y, SS, SS);
      c.fillStyle = '#e07a52'; c.fillRect(x, y, SS, 1); c.fillRect(x, y + 3, SS, 1);
      c.fillStyle = '#7a2a14'; c.fillRect(x, y + 2, SS, 1); c.fillRect(x, y + 5, SS, 1);
      c.fillStyle = '#ecc7b2'; c.fillRect(x + ((sy & 1) ? 2 : 4), y, 1, 2); c.fillRect(x + ((sy & 1) ? 5 : 1), y + 3, 1, 2);
    } else if (v === STEEL) {
      c.fillStyle = '#a7b0c4'; c.fillRect(x, y, SS, SS);
      c.fillStyle = '#e6ecf8'; c.fillRect(x, y, SS, 1); c.fillRect(x, y, 1, SS);
      c.fillStyle = '#566078'; c.fillRect(x, y + SS - 1, SS, 1); c.fillRect(x + SS - 1, y, 1, SS);
      c.fillStyle = '#7c869e'; c.fillRect(x + 2, y + 2, 2, 2);
    }
  }
  function repaintAll() {
    tctx.clearRect(0, 0, FW, FH);
    for (var sy = 0; sy < SH; sy++) for (var sx = 0; sx < SW; sx++) if (T[sy * SW + sx] === BRICK || T[sy * SW + sx] === STEEL) paintSub(sx, sy);
  }

  function loadMap(idx) {
    var def = MAPS[idx % MAPS.length], gx, gy;
    T = new Uint8Array(SW * SH); waters = []; forests = [];
    function put(sx, sy, v) { T[sy * SW + sx] = v; }
    for (gy = 0; gy < GH; gy++) for (gx = 0; gx < GW; gx++) {
      var ch = def.rows[gy].charAt(gx), sx = gx * 2, sy = gy * 2, v = 0, a, b;
      if (ch === 'B') v = BRICK; else if (ch === 'S') v = STEEL; else if (ch === 'W') v = WATER; else if (ch === 'F') v = FOREST;
      if (v) { for (a = 0; a < 2; a++) for (b = 0; b < 2; b++) put(sx + a, sy + b, v); }
      else if (ch === 'u') { put(sx, sy, BRICK); put(sx + 1, sy, BRICK); }
      else if (ch === 'd') { put(sx, sy + 1, BRICK); put(sx + 1, sy + 1, BRICK); }
      else if (ch === 'l') { put(sx, sy, BRICK); put(sx, sy + 1, BRICK); }
      else if (ch === 'r') { put(sx + 1, sy, BRICK); put(sx + 1, sy + 1, BRICK); }
    }
    for (var i = 0; i < T.length; i++) {
      if (T[i] === WATER) waters.push([i % SW, Math.floor(i / SW)]);
      else if (T[i] === FOREST) forests.push([i % SW, Math.floor(i / SW)]);
    }
    repaintAll();
  }

  /* ---- geometry helpers ---- */
  function hitsTerrain(x, y) {                         // does a 12x12 tank at x,y overlap solid terrain / the base?
    if (x < 0 || y < 0 || x + CS > FW + 0.001 || y + CS > FH + 0.001) return true;
    var sx0 = Math.floor(x / SS), sx1 = Math.ceil((x + CS) / SS) - 1, sy0 = Math.floor(y / SS), sy1 = Math.ceil((y + CS) / SS) - 1;
    for (var sy = sy0; sy <= sy1; sy++) for (var sx = sx0; sx <= sx1; sx++) {
      var v = T[sy * SW + sx];
      if (v === BRICK || v === STEEL || v === WATER) return true;
    }
    if (hq.alive && x < HQ_X + CS && x + CS > HQ_X && y < HQ_Y + CS && y + CS > HQ_Y) return true;
    return false;
  }
  function tankAt(x, y, self) {
    var t, i;
    if (player.alive && player !== self && player.spawn <= 0 && x < player.x + CS && x + CS > player.x && y < player.y + CS && y + CS > player.y) return true;
    for (i = 0; i < enemies.length; i++) {
      t = enemies[i];
      if (t === self) continue;
      if (x < t.x + CS && x + CS > t.x && y < t.y + CS && y + CS > t.y) return true;
      if (t.moving && x < t.tx + CS && x + CS > t.tx && y < t.ty + CS && y + CS > t.ty) return true;       // reserved target cell
    }
    return false;
  }
  function rectFree(x, y, self) { return !hitsTerrain(x, y) && !tankAt(x, y, self); }

  function boom(x, y, big) { booms.push({ x: x, y: y, t: 0, max: big ? 0.6 : 0.35, r: big ? 14 : 8 }); }

  /* ---------------------------------------------------------------- enemies */
  var KINDS = {
    basic: { hp: 1, speed: 34, bullet: 92, fire: [1.4, 3.0], score: 100, body: '#aab2c6', tread: '#3a4054' },
    fast: { hp: 1, speed: 68, bullet: 125, fire: [1.1, 2.4], score: 200, body: '#2fc4d9', tread: '#1f4a58' },
    armor: { hp: 3, speed: 36, bullet: 108, fire: [1.2, 2.6], score: 400, body: '#2fc45a', tread: '#245536' }
  };

  function buildQueue(n) {
    var total = Math.min(30, 10 + (n - 1) * 2), q = [], pf = Math.min(0.4, 0.14 + 0.05 * (n - 1)), pa = n < 2 ? 0 : Math.min(0.4, 0.1 + 0.06 * (n - 2));
    for (var i = 0; i < total; i++) {
      var r = Math.random(), kind = r < pa ? 'armor' : r < pa + pf ? 'fast' : 'basic';
      q.push({ kind: kind, carrier: i % 4 === 3 });
    }
    return q;
  }
  function maxActive() { return stage < 3 ? 3 : stage < 6 ? 4 : 5; }

  function makeEnemy(item, cx, cy, spawning) {
    var k = KINDS[item.kind];
    return { kind: item.kind, hp: k.hp, carrier: item.carrier, x: cx * CS, y: cy * CS, tx: cx * CS, ty: cy * CS, dir: 2, moving: false,
      spawn: spawning ? 0.9 : 0, fireT: U.rand(0.8, 1.8), stall: 0, wait: 0.2, anim: 0, bullets: 0, hurt: 0, frame: 0 };
  }

  function trySpawn() {
    for (var k = 0; k < SPAWNS.length; k++) {
      var idx = (spawnIdx + k) % SPAWNS.length, s = SPAWNS[idx], x = s[0] * CS, y = s[1] * CS;
      if (tankAt(x, y, null)) continue;
      var item = queue.shift();
      enemies.push(makeEnemy(item, s[0], s[1], true));
      spawnIdx = idx + 1;
      return true;
    }
    return false;
  }

  function cellState(cx, cy, self) {      // 'free', 'brick' (only bricks in the way), 'wall' or 'busy'
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return 'wall';
    var sx = cx * 2, sy = cy * 2, brick = false, a, b, v;
    for (a = 0; a < 2; a++) for (b = 0; b < 2; b++) {
      v = T[(sy + b) * SW + sx + a];
      if (v === STEEL || v === WATER) return 'wall';
      if (v === BRICK) brick = true;
    }
    if (hq.alive && cx === 6 && cy === 25) return 'wall';
    if (brick) return 'brick';
    if (tankAt(cx * CS, cy * CS, self)) return 'busy';
    return 'free';
  }

  function chooseDir(e) {
    var cx = Math.round(e.x / CS), cy = Math.round(e.y / CS), cands = [], total = 0, d, st, w;
    for (d = 0; d < 4; d++) {
      st = cellState(cx + DX[d], cy + DY[d], e);
      if (st === 'wall' || st === 'busy') continue;
      w = 1;
      if (d === 2) w += 2.2 + stage * 0.1;                                   // head for the base
      if (d === 1 && cx < 6) w += 1.4; if (d === 3 && cx > 6) w += 1.4;      // drift towards the base column
      if (d === e.dir) w += 1.6;                                             // keep rolling
      if (d === (e.dir + 2) % 4) w *= 0.25;
      if (d === 0) w *= 0.5;
      if (st === 'brick') w *= 0.7;
      cands.push({ d: d, w: w, st: st }); total += w;
    }
    if (!cands.length) return null;
    var r = Math.random() * total;
    for (var i = 0; i < cands.length; i++) { r -= cands[i].w; if (r <= 0) return cands[i]; }
    return cands[cands.length - 1];
  }

  function enemyFire(e) {
    if (e.bullets >= 1) return;
    var k = KINDS[e.kind];
    bullets.push({ x: e.x + CS / 2 + DX[e.dir] * 7, y: e.y + CS / 2 + DY[e.dir] * 7, dir: e.dir, spd: k.bullet, owner: 'e', ref: e, star: 0 });
    e.bullets++;
    R.sfx.tone(520, 0.05, { vol: 0.04, slide: 260 });
    e.fireT = U.rand(k.fire[0], k.fire[1]) * Math.max(0.55, 1 - stage * 0.04);
  }

  function updateEnemy(e, dt) {
    var k = KINDS[e.kind];
    if (e.spawn > 0) { e.spawn -= dt; return; }
    if (e.hurt > 0) e.hurt -= dt;
    if (freezeT > 0) return;
    e.anim += dt;
    e.fireT -= dt;
    // shoot when lined up with the player or the base, or when chewing through a brick wall
    if (e.fireT <= 0.25 && e.bullets < 1) {
      var tx = player.alive ? player.x + CS / 2 : -99, ty = player.y + CS / 2, ex = e.x + CS / 2, ey = e.y + CS / 2;
      var lined = (e.dir % 2 === 0 && Math.abs(tx - ex) < 7 && ((e.dir === 0 && ty < ey) || (e.dir === 2 && ty > ey))) ||
        (e.dir % 2 === 1 && Math.abs(ty - ey) < 7 && ((e.dir === 1 && tx > ex) || (e.dir === 3 && tx < ex)));
      if (lined) e.fireT = Math.min(e.fireT, 0);
    }
    if (e.fireT <= 0) enemyFire(e);
    if (e.stall > 0) { e.stall -= dt; if (e.stall <= 0 || cellState(Math.round(e.x / CS) + DX[e.dir], Math.round(e.y / CS) + DY[e.dir], e) === 'free') { e.stall = 0; e.wait = 0; } else { if (e.bullets < 1 && e.fireT > 0.5) e.fireT = 0.3; return; } }
    if (!e.moving) {
      e.wait -= dt;
      if (e.wait > 0) return;
      var ch = chooseDir(e);
      if (!ch) { e.wait = 0.3; return; }
      e.dir = ch.d;
      if (ch.st === 'brick') { e.stall = 1.6; e.fireT = Math.min(e.fireT, 0.2); return; }
      e.tx = e.x + DX[e.dir] * CS; e.ty = e.y + DY[e.dir] * CS;
      if (tankAt(e.tx, e.ty, e)) { e.wait = 0.25; return; }      // someone is in the way; ask again shortly
      e.moving = true;
    }
    // glide to the target cell
    var step = k.speed * dt * (e.kind === 'armor' && e.hp < 3 ? 1 : 1);
    var dx = e.tx - e.x, dy = e.ty - e.y, dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= step) { e.x = e.tx; e.y = e.ty; e.moving = false; e.wait = Math.random() < 0.25 ? 0.25 : 0; }
    else {
      var nx = e.x + DX[e.dir] * step, ny = e.y + DY[e.dir] * step;
      // the player can drive into our path: stop until they move
      if (player.alive && player.spawn <= 0 && nx < player.x + CS && nx + CS > player.x && ny < player.y + CS && ny + CS > player.y) return;
      e.x = nx; e.y = ny;
    }
    e.frame = Math.floor(e.anim * 12) % 2;
  }

  function damageEnemy(e, b) {
    var cx = e.x + CS / 2, cy = e.y + CS / 2;
    if (e.carrier) { e.carrier = false; spawnPickup(); }
    e.hp--; e.hurt = 0.12;
    if (e.hp > 0) {
      R.sfx.tone(220, 0.08, { vol: 0.12, type: 'sawtooth', slide: 140 }); R.vibrate(10);
      R.fx.burst(cx, cy, { n: 6, color: [C.white, C.silver], speed: 55, life: 0.3, size: 1 });
      return;
    }
    enemies.splice(enemies.indexOf(e), 1);
    var k = KINDS[e.kind];
    R.addScore(k.score);
    boom(cx, cy, true); R.sfx.play('explode'); R.vibrate(25); R.fx.shake(1.5, 0.12);
    R.fx.burst(cx, cy, { n: 16, color: [C.orange, C.yellow, C.white, C.red], speed: 90, life: 0.55, gravity: 30 });
    R.fx.text(cx, cy - 10, '+' + k.score, C.yellow);
    killsTotal++;
    R.achieve('first-blood');
    if (e.kind === 'armor') R.achieve('heavy-metal');
    R.hud.extra = queue.length + enemies.length;
  }

  /* ---------------------------------------------------------------- pickups */
  function spawnPickup() {
    var tries = 40, x, y, kinds = ['S', 'S', 'H', 'F', 'L'], kind;
    kind = U.pick(kinds);
    if (kind === 'L' && R.lives >= 6) kind = 'S';
    while (tries--) {
      var cx = U.randInt(1, GW - 1), cy = U.randInt(4, GH - 3);
      x = cx * CS; y = cy * CS;
      if (cellState(cx, cy, null) === 'free' && !(Math.abs(player.x - x) < CS && Math.abs(player.y - y) < CS)) {
        pickups.push({ x: x, y: y, kind: kind, t: 14 });
        R.sfx.tone(1318, 0.06, { vol: 0.08 }); R.sfx.tone(1760, 0.1, { vol: 0.08, delay: 0.07 });
        return;
      }
    }
  }

  function takePickup(p) {
    var cx = p.x + CS / 2, cy = p.y + CS / 2;
    R.addScore(500); R.sfx.play('powerup'); R.vibrate(25);
    R.fx.burst(cx, cy, { n: 14, color: [PICK_ICONS[p.kind].col, C.white], speed: 80, life: 0.5 });
    if (p.kind === 'S') {
      starLevel = Math.min(3, starLevel + 1); starsGot++;
      R.fx.text(cx, cy - 10, starLevel >= 3 ? 'MAX POWER!' : 'POWER UP!', C.yellow);
      if (starLevel >= 3) R.achieve('full-power');
    } else if (p.kind === 'H') { shieldT = 10; R.fx.text(cx, cy - 10, 'SHIELD!', C.cyan); }
    else if (p.kind === 'L') { R.lives = Math.min(9, R.lives + 1); R.fx.text(cx, cy - 10, '1UP!', C.pink); }
    else { freezeT = 7; R.fx.text(cx, cy - 10, 'FREEZE!', '#7fd8ff'); R.fx.flash('#7fd8ff', 0.15); }
  }

  /* ---------------------------------------------------------------- player */
  function readDir() {
    var h = R.input.held, want = -1;
    var keys = ['up', 'right', 'down', 'left'];
    if (lastDir >= 0 && h[keys[lastDir]]) return lastDir;
    for (var d = 0; d < 4; d++) if (h[keys[d]]) want = d;
    return want;
  }

  // corner assist: if the tank is a few pixels off the 6px grid and would fit through the gap ahead, slide it into line
  function nudge(p, s) {
    var horiz = p.dir % 2 === 1, cur = horiz ? p.y : p.x, lo = Math.floor(cur / SS) * SS, cands = [lo, lo + SS], i;
    cands.sort(function (a, b) { return Math.abs(a - cur) - Math.abs(b - cur); });
    for (i = 0; i < cands.length; i++) {
      var d = cands[i] - cur;
      if (Math.abs(d) < 0.001 || Math.abs(d) > 5.01) continue;
      var tx = horiz ? p.x : cands[i], ty = horiz ? cands[i] : p.y;
      if (!rectFree(tx, ty, p) || !rectFree(tx + DX[p.dir] * s, ty + DY[p.dir] * s, p)) continue;
      var m = Math.min(s, Math.abs(d)) * (d < 0 ? -1 : 1);
      if (horiz) p.y += m; else p.x += m;
      return true;
    }
    return false;
  }

  function playerFire() {
    var mine = 0, i;
    for (i = 0; i < bullets.length; i++) if (bullets[i].owner === 'p') mine++;
    if (mine >= (starLevel >= 2 ? 2 : 1)) return;
    bullets.push({ x: player.x + CS / 2 + DX[player.dir] * 7, y: player.y + CS / 2 + DY[player.dir] * 7, dir: player.dir, spd: starLevel >= 1 ? 220 : 140, owner: 'p', ref: null, star: starLevel });
    R.sfx.play('shoot'); player.fireCd = 0.12;
  }

  function killPlayer() {
    var cx = player.x + CS / 2, cy = player.y + CS / 2;
    player.alive = false; starLevel = 0;
    boom(cx, cy, true); R.sfx.play('explode'); R.vibrate(120); R.fx.shake(4, 0.35); R.fx.flash(C.white, 0.12);
    R.fx.burst(cx, cy, { n: 24, color: [C.yellow, C.orange, C.white, C.red], speed: 110, life: 0.7, gravity: 40 });
    R.lives--;
    if (R.lives <= 0) { phase = 'dead'; phaseT = 1.3; }
    else player.respawn = 1.3;
  }

  function placePlayer() {
    player.x = P_START[0] * CS; player.y = P_START[1] * CS; player.dir = 0; player.alive = true; player.spawn = 0; player.respawn = 0;
    player.moving = false; player.fireCd = 0; shieldT = 3;
    // push enemies out of the way if one is parked on the spawn cell
    for (var i = 0; i < enemies.length; i++) { var e = enemies[i]; if (Math.abs(e.x - player.x) < CS && Math.abs(e.y - player.y) < CS) damageEnemy(e, null); }
  }

  function updatePlayer(dt) {
    var p = player;
    if (!p.alive) {
      if (p.respawn > 0) { p.respawn -= dt; if (p.respawn <= 0) placePlayer(); }
      return;
    }
    if (shieldT > 0) shieldT -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;
    var want = readDir();
    p.moving = false;
    if (want >= 0) {
      if (want !== p.dir) {
        if ((want & 1) !== (p.dir & 1)) {                       // turning onto the other axis: line up with the 6px grid
          if (want & 1) { var ny = Math.round(p.y / SS) * SS; if (rectFree(p.x, ny, p)) p.y = ny; }
          else { var nx = Math.round(p.x / SS) * SS; if (rectFree(nx, p.y, p)) p.x = nx; }
        }
        p.dir = want;
      }
      var remaining = 52 * dt;
      while (remaining > 0.0001) {
        var s = Math.min(1, remaining); remaining -= s;
        var nx2 = p.x + DX[p.dir] * s, ny2 = p.y + DY[p.dir] * s;
        if (rectFree(nx2, ny2, p)) { p.x = nx2; p.y = ny2; p.moving = true; }
        else if (nudge(p, s)) p.moving = true;
        else break;
      }
      if (p.moving) { p.anim += dt; if (Math.floor(p.anim * 8) !== p.lastTick) { p.lastTick = Math.floor(p.anim * 8); if (p.lastTick % 3 === 0) R.sfx.tone(70, 0.05, { vol: 0.035, type: 'triangle' }); } }
    }
    if (R.input.held.a && p.fireCd <= 0) playerFire();
    // pickups
    for (var i = pickups.length - 1; i >= 0; i--) {
      var pk = pickups[i];
      if (p.x < pk.x + CS && p.x + CS > pk.x && p.y < pk.y + CS && p.y + CS > pk.y) { pickups.splice(i, 1); takePickup(pk); }
    }
  }

  /* ---------------------------------------------------------------- bullets */
  function destroyBricks(b, sx, sy, breakSteel) {
    var hit = false, a, cells = [];
    if (DY[b.dir] !== 0) { var x0 = sx & ~1; cells = [[x0, sy], [x0 + 1, sy]]; }
    else { var y0 = sy & ~1; cells = [[sx, y0], [sx, y0 + 1]]; }
    for (a = 0; a < cells.length; a++) {
      var cx = cells[a][0], cy = cells[a][1], v = getT(cx, cy);
      if (v === BRICK || (v === STEEL && breakSteel)) {
        T[cy * SW + cx] = EMPTY; tctx.clearRect(cx * SS, cy * SS, SS, SS); hit = true;
        R.fx.burst(cx * SS + 3, cy * SS + 3, { n: 2, color: v === BRICK ? ['#c8502c', '#7a2a14', '#e07a52'] : ['#a7b0c4', '#e6ecf8'], speed: 45, life: 0.4, gravity: 120, size: 2 });
      }
    }
    return hit;
  }

  function killBullet(i, spark) {
    var b = bullets[i];
    if (spark) R.fx.burst(b.x, b.y, { n: 4, color: [C.yellow, C.white, C.orange], speed: 50, life: 0.25, size: 1 });
    if (b.owner === 'e' && b.ref) b.ref.bullets = Math.max(0, b.ref.bullets - 1);
    bullets.splice(i, 1);
  }

  function updateBullets(dt) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i], n = Math.max(1, Math.ceil(b.spd * dt / 1.5)), ds = b.spd * dt / n, dead = false;
      for (var k = 0; k < n && !dead; k++) {
        b.x += DX[b.dir] * ds; b.y += DY[b.dir] * ds;
        if (b.x < 0 || b.y < 0 || b.x >= FW || b.y >= FH) { R.fx.burst(Math.min(FW - 1, Math.max(0, b.x)), Math.min(FH - 1, Math.max(0, b.y)), { n: 3, color: [C.white, C.silver], speed: 40, life: 0.2, size: 1 }); dead = true; break; }
        var sx = Math.floor((b.x + DX[b.dir]) / SS), sy = Math.floor((b.y + DY[b.dir]) / SS), v = getT(sx, sy);
        if (v === BRICK) { destroyBricks(b, sx, sy, false); R.sfx.tone(160, 0.05, { vol: 0.08, type: 'square' }); dead = true; break; }
        if (v === STEEL) {
          if (b.owner === 'p' && b.star >= 3) { destroyBricks(b, sx, sy, true); R.sfx.tone(300, 0.06, { vol: 0.1 }); }
          else R.sfx.tone(1700, 0.04, { vol: 0.06 });
          dead = true; break;
        }
        if (hq.alive && b.x > HQ_X && b.x < HQ_X + CS && b.y > HQ_Y && b.y < HQ_Y + CS) {
          if (b.owner === 'e') destroyHq(); else R.fx.burst(b.x, b.y, { n: 3, color: [C.yellow, C.white], speed: 40, life: 0.2, size: 1 });      // your own shells are harmless to your base
          dead = true; break;
        }
        if (b.owner === 'p') {
          for (var j = 0; j < enemies.length; j++) {
            var e = enemies[j];
            if (e.spawn > 0) continue;
            if (b.x > e.x && b.x < e.x + CS && b.y > e.y && b.y < e.y + CS) { damageEnemy(e, b); dead = true; break; }
          }
        } else if (player.alive && b.x > player.x && b.x < player.x + CS && b.y > player.y && b.y < player.y + CS) {
          if (shieldT > 0) { R.sfx.tone(900, 0.05, { vol: 0.07 }); R.fx.burst(b.x, b.y, { n: 4, color: [C.cyan, C.white], speed: 50, life: 0.25, size: 1 }); }
          else killPlayer();
          dead = true; break;
        }
        if (!dead) {                                  // bullets cancel each other out
          for (var m = bullets.length - 1; m >= 0; m--) {
            var o = bullets[m];
            if (m === i || o.owner === b.owner) continue;
            if (Math.abs(o.x - b.x) < 3 && Math.abs(o.y - b.y) < 3) { R.fx.burst(b.x, b.y, { n: 5, color: [C.white, C.yellow], speed: 50, life: 0.25, size: 1 }); R.sfx.tone(800, 0.04, { vol: 0.06 }); killBullet(m, false); if (m < i) i--; dead = true; break; }
          }
        }
      }
      if (dead) killBullet(i, false);
    }
  }

  function destroyHq() {
    hq.alive = false; hq.dead = 0;
    var cx = HQ_X + CS / 2, cy = HQ_Y + CS / 2;
    boom(cx, cy, true); R.sfx.play('explode'); R.vibrate(150); R.fx.shake(5, 0.5); R.fx.flash(C.red, 0.2);
    R.fx.burst(cx, cy, { n: 30, color: [C.yellow, C.orange, C.white, C.red], speed: 120, life: 0.8, gravity: 30 });
    R.fx.text(FW / 2, 140, 'BASE DESTROYED!', C.red);
    phase = 'dead'; phaseT = 1.6;
  }

  /* ---------------------------------------------------------------- stages */
  function startStage(n) {
    stage = n; R.level = n;
    mapIdx = (n - 1) % MAPS.length;
    loadMap(mapIdx);
    hq = { alive: true, dead: 0 };
    enemies = []; bullets = []; pickups = []; booms = [];
    queue = buildQueue(n); spawnT = 1.2; spawnIdx = 1; freezeT = 0;
    phase = 'intro'; phaseT = 1.4; bannerT = 0;
    R.hud.extra = queue.length;
    if (n >= 3) R.achieve('wave3');
  }

  function nextStage() {
    var keepLives = R.lives, keepStar = starLevel;
    startStage(stage + 1);
    R.lives = keepLives; starLevel = keepStar;
    placePlayer();
    shieldT = 4;
  }

  /* ---------------------------------------------------------------- drawing */
  function drawTank(ctx, body, tread, dir, frame, x, y) {
    R.draw.sprite(ctx, tankSprite(body, tread, dir, frame), Math.round(x), Math.round(y));
  }

  function drawSpawnStar(ctx, e) {
    var t = 1 - e.spawn / 0.9, cx = e.x + CS / 2, cy = e.y + CS / 2, r = 2 + Math.abs(Math.sin(t * Math.PI * 4)) * 5;
    ctx.fillStyle = Math.floor(t * 12) % 2 ? '#ffffff' : '#7fd8ff';
    ctx.fillRect(Math.round(cx - 1), Math.round(cy - r), 2, Math.round(r * 2)); ctx.fillRect(Math.round(cx - r), Math.round(cy - 1), Math.round(r * 2), 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(cx - 2), Math.round(cy - 2), 4, 4);
  }

  function drawTerrainTop(ctx) {
    var i, w, f;
    // water
    var ph = Math.floor(R.time * 3) % 2;
    for (i = 0; i < waters.length; i++) {
      w = waters[i];
      var x = w[0] * SS, y = w[1] * SS;
      ctx.fillStyle = '#1d5fc4'; ctx.fillRect(x, y, SS, SS);
      ctx.fillStyle = '#5da8ff';
      if (((w[0] + w[1] + ph) & 1) === 0) { ctx.fillRect(x + 1, y + 1, 3, 1); ctx.fillRect(x + 3, y + 4, 2, 1); } else { ctx.fillRect(x + 2, y + 2, 3, 1); ctx.fillRect(x, y + 4, 2, 1); }
    }
  }
  function drawForest(ctx) {
    for (var i = 0; i < forests.length; i++) {
      var f = forests[i], x = f[0] * SS, y = f[1] * SS;
      ctx.fillStyle = '#157a35'; ctx.fillRect(x, y, SS, SS);
      ctx.fillStyle = '#35c85e'; ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillRect(x + 4, y + 3, 2, 2);
      ctx.fillStyle = '#0c5424'; ctx.fillRect(x + 3, y, 2, 2); ctx.fillRect(x, y + 4, 2, 2);
    }
  }

  function drawPickup(ctx, p) {
    var ic = PICK_ICONS[p.kind];
    if (p.t < 4 && Math.floor(R.time * 8) % 2) return;
    var bob = Math.floor(R.time * 4) % 2;
    ctx.fillStyle = '#10131c'; ctx.fillRect(p.x, p.y, CS, CS);
    ctx.fillStyle = ic.col; ctx.fillRect(p.x, p.y, CS, 1); ctx.fillRect(p.x, p.y + CS - 1, CS, 1); ctx.fillRect(p.x, p.y, 1, CS); ctx.fillRect(p.x + CS - 1, p.y, 1, CS);
    R.draw.sprite(ctx, ic.rows, p.x + 1, p.y + 1 - bob * 0 + (bob ? 0 : 0), { palette: PICK_PAL });
    if (bob) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(p.x + 1, p.y + 1, CS - 2, CS - 2); }
  }

  function drawChips(ctx) {
    var x = 2, y = 302, i;
    for (i = 0; i < starLevel; i++) R.draw.sprite(ctx, PICK_ICONS.S.rows, x + i * 9, y, { palette: PICK_PAL, scale: 1 });
    if (starLevel) { /* stars drawn at 10x10; shrink look by drawing small */ }
    if (shieldT > 0) R.draw.text(ctx, 'SH' + Math.ceil(shieldT), 2, 292, { size: 6, color: '#3de2ff' });
    if (freezeT > 0) R.draw.text(ctx, 'FZ' + Math.ceil(freezeT), 22, 292, { size: 6, color: '#7fd8ff' });
  }

  R.game({
    layout: 'classic', size: [FW, FH], bg: '#10131c', music: 'action', levelLabel: 'WAVE',

    init: function () {
      terr = document.createElement('canvas'); terr.width = FW; terr.height = FH; tctx = terr.getContext('2d');
    },

    reset: function () {
      player = { x: 0, y: 0, dir: 0, alive: true, spawn: 0, respawn: 0, moving: false, fireCd: 0, anim: 0, lastTick: 0 };
      starLevel = 0; starsGot = 0; shieldT = 0; freezeT = 0; killsTotal = 0; lastDir = -1; tick = 0;
      R.lives = 3; R.hud.extraLabel = 'ENEMY';
      startStage(1);
      placePlayer(); shieldT = 3;
      // show the first wave on the READY screen, frozen in place until the intro ends
      for (var k = 0; k < 3; k++) { var item = queue.shift(); var e = makeEnemy(item, SPAWNS[k][0], SPAWNS[k][1], false); enemies.push(e); }
      spawnIdx = 0; R.hud.extra = queue.length + enemies.length;
    },

    onPress: function (b) {
      var m = { up: 0, right: 1, down: 2, left: 3 };
      if (b in m) lastDir = m[b];
    },

    update: function (dt) {
      var i;
      tick += dt;
      if (!R.input.held.up && !R.input.held.right && !R.input.held.down && !R.input.held.left) lastDir = -1;
      for (i = booms.length - 1; i >= 0; i--) { booms[i].t += dt; if (booms[i].t > booms[i].max) booms.splice(i, 1); }
      if (phase === 'intro') {
        phaseT -= dt; bannerT += dt;
        updatePlayer(dt);
        if (phaseT <= 0) phase = 'play';
        return;
      }
      if (phase === 'dead') {
        phaseT -= dt; updateBullets(dt);
        if (phaseT <= 0) R.gameOver();
        return;
      }
      if (phase === 'clear') {
        phaseT -= dt; updatePlayer(dt); updateBullets(dt);
        if (phaseT <= 0) nextStage();
        return;
      }
      if (freezeT > 0) freezeT -= dt;
      updatePlayer(dt);
      for (i = enemies.length - 1; i >= 0; i--) if (enemies[i]) updateEnemy(enemies[i], dt);
      updateBullets(dt);
      for (i = pickups.length - 1; i >= 0; i--) { pickups[i].t -= dt; if (pickups[i].t <= 0) pickups.splice(i, 1); }
      // spawn the next enemy
      if (queue.length && freezeT <= 0) {
        spawnT -= dt;
        if (spawnT <= 0 && enemies.length < maxActive()) { if (trySpawn()) spawnT = Math.max(1.1, 2.8 - stage * 0.12); else spawnT = 0.4; R.hud.extra = queue.length + enemies.length; }
      }
      if (!queue.length && !enemies.length && phase === 'play') {
        phase = 'clear'; phaseT = 2.0;
        var bonus = 500 + 100 * stage;
        R.addScore(bonus); R.sfx.play('win'); R.fx.text(FW / 2, 120, 'WAVE ' + stage + ' CLEARED!', C.yellow); R.fx.text(FW / 2, 136, '+' + bonus, C.white);
      }
    },

    render: function (ctx) {
      var i, e, x, y;
      // ground: subtle checker
      for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) { ctx.fillStyle = (x + y) & 1 ? '#161b27' : '#131824'; ctx.fillRect(x * CS, y * CS, CS, CS); }
      ctx.drawImage(terr, 0, 0);
      drawTerrainTop(ctx);
      // base
      if (hq.alive) R.draw.sprite(ctx, HQ_ALIVE, HQ_X, HQ_Y, { palette: HQ_PAL });
      else R.draw.sprite(ctx, HQ_DEAD, HQ_X, HQ_Y, { palette: HQ_DEAD_PAL });
      for (i = 0; i < pickups.length; i++) drawPickup(ctx, pickups[i]);
      // enemies
      for (i = 0; i < enemies.length; i++) {
        e = enemies[i];
        if (e.spawn > 0) { drawSpawnStar(ctx, e); continue; }
        var k = KINDS[e.kind], body = e.kind === 'armor' ? ARMOR_BODY[Math.max(1, e.hp)] : k.body;
        if (e.carrier && Math.floor(R.time * 6) % 2) body = '#ff77a8';
        if (e.hurt > 0) body = '#ffffff';
        drawTank(ctx, body, k.tread, e.dir, e.frame, e.x, e.y);
        if (freezeT > 0) { ctx.fillStyle = 'rgba(160,225,255,.45)'; ctx.fillRect(Math.round(e.x), Math.round(e.y), CS, CS); }
      }
      // player
      if (player.alive) {
        var blink = shieldT > 0 && shieldT < 1.2 && Math.floor(R.time * 12) % 2;
        drawTank(ctx, PLAYER_BODY[starLevel], '#6b4a12', player.dir, Math.floor(player.anim * 12) % 2, player.x, player.y);
        if (shieldT > 0 && !blink) {
          var a = R.time * 8;
          ctx.strokeStyle = 'rgba(80,230,255,.9)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(player.x + 6, player.y + 6, 9, a, a + 4.2); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(player.x + 6, player.y + 6, 9, a + 3.1, a + 5.8); ctx.stroke();
        }
      }
      drawForest(ctx);
      // bullets
      for (i = 0; i < bullets.length; i++) {
        var b = bullets[i], bx = Math.round(b.x), by = Math.round(b.y);
        if (b.owner === 'p') { ctx.fillStyle = b.star >= 1 ? '#ffec27' : '#fff1e8'; ctx.fillRect(bx - 1, by - 1, 3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, 1, 1);
          ctx.fillStyle = 'rgba(255,236,39,.35)'; ctx.fillRect(bx - 1 - DX[b.dir] * 3, by - 1 - DY[b.dir] * 3, 3, 3); }
        else { ctx.fillStyle = '#ff8a3a'; ctx.fillRect(bx - 1, by - 1, 3, 3); ctx.fillStyle = '#ffe0a0'; ctx.fillRect(bx, by, 1, 1); }
      }
      // explosions
      for (i = 0; i < booms.length; i++) {
        var bm = booms[i], f = bm.t / bm.max, r = bm.r * Math.min(1, f * 1.6 + 0.2);
        ctx.globalAlpha = 1 - f;
        R.draw.circle(ctx, bm.x, bm.y, r, '#ff8a1c'); R.draw.circle(ctx, bm.x, bm.y, r * 0.7, '#ffd23a'); R.draw.circle(ctx, bm.x, bm.y, r * 0.35, '#ffffff');
        ctx.globalAlpha = 1;
      }
      if (!hq.alive) { ctx.fillStyle = 'rgba(160,160,170,.4)'; var sm = Math.floor(R.time * 6) % 3; ctx.fillRect(HQ_X + 3 + sm, HQ_Y - 3 - sm * 2, 3, 3); ctx.fillRect(HQ_X + 7 - sm, HQ_Y - 7 - sm * 2, 2, 2); }
      drawChips(ctx);
      if (phase === 'intro' && R.mode === 'play') {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, FH / 2 - 14, FW, 28);
        R.draw.text(ctx, 'WAVE ' + stage, FW / 2, FH / 2 - 8, { size: 8, color: '#ffa300', align: 'center' });
        R.draw.text(ctx, MAPS[mapIdx].name, FW / 2, FH / 2 + 3, { size: 6, color: '#c8d4ee', align: 'center' });
      }
    }
  });
})();
