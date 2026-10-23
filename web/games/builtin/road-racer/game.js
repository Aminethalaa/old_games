/* Road Racer — top-down traffic dodging with nitro, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 160, H = 320;
  var LANES = 4, LANE_W = 30, ROAD_X = 20, ROAD_W = LANES * LANE_W, CURB = 4;
  var PLAYER_Y = 244, CAR_W = 22;
  var LEVEL_PTS = 400;                       // distance points per level

  /* ---------------------------------------------------------------- sprites */
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  // 11 px wide top-down cars (front at the top). B body, L highlight, D roof, G/g glass, T tyre, H headlight, R tail light, S stripe
  var SEDAN = [
    '...BBBBB...',
    '..BBBBBBB..',
    '.HBBLLLBBH.',
    'TBBBBBBBBBT',
    'TBBGGGGGBBT',
    'TBgGGGGGgBT',
    '.BDDDDDDDB.',
    '.BDDLLLDDB.',
    '.BDDDDDDDB.',
    'TBBgGGGgBBT',
    'TBBBBBBBBBT',
    '.BBBLLLBBB.',
    '.BBBBBBBBB.',
    '.RBBBBBBBR.',
    '..BBBBBBB..'];
  var SPORT = [
    '...BBBBB...',
    '..BLLLLLB..',
    '.HBBBBBBBH.',
    'TBBBBBBBBBT',
    'TBGGGGGGGBT',
    'TBgGGGGGgBT',
    '.BDDDDDDDB.',
    'TBBgGGGgBBT',
    'TBBBBBBBBBT',
    '.BBLLLLLBB.',
    '.RBBBBBBBR.',
    '.BBBBBBBBB.',
    '..BBBBBBB..'];
  var VAN = [
    '..BBBBBBB..',
    '.BBBBBBBBB.',
    '.HBBBBBBBH.',
    'TBGGGGGGGBT',
    'TBGGGGGGGBT',
    'TBBBBBBBBBT',
    '.BLLLLLLLB.',
    '.BLDDDDDLB.',
    '.BLDDDDDLB.',
    '.BLLLLLLLB.',
    'TBLDDDDDLBT',
    'TBLDDDDDLBT',
    '.BLLLLLLLB.',
    '.BBBBBBBBB.',
    'TBBBBBBBBBT',
    'TBBBBBBBBBT',
    '.RBBBBBBBR.',
    '.BBBBBBBBB.',
    '..BBBBBBB..'];
  var TRUCK = [
    '..BBBBBBB..',
    '.BBBBBBBBB.',
    '.HBBBBBBBH.',
    'TBGGGGGGGBT',
    'TBGGGGGGGBT',
    'TBBBBBBBBBT',
    'TBBBBBBBBBT',
    '..KKKKKKK..',
    '.CCCCCCCCC.',
    '.CcCCCCCcC.',
    '.CcCCCCCcC.',
    '.CCCCCCCCC.',
    '.CcCCCCCcC.',
    '.CcCCCCCcC.',
    'TCCCCCCCCCT',
    'TCcCCCCCcCT',
    'TCcCCCCCcCT',
    '.CCCCCCCCC.',
    '.CcCCCCCcC.',
    '.CCCCCCCCC.',
    'TCCCCCCCCCT',
    'TCCCCCCCCCT',
    '.RCCCCCCCR.',
    '..CCCCCCC..'];
  function striped(rows) {
    return rows.map(function (r, i) {
      if (i < 4 || (i > 8 && i < rows.length - 1)) { var a = r.split(''); if (a[5] === 'B' || a[5] === 'L') a[5] = 'S'; if (a[4] === 'L' || a[6] === 'L') { a[4] = a[4] === 'L' ? 'S' : a[4]; a[6] = a[6] === 'L' ? 'S' : a[6]; } return a.join(''); }
      return r;
    });
  }
  function carPal(body) {
    return { B: body, L: shade(body, 0.38), D: shade(body, -0.28), G: '#a8e6ff', g: '#4a7c9c', T: '#12141c', H: '#fff6b0', R: '#ff2d2d', S: '#ffffff', K: '#1a1c26', C: '#dfe3ee', c: '#98a1b8' };
  }
  var ENEMY_COLORS = ['#ff004d', '#ffa300', '#ffec27', '#00e436', '#b455ff', '#ff77a8', '#2b7bff', '#e8e8f0'];
  var TYPES = [
    { name: 'sedan', rows: SEDAN, w: 0.45 }, { name: 'sport', rows: SPORT, w: 0.25 },
    { name: 'van', rows: VAN, w: 0.18 }, { name: 'truck', rows: TRUCK, w: 0.12 }];
  var sprites = {}, playerSpr, playerSprDark;

  var COIN_SPR_PAL = { Y: '#ffec27', O: '#ffa300', W: '#fff6b0' };
  var FUEL = [
    '...DDDD...',
    '...DBBD...',
    '.DDDDDDDD.',
    '.DBBBBBBD.',
    '.DBBBYBBD.',
    '.DBBYYBBD.',
    '.DBYYYYBD.',
    '.DBBBYYBD.',
    '.DBBYYBBD.',
    '.DBBYBBBD.',
    '.DBBBBBBD.',
    '.DDDDDDDD.'];
  var FUEL_PAL = { D: '#1c5fa8', B: '#29adff', Y: '#ffec27' };

  /* scenery sprites, one set per theme */
  var TREE = [
    '...GGGG...',
    '..GGLLGG..',
    '.GGLLGGGG.',
    '.GLLGGGGD.',
    'GGGGGGGDDG',
    'GGGGGGDDDG',
    '.GGGGDDDG.',
    '.GDDDDDG..',
    '...BBB....',
    '...BB.....'];
  var TREE_PAL = { G: '#1f9d45', L: '#4fdc6a', D: '#106a30', B: '#7a4a2a' };
  var CACTUS = [
    '....GG....',
    '...GGGG...',
    '.GG.GGLG..',
    '.GG.GGLG.G',
    '.GGGGGLG.G',
    '...GGGLGGG',
    '...GGGLG..',
    '...GGGLG..',
    '...GGGLG..',
    '...DDDDD..'];
  var CACTUS_PAL = { G: '#3b9a3b', L: '#6fd06a', D: '#8a5a2a' };
  var PINE = [
    '....WW....',
    '...GGGG...',
    '..GGWGGG..',
    '...GGGG...',
    '..GGGWGG..',
    '.GGWGGGGG.',
    '...GGGG...',
    '.GGGGWGGG.',
    'GGWGGGGGGG',
    '....BB....'];
  var PINE_PAL = { G: '#17663a', W: '#f4faff', B: '#6a4226' };
  var THEMES = [
    { name: 'GRASS', ground: '#16692f', speck: '#1e8a3d', road: '#2b2f3d', tree: TREE, pal: TREE_PAL },
    { name: 'DESERT', ground: '#c99a4c', speck: '#e0b366', road: '#35323a', tree: CACTUS, pal: CACTUS_PAL },
    { name: 'SNOW', ground: '#dbe6f5', speck: '#ffffff', road: '#3a3f50', tree: PINE, pal: PINE_PAL }
  ];

  /* ---------------------------------------------------------------- state */
  var lane, px, py, speed, base, scroll, dist, distPts, spawnAcc, safe, nextSafe, cars, picks, scenery, sceneAcc;
  var nitro, nitroT, nitroUses, invul, dying, coins, closeCalls, swerveLane, swerveT;

  function laneX(l) { return ROAD_X + LANE_W * l + LANE_W / 2; }
  function themeIdx() { return Math.floor((R.level - 1) / 3) % THEMES.length; }
  function baseSpeed() { return Math.min(330, 112 + (R.level - 1) * 22); }
  function trafficSpeed() { return Math.max(0, speed - base * 0.36); }     // how fast the traffic slides down the screen
  function waveGap() { return 100 + speed * 0.46; }

  function pickType() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < TYPES.length; i++) { acc += TYPES[i].w; if (r < acc) return TYPES[i]; }
    return TYPES[0];
  }

  function spawnCar(l) {
    var t = pickType(), col = U.pick(ENEMY_COLORS), key = t.name + col;
    if (!sprites[key]) sprites[key] = R.sprite(t.rows, carPal(col), 2);
    var h = t.rows.length * 2;
    cars.push({ lane: l, x: laneX(l), y: -h - 4, w: CAR_W, h: h, spr: sprites[key], passed: false, type: t.name });
  }

  function waveCars() {
    var l = R.level, r = Math.random();
    if (l < 3) return r < 0.35 ? 2 : 1;
    if (l < 6) return r < 0.6 ? 2 : 1;
    if (l < 9) return r < 0.3 ? 3 : 2;
    return r < 0.5 ? 3 : 2;
  }

  function spawnWave() {
    safe = nextSafe;
    nextSafe = U.clamp(safe + U.randInt(-1, 2), 0, LANES - 1);
    var others = [], i;
    for (i = 0; i < LANES; i++) if (i !== safe) others.push(i);
    U.shuffle(others);
    var n = Math.min(waveCars(), LANES - 1);
    for (i = 0; i < n; i++) spawnCar(others[i]);
    // pickups hang half-way between this wave and the next, in the lane that is free next time
    if (Math.random() < 0.5) {
      var gap = waveGap(), y0 = -50 - gap * 0.5;
      if (Math.random() < 0.18) picks.push({ kind: 'fuel', lane: nextSafe, x: laneX(nextSafe), y: y0 });
      else for (i = 0; i < 3; i++) picks.push({ kind: 'coin', lane: nextSafe, x: laneX(nextSafe), y: y0 - i * 22 });
    }
  }

  function spawnScenery() {
    var th = THEMES[themeIdx()], left = Math.random() < 0.5;
    scenery.push({ x: left ? U.randInt(1, 6) : W - U.randInt(11, 16), y: -14, spr: th.tree, pal: th.pal, flip: Math.random() < 0.5 });
  }

  function burst(x, y, cols, n, sp) { R.fx.burst(x, y, { n: n, color: cols, speed: sp || 90, life: 0.6, gravity: 40 }); }

  function crash(car) {
    R.lives--;
    R.sfx.play('explode'); R.vibrate(120); R.fx.shake(5, 0.4); R.fx.flash(C.white, 0.14);
    burst(px, py + 14, [C.orange, C.yellow, C.red, C.white], 26, 130);
    if (car) { burst(car.x, car.y + car.h / 2, [C.orange, C.yellow, C.red, C.dgray], 18, 110); cars.splice(cars.indexOf(car), 1); }
    nitroT = 0;
    if (R.lives <= 0) { dying = { t: 0 }; return; }
    invul = 2.4; speed = base * 0.5;
    R.fx.text(W / 2, 150, R.lives + (R.lives === 1 ? ' LIFE LEFT' : ' LIVES LEFT'), C.pink);
  }

  function addCoin(x, y) {
    coins++;
    R.addScore(50); nitro = Math.min(1, nitro + 0.04);
    R.sfx.play('coin'); R.vibrate(8);
    burst(x, y, [C.yellow, C.white], 8, 60);
    R.fx.text(x, y - 8, '+50', C.yellow);
    if (coins >= 10) R.achieve('coins10');
  }

  /* ---------------------------------------------------------------- update */
  function update(dt) {
    var held = R.input.held, i, c;
    if (dying) { dying.t += dt; if (dying.t > 1.1) R.gameOver(); scroll += speed * dt * 0.1; return; }
    base = baseSpeed();
    // lanes
    if (swerveT > 0) swerveT -= dt;
    if (R.input.rep('left', 200, 130) && lane > 0) { swerveLane = lane; swerveT = 0.9; lane--; R.sfx.play('move'); }
    if (R.input.rep('right', 200, 130) && lane < LANES - 1) { swerveLane = lane; swerveT = 0.9; lane++; R.sfx.play('move'); }
    px += U.clamp(laneX(lane) - px, -330 * dt, 330 * dt);
    // nitro
    if (R.input.pressed('a') && nitroT <= 0 && nitro >= 0.3) {
      nitro -= 0.3; nitroT = 1.5; nitroUses++;
      R.sfx.play('jump'); R.vibrate(30); R.fx.shake(1.5, 0.2);
      if (nitroUses >= 3) R.achieve('nitro3');
    }
    if (nitroT > 0) nitroT -= dt; else nitro = Math.min(1, nitro + dt * 0.075);
    // speed
    var mul = 1 + (held.up ? 0.3 : 0) - (held.down ? 0.42 : 0);
    if (nitroT > 0) mul *= 1.65;
    speed += (base * mul - speed) * Math.min(1, dt * 2.4);
    var targetY = PLAYER_Y - (nitroT > 0 ? 8 : held.up ? 6 : 0) + (held.down ? 7 : 0);
    py += (targetY - py) * Math.min(1, dt * 6);
    R.hud.extra = Math.round(speed * 0.7);
    // distance & level
    scroll += speed * dt; dist += speed * dt;
    var pts = Math.floor(dist / 12);
    if (pts > distPts) { R.addScore(pts - distPts); distPts = pts; }
    var lvl = 1 + Math.floor(distPts / LEVEL_PTS);
    if (lvl > R.level) {
      R.level = lvl;
      R.sfx.play('powerup'); R.fx.text(W / 2, 120, 'LEVEL ' + lvl, C.yellow);
      if (themeIdx() !== Math.floor((lvl - 2) / 3) % THEMES.length) R.fx.text(W / 2, 136, THEMES[themeIdx()].name + ' ROAD', C.cyan);
      else R.fx.text(W / 2, 136, 'SPEED UP!', C.red);
      if (lvl >= 5) R.achieve('level5');
    }
    // traffic
    var vy = trafficSpeed();
    spawnAcc += vy * dt;
    if (spawnAcc >= waveGap()) { spawnAcc = 0; spawnWave(); }
    sceneAcc += speed * dt;
    if (sceneAcc >= 46) { sceneAcc = 0; spawnScenery(); }
    if (invul > 0) invul -= dt;
    var hb = { x: px - 8, y: py + 4, w: 16, h: 22 };
    for (i = cars.length - 1; i >= 0; i--) {
      c = cars[i]; c.y += vy * dt;
      if (c.y > H + 10) { cars.splice(i, 1); continue; }
      var box = { x: c.x - 8, y: c.y + 3, w: 16, h: c.h - 6 };
      if (invul <= 0 && U.overlap(hb, box)) { crash(c); if (dying) return; continue; }
      if (!c.passed && c.y + c.h / 2 > py + 15) {
        c.passed = true;
        var dx = Math.abs(c.x - px);
        if (swerveT > 0 && c.lane === swerveLane && dx > 12 && dx < 40) {      // swerved out of its way just in time
          closeCalls++; R.addScore(10); nitro = Math.min(1, nitro + 0.02);
          R.fx.text(px, py - 6, 'CLOSE +10', C.cyan); R.sfx.tone(1100, 0.04, { vol: 0.07 });
          if (closeCalls >= 5) R.achieve('close5');
        }
      }
    }
    for (i = picks.length - 1; i >= 0; i--) {
      var p = picks[i]; p.y += vy * dt;
      if (p.y > H + 10) { picks.splice(i, 1); continue; }
      if (Math.abs(p.x - px) < 14 && Math.abs(p.y - (py + 15)) < 16) {
        picks.splice(i, 1);
        if (p.kind === 'coin') addCoin(p.x, p.y);
        else {
          nitro = Math.min(1, nitro + 0.5); R.addScore(100);
          R.sfx.play('powerup'); R.vibrate(15);
          burst(p.x, p.y, [C.blue, C.cyan, C.white], 14, 90); R.fx.text(p.x, p.y - 8, 'FUEL +100', C.cyan);
        }
      }
    }
    for (i = scenery.length - 1; i >= 0; i--) { scenery[i].y += speed * dt; if (scenery[i].y > H + 4) scenery.splice(i, 1); }
    // exhaust / nitro flames
    if (nitroT > 0) {
      R.fx.burst(px - 6, py + 27, { n: 1, color: [C.orange, C.yellow, C.white], speed: 40, life: 0.25, size: 2 });
      R.fx.burst(px + 6, py + 27, { n: 1, color: [C.orange, C.yellow, C.cyan], speed: 40, life: 0.25, size: 2 });
    }
  }

  /* ---------------------------------------------------------------- drawing */
  function drawGround(ctx) {
    var th = THEMES[themeIdx()];
    ctx.fillStyle = th.ground; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = th.speck;
    var off = scroll % 40, i, j;
    for (j = -1; j < 9; j++) for (i = 0; i < 2; i++) {
      var y = Math.round(j * 40 + off + ((i * 17) % 23)), x = i ? W - 12 + ((j * 7) & 3) : 4 + ((j * 5) & 3);
      ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + 5, y + 9, 1, 1); ctx.fillRect(x + 2, y + 21, 2, 1);
    }
  }

  function drawRoad(ctx) {
    var th = THEMES[themeIdx()], i;
    ctx.fillStyle = th.road; ctx.fillRect(ROAD_X, 0, ROAD_W, H);
    // faint tyre wear in the lanes
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    for (i = 0; i < LANES; i++) { ctx.fillRect(laneX(i) - 9, 0, 3, H); ctx.fillRect(laneX(i) + 6, 0, 3, H); }
    // curbs
    var off = Math.floor(scroll) % 24;
    for (var y = -24 + off; y < H; y += 12) {
      var odd = Math.round((y - off) / 12) % 2 === 0;
      ctx.fillStyle = odd ? '#ff004d' : '#fff1e8';
      ctx.fillRect(ROAD_X - CURB, y, CURB, 12); ctx.fillRect(ROAD_X + ROAD_W, y, CURB, 12);
    }
    ctx.fillStyle = '#fff1e8'; ctx.fillRect(ROAD_X + 1, 0, 1, H); ctx.fillRect(ROAD_X + ROAD_W - 2, 0, 1, H);
    // dashed lane dividers
    var doff = Math.floor(scroll) % 30;
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (i = 1; i < LANES; i++) for (var d = -30 + doff; d < H; d += 30) ctx.fillRect(ROAD_X + LANE_W * i - 1, d, 2, 16);
  }

  function drawCar(ctx, spr, x, y, alpha) {
    R.draw.sprite(ctx, spr, Math.round(x - spr.width / 2), Math.round(y), alpha != null ? { alpha: alpha } : undefined);
  }

  function drawCoin(ctx, p) {
    var rx = Math.max(1, Math.round(Math.abs(Math.cos(R.time * 5 + p.y * 0.05)) * 5)), x = Math.round(p.x), y = Math.round(p.y), dy, hw;
    for (dy = -5; dy < 5; dy++) {
      hw = Math.round(rx * Math.sqrt(1 - Math.pow((dy + 0.5) / 5, 2)));
      ctx.fillStyle = '#ffa300'; ctx.fillRect(x - hw, y + dy, hw * 2, 1);
      if (rx > 1 && dy > -5 && dy < 4) { hw = Math.max(0, Math.round((rx - 1) * Math.sqrt(1 - Math.pow((dy + 0.5) / 4, 2)))); ctx.fillStyle = '#ffec27'; ctx.fillRect(x - hw, y + dy, hw * 2, 1); }
    }
    if (rx > 2) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(x - rx + 2, y - 3, 1, 3); ctx.fillStyle = '#ffa300'; ctx.fillRect(x - 1, y - 2, 2, 4); }
  }

  function drawNitroGauge(ctx) {
    var x = 3, y0 = 176, segH = 11, n = 10, filled = Math.round(nitro * n);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 2, y0 - 12, 14, n * segH + 14);
    R.draw.text(ctx, 'N', x + 5, y0 - 9, { size: 6, color: nitroT > 0 ? '#ffffff' : '#3de2ff', align: 'center' });
    for (var i = 0; i < n; i++) {
      var on = (n - 1 - i) < filled, yy = y0 + i * segH;
      ctx.fillStyle = on ? (nitroT > 0 ? (Math.floor(R.time * 12) % 2 ? '#ffffff' : '#ffec27') : (i < 3 ? '#8fe8ff' : '#29adff')) : 'rgba(255,255,255,.12)';
      ctx.fillRect(x, yy, 8, segH - 2);
    }
  }

  R.game({
    layout: 'classic', size: [W, H], bg: '#16692f', music: 'retro',

    init: function () {
      playerSpr = R.sprite(striped(SPORT), carPal('#3de2ff'), 2);
      TYPES.forEach(function (t) { ENEMY_COLORS.forEach(function (col) { sprites[t.name + col] = R.sprite(t.rows, carPal(col), 2); }); });
    },

    reset: function () {
      lane = 1; px = laneX(lane); py = PLAYER_Y; speed = 90; base = baseSpeed(); scroll = 0; dist = 0; distPts = 0;
      spawnAcc = 0; safe = 1; nextSafe = U.randInt(0, LANES); cars = []; picks = []; scenery = []; sceneAcc = 0;
      nitro = 1; nitroT = 0; nitroUses = 0; invul = 1.2; dying = null; coins = 0; closeCalls = 0; swerveLane = -1; swerveT = 0;
      R.level = 1; R.lives = 3; R.hud.extraLabel = 'KM/H'; R.hud.extra = Math.round(speed * 0.7);
      for (var y = 20; y < H; y += 46) { spawnScenery(); scenery[scenery.length - 1].y = y + U.randInt(0, 20); }
      // a little traffic already on the road so the READY scene is alive (player lane 1 stays clear)
      spawnCar(2); cars[0].y = 62; spawnCar(0); cars[1].y = 150; nextSafe = 1; safe = 1;
      spawnAcc = waveGap() * 0.4;
    },

    update: update,

    render: function (ctx) {
      var i, th = THEMES[themeIdx()];
      drawGround(ctx);
      for (i = 0; i < scenery.length; i++) R.draw.sprite(ctx, scenery[i].spr, Math.round(scenery[i].x), Math.round(scenery[i].y), { palette: scenery[i].pal, scale: 1, flipX: scenery[i].flip });
      drawRoad(ctx);
      for (i = 0; i < picks.length; i++) {
        var p = picks[i];
        if (p.kind === 'coin') drawCoin(ctx, p);
        else R.draw.sprite(ctx, FUEL, Math.round(p.x - 5), Math.round(p.y - 6 + Math.sin(R.time * 6) * 1.5), { palette: FUEL_PAL });
      }
      for (i = 0; i < cars.length; i++) drawCar(ctx, cars[i].spr, cars[i].x, cars[i].y);
      // speed lines while the nitro burns
      if (nitroT > 0) {
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        for (i = 0; i < 9; i++) { var sx = ROAD_X + 6 + ((i * 37) % (ROAD_W - 12)), sy = ((scroll * 2.4 + i * 53) % (H + 40)) - 20; ctx.fillRect(sx, sy, 1, 18 + (i % 3) * 8); }
      }
      if (!dying) {
        var blink = invul > 0 && Math.floor(R.time * 14) % 2;
        if (nitroT > 0) {            // flame jets
          var fl = 6 + Math.floor(R.time * 30) % 3 * 3;
          ctx.fillStyle = '#ffa300'; ctx.fillRect(Math.round(px - 8), Math.round(py + 26), 4, fl); ctx.fillRect(Math.round(px + 4), Math.round(py + 26), 4, fl);
          ctx.fillStyle = '#ffec27'; ctx.fillRect(Math.round(px - 7), Math.round(py + 26), 2, fl - 2); ctx.fillRect(Math.round(px + 5), Math.round(py + 26), 2, fl - 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px - 7), Math.round(py + 26), 2, 2); ctx.fillRect(Math.round(px + 5), Math.round(py + 26), 2, 2);
        }
        drawCar(ctx, playerSpr, px, py, blink ? 0.35 : null);
      }
      drawNitroGauge(ctx);
      // braking lights glow
      if (!dying && R.input.held.down) { ctx.fillStyle = 'rgba(255,40,40,.55)'; ctx.fillRect(Math.round(px - 10), Math.round(py + 19), 5, 5); ctx.fillRect(Math.round(px + 5), Math.round(py + 19), 5, 5); ctx.fillStyle = '#ff6060'; ctx.fillRect(Math.round(px - 9), Math.round(py + 20), 2, 2); ctx.fillRect(Math.round(px + 7), Math.round(py + 20), 2, 2); }
    }
  });
})();
