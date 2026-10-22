/* Shared by the emulator players: a small stereo ring buffer feeding a ScriptProcessor that plays through the
 * console's audio output (so the SOUND key and volume setting apply). */
(function (global) {
  'use strict';

  function Ring(capacity) {
    this.cap = capacity; this.l = new Float32Array(capacity); this.r = new Float32Array(capacity); this.w = 0; this.rd = 0;
  }
  Ring.prototype.push = function (l, r) {
    var i = this.w % this.cap; this.l[i] = l; this.r[i] = r; this.w++;
    if (this.w - this.rd > this.cap) this.rd = this.w - this.cap;   // overflow: drop the oldest samples
  };
  Ring.prototype.available = function () { return this.w - this.rd; };
  Ring.prototype.clear = function () { this.rd = this.w; };

  /** Starts playing [ring]; returns a function that stops it. Keeps latency low (~3 audio blocks). */
  function attach(ring) {
    var ctx = Retro.audio.context(), out = Retro.audio.output();
    if (!ctx || !out || !ctx.createScriptProcessor) return function () {};
    var node = ctx.createScriptProcessor(2048, 0, 2);
    node.onaudioprocess = function (e) {
      var L = e.outputBuffer.getChannelData(0), R = e.outputBuffer.getChannelData(1), n = L.length;
      if (ring.available() > 3 * n) ring.rd = ring.w - 2 * n;        // we fell behind: skip ahead instead of lagging
      var have = Math.min(n, ring.available()), i, idx;
      for (i = 0; i < have; i++) { idx = (ring.rd + i) % ring.cap; L[i] = ring.l[idx]; R[i] = ring.r[idx]; }
      ring.rd += have;
      for (; i < n; i++) { L[i] = 0; R[i] = 0; }                        // underrun: silence
    };
    node.connect(out);
    return function () { try { node.disconnect(); } catch (e) {} node.onaudioprocess = null; };
  }

  global.EmuAudio = { Ring: Ring, attach: attach };
})(window);
