/* Snake — rainbow snake, apples and timed bonus fruit, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var CELL = 12, COLS = 13, ROWS = 26, FW = COLS * CELL, FH = ROWS * CELL;
  var DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  var NSEG = 48;                       // steps in the head -> tail colour gradient
  var APPLES_PER_LEVEL = 5, MAX_ROCKS = 10;

  /* ---- colour helpers: the body is a smooth green -> cyan -> purple -> magenta gradient ---- */
  function hsl(h, s, l) {
    var a = s * Math.min(l, 1 - l);
    function f(n) { var k = (n + h / 30) % 12, c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); var v = Math.round(255 * c); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + f(0) + f(8) + f(4);
  }
  var BODY = [], BODY_HI = [], BODY_LO = [];
  for (var gi = 0; gi < NSEG; gi++) {
    var hue = 128 + (312 - 128) * gi / (NSEG - 1);
    BODY.push(hsl(hue, 0.9, 0.52)); BODY_HI.push(hsl(hue, 0.95, 0.74)); BODY_LO.push(hsl(hue, 0.85, 0.3));
  }
  var HEAD = '#c8ff3a', HEAD_HI = '#efffa0', HEAD_LO = '#6fae14';

  /* ---- pixel sprites (12x12, one cell) ---- */
  var APPLE = [
    '.......GG...',
    '......BGG...',
    '.....B.G....',
    '..RRRRBRRR..',
    '.RHHRRRRRRR.',
    '.RHRRRRRRRD.',
    'RRRRRRRRRRRD',
    'RRRRRRRRRRRD',
    'RRRRRRRRRRDD',
    '.RRRRRRRRDD.',
    '..RRRRRRDD..',
    '...DD..DD...'];
  var APPLE_PAL = { R: '#ff004d', D: '#b30038', H: '#ffa6c4', G: '#00e436', B: '#ab5236' };
  var CHERRY = [
    '.......GGG..',
    '......G..GG.',
    '.....G....G.',
    '....G.....G.',
    '...G......G.',
    '..G.......G.',
    '.RRR....RRR.',
    'RHRRR..RHRRR',
    'RHRRR..RRRRR',
    'RRRRD..RRRRD',
    '.RRD....RRD.',
    '............'];
  var CHERRY_PAL = { R: '#e8003c', D: '#8a0026', H: '#ff9fb8', G: '#00b84a' };
  var STAR = [
    '.....YY.....',
    '.....YY.....',
    '....YYYY....',
    'YYYYYWYYYYYY',
    '.YYYYWYYYYO.',
    '..YYYYYYYO..',
    '...YYYYYYO..',
    '..YYYYYYYO..',
    '..YYYYOYYYO.',
    '.YYYOO..OYYY',
    '.YYO......OY',
    '............'];
  var STAR_PAL = { Y: '#ffec27', W: '#ffffff', O: '#ffa300' };
  var GEM = [
    '............',
    '...CCCCCC...',
    '..CWWCCCCB..',
    '.CWCCCCCCCB.',
    'CCCCCCCCCCBB',
    '.CCCCCCCCBB.',
    '..CCCCCCBB..',
    '...CCCCBB...',
    '....CCBB....',
    '.....BB.....',
    '............',
    '............'];
  var GEM_PAL = { C: '#3de2ff', W: '#ffffff', B: '#1c7bd6' };
  var BONUS_TYPES = [
    { spr: CHERRY, pal: CHERRY_PAL, pts: 50, col: C.red },
    { spr: STAR, pal: STAR_PAL, pts: 80, col: C.yellow },
    { spr: GEM, pal: GEM_PAL, pts: 120, col: C.cyan }
  ];

  var snake, dir, queue, food, bonus, rocks, grow, eaten, bonusEaten, stepT, energy, armed, boosting, lockBoost;
  var wrap, wallWarn, dying, tongueT;

  /* ---- board helpers ---- */
  function isWrapLevel(l) { return l >= 4 && l % 3 === 1; }       // 4, 7, 10 ...
  function interval() {
    var base = Math.max(0.06, 0.17 - (R.level - 1) * 0.009);
    return boosting ? Math.max(0.04, base * 0.6) : base;
  }
  function cx(gx) { return gx * CELL + CELL / 2; }
  function occupied(x, y) {
    var i;
    for (i = 0; i < snake.length; i++) if (snake[i].x === x && snake[i].y === y) return true;
    for (i = 0; i < rocks.length; i++) if (rocks[i].x === x && rocks[i].y === y) return true;
    if (food && food.x === x && food.y === y) return true;
    if (bonus && bonus.x === x && bonus.y === y) return true;
    return false;
  }
  function blocked(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return !wrap;
    for (var i = 0; i < rocks.length; i++) if (rocks[i].x === x && rocks[i].y === y) return true;
    return false;
  }
  function freeCells(filter) {
    var out = [];
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      if (occupied(x, y)) continue;
      if (filter && !filter(x, y)) continue;
      out.push({ x: x, y: y });
    }
    return out;
  }
  function spawnSpot() {
    // avoid dead-end pockets (3 blocked neighbours) so an apple is never a trap
    var open = freeCells(function (x, y) { return blocked(x - 1, y) + blocked(x + 1, y) + blocked(x, y - 1) + blocked(x, y + 1) < 3; });
    if (!open.length) open = freeCells();
    return open.length ? U.pick(open) : null;
  }
  function spawnFood() { return spawnSpot(); }
  function spawnBonus() {
    var spot = spawnSpot(); if (!spot) return;
    var type = BONUS_TYPES[(bonusEaten + Math.floor(eaten / 4)) % BONUS_TYPES.length];
    bonus = { x: spot.x, y: spot.y, type: type, t: 9, max: 9 };
    R.sfx.tone(1318, 0.07, { vol: 0.08 }); R.sfx.tone(1760, 0.1, { vol: 0.08, delay: 0.07 });
    R.fx.burst(cx(spot.x), cx(spot.y), { n: 8, color: [type.col, C.white], speed: 40, life: 0.4 });
  }
  function addRocks(n) {
    for (var k = 0; k < n && rocks.length < MAX_ROCKS; k++) {
      var h = snake[0];
      var cells = freeCells(function (x, y) {
        if (x < 1 || y < 1 || x > COLS - 2 || y > ROWS - 2) return false;
        if (Math.abs(x - h.x) + Math.abs(y - h.y) < 7) return false;
        for (var i = 0; i < rocks.length; i++) if (Math.abs(rocks[i].x - x) + Math.abs(rocks[i].y - y) < 2) return false;
        return true;
      });
      if (!cells.length) break;
      var c = U.pick(cells); rocks.push(c);
      R.fx.burst(cx(c.x), cx(c.y), { n: 10, color: [C.silver, C.dgray], speed: 50, life: 0.45, gravity: 80 });
    }
  }

  /* ---- game events ---- */
  function levelUp(lvl) {
    R.level = lvl;
    R.sfx.play('line'); R.fx.flash(C.white, 0.18); R.vibrate(30);
    R.fx.text(FW / 2, FH / 2 - 8, 'LEVEL ' + lvl, C.yellow);
    if (lvl >= 3) addRocks(2);
    if (isWrapLevel(lvl)) {
      wrap = true; wallWarn = 0;
      R.fx.text(FW / 2, FH / 2 + 6, 'PORTAL EDGES!', C.cyan);
      R.achieve('portal');
    } else if (wrap) {
      wallWarn = 3;                       // grace period before the walls turn deadly again
      R.fx.text(FW / 2, FH / 2 + 6, 'WALLS BACK!', C.red);
    }
  }

  function eatApple(x, y) {
    var pts = 10 + (R.level - 1) * 2;
    grow++; eaten++;
    R.addScore(pts);
    R.sfx.play('coin'); R.vibrate(12);
    R.fx.burst(cx(x), cx(y), { n: 14, color: [C.red, C.pink, C.white, C.lime], speed: 75, life: 0.55, gravity: 60 });
    R.fx.text(cx(x), cx(y) - 10, '+' + pts, C.yellow);
    R.achieve('first-bite');
    food = null;
    var lvl = 1 + Math.floor(eaten / APPLES_PER_LEVEL);
    if (lvl > R.level) levelUp(lvl);
    food = spawnFood();
    if (!bonus && eaten % 4 === 0) spawnBonus();
    if (!food) R.gameOver({ win: true });
  }

  function eatBonus(x, y) {
    var b = bonus, pts = b.type.pts + Math.ceil(b.t) * 10;
    bonus = null; grow += 2; bonusEaten++;
    R.addScore(pts);
    R.sfx.play('powerup'); R.vibrate(25);
    R.fx.burst(cx(x), cx(y), { n: 22, color: [b.type.col, C.white, C.yellow], speed: 95, life: 0.7 });
    R.fx.text(cx(x), cx(y) - 10, '+' + pts, b.type.col);
    if (bonusEaten >= 3) R.achieve('sweet-tooth');
  }

  function die() {
    dying = { t: 0, i: 0, boom: false };
    R.sfx.play('hit'); R.vibrate(90); R.fx.shake(4, 0.4); R.fx.flash(C.red, 0.15);
  }

  function updateDeath(dt) {
    dying.t += dt;
    var per = Math.min(0.035, 0.9 / snake.length);
    if (!dying.boom && dying.t > 0.2) { dying.boom = true; R.sfx.play('explode'); }
    while (dying.i < snake.length && dying.t >= 0.2 + dying.i * per) {
      var s = snake[dying.i], col = BODY[Math.round(dying.i / Math.max(1, snake.length - 1) * (NSEG - 1))];
      R.fx.burst(cx(s.x), cx(s.y), { n: 7, color: [col, C.white], speed: 90, life: 0.65, gravity: 120, size: 2 });
      dying.i++;
    }
    if (dying.i >= snake.length && dying.t > 0.2 + snake.length * per + 0.45) R.gameOver();
  }

  function stepSnake() {
    if (queue.length) { dir = queue.shift(); R.sfx.play('move'); }
    var h = snake[0], nx = h.x + dir.x, ny = h.y + dir.y, i;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      if (wrap) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; R.sfx.tone(520, 0.06, { vol: 0.05, slide: 900 }); }
      else { die(); return; }
    }
    var last = grow > 0 ? snake.length : snake.length - 1;      // the tail cell is free only if we are not growing
    for (i = 0; i < last; i++) if (snake[i].x === nx && snake[i].y === ny) { die(); return; }
    for (i = 0; i < rocks.length; i++) if (rocks[i].x === nx && rocks[i].y === ny) { die(); return; }
    snake.unshift({ x: nx, y: ny });
    if (grow > 0) grow--; else snake.pop();
    if (boosting) {
      R.addScore(1);
      R.fx.burst(cx(snake[1].x), cx(snake[1].y), { n: 1, color: [C.white, C.cyan], speed: 18, life: 0.3, size: 2 });
    }
    if (food && food.x === nx && food.y === ny) eatApple(nx, ny);
    else if (bonus && bonus.x === nx && bonus.y === ny) eatBonus(nx, ny);
    R.hud.extra = snake.length + grow;
    if (R.hud.extra >= 25) R.achieve('long-snake');
  }

  /* ---- drawing ---- */
  function bodyIdx(i, n) { return n > 1 ? Math.min(NSEG - 1, Math.round(i / (n - 1) * (NSEG - 1))) : 0; }

  function roundedRect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
  }

  function drawSnake(ctx) {
    var n = snake.length, first = dying ? dying.i : 0, i;
    for (i = n - 1; i >= first; i--) {
      var s = snake[i], x = s.x * CELL, y = s.y * CELL, gi = bodyIdx(i, n), col, hi, lo;
      if (i === 0) { col = dying ? (Math.floor(dying.t * 20) % 2 ? C.red : C.white) : HEAD; hi = HEAD_HI; lo = HEAD_LO; }
      else { col = BODY[gi]; hi = BODY_HI[gi]; lo = BODY_LO[gi]; }
      if (i > 0 && i < n - 1) {
        // bridge towards the previous (head-side) segment so the body reads as one piece
        var p = snake[i - 1], dx = p.x - s.x, dy = p.y - s.y;
        ctx.fillStyle = col;
        if (dx === 1 && dy === 0) ctx.fillRect(x + CELL - 1, y + 2, 2, CELL - 4);
        else if (dx === -1 && dy === 0) ctx.fillRect(x - 1, y + 2, 2, CELL - 4);
        else if (dy === 1 && dx === 0) ctx.fillRect(x + 2, y + CELL - 1, CELL - 4, 2);
        else if (dy === -1 && dx === 0) ctx.fillRect(x + 2, y - 1, CELL - 4, 2);
      }
      if (i === 0) {
        roundedRect(ctx, x, y, CELL, CELL, col);
        ctx.fillStyle = lo; ctx.fillRect(x + 2, y + CELL - 2, CELL - 4, 2);
        ctx.fillStyle = hi; ctx.fillRect(x + 2, y, CELL - 4, 2);
      } else if (i === n - 1 && n > 3) {
        roundedRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, col);
        // tail also bridges towards its neighbour
        var q = snake[i - 1], tx = q.x - s.x, ty = q.y - s.y;
        ctx.fillStyle = col;
        if (tx === 1 && ty === 0) ctx.fillRect(x + CELL - 2, y + 3, 3, CELL - 6);
        else if (tx === -1 && ty === 0) ctx.fillRect(x - 1, y + 3, 3, CELL - 6);
        else if (ty === 1 && tx === 0) ctx.fillRect(x + 3, y + CELL - 2, CELL - 6, 3);
        else if (ty === -1 && tx === 0) ctx.fillRect(x + 3, y - 1, CELL - 6, 3);
      } else {
        roundedRect(ctx, x + 1, y + 1, CELL - 2, CELL - 2, col);
        ctx.fillStyle = lo; ctx.fillRect(x + 2, y + CELL - 3, CELL - 4, 2);
        ctx.fillStyle = hi; ctx.fillRect(x + 3, y + 2, 4, 2);
      }
    }
    if (!dying || dying.i === 0) drawHeadFace(ctx);
  }

  var EYES = { up: [[2, 2], [7, 2]], down: [[2, 7], [7, 7]], left: [[2, 2], [2, 7]], right: [[7, 2], [7, 7]] };
  function dirName(d) { return d.y < 0 ? 'up' : d.y > 0 ? 'down' : d.x < 0 ? 'left' : 'right'; }

  function drawHeadFace(ctx) {
    var h = snake[0], x = h.x * CELL, y = h.y * CELL, d = dir, eyes = EYES[dirName(d)], k;
    // tongue flicks out now and then
    if (!dying && Math.floor(tongueT * 4) % 4 === 0) {
      ctx.fillStyle = C.red;
      if (d.x) ctx.fillRect(d.x > 0 ? x + CELL : x - 3, y + 6, 3, 1);
      else ctx.fillRect(x + 5, d.y > 0 ? y + CELL : y - 3, 1, 3);
    }
    for (k = 0; k < 2; k++) {
      var ox = x + eyes[k][0], oy = y + eyes[k][1];
      if (dying) {
        ctx.fillStyle = C.black; ctx.fillRect(ox, oy + 1, 3, 1); ctx.fillRect(ox + 1, oy, 1, 3);
      } else {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(ox, oy, 3, 3);
        ctx.fillStyle = '#10131c'; ctx.fillRect(ox + 1 + d.x, oy + 1 + d.y, 1, 1);
      }
    }
  }

  function drawFruit(ctx, spr, pal, gx, gy, blinkOff) {
    var bob = Math.floor(R.time * 5) % 2 ? 1 : 0;
    if (blinkOff) return;
    R.draw.sprite(ctx, spr, gx * CELL, gy * CELL - bob, { palette: pal });
  }

  function drawRock(ctx, r) {
    var x = r.x * CELL, y = r.y * CELL;
    R.draw.block(ctx, x + 1, y + 1, CELL - 2, '#7d869c');
    ctx.fillStyle = '#4d566c'; ctx.fillRect(x + 4, y + 5, 3, 1); ctx.fillRect(x + 6, y + 6, 1, 3); ctx.fillRect(x + 3, y + 8, 2, 1);
  }

  function drawBorder(ctx) {
    var warn = wallWarn > 0 && Math.floor(R.time * 6) % 2;
    var portal = wrap && !warn, t = 2, p, a, b;
    if (portal) {
      var off = Math.floor(R.time * 14) % 8;
      ctx.fillStyle = '#12485a';
      ctx.fillRect(0, 0, FW, t); ctx.fillRect(0, FH - t, FW, t); ctx.fillRect(0, 0, t, FH); ctx.fillRect(FW - t, 0, t, FH);
      ctx.fillStyle = '#3de2ff';
      for (p = -off; p < FW; p += 8) { a = Math.max(0, p); b = Math.min(FW, p + 4); if (b > a) { ctx.fillRect(a, 0, b - a, t); ctx.fillRect(a, FH - t, b - a, t); } }
      for (p = -off; p < FH; p += 8) { a = Math.max(0, p); b = Math.min(FH, p + 4); if (b > a) { ctx.fillRect(0, a, t, b - a); ctx.fillRect(FW - t, a, t, b - a); } }
    } else {
      R.draw.frame(ctx, 0, 0, FW, FH, warn ? '#ffffff' : '#ff004d', t);
    }
  }

  function drawMeters(ctx) {
    if (bonus) {
      var w = Math.round(FW * bonus.t / bonus.max);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, FW, 3);
      ctx.fillStyle = bonus.type.col; ctx.fillRect(0, 0, w, 3);
    }
    if (energy < 0.999 || boosting) {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, FH - 3, FW, 3);
      ctx.fillStyle = boosting ? '#ffffff' : (lockBoost ? '#ff004d' : '#29adff'); ctx.fillRect(0, FH - 3, Math.round(FW * energy), 3);
    }
  }

  R.game({
    layout: 'classic', size: [FW, FH], bg: '#07120e', music: 'chill',

    reset: function () {
      snake = [{ x: 6, y: 20 }, { x: 6, y: 21 }, { x: 6, y: 22 }];
      dir = { x: 0, y: -1 }; queue = []; rocks = []; bonus = null; food = null;
      grow = 0; eaten = 0; bonusEaten = 0; stepT = 0; energy = 1; armed = false; boosting = false; lockBoost = false;
      wrap = false; wallWarn = 0; dying = null; tongueT = 0;
      R.level = 1; R.hud.extraLabel = 'LENGTH'; R.hud.extra = snake.length;
      food = { x: U.randInt(2, COLS - 2), y: U.randInt(2, 7) };       // first apple straight ahead-ish, above the READY card
    },

    onPress: function (b) {
      if (b === 'a') { armed = true; return; }
      var d = DIRS[b];
      if (!d || dying) return;
      var ref = queue.length ? queue[queue.length - 1] : dir;
      if (d.x === ref.x && d.y === ref.y) return;               // already going that way
      if (d.x === -ref.x && d.y === -ref.y) return;             // no 180 degree reversals
      if (queue.length < 2) queue.push({ x: d.x, y: d.y });     // buffer up to two quick turns
    },

    update: function (dt) {
      tongueT += dt;
      if (dying) { updateDeath(dt); return; }
      if (wallWarn > 0) { wallWarn -= dt; if (wallWarn <= 0) { wallWarn = 0; wrap = false; } }
      if (!R.input.held.a) armed = false;
      if (lockBoost && energy > 0.25) lockBoost = false;
      boosting = armed && R.input.held.a && energy > 0 && !lockBoost;
      if (boosting) { energy -= dt * 0.75; if (energy <= 0) { energy = 0; lockBoost = true; boosting = false; } }
      else energy = Math.min(1, energy + dt * 0.3);
      if (bonus) {
        bonus.t -= dt;
        if (bonus.t <= 0) { R.fx.burst(cx(bonus.x), cx(bonus.y), { n: 8, color: [C.dgray, C.silver], speed: 30, life: 0.4 }); bonus = null; R.sfx.play('tick'); }
      }
      stepT += dt;
      var iv = interval();
      while (stepT >= iv && !dying) { stepT -= iv; stepSnake(); iv = interval(); }
    },

    render: function (ctx, W, H) {
      var x, y, i;
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#0a1a13' : '#08140f'; ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
      drawBorder(ctx);
      for (i = 0; i < rocks.length; i++) drawRock(ctx, rocks[i]);
      if (food) drawFruit(ctx, APPLE, APPLE_PAL, food.x, food.y, false);
      if (bonus) {
        drawFruit(ctx, bonus.type.spr, bonus.type.pal, bonus.x, bonus.y, bonus.t < 2.5 && Math.floor(R.time * 8) % 2 === 0);
        for (i = 0; i < 4; i++) {
          var a = R.time * 4 + i * Math.PI / 2;
          ctx.fillStyle = bonus.type.col; ctx.fillRect(Math.round(cx(bonus.x) + Math.cos(a) * 9 - 1), Math.round(cx(bonus.y) + Math.sin(a) * 9 - 1), 2, 2);
        }
      }
      drawSnake(ctx);
      drawMeters(ctx);
    },

    serialize: function () {
      return { snake: snake, dir: dir, queue: queue, food: food, bonus: bonus && { x: bonus.x, y: bonus.y, t: bonus.t, max: bonus.max, i: BONUS_TYPES.indexOf(bonus.type) },
        rocks: rocks, grow: grow, eaten: eaten, bonusEaten: bonusEaten, energy: energy, wrap: wrap, wallWarn: wallWarn };
    },
    restore: function (s) {
      snake = s.snake; dir = s.dir; queue = s.queue || []; food = s.food; rocks = s.rocks || [];
      bonus = s.bonus ? { x: s.bonus.x, y: s.bonus.y, t: s.bonus.t, max: s.bonus.max, type: BONUS_TYPES[s.bonus.i] || BONUS_TYPES[0] } : null;
      grow = s.grow || 0; eaten = s.eaten || 0; bonusEaten = s.bonusEaten || 0; energy = s.energy == null ? 1 : s.energy;
      wrap = !!s.wrap; wallWarn = s.wallWarn || 0;
      stepT = 0; armed = false; boosting = false; lockBoost = false; dying = null; tongueT = 0;
      R.level = 1 + Math.floor(eaten / APPLES_PER_LEVEL);
      R.hud.extraLabel = 'LENGTH'; R.hud.extra = snake.length + grow;
      if (!food) food = spawnFood();
    }
  });
})();
