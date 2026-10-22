/* Template game: collect coins, dodge hazards. Copy this folder, rename it, hack away. */
(function () {
  var R = Retro, C = R.colors, U = R.util;
  var player, coins, hazards, spawnT, collected;
  var COIN = ['..YY..', '.YOOY.', 'YOYYOY', 'YOYYOY', '.YOOY.', '..YY..'];
  var PAL = { Y: C.yellow, O: C.orange };

  R.game({
    layout: 'full', size: [136, 164], bg: '#10244a', music: 'adventure',

    reset: function () {
      player = { x: 64, y: 140, w: 8, h: 8, dash: 0 };
      coins = []; hazards = []; spawnT = 0; collected = 0;
      R.lives = 3;
    },

    update: function (dt) {
      var sp = player.dash > 0 ? 130 : 70;
      player.x = U.clamp(player.x + R.input.axisX() * sp * dt, 0, R.W - player.w);
      player.y = U.clamp(player.y + R.input.axisY() * sp * dt, 14, R.H - player.h);
      if (R.input.pressed('a') && player.dash <= 0) { player.dash = 0.15; R.sfx.play('jump'); }
      player.dash -= dt;

      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(0.25, 0.8 - R.score / 600);
        if (Math.random() < 0.5) coins.push({ x: U.rand(4, R.W - 10), y: 14, w: 6, h: 6 });
        else hazards.push({ x: U.rand(0, R.W - 10), y: 14, w: 10, h: 10, vy: U.rand(40, 70) + R.score / 20 });
      }
      coins.forEach(function (c) { c.y += 45 * dt; });
      hazards.forEach(function (h) { h.y += h.vy * dt; });
      coins = coins.filter(function (c) {
        if (U.overlap(c, player)) { R.addScore(10); collected++; R.sfx.play('coin'); R.fx.burst(c.x + 3, c.y + 3, { color: C.yellow, n: 8 }); if (collected >= 10) R.achieve('coins10'); return false; }
        return c.y < R.H;
      });
      hazards = hazards.filter(function (h) {
        if (U.overlap(h, player)) {
          R.lives--; R.sfx.play('hit'); R.vibrate(60); R.fx.shake(3, 0.2); R.fx.burst(player.x + 4, player.y + 4, { color: C.red, n: 14 });
          if (R.lives <= 0) R.gameOver();
          return false;
        }
        return h.y < R.H;
      });
    },

    render: function (ctx, W, H) {
      coins.forEach(function (c) { R.draw.sprite(ctx, COIN, c.x, c.y, { palette: PAL }); });
      hazards.forEach(function (h) { R.draw.block(ctx, h.x, h.y, h.w, C.red); });
      R.draw.block(ctx, player.x, player.y, player.w, player.dash > 0 ? C.white : C.blue);
      R.draw.topBar(ctx);
    }
  });
})();
