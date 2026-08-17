"""Turn a brand's master logo PNG into a signature-ready asset.

Transparent PNGs are the wrong format for an email signature: they vanish
against inverted dark-mode backgrounds. So each master is trimmed to its
artwork, flattened onto solid white, padded slightly, and saved as JPEG at 2x
the display size.

Needs Pillow:  pip install Pillow
Usage:         python3 tools/make-logos.py
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (master file, output name, max display width, max display height)
LOGOS = [
    ("Canareef Logo Vector - Illustrator (Brown).png", "logo-canareef-v1.jpg", 96, 62),
    ("Palmscape Boutique Hotel Color Logo.png", "logo-palmscape-v1.jpg", 90, 90),
]
PAD = 0.04  # white breathing room, as a fraction of the longer side


def build(src, out, max_w, max_h):
    im = Image.open(ROOT / src).convert("RGBA")

    # Trim the transparent margin so padding is predictable across masters.
    box = im.getchannel("A").getbbox()
    if box:
        im = im.crop(box)

    # Fit inside the display box at 2x, preserving aspect ratio. The width and
    # height attributes in the signature use the 1x numbers this prints.
    scale = min(max_w / im.width, max_h / im.height)
    w, h = round(im.width * scale), round(im.height * scale)
    im = im.resize((w * 2, h * 2), Image.LANCZOS)

    pad = round(max(im.size) * PAD)
    canvas = Image.new("RGB", (im.width + pad * 2, im.height + pad * 2), (255, 255, 255))
    canvas.paste(im, (pad, pad), im)  # alpha as the mask: flattens onto white

    dest = ROOT / "assets" / out
    canvas.save(dest, quality=90, optimize=True)
    kb = dest.stat().st_size / 1024
    print(f"{out}  asset {canvas.width}x{canvas.height}  "
          f"display {canvas.width // 2}x{canvas.height // 2}  {kb:.1f} KB")
    assert kb < 50, f"{out} is over the 50 KB budget"


for args in LOGOS:
    build(*args)
