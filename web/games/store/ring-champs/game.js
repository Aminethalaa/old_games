/* Ring Champs — first-person-feel boxing ladder with telegraphed attacks, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164, X0 = 68;
  var ROUND_T = 40, ROUNDS = 3;
  var OUTL = '#1c0e2a';

  /* ------------------------------------------------------------------ helpers */
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v < 0 ? -1 : 1; }
  function rr(a, b) { return a + Math.random() * (b - a); }
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function fr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function ell(ctx, cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (var y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      var d = (y + 0.5 - cy) / ry; if (d * d >= 1) continue;
      var w = rx * Math.sqrt(1 - d * d), x0 = Math.round(cx - w), x1 = Math.round(cx + w);
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }
  function ellO(ctx, cx, cy, rx, ry, fill, line) { ell(ctx, cx, cy, rx + 1, ry + 1, line || OUTL); ell(ctx, cx, cy, rx, ry, fill); }
  function thick(ctx, x0, y0, x1, y1, w, col) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    ctx.fillStyle = col;
    for (var i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - w / 2), Math.round(y0 + (y1 - y0) * i / n - w / 2), w, w);
  }
  function body(ctx, cx, y0, y1, hw0, hw1, bulge, col) {
    ctx.fillStyle = col;
    for (var y = y0; y < y1; y++) {
      var t = (y - y0) / (y1 - y0), hw = hw0 + (hw1 - hw0) * t + bulge * Math.sin(Math.PI * t);
      ctx.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 1);
    }
  }
  function bodyO(ctx, cx, y0, y1, hw0, hw1, bulge, col) {
    body(ctx, cx, y0 - 1, y1 + 1, hw0 + 1, hw1 + 1, bulge, OUTL);
    body(ctx, cx, y0, y1, hw0, hw1, bulge, col);
  }

  /* ----------------------------------------------------------------- roster */
  var ROSTER = [
    { name: 'PUDGE', full: 'PUDGE THE PLUMP', hp: 52, power: 0.8, tell: 1.3, gap: [1.8, 3.0], chin: 0, evade: 0, venue: 0, fx: 'tongue',
      skin: '#ffcba0', skinD: '#e8a478', hair: 'tuft', hairC: '#7a4a2a', trunk: '#3a7aff', trim: '#ffffff', glove: '#3ddc5a', gloveD: '#1e8a38', sw: 24, belly: 7, hrx: 14, hry: 14, arm: 6, emblem: 'dots',
      seqs: [[3, ['jab+']], [2, ['cross']], [1, ['hay+']]], guard: [['tight', 1.5], ['open', 0.9]] },
    { name: 'ZED', full: 'ZIPPY ZED', hp: 58, power: 0.85, tell: 0.95, gap: [1.2, 2.0], chin: 0, evade: 0, venue: 1, fx: 'eyes',
      skin: '#e8b890', skinD: '#c89870', hair: 'mohawk', hairC: '#58f060', trunk: '#ffd23a', trim: '#1c1c2a', glove: '#ff3d9a', gloveD: '#a01868', sw: 18, belly: 0, hrx: 12, hry: 15, arm: 5, emblem: 'stripe',
      seqs: [[3, ['jab+', 'jab-']], [2, ['jab+', 'jab+', 'jab-']], [1, ['cross']]], guard: [['L', 0.8], ['R', 0.8], ['tight', 0.6]] },
    { name: 'HANK', full: 'HAMMER HANK', hp: 72, power: 1.1, tell: 1.0, gap: [1.5, 2.4], chin: 0, evade: 0, venue: 2, fx: 'stomp',
      skin: '#d89860', skinD: '#b87840', hair: 'band', hairC: '#ff8a1e', trunk: '#e8283a', trim: '#ffd23a', glove: '#ff8a1e', gloveD: '#b04a08', sw: 30, belly: 3, hrx: 13, hry: 13, arm: 8, emblem: 'stripe', stache: true,
      seqs: [[3, ['hook+']], [2, ['hook+', 'hook-']], [1, ['jab+']], [1, ['hay+']]], guard: [['tight', 1.2], ['open', 0.7], ['R', 0.8]] },
    { name: 'BOLT', full: 'LADY BOLT', hp: 66, power: 0.95, tell: 0.78, gap: [1.0, 1.8], chin: 0, evade: 0.25, venue: 3, fx: 'zap',
      skin: '#f0c0a8', skinD: '#d09c88', hair: 'pony', hairC: '#ff5ea8', trunk: '#b08aff', trim: '#ffec27', glove: '#ff77a8', gloveD: '#b03a70', sw: 21, belly: 0, hrx: 12, hry: 14, arm: 5, emblem: 'bolt',
      seqs: [[3, ['jab+', 'jab-', 'upper']], [2, ['jab+', 'jab+']], [1, ['upper']]], guard: [['L', 0.6], ['R', 0.6], ['tight', 0.5], ['open', 0.3]] },
    { name: 'MOE', full: 'MOUNT MOE', hp: 100, power: 1.35, tell: 1.05, gap: [1.5, 2.4], chin: 1, evade: 0, venue: 4, fx: 'roar',
      skin: '#c89060', skinD: '#a07040', hair: 'wild', hairC: '#c8ccd8', trunk: '#2a8a4a', trim: '#ffffff', glove: '#9a6a34', gloveD: '#5a3a18', sw: 34, belly: 5, hrx: 12, hry: 12, arm: 9, emblem: 'star', beard: '#c8ccd8',
      seqs: [[3, ['hay+']], [2, ['upper']], [2, ['hook+']], [1, ['cross']]], guard: [['tight', 2.0], ['open', 0.6]] },
    { name: 'KRAKEN', full: 'CAPTAIN KRAKEN', hp: 84, power: 1.15, tell: 0.7, gap: [1.0, 1.7], chin: 1, evade: 0.15, venue: 5, fx: 'patch',
      skin: '#d8a070', skinD: '#b88050', hair: 'bandana', hairC: '#e8283a', trunk: '#2a3a7a', trim: '#ffffff', glove: '#3a3a6a', gloveD: '#1a1a3a', sw: 26, belly: 2, hrx: 13, hry: 14, arm: 7, emblem: 'stripes', beard: '#1c1620', patch: true,
      seqs: [[2, ['hook+', 'jab-']], [2, ['jab+', 'jab-', 'hook+']], [1, ['upper']], [1, ['hay+']], [2, ['jab+']]], guard: [['tight', 0.9], ['L', 0.7], ['open', 0.5], ['R', 0.7]] },
    { name: 'REX', full: 'GOLDEN REX', hp: 110, power: 1.3, tell: 0.58, gap: [0.8, 1.4], chin: 2, evade: 0.2, venue: 6, fx: 'crown',
      skin: '#ffd0a0', skinD: '#e0a878', hair: 'spikes', hairC: '#ffd23a', trunk: '#ffc61a', trim: '#1c1620', glove: '#ffd23a', gloveD: '#b88a08', sw: 28, belly: 0, hrx: 13, hry: 14, arm: 7, emblem: 'star',
      seqs: [[2, ['jab+', 'jab-', 'jab+']], [2, ['hook+', 'upper']], [1, ['cross', 'hay+']], [1, ['upper', 'jab+']], [1, ['hook+', 'hook-', 'upper']]], guard: [['L', 0.5], ['R', 0.5], ['tight', 0.5], ['open', 0.35]] }
  ];
  var VENUES = [
    { wall: ['#2a1850', '#4a2a78'], crowd: ['#1c0c30', '#5a3a8a'], rope: ['#ff3d5e', '#ffffff', '#3d9bff'], floor: ['#cdb8a0', '#b49a80'], post: '#ff3d5e', spot: '#fff0c0' },
    { wall: ['#0c3030', '#1a6a5a'], crowd: ['#082020', '#2a7a6a'], rope: ['#ffd23a', '#ffffff', '#ff3d5e'], floor: ['#8ad8c8', '#6ab8a8'], post: '#ffd23a', spot: '#d0fff0' },
    { wall: ['#3a1608', '#7a3a18'], crowd: ['#241008', '#8a4a28'], rope: ['#ff8a1e', '#ffffff', '#ff8a1e'], floor: ['#e0b890', '#c89a70'], post: '#ff8a1e', spot: '#ffe0b0' },
    { wall: ['#3a0a38', '#8a1a70'], crowd: ['#240620', '#9a3a8a'], rope: ['#ff77a8', '#ffffff', '#b08aff'], floor: ['#f0c8e0', '#d8a8c8'], post: '#ff77a8', spot: '#ffd0f0' },
    { wall: ['#0a1a3a', '#1a3a7a'], crowd: ['#060e24', '#2a4a8a'], rope: ['#3de2ff', '#ffffff', '#3de2ff'], floor: ['#a8c0e0', '#88a0c8'], post: '#3de2ff', spot: '#d0f0ff' },
    { wall: ['#0a0a1a', '#202a4a'], crowd: ['#05050e', '#303a5a'], rope: ['#ffd23a', '#c8c8d8', '#ffd23a'], floor: ['#8a7a5a', '#6a5a3a'], post: '#ffd23a', spot: '#ffe8a0' },
    { wall: ['#2a0808', '#6a1a1a'], crowd: ['#1a0404', '#7a2a2a'], rope: ['#ffd23a', '#ffffff', '#ffd23a'], floor: ['#ffe8a0', '#e8c870'], post: '#ffd23a', spot: '#fff4c0' }
  ];

  var AT = {
    jab: { tell: 0.5, strike: 0.11, rec: 0.34, dmg: 5, sta: 9 },
    cross: { tell: 0.55, strike: 0.12, rec: 0.4, dmg: 7, sta: 11 },
    hook: { tell: 0.62, strike: 0.16, rec: 0.5, dmg: 9, sta: 14 },
    upper: { tell: 0.6, strike: 0.14, rec: 0.55, dmg: 11, sta: 15 },
    hay: { tell: 0.85, strike: 0.2, rec: 0.85, dmg: 16, sta: 22 }
  };
  var GUARDS = {
    tight: { gl: [-9, 80, 8], gr: [9, 80, 8] },
    L: { gl: [-9, 74, 8], gr: [17, 100, 8] },
    R: { gl: [-17, 100, 8], gr: [9, 74, 8] },
    open: { gl: [-23, 100, 8], gr: [23, 100, 8] },
    tired: { gl: [-18, 114, 8], gr: [18, 114, 8] }
  };

  /* ------------------------------------------------------------------- state */
  var phase, phT, round, tleft, fightIdx, tier, op, pl, stars, buf, clock, hs, msg, cnt, fxs, lives;
  var dealt, taken, kdsP, kdsO, perfects, perfectTotal, hitFlash, redFlash, bell, resultTxt, decision, ptsP, ptsO, crowdHype, sparkT, tellBeep;
  var S = {}, BG = [], drew = false;

  function newPlayer() { return { hp: 100, max: 100, sta: 100, st: 'idle', t: 0, side: 0, dir: 0, hit: false, weak: false, cool: 0, dx: 0, dxT: 0, invul: 0, mash: 0, need: 0, stun: 0, duck: 0, punchT: 99, lastDodge: -9 }; }

  function showMsg(txt, sub, t, col, big) { msg = { txt: txt, sub: sub || '', t: t || 1.2, max: t || 1.2, col: col || '#ffec27', big: !!big }; }

  function startFight(i) {
    fightIdx = i; tier = Math.floor(i / ROSTER.length);
    var spec = ROSTER[i % ROSTER.length];
    op = {
      spec: spec, hp: Math.round(spec.hp * 1.25 * (1 + 0.22 * tier)), sta: 100, st: 'guard', t: 0, guard: spec.guard[0][0], gI: 0, gT: spec.guard[0][1], nextAtk: 1.2, seq: null, seqI: 0, atk: null, tellT: 0, whiff: false,
      kd: 0, power: spec.power * (1 + 0.12 * tier), tellK: Math.max(0.4, spec.tell * (1 - 0.06 * tier)), flash: 0, react: 0, hitX: 0, perfectWin: 0, quick: false, weaveDir: 1, upAt: 0, fallT: 0, fallDir: 1,
      v: { gl: GUARDS.tight.gl.slice(), gr: GUARDS.tight.gr.slice(), hx: 0, hy: 0, bx: 0, by: 0 }, eyes: 'normal', mouth: 'closed', glow: 0, hitSide: 0, evadeCd: 0, win: false
    };
    op.max = op.hp;
    pl = newPlayer(); stars = 0; buf = { a: 0, b: 0, l: 0, r: 0, u: 0 };
    round = 1; tleft = ROUND_T; dealt = 0; taken = 0; kdsP = 0; kdsO = 0; perfects = 0; ptsP = 0; ptsO = 0;
    phase = 'intro'; phT = 0; cnt = null; msg = null; hitFlash = 0; redFlash = 0; crowdHype = 0;
    R.level = i + 1;
    showIntro();
  }
  function showIntro() { /* banner text is drawn from phase 'intro' */ }

  /* ------------------------------------------------------------- opponent AI */
  function pickSeq() {
    var tot = 0, i, s = op.spec.seqs;
    for (i = 0; i < s.length; i++) tot += s[i][0];
    var r = Math.random() * tot;
    for (i = 0; i < s.length; i++) { r -= s[i][0]; if (r <= 0) return s[i][1]; }
    return s[0][1];
  }
  function mkAtk(tok, s0, quick) {
    var kind = tok.replace(/[+-]$/, ''), last = tok.charAt(tok.length - 1), base = AT[kind];
    var sign = last === '-' ? -1 : 1, side = (kind === 'cross' || kind === 'upper') ? 0 : s0 * sign;
    var hand = side !== 0 ? side : (Math.random() < 0.5 ? -1 : 1);
    if (kind === 'hay') side = 0;
    return { kind: kind, side: side, hand: hand, tell: base.tell * op.tellK * (quick ? 0.55 : 1), strike: base.strike, rec: base.rec, dmg: base.dmg * op.power, sta: base.sta };
  }
  function startSeq(quick) {
    var toks = pickSeq(), s0 = Math.random() < 0.5 ? -1 : 1;
    if (quick) toks = ['jab' + (Math.random() < 0.5 ? '+' : '-')];
    op.seq = toks.map(function (t) { return t; }); op.seqI = 0; op.s0 = s0; op.quick = !!quick;
    beginAtk(false);
  }
  function beginAtk(linked) {
    var a = mkAtk(op.seq[op.seqI], op.s0, op.quick);
    if (linked) a.tell *= 0.6;
    a.tell *= 1 + (op.spec.venue >= 4 ? rr(0, 0.18) : 0);   // later champs vary their timing
    op.atk = a; op.st = 'tell'; op.t = 0; op.tellT = a.tell; op.whiff = false; op.beeped = false;
    op.guard = 'open';
  }
  function updateOpp(dt) {
    op.t += dt;
    if (op.flash > 0) op.flash -= dt;
    if (op.react > 0) op.react -= dt;
    if (op.perfectWin > 0) op.perfectWin -= dt;
    if (op.evadeCd > 0) op.evadeCd -= dt;
    var a = op.atk, i;
    switch (op.st) {
      case 'guard':
        op.gT -= dt;
        if (op.gT <= 0) { var gp = op.spec.guard; op.gI = (op.gI + 1) % gp.length; op.guard = gp[op.gI][0]; op.gT = gp[op.gI][1] * rr(0.85, 1.2); }
        op.sta = Math.min(100, op.sta + 7 * dt);
        op.nextAtk -= dt;
        if (op.nextAtk <= 0 && phase === 'fight' && pl.st !== 'down' && pl.st !== 'getup' && pl.invul <= 0) { var qk = op.quickNext; op.quickNext = false; startSeq(qk); }
        break;
      case 'tell':
        if (!op.beeped && op.t > op.tellT * 0.5) { op.beeped = true; R.sfx.tone(op.spec.venue >= 3 ? 1500 : 1200, 0.06, { type: 'square', vol: 0.07 }); }
        if (op.t >= op.tellT) { op.st = 'strike'; op.t = 0; op.sta -= a.sta; R.sfx.tone(300, 0.09, { type: 'sawtooth', vol: 0.07, slide: 120 }); }
        break;
      case 'strike':
        if (op.t >= a.strike) resolveStrike();
        break;
      case 'recover':
        if (op.t >= op.recT) {
          if (op.sta <= 0) { op.st = 'tired'; op.t = 0; op.guard = 'tired'; showMsg('TIRED!', 'HIT HIM NOW', 1.0, '#7cff6a'); R.sfx.play('powerup'); }
          else { op.st = 'guard'; op.t = 0; op.guard = op.spec.guard[op.gI][0]; op.gT = 0.6; op.nextAtk = rr(op.spec.gap[0], op.spec.gap[1]) / (1 + 0.08 * tier); }
        }
        break;
      case 'stagger':
        if (op.t >= 0.6) { op.st = 'guard'; op.t = 0; op.guard = 'open'; op.gT = 0.35; op.nextAtk = rr(0.5, 1.1); op.seq = null; }
        break;
      case 'tired':
        if (op.t >= 2.6) { op.sta = 40; op.st = 'guard'; op.t = 0; op.guard = 'tight'; op.gT = 0.8; op.nextAtk = 1.0; }
        break;
      case 'weave':
        if (op.t >= 0.34) { op.st = 'guard'; op.t = 0; op.guard = 'open'; op.gT = 0.3; op.nextAtk = 0.12; op.quickNext = true; }
        break;
      case 'getup':
        if (op.t >= 0.9) { op.st = 'guard'; op.t = 0; op.guard = 'tight'; op.gT = 1.0; op.nextAtk = 1.4; }
        break;
    }
    // visual targets
    oppTargets(dt);
    void i;
  }

  function resolveStrike() {
    var a = op.atk, res = hitPlayer(a);
    op.seqI++;
    if (res === 'hit' || res === 'blocked') op.whiff = false;
    if (op.seq && op.seqI < op.seq.length && pl.st !== 'down') { beginAtk(true); return; }
    op.st = 'recover'; op.t = 0; op.recT = a.rec * (op.whiff ? 1.25 : 1) * (op.spec.venue >= 5 ? 0.85 : 1);
    op.seq = null; op.guard = 'open';
  }

  /* hit on the player: returns 'hit' | 'blocked' | 'dodged' | 'ignored' */
  function hitPlayer(a) {
    if (pl.st === 'down' || pl.st === 'getup' || pl.invul > 0) { op.whiff = true; return 'ignored'; }
    var dodged = false, perfect = false;
    if (pl.st === 'dodge' && pl.t >= 0.04 && pl.t <= 0.31) {
      if (a.kind === 'hook') dodged = false;
      else if (a.kind === 'jab') dodged = pl.dir === -a.side;
      else dodged = true;
      perfect = dodged && pl.t <= 0.18;
    }
    if (dodged) {
      op.whiff = true; op.sta -= 7;
      R.sfx.tone(520, 0.1, { type: 'triangle', vol: 0.08, slide: 900 });
      R.addScore(perfect ? 150 : 30);
      if (perfect) {
        perfects++; perfectTotal++; op.perfectWin = 1.6; crowdHype = 1;
        showMsg('PERFECT!', '', 0.8, '#7cff6a'); R.sfx.play('coin'); R.vibrate(12);
        R.fx.text(X0 + pl.dx, 120, '+150', '#7cff6a');
        if (perfectTotal >= 10) R.achieve('slippery');
      } else R.fx.text(X0 + pl.dx, 120, 'DODGE', '#c8e8ff');
      return 'dodged';
    }
    var mul = 1, blocked = pl.st === 'block' && pl.sta > 0;
    if (blocked) {
      mul = { jab: 0.25, cross: 0.25, hook: 0, upper: 0.5, hay: 0.4 }[a.kind];
      pl.sta = Math.max(0, pl.sta - (a.kind === 'hook' ? 3 : a.kind === 'hay' ? 14 : 8));
      R.sfx.tone(160, 0.08, { type: 'triangle', vol: 0.12 }); R.sfx.play('tick'); R.vibrate(14);
      sparkAt(X0 + pl.dx * 0.6, 126, false);
      if (a.kind === 'hook') { R.fx.text(X0, 112, 'DUCKED!', '#c8e8ff'); R.addScore(40); }
      else R.fx.text(X0 + pl.dx, 112, 'BLOCK', '#c8e8ff');
      if (mul === 0) { op.whiff = true; return 'blocked'; }
    }
    var dmg = Math.max(1, Math.round(a.dmg * mul));
    pl.hp -= dmg; taken += dmg; ptsO += blocked ? 0 : (a.kind === 'hay' ? 3 : 1);
    if (!blocked) { pl.st = 'hurt'; pl.t = 0; pl.stun = a.kind === 'jab' ? 0.28 : 0.4; pl.dxT = a.side ? -a.side * 10 : 0; pl.punch = null; if (stars > 0) stars--; }
    hitFlash = 0.15; redFlash = blocked ? 0.12 : 0.3;
    R.fx.shake(blocked ? 1.5 : 3.5, 0.25); R.sfx.play('hit'); R.vibrate(blocked ? 20 : 60);
    sparkAt(X0 + a.side * 10, 112, !blocked);
    if (pl.hp <= 0) { pl.hp = 0; knockDownPlayer(); }
    return blocked ? 'blocked' : 'hit';
  }

  /* hit on the opponent. kind: 'jab' | 'super'. returns result string */
  function hitOpp(side, kind, weak) {
    var s = op.st, mult = 1, counter = false, perfectCounter = false, blocked = false;
    if (s === 'down' || s === 'getup' || s === 'weave') return 'miss';
    if (kind === 'super') mult = 7.5;
    else if (s === 'tell') { counter = true; mult = 2.4; }
    else if (s === 'strike') mult = 1.1;
    else if (s === 'recover') { mult = 1.5; if (op.perfectWin > 0) perfectCounter = true; }
    else if (s === 'stagger') mult = 1.5;
    else if (s === 'tired') mult = 1.9;
    else if (s === 'guard') {
      if (op.guard === 'tight' || (op.guard === 'L' && side < 0) || (op.guard === 'R' && side > 0)) blocked = true;
      else mult = op.guard === 'open' ? 1.25 : 1;
    }
    if (kind === 'super') {
      if (s === 'tell') counter = false;
    }
    var sx = X0 + op.v.bx + side * 9, sy = 74 + op.v.hy;
    if (blocked) {
      op.sta = Math.max(0, op.sta - 3); op.react = 0.1; op.hitX = side * 2;
      R.sfx.tone(210, 0.07, { type: 'square', vol: 0.09 }); R.sfx.play('tick'); R.vibrate(6);
      sparkAt(sx, 82, false); R.fx.text(sx, 58, 'BLOCKED', '#9aa4c0');
      return 'blocked';
    }
    var dmg = (kind === 'super' ? 5 : 4) * mult * (weak ? 0.5 : 1);
    dmg = Math.max(1, Math.round(dmg));
    op.hp -= dmg; dealt += dmg; ptsP += kind === 'super' ? 6 : (counter ? 3 : 1);
    op.sta = Math.max(0, op.sta - 2); op.flash = 0.06; op.react = 0.24; op.hitX = side * 6; op.hitSide = side;
    hs = kind === 'super' ? 0.12 : 0.045;
    crowdHype = Math.min(1, crowdHype + 0.4);
    R.addScore(kind === 'super' ? 500 : counter ? 200 : mult > 1 ? 80 : 50);
    sparkAt(sx, sy, kind === 'super' || counter);
    R.fx.burst(sx, sy, { n: kind === 'super' ? 14 : 6, color: ['#ffffff', '#ffec27', '#ff8a1e'], speed: 70, life: 0.3, size: 2 });
    R.sfx.play(kind === 'super' ? 'explode' : 'hit'); R.vibrate(kind === 'super' ? 60 : 14);
    if (kind === 'super') { R.fx.shake(4, 0.3); R.fx.flash('#ffffff', 0.2); }
    if (counter || perfectCounter) {
      if (counter) { op.st = 'stagger'; op.t = 0; op.seq = null; op.sta = Math.max(0, op.sta - 8); R.achieve('counter-puncher'); }
      op.perfectWin = 0;
      if (stars < 3) { stars++; R.sfx.play('powerup'); }
      showMsg('COUNTER!', stars >= 1 ? 'PRESS UP!' : '', 0.9, '#ffec27');
      R.fx.text(sx, 56, '+STAR', '#ffec27');
    }
    if (s === 'recover' && !op.whiff && op.t > 0.05) { /* trade */ }
    if (op.hp <= 0) { op.hp = 0; knockDownOpp(kind === 'super'); }
    return counter ? 'counter' : 'hit';
  }

  function sparkAt(x, y, big) { fxs.push({ x: x, y: y, t: 0, big: big }); }

  /* ----------------------------------------------------------- knockdowns */
  function knockDownOpp(bySuper) {
    op.kd++; kdsO++; ptsP += 8;
    if (bySuper) R.achieve('lights-out');
    op.st = 'down'; op.t = 0; op.fallT = 0; op.fallDir = op.hitSide || (Math.random() < 0.5 ? -1 : 1); op.seq = null;
    R.addScore(500 * (tier + 1)); R.sfx.play('explode'); R.vibrate(90); R.fx.shake(5, 0.4); R.fx.flash('#ffffff', 0.2); hs = Math.max(hs, 0.15);
    crowdHype = 1;
    var upAt = 5 + Math.floor(Math.random() * 4) + (op.kd - 1) * 2 + op.spec.chin;
    op.upAt = upAt;
    if (kdsO >= 3) op.upAt = 99;
    cnt = { who: 'opp', n: 0, t: -0.7 };
    phase = 'count'; phT = 0;
    showMsg(kdsO >= 3 ? 'T.K.O.!' : 'KNOCKDOWN!', '', 1.2, '#ff5a3a', true);
  }
  function knockDownPlayer() {
    kdsP++; ptsO += 8;
    pl.st = 'down'; pl.t = 0; pl.mash = 0; pl.need = 5 + 3 * kdsP; pl.punch = null;
    R.sfx.play('lose'); R.vibrate(100); R.fx.shake(5, 0.5); R.fx.flash('#ff3030', 0.3); redFlash = 0.5;
    cnt = { who: 'pl', n: 0, t: -0.7 };
    stars = 0;
    phase = 'count'; phT = 0;
    showMsg(kdsP >= 3 ? 'T.K.O.!' : 'KNOCKDOWN!', '', 1.2, '#ff5a3a', true);
  }
  function updateCount(dt) {
    phT += dt;
    if (cnt.t < 0) { cnt.t += dt; return; }
    cnt.t += dt;
    var step = 0.95;
    if (cnt.t >= step) {
      cnt.t -= step; cnt.n++;
      R.sfx.tone(cnt.n >= 8 ? 880 : 520, 0.09, { type: 'square', vol: 0.1 });
      if (cnt.who === 'opp' && cnt.n >= op.upAt && op.upAt <= 10) { standOpp(); return; }
      if (cnt.n >= 10) { endFight(cnt.who === 'opp', 'KO'); return; }
    }
    if (cnt.who === 'opp' && kdsO >= 3 && cnt.n >= 2) { endFight(true, 'TKO'); return; }
    if (cnt.who === 'pl' && kdsP >= 3 && cnt.n >= 2) { endFight(false, 'TKO'); return; }
    if (cnt.who === 'pl' && pl.mash >= pl.need && cnt.n >= 2) { standPlayer(); }
  }
  function standOpp() {
    op.st = 'getup'; op.t = 0; op.hp = Math.round(op.max * (op.kd === 1 ? 0.38 : 0.28)); op.sta = 60; op.guard = 'open';
    phase = 'fight'; cnt = null; R.sfx.play('select'); showMsg('FIGHT!', '', 0.8, '#ffec27');
  }
  function standPlayer() {
    pl.st = 'getup'; pl.t = 0; pl.hp = Math.round(pl.max * (kdsP === 1 ? 0.35 : 0.25)); pl.sta = 60; pl.invul = 1.6; pl.dx = 0;
    op.st = 'guard'; op.t = 0; op.guard = 'tight'; op.gT = 1; op.nextAtk = 1.8; op.seq = null;
    phase = 'fight'; cnt = null; R.sfx.play('powerup'); showMsg('FIGHT!', '', 0.8, '#ffec27'); R.vibrate(30);
  }

  /* --------------------------------------------------------------- fight flow */
  function endRound() {
    phase = 'roundEnd'; phT = 0; bell = 1; ringBell(2);
    showMsg('ROUND ' + round + ' OVER', '', 1.8, '#ffffff');
    op.st = op.st === 'tell' || op.st === 'strike' ? 'guard' : op.st; op.seq = null;
  }
  function ringBell(n) { for (var i = 0; i < n; i++) { R.sfx.tone(1568, 0.5, { type: 'sine', vol: 0.12, delay: i * 0.28 }); R.sfx.tone(2093, 0.3, { type: 'sine', vol: 0.05, delay: i * 0.28 }); } }
  function nextRound() {
    round++; tleft = ROUND_T; phase = 'intro'; phT = 1.4;    // short intro (bell + FIGHT)
    pl.hp = Math.min(pl.max, pl.hp + 18); pl.sta = 100; op.hp = Math.min(op.max, op.hp + Math.round(op.max * 0.16)); op.sta = 100;
    op.st = 'guard'; op.t = 0; op.guard = 'tight'; op.gT = 1; op.nextAtk = 1.4; pl.st = 'idle'; pl.t = 0;
  }
  function endFight(win, how) {
    phase = 'result'; phT = 0; op.win = !win; cnt = null;
    resultTxt = { win: win, how: how };
    if (win) {
      var bonus = (how === 'DEC' ? 500 : 1500) + Math.round(tleft) * 10 + 500 * (tier + 1);
      R.addScore(bonus); R.sfx.play('win'); R.vibrate(60);
      if (how === 'DEC') showMsg('YOU WIN!', 'BY DECISION', 3, '#7cff6a', true); else showMsg(how === 'TKO' ? 'T.K.O. WIN!' : 'K.O. WIN!', '+' + bonus, 3, '#7cff6a', true);
      if (fightIdx % ROSTER.length === ROSTER.length - 1) R.achieve('ring-champion');
    } else {
      if (how === 'DRAW') showMsg('DRAW!', 'REMATCH', 2.6, '#ffec27', true);
      else { R.sfx.play('lose'); showMsg(how === 'DEC' ? 'YOU LOSE' : 'K.O.!', how === 'DEC' ? 'BY DECISION' : 'YOU ARE OUT', 3, '#ff5a3a', true); }
    }
    if (how === 'DRAW') resultTxt = { draw: true };
  }
  function afterResult() {
    if (resultTxt.draw) { startFight(fightIdx); return; }
    if (resultTxt.win) { startFight(fightIdx + 1); return; }
    lives--; R.lives = Math.max(0, lives);
    if (lives <= 0) { R.gameOver(); return; }
    startFight(fightIdx);
  }
  function judge() {
    var P = Math.round(dealt + 12 * kdsO), O = Math.round(taken + 12 * kdsP);
    decision = { p: P, o: O };
    phase = 'decision'; phT = 0;
    showMsg('DECISION', '', 2.4, '#ffffff', true);
  }

  /* ---------------------------------------------------------------- player */
  function startPunch(side) {
    if (pl.cool > 0) return false;
    pl.weak = pl.sta < 8;
    pl.sta = Math.max(0, pl.sta - 8);
    pl.st = 'punch'; pl.side = side; pl.t = 0; pl.hit = false; pl.cool = 0; pl.punchT = 0;
    R.sfx.tone(480, 0.06, { type: 'triangle', vol: 0.06, slide: 900 });
    if (op.st === 'guard' && op.evadeCd <= 0 && Math.random() < op.spec.evade) { op.st = 'weave'; op.t = 0; op.weaveDir = -side; op.evadeCd = 1.6; }
    return true;
  }
  function startDodge(dir) {
    pl.st = 'dodge'; pl.t = 0; pl.dir = dir; pl.sta = Math.max(0, pl.sta - 3);
    R.sfx.tone(380, 0.08, { type: 'triangle', vol: 0.05, slide: 700 });
  }
  function startSuper() {
    stars--; pl.st = 'super'; pl.t = 0; pl.hit = false; pl.sta = Math.max(0, pl.sta - 8);
    R.sfx.tone(200, 0.25, { type: 'sawtooth', vol: 0.1, slide: 800 });
  }

  function updatePlayer(dt, locked) {
    var inp = R.input;
    pl.t += dt; pl.punchT += dt;
    if (pl.cool > 0) pl.cool -= dt;
    if (pl.invul > 0) pl.invul -= dt;
    var canAct = pl.st === 'idle' || pl.st === 'block';
    // stamina
    if (pl.st !== 'block' && pl.st !== 'punch' && pl.punchT > 0.45) pl.sta = Math.min(100, pl.sta + 15 * dt);
    else if (pl.st === 'punch') pl.sta = Math.min(100, pl.sta + 3 * dt);
    if (locked && (pl.st === 'idle' || pl.st === 'block')) { pl.st = 'idle'; buf.a = buf.b = buf.l = buf.r = buf.u = 0; }
    switch (pl.st) {
      case 'idle':
      case 'block': {
        if (locked) break;
        var wantBlock = inp.held.down && pl.sta > 0;
        if (wantBlock && pl.st !== 'block') { pl.st = 'block'; pl.t = 0; }
        else if (!wantBlock && pl.st === 'block' && pl.t > 0.1) { pl.st = 'idle'; pl.t = 0; }
        if (buf.l > 0) { buf.l = 0; startDodge(-1); }
        else if (buf.r > 0) { buf.r = 0; startDodge(1); }
        else if (buf.u > 0 && stars > 0) { buf.u = 0; startSuper(); }
        else if (pl.st === 'idle' && buf.a > 0) { buf.a = 0; startPunch(-1); }
        else if (pl.st === 'idle' && buf.b > 0) { buf.b = 0; startPunch(1); }
        if (pl.st === 'block' && pl.sta <= 0) { pl.st = 'idle'; pl.t = 0; pl.stun = 0; R.sfx.play('tick'); showMsg('GUARD DOWN', '', 0.6, '#ff8a8a'); }
        break; }
      case 'punch': {
        var tc = pl.weak ? 0.1 : 0.06;
        if (!pl.hit && pl.t >= tc) { pl.hit = true; hitOpp(pl.side, 'jab', pl.weak); }
        if (pl.t >= 0.1) {
          if (buf.l > 0) { buf.l = 0; startDodge(-1); break; }
          if (buf.r > 0) { buf.r = 0; startDodge(1); break; }
        }
        if (pl.t >= (pl.weak ? 0.4 : 0.24)) { pl.st = 'idle'; pl.t = 0; }
        break; }
      case 'dodge':
        if (pl.t >= 0.36) { pl.st = 'idle'; pl.t = 0; }
        break;
      case 'super':
        if (!pl.hit && pl.t >= 0.15) {
          pl.hit = true;
          var r = hitOpp(0, 'super', false);
          if (r === 'miss') { R.fx.text(X0, 100, 'MISSED', '#9aa4c0'); }
        }
        if (pl.t >= 0.36) { pl.st = 'idle'; pl.t = 0; }
        break;
      case 'hurt':
        if (pl.t >= pl.stun) { pl.st = 'idle'; pl.t = 0; }
        break;
      case 'getup':
        if (pl.t >= 0.7) { pl.st = 'idle'; pl.t = 0; }
        break;
      case 'down': break;
    }
    // visual lean
    var tgt = 0;
    if (pl.st === 'dodge') { var env = pl.t < 0.08 ? pl.t / 0.08 : pl.t < 0.24 ? 1 : 1 - (pl.t - 0.24) / 0.12; tgt = pl.dir * 30 * clamp(env, 0, 1); }
    else if (pl.st === 'hurt') tgt = pl.dxT;
    pl.dx += (tgt - pl.dx) * Math.min(1, dt * (pl.st === 'dodge' ? 28 : 14));
    var td = (pl.st === 'block') ? 1 : 0;
    pl.duck += (td - pl.duck) * Math.min(1, dt * 18);
    void canAct;
  }

  /* --------------------------------------------------------- opponent visuals */
  function oppTargets(dt) {
    var s = op.st, v = op.v, a = op.atk, q, T = { gl: GUARDS.tight.gl, gr: GUARDS.tight.gr, hx: 0, hy: 0, bx: 0, by: 0 }, rate = 14, i;
    var eyes = 'normal', mouth = 'closed', glow = 0;
    function guardPose(g) { q = GUARDS[g]; T.gl = q.gl.slice(); T.gr = q.gr.slice(); }
    if (s === 'guard') {
      guardPose(op.guard); T.by = Math.sin(clock * 4) * 1; T.bx = Math.sin(clock * 2.1) * 2;
      if (op.guard === 'open') { eyes = 'normal'; mouth = 'smirk'; }
      if (op.nextAtk < 0.35 && op.guard !== 'open') eyes = 'angry';
    } else if (s === 'tell' || s === 'strike') {
      var g = a.hand < 0 ? 'gl' : 'gr', sign = a.hand, other = g === 'gl' ? 'gr' : 'gl';
      var tp = s === 'tell' ? clamp(op.t / a.tell, 0, 1) : 1, sp = s === 'strike' ? clamp(op.t / a.strike, 0, 1) : 0;
      guardPose('tight'); T[other] = [-sign * 11, 84, 8];
      var tell, strike;
      switch (a.kind) {
        case 'jab': tell = [sign * 27, 92, 9]; strike = [sign * 11, 118, 18]; T.bx = -sign * 3 * tp; T.by = 2 * tp - 3 * sp; break;
        case 'cross': tell = [sign * 31, 96, 9]; strike = [sign * 2, 120, 19]; T.bx = -sign * 4 * tp; T.by = 2 * tp - 3 * sp; break;
        case 'hook': tell = [sign * 40, 84, 10]; strike = [-sign * 5, 113, 17]; T.bx = sign * 3 * tp; T.by = 1; break;
        case 'upper': tell = [sign * 12, 136, 9]; strike = [sign * 2, 106, 19]; T[other] = [-sign * 14, 134, 9]; T.by = 7 * tp - 11 * sp; break;
        default: tell = [sign * 24, 38, 11]; strike = [-sign * 2, 114, 21]; T.bx = -sign * 3 * tp; T.by = -3 * tp + 2 * sp;
      }
      var gx, gy, gr;
      if (s === 'tell') { gx = tell[0]; gy = tell[1]; gr = tell[2]; }
      else {
        var arc = a.kind === 'hook' ? Math.sin(Math.PI * sp) * 8 : 0;
        gx = lerp(tell[0], strike[0], sp); gy = lerp(tell[1], strike[1], sp) - arc; gr = lerp(tell[2], strike[2], sp);
        rate = 70;
      }
      T[g] = [gx, gy, gr];
      if (s === 'tell') {
        mouth = 'grit'; eyes = 'angry';
        if (tp > 0.5) glow = (Math.floor(op.t * 18) % 2) ? 1 : 0.45;
      } else { mouth = 'open'; eyes = 'angry'; glow = 0.6; }
    } else if (s === 'recover') {
      guardPose('open'); T.by = 2; mouth = op.whiff ? 'open' : 'grit'; eyes = op.whiff ? 'dizzy2' : 'normal';
    } else if (s === 'stagger') {
      guardPose('open'); T.by = 2; eyes = 'hurt'; mouth = 'open'; rate = 20;
    } else if (s === 'tired') {
      guardPose('tired'); T.by = 5 + Math.sin(clock * 5) * 1.5; eyes = 'tired'; mouth = 'tongue';
    } else if (s === 'weave') {
      guardPose('tight'); T.bx = op.weaveDir * 20; T.hx = op.weaveDir * 6; T.by = 3; rate = 26; mouth = 'smirk';
    } else if (s === 'down') { guardPose('open'); eyes = 'x'; mouth = 'tongue'; }
    else if (s === 'getup') { guardPose('tired'); eyes = 'dizzy'; mouth = 'open'; T.by = 4; }
    if (op.win) { eyes = 'happy'; mouth = 'smile'; guardPose('open'); T.gl = [-24, 60, 9]; T.gr = [24, 60, 9]; T.by = -2 + Math.abs(Math.sin(clock * 6)) * -3; }
    var k = Math.min(1, dt * rate);
    for (i = 0; i < 3; i++) { v.gl[i] += (T.gl[i] - v.gl[i]) * k; v.gr[i] += (T.gr[i] - v.gr[i]) * k; }
    v.hx += (T.hx - v.hx) * k; v.hy += (T.hy - v.hy) * k; v.bx += (T.bx - v.bx) * k; v.by += (T.by - v.by) * k;
    op.eyes = eyes; op.mouth = mouth; op.glow = glow;
  }

  /* ------------------------------------------------------------------- game */
  R.game({
    layout: 'full', size: [W, H], bg: '#10082a', music: 'adventure',

    _dbg: function () { return { op: op, pl: pl, phase: phase, round: round, tleft: tleft, stars: stars, lives: lives, fightIdx: fightIdx, cnt: cnt, hitPlayer: hitPlayer, startFight: startFight, endFight: endFight, judge: judge, endRound: endRound, dealt: dealt, taken: taken, buf: buf, setStars: function (n) { stars = n; } }; }, /*DBG*/

    init: function () {
      S.starOn = R.sprite(['...Y...', '..YYY..', 'YYYYYYY', '.YYYYY.', '..YYY..', '.YY.YY.', '.Y...Y.'], { Y: '#ffec27' });
      S.starOff = R.sprite(['...Y...', '..YYY..', 'YYYYYYY', '.YYYYY.', '..YYY..', '.YY.YY.', '.Y...Y.'], { Y: '#3a3050' });
      for (var i = 0; i < VENUES.length; i++) BG.push(paintVenue(VENUES[i], i));
    },

    reset: function () {
      lives = 3; R.lives = 3; R.score = 0; R.level = 1;
      clock = 0; hs = 0; fxs = []; perfectTotal = 0; drew = false; resultTxt = null; decision = null; bell = 0; crowdHype = 0;
      startFight(0);
      phT = 0;
    },

    onPress: function (b) {
      if (phase === 'count' && cnt && cnt.who === 'pl' && (b === 'a' || b === 'b' || b === 'up' || b === 'left' || b === 'right')) { if (pl.mash < 99) { pl.mash++; R.sfx.tone(300 + pl.mash * 18, 0.04, { type: 'square', vol: 0.05 }); pl.bump = 1; } return; }
      var t = 0.16;
      if (b === 'a') buf.a = t; else if (b === 'b') buf.b = t; else if (b === 'left') buf.l = t; else if (b === 'right') buf.r = t; else if (b === 'up') buf.u = t;
    },

    update: function (dt) {
      clock += dt;
      if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
      if (hitFlash > 0) hitFlash -= dt;
      if (redFlash > 0) redFlash -= dt;
      if (crowdHype > 0) crowdHype = Math.max(0, crowdHype - dt * 0.4);
      if (pl.bump > 0) pl.bump = Math.max(0, pl.bump - dt * 8);
      var i;
      for (i = fxs.length - 1; i >= 0; i--) { fxs[i].t += dt; if (fxs[i].t > 0.2) fxs.splice(i, 1); }
      if (hs > 0) { hs -= dt; return; }
      for (var k in buf) if (buf[k] > 0) buf[k] -= dt;
      switch (phase) {
        case 'intro':
          phT += dt; updateOpp(dt); updatePlayer(dt, true);
          if (phT >= 2.6) { phase = 'fight'; phT = 0; ringBell(1); showMsg('FIGHT!', '', 0.9, '#ffec27', true); R.vibrate(20); }
          break;
        case 'fight':
          tleft -= dt;
          updatePlayer(dt); updateOpp(dt);
          if (phase !== 'fight') break;
          if (tleft <= 0) { tleft = 0; endRound(); }
          else if (tleft < 5 && Math.floor(tleft + dt) !== Math.floor(tleft)) R.sfx.play('tick');
          break;
        case 'count':
          updateCount(dt); updateOpp(dt); if (pl.st !== 'down') updatePlayer(dt); else { pl.t += dt; pl.dx += (0 - pl.dx) * Math.min(1, dt * 10); }
          if (cnt && cnt.who === 'opp') op.fallT = Math.min(1, op.fallT + dt * 3);
          break;
        case 'roundEnd':
          phT += dt; updateOpp(dt); updatePlayer(dt, true);
          if (phT >= 2.0) { if (round >= ROUNDS) judge(); else { phase = 'rest'; phT = 0; showMsg('REST', '', 2.0, '#9ad0ff'); } }
          break;
        case 'rest':
          phT += dt; updateOpp(dt); updatePlayer(dt, true);
          if (phT >= 2.2) nextRound();
          break;
        case 'decision':
          phT += dt; updateOpp(dt);
          if (phT >= 2.8) {
            if (decision.p > decision.o) endFight(true, 'DEC');
            else if (decision.p === decision.o && !drew) { drew = true; endFight(false, 'DRAW'); }
            else { drew = false; endFight(false, 'DEC'); }
          }
          break;
        case 'result':
          phT += dt; updateOpp(dt);
          if (phT >= 3.2) afterResult();
          break;
      }
      if (phase !== 'count') { if (op.st === 'down' && phase !== 'result') { /* safety */ } }
    },

    render: function (ctx, w, h) {
      var shiftB = -pl.dx * 0.18, shiftO = -pl.dx * 0.1;
      drawBackdrop(ctx, shiftB);
      drawOpp(ctx, shiftO);
      drawPlayer(ctx);
      for (var i = 0; i < fxs.length; i++) drawSpark(ctx, fxs[i]);
      drawOverlays(ctx, w, h);
      drawHud(ctx, w, h);
    }
  });

  /* ----------------------------------------------------------- venue painter */
  function paintVenue(v, vi) {
    var wall = mkCanvas(W + 24, H), g = wall.getContext('2d'), i, x, y;
    var base = hex(v.wall[0]), top = hex(v.wall[1]);
    for (y = 0; y < 120; y += 3) fr(g, 0, y, W + 24, 3, rgb(mix(base, top, y / 120)));
    // pennants
    for (i = 0; i < 6; i++) { x = 4 + i * 27; fr(g, x, 38, 14, 1, 'rgba(255,255,255,0.4)'); for (var py = 0; py < 8; py++) fr(g, Math.round(x + py * 0.8), 39 + py, Math.round(14 - py * 1.6), 1, [v.rope[0], v.rope[2], v.post][i % 3]); }
    // spotlight cones
    g.globalAlpha = 0.1; g.fillStyle = v.spot;
    for (i = 0; i < 3; i++) { x = 24 + i * 56; g.beginPath(); g.moveTo(x - 3, 36); g.lineTo(x + 3, 36); g.lineTo(x + 26, 118); g.lineTo(x - 26, 118); g.closePath(); g.fill(); }
    g.globalAlpha = 1;
    // ring canvas floor
    var f0 = hex(v.floor[0]), f1 = hex(v.floor[1]);
    for (y = 118; y < H; y += 2) fr(g, 0, y, W + 24, 2, rgb(mix(f0, f1, (y - 118) / (H - 118))));
    fr(g, 0, 118, W + 24, 2, 'rgba(0,0,0,0.35)');
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1;
    for (i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(80 + i * 6, 120); g.lineTo(80 + i * 22, H); g.stroke(); }
    g.beginPath(); g.ellipse(80, 140, 46, 9, 0, 0, 7); g.strokeStyle = v.post; g.lineWidth = 2; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1;
    // crowd layer (drawn separately so it can bob)
    var cr = mkCanvas(W + 24, 80), cg = cr.getContext('2d');
    var cc0 = hex(v.crowd[0]), cc1 = hex(v.crowd[1]);
    for (var row = 0; row < 5; row++) {
      for (x = -4 + (row % 2) * 6; x < W + 28; x += 12) {
        var hh = hash(x * 3 + row * 17 + vi * 5), yy = 6 + row * 13 + Math.floor(hh * 3);
        var col = rgb(mix(cc0, cc1, row / 4 * 0.6 + hh * 0.4));
        ell(cg, x, yy + 7, 6, 7, col);
        ell(cg, x, yy, 3.5, 4, hash(x + row * 3) < 0.5 ? '#d8a888' : '#a8704a');
        if (hash(x * 7 + row) < 0.2) { fr(cg, x - 7, yy - 3, 2, 6, '#d8a888'); fr(cg, x + 6, yy - 3, 2, 6, '#a8704a'); }
      }
    }
    return { wall: wall, crowd: cr };
  }

  /* ---------------------------------------------------------------- drawing */
  function drawBackdrop(ctx, shift) {
    var B = BG[op.spec.venue], v = VENUES[op.spec.venue], i, r;
    ctx.drawImage(B.wall, Math.round(-12 + shift), 0);
    // crowd sits behind the ropes and bobs when excited
    var bob = crowdHype > 0 ? Math.round(Math.abs(Math.sin(clock * 9)) * 2 * crowdHype) : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 40, W, 80); ctx.clip();
    ctx.globalAlpha = 0.62; ctx.drawImage(B.crowd, Math.round(-12 + shift * 1.3), 44 - bob);
    ctx.restore(); ctx.globalAlpha = 1;
    // camera flashes
    for (i = 0; i < 4; i++) {
      var ph = (clock * 0.7 + i * 0.37) % 1.9;
      if (ph < 0.08) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.floor(hash(i + Math.floor(clock * 0.7 + i * 0.37) * 3) * 120) + 8, 48 + i * 9, 2, 2); }
    }
    // ropes in front of the crowd, behind the fighter
    for (r = 0; r < 3; r++) {
      var ry = 66 + r * 14;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, ry + 2, W, 1);
      ctx.fillStyle = v.rope[r]; ctx.fillRect(0, ry, W, 2); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, ry, W, 1);
    }
    // corner posts
    for (var side = 0; side < 2; side++) {
      var px = Math.round(side ? W - 10 + shift * 0.6 : -2 + shift * 0.6);
      ctx.fillStyle = v.post; ctx.fillRect(px, 52, 12, 70);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(px, 52, 3, 70);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + 9, 52, 3, 70);
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(px - 1, 50, 14, 3); ctx.fillRect(px - 1, 120, 14, 3);
      for (r = 0; r < 3; r++) ctx.fillRect(px + 1, 64 + r * 14, 10, 5);
    }
  }

  function drawStarGlint(ctx, x, y, t) {
    var s = 2 + Math.round(Math.sin(t) * 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - s - 1, 2, s * 2 + 2); ctx.fillRect(x - s - 1, y - 1, s * 2 + 2, 2);
  }

  function drawGlove(ctx, gx, gy, r, col, colD, glow, flash, sx, sy) {
    var base = flash ? '#ffffff' : col;
    if (glow > 0) { ctx.globalAlpha = 0.35 * glow; ell(ctx, gx, gy, r + 4, r + 4, '#ffec27'); ctx.globalAlpha = 1; }
    // cuff towards the shoulder
    var dx = sx - gx, dy = sy - gy, d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    var cx = gx + dx / d * r * 0.85, cy = gy + dy / d * r * 0.85;
    ellO(ctx, cx, cy, r * 0.62, r * 0.55, flash ? '#ffffff' : '#f4f0ff');
    ellO(ctx, gx, gy, r, r * 0.92, glow > 0.7 ? '#fff6a0' : base);
    if (!flash) {
      ell(ctx, gx + r * 0.3, gy + r * 0.45, r * 0.55, r * 0.35, glow > 0.7 ? '#ffe040' : colD);
      ell(ctx, gx - r * 0.35, gy - r * 0.4, r * 0.28, r * 0.2, 'rgba(255,255,255,0.75)');
    }
  }

  function drawEyes(ctx, X, Y, spec, kind, lookX) {
    var ex = [X - 6, X + 6], ey = Y - 2, i;
    for (i = 0; i < 2; i++) {
      var x = ex[i], s = i ? 1 : -1;
      if (kind === 'x') { thick(ctx, x - 2, ey - 2, x + 2, ey + 2, 1, '#1c0e2a'); thick(ctx, x + 2, ey - 2, x - 2, ey + 2, 1, '#1c0e2a'); continue; }
      if (kind === 'hurt') { thick(ctx, x - 2 * s, ey - 2, x + 2 * s, ey, 1, '#1c0e2a'); thick(ctx, x - 2 * s, ey + 2, x + 2 * s, ey, 1, '#1c0e2a'); continue; }
      if (kind === 'happy') { fr(ctx, x - 2, ey, 1, 1, '#1c0e2a'); fr(ctx, x - 1, ey - 1, 2, 1, '#1c0e2a'); fr(ctx, x + 1, ey, 1, 1, '#1c0e2a'); continue; }
      if (kind === 'dizzy') { ellO(ctx, x, ey, 3, 3, '#fff'); ell(ctx, x, ey, 1.5, 1.5, '#1c0e2a'); fr(ctx, x - 1, ey, 3, 1, '#fff'); continue; }
      ellO(ctx, x, ey, 3, kind === 'tired' ? 2 : 3.4, '#ffffff');
      var pcol = '#1c0e2a';
      if (op.spec.fx === 'eyes' && op.st === 'tell' && op.t > op.tellT * 0.5) pcol = '#ff2020';
      if (op.spec.fx === 'patch' && op.st === 'tell' && op.t > op.tellT * 0.5 && i === 1) pcol = '#ffec27';
      fr(ctx, x - 1 + lookX, ey - 1, 2, kind === 'tired' ? 2 : 3, pcol);
      if (kind === 'tired') fr(ctx, x - 3, ey - 2, 7, 2, spec.skinD);
      // brows
      var by = ey - 5;
      if (kind === 'angry') thick(ctx, x - 3, by + (i ? 3 : 0), x + 3, by + (i ? 0 : 3), 2, '#1c0e2a');
      else fr(ctx, x - 3, by, 6, 1, spec.hairC === '#c8ccd8' ? '#8a8a98' : '#3a2418');
    }
  }
  function fr2(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  function drawMouth(ctx, X, Y, kind, spec) {
    var my = Y + 8;
    if (kind === 'open') { ellO(ctx, X, my, 4, 3, '#3a0a1a'); fr2(ctx, X - 2, my, 4, 2, '#ff6a7a'); }
    else if (kind === 'grit') { fr2(ctx, X - 5, my - 2, 10, 5, '#1c0e2a'); fr2(ctx, X - 4, my - 1, 8, 3, '#ffffff'); fr2(ctx, X - 4, my, 8, 1, '#c8c8d8'); }
    else if (kind === 'tongue') { fr2(ctx, X - 4, my - 1, 8, 2, '#1c0e2a'); fr2(ctx, X - 2, my + 1, 4, 4, '#ff6a7a'); fr2(ctx, X - 2, my + 1, 4, 1, '#c8405a'); }
    else if (kind === 'smirk') { fr2(ctx, X - 4, my, 7, 1, '#1c0e2a'); fr2(ctx, X + 3, my - 1, 2, 1, '#1c0e2a'); }
    else if (kind === 'smile') { fr2(ctx, X - 5, my - 1, 1, 1, '#1c0e2a'); fr2(ctx, X - 4, my, 8, 1, '#1c0e2a'); fr2(ctx, X + 4, my - 1, 1, 1, '#1c0e2a'); fr2(ctx, X - 3, my + 1, 6, 1, '#fff'); }
    else fr2(ctx, X - 3, my, 6, 1, '#1c0e2a');
    if (spec.stache) { fr2(ctx, X - 7, my - 3, 14, 2, '#3a2010'); fr2(ctx, X - 8, my - 2, 2, 3, '#3a2010'); fr2(ctx, X + 6, my - 2, 2, 3, '#3a2010'); }
  }

  function drawHead(ctx, X, Y, spec, o) {
    var rx = spec.hrx, ry = spec.hry, hair = spec.hair, c = spec.hairC;
    // back hair
    if (hair === 'pony') { var sw = Math.sin(clock * 5) * 2; ellO(ctx, X - rx - 4 + sw, Y + 3, 5, 10, c); ellO(ctx, X + rx + 4 - sw, Y + 3, 5, 10, c); ellO(ctx, X - rx - 4 + sw, Y - 6, 3, 3, '#ffec27'); ellO(ctx, X + rx + 4 - sw, Y - 6, 3, 3, '#ffec27'); }
    if (hair === 'wild') ellO(ctx, X, Y - 2, rx + 5, ry, c);
    // ears + head
    ellO(ctx, X - rx, Y + 1, 3, 4, spec.skinD); ellO(ctx, X + rx, Y + 1, 3, 4, spec.skinD);
    ellO(ctx, X, Y, rx, ry, o.flash ? '#ffffff' : spec.skin);
    if (!o.flash) { ell(ctx, X + rx - 4, Y + 5, 4, 8, spec.skinD); ell(ctx, X, Y + 3, rx - 3, ry - 3, spec.skin); ell(ctx, X - 4, Y - 7, 5, 3, 'rgba(255,255,255,0.25)'); }
    // nose
    ell(ctx, X, Y + 3, 2.5, 2, o.flash ? '#fff' : spec.skinD);
    // beard
    if (spec.beard) { ctx.save(); ctx.beginPath(); ctx.rect(X - rx - 2, Y + 4, rx * 2 + 4, ry); ctx.clip(); ellO(ctx, X, Y + 4, rx - 1, ry - 4, spec.beard); ctx.restore(); ell(ctx, X, Y - 2, rx - 4, 9, spec.skin); ellO(ctx, X, Y + 3, 3, 2, spec.skinD); }
    if (!o.flash) { drawEyes(ctx, X, Y, spec, o.eyes, 0); drawMouth(ctx, X, Y, spec.beard && o.mouth === 'closed' ? 'smirk' : o.mouth, spec); }
    else { fr2(ctx, X - 9, Y - 5, 18, 3, '#ffffff'); }
    if (spec.patch && !o.flash) { ell(ctx, X + 6, Y - 2, 4.5, 4.5, '#14101c'); thick(ctx, X + 1, Y - 5, X - rx, Y - 10, 1, '#14101c'); thick(ctx, X + 10, Y - 4, X + rx + 1, Y - 9, 1, '#14101c'); }
    // front hair
    if (o.flash) return;
    var i;
    if (hair === 'tuft') { ellO(ctx, X + 1, Y - ry - 2, 3, 3, c); ellO(ctx, X - 2, Y - ry - 4, 2, 2, c); }
    else if (hair === 'mohawk') { for (i = -3; i <= 3; i++) { var hh = 9 - Math.abs(i) * 1.5; fr2(ctx, X + i * 2 - 1, Math.round(Y - ry - hh + 2), 3, Math.round(hh + 4), c); fr2(ctx, X + i * 2 - 1, Math.round(Y - ry - hh + 2), 1, Math.round(hh + 2), OUTL); } fr2(ctx, X - 1, Y - ry - 6, 1, 4, '#c8ffc8'); }
    else if (hair === 'band') { ell(ctx, X, Y - ry + 3, rx - 1, 4, '#3a2010'); fr2(ctx, X - rx, Y - 9, rx * 2, 4, OUTL); fr2(ctx, X - rx + 1, Y - 8, rx * 2 - 2, 2, c); var fl = Math.sin(clock * 8) * 2; thick(ctx, X + rx, Y - 8, X + rx + 7, Y - 6 + fl, 2, c); thick(ctx, X + rx, Y - 7, X + rx + 6, Y - 2 - fl, 2, c); }
    else if (hair === 'pony') { ellO(ctx, X, Y - ry + 4, rx + 1, 7, c); ell(ctx, X + 4, Y - ry + 1, 4, 2, 'rgba(255,255,255,0.5)'); ellO(ctx, X + rx - 3, Y - ry + 2, 3, 3, '#ffec27'); }
    else if (hair === 'wild') { ellO(ctx, X - 5, Y - ry + 1, 7, 6, c); ellO(ctx, X + 5, Y - ry + 1, 7, 6, c); ellO(ctx, X, Y - ry - 1, 6, 5, c); }
    else if (hair === 'bandana') { ellO(ctx, X, Y - ry + 4, rx + 1, 7, c); fr2(ctx, X - rx, Y - 6, rx * 2, 2, '#fff'); ell(ctx, X + rx + 2, Y - 6, 4, 3, c); thick(ctx, X + rx + 3, Y - 5, X + rx + 8, Y - 1 + Math.sin(clock * 7) * 2, 2, c); ellO(ctx, X - rx - 2, Y + 6, 1.5, 2, '#ffd23a'); }
    else if (hair === 'spikes') {
      var gl = (op.spec.fx === 'crown' && op.st === 'tell' && op.t > op.tellT * 0.5) ? '#ffffff' : c;
      for (i = -2; i <= 2; i++) { var sh = 12 - Math.abs(i) * 3; for (var yy = 0; yy < sh; yy++) { var ww = Math.max(1, Math.round((sh - yy) / sh * 5)); fr2(ctx, X + i * 5 - Math.floor(ww / 2), Y - ry - yy + 1, ww, 1, gl); } }
      ellO(ctx, X, Y - ry + 3, rx - 1, 4, gl); ell(ctx, X - 4, Y - ry + 2, 4, 1.5, 'rgba(255,255,255,0.7)');
      fr2(ctx, X - rx + 1, Y - 8, rx * 2 - 2, 2, '#c88a08');
    }
    // signature tell effects
    if (op.st === 'tell' && op.t > op.tellT * 0.5) {
      if (op.spec.fx === 'zap') { for (i = 0; i < 4; i++) { var zx = X - 20 + i * 13, zz = Math.floor(clock * 20 + i) % 2; thick(ctx, zx, Y - 22 - zz * 2, zx + 3, Y - 18, 1, '#ffec27'); thick(ctx, zx + 3, Y - 18, zx, Y - 14 + zz, 1, '#ffec27'); } }
      if (op.spec.fx === 'roar') { for (i = 0; i < 3; i++) fr2(ctx, X - 22 - i * 3 + (clock * 40) % 3, Y - 6 + i * 6, 3, 1, '#fff'); for (i = 0; i < 3; i++) fr2(ctx, X + 20 + i * 3 - (clock * 40) % 3, Y - 6 + i * 6, 3, 1, '#fff'); }
    }
  }

  function drawOpp(ctx, shift) {
    var spec = op.spec, v = op.v, X = Math.round(X0 + shift + v.bx), by = Math.round(v.by), flash = op.flash > 0;
    var rx = op.react > 0 ? op.hitX * (op.react / 0.24) : 0;
    var o = { flash: flash, eyes: op.eyes, mouth: op.mouth };
    if (flash) { o.eyes = 'hurt'; }
    else if (op.react > 0.1 && op.st !== 'tell') { o.eyes = 'hurt'; o.mouth = 'open'; }
    ctx.save();
    var fall = 0;
    if (op.st === 'down') {
      fall = op.fallT; var ang = op.fallDir * 1.5 * fall, ks = 1 - 0.36 * fall;
      ctx.translate(X - op.fallDir * 12 * fall, 124 + fall * 16); ctx.rotate(ang); ctx.scale(ks, ks); ctx.translate(-X, -124);
    } else if (op.st === 'getup') {
      var rise = clamp(op.t / 0.9, 0, 1), ang2 = op.fallDir * 1.5 * (1 - rise), ks2 = 1 - 0.36 * (1 - rise);
      ctx.translate(X - op.fallDir * 12 * (1 - rise), 124 + (1 - rise) * 16); ctx.rotate(ang2); ctx.scale(ks2, ks2); ctx.translate(-X, -124);
    }
    // floor shadow
    ctx.globalAlpha = 0.3; ell(ctx, X, 146, spec.sw + 6, 5, '#000'); ctx.globalAlpha = 1;
    var sw = spec.sw, sy0 = 94 + by, shoulderY = sy0 + 4;
    // legs
    var legC = flash ? '#fff' : spec.skin;
    fr2(ctx, X - Math.round(sw * 0.62), 134 + by, 11, 20, OUTL); fr2(ctx, X + Math.round(sw * 0.62) - 11, 134 + by, 11, 20, OUTL);
    fr2(ctx, X - Math.round(sw * 0.62) + 1, 134 + by, 9, 19, legC); fr2(ctx, X + Math.round(sw * 0.62) - 10, 134 + by, 9, 19, legC);
    // shoes
    fr2(ctx, X - Math.round(sw * 0.62) - 1, 150 + by, 13, 5, OUTL); fr2(ctx, X + Math.round(sw * 0.62) - 12, 150 + by, 13, 5, OUTL);
    fr2(ctx, X - Math.round(sw * 0.62), 150 + by, 11, 4, flash ? '#fff' : '#f4f0ff'); fr2(ctx, X + Math.round(sw * 0.62) - 11, 150 + by, 11, 4, flash ? '#fff' : '#f4f0ff');
    // torso
    bodyO(ctx, X, sy0, 120 + by, sw, sw * 0.8, spec.belly, flash ? '#fff' : spec.skin);
    if (!flash) {
      body(ctx, X + Math.round(sw * 0.55), sy0 + 4, 118 + by, 3, 2, 0, spec.skinD);
      ell(ctx, X - sw * 0.35, sy0 + 9, 6, 4, 'rgba(255,255,255,0.22)'); ell(ctx, X + sw * 0.35, sy0 + 9, 6, 4, 'rgba(255,255,255,0.12)');
      fr2(ctx, X - 1, sy0 + 12, 2, 12, spec.skinD); fr2(ctx, X - 1, 109 + by, 2, 2, OUTL);
    }
    // trunks
    bodyO(ctx, X, 117 + by, 138 + by, sw * 0.82, sw * 0.95, 0, flash ? '#fff' : spec.trunk);
    if (!flash) {
      fr2(ctx, X - Math.round(sw * 0.82), 117 + by, Math.round(sw * 1.64), 4, spec.trim);
      fr2(ctx, X - Math.round(sw * 0.95), 136 + by, Math.round(sw * 1.9), 2, spec.trim);
      if (spec.emblem === 'star') { fr2(ctx, X - 1, 124 + by, 3, 9, spec.trim); fr2(ctx, X - 4, 127 + by, 9, 3, spec.trim); }
      else if (spec.emblem === 'bolt') { thick(ctx, X + 2, 123 + by, X - 2, 129 + by, 2, spec.trim); thick(ctx, X - 2, 129 + by, X + 3, 130 + by, 2, spec.trim); thick(ctx, X + 3, 130 + by, X - 1, 135 + by, 2, spec.trim); }
      else if (spec.emblem === 'stripe') { fr2(ctx, X - 2, 121 + by, 4, 16, spec.trim); }
      else if (spec.emblem === 'stripes') { for (var si = -3; si <= 3; si += 2) fr2(ctx, X + si * 4 - 1, 121 + by, 2, 16, spec.trim); }
      else { for (var di = 0; di < 4; di++) { fr2(ctx, X - 10 + di * 6, 124 + by + (di % 2) * 4, 3, 3, spec.trim); } }
    }
    // arms (skin) behind gloves
    var armC = flash ? '#fff' : spec.skin, lw = spec.arm;
    var shL = [X - sw + 4, shoulderY + 3], shR = [X + sw - 4, shoulderY + 3];
    var gl = [X + v.gl[0] + rx, v.gl[1] + by, v.gl[2]], gr = [X + v.gr[0] + rx, v.gr[1] + by, v.gr[2]];
    thick(ctx, shL[0], shL[1], gl[0], gl[1], lw + 2, OUTL); thick(ctx, shR[0], shR[1], gr[0], gr[1], lw + 2, OUTL);
    thick(ctx, shL[0], shL[1], gl[0], gl[1], lw, armC); thick(ctx, shR[0], shR[1], gr[0], gr[1], lw, armC);
    ell(ctx, shL[0], shL[1], lw * 0.8, lw * 0.8, armC); ell(ctx, shR[0], shR[1], lw * 0.8, lw * 0.8, armC);
    // neck + head
    fr2(ctx, X - 5, sy0 - 6, 10, 10, OUTL); fr2(ctx, X - 4, sy0 - 6, 8, 9, flash ? '#fff' : spec.skin); if (!flash) fr2(ctx, X + 1, sy0 - 6, 3, 9, spec.skinD);
    var hx = X + v.hx + rx * 0.7, hy = 72 + by * 0.6 + v.hy + (op.st === 'tired' ? 3 : 0);
    drawHead(ctx, Math.round(hx), Math.round(hy), spec, o);
    // gloves (front)
    var glowK = op.glow;
    var glG = op.atk && (op.st === 'tell' || op.st === 'strike') ? (op.atk.hand < 0 ? 'gl' : 'gr') : '';
    drawGlove(ctx, gl[0], gl[1], gl[2], spec.glove, spec.gloveD, glG === 'gl' ? glowK : 0, flash, shL[0], shL[1]);
    drawGlove(ctx, gr[0], gr[1], gr[2], spec.glove, spec.gloveD, glG === 'gr' ? glowK : 0, flash, shR[0], shR[1]);
    // '!' alert before the strike
    if (op.st === 'tell' && op.t > op.tellT * 0.62) {
      var ax = Math.round(hx), ay = 40;
      ctx.fillStyle = '#000'; ctx.fillRect(ax - 3, ay - 1, 6, 14); ctx.fillStyle = '#ff3d3d'; ctx.fillRect(ax - 2, ay, 4, 8); ctx.fillRect(ax - 2, ay + 10, 4, 3);
    }
    if (op.spec.fx === 'tongue' && op.st === 'tell' && op.t > op.tellT * 0.5) { fr2(ctx, Math.round(hx) - 2, Math.round(hy) + 10, 5, 5, '#ff6a7a'); }
    if (op.spec.fx === 'stomp' && op.st === 'tell' && op.t > op.tellT * 0.5) { fr2(ctx, X - 36 + Math.floor(clock * 30) % 3, 150, 8, 2, 'rgba(255,255,255,0.6)'); fr2(ctx, X + 28 - Math.floor(clock * 30) % 3, 150, 8, 2, 'rgba(255,255,255,0.6)'); }
    // dizzy stars / sweat
    if (op.st === 'tired') for (var d = 0; d < 3; d++) { var sx = Math.round(hx + 18 + ((clock * 14 + d * 7) % 12) * 0.5), sy = Math.round(hy - 8 + ((clock * 20 + d * 9) % 24)); fr2(ctx, sx, sy, 2, 3, '#7ad0ff'); }
    if (op.st === 'getup' || op.st === 'down' || op.st === 'stagger') {
      for (var q = 0; q < 3; q++) { var an = clock * 5 + q * 2.1; drawStarGlint(ctx, Math.round(hx + Math.cos(an) * 20), Math.round(hy - spec.hry - 6 + Math.sin(an) * 5), clock * 8 + q); }
    }
    ctx.restore();
  }

  function drawPlayer(ctx) {
    var dx = pl.dx, duck = pl.duck * 12, X = X0 + dx * 0.7, down = pl.st === 'down';
    var kd = down ? 1 : 0;
    if (down) { ctx.fillStyle = 'rgba(10,0,20,0.35)'; ctx.fillRect(0, 36, W, H - 36); }
    var al = down ? 0.3 : 0.55;
    ctx.globalAlpha = al;
    var by = duck + (down ? 18 : 0) + (pl.st === 'getup' ? Math.max(0, 14 - pl.t * 24) : 0);
    // shoulders / back
    ellO(ctx, X, 168 + by, 34, 16, '#ffcfa8');
    ell(ctx, X, 171 + by, 28, 10, '#e8a98a');
    thick(ctx, X - 10, 160 + by, X - 4, 168 + by, 1, '#c88a70'); thick(ctx, X + 10, 160 + by, X + 4, 168 + by, 1, '#c88a70');
    fr2(ctx, X - 5, 148 + by, 10, 14, '#e8a98a');
    // head from behind
    ellO(ctx, X, 144 + by, 12, 13, '#2a1a3a');
    ell(ctx, X - 4, 139 + by, 5, 3, '#4a3a6a');
    fr2(ctx, X - 11, 146 + by, 22, 3, '#ff2f4a'); fr2(ctx, X - 11, 146 + by, 22, 1, '#ff8a9a');
    ellO(ctx, X - 12, 146 + by, 2.5, 3.5, '#ffcfa8'); ellO(ctx, X + 12, 146 + by, 2.5, 3.5, '#ffcfa8');
    thick(ctx, X - 11, 149 + by, X - 17, 156 + by, 2, '#ff2f4a');
    ctx.globalAlpha = 1;
    // gloves
    var gAl = down ? 0.35 : 0.95;
    ctx.globalAlpha = gAl;
    var i;
    for (i = -1; i <= 1; i += 2) {
      var gx = X0 + dx + i * 22 * (1 - pl.duck * 0.55), gy = 138 + duck * 0.2 - pl.duck * 14 + (down ? 22 : 0), gr = 11;
      if (pl.st === 'punch' && pl.side === i) {
        var f = pl.t < 0.07 ? pl.t / 0.07 : Math.max(0, 1 - (pl.t - 0.07) / 0.17);
        gx = lerp(gx, X0 + dx * 0.4 + i * 8 + (op.v ? op.v.bx * 0.4 : 0), f); gy = lerp(gy, 94, f); gr = lerp(11, 7, f);
      } else if (pl.st === 'super') {
        var f2 = pl.t < 0.15 ? pl.t / 0.15 : Math.max(0, 1 - (pl.t - 0.15) / 0.21);
        gx = lerp(X0 + dx + i * 22, X0 + i * 3 + dx * 0.5, f2); gy = lerp(150, 100, f2); gr = lerp(11, 12, f2);
        if (f2 > 0.3) { ctx.globalAlpha = 0.4 * f2; ell(ctx, gx, gy + 12, 7, 16, '#ffec27'); ctx.globalAlpha = gAl; }
      } else if (pl.st === 'block') { gx = X0 + dx + i * 12; gy = 118 + 2; gr = 12; }
      else if (pl.st === 'hurt') { gy += 6; }
      drawGlove(ctx, Math.round(gx), Math.round(gy), gr, '#ff2f4a', '#a01028', 0, false, X, 160);
    }
    ctx.globalAlpha = 1;
    if (pl.st === 'dodge') {   // speed lines
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (i = 0; i < 4; i++) ctx.fillRect(Math.round(X0 + dx - pl.dir * (20 + i * 5)), 128 + i * 6, 8, 1);
    }
    void kd;
  }

  function drawSpark(ctx, s) {
    var x = Math.round(s.x), y = Math.round(s.y), r = (s.big ? 9 : 5) * Math.min(1, 0.4 + s.t * 8);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - r, 2, r * 2); ctx.fillRect(x - r, y - 1, r * 2, 2);
    ctx.fillStyle = '#ffe14a';
    var d = Math.round(r * 0.7);
    ctx.fillRect(x - d, y - d, 2, 2); ctx.fillRect(x + d - 1, y - d, 2, 2); ctx.fillRect(x - d, y + d - 1, 2, 2); ctx.fillRect(x + d - 1, y + d - 1, 2, 2);
    if (s.t < 0.06) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, 6, 6); }
  }

  function drawOverlays(ctx, w, h) {
    if (redFlash > 0) { ctx.globalAlpha = Math.min(0.5, redFlash * 1.4); ctx.fillStyle = '#ff2040'; ctx.fillRect(0, 36, w, h - 36); ctx.globalAlpha = 1; }
    if (pl.hp < 25 && pl.st !== 'down' && phase === 'fight') { ctx.globalAlpha = 0.18 + 0.12 * Math.sin(clock * 8); ctx.fillStyle = '#ff2040'; ctx.fillRect(0, 36, 5, h); ctx.fillRect(w - 5, 36, 5, h); ctx.fillRect(0, h - 5, w, 5); ctx.globalAlpha = 1; }
    var playing = R.mode === 'play';
    if (phase === 'intro' && playing) {
      ctx.globalAlpha = 0.65; ctx.fillStyle = '#000'; ctx.fillRect(0, 52, w, 54); ctx.globalAlpha = 1;
      R.draw.text(ctx, 'FIGHT ' + (fightIdx + 1) + '  ROUND ' + round, w / 2, 58, { size: 8, color: '#ffec27', align: 'center', shadow: '#000' });
      R.draw.text(ctx, op.spec.full, w / 2, 72, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
      R.draw.text(ctx, tier > 0 ? 'REMATCH LV ' + (tier + 1) : 'GET READY', w / 2, 90, { size: 6, color: '#9fb2d0', align: 'center' });
    }
    if (phase === 'count' && cnt && cnt.t >= 0) {
      var n = Math.min(10, cnt.n + 1);
      if (cnt.who === 'opp') {
        R.draw.text(ctx, String(n), w / 2, 112, { size: 16, color: n >= 8 ? '#ff5a3a' : '#ffec27', align: 'center', shadow: '#000' });
        R.draw.text(ctx, 'COUNT', w / 2, 100, { size: 6, color: '#ffffff', align: 'center', shadow: '#000' });
      } else {
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 70, w, 62); ctx.globalAlpha = 1;
        R.draw.text(ctx, String(n), w / 2, 74, { size: 16, color: n >= 8 ? '#ff5a3a' : '#ffec27', align: 'center', shadow: '#000' });
        R.draw.text(ctx, 'MASH A / B!', w / 2, 98 - (pl.bump || 0) * 2, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
        var f = clamp(pl.mash / pl.need, 0, 1);
        ctx.fillStyle = '#000'; ctx.fillRect(28, 113, 80, 9); ctx.fillStyle = '#3a1020'; ctx.fillRect(29, 114, 78, 7);
        ctx.fillStyle = f >= 1 ? '#7cff6a' : '#ffec27'; ctx.fillRect(29, 114, Math.round(78 * f), 7);
      }
    }
    if (phase === 'decision' && decision) {
      ctx.globalAlpha = 0.7; ctx.fillStyle = '#000'; ctx.fillRect(0, 74, w, 50); ctx.globalAlpha = 1;
      var tm = phT > 1.2;
      R.draw.text(ctx, 'YOU', 34, 84, { size: 8, color: '#7cd0ff', align: 'center' });
      R.draw.text(ctx, op.spec.name, w - 34, 84, { size: 8, color: '#ff8a8a', align: 'center' });
      R.draw.text(ctx, tm ? String(decision.p) : '??', 34, 100, { size: 16, color: '#ffffff', align: 'center', shadow: '#000' });
      R.draw.text(ctx, tm ? String(decision.o) : '??', w - 34, 100, { size: 16, color: '#ffffff', align: 'center', shadow: '#000' });
    }
    if (msg && msg.t > 0) {
      var a = Math.min(1, msg.t * 4), my = msg.big ? 56 : 52;
      ctx.globalAlpha = a;
      var sz = msg.big ? (msg.txt.length > 9 ? 8 : 16) : 8;
      var pop = msg.max - msg.t < 0.12 ? 2 : 0;
      R.draw.text(ctx, msg.txt, w / 2, my - pop, { size: sz, color: msg.col, align: 'center', shadow: '#000' });
      if (msg.sub) R.draw.text(ctx, msg.sub, w / 2, my + sz + 4, { size: 6, color: '#ffffff', align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (hitFlash > 0) { ctx.globalAlpha = hitFlash * 2; ctx.fillStyle = '#fff'; ctx.fillRect(0, 36, w, h - 36); ctx.globalAlpha = 1; }
  }

  function bar(ctx, x, y, w, h, f, col, back, right, warn) {
    f = clamp(f, 0, 1);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
    var fw = Math.ceil(w * f);
    if (fw > 0) { ctx.fillStyle = warn ? '#ffffff' : col; ctx.fillRect(right ? x + w - fw : x, y, fw, h); if (h > 2) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(right ? x + w - fw : x, y, fw, 1); } }
  }
  function drawHud(ctx, w, h) {
    R.draw.topBar(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 12, w, 25);
    // player
    R.draw.text(ctx, 'YOU', 3, 14, { size: 6, color: '#7cd0ff' });
    bar(ctx, 3, 21, 50, 5, pl.hp / pl.max, pl.hp / pl.max > 0.5 ? '#3ddc5a' : pl.hp / pl.max > 0.25 ? '#ffd23a' : '#ff3d3d', '#4a1020', false, pl.hp < 25 && Math.floor(clock * 6) % 2 === 0);
    bar(ctx, 3, 28, 50, 2, pl.sta / 100, '#3de2ff', '#1a2a3a', false, pl.sta < 15 && Math.floor(clock * 8) % 2 === 0);
    // power badges (stars) stacked at the left edge, next to the player's gloves
    for (var i = 0; i < 3; i++) {
      var bx = 11, by = 130 - i * 15, on = i < stars, pulse = on && Math.floor(clock * 4) % 2 === 0;
      ell(ctx, bx, by, 7, 7, OUTL); ell(ctx, bx, by, 6, 6, on ? (pulse ? '#fff2a0' : '#ffd23a') : '#2a2040');
      if (on) { ell(ctx, bx, by + 1, 4, 4, '#e8a010'); ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 1, by - 3, 2, 6); ctx.fillRect(bx - 3, by - 1, 6, 2); }
      else { ctx.fillStyle = '#4a3c66'; ctx.fillRect(bx - 1, by - 3, 2, 6); ctx.fillRect(bx - 3, by - 1, 6, 2); }
    }
    if (stars > 0 && Math.floor(clock * 3) % 2 === 0 && phase === 'fight') R.draw.text(ctx, 'UP!', w / 2, 31, { size: 6, color: '#ffec27', align: 'center' });
    // opponent
    R.draw.text(ctx, op.spec.name, w - 3, 14, { size: 6, color: '#ff8a8a', align: 'right' });
    bar(ctx, w - 53, 21, 50, 5, op.hp / op.max, '#ff5a8a', '#3a1030', true, false);
    bar(ctx, w - 53, 28, 50, 2, op.sta / 100, op.st === 'tired' ? '#7cff6a' : '#ffa300', '#2a2010', true, false);
    // centre: timer + round
    var tl = Math.ceil(Math.max(0, tleft)), tx = Math.floor(tl / 60) + ':' + U.pad(tl % 60, 2);
    R.draw.text(ctx, tx, w / 2, 15, { size: 6, color: tleft < 10 ? '#ff6a6a' : '#ffffff', align: 'center' });
    R.draw.text(ctx, 'R' + round, w / 2, 24, { size: 6, color: '#ffec27', align: 'center' });
    for (var k = 0; k < 3; k++) { ctx.fillStyle = k < kdsO ? '#ff8a8a' : '#3a2a40'; ctx.fillRect(w - 6 - k * 6, 32, 4, 4); ctx.fillStyle = k < kdsP ? '#7cd0ff' : '#3a2a40'; ctx.fillRect(30 + k * 6, 32, 4, 4); }
  }
})();
