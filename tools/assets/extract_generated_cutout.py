"""Extract pottery-style generated art from a neutral fake-transparency background.

This utility is intentionally conservative: it keeps the largest connected region
made from saturated clay colors or near-black ink, then creates a narrow antialiased
edge. It does not repaint or geometrically alter the generated figure.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def extract(source: Path, output: Path) -> None:
    source_image = Image.open(source)
    source_rgba = source_image.convert("RGBA")
    source_alpha = np.array(source_rgba.getchannel("A"))
    if source_alpha.min() < 255:
        # Preserve a genuine generated alpha channel verbatim.
        rgba = np.array(source_rgba)
        rgba[source_alpha == 0, :3] = 0
        cutout = Image.fromarray(rgba, "RGBA")
    else:
        rgb = np.array(source_image.convert("RGB"))
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
        saturation = hsv[:, :, 1]
        value = hsv[:, :, 2]

        # The generated figure uses saturated orange and near-black ink. The
        # painted checkerboard is neutral middle-gray, so this separates them
        # without sampling or changing the figure's actual colors.
        candidate = ((saturation >= 42) | (value <= 82)).astype(np.uint8)
        candidate = cv2.morphologyEx(
            candidate, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)
        )

        count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
        if count < 2:
            raise RuntimeError("No foreground component found")
        largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        solid = (labels == largest).astype(np.uint8)

        # Recover tiny antialiased edge pixels adjacent to the main silhouette
        # while leaving the open spaces between limbs and fingers transparent.
        nearby = cv2.dilate(solid, np.ones((3, 3), np.uint8), iterations=1)
        edge_color = ((saturation >= 20) | (value <= 90)).astype(np.uint8)
        solid = np.maximum(solid, nearby * edge_color)

        # Keep transparent pixels colorless so texture sampling cannot pull the
        # fake checkerboard into the silhouette.
        alpha = solid * 255
        rgb[solid == 0] = 0
        cutout = Image.fromarray(np.dstack((rgb, alpha)), "RGBA")

    # Normalize framing to the generation brief's ten-percent clear margin while
    # preserving the source aspect ratio and pose.
    bounds = cutout.getchannel("A").getbbox()
    if bounds:
        figure = cutout.crop(bounds)
        max_width = round(cutout.width * 0.8)
        max_height = round(cutout.height * 0.8)
        scale = min(max_width / figure.width, max_height / figure.height, 1.0)
        if scale < 1.0:
            figure = figure.resize(
                (round(figure.width * scale), round(figure.height * scale)),
                Image.Resampling.LANCZOS,
            )
        framed = Image.new("RGBA", cutout.size)
        framed.alpha_composite(
            figure,
            ((cutout.width - figure.width) // 2, (cutout.height - figure.height) // 2),
        )
        cutout = framed

    output.parent.mkdir(parents=True, exist_ok=True)
    cutout.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    extract(args.source, args.output)


if __name__ == "__main__":
    main()
