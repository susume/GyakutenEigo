"""Normalize and export one asset to a browser-friendly GLB.

Usage:
  blender -b --python export_quizstrike_asset.py -- --input source.fbx --output out.glb

Texture policy:
  - Keep textures at their source resolution unless they exceed the explicit cap.
  - Do not downscale below 1K by default.
  - Use ``--upscale-small-textures`` only for a hero asset whose material has
    meaningful baked detail; upscaling a flat source atlas does not create detail.
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
    parser.add_argument("--max-triangles", type=int, default=50000)
    parser.add_argument("--max-texture-size", type=int, default=2048)
    parser.add_argument("--min-texture-size", type=int, default=1024)
    parser.add_argument("--upscale-small-textures", action="store_true")
    return parser.parse_args(argv)


def normalize_images(max_size, min_size, upscale_small):
    resized = []
    for image in bpy.data.images:
        width, height = image.size[:]
        if not width or not height:
            continue
        target_width, target_height = width, height
        largest = max(width, height)
        if largest > max_size:
            ratio = max_size / largest
            target_width = max(1, round(width * ratio))
            target_height = max(1, round(height * ratio))
        elif upscale_small and largest < min_size:
            ratio = min_size / largest
            target_width = max(1, round(width * ratio))
            target_height = max(1, round(height * ratio))
        if (target_width, target_height) != (width, height):
            image.scale(target_width, target_height)
            resized.append(f"{image.name}: {width}x{height} -> {target_width}x{target_height}")
        try:
            image.pack()
        except RuntimeError:
            # A missing optional source image should be reported by validation;
            # it must not make a different mesh-only asset impossible to export.
            pass
    return resized


def main():
    args = arguments()
    source = Path(args.input)
    output = Path(args.output)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix.lower() in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif source.suffix.lower() == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source), automatic_bone_orientation=True)
    else:
        raise SystemExit("Supported input formats: .glb, .gltf, .fbx")

    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise SystemExit("The imported asset contains no mesh objects")
    for obj in meshes:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        obj.select_set(False)
        for material in obj.data.materials:
            if not material or not hasattr(material, "roughness"):
                continue
            material.roughness = max(0.56, material.roughness)
            material.metallic = min(0.68, material.metallic)

    texture_changes = normalize_images(
        max_size=args.max_texture_size,
        min_size=args.min_texture_size,
        upscale_small=args.upscale_small_textures,
    )

    bpy.context.view_layer.objects.active = meshes[0] if meshes else None
    if meshes:
        for mesh in meshes:
            mesh.data.calc_loop_triangles()
        triangle_count = sum(len(mesh.data.loop_triangles) for mesh in meshes)
        if triangle_count > args.max_triangles:
            ratio = max(0.05, args.max_triangles / triangle_count)
            for obj in meshes:
                modifier = obj.modifiers.new("QuizStrike budget decimate", "DECIMATE")
                modifier.ratio = ratio
                bpy.context.view_layer.objects.active = obj
                bpy.ops.object.modifier_apply(modifier=modifier.name)

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    print(f"Exported {output}")
    if texture_changes:
        print("Texture changes:")
        for change in texture_changes:
            print(f"- {change}")


if __name__ == "__main__":
    main()
