/* Game Boy / Game Boy Color player for the Retro Console: runs a game file the user imported (rom.bin next to this page)
 * with the bundled binjgb core (MIT, see LICENSE.binjgb.txt).
 * Console keys -> pad: D-pad, A, B, S/P = Start, A+B together = Select. */
(function () {
  var R = Retro, W = 160, H = 144;
  var AUDIO_FRAMES = 4096, TICKS_PER_FRAME = 70224, EV_NEW_FRAME = 1, EV_AUDIO_FULL = 2, EV_UNTIL = 4;
  var mod = null, e = 0, joyp = 0, romBuf = null, romPtr = 0, status = 'LOADING GAME…';
  var frameView, audioView, img, off, octx, ring, dcX = [0, 0], dcY = [0, 0];

  function pushAudio() {
    for (var i = 0; i < AUDIO_FRAMES; i++) {
      var s0 = audioView[2 * i] / 255, s1 = audioView[2 * i + 1] / 255;
      // the core outputs 0..1 (never negative): remove the DC offset so silence is silent and there are no pops
      var y0 = s0 - dcX[0] + 0.995 * dcY[0], y1 = s1 - dcX[1] + 0.995 * dcY[1];
      dcX[0] = s0; dcX[1] = s1; dcY[0] = y0; dcY[1] = y1;
      ring.push(y0, y1);
    }
  }

  /** (Re)starts the game from power-on using the bytes in romBuf. */
  function powerOn() {
    if (e) { mod._emulator_delete(e); e = 0; }
    if (joyp) { mod._joypad_delete(joyp); joyp = 0; }
    if (romPtr) { mod._free(romPtr); romPtr = 0; }
    var actx = R.audio.context();
    var size = (romBuf.byteLength + 0x7fff) & ~0x7fff;
    romPtr = mod._malloc(size);
    var rom = new Uint8Array(mod.HEAP8.buffer, romPtr, size); rom.fill(0); rom.set(new Uint8Array(romBuf));
    e = mod._emulator_new_simple(romPtr, size, actx ? actx.sampleRate : 44100, AUDIO_FRAMES, 2);
    if (!e) throw new Error('not a Game Boy game file');
    joyp = mod._joypad_new();                                   // the pad the _set_joyp_* calls write into
    mod._emulator_set_default_joypad_callback(e, joyp);
    frameView = new Uint8Array(mod.HEAP8.buffer, mod._get_frame_buffer_ptr(e), mod._get_frame_buffer_size(e));
    audioView = new Uint8Array(mod.HEAP8.buffer, mod._get_audio_buffer_ptr(e), mod._get_audio_buffer_capacity(e));
    dcX = [0, 0]; dcY = [0, 0];
    if (ring) ring.clear();
    status = '';
  }

  function fail(err) { R.reportError(err); status = 'CANNOT RUN THIS GAME FILE'; e = 0; }

  R.game({
    layout: 'full', size: [W, H], bg: '#000', rawStart: true, silentGameOver: true,

    init: function () {
      off = document.createElement('canvas'); off.width = W; off.height = H;
      octx = off.getContext('2d'); img = octx.createImageData(W, H);
      var romP = fetch('rom.bin').then(function (r) { if (!r.ok) throw new Error('rom.bin ' + r.status); return r.arrayBuffer(); });
      var modP = Binjgb({ locateFile: function (f) { return '/emu/gb/' + f; } });
      Promise.all([modP, romP]).then(function (v) {
        mod = v[0]; romBuf = v[1];
        ring = new EmuAudio.Ring(32768);
        EmuAudio.attach(ring);
        powerOn();
      }).catch(fail);
    },

    reset: function () { if (mod && romBuf) { try { powerOn(); } catch (x) { fail(x); } } },

    update: function () {
      if (!mod || !e) return;
      var h = R.input.held, sel = h.a && h.b;           // A and B together = SELECT
      mod._set_joyp_up(e, h.up); mod._set_joyp_down(e, h.down); mod._set_joyp_left(e, h.left); mod._set_joyp_right(e, h.right);
      mod._set_joyp_A(e, h.a && !sel); mod._set_joyp_B(e, h.b && !sel); mod._set_joyp_select(e, sel); mod._set_joyp_start(e, h.start);
      try {
        var target = mod._emulator_get_ticks_f64(e) + TICKS_PER_FRAME;
        for (var guard = 0; guard < 8; guard++) {
          var ev = mod._emulator_run_until_f64(e, target);
          if (ev & EV_NEW_FRAME) { img.data.set(frameView); octx.putImageData(img, 0, 0); }
          if (ev & EV_AUDIO_FULL) pushAudio();
          if (ev & EV_UNTIL) break;
        }
      } catch (err) { fail(err); }
    },

    render: function (ctx, w, h) {
      if (mod && e) ctx.drawImage(off, 0, 0);
      else R.draw.text(ctx, status, w / 2, h / 2 - 4, { size: 8, color: R.colors.yellow, align: 'center' });
    }
  });
})();
