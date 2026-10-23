# Import my own game (NES · Game Boy · Game Boy Color)

Besides the original games, the console can play **game files you already own** — for example backups you made
yourself of cartridges you have. The app **never ships, downloads or links to commercial game files**; it only
runs files you pick from your phone.

**Store → ➕ → "My own game file (NES / Game Boy)…"** → pick a file → confirm → a new tile appears on the console
menu (and under *Store → Installed*, where you can remove it again).

| Format | Extension | Emulator (bundled, open source) |
|---|---|---|
| NES | `.nes` (iNES header) | [jsnes](https://github.com/bfirsh/jsnes) — Apache-2.0 |
| Game Boy / Game Boy Color | `.gb`, `.gbc` | [binjgb](https://github.com/binji/binjgb) — MIT |

Zip files are not opened — unzip first. Files are limited to 8 MB.

## Controls

| Console | Game |
|---|---|
| D-pad | D-pad |
| **A** (big key) | A |
| **B** (small key) | B |
| **S/P** | Start |
| **A + B together** | Select |
| **HOME** | back to the menu (the game stops; there are no save states yet) |
| **RESET** | power-cycles the game |
| **SOUND** | mutes / unmutes the emulator, like every other game |

## How it works

1. The app checks the file (NES: the `NES\x1A` header; Game Boy: extension + a whole number of 16 KB banks).
2. It creates `games/rom-<name>-<hash>/` in the app's private storage with the file as `rom.bin`, a manifest and a
   tiny `index.html` copied from `web/emulators/<core>/rom-index.html`.
3. That page loads the Retro SDK, the bundled core (`/emu/<core>/…`, served from the APK) and `player.js`, which
   connects the console's keys, screen and sound to the core. Like every game it runs offline in the sandboxed LCD
   WebView (no network, strict CSP).

```
web/emulators/
  audio-ring.js            shared audio buffer → the console's audio output (SOUND key / volume apply)
  nes/   jsnes.min.js  player.js  rom-index.html  LICENSE.jsnes.txt
  gb/    binjgb.js binjgb.wasm  player.js  rom-index.html  LICENSE.binjgb.txt
```

## Testing without any commercial game

`tools/make_test_roms.py` writes two tiny programs assembled by hand (an NES one that is red and turns green while A
is held, a Game Boy one that is white and turns black). `node tools/test/emulators.cjs` loads them through the real
player pages under the app's CSP and checks video, input and RESET.

## Limitations (today)

* **No in-game saves / save states yet** (battery-backed saves are not kept between sessions).
* Speed depends on the phone; the NES core is plain JavaScript, the Game Boy core is WebAssembly.
* NES: mapper coverage is whatever jsnes supports; unsupported files show *"Cannot run this game file"*.
* **Sega consoles are not included.** The common open-source Master System / Game Gear / Mega Drive cores are GPL or
  non-commercial licensed, which would affect how this app itself can be licensed. A core with a permissive licence
  can be added the same way (`web/emulators/<core>/` + a `RomKind` in `RomPackage.kt`).
* Use only files you own or have the right to use — you are responsible for what you import.
