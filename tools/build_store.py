#!/usr/bin/env python3
"""Builds the Game Store from web/games/store/*:

  store/packs/<id>-<version>.zip   deterministic (stored, sorted, fixed timestamps) game packages
  store/catalog.json               what the app downloads: metadata, size, sha256 and a *relative* pack url

    python3 tools/build_store.py            # (re)build
    python3 tools/build_store.py --check    # CI: fail if the committed store is out of date

The catalog URL is configurable in the app (Settings -> Game Store) and pack URLs are relative to it,
so the whole `store/` folder can be hosted anywhere (GitHub raw, GitHub Pages, your own server).
"""
import hashlib
import json
import os
import re
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STORE_SRC = os.path.join(ROOT, "web", "games", "store")
BUILTIN_SRC = os.path.join(ROOT, "web", "games", "builtin")
OUT = os.path.join(ROOT, "store")
PACKS = os.path.join(OUT, "packs")
CATEGORIES = ["classic", "arcade", "puzzle", "action"]
ALLOWED_EXT = {"html", "htm", "js", "mjs", "json", "css", "png", "jpg", "jpeg", "gif", "webp", "svg", "ico",
               "ogg", "mp3", "wav", "m4a", "ttf", "otf", "woff", "woff2", "txt", "md", "map"}
FIXED_TIME = (2020, 1, 1, 0, 0, 0)
MAX_PACK = 40 * 1024 * 1024


def fail(msg):
    print("ERROR:", msg, file=sys.stderr)
    sys.exit(1)


def validate(gid, m, builtin_ids):
    errs = []
    if m.get("id") != gid:
        errs.append(f'id "{m.get("id")}" must equal folder name "{gid}"')
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,40}", gid):
        errs.append("bad id")
    if gid in builtin_ids:
        errs.append("id collides with a built-in game")
    for k in ("name", "version", "description", "author", "category", "color"):
        if not m.get(k):
            errs.append(f'missing "{k}"')
    if m.get("sdk") != 1:
        errs.append('"sdk" must be 1')
    if m.get("category") not in CATEGORIES:
        errs.append("bad category")
    if not re.fullmatch(r"\d+\.\d+\.\d+", m.get("version", "")):
        errs.append("version must be x.y.z")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", m.get("color", "")):
        errs.append("color must be #rrggbb")
    ic = m.get("icon") or {}
    rows = ic.get("rows") or []
    if not (8 <= len(rows) <= 16) or any(len(r) != len(rows) for r in rows):
        errs.append("icon must be square with 8-16 rows")
    for ch in set("".join(rows)) - {".", " "}:
        if ch not in (ic.get("palette") or {}):
            errs.append(f'icon char "{ch}" missing from palette')
    if not os.path.exists(os.path.join(STORE_SRC, gid, "index.html")):
        errs.append("index.html missing")
    return errs


def game_files(gdir):
    out = []
    for base, dirs, files in os.walk(gdir):
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))
        for f in sorted(files):
            if f.startswith(".") or f.endswith("~"):
                continue
            full = os.path.join(base, f)
            rel = os.path.relpath(full, gdir).replace(os.sep, "/")
            ext = rel.rsplit(".", 1)[-1].lower() if "." in rel else ""
            if ext not in ALLOWED_EXT:
                fail(f"{gdir}: file type not allowed in game packages: {rel}")
            out.append((rel, full))
    return sorted(out)


def build_zip(gdir, dest):
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_STORED) as z:
        for rel, full in game_files(gdir):
            zi = zipfile.ZipInfo(rel, date_time=FIXED_TIME)
            zi.compress_type = zipfile.ZIP_STORED
            zi.create_system = 3
            zi.external_attr = 0o644 << 16
            with open(full, "rb") as fh:
                z.writestr(zi, fh.read())
    if os.path.getsize(dest) > MAX_PACK:
        fail(f"{dest} is larger than {MAX_PACK} bytes")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def build(out_dir):
    builtin_ids = set(os.listdir(BUILTIN_SRC)) if os.path.isdir(BUILTIN_SRC) else set()
    packs_dir = os.path.join(out_dir, "packs")
    os.makedirs(packs_dir, exist_ok=True)
    entries, wanted = [], set()
    ids = sorted(d for d in os.listdir(STORE_SRC) if not d.startswith((".", "_")) and os.path.isdir(os.path.join(STORE_SRC, d))) if os.path.isdir(STORE_SRC) else []
    problems = []
    for gid in ids:
        mpath = os.path.join(STORE_SRC, gid, "manifest.json")
        if not os.path.exists(mpath):
            problems.append(f"{gid}: manifest.json missing")
            continue
        m = json.load(open(mpath, encoding="utf-8"))
        errs = validate(gid, m, builtin_ids)
        if errs:
            problems.append(f"{gid}: " + "; ".join(errs))
            continue
        name = f"{gid}-{m['version']}.zip"
        dest = os.path.join(packs_dir, name)
        build_zip(os.path.join(STORE_SRC, gid), dest)
        wanted.add(name)
        entries.append({
            "id": gid,
            "name": m["name"],
            "short": m.get("short", m["name"][:11]),
            "version": m["version"],
            "category": m["category"],
            "color": m["color"],
            "description": m["description"],
            "author": m["author"],
            "tags": m.get("tags", []),
            "icon": m["icon"],
            "size": os.path.getsize(dest),
            "sha256": sha256(dest),
            "url": f"packs/{name}",
            "sdk": m["sdk"],
            "achievements": len(m.get("achievements", [])),
        })
    if problems:
        fail("\n  " + "\n  ".join(problems))
    for f in os.listdir(packs_dir):  # drop packs of removed games / older versions
        if f.endswith(".zip") and f not in wanted:
            os.remove(os.path.join(packs_dir, f))
    entries.sort(key=lambda e: (CATEGORIES.index(e["category"]), e["name"].lower()))
    catalog = {"schema": 1, "name": "Retro Console Game Store", "games": entries}
    with open(os.path.join(out_dir, "catalog.json"), "w", encoding="utf-8") as fh:
        json.dump(catalog, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    return catalog


def main():
    if "--check" in sys.argv:
        import shutil
        import tempfile
        tmp = tempfile.mkdtemp()
        try:
            build(tmp)
            same = True
            for rel in ["catalog.json"] + [os.path.join("packs", f) for f in sorted(os.listdir(os.path.join(tmp, "packs")))]:
                a, b = os.path.join(tmp, rel), os.path.join(OUT, rel)
                if not os.path.exists(b) or open(a, "rb").read() != open(b, "rb").read():
                    print("OUT OF DATE:", rel)
                    same = False
            committed = set(os.listdir(PACKS)) if os.path.isdir(PACKS) else set()
            for extra in sorted(committed - set(os.listdir(os.path.join(tmp, "packs")))):
                print("STALE PACK:", extra)
                same = False
            if not same:
                fail("store/ is out of date - run: python3 tools/build_store.py")
            print("store/ is up to date")
        finally:
            shutil.rmtree(tmp)
        return
    cat = build(OUT)
    print(f"built {len(cat['games'])} packs -> store/catalog.json")
    for e in cat["games"]:
        print(f"  {e['id']:<16} v{e['version']:<7} {e['category']:<7} {e['size']:>7} B")


if __name__ == "__main__":
    main()
