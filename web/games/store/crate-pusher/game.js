/* Crate Pusher — warehouse puzzle: push every crate onto a target. Built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util, D = R.draw;

  /* ------------------------------------------------------------ levels
   * '#' wall · ' ' floor · '.' target · '$' crate · '*' crate on target · '@' player · '+' player on target
   * par = fewest possible moves (verified with an offline solver). */
  var LEVELS = [
    { m: ["#######", "#     #", "# @$ .#", "#     #", "#######"], par: 2 },
    { m: ["#######", "#     #", "#   $@#", "#.  $ #", "#.    #", "#######"], par: 15 },
    { m: ["#######", "#    @#", "# $$ .#", "# $  .#", "#    .#", "#######"], par: 22 },
    { m: ["#########", "# .   $ #", "# # # # #", "#.    $ #", "# # # #@#", "#.    $ #", "#########"], par: 29 },
    { m: ["#########", "# $.    #", "# #$# # #", "#+  $   #", "# #.# # #", "# $ .   #", "#########"], par: 29 },
    { m: ["#########", "#..   $ #", "#  ###  #", "#    $  #", "#  ###$ #", "# . @   #", "#########"], par: 33 },
    { m: ["#########", "#..  ####", "#  $ ####", "#  $@####", "#  $ $  #", "#   . . #", "#########"], par: 33 },
    { m: ["  ######", "###.@  #", "#     .#", "# $##$ #", "#  ##. #", "#    $ #", "#    ###", "######"], par: 46 },
    { m: ["########", "###   .#", "#  @$. #", "# $##. #", "#  ##  #", "#    $ #", "# $ .###", "########"], par: 45 },
    { m: ["#########", "#. .  $ #", "#.$###  #", "#   $@$ #", "#  ###  #", "#     . #", "#########"], par: 45 },
    { m: ["##########", "#   ##   #", "# . ## $ #", "# .$   . #", "# $ ## $ #", "#.@ ##   #", "##########"], par: 46 },
    { m: ["##########", "#   ##@  #", "# $ ## $ #", "#    $.. #", "# $ ## * #", "#   ##. .#", "##########"], par: 57 },
    { m: ["########", "###. . #", "# $   .#", "#@$##* #", "#  ##  #", "# $    #", "# $. ###", "########"], par: 67 },
    { m: ["###########", "# $ .    .#", "# ####### #", "# $      .#", "# $## ##  #", "#        .#", "# #######$#", "# .     $@#", "###########"], par: 61 }
  ];

  /* ------------------------------------------------------------ sprites (12x12) */
  var T = 12;
  var PAL = {
    n: '#1a2245', h: '#273263', s: '#202a52',
    m: '#2a1245', b: '#8a46d0', B: '#b476f4', k: '#5e2da6',
    d: '#6b3314', l: '#ffc46b', o: '#e8903a', p: '#c4601a', q: '#a24b14',
    y: '#ffec27', P: '#ff77a8', w: '#fff1e8',
    H: '#b0204a', e: '#1d2b53', S: '#ffccaa', M: '#c4503a', u: '#29adff', U: '#1c6fb0', f: '#6b3314', r: '#ff4d7e'
  };
  var PAL_ON = { d: '#0e5a34', l: '#b8ffc8', o: '#2ed573', p: '#1f9a52', q: '#178a47', w: '#eaffd8' };

  function grid(fn) { var rows = []; for (var y = 0; y < T; y++) { var r = ''; for (var x = 0; x < T; x++) r += fn(x, y); rows.push(r); } return rows; }
  var SPR = {
    floorA: grid(function (x, y) { return y === 0 || x === 0 ? 'h' : 'n'; }),
    floorB: grid(function (x, y) { return y === 0 || x === 0 ? 'h' : ((x === 4 && y === 5) || (x === 8 && y === 8) || (x === 7 && y === 3)) ? 's' : 'n'; }),
    wall: [
      'BBBBBmBBBBBm', 'bbbbbmbbbbbm', 'kkkkkmkkkkkm', 'mmmmmmmmmmmm',
      'BBmBBBBBmBBB', 'bbmbbbbbmbbb', 'kkmkkkkkmkkk', 'mmmmmmmmmmmm',
      'BBBBBmBBBBBm', 'bbbbbmbbbbbm', 'kkkkkmkkkkkm', 'mmmmmmmmmmmm'],
    crate: grid(function (x, y) {
      if (!x || !y || x === 11 || y === 11) return 'd';
      if (y === 1 || x === 1) return 'l';
      if (y === 10 || x === 10) return 'q';
      if ((x === y || x + y === 11) && x >= 2 && x <= 9) return 'p';
      return 'o';
    }),
    crateOn: grid(function (x, y) {
      if (!x || !y || x === 11 || y === 11) return 'd';
      if (y === 1 || x === 1) return 'l';
      if (y === 10 || x === 10) return 'q';
      if (Math.abs(x - 5.5) + Math.abs(y - 5.5) <= 2.5) return 'w';
      return 'o';
    }),
    target: ['............', '............', '............', '.....yy.....', '....yPPy....', '...yPwwPy...', '...yPwwPy...', '....yPPy....', '.....yy.....', '............', '............', '............'],
    down: ['............', '....rrrr....', '...rrrrrr...', '..HHHHHHHH..', '..SSSSSSSS..', '..SeSSSSeS..', '..SeSSSSeS..', '..SSSMMSSS..', '...uuuuuu...', '.SuuuuuuuuS.', '...uUUUUu...', '...ff..ff...'],
    up: ['............', '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '..rrrrrrrr..', '..rrrrrrrr..', '..HHHHHHHH..', '...SSSSSS...', '...uuuuuu...', '.SuuuuuuuuS.', '...uUUUUu...', '...ff..ff...'],
    right: ['............', '....rrrr....', '...rrrrrr...', '..HHHHHHHHHH', '..SSSSSSSS..', '..SSSSSSeSS.', '..SSSSSSeSS.', '..SSSSSSSMM.', '...uuuuuu...', '...uuuuuuuS.', '...uUUUUu...', '...ff..ff...']
  };
  SPR.left = SPR.right;
  var sprCache = {};
  function spr(name, sc, on) {
    var key = name + sc + (on ? 'on' : '');
    if (!sprCache[key]) {
      var pal = on ? U_assign(PAL, PAL_ON) : PAL;
      sprCache[key] = R.sprite(SPR[name], pal, sc);
    }
    return sprCache[key];
  }
  function U_assign(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  /* ------------------------------------------------------------ state */
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], LETTERS = 'urdl';
  var HUD_H = 30, AREA_Y = 34, AREA_H = 272, MOVE_T = 0.09, HOLD_A = 0.6;
  var scene, sel, lv, L, crates, occ, pl, hist, pushes, face, anim, buf, clearT, clearInfo, clock;
  var aHeld, aT, aUsed, bump, unlocked, bests;

  function parseLevel(def) {
    var rows = def.m, h = rows.length, w = 0, i, x, y;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var o = { w: w, h: h, walls: new Uint8Array(w * h), targets: new Uint8Array(w * h), crates: [], player: -1, reach: new Uint8Array(w * h), par: def.par };
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var ch = x < rows[y].length ? rows[y].charAt(x) : ' ';
      i = y * w + x;
      if (ch === '#') o.walls[i] = 1;
      if (ch === '.' || ch === '*' || ch === '+') o.targets[i] = 1;
      if (ch === '$' || ch === '*') o.crates.push(i);
      if (ch === '@' || ch === '+') o.player = i;
    }
    // everything the player can reach is "inside" (crates are walkable for this purpose)
    var q = [o.player]; o.reach[o.player] = 1;
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi], cxx = c % w, cyy = (c / w) | 0;
      for (var d = 0; d < 4; d++) {
        var nx = cxx + DX[d], ny = cyy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var n = ny * w + nx;
        if (!o.walls[n] && !o.reach[n]) { o.reach[n] = 1; q.push(n); }
      }
    }
    o.draw = new Uint8Array(w * h);                 // walls worth drawing: touching the inside
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (!o.walls[i]) continue;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var ax = x + dx, ay = y + dy;
        if (ax >= 0 && ay >= 0 && ax < w && ay < h && o.reach[ay * w + ax]) o.draw[i] = 1;
      }
    }
    return o;
  }

  function loadLevel(i) {
    lv = i; L = parseLevel(LEVELS[i]);
    crates = L.crates.slice(); pl = L.player;
    occ = new Int16Array(L.w * L.h).fill(-1);
    crates.forEach(function (c, k) { occ[c] = k; });
    hist = ''; pushes = 0; face = 2; anim = null; buf = -1; clearT = 0; clearInfo = null; bump = 0;
    aHeld = false; aT = 0; aUsed = false;
    R.level = i + 1;
  }

  function startLevel(i) {
    loadLevel(i); scene = 'play';
    R.sfx.play('select');
  }

  function openSelect() {
    scene = 'select'; sel = U.clamp(lv, 0, Math.max(0, unlocked - 1)); anim = null;
    R.sfx.play('pause');
  }

  function solved() {
    for (var i = 0; i < crates.length; i++) if (!L.targets[crates[i]]) return false;
    return true;
  }

  /* one step; returns 0 blocked · 1 walked · 2 pushed. Used for live play and for replaying a save. */
  function step(dir, silent) {
    var w = L.w, np = pl + DY[dir] * w + DX[dir];
    face = dir;
    if (L.walls[np]) return 0;
    var ci = occ[np], from = pl;
    if (ci >= 0) {
      var nc = np + DY[dir] * w + DX[dir];
      if (L.walls[nc] || occ[nc] >= 0) return 0;
      occ[np] = -1; occ[nc] = ci; crates[ci] = nc; pushes++;
      hist += LETTERS.charAt(dir).toUpperCase();
      pl = np;
      if (!silent) {
        anim = { t: 1, dir: dir, crate: ci };
        var px = tilePx(nc % w), py = tilePy((nc / w) | 0);
        if (L.targets[nc] && !L.targets[np]) {
          R.sfx.play('coin'); R.vibrate(14);
          R.fx.burst(px.c, py.c, { n: 12, color: [C.lime, C.yellow, C.white], speed: 70, life: 0.5, size: 2 });
        } else {
          R.sfx.play('land');
          R.fx.burst(px.c - DX[dir] * 6, py.c - DY[dir] * 6, { n: 4, color: ['#c4601a', '#ffc46b'], speed: 40, life: 0.3, size: 2 });
        }
      }
      return 2;
    }
    pl = np; hist += LETTERS.charAt(dir);
    if (!silent) { anim = { t: 1, dir: dir, crate: -1 }; R.sfx.play('tick'); }
    return 1;
  }

  function undoStep() {
    if (!hist.length) { R.sfx.tone(130, 0.05, { vol: 0.07, type: 'triangle' }); return; }
    var ch = hist.charAt(hist.length - 1), push = ch === ch.toUpperCase(), dir = LETTERS.indexOf(ch.toLowerCase()), w = L.w;
    var prev = pl - DY[dir] * w - DX[dir];
    if (push) {
      var cpos = pl + DY[dir] * w + DX[dir], ci = occ[cpos];
      occ[cpos] = -1; occ[pl] = ci; crates[ci] = pl; pushes--;
    }
    pl = prev; hist = hist.slice(0, -1); face = dir; anim = null;
    R.sfx.tone(300, 0.04, { vol: 0.07, slide: 200, type: 'triangle' });
  }

  function restartLevel() {
    loadLevel(lv); scene = 'play';
    R.sfx.play('rotate'); R.fx.flash(C.white, 0.08);
  }

  function levelDone() {
    var moves = hist.length, par = L.par;
    var base = 100 + 20 * lv;
    var eff = U.clamp(1 - (moves - par) / (par * 1.5), 0, 1);
    var bonus = Math.round(eff * 200);
    R.addScore(base + bonus);
    var prevBest = bests[lv], isBest = !prevBest || moves < prevBest;
    if (isBest) { bests[lv] = moves; R.store.set('best', bests); }
    if (lv + 2 > unlocked) { unlocked = Math.min(LEVELS.length, lv + 2); R.store.set('unlocked', unlocked); }
    clearInfo = { moves: moves, par: par, bonus: base + bonus, best: isBest, perfect: moves <= par, last: lv === LEVELS.length - 1 };
    scene = 'clear'; clearT = 2.6; anim = null;
    R.sfx.play('win'); R.vibrate(70); R.fx.flash(C.yellow, 0.25); R.fx.shake(3, 0.3);
    var g = layout(L);
    for (var i = 0; i < 7; i++) R.fx.burst(U.rand(g.ox, g.ox + L.w * g.ts), U.rand(g.oy, g.oy + L.h * g.ts), { n: 12, color: [C.yellow, C.pink, C.cyan, C.lime, C.orange], speed: 110, life: 1, size: 3, gravity: 80 });
    R.achieve('first-clear');
    if (lv >= 4) R.achieve('five-clear');
    if (moves <= par) R.achieve('perfect');
    if (clearInfo.last) R.achieve('all-clear');
  }

  /* ------------------------------------------------------------ drawing */
  function layout(lvl, fitW, fitH, cx0, cy0) {
    var sc = fitW ? Math.max(1, Math.min(Math.floor(fitW / (lvl.w * T)), Math.floor(fitH / (lvl.h * T)), 2)) : (lvl.w <= 7 && lvl.h <= 7) ? 3 : 2;
    var ts = T * sc;
    var ox, oy;
    if (fitW) { ox = Math.round(cx0 - lvl.w * ts / 2); oy = Math.round(cy0 - lvl.h * ts / 2); }
    else { ox = Math.floor((272 - lvl.w * ts) / 2); oy = AREA_Y + Math.floor((AREA_H - lvl.h * ts) / 2); }
    return { sc: sc, ts: ts, ox: ox, oy: oy };
  }
  function tilePx(x) { var g = layout(L); return { x: g.ox + x * g.ts, c: g.ox + x * g.ts + g.ts / 2 }; }
  function tilePy(y) { var g = layout(L); return { y: g.oy + y * g.ts, c: g.oy + y * g.ts + g.ts / 2 }; }

  function drawBoard(ctx, lvl, cr, p, g, o) {
    o = o || {};
    var x, y, i, sc = g.sc, ts = g.ts, t = clock;
    for (y = 0; y < lvl.h; y++) for (x = 0; x < lvl.w; x++) {
      i = y * lvl.w + x;
      var px = g.ox + x * ts, py = g.oy + y * ts;
      if (lvl.reach[i]) {
        D.sprite(ctx, spr((x + y) % 3 === 0 ? 'floorB' : 'floorA', sc), px, py);
        if (lvl.targets[i]) {
          var pulse = 0.65 + 0.35 * Math.sin(t * 4 + i);
          D.sprite(ctx, spr('target', sc), px, py, { alpha: pulse });
        }
      } else if (lvl.draw[i]) D.sprite(ctx, spr('wall', sc), px, py);
    }
    for (i = 0; i < cr.length; i++) {
      var c = cr[i], cx = c % lvl.w, cy = (c / lvl.w) | 0, ox = 0, oy = 0;
      if (o.anim && o.anim.crate === i) { ox = -DX[o.anim.dir] * o.anim.t * ts; oy = -DY[o.anim.dir] * o.anim.t * ts; }
      D.sprite(ctx, spr(lvl.targets[c] ? 'crateOn' : 'crate', sc, lvl.targets[c]), Math.round(g.ox + cx * ts + ox), Math.round(g.oy + cy * ts + oy));
    }
    if (p >= 0) {
      var pxx = p % lvl.w, pyy = (p / lvl.w) | 0, qx = 0, qy = 0, bob = 0;
      if (o.anim) { qx = -DX[o.anim.dir] * o.anim.t * ts; qy = -DY[o.anim.dir] * o.anim.t * ts; bob = -Math.round(Math.sin((1 - o.anim.t) * Math.PI) * sc); }
      if (o.bump) { qx += DX[o.face] * Math.sin(o.bump / 0.12 * Math.PI) * sc * 2; qy += DY[o.face] * Math.sin(o.bump / 0.12 * Math.PI) * sc * 2; }
      var name = ['up', 'right', 'down', 'left'][o.face == null ? 2 : o.face];
      var py2 = Math.round(g.oy + pyy * ts + qy + bob);
      // soft shadow
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ctx.fillRect(Math.round(g.ox + pxx * ts + qx) + 2 * sc, py2 + ts - sc * 2 - bob, ts - 4 * sc, sc * 2); ctx.globalAlpha = 1;
      D.sprite(ctx, spr(name, sc), Math.round(g.ox + pxx * ts + qx), py2, { flipX: name === 'left' });
    }
  }

  function renderHud(ctx) {
    D.rect(ctx, 0, 0, 272, HUD_H, '#0c1030'); D.rect(ctx, 0, HUD_H - 1, 272, 1, '#2a3558');
    D.text(ctx, 'LV ' + U.pad(lv + 1, 2) + '/' + LEVELS.length, 8, 4, { size: 8, color: C.orange });
    D.text(ctx, 'SC ' + U.pad(R.score, 5), 264, 4, { size: 8, color: C.yellow, align: 'right' });
    D.text(ctx, 'MOVES ' + hist.length, 8, 17, { size: 8, color: C.white });
    D.text(ctx, 'PAR ' + L.par, 264, 17, { size: 8, color: '#8fa3c8', align: 'right' });
    var best = bests[lv];
    if (best) D.text(ctx, 'BEST ' + best, 136, 17, { size: 8, color: C.lime, align: 'center' });
  }

  function renderSelect(ctx) {
    D.text(ctx, 'SELECT LEVEL', 136, 14, { size: 16, color: C.orange, align: 'center', shadow: '#000' });
    var def = parseLevel(LEVELS[sel]);
    D.rect(ctx, 16, 44, 240, 164, '#0c1030'); D.frame(ctx, 16, 44, 240, 164, '#2a3558', 2);
    var g = layout(def, 232, 156, 136, 126);
    drawBoard(ctx, def, def.crates, def.player, g, { face: 2 });
    D.text(ctx, U.pad(sel + 1, 2), 136, 222, { size: 16, color: C.white, align: 'center' });
    if (sel > 0) D.text(ctx, '<', 78, 222, { size: 16, color: C.yellow });
    if (sel < unlocked - 1) D.text(ctx, '>', 170, 222, { size: 16, color: C.yellow });
    D.text(ctx, 'PAR ' + def.par + (bests[sel] ? '   BEST ' + bests[sel] : ''), 136, 246, { size: 8, color: '#8fa3c8', align: 'center' });
    // progress dots
    var n = LEVELS.length, x0 = 136 - (n * 14 - 4) / 2;
    for (var i = 0; i < n; i++) {
      var col = bests[i] ? C.lime : i < unlocked ? C.yellow : '#2a3558';
      D.rect(ctx, Math.round(x0 + i * 14), 268, 10, 10, col);
      if (i === sel) D.frame(ctx, Math.round(x0 + i * 14) - 2, 266, 14, 14, C.white, 1);
    }
    D.text(ctx, 'LEFT/RIGHT CHOOSE   A START', 136, 316, { size: 6, color: '#5d6d99', align: 'center' });
  }

  /* ------------------------------------------------------------ input */
  function poll() {
    var r = { dir: -1, undo: false };
    if (R.input.rep('up', 150, 95)) r.dir = 0;
    if (R.input.rep('right', 150, 95)) r.dir = 1;
    if (R.input.rep('down', 150, 95)) r.dir = 2;
    if (R.input.rep('left', 150, 95)) r.dir = 3;
    r.undo = R.input.rep('b', 260, 70);
    return r;
  }

  R.game({
    layout: 'full', size: [272, 328], bg: '#0a0e26', music: 'adventure',

    init: function () {
      Object.keys(SPR).forEach(function (k) { SPR[k].forEach(function (row) { if (row.length !== T) throw new Error('sprite ' + k + ' row length ' + row.length); }); if (SPR[k].length !== T) throw new Error('sprite ' + k + ' height'); });
      LEVELS.forEach(function (d, i) {
        var l = parseLevel(d), t = 0; l.targets.forEach(function (v) { t += v; });
        if (l.crates.length !== t || l.player < 0) throw new Error('level ' + (i + 1) + ' invalid');
      });
    },

    reset: function () {
      clock = 0; bump = 0;
      unlocked = U.clamp(+R.store.get('unlocked', 1) || 1, 1, LEVELS.length);
      bests = R.store.get('best', {}) || {};
      loadLevel(0);
      scene = 'select'; sel = unlocked - 1;
      R.level = 1;
    },

    update: function (dt) {
      clock += dt;
      var inp = poll();
      if (bump > 0) bump = Math.max(0, bump - dt);
      if (anim) { anim.t -= dt / MOVE_T; if (anim.t <= 0) anim = null; }

      if (scene === 'select') {
        if (inp.dir === 3 && sel > 0) { sel--; R.sfx.play('move'); }
        if (inp.dir === 1 && sel < unlocked - 1) { sel++; R.sfx.play('move'); }
        if (inp.dir === 0) { sel = Math.max(0, sel - 5); R.sfx.play('move'); }
        if (inp.dir === 2) { sel = Math.min(unlocked - 1, sel + 5); R.sfx.play('move'); }
        if (R.input.pressed('a')) startLevel(sel);
      } else if (scene === 'play') {
        if (inp.undo) undoStep();
        if (inp.dir >= 0) buf = inp.dir;
        if (!anim && buf >= 0) {
          var d = buf; buf = -1;
          var res = step(d, false);
          if (res === 0) { bump = 0.12; R.sfx.tone(110, 0.05, { vol: 0.08, type: 'triangle' }); }
          else if (solved()) levelDone();
        }
        // A: tap = restart, hold = level select
        if (R.input.pressed('a')) { aHeld = true; aT = 0; aUsed = false; }
        if (aHeld) {
          if (!R.input.held.a) { if (!aUsed && scene === 'play') restartLevel(); aHeld = false; }
          else { aT += dt; if (aT >= HOLD_A && !aUsed) { aUsed = true; aHeld = false; openSelect(); } }
        }
      } else if (scene === 'clear') {
        clearT -= dt;
        if (Math.random() < dt * 8) R.fx.burst(U.rand(20, 250), U.rand(40, 300), { n: 6, color: [C.yellow, C.pink, C.lime], speed: 70, life: 0.7, size: 2, gravity: 60 });
        if (clearT <= 0) {
          if (clearInfo.last) { R.gameOver({ win: true }); clearT = 99; }
          else startLevel(lv + 1);
        }
      }
    },

    render: function (ctx, W, H) {
      if (scene === 'select') { renderSelect(ctx); return; }
      var g = layout(L);
      drawBoard(ctx, L, crates, pl, g, { anim: anim, face: face, bump: bump });
      renderHud(ctx);
      D.text(ctx, 'A RESTART   HOLD A LEVELS   B UNDO', 136, 316, { size: 6, color: '#5d6d99', align: 'center' });
      if (scene === 'clear') {
        D.rect(ctx, 20, 108, 232, 112, 'rgba(6,10,28,.9)'); D.frame(ctx, 20, 108, 232, 112, C.yellow, 2);
        D.text(ctx, clearInfo.last ? 'ALL CLEAR!' : 'LEVEL CLEAR!', 136, 118, { size: 16, color: C.yellow, align: 'center', shadow: '#000' });
        D.text(ctx, 'MOVES ' + clearInfo.moves + '  PAR ' + clearInfo.par, 136, 148, { size: 8, color: C.white, align: 'center' });
        D.text(ctx, '+' + clearInfo.bonus + ' POINTS', 136, 166, { size: 8, color: C.lime, align: 'center' });
        if (clearInfo.perfect) D.text(ctx, 'PERFECT!', 136, 186, { size: 8, color: C.pink, align: 'center' });
        else if (clearInfo.best) D.text(ctx, 'NEW BEST!', 136, 186, { size: 8, color: C.cyan, align: 'center' });
        if (!clearInfo.last && Math.floor(clock * 3) % 2) D.text(ctx, 'NEXT LEVEL...', 136, 204, { size: 6, color: '#8fa3c8', align: 'center' });
      }
    },

    serialize: function () {
      if (scene === 'select') return { scene: 'select', sel: sel };
      if (scene === 'clear') return clearInfo && clearInfo.last ? { scene: 'select', sel: lv } : { scene: 'play', lv: lv + 1, h: '' };
      return { scene: 'play', lv: lv, h: hist };
    },
    restore: function (s) {
      if (s.scene === 'select' || s.lv == null || !LEVELS[s.lv]) { scene = 'select'; sel = U.clamp(s.sel | 0, 0, unlocked - 1); return; }
      loadLevel(s.lv); scene = 'play';
      var h = String(s.h || '');
      for (var i = 0; i < h.length; i++) {
        var d = LETTERS.indexOf(h.charAt(i).toLowerCase());
        if (d < 0 || !step(d, true)) break;
      }
      anim = null;
    }
  });
})();
