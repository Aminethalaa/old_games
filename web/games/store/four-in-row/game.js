/* Four in a Row — connect four against a CPU that gets smarter every level. Built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util, D = R.draw;

  /* ------------------------------------------------------------ CPU (negamax + alpha-beta, node-budgeted so a move never takes long) */
  /*AI-BEGIN*/
  var AI = (function () {
    var NC = 7, NR = 6, ORDER = [3, 2, 4, 1, 5, 0, 6];
    var WINS = [], CELLW = [], i;
    (function () {
      var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
      for (var c = 0; c < NC; c++) for (var r = 0; r < NR; r++) dirs.forEach(function (d) {
        var cells = [];
        for (var k = 0; k < 4; k++) {
          var cc = c + d[0] * k, rr = r + d[1] * k;
          if (cc < 0 || cc >= NC || rr < 0 || rr >= NR) { cells = null; break; }
          cells.push(cc * NR + rr);
        }
        if (cells) WINS.push(cells);
      });
      for (i = 0; i < NC * NR; i++) CELLW.push([]);
      WINS.forEach(function (w, id) { w.forEach(function (cell) { CELLW[cell].push(id); }); });
    })();
    var H = new Int8Array(NC), W1 = new Int8Array(WINS.length), W2 = new Int8Array(WINS.length), VAL = new Int16Array(25);
    var A_VAL = [0, 1, 6, 30, 0];
    for (var a = 0; a < 5; a++) for (var b = 0; b < 5; b++) VAL[a * 5 + b] = (a && b) ? 0 : a ? A_VAL[a] : -A_VAL[b];
    var evalS = 0, nodes = 0, cap = 0, aborted = false;
  
    function put(c, p) {
      var r = H[c]++, ws = CELLW[c * NR + r], win = false;
      for (var k = 0; k < ws.length; k++) {
        var w = ws[k], x = W1[w], y = W2[w];
        evalS -= VAL[x * 5 + y];
        if (p === 1) x++; else y++;
        W1[w] = x; W2[w] = y;
        evalS += VAL[x * 5 + y];
        if (x === 4 || y === 4) win = true;
      }
      return win;
    }
    function unput(c, p) {
      var r = --H[c], ws = CELLW[c * NR + r];
      for (var k = 0; k < ws.length; k++) {
        var w = ws[k], x = W1[w], y = W2[w];
        evalS -= VAL[x * 5 + y];
        if (p === 1) x--; else y--;
        W1[w] = x; W2[w] = y;
        evalS += VAL[x * 5 + y];
      }
    }
    function nega(depth, alpha, beta, p) {
      if (++nodes > cap) aborted = true;
      if (aborted) return 0;
      if (depth === 0) return p === 1 ? evalS : -evalS;
      var best = -100000, any = false;
      for (var oi = 0; oi < NC; oi++) {
        var c = ORDER[oi];
        if (H[c] >= NR) continue;
        any = true;
        var v, win = put(c, p);
        if (win) v = 10000 + depth; else v = -nega(depth - 1, -beta, -alpha, 3 - p);
        unput(c, p);
        if (aborted) return 0;
        if (v > best) best = v;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return any ? best : 0;
    }
    function load(cols) {
      H.fill(0); W1.fill(0); W2.fill(0); evalS = 0;
      for (var c = 0; c < NC; c++) for (var r = 0; r < cols[c].length; r++) put(c, cols[c][r]);
    }
    /** cols[c] = array of 1/2 bottom-up. Returns {col, depth, nodes, val}. */
    function choose(cols, p, maxDepth, nodeCap) {
      load(cols); nodes = 0; cap = nodeCap; aborted = false;
      var legal = ORDER.filter(function (c) { return H[c] < NR; });
      var res = { col: legal[0], depth: 0, val: 0, nodes: 0 };
      // immediate win
      for (var k = 0; k < legal.length; k++) { var w = put(legal[k], p); unput(legal[k], p); if (w) { res.col = legal[k]; res.val = 10000; return res; } }
      var order = legal.slice();
      for (var d = 1; d <= maxDepth; d++) {
        var bestV = -100000, ties = [], local = true;
        for (var j = 0; j < order.length; j++) {
          var c = order[j], v;
          put(c, p);
          v = -nega(d - 1, -100000, -(bestV - 1), 3 - p);      // window keeps moves that are exactly as good as the best so far
          unput(c, p);
          if (aborted) { local = false; break; }
          if (v > bestV) { bestV = v; ties = [c]; } else if (v === bestV) ties.push(c);
        }
        if (!local) break;
        res.col = ties[Math.floor(Math.random() * ties.length)]; res.val = bestV; res.depth = d; res.ties = ties.length;
        order = [ties[0]].concat(order.filter(function (c) { return c !== ties[0]; }));
        if (bestV >= 9000 || bestV <= -9000) break;      // game decided at this depth
      }
      res.nodes = nodes;
      return res;
    }
    return { choose: choose, WINS: WINS };
  })();
  /*AI-END*/
  var LEVELS = [
    { d: 2, r: 0.30, cap: 20000, name: 'EASY' },
    { d: 3, r: 0.12, cap: 20000, name: 'NORMAL' },
    { d: 4, r: 0.04, cap: 25000, name: 'GOOD' },
    { d: 5, r: 0, cap: 30000, name: 'HARD' },
    { d: 7, r: 0, cap: 40000, name: 'EXPERT' },
    { d: 9, r: 0, cap: 55000, name: 'MASTER' }
  ];
  function cfgFor(l) { return LEVELS[Math.min(l, LEVELS.length) - 1]; }

  /* ------------------------------------------------------------ board geometry */
  var NC = 7, NR = 6, CELL = 34, BX = 17, BY = 90, DISC = 14, HOVER_Y = 66;
  var RED = '#ff3b5c', YEL = '#ffd23a';
  var cols, turn, col, hoverX, phase, phaseT, lvl, clock, drop, cpuCol, winLine, winInfo, humanMoves;

  function cellX(c) { return BX + c * CELL + CELL / 2; }
  function cellY(rBottom) { return BY + (NR - 1 - rBottom) * CELL + CELL / 2; }
  function full(c) { return cols[c].length >= NR; }
  function boardFull() { for (var c = 0; c < NC; c++) if (!full(c)) return false; return true; }

  /* first run of 4+ discs (returns {p, cells:[[c,r]..], diag}) or null */
  function findLine() {
    var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    function at(c, r) { return c >= 0 && c < NC && r >= 0 && r < cols[c].length ? cols[c][r] : 0; }
    for (var c = 0; c < NC; c++) for (var r = 0; r < cols[c].length; r++) {
      var p = cols[c][r];
      for (var k = 0; k < dirs.length; k++) {
        var dx = dirs[k][0], dy = dirs[k][1];
        if (at(c - dx, r - dy) === p) continue;               // not the start of a run
        var cells = [], cc = c, rr = r;
        while (at(cc, rr) === p) { cells.push([cc, rr]); cc += dx; rr += dy; }
        if (cells.length >= 4) return { p: p, cells: cells, diag: dy !== 0 && dx !== 0 };
      }
    }
    return null;
  }

  function nextFreeCol(from, dir) {
    for (var i = 0; i < NC; i++) { var c = (from + dir * (i + 1) + NC * 2) % NC; if (!full(c)) return c; }
    return from;
  }

  /* ------------------------------------------------------------ rounds */
  function newRound() {
    cols = []; for (var c = 0; c < NC; c++) cols.push([]);
    turn = 1; col = 3; hoverX = cellX(3); drop = null; winLine = null; winInfo = null; humanMoves = 0;
    phase = 'player'; phaseT = 0; cpuCol = -1;
    R.level = lvl;
    if (lvl >= 5) R.achieve('level5');
  }

  function startDrop(c, p) {
    var r = cols[c].length;
    cols[c].push(p);
    drop = { c: c, r: r, p: p, y: HOVER_Y, vy: 0, bounced: false };
    if (p === 1) humanMoves++;
    phase = 'drop';
    R.sfx.tone(p === 1 ? 420 : 340, 0.05, { vol: 0.08, slide: 260 });
  }

  function thinkCpu() {
    var cfg = cfgFor(lvl), c;
    if (Math.random() < cfg.r) { do { c = U.randInt(0, NC); } while (full(c)); }
    else c = AI.choose(cols, 2, cfg.d, cfg.cap).col;
    cpuCol = c; phase = 'cpu'; phaseT = 0.45 + Math.abs(c - col) * 0.05 + Math.random() * 0.2;
  }

  function landed() {
    var d = drop; drop = null;
    R.sfx.play('land'); R.vibrate(d.p === 1 ? 8 : 5);
    R.fx.burst(cellX(d.c), cellY(d.r) + 10, { n: 6, color: d.p === 1 ? ['#ff9aa8', '#fff'] : ['#fff0a0', '#fff'], speed: 45, life: 0.3, size: 2 });
    var line = findLine();
    if (line) { endRound(line); return; }
    if (boardFull()) { endDraw(); return; }
    turn = 3 - d.p;
    if (turn === 1) { phase = 'player'; col = full(col) ? nextFreeCol(col, 1) : col; }
    else thinkCpu();
  }

  function endRound(line) {
    winLine = line; phaseT = 0;
    if (line.p === 1) {
      var pts = 100 * lvl + Math.max(0, 22 - humanMoves) * 10;
      R.addScore(pts);
      winInfo = { pts: pts, moves: humanMoves };
      phase = 'win'; phaseT = 2.4;
      R.sfx.play('win'); R.vibrate(70); R.fx.flash(C.white, 0.2); R.fx.shake(3, 0.3);
      line.cells.forEach(function (cl) { R.fx.burst(cellX(cl[0]), cellY(cl[1]), { n: 10, color: [C.yellow, C.white, C.pink, C.cyan], speed: 90, life: 0.8, size: 3, gravity: 60 }); });
      R.achieve('first-win');
      if (line.diag) R.achieve('diagonal');
      if (humanMoves <= 6) R.achieve('quick-win');
    } else {
      phase = 'lost'; phaseT = 2;
      R.sfx.play('hit'); R.vibrate(60); R.fx.shake(4, 0.4); R.fx.flash(C.red, 0.15);
    }
  }

  function endDraw() {
    phase = 'draw'; phaseT = 1.9; R.addScore(50);
    R.sfx.play('powerup'); R.vibrate(30);
    R.fx.text(136, 150, 'DRAW +50', C.cyan);
  }

  /* ------------------------------------------------------------ drawing */
  function drawDisc(ctx, x, y, p, alpha, ring) {
    var base = p === 1 ? RED : YEL, dark = U.shade(base, -0.35), light = U.shade(base, 0.5);
    if (alpha != null) ctx.globalAlpha = alpha;
    D.circle(ctx, x, y, DISC, dark);
    D.circle(ctx, x, y, DISC - 1.5, base);
    D.circle(ctx, x, y, DISC - 5.5, U.shade(base, -0.12));
    D.circle(ctx, x, y, DISC - 7.5, base);
    ctx.fillStyle = light; ctx.fillRect(Math.round(x - 8), Math.round(y - 9), 4, 2); ctx.fillRect(Math.round(x - 9), Math.round(y - 8), 2, 4);
    if (p === 2) { ctx.fillStyle = dark; ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4); }       // CPU discs carry a centre dot (readable on mono LCDs)
    if (ring) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, DISC + 1, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  function drawBoardPanel(ctx) {
    var px = BX - 6, py = BY - 6, pw = NC * CELL + 12, ph = NR * CELL + 12;
    ctx.fillStyle = '#2a4fd6';
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    for (var c = 0; c < NC; c++) for (var r = 0; r < NR; r++) { ctx.moveTo(cellX(c) + DISC, cellY(r)); ctx.arc(cellX(c), cellY(r), DISC, 0, Math.PI * 2, true); }
    ctx.fill('evenodd');
    // bevel
    D.rect(ctx, px, py, pw, 3, '#5b86ff'); D.rect(ctx, px, py, 3, ph, '#5b86ff');
    D.rect(ctx, px, py + ph - 3, pw, 3, '#1a2f8f'); D.rect(ctx, px + pw - 3, py, 3, ph, '#1a2f8f');
    // hole rims
    ctx.strokeStyle = '#1a2f8f'; ctx.lineWidth = 2;
    for (c = 0; c < NC; c++) for (r = 0; r < NR; r++) { ctx.beginPath(); ctx.arc(cellX(c), cellY(r), DISC + 1, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(120,160,255,.55)'; ctx.lineWidth = 1;
    for (c = 0; c < NC; c++) for (r = 0; r < NR; r++) { ctx.beginPath(); ctx.arc(cellX(c), cellY(r), DISC + 2.5, Math.PI * 0.85, Math.PI * 1.45); ctx.stroke(); }
  }

  function renderHud(ctx) {
    D.rect(ctx, 0, 0, 272, 40, '#0c1030'); D.rect(ctx, 0, 39, 272, 1, '#2a3558');
    D.text(ctx, 'SC ' + U.pad(R.score, 5), 8, 5, { size: 8, color: C.yellow });
    D.text(ctx, 'HI ' + U.pad(Math.max(R.hud.hi, R.score), 5), 264, 5, { size: 8, color: '#8fa3c8', align: 'right' });
    D.text(ctx, 'LV' + lvl, 8, 20, { size: 8, color: C.lime });
    D.text(ctx, 'CPU ' + cfgFor(lvl).name, 136, 5, { size: 8, color: C.cyan, align: 'center' });
    var msg = phase === 'player' ? 'YOUR TURN' : phase === 'cpu' ? 'CPU THINKS' : phase === 'win' ? 'YOU WIN!' : phase === 'lost' ? 'CPU WINS' : phase === 'draw' ? 'DRAW' : turn === 1 ? 'YOUR TURN' : 'CPU THINKS';
    var mc = (phase === 'win') ? C.lime : (phase === 'lost') ? C.red : turn === 1 && phase !== 'cpu' ? RED : YEL;
    D.text(ctx, msg, 264, 20, { size: 8, color: mc, align: 'right' });
  }

  R.game({
    layout: 'full', size: [272, 328], bg: '#0b0e26', music: 'retro',

    reset: function () {
      clock = 0; lvl = 1;
      newRound();
    },

    update: function (dt) {
      clock += dt;
      var c;
      hoverX += ((phase === 'cpu' ? cellX(cpuCol) : cellX(col)) - hoverX) * Math.min(1, dt * (phase === 'cpu' ? 9 : 26));
      var left = R.input.rep('left', 170, 80), right = R.input.rep('right', 170, 80);

      if (phase === 'player') {
        if (left) { col = nextFreeCol(col, -1); R.sfx.play('move'); }
        if (right) { col = nextFreeCol(col, 1); R.sfx.play('move'); }
        if (R.input.pressed('a')) {
          if (full(col)) R.sfx.tone(130, 0.06, { vol: 0.08, type: 'triangle' });
          else startDrop(col, 1);
        }
      } else if (phase === 'drop') {
        var tgt = cellY(drop.r);
        drop.vy += 1500 * dt; drop.y += drop.vy * dt;
        if (drop.y >= tgt) {
          drop.y = tgt;
          if (!drop.bounced && drop.vy > 220) { drop.vy = -drop.vy * 0.28; drop.bounced = true; R.sfx.tone(180, 0.04, { vol: 0.06, type: 'triangle' }); }
          else landed();
        }
      } else if (phase === 'cpu') {
        phaseT -= dt;
        if (phaseT <= 0) { col = cpuCol; startDrop(cpuCol, 2); }
      } else if (phase === 'win') {
        phaseT -= dt;
        if (Math.random() < dt * 7) R.fx.burst(U.rand(20, 250), U.rand(60, 290), { n: 8, color: [C.yellow, C.pink, C.lime, C.cyan], speed: 80, life: 0.7, size: 2, gravity: 60 });
        if (phaseT <= 0) { lvl++; R.sfx.play('powerup'); newRound(); R.fx.text(136, 70, 'LEVEL ' + lvl + ' - CPU ' + cfgFor(lvl).name, C.lime); }
      } else if (phase === 'draw') {
        phaseT -= dt;
        if (phaseT <= 0) { newRound(); }
      } else if (phase === 'lost') {
        phaseT -= dt;
        if (phaseT <= 0) { phase = 'over'; R.gameOver(); }
      }
    },

    render: function (ctx, W, H) {
      renderHud(ctx);
      var c, r, i;
      // column highlight (seen through the empty holes)
      if (phase === 'player' || phase === 'cpu') {
        var hc = phase === 'cpu' ? cpuCol : col;
        ctx.fillStyle = phase === 'cpu' ? 'rgba(255,210,58,.16)' : 'rgba(255,255,255,.14)';
        ctx.fillRect(BX + hc * CELL, BY, CELL, NR * CELL);
      }
      // settled discs
      var winSet = {};
      if (winLine) winLine.cells.forEach(function (cl) { winSet[cl[0] * 10 + cl[1]] = true; });
      for (c = 0; c < NC; c++) for (r = 0; r < cols[c].length; r++) {
        if (drop && drop.c === c && drop.r === r) continue;
        drawDisc(ctx, cellX(c), cellY(r), cols[c][r], null, false);
      }
      if (drop) drawDisc(ctx, cellX(drop.c), drop.y, drop.p, null, false);
      drawBoardPanel(ctx);
      // winning line highlight (on top of the panel)
      if (winLine) {
        var blink = Math.floor(clock * 6) % 2;
        var a = winLine.cells[0], b = winLine.cells[winLine.cells.length - 1];
        ctx.globalAlpha = 0.5; D.line(ctx, cellX(a[0]), cellY(a[1]), cellX(b[0]), cellY(b[1]), '#fff', 5); ctx.globalAlpha = 1;
        winLine.cells.forEach(function (cl) {
          ctx.strokeStyle = blink ? '#fff' : (winLine.p === 1 ? '#ffe0e6' : '#fff6c0'); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cellX(cl[0]), cellY(cl[1]), DISC + 1, 0, Math.PI * 2); ctx.stroke();
        });
      }
      // hovering disc + pointer
      if (phase === 'player' || phase === 'cpu') {
        var who = phase === 'cpu' ? 2 : 1, bob = Math.sin(clock * 6) * 2;
        drawDisc(ctx, hoverX, HOVER_Y + bob, who, 0.95, false);
        ctx.fillStyle = who === 1 ? '#fff' : YEL;
        ctx.beginPath(); ctx.moveTo(hoverX, 54 - 6 + bob * 0.5); ctx.lineTo(hoverX - 5, 54 - 12 + bob * 0.5); ctx.lineTo(hoverX + 5, 54 - 12 + bob * 0.5); ctx.closePath(); ctx.fill();
      }
      D.text(ctx, 'LEFT/RIGHT COLUMN   A DROP', 136, 312, { size: 6, color: '#5d6d99', align: 'center' });
      if (phase === 'win') {
        D.rect(ctx, 24, 126, 224, 70, 'rgba(6,10,28,.88)'); D.frame(ctx, 24, 126, 224, 70, C.lime, 2);
        D.text(ctx, 'YOU WIN!', 136, 136, { size: 16, color: C.lime, align: 'center', shadow: '#000' });
        D.text(ctx, '+' + winInfo.pts + ' IN ' + winInfo.moves + ' MOVES', 136, 162, { size: 8, color: C.white, align: 'center' });
        D.text(ctx, 'NEXT: CPU ' + cfgFor(lvl + 1).name, 136, 176, { size: 6, color: '#8fa3c8', align: 'center' });
      } else if (phase === 'draw') {
        D.rect(ctx, 24, 126, 224, 46, 'rgba(6,10,28,.88)'); D.frame(ctx, 24, 126, 224, 46, C.cyan, 2);
        D.text(ctx, 'DRAW!', 136, 136, { size: 16, color: C.cyan, align: 'center', shadow: '#000' });
        D.text(ctx, 'REPLAY THIS LEVEL', 136, 158, { size: 6, color: '#8fa3c8', align: 'center' });
      } else if (phase === 'lost' || phase === 'over') {
        D.rect(ctx, 24, 126, 224, 46, 'rgba(24,6,12,.9)'); D.frame(ctx, 24, 126, 224, 46, C.red, 2);
        D.text(ctx, 'CPU WINS', 136, 136, { size: 16, color: C.red, align: 'center', shadow: '#000' });
      }
    },

    serialize: function () {
      if (phase === 'win') return { lvl: lvl + 1, cols: [], turn: 1 };            // the win has already been scored
      if (phase === 'draw') return { lvl: lvl, cols: [], turn: 1 };
      var cs = cols.map(function (a) { return a.join(''); });
      if (phase === 'drop' && drop) { cs[drop.c] = cs[drop.c].slice(0, -1); return { lvl: lvl, cols: cs, turn: drop.p, col: col }; }   // an in-flight disc is taken back
      return { lvl: lvl, cols: cs, turn: turn, col: col, lost: phase === 'lost' || phase === 'over' };
    },
    restore: function (s) {
      lvl = Math.max(1, s.lvl | 0 || 1);
      newRound();
      if (!s.cols || !s.cols.length) return;
      cols = []; humanMoves = 0;
      for (var c = 0; c < NC; c++) { var str = String(s.cols[c] || ''); cols.push(str.split('').map(Number).filter(function (v) { return v === 1 || v === 2; }).slice(0, NR)); cols[c].forEach(function (v) { if (v === 1) humanMoves++; }); }
      col = U.clamp(s.col | 0, 0, NC - 1); hoverX = cellX(col);
      turn = s.turn === 2 ? 2 : 1;
      var line = findLine();
      if (line && s.lost) { winLine = line; phase = 'lost'; phaseT = 0.8; return; }
      if (line || boardFull()) { newRound(); return; }
      if (turn === 2) thinkCpu(); else phase = 'player';
    }
  });
})();
