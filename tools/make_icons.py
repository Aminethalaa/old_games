#!/usr/bin/env python3
"""Generates the launcher icons (pixel-art handheld) into android/app/src/main/res. Run: python3 tools/make_icons.py"""
import os
from PIL import Image, ImageDraw

RES = os.path.join(os.path.dirname(__file__), "..", "android", "app", "src", "main", "res")
N = 36  # cell grid

def art():
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    def r(x0, y0, x1, y1, c): d.rectangle([x0, y0, x1, y1], fill=c)
    black, dark, rim = (20, 20, 24, 255), (42, 42, 48, 255), (70, 70, 80, 255)
    # body (rounded by clipping corners)
    r(10, 6, 25, 29, black); r(11, 5, 24, 5, black); r(11, 30, 24, 30, black)
    r(10, 6, 10, 29, rim); r(11, 5, 24, 5, rim)
    # lcd
    r(12, 8, 23, 18, dark); r(13, 9, 22, 17, (16, 36, 74, 255))
    blocks = [((13, 9), (255, 0, 77)), ((16, 9), (255, 236, 39)), ((19, 9), (41, 173, 255)),
              ((14, 12), (180, 85, 255)), ((17, 12), (0, 228, 54)), ((20, 12), (255, 163, 0)),
              ((13, 15), (41, 173, 255)), ((16, 15), (255, 0, 77)), ((19, 15), (255, 236, 39))]
    for (x, y), c in blocks:
        r(x, y, x + 2, y + 2, c)
        r(x, y, x + 2, y, tuple(min(255, v + 70) for v in c[:3]) + (255,))
    # small keys
    y = 21
    for x in (12, 15, 18, 21): r(x, y, x + 1, y, (255, 200, 0, 255))
    # d-pad
    yel = (255, 200, 0, 255)
    r(13, 24, 15, 24, yel); r(13, 26, 15, 26, yel); r(12, 25, 12, 25, yel); r(16, 25, 16, 25, yel); r(14, 23, 14, 23, yel); r(14, 27, 14, 27, yel); r(13, 25, 15, 25, yel)
    # big A key
    r(20, 24, 23, 27, yel); r(21, 23, 22, 23, yel); r(21, 28, 22, 28, yel)
    return im

def save(img, path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.resize((size, size), Image.NEAREST).save(path)

fg = art()
dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, k in dens.items():
    # adaptive foreground: 108dp canvas
    save(fg, os.path.join(RES, f"drawable-{name}", "ic_launcher_foreground.png"), int(108 * k))
    # legacy square/round icon: 48dp, yellow tile with the art
    size = int(48 * k)
    tile = Image.new("RGBA", (N, N), (255, 200, 0, 255))
    tile.alpha_composite(fg)
    big = tile.resize((size, size), Image.NEAREST)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0)); out.paste(big, (0, 0), mask)
    os.makedirs(os.path.join(RES, f"mipmap-{name}"), exist_ok=True)
    out.save(os.path.join(RES, f"mipmap-{name}", "ic_launcher.png"))
    out.save(os.path.join(RES, f"mipmap-{name}", "ic_launcher_round.png"))
print("icons written")
