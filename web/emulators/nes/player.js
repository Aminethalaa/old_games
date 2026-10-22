/* NES player for the Retro Console: runs a game file the user imported (rom.bin next to this page) with the bundled
 * jsnes core (Apache-2.0, see LICENSE.jsnes.txt). Console keys -> NES pad: D-pad, A, B, S/P = Start, A+B together = Select. */
(function () {
  var R = Retro, W = 256, H = 240, C = jsnes.Controller;
  var nes = null, status = 'LOADING GAME…', img, buf32, off, octx, ring, stopAudio = null, sent = {};

  function press(code, on) {
    if (!nes || sent[code] === on) return;
    sent[code] = on;
    if (on) nes.buttonDown(1, code); else nes.buttonUp(1, code);
  }

  function boot(bytes) {
    var actx = R.audio.context();
    ring = new EmuAudio.Ring(16384);
    nes = new jsnes.NES({
      onFrame: function (fb) { for (var i = 0; i < fb.length; i++) buf32[i] = 0xFF000000 | fb[i]; octx.putImageData(img, 0, 0); },
      onAudioSample: function (l, r) { ring.push(l, r); },
      onStatusUpdate: function () {},
      sampleRate: actx ? actx.sampleRate : 44100
    });
    nes.loadROM(bytes);
    status = '';
    stopAudio = EmuAudio.attach(ring);
  }

  function fail(e) { R.reportError(e); status = 'CANNOT RUN THIS GAME FILE'; nes = null; }

  R.game({
    layout: 'full', size: [W, H], bg: '#000', rawStart: true, silentGameOver: true,

    init: function () {
      off = document.createElement('canvas'); off.width = W; off.height = H;
      octx = off.getContext('2d'); img = octx.createImageData(W, H); buf32 = new Uint32Array(img.data.buffer);
      fetch('rom.bin').then(function (r) { if (!r.ok) throw new Error('rom.bin ' + r.status); return r.arrayBuffer(); })
        .then(function (b) { boot(new Uint8Array(b)); }).catch(fail);
    },

    // power-cycle: reloadROM() maps the game into memory again (nes.reset() alone would leave the console without a game)
    reset: function () { sent = {}; if (nes) { try { nes.reloadROM(); } catch (e) { fail(e); } } if (ring) ring.clear(); },

    update: function () {
      if (!nes) return;
      var h = R.input.held, sel = h.a && h.b;            // A and B together = SELECT
      press(C.BUTTON_UP, h.up); press(C.BUTTON_DOWN, h.down); press(C.BUTTON_LEFT, h.left); press(C.BUTTON_RIGHT, h.right);
      press(C.BUTTON_A, h.a && !sel); press(C.BUTTON_B, h.b && !sel); press(C.BUTTON_SELECT, sel); press(C.BUTTON_START, h.start);
      try { nes.frame(); } catch (e) { fail(e); }
    },

    render: function (ctx, w, h) {
      if (nes) ctx.drawImage(off, 0, 0);
      else R.draw.text(ctx, status, w / 2, h / 2 - 4, { size: 8, color: R.colors.yellow, align: 'center' });
    }
  });
})();
