/* Bomb Maze — place bombs, blast crates, outsmart the critters, find the exit. Built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util, D = R.draw;
  var W = 136, H = 164, T = 10, GW = 13, GH = 11, OX = 3, OY = 22;
  var FUSE = 2.5, FLAME_T = 0.5, FAILSAFE = 8, MAX_LEVEL = 10;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];                         // 0 up · 1 right · 2 down · 3 left
  var CRATE = 2, PILLAR = 1;

  /* ------------------------------------------------------------ helpers */
  function grid(w, h, fn) { var rows = [], x, y, r; for (y = 0; y < h; y++) { r = ''; for (x = 0; x < w; x++) r += fn(x, y); rows.push(r); } return rows; }
  function checkRows(name, rows, w, h) {
    if (rows.length !== h) throw new Error('sprite ' + name + ' has ' + rows.length + ' rows, want ' + h);
    rows.forEach(function (r, i) { if (r.length !== w) throw new Error('sprite ' + name + ' row ' + i + ' has ' + r.length + ' chars, want ' + w); });
  }
  function hsh(x, y, s) { var n = (x * 374761393 + y * 668265263 + s * 144665) | 0; n = (n ^ (n >> 13)) * 1274126177 | 0; return ((n ^ (n >> 16)) >>> 0) % 100; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, rnd) { var i, j, t; for (i = arr.length - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  function cpx(c) { return (c + 0.5) * T; }                       // centre of a cell in grid pixels
  function oob(cx, cy) { return cx < 0 || cy < 0 || cx >= GW || cy >= GH; }
  var spriteCache = {};
  function S_(key, rows, pal) { return spriteCache[key] || (spriteCache[key] = R.sprite(rows, pal, 1)); }

  /* ------------------------------------------------------------ sprites */
  var HP = { c: '#ff3a5e', C: '#ff9ab0', s: '#ffd9b8', e: '#1d2b53', m: '#c0304a', t: '#27d9c3', T: '#14907f', w: '#ffffff', b: '#2a2a4a' };
  var HERO = {
    d: ['...cccc...', '..cCcccc..', '.cccccccc.', '.ssssssss.', '.sesssses.', '.ssmmmmss.', '..tttttt..', '.wttttttw.', '..tt..tt..', '..bb..bb..'],
    dB: ['...cccc...', '..cCcccc..', '.cccccccc.', '.ssssssss.', '.sesssses.', '.ssmmmmss.', '..tttttt..', '.wttttttw.', '..tttttt..', '...bbbb...'],
    u: ['...cccc...', '..cCcccc..', '.cccccccc.', '.cccccccc.', '.cccccccc.', '..cccccc..', '..tttttt..', '.wttttttw.', '..tt..tt..', '..bb..bb..'],
    uB: ['...cccc...', '..cCcccc..', '.cccccccc.', '.cccccccc.', '.cccccccc.', '..cccccc..', '..tttttt..', '.wttttttw.', '..tttttt..', '...bbbb...'],
    r: ['...cccc...', '..cCcccc..', '.ccccccccc', '.ssssssss.', '.sssssses.', '.ssssssmm.', '..tttttt..', '..ttttttw.', '..tt..tt..', '..bb..bb..'],
    rB: ['...cccc...', '..cCcccc..', '.ccccccccc', '.ssssssss.', '.sssssses.', '.ssssssmm.', '..tttttt..', '..ttttttw.', '..tttttt..', '...bbbb...']
  };
  var BLOB = [['..oooooo..', '.oOOOOOOo.', 'oOOOOOOOOo', 'oOwwOOwwOo', 'oOwewOwewo', 'oOOOOOOOOo', 'oOOmmmmOOo', '.oOOOOOOo.', '.oooooooo.', '..oo..oo..'],
    ['..oooooo..', '.oOOOOOOo.', 'oOOOOOOOOo', 'oOwwOOwwOo', 'oOwewOwewo', 'oOOOOOOOOo', 'oOOmmmmOOo', 'oOOOOOOOOo', '.oooooooo.', '...oooo...']];
  var BLOB_PAL = { o: '#a8481a', O: '#ff8a3a', w: '#ffffff', e: '#1d2b53', m: '#7a2010' };
  var CHASER = [['p...pp...p', 'pp.pppp.pp', '.pppppppp.', 'ppwwppwwpp', 'pwrwppwrwp', 'pppppppppp', 'ppwpwpwppp', '.pppppppp.', '..pp..pp..', '..pp..pp..'],
    ['p...pp...p', 'pp.pppp.pp', '.pppppppp.', 'ppwwppwwpp', 'pwrwppwrwp', 'pppppppppp', 'ppwpwpwppp', '.pppppppp.', '.pp....pp.', '.pp....pp.']];
  var CHASER_PAL = { p: '#9a3be0', w: '#ffffff', r: '#ff1a3a' };
  var WISP = [['...cccc...', '..cCCCCc..', '.cCCCCCCc.', '.cCkCCkCc.', '.cCCCCCCc.', '.cCCmmCCc.', '.cCCCCCCc.', '.cCCCCCCc.', '.cc.cc.cc.', '..........'],
    ['...cccc...', '..cCCCCc..', '.cCCCCCCc.', '.cCkCCkCc.', '.cCCCCCCc.', '.cCCmmCCc.', '.cCCCCCCc.', '.cCCCCCCc.', '..cc.cc.c.', '..........']];
  var WISP_PAL = { c: '#3dc6ff', C: '#b8f0ff', k: '#1d2b53', m: '#2a6a9a' };
  var PU = {
    fire: ['.kkkkkkkk.', 'krrrrrrrrk', 'krrrryrrrk', 'krrrYYrrrk', 'krrYYOYrrk', 'krYYOOYYrk', 'krYOOOOYrk', 'krrYOOYrrk', 'krrrrrrrrk', '.kkkkkkkk.'],
    bomb: ['.kkkkkkkk.', 'kbbbbbbyBk', 'kbbbbbyybk', 'kbbddddbbk', 'kbdDwddddk', 'kbdwdddddk', 'kbddddddbk', 'kbbddddbbk', 'kbbbbbbbbk', '.kkkkkkkk.'],
    boot: ['.kkkkkkkk.', 'kggggggggk', 'kgggwwgggk', 'kgggwwgggk', 'kgggwwgggk', 'kgggwwwwgk', 'kggwwwwwwk', 'kgwwwwwwwk', 'kggggggggk', '.kkkkkkkk.'],
    remote: ['.kkkkkkkk.', 'kppppppppk', 'kpppprpppk', 'kppprrrppk', 'kppprrrppk', 'kpppwwwppk', 'kppwwwwwpk', 'kppwwwwwpk', 'kppppppppk', '.kkkkkkkk.'],
    shield: ['.kkkkkkkk.', 'kcccccccck', 'kcwwwwwwck', 'kcwBBBBwck', 'kcwBBBBwck', 'kcwBBBBwck', 'kccwBBwcck', 'kcccwwccck', 'kcccccccck', '.kkkkkkkk.']
  };
  var PU_PAL = { fire: { k: '#1d2b53', r: '#c8301a', y: '#ffec27', Y: '#ffd23a', O: '#ff8a1a' },
    bomb: { k: '#1d2b53', b: '#2a6ad8', B: '#ffd23a', y: '#ffec27', d: '#14141e', D: '#14141e', w: '#9fb0e0' },
    boot: { k: '#1d2b53', g: '#1fa84a', w: '#ffffff' }, remote: { k: '#1d2b53', p: '#8a3be0', r: '#ff3a4d', w: '#e8d8ff' },
    shield: { k: '#1d2b53', c: '#1a8ad8', w: '#e8f8ff', B: '#3dc6ff' } };
  var PU_NAMES = ['fire', 'bomb', 'boot', 'remote', 'shield'];
  var BOMB = ['..........', '.......yw.', '......y...', '...kkkk...', '..kKKkkk..', '.kKwkkkkk.', '.kKkkkkkk.', '.kkkkkkkk.', '..kkkkkk..', '...kkkk...'];
  var BOMB_PAL = { k: '#14141e', K: '#3a3a5a', w: '#ffffff', y: '#ffec27' };
  var DOOR = grid(10, 10, function (x, y) {
    if (x === 0 || x === 9 || y === 0) return 'f';
    if (x === 1 || x === 8 || y === 1) return 'F';
    return 'd';
  });
  var tilesCache = {};

  function buildTiles() {
    var t = {};
    t.floorA = R.sprite(grid(10, 10, function (x, y) { if (x === 0 || y === 0) return 'b'; return hsh(x, y, 2) < 6 ? 'c' : 'a'; }), { a: '#1d6354', b: '#22705f', c: '#185a4c' }, 1);
    t.floorB = R.sprite(grid(10, 10, function (x, y) { if (x === 0 || y === 0) return 'b'; return hsh(x, y, 5) < 6 ? 'c' : 'a'; }), { a: '#195b4d', b: '#1f6858', c: '#154f43' }, 1);
    t.pillar = R.sprite(grid(10, 10, function (x, y) {
      if (x === 0 || y === 0) return 'L'; if (x === 9 || y === 9) return 'K';
      if (x === 1 || y === 1) return 'L'; if (x === 8 || y === 8) return 'K';
      if ((x === 2 && y === 2) || (x === 7 && y === 2) || (x === 2 && y === 7) || (x === 7 && y === 7)) return 'r';
      return 'M';
    }), { L: '#a4b4f0', M: '#6a7cc4', K: '#34407a', r: '#dfe6ff' }, 1);
    t.crate = R.sprite(grid(10, 10, function (x, y) {
      if (x === 0 || y === 0 || x === 9 || y === 9) return 'd';
      if (x === 1 || y === 1) return 'l';
      if (x === 8 || y === 8) return 'q';
      if (x === y || x + y === 9) return 'p';
      return 'o';
    }), { d: '#6b3314', l: '#ffc46b', o: '#e8903a', p: '#c4601a', q: '#a24b14' }, 1);
    t.crateB = R.sprite(grid(10, 10, function (x, y) {
      if (x === 0 || y === 0 || x === 9 || y === 9) return 'd';
      if (x === 1 || y === 1) return 'l';
      if (x === 8 || y === 8) return 'q';
      if (x === y || x + y === 9) return 'p';
      return 'o';
    }), { d: '#6b3314', l: '#fff0c8', o: '#ffb060', p: '#ff7a2a', q: '#c4601a' }, 1);
    return t;
  }

  /* ------------------------------------------------------------ state */
  var level, g, hidden, exitC, exitShown, exitOpen, pickups, bombs, flames, enemies, hero, st;
  var timeLeft, timeMax, phase, phaseT, clock, shownFoes, clearInfo, blastId, kills, lastHint, hintT, collected;
  var gridCanvas = null;

  function tierEnemies(lv) {
    var total = 3 + Math.floor(lv * 0.75), chasers = Math.floor(lv / 3), wisps = lv >= 6 ? Math.floor((lv - 3) / 3) : 0;
    return { total: total, chasers: chasers, wisps: wisps, blobs: total - chasers - wisps };
  }

  /* ------------------------------------------------------------ level generation (seeded: same level number = same maze) */
  function genLevel(lv) {
    var rnd = mulberry(lv * 7919 + 101), x, y, i, safe = {};
    [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]].forEach(function (p) { safe[p[0] + ',' + p[1]] = 1; });
    var p = Math.min(0.66, 0.46 + 0.02 * lv);
    g = []; hidden = [];
    for (y = 0; y < GH; y++) {
      g.push([]); hidden.push([]);
      for (x = 0; x < GW; x++) {
        hidden[y].push(null);
        if (x % 2 === 1 && y % 2 === 1) g[y].push(PILLAR);
        else if (safe[x + ',' + y]) g[y].push(0);
        else g[y].push(rnd() < p ? CRATE : 0);
      }
    }
    var mix = tierEnemies(lv), need = mix.total, far = [], crates = [];
    function collect() {
      far = []; crates = [];
      for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
        if (g[y][x] === 0 && x + y >= 7) far.push([x, y]);
        if (g[y][x] === CRATE) crates.push([x, y]);
      }
    }
    collect();
    shuffle(crates, rnd);
    var guard = 0;
    while (far.length < need + 3 && guard++ < 60) {          // carve more floor so every level has room for its enemies
      var cr = crates.filter(function (c) { return c[0] + c[1] >= 7; });
      if (!cr.length) break;
      var pick = cr[Math.floor(rnd() * cr.length)]; g[pick[1]][pick[0]] = 0; collect();
    }
    shuffle(far, rnd);
    var spawns = [], kinds = [];
    for (i = 0; i < mix.chasers; i++) kinds.push('chaser');
    for (i = 0; i < mix.wisps; i++) kinds.push('wisp');
    for (i = 0; i < mix.blobs; i++) kinds.push('blob');
    var fi;
    for (i = 0; i < kinds.length; i++) {
      var best = -1;
      for (fi = 0; fi < far.length; fi++) {                  // keep enemies a few cells apart where possible
        var f = far[fi], ok = true, j;
        for (j = 0; j < spawns.length; j++) if (Math.abs(spawns[j].cx - f[0]) + Math.abs(spawns[j].cy - f[1]) < 3) { ok = false; break; }
        if (ok) { best = fi; break; }
      }
      if (best < 0) best = 0;
      spawns.push({ k: kinds[i], cx: far[best][0], cy: far[best][1] });
      far.splice(best, 1);
    }
    // exit and power-ups hide under crates
    collect(); shuffle(crates, rnd);
    var ex = crates.filter(function (c) { return c[0] + c[1] >= 9; });
    var exitCell = (ex.length ? ex[0] : crates[0]);
    exitC = { x: exitCell[0], y: exitCell[1] };
    var rest = crates.filter(function (c) { return !(c[0] === exitC.x && c[1] === exitC.y); });
    var nItems = Math.min(rest.length, 5 + Math.ceil(lv / 3)), kindsPU = [];
    kindsPU.push('fire'); kindsPU.push('bomb');
    if (lv >= 2) { kindsPU.push('shield'); kindsPU.push('remote'); }
    if (lv >= 3) kindsPU.push('boot');
    if (lv === 1) kindsPU.push('fire');
    while (kindsPU.length < nItems) { var r = rnd(); kindsPU.push(r < 0.3 ? 'fire' : r < 0.58 ? 'bomb' : r < 0.78 ? 'boot' : r < 0.9 ? 'shield' : 'remote'); }
    for (i = 0; i < nItems; i++) hidden[rest[i][1]][rest[i][0]] = kindsPU[i];
    return spawns;
  }

  function bakeGrid() {
    var tl = tilesCache.t || (tilesCache.t = buildTiles());
    if (!gridCanvas) { gridCanvas = document.createElement('canvas'); gridCanvas.width = GW * T; gridCanvas.height = GH * T; }
    var c = gridCanvas.getContext('2d'), x, y;
    c.imageSmoothingEnabled = false;
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) c.drawImage(g[y][x] === PILLAR ? tl.pillar : ((x + y) % 2 ? tl.floorB : tl.floorA), x * T, y * T);
  }

  function loadLevel(lv) {
    level = lv; R.level = lv;
    var spawns = genLevel(lv), ts = [18 + 1.8 * lv, 22 + 2 * lv, 14 + 1.5 * lv];
    bakeGrid();
    lastHint = false; exitShown = false; exitOpen = false; pickups = []; bombs = []; flames = []; blastId = 0; kills = {}; hintT = 0;
    enemies = spawns.map(function (s) {
      return { k: s.k, cx: s.cx, cy: s.cy, tx: s.cx, ty: s.cy, p: 0, moving: false, dir: U.randInt(0, 4), wait: U.rand(0.3, 1.2), spd: s.k === 'chaser' ? ts[1] : s.k === 'wisp' ? ts[2] : ts[0], anim: U.rand(0, 1), hurt: 0 };
    });
    shownFoes = enemies.length;
    timeMax = Math.max(100, 180 - 8 * lv); timeLeft = timeMax;
    placeHero(); hero.inv = 1.5;
    phase = 'intro'; phaseT = 1.8; collected = 0;
    R.sfx.play('start');
  }

  function placeHero() {
    hero = { x: cpx(0), y: cpx(0), face: 2, anim: 0, moving: false, inv: 0, dead: false, spin: 0, pref: 'x' };
  }

  /* ------------------------------------------------------------ collision helpers */
  function bombAt(cx, cy) { var i; for (i = 0; i < bombs.length; i++) if (bombs[i].cx === cx && bombs[i].cy === cy) return bombs[i]; return null; }
  function heroSolid(cx, cy) {
    if (oob(cx, cy)) return true;
    var t = g[cy][cx]; if (t) return true;
    var b = bombAt(cx, cy); return !!(b && !b.pass);
  }
  function boxFree(x, y) {
    var hs = 3.9, c0 = Math.floor((x - hs) / T), c1 = Math.floor((x + hs) / T), r0 = Math.floor((y - hs) / T), r1 = Math.floor((y + hs) / T), cx, cy;
    for (cy = r0; cy <= r1; cy++) for (cx = c0; cx <= c1; cx++) if (heroSolid(cx, cy)) return false;
    return true;
  }
  function moveHero(dx, dy) {
    var nx = hero.x + dx, ny = hero.y + dy, o, s;
    if (boxFree(nx, ny)) { hero.x = nx; hero.y = ny; return true; }
    var step = Math.max(Math.abs(dx), Math.abs(dy));
    for (o = 1; o <= 4; o++) for (s = -1; s <= 1; s += 2) {
      if (dx ? boxFree(nx, hero.y + s * o) : boxFree(hero.x + s * o, ny)) { if (dx) hero.y += s * Math.min(step, o); else hero.x += s * Math.min(step, o); return false; }
    }
    return false;
  }
  function heroCell() { return { x: Math.floor(hero.x / T), y: Math.floor(hero.y / T) }; }
  function passable(cx, cy, wisp) {
    if (oob(cx, cy)) return false;
    var t = g[cy][cx]; if (t === PILLAR) return false; if (t === CRATE && !wisp) return false;
    return !bombAt(cx, cy);
  }

  /* ------------------------------------------------------------ bombs & flames */
  function placeBomb() {
    var c = heroCell();
    if (bombs.length >= st.bombs || bombAt(c.x, c.y)) return;
    var rem = st.remote;
    bombs.push({ cx: c.x, cy: c.y, t: rem ? FAILSAFE : FUSE, range: st.range, pass: true, remote: rem, chain: 0, tick: 0 });
    R.sfx.play('drop'); R.vibrate(6);
    R.fx.burst(OX + cpx(c.x), OY + cpx(c.y) + 3, { n: 4, color: ['#ffffff', '#9fb0e0'], speed: 20, life: 0.2, size: 1 });
  }

  function destroyCrate(cx, cy) {
    g[cy][cx] = 0;
    R.addScore(10);
    R.sfx.noise(0.1, { vol: 0.1, freq: 2600, sweep: 500 });
    R.fx.burst(OX + cpx(cx), OY + cpx(cy), { n: 8, color: ['#e8903a', '#ffc46b', '#a24b14', '#6b3314'], speed: 55, life: 0.5, size: 2, gravity: 120 });
    var h = hidden[cy][cx];
    if (h) { pickups.push({ cx: cx, cy: cy, k: h, t: 0 }); hidden[cy][cx] = null; R.sfx.tone(1200, 0.06, { vol: 0.07 }); }
    if (exitC.x === cx && exitC.y === cy) { exitShown = true; R.sfx.play('blip'); R.fx.text(OX + cpx(cx), OY + cpx(cy) - 6, 'EXIT!', C.yellow); }
  }

  function explode(b) {
    var i = bombs.indexOf(b); if (i < 0) return;
    bombs.splice(i, 1);
    var id = ++blastId, d, k, add = [{ cx: b.cx, cy: b.cy, o: 'c' }];
    for (d = 0; d < 4; d++) {
      for (k = 1; k <= b.range; k++) {
        var x = b.cx + DX[d] * k, y = b.cy + DY[d] * k;
        if (oob(x, y) || g[y][x] === PILLAR) break;
        if (g[y][x] === CRATE) { add.push({ cx: x, cy: y, o: d % 2 ? 'h' : 'v', end: true }); destroyCrate(x, y); break; }
        add.push({ cx: x, cy: y, o: d % 2 ? 'h' : 'v', end: k === b.range });
        var ob = bombAt(x, y);
        if (ob) { ob.t = Math.min(ob.t, 0.07); ob.chain = Math.max(ob.chain, b.chain + 1); if (ob.chain >= 2) R.achieve('chain'); break; }
      }
    }
    add.forEach(function (c) { c.t = FLAME_T; c.id = id; flames.push(c); });
    R.sfx.play('explode'); R.vibrate(18); R.fx.shake(1.5, 0.15);
    add.forEach(function (c) { R.fx.burst(OX + cpx(c.cx), OY + cpx(c.cy), { n: 4, color: ['#ffec27', '#ff7a2a', '#ffffff'], speed: 45, life: 0.35, size: 2 }); });
  }

  function flameAt(cx, cy) { var i; for (i = 0; i < flames.length; i++) if (flames[i].cx === cx && flames[i].cy === cy) return flames[i]; return null; }

  /* ------------------------------------------------------------ enemies */
  function bfsStep(e) {
    var hc = heroCell(), seen = {}, q = [[e.cx, e.cy, -1, 0]], qi = 0, wisp = e.k === 'wisp', d;
    seen[e.cx + ',' + e.cy] = 1;
    while (qi < q.length) {
      var cur = q[qi++];
      if (cur[0] === hc.x && cur[1] === hc.y) return cur[3] > 16 ? -1 : cur[2];
      for (d = 0; d < 4; d++) {
        var nx = cur[0] + DX[d], ny = cur[1] + DY[d], key = nx + ',' + ny;
        if (oob(nx, ny) || seen[key]) continue;
        if (!(nx === hc.x && ny === hc.y) && !passable(nx, ny, wisp)) continue;
        seen[key] = 1; q.push([nx, ny, cur[2] < 0 ? d : cur[2], cur[3] + 1]);
      }
    }
    return -1;
  }

  function enemyChoose(e) {
    var dirs = [], d, wisp = e.k === 'wisp';
    for (d = 0; d < 4; d++) if (passable(e.cx + DX[d], e.cy + DY[d], wisp)) dirs.push(d);
    if (!dirs.length) { e.wait = 0.3; return; }
    var pick = -1, hc = heroCell();
    if (e.k === 'chaser') { var s = bfsStep(e); if (s >= 0 && dirs.indexOf(s) >= 0) pick = s; }
    if (pick < 0 && wisp && Math.random() < 0.55) {
      var dx = hc.x - e.cx, dy = hc.y - e.cy, tw = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      if (dirs.indexOf(tw) >= 0) pick = tw;
    }
    if (pick < 0) {
      var rev = (e.dir + 2) % 4, cand = dirs.filter(function (x) { return x !== rev; });
      if (dirs.indexOf(e.dir) >= 0 && Math.random() < 0.7) pick = e.dir;
      else if (cand.length) pick = U.pick(cand);
      else pick = rev;
    }
    e.dir = pick; e.tx = e.cx + DX[pick]; e.ty = e.cy + DY[pick]; e.moving = true; e.p = 0;
  }

  function updEnemy(e, dt) {
    e.anim += dt;
    if (e.hurt > 0) e.hurt -= dt;
    if (!e.moving) {
      e.wait -= dt;
      if (e.wait <= 0) enemyChoose(e);
      return;
    }
    e.p += e.spd * dt;
    if (e.p >= T) { e.cx = e.tx; e.cy = e.ty; e.p = 0; e.moving = false; e.wait = 0; enemyChoose(e); }
  }
  function enemyPos(e) {
    if (!e.moving) return { x: cpx(e.cx), y: cpx(e.cy) };
    return { x: cpx(e.cx) + DX[e.dir] * e.p, y: cpx(e.cy) + DY[e.dir] * e.p };
  }
  function enemyCell(e) { return e.moving && e.p >= T / 2 ? { x: e.tx, y: e.ty } : { x: e.cx, y: e.cy }; }

  function killEnemy(e, id) {
    var i = enemies.indexOf(e); if (i < 0) return;
    enemies.splice(i, 1);
    var pos = enemyPos(e), base = e.k === 'blob' ? 100 : e.k === 'chaser' ? 200 : 300;
    kills[id] = (kills[id] || 0) + 1;
    var pts = base * Math.pow(2, Math.min(3, kills[id] - 1));
    R.addScore(pts); R.fx.text(OX + pos.x, OY + pos.y - 8, '+' + pts, kills[id] > 1 ? C.pink : C.yellow);
    R.sfx.play('hit'); R.vibrate(25);
    R.fx.burst(OX + pos.x, OY + pos.y, { n: 14, color: e.k === 'blob' ? ['#ff8a3a', '#ffec27', '#ffffff'] : e.k === 'chaser' ? ['#9a3be0', '#ff1a3a', '#ffffff'] : ['#3dc6ff', '#b8f0ff', '#ffffff'], speed: 70, life: 0.5, size: 2, gravity: 20 });
    R.achieve('first-blast');
  }

  /* ------------------------------------------------------------ hero */
  function killHero(why) {
    hero.dead = true; hero.spin = 0; phase = 'dying'; phaseT = 1.1;
    R.lives = Math.max(0, R.lives - 1);
    R.sfx.play('lose'); R.vibrate(110); R.fx.shake(3, 0.3); R.fx.flash('#ffffff', 0.15);
    R.fx.burst(OX + hero.x, OY + hero.y, { n: 22, color: [C.red, C.pink, C.white, C.yellow], speed: 85, life: 0.8, size: 2, gravity: 50 });
    if (why === 'time') R.fx.text(W / 2, 90, 'TIME UP!', C.red);
  }
  function hurtHero() {
    if (hero.dead || hero.inv > 0 || phase !== 'play') return;
    if (st.shield) {
      st.shield = false; hero.inv = 1.6;
      R.sfx.play('hit'); R.vibrate(40); R.fx.burst(OX + hero.x, OY + hero.y, { n: 14, color: ['#3dc6ff', '#e8f8ff', '#ffffff'], speed: 70, life: 0.5, size: 2 });
      R.fx.text(OX + hero.x, OY + hero.y - 10, 'SHIELD!', C.cyan);
      return;
    }
    killHero();
  }

  function collectPickup(p) {
    var i = pickups.indexOf(p); pickups.splice(i, 1);
    var cx = OX + cpx(p.cx), cy = OY + cpx(p.cy), name = '', own = false;
    switch (p.k) {
      case 'fire': if (st.range < 6) { st.range++; name = 'RANGE+'; } else own = true; break;
      case 'bomb': if (st.bombs < 5) { st.bombs++; name = 'BOMB+'; } else own = true; break;
      case 'boot': if (st.boots < 3) { st.boots++; name = 'SPEED+'; } else own = true; break;
      case 'remote': if (!st.remote) { st.remote = true; name = 'REMOTE'; } else own = true; break;
      case 'shield': if (!st.shield) { st.shield = true; name = 'SHIELD'; } else own = true; break;
    }
    if (own) { R.addScore(100); name = '+100'; } else R.addScore(50);
    st.seen[p.k] = 1;
    if (Object.keys(st.seen).length >= 5) R.achieve('loaded');
    R.sfx.play('powerup'); R.vibrate(14);
    R.fx.text(cx, cy - 8, name, C.lime);
    R.fx.burst(cx, cy, { n: 10, color: [C.lime, C.white, C.yellow], speed: 55, life: 0.45, size: 2 });
  }

  function updHero(dt) {
    if (hero.inv > 0) hero.inv -= dt;
    var ax = R.input.axisX(), ay = R.input.axisY(), spd = 40 + 7 * st.boots;
    hero.moving = false;
    if (ax && ay) { if (hero.pref === 'x') ay = 0; else ax = 0; }
    if (ax || ay) {
      hero.face = ax ? (ax > 0 ? 1 : 3) : (ay > 0 ? 2 : 0); hero.moving = true; hero.anim += dt;
      if (ax) moveHero(ax * spd * dt, 0); else moveHero(0, ay * spd * dt);
    }
    var i, b;
    for (i = 0; i < bombs.length; i++) {          // a freshly placed bomb is walk-through until the hero steps off it
      b = bombs[i];
      if (b.pass) { var bx = cpx(b.cx), by = cpx(b.cy); if (Math.abs(hero.x - bx) > T - 1 || Math.abs(hero.y - by) > T - 1) b.pass = false; }
    }
    if (R.input.pressed('a')) placeBomb();
    if (R.input.pressed('b')) {
      var any = false;
      for (i = bombs.length - 1; i >= 0; i--) if (bombs[i].remote) { bombs[i].t = Math.min(bombs[i].t, 0.01); any = true; }
      if (!any && !st.remote && hintT <= 0) { hintT = 1.5; R.fx.text(OX + hero.x, OY + hero.y - 10, 'NO REMOTE', C.pink); R.sfx.tone(120, 0.06, { vol: 0.07, type: 'triangle' }); }
    }
  }

  /* ------------------------------------------------------------ update */
  function updPlay(dt) {
    var i, j, e, b;
    if (hintT > 0) hintT -= dt;
    timeLeft -= dt;
    if (timeLeft <= 0) { killHero('time'); return; }
    updHero(dt);
    for (i = bombs.length - 1; i >= 0; i--) {
      b = bombs[i]; b.t -= dt; b.tick -= dt;
      if (b.t < 0.6 && b.t > 0.08 && b.tick <= 0 && !b.remote) { b.tick = 0.15; R.sfx.tone(1500, 0.015, { vol: 0.04 }); }
      if (b.t <= 0) explode(b);
    }
    for (i = flames.length - 1; i >= 0; i--) { flames[i].t -= dt; if (flames[i].t <= 0) flames.splice(i, 1); }
    for (i = 0; i < enemies.length; i++) updEnemy(enemies[i], dt);
    // flames hurt enemies / hero and set off bombs
    for (i = enemies.length - 1; i >= 0; i--) {
      e = enemies[i]; var ec = enemyCell(e), fl = flameAt(ec.x, ec.y);
      if (fl) killEnemy(e, fl.id);
    }
    var hc = heroCell();
    if (!hero.dead && flameAt(hc.x, hc.y)) hurtHero();
    for (i = 0; i < bombs.length; i++) { var f2 = flameAt(bombs[i].cx, bombs[i].cy); if (f2) bombs[i].t = Math.min(bombs[i].t, 0.07); }
    // enemy contact
    if (!hero.dead) for (i = 0; i < enemies.length; i++) {
      var pos = enemyPos(enemies[i]);
      if (Math.abs(pos.x - hero.x) < 7 && Math.abs(pos.y - hero.y) < 7) { hurtHero(); break; }
    }
    // pick-ups
    for (i = pickups.length - 1; i >= 0; i--) {
      j = pickups[i]; j.t += dt;
      if (!hero.dead && Math.abs(cpx(j.cx) - hero.x) < 6 && Math.abs(cpx(j.cy) - hero.y) < 6) collectPickup(j);
    }
    // exit
    if (!enemies.length && !exitOpen) {
      if (exitShown) { exitOpen = true; R.sfx.play('line'); R.fx.flash(C.white, 0.1); R.fx.text(W / 2, 90, 'EXIT OPEN!', C.lime); }
      else if (!lastHint) { lastHint = true; R.fx.text(W / 2, 90, 'FIND THE EXIT!', C.yellow); R.sfx.play('select'); }
    }
    if (exitOpen && !hero.dead && hc.x === exitC.x && hc.y === exitC.y) startClear();
  }
  function startClear() {
    phase = 'clear'; phaseT = 3.0;
    var secs = Math.max(0, Math.floor(timeLeft));
    clearInfo = { bonus: 1000 + secs * 10, secs: secs, shown: 0, tick: 0, last: level >= MAX_LEVEL };
    R.sfx.play('win'); R.vibrate(40); R.fx.flash(C.yellow, 0.2);
    var i; for (i = 0; i < 6; i++) R.fx.burst(U.rand(20, 116), U.rand(30, 120), { n: 12, color: [C.yellow, C.pink, C.cyan, C.lime, C.white], speed: 80, life: 1, size: 2, gravity: 50 });
  }

  function afterDeath() {
    if (R.lives <= 0) { R.gameOver(); phaseT = 99; return; }
    // keep the board as it is, just respawn the hero
    placeHero(); hero.inv = 3.0;
    bombs.forEach(function (b) { if (b.cx === 0 && b.cy === 0) b.pass = true; });
    if (timeLeft <= 0) timeLeft = 60;
    phase = 'play';
  }

  R.game({
    layout: 'full', size: [W, H], bg: '#0d2430', music: 'action',

    init: function () {
      Object.keys(HERO).forEach(function (k) { checkRows('hero ' + k, HERO[k], 10, 10); });
      BLOB.forEach(function (r, i) { checkRows('blob' + i, r, 10, 10); });
      CHASER.forEach(function (r, i) { checkRows('chaser' + i, r, 10, 10); });
      WISP.forEach(function (r, i) { checkRows('wisp' + i, r, 10, 10); });
      Object.keys(PU).forEach(function (k) { checkRows('pu ' + k, PU[k], 10, 10); });
      checkRows('bomb', BOMB, 10, 10); checkRows('door', DOOR, 10, 10);
    },

    onPress: function (b) { if (b === 'left' || b === 'right') hero.pref = 'x'; else if (b === 'up' || b === 'down') hero.pref = 'y'; },

    reset: function () {
      clock = 0; lastHint = false;
      st = { range: 2, bombs: 1, boots: 0, remote: false, shield: false, seen: {} };
      R.lives = 3; R.level = 1;
      loadLevel(1);
    },

    update: function (dt) {
      clock += dt;
      var i;
      if (phase === 'intro') {
        phaseT -= dt; hero.inv = Math.max(hero.inv, 0.5);
        if (phaseT <= 0) { phase = 'play'; R.sfx.play('select'); }
        return;
      }
      if (phase === 'play') { updPlay(dt); return; }
      if (phase === 'dying') {
        phaseT -= dt; hero.spin += dt * 10;
        for (i = flames.length - 1; i >= 0; i--) { flames[i].t -= dt; if (flames[i].t <= 0) flames.splice(i, 1); }
        for (i = bombs.length - 1; i >= 0; i--) { bombs[i].t -= dt; if (bombs[i].t <= 0) explode(bombs[i]); }
        for (i = 0; i < enemies.length; i++) updEnemy(enemies[i], dt);
        if (phaseT <= 0) afterDeath();
        return;
      }
      if (phase === 'clear') {
        phaseT -= dt;
        for (i = flames.length - 1; i >= 0; i--) { flames[i].t -= dt; if (flames[i].t <= 0) flames.splice(i, 1); }
        if (clearInfo.shown < clearInfo.bonus) {
          var inc = Math.min(clearInfo.bonus - clearInfo.shown, Math.max(10, Math.ceil(clearInfo.bonus * dt / 1.0 / 10) * 10));
          clearInfo.shown += inc; R.addScore(inc);
          clearInfo.tick -= dt; if (clearInfo.tick <= 0) { clearInfo.tick = 0.06; R.sfx.tone(1300, 0.03, { vol: 0.05 }); }
        }
        if (phaseT <= 0) {
          if (clearInfo.last) { R.achieve('maze-master'); R.gameOver({ win: true }); phaseT = 99; }
          else { lastHint = false; loadLevel(level + 1); }
        }
      }
    },

    /* ------------------------------------------------------------ render */
    render: function (ctx, w, h) {
      ctx.imageSmoothingEnabled = false;
      drawHud(ctx);
      ctx.drawImage(gridCanvas, OX, OY);
      D.frame(ctx, OX - 1, OY - 1, GW * T + 2, GH * T + 2, '#2f7a9a', 1);
      drawExit(ctx);
      drawPickups(ctx);
      drawCrates(ctx);
      drawBombs(ctx);
      drawFlames(ctx);
      drawEnemies(ctx);
      drawHero(ctx);
      if (phase === 'intro' && R.mode === 'play') {
        var mix = tierEnemies(level);
        ctx.fillStyle = 'rgba(5,12,20,.8)'; ctx.fillRect(18, 62, 100, 44); D.frame(ctx, 18, 62, 100, 44, '#27d9c3', 1);
        D.text(ctx, 'LEVEL ' + level, W / 2, 68, { size: 8, color: C.yellow, align: 'center', shadow: '#000' });
        D.text(ctx, 'CRITTERS ' + enemies.length, W / 2, 82, { size: 6, color: C.white, align: 'center' });
        D.text(ctx, mix.chasers ? 'WATCH OUT: CHASERS' : 'CLEAR THEM ALL', W / 2, 93, { size: 6, color: C.cyan, align: 'center' });
      }
      if (phase === 'clear' && clearInfo) {
        ctx.fillStyle = 'rgba(5,12,20,.82)'; ctx.fillRect(10, 58, 116, 50); D.frame(ctx, 10, 58, 116, 50, C.yellow, 1);
        D.text(ctx, clearInfo.last ? 'MAZE MASTER!' : 'LEVEL CLEAR', W / 2, 64, { size: 8, color: C.yellow, align: 'center', shadow: '#000' });
        D.text(ctx, 'TIME BONUS ' + clearInfo.secs + 'x10', W / 2, 79, { size: 6, color: C.white, align: 'center' });
        D.text(ctx, '+' + clearInfo.bonus, W / 2, 91, { size: 8, color: C.lime, align: 'center' });
      }
    }
  });

  /* ------------------------------------------------------------ drawing */
  function drawHud(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, 13);
    D.text(ctx, 'SC ' + U.pad(R.score, 5), 3, 4, { size: 6, color: C.yellow });
    ctx.drawImage(S_('hl', HERO.d, HP), 62, 1, 10, 10);
    D.text(ctx, 'x' + R.lives, 74, 4, { size: 6, color: C.pink });
    D.text(ctx, 'LV ' + U.pad(level, 2), W - 3, 4, { size: 6, color: C.white, align: 'right' });
    // time bar
    var f = Math.max(0, timeLeft / timeMax), col = f > 0.5 ? '#3ddc84' : f > 0.2 ? '#ffd23a' : (Math.floor(clock * 5) % 2 ? '#ff3a4d' : '#ff9aa8');
    ctx.fillStyle = '#10222c'; ctx.fillRect(OX, 14, GW * T, 5); D.frame(ctx, OX - 1, 13, GW * T + 2, 7, '#2f7a9a', 1);
    ctx.fillStyle = col; ctx.fillRect(OX, 15, Math.round((GW * T) * f), 3);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(OX, 15, Math.round((GW * T) * f), 1);
    // bottom panel
    ctx.fillStyle = '#0a1a22'; ctx.fillRect(0, 136, W, 28); ctx.fillStyle = '#2f7a9a'; ctx.fillRect(0, 136, W, 1);
    var items = [['bomb', 'x' + st.bombs, true], ['fire', 'x' + st.range, true], ['boot', 'x' + (st.boots + 1), true], ['remote', '', st.remote], ['shield', '', st.shield]], i;
    for (i = 0; i < items.length; i++) {
      var it = items[i], ix = 4 + i * 26;
      ctx.globalAlpha = it[2] ? 1 : 0.28; ctx.drawImage(S_('pu' + it[0], PU[it[0]], PU_PAL[it[0]]), ix, 140);
      ctx.globalAlpha = 1;
      if (it[1]) D.text(ctx, it[1], ix + 12, 142, { size: 6, color: C.white });
      else if (it[2]) D.text(ctx, 'ON', ix + 12, 142, { size: 6, color: C.lime });
    }
    D.text(ctx, 'CRITTERS ' + enemies.length, 4, 154, { size: 6, color: C.cyan });
    D.text(ctx, exitOpen ? 'EXIT OPEN' : exitShown ? 'EXIT SHUT' : 'EXIT ???', W - 4, 154, { size: 6, color: exitOpen ? C.lime : exitShown ? C.red : '#5d7a8a', align: 'right' });
  }

  function drawExit(ctx) {
    if (!exitShown || g[exitC.y][exitC.x] === CRATE) return;
    var x = OX + exitC.x * T, y = OY + exitC.y * T, pal = exitOpen ? { f: '#27d9c3', F: '#b8fff4', d: Math.floor(clock * 6) % 2 ? '#ffffff' : '#9affe8' } : { f: '#8a2030', F: '#ff5a6a', d: '#2a0a12' };
    ctx.drawImage(S_('door' + (exitOpen ? 1 : 0) + (exitOpen ? Math.floor(clock * 6) % 2 : 0), DOOR, pal), x, y);
    if (exitOpen) { ctx.fillStyle = '#10333a'; ctx.fillRect(x + 4, y + 4, 2, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, y + 3, 2, 1); }
    else { ctx.fillStyle = '#ff3a4d'; ctx.fillRect(x + 4, y + 3, 2, 2); ctx.fillStyle = '#4a1a22'; ctx.fillRect(x + 2, y + 5, 6, 4); ctx.fillStyle = '#ff5a6a'; ctx.fillRect(x + 3, y + 5, 1, 4); ctx.fillRect(x + 6, y + 5, 1, 4); }
  }
  function drawPickups(ctx) {
    pickups.forEach(function (p) {
      var x = OX + p.cx * T, y = OY + p.cy * T + Math.round(Math.sin(p.t * 6) * 0.8);
      ctx.drawImage(S_('pu' + p.k, PU[p.k], PU_PAL[p.k]), x, y);
      if (Math.floor(p.t * 3) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 8, y + 1, 1, 1); }
    });
  }
  function drawCrates(ctx) {
    var tl = tilesCache.t, x, y;
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
      if (g[y][x] !== CRATE) continue;
      ctx.drawImage(tl.crate, OX + x * T, OY + y * T);
    }
  }
  function drawBombs(ctx) {
    bombs.forEach(function (b) {
      var x = OX + b.cx * T, y = OY + b.cy * T, pulse = Math.floor(clock * (b.t < 0.8 ? 12 : 4)) % 2;
      var spr = S_('bomb', BOMB, BOMB_PAL);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 2, y + 8, 6, 2);
      if (pulse) ctx.drawImage(spr, x - 1, y - 1, 12, 12); else ctx.drawImage(spr, x, y);
      if (b.t < 0.8 && pulse) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#ff3a4d'; ctx.fillRect(x + 1, y + 3, 8, 7); ctx.globalAlpha = 1; }
      if (b.remote) { ctx.fillStyle = '#8a3be0'; ctx.fillRect(x + 4, y + 4, 2, 2); }
      ctx.fillStyle = Math.floor(clock * 20) % 2 ? '#ffec27' : '#ffffff'; ctx.fillRect(x + 7, y, 2, 1); ctx.fillRect(x + 8, y + 1, 1, 1);
    });
  }
  function drawFlames(ctx) {
    flames.forEach(function (f) {
      var x = OX + f.cx * T, y = OY + f.cy * T, k = Math.min(1, f.t / FLAME_T), a = k > 0.35 ? 1 : k / 0.35;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ff4a1a';
      if (f.o === 'h') ctx.fillRect(x, y + 1, T, 8); else if (f.o === 'v') ctx.fillRect(x + 1, y, 8, T); else ctx.fillRect(x, y, T, T);
      ctx.fillStyle = '#ffb020';
      if (f.o === 'h') ctx.fillRect(x, y + 2, T, 6); else if (f.o === 'v') ctx.fillRect(x + 2, y, 6, T); else ctx.fillRect(x + 1, y + 1, 8, 8);
      ctx.fillStyle = '#fff4a0';
      if (f.o === 'h') ctx.fillRect(x, y + 4, T, 2); else if (f.o === 'v') ctx.fillRect(x + 4, y, 2, T); else ctx.fillRect(x + 3, y + 3, 4, 4);
      ctx.globalAlpha = 1;
    });
  }
  function drawEnemies(ctx) {
    enemies.forEach(function (e) {
      var pos = enemyPos(e), x = Math.round(OX + pos.x - 5), y = Math.round(OY + pos.y - 5), fr = Math.floor(e.anim * 5) % 2, spr;
      if (e.k === 'blob') spr = S_('blob' + fr, BLOB[fr], BLOB_PAL);
      else if (e.k === 'chaser') spr = S_('chaser' + fr, CHASER[fr], CHASER_PAL);
      else spr = S_('wisp' + fr, WISP[fr], WISP_PAL);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 1, y + 8, 8, 2);
      if (e.k === 'wisp') { ctx.globalAlpha = 0.75; y += Math.round(Math.sin(e.anim * 5)); }
      ctx.drawImage(spr, x, y);
      ctx.globalAlpha = 1;
    });
  }
  function drawHero(ctx) {
    var x = Math.round(OX + hero.x - 5), y = Math.round(OY + hero.y - 6);
    if (hero.dead) {
      ctx.save(); ctx.translate(x + 5, y + 5); ctx.rotate(hero.spin); ctx.globalAlpha = Math.max(0, phaseT / 1.1); ctx.drawImage(S_('hd', HERO.d, HP), -5, -5); ctx.restore(); ctx.globalAlpha = 1;
      return;
    }
    if (hero.inv > 0 && Math.floor(hero.inv * 12) % 2) return;
    var f = hero.face, k = f === 0 ? 'u' : f === 2 ? 'd' : 'r', alt = hero.moving && Math.floor(hero.anim * 9) % 2 ? 'B' : '';
    var spr = S_('h' + k + alt, HERO[k + alt], HP);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 1, y + 9, 8, 2);
    if (f === 3) { ctx.save(); ctx.translate(x + 10, y); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0); ctx.restore(); }
    else ctx.drawImage(spr, x, y);
    if (st.shield) {
      ctx.strokeStyle = 'rgba(61,198,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 5, y + 5, 7.5 + Math.sin(clock * 8) * 0.5, 0, Math.PI * 2); ctx.stroke();
    }
  }
})();
