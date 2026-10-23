/* Shadow Blade — a fast ninja action-platformer, built on the Retro SDK */
(function () {
  'use strict';
  var R = Retro;
  var W = 136, H = 164, T = 8, TOP = 20, ROWS = 18;          // view, tile size, HUD band height, level rows
  var HW = 3, HH = 13;                                        // hero hit-box half width / height (feet at hero.y)
  var RUN_V = 80, ACC_G = 950, ACC_A = 560, FRIC_G = 1100, FRIC_A = 170;
  var JUMP_V = 205, DJUMP_V = 178, GRAV_UP = 700, GRAV_CUT = 1900, GRAV_DN = 980, MAX_FALL = 250;
  var COYOTE = 0.09, JBUF = 0.11, WALL_V = 34, WJ_VX = 92, WJ_VY = 192;
  var SLASH_T = 0.27, SLASH_A0 = 0.04, SLASH_A1 = 0.15, SLASH_REACH = 21;
  var MAX_HEARTS = 3, MAX_AMMO = 9, INVULN = 1.5;

  /* ------------------------------------------------------------------ levels */
  /* legend:  # solid   = plank (one-way)   I bamboo pole   ^ spikes   . air
              P start   C checkpoint   X arena gate column   B boss spawn   ? tip sign
              g guard   a archer   s assassin   H heavy swordsman
              * shuriken pack   h heart   o gem   L lantern   T torch
     Each stage is a list of chunks; a chunk is 12 rows (level rows 6..17) and chunks are joined left to right. */
  var STAGES = [
    { name: 'MOONLIT ROOFTOPS', theme: 0, boss: 0, hints: [['UP: JUMP  A: SLASH','B: THROW SHURIKEN'],['SLASH ARROWS TO','PARRY THEM BACK']], chunks: [
      [ // columns 0-39
        '.........?..............................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '..............oo................ooo.....',
        '..............##........................',
        '...P..L.ooo...##.....*.......###########',
        '##########################...###########',
        '##########################...###########',
        '##########################...###########'
      ],
      [ // columns 40-79
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '.....................oooo...............',
        '.......................*................',
        '....................======..............',
        'g......L................................',
        '###########......L............C.....g...',
        '###########....#########################',
        '###########....#########################',
        '###########....#########################'
      ],
      [ // columns 80-119
        '..........................?.............',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '.....................##..oooo...........',
        '.............L..o....##..........a......',
        '###....#################################',
        '###....#################################',
        '###....#################################'
      ],
      [ // columns 120-159
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '.....................oooo...a...*.L.....',
        '..................##################....',
        '..................##################....',
        '..............====##################....',
        '.h.........g......##################...o',
        '#####....###############################',
        '#####....###############################',
        '#####....###############################'
      ],
      [ // columns 160-199
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '.oooo...................................',
        '.........s......L........*....g....C....',
        '####################....################',
        '####################....################',
        '####################....################'
      ],
      [ // columns 200-239
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '..............................a.........',
        '.............................###........',
        '.............................###..oooo..',
        '...............h....s....L...###........',
        'g....L......############################',
        '########....############################',
        '########....############################',
        '########....############################'
      ],
      [ // columns 240-279
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '...........oooo.........................',
        '........*.....L.....H.............C.....',
        '....####################################',
        '....####################################',
        '....####################################'
      ],
      [ // columns 280-296
        'X...............#',
        '................#',
        '................#',
        '................#',
        '................#',
        '................#',
        '................#',
        '................#',
        '.....L......B...#',
        '#################',
        '#################',
        '#################'
      ]
    ] },
    { name: 'BAMBOO FOREST', theme: 1, boss: 1, hints: [['UP IN AIR: 2ND JUMP','WALL + UP: WALL JUMP']], chunks: [
      [ // columns 0-39
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '..........................o............g',
        '...P....ooo.....g...*...######......####',
        '########################################',
        '########################################',
        '########################################'
      ],
      [ // columns 40-79
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '..........................oooo..........',
        '.................oo*o....======.........',
        '................======..................',
        '........................................',
        '##...o.......C.....................a....',
        '########....############################',
        '########....############################',
        '########....############################'
      ],
      [ // columns 80-119
        '.......?................................',
        '........................................',
        '........................................',
        '........................................',
        '............o...........................',
        '............I......o....................',
        '............I......I....................',
        '............I......I....................',
        '............I......I...h....s...........',
        '....################################....',
        '....################################....',
        '....################################....'
      ],
      [ // columns 120-159
        '........................................',
        '........................................',
        '........................................',
        '..............................a.........',
        '............................=====.......',
        '......................ooo...............',
        '.....................=====..............',
        '..*.....g..o............................',
        '##############......................*...',
        '##############....######################',
        '##############....######################',
        '##############....######################'
      ],
      [ // columns 160-199
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '..........................oooo..........',
        '.g..g...........o......s....C....s......',
        '##########....##########################',
        '##########....##########################',
        '##########....##########################'
      ],
      [ // columns 200-239
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '.............................oooo.......',
        '..........*......H.........o.......a....',
        '##.....#################################',
        '##.....#################################',
        '##.....#################################'
      ],
      [ // columns 240-279
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '.....................I..................',
        '.....................I................==',
        '......h....g.....s...I..a...............',
        '.....########################...........',
        '#....########################....#######',
        '#....########################....#######',
        '#....########################....#######'
      ],
      [ // columns 280-319
        '.........................X..............',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '.*......................................',
        '===.....................................',
        '........................................',
        '........g....s......C................B..',
        '########################################',
        '########################################',
        '########################################'
      ],
      [ // columns 320-321
        '.#',
        '.#',
        '.#',
        '.#',
        '.#',
        '.#',
        '.#',
        '.#',
        '.#',
        '##',
        '##',
        '##'
      ]
    ] },
    { name: 'IRON FORTRESS', theme: 2, boss: 2, ceil: true, hints: [['HEAVY GUARD: DODGE','THE SLAM, THEN HIT']], chunks: [
      [ // columns 0-39
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '....................................oooo',
        '.......T.........T..............T.......',
        '...P........g.......*................^^.',
        '########################...#############',
        '########################...#############',
        '########################...#############'
      ],
      [ // columns 40-79
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '...........................ooo..........',
        '...........................###..........',
        '.........T.................###....T.....',
        '.....a.....g..........C....###...h.....s',
        '###############....#####################',
        '###############....#####################',
        '###############....#####################'
      ],
      [ // columns 80-119
        '................................?.......',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '...................oo...................',
        '............ooo..........ooo............',
        '..................====..................',
        '....*......=====........=====.....*.....',
        '#########......................#########',
        '#########.^^^^^^^^^^^^^^^^^^^^.#########',
        '########################################'
      ],
      [ // columns 120-159
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '...................................ooooo',
        '.....T..................................',
        'H..............a............C..h........',
        '###################.....##########......',
        '###################.....##########......',
        '###################.....##########......'
      ],
      [ // columns 160-199
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '................ooooo...................',
        '........................................',
        '....T................T.................=',
        '.......^^...g*...^^^....s....a..........',
        '.################################.......',
        '.################################....###',
        '.################################....###',
        '.################################....###'
      ],
      [ // columns 200-239
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '..h.....................................',
        'oooo....................................',
        '=====...................................',
        '.........................T..............',
        '.............*.......H.......*.....g..g.',
        '#######....#############################',
        '#######....#############################',
        '#######....#############################'
      ],
      [ // columns 240-279
        '.......................................X',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '...................ooooo................',
        '........................................',
        '..T.....................................',
        '...a..........C..g..^^^....s.....a.*....',
        '#######....#############################',
        '#######....#############################',
        '#######....#############################'
      ],
      [ // columns 280-295
        '...............#',
        '...............#',
        '...............#',
        '...............#',
        '...............#',
        '...............#',
        '...............#',
        '...T.......T...#',
        '............B..#',
        '################',
        '################',
        '################'
      ]
    ] }
  ];

  var BOSSES = [
    { name: 'SHADOW STALKER', hp: 14, hw: 3, hh: 13, score: 1500 },
    { name: 'HOLLOW MASK', hp: 18, hw: 6, hh: 18, score: 2500 },
    { name: 'IRON WARLORD', hp: 22, hw: 7, hh: 21, score: 4000 }
  ];
  var EN = {
    g: { hp: 2, hw: 3, hh: 13, score: 100 },
    a: { hp: 1, hw: 3, hh: 13, score: 150 },
    s: { hp: 2, hw: 3, hh: 12, score: 200 },
    H: { hp: 8, hw: 6, hh: 17, score: 400 }
  };
  var THEMES = [
    { sky: ['#070a22', '#151a52', '#3c2a74', '#7a3f86'], body: '#2a3070', bodyDk: '#1d2256', bodyHi: '#3c4590', top: '#4a69ac', topDk: '#33508e', topHi: '#a6c4ff', plank: '#a8683a', plankHi: '#d9985a', fog: '#8f7bd8' },
    { sky: ['#03161c', '#0a3a40', '#126052', '#3f9a6a'], body: '#3b2a24', bodyDk: '#2a1d1a', bodyHi: '#54392f', top: '#3fb35c', topDk: '#2a8a45', topHi: '#a4f07e', plank: '#b9d868', plankHi: '#e6f6a0', fog: '#a4f0c8' },
    { sky: ['#12061c', '#3a1233', '#6a1c3a', '#a03a36'], body: '#4a3d68', bodyDk: '#2c2244', bodyHi: '#5f5084', top: '#8a78b8', topDk: '#5f5084', topHi: '#cdbcf5', plank: '#8f6a48', plankHi: '#c89a68', fog: '#ff8a5a' }
  ];

  /* ------------------------------------------------------------------ helpers */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v < 0 ? -1 : 1; }
  function hash(n) { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(a) { return 'rgb(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ')'; }
  function tri(x) { x = x - Math.floor(x); return x < 0.5 ? x * 2 : 2 - x * 2; }
  var seed = 7;
  function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  function rr(a, b) { return a + (b - a) * rnd(); }
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ------------------------------------------------------------------ sprites */
  function edge(rows) {                                       // add a 1px dark outline around every sprite
    var h = rows.length, w = 0, x, y, out = [];
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var g = rows.map(function (r) { while (r.length < w) r += '.'; return r; });
    function at(x, y) { return (x < 0 || y < 0 || x >= w || y >= h) ? '.' : g[y].charAt(x); }
    for (y = -1; y <= h; y++) {
      var s = '';
      for (x = -1; x <= w; x++) {
        var c = at(x, y);
        if (c === '.' && (at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.')) c = 'o';
        s += c;
      }
      out.push(s);
    }
    return out;
  }
  function whiten(cv) {
    var c = mkCanvas(cv.width, cv.height), g = c.getContext('2d');
    g.drawImage(cv, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function mk(rows, pal) { var cv = R.sprite(edge(rows), pal); return { n: cv, w: whiten(cv), h: cv.height, wd: cv.width }; }

  var HERO_PAL = { o: '#0d0b21', h: '#3f4ad0', H: '#8a96ff', d: '#2a31a0', s: '#ffd9b8', w: '#ffffff', E: '#14123a', g: '#ffcf3a', c: '#2ee6d6', C: '#14a89c', m: '#e6eeff', l: '#242b94', f: '#9a92e8' };
  var SHADE_PAL = { o: '#0d0b21', h: '#463d62', H: '#8a7ab8', d: '#2a2440', s: '#ff3d5e', w: '#ffd0d8', E: '#ff3d5e', g: '#b01f3a', c: '#ff3d6e', C: '#a8143a', m: '#c9c3e8', l: '#231d38', f: '#6a5a92' };
  var HU = ['..hhhh...', '.hhHHhhh.', '.hhsswEh.', '.hhhhhhh.', 'cchhhhh..', 'mdhhhhhd.', 'mhhhhhhdd', '.dgggggd.', '..dhhhd..'];
  var HLEG = {
    idle: ['..ll.ll..', '..ll.ll..', '..ll.ll..', '.fff.fff.'],
    run1: ['.lll..ll.', 'll.....ll', 'l......lf', 'ff.....ff'],
    run2: ['...lll...', '...lll...', '..ll.l...', '..ff.ff..'],
    run3: ['..ll.ll..', '.ll...ll.', 'll.....lf', 'ff.....ff'],
    run4: ['...lll...', '...lll...', '...l.ll..', '..ff.ff..'],
    jump: ['.ll..ll..', 'll....ll.', 'lf....ff.', '.f.......'],
    fall: ['.ll...ll.', '.ll...ll.', '.l.....l.', '.f.....f.'],
    wall: ['..ll.ll..', '..lll.ll.', '...ll.lll', '...ff.fff']
  };
  function heroSet(pal) {
    var o = {}, k;
    for (k in HLEG) o[k] = mk(HU.concat(HLEG[k]), pal);
    return o;
  }

  var GUARD_PAL = { o: '#1a0c18', a: '#aab4d0', A: '#e6edff', k: '#ffcfa0', e: '#2a1020', r: '#ff4d3a', t: '#d4533a', T: '#8a2a22', y: '#ffc83a', p: '#5a3a6a', b: '#2e2230' };
  var GU = ['...rrr...', '..aaaaa..', '.aaAAaaa.', '.aakkkea.', '..kkkkk..', '.TttttT..', 'TttyyttT.', 'TtttttttT', '.TyyyyyT.'];
  var GU_LEG = { a: ['..pp.pp..', '..pp.pp..', '..pp.pp..', '.bbb.bbb.'], b: ['.pp...pp.', 'pp.....p.', 'p......pp', 'bb.....bb'] };

  var ARCH_PAL = { o: '#0a1a10', g: '#3fb868', G: '#8de39a', D: '#1f6a3c', k: '#ffcfa0', e: '#1a1020', q: '#b0702c', b: '#26382a' };
  var AR = ['..ggggg..', '.gGGgggg.', '.ggkkkeg.', '..ggkkgg.', '..gggggg.', 'qDgggggD.', 'qDggggggg', '.DgggggD.', '..DDDDD..', '..gg.gg..', '..gg.gg..', '..DD.DD..', '.bbb.bbb.'];

  var ASN_PAL = { o: '#12041e', p: '#a548e8', P: '#d58cff', D: '#5a1f8a', y: '#ffe14a', r: '#ff3d6e', m: '#e6eeff', d: '#4a1a7a' };
  var ASU = ['..pppp...', '.ppPPppp.', '.ppyyypp.', '.pppppDp.', 'rrppppD..', 'mDpppppD.', 'mppppppDD', '.DpppppD.', '..DpppD..'];
  var ASL = { idle: ['..dd.dd..', '..dd.dd..', '.ddd.ddd.'], crouch: ['.dddddd..', 'dd.....dd'], leap: ['.dd...dd.', 'dd.....d.', 'd........'] };

  var HEAVY_PAL = { o: '#10101e', S: '#9aa5c8', s: '#5a6490', L: '#e0e8ff', y: '#ffc83a', r: '#ff3d5e', k: '#2a1a30', c: '#7a2a4a', b: '#3a3050' };
  var HV = [
    '......rr......', '.....rrrr.....', '....SSSSSS....', '...SSLLSSSS...', '...SSkkkkSS...', '...SSSSSSSS...', '..ssSSyySSss..', '.ssSSSSSSSSss.',
    '.sSSSSyySSSSs.', '.sSSSSSSSSSSs.', '..ssSSSSSSss..', '..ccyyyyyycc..', '..cccccccccc..', '...ss....ss...', '...SS....SS...', '...SS....SS...',
    '..bbb....bbb..', '..bbb....bbb..'];
  var HV_LEG2 = ['...ss......ss.', '...SS....SS...', '..SS......SS..', '..bb......bb..', '.bbb......bbb.'];

  var MASK_PAL = { o: '#10080c', W: '#f4efe0', R: '#e03a3a', Y: '#d8b25a', y: '#8a6a30', b: '#2a8a6a', d: '#145a48', T: '#ffffff', k: '#2a1a1a' };
  var MK = [
    '..RR........RR..', '...RR......RR...', '....RWWWWWWR....', '....WWWWWWWW....', '....WRRWWRRW....', '....WWkWWkWW....', '....WWTkkTWW....', '...yyyWWWWyyy...',
    '..yYYyyyyyyYYy..', '.yYYYYbbbbYYYYy.', 'yYYYYbbbbbbYYYYy', 'yYYYbbbbbbbbYYYy', 'yYYbbbddddbbbYYy', '.yYbbbddddbbbYy.', '..ybbbbbbbbbby..',
    '...bbbbbbbbbb...', '...dd..bb..dd...', '...dd..bb..dd...', '..ddd..bb..ddd..'];
  var MK_CROUCH = [
    '..RR........RR..', '...RR......RR...', '....RWWWWWWR....', '....WWWWWWWW....', '....WRRWWRRW....', '....WWkWWkWW....', '....WWTkkTWW....', '..yyyyWWWWyyyy..',
    '.yYYYyyyyyyYYYy.', 'yYYYYYbbbbYYYYYy', 'yYYYYbbbbbbYYYYy', 'yYYbbbddddbbbYYy', '.yybbbbbbbbbbyy.', '..dddbbbbbbddd..', '.dddd......dddd.'];
  var MK_AIR = [
    '..RR........RR..', '...RR......RR...', '....RWWWWWWR....', '....WWWWWWWW....', '....WRRWWRRW....', '....WWkWWkWW....', '....WWTkkTWW....', '.yyyyyWWWWyyyyy.',
    'yYYYYyyyyyyYYYYy', 'yYYYYYbbbbYYYYYy', '.YYYYbbbbbbYYYY.', '..yYbbbddddbbYy.', '...ybbbbbbbbyy..', '..dd.bbbbbb.dd..', '.ddd........ddd.'];

  var WAR_PAL = { o: '#0c0612', A: '#3a3f66', a: '#7a84b8', R: '#d4283c', r: '#8a1428', y: '#ffc83a', L: '#e8e0c8', e: '#ffe14a', c: '#5a1228', k: '#1a1030' };
  var WR = [
    '...L..........L...', '...LL........LL...', '....LL.AAAA.LL....', '....LAAAAAAAAL....', '.....AAaaaaAA.....', '.....AkeekkeAA....', '.....AAkkkkAA.....',
    '..yAAAAAAAAAAAAy..', '.yAAaaAAAAAAaaAAy.', '.AAAaaAArrAAAaaAA.', 'AAAAAAArRRrAAAAAAA', 'AAAAAAAArrAAAAAAAA', '.AAAAAyyyyyyAAAAA.', '..AAAAAAAAAAAAAA..',
    '..ccAAAAAAAAAAcc..', '..cccAAAAAAAAccc..', '...cccrrrrrrccc...', '....AAAA..AAAA....', '....AAAA..AAAA....', '....AAAA..AAAA....', '...aAAAA..AAAAa...', '..kkkkkk..kkkkkk..'];
  var WR_B = [
    '...L..........L...', '...LL........LL...', '....LL.AAAA.LL....', '....LAAAAAAAAL....', '.....AAaaaaAA.....', '.....AkeekkeAA....', '.....AAkkkkAA.....',
    '..yAAAAAAAAAAAAy..', '.yAAaaAAAAAAaaAAy.', '.AAAaaAArrAAAaaAA.', 'AAAAAAArRRrAAAAAAA', 'AAAAAAAArrAAAAAAAA', '.AAAAAyyyyyyAAAAA.', '..AAAAAAAAAAAAAA..',
    '..ccAAAAAAAAAAcc..', '..cccAAAAAAAAccc..', '...cccrrrrrrccc...', '...AAAA....AAAA...', '..AAAA......AAAA..', '..AAAA......AAAA..', '.aAAAA......AAAAa.', '.kkkkkk......kkkkk'];

  var HEART_PAL = { o: '#4a0a1e', r: '#ff3d6e', w: '#ffc0d0' };
  var HEART = ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
  var HEART_E_PAL = { o: '#2a1030', r: '#3a2048', w: '#3a2048' };
  var STAR_A = ['...x...', '...x...', '..xxx..', 'xxxcxxx', '..xxx..', '...x...', '...x...'];
  var STAR_B = ['x.....x', '.x...x.', '..xxx..', '...c...', '..xxx..', '.x...x.', 'x.....x'];
  var STAR_PAL = { o: '#10142e', x: '#e6eeff', c: '#6a7ab0' };
  var LIFE = ['..hhh..', '.hhhhh.', '.hssEh.', '.hhhhh.', 'c.hhh..'];
  var S = {};

  function buildSprites() {
    S.hero = heroSet(HERO_PAL); S.shade = heroSet(SHADE_PAL);
    S.guard = [mk(GU.concat(GU_LEG.a), GUARD_PAL), mk(GU.concat(GU_LEG.b), GUARD_PAL)];
    S.archer = mk(AR, ARCH_PAL);
    S.asn = { idle: mk(ASU.concat(ASL.idle), ASN_PAL), crouch: mk(ASU.concat(ASL.crouch), ASN_PAL), leap: mk(ASU.concat(ASL.leap), ASN_PAL) };
    S.heavy = [mk(HV, HEAVY_PAL), mk(HV.slice(0, 13).concat(HV_LEG2), HEAVY_PAL)];
    S.mask = { idle: mk(MK, MASK_PAL), crouch: mk(MK_CROUCH, MASK_PAL), air: mk(MK_AIR, MASK_PAL) };
    S.war = [mk(WR, WAR_PAL), mk(WR_B, WAR_PAL)];
    S.life = mk(LIFE, HERO_PAL);
    S.heart = mk(HEART, HEART_PAL); S.heartE = mk(HEART, HEART_E_PAL);
    S.star = [mk(STAR_A, STAR_PAL), mk(STAR_B, STAR_PAL)];
  }

  /* ----------------------------------------------------------------- backdrops */
  var BG = [];
  function gradient(g, w, h, stops) {
    var n = Math.ceil(h / 3), i, s0, t, f;
    for (i = 0; i < n; i++) {
      f = i / (n - 1) * (stops.length - 1); s0 = Math.min(stops.length - 2, Math.floor(f)); t = f - s0;
      g.fillStyle = rgb(mix(hex(stops[s0]), hex(stops[s0 + 1]), t)); g.fillRect(0, i * 3, w, 4);
    }
  }
  function wrapRect(g, x, y, w, h, LW) { g.fillRect(x, y, w, h); if (x + w > LW) g.fillRect(x - LW, y, w, h); }
  function pagoda(g, cx, base, w, tiers, body, roof, LW) {
    var y = base, t, tw, rw;
    for (t = 0; t < tiers; t++) {
      tw = w - t * 5; rw = tw + 6;
      g.fillStyle = body; wrapRect(g, cx - Math.round(tw / 2), y - 6, tw, 6, LW);
      g.fillStyle = roof; wrapRect(g, cx - Math.round(rw / 2), y - 8, rw, 2, LW); wrapRect(g, cx - Math.round(rw / 2) - 1, y - 9, 2, 1, LW); wrapRect(g, cx + Math.round(rw / 2) - 1, y - 9, 2, 1, LW);
      y -= 8;
    }
    wrapRect(g, cx, y - 7, 1, 7, LW);
  }
  function buildBackdrops() {
    var LW, g, x, i, b;
    // --- 0 rooftops
    b = { sky: mkCanvas(W, H), farW: 272, midW: 224 };
    gradient(b.sky.getContext('2d'), W, H, THEMES[0].sky);
    LW = b.farW; b.far = mkCanvas(LW, H); g = b.far.getContext('2d');
    x = 6;
    for (i = 0; x < LW; i++) {
      var kind = hash(i * 5 + 1), bw = 18 + Math.floor(hash(i + 40) * 20), bh = 26 + Math.floor(hash(i + 90) * 44);
      if (kind < 0.4) { pagoda(g, x + Math.round(bw / 2), 160, 22 + (i % 2) * 4, 3 + (i % 3), '#1b1f58', '#262b72', LW); bw = 28; }
      else { g.fillStyle = '#1b1f58'; wrapRect(g, x, 160 - bh, bw, bh, LW); g.fillStyle = '#262b72'; wrapRect(g, x - 1, 160 - bh - 2, bw + 2, 2, LW); }
      x += bw + 6 + Math.floor(hash(i + 7) * 10);
    }
    LW = b.midW; b.mid = mkCanvas(LW, H); g = b.mid.getContext('2d');
    x = 0;
    for (i = 0; x < LW; i++) {
      var hw2 = 22 + Math.floor(hash(i + 11) * 18), hh2 = 24 + Math.floor(hash(i + 31) * 26), j, k;
      g.fillStyle = '#272c78'; wrapRect(g, x, 160 - hh2, hw2, hh2, LW);
      for (j = 0; j < 5; j++) { g.fillStyle = '#343b92'; wrapRect(g, x - 2 + j, 160 - hh2 - 5 + j - 1, hw2 + 4 - j * 2, 1, LW); }
      g.fillStyle = '#343b92'; wrapRect(g, x - 2, 160 - hh2 - 1, hw2 + 4, 2, LW);
      for (j = 0; j < 3; j++) for (k = 0; k < 3; k++) if (hash(i * 9 + j * 3 + k + 5) > 0.55) { g.fillStyle = '#ffcf66'; wrapRect(g, x + 4 + j * 7, 160 - hh2 + 6 + k * 9, 3, 3, LW); }
      x += hw2 + 2 + Math.floor(hash(i + 3) * 6);
    }
    BG.push(b);
    // --- 1 bamboo
    b = { sky: mkCanvas(W, H), farW: 240, midW: 200 };
    gradient(b.sky.getContext('2d'), W, H, THEMES[1].sky);
    LW = b.farW; b.far = mkCanvas(LW, H); g = b.far.getContext('2d');
    for (x = 4, i = 0; x < LW; i++) {
      var sw = 3 + (i % 2);
      g.fillStyle = '#0c4a42'; wrapRect(g, x, 0, sw, H, LW);
      g.fillStyle = '#176a58'; wrapRect(g, x, 0, 1, H, LW);
      g.fillStyle = '#073832';
      for (j = 8 + Math.floor(hash(i) * 14); j < H; j += 20 + Math.floor(hash(i + j) * 8)) wrapRect(g, x - 1, j, sw + 2, 2, LW);
      x += 9 + Math.floor(hash(i + 21) * 12);
    }
    LW = b.midW; b.mid = mkCanvas(LW, H); g = b.mid.getContext('2d');
    for (x = 6, i = 0; x < LW; i++) {
      g.fillStyle = '#1a7c58'; wrapRect(g, x, 0, 5, H, LW);
      g.fillStyle = '#2fa578'; wrapRect(g, x, 0, 1, H, LW);
      g.fillStyle = '#0f5a40'; wrapRect(g, x + 4, 0, 1, H, LW);
      for (j = 10 + Math.floor(hash(i + 2) * 12); j < H; j += 24 + Math.floor(hash(i + j) * 10)) {
        g.fillStyle = '#0c4a34'; wrapRect(g, x - 1, j, 7, 2, LW);
        g.fillStyle = '#3fbf80'; var side = hash(i + j) < 0.5 ? -1 : 1;
        for (k = 1; k <= 5; k++) wrapRect(g, x + 2 + side * (2 + k * 2) - (side < 0 ? 1 : 0), j + (k >> 1) + 1, 3, 1, LW);
      }
      x += 24 + Math.floor(hash(i + 51) * 22);
    }
    BG.push(b);
    // --- 2 fortress
    b = { sky: mkCanvas(W, H), farW: 256, midW: 192 };
    gradient(b.sky.getContext('2d'), W, H, THEMES[2].sky);
    LW = b.farW; b.far = mkCanvas(LW, H); g = b.far.getContext('2d');
    g.fillStyle = '#2a1238'; g.fillRect(0, 74, LW, H);
    for (x = 0; x < LW; x += 16) { g.fillRect(x, 68, 10, 7); }
    for (x = 8; x < LW; x += 32) {
      g.fillStyle = '#12040f'; g.fillRect(x, 96, 14, 36); g.fillRect(x + 2, 92, 10, 4); g.fillRect(x + 4, 90, 6, 2);
      g.fillStyle = '#ff7a3a'; g.globalAlpha = 0.45; g.fillRect(x + 3, 100, 8, 28); g.globalAlpha = 1;
    }
    LW = b.midW; b.mid = mkCanvas(LW, H); g = b.mid.getContext('2d');
    for (x = 12; x < LW; x += 48) {
      g.fillStyle = '#3d1c4c'; g.fillRect(x, 20, 12, H);
      g.fillStyle = '#522a62'; g.fillRect(x, 20, 2, H);
      g.fillStyle = '#6a3478'; g.fillRect(x - 2, 20, 16, 4); g.fillRect(x - 2, 130, 16, 4);
      g.fillStyle = '#9a1f3a'; g.fillRect(x + 14, 22, 12, 34);
      g.fillStyle = '#c4304e'; g.fillRect(x + 14, 22, 12, 3);
      g.fillStyle = '#9a1f3a'; g.fillRect(x + 14, 56, 4, 4); g.fillRect(x + 22, 56, 4, 4);
      g.fillStyle = '#ffc83a'; g.fillRect(x + 18, 32, 4, 4);
    }
    BG.push(b);
  }

  /* -------------------------------------------------------------------- state */
  var lv, map, mw, th, stageIdx, hero, enemies, shots, stars, parts, texts, drops, boss, camX, camMin, look, time, levelTime, banner, fade, check;
  var phase, phaseT, hitstop, lives, hearts, ammo, ammoBlink, starKills, deflects, lastSafe, tally;

  function tile(tx, ty) { if (tx < 0 || tx >= mw) return '#'; if (ty < 0 || ty >= ROWS) return '.'; return map[ty][tx]; }
  function solidAt(tx, ty) { var c = tile(tx, ty); return c === '#' || c === 'I' || c === 'D'; }

  function buildLevel(si) {
    var def = STAGES[si], x, y, r, cw = 0, rows = [];
    def.chunks.forEach(function (c) { cw += c[0].length; });
    for (r = 0; r < ROWS; r++) {
      var s = '';
      if (r < 6) s = new Array(cw + 1).join(def.ceil && r < 2 ? '#' : '.');
      else def.chunks.forEach(function (c) { s += c[r - 6]; });
      rows.push(s);
    }
    mw = cw; th = THEMES[def.theme];
    rows = rows.map(function (rw, ri) { return ri < 6 ? rw.slice(0, -1) + '#' : rw; });
    lv = { def: def, sp: [], items: [], checks: [], deco: [], hints: [], start: { x: 28, y: 120 }, arena: -1, bossAt: null };
    map = [];
    for (y = 0; y < ROWS; y++) {
      var row = [];
      for (x = 0; x < mw; x++) {
        var ch = rows[y].charAt(x), keep = '.';
        if (ch === '#' || ch === '=' || ch === 'I' || ch === '^') keep = ch;
        else if (ch === 'g' || ch === 'a' || ch === 's' || ch === 'H') lv.sp.push({ k: ch, tx: x, ty: y, done: false });
        else if (ch === 'o' || ch === '*' || ch === 'h') lv.items.push({ k: ch, x: x * T + 4, y: y * T + 4, got: false, ph: hash(x * 3 + y) * 6 });
        else if (ch === 'P') lv.start = { x: x * T + 4, y: (y + 1) * T };
        else if (ch === 'C') lv.checks.push({ tx: x, ty: y, on: false });
        else if (ch === 'X') lv.arena = x;
        else if (ch === 'B') lv.bossAt = { x: x * T + 4, y: (y + 1) * T };
        else if (ch === 'L' || ch === 'T') lv.deco.push({ k: ch, tx: x, ty: y });
        else if (ch === '?') lv.hints.push({ x: x * T + 4, lines: (def.hints || [])[lv.hints.length] || [] });
        row.push(keep);
      }
      map.push(row);
    }
  }

  /* ------------------------------------------------------------------ particles */
  function burst(x, y, o) {
    var n = o.n || 8, cols = o.color || ['#ffffff'], i, a, sp;
    for (i = 0; i < n; i++) {
      a = o.a0 != null ? o.a0 + rnd() * (o.a1 - o.a0) : rnd() * 6.2832;
      sp = (o.speed || 50) * (0.35 + rnd() * 0.65);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.gravity || 0, life: (o.life || 0.4) * (0.6 + rnd() * 0.4), max: o.life || 0.4, size: o.size || 2, col: cols[Math.floor(rnd() * cols.length)] });
    }
    if (parts.length > 260) parts.splice(0, parts.length - 260);
  }
  function floatText(x, y, s, col) { texts.push({ x: x, y: y, s: s, c: col || '#ffe14a', t: 0.9 }); if (texts.length > 12) texts.shift(); }
  function updateParts(dt) {
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (i = texts.length - 1; i >= 0; i--) { texts[i].t -= dt; texts[i].y -= 12 * dt; if (texts[i].t <= 0) texts.splice(i, 1); }
  }
  function poof(x, y, big) {
    burst(x, y, { n: big ? 16 : 9, color: ['#f0f0ff', '#c4c4e4', '#9a9ac8'], speed: big ? 60 : 42, life: 0.55, size: big ? 4 : 3, gravity: -26 });
    burst(x, y, { n: big ? 12 : 6, color: ['#ffffff', '#ffe14a', '#2ee6d6'], speed: 85, life: 0.3, size: 2 });
  }

  /* -------------------------------------------------------------------- sound */
  var SND = {
    swish: function () { R.sfx.noise(0.12, { vol: 0.14, freq: 7500, sweep: 700 }); R.sfx.tone(560, 0.08, { type: 'triangle', vol: 0.05, slide: 200 }); },
    jump: function () { R.sfx.tone(280, 0.14, { vol: 0.08, type: 'triangle', slide: 620 }); },
    djump: function () { R.sfx.tone(420, 0.16, { vol: 0.09, type: 'triangle', slide: 980 }); },
    throwStar: function () { R.sfx.tone(1500, 0.09, { vol: 0.07, type: 'triangle', slide: 700 }); R.sfx.noise(0.05, { vol: 0.06, freq: 6000, sweep: 2000 }); },
    clink: function () { R.sfx.tone(2200, 0.06, { vol: 0.09, type: 'square' }); R.sfx.tone(3100, 0.09, { vol: 0.06, delay: 0.03 }); },
    hurt: function () { R.sfx.play('hit'); R.sfx.tone(300, 0.2, { vol: 0.1, type: 'sawtooth', slide: 90 }); },
    kill: function () { R.sfx.noise(0.2, { vol: 0.18, freq: 3500, sweep: 300 }); R.sfx.tone(420, 0.16, { vol: 0.1, type: 'square', slide: 110 }); },
    arrow: function () { R.sfx.tone(900, 0.12, { vol: 0.07, type: 'sawtooth', slide: 320 }); },
    spot: function () { R.sfx.tone(880, 0.05, { vol: 0.08 }); R.sfx.tone(1180, 0.06, { vol: 0.08, delay: 0.05 }); },
    tele: function () { R.sfx.tone(300, 0.14, { vol: 0.07, type: 'sawtooth', slide: 600 }); },
    dash: function () { R.sfx.noise(0.35, { vol: 0.16, freq: 2400, sweep: 300 }); },
    slam: function () { R.sfx.noise(0.4, { vol: 0.25, freq: 1500, sweep: 80 }); R.sfx.tone(80, 0.3, { vol: 0.16, type: 'sawtooth', slide: 35 }); },
    roar: function () { R.sfx.tone(110, 0.7, { vol: 0.14, type: 'sawtooth', slide: 55 }); R.sfx.noise(0.6, { vol: 0.1, freq: 900, sweep: 120 }); },
    gate: function () { R.sfx.noise(0.3, { vol: 0.22, freq: 900, sweep: 100 }); R.sfx.tone(120, 0.25, { vol: 0.14, type: 'square', slide: 50 }); }
  };

  /* ------------------------------------------------------------------ collision */
  function moveX(e, dx, hw, hh) {
    e.x += dx;
    var ty0 = Math.floor((e.y - hh + 0.01) / T), ty1 = Math.floor((e.y - 0.01) / T), ty, tx;
    if (dx > 0) { tx = Math.floor((e.x + hw) / T); for (ty = ty0; ty <= ty1; ty++) if (solidAt(tx, ty)) { e.x = tx * T - hw - 0.001; return true; } }
    else if (dx < 0) { tx = Math.floor((e.x - hw) / T); for (ty = ty0; ty <= ty1; ty++) if (solidAt(tx, ty)) { e.x = (tx + 1) * T + hw + 0.001; return true; } }
    return false;
  }
  function moveY(e, dy, hw, hh, drop) {                         // 1 = landed, -1 = bumped head
    var oy = e.y, tx0, tx1, tx, ty, c;
    e.y += dy;
    tx0 = Math.floor((e.x - hw + 0.01) / T); tx1 = Math.floor((e.x + hw - 0.01) / T);
    if (dy >= 0) {
      ty = Math.floor(e.y / T);
      for (tx = tx0; tx <= tx1; tx++) {
        c = tile(tx, ty);
        if ((c === '#' || c === 'I' || c === 'D' || (c === '=' && !drop)) && oy <= ty * T + 0.01) { e.y = ty * T; return 1; }
      }
    } else {
      ty = Math.floor((e.y - hh) / T);
      for (tx = tx0; tx <= tx1; tx++) if (solidAt(tx, ty)) { e.y = (ty + 1) * T + hh; return -1; }
    }
    return 0;
  }
  function wallDir(e, dir) {
    var tx = Math.floor((e.x + dir * (HW + 1)) / T);
    return solidAt(tx, Math.floor((e.y - 3) / T)) || solidAt(tx, Math.floor((e.y - 10) / T));
  }
  function floorAt(tx, ty) { var c = tile(tx, ty); return c === '#' || c === 'I' || c === '=' || c === 'D'; }
  function ledgeAhead(e, dir) { return !floorAt(Math.floor((e.x + dir * (e.hw + 2)) / T), Math.floor((e.y + 1) / T)); }
  function heroHit(x0, y0, x1, y1) {
    var h = hero;
    return x0 < h.x + HW - 0.5 && x1 > h.x - HW + 0.5 && y0 < h.y - 0.5 && y1 > h.y - HH + 1;
  }

  /* --------------------------------------------------------------------- hero */
  function newHero(x, y) {
    return { x: x, y: y, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, jbuf: 0, airJumps: 1, wall: 0, wallLock: 0, stun: 0, invuln: 0.8, slashT: 0, swing: 0, slashBuf: 0, throwBuf: 0, throwCd: 0,
      dropT: 0, anim: 0, dead: false, dust: 0, spin: 0, trail: 1, throwAnim: 0 };
  }

  function hurtHero(srcX, dmg) {
    var h = hero;
    if (h.invuln > 0 || h.dead || phase !== 'play') return false;
    hearts -= dmg; h.invuln = INVULN; h.stun = 0.26; h.slashT = 0; h.spin = 0;
    h.vx = (h.x < srcX ? -1 : 1) * 85; h.vy = -115; h.ground = false;
    SND.hurt(); R.vibrate(70); R.fx.shake(2.5, 0.25); R.fx.flash('#ff3d5e', 0.12); hitstop = Math.max(hitstop, 0.09);
    burst(h.x, h.y - 7, { n: 12, color: ['#8a96ff', '#ffffff', '#2ee6d6'], speed: 80, life: 0.45, gravity: 120, size: 2 });
    if (hearts <= 0) die();
    return true;
  }
  function die() {
    var h = hero;
    h.dead = true; h.vy = -190; h.vx = 0; phase = 'dying'; phaseT = 0; hearts = 0;
    lives = Math.max(0, lives - 1); R.lives = lives;
    R.vibrate(160); R.fx.shake(3, 0.4);
    if (boss && boss.hp > 0) boss.st = 'taunt';
    R.sfx.play('lose');
  }
  function fallReset() {                                       // pit or spikes: lose a heart and go back to the last safe spot
    var h = hero;
    if (h.invuln <= 0) { hearts -= 1; SND.hurt(); R.vibrate(60); }
    if (hearts <= 0) { die(); return; }
    poof(h.x, Math.min(h.y, ROWS * T - 4), false);
    h.x = lastSafe.x; h.y = lastSafe.y; h.vx = 0; h.vy = 0; h.invuln = INVULN; h.stun = 0; h.ground = false; h.slashT = 0;
    poof(h.x, h.y - 6, false); R.fx.flash('#ffffff', 0.1);
  }

  function startSlash() {
    var h = hero;
    h.slashT = SLASH_T; h.swing++; h.slashBuf = 0;
    if (h.ground && Math.abs(h.vx) < RUN_V * 0.7) h.vx = h.face * RUN_V * 0.7;
    SND.swish();
  }
  function slashHit() {
    var h = hero, f = h.face, x0 = f > 0 ? h.x - 1 : h.x - SLASH_REACH, x1 = f > 0 ? h.x + SLASH_REACH : h.x + 1, y0 = h.y - 21, y1 = h.y + 1, i, e, s, any = false;
    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      if (e.dead || e.hitSwing === h.swing) continue;
      if (x0 < e.x + e.hw && x1 > e.x - e.hw && y0 < e.y && y1 > e.y - e.hh) { e.hitSwing = h.swing; if (damageEnemy(e, 2, f, 'slash')) any = true; }
    }
    if (boss && boss.hitSwing !== h.swing && x0 < boss.x + boss.hw && x1 > boss.x - boss.hw && y0 < boss.y && y1 > boss.y - boss.hh) {
      boss.hitSwing = h.swing; if (hitBoss(2, f)) any = true;
    }
    for (i = 0; i < shots.length; i++) {
      s = shots[i];
      if (s.fr || (s.k !== 'arrow' && s.k !== 'kunai' && s.k !== 'blade')) continue;
      if (x0 < s.x + s.w / 2 && x1 > s.x - s.w / 2 && y0 < s.y + s.h / 2 && y1 > s.y - s.h / 2) {
        s.fr = true; s.vx = -s.vx * 1.25; s.vy = -s.vy; s.t = 0; deflects++;
        SND.clink(); R.vibrate(14); burst(s.x, s.y, { n: 6, color: ['#ffffff', '#ffe14a', '#2ee6d6'], speed: 70, life: 0.25, size: 2 });
        floatText(s.x, s.y - 8, 'PARRY', '#2ee6d6');
        if (deflects >= 5) R.achieve('arrow-catcher');
        hitstop = Math.max(hitstop, 0.04); any = true;
      }
    }
    return any;
  }
  function tryThrow() {
    var h = hero;
    if (h.throwCd > 0 || stars.length >= 3) return;
    if (ammo <= 0) { R.sfx.tone(180, 0.06, { vol: 0.08 }); ammoBlink = 0.6; h.throwBuf = 0; h.throwCd = 0.2; return; }
    ammo--; h.throwCd = 0.2; h.throwBuf = 0; h.throwAnim = 0.14;
    stars.push({ x: h.x + h.face * 5, y: h.y - 8, vx: h.face * 175, t: 0 });
    SND.throwStar(); R.vibrate(6);
  }

  function heroUpdate(dt, locked) {
    var h = hero, inp = R.input, held = inp.held, ctrl = !locked && h.stun <= 0 && !h.dead;
    var ax = ctrl ? inp.axisX() : 0, attacking = h.slashT > 0, wall = 0;
    if (h.wallLock > 0) { h.wallLock -= dt; ax = 0; }
    if (ax && !attacking) h.face = ax;
    var maxV = (attacking && h.ground) ? RUN_V * 0.7 : RUN_V;
    if (ax) {
      var acc = h.ground ? ACC_G : ACC_A, along = h.vx * ax;
      if (along < 0) acc *= 2;
      if (along < maxV) along = Math.min(maxV, along + acc * dt);
      else along = Math.max(maxV, along - (h.ground ? FRIC_G : FRIC_A) * dt);
      h.vx = along * ax;
    } else {
      var fr = (h.ground ? FRIC_G : FRIC_A) * dt;
      h.vx = Math.abs(h.vx) <= fr ? 0 : h.vx - sgn(h.vx) * fr;
    }
    /* jump, double jump, wall jump */
    h.coyote = h.ground ? COYOTE : h.coyote - dt;
    if (h.ground) h.airJumps = 1;
    h.jbuf -= dt;
    if (!h.ground && ctrl && ax && wallDir(h, ax)) { wall = ax; h.face = ax; }
    h.wall = wall;
    if (h.jbuf > 0 && ctrl) {
      if (h.coyote > 0) {
        h.vy = -JUMP_V - Math.abs(h.vx) * 0.06; h.ground = false; h.coyote = 0; h.jbuf = 0; SND.jump();
        burst(h.x, h.y, { n: 4, color: ['#ffffff', '#b8b0e8'], speed: 28, life: 0.25, size: 2, gravity: 10 });
      } else if (wall) {
        h.vy = -WJ_VY; h.vx = -wall * WJ_VX; h.face = -wall; h.wallLock = 0.14; h.airJumps = 1; h.jbuf = 0; h.spin = 0; SND.jump();
        burst(h.x + wall * 3, h.y - 6, { n: 6, color: ['#ffffff', '#2ee6d6'], speed: 40, life: 0.3, size: 2 });
      } else if (h.airJumps > 0) {
        h.vy = -DJUMP_V; h.airJumps--; h.jbuf = 0; h.spin = 0.32; SND.djump();
        burst(h.x, h.y - 2, { n: 10, color: ['#2ee6d6', '#ffffff', '#8a96ff'], speed: 55, life: 0.35, size: 2, a0: 0.3, a1: 2.8 });
      }
    }
    if (ctrl && held.down && h.ground && h.dropT <= 0 && tile(Math.floor(h.x / T), Math.floor((h.y + 0.5) / T)) === '=' && !solidAt(Math.floor(h.x / T), Math.floor((h.y + 0.5) / T))) { h.dropT = 0.22; h.ground = false; h.y += 1.5; }
    if (h.dropT > 0) h.dropT -= dt;
    var g = h.vy < 0 ? (held.up && ctrl ? GRAV_UP : GRAV_CUT) : GRAV_DN;
    h.vy = Math.min(MAX_FALL, h.vy + g * dt);
    if (wall && h.vy > WALL_V) {
      h.vy = WALL_V;
      if (rnd() < 0.2) burst(h.x + wall * 3, h.y - 4, { n: 1, color: ['#ffffff', '#b8b0e8'], speed: 14, life: 0.25, size: 1, gravity: 20 });
    }
    /* move */
    if (moveX(h, h.vx * dt, HW, HH)) h.vx = 0;
    var wasGround = h.ground, vyPre = h.vy, r = moveY(h, h.vy * dt, HW, HH, h.dropT > 0);
    if (r === 1) {
      if (!wasGround && vyPre > 100) { burst(h.x, h.y, { n: 6, color: ['#ffffff', '#b8b0e8'], speed: 36, life: 0.28, size: 2, gravity: 10, a0: 3.3, a1: 6.1 }); if (vyPre > 170) R.sfx.play('land'); }
      h.vy = 0; h.ground = true; h.spin = 0;
    } else { h.ground = false; if (r === -1) h.vy = Math.max(h.vy, 30); }
    if (h.ground && Math.abs(h.vx) > 50) { h.dust -= dt; if (h.dust <= 0) { h.dust = 0.1; burst(h.x - h.face * 3, h.y, { n: 1, color: ['#c8c4f0', '#ffffff'], speed: 12, life: 0.28, size: 1, gravity: -14 }); } }
    /* attacks */
    if (h.slashBuf > 0) h.slashBuf -= dt;
    if (h.throwBuf > 0) h.throwBuf -= dt;
    if (h.throwCd > 0) h.throwCd -= dt;
    if (h.throwAnim > 0) h.throwAnim -= dt;
    if (h.slashT > 0) {
      h.slashT -= dt;
      var el = SLASH_T - h.slashT;
      if (el >= SLASH_A0 && el <= SLASH_A1) slashHit();
    }
    if (ctrl) {
      if (h.slashT <= 0 && h.slashBuf > 0) startSlash();
      if (h.throwBuf > 0) tryThrow();
    }
    h.anim += dt * (Math.abs(h.vx) / 9 + 3);
    if (h.invuln > 0) h.invuln -= dt;
    if (h.stun > 0) h.stun -= dt;
    if (h.spin > 0) h.spin -= dt;
    h.trail += (((Math.abs(h.vx) > 8 ? -sgn(h.vx) : -h.face) - h.trail)) * Math.min(1, dt * 9);
    /* remember a safe spot to return to after a fall */
    if (h.ground && h.stun <= 0) {
      var tx = Math.floor(h.x / T), ty = Math.floor((h.y + 0.5) / T);
      if (floorAt(tx - 1, ty) && floorAt(tx, ty) && floorAt(tx + 1, ty) && tile(tx - 1, ty - 1) !== '^' && tile(tx, ty - 1) !== '^' && tile(tx + 1, ty - 1) !== '^' && !nearEnemy(h.x, h.y)) {
        lastSafe.x = h.x; lastSafe.y = h.y;
      }
    }
  }
  function nearEnemy(x, y) {
    for (var i = 0; i < enemies.length; i++) if (!enemies[i].dead && Math.abs(enemies[i].x - x) < 24 && Math.abs(enemies[i].y - y) < 20) return true;
    return false;
  }

  /* ------------------------------------------------------------------ enemies */
  function makeEnemy(sp) {
    var d = EN[sp.k];
    return { k: sp.k, sp: sp, x: sp.tx * T + 4, y: (sp.ty + 1) * T, vx: 0, vy: 0, face: -1, hp: d.hp, hw: d.hw, hh: d.hh, st: sp.k === 'a' ? 'idle' : sp.k === 's' ? 'idle' : 'patrol',
      t: 0, flash: 0, dead: false, ground: false, hitSwing: -1, reload: 0.4, anim: hash(sp.tx) * 6, aimX: 0, tx: 0, stun: 0 };
  }
  function spawnEnemies(fromX) {
    enemies = [];
    lv.sp.forEach(function (sp) { if (sp.tx * T >= fromX - 2) sp.done = false; if (!sp.done) enemies.push(makeEnemy(sp)); });
  }
  function dropItem(x, y, k) { drops.push({ k: k, x: x, y: y - 6, vy: -90, got: false, ph: rnd() * 6, t: 0 }); }

  function damageEnemy(e, dmg, dir, how) {
    if (e.dead) return false;
    e.hp -= dmg; e.flash = 0.14;
    burst(e.x, e.y - e.hh / 2, { n: 6, color: ['#ffffff', '#ffe9a0', '#2ee6d6'], speed: 75, life: 0.26, size: 2 });
    if (e.hp <= 0) { killEnemy(e, how); hitstop = Math.max(hitstop, 0.085); R.vibrate(28); return true; }
    if (e.k === 'H') { e.vx = dir * 18; SND.clink(); } else {
      e.vx = dir * 75; e.vy = -70;
      if (e.k === 'g') { e.st = 'recover'; e.t = 0.2; } else if (e.k === 'a') { e.st = 'idle'; e.reload = 0.9; }
      R.sfx.play('hit');
    }
    hitstop = Math.max(hitstop, how === 'slash' ? 0.06 : 0.025); R.vibrate(14);
    return true;
  }
  function killEnemy(e, how) {
    var d = EN[e.k];
    e.dead = true; if (e.sp) e.sp.done = true;
    R.addScore(d.score); floatText(e.x, e.y - e.hh - 2, '+' + d.score);
    poof(e.x, e.y - e.hh / 2, e.k === 'H'); SND.kill(); R.fx.shake(e.k === 'H' ? 3 : 1.2, 0.15);
    if (how === 'star') { starKills++; if (starKills >= 10) R.achieve('star-thrower'); }
    if (e.k === 'H') dropItem(e.x, e.y, hearts < MAX_HEARTS ? 'h' : '*');
    else if (ammo <= 3 && rnd() < 0.5) dropItem(e.x, e.y, '*');
    else if (hearts < MAX_HEARTS && rnd() < 0.14) dropItem(e.x, e.y, 'h');
    else if (rnd() < 0.5) dropItem(e.x, e.y, 'o');
  }

  function enemyPhys(e, dt) {
    e.vy = Math.min(MAX_FALL, e.vy + 900 * dt);
    var r = moveY(e, e.vy * dt, e.hw, e.hh);
    e.ground = r === 1; if (r) e.vy = 0;
    if (e.ground && e.stun <= 0 && (e.st === 'recover' || e.st === 'idle' || e.st === 'wind' || e.st === 'raise' || e.st === 'aim' || e.st === 'crouch')) e.vx *= 0.8;
    var hit = moveX(e, e.vx * dt, e.hw, e.hh);
    if (e.y > ROWS * T + 30) { e.dead = true; if (e.sp) e.sp.done = true; }
    return hit;
  }
  function onScreen(e, pad) { return e.x > camX - (pad || 0) && e.x < camX + W + (pad || 0); }

  function updateGuard(e, dt) {
    var dx = hero.x - e.x, ad = Math.abs(dx), dy = Math.abs(hero.y - e.y), near = ad < 72 && dy < 26 && !hero.dead, hitW, tf = dx > 0 ? 1 : -1;
    e.t += dt;
    switch (e.st) {
      case 'patrol':
        e.vx = e.face * 20;
        if (e.ground && ledgeAhead(e, e.face)) { e.face = -e.face; e.vx = 0; }
        if (near && (dx * e.face > 0 || ad < 28)) { e.st = 'spot'; e.t = 0; e.face = tf; SND.spot(); }
        break;
      case 'spot':
        e.vx = 0; e.face = tf;
        if (e.t > 0.32) { e.st = 'chase'; e.t = 0; }
        break;
      case 'chase':
        e.face = tf;
        if (ad > 110 || dy > 44) { e.st = 'patrol'; e.t = 0; break; }
        e.vx = (e.ground && ledgeAhead(e, e.face)) ? 0 : e.face * 44;
        if (ad < 21 && dy < 20) { e.st = 'wind'; e.t = 0; e.vx = 0; }
        break;
      case 'wind':
        e.vx = 0;
        if (e.t > 0.36) { e.st = 'thrust'; e.t = 0; R.sfx.tone(700, 0.08, { vol: 0.07, type: 'sawtooth', slide: 300 }); }
        break;
      case 'thrust':
        e.vx = 0;
        if (heroHit(e.face > 0 ? e.x : e.x - 21, e.y - 11, e.face > 0 ? e.x + 21 : e.x, e.y - 5)) hurtHero(e.x, 1);
        if (e.t > 0.16) { e.st = 'recover'; e.t = 0; }
        break;
      case 'recover':
        if (e.t > 0.55) { e.st = 'chase'; e.t = 0; }
        break;
    }
    hitW = enemyPhys(e, dt);
    if (hitW && e.st === 'patrol') e.face = -e.face;
  }
  function updateArcher(e, dt) {
    var dx = hero.x - e.x, ad = Math.abs(dx), dy = Math.abs(hero.y - e.y), inRange = ad < 120 && dy < 56 && onScreen(e, 4) && !hero.dead, tf = dx > 0 ? 1 : -1;
    e.t += dt; e.vx *= 0.9;
    if (e.st === 'idle') {
      if (inRange) e.face = tf;
      e.reload -= dt;
      if (inRange && e.reload <= 0) { e.st = 'aim'; e.t = 0; e.face = tf; e.aimSet = false; e.slope = 0; SND.tele(); }
    } else if (e.st === 'aim') {
      if (e.t < 0.3) e.face = tf;
      else if (!e.aimSet) {                                     // lock the aim: level shot, or a slanted one at a hero above / below
        var bx = e.x + e.face * 6, by = e.y - 8, ddx = hero.x - bx, ddy = hero.y - 7 - by;
        if (ddx * e.face < 14) ddx = e.face * 14;
        e.slope = clamp(ddy / Math.abs(ddx), -0.9, 0.9);
        if (Math.abs(e.slope) < 0.14) e.slope = 0;
        e.aimSet = true;
      }
      if (e.t >= 0.85) {
        var n = Math.sqrt(1 + e.slope * e.slope);
        shots.push({ k: 'arrow', x: e.x + e.face * 7, y: e.y - 8, vx: e.face * 105 / n, vy: 105 * e.slope / n, w: 8, h: 4, t: 0, fr: false });
        SND.arrow(); e.st = 'idle'; e.reload = 1.7; e.t = 0;
        burst(e.x + e.face * 6, e.y - 8, { n: 3, color: ['#ffffff', '#8de39a'], speed: 30, life: 0.18, size: 1 });
      }
    }
    enemyPhys(e, dt);
  }
  function updateAssassin(e, dt) {
    var dx = hero.x - e.x, ad = Math.abs(dx), dy = Math.abs(hero.y - e.y), tf = dx > 0 ? 1 : -1, i, tx, lx, ok;
    e.t += dt;
    if (e.st === 'idle') {
      e.vx = 0; if (ad < 90) e.face = tf;
      if (e.ground && ad < 74 && dy < 44 && e.t > 0.45 && onScreen(e, 0) && !hero.dead) { e.st = 'crouch'; e.t = 0; e.face = tf; SND.tele(); burst(e.x, e.y, { n: 4, color: ['#d58cff', '#ffffff'], speed: 24, life: 0.3, size: 2, gravity: -10 }); }
    } else if (e.st === 'crouch') {
      e.vx = 0; if (e.t < 0.2) e.face = tf;
      if (e.t > 0.45) {
        tx = hero.x + hero.vx * 0.22; var fl = 0.46;
        e.vx = clamp((tx - e.x) / fl, -118, 118); e.vy = -205; e.ground = false;
        lx = e.x + e.vx * fl; ok = false;                       // make sure the landing spot has ground
        for (i = 0; i < 3 && !ok; i++) if (floorAt(Math.floor(lx / T), Math.floor((e.y + 1 + i * T) / T))) ok = true;
        if (!ok) e.vx *= 0.15;
        e.face = sgn(e.vx || tf); e.st = 'leap'; e.t = 0;
        R.sfx.tone(380, 0.14, { vol: 0.08, type: 'sawtooth', slide: 900 });
      }
    } else if (e.st === 'leap') {
      if (e.ground && e.t > 0.12) { e.st = 'recover'; e.t = 0; e.vx = 0; burst(e.x, e.y, { n: 4, color: ['#c8c4f0', '#ffffff'], speed: 24, life: 0.25, size: 2, gravity: 5 }); }
    } else if (e.st === 'recover') {
      e.vx = 0;
      if (e.t > 0.7) { e.st = 'idle'; e.t = 0.3; }
    }
    if (enemyPhys(e, dt) && e.st === 'leap') e.vx = 0;
  }
  function updateHeavy(e, dt) {
    var dx = hero.x - e.x, ad = Math.abs(dx), dy = Math.abs(hero.y - e.y), tf = dx > 0 ? 1 : -1;
    e.t += dt;
    switch (e.st) {
      case 'patrol':
        e.vx = e.face * 14;
        if (e.ground && ledgeAhead(e, e.face)) { e.face = -e.face; e.vx = 0; }
        if (ad < 90 && dy < 30 && (dx * e.face > 0 || ad < 36) && !hero.dead) { e.st = 'chase'; e.t = 0; SND.spot(); }
        break;
      case 'chase':
        e.face = tf;
        if (ad > 140 || dy > 50) { e.st = 'patrol'; e.t = 0; break; }
        e.vx = (e.ground && ledgeAhead(e, e.face)) ? 0 : e.face * 27;
        if (ad < 34 && dy < 24) { e.st = 'raise'; e.t = 0; e.vx = 0; SND.tele(); }
        break;
      case 'raise':
        e.vx = 0;
        if (e.t > 0.66) { e.st = 'slam'; e.t = 0; SND.slam(); R.fx.shake(2, 0.2); burst(e.x + e.face * 20, e.y, { n: 8, color: ['#c8c4f0', '#ffffff'], speed: 50, life: 0.3, size: 2, gravity: 10, a0: 3.3, a1: 6.1 }); }
        break;
      case 'slam':
        e.vx = 0;
        if (e.t < 0.2 && heroHit(e.face > 0 ? e.x + 1 : e.x - 29, e.y - 18, e.face > 0 ? e.x + 29 : e.x - 1, e.y)) hurtHero(e.x, 1);
        if (e.t > 0.22) { e.st = 'recover'; e.t = 0; }
        break;
      case 'recover':
        if (e.t > 1.0) { e.st = 'chase'; e.t = 0; }
        break;
    }
    var hitW = enemyPhys(e, dt);
    if (hitW && e.st === 'patrol') e.face = -e.face;
  }
  function updateEnemies(dt) {
    var i, e, cx = camX + W / 2;
    for (i = enemies.length - 1; i >= 0; i--) {
      e = enemies[i];
      if (e.dead) { enemies.splice(i, 1); continue; }
      if (Math.abs(e.x - cx) > 150 && e.st !== 'leap') continue;      // asleep when far away
      if (e.flash > 0) e.flash -= dt;
      e.anim += dt;
      if (e.k === 'g') updateGuard(e, dt); else if (e.k === 'a') updateArcher(e, dt); else if (e.k === 's') updateAssassin(e, dt); else updateHeavy(e, dt);
      if (e.dead) continue;
      if (e.st !== 'crouch' && heroHit(e.x - e.hw + 1, e.y - e.hh + 1, e.x + e.hw - 1, e.y)) hurtHero(e.x, 1);
    }
  }

  /* ------------------------------------------------------------ shots & stars */
  function updateShots(dt) {
    var i, s, k, e;
    for (i = shots.length - 1; i >= 0; i--) {
      s = shots[i]; s.t += dt;
      if (s.k === 'erupt') {
        if (s.t > 0.75 && s.t < 1.2 && heroHit(s.x - 5, s.y - 22, s.x + 5, s.y)) hurtHero(s.x, 1);
        if (s.t > 1.45) shots.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      var gone = false;
      if (s.k === 'wave') gone = solidAt(Math.floor((s.x + sgn(s.vx) * 4) / T), Math.floor((s.y - 2) / T));
      else gone = solidAt(Math.floor(s.x / T), Math.floor(s.y / T));
      if (s.t > 5 || s.x < camX - 40 || s.x > camX + W + 40 || s.y > ROWS * T + 20 || s.y < -20) gone = true;
      if (gone) { if (s.k !== 'wave') burst(s.x, s.y, { n: 3, color: ['#ffffff', '#c8c4f0'], speed: 30, life: 0.2, size: 1 }); shots.splice(i, 1); continue; }
      if (s.fr) {
        for (k = 0; k < enemies.length && !gone; k++) {
          e = enemies[k];
          if (!e.dead && Math.abs(s.x - e.x) < e.hw + 4 && s.y > e.y - e.hh - 2 && s.y < e.y + 2) { damageEnemy(e, 2, sgn(s.vx), 'deflect'); gone = true; }
        }
        if (!gone && boss && Math.abs(s.x - boss.x) < boss.hw + 4 && s.y > boss.y - boss.hh - 2 && s.y < boss.y + 2) { hitBoss(1, sgn(s.vx)); gone = true; }
        if (gone) shots.splice(i, 1);
        continue;
      }
      var hw = s.w / 2, hh = s.h / 2;
      if (heroHit(s.x - hw, s.y - hh - (s.k === 'wave' ? 3 : 0), s.x + hw, s.y + hh)) { if (hurtHero(s.x, 1)) { shots.splice(i, 1); } }
    }
  }
  function updateStars(dt) {
    var i, s, k, e, gone;
    for (i = stars.length - 1; i >= 0; i--) {
      s = stars[i]; s.t += dt; s.x += s.vx * dt; gone = false;
      if (solidAt(Math.floor(s.x / T), Math.floor(s.y / T))) { gone = true; burst(s.x, s.y, { n: 4, color: ['#ffffff', '#c8c4f0'], speed: 40, life: 0.2, size: 1 }); R.sfx.tone(900, 0.04, { vol: 0.05 }); }
      for (k = 0; k < enemies.length && !gone; k++) {
        e = enemies[k];
        if (!e.dead && Math.abs(s.x - e.x) < e.hw + 3 && s.y > e.y - e.hh - 2 && s.y < e.y + 1) { gone = true; damageEnemy(e, 1, sgn(s.vx), 'star'); }
      }
      if (!gone && boss && Math.abs(s.x - boss.x) < boss.hw + 3 && s.y > boss.y - boss.hh - 2 && s.y < boss.y + 1) { gone = true; if (!hitBoss(1, sgn(s.vx))) SND.clink(); }
      if (s.x < camX - 20 || s.x > camX + W + 20 || s.t > 2) gone = true;
      if (gone) stars.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------------- bosses */
  function makeBoss(kind) {
    var d = BOSSES[kind], at = lv.bossAt || { x: lv.arena * T + 100, y: 15 * T };
    return { kind: kind, x: at.x, y: at.y, hw: d.hw, hh: d.hh, vx: 0, vy: 0, face: -1, hp: d.hp, max: d.hp, st: 'intro', sub: 0, t: 0, pat: 0, n: 0, hurtT: 0, inv: 0, ground: true, p2: false, again: false, hitSwing: -1, tx: 0, anim: 0, hitWall: false, enrage: 0 };
  }
  function bossBounds() { return { l: lv.arena * T + T + 10, r: mw * T - T - 10 }; }
  function hitBoss(dmg, dir) {
    var b = boss;
    if (!b || b.hp <= 0 || b.inv > 0 || b.st === 'intro' || b.st === 'taunt') return false;
    b.hp -= dmg; b.hurtT = 0.16; b.inv = dmg >= 2 ? 0.3 : 0.1;
    burst(b.x, b.y - b.hh / 2, { n: 8, color: ['#ffffff', '#ffe14a', '#2ee6d6'], speed: 85, life: 0.3, size: 2 });
    SND.kill(); R.vibrate(30); R.fx.shake(1.8, 0.14); hitstop = Math.max(hitstop, dmg >= 2 ? 0.09 : 0.03);
    R.addScore(dmg * 40);
    if (b.hp <= 0) { bossDie(); return true; }
    if (!b.p2 && b.hp <= b.max / 2) { b.p2 = true; b.enrage = 1.0; floatText(b.x, b.y - b.hh - 8, 'ENRAGED!', '#ff6a6a'); R.fx.flash('#ff3d5e', 0.25); SND.roar(); }
    return true;
  }
  function bossDie() {
    var b = boss, d = BOSSES[b.kind];
    b.hp = 0; b.st = 'dead'; b.t = 0; phase = 'bossdie'; phaseT = 0;
    shots.length = 0; enemies.forEach(function (e) { if (!e.dead) { e.dead = true; poof(e.x, e.y - 8, false); } });
    hero.invuln = 99; hitstop = 0.28; R.fx.flash('#ffffff', 0.3); R.fx.shake(4, 0.6); R.vibrate(200);
    R.addScore(d.score); floatText(b.x, b.y - b.hh - 10, '+' + d.score, '#ffe14a');
    if (b.kind === 0) R.achieve('roof-cleared');
  }
  function bossNext(b) {
    var pats = [
      [['fan', 'dash'], ['fan2', 'dash2']],
      [['slam', 'spikes'], ['slam', 'spikes', 'slam']],
      [['combo', 'charge'], ['combo', 'summon', 'charge', 'combo']]
    ][b.kind], p = pats[b.p2 ? 1 : 0];
    b.st = p[b.pat % p.length]; b.pat++; b.sub = 0; b.t = 0; b.n = 0; b.again = false;
  }
  function bossPhys(b, dt) {
    b.vy = Math.min(MAX_FALL, b.vy + 900 * dt);
    var r = moveY(b, b.vy * dt, b.hw, b.hh);
    b.ground = r === 1; if (r) b.vy = 0;
    b.hitWall = moveX(b, b.vx * dt, b.hw, b.hh);
  }
  function throwKunai(b, angles, speed) {
    angles.forEach(function (a) {
      shots.push({ k: 'kunai', x: b.x + b.face * 6, y: b.y - 10, vx: Math.cos(a) * speed * b.face, vy: Math.sin(a) * speed, w: 6, h: 3, t: 0, fr: false });
    });
    R.sfx.tone(1100, 0.12, { vol: 0.08, type: 'sawtooth', slide: 400 });
  }
  function spawnWave(x, y, dir, speed) { shots.push({ k: 'wave', x: x, y: y, vx: dir * speed, vy: 0, w: 8, h: 7, t: 0, fr: false }); }

  function bossStalker(b, dt) {
    var tf = hero.x < b.x ? -1 : 1, rate = b.p2 ? 0.8 : 1;
    switch (b.st) {
      case 'idle': b.vx = 0; b.face = tf; if (b.t > 0.7 * rate) bossNext(b); break;
      case 'fan': case 'fan2':
        b.vx = 0;
        if (b.sub === 0) {
          if (b.t < 0.2) b.face = tf;
          if (b.t > 0.62 * rate) {
            throwKunai(b, b.st === 'fan' ? [-0.4, 0, 0.4] : [-0.6, -0.3, 0, 0.3, 0.6], b.st === 'fan' ? 82 : 96);
            b.sub = 1; b.t = 0;
          }
        } else if (b.t > 0.6 * rate) { b.st = 'idle'; b.t = 0; }
        break;
      case 'dash': case 'dash2':
        if (b.sub === 0) {
          b.vx = 0; if (b.t < 0.15 && !b.again) b.face = tf;
          if (b.t > (b.again ? 0.4 : 0.72 * rate)) { b.sub = 1; b.t = 0; SND.dash(); }
        } else if (b.sub === 1) {
          b.vx = b.face * 175;
          if (b.hitWall) {
            b.vx = 0; SND.slam(); R.fx.shake(3, 0.3); burst(b.x + b.face * 4, b.y - 6, { n: 10, color: ['#c8c4f0', '#ffffff'], speed: 60, life: 0.35, size: 2, gravity: 40 });
            if (b.st === 'dash2' && !b.again) { b.again = true; b.face = -b.face; b.sub = 0; b.t = 0; } else { b.sub = 2; b.t = 0; }
          }
        } else { b.vx = 0; if (b.t > 1.4) { b.st = 'idle'; b.t = 0; } }
        break;
    }
  }
  function bossMask(b, dt) {
    var tf = hero.x < b.x ? -1 : 1, bd = bossBounds(), rate = b.p2 ? 0.85 : 1;
    switch (b.st) {
      case 'idle': b.vx = 0; b.face = tf; if (b.t > 0.7 * rate) bossNext(b); break;
      case 'slam':
        if (b.sub === 0) {
          b.vx = 0;
          if (b.t < 0.05) { b.tx = clamp(hero.x, bd.l, bd.r); b.face = sgn(b.tx - b.x); SND.tele(); }
          if (b.t > 0.75 * rate) { b.sub = 1; b.t = 0; b.vx = (b.tx - b.x) / 0.6; b.vy = -270; b.ground = false; R.sfx.tone(200, 0.4, { vol: 0.1, type: 'triangle', slide: 500 }); }
        } else if (b.sub === 1) {
          if (b.ground && b.t > 0.15) {
            b.vx = 0; b.sub = 2; b.t = 0; SND.slam(); R.fx.shake(3.5, 0.35); R.vibrate(60);
            burst(b.x, b.y, { n: 16, color: ['#c8a050', '#8a6a30', '#ffffff'], speed: 70, life: 0.45, size: 3, gravity: 60, a0: 3.3, a1: 6.1 });
            spawnWave(b.x - 8, b.y, -1, b.p2 ? 105 : 85); spawnWave(b.x + 8, b.y, 1, b.p2 ? 105 : 85);
          }
        } else { b.vx = 0; if (b.t > 1.3 * rate) { b.st = 'idle'; b.t = 0; } }
        break;
      case 'spikes':
        b.vx = 0;
        if (b.sub === 0) {
          b.face = tf; if (b.t === 0 || b.t < dt * 1.5) SND.tele();
          if (b.t > 0.55 * rate) { b.sub = 1; b.t = 0; b.n = 0; }
        } else if (b.sub === 1) {
          var N = b.p2 ? 4 : 3, gap = 0.5;
          if (b.n < N && b.t >= b.n * gap) {
            var ex = clamp(hero.x + hero.vx * 0.28 + (b.n && b.p2 ? (b.n % 2 ? -22 : 22) : 0), bd.l, bd.r);
            shots.push({ k: 'erupt', x: ex, y: b.y, vx: 0, vy: 0, w: 10, h: 22, t: 0, fr: false });
            R.sfx.noise(0.25, { vol: 0.14, freq: 700, sweep: 120 });
            b.n++;
          }
          if (b.n >= N && b.t > (N - 1) * gap + 1.0) { b.sub = 2; b.t = 0; }
        } else if (b.t > 0.9 * rate) { b.st = 'idle'; b.t = 0; }
        break;
    }
  }
  function bossWarlord(b, dt) {
    var tf = hero.x < b.x ? -1 : 1, rate = b.p2 ? 0.8 : 1, bd = bossBounds(), dx = Math.abs(hero.x - b.x);
    switch (b.st) {
      case 'idle': b.vx = 0; b.face = tf; if (b.t > 0.55 * rate) bossNext(b); break;
      case 'combo':
        if (b.sub === 0) {                                      // walk up to the hero
          b.face = tf; b.vx = b.face * 44;
          if (dx < 30 || b.t > 1.6) { b.sub = 1; b.t = 0; b.n = 0; b.vx = 0; b.face = tf; SND.tele(); }
        } else if (b.sub === 1) {                               // telegraph (blade raised)
          b.vx = 0;
          if (b.t > (b.n === 2 ? 0.66 : 0.42) * rate) {
            b.sub = 2; b.t = 0; SND.swish();
            if (b.n === 2) { SND.slam(); R.fx.shake(3, 0.3); spawnWave(b.x + b.face * 14, b.y, b.face, b.p2 ? 105 : 88); burst(b.x + b.face * 20, b.y, { n: 10, color: ['#ffc83a', '#ffffff'], speed: 60, life: 0.3, size: 2, gravity: 30 }); }
          }
        } else if (b.sub === 2) {                               // strike
          b.vx = 0;
          if (b.t < 0.16 && heroHit(b.face > 0 ? b.x + 1 : b.x - 31, b.y - 22, b.face > 0 ? b.x + 31 : b.x - 1, b.y)) hurtHero(b.x, 1);
          if (b.t > 0.2) {
            if (b.n < 2) { b.n++; b.sub = 1; b.t = 0; b.face = tf; SND.tele(); } else { b.sub = 3; b.t = 0; }
          }
        } else { b.vx = 0; if (b.t > 1.3 * rate) { b.st = 'idle'; b.t = 0; } }
        break;
      case 'charge':
        if (b.sub === 0) {
          b.vx = 0; if (b.t < 0.15) b.face = tf;
          if (b.t < 0.05) SND.roar();
          if (b.t > 0.85 * rate) { b.sub = 1; b.t = 0; SND.dash(); }
        } else if (b.sub === 1) {
          b.vx = b.face * 150;
          if (rnd() < 0.5) burst(b.x - b.face * 6, b.y, { n: 1, color: ['#ffc83a', '#ffffff'], speed: 30, life: 0.25, size: 2, gravity: 40 });
          if (b.hitWall) { b.vx = 0; b.sub = 2; b.t = 0; SND.slam(); R.fx.shake(4, 0.4); burst(b.x + b.face * 6, b.y - 10, { n: 14, color: ['#c8c4f0', '#ffffff', '#ffc83a'], speed: 70, life: 0.4, size: 2, gravity: 50 }); }
        } else { b.vx = 0; if (b.t > 1.45) { b.st = 'idle'; b.t = 0; } }
        break;
      case 'summon':
        b.vx = 0;
        if (b.sub === 0) {
          if (b.t < dt * 1.5) { SND.roar(); R.fx.shake(2, 0.6); }
          if (b.t > 0.6) {
            var alive = 0; enemies.forEach(function (e) { if (!e.dead) alive++; });
            if (alive < 2) {
              [bd.l + 8, bd.r - 8].forEach(function (sx) {
                var e = makeEnemy({ k: 'g', tx: Math.floor(sx / T), ty: 2, done: false }); e.sp = null; e.st = 'chase'; e.x = sx; e.y = 3 * T; enemies.push(e);
                poof(sx, 3 * T - 6, false);
              });
            }
            b.sub = 1; b.t = 0;
          }
        } else if (b.t > 0.7) { b.st = 'idle'; b.t = 0; }
        break;
    }
  }
  function updateBoss(dt) {
    var b = boss, bd;
    if (!b) return;
    b.t += dt; b.anim += dt;
    if (b.inv > 0) b.inv -= dt; if (b.hurtT > 0) b.hurtT -= dt; if (b.enrage > 0) b.enrage -= dt;
    if (b.st === 'intro') {
      b.vx = 0; bossPhys(b, dt);
      if (b.t > 1.5) { b.st = 'idle'; b.t = 0; }
      return;
    }
    if (b.st === 'taunt') { b.vx = 0; bossPhys(b, dt); return; }
    if (b.kind === 0) bossStalker(b, dt); else if (b.kind === 1) bossMask(b, dt); else bossWarlord(b, dt);
    bossPhys(b, dt);
    bd = bossBounds();
    var harmless = (b.sub === 2 && (b.st === 'dash' || b.st === 'dash2' || b.st === 'charge' || b.st === 'slam' || b.st === 'spikes')) || (b.st === 'combo' && b.sub === 3);
    if (!harmless && heroHit(b.x - b.hw + 1, b.y - b.hh + 1, b.x + b.hw - 1, b.y)) hurtHero(b.x, 1);
    if (b.x < bd.l - 14) b.x = bd.l - 14;
  }

  /* -------------------------------------------------------------- pickups etc */
  function pickup(it, k, x, y) {
    it.got = true;
    if (k === 'o') { R.addScore(10); R.sfx.play('coin'); R.vibrate(4); burst(x, y, { n: 5, color: ['#ffd23a', '#ffffff'], speed: 40, life: 0.3, size: 1 }); }
    else if (k === '*') { ammo = Math.min(MAX_AMMO, ammo + 3); R.addScore(25); R.sfx.play('select'); R.vibrate(10); floatText(x, y - 8, '+3', '#e6eeff'); burst(x, y, { n: 6, color: ['#e6eeff', '#2ee6d6'], speed: 45, life: 0.3, size: 1 }); }
    else if (k === 'h') {
      if (hearts < MAX_HEARTS) { hearts++; floatText(x, y - 8, '+1', '#ff8fa8'); } else { R.addScore(200); floatText(x, y - 8, '+200', '#ffe14a'); }
      R.sfx.play('powerup'); R.vibrate(20); burst(x, y, { n: 10, color: ['#ff3d6e', '#ffc0d0', '#ffffff'], speed: 55, life: 0.45, size: 2 });
    }
  }
  function updateItems(dt) {
    var h = hero, i, it;
    for (i = 0; i < lv.items.length; i++) {
      it = lv.items[i];
      if (!it.got && Math.abs(it.x - h.x) < 8 && Math.abs(it.y - (h.y - 7)) < 11) pickup(it, it.k, it.x, it.y);
    }
    for (i = drops.length - 1; i >= 0; i--) {
      it = drops[i]; it.t += dt;
      it.vy += 420 * dt; it.y += it.vy * dt;
      if (it.vy > 0 && solidAt(Math.floor(it.x / T), Math.floor((it.y + 4) / T))) { it.y = Math.floor((it.y + 4) / T) * T - 4; it.vy = 0; }
      if (Math.abs(it.x - h.x) < 8 && Math.abs(it.y - (h.y - 7)) < 11 && it.t > 0.25) { pickup(it, it.k, it.x, it.y); drops.splice(i, 1); }
      else if (it.t > 14 || it.y > ROWS * T + 10) drops.splice(i, 1);
    }
  }
  function updateChecks() {
    var i, ck;
    for (i = 0; i < lv.checks.length; i++) {
      ck = lv.checks[i];
      if (!ck.on && hero.x > ck.tx * T) {
        ck.on = true; check = ck;
        if (hearts < MAX_HEARTS) hearts++;
        ammo = Math.max(ammo, 5);
        R.sfx.play('powerup'); R.vibrate(25); floatText(ck.tx * T + 4, ck.ty * T - 14, 'CHECKPOINT', '#2ee6d6');
        burst(ck.tx * T + 4, ck.ty * T - 6, { n: 14, color: ['#2ee6d6', '#ffffff', '#ffe14a'], speed: 60, life: 0.55, size: 2, gravity: -20 });
      }
    }
  }

  /* -------------------------------------------------------------- game flow */
  function startStage(si) {
    stageIdx = si; buildLevel(si);
    shots = []; stars = []; drops = []; boss = null; camMin = 0;
    check = null; levelTime = 0; hitstop = 0; ammoBlink = 0; look = 0;
    lv.items.forEach(function (it) { it.got = false; });
    spawnEnemies(0);
    hearts = MAX_HEARTS; ammo = Math.max(ammo, 6);
    hero = newHero(lv.start.x, lv.start.y);
    lastSafe = { x: hero.x, y: hero.y };
    camX = clamp(hero.x - 52, 0, mw * T - W);
    R.level = si + 1;
    CFG.music = MUSIC[si];
    if (R.mode === 'play') R.music.play(CFG.music);
    phase = 'play'; phaseT = 0; banner = 2.6; fade = 1;
    tally = null;
  }
  function respawn() {
    var p = check ? { x: check.tx * T + 4, y: (check.ty + 1) * T } : lv.start, c;
    if (boss && boss.st !== 'dead') {                           // retry the boss fight from the gate
      boss = null; camMin = 0;
      for (c = 0; c < ROWS; c++) if (map[c][lv.arena] === 'D') map[c][lv.arena] = '.';
    }
    shots = []; stars = []; drops = [];
    lv.items.forEach(function (it) { if (it.x >= p.x - 8) it.got = false; });
    spawnEnemies(p.x);
    hearts = MAX_HEARTS; ammo = Math.max(ammo, 5);
    hero = newHero(p.x, p.y); hero.invuln = 1.5;
    lastSafe = { x: p.x, y: p.y };
    camX = clamp(hero.x - 52, camMin, mw * T - W);
    phase = 'play'; phaseT = 0; fade = 0.6;
  }
  function startBossFight() {
    var c;
    boss = makeBoss(lv.def.boss);
    for (c = 0; c < ROWS; c++) if (map[c][lv.arena] === '.') map[c][lv.arena] = 'D';
    camMin = lv.arena * T;
    shots.length = 0;
    SND.gate(); R.fx.shake(3, 0.3); R.vibrate(60);
    banner = 0;
    check = check || null;
    burst(boss.x, boss.y - 8, { n: 14, color: ['#ffffff', '#ff3d5e', '#8a7ab8'], speed: 70, life: 0.5, size: 3, gravity: -10 });
  }
  function stageClear() {
    var d = BOSSES[lv.def.boss], tb = Math.round(clamp(1200 - levelTime * 6, 0, 1200) / 10) * 10, hb = hearts * 250;
    phase = 'clear'; phaseT = 0;
    if (boss) poof(boss.x, boss.y - boss.hh / 2, true);
    boss = null;
    tally = { boss: d.score, hearts: hb, time: tb, shown: 0 };
    R.addScore(hb + tb);
    R.sfx.play('win'); R.vibrate(60);
    if (stageIdx === STAGES.length - 1) R.achieve('shadow-master');
  }

  /* ----------------------------------------------------------------- the game */
  var MUSIC = ['action', 'adventure', 'retro'];
  var CFG = {
    layout: 'full', size: [W, H], bg: '#070a22', music: 'action',

    init: function () { buildSprites(); buildBackdrops(); },

    reset: function () {
      seed = 7; time = 0; starKills = 0; deflects = 0;
      parts = []; texts = []; hitstop = 0;
      lives = 3; R.lives = 3; R.score = 0; ammo = 6;
      startStage(0); fade = 0; banner = 2.6;
    },

    update: function (dt) {
      var inp = R.input;
      /* input edges are recorded even during hit-stop so no press is ever lost */
      if (inp.pressed('up')) hero.jbuf = JBUF;
      if (inp.pressed('a')) hero.slashBuf = 0.14;
      if (inp.pressed('b')) hero.throwBuf = 0.14;
      if (hitstop > 0) { hitstop -= dt; return; }
      time += dt;
      if (banner > 0) banner -= dt;
      if (ammoBlink > 0) ammoBlink -= dt;
      updateParts(dt);
      if (fade > 0 && phase === 'play') fade = Math.max(0, fade - dt * 2.2);

      if (phase === 'dying') {
        phaseT += dt;
        hero.vy = Math.min(300, hero.vy + 800 * dt); hero.y += hero.vy * dt;
        if (rnd() < 0.3) burst(hero.x, hero.y - 6, { n: 2, color: ['#8a96ff', '#2ee6d6'], speed: 40, life: 0.4, size: 2, gravity: 80 });
        if (phaseT > 1.1) fade = Math.min(1, (phaseT - 1.1) / 0.3);
        if (phaseT > 1.4) { if (lives <= 0) R.gameOver(); else respawn(); }
        return;
      }
      if (phase === 'bossdie') {
        phaseT += dt;
        if (rnd() < 0.5) { burst(boss.x + rr(-boss.hw, boss.hw), boss.y - rr(0, boss.hh), { n: 6, color: ['#ffffff', '#ffe14a', '#ff7a3a', '#f0f0ff'], speed: 90, life: 0.5, size: 3, gravity: 30 }); R.sfx.play('explode'); R.fx.shake(2, 0.1); R.vibrate(20); }
        heroUpdate(dt, true);
        updateItems(dt); updateStars(dt);
        if (phaseT > 2.3) stageClear();
        updateCamera(dt);
        return;
      }
      if (phase === 'clear') {
        phaseT += dt;
        heroUpdate(dt, true); hero.face = 1;
        if (phaseT < 1.9 && rnd() < 0.2) burst(camX + rr(20, W - 20), rr(30, 90), { n: 14, color: ['#ffe14a', '#ff3d5e', '#2ee6d6', '#8a96ff', '#ffffff'], speed: 70, life: 0.7, gravity: 60, size: 2 });
        if (phaseT > 3.3) fade = Math.min(1, (phaseT - 3.3) / 0.5);
        if (phaseT > 3.9) {
          if (stageIdx < STAGES.length - 1) startStage(stageIdx + 1);
          else { phase = 'win'; phaseT = 0; fade = 0; }
        }
        updateCamera(dt);
        return;
      }
      if (phase === 'win') {
        phaseT += dt; hero.anim += dt * 6;
        if (rnd() < 0.3) burst(camX + rr(10, W - 10), rr(30, 100), { n: 14, color: ['#ffe14a', '#ff3d5e', '#2ee6d6', '#8a96ff', '#ffffff'], speed: 70, life: 0.7, gravity: 60, size: 2 });
        if (phaseT > 3.6) R.gameOver({ win: true });
        return;
      }

      /* ---- playing */
      levelTime += dt;
      heroUpdate(dt, false);
      if (phase !== 'play') return;
      /* arena gate */
      if (!boss && lv.arena >= 0 && hero.x > (lv.arena + 3) * T) startBossFight();
      updateEnemies(dt);
      if (phase !== 'play') return;
      updateBoss(dt);
      if (phase !== 'play') return;
      updateShots(dt); updateStars(dt);
      updateItems(dt); updateChecks();
      /* hazards */
      var h = hero, tx0 = Math.floor((h.x - HW) / T), tx1 = Math.floor((h.x + HW) / T), ty0 = Math.floor((h.y - HH) / T), ty1 = Math.floor((h.y - 0.5) / T), tx, ty;
      for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
        if (tile(tx, ty) === '^' && h.y > ty * T + 3 && h.y - HH < (ty + 1) * T && h.invuln <= 0) { fallReset(); ty = ty1 + 1; break; }
      }
      if (phase === 'play' && h.y > ROWS * T + 24) fallReset();
      updateCamera(dt);
    },

    render: function (ctx, w, h) {
      var cx = Math.round(camX), i;
      drawBackdrop(ctx, cx);
      if (R.settings.lcd !== 'color') { ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, w, h); }   // monochrome LCD: keep the scenery dark so sprites stand out
      ctx.save(); ctx.translate(-cx, TOP);
      drawTiles(ctx, cx);
      drawDecor(ctx, cx);
      drawItems(ctx, cx);
      for (i = 0; i < enemies.length; i++) if (!enemies[i].dead && enemies[i].x > cx - 24 && enemies[i].x < cx + w + 24) drawEnemy(ctx, enemies[i]);
      if (boss) drawBoss(ctx, boss);
      drawShots(ctx);
      drawHero(ctx);
      drawStars(ctx);
      drawParts(ctx);
      ctx.restore();
      drawAmbient(ctx, cx);
      if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, TOP, w, h - TOP); ctx.globalAlpha = 1; }
      drawHud(ctx, w, h);
    }
  };
  R.game(CFG);

  function updateCamera(dt) {
    var h = hero, want = h.face * 16 * (Math.abs(h.vx) > 12 ? 1 : 0.35);
    look += (want - look) * Math.min(1, dt * 3);
    var target = clamp(h.x - 52 + look, camMin, Math.max(camMin, mw * T - W));
    camX += (target - camX) * Math.min(1, dt * 6);
    if (Math.abs(target - camX) < 0.05) camX = target;
  }

  /* ------------------------------------------------------------------ drawing */
  function spr(ctx, s, x, y, flip, white) { R.draw.sprite(ctx, white ? s.w : s.n, Math.round(x), Math.round(y), { flipX: flip }); }
  function pline(ctx, x0, y0, x1, y1, col) {                      // crisp 1px line
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy, n = 0, e2;
    ctx.fillStyle = col;
    while (n++ < 80) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  function drawBackdrop(ctx, cx) {
    var b = BG[lv.def.theme], i, x, t = lv.def.theme;
    ctx.drawImage(b.sky, 0, 0);
    if (t === 0) {
      for (i = 0; i < 26; i++) {
        var sx = (hash(i * 3 + 1) * 160 - cx * 0.02 + 160) % 136, sy = 3 + hash(i * 7 + 2) * 70;
        ctx.globalAlpha = 0.35 + 0.65 * tri(time * 0.6 + hash(i) * 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
      }
      ctx.globalAlpha = 1;
      var mx = 98 - cx * 0.03;
      ctx.globalAlpha = 0.10; ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(mx, 44, 24, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 0.14; ctx.beginPath(); ctx.arc(mx, 44, 19, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(mx, 44, 14, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#e4d9a6'; ctx.fillRect(Math.round(mx) - 6, 40, 4, 3); ctx.fillRect(Math.round(mx) + 1, 47, 5, 3); ctx.fillRect(Math.round(mx) - 2, 36, 2, 2);
    } else if (t === 1) {
      ctx.globalAlpha = 0.10; ctx.fillStyle = '#d8ffe8';
      for (i = 0; i < 4; i++) { var lx = ((i * 44 - cx * 0.1 + time * 2) % 190 + 190) % 190 - 40; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + 14, 0); ctx.lineTo(lx + 44, H); ctx.lineTo(lx + 22, H); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8ffe0'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(102 - cx * 0.02, 34, 9, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#ff7a3a'; ctx.fillRect(0, 100, W, 60); ctx.globalAlpha = 1;
    }
    var o1 = Math.floor(cx * 0.12) % b.farW, o2 = Math.floor(cx * 0.3) % b.midW;
    for (x = -o1; x < W; x += b.farW) ctx.drawImage(b.far, x, 0);
    for (x = -o2; x < W; x += b.midW) ctx.drawImage(b.mid, x, 0);
    if (t === 0) {                                                // drifting mist
      ctx.globalAlpha = 0.10; ctx.fillStyle = th.fog;
      for (i = 0; i < 3; i++) { var fx = ((i * 70 - cx * 0.4 + time * 6) % 200 + 200) % 200 - 40; ctx.fillRect(fx, 118 + i * 6, 80, 3); ctx.fillRect(fx + 20, 121 + i * 6, 60, 2); }
      ctx.globalAlpha = 1;
    }
  }
  function drawAmbient(ctx, cx) {
    var i, t = lv.def.theme, x, y;
    if (t === 1) {                                                // falling leaves
      ctx.fillStyle = '#6ad88a';
      for (i = 0; i < 9; i++) {
        x = ((i * 31 + time * (10 + i % 3 * 4) - cx * 0.5 + Math.sin(time * 1.5 + i) * 6) % 160 + 160) % 160 - 12;
        y = ((i * 47 + time * (16 + i % 4 * 5)) % 170) - 4;
        ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1); ctx.fillRect(Math.floor(x) + 1, Math.floor(y) + 1, 2, 1);
      }
    } else if (t === 2) {                                         // embers
      for (i = 0; i < 10; i++) {
        x = ((i * 29 + Math.sin(time * 0.8 + i) * 8 - cx * 0.4) % 150 + 150) % 150 - 8;
        y = 170 - ((i * 37 + time * (10 + i % 3 * 6)) % 175);
        ctx.fillStyle = i % 2 ? '#ffb040' : '#ff6a3a'; ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1 + (i % 2));
      }
    }
  }

  function drawTiles(ctx, cx) {
    var tx0 = Math.max(0, Math.floor(cx / T)), tx1 = Math.min(mw - 1, tx0 + Math.ceil(W / T) + 1), tx, ty, c, x, y, t = lv.def.theme;
    for (ty = 0; ty < ROWS; ty++) for (tx = tx0; tx <= tx1; tx++) {
      c = map[ty][tx];
      if (c === '.') continue;
      x = tx * T; y = ty * T;
      if (c === '#') drawSolid(ctx, x, y, tx, ty, t);
      else if (c === 'I') drawPole(ctx, x, y, tx, ty);
      else if (c === '=') drawPlank(ctx, x, y, tx, ty, t);
      else if (c === '^') drawSpikes(ctx, x, y);
      else if (c === 'D') drawGate(ctx, x, y, ty, t);
    }
  }
  function drawSolid(ctx, x, y, tx, ty, t) {
    var up = !solidAt(tx, ty - 1), hv = hash(tx * 7 + ty * 13), l = !solidAt(tx - 1, ty), r = !solidAt(tx + 1, ty);
    ctx.fillStyle = th.body; ctx.fillRect(x, y, T, T);
    if (t === 0) {
      if (up) {
        ctx.fillStyle = th.top; ctx.fillRect(x, y, T, 4);
        ctx.fillStyle = th.topDk; ctx.fillRect(x + ((tx & 1) ? 0 : 4), y + 2, 4, 1); ctx.fillRect(x + ((tx & 1) ? 4 : 0), y + 3, 4, 1);
        ctx.fillStyle = th.topHi; ctx.fillRect(x, y, T, 1);
        ctx.fillStyle = th.bodyDk; ctx.fillRect(x, y + 4, T, 1);
      } else {
        ctx.fillStyle = th.bodyDk; ctx.fillRect(x + 3 + (ty & 1), y, 1, T); ctx.fillRect(x, y + 7, T, 1);
        if (hv > 0.9 && solidAt(tx - 1, ty) && solidAt(tx + 1, ty)) { ctx.fillStyle = '#12163a'; ctx.fillRect(x + 1, y + 1, 6, 6); ctx.fillStyle = '#ffcf66'; ctx.fillRect(x + 2, y + 2, 4, 4); ctx.fillStyle = '#a86a2a'; ctx.fillRect(x + 4, y + 2, 1, 4); }
      }
    } else if (t === 1) {
      ctx.fillStyle = th.bodyHi; ctx.fillRect(x + Math.floor(hv * 5), y + 2 + Math.floor(hash(tx + ty * 5) * 4), 2, 1);
      ctx.fillStyle = th.bodyDk; ctx.fillRect(x + 5, y + 5, 2, 2); if (hv > 0.5) ctx.fillRect(x + 1, y + 6, 1, 1);
      if (up) {
        ctx.fillStyle = th.top; ctx.fillRect(x, y, T, 3); ctx.fillStyle = th.topHi; ctx.fillRect(x, y, T, 1);
        ctx.fillStyle = th.topDk; ctx.fillRect(x + 1, y + 3, 2, 1); ctx.fillRect(x + 5, y + 3, 2, 2);
        if (hv > 0.5) { ctx.fillStyle = th.topHi; ctx.fillRect(x + 2 + (hv > 0.75 ? 3 : 0), y - 1, 1, 1); }
      }
    } else {
      ctx.fillStyle = th.bodyDk; ctx.fillRect(x, y + 7, T, 1); ctx.fillRect(x + (ty & 1 ? 3 : 7), y, 1, 7);
      ctx.fillStyle = th.bodyHi; ctx.fillRect(x, y, T, 1);
      if (up) { ctx.fillStyle = th.top; ctx.fillRect(x, y, T, 2); ctx.fillStyle = th.topHi; ctx.fillRect(x, y, T, 1); }
    }
    if (l) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, y, 1, T); }
    if (r) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + T - 1, y, 1, T); }
  }
  function drawPlank(ctx, x, y, tx, ty, t) {
    ctx.fillStyle = th.plank; ctx.fillRect(x, y, T, 3);
    ctx.fillStyle = th.plankHi; ctx.fillRect(x, y, T, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + 2, T, 1);
    if (t === 1) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + 3, y, 1, 3); }
    else if (t === 2) { ctx.fillStyle = '#c8ccd8'; ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + 6, y + 1, 1, 1); }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + 3, T, 1);
  }
  function drawPole(ctx, x, y, tx, ty) {
    var top = tile(tx, ty - 1) !== 'I';
    ctx.fillStyle = '#1f8a58'; ctx.fillRect(x + 1, y, 6, T);
    ctx.fillStyle = '#4fd88e'; ctx.fillRect(x + 1, y, 1, T);
    ctx.fillStyle = '#12603c'; ctx.fillRect(x + 6, y, 1, T);
    if ((ty & 1) === 0) { ctx.fillStyle = '#0c4a2e'; ctx.fillRect(x, y + 6, 8, 2); }
    if (top) { ctx.fillStyle = '#0c4a2e'; ctx.fillRect(x + 1, y, 6, 1); ctx.fillStyle = '#8af0b8'; ctx.fillRect(x + 2, y + 1, 2, 1); }
  }
  function drawSpikes(ctx, x, y) {
    var s, ox;
    for (s = 0; s < 2; s++) {
      ox = x + s * 4;
      ctx.fillStyle = '#9aa0b4'; ctx.fillRect(ox + 1, y + 1, 1, 1); ctx.fillRect(ox + 1, y + 2, 2, 2); ctx.fillRect(ox, y + 4, 4, 3);
      ctx.fillStyle = '#eef2ff'; ctx.fillRect(ox + 1, y + 1, 1, 3); ctx.fillRect(ox, y + 4, 1, 3);
      ctx.fillStyle = '#6a7090'; ctx.fillRect(ox + 3, y + 4, 1, 3); ctx.fillRect(ox + 2, y + 2, 1, 2);
    }
    ctx.fillStyle = '#5a6076'; ctx.fillRect(x, y + 7, T, 1);
  }
  function drawGate(ctx, x, y, ty, t) {
    ctx.fillStyle = '#12101c'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#7a7f98'; ctx.fillRect(x + 1, y, 2, T); ctx.fillRect(x + 5, y, 2, T);
    ctx.fillStyle = '#b8bed4'; ctx.fillRect(x + 1, y, 1, T); ctx.fillRect(x + 5, y, 1, T);
    ctx.fillStyle = '#ffc83a'; if ((ty & 3) === 0) ctx.fillRect(x, y + 3, T, 2);
  }
  function drawDecor(ctx, cx) {
    var i, d, x, y, fl, ck, px, py;
    for (i = 0; i < lv.deco.length; i++) {
      d = lv.deco[i]; x = d.tx * T; y = d.ty * T;
      if (x < cx - 16 || x > cx + W + 16) continue;
      if (d.k === 'L') {                                            // stone lamp post
        var fy = y + T;
        fl = 0.5 + 0.5 * Math.sin(time * 3 + d.tx);
        ctx.globalAlpha = 0.14 + 0.05 * fl; ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.arc(x + 4, fy - 12, 14, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#4a4468'; ctx.fillRect(x + 2, fy - 2, 4, 2); ctx.fillRect(x + 3, fy - 9, 2, 7);
        ctx.fillStyle = '#6a6490'; ctx.fillRect(x + 3, fy - 9, 1, 7); ctx.fillRect(x, fy - 17, 8, 2);
        ctx.fillStyle = '#34304c'; ctx.fillRect(x + 1, fy - 15, 6, 6);
        ctx.fillStyle = '#ffcf66'; ctx.fillRect(x + 2, fy - 14, 4, 4); ctx.fillStyle = '#fff2b8'; ctx.fillRect(x + 3, fy - 13, 2, 2);
      } else {                                                      // wall torch
        fl = Math.floor(time * 10 + d.tx) % 3;
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x + 3, y + 3, 2, 5); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 2, y + 2, 4, 2);
        ctx.fillStyle = '#ff7a1a'; ctx.fillRect(x + 3, y - 1 - (fl === 1 ? 1 : 0), 2, 4); ctx.fillStyle = '#ffd23a'; ctx.fillRect(x + 3, y + (fl === 0 ? 0 : 1), 2, 2);
        ctx.globalAlpha = 0.13 + (fl ? 0.04 : 0); ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.arc(x + 4, y + 1, 14, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    for (i = 0; i < lv.checks.length; i++) {
      ck = lv.checks[i]; px = ck.tx * T + 3; py = (ck.ty + 1) * T;
      ctx.fillStyle = '#3a3050'; ctx.fillRect(px, py - 18, 2, 18);
      ctx.fillStyle = '#5a4a78'; ctx.fillRect(px - 2, py - 2, 6, 2);
      ctx.fillStyle = '#3a3050'; ctx.fillRect(px - 1, py - 19, 4, 2);
      if (ck.on) {
        fl = 0.5 + 0.5 * Math.sin(time * 6);
        ctx.globalAlpha = 0.2 + 0.1 * fl; ctx.fillStyle = '#2ee6d6'; ctx.beginPath(); ctx.arc(px + 1, py - 12, 12, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#14a89c'; ctx.fillRect(px - 3, py - 17, 8, 9); ctx.fillStyle = '#2ee6d6'; ctx.fillRect(px - 2, py - 16, 6, 7); ctx.fillStyle = '#eafffb'; ctx.fillRect(px, py - 14, 2, 3);
      } else {
        ctx.fillStyle = '#4a4468'; ctx.fillRect(px - 3, py - 17, 8, 9); ctx.fillStyle = '#6a6490'; ctx.fillRect(px - 2, py - 16, 6, 7); ctx.fillStyle = '#34304c'; ctx.fillRect(px, py - 14, 2, 3);
      }
    }
  }
  function drawGem(ctx, x, y, ph) {
    var yy = Math.round(y + Math.sin(time * 4 + ph) * 1), wv = [3, 2, 1, 2][Math.floor(time * 7 + ph) & 3];
    x = Math.round(x);
    ctx.fillStyle = '#a85a00'; ctx.fillRect(x - wv - 1, yy - 3, wv * 2 + 2, 6);
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(x - wv, yy - 2, wv * 2, 4);
    if (wv > 1) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(x - wv, yy - 2, 1, 2); }
  }
  function drawPickup(ctx, k, x, y, ph) {
    if (k === 'o') drawGem(ctx, x, y, ph);
    else if (k === '*') {
      var yy = Math.round(y + Math.sin(time * 4 + ph) * 1.2);
      ctx.globalAlpha = 0.18 + 0.1 * Math.sin(time * 5 + ph); ctx.fillStyle = '#2ee6d6'; ctx.beginPath(); ctx.arc(x, yy, 7, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
      spr(ctx, S.star[Math.floor(time * 6 + ph) & 1], x - 4.5, yy - 4.5);
    } else if (k === 'h') spr(ctx, S.heart, x - 4.5, y - 4 + Math.sin(time * 5 + ph) * 1.5);
  }
  function drawItems(ctx, cx) {
    var i, it;
    for (i = 0; i < lv.items.length; i++) { it = lv.items[i]; if (!it.got && it.x > cx - 10 && it.x < cx + W + 10) drawPickup(ctx, it.k, it.x, it.y, it.ph); }
    for (i = 0; i < drops.length; i++) drawPickup(ctx, drops[i].k, drops[i].x, drops[i].y, drops[i].ph);
  }

  function drawHero(ctx) {
    var h = hero, s, set = S.hero, fl = h.face < 0, x, y, cx, cy;
    if (h.invuln > 0 && !h.dead && h.invuln < 90 && Math.floor(time * 18) % 2) return;
    if (!h.dead) drawScarf(ctx, h);
    if (h.dead) s = set.fall;
    else if (h.wall) s = set.wall;
    else if (!h.ground) s = h.vy < 0 ? set.jump : set.fall;
    else if (Math.abs(h.vx) > 12 && h.stun <= 0) s = [set.run1, set.run2, set.run3, set.run4][Math.floor(h.anim) & 3];
    else s = set.idle;
    x = h.x - s.wd / 2; y = h.y - s.h + 1;
    if (h.spin > 0 || h.dead) {
      cx = h.x; cy = h.y - 7;
      ctx.save(); ctx.translate(Math.round(cx), Math.round(cy)); ctx.rotate((h.dead ? phaseT * 9 : (1 - h.spin / 0.32) * 6.2832) * (fl ? -1 : 1));
      ctx.imageSmoothingEnabled = false;
      if (fl) ctx.scale(-1, 1);
      ctx.drawImage(s.n, -Math.round(s.wd / 2), -7);
      ctx.restore();
    } else spr(ctx, s, x, y, fl);
    if (h.slashT > 0) drawSlash(ctx, h);
    if (h.throwAnim > 0) { ctx.fillStyle = '#e6eeff'; ctx.fillRect(Math.round(h.x + h.face * 6), Math.round(h.y - 9), 2, 2); }
  }
  function drawScarf(ctx, h) {
    var ax = h.x - h.face * 3, ay = h.y - 9.5, i, px, py, tr = h.trail, w;
    for (i = 1; i <= 6; i++) {
      w = Math.sin(time * 14 + i * 0.9) * 0.9 * (i / 3);
      px = ax + tr * i * 1.9 - h.vx * 0.004 * i * i * 0.3;
      py = ay + w + (h.ground ? i * 0.15 : clamp(-h.vy * 0.012, -3, 3) * i * 0.35) + i * 0.1;
      ctx.fillStyle = i & 1 ? '#2ee6d6' : '#14a89c';
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
    }
  }
  function drawSlash(ctx, h) {
    var el = SLASH_T - h.slashT, f = h.face, cx = h.x + f, cy = h.y - 8, k, a, r, sz, ca, sa;
    if (el < 0.015 || el > 0.2) return;
    var p = clamp((el - 0.015) / 0.13, 0, 1), a0 = -1.75, a1 = 1.15, ang = a0 + (a1 - a0) * p;
    for (k = 0; k < 22; k++) {
      a = ang - k * 0.065; if (a < a0 - 0.02) break;
      ca = Math.cos(a) * f; sa = Math.sin(a);
      r = 17 - k * 0.08; sz = k < 12 ? 3 : 2;
      ctx.fillStyle = k < 3 ? '#ffffff' : k < 9 ? '#bff8ff' : k < 15 ? '#2ee6d6' : '#14a89c';
      ctx.globalAlpha = k > 14 ? 0.6 : 1;
      ctx.fillRect(Math.round(cx + ca * r - sz / 2), Math.round(cy + sa * r - sz / 2), sz, sz);
      if (k < 14) { ctx.fillStyle = k < 6 ? '#e6fdff' : '#2ee6d6'; ctx.fillRect(Math.round(cx + ca * (r - 3)), Math.round(cy + sa * (r - 3)), 1, 1); }
    }
    ctx.globalAlpha = 1;
    ca = Math.cos(ang) * f; sa = Math.sin(ang);
    pline(ctx, cx + ca * 3, cy + sa * 3, cx + ca * 17, cy + sa * 17, '#e6eeff');
    pline(ctx, cx + ca * 3, cy + sa * 3 + 1, cx + ca * 16, cy + sa * 16 + 1, '#8fa3d6');
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(Math.round(cx + ca * 3), Math.round(cy + sa * 3), 2, 2);
  }
  function drawStars(ctx) {
    var i, s;
    for (i = 0; i < stars.length; i++) { s = stars[i]; spr(ctx, S.star[Math.floor(s.t * 24) & 1], s.x - 4.5, s.y - 4.5); }
  }
  function drawParts(ctx) {
    var i, p;
    for (i = 0; i < parts.length; i++) {
      p = parts[i]; ctx.globalAlpha = clamp(p.life / p.max * 1.4, 0, 1); ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < texts.length; i++) R.draw.text(ctx, texts[i].s, Math.round(texts[i].x), Math.round(texts[i].y), { size: 6, color: texts[i].c, align: 'center', shadow: '#000' });
  }

  function drawEnemy(ctx, e) {
    var s, x, y, white = e.flash > 0 || ((e.st === 'wind' || e.st === 'raise') && Math.floor(e.t * 16) % 2 === 0), fl = e.face > 0, i;
    if (e.k === 'g') {
      s = S.guard[e.st === 'chase' ? Math.floor(e.anim * 8) & 1 : e.st === 'patrol' ? Math.floor(e.anim * 4) & 1 : 0];
      x = e.x - s.wd / 2; y = e.y - s.h + 1; spr(ctx, s, x, y, fl, white);
      // spear
      var hx = e.x + e.face * 3, hy = e.y - 7;
      if (e.st === 'thrust') { pline(ctx, e.x - e.face * 4, hy, e.x + e.face * 19, hy, '#c8a060'); ctx.fillStyle = '#e6eeff'; ctx.fillRect(Math.round(e.x + e.face * 19 - (e.face < 0 ? 2 : 0)), hy - 1, 3, 3); }
      else if (e.st === 'wind') { pline(ctx, e.x - e.face * 8, hy + 1, e.x + e.face * 6, hy + 1, '#c8a060'); ctx.fillStyle = '#e6eeff'; ctx.fillRect(Math.round(e.x + e.face * 6 - (e.face < 0 ? 1 : 0)), hy, 2, 3); }
      else { pline(ctx, hx - e.face, e.y - 1, hx + e.face * 2, e.y - 22, '#c8a060'); ctx.fillStyle = '#e6eeff'; ctx.fillRect(Math.round(hx + e.face * 2) - 1, e.y - 25, 2, 3); }
      if (e.st === 'spot') drawBang(ctx, e);
    } else if (e.k === 'a') {
      s = S.archer; x = e.x - s.wd / 2; y = e.y - s.h + 1; spr(ctx, s, x, y, fl, e.flash > 0);
      var by = e.y - 8, bx = e.x + e.face * 5;
      ctx.fillStyle = '#b0702c';
      var bow = [[0, -5], [1, -4], [2, -3], [2, -2], [2, -1], [2, 0], [2, 1], [2, 2], [2, 3], [1, 4], [0, 5]];
      for (i = 0; i < bow.length; i++) ctx.fillRect(bx + e.face * bow[i][0] - (e.face < 0 ? 1 : 0), by + bow[i][1], 1, 1);
      if (e.st === 'aim') {
        var pull = Math.min(3, e.t * 6);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - e.face * pull - (e.face < 0 ? 1 : 0), by - 5 + (pull > 0 ? Math.round(pull) : 0), 1, 1);
        pline(ctx, bx - e.face * pull, by, bx + e.face * 6, by, '#e8d8a8');
        ctx.fillStyle = '#e6eeff'; ctx.fillRect(Math.round(bx + e.face * 6 - (e.face < 0 ? 1 : 0)), by - 1, 2, 3);
        // aim line (locked after the first 0.3 s)
        if (e.t > 0.3) {
          var hot = e.t > 0.6 && Math.floor(e.t * 22) % 2 === 0, sl = e.slope || 0, nn = Math.sqrt(1 + sl * sl);
          ctx.fillStyle = hot ? '#ffffff' : '#ff6a6a'; ctx.globalAlpha = hot ? 1 : 0.7;
          for (i = 10; i < 92; i += 4) {
            var lx = bx + e.face * i / nn, ly = by + sl * i / nn;
            if (solidAt(Math.floor(lx / T), Math.floor(ly / T))) break;
            ctx.fillRect(Math.round(lx), Math.round(ly), 2, 1);
          }
          ctx.globalAlpha = 1;
        }
        if (e.t > 0.55) drawBang(ctx, e);
      } else { pline(ctx, bx + e.face * 0, by - 5, bx + e.face * 0, by + 5, '#e8d8a8'); }
    } else if (e.k === 's') {
      s = e.st === 'crouch' ? S.asn.crouch : (e.st === 'leap' ? S.asn.leap : S.asn.idle);
      if (e.st === 'idle' && Math.floor(time * 2 + e.anim) % 5 === 0) s = S.asn.crouch;
      x = e.x - s.wd / 2; y = e.y - s.h + 1; spr(ctx, s, x, y, fl, e.flash > 0 || (e.st === 'crouch' && Math.floor(e.t * 18) % 2 === 0));
      if (e.st === 'crouch') drawBang(ctx, e);
      if (e.st === 'leap') { ctx.fillStyle = '#d58cff'; ctx.globalAlpha = 0.5; ctx.fillRect(Math.round(e.x - e.face * 7), Math.round(e.y - 8 - e.vy * 0.02), 4, 2); ctx.globalAlpha = 1; }
    } else {
      s = S.heavy[e.st === 'chase' ? Math.floor(e.anim * 4) & 1 : 0];
      x = e.x - s.wd / 2; y = e.y - s.h + 1;
      if (e.st === 'recover') y += 1;
      spr(ctx, s, x, y, fl, white);
      var sx = e.x + e.face * 5;
      if (e.st === 'raise') {
        pline(ctx, sx, e.y - 10, sx - e.face * 3, e.y - 26, '#e6eeff'); pline(ctx, sx + 1, e.y - 10, sx - e.face * 3 + 1, e.y - 26, '#8fa3d6');
        ctx.fillStyle = '#ffc83a'; ctx.fillRect(Math.round(sx - 1), e.y - 11, 4, 2); drawBang(ctx, e);
      } else if (e.st === 'slam') { pline(ctx, e.x, e.y - 12, e.x + e.face * 26, e.y - 3, '#e6eeff'); pline(ctx, e.x, e.y - 11, e.x + e.face * 26, e.y - 2, '#8fa3d6'); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6; ctx.fillRect(Math.round(e.x + e.face * 20 - 2), e.y - 8, 4, 8); ctx.globalAlpha = 1; }
      else { pline(ctx, sx, e.y - 3, sx + e.face * 5, e.y - 14, '#e6eeff'); ctx.fillStyle = '#ffc83a'; ctx.fillRect(Math.round(sx - 1), e.y - 4, 3, 2); }
    }
  }
  function drawBang(ctx, e) {
    ctx.fillStyle = '#ffe14a'; var bx = Math.round(e.x) - 1, by = Math.round(e.y - e.hh - 9 + Math.sin(time * 20) * 0.6);
    ctx.fillRect(bx, by, 2, 5); ctx.fillRect(bx, by + 6, 2, 2);
    ctx.fillStyle = '#000'; ctx.globalAlpha = 0.5; ctx.fillRect(bx + 2, by + 1, 1, 5); ctx.globalAlpha = 1;
  }
  function drawShots(ctx) {
    var i, s, k;
    for (i = 0; i < shots.length; i++) {
      s = shots[i];
      if (s.k === 'arrow') {
        ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y)); ctx.rotate(Math.atan2(s.vy, s.vx));
        ctx.fillStyle = s.fr ? '#2ee6d6' : '#c8a060'; ctx.fillRect(-4, 0, 7, 1);
        ctx.fillStyle = '#e6eeff'; ctx.fillRect(3, -1, 2, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, -1, 1, 3);
        ctx.restore();
      } else if (s.k === 'kunai') {
        ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y)); ctx.rotate(Math.atan2(s.vy, s.vx));
        ctx.fillStyle = s.fr ? '#2ee6d6' : '#d0d6f0'; ctx.fillRect(-3, -1, 6, 2); ctx.fillStyle = '#ff3d5e'; ctx.fillRect(-5, -1, 2, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(2, -1, 1, 1);
        ctx.restore();
      } else if (s.k === 'wave') {
        var dd = sgn(s.vx), wx = Math.round(s.x), wy = Math.round(s.y);
        ctx.fillStyle = s.fr ? '#2ee6d6' : '#ffc83a'; ctx.fillRect(wx - 1, wy - 7, 3, 7); ctx.fillRect(wx - dd * 3 - 1, wy - 5, 2, 5); ctx.fillRect(wx - dd * 6 - 1, wy - 3, 2, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(wx, wy - 7, 1, 6); ctx.fillRect(wx - dd * 3, wy - 4, 1, 3);
      } else if (s.k === 'erupt') {
        var ex = Math.round(s.x), gy = Math.round(s.y);
        if (s.t < 0.75) {
          ctx.fillStyle = '#6a4a2a'; for (k = -4; k <= 4; k += 2) ctx.fillRect(ex + k, gy - 1 - ((Math.floor(s.t * 30) + k) & 1), 1, 1);
          ctx.fillStyle = Math.floor(s.t * 14) % 2 ? '#ffe14a' : '#ff6a3a'; ctx.fillRect(ex - 5, gy, 10, 1);
          if (Math.floor(s.t * 20) % 3 === 0) { ctx.fillStyle = '#c8a050'; ctx.fillRect(ex - 3 + (Math.floor(s.t * 40) % 5), gy - 3, 1, 2); }
        } else {
          var up = s.t < 0.9 ? (s.t - 0.75) / 0.15 : s.t < 1.2 ? 1 : 1 - (s.t - 1.2) / 0.25, hh = Math.round(22 * clamp(up, 0, 1));
          for (k = 0; k < 3; k++) {
            var sh = Math.max(2, hh - (k === 1 ? 0 : 5)), sx2 = ex - 4 + k * 3;
            ctx.fillStyle = '#7ce39a'; ctx.fillRect(sx2, gy - sh, 2, sh); ctx.fillStyle = '#e6ffe0'; ctx.fillRect(sx2, gy - sh, 1, sh);
            ctx.fillStyle = '#12603c'; ctx.fillRect(sx2 + 1, gy - sh + 2, 1, Math.max(0, sh - 2));
          }
        }
      }
    }
  }

  function drawBoss(ctx, b) {
    var s, x, y, fl = b.face > 0, white = b.hurtT > 0 || b.enrage > 0 && Math.floor(time * 20) % 2 === 0, i, a;
    if (b.st === 'dead') {
      if (Math.floor(phaseT * 20) % 2) return;
      white = Math.floor(phaseT * 10) % 2 === 0;
    }
    if (b.st === 'intro') {
      if (b.t < 0.5) return;
      white = Math.floor(b.t * 20) % 2 === 0;
    }
    if (b.kind === 0) {
      s = S.shade.idle;
      if (b.st === 'dash' || b.st === 'dash2') { s = b.sub === 0 ? S.shade.fall : b.sub === 1 ? S.shade.run1 : S.shade.fall; if (b.sub === 0) white = white || Math.floor(b.t * 18) % 2 === 0; }
      else if (b.st === 'fan' || b.st === 'fan2') { if (b.sub === 0) white = white || Math.floor(b.t * 16) % 2 === 0; }
      else if (Math.abs(b.vx) > 5) s = S.shade.run2;
      x = b.x - s.wd / 2; y = b.y - s.h + 1;
      if (b.st === 'dash' || b.st === 'dash2') {
        if (b.sub === 1) { for (i = 1; i <= 3; i++) { ctx.globalAlpha = 0.45 - i * 0.1; spr(ctx, s, x - b.face * i * 9, y, fl); } ctx.globalAlpha = 1; }
        if (b.sub === 0) { ctx.fillStyle = '#ff3d5e'; ctx.globalAlpha = 0.5; for (i = 0; i < 4; i++) ctx.fillRect(Math.round(b.x + b.face * (10 + i * 8)), Math.round(b.y - 6), 4, 1); ctx.globalAlpha = 1; }
      }
      if ((b.st === 'dash' || b.st === 'dash2') && b.sub === 2 || (b.sub === 1 && (b.st === 'fan' || b.st === 'fan2'))) y += 1;
      spr(ctx, s, x, y, fl, white);
      // scarf
      for (i = 1; i <= 6; i++) { ctx.fillStyle = i & 1 ? '#ff3d6e' : '#a8143a'; ctx.fillRect(Math.round(b.x - b.face * (2 + i * 2)), Math.round(b.y - 10 + Math.sin(time * 14 + i) * i * 0.4), 2, 2); }
      if ((b.st === 'fan' || b.st === 'fan2') && b.sub === 0) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(Math.round(b.x + b.face * 5), Math.round(b.y - 17), 2, 3); }
    } else if (b.kind === 1) {
      s = !b.ground ? S.mask.air : (b.st === 'slam' && b.sub === 0 || b.st === 'spikes' && b.sub === 0) ? S.mask.crouch : S.mask.idle;
      if (b.sub === 0 && (b.st === 'slam' || b.st === 'spikes')) white = white || Math.floor(b.t * 16) % 2 === 0;
      x = b.x - s.wd / 2; y = b.y - s.h + 1;
      if (b.st === 'slam' && b.sub === 0) {                         // landing marker
        ctx.fillStyle = Math.floor(b.t * 12) % 2 ? '#ff3d5e' : '#ffe14a';
        ctx.fillRect(Math.round(b.tx) - 9, b.y - 2, 18, 2); ctx.fillRect(Math.round(b.tx) - 6, b.y - 4, 12, 2); ctx.fillRect(Math.round(b.tx) - 3, b.y - 6, 6, 2);
      }
      spr(ctx, s, x, y, fl, white);
      if (b.st === 'spikes' && b.sub === 0) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y - b.hh - 8), 2, 5); ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y - b.hh - 2), 2, 2); }
    } else {
      s = S.war[Math.abs(b.vx) > 5 ? Math.floor(b.anim * 6) & 1 : 0];
      x = b.x - s.wd / 2; y = b.y - s.h + 1;
      if (b.st === 'charge' && b.sub === 0) white = white || Math.floor(b.t * 16) % 2 === 0;
      if (b.st === 'combo' && b.sub === 1) white = white || Math.floor(b.t * 18) % 2 === 0;
      spr(ctx, s, x, y, fl, white);
      // blade
      var sx = b.x + b.face * 7, e2 = b.st === 'combo' ? b.sub : -1;
      if (e2 === 1) { pline(ctx, sx, b.y - 12, sx - b.face * 4, b.y - 34, '#e6eeff'); pline(ctx, sx + 1, b.y - 12, sx - b.face * 4 + 1, b.y - 34, '#8fa3d6'); ctx.fillStyle = '#ffc83a'; ctx.fillRect(sx - 2, b.y - 13, 5, 2); }
      else if (e2 === 2) { for (a = 0; a < 3; a++) pline(ctx, b.x, b.y - 14 + a, b.x + b.face * 31, b.y - 2 + a, a === 1 ? '#ffffff' : '#bff8ff'); }
      else if (b.st === 'charge' && b.sub === 1) { pline(ctx, sx, b.y - 8, sx + b.face * 16, b.y - 8, '#e6eeff'); pline(ctx, sx, b.y - 7, sx + b.face * 16, b.y - 7, '#8fa3d6'); }
      else { pline(ctx, sx, b.y - 3, sx + b.face * 6, b.y - 18, '#e6eeff'); ctx.fillStyle = '#ffc83a'; ctx.fillRect(sx - 1, b.y - 4, 3, 2); }
    }
    if ((b.sub === 2 && (b.st === 'dash' || b.st === 'dash2' || b.st === 'charge')) || (b.st === 'combo' && b.sub === 3)) {   // stunned: circling stars
      for (i = 0; i < 3; i++) { a = time * 6 + i * 2.1; ctx.fillStyle = '#ffe14a'; ctx.fillRect(Math.round(b.x + Math.cos(a) * 7), Math.round(b.y - b.hh - 4 + Math.sin(a) * 2), 2, 2); }
    }
  }

  function drawHud(ctx, w, h) {
    var i, s;
    R.draw.topBar(ctx);
    spr(ctx, S.life, 52, 1);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 12, w, 8);
    for (i = 0; i < MAX_HEARTS; i++) {
      s = i < hearts ? S.heart : S.heartE;
      spr(ctx, s, 2 + i * 10, 11.5 + (hearts === 1 && i === 0 && Math.floor(time * 4) % 2 ? 1 : 0));
    }
    // shuriken counter
    var low = ammo === 0 || ammoBlink > 0;
    spr(ctx, S.star[0], 36, 11.5);
    R.draw.text(ctx, 'x' + ammo, 46, 13, { size: 6, color: low && Math.floor(time * 10) % 2 ? '#ff6a6a' : '#e6eeff', shadow: '#000' });
    R.draw.text(ctx, 'STAGE ' + (stageIdx + 1), w - 3, 13, { size: 6, color: '#2ee6d6', align: 'right', shadow: '#000' });
    if (boss && boss.st !== 'dead') {                                 // boss bar over the floor
      var bw = 92, bx = Math.round((w - bw) / 2), by = h - 9, fillw = Math.round(bw * clamp(boss.hp / boss.max, 0, 1));
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 8);
      ctx.fillStyle = '#3a1020'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = boss.p2 ? '#ff6a3a' : '#ff3d5e'; ctx.fillRect(bx, by, fillw, 4);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(bx, by, fillw, 1);
      ctx.fillStyle = '#ffe14a'; ctx.fillRect(bx + Math.round(bw / 2), by - 1, 1, 6);
    }
    if (phase === 'play' && !boss && R.mode === 'play' && !(banner > 0)) {
      for (i = 0; i < lv.hints.length; i++) {
        if (Math.abs(lv.hints[i].x - hero.x) < 46 && lv.hints[i].lines.length) {
          var ln = lv.hints[i].lines;
          ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(4, 24, w - 8, 6 + ln.length * 9);
          ctx.fillStyle = '#2ee6d6'; ctx.fillRect(4, 24, w - 8, 1);
          for (var q = 0; q < ln.length; q++) R.draw.text(ctx, ln[q], w / 2, 28 + q * 9, { size: 6, color: '#dffcff', align: 'center', shadow: '#000' });
          break;
        }
      }
    }
    if (banner > 0 && phase === 'play' && !boss && R.mode === 'play') {
      var a = Math.min(1, banner * 2);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 54, w, 34);
      R.draw.text(ctx, 'STAGE ' + (stageIdx + 1), w / 2, 60, { size: 8, color: '#2ee6d6', align: 'center', shadow: '#000' });
      R.draw.text(ctx, lv.def.name, w / 2, 73, { size: 8 - (lv.def.name.length > 15 ? 2 : 0), color: '#ffffff', align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (boss && boss.st === 'intro') {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 54, w, 34);
      R.draw.text(ctx, 'WARNING', w / 2, 60, { size: 8, color: Math.floor(boss.t * 8) % 2 ? '#ff3d5e' : '#ffe14a', align: 'center', shadow: '#000' });
      R.draw.text(ctx, BOSSES[boss.kind].name, w / 2, 73, { size: 8, color: '#ffffff', align: 'center', shadow: '#000' });
    }
    if (phase === 'clear' && tally) {
      var tw = Math.min(1, phaseT / 0.5), yy = 40;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, yy - 6, w, 58 * tw);
      if (phaseT > 0.4) {
        R.draw.text(ctx, stageIdx === STAGES.length - 1 ? 'ALL CLEAR' : 'STAGE CLEAR', w / 2, yy, { size: 8, color: '#ffe14a', align: 'center', shadow: '#a85a00' });
        if (phaseT > 0.9) R.draw.text(ctx, 'BOSS   +' + tally.boss, w / 2, yy + 16, { size: 6, color: '#ffffff', align: 'center', shadow: '#000' });
        if (phaseT > 1.4) R.draw.text(ctx, 'HEARTS +' + tally.hearts, w / 2, yy + 28, { size: 6, color: '#ff8fa8', align: 'center', shadow: '#000' });
        if (phaseT > 1.9) R.draw.text(ctx, 'TIME   +' + tally.time, w / 2, yy + 40, { size: 6, color: '#2ee6d6', align: 'center', shadow: '#000' });
      }
    }
    if (phase === 'win') {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 48, w, 52);
      R.draw.text(ctx, 'MISSION', w / 2, 54, { size: 16, color: '#ffe14a', align: 'center', shadow: '#a85a00' });
      R.draw.text(ctx, 'COMPLETE', w / 2, 72, { size: 16, color: '#2ee6d6', align: 'center', shadow: '#0a4a44' });
    }
  }
})();
