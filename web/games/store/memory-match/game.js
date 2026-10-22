/* Memory Match — flip cards, find the pairs, keep the combo alive. Built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util, D = R.draw;

  /* ------------------------------------------------------------ 8x8 icons */
  var IPAL = {
    R: '#ff4d6d', r: '#b02040', G: '#3ddc84', g: '#1e8f4e', Y: '#ffe44d', y: '#c4a010', O: '#ff9f1c', o: '#c46a0a',
    B: '#4da6ff', b: '#2a5fc4', P: '#ff7ac8', p: '#c04a90', V: '#b46bff', v: '#7a3fc4', W: '#ffffff', w: '#d8dcec',
    K: '#2a2f45', N: '#a8642a', n: '#6b3a14', C: '#4de8e0', c: '#1ea8a0'
  };
  var ICONS = [
    ['....nG..', '..RRnRR.', '.RWRRRRR', '.RWRRRRR', '.RRRRRRR', '.RRRRRRr', '..RRRRr.', '...rr...'],        // apple
    ['....nGG.', '...n.n..', '..n..n..', '.RR..RR.', 'RWRR.RWR', 'RRRR.RRR', '.rrr.rrr', '........'],        // cherries
    ['..GGGG..', '.GGGGGG.', '.RRRRRR.', 'RRWRRWRR', 'RRRRRRRR', '.RRWRRR.', '..RRRR..', '...RR...'],        // strawberry
    ['......GG', '..YYYYY.', '.YWYYYYY', 'YYWYYYYY', 'YYYYYYYy', '.YYYYYyy', '..yyyyy.', '........'],        // lemon
    ['...nGG..', '.VVVVVV.', 'VVWVVWVV', 'VVVVVVVV', '.vVVVVv.', '..vVVv..', '...vv...', '........'],        // grapes
    ['...YY...', '...YY...', 'YYYYYYYY', '.YYWYYY.', '..YYYY..', '.YYYYYY.', '.YY..YY.', '........'],        // star
    ['.PP..PP.', 'PPPPPPPP', 'PWPPPPPP', 'PPPPPPPP', '.PPPPPP.', '..PPPP..', '...PP...', '........'],        // heart
    ['..BBBB..', '.BWBBBB.', 'BBBBBBBB', 'bBBBBBBb', '.bBBBBb.', '..bBBb..', '...bb...', '........'],        // gem
    ['........', '..OOO...', '.OOOOO.O', 'OWKOOOOO', 'OOOOOOO.', '.OOOOO.O', '..OOO...', '........'],        // fish
    ['.GG..GG.', 'GWKGGWKG', 'GGGGGGGG', 'GGGGGGGG', 'GKKKKKKG', '.GGGGGG.', '..gggg..', '........'],        // frog
    ['OO....OO', 'OOO..OOO', 'OOOOOOOO', 'OKOOOOKO', 'OOOPPOOO', 'OOOKKOOO', '.OOOOOO.', '........'],        // cat
    ['..YYY...', '.YYKYY..', 'OOYYYY..', '.YYYYYY.', '.YYYYYYY', '..YYYYY.', '...YYY..', '........'],        // duck
    ['..VVVV..', '.VVVVVV.', 'VWKVVWKV', 'VWKVVWKV', 'VVVVVVVV', 'VVVVVVVV', 'VVVVVVVV', 'V.VV.VV.'],        // ghost
    ['..RRRR..', '.RRWWRR.', 'RRWWRRRR', 'RRRRRWWR', '.wwwwww.', '..wwww..', '..wwww..', '..wwww..'],        // mushroom
    ['..YYY...', '.YYY....', 'YYY.....', 'YYY.....', 'YYY.....', 'YYYY....', '.YYYYYY.', '..YYYY..']         // moon
  ];

  var MAXPAIRS = 10;
  var cols, rows, cards, geom, cur, curX, curY, picks, phase, phaseT, moves, combo, mism, timeLeft, timeMax, lvl, clock, pvT, resolveT, lastTick, clearInfo;

  /* ------------------------------------------------------------ levels */
  function gridFor(l) { return l <= 1 ? [3, 4] : l === 2 ? [4, 4] : [4, 5]; }
  function limitFor(l) { return l <= 3 ? [52, 66, 80][l - 1] : Math.max(50, 80 - 4 * (l - 3)); }
  function previewFor(l) { return Math.max(0.9, 2.3 - 0.25 * (l - 1)); }
  function mismatchFor(l) { return Math.max(0.5, 0.85 - 0.04 * (l - 1)); }

  function calcGeom() {
    var gap = 6, areaX = 8, areaY = 44, areaW = 256, areaH = 262;
    var cw = Math.min(Math.floor((areaW - (cols - 1) * gap) / cols), 72), ch = Math.min(Math.floor((areaH - (rows - 1) * gap) / rows), 64);
    var gw = cols * cw + (cols - 1) * gap, gh = rows * ch + (rows - 1) * gap;
    geom = { gap: gap, cw: cw, ch: ch, gx: Math.round(areaX + (areaW - gw) / 2), gy: Math.round(areaY + (areaH - gh) / 2), s: Math.max(2, Math.floor(Math.min(cw, ch) * 0.72 / 8)) };
  }
  function cardX(i) { return geom.gx + (i % cols) * (geom.cw + geom.gap); }
  function cardY(i) { return geom.gy + Math.floor(i / cols) * (geom.ch + geom.gap); }

  function makeCard(icon, state) { return { icon: icon, state: state || 0, flip: state ? 1 : 0, target: state ? 1 : 0, delay: 0, pop: 9, shake: 0 }; }

  function startLevel(l) {
    lvl = l; R.level = l;
    var g = gridFor(l); cols = g[0]; rows = g[1];
    calcGeom();
    var pairs = cols * rows / 2;
    var pool = U.shuffle(ICONS.map(function (_, i) { return i; })).slice(0, pairs);
    var deck = U.shuffle(pool.concat(pool));
    cards = deck.map(function (ic) { return makeCard(ic, 0); });
    timeMax = limitFor(l); timeLeft = timeMax;
    picks = []; moves = 0; combo = 0; mism = 0; cur = (rows >> 1) * cols + (cols >> 1);
    curX = cardX(cur); curY = cardY(cur);
    // preview: show every card for a moment
    phase = 'preview'; pvT = previewFor(l); phaseT = 0; resolveT = 0; lastTick = -1; clearInfo = null;
    cards.forEach(function (c, i) { c.target = 1; c.delay = i * 0.04; });
    if (l >= 5) R.achieve('level5');
  }

  /* ------------------------------------------------------------ actions */
  function flipCard(i) {
    var c = cards[i];
    if (c.state !== 0) return;
    c.state = 1; c.target = 1; c.delay = 0;
    picks.push(i);
    R.sfx.tone(520 + 40 * c.icon, 0.06, { vol: 0.11 });
    R.vibrate(6);
    if (picks.length === 2) { phase = 'resolve'; resolveT = 0.38; moves++; }
  }

  function resolvePair() {
    var a = cards[picks[0]], b = cards[picks[1]];
    if (a.icon === b.icon) {
      a.state = b.state = 2; a.pop = b.pop = 0;
      combo++; 
      var pts = (100 + 10 * lvl) * Math.min(combo, 5);
      R.addScore(pts);
      timeLeft = Math.min(timeMax + 10, timeLeft + 2);
      [picks[0], picks[1]].forEach(function (i) {
        R.fx.burst(cardX(i) + geom.cw / 2, cardY(i) + geom.ch / 2, { n: 14, color: [C.yellow, C.pink, C.cyan, C.white, C.lime], speed: 100, life: 0.7, size: 3, gravity: 60 });
      });
      var mx = (cardX(picks[0]) + cardX(picks[1]) + geom.cw) / 2, my = (cardY(picks[0]) + cardY(picks[1]) + geom.ch) / 2;
      R.fx.text(mx, my - 8, '+' + pts + (combo > 1 ? ' x' + Math.min(combo, 5) : ''), combo > 1 ? C.orange : C.white);
      R.sfx.play('coin'); R.vibrate(combo > 2 ? 30 : 14);
      if (combo >= 3) R.sfx.tone(700 + combo * 90, 0.12, { vol: 0.1, delay: 0.1, type: 'triangle' });
      R.achieve('first-pair'); if (combo >= 4) R.achieve('combo-4');
      picks = []; phase = 'play';
      if (cards.every(function (c) { return c.state === 2; })) levelClear();
    } else {
      mism++; combo = 0;
      cards[picks[0]].shake = cards[picks[1]].shake = 0.3;
      R.sfx.play('hit'); R.vibrate(25);
      phase = 'wait'; resolveT = mismatchFor(lvl);
    }
  }

  function levelClear() {
    var bonus = Math.floor(timeLeft) * 10 + 100 * lvl + (mism === 0 ? 300 : 0);
    R.addScore(bonus);
    clearInfo = { bonus: bonus, moves: moves, mism: mism };
    phase = 'clear'; phaseT = 2.3;
    if (mism <= 2) R.achieve('sharp');
    R.sfx.play('win'); R.vibrate(60); R.fx.flash(C.yellow, 0.2);
    for (var i = 0; i < 6; i++) R.fx.burst(U.rand(30, 240), U.rand(60, 280), { n: 12, color: [C.yellow, C.pink, C.cyan, C.lime, C.orange], speed: 110, life: 1, size: 3, gravity: 80 });
  }

  function timeUp() {
    phase = 'timeup'; phaseT = 1.6;
    cards.forEach(function (c, i) { if (c.state !== 2) { c.state = 1; c.target = 1; c.delay = i * 0.02; } });
    R.sfx.play('lose'); R.vibrate(100); R.fx.shake(2, 0.3);
  }

  /* ------------------------------------------------------------ drawing */
  var silCache = {};
  function icon(ctx, k, cx, cy, s) {
    var key = k + '_' + s;
    if (!silCache[key]) {
      var pal = {}; Object.keys(IPAL).forEach(function (c) { pal[c] = '#2a2f45'; });
      silCache[key] = R.sprite(ICONS[k], pal, s);
    }
    var sil = silCache[key], spr = silCache['c' + key] || (silCache['c' + key] = R.sprite(ICONS[k], IPAL, s)), x = Math.round(cx - spr.width / 2), y = Math.round(cy - spr.height / 2), o = 2;
    for (var dy = -o; dy <= o; dy += o) for (var dx = -o; dx <= o; dx += o) if (dx || dy) D.sprite(ctx, sil, x + dx, y + dy);
    D.sprite(ctx, spr, x, y);
  }

  function drawBack(ctx, w, h) {
    var x = -w / 2, y = -h / 2;
    D.rect(ctx, x, y, w, h, '#4a2fa8');
    D.rect(ctx, x, y, w, 3, '#8a63f0'); D.rect(ctx, x, y, 3, h, '#8a63f0');
    D.rect(ctx, x, y + h - 3, w, 3, '#2e1b78'); D.rect(ctx, x + w - 3, y, 3, h, '#2e1b78');
    D.rect(ctx, x + 6, y + 6, w - 12, h - 12, '#5b3ac8');
    D.frame(ctx, x + 6, y + 6, w - 12, h - 12, '#7d5ce8', 1);
    var dm = Math.min(w, h) * 0.22;
    ctx.fillStyle = '#ff7ac8';
    ctx.beginPath(); ctx.moveTo(0, -dm); ctx.lineTo(dm, 0); ctx.lineTo(0, dm); ctx.lineTo(-dm, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd0ec';
    ctx.beginPath(); ctx.moveTo(0, -dm * 0.5); ctx.lineTo(dm * 0.5, 0); ctx.lineTo(0, dm * 0.5); ctx.lineTo(-dm * 0.5, 0); ctx.closePath(); ctx.fill();
  }

  function drawFront(ctx, w, h, c) {
    var x = -w / 2, y = -h / 2, matched = c.state === 2;
    D.rect(ctx, x, y, w, h, matched ? '#cfe8d8' : '#fdf3e3');
    D.rect(ctx, x, y, w, 3, '#ffffff'); D.rect(ctx, x, y, 3, h, '#ffffff');
    D.rect(ctx, x, y + h - 3, w, 3, matched ? '#7fb098' : '#d8c8a8'); D.rect(ctx, x + w - 3, y, 3, h, matched ? '#7fb098' : '#d8c8a8');
    if (matched) ctx.globalAlpha = 0.9;
    icon(ctx, c.icon, 0, 0, geom.s);
    ctx.globalAlpha = 1;
    if (matched) D.frame(ctx, x, y, w, h, '#3ddc84', 2);
  }

  function drawCard(ctx, i) {
    var c = cards[i], w = geom.cw, h = geom.ch;
    var cx = cardX(i) + w / 2, cy = cardY(i) + h / 2;
    var sx = Math.abs(Math.cos(Math.PI * c.flip)), lift = Math.sin(Math.PI * c.flip) * 5;
    var pop = c.pop < 0.3 ? 1 + 0.12 * Math.sin(Math.PI * c.pop / 0.3) : 1;
    var shake = c.shake > 0 ? Math.sin(c.shake * 60) * 3 * (c.shake / 0.3) : 0;
    ctx.save();
    ctx.translate(Math.round(cx + shake), Math.round(cy - lift));
    ctx.scale(Math.max(0.02, sx) * pop, pop);
    // soft shadow
    ctx.globalAlpha = 0.35; D.rect(ctx, -w / 2 + 3, -h / 2 + 4, w, h, '#000'); ctx.globalAlpha = 1;
    if (c.flip > 0.5) drawFront(ctx, w, h, c); else drawBack(ctx, w, h);
    ctx.restore();
  }

  function renderHud(ctx) {
    D.rect(ctx, 0, 0, 272, 38, '#0c1030'); D.rect(ctx, 0, 37, 272, 1, '#2a3558');
    D.text(ctx, 'SC ' + U.pad(R.score, 5), 8, 4, { size: 8, color: C.yellow });
    D.text(ctx, 'MOVES ' + moves, 136, 4, { size: 8, color: C.white, align: 'center' });
    D.text(ctx, 'HI ' + U.pad(Math.max(R.hud.hi, R.score), 5), 264, 4, { size: 8, color: '#8fa3c8', align: 'right' });
    D.text(ctx, 'LV' + lvl, 8, 16, { size: 8, color: C.pink });
    D.text(ctx, 'TIME ' + Math.max(0, Math.ceil(timeLeft)), 136, 16, { size: 8, color: timeLeft < 10 ? C.red : C.cyan, align: 'center' });
    if (combo > 1) D.text(ctx, 'COMBO x' + Math.min(combo, 5), 264, 16, { size: 8, color: C.orange, align: 'right' });
    // time bar
    var f = U.clamp(timeLeft / timeMax, 0, 1), col = f > 0.5 ? C.lime : f > 0.25 ? C.yellow : C.red;
    D.rect(ctx, 8, 28, 256, 6, '#1d2650');
    if (!(f < 0.17 && Math.floor(clock * 6) % 2)) D.rect(ctx, 8, 28, Math.round(256 * f), 6, col);
    D.rect(ctx, 8, 28, Math.round(256 * f), 2, 'rgba(255,255,255,.35)');
  }

  R.game({
    layout: 'full', size: [272, 328], bg: '#0b0e26', music: 'retro',

    reset: function () {
      clock = 0;
      startLevel(1);        // cards stay face down on the READY screen; the preview plays once the game starts
    },

    update: function (dt) {
      clock += dt;
      var i, c;
      for (i = 0; i < cards.length; i++) {
        c = cards[i];
        if (c.delay > 0) c.delay -= dt;
        else if (c.flip !== c.target) {
          var d = dt / 0.16; if (c.flip < c.target) c.flip = Math.min(c.target, c.flip + d); else c.flip = Math.max(c.target, c.flip - d);
        }
        if (c.pop < 9) c.pop += dt;
        if (c.shake > 0) c.shake -= dt;
      }
      curX += (cardX(cur) - curX) * Math.min(1, dt * 28); curY += (cardY(cur) - curY) * Math.min(1, dt * 28);

      // cursor movement (always possible, wraps around)
      if (phase === 'play' || phase === 'resolve' || phase === 'wait' || phase === 'preview') {
        var mx = 0, my = 0;
        if (R.input.rep('left', 170, 75)) mx = -1;
        if (R.input.rep('right', 170, 75)) mx = 1;
        if (R.input.rep('up', 170, 75)) my = -1;
        if (R.input.rep('down', 170, 75)) my = 1;
        if (mx || my) {
          var x = cur % cols, y = Math.floor(cur / cols);
          x = (x + mx + cols) % cols; y = (y + my + rows) % rows; cur = y * cols + x;
          R.sfx.play('move');
        }
      }

      if (phase === 'preview') {
        phaseT += dt;
        if (phaseT >= pvT || R.input.pressed('a')) {
          phase = 'play';
          cards.forEach(function (cc, k) { cc.target = 0; cc.delay = k * 0.03; });
          R.sfx.play('rotate');
        }
      } else if (phase === 'play') {
        timeLeft -= dt;
        var secs = Math.ceil(timeLeft);
        if (timeLeft < 6 && secs !== lastTick && secs > 0) { lastTick = secs; R.sfx.play('tick'); }
        if (timeLeft <= 0) { timeLeft = 0; timeUp(); return; }
        if (R.input.pressed('a')) {
          if (cards[cur].state === 0) flipCard(cur);
          else R.sfx.tone(150, 0.05, { vol: 0.08, type: 'triangle' });
        }
      } else if (phase === 'resolve') {
        timeLeft -= dt;
        resolveT -= dt;
        if (resolveT <= 0) resolvePair();
        if (timeLeft <= 0 && phase !== 'clear') { timeLeft = 0; timeUp(); }
      } else if (phase === 'wait') {
        timeLeft -= dt;
        resolveT -= dt;
        if (R.input.pressed('a')) resolveT = Math.min(resolveT, 0.05);
        if (resolveT <= 0) {
          picks.forEach(function (k) { cards[k].state = 0; cards[k].target = 0; cards[k].delay = 0; });
          picks = []; phase = 'play'; R.sfx.play('move');
        }
        if (timeLeft <= 0) { timeLeft = 0; timeUp(); }
      } else if (phase === 'clear') {
        phaseT -= dt;
        if (Math.random() < dt * 8) R.fx.burst(U.rand(20, 250), U.rand(50, 300), { n: 6, color: [C.yellow, C.pink, C.lime], speed: 70, life: 0.7, size: 2, gravity: 60 });
        if (phaseT <= 0) { R.sfx.play('powerup'); startLevel(lvl + 1); }
      } else if (phase === 'timeup') {
        phaseT -= dt;
        if (phaseT <= 0) { phase = 'over'; R.gameOver(); }
      }
    },

    render: function (ctx, W, H) {
      renderHud(ctx);
      var i;
      for (i = 0; i < cards.length; i++) drawCard(ctx, i);
      // cursor
      if (phase !== 'clear' && phase !== 'timeup' && phase !== 'over') {
        var pulse = Math.floor(clock * 6) % 2, t = pulse ? 3 : 2, o = pulse ? 4 : 3;
        D.frame(ctx, Math.round(curX) - o, Math.round(curY) - o, geom.cw + o * 2, geom.ch + o * 2, C.yellow, t);
      }
      if (phase === 'preview' && R.mode === 'play') {
        D.rect(ctx, 56, 306, 160, 16, 'rgba(0,0,0,.6)');
        D.text(ctx, 'MEMORIZE!', 136, 310, { size: 8, color: C.yellow, align: 'center' });
      } else D.text(ctx, 'A FLIP  ARROWS MOVE', 136, 314, { size: 6, color: '#5d6d99', align: 'center' });
      if (phase === 'clear') {
        D.rect(ctx, 20, 118, 232, 92, 'rgba(6,10,28,.9)'); D.frame(ctx, 20, 118, 232, 92, C.yellow, 2);
        D.text(ctx, 'BOARD CLEAR!', 136, 128, { size: 16, color: C.yellow, align: 'center', shadow: '#000' });
        D.text(ctx, 'TIME BONUS +' + clearInfo.bonus, 136, 156, { size: 8, color: C.lime, align: 'center' });
        D.text(ctx, 'MOVES ' + clearInfo.moves + '  MISS ' + clearInfo.mism, 136, 172, { size: 8, color: C.white, align: 'center' });
        if (clearInfo.mism === 0) D.text(ctx, 'FLAWLESS!', 136, 190, { size: 8, color: C.pink, align: 'center' });
      }
      if (phase === 'timeup' || phase === 'over') {
        D.rect(ctx, 20, 56, 232, 40, 'rgba(24,6,12,.92)'); D.frame(ctx, 20, 56, 232, 40, C.red, 2);
        D.text(ctx, "TIME'S UP!", 136, 68, { size: 16, color: C.red, align: 'center', shadow: '#000' });
      }
    },

    serialize: function () {
      if (phase === 'clear') return { lvl: lvl + 1, fresh: true };
      var up = picks.length === 1 ? picks[0] : -1;
      return {
        lvl: lvl, ic: cards.map(function (c) { return c.icon; }),
        st: cards.map(function (c, i) { return c.state === 2 ? '2' : i === up ? '1' : '0'; }).join(''),
        cur: cur, moves: moves, combo: combo, mism: mism, time: timeLeft, tmax: timeMax
      };
    },
    restore: function (s) {
      startLevel(s.lvl || 1);
      if (s.fresh || !s.ic) return;
      var g = gridFor(lvl);
      if (s.ic.length !== g[0] * g[1]) return;
      cards = s.ic.map(function (ic, i) { return makeCard(ic, +s.st.charAt(i) || 0); });
      picks = []; cards.forEach(function (c, i) { if (c.state === 1) picks.push(i); });
      cur = U.clamp(s.cur | 0, 0, cards.length - 1); curX = cardX(cur); curY = cardY(cur);
      moves = s.moves | 0; combo = s.combo | 0; mism = s.mism | 0; timeMax = s.tmax || timeMax; timeLeft = U.clamp(s.time == null ? timeMax : s.time, 0.5, timeMax + 10);
      phase = 'play'; phaseT = 0;
    }
  });
})();
