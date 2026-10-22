/* Hover Rally — pseudo-3D hover-craft racing: curves, hills, banked turns, boost, airbrake and recharge strips (Retro SDK) */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164, HALF = 68, HZ = 58, PIV = 142;
  var Y0 = H - HZ, ZN = 1, SEGL = 0.07, DRAW = 150, X0 = 76, BAND = 4, LV = 7;
  var CRAFT_D = 4.5, LAPS = 3, LIM = 0.82, PAD_LEN = 40;
  var CRUISE = 50, BOOST = 69, BRAKE_SPD = 24;
  var PTS = [1000, 700, 500, 350, 200, 120, 60, 30];
  var ORD = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function fogArr(col, fog) { var a = hex(col), f = hex(fog), out = [], l; for (l = 0; l <= LV; l++) out.push(rgb(mixc(a, f, l / LV * 0.94))); return out; }
  function layer(w, h, fn) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
  function wrapN(v, n) { return ((v % n) + n) % n; }

  /* ------------------------------------------------------------------ themes */
  var THEMES = [
    { name: 'NEON CITY', accent: '#3de2ff',
      sky: ['#06021a', '#0b0430', '#120640', '#1d0856', '#2e0a6a', '#46107c', '#6a1888', '#952291', '#c3309a', '#e8509f'],
      fog: '#9a2a98', g: ['#160a37', '#1c0e45'], r: ['#2b2556', '#352d68'], w: ['#ff2fd0', '#3de2ff'],
      lane: '#cfeeff', edge: '#3de2ff', rung: '#8070ff', pad: ['#39ff6a', '#b5ffc8'], pole: '#2a1060' },
    { name: 'CANYON RUN', accent: '#ffa24a',
      sky: ['#35123f', '#561a48', '#7e2149', '#a62e45', '#cc4040', '#e8603a', '#f98a3a', '#ffb04c', '#ffd26e', '#ffe9a0'],
      fog: '#f0a868', g: ['#b0502c', '#a04626'], r: ['#6c5a54', '#76645c'], w: ['#f3e6cf', '#d9482b'],
      lane: '#f7e8c4', edge: '#ffd27a', rung: '#8a7868', pad: ['#39ff6a', '#b5ffc8'], pole: '#6a2e1c' },
    { name: 'ICE FLOW', accent: '#bfe9ff',
      sky: ['#3c93dc', '#58aae6', '#74bdee', '#90cef3', '#aadcf7', '#c1e8fa', '#d6f2fd', '#e6f8ff', '#f2fbff', '#ffffff'],
      fog: '#e8f6ff', g: ['#eaf5ff', '#d6e9f8'], r: ['#78acdc', '#86b8e6'], w: ['#ffffff', '#3a86d8'],
      lane: '#ffffff', edge: '#d5f0ff', rung: '#a8d0f0', pad: ['#39ff6a', '#b5ffc8'], pole: '#5a8cc0' }
  ];

  /* [length, curve, hill] sections, lengths multiplied by `mul`; curves are lateral drift per segment squared, hills in camera heights */
  var TRACKS = [
    { theme: 0, mul: 1.9, pace: 50, grip: 1.0, rbk: 1.0,
      sec: [[40, 0, 0], [60, 0.0012, 0], [50, 0, 0.9], [40, -0.0016, 0.5], [60, 0, -1.5], [50, -0.0018, 0], [30, 0, 0], [60, 0.0013, 0.8], [40, 0.0008, -0.7], [50, -0.0013, 0], [50, 0.0013, 0], [70, 0, 0], [60, 0.0022, 0], [40, 0, -0.4], [60, -0.001, 0], [80, 0, 0]],
      pads: [[0.2, -0.3, 0.3], [0.45, -0.85, -0.25], [0.7, 0.25, 0.85], [0.9, -0.3, 0.3]] },
    { theme: 1, mul: 2.0, pace: 52, grip: 0.9, rbk: 1.1,
      sec: [[40, 0, 0], [50, -0.0014, 0.8], [60, 0.002, 1.4], [40, 0, -1.4], [50, 0.0016, -1.0], [40, -0.0024, 0.5], [50, 0, 1.2], [40, 0.0014, -1.5], [50, -0.001, 0], [40, 0.0026, 0.4], [60, 0, -0.7], [50, -0.0018, 0.6], [50, 0.0012, -0.5], [60, 0, 0]],
      pads: [[0.18, 0.25, 0.85], [0.4, -0.3, 0.3], [0.62, -0.85, -0.25], [0.86, -0.3, 0.3]] },
    { theme: 2, mul: 2.1, pace: 53, grip: 0.5, rbk: 1.2,
      sec: [[50, 0, 0], [90, 0.001, 0.6], [70, 0.0007, 0], [60, -0.0014, -0.5], [90, -0.001, 1.0], [40, 0, -1.0], [80, 0.0015, 0], [60, -0.002, 0.5], [60, 0.0011, -0.6], [70, 0, 0], [80, -0.0012, 0.6], [60, 0.0018, -0.6], [60, 0, 0]],
      pads: [[0.15, -0.3, 0.3], [0.38, 0.25, 0.85], [0.6, -0.85, -0.25], [0.82, -0.3, 0.3]] }
  ];

  var CPU = [
    { n: 'ZIP', col: '#ff3b5c', v: 1.0, ag: 0.3, rb: 1.0 },
    { n: 'AXL', col: '#ff9e3d', v: 0.98, ag: 0.9, rb: 0.8 },
    { n: 'KIRA', col: '#5cff7a', v: 0.96, ag: 0.2, rb: 1.2 },
    { n: 'ORB', col: '#b455ff', v: 0.99, ag: 0.5, rb: 0.9 },
    { n: 'REX', col: '#ff77a8', v: 0.93, ag: 0.8, rb: 1.3 },
    { n: 'JET', col: '#4d8bff', v: 0.95, ag: 0.4, rb: 1.1 },
    { n: 'MOX', col: '#d8e0f0', v: 0.91, ag: 0.6, rb: 1.4 }
  ];
  var PLAYER_COL = '#ffe45e';

  /* ----------------------------------------------------------------- sprites */
  var GW = 24, GH = 20;
  function craftRows(roll) {
    var g = [], x, y, i;
    for (y = 0; y < GH; y++) { g.push([]); for (x = 0; x < GW; x++) g[y].push('.'); }
    function px(x, y, c) { y += 3; if (x >= 0 && x < GW && y >= 0 && y < GH) g[y][x] = c; }
    function bx(x0, y0, x1, y1, c) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) px(xx, yy, c); }
    function bm(x0, y0, x1, y1, c) { bx(x0, y0, x1, y1, c); bx(GW - 1 - x1, y0, GW - 1 - x0, y1, c); }
    bm(1, 4, 3, 8, 'S'); bm(1, 4, 2, 5, 'H'); bm(1, 8, 3, 8, 'T');                  // outer fins
    bx(5, 5, 18, 10, 'B'); bx(7, 3, 16, 5, 'B'); bx(9, 1, 14, 3, 'B');               // hull
    bx(6, 5, 17, 5, 'H'); bx(8, 3, 15, 3, 'H'); bx(10, 1, 13, 1, 'H');               // top highlight
    bx(5, 9, 18, 10, 'S'); bx(8, 7, 15, 7, 'T');                                     // underside + livery stripe
    bm(3, 7, 8, 11, 'G'); bm(3, 7, 4, 10, 'g'); bm(5, 9, 6, 11, 'D');                // thruster pods + nozzles
    bx(10, 0, 13, 0, 'k'); bx(9, 1, 14, 3, 'k'); bx(10, 4, 13, 4, 'K');              // canopy
    px(10, 1, 'w'); px(10, 2, 'w'); px(9, 2, 'w'); px(13, 3, 'K'); px(14, 3, 'K');
    var out = [];
    for (y = 0; y < GH; y++) { out.push([]); for (x = 0; x < GW; x++) out[y].push('.'); }
    for (x = 0; x < GW; x++) {
      var dy = Math.round(roll * (x - 11.5) / 11.5 * 2.4);
      for (y = 0; y < GH; y++) { var ny = y + dy; if (g[y][x] !== '.' && ny >= 0 && ny < GH) out[ny][x] = g[y][x]; }
    }
    var fin = [];
    for (y = 0; y < GH; y++) {
      fin.push('');
      for (x = 0; x < GW; x++) {
        var ch = out[y][x];
        if (ch === '.') {
          if ((x > 0 && out[y][x - 1] !== '.') || (x < GW - 1 && out[y][x + 1] !== '.') || (y > 0 && out[y - 1][x] !== '.') || (y < GH - 1 && out[y + 1][x] !== '.')) ch = 'o';
        }
        fin[y] += ch;
      }
    }
    return fin;
  }
  var S = { craft: [] };
  function buildSprites() {
    var cols = [PLAYER_COL].concat(CPU.map(function (c) { return c.col; }));
    cols.forEach(function (col, ci) {
      var pal = { B: col, H: U.shade(col, 0.45), S: U.shade(col, -0.42), T: ci === 0 ? '#ff3b5c' : '#ffffff', G: '#3a4259', g: '#69728c', D: '#10131c', k: '#8aefff', K: '#1f7a9c', w: '#ffffff', o: '#0b0e14' };
      S.craft[ci] = [];
      for (var r = -2; r <= 2; r++) S.craft[ci][r + 2] = R.sprite(craftRows(r), pal);
    });
  }

  /* -------------------------------------------------------------- backdrops */
  function skyline(LW, h, seed, body, wins, hMin, hMax, wMin, wMax, tops) {
    return layer(LW, h, function (g) {
      var x = 0, i = 0;
      while (x < LW) {
        var bw = wMin + Math.floor(hash(seed + i * 5) * (wMax - wMin + 1)), bh = hMin + Math.floor(hash(seed + i * 7 + 1) * (hMax - hMin));
        g.fillStyle = body; g.fillRect(x, h - bh, bw, bh);
        if (tops && hash(seed + i * 3 + 2) > 0.5) { g.fillStyle = tops[i % tops.length]; g.fillRect(x, h - bh, bw, 1); }
        for (var wy = h - bh + 3; wy < h - 2; wy += 3) for (var wx = x + 1; wx < x + bw - 1; wx += 3) {
          var hv = hash(seed + wx * 13 + wy * 7);
          if (hv > 0.62) { g.fillStyle = wins[Math.floor(hv * 50) % wins.length]; g.fillRect(wx, wy, 1, 1); }
        }
        x += bw + (hash(seed + i * 11) > 0.7 ? 1 : 0); i++;
      }
    });
  }
  function mesas(LW, h, seed, top, band, wMin, wMax, hMin, hMax) {
    return layer(LW, h, function (g) {
      var x = 0, i = 0;
      while (x < LW) {
        var bw = wMin + Math.floor(hash(seed + i * 5) * (wMax - wMin + 1)), bh = hMin + Math.floor(hash(seed + i * 7 + 1) * (hMax - hMin));
        var step = Math.floor(bh * 0.55);
        g.fillStyle = top; g.fillRect(x + 2, h - bh, bw - 4, bh); g.fillRect(x, h - step, bw, step);
        g.fillStyle = band;
        for (var yy = h - bh + 3; yy < h; yy += 4) g.fillRect(x + (yy > h - step ? 0 : 2), yy, bw - (yy > h - step ? 0 : 4), 1);
        x += bw - 1 + Math.floor(hash(seed + i * 9) * 8); i++;
      }
    });
  }
  function peaks(LW, h, seed, body, cap, shade, n) {
    return layer(LW, h, function (g) {
      for (var i = 0; i < n; i++) {
        var cx = (i + 0.3 + hash(seed + i) * 0.4) * LW / n, ph = h * (0.55 + hash(seed + i * 3) * 0.45), hw = ph * (0.8 + hash(seed + i * 5) * 0.5);
        for (var o = -1; o <= 1; o++) {
          var x0 = cx + o * LW;
          g.fillStyle = body; g.beginPath(); g.moveTo(x0 - hw, h); g.lineTo(x0, h - ph); g.lineTo(x0 + hw, h); g.closePath(); g.fill();
          g.fillStyle = shade; g.beginPath(); g.moveTo(x0, h - ph); g.lineTo(x0 + hw, h); g.lineTo(x0 + hw * 0.25, h); g.closePath(); g.fill();
          g.fillStyle = cap; g.beginPath(); g.moveTo(x0, h - ph); g.lineTo(x0 - hw * 0.36, h - ph * 0.62); g.lineTo(x0 - hw * 0.1, h - ph * 0.7); g.lineTo(x0 + hw * 0.08, h - ph * 0.58); g.lineTo(x0 + hw * 0.36, h - ph * 0.62); g.closePath(); g.fill();
        }
      }
    });
  }
  function makeSky(ti) {
    var T = THEMES[ti];
    return layer(W, HZ + 1, function (g) {
      var n = T.sky.length, bh = Math.ceil((HZ + 1) / n), i;
      for (i = 0; i < n; i++) { g.fillStyle = T.sky[i]; g.fillRect(0, i * bh, W, bh); }
      if (ti === 0) {
        for (i = 0; i < 46; i++) { g.globalAlpha = 0.35 + hash(i * 3) * 0.65; g.fillStyle = '#ffffff'; g.fillRect(Math.floor(hash(i * 7 + 1) * W), Math.floor(hash(i * 13 + 5) * 36), 1, 1); }
        g.globalAlpha = 1;
        g.fillStyle = '#3a1478'; g.beginPath(); g.arc(98, 34, 15, 0, 7); g.fill();
        g.fillStyle = '#ff77d0'; g.beginPath(); g.arc(98, 34, 13, 0, 7); g.fill();
        g.fillStyle = '#ffb3ea'; g.beginPath(); g.arc(95, 31, 8, 0, 7); g.fill();
        g.fillStyle = '#c63fb0'; g.fillRect(88, 38, 6, 2); g.fillRect(101, 30, 5, 2);
        g.strokeStyle = '#3de2ff'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(98, 34, 24, 4, -0.35, 0, 7); g.stroke();
        g.fillStyle = '#ff77d0'; g.beginPath(); g.arc(98, 34, 13, 0.1 * Math.PI, 0.9 * Math.PI); g.fill();
      } else if (ti === 1) {
        g.fillStyle = '#ffd36b'; g.globalAlpha = 0.25; g.beginPath(); g.arc(40, 46, 22, 0, 7); g.fill(); g.globalAlpha = 0.35; g.beginPath(); g.arc(40, 46, 16, 0, 7); g.fill(); g.globalAlpha = 1;
        g.fillStyle = '#fff2b0'; g.beginPath(); g.arc(40, 46, 10, 0, 7); g.fill();
        g.globalAlpha = 0.3; g.fillStyle = '#ffd0a0'; g.fillRect(70, 14, 40, 2); g.fillRect(84, 20, 36, 2); g.fillRect(8, 26, 30, 2); g.globalAlpha = 1;
      } else {
        g.fillStyle = '#ffffff'; g.globalAlpha = 0.25; g.beginPath(); g.arc(100, 24, 18, 0, 7); g.fill(); g.globalAlpha = 0.5; g.beginPath(); g.arc(100, 24, 11, 0, 7); g.fill(); g.globalAlpha = 1;
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(100, 24, 6, 0, 7); g.fill();
        g.globalAlpha = 0.5; g.fillRect(14, 20, 22, 2); g.fillRect(24, 25, 26, 2); g.fillRect(70, 38, 28, 2); g.globalAlpha = 1;
      }
    });
  }
  function prepTheme(ti) {
    var T = THEMES[ti];
    T.fg = [fogArr(T.g[0], T.fog), fogArr(T.g[1], T.fog)];
    T.fr = [fogArr(T.r[0], T.fog), fogArr(T.r[1], T.fog)];
    T.fw = [fogArr(T.w[0], T.fog), fogArr(T.w[1], T.fog)];
    T.fl = fogArr(T.lane, T.fog); T.fe = fogArr(T.edge, T.fog); T.fu = fogArr(T.rung, T.fog);
    T.fp = [fogArr(T.pad[0], T.fog), fogArr(T.pad[1], T.fog)];
    T.skyImg = makeSky(ti);
    if (ti === 0) T.lay = [{ img: skyline(204, 30, 11, '#3b1676', ['#ff77d0', '#7fe9ff', '#b48cff'], 8, 24, 7, 13, ['#ff2fd0', '#3de2ff']), f: 0.3, y: HZ - 29 },
      { img: skyline(272, 38, 47, '#1c0a46', ['#ff2fd0', '#3de2ff', '#ffe45e'], 14, 36, 9, 16, ['#ff2fd0', '#3de2ff']), f: 0.65, y: HZ - 37 }];
    else if (ti === 1) T.lay = [{ img: mesas(204, 26, 5, '#b8573c', '#a24a34', 16, 34, 12, 24), f: 0.3, y: HZ - 25 },
      { img: mesas(272, 34, 29, '#8d3326', '#7a2b20', 22, 44, 16, 32), f: 0.65, y: HZ - 33 }];
    else T.lay = [{ img: peaks(272, 30, 3, '#9cc9ee', '#ffffff', '#7fb0e0', 6), f: 0.3, y: HZ - 29 },
      { img: peaks(272, 36, 17, '#5e9ad6', '#f4fbff', '#4a84c4', 5), f: 0.65, y: HZ - 35 }];
  }

  /* -------------------------------------------------------------- track data */
  function buildTrack(def) {
    var cv = [], hh = [], y = 0;
    function add(n, c, hill) {
      var enter = Math.round(n * 0.3), leave = Math.round(n * 0.3), hold = n - enter - leave, y0 = y, y1 = y + hill, k, cc, a;
      for (k = 0; k < n; k++) {
        if (k < enter) { a = k / enter; cc = c * a * a * (3 - 2 * a); }
        else if (k < enter + hold) cc = c;
        else { a = (n - k) / leave; cc = c * a * a * (3 - 2 * a); }
        cv.push(cc); hh.push(y0 + (y1 - y0) * (1 - Math.cos(Math.PI * k / n)) / 2);
      }
      y = y1;
    }
    def.sec.forEach(function (s) { add(Math.round(s[0] * def.mul), s[1], s[2]); });
    add(40, 0, -y);
    while (cv.length % (BAND * 2) !== 0) { cv.push(0); hh.push(0); }
    var N = cv.length, b = { N: N, curve: Float32Array.from(cv), hy: Float32Array.from(hh), pad: [], scn: [] }, i;
    for (i = 0; i < N; i++) { b.pad.push(null); b.scn.push(null); }
    def.pads.forEach(function (p) {
      var st = Math.floor(p[0] * N / 8) * 8;
      for (var k = 0; k < PAD_LEN; k++) b.pad[(st + k) % N] = { a: p[1], b: p[2], first: k === 0 };
    });
    genScenery(b, def.theme);
    return b;
  }
  function genScenery(b, ti) {
    var N = b.N, i;
    function add(i, it) { i = wrapN(i, N); (b.scn[i] || (b.scn[i] = [])).push(it); }
    add(0, { k: 'gate', o: 0 });
    for (i = 70; i < N - 70; i += 96) if (Math.abs(b.curve[i]) < 0.0016) add(i, { k: 'arch', o: 0, v: (i / 96) | 0 });
    for (i = 3; i < N - 6; i += 3) {
      var h = hash(i * 3 + ti * 101), h2 = hash(i * 5 + ti * 57 + 3), side = h2 < 0.5 ? -1 : 1;
      if (ti === 0) {
        if (i % 9 === 0) { add(i, { k: 'pylon', o: -1.28, v: (i / 9) & 1 }); add(i, { k: 'pylon', o: 1.28, v: ((i / 9) & 1) ^ 1 }); }
        if (h < 0.24) add(i, { k: 'tower', o: side * (1.7 + hash(i + 7) * 2.4), v: (h * 1000) | 0 });
        else if (h > 0.9) add(i, { k: 'sign', o: side * (1.6 + hash(i + 9) * 0.6), v: (h * 1000) | 0 });
      } else if (ti === 1) {
        if (h < 0.34) add(i, { k: 'rock', o: side * (1.55 + hash(i + 7) * 2.6), v: (h * 1000) | 0 });
        else if (h > 0.86) add(i, { k: 'cactus', o: side * (1.5 + hash(i + 9) * 1.4), v: (h * 1000) | 0 });
        if (i % 15 === 0) add(i, { k: 'flag', o: i % 30 ? 1.25 : -1.25, v: (i / 15) & 1 });
      } else {
        if (h < 0.32) add(i, { k: 'pine', o: side * (1.5 + hash(i + 7) * 2.6), v: (h * 1000) | 0 });
        else if (h > 0.84) add(i, { k: 'crystal', o: side * (1.5 + hash(i + 9) * 2.0), v: (h * 1000) | 0 });
        if (i % 16 === 0) add(i, { k: 'flag', o: i % 32 ? 1.25 : -1.25, v: (i / 16) & 1 });
      }
    }
    for (i = 6; i < N - 6; i += 6) {
      var c = b.curve[i];
      if (Math.abs(c) > 0.0014) add(i, { k: 'chev', o: c > 0 ? -1.32 : 1.32, d: c > 0 ? 1 : -1 });
    }
  }

  /* ------------------------------------------------------------------- state */
  var TR, T, B, N, curve, hy, padAt, scn, trkIdx, unlocked, sel;
  var racers, pl, order, phase, phaseT, tm, camPos, camX, camSeg, bgx, roll, energy, lap, place, finCount, earned;
  var banner, rechargedTotal, shake, boostSfxT, hudFlash, prevRank, lapT, dead, hum, engT, padOn;
  var sX = new Float32Array(DRAW + 2), sY = new Float32Array(DRAW + 2), sS = new Float32Array(DRAW + 2), sClip = new Float32Array(DRAW + 2), fogLv = new Uint8Array(DRAW + 2);
  var rvis = [];
  (function () { for (var n = 0; n < DRAW + 2; n++) fogLv[n] = Math.min(LV, Math.max(0, Math.floor((n - 28) / (DRAW - 28) * (LV + 1)))); })();

  function heightAt(p) { var i = Math.floor(p), f = p - i; i = wrapN(i, N); return hy[i] + (hy[(i + 1) % N] - hy[i]) * f; }
  function shearAt(y) { return -roll * (PIV - y) * 0.032; }

  function makeRacers() {
    var grid = [0, 1, 2, 3, 4, 5, 6, 7], ci = 1;
    racers = [];
    var plSlot = 5;
    for (var k = 0; k < 8; k++) {
      var row = k >> 1, left = (k & 1) === 0, r;
      if (k === plSlot) {
        r = { id: 0, name: 'YOU', ci: 0, col: PLAYER_COL, human: true, vmax: CRUISE, ag: 0, rb: 0 };
      } else {
        var d = CPU[ci - 1];
        r = { id: ci, name: d.n, ci: ci, col: d.col, human: false, vmax: TR.pace * d.v, ag: d.ag, rb: d.rb * TR.rbk, ph: ci * 1.7 };
        ci++;
      }
      r.dist = -(row * 3.4 + 2.2); r.x = left ? -0.4 : 0.4; r.vx = 0; r.spd = 0; r.fin = false; r.finIdx = 0; r.rank = k; r.hit = 0; r.d = 0; r.tx = r.x;
      racers.push(r);
    }
    pl = racers.filter(function (q) { return q.human; })[0];
    racers.sort(function (a, b) { return a.id - b.id; });   // index 0 = player (id 0)
    order = racers.slice();
  }

  function startTrack(i, allowSelect) {
    trkIdx = i; TR = TRACKS[i - 1]; T = THEMES[TR.theme]; B = TR.built; N = B.N; curve = B.curve; hy = B.hy; padAt = B.pad; scn = B.scn;
    R.level = i;
    makeRacers();
    phase = (allowSelect && unlocked > 1) ? 'select' : 'count'; phaseT = 0; sel = i;
    tm = 0; bgx = 0; roll = 0; energy = 100; lap = 1; place = 0; finCount = 0; earned = 0; shake = 0; boostSfxT = 0; prevRank = pl.rank; lapT = 0; hum = 0; dead = 0; engT = 0; padOn = false;
    banner = null; hudFlash = 0;
    pl.spd = 0;
    syncCam();
  }
  function syncCam() { camPos = pl.dist - CRAFT_D; camSeg = wrapN(Math.floor(pl.dist), N); camX = pl.x * 0.8; }

  function say(text, color, t) { banner = { text: text, color: color || '#fff', t: t || 1.4, t0: t || 1.4 }; }

  function computeRanks() {
    order.sort(function (a, b) {
      if (a.fin && b.fin) return a.finIdx - b.finIdx;
      if (a.fin) return -1; if (b.fin) return 1;
      return b.dist - a.dist;
    });
    for (var i = 0; i < order.length; i++) order[i].rank = i;
  }

  /* ------------------------------------------------------------------ update */
  function updateRival(r, dt, go) {
    var seg = wrapN(Math.floor(r.dist), N), c = curve[seg], gap = r.dist - pl.dist, k = 1, i, o;
    if (go) {
      if (gap > 30) k -= Math.min(0.1, (gap - 30) / 900) * r.rb;
      if (gap < -20) k += Math.min(0.18, (-gap - 20) / 380) * r.rb;
      if (Math.abs(c) > 0.0016) k *= 0.97;
    }
    var tgt = go ? r.vmax * k : 0;
    r.spd += U.clamp(tgt - r.spd, -40 * dt, 20 * dt);
    /* lateral target: inside line + weave, aggressive ones lean into the player */
    var line = U.clamp(c * 420, -0.55, 0.55) + Math.sin(tm * 0.6 + r.ph) * 0.2;
    if (go && r.ag > 0.5 && Math.abs(gap) < 9 && !pl.fin) line = U.lerp(line, pl.x, 0.75);
    for (i = 1; i < racers.length; i++) {
      o = racers[i];
      if (o === r) continue;
      var dd = o.dist - r.dist;
      if (dd > 0 && dd < 4 && Math.abs(o.x - r.x) < 0.3) { line += (r.x >= o.x ? 1 : -1) * 0.35; if (dd < 2.2) r.spd = Math.min(r.spd, o.spd + 1); }
    }
    r.tx = U.clamp(line, -0.7, 0.7);
    r.vx += ((r.spd > 6 ? U.clamp((r.tx - r.x) * 3.2, -1.0, 1.0) : 0) - r.vx) * Math.min(1, dt * 5);
    r.x = U.clamp(r.x + r.vx * dt, -0.74, 0.74);
    r.dist += r.spd * dt;
    if (r.hit > 0) r.hit -= dt;
    if (!r.fin && r.dist >= LAPS * N) { r.fin = true; r.finIdx = finCount++; }
  }

  function bump(r, dxl, loss) {
    if (pl.hit > 0 || phase !== 'race') return;
    pl.hit = 0.45;
    energy -= loss; hudFlash = 0.3;
    pl.vx += (dxl > 0 ? -1 : 1) * 1.4; r.vx += (dxl > 0 ? 1 : -1) * 1.1;
    r.spd *= 0.96; pl.spd *= 0.94;
    R.sfx.play('hit'); R.vibrate(35); R.fx.shake(2, 0.2);
    R.fx.burst(HALF + (pl.x - camX) * X0, H - 26, { n: 12, color: ['#ffe45e', '#ffffff', r.col], speed: 70, life: 0.4, size: 2, gravity: 90 });
    R.fx.text(HALF, H - 48, '-' + Math.round(loss), '#ff6b6b');
  }

  function updatePlayer(dt) {
    var inp = R.input, race = phase === 'race', ax = race ? inp.axisX() : 0, i;
    var boosting = race && inp.held.a && energy > 0.4, braking = race && inp.held.b;
    var seg = camSeg, c = curve[seg];
    /* speed */
    var tgt = !race && phase !== 'finish' ? 0 : boosting ? BOOST : braking ? BRAKE_SPD : CRUISE;
    if (phase === 'finish' || phase === 'result') tgt = 32;
    var rate = tgt > pl.spd ? (boosting ? 60 : 30) : (braking ? 75 : 20);
    pl.spd += U.clamp(tgt - pl.spd, -rate * dt, rate * dt);
    /* steering and centrifugal drift */
    var speedF = pl.spd / CRUISE;
    var steer = 1.55 * (braking ? 1.6 : 1) * (0.5 + 0.5 * Math.min(1, speedF));
    var tvx = ax * steer;
    if (phase === 'finish') tvx = U.clamp(-pl.x * 1.6, -0.8, 0.8);
    pl.vx += (tvx - pl.vx) * Math.min(1, dt * 7 * TR.grip * (braking ? 1.35 : 1));
    var cf = c * speedF * speedF * 520 * (braking ? 0.42 : 1);
    pl.x += (pl.vx - cf) * dt;
    /* walls */
    if (pl.hit > 0) pl.hit -= dt;
    if (Math.abs(pl.x) > LIM) {
      var sd = pl.x > 0 ? 1 : -1;
      pl.x = sd * LIM;
      if (pl.vx * sd > 0) pl.vx = -pl.vx * 0.35 - sd * 0.45;
      if (pl.hit <= 0 && race) {
        pl.hit = 0.4;
        var loss = 4 + pl.spd * 0.09;
        energy -= loss; hudFlash = 0.3; pl.spd *= 0.88;
        R.sfx.play('hit'); R.vibrate(30); R.fx.shake(2, 0.18);
        R.fx.burst(HALF + (pl.x - camX) * X0 + sd * 8, H - 24, { n: 14, color: ['#ffe45e', '#ffffff', '#ff9e3d'], speed: 80, life: 0.4, size: 2, gravity: 100 });
        R.fx.text(HALF + sd * -14, H - 50, '-' + Math.round(loss), '#ff6b6b');
      } else if (race && Math.random() < 0.5) R.fx.burst(HALF + (pl.x - camX) * X0 + sd * 9, H - 22, { n: 1, color: ['#ffe45e', '#ffffff'], speed: 40, life: 0.25, size: 1, gravity: 60 });
    }
    /* boost */
    if (boosting) {
      energy -= 24 * dt;
      boostSfxT -= dt;
      if (boostSfxT <= 0) { boostSfxT = 0.16; R.sfx.noise(0.14, { vol: 0.07, freq: 1800, sweep: 500 }); }
      R.fx.burst(HALF + (pl.x - camX) * X0 + (Math.random() < 0.5 ? -6 : 6), H - 14, { n: 1, color: ['#ffe45e', '#ff9e3d', '#ffffff'], speed: 45, life: 0.3, size: 2 });
    } else boostSfxT = 0;
    if (braking && pl.spd > 30 && Math.random() < 0.5) R.fx.burst(HALF + (pl.x - camX) * X0 + (Math.random() < 0.5 ? -11 : 11), H - 24, { n: 1, color: ['#ffffff', '#9aeeff'], speed: 35, life: 0.25, size: 1, gravity: 20 });
    /* recharge strips */
    var pd = padAt[seg], onPad = !!(pd && race && pl.x > pd.a - 0.1 && pl.x < pd.b + 0.1);
    if (onPad && !padOn) { R.sfx.tone(520, 0.06, { vol: 0.07, type: 'triangle', slide: 1040 }); R.vibrate(8); }
    padOn = onPad;
    if (onPad && energy < 100) {
      var gain = Math.min(100 - energy, 44 * dt);
      energy += gain; rechargedTotal += gain;
      if (Math.random() < 0.5) R.fx.burst(HALF + (pl.x - camX) * X0 + U.rand(-8, 8), H - 20, { n: 1, color: ['#39ff6a', '#b5ffc8', '#ffffff'], speed: 30, life: 0.4, size: 1, gravity: -40 });
      hum -= dt;
      if (hum <= 0) { hum = 0.09; R.sfx.tone(700 + (energy % 40) * 12, 0.05, { vol: 0.06, type: 'triangle' }); }
      if (rechargedTotal >= 150) R.achieve('fuel-up');
    }
    energy = U.clamp(energy, -1, 100);
    /* engine pulse */
    engT -= dt;
    if (engT <= 0 && race) { engT = boosting ? 0.09 : 0.14; R.sfx.tone(62 + pl.spd * 2.2, 0.1, { type: 'sawtooth', vol: boosting ? 0.035 : 0.022 }); }
    /* roll, advance */
    var rt = U.clamp(c * 650 + pl.vx * 0.9, -2, 2);
    roll += (rt - roll) * Math.min(1, dt * 6);
    pl.dist += pl.spd * dt;
  }

  function finishRace() {
    place = finCount + 1;
    pl.fin = true; pl.finIdx = finCount++;
    phase = 'finish'; phaseT = 0;
    var pts = PTS[place - 1] + Math.floor(Math.max(0, energy)) * 5;
    earned = pts; R.addScore(pts);
    say(ORD[place - 1] + ' PLACE!', place <= 3 ? '#ffe45e' : '#ffffff', 3.4);
    if (place <= 3) { R.achieve('podium'); R.sfx.play('win'); R.vibrate(60); R.fx.flash('#ffffff', 0.25); }
    else R.sfx.play(place <= 4 ? 'powerup' : 'lose');
    if (place === 1) R.achieve('winner');
    if (place <= 4) {
      if (trkIdx < 3 && unlocked < trkIdx + 1) { unlocked = trkIdx + 1; R.store.set('hr-unlocked', unlocked); }
      if (trkIdx === 3) R.achieve('grand-tour');
    }
    for (var i = 0; i < 24; i++) R.fx.burst(U.rand(10, W - 10), U.rand(20, 80), { n: 3, color: ['#ffe45e', '#ff2fd0', '#3de2ff', '#39ff6a', '#ffffff'], speed: 70, life: 1.0, size: 2, gravity: 50 });
  }

  function advance() {
    if (place > 4) R.gameOver();
    else if (trkIdx >= 3) R.gameOver({ win: true });
    else { R.sfx.play('start'); startTrack(trkIdx + 1, false); }
  }

  function update(dt) {
    var i, r;
    tm += dt; phaseT += dt;
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (hudFlash > 0) hudFlash -= dt;

    if (phase === 'select') {
      if (R.input.pressed('left') && sel > 1) { startTrack(sel - 1, true); R.sfx.play('move'); }
      if (R.input.pressed('right') && sel < unlocked) { startTrack(sel + 1, true); R.sfx.play('move'); }
      if (R.input.pressed('a')) { phase = 'count'; phaseT = 0; R.sfx.play('select'); }
      return;
    }
    if (phase === 'count') {
      var before = Math.floor((phaseT - dt) / 0.85), now = Math.floor(phaseT / 0.85);
      if (now !== before && now <= 2) R.sfx.tone(520, 0.12, { vol: 0.14, type: 'square' });
      if (phaseT >= 3 * 0.85) {
        phase = 'race'; phaseT = 0; say('GO!', '#39ff6a', 0.9);
        R.sfx.tone(1040, 0.35, { vol: 0.15 }); R.sfx.noise(0.3, { vol: 0.12, freq: 3000, sweep: 400 });
      }
    }
    var go = phase === 'race' || phase === 'finish' || phase === 'result' || phase === 'dead';
    for (i = 1; i < racers.length; i++) updateRival(racers[i], dt, go);
    if (phase === 'race' || phase === 'finish' || phase === 'result' || phase === 'count') updatePlayer(dt);
    if (phase === 'dead') { pl.spd *= 0.97; pl.dist += pl.spd * dt; }
    syncCam();
    /* rival collisions */
    if (phase === 'race') {
      for (i = 1; i < racers.length; i++) {
        r = racers[i];
        var dd = r.dist - pl.dist, dxl = r.x - pl.x, ad = Math.abs(dd);
        if (Math.abs(dxl) < 0.38 && ad < 1.4) {
          if (ad < 0.8) bump(r, dxl, 4 + r.ag * 4);                                   // side contact
          else if (dd > 0) { var cl = pl.spd - r.spd; pl.dist = r.dist - 1.4; if (cl > 4) bump(r, dxl, 3 + cl * 0.5 + r.ag * 3); pl.spd = Math.min(pl.spd, r.spd); }   // rear-ended a rival
          else { r.dist = pl.dist - 1.4; r.spd = Math.min(r.spd, pl.spd); }          // rival is held back behind us
        }
      }
    }
    computeRanks();
    /* race progress */
    if (phase === 'race') {
      var lapNow = Math.min(LAPS, Math.floor(pl.dist / N) + 1);
      if (lapNow > lap) {
        lap = lapNow; R.sfx.play('powerup'); R.addScore(100);
        say(lap === LAPS ? 'FINAL LAP!' : 'LAP ' + lap, lap === LAPS ? '#ff9e3d' : '#3de2ff', 1.5);
        R.fx.text(HALF, 70, '+100', '#ffe45e');
      }
      if (pl.rank < prevRank && pl.dist > 8) { R.addScore(25 * (prevRank - pl.rank)); R.sfx.tone(880, 0.07, { vol: 0.1 }); R.sfx.tone(1175, 0.1, { vol: 0.1, delay: 0.07 }); R.fx.text(HALF, 60, 'P' + (pl.rank + 1), '#39ff6a'); }
      prevRank = pl.rank;
      if (energy <= 0) {
        phase = 'dead'; phaseT = 0; dead = 1.5; energy = 0;
        R.sfx.play('explode'); R.vibrate(200); R.fx.shake(5, 0.6); R.fx.flash('#ffffff', 0.3);
        R.fx.burst(HALF + (pl.x - camX) * X0, H - 26, { n: 40, color: ['#ffe45e', '#ff9e3d', '#ff3b5c', '#ffffff'], speed: 120, life: 0.9, size: 3, gravity: 60 });
        say('SHIELD DOWN!', '#ff3b5c', 1.6);
      } else if (pl.dist >= LAPS * N) finishRace();
    } else if (phase === 'finish') {
      if (phaseT > 2.6) { phase = 'result'; phaseT = 0; }
    } else if (phase === 'result') {
      if ((R.input.pressed('a') && phaseT > 0.6) || phaseT > 12) advance();
    } else if (phase === 'dead') {
      dead -= dt;
      if (dead <= 0) R.gameOver();
    }
    /* backdrop scroll follows the curve */
    bgx += curve[camSeg] * pl.spd * dt * 200;
  }

  /* --------------------------------------------------------------- rendering */
  function box(ctx, x, y, w, h, col, clip) {
    var x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    if (x1 <= x0) x1 = x0 + 1; if (y1 <= y0) y1 = y0 + 1;
    if (y0 >= clip) return; if (y1 > clip) y1 = clip;
    ctx.fillStyle = col; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  function drawLayer(ctx, L, off) {
    var LW = L.img.width, x0 = -(((off * L.f) % LW) + LW) % LW;
    ctx.drawImage(L.img, Math.round(x0), L.y);
    if (x0 + LW < W) ctx.drawImage(L.img, Math.round(x0 + LW), L.y);
  }
  function drawBackdrop(ctx) {
    ctx.drawImage(T.skyImg, 0, 0);
    if (T === THEMES[2]) {
      for (var a = 0; a < 2; a++) {
        ctx.fillStyle = a ? '#b48cff' : '#7dffb8';
        for (var x = 0; x < W; x += 4) { ctx.globalAlpha = 0.16 + 0.1 * Math.sin(x * 0.12 + tm * 0.8 + a * 2); ctx.fillRect(x, 8 + a * 6 + Math.round(5 * Math.sin(x * 0.06 + tm * 0.5 + a)), 4, 9); }
      }
      ctx.globalAlpha = 1;
    }
    drawLayer(ctx, T.lay[0], bgx); drawLayer(ctx, T.lay[1], bgx);
  }

  function renderRoad(ctx) {
    var base = Math.floor(camPos), pct = camPos - base, bi = wrapN(base, N);
    var camH = heightAt(camPos + CRAFT_D);
    var x = 0, dx = -curve[bi] * pct, top = H, n, i, i2, r, t, lv;
    var neon = T === THEMES[0];
    ctx.fillStyle = T.fg[0][LV]; ctx.fillRect(0, HZ, W, H - HZ);
    for (n = 0; n < DRAW; n++) {
      i = (bi + n) % N; i2 = i + 1 === N ? 0 : i + 1;
      var z1 = ZN + (n - pct) * SEGL, z2 = z1 + SEGL, s1 = ZN / z1, s2 = ZN / z2;
      var y1 = HZ + Y0 * s1 * (1 - (hy[i] - camH)), y2 = HZ + Y0 * s2 * (1 - (hy[i2] - camH));
      var cx1 = HALF + (x - camX) * X0 * s1, cx2 = HALF + (x + dx - camX) * X0 * s2;
      sX[n] = cx1; sY[n] = y1; sS[n] = s1; sClip[n] = top;
      x += dx; dx += curve[i];
      if (y2 >= top || y2 >= y1) continue;
      var r0 = Math.max(Math.ceil(y2), 0), r1 = Math.min(Math.ceil(y1), top);
      if (r1 <= r0) continue;
      lv = fogLv[n];
      var par = (Math.floor((base + n) / BAND)) & 1, w1 = X0 * s1, w2 = X0 * s2, dyy = y1 - y2, pd = padAt[i];
      ctx.fillStyle = T.fg[par][lv]; ctx.fillRect(0, r0, W, r1 - r0);
      var cr = T.fr[par][lv], cwl = T.fw[par][lv], cl = T.fl[lv], ce = T.fe[lv];
      var detail = n < 100;
      for (r = r0; r < r1; r++) {
        t = (r + 0.5 - y2) / dyy;
        var cx = cx2 + (cx1 - cx2) * t + shearAt(r), rw = w2 + (w1 - w2) * t;
        var xl = Math.round(cx - rw), xr = Math.round(cx + rw), wl = Math.max(1, Math.round(rw * 0.11));
        ctx.fillStyle = cwl; ctx.fillRect(xl - wl, r, wl, 1); ctx.fillRect(xr, r, wl, 1);
        ctx.fillStyle = cr; ctx.fillRect(xl, r, xr - xl, 1);
        if (pd) {
          var p0 = Math.round(cx + rw * pd.a), p1 = Math.round(cx + rw * pd.b);
          ctx.fillStyle = T.fp[(par + (r >> 1)) & 1][lv]; ctx.fillRect(p0, r, p1 - p0, 1);
        }
        if (detail && rw > 3) {
          var lw = Math.max(1, Math.round(rw * 0.022));
          ctx.fillStyle = ce; var e0 = Math.round(rw * 0.9);
          ctx.fillRect(Math.round(cx) - e0, r, lw, 1); ctx.fillRect(Math.round(cx) + e0 - lw, r, lw, 1);
          if (!par && !pd) { ctx.fillStyle = cl; ctx.fillRect(Math.round(cx - lw), r, lw * 2, 1); }
        }
        if (i === 0 || i === 1) {
          var cells = 8, cw = (xr - xl) / cells, q;
          for (q = 0; q < cells; q++) if (((q + i + (r >> 1)) & 1) === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(xl + q * cw), r, Math.max(1, Math.round(cw)), 1); }
        }
      }
      if (neon && detail && i % BAND === 0 && r0 < top) { ctx.fillStyle = T.fu[lv]; var q0 = r0, cxm = cx2 + shearAt(q0), rwm = w2; ctx.globalAlpha = 0.7; ctx.fillRect(Math.round(cxm - rwm), q0, Math.round(rwm * 2), 1); ctx.globalAlpha = 1; }
      top = r0;
    }
  }

  function drawCraftSprite(ctx, ci, rollv, x, yBase, sc, clip, boost, flameT) {
    var ri = Math.max(-2, Math.min(2, Math.round(rollv))), img = S.craft[ci][ri + 2];
    var w = GW * sc, h = GH * sc, top = yBase - 15 * sc, i;
    /* shadow */
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - w * 0.38), Math.round(yBase + 1.5 * sc), Math.round(w * 0.76), Math.max(1, Math.round(2.2 * sc))); ctx.globalAlpha = 1;
    /* thruster flames */
    var fl = (boost ? 5 : 2.5) + (flameT % 1) * 2.2;
    for (i = -1; i <= 1; i += 2) {
      var fx = x + i * 6 * sc, fy = yBase + Math.round(ri * i * 1.15 * sc);
      box(ctx, fx - 1.4 * sc, fy, 2.8 * sc, fl * sc, boost ? '#ffffff' : '#ffe45e', clip);
      box(ctx, fx - 1.9 * sc, fy + 0.3 * sc, 3.8 * sc, (fl + 1.2) * sc, boost ? 'rgba(255,170,60,0.75)' : 'rgba(255,122,47,0.7)', clip);
    }
    if (top + h > clip) {
      if (top >= clip) return;
      var vis = (clip - top) / h;
      ctx.drawImage(img, 0, 0, GW, Math.max(1, Math.floor(GH * vis)), Math.round(x - w / 2), Math.round(top), Math.round(w), Math.round(h * Math.floor(GH * vis) / GH));
    } else ctx.drawImage(img, Math.round(x - w / 2), Math.round(top), Math.round(w), Math.round(h));
  }

  function drawRival(ctx, r, n) {
    var f = r.d - n, s = sS[n] + (sS[n + 1] - sS[n]) * f, y = sY[n] + (sY[n + 1] - sY[n]) * f, cx = sX[n] + (sX[n + 1] - sX[n]) * f;
    var x = cx + r.x * X0 * s + shearAt(y), sc = s * 1.45;
    if (sc < 0.12) return;
    var rr = U.clamp(curve[wrapN(Math.floor(r.dist), N)] * 650 + r.vx * 0.9, -2, 2);
    drawCraftSprite(ctx, r.ci, rr, x, y - 2 * sc, sc, sClip[n], false, tm * 9 + r.id * 3);
  }

  function drawScn(ctx, it, n) {
    var s0 = sS[n], s = s0 * 1.3, x = sX[n] + it.o * X0 * s0 + shearAt(sY[n]), y = sY[n], clip = sClip[n], k = it.k, i, v = it.v || 0;
    if (s0 < 0.045) return;
    if (k === 'gate') {
      var rw = X0 * s * 1.18, ph = 40 * s, pw = Math.max(1, 3.2 * s), cx = sX[n] + shearAt(y);
      box(ctx, cx - rw - pw, y - ph, pw, ph, '#2c3550', clip); box(ctx, cx + rw, y - ph, pw, ph, '#2c3550', clip);
      var bw = rw * 2 + pw * 2, bh = Math.max(2, 7 * s), cells = 14, cw = bw / cells, rowsN = 2;
      for (i = 0; i < cells; i++) for (var q = 0; q < rowsN; q++) box(ctx, cx - rw - pw + i * cw, y - ph - bh + q * bh / 2, cw + 0.5, bh / 2, ((i + q) & 1) ? '#10131c' : '#ffffff', clip);
      box(ctx, cx - rw - pw, y - ph + bh * 0.2, bw, Math.max(1, 1.5 * s), T.accent, clip);
      return;
    }
    if (k === 'arch') {
      var arw = X0 * s0 * 1.22, ah = 46 * s0, acx = sX[n] + shearAt(y), apw = Math.max(1, 4 * s0);
      if (T === THEMES[0]) {
        var ac = (v & 1) ? '#ff2fd0' : '#3de2ff';
        ctx.globalAlpha = 0.3; box(ctx, acx - arw - apw * 2, y - ah - apw, arw * 2 + apw * 4, apw * 3, ac, clip); ctx.globalAlpha = 1;
        box(ctx, acx - arw - apw, y - ah, apw, ah, '#2c1468', clip); box(ctx, acx + arw, y - ah, apw, ah, '#2c1468', clip);
        box(ctx, acx - arw - apw, y - ah, arw * 2 + apw * 2, Math.max(1, 2.2 * s0), ac, clip);
        for (i = 0; i < 7; i++) box(ctx, acx - arw + i * arw * 2 / 6.5, y - ah + 2.2 * s0, Math.max(1, s0), Math.max(1, 5 * s0), (i & 1) ? '#ffe45e' : ac, clip);
      } else if (T === THEMES[1]) {
        var rc = ['#7a2f1c', '#a8482a', '#c25a33'];
        box(ctx, acx - arw - apw * 3, y - ah, apw * 3, ah, rc[0], clip); box(ctx, acx + arw, y - ah, apw * 3, ah, rc[0], clip);
        box(ctx, acx - arw - apw * 3, y - ah - apw * 2, arw * 2 + apw * 6, apw * 2.4, rc[1], clip); box(ctx, acx - arw - apw * 3, y - ah - apw * 2, arw * 2 + apw * 6, Math.max(1, apw * 0.6), rc[2], clip);
        box(ctx, acx - arw - apw * 2, y - ah + apw * 0.4, arw * 2 + apw * 4, Math.max(1, apw * 0.7), rc[0], clip);
      } else {
        box(ctx, acx - arw - apw * 2, y - ah, apw * 2, ah, '#b8e2ff', clip); box(ctx, acx + arw, y - ah, apw * 2, ah, '#b8e2ff', clip);
        box(ctx, acx - arw - apw * 2, y - ah - apw, arw * 2 + apw * 4, apw * 1.8, '#e8f8ff', clip); box(ctx, acx - arw - apw * 2, y - ah - apw + apw * 1.4, arw * 2 + apw * 4, Math.max(1, apw * 0.5), '#5aa8ec', clip);
        for (i = 0; i < 9; i++) box(ctx, acx - arw + i * arw * 2 / 8.2, y - ah + apw * 0.8, Math.max(1, s0 * 1.2), (3 + (i * 5) % 4) * s0, '#d8f2ff', clip);
      }
      return;
    }
    if (k === 'chev') {
      var bwid = 11 * s, bhei = 9 * s, pole = Math.max(1, s * 1.6);
      box(ctx, x - pole / 2, y - 12 * s, pole, 12 * s, '#8a93a8', clip);
      box(ctx, x - bwid / 2, y - 21 * s, bwid, bhei, '#ffd23d', clip);
      box(ctx, x - bwid / 2 + s, y - 21 * s + s, bwid - 2 * s, bhei - 2 * s, '#10131c', clip);
      var ax = x + it.d * 1.5 * s;
      for (i = 0; i < 3; i++) {
        var yy = y - 20 * s + (i + 0.5) * (bhei - 2 * s) / 3 - s * 0.2, off = (1 - Math.abs(i - 1)) * it.d * 1.4 * s;
        box(ctx, ax - it.d * 1.3 * s + off - s * 0.6, yy, 1.4 * s + 0.6, Math.max(1, 1.8 * s), '#ffd23d', clip);
      }
      return;
    }
    if (T === THEMES[0]) {
      if (k === 'pylon') {
        var ph2 = 28 * s, pw2 = Math.max(1, 2 * s), col = v ? '#ff2fd0' : '#3de2ff';
        box(ctx, x - pw2 / 2, y - ph2, pw2, ph2, T.pole, clip);
        ctx.globalAlpha = 0.3; box(ctx, x - 3.5 * s, y - ph2 - 3 * s, 7 * s, 6 * s, col, clip); ctx.globalAlpha = 1;
        box(ctx, x - 2 * s, y - ph2 - 1.5 * s, 4 * s, 3 * s, col, clip);
      } else if (k === 'tower') {
        var bw2 = (13 + (v % 4) * 3) * s, bh2 = (26 + (v % 5) * 8) * s, tc = (v & 1) ? '#ff2fd0' : '#3de2ff';
        box(ctx, x - bw2 / 2, y - bh2, bw2, bh2, '#1a0a42', clip); box(ctx, x - bw2 / 2, y - bh2, bw2, Math.max(1, s * 1.5), tc, clip);
        box(ctx, x - bw2 / 2, y - bh2, Math.max(1, s), bh2, '#2c1468', clip);
        if (s > 0.28) for (var wy = 4; wy < bh2 / s - 2; wy += 4) for (var wx = 2; wx < bw2 / s - 2; wx += 4) if (hash(v * 31 + wx * 7 + wy * 13) > 0.5) box(ctx, x - bw2 / 2 + wx * s, y - bh2 + wy * s, 1.6 * s, 1.6 * s, (wx + wy) % 3 ? '#ffe45e' : '#7fe9ff', clip);
      } else if (k === 'sign') {
        var sw = 16 * s, sh = 9 * s, c2 = (v & 1) ? '#ff2fd0' : '#3de2ff';
        box(ctx, x - sw / 2 + s, y - 14 * s, Math.max(1, s * 1.4), 14 * s, T.pole, clip); box(ctx, x + sw / 2 - 2 * s, y - 14 * s, Math.max(1, s * 1.4), 14 * s, T.pole, clip);
        box(ctx, x - sw / 2, y - 14 * s - sh, sw, sh, '#10062a', clip); box(ctx, x - sw / 2, y - 14 * s - sh, sw, Math.max(1, s), c2, clip);
        box(ctx, x - sw / 2 + 2 * s, y - 14 * s - sh + 3 * s, sw - 4 * s, Math.max(1, 1.6 * s), '#ffe45e', clip); box(ctx, x - sw / 2 + 2 * s, y - 14 * s - sh + 6 * s, (sw - 4 * s) * 0.6, Math.max(1, 1.6 * s), c2, clip);
      }
    } else if (T === THEMES[1]) {
      if (k === 'rock') {
        var rw1 = (18 + (v % 4) * 5) * s, rh1 = (16 + (v % 5) * 7) * s, cols = ['#8f3b22', '#a8482a', '#c25a33', '#7a2f1c'];
        for (i = 0; i < 4; i++) { var ww = rw1 * (1 - i * 0.14), hh = rh1 / 4; box(ctx, x - ww / 2 + i * 0.6 * s, y - hh * (i + 1), ww, hh + 0.5, cols[(i + v) % 4], clip); }
        box(ctx, x - rw1 / 2, y - rh1 * 0.25, Math.max(1, s * 1.2), rh1 * 0.25, '#d6733f', clip);
      } else if (k === 'cactus') {
        var ch = (16 + (v % 4) * 3) * s, cw2 = Math.max(1, 3 * s);
        box(ctx, x - cw2 / 2, y - ch, cw2, ch, '#3f9a4c', clip); box(ctx, x - cw2 / 2 - 3.5 * s, y - ch * 0.62, 3.5 * s, Math.max(1, 2.4 * s), '#3f9a4c', clip); box(ctx, x - cw2 / 2 - 3.5 * s, y - ch * 0.62 - 5 * s, Math.max(1, 2.4 * s), 5.4 * s, '#3f9a4c', clip);
        box(ctx, x + cw2 / 2, y - ch * 0.45, 3.5 * s, Math.max(1, 2.4 * s), '#3f9a4c', clip); box(ctx, x + cw2 / 2 + 3.5 * s - 2.4 * s, y - ch * 0.45 - 4 * s, Math.max(1, 2.4 * s), 4.4 * s, '#3f9a4c', clip);
        box(ctx, x - cw2 / 2, y - ch, Math.max(1, s), ch, '#6fd07b', clip);
      } else if (k === 'flag') {
        box(ctx, x - s * 0.8, y - 22 * s, Math.max(1, 1.6 * s), 22 * s, '#d8c9a8', clip);
        var flc = v ? '#d9482b' : '#f3e6cf'; box(ctx, x, y - 22 * s, 8 * s, 5 * s, flc, clip); box(ctx, x, y - 20 * s, 8 * s, Math.max(1, 1.4 * s), '#10131c', clip);
      }
    } else {
      if (k === 'pine') {
        var ph3 = (20 + (v % 4) * 5) * s, pw3 = (12 + (v % 3) * 2) * s;
        box(ctx, x - s, y - 4 * s, Math.max(1, 2 * s), 4 * s, '#6a4a34', clip);
        for (i = 0; i < 3; i++) { var lw = pw3 * (1 - i * 0.28), ly = y - 4 * s - (i + 1) * ph3 / 3.4; box(ctx, x - lw / 2, ly, lw, ph3 / 3.2, '#2f6f5a', clip); box(ctx, x - lw / 2, ly, lw, Math.max(1, ph3 / 9), '#f4fbff', clip); }
      } else if (k === 'crystal') {
        var chh = (16 + (v % 5) * 6) * s, cww = (8 + (v % 3) * 2) * s;
        if (y - chh < sClip[n]) {
          ctx.fillStyle = '#9bdcff'; ctx.beginPath(); ctx.moveTo(x - cww / 2, y); ctx.lineTo(x - cww * 0.3, y - chh * 0.7); ctx.lineTo(x, y - chh); ctx.lineTo(x + cww * 0.3, y - chh * 0.7); ctx.lineTo(x + cww / 2, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#e8f9ff'; ctx.beginPath(); ctx.moveTo(x - cww * 0.3, y - chh * 0.7); ctx.lineTo(x, y - chh); ctx.lineTo(x - cww * 0.05, y - chh * 0.2); ctx.lineTo(x - cww * 0.35, y - chh * 0.1); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#4a98e0'; ctx.beginPath(); ctx.moveTo(x + cww * 0.3, y - chh * 0.7); ctx.lineTo(x, y - chh); ctx.lineTo(x - cww * 0.05, y - chh * 0.2); ctx.lineTo(x + cww * 0.2, y); ctx.lineTo(x + cww / 2, y); ctx.closePath(); ctx.fill();
        }
      } else if (k === 'flag') {
        box(ctx, x - s * 0.8, y - 22 * s, Math.max(1, 1.6 * s), 22 * s, '#8aa6c4', clip);
        box(ctx, x, y - 22 * s, 8 * s, 5 * s, v ? '#3a86d8' : '#ff5ea8', clip);
      }
    }
  }

  function renderSprites(ctx) {
    var base = Math.floor(camPos), bi = wrapN(base, N), n, j, ri = 0, r, d;
    rvis.length = 0;
    for (j = 1; j < racers.length; j++) {
      r = racers[j]; d = wrapN(r.dist - camPos, N);
      if (d < CRAFT_D - 1.3 || d >= DRAW - 2) continue;
      r.d = d; rvis.push(r);
    }
    rvis.sort(function (a, b) { return b.d - a.d; });
    for (n = DRAW - 2; n >= 0; n--) {
      var list = scn[(bi + n) % N];
      if (list && n < 135) for (j = 0; j < list.length; j++) drawScn(ctx, list[j], n);
      while (ri < rvis.length && rvis[ri].d >= n) { drawRival(ctx, rvis[ri], n); ri++; }
    }
  }

  function drawBoostLines(ctx) {
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.4;
    for (var i = 0; i < 12; i++) {
      var a = hash(Math.floor(tm * 22) * 7 + i) * Math.PI * 2, r0 = 48 + hash(i * 3 + Math.floor(tm * 22)) * 14, len = 10 + hash(i + 40) * 14;
      var x0 = HALF + Math.cos(a) * r0 * 1.3, y0 = 90 + Math.sin(a) * r0;
      if (y0 < 14 || y0 > H - 4) continue;
      ctx.fillRect(Math.round(x0), Math.round(y0), Math.max(1, Math.round(Math.cos(a) * len * 0.5)), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 12);
    R.draw.text(ctx, 'P' + (pl.rank + 1) + '/8', 3, 3, { size: 6, color: pl.rank < 4 ? '#39ff6a' : '#ff9e3d' });
    R.draw.text(ctx, 'SC ' + U.pad(R.score, 5), HALF, 3, { size: 6, color: C.yellow, align: 'center' });
    R.draw.text(ctx, 'L' + Math.min(LAPS, lap) + '/' + LAPS, W - 3, 3, { size: 6, color: '#9aeeff', align: 'right' });
    /* race progress strip */
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(W - 8, 15, 6, 58);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(W - 8, 15, 6, 1);
    var i, q;
    for (i = racers.length - 1; i >= 0; i--) {
      q = racers[i];
      var prog = U.clamp(q.dist / (LAPS * N), 0, 1), yy = 71 - Math.round(prog * 54);
      ctx.fillStyle = q.col; ctx.fillRect(W - 7, yy - 1, 4, 3);
      if (q.human) { ctx.fillStyle = '#ffffff'; ctx.fillRect(W - 8, yy, 1, 1); ctx.fillRect(W - 3, yy, 1, 1); }
    }
    /* energy / shield bar */
    var ex = 3, ey = H - 11, ew = 52, frac = U.clamp(energy / 100, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(ex - 1, ey - 1, ew + 2, 9);
    var low = frac < 0.28, ecol = low ? '#ff3b5c' : frac < 0.55 ? '#ffe45e' : '#39ff6a';
    if (!(low && Math.floor(tm * 8) % 2)) { ctx.fillStyle = ecol; ctx.fillRect(ex, ey, Math.round(ew * frac), 7); }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (i = 1; i < 10; i++) ctx.fillRect(ex + Math.round(ew * i / 10), ey, 1, 7);
    R.draw.text(ctx, 'EN', ex + 2, ey + 1, { size: 6, color: '#10131c' });
    if (hudFlash > 0) { ctx.globalAlpha = hudFlash * 2; ctx.fillStyle = '#ff3b5c'; ctx.fillRect(ex - 1, ey - 1, ew + 2, 9); ctx.globalAlpha = 1; }
    /* speed */
    R.draw.text(ctx, String(Math.round(pl.spd * 4.3)), W - 3, H - 16, { size: 8, color: '#ffffff', align: 'right', shadow: '#000' });
    R.draw.text(ctx, 'KPH', W - 3, H - 7, { size: 6, color: '#9aeeff', align: 'right', shadow: '#000' });
  }

  function panel(ctx, x, y, w, h, col) {
    ctx.fillStyle = 'rgba(6,9,18,0.88)'; ctx.fillRect(x, y, w, h); R.draw.frame(ctx, x, y, w, h, col || '#e8f1ff', 1);
  }

  function drawOverlay(ctx) {
    var i;
    if (phase === 'select') {
      panel(ctx, 12, 20, W - 24, 60, T.accent);
      R.draw.text(ctx, 'TRACK ' + sel + '/3', HALF, 26, { size: 6, color: '#9fb2d0', align: 'center' });
      R.draw.text(ctx, T.name, HALF, 36, { size: 8, color: T.accent, align: 'center', shadow: '#000' });
      for (i = 1; i <= 3; i++) { ctx.fillStyle = i <= unlocked ? (i === sel ? T.accent : '#8aa0c0') : '#2a3550'; ctx.fillRect(HALF - 14 + (i - 1) * 12, 49, 8, 4); }
      if (sel > 1) R.draw.text(ctx, '<', 18, 40, { size: 8, color: '#ffffff' });
      if (sel < unlocked) R.draw.text(ctx, '>', W - 26, 40, { size: 8, color: '#ffffff' });
      R.draw.text(ctx, '8 RACERS 3 LAPS', HALF, 59, { size: 6, color: '#c8d4ea', align: 'center' });
      if (Math.floor(tm * 2.2) % 2 === 0) R.draw.text(ctx, 'A: START', HALF, 69, { size: 6, color: '#ffe45e', align: 'center' });
    } else if (phase === 'count') {
      var cn = 3 - Math.floor(phaseT / 0.85);
      if (phaseT < 0.9) { R.draw.text(ctx, 'TRACK ' + trkIdx, HALF, 24, { size: 6, color: '#9fb2d0', align: 'center', shadow: '#000' }); R.draw.text(ctx, T.name, HALF, 33, { size: 8, color: T.accent, align: 'center', shadow: '#000' }); }
      if (cn >= 1) R.draw.text(ctx, String(cn), HALF, 50, { size: 16, color: '#ffe45e', align: 'center', shadow: '#000' });
    }
    if (banner && phase !== 'result') {
      var a = banner.t < 0.4 ? banner.t / 0.4 : 1, by = banner.text === 'GO!' ? 46 : 44;
      ctx.globalAlpha = a;
      R.draw.text(ctx, banner.text, HALF, by, { size: banner.text === 'GO!' ? 16 : 8, color: banner.color, align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (phase === 'result') {
      panel(ctx, 14, 22, W - 28, 124, place <= 4 ? '#39ff6a' : '#ff3b5c');
      R.draw.text(ctx, place <= 4 ? 'RACE CLEAR' : 'OUT OF TOP 4', HALF, 28, { size: 8, color: place <= 4 ? '#39ff6a' : '#ff6b6b', align: 'center' });
      var list = order;
      for (i = 0; i < list.length; i++) {
        var q = list[i], ry = 42 + i * 9;
        if (q.human) { ctx.fillStyle = 'rgba(255,228,94,0.25)'; ctx.fillRect(18, ry - 1, W - 36, 9); }
        ctx.fillStyle = q.col; ctx.fillRect(21, ry + 1, 5, 5);
        R.draw.text(ctx, ORD[i], 30, ry, { size: 6, color: i < 4 ? '#ffffff' : '#8a93a8' });
        R.draw.text(ctx, q.name, 56, ry, { size: 6, color: q.human ? '#ffe45e' : '#c8d4ea' });
      }
      R.draw.text(ctx, '+' + earned + ' PTS', HALF, 112, { size: 8, color: '#ffe45e', align: 'center' });
      if (place <= 4 && trkIdx < 3) R.draw.text(ctx, 'TRACK ' + (trkIdx + 1) + ' UNLOCKED', HALF, 123, { size: 6, color: '#39ff6a', align: 'center' });
      var nxt = place > 4 ? 'A: CONTINUE' : (trkIdx >= 3 ? 'A: FINISH' : 'A: NEXT TRACK');
      if (Math.floor(tm * 2.2) % 2 === 0) R.draw.text(ctx, nxt, HALF, 132, { size: 6, color: '#ffffff', align: 'center' });
    }
  }

  R.game({
    layout: 'full', size: [W, H], bg: '#06021a', music: 'action',

    init: function () { TRACKS.forEach(function (t, i) { t.built = buildTrack(t); }); THEMES.forEach(function (t, i) { prepTheme(i); }); buildSprites(); },

    reset: function () {
      unlocked = U.clamp(Math.floor(R.store.get('hr-unlocked', 1)), 1, 3);
      rechargedTotal = 0; R.lives = null; R.score = 0;
      startTrack(1, true);
    },

    update: update,

    render: function (ctx, w, h) {
      drawBackdrop(ctx);
      renderRoad(ctx);
      renderSprites(ctx);
      var boosting = phase === 'race' && R.input.held.a && energy > 0.4;
      if (phase !== 'dead' || dead > 1.3) {
        var cxp = HALF + (pl.x - camX) * X0, bob = Math.sin(tm * 5) * 0.8;
        if (!(pl.hit > 0.25 && Math.floor(tm * 20) % 2)) drawCraftSprite(ctx, 0, roll, cxp, H - 24 + bob, 1.1, 999, boosting, tm * 11);
      }
      if (boosting) drawBoostLines(ctx);
      drawHud(ctx);
      drawOverlay(ctx);
    }
  });
})();
