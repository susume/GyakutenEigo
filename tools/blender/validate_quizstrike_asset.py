"""Small Blender-side validation script for QuizStrike assets.

Usage:
  blender -b --python validate_quizstrike_asset.py -- --asset path/to/model.glb
"""

import argparse
import sys
from pathlib import Path

import bpy


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", required=True)
    parser.add_argument("--max-triangles", type=int, default=50000)
    parser.add_argument("--max-materials", type=int, default=8)
    parser.add_argument("--warn-texture-size", type=int, default=1024)
    parser.add_argument("--require-texture-size", type=int, default=0)
    return parser.parse_args(argv)


def main():
    args = arguments()
    path = Path(args.asset)
    if not path.exists():
        raise SystemExit(f"Asset not found: {path}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.suffix.lower() in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif path.suffix.lower() == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path))
    else:
        raise SystemExit("Supported input formats: .glb, .gltf, .fbx")

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    triangles = sum(len(mesh.data.loop_triangles) for mesh in meshes)
    materials = {material.name for mesh in meshes for material in mesh.data.materials if material}
    images = [image for image in bpy.data.images if image.size[0] and image.size[1]]
    problems = []
    texture_warnings = []

    if triangles > args.max_triangles:
        problems.append(f"triangle count {triangles} exceeds {args.max_triangles}")
    if len(materials) > args.max_materials:
        problems.append(f"material count {len(materials)} exceeds {args.max_materials}")
    for image in images:
        width, height = image.size[:]
        if max(width, height) < args.warn_texture_size:
            texture_warnings.append(f"{image.name}: {width}x{height} is below the {args.warn_texture_size}px guidance")
        if args.require_texture_size and max(width, height) < args.require_texture_size:
            problems.append(f"texture {image.name} is {width}x{height}, below required {args.require_texture_size}px")
    for obj in meshes:
        if any(abs(value - 1.0) > 0.001 for value in obj.scale):
            problems.append(f"unapplied scale: {obj.name}")
        if not obj.data.uv_layers:
            problems.append(f"missing UVs: {obj.name}")
        if obj.name.lower().startswith(("cube", "plane", "camera", "light")):
            problems.append(f"generic or non-production name: {obj.name}")

    print(f"QuizStrike asset: {path.name}")
    print(f"Meshes: {len(meshes)} | Triangles: {triangles} | Materials: {len(materials)} | Images: {len(images)}")
    if texture_warnings:
        print("Texture guidance:")
        for warning in sorted(set(texture_warnings)):
            print(f"- {warning}")
    if problems:
        print("Validation problems:")
        for problem in sorted(set(problems)):
            print(f"- {problem}")
        raise SystemExit(1)
    print("Validation passed")


if __name__ == "__main__":
    main()
