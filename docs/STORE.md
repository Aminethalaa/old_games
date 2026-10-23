# Game Store

The app's **Game Store** is just two things: a `catalog.json` and the game packs it points to. Both live in this
repository under `store/` and are served straight from GitHub (`raw.githubusercontent.com`), so adding a game is
`git push` — no server, no app update.

```
store/
  catalog.json                       what the app downloads (name, version, size, sha256, icon, pack url …)
  packs/<id>-<version>.zip           one deterministic zip per game  (built by tools/build_store.py)
web/games/store/<id>/                the game sources the packs are built from
```

Default catalog URL (compiled into the app, changeable in **Settings → Game Store**):

```
https://raw.githubusercontent.com/Aminethalaa/old_games/main/store/catalog.json
```

Pack URLs inside the catalog are **relative** to the catalog, so you can host `store/` anywhere
(GitHub Pages, your own server, a fork) and just point the app at that `catalog.json`.

## Publish a new game / a new version

1. Create `web/games/store/<id>/` (copy `web/games/_template`, see [GAME_SDK.md](GAME_SDK.md)).
2. Test it: `node tools/test/smoke.cjs <id>`.
3. `python3 tools/build_store.py` — validates the manifest, writes the pack and updates `store/catalog.json`.
4. Commit and push (`store/` included). CI fails if `store/` is stale (`python3 tools/build_store.py --check`).

To ship a **fix**, bump `"version"` in the game's `manifest.json` and rebuild: installed copies show **UPDATE** in the
store, and the app also updates them in the background on Wi-Fi when *Auto-update games* is on.

## What the app guarantees

* Store installs are **verified**: the downloaded zip must match the catalog's SHA-256, otherwise nothing is installed.
* Archives are unpacked safely: no absolute paths or `..`, allow-listed file types only (html, js, json, css, images,
  audio, fonts), ≤ 40 MB zipped / 80 MB unpacked / 3000 files, and a manifest with a valid id.
* Games run in a sandboxed WebView: only local files can load (every network request is blocked) and a strict
  Content-Security-Policy is attached (`connect-src 'self'`, no frames/plugins/forms).

## Install a game without the store

All of these show a **"verified?" confirmation** first, because they bypass the catalog's checksum:

| How | Example |
|---|---|
| **File** — Store → **+** → *From a file* | a `.zip` game package or a single `.html` HTML5 game |
| **Link** — Store → **+** → *From a link* | `https://example.com/my-game.zip` |
| **QR code** — Store → **+** → *Scan a QR code* | a QR containing the zip URL, or `retrogame://install?url=https%3A%2F%2Fexample.com%2Fmy-game.zip` |
| **Open with** | share/open a `.retrogame` file (a renamed `.zip`) from your file manager |
| **Deep link** | tapping a `retrogame://install?url=…` link in a browser or message |

Packages **with** a `manifest.json` (see GAME_SDK.md) get hi-scores, trophies, save & resume, the side panel and
sound/haptics. Plain HTML5 games **without** one still run in "compat mode": the console's D-pad/A/B/S-P keys are
sent to the game as arrow keys / Space / X / Enter — handy for any keyboard-playable HTML5 game.
A single `.html` file works too (it must be self-contained: no external scripts or images).

## `catalog.json`

```jsonc
{
  "schema": 1,
  "name": "Retro Console Game Store",
  "games": [
    {
      "id": "alien-blaster", "name": "Alien Blaster", "short": "ALIENS", "version": "1.0.0",
      "category": "arcade",            // classic | arcade | puzzle | action
      "color": "#29e86b", "description": "…", "author": "Retro Console", "tags": ["shooter"],
      "icon": { "palette": { "G": "#00e436" }, "rows": ["…12 rows…"] },
      "size": 41234, "sha256": "…", "url": "packs/alien-blaster-1.0.0.zip",
      "sdk": 1, "achievements": 4
    }
  ]
}
```

## Hosting your own store

Copy the `store/` folder to any HTTPS host (or fork this repo), then in the app: **Settings → Game Store → Store
catalog URL**. A QR code of `retrogame://install?url=<zip url>` is the quickest way to hand a single game to a friend.
