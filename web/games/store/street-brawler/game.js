/* Street Brawler — side-scrolling beat-'em-up with a depth lane, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164, HUD_H = 30;
  var Y0 = 108, Y1 = 156;                              // walkable depth band (feet y)
  var GRAV = 520, WALK_X = 46, WALK_Y = 30, SPIN_COST = 10, SPIN_CD = 2.2;
  var OUT = '#150b24';

  /* ------------------------------------------------------------------ helpers */
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function sgn(v) { return v < 0 ? -1 : 1; }
  function rr(a, b) { return a + Math.random() * (b - a); }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function fr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function gradBands(g, w, y0, y1, stops, band) {
    for (var y = y0; y < y1; y += band) {
      var f = (y - y0) / (y1 - y0) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f));
      fr(g, 0, y, w, band, rgb(mix(hex(stops[i]), hex(stops[i + 1]), f - i)));
    }
  }
  function pxLine(ctx, x0, y0, x1, y1, w, col) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    ctx.fillStyle = col;
    for (var i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - w / 2), Math.round(y0 + (y1 - y0) * i / n - w / 2), w, w);
  }

  /* ------------------------------------------------------------ puppet sprites */
  /* Each fighter is rasterised from a tiny skeleton (head, torso, two legs, two arms) so every move
     frame lines up. Poses give foot (ff/bf) and hand (fa/ba) offsets from hip / shoulder.        */
  function grid(w, h) { var g = [], x, y; for (y = 0; y < h; y++) { var r = []; for (x = 0; x < w; x++) r.push('.'); g.push(r); } return g; }
  function put(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
  function box(g, x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) put(g, x + i, y + j, c); }
  function limb(g, x0, y0, x1, y1, t, c) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (var i = 0; i <= n; i++) box(g, Math.round(x0 + (x1 - x0) * i / n - (t - 1) / 2), Math.round(y0 + (y1 - y0) * i / n - (t - 1) / 2), t, t, c);
  }
  function outline(g) {
    var h = g.length, w = g[0].length, out = [], x, y;
    function at(x, y) { return (y < 0 || y >= h || x < 0 || x >= w) ? '.' : g[y][x]; }
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

  var POSES = {
    idle0: { ff: [2, 0], bf: [-2, 0], fa: [5, 4], ba: [7, 2], wa: -60 },
    idle1: { drop: 1, ff: [2, 0], bf: [-2, 0], fa: [5, 5], ba: [7, 3], wa: -60 },
    walk0: { ff: [4, 0], bf: [-3, 0], fa: [5, 4], ba: [7, 2], wa: -60 },
    walk1: { drop: 1, ff: [1, -2], bf: [-1, 0], fa: [5, 4], ba: [7, 3], wa: -60 },
    walk2: { ff: [-3, 0], bf: [4, 0], fa: [5, 4], ba: [7, 2], wa: -60 },
    walk3: { drop: 1, ff: [-1, 0], bf: [1, -2], fa: [5, 4], ba: [7, 3], wa: -60 },
    punch1w: { lean: -1, ff: [2, 0], bf: [-3, 0], fa: [2, 3], ba: [6, 2], wa: -110 },
    punch1: { lean: 2, ff: [3, 0], bf: [-3, 0], fa: [10, 1], ba: [6, 3], wa: 20 },
    punch2w: { lean: -1, ff: [2, 0], bf: [-3, 0], fa: [5, 4], ba: [3, 2] },
    punch2: { lean: 2, ff: [4, 0], bf: [-3, 0], fa: [4, 4], ba: [11, 1], swap: true },
    punch3w: { lean: -2, drop: 1, ff: [3, 0], bf: [-4, 0], fa: [1, 5], ba: [4, 4] },
    punch3: { lean: 3, drop: 1, hd: [1, -1], ff: [5, 0], bf: [-3, 0], fa: [8, -6], ba: [5, 3] },
    jump: { ff: [3, -5], bf: [-2, -4], fa: [5, -1], ba: [7, -3], wa: -60 },
    kick: { lean: -2, hd: [-1, 0], ff: [11, -4], bf: [-3, -2], fa: [3, 4], ba: [5, 5] },
    hurt: { lean: -2, hd: [-2, 1], face: 'hurt', ff: [1, 0], bf: [-3, 0], fa: [-1, 4], ba: [-2, 5] },
    fall: { face: 'hurt', ff: [0, 0], bf: [0, 0], fa: [0, 7], ba: [0, 7] },
    crouch: { drop: 3, lean: 1, ff: [4, 0], bf: [-3, 0], fa: [5, 4], ba: [7, 3] },
    spin0: { ff: [6, -3], bf: [-6, -3], fa: [10, 0], ba: [-9, 1], swap: true },
    pipeW: { lean: -1, ff: [2, 0], bf: [-3, 0], fa: [2, -7], ba: [6, 2], wa: -105 },
    pipeS: { lean: 3, ff: [4, 0], bf: [-3, 0], fa: [9, 3], ba: [5, 3], wa: 20 },
    vic: { ff: [2, 0], bf: [-2, 0], fa: [3, -9], ba: [2, -8] },
    hwind: { lean: -3, drop: 1, hd: [-1, 0], ff: [3, 0], bf: [-4, 0], fa: [-3, -2], ba: [3, 3] },
    hpunch: { lean: 4, drop: 1, ff: [5, 0], bf: [-3, 0], fa: [10, 3], ba: [7, 4] },
    swind: { lean: -1, ff: [2, 0], bf: [-3, 0], fa: [0, -3], ba: [6, 3], wa: -110 },
    slash: { lean: 3, ff: [4, 0], bf: [-3, 0], fa: [8, 3], ba: [5, 3], wa: 25 },
    twind: { lean: -2, ff: [2, 0], bf: [-3, 0], fa: [-2, -2], ba: [5, 3], wa: -160 },
    throw: { lean: 2, ff: [3, 0], bf: [-3, 0], fa: [9, -2], ba: [5, 3] },
    charge: { lean: 4, drop: 1, hd: [1, 1], ff: [5, 0], bf: [-4, 0], fa: [7, 4], ba: [8, 3] },
    slamw: { lean: -1, ff: [2, 0], bf: [-2, 0], fa: [3, -9], ba: [1, -9] },
    slam: { lean: 2, drop: 2, ff: [4, 0], bf: [-3, 0], fa: [8, 6], ba: [9, 5] },
    whipw: { lean: -2, ff: [2, 0], bf: [-3, 0], fa: [-3, -4], ba: [5, 3], wa: -160 },
    whip: { lean: 3, ff: [4, 0], bf: [-3, 0], fa: [9, 1], ba: [5, 3], wa: 0 },
    dash: { lean: 4, drop: 1, ff: [5, 0], bf: [-4, 0], fa: [8, 3], ba: [6, 3], wa: 15 }
  };

  var SPECS = {
    hero: { sc: 1, hw: 6, hh: 6, tw: 7, th: 7, ll: 8, t: 2, hair: 'spiky', band: true, belt: true, glove: true },
    brawler: { sc: 1, hw: 6, hh: 6, tw: 7, th: 7, ll: 8, t: 2, hair: 'cap', sleeve: true },
    knifer: { sc: 1, hw: 6, hh: 6, tw: 6, th: 7, ll: 9, t: 2, hair: 'beanie', sleeve: true, scarf: true },
    bruiser: { sc: 1.25, hw: 8, hh: 7, tw: 10, th: 9, ll: 9, t: 3, hair: 'bald', beard: true, belt: true, glove: true, vest: true },
    crusher: { sc: 1.4, hw: 9, hh: 8, tw: 12, th: 11, ll: 11, t: 4, hair: 'mohawk', belt: true, glove: true, vest: true, studs: true },
    anchor: { sc: 1.35, hw: 8, hh: 7, tw: 12, th: 12, ll: 11, t: 3, hair: 'cap', capCol: 'x', beard: true, sleeve: true, coat: true },
    baron: { sc: 1.1, hw: 6, hh: 7, tw: 7, th: 8, ll: 11, t: 2, hair: 'slick', shades: true, sleeve: true, tie: true }
  };
  Object.keys(SPECS).forEach(function (k) {
    var s = SPECS[k];
    s.cx = Math.round(12 + 14 * s.sc); s.gw = s.cx * 2; s.gh = s.hh + s.th + s.ll + 12;
  });

  function rasterize(sp, pose) {
    var sc = sp.sc, cx = sp.cx, FY = sp.gh - 4, t = sp.t, g = grid(sp.gw, sp.gh);
    var drop = pose.drop || 0, lean = pose.lean || 0, hd = pose.hd || [0, 0];
    var hipY = FY - sp.ll + drop, torsoTop = hipY - sp.th + 1;
    var tx0 = cx - Math.floor(sp.tw / 2) + lean;
    var hx0 = tx0 + Math.floor((sp.tw - sp.hw) / 2) + 1 + hd[0];
    var headTop = torsoTop - sp.hh + 1 + hd[1];
    function sx(v) { return Math.round(v * sc); }
    var hipF = [cx + 1 + Math.round(lean / 2), hipY], hipB = [cx - 1 + Math.round(lean / 2), hipY];
    var ff = pose.ff, bf = pose.bf, fa = pose.fa, ba = pose.ba;
    var footF = [cx + sx(ff[0]), FY - 1 + sx(ff[1])], footB = [cx + sx(bf[0]), FY - 1 + sx(bf[1])];
    var shF = [tx0 + sp.tw - 2, torsoTop + 1], shB = [tx0 + 1, torsoTop + 1];
    var hF = [shF[0] + sx(fa[0]), shF[1] + sx(fa[1])], hB = [shB[0] + sx(ba[0]), shB[1] + sx(ba[1])];
    var fist = t + 1;

    function leg(hip, foot, pc, front) {
      limb(g, hip[0], hip[1], foot[0], foot[1], t, pc);
      box(g, foot[0] - 1, foot[1], t + 2, 2, front ? 'b' : 'B');
    }
    function arm(sh, h, front) {
      var sleeveC = front ? 's' : 'S', skinC = front ? 'k' : 'K';
      if (sp.sleeve) {
        var mx = Math.round((sh[0] + h[0]) / 2), my = Math.round((sh[1] + h[1]) / 2);
        limb(g, sh[0], sh[1], mx, my, t, sleeveC); limb(g, mx, my, h[0], h[1], t, skinC);
      } else limb(g, sh[0], sh[1], h[0], h[1], t, skinC);
      box(g, h[0] - 1, h[1] - 1, fist, fist, sp.glove ? 'g' : skinC);
    }
    leg(hipB, footB, 'P', false);
    if (!pose.swap) arm(shB, hB, false);
    box(g, tx0, torsoTop, sp.tw, sp.th, 's');
    box(g, tx0, torsoTop, 1, sp.th, 'S');
    if (sp.vest) { box(g, tx0 + 3, torsoTop + 1, sp.tw - 6, sp.th - 2, 'k'); box(g, tx0 + 3, torsoTop + 1, 1, sp.th - 2, 'K'); }
    if (sp.coat) { box(g, tx0 - 1, hipY - 1, 3, 6, 'S'); for (var cy = torsoTop + 2; cy < hipY; cy += 3) put(g, tx0 + sp.tw - 3, cy, 'a'); }
    if (sp.tie) { box(g, tx0 + sp.tw - 3, torsoTop, 2, 1, 'S'); box(g, tx0 + sp.tw - 3, torsoTop + 1, 1, sp.th - 3, 'a'); }
    if (sp.belt) box(g, tx0, hipY, sp.tw, 1, 'a');
    if (sp.studs) { put(g, tx0 + 1, torsoTop + 1, 'g'); put(g, tx0 + 1, torsoTop + 4, 'g'); put(g, tx0 + sp.tw - 2, torsoTop + 1, 'g'); put(g, tx0 + sp.tw - 2, torsoTop + 4, 'g'); }
    if (sp.scarf) { box(g, tx0 + sp.tw - 4, torsoTop - 1, 4, 2, 'a'); box(g, tx0 - 1, torsoTop, 2, 3, 'a'); }
    leg(hipF, footF, 'p', true);
    // head
    box(g, hx0, headTop, sp.hw, sp.hh, 'k');
    box(g, hx0, headTop, 1, sp.hh, 'K');
    put(g, hx0 + sp.hw, headTop + Math.floor(sp.hh / 2), 'k');
    var ey = headTop + Math.floor(sp.hh / 2) - 1;
    if (pose.face === 'hurt') {
      put(g, hx0 + sp.hw - 2, ey, 'e'); put(g, hx0 + sp.hw - 2, ey + 1, 'e'); put(g, hx0 + sp.hw - 1, ey + 2 + (sp.sc > 1.2 ? 1 : 0), 'e'); put(g, hx0 + sp.hw - 2, ey + 2 + (sp.sc > 1.2 ? 1 : 0), 'e');
    } else {
      put(g, hx0 + sp.hw - 2, ey, 'e');
      if (sp.sc > 1.2) put(g, hx0 + sp.hw - 2, ey + 1, 'e');
      put(g, hx0 + sp.hw - 1, headTop + sp.hh - 2, 'K');
    }
    if (sp.shades) box(g, hx0 + sp.hw - 4, ey, 5, 2, 'e');
    if (sp.beard) { box(g, hx0 + 1, headTop + sp.hh - 2, sp.hw - 1, 2, 'h'); put(g, hx0 + sp.hw, headTop + sp.hh - 2, 'h'); }
    var hr = sp.hair;
    if (hr === 'spiky') {
      box(g, hx0 - 1, headTop - 1, sp.hw + 1, 3, 'h'); box(g, hx0 - 1, headTop + 2, 2, 2, 'h');
      put(g, hx0, headTop - 2, 'h'); put(g, hx0 + 2, headTop - 3, 'h'); put(g, hx0 + 4, headTop - 2, 'h'); put(g, hx0 + 2, headTop - 2, 'h');
      put(g, hx0 + 3, headTop - 1, 'H'); put(g, hx0 + 1, headTop, 'H');
    } else if (hr === 'cap') {
      var cc = sp.capCol || 'a';
      box(g, hx0 - 1, headTop - 1, sp.hw + 1, 2, cc); box(g, hx0 + sp.hw, headTop, 3, 1, cc); box(g, hx0 - 1, headTop + 1, 1, 2, 'h');
      if (sp.coat) { put(g, hx0 + 2, headTop - 1, 'a'); put(g, hx0 + 3, headTop - 1, 'a'); put(g, hx0 + 2, headTop, 'a'); }
    } else if (hr === 'beanie') {
      box(g, hx0 - 1, headTop - 2, sp.hw + 2, 3, 'S'); box(g, hx0 - 1, headTop, sp.hw + 2, 1, 'a'); put(g, hx0 + 2, headTop - 2, 'a'); put(g, hx0 + 5, headTop - 2, 'a'); box(g, hx0 - 2, headTop + 1, 1, 2, 'h');
    } else if (hr === 'mohawk') {
      var mc = hx0 + Math.floor(sp.hw / 2) - 1;
      box(g, mc, headTop - 3, 4, 4, 'h'); put(g, mc + 1, headTop - 4, 'h'); put(g, mc + 2, headTop - 4, 'h'); put(g, mc + 1, headTop - 3, 'H'); put(g, mc, headTop - 2, 'H'); box(g, hx0, headTop, 1, 2, 'K');
    } else if (hr === 'slick') {
      box(g, hx0 - 2, headTop - 1, sp.hw + 2, 3, 'h'); box(g, hx0 - 2, headTop + 2, 2, 2, 'h'); put(g, hx0 + 3, headTop - 1, 'H'); put(g, hx0 + 1, headTop, 'H');
    } else if (hr === 'bald') { put(g, hx0 + sp.hw - 3, headTop, 'H'); put(g, hx0 + sp.hw - 4, headTop, 'H'); }
    if (sp.band) {
      box(g, hx0 - 1, headTop + 1, sp.hw + 1, 1, 'a');
      var tl = (pose === POSES.walk0 || pose === POSES.walk2 || pose === POSES.punch1) ? 1 : 0;
      box(g, hx0 - 4 - tl, headTop + 1 + tl, 3, 1, 'a'); box(g, hx0 - 3 - tl, headTop + 2 + tl, 2, 1, 'a');
    }
    if (pose.swap) {
      arm(shB, hB, true);
    }
    arm(shF, hF, true);
    return { g: g, hx: hF[0], hy: hF[1], ax: cx, ay: FY + 1 };
  }

  function wrap(canvas, r, extra) { var s = { c: canvas, ax: r.ax + 1, ay: r.ay + 1, hx: r.hx + 1, hy: r.hy + 1 }; if (extra) for (var k in extra) s[k] = extra[k]; return s; }

  function lyingSprite(sp, pal) {
    var r = rasterize(sp, POSES.fall), g = r.g, gw = g[0].length, gh = g.length, ng = grid(gh, gw), x, y;
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) ng[gw - 1 - x][y] = g[y][x];
    var x0 = 99, x1 = -1, y0 = 99, y1 = -1;
    for (y = 0; y < ng.length; y++) for (x = 0; x < ng[0].length; x++) if (ng[y][x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    var cg = grid(x1 - x0 + 1, y1 - y0 + 1);
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) cg[y - y0][x - x0] = ng[y][x];
    var rows = outline(cg), canvas = R.sprite(rows, pal);
    return { c: canvas, ax: Math.floor(rows[0].length / 2), ay: rows.length - 1, hx: 0, hy: 0 };
  }

  function buildSet(key, pal) {
    var sp = SPECS[key], set = {};
    Object.keys(POSES).forEach(function (name) {
      if (name === 'fall') return;
      var r = rasterize(sp, POSES[name]);
      set[name] = wrap(R.sprite(outline(r.g), pal), r);
    });
    set.down = lyingSprite(sp, pal);
    return set;
  }

  function shadeC(c, a) { return R.util.shade(c, a); }
  function pal(o) {
    var base = { o: OUT, e: '#1a1030', x: '#f4f4ff', g: '#ffe14a', b: '#1d1d2b', B: '#111119' };
    for (var k in o) base[k] = o[k];
    if (!o.S && o.s) base.S = shadeC(o.s, -0.3);
    if (!o.P && o.p) base.P = shadeC(o.p, -0.3);
    if (!o.K && o.k) base.K = shadeC(o.k, -0.15);
    if (!o.H && o.h) base.H = shadeC(o.h, 0.35);
    return base;
  }

  var SETS = {}, S = {};
  function buildAll() {
    SETS.hero = buildSet('hero', pal({ k: '#ffcfa8', h: '#ff8a1e', s: '#1fc9d6', S: '#13909e', a: '#ff2f7a', p: '#2b3470', b: '#f4f4ff', B: '#b8b8d0', g: '#ffe14a' }));
    var bs = ['#d8403c', '#e8a020', '#3cb850'], ks = ['#e83a8a', '#3ae8c8', '#e8e83a'], vs = ['#3f6f3a', '#3a64b0', '#a03a78'];
    SETS.brawler = bs.map(function (c, i) { return buildSet('brawler', pal({ k: i === 1 ? '#d89868' : '#f0b890', h: '#3a2418', s: c, a: ['#22222e', '#5a3a1a', '#1a3a2a'][i], p: '#3a3f5a', g: undefined, b: '#1d1d2b' })); });
    SETS.knifer = ks.map(function (c, i) { return buildSet('knifer', pal({ k: '#f0d0bc', h: '#101018', s: '#2a2438', a: c, p: i === 2 ? '#2a4a5a' : '#5a2a6a', b: '#101018' })); });
    SETS.bruiser = vs.map(function (c, i) { return buildSet('bruiser', pal({ k: i === 1 ? '#c88458' : '#d89058', K: '#a8683c', h: '#2a1a10', s: c, a: '#d8b030', p: ['#5a4a2a', '#3a4a5a', '#4a3a4a'][i], g: '#22222a', b: '#2a1c12' })); });
    SETS.crusher = [buildSet('crusher', pal({ k: '#e08a5e', h: '#ff9a1a', s: '#8a1a24', a: '#ffd23a', p: '#26262e', g: '#c8c8d8', b: '#101014' }))];
    SETS.anchor = [buildSet('anchor', pal({ k: '#d09068', h: '#dcdce8', s: '#2a52b8', S: '#14286a', a: '#ffd23a', x: '#e8eef8', p: '#14224a', g: '#d09068', b: '#101018' }))];
    SETS.baron = [buildSet('baron', pal({ k: '#f0c8a8', h: '#c8c8dc', s: '#f2f2fa', S: '#b8b8d0', a: '#e0203a', p: '#e6e6f2', g: '#f0c8a8', b: '#14141c', e: '#0a0a12' }))];

    var pi = { r: '#e8283a', w: '#ff9aa8', g: '#3dc84a', m: '#a8602a', M: '#d88a3a', h: '#f0b060', n: '#f4f0e0', N: '#c8c0a8', y: '#ffe14a', Y: '#c89a1a', G: '#39b84a', D: '#1f7a2e', t: '#8a8a9a', T: '#c8c8d8', d: '#5a5a6a' };
    S.apple = R.sprite(outline(['...gg...'.split(''), '....g...'.split(''), '.rrrrrr.'.split(''), 'rrwrrrrr'.split(''), 'rrwrrrrr'.split(''), 'rrrrrrrr'.split(''), '.rrrrrr.'.split(''), '..rr.rr.'.split('')]), pi);
    S.meat = R.sprite(outline(['...mmmm....', '..mMMMMm...', '.mMhhMMMm..', '.mMhMMMMm..', '.mMMMMMMm..', '..mMMMMm.n.', '...mmmmnnN.', '.......nNN.', '.......nN..'].map(function (r) { return r.split(''); })), pi);
    S.cash = R.sprite(outline(['...GG...', '..GGGG..', '.DDDDDD.', 'GGGDDGGG', 'GGDyyDGG', 'GGDyDDGG', 'GGDDyDGG', 'GGDyyDGG', '.GGDDGG.'].map(function (r) { return r.split(''); })), pi);
    S.pipe = R.sprite(outline(['TTTTTTTTTTTTTT', 'tttttttttttttt', 'dddddddddddddd'].map(function (r) { return r.split(''); })), pi);
    S.knife = R.sprite(['..TTTT', 'dddTTT'], pi);
  }

  function crateSprite(theme) {
    var cols = [['#b07a3a', '#7a4e22', '#d8a45a'], ['#3a6ea8', '#1f4472', '#6aa0d8'], ['#7a7a98', '#4a4a64', '#a8a8c8']][theme], rows = [], x, y, w = 14, h = 14;
    for (y = 0; y < h; y++) {
      var r = '';
      for (x = 0; x < w; x++) {
        var c = 'n';
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c = 'N';
        else if (x === y || x === w - 1 - y) c = 'N';
        else if (y === 1 || x === 1) c = 'L';
        r += c;
      }
      rows.push(r);
    }
    return R.sprite(outline(rows.map(function (s) { return s.split(''); })), { o: OUT, n: cols[0], N: cols[1], L: cols[2] });
  }
  function barrelSprite() {
    var rows = [], y, x;
    for (y = 0; y < 16; y++) {
      var half = (y === 0 || y === 15) ? 4 : (y === 1 || y === 14) ? 5 : 6, r = '';
      for (x = 0; x < 12; x++) {
        var d = Math.abs(x - 5.5);
        if (d > half) { r += '.'; continue; }
        var c = x < 3 ? 'L' : (x > 8 ? 'N' : 'n');
        if (y === 2 || y === 7 || y === 8 || y === 13) c = 's';
        r += c;
      }
      rows.push(r.split(''));
    }
    return R.sprite(outline(rows), { o: OUT, n: '#c8402a', N: '#7a1f14', L: '#ff7a5a', s: '#c8ccd8' });
  }

  /* ------------------------------------------------------------------ stage data */
  var STAGES = [
    { name: 'DOWNTOWN', theme: 0, width: 600, maxOn: 3, caps: 2,
      waves: [
        { at: 0, sp: [[0.4, 'brawler', 'R'], [2.0, 'brawler', 'R']] },
        { at: 150, sp: [[0, 'brawler', 'L'], [0.7, 'brawler', 'R'], [3.4, 'brawler', 'R']] },
        { at: 300, sp: [[0, 'knifer', 'R'], [0.9, 'brawler', 'L'], [3.2, 'brawler', 'R']] },
        { at: 464, boss: true, sp: [[0.9, 'crusher', 'R'], [6, 'brawler', 'L'], [11, 'brawler', 'R']] }
      ],
      props: [[70, 122, 'crate', 'apple'], [225, 132, 'crate', 'meat'], [345, 118, 'crate', 'pipe'], [425, 140, 'crate', 'apple']],
      loose: [[190, 146, 'cash'], [560, 130, 'cash']] },
    { name: 'DOCKS', theme: 1, width: 680, maxOn: 3, caps: 2,
      waves: [
        { at: 0, sp: [[0.4, 'brawler', 'L'], [1.0, 'brawler', 'R'], [3.0, 'brawler', 'R']] },
        { at: 140, sp: [[0, 'knifer', 'R'], [0.8, 'knifer', 'L'], [3.0, 'brawler', 'R']] },
        { at: 290, sp: [[0, 'bruiser', 'R'], [2.5, 'brawler', 'L'], [5, 'brawler', 'R']] },
        { at: 420, sp: [[0, 'bruiser', 'L'], [1.2, 'knifer', 'R'], [4, 'brawler', 'R']] },
        { at: 544, boss: true, sp: [[0.9, 'anchor', 'R'], [6, 'brawler', 'L'], [10, 'knifer', 'R']] }
      ],
      props: [[60, 124, 'barrel', 'apple'], [200, 140, 'barrel', 'pipe'], [350, 120, 'barrel', 'meat'], [470, 138, 'barrel', 'apple'], [600, 126, 'barrel', 'meat']],
      loose: [[110, 148, 'cash'], [330, 150, 'cash'], [640, 146, 'cash']] },
    { name: 'ROOFTOP', theme: 2, width: 760, maxOn: 4, caps: 3,
      waves: [
        { at: 0, sp: [[0.4, 'knifer', 'R'], [1.0, 'brawler', 'L'], [2.5, 'knifer', 'R'], [4, 'brawler', 'R']] },
        { at: 150, sp: [[0, 'bruiser', 'R'], [1.5, 'knifer', 'L'], [4, 'knifer', 'R']] },
        { at: 300, sp: [[0, 'brawler', 'L'], [0.6, 'brawler', 'R'], [1.4, 'knifer', 'R'], [4, 'brawler', 'L']] },
        { at: 460, sp: [[0, 'bruiser', 'L'], [3, 'bruiser', 'R'], [5, 'knifer', 'R']] },
        { at: 624, boss: true, sp: [[0.9, 'baron', 'R'], [6, 'knifer', 'L'], [11, 'knifer', 'R']] }
      ],
      props: [[80, 126, 'crate', 'apple'], [215, 120, 'crate', 'pipe'], [370, 142, 'crate', 'meat'], [520, 124, 'crate', 'meat'], [680, 138, 'crate', 'apple']],
      loose: [[130, 148, 'cash'], [440, 150, 'cash'], [700, 130, 'cash']] }
  ];

  var TYPES = {
    brawler: { name: 'THUG', hp: 26, sp: 28, hw: 5, keep: 13, moves: ['punch'], score: 100, cd: [0.6, 1.4], set: 'brawler', sh: 12 },
    knifer: { name: 'BLADE', hp: 22, sp: 33, hw: 5, keep: 52, retreat: true, moves: ['slash', 'throw'], score: 200, cd: [0.8, 1.8], set: 'knifer', wep: 'knife', sh: 12 },
    bruiser: { name: 'BRUTE', hp: 70, sp: 20, hw: 8, keep: 19, moves: ['heavy', 'charge'], score: 400, cd: [1.0, 2.0], poise: 30, set: 'bruiser', sh: 18 },
    crusher: { name: 'CRUSHER', hp: 170, sp: 24, hw: 9, keep: 20, moves: ['punch2', 'heavy', 'slam', 'charge'], score: 3000, cd: [0.6, 1.3], poise: 45, boss: true, set: 'crusher', sh: 20 },
    anchor: { name: 'ANCHOR', hp: 200, sp: 24, hw: 9, keep: 30, moves: ['whip', 'heavy', 'charge'], score: 4000, cd: [0.6, 1.2], poise: 50, boss: true, set: 'anchor', wep: 'chain', sh: 20 },
    baron: { name: 'THE BARON', hp: 230, sp: 36, hw: 6, keep: 24, retreat: true, moves: ['combo', 'fan', 'dash', 'slash'], score: 6000, cd: [0.5, 1.0], poise: 40, boss: true, set: 'baron', sh: 14 }
  };

  var MOVES = {
    punch: { wind: 0.3, act: 0.12, rec: 0.38, kind: 'melee', reach: 15, dmg: 8, min: 0, max: 18, wp: 'punch1w', ap: 'punch1' },
    punch2: { wind: 0.28, act: 0.12, rec: 0.16, kind: 'melee', reach: 16, dmg: 8, min: 0, max: 19, wp: 'punch1w', ap: 'punch1', again: 'punch2b' },
    punch2b: { wind: 0.2, act: 0.12, rec: 0.45, kind: 'melee', reach: 17, dmg: 10, kn: true, min: 0, max: 99, wp: 'punch2w', ap: 'punch2', follow: true },
    heavy: { wind: 0.52, act: 0.14, rec: 0.6, kind: 'melee', reach: 21, dmg: 14, kn: true, min: 0, max: 23, wp: 'hwind', ap: 'hpunch' },
    slash: { wind: 0.3, act: 0.12, rec: 0.4, kind: 'melee', reach: 19, dmg: 9, min: 0, max: 24, wp: 'swind', ap: 'slash' },
    throw: { wind: 0.4, act: 0.1, rec: 0.55, kind: 'proj', n: 1, dmg: 8, min: 38, max: 120, align: 4, wp: 'twind', ap: 'throw' },
    fan: { wind: 0.5, act: 0.1, rec: 0.6, kind: 'proj', n: 3, dmg: 8, min: 30, max: 120, align: 14, wp: 'twind', ap: 'throw' },
    charge: { wind: 0.5, act: 0.75, rec: 0.8, kind: 'charge', spd: 100, dmg: 12, kn: true, min: 50, max: 150, align: 9, wp: 'hwind', ap: 'charge' },
    slam: { wind: 0.7, act: 0.14, rec: 0.75, kind: 'wave', dmg: 10, kn: true, min: 0, max: 200, align: 99, wp: 'slamw', ap: 'slam' },
    whip: { wind: 0.42, act: 0.15, rec: 0.55, kind: 'melee', reach: 36, dmg: 10, min: 0, max: 40, wp: 'whipw', ap: 'whip' },
    dash: { wind: 0.28, act: 0.3, rec: 0.5, kind: 'charge', spd: 150, dmg: 10, kn: true, min: 30, max: 120, align: 8, wp: 'swind', ap: 'dash' },
    combo: { wind: 0.22, act: 0.1, rec: 0.12, kind: 'melee', reach: 20, dmg: 8, min: 0, max: 26, wp: 'swind', ap: 'slash', again: 'cmb2' },
    cmb2: { wind: 0.14, act: 0.1, rec: 0.12, kind: 'melee', reach: 20, dmg: 8, min: 0, max: 99, wp: 'swind', ap: 'slash', again: 'cmb3', follow: true },
    cmb3: { wind: 0.16, act: 0.12, rec: 0.5, kind: 'melee', reach: 22, dmg: 11, kn: true, min: 0, max: 99, wp: 'swind', ap: 'dash', follow: true }
  };

  var ATK = {
    p1: { n: 1, wind: 0.06, act: 0.09, rec: 0.2, dmg: 6, front: 15, back: 0, kn: false, step: 20 },
    p2: { n: 2, wind: 0.05, act: 0.09, rec: 0.22, dmg: 7, front: 15, back: 0, kn: false, step: 20 },
    p3: { n: 3, wind: 0.1, act: 0.11, rec: 0.36, dmg: 11, front: 17, back: 0, kn: true, step: 26 },
    pipe: { n: 0, wind: 0.12, act: 0.12, rec: 0.3, dmg: 14, front: 25, back: 3, kn: false, step: 14 }
  };

  /* --------------------------------------------------------------------- backdrops */
  function paintBuilding(g, x, top, bw, kind, i) {
    var cols = [['#7a3042', '#5a2232', '#a0485a'], ['#8a6a58', '#6a4e40', '#b08a74'], ['#34487a', '#243460', '#4e66a0']][kind];
    fr(g, x, top, bw, 98 - top, cols[0]); fr(g, x, top, bw, 3, cols[2]); fr(g, x, top + 3, bw, 1, cols[1]); fr(g, x + bw - 2, top, 2, 98 - top, cols[1]);
    var wy, wx;
    for (wy = top + 8; wy < 70; wy += 14) for (wx = x + 6; wx + 7 <= x + bw - 4; wx += 13) {
      var lit = hash(wx * 7 + wy * 3 + i) < 0.4;
      fr(g, wx - 1, wy - 1, 9, 11, cols[1]); fr(g, wx, wy, 7, 9, lit ? '#ffd070' : '#1c2848');
      if (lit) fr(g, wx, wy + 5, 7, 1, '#e0a040'); else fr(g, wx, wy, 2, 1, '#34406a');
    }
    fr(g, x, 76, bw, 22, '#15101f');
    fr(g, x + 5, 82, bw - 10, 12, hash(i * 3 + 1) < 0.5 ? '#294a6a' : '#6a3a58');
    fr(g, x + 5, 82, bw - 10, 1, 'rgba(255,255,255,0.35)');
    for (var sx = x + 3; sx < x + bw - 4; sx += 4) fr(g, sx, 75, 4, 6, ((sx - x) >> 2) % 2 ? '#f0f0f0' : (i % 2 ? '#e04a4a' : '#3ac0a0'));
    fr(g, x + 3, 81, bw - 6, 1, 'rgba(0,0,0,0.4)');
    var dx = x + Math.floor(bw / 2) - 4;
    fr(g, dx, 84, 8, 14, '#2a1a30'); fr(g, dx + 6, 90, 1, 2, '#ffd070');
    if (hash(i * 17 + 3) < 0.4) { fr(g, x + 6, top - 5, 10, 5, cols[1]); fr(g, x + 8, top - 8, 2, 3, cols[1]); }
  }

  function paintStreet(width) {
    var N = width + W, i, x, g, B = {};
    var sky = mkCanvas(W, 90), far = mkCanvas(272, 100), near = mkCanvas(N, H);
    g = sky.getContext('2d');
    gradBands(g, W, 0, 90, ['#170c3a', '#3c1860', '#8a2c70', '#e0583e', '#ffae52'], 4);
    for (i = 0; i < 26; i++) fr(g, Math.floor(hash(i * 3 + 1) * W), Math.floor(hash(i * 7 + 2) * 36), 1, 1, i % 3 ? '#cfc4ff' : '#ffffff');
    for (i = 0; i < 15; i++) { var hw = Math.floor(Math.sqrt(15 * 15 - i * i)); fr(g, 98 - hw, 74 - i, hw * 2, 1, i < 7 ? '#ffd890' : '#ffc070'); }
    g = far.getContext('2d'); x = 0; i = 0;
    while (x < 272) {
      var bw = 14 + Math.floor(hash(i * 5 + 3) * 4) * 6, bh = 36 + Math.floor(hash(i * 9 + 1) * 7) * 6;
      fr(g, x, 100 - bh, bw, bh, '#2c1450'); fr(g, x, 100 - bh, bw, 1, '#47236e');
      for (var wy = 100 - bh + 4; wy < 90; wy += 6) for (var wx = x + 2; wx < x + bw - 2; wx += 4) if (hash(wx * 7 + wy * 13) < 0.26) fr(g, wx, wy, 2, 3, '#ffcf6a');
      if (hash(i * 13) < 0.3) fr(g, x + (bw >> 1), 100 - bh - 6, 1, 6, '#2c1450');
      x += bw; i++;
    }
    g = near.getContext('2d');
    fr(g, 0, 56, N, 42, '#1a1226');
    x = -6; i = 0;
    while (x < N) {
      if (i > 0 && hash(i * 31 + 7) < 0.18) { fr(g, x + 3, 80, 5, 18, '#2a2438'); fr(g, x + 5, 60, 1, 38, '#3a3450'); x += 12; i++; continue; }
      var bw2 = 46 + Math.floor(hash(i * 3 + 1) * 4) * 8, top = 42 + Math.floor(hash(i * 7 + 2) * 4) * 5, kind = Math.floor(hash(i * 11 + 5) * 3);
      paintBuilding(g, x, top, bw2, kind, i);
      x += bw2; i++;
    }
    for (x = 40; x < N; x += 112) {
      fr(g, x, 62, 2, 38, '#2a2a3c'); fr(g, x - 4, 60, 10, 3, '#2a2a3c'); fr(g, x - 4, 63, 4, 2, '#ffe090');
      g.globalAlpha = 0.13; g.fillStyle = '#ffd070'; g.beginPath(); g.arc(x - 2, 66, 14, 0, 7); g.fill(); g.globalAlpha = 1;
    }
    fr(g, 0, 98, N, 10, '#7a7a96'); fr(g, 0, 98, N, 1, '#a0a0bc'); fr(g, 0, 106, N, 2, '#4a4a64'); fr(g, 0, 105, N, 1, '#b0b0c8');
    for (x = 0; x < N; x += 16) fr(g, x, 99, 1, 6, '#6a6a86');
    fr(g, 0, 108, N, H - 108, '#2b2a3a');
    for (i = 0; i < N * 2; i++) { var sx2 = Math.floor(hash(i * 3 + 11) * N), sy2 = 109 + Math.floor(hash(i * 7 + 5) * 54); fr(g, sx2, sy2, 1, 1, hash(i) < 0.5 ? '#35344a' : '#222030'); }
    for (x = 8; x < N; x += 40) fr(g, x, 135, 20, 2, '#d8b840');
    fr(g, 0, 110, N, 1, '#4a4960');
    for (i = 0; i < 6; i++) fr(g, 300 + i * 9, 109, 5, 55, 'rgba(210,210,230,0.75)');
    B.sky = sky; B.far = far; B.near = near; B.farF = 0.22;
    return B;
  }

  function paintDocks(width) {
    var N = width + W, i, x, g, B = {};
    var sky = mkCanvas(W, 100), far = mkCanvas(272, 100), near = mkCanvas(N, H);
    g = sky.getContext('2d');
    gradBands(g, W, 0, 70, ['#040a20', '#0b2048', '#1a4a76', '#3a84a0'], 4);
    gradBands(g, W, 66, 100, ['#2a7a98', '#1a5a7c', '#0e3a5c'], 3);
    for (i = 0; i < 30; i++) fr(g, Math.floor(hash(i * 3 + 1) * W), Math.floor(hash(i * 7 + 2) * 40), 1, 1, i % 4 ? '#b8d4ff' : '#ffffff');
    for (i = 0; i < 9; i++) { var hw = Math.floor(Math.sqrt(81 - i * i)); fr(g, 104 - hw, 44 - i, hw * 2, 1, '#eef4ff'); fr(g, 104 - hw, 44 + i, hw * 2, 1, '#e0eaf8'); }
    fr(g, 100, 40, 3, 3, '#c8d4ec'); fr(g, 106, 46, 2, 2, '#c8d4ec');
    g = far.getContext('2d');
    // harbour: cranes, ship, far shore
    fr(g, 0, 66, 272, 1, '#6ab4cc');
    for (x = 10; x < 272; x += 90) {
      fr(g, x, 34, 2, 32, '#0a1630'); fr(g, x + 14, 34, 2, 32, '#0a1630'); fr(g, x - 6, 32, 40, 3, '#0a1630'); fr(g, x + 24, 34, 3, 12, '#0a1630'); fr(g, x + 2, 40, 12, 1, '#0a1630'); fr(g, x + 4, 38, 8, 1, '#0a1630');
      fr(g, x + 33, 31, 2, 2, '#ff4a4a');
    }
    fr(g, 150, 56, 70, 10, '#0c1a34'); fr(g, 160, 48, 30, 8, '#0c1a34'); fr(g, 168, 42, 3, 6, '#0c1a34');
    for (i = 0; i < 9; i++) fr(g, 156 + i * 7, 60, 2, 2, '#ffd070');
    fr(g, 164, 51, 2, 2, '#ffd070'); fr(g, 172, 51, 2, 2, '#ffd070'); fr(g, 180, 51, 2, 2, '#ffd070');
    g.globalAlpha = 0.5; for (i = 0; i < 30; i++) fr(g, Math.floor(hash(i * 5 + 2) * 272), 70 + Math.floor(hash(i * 11 + 3) * 28), 6 + Math.floor(hash(i) * 8), 1, '#6ab4cc'); g.globalAlpha = 1;
    g = near.getContext('2d');
    x = 0; i = 0;
    while (x < N) {
      var kind = hash(i * 7 + 1) < 0.55 ? 0 : 1, span = kind ? 56 + Math.floor(hash(i * 3) * 3) * 12 : 96 + Math.floor(hash(i * 5) * 3) * 16;
      if (kind === 0) {
        // corrugated warehouse
        var wh = 40 + Math.floor(hash(i * 11) * 3) * 6, wc = hash(i * 13) < 0.5 ? ['#6a4a3a', '#54382c', '#8a6450'] : ['#3a5a6a', '#2a4452', '#5a8090'];
        fr(g, x, wh, span, 94 - wh, wc[0]); fr(g, x, wh, span, 3, wc[2]);
        for (var rx = x + 2; rx < x + span; rx += 4) fr(g, rx, wh + 3, 1, 91 - wh, wc[1]);
        fr(g, x + span - 3, wh, 3, 94 - wh, wc[1]);
        var dw = 30, dx = x + Math.floor((span - dw) / 2);
        fr(g, dx, 56, dw, 38, '#20181c'); fr(g, dx + 1, 57, dw - 2, 3, '#e8b020');
        for (var hs = 0; hs < dw - 2; hs += 6) fr(g, dx + 1 + hs, 57, 3, 3, '#1c1c24');
        fr(g, dx + dw / 2, 60, 1, 34, '#0e0a0c'); fr(g, dx - 1, 56, 1, 38, '#e8b020'); fr(g, dx + dw, 56, 1, 38, '#e8b020');
        fr(g, x + 6, wh + 8, 8, 6, '#ffd070'); fr(g, x + 6, wh + 8, 8, 1, '#8a6a30');
        fr(g, x + span - 18, wh + 8, 8, 6, '#ffd070');
      } else {
        // open quay with stacked containers
        var cc = ['#c03a2a', '#2a5ac0', '#d8a020', '#2a9a5a', '#8a3ac0'];
        for (var st = 0; st < 3; st++) {
          var cx0 = x + 6 + st * 18, hgt = 1 + Math.floor(hash(i * 17 + st * 5) * 3);
          for (var lv = 0; lv < hgt; lv++) {
            var col = cc[Math.floor(hash(i * 3 + st * 7 + lv * 13) * 5)];
            fr(g, cx0, 82 - lv * 11, 16, 11, col); fr(g, cx0, 82 - lv * 11, 16, 1, 'rgba(255,255,255,0.35)'); fr(g, cx0, 92 - lv * 11, 16, 1, 'rgba(0,0,0,0.35)');
            for (var rb = cx0 + 2; rb < cx0 + 15; rb += 3) fr(g, rb, 83 - lv * 11, 1, 9, 'rgba(0,0,0,0.25)');
          }
        }
        fr(g, x + span - 10, 56, 2, 38, '#1c1c24'); fr(g, x + span - 15, 54, 12, 3, '#1c1c24'); fr(g, x + span - 15, 57, 5, 2, '#ffe090');
        g.globalAlpha = 0.13; g.fillStyle = '#ffd070'; g.beginPath(); g.arc(x + span - 9, 60, 16, 0, 7); g.fill(); g.globalAlpha = 1;
      }
      x += span; i++;
    }
    fr(g, 0, 92, N, H - 92, '#7a5632');
    for (var py = 92; py < H; py += 7) { fr(g, 0, py, N, 1, '#4a3220'); fr(g, 0, py + 1, N, 1, '#8a6640'); }
    for (i = 0; i < N / 5; i++) { var bx = Math.floor(hash(i * 5 + 1) * N), by = 92 + 7 * Math.floor(hash(i * 3 + 2) * 10); fr(g, bx, by + 1, 1, 6, '#4a3220'); }
    for (i = 0; i < N * 1.2; i++) fr(g, Math.floor(hash(i * 7 + 3) * N), 93 + Math.floor(hash(i * 5 + 9) * 70), 1, 1, hash(i) < 0.5 ? '#6a4a2a' : '#8e6a42');
    fr(g, 0, 90, N, 4, '#3a2616'); fr(g, 0, 90, N, 1, '#6a4a2a');
    for (x = 30; x < N; x += 96) { fr(g, x, 80, 6, 12, '#2a2a36'); fr(g, x - 1, 79, 8, 2, '#4a4a5a'); fr(g, x + 1, 82, 1, 8, '#4a4a5a'); }
    B.sky = sky; B.far = far; B.near = near; B.farF = 0.22; B.moon = true;
    return B;
  }

  function paintRoof(width) {
    var N = width + W, i, x, g, B = {};
    var sky = mkCanvas(W, 100), far = mkCanvas(272, 100), mid = mkCanvas(272, 100), near = mkCanvas(N, H);
    g = sky.getContext('2d');
    gradBands(g, W, 0, 100, ['#0a0630', '#2a0f55', '#6a1a70', '#c83a7a', '#ff7a7a'], 4);
    for (i = 0; i < 34; i++) fr(g, Math.floor(hash(i * 3 + 1) * W), Math.floor(hash(i * 7 + 2) * 50), 1, 1, i % 4 ? '#d8c8ff' : '#ffffff');
    for (i = 0; i < 12; i++) { var hw = Math.floor(Math.sqrt(144 - i * i)); fr(g, 100 - hw, 52 - i, hw * 2, 1, '#fff4e0'); fr(g, 100 - hw, 52 + i, hw * 2, 1, '#f0e0d0'); }
    fr(g, 94, 48, 4, 3, '#e8d4c0'); fr(g, 104, 55, 3, 3, '#e8d4c0');
    g = far.getContext('2d'); x = 0; i = 0;
    while (x < 272) {
      var bw = 12 + Math.floor(hash(i * 5 + 3) * 4) * 5, bh = 40 + Math.floor(hash(i * 9 + 1) * 9) * 6;
      fr(g, x, 100 - bh, bw, bh, '#2a1048'); fr(g, x, 100 - bh, bw, 1, '#42206a');
      for (var wy = 100 - bh + 4; wy < 94; wy += 5) for (var wx = x + 2; wx < x + bw - 2; wx += 3) if (hash(wx * 7 + wy * 13) < 0.2) fr(g, wx, wy, 1, 2, hash(wx + wy) < 0.5 ? '#ff9ad0' : '#8ae8ff');
      if (hash(i * 13) < 0.4) fr(g, x + (bw >> 1), 100 - bh - 8, 1, 8, '#2a1048');
      x += bw; i++;
    }
    g = mid.getContext('2d'); x = 0; i = 0;
    while (x < 272) {
      var bw3 = 18 + Math.floor(hash(i * 7 + 5) * 4) * 6, bh3 = 22 + Math.floor(hash(i * 3 + 1) * 6) * 6;
      fr(g, x, 100 - bh3, bw3, bh3, '#1c0a38'); fr(g, x, 100 - bh3, bw3, 1, '#3a1a64');
      for (var wy2 = 100 - bh3 + 4; wy2 < 94; wy2 += 6) for (var wx2 = x + 3; wx2 < x + bw3 - 3; wx2 += 5) if (hash(wx2 * 5 + wy2 * 11) < 0.35) fr(g, wx2, wy2, 2, 3, ['#ffd070', '#ff6ab0', '#6ae0ff'][Math.floor(hash(wx2 + wy2 * 3) * 3)]);
      x += bw3; i++;
    }
    g = near.getContext('2d');
    fr(g, 0, 80, N, 18, '#4a3466'); fr(g, 0, 80, N, 3, '#7a5a9a'); fr(g, 0, 83, N, 1, '#2a1a44');
    for (x = 0; x < N; x += 12) { fr(g, x, 84, 1, 14, '#3a2858'); }
    for (var ry = 88; ry < 98; ry += 5) for (x = 0; x < N; x += 12) fr(g, x + (ry % 10 ? 6 : 0), ry, 6, 1, '#3a2858');
    var anim = [];
    for (x = 50, i = 0; x < N; x += 150 + Math.floor(hash(i * 3) * 4) * 12, i++) {
      var kind = i % 3;
      if (kind === 0) {           // water tank
        fr(g, x, 56, 2, 24, '#2a1a44'); fr(g, x + 20, 56, 2, 24, '#2a1a44'); fr(g, x + 4, 60, 2, 20, '#2a1a44'); fr(g, x + 16, 60, 2, 20, '#2a1a44');
        fr(g, x - 2, 38, 26, 20, '#6a5a8a'); fr(g, x - 2, 38, 26, 2, '#9a8ab8'); fr(g, x - 2, 44, 26, 1, '#4a3a68'); fr(g, x - 2, 52, 26, 1, '#4a3a68'); fr(g, x + 21, 38, 3, 20, '#4a3a68');
        fr(g, x + 9, 32, 4, 6, '#4a3a68');
      } else if (kind === 1) {    // neon sign board
        fr(g, x + 10, 62, 2, 18, '#2a1a44'); fr(g, x + 28, 62, 2, 18, '#2a1a44');
        fr(g, x, 44, 40, 20, '#15082a'); fr(g, x, 44, 40, 1, '#5a3a8a'); fr(g, x, 63, 40, 1, '#5a3a8a'); fr(g, x, 44, 1, 20, '#5a3a8a'); fr(g, x + 39, 44, 1, 20, '#5a3a8a');
        var nc = hash(i * 5) < 0.5 ? '#ff3d9a' : '#3de2ff';
        fr(g, x + 6, 50, 28, 2, nc); fr(g, x + 6, 56, 18, 2, nc); fr(g, x + 28, 54, 6, 6, nc); fr(g, x + 6, 50, 2, 8, nc);
        anim.push({ x: x + 2, y: 46, w: 36, h: 16, c: nc, ph: i });
      } else {                    // air-con block + vent pipes
        fr(g, x, 60, 34, 20, '#5a4a7a'); fr(g, x, 60, 34, 2, '#8a7aa8'); fr(g, x + 4, 64, 12, 12, '#2a1a44'); fr(g, x + 20, 64, 10, 12, '#2a1a44');
        for (var gy = 66; gy < 76; gy += 3) { fr(g, x + 5, gy, 10, 1, '#4a3a68'); fr(g, x + 21, gy, 8, 1, '#4a3a68'); }
        fr(g, x + 38, 50, 5, 30, '#6a5a8a'); fr(g, x + 37, 48, 7, 3, '#8a7aa8');
      }
    }
    fr(g, 0, 98, N, H - 98, '#2e2c48');
    for (var ty = 98; ty < H; ty += 14) fr(g, 0, ty, N, 1, '#42406a');
    for (x = 0; x < N; x += 28) fr(g, x, 99, 1, H - 99, '#3a3858');
    for (i = 0; i < N * 1.2; i++) fr(g, Math.floor(hash(i * 5 + 1) * N), 100 + Math.floor(hash(i * 9 + 4) * 64), 1, 1, hash(i) < 0.5 ? '#38365a' : '#26243e');
    for (x = 260; x < N; x += 380) {
      g.strokeStyle = '#e8c030'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, 140, 30, 12, 0, 0, 7); g.stroke();
      fr(g, x - 10, 134, 3, 12, '#e8c030'); fr(g, x + 7, 134, 3, 12, '#e8c030'); fr(g, x - 8, 139, 16, 3, '#e8c030');
    }
    for (x = 120; x < N; x += 210) { fr(g, x, 104, 10, 6, '#4a4870'); fr(g, x + 2, 102, 6, 2, '#6a68a0'); }
    B.sky = sky; B.far = far; B.mid = mid; B.near = near; B.farF = 0.16; B.midF = 0.4; B.anim = anim;
    return B;
  }
  function paintStage(i, width) { return [paintStreet, paintDocks, paintRoof][i](width); }

  /* -------------------------------------------------------------------- state */
  var stIdx, stage, camX, wi, wstate, queue, spawnT, waveClearT, introT, clearT, phase, fade, goT, clock, hs, lives;
  var p, en, items, props, projs, sparks, BG, target, targetT, chain, chainT, pendA, pendB;
  var goBeat = -1, needBanner, kos, pipeKos, bannerT, bannerTxt, bannerSub, deadT, rageFlash, crateS, bossAlive;

  function newPlayer(x, y) {
    return { x: x, y: y, z: 0, vx: 0, vz: 0, jvx: 0, jvy: 0, face: 1, st: 'idle', t: 0, hp: 100, maxhp: 100, inv: 0, ghost: 0, hw: 4, combo: 0, comboT: 0, atk: null, pend: false,
      weapon: 0, spinCd: 0, kick: false, kickHit: null, anim: 0, flash: 0, moving: false, hitDone: false, fdir: 1, pulse: 0 };
  }

  function loadStage(i) {
    stIdx = i; stage = STAGES[i]; camX = 0; wi = 0; wstate = 'go'; queue = []; spawnT = 0; waveClearT = 0; clearT = 0;
    en = []; items = []; projs = []; sparks = []; fade = 1; phase = 'play'; introT = 2.4; goT = 0; bossAlive = false;
    props = stage.props.map(function (d) { return { kind: d[2], x: d[0], y: d[1], hp: 3, drop: d[3], flash: 0, shake: 0 }; });
    stage.loose.forEach(function (d) { items.push({ kind: d[2], x: d[0], y: d[1], t: 0 }); });
    BG = paintStage(stage.theme, stage.width);
    crateS = stage.theme === 1 ? S.barrel : S['crate' + stage.theme];
    R.level = i + 1;
    p.x = 28; p.y = 132; p.z = 0; p.st = 'idle'; p.t = 0; p.vx = 0; p.vz = 0; p.atk = null; p.kick = false; p.inv = 1.2; p.ghost = 1.2; p.combo = 0;
    if (i > 0) p.hp = Math.min(p.maxhp, p.hp + 45);
    banner('STAGE ' + (i + 1), stage.name, 2.2);
  }

  function banner(txt, sub, t) { bannerTxt = txt; bannerSub = sub; bannerT = t; }
  function sc() { return Math.round(camX); }
  function fxBurst(x, y, o) { R.fx.burst(x - sc(), y, o); }
  function fxText(x, y, s, col) { R.fx.text(x - sc(), y, s, col); }
  function spark(x, y, big) { sparks.push({ x: x, y: y, t: 0, big: !!big }); }
  function dust(x, y, n) { fxBurst(x, y - 1, { n: n || 5, color: ['#c8c0d0', '#9a92a8'], speed: 24, life: 0.3, size: 2, gravity: -8 }); }

  /* --------------------------------------------------------------------- combat */
  function inReach(a, e, front, back, depth, zTol) {
    var d = (e.x - a.x) * a.face;
    return d >= -back - e.hw && d <= front + e.hw && Math.abs(e.y - a.y) <= depth && Math.abs((e.z || 0) - (a.z || 0)) <= zTol;
  }

  function aliveCount() { var n = 0; for (var i = 0; i < en.length; i++) if (en[i].hp > 0) n++; return n; }
  function attackers() { var n = 0; for (var i = 0; i < en.length; i++) if (en[i].hp > 0 && (en[i].st === 'wind' || en[i].st === 'act')) n++; return n; }

  function spawnItem(kind, x, y) { items.push({ kind: kind, x: x, y: U.clamp(y, Y0, Y1), t: 0 }); }

  function dropFrom(e) {
    var r = Math.random(), low = p.hp < 45;
    if (e.T.boss) { spawnItem('cash', e.x - 10, e.y); spawnItem('cash', e.x + 10, e.y + 3); spawnItem('meat', e.x, e.y - 3); return; }
    if (r < (low ? 0.32 : 0.14)) spawnItem(Math.random() < 0.3 ? 'meat' : 'apple', e.x, e.y);
    else if (r < (low ? 0.4 : 0.28)) spawnItem('cash', e.x, e.y);
    else if (r < 0.37 && !p.weapon) { var has = false; for (var i = 0; i < items.length; i++) if (items[i].kind === 'pipe') has = true; if (!has) spawnItem('pipe', e.x, e.y); }
  }

  function killEnemy(e, dir) {
    var T = e.T;
    e.hp = 0;
    R.addScore(T.score + Math.min(chain, 10) * 10); kos++;
    fxText(e.x, e.y - 30 - e.z, '+' + T.score, C.yellow);
    if (e.lastSrc === 'pipe') { pipeKos++; if (pipeKos >= 3) R.achieve('pipe-dreams'); }
    if (kos >= 10) R.achieve('rookie-rumble');
    if (T.boss) {
      R.achieve('boss-buster'); hs = 0.4; R.fx.flash('#ffffff', 0.25); R.fx.shake(4, 0.5); R.sfx.play('explode'); R.vibrate(120);
      fxBurst(e.x, e.y - 12, { n: 30, color: ['#ffec27', '#ff8a1e', '#ffffff', '#ff3d5e'], speed: 110, life: 0.8, size: 2, gravity: 80 });
    } else { R.sfx.play('explode'); R.vibrate(25); }
    knockDown(e, dir);
  }

  function knockDown(e, dir) {
    e.st = 'fly'; e.t = 0; e.vx = dir * (e.hp <= 0 ? 80 : 62); e.vz = 98; e.z = 0.5; e.fdir = dir; e.mv = null;
  }

  function hurtEnemy(e, dmg, kn, tag) {
    var T = e.T, dir = e.x >= p.x ? 1 : -1;
    e.hp -= dmg; e.flash = 0.1; e.lastSrc = tag;
    target = e; targetT = 3.4;
    chain++; chainT = 1.4;
    R.addScore(10 + Math.min(chain, 8) * 2);
    spark(e.x - dir * 3, e.y - 15 - e.z, kn || e.hp <= 0);
    fxBurst(e.x - dir * 2, e.y - 15 - e.z, { n: 6, color: ['#ffffff', '#ffe14a', '#ff8a1e'], speed: 70, life: 0.25, size: 2 });
    R.sfx.play(tag === 'kick' || kn ? 'drop' : 'hit'); R.vibrate(kn ? 28 : 12);
    hs = kn ? 0.08 : 0.045;
    if (e.hp <= 0) { killEnemy(e, dir); return true; }
    if (T.poise) {
      e.poise -= dmg;
      if (e.poise <= 0) { kn = true; e.poise = T.poise; }
    }
    if (kn) { knockDown(e, dir); R.fx.shake(2, 0.15); }
    else if (!T.poise || e.st === 'idle' || e.st === 'rec' || e.st === 'enter') {
      e.st = 'hurt'; e.t = 0; e.vx = dir * 38; e.mv = null; e.stun = T.poise ? 0.14 : 0.32;
    } else e.x += dir * 1.5;
    return true;
  }

  function hurtProp(o, dir) {
    o.hp--; o.flash = 0.1; o.shake = 0.15;
    R.sfx.play('hit'); R.vibrate(10); spark(o.x, o.y - 8, false); hs = 0.03;
    if (o.hp <= 0) {
      o.dead = true; R.sfx.play('explode'); R.addScore(50); R.fx.shake(1.5, 0.1);
      fxBurst(o.x, o.y - 6, { n: 14, color: o.kind === 'barrel' ? ['#c8402a', '#7a1f14', '#c8ccd8'] : ['#b07a3a', '#7a4e22', '#d8a45a'], speed: 80, life: 0.5, size: 2, gravity: 160 });
      if (o.drop) spawnItem(o.drop, o.x, o.y + 4);
    }
  }

  function strike(front, back, dmg, kn, tag, zTol) {
    var n = 0, i, e;
    for (i = 0; i < en.length; i++) {
      e = en[i];
      if (e.hp <= 0 || e.st === 'down' || e.st === 'getup' || e.st === 'dead' || e.st === 'fly') continue;
      if (!inReach(p, e, front, back, 8, zTol)) continue;
      if (hurtEnemy(e, dmg, kn, tag)) n++;
    }
    for (i = 0; i < props.length; i++) {
      var o = props[i];
      if (o.dead) continue;
      if (Math.abs(o.y - p.y) <= 9 && ((o.x - p.x) * p.face) >= -back - 7 && ((o.x - p.x) * p.face) <= front + 7 && p.z < 12) { hurtProp(o); n++; }
    }
    return n;
  }

  function hurtPlayer(dmg, dir, kn, src) {
    if (p.inv > 0 || p.hp <= 0 || p.st === 'down' || p.st === 'fly' || p.st === 'dead' || p.st === 'getup') return false;
    p.hp = Math.max(0, p.hp - Math.round(dmg)); p.flash = 0.12; chain = 0; chainT = 0;
    spark(p.x - dir * 3, p.y - 15 - p.z, kn || p.hp <= 0);
    fxBurst(p.x, p.y - 15 - p.z, { n: 8, color: ['#ff3d5e', '#ffffff', '#ff8a1e'], speed: 70, life: 0.3, size: 2 });
    R.sfx.play('hit'); R.vibrate(kn ? 70 : 40); hs = 0.08; R.fx.shake(2, 0.15);
    if (src) { target = src; targetT = 3.4; }
    if (p.weapon && (kn || p.hp <= 0)) { spawnItem('pipe', p.x + dir * 8, p.y); p.weapon = 0; }
    p.combo = 0; p.atk = null; p.kick = false; p.pend = false; p.t = 0;
    if (p.hp <= 0 || kn) { p.st = 'fly'; p.vx = dir * 66; p.vz = 95; p.z = 0.5; p.fdir = dir; }
    else { p.st = 'hurt'; p.vx = dir * 30; }
    p.inv = 0.5;
    return true;
  }

  function startSpin() {
    if (p.spinCd > 0 || p.hp <= SPIN_COST + 4 || p.z > 0) return false;
    p.hp -= SPIN_COST; p.spinCd = SPIN_CD; p.st = 'spin'; p.t = 0; p.pulse = 0; p.atk = null; p.kick = false; p.combo = 0; p.vz = 0;
    p.inv = Math.max(p.inv, 0.6);
    R.sfx.play('powerup'); R.vibrate(25); fxText(p.x, p.y - 34, 'SPIN!', '#ff8a1e');
    fxBurst(p.x, p.y - 10, { n: 10, color: ['#ff8a1e', '#ffec27'], speed: 80, life: 0.4, size: 2 });
    return true;
  }
  function startPunch() {
    var A;
    if (p.weapon > 0) {
      A = ATK.pipe; p.weapon--;
      if (p.weapon <= 0) { R.sfx.play('explode'); fxText(p.x, p.y - 30, 'BROKE!', C.silver); }
    } else {
      var n = (p.comboT > 0 && p.combo > 0 && p.combo < 3) ? p.combo + 1 : 1;
      A = ATK['p' + n]; p.combo = n;
    }
    p.atk = A; p.st = 'atk'; p.t = 0; p.hitDone = false; p.pend = false;
    R.sfx.tone(A.n === 3 ? 220 : 340, 0.07, { type: 'triangle', vol: 0.08, slide: 600 });
  }
  function startJump() {
    var inp = R.input;
    p.st = 'jump'; p.t = 0; p.vz = 146; p.z = 0.5; p.kick = false; p.kickHit = [];
    p.jvx = inp.axisX() * WALK_X * 0.9; p.jvy = inp.axisY() * WALK_Y * 0.7;
    R.sfx.play('jump'); dust(p.x, p.y, 4);
  }

  function updatePlayer(dt) {
    var inp = R.input, ax = inp.axisX(), ay = inp.axisY(), a = pendA, b = pendB, i;
    pendA = pendB = false;
    p.t += dt; p.anim += dt;
    if (p.inv > 0) p.inv -= dt;
    if (p.ghost > 0) p.ghost -= dt;
    if (p.flash > 0) p.flash -= dt;
    if (p.spinCd > 0) p.spinCd -= dt;
    if (p.comboT > 0 && p.st !== 'atk') { p.comboT -= dt; if (p.comboT <= 0) p.combo = 0; }
    var minX = camX + 11, maxX = (wstate === 'fight' ? camX + W - 10 : limitX() + W - 10);
    switch (p.st) {
      case 'idle':
        p.moving = ax !== 0 || ay !== 0;
        if (ax) p.face = ax;
        var spd = (ax && ay) ? 0.8 : 1;
        p.x += ax * WALK_X * spd * dt; p.y += ay * WALK_Y * spd * dt;
        if ((a && inp.held.b) || (b && inp.held.a)) { if (startSpin()) break; }
        if (a) startPunch(); else if (b) startJump();
        break;
      case 'atk': {
        var A = p.atk, end = A.wind + A.act + A.rec;
        if (p.t < A.wind + A.act) p.x += p.face * A.step * dt;
        if (!p.hitDone && p.t >= A.wind) {
          p.hitDone = true;
          var n = strike(A.front, A.back, A.dmg, A.kn, A.n ? 'punch' : 'pipe', 14);
          if (!n) R.sfx.tone(180, 0.05, { type: 'triangle', vol: 0.05, slide: 90 });
        }
        if (b && inp.held.a && A.n === 1 && p.t < 0.14 && startSpin()) break;
        if (a && A.n > 0) p.pend = true;
        if (p.pend && A.n > 0 && A.n < 3 && p.t >= A.wind + A.act + A.rec * 0.3) { p.comboT = 0.6; startPunch(); break; }
        if (p.t >= end) { p.st = 'idle'; p.comboT = A.n ? 0.4 : 0; p.t = 0; if (A.n === 3) p.combo = 0; }
        break; }
      case 'jump': {
        p.x += p.jvx * dt; p.y += p.jvy * dt;
        p.z += p.vz * dt; p.vz -= GRAV * dt;
        if (a && inp.held.b && p.t < 0.12 && p.z < 8 && startSpin()) { p.z = 0; break; }
        if ((a || b) && !p.kick) { p.kick = true; p.jvx = p.face * 58; p.vz = Math.max(p.vz, -10); p.kickHit = []; R.sfx.tone(300, 0.12, { type: 'sawtooth', vol: 0.07, slide: 120 }); }
        if (p.kick) {
          for (i = 0; i < en.length; i++) {
            var e = en[i];
            if (e.hp <= 0 || e.st === 'down' || e.st === 'getup' || e.st === 'dead' || e.st === 'fly' || p.kickHit.indexOf(e) >= 0) continue;
            if (inReach(p, e, 13, 0, 8, 28)) { p.kickHit.push(e); hurtEnemy(e, 10, true, 'kick'); }
          }
          for (i = 0; i < props.length; i++) {
            var o = props[i];
            if (!o.dead && p.kickHit.indexOf(o) < 0 && Math.abs(o.y - p.y) <= 9 && (o.x - p.x) * p.face > -2 && (o.x - p.x) * p.face < 20 && p.z < 22) { p.kickHit.push(o); hurtProp(o); }
          }
        }
        if (p.z <= 0) { p.z = 0; p.st = 'land'; p.t = 0; p.kick = false; R.sfx.play('land'); dust(p.x, p.y, 6); }
        break; }
      case 'land':
        if (p.t > 0.09) { p.st = 'idle'; p.t = 0; }
        break;
      case 'spin':
        p.inv = Math.max(p.inv, 0.1);
        p.x += ax * WALK_X * 0.5 * dt; p.y += ay * WALK_Y * 0.5 * dt;
        if (p.t >= 0.06 + p.pulse * 0.15 && p.pulse < 3) {
          p.pulse++;
          var nn = strike(24, 24, p.pulse === 3 ? 8 : 5, p.pulse === 3, 'spin', 16);
          R.sfx.tone(260 + p.pulse * 90, 0.1, { type: 'sawtooth', vol: 0.07, slide: 520 });
          fxBurst(p.x, p.y - 8, { n: 5, color: ['#ffffff', '#ffec27'], speed: 70, life: 0.25, size: 2 }); void nn;
        }
        if (p.t >= 0.55) { p.st = 'idle'; p.t = 0; }
        break;
      case 'hurt':
        p.x += p.vx * dt; p.vx *= Math.pow(0.02, dt);
        if (p.t >= 0.32) { p.st = 'idle'; p.t = 0; }
        break;
      case 'fly':
        p.x += p.vx * dt; p.z += p.vz * dt; p.vz -= GRAV * dt;
        if (p.z <= 0) {
          p.z = 0; p.vx = 0; p.t = 0; R.sfx.play('land'); dust(p.x, p.y, 8); R.fx.shake(2, 0.2);
          if (p.hp <= 0) { p.st = 'dead'; lives--; R.lives = Math.max(0, lives); deadT = 0; R.sfx.play('lose'); }
          else p.st = 'down';
        }
        break;
      case 'down':
        if (p.t >= 0.65) { p.st = 'getup'; p.t = 0; }
        break;
      case 'getup':
        if (p.t >= 0.3) { p.st = 'idle'; p.t = 0; p.inv = Math.max(p.inv, 1.0); p.ghost = 1.0; }
        break;
      case 'dead':
        deadT += dt;
        if (deadT > 1.5) {
          if (lives > 0) {
            var sx0 = p; p = newPlayer(camX + 26, 132); p.hp = p.maxhp; p.st = 'getup'; p.inv = 2.6; p.ghost = 2.6; p.spinCd = 0; void sx0;
            R.sfx.play('powerup');
          } else R.gameOver();
        }
        break;
    }
    if (p.st !== 'dead') {
      p.x = U.clamp(p.x, minX, maxX); p.y = U.clamp(p.y, Y0, Y1);
    }
    // pickups
    if (p.st !== 'dead' && p.st !== 'down' && p.st !== 'fly') {
      for (i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        if (Math.abs(it.x - p.x) < 9 && Math.abs(it.y - p.y) < 8 && p.z < 6) {
          if (it.kind === 'apple' || it.kind === 'meat') {
            if (p.hp >= p.maxhp) continue;
            var heal = it.kind === 'meat' ? 50 : 22;
            p.hp = Math.min(p.maxhp, p.hp + heal); R.addScore(50); R.sfx.play('powerup'); R.vibrate(15);
            fxText(p.x, p.y - 32, '+' + heal + 'HP', '#3ddc5a');
            fxBurst(p.x, p.y - 14, { n: 8, color: ['#3ddc5a', '#ffffff'], speed: 40, life: 0.4, size: 2, gravity: -20 });
          } else if (it.kind === 'cash') {
            var val = 300 + 200 * stIdx; R.addScore(val); R.sfx.play('coin'); R.vibrate(8); fxText(p.x, p.y - 32, '$' + val, C.yellow);
            fxBurst(it.x, it.y - 6, { n: 8, color: ['#ffe14a', '#ffffff', '#3dc84a'], speed: 50, life: 0.4, size: 2 });
          } else if (it.kind === 'pipe') {
            if (p.weapon) continue;
            p.weapon = 10; R.sfx.play('select'); R.vibrate(10); fxText(p.x, p.y - 32, 'PIPE!', C.silver);
          }
          items.splice(i, 1);
        }
      }
    }
    if (p.st !== 'dead' && p.st !== 'fly' && p.st !== 'down' && p.hp <= 0) p.hp = 1;
  }

  /* ----------------------------------------------------------------------- enemies */
  function spawnEnemy(type, side) {
    var T = TYPES[type], m = stIdx;
    var e = {
      type: type, T: T, set: SETS[T.set][Math.min(m, SETS[T.set].length - 1)], x: side === 'L' ? camX - 16 : camX + W + 16, y: rr(Y0 + 6, Y1 - 6), z: 0, vx: 0, vz: 0,
      face: side === 'L' ? 1 : -1, hp: Math.round(T.hp * (1 + 0.16 * m)), st: 'enter', t: 0, anim: Math.random() * 3, flash: 0, atkCd: rr(0.6, 1.3), pause: 0,
      mv: null, acted: false, offY: U.pick([-7, 0, 7]), kj: rr(-3, 3), spm: 1 + 0.07 * m, dm: 1 + 0.12 * m, wm: 1 - 0.07 * m, rm: 1 - 0.05 * m,
      poise: T.poise || 0, hw: T.hw, fdir: 1, stun: 0.3, moving: false, hitP: false, lastSrc: '', enraged: false, name: T.name
    };
    if (T.boss) { e.y = 132; bossAlive = true; e.hp = Math.round(e.hp * 1.0); }
    e.maxhp = e.hp;
    en.push(e);
    return e;
  }

  function limitX() { var wv = stage.waves[wi]; return wv ? wv.at : stage.width - W; }

  function pickMove(e, adx, ady) {
    var opts = [], T = e.T;
    for (var i = 0; i < T.moves.length; i++) {
      var m = MOVES[T.moves[i]];
      if (adx >= m.min && adx <= m.max && ady <= (m.align || 7)) opts.push(T.moves[i]);
    }
    return opts.length ? U.pick(opts) : null;
  }

  function beginMove(e, name, wscale) {
    var m = MOVES[name];
    e.mv = m; e.mvName = name; e.st = 'wind'; e.t = 0; e.acted = false; e.hitP = false;
    e.windT = m.wind * e.wm * (wscale || 1);
    if (m.follow) e.face = p.x >= e.x ? 1 : -1;
    if (m.kind === 'wave' || m.kind === 'charge') R.sfx.tone(120, 0.25, { type: 'sawtooth', vol: 0.06, slide: 220 });
  }

  function aiIdle(e, dt) {
    var T = e.T, dx = p.x - e.x, adx = Math.abs(dx), dy = p.y - e.y - e.offY, ady = Math.abs(p.y - e.y);
    var live = p.st !== 'dead' && p.hp > 0;
    e.face = dx >= 0 ? 1 : -1;
    e.atkCd -= dt;
    var moving = false;
    if (e.pause > 0) e.pause -= dt;
    else {
      var keep = T.keep + e.kj;
      if (adx > keep + 4) { e.x += e.face * T.sp * e.spm * dt; moving = true; }
      else if (adx < keep - 9 && T.retreat) { e.x -= e.face * T.sp * 0.7 * dt; moving = true; }
      if (Math.abs(dy) > 2.5) { e.y += sgn(dy) * T.sp * 0.75 * e.spm * dt; moving = true; }
      if (!moving && Math.random() < dt * 0.9) e.pause = rr(0.2, 0.5);
    }
    e.moving = moving;
    if (e.atkCd <= 0 && live && attackers() < stage.caps + (T.boss ? 1 : 0)) {
      var mv = pickMove(e, adx, ady);
      if (mv) beginMove(e, mv, 1);
    }
  }

  function doMoveStart(e, m) {
    var dir = e.face;
    if (m.kind === 'melee') {
      R.sfx.tone(260, 0.07, { type: 'triangle', vol: 0.06, slide: 120 });
      if (inReach(e, p, m.reach, 0, 9, 16)) hurtPlayer(m.dmg * e.dm, dir, m.kn, e);
    } else if (m.kind === 'proj') {
      R.sfx.play('shoot');
      for (var i = 0; i < m.n; i++) {
        var off = m.n === 1 ? 0 : (i - 1);
        projs.push({ kind: 'knife', x: e.x + dir * 10, y: e.y, z: 9, vx: dir * 118, vy: off * 11, dmg: m.dmg * e.dm, life: 2.2, src: e });
      }
    } else if (m.kind === 'wave') {
      R.sfx.play('explode'); R.fx.shake(3, 0.3); R.vibrate(40);
      dust(e.x, e.y, 10);
      projs.push({ kind: 'wave', x: e.x + 10, y: e.y, z: 0, vx: 92, vy: 0, dmg: m.dmg * e.dm, life: 1.5, src: e });
      projs.push({ kind: 'wave', x: e.x - 10, y: e.y, z: 0, vx: -92, vy: 0, dmg: m.dmg * e.dm, life: 1.5, src: e });
    } else if (m.kind === 'charge') {
      R.sfx.play('rotate');
    }
  }

  function updateEnemy(e, dt) {
    var T = e.T, m;
    e.t += dt; e.anim += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.hp > 0 && T.boss && !e.enraged && e.hp < e.maxhp * 0.45) {
      e.enraged = true; e.spm *= 1.25; e.wm *= 0.8; e.rm *= 0.8; rageFlash = 0.6;
      fxText(e.x, e.y - 40, 'ENRAGED!', '#ff3d5e'); R.sfx.play('lose'); R.fx.flash('#ff3d5e', 0.2);
    }
    switch (e.st) {
      case 'enter':
        e.x += e.face * T.sp * 1.5 * dt; e.moving = true;
        if (e.x > camX + 14 && e.x < camX + W - 14) { e.st = 'idle'; e.t = 0; e.atkCd = rr(0.5, 1.1); }
        else if (e.t > 6) { e.x = U.clamp(e.x, camX + 14, camX + W - 14); e.st = 'idle'; }
        break;
      case 'idle': aiIdle(e, dt); break;
      case 'wind':
        e.moving = false;
        if (e.mv.follow) e.x += e.face * 12 * dt;
        if (e.t >= e.windT) { e.st = 'act'; e.t = 0; e.acted = false; }
        break;
      case 'act':
        m = e.mv;
        if (!e.acted) { e.acted = true; doMoveStart(e, m); }
        if (m.kind === 'charge') {
          e.x += e.face * m.spd * dt;
          if (!e.hitP && inReach(e, p, 6, 4, 9, 16)) { e.hitP = true; hurtPlayer(m.dmg * e.dm, e.face, m.kn, e); }
          if (e.x < camX + 6 || e.x > camX + W - 6) { e.x = U.clamp(e.x, camX + 6, camX + W - 6); e.t = m.act; }
        }
        if (e.t >= m.act) { e.st = 'rec'; e.t = 0; }
        break;
      case 'rec':
        m = e.mv;
        if (e.t >= m.rec * e.rm) {
          if (m.again) beginMove(e, m.again, 1);
          else { e.st = 'idle'; e.t = 0; e.atkCd = rr(T.cd[0], T.cd[1]) * (e.enraged ? 0.7 : 1); }
        }
        break;
      case 'hurt':
        e.x += e.vx * dt; e.vx *= Math.pow(0.02, dt);
        if (e.t >= e.stun) { e.st = 'idle'; e.t = 0; e.atkCd = Math.max(e.atkCd, rr(0.2, 0.6)); }
        break;
      case 'fly':
        e.x += e.vx * dt; e.z += e.vz * dt; e.vz -= GRAV * dt;
        if (e.z <= 0) {
          e.z = 0; e.vx = 0; e.t = 0; R.sfx.play('land'); dust(e.x, e.y, 6);
          if (T.boss || T.poise) R.fx.shake(2, 0.15);
          if (e.hp <= 0) { e.st = 'dead'; dropFrom(e); } else e.st = 'down';
        }
        break;
      case 'down':
        if (e.t >= 0.8) { e.st = 'getup'; e.t = 0; }
        break;
      case 'getup':
        if (e.t >= 0.35) { e.st = 'idle'; e.t = 0; e.atkCd = rr(0.3, 0.9); }
        break;
      case 'dead':
        break;
    }
    if (e.st !== 'fly' && e.st !== 'dead') {
      e.y = U.clamp(e.y, Y0, Y1);
      if (e.st !== 'enter') e.x = U.clamp(e.x, camX + 6, camX + W - 6);
    }
  }

  function updateProjs(dt) {
    for (var i = projs.length - 1; i >= 0; i--) {
      var q = projs[i];
      q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      var hit = false;
      if (q.kind === 'knife') hit = Math.abs(q.x - p.x) < 6 && Math.abs(q.y - p.y) < 5 && p.z < 11;
      else hit = Math.abs(q.x - p.x) < 7 && Math.abs(q.y - p.y) < 9 && p.z < 7;
      if (hit && hurtPlayer(q.dmg, sgn(q.vx), q.kind === 'wave', q.src)) {
        if (q.kind === 'knife') { projs.splice(i, 1); continue; }
      }
      if (q.life <= 0 || q.x < camX - 20 || q.x > camX + W + 20) projs.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------------ stage flow */
  function startWave() {
    var wv = stage.waves[wi];
    wstate = 'fight'; queue = wv.sp.map(function (s) { return s.slice(); }); spawnT = 0; waveClearT = 0;
    if (wv.boss) {
      var bn = TYPES[wv.sp[0][1]].name;
      banner('WARNING!', bn, 2.4); R.sfx.play('lose'); R.fx.flash('#ff3d5e', 0.2);
    }
  }
  function clearWave() {
    var wv = stage.waves[wi];
    wi++;
    if (wi >= stage.waves.length) {
      wstate = 'done'; phase = 'clear'; clearT = 0; bossAlive = false;
      var bonus = 1000 * (stIdx + 1) + Math.round(p.hp) * 10;
      R.addScore(bonus); R.sfx.play('win'); R.vibrate(60);
      banner('STAGE CLEAR', '+' + bonus, 3.4);
      if (stIdx === 2) { R.achieve('city-hero'); }
    } else {
      wstate = 'go'; goT = 0; goBeat = -1; R.sfx.play('select');
    }
    void wv;
  }
  function updateWaves(dt) {
    if (introT > 0) { introT -= dt; return; }
    var wv = stage.waves[wi];
    if (wstate === 'go') {
      goT += dt;
      if (wi > 0 && camX < limitX() - 4 && Math.floor(goT * 1.5) !== goBeat) { goBeat = Math.floor(goT * 1.5); R.sfx.tone(988, 0.07, { vol: 0.07 }); }
      if (wv && camX >= wv.at - 0.5) startWave();
    } else if (wstate === 'fight') {
      spawnT += dt;
      while (queue.length && queue[0][0] <= spawnT && aliveCount() < stage.maxOn + (wv.boss ? 1 : 0)) { var q = queue.shift(); spawnEnemy(q[1], q[2]); }
      if (!queue.length && aliveCount() === 0) {
        waveClearT += dt;
        if (waveClearT > (wv.boss ? 1.6 : 0.5)) clearWave();
      } else waveClearT = 0;
    }
  }
  function updateCamera(dt) {
    var lim = limitX(), tg = Math.min(lim, Math.max(camX, p.x - 62));
    if (wstate === 'fight') tg = lim;
    if (tg > camX) camX = Math.min(tg, camX + 100 * dt);
    camX = Math.min(camX, stage.width - W);
  }

  /* ------------------------------------------------------------------------ game */
  R.game({
    layout: 'full', size: [W, H], bg: '#170c3a', music: 'action',

    _dbg: function () { return { p: p, en: en, items: items, props: props, stage: stage, wi: wi, wstate: wstate, camX: camX, phase: phase, lives: lives, queue: queue, SETS: SETS, S: S, setStage: function (i) { loadStage(i); }, goto: function (s, w) { loadStage(s); wi = w; camX = stage.waves[w].at; introT = 0; bannerT = 0; p.x = camX + 30; p.inv = 0; p.ghost = 0; }, spawn: spawnEnemy, hurtP: hurtPlayer, kos: kos, TYPES: TYPES }; }, /*DBG*/

    init: function () { buildAll(); S.crate0 = crateSprite(0); S.crate1 = crateSprite(1); S.crate2 = crateSprite(2); S.barrel = barrelSprite(); },

    reset: function () {
      lives = 3; R.lives = 3; R.score = 0; kos = 0; pipeKos = 0; clock = 0; hs = 0; pendA = pendB = false; target = null; targetT = 0; chain = 0; chainT = 0;
      rageFlash = 0; deadT = 0; bannerT = 0; needBanner = true;
      p = newPlayer(28, 132);
      loadStage(0);
      fade = 0; bannerT = 0;
    },

    onPress: function (b) { if (b === 'a') pendA = true; else if (b === 'b') pendB = true; },

    update: function (dt) {
      clock += dt;
      if (needBanner) { needBanner = false; banner('STAGE ' + (stIdx + 1), stage.name, 2.2); }
      if (fade > 0 && phase !== 'clear' && phase !== 'win') fade = Math.max(0, fade - dt * 1.8);
      if (bannerT > 0) bannerT -= dt;
      if (rageFlash > 0) rageFlash -= dt;
      if (hs > 0) { hs -= dt; return; }
      var i;
      if (targetT > 0) { targetT -= dt; if (targetT <= 0) target = null; }
      if (chainT > 0) { chainT -= dt; if (chainT <= 0) chain = 0; }
      for (i = sparks.length - 1; i >= 0; i--) { sparks[i].t += dt; if (sparks[i].t > 0.16) sparks.splice(i, 1); }
      for (i = 0; i < props.length; i++) { if (props[i].flash > 0) props[i].flash -= dt; if (props[i].shake > 0) props[i].shake -= dt; }
      if (phase === 'win') {
        clearT += dt; p.anim += dt;
        if (Math.random() < 0.25) fxBurst(camX + rr(10, W - 10), rr(40, 100), { n: 14, color: ['#ffec27', '#ff3d5e', '#3de2ff', '#7cff6a', '#ffffff'], speed: 70, life: 0.7, gravity: 60, size: 2 });
        if (clearT > 3.6) R.gameOver({ win: true });
        return;
      }
      updatePlayer(dt);
      for (i = 0; i < en.length; i++) updateEnemy(en[i], dt);
      // separation
      for (i = 0; i < en.length; i++) for (var j = i + 1; j < en.length; j++) {
        var a = en[i], b = en[j];
        if (a.hp <= 0 || b.hp <= 0 || a.st === 'fly' || b.st === 'fly' || a.st === 'down' || b.st === 'down') continue;
        var ddx = a.x - b.x, ddy = a.y - b.y;
        if (Math.abs(ddx) < 9 && Math.abs(ddy) < 4) { var pu = (9 - Math.abs(ddx)) * 0.5 * (ddx >= 0 ? 1 : -1); a.x += pu * 0.3; b.x -= pu * 0.3; a.y += ddy >= 0 ? 0.3 : -0.3; b.y -= ddy >= 0 ? 0.3 : -0.3; }
      }
      for (i = en.length - 1; i >= 0; i--) {
        var e = en[i];
        if (e.st === 'dead' && e.t > 1.3) en.splice(i, 1);
      }
      updateProjs(dt);
      for (i = props.length - 1; i >= 0; i--) if (props[i].dead) props.splice(i, 1);
      for (i = items.length - 1; i >= 0; i--) { items[i].t += dt; if (items[i].x < camX - 40) items.splice(i, 1); }
      updateWaves(dt);
      updateCamera(dt);
      if (phase === 'clear') {
        clearT += dt;
        if (clearT > 2.8) fade = Math.min(1, (clearT - 2.8) / 0.5);
        if (clearT > 3.4) {
          if (stIdx < STAGES.length - 1) { loadStage(stIdx + 1); }
          else { phase = 'win'; clearT = 0; fade = 0; banner('CITY SAVED!', 'THANKS, HERO', 3.6); p.st = 'idle'; R.sfx.play('win'); }
        }
      }
    },

    render: function (ctx, w, h) {
      var cx = sc(), i;
      drawBackdrop(ctx, cx);
      var list = [];
      for (i = 0; i < props.length; i++) list.push({ y: props[i].y, o: props[i], k: 'prop' });
      for (i = 0; i < items.length; i++) list.push({ y: items[i].y - 0.5, o: items[i], k: 'item' });
      for (i = 0; i < en.length; i++) list.push({ y: en[i].st === 'dead' || en[i].st === 'down' ? en[i].y - 1 : en[i].y, o: en[i], k: 'en' });
      list.push({ y: p.st === 'down' || p.st === 'dead' ? p.y - 1 : p.y, o: p, k: 'p' });
      list.sort(function (a, b) { return a.y - b.y; });
      // shadows
      for (i = 0; i < list.length; i++) {
        var o = list[i].o, k = list[i].k;
        if (k === 'item' && o.kind === 'pipe') continue;
        if (k === 'en' && o.st === 'dead' && o.t > 0.9 && Math.floor(o.t * 20) % 2) continue;
        var sw = k === 'p' ? 12 : k === 'en' ? o.T.sh : k === 'prop' ? 14 : 8, zz = k === 'item' ? 0 : (o.z || 0);
        shadow(ctx, o.x - cx, o.y, Math.max(4, sw - zz * 0.3));
      }
      for (i = 0; i < list.length; i++) {
        var q = list[i];
        if (q.k === 'prop') drawProp(ctx, q.o, cx);
        else if (q.k === 'item') drawItem(ctx, q.o, cx);
        else if (q.k === 'en') drawEnemy(ctx, q.o, cx);
        else drawPlayer(ctx, cx);
      }
      for (i = 0; i < projs.length; i++) drawProj(ctx, projs[i], cx);
      for (i = 0; i < sparks.length; i++) drawSpark(ctx, sparks[i], cx);
      drawOverlays(ctx, w, h);
      drawHud(ctx, w, h);
    }
  });

  /* ----------------------------------------------------------------------- drawing */
  function shadow(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 2);
    ctx.fillRect(Math.round(x - w / 2) + 2, Math.round(y) - 2, Math.round(w) - 4, 1);
    ctx.fillRect(Math.round(x - w / 2) + 2, Math.round(y) + 1, Math.round(w) - 4, 1);
  }

  function flashOf(s) {
    if (!s.w) { var c = mkCanvas(s.c.width, s.c.height), g = c.getContext('2d'); g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); s.w = c; }
    return s.w;
  }
  function drawSpr(ctx, s, x, y, flip, white) {
    var img = white ? flashOf(s) : s.c, wd = s.c.width;
    var left = Math.round(x) - (flip ? (wd - 1 - s.ax) : s.ax), top = Math.round(y) - s.ay;
    R.draw.sprite(ctx, img, left, top, flip ? { flipX: true } : undefined);
  }
  function handPos(s, x, y, flip) { return [Math.round(x) + (flip ? -(s.hx - s.ax) : (s.hx - s.ax)) + (flip ? -0.5 : 0.5), Math.round(y) - s.ay + s.hy + 0.5]; }

  function drawWeapon(ctx, kind, s, x, y, flip, ang, pose) {
    var hp = handPos(s, x, y, flip), a = ang * Math.PI / 180;
    if (flip) a = Math.PI - a;
    var len, hx = hp[0], hy = hp[1];
    if (kind === 'pipe') {
      len = 12;
      var ex = hx + Math.cos(a) * len, ey = hy + Math.sin(a) * len;
      pxLine(ctx, hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, ex, ey, 2, '#c8c8d8');
      pxLine(ctx, hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, ex, ey, 1, '#ffffff');
      ctx.fillStyle = '#5a5a6a'; ctx.fillRect(Math.round(ex - 1), Math.round(ey - 1), 2, 2);
    } else if (kind === 'knife') {
      len = 7;
      pxLine(ctx, hx, hy, hx + Math.cos(a) * len, hy + Math.sin(a) * len, 1, '#e8f0ff');
      pxLine(ctx, hx - Math.cos(a) * 2, hy - Math.sin(a) * 2, hx, hy, 2, '#5a3a2a');
    } else if (kind === 'chain') {
      len = (pose === 'whip') ? 30 : 10;
      var ang2 = (pose === 'whip') ? 0 : 80 * Math.PI / 180; if (flip) ang2 = Math.PI - ang2;
      var n = Math.floor(len / 3);
      for (var i = 0; i <= n; i++) {
        var f = i / n, wob = (pose === 'whip') ? Math.sin(f * 6 + clock * 40) * 1.5 : 0;
        ctx.fillStyle = i % 2 ? '#c8ccd8' : '#7a7a8a';
        ctx.fillRect(Math.round(hx + Math.cos(ang2) * len * f), Math.round(hy + Math.sin(ang2) * len * f + wob), 2, 2);
      }
      var ax2 = hx + Math.cos(ang2) * len, ay2 = hy + Math.sin(ang2) * len;
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(Math.round(ax2 - 2), Math.round(ay2 - 1), 5, 2); ctx.fillRect(Math.round(ax2), Math.round(ay2 - 3), 1, 5);
    }
  }

  function playerPose() {
    switch (p.st) {
      case 'atk': { var A = p.atk; if (A === ATK.pipe) return p.t < A.wind ? 'pipeW' : 'pipeS'; return p.t < A.wind ? 'punch' + A.n + 'w' : 'punch' + A.n; }
      case 'jump': return p.kick ? 'kick' : 'jump';
      case 'land': return 'crouch';
      case 'spin': return 'spin0';
      case 'hurt': case 'fly': return 'hurt';
      case 'down': case 'dead': return 'down';
      case 'getup': return 'crouch';
    }
    if (phase === 'win') return 'vic';
    return p.moving ? 'walk' + (Math.floor(p.anim * 9) & 3) : (Math.floor(p.anim * 2.5) & 1 ? 'idle1' : 'idle0');
  }
  function drawPlayer(ctx, cx) {
    if (p.ghost > 0 && p.st !== 'down' && p.st !== 'dead' && Math.floor(clock * 20) % 2) return;
    var pose = playerPose(), s = SETS.hero[pose], flip = p.face < 0, x = p.x - cx, y = p.y - p.z;
    if (pose === 'down') flip = p.fdir > 0;
    else if (pose === 'spin0') flip = Math.floor(clock * 16) % 2 === 0;
    if (pose === 'down' && p.st === 'dead' && deadT > 0.9 && Math.floor(deadT * 18) % 2) return;
    drawSpr(ctx, s, x, y, flip, p.flash > 0);
    if (p.weapon > 0 && POSES[pose] && POSES[pose].wa !== undefined && p.st !== 'spin') drawWeapon(ctx, 'pipe', s, x, y, flip, POSES[pose].wa, pose);
    if (p.st === 'spin') {
      var ph = p.t * 20;
      ctx.strokeStyle = 'rgba(255,236,39,0.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y - 10, 15, 6, 0, ph, ph + 4.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y - 10, 19, 7, 0, ph + 3, ph + 6.2); ctx.stroke();
    }
    if (p.st === 'jump' && p.kick) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      var kx = x + p.face * 12; ctx.fillRect(Math.round(kx - p.face * 8 - (p.face < 0 ? 5 : 0)), Math.round(y - 11), 5, 1); ctx.fillRect(Math.round(kx - p.face * 12 - (p.face < 0 ? 4 : 0)), Math.round(y - 9), 4, 1);
    }
  }

  function enemyPose(e) {
    switch (e.st) {
      case 'wind': return e.mv.wp;
      case 'act': return e.mv.ap;
      case 'rec': return e.t < 0.14 ? e.mv.ap : 'idle0';
      case 'hurt': case 'fly': return 'hurt';
      case 'down': case 'dead': return 'down';
      case 'getup': return 'crouch';
    }
    return e.moving ? 'walk' + (Math.floor(e.anim * 8) & 3) : (Math.floor(e.anim * 2.5) & 1 ? 'idle1' : 'idle0');
  }
  function drawEnemy(ctx, e, cx) {
    if (e.st === 'dead' && e.t > 0.9 && Math.floor(e.t * 20) % 2) return;
    var pose = enemyPose(e), s = e.set[pose] || e.set.idle0, flip = e.face < 0, x = e.x - cx, y = e.y - e.z;
    if (pose === 'down') flip = e.fdir > 0;
    var white = e.flash > 0 || (e.st === 'wind' && Math.floor(e.t * 16) % 2 === 0 && e.windT - e.t < 0.3 + (e.T.boss ? 0.2 : 0));
    drawSpr(ctx, s, x, y, flip, white);
    var wep = e.T.wep;
    if (wep && POSES[pose] && POSES[pose].wa !== undefined && e.st !== 'fly' && e.st !== 'hurt' && !(e.st === 'act' && e.mv.kind === 'proj')) drawWeapon(ctx, wep, s, x, y, flip, POSES[pose].wa, pose);
    if (e.st === 'wind') {   // telegraph mark
      var my = Math.round(y - s.ay + 2);
      ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x) - 1, my - 9, 4, 8);
      ctx.fillStyle = '#ff3d3d'; ctx.fillRect(Math.round(x), my - 8, 2, 5); ctx.fillRect(Math.round(x), my - 2, 2, 1);
    }
    if (e.st === 'act' && e.mv.kind === 'charge') {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (var i = 0; i < 3; i++) ctx.fillRect(Math.round(x - e.face * (10 + i * 5)), Math.round(y - 14 - i * 3), 5, 1);
    }
    if (e.enraged && e.hp > 0 && Math.floor(clock * 6) % 2) { ctx.fillStyle = 'rgba(255,60,60,0.35)'; ctx.fillRect(Math.round(x - 3), Math.round(y - s.ay + 1), 6, 2); }
  }

  function drawProp(ctx, o, cx) {
    var s = crateS, off = o.shake > 0 ? (Math.floor(o.shake * 60) % 2 ? 1 : -1) : 0;
    var white = o.flash > 0;
    var img = white ? (function () { if (!s.w) { var c = mkCanvas(s.width, s.height), g = c.getContext('2d'); g.drawImage(s, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); s.w = c; } return s.w; })() : s;
    R.draw.sprite(ctx, img, Math.round(o.x - cx - s.width / 2) + off, Math.round(o.y - s.height + 2));
  }
  function drawItem(ctx, it, cx) {
    var s = S[it.kind], x = Math.round(it.x - cx - s.width / 2), bob = Math.round(Math.sin(it.t * 5) * 1);
    if (it.kind === 'pipe') { R.draw.sprite(ctx, s, x, Math.round(it.y - s.height)); return; }
    R.draw.sprite(ctx, s, x, Math.round(it.y - s.height - 2 + bob));
    if (Math.floor(it.t * 4) % 6 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 1, Math.round(it.y - s.height - 3 + bob), 1, 1); }
  }
  function drawProj(ctx, q, cx) {
    var x = q.x - cx, y = q.y - q.z;
    if (q.kind === 'knife') {
      var dir = sgn(q.vx);
      R.draw.sprite(ctx, S.knife, Math.round(x - 3), Math.round(y - 1), dir < 0 ? { flipX: true } : undefined);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.round(x - dir * 8 - 2), Math.round(y), 5, 1);
    } else {
      var f = 1 - q.life / 1.5;
      ctx.fillStyle = '#ffec27'; ctx.fillRect(Math.round(x - 3), Math.round(y - 9), 6, 9);
      ctx.fillStyle = '#ff8a1e'; ctx.fillRect(Math.round(x - 2), Math.round(y - 7), 4, 7);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - 1), Math.round(y - 5), 2, 5);
      ctx.fillStyle = 'rgba(255,200,80,0.4)'; ctx.fillRect(Math.round(x - sgn(q.vx) * 7 - 2), Math.round(y - 4), 5, 4); void f;
    }
  }
  function drawSpark(ctx, s, cx) {
    var x = Math.round(s.x - cx), y = Math.round(s.y), r = (s.big ? 7 : 4) * Math.min(1, 0.4 + s.t * 8);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 1, y - r, 2, r * 2); ctx.fillRect(x - r, y - 1, r * 2, 2);
    ctx.fillStyle = '#ffe14a';
    var d = Math.round(r * 0.7);
    ctx.fillRect(x - d, y - d, 2, 2); ctx.fillRect(x + d - 1, y - d, 2, 2); ctx.fillRect(x - d, y + d - 1, 2, 2); ctx.fillRect(x + d - 1, y + d - 1, 2, 2);
    if (s.t < 0.06) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 2, 4, 4); }
  }

  function drawBackdrop(ctx, cx) {
    var B = BG, off, k;
    ctx.drawImage(B.sky, 0, 0);
    k = Math.floor(cx * B.farF); off = -(k % 272);
    ctx.drawImage(B.far, off, 0); ctx.drawImage(B.far, off + 272, 0);
    if (B.mid) { k = Math.floor(cx * B.midF); off = -(k % 272); ctx.drawImage(B.mid, off, 0); ctx.drawImage(B.mid, off + 272, 0); }
    if (B.moon) {
      ctx.fillStyle = 'rgba(190,225,255,0.35)';
      for (var i = 0; i < 9; i++) { var gx = 104 - Math.floor(cx * 0.05) + Math.round(Math.sin(clock * 2 + i) * (2 + i * 0.4)); ctx.fillRect(gx - 5 + i % 2 * 2, 72 + i * 3, 8 - (i >> 1), 1); }
    }
    if (B.anim) {
      for (var j = 0; j < B.anim.length; j++) {
        var a = B.anim[j], ax = a.x - cx;
        if (ax < -50 || ax > W + 10) continue;
        var fl = 0.18 + 0.12 * Math.sin(clock * 7 + a.ph * 2) + (Math.floor(clock * 3 + a.ph) % 7 === 0 ? -0.1 : 0);
        ctx.globalAlpha = Math.max(0.05, fl); ctx.fillStyle = a.c; ctx.fillRect(ax - 3, a.y - 3, a.w + 6, a.h + 6); ctx.globalAlpha = 1;
      }
    }
    ctx.drawImage(B.near, cx, 0, W, H, 0, 0, W, H);
  }

  function drawOverlays(ctx, w, h) {
    if (rageFlash > 0) { ctx.globalAlpha = rageFlash * 0.4; ctx.fillStyle = '#ff2040'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (wstate === 'go' && wi > 0 && introT <= 0 && camX < limitX() - 4 && phase === 'play') {
      if (Math.floor(goT * 3) % 2 === 0) {
        R.draw.text(ctx, 'GO', w - 32, 40, { size: 8, color: '#ffec27', shadow: '#000' });
        for (var ai = 0; ai < 5; ai++) {
          ctx.fillStyle = '#000'; ctx.fillRect(w - 15 + ai * 2 + 1, 39 + ai + 1, 2, 10 - ai * 2);
          ctx.fillStyle = '#ffec27'; ctx.fillRect(w - 15 + ai * 2, 39 + ai, 2, 10 - ai * 2);
        }
      }
    }
    if (bannerT > 0) {
      var a = Math.min(1, bannerT * 2.5);
      ctx.globalAlpha = 0.6 * a; ctx.fillStyle = '#000'; ctx.fillRect(0, 62, w, 30); ctx.globalAlpha = a;
      var big = bannerTxt === 'WARNING!';
      R.draw.text(ctx, bannerTxt, w / 2, 67, { size: 8, color: big ? (Math.floor(clock * 8) % 2 ? '#ff3d3d' : '#ffec27') : '#ffec27', align: 'center', shadow: '#000' });
      R.draw.text(ctx, bannerSub, w / 2, 79, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }

  function hpBar(ctx, x, y, w, h, f, right, warn) {
    f = U.clamp(f, 0, 1);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#4a1020'; ctx.fillRect(x, y, w, h);
    var col = warn ? '#ffffff' : f > 0.5 ? '#3ddc5a' : f > 0.25 ? '#ffd23a' : '#ff3d3d', fw = Math.ceil(w * f);
    if (fw > 0) {
      var bx = right ? x + w - fw : x;
      ctx.fillStyle = col; ctx.fillRect(bx, y, fw, h);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(bx, y, fw, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (var i = 1; i < 4; i++) ctx.fillRect(x + Math.round(w * i / 4), y, 1, h);
  }
  function drawHud(ctx, w, h) {
    R.draw.topBar(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 12, w, 18);
    R.draw.text(ctx, 'KIT', 3, 14, { size: 6, color: '#1fc9d6' });
    hpBar(ctx, 3, 22, 54, 5, p.hp / p.maxhp, false, p.hp < 26 && Math.floor(clock * 6) % 2 === 0);
    // spin ready lamp
    var ready = p.spinCd <= 0 && p.hp > SPIN_COST + 4;
    ctx.fillStyle = ready ? '#ff8a1e' : '#4a3a3a'; ctx.fillRect(61, 22, 5, 5);
    if (ready) { ctx.fillStyle = '#ffec27'; ctx.fillRect(62, 23, 2, 2); }
    if (p.weapon > 0) {
      R.draw.sprite(ctx, S.pipe, 24, 15);
      ctx.fillStyle = '#ffffff';
      for (var i = 0; i < p.weapon; i++) ctx.fillRect(42 + i * 2, 17, 1, 2);
    }
    var t = target && (target.hp > 0 || targetT > 2.4) ? target : null;
    if (!t) { for (var j = 0; j < en.length; j++) if (en[j].T.boss && en[j].hp > 0) t = en[j]; }
    if (t) {
      R.draw.text(ctx, t.name, w - 3, 14, { size: 6, color: t.T.boss ? '#ff8a8a' : '#ffffff', align: 'right' });
      hpBar(ctx, w - 57, 22, 54, 5, Math.max(0, t.hp) / t.maxhp, true);
    }
    if (chain >= 2 && chainT > 0) R.draw.text(ctx, chain + ' HITS', w - 3, 31, { size: 6, color: '#ffec27', align: 'right', shadow: '#000' });
  }
})();
