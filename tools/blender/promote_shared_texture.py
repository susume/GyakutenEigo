"""Promote one shared texture to a measured runtime resolution in Blender.

This keeps one shared atlas for a family of GLBs instead of embedding a copy in
each model. It is intentionally separate from asset export so a source atlas
can be preserved alongside the runtime copy.

Usage:
  blender -b --python promote_shared_texture.py -- \
    --input source-colormap.png --output colormap.png --size 1024
"""

import argparse
import sys
from pathlib import Path

import bpy


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--size", type=int, default=1024)
    return parser.parse_args(argv)


def main():
    args = arguments()
    source = Path(args.input)
    output = Path(args.output)
    if not source.exists():
        raise SystemExit(f"Texture not found: {source}")
    if args.size < 1024 or args.size > 2048:
        raise SystemExit("Shared runtime textures must be between 1024 and 2048px")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = bpy.data.images.load(str(source), check_existing=False)
    original = tuple(image.size[:])
    image.scale(args.size, args.size)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(output)
    image.file_format = "PNG"
    image.save()
    print(f"Promoted shared texture: {source.name} {original[0]}x{original[1]} -> {args.size}x{args.size}")
    print(f"Output: {output}")


if __name__ == "__main__":
    main()
