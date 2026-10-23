/* Sand Palace — a deliberate palace-escape platformer with sword duels, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var W = 136, H = 164, T = 8, TOPH = 12, VH = 144, BOTY = TOPH + VH;          // view, tile, HUD bands
  var RW = 17, RH = 18, RPW = RW * T, RPH = RH * T;                            // one room = 17 x 18 tiles, floors on rows 3 / 9 / 15
  var HW = 3, HH = 18, HHC = 11, SUP = 2, REACH = 22;                          // hero half width, height, crouch height, ground support, hang reach
  var WALK = 27, RUN = 56, CREEP = 12, GRAV = 620, MAXFALL = 300;
  var TIME_LIMIT = 900, GATE_TIME = 9;

  /* ------------------------------------------------------------------ levels
     Each level is a grid of rooms (17 x 16 tiles drawn here, two cosmetic rows are added below).  '|' and '-' lines are only
     visual separators.  Floors are on rows 3, 9 and 15 of every room, markers sit in the cell just above the floor.
       # stone   L loose floor   S spike pit   W spike plate   V blade gate   1-4 pressure plate   A-D gate (opened by plate 1-4)
       @ start   E exit door   g rookie guard   r veteran   c captain   h potion   H big potion   T torch                       */
  var LEVELS = [
    { name: 'THE CELLS', theme: 'cells',
      hints: [{ tx: 2, text: 'A: JUMP  B: RUN' }, { tx: 8, text: 'JUMP THE SPIKES' }, { tx: 23, text: 'A: STRIKE  B: PARRY' }, { tx: 27, text: 'JUMP UP TO GRAB LEDGE' }, { tx: 40, text: 'DOWN AT EDGE: HANG' }],
      rows: [
        '#################|#################|#################',
        '#################|#################|#################',
        '#################|#################|#################',
        '#################|#################|#################',
        '#................|.................|................#',
        '#................|.................|................#',
        '#..T.............|.................|.....T..........#',
        '#................|.................|................#',
        '#.H..............|.................|................#',
        '#####............|............#####|###LLL####......#',
        '#................|............#####|................#',
        '#................|............#####|................#',
        '#.....T..........|....T.......#####|................#',
        '#................|............#####|................#',
        '#.@..............|.......g....#####|.....h.......E..#',
        '#########SS######|#################|#################'
      ] },
    { name: 'THE SAND HALLS', theme: 'halls',
      hints: [{ tx: 19, text: 'LOOSE FLOORS CRUMBLE' }, { tx: 41, text: 'DOWN AT EDGE: HANG' }, { tx: 37, text: 'TIME THE SPIKE PLATES' }],
      rows: [
        '#................|.................|................#',
        '#.........T......|.................|................#',
        '#.@..............|............g....|................#',
        '########SS#######|#####LLL#########|#######.........#',
        '#................|.................|................#',
        '#................|.................|................#',
        '#............T...|.................|................#',
        '#................|.................|................#',
        '#...........h....|....r............|................#',
        '#....##########LL|L##########SS####|####WW###########',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|........T........|................#',
        '#................|.................|................#',
        '#................|..h...........g..|............E...#',
        '##########SS#####|#########WW######|#####SSS#########'
      ] },
    { name: 'THE GALLERY', theme: 'gallery',
      hints: [{ tx: 8, text: 'TIME THE BLADE GATE' }, { tx: 19, text: 'PLATE OPENS THE GATE' }, { tx: 13, text: 'JUMP UP TO CLIMB' }],
      rows: [
        '#................|................#',
        '#........T.......|................#',
        '#................|................#',
        '#................|................#',
        '#................|................#',
        '#................|................#',
        '#................|....T...........#',
        '#................|................#',
        '#................|..............E.#',
        '#................|............#####',
        '#................|................#',
        '#................|................#',
        '#............T...|................#',
        '#................|................#',
        '#................|...H............#',
        '#################|######...########',
        '-----------------------------------',
        '#................|................#',
        '#........T.......|................#',
        '#..............V.|...g............#',
        '#########...#####|#################',
        '#................|................#',
        '#................|................#',
        '#......T.........|................#',
        '#................|................#',
        '#.......h...r....|................#',
        '##############WW#|##LLL####...#####',
        '#................|............#####',
        '#................|............#####',
        '#......T.........|............#####',
        '#................|............#####',
        '#.@.......V....g.|h...V..A....#####',
        '######SS#########|##1##############'
      ] },
    { name: 'THE ROYAL TOWER', theme: 'tower',
      hints: [{ tx: 19, text: 'TIME THE BLADES' }, { tx: 44, text: 'CLIMB THE WALL' }, { tx: 12, text: 'JUMP UP TO CLIMB' }],
      rows: [
        '#................|.................|................#',
        '#..........T.....|.................|................#',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|..............T..|................#',
        '#................|.................|................#',
        '#................|.................|..............E.#',
        '#................|.................|...........######',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|.................|...H............#',
        '#################|#################|######...########',
        '-----------------------------------------------------',
        '#................|.................|................#',
        '#..........T.....|.................|................#',
        '#................|..V..V...g....h..|....r...........#',
        '############...##|#################|SS###############',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|....T............|................#',
        '#................|.................|................#',
        '#.....H..........|h................|....c...........#',
        '#################|####WW###SS###LLL|########...######',
        '#................|.................|...........######',
        '#................|.................|...........######',
        '#................|....T............|...........######',
        '#................|.................|...........######',
        '#.@..........g...|....V...V..A.....|r...h......######',
        '########SS#######|1################|######WW#########'
      ] },
    { name: 'THE THRONE ROOM', theme: 'throne',
      hints: [{ tx: 6, text: 'THE FINAL HALL' }, { tx: 21, text: 'CLIMB THE WALL' }, { tx: 31, text: 'PLATE OPENS THE GATE' }],
      rows: [
        '#................|.................|................#',
        '#..........T.....|.................|................#',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|.................|................#',
        '#................|..............T..|................#',
        '#................|.................|................#',
        '#................|.........H....r..|................#',
        '#................|.......##########|1##.............#',
        '#................|.......######....|................#',
        '#................|.......######....|................#',
        '#..........T.....|.......######....|................#',
        '#................|.......######....|................#',
        '#.@.......h.V...V|..c....######....|..........A..c.E#',
        '########SS#######|#################|#####WW##########'
      ] }
  ];

  var THEMES = {
    cells: { wall: '#1f2748', wallDk: '#181e3a', wallHi: '#2a3560', stone: '#59689a', stoneDk: '#3b4778', stoneHi: '#7d90cc', top: '#8fa4e6', topHi: '#c6d4ff', edge: '#10163a', pillar: '#34406c', trim: '#46568c', skyA: '#0a1030', skyB: '#1d2a5c', glow: '#7fb4ff' },
    halls: { wall: '#3d2a24', wallDk: '#2f1f1b', wallHi: '#4e362d', stone: '#c19a62', stoneDk: '#8f6c40', stoneHi: '#dcb77e', top: '#f0d49a', topHi: '#fff0c8', edge: '#2a170d', pillar: '#6e4a36', trim: '#8a6048', skyA: '#2a1244', skyB: '#e0703a', glow: '#ffe9a0' },
    gallery: { wall: '#3a1d3a', wallDk: '#2c1430', wallHi: '#4a2848', stone: '#a58bc2', stoneDk: '#6f5a94', stoneHi: '#c8b3e6', top: '#e0d0f5', topHi: '#ffffff', edge: '#1c0e24', pillar: '#5a3a6a', trim: '#d8a838', skyA: '#120a2c', skyB: '#6a3a9a', glow: '#ffe27a' },
    tower: { wall: '#16303a', wallDk: '#0f232b', wallHi: '#1f4150', stone: '#6a8fa0', stoneDk: '#456270', stoneHi: '#9cc2d4', top: '#b8e0ef', topHi: '#ffffff', edge: '#08161c', pillar: '#2a4c5c', trim: '#5a8aa0', skyA: '#08102a', skyB: '#2a5a8a', glow: '#bfeaff' },
    throne: { wall: '#3a1420', wallDk: '#2a0e18', wallHi: '#4c1c2a', stone: '#d4b060', stoneDk: '#9a7430', stoneHi: '#f0d080', top: '#ffe9a0', topHi: '#ffffff', edge: '#240a10', pillar: '#7a2438', trim: '#d8a838', skyA: '#1a0a22', skyB: '#a83a3a', glow: '#ffd27a' }
  };

  var PALS = {
    hero: { out: '#170c22', skin: '#f6c096', skinDk: '#c98a62', hair: '#3a2038', tunic: '#f4ead2', tunicDk: '#cdbd9a', sash: '#ffcf3a', pants: '#4a5fd0', pantsDk: '#3446a0', boot: '#7a4a2a', scarf: '#ff3d5e', scarfDk: '#b81f45', blade: '#f2f8ff', hilt: '#ffcf3a', cap: '' },
    g: { out: '#0e1a1c', skin: '#d9966a', skinDk: '#b0724c', hair: '#ece6d4', tunic: '#27a08a', tunicDk: '#1a7464', sash: '#e0a020', pants: '#e6dcc4', pantsDk: '#b8ad94', boot: '#5a3a24', scarf: '', blade: '#d6dee8', hilt: '#e0a020', cap: '#ece6d4' },
    r: { out: '#180e26', skin: '#c98760', skinDk: '#a06a48', hair: '#e8c040', tunic: '#8a4ad0', tunicDk: '#5e2f9a', sash: '#f0c040', pants: '#2c2650', pantsDk: '#201c3c', boot: '#3a2a20', scarf: '', blade: '#e4ecf6', hilt: '#f0c040', cap: '#e8c040' },
    c: { out: '#0a0a14', skin: '#b87850', skinDk: '#8e5a3a', hair: '#d8a838', tunic: '#3a3a58', tunicDk: '#26263c', sash: '#d8a838', pants: '#1c1c2e', pantsDk: '#12121e', boot: '#2a2a38', scarf: '', blade: '#ffd8d8', hilt: '#d8a838', cap: '#d8a838' },
    white: { out: '#ffffff', skin: '#ffffff', skinDk: '#ffffff', hair: '#ffffff', tunic: '#ffffff', tunicDk: '#ffffff', sash: '#ffffff', pants: '#ffffff', pantsDk: '#ffffff', boot: '#ffffff', scarf: '#ffffff', scarfDk: '#ffffff', blade: '#ffffff', hilt: '#ffffff', cap: '#ffffff' }
  };
  var GK = {
    g: { hp: 3, spd: 15, chase: 24, wind: 0.38, par: 0.22, agg: 0.45, thk: 0.26, pts: 100, bulk: 4 },
    r: { hp: 4, spd: 17, chase: 27, wind: 0.30, par: 0.40, agg: 0.64, thk: 0.18, pts: 150, bulk: 4 },
    c: { hp: 5, spd: 19, chase: 30, wind: 0.24, par: 0.46, agg: 0.72, thk: 0.12, pts: 250, bulk: 5 }
  };

  /* ------------------------------------------------------------------ utils */
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }
  function ease(t) { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  var seed = 7;
  function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

  /* ------------------------------------------------------------------ sounds */
  var SND = {
    jump: function () { R.sfx.tone(300, 0.14, { type: 'square', vol: 0.05, slide: 560 }); },
    step: function (run) { R.sfx.tone(run ? 150 : 120, 0.035, { type: 'triangle', vol: run ? 0.05 : 0.03 }); },
    land: function (hard) { R.sfx.tone(hard ? 90 : 120, hard ? 0.12 : 0.05, { type: 'triangle', vol: hard ? 0.16 : 0.07, slide: hard ? 50 : 90 }); if (hard) R.sfx.noise(0.1, { vol: 0.1, freq: 900 }); },
    grab: function () { R.sfx.tone(330, 0.04, { type: 'square', vol: 0.06 }); R.sfx.tone(440, 0.05, { type: 'square', vol: 0.05, delay: 0.04 }); },
    climb: function () { R.sfx.tone(200, 0.05, { type: 'triangle', vol: 0.06 }); },
    draw: function () { R.sfx.noise(0.18, { vol: 0.08, freq: 6500, sweep: 2500, filter: 'highpass' }); R.sfx.tone(1500, 0.06, { type: 'triangle', vol: 0.04, delay: 0.1 }); },
    swing: function () { R.sfx.noise(0.1, { vol: 0.09, freq: 5200, sweep: 1400, filter: 'highpass' }); R.sfx.tone(520, 0.08, { type: 'sawtooth', vol: 0.035, slide: 260 }); },
    clang: function () { R.sfx.tone(1800, 0.06, { type: 'square', vol: 0.08 }); R.sfx.tone(2700, 0.1, { type: 'triangle', vol: 0.07, delay: 0.02 }); R.sfx.noise(0.08, { vol: 0.08, freq: 6000, filter: 'highpass' }); },
    crack: function () { R.sfx.noise(0.12, { vol: 0.08, freq: 1400, sweep: 400 }); },
    crumble: function () { R.sfx.noise(0.4, { vol: 0.16, freq: 900, sweep: 90 }); R.sfx.tone(80, 0.25, { type: 'sawtooth', vol: 0.07, slide: 40 }); },
    gateUp: function () { R.sfx.tone(120, 0.5, { type: 'square', vol: 0.05, slide: 200 }); R.sfx.noise(0.3, { vol: 0.05, freq: 700 }); },
    slam: function () { R.sfx.tone(70, 0.2, { type: 'triangle', vol: 0.16, slide: 40 }); R.sfx.noise(0.15, { vol: 0.12, freq: 1200, sweep: 200 }); },
    snap: function () { R.sfx.noise(0.12, { vol: 0.13, freq: 4500, sweep: 800, filter: 'highpass' }); R.sfx.tone(260, 0.08, { type: 'sawtooth', vol: 0.06, slide: 120 }); },
    plate: function () { R.sfx.play('select'); },
    warn: function () { R.sfx.tone(980, 0.07, { type: 'square', vol: 0.06 }); }
  };

  /* ------------------------------------------------------------------ sprites */
  function outline(lines) {
    var h = lines.length, w = 0, y, x, out = [];
    lines.forEach(function (l) { w = Math.max(w, l.length); });
    var g = lines.map(function (l) { while (l.length < w) l += '.'; return l; });
    function at(x, y) { return (y < 0 || y >= h || x < 0 || x >= w) ? '.' : g[y].charAt(x); }
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
  var S = {};
  function buildSprites() {
    S.potion = R.sprite(outline(['..c..', '..g..', '.rrr.', 'rwrrr', 'rrrrr', 'rrrrr', '.rrr.']), { o: '#2a0a1e', c: '#d9a066', g: '#cfeeff', r: '#ff3d5e', w: '#ffd6e0' });
    S.big = R.sprite(outline(['...c...', '...g...', '..ggg..', '.bbbbb.', 'bwbbbbb', 'bbbbbbb', 'bbyyybb', 'bbbbbbb', '.bbbbb.']), { o: '#06123a', c: '#d9a066', g: '#cfeeff', b: '#2f9bff', w: '#c8ecff', y: '#ffd23a' });
    // soft vignette used for mood
    var cv = document.createElement('canvas'); cv.width = W; cv.height = VH;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(W / 2, VH * 0.55, 30, W / 2, VH * 0.55, 100);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, W, VH);
    S.vig = cv;
    var gc = document.createElement('canvas'); gc.width = 48; gc.height = 48;
    var gg = gc.getContext('2d'), gr2 = gg.createRadialGradient(24, 24, 1, 24, 24, 24);
    gr2.addColorStop(0, 'rgba(255,190,90,0.38)'); gr2.addColorStop(0.5, 'rgba(255,150,60,0.14)'); gr2.addColorStop(1, 'rgba(255,120,40,0)');
    gg.fillStyle = gr2; gg.fillRect(0, 0, 48, 48);
    S.glow = gc;
  }

  /* ---------------------------------------------------------- figure renderer
     Characters are drawn from joint positions (two-bone IK for legs and arms), so every animation is just a pose:
     [hipX,hipY, shoulderX,shoulderY, headX,headY, backFootX,Y, frontFootX,Y, backHandX,Y, frontHandX,Y, bladeAngle]   (feet at y = 0, +x = forward) */
  var P_IDLE = [0, -8, 0.5, -13.3, 1, -16.3, -2.5, 0, 2.5, 0, -1.5, -6.6, 2.2, -6.8, 0];
  var P_CROUCH = [-0.5, -4.6, 1.2, -9, 2.4, -12, -3.6, 0, 3.6, 0, -0.5, -4.4, 3.6, -5.4, 0];
  var P_UP = [0.5, -9, 1, -14.5, 1.6, -17.5, -3, -3.5, 3.4, -5.5, -2, -15.5, 3.6, -18, 0];
  var P_FALL = [0, -8.6, 0.5, -14, 1, -17, -2.6, -1, 2, -0.5, -3.6, -12, 4.2, -13, 0];
  var P_LEAP = [1, -8.5, 2.6, -13.5, 3.6, -16.4, -4.8, -3, 5.2, -5.2, -3.8, -9.8, 5.6, -14.2, 0];
  var P_HANG = [0, -10.2, 0.2, -16.6, 0.2, -19.6, -1, -2, 1.2, -1, 1.6, -22, 2.9, -22, 0];
  var P_DUEL = [0.5, -7.8, 1.3, -13, 2, -16, -3.8, 0, 3.2, 0, -2.3, -10.5, 5.6, -10.6, -1.0];
  var P_WIND = [-0.6, -8, 0.1, -13.2, 0.7, -16.3, -4.2, 0, 2.2, 0, -2.2, -10, 1.4, -14.2, -2.35];
  var P_STRIKE = [2.6, -6.8, 3.9, -12.2, 4.9, -15, -4.2, 0, 7, 0, -2.6, -11.4, 9.6, -10.6, 0.05];
  var P_PARRY = [0, -7.9, 0.6, -13.2, 1.3, -16.2, -3.5, 0, 3, 0, -2.2, -9.8, 5, -12.2, -1.55];
  var P_HURT = [-1.6, -7.8, -2.1, -13, -2.9, -15.8, -3.6, 0, 1, -0.6, -5.2, -10, 0, -6, 0.7];
  var P_DEAD = [-3, -2.4, -8.2, -2.8, -11.4, -3.2, 2, -0.6, 4.4, -0.4, -7.5, -1, -5, -5, 1.4];
  function blend(a, b, t) { var o = new Array(15), i; for (i = 0; i < 15; i++) o[i] = a[i] + (b[i] - a[i]) * t; return o; }
  function gait(ph, run, crouch) {
    var th = ph * 6.2832, s = Math.sin(th), c = Math.cos(th);
    var amp = run ? 5.2 : crouch ? 1.6 : 3.4, lift = run ? 3.4 : crouch ? 0.8 : 1.9, lean = run ? 1.8 : 0.4, ar = run ? 3.6 : 2.0;
    var hy = (crouch ? -5 : -8) + (run ? 0.9 : 0.5) * Math.abs(s) - (run ? 0.5 : 0);
    var fa = [amp * s, -lift * Math.max(0, c)], fb = [-amp * s, -lift * Math.max(0, -c)];
    var hh = run ? -9.4 : -6.8;
    var p = [lean * 0.3, hy, lean + 0.5, hy - 5.3, lean * 1.3 + 1, hy - 8.3, fb[0], fb[1], fa[0], fa[1], -ar * s + 0.3, hh + (run ? 0.8 * c : 0), ar * s + 1.2, hh - (run ? 0.8 * c : 0), 0];
    return crouch ? blend(p, P_CROUCH, 0.35) : p;
  }
  function ik(ax, ay, bx, by, l1, l2, s) {
    var dx = bx - ax, dy = by - ay, d = Math.sqrt(dx * dx + dy * dy) || 0.01, m = l1 + l2 - 0.02;
    if (d > m) { bx = ax + dx * m / d; by = ay + dy * m / d; dx = bx - ax; dy = by - ay; d = m; }
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
    return { kx: ax + ux * a + uy * hh * s, ky: ay + uy * a - ux * hh * s, ex: bx, ey: by };
  }
  function segPix(ctx, x0, y0, x1, y1, w, col) {
    var dx = x1 - x0, dy = y1 - y0, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))), i, o = w / 2;
    ctx.fillStyle = col;
    for (i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + dx * i / n - o), Math.round(y0 + dy * i / n - o), w, w);
  }
  var OPS = [];
  function opS(a, b, w, col) { OPS.push(a[0], a[1], b[0], b[1], w, col, 0); }
  function opR(x, y, w, h, col) { OPS.push(x, y, w, h, 0, col, 1); }
  function drawFigure(ctx, o) {
    var p = o.pose, pal = o.pal, f = o.face, rot = o.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot), bulk = o.bulk || 4, i;
    function X(lx, ly) { if (rot) { var dx = lx, dy = ly + 8; lx = dx * cs - dy * sn; ly = dx * sn + dy * cs - 8; } return [o.x + f * lx, o.y + ly]; }
    var hip = [p[0], p[1]], sh = [p[2], p[3]];
    var kb = ik(hip[0] - 0.4, hip[1], p[6], p[7] - 2, 3.6, 3.6, 1), kf = ik(hip[0] + 0.4, hip[1], p[8], p[9] - 2, 3.6, 3.6, 1);
    var eb = ik(sh[0] - 0.5, sh[1] + 0.3, p[10], p[11], 3.4, 3.4, -1), ef = ik(sh[0] + 0.5, sh[1] + 0.3, p[12], p[13], 3.4, 3.4, -1);
    OPS.length = 0;
    var sc = o.sc == null ? 0.4 : o.sc, sdy = o.sdy || 0, t = o.t || 0;
    if (pal.scarf) {                                                                   // scarf streams behind the neck
      var prev = X(sh[0] - 0.6, sh[1] - 0.9), cur, k;
      for (k = 1; k <= 4; k++) {
        cur = X(sh[0] - 0.6 - k * (2 + sc * 1.1), sh[1] - 0.9 + k * 0.5 * (1 - sc) + sdy * k * 0.45 + Math.sin(t * 9 - k * 1.2) * (0.5 + sc) * k * 0.3);
        opS(prev, cur, 2, k > 2 ? pal.scarfDk : pal.scarf); prev = cur;
      }
    }
    // back leg + back arm
    opS(X(hip[0] - 0.4, hip[1]), X(kb.kx, kb.ky), 2, pal.pantsDk); opS(X(kb.kx, kb.ky), X(kb.ex, kb.ey), 2, pal.pantsDk);
    var bfa = X(kb.ex, kb.ey), bfb = X(kb.ex + 2.4, kb.ey + 1.6); opS(bfa, bfb, 2, pal.boot);
    opS(X(sh[0] - 0.5, sh[1] + 0.3), X(eb.kx, eb.ky), 2, pal.tunicDk); opS(X(eb.kx, eb.ky), X(eb.ex, eb.ey), 2, pal.skinDk);
    // torso
    opS(X(hip[0], hip[1]), X(sh[0], sh[1]), bulk, pal.tunic);
    var hb = X(hip[0], hip[1] - 0.8); opS(hb, [hb[0] + 0.01, hb[1]], bulk, pal.sash);
    // head
    var hd = X(p[4], p[5]), hx = Math.round(hd[0]) - 2, hy = Math.round(hd[1]) - 2, back = f > 0 ? -1 : 1;
    opR(hx, hy, 5, 5, pal.skin);
    if (pal.cap) { opR(hx - 1, hy - 1, 7, 3, pal.cap); opR(hx + (f > 0 ? -2 : 5), hy + 1, 1, 3, pal.cap); }
    else { opR(hx, hy - 1, 5, 3, pal.hair); opR(f > 0 ? hx - 1 : hx + 5, hy + 1, 1, 3, pal.hair); }
    // front leg
    opS(X(hip[0] + 0.4, hip[1]), X(kf.kx, kf.ky), 2, pal.pants); opS(X(kf.kx, kf.ky), X(kf.ex, kf.ey), 2, pal.pants);
    var ffa = X(kf.ex, kf.ey), ffb = X(kf.ex + 2.4, kf.ey + 1.6); opS(ffa, ffb, 2, pal.boot);
    // front arm
    opS(X(sh[0] + 0.5, sh[1] + 0.3), X(ef.kx, ef.ky), 2, pal.tunic); opS(X(ef.kx, ef.ky), X(ef.ex, ef.ey), 2, pal.skin);
    var hand = X(ef.ex, ef.ey);
    // blade
    var ba = p[14], bl = o.bladeLen || 11, b0, b1, b2, per;
    if (o.blade) {
      b0 = X(ef.ex, ef.ey); b1 = X(ef.ex + Math.cos(ba) * bl * 0.55, ef.ey + Math.sin(ba) * bl * 0.55);
      b2 = X(ef.ex + Math.cos(ba) * bl * 0.55 + Math.cos(ba - (o.curve || 0.5)) * bl * 0.45, ef.ey + Math.sin(ba) * bl * 0.55 + Math.sin(ba - (o.curve || 0.5)) * bl * 0.45);
      opS(b0, b1, 1, pal.blade); opS(b1, b2, 1, pal.blade);
      per = X(ef.ex - Math.sin(ba) * 1.6, ef.ey + Math.cos(ba) * 1.6); var per2 = X(ef.ex + Math.sin(ba) * 1.6, ef.ey - Math.cos(ba) * 1.6);
      opS(per, per2, 1, pal.hilt);
    } else if (o.sheath) {
      var s0 = X(hip[0] - 0.8, hip[1] - 0.3), s1 = X(hip[0] - 5, hip[1] + 2);
      opS(s0, s1, 1, pal.boot); opS(s0, [s0[0] + f * 0.01, s0[1] - 1], 1, pal.hilt);
    }
    var alpha = o.alpha == null ? 1 : o.alpha;
    if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
    // pass 1: outline, pass 2: colour
    var n = OPS.length, ty, w;
    ctx.fillStyle = pal.out;
    for (i = 0; i < n; i += 7) {
      if (OPS[i + 6]) ctx.fillRect(OPS[i] - 1, OPS[i + 1] - 1, OPS[i + 2] + 2, OPS[i + 3] + 2);
      else segPix(ctx, OPS[i], OPS[i + 1], OPS[i + 2], OPS[i + 3], OPS[i + 4] + 2, pal.out);
    }
    for (i = 0; i < n; i += 7) {
      if (OPS[i + 6]) { ctx.fillStyle = OPS[i + 5]; ctx.fillRect(OPS[i], OPS[i + 1], OPS[i + 2], OPS[i + 3]); }
      else segPix(ctx, OPS[i], OPS[i + 1], OPS[i + 2], OPS[i + 3], OPS[i + 4], OPS[i + 5]);
    }
    ctx.fillStyle = pal.out; ctx.fillRect(f > 0 ? hx + 3 : hx + 1, hy + 2, 1, 1);    // eye
    if (alpha < 1) ctx.restore();
  }

  /* -------------------------------------------------------------------- state */
  var lv, th, levelIdx, hero, guards, items, gates, loose, debris, parts, texts, camX, camY, wtime, timeLeft, phase, phaseT, banner, fade, hintT, hintText, hintDone;
  var lvHp, lvMax, kills, parries, deaths, lastWarn, hudFlash, deathWhy;

  function tileAt(tx, ty) { if (tx < 0 || tx >= lv.w || ty < -2 || ty >= lv.h) return '#'; if (ty < 0) return '.'; return lv.t[ty][tx]; }
  function solid(tx, ty) {
    if (tx < 0 || tx >= lv.w || ty < -2) return true;
    if (ty < 0 || ty >= lv.h) return false;
    var c = lv.t[ty][tx];
    if (c === '.') {
      for (var i = 0; i < 4; i++) { var g = gates[i]; if (g && g.tx === tx && ty >= g.ty - 3 && ty <= g.ty && g.open < 0.7) return true; }
      return false;
    }
    return c === '#' || c === 'L' || c === 'l' || c === 'W' || (c >= '1' && c <= '4');
  }
  function drawSol(tx, ty) {                                // stone as drawn (includes the cosmetic foundation under bottom floors)
    if (ty < 0 || tx < 0 || tx >= lv.w) return true;
    if (ty >= lv.h) return false;
    var m = ty % RH;
    if (m >= 16) return lv.t[ty - m + 15][tx] === '#';
    var c = lv.t[ty][tx];
    return c === '#' || c === 'L' || c === 'l' || c === 'W' || (c >= '1' && c <= '4');
  }

  function parseLevel(def) {
    var groups = [], cur = [];
    def.rows.forEach(function (l) { if (l.charAt(0) === '-') { if (cur.length) groups.push(cur); cur = []; } else cur.push(l.replace(/\|/g, '')); });
    if (cur.length) groups.push(cur);
    var nrx = groups[0][0].length / RW, nry = groups.length, w = nrx * RW, h = nry * RH, x, y;
    var lines = []; groups.forEach(function (g) { g.forEach(function (l) { lines.push(l); }); });
    var L = { def: def, w: w, h: h, nrx: nrx, nry: nry, t: [], guards: [], items: [], slicers: [], torches: [], gates: [null, null, null, null], spawn: { x: 20, y: 120 }, exit: null, hints: def.hints || [] };
    for (y = 0; y < h; y++) {
      var row = [], rr = y % RH, gy = (y - rr) / RH, line = rr < 16 ? lines[gy * 16 + rr] : null;
      for (x = 0; x < w; x++) {
        var ch = line ? line.charAt(x) || '.' : '.', keep = '.';
        if (ch === '#' || ch === 'L' || ch === 'S' || ch === 'W' || (ch >= '1' && ch <= '4')) keep = ch;
        else if (ch === '@') L.spawn = { x: x * T + 4, y: (y + 1) * T };
        else if (ch === 'E') L.exit = { x: x * T + 4, y: (y + 1) * T, tx: x, ty: y };
        else if (ch === 'g' || ch === 'r' || ch === 'c') L.guards.push({ k: ch, x: x * T + 4, y: (y + 1) * T });
        else if (ch === 'h' || ch === 'H') L.items.push({ k: ch, x: x * T + 4, y: (y + 1) * T - 5, got: false });
        else if (ch === 'V') L.slicers.push({ tx: x, ty: y, x: x * T + 4, y: (y + 1) * T });
        else if (ch === 'T') L.torches.push({ tx: x, ty: y });
        else if (ch >= 'A' && ch <= 'D') L.gates[ch.charCodeAt(0) - 65] = { tx: x, ty: y, open: 0, timer: 0 };
        row.push(keep);
      }
      L.t.push(row);
    }
    return L;
  }

  /* ------------------------------------------------------------ static layer */
  function wallTile(g, tx, ty) {
    var x = tx * T, y = ty * T, v = hash(tx * 13 + ty * 7);
    g.fillStyle = th.wallDk; g.fillRect(x, y + 7, T, 1); g.fillRect(x + ((ty & 1) ? 3 : 7), y, 1, 7);
    if (v < 0.22) { g.fillStyle = th.wallHi; g.fillRect(x + 1, y + 1, 3, 1); }
    else if (v > 0.84) { g.fillStyle = th.wallDk; g.fillRect(x + 4, y + 3, 2, 1); }
  }
  function archFill(g, cx, y, hw, h, col) {
    var yy, half;
    g.fillStyle = col;
    for (yy = 0; yy < hw; yy++) { half = Math.round(Math.sqrt(hw * hw - (hw - yy - 0.5) * (hw - yy - 0.5))); g.fillRect(cx - half, y + yy, half * 2, 1); }
    g.fillRect(cx - hw, y + hw, hw * 2, h - hw);
  }
  function roomDecor(g, rx, ry, b) {
    var fr = 3 + 6 * b, top = (ry * RH + (b === 0 ? 0 : fr - 5)) * T, bot = (ry * RH + fr) * T, x0 = rx * RPW, v = hash(rx * 31 + ry * 17 + b * 5), i;
    // pillars
    [3, 12].forEach(function (c) {
      var px = x0 + c * T;
      g.fillStyle = th.pillar; g.fillRect(px, top, T, bot - top);
      g.fillStyle = th.trim; g.fillRect(px, top, 1, bot - top); g.fillStyle = th.wallDk; g.fillRect(px + T - 2, top, 2, bot - top);
      g.fillStyle = th.trim; g.fillRect(px - 1, top, T + 2, 3); g.fillRect(px - 1, bot - 3, T + 2, 3);
      g.fillStyle = th.wallDk; g.fillRect(px - 1, top + 3, T + 2, 1);
    });
    if (v < 0.75) {                                                                    // arched window with a sky view
      var cx = x0 + 8.5 * T, wy = bot - 36, hw = 8;
      archFill(g, cx, wy - 2, hw + 2, 34, th.trim);
      archFill(g, cx, wy, hw, 32, th.skyA);
      for (i = 0; i < 32; i += 4) { g.fillStyle = th.skyB; g.globalAlpha = i / 40; g.fillRect(cx - hw, wy + i, hw * 2, 4); }
      g.globalAlpha = 1;
      g.fillStyle = th.glow;
      for (i = 0; i < 5; i++) { var sx = cx - 6 + Math.floor(hash(rx * 7 + b * 3 + i) * 12), sy = wy + 4 + Math.floor(hash(ry * 5 + b + i * 3) * 18); g.fillRect(sx, sy, 1, 1); }
      g.fillStyle = th.edge; g.fillRect(cx - 1, wy, 2, 32); g.fillRect(cx - hw, wy + 10, hw * 2, 2); g.fillRect(cx - hw, wy + 22, hw * 2, 2);    // bars
      g.fillStyle = th.trim; g.fillRect(cx - hw - 2, bot - 4, hw * 2 + 4, 3);
    }
  }
  function stoneTile(g, tx, ty, ox, oy) {
    var x = tx * T + (ox || 0), y = ty * T + (oy || 0), up = drawSol(tx, ty - 1), dn = drawSol(tx, ty + 1), lf = drawSol(tx - 1, ty), rt = drawSol(tx + 1, ty), v = hash(tx * 31 + ty * 17);
    g.fillStyle = th.stone; g.fillRect(x, y, T, T);
    g.fillStyle = th.stoneDk; g.fillRect(x, y + 7, T, 1); g.fillRect(x + (((tx + ty) & 1) ? 7 : 3), y, 1, 7);
    if (v < 0.3) { g.fillStyle = th.stoneHi; g.fillRect(x + 1 + ((v * 20) | 0) % 5, y + 3 + ((v * 10) | 0) % 3, 2, 1); }
    if (!up) { g.fillStyle = th.top; g.fillRect(x, y, T, 2); g.fillStyle = th.topHi; g.fillRect(x, y, T, 1); }
    g.fillStyle = th.edge;
    if (!lf) g.fillRect(x, y, 1, T);
    if (!rt) g.fillRect(x + 7, y, 1, T);
    if (!dn) g.fillRect(x, y + 7, T, 1);
  }
  function buildStatic() {
    var w = lv.w * T, h = lv.h * T, cv = document.createElement('canvas'), g, tx, ty, rx, ry, b, c, x, y;
    cv.width = w; cv.height = h + 16; g = cv.getContext('2d');
    g.translate(0, 16);
    g.fillStyle = th.wall; g.fillRect(0, -16, w, h + 16);
    for (ty = 0; ty < lv.h; ty++) for (tx = 0; tx < lv.w; tx++) wallTile(g, tx, ty);
    for (ry = 0; ry < lv.nry; ry++) for (rx = 0; rx < lv.nrx; rx++) for (b = 0; b < 3; b++) roomDecor(g, rx, ry, b);
    for (ty = 0; ty < lv.h; ty++) for (tx = 0; tx < lv.w; tx++) {                     // shadows under slabs
      if (drawSol(tx, ty) && !drawSol(tx, ty + 1) && ty + 1 < lv.h && (ty % RH) < 16) { g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(tx * T, (ty + 1) * T, T, 3); g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(tx * T, (ty + 1) * T + 3, T, 3); }
    }
    for (ty = 0; ty < lv.h; ty++) for (tx = 0; tx < lv.w; tx++) {
      x = tx * T; y = ty * T; c = ty % RH >= 16 ? (drawSol(tx, ty) ? '#' : '.') : lv.t[ty][tx];
      if (c === '#') {
        stoneTile(g, tx, ty);
        if (ty % RH >= 16) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y, T, T); }
      } else if (c === 'S') {
        g.fillStyle = '#0a0612'; g.fillRect(x, y, T, T);
        g.fillStyle = th.edge; g.fillRect(x, y, 1, T); g.fillRect(x + 7, y, 1, T);
        for (var s = 0; s < 4; s++) { g.fillStyle = '#9aa0b4'; g.fillRect(x + s * 2, y + 3, 2, 5); g.fillStyle = '#e8ecf5'; g.fillRect(x + s * 2, y + 3, 1, 4); g.fillStyle = '#cfd4e4'; g.fillRect(x + s * 2, y + 2, 1, 1); }
      }
    }
    for (tx = 0; tx < lv.w; tx++) for (ty = -2; ty < 0; ty++) { stoneTile(g, tx, ty); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(tx * T, ty * T, T, T); }
    lv.torches.forEach(function (t) {                                                  // brackets
      var x = t.tx * T, y = t.ty * T; g.fillStyle = '#5a4a3a'; g.fillRect(x + 3, y + 4, 2, 4); g.fillStyle = '#3a2a1a'; g.fillRect(x + 2, y + 3, 4, 2);
    });
    lv.cv = cv;
  }

  /* --------------------------------------------------------------- physics */
  function boxFree(x, y, hh) {
    var tx0 = Math.floor((x - HW + 0.01) / T), tx1 = Math.floor((x + HW - 0.01) / T), ty0 = Math.floor((y - hh) / T), ty1 = Math.floor((y - 0.01) / T), tx, ty;
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) if (solid(tx, ty)) return false;
    return true;
  }
  function moveX(e, dx, hh, step) {                         // returns true when blocked by a wall
    e.x += dx;
    var dir = dx > 0 ? 1 : -1, tc = Math.floor((e.x + dir * HW) / T), ty0 = Math.floor((e.y - hh) / T), ty1 = Math.floor((e.y - 0.01) / T), ty;
    for (ty = ty0; ty <= ty1; ty++) {
      if (solid(tc, ty)) {
        if (step && !e.air && boxFree(e.x, e.y - T, hh)) { e.y -= T; return false; }   // 1-tile step up
        e.x = dir > 0 ? tc * T - HW - 0.001 : (tc + 1) * T + HW + 0.001;
        return true;
      }
    }
    return false;
  }
  function supported(e) {
    var tx0 = Math.floor((e.x - SUP) / T), tx1 = Math.floor((e.x + SUP) / T), ty = Math.floor((e.y + 0.5) / T), tx;
    for (tx = tx0; tx <= tx1; tx++) if (solid(tx, ty)) return true;
    return false;
  }
  function groundCheck(e) {                                  // still standing? (also takes a 1-tile step down)
    if (supported(e)) return true;
    var oy = e.y; e.y += T;
    if (supported(e) && boxFree(e.x, e.y, HH)) return true;
    e.y = oy; return false;
  }
  function landY(e, oy) {
    var tx0 = Math.floor((e.x - SUP) / T), tx1 = Math.floor((e.x + SUP) / T), ty = Math.floor(e.y / T), tx;
    for (tx = tx0; tx <= tx1; tx++) if (solid(tx, ty) && oy <= ty * T + 0.01) return ty * T;
    return null;
  }

  /* -------------------------------------------------------------------- hero */
  function newHero(x, y, maxhp, hp) {
    return { x: x, y: y, vx: 0, vy: 0, face: 1, st: 'ground', t: 0, anim: 0, crouch: false, hp: hp, maxhp: maxhp, jt: '', apex: y, stun: 0, invuln: 0,
      duel: false, draw: 0, act: null, actT: 0, cd: 0, hit: false, foe: null, ledge: null, jbuf: 0, nograb: 0, dead: false, stepPh: 0, hangT: 0, ct: 0, from: null, flash: 0, dustT: 0 };
  }
  function readCtl() {
    var i = R.input, hd = i.held;
    return { ax: i.axisX(), up: hd.up, down: hd.down, a: hd.a, b: hd.b, pa: i.pressed('a'), pb: i.pressed('b'), pup: i.pressed('up'), pdown: i.pressed('down') };
  }
  function dust(x, y, n, spd) { burst(x, y, n || 4, ['#e8dcc0', '#bfae8a'], spd || 26, 0.3, -10, 1); }

  function heroStep(dt, c) {
    var h = hero;
    h.t += dt;
    if (h.invuln > 0) h.invuln -= dt;
    if (h.cd > 0) h.cd -= dt;
    if (h.nograb > 0) h.nograb -= dt;
    if (h.flash > 0) h.flash -= dt;
    if (c.pa || c.pup) h.jbuf = 0.1; else if (h.jbuf > 0) h.jbuf -= dt;
    switch (h.st) {
      case 'ground': hGround(dt, c); break;
      case 'air': hAir(dt, c); break;
      case 'hang': hHang(dt, c); break;
      case 'lower': hLower(dt); break;
      case 'climb': hClimb(dt); break;
      case 'dying': hDying(dt); break;
      case 'exit': hExit(dt); break;
    }
  }

  function startFall(h) { h.st = 'air'; h.jt = 'fall'; h.apex = h.y; h.crouch = false; h.act = null; h.duel = false; }
  function doJump(h, c) {
    var run = Math.abs(h.vx) > 40;
    h.jbuf = 0; h.crouch = false;
    if (run) { h.vx = h.face * 70; h.vy = -150; h.jt = 'run'; }
    else if (c.ax || Math.abs(h.vx) > 8) { if (c.ax) h.face = c.ax; h.vx = h.face * 42; h.vy = -176; h.jt = 'fwd'; }
    else { h.vx = 0; h.vy = -182; h.jt = 'up'; }
    h.st = 'air'; h.apex = h.y; h.t = 0;
    SND.jump(); dust(h.x, h.y, 3);
  }
  function ledgeAhead(h) {
    var f = h.face, cf = Math.floor((h.x + f * 5) / T), rb = Math.floor((h.y + 0.5) / T);
    if (solid(cf, rb) || !solid(cf - f, rb) || solid(cf, rb + 1) || solid(cf, rb - 1) || tileAt(cf, rb) === 'S') return null;
    return { xe: f > 0 ? cf * T : (cf + 1) * T, tx: cf - f, ty: rb };
  }
  function startLower(h, e) {
    h.st = 'lower'; h.ct = 0; h.crouch = false; h.vx = 0; h.jbuf = 0;
    h.from = { x: h.x, y: h.y, xt: e.xe + h.face * (HW + 1), yt: h.y + REACH };
    h.ledge = { tx: e.tx, ty: e.ty }; SND.climb();
  }
  function hLower(dt) {
    var h = hero, p = h.ct / 0.55, f = h.from;
    h.ct += dt;
    h.x = f.x + (f.xt - f.x) * ease(p * 1.4); h.y = f.y + (f.yt - f.y) * ease(p);
    if (h.ct >= 0.55) { h.x = f.xt; h.y = f.yt; h.face = -h.face; h.st = 'hang'; h.hangT = 0; h.jbuf = 0; SND.grab(); }
  }
  function tryGrab(h) {
    var f = h.face, cx = Math.floor((h.x + f * (HW + 4)) / T), hy = h.y - REACH, r0 = Math.floor((hy - 3) / T), r, d, e;
    for (r = r0; r <= r0 + 1; r++) {
      d = hy - r * T;
      if (d < -3 || d > 10) continue;
      if (!solid(cx, r) || solid(cx, r - 1) || solid(cx, r - 2) || solid(cx, r - 3)) continue;
      e = tileAt(cx, r); if (e === 'W') continue;
      var xe = f > 0 ? cx * T : (cx + 1) * T, nx = xe - f * (HW + 1), ny = r * T + REACH;
      if (!boxFree(nx, ny, HH) || tileAt(Math.floor(nx / T), r) === 'S') continue;
      h.x = nx; h.y = ny; h.vx = 0; h.vy = 0; h.st = 'hang'; h.hangT = 0; h.ledge = { tx: cx, ty: r }; h.jbuf = 0; h.crouch = false;
      SND.grab(); dust(xe, r * T, 3, 18);
      return true;
    }
    return false;
  }
  function hAir(dt, c) {
    var h = hero, oy = h.y, ty;
    h.vy = Math.min(MAXFALL, h.vy + GRAV * dt);
    if (h.vx && moveX(h, h.vx * dt, HH, false)) h.vx = 0;
    h.y += h.vy * dt;
    if (h.y < h.apex) h.apex = h.y;
    if (h.vy < 0) {
      ty = Math.floor((h.y - HH) / T);
      if (solid(Math.floor((h.x - HW + 0.6) / T), ty) || solid(Math.floor((h.x + HW - 0.6) / T), ty)) { h.y = (ty + 1) * T + HH; h.vy = 30; SND.land(false); }
    } else {
      var ly = landY(h, oy);
      if (ly !== null) { h.y = ly; hLand(h); return; }
    }
    if (h.nograb <= 0 && (h.jt !== 'fall' || c.up)) tryGrab(h);
  }
  function hLand(h) {
    var dist = h.y - h.apex;
    h.vy = 0; h.st = 'ground'; h.crouch = false; h.t = 0;
    if (dist <= 30) { if (dist > 12) { h.stun = 0.14; SND.land(false); } else SND.land(false); dust(h.x, h.y, 3); return; }
    if (dist <= 62) {
      h.stun = 0.5; SND.land(true); dust(h.x, h.y, 7, 40); R.fx.shake(1.5, 0.15);
      hurtHero(1, h.x, 'fall'); if (hero.st === 'dying') return;
      h.stun = 0.5; return;
    }
    SND.land(true); killHero('fall');
  }
  function hHang(dt, c) {
    var h = hero;
    h.hangT += dt;
    if (!solid(h.ledge.tx, h.ledge.ty)) { dropHang(h); return; }
    if (c.pup || c.pa) { startClimb(h); return; }
    if (c.pdown || c.pb) dropHang(h);
  }
  function dropHang(h) { h.st = 'air'; h.vx = 0; h.vy = 0; h.jt = 'fall'; h.apex = h.y; h.nograb = 0.45; }
  function startClimb(h) {
    h.st = 'climb'; h.ct = 0; h.jbuf = 0;
    h.from = { x: h.x, y: h.y, xt: h.ledge.tx * T + 4, yt: h.ledge.ty * T };
    SND.climb();
  }
  function hClimb(dt) {
    var h = hero, f = h.from, p;
    h.ct += dt; p = h.ct / 0.62;
    if (p < 0.7) { h.y = f.y + (f.yt - f.y) * ease(p / 0.7); h.x = f.x; }
    else { h.y = f.yt; h.x = f.x + (f.xt - f.x) * ease((p - 0.7) / 0.3); }
    if (h.ct >= 0.62) { h.x = f.xt; h.y = f.yt; h.st = 'ground'; h.vx = 0; h.jbuf = 0; h.stun = 0; dust(h.x, h.y, 3); }
  }
  function hDying(dt) {
    var h = hero;
    h.ct += dt;
    if (h.vy !== 0 || !supported(h)) {
      h.vy = Math.min(MAXFALL, h.vy + GRAV * dt); var oy = h.y; h.y += h.vy * dt;
      var ly = landY(h, oy); if (ly !== null) { h.y = ly; h.vy = 0; }
    }
    if (h.vx) { moveX(h, h.vx * dt, 8, false); h.vx = approach(h.vx, 0, 300 * dt); }
  }
  function hExit(dt) {
    var h = hero, d = lv.exit;
    h.ct += dt; h.x = approach(h.x, d.x, 22 * dt); h.anim += dt * 1.4; h.vx = 22 * sgn(d.x - h.x); h.face = sgn(d.x - h.x) || h.face;
  }

  function touchFloor(h) {
    var tx = Math.floor(h.x / T), ty = Math.floor((h.y + 0.5) / T), c = tileAt(tx, ty);
    if (c === 'L') { lv.t[ty][tx] = 'l'; loose.push({ tx: tx, ty: ty, t: 0.55 }); SND.crack(); dust(tx * T + 4, ty * T, 3, 18); }
    else if (c >= '1' && c <= '4') pressPlate(c.charCodeAt(0) - 49, tx, ty);
  }
  function pressPlate(i, tx, ty) {
    var g = gates[i];
    lv.plateOn = lv.plateOn || {}; lv.plateOn[tx + ',' + ty] = 0.2;
    if (!g) return;
    if (g.timer <= 0 && g.open < 0.99) { SND.plate(); SND.gateUp(); burst(tx * T + 4, ty * T, 6, ['#ffe27a', '#ffffff'], 30, 0.4, 0, 1); floatText(g.tx * T + 4, (g.ty - 3) * T, 'CLANK', '#ffe27a'); }
    g.timer = GATE_TIME;
  }

  function findFoe() {
    var best = null, bd = 999, i, g, d;
    for (i = 0; i < guards.length; i++) {
      g = guards[i];
      if (g.st === 'dead' || !g.alert || g.air || Math.abs(g.y - hero.y) > 10) continue;
      d = Math.abs(g.x - hero.x);
      if (d < bd) { bd = d; best = g; }
    }
    return best && bd < (hero.duel ? 50 : 32) ? best : null;
  }
  function hGround(dt, c) {
    var h = hero, ax = c.ax, tv, acc, blocked, f;
    if (!groundCheck(h)) { startFall(h); return; }
    touchFloor(h);
    f = findFoe();
    if (f && !h.duel) { h.duel = true; h.draw = 0.28; h.foe = f; h.vx = 0; h.act = null; h.face = sgn(f.x - h.x) || h.face; SND.draw(); }
    else if (!f && h.duel) { h.duel = false; h.act = null; }
    if (h.duel) h.foe = f;
    if (h.stun > 0) {
      h.stun -= dt; h.vx = approach(h.vx, 0, 700 * dt);
      if (h.vx) moveX(h, h.vx * dt, HH, false);
      return;
    }
    if (h.duel) { hDuel(dt, c); return; }
    h.crouch = !!c.down;
    if (c.pdown) { var e = ledgeAhead(h); if (e) { startLower(h, e); return; } }
    if (h.jbuf > 0) { doJump(h, c); return; }
    tv = 0;
    if (ax) { h.face = ax; tv = ax * (h.crouch ? CREEP : (c.b ? RUN : WALK)); }
    acc = (Math.abs(tv) > Math.abs(h.vx) && Math.abs(h.vx) >= WALK - 1 && !h.crouch) ? 150 : 460;
    h.vx = approach(h.vx, tv, acc * dt);
    if (h.vx) {
      blocked = moveX(h, h.vx * dt, h.crouch ? HHC : HH, true);
      if (blocked) h.vx = 0;
      var oph = Math.floor(h.stepPh);
      h.anim += Math.abs(h.vx) * dt / (Math.abs(h.vx) > 40 ? 17 : 13);
      h.stepPh += Math.abs(h.vx) * dt / (Math.abs(h.vx) > 40 ? 8.5 : 6.5);
      if (Math.floor(h.stepPh) !== oph && !h.crouch) { SND.step(Math.abs(h.vx) > 40); if (Math.abs(h.vx) > 40) dust(h.x - h.face * 2, h.y, 1, 12); }
    }
    if (!groundCheck(h)) startFall(h);
  }

  /* ------------------------------------------------------------------ combat */
  function hDuel(dt, c) {
    var h = hero, g = h.foe, dir = sgn(g.x - h.x) || h.face, ax = c.ax, mv, i;
    h.face = dir; h.crouch = false;
    if (h.draw > 0) { h.draw -= dt; h.vx = approach(h.vx, 0, 600 * dt); return; }
    if (h.act) {
      h.actT += dt;
      if (h.act === 'strike') {
        if (h.actT > 0.08 && h.actT < 0.2) moveX(h, dir * 26 * dt, HH, false);
        if (!h.hit && h.actT >= 0.12) { h.hit = true; heroStrikeHit(g, dir); }
        if (h.actT >= 0.46) { h.act = null; }
      } else if (h.act === 'parry') {
        if (h.actT >= 0.5) { h.act = null; h.cd = 0.18; }
      } else if (h.act === 'recoil') {
        if (h.actT >= 0.3) h.act = null;
      }
      return;
    }
    if (c.pa && h.cd <= 0) {
      h.act = 'strike'; h.actT = 0; h.hit = false; SND.swing();
      for (i = 0; i < guards.length; i++) {
        var gg = guards[i];
        if (gg.st !== 'dead' && !gg.act && !gg.air && Math.abs(gg.x - h.x) < 22 && rnd() < GK[gg.k].par) { gg.act = 'parry'; gg.actT = 0; }
      }
      return;
    }
    if (c.pb && h.cd <= 0) { h.act = 'parry'; h.actT = 0; R.sfx.tone(700, 0.04, { type: 'triangle', vol: 0.05 }); return; }
    mv = ax * dir;
    if (mv !== 0) {
      var spd = mv > 0 ? 24 : 20, nx = Math.abs(g.x - (h.x + ax * spd * dt));
      if (mv < 0 || nx > 10) moveX(h, ax * spd * dt, HH, false);
      h.anim += dt * 1.6 * (mv > 0 ? 1 : -1);
    }
    if (!groundCheck(h)) startFall(h);
  }
  function heroStrikeHit(g, dir) {
    var h = hero;
    if (g.st === 'dead' || Math.abs(g.x - h.x) > 17 || g.air) { return; }
    if (g.act === 'parry' && g.actT < 0.42) {
      SND.clang(); burst((h.x + g.x) / 2, h.y - 11, 8, ['#ffffff', '#ffe27a'], 50, 0.25, 0, 1); R.vibrate(12);
      h.act = 'recoil'; h.actT = 0; moveX(h, -dir * 4, HH, false); g.think = 0.05;
      return;
    }
    damageGuard(g, 1, dir);
  }
  function damageGuard(g, n, dir) {
    var K = GK[g.k];
    g.hp -= n; g.flash = 0.12;
    SND.clang(); R.sfx.play('hit'); R.vibrate(24);
    burst(g.x, g.y - 10, 10, ['#ffffff', '#ffe27a', '#ff7a3a'], 70, 0.35, 120, 1);
    R.fx.shake(1.5, 0.12);
    if (g.hp <= 0) {
      g.st = 'dead'; g.act = null; g.dt = 0; g.vx = dir * 40;
      kills++; R.addScore(K.pts); floatText(g.x, g.y - 24, '+' + K.pts, '#ffd23a');
      R.sfx.tone(180, 0.35, { type: 'sawtooth', vol: 0.1, slide: 45 }); R.vibrate(45);
      burst(g.x, g.y - 8, 14, ['#ffffff', '#c0b090', '#ffd23a'], 80, 0.5, 150, 2);
      if (kills >= 5) R.achieve('duelist');
    } else if (g.act !== 'windup') {
      g.act = 'stagger'; g.actT = 0; g.stagT = 0.3; g.vx = dir * 50;
    } else g.vx = dir * 20;
  }
  function guardStrike(g) {
    var h = hero, dir = sgn(h.x - g.x) || g.face, K = GK[g.k], d = Math.abs(h.x - g.x);
    SND.swing();
    if (d > 17 || Math.abs(h.y - g.y) > 10 || h.st !== 'ground' || h.dead) return;
    if (h.act === 'parry' && h.actT < 0.36) {
      SND.clang(); burst((h.x + g.x) / 2, h.y - 11, 10, ['#ffffff', '#ffe27a'], 55, 0.28, 0, 1); R.vibrate(16); R.fx.flash('#ffffff', 0.05);
      g.act = 'stagger'; g.actT = 0; g.stagT = 0.8; g.vx = dir * -30;
      parries++; floatText(h.x, h.y - 26, 'PARRY!', '#7fe0ff'); R.addScore(20);
      if (parries >= 5) R.achieve('riposte');
      return;
    }
    if (h.invuln > 0) return;
    hurtHero(1, g.x, 'blade');
  }
  function hurtHero(n, fromX, why) {
    var h = hero;
    if (h.dead || h.st === 'dying') return;
    h.hp -= n; R.lives = Math.max(0, h.hp); h.invuln = 0.7; h.flash = 0.12;
    SND.clang(); R.sfx.play('hit'); R.vibrate(60); R.fx.shake(2.5, 0.2); R.fx.flash('#ff2040', 0.1);
    burst(h.x, h.y - 10, 12, ['#ff3d5e', '#ffd0a8', '#ffffff'], 70, 0.45, 160, 2);
    if (h.hp <= 0) { killHero(why); return; }
    h.act = 'recoil'; h.actT = 0; h.stun = Math.max(h.stun, 0.34); h.vx = sgn(h.x - fromX) * 62; h.hit = true;
  }
  function killHero(why) {
    var h = hero;
    if (h.st === 'dying') return;
    h.hp = 0; R.lives = 0; h.st = 'dying'; h.ct = 0; h.dead = true; h.duel = false; h.act = null; h.vx = h.vx * 0.3;
    phase = 'dying'; phaseT = 0; deaths++; deathWhy = why;
    R.sfx.play('lose'); R.vibrate(120); R.fx.shake(3, 0.3);
    if (why !== 'fall') burst(h.x, h.y - 9, 18, ['#ff3d5e', '#f6c096', '#ffffff'], 90, 0.7, 170, 2);
  }

  /* ------------------------------------------------------------------ guards */
  function makeGuard(s) {
    var g = { k: s.k, x: s.x, y: s.y, vx: 0, vy: 0, face: -1, hp: GK[s.k].hp, maxhp: GK[s.k].hp, st: 'patrol', alert: false, act: null, actT: 0, stagT: 0, think: 0.5, air: false, apex: s.y, t: hash(s.x) * 5, anim: 0,
      wait: 0, dt: 0, lost: 0, flash: 0, x0: s.x, x1: s.x, sx: s.x, back: 0, aggr: 0 };
    var d, dir;
    for (dir = -1; dir <= 1; dir += 2) { d = 0; while (d < 52 && canWalk(g, dir, g.sx + dir * d)) d += 4; if (dir < 0) g.x0 = g.sx - Math.max(0, d - 4); else g.x1 = g.sx + Math.max(0, d - 4); }
    g.face = rnd() < 0.5 ? -1 : 1;
    return g;
  }
  function canWalk(g, dir, x) {
    var nx = (x == null ? g.x : x) + dir * (HW + 2), tc = Math.floor(nx / T), row = Math.floor((g.y + 0.5) / T);
    if (!solid(tc, row) || solid(tc, row - 1) || solid(tc, row - 2)) return false;
    var c = tileAt(tc, row); if (c === 'L' || c === 'l') return false;
    return true;
  }
  function clearLine(a, b) {
    var x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), x, ty = Math.floor((a.y - 8) / T);
    for (x = x0; x <= x1; x += 4) if (solid(Math.floor(x / T), ty)) return false;
    return true;
  }
  function guardUpdate(g, dt) {
    var h = hero, K = GK[g.k], dx = h.x - g.x, adx = Math.abs(dx), dir = sgn(dx) || g.face, i;
    g.t += dt; if (g.flash > 0) g.flash -= dt;
    if (g.st === 'dead') {
      g.dt += dt;
      if (g.vx) { moveX(g, g.vx * dt, 6, false); g.vx = approach(g.vx, 0, 160 * dt); }
      if (!g.air && !supported(g)) { g.air = true; g.vy = 0; }
      if (g.air) { g.vy += GRAV * dt; var o2 = g.y; g.y += g.vy * dt; var l2 = landY(g, o2); if (l2 !== null) { g.y = l2; g.air = false; } }
      return;
    }
    if (!g.air && !supported(g)) { g.air = true; g.vy = 0; g.apex = g.y; }
    if (g.air) {
      g.vy = Math.min(MAXFALL, g.vy + GRAV * dt); var oy = g.y; g.y += g.vy * dt;
      var ly = landY(g, oy);
      if (ly !== null) { g.y = ly; g.air = false; if (g.y - g.apex > 40) { g.hp = 0; g.st = 'dead'; g.dt = 0; g.act = null; kills++; R.addScore(K.pts); R.sfx.play('hit'); burst(g.x, g.y - 8, 10, ['#ffffff', '#c0b090'], 60, 0.4, 140, 2); if (kills >= 5) R.achieve('duelist'); } }
      else if (g.y > lv.h * T + 30) { g.st = 'dead'; g.dt = 9; }
      return;
    }
    if (g.vx) { moveX(g, g.vx * dt, 10, false); g.vx = approach(g.vx, 0, 200 * dt); }
    var same = Math.abs(h.y - g.y) < 12 && !h.dead && h.st !== 'exit';
    var sees = same && adx < (dir === g.face ? 66 : 26) && clearLine(g, h);
    if (sees) { if (!g.alert) { g.alert = true; g.think = Math.min(g.think, 0.15); floatText(g.x, g.y - 24, '!', '#ff5a5a'); R.sfx.tone(520, 0.08, { type: 'square', vol: 0.05, slide: 780 }); } g.lost = 0; }
    else if (g.alert) { g.lost += dt; if (g.lost > 2.2 || (same && adx > 120)) { g.alert = false; g.act = null; } }
    if (g.act) {
      g.actT += dt;
      if (g.act === 'windup') { if (g.actT >= K.wind) { g.act = 'strike'; g.actT = 0; g.hit = false; guardStrike(g); moveX(g, g.face * 3, 10, false); } }
      else if (g.act === 'strike') { if (g.actT >= 0.12) { g.act = 'recover'; g.actT = 0; } }
      else if (g.act === 'recover') { if (g.actT >= 0.4) { g.act = null; g.think = K.thk * 0.5 + rnd() * K.thk; } }
      else if (g.act === 'parry') { if (g.actT >= 0.42) { g.act = null; g.think = 0.1; } }
      else if (g.act === 'stagger') { if (g.actT >= g.stagT) { g.act = null; g.think = 0.04 + rnd() * K.thk * 0.4; g.aggr = 0.25; } }
      return;
    }
    if (!g.alert) {                                                                     // patrol
      if (g.wait > 0) { g.wait -= dt; g.vxw = 0; return; }
      var sp = K.spd * dt * g.face;
      if ((g.face > 0 && g.x >= g.x1) || (g.face < 0 && g.x <= g.x0) || !canWalk(g, g.face)) { g.face = -g.face; g.wait = 0.7 + rnd() * 0.9; return; }
      moveX(g, sp, 10, false); g.anim += Math.abs(sp) / 12;
      return;
    }
    g.face = dir;
    if (h.st === 'hang' || h.st === 'climb' || h.st === 'lower') return;
    if (adx > 16) {                                                                     // close in
      if (canWalk(g, dir)) { var cs = K.chase * dt * dir; moveX(g, cs, 10, false); g.anim += Math.abs(cs) / 12; }
      return;
    }
    if (g.back > 0) { g.back -= dt; if (canWalk(g, -dir)) moveX(g, -dir * 16 * dt, 10, false); return; }
    g.think -= dt;
    if (g.think > 0) return;
    var r = rnd();
    if (h.act === 'strike' && h.actT < 0.12 && r < K.par * 1.6) { g.act = 'parry'; g.actT = 0; }
    else if (r < K.agg + g.aggr) { g.act = 'windup'; g.actT = 0; g.aggr = 0; R.sfx.tone(300, K.wind, { type: 'triangle', vol: 0.04, slide: 600 }); }
    else if (r < K.agg + g.aggr + 0.2) { g.back = 0.25; g.think = 0.3; g.aggr = 0; }
    else g.think = K.thk * 0.6 + rnd() * K.thk * 0.8;
  }

  /* ------------------------------------------------------------------ world */
  function burst(x, y, n, cols, sp, life, grav, size) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.2832, s = sp * (0.3 + Math.random() * 0.7);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.2, g: grav || 0, life: life * (0.6 + Math.random() * 0.4), max: life, size: size || 1, col: cols[(Math.random() * cols.length) | 0] });
    }
    if (parts.length > 220) parts.splice(0, parts.length - 220);
  }
  function floatText(x, y, s, col) { texts.push({ x: x, y: y, s: s, col: col, t: 0.9 }); }
  function updateParts(dt) {
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) { p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (i = texts.length - 1; i >= 0; i--) { p = texts[i]; p.t -= dt; p.y -= 12 * dt; if (p.t <= 0) texts.splice(i, 1); }
    for (i = debris.length - 1; i >= 0; i--) { p = debris[i]; p.vy += 500 * dt; p.y += p.vy * dt; p.rot += dt * 3; if (p.y > lv.h * T + 30) debris.splice(i, 1); }
  }
  function slicerClose(s) {                               // 0 open ... 1 closed
    var P = 2.6, ph = (wtime + s.tx * 0.9) % P;
    if (ph < 1.5) return 0; if (ph < 1.75) return (ph - 1.5) / 0.25; if (ph < 2.2) return 1; return 1 - (ph - 2.2) / 0.4;
  }
  function plateUp(w) { var ph = (wtime + w.tx * 0.7) % 3; return ph < 1.7 ? 0 : ph < 2.2 ? 0.35 : 1; }
  function updateWorld(dt) {
    var i, g, k;
    for (i = loose.length - 1; i >= 0; i--) {
      k = loose[i]; k.t -= dt;
      if (k.t <= 0) {
        lv.t[k.ty][k.tx] = '.'; debris.push({ x: k.tx * T + 4, y: k.ty * T + 4, vy: 0, rot: 0, tx: k.tx, ty: k.ty });
        SND.crumble(); burst(k.tx * T + 4, k.ty * T + 4, 10, ['#8fa4e6', '#59689a', '#c6d4ff'], 40, 0.5, 160, 1); loose.splice(i, 1);
      }
    }
    for (i = 0; i < 4; i++) {
      g = gates[i]; if (!g) continue;
      if (g.timer > 0) g.timer -= dt;
      if (g.timer > 0 && g.open < 1) g.open = Math.min(1, g.open + dt * 2.4);
      else if (g.timer <= 0 && g.open > 0) {
        if (gateBlocked(g)) g.timer = 0.25;
        else { g.open = Math.max(0, g.open - dt * 1.1); if (g.open === 0) { SND.slam(); R.fx.shake(1.2, 0.1); } }
      }
    }
    if (lv.plateOn) for (var key in lv.plateOn) { lv.plateOn[key] -= dt; if (lv.plateOn[key] <= 0) delete lv.plateOn[key]; }
    for (i = 0; i < lv.slicers.length; i++) {            // cue: audible clack when a nearby jaw starts to close
      var s = lv.slicers[i], prev = s.c || 0, now = slicerClose(s); s.c = now;
      if (prev < 0.5 && now >= 0.5 && Math.abs(s.x - hero.x) < 110 && Math.abs(s.y - hero.y) < 60) { SND.snap(); }
    }
  }
  function gateBlocked(g) {
    var cx = g.tx * T + 4, y0 = (g.ty - 3) * T, y1 = (g.ty + 1) * T, ents = [hero].concat(guards), i, e;
    for (i = 0; i < ents.length; i++) { e = ents[i]; if (e.st === 'dead') continue; if (Math.abs(e.x - cx) < 8 && e.y > y0 && e.y - 18 < y1) return true; }
    return false;
  }
  function hazards() {
    var h = hero, i, s, tx, ty, c;
    if (h.st === 'dying' || h.st === 'exit' || phase !== 'play') return;
    // spike pits
    tx = Math.floor(h.x / T);
    if (h.st !== 'hang' && h.st !== 'climb' && h.st !== 'lower') {
      for (var dx = -1; dx <= 1; dx++) {
        ty = Math.floor((h.y - 1) / T);
        if (tileAt(tx + dx, ty) === 'S' && h.y > ty * T + 3 && Math.abs(h.x - ((tx + dx) * T + 4)) < 6) { impale('spikes'); return; }
        if (tileAt(tx + dx, ty + 1) === 'S' && h.y > (ty + 1) * T + 3 && Math.abs(h.x - ((tx + dx) * T + 4)) < 6) { impale('spikes'); return; }
      }
    }
    // spike plates
    ty = Math.floor((h.y + 0.5) / T);
    if (h.st === 'ground' || h.st === 'air') {
      for (i = 0; i < 3; i++) {
        c = tileAt(tx - 1 + i, ty);
        if (c === 'W' && plateUp({ tx: tx - 1 + i }) >= 1 && Math.abs(h.y - ty * T) < 3 && Math.abs(h.x - ((tx - 1 + i) * T + 4)) < 6) { impale('spikes'); return; }
      }
    }
    // blade gates
    for (i = 0; i < lv.slicers.length; i++) {
      s = lv.slicers[i];
      if (slicerClose(s) > 0.65 && Math.abs(h.x - s.x) < 3 + HW && h.y > s.y - 24 && h.y - (h.crouch ? HHC : HH) < s.y) {
        burst(h.x, h.y - 9, 20, ['#ff3d5e', '#ffd0a8', '#ffffff', '#c8ccd8'], 100, 0.7, 160, 2); R.fx.shake(3, 0.3);
        killHero('slice'); return;
      }
    }
    if (h.y > lv.h * T + 24) killHero('fall');
  }
  function impale(why) {
    var h = hero;
    burst(h.x, h.y - 6, 18, ['#ff3d5e', '#ffd0a8', '#ffffff', '#c8ccd8'], 90, 0.6, 160, 2); R.fx.shake(3, 0.3);
    killHero(why);
  }

  /* --------------------------------------------------------------- game flow */
  function startLevel(i, retry) {
    levelIdx = i; lv = parseLevel(LEVELS[i]); th = THEMES[lv.def.theme];
    buildStatic();
    gates = lv.gates; items = lv.items; loose = []; debris = []; parts = []; texts = [];
    guards = lv.guards.map(makeGuard);
    hero = newHero(lv.spawn.x, lv.spawn.y, lvMax, lvMax);
    lvHp = lvMax;
    hintDone = {}; hintT = 0; hintText = '';
    snapCamera();
    banner = 2.6; phase = 'play'; phaseT = 0; fade = 1;
    R.level = i + 1; R.lives = hero.hp;
    if (retry) banner = 1.6;
  }
  function snapCamera() {
    var c = camTarget(); camX = c[0]; camY = c[1];
  }
  function camTarget() {
    var rx = U.clamp(Math.floor(hero.x / RPW), 0, lv.nrx - 1), ry = U.clamp(Math.floor((hero.y - 9) / RPH), 0, lv.nry - 1);
    return [rx * RPW, ry * RPH - (ry === 0 && hero.y < 60 ? 16 : 0)];     // top row: show a little ceiling while on the upper floor
  }

  function levelClear() {
    var d = lv.exit, bonus = 500 + Math.floor(timeLeft);
    phase = 'clear'; phaseT = 0; hero.st = 'exit'; hero.ct = 0; hero.vx = 0; hero.duel = false; hero.act = null; hero.crouch = false;
    R.addScore(bonus); R.sfx.play('win'); R.vibrate(40);
    floatText(d.x, d.y - 34, '+' + bonus, '#ffd23a');
    burst(d.x, d.y - 12, 24, ['#ffe27a', '#ffffff', '#ffb23e'], 80, 0.8, 40, 2);
    if (levelIdx === 0) R.achieve('first-escape');
    if (levelIdx === LEVELS.length - 1) R.achieve('free-at-last');
  }

  function updatePlay(dt) {
    var i, h = hero;
    updateWorld(dt);
    if (phase === 'play' || phase === 'dying') heroStep(dt, readCtl());
    if (phase === 'play') for (i = 0; i < guards.length; i++) {
      if (Math.abs(guards[i].x - h.x) < RPW * 1.3 || guards[i].alert) guardUpdate(guards[i], dt);
    } else for (i = 0; i < guards.length; i++) if (guards[i].st === 'dead') guardUpdate(guards[i], dt);
    if (phase !== 'play') return;
    hazards();
    if (phase !== 'play') return;
    // pickups
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.got || Math.abs(it.x - h.x) > 6 || Math.abs(it.y - (h.y - 9)) > 11) continue;
      if (it.k === 'h') {
        if (h.hp >= h.maxhp) continue;
        it.got = true; h.hp = Math.min(h.maxhp, h.hp + 1); R.addScore(50); floatText(it.x, it.y - 10, '+1 HP', '#ff8fa8');
      } else {
        it.got = true; h.maxhp++; h.hp = h.maxhp; lvMax = h.maxhp; R.addScore(150); floatText(it.x, it.y - 10, 'MAX HP+1', '#7fcfff'); R.fx.flash('#7fcfff', 0.12);
      }
      R.lives = h.hp; R.sfx.play('powerup'); R.vibrate(25);
      burst(it.x, it.y, 14, it.k === 'h' ? ['#ff3d6e', '#ffc0d0', '#ffffff'] : ['#2f9bff', '#c8ecff', '#ffd23a'], 60, 0.6, 0, 2);
    }
    // hints
    for (i = 0; i < lv.hints.length; i++) {
      var ht = lv.hints[i];
      if (!hintDone[i] && Math.abs(h.x - ht.tx * T) < 12 && h.st === 'ground') { hintDone[i] = true; hintText = ht.text; hintT = 3.4; }
    }
    // exit
    if (lv.exit && h.st === 'ground' && Math.abs(h.x - lv.exit.x) < 5 && Math.abs(h.y - lv.exit.y) < 3) levelClear();
  }

  function updateTimer(dt) {
    timeLeft -= dt;
    var s = Math.ceil(timeLeft);
    if (s <= 60 && s !== lastWarn && (s === 60 || s === 30 || s <= 10) && s > 0) { lastWarn = s; SND.warn(); hudFlash = 0.3; }
    if (timeLeft <= 0) { timeLeft = 0; phase = 'timeup'; phaseT = 0; hero.duel = false; R.sfx.play('lose'); R.vibrate(80); }
  }

  function updateCamera(dt) {
    var t = camTarget(), k = Math.min(1, dt * 11);
    camX += (t[0] - camX) * k; camY += (t[1] - camY) * k;
    if (Math.abs(t[0] - camX) < 0.3) camX = t[0];
    if (Math.abs(t[1] - camY) < 0.3) camY = t[1];
  }

  /* ----------------------------------------------------------------- drawing */
  function drawLooseTile(ctx, tx, ty, shake, crack) {
    var ox = shake ? Math.round(Math.sin(wtime * 60 + tx) * 0.9) : 0, oy = shake ? Math.round(Math.sin(wtime * 47) * 0.6) : 0;
    stoneTile(ctx, tx, ty, ox, oy);
    var x = tx * T + ox, y = ty * T + oy;
    ctx.fillStyle = th.edge; ctx.fillRect(x + 2, y + 2, 1, 2); ctx.fillRect(x + 3, y + 4, 1, 2); ctx.fillRect(x + 5, y + 3, 1, 2);
    if (shake) { ctx.fillRect(x + 4, y + 1, 1, 3); ctx.fillRect(x + 1, y + 5, 2, 1); }
  }
  function drawDynamic(ctx, x0, x1, y0, y1) {
    var i, k, tx, ty, c, ty0 = Math.max(0, Math.floor(y0 / T)), ty1 = Math.min(lv.h - 1, Math.floor(y1 / T)), tx0 = Math.max(0, Math.floor(x0 / T)), tx1 = Math.min(lv.w - 1, Math.floor(x1 / T));
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
      c = lv.t[ty][tx];
      if (c === 'L') drawLooseTile(ctx, tx, ty, false);
      else if (c === 'l') drawLooseTile(ctx, tx, ty, true);
      else if (c === 'W') {
        stoneTile(ctx, tx, ty);
        var up = plateUp({ tx: tx }), x = tx * T, y = ty * T;
        ctx.fillStyle = th.edge; ctx.fillRect(x + 1, y, 6, 1);
        if (up > 0) for (k = 0; k < 3; k++) { ctx.fillStyle = '#9aa0b4'; ctx.fillRect(x + 1 + k * 2, y - Math.round(up * 6), 1, Math.round(up * 6)); ctx.fillStyle = '#e8ecf5'; ctx.fillRect(x + 1 + k * 2, y - Math.round(up * 6), 1, 1); }
        if (up === 0) { ctx.fillStyle = '#000'; ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1); ctx.fillRect(x + 6, y, 1, 1); }
      } else if (c >= '1' && c <= '4') {
        var on = lv.plateOn && lv.plateOn[tx + ',' + ty], px = tx * T, py = ty * T;
        stoneTile(ctx, tx, ty);
        ctx.fillStyle = th.edge; ctx.fillRect(px + 1, py, 6, 2 + (on ? 0 : 0));
        ctx.fillStyle = on ? '#d9a020' : '#ffd23a'; ctx.fillRect(px + 2, py + (on ? 1 : 0), 4, on ? 1 : 2);
      }
    }
    // torches
    for (i = 0; i < lv.torches.length; i++) {
      var t = lv.torches[i], fx = t.tx * T, fy = t.ty * T, fl = Math.floor(wtime * 10 + t.tx) % 3;
      if (fx < x0 - 16 || fx > x1 + 16 || fy < y0 - 16 || fy > y1 + 16) continue;
      ctx.fillStyle = '#ff7a1a'; ctx.fillRect(fx + 3, fy - (fl === 1 ? 1 : 0), 2, 4); ctx.fillStyle = '#ffd23a'; ctx.fillRect(fx + 3, fy + (fl === 0 ? 1 : 2), 2, 2);
      ctx.globalAlpha = fl ? 0.85 : 1; ctx.drawImage(S.glow, fx + 4 - 24, fy + 2 - 24); ctx.globalAlpha = 1;
    }
    // exit door + entry arch
    if (lv.exit) drawDoor(ctx, lv.exit.x, lv.exit.y, true);
    drawDoor(ctx, lv.spawn.x, lv.spawn.y, false);
    // blade gates
    for (i = 0; i < lv.slicers.length; i++) drawSlicer(ctx, lv.slicers[i]);
    // gates
    for (i = 0; i < 4; i++) if (gates[i]) drawGate(ctx, gates[i]);
    // items
    for (i = 0; i < items.length; i++) {
      var it = items[i]; if (it.got) continue;
      var spr = it.k === 'h' ? S.potion : S.big, by = Math.round(it.y + 5 - spr.height + Math.sin(wtime * 4 + it.x) * 1);
      ctx.globalAlpha = 0.18 + 0.1 * Math.sin(wtime * 5); ctx.fillStyle = it.k === 'h' ? '#ff6a8a' : '#6ac0ff'; ctx.beginPath(); ctx.arc(it.x, by + 4, 9, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      R.draw.sprite(ctx, spr, Math.round(it.x - spr.width / 2), by);
    }
    // debris
    for (i = 0; i < debris.length; i++) { var d = debris[i]; ctx.fillStyle = th.stone; ctx.fillRect(Math.round(d.x - 3), Math.round(d.y - 3), 6, 6); ctx.fillStyle = th.stoneDk; ctx.fillRect(Math.round(d.x - 3), Math.round(d.y + 2), 6, 1); }
  }
  function drawDoor(ctx, x, y, exit) {
    var open = exit ? U.clamp(1 - (Math.abs(hero.x - x) - 12) / 30, 0, 1) : 0, hw = 7;
    archFill(ctx, x, y - 25, hw + 2, 25, exit ? '#6b5530' : th.trim);
    archFill(ctx, x, y - 24, hw, 24, exit ? '#2a1c0e' : '#06080f');
    if (exit) {
      var gl = 0.5 + 0.5 * open;
      ctx.globalAlpha = gl; archFill(ctx, x, y - 24, hw, 24, '#ffe9a0'); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff8d8'; ctx.fillRect(x - 3, y - 14, 6, 14);
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(x - hw - 2, y - 2, hw * 2 + 4, 2);
      ctx.globalAlpha = 0.8 + 0.2 * Math.sin(wtime * 3); ctx.drawImage(S.glow, x - 24, y - 12 - 24); ctx.drawImage(S.glow, x - 24, y - 12 - 24); ctx.globalAlpha = 1;
    } else { ctx.fillStyle = th.trim; ctx.fillRect(x - hw - 2, y - 2, hw * 2 + 4, 2); }
  }
  function drawSlicer(ctx, s) {
    var c = slicerClose(s), x = s.tx * T, fy = s.y, top = fy - 40, mid = fy - 12, tipU = top + 12 + c * (mid - top - 12), tipL = fy - c * 12, i, hot = c > 0.02;
    ctx.fillStyle = '#0a0a16'; ctx.fillRect(x + 1, fy, 6, 2);                         // floor slot
    // overhead housing with hazard stripes + lamp
    ctx.fillStyle = '#2a2236'; ctx.fillRect(x, top, T, 5); ctx.fillStyle = '#ffcf3a'; ctx.fillRect(x, top + 3, 2, 2); ctx.fillRect(x + 4, top + 3, 2, 2);
    ctx.fillStyle = hot ? (c > 0.9 ? '#ffffff' : '#ff4a4a') : '#6a2a3a'; ctx.fillRect(x + 3, top + 1, 2, 2);
    // upper jaw: rod, head, teeth
    ctx.fillStyle = '#5a6076'; ctx.fillRect(x + 3, top + 5, 2, tipU - 6 - top - 5 + 1);
    ctx.fillStyle = '#b8bfd2'; ctx.fillRect(x + 1, tipU - 6, 6, 4); ctx.fillStyle = '#e8ecf5'; ctx.fillRect(x + 1, tipU - 6, 6, 1); ctx.fillStyle = '#10142a'; ctx.fillRect(x, tipU - 7, 1, 5); ctx.fillRect(x + 7, tipU - 7, 1, 5);
    for (i = 0; i < 3; i++) { ctx.fillStyle = '#e8ecf5'; ctx.fillRect(x + 1 + i * 2, tipU - 2, 2, 1); ctx.fillStyle = '#c8ccd8'; ctx.fillRect(x + 1 + i * 2 + (i === 1 ? 0 : 0), tipU - 1, 1, 1); ctx.fillRect(x + 1 + i * 2, tipU - 1, 2, 1); }
    // lower jaw: head rising from the floor
    if (c > 0.05) {
      ctx.fillStyle = '#5a6076'; ctx.fillRect(x + 1, tipL + 3, 6, fy - tipL - 3);
      for (i = 0; i < 3; i++) { ctx.fillStyle = '#e8ecf5'; ctx.fillRect(x + 1 + i * 2, tipL, 2, 1); ctx.fillStyle = '#c8ccd8'; ctx.fillRect(x + 1 + i * 2, tipL + 1, 2, 2); }
      ctx.fillStyle = '#10142a'; ctx.fillRect(x, tipL + 1, 1, fy - tipL - 1); ctx.fillRect(x + 7, tipL + 1, 1, fy - tipL - 1);
    } else { ctx.fillStyle = '#9aa0b4'; for (i = 0; i < 3; i++) ctx.fillRect(x + 1 + i * 2, fy - 1, 1, 1); }
    if (c > 0.85) { ctx.globalAlpha = 0.55; ctx.fillStyle = '#ff7a7a'; ctx.fillRect(x - 1, mid - 1, 10, 2); ctx.globalAlpha = 1; }
  }
  function drawGate(ctx, g) {
    var x = g.tx * T, y0 = (g.ty - 3) * T, y1 = (g.ty + 1) * T, lift = Math.round(g.open * 32), i;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 1, y0, T + 2, 32); ctx.clip();
    for (i = 0; i < 4; i++) { ctx.fillStyle = '#8a90a8'; ctx.fillRect(x + 1 + i * 2, y0 - lift, 1, 32 + 2); ctx.fillStyle = '#c8ccd8'; ctx.fillRect(x + 1 + i * 2, y0 - lift, 1, 32); ctx.fillStyle = '#e8ecf5'; ctx.fillRect(x + 1 + i * 2, y1 - lift - 2, 1, 2); }
    for (i = 0; i < 3; i++) { ctx.fillStyle = '#5a6076'; ctx.fillRect(x, y0 + 5 + i * 11 - lift, T, 2); ctx.fillStyle = '#9aa0b4'; ctx.fillRect(x, y0 + 5 + i * 11 - lift, T, 1); }
    ctx.restore();
    ctx.fillStyle = th.edge; ctx.fillRect(x - 1, y0, 1, 32); ctx.fillRect(x + T, y0, 1, 32);
    ctx.fillStyle = '#4a5068'; ctx.fillRect(x, y0, T, 3); ctx.fillStyle = '#9aa0b4'; ctx.fillRect(x, y0, T, 1);
  }

  function heroDraw(ctx) {
    var h = hero, p, rot = 0, blade = false, sc = Math.min(1, Math.abs(h.vx) / 50), sdy = 0, alpha = 1, pal = PALS.hero, a, t = wtime;
    switch (h.st) {
      case 'hang': p = blend(P_HANG, P_HANG, 0); p[2] += Math.sin(t * 2) * 0.2; sc = 0.1; sdy = 1; break;
      case 'lower': a = ease(h.ct / 0.55); p = blend(P_CROUCH, P_HANG, a); sc = 0.2; break;
      case 'climb': a = h.ct / 0.62; p = a < 0.7 ? blend(P_HANG, blend(P_HANG, P_CROUCH, 0.7), ease(a / 0.7)) : blend(blend(P_HANG, P_CROUCH, 0.7), P_CROUCH, ease((a - 0.7) / 0.3)); sc = 0.2; break;
      case 'dying': a = ease(h.ct / 0.5); p = blend(P_HURT, P_DEAD, a); sc = 0; break;
      case 'exit': p = gait(h.anim, false, false); break;
      case 'air':
        if (h.jt === 'run') p = blend(P_LEAP, P_FALL, U.clamp((h.vy + 120) / 300, 0, 0.6));
        else if (h.vy < 0) p = blend(P_UP, P_FALL, U.clamp((h.vy + 180) / 180, 0, 1));
        else p = blend(P_FALL, P_FALL, 0);
        sdy = h.vy / 120; sc = h.jt === 'run' ? 1 : 0.5;
        break;
      default:
        if (h.duel) {
          blade = true;
          if (h.draw > 0) p = blend(P_IDLE, P_DUEL, ease(1 - h.draw / 0.28));
          else if (h.act === 'strike') { a = h.actT; p = a < 0.12 ? blend(P_DUEL, P_WIND, ease(a / 0.12)) : a < 0.2 ? blend(P_WIND, P_STRIKE, ease((a - 0.12) / 0.06)) : blend(P_STRIKE, P_DUEL, ease((a - 0.2) / 0.26)); }
          else if (h.act === 'parry') p = h.actT < 0.34 ? blend(P_DUEL, P_PARRY, ease(h.actT / 0.06)) : blend(P_PARRY, P_DUEL, ease((h.actT - 0.34) / 0.16));
          else if (h.act === 'recoil') p = blend(P_HURT, P_DUEL, ease(h.actT / 0.3));
          else { p = blend(P_DUEL, P_DUEL, 0); var sh = Math.sin(h.anim * 6.28) * 1.2; p[6] += sh * 0.6; p[8] -= sh * 0.6; p[1] += Math.sin(t * 5) * 0.25; }
          sc = 0.3;
        } else if (h.stun > 0 && !h.duel) { p = blend(P_CROUCH, P_IDLE, U.clamp(1 - h.stun / 0.45, 0, 1) * 0.4); }
        else if (h.crouch) p = Math.abs(h.vx) > 3 ? gait(h.anim, false, true) : P_CROUCH;
        else if (Math.abs(h.vx) > 40) p = gait(h.anim, true, false);
        else if (Math.abs(h.vx) > 3) p = gait(h.anim, false, false);
        else { p = blend(P_IDLE, P_IDLE, 0); p[1] += Math.sin(t * 2.2) * 0.3; p[3] += Math.sin(t * 2.2) * 0.45; p[5] += Math.sin(t * 2.2 + 0.4) * 0.5; }
    }
    if (h.invuln > 0 && h.st !== 'dying' && Math.floor(wtime * 18) % 2) alpha = 0.35;
    drawFigure(ctx, { x: Math.round(h.x), y: Math.round(h.y), face: h.face, pose: p, pal: h.flash > 0 ? PALS.white : pal, rot: rot, blade: blade, sheath: !blade && h.st !== 'dying', bladeLen: 11, curve: 0.5, sc: sc, sdy: sdy, t: t, alpha: alpha, bulk: 4 });
  }
  function guardDraw(ctx, g) {
    var K = GK[g.k], p, blade = true, rot = 0, a, t = wtime;
    if (g.st === 'dead') {
      var l = ease(g.dt / 0.45);
      p = blend(P_HURT, P_DEAD, l); blade = false;
    } else if (g.act === 'windup') { a = U.clamp(g.actT / K.wind, 0, 1); p = blend(P_DUEL, P_WIND, ease(a)); }
    else if (g.act === 'strike') p = P_STRIKE;
    else if (g.act === 'recover') p = blend(P_STRIKE, P_DUEL, ease(g.actT / 0.4));
    else if (g.act === 'parry') p = blend(P_DUEL, P_PARRY, ease(g.actT / 0.06));
    else if (g.act === 'stagger') p = blend(P_HURT, P_DUEL, ease(g.actT / g.stagT));
    else if (g.alert) { p = blend(P_DUEL, P_DUEL, 0); var sh = Math.sin(g.anim * 6.28) * 1.2; p[6] += sh * 0.6; p[8] -= sh * 0.6; p[1] += Math.sin(t * 5 + g.t) * 0.25; }
    else if (g.wait > 0) { p = blend(P_IDLE, P_IDLE, 0); p[14] = 1.2; p[1] += Math.sin(t * 2 + g.t) * 0.3; p[3] += Math.sin(t * 2 + g.t) * 0.4; }
    else { p = gait(g.anim, false, false); p[14] = 1.25; }
    if (g.act === 'windup' && Math.floor(g.actT * 30) % 2 === 0 && g.actT > K.wind * 0.5) { /* telegraph blink */ }
    drawFigure(ctx, { x: Math.round(g.x), y: Math.round(g.y), face: g.face, pose: p, pal: g.flash > 0 ? PALS.white : PALS[g.k], blade: blade, bladeLen: 12, curve: 0.45, sc: 0.2, t: t + g.t, bulk: K.bulk });
    if (g.act === 'windup') { ctx.fillStyle = '#ff4a4a'; ctx.fillRect(Math.round(g.x) - 1, Math.round(g.y) - 27, 2, 4); ctx.fillRect(Math.round(g.x) - 1, Math.round(g.y) - 22, 2, 2); }
  }

  function pip(ctx, x, y, full, col) {
    var rows = ['..#..', '.###.', '#####', '.###.', '..#..'], r, c;
    for (r = 0; r < 5; r++) for (c = 0; c < 5; c++) {
      if (rows[r].charAt(c) !== '#') continue;
      ctx.fillStyle = full ? col : '#2a1a30';
      ctx.fillRect(x + c, y + r, 1, 1);
    }
    if (full) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x + 1, y + 2, 1, 1); ctx.fillRect(x + 2, y + 1, 1, 1); }
    else { ctx.fillStyle = '#5a3a4a'; ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x, y + 2, 1, 1); ctx.fillRect(x + 4, y + 2, 1, 1); ctx.fillRect(x + 2, y + 4, 1, 1); }
  }
  function drawHud(ctx) {
    var i, m = Math.floor(timeLeft / 60), s = Math.floor(timeLeft % 60), low = timeLeft < 60, col = low ? (Math.floor(wtime * 4) % 2 ? '#ff5a5a' : '#ffffff') : '#ffffff';
    ctx.fillStyle = '#0b0812'; ctx.fillRect(0, 0, W, TOPH); ctx.fillRect(0, BOTY, W, H - BOTY);
    ctx.fillStyle = '#2a2040'; ctx.fillRect(0, TOPH - 1, W, 1); ctx.fillRect(0, BOTY, W, 1);
    R.draw.text(ctx, 'LV' + (levelIdx + 1), 3, 3, { size: 6, color: '#f0c15a' });
    R.draw.text(ctx, pad2(m) + ':' + pad2(s), W / 2, 3, { size: 6, color: col, align: 'center' });
    R.draw.text(ctx, R.util.pad(R.score, 5), W - 3, 3, { size: 6, color: '#c2c3c7', align: 'right' });
    for (i = 0; i < hero.maxhp; i++) pip(ctx, 3 + i * 7, BOTY + 2, i < hero.hp, '#ff3d5e');
    var f = hero.duel && hero.foe && hero.foe.st !== 'dead' ? hero.foe : null;
    if (f) for (i = 0; i < f.maxhp; i++) pip(ctx, W - 8 - i * 7, BOTY + 2, i < f.hp, '#b86bff');
  }

  function drawWorld(ctx) {
    var cx = Math.round(camX), cy = Math.round(camY), i, p;
    ctx.save(); ctx.beginPath(); ctx.rect(0, TOPH, W, VH); ctx.clip();
    ctx.translate(-cx, TOPH - cy);
    ctx.drawImage(lv.cv, 0, -16);
    drawDynamic(ctx, cx, cx + W, cy, cy + VH);
    for (i = 0; i < guards.length; i++) { var g = guards[i]; if (g.x > cx - 24 && g.x < cx + W + 24 && g.y > cy - 8 && g.y < cy + VH + 40) guardDraw(ctx, g); }
    if (hero.st !== 'dying' || true) heroDraw(ctx);
    for (i = 0; i < parts.length; i++) {
      p = parts[i]; ctx.globalAlpha = U.clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < texts.length; i++) R.draw.text(ctx, texts[i].s, Math.round(texts[i].x), Math.round(texts[i].y), { size: 6, color: texts[i].col, align: 'center', shadow: '#000' });
    ctx.restore();
    ctx.drawImage(S.vig, 0, TOPH);
    ctx.fillStyle = th.glow; ctx.globalAlpha = 0.35;
    for (i = 0; i < 14; i++) { var mx = (hash(i * 7) * W + Math.sin(wtime * 0.4 + i) * 6 + wtime * (2 + i % 3)) % W, my = TOPH + (hash(i * 13 + 3) * VH + Math.sin(wtime * 0.6 + i * 2) * 5) % VH; ctx.fillRect(Math.round(mx), Math.round(my), 1, 1); }
    ctx.globalAlpha = 1;
  }

  /* -------------------------------------------------------------------- game */
  R.game({
    layout: 'full', size: [W, H], bg: '#0b0812', music: 'space',

    init: function () { buildSprites(); },

    reset: function () {
      seed = 7; wtime = 0; timeLeft = TIME_LIMIT; kills = 0; parries = 0; deaths = 0; lastWarn = 99; hudFlash = 0;
      lvMax = 4; lvHp = 4; R.score = 0; deathWhy = '';
      startLevel(0); fade = 0;
    },

    update: function (dt) {
      var i;
      wtime += dt;
      if (banner > 0) banner -= dt;
      if (hintT > 0) hintT -= dt;
      if (hudFlash > 0) hudFlash -= dt;
      if (fade > 0 && phase === 'play') fade = Math.max(0, fade - dt * 2);
      updateParts(dt);
      if (phase === 'play' || phase === 'dying') updateTimer(dt);
      if (phase === 'over') return;
      if (phase === 'play') { updatePlay(dt); }
      else if (phase === 'dying') {
        phaseT += dt; updatePlay(dt);
        if (phaseT > 1.9) { var keepT = timeLeft; startLevel(levelIdx, true); timeLeft = keepT; floatText(hero.x, hero.y - 24, 'TRY AGAIN', '#ff8fa8'); }
      } else if (phase === 'clear') {
        phaseT += dt; heroStep(dt, readCtl());
        if (phaseT > 0.9) fade = Math.min(1, (phaseT - 0.9) / 0.5);
        if (phaseT > 1.5) {
          if (levelIdx < LEVELS.length - 1) { lvMax = hero.maxhp; startLevel(levelIdx + 1); }
          else { phase = 'win'; phaseT = 0; fade = 0; R.sfx.play('win'); }
        }
      } else if (phase === 'timeup') {
        phaseT += dt; if (phaseT > 1.7) { phase = 'over'; R.gameOver(); }
      } else if (phase === 'win') {
        phaseT += dt;
        if (Math.random() < 0.3) burst(camX + U.rand(10, W - 10), camY + U.rand(20, 90), 14, ['#ffe27a', '#ff3d5e', '#7fe0ff', '#ffffff'], 70, 0.7, 60, 2);
        if (phaseT > 3.4) { phase = 'over'; R.gameOver({ win: true }); }
      }
      updateCamera(dt);
      if (phase === 'play' || phase === 'dying') for (i = 0; i < guards.length; i++) if (guards[i].st === 'dead') guardUpdate(guards[i], 0);
    },

    render: function (ctx, w, h) {
      drawWorld(ctx);
      drawHud(ctx);
      if (banner > 0 && phase === 'play' && R.mode === 'play') {
        var a = Math.min(1, banner * 2);
        ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 62, w, 34);
        R.draw.text(ctx, 'LEVEL ' + (levelIdx + 1), w / 2, 68, { size: 8, color: '#f0c15a', align: 'center', shadow: '#000' });
        R.draw.text(ctx, lv.def.name, w / 2, 82, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
        ctx.globalAlpha = 1;
      }
      if (hintT > 0 && phase === 'play' && R.mode === 'play') {
        var ha = Math.min(1, hintT * 2);
        ctx.globalAlpha = ha; ctx.fillStyle = 'rgba(8,6,16,0.82)'; ctx.fillRect(0, TOPH, w, 11);
        R.draw.text(ctx, hintText, w / 2, TOPH + 3, { size: 6, color: '#ffe27a', align: 'center' });
        ctx.globalAlpha = 1;
      }
      if (phase === 'dying' && phaseT > 0.5) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 62, w, 22);
        R.draw.text(ctx, deathWhy === 'fall' ? 'YOU FELL' : deathWhy === 'spikes' ? 'IMPALED' : deathWhy === 'slice' ? 'SLICED' : 'DEFEATED', w / 2, 68, { size: 8, color: '#ff5a5a', align: 'center', shadow: '#000' });
      }
      if (phase === 'timeup') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 58, w, 40);
        R.draw.text(ctx, "TIME'S UP", w / 2, 64, { size: 16, color: '#ff5a5a', align: 'center', shadow: '#000' });
        R.draw.text(ctx, 'THE SAND HAS RUN OUT', w / 2, 84, { size: 6, color: '#ffffff', align: 'center', shadow: '#000' });
      }
      if (phase === 'win') {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 56, w, 52);
        R.draw.text(ctx, 'ESCAPED!', w / 2, 63, { size: 16, color: '#ffe27a', align: 'center', shadow: '#a85a00' });
        R.draw.text(ctx, 'THE PALACE IS BEHIND YOU', w / 2, 88, { size: 6, color: '#ffffff', align: 'center', shadow: '#000' });
      }
      if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    },

    serialize: function () { return { lv: levelIdx, t: timeLeft, mhp: lvMax, k: kills, p: parries }; },
    restore: function (s) {
      lvMax = U.clamp(s.mhp | 0, 4, 8); kills = s.k | 0; parries = s.p | 0;
      startLevel(U.clamp(s.lv | 0, 0, LEVELS.length - 1)); fade = 0;
      timeLeft = U.clamp(+s.t || TIME_LIMIT, 5, TIME_LIMIT);
    }
  });
})();
