/* Alien Blaster — marching-aliens shooter, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 160, H = 320;
  var COLS = 8, ROWS = 5, PX = 16, PY = 14, AW = 12, AH = 8, TOTAL = COLS * ROWS;
  var PW = 13, PH = 8, PLAYER_Y = 292, GROUND_Y = 306;
  var SH_COLS = 11, SH_ROWS = 8, SH_CELL = 2, SHIELD_Y = 238;
  var MAX_LIVES = 5;

  /* ---- pixel art (12x8 aliens, two animation frames each) ---- */
  var SQUID = [[
    '....llll....', '...laaaaa...', '..laaaaaaa..', '..aaeaaeaa..',
    '..aaaaaaaa..', '....a..a....', '...a.aa.a...', '..a.a..a.a..'], [
    '....llll....', '...laaaaa...', '..laaaaaaa..', '..aaeaaeaa..',
    '..aaaaaaaa..', '...a.aa.a...', '..a......a..', '...a....a...']];
  var CRAB = [[
    '..a......a..', '...a....a...', '..lllaaaaa..', '.aaeaaaaeaa.',
    'aaaaaaaaaaaa', 'a.aaaaaaaa.a', 'a.a......a.a', '...aa..aa...'], [
    '..a......a..', 'a..a....a..a', 'a.lllaaaaa.a', 'aaaeaaaaeaaa',
    'aaaaaaaaaaaa', '.aaaaaaaaaa.', '..a......a..', '.a........a.']];
  var OCTO = [[
    '....llll....', '.llaaaaaaaa.', 'aaaaaaaaaaaa', 'aaaeaaaaeaaa',
    'aaaaaaaaaaaa', '...aa..aa...', '..aa.aa.aa..', 'aa........aa'], [
    '....llll....', '.llaaaaaaaa.', 'aaaaaaaaaaaa', 'aaaeaaaaeaaa',
    'aaaaaaaaaaaa', '..aaa..aaa..', '.aa..aa..aa.', '..aa....aa..']];
  var UFO_ROWS = [
    '.....llllll.....', '...llaaaaaaaa...', '..aaaaaaaaaaaa..', '.aawaawaawaawaa.',
    'aaaaaaaaaaaaaaaa', '..aaa..aa..aaa..', '...a........a...'];
  var CANNON = [
    '......w......', '.....wcc.....', '.....ccd.....', '.wcccccccccd.',
    'wccccccccccdd', 'wcccbbbbbcccd', 'wccccccccccdd', 'ddddddddddddd'];
  var BOMB = [['.o..', 'oy..', '.oy.', '..oy', '.oy.', 'oy..', '.oy.', '..r.'],
    ['..o.', '..yo', '.yo.', 'yo..', '.yo.', '..yo', '.yo.', '.r..']];

  var TYPES = [
    { pts: 30, rows: SQUID, pal: { a: '#ff77a8', l: '#ffd5e4', e: '#fff1e8' }, col: '#ff77a8' },
    { pts: 20, rows: CRAB, pal: { a: '#3de2ff', l: '#c4f6ff', e: '#10131c' }, col: '#3de2ff' },
    { pts: 10, rows: OCTO, pal: { a: '#00e436', l: '#bdffc9', e: '#10131c' }, col: '#00e436' }
  ];
  var UFO_SPR = [], CANNON_SPR, BOMB_SPR = [];

  var aliens, alive, form, wave, intro, clearT, bullets, bombs, shields, ufo, ufoT, ufoBeep, px, invuln, fireCool;
  var deadT, invaded, dropT, stepIdx, bombsShot, nextLife, stars, tAnim, tickT;

  function rnd(a, b) { return U.rand(a, b); }

  /* ------------------------------------------------------------ setup */
  function makeStars() {
    stars = [];
    for (var i = 0; i < 46; i++) stars.push({ x: U.randInt(0, W), y: U.randInt(0, GROUND_Y), s: Math.random() < 0.15 ? 2 : 1, ph: Math.random() * 6 });
  }

  function buildShields() {
    var tmpl = [
      '..#######..', '.#########.', '###########', '###########',
      '###########', '###########', '####...####', '###.....###'];
    shields = [];
    var gap = (W - 4 * SH_COLS * SH_CELL) / 5;
    for (var s = 0; s < 4; s++) {
      var cells = new Uint8Array(SH_COLS * SH_ROWS);
      for (var y = 0; y < SH_ROWS; y++) for (var x = 0; x < SH_COLS; x++) cells[y * SH_COLS + x] = tmpl[y].charAt(x) === '#' ? 3 : 0;
      shields.push({ x: Math.round(gap + s * (SH_COLS * SH_CELL + gap)), y: SHIELD_Y, cells: cells });
    }
  }

  function newWave() {
    aliens = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) aliens.push({ c: c, r: r, t: r === 0 ? 0 : r < 3 ? 1 : 2, alive: true });
    alive = TOTAL;
    form = { x: 18, y: 46 + Math.min(5, wave - 1) * 10, dir: 1, frame: 0 };
    bullets = []; bombs = []; ufo = null;
    ufoT = rnd(14, 22); dropT = 1.2; tickT = 0.3; intro = 1.4; clearT = 0;
    buildShields();
    R.level = wave; R.hud.extra = alive;
  }

  function respawn() {
    deadT = 0; px = (W - PW) / 2; invuln = 1.8; fireCool = 0.3;
    bombs.length = 0; bullets.length = 0;
  }

  /* ------------------------------------------------------------ helpers */
  function tickInterval() {
    var base = 0.035 + 0.44 * (alive / TOTAL);
    base *= Math.max(0.55, 1 - 0.06 * (wave - 1));
    return Math.max(0.022, base);
  }

  function alienRect(a) { return { x: form.x + a.c * PX, y: form.y + a.r * PY, w: AW, h: AH }; }

  function carve(sh, cx, cy) {
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= SH_COLS || y >= SH_ROWS) continue;
      var i = y * SH_COLS + x;
      if (!sh.cells[i]) continue;
      if (dx === 0 && dy === 0) sh.cells[i] = 0;
      else if (Math.random() < 0.6) sh.cells[i] = Math.max(0, sh.cells[i] - (Math.random() < 0.5 ? 2 : 1));
    }
  }

  /** does a point hit a living shield cell? damages it. */
  function shieldHit(x, y) {
    for (var s = 0; s < shields.length; s++) {
      var sh = shields[s];
      var cx = Math.floor((x - sh.x) / SH_CELL), cy = Math.floor((y - sh.y) / SH_CELL);
      if (cx < 0 || cy < 0 || cx >= SH_COLS || cy >= SH_ROWS) continue;
      if (sh.cells[cy * SH_COLS + cx]) {
        carve(sh, cx, cy);
        R.fx.burst(x, y, { n: 5, color: ['#00e436', '#7dffa0'], speed: 40, life: 0.3, size: 1 });
        R.sfx.tone(150, 0.05, { type: 'square', vol: 0.05, slide: 70 });
        return true;
      }
    }
    return false;
  }

  function eraseRect(rect) {
    for (var s = 0; s < shields.length; s++) {
      var sh = shields[s];
      var x0 = Math.floor((rect.x - sh.x) / SH_CELL), x1 = Math.floor((rect.x + rect.w - 1 - sh.x) / SH_CELL);
      var y0 = Math.floor((rect.y - sh.y) / SH_CELL), y1 = Math.floor((rect.y + rect.h - 1 - sh.y) / SH_CELL);
      for (var y = Math.max(0, y0); y <= Math.min(SH_ROWS - 1, y1); y++) for (var x = Math.max(0, x0); x <= Math.min(SH_COLS - 1, x1); x++) sh.cells[y * SH_COLS + x] = 0;
    }
  }

  function killAlien(a) {
    a.alive = false; alive--;
    var t = TYPES[a.t], rc = alienRect(a);
    R.addScore(t.pts);
    R.fx.burst(rc.x + AW / 2, rc.y + AH / 2, { n: 12, color: [t.col, C.white, t.col], speed: 70, life: 0.45, size: 2 });
    R.sfx.noise(0.12, { vol: 0.16, freq: 2800, sweep: 300 });
    R.sfx.tone(300, 0.08, { type: 'square', vol: 0.07, slide: 90 });
    R.vibrate(8);
    R.hud.extra = alive;
    checkLife();
    if (R.score >= 5000) R.achieve('score5000');
  }

  function checkLife() {
    if (R.score >= nextLife) {
      nextLife += 5000;
      if (R.lives < MAX_LIVES) { R.lives++; R.sfx.play('powerup'); R.fx.text(W / 2, 270, '1UP!', C.lime); }
    }
  }

  function hitPlayer() {
    if (deadT > 0 || invuln > 0) return;
    R.lives = Math.max(0, R.lives - 1);
    deadT = 1.5;
    R.sfx.play('explode'); R.vibrate(120); R.fx.shake(4, 0.4); R.fx.flash(C.white, 0.15);
    R.fx.burst(px + PW / 2, PLAYER_Y + PH / 2, { n: 26, color: [C.cyan, C.white, C.blue, C.yellow], speed: 90, life: 0.8, size: 2, gravity: 40 });
    bombs.length = 0;
  }

  function spawnBomb() {
    var cols = [], c, r, i, a;
    for (c = 0; c < COLS; c++) {
      for (r = ROWS - 1; r >= 0; r--) { a = aliens[r * COLS + c]; if (a.alive) { cols.push(a); break; } }
    }
    if (!cols.length) return;
    var pick;
    if (Math.random() < 0.5) {
      // aim for the column nearest the player
      var best = 1e9;
      for (i = 0; i < cols.length; i++) { var d = Math.abs(form.x + cols[i].c * PX + AW / 2 - (px + PW / 2)); if (d < best) { best = d; pick = cols[i]; } }
    } else pick = U.pick(cols);
    var rc = alienRect(pick);
    bombs.push({ x: rc.x + AW / 2 - 2, y: rc.y + AH, vy: Math.min(135, 72 + wave * 6), f: 0, t: 0 });
    R.sfx.tone(520, 0.08, { type: 'triangle', vol: 0.05, slide: 260 });
  }

  /* ------------------------------------------------------------ game */
  R.game({
    layout: 'classic', size: [W, H], bg: '#070a1c', music: 'action', levelLabel: 'WAVE',

    init: function () {
      TYPES.forEach(function (t) { t.spr = t.rows.map(function (rows) { return R.sprite(rows, t.pal); }); });
      UFO_SPR = [R.sprite(UFO_ROWS, { a: '#ff004d', l: '#ff9ab8', w: '#ffec27' }), R.sprite(UFO_ROWS, { a: '#ff004d', l: '#ff9ab8', w: '#fff1e8' })];
      CANNON_SPR = R.sprite(CANNON, { w: '#fff1e8', c: '#3de2ff', d: '#1b6fb0', b: '#10131c' });
      BOMB_SPR = BOMB.map(function (rows) { return R.sprite(rows, { o: '#ffa300', y: '#ffec27', r: '#ff004d' }); });
    },

    reset: function () {
      R.lives = 3; R.level = 1; R.hud.extraLabel = 'ALIENS';
      wave = 1; px = (W - PW) / 2; invuln = 0; fireCool = 0; deadT = 0; invaded = false;
      stepIdx = 0; bombsShot = 0; nextLife = 3000; tAnim = 0; ufoBeep = 0;
      makeStars(); newWave();
    },

    update: function (dt) {
      var i, j, b, a, rc;
      tAnim += dt;
      if (invuln > 0) invuln -= dt;

      if (deadT > 0) {
        deadT -= dt;
        if (deadT <= 0) {
          if (R.lives <= 0 || invaded) { R.gameOver(); return; }
          respawn();
        }
        return;
      }

      /* player */
      px = U.clamp(px + R.input.axisX() * 86 * dt, 3, W - 3 - PW);
      fireCool -= dt;
      if ((R.input.pressed('a') || R.input.held.a) && fireCool <= 0 && bullets.length < 2) {
        bullets.push({ x: px + (PW - 1) / 2, y: PLAYER_Y - 6 });
        fireCool = 0.2; R.sfx.play('shoot');
      }

      if (clearT > 0) {
        clearT -= dt;
        if (clearT <= 0) { wave++; newWave(); if (wave >= 2) R.sfx.play('start'); }
      } else if (intro > 0) intro -= dt;

      var active = intro <= 0 && clearT <= 0;

      /* formation march */
      if (active) {
        tickT -= dt;
        if (tickT <= 0) {
          tickT += tickInterval();
          var minC = COLS, maxC = -1;
          for (i = 0; i < aliens.length; i++) if (aliens[i].alive) { minC = Math.min(minC, aliens[i].c); maxC = Math.max(maxC, aliens[i].c); }
          var nx = form.dir * 3;
          if (form.x + maxC * PX + AW + nx > W - 3 || form.x + minC * PX + nx < 3) { form.y += 8; form.dir = -form.dir; }
          else form.x += nx;
          form.frame ^= 1;
          R.sfx.tone([98, 87, 82, 73][stepIdx++ & 3], 0.07, { type: 'triangle', vol: 0.09 });
          // the invaders eat the shields they walk through
          for (i = 0; i < aliens.length; i++) {
            a = aliens[i];
            if (!a.alive) continue;
            rc = alienRect(a);
            if (rc.y + rc.h >= SHIELD_Y - 2 && rc.y <= SHIELD_Y + SH_ROWS * SH_CELL) eraseRect(rc);
            if (rc.y + rc.h >= PLAYER_Y - 1) invaded = true;
          }
          if (invaded) {
            R.lives = 0; deadT = 1.6; R.sfx.play('explode'); R.vibrate(150); R.fx.shake(5, 0.5);
            R.fx.burst(px + PW / 2, PLAYER_Y + PH / 2, { n: 30, color: [C.cyan, C.white, C.red], speed: 100, life: 0.9, size: 2 });
            return;
          }
        }

        /* bonus UFO */
        if (!ufo) {
          ufoT -= dt;
          if (ufoT <= 0) {
            if (alive > 6) {
              var dir = Math.random() < 0.5 ? 1 : -1;
              ufo = { x: dir > 0 ? -18 : W + 2, dir: dir, pts: U.pick([50, 100, 100, 150, 150, 300]) };
            }
            ufoT = rnd(16, 26);
          }
        } else {
          ufo.x += ufo.dir * 38 * dt;
          ufoBeep -= dt;
          if (ufoBeep <= 0) { ufoBeep = 0.16; R.sfx.tone(Math.floor(tAnim / 0.16) % 2 ? 640 : 520, 0.08, { type: 'square', vol: 0.035 }); }
          if (ufo.x < -20 || ufo.x > W + 4) ufo = null;
        }

        /* alien bombs */
        dropT -= dt;
        if (dropT <= 0) {
          var a0 = Math.max(0.28, 0.95 - wave * 0.07);
          dropT = rnd(a0, a0 + 0.7);
          if (bombs.length < Math.min(5, 2 + Math.floor(wave / 2)) && alive > 0) spawnBomb();
        }
      }

      /* player bullets */
      for (i = bullets.length - 1; i >= 0; i--) {
        b = bullets[i];
        var hit = false, dist = 270 * dt, n = Math.ceil(dist / 2), sd = dist / n;
        for (j = 0; j < n && !hit; j++) { b.y -= sd; if (shieldHit(b.x + 0.5, b.y)) hit = true; }
        if (!hit) {
          var br = { x: b.x - 0.5, y: b.y, w: 2, h: 6 };
          for (j = 0; j < aliens.length; j++) {
            a = aliens[j];
            if (a.alive && U.overlap(br, alienRect(a))) { killAlien(a); hit = true; break; }
          }
          if (!hit && ufo && U.overlap(br, { x: ufo.x, y: 18, w: 16, h: 7 })) {
            R.addScore(ufo.pts); checkLife();
            R.fx.text(ufo.x + 8, 28, '' + ufo.pts, C.yellow);
            R.fx.burst(ufo.x + 8, 21, { n: 22, color: [C.red, C.pink, C.yellow, C.white], speed: 90, life: 0.7, size: 2 });
            R.sfx.play('explode'); R.sfx.play('coin'); R.vibrate(40); R.fx.shake(2, 0.15);
            R.achieve('ufo'); if (R.score >= 5000) R.achieve('score5000');
            ufo = null; hit = true;
          }
          if (!hit) {
            for (j = bombs.length - 1; j >= 0; j--) {
              if (U.overlap(br, { x: bombs[j].x, y: bombs[j].y, w: 4, h: 8 })) {
                R.fx.burst(bombs[j].x + 2, bombs[j].y + 4, { n: 7, color: [C.orange, C.yellow], speed: 50, life: 0.3, size: 1 });
                R.sfx.tone(700, 0.06, { type: 'square', vol: 0.07, slide: 200 });
                bombs.splice(j, 1); R.addScore(5);
                if (++bombsShot >= 10) R.achieve('bombs10');
                hit = true; break;
              }
            }
          }
        }
        if (hit || b.y < 2) bullets.splice(i, 1);
      }

      /* alien bombs fall */
      for (i = bombs.length - 1; i >= 0; i--) {
        b = bombs[i];
        b.t += dt; if (b.t > 0.1) { b.t = 0; b.f ^= 1; }
        var gone = false, d2 = b.vy * dt, n2 = Math.ceil(d2 / 2), s2 = d2 / n2;
        for (j = 0; j < n2 && !gone; j++) { b.y += s2; if (shieldHit(b.x + 2, b.y + 8)) gone = true; }
        if (!gone && U.overlap({ x: b.x, y: b.y, w: 4, h: 8 }, { x: px + 1, y: PLAYER_Y + 1, w: PW - 2, h: PH - 1 })) { hitPlayer(); gone = true; }
        if (!gone && b.y + 8 >= GROUND_Y) {
          R.fx.burst(b.x + 2, GROUND_Y, { n: 6, color: [C.orange, C.yellow], speed: 45, life: 0.3, size: 1, gravity: 90 });
          gone = true;
        }
        if (gone) bombs.splice(i, 1);
      }

      /* wave cleared */
      if (alive <= 0 && clearT <= 0 && intro <= 0) {
        clearT = 2.0;
        var bonus = 200 * wave;
        R.addScore(bonus); checkLife();
        R.fx.text(W / 2, 190, '+' + bonus, C.yellow);
        R.sfx.play('win'); R.fx.flash(C.white, 0.18);
        bombs.length = 0;
        R.achieve('wave1');
        if (R.score >= 5000) R.achieve('score5000');
      }
    },

    render: function (ctx, W_, H_) {
      var i, x, y;
      // stars
      for (i = 0; i < stars.length; i++) {
        var s = stars[i], tw = 0.45 + 0.35 * Math.sin(tAnim * 1.6 + s.ph);
        ctx.globalAlpha = tw; ctx.fillStyle = s.s > 1 ? '#8fb5ff' : '#cfd8ff'; ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;

      // shields
      for (i = 0; i < shields.length; i++) {
        var sh = shields[i];
        for (y = 0; y < SH_ROWS; y++) for (x = 0; x < SH_COLS; x++) {
          var hp = sh.cells[y * SH_COLS + x];
          if (!hp) continue;
          ctx.fillStyle = hp >= 3 ? '#00e436' : hp === 2 ? '#00a845' : '#0a6b3a';
          ctx.fillRect(sh.x + x * SH_CELL, sh.y + y * SH_CELL, SH_CELL, SH_CELL);
          if (hp >= 3 && y === 0) { ctx.fillStyle = '#9dffb4'; ctx.fillRect(sh.x + x * SH_CELL, sh.y + y * SH_CELL, SH_CELL, 1); }
        }
      }

      // aliens
      for (i = 0; i < aliens.length; i++) {
        var a = aliens[i];
        if (!a.alive) continue;
        R.draw.sprite(ctx, TYPES[a.t].spr[form.frame], Math.round(form.x + a.c * PX), Math.round(form.y + a.r * PY));
      }

      // UFO
      if (ufo) R.draw.sprite(ctx, UFO_SPR[Math.floor(tAnim / 0.15) % 2], Math.round(ufo.x), 18);

      // ground
      ctx.fillStyle = '#0a3d2a'; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      ctx.fillStyle = '#00e436'; ctx.fillRect(0, GROUND_Y, W, 1);

      // bullets & bombs
      for (i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        ctx.fillStyle = 'rgba(61,226,255,.35)'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 4, 8);
        ctx.fillStyle = '#fff1e8'; ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 6);
      }
      for (i = 0; i < bombs.length; i++) R.draw.sprite(ctx, BOMB_SPR[bombs[i].f], Math.round(bombs[i].x), Math.round(bombs[i].y));

      // cannon
      if (deadT > 0) {
        if (Math.floor(tAnim / 0.07) % 2 === 0) {
          for (i = 0; i < 9; i++) {
            ctx.fillStyle = U.pick(['#3de2ff', '#fff1e8', '#ffec27', '#ff004d']);
            ctx.fillRect(Math.round(px + Math.random() * (PW - 2)), Math.round(PLAYER_Y + Math.random() * (PH - 2)), 2, 2);
          }
        }
      } else if (invuln <= 0 || Math.floor(tAnim / 0.08) % 2 === 0) {
        R.draw.sprite(ctx, CANNON_SPR, Math.round(px), PLAYER_Y);
      }

      // banners
      if (R.mode !== 'play') { /* READY / GAME OVER cards cover the playfield */ }
      else if (intro > 0 && deadT <= 0) {
        R.draw.text(ctx, 'WAVE ' + wave, W / 2, 168, { size: 16, color: C.yellow, align: 'center', shadow: '#000' });
        R.draw.text(ctx, 'GET READY', W / 2, 190, { size: 8, color: C.white, align: 'center', shadow: '#000' });
      } else if (clearT > 0) {
        R.draw.text(ctx, 'WAVE CLEAR!', W / 2, 168, { size: 8, color: C.lime, align: 'center', shadow: '#000' });
      }
      if (invaded && R.mode === 'play') R.draw.text(ctx, 'INVADED!', W / 2, 168, { size: 16, color: C.red, align: 'center', shadow: '#000' });
    }
  });
})();
