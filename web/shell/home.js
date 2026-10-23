/* Console home screen: boot animation + 9999-in-1 style game menu, drawn on the LCD. */
(function () {
  var R = Retro, C = R.colors, qs = new URLSearchParams(location.search);
  var native = window.RetroNative || null;

  var TXT = {
    en: { store: 'GAME STORE', trophies: 'TROPHIES', settings: 'SETTINGS', add: 'ADD GAME', play: 'A: PLAY', fresh: 'NEW', no: 'NO.', hi: 'HI', empty: 'NO GAMES - OPEN THE STORE', title: 'RETRO 9999-IN-1',
      sStore: 'Download new games in one tap', sTrophies: 'Your achievements and records', sSettings: 'Skins, LCD, sound, language', sAdd: 'Install from file, link or QR code' },
    fr: { store: 'BOUTIQUE', trophies: 'TROPHEES', settings: 'REGLAGES', add: 'AJOUTER', play: 'A: JOUER', fresh: 'NEW', no: 'N.', hi: 'REC', empty: 'AUCUN JEU - OUVREZ LA BOUTIQUE', title: 'RETRO 9999-EN-1',
      sStore: 'Telechargez de nouveaux jeux en un clic', sTrophies: 'Vos succes et records', sSettings: 'Skins, ecran, son, langue', sAdd: 'Installer depuis fichier, lien ou QR code' },
    ar: { store: 'المتجر', trophies: 'الكؤوس', settings: 'الإعدادات', add: 'إضافة', play: 'A: العب', fresh: 'جديد', no: 'رقم', hi: 'أعلى', empty: 'لا توجد ألعاب - افتح المتجر', title: 'ريترو 9999 في 1',
      sStore: 'حمّل ألعابا جديدة بنقرة واحدة', sTrophies: 'إنجازاتك وأرقامك القياسية', sSettings: 'الشكل والشاشة والصوت واللغة', sAdd: 'ثبّت من ملف أو رابط أو رمز QR' }
  };
  var TT = TXT[R.init.lang] || TXT.en;

  var ICONS = {
    store: { palette: { G: '#00e436', Y: '#ffec27' }, rows: [
      '............', '.....GG.....', '.....GG.....', '.....GG.....', '..GGGGGGGG..', '...GGGGGG...', '....GGGG....', '.....GG.....', '............', '.YY......YY.', '.YYYYYYYYYY.', '............'] },
    trophies: { palette: { Y: '#ffec27', O: '#ffa300', B: '#ab5236' }, rows: [
      '............', '..YYYYYYYY..', 'YYYYYYYYYYYY', 'Y.YYYYYYYY.Y', 'Y.YYYYYYYY.Y', 'YYYYYYYYYYYY', '...YYYYYY...', '....OOOO....', '.....OO.....', '.....OO.....', '...BBBBBB...', '...BBBBBB...'] },
    settings: { palette: { S: '#c2c3c7', D: '#5f574f' }, rows: [
      '............', '.....SS.....', '..S.SSSS.S..', '..SSSSSSSS..', '...SSDDSSS..', '.SSSDDDDSSS.', '.SSSDDDDSSS.', '...SSDDSSS..', '..SSSSSSSS..', '..S.SSSS.S..', '.....SS.....', '............'] },
    add: { palette: { B: '#29adff', W: '#fff1e8' }, rows: [
      '............', '............', '.....BB.....', '.....BB.....', '.....BB.....', '.BBBBBBBBBB.', '.BBBBBBBBBB.', '.....BB.....', '.....BB.....', '.....BB.....', '............', '............'] }
  };

  var css = [
    '#home{position:absolute;left:0;top:0;width:272px;height:328px;background:#10131c;color:#fff;font:8px/1.4 RetroPx,monospace;direction:ltr;overflow:hidden}',
    '#hd{position:absolute;left:0;top:0;width:272px;height:50px;background:#171c2c;border-bottom:2px solid #2a3550}',
    '#hd canvas{position:absolute;left:0;top:0}',
    '#ttl{position:absolute;left:8px;top:7px;font-size:8px;color:#9fb2d0}',
    '#snd{position:absolute;right:8px;top:7px;font-size:7px;color:#00e436}',
    '#gname{position:absolute;left:8px;bottom:6px;width:190px;font-size:9px;white-space:nowrap;overflow:hidden}',
    '#gridwrap{position:absolute;left:6px;top:56px;width:260px;height:222px;overflow:hidden}',
    '#grid{position:absolute;left:0;top:0;width:260px;transition:transform .16s ease-out}',
    '.tile{position:absolute;box-sizing:border-box;width:84px;height:70px;background:#151a28;border:2px solid #232c44;border-radius:3px;text-align:center}',
    '.tile canvas{position:absolute;left:50%;top:9px;margin-left:-18px}',
    '.tile .nm{position:absolute;left:0;right:0;bottom:6px;font-size:6px;color:#9fb2d0;white-space:nowrap;overflow:hidden}',
    '.tile .nw{position:absolute;right:2px;top:2px;font-size:5px;background:#ff004d;color:#fff;padding:2px 3px}',
    '.tile.sel{background:#1f2740;border-color:var(--c);box-shadow:0 0 0 1px var(--c)}',
    '.tile.sel .nm{color:#fff}.tile.sel canvas{animation:bob .5s steps(2) infinite}',
    '@keyframes bob{50%{transform:translateY(-2px)}}',
    '#ft{position:absolute;left:0;top:282px;width:272px;height:46px;background:#171c2c;border-top:2px solid #2a3550}',
    '#desc{position:absolute;left:8px;top:7px;width:256px;font:6px/1.7 RetroPx,monospace;color:#b9c6de;height:24px;overflow:hidden}',
    '#hint{position:absolute;left:8px;bottom:5px;font-size:6px;color:#ffec27}',
    '#hs{position:absolute;right:8px;bottom:5px;font-size:6px;color:#ffb000}',
    '#empty{position:absolute;left:10px;right:10px;top:120px;text-align:center;font-size:7px;line-height:2;color:#9fb2d0}',
    '#boot{position:absolute;left:0;top:0;width:272px;height:328px;z-index:9;background:#10131c}'
  ].join('\n');

  var stage, lib = [], items = [], sel = 0, gridEl, headCanvas, tiles = [], bootRunning = false;

  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }

  function iconCanvas(icon, px) {
    var n = icon.rows.length, scale = Math.max(1, Math.floor(px / n));
    var spr = R.sprite(icon.rows, icon.palette, scale);
    var c = document.createElement('canvas'); c.width = spr.width; c.height = spr.height;
    var g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(spr, 0, 0);
    c.style.imageRendering = 'pixelated'; c.style.width = spr.width + 'px'; c.style.height = spr.height + 'px';
    c.style.marginLeft = (-spr.width / 2) + 'px';
    return c;
  }

  function buildItems() {
    items = lib.slice();
    items.push({ special: 'store', name: TT.store, short: TT.store, color: '#00e436', icon: ICONS.store, description: TT.sStore });
    items.push({ special: 'trophies', name: TT.trophies, short: TT.trophies, color: '#ffec27', icon: ICONS.trophies, description: TT.sTrophies });
    items.push({ special: 'settings', name: TT.settings, short: TT.settings, color: '#c2c3c7', icon: ICONS.settings, description: TT.sSettings });
    items.push({ special: 'import', name: TT.add, short: TT.add, color: '#29adff', icon: ICONS.add, description: TT.sAdd });
  }

  function build() {
    stage = R.shell();
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var home = el('div', '', stage); home.id = 'home';
    var hd = el('div', '', home); hd.id = 'hd';
    headCanvas = el('canvas', '', hd);
    var ttl = el('div', '', hd); ttl.id = 'ttl'; ttl.textContent = TT.title;
    var snd = el('div', '', hd); snd.id = 'snd';
    var gname = el('div', '', hd); gname.id = 'gname';
    var wrap = el('div', '', home); wrap.id = 'gridwrap';
    gridEl = el('div', '', wrap); gridEl.id = 'grid';
    var ft = el('div', '', home); ft.id = 'ft';
    el('div', '', ft).id = 'desc'; el('div', '', ft).id = 'hint'; el('div', '', ft).id = 'hs';
    el('div', '', home).id = 'empty';

    buildItems();
    tiles = items.map(function (g, i) {
      var t = el('div', 'tile', gridEl);
      t.style.left = (i % 3) * 88 + 'px'; t.style.top = Math.floor(i / 3) * 74 + 'px'; t.style.setProperty('--c', g.color || '#fff');
      t.appendChild(iconCanvas(g.icon, 36));
      el('div', 'nm', t).textContent = String(g.short || g.name).toUpperCase().slice(0, 11);
      if (g.isNew) el('div', 'nw', t).textContent = TT.fresh;
      t.addEventListener('pointerup', function () { if (bootRunning) return; if (sel === i) activate(); else { sel = i; show(); R.sfx.play('tick'); } });
      return t;
    });
    if (!lib.length) home.querySelector('#empty').textContent = TT.empty;
    var last = qs.get('last');   // the menu opens on the game you just played
    if (last) for (var k = 0; k < items.length; k++) if (items[k].id === last) sel = k;
    window.addEventListener('resize', function () { drawHead(); });
    show();
  }

  function drawHead() {
    var s = R._core.state, k = Math.max(1, Math.round(s.stageScale * (window.devicePixelRatio || 1)));
    headCanvas.width = 272 * k; headCanvas.height = 50 * k; headCanvas.style.width = '272px'; headCanvas.style.height = '50px';
    var ctx = headCanvas.getContext('2d'); ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, 272, 50);
    var idx = Math.min(sel + 1, lib.length || 0);
    var isGame = !items[sel].special;
    R.draw.text(ctx, TT.no, 204, 31, { size: 7, color: '#9fb2d0', align: 'left' });
    R.draw.seg(ctx, isGame ? sel + 1 : 0, 3, 226, 24, 8, 14, 2);
  }

  function show() {
    var g = items[sel], row = Math.floor(sel / 3), rows = Math.ceil(items.length / 3);
    tiles.forEach(function (t, i) { t.classList.toggle('sel', i === sel); });
    var top = Math.max(0, Math.min(row - 1, rows - 3));
    gridEl.style.transform = 'translateY(' + (-top * 74) + 'px)';
    var gn = document.getElementById('gname'); gn.textContent = String(g.name).toUpperCase(); gn.style.color = g.color || '#fff';
    document.getElementById('desc').textContent = g.description || '';
    document.getElementById('hint').textContent = TT.play;
    var hs = document.getElementById('hs');
    hs.textContent = !g.special && g.hi > 0 ? TT.hi + ' ' + R.util.pad(g.hi, 6) : '';
    document.getElementById('snd').textContent = R.settings.sound ? '♪ ON' : '♪ OFF';
    drawHead();
  }

  function move(dx, dy) {
    var n = items.length, i = sel;
    if (dx) i = (sel + dx + n) % n;
    if (dy) {
      var j = sel + dy * 3;
      if (j >= n || j < 0) { var col = sel % 3, rows = Math.ceil(n / 3); var r = dy > 0 ? 0 : rows - 1; j = r * 3 + col; if (j >= n) j -= 3; }
      i = j;
    }
    if (i !== sel) { sel = i; R.sfx.play('tick'); show(); }
  }

  function activate() {
    var g = items[sel];
    R.sfx.play('select'); R.vibrate(15);
    if (g.special) R.post({ type: 'open', target: g.special });
    else if (native) R.post({ type: 'launch', id: g.id });
    else location.href = g.url;
  }

  function onButton(name, kind) {
    if (bootRunning) { if (kind === 'down') skipBoot = true; return; }
    if (kind === 'up') return;
    if (name === 'left') move(-1, 0);
    else if (name === 'right') move(1, 0);
    else if (name === 'up') move(0, -1);
    else if (name === 'down') move(0, 1);
    else if ((name === 'a' || name === 'start') && kind === 'down') activate();
  }

  /* ---------------------------------------------------------- boot animation */
  var skipBoot = false;
  function boot(done) {
    bootRunning = true; skipBoot = false;
    var cv = document.createElement('canvas'); cv.id = 'boot'; stage.appendChild(cv);
    var s = R._core.state, k = Math.max(1, Math.round(s.stageScale * (window.devicePixelRatio || 1)));
    cv.width = 272 * k; cv.height = 328 * k; cv.style.width = '272px'; cv.style.height = '328px';
    var ctx = cv.getContext('2d');
    var CELL = 16, COLS = 17, ROWS = 20, rainbow = [C.red, C.orange, C.yellow, C.lime, C.blue, C.purple];
    var t0 = null, lastTick = -1, jingle = [0, 0, 0, 0], letters = 'RETRO';
    function frame(ts) {
      if (t0 == null) t0 = ts;
      var t = (ts - t0) / 1000;
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, 272, 328);
      if (t < 1.0) {                       // phase 1: LCD self test — rows light up, then clear
        var p = t / 1.0, lit = p < 0.55 ? p / 0.55 * ROWS : ROWS, clr = p > 0.8 ? (p - 0.8) / 0.2 * ROWS : 0;
        for (var y = 0; y < ROWS; y++) {
          if (y < Math.floor(lit) && y >= Math.floor(clr)) for (var x = 0; x < COLS; x++) R.draw.cell(ctx, x * CELL, 4 + y * CELL, CELL, C.cyan);
        }
        var tick = Math.floor(lit / 2); if (tick !== lastTick && p < 0.6) { lastTick = tick; R.sfx.play('tick'); }
      } else if (t < 2.8) {                // phase 2: logo drops in
        var q = t - 1.0;
        for (var i = 0; i < letters.length; i++) {
          var d = Math.max(0, Math.min(1, (q - i * 0.12) / 0.35)), bounce = d < 1 ? (1 - d) * -120 : 0;
          if (d > 0 && !jingle[i] && i < 4) { jingle[i] = 1; R.sfx.tone([523, 659, 784, 1047][i], 0.18, { vol: 0.12, type: 'square' }); }
          if (d > 0) R.draw.text(ctx, letters[i], 28 + i * 40, 110 + bounce, { size: 32, color: rainbow[i % rainbow.length], shadow: '#000' });
        }
        if (q > 0.8) R.draw.text(ctx, '9999 IN 1', 136, 168, { size: 16, color: C.white, align: 'center', shadow: '#ab5236' });
        if (q > 1.1 && Math.floor(q * 4) % 2) R.draw.text(ctx, 'BRICK GAME', 136, 210, { size: 8, color: C.yellow, align: 'center' });
        // little brick row along the bottom
        for (var b = 0; b < COLS; b++) R.draw.block(ctx, b * CELL, 296, CELL, rainbow[(b + Math.floor(q * 6)) % rainbow.length]);
      } else { finish(); return; }
      if (skipBoot) { finish(); return; }
      requestAnimationFrame(frame);
    }
    function finish() { cv.remove(); bootRunning = false; R.post({ type: 'boot-done' }); if (done) done(); }
    requestAnimationFrame(frame);
  }

  /* -------------------------------------------------------------------- go */
  function start() {
    R.input.onButton(onButton);
    var load = native ? Promise.resolve().then(function () { return JSON.parse(native.getLibrary()); })
      : fetch('/__library.json').then(function (r) { return r.json(); });
    load.catch(function () { return { games: [] }; }).then(function (data) {
      lib = data.games || [];
      build();
      R.post({ type: 'home-ready' });
      if (qs.get('boot') === '1') boot();
    });
  }
  window.RetroHome = { select: function (i) { sel = i; show(); }, activate: activate, items: function () { return items; }, selected: function () { return sel; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
