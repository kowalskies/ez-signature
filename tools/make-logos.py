"""Turn a brand's master logo PNG into a signature-ready asset.

Kept transparent, deliberately. Outlook's dark mode inverts the message body
background but NOT images, so a transparent logo keeps its glyph colour and sits
on whatever ground Outlook painted. The only risk is contrast, and measured
against the 3:1 WCAG threshold for graphics:

    Canareef  #876432   white 5.39   OWA dark 3.23   desktop dark 2.81   iOS dark 3.90
    Palmscape #2a5e50   white 7.46   OWA dark 2.33   desktop dark 2.03   iOS dark 2.82

So Canareef sits around the threshold and Palmscape falls below it: both look
softer on a dark background, Palmscape noticeably washed out. That is an accepted
trade for not putting a white box behind every logo. The fix, if it ever matters,
is a reversed lockup on the brand colour (white glyphs read at 5.39 and 7.46 on
any ground) -- not flattening onto white, and not a dark-mode asset swap, which
would need a <style> block that Word ignores and Outlook on the web strips.

Needs Pillow:  pip install Pillow
Usage:         python3 tools/make-logos.py
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (master file, output name, max display width, max display height)
LOGOS = [
    ("Canareef Logo Vector - Illustrator (Brown).png", "logo-canareef-v1.png", 96, 62),
    ("Palmscape Boutique Hotel Color Logo.png", "logo-palmscape-v1.png", 90, 90),
]
PAD = 0.04  # transparent breathing room, as a fraction of the longer side


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
    canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad))

    dest = ROOT / "assets" / out
    canvas.save(dest, optimize=True)
    kb = dest.stat().st_size / 1024
    print(f"{out}  asset {canvas.width}x{canvas.height}  "
          f"display {canvas.width // 2}x{canvas.height // 2}  {kb:.1f} KB")
    assert kb < 50, f"{out} is over the 50 KB budget"


for args in LOGOS:
    build(*args)
