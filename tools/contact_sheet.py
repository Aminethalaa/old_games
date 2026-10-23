#!/usr/bin/env python3
"""Builds a contact sheet from tools/test/out/<id>-2-play.png (run SHOTS=1 node tools/test/smoke.cjs first)."""
import glob, os, sys
from PIL import Image, ImageDraw
out = os.path.join(os.path.dirname(__file__), "test", "out")
kind = sys.argv[1] if len(sys.argv) > 1 else "2-play"
files = sorted(glob.glob(os.path.join(out, f"*-{kind}.png")))
if not files: sys.exit("no screenshots")
cols, w = 6, 272
thumbs = []
for f in files:
    im = Image.open(f).convert("RGB"); im = im.resize((w, int(im.height * w / im.width)))
    d = ImageDraw.Draw(im); d.rectangle([0, 0, w, 14], fill=(0, 0, 0)); d.text((4, 2), os.path.basename(f).split("-")[0], fill=(255, 255, 0))
    thumbs.append(im)
rows = (len(thumbs) + cols - 1) // cols
h = max(t.height for t in thumbs)
sheet = Image.new("RGB", (cols * w, rows * h), (20, 20, 28))
for i, t in enumerate(thumbs): sheet.paste(t, ((i % cols) * w, (i // cols) * h))
dest = os.path.join(out, f"sheet-{kind}.png"); sheet.save(dest); print(dest, len(thumbs), "games")
