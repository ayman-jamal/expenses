#!/usr/bin/env python3
"""
Rebuild every app icon from assets/logo.svg.

    python3 tools/render-icons.py

Chrome rasterises the SVG once at high resolution; Pillow trims the result to
its ink and re-centres it per target. Nothing here is hand-placed, so editing
logo.svg and re-running is enough — the mark stays centred and correctly
sized in all six PNGs.

Needs: Google Chrome (or Chromium) and Pillow. No Node, no ImageMagick.
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "assets" / "logo.svg"
OUT = ROOT / "assets"

MASTER = 2048  # render once at this size, downsample per target
GROUND = (13, 13, 13)  # #0d0d0d — matches C.bg and app.json

CHROMES = [
    "google-chrome",
    "chromium",
    "chromium-browser",
    "/snap/bin/chromium",
    "google-chrome-stable",
]

# name -> (canvas px, mark fraction of canvas, mode)
#   "alpha"      transparent RGBA
#   "ground"     flattened onto GROUND, no alpha
#   "solid"      flat GROUND fill, no mark
#   "mono"       white silhouette on transparent
#
# The Android foreground and monochrome layers are held at 0.58: Android's
# adaptive mask only guarantees the central 66/108 (~61%) of the canvas, and
# anything larger gets clipped on round and squircle launchers.
TARGETS = {
    "icon.png": (1024, 0.68, "ground"),
    "android-icon-foreground.png": (1024, 0.58, "alpha"),
    "android-icon-background.png": (1024, 0.00, "solid"),
    "android-icon-monochrome.png": (1024, 0.58, "mono"),
    "splash-icon.png": (1024, 0.55, "alpha"),
    "favicon.png": (196, 0.78, "alpha"),
}


def find_chrome() -> str:
    for name in CHROMES:
        found = shutil.which(name) or (name if Path(name).exists() else None)
        if found:
            return found
    sys.exit("No Chrome/Chromium found — needed to rasterise the SVG.")


def render_master(chrome: str) -> Image.Image:
    """Rasterise the SVG to a transparent PNG, then trim to its ink."""
    svg = SVG.read_text(encoding="utf-8")
    # Draw at MASTER px regardless of what the file declares.
    svg = svg.replace('width="512" height="512"', f'width="{MASTER}" height="{MASTER}"', 1)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        page = tmp / "page.html"
        page.write_text(
            "<html><head><meta charset='utf-8'><style>"
            "html,body{margin:0;padding:0;background:transparent}"
            "svg{display:block}</style></head><body>" + svg + "</body></html>",
            encoding="utf-8",
        )
        shot = tmp / "master.png"
        subprocess.run(
            [
                chrome,
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--hide-scrollbars",
                "--force-device-scale-factor=1",
                "--default-background-color=00000000",
                f"--user-data-dir={tmp / 'profile'}",
                f"--window-size={MASTER},{MASTER}",
                f"--screenshot={shot}",
                page.as_uri(),
            ],
            check=True,
            capture_output=True,
        )
        if not shot.exists():
            sys.exit("Chrome produced no screenshot.")
        img = Image.open(shot).convert("RGBA")

    box = img.getbbox()  # trim transparent margin so centring is exact
    if not box:
        sys.exit("The rendered mark is empty — check assets/logo.svg.")
    return img.crop(box)


def place(mark: Image.Image, canvas: int, fraction: float) -> Image.Image:
    """Scale the mark to `fraction` of the canvas and centre it."""
    limit = canvas * fraction
    scale = min(limit / mark.width, limit / mark.height)
    size = (max(1, round(mark.width * scale)), max(1, round(mark.height * scale)))
    scaled = mark.resize(size, Image.LANCZOS)

    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(scaled, ((canvas - size[0]) // 2, (canvas - size[1]) // 2), scaled)
    return out


def build(mark: Image.Image, name: str, canvas: int, fraction: float, mode: str) -> None:
    if mode == "solid":
        img = Image.new("RGB", (canvas, canvas), GROUND)
    else:
        layer = place(mark, canvas, fraction)
        if mode == "mono":
            # Android tints this itself, so ship the shape alone: keep the
            # alpha, throw the colour away.
            img = Image.new("RGBA", (canvas, canvas), (255, 255, 255, 0))
            img.putalpha(layer.getchannel("A"))
        elif mode == "ground":
            img = Image.new("RGB", (canvas, canvas), GROUND)
            img.paste(layer, (0, 0), layer)
        else:
            img = layer

    path = OUT / name
    img.save(path)
    print(f"  {name:34} {img.size[0]}x{img.size[1]}  {img.mode}")


def main() -> None:
    if not SVG.exists():
        sys.exit(f"Missing {SVG}")
    chrome = find_chrome()
    print(f"Rasterising {SVG.name} with {chrome}")
    mark = render_master(chrome)
    print(f"  mark ink: {mark.width}x{mark.height}\n")
    for name, (canvas, fraction, mode) in TARGETS.items():
        build(mark, name, canvas, fraction, mode)
    print("\nDone.")


if __name__ == "__main__":
    main()
