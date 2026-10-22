/* Rune Dungeon — screen-by-screen action-adventure, built on the Retro SDK */
(function () {
  var R = Retro, C = R.colors, U = R.util, D = R.draw;
  var TS = 12, RW = 11, RH = 9, PW = RW * TS, PH = RH * TS;      // tile, room size in tiles, room size in px
  var OX = 2, OY = 16;                                           // where a room sits on the 136x164 screen
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];                    // 0 up · 1 right · 2 down · 3 left
  var HB = 8, SWR = 11, SWING = 0.22, TRANS_T = 0.34;            // hero box, sword reach, swing time, room flip time
  var DOORT = [[5, 0], [10, 4], [5, 8], [0, 4]];                 // doorway tile of each side (n e s w)
  var SIDE = { n: 0, e: 1, s: 2, w: 3 };

  /* ------------------------------------------------------------ helpers */
  function grid(w, h, fn) { var rows = [], x, y, r; for (y = 0; y < h; y++) { r = ''; for (x = 0; x < w; x++) r += fn(x, y); rows.push(r); } return rows; }
  function mirror(half) { return half.map(function (r) { return r + r.split('').reverse().join(''); }); }
  function outline(rows, ch) {
    var h = rows.length, w = rows[0].length;
    return rows.map(function (r, y) {
      var o = '', x;
      for (x = 0; x < w; x++) {
        var c = r.charAt(x);
        if (c !== '.') { o += c; continue; }
        var n = (y > 0 && rows[y - 1].charAt(x) !== '.') || (y < h - 1 && rows[y + 1].charAt(x) !== '.') ||
          (x > 0 && r.charAt(x - 1) !== '.') || (x < w - 1 && r.charAt(x + 1) !== '.');
        o += n ? ch : '.';
      }
      return o;
    });
  }
  function hsh(x, y, s) { var n = (x * 374761393 + y * 668265263 + s * 144665) | 0; n = (n ^ (n >> 13)) * 1274126177 | 0; return ((n ^ (n >> 16)) >>> 0) % 100; }
  function checkRows(name, rows, w, h) {
    if (rows.length !== h) throw new Error('sprite ' + name + ' has ' + rows.length + ' rows, want ' + h);
    rows.forEach(function (r, i) { if (r.length !== w) throw new Error('sprite ' + name + ' row ' + i + ' has ' + r.length + ' chars, want ' + w); });
  }
  function whiten(pal) { var o = {}, k; for (k in pal) o[k] = '#ffffff'; return o; }
  function inside(px, py, r) { return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h; }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function burst(x, y, o) { R.fx.burst(OX + x, OY + y, o); }
  function ftext(x, y, s, c) { R.fx.text(OX + x, OY + y, s, c); }
  function two(n) { return n < 10 ? '0' + n : '' + n; }

  /* ------------------------------------------------------------ sprites */
  var HERO_PAL = { o: '#8a3d12', O: '#ff9a2e', S: '#ffd0a8', e: '#1d2b53', b: '#1b4fb3', B: '#3d8bff', g: '#fff0c0', n: '#7a4a22' };
  var HERO = {
    d: { head: ['....oooo....', '...oOOOOo...', '..oOOOOOOo..', '..oOSSSSOo..', '..SSeSSeSS..', '...SSSSSS...'],
      body: ['..bBBBBBBb..', '.bBBggggBBb.', '.bBSggggSBb.', '..bBggggBb..'],
      legs: [['...gg..gg...', '...nn..nn...'], ['...gg..gg...', '..nn....nn..']] },
    u: { head: ['....oooo....', '...oOOOOo...', '..oOOOOOOo..', '..oOOOOOOo..', '..oOOOOOOo..', '...oOOOOo...'],
      body: ['..bBBBBBBb..', '.bBBBBBBBBb.', '.bBBBBBBBBb.', '..bBBBBBBb..'],
      legs: [['...gg..gg...', '...nn..nn...'], ['...gg..gg...', '..nn....nn..']] },
    r: { head: ['....oooo....', '...oOOOOo...', '..oOOOOOOo..', '..oOOOSSSS..', '..oOOSSeSS..', '...oOSSSSS..'],
      body: ['..bbBBBBS...', '.bBBBggggS..', '.bBBBgggg...', '..bBBgggg...'],
      legs: [['...gg.gg....', '...nn.nn....'], ['....gggg....', '....nnnn....']] }
  };
  function heroRows(k, f) { var s = HERO[k]; return s.head.concat(s.body, s.legs[f]); }

  var SLIME_ROWS = [[
    '............', '............', '....gggg....', '...gGGGGg...', '..gGwwGGGg..', '.gGwGGGGGGg.',
    '.gGGeGGeGGg.', '.gGGGGGGGGg.', 'gGGGGGGGGGGg', 'gggggggggggg', '............', '............'], [
    '............', '....gggg....', '...gGGGGg...', '..gGwwGGGg..', '..gGGGGGGg..', '..gGeGGeGg..',
    '..gGGGGGGg..', '.gGGGGGGGGg.', '.gGGGGGGGGg.', '.gggggggggg.', '............', '............']];
  var SLIME_PAL = { 1: { g: '#1f9a3a', G: '#4cd964', w: '#c8ffd0', e: '#1d2b53' }, 2: { g: '#1d5fb0', G: '#3dc6ff', w: '#d8f6ff', e: '#1d2b53' } };
  var BAT_ROWS = [[
    '............', 'pp........pp', 'ppp..kk..ppp', 'pPpp.kk.ppPp', 'pPPpkrkrpPPp', '.pPpkkkkpPp.',
    '..p.kwwk.p..', '............', '............', '............', '............', '............'], [
    '............', '............', '............', '.....kk.....', '..pp.kk.pp..', '.pPpkrkrpPp.',
    'pPPpkkkkpPPp', 'ppPp.kk.pPpp', 'pp..kwwk..pp', 'p..........p', '............', '............']];
  var BAT_PAL = { 1: { p: '#8a4fd0', P: '#cfa0ff', k: '#241638', r: '#ff3a3a', w: '#ffffff' }, 2: { p: '#e0701c', P: '#ffc060', k: '#3a1410', r: '#ffec27', w: '#ffffff' } };
  var SKEL_ROWS = ['...wwwwww...', '..wwwwwwww..', '..wkkwwkkw..', '..wkrwwrkw..', '...wwkkww...', '....wkkw....',
    '..dwwwwwwd..', '.d.wkwwkw.d.', '.d.wwkkww.d.', '...wkwwkw...', '...ww..ww...', '..ddd..ddd..'];
  var SKEL_PAL = { 1: { w: '#f4f0e0', d: '#b3ab98', k: '#2a2f48', r: '#ff4040' }, 2: { w: '#ffe9b8', d: '#d49a60', k: '#3a1a1a', r: '#ffec27' } };

  var GLOOP_HALF = ['....y...y..y', '....yy..yyyy', '....yyyyyyyy', '......GGGGGG', '....GGGGGGGG', '..GGGGGGGGGG', '.GGwwGGGGGGG', '.GwwwGGGGGGG', 'GGGwKKGGGGGG',
    'GGGGKKKGGGGG', 'GGGGGGGGGGGG', 'GGGGGGGGKKKK', 'GGGGGGGKKwww', 'GGGGGGGGKKKK', 'gGGGGGGGGGGG', 'gggGGGGGGGGG', '.gggggggggg.'];
  var GLOOP_PAL = { y: '#ffd23a', G: '#5ce06a', g: '#1f8a3a', w: '#e8ffe8', K: '#1d2b53' };
  var WRAITH_HALF = ['......hh', '.....hhh', '....hhhh', '...hhhhh', '...hhddd', '..hhdeed', '..hhdddd', '..hhhddd', '..hhhhhh', '.hhhhhhh', '.hhMhhhh', '.hhMMhhh', 'hhhMMMhh', 'hhhhMMMM', 'hhhhhMMM', '.hhhhhMM', '..hhhhhM', '...hhhhh', '....hhhh', '.....hh.'];
  var WRAITH_PAL = { h: '#5a2a9a', d: '#120a22', e: '#ffec27', M: '#8a4fe0' };

  var ICON = {
    key: ['............', '....yyyy....', '...yYYYYy...', '...yY..Yy...', '...yY..Yy...', '...yYYYYy...', '....yyyy....', '.....yY.....', '.....yY.....', '.....yYyy...', '.....yY.....', '.....yYyy...'],
    gem: ['............', '............', '....cccc....', '...cwwCCc...', '..cwCCCCCc..', '..cCCCCCCc..', '...cCCCCc...', '....cCCc....', '.....cc.....', '............', '............', '............'],
    chestC: ['............', '.oooooooooo.', '.ohhhhhhhho.', '.oggggggggo.', '.oggggggggo.', '.oyyyyyyyyo.', '.oggyyyyggo.', '.oggyyyyggo.', '.oddddddddo.', '.oooooooooo.', '............', '............'],
    chestO: ['.oooooooooo.', '.ohhhhhhhho.', '.oggggggggo.', '.oooooooooo.', '.okkkkkkkko.', '.okkkkkkkko.', '.oggggggggo.', '.oyyyyyyyyo.', '.oggggggggo.', '.oddddddddo.', '.oooooooooo.', '............'],
    heartc: ['............', '..hh....hh..', '.hRRh..hRRh.', 'hRwRRhhRRRRh', 'hRwRRRRRRRRh', 'hRRRRRRRRRRh', '.hRRRRRRRRh.', '..hRRRRRRh..', '...hRRRRh...', '....hRRh....', '.....hh.....', '............']
  };
  var ICON_PAL = {
    key: { y: '#c98a00', Y: '#ffd23a' }, bosskey: { y: '#a01840', Y: '#ff6a8a' }, gem: { c: '#1d7fb0', w: '#ffffff', C: '#3de2ff' },
    chest: { o: '#2a1608', h: '#e0a050', g: '#b06a28', d: '#7a4418', y: '#ffd23a', k: '#1a1008' }, heartc: { h: '#7a1020', R: '#ff3a4d', w: '#ffd0d8' }
  };
  var HEART = ['.xx.xx.', 'xhxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
  var HEART_FULL = HEART, HEART_HALF = HEART.map(function (r) { return r.replace(/x/g, function (c, i) { return i >= 4 ? 'd' : c; }); }), HEART_EMPTY = HEART.map(function (r) { return r.replace(/[xh]/g, 'd'); });
  var HEART_PAL = { x: '#ff3a4d', h: '#ffc0c8', d: '#4a2030' };

  var TH = {
    1: { name: 'MOSSY RUINS', fa: '#3a3f5c', fb: '#464c6e', fc: '#2f3350', wl: '#8c92bd', wm: '#6a709c', wn: '#575c84', wk: '#262a40', mo: '#4cd964',
      x: '#07070f', y: '#14172b', z: '#232848', accent: '#4cd964' },
    2: { name: 'EMBER VAULT', fa: '#4a2530', fb: '#583140', fc: '#3a1b25', wl: '#d0705a', wm: '#a64a3c', wn: '#8a3c34', wk: '#33171a', mo: '#ff8a2a',
      x: '#c8280e', y: '#ff6a1f', z: '#ffc040', accent: '#ff8a2a' }
  };
  var tileCache = {}, spriteCache = {};
  function S(key, rows, pal) { var k = key; if (!spriteCache[k]) spriteCache[k] = R.sprite(rows, pal, 1); return spriteCache[k]; }

  function buildTiles(th) {
    var t = TH[th], T = {}, f;
    var fp = { a: t.fa, b: t.fb, c: t.fc };
    T.floorA = R.sprite(grid(12, 12, function (x, y) { if (x === 0 || y === 0) return 'b'; return hsh(x, y, 1) < 7 ? 'c' : 'a'; }), fp, 1);
    T.floorB = R.sprite(grid(12, 12, function (x, y) { if (x === 0 || y === 0) return 'b'; return hsh(x, y, 9) < 12 ? 'c' : 'a'; }), fp, 1);
    T.wall = R.sprite(grid(12, 12, function (x, y) {
      var by = (y / 6) | 0, yy = y % 6, xx = (x + (by ? 3 : 0)) % 6;
      if (yy === 5 || xx === 5) return 'K';
      if (hsh(x, y, 4) < (th === 1 ? 9 : 5) && yy > 0 && xx > 0) return 'm';
      if (yy === 0 || xx === 0) return 'L';
      return (yy === 4 || xx === 4) ? 'N' : 'M';
    }), { L: t.wl, M: t.wm, N: t.wn, K: t.wk, m: t.mo }, 1);
    for (f = 0; f < 2; f++) {
      T['chasm' + f] = R.sprite(grid(12, 12, function (x, y) {
        if (th === 1) { var h = hsh(x, y, 3 + f); return h < 3 ? 'z' : (h < 14 ? 'y' : 'x'); }
        var q = hsh((x + f * 3) >> 1, (y + f * 2) >> 1, 7); return q < 14 ? 'z' : (q < 55 ? 'y' : 'x');
      }), { x: t.x, y: t.y, z: t.z }, 1);
    }
    T.pillar = R.sprite(outline(grid(12, 12, function (x, y) {
      var dx = x - 5.5, dy = y - 5.5, r = Math.sqrt(dx * dx + dy * dy);
      if (r > 5.1) return '.'; if (r > 4.2) return 'K'; if (r < 2.2) return (dx + dy < 0) ? 'L' : 'M';
      return (dx + dy < -1) ? 'L' : (dx + dy > 2) ? 'N' : 'M';
    }), 'K'), { L: t.wl, M: t.wm, N: t.wn, K: t.wk }, 1);
    T.pot = R.sprite(outline(grid(12, 12, function (x, y) {
      var dx = (x - 5.5) / 4.4, dy = (y - 7) / 3.9;
      var body = dx * dx + dy * dy <= 1, neck = x >= 4 && x <= 7 && y >= 2 && y <= 4, rim = x >= 3 && x <= 8 && y === 2;
      if (!(body || neck || rim)) return '.';
      if (y === 2) return 'r';
      return x < 4 ? 'r' : (x > 7 ? 's' : 'q');
    }), 'p'), { p: '#4a2210', q: '#d98b3a', r: '#f7b967', s: '#a35a1f' }, 1);
    T.crystalOff = R.sprite(outline(grid(12, 12, function (x, y) {
      var v = Math.abs(x - 5.5) / 4.2 + Math.abs(y - 5.5) / 5; return v > 1 ? '.' : ((x < 5 && y < 6) ? 'U' : 'u');
    }), 'e'), { u: '#6a7aa8', U: '#9fb0e0', e: '#1d2b53' }, 1);
    T.crystalOn = R.sprite(outline(grid(12, 12, function (x, y) {
      var v = Math.abs(x - 5.5) / 4.2 + Math.abs(y - 5.5) / 5; return v > 1 ? '.' : ((x < 6 && y < 6) ? 'V' : 'v');
    }), 'e'), { v: '#3de2ff', V: '#e8fdff', e: '#1d2b53' }, 1);
    T.gate = R.sprite(grid(12, 12, function (x, y) {
      if ((x >= 1 && x <= 2) || (x >= 5 && x <= 6) || (x >= 9 && x <= 10)) return (x === 1 || x === 5 || x === 9) ? 'I' : 'i';
      if (y >= 2 && y <= 3) return 'i'; if (y >= 8 && y <= 9) return 'i'; return '.';
    }), { i: '#59607e', I: '#a8b0d8' }, 1);
    T.shutter = R.sprite(grid(12, 12, function (x, y) {
      if ((x >= 1 && x <= 2) || (x >= 5 && x <= 6) || (x >= 9 && x <= 10)) return (x === 1 || x === 5 || x === 9) ? 'I' : 'i';
      if (y >= 5 && y <= 6) return 'i'; return '.';
    }), { i: '#7a3030', I: '#e06a6a' }, 1);
    T.door = R.sprite(grid(12, 12, function (x, y) {
      if (x === 0 || y === 0 || x === 11 || y === 11) return 'k';
      if (x >= 5 && x <= 6 && y >= 4 && y <= 7) return y === 4 || y === 7 ? 'y' : 'k';
      if (x === 5 || x === 6 || x === 1) return 'k';
      return (y % 4 === 1) ? 'W' : 'w';
    }), { k: '#2a1608', w: '#a8662a', W: '#cf914a', y: '#ffd23a' }, 1);
    T.bossdoor = R.sprite(grid(12, 12, function (x, y) {
      if (x === 0 || y === 0 || x === 11 || y === 11) return 'k';
      var dx = x - 5.5, dy = y - 5.5;
      if (dx * dx + dy * dy < 7) { return (Math.abs(dx) > 1.2 && y < 6 && y > 3 && Math.abs(dx) < 3) ? 'k' : 'R'; }
      return (x + y) % 5 === 0 ? 'I' : 'i';
    }), { k: '#1a1228', i: '#59607e', I: '#8a92b8', R: '#ff3a4d' }, 1);
    T.plate = R.sprite(grid(12, 12, function (x, y) {
      if (x < 2 || y < 2 || x > 9 || y > 9) return '.'; if (x === 2 || y === 2 || x === 9 || y === 9) return 'k'; return (x === 3 || y === 3) ? 'G' : 'g';
    }), { k: '#14162a', g: '#6c7392', G: '#9aa3c8' }, 1);
    T.plateOn = R.sprite(grid(12, 12, function (x, y) {
      if (x < 2 || y < 2 || x > 9 || y > 9) return '.'; if (x === 2 || y === 2 || x === 9 || y === 9) return 'k'; return (x > 3 && x < 8 && y > 3 && y < 8) ? 'L' : 'g';
    }), { k: '#14162a', g: '#2f7a4a', L: '#7dffa0' }, 1);
    T.block = R.sprite(grid(12, 12, function (x, y) {
      if (x === 0 || y === 0) return 'L'; if (x === 11 || y === 11) return 'K';
      if (x === 1 || y === 1) return 'L'; if (x === 10 || y === 10) return 'K';
      if (x >= 4 && x <= 7 && y >= 4 && y <= 7) return (x === 4 || x === 7 || y === 4 || y === 7) ? 'r' : 'K';
      return 'M';
    }), { L: '#c4cbf0', M: '#868ec0', K: '#3e4268', r: '#4cd9ff' }, 1);
    for (f = 0; f < 2; f++) {
      T['fount' + f] = R.sprite(outline(grid(12, 12, function (x, y) {
        var dx = x - 5.5, dy = y - 5.5, r = Math.sqrt(dx * dx + dy * dy);
        if (r > 5.1) return '.'; if (r > 4) return 'L'; if (r < 1.3) return 'L';
        return (hsh(x, y, 20 + f) < 14) ? 'W' : (r < 2.6 ? 'B' : 'A');
      }), 'K'), { L: t.wl, K: t.wk, A: '#2f86e8', B: '#7cc4ff', W: '#ffffff' }, 1);
    }
    for (f = 0; f < 4; f++) {
      T['portal' + f] = R.sprite(grid(12, 12, function (x, y) {
        var dx = x - 5.5, dy = y - 5.5, r = Math.sqrt(dx * dx + dy * dy); if (r > 5.6) return '.';
        var a = Math.atan2(dy, dx) + f * 0.8 + r * 0.9, v = Math.sin(a * 2);
        return r < 1.4 ? 'W' : (v > 0.3 ? 'P' : 'p');
      }), { p: '#5a2ab0', P: '#3de2ff', W: '#ffffff' }, 1);
    }
    return T;
  }
  function tiles(th) { return tileCache[th] || (tileCache[th] = buildTiles(th)); }

  /* ------------------------------------------------------------ dungeons
   * Interior of a room is 9 x 7 tiles (the border and doorways come from `ex`).
   *  . floor  # wall  T pillar  v chasm/lava  P pot  Y pot with a key  B push-block  p floor plate  o crystal switch
   *  G gate (opens when the room's switch is hit)  C chest  F healing fountain  > rune portal
   *  S slime  A bat  K skeleton guard  M mini-boss  W final boss
   * ex: n/e/s/w = 'o' open · 'D' locked (small key) · 'N' boss door (boss key).
   * trap: doors seal until every enemy is down.  reward: dropped when the room is cleared. */
  var DUN = {
    1: { name: 'MOSSY RUINS', theme: 1, cols: 5, rows: 4, start: { id: '0,3', x: 62, y: 74 }, rooms: {
      '0,3': { ex: { n: 'o', e: 'o' }, rows: ['P.......P', '.........', '...TFT...', '.........', '.........', '.........', 'P.......P'] },
      '1,3': { ex: { w: 'o', e: 'o', n: 'o' }, rows: ['.........', '.P.....P.', '...S.S...', '.........', '..T...T..', '.S.......', 'P.......P'] },
      '2,3': { ex: { w: 'o' }, chest: 'bow', rows: ['......#C#', '......#G#', '..B......', '.........', '.T.....T.', '.....p...', 'P.......P'] },
      '0,2': { ex: { s: 'o', n: 'o', e: 'o' }, rows: ['.........', '.T.....T.', '....A....', '.........', '....A....', '.T.....T.', '.Y.....P.'] },
      '1,2': { ex: { w: 'o', s: 'o', n: 'o', e: 'D' }, rows: ['.........', '..#...#..', '....K....', '.........', '..S...S..', '..#...#..', 'P.......P'] },
      '2,2': { ex: { w: 'D', n: 'o', e: 'o' }, rows: ['.........', '.P.....P.', '...v.v...', '.A.v.v.A.', '...v.v...', '....K....', '.........'] },
      '3,2': { ex: { w: 'o' }, chest: 'bosskey', needAmmo: 3, rows: ['A........', '.P.....P.', '......#C#', '......#G#', '...vvv...', '...vov...', '...vvv..A'] },
      '0,1': { ex: { s: 'o', e: 'o', n: 'o' }, rows: ['.........', '.S.....S.', '..P...P..', '.........', '..T...T..', '.....S...', 'P.......P'] },
      '1,1': { ex: { n: 'o', s: 'o', w: 'o' }, trap: true, reward: 'heart', rows: ['.........', '..T...T..', '..K...K..', '.........', '....A....', '..T...T..', '.........'] },
      '0,0': { ex: { s: 'o', e: 'o' }, chest: 'heartc', rows: ['#C#......', '#G#......', '.........', '.....BT..', '...S.....', '.T.....p.', 'P.......P'] },
      '1,0': { ex: { w: 'o', s: 'o' }, rows: ['.P.....P.', '.........', '..K...S..', '.........', '..T...T..', '.........', 'P.......P'] },
      '2,1': { ex: { s: 'o', e: 'D' }, trap: true, reward: 'key', rows: ['.........', '.K.....K.', '.........', '.........', '...A.A...', '.P.....P.', '.........'] },
      '3,1': { ex: { w: 'D', e: 'N' }, rows: ['P.......P', '.........', '..T.F.T..', '.........', '.........', '.........', 'P.......P'] },
      '4,1': { ex: { w: 'N', n: 'o' }, trap: true, boss: 'gloop', rows: ['.........', '.T.....T.', '.........', '....M....', '.........', '.T.....T.', '.........'] },
      '4,0': { ex: { s: 'o' }, chest: 'gems', rows: ['P.T...T.P', '.........', '...C.....', '....>....', '.........', '.........', '.........'] }
    } },
    2: { name: 'EMBER VAULT', theme: 2, cols: 3, rows: 3, start: { id: '0,2', x: 62, y: 74 }, rooms: {
      '0,2': { ex: { e: 'o' }, rows: ['P.......P', '.........', '...TFT...', '.........', '.........', '.........', 'P.......P'] },
      '1,2': { ex: { w: 'o', e: 'o', n: 'D' }, rows: ['.........', '..v...v..', '....K....', '.........', '..A...A..', '..v...v..', 'P.......P'] },
      '2,2': { ex: { w: 'o', n: 'o' }, rows: ['..P...P..', '.A.....A.', '....K....', '.........', '..T...T..', '....S....', 'Y.......P'] },
      '2,1': { ex: { s: 'o' }, chest: 'heartc', needAmmo: 3, rows: ['#C#......', '#G#..vvv.', '.....vov.', '....Svvv.', '.........', '.P.....P.', '.........'] },
      '1,1': { ex: { s: 'D', w: 'o', n: 'o' }, rows: ['.........', '.T.....T.', '..K...K..', '.........', '..A...A..', '.T.....T.', '.........'] },
      '0,1': { ex: { e: 'o', n: 'o' }, rows: ['.........', '..v...v..', '.........', '....K....', '.........', '..A...A..', 'P.......P'] },
      '0,0': { ex: { s: 'o', e: 'o' }, chest: 'bosskey', rows: ['#C#......', '#G#......', '..B......', '....v....', '..K.v.K..', '.P..v.p..', 'P.......P'] },
      '1,0': { ex: { w: 'o', s: 'o', e: 'N' }, rows: ['P.......P', '.........', '..T.F.T..', '.........', '.........', '.........', 'P.......P'] },
      '2,0': { ex: { w: 'N' }, trap: true, boss: 'wraith', rows: ['.........', '.v.....v.', '.........', '....W....', '.........', '.v.....v.', '.........'] }
    } }
  };

  /* ------------------------------------------------------------ state */
  var intro, dg, DG, cur, trans, hero, sav, ammo, keys, hasBow, bossKey, clock, banner, winT, bump, hit, hitBlock, hitTx, hitTy, gotMsg;
  var GOT_TEXT = { bow: 'GOT THE BOW!', bosskey: 'BOSS KEY!', heartc: 'HEART CONTAINER!', gems: 'TREASURE!', key: 'SMALL KEY' };

  function freshSave() { return { opened: {}, sw: {}, cleared: {}, broken: {}, got: {}, visited: {}, chests: {}, bossDead: {}, bossHp: {} }; }
  function rid(c, r) { return c + ',' + r; }
  function neighbour(id, d) { var p = id.split(','); return rid(+p[0] + DX[d], +p[1] + DY[d]); }
  function doorKey(id, d) { var n = neighbour(id, d); return dg + ':' + (id < n ? id + '|' + n : n + '|' + id); }
  function sk(id) { return dg + ':' + id; }
  function visitedKey(id) { return dg + ':' + id; }

  /* ------------------------------------------------------------ rooms */
  function mkEnemy(ch, tx, ty) {
    var kind = { S: 'slime', A: 'bat', K: 'skel', M: 'gloop', W: 'wraith' }[ch], d = dg - 1;
    var e = { k: kind, x: tx * TS + 2, y: ty * TS + 2, w: 8, h: 8, dir: U.randInt(0, 4), st: 0, t: U.rand(0.2, 0.9), hurt: 0, kT: 0, kx: 0, ky: 0, cool: 0,
      fly: false, anim: U.rand(0, 1), vx: 0, vy: 0, dmg: 1, hp: 1, sp: 20, boss: false };
    if (kind === 'slime') { e.hp = 2 + d; e.sp = 26 + d * 8; e.dmg = 1 + d; }
    else if (kind === 'bat') { e.hp = 1 + d; e.sp = 46 + d * 12; e.dmg = 1 + d; e.fly = true; e.h = 7; e.t = 0; }
    else if (kind === 'skel') { e.hp = 3 + d; e.sp = 24 + d * 5; e.dmg = 2 + d; e.dir = U.randInt(0, 4); }
    else if (kind === 'gloop') {
      e.w = 18; e.h = 14; e.x = tx * TS - 3; e.y = ty * TS - 1; e.hp = e.maxHp = 14; e.dmg = 2; e.st = 'rest'; e.t = 1.2; e.z = 0; e.boss = true; e.dir = 2;
      if (sav.bossHp[dg] > 0) e.hp = sav.bossHp[dg];
      e.enraged = e.hp <= e.maxHp / 2;
    } else {
      e.w = 12; e.h = 14; e.x = tx * TS; e.y = ty * TS - 1; e.hp = e.maxHp = 26; e.dmg = 2; e.st = 'appear'; e.t = 0.8; e.boss = true; e.fly = true; e.alpha = 0; e.volley = 0; e.bob = 0; e.baseX = e.x; e.dir = 2;
      if (sav.bossHp[dg] > 0) e.hp = sav.bossHp[dg];
      e.ph = e.hp > 17 ? 1 : e.hp > 8 ? 2 : 3;
    }
    return e;
  }

  function buildRoom(id) {
    var def = DG.rooms[id], t = [], en = [], blocks = [], items = [], x, y, i;
    var cleared = !!sav.cleared[sk(id)] || (def.boss && !!sav.bossDead[dg]);
    for (y = 0; y < RH; y++) for (x = 0; x < RW; x++) {
      var border = x === 0 || y === 0 || x === RW - 1 || y === RH - 1;
      t.push(border ? '#' : def.rows[y - 1].charAt(x - 1));
    }
    Object.keys(def.ex || {}).forEach(function (k) {
      var d = SIDE[k], code = def.ex[k], p = DOORT[d];
      t[p[1] * RW + p[0]] = code === 'o' || sav.opened[doorKey(id, d)] ? '.' : code;
    });
    for (y = 1; y < RH - 1; y++) for (x = 1; x < RW - 1; x++) {
      i = y * RW + x;
      var ch = t[i];
      if ('SAKMW'.indexOf(ch) >= 0) { if (!cleared) en.push(mkEnemy(ch, x, y)); t[i] = '.'; }
      else if (ch === 'B') { blocks.push({ x: x * TS, y: y * TS, moving: false, mx: 0, my: 0 }); t[i] = '.'; }
      else if ((ch === 'P' || ch === 'Y') && (sav.broken[sk(id)] || []).indexOf(i) >= 0) t[i] = '.';
    }
    var ki;
    for (y = 1; y < RH - 1; y++) for (x = 1; x < RW - 1; x++) {         // a key that fell out of a pot must never be lost
      ki = y * RW + x;
      if (def.rows[y - 1].charAt(x - 1) === 'Y' && (sav.broken[sk(id)] || []).indexOf(ki) >= 0 && !sav.got[sk(id + ':kp' + ki)]) items.push({ k: 'key', x: x * TS, y: y * TS, id: id + ':kp' + ki, life: 0, bob: 0 });
    }
    var room = { id: id, def: def, t: t, en: en, blocks: blocks, items: items, projs: [], arrows: [], sealed: false, seals: [], wake: def.boss ? 1.1 : 0.6, cleared: cleared || en.length === 0, hadEn: en.length > 0 };
    if (def.reward && sav.cleared[sk(id)] && !sav.got[sk(id + ':rw')]) items.push({ k: def.reward, x: PW / 2 - 6, y: PH / 2 - 6, id: id + ':rw', life: 0, bob: 0 });
    if (def.boss === 'gloop' && sav.bossDead[dg] && !sav.got[sk(id + ':hc')]) items.push({ k: 'heartc', x: PW / 2 - 6, y: PH / 2 - 6, id: id + ':hc', life: 0, bob: 0 });
    return room;
  }

  function enterRoom() {
    var first = !sav.visited[visitedKey(cur.id)];
    sav.visited[visitedKey(cur.id)] = 1;
    if (cur.def.needAmmo && hasBow && ammo < cur.def.needAmmo) ammo = cur.def.needAmmo;
    if (first && cur.def.boss && !cur.cleared) { banner = { t: 1.8, s: cur.def.boss === 'gloop' ? 'GLOOP KING' : 'RUNE WRAITH', s2: 'BOSS' }; R.sfx.tone(110, 0.5, { type: 'sawtooth', slide: 70, vol: 0.18 }); }
  }

  function startDungeon(n) {
    dg = n; DG = DUN[n]; R.level = n;
    cur = buildRoom(DG.start.id);
    hero.x = DG.start.x; hero.y = DG.start.y; hero.face = 0; hero.kbT = 0;
    if (n > 1) keys = 0;
    enterRoom();
    intro = { t: 2.2, s: DG.name, s2: 'DUNGEON ' + n };
  }

  /* ------------------------------------------------------------ collision */
  function tileAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return '.'; return cur.t[ty * RW + tx]; }
  function solidChar(c, fly) {
    switch (c) {
      case '#': case 'T': case 'P': case 'Y': case 'C': case 'F': case 'o': case 'D': case 'N': case 'X': return true;
      case 'v': return !fly;
      case 'G': return !sav.sw[sk(cur.id)];
      default: return false;
    }
  }
  function boxHit(x, y, w, h, fly) {
    var tx0 = Math.floor(x / TS), tx1 = Math.floor((x + w - 0.01) / TS), ty0 = Math.floor(y / TS), ty1 = Math.floor((y + h - 0.01) / TS), tx, ty, i;
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
      var c = tileAt(tx, ty);
      if (solidChar(c, fly)) { hitTx = tx; hitTy = ty; return (c === 'D' || c === 'N') ? 3 : 1; }
    }
    if (!fly) {
      for (i = 0; i < cur.blocks.length; i++) {
        var b = cur.blocks[i];
        if (x < b.x + TS && x + w > b.x && y < b.y + TS && y + h > b.y) { hitBlock = b; return 2; }
      }
    }
    return 0;
  }
  function lineClear(x1, y1, x2, y2) {
    var n = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 4), i;
    for (i = 1; i < n; i++) { var c = tileAt(Math.floor((x1 + (x2 - x1) * i / n) / TS), Math.floor((y1 + (y2 - y1) * i / n) / TS)); if (solidChar(c, true)) return false; }
    return true;
  }
  function entBlocked(e, x, y) {
    if (x < TS || y < TS || x + e.w > PW - TS || y + e.h > PH - TS) return true;
    return boxHit(x, y, e.w, e.h, e.fly) !== 0;
  }
  function entMove(e, dx, dy) {
    var ok = true;
    if (dx) { if (!entBlocked(e, e.x + dx, e.y)) e.x += dx; else ok = false; }
    if (dy) { if (!entBlocked(e, e.x, e.y + dy)) e.y += dy; else ok = false; }
    return ok;
  }
  function heroBox() { return { x: hero.x, y: hero.y, w: HB, h: HB }; }

  /* ------------------------------------------------------------ hero */
  function moveHero(dx, dy) {
    var nx = hero.x + dx, ny = hero.y + dy, r = boxHit(nx, ny, HB, HB, false), o, s;
    if (r === 0) { hero.x = nx; hero.y = ny; return 0; }
    if (r === 1) {
      var step = Math.max(Math.abs(dx), Math.abs(dy));
      for (o = 1; o <= 4; o++) for (s = -1; s <= 1; s += 2) {
        if (dx ? boxHit(nx, hero.y + s * o, HB, HB, false) === 0 : boxHit(hero.x + s * o, ny, HB, HB, false) === 0) {
          if (dx) hero.y += s * Math.min(step, o); else hero.x += s * Math.min(step, o);
          return r;
        }
      }
    }
    return r;
  }

  function hurtHero(dmg, fx0, fy0) {
    if (hero.hurtT > 0 || hero.dead || trans || hero.gotT > 0 || winT > 0) return;
    hero.hp -= dmg; hero.hurtT = 1.0;
    var cx = hero.x + 4, cy = hero.y + 4, dx = cx - fx0, dy = cy - fy0, m = Math.sqrt(dx * dx + dy * dy) || 1;
    hero.kx = dx / m * 95; hero.ky = dy / m * 95; hero.kbT = 0.14; hero.atkT = 0;
    R.sfx.play('hit'); R.vibrate(45); R.fx.shake(2, 0.18);
    burst(cx, cy, { n: 8, color: [C.red, C.white, C.pink], speed: 60, life: 0.4, size: 2 });
    if (hero.hp <= 0) {
      hero.hp = 0; hero.dead = true; hero.deadT = 1.1;
      burst(cx, cy, { n: 26, color: [C.blue, C.white, C.red, C.yellow], speed: 90, life: 0.9, size: 2, gravity: 40 });
      R.vibrate(120); R.fx.flash(C.red, 0.3);
    }
  }
  function healHero(n) { hero.hp = Math.min(hero.maxHp, hero.hp + n); }

  function swordRect() {
    var f = hero.face;
    if (f === 0) return { x: hero.x - 2, y: hero.y - SWR, w: 12, h: SWR + 1 };
    if (f === 2) return { x: hero.x - 2, y: hero.y + HB - 1, w: 12, h: SWR + 1 };
    if (f === 3) return { x: hero.x - SWR, y: hero.y - 2, w: SWR + 1, h: 12 };
    return { x: hero.x + HB - 1, y: hero.y - 2, w: SWR + 1, h: 12 };
  }

  function startSwing() {
    hero.atkT = SWING; hero.hit = [];
    R.sfx.noise(0.07, { vol: 0.12, freq: 3800, sweep: 900, filter: 'highpass' });
    var r = swordRect();
    burst(r.x + r.w / 2, r.y + r.h / 2, { n: 3, color: [C.white, C.silver], speed: 30, life: 0.2, size: 1 });
  }

  function swordHits() {
    var r = swordRect(), i, a = SWING - hero.atkT;
    if (a < 0.04 || a > 0.17) return;
    for (i = 0; i < cur.en.length; i++) {
      var e = cur.en[i];
      if (hero.hit.indexOf(e) < 0 && overlap(r, e)) { hero.hit.push(e); hurtEnemy(e, 1, hero.face); }
    }
    for (i = cur.projs.length - 1; i >= 0; i--) {
      var p = cur.projs[i];
      if (overlap(r, { x: p.x - 3, y: p.y - 3, w: 6, h: 6 })) { burst(p.x, p.y, { n: 6, color: [C.cyan, C.white], speed: 45, life: 0.25, size: 1 }); R.sfx.tone(900, 0.05, { vol: 0.08 }); R.addScore(5); cur.projs.splice(i, 1); }
    }
    var tx0 = Math.floor(r.x / TS), tx1 = Math.floor((r.x + r.w - 0.01) / TS), ty0 = Math.floor(r.y / TS), ty1 = Math.floor((r.y + r.h - 0.01) / TS), tx, ty;
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
      if (tx < 1 || ty < 1 || tx >= RW - 1 || ty >= RH - 1) continue;
      var key = tx + ',' + ty;
      if (hero.hit.indexOf(key) >= 0) continue;
      var c = tileAt(tx, ty);
      if (c !== 'P' && c !== 'Y' && c !== 'o' && c !== 'C') continue;
      if (!overlap(r, { x: tx * TS + 2, y: ty * TS + 2, w: 8, h: 8 })) continue;
      hero.hit.push(key);
      if (c === 'P' || c === 'Y') breakPot(tx, ty);
      else if (c === 'o') hitCrystal(tx, ty);
      else openChest();
    }
  }

  function breakPot(tx, ty) {
    var i = ty * RW + tx, c = cur.t[i], x = tx * TS, y = ty * TS;
    cur.t[i] = '.';
    (sav.broken[sk(cur.id)] = sav.broken[sk(cur.id)] || []).push(i);
    R.sfx.noise(0.12, { vol: 0.14, freq: 2400, sweep: 500 }); R.sfx.tone(300, 0.06, { vol: 0.08, slide: 120 });
    burst(x + 6, y + 6, { n: 9, color: ['#d98b3a', '#f7b967', '#a35a1f'], speed: 55, life: 0.5, size: 2, gravity: 140 });
    if (c === 'Y') cur.items.push({ k: 'key', x: x, y: y, life: 0, bob: 0, id: cur.id + ':kp' + i });
    else dropFrom(x, y, 0.6);
  }
  function hitCrystal(tx, ty) {
    var x = tx * TS, y = ty * TS;
    R.sfx.tone(880, 0.1, { vol: 0.12, type: 'triangle' });
    burst(x + 6, y + 6, { n: 10, color: [C.cyan, C.white], speed: 60, life: 0.5, size: 2 });
    if (!sav.sw[sk(cur.id)]) flipSwitch();
  }
  function flipSwitch() {
    sav.sw[sk(cur.id)] = 1;
    R.sfx.play('powerup'); R.vibrate(25); R.fx.flash(C.cyan, 0.12);
    var i; for (i = 0; i < cur.t.length; i++) if (cur.t[i] === 'G') burst((i % RW) * TS + 6, ((i / RW) | 0) * TS + 6, { n: 10, color: ['#a8b0d8', C.white], speed: 40, life: 0.5, size: 2 });
    ftext(PW / 2, PH / 2 - 8, 'CLICK!', C.cyan);
  }
  function openChest() {
    if (sav.chests[sk(cur.id)]) return;
    sav.chests[sk(cur.id)] = 1;
    var k = cur.def.chest;
    R.sfx.play('powerup'); R.vibrate(30);
    giveItem(k);
    var i = cur.t.indexOf('C');
    if (i >= 0) burst((i % RW) * TS + 6, ((i / RW) | 0) * TS + 6, { n: 14, color: [C.yellow, C.white, C.orange], speed: 60, life: 0.6, size: 2 });
  }
  function giveItem(k) {
    hero.gotT = 1.25; hero.gotKind = k; hero.face = 2;
    if (k === 'bow') { hasBow = true; ammo = Math.max(ammo, 12); }
    else if (k === 'bosskey') bossKey[dg] = true;
    else if (k === 'heartc') { hero.maxHp += 2; hero.hp = hero.maxHp; R.addScore(200); }
    else if (k === 'gems') R.addScore(500);
    else if (k === 'key') keys++;
    R.addScore(100);
    R.sfx.play('trophy');
  }

  function dropFrom(x, y, chance) {
    var r = Math.random(), k = null;
    if (r < chance) {
      var q = Math.random();
      if (hero.hp <= hero.maxHp * 0.5 && q < 0.45) k = 'heart';
      else if (hasBow && ammo < 5 && q < 0.5) k = 'arrow';
      else if (q < 0.5) k = 'gem';
      else if (q < 0.7) k = 'heart';
      else if (hasBow && q < 0.85) k = 'arrow';
    }
    if (k) cur.items.push({ k: k, x: x, y: y, life: 9, bob: Math.random() * 6 });
  }

  function tryOpenDoor(tx, ty) {
    var c = tileAt(tx, ty), boss = c === 'N', d = ty === 0 ? 0 : ty === RH - 1 ? 2 : tx === 0 ? 3 : 1;
    if (boss ? bossKey[dg] : keys > 0) {
      if (!boss) keys--;
      cur.t[ty * RW + tx] = '.'; sav.opened[doorKey(cur.id, d)] = 1;
      R.sfx.play('select'); R.sfx.tone(180, 0.2, { vol: 0.12, type: 'sawtooth', slide: 90 }); R.vibrate(30); R.addScore(50);
      burst(tx * TS + 6, ty * TS + 6, { n: 14, color: [C.yellow, C.orange, C.white], speed: 60, life: 0.5, size: 2 });
      ftext(tx * TS + 6, ty * TS + 8, boss ? 'UNLOCKED' : 'OPEN', C.yellow);
      R.achieve('key-turner');
    } else if (bump <= 0) {
      bump = 0.9; R.sfx.tone(110, 0.1, { vol: 0.1, type: 'triangle' });
      ftext(tx * TS + 6, ty * TS + 6, boss ? 'BOSS KEY' : 'LOCKED', C.pink);
    }
  }

  function tryPush(b, dir) {
    var tx = Math.round(b.x / TS) + DX[dir], ty = Math.round(b.y / TS) + DY[dir], i;
    if (tx < 1 || ty < 1 || tx > RW - 2 || ty > RH - 2) return;
    if (solidChar(tileAt(tx, ty), false)) return;
    for (i = 0; i < cur.blocks.length; i++) if (cur.blocks[i] !== b && Math.round(cur.blocks[i].x / TS) === tx && Math.round(cur.blocks[i].y / TS) === ty) return;
    b.moving = true; b.mx = tx * TS; b.my = ty * TS;
    R.sfx.tone(90, 0.18, { vol: 0.1, type: 'triangle', slide: 70 });
    burst(b.x + 6 - DX[dir] * 6, b.y + 6 - DY[dir] * 6, { n: 4, color: ['#868ec0', '#c4cbf0'], speed: 25, life: 0.3, size: 1 });
  }

  function shootArrow() {
    if (!hasBow || ammo <= 0 || hero.shootT > 0 || hero.atkT > 0) {
      if (hero.shootT <= 0 && hero.atkT <= 0) { hero.shootT = 0.4; R.sfx.tone(120, 0.06, { vol: 0.08, type: 'triangle' }); ftext(hero.x + 4, hero.y - 4, hasBow ? 'NO ARROWS' : 'NO BOW', C.pink); }
      return;
    }
    ammo--; hero.shootT = 0.32;
    var f = hero.face;
    cur.arrows.push({ x: hero.x + 4 + DX[f] * 6, y: hero.y + 4 + DY[f] * 6, dir: f, life: 2 });
    R.sfx.play('shoot'); R.vibrate(8);
  }

  function updateHero(dt) {
    var h = hero, ax = R.input.axisX(), ay = R.input.axisY(), moved = false;
    if (h.hurtT > 0) h.hurtT -= dt;
    if (h.atkT > 0) h.atkT -= dt;
    if (h.shootT > 0) h.shootT -= dt;
    if (bump > 0) bump -= dt;
    if (h.kbT > 0) {
      h.kbT -= dt; moveHero(h.kx * dt, 0); moveHero(0, h.ky * dt);
      return;
    }
    if (R.input.pressed('a') && h.atkT <= 0) startSwing();
    if (R.input.pressed('b')) shootArrow();
    if (h.atkT > 0) swordHits();
    if (ax && ay) { if (h.pref === 'x') ay = 0; else ax = 0; }
    var pushing = false;
    if ((ax || ay) && h.atkT <= 0) {
      var spd = 54 * dt, dir = ax ? (ax > 0 ? 1 : 3) : (ay > 0 ? 2 : 0), r;
      h.face = dir; moved = true;
      r = ax ? moveHero(ax * spd, 0) : moveHero(0, ay * spd);
      if (r === 2 && hitBlock && !hitBlock.moving) {
        pushing = true;
        if (h.pushB === hitBlock && h.pushD === dir) { h.pushT += dt; if (h.pushT >= 0.38) { tryPush(hitBlock, dir); h.pushT = 0; } }
        else { h.pushB = hitBlock; h.pushD = dir; h.pushT = 0; }
      } else if (r === 3) tryOpenDoor(hitTx, hitTy);
    }
    if (!pushing) h.pushT = 0;
    if (moved) h.walkT += dt; else h.walkT = 0;
  }

  /* ------------------------------------------------------------ enemies */
  function pickDir(e, towardChance) {
    if (Math.random() < towardChance) { var dx = hero.x - e.x, dy = hero.y - e.y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0); }
    return U.randInt(0, 4);
  }
  function aligned(e) {
    var ex = e.x + e.w / 2, ey = e.y + e.h / 2, hx = hero.x + 4, hy = hero.y + 4;
    if (Math.abs(hx - ex) < 6 && Math.abs(hy - ey) < 80 && lineClear(ex, ey, hx, hy)) return hy < ey ? 0 : 2;
    if (Math.abs(hy - ey) < 6 && Math.abs(hx - ex) < 80 && lineClear(ex, ey, hx, hy)) return hx < ex ? 3 : 1;
    return -1;
  }

  function aiSlime(e, dt) {
    e.t -= dt;
    if (e.st === 0) { if (e.t <= 0) { e.dir = pickDir(e, 0.35); e.st = 1; e.t = 0.42; } }
    else { var ok = entMove(e, DX[e.dir] * e.sp * dt, DY[e.dir] * e.sp * dt); if (!ok || e.t <= 0) { e.st = 0; e.t = U.rand(0.45, 1.0); } }
  }
  function aiBat(e, dt) {
    e.t -= dt;
    if (e.t <= 0) {
      var a = Math.random() < 0.4 ? Math.atan2(hero.y - e.y, hero.x - e.x) + U.rand(-0.5, 0.5) : U.rand(0, Math.PI * 2);
      e.vx = Math.cos(a) * e.sp; e.vy = Math.sin(a) * e.sp * 0.8; e.t = U.rand(0.5, 1.1);
    }
    if (!entMove(e, e.vx * dt, 0)) e.vx = -e.vx;
    if (!entMove(e, 0, e.vy * dt)) e.vy = -e.vy;
  }
  function aiSkel(e, dt) {
    e.t -= dt; e.cool -= dt;
    if (e.st === 0) {
      var ok = entMove(e, DX[e.dir] * e.sp * dt, DY[e.dir] * e.sp * dt);
      if (!ok || e.t <= 0) { e.dir = pickDir(e, 0.45); e.t = U.rand(0.7, 1.5); if (Math.random() < 0.25) { e.st = 3; e.t = 0.5; } }
      var al = aligned(e);
      if (al >= 0 && e.cool <= 0) { e.dir = al; e.st = 1; e.t = 0.4; R.sfx.tone(700, 0.08, { vol: 0.08, type: 'square' }); }
    } else if (e.st === 1) { if (e.t <= 0) { e.st = 2; e.t = 1.0; } }
    else if (e.st === 2) {
      var sp = 70 + (dg - 1) * 12;
      if (!entMove(e, DX[e.dir] * sp * dt, DY[e.dir] * sp * dt) || e.t <= 0) { e.st = 4; e.t = 0.7; e.cool = 1.6; burst(e.x + 4, e.y + 4, { n: 5, color: ['#b3ab98', '#ffffff'], speed: 35, life: 0.3, size: 1 }); R.sfx.tone(160, 0.08, { vol: 0.08, type: 'triangle' }); }
    } else if (e.st === 3 || e.st === 4) { if (e.t <= 0) { e.st = 0; e.t = 0.6; } }
  }

  function goo(e, n, speed, off) {
    var i, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    for (i = 0; i < n; i++) { var a = off + i * Math.PI * 2 / n; cur.projs.push({ x: cx, y: cy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: 1, k: 'goo', life: 3 }); }
  }
  function aiGloop(e, dt) {
    e.t -= dt;
    var enr = e.hp <= e.maxHp / 2;
    if (enr && !e.enraged) {
      e.enraged = true; R.sfx.tone(80, 0.6, { type: 'sawtooth', slide: 220, vol: 0.18 }); R.fx.flash(C.red, 0.2); R.fx.shake(3, 0.4);
      banner = { t: 1.4, s: 'ENRAGED!', s2: '' };
      var k; for (k = 0; k < 2; k++) { var s = mkEnemy('S', 2 + k * 6, 2); s.x = e.x + (k ? 20 : -10); s.y = e.y + 2; if (!entBlocked(s, s.x, s.y)) cur.en.push(s); }
    }
    if (e.st === 'rest') {
      var dx = hero.x - e.x - 5, dy = hero.y - e.y - 3, m = Math.sqrt(dx * dx + dy * dy) || 1;
      entMove(e, dx / m * 7 * dt, dy / m * 7 * dt);
      if (e.t <= 0) { e.st = 'squat'; e.t = enr ? 0.42 : 0.6; R.sfx.tone(200, 0.3, { type: 'triangle', slide: 120, vol: 0.12 }); }
    } else if (e.st === 'squat') {
      if (e.t <= 0) {
        e.st = 'leap'; e.t = 0.5; e.sx = e.x; e.sy = e.y;
        e.tx = U.clamp(hero.x + 4 - e.w / 2, TS + 1, PW - TS - e.w - 1); e.ty = U.clamp(hero.y + 4 - e.h / 2, TS + 1, PH - TS - e.h - 1);
        R.sfx.play('jump');
      }
    } else if (e.st === 'leap') {
      var p = 1 - Math.max(0, e.t) / 0.5;
      e.x = U.lerp(e.sx, e.tx, p); e.y = U.lerp(e.sy, e.ty, p); e.z = Math.sin(p * Math.PI) * 16;
      if (e.t <= 0) {
        e.z = 0; e.st = 'rest'; e.t = enr ? 0.75 : 1.2;
        R.sfx.play('explode'); R.fx.shake(3, 0.25); R.vibrate(25);
        burst(e.x + e.w / 2, e.y + e.h, { n: 14, color: ['#5ce06a', '#e8ffe8', '#1f8a3a'], speed: 70, life: 0.5, size: 2, gravity: 80 });
        goo(e, enr ? 8 : 4, 52, enr ? Math.PI / 8 : Math.PI / 4);
      }
    }
  }

  function bolt(e, ang, speed) { cur.projs.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg: 2, k: 'bolt', life: 4 }); }
  function aiWraith(e, dt) {
    var ph = e.hp > 17 ? 1 : e.hp > 8 ? 2 : 3, cx = e.x + e.w / 2, cy = e.y + e.h / 2, a, i;
    e.t -= dt; e.bob += dt;
    if (ph !== e.ph) {
      e.ph = ph; e.st = 'vanish'; e.t = 0.45; R.sfx.tone(70, 0.7, { type: 'sawtooth', slide: 260, vol: 0.18 }); R.fx.flash(C.purple, 0.25); R.fx.shake(3, 0.4);
      banner = { t: 1.3, s: ph === 2 ? 'PHASE 2' : 'FINAL PHASE', s2: '' };
      cur.projs = [];
      if (ph === 2) { for (i = 0; i < 2; i++) { var b = mkEnemy('A', 2 + i * 6, 2); b.x = i ? PW - 30 : 24; b.y = 24; cur.en.push(b); } }
    }
    switch (e.st) {
      case 'appear': e.alpha = Math.min(1, e.alpha + dt * 2.2); if (e.t <= 0) { e.alpha = 1; e.st = 'idle'; e.t = ph === 3 ? 0.7 : 1.1; e.volley = 0; e.baseX = e.x; } break;
      case 'idle':
        e.x = U.clamp(e.baseX + Math.sin(e.bob * 1.8) * 16, TS + 1, PW - TS - e.w - 1);
        if (e.t <= 0) { e.st = ph === 3 && e.volley === 0 ? 'dashwind' : 'wind'; e.t = e.st === 'dashwind' ? 0.75 : 0.55; R.sfx.tone(500, 0.3, { vol: 0.08, slide: 900, type: 'sine' }); }
        break;
      case 'wind':
        if (e.t <= 0) {
          a = Math.atan2(hero.y + 4 - cy, hero.x + 4 - cx);
          if (ph === 1) { bolt(e, a - 0.38, 56); bolt(e, a, 60); bolt(e, a + 0.38, 56); }
          else if (ph === 2) { for (i = -2; i <= 2; i++) bolt(e, a + i * 0.3, 58); if (e.volley % 2) for (i = 0; i < 8; i++) bolt(e, i * Math.PI / 4 + 0.2, 44); }
          else { for (i = -2; i <= 2; i++) bolt(e, a + i * 0.26, 70); for (i = 0; i < 10; i++) bolt(e, i * Math.PI / 5 + e.volley, 46); }
          R.sfx.play('shoot'); R.sfx.tone(300, 0.2, { vol: 0.1, slide: 120, type: 'sawtooth' });
          e.volley++; e.st = 'recover'; e.t = 0.55;
        }
        break;
      case 'recover':
        if (e.t <= 0) { if (e.volley >= (ph === 1 ? 2 : 3)) { e.st = 'vanish'; e.t = 0.45; } else { e.st = 'idle'; e.t = 0.55; } }
        break;
      case 'vanish':
        e.alpha = Math.max(0, e.t / 0.45);
        if (e.t <= 0) {
          var tries = 0, nx, ny;
          do { nx = U.rand(TS + 4, PW - TS - e.w - 4); ny = U.rand(TS + 4, PH - TS - e.h - 30); tries++; } while (tries < 20 && U.dist(nx, ny, hero.x, hero.y) < 40);
          e.x = nx; e.y = ny; e.baseX = nx; e.st = 'appear'; e.t = 0.5; e.alpha = 0; e.volley = 0;
          burst(e.x + 6, e.y + 7, { n: 10, color: [C.purple, C.white, '#8a4fe0'], speed: 50, life: 0.4, size: 2 });
        }
        break;
      case 'dashwind':
        e.aim = Math.atan2(hero.y + 4 - cy, hero.x + 4 - cx);
        if (e.t <= 0) { e.st = 'dash'; e.t = 0.6; e.vx = Math.cos(e.aim) * 135; e.vy = Math.sin(e.aim) * 135; R.sfx.play('jump'); }
        break;
      case 'dash':
        var mx = entMove(e, e.vx * dt, 0), my = entMove(e, 0, e.vy * dt);
        if (!mx || !my || e.t <= 0) {
          e.st = 'stun'; e.t = 1.0; R.fx.shake(2, 0.2); R.sfx.tone(150, 0.12, { vol: 0.1, type: 'triangle' });
          for (i = 0; i < 12; i++) bolt(e, i * Math.PI / 6, 48);
        }
        break;
      case 'stun': if (e.t <= 0) { e.st = 'vanish'; e.t = 0.45; } break;
    }
    e.baseX = e.st === 'idle' ? e.baseX : e.x;
  }

  function hurtEnemy(e, dmg, dir) {
    if (e.hurt > 0) return false;
    if (e.k === 'wraith' && (e.st === 'appear' || e.st === 'vanish')) return false;
    if (e.k === 'gloop' && e.z > 5) return false;
    if (e.k === 'skel' && e.st !== 4 && ((dir + 2) % 4) === e.dir) {
      e.hurt = 0.2; R.sfx.tone(1100, 0.06, { vol: 0.1 }); R.sfx.tone(700, 0.06, { vol: 0.08, delay: 0.03 });
      burst(e.x + 4 + DX[e.dir] * 5, e.y + 4 + DY[e.dir] * 5, { n: 5, color: [C.yellow, C.white], speed: 45, life: 0.2, size: 1 });
      hero.kx = DX[dir] * -60; hero.ky = DY[dir] * -60; hero.kbT = Math.max(hero.kbT, 0.06);
      return false;
    }
    e.hp -= dmg;
    var cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    R.sfx.play('hit'); R.vibrate(14);
    burst(cx, cy, { n: e.boss ? 10 : 6, color: [C.white, C.yellow, C.orange], speed: 55, life: 0.3, size: 2 });
    if (e.boss) { e.hurt = 0.28; R.fx.shake(1.5, 0.12); if (e.k === 'wraith' && e.st === 'dashwind') { e.st = 'wind'; e.t = 0.2; } }
    else { e.hurt = 0.3; e.kT = 0.13; e.kx = DX[dir] * 115; e.ky = DY[dir] * 115; if (e.k === 'skel') { e.st = 4; e.t = 0.35; } }
    if (e.boss) sav.bossHp[dg] = Math.max(1, e.hp);
    if (e.hp <= 0) killEnemy(e);
    return true;
  }

  function killEnemy(e) {
    var i = cur.en.indexOf(e), cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    if (i >= 0) cur.en.splice(i, 1);
    R.fx.shake(e.boss ? 5 : 1.5, e.boss ? 0.6 : 0.15);
    R.sfx.play('explode'); R.vibrate(e.boss ? 90 : 25);
    var col = e.k === 'slime' ? [C.lime, C.white, '#1f9a3a'] : e.k === 'bat' ? [C.purple, C.white, C.red] : [C.white, C.silver, C.yellow];
    burst(cx, cy, { n: e.boss ? 40 : 14, color: col, speed: e.boss ? 110 : 70, life: e.boss ? 0.9 : 0.5, size: 2, gravity: 30 });
    var pts = e.k === 'slime' ? 20 : e.k === 'bat' ? 30 : e.k === 'skel' ? 60 : e.k === 'gloop' ? 500 : 2000;
    R.addScore(pts); ftext(cx, cy - 6, '+' + pts, C.yellow);
    if (!e.boss) dropFrom(e.x, e.y, 0.34);
    sav.kills = (sav.kills || 0) + 1;
    if (e.boss) {
      cur.en.slice().forEach(function (o) { var j = cur.en.indexOf(o); if (j >= 0) { cur.en.splice(j, 1); burst(o.x + 4, o.y + 4, { n: 8, color: [C.white, C.yellow], speed: 50, life: 0.4, size: 2 }); } });
      cur.projs = [];
      sav.bossDead[dg] = 1; R.fx.flash(C.white, 0.35);
      if (e.k === 'gloop') {
        R.achieve('slime-slayer');
        cur.items.push({ k: 'heartc', x: PW / 2 - 6, y: PH / 2 - 6, id: cur.id + ':hc', life: 0, bob: 0 });
      } else {
        winT = 3.4; R.addScore(1000 + hero.hp * 50); R.achieve('rune-hero'); R.sfx.play('win');
        banner = { t: 3.2, s: 'RUNE RESTORED', s2: 'YOU WIN' };
      }
    }
  }

  function updateEnemy(e, dt) {
    if (e.hurt > 0) e.hurt -= dt;
    e.anim += dt;
    if (e.kT > 0) { e.kT -= dt; entMove(e, e.kx * dt, e.ky * dt); }
    else if (e.k === 'slime') aiSlime(e, dt);
    else if (e.k === 'bat') aiBat(e, dt);
    else if (e.k === 'skel') aiSkel(e, dt);
    else if (e.k === 'gloop') aiGloop(e, dt);
    else aiWraith(e, dt);
    if (hero.dead || hero.hurtT > 0 || !e.dmg) return;
    if (e.k === 'wraith' && (e.st === 'appear' || e.st === 'vanish' || e.alpha < 0.8)) return;
    if (e.k === 'gloop' && e.z > 6) return;
    var hb = heroBox();
    if (overlap({ x: e.x + 1, y: e.y + 1, w: e.w - 2, h: e.h - 2 }, { x: hb.x + 1, y: hb.y + 1, w: hb.w - 2, h: hb.h - 2 })) {
      hurtHero(e.k === 'wraith' && e.st === 'dash' ? e.dmg + 1 : e.dmg, e.x + e.w / 2, e.y + e.h / 2);
    }
  }

  /* ------------------------------------------------------------ room update */
  function roomCleared() {
    cur.cleared = true;
    if (!cur.hadEn) return;
    sav.cleared[sk(cur.id)] = 1;
    if (cur.sealed) unseal();
    if (cur.def.boss) return;
    R.sfx.play('line'); R.addScore(50); R.fx.flash(C.white, 0.08);
    ftext(PW / 2, PH / 2 - 14, 'CLEAR!', C.lime);
    if (cur.def.reward) {
      cur.items.push({ k: cur.def.reward, x: PW / 2 - 6, y: PH / 2 - 6, id: cur.id + ':rw', life: 0, bob: 0 });
      burst(PW / 2, PH / 2, { n: 14, color: [C.yellow, C.white], speed: 60, life: 0.6, size: 2 });
    }
  }
  function seal() {
    cur.sealed = true; cur.seals = [];
    DOORT.forEach(function (p) { var i = p[1] * RW + p[0]; if (cur.t[i] === '.') { cur.t[i] = 'X'; cur.seals.push(i); burst(p[0] * TS + 6, p[1] * TS + 6, { n: 6, color: ['#e06a6a', '#ffffff'], speed: 30, life: 0.3, size: 2 }); } });
    R.sfx.tone(130, 0.25, { vol: 0.14, type: 'square', slide: 60 }); R.fx.shake(2, 0.2);
  }
  function unseal() {
    cur.seals.forEach(function (i) { cur.t[i] = '.'; });
    cur.sealed = false; R.sfx.play('select');
  }
  function heroInside() { return hero.x >= TS && hero.y >= TS && hero.x + HB <= PW - TS && hero.y + HB <= PH - TS; }

  function collect(it) {
    var cx = it.x + 6, cy = it.y + 6;
    switch (it.k) {
      case 'heart': healHero(2); R.sfx.play('coin'); break;
      case 'arrow': ammo = Math.min(30, ammo + 5); R.sfx.play('blip'); ftext(cx, cy - 6, '+5', C.cyan); break;
      case 'gem': R.addScore(10); R.sfx.play('coin'); break;
      case 'key': keys++; R.sfx.play('powerup'); ftext(cx, cy - 8, 'KEY!', C.yellow); break;
      case 'bosskey': bossKey[dg] = true; R.sfx.play('powerup'); break;
      case 'heartc': giveItem('heartc'); break;
    }
    burst(cx, cy, { n: 6, color: [C.white, C.yellow], speed: 40, life: 0.3, size: 1 });
    if (it.id) sav.got[sk(it.id)] = 1;
    R.vibrate(8);
  }

  function updateRoom(dt) {
    var i, e;
    if (cur.wake > 0) cur.wake -= dt;
    else for (i = cur.en.length - 1; i >= 0; i--) { e = cur.en[i]; if (cur.en.indexOf(e) >= 0) updateEnemy(e, dt); }
    // enemy projectiles
    for (i = cur.projs.length - 1; i >= 0; i--) {
      var p = cur.projs[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      var c = tileAt(Math.floor(p.x / TS), Math.floor(p.y / TS));
      if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x > PW || p.y > PH || (solidChar(c, true) && c !== 'o')) { burst(p.x, p.y, { n: 3, color: p.k === 'goo' ? ['#5ce06a'] : [C.cyan, C.purple], speed: 25, life: 0.2, size: 1 }); cur.projs.splice(i, 1); continue; }
      if (!hero.dead && overlap({ x: p.x - 2, y: p.y - 2, w: 4, h: 4 }, { x: hero.x + 1, y: hero.y + 1, w: HB - 2, h: HB - 2 })) {
        hurtHero(p.dmg, p.x - p.vx * 0.05, p.y - p.vy * 0.05); cur.projs.splice(i, 1);
      }
    }
    // arrows
    for (i = cur.arrows.length - 1; i >= 0; i--) {
      var a = cur.arrows[i], hx, hy, dead = false, j;
      a.x += DX[a.dir] * 150 * dt; a.y += DY[a.dir] * 150 * dt; a.life -= dt;
      hx = a.x + DX[a.dir] * 4; hy = a.y + DY[a.dir] * 4;
      var tx = Math.floor(hx / TS), ty = Math.floor(hy / TS), tc = tileAt(tx, ty);
      if (a.life <= 0 || hx < 0 || hy < 0 || hx > PW || hy > PH) dead = true;
      else if (tc === 'o') { hitCrystal(tx, ty); R.achieve('sharpshooter'); dead = true; }
      else if (tc === 'P' || tc === 'Y') { breakPot(tx, ty); dead = true; }
      else if (solidChar(tc, true)) { dead = true; burst(hx, hy, { n: 4, color: [C.white, C.silver], speed: 30, life: 0.2, size: 1 }); R.sfx.tone(260, 0.04, { vol: 0.06 }); }
      if (!dead) {
        var ar = { x: hx - 2, y: hy - 2, w: 4, h: 4 };
        for (j = 0; j < cur.en.length; j++) { if (overlap(ar, cur.en[j])) { if (hurtEnemy(cur.en[j], 2, a.dir)) R.achieve('sharpshooter'); dead = true; break; } }
        for (j = cur.projs.length - 1; !dead && j >= 0; j--) if (overlap(ar, { x: cur.projs[j].x - 3, y: cur.projs[j].y - 3, w: 6, h: 6 })) { burst(cur.projs[j].x, cur.projs[j].y, { n: 5, color: [C.cyan, C.white], speed: 40, life: 0.25, size: 1 }); cur.projs.splice(j, 1); dead = true; R.addScore(5); }
      }
      if (dead) cur.arrows.splice(i, 1);
    }
    // push blocks
    for (i = 0; i < cur.blocks.length; i++) {
      var b = cur.blocks[i];
      if (!b.moving) continue;
      var sp = 56 * dt, ddx = b.mx - b.x, ddy = b.my - b.y;
      if (Math.abs(ddx) <= sp && Math.abs(ddy) <= sp) {
        b.x = b.mx; b.y = b.my; b.moving = false;
        var btx = Math.round(b.x / TS), bty = Math.round(b.y / TS);
        if (tileAt(btx, bty) === 'p' && !sav.sw[sk(cur.id)]) { flipSwitch(); }
        else R.sfx.tone(140, 0.05, { vol: 0.08, type: 'triangle' });
      } else { b.x += Math.sign(ddx) * sp; b.y += Math.sign(ddy) * sp; }
    }
    // pick-ups
    var hb = { x: hero.x - 1, y: hero.y - 1, w: HB + 2, h: HB + 2 };
    for (i = cur.items.length - 1; i >= 0; i--) {
      var it = cur.items[i]; it.bob += dt;
      if (it.life > 0) { it.life -= dt; if (it.life <= 0) { cur.items.splice(i, 1); continue; } }
      if (!hero.dead && overlap(hb, { x: it.x + 1, y: it.y + 1, w: 10, h: 10 })) { cur.items.splice(i, 1); collect(it); }
    }
    // fountain
    var fi = cur.t.indexOf('F');
    if (fi >= 0 && hero.hp < hero.maxHp) {
      var fx0 = (fi % RW) * TS + 6, fy0 = ((fi / RW) | 0) * TS + 6;
      if (U.dist(hero.x + 4, hero.y + 4, fx0, fy0) < 17) {
        hero.heal = (hero.heal || 0) + dt;
        if (hero.heal >= 0.45) { hero.heal = 0; healHero(1); R.sfx.tone(1200, 0.08, { vol: 0.07, type: 'triangle' }); burst(hero.x + 4, hero.y, { n: 4, color: ['#7cc4ff', '#ffffff'], speed: 30, life: 0.5, size: 1, gravity: -20 }); }
      }
    }
    // portal
    var pi = cur.t.indexOf('>');
    if (pi >= 0 && dg < 2 && U.dist(hero.x + 4, hero.y + 4, (pi % RW) * TS + 6, ((pi / RW) | 0) * TS + 6) < 7) {
      R.sfx.play('powerup'); R.fx.flash(C.white, 0.4); R.addScore(300);
      healHero(hero.maxHp);
      startDungeon(2);
      return;
    }
    if (!cur.cleared && cur.en.length === 0) roomCleared();
    if (cur.def.trap && !cur.sealed && !cur.cleared && heroInside()) seal();
  }

  function checkEdge() {
    var cx = hero.x + 4, cy = hero.y + 4, d = -1;
    if (cy < 0) d = 0; else if (cx > PW) d = 1; else if (cy > PH) d = 2; else if (cx < 0) d = 3;
    if (d < 0) return;
    var nid = neighbour(cur.id, d);
    if (!DG.rooms[nid]) { hero.x = U.clamp(hero.x, 0, PW - HB); hero.y = U.clamp(hero.y, 0, PH - HB); return; }
    var to = buildRoom(nid);
    if (d === 0) hero.y = PH - TS + 2; else if (d === 2) hero.y = 2; else if (d === 1) hero.x = 2; else hero.x = PW - TS + 2;
    trans = { t: 0, d: d, from: cur, to: to };
    R.sfx.tone(330, 0.06, { vol: 0.07, type: 'triangle' });
    hero.atkT = 0; hero.hit = [];
  }

  /* ------------------------------------------------------------ rendering */
  var T0;
  function drawRoomTiles(ctx, rm, ox, oy) {
    var T = tiles(DG.theme), x, y, i, c, px, py, fr = Math.floor(clock * 2) % 2;
    var sw = !!sav.sw[sk(rm.id)];
    for (y = 0; y < RH; y++) for (x = 0; x < RW; x++) {
      c = rm.t[y * RW + x]; px = ox + x * TS; py = oy + y * TS;
      if (c === '#') { ctx.drawImage(T.wall, px, py); continue; }
      ctx.drawImage((x * 3 + y * 5) % 7 === 0 ? T.floorB : T.floorA, px, py);
      switch (c) {
        case 'T': ctx.drawImage(T.pillar, px, py); break;
        case 'v': ctx.drawImage(T['chasm' + (DG.theme === 2 ? fr : 0)], px, py); break;
        case 'P': case 'Y': ctx.drawImage(T.pot, px, py); break;
        case 'C': ctx.drawImage(S('chest' + (sav.chests[sk(rm.id)] ? 'O' : 'C'), sav.chests[sk(rm.id)] ? ICON.chestO : ICON.chestC, ICON_PAL.chest), px, py); break;
        case 'F': ctx.drawImage(T['fount' + fr], px, py); break;
        case 'o': ctx.drawImage(sw ? T.crystalOn : T.crystalOff, px, py - (sw ? 0 : 0)); break;
        case 'G': if (!sw) ctx.drawImage(T.gate, px, py); break;
        case 'p': ctx.drawImage(sw ? T.plateOn : T.plate, px, py); break;
        case 'D': ctx.drawImage(T.door, px, py); break;
        case 'N': ctx.drawImage(T.bossdoor, px, py); break;
        case 'X': ctx.drawImage(T.shutter, px, py); break;
        case '>': ctx.drawImage(T['portal' + (Math.floor(clock * 8) % 4)], px, py); break;
      }
    }
  }

  function drawItem(ctx, it, ox, oy) {
    var y = it.y + Math.sin(it.bob * 4) * 1.2, x = it.x + ox, yy = Math.round(y + oy);
    if (it.life > 0 && it.life < 2 && Math.floor(it.life * 8) % 2) return;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(Math.round(x + 3), Math.round(it.y + oy + 10), 6, 2);
    switch (it.k) {
      case 'heart': ctx.drawImage(S('hf', HEART_FULL, HEART_PAL), Math.round(x + 2), yy + 3); break;
      case 'gem': ctx.drawImage(S('gem', ICON.gem, ICON_PAL.gem), Math.round(x), yy); break;
      case 'key': ctx.drawImage(S('key', ICON.key, ICON_PAL.key), Math.round(x), yy); break;
      case 'bosskey': ctx.drawImage(S('bk', ICON.key, ICON_PAL.bosskey), Math.round(x), yy); break;
      case 'heartc': ctx.drawImage(S('hc', ICON.heartc, ICON_PAL.heartc), Math.round(x), yy); break;
      case 'arrow':
        ctx.fillStyle = '#c98a40'; ctx.fillRect(Math.round(x + 2), yy + 6, 8, 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + 9), yy + 5, 2, 3); ctx.fillRect(Math.round(x + 11), yy + 6, 1, 1);
        ctx.fillStyle = '#ff3a4d'; ctx.fillRect(Math.round(x + 1), yy + 5, 2, 1); ctx.fillRect(Math.round(x + 1), yy + 7, 2, 1);
        break;
    }
  }

  function heroSprite() {
    var f = hero.face, k = f === 0 ? 'u' : f === 2 ? 'd' : 'r', fr = hero.walkT > 0 ? (Math.floor(hero.walkT * 9) % 2) : 0;
    return S('h' + k + fr, heroRows(k, fr), HERO_PAL);
  }
  function drawHero(ctx, ox, oy) {
    if (hero.hurtT > 0 && Math.floor(hero.hurtT * 14) % 2) return;
    var x = Math.round(hero.x + ox - 2), y = Math.round(hero.y + oy - 4);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 2, y + 11, 8, 2);
    if (hero.dead) { ctx.globalAlpha = Math.max(0, hero.deadT / 1.1); }
    ctx.imageSmoothingEnabled = false;
    var spr = heroSprite();
    if (hero.face === 3) { ctx.save(); ctx.translate(x + 12, y); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0); ctx.restore(); }
    else ctx.drawImage(spr, x, y);
    ctx.globalAlpha = 1;
    if (hero.atkT > 0) drawSword(ctx, ox, oy);
    if (hero.gotT > 0 && hero.gotKind) {
      var ik = hero.gotKind;
      if (ik === 'bow') { drawBow(ctx, x + 2, y - 13); }
      else if (ik === 'gems') ctx.drawImage(S('gem', ICON.gem, ICON_PAL.gem), x, y - 12);
      else if (ik === 'heartc') ctx.drawImage(S('hc', ICON.heartc, ICON_PAL.heartc), x, y - 12);
      else ctx.drawImage(S(ik === 'bosskey' ? 'bk' : 'key', ICON.key, ik === 'bosskey' ? ICON_PAL.bosskey : ICON_PAL.key), x, y - 12);
    }
  }
  function drawBow(ctx, x, y) {
    ctx.fillStyle = '#c47a2c';
    [[3, 1], [4, 2], [5, 3], [5, 4], [6, 5], [6, 6], [6, 7], [5, 8], [5, 9], [4, 10], [3, 11]].forEach(function (p) { ctx.fillRect(x + p[0], y + p[1], 2, 1); });
    ctx.fillStyle = '#f4f0e0'; ctx.fillRect(x + 3, y + 1, 1, 11);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 6, 6, 1);
  }
  function drawSword(ctx, ox, oy) {
    var f = hero.face, x = Math.round(hero.x + ox), y = Math.round(hero.y + oy), a = SWING - hero.atkT, ext = a < 0.05 ? 5 : SWR;
    ctx.fillStyle = '#ffd23a';
    if (f === 0) { ctx.fillRect(x + 2, y - 1, 4, 2); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x + 3, y - ext, 2, ext - 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y - ext, 1, ext - 1); }
    else if (f === 2) { ctx.fillRect(x + 2, y + HB - 1, 4, 2); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x + 3, y + HB + 1, 2, ext - 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y + HB + 1, 1, ext - 1); }
    else if (f === 3) { ctx.fillRect(x - 1, y + 2, 2, 4); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x - ext, y + 3, ext - 1, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - ext, y + 3, ext - 1, 1); }
    else { ctx.fillRect(x + HB - 1, y + 2, 2, 4); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x + HB + 1, y + 3, ext - 1, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + HB + 1, y + 3, ext - 1, 1); }
    if (a > 0.04 && a < 0.2) {
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffffff';
      var r = swordRect(); ctx.fillRect(Math.round(r.x + ox), Math.round(r.y + oy), r.w, r.h); ctx.globalAlpha = 1;
    }
  }

  function drawEnemy(ctx, e, ox, oy) {
    var x = Math.round(e.x + ox), y = Math.round(e.y + oy), th = dg, flash = e.hurt > 0 && Math.floor(e.hurt * 30) % 2, spr, fr;
    if (e.k === 'slime') {
      fr = (e.st === 1 || (e.st === 0 && Math.floor(e.anim * 3) % 2)) ? 1 : 0;
      spr = flash ? S('slw' + fr, SLIME_ROWS[fr], whiten(SLIME_PAL[th])) : S('sl' + th + fr, SLIME_ROWS[fr], SLIME_PAL[th]);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x, y + 6, 8, 2);
      ctx.drawImage(spr, x - 2, y - 4);
    } else if (e.k === 'bat') {
      fr = Math.floor(e.anim * 9) % 2;
      spr = flash ? S('btw' + fr, BAT_ROWS[fr], whiten(BAT_PAL[th])) : S('bt' + th + fr, BAT_ROWS[fr], BAT_PAL[th]);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 1, y + 9, 6, 2);
      ctx.drawImage(spr, x - 2, y - 4 + (fr ? 1 : 0));
    } else if (e.k === 'skel') {
      spr = flash ? S('skw', SKEL_ROWS, whiten(SKEL_PAL[th])) : S('sk' + th, SKEL_ROWS, SKEL_PAL[th]);
      var bob = (e.st === 0 || e.st === 2) && Math.floor(e.anim * 6) % 2 ? 1 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x, y + 7, 8, 2);
      ctx.drawImage(spr, x - 2, y - 4 - bob);
      if (e.st !== 4) {
        ctx.fillStyle = '#5c7cff'; var d = e.dir;
        if (d === 0) ctx.fillRect(x - 1, y - 3, 10, 2); else if (d === 2) ctx.fillRect(x - 1, y + 7, 10, 2);
        else if (d === 3) ctx.fillRect(x - 3, y - 2, 2, 10); else ctx.fillRect(x + 9, y - 2, 2, 10);
        ctx.fillStyle = '#ffffff';
        if (d === 0) ctx.fillRect(x - 1, y - 3, 10, 1); else if (d === 2) ctx.fillRect(x - 1, y + 7, 10, 1);
        else if (d === 3) ctx.fillRect(x - 3, y - 2, 1, 10); else ctx.fillRect(x + 9, y - 2, 1, 10);
      }
      if (e.st === 1) D.text(ctx, '!', x + 1, y - 12, { size: 8, color: C.yellow, shadow: '#000' });
    } else if (e.k === 'gloop') drawGloop(ctx, e, ox, oy, flash);
    else drawWraith(ctx, e, ox, oy, flash);
  }
  function drawGloop(ctx, e, ox, oy, flash) {
    var rows = mirror(GLOOP_HALF), spr = flash ? S('glw', rows, whiten(GLOOP_PAL)) : S('gl', rows, GLOOP_PAL);
    var w = 24, h = rows.length, sx = 1, sy = 1;
    if (e.st === 'squat') { var q = 1 - Math.max(0, e.t) / 0.6; sy = 1 - 0.22 * Math.min(1, q * 1.4); sx = 1 + 0.12 * Math.min(1, q * 1.4); }
    else if (e.st === 'leap') { sy = 1.12; sx = 0.92; }
    else if (e.st === 'rest') { sy = 1 + Math.sin(e.anim * 5) * 0.03; }
    var dw = Math.round(w * sx), dh = Math.round(h * sy), cx = e.x + ox + e.w / 2, by = e.y + oy + e.h + 3;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(Math.round(cx - 9 + (e.z > 0 ? e.z * 0.1 : 0)), Math.round(e.y + oy + e.h - 1), 18 - Math.round(e.z * 0.2), 3);
    if (e.enraged && Math.floor(clock * 6) % 2 && !flash) ctx.globalAlpha = 0.85;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, Math.round(cx - dw / 2), Math.round(by - dh - e.z), dw, dh);
    ctx.globalAlpha = 1;
    if (e.st === 'squat' && Math.floor(e.t * 14) % 2) D.text(ctx, '!', Math.round(cx - 3), Math.round(by - dh - 10), { size: 8, color: C.red, shadow: '#000' });
  }
  function drawWraith(ctx, e, ox, oy, flash) {
    var rows = mirror(WRAITH_HALF), pal = e.ph === 3 ? { h: '#a01840', d: '#120a22', e: '#ffffff', M: '#ff5a2a' } : WRAITH_PAL;
    var spr = flash ? S('wrw', rows, whiten(WRAITH_PAL)) : S('wr' + e.ph, rows, pal);
    var cx = e.x + ox + e.w / 2, y = Math.round(e.y + oy + Math.sin(e.bob * 3) * 1.5 - 7);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.3 * e.alpha) + ')'; ctx.fillRect(Math.round(cx - 6), Math.round(e.y + oy + e.h + 3), 12, 2);
    ctx.globalAlpha = Math.max(0, Math.min(1, e.alpha));
    var tele = (e.st === 'wind' || e.st === 'dashwind') && Math.floor(e.t * 16) % 2;
    ctx.drawImage(tele ? S('wrw', rows, whiten(WRAITH_PAL)) : spr, Math.round(cx - 8), y);
    ctx.globalAlpha = 1;
    if (e.st === 'dashwind') { ctx.globalAlpha = 0.5; D.line(ctx, cx, e.y + oy + 7, cx + Math.cos(e.aim) * 90, e.y + oy + 7 + Math.sin(e.aim) * 90, C.red, 1); ctx.globalAlpha = 1; }
    if (e.st === 'wind' || e.st === 'dashwind') D.text(ctx, '!', Math.round(cx - 3), y - 9, { size: 8, color: C.red, shadow: '#000' });
    if (e.st === 'stun') D.text(ctx, '*', Math.round(cx - 3), y - 6 + Math.round(Math.sin(clock * 12)), { size: 8, color: C.yellow });
  }

  function drawEntities(ctx, rm, ox, oy, withHero) {
    var i, list = [];
    for (i = 0; i < rm.blocks.length; i++) { var b = rm.blocks[i]; ctx.drawImage(tiles(DG.theme).block, Math.round(b.x + ox), Math.round(b.y + oy)); }
    for (i = 0; i < rm.items.length; i++) drawItem(ctx, rm.items[i], ox, oy);
    for (i = 0; i < rm.en.length; i++) list.push({ y: rm.en[i].y + rm.en[i].h, e: rm.en[i] });
    if (withHero) list.push({ y: hero.y + HB, hero: true });
    list.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < list.length; i++) { if (list[i].hero) drawHero(ctx, ox, oy); else drawEnemy(ctx, list[i].e, ox, oy); }
    for (i = 0; i < rm.arrows.length; i++) {
      var a = rm.arrows[i], ax = Math.round(a.x + ox), ay = Math.round(a.y + oy), f = a.dir;
      ctx.fillStyle = '#e8d8b0';
      if (f === 0 || f === 2) { ctx.fillRect(ax, ay - 4, 1, 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(ax - 1, f === 0 ? ay - 5 : ay + 3, 3, 2); ctx.fillStyle = '#ff3a4d'; ctx.fillRect(ax - 1, f === 0 ? ay + 3 : ay - 4, 3, 1); }
      else { ctx.fillRect(ax - 4, ay, 8, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(f === 1 ? ax + 3 : ax - 5, ay - 1, 2, 3); ctx.fillStyle = '#ff3a4d'; ctx.fillRect(f === 1 ? ax - 4 : ax + 3, ay - 1, 1, 3); }
    }
    for (i = 0; i < rm.projs.length; i++) {
      var p = rm.projs[i], px = Math.round(p.x + ox), py = Math.round(p.y + oy);
      if (p.k === 'goo') { ctx.fillStyle = '#1f8a3a'; ctx.fillRect(px - 3, py - 2, 6, 5); ctx.fillStyle = '#5ce06a'; ctx.fillRect(px - 2, py - 3, 4, 6); ctx.fillStyle = '#e8ffe8'; ctx.fillRect(px - 1, py - 2, 1, 1); }
      else { ctx.fillStyle = '#5a2ab0'; ctx.fillRect(px - 3, py - 2, 6, 4); ctx.fillRect(px - 2, py - 3, 4, 6); ctx.fillStyle = Math.floor(clock * 14) % 2 ? '#3de2ff' : '#ffffff'; ctx.fillRect(px - 2, py - 2, 4, 4); }
    }
  }

  function drawHud(ctx, W) {
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, 14);
    var n = Math.min(10, hero.maxHp / 2), i, v;
    for (i = 0; i < n; i++) {
      v = hero.hp - i * 2;
      var rows = v >= 2 ? HEART_FULL : v === 1 ? HEART_HALF : HEART_EMPTY, key = v >= 2 ? 'hf' : v === 1 ? 'hh' : 'he';
      var yb = (hero.hp <= 2 && v > 0 && Math.floor(clock * 4) % 2) ? 1 : 0;
      ctx.drawImage(S(key, rows, HEART_PAL), 3 + i * 8, 4 + yb);
    }
    D.text(ctx, U.pad(R.score, 5), W - 3, 4, { size: 6, color: C.yellow, align: 'right' });
    // bottom panel
    ctx.fillStyle = '#0c0f1c'; ctx.fillRect(0, 126, W, 38);
    ctx.fillStyle = '#2a3558'; ctx.fillRect(0, 126, W, 1);
    drawMinimap(ctx, 4, 131);
    var x0 = 58;
    ctx.drawImage(S('key', ICON.key, ICON_PAL.key), x0 - 2, 128 + 1, 12, 12);
    D.text(ctx, 'x' + keys, x0 + 10, 133, { size: 6, color: keys ? C.yellow : '#5d6d99' });
    ctx.globalAlpha = bossKey[dg] ? 1 : 0.28;
    ctx.drawImage(S('bk', ICON.key, ICON_PAL.bosskey), x0 + 32, 129);
    ctx.globalAlpha = 1;
    D.text(ctx, 'B', x0 + 2, 146, { size: 6, color: '#8fa3c8' });
    ctx.globalAlpha = hasBow ? 1 : 0.28; drawBow(ctx, x0 + 10, 141); ctx.globalAlpha = 1;
    D.text(ctx, hasBow ? 'x' + U.pad(ammo, 2) : '--', x0 + 24, 146, { size: 6, color: hasBow ? (ammo > 0 ? C.cyan : C.red) : '#5d6d99' });
    D.text(ctx, DG.name, 56, 156, { size: 6, color: TH[dg].accent });
    D.text(ctx, 'D' + dg, 72, 4, { size: 6, color: TH[dg].accent });
  }

  function drawMinimap(ctx, x0, y0) {
    var cw = 8, ch = 6, g = 1, mw = DG.cols * (cw + g) - g, mh = DG.rows * (ch + g) - g, c, r, id, def, i;
    var bw = 5 * (cw + g) - g;
    var ox = x0 + Math.round((bw - mw) / 2), oy = y0 + Math.round((4 * (ch + g) - g - mh) / 2);
    ctx.fillStyle = '#05070f'; ctx.fillRect(x0 - 2, y0 - 2, bw + 4, 4 * (ch + g) - g + 4);
    D.frame(ctx, x0 - 2, y0 - 2, bw + 4, 4 * (ch + g) - g + 4, '#2a3558', 1);
    var blink = Math.floor(clock * 3) % 2;
    for (r = 0; r < DG.rows; r++) for (c = 0; c < DG.cols; c++) {
      id = rid(c, r); def = DG.rooms[id]; if (!def) continue;
      var vis = sav.visited[visitedKey(id)], px = ox + c * (cw + g), py = oy + r * (ch + g), known = vis;
      if (!vis) {
        for (i = 0; i < 4 && !known; i++) { var nb = neighbour(id, i); if (sav.visited[visitedKey(nb)] && DG.rooms[nb].ex[DIRN[(i + 2) % 4]]) known = 2; }
      }
      if (!known) continue;
      var col = vis ? (def.boss ? '#c0304a' : id === DG.start.id ? '#3a9a5a' : '#5a6aa0') : '#2a3050';
      ctx.fillStyle = col; ctx.fillRect(px, py, cw, ch);
      if (vis) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(px, py, cw, 1); }
      if (!vis) { D.frame(ctx, px, py, cw, ch, '#4a5580', 1); ctx.fillStyle = '#05070f'; ctx.fillRect(px + 1, py + 1, cw - 2, ch - 2); }
      if (vis && def.chest && !sav.chests[sk(id)]) { ctx.fillStyle = '#ffd23a'; ctx.fillRect(px + 3, py + 2, 2, 2); }
      // locked doors
      Object.keys(def.ex).forEach(function (k) {
        var code = def.ex[k]; if (code === 'o' || !vis || sav.opened[doorKey(id, SIDE[k])]) return;
        ctx.fillStyle = code === 'N' ? '#ff3a4d' : '#ffd23a';
        if (k === 'e') ctx.fillRect(px + cw, py + 1, g, ch - 2); else if (k === 's') ctx.fillRect(px + 2, py + ch, cw - 4, g);
      });
      if (id === cur.id) { ctx.fillStyle = blink ? '#ffec27' : '#ffffff'; ctx.fillRect(px + 2, py + 1, cw - 4, ch - 2); }
    }
  }
  var DIRN = ['n', 'e', 's', 'w'];

  /* ------------------------------------------------------------ game */
  R.game({
    layout: 'full', size: [136, 164], bg: '#0a0c18', music: 'adventure',

    init: function () {
      Object.keys(HERO).forEach(function (k) { [0, 1].forEach(function (f) { checkRows('hero ' + k, heroRows(k, f), 12, 12); }); });
      SLIME_ROWS.forEach(function (r, i) { checkRows('slime' + i, r, 12, 12); });
      BAT_ROWS.forEach(function (r, i) { checkRows('bat' + i, r, 12, 12); });
      checkRows('skel', SKEL_ROWS, 12, 12);
      Object.keys(ICON).forEach(function (k) { checkRows('icon ' + k, ICON[k], 12, 12); });
      checkRows('gloop', mirror(GLOOP_HALF), 24, GLOOP_HALF.length);
      checkRows('wraith', mirror(WRAITH_HALF), 16, WRAITH_HALF.length);
      [1, 2].forEach(function (n) {
        var dn = DUN[n], count = 0, nBoss = 0;
        Object.keys(dn.rooms).forEach(function (id) {
          var rm = dn.rooms[id], p = id.split(',');
          count++; if (rm.boss) nBoss++;
          if (rm.rows.length !== 7) throw new Error(n + ':' + id + ' needs 7 rows');
          rm.rows.forEach(function (r, i) { if (r.length !== 9) throw new Error(n + ':' + id + ' row ' + i + ' needs 9 chars'); });
          Object.keys(rm.ex).forEach(function (k) {
            var d = SIDE[k], nid = (+p[0] + DX[d]) + ',' + (+p[1] + DY[d]), nb = dn.rooms[nid];
            if (!nb) throw new Error(n + ':' + id + ' exit ' + k + ' leads nowhere');
            if (nb.ex[DIRN[(d + 2) % 4]] !== rm.ex[k]) throw new Error(n + ':' + id + ' exit ' + k + ' does not match its neighbour');
            var dp = DOORT[d], cx = dp[0] - DX[d] - 1, cy = dp[1] - DY[d] - 1;   // interior tile just inside the doorway
            if (rm.rows[cy].charAt(cx) !== '.') throw new Error(n + ':' + id + ' blocks its ' + k + ' doorway');
          });
          if (rm.chest && rm.rows.join('').indexOf('C') < 0) throw new Error(n + ':' + id + ' has no chest tile');
        });
        if (n === 1 && count < 14) throw new Error('dungeon 1 needs 14+ rooms');
        if (nBoss !== 1) throw new Error('dungeon ' + n + ' needs one boss');
      });
    },

    reset: function () {
      clock = 0; trans = null; banner = null; intro = null; winT = 0; bump = 0; gotMsg = null; hitBlock = null;
      sav = freshSave(); ammo = 0; keys = 0; hasBow = false; bossKey = { 1: false, 2: false };
      hero = { x: 0, y: 0, face: 0, hp: 6, maxHp: 6, hurtT: 0, atkT: 0, kbT: 0, kx: 0, ky: 0, walkT: 0, shootT: 0, pushT: 0, pushB: null, pushD: -1, gotT: 0, gotKind: null, dead: false, deadT: 0, pref: 'x', hit: [], heal: 0 };
      R.lives = null; R.level = 1;
      startDungeon(1);
    },

    onPress: function (b) { if (b === 'left' || b === 'right') hero.pref = 'x'; else if (b === 'up' || b === 'down') hero.pref = 'y'; },

    update: function (dt) {
      clock += dt;
      if (intro) { banner = intro; intro = null; }
      if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
      if (winT > 0) { winT -= dt; updateRoom(dt); if (Math.random() < dt * 14) burst(U.rand(10, PW - 10), U.rand(10, PH - 10), { n: 6, color: [C.yellow, C.pink, C.cyan, C.lime, C.white], speed: 70, life: 0.8, size: 2, gravity: 40 }); if (winT <= 0) R.gameOver({ win: true }); return; }
      if (hero.dead) { hero.deadT -= dt; if (hero.deadT <= 0) R.gameOver(); return; }
      if (trans) {
        trans.t += dt;
        if (trans.t >= TRANS_T) { cur = trans.to; trans = null; enterRoom(); }
        return;
      }
      if (hero.gotT > 0) { hero.gotT -= dt; return; }
      updateHero(dt);
      updateRoom(dt);
      if (!trans && !hero.dead) checkEdge();
    },

    render: function (ctx, W, H) {
      ctx.imageSmoothingEnabled = false;
      drawHud(ctx, W);
      ctx.save();
      ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip();
      if (trans) {
        var p = Math.min(1, trans.t / TRANS_T), d = trans.d;
        var fx0 = OX - DX[d] * PW * p, fy0 = OY - DY[d] * PH * p, tx0 = OX + DX[d] * PW * (1 - p), ty0 = OY + DY[d] * PH * (1 - p);
        drawRoomTiles(ctx, trans.from, fx0, fy0);
        drawRoomTiles(ctx, trans.to, tx0, ty0);
        drawEntities(ctx, trans.to, tx0, ty0, true);
      } else {
        drawRoomTiles(ctx, cur, OX, OY);
        drawEntities(ctx, cur, OX, OY, true);
      }
      ctx.restore();
      D.frame(ctx, OX - 1, OY - 1, PW + 2, PH + 2, '#2a3558', 1);
      if (hero.gotT > 0 && hero.gotKind) {
        var s = GOT_TEXT[hero.gotKind] || '', sz = s.length * 8 > 124 ? 6 : 8;
        D.text(ctx, s, W / 2, OY + 10, { size: sz, color: C.yellow, align: 'center', shadow: '#000' });
        if (hero.gotKind === 'bow') D.text(ctx, 'B = SHOOT', W / 2, OY + 24, { size: 6, color: C.white, align: 'center', shadow: '#000' });
      }
      if (banner && !hero.dead) {
        var al = Math.min(1, banner.t * 2), bh = banner.s2 ? 30 : 18, by = OY + 6;
        ctx.globalAlpha = al; ctx.fillStyle = 'rgba(5,7,15,.8)'; ctx.fillRect(OX + 6, by, PW - 12, bh);
        D.frame(ctx, OX + 6, by, PW - 12, bh, '#2a3558', 1);
        D.text(ctx, banner.s, W / 2, by + 5, { size: 8, color: C.yellow, align: 'center', shadow: '#000' });
        if (banner.s2) D.text(ctx, banner.s2, W / 2, by + 18, { size: 6, color: C.white, align: 'center', shadow: '#000' });
        ctx.globalAlpha = 1;
      }
      if (hero.dead) { ctx.fillStyle = 'rgba(80,0,10,' + (0.35 * Math.min(1, (1.1 - hero.deadT) * 2)) + ')'; ctx.fillRect(OX, OY, PW, PH); }
    },

    serialize: function () {
      return { dg: dg, id: (trans ? trans.to : cur).id, x: hero.x, y: hero.y, f: hero.face, hp: hero.hp, mhp: hero.maxHp, ammo: ammo, keys: keys, bow: hasBow, bk: bossKey, sav: sav };
    },
    restore: function (s) {
      sav = s.sav || freshSave(); sav.bossHp = sav.bossHp || {}; ammo = s.ammo | 0; keys = s.keys | 0; hasBow = !!s.bow; bossKey = s.bk || { 1: false, 2: false };
      hero.maxHp = s.mhp; hero.hp = Math.max(1, Math.min(s.hp, s.mhp)); hero.face = s.f | 0;
      dg = s.dg; DG = DUN[dg]; R.level = dg;
      cur = buildRoom(s.id);
      hero.x = s.x; hero.y = s.y; trans = null; banner = null; winT = 0; hero.dead = false; hero.hurtT = 1.0;
      enterRoom();
    }
  });
})();
