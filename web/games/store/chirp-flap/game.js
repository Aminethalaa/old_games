/* Chirp Flap — flap through the colourful towers, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164, GROUND = 142, TOP = 13;              // view size, ground surface y, lowest y a gate gap may touch
  var BX = 34;                                                // bird screen x
  var GRAV = 600, FLAP = -145, MAXFALL = 220;
  var PW = 22, CAPH = 8, CAPX = 2;                           // tower body width, cap height, cap overhang
  var SPACING = 76;                                           // px between gate left edges
  var HALF_W = 4, HALF_H = 3.6;                               // bird hit-box half sizes (forgiving)
  var TOWER = ['#ff5d8f', '#35d6ff', '#7be04a', '#ffb23f', '#a875ff', '#ff6b4a'];

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }

  /* ------------------------------------------------------------------ sprites */
  function outline(lines) {
    var h = lines.length, w = lines[0].length, y, x, out = [];
    function at(x, y) { return (y < 0 || y >= h || x < 0 || x >= w) ? '.' : lines[y].charAt(x); }
    for (y = -1; y <= h; y++) {
      var r = '';
      for (x = -1; x <= w; x++) {
        var c = at(x, y);
        if (c === '.') c = (at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.') ? 'o' : '.';
        r += c;
      }
      out.push(r);
    }
    return out;
  }
  var CHICK_PAL = { o: '#5a2a0a', '#': '#ffd23f', B: '#fff4b0', y: '#ff9f1c', O: '#ff6a00', W: '#ffffff', K: '#1d2b53', P: '#ff77a8', d: '#e0a800' };
  function chickRows(frame) {
    var w = 17, h = 13, g = [], x, y;
    for (y = 0; y < h; y++) { var row = []; for (x = 0; x < w; x++) row.push('.'); g.push(row); }
    function put(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var dx = (x - 8) / 7, dy = (y - 6.5) / 5.9;
      if (dx * dx + dy * dy <= 1) put(x, y, y >= 9 && x >= 6 ? 'B' : (y >= 10 ? 'd' : '#'));
    }
    [[1, 5], [2, 4], [2, 5], [0, 6], [1, 6], [2, 6], [1, 4]].forEach(function (p) { put(p[0], p[1], 'y'); });       // tail
    [[11, 3], [12, 3], [11, 4], [12, 4]].forEach(function (p) { put(p[0], p[1], 'W'); }); put(12, 4, 'K'); put(12, 3, 'K');
    put(12, 3, 'W'); put(11, 3, 'W');
    put(11, 7, 'P'); put(12, 7, 'P');
    [[14, 5], [15, 5], [16, 5], [14, 6], [15, 6]].forEach(function (p) { put(p[0], p[1], 'O'); });           // beak
    var wing = frame === 0 ? [[5, 2], [6, 2], [7, 2], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [4, 4], [5, 4], [6, 4], [7, 4], [5, 5], [6, 5]]
      : frame === 1 ? [[4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [5, 7], [6, 7], [7, 7]]
        : [[4, 7], [5, 7], [6, 7], [7, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [5, 9], [6, 9], [7, 9], [5, 10], [6, 10]];
    wing.forEach(function (p) { put(p[0], p[1], 'y'); });
    return outline(g.map(function (r) { return r.join(''); }));
  }
  var S = {};
  function buildSprites() {
    S.chick = [0, 1, 2].map(function (f) { return R.sprite(chickRows(f), CHICK_PAL); });
  }

  /* ------------------------------------------------------------ sky & scenery */
  var KF = [
    { g: 0, a: '#5ec8ff', b: '#e2f6ff', far: '#9cc3ee', mid: '#7fb0e0', cloud: '#ffffff', d: 1 },
    { g: 10, a: '#5ec8ff', b: '#e2f6ff', far: '#9cc3ee', mid: '#7fb0e0', cloud: '#ffffff', d: 1 },
    { g: 18, a: '#8f8cff', b: '#ffd0f0', far: '#b49be0', mid: '#9a7fcf', cloud: '#ffeaf8', d: 0.8 },
    { g: 28, a: '#ff9d6b', b: '#ffe7a3', far: '#e39a8c', mid: '#c97c7a', cloud: '#fff0d6', d: 0.7 },
    { g: 40, a: '#141a55', b: '#5a4aa0', far: '#2a2f78', mid: '#202665', cloud: '#5b5aa8', d: 0 },
    { g: 52, a: '#141a55', b: '#5a4aa0', far: '#2a2f78', mid: '#202665', cloud: '#5b5aa8', d: 0 },
    { g: 62, a: '#5ec8ff', b: '#e2f6ff', far: '#9cc3ee', mid: '#7fb0e0', cloud: '#ffffff', d: 1 }
  ];
  KF.forEach(function (k) { ['a', 'b', 'far', 'mid', 'cloud'].forEach(function (key) { k[key] = hex(k[key]); }); });
  var SKY = {};
  function setSky(gv) {
    gv = gv % 62;
    var i = 0; while (i < KF.length - 2 && gv > KF[i + 1].g) i++;
    var a = KF[i], b = KF[i + 1], t = U.clamp((gv - a.g) / (b.g - a.g), 0, 1);
    SKY.d = U.lerp(a.d, b.d, t);
    var ta = mix(a.a, b.a, t), tb = mix(a.b, b.b, t);
    SKY.bands = [];
    for (var s = 0; s < 14; s++) SKY.bands.push(rgb(mix(ta, tb, Math.pow(s / 13, 1.2))));
    SKY.far = rgb(mix(a.far, b.far, t)); SKY.mid = rgb(mix(a.mid, b.mid, t)); SKY.cloud = rgb(mix(a.cloud, b.cloud, t));
    SKY.win = SKY.d < 0.5 ? '#ffe27a' : null;
    SKY.farLite = rgb(mix(mix(a.far, [255, 255, 255], 0.25), mix(b.far, [255, 255, 255], 0.25), t));
  }
  var CLOUD_BIG = [[3, 9], [1, 13], [0, 17], [0, 20], [2, 21], [4, 22]];
  var CLOUD_SM = [[2, 6], [0, 9], [0, 12], [1, 13]];

  /* -------------------------------------------------------------------- state */
  var spawned, bird, gates, coins, scroll, speed, started, dead, deadT, gatesPassed, runCoins, nextGate, clouds, stars, pulse, t, hintT, flapAnim, medalName;
  var bestMedal;

  function gapFor(g) { return U.clamp(Math.round(U.lerp(56, 40, Math.min(1, g / 60)) + U.rand(-4, 5)), 38, 60); }
  function addGate(x) {
    var g = spawned++, gap = gapFor(g), lo = TOP + 8 + gap / 2, hi = GROUND - 8 - gap / 2, cy;
    var prev = gates.length ? gates[gates.length - 1].cy : (lo + hi) / 2;
    cy = U.clamp(prev + U.rand(-40, 52), lo, hi);
    if (g === 0) cy = U.clamp((lo + hi) / 2 + U.rand(-10, 10), lo, hi);
    var gate = { x: x, cy: cy, gap: gap, col: TOWER[(g) % TOWER.length], passed: false, coin: null };
    if (g > 0 && Math.random() < 0.5) {
      var r = gap / 2 - 10;
      gate.coin = { x: x + PW / 2, y: cy + U.rand(-r, r), got: false };
    }
    gates.push(gate);
  }

  function medalFor(s) { return s >= 100 ? 'PLATINUM' : s >= 50 ? 'GOLD' : s >= 25 ? 'SILVER' : s >= 10 ? 'BRONZE' : null; }
  function addPoints(n) {
    var before = R.score; R.addScore(n); var s = R.score; pulse = 0.16;
    var m = [[10, 'bronze-medal', 'BRONZE'], [25, 'silver-medal', 'SILVER'], [50, 'gold-medal', 'GOLD'], [100, null, 'PLATINUM']];
    for (var i = 0; i < m.length; i++) if (before < m[i][0] && s >= m[i][0]) {
      R.sfx.play('powerup'); R.fx.flash('#ffec27', 0.18); R.vibrate(25);
      if (!(m[i][1] && R.achieve(m[i][1]))) R.toast('★ ' + m[i][2] + ' MEDAL!', 1600);
    }
    R.level = 1 + Math.floor(s / 10);
  }

  function flap() {
    if (!started) { started = true; hintT = 0; }
    bird.vy = FLAP; flapAnim = 0.22;
    R.sfx.tone(700, 0.08, { type: 'square', vol: 0.06, slide: 1250 });
    R.fx.burst(BX - 4, bird.y + 3, { n: 3, color: ['#fff4b0', '#ffffff'], speed: 26, life: 0.4, size: 1, gravity: 50 });
  }
  function die(hitGround) {
    dead = true; deadT = hitGround ? 0.55 : 1.05;
    R.sfx.play('hit'); R.vibrate(80); R.fx.shake(3, 0.28);
    R.fx.burst(BX, bird.y, { n: 18, color: ['#ffd23f', '#fff4b0', '#ff9f1c', '#ffffff'], speed: 80, life: 0.7, gravity: 160, size: 2 });
    medalName = medalFor(R.score);
    if (!hitGround) bird.vy = Math.min(bird.vy, -60);
  }

  R.game({
    layout: 'full', size: [W, H], bg: '#5ec8ff', music: 'chill',

    _dbg: function () { return { dead: dead, bird: bird, gates: gates, speed: speed, K: { BX: BX, PW: PW, CAPX: CAPX, HALF_W: HALF_W, HALF_H: HALF_H, GROUND: GROUND, GRAV: GRAV, FLAP: FLAP, MAXFALL: MAXFALL }, warp: function (n) { gatesPassed = n; scroll = n * SPACING; R.score = n; } }; }, /*DBG*/
    init: function () { buildSprites(); },

    reset: function () {
      bird = { y: 76, vy: 0 }; gates = []; coins = 0; scroll = 0; speed = 54; started = false; dead = false; deadT = 0;
      gatesPassed = 0; spawned = 0; runCoins = 0; pulse = 0; t = 0; hintT = 0; flapAnim = 0; medalName = null;
      clouds = []; for (var i = 0; i < 4; i++) clouds.push({ x: i * 40 + U.rand(0, 20), y: U.rand(18, 64), big: Math.random() < 0.5, v: U.rand(3, 8) });
      stars = []; for (i = 0; i < 28; i++) stars.push({ x: U.rand(0, W), y: U.rand(14, 100), ph: U.rand(0, 6.28) });
      setSky(0);
      addGate(W + 24);
      R.level = 1; R.lives = null; R.score = 0;
    },

    update: function (dt) {
      var inp = R.input, i;
      t += dt; if (pulse > 0) pulse -= dt; if (flapAnim > 0) flapAnim -= dt;
      if (dead) {
        bird.vy = Math.min(MAXFALL * 1.6, bird.vy + GRAV * 1.2 * dt); bird.y += bird.vy * dt;
        if (bird.y > GROUND - 5) { bird.y = GROUND - 5; bird.vy = 0; }
        deadT -= dt; if (deadT <= 0) R.gameOver();
        return;
      }
      var wantFlap = inp.pressed('a') || inp.pressed('up') || inp.pressed('b');
      if (!started) {
        bird.y = 76 + Math.sin(t * 4) * 4; hintT += dt;
        if (wantFlap) { bird.y = 76; flap(); }
        else return;
      } else if (wantFlap) flap();

      speed = 54 + 28 * (1 - Math.exp(-gatesPassed / 22));
      scroll += speed * dt;
      bird.vy = Math.min(MAXFALL, bird.vy + GRAV * dt);
      bird.y += bird.vy * dt;
      if (bird.y < 7) { bird.y = 7; if (bird.vy < 0) bird.vy = 0; }

      /* gates */
      for (i = 0; i < gates.length; i++) gates[i].x -= speed * dt;
      var lastG = gates[gates.length - 1];
      if (lastG.x < W + 4 - SPACING + 8) addGate(lastG.x + SPACING + U.randInt(0, 9));
      while (gates.length && gates[0].x + PW + CAPX < -4) gates.shift();

      var bx0 = BX - HALF_W, bx1 = BX + HALF_W, by0 = bird.y - HALF_H, by1 = bird.y + HALF_H;
      for (i = 0; i < gates.length; i++) {
        var g = gates[i], top = g.cy - g.gap / 2, bot = g.cy + g.gap / 2;
        if (bx1 > g.x - CAPX && bx0 < g.x + PW + CAPX && (by0 < top || by1 > bot)) { die(false); return; }
        if (!g.passed && g.x + PW < BX - HALF_W) {
          g.passed = true; gatesPassed++; R.sfx.tone(784, 0.06, { vol: 0.09 }); R.sfx.tone(1175, 0.09, { vol: 0.09, delay: 0.06 });
          addPoints(1);
        }
        if (g.coin && !g.coin.got) {
          var cx = g.x + PW / 2 + 0, cy = g.coin.y;
          if (Math.abs(cx - BX) < HALF_W + 4 && Math.abs(cy - bird.y) < HALF_H + 5) {
            g.coin.got = true; runCoins++; R.sfx.play('coin'); R.vibrate(12);
            R.fx.burst(cx, cy, { n: 10, color: ['#ffec27', '#ffffff', '#ffa300'], speed: 55, life: 0.45, size: 1, gravity: 20 });
            R.fx.text(cx, cy - 8, '+2', C.yellow);
            addPoints(2);
            if (runCoins >= 8) R.achieve('coin-hoarder');
          }
        }
      }
      if (by1 >= GROUND) { bird.y = GROUND - HALF_H; die(true); return; }

      /* scenery */
      setSky(scroll / SPACING);
      for (i = 0; i < clouds.length; i++) {
        var c = clouds[i]; c.x -= (speed * 0.08 + c.v) * dt;
        if (c.x < -26) { c.x = W + U.rand(4, 40); c.y = U.rand(18, 64); c.big = Math.random() < 0.5; c.v = U.rand(3, 8); }
      }
    },

    render: function (ctx, w, h) {
      var i, x, y;
      for (i = 0; i < SKY.bands.length; i++) { ctx.fillStyle = SKY.bands[i]; ctx.fillRect(0, i * 11, w, 12); }
      if (SKY.d < 0.5) {
        var na = U.clamp((0.5 - SKY.d) * 2, 0, 1);
        for (i = 0; i < stars.length; i++) { ctx.globalAlpha = na * (0.55 + 0.45 * Math.sin(t * 2.3 + stars[i].ph)); ctx.fillStyle = '#fff1e8'; ctx.fillRect(Math.floor(stars[i].x), Math.floor(stars[i].y), 1, 1); }
        ctx.globalAlpha = 1;
      }
      for (i = 0; i < clouds.length; i++) drawCloud(ctx, clouds[i]);
      drawFar(ctx, w); drawMid(ctx, w);
      for (i = 0; i < gates.length; i++) drawGate(ctx, gates[i]);
      drawGround(ctx, w, h);
      drawBird(ctx);
      R.draw.topBar(ctx);
      /* big score */
      if (started || R.mode !== 'ready') {
        var sz = pulse > 0 ? 24 : 16;
        R.draw.text(ctx, String(R.score), w / 2, pulse > 0 ? 17 : 19, { size: sz, color: '#ffffff', align: 'center', shadow: '#1d2b53' });
      }
      if (!started && R.mode === 'play' && Math.floor(hintT * 2.5) % 2 === 0) R.draw.text(ctx, 'PRESS A', w / 2, 100, { size: 8, color: '#ffffff', align: 'center', shadow: '#1d2b53' });
      if (dead && medalName && deadT < 0.5) drawMedal(ctx, w / 2, 122, medalName);
    }
  });

  /* ------------------------------------------------------------------ drawing */
  function drawCloud(ctx, c) {
    var spans = c.big ? CLOUD_BIG : CLOUD_SM, x = Math.round(c.x), y = Math.round(c.y), i;
    ctx.fillStyle = SKY.cloud;
    for (i = 0; i < spans.length; i++) ctx.fillRect(x + spans[i][0], y + i, spans[i][1] - spans[i][0] + 1, 1);
  }
  function zoneCity(layer, zi) { return hash(zi * 17 + layer * 101 + 3) < 0.5; }
  function drawFar(ctx, w) {
    var off = Math.floor(scroll * 0.1), x, base = GROUND - 14;
    var b0 = Math.floor(off / 16);
    for (var b = b0 - 1; b < b0 + Math.ceil(w / 16) + 2; b++) {
      var bx = b * 16 - off, zi = Math.floor(b / 12), hh = hash(b * 3 + 1);
      if (zoneCity(0, zi)) {
        var bh = 22 + Math.floor(hh * 44), bw = 12 + Math.floor(hash(b * 5 + 2) * 4);
        ctx.fillStyle = SKY.far; ctx.fillRect(bx, base - bh, bw, bh + 14);
        if (hh > 0.7) ctx.fillRect(bx + (bw >> 1), base - bh - 7, 1, 7);
        ctx.fillStyle = SKY.farLite;
        for (var wy = base - bh + 3; wy < base - 4; wy += 5) for (var wx = bx + 2; wx < bx + bw - 2; wx += 4) if (hash(wx * 7 + wy * 13 + b) > 0.45) ctx.fillRect(wx, wy, 2, 2);
      } else {
        var th = 20 + Math.floor(hh * 20), cx = bx + 8;
        ctx.fillStyle = SKY.far;
        for (var ty = 0; ty < th; ty += 2) { var half = Math.floor(ty * 0.3) + 1; ctx.fillRect(cx - half, base - th + ty, half * 2, 2); }
        ctx.fillRect(cx - 1, base - 2, 3, 16);
      }
    }
  }
  function drawMid(ctx, w) {
    var off = Math.floor(scroll * 0.28), base = GROUND;
    var b0 = Math.floor(off / 14);
    for (var b = b0 - 1; b < b0 + Math.ceil(w / 14) + 2; b++) {
      var bx = b * 14 - off, zi = Math.floor(b / 9), hh = hash(b * 11 + 7);
      ctx.fillStyle = SKY.mid;
      if (zoneCity(1, zi)) {
        var bh = 12 + Math.floor(hh * 22), bw = 12;
        ctx.fillRect(bx, base - bh, bw, bh);
        ctx.fillStyle = SKY.farLite;
        for (var wy = base - bh + 3; wy < base - 4; wy += 5) for (var wx = bx + 2; wx < bx + bw - 2; wx += 4) if (hash(wx * 3 + wy * 19 + b) > 0.5) ctx.fillRect(wx, wy, 2, 2);
      } else {
        var r = 6 + Math.floor(hh * 4), cx = bx + 7, cy = base - 12 - Math.floor(hh * 6);
        ctx.fillRect(cx - 1, cy, 3, base - cy);
        for (var yy = -r; yy <= r; yy++) { var half = Math.floor(Math.sqrt(r * r + 0.5 - yy * yy)); ctx.fillRect(cx - half, cy + yy, half * 2 + 1, 1); }
      }
    }
  }
  function drawGround(ctx, w, h) {
    ctx.fillStyle = '#7be04a'; ctx.fillRect(0, GROUND, w, 4);
    ctx.fillStyle = '#b8f56a'; ctx.fillRect(0, GROUND, w, 1);
    ctx.fillStyle = '#3fae3a'; ctx.fillRect(0, GROUND + 4, w, 2);
    ctx.fillStyle = '#e8cf8a'; ctx.fillRect(0, GROUND + 6, w, h - GROUND - 6);
    ctx.fillStyle = '#d3b56a';
    var off = Math.floor(scroll) % 12;
    for (var x = -12; x < w + 12; x += 12) {
      for (var yy = 0; yy < h - GROUND - 6; yy += 4) ctx.fillRect(x - off + (yy % 8 === 0 ? 0 : 6), GROUND + 6 + yy, 4, 2);
    }
  }
  function drawGate(ctx, g) {
    var x = Math.round(g.x), top = Math.round(g.cy - g.gap / 2), bot = Math.round(g.cy + g.gap / 2);
    tower(ctx, x, 0, top, g.col, true);
    tower(ctx, x, bot, GROUND, g.col, false);
    if (g.coin && !g.coin.got) drawCoin(ctx, x + PW / 2, Math.round(g.coin.y));
  }
  function tower(ctx, x, y0, y1, col, capBottom) {
    var hi = shade(col, 0.4), lo = shade(col, -0.35), dk = shade(col, -0.55), i;
    if (y1 <= y0) return;
    // body
    ctx.fillStyle = col; ctx.fillRect(x, y0, PW, y1 - y0);
    ctx.fillStyle = hi; ctx.fillRect(x + 2, y0, 3, y1 - y0);
    ctx.fillStyle = lo; ctx.fillRect(x + PW - 5, y0, 5, y1 - y0);
    ctx.fillStyle = dk; ctx.fillRect(x, y0, 1, y1 - y0); ctx.fillRect(x + PW - 1, y0, 1, y1 - y0);
    // brick lines + window slits, anchored to the cap so they scroll cleanly with the gate
    for (i = 0; ; i++) {
      var ly = capBottom ? y1 - CAPH - 6 - i * 12 : y0 + CAPH + 6 + i * 12;
      if (capBottom ? ly < y0 + 1 : ly > y1 - 2) break;
      ctx.fillStyle = lo; ctx.fillRect(x + 1, ly, PW - 2, 1);
      var wy = capBottom ? ly - 9 : ly + 3;
      if (capBottom ? wy > y0 : wy + 5 < y1) { ctx.fillStyle = dk; ctx.fillRect(x + 9, wy, 4, 6); ctx.fillStyle = '#ffe9a0'; ctx.fillRect(x + 10, wy + 1, 2, 4); }
    }
    // cap
    var cy = capBottom ? y1 - CAPH : y0;
    ctx.fillStyle = dk; ctx.fillRect(x - CAPX - 1, cy - 1, PW + CAPX * 2 + 2, CAPH + 2);
    ctx.fillStyle = col; ctx.fillRect(x - CAPX, cy, PW + CAPX * 2, CAPH);
    ctx.fillStyle = hi; ctx.fillRect(x - CAPX, cy, PW + CAPX * 2, 2); ctx.fillRect(x - CAPX + 2, cy, 3, CAPH);
    ctx.fillStyle = lo; ctx.fillRect(x - CAPX, cy + CAPH - 2, PW + CAPX * 2, 2); ctx.fillRect(x + PW + CAPX - 5, cy, 5, CAPH);
  }
  function drawCoin(ctx, x, y) {
    var ph = Math.floor(t * 8) % 4, wv = [5, 3, 1, 3][ph];
    ctx.fillStyle = '#a85a00'; ctx.fillRect(x - wv - 1, y - 6, wv * 2 + 2, 12);
    ctx.fillStyle = '#ffec27'; ctx.fillRect(x - wv, y - 5, wv * 2, 10);
    ctx.fillStyle = '#ffa300'; ctx.fillRect(x + (wv > 1 ? wv - 2 : 0), y - 5, wv > 1 ? 2 : 1, 10);
    if (wv > 2) { ctx.fillStyle = '#fff6a8'; ctx.fillRect(x - wv + 1, y - 4, 1, 4); ctx.fillStyle = '#ffa300'; ctx.fillRect(x - 1, y - 2, 2, 4); }
  }
  function drawBird(ctx) {
    var fi = dead ? 2 : flapAnim > 0 ? [2, 1, 0][Math.min(2, Math.floor((0.22 - flapAnim) / 0.0734))] : (bird.vy > 40 ? 0 : 1);
    var spr = S.chick[fi];
    var ang = dead ? Math.min(1.4, bird.vy / 160 + 0.9) : U.clamp(bird.vy / 260, -0.5, 1.0);
    if (!started) ang = Math.sin(t * 4) * 0.1;
    ctx.save();
    ctx.translate(Math.round(BX), Math.round(bird.y));
    ctx.rotate(ang);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, -Math.floor(spr.width / 2) - 1, -Math.floor(spr.height / 2));
    ctx.restore();
  }
  function drawMedal(ctx, x, y, name) {
    var cols = { BRONZE: ['#c9772b', '#f0a860', '#7a4210'], SILVER: ['#c2c3c7', '#f4f4f8', '#7c7d85'], GOLD: ['#ffcc1a', '#fff29a', '#b07a00'], PLATINUM: ['#7fe8ff', '#e8fbff', '#2a9bc0'] }[name];
    ctx.fillStyle = 'rgba(16,19,28,0.62)'; ctx.fillRect(x - 24, y - 17, 48, 37); R.draw.frame(ctx, x - 24, y - 17, 48, 37, cols[0], 1);
    ctx.fillStyle = '#ff4d6d'; ctx.fillRect(x - 6, y - 14, 4, 10); ctx.fillStyle = '#3da9fc'; ctx.fillRect(x + 2, y - 14, 4, 10);
    for (var yy = -8; yy <= 8; yy++) { var half = Math.floor(Math.sqrt(64.5 - yy * yy)); ctx.fillStyle = yy < -4 ? cols[1] : yy > 4 ? cols[2] : cols[0]; ctx.fillRect(x - half, y + yy, half * 2 + 1, 1); }
    ctx.fillStyle = cols[1]; ctx.fillRect(x - 1, y - 4, 3, 8); ctx.fillRect(x - 3, y - 2, 7, 2);
    R.draw.text(ctx, name, x, y + 11, { size: 6, color: cols[1], align: 'center', shadow: '#1d2b53' });
  }
})();
