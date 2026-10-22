"""Assembles test-results/gif/*.png (written by scripts/showcase.mjs) into docs/demo.gif.

Usage: python scripts/make-gif.py [width]
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FRAMES = sorted((ROOT / "test-results" / "gif").glob("*.png"))
OUT = ROOT / "docs" / "demo.gif"
WIDTH = int(sys.argv[1]) if len(sys.argv) > 1 else 800


def main():
    if not FRAMES:
        sys.exit("No frames found. Run `node scripts/showcase.mjs` first.")
    images = []
    for path in FRAMES:
        frame = Image.open(path).convert("RGB")
        height = round(frame.height * WIDTH / frame.width)
        images.append(frame.resize((WIDTH, height), Image.LANCZOS))
    # One shared palette keeps colours stable between frames and the file small.
    palette = images[0].quantize(colors=200, method=Image.Quantize.MEDIANCUT)
    quantized = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]
    durations = [100] * len(quantized)
    durations[-1] = 1800
    quantized[0].save(OUT, save_all=True, append_images=quantized[1:], duration=durations, loop=0, optimize=True, disposal=1)
    print(f"Wrote {OUT} ({len(quantized)} frames, {OUT.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
