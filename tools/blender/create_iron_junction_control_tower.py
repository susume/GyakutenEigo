"""Create the Iron Junction control-tower hero asset in Blender.

This is intentionally a small, readable landmark rather than a replacement
for the whole map.  It creates a glazed control room, steel frame, roof signal
mast, warning rails, and an authored 2K industrial albedo atlas.  The exported
GLB is visual-only; the existing map collision boxes remain authoritative.

Usage:
  blender -b --python create_iron_junction_control_tower.py -- \
    --output apps/web/public/assets/arena/iron-junction/iron-junction-control-tower.glb \
    --texture-dir apps/web/public/assets/arena/iron-junction/Textures
"""

import argparse
import math
import sys
from array import array
from pathlib import Path

import bpy


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--texture-dir", required=True)
    return parser.parse_args(argv)


def make_atlas(name, width, height, palette, seed):
    """Generate a compact baked industrial atlas without external textures."""
    image = bpy.data.images.new(name, width=width, height=height, alpha=False)
    values = array("f", [0.0]) * (width * height * 4)
    for y in range(height):
        for x in range(width):
            band = (x * 7 + y * 3 + seed) % 37
            cell = ((x // 12) * 37 + (y // 12) * 17 + seed) % 29
            noise = (cell / 28.0 - 0.5) * 0.055
            base = palette[0] if band < 25 else palette[1]
            stripe = 0.12 if ((x + y) // 38) % 2 == 0 and 0.28 < (y / height) < 0.72 else 0.0
            index = (y * width + x) * 4
            values[index] = max(0.0, min(1.0, base[0] + noise + stripe))
            values[index + 1] = max(0.0, min(1.0, base[1] + noise + stripe * 0.72))
            values[index + 2] = max(0.0, min(1.0, base[2] + noise + stripe * 0.42))
            values[index + 3] = 1.0
    image.pixels.foreach_set(values)
    image.pack()
    return image


def material(name, image=None, color=(0.3, 0.35, 0.34, 1), metallic=0.3, roughness=0.7, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        shader.inputs["Emission Color"].default_value = emission
        shader.inputs["Emission Strength"].default_value = 3.2
    if image:
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image
        texture.interpolation = "Linear"
        links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return mat


def add_box(name, dimensions, location, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Authored edge bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def add_cylinder(name, radius, depth, location, mat, vertices=12, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation or (0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def build_scene(texture_dir):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0

    texture_dir = Path(texture_dir)
    texture_dir.mkdir(parents=True, exist_ok=True)
    atlas = make_atlas(
        "iron_junction_control_tower_albedo_2k",
        2048,
        2048,
        ((0.18, 0.23, 0.23), (0.28, 0.31, 0.29)),
        seed=41,
    )
    atlas.filepath_raw = str(texture_dir / "iron-junction-control-tower-albedo-2k.jpg")
    atlas.file_format = "JPEG"
    atlas.save(quality=88)
    atlas.pack()

    steel = material("IJ Tower / Weathered Steel", atlas, metallic=0.72, roughness=0.63)
    dark = material("IJ Tower / Structural Dark Steel", color=(0.06, 0.08, 0.08, 1), metallic=0.82, roughness=0.54)
    concrete = material("IJ Tower / Warm Concrete", color=(0.46, 0.44, 0.37, 1), metallic=0.02, roughness=0.82)
    glass = material("IJ Tower / Signal Glass", color=(0.06, 0.28, 0.34, 1), metallic=0.08, roughness=0.17)
    amber = material("IJ Tower / Amber Signal", color=(0.98, 0.32, 0.08, 1), metallic=0.25, roughness=0.38, emission=(1.0, 0.12, 0.02, 1))
    warning = material("IJ Tower / Warning Paint", color=(0.95, 0.48, 0.06, 1), metallic=0.2, roughness=0.48)

    root = bpy.data.collections.new("iron_junction_control_tower")
    bpy.context.scene.collection.children.link(root)
    def move_to_root(obj):
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        root.objects.link(obj)
        return obj

    # Main silhouette: a 34 x 20 x 20 raw-unit tower that fits the existing
    # 34 x 32 collision footprint at the control landmark.
    for obj in [
        add_box("ijct_base", (31.0, 17.0, 8.0), (0, 4.0, 0), concrete, bevel=0.35),
        add_box("ijct_control_room", (33.0, 18.5, 7.0), (0, 13.2, 0), steel, bevel=0.28),
        add_box("ijct_roof_cap", (35.0, 20.0, 1.4), (0, 17.4, 0), dark, bevel=0.24),
    ]:
        move_to_root(obj)

    # Front glazing faces the approach from the yard (-Z).
    for index, x in enumerate((-12.0, -4.0, 4.0, 12.0)):
        move_to_root(add_box(f"ijct_front_window_{index}", (6.2, 4.4, 0.28), (x, 13.0, -9.45), glass, bevel=0.08))
        move_to_root(add_box(f"ijct_window_mullion_{index}", (0.22, 4.8, 0.42), (x + 3.25, 13.0, -9.7), dark, bevel=0.03))

    # Structural corners, warning rails, and a readable roof silhouette.
    for index, x in enumerate((-16.0, 16.0)):
        move_to_root(add_box(f"ijct_corner_pylon_{index}", (1.5, 19.0, 1.5), (x, 9.0, 0), dark, bevel=0.12))
        move_to_root(add_box(f"ijct_side_warning_{index}", (1.2, 7.0, 0.32), (x * 0.94, 11.8, -9.55), warning, bevel=0.04))
    for x in (-14.5, -7.25, 0.0, 7.25, 14.5):
        move_to_root(add_box(f"ijct_roof_rail_{x}", (0.26, 2.1, 0.26), (x, 19.0, -8.8), warning, bevel=0.04))
    move_to_root(add_box("ijct_roof_rail_front", (30.0, 0.26, 0.26), (0, 19.0, -8.8), warning, bevel=0.04))

    # Roof signal mast and twin lights create a landmark from long sightlines.
    move_to_root(add_box("ijct_signal_mast", (1.2, 9.0, 1.2), (0, 22.0, 0), dark, bevel=0.1))
    move_to_root(add_box("ijct_signal_arm", (12.0, 0.8, 0.8), (0, 25.4, 0), warning, bevel=0.1))
    for index, x in enumerate((-4.0, 4.0)):
        move_to_root(add_cylinder(f"ijct_signal_light_{index}", 1.05, 0.7, (x, 24.0, -0.6), amber, vertices=16, rotation=(math.pi / 2, 0, 0)))

    # Small service details reward close approach without becoming clutter.
    for index, y in enumerate((3.0, 6.0, 9.0, 12.0, 15.0)):
        move_to_root(add_box(f"ijct_ladder_step_{index}", (5.0, 0.24, 0.34), (-18.1, y, 0), warning, bevel=0.04))
    move_to_root(add_box("ijct_ladder_left", (0.28, 15.0, 0.28), (-20.5, 9.0, 0), dark, bevel=0.04))
    move_to_root(add_box("ijct_ladder_right", (0.28, 15.0, 0.28), (-15.7, 9.0, 0), dark, bevel=0.04))

    bpy.context.scene["quizstrike_asset"] = "iron-junction-control-tower"
    bpy.context.scene["quizstrike_texture_policy"] = "hero albedo 2K; do not downscale by default"
    return root


def main():
    args = arguments()
    output = Path(args.output)
    texture_dir = Path(args.texture_dir)
    texture_dir.mkdir(parents=True, exist_ok=True)
    build_scene(texture_dir)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_image_format="AUTO",
    )
    print(f"Created Blender hero asset: {output}")
    print(f"Texture policy: {bpy.context.scene.get('quizstrike_texture_policy')}")


if __name__ == "__main__":
    main()
