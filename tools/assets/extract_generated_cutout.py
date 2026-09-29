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


def _foreground(rgb: np.ndarray) -> np.ndarray:
    """Return an antialiased pottery-figure mask for one isolated cell."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    candidate = ((saturation >= 42) | (value <= 82)).astype(np.uint8)
    candidate = cv2.morphologyEx(
        candidate, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)
    )
    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    if count < 2:
        raise RuntimeError("No foreground component found")
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    solid = (labels == largest).astype(np.uint8)
    nearby = cv2.dilate(solid, np.ones((3, 3), np.uint8), iterations=1)
    edge_color = ((saturation >= 20) | (value <= 90)).astype(np.uint8)
    return np.maximum(solid, nearby * edge_color)


def _extract_cell(image: Image.Image) -> Image.Image:
    rgb = np.array(image.convert("RGB"))
    alpha = _foreground(rgb) * 255
    rgb[alpha == 0] = 0
    return Image.fromarray(np.dstack((rgb, alpha)), "RGBA")


def _grid_to_strip(
    source: Image.Image,
    columns: int,
    rows: int,
    height_pattern: list[int] | None = None,
) -> Image.Image:
    """Extract a generated pose grid into registered row-major strip cells."""
    if source.width % columns or source.height % rows:
        raise ValueError("Grid dimensions must divide the source image exactly")
    cell_width = source.width // columns
    cell_height = source.height // rows
    figures: list[Image.Image] = []
    for row in range(rows):
        for column in range(columns):
            box = (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
            cutout = _extract_cell(source.crop(box))
            bounds = cutout.getchannel("A").getbbox()
            if not bounds:
                raise RuntimeError(f"No figure found in grid cell {column},{row}")
            figure = cutout.crop(bounds)
            if figure.width > cell_width - 20 or figure.height > cell_height - 20:
                scale = min(
                    (cell_width - 20) / figure.width,
                    (cell_height - 20) / figure.height,
                )
                figure = figure.resize(
                    (round(figure.width * scale), round(figure.height * scale)),
                    Image.Resampling.LANCZOS,
                )
            figures.append(figure)
    if height_pattern:
        for index, figure in enumerate(figures):
            target_height = height_pattern[index % len(height_pattern)]
            scale = target_height / figure.height
            target_width = round(figure.width * scale)
            if target_width > cell_width - 20 or target_height > cell_height - 20:
                raise ValueError("Requested height pattern does not fit the grid cell")
            figures[index] = figure.resize(
                (target_width, target_height), Image.Resampling.LANCZOS
            )
    cells: list[Image.Image] = []
    for figure in figures:
        registered = Image.new("RGBA", (cell_width, cell_height))
        registered.alpha_composite(
            figure,
            ((cell_width - figure.width) // 2, cell_height - 10 - figure.height),
        )
        cells.append(registered)
    strip = Image.new("RGBA", (cell_width * len(cells), cell_height))
    for index, cell in enumerate(cells):
        strip.alpha_composite(cell, (index * cell_width, 0))
    return strip


def extract(
    source: Path,
    output: Path,
    grid: tuple[int, int] | None = None,
    height_pattern: list[int] | None = None,
) -> None:
    source_image = Image.open(source)
    if grid:
        cutout = _grid_to_strip(source_image, *grid, height_pattern)
        output.parent.mkdir(parents=True, exist_ok=True)
        cutout.save(output, optimize=True)
        return
    source_rgba = source_image.convert("RGBA")
    source_alpha = np.array(source_rgba.getchannel("A"))
    if source_alpha.min() < 255:
        # Preserve a genuine generated alpha channel verbatim.
        rgba = np.array(source_rgba)
        rgba[source_alpha == 0, :3] = 0
        cutout = Image.fromarray(rgba, "RGBA")
    else:
        rgb = np.array(source_image.convert("RGB"))
        solid = _foreground(rgb)
        if source_image.width >= source_image.height * 2:
            # Animation strips contain one disconnected figure per cell. Keep
            # every figure-sized component while still rejecting isolated
            # checkerboard cells and compression flecks.
            hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
            saturation = hsv[:, :, 1]
            value = hsv[:, :, 2]
            candidate = ((saturation >= 42) | (value <= 82)).astype(np.uint8)
            count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
            largest_area = stats[1:, cv2.CC_STAT_AREA].max()
            keep = [
                index
                for index in range(1, count)
                if stats[index, cv2.CC_STAT_AREA] >= largest_area * 0.22
            ]
            solid = np.isin(labels, keep).astype(np.uint8)

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
    parser.add_argument(
        "--grid",
        metavar="COLSxROWS",
        help="extract a generated pose grid into one registered horizontal strip",
    )
    parser.add_argument(
        "--height-pattern",
        help="comma-separated registered figure heights, repeated across grid cells",
    )
    args = parser.parse_args()
    grid = tuple(map(int, args.grid.lower().split("x"))) if args.grid else None
    if grid and len(grid) != 2:
        parser.error("--grid must be formatted COLSxROWS, for example 4x2")
    heights = [int(value) for value in args.height_pattern.split(",")] if args.height_pattern else None
    extract(args.source, args.output, grid, heights)


if __name__ == "__main__":
    main()
