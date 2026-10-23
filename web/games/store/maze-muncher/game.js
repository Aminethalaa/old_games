/* Maze Muncher — dot-chomping maze chase, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var T = 8, COLS = 19, ROWS = 21, OY = 12, TUN_ROW = 9;
  var MAZE = [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.### # ###.####',
    '####.#       #.####',
    '####.# ##-## #.####',
    '    .  #GGG#  .    ',
    '####.# ##### #.####',
    '####.#       #.####',
    '####.# ##### #.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.#.....P.....#.o#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################'
  ];
  var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], OPP = [2, 3, 0, 1];   // 0 right, 1 down, 2 left, 3 up
  var DIRS = ['right', 'down', 'left', 'up'];
  var PLAYER_START = [9, 15], DOOR = [9, 8], PEN = [9, 9], EXIT = [9, 7], FRUIT_AT = [9, 11];
  var PATROL = [[1, 1], [17, 1], [17, 19], [1, 19]];

  /* ---------------------------------------------------------- pixel art */
  function flipRows(rows) { return rows.map(function (r) { return r.split('').reverse().join(''); }); }
  function rotCW(rows) {
    var n = rows.length, m = rows[0].length, out = [];
    for (var x = 0; x < m; x++) { var s = ''; for (var y = n - 1; y >= 0; y--) s += rows[y].charAt(x); out.push(s); }
    return out;
  }
  var MUNCH = [[
    '...yyyy...', '..yyyyyy..', '.yyyyyyyy.', 'yyyyyykyyy', 'yyyyyyyyyy',
    'yyyyyyyyyy', 'yyyyyyyyyy', '.yyyyyyyy.', '..yyyyyy..', '...yyyy...'], [
    '...yyyy...', '..yyyyyy..', '.yyyyyyyy.', 'yyyyyykyy.', 'yyyyyyy...',
    'yyyyyyy...', 'yyyyyyyy..', '.yyyyyyyy.', '..yyyyyy..', '...yyyy...'], [
    '...yyyy...', '..yyyyyy..', '.yyyyyyy..', 'yyyyyky...', 'yyyyy.....',
    'yyyyy.....', 'yyyyyyy...', '.yyyyyyy..', '..yyyyyy..', '...yyyy...']];
  var MUNCH_PAL = { y: '#ffec27', k: '#10131c' };
  var GHOST = [[
    '...gggg...', '..gggggg..', '.gggggggg.', '.gggggggg.', 'gggggggggg',
    'gggggggggg', 'gggggggggg', 'gggggggggg', 'gggggggggg', 'ggg.gg.ggg'], [
    '...gggg...', '..gggggg..', '.gggggggg.', '.gggggggg.', 'gggggggggg',
    'gggggggggg', 'gggggggggg', 'gggggggggg', 'gggggggggg', 'gg.gggg.gg']];
  var PELLET = ['..oo..', '.oooo.', 'oooooo', 'oooooo', '.oooo.', '..oo..'];
  var FRUITS = [
    { name: 'cherry', pts: 100, pal: { g: '#00e436', r: '#ff004d', w: '#fff1e8' }, rows: [
      '.....gg..', '....g..g.', '...g....g', '..g.....g', '.rrr..rrr', 'rrwr.rrwr', 'rrrr.rrrr', '.rr...rr.', '.........'] },
    { name: 'strawberry', pts: 300, pal: { g: '#00e436', r: '#ff004d', w: '#ffec27' }, rows: [
      '..g.g.g..', '...ggg...', '.rrrrrrr.', 'rrwrrrwrr', 'rrrrwrrrr', '.rrwrrwr.', '..rrrrr..', '...rrr...', '....r....'] },
    { name: 'orange', pts: 500, pal: { g: '#00e436', o: '#ffa300', w: '#ffec27' }, rows: [
      '....g....', '...ggg...', '..ooooo..', '.oowoooo.', '.ooooooo.', '.ooooooo.', '.ooooooo.', '..ooooo..', '...ooo...'] },
    { name: 'apple', pts: 700, pal: { b: '#ab5236', g: '#00e436', r: '#ff004d', w: '#fff1e8' }, rows: [
      '....b.g..', '.rrrbrrr.', 'rrwrrrrrr', 'rrwrrrrrr', 'rrrrrrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rr.rr..', '.........'] },
    { name: 'melon', pts: 1000, pal: { l: '#7dff7a', d: '#00a845' }, rows: [
      '..lllll..', '.lldldll.', 'lldldldll', 'ldldldldl', 'lldldldll', 'lldldldll', '.lldldll.', '..lllll..', '.........'] },
    { name: 'bell', pts: 2000, pal: { y: '#ffec27', w: '#fff1e8', o: '#ffa300' }, rows: [
      '....y....', '...yyy...', '..yywyy..', '..yywyy..', '.yyyyyyy.', '.yyyyyyy.', 'yyyyyyyyy', '....o....', '.........'] }
  ];
  var GHOST_DEFS = [
    { name: 'blaze', ai: 'chase', col: '#ff004d', corner: [17, 0], release: 0 },
    { name: 'pinky', ai: 'ambush', col: '#ff77a8', corner: [1, 0], release: 2.5 },
    { name: 'bolt', ai: 'random', col: '#3de2ff', corner: [17, 20], release: 6 },
    { name: 'amber', ai: 'patrol', col: '#ffa300', corner: [1, 20], release: 10 }
  ];
  var SPR = { munch: [], ghost: {}, pellet: null, fruit: [] };

  /* ---------------------------------------------------------- state */
  var dots, dotsLeft, dotsEaten, level, stt, stT, tAnim, p, ghosts, want, wantT, fruit, fruitSpawned;
  var frightT, ghostCombo, phaseIdx, phaseT, nextLife, waka, mazeNormal, mazeFlash, eatenThisPellet, deathT;
  var distEyes, distLeave;
  var PHASES = [['scatter', 6], ['chase', 18], ['scatter', 5], ['chase', 20], ['scatter', 4], ['chase', 1e9]];

  /* ---------------------------------------------------------- maze helpers */
  function isWall(x, y) {
    if (y < 0 || y >= ROWS) return true;
    if (x < 0 || x >= COLS) return y !== TUN_ROW;
    return MAZE[y].charAt(x) === '#';
  }
  function isOpen(tx, ty, doorOK) {
    if (ty < 0 || ty >= ROWS || tx < -1 || tx > COLS) return false;
    if (tx === -1 || tx === COLS) return ty === TUN_ROW;
    var c = MAZE[ty].charAt(tx);
    if (c === '#') return false;
    if (c === '-') return !!doorOK;
    return true;
  }

  function bfsField(gx, gy) {
    var f = [], y;
    for (y = 0; y < ROWS; y++) f.push(new Array(COLS).fill(999));
    f[gy][gx] = 0;
    var q = [[gx, gy]];
    while (q.length) {
      var c = q.shift();
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + DX[d], ny = c[1] + DY[d];
        if (nx < 0 || nx >= COLS || !isOpen(nx, ny, true) || f[ny][nx] !== 999) continue;
        f[ny][nx] = f[c[1]][c[0]] + 1; q.push([nx, ny]);
      }
    }
    return f;
  }
  function fieldAt(f, x, y) { return (x < 0 || x >= COLS || y < 0 || y >= ROWS) ? 999 : f[y][x]; }

  function buildMazeCanvas(rim, mid) {
    var cv = document.createElement('canvas');
    cv.width = COLS * T; cv.height = ROWS * T;
    var g = cv.getContext('2d'), x, y;
    g.fillStyle = '#05060f'; g.fillRect(0, 0, cv.width, cv.height);
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
      if (!isWall(x, y)) continue;
      var px = x * T, py = y * T;
      g.fillStyle = '#0a1040'; g.fillRect(px, py, T, T);
      var up = !isWall(x, y - 1), dn = !isWall(x, y + 1), lf = !isWall(x - 1, y), rt = !isWall(x + 1, y);
      if (up) { g.fillStyle = mid; g.fillRect(px, py + 1, T, 1); g.fillStyle = rim; g.fillRect(px, py, T, 1); }
      if (dn) { g.fillStyle = mid; g.fillRect(px, py + T - 2, T, 1); g.fillStyle = rim; g.fillRect(px, py + T - 1, T, 1); }
      if (lf) { g.fillStyle = mid; g.fillRect(px + 1, py, 1, T); g.fillStyle = rim; g.fillRect(px, py, 1, T); }
      if (rt) { g.fillStyle = mid; g.fillRect(px + T - 2, py, 1, T); g.fillStyle = rim; g.fillRect(px + T - 1, py, 1, T); }
      g.fillStyle = rim;
      if (!up && !lf && !isWall(x - 1, y - 1)) g.fillRect(px, py, 1, 1);
      if (!up && !rt && !isWall(x + 1, y - 1)) g.fillRect(px + T - 1, py, 1, 1);
      if (!dn && !lf && !isWall(x - 1, y + 1)) g.fillRect(px, py + T - 1, 1, 1);
      if (!dn && !rt && !isWall(x + 1, y + 1)) g.fillRect(px + T - 1, py + T - 1, 1, 1);
    }
    g.fillStyle = '#ff77a8'; g.fillRect(DOOR[0] * T, DOOR[1] * T + 3, T, 2);
    return cv;
  }

  /* ---------------------------------------------------------- entities */
  function mkEnt(tx, ty, dir) { return { tx: tx, ty: ty, dir: dir, prog: 0, face: dir < 0 ? 2 : dir }; }
  function entPos(e) {
    var x = e.tx * T + T / 2, y = e.ty * T + T / 2;
    if (e.dir >= 0) { x += DX[e.dir] * e.prog; y += DY[e.dir] * e.prog; }
    return { x: x, y: y };
  }
  function reverse(e) {
    if (e.dir < 0) return;
    if (e.prog > 0) { e.tx += DX[e.dir]; e.ty += DY[e.dir]; e.prog = T - e.prog; }
    e.dir = OPP[e.dir];
  }
  /** move an entity `d` pixels along the tile grid; `choose` picks a direction whenever it sits on a tile centre */
  function advance(e, d, choose, arrive) {
    var guard = 0;
    while (d > 1e-6 && guard++ < 10) {
      if (e.prog === 0) {
        var nd = choose(e);
        e.dir = nd;
        if (nd < 0) return;
        e.face = nd;
      }
      var step = Math.min(d, T - e.prog);
      e.prog += step; d -= step;
      if (e.prog >= T - 1e-6) {
        e.tx += DX[e.dir]; e.ty += DY[e.dir]; e.prog = 0;
        if (e.tx < 0 && e.dir === 2) e.tx = COLS; else if (e.tx >= COLS && e.dir === 0) e.tx = -1;
        if (arrive) arrive(e);
      }
    }
  }

  /* ---------------------------------------------------------- setup */
  function fillDots() {
    dots = []; dotsLeft = 0;
    for (var y = 0; y < ROWS; y++) {
      var row = [];
      for (var x = 0; x < COLS; x++) {
        var c = MAZE[y].charAt(x), v = c === '.' ? 1 : c === 'o' ? 2 : 0;
        if (v) dotsLeft++;
        row.push(v);
      }
      dots.push(row);
    }
  }

  function levelScale() { return Math.max(0.35, 1 - 0.12 * (level - 1)); }

  function resetActors() {
    p = mkEnt(PLAYER_START[0], PLAYER_START[1], 2);
    want = -1; wantT = 0;
    ghosts = GHOST_DEFS.map(function (def, i) {
      var g;
      if (i === 0) { g = mkEnt(9, 7, 2); g.mode = 'active'; }
      else { g = mkEnt(i === 1 ? 9 : i === 2 ? 8 : 10, 9, -1); g.mode = 'pen'; }
      g.def = def; g.ai = def.ai; g.fright = false; g.releaseT = def.release * levelScale(); g.wp = i === 3 ? 3 : 0; g.wpT = 0;
      return g;
    });
    frightT = 0; ghostCombo = 0; phaseIdx = 0; phaseT = PHASES[0][1] * levelScale(); eatenThisPellet = 0;
    fruit = null; deathT = 0;
  }

  function startLevel() {
    fillDots(); dotsEaten = 0; fruitSpawned = [false, false];
    R.level = level;
    resetActors();
    stt = 'ready'; stT = 2.0;
  }

  function phase() { return PHASES[phaseIdx][0]; }

  /* ---------------------------------------------------------- ghost brain */
  function ghostSpeed(g) {
    if (g.mode === 'eyes') return 118;
    if (g.mode === 'leave') return 34;
    var s = Math.min(62, 46 + (level - 1) * 2.4);
    if (g.fright) s = 27;
    else if (g.ai === 'chase' && dotsLeft < 24) s *= 1.08;
    if (g.ty === TUN_ROW && (g.tx < 4 || g.tx > 14)) s *= 0.55;
    return s;
  }

  function targetFor(g) {
    var ptx = p.tx, pty = p.ty;
    if (phase() === 'scatter' && (g.ai === 'chase' || g.ai === 'ambush')) return g.def.corner;
    switch (g.ai) {
      case 'ambush': return [ptx + DX[p.face] * 4, pty + DY[p.face] * 4];
      case 'patrol':
        var wp = PATROL[g.wp];
        if (Math.abs(g.tx - wp[0]) + Math.abs(g.ty - wp[1]) < 3) { g.wp = (g.wp + 1) % 4; g.wpT = 0; }
        if (Math.abs(g.tx - ptx) + Math.abs(g.ty - pty) < 6) return [ptx, pty];
        return PATROL[g.wp];
      default: return [ptx, pty];
    }
  }

  function ghostChoose(g) {
    var doorOK = g.mode === 'leave' || g.mode === 'eyes';
    var free = g.mode === 'leave' || g.mode === 'eyes';
    var cands = [], i, d;
    var order = [3, 2, 1, 0];
    for (i = 0; i < 4; i++) {
      d = order[i];
      if (!free && g.dir >= 0 && d === OPP[g.dir]) continue;
      if (isOpen(g.tx + DX[d], g.ty + DY[d], doorOK)) cands.push(d);
    }
    if (!cands.length) {
      if (g.dir >= 0 && isOpen(g.tx + DX[OPP[g.dir]], g.ty + DY[OPP[g.dir]], doorOK)) return OPP[g.dir];
      return -1;
    }
    if (g.mode === 'leave' || g.mode === 'eyes') {
      var f = g.mode === 'leave' ? distLeave : distEyes, best = cands[0], bv = 1e9;
      for (i = 0; i < cands.length; i++) { var v = fieldAt(f, g.tx + DX[cands[i]], g.ty + DY[cands[i]]); if (v < bv) { bv = v; best = cands[i]; } }
      return best;
    }
    if (cands.length === 1) return cands[0];
    if (g.fright) {
      // frightened ghosts run away from the muncher (with some panic mixed in)
      if (Math.random() < 0.35) return U.pick(cands);
      var far = cands[0], fd = -1;
      for (i = 0; i < cands.length; i++) {
        var ax = g.tx + DX[cands[i]] - p.tx, ay = g.ty + DY[cands[i]] - p.ty, ad = ax * ax + ay * ay;
        if (ad > fd) { fd = ad; far = cands[i]; }
      }
      return far;
    }
    if (g.ai === 'random' && Math.random() < 0.75) return U.pick(cands);
    var t = targetFor(g), bd = 1e9, bc = cands[0];
    for (i = 0; i < cands.length; i++) {
      var nx = g.tx + DX[cands[i]] - t[0], ny = g.ty + DY[cands[i]] - t[1], dd = nx * nx + ny * ny;
      if (dd < bd) { bd = dd; bc = cands[i]; }
    }
    return bc;
  }

  function ghostArrive(g) {
    if (g.mode === 'leave' && g.tx === EXIT[0] && g.ty === EXIT[1]) {
      g.mode = 'active'; g.fright = frightT > 0;
      g.dir = 2; g.prog = 0;
    } else if (g.mode === 'eyes' && g.tx === PEN[0] && g.ty === PEN[1]) {
      g.mode = 'leave'; g.fright = false;
      R.sfx.tone(520, 0.12, { type: 'triangle', vol: 0.07, slide: 880 });
    }
  }

  /* ---------------------------------------------------------- events */
  function startFright() {
    var dur = Math.max(1.8, 7.5 - (level - 1) * 0.9);
    frightT = dur; ghostCombo = 0; eatenThisPellet = 0;
    ghosts.forEach(function (g) {
      if (g.mode === 'active') { g.fright = true; reverse(g); }
      else if (g.mode === 'leave') g.fright = true;
    });
    R.sfx.play('powerup'); R.vibrate(12);
  }

  function checkLife() {
    if (R.score >= nextLife) {
      nextLife += 10000;
      if (R.lives < 6) { R.lives++; R.sfx.play('powerup'); R.fx.text(76, OY + 11 * T, '1UP!', C.lime); }
    }
  }

  function eatDot(tx, ty) {
    if (tx < 0 || tx >= COLS) return;
    var v = dots[ty][tx];
    if (!v) return;
    dots[ty][tx] = 0; dotsLeft--; dotsEaten++;
    if (v === 2) { R.addScore(50); startFright(); }
    else { R.addScore(10); waka ^= 1; R.sfx.tone(waka ? 470 : 360, 0.045, { type: 'square', vol: 0.055 }); }
    checkLife();
    if (!fruit) {
      if (!fruitSpawned[0] && dotsEaten >= 42) { fruitSpawned[0] = true; fruit = { t: 9.5 }; }
      else if (!fruitSpawned[1] && dotsEaten >= 100) { fruitSpawned[1] = true; fruit = { t: 9.5 }; }
    }
    if (dotsLeft <= 0) levelCleared();
  }

  function levelCleared() {
    stt = 'win'; stT = 2.4;
    R.sfx.play('win'); R.fx.flash(C.white, 0.15);
    R.achieve('maze1');
  }

  function eatGhost(g) {
    var pts = 200 * Math.pow(2, ghostCombo);
    ghostCombo = Math.min(ghostCombo + 1, 3); eatenThisPellet++;
    R.addScore(pts); checkLife();
    var pos = entPos(g);
    R.fx.text(pos.x, pos.y + OY - 4, '' + pts, C.cyan);
    R.fx.burst(pos.x, pos.y + OY, { n: 14, color: [g.def.col, C.white, C.blue], speed: 70, life: 0.5, size: 2 });
    g.mode = 'eyes'; g.fright = false;
    R.sfx.tone(300, 0.18, { type: 'square', vol: 0.12, slide: 1200 });
    R.vibrate(25);
    R.achieve('ghost');
    if (eatenThisPellet >= 4) R.achieve('quad');
    stt = 'freeze'; stT = 0.45;
  }

  function killPlayer() {
    stt = 'dying'; stT = 2.0; deathT = 0;
    R.lives = Math.max(0, R.lives - 1);
    R.sfx.tone(700, 1.05, { type: 'sawtooth', vol: 0.12, slide: 70, delay: 0.5 });
    R.vibrate(110); R.fx.shake(2, 0.2);
  }

  /* ---------------------------------------------------------- per-frame logic */
  function readInput() {
    var d;
    for (d = 0; d < 4; d++) if (R.input.pressed(DIRS[d])) { want = d; wantT = 0.7; }
    if (want >= 0 && R.input.held[DIRS[want]]) wantT = 0.7;
    else if (want < 0) for (d = 0; d < 4; d++) if (R.input.held[DIRS[d]]) { want = d; wantT = 0.7; }
  }

  function playerChoose(e) {
    if (want >= 0 && isOpen(e.tx + DX[want], e.ty + DY[want], false)) return want;
    if (e.dir >= 0 && isOpen(e.tx + DX[e.dir], e.ty + DY[e.dir], false)) return e.dir;
    return -1;
  }

  function playerArrive(e) {
    eatDot(e.tx, e.ty);
  }

  function updatePlay(dt) {
    var i, g;
    readInput();
    wantT -= dt;
    if (wantT <= 0 && want >= 0 && !R.input.held[DIRS[want]]) want = -1;
    if (want >= 0 && p.dir >= 0 && want === OPP[p.dir] && p.prog > 0) reverse(p);
    advance(p, 56 * dt, playerChoose, playerArrive);
    if (stt !== 'play') return;

    // scatter / chase schedule (paused while ghosts are frightened)
    if (frightT > 0) {
      frightT -= dt;
      if (frightT <= 0) ghosts.forEach(function (gh) { gh.fright = false; });
    } else {
      phaseT -= dt;
      if (phaseT <= 0 && phaseIdx < PHASES.length - 1) {
        phaseIdx++; phaseT = PHASES[phaseIdx][1] * (PHASES[phaseIdx][0] === 'scatter' ? levelScale() : 1);
        ghosts.forEach(function (gh) { if (gh.mode === 'active') reverse(gh); });
      }
    }

    for (i = 0; i < ghosts.length; i++) {
      g = ghosts[i];
      if (g.mode === 'pen') { g.releaseT -= dt; if (g.releaseT <= 0) g.mode = 'leave'; continue; }
      g.wpT += dt; if (g.wpT > 9) { g.wpT = 0; g.wp = (g.wp + 1) % 4; }
      advance(g, ghostSpeed(g) * dt, ghostChoose, ghostArrive);
    }

    // bonus fruit
    if (fruit) {
      fruit.t -= dt;
      var pp = entPos(p), fp = [FRUIT_AT[0] * T + T / 2, FRUIT_AT[1] * T + T / 2];
      if (Math.abs(pp.x - fp[0]) < 5 && Math.abs(pp.y - fp[1]) < 5) {
        var fr = FRUITS[Math.min(level - 1, FRUITS.length - 1)];
        R.addScore(fr.pts); checkLife();
        R.fx.text(fp[0], fp[1] + OY - 4, '' + fr.pts, C.pink);
        R.fx.burst(fp[0], fp[1] + OY, { n: 12, color: [C.pink, C.yellow, C.white], speed: 60, life: 0.5, size: 2 });
        R.sfx.play('coin'); R.vibrate(15); R.achieve('fruit');
        fruit = null;
      } else if (fruit.t <= 0) fruit = null;
    }

    // muncher meets ghost
    var a = entPos(p);
    for (i = 0; i < ghosts.length; i++) {
      g = ghosts[i];
      if (g.mode !== 'active' && g.mode !== 'leave') continue;
      var b = entPos(g);
      if (Math.abs(a.x - b.x) < 6 && Math.abs(a.y - b.y) < 6) {
        if (g.fright) { eatGhost(g); return; }
        if (g.mode === 'active') { killPlayer(); return; }
      }
    }
  }

  function nextLevel() {
    level++; startLevel();
    R.sfx.play('start');
  }

  /* ---------------------------------------------------------- game */
  R.game({
    layout: 'full', size: [COLS * T, ROWS * T + OY], bg: '#05060f', music: 'retro',

    init: function () {
      distEyes = bfsField(PEN[0], PEN[1]);
      distLeave = bfsField(EXIT[0], EXIT[1]);
      mazeNormal = buildMazeCanvas('#5b86ff', '#2a45d8');
      mazeFlash = buildMazeCanvas('#fff1e8', '#8fb5ff');
      SPR.munch = [0, 1, 2, 3].map(function (d) {
        return MUNCH.map(function (rows) {
          var r2 = d === 0 ? rows : d === 1 ? rotCW(rows) : d === 2 ? flipRows(rows) : rotCW(rotCW(rotCW(rows)));
          return R.sprite(r2, MUNCH_PAL);
        });
      });
      GHOST_DEFS.forEach(function (def) { SPR.ghost[def.name] = GHOST.map(function (rows) { return R.sprite(rows, { g: def.col }); }); });
      SPR.ghost.fright = GHOST.map(function (rows) { return R.sprite(rows, { g: '#3a4bff' }); });
      SPR.ghost.flash = GHOST.map(function (rows) { return R.sprite(rows, { g: '#fff1e8' }); });
      SPR.pellet = R.sprite(PELLET, { o: '#fff1e8' });
      SPR.fruit = FRUITS.map(function (f) { return R.sprite(f.rows, f.pal); });
    },

    reset: function () {
      level = 1; waka = 0; tAnim = 0; nextLife = 10000;
      R.lives = 3; R.level = 1;
      startLevel();
    },

    update: function (dt) {
      tAnim += dt;
      if (stt === 'ready') { stT -= dt; if (stT <= 0) stt = 'play'; return; }
      if (stt === 'freeze') { stT -= dt; if (stT <= 0) stt = 'play'; return; }
      if (stt === 'win') { stT -= dt; if (stT <= 0) nextLevel(); return; }
      if (stt === 'dying') {
        stT -= dt; deathT += dt;
        if (stT <= 0) {
          if (R.lives <= 0) { R.gameOver(); return; }
          resetActors(); stt = 'ready'; stT = 1.6;
        }
        return;
      }
      updatePlay(dt);
    },

    render: function (ctx, W, H) {
      var x, y, i;
      var flashing = stt === 'win' && Math.floor(stT / 0.2) % 2 === 0;
      ctx.drawImage(flashing ? mazeFlash : mazeNormal, 0, OY);

      // dots
      var blink = Math.floor(tAnim / 0.22) % 2 === 0;
      for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
        var v = dots[y][x];
        if (v === 1) { ctx.fillStyle = '#ffccaa'; ctx.fillRect(x * T + 3, OY + y * T + 3, 2, 2); }
        else if (v === 2 && (blink || stt !== 'play')) R.draw.sprite(ctx, SPR.pellet, x * T + 1, OY + y * T + 1);
      }

      // bonus fruit
      if (fruit && (fruit.t > 2 || Math.floor(tAnim / 0.15) % 2 === 0)) {
        R.draw.sprite(ctx, SPR.fruit[Math.min(level - 1, FRUITS.length - 1)], FRUIT_AT[0] * T - 0, OY + FRUIT_AT[1] * T - 0);
      }

      // ghosts (hidden while the level-clear animation plays or after the muncher is caught)
      var showGhosts = stt !== 'win' && !(stt === 'dying' && deathT > 0.55);
      if (showGhosts) for (i = 0; i < ghosts.length; i++) drawGhost(ctx, ghosts[i], i);

      // muncher
      drawMuncher(ctx);

      // READY!
      if (stt === 'ready' && R.mode === 'play') R.draw.text(ctx, 'READY!', W / 2, OY + 11 * T + 1, { size: 8, color: C.yellow, align: 'center' });

      // bottom strip: level number & fruit
      R.draw.text(ctx, 'LV ' + U.pad(level, 2), 4, OY + 20 * T + 2, { size: 6, color: '#8fb5ff' });
      var fx0 = W - 4 - 11 * Math.min(level, 4);
      for (i = 0; i < Math.min(level, 4); i++) {
        var fidx = Math.min(Math.max(level - 4, 0) + i, FRUITS.length - 1);
        R.draw.sprite(ctx, SPR.fruit[Math.min(fidx, FRUITS.length - 1)], fx0 + i * 11, OY + 20 * T - 1);
      }
      R.draw.topBar(ctx);
    },

    serialize: function () {
      var s = '';
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) s += dots[y][x];
      return { dots: s, level: level, eaten: dotsEaten, f: fruitSpawned };
    },
    restore: function (s) {
      level = s.level; dotsEaten = s.eaten; fruitSpawned = s.f || [false, false];
      dots = []; dotsLeft = 0;
      for (var y = 0; y < ROWS; y++) {
        var row = [];
        for (var x = 0; x < COLS; x++) { var v = parseInt(s.dots.charAt(y * COLS + x), 10) || 0; if (v) dotsLeft++; row.push(v); }
        dots.push(row);
      }
      R.level = level;
      resetActors(); stt = 'ready'; stT = 1.5;
    }
  });

  function drawMuncher(ctx) {
    var pos = entPos(p), cx = Math.round(pos.x), cy = Math.round(pos.y) + OY;
    if (stt === 'dying') {
      if (deathT < 0.5) { drawMuncherSprite(ctx, cx, cy, 1, 2); return; }
      var f = (deathT - 0.5) / 1.1;
      if (f >= 1) return;
      var th = f * Math.PI;
      ctx.fillStyle = '#ffec27';
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 5, -Math.PI / 2 + th, -Math.PI / 2 + Math.PI * 2 - th);
      ctx.closePath(); ctx.fill();
      if (!p.popped && f > 0.92) { p.popped = true; R.fx.burst(cx, cy, { n: 14, color: ['#ffec27', '#fff1e8'], speed: 70, life: 0.5, size: 2 }); }
      return;
    }
    var moving = p.dir >= 0 && stt === 'play';
    var fr = moving ? [0, 1, 2, 1][Math.floor(tAnim / 0.06) % 4] : 1;
    drawMuncherSprite(ctx, cx, cy, p.face, fr);
  }
  function drawMuncherSprite(ctx, cx, cy, face, fr) { R.draw.sprite(ctx, SPR.munch[face][fr], cx - 5, cy - 5); }

  function drawGhost(ctx, g, idx) {
    var pos = entPos(g), cx = Math.round(pos.x), cy = Math.round(pos.y) + OY;
    if (g.mode === 'pen') cy += Math.round(Math.sin(tAnim * 7 + idx * 2));
    var fr = Math.floor(tAnim / 0.14) % 2, d = g.dir >= 0 ? g.dir : g.face;
    var ex = cx - 5, ey = cy - 5;
    if (g.mode !== 'eyes') {
      var spr;
      if (g.fright) spr = (frightT < 2 && Math.floor(tAnim / 0.16) % 2 === 0) ? SPR.ghost.flash[fr] : SPR.ghost.fright[fr];
      else spr = SPR.ghost[g.def.name][fr];
      R.draw.sprite(ctx, spr, ex, ey);
    }
    if (g.fright && g.mode !== 'eyes') {
      var flashWhite = frightT < 2 && Math.floor(tAnim / 0.16) % 2 === 0;
      ctx.fillStyle = flashWhite ? '#ff004d' : '#ffccaa';
      ctx.fillRect(ex + 2, ey + 3, 2, 2); ctx.fillRect(ex + 6, ey + 3, 2, 2);
      for (var k = 0; k < 4; k++) ctx.fillRect(ex + 1 + k * 2 + (k > 1 ? 0 : 0), ey + 7 - (k % 2), 2, 1);
      return;
    }
    // eyes
    var lx = ex + 2, rx = ex + 6, ty = ey + 3;
    ctx.fillStyle = '#fff1e8'; ctx.fillRect(lx, ty, 2, 3); ctx.fillRect(rx, ty, 2, 3);
    ctx.fillStyle = '#1d2bd8';
    var ox = d === 0 ? 1 : 0;
    if (d === 0 || d === 2) { ctx.fillRect(lx + ox, ty + 1, 1, 2); ctx.fillRect(rx + ox, ty + 1, 1, 2); }
    else { ctx.fillRect(lx, ty + (d === 3 ? 0 : 2), 2, 1); ctx.fillRect(rx, ty + (d === 3 ? 0 : 2), 2, 1); }
  }
})();
