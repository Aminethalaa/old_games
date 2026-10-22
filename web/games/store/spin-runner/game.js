/* Spin Runner — fast momentum platformer (slopes, loops, charge-roll), built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 204, H = 246, STEP = 2, INF = 1e9;
  var BALL = 7, LR = 30;                                   // Orb radius, loop radius
  var G = 700, SG = 560, RUN_ACC = 280, RUN_MAX = 125, ROLL_ACC = 150, ROLL_MAX = 210, TOP = 330;
  var TURN_DEC = 620, FRIC = 220, ROLL_FRIC = 45, ROLL_DEC = 150, AIR_ACC = 230, JUMP_V = 235, LOOP_MIN = 150, BOOST_V = 265;

  /* ------------------------------------------------------------------ helpers */
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function sgn(v) { return v < 0 ? -1 : 1; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function fr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function gradBands(g, w, y0, y1, stops, band) {
    for (var y = y0; y < y1; y += band) {
      var f = (y - y0) / (y1 - y0) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f));
      fr(g, 0, y, w, band, rgb(mix(hex(stops[i]), hex(stops[i + 1]), f - i)));
    }
  }
  function disc(g, cx, cy, r, col) {
    g.fillStyle = col;
    for (var y = Math.ceil(cy - r); y <= Math.floor(cy + r); y++) {
      var d = (y + 0.5 - cy) / r; if (d * d >= 1) continue;
      var w = r * Math.sqrt(1 - d * d); g.fillRect(Math.round(cx - w), y, Math.round(cx + w) - Math.round(cx - w), 1);
    }
  }

  /* ------------------------------------------------------------------ sprites */
  var ORB = { run: [], spin: [] }, SPR = {};
  function orbRows(a, mode) {
    var rows = [], x, y;
    for (y = 0; y < 16; y++) {
      var s = '';
      for (x = 0; x < 16; x++) {
        var dx = x + 0.5 - 8, dy = y + 0.5 - 8, r = Math.sqrt(dx * dx + dy * dy), ch = '.';
        if (r <= 7.7) {
          if (r > 6.6) ch = 'o';
          else {
            var lit = (-dx - dy) / (r + 0.001), ang = Math.atan2(dy, dx);
            ch = lit > 0.6 ? 'h' : lit < -0.4 ? 'd' : 'c';
            if (mode === 'spin') { if (r > 1.5 && Math.sin(4 * (ang - a)) > 0.35) ch = 'w'; else if (r <= 1.5) ch = 'k'; }
            else if (r > 2.4 && Math.sin(3 * (ang - a)) > 0.7) ch = 'y';
          }
        }
        s += ch;
      }
      rows.push(s);
    }
    return rows;
  }
  function gridRows(w, h, fn) { var g = [], x, y; for (y = 0; y < h; y++) { var r = []; for (x = 0; x < w; x++) r.push('.'); g.push(r); } fn(g); return g.map(function (r) { return r.join(''); }); }
  function put(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
  function ellG(g, cx, cy, rx, ry, c) { for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { var dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1) put(g, x, y, c); } }

  var FLY_PAL = [
    { o: '#2a1a08', s: '#ffd23a', Y: '#2a1a08', k: '#2a1a08', e: '#ffffff', w: '#e8f8ff', y: '#ff8a1e', l: '#2a1a08', S: '#fff29a', d: '#2a1a08' },
    { o: '#10082a', s: '#8a5ae8', Y: '#2a1060', k: '#10082a', e: '#7cffea', w: '#c8a0ff', y: '#c86aff', l: '#10082a', S: '#c8a8ff', d: '#10082a' },
    { o: '#2a0a10', s: '#e8503c', Y: '#2a0a10', k: '#2a0a10', e: '#ffe14a', w: '#ffd0a0', y: '#ffb020', l: '#2a0a10', S: '#ff9a8a', d: '#2a0a10' }
  ];
  var ENEMY_PAL = [
    { o: '#2a0a14', s: '#e8343c', S: '#ff8a8a', d: '#2a0a14', k: '#2a0a14', e: '#ffffff', l: '#2a0a14', w: '#d8f4ff', y: '#ffd23a', Y: '#2a1a08' },
    { o: '#10082a', s: '#5a6ae8', S: '#a8b4ff', d: '#10082a', k: '#10082a', e: '#7cffea', l: '#10082a', w: '#c8a0ff', y: '#c86aff', Y: '#10082a' },
    { o: '#1a1208', s: '#9aa4b8', S: '#d8e0f0', d: '#4a5068', k: '#2a2f40', e: '#ff3d3d', l: '#2a2f40', w: '#ffb060', y: '#ff8a1e', Y: '#2a1a08' }
  ];
  function bugRows(frame) {
    return gridRows(14, 10, function (g) {
      ellG(g, 6, 5, 6.2, 4.6, 'o'); ellG(g, 6, 5, 5.2, 3.7, 's');
      ellG(g, 4, 3, 2.2, 1.3, 'S'); put(g, 4, 5, 'd'); put(g, 5, 5, 'd'); put(g, 4, 6, 'd'); put(g, 8, 4, 'd'); put(g, 9, 4, 'd'); put(g, 9, 5, 'd');
      ellG(g, 11.5, 5.5, 2.4, 2.4, 'o'); ellG(g, 11.5, 5.5, 1.6, 1.6, 'k'); put(g, 12, 5, 'e'); put(g, 12, 4, 'e');
      put(g, 12, 2, 'o'); put(g, 13, 1, 'o'); put(g, 10, 2, 'o'); put(g, 10, 1, 'o');
      var lg = frame ? [2, 6, 10] : [3, 7, 9];
      for (var i = 0; i < 3; i++) { put(g, lg[i], 9, 'l'); put(g, lg[i] + (frame ? 1 : -1), 9, 'l'); put(g, lg[i], 8, 'l'); }
    });
  }
  function flyRows(frame) {
    return gridRows(16, 12, function (g) {
      ellG(g, 8, 7, 5.2, 3.6, 'o'); ellG(g, 8, 7, 4.3, 2.8, 's');
      for (var x = 5; x <= 10; x += 3) for (var y = 5; y <= 9; y++) if (g[y][x] === 's') g[y][x] = 'Y';
      put(g, 8, 6, 's'); ellG(g, 12.5, 7, 2.2, 2.2, 'o'); ellG(g, 12.5, 7, 1.4, 1.4, 'k'); put(g, 13, 6, 'e'); put(g, 13, 7, 'e');
      put(g, 2, 8, 'o'); put(g, 1, 9, 'o'); put(g, 3, 9, 'y');
      var wy = frame ? 4 : 2;
      ellG(g, 7, wy, 3.2, 1.8, 'o'); ellG(g, 7, wy, 2.4, 1.1, 'w'); ellG(g, 10, wy + 0.5, 2.4, 1.5, 'o'); ellG(g, 10, wy + 0.5, 1.6, 0.8, 'w');
      put(g, 6, 10, 'l'); put(g, 9, 10, 'l');
    });
  }
  function roverRows(frame) {   // factory walker: boxy bot on a wheel
    return gridRows(14, 11, function (g) {
      var x, y;
      for (y = 1; y <= 7; y++) for (x = 1; x <= 12; x++) put(g, x, y, (x === 1 || x === 12 || y === 1 || y === 7) ? 'o' : 's');
      for (x = 2; x <= 11; x++) put(g, x, 2, 'S');
      for (y = 3; y <= 5; y++) for (x = 7; x <= 11; x++) put(g, x, y, 'k');
      put(g, 9, 4, 'e'); put(g, 10, 4, 'e'); put(g, 3, 4, 'd'); put(g, 4, 4, 'd'); put(g, 3, 6, 'd');
      put(g, 6, 0, 'o'); put(g, 6, 1, 'y');
      ellG(g, 4, 8.5, 2.2, 2.2, 'o'); ellG(g, 10, 8.5, 2.2, 2.2, 'o'); ellG(g, 4, 8.5, 1.3, 1.3, frame ? 'S' : 'd'); ellG(g, 10, 8.5, 1.3, 1.3, frame ? 'd' : 'S');
    });
  }
  function hexRows() {
    return gridRows(11, 11, function (g) {
      for (var y = 0; y < 11; y++) for (var x = 0; x < 11; x++) {
        var dx = x + 0.5 - 5.5, dy = y + 0.5 - 5.5, ay = Math.abs(dy), ax = Math.abs(dx), lim = 5.4 - ay * 0.577;
        if (ay <= 4.8 && ax <= lim) put(g, x, y, (ax > lim - 1 || ay > 3.8) ? 'o' : dy < -1.3 ? 'h' : dx < 0 ? 'p' : 'P');
      }
      put(g, 4, 3, 'w'); put(g, 5, 3, 'w'); put(g, 3, 4, 'w');
      for (var y2 = 4; y2 < 8; y2++) put(g, 5, y2, g[y2][5] === 'P' || g[y2][5] === 'p' ? 'o' : g[y2][5]);
    });
  }
  function buildSprites() {
    var pal = { o: '#1a1838', h: '#ffffff', c: '#d4daf4', d: '#8e98cc', y: '#18c8b0', w: '#ffffff', k: '#14122a' }, i;
    for (i = 0; i < 12; i++) { ORB.run.push(R.sprite(orbRows(i * (Math.PI * 2 / 3) / 12, 'run'), pal)); ORB.spin.push(R.sprite(orbRows(i * (Math.PI / 2) / 12, 'spin'), pal)); }
    SPR.bug = ENEMY_PAL.map(function (p) { return [R.sprite(bugRows(0), p), R.sprite(bugRows(1), p)]; });
    SPR.fly = FLY_PAL.map(function (p) { return [R.sprite(flyRows(0), p), R.sprite(flyRows(1), p)]; });
    SPR.rover = [R.sprite(roverRows(0), ENEMY_PAL[2]), R.sprite(roverRows(1), ENEMY_PAL[2])];
    SPR.gems = THEMES.map(function (th) { return R.sprite(hexRows(), th.gem); });
    SPR.island = [islandSprite(0), islandSprite(1)];
    SPR.cog = [cogSprite(26, 12, '#3a2e22', '#6a5030', '#1a140e'), cogSprite(18, 10, '#6a4a28', '#b08a40', '#2e2010')];
    var ck = mkCanvas(64, 64), cg = ck.getContext('2d');
    ellP(cg, 32, 32, 30, 30, '#2a3a40'); ellP(cg, 32, 32, 28, 28, '#b08a40'); ellP(cg, 32, 32, 25, 25, '#162a32');
    for (i = 0; i < 12; i++) { var ta = i / 12 * Math.PI * 2; fr(cg, Math.round(32 + Math.sin(ta) * 21) - 1, Math.round(32 - Math.cos(ta) * 21) - 1, i % 3 ? 2 : 3, i % 3 ? 2 : 3, '#e0bc70'); }
    SPR.clock = ck;
  }

  /* -------------------------------------------------------------- level builder */
  function ghOf(arr, x) {
    var f = x / STEP, i = Math.floor(f);
    if (i < 0) return arr[0] >= INF ? INF : arr[0];
    if (i >= arr.length - 1) return arr[arr.length - 1] >= INF ? INF : arr[arr.length - 1];
    var a = arr[i], b = arr[i + 1];
    if (a >= INF || b >= INF) return INF;
    return a + (b - a) * (f - i);
  }
  function Level(theme) {
    this.h = []; this.x = 0; this.y = 200; this.sx = 0; this.theme = theme;
    this.sp = { gems: [], springs: [], pads: [], spikes: [], enemies: [], plats: [], loops: [], checks: [], crushers: [], convs: [], decor: [] };
  }
  Level.prototype = {
    seg: function (len, f) {
      var n = Math.round(len / STEP), y0 = this.y, i; this.sx = this.x;
      for (i = 0; i < n; i++) this.h.push(f(i / n, y0));
      this.y = f(1, y0); this.x += n * STEP; return this;
    },
    flat: function (len) { return this.seg(len, function (t, y0) { return y0; }); },
    ramp: function (len, dy) { return this.seg(len, function (t, y0) { return y0 + dy * (0.5 - 0.5 * Math.cos(Math.PI * t)); }); },
    hill: function (len, hh) { return this.seg(len, function (t, y0) { return y0 - hh * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)); }); },
    valley: function (len, d) { return this.seg(len, function (t, y0) { return y0 + d * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)); }); },
    gap: function (len) { var n = Math.round(len / STEP), i; this.sx = this.x; for (i = 0; i < n; i++) this.h.push(INF); this.x += n * STEP; return this; },
    gemRow: function (x, n, dx, h) { for (var i = 0; i < n; i++) this.sp.gems.push({ x: x + i * dx, h: h }); return this; },
    gemArc: function (x, w, n, h0, h1) { for (var i = 0; i < n; i++) { var t = n > 1 ? i / (n - 1) : 0; this.sp.gems.push({ x: x + w * t, h: h0 + (h1 - h0) * Math.sin(Math.PI * t) }); } return this; },
    gemAt: function (x, y) { this.sp.gems.push({ x: x, y: y }); return this; },
    spring: function (x, kind) { this.sp.springs.push({ x: x, kind: kind || 'g' }); return this; },
    pad: function (x, dir) { this.sp.pads.push({ x: x, dir: dir || 1, w: 24 }); return this; },
    spike: function (x, n) { this.sp.spikes.push({ x: x, n: n || 3 }); return this; },
    crawler: function (x, range) { this.sp.enemies.push({ kind: 'bug', x: x, range: range }); return this; },
    rover: function (x, range) { this.sp.enemies.push({ kind: 'rover', x: x, range: range }); return this; },
    flyer: function (x, up, range) { this.sp.enemies.push({ kind: 'fly', x: x, up: up, range: range }); return this; },
    plat: function (x0, x1, up) { this.sp.plats.push({ x0: x0, x1: x1, y: this.y - up }); return this; },
    springPlat: function (spx, up, kind) {
      var dx0 = kind === 'r' ? 62 : 36, dx1 = kind === 'r' ? 150 : 116, i;
      this.spring(spx, kind); this.plat(spx + dx0, spx + dx1, up);
      for (i = 0; i < 5; i++) this.gemAt(spx + dx0 + 8 + i * ((dx1 - dx0 - 16) / 4), this.y - up - 13);
      return this;
    },
    check: function (x) { this.sp.checks.push({ x: x }); return this; },
    crusher: function (x, ph, per) { this.sp.crushers.push({ x: x, ph: ph || 0, per: per || 2.4 }); return this; },
    conv: function (x0, x1, dir) { this.sp.convs.push({ x0: x0, x1: x1, dir: dir }); return this; },
    loop: function () {
      var len = LR * 2 + 70; this.flat(len);
      var cx = this.sx + len / 2, i;
      this.sp.loops.push({ cx: cx, y0: this.y });
      for (i = 1; i < 9; i++) { var ph = i * Math.PI / 4.5; this.gemAt(cx + (LR - BALL) * Math.sin(ph), this.y - LR + (LR - BALL) * Math.cos(ph)); }
      return this;
    },
    finish: function () { this.flat(120); var fx = this.sx + 60; this.finishX = fx; this.flat(320); return this; },
    done: function () {
      var me = this, arr = this.h, n = arr.length, i;
      var LV = { theme: this.theme, h: Float32Array.from(arr), n: n, w: n * STEP, finishX: this.finishX, spawnX: 50, topY: 1e9, maxY: -1e9 };
      for (i = 0; i < n; i++) if (arr[i] < INF) { LV.topY = Math.min(LV.topY, arr[i]); LV.maxY = Math.max(LV.maxY, arr[i]); }
      function near(x) {
        var g = ghOf(LV.h, x), k;
        if (g < INF) return g;
        for (k = 1; k < 200; k++) { g = ghOf(LV.h, x - k * 2); if (g < INF) return g; g = ghOf(LV.h, x + k * 2); if (g < INF) return g; }
        return me.y;
      }
      LV.near = near;
      var s = this.sp;
      LV.gems = s.gems.map(function (g) { return { x: g.x, y: g.y !== undefined ? g.y : near(g.x) - g.h, got: false, ph: hash(g.x) * 6 }; });
      LV.springs = s.springs.map(function (q) { return { x: q.x, y: near(q.x), kind: q.kind, t: 0 }; });
      LV.pads = s.pads.map(function (q) { return { x: q.x, y: near(q.x), dir: q.dir, w: q.w, t: 0 }; });
      LV.spikes = s.spikes.map(function (q) { return { x: q.x, y: near(q.x), n: q.n }; });
      LV.plats = s.plats.map(function (q) { return { x0: q.x0, x1: q.x1, y: q.y }; });
      LV.loops = s.loops.map(function (q) { return { cx: q.cx, y0: q.y0, done: false }; });
      LV.checks = s.checks.map(function (q) { return { x: q.x, y: near(q.x), on: false }; });
      LV.crushers = s.crushers.map(function (q) { return { x: q.x, y: near(q.x), ph: q.ph, per: q.per, h: 0 }; });
      LV.convs = s.convs;
      LV.enemyDefs = s.enemies;
      LV.enemies = s.enemies.map(function (q) {
        var gy = near(q.x), e = { kind: q.kind, x: q.x, x0: q.x - q.range, x1: q.x + q.range, dir: 1, alive: true, t: hash(q.x) * 6, w: q.kind === 'fly' ? 14 : 12, h: q.kind === 'fly' ? 10 : 10, y: 0, by: 0 };
        if (q.kind === 'fly') { e.by = gy - q.up; e.y = e.by; } else e.y = gy - 5;
        return e;
      });
      for (i = 0; i < LV.loops.length; i++) LV.topY = Math.min(LV.topY, LV.loops[i].y0 - LR * 2 - 6);
      for (i = 0; i < LV.plats.length; i++) LV.topY = Math.min(LV.topY, LV.plats[i].y - 40);
      LV.killY = LV.maxY + 150;
      return LV;
    }
  };

  /* ----------------------------------------------------------------- zone scripts */
  var ZONES = [
    { name: 'WINDMILL FIELDS', theme: 0, build: function () {
      var b = new Level(0);
      b.flat(240).gemRow(90, 6, 16, 12);
      b.hill(190, 24).gemArc(b.sx + 20, 150, 8, 12, 34);
      b.flat(120).crawler(b.sx + 60, 34);
      b.valley(210, 26).gemRow(b.sx + 30, 10, 14, 12);
      b.flat(230).springPlat(b.sx + 30, 62, 'g');
      b.flat(40);
      b.gap(54).gemArc(b.sx - 22, 96, 7, 14, 40);
      b.flat(120).pad(b.sx + 34, 1);
      b.ramp(180, 40).gemRow(b.sx + 20, 8, 17, 14);
      b.flat(70).pad(b.sx + 24, 1);
      b.loop();
      b.flat(110).check(b.sx + 40);
      b.ramp(160, -26);
      b.flat(210).crawler(b.sx + 36, 26).spike(b.sx + 120, 3).gemArc(b.sx + 104, 56, 5, 12, 34);
      b.hill(190, 26).flyer(b.sx + 95, 70, 44).gemRow(b.sx + 30, 7, 20, 14);
      b.gap(60).gemArc(b.sx - 22, 104, 7, 14, 40);
      b.flat(110).crawler(b.sx + 70, 30);
      b.valley(220, 34).gemRow(b.sx + 30, 11, 15, 12);
      b.flat(130).crawler(b.sx + 50, 30);
      b.ramp(140, -34);
      b.flat(240).springPlat(b.sx + 20, 112, 'r');
      b.check(b.sx + 150);
      b.flat(60);
      b.ramp(190, 46).gemRow(b.sx + 20, 8, 18, 14);
      b.flat(60).pad(b.sx + 26, 1);
      b.loop();
      b.flat(130).crawler(b.sx + 70, 28);
      b.hill(170, 20).gemArc(b.sx + 20, 130, 7, 12, 30);
      b.flat(80).finish();
      return b.done();
    } },
    { name: 'GLOWCAP CAVERN', theme: 1, build: function () {
      var b = new Level(1);
      b.flat(220).gemRow(90, 5, 16, 12);
      b.valley(230, 30).gemRow(b.sx + 30, 12, 15, 12);
      b.flat(100).crawler(b.sx + 55, 34);
      b.ramp(150, -30);
      b.flat(90).spring(b.sx + 30, 'g').plat(b.sx + 66, b.sx + 146, 66).gemRow(b.sx + 72, 5, 16, 10);
      b.flat(80);
      b.gap(60).gemArc(b.sx - 24, 108, 7, 14, 42);
      b.flat(90).pad(b.sx + 30, 1);
      b.hill(180, 36).gemArc(b.sx + 20, 140, 8, 12, 40);
      b.flat(60).flyer(b.sx + 40, 56, 50);
      b.ramp(190, 52).gemRow(b.sx + 20, 9, 17, 14);
      b.flat(50).pad(b.sx + 20, 1);
      b.loop();
      b.flat(90).check(b.sx + 40);
      b.valley(150, 50).pad(b.sx + 75, 1).gemRow(b.sx + 24, 8, 14, 12);
      b.flat(110).crawler(b.sx + 55, 30).spike(b.sx + 98, 2);
      b.gap(64).gemArc(b.sx - 20, 108, 7, 14, 42);
      b.flat(80).spike(b.sx + 20, 3).flyer(b.sx + 50, 60, 40);
      b.hill(150, 28);
      b.flat(160).crawler(b.sx + 40, 26).crawler(b.sx + 120, 20);
      b.ramp(170, -44).gemRow(b.sx + 20, 7, 18, 14);
      b.flat(240).springPlat(b.sx + 20, 112, 'r');
      b.flat(30).check(b.sx + 10);
      b.ramp(200, 54).gemRow(b.sx + 20, 9, 18, 14);
      b.flat(50).pad(b.sx + 20, 1);
      b.valley(160, 52).pad(b.sx + 80, 1);
      b.flat(60).pad(b.sx + 20, 1);
      b.loop();
      b.flat(110).crawler(b.sx + 60, 30);
      b.hill(180, 24).flyer(b.sx + 90, 66, 40).gemArc(b.sx + 20, 140, 7, 12, 30);
      b.flat(80).finish();
      return b.done();
    } },
    { name: 'CLOCKWORK WORKS', theme: 2, build: function () {
      var b = new Level(2);
      b.flat(240).gemRow(90, 6, 16, 12);
      b.flat(200).conv(b.sx + 30, b.sx + 170, 1).gemRow(b.sx + 40, 8, 16, 12);
      b.flat(220).crusher(b.sx + 110, 0, 2.6).gemRow(b.sx + 30, 5, 14, 12);
      b.ramp(170, 38).gemRow(b.sx + 20, 8, 17, 14);
      b.flat(70).pad(b.sx + 24, 1);
      b.loop();
      b.flat(110).check(b.sx + 40);
      b.flat(200).rover(b.sx + 50, 36).spike(b.sx + 130, 3).gemArc(b.sx + 114, 56, 5, 12, 34);
      b.gap(56).gemArc(b.sx - 22, 100, 7, 14, 40);
      b.flat(120).conv(b.sx + 10, b.sx + 110, -1).crusher(b.sx + 60, 1.2, 2.2);
      b.hill(170, 30).flyer(b.sx + 85, 64, 40);
      b.flat(60).pad(b.sx + 20, 1);
      b.valley(170, 52).pad(b.sx + 85, 1).gemRow(b.sx + 24, 9, 14, 12);
      b.flat(100).rover(b.sx + 50, 30);
      b.spring(b.sx + 60, 'g');
      b.flat(120).plat(b.sx + 20, b.sx + 100, 66).gemRow(b.sx + 26, 5, 16, 10);
      b.gap(64).gemArc(b.sx - 22, 108, 7, 14, 42);
      b.flat(120).crusher(b.sx + 40, 0.6, 2.0).crusher(b.sx + 100, 1.6, 2.0);
      b.ramp(190, 54).gemRow(b.sx + 20, 9, 18, 14);
      b.flat(50).pad(b.sx + 20, 1);
      b.loop();
      b.flat(100).check(b.sx + 40);
      b.flat(230).rover(b.sx + 40, 30).rover(b.sx + 130, 24).spike(b.sx + 84, 2).conv(b.sx + 140, b.sx + 220, 1);
      b.ramp(150, -40);
      b.flat(200).springPlat(b.sx + 30, 62, 'g');
      b.ramp(210, 56).gemRow(b.sx + 20, 10, 18, 14);
      b.flat(50).pad(b.sx + 20, 1);
      b.valley(180, 54).pad(b.sx + 90, 1);
      b.flat(60).pad(b.sx + 20, 1);
      b.loop();
      b.flat(140).crusher(b.sx + 70, 0.3, 2.2);
      b.hill(170, 22).gemArc(b.sx + 20, 130, 7, 12, 30);
      b.flat(80).finish();
      return b.done();
    } }
  ];

  /* ------------------------------------------------------------------ scenery */
  var THEMES = [
    { sky: ['#2a4f78', '#6a6a98', '#c8708a', '#f0a070', '#ffd890'], top: ['#e8a030', '#ffd870', '#8a4a10'], band: 4,
      gem: { o: '#2a0a5a', p: '#a06aff', P: '#5a2ac0', h: '#e0ccff', w: '#ffffff' } },
    { sky: ['#03121a', '#06222c', '#0c3a40', '#134e4c'], top: ['#30e0b0', '#b0ffe0', '#0a6a60'], band: 4,
      gem: { o: '#4a2a00', p: '#ffcc33', P: '#c8780a', h: '#fff0a0', w: '#ffffff' } },
    { sky: ['#0e1a26', '#1c3040', '#4a5440', '#c08c4a'], top: ['#e8c060', '#fff0b0', '#8a5a1a'], band: 4,
      gem: { o: '#04382a', p: '#4affb8', P: '#12a070', h: '#d0ffee', w: '#ffffff' } }
  ];
  var TEX = [], BGS = [];

  function ellP(g, cx, cy, rx, ry, col, upper) {
    g.fillStyle = col;
    for (var y = Math.ceil(cy - ry); y <= Math.floor(upper ? cy : cy + ry); y++) {
      var d = (y + 0.5 - cy) / ry; if (d * d >= 1) continue;
      var w = rx * Math.sqrt(1 - d * d), x0 = Math.round(cx - w), x1 = Math.round(cx + w);
      if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
    }
  }
  function cogSprite(r, teeth, body, tooth, hub) {
    var s = r * 2 + 14, c = mkCanvas(s, s), g = c.getContext('2d'), i, cx = s / 2, cy = s / 2;
    g.fillStyle = tooth;
    for (i = 0; i < teeth; i++) { g.save(); g.translate(cx, cy); g.rotate(i / teeth * Math.PI * 2); g.fillRect(-3, -r - 5, 6, 9); g.restore(); }
    g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.fillStyle = tooth; g.globalAlpha = 0.35; g.beginPath(); g.arc(cx, cy, r * 0.82, 0, 7); g.fill(); g.globalAlpha = 1;
    g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r * 0.72, 0, 7); g.fill();
    g.fillStyle = hub;
    for (i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2 + 0.3; g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, r * 0.14, 0, 7); g.fill(); }
    g.beginPath(); g.arc(cx, cy, r * 0.22, 0, 7); g.fill();
    return c;
  }
  function islandSprite(v) {
    var c = mkCanvas(52, 40), g = c.getContext('2d'), x, y;
    for (y = 8; y < 36; y++) {
      var w = 24 * (1 - (y - 8) / 30) + (y < 14 ? 2 : 0) + Math.sin(y * 1.3 + v) * 1.2;
      var band = ['#7a4630', '#5e3224', '#8e5a38', '#6a3a28'][Math.floor((y + v * 3) / 5) % 4];
      fr(g, Math.round(26 - w), y, Math.round(w * 2), 1, band);
    }
    for (x = 8; x < 44; x += 5) fr(g, x, 8, 2, 1, '#3a1e16');
    ellP(g, 26, 10, 27, 5, '#e8a030', true); ellP(g, 26, 10, 25, 3, '#ffd870', true);
    for (x = 3; x < 50; x += 3) fr(g, x, 6 + (x % 2), 1, 2, '#e8a030');
    // little autumn bush + hanging roots
    ellP(g, 15 + v * 6, 6, 5, 4, '#c8501a', true); ellP(g, 17 + v * 6, 4, 3, 3, '#e88a2a', true);
    for (x = 12; x < 40; x += 7) { fr(g, x, 22 + (x % 3) * 2, 1, 8, '#2e1a14'); fr(g, x + 1, 28 + (x % 3), 1, 4, '#2e1a14'); }
    return c;
  }

  function paintTex(theme) {
    var c = mkCanvas(258, 512), g = c.getContext('2d'), x, y, i, b;
    var pal = [
      ['#7a4630', '#5e3224', '#8e5a38', '#6a3a28', '#4e2a20'],
      ['#17414a', '#0e2c34', '#1f5560', '#123840', '#0a2229'],
      ['#7a5030', '#6a4426', '#8a5c36', '#5e3c20', '#4a2e18']
    ][theme];
    fr(g, 0, 0, 256, 256, pal[0]);
    // wavy strata bands (period 256 so the texture tiles)
    for (b = 0; b < 8; b++) {
      var y0 = b * 32, col = pal[b % pal.length];
      for (x = 0; x < 256; x++) {
        var yy = y0 + Math.round(Math.sin(x / 256 * Math.PI * 2 * 2 + b * 1.7) * 3 + Math.sin(x / 256 * Math.PI * 2 * 7 + b) * 1.3);
        fr(g, x, yy, 1, 34, col);
        fr(g, x, yy, 1, 1, 'rgba(255,255,255,0.10)'); fr(g, x, yy + 33, 1, 1, 'rgba(0,0,0,0.22)');
      }
    }
    // texture above y=0 wraps: repaint the first bar over the seam
    for (x = 0; x < 256; x++) fr(g, x, 0, 1, 2, pal[7 % pal.length]);
    if (theme === 0) {
      for (i = 0; i < 70; i++) { x = Math.floor(hash(i * 3 + 1) * 250); y = Math.floor(hash(i * 7 + 2) * 250); ellP(g, x, y, 3, 2, '#b89a78'); ellP(g, x, y + 1, 3, 1, '#7a6048'); fr(g, x - 1, y - 1, 1, 1, '#e8d4b0'); }
      for (i = 0; i < 22; i++) {   // roots
        x = Math.floor(hash(i * 5 + 3) * 250); y = Math.floor(hash(i * 11 + 4) * 220);
        var px = x, py = y; g.fillStyle = '#2e1a14';
        for (var k = 0; k < 18; k++) { g.fillRect(px, py, 1, 2); py += 2; px += Math.round(Math.sin(k * 0.7 + i) * 1.2); if (k === 8) fr(g, px + 1, py, 4 + (i % 3), 1, '#2e1a14'); }
      }
    } else if (theme === 1) {
      for (i = 0; i < 26; i++) {   // glowing crystal veins
        x = Math.floor(hash(i * 5 + 3) * 240); y = Math.floor(hash(i * 11 + 4) * 240);
        var vc = i % 3 === 0 ? '#a0ff70' : i % 3 === 1 ? '#40f0d0' : '#c070ff';
        for (var q = 0; q < 14; q++) { fr(g, x + q, y + Math.round(q * 0.6), 2, 1, vc); if (q % 4 === 0) fr(g, x + q, y + Math.round(q * 0.6) - 2, 1, 2, vc); }
        fr(g, x + 14, y + 8, 2, 4, '#ffffff'); fr(g, x + 13, y + 9, 4, 2, vc);
      }
      for (i = 0; i < 50; i++) { x = Math.floor(hash(i * 3 + 9) * 250); y = Math.floor(hash(i * 7 + 5) * 250); fr(g, x, y, 2, 2, '#0a1c22'); }
    } else {
      for (y = 0; y < 256; y += 16) for (x = 0; x < 256; x += 32) {
        var ox = (y >> 4) % 2 ? 16 : 0, bx = (x + ox) % 256;
        fr(g, bx, y, 32, 1, '#a87848'); fr(g, bx, y, 1, 16, '#a87848'); fr(g, bx + 31, y, 1, 16, '#3a2210'); fr(g, bx, y + 15, 32, 1, '#3a2210');
        fr(g, bx + 3, y + 3, 2, 2, '#e0bc70'); fr(g, bx + 27, y + 3, 2, 2, '#e0bc70'); fr(g, bx + 3, y + 11, 2, 2, '#e0bc70'); fr(g, bx + 27, y + 11, 2, 2, '#e0bc70');
      }
      for (i = 0; i < 18; i++) { x = Math.floor(hash(i * 5 + 1) * 250); y = Math.floor(hash(i * 9 + 2) * 230); for (var d = 0; d < 6 + (i % 5) * 2; d++) fr(g, x + (d % 2), y + d, 1, 1, '#3a9a80'); fr(g, x - 1, y + 6 + (i % 5) * 2, 3, 2, '#3a9a80'); }
      for (i = 0; i < 6; i++) { x = 20 + Math.floor(hash(i * 3 + 2) * 200); y = 20 + Math.floor(hash(i * 7 + 9) * 200); g.fillStyle = '#4a2e18'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.fillStyle = '#6a4426'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.fillStyle = '#4a2e18'; g.fillRect(x - 1, y - 1, 3, 3); for (var tt = 0; tt < 8; tt++) { var ta = tt / 8 * 6.283; g.fillRect(Math.round(x + Math.cos(ta) * 10) - 1, Math.round(y + Math.sin(ta) * 10) - 1, 3, 3); } }
    }
    g.drawImage(c, 0, 0, 256, 256, 0, 256, 256, 256);
    g.drawImage(c, 0, 0, 2, 512, 256, 0, 2, 512);
    return c;
  }

  function mushroom(g, x, base, h, rx, ry, cap, rim, spot, stalk) {
    fr(g, x - 3, base - h, 6, h, stalk); fr(g, x - 3, base - h, 2, h, rim);
    ellP(g, x, base - h + 2, rx, ry, cap, true);
    ellP(g, x, base - h + 2, rx, ry * 0.45, rim, true); ellP(g, x, base - h + 3, rx - 2, ry * 0.5, cap, true);
    fr(g, x - rx, base - h + 2, rx * 2, 2, rim);
    for (var i = 0; i < 4; i++) { var sx = x - rx * 0.6 + i * rx * 0.4, sy = base - h - ry * 0.5 + (i % 2) * 3; ellP(g, sx, sy, 2, 1.5, spot); }
  }

  function paintBg(theme) {
    var B = {}, g, i, x, y;
    var sky = mkCanvas(W, H), far = mkCanvas(256, H + 60), mid = mkCanvas(256, H + 60);
    var gs = sky.getContext('2d'), gf = far.getContext('2d'), gm = mid.getContext('2d'), BASE = H + 60;
    gradBands(gs, W, 0, H, THEMES[theme].sky, 4);
    if (theme === 0) {
      for (i = 0; i < 12; i++) { var cxl = Math.floor(hash(i * 3 + 1) * W), cyl = 30 + Math.floor(hash(i * 5 + 2) * 110); gs.globalAlpha = 0.35; fr(gs, cxl, cyl, 40 + (i % 4) * 14, 1, '#ffd0c0'); fr(gs, cxl + 8, cyl + 2, 28 + (i % 3) * 10, 1, '#ffd0c0'); gs.globalAlpha = 1; }
      for (i = 0; i < 20; i++) fr(gs, Math.floor(hash(i * 7 + 1) * W), Math.floor(hash(i * 3 + 2) * 40), 1, 1, '#cfe0f0');
      // far: flat-topped mesas
      for (x = 0; x < 256; x += 64) {
        var mw = 36 + Math.floor(hash(x + 1) * 3) * 8, mh = 40 + Math.floor(hash(x + 5) * 3) * 14;
        for (y = 0; y < mh; y++) { var ins = Math.floor(y * 0.08 * 6 / 6 + (y < 4 ? 3 - y : 0)); fr(gf, x + 8 + ins - (y > mh - 10 ? 0 : 0), BASE - 92 - mh + y, mw - ins * 2 + (y > 6 ? Math.floor(y / 6) : 0), 1, y % 9 < 2 ? '#a06a96' : '#8a5a8a'); }
        fr(gf, x + 8, BASE - 92 - mh, mw, 2, '#c890a8');
      }
      fr(gf, 0, BASE - 92, 256, 92, '#8a5a8a');
      for (y = BASE - 92; y < BASE; y += 5) fr(gf, 0, y, 256, 1, '#7a4a7a');
      // mid: plowed terraced fields, tall poplars, windmill towers
      B.hubs = [];
      var yb = BASE - 66;
      function prof(px) { return yb - (14 + 10 * Math.abs(Math.sin(px / 40.7)) + 5 * Math.sin(px / 12.8)); }
      for (x = 0; x < 256; x++) {
        var yy = Math.round(prof(x)); fr(gm, x, yy, 1, BASE - yy, '#b8681e'); fr(gm, x, yy, 1, 2, '#f0b050');
        for (var ly = yy + 4; ly < BASE; ly += 4) fr(gm, x, ly, 1, 1, '#9a521a');
      }
      for (i = 0; i < 9; i++) { x = Math.floor(hash(i * 7 + 2) * 250); var py = Math.round(prof(x)); fr(gm, x, py - 5, 2, 5, '#4a2a1a'); ellP(gm, x + 1, py - 20, 5, 16, i % 2 ? '#c8461a' : '#e8a020'); ellP(gm, x - 1, py - 24, 2, 9, i % 2 ? '#e86a2a' : '#ffd050'); }
      var wxs = [60, 185];
      for (i = 0; i < wxs.length; i++) {
        x = wxs[i]; var wy = Math.round(prof(x)), th = 44;
        for (y = 0; y < th; y++) { var hw = 7 - Math.floor(y * 3.2 / th); fr(gm, x - hw, wy - y, hw * 2, 1, y % 7 === 0 ? '#7a3a2a' : '#a8543a'); fr(gm, x + hw - 2, wy - y, 2, 1, '#7a3a2a'); }
        fr(gm, x - 2, wy - 8, 4, 8, '#3a1a14'); fr(gm, x - 5, wy - th - 3, 10, 3, '#5a2a2a'); fr(gm, x - 3, wy - th - 6, 6, 3, '#5a2a2a');
        B.hubs.push({ x: x, y: wy - th - 2 });
      }
    } else if (theme === 1) {
      for (i = 0; i < 4; i++) { var ssx = Math.floor(hash(i + 70) * W), ssy = Math.floor(hash(i + 90) * 120); fr(gs, ssx, ssy, 1, 1, '#6af0ff'); }
      for (i = 0; i < 7; i++) { x = 18 + i * 36 + Math.floor(hash(i + 3) * 10); var mh2 = 60 + Math.floor(hash(i * 9) * 70), rxx = 22 + Math.floor(hash(i * 5) * 20); mushroom(gf, x, BASE, mh2, rxx, 16, '#0b3640', '#176068', '#1f8a8a', '#0a2c34'); }
      B.glows = [];
      var gl = [['#ff6ad8', 40, 150], ['#6af0ff', 120, 110], ['#b0ff6a', 205, 170]];
      for (i = 0; i < gl.length; i++) {
        x = gl[i][1]; var mh3 = gl[i][2], cc = gl[i][0];
        var capc = cc === '#ff6ad8' ? '#6a2a7a' : cc === '#6af0ff' ? '#1a6a80' : '#3a7a2a';
        mushroom(gm, x, BASE, mh3, 30, 18, capc, cc, '#ffffff', '#12303a');
        B.glows.push({ x: x, y: BASE - mh3, c: cc });
      }
      for (x = 0; x < 256; x += 2) { var st2 = 10 + 22 * Math.abs(Math.sin(x / 23 + 2)); fr(gm, x, BASE - st2 - 26, 2, st2 + 26, '#0c2a30'); fr(gm, x, BASE - st2 - 26, 2, 2, '#1a5a60'); }
      for (i = 0; i < 12; i++) { x = Math.floor(hash(i * 11 + 4) * 250); fr(gm, x, BASE - 70 - (i % 4) * 8, 2, 8 + (i % 3) * 4, i % 2 ? '#40f0d0' : '#c070ff'); }
      // ceiling: hanging vines with glowing bulbs + stalactites
      var ce = mkCanvas(256, 80), gc = ce.getContext('2d');
      fr(gc, 0, 0, 256, 12, '#061a20');
      for (x = 0; x < 256; x += 2) { var st3 = 8 + 26 * Math.pow(Math.abs(Math.sin(x / 21 + 1)), 1.7) * Math.abs(Math.sin(x / 59)); fr(gc, x, 0, 2, st3, '#0b2a32'); fr(gc, x, 0, 1, st3, '#154a52'); }
      for (i = 0; i < 9; i++) {
        x = 10 + i * 28 + Math.floor(hash(i + 5) * 12); var vl = 22 + Math.floor(hash(i * 3) * 34), vcc = ['#ffcc33', '#ff6ad8', '#6af0ff'][i % 3];
        for (y = 0; y < vl; y++) fr(gc, x + Math.round(Math.sin(y / 5 + i) * 2), y, 1, 1, '#2a8a5a');
        var bx = x + Math.round(Math.sin(vl / 5 + i) * 2); ellP(gc, bx, vl + 2, 3, 3, vcc); fr(gc, bx - 1, vl + 1, 1, 1, '#ffffff');
        gc.globalAlpha = 0.25; ellP(gc, bx, vl + 2, 7, 7, vcc); gc.globalAlpha = 1;
      }
      B.ceil = ce;
    } else {
      for (i = 0; i < 8; i++) {   // far: clock-tower and chimney silhouettes
        x = Math.floor(hash(i * 5 + 2) * 240); var bw = 18 + Math.floor(hash(i * 3) * 3) * 8, bh = 50 + Math.floor(hash(i * 7) * 70);
        fr(gf, x, BASE - bh - 40, bw, bh + 40, '#12222a'); fr(gf, x, BASE - bh - 40, bw, 2, '#24404a');
        if (i % 3 === 0) { fr(gf, x + 3, BASE - bh - 54, bw - 6, 14, '#12222a'); fr(gf, x + bw / 2 - 1, BASE - bh - 64, 2, 10, '#12222a'); }
        for (y = BASE - bh - 34; y < BASE - 50; y += 9) for (var wx = x + 3; wx < x + bw - 3; wx += 6) if (hash(wx * 3 + y) < 0.3) fr(gf, wx, y, 2, 4, '#ffb050');
      }
      fr(gf, 0, BASE - 30, 256, 30, '#0e1a20');
      // mid: pipework and girders
      for (y = 40; y < BASE; y += 74) { fr(gm, 0, y, 256, 8, '#1f3a44'); fr(gm, 0, y, 256, 2, '#34606a'); fr(gm, 0, y + 7, 256, 1, '#0e1e24'); for (x = 12; x < 256; x += 48) { fr(gm, x, y - 2, 6, 12, '#b08a40'); fr(gm, x, y - 2, 6, 2, '#e0bc70'); } }
      for (x = 20; x < 256; x += 64) { fr(gm, x, 0, 6, BASE, '#183038'); fr(gm, x, 0, 2, BASE, '#2a5058'); for (y = 10; y < BASE; y += 20) fr(gm, x + 2, y, 2, 2, '#b08a40'); }
      var cf = mkCanvas(256, 70), gp = cf.getContext('2d');
      fr(gp, 0, 0, 256, 14, '#0e1a20'); fr(gp, 0, 12, 256, 4, '#b08a40'); fr(gp, 0, 12, 256, 1, '#e0bc70'); fr(gp, 0, 16, 256, 1, '#3a2a10');
      for (x = 0; x < 256; x += 32) { fr(gp, x + 14, 16, 1, 12 + (x % 3) * 8, '#6a5a40'); ellP(gp, x + 14, 30 + (x % 3) * 8, 5, 5, '#b08a40'); ellP(gp, x + 14, 31 + (x % 3) * 8, 3, 3, '#ffd890'); fr(gp, x + 4, 16, 2, 5, '#6a5a40'); }
      B.ceil = cf;
    }
    B.sky = sky; B.far = far; B.mid = mid;
    return B;
  }

  /* -------------------------------------------------------------------- state */
  var LV, zone, p, clock, lives, gemCount, totalGems, camX, camY, camV, fade, banner, bannerT, zoneTime, loose, tallyT, phase, spawn, shakeT;
  var kills, topSpeedHit, padCool, loopMsg, needBanner, speedFx;

  function gh(x) { return ghOf(LV.h, x); }
  function slopeAt(x) {
    var a = gh(x - 3), b = gh(x + 3);
    if (a >= INF || b >= INF) return 0;
    return (b - a) / 6;
  }

  function newPlayer(x) {
    return { x: x, y: 0, vx: 0, vy: 0, gs: 0, mode: 'ground', surf: 'terrain', plat: null, face: 1, rolling: false, rollLock: 0, charging: false, charge: 0, chargeSnd: 0, jumping: false, ballAir: false,
      coyote: 0, jbuf: 0, inv: 0, hurtT: 0, ang: 0, rot: 0, loop: null, ld: 1, phi: 0, deadT: 0, jumpHeldPrev: false, landT: 0, springT: 0 };
  }

  function loadZone(i) {
    zone = i; LV = ZONES[i].build();
    if (!TEX[LV.theme]) { TEX[LV.theme] = paintTex(LV.theme); BGS[LV.theme] = paintBg(LV.theme); }
    var keepLives = lives;
    p = newPlayer(LV.spawnX);
    p.y = gh(p.x) - BALL;
    p.inv = 0; spawn = { x: p.x, y: p.y };
    loose = []; zoneTime = 0; phase = 'play'; fade = 1; tallyT = 0; padCool = 0; loopMsg = 0; speedFx = [];
    camX = clamp(p.x - W * 0.35, 0, LV.w - W); camY = camTargetY(); camV = 0;
    R.level = i + 1; lives = keepLives;
    setBanner('ZONE ' + (i + 1), ZONES[i].name, 2.4);
  }
  function setBanner(a, b, t) { banner = [a, b]; bannerT = t; }
  function camTargetY() { return clamp(p.y - H * 0.68, LV.topY - 70, LV.maxY - 100); }

  /* -------------------------------------------------------------------- physics */
  function isBall() {
    if (p.mode === 'loop') return true;
    if (p.mode === 'ground') return p.rolling || p.charging;
    if (p.mode === 'air') return p.jumping || p.ballAir;
    return false;
  }
  function launch(vx, vy) { var wasBall = p.rolling || p.charging; p.mode = 'air'; p.vx = vx; p.vy = vy; p.surf = 'terrain'; p.plat = null; p.coyote = 0.09; p.rolling = false; p.charging = false; p.ballAir = wasBall; }

  function doJump() {
    var s = p.surf === 'plat' ? 0 : slopeAt(p.x), th = Math.atan(s), sn = Math.sin(th), cs = Math.cos(th);
    var vx = p.gs * cs + JUMP_V * sn, vy = p.gs * sn - JUMP_V * cs;
    p.mode = 'air'; p.vx = vx; p.vy = vy; p.jumping = true; p.ballAir = true; p.surf = 'terrain'; p.plat = null; p.rolling = false; p.charging = false; p.jbuf = 0; p.coyote = 0;
    R.sfx.play('jump'); R.vibrate(5);
    R.fx.burst(p.x - camX, p.y + BALL - camY, { n: 4, color: ['#ffffff', '#c8e8ff'], speed: 30, life: 0.25, size: 1, gravity: 30 });
  }

  function groundStep(dt, ax, down) {
    var onPlat = p.surf === 'plat';
    var s = onPlat ? 0 : slopeAt(p.x), th = Math.atan(s), sn = Math.sin(th), cs = Math.cos(th);
    var gs = p.gs;
    if (p.rollLock > 0) p.rollLock -= dt;
    // charge-roll charge / release
    if (p.charging) {
      gs = 0; p.charge = Math.min(1, p.charge + dt / 0.85);
      if (ax) p.face = ax;
      p.chargeSnd -= dt;
      if (p.chargeSnd <= 0) { p.chargeSnd = 0.11; R.sfx.tone(160 + p.charge * 520, 0.07, { type: 'sawtooth', vol: 0.05 }); }
      if (Math.random() < 0.5) R.fx.burst(p.x - p.face * 5 - camX, p.y + BALL - camY, { n: 1, color: ['#e8e0c8', '#ffffff'], speed: 30, life: 0.25, size: 1, gravity: -20 });
      if (!down) {
        p.charging = false;
        if (p.charge > 0.18) {
          gs = p.face * (130 + 120 * p.charge); p.rolling = true; p.rollLock = 0.9;
          R.sfx.tone(300, 0.2, { type: 'sawtooth', vol: 0.09, slide: 900 }); R.sfx.noise(0.18, { vol: 0.1, freq: 3000, sweep: 400 }); R.vibrate(18);
          R.fx.burst(p.x - p.face * 6 - camX, p.y + BALL - camY, { n: 8, color: ['#e8e0c8', '#ffffff', '#ffd23a'], speed: 60, life: 0.3, size: 2, gravity: -10 });
        }
        p.charge = 0;
      } else if (R.input.pressed('a')) { p.charging = false; p.charge = 0; p.gs = 0; doJump(); return; }
    } else {
      if (down && Math.abs(gs) < 25 && !p.rolling) {
        p.charging = true; p.charge = 0; p.chargeSnd = 0; gs = 0; if (ax) p.face = ax;
      }
      if (down && Math.abs(gs) >= 25 && !p.rolling) { p.rolling = true; R.sfx.tone(240, 0.1, { type: 'triangle', vol: 0.06, slide: 420 }); }
      else if (p.rolling && !down && p.rollLock <= 0) p.rolling = false;
      if (p.rolling && Math.abs(gs) < 24 && p.rollLock <= 0) p.rolling = false;
      if (!p.charging) {
        if (p.rolling) {
          if (ax) { if (ax * gs > 0) { if (Math.abs(gs) < ROLL_MAX) gs += ax * ROLL_ACC * dt; } else gs += ax * ROLL_DEC * dt; }
          else gs -= sgn(gs) * Math.min(Math.abs(gs), ROLL_FRIC * dt);
        } else {
          if (ax) { if (ax * gs < 0) gs += ax * TURN_DEC * dt; else if (Math.abs(gs) < RUN_MAX) gs = ax * Math.min(RUN_MAX, Math.abs(gs) + RUN_ACC * dt); }
          else gs -= sgn(gs) * Math.min(Math.abs(gs), FRIC * dt);
        }
        gs += SG * sn * dt * (p.rolling ? 1.25 : 1);
        gs = clamp(gs, -TOP, TOP);
        if (ax && !p.rolling) p.face = ax; else if (Math.abs(gs) > 30) p.face = sgn(gs);
      }
    }
    // conveyors
    var drift = 0;
    for (var ci = 0; ci < LV.convs.length; ci++) { var cv = LV.convs[ci]; if (p.x > cv.x0 && p.x < cv.x1 && !onPlat) drift = cv.dir * 46; }
    // move
    var nx = p.x + (gs * cs + drift) * dt;
    if (nx < 12) { nx = 12; gs = Math.max(0, gs); }
    if (nx > LV.w - 12) { nx = LV.w - 12; gs = Math.min(0, gs); }
    if (onPlat) {
      var pl = p.plat;
      if (nx < pl.x0 - 3 || nx > pl.x1 + 3) { p.x = nx; p.gs = gs; launch(gs, 0); return; }
      p.x = nx; p.y = pl.y - BALL; p.gs = gs; p.ang = 0; return;
    }
    // loop entry
    for (var li = 0; li < LV.loops.length; li++) {
      var L = LV.loops[li];
      if (!p.charging && Math.abs(gs) >= LOOP_MIN && (p.x - L.cx) * (nx - L.cx) <= 0 && Math.abs(p.y - (L.y0 - BALL)) < 5) {
        p.mode = 'loop'; p.loop = L; p.ld = sgn(gs); p.phi = 0; p.gs = Math.abs(gs); p.x = L.cx; p.y = L.y0 - BALL; p.rolling = true; p.loopSnd = 0;
        R.sfx.tone(400, 0.25, { type: 'triangle', vol: 0.07, slide: 800 });
        return;
      }
    }
    var g1 = gh(nx);
    if (g1 >= INF) { p.x = nx; p.gs = gs; launch(gs * cs, gs * sn); return; }
    var s2 = slopeAt(nx), yc = g1 - BALL * Math.sqrt(1 + s2 * s2);
    var yb = p.y + gs * sn * dt + 0.5 * G * dt * dt;
    if (yc - yb > 1.6 && Math.abs(gs) > 40) {
      p.x = nx; p.y = yb; p.gs = gs; launch(gs * cs, gs * sn);
      if (Math.abs(gs) > 160) R.fx.burst(p.x - camX, p.y - camY, { n: 3, color: ['#ffffff'], speed: 20, life: 0.2, size: 1 });
      return;
    }
    p.x = nx; p.y = yc; p.gs = gs; p.ang = Math.atan(s2);
  }

  function airStep(dt, ax) {
    var jumpHeld = R.input.held.a || R.input.held.up;
    if (p.hurtT > 0) p.hurtT -= dt;
    p.vy = Math.min(p.vy + G * dt, 480);
    if (ax && p.hurtT <= 0) { if (ax * p.vx < RUN_MAX) p.vx += ax * AIR_ACC * dt; p.face = ax; }
    if (p.jumping) { if (!jumpHeld && p.vy < -110) p.vy = -110; if (p.vy >= 0) p.jumping = false; }
    if (p.coyote > 0) p.coyote -= dt;
    var ox = p.x, oy = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < 12) { p.x = 12; p.vx = Math.max(0, p.vx); }
    if (p.x > LV.w - 12) { p.x = LV.w - 12; p.vx = Math.min(0, p.vx); }
    var i;
    if (p.vy >= 0) {
      for (i = 0; i < LV.plats.length; i++) {
        var pl = LV.plats[i];
        if (oy + BALL <= pl.y + 3 && p.y + BALL >= pl.y && p.x > pl.x0 - 3 && p.x < pl.x1 + 3) {
          var vyP = p.vy; p.mode = 'ground'; p.surf = 'plat'; p.plat = pl; p.y = pl.y - BALL; p.gs = p.vx; p.ang = 0; p.vy = 0; p.hurtT = 0; landed(vyP); return;
        }
      }
    }
    var g = gh(p.x);
    if (g < INF) {
      var s = slopeAt(p.x), yc = g - BALL * Math.sqrt(1 + s * s);
      if (p.y >= yc) {
        if (p.y - yc > 9 && gh(ox) >= INF) { p.x = ox; p.vx = 0; }
        else {
          var th = Math.atan(s), vyIn = p.vy;
          p.gs = p.vx * Math.cos(th) + p.vy * Math.sin(th);
          p.y = yc; p.mode = 'ground'; p.surf = 'terrain'; p.ang = th; p.vy = 0; p.ballAir = false; p.jumping = false;
          if (p.hurtT > 0) { p.hurtT = 0; }
          if (R.input.held.down || R.input.held.b) { if (Math.abs(p.gs) > 25) p.rolling = true; }
          landed(vyIn); return;
        }
      }
    }
    if (p.y > LV.killY) die(true);
  }
  function landed(vy) {
    p.landT = 0.1; p.ballAir = false; p.jumping = false;
    if (vy > 150) { R.sfx.play('land'); R.fx.burst(p.x - camX, p.y + BALL - camY, { n: 5, color: ['#e8e0c8', '#ffffff'], speed: 36, life: 0.25, size: 1, gravity: -5 }); }
  }

  function loopStep(dt) {
    var L = p.loop, d = p.ld, rho = LR - BALL;
    p.phi += p.gs / rho * dt;
    p.gs = Math.max(0, p.gs - 6 * dt);
    p.rot += p.gs * dt / BALL * d;
    p.loopSnd -= dt; if (p.loopSnd <= 0) { p.loopSnd = 0.09; R.sfx.tone(300 + p.phi * 40, 0.05, { type: 'square', vol: 0.03 }); }
    var ph = p.phi;
    p.x = L.cx + d * rho * Math.sin(ph); p.y = L.y0 - LR + rho * Math.cos(ph);
    if (ph > Math.PI * 0.55 && ph < Math.PI * 1.45 && p.gs < 70) {
      var tx = d * Math.cos(ph), ty = -Math.sin(ph);
      p.loop = null; launch(p.gs * tx, p.gs * ty); p.ballAir = true; R.sfx.play('hit'); return;
    }
    if (ph >= Math.PI * 2) {
      p.mode = 'ground'; p.surf = 'terrain'; p.loop = null; p.x = L.cx + d * 0.5; p.y = gh(p.x) - BALL; p.gs = d * p.gs; p.rolling = true; p.rollLock = 0.4;
      if (!L.done) { L.done = true; }
      R.addScore(200); loopMsg = 1.1; R.sfx.play('powerup'); R.vibrate(30); R.achieve('loop-de-loop');
      R.fx.burst(p.x - camX, p.y - camY, { n: 14, color: ['#ffd23a', '#ffffff', '#3de2ff'], speed: 80, life: 0.5, size: 2 });
    }
  }

  function updatePlayer(dt) {
    var inp = R.input, ax = inp.axisX(), down = inp.held.down || inp.held.b;
    if (p.inv > 0) p.inv -= dt;
    if (p.landT > 0) p.landT -= dt;
    if (padCool > 0) padCool -= dt;
    if (inp.pressed('a') || inp.pressed('up')) p.jbuf = 0.11; else if (p.jbuf > 0) p.jbuf -= dt;
    if (p.mode === 'dead') {
      p.vy = Math.min(p.vy + G * dt, 520); p.y += p.vy * dt; p.deadT += dt;
      if (p.deadT > 1.5) { if (lives > 0) respawn(); else R.gameOver(); }
      return;
    }
    if (p.mode === 'clear') { clearStep(dt); return; }
    var hurtLock = p.hurtT > 0;
    if (p.mode === 'ground') {
      if (!hurtLock && p.jbuf > 0 && !p.charging) { doJump(); }
      else groundStep(dt, hurtLock ? 0 : ax, hurtLock ? false : down);
    } else if (p.mode === 'air') {
      if (!hurtLock && p.jbuf > 0 && p.coyote > 0) doJump();
      else airStep(dt, hurtLock ? 0 : ax);
    } else if (p.mode === 'loop') loopStep(dt);
    // rotation for the sprite
    if (p.mode === 'ground') p.rot += (p.gs * dt) / BALL;
    if (p.mode === 'air') p.rot += (p.vx * dt) / BALL * 0.6;
    if (p.mode === 'dead' || p.mode === 'clear') return;
    interact(dt);
    if (Math.abs(p.mode === 'air' ? p.vx : p.gs) > TOP - 12) { if (!topSpeedHit) { topSpeedHit = true; R.achieve('full-throttle'); } }
  }

  /* ---------------------------------------------------------------- interactions */
  function hurt(src) {
    if (p.inv > 0 || p.mode === 'dead' || p.mode === 'clear') return;
    if (p.mode === 'loop') p.loop = null;
    var dir = src && src.x !== undefined ? (p.x >= src.x ? 1 : -1) : -p.face;
    if (gemCount > 0) {
      var n = Math.min(gemCount, 14), i;
      for (i = 0; i < n; i++) { var a = -Math.PI / 2 + (i / n - 0.5) * 2.6 + (hash(i + clock * 7) - 0.5) * 0.4, sp = 90 + hash(i * 3 + 1) * 110; loose.push({ x: p.x, y: p.y - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0, life: 3.4 }); }
      gemCount = 0;
      p.inv = 1.8; p.hurtT = 0.4; launch(dir * 85, -175); p.ballAir = false; p.charging = false;
      R.sfx.play('hit'); R.vibrate(70); R.fx.shake(3, 0.25); R.fx.flash('#ffffff', 0.12);
      R.fx.burst(p.x - camX, p.y - camY, { n: 10, color: ['#ff5ad2', '#ffffff'], speed: 90, life: 0.5, size: 2 });
    } else die(false);
  }
  function die(pit) {
    if (p.mode === 'dead') return;
    p.mode = 'dead'; p.deadT = 0; p.loop = null; p.charging = false; p.rolling = false; p.vx = 0; p.vy = pit ? 0 : -260; p.inv = 0;
    lives = Math.max(0, lives - 1); R.lives = lives; gemCount = 0;
    R.sfx.play('lose'); R.vibrate(100); R.fx.shake(4, 0.35);
    R.fx.burst(p.x - camX, p.y - camY, { n: 18, color: ['#3de2ff', '#ffffff', '#ffd23a', '#1a86d8'], speed: 110, life: 0.7, size: 2, gravity: 120 });
  }
  function respawn() {
    var cp = null, i;
    for (i = 0; i < LV.checks.length; i++) if (LV.checks[i].on) cp = LV.checks[i];
    var x = cp ? cp.x : spawn.x;
    var lg = lives; p = newPlayer(x); lives = lg;
    p.y = gh(x) - BALL; p.inv = 1.6; p.mode = 'ground';
    camX = clamp(p.x - W * 0.35, 0, LV.w - W); camY = camTargetY(); camV = 0; fade = 0.8; loose = [];
    for (i = 0; i < LV.enemies.length; i++) { var e = LV.enemies[i]; e.alive = true; }
    R.sfx.play('select');
  }

  function collectGem() {
    gemCount++; totalGems++; R.addScore(10); R.sfx.tone(988 + Math.min(gemCount, 20) * 22, 0.07, { vol: 0.08, type: 'square' }); R.vibrate(3);
    if (gemCount > 0 && gemCount % 50 === 0 && lives < 5) { lives++; R.lives = lives; R.sfx.play('powerup'); R.fx.text(W / 2, 60, '1UP!', '#7cff6a'); }
    if (totalGems >= 100) R.achieve('gem-hoarder');
  }

  function interact(dt) {
    var i, d2, r;
    for (i = 0; i < LV.gems.length; i++) {
      var g = LV.gems[i]; if (g.got) continue;
      if (Math.abs(g.x - p.x) < BALL + 5 && Math.abs(g.y - p.y) < BALL + 5) { g.got = true; collectGem(); R.fx.burst(g.x - camX, g.y - camY, { n: 5, color: ['#ff5ad2', '#ffffff'], speed: 40, life: 0.3, size: 1 }); }
    }
    for (i = loose.length - 1; i >= 0; i--) {
      var l = loose[i]; l.t += dt; l.vy += G * 0.8 * dt; l.x += l.vx * dt; l.y += l.vy * dt;
      var gg = gh(l.x); if (gg < INF && l.y > gg - 4) { l.y = gg - 4; l.vy = -Math.abs(l.vy) * 0.65; l.vx *= 0.9; }
      if (l.t > 0.55 && Math.abs(l.x - p.x) < BALL + 5 && Math.abs(l.y - p.y) < BALL + 5 && p.mode !== 'dead') { loose.splice(i, 1); collectGem(); continue; }
      if (l.t > l.life || l.y > LV.killY) loose.splice(i, 1);
    }
    // springs
    for (i = 0; i < LV.springs.length; i++) {
      var s = LV.springs[i]; if (s.t > 0) s.t -= dt;
      var vyEff = p.mode === 'air' ? p.vy : 0;
      if (Math.abs(p.x - s.x) < 10 && p.y + BALL > s.y - 7 && p.y + BALL < s.y + 7 && vyEff > -40 && p.mode !== 'loop' && p.mode !== 'dead') {
        var sp = s.kind === 'r' ? 450 : 345, vx0 = p.mode === 'ground' ? p.gs : p.vx;
        p.mode = 'air'; p.surf = 'terrain'; p.plat = null; p.vx = vx0; p.vy = -sp; p.rolling = false; p.charging = false; p.jumping = false; p.ballAir = true; p.coyote = 0;
        s.t = 0.3; R.sfx.tone(300, 0.25, { type: 'square', vol: 0.09, slide: 1100 }); R.vibrate(20);
        R.fx.burst(s.x - camX, s.y - camY, { n: 6, color: s.kind === 'r' ? ['#ff5a5a', '#ffffff'] : ['#7cff6a', '#ffffff'], speed: 50, life: 0.3, size: 2 });
      }
    }
    // boost pads
    for (i = 0; i < LV.pads.length; i++) {
      var pd = LV.pads[i]; if (pd.t > 0) pd.t -= dt;
      if (p.mode === 'ground' && p.surf === 'terrain' && Math.abs(p.x - pd.x) < pd.w / 2 && padCool <= 0 && !p.charging) {
        p.gs = pd.dir * Math.max(BOOST_V, Math.abs(p.gs) * (sgn(p.gs) === pd.dir ? 1 : 0)); p.rolling = true; p.rollLock = 0.8; p.face = pd.dir; padCool = 0.4; pd.t = 0.4;
        R.sfx.tone(500, 0.18, { type: 'sawtooth', vol: 0.08, slide: 1400 }); R.sfx.noise(0.15, { vol: 0.08, freq: 4000, sweep: 800 }); R.vibrate(15);
        R.fx.burst(p.x - camX, p.y - camY, { n: 8, color: ['#ffd23a', '#ffffff', '#3de2ff'], speed: 70, life: 0.3, size: 2 });
      }
    }
    // hazards: spikes
    for (i = 0; i < LV.spikes.length; i++) {
      var sk = LV.spikes[i], half = sk.n * 4;
      if (Math.abs(p.x - sk.x) < half + BALL - 3 && p.y + BALL > sk.y - 7 && p.y < sk.y && p.mode !== 'loop') hurt({ x: sk.x });
    }
    // crushers
    for (i = 0; i < LV.crushers.length; i++) {
      var cr = LV.crushers[i], ph = ((clock + cr.ph) % cr.per) / cr.per;
      // 0..0.45 up (bottom 34 above ground) ; 0.45..0.55 slam; 0.55..0.8 down; 0.8..1 rise
      var up = 36, hgt;
      if (ph < 0.45) hgt = up; else if (ph < 0.55) hgt = up * (1 - (ph - 0.45) / 0.1); else if (ph < 0.8) hgt = 0; else hgt = up * (ph - 0.8) / 0.2;
      cr.h = hgt;
      var bottom = cr.y - hgt;           // y of the block's lower face
      if (Math.abs(p.x - cr.x) < 12 + BALL - 2 && p.y - BALL < bottom && p.y + BALL > bottom - 30 && p.mode !== 'loop') {
        if (hgt < 30) hurt({ x: cr.x });
      }
      if (cr.lastH > 6 && hgt <= 2 && Math.abs(cr.x - (camX + W / 2)) < W) { R.sfx.tone(90, 0.12, { type: 'square', vol: 0.1, slide: 45 }); R.fx.shake(1.5, 0.12); }
      cr.lastH = hgt;
    }
    // checkpoints
    for (i = 0; i < LV.checks.length; i++) {
      var ck = LV.checks[i];
      if (!ck.on && p.x > ck.x) { ck.on = true; R.sfx.play('select'); R.fx.text(ck.x - camX, ck.y - 36 - camY, 'CHECKPOINT', '#7cff6a'); R.fx.burst(ck.x - camX, ck.y - 18 - camY, { n: 10, color: ['#7cff6a', '#ffffff'], speed: 50, life: 0.5, size: 1 }); }
    }
    // enemies
    var ball = isBall();
    for (i = 0; i < LV.enemies.length; i++) {
      var e = LV.enemies[i]; if (!e.alive) continue;
      e.t += dt;
      if (e.kind === 'fly') { e.x += e.dir * 34 * dt; if (e.x > e.x1) e.dir = -1; else if (e.x < e.x0) e.dir = 1; e.y = e.by + Math.sin(e.t * 3) * 9; }
      else { var sp2 = e.kind === 'rover' ? 30 : 26; e.x += e.dir * sp2 * dt; if (e.x > e.x1) e.dir = -1; else if (e.x < e.x0) e.dir = 1; var eg = gh(e.x); if (eg < INF) e.y = eg - 5; }
      if (Math.abs(e.x - p.x) < BALL + e.w / 2 - 1 && Math.abs(e.y - p.y) < BALL + e.h / 2 - 1) {
        if (ball) {
          e.alive = false; kills++; R.addScore(100); R.sfx.play('explode'); R.vibrate(20);
          R.fx.burst(e.x - camX, e.y - camY, { n: 12, color: e.kind === 'fly' ? ['#ffd23a', '#ffffff', '#2a1a08'] : e.kind === 'rover' ? ['#9aa4b8', '#ff8a1e', '#ffffff'] : ['#e8343c', '#ffffff', '#ff8a8a'], speed: 80, life: 0.5, size: 2, gravity: 60 });
          R.fx.text(e.x - camX, e.y - 14 - camY, '+100', '#ffec27');
          if (p.mode === 'air' && p.vy > 0) { p.vy = -190; p.jumping = false; }
          gemCount++; totalGems++;
          if (totalGems >= 100) R.achieve('gem-hoarder');
        } else hurt(e);
      }
    }
    // finish
    if (p.x >= LV.finishX && p.mode !== 'clear') {
      p.mode = 'clear'; phase = 'clear'; tallyT = 0; p.loop = null; p.charging = false;
      if (p.surf !== 'plat') p.gs = Math.max(80, Math.abs(p.gs || p.vx || 100));
      var tb = Math.max(0, Math.round((90 - zoneTime) * 20)), gb = gemCount * 25;
      R.addScore(tb + gb + 500); R.sfx.play('win'); R.vibrate(60);
      setBanner('ZONE CLEAR!', '+' + (tb + gb + 500), 3.2);
      R.fx.burst(LV.finishX - camX, p.y - 20 - camY, { n: 24, color: ['#ffd23a', '#ff5ad2', '#3de2ff', '#7cff6a', '#ffffff'], speed: 110, life: 0.9, size: 2, gravity: 40 });
    }
    void d2; void r;
  }

  function clearStep(dt) {
    tallyT += dt;
    p.rot += p.gs * dt / BALL;
    if (p.mode === 'clear') {
      p.gs = Math.max(0, p.gs - 60 * dt);
      var nx = p.x + p.gs * dt, g = gh(nx);
      if (g < INF) { p.x = nx; p.y = g - BALL * Math.sqrt(1 + Math.pow(slopeAt(nx), 2)); }
      if (Math.random() < 0.15) R.fx.burst(LV.finishX - camX + (Math.random() - 0.5) * 80, p.y - 40 - Math.random() * 40 - camY, { n: 10, color: ['#ffd23a', '#ff5ad2', '#3de2ff', '#7cff6a', '#ffffff'], speed: 70, life: 0.7, gravity: 50, size: 2 });
    }
    if (tallyT > 2.6) fade = Math.min(1, (tallyT - 2.6) / 0.5);
    if (tallyT > 3.2) {
      if (zone < ZONES.length - 1) { loadZone(zone + 1); }
      else { R.achieve('all-zones'); R.gameOver({ win: true }); tallyT = -99; }
    }
  }

  function updateCamera(dt) {
    var v = p.mode === 'air' ? p.vx : p.mode === 'loop' ? 0 : p.gs || 0;
    camV += (v - camV) * Math.min(1, dt * 3.5);
    var look = clamp(camV * 0.32, -52, 52);
    var tx = clamp(p.x + look - W * 0.5, 0, LV.w - W);
    camX += (tx - camX) * Math.min(1, dt * (5 + Math.abs(camV) * 0.02));
    if (p.mode === 'dead') return;
    var ty = camTargetY();
    camY += (ty - camY) * Math.min(1, dt * 4.5);
  }

  /* ------------------------------------------------------------------------ game */
  R.game({
    layout: 'full', size: [W, H], bg: '#2f8fe8', music: 'space',

    _dbg: function () { return { SPR: SPR, ORB: ORB, p: p, LV: LV, zone: zone, lives: lives, gems: gemCount, camX: camX, camY: camY, loose: loose, phase: phase, loadZone: loadZone, ZONES: ZONES, kills: kills, die: die, hurt: hurt }; }, /*DBG*/

    init: function () { buildSprites(); },

    reset: function () {
      lives = 3; R.lives = 3; R.score = 0; gemCount = 0; totalGems = 0; kills = 0; topSpeedHit = false; clock = 0; shakeT = 0; needBanner = true;
      loadZone(0); fade = 0; bannerT = 0;
    },

    update: function (dt) {
      clock += dt;
      if (needBanner) { needBanner = false; setBanner('ZONE 1', ZONES[0].name, 2.4); }
      if (bannerT > 0) bannerT -= dt;
      if (loopMsg > 0) loopMsg -= dt;
      if (fade > 0 && phase !== 'clear') fade = Math.max(0, fade - dt * 2);
      zoneTime += dt;
      updatePlayer(dt);
      updateCamera(dt);
      // speed streaks
      var sp = p.mode === 'air' ? Math.abs(p.vx) : Math.abs(p.gs || 0);
      if (sp > 190 && p.mode !== 'dead' && Math.random() < 0.7) speedFx.push({ x: p.x - sgn(p.mode === 'air' ? p.vx : p.gs) * 6, y: p.y + (Math.random() - 0.5) * 10, t: 0 });
      for (var i = speedFx.length - 1; i >= 0; i--) { speedFx[i].t += dt; if (speedFx[i].t > 0.25) speedFx.splice(i, 1); }
    },

    render: function (ctx, w, h) {
      var cx = Math.round(camX), cy = Math.round(camY);
      drawBackdrop(ctx, cx, cy);
      drawDecor(ctx, cx, cy);
      drawLoops(ctx, cx, cy);
      drawGround(ctx, cx, cy);
      drawObjects(ctx, cx, cy);
      drawPlayer(ctx, cx, cy);
      drawHud(ctx, w, h);
    }
  });

  /* --------------------------------------------------------------------- drawing */
  function drawBackdrop(ctx, cx, cy) {
    var B = BGS[LV.theme], t = LV.theme, off, oy, i, k;
    ctx.drawImage(B.sky, 0, 0);
    if (t === 0) {            // floating islands drift above the far mesas
      for (i = 0; i < 4; i++) {
        var ix = Math.floor(((i * 120 - cx * 0.1 - clock * 2) % (W + 120) + W + 120) % (W + 120)) - 60, iy = 38 + (i * 41) % 62 + Math.round(Math.sin(clock * 0.7 + i * 1.9) * 3 - (cy - 40) * 0.06);
        ctx.drawImage(SPR.island[i % 2], ix, iy);
      }
    }
    if (t === 2) {            // clock faces and slow cogs behind the far skyline
      for (i = 0; i < 2; i++) {
        var kx = ((i * 160 - cx * 0.12) % (W + 160) + W + 160) % (W + 160) - 70, ky = 34 + i * 62 - (cy - 40) * 0.1;
        ctx.drawImage(SPR.clock, Math.round(kx), Math.round(ky));
        var hx = kx + 32, hy = ky + 32, ang = clock * (i ? 0.25 : 0.12);
        ctx.fillStyle = '#e8d8b0';
        for (k = 0; k < 14; k++) ctx.fillRect(Math.round(hx + Math.sin(ang * 0.08 + 1) * k * 1.8), Math.round(hy - Math.cos(ang * 0.08 + 1) * k * 1.8), 2, 2);
        for (k = 0; k < 22; k++) ctx.fillRect(Math.round(hx + Math.sin(ang) * k * 1.4), Math.round(hy - Math.cos(ang) * k * 1.4), 1, 1);
        ctx.fillStyle = '#ffb040'; ctx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
      }
    }
    oy = Math.round(-30 - (cy - 40) * 0.1);
    off = -(Math.floor(cx * 0.12) % 256); ctx.drawImage(B.far, off, oy); ctx.drawImage(B.far, off + 256, oy);
    if (t === 2) {
      for (i = 0; i < 3; i++) {
        var gx = ((i * 140 - cx * 0.2) % (W + 120) + W + 120) % (W + 120) - 40, gy = 70 + i * 48 - (cy - 40) * 0.14;
        ctx.save(); ctx.translate(Math.round(gx) + 36, Math.round(gy) + 36); ctx.rotate(clock * (i % 2 ? -0.4 : 0.3)); ctx.drawImage(SPR.cog[i % 2], -SPR.cog[i % 2].width / 2, -SPR.cog[i % 2].height / 2); ctx.restore();
      }
    }
    oy = Math.round(-30 - (cy - 40) * 0.22);
    off = -(Math.floor(cx * 0.3) % 256); ctx.drawImage(B.mid, off, oy); ctx.drawImage(B.mid, off + 256, oy);
    if (t === 0 && B.hubs) {  // windmill sails
      for (k = 0; k < 2; k++) for (i = 0; i < B.hubs.length; i++) {
        var hx2 = off + k * 256 + B.hubs[i].x, hy2 = oy + B.hubs[i].y;
        if (hx2 < -30 || hx2 > W + 30) continue;
        var wa = clock * (0.5 + i * 0.12) + i;
        for (var bl = 0; bl < 4; bl++) {
          var a2 = wa + bl * Math.PI / 2, ca = Math.cos(a2), sa = Math.sin(a2);
          ctx.fillStyle = '#5a2a2a'; for (var q = 3; q < 22; q += 1) ctx.fillRect(Math.round(hx2 + ca * q), Math.round(hy2 + sa * q), 1, 1);
          ctx.fillStyle = '#f0d8a8';
          for (q = 8; q < 22; q += 1) for (var wv = 1; wv < 5; wv++) ctx.fillRect(Math.round(hx2 + ca * q - sa * wv), Math.round(hy2 + sa * q + ca * wv), 1, 1);
        }
        ctx.fillStyle = '#3a1a14'; ctx.fillRect(Math.round(hx2) - 2, Math.round(hy2) - 2, 4, 4);
      }
      // drifting autumn leaves
      for (i = 0; i < 16; i++) {
        var lx = ((i * 53 + clock * (14 + i % 5 * 3) - cx * 0.5) % (W + 20) + W + 20) % (W + 20) - 10, ly = ((i * 37 + clock * (20 + i % 4 * 5)) % (H + 20)) - 10 + Math.sin(clock * 2 + i) * 4;
        ctx.fillStyle = ['#e8501a', '#ffb030', '#c82a1a', '#ffd860'][i % 4]; ctx.fillRect(Math.round(lx), Math.round(ly), 2, 2); ctx.fillRect(Math.round(lx) + 1, Math.round(ly) + 1, 1, 1);
      }
    }
    if (B.ceil) { off = -(Math.floor(cx * 0.5) % 256); ctx.drawImage(B.ceil, off, 0); ctx.drawImage(B.ceil, off + 256, 0); }
    if (t === 1) {            // pulsing glow of the big mushrooms + rising spores
      for (k = 0; k < 2; k++) for (i = 0; i < B.glows.length; i++) {
        var gx2 = -(Math.floor(cx * 0.3) % 256) + k * 256 + B.glows[i].x, gy2 = Math.round(-30 - (cy - 40) * 0.22) + B.glows[i].y;
        if (gx2 < -50 || gx2 > W + 50) continue;
        ctx.globalAlpha = 0.1 + 0.07 * Math.sin(clock * 1.6 + i * 2); ctx.fillStyle = B.glows[i].c; ctx.beginPath(); ctx.arc(gx2, gy2 + 4, 30, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      }
      for (var j = 0; j < 20; j++) {
        var fx = ((j * 47 + Math.sin(clock * 0.8 + j) * 10 - cx * 0.4) % (W + 20) + W + 20) % (W + 20) - 10, fy = H - ((clock * (8 + j % 4 * 3) + j * 29) % (H + 10));
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(clock * 2 + j); ctx.fillStyle = ['#6af0ff', '#b0ff6a', '#ff8ae0'][j % 3]; ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2); ctx.globalAlpha = 1;
      }
    }
    if (t === 2) {            // steam drifting up past the pipes
      for (var m = 0; m < 7; m++) { var sx = ((m * 62 - cx * 0.25) % (W + 80) + W + 80) % (W + 80), sy = H - 60 - ((clock * 14 + m * 17) % 120); ctx.globalAlpha = 0.14; ctx.fillStyle = '#e8e0d0'; ctx.fillRect(Math.round(sx), Math.round(sy), 7 + (m % 3) * 3, 5); ctx.globalAlpha = 1; }
    }
  }

  function decorAt(i) { return hash(i * 31 + 7); }
  function drawDecor(ctx, cx, cy) {
    var t = LV.theme, x0 = Math.floor(cx / 36) - 1, x1 = Math.floor((cx + W) / 36) + 1, i, x, g, sx, sy, hv, k;
    for (i = x0; i <= x1; i++) {
      hv = decorAt(i); if (hv > 0.6) continue;
      x = i * 36 + Math.floor(hv * 30); g = gh(x); if (g >= INF) continue;
      sx = x - cx; sy = Math.round(g - cy);
      if (t === 0) {
        if (hv < 0.18) {        // square straw bale with twine
          ctx.fillStyle = '#5a3a14'; ctx.fillRect(sx - 10, sy - 12, 21, 12); ctx.fillStyle = '#c8a050'; ctx.fillRect(sx - 9, sy - 11, 19, 10);
          ctx.fillStyle = '#e0c070'; ctx.fillRect(sx - 9, sy - 11, 19, 2); ctx.fillStyle = '#a07a30'; for (k = 0; k < 4; k++) ctx.fillRect(sx - 7 + k * 5, sy - 8, 3, 1);
          ctx.fillStyle = '#6a3a1a'; ctx.fillRect(sx - 4, sy - 11, 1, 10); ctx.fillRect(sx + 4, sy - 11, 1, 10);
        } else if (hv < 0.36) { // rust shrub
          ctx.fillStyle = '#a03a1a'; ctx.fillRect(sx - 6, sy - 4, 13, 4); ctx.fillStyle = '#d8561e'; ctx.fillRect(sx - 4, sy - 8, 9, 5); ctx.fillStyle = '#f0903a'; ctx.fillRect(sx - 2, sy - 10, 5, 3); ctx.fillStyle = '#ffd060'; ctx.fillRect(sx - 3, sy - 6, 2, 1);
        } else if (hv < 0.48) { // fence run
          ctx.fillStyle = '#7a5a3a'; ctx.fillRect(sx - 10, sy - 9, 2, 9); ctx.fillRect(sx + 9, sy - 9, 2, 9); ctx.fillRect(sx - 10, sy - 8, 21, 1); ctx.fillRect(sx - 10, sy - 4, 21, 1); ctx.fillStyle = '#a8825a'; ctx.fillRect(sx - 10, sy - 9, 1, 9);
        } else {                // wildflower stalks
          for (k = 0; k < 3; k++) { ctx.fillStyle = '#7a8a2a'; ctx.fillRect(sx + k * 3, sy - 7 - k, 1, 7 + k); ctx.fillStyle = k % 2 ? '#c890ff' : '#ffffff'; ctx.fillRect(sx + k * 3 - 1, sy - 9 - k, 3, 2); }
        }
      } else if (t === 1) {
        var cc = ['#6af0ff', '#ff6ad8', '#b0ff6a', '#ffcc33'][Math.floor(hv * 40) % 4], hh = 5 + Math.floor(hv * 18), pu = 0.5 + 0.5 * Math.sin(clock * 2.4 + i);
        ctx.globalAlpha = 0.12 + 0.12 * pu; ctx.fillStyle = cc; ctx.beginPath(); ctx.arc(sx, sy - hh - 2, hh + 7, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#a8c8c0'; ctx.fillRect(sx - 1, sy - hh, 3, hh);
        ctx.fillStyle = cc; ctx.fillRect(sx - 5, sy - hh - 3, 11, 3); ctx.fillRect(sx - 3, sy - hh - 5, 7, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 2, sy - hh - 4, 2, 1); ctx.fillRect(sx + 2, sy - hh - 2, 1, 1);
      } else {
        if (hv < 0.22) {        // half-buried cog
          ctx.save(); ctx.translate(sx, sy - 2); ctx.rotate(clock * (i % 2 ? 0.8 : -0.8)); ctx.drawImage(SPR.cog[1], -SPR.cog[1].width / 2, -SPR.cog[1].height / 2, SPR.cog[1].width * 0.6, SPR.cog[1].height * 0.6); ctx.restore();
          ctx.fillStyle = '#8a5c36'; ctx.fillRect(sx - 12, sy, 24, 2);
        } else if (hv < 0.42) { // brass lamp
          ctx.fillStyle = '#6a5a40'; ctx.fillRect(sx, sy - 18, 2, 18); ctx.fillStyle = '#b08a40'; ctx.fillRect(sx - 3, sy - 22, 8, 4); ctx.fillStyle = '#ffd890'; ctx.fillRect(sx - 2, sy - 20, 6, 2);
          ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffc060'; ctx.beginPath(); ctx.arc(sx + 1, sy - 19, 14, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        } else {                // steam vent
          ctx.fillStyle = '#5a4026'; ctx.fillRect(sx - 4, sy - 7, 9, 7); ctx.fillStyle = '#b08a40'; ctx.fillRect(sx - 4, sy - 7, 9, 2);
          ctx.globalAlpha = 0.3; ctx.fillStyle = '#ffffff'; for (k = 0; k < 3; k++) ctx.fillRect(sx - 1 + Math.round(Math.sin(clock * 3 + k + i) * 2), sy - 11 - ((clock * 16 + k * 6 + i * 3) % 18), 3 + k, 3); ctx.globalAlpha = 1;
        }
      }
    }
  }

  function drawLoops(ctx, cx, cy) {
    var th = THEMES[LV.theme], i, k;
    for (i = 0; i < LV.loops.length; i++) {
      var L = LV.loops[i], sx = L.cx - cx, sy = L.y0 - LR - cy;
      if (sx < -LR - 10 || sx > W + LR + 10) continue;
      ctx.globalAlpha = 0.35; disc(ctx, sx, sy, LR - 2, '#000000'); ctx.globalAlpha = 1;
      // ring: track band just outside the ball path (dark base, body, highlight)
      for (k = 0; k < 170; k++) {
        var a = 0.5 + (Math.PI * 2 - 1.0) * k / 169, rx = Math.sin(a), ry = Math.cos(a);
        var px = Math.round(sx + rx * (LR + 3)), py = Math.round(sy + ry * (LR + 3));
        ctx.fillStyle = th.top[2]; ctx.fillRect(px - 3, py - 3, 7, 7);
        px = Math.round(sx + rx * (LR + 2)); py = Math.round(sy + ry * (LR + 2));
        ctx.fillStyle = th.top[0]; ctx.fillRect(px - 2, py - 2, 5, 5);
        if (k % 3 === 0) { px = Math.round(sx + rx * (LR - 0.5)); py = Math.round(sy + ry * (LR - 0.5)); ctx.fillStyle = th.top[1]; ctx.fillRect(px - 1, py - 1, 2, 2); }
      }
    }
  }

  function drawGround(ctx, cx, cy) {
    var th = THEMES[LV.theme], tex = TEX[LV.theme], x, wx, g, sy, bh = th.band, h0;
    var tint = LV.theme;
    for (x = 0; x < W; x += STEP) {
      wx = cx + x; g = gh(wx + 1); if (g >= INF) continue;
      sy = Math.round(g - cy); if (sy >= H) continue;
      if (sy < -40) sy = -40;
      var jv = hash((wx >> 1) * 3 + LV.theme * 11), ex = LV.theme === 0 ? (jv < 0.45 ? 2 : jv < 0.7 ? 1 : 0) : LV.theme === 1 ? (jv < 0.35 ? 1 : 0) : (((wx >> 2) & 1) ? 1 : 0);
      ctx.fillStyle = th.top[2]; ctx.fillRect(x, sy - ex, STEP, bh + 2 + ex);
      ctx.fillStyle = th.top[0]; ctx.fillRect(x, sy - ex, STEP, bh + ex);
      ctx.fillStyle = th.top[1]; ctx.fillRect(x, sy - ex, STEP, 1);
      h0 = sy + bh + 2;
      if (h0 < H) ctx.drawImage(tex, (wx & 255), ((h0 + cy) & 255), STEP, H - h0, x, h0, STEP, H - h0);
    }
    // conveyors
    for (var ci = 0; ci < LV.convs.length; ci++) {
      var cv = LV.convs[ci], a = cv.x0 - cx, b = cv.x1 - cx;
      if (b < 0 || a > W) continue;
      for (x = Math.max(0, Math.floor(a)); x < Math.min(W, b); x += 2) {
        var gy = gh(cx + x); if (gy >= INF) continue; var yy = Math.round(gy - cy);
        ctx.fillStyle = '#2a1c10'; ctx.fillRect(x, yy - 1, 2, 4);
        if ((((cx + x) - Math.floor(clock * 40 * cv.dir)) & 7) < 3) { ctx.fillStyle = '#e0bc70'; ctx.fillRect(x, yy - 1, 2, 2); }
      }
    }
    void tint;
    // platforms
    for (var i = 0; i < LV.plats.length; i++) {
      var pl = LV.plats[i], px0 = Math.round(pl.x0 - cx), px1 = Math.round(pl.x1 - cx), py = Math.round(pl.y - cy);
      if (px1 < 0 || px0 > W) continue;
      ctx.fillStyle = th.top[2]; ctx.fillRect(px0, py, px1 - px0, 7);
      ctx.fillStyle = th.top[0]; ctx.fillRect(px0, py, px1 - px0, 3);
      ctx.fillStyle = th.top[1]; ctx.fillRect(px0, py, px1 - px0, 1);
      ctx.drawImage(tex, 0, 8, Math.min(px1 - px0, 250), 3, px0, py + 3, Math.min(px1 - px0, 250), 3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px0 + 2, py + 7, px1 - px0 - 4, 2);
    }
  }

  function drawObjects(ctx, cx, cy) {
    var i, k, x, y, T = LV.theme;
    // finish gate
    var fx = LV.finishX - cx, fy = Math.round(LV.near(LV.finishX) - cy);
    if (fx > -30 && fx < W + 30) {
      var gcol = THEMES[T].gem;
      ctx.fillStyle = '#d8dcea'; ctx.fillRect(fx - 22, fy - 58, 4, 58); ctx.fillRect(fx + 20, fy - 58, 4, 58);
      ctx.fillStyle = '#6a7090'; ctx.fillRect(fx - 19, fy - 58, 1, 58); ctx.fillRect(fx + 20, fy - 58, 1, 58);
      ctx.fillStyle = gcol.p; ctx.fillRect(fx - 24, fy - 64, 8, 6); ctx.fillRect(fx + 18, fy - 64, 8, 6); ctx.fillStyle = gcol.h; ctx.fillRect(fx - 23, fy - 63, 3, 2); ctx.fillRect(fx + 19, fy - 63, 3, 2);
      ctx.fillStyle = '#d8dcea'; ctx.fillRect(fx - 20, fy - 58, 42, 3);
      for (k = 0; k < 7; k++) { var pw = 3 - Math.abs(k - 3) * 0.5; ctx.fillStyle = k % 2 ? gcol.P : gcol.p; for (var pr = 0; pr < 9; pr++) { var ww = Math.max(1, Math.round(5 - pr * 0.5)); ctx.fillRect(fx - 19 + k * 6 + Math.floor((6 - ww) / 2), fy - 55 + pr + Math.round(Math.sin(clock * 5 + k) * (pr > 4 ? 1 : 0)), ww, 1); } void pw; }
      var pulse = 0.5 + 0.5 * Math.sin(clock * 6);
      ctx.globalAlpha = 0.12 + 0.14 * pulse; ctx.fillStyle = gcol.h; ctx.fillRect(fx - 18, fy - 44, 36, 44); ctx.globalAlpha = 1;
      if (p.mode !== 'clear') { ctx.fillStyle = gcol.h; ctx.fillRect(fx - 1, fy - 36 + Math.round(Math.sin(clock * 4) * 3), 3, 10); }
    }
    // checkpoints
    for (i = 0; i < LV.checks.length; i++) {
      var ck = LV.checks[i]; x = Math.round(ck.x - cx); y = Math.round(ck.y - cy);
      if (x < -10 || x > W + 10) continue;
      ctx.fillStyle = '#c8ccd8'; ctx.fillRect(x - 1, y - 24, 3, 24); ctx.fillStyle = '#5a6076'; ctx.fillRect(x + 1, y - 24, 1, 24);
      ctx.fillStyle = ck.on ? '#7cff6a' : '#ff4a4a'; ctx.fillRect(x - 3, y - 30, 7, 7); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 29, 2, 2);
      if (ck.on) { ctx.globalAlpha = 0.25; ctx.fillStyle = '#7cff6a'; ctx.fillRect(x - 7, y - 34, 15, 15); ctx.globalAlpha = 1; }
    }
    // pads
    for (i = 0; i < LV.pads.length; i++) {
      var pd = LV.pads[i]; x = Math.round(pd.x - cx - pd.w / 2); y = Math.round(pd.y - cy);
      if (x < -30 || x > W + 10) continue;
      ctx.fillStyle = '#1c1c28'; ctx.fillRect(x, y - 3, pd.w, 4); ctx.fillStyle = pd.t > 0 ? '#ffffff' : '#ffd23a'; ctx.fillRect(x + 1, y - 3, pd.w - 2, 1);
      var sh = Math.floor(clock * 14) % 8;
      for (k = 0; k < 3; k++) { var ax = x + 3 + ((k * 7 + sh * pd.dir + 24) % 21); ctx.fillStyle = '#3de2ff'; ctx.fillRect(ax, y - 2, 1, 1); ctx.fillRect(ax + pd.dir, y - 2, 1, 1); }
      ctx.fillStyle = '#3de2ff'; for (k = 0; k < 3; k++) { var ax2 = x + 4 + k * 7; ctx.fillRect(ax2 + (pd.dir > 0 ? 0 : 2), y - 2, 1, 1); ctx.fillRect(ax2 + (pd.dir > 0 ? 1 : 1), y - 2, 1, 1); }
    }
    // springs
    for (i = 0; i < LV.springs.length; i++) {
      var s = LV.springs[i]; x = Math.round(s.x - cx); y = Math.round(s.y - cy);
      if (x < -20 || x > W + 20) continue;
      var comp = s.t > 0 ? 1 : 0, hgt = comp ? 3 : 8, col = s.kind === 'r' ? '#ff3d4a' : '#5be04a', colD = s.kind === 'r' ? '#a01020' : '#2e9a3a';
      ctx.fillStyle = '#1c1c28'; ctx.fillRect(x - 7, y - 2, 14, 2);
      ctx.fillStyle = '#9aa0b4'; for (k = 0; k < 3; k++) ctx.fillRect(x - 4 + k * 3 + (comp ? 0 : 0), y - 2 - hgt + (k % 2), 2, hgt);
      ctx.fillStyle = colD; ctx.fillRect(x - 8, y - 4 - hgt, 16, 4); ctx.fillStyle = col; ctx.fillRect(x - 8, y - 4 - hgt, 16, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 6, y - 4 - hgt, 3, 1);
    }
    // spikes
    for (i = 0; i < LV.spikes.length; i++) {
      var sk = LV.spikes[i]; x = Math.round(sk.x - cx - sk.n * 4); y = Math.round(sk.y - cy);
      if (x < -40 || x > W + 10) continue;
      for (k = 0; k < sk.n; k++) {
        var sx2 = x + k * 8;
        ctx.fillStyle = '#7a8098'; for (var r = 0; r < 8; r++) { var sw0 = Math.min(8, 1 + r); ctx.fillRect(sx2 + 4 - (sw0 >> 1), y - 8 + r, sw0, 1); }
        ctx.fillStyle = '#e8ecf5'; ctx.fillRect(sx2 + 3, y - 8, 2, 3);
      }
      ctx.fillStyle = '#3a3f55'; ctx.fillRect(x - 1, y - 1, sk.n * 8 + 2, 2);
    }
    // crushers
    for (i = 0; i < LV.crushers.length; i++) {
      var cr = LV.crushers[i]; x = Math.round(cr.x - cx); y = Math.round(cr.y - cy);
      if (x < -30 || x > W + 30) continue;
      var top = y - 120, bot = y - Math.round(cr.h);
      ctx.fillStyle = '#5a4026'; ctx.fillRect(x - 3, top, 6, bot - top); ctx.fillStyle = '#a07a3a'; ctx.fillRect(x - 3, top, 2, bot - top);
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(x - 14, top - 6, 28, 10); ctx.fillStyle = '#b08a40'; ctx.fillRect(x - 14, top - 6, 28, 2);
      ctx.fillStyle = '#7a5a30'; ctx.fillRect(x - 12, bot - 26, 24, 26); ctx.fillStyle = '#d8b068'; ctx.fillRect(x - 12, bot - 26, 24, 2); ctx.fillStyle = '#4a3016'; ctx.fillRect(x - 12, bot - 2, 24, 2);
      ctx.fillStyle = '#e0bc70'; ctx.fillRect(x - 10, bot - 23, 2, 2); ctx.fillRect(x + 8, bot - 23, 2, 2); ctx.fillRect(x - 10, bot - 8, 2, 2); ctx.fillRect(x + 8, bot - 8, 2, 2);
      for (k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#4a3016' : '#d8b068'; ctx.fillRect(x - 12 + k * 4, bot - 6, 4, 4); }
      var warn = cr.h > 30 || (cr.h < 30 && cr.h > 3);
      ctx.fillStyle = warn ? '#ff3d3d' : '#6a1a1a'; ctx.fillRect(x - 2, top - 3, 4, 3);
    }
    // gems
    for (i = 0; i < LV.gems.length; i++) {
      var g = LV.gems[i]; if (g.got) continue;
      x = Math.round(g.x - cx); if (x < -8 || x > W + 8) continue;
      y = Math.round(g.y - cy + Math.sin(clock * 4 + g.ph) * 1.2);
      R.draw.sprite(ctx, SPR.gems[T], x - 6, y - 6);
      if (Math.floor(clock * 3 + g.ph) % 5 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 3, 1, 1); ctx.fillRect(x + 2, y + 1, 1, 1); }
    }
    for (i = 0; i < loose.length; i++) {
      var l = loose[i]; if (l.life - l.t < 1 && Math.floor(clock * 14) % 2) continue;
      R.draw.sprite(ctx, SPR.gems[T], Math.round(l.x - cx) - 6, Math.round(l.y - cy) - 6);
    }
    // enemies
    for (i = 0; i < LV.enemies.length; i++) {
      var e = LV.enemies[i]; if (!e.alive) continue;
      x = Math.round(e.x - cx); if (x < -20 || x > W + 20) continue;
      y = Math.round(e.y - cy);
      var fl = Math.floor(clock * 8 + e.t) & 1, spr;
      if (e.kind === 'bug') spr = SPR.bug[T][fl]; else if (e.kind === 'fly') spr = SPR.fly[T][fl]; else spr = SPR.rover[fl];
      R.draw.sprite(ctx, spr, x - (spr.width >> 1), y - (spr.height >> 1) - (e.kind === 'fly' ? 0 : 0), e.dir < 0 ? { flipX: true } : undefined);
      if (e.kind === 'fly') { ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.fillRect(x - 4, Math.round(LV.near(e.x) - cy) - 1, 8, 2); ctx.globalAlpha = 1; }
    }
  }

  function drawPlayer(ctx, cx, cy) {
    if (p.inv > 0 && p.mode !== 'dead' && Math.floor(clock * 18) % 2) return;
    var x = Math.round(p.x - cx), y = Math.round(p.y - cy), i;
    // speed streaks
    for (i = 0; i < speedFx.length; i++) {
      var sf = speedFx[i]; ctx.globalAlpha = 0.5 * (1 - sf.t / 0.25); ctx.fillStyle = '#c8f4ff'; ctx.fillRect(Math.round(sf.x - cx - 4), Math.round(sf.y - cy), 8, 1); ctx.globalAlpha = 1;
    }
    // shadow on ground
    var gg = gh(p.x);
    if (gg < INF && p.mode === 'air') { var dh = gg - (p.y + BALL); ctx.globalAlpha = clamp(0.4 - dh / 200, 0.1, 0.4); ctx.fillStyle = '#000'; ctx.fillRect(x - 5, Math.round(gg - cy) - 1, 10, 2); ctx.globalAlpha = 1; }
    var spin = (p.mode === 'ground' && (p.rolling || p.charging)) || p.mode === 'loop' || (p.mode === 'air' && (p.jumping || p.ballAir));
    var fi;
    if (spin) {
      if (p.charging) fi = Math.floor(clock * 30) % 12; else fi = Math.floor(clock * 30) % 12;
      R.draw.sprite(ctx, ORB.spin[fi], x - 8, y - 8);
      if (Math.abs(p.gs || 0) > 150 || p.mode === 'loop') { ctx.globalAlpha = 0.3; ctx.strokeStyle = '#18e0c8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      if (p.charging) { ctx.globalAlpha = 0.4 + 0.3 * p.charge; ctx.fillStyle = '#ffd23a'; ctx.fillRect(x - 9, y + 9, Math.round(18 * p.charge), 2); ctx.globalAlpha = 1; }
    } else {
      var ra = ((p.rot % (Math.PI * 2 / 3)) + Math.PI * 2 / 3) % (Math.PI * 2 / 3);
      fi = Math.floor(ra / (Math.PI * 2 / 3) * 12) % 12;
      R.draw.sprite(ctx, ORB.run[fi], x - 8, y - 8);
      var f = p.face >= 0 ? 1 : -1, hurtF = p.hurtT > 0;
      ctx.fillStyle = '#0a1830'; ctx.fillRect(x - 5 + f, y - 5, 9, 5); ctx.fillRect(x - 4 + f, y - 6, 7, 1);
      ctx.fillStyle = (hurtF || p.mode === 'dead') ? '#ff5a5a' : '#ffb020'; ctx.fillRect(x - 3 + f + (f > 0 ? 2 : 0), y - 4, 2, 3); ctx.fillRect(x + 1 + f + (f > 0 ? 1 : -1) , y - 4, 2, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3 + f + (f > 0 ? 2 : 0), y - 4, 1, 1);
      var sw = Math.round(Math.sin(clock * 9) * (p.mode === 'ground' ? Math.min(2, Math.abs(p.gs) / 60) : 1) - f * Math.min(2, Math.abs(p.gs || p.vx || 0) / 100));
      ctx.fillStyle = '#c8ccd8'; ctx.fillRect(x - 1 + sw, y - 11, 1, 5); ctx.fillStyle = '#ff8a1e'; ctx.fillRect(x - 2 + sw, y - 13, 3, 3);
    }
  }

  function drawHud(ctx, w, h) {
    R.draw.topBar(ctx);
    R.draw.sprite(ctx, SPR.gems[LV.theme], 3, 14);
    R.draw.text(ctx, 'x' + gemCount, 17, 16, { size: 8, color: THEMES[LV.theme].gem.h, shadow: '#000' });
    var tm = Math.floor(zoneTime), mm = Math.floor(tm / 60);
    R.draw.text(ctx, mm + ':' + U.pad(tm % 60, 2), w - 4, 16, { size: 8, color: '#ffffff', align: 'right', shadow: '#000' });
    // speed gauge
    var sp = Math.abs(p.mode === 'air' ? p.vx : p.mode === 'loop' ? p.gs : p.gs || 0), f = clamp(sp / TOP, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(3, h - 11, 52, 8);
    ctx.fillStyle = '#1a2a3a'; ctx.fillRect(4, h - 10, 50, 6);
    ctx.fillStyle = f > 0.85 ? '#ffd23a' : f > 0.55 ? '#7cff6a' : '#3de2ff'; ctx.fillRect(4, h - 10, Math.round(50 * f), 6);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(4, h - 10, Math.round(50 * f), 1);
    var lm = 4 + Math.round(50 * LOOP_MIN / TOP); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(lm, h - 10, 1, 6);
    R.draw.text(ctx, 'SPD', 58, h - 10, { size: 6, color: '#9fb2d0' });
    if (loopMsg > 0) R.draw.text(ctx, 'LOOP! +200', w / 2, 70, { size: 8, color: '#ffec27', align: 'center', shadow: '#000' });
    if (bannerT > 0 && banner) {
      var a = Math.min(1, bannerT * 2.5);
      ctx.globalAlpha = 0.55 * a; ctx.fillStyle = '#000'; ctx.fillRect(0, 84, w, 36); ctx.globalAlpha = a;
      R.draw.text(ctx, banner[0], w / 2, 90, { size: 8, color: '#ffec27', align: 'center', shadow: '#000' });
      R.draw.text(ctx, banner[1], w / 2, 104, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }
})();
