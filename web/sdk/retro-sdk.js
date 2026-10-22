/*! Retro Console Game SDK v1
 *
 * One script gives a game: an LCD "stage", D-pad/A/B/START input, a fixed-step game loop,
 * score/level/lives HUD (classic 7-segment side panel), chiptune audio, pixel-sprite helpers,
 * particles, save & resume, hi-scores, achievements and the bridge to the native Android shell.
 *
 * Docs: docs/GAME_SDK.md
 */
(function (global) {
  'use strict';
  if (global.Retro) return;

  var SDK_VERSION = 1;
  var STAGE_W = 272, STAGE_H = 328;              // logical LCD size (17:20.5)
  var FIELD_AREA_W = 168;                        // classic layout: field area, panel gets the rest
  var PANEL_W = STAGE_W - FIELD_AREA_W;          // 104
  var STEP_MS = 1000 / 60;

  var scriptSrc = (document.currentScript && document.currentScript.src) || '';
  var qs = new URLSearchParams(location.search);

  /* ------------------------------------------------------------------ utils */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function pad(n, len) { n = String(Math.max(0, Math.floor(n))); while (n.length < len) n = '0' + n; return n; }

  var shadeCache = {};
  function shade(hex, amt) {
    var key = hex + '|' + amt;
    if (shadeCache[key]) return shadeCache[key];
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); }
    return (shadeCache[key] = 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')');
  }

  var util = {
    clamp: clamp,
    lerp: function (a, b, t) { return a + (b - a) * t; },
    rand: function (a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); },
    randInt: function (a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.floor(Math.random() * (b - a)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle: function (arr) {
      for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      return arr;
    },
    overlap: function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; },
    dist: function (x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); },
    pad: pad,
    shade: shade
  };

  /* ---------------------------------------------------------------- palette */
  var COLORS = {
    black: '#000000', navy: '#1d2b53', plum: '#7e2553', green: '#008751', brown: '#ab5236', dgray: '#5f574f',
    silver: '#c2c3c7', white: '#fff1e8', red: '#ff004d', orange: '#ffa300', yellow: '#ffec27', lime: '#00e436',
    blue: '#29adff', lavender: '#83769c', pink: '#ff77a8', peach: '#ffccaa',
    cyan: '#3de2ff', purple: '#b455ff', ink: '#0b0e14', night: '#10131c', steel: '#2a3550'
  };
  var PAL = ['black', 'navy', 'plum', 'green', 'brown', 'dgray', 'silver', 'white', 'red', 'orange', 'yellow', 'lime', 'blue', 'lavender', 'pink', 'peach']
    .map(function (n) { return COLORS[n]; });

  /* ------------------------------------------------------------------- i18n */
  var I18N = {
    en: { start: 'PRESS START', paused: 'PAUSED', over: 'GAME OVER', score: 'SCORE', hi: 'HI-SCORE', level: 'LEVEL', lives: 'LIVES', next: 'NEXT',
      newHi: 'NEW HI-SCORE!', resume: 'START: RESUME', retry: 'START: RETRY', cont: 'START: CONTINUE', newGame: 'A: NEW GAME', pause: 'PAUSE',
      how: 'HOW TO PLAY', trophy: 'TROPHY', soundOn: 'SOUND ON', soundOff: 'SOUND OFF', dpad: 'D-PAD', yourScore: 'SCORE' },
    fr: { start: 'APPUYEZ START', paused: 'PAUSE', over: 'PERDU', score: 'SCORE', hi: 'RECORD', level: 'NIVEAU', lives: 'VIES', next: 'SUIVANT',
      newHi: 'NOUVEAU RECORD!', resume: 'START: REPRENDRE', retry: 'START: REJOUER', cont: 'START: CONTINUER', newGame: 'A: NOUVELLE PARTIE', pause: 'PAUSE',
      how: 'COMMENT JOUER', trophy: 'TROPHEE', soundOn: 'SON ACTIVE', soundOff: 'SON COUPE', dpad: 'CROIX', yourScore: 'SCORE' },
    ar: { start: 'اضغط ابدأ', paused: 'إيقاف مؤقت', over: 'انتهت اللعبة', score: 'النقاط', hi: 'الرقم القياسي', level: 'المستوى', lives: 'الأرواح', next: 'التالي',
      newHi: 'رقم قياسي جديد!', resume: 'ابدأ: متابعة', retry: 'ابدأ: إعادة', cont: 'ابدأ: استئناف', newGame: 'A: لعبة جديدة', pause: 'إيقاف',
      how: 'طريقة اللعب', trophy: 'كأس', soundOn: 'الصوت يعمل', soundOff: 'الصوت متوقف', dpad: 'الأسهم', yourScore: 'النقاط' }
  };

  /* ----------------------------------------------------------- native bridge */
  var native = global.RetroNative || null;
  var devLog = (global.__retroLog = []);
  function post(msg) {
    if (native) { try { native.postMessage(JSON.stringify(msg)); } catch (e) {} }
    else { devLog.push(msg); if (devLog.length > 200) devLog.shift(); }
  }

  function guessGameId() {
    var m = location.pathname.match(/^\/(?:builtin|installed)\/([^\/]+)\//);
    if (m) return m[1];
    var parts = location.pathname.split('/').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 2] : 'game';
  }

  var INIT = (function () {
    var o = {};
    if (native) { try { o = JSON.parse(native.getInit()) || {}; } catch (e) { o = {}; } }
    var id = o.gameId || guessGameId();
    function k(s) { return 'retro:' + id + ':' + s; }
    var unlocked = o.unlocked;
    if (!unlocked) { try { unlocked = JSON.parse(lsGet(k('ach')) || '[]'); } catch (e) { unlocked = []; } }
    return {
      gameId: id,
      lang: (o.lang || qs.get('lang') || (navigator.language || 'en').slice(0, 2)).toLowerCase(),
      sound: o.sound !== undefined ? !!o.sound : qs.get('sound') !== '0',
      volume: o.volume !== undefined ? num(o.volume) : 0.7,
      lcd: o.lcd || qs.get('lcd') || 'color',
      grid: o.grid !== undefined ? !!o.grid : qs.get('grid') === '1',
      vibrate: o.vibrate !== undefined ? !!o.vibrate : true,
      hi: o.hi !== undefined ? num(o.hi) : num(lsGet(k('hi'))),
      save: o.save !== undefined ? o.save : lsGet(k('save')),
      unlocked: unlocked,
      dev: !native,
      key: k
    };
  })();

  var T = I18N[INIT.lang] || I18N.en;
  function tr(key) { return T[key] || I18N.en[key] || key; }

  /* --------------------------------------------------------------- settings */
  var settings = { sound: INIT.sound, volume: INIT.volume, lcd: INIT.lcd, grid: INIT.grid, vibrate: INIT.vibrate };

  /* ------------------------------------------------------------------ audio */
  var AC = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;

  function ensureAudio() {
    if (AC) return AC;
    try {
      var C = global.AudioContext || global.webkitAudioContext;
      if (!C) return null;
      AC = new C();
      master = AC.createGain();
      master.gain.value = settings.sound ? settings.volume : 0;
      master.connect(AC.destination);
      sfxBus = AC.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      musicBus = AC.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    } catch (e) { AC = null; }
    return AC;
  }
  function resumeAudio() { if (!AC) ensureAudio(); if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} } }
  function applyVolume() { if (master) master.gain.value = settings.sound ? settings.volume : 0; }
  function audioOn() { return settings.sound && ensureAudio(); }

  function tone(freq, dur, o) {
    if (!audioOn()) return;
    o = o || {};
    var t0 = AC.currentTime + (o.delay || 0);
    var osc = AC.createOscillator(), g = AC.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    var v = o.vol == null ? 0.15 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  function noise(dur, o) {
    if (!audioOn()) return;
    o = o || {};
    if (!noiseBuf) {
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = AC.currentTime + (o.delay || 0);
    var src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var f = AC.createBiquadFilter(); f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 3000, t0);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweep), t0 + dur);
    var g = AC.createGain(); var v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(Math.max(0.0002, v), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.03);
  }

  var SFX = {
    blip: function () { tone(880, 0.05, { vol: 0.12 }); },
    select: function () { tone(660, 0.05, { vol: 0.12 }); tone(990, 0.08, { vol: 0.12, delay: 0.05 }); },
    move: function () { tone(240, 0.025, { vol: 0.07 }); },
    tick: function () { tone(1400, 0.015, { vol: 0.05 }); },
    rotate: function () { tone(420, 0.05, { vol: 0.1, slide: 700 }); },
    drop: function () { tone(180, 0.09, { vol: 0.16, slide: 55 }); },
    land: function () { tone(110, 0.06, { vol: 0.14, type: 'triangle' }); },
    line: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.09, { vol: 0.12, delay: i * 0.06 }); }); },
    coin: function () { tone(988, 0.06, { vol: 0.12 }); tone(1319, 0.22, { vol: 0.12, delay: 0.06 }); },
    jump: function () { tone(260, 0.18, { vol: 0.13, slide: 640 }); },
    hit: function () { noise(0.12, { vol: 0.2 }); tone(140, 0.12, { vol: 0.14, type: 'sawtooth', slide: 50 }); },
    shoot: function () { tone(1000, 0.12, { vol: 0.09, slide: 180 }); },
    explode: function () { noise(0.45, { vol: 0.3, freq: 2600, sweep: 120 }); tone(90, 0.3, { vol: 0.15, type: 'sawtooth', slide: 35 }); },
    powerup: function () { [392, 523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.08, { vol: 0.11, delay: i * 0.05, type: 'triangle' }); }); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.2, { vol: 0.14, delay: i * 0.16, type: 'triangle' }); }); },
    win: function () { [523, 523, 523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.14, { vol: 0.12, delay: i * 0.1 }); }); },
    start: function () { [262, 330, 392, 523].forEach(function (f, i) { tone(f, 0.1, { vol: 0.12, delay: i * 0.07 }); }); },
    pause: function () { tone(330, 0.07, { vol: 0.1 }); tone(220, 0.09, { vol: 0.1, delay: 0.07 }); },
    trophy: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.12, { vol: 0.1, delay: i * 0.07, type: 'triangle' }); }); }
  };
  var sfx = {
    play: function (name, opts) { var f = SFX[name]; if (f) f(opts); },
    tone: tone,
    noise: noise,
    names: Object.keys(SFX)
  };

  /* chiptune loops: tokens are 16th-note steps; '.' = rest, '-' = hold, otherwise a note like C#4 */
  var SONGS = {
    puzzle: { bpm: 112, voices: [
      { wave: 'triangle', vol: 0.11, seq: 'E5 . G5 . A5 . G5 . E5 . D5 . C5 - - . D5 . F5 . A5 . G5 . F5 . E5 . D5 - - .' },
      { wave: 'square', vol: 0.05, seq: 'C3 . . . G2 . . . A2 . . . E2 . . . D3 . . . A2 . . . G2 . . . G2 . . .' }] },
    action: { bpm: 152, voices: [
      { wave: 'square', vol: 0.07, seq: 'A4 . A4 C5 . E5 . D5 . C5 . B4 . A4 - . G4 . G4 B4 . D5 . C5 . B4 . A4 . G4 - .' },
      { wave: 'sawtooth', vol: 0.05, seq: 'A2 A2 . A2 A2 . A2 . A2 A2 . A2 A2 . E3 . G2 G2 . G2 G2 . G2 . G2 G2 . G2 G2 . D3 .' },
      { noise: true, vol: 0.05, seq: 'x . . . x . . . x . . . x . x .' }] },
    adventure: { bpm: 132, voices: [
      { wave: 'square', vol: 0.06, seq: 'C5 . E5 . G5 . E5 . C5 . G4 . E5 - . . D5 . F5 . A5 . F5 . D5 . A4 . F5 - . .' },
      { wave: 'triangle', vol: 0.09, seq: 'C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 . D3 . A3 . D3 . A3 . D3 . A3 . D3 . A3 .' }] },
    space: { bpm: 126, voices: [
      { wave: 'square', vol: 0.05, seq: 'E4 B4 E5 B4 E4 B4 E5 B4 G4 D5 G5 D5 G4 D5 G5 D5 A4 E5 A5 E5 A4 E5 A5 E5 F4 C5 F5 C5 F4 C5 F5 C5' },
      { wave: 'triangle', vol: 0.1, seq: 'E2 - - - - - - - G2 - - - - - - - A2 - - - - - - - F2 - - - - - - -' }] },
    chill: { bpm: 96, voices: [
      { wave: 'triangle', vol: 0.12, seq: 'G4 . . . B4 . . . D5 . . . B4 . . . A4 . . . C5 . . . E5 . . . C5 . . .' },
      { wave: 'sine', vol: 0.12, seq: 'G2 - - - - - - - D3 - - - - - - - A2 - - - - - - - E3 - - - - - - -' }] },
    retro: { bpm: 168, voices: [
      { wave: 'square', vol: 0.06, seq: 'E5 E5 . E5 . C5 E5 . G5 . . . G4 . . . C5 . . G4 . . E4 . . A4 . B4 . A#4 A4 . .' },
      { wave: 'square', vol: 0.045, seq: 'C3 . G3 . C3 . G3 . G2 . D3 . G2 . D3 . A2 . E3 . A2 . E3 . F2 . C3 . F2 . C3 .' },
      { noise: true, vol: 0.04, seq: 'x . x . x . x . x . x . x . x .' }] }
  };
  var NOTE_IDX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function noteFreq(tok) {
    var m = /^([A-G]#?)(-?\d)$/.exec(tok);
    if (!m) return 0;
    var semis = NOTE_IDX[m[1]] + (parseInt(m[2], 10) - 4) * 12 - 9;   // relative to A4
    return 440 * Math.pow(2, semis / 12);
  }
  var music = { name: null, timer: null, step: 0, next: 0, song: null, running: false };
  function parseSong(song) {
    if (song._p) return song._p;
    song._p = song.voices.map(function (v) {
      var toks = v.seq.split(/\s+/).filter(Boolean), steps = [];
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (t === '.' || t === '-') { steps.push(null); continue; }
        var len = 1; while (toks[(i + len) % toks.length] === '-' && i + len < toks.length) len++;
        steps.push({ f: v.noise ? 0 : noteFreq(t), len: len });
      }
      return { wave: v.wave, vol: v.vol, noise: !!v.noise, steps: steps };
    });
    return song._p;
  }
  function musicTick() {
    if (!music.running || !AC || !settings.sound) return;
    var voices = parseSong(music.song), stepDur = 60 / music.song.bpm / 4;
    if (music.next < AC.currentTime - 0.1) music.next = AC.currentTime + 0.05;
    while (music.next < AC.currentTime + 0.18) {
      for (var i = 0; i < voices.length; i++) {
        var v = voices[i], s = v.steps[music.step % v.steps.length];
        if (!s) continue;
        if (v.noise) noise(0.05, { vol: v.vol, freq: 6000, filter: 'highpass', delay: music.next - AC.currentTime, bus: musicBus });
        else if (s.f) tone(s.f, Math.max(0.05, stepDur * s.len * 0.92), { type: v.wave, vol: v.vol, delay: music.next - AC.currentTime, bus: musicBus });
      }
      music.step++; music.next += stepDur;
    }
  }
  var musicApi = {
    songs: Object.keys(SONGS),
    play: function (name) {
      if (!SONGS[name]) return;
      if (music.name === name) { musicApi.resume(); return; }
      musicApi.stop();
      if (!ensureAudio()) return;
      music.name = name; music.song = SONGS[name]; music.step = 0; music.next = AC.currentTime + 0.05; music.running = true;
      music.timer = setInterval(musicTick, 40);
    },
    pause: function () { if (music.timer) { clearInterval(music.timer); music.timer = null; } music.running = false; },
    resume: function () {
      if (music.name && !music.running && AC) { music.next = AC.currentTime + 0.05; music.running = true; music.timer = setInterval(musicTick, 40); }
    },
    stop: function () { musicApi.pause(); music.name = null; music.step = 0; }
  };

  function vibrate(ms) {
    if (!settings.vibrate) return;
    ms = clamp(num(ms) || 20, 1, 500);
    if (native) post({ type: 'vibrate', ms: ms });
    else if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  /* ----------------------------------------------------------------- drawing */
  var spriteCache = {};
  var spriteIdentity = typeof WeakMap === 'function' ? new WeakMap() : null;   // rows array -> palette object -> scale -> canvas (no string building per frame)
  function makeSprite(rows, palette, scale) {
    scale = scale || 1;
    var byPal = spriteIdentity && spriteIdentity.get(rows);
    if (byPal && palette && typeof palette === 'object') { var byScale = byPal.get(palette); if (byScale && byScale[scale]) return byScale[scale]; }
    var key = rows.join('/') + JSON.stringify(palette) + scale;
    var c = spriteCache[key];
    if (!c) {
      var h = rows.length, w = 0, i, x, y;
      for (i = 0; i < h; i++) w = Math.max(w, rows[i].length);
      c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
      var g = c.getContext('2d');
      for (y = 0; y < h; y++) for (x = 0; x < rows[y].length; x++) {
        var ch = rows[y].charAt(x);
        if (ch === '.' || ch === ' ') continue;
        var col = palette[ch];
        if (col && col.charAt(0) !== '#' && COLORS[col]) col = COLORS[col];
        if (!col) continue;
        g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale);
      }
      c.spriteW = w; c.spriteH = h;
      spriteCache[key] = c;
    }
    if (spriteIdentity && palette && typeof palette === 'object') {
      if (!byPal) { byPal = new WeakMap(); spriteIdentity.set(rows, byPal); }
      var bs = byPal.get(palette) || {}; bs[scale] = c; byPal.set(palette, bs);
    }
    return c;
  }

  var draw = {
    /** amber 7-segment number: seg(ctx, value, digits, x, y, digitW, digitH, gap) */
    seg: function (ctx, value, digits, x, y, w, h, gap) { segNumber(ctx, value, digits, x, y, w || 11, h || 18, gap == null ? 3 : gap); },
    rect: function (ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); },
    frame: function (ctx, x, y, w, h, color, t) {
      t = t || 1; ctx.fillStyle = color;
      ctx.fillRect(x, y, w, t); ctx.fillRect(x, y + h - t, w, t); ctx.fillRect(x, y, t, h); ctx.fillRect(x + w - t, y, t, h);
    },
    circle: function (ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); },
    line: function (ctx, x1, y1, x2, y2, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
    /** beveled "toy brick" tile */
    block: function (ctx, x, y, s, color) {
      var b = Math.max(1, Math.round(s / 8));
      ctx.fillStyle = color; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = shade(color, 0.45); ctx.fillRect(x, y, s, b); ctx.fillRect(x, y, b, s);
      ctx.fillStyle = shade(color, -0.45); ctx.fillRect(x, y + s - b, s, b); ctx.fillRect(x + s - b, y, b, s);
    },
    /** classic Brick-Game LCD pixel: hollow outer square with a solid core */
    cell: function (ctx, x, y, s, color) {
      var b = Math.max(1, Math.round(s / 8)), g = Math.max(1, Math.round(s / 5));
      ctx.fillStyle = color;
      ctx.fillRect(x, y, s, b); ctx.fillRect(x, y + s - b, s, b); ctx.fillRect(x, y, b, s); ctx.fillRect(x + s - b, y, b, s);
      ctx.fillRect(x + g + b, y + g + b, s - 2 * (g + b), s - 2 * (g + b));
    },
    text: function (ctx, str, x, y, o) {
      o = o || {}; var size = o.size || 8; str = String(str);
      ctx.font = size + 'px RetroPx, monospace'; ctx.textBaseline = 'top';
      var w = str.length * size, align = o.align || 'left';
      var px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      ctx.textAlign = 'left';
      if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(str, px + Math.max(1, size / 8), y + Math.max(1, size / 8)); }
      ctx.fillStyle = o.color || '#fff'; ctx.fillText(str, px, y);
      return w;
    },
    /** draw a sprite canvas / rows+palette at x,y. opts: flipX, alpha, scale */
    sprite: function (ctx, spr, x, y, o) {
      o = o || {};
      if (Array.isArray(spr)) spr = makeSprite(spr, o.palette || {}, o.scale || 1);
      var w = spr.width, h = spr.height;
      ctx.imageSmoothingEnabled = false;
      if (o.alpha != null || o.flipX) {
        ctx.save();
        if (o.alpha != null) ctx.globalAlpha = o.alpha;
        if (o.flipX) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0); }
        else ctx.drawImage(spr, x, y);
        ctx.restore();
      } else ctx.drawImage(spr, x, y);
    },
    /** compact top HUD for layout:"full" games */
    topBar: function (ctx, o) {
      o = o || {}; var w = state.field.w;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, w, 12);
      draw.text(ctx, 'SC ' + pad(hud.score, 5), 3, 3, { size: 6, color: COLORS.yellow });
      if (hud.lives != null) draw.text(ctx, 'x' + hud.lives, w / 2, 3, { size: 6, color: COLORS.pink, align: 'center' });
      if (o.hi !== false) draw.text(ctx, 'HI ' + pad(hud.hi, 5), w - 3, 3, { size: 6, color: COLORS.silver, align: 'right' });
    }
  };

  /* ---------------------------------------------------------------- effects */
  var fx = {
    parts: [], texts: [], shakeT: 0, shakeMag: 0, flashT: 0, flashDur: 0, flashColor: '#fff',
    burst: function (x, y, o) {
      o = o || {}; var n = o.n || 12;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, sp = (o.speed || 60) * (0.35 + Math.random() * 0.65);
        fx.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.gravity || 0,
          life: (o.life || 0.5) * (0.6 + Math.random() * 0.4), max: o.life || 0.5, size: o.size || 2,
          color: Array.isArray(o.color) ? util.pick(o.color) : (o.color || '#fff') });
      }
      if (fx.parts.length > 400) fx.parts.splice(0, fx.parts.length - 400);
    },
    text: function (x, y, str, color) { fx.texts.push({ x: x, y: y, s: String(str), c: color || '#fff', t: 0.8 }); },
    shake: function (mag, dur) { fx.shakeMag = mag || 3; fx.shakeT = dur || 0.25; },
    flash: function (color, dur) { fx.flashColor = color || '#fff'; fx.flashT = fx.flashDur = dur || 0.12; },
    clear: function () { fx.parts.length = 0; fx.texts.length = 0; fx.shakeT = 0; fx.flashT = 0; },
    update: function (dt) {
      var i, p;
      for (i = fx.parts.length - 1; i >= 0; i--) {
        p = fx.parts[i]; p.life -= dt;
        if (p.life <= 0) { fx.parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (i = fx.texts.length - 1; i >= 0; i--) { var t = fx.texts[i]; t.t -= dt; t.y -= 14 * dt; if (t.t <= 0) fx.texts.splice(i, 1); }
      if (fx.shakeT > 0) fx.shakeT -= dt;
      if (fx.flashT > 0) fx.flashT -= dt;
    },
    draw: function (ctx) {
      var i, p;
      for (i = 0; i < fx.parts.length; i++) {
        p = fx.parts[i]; ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
      }
      ctx.globalAlpha = 1;
      for (i = 0; i < fx.texts.length; i++) { var t = fx.texts[i]; draw.text(ctx, t.s, t.x, t.y, { size: 8, color: t.c, align: 'center', shadow: '#000' }); }
      if (fx.flashT > 0) { ctx.globalAlpha = clamp(fx.flashT / fx.flashDur, 0, 1) * 0.6; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, state.field.w, state.field.h); ctx.globalAlpha = 1; }
    }
  };

  /* -------------------------------------------------------------------- HUD */
  var hud = { score: 0, hi: INIT.hi, level: 1, lives: null, extraLabel: null, extra: null, levelLabel: null };
  function hudReset() { hud.score = 0; hud.level = 1; hud.lives = null; hud.extra = null; hud.extraLabel = null; }

  var SEG = [[1, 1, 1, 1, 1, 1, 0], [0, 1, 1, 0, 0, 0, 0], [1, 1, 0, 1, 1, 0, 1], [1, 1, 1, 1, 0, 0, 1], [0, 1, 1, 0, 0, 1, 1],
    [1, 0, 1, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1, 1], [1, 1, 1, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 0, 1, 1]];
  var SEG_ON = '#ffb000', SEG_OFF = 'rgba(255,176,0,0.10)';
  function seg7(ctx, x, y, w, h, digit, on) {
    var t = Math.max(2, Math.round(w / 5)), hh = (h - 3 * t) / 2, m = SEG[digit] || SEG[8];
    var rects = [[x + t, y, w - 2 * t, t], [x + w - t, y + t, t, hh], [x + w - t, y + 2 * t + hh, t, hh], [x + t, y + h - t, w - 2 * t, t],
      [x, y + 2 * t + hh, t, hh], [x, y + t, t, hh], [x + t, y + (h - t) / 2, w - 2 * t, t]];
    for (var i = 0; i < 7; i++) {
      ctx.fillStyle = on && m[i] ? SEG_ON : SEG_OFF;
      var r = rects[i]; ctx.fillRect(r[0], r[1], r[2], r[3]);
    }
  }
  function segNumber(ctx, value, digits, x, y, w, h, gap) {
    var s = pad(clamp(Math.floor(value), 0, Math.pow(10, digits) - 1), digits);
    var started = false;
    for (var i = 0; i < digits; i++) {
      var d = s.charCodeAt(i) - 48;
      if (d !== 0 || i === digits - 1) started = true;
      ctx.save(); ctx.translate(x + i * (w + gap), y + h); ctx.transform(1, 0, -0.14, 1, 0, 0);
      seg7(ctx, 0, -h, w, h, d, started); ctx.restore();
    }
  }

  var MASCOT_PAL = { H: '#ab5236', S: '#ffccaa', E: '#1d2b53', B: '#29adff', P: '#1d2b53', F: '#ff004d' };
  var MASCOT = [[
    '....HHHH....', '...HHHHHH...', '...SSSSSS...', '...SESSES...', '...SSSSSS...', '....SSSS....', '..BBBBBBBB..', '.SBBBBBBBBS.',
    '.SBBBBBBBBS.', '..BBBBBBBB..', '...PPPPPP...', '...PP..PP...', '..PP....PP..', '..PP....PP..', '..FF....FF..', '.FFF....FFF.'], [
    '....HHHH....', '...HHHHHH...', '...SSSSSS...', '...SESSES...', '...SSSSSS...', '....SSSS....', '..BBBBBBBB..', '..SBBBBBBS..',
    '..SBBBBBBS..', '..BBBBBBBB..', '...PPPPPP...', '...PPPPPP...', '....PP.PP...', '....PP.PP...', '...FFF.FF...', '...FFF.FFF..']];
  var mascot = { t: 0, frame: 0 };

  function panelLabel(ctx, s, x, y) { draw.text(ctx, s, x, y, { size: 7, color: '#9fb2d0' }); }
  function drawPanel() {
    var ctx = state.panelCtx; if (!ctx) return;
    var W = PANEL_W, H = STAGE_H, k = state.panelK;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(0, 0, 1, H);
    var y = 12, x = 8;
    panelLabel(ctx, tr('score'), x, y); segNumber(ctx, hud.score, 6, x, y + 12, 11, 18, 3); y += 40;
    panelLabel(ctx, tr('hi'), x, y); segNumber(ctx, hud.hi, 6, x, y + 12, 11, 18, 3); y += 40;
    if (state.cfg && state.cfg.renderNext) {
      panelLabel(ctx, tr('next'), x, y);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, y + 11, 52, 52);
      draw.frame(ctx, x, y + 11, 52, 52, 'rgba(255,255,255,.28)', 1);
      ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 13, 48, 48); ctx.clip(); ctx.translate(x + 2, y + 13);
      try { state.cfg.renderNext(ctx, 48, 48); } catch (e) { reportError(e); }
      ctx.restore(); y += 68;
    }
    panelLabel(ctx, hud.levelLabel || tr('level'), x, y); segNumber(ctx, hud.level, 2, x, y + 12, 11, 18, 3); y += 40;
    if (hud.lives != null) {
      panelLabel(ctx, tr('lives'), x, y);
      for (var i = 0; i < Math.min(hud.lives, 8); i++) {
        ctx.fillStyle = COLORS.red; var hx = x + i * 11;
        ctx.fillRect(hx + 1, y + 12, 3, 3); ctx.fillRect(hx + 6, y + 12, 3, 3); ctx.fillRect(hx, y + 13, 10, 3); ctx.fillRect(hx + 1, y + 16, 8, 2); ctx.fillRect(hx + 3, y + 18, 4, 2); ctx.fillRect(hx + 4, y + 20, 2, 1);
      }
      y += 34;
    }
    if (hud.extra != null) { panelLabel(ctx, hud.extraLabel || '', x, y); segNumber(ctx, num(hud.extra), 4, x, y + 12, 11, 18, 3); y += 40; }
    if (y <= H - 70) {
      var fr = state.mode === 'play' ? mascot.frame : 0;
      var spr = makeSprite(MASCOT[fr], MASCOT_PAL, 2);
      ctx.globalAlpha = state.mode === 'over' ? 0.4 : 1;
      var bob = state.mode === 'play' && fr ? -1 : 0;
      ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, W / 2 - 12, H - 72 + bob);
      ctx.globalAlpha = 1;
    }
    var pc = state.mode === 'pause' ? '#ffb000' : 'rgba(255,176,0,.12)', oc = state.mode === 'over' ? '#ffb000' : 'rgba(255,176,0,.12)';
    draw.text(ctx, tr('pause'), W / 2, H - 38, { size: 7, color: pc, align: 'center' });
    draw.text(ctx, tr('over'), W / 2, H - 22, { size: 7, color: oc, align: 'center' });
  }

  /* -------------------------------------------------------------- DOM stage */
  var CSS = [
    'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0b0e14;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;-webkit-tap-highlight-color:transparent}',
    '#rc-root{position:fixed;left:0;top:0;right:0;bottom:0;background:#0b0e14;overflow:hidden}',
    '#rc-lcd{position:absolute;left:0;top:0;right:0;bottom:0;background:#0b0e14;overflow:hidden}',
    '#rc-lcd.lcd-gb{filter:url(#rc-f-gb)}#rc-lcd.lcd-brick{filter:url(#rc-f-brick)}',
    '#rc-stage{position:absolute;left:0;top:0;width:' + STAGE_W + 'px;height:' + STAGE_H + 'px;transform-origin:0 0;background:#10131c;overflow:hidden}',
    '#rc-field-box{position:absolute;left:0;top:0;width:' + FIELD_AREA_W + 'px;height:' + STAGE_H + 'px;display:flex;align-items:center;justify-content:center}',
    '#rc-field-box.full{width:' + STAGE_W + 'px}',
    '#rc-field{display:block;background:#000;box-shadow:0 0 0 2px #2a3550;touch-action:none}',
    '#rc-field-box.full #rc-field{box-shadow:none}',
    '#rc-panel{position:absolute;left:' + FIELD_AREA_W + 'px;top:0;width:' + PANEL_W + 'px;height:' + STAGE_H + 'px}',
    '#rc-overlay{position:absolute;left:0;top:0;width:' + FIELD_AREA_W + 'px;height:' + STAGE_H + 'px;display:flex;align-items:center;justify-content:center;pointer-events:none}',
    '#rc-overlay.full{width:' + STAGE_W + 'px}',
    '.rc-card{box-sizing:border-box;max-width:92%;padding:10px 8px;text-align:center;background:rgba(6,9,18,.86);border:2px solid #e8f1ff;color:#fff;font:8px/1.7 RetroPx,monospace;border-radius:2px}',
    '.rc-card h1{margin:0 0 8px;font:10px/1.4 RetroPx,monospace;letter-spacing:0}',
    '.rc-card .big{font-size:9px;margin:4px 0}.rc-card .small{font-size:6px;line-height:1.9;color:#b9c6de}.rc-card .hi{color:#ffec27}',
    '.rc-blink{animation:rcb 1s steps(1) infinite}@keyframes rcb{50%{opacity:0}}',
    '[dir=rtl] .rc-card,.rc-card[dir=rtl]{font-family:sans-serif}',
    '#rc-toast{position:absolute;left:50%;top:6px;transform:translate(-50%,-80px);transition:transform .25s;background:#ffec27;color:#10131c;font:7px/1.5 RetroPx,monospace;padding:5px 8px;border:2px solid #fff;white-space:nowrap;z-index:5;max-width:94%;overflow:hidden;text-overflow:ellipsis}',
    '#rc-toast.on{transform:translate(-50%,0)}',
    '#rc-grid{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;display:none;mix-blend-mode:multiply;background-image:linear-gradient(rgba(0,0,0,.28) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.28) 1px,transparent 1px);background-size:3px 3px}',
    '#rc-root.grid #rc-grid{display:block}'
  ].join('\n');

  var FILTERS =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<filter id="rc-f-gb" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.45 0.6 0.3 0 0  0.45 0.6 0.3 0 0  0.45 0.6 0.3 0 0  0 0 0 1 0"/>' +
    '<feComponentTransfer><feFuncR type="discrete" tableValues="0.608 0.545 0.188 0.059"/><feFuncG type="discrete" tableValues="0.737 0.675 0.384 0.22"/><feFuncB type="discrete" tableValues="0.059 0.059 0.188 0.059"/></feComponentTransfer></filter>' +
    '<filter id="rc-f-brick" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.8 1.0 0.6 0 0  0.8 1.0 0.6 0 0  0.8 1.0 0.6 0 0  0 0 0 1 0"/>' +
    '<feComponentTransfer><feFuncR type="discrete" tableValues="0.659 0.659 0.11 0.11"/><feFuncG type="discrete" tableValues="0.702 0.702 0.13 0.13"/><feFuncB type="discrete" tableValues="0.576 0.576 0.1 0.1"/></feComponentTransfer></filter>' +
    '</defs></svg>';

  var state = {
    ready: false, mode: 'boot', layout: 'full', cfg: null, manifest: null,
    root: null, lcd: null, stage: null, fieldBox: null, field: { w: 160, h: 320, canvas: null, ctx: null, k: 1, fit: 1 },
    panel: null, panelCtx: null, panelK: 1, overlay: null, toastEl: null, stageScale: 1, hasSave: false,
    gameTime: 0, hiAtStart: 0, newHi: false, overAt: 0
  };

  var readyCbs = [];
  function onReady(fn) { if (state.ready) fn(); else readyCbs.push(fn); }

  function buildDom(layout) {
    if (state.root) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var ff = document.createElement('style');
    var fontUrl = scriptSrc ? scriptSrc.replace(/[^\/]*$/, '') + 'fonts/PressStart2P.ttf' : '/sdk/fonts/PressStart2P.ttf';
    ff.textContent = "@font-face{font-family:'RetroPx';src:url('" + fontUrl + "') format('truetype');font-display:block}";
    document.head.appendChild(ff);
    if (!document.querySelector('meta[name=viewport]')) {
      var mv = document.createElement('meta'); mv.name = 'viewport'; mv.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no'; document.head.appendChild(mv);
    }
    var root = document.createElement('div'); root.id = 'rc-root';
    root.innerHTML = FILTERS + '<div id="rc-lcd"><div id="rc-stage"><div id="rc-field-box"><canvas id="rc-field"></canvas></div><canvas id="rc-panel"></canvas>' +
      '<div id="rc-overlay"></div><div id="rc-toast"></div></div></div><div id="rc-grid"></div>';
    document.body.appendChild(root);
    state.root = root; state.lcd = root.querySelector('#rc-lcd'); state.stage = root.querySelector('#rc-stage');
    state.fieldBox = root.querySelector('#rc-field-box'); state.field.canvas = root.querySelector('#rc-field'); state.field.ctx = state.field.canvas.getContext('2d');
    state.panel = root.querySelector('#rc-panel'); state.overlay = root.querySelector('#rc-overlay'); state.toastEl = root.querySelector('#rc-toast');
    state.panelCtx = state.panel.getContext('2d');
    if (INIT.lang === 'ar') root.setAttribute('dir', 'rtl');
    setLayout(layout || 'full');
    applyLcd(); applyGrid();
    global.addEventListener('resize', layoutStage);
    global.addEventListener('orientationchange', layoutStage);
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    layoutStage();
  }

  function setLayout(layout) {
    state.layout = layout;
    var full = layout === 'full';
    state.fieldBox.className = full ? 'full' : '';
    state.overlay.className = full ? 'full' : '';
    state.panel.style.display = full ? 'none' : 'block';
  }

  function setFieldSize(w, h) {
    state.field.w = w; state.field.h = h; layoutStage();
  }

  function layoutStage() {
    if (!state.stage) return;
    var vw = global.innerWidth || STAGE_W, vh = global.innerHeight || STAGE_H;
    var s = Math.min(vw / STAGE_W, vh / STAGE_H); state.stageScale = s;
    state.stage.style.transform = 'translate(' + ((vw - STAGE_W * s) / 2) + 'px,' + ((vh - STAGE_H * s) / 2) + 'px) scale(' + s + ')';
    var dpr = global.devicePixelRatio || 1;
    var full = state.layout === 'full';
    var areaW = full ? STAGE_W : FIELD_AREA_W, areaH = STAGE_H;
    var pad = full ? 0 : 4, f = state.field;
    var fit = Math.min((areaW - pad * 2) / f.w, (areaH - pad * 2) / f.h);
    f.fit = fit;
    var k = Math.max(1, Math.round(fit * s * dpr));
    f.k = k;
    f.canvas.width = Math.round(f.w * k); f.canvas.height = Math.round(f.h * k);
    f.canvas.style.width = (f.w * fit) + 'px'; f.canvas.style.height = (f.h * fit) + 'px';
    var pk = Math.max(1, Math.round(s * dpr)); state.panelK = pk;
    state.panel.width = PANEL_W * pk; state.panel.height = STAGE_H * pk;
    state.panel.style.width = PANEL_W + 'px'; state.panel.style.height = STAGE_H + 'px';
    if (state.cfg && state.ready) { try { renderFrame(); } catch (e) {} }
  }

  function applyLcd() {
    if (!state.lcd) return;
    state.lcd.className = settings.lcd === 'gb' ? 'lcd-gb' : settings.lcd === 'brick' ? 'lcd-brick' : '';
    state.lcd.style.background = settings.lcd === 'color' ? '#0b0e14' : '#10131c';
  }
  function applyGrid() { if (state.root) state.root.classList.toggle('grid', !!settings.grid); }

  var toastTimer = null;
  function toast(text, ms) {
    if (!state.toastEl) return;
    state.toastEl.textContent = text; state.toastEl.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { state.toastEl.classList.remove('on'); }, ms || 2200);
  }

  /* ------------------------------------------------------------------ input */
  var BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b'];
  var held = { up: false, down: false, left: false, right: false, a: false, b: false, start: false };
  var edge = {}, relEdge = {}, repState = {}, pressQueue = [], buttonListeners = [], repeatTimers = {};
  var gameClock = 0;

  var input = {
    held: held,
    axisX: function () { return (held.right ? 1 : 0) - (held.left ? 1 : 0); },
    axisY: function () { return (held.down ? 1 : 0) - (held.up ? 1 : 0); },
    pressed: function (b) { return !!edge[b]; },
    released: function (b) { return !!relEdge[b]; },
    /** true on the press and then at the repeat rate while held. Call at most once per update() per button. */
    rep: function (b, delay, rate) {
      if (!held[b]) return false;
      var s = repState[b]; if (!s) return false;
      if (s.fresh) { s.fresh = false; s.next = gameClock + (delay == null ? 170 : delay); return true; }
      if (gameClock >= s.next) { s.next += (rate == null ? 60 : rate); if (s.next < gameClock) s.next = gameClock + (rate || 60); return true; }
      return false;
    },
    /** listen to raw presses (used by menus). fn(btn, 'down'|'repeat'|'up') */
    onButton: function (fn) { buttonListeners.push(fn); }
  };

  function emitButton(name, kind) { for (var i = 0; i < buttonListeners.length; i++) { try { buttonListeners[i](name, kind); } catch (e) { reportError(e); } } }

  function setButton(name, down) {
    resumeAudio();
    if (name === 'start') {
      down = !!down;
      // rawStart games (emulators) get START as an ordinary button while playing; S/P still starts/resumes from READY/PAUSED/OVER
      if (state.cfg && state.cfg.rawStart && state.mode === 'play') {
        if (held.start !== down) { held.start = down; if (down) { edge.start = true; pressQueue.push('start'); } else relEdge.start = true; }
      } else {
        if (held.start && !down) { held.start = false; relEdge.start = true; }
        if (down) startPressed();
      }
      emitButton('start', down ? 'down' : 'up');
      return;
    }
    if (!(name in held)) return;
    down = !!down;
    if (held[name] === down) return;
    held[name] = down;
    if (down) {
      edge[name] = true; repState[name] = { fresh: true, next: 0 }; pressQueue.push(name);
      emitButton(name, 'down');
      var dir = name === 'up' || name === 'down' || name === 'left' || name === 'right';
      if (dir && buttonListeners.length) {
        clearTimeout(repeatTimers[name]);
        repeatTimers[name] = setTimeout(function again() {
          if (!held[name]) return; emitButton(name, 'repeat'); repeatTimers[name] = setTimeout(again, 85);
        }, 300);
      }
      if (state.cfg && state.mode === 'ready' && name === 'a') startPressed(true);
      else if (state.cfg && state.mode === 'over' && name === 'a') startPressed(true);
    } else {
      relEdge[name] = true; clearTimeout(repeatTimers[name]); emitButton(name, 'up');
    }
  }
  function releaseAll() { BUTTONS.forEach(function (b) { if (held[b]) setButton(b, false); }); if (held.start) setButton('start', false); }

  var KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'a', Space: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b', Enter: 'start', KeyP: 'start' };
  function bindKeyboard() {
    global.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var b = KEYMAP[e.code];
      if (b) { e.preventDefault(); if (!e.repeat) setButton(b, true); }
      else if (e.code === 'KeyR' && !e.repeat) { e.preventDefault(); native_cmd('reset'); }
      else if (e.code === 'KeyM' && !e.repeat) { e.preventDefault(); native_cmd('sound', !settings.sound); }
    });
    global.addEventListener('keyup', function (e) { var b = KEYMAP[e.code]; if (b && b !== 'start') { e.preventDefault(); setButton(b, false); } });
    global.addEventListener('blur', releaseAll);
  }

  /* ------------------------------------------------------------ game states */
  function reportError(e) {
    try { console.error(e); } catch (x) {}
    post({ type: 'error', message: String(e && e.message || e).slice(0, 300) });
  }
  function setMode(m) {
    state.mode = m;
    if (m === 'play') { if (state.cfg && state.cfg.music) musicApi.play(state.cfg.music); else musicApi.resume(); }
    else { musicApi.pause(); }
    showOverlay();
    post({ type: 'state', mode: m });
  }

  function startPressed(fromA) {
    var cfg = state.cfg; if (!cfg) return;
    var m = state.mode;
    if (m === 'ready') {
      if (state.hasSave && !fromA) { continueGame(); return; }
      newGame();
    } else if (m === 'play') { sfx.play('pause'); setMode('pause'); saveNow(); }
    else if (m === 'pause') { sfx.play('select'); setMode('play'); }
    else if (m === 'over') { if (Date.now() - state.overAt > 500) newGame(); }
  }

  function newGame() {
    var cfg = state.cfg;
    fx.clear(); hudReset(); state.newHi = false; state.hiAtStart = hud.hi; state.gameTime = 0;
    try { cfg.reset(); } catch (e) { reportError(e); }
    state.hasSave = false; clearSave();
    edge = {}; pressQueue.length = 0; musicApi.stop();
    sfx.play('start');
    setMode('play');
    post({ type: 'played', gameId: INIT.gameId });
  }

  function continueGame() {
    var cfg = state.cfg, ok = false;
    try {
      var s = JSON.parse(INIT.save);
      fx.clear(); hudReset();
      cfg.reset();
      if (s && cfg.restore) { cfg.restore(s.game); hud.score = num(s.score); hud.level = s.level || 1; hud.lives = s.lives == null ? null : s.lives; hud.extra = s.extra == null ? null : s.extra; ok = true; }
    } catch (e) { reportError(e); }
    state.hasSave = false;
    if (!ok) { newGame(); return; }
    state.hiAtStart = hud.hi; state.newHi = false;
    edge = {}; pressQueue.length = 0; musicApi.stop();
    sfx.play('select');
    setMode('pause');
    post({ type: 'played', gameId: INIT.gameId });
  }

  function saveNow() {
    var cfg = state.cfg;
    if (!cfg || !cfg.serialize || (state.mode !== 'play' && state.mode !== 'pause')) return;
    try {
      var data = JSON.stringify({ game: cfg.serialize(), score: hud.score, level: hud.level, lives: hud.lives, extra: hud.extra });
      if (data.length > 200000) return;
      INIT.save = data; post({ type: 'save', data: data }); lsSet(INIT.key('save'), native ? null : data);
    } catch (e) { reportError(e); }
  }
  function clearSave() { INIT.save = null; post({ type: 'save', data: null }); lsSet(INIT.key('save'), null); }

  function gameOver(opts) {
    if (state.mode === 'over') return;
    opts = opts || {};
    var cfg = state.cfg;
    if (hud.score > hud.hi) { hud.hi = hud.score; state.newHi = true; lsSet(INIT.key('hi'), String(hud.hi)); post({ type: 'hiscore', value: hud.hi }); }
    post({ type: 'gameover', score: hud.score });
    clearSave(); state.overAt = Date.now();
    if (!opts.silent && !(cfg && cfg.silentGameOver)) sfx.play(opts.win ? 'win' : 'lose');
    vibrate(opts.win ? 40 : 120);
    state.won = !!opts.win;
    setMode('over');
    if (cfg && cfg.onGameOver) { try { cfg.onGameOver(); } catch (e) { reportError(e); } }
  }

  /* --------------------------------------------------------------- overlays */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function showOverlay() {
    var ov = state.overlay, m = state.mode, cfg = state.cfg, mf = state.manifest || {};
    if (!ov) return;
    if (m === 'play' || m === 'boot') { ov.innerHTML = ''; return; }
    var accent = mf.color || COLORS.yellow, h = '';
    var name = esc((mf.name || (cfg && cfg.title) || document.title || 'GAME').toUpperCase());
    if (m === 'ready') {
      h = '<div class="rc-card"><h1 style="color:' + accent + '">' + name + '</h1>';
      h += '<div class="big rc-blink">' + esc(state.hasSave ? tr('cont') : tr('start')) + '</div>';
      if (state.hasSave) h += '<div class="small">' + esc(tr('newGame')) + '</div>';
      if (hud.hi > 0) h += '<div class="small hi">' + esc(tr('hi')) + ' ' + pad(hud.hi, 6) + '</div>';
      var c = mf.controls || (cfg && cfg.controls);
      if (c) {
        h += '<div class="small" style="margin-top:6px">' + esc(tr('how')) + '</div><div class="small">';
        if (c.dpad) h += esc(tr('dpad')) + ': ' + esc(c.dpad) + '<br>';
        if (c.a) h += 'A: ' + esc(c.a) + '<br>';
        if (c.b) h += 'B: ' + esc(c.b) + '<br>';
        if (c.start) h += 'S/P: ' + esc(c.start) + '<br>';
        h += '</div>';
      }
      h += '</div>';
    } else if (m === 'pause') {
      h = '<div class="rc-card"><h1>' + esc(tr('paused')) + '</h1><div class="small rc-blink">' + esc(tr('resume')) + '</div></div>';
    } else if (m === 'over') {
      h = '<div class="rc-card"><h1 style="color:' + (state.won ? COLORS.lime : COLORS.red) + '">' + esc(state.won ? (tr('yourScore')) : tr('over')) + '</h1>' +
        '<div class="big">' + esc(tr('score')) + ' ' + pad(hud.score, 6) + '</div>' +
        (state.newHi ? '<div class="small hi rc-blink">' + esc(tr('newHi')) + '</div>' : '') +
        '<div class="small rc-blink" style="margin-top:6px">' + esc(tr('retry')) + '</div></div>';
    }
    ov.innerHTML = h;
  }

  /* ------------------------------------------------------------ achievements */
  function achieve(id) {
    if (INIT.unlocked.indexOf(id) >= 0) return false;
    INIT.unlocked.push(id); lsSet(INIT.key('ach'), JSON.stringify(INIT.unlocked));
    post({ type: 'achievement', id: id });
    var name = id, mf = state.manifest;
    if (mf && mf.achievements) mf.achievements.forEach(function (a) { if (a.id === id) name = a.name; });
    sfx.play('trophy'); toast('★ ' + tr('trophy') + ': ' + String(name).toUpperCase(), 2600); vibrate(30);
    return true;
  }

  /* -------------------------------------------------------------- game loop */
  var raf = 0, last = 0, acc = 0, frozen = false;

  function step() {
    var cfg = state.cfg;
    if (state.mode === 'play') {
      gameClock += STEP_MS; state.gameTime += STEP_MS / 1000;
      mascot.t += STEP_MS / 1000;
      var rate = Math.max(0.1, 0.34 - hud.level * 0.015);
      if (mascot.t > rate) { mascot.t = 0; mascot.frame ^= 1; }
      if (cfg.onPress) { for (var i = 0; i < pressQueue.length; i++) { try { cfg.onPress(pressQueue[i]); } catch (e) { reportError(e); } } }
      try { cfg.update(STEP_MS / 1000); } catch (e) { reportError(e); }
      fx.update(STEP_MS / 1000);
    }
    pressQueue.length = 0; edge = {}; relEdge = {};
  }

  function renderFrame() {
    var cfg = state.cfg, f = state.field, ctx = f.ctx;
    if (!cfg || !ctx) return;
    ctx.setTransform(f.k, 0, 0, f.k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = cfg.bg || '#000'; ctx.fillRect(0, 0, f.w, f.h);
    ctx.save();
    if (fx.shakeT > 0) ctx.translate(Math.round((Math.random() - 0.5) * fx.shakeMag * 2), Math.round((Math.random() - 0.5) * fx.shakeMag * 2));
    try { cfg.render(ctx, f.w, f.h); } catch (e) { reportError(e); }
    fx.draw(ctx);
    ctx.restore();
    if (state.layout === 'classic') drawPanel();
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (frozen) return;
    var dt = Math.min(100, ts - (last || ts)); last = ts; acc += dt;
    var n = 0;
    while (acc >= STEP_MS && n < 5) { step(); acc -= STEP_MS; n++; }
    if (n === 5) acc = 0;
    renderFrame();
  }

  /* ------------------------------------------------------- native commands  */
  function native_cmd(name, arg) {
    switch (name) {
      case 'start': startPressed(); break;
      case 'reset': if (state.cfg) { musicApi.stop(); fx.clear(); hudReset(); try { state.cfg.reset(); } catch (e) { reportError(e); } state.hasSave = !!INIT.save && !!state.cfg.restore; setMode('ready'); } post({ type: 'reset' }); break;
      case 'pause': if (state.mode === 'play') { setMode('pause'); saveNow(); } releaseAll(); break;
      case 'resume': break;
      case 'save': saveNow(); break;
      case 'sound': settings.sound = !!arg; applyVolume(); if (!settings.sound) musicApi.pause(); else if (state.mode === 'play') musicApi.resume();
        post({ type: 'sound', value: settings.sound }); toast(tr(settings.sound ? 'soundOn' : 'soundOff'), 1200); if (settings.sound) sfx.play('blip'); break;
      case 'volume': settings.volume = clamp(num(arg), 0, 1); applyVolume(); break;
      case 'lcd': settings.lcd = String(arg); applyLcd(); break;
      case 'grid': settings.grid = !!arg; applyGrid(); break;
      case 'vibrate': settings.vibrate = !!arg; break;
      case 'toast': toast(String(arg)); break;
      default: break;
    }
  }
  var nativeApi = {
    button: function (name, down) { setButton(name, !!down); },
    cmd: native_cmd
  };

  /* ------------------------------------------------------------ pointer API */
  function bindPointer() {
    var c = state.field.canvas;
    function ev(type, e) {
      var cfg = state.cfg; if (!cfg || !cfg.onPointer || state.mode !== 'play') return;
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * state.field.w, y = (e.clientY - r.top) / r.height * state.field.h;
      try { cfg.onPointer({ type: type, x: x, y: y }); } catch (er) { reportError(er); }
    }
    c.addEventListener('pointerdown', function (e) { resumeAudio(); ev('down', e); });
    c.addEventListener('pointermove', function (e) { ev('move', e); });
    c.addEventListener('pointerup', function (e) { ev('up', e); });
  }

  /* ------------------------------------------------------------- public API */
  var Retro = {
    version: SDK_VERSION, STAGE_W: STAGE_W, STAGE_H: STAGE_H,
    colors: COLORS, pal: PAL, util: util, draw: draw, sprite: makeSprite, fx: fx,
    sfx: sfx, music: musicApi, audio: { context: function () { return ensureAudio(); }, output: function () { ensureAudio(); return sfxBus; } }, input: input, hud: hud, i18n: tr, init: INIT, settings: settings,
    vibrate: vibrate, toast: toast, achieve: achieve, post: post, onReady: onReady, reportError: reportError,
    store: {
      get: function (k, d) { var v = lsGet(INIT.key('kv:' + k)); if (v == null) return d; try { return JSON.parse(v); } catch (e) { return d; } },
      set: function (k, v) { lsSet(INIT.key('kv:' + k), JSON.stringify(v)); }
    },
    get score() { return hud.score; }, set score(v) { hud.score = Math.max(0, Math.floor(num(v))); },
    addScore: function (n) { hud.score = Math.max(0, hud.score + Math.floor(num(n))); return hud.score; },
    get level() { return hud.level; }, set level(v) { hud.level = Math.max(0, Math.floor(num(v))); },
    get lives() { return hud.lives; }, set lives(v) { hud.lives = v == null ? null : Math.max(0, Math.floor(num(v))); },
    get W() { return state.field.w; }, get H() { return state.field.h; }, get ctx() { return state.field.ctx; },
    get mode() { return state.mode; }, get time() { return state.gameTime; }, get manifest() { return state.manifest; },
    gameOver: gameOver,
    saveNow: saveNow,
    textWidth: function (s, size) { return String(s).length * (size || 8); },
    _n: nativeApi,
    _native: nativeApi,
    /** Low level: build the LCD stage without a game (used by the console home screen). */
    shell: function () {
      buildDom('full');
      state.fieldBox.style.display = 'none'; state.overlay.style.display = 'none'; state.panel.style.display = 'none';
      state.mode = 'shell'; state.ready = true;
      bindKeyboard(); layoutStage();
      return state.stage;
    },
    game: function (cfg) {
      state.cfg = cfg;
      var begin = function () {
        var mf = state.manifest || {};
        var layout = cfg.layout || mf.layout || 'classic';
        var size = cfg.size || mf.size || (layout === 'full' ? [136, 164] : [160, 320]);
        buildDom(layout); setLayout(layout); setFieldSize(size[0], size[1]);
        hud.hi = INIT.hi; hud.levelLabel = cfg.levelLabel || null;
        bindKeyboard(); bindPointer();
        var fontP = (document.fonts && document.fonts.load) ? Promise.race([document.fonts.load('8px RetroPx'), new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
        fontP.then(function () {
          try { if (cfg.init) cfg.init(); cfg.reset(); } catch (e) { reportError(e); }
          state.hasSave = !!INIT.save && !!cfg.restore;
          state.ready = true; setMode('ready');
          readyCbs.splice(0).forEach(function (f) { try { f(); } catch (e) { reportError(e); } });
          document.addEventListener('visibilitychange', function () { if (document.hidden) { native_cmd('pause'); } });
          layoutStage();
          if (!qs.get('test')) raf = requestAnimationFrame(frame); else frozen = true;
          post({ type: 'ready', gameId: INIT.gameId });
          if (qs.get('autoplay')) setTimeout(function () { startPressed(true); }, 50);
        });
      };
      var go = function () {
        fetch('manifest.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (m) { state.manifest = m; begin(); });
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
      return Retro;
    }
  };

  /** Deterministic hooks for automated tests (also handy in the browser console). */
  Retro.test = {
    freeze: function () { frozen = true; },
    unfreeze: function () { frozen = false; },
    step: function (n) { for (var i = 0; i < (n || 1); i++) step(); renderFrame(); },
    press: function (b) { setButton(b, true); },
    release: function (b) { setButton(b, false); },
    tap: function (b, frames) { setButton(b, true); Retro.test.step(frames || 2); setButton(b, false); Retro.test.step(1); },
    start: function () { if (state.mode === 'ready' || state.mode === 'over') startPressed(true); },
    state: function () { return { mode: state.mode, score: hud.score, hi: hud.hi, level: hud.level, lives: hud.lives, time: state.gameTime }; },
    fieldPixels: function () {
      var f = state.field; var d = f.ctx.getImageData(0, 0, f.canvas.width, f.canvas.height).data, seen = {}, n = 0;
      for (var i = 0; i < d.length; i += 16) { var key = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; if (!seen[key]) { seen[key] = 1; n++; if (n > 64) break; } }
      return n;
    }
  };

  /* ------------------------------------------------- shell (home) core hooks */
  Retro._core = { buildDom: buildDom, setLayout: setLayout, layoutStage: layoutStage, bindKeyboard: bindKeyboard, state: state, applyLcd: applyLcd, applyGrid: applyGrid,
    ensureAudio: ensureAudio, setButton: setButton, native_cmd: native_cmd, STAGE_W: STAGE_W, STAGE_H: STAGE_H, makeSprite: makeSprite, setMode: setMode };

  global.Retro = Retro;
})(window);
