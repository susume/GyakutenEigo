"""Render a quick neutral preview of a GLB for visual QA."""

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("--asset", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(args.asset).resolve()))

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
centre = (minimum + maximum) / 2
dimensions = maximum - minimum
radius = max(dimensions) * 1.15

bpy.ops.object.camera_add(location=(centre.x + radius, centre.y - radius * 1.35, centre.z + radius * 0.75))
camera = bpy.context.object
camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera

bpy.ops.object.light_add(type="AREA", location=(centre.x - radius * 0.5, centre.y - radius * 0.7, centre.z + radius * 1.5))
key = bpy.context.object
key.data.energy = 950
key.data.shape = "DISK"
key.data.size = radius

bpy.ops.object.light_add(type="AREA", location=(centre.x + radius, centre.y + radius, centre.z + radius * 0.65))
fill = bpy.context.object
fill.data.energy = 500
fill.data.size = radius

bpy.ops.mesh.primitive_plane_add(size=radius * 5, location=(centre.x, centre.y, minimum.z - 0.01))
ground = bpy.context.object
ground_material = bpy.data.materials.new("preview_ground")
ground_material.diffuse_color = (0.16, 0.13, 0.1, 1)
ground.data.materials.append(ground_material)

world = bpy.context.scene.world
if world is None:
    world = bpy.data.worlds.new("preview_world")
    bpy.context.scene.world = world
world.color = (0.055, 0.065, 0.08)
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.render.resolution_x = 600
scene.render.resolution_y = 450
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(Path(args.output).resolve())
bpy.ops.render.render(write_still=True)
