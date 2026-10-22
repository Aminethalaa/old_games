#!/usr/bin/env python3
"""Fills the games table in README.md between <!-- GAMES:START --> and <!-- GAMES:END --> from the manifests."""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CATS = [("classic", "Classic pack"), ("arcade", "Arcade pack"), ("puzzle", "Puzzle pack"), ("action", "Action / Platform pack")]


def load(kind):
    base = os.path.join(ROOT, "web", "games", kind)
    out = []
    for gid in sorted(os.listdir(base)):
        mp = os.path.join(base, gid, "manifest.json")
        if not gid.startswith("_") and os.path.exists(mp):
            m = json.load(open(mp, encoding="utf-8"))
            m["where"] = "built in" if kind == "builtin" else "Game Store"
            out.append(m)
    return out


games = load("builtin") + load("store")
lines = []
for cat, title in CATS:
    items = [g for g in games if g["category"] == cat]
    if not items:
        continue
    lines += [f"**{title}** ({len(items)})", "", "| Game | How to play | Where |", "|---|---|---|"]
    for g in sorted(items, key=lambda g: g["name"]):
        c = g.get("controls", {})
        how = "; ".join(f"{k.upper() if k != 'dpad' else 'D-pad'}: {v}" for k, v in c.items())
        lines.append(f"| **{g['name']}** — {g['description']} | {how} | {g['where']} |")
    lines.append("")
block = "\n".join(lines).rstrip() + "\n"

path = os.path.join(ROOT, "README.md")
text = open(path, encoding="utf-8").read()
a, b = "<!-- GAMES:START -->", "<!-- GAMES:END -->"
i, j = text.index(a) + len(a), text.index(b)
open(path, "w", encoding="utf-8").write(text[:i] + "\n" + block + text[j:])
print(f"README updated with {len(games)} games")
