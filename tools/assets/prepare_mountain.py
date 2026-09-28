"""Prepare a generated First Hill cutout for the fixed 1600x900 stage."""

from pathlib import Path
import argparse

import cv2
import numpy as np
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    rgb = np.array(Image.open(args.source).convert("RGB"))
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    saturation, value = hsv[:, :, 1], hsv[:, :, 2]
    candidate = ((saturation >= 38) | (value <= 92)).astype(np.uint8)
    candidate = cv2.morphologyEx(candidate, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    mask = (labels == largest).astype(np.uint8)
    nearby = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)
    mask = np.maximum(mask, nearby * (((saturation >= 18) | (value <= 110)).astype(np.uint8)))
    rgb[mask == 0] = 0
    cutout = Image.fromarray(np.dstack((rgb, mask * 255)), "RGBA")

    bounds = cutout.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("No mountain silhouette found")
    mountain = cutout.crop(bounds).resize((1340, 534), Image.Resampling.LANCZOS)
    stage = Image.new("RGBA", (1600, 900))
    stage.alpha_composite(mountain, (130, 226))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    stage.save(args.output, optimize=True)


if __name__ == "__main__":
    main()
