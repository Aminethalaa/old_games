/* Coast Run — sunny open-road time attack: traffic, checkpoints, rolling hills and forking routes (Retro SDK) */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 204, H = 246, HALF = 102, HZ = 98;
  var Y0 = H - HZ, ZN = 1, SEGL = 0.05, DRAW = 190, X0 = 112, BAND = 3, LV = 7;
  var CRAFT_Z = 1.32, CRAFT_D = (CRAFT_Z - ZN) / SEGL, SC_C = ZN / CRAFT_Z;
  var VMAX = 68, FORKLEN = 280, KMH = 3.1;
  var CAR_Y = HZ + Y0 * SC_C + 4;

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function fogArr(col, fog) { var a = hex(col), f = hex(fog), out = [], l; for (l = 0; l <= LV; l++) out.push(rgb(mixc(a, f, l / LV * 0.93))); return out; }
  function spr(w, h, fn) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
  function rc(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function disc(g, cx, cy, r, col) { g.fillStyle = col; for (var y = -r; y <= r; y++) { var hf = Math.floor(Math.sqrt(r * r - y * y + 0.5)); g.fillRect(cx - hf, cy + y, hf * 2 + 1, 1); } }
  function tri(g, cx, y0, y1, hw0, hw1, col, lt, dk) {
    for (var y = y0; y <= y1; y++) {
      var t = (y - y0) / Math.max(1, y1 - y0), hw = Math.round(hw0 + (hw1 - hw0) * t);
      rc(g, cx - hw, y, hw * 2 + 1, 1, col);
      if (lt && hw > 1) rc(g, cx - hw, y, Math.max(1, Math.round(hw * 0.35)), 1, lt);
      if (dk && hw > 1) rc(g, cx + hw - Math.max(0, Math.round(hw * 0.3)), y, Math.max(1, Math.round(hw * 0.3)) + 1, 1, dk);
    }
  }
  function cl(i, n) { return i < 0 ? 0 : i >= n ? n - 1 : i; }

  /* ----------------------------------------------------------- scenery art */
  function palm(lf, lf2, lf3, tr, tr2, fruit) {
    return spr(46, 62, function (g) {
      var y, t, x, tx = 28, ty = 14;
      for (y = 61; y >= 14; y--) {
        t = (61 - y) / 47; x = Math.round(19 + 8 * t * t + Math.sin(t * 2.6) * 1.5);
        rc(g, x - 1, y, t < 0.5 ? 4 : 3, 1, (y % 5 === 0) ? tr2 : tr);
      }
      [[-165, 20, 0.9], [-140, 22, 0.75], [-112, 19, 0.5], [-80, 18, 0.4], [-50, 21, 0.6], [-22, 22, 0.85], [10, 17, 1.0], [170, 17, 1.0]].forEach(function (f) {
        var a = f[0] * Math.PI / 180, L = f[1], dr = f[2];
        for (var k = 0; k <= L; k++) {
          var u = k / L, px = tx + Math.cos(a) * L * u, py = ty + Math.sin(a) * L * u + dr * L * u * u * 0.9, th = u < 0.5 ? 3 : u < 0.8 ? 2 : 1;
          rc(g, Math.round(px), Math.round(py), th, th, (k % 5 === 4) ? lf3 : (Math.sin(a) < 0 ? lf2 : lf));
          if (th >= 2) rc(g, Math.round(px), Math.round(py) - 1, 1, 1, lf2);
        }
      });
      disc(g, tx - 2, ty + 3, 2, fruit); disc(g, tx + 2, ty + 3, 2, fruit);
    });
  }
  function pine(c1, c2, c3, trunk, snow) {
    return spr(30, 60, function (g) {
      rc(g, 13, 46, 4, 14, trunk);
      for (var i = 0; i < 4; i++) { var y0 = 2 + i * 11; tri(g, 15, y0, y0 + 15, 1, 5 + i * 3, c1, c2, c3); if (snow) rc(g, 15 - 2, y0, 5, 1, snow); }
    });
  }
  function oak(c1, c2, c3, trunk) {
    return spr(34, 46, function (g) {
      rc(g, 15, 24, 4, 22, trunk); rc(g, 15, 24, 1, 22, '#8a6a46'); rc(g, 18, 24, 1, 22, '#4a3320');
      disc(g, 17, 14, 12, c3); disc(g, 9, 20, 8, c3); disc(g, 25, 20, 8, c3);
      disc(g, 17, 13, 11, c1); disc(g, 9, 19, 7, c1); disc(g, 25, 19, 7, c1);
      disc(g, 12, 9, 5, c2); disc(g, 6, 16, 3, c2); disc(g, 21, 12, 3, c2);
    });
  }
  function cactus(c1, c2, c3) {
    return spr(22, 44, function (g) {
      rc(g, 9, 3, 5, 41, c1); rc(g, 10, 1, 3, 2, c1); rc(g, 9, 3, 1, 41, c2); rc(g, 13, 3, 1, 41, c3);
      rc(g, 3, 20, 6, 3, c1); rc(g, 3, 11, 3, 12, c1); rc(g, 3, 11, 1, 12, c2); rc(g, 14, 26, 6, 3, c1); rc(g, 17, 17, 3, 12, c1); rc(g, 19, 17, 1, 12, c3);
      for (var y = 6; y < 42; y += 5) rc(g, 11, y, 1, 1, c3);
    });
  }
  function rock(c1, c2, c3) {
    return spr(34, 26, function (g) {
      tri(g, 17, 3, 25, 3, 16, c1, c2, c3); tri(g, 9, 10, 25, 2, 9, c1, c2, c3); tri(g, 26, 12, 25, 2, 7, c3, c1, c3);
      rc(g, 6, 24, 24, 2, c3);
    });
  }
  function cliff(c1, c2, c3) {
    return spr(44, 70, function (g) {
      rc(g, 6, 14, 32, 56, c1); rc(g, 10, 4, 24, 12, c1); rc(g, 6, 14, 5, 56, c2); rc(g, 33, 14, 5, 56, c3); rc(g, 10, 4, 5, 12, c2);
      for (var y = 10; y < 70; y += 7) rc(g, 6, y, 32, 1, c3);
      rc(g, 4, 40, 6, 30, c1); rc(g, 4, 40, 2, 30, c2);
    });
  }
  function billboard(v) {
    return spr(48, 66, function (g) {
      rc(g, 10, 38, 3, 28, '#4a5068'); rc(g, 35, 38, 3, 28, '#4a5068');
      rc(g, 1, 4, 46, 34, '#2a3550'); rc(g, 3, 6, 42, 30, '#ffffff');
      if (v === 0) { rc(g, 4, 7, 40, 28, '#4cc3ff'); disc(g, 33, 16, 6, '#ffe45e'); rc(g, 4, 25, 40, 10, '#1fa3d8'); for (var x = 4; x < 44; x += 6) rc(g, x, 27, 3, 1, '#ffffff'); rc(g, 8, 11, 12, 3, '#ffffff'); }
      else if (v === 1) { rc(g, 4, 7, 40, 28, '#ff8c42'); rc(g, 4, 25, 40, 10, '#ffd23d'); rc(g, 12, 12, 4, 18, '#7a4a24'); disc(g, 14, 11, 5, '#27c25a'); rc(g, 24, 14, 16, 3, '#ffffff'); rc(g, 24, 20, 12, 3, '#ffffff'); }
      else { for (var i = 0; i < 8; i++) rc(g, 4 + i * 5, 7, 5, 28, i % 2 ? '#ff3b6b' : '#ffe45e'); rc(g, 10, 15, 28, 12, '#2a3550'); rc(g, 12, 17, 24, 3, '#ffe45e'); rc(g, 12, 22, 16, 3, '#4cc3ff'); }
    });
  }
  function lamp() {
    return spr(26, 72, function (g) {
      rc(g, 5, 8, 2, 62, '#3a4160'); rc(g, 5, 8, 1, 62, '#5a6384'); rc(g, 5, 6, 13, 2, '#3a4160'); rc(g, 3, 66, 6, 6, '#2a3050');
      g.globalAlpha = 0.22; disc(g, 17, 11, 9, '#ffe9a0'); g.globalAlpha = 0.3; disc(g, 17, 10, 5, '#fff2c0'); g.globalAlpha = 1;
      rc(g, 14, 7, 7, 3, '#ffd23d'); rc(g, 15, 10, 5, 1, '#fff6c8');
    });
  }
  function building(body, edge, wins, seed) {
    return spr(44, 110, function (g) {
      var bh = 70 + Math.floor(hash(seed) * 38);
      rc(g, 2, 110 - bh, 40, bh, body); rc(g, 2, 110 - bh, 3, bh, edge); rc(g, 2, 110 - bh, 40, 2, edge);
      for (var y = 110 - bh + 6; y < 106; y += 6) for (var x = 7; x < 38; x += 7) { var hv = hash(seed * 31 + x * 7 + y * 13); if (hv > 0.4) rc(g, x, y, 4, 3, wins[Math.floor(hv * 20) % wins.length]); }
      rc(g, 21, 110 - bh - 8, 2, 8, '#6a7394'); rc(g, 20, 110 - bh - 9, 4, 2, '#ff3b6b');
    });
  }
  function umbrella(c1, c2) {
    return spr(32, 36, function (g) {
      rc(g, 15, 12, 2, 24, '#e8e8e8');
      for (var x = 0; x < 32; x++) for (var y = 0; y < 14; y++) { var dx = (x - 15.5) / 15.5, dy = (y - 13) / 13; if (dx * dx + dy * dy <= 1) rc(g, x, y, 1, 1, ((x / 6) | 0) % 2 ? c1 : c2); }
      rc(g, 14, 0, 4, 2, c1);
    });
  }

  var SP = {};   // name -> { img, h (world height in px at scale 1), hw (collision half-width), solid }
  function defSp(name, img, h, hw, solid) { SP[name] = { img: img, h: h, hw: hw || 0.2, solid: !!solid }; }

  /* -------------------------------------------------------------- car art */
  function carGrid(w, h, fn, lean) {
    var g = [], x, y;
    for (y = 0; y < h; y++) { g.push([]); for (x = 0; x < w; x++) g[y].push('.'); }
    var ox = 2, oy = 1;
    var api = {
      px: function (x, y, c) { x += ox; y += oy; if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; },
      box: function (x0, y0, x1, y1, c) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) api.px(xx, yy, c); }
    };
    fn(api);
    var out = [];
    for (y = 0; y < h; y++) { out.push([]); for (x = 0; x < w; x++) out[y].push('.'); }
    for (y = 0; y < h; y++) {
      var sh = Math.round(lean * (h * 0.55 - y) / (h * 0.55) * 1.8);
      for (x = 0; x < w; x++) { var nx = x + sh; if (g[y][x] !== '.' && nx >= 0 && nx < w) out[y][nx] = g[y][x]; }
    }
    var rows = [];
    for (y = 0; y < h; y++) {
      var s = '';
      for (x = 0; x < w; x++) {
        var ch = out[y][x];
        if (ch === '.' && ((x > 0 && out[y][x - 1] !== '.') || (x < w - 1 && out[y][x + 1] !== '.') || (y > 0 && out[y - 1][x] !== '.') || (y < h - 1 && out[y + 1][x] !== '.'))) ch = 'o';
        s += ch;
      }
      rows.push(s);
    }
    return rows;
  }
  function playerCar(a) {
    a.box(11, 0, 18, 4, 'h'); a.px(10, 3, 'k'); a.px(19, 3, 'k'); a.box(12, 5, 17, 5, 'k');                  // head from behind
    a.box(19, 3, 20, 4, 'Z'); a.box(20, 4, 26, 5, 'Z'); a.box(24, 5, 29, 6, 'Y');                           // scarf flying
    a.box(8, 6, 21, 9, 'J'); a.box(9, 6, 20, 6, 'j');                                                         // shoulders
    a.box(6, 8, 23, 10, 'B');
    a.box(3, 10, 26, 16, 'B'); a.box(4, 10, 25, 10, 'H'); a.box(3, 15, 26, 16, 'S'); a.box(6, 12, 23, 12, 'S');
    a.box(3, 12, 7, 14, 'L'); a.box(22, 12, 26, 14, 'L'); a.box(3, 12, 5, 12, 'l'); a.box(24, 12, 26, 12, 'l');
    a.box(12, 13, 17, 15, 'w'); a.box(13, 14, 16, 14, 'g');
    a.box(2, 16, 27, 17, 'C'); a.box(3, 17, 26, 17, 'c');
    a.box(9, 18, 10, 19, 'g'); a.box(19, 18, 20, 19, 'g');
    a.box(0, 13, 3, 19, 'W'); a.box(26, 13, 29, 19, 'W'); a.box(1, 15, 2, 17, 'g'); a.box(27, 15, 28, 17, 'g');
    a.box(4, 18, 25, 19, 'D');
  }
  function trafficCar(kind) {
    return function (a) {
      if (kind === 0) {           // hatch
        a.box(6, 1, 19, 3, 'B'); a.box(7, 3, 18, 6, 'k'); a.box(7, 3, 18, 3, 'K'); a.box(2, 7, 23, 13, 'B'); a.box(3, 7, 22, 7, 'H'); a.box(2, 12, 23, 13, 'S');
        a.box(2, 8, 5, 10, 'L'); a.box(20, 8, 23, 10, 'L'); a.box(10, 10, 15, 12, 'w'); a.box(1, 13, 24, 14, 'C');
        a.box(0, 10, 3, 16, 'W'); a.box(22, 10, 25, 16, 'W'); a.box(3, 15, 22, 16, 'D');
      } else if (kind === 1) {    // van
        a.box(2, 0, 27, 19, 'B'); a.box(3, 0, 26, 0, 'H'); a.box(5, 2, 24, 6, 'k'); a.box(5, 2, 24, 2, 'K'); a.box(14, 8, 15, 18, 'S'); a.box(2, 18, 27, 19, 'S');
        a.box(2, 12, 5, 15, 'L'); a.box(24, 12, 27, 15, 'L'); a.box(11, 14, 18, 16, 'w'); a.box(1, 19, 28, 20, 'C');
        a.box(0, 14, 4, 22, 'W'); a.box(25, 14, 29, 22, 'W'); a.box(4, 21, 25, 22, 'D');
      } else if (kind === 2) {    // truck
        a.box(1, 0, 32, 21, 'B'); a.box(2, 0, 31, 1, 'H'); a.box(1, 8, 32, 10, 'T'); a.box(1, 20, 32, 21, 'S'); a.box(16, 2, 17, 19, 'S');
        a.box(1, 14, 5, 17, 'L'); a.box(28, 14, 32, 17, 'L'); a.box(13, 16, 20, 18, 'w'); a.box(0, 22, 33, 23, 'C');
        a.box(0, 17, 5, 27, 'W'); a.box(28, 17, 33, 27, 'W'); a.box(2, 19, 3, 25, 'g'); a.box(30, 19, 31, 25, 'g'); a.box(5, 26, 28, 27, 'D');
      } else {                    // sports
        a.box(3, 0, 20, 1, 'S'); a.box(3, 0, 4, 3, 'S'); a.box(19, 0, 20, 3, 'S'); a.box(7, 2, 16, 5, 'k'); a.box(7, 2, 16, 2, 'K');
        a.box(1, 5, 22, 10, 'B'); a.box(2, 5, 21, 5, 'H'); a.box(1, 9, 22, 10, 'S');
        a.box(1, 6, 4, 8, 'L'); a.box(19, 6, 22, 8, 'L'); a.box(9, 7, 14, 9, 'w'); a.box(0, 10, 23, 11, 'C');
        a.box(0, 7, 3, 13, 'W'); a.box(20, 7, 23, 13, 'W'); a.box(3, 12, 20, 13, 'D');
      }
    };
  }
  var KIND_DIM = [[28, 19, 0.42], [31, 25, 0.5], [36, 29, 0.58], [26, 15, 0.4]];
  var TRAF_COLS = [['#2f7bff', '#7fb0ff', '#1d4fb0'], ['#f2f4f8', '#ffffff', '#b8c0d0'], ['#27c25a', '#7fe8a0', '#1a8a3e'], ['#ffd23d', '#fff08a', '#c8991a'], ['#a35cff', '#cba0ff', '#6a32b8'], ['#16c7c0', '#7ff0ea', '#0e8a86'], ['#ff8c42', '#ffc08a', '#c05a1a']];
  var CAR = { player: [], traffic: [] };
  function buildCars() {
    var pal = { B: '#ff4a2a', H: '#ff8a6a', S: '#c02a14', J: '#2f7bff', j: '#6aa0ff', h: '#4a2a14', k: '#ffccaa', Z: '#fff2a0', Y: '#ffb000', L: '#ff1f3a', l: '#ffc0c8', w: '#ffffff', C: '#e8eef8', c: '#8a93a8', g: '#69728c', W: '#14171f', D: '#0b0e14', o: '#0b0e14' };
    for (var l = -1; l <= 1; l++) CAR.player[l + 1] = R.sprite(carGrid(34, 22, playerCar, l), pal);
    for (var k = 0; k < 4; k++) {
      CAR.traffic[k] = [];
      for (var ci = 0; ci < TRAF_COLS.length; ci++) {
        var tc = TRAF_COLS[ci], p = { B: tc[0], H: tc[1], S: tc[2], T: k === 2 ? '#ffffff' : tc[1], k: '#9fe8ff', K: '#2a6f8f', L: '#ff1f3a', w: '#ffffff', C: '#d8e0f0', W: '#14171f', D: '#0b0e14', g: '#69728c', o: '#0b0e14' };
        CAR.traffic[k][ci] = R.sprite(carGrid(KIND_DIM[k][0] + 4, KIND_DIM[k][1] + 3, trafficCar(k), 0), p);
      }
    }
  }

  /* ------------------------------------------------------------------ themes */
  function hills(LW, h, seed, col, top, amp, base) {
    return spr(LW, h, function (g) {
      var s1 = hash(seed) * 6, s2 = hash(seed + 1) * 6, s3 = hash(seed + 2) * 6, k = 2 * Math.PI / LW;
      for (var x = 0; x < LW; x++) {
        var v = Math.sin(x * k * 2 + s1) * 0.55 + Math.sin(x * k * 5 + s2) * 0.3 + Math.sin(x * k * 11 + s3) * 0.15, y = Math.round(h - base - amp * (0.5 + 0.5 * v));
        rc(g, x, y, 1, h - y, col); if (top) rc(g, x, y, 1, 1, top);
      }
    });
  }
  function treeline(LW, h, seed, col, hi, base, amp) {
    return spr(LW, h, function (g) {
      for (var x = 0; x < LW; x += 3) {
        var th = base + Math.floor(hash(seed + x) * amp), w = 4 + Math.floor(hash(seed + x * 3) * 3);
        tri(g, x + 2, h - th, h - 1, 0, w, col, hi, null);
      }
      rc(g, 0, h - base + 1, LW, base, col);
    });
  }
  function mesaLayer(LW, h, seed, top, band, wMin, wMax, hMin, hMax) {
    return spr(LW, h, function (g) {
      var x = 0, i = 0;
      while (x < LW) {
        var bw = wMin + Math.floor(hash(seed + i * 5) * (wMax - wMin + 1)), bh = hMin + Math.floor(hash(seed + i * 7 + 1) * (hMax - hMin)), step = Math.floor(bh * 0.55);
        rc(g, x + 2, h - bh, bw - 4, bh, top); rc(g, x, h - step, bw, step, top);
        for (var yy = h - bh + 3; yy < h; yy += 4) rc(g, x + (yy > h - step ? 0 : 2), yy, bw - (yy > h - step ? 0 : 4), 1, band);
        x += bw - 1 + Math.floor(hash(seed + i * 9) * 10); i++;
      }
    });
  }
  function skyline(LW, h, seed, body, wins, hMin, hMax, wMin, wMax, tops) {
    return spr(LW, h, function (g) {
      var x = 0, i = 0;
      while (x < LW) {
        var bw = wMin + Math.floor(hash(seed + i * 5) * (wMax - wMin + 1)), bh = hMin + Math.floor(hash(seed + i * 7 + 1) * (hMax - hMin));
        rc(g, x, h - bh, bw, bh, body);
        if (tops && hash(seed + i * 3 + 2) > 0.5) rc(g, x, h - bh, bw, 1, tops[i % tops.length]);
        for (var wy = h - bh + 3; wy < h - 2; wy += 3) for (var wx = x + 1; wx < x + bw - 1; wx += 3) { var hv = hash(seed + wx * 13 + wy * 7); if (hv > 0.6) rc(g, wx, wy, 1, 1, wins[Math.floor(hv * 50) % wins.length]); }
        x += bw + (hash(seed + i * 11) > 0.7 ? 1 : 0); i++;
      }
    });
  }
  function clouds(LW, h, seed, col, shade) {
    return spr(LW, h, function (g) {
      for (var i = 0; i < 6; i++) {
        var cx = Math.floor((i + hash(seed + i) * 0.7) * LW / 6), cy = 12 + Math.floor(hash(seed + i * 3) * (h - 30)), s = 6 + Math.floor(hash(seed + i * 5) * 6);
        for (var o = -1; o <= 1; o++) {
          var x0 = cx + o * LW;
          disc(g, x0, cy, s, col); disc(g, x0 - s, cy + 3, s - 2, col); disc(g, x0 + s, cy + 3, s - 3, col); disc(g, x0 + s * 2, cy + 5, s - 4, col);
          rc(g, x0 - s * 2, cy + s - 1, s * 5, 2, shade);
        }
      }
    });
  }

  var THEMES = {
    beach: { name: 'BEACH', sky: ['#2f8fe8', '#44a3f0', '#5db6f5', '#78c8f8', '#93d6fa', '#aee3fc', '#c6eefd', '#dcf6fe', '#eefbff'], fog: '#cdeefa',
      g: ['#f6dc8f', '#efd07c'], r: ['#8e929e', '#999ca8'], w: ['#ffffff', '#e63946'], lane: '#ffffff', edge: '#ffffff', sea: ['#18b4dc', '#2cc6ea'], foam: '#ffffff', seaX: 3.1, accent: '#ffe45e' },
    forest: { name: 'FOREST', sky: ['#3b9be6', '#55adee', '#71c0f3', '#8fd2f6', '#aae0f8', '#c2ecf9', '#d6f4fb', '#e6faf8', '#f2fdf6'], fog: '#d2efe0',
      g: ['#2e9a3c', '#288c35'], r: ['#80838e', '#8a8d98'], w: ['#ffffff', '#f28c28'], lane: '#ffffff', edge: '#ffffff', sea: null, accent: '#7fe88a' },
    desert: { name: 'DESERT', sky: ['#3d9ae6', '#58aeee', '#76c1f3', '#98d3f5', '#b9e2f4', '#d8ecf0', '#f0efe0', '#fbe9c4', '#ffe2a8'], fog: '#f7dcae',
      g: ['#eab864', '#e0ab56'], r: ['#7d716c', '#877b76'], w: ['#ffffff', '#e63946'], lane: '#fff2c8', edge: '#ffffff', sea: null, accent: '#ffb000' },
    night: { name: 'NIGHT', sky: ['#04081e', '#080f38', '#0e1850', '#162266', '#222e7c', '#34408e', '#4d4ba0', '#7458ae', '#a066b4'], fog: '#5a4a96',
      g: ['#131b3a', '#18214a'], r: ['#363b60', '#3f456c'], w: ['#ffd23d', '#2a2f4a'], lane: '#fff2a0', edge: '#ffd23d', sea: null, accent: '#ff5ea8' },
    sunset: { name: 'SUNSET', sky: ['#33297a', '#52399a', '#7f45a4', '#b0509c', '#dc6490', '#f58078', '#ffa070', '#ffc088', '#ffdea6'], fog: '#f6b48e',
      g: ['#f4c8a0', '#ecb78c'], r: ['#6c6288', '#776d94'], w: ['#fff2e0', '#e84a6a'], lane: '#fff2e0', edge: '#fff2e0', sea: ['#8a43a6', '#a64fb8'], foam: '#ffe6d0', seaX: 3.1, accent: '#ff8c5a' }
  };
  function makeSky(key) {
    var T = THEMES[key];
    return spr(W, HZ + 1, function (g) {
      var n = T.sky.length, bh = Math.ceil((HZ + 1) / n), i;
      for (i = 0; i < n; i++) rc(g, 0, i * bh, W, bh, T.sky[i]);
      if (key === 'beach') { g.globalAlpha = 0.2; disc(g, 150, 34, 24, '#ffffff'); g.globalAlpha = 0.35; disc(g, 150, 34, 18, '#fff6c8'); g.globalAlpha = 1; disc(g, 150, 34, 12, '#fff2a0'); disc(g, 150, 34, 9, '#ffe45e'); }
      else if (key === 'forest') { g.globalAlpha = 0.25; disc(g, 40, 30, 20, '#ffffff'); g.globalAlpha = 1; disc(g, 40, 30, 9, '#fffbe0'); }
      else if (key === 'desert') { g.globalAlpha = 0.25; disc(g, 120, 56, 30, '#fff6d0'); g.globalAlpha = 0.45; disc(g, 120, 56, 21, '#fff6d0'); g.globalAlpha = 1; disc(g, 120, 56, 14, '#ffffff'); }
      else if (key === 'sunset') { g.globalAlpha = 0.25; disc(g, 62, 86, 36, '#ffe08a'); g.globalAlpha = 0.4; disc(g, 62, 86, 26, '#ffd36b'); g.globalAlpha = 1; disc(g, 62, 86, 19, '#ffcf5c'); disc(g, 62, 86, 15, '#ffe88a'); for (i = 0; i < 4; i++) rc(g, 40, 80 + i * 4, 46, 1, T.sky[6]); }
      else {
        for (i = 0; i < 70; i++) { g.globalAlpha = 0.3 + hash(i * 3) * 0.7; rc(g, Math.floor(hash(i * 7 + 1) * W), Math.floor(hash(i * 13 + 5) * 62), 1, 1, '#ffffff'); }
        g.globalAlpha = 1; disc(g, 158, 30, 13, '#fff6d8'); disc(g, 162, 27, 12, T.sky[1]); disc(g, 158, 30, 11, '#ffeeb8'); disc(g, 162, 27, 10, T.sky[1]);
      }
    });
  }
  function prepTheme(key) {
    var T = THEMES[key];
    T.fg = [fogArr(T.g[0], T.fog), fogArr(T.g[1], T.fog)]; T.fr = [fogArr(T.r[0], T.fog), fogArr(T.r[1], T.fog)]; T.fw = [fogArr(T.w[0], T.fog), fogArr(T.w[1], T.fog)];
    T.fl = fogArr(T.lane, T.fog); T.fe = fogArr(T.edge, T.fog);
    if (T.sea) { T.fs = [fogArr(T.sea[0], T.fog), fogArr(T.sea[1], T.fog)]; T.ff = fogArr(T.foam, T.fog); }
    T.skyImg = makeSky(key);
    var tl = 62;
    if (key === 'beach') { T.lay = [{ img: hills(408, 26, 3, '#8fd0c0', '#a6dccd', 14, 0), f: 0.18, y: HZ - 25 }, { img: hills(408, 22, 9, '#52b884', '#6ccf9a', 12, 0), f: 0.4, y: HZ - 21 }]; T.cloud = clouds(408, 70, 5, '#ffffff', '#dff0fb'); }
    else if (key === 'forest') { T.lay = [{ img: hills(408, 34, 4, '#7fbfa0', '#9ad3b4', 20, 0), f: 0.18, y: HZ - 33 }, { img: treeline(408, 28, 21, '#2a7a48', '#3a9a5c', 8, 14), f: 0.45, y: HZ - 27 }]; T.cloud = clouds(408, 60, 7, '#ffffff', '#e4f4f4'); }
    else if (key === 'desert') { T.lay = [{ img: mesaLayer(408, 30, 5, '#e6a860', '#d49548', 22, 44, 12, 26), f: 0.18, y: HZ - 29 }, { img: mesaLayer(408, 24, 31, '#cf8a48', '#b97538', 26, 50, 10, 20), f: 0.4, y: HZ - 23 }]; T.cloud = clouds(408, 50, 11, '#fff8ea', '#f6e4c4'); }
    else if (key === 'sunset') { T.lay = [{ img: hills(408, 28, 6, '#8a4a9a', '#a35cb0', 16, 0), f: 0.18, y: HZ - 27 }, { img: hills(408, 22, 12, '#5e2f7a', '#74408e', 12, 0), f: 0.4, y: HZ - 21 }]; T.cloud = clouds(408, 60, 13, '#ffc8b0', '#f09a8c'); }
    else { T.lay = [{ img: skyline(408, 40, 11, '#1a2250', ['#ffe27a', '#7fe9ff', '#ff9ad0'], 10, 30, 8, 14, ['#ff5ea8', '#5ee8ff']), f: 0.2, y: HZ - 39 }, { img: skyline(408, 46, 47, '#101640', ['#ffe27a', '#ff9ad0', '#9ae0ff'], 16, 42, 10, 18, ['#ff5ea8', '#ffd23d']), f: 0.5, y: HZ - 45 }]; T.cloud = null; }
  }

  /* --------------------------------------------------------------- stages */
  var STAGES = {
    1: [{ key: 'seaside', th: 'beach', name: 'SEASIDE START', tag: 'SEASIDE', len: 2000, cK: 0.9, hK: 0.7, traf: 0.8, diff: 1, seed: 101 }],
    2: [{ key: 'pine', th: 'forest', name: 'PINE HILLS', tag: 'FOREST', len: 2200, cK: 1.15, hK: 1.0, traf: 0.6, diff: 1, seed: 202 },
      { key: 'dune', th: 'desert', name: 'DUNE HIGHWAY', tag: 'DESERT', len: 2300, cK: 0.8, hK: 0.9, traf: 1.2, diff: 2, seed: 203 }],
    3: [{ key: 'cliffs', th: 'sunset', name: 'SUNSET CLIFFS', tag: 'CLIFFS', len: 2300, cK: 1.25, hK: 1.1, traf: 0.8, diff: 1, seed: 301 },
      { key: 'downtown', th: 'night', name: 'NEON DOWNTOWN', tag: 'CITY', len: 2400, cK: 1.0, hK: 1.2, traf: 1.4, diff: 2, seed: 302 }],
    4: [{ key: 'harbor', th: 'beach', name: 'PALM HARBOR', tag: 'HARBOR', len: 2000, cK: 1.0, hK: 0.8, traf: 1.0, diff: 1, seed: 401 },
      { key: 'mesa', th: 'desert', name: 'MESA SPRINT', tag: 'MESA', len: 2200, cK: 1.3, hK: 1.2, traf: 1.5, diff: 3, seed: 402 }]
  };
  var NSTAGES = 4;

  function buildStage(def, stageNo) {
    var rnd = mulberry(def.seed), cv = [], hh = [], y = 0, isFinal = stageNo === NSTAGES;
    function add(n, c, hill) {
      var enter = Math.round(n * 0.3), leave = Math.round(n * 0.3), hold = n - enter - leave, y0 = y, y1 = y + hill, k, cc, a;
      for (k = 0; k < n; k++) {
        if (k < enter) { a = k / enter; cc = c * a * a * (3 - 2 * a); } else if (k < enter + hold) cc = c; else { a = (n - k) / leave; cc = c * a * a * (3 - 2 * a); }
        cv.push(cc); hh.push(y0 + (y1 - y0) * (1 - Math.cos(Math.PI * k / n)) / 2);
      }
      y = y1;
    }
    var tailLen = isFinal ? 160 : FORKLEN, body = def.len - 60 - tailLen - 90;
    add(60, 0, 0);
    while (cv.length < 60 + body) {
      var r = rnd(), sg = rnd() < 0.5 ? -1 : 1, n, c;
      if (r < 0.18) add(40 + Math.floor(rnd() * 50), 0, 0);
      else if (r < 0.5) add(70 + Math.floor(rnd() * 50), sg * (0.0007 + rnd() * 0.0009) * def.cK, (rnd() - 0.5) * 0.4 * def.hK);
      else if (r < 0.72) { var hs = (y > 0.7 ? -1 : y < -0.7 ? 1 : (rnd() < 0.5 ? -1 : 1)) * (0.5 + rnd() * 0.9) * def.hK; add(90 + Math.floor(rnd() * 60), rnd() < 0.5 ? 0 : sg * 0.0005 * def.cK, hs); }
      else if (r < 0.88) { n = 55 + Math.floor(rnd() * 30); c = (0.0008 + rnd() * 0.0008) * def.cK; add(n, sg * c, 0); add(n, -sg * c, 0); }
      else { add(45 + Math.floor(rnd() * 25), sg * (0.0018 + rnd() * 0.0007) * def.cK, 0); add(30, 0, 0); }
    }
    add(90, 0, -y);
    add(tailLen, isFinal ? 0 : (rnd() < 0.5 ? -1 : 1) * 0.0004, 0);
    var len = cv.length;
    for (var p = 0; p < DRAW + 80; p++) { cv.push(0); hh.push(0); }
    var N = cv.length, st = { def: def, no: stageNo, final: isFinal, len: len, N: N, curve: Float32Array.from(cv), hy: Float32Array.from(hh), fork: new Float32Array(N), scn: new Array(N), cps: [], forkStart: len - FORKLEN };
    var i, gain = len / 60 * (1 - 0.04 * def.diff);
    st.cpT = Math.round(gain * (isFinal ? 0.5 : 0.36)); st.endT = isFinal ? 0 : Math.round(gain * 0.28);
    for (i = 0; i < N; i++) st.scn[i] = null;
    if (!isFinal) for (i = 0; i < N; i++) { var t = U.clamp((i - st.forkStart) / (FORKLEN - 40), 0, 1); st.fork[i] = t * t * (3 - 2 * t); }
    st.cps = [Math.floor((len - tailLen) * 0.34), Math.floor((len - tailLen) * 0.68)].map(function (idx) { return { i: idx, done: false }; });
    placeScenery(st);
    return st;
  }

  function placeScenery(st) {
    var N = st.N, rnd = mulberry(st.def.seed + 7), th = st.def.th, i;
    function add(i, it) { (st.scn[i] || (st.scn[i] = [])).push(it); }
    function off(i, o) { var f = st.fork[i]; return o + (o < 0 ? -1 : 1) * 1.3 * f; }
    function it(k, o, i) { var s = SP[k]; return { k: k, o: off(i, o), solid: s.solid, hw: s.hw }; }
    add(14, { k: 'gantry', g: 'start', o: 0 });
    st.cps.forEach(function (cp) { add(cp.i, { k: 'gantry', g: 'check', o: 0 }); });
    if (!st.final) {
      add(st.forkStart, { k: 'gantry', g: 'fork', o: 0 }); add(st.forkStart + 120, { k: 'gantry', g: 'fork', o: 0 });
      add(st.forkStart + 190, { k: 'island', o: 0, solid: true, hw: 0.4 }); add(st.forkStart + 250, { k: 'island', o: 0, solid: true, hw: 0.4 });
    } else add(st.len - 40, { k: 'gantry', g: 'goal', o: 0 });
    var stop = st.len + 30;
    for (i = 8; i < stop; i += 2) {
      var r = rnd(), r2 = rnd(), side = r2 < 0.5 ? -1 : 1, o = side * (1.4 + rnd() * 1.5);
      if (th === 'beach' || th === 'sunset') {
        var dusk = th === 'sunset', palmK = dusk ? 'palmD' : 'palm';
        if (i % 3 === 0) {
          if (r < 0.55) add(i, it(palmK, -(1.45 + rnd() * 1.3), i));
          if (r2 < 0.4) add(i, it(r < 0.1 ? 'umb' : palmK, 1.5 + rnd() * 1.6, i));
        }
        if (i % 80 === 0) add(i, it('bill' + ((i / 80) % 3 | 0), 1.9, i));
        if (dusk && i % 14 === 0) add(i, it('cliff', 3.6 + rnd() * 1.5, i));
      } else if (th === 'forest') {
        if (r < 0.7) add(i, it(rnd() < 0.55 ? 'pine' : 'oak', o, i));
        if (r2 < 0.3 && i % 4 === 0) add(i, it(rnd() < 0.5 ? 'pine' : 'oak', -o * (0.8 + rnd() * 0.8), i));
        if (i % 110 === 0) add(i, it('bill' + (((i / 110) | 0) % 3), 1.9, i));
      } else if (th === 'desert') {
        if (r < 0.28) add(i, it('cactus', o, i)); else if (r < 0.5) add(i, it('rock', o * 1.2, i));
        if (i % 100 === 0) add(i, it('bill' + (((i / 100) | 0) % 3), -1.9, i));
      } else {
        if (i % 8 === 0) { add(i, it('lamp', -1.3, i)); add(i, it('lamp', 1.3, i)); }
        if (i % 4 === 0) add(i, it('bld' + ((rnd() * 4) | 0), side * (2.7 + rnd() * 2.2), i));
        if (i % 70 === 0) add(i, it('bill' + (((i / 70) | 0) % 3), 1.95, i));
      }
    }
    for (i = 6; i < st.len - 40; i += 5) { var c = st.curve[i]; if (Math.abs(c) > 0.0014) add(i, { k: 'chev', o: c > 0 ? -1.3 : 1.3, d: c > 0 ? 1 : -1, solid: false, hw: 0 }); }
  }

  /* -------------------------------------------------------------------- state */
  var st, stNo, pl, traffic, time, tm, phase, phaseT, camX, camPos, bgx, banner, passes, combo, comboT, spawnPos, lastSeg, distAcc, hiSpeedT, tickT, goalT, tallyT, engT, fadeT, nextDef, choiceFlash, offDust, stats;
  var sX = new Float32Array(DRAW + 2), sY = new Float32Array(DRAW + 2), sS = new Float32Array(DRAW + 2), sClip = new Float32Array(DRAW + 2), fogLv = new Uint8Array(DRAW + 2);
  var rvis = [];
  (function () { for (var n = 0; n < DRAW + 2; n++) fogLv[n] = Math.min(LV, Math.max(0, Math.floor((n - 30) / (DRAW - 30) * (LV + 1)))); })();

  function heightAt(p) { var i = Math.floor(p), f = p - i; i = cl(i, st.N); return st.hy[i] + (st.hy[cl(i + 1, st.N)] - st.hy[i]) * f; }
  function forkAt(p) { return st.fork[cl(Math.floor(p), st.N)]; }
  function ribbons(f) { return f * 2.2 > 0.05; }
  function onRoad(x, f) { if (!ribbons(f)) return Math.abs(x) < 1.04; var c = 0.5 + 1.1 * f; return Math.min(Math.abs(x - c), Math.abs(x + c)) < 0.54; }
  function say(text, color, t) { banner = { text: text, color: color || '#fff', t: t || 1.6 }; }

  function startStage(def, no, keepSpeed) {
    stNo = no; st = buildStage(def, no); R.level = no;
    traffic.length = 0; spawnPos = 70; lastSeg = 0; camX = pl.x * 0.85;
    pl.pos = 10; pl.spin = 0; pl.inv = 0; if (!keepSpeed) pl.spd = 0;
    bgx = 0; offDust = 0; camPos = pl.pos - CRAFT_D;
    say('STAGE ' + no, '#ffffff', 2.2); stats.nameT = 2.6;
  }

  function reset() {
    pl = { pos: 10, x: 0, vx: 0, spd: 0, spin: 0, spinDir: 1, inv: 0, lean: 0, rot: 0 };
    traffic = []; time = 45; tm = 0; phase = 'ready'; phaseT = 0; banner = null; passes = 0; combo = 0; comboT = 0; distAcc = 0; hiSpeedT = 0; tickT = 0; goalT = 0; tallyT = 0; engT = 0; fadeT = 0; choiceFlash = 0;
    stats = { forks: 0, nameT: 0, route: [] };
    R.lives = null; R.score = 0;
    startStage(STAGES[1][0], 1, false);
  }

  /* ------------------------------------------------------------------ traffic */
  function spawnCar() {
    var d = st.def, rnd = Math.random, k = rnd() < 0.5 ? 0 : rnd() < 0.5 ? 3 : rnd() < 0.6 ? 1 : 2, lane = Math.floor(rnd() * 3) - 1, tries = 0, i, c;
    function laneBusy(l) { for (var j = 0; j < traffic.length; j++) if (traffic[j].lane === l && Math.abs(traffic[j].pos - spawnPos) < 16) return true; return false; }
    while (laneBusy(lane) && tries++ < 3) lane = (lane + 2) % 3 - 1;
    if (laneBusy(lane)) return;
    var spd = (k === 2 ? 20 + rnd() * 8 : 24 + rnd() * 20) * (1 + 0.05 * d.diff);
    traffic.push({ pos: spawnPos, lane: lane, x: lane * 0.667, spd: spd, kind: k, ci: Math.floor(rnd() * TRAF_COLS.length), w: KIND_DIM[k][2], passed: false, hit: 0, vx: 0, ph: rnd() * 6, weave: d.diff >= 2 && rnd() < 0.25 });
    if (d.traf > 1.1 && rnd() < 0.3) { var l2 = lane === 0 ? 1 : -lane + 0; if (!laneBusy(l2) && l2 !== lane) traffic.push({ pos: spawnPos + rnd() * 3, lane: l2, x: l2 * 0.667, spd: spd * 0.97, kind: 0, ci: Math.floor(rnd() * TRAF_COLS.length), w: 0.42, passed: false, hit: 0, vx: 0, ph: 0, weave: false }); }
  }

  function crash(car) {
    var dir = pl.x - (car ? car.x : 0) >= 0 ? 1 : -1;
    pl.spin = 1.0; pl.spinDir = dir; pl.inv = 1.9; pl.vx = dir * 1.6; pl.spd = Math.max(14, pl.spd * 0.3); combo = 0;
    R.sfx.play('explode'); R.vibrate(90); R.fx.shake(4, 0.35);
    R.fx.burst(HALF + (pl.x - camX) * X0 * SC_C, CAR_Y - 12, { n: 24, color: ['#ffe45e', '#ffffff', '#ff9e3d', '#ff5a2a'], speed: 120, life: 0.6, size: 2, gravity: 140 });
    R.fx.burst(HALF + (pl.x - camX) * X0 * SC_C, CAR_Y - 10, { n: 8, color: ['#b0b8c8', '#8a93a8'], speed: 40, life: 0.8, size: 3, gravity: -30 });
    if (car) { car.hit = 1.2; car.vx = -dir * 1.4; car.spd *= 0.6; }
  }

  /* ------------------------------------------------------------------- update */
  function nextStage(side) {
    var opts = STAGES[stNo + 1], def = opts[side];
    var f = forkAt(pl.pos), c = 0.5 + 1.1 * f, rel = (pl.x - (side === 0 ? -c : c)) * 1.5;
    stats.route.push(side);
    pl.x = U.clamp(rel, -0.8, 0.8); pl.vx = 0;
    startStage(def, stNo + 1, true);
    fadeT = 0.5; R.fx.flash('#ffffff', 0.45);
    say('STAGE ' + (stNo) + ' ' + def.tag, THEMES[def.th].accent, 2.4);
  }

  function endStage() {
    var left = Math.floor(time), bonus = stNo * 300 + left * 50 + st.def.diff * 250;
    R.addScore(bonus); R.sfx.play('win'); R.vibrate(40);
    stats.forks++;
    R.achieve('crossroads');
    var side = pl.x < 0 ? 0 : 1;
    time = Math.min(99, time + st.endT);
    R.fx.text(HALF, 70, '+' + bonus, '#ffe45e');
    nextStage(side);
  }

  function update(dt) {
    var inp = R.input, i, car;
    tm += dt; phaseT += dt;
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (stats.nameT > 0) stats.nameT -= dt;
    if (fadeT > 0) fadeT -= dt;
    if (comboT > 0) comboT -= dt; else combo = 0;

    if (phase === 'ready') {
      var b0 = Math.floor((phaseT - dt) / 0.75), b1 = Math.floor(phaseT / 0.75);
      if (b1 !== b0 && b1 <= 2) R.sfx.tone(520, 0.12, { vol: 0.14 });
      if (phaseT >= 3 * 0.75) { phase = 'run'; phaseT = 0; say('GO!', '#ffe45e', 0.9); R.sfx.tone(1040, 0.35, { vol: 0.15 }); }
      camPos = pl.pos - CRAFT_D; return;
    }

    var seg = cl(Math.floor(pl.pos), st.N), c = st.curve[seg], f = st.fork[seg];
    var running = phase === 'run', ax = running && pl.spin <= 0 ? inp.axisX() : 0;
    var gas = running && pl.spin <= 0 && inp.held.a, brake = running && inp.held.b && pl.spin <= 0;
    var road = onRoad(pl.x, f), cap = road ? VMAX : 30;

    /* speed */
    if (phase === 'timeup' || phase === 'goal') pl.spd = Math.max(0, pl.spd - (phase === 'goal' ? 30 : 22) * dt);
    else if (pl.spin > 0) pl.spd = Math.max(12, pl.spd - 22 * dt);
    else if (gas) pl.spd += (pl.spd < cap ? 26 : -40) * dt;
    else if (brake) pl.spd -= 60 * dt;
    else pl.spd -= (road ? 9 : 30) * dt;
    if (brake && gas) pl.spd -= 20 * dt;
    if (!road && pl.spd > cap) pl.spd -= 55 * dt;
    pl.spd = U.clamp(pl.spd, 0, VMAX);

    /* steering and centrifugal drift */
    var speedF = pl.spd / VMAX, steer = 1.75 * (0.25 + 0.75 * Math.min(1, speedF * 1.3));
    if (phase === 'goal') ax = U.clamp(-pl.x * 2, -1, 1) * 0.5;
    pl.vx += (ax * steer - pl.vx) * Math.min(1, dt * 8);
    if (pl.spin > 0) { pl.spin -= dt; pl.rot = (1 - pl.spin) * Math.PI * 2 * pl.spinDir; pl.vx *= 0.97; }
    var cf = c * speedF * speedF * 640;
    pl.x = U.clamp(pl.x + (pl.vx - cf) * dt, -3.4, 3.4);
    if (pl.inv > 0) pl.inv -= dt;
    pl.lean += (U.clamp(ax * 1.2 + c * 700, -1, 1) - pl.lean) * Math.min(1, dt * 8);
    pl.pos += pl.spd * dt;
    var seg2 = cl(Math.floor(pl.pos), st.N);

    /* off-road dust and shake */
    if (!road && pl.spd > 12) {
      offDust -= dt;
      if (offDust <= 0) { offDust = 0.05; R.fx.burst(HALF + (pl.x - camX) * X0 * SC_C + U.rand(-12, 12), CAR_Y - 3, { n: 2, color: [THEMES[st.def.th].g[0], '#ffffff'], speed: 50, life: 0.4, size: 2, gravity: -20 }); }
      if (Math.random() < 0.05) R.vibrate(10);
    }

    /* roadside objects */
    if (pl.inv <= 0 && phase === 'run') {
      for (var sg = lastSeg + 1; sg <= seg2; sg++) {
        var lst = st.scn[sg];
        if (!lst) continue;
        for (i = 0; i < lst.length; i++) { var o = lst[i]; if (o.solid && Math.abs(pl.x - o.o) < o.hw + 0.2) { crash(null); pl.x += (pl.x >= o.o ? 1 : -1) * 0.1; sg = 1e9; break; } }
      }
    }
    lastSeg = seg2;

    /* traffic */
    if (running) {
      var gap = 34 / Math.max(0.4, st.def.traf);
      while (spawnPos < pl.pos + DRAW + 6) {
        if (spawnPos < st.forkStart - 30 && spawnPos < st.len - 200 && spawnPos > 60) spawnCar();
        spawnPos += gap * (0.6 + Math.random() * 0.9);
      }
    }
    for (i = traffic.length - 1; i >= 0; i--) {
      car = traffic[i];
      if (car.hit > 0) { car.hit -= dt; car.x += car.vx * dt; car.spd = Math.max(5, car.spd - 10 * dt); }
      else if (car.weave) car.x = car.lane * 0.667 + Math.sin(tm * 0.9 + car.ph) * 0.14;
      car.pos += car.spd * dt;
      var dz = car.pos - pl.pos;
      if (dz < -14 || dz > DRAW + 80) { traffic.splice(i, 1); continue; }
      if (!car.passed && dz < -0.8) {
        car.passed = true;
        if (!car.hit && running) {
          passes++; combo = comboT > 0 ? Math.min(6, combo + 1) : 1; comboT = 2.6;
          var pts = 50 * combo; R.addScore(pts);
          R.sfx.tone(780 + combo * 90, 0.07, { vol: 0.09 }); R.fx.text(HALF, 150, combo > 1 ? 'PASS x' + combo : 'PASS', '#ffe45e');
          if (passes >= 25) R.achieve('road-hog');
        }
      }
      if (running && pl.inv <= 0 && !car.hit && Math.abs(dz) < 1.25 && Math.abs(car.x - pl.x) < (car.w + 0.44) / 2 * 0.86) crash(car);
    }

    /* progress, checkpoints, time */
    distAcc += pl.spd * dt * 0.5;
    if (distAcc >= 1) { var dd = Math.floor(distAcc); distAcc -= dd; if (running) R.addScore(dd); }
    if (running) {
      time -= dt;
      for (i = 0; i < st.cps.length; i++) {
        var cp = st.cps[i];
        if (!cp.done && pl.pos >= cp.i) {
          cp.done = true; time = Math.min(99, time + st.cpT); R.addScore(300);
          say('CHECKPOINT!  +' + st.cpT + 's', '#ffe45e', 1.8); R.sfx.play('powerup'); R.vibrate(25); R.fx.flash('#ffffff', 0.15);
        }
      }
      if (time <= 10 && time > 0) { tickT -= dt; if (tickT <= 0) { tickT = 1; R.sfx.tone(time < 4 ? 1300 : 900, 0.08, { vol: 0.12 }); } }
      if (time <= 0) { time = 0; phase = 'timeup'; phaseT = 0; say('TIME UP', '#ff4a4a', 3); R.sfx.play('lose'); }
      if (pl.spd * KMH >= 200) { hiSpeedT += dt; if (hiSpeedT > 0.5) R.achieve('top-speed'); } else hiSpeedT = 0;
      if (pl.pos >= st.len) {
        if (st.final) { phase = 'goal'; goalT = 0; tallyT = 0; say('GOAL!', '#ffe45e', 99); R.sfx.play('win'); R.fx.flash('#ffffff', 0.3); R.achieve('chequered-flag'); R.addScore(1000); }
        else endStage();
      }
    }
    if (phase === 'timeup' && phaseT > 2.8) R.gameOver();
    if (phase === 'goal') {
      goalT += dt;
      if (Math.random() < 0.35) R.fx.burst(U.rand(10, W - 10), U.rand(30, 120), { n: 6, color: ['#ffe45e', '#ff5ea8', '#4cc3ff', '#7fe88a', '#ffffff'], speed: 80, life: 1.0, size: 2, gravity: 70 });
      if (goalT > 1.2 && time > 0) { tallyT -= dt; if (tallyT <= 0) { tallyT = 0.05; var take = Math.min(time, 1); time -= take; R.addScore(Math.round(take * 150)); R.sfx.tone(900 + (time % 5) * 80, 0.04, { vol: 0.07 }); } }
      if (goalT > 1.2 && time <= 0.001 && goalT > 3) { R.gameOver({ win: true }); }
      if (goalT > 9) R.gameOver({ win: true });
    }
    /* engine */
    engT -= dt;
    if (engT <= 0 && pl.spd > 2) { engT = 0.07; R.sfx.tone(55 + pl.spd * 2.4, 0.07, { type: 'sawtooth', vol: 0.02 }); }

    camPos = pl.pos - CRAFT_D; camX += (pl.x * 0.85 - camX) * Math.min(1, dt * 10);
    bgx += c * pl.spd * dt * 160;
  }

  /* ---------------------------------------------------------------- rendering */
  function box(ctx, x, y, w, h, col, clip) {
    var x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    if (x1 <= x0) x1 = x0 + 1; if (y1 <= y0) y1 = y0 + 1;
    if (y0 >= clip) return; if (y1 > clip) y1 = clip;
    ctx.fillStyle = col; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  function drawImgClip(ctx, img, x, yBase, hpx, clip, flip) {
    var wpx = img.width / img.height * hpx, top = yBase - hpx;
    if (hpx < 1 || wpx < 1 || top >= clip) return;
    if (yBase > clip) {
      var vis = (clip - top) / hpx, sh = Math.max(1, Math.floor(img.height * vis));
      ctx.drawImage(img, 0, 0, img.width, sh, Math.round(x - wpx / 2), Math.round(top), Math.round(wpx), Math.round(hpx * sh / img.height));
    } else ctx.drawImage(img, Math.round(x - wpx / 2), Math.round(top), Math.round(wpx), Math.round(hpx));
  }
  function drawLayer(ctx, L, off) {
    var LW = L.img.width, x0 = -(((off * L.f) % LW) + LW) % LW;
    ctx.drawImage(L.img, Math.round(x0), L.y);
    if (x0 + LW < W) ctx.drawImage(L.img, Math.round(x0 + LW), L.y);
  }
  function drawBackdrop(ctx, T) {
    ctx.drawImage(T.skyImg, 0, 0);
    if (T.cloud) {
      var LW = T.cloud.width, x0 = -(((tm * 3 + bgx * 0.12) % LW) + LW) % LW;
      ctx.globalAlpha = 0.95; ctx.drawImage(T.cloud, Math.round(x0), 4); if (x0 + LW < W) ctx.drawImage(T.cloud, Math.round(x0 + LW), 4); ctx.globalAlpha = 1;
    }
    drawLayer(ctx, T.lay[0], bgx); drawLayer(ctx, T.lay[1], bgx);
  }

  function rowRoad(ctx, T, r, cx, rw, par, lv, dn, dash) {
    var xl = Math.round(cx - rw), xr = Math.round(cx + rw), wl = Math.max(1, Math.round(rw * 0.07));
    ctx.fillStyle = T.fw[par][lv]; ctx.fillRect(xl - wl, r, wl, 1); ctx.fillRect(xr, r, wl, 1);
    ctx.fillStyle = T.fr[par][lv]; ctx.fillRect(xl, r, xr - xl, 1);
    if (dn && rw > 3) {
      var lw = Math.max(1, Math.round(rw * 0.012)), e0 = Math.round(rw * 0.94), cr = Math.round(cx);
      ctx.fillStyle = T.fe[lv]; ctx.fillRect(cr - e0, r, lw, 1); ctx.fillRect(cr + e0 - lw, r, lw, 1);
      if (dash === 3) { ctx.fillStyle = T.fl[lv]; var l3 = Math.round(rw * 0.333); ctx.fillRect(cr - l3, r, lw, 1); ctx.fillRect(cr + l3 - lw, r, lw, 1); }
      else if (dash === 1) { ctx.fillStyle = T.fl[lv]; ctx.fillRect(cr - Math.floor(lw / 2), r, lw, 1); }
    }
  }

  function renderRoad(ctx, T) {
    var base = Math.floor(camPos), pct = camPos - base, bi = cl(base, st.N);
    var camH = heightAt(camPos + CRAFT_D);
    var x = 0, dx = -st.curve[bi] * pct, top = H, n, i, i2, r, t, lv;
    ctx.fillStyle = T.fg[0][LV]; ctx.fillRect(0, HZ, W, H - HZ);
    for (n = 0; n < DRAW; n++) {
      i = cl(base + n, st.N); i2 = cl(base + n + 1, st.N);
      var z1 = ZN + (n - pct) * SEGL, z2 = z1 + SEGL, s1 = ZN / z1, s2 = ZN / z2;
      var y1 = HZ + Y0 * s1 * (1 - (st.hy[i] - camH)), y2 = HZ + Y0 * s2 * (1 - (st.hy[i2] - camH));
      var cx1 = HALF + (x - camX) * X0 * s1, cx2 = HALF + (x + dx - camX) * X0 * s2;
      sX[n] = cx1; sY[n] = y1; sS[n] = s1; sClip[n] = top;
      x += dx; dx += st.curve[i];
      if (y2 >= top || y2 >= y1) continue;
      var r0 = Math.max(Math.ceil(y2), 0), r1 = Math.min(Math.ceil(y1), top);
      if (r1 <= r0) continue;
      lv = fogLv[n];
      var par = (Math.floor((base + n) / BAND)) & 1, w1 = X0 * s1, w2 = X0 * s2, dyy = y1 - y2, f1 = st.fork[i], f2 = st.fork[i2];
      ctx.fillStyle = T.fg[par][lv]; ctx.fillRect(0, r0, W, r1 - r0);
      var detail = n < 120, sea = T.sea;
      for (r = r0; r < r1; r++) {
        t = (r + 0.5 - y2) / dyy;
        var cx = cx2 + (cx1 - cx2) * t, rw = w2 + (w1 - w2) * t, f = f2 + (f1 - f2) * t;
        if (sea) {
          var se = Math.round(cx - rw * T.seaX);
          if (se > 0) { ctx.fillStyle = T.fs[par][lv]; ctx.fillRect(0, r, se, 1); ctx.fillStyle = T.ff[lv]; ctx.fillRect(Math.max(0, se - 2), r, par ? 2 : 1, 1); }
        }
        if (ribbons(f)) {
          var cc = (0.5 + 1.1 * f) * rw, hw = rw * 0.5;
          rowRoad(ctx, T, r, cx - cc, hw, par, lv, detail, par ? 0 : 1); rowRoad(ctx, T, r, cx + cc, hw, par, lv, detail, par ? 0 : 1);
        } else rowRoad(ctx, T, r, cx, rw, par, lv, detail, par ? 0 : 3);
      }
      top = r0;
    }
  }

  function drawGantry(ctx, T, it, n) {
    var s = sS[n], y = sY[n], clip = sClip[n], f = st.fork[cl(Math.floor(camPos) + n, st.N)], cx = sX[n];
    var half = (1.18 + 1.1 * f) * X0 * s, ph = 58 * s, pw = Math.max(1, 4 * s), bh = Math.max(3, 14 * s), by = y - ph;
    if (s < 0.05) return;
    box(ctx, cx - half - pw, by, pw, ph, '#39415e', clip); box(ctx, cx + half, by, pw, ph, '#39415e', clip);
    box(ctx, cx - half - pw, by, pw, ph, 'rgba(255,255,255,0.18)', clip);
    var bw = half * 2 + pw * 2, i, cells = Math.max(6, Math.round(bw / (4 * Math.max(0.5, s * 2))));
    if (it.g === 'fork') {
      var def = STAGES[stNo + 1];
      for (var sd = 0; sd < 2; sd++) {
        var d2 = def[sd], col = THEMES[d2.th].accent, pcx = cx + (sd ? 1 : -1) * (0.5 + 1.1 * f) * X0 * s, pwid = X0 * s * 0.92;
        box(ctx, pcx - pwid / 2, by - bh * 0.15, pwid, bh * 1.5, '#1d2b53', clip); box(ctx, pcx - pwid / 2 + s, by - bh * 0.15 + s, pwid - 2 * s, bh * 1.5 - 2 * s, col, clip);
        var ftxt = (sd ? '' : '<') + d2.tag + (sd ? '>' : '');
        if (pwid >= ftxt.length * 6 + 6 && by + bh * 1.2 < clip) {
          box(ctx, pcx - pwid / 2 + 2 * s, by + bh * 0.1, pwid - 4 * s, bh * 1.1, '#10131c', clip);
          R.draw.text(ctx, ftxt, Math.round(pcx), Math.round(by + bh * 0.28), { size: 6, color: col, align: 'center' });
        }
      }
      box(ctx, cx - half - pw, by - bh * 0.3, bw, Math.max(1, 3 * s), '#39415e', clip);
      return;
    }
    for (i = 0; i < cells; i++) for (var q = 0; q < 2; q++) box(ctx, cx - half - pw + i * bw / cells, by - bh + q * bh / 2, bw / cells + 0.6, bh / 2, ((i + q) & 1) ? '#10131c' : '#ffffff', clip);
    var label = it.g === 'start' ? 'START' : it.g === 'goal' ? 'GOAL' : 'CHECK';
    box(ctx, cx - half * 0.34, by - bh * 0.1, half * 0.68, bh * 1.0, it.g === 'goal' ? '#ffe45e' : '#10131c', clip);
    if (s > 0.38 && by < clip - 8) R.draw.text(ctx, label, Math.round(cx), Math.round(by + bh * 0.1), { size: 6, color: it.g === 'goal' ? '#10131c' : '#ffe45e', align: 'center' });
  }

  function drawScn(ctx, T, it, n) {
    var s = sS[n], y = sY[n], clip = sClip[n];
    if (s < 0.04) return;
    if (it.k === 'gantry') { drawGantry(ctx, T, it, n); return; }
    var x = sX[n] + it.o * X0 * s;
    if (it.k === 'chev') {
      var ss = s * 1.3, bwid = 12 * ss, bhei = 10 * ss, pole = Math.max(1, ss * 1.6);
      box(ctx, x - pole / 2, y - 14 * ss, pole, 14 * ss, '#8a93a8', clip); box(ctx, x - bwid / 2, y - 24 * ss, bwid, bhei, '#ffd23d', clip); box(ctx, x - bwid / 2 + ss, y - 24 * ss + ss, bwid - 2 * ss, bhei - 2 * ss, '#10131c', clip);
      for (var i = 0; i < 3; i++) { var yy = y - 23 * ss + (i + 0.5) * (bhei - 2 * ss) / 3, off = (1 - Math.abs(i - 1)) * it.d * 1.5 * ss; box(ctx, x - it.d * 1.2 * ss + off - ss * 0.6, yy, 1.4 * ss + 0.6, Math.max(1, 1.8 * ss), '#ffd23d', clip); }
      return;
    }
    if (it.k === 'island') {
      var hh = 44 * s, pw = Math.max(1, 3 * s), bw2 = 34 * s;
      box(ctx, x - pw / 2, y - hh, pw, hh, '#d8e0f0', clip); box(ctx, x - bw2 / 2, y - hh - 16 * s, bw2, 16 * s, '#ffd23d', clip); box(ctx, x - bw2 / 2 + s, y - hh - 15 * s, bw2 - 2 * s, 14 * s, '#10131c', clip);
      box(ctx, x - bw2 / 2 + 4 * s, y - hh - 9 * s, bw2 / 2 - 5 * s, 2 * s, '#ffd23d', clip); box(ctx, x + 2 * s, y - hh - 9 * s, bw2 / 2 - 5 * s, 2 * s, '#ffd23d', clip);
      box(ctx, x - bw2 / 2, y - 4 * s, bw2, 4 * s, '#e63946', clip); box(ctx, x - bw2 / 2 + 3 * s, y - 4 * s, 3 * s, 4 * s, '#ffffff', clip); box(ctx, x + bw2 / 2 - 6 * s, y - 4 * s, 3 * s, 4 * s, '#ffffff', clip);
      return;
    }
    var sp = SP[it.k]; if (!sp) return;
    drawImgClip(ctx, sp.img, x, y, sp.h * s, clip);
  }

  function drawCarSprite(ctx, img, x, y, latW, s, clip) {
    var wpx = latW * X0 * s * img.width / (img.width - 4), hpx = wpx * img.height / img.width;
    if (hpx < 1.5) return;
    var top = y - hpx + 2 * s;
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - wpx * 0.42), Math.round(y - 1), Math.round(wpx * 0.84), Math.max(1, Math.round(2 * s))); ctx.globalAlpha = 1;
    if (top >= clip) return;
    if (y > clip) { var vis = (clip - top) / hpx, sh = Math.max(1, Math.floor(img.height * vis)); ctx.drawImage(img, 0, 0, img.width, sh, Math.round(x - wpx / 2), Math.round(top), Math.round(wpx), Math.round(hpx * sh / img.height)); }
    else ctx.drawImage(img, Math.round(x - wpx / 2), Math.round(top), Math.round(wpx), Math.round(hpx));
  }

  function renderSprites(ctx, T) {
    var base = Math.floor(camPos), n, j, ri = 0, car, d;
    rvis.length = 0;
    for (j = 0; j < traffic.length; j++) { car = traffic[j]; d = car.pos - camPos; if (d < CRAFT_D - 2.2 || d >= DRAW - 2) continue; car.d = d; rvis.push(car); }
    rvis.sort(function (a, b) { return b.d - a.d; });
    for (n = DRAW - 2; n >= 0; n--) {
      var list = st.scn[cl(base + n, st.N)];
      if (list && n < 140) for (j = 0; j < list.length; j++) drawScn(ctx, T, list[j], n);
      while (ri < rvis.length && rvis[ri].d >= n) {
        car = rvis[ri++];
        var f = car.d - n, s = sS[n] + (sS[n + 1] - sS[n]) * f, y = sY[n] + (sY[n + 1] - sY[n]) * f, cx = sX[n] + (sX[n + 1] - sX[n]) * f;
        var im = CAR.traffic[car.kind][car.ci];
        if (car.hit > 0 && Math.floor(tm * 18) % 2) continue;
        drawCarSprite(ctx, im, cx + car.x * X0 * s, y, car.w, s, sClip[n]);
      }
    }
  }

  function drawPlayer(ctx) {
    var x = HALF + (pl.x - camX) * X0 * SC_C, img = CAR.player[Math.round(pl.lean) + 1], sc = 1.3, w = img.width * sc, h = img.height * sc;
    var shy = CAR_Y - 2 + Math.sin(tm * 40) * (pl.spd > 5 ? 0.4 : 0);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - w * 0.4), Math.round(CAR_Y - 2), Math.round(w * 0.8), 4); ctx.globalAlpha = 1;
    if (pl.inv > 0 && pl.spin <= 0 && Math.floor(tm * 16) % 2) return;
    if (pl.spin > 0) {
      ctx.save(); ctx.translate(Math.round(x), Math.round(shy - h * 0.45)); ctx.rotate(pl.rot); ctx.drawImage(img, Math.round(-w / 2), Math.round(-h * 0.45), Math.round(w), Math.round(h)); ctx.restore();
    } else ctx.drawImage(img, Math.round(x - w / 2), Math.round(shy - h + 4), Math.round(w), Math.round(h));
    /* exhaust puffs and speed flicker */
    if (pl.spd > 8 && Math.random() < 0.35) R.fx.burst(x + (Math.random() < 0.5 ? -7 : 7), CAR_Y - 2, { n: 1, color: ['#e8eef8', '#c8d2e4'], speed: 25, life: 0.3, size: 2, gravity: -10 });
  }

  function chequer(ctx, x, y, w, h, cell) {
    for (var yy = 0; yy < h; yy += cell) for (var xx = 0; xx < w; xx += cell) { ctx.fillStyle = (((xx / cell) + (yy / cell)) & 1) ? '#10131c' : '#ffffff'; ctx.fillRect(x + xx, y + yy, Math.min(cell, w - xx), Math.min(cell, h - yy)); }
  }

  function drawHud(ctx, T) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, 13);
    R.draw.text(ctx, 'SC ' + U.pad(R.score, 6), 4, 4, { size: 6, color: C.yellow });
    R.draw.text(ctx, 'STAGE ' + stNo + '/' + NSTAGES, W - 4, 4, { size: 6, color: '#ffffff', align: 'right' });
    /* chequered time panel */
    var tw = 50, tx = HALF - tw / 2, ty = 15, tcol = time <= 10 && Math.floor(tm * 4) % 2 ? '#ff4a4a' : '#ffe45e';
    chequer(ctx, tx, ty, tw, 30, 5);
    ctx.fillStyle = '#10131c'; ctx.fillRect(tx + 5, ty + 5, tw - 10, 20);
    R.draw.text(ctx, 'TIME', HALF, ty + 7, { size: 6, color: '#9fb2d0', align: 'center' });
    R.draw.text(ctx, U.pad(Math.ceil(time), 2), HALF, ty + 14, { size: 8, color: tcol, align: 'center' });
    /* speed */
    R.draw.text(ctx, String(Math.round(pl.spd * KMH)), 6, H - 31, { size: 16, color: '#ffffff', shadow: '#000' });
    R.draw.text(ctx, 'KM/H', 6, H - 13, { size: 6, color: '#ffe45e', shadow: '#000' });
    /* progress bar with checkpoint ticks */
    var bx = 56, bwid = W - 66, by = H - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx - 1, by - 1, bwid + 2, 7);
    ctx.fillStyle = THEMES[st.def.th].accent; ctx.fillRect(bx, by, Math.round(bwid * U.clamp(pl.pos / st.len, 0, 1)), 5);
    ctx.fillStyle = '#ffffff'; st.cps.forEach(function (cp) { ctx.fillRect(bx + Math.round(bwid * cp.i / st.len), by - 1, 1, 7); });
    chequer(ctx, bx + bwid - 6, by - 1, 6, 7, 2);
    /* fork hint */
    var f = forkAt(pl.pos);
    if (!st.final && pl.pos > st.forkStart - 60 && phase === 'run') {
      var o = STAGES[stNo + 1], fl = Math.floor(tm * 3) % 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, H - 76, W, 12);
      R.draw.text(ctx, '< ' + o[0].tag, 4, H - 73, { size: 6, color: fl ? '#ffffff' : THEMES[o[0].th].accent });
      R.draw.text(ctx, o[1].tag + ' >', W - 4, H - 73, { size: 6, color: fl ? '#ffffff' : THEMES[o[1].th].accent, align: 'right' });
      R.draw.text(ctx, 'CHOOSE', HALF, H - 73, { size: 6, color: '#ffe45e', align: 'center' });
    }
  }

  function drawOverlay(ctx) {
    if (phase === 'ready') {
      var cn = 3 - Math.floor(phaseT / 0.75);
      R.draw.text(ctx, st.def.name, HALF, 66, { size: 8, color: THEMES[st.def.th].accent, align: 'center', shadow: '#000' });
      if (cn >= 1) R.draw.text(ctx, String(cn), HALF, 84, { size: 16, color: '#ffe45e', align: 'center', shadow: '#000' });
    }
    if (stats.nameT > 0 && phase === 'run') {
      ctx.globalAlpha = Math.min(1, stats.nameT / 0.5);
      R.draw.text(ctx, st.def.name, HALF, 100, { size: 8, color: THEMES[st.def.th].accent, align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (banner && phase !== 'ready') {
      var a = banner.t < 0.4 ? banner.t / 0.4 : 1, big = banner.text === 'GO!' || banner.text === 'GOAL!' || banner.text === 'TIME UP';
      ctx.globalAlpha = Math.min(1, a);
      R.draw.text(ctx, banner.text, HALF, big ? 70 : 62, { size: big ? 16 : 8, color: banner.color, align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (phase === 'goal' && goalT > 1) {
      R.draw.text(ctx, 'TIME BONUS', HALF, 104, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
      R.draw.text(ctx, String(Math.ceil(time)) + 's x150', HALF, 116, { size: 8, color: '#ffe45e', align: 'center', shadow: '#000' });
    }
    if (fadeT > 0) { ctx.globalAlpha = Math.min(1, fadeT * 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  R.game({
    layout: 'full', size: [W, H], bg: '#2f8fe8', music: 'adventure',

    init: function () {
      defSp('palm', palm('#2fb34a', '#6fe07a', '#1f8c3a', '#a0673a', '#7a4a28', '#7a4a1c'), 128, 0.2, true);
      defSp('palmD', palm('#4a8a3a', '#7cc060', '#2f6a2c', '#7a4a3a', '#5a3228', '#5a3418'), 128, 0.2, true);
      defSp('pine', pine('#1f7a3c', '#2f9a52', '#145a2a', '#6b4a2e'), 118, 0.22, true);
      defSp('oak', oak('#2f9a3c', '#5fce5a', '#1d6e2c', '#6b4a2e'), 104, 0.3, true);
      defSp('cactus', cactus('#3f9a4c', '#6fd07b', '#2a7a38'), 64, 0.18, true);
      defSp('rock', rock('#b86a3c', '#d68a54', '#8a4a28'), 40, 0.3, true);
      defSp('cliff', cliff('#8a4a6a', '#b36c8a', '#5e2f4a'), 150, 0.6, true);
      defSp('umb', umbrella('#ff3b30', '#ffffff'), 46, 0.2, true);
      defSp('bill0', billboard(0), 96, 0.45, true); defSp('bill1', billboard(1), 96, 0.45, true); defSp('bill2', billboard(2), 96, 0.45, true);
      defSp('lamp', lamp(), 110, 0.1, true);
      for (var b = 0; b < 4; b++) defSp('bld' + b, building(['#1c2352', '#24204f', '#1a2f55', '#2a2348'][b], ['#2f3a78', '#38307a', '#2a4478', '#3c3470'][b], ['#ffe27a', '#7fe9ff', '#ff9ad0'], 7 + b * 5), 230, 0.9, false);
      buildCars();
      Object.keys(THEMES).forEach(prepTheme);
    },

    reset: reset,
    update: update,

    render: function (ctx, w, h) {
      var T = THEMES[st.def.th];
      drawBackdrop(ctx, T);
      renderRoad(ctx, T);
      renderSprites(ctx, T);
      drawPlayer(ctx);
      drawHud(ctx, T);
      drawOverlay(ctx);
    }
  });
})();
