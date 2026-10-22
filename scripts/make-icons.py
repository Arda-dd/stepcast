"""Draws the Stepcast icon (a play button with a hotspot ring) as PNGs for the extension.

Usage: python scripts/make-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"
SIZE = 1024  # drawn large, then scaled down for crisp small icons


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def draw() -> Image.Image:
    top, bottom = (139, 127, 255), (91, 75, 224)
    gradient = Image.new("RGBA", (SIZE, SIZE))
    gd = ImageDraw.Draw(gradient)
    for y in range(SIZE):
        gd.line([(0, y), (SIZE, y)], fill=lerp(top, bottom, y / SIZE) + (255,))
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=SIZE * 0.24, fill=255)
    icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    icon.paste(gradient, (0, 0), mask)

    d = ImageDraw.Draw(icon)
    s = SIZE / 32
    d.polygon([(11.5 * s, 8.5 * s), (11.5 * s, 23.5 * s), (23.5 * s, 16 * s)], fill=(255, 255, 255, 255))
    # Hotspot: a ring and a dot at the bottom right.
    cx, cy, r = 23.5 * s, 23.5 * s, 4.2 * s
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 255), width=round(1.6 * s))
    d.ellipse([cx - 1.7 * s, cy - 1.7 * s, cx + 1.7 * s, cy + 1.7 * s], fill=(255, 255, 255, 255))
    return icon


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    icon = draw()
    for size in (16, 32, 48, 128):
        icon.resize((size, size), Image.LANCZOS).save(OUT / f"{size}.png")
    icon.resize((256, 256), Image.LANCZOS).save(OUT.parent.parent / "docs" / "logo.png")
    print(f"Wrote icons to {OUT}")


if __name__ == "__main__":
    main()
