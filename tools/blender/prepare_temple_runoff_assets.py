"""Build Temple Runoff's browser-ready GLB architecture from a CC0 ruin kit.

The source is Quaternius's Ultimate Modular Ruins Pack. This script extracts
only the motifs Temple Runoff needs, re-materials and recomposes them around
the existing authoritative collision proxies, grounds every asset at z=0,
and exports small embedded GLBs.

Usage:
  blender -b --python tools/blender/prepare_temple_runoff_assets.py -- \
    --input quaternius-ultimate-modular-ruins.glb \
    --output-dir apps/web/public/assets/arena/temple-runoff/architecture
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    return parser.parse_args(argv)


def material(name: str, color: tuple[float, float, float, float], roughness=0.86, metallic=0.0):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.use_nodes = True
    value.diffuse_color = color
    value.roughness = roughness
    value.metallic = metallic
    principled = value.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["Metallic"].default_value = metallic
    return value


STONE = lambda: material("Temple weathered stone", (0.31, 0.35, 0.25, 1))
SUN_STONE = lambda: material("Temple sun stone", (0.58, 0.47, 0.27, 1))
WET_STONE = lambda: material("Temple water-stained stone", (0.18, 0.25, 0.22, 1), 0.72)
MOSS = lambda: material("Temple moss", (0.20, 0.36, 0.20, 1), 0.94)
TIMBER = lambda: material("Temple repair timber", (0.25, 0.14, 0.075, 1), 0.9)
METAL = lambda: material("Temple oxidized sluice metal", (0.12, 0.19, 0.16, 1), 0.72, 0.38)
WATER = lambda: material("Temple runoff accent", (0.12, 0.55, 0.52, 1), 0.48)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_templates(source: Path):
    bpy.ops.import_scene.gltf(filepath=str(source))
    return {obj.name: obj for obj in bpy.context.scene.objects if obj.type == "MESH"}


def add_box(name, dimensions, location, surface, bevel=0.0, rotation_z=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=(0, 0, rotation_z))
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(value / 2 for value in dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(surface)
    if bevel:
        modifier = obj.modifiers.new("Rain-softened edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def add_cylinder(name, radius, depth, location, surface, vertices=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(surface)
    bevel = obj.modifiers.new("Worn rim", "BEVEL")
    bevel.width = min(0.16, depth * 0.12)
    bevel.segments = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj


def add_torus(name, major_radius, minor_radius, location, surface, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=16,
        minor_segments=6,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(surface)
    return obj


def source_piece(templates, source_name, name, target_height, location, surface, rotation_z=0.0):
    source = templates[source_name]
    obj = source.copy()
    obj.data = source.data.copy()
    bpy.context.collection.objects.link(obj)
    obj.name = name
    # Preserve the source kit's Y-up to Blender Z-up conversion while
    # discarding its contact-sheet position.
    transform = source.matrix_world.copy()
    transform.translation = Vector((0, 0, 0))
    obj.matrix_world = transform
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)
    minimum = Vector((
        min(vertex.co.x for vertex in obj.data.vertices),
        min(vertex.co.y for vertex in obj.data.vertices),
        min(vertex.co.z for vertex in obj.data.vertices),
    ))
    maximum = Vector((
        max(vertex.co.x for vertex in obj.data.vertices),
        max(vertex.co.y for vertex in obj.data.vertices),
        max(vertex.co.z for vertex in obj.data.vertices),
    ))
    obj.data.transform(Matrix.Translation(Vector((
        -(minimum.x + maximum.x) / 2,
        -(minimum.y + maximum.y) / 2,
        -minimum.z,
    ))))
    height = maximum.z - minimum.z
    factor = target_height / height
    obj.scale = (factor, factor, factor)
    obj.rotation_euler.z = rotation_z
    obj.location = location
    obj.data.materials.clear()
    obj.data.materials.append(surface)
    return obj


def keep_only(objects):
    keep = set(objects)
    for obj in list(bpy.context.scene.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)


def ground_and_center(objects):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    offset = Vector((-(minimum.x + maximum.x) / 2, -(minimum.y + maximum.y) / 2, -minimum.z))
    for obj in objects:
        obj.location += offset
    bpy.context.view_layer.update()


def triangle_count(objects):
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def merge_by_material(objects):
    groups = {}
    for obj in objects:
        key = obj.data.materials[0].name if obj.data.materials else "unmaterialed"
        groups.setdefault(key, []).append(obj)
    merged = []
    for group in groups.values():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in group:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        group[0].name = f"temple_{group[0].data.materials[0].name.lower().replace(' ', '_')}"
        merged.append(group[0])
    return merged


def dimensions(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return [round(value, 3) for value in maximum - minimum]


def export_asset(output: Path, objects):
    keep_only(objects)
    ground_and_center(objects)
    objects = merge_by_material(objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    return {
        "file": output.name,
        "dimensions_m": dimensions(objects),
        "triangles": triangle_count(objects),
        "bytes": output.stat().st_size,
    }


def build_rain_god(source: Path, output: Path):
    clear_scene()
    templates = import_templates(source)
    objects = [
        add_cylinder("rain_shrine_foundation", 4.25, 1.2, (0, 0, 0.6), WET_STONE(), 12),
        add_cylinder("rain_shrine_step", 3.65, 1.0, (0, 0, 1.6), STONE(), 12),
        add_box("rain_shrine_core", (5.2, 4.3, 7.2), (0, 0.25, 5.6), STONE(), 0.24),
        add_box("rain_shrine_crown", (6.1, 4.9, 1.0), (0, 0.25, 9.35), SUN_STONE(), 0.18),
        source_piece(templates, "Statue_Stag", "cc0_rain_guardian", 5.8, (0, -0.45, 9.65), STONE()),
        add_torus("ceremonial_rain_halo", 2.8, 0.26, (0, 0.4, 12.45), SUN_STONE(), (math.pi / 2, 0, 0)),
    ]
    for side in (-1, 1):
        objects.append(add_box(f"headdress_{side}", (1.0, 1.0, 4.2), (side * 2.55, 0.1, 11.45), SUN_STONE(), 0.12, side * 0.18))
        objects.append(add_box(f"water_channel_{side}", (0.42, 4.4, 0.3), (side * 1.55, -0.15, 2.25), WATER(), 0.06))
    objects.append(source_piece(templates, "Wall_Overgrown", "cc0_moss_relief", 3.2, (0, -2.04, 4.7), MOSS()))
    return export_asset(output, objects)


def build_sun_bridge(source: Path, output: Path):
    clear_scene()
    templates = import_templates(source)
    objects = [add_box("sun_bridge_walkable_deck", (22.32, 71.92, 0.7), (0, 0, 16.65), SUN_STONE(), 0.16)]
    for y in range(-33, 34, 6):
        objects.append(add_box(f"paving_joint_{y}", (21.8, 0.12, 0.06), (0, y, 16.98), WET_STONE(), 0.02))
    for x in (-10.65, 10.65):
        for y in range(-30, 31, 10):
            objects.append(add_box(f"deck_corbel_{x}_{y}", (0.8, 2.5, 1.2), (x, y, 15.95), STONE(), 0.1))
    for x in (-8.68, 8.68):
        for y in (-21.7, 21.7):
            objects.append(add_box(f"support_proxy_shell_{x}_{y}", (4.34, 4.96, 17), (x, y, 8.5), WET_STONE(), 0.22))
            objects.append(source_piece(templates, "Column_BridgeSupport", f"cc0_support_{x}_{y}", 15.8, (x, y, 0.5), STONE()))
    # These continuous parapet and altar shells exactly explain the existing
    # collision; source rails are shallow facade detail, not new cover.
    parapets = [(-11.78, -11.16, 2.48, 27.28), (11.78, 10.54, 2.48, 28.52)]
    for index, (x, y, width, depth) in enumerate(parapets):
        objects.append(add_box(f"parapet_shell_{index}", (width, depth, 4), (x, y, 19), STONE(), 0.14))
        for rail_y in (y - depth * 0.32, y, y + depth * 0.32):
            objects.append(source_piece(templates, "Rail_Straight", f"cc0_parapet_rail_{index}_{rail_y}", 2.9, (x - math.copysign(0.12, x), rail_y, 18.05), MOSS(), math.pi / 2))
    for index, (x, y) in enumerate(((-4.34, -9.92), (4.34, 9.92))):
        objects.append(add_box(f"altar_shell_{index}", (6.2, 5.58, 5), (x, y, 19.5), WET_STONE(), 0.2))
        objects.append(add_cylinder(f"altar_sun_disc_{index}", 1.35, 0.32, (x, y - 2.62, 20.4), SUN_STONE(), 16))
    for y in (-24.2, 24.2):
        for x in (-7.0, 7.0):
            objects.append(add_box(f"repair_timber_{x}_{y}", (0.52, 9.2, 0.52), (x, y, 11.0), TIMBER(), 0.06, 0.12 if x > 0 else -0.12))
    return export_asset(output, objects)


def build_gatehouse(source: Path, output: Path):
    clear_scene()
    templates = import_templates(source)
    objects = [
        add_box("gatehouse_central_mass", (11.5, 24.0, 13.2), (0, 0, 6.6), STONE(), 0.24),
        add_box("gatehouse_plinth", (17.36, 26.04, 3.2), (0, 0, 1.6), WET_STONE(), 0.2),
        add_box("gatehouse_crown_lower", (17.36, 26.04, 1.1), (0, 0, 13.35), SUN_STONE(), 0.16),
        add_box("gatehouse_crown_upper", (13.6, 23.0, 0.8), (0, 0, 14.45), STONE(), 0.14),
    ]
    for x in (-7.22, 7.22):
        objects.append(add_box(f"gatehouse_buttress_{x}", (2.92, 26.04, 14.2), (x, 0, 7.1), WET_STONE(), 0.22))
    for front in (-1, 1):
        for z in (4.0, 7.7, 11.3):
            objects.append(add_box(f"masonry_course_{front}_{z}", (11.3, 0.2, 0.28), (0, front * 12.02, z), SUN_STONE(), 0.04))
    for front in (-1, 1):
        objects.append(source_piece(templates, "Doors_RoundArch_Covered", f"cc0_sealed_gate_{front}", 10.2, (0, front * 12.92, 1.5), WET_STONE(), math.pi if front > 0 else 0))
        objects.append(source_piece(templates, "Wall_Overgrown", f"cc0_gate_moss_{front}", 5.4, (5.7, front * 13.0, 7.1), MOSS(), math.pi if front > 0 else 0))
    for x in (-7.3, 7.3):
        for y in (-11.4, 11.4):
            objects.append(source_piece(templates, "Column_Square", f"cc0_gate_column_{x}_{y}", 13.6, (x, y, 0.5), STONE()))
    return export_asset(output, objects)


def build_sluice(source: Path, output: Path):
    clear_scene()
    templates = import_templates(source)
    objects = [
        add_box("sluice_proxy_shell", (7.44, 17.36, 12), (0, 0, 6), WET_STONE(), 0.22),
        add_box("sluice_cap", (7.44, 17.36, 1.0), (0, 0, 11.45), STONE(), 0.14),
    ]
    for face in (-1, 1):
        objects.append(add_box(f"closed_sluice_recess_{face}", (0.16, 7.6, 6.5), (face * 3.73, 0, 4.2), WET_STONE(), 0.04))
        for y in (-3.45, 3.45):
            objects.append(add_box(f"sluice_jamb_{face}_{y}", (0.22, 0.7, 8.1), (face * 3.61, y, 4.3), STONE(), 0.08))
        objects.append(add_box(f"sluice_lintel_{face}", (0.22, 7.6, 1.0), (face * 3.61, 0, 7.55), SUN_STONE(), 0.08))
        for y in (-2.7, -1.35, 0, 1.35, 2.7):
            objects.append(add_box(f"sluice_bar_{face}_{y}", (0.24, 0.18, 5.7), (face * 3.84, y, 4.15), METAL(), 0.03))
    objects.append(source_piece(templates, "Wall_Overgrown", "cc0_sluice_overgrowth", 4.6, (0, -8.58, 6.8), MOSS()))
    return export_asset(output, objects)


def source_triangle_count(source: Path):
    clear_scene()
    templates = import_templates(source)
    return triangle_count(list(templates.values()))


def main():
    args = arguments()
    source = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    original_bytes = source.stat().st_size
    original_triangles = source_triangle_count(source)
    results = [
        build_rain_god(source, output_dir / "rain-god-shrine.glb"),
        build_sun_bridge(source, output_dir / "sun-bridge-shell.glb"),
        build_gatehouse(source, output_dir / "temple-gatehouse.glb"),
        build_sluice(source, output_dir / "sluice-headwall.glb"),
    ]
    print("TEMPLE_RUNOFF_ASSET_REPORT")
    print(json.dumps({
        "source": str(source),
        "source_bytes": original_bytes,
        "source_triangles": original_triangles,
        "assets": results,
        "optimized_total_bytes": sum(item["bytes"] for item in results),
        "optimized_total_triangles": sum(item["triangles"] for item in results),
    }, indent=2))


if __name__ == "__main__":
    main()
