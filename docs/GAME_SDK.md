# Retro Console — Game SDK (v1)

Games for the console are small **HTML5 / JavaScript** packages. They run inside the console's LCD
(an Android WebView in the app, any browser in development). One script, `/sdk/retro-sdk.js`, gives you the
LCD stage, the D‑pad/A/B/START input, a fixed‑step loop, the classic 7‑segment side panel, chiptune
audio, pixel‑sprite helpers, particles, save & resume, hi‑scores, achievements and haptics.

```
web/games/builtin/<id>/     games bundled inside the APK        (Classic pack)
web/games/store/<id>/       games offered in the Game Store     (Arcade / Puzzle / Action packs)
web/games/_template/        copy this to start a new game
```

A game folder contains `manifest.json`, `index.html`, `game.js` (+ optional images/sounds, all local; **no network,
no CDN, no external fonts**: the app blocks every request that is not local).

## Run & test

```bash
node tools/dev-server.cjs                    # http://localhost:8080  → pick a game, play with the keyboard
export NODE_PATH=$(npm root -g)              # so tools/test can find playwright
node tools/test/smoke.cjs <game-id>          # headless: plays 2400 frames of random input, checks errors & blank screens
SHOTS=1 node tools/test/smoke.cjs <game-id>  # also writes tools/test/out/<id>-*.png  (look at them!)
```

Keys in the browser: arrows/WASD = D‑pad · **Z / Space = A** · **X = B** · **Enter / P = START** · R = reset · M = sound.
URL flags: `?lcd=gb|brick` (LCD look) · `?grid=1` · `?lang=fr|ar` · `?sound=0` · `?autoplay=1` · `?test=1` (manual stepping).

## index.html

```html
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>My Game</title></head><body>
<script src="/sdk/retro-sdk.js"></script>
<script src="game.js"></script>
</body></html>
```

## manifest.json

```jsonc
{
  "id": "block-stack",              // == folder name, ^[a-z0-9][a-z0-9-]{1,40}$
  "name": "Block Stack",            // ≤ 22 chars, original name (no trademarks!)
  "short": "BLOCKS",                // ≤ 11 chars, shown under the icon on the console menu
  "version": "1.0.0",               // x.y.z — bump it to make the Store offer an update
  "sdk": 1,
  "author": "Retro Console",
  "category": "classic",            // classic | arcade | puzzle | action
  "layout": "classic",              // classic = playfield + 7-segment side panel · full = whole LCD, you draw the HUD
  "size": [160, 320],               // logical playfield size in px (see below)
  "color": "#3de2ff",               // accent colour (title, tile)
  "description": "One or two sentences.",
  "controls": { "dpad": "Move", "a": "Rotate", "b": "Drop" },   // shown on the READY screen
  "tags": ["blocks", "puzzle"],
  "achievements": [ { "id": "first-line", "name": "First Line", "desc": "Clear your first line" } ],
  "icon": { "palette": { "P": "#b455ff", "C": "#3de2ff" },
            "rows": [ "............", "....PPP.....", "..." ] }   // square pixel icon, 8–16 rows (12 recommended); '.' = transparent
}
```

Icon tip: design a 6×6 picture and double every character horizontally and vertically → 12×12.
All characters used in `rows` must exist in `palette`. Use bright PICO‑8‑style colours.

## The LCD

* The LCD is **272×328** logical px (≈17:20). The SDK scales it to whatever the screen is.
* `layout: "classic"` → playfield on the left (recommended size **[160, 320]** = 10×20 cells of 16 px) and the
  **side panel** on the right: SCORE, HI‑SCORE, optional NEXT box, LEVEL, optional LIVES / one extra counter,
  and an animated mascot. The SDK draws the panel; you only set `Retro.score`, `Retro.level`, `Retro.lives`,
  `Retro.hud.extra/extraLabel`, and optionally provide `renderNext`.
* `layout: "full"` → your canvas fills the whole LCD (recommended size **[136, 164]**, i.e. chunky ×2 pixels, or
  [272, 328] for fine pixels). Draw your own HUD, e.g. `Retro.draw.topBar(ctx)` (SC / lives / HI).
* Any `size` works; the SDK letter‑boxes. Always draw using the `W`/`H` you receive.
* In "Game Boy" and "Brick" LCD modes the whole screen is re‑coloured by a filter, so keep **good contrast between
  background and sprites** (dark background + bright sprites is the convention).

## Game skeleton

```js
Retro.game({
  layout: 'full', size: [136, 164], bg: '#10244a', music: 'adventure',   // music: puzzle|action|adventure|space|chill|retro
  init()   { /* once: build sprites, constants */ },
  reset()  { /* start a NEW game: set all state. Also set Retro.level / Retro.lives / hud extras */ },
  update(dt) { /* dt = 1/60 s, called ONLY while playing (not paused / game over) */ },
  render(ctx, W, H) { /* called every frame; paint everything (background is cleared with `bg`) */ },
  renderNext(ctx, w, h) { /* classic layout only, optional: draw into the 48×48 NEXT box */ },
  onPress(btn) { /* optional: edge events 'up','down','left','right','a','b' — delivered at the start of update */ },
  onPointer(e) { /* optional touch: e = {type:'down'|'move'|'up', x, y} in field coordinates */ },
  serialize() { return { /* JSON-able */ }; },  restore(s) { /* inverse of serialize */ },  // optional save & resume
  onGameOver() {}, silentGameOver: false,
  rawStart: false   // true = S/P is delivered to the game as a normal button (Retro.input.held.start / onPress('start')) while playing
});
```

* **Never** use `setTimeout`, `setInterval`, `requestAnimationFrame` or `Date.now()` for game logic — use `dt`
  (the tests are deterministic and step the game manually). Animations may use accumulated `dt`.
* The state machine is handled for you: READY (title card + "PRESS START") → PLAYING → PAUSED (START) → GAME OVER.
  Call `Retro.gameOver()` when the player loses (`{win:true}` for a victory message, `{silent:true}` to skip the sound).
  Hi‑score handling, “new hi‑score” banner, saving and restart are automatic.
* `reset()` is also called once at load so the READY screen shows a fresh scene.

## API reference

| Area | API |
|---|---|
| Score & HUD | `Retro.score` (get/set) · `Retro.addScore(n)` · `Retro.level` · `Retro.lives` (`null` hides) · `Retro.hud.hi` (read) · `Retro.hud.extra` + `Retro.hud.extraLabel` (classic panel counter) · `Retro.hud.levelLabel` |
| Size / ctx | `Retro.W`, `Retro.H`, `Retro.ctx`, `Retro.time` (seconds of play), `Retro.mode` (`ready/play/pause/over`) |
| Input | `Retro.input.held.left/right/up/down/a/b` · `axisX()` / `axisY()` (−1/0/1) · `pressed(btn)` (edge, this update) · `released(btn)` · `rep(btn, delay=170, rate=60)` (press + auto‑repeat; **call once per update per button**) |
| Drawing | `Retro.draw.rect(ctx,x,y,w,h,col)` · `frame(ctx,x,y,w,h,col,thick)` · `circle(ctx,x,y,r,col)` · `line(ctx,x1,y1,x2,y2,col,w)` · `block(ctx,x,y,size,col)` (beveled toy brick) · `cell(ctx,x,y,size,col)` (hollow LCD pixel) · `text(ctx,str,x,y,{size:8,color,align:'left|center|right',shadow})` (pixel font, width = chars × size; use sizes 6, 8, 16) · `sprite(ctx, spriteOrRows, x, y, {palette,scale,flipX,alpha})` · `topBar(ctx)` |
| Sprites | `Retro.sprite(rows, palette, scale)` → cached canvas. `rows` = array of equal‑length strings, `.` = transparent, palette maps char → colour (`'#rrggbb'` or a `Retro.colors` name). Draw with `Retro.draw.sprite`. |
| Colours | `Retro.colors.{black,navy,plum,green,brown,dgray,silver,white,red,orange,yellow,lime,blue,lavender,pink,peach,cyan,purple,ink,night,steel}` and `Retro.pal[0..15]` (PICO‑8 palette) |
| Effects | `Retro.fx.burst(x,y,{n,color|[colors],speed,life,size,gravity})` · `fx.text(x,y,str,color)` · `fx.shake(mag,sec)` · `fx.flash(color,sec)` (all auto‑updated/drawn) |
| Sound | `Retro.sfx.play(name)` with `blip select move tick rotate drop land line coin jump hit shoot explode powerup lose win start pause trophy` · `Retro.sfx.tone(freq,dur,{type,vol,slide,delay})` · `Retro.sfx.noise(dur,{vol,freq,sweep})` · `music: 'name'` in the config (or `Retro.music.play(name)`) |
| Raw audio | `Retro.audio.context()` (the shared `AudioContext`) and `Retro.audio.output()` (a `GainNode` that honours the SOUND key and volume) — for games that bring their own sound source, e.g. the emulators in `web/emulators/` |
| Haptics | `Retro.vibrate(ms)` (≤ 500) |
| Achievements | `Retro.achieve('id')` (declare it in the manifest; shows a toast once, ever) |
| Storage | `Retro.store.get(key, default)` / `Retro.store.set(key, jsonValue)` for per‑game extras (best time, difficulty…) |
| Utils | `Retro.util.{clamp,lerp,rand(a,b),randInt(a,b),pick(arr),shuffle(arr),overlap(r1,r2),dist,pad}` |
| Misc | `Retro.toast(text)` · `Retro.i18n(key)` · `Retro.saveNow()` |

## Quality bar (every game)

* **Colourful & juicy**: bright palette, beveled blocks or pixel sprites, particles on hits/kills/clears, small screen shake
  on big events, floating score text, sound effect on every meaningful event, a music loop, haptics on hit/lose.
* **Fair and finishing**: difficulty ramps up with score/level; the game can be lost (or won) and then restarted
  cleanly via `Retro.gameOver()`. `reset()` must fully re‑initialise everything.
* **One‑thumb friendly**: D‑pad + A (+ optional B) only. The READY screen lists `controls` from the manifest.
* **Persistence**: puzzle/board games implement `serialize()/restore()`; arcade/action games may skip it.
* **Achievements**: 3–4 per game, wired with `Retro.achieve`.
* **Self‑contained**: no `eval`, no network, no external assets; keep the package small (< 200 KB).
* **Original**: do not use trademarked names, logos, or copyrighted sprites/music. Classic *mechanics* are fine.
* No `alert/confirm/prompt`, no `window.open`, no navigation away from the page.
