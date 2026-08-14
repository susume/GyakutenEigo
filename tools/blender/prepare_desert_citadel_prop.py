"""Prepare one sourced Desert Citadel prop for browser delivery.

This map-specific pass keeps the source asset's real-world proportions, moves
its pivot to ground centre, relinks an optional 1K texture directory, and
exports an embedded GLB.  The market-stall mode also adds a simple timber
counter so the existing cheap collision proxy has a visible explanation.

Usage:
  blender -b --python tools/blender/prepare_desert_citadel_prop.py -- \
    --input source.gltf --output prop.glb --kind vehicle --target-width 4.4
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--kind", choices=("vehicle", "street_lamp", "market_stall"), required=True)
    parser.add_argument("--texture-dir")
    parser.add_argument("--target-width", type=float)
    parser.add_argument("--target-height", type=float)
    parser.add_argument("--max-triangles", type=int, default=50000)
    return parser.parse_args(argv)


def load_source(source: Path):
    if source.suffix.lower() == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(source))
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        if source.suffix.lower() in {".gltf", ".glb"}:
            bpy.ops.import_scene.gltf(filepath=str(source))
        elif source.suffix.lower() == ".fbx":
            bpy.ops.import_scene.fbx(filepath=str(source), automatic_bone_orientation=True)
        else:
            raise SystemExit("Supported inputs: .blend, .gltf, .glb, .fbx")


def relink_images(texture_dir: Path | None):
    if not texture_dir:
        return []
    candidates = [path for path in texture_dir.rglob("*") if path.is_file()]
    relinked = []
    for image in bpy.data.images:
        if image.source != "FILE":
            continue
        image_key = "".join(character.lower() for character in image.name if character.isalnum())
        best = None
        for candidate in candidates:
            candidate_key = "".join(character.lower() for character in candidate.stem if character.isalnum())
            if candidate_key in image_key or image_key in candidate_key:
                best = candidate
                break
        if not best:
            continue
        image.filepath = str(best)
        image.reload()
        image.pack()
        relinked.append(f"{image.name} -> {best.name}")
    return relinked


def detach_meshes_and_remove_helpers():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in meshes:
        matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = matrix
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    return meshes


def world_bounds(meshes):
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def normalize_scale_and_pivot(meshes, target_width: float | None, target_height: float | None):
    minimum, maximum = world_bounds(meshes)
    dimensions = maximum - minimum
    if target_width:
        horizontal = max(dimensions.x, dimensions.y)
        factor = target_width / horizontal
    elif target_height:
        factor = target_height / dimensions.z
    else:
        factor = 1.0
    for obj in meshes:
        obj.location *= factor
        obj.scale *= factor
    bpy.context.view_layer.update()
    minimum, maximum = world_bounds(meshes)
    offset = Vector((-(minimum.x + maximum.x) / 2, -(minimum.y + maximum.y) / 2, -minimum.z))
    for obj in meshes:
        obj.location += offset
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")
    return factor


def timber_material():
    material = bpy.data.materials.new("QuizStrike weathered cedar")
    material.use_nodes = True
    material.diffuse_color = (0.22, 0.09, 0.035, 1)
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = (0.22, 0.09, 0.035, 1)
        principled.inputs["Roughness"].default_value = 0.78
        principled.inputs["Metallic"].default_value = 0.0
    return material


def add_market_counter(meshes):
    material = timber_material()

    def add_box(name, location, scale):
        bpy.ops.mesh.primitive_cube_add(location=location)
        box = bpy.context.object
        box.name = name
        box.data.name = name
        box.scale = (scale[0] / 2, scale[1] / 2, scale[2] / 2)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        box.data.materials.append(material)
        meshes.append(box)

    # Keep the counter at a comfortable waist height after the stall's 4x
    # runtime scale. Its top surface lands at 3.64 world units instead of 4.2.
    add_box("market_counter_top", (0, 0, 0.84), (5.05, 1.05, 0.14))
    add_box("market_counter_front", (0, -0.47, 0.42), (5.05, 0.11, 0.70))
    for x in (-2.25, 2.25):
        add_box("market_counter_leg", (x, 0, 0.40), (0.16, 0.78, 0.74))


def triangle_count(meshes):
    total = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def decimate_to_budget(meshes, budget):
    before = triangle_count(meshes)
    if before <= budget:
        return before, before
    ratio = max(0.01, budget / before)
    for obj in meshes:
        if len(obj.data.polygons) < 24:
            continue
        modifier = obj.modifiers.new("QuizStrike real-time decimation", "DECIMATE")
        modifier.ratio = ratio
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    return before, triangle_count(meshes)


def normalize_materials(meshes):
    for obj in meshes:
        for material in obj.data.materials:
            if not material:
                continue
            material.roughness = max(0.52, material.roughness)
            material.metallic = min(0.72, material.metallic)


def main():
    args = arguments()
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    load_source(source)
    relinked = relink_images(Path(args.texture_dir).resolve() if args.texture_dir else None)
    meshes = detach_meshes_and_remove_helpers()
    if not meshes:
        raise SystemExit("The source contains no mesh objects")
    original_minimum, original_maximum = world_bounds(meshes)
    original_dimensions = original_maximum - original_minimum
    scale_factor = normalize_scale_and_pivot(meshes, args.target_width, args.target_height)
    if args.kind == "market_stall":
        add_market_counter(meshes)
    normalize_materials(meshes)
    original_triangles, final_triangles = decimate_to_budget(meshes, args.max_triangles)
    final_minimum, final_maximum = world_bounds(meshes)
    final_dimensions = final_maximum - final_minimum
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="JPEG",
        export_jpeg_quality=82,
        export_cameras=False,
        export_lights=False,
    )
    print(json.dumps({
        "input": str(source),
        "output": str(output),
        "kind": args.kind,
        "original_dimensions_m": [round(value, 4) for value in original_dimensions],
        "final_dimensions_m": [round(value, 4) for value in final_dimensions],
        "scale_factor": round(scale_factor, 6),
        "original_triangles": original_triangles,
        "final_triangles": final_triangles,
        "relinked_images": relinked,
    }, indent=2))


if __name__ == "__main__":
    main()
