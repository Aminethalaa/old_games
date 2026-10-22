/* Nova Rider — pseudo-3D rail shooter over a chequered world: dodge columns, blast waves and turrets, fly through gates, beat three bosses (Retro SDK) */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164, CX = 68, HZ = 60, GRND = 142, SX = 50, SY = 54, F = 45, ZF = 150, SCROLL = 62;
  var TX = 0.8, TZ = 14, LASER_V = 250, BOLT_V = 54, LV = 7;
  var PX_MAX = 1.04, PY_MIN = 0.08, PY_MAX = 1.12;

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function fogArr(col, fog) { var a = hex(col), f = hex(fog), out = [], l; for (l = 0; l <= LV; l++) out.push(rgb(mixc(a, f, l / LV * 0.94))); return out; }
  function layer(w, h, fn) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
  function rc(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function disc(g, cx, cy, r, col) { g.fillStyle = col; for (var y = -r; y <= r; y++) { var hf = Math.floor(Math.sqrt(r * r - y * y + 0.5)); g.fillRect(cx - hf, cy + y, hf * 2 + 1, 1); } }

  /* ------------------------------------------------------------- pixel maps */
  function Grid(w, h) {
    var g = [], x, y;
    for (y = 0; y < h; y++) { g.push([]); for (x = 0; x < w; x++) g[y].push('.'); }
    var o = {
      px: function (x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; },
      bx: function (x0, y0, x1, y1, c) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) o.px(xx, yy, c); },
      bm: function (x0, y0, x1, y1, c) { o.bx(x0, y0, x1, y1, c); o.bx(w - 1 - x1, y0, w - 1 - x0, y1, c); },
      pm: function (x, y, c) { o.px(x, y, c); o.px(w - 1 - x, y, c); },
      disc: function (cx, cy, r, c) { for (var yy = -r; yy <= r; yy++) { var hf = Math.floor(Math.sqrt(r * r - yy * yy + 0.5)); for (var xx = -hf; xx <= hf; xx++) o.px(cx + xx, cy + yy, c); } },
      half: function (rows) { for (var yy = 0; yy < rows.length; yy++) { var hr = rows[yy], full = hr + hr.slice(0, hr.length - 1).split('').reverse().join(''); for (var xx = 0; xx < full.length; xx++) if (full[xx] !== '.') o.px(xx, yy, full[xx]); } },
      shear: function (fn) {
        var out = [];
        for (var yy = 0; yy < h; yy++) { out.push([]); for (var xx = 0; xx < w; xx++) out[yy].push('.'); }
        for (var xx2 = 0; xx2 < w; xx2++) { var dy = fn(xx2); for (var yy2 = 0; yy2 < h; yy2++) { var ny = yy2 + dy; if (g[yy2][xx2] !== '.' && ny >= 0 && ny < h) out[ny][xx2] = g[yy2][xx2]; } }
        g = out;
      },
      rows: function () {
        var res = [];
        for (var yy = 0; yy < h; yy++) {
          var s = '';
          for (var xx = 0; xx < w; xx++) {
            var ch = g[yy][xx];
            if (ch === '.' && ((xx > 0 && g[yy][xx - 1] !== '.') || (xx < w - 1 && g[yy][xx + 1] !== '.') || (yy > 0 && g[yy - 1][xx] !== '.') || (yy < h - 1 && g[yy + 1][xx] !== '.'))) ch = 'o';
            s += ch;
          }
          res.push(s);
        }
        return res;
      }
    };
    return o;
  }
  function flashOf(img) {
    var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  var PAL = { o: '#0b0714', K: '#1a0f2e', B: '#e8f0ff', H: '#ffffff', S: '#8aa0d0', A: '#ff4d6d', k: '#6cf0ff', w: '#ffffff', G: '#4a5270', D: '#171b2c', R: '#ff3b5c', r: '#a81c3c', Y: '#ffe45e', C: '#5ff0ff', g: '#5a6a90', P: '#b455ff', p: '#6a2aa8', Q: '#e0b8ff', T: '#d8ae64', t: '#a07a3c', E: '#5ff0ff', V: '#8a3fe8', M: '#ff4fb0', N: '#ffd0f0', F: '#ff9e3d', L: '#7fe88a', l: '#2f8f4a', X: '#2a2f48' };
  var SPR = {};

  function buildSprites() {
    var gr, b;
    /* player in three bank frames */
    SPR.player = [];
    for (b = -1; b <= 1; b++) {
      gr = Grid(21, 17);
      gr.bx(9, 3, 11, 13, 'B'); gr.bx(10, 1, 10, 2, 'B'); gr.bx(9, 2, 11, 2, 'H');
      gr.bx(9, 4, 11, 7, 'k'); gr.px(9, 4, 'w'); gr.px(9, 5, 'w'); gr.px(10, 7, 'K'); gr.px(11, 7, 'K');
      gr.bm(2, 8, 8, 10, 'B'); gr.bm(0, 9, 4, 12, 'S'); gr.bm(5, 7, 8, 8, 'H'); gr.bm(0, 7, 1, 11, 'A');
      gr.bx(10, 8, 10, 12, 'A'); gr.bm(6, 11, 8, 13, 'S'); gr.bm(4, 11, 6, 14, 'G'); gr.bm(5, 13, 5, 14, 'D');
      (function (bb) { gr.shear(function (x) { return Math.round(bb * (x - 10) / 10 * 2.2); }); })(b);
      SPR.player[b + 1] = R.sprite(gr.rows(), PAL);
    }
    /* enemies */
    gr = Grid(15, 11);
    gr.half(['.......K', '......KC', '.....KRC', 'KK..KRRR', 'KRK.KRRR', 'KRRKKRrR', 'KRRRRRRY', '.KRRRRRR', '..KrRRYY', '...KKrRR', '.....KKK']);
    SPR.dart = R.sprite(gr.rows(), PAL);
    gr = Grid(17, 13);
    gr.half(['......KKK', '....KKLLL', '...KLLLLl', 'KK.KLRLLl', 'KLKKLLLLl', 'KLLLlYYYl', '.KLLLlYYl', '..KLLLlLl', '...KKLLLl', '.....KKKK', '.......KK', '........K', '........K']);
    SPR.scarab = R.sprite(gr.rows(), PAL);
    gr = Grid(15, 15);
    gr.disc(7, 7, 6, 'p'); gr.disc(7, 7, 5, 'P'); gr.disc(5, 5, 2, 'Q'); gr.bx(0, 7, 14, 7, 'p'); gr.bx(1, 8, 13, 8, 'P'); gr.disc(7, 7, 2, 'Y'); gr.px(7, 7, 'w'); gr.px(7, 0, 'Y'); gr.px(7, 14, 'Y'); gr.px(0, 7, 'Y'); gr.px(14, 7, 'Y');
    SPR.orb = R.sprite(gr.rows(), PAL);
    gr = Grid(15, 13);
    gr.half(['.....KKK', '....KGHH', '...KGHHG', '..KGGGKK', '..KGGKRR', '..KGGKRR', '..KGGGKK', '.KKGGGGG', 'KGGGgggg', 'KGGGGGGG', 'KKKKKKKK']);
    SPR.turret = R.sprite(gr.rows(), PAL);
    /* bosses */
    gr = Grid(41, 30);
    gr.bm(0, 12, 14, 14, 'g'); gr.bm(1, 10, 12, 11, 'G'); gr.bm(3, 15, 15, 17, 'g'); gr.bm(0, 13, 3, 16, 'D'); gr.bm(2, 8, 4, 11, 'Y');
    gr.bx(13, 3, 27, 24, 'G'); gr.bx(14, 3, 26, 4, 'H'); gr.bx(13, 20, 27, 24, 'g'); gr.bm(11, 6, 12, 20, 'g');
    gr.bx(16, 5, 24, 10, 'C'); gr.bx(17, 5, 19, 6, 'w'); gr.bx(16, 10, 24, 10, 'K');
    gr.bx(17, 13, 23, 19, 'R'); gr.bx(18, 14, 22, 18, 'Y'); gr.bx(19, 15, 21, 17, 'w');
    gr.bm(5, 16, 8, 26, 'D'); gr.bm(5, 25, 8, 27, 'Y'); gr.bm(6, 17, 7, 24, 'g');
    gr.bm(10, 22, 12, 26, 'D'); gr.bm(10, 26, 12, 28, 'F'); gr.bx(13, 12, 27, 12, 'Y'); gr.bx(13, 21, 27, 21, 'Y');
    SPR.boss1 = R.sprite(gr.rows(), PAL);
    gr = Grid(41, 34);
    gr.bx(14, 0, 26, 8, 'T'); gr.bx(14, 0, 26, 1, 'H'); gr.bm(16, 3, 18, 4, 'E'); gr.bx(17, 7, 23, 7, 't'); gr.bx(17, 9, 23, 10, 't');
    gr.bx(9, 10, 31, 26, 'T'); gr.bx(9, 10, 31, 11, 'H'); gr.bx(9, 24, 31, 27, 't');
    gr.bm(1, 8, 9, 14, 't'); gr.bm(2, 8, 8, 9, 'H'); gr.bm(3, 11, 4, 12, 'E');
    gr.bm(0, 15, 6, 27, 'T'); gr.bm(0, 26, 8, 32, 't'); gr.bm(1, 27, 3, 29, 'H');
    gr.disc(20, 17, 5, 'D'); gr.disc(20, 17, 4, 'R'); gr.disc(20, 17, 2, 'Y');
    gr.bm(11, 14, 13, 14, 'E'); gr.bm(11, 19, 13, 19, 'E'); gr.bm(11, 22, 12, 22, 'E'); gr.bm(10, 28, 15, 33, 't');
    SPR.boss2 = R.sprite(gr.rows(), PAL);
    gr = Grid(41, 38);
    gr.bx(19, 0, 21, 5, 'C'); gr.bx(18, 5, 22, 7, 'C'); gr.bm(7, 3, 9, 9, 'C'); gr.bm(10, 6, 12, 10, 'C'); gr.bx(19, 31, 21, 37, 'C'); gr.bx(18, 30, 22, 32, 'C');
    gr.bm(0, 12, 6, 26, 'C'); gr.bm(1, 14, 3, 24, 'w'); gr.bm(0, 18, 1, 20, 'M');
    gr.disc(20, 19, 14, 'p'); gr.disc(20, 19, 13, 'V'); gr.disc(19, 18, 10, 'M'); gr.disc(15, 13, 5, 'N');
    gr.disc(20, 20, 7, 'K'); gr.disc(20, 20, 6, 'Y'); gr.bx(19, 14, 21, 26, 'K'); gr.px(18, 18, 'w'); gr.px(18, 19, 'w');
    gr.bm(9, 28, 12, 31, 'C'); gr.bm(8, 14, 9, 14, 'w');
    SPR.boss3 = R.sprite(gr.rows(), PAL);
    ['dart', 'scarab', 'orb', 'turret', 'boss1', 'boss2', 'boss3'].forEach(function (k) { SPR[k + 'F'] = flashOf(SPR[k]); });
  }

  /* ------------------------------------------------------------------ themes */
  var THEMES = [
    { name: 'SKY CANYON', music: 'space', fog: '#d8f2ff', ga: '#58cf56', gb: '#3aa84a', sky: ['#1f6fd0', '#2f84dc', '#4698e6', '#62acee', '#82c2f4', '#a4d6f8', '#c6e8fb', '#e2f4fd', '#f6fbff'], accent: '#7fe88a' },
    { name: 'DESERT RUINS', music: 'space', fog: '#ffd4a0', ga: '#f3c66c', gb: '#d9a24a', sky: ['#3a1a6a', '#5a2478', '#80307e', '#a8407a', '#cc5870', '#e8726a', '#f8946a', '#ffb878', '#ffdca0'], accent: '#ffb000' },
    { name: 'CRYSTAL VOID', music: 'space', fog: '#7a2aa0', ga: '#35188a', gb: '#4f2aa8', sky: ['#04021a', '#0a0430', '#120648', '#1e0a62', '#30107a', '#4a1690', '#7220a0', '#a02ca8', '#d03cae'], accent: '#5ff0ff' }
  ];
  function prepTheme(ti) {
    var T = THEMES[ti];
    T.fa = fogArr(T.ga, T.fog); T.fb = fogArr(T.gb, T.fog);
    T.fm = T.fa.map(function (a, i) { var x = hex(T.ga), y = hex(T.gb), f = hex(T.fog); return rgb(mixc(mixc(x, y, 0.5), f, i / LV * 0.94)); });
    T.skyImg = layer(W, HZ + 1, function (g) {
      var n = T.sky.length, bh = Math.ceil((HZ + 1) / n), i;
      for (i = 0; i < n; i++) rc(g, 0, i * bh, W, bh, T.sky[i]);
      if (ti === 0) {
        g.globalAlpha = 0.25; disc(g, 100, 30, 20, '#ffffff'); g.globalAlpha = 0.5; disc(g, 100, 30, 13, '#fff6c8'); g.globalAlpha = 1; disc(g, 100, 30, 8, '#fffbe0');
      } else if (ti === 1) {
        g.globalAlpha = 0.25; disc(g, 40, 50, 28, '#ffd880'); g.globalAlpha = 0.4; disc(g, 40, 50, 20, '#ffd070'); g.globalAlpha = 1; disc(g, 40, 50, 14, '#ffe090'); disc(g, 40, 50, 10, '#fff0b8');
        for (i = 0; i < 4; i++) rc(g, 20, 46 + i * 3, 40, 1, T.sky[6]);
      } else {
        for (i = 0; i < 60; i++) { g.globalAlpha = 0.3 + hash(i * 3) * 0.7; rc(g, Math.floor(hash(i * 7 + 1) * W), Math.floor(hash(i * 13 + 5) * 50), 1, 1, '#ffffff'); }
        g.globalAlpha = 0.18; disc(g, 30, 22, 24, '#ff5ea8'); disc(g, 52, 30, 20, '#5ff0ff'); g.globalAlpha = 1;
        disc(g, 98, 28, 15, '#2a1070'); disc(g, 98, 28, 14, '#7a3fe8'); disc(g, 94, 24, 8, '#a87aff'); disc(g, 98, 28, 14, '#7a3fe8');
        g.strokeStyle = '#5ff0ff'; g.lineWidth = 2; g.beginPath(); g.ellipse(98, 29, 27, 5, -0.3, 0, 7); g.stroke();
        g.fillStyle = '#7a3fe8'; g.beginPath(); g.arc(98, 28, 14, 0.15 * Math.PI, 0.85 * Math.PI); g.fill();
      }
    });
    function puffs(seed, col, shade, hmax) {
      return layer(272, hmax, function (g) {
        for (var i = 0; i < 5; i++) {
          var cx = Math.floor((i + hash(seed + i) * 0.7) * 272 / 5), cy = 8 + Math.floor(hash(seed + i * 3) * (hmax - 20)), s = 5 + Math.floor(hash(seed + i * 5) * 5);
          for (var o = -1; o <= 1; o++) { var x0 = cx + o * 272; disc(g, x0, cy, s, col); disc(g, x0 - s, cy + 2, s - 2, col); disc(g, x0 + s, cy + 2, s - 3, col); rc(g, x0 - s * 2, cy + s - 1, s * 4, 1, shade); }
        }
      });
    }
    function ridge(seed, col, top, amp, h) {
      return layer(272, h, function (g) {
        var k = 2 * Math.PI / 272, s1 = hash(seed) * 6, s2 = hash(seed + 1) * 6;
        for (var x = 0; x < 272; x++) { var v = Math.sin(x * k * 3 + s1) * 0.6 + Math.sin(x * k * 8 + s2) * 0.4, y = Math.round(h - amp * (0.5 + 0.5 * v) - 2); rc(g, x, y, 1, h - y, col); if (top) rc(g, x, y, 1, 1, top); }
      });
    }
    function pyramids(seed, col, shade, h) {
      return layer(272, h, function (g) {
        for (var i = 0; i < 4; i++) {
          var cx = Math.floor((i + 0.3 + hash(seed + i) * 0.4) * 68), hh = 8 + Math.floor(hash(seed + i * 3) * (h - 10)), hw = hh * 1.6;
          for (var y = 0; y < hh; y++) { var half = Math.round(hw * (y / hh)); rc(g, cx - half, h - hh + y, half, 1, col); rc(g, cx, h - hh + y, half, 1, shade); }
        }
        for (var i2 = 0; i2 < 272; i2++) { var d = Math.round(2 + 2 * Math.sin(i2 * 0.09 + seed)); rc(g, i2, h - d, 1, d, col); }
      });
    }
    function spikes(seed, col, hi, h) {
      return layer(272, h, function (g) {
        for (var i = 0; i < 14; i++) {
          var cx = Math.floor((i + hash(seed + i) * 0.8) * 272 / 14), hh = 6 + Math.floor(hash(seed + i * 3) * (h - 8)), hw = 2 + Math.floor(hash(seed + i * 5) * 3);
          for (var o = -1; o <= 1; o++) for (var y = 0; y < hh; y++) { var half = Math.round(hw * (y / hh)); rc(g, cx + o * 272 - half, h - hh + y, half * 2 + 1, 1, col); rc(g, cx + o * 272 - half, h - hh + y, Math.max(1, half), 1, hi); }
        }
      });
    }
    if (ti === 0) { T.lay = [{ img: ridge(3, '#7fa8d8', '#a6c6ec', 22, 26), f: 0.18, y: HZ - 25 }, { img: ridge(9, '#4a8a70', '#6cb090', 14, 18), f: 0.4, y: HZ - 17 }]; T.cloud = puffs(5, '#ffffff', '#cfe4f6', 40); }
    else if (ti === 1) { T.lay = [{ img: pyramids(11, '#c0603c', '#8a3a2a', 24), f: 0.18, y: HZ - 23 }, { img: ridge(17, '#b8502e', '#d87a48', 10, 14), f: 0.4, y: HZ - 13 }]; T.cloud = puffs(7, '#ffb090', '#e07a78', 40); }
    else { T.lay = [{ img: spikes(23, '#4a1a8a', '#7a3ac8', 26), f: 0.18, y: HZ - 25 }, { img: spikes(31, '#2a0e60', '#4a22a0', 16), f: 0.4, y: HZ - 15 }]; T.cloud = null; }
  }

  var STAGES = [
    { name: 'SKY CANYON', theme: 0, time: 44, boss: { name: 'HORNET', hp: 70, spr: 'boss1', w: 0.5, h: 0.3, pts: 3000 }, tag: 'STAGE 1' },
    { name: 'DESERT RUINS', theme: 1, time: 48, boss: { name: 'COLOSSUS', hp: 105, spr: 'boss2', w: 0.5, h: 0.34, pts: 5000 }, tag: 'STAGE 2' },
    { name: 'CRYSTAL VOID', theme: 2, time: 52, boss: { name: 'NOVA CORE', hp: 150, spr: 'boss3', w: 0.5, h: 0.38, pts: 8000 }, tag: 'STAGE 3' }
  ];
  var ET = {
    dart: { hp: 1, w: 0.17, h: 0.12, pts: 100, vz: -46 },
    scarab: { hp: 4, w: 0.24, h: 0.17, pts: 300, vz: -32 },
    orb: { hp: 1, w: 0.14, h: 0.14, pts: 150, vz: -44 },
    turret: { hp: 3, w: 0.17, h: 0.2, pts: 250, vz: -SCROLL }
  };

  /* -------------------------------------------------------------------- state */
  var px, py, pvx, pvy, bank, bombs, shieldT, rapidT, inv, respawnT, fireT, altSide, stageNo, st, T, stageT, phase, phaseT, tm, scroll, dirT, banner, chain, kills, camx;
  var ents, bolts, lasers, rings, boss, bossDeadT, warnT, lockTarget, sfxT, tension, tensionT, bombFx, patN, lastPow, flashHit, music, heart, lifeFlash;
  var tS, tX, tY, tG;

  function proj(x, y, z) { tS = F / (F + z); tX = CX + (x - camx) * SX * tS; tG = HZ + (GRND - HZ) * tS; tY = tG - y * SY * tS; }
  function say(text, color, t) { banner = { text: text, color: color || '#fff', t: t || 1.6 }; }
  function setMusic(n, now) { if (music !== n) { music = n; if (now) R.music.play(n); } }

  /* ----------------------------------------------------------------- spawning */
  function addEnt(t, x, y, z, o) {
    var d = ET[t], e = { t: t, x: x, y: y, z: z, hp: d.hp, w: d.w, h: d.h, vz: d.vz, age: 0, fireT: U.rand(0.8, 2.4), flash: 0, mx: 'none', pxp: x, vxw: 0, x0: x, y0: y, dead: false };
    if (o) for (var k in o) e[k] = o[k];
    ents.push(e); return e;
  }
  function addObs(kind, x, h, z, o) {
    var e = { t: 'obs', kind: kind, x: x, y: 0, z: z, h: h, w: kind === 'tree' ? 0.2 : kind === 'float' ? 0.2 : 0.17, hw: kind === 'tree' ? 0.2 : kind === 'float' ? 0.2 : 0.17, vz: -SCROLL, age: 0, dead: false, seed: Math.floor(Math.random() * 1000) };
    if (kind === 'float') { e.y = U.rand(0.3, 0.75); e.h = 0.3; }
    if (o) for (var k in o) e[k] = o[k];
    ents.push(e); return e;
  }
  function addGate(x, y, z) { ents.push({ t: 'gate', x: x, y: y, z: z, vz: -SCROLL, age: 0, done: false, dead: false }); }
  function addPow(kind, x, y, z) { ents.push({ t: 'pow', kind: kind, x: x, y: y, z: z, vz: -SCROLL * 0.85, age: 0, dead: false }); }

  function skin(kind) {
    if (stageNo === 3 && Math.random() < 0.35) return 'float';
    return kind;
  }
  function pVee() {
    var xc = U.rand(-0.5, 0.5), y0 = U.rand(0.5, 0.85), i, a;
    for (i = 0; i < 5; i++) { a = Math.abs(i - 2); addEnt('dart', xc + (i - 2) * 0.3, y0 + a * 0.06, ZF + a * 8, { mx: 'drift', dx: (xc < 0 ? 0.12 : -0.12) }); }
  }
  function pWave() {
    var n = 6, ph = U.rand(0, 6), y0 = U.rand(0.4, 0.85), amp = U.rand(0.55, 0.8), i;
    for (i = 0; i < n; i++) addEnt('dart', 0, y0, ZF + i * 7, { mx: 'sine', amp: amp, w: 1.6, ph: ph, off: i * -0.16 });
  }
  function pOrbs() {
    var cx = U.rand(-0.4, 0.4), cy = U.rand(0.5, 0.8), i;
    for (i = 0; i < 4; i++) addEnt('orb', cx, cy, ZF, { mx: 'ring', cx: cx, cy: cy, r: 0.38, w: 2.2, ph: i * Math.PI / 2 });
  }
  function pScarab() {
    var n = 1 + Math.floor(Math.random() * (stageNo > 1 ? 3 : 2)), i;
    for (i = 0; i < n; i++) addEnt('scarab', U.rand(-0.6, 0.6), U.rand(0.45, 0.85), ZF + i * 14, { mx: 'sway', ph: U.rand(0, 6) });
  }
  function pRocks() {
    var gx = U.rand(-0.8, 0.8), x, hs = [0.55, 1.35, 1.35];
    for (x = -1.2; x <= 1.21; x += 0.38) if (Math.abs(x - gx) > 0.52) addObs(skin('col'), x, U.pick(hs), ZF);
  }
  function pForest() {
    var i;
    for (i = 0; i < 8; i++) addObs(skin(Math.random() < 0.5 ? 'tree' : 'col'), U.rand(-1.15, 1.15), Math.random() < 0.5 ? U.rand(0.35, 0.55) : U.rand(0.9, 1.3), ZF + i * U.rand(6, 10));
  }
  function pTurrets() {
    var xs = Math.random() < 0.5 ? [-0.7, 0, 0.7] : [-0.4, 0.4], i;
    for (i = 0; i < xs.length; i++) { var t = addEnt('turret', xs[i] + U.rand(-0.1, 0.1), 0, ZF + i * 12, { mx: 'ground' }); t.cy = 0.14; }
    addObs(skin('col'), U.rand(-1, 1), 1.3, ZF + 20);
  }
  function pGates() {
    var n = 4, x0 = U.rand(-0.5, 0.5), y0 = U.rand(0.35, 0.8), dx = U.rand(-0.22, 0.22), dy = U.rand(-0.1, 0.1), i;
    for (i = 0; i < n; i++) addGate(U.clamp(x0 + dx * i, -0.85, 0.85), U.clamp(y0 + dy * i, 0.3, 0.95), ZF + i * 22);
    if (stageNo > 1) addObs(skin('col'), U.clamp(x0 + 0.7, -1.1, 1.1), 1.3, ZF + 30);
  }
  function pPow() {
    var k = U.pick(['S', 'R', 'S', 'R', 'B']);
    addPow(k, U.rand(-0.7, 0.7), U.rand(0.4, 0.8), ZF); lastPow = stageT;
  }
  function director(dt) {
    dirT -= dt;
    if (dirT > 0) return;
    var d = stageNo - 1 + stageT / st.time, tab;
    if (stageNo === 1) tab = [[pVee, 4], [pWave, 4], [pRocks, 3], [pForest, 3], [pGates, 2], [pTurrets, 1]];
    else if (stageNo === 2) tab = [[pVee, 3], [pWave, 3], [pRocks, 2], [pForest, 3], [pGates, 2], [pTurrets, 3], [pOrbs, 2], [pScarab, 2]];
    else tab = [[pVee, 2], [pWave, 3], [pRocks, 3], [pForest, 2], [pGates, 2], [pTurrets, 2], [pOrbs, 3], [pScarab, 3]];
    var tot = 0, i, r;
    tab.forEach(function (t) { tot += t[1]; });
    r = Math.random() * tot;
    var fn = tab[0][0];
    for (i = 0; i < tab.length; i++) { r -= tab[i][1]; if (r <= 0) { fn = tab[i][0]; break; } }
    if (stageT - lastPow > 22) fn = pPow;
    fn(); patN++;
    dirT = Math.max(1.5, (3.4 - d * 0.55)) * U.rand(0.8, 1.2);
  }

  /* ------------------------------------------------------------------- combat */
  function fireBolt(x, y, z, tx, ty, speed, o) {
    var tt = Math.max(0.2, z / speed), b = { x: x, y: y, z: z, vx: (tx - x) / tt, vy: (ty - y) / tt, vz: -speed, age: 0 };
    if (o) for (var k in o) b[k] = o[k];
    bolts.push(b); return b;
  }
  function boom(x, y, z, big) {
    proj(x, y, z);
    R.fx.burst(tX, tY, { n: big ? 44 : 16, color: ['#ffffff', '#ffe45e', '#ff9e3d', '#ff3b5c'], speed: big ? 130 : 70, life: big ? 0.8 : 0.5, size: big ? 3 : 2, gravity: big ? 40 : 20 });
    rings.push({ x: tX, y: tY, r: 2, vr: big ? 110 : 55, t: big ? 0.5 : 0.3, t0: big ? 0.5 : 0.3, col: big ? '#ffe45e' : '#ffffff' });
    if (big) { R.fx.shake(4, 0.4); R.fx.flash('#ffffff', 0.18); }
    if (sfxT <= 0) { sfxT = 0.05; R.sfx.play('explode'); }
  }
  function killEnt(e, byBomb) {
    e.dead = true; kills++;
    var pts = ET[e.t].pts; R.addScore(pts);
    boom(e.x, e.y + (e.cy || 0), e.z, false);
    proj(e.x, e.y + (e.cy || 0), e.z); R.fx.text(tX, tY - 6, '+' + pts, '#ffe45e');
    if (e.t === 'scarab' && Math.random() < 0.35) addPow(U.pick(['S', 'R', 'B']), e.x, Math.max(0.35, e.y), e.z);
    return 1;
  }
  function hurtPlayer() {
    if (inv > 0 || respawnT > 0 || phase === 'clear') return;
    if (shieldT > 0) {
      shieldT = 0; inv = 1.2; R.sfx.play('powerup'); R.vibrate(25); R.fx.flash('#6cf0ff', 0.18);
      proj(px, py, 0); R.fx.burst(tX, tY, { n: 20, color: ['#6cf0ff', '#ffffff'], speed: 90, life: 0.5, size: 2 }); return;
    }
    R.lives = Math.max(0, R.lives - 1); lifeFlash = 0.5;
    R.sfx.play('explode'); R.sfx.play('hit'); R.vibrate(140); R.fx.shake(5, 0.5); R.fx.flash('#ff3b5c', 0.25);
    boom(px, py, 0, true);
    rapidT = 0; chain = 0;
    if (R.lives <= 0) { phase = 'dead'; phaseT = 0; respawnT = 99; R.sfx.play('lose'); return; }
    respawnT = 1.4;
  }
  function damageEnt(e, n) {
    e.hp -= n; e.flash = 0.07;
    if (e.hp <= 0 && !e.dead) killEnt(e, false);
    else if (sfxT <= 0) { sfxT = 0.03; R.sfx.tone(520 + Math.random() * 200, 0.03, { vol: 0.05, type: 'square' }); }
  }
  function damageBoss(n) {
    if (!boss || boss.dying) return;
    boss.hp -= n; if (boss.flashCd <= 0) { boss.flash = 0.05; boss.flashCd = 0.17; }
    if (sfxT <= 0) { sfxT = 0.04; R.sfx.tone(180 + Math.random() * 60, 0.05, { vol: 0.08, type: 'sawtooth' }); }
    if (boss.hp <= 0) bossDown();
  }
  function bossDown() {
    boss.dying = true; boss.hp = 0; bossDeadT = 0; bolts.length = 0;
    R.addScore(st.boss.pts); R.sfx.play('explode'); R.vibrate(200);
    say(st.boss.name + ' DESTROYED!', '#ffe45e', 3);
    if (stageNo === 1) R.achieve('boss-one');
    if (stageNo === 3) R.achieve('nova-champion');
  }
  function useBomb() {
    if (bombs <= 0 || respawnT > 0 || bombFx > 0) return;
    bombs--; bombFx = 0.55;
    R.sfx.play('explode'); R.sfx.noise(0.6, { vol: 0.25, freq: 4000, sweep: 100 }); R.sfx.tone(120, 0.5, { type: 'sawtooth', slide: 30, vol: 0.18 });
    R.vibrate(80); R.fx.flash('#ffffff', 0.3); R.fx.shake(4, 0.5);
    var n = 0, i, e;
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      if (e.dead || ET[e.t] === undefined || e.z > 135 || e.z < 0) continue;
      e.dead = true; kills++; n++; R.addScore(ET[e.t].pts); boom(e.x, e.y + (e.cy || 0), e.z, false);
      if (e.t === 'scarab' && Math.random() < 0.35) addPow(U.pick(['S', 'R', 'B']), e.x, Math.max(0.35, e.y), e.z);
    }
    for (i = 0; i < bolts.length; i++) { proj(bolts[i].x, bolts[i].y, bolts[i].z); R.fx.burst(tX, tY, { n: 3, color: ['#ffffff', '#ffe45e'], speed: 40, life: 0.3, size: 1 }); }
    bolts.length = 0;
    if (boss && !boss.dying && boss.z < 140) damageBoss(22);
    if (n >= 4) R.achieve('bomb-blast');
    rings.push({ x: CX, y: HZ + 40, r: 4, vr: 220, t: 0.55, t0: 0.55, col: '#ffffff' });
    rings.push({ x: CX, y: HZ + 40, r: 2, vr: 160, t: 0.55, t0: 0.55, col: '#6cf0ff' });
  }

  function pickTarget() {
    var best = null, bs = 1e9, i, e, tx, ty, d, sc;
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      if (e.dead || !ET[e.t] || e.z < 5 || e.z > 140) continue;
      tx = e.x; ty = e.y + (e.cy || 0); d = Math.sqrt((tx - px) * (tx - px) + (ty - py) * (ty - py));
      if (d < 0.36 + e.w) { sc = d + e.z * 0.003; if (sc < bs) { bs = sc; best = e; } }
    }
    if (boss && !boss.dying && boss.z < 140) { d = Math.sqrt((boss.x - px) * (boss.x - px) + (boss.y - py) * (boss.y - py)); if (d < 0.5 + boss.w && d + boss.z * 0.003 < bs) best = boss; }
    return best;
  }
  function fireLaser() {
    var tg = lockTarget, x0 = px + (altSide ? 0.08 : -0.08), vx = 0, vy = 0;
    altSide = !altSide;
    if (tg) {
      var tt = Math.max(0.05, (tg.z - 2) / LASER_V), tx = tg.x + (tg.vxw || 0) * tt, ty = tg.y + (tg.cy || 0);
      vx = (tx - x0) / tt; vy = (ty - py) / tt;
    }
    if (lasers.length < 40) lasers.push({ x: x0, y: py, z: 2, vx: vx, vy: vy, hit: false });
    R.sfx.tone(1250, 0.05, { vol: 0.03, type: 'square', slide: 520 });
  }

  /* ------------------------------------------------------------------- update */
  function startStage(n) {
    stageNo = n; st = STAGES[n - 1]; T = THEMES[st.theme]; R.level = n;
    ents.length = 0; bolts.length = 0; lasers.length = 0; boss = null; stageT = 0; phase = 'intro'; phaseT = 0; dirT = 1.2; patN = 0; lastPow = 0; warnT = 0;
    say(st.tag + '  ' + st.name, T.accent, 2.4);
    setMusic(T.music, n > 1);
  }

  function reset() {
    px = 0; py = 0.5; pvx = 0; pvy = 0; bank = 0; bombs = 3; shieldT = 0; rapidT = 0; inv = 1.5; respawnT = 0; fireT = 0; altSide = false; chain = 0; kills = 0; tm = 0; scroll = 0; camx = 0;
    ents = []; bolts = []; lasers = []; rings = []; boss = null; bossDeadT = 0; lockTarget = null; sfxT = 0; tension = 0; tensionT = 0; bombFx = 0; flashHit = 0; heart = 0; lifeFlash = 0; banner = null; music = null;
    R.lives = 3; R.score = 0;
    startStage(1);
  }

  function updateBoss(dt) {
    var b = boss, bd = st.boss;
    b.t += dt; if (b.flash > 0) b.flash -= dt; if (b.flashCd > 0) b.flashCd -= dt;
    if (b.dying) {
      bossDeadT += dt;
      if (Math.random() < 0.5) { boom(b.x + U.rand(-0.4, 0.4), b.y + U.rand(-0.3, 0.3), b.z, false); R.vibrate(10); }
      if (bossDeadT > 2.2) {
        boom(b.x, b.y, b.z, true); boss = null; phase = 'clear'; phaseT = 0;
        var bonus = R.lives * 1000 + bombs * 500; R.addScore(bonus);
        say('STAGE CLEAR  +' + bonus, '#ffe45e', 3.2); R.sfx.play('win'); R.fx.flash('#ffffff', 0.4);
        for (var i = 0; i < 20; i++) R.fx.burst(U.rand(10, W - 10), U.rand(20, 100), { n: 3, color: ['#ffe45e', '#ff5ea8', '#5ff0ff', '#7fe88a', '#ffffff'], speed: 70, life: 1.0, size: 2, gravity: 50 });
      }
      return;
    }
    if (b.z > 46) { b.z = Math.max(46, b.z - 52 * dt); b.y = 0.6; return; }
    var k = 0.8 + stageNo * 0.12 + (b.hp < bd.hp * 0.5 ? 0.35 : 0);
    b.x = 0.62 * Math.sin(b.t * k) * (stageNo === 3 ? 1.1 : 1); b.y = 0.6 + 0.24 * Math.sin(b.t * 1.3 * k + 1);
    b.atkT -= dt;
    if (b.atkT <= 0) {
      var enraged = b.hp < bd.hp * 0.5, n = b.n++;
      if (stageNo === 1) {
        if (n % 3 === 2 && enraged) bossRing(10); else bossAim(3 + (enraged ? 2 : 0), 0.22);
        b.atkT = enraged ? 1.1 : 1.5;
      } else if (stageNo === 2) {
        if (n % 3 === 1) bossSweep(); else bossAim(3, 0.28);
        if (enraged && n % 4 === 3) { addEnt('dart', b.x - 0.3, b.y, b.z, { mx: 'drift', dx: -0.1 }); addEnt('dart', b.x + 0.3, b.y, b.z, { mx: 'drift', dx: 0.1 }); }
        b.atkT = enraged ? 1.15 : 1.6;
      } else {
        var m = n % 4;
        if (m === 0) bossRing(12); else if (m === 1) bossAim(5, 0.2); else if (m === 2) bossSweep(); else bossRing(8);
        if (enraged && n % 3 === 0) addEnt('orb', b.x, b.y, b.z, { mx: 'ring', cx: 0, cy: 0.6, r: 0.5, w: 2.4, ph: U.rand(0, 6) });
        b.atkT = enraged ? 0.95 : 1.4;
      }
    }
  }
  function bossAim(n, spread) {
    var i;
    for (i = 0; i < n; i++) fireBolt(boss.x, boss.y, boss.z, px + (i - (n - 1) / 2) * spread, py + (i % 2 ? 0.08 : -0.08), BOLT_V);
    R.sfx.tone(300, 0.2, { type: 'sawtooth', vol: 0.07, slide: 120 });
  }
  function bossRing(n) {
    var i;
    for (i = 0; i < n; i++) { var a = i / n * Math.PI * 2 + boss.t; var bb = fireBolt(boss.x, boss.y, boss.z, px, py, BOLT_V * 0.9); bb.vx = Math.cos(a) * 0.55; bb.vy = Math.sin(a) * 0.4; }
    R.sfx.tone(200, 0.3, { type: 'square', vol: 0.07, slide: 80 });
  }
  function bossSweep() {
    var gx = U.rand(-0.8, 0.8), x, yy = U.clamp(py + U.rand(-0.2, 0.2), 0.2, 1.0);
    for (x = -1.2; x <= 1.21; x += 0.28) if (Math.abs(x - gx) > 0.3) { var bb = fireBolt(boss.x, boss.y, boss.z, x, yy, BOLT_V * 0.85); bb.vx = (x - boss.x) / (boss.z / (BOLT_V * 0.85)); }
    R.sfx.tone(240, 0.35, { type: 'sawtooth', vol: 0.07, slide: 90 });
  }

  function update(dt) {
    var inp = R.input, i, e, b, L;
    tm += dt; phaseT += dt; scroll += SCROLL * dt;
    if (sfxT > 0) sfxT -= dt;
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (flashHit > 0) flashHit -= dt;
    if (lifeFlash > 0) lifeFlash -= dt;
    if (bombFx > 0) bombFx -= dt;
    if (inv > 0) inv -= dt;
    if (shieldT > 0) shieldT -= dt;
    if (rapidT > 0) rapidT -= dt;

    /* player */
    var ax = inp.axisX(), ay = -inp.axisY();
    if (phase === 'dead') { ax = 0; ay = 0; }
    pvx += (ax * 1.75 - pvx) * Math.min(1, dt * 10); pvy += (ay * 1.5 - pvy) * Math.min(1, dt * 10);
    if (respawnT > 0) {
      respawnT -= dt;
      if (respawnT <= 0 && phase !== 'dead') {
        px = 0; py = 0.5; pvx = 0; pvy = 0; inv = 2.6; shieldT = 0;
        for (i = bolts.length - 1; i >= 0; i--) if (bolts[i].z < 70) bolts.splice(i, 1);
        R.sfx.play('start');
      }
    } else {
      px = U.clamp(px + pvx * dt, -PX_MAX, PX_MAX); py = U.clamp(py + pvy * dt, PY_MIN, PY_MAX);
    }
    bank += (U.clamp(pvx / 1.75, -1, 1) - bank) * Math.min(1, dt * 9);
    camx += (px * 0.22 - camx) * Math.min(1, dt * 6);

    /* weapons */
    lockTarget = respawnT > 0 ? null : pickTarget();
    fireT -= dt;
    if (inp.held.a && respawnT <= 0 && phase !== 'dead' && phase !== 'clear') {
      if (fireT <= 0) { fireT = rapidT > 0 ? 0.065 : 0.11; fireLaser(); }
    }
    if (inp.pressed('b') && phase !== 'dead' && phase !== 'clear') useBomb();

    /* director / phases */
    if (phase === 'intro') { director(dt); if (phaseT > 1.5) { phase = 'play'; phaseT = 0; } }
    else if (phase === 'play') {
      stageT += dt; director(dt);
      if (stageT > st.time) { phase = 'warn'; phaseT = 0; warnT = 0; say('WARNING', '#ff3b5c', 3.2); setMusic('action', true); R.vibrate(60); }
    } else if (phase === 'warn') {
      warnT += dt;
      var sirenStep = Math.floor(warnT / 0.28);
      if (sirenStep !== Math.floor((warnT - dt) / 0.28)) R.sfx.tone(sirenStep % 2 ? 640 : 880, 0.24, { type: 'sawtooth', vol: 0.09 });
      if (phaseT > 3.4) {
        phase = 'boss'; phaseT = 0;
        boss = { x: 0, y: 0.6, z: 140, hp: st.boss.hp, t: 0, atkT: 1.8, n: 0, flash: 0, flashCd: 0, dying: false, w: st.boss.w, h: st.boss.h, vxw: 0, cy: 0 };
        say(st.boss.name, '#ff9e3d', 2.2);
      }
    } else if (phase === 'boss') {
      if (boss) updateBoss(dt);
    } else if (phase === 'clear') {
      if (boss) updateBoss(dt);
      if (phaseT > 3.6) {
        if (stageNo >= 3) { R.gameOver({ win: true }); return; }
        R.sfx.play('start'); startStage(stageNo + 1);
      }
    } else if (phase === 'dead') {
      if (phaseT > 2) { R.gameOver(); return; }
    }

    /* entities */
    for (i = ents.length - 1; i >= 0; i--) {
      e = ents[i];
      if (e.dead) { ents.splice(i, 1); continue; }
      var zPrev = e.z;
      e.age += dt; e.z += e.vz * dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.t === 'obs' || e.t === 'gate' || e.t === 'pow') {
        if (zPrev > 0 && e.z <= 0) {
          if (e.t === 'obs') { if (Math.abs(e.x - px) < e.hw + 0.09 && py < e.y + e.h + 0.04 && py > e.y - 0.06 && respawnT <= 0) { hurtPlayer(); } }
          else if (e.t === 'gate') {
            if (respawnT <= 0 && Math.abs(e.x - px) < 0.34 && Math.abs(e.y - py) < 0.34) {
              chain++; var pts = 500 + Math.min(chain - 1, 4) * 250; R.addScore(pts);
              R.sfx.tone(700 + chain * 120, 0.1, { vol: 0.12, type: 'triangle' }); R.sfx.tone(1050 + chain * 140, 0.16, { vol: 0.12, type: 'triangle', delay: 0.07 }); R.vibrate(15);
              proj(e.x, e.y, 0); R.fx.burst(tX, tY, { n: 18, color: ['#ffe45e', '#ff5ea8', '#ffffff'], speed: 80, life: 0.5, size: 2 }); R.fx.text(CX, 90, 'GATE +' + pts, '#ffe45e');
              if (chain >= 3) R.achieve('gate-runner');
              if (chain === 4) { addPow('R', e.x, e.y, 90); }
            } else { chain = 0; }
          } else if (e.t === 'pow') {
            if (respawnT <= 0 && Math.abs(e.x - px) < 0.3 && Math.abs(e.y - py) < 0.3) {
              collectPow(e); e.dead = true;
            }
          }
        }
        if (e.z < -10) e.dead = true;
        continue;
      }
      /* flying enemies and turrets */
      if (e.mx === 'drift') e.x += e.dx * dt;
      else if (e.mx === 'sine') e.x = e.amp * Math.sin(e.w * (e.age + e.off) + e.ph);
      else if (e.mx === 'ring') { var an = e.w * e.age + e.ph; e.x = e.cx + e.r * Math.cos(an); e.y = e.cy + e.r * Math.sin(an) * 0.8; }
      else if (e.mx === 'sway') { e.x = e.x0 + 0.4 * Math.sin(1.1 * e.age + e.ph); e.y = e.y0 + 0.1 * Math.sin(2 * e.age + e.ph); }
      e.vxw = (e.x - e.pxp) / Math.max(dt, 1e-4); e.pxp = e.x;
      /* shooting */
      e.fireT -= dt;
      if (e.fireT <= 0 && e.z > 30 && e.z < 115 && respawnT <= 0) {
        var rate = U.clamp(1.0 + (stageNo - 1) * 0.15, 1, 1.6);
        if (e.t === 'dart') { fireBolt(e.x, e.y, e.z, px, py, BOLT_V * 0.9); e.fireT = U.rand(1.6, 3.2) / rate; }
        else if (e.t === 'scarab') { for (var s3 = -1; s3 <= 1; s3++) fireBolt(e.x, e.y, e.z, px + s3 * 0.25, py, BOLT_V * 0.85); e.fireT = U.rand(2.0, 3.0) / rate; }
        else if (e.t === 'turret') { fireBolt(e.x, 0.22, e.z, px, py, BOLT_V * 0.9); e.fireT = U.rand(1.4, 2.4) / rate; }
        else e.fireT = 99;
      }
      /* collision with player when passing */
      if (zPrev > 0 && e.z <= 0 && respawnT <= 0 && Math.abs(e.x - px) < e.w + 0.1 && Math.abs(e.y + (e.cy || 0) - py) < e.h + 0.1) { e.dead = true; hurtPlayer(); boom(e.x, e.y, 0, false); }
      if (e.z < -12) e.dead = true;
    }

    /* enemy bolts */
    for (i = bolts.length - 1; i >= 0; i--) {
      b = bolts[i]; var bz = b.z; b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (bz > 0 && b.z <= 0) {
        var dxx = b.x - px, dyy = b.y - py;
        if (respawnT <= 0 && dxx * dxx + dyy * dyy < 0.16 * 0.16) hurtPlayer();
        bolts.splice(i, 1);
      } else if (b.z < -4) bolts.splice(i, 1);
    }

    /* player lasers */
    for (i = lasers.length - 1; i >= 0; i--) {
      L = lasers[i];
      var lz0 = L.z; L.x += L.vx * dt; L.y += L.vy * dt; L.z += LASER_V * dt;
      var removed = false, j, tg;
      /* obstacles block shots */
      for (j = 0; j < ents.length && !removed; j++) {
        tg = ents[j];
        if (tg.dead) continue;
        if (tg.t === 'obs') { if (tg.z >= lz0 - 1 && tg.z <= L.z + 1 && Math.abs(tg.x - L.x) < tg.hw && L.y < tg.y + tg.h && L.y > tg.y - 0.1) { removed = true; proj(L.x, L.y, tg.z); R.fx.burst(tX, tY, { n: 3, color: ['#ffffff', '#9aa'], speed: 30, life: 0.25, size: 1 }); } }
        else if (ET[tg.t]) {
          if (tg.z >= lz0 - 2 && tg.z <= L.z + 2 && Math.abs(tg.x - L.x) < tg.w + 0.07 && Math.abs(tg.y + (tg.cy || 0) - L.y) < tg.h + 0.07) { removed = true; damageEnt(tg, 1); proj(L.x, L.y, tg.z); R.fx.burst(tX, tY, { n: 4, color: ['#ffffff', '#6cf0ff'], speed: 45, life: 0.25, size: 1 }); }
        }
      }
      if (!removed && boss && !boss.dying && boss.z >= lz0 - 2 && boss.z <= L.z + 2 && Math.abs(boss.x - L.x) < boss.w + 0.05 && Math.abs(boss.y - L.y) < boss.h + 0.05) {
        removed = true; damageBoss(1); proj(L.x, L.y, boss.z); R.fx.burst(tX, tY, { n: 4, color: ['#ffffff', '#ffe45e'], speed: 50, life: 0.25, size: 1 });
      }
      if (removed || L.z > 170) lasers.splice(i, 1);
    }

    /* rings */
    for (i = rings.length - 1; i >= 0; i--) { rings[i].t -= dt; rings[i].r += rings[i].vr * dt; if (rings[i].t <= 0) rings.splice(i, 1); }

    /* tension layer: heartbeat pulses grow with danger */
    var lvl = (phase === 'boss' ? 1 : 0) + (boss && boss.hp < st.boss.hp * 0.5 ? 1 : 0) + (R.lives === 1 ? 1 : 0) + (phase === 'play' && stageT > st.time * 0.7 ? 0.5 : 0);
    tension = lvl;
    if (lvl >= 1 && phase !== 'dead' && phase !== 'clear') {
      tensionT -= dt;
      if (tensionT <= 0) { tensionT = lvl >= 2 ? 0.3 : 0.5; heart ^= 1; R.sfx.tone(heart ? 62 : 52, 0.12, { type: 'sine', vol: 0.18 }); if (lvl >= 3) R.sfx.tone(1600, 0.03, { vol: 0.03 }); }
    }
  }

  function collectPow(e) {
    R.sfx.play('powerup'); R.vibrate(20); R.addScore(100);
    proj(e.x, e.y, 0);
    R.fx.burst(tX, tY, { n: 16, color: ['#ffffff', '#ffe45e', '#6cf0ff'], speed: 70, life: 0.5, size: 2 });
    if (e.kind === 'S') { shieldT = 25; R.fx.text(CX, 100, 'SHIELD!', '#6cf0ff'); }
    else if (e.kind === 'R') { rapidT = 12; R.fx.text(CX, 100, 'RAPID FIRE!', '#ff9e3d'); }
    else { bombs = Math.min(5, bombs + 1); R.fx.text(CX, 100, 'BOMB +1', '#d8a0ff'); }
  }

  /* ---------------------------------------------------------------- rendering */
  function drawSky(ctx) {
    ctx.drawImage(T.skyImg, 0, 0);
    var ti = st.theme, i, L;
    if (T.cloud) { var cw = T.cloud.width, x0 = -(((tm * 4 + camx * 14) % cw) + cw) % cw; ctx.globalAlpha = 0.95; ctx.drawImage(T.cloud, Math.round(x0), 6); if (x0 + cw < W) ctx.drawImage(T.cloud, Math.round(x0 + cw), 6); ctx.globalAlpha = 1; }
    for (i = 0; i < T.lay.length; i++) { L = T.lay[i]; var lw = L.img.width, lx = -((((camx * 60 + tm * 1.5) * L.f * 3) % lw) + lw) % lw; ctx.drawImage(L.img, Math.round(lx), L.y); if (lx + lw < W) ctx.drawImage(L.img, Math.round(lx + lw), L.y); }
    if (ti === 2) { ctx.globalAlpha = 0.3; ctx.fillStyle = '#ff5ea8'; ctx.fillRect(0, HZ - 2, W, 2); ctx.globalAlpha = 1; }
  }

  function drawGround(ctx) {
    var r, s, D, lv, kz, par, tw, kmin, kmax, k, x0, x1, ca, cb, rowH, spanRows = F * (GRND - HZ), kk;
    for (r = HZ + 1; r < H; r++) {
      s = (r - HZ) / (GRND - HZ); D = F / s;
      lv = Math.min(LV, Math.max(0, Math.floor((0.6 - s) * 16)));
      tw = TX * SX * s; rowH = D * D / spanRows;
      if (tw < 2.6 || TZ / rowH < 1.7) { ctx.fillStyle = T.fm[lv]; ctx.fillRect(0, r, W, 1); continue; }
      kz = Math.floor((D + scroll) / TZ); par = kz & 1;
      ctx.fillStyle = par ? T.fb[lv] : T.fa[lv]; ctx.fillRect(0, r, W, 1);
      ctx.fillStyle = par ? T.fa[lv] : T.fb[lv];
      kmin = Math.floor((camx + (0 - CX) / (SX * s)) / TX) - 1; kmax = Math.ceil((camx + (W - CX) / (SX * s)) / TX);
      for (k = kmin; k <= kmax; k++) {
        if (!(k & 1)) continue;
        x0 = Math.round(CX + (k * TX - camx) * SX * s); x1 = Math.round(CX + ((k + 1) * TX - camx) * SX * s);
        if (x1 <= 0 || x0 >= W) continue;
        ctx.fillRect(x0, r, x1 - x0, 1);
      }
    }
    if (st.theme === 2) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#5ff0ff'; ctx.fillRect(0, HZ + 1, W, 1); ctx.globalAlpha = 1; }
  }

  function spriteAt(ctx, img, cx, cy, sc) {
    var w = img.width * sc, h = img.height * sc;
    if (w < 2) return;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
  }
  function shadow(ctx, x, gy, w, alpha) {
    ctx.globalAlpha = alpha; ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - w / 2), Math.round(gy), Math.max(2, Math.round(w)), Math.max(1, Math.round(w * 0.12))); ctx.globalAlpha = 1;
  }
  function rect(ctx, x, y, w, h, col) {
    var x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    if (x1 <= x0) x1 = x0 + 1; if (y1 <= y0) y1 = y0 + 1;
    ctx.fillStyle = col; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  function drawObs(ctx, e) {
    proj(e.x, e.y, e.z);
    var s = tS, wpx = e.hw * 2 * SX * s, hpx = e.h * SY * s, x = tX, yb = tG - e.y * SY * s, yt = yb - hpx, ti = st.theme, i;
    if (wpx < 1) return;
    shadow(ctx, x + wpx * 0.3, tG, wpx * 1.6, 0.28);
    if (e.kind === 'col') {
      var cl = ti === 0 ? ['#d9a878', '#b8845a', '#8a5e3c', '#e8c898'] : ti === 1 ? ['#f0c878', '#d9a24a', '#a8742c', '#ffe4a8'] : ['#9af0ff', '#3fb0f0', '#7a3fe8', '#e0ffff'];
      if (ti === 2) {
        ctx.fillStyle = cl[1]; ctx.beginPath(); ctx.moveTo(x - wpx / 2, yb); ctx.lineTo(x - wpx * 0.36, yt + hpx * 0.18); ctx.lineTo(x, yt); ctx.lineTo(x + wpx * 0.36, yt + hpx * 0.18); ctx.lineTo(x + wpx / 2, yb); ctx.closePath(); ctx.fill();
        ctx.fillStyle = cl[0]; ctx.beginPath(); ctx.moveTo(x - wpx / 2, yb); ctx.lineTo(x - wpx * 0.36, yt + hpx * 0.18); ctx.lineTo(x, yt); ctx.lineTo(x - wpx * 0.05, yb); ctx.closePath(); ctx.fill();
        ctx.fillStyle = cl[2]; ctx.beginPath(); ctx.moveTo(x + wpx * 0.36, yt + hpx * 0.18); ctx.lineTo(x, yt); ctx.lineTo(x + wpx * 0.12, yb); ctx.lineTo(x + wpx / 2, yb); ctx.closePath(); ctx.fill();
      } else {
        rect(ctx, x - wpx / 2, yt, wpx, hpx, cl[1]); rect(ctx, x - wpx / 2, yt, wpx * 0.35, hpx, cl[0]); rect(ctx, x + wpx * 0.2, yt, wpx * 0.3, hpx, cl[2]);
        rect(ctx, x - wpx * 0.6, yt - Math.max(1, 3 * s), wpx * 1.2, Math.max(2, 4 * s), cl[3]);
        for (i = 1; i < 5; i++) rect(ctx, x - wpx / 2, yt + hpx * i / 5, wpx, Math.max(1, s * 0.8), cl[2]);
        if (ti === 1) { rect(ctx, x - wpx * 0.12, yt + hpx * 0.2, Math.max(1, wpx * 0.24), Math.max(1, hpx * 0.1), '#7a4a20'); rect(ctx, x - wpx * 0.12, yt + hpx * 0.45, Math.max(1, wpx * 0.24), Math.max(1, hpx * 0.1), '#7a4a20'); }
      }
    } else if (e.kind === 'tree') {
      var tw2 = Math.max(1, wpx * 0.22), ch = hpx;
      if (ti === 1) {
        rect(ctx, x - tw2 / 2, yt + ch * 0.2, tw2, ch * 0.8, '#8a5a30');
        for (i = -2; i <= 2; i++) rect(ctx, x + i * wpx * 0.2 - wpx * 0.1, yt + ch * 0.1 + Math.abs(i) * ch * 0.08, wpx * 0.22, Math.max(1, ch * 0.12), (i & 1) ? '#2f9a4a' : '#4fc468');
      } else if (ti === 2) {
        for (i = -1; i <= 1; i++) { var ch2 = ch * (i === 0 ? 1 : 0.65), cx2 = x + i * wpx * 0.28; ctx.fillStyle = i === 0 ? '#ff7acc' : '#9af0ff'; ctx.beginPath(); ctx.moveTo(cx2 - wpx * 0.14, yb); ctx.lineTo(cx2, yb - ch2); ctx.lineTo(cx2 + wpx * 0.14, yb); ctx.closePath(); ctx.fill(); }
      } else {
        rect(ctx, x - tw2 / 2, yt + ch * 0.45, tw2, ch * 0.55, '#6b4a2e');
        var rr = Math.max(2, wpx * 0.5), cyc = yt + ch * 0.32;
        ctx.fillStyle = '#237a3a'; ctx.beginPath(); ctx.arc(x, cyc, rr, 0, 7); ctx.fill(); ctx.fillStyle = '#2fae4a'; ctx.beginPath(); ctx.arc(x - rr * 0.1, cyc - rr * 0.1, rr * 0.86, 0, 7); ctx.fill(); ctx.fillStyle = '#6fe07a'; ctx.beginPath(); ctx.arc(x - rr * 0.35, cyc - rr * 0.35, rr * 0.4, 0, 7); ctx.fill();
      }
    } else {   /* floating crystal rock */
      proj(e.x, e.y + e.h / 2 + 0.03 * Math.sin(e.age * 2 + e.seed), e.z); x = tX; var fy = tY; wpx = e.hw * 2.4 * SX * s;
      shadow(ctx, x, tG, wpx * 1.2, 0.28);
      ctx.fillStyle = '#6a3ac8'; ctx.beginPath(); ctx.moveTo(x, fy - wpx * 0.7); ctx.lineTo(x + wpx * 0.6, fy); ctx.lineTo(x, fy + wpx * 0.7); ctx.lineTo(x - wpx * 0.6, fy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a87aff'; ctx.beginPath(); ctx.moveTo(x, fy - wpx * 0.7); ctx.lineTo(x - wpx * 0.6, fy); ctx.lineTo(x, fy + wpx * 0.2); ctx.closePath(); ctx.fill();
    }
  }

  function drawGate(ctx, e) {
    proj(e.x, e.y, e.z);
    var s = tS, half = 0.34 * SX * s, hh = 0.34 * SY * s, th = Math.max(1.2, 3 * s), x = tX, y = tY, col = (Math.floor(tm * 8) & 1) ? '#ffe45e' : '#ff5ea8';
    ctx.globalAlpha = 0.14; ctx.fillStyle = '#6cf0ff'; ctx.fillRect(Math.round(x - half), Math.round(y - hh), Math.round(half * 2), Math.round(hh * 2)); ctx.globalAlpha = 1;
    rect(ctx, x - half, y - hh, half * 2, th, col); rect(ctx, x - half, y + hh - th, half * 2, th, col); rect(ctx, x - half, y - hh, th, hh * 2, col); rect(ctx, x + half - th, y - hh, th, hh * 2, col);
    var c2 = Math.max(2, 5 * s); rect(ctx, x - half - 1, y - hh - 1, c2, c2, '#ffffff'); rect(ctx, x + half - c2 + 1, y - hh - 1, c2, c2, '#ffffff'); rect(ctx, x - half - 1, y + hh - c2 + 1, c2, c2, '#ffffff'); rect(ctx, x + half - c2 + 1, y + hh - c2 + 1, c2, c2, '#ffffff');
  }

  function drawPow(ctx, e) {
    proj(e.x, e.y + 0.04 * Math.sin(e.age * 4), e.z);
    var s = tS, rr = Math.max(2, 9 * s), col = e.kind === 'S' ? '#4dd0ff' : e.kind === 'R' ? '#ff9e3d' : '#b46bff';
    shadow(ctx, tX, tG, rr * 1.6, 0.25);
    ctx.globalAlpha = 0.3; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tX, tY, rr * 1.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#10131c'; ctx.beginPath(); ctx.arc(tX, tY, rr, 0, 7); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, 2 * s); ctx.beginPath(); ctx.arc(tX, tY, rr, 0, 7); ctx.stroke();
    if (rr > 4.5) R.draw.text(ctx, e.kind, Math.round(tX), Math.round(tY - 3), { size: 6, color: col, align: 'center' });
    else rect(ctx, tX - 1, tY - 1, 2, 2, col);
  }

  function drawEnemy(ctx, e) {
    var cy = e.y + (e.cy || 0);
    proj(e.x, cy, e.z);
    var sc = tS * (e.t === 'scarab' ? 1.9 : 1.7), img = SPR[e.t];
    if (e.t !== 'turret') shadow(ctx, tX, tG, img.width * sc * 0.7, 0.3 * Math.min(1, 1.4 - e.y));
    if (e.t === 'turret') { proj(e.x, 0, e.z); tY = tG - img.height * sc * 0.5; }
    spriteAt(ctx, img, tX, tY, sc);
    if (e.flash > 0) { ctx.globalAlpha = 0.7; spriteAt(ctx, SPR[e.t + 'F'], tX, tY, sc); ctx.globalAlpha = 1; }
  }

  function drawBoss(ctx) {
    var b = boss, bd = st.boss;
    proj(b.x, b.y, b.z);
    var img = SPR[bd.spr], sc = tS * 2.5, ox = 0;
    if (b.dying) ox = Math.sin(bossDeadT * 60) * 1.5;
    shadow(ctx, tX, tG, img.width * sc * 0.7, 0.3);
    spriteAt(ctx, img, tX + ox, tY, sc);
    if (b.flash > 0 || b.dying) { ctx.globalAlpha = b.dying ? 0.35 + 0.35 * Math.sin(bossDeadT * 40) : 0.55; spriteAt(ctx, SPR[bd.spr + 'F'], tX + ox, tY, sc); ctx.globalAlpha = 1; }
    if (stageNo === 3 && !b.dying) {   /* orbiting crystal plates */
      for (var i = 0; i < 4; i++) { var a = b.t * 1.6 + i * Math.PI / 2, ppx = tX + Math.cos(a) * img.width * sc * 0.62, ppy = tY + Math.sin(a) * img.height * sc * 0.18, pz = Math.sin(a) > 0 ? 1 : 0.75; rect(ctx, ppx - 3 * pz, ppy - 5 * pz, 6 * pz, 10 * pz, i & 1 ? '#5ff0ff' : '#ff5ea8'); rect(ctx, ppx - 3 * pz, ppy - 5 * pz, 2 * pz, 10 * pz, '#ffffff'); }
    }
  }

  function drawBolt(ctx, b) {
    proj(b.x, b.y, b.z);
    var r = Math.max(1.5, 7 * tS), pulse = 1 + 0.2 * Math.sin(b.age * 24);
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#ff3b5c'; ctx.beginPath(); ctx.arc(tX, tY, r * 1.7 * pulse, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff6b8c'; ctx.beginPath(); ctx.arc(tX, tY, r, 0, 7); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(tX, tY, r * 0.5, 0, 7); ctx.fill();
  }

  function drawLaser(ctx, L) {
    proj(L.x, L.y, L.z); var x1 = tX, y1 = tY, s1 = tS;
    proj(L.x + L.vx * 0.03, L.y + L.vy * 0.03, L.z + 9); var x2 = tX, y2 = tY;
    ctx.strokeStyle = rapidT > 0 ? '#ffb347' : '#6cf0ff'; ctx.lineWidth = Math.max(1.5, 2.6 * s1); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 1.1 * s1); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function drawPlayer(ctx) {
    if (respawnT > 0 || phase === 'dead') return;
    proj(px, py, 0);
    var x = tX, y = tY, img = SPR.player[Math.round(bank) + 1], sc = 1.25;
    var gh = U.clamp(py, 0, 1.2); shadow(ctx, x, tG + 1, 19 - gh * 7, 0.35 - gh * 0.12);
    if (inv > 0 && Math.floor(tm * 16) & 1) return;
    /* engine flames */
    var fl = 3 + Math.random() * 3;
    rect(ctx, x - 7.2, y + 7, 2.4, fl, '#ffe45e'); rect(ctx, x + 4.8, y + 7, 2.4, fl, '#ffe45e'); rect(ctx, x - 7.8, y + 7, 3.6, fl * 0.6 + 1, 'rgba(255,122,47,0.8)'); rect(ctx, x + 4.2, y + 7, 3.6, fl * 0.6 + 1, 'rgba(255,122,47,0.8)');
    spriteAt(ctx, img, x, y, sc);
    if (shieldT > 0 && (shieldT > 2 || Math.floor(tm * 10) & 1)) {
      ctx.globalAlpha = 0.28 + 0.12 * Math.sin(tm * 9); ctx.fillStyle = '#6cf0ff'; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#b8f6ff'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  function drawReticle(ctx) {
    if (respawnT > 0 || phase === 'dead') return;
    proj(px, py, 46); var x = tX, y = tY;
    var col = lockTarget ? '#ff3b5c' : '#9aeeff';
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x) - 4, Math.round(y), 3, 1); ctx.fillRect(Math.round(x) + 2, Math.round(y), 3, 1); ctx.fillRect(Math.round(x), Math.round(y) - 4, 1, 3); ctx.fillRect(Math.round(x), Math.round(y) + 2, 1, 3);
    if (lockTarget) {
      var tg = lockTarget; proj(tg.x, tg.y + (tg.cy || 0), tg.z);
      var hw = Math.max(5, (tg === boss ? 40 : 14) * tS), x0 = Math.round(tX - hw), x1 = Math.round(tX + hw), y0 = Math.round(tY - hw), y1 = Math.round(tY + hw);
      ctx.fillStyle = '#ff3b5c';
      ctx.fillRect(x0, y0, 3, 1); ctx.fillRect(x0, y0, 1, 3); ctx.fillRect(x1 - 2, y0, 3, 1); ctx.fillRect(x1, y0, 1, 3);
      ctx.fillRect(x0, y1, 3, 1); ctx.fillRect(x0, y1 - 2, 1, 3); ctx.fillRect(x1 - 2, y1, 3, 1); ctx.fillRect(x1, y1 - 2, 1, 3);
    }
  }

  function drawHud(ctx) {
    R.draw.topBar(ctx);
    /* bombs */
    var i;
    for (i = 0; i < 5; i++) {
      var bx = 4 + i * 9, by = H - 12, on = i < bombs;
      ctx.fillStyle = on ? '#b46bff' : 'rgba(255,255,255,0.15)'; ctx.fillRect(bx + 1, by + 1, 5, 5); ctx.fillRect(bx, by + 2, 7, 3);
      if (on) { ctx.fillStyle = '#e8d0ff'; ctx.fillRect(bx + 1, by + 2, 2, 2); ctx.fillStyle = '#ffe45e'; ctx.fillRect(bx + 4, by - 1, 2, 2); }
    }
    R.draw.text(ctx, 'B', 4, H - 21, { size: 6, color: '#d8a0ff', shadow: '#000' });
    /* power-up bars */
    var by2 = H - 12;
    if (shieldT > 0) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W - 40, by2, 36, 7); ctx.fillStyle = '#4dd0ff'; ctx.fillRect(W - 39, by2 + 1, Math.round(34 * Math.min(1, shieldT / 25)), 5); R.draw.text(ctx, 'SH', W - 38, by2 + 1, { size: 5, color: '#10131c' }); }
    if (rapidT > 0) { var ry = by2 - 9; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W - 40, ry, 36, 7); ctx.fillStyle = '#ff9e3d'; ctx.fillRect(W - 39, ry + 1, Math.round(34 * Math.min(1, rapidT / 12)), 5); R.draw.text(ctx, 'RF', W - 38, ry + 1, { size: 5, color: '#10131c' }); }
    /* stage + boss bar */
    R.draw.text(ctx, 'S' + stageNo, 3, 15, { size: 6, color: T.accent, shadow: '#000' });
    if (boss) {
      var bw = 76, bx2 = CX - bw / 2, f = U.clamp(boss.hp / st.boss.hp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx2 - 1, 14, bw + 2, 8); ctx.fillStyle = f < 0.5 ? '#ff3b5c' : '#ff9e3d'; ctx.fillRect(bx2, 15, Math.round(bw * f), 6);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx2, 15, Math.round(bw * f), 2);
      R.draw.text(ctx, st.boss.name, CX, 24, { size: 6, color: '#ffffff', align: 'center', shadow: '#000' });
    }
    if (lifeFlash > 0) { ctx.globalAlpha = lifeFlash * 0.5; ctx.fillStyle = '#ff3b5c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  function drawOverlay(ctx) {
    var i;
    for (i = 0; i < rings.length; i++) { var rg = rings[i]; ctx.globalAlpha = Math.max(0, rg.t / rg.t0); ctx.strokeStyle = rg.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (phase === 'warn') {
      var on = Math.floor(warnT * 3.5) % 2;
      ctx.fillStyle = on ? 'rgba(255,40,70,0.9)' : 'rgba(120,10,30,0.9)';
      ctx.fillRect(0, 54, W, 5); ctx.fillRect(0, 98, W, 5);
      for (i = 0; i < W; i += 12) { ctx.fillStyle = '#10131c'; ctx.fillRect(i + (Math.floor(warnT * 30) % 12), 54, 6, 5); ctx.fillRect(i + 12 - (Math.floor(warnT * 30) % 12), 98, 6, 5); }
      if (on) R.draw.text(ctx, 'WARNING', CX, 68, { size: 16, color: '#ff3b5c', align: 'center', shadow: '#000' });
      R.draw.text(ctx, 'BIG ENEMY APPROACHING', CX, 90, { size: 6, color: '#ffffff', align: 'center', shadow: '#000' });
    } else if (banner) {
      var a = banner.t < 0.4 ? banner.t / 0.4 : 1;
      ctx.globalAlpha = a;
      R.draw.text(ctx, banner.text, CX, 46, { size: banner.text.length > 14 ? 6 : 8, color: banner.color, align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (bombFx > 0) { ctx.globalAlpha = Math.min(0.5, bombFx); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  R.game({
    layout: 'full', size: [W, H], bg: '#04021a',
    get music() { return music || 'space'; },

    init: function () { buildSprites(); THEMES.forEach(function (t, i) { prepTheme(i); }); },
    reset: reset,
    update: update,

    render: function (ctx, w, h) {
      var i, e, list;
      drawSky(ctx);
      drawGround(ctx);
      /* depth-sorted world objects */
      list = ents.slice().sort(function (a, b) { return b.z - a.z; });
      var drawnBoss = false;
      for (i = 0; i < list.length; i++) {
        e = list[i];
        if (boss && !drawnBoss && boss.z >= e.z) { drawBoss(ctx); drawnBoss = true; }
        if (e.z > 150 || e.z < -9) continue;
        ctx.globalAlpha = e.z > 105 ? Math.max(0, (150 - e.z) / 45) : 1;
        if (e.t === 'obs') drawObs(ctx, e); else if (e.t === 'gate') drawGate(ctx, e); else if (e.t === 'pow') drawPow(ctx, e); else drawEnemy(ctx, e);
        ctx.globalAlpha = 1;
      }
      if (boss && !drawnBoss) drawBoss(ctx);
      for (i = 0; i < bolts.length; i++) drawBolt(ctx, bolts[i]);
      for (i = 0; i < lasers.length; i++) drawLaser(ctx, lasers[i]);
      drawPlayer(ctx);
      drawReticle(ctx);
      drawHud(ctx);
      drawOverlay(ctx);
    }
  });
})();
