# Blender asset pipeline for QuizStrike

This is the repeatable workflow for adding a map asset. The pilot now uses
Blender for the Iron Junction control-tower hero asset and keeps the official
Kenney GLBs as curated source pieces. Blender is the place to author silhouette,
materials, texture atlases, and export settings before the asset reaches the
browser.

## 1. Find and verify the asset

Prefer Kenney, Poly Haven, or another source with a clear reusable license.
Record the exact source page, creator, license, download date, original format,
and any attribution requirements in `assets/**/SOURCE.md`. Do not use a ripped
game model or a download with unclear ownership.

## 2. Import into Blender

1. Open Blender and choose **File → Import → glTF 2.0 (.glb/.gltf)** for a GLB.
2. For FBX/OBJ sources, import the original format first, then save a working
   `.blend` file beside the source notes.
3. Select the imported root and apply rotation, scale, and location.

## 3. Normalize the model

- Use meters and keep Z up.
- Make the forward axis consistent with the map; Iron Junction rail vehicles
  point along the track.
- Put the origin at the ground contact / useful placement pivot.
- Remove hidden interiors, duplicate cameras, unused lights, and unseen pieces.
- Keep the silhouette and contact shadows; remove tiny geometry that will never
  be visible on a Chromebook.

## 4. Normalize materials and textures

- Consolidate materials where possible.
- Keep roughness moderate and metalness restrained.
- Use 1K for gameplay-facing pieces and 2K for hero architecture or major
  landmarks when the detail is visible from first-person distance.
- Reuse shared atlases and material families. Do not downscale by default;
  measure download size and frame time first.
- Do not upscale a flat 512px source atlas just to claim a 1K texture. If a
  hero needs more detail, author or bake a dedicated 1K–2K atlas in Blender.
- Use a clean industrial palette: steel, concrete, rust, amber warning paint,
  and limited team accents.
- Add a simple QuizStrike sign, number, route stripe, or decal when it improves
  location communication.

## 5. Export

Run the helper scripts from the repository root:

```text
blender -b --python tools/blender/validate_quizstrike_asset.py -- --asset path/to/asset.glb
blender -b --python tools/blender/export_quizstrike_asset.py -- --input path/to/asset.glb --output apps/web/public/assets/arena/iron-junction/asset.glb

blender -b --python tools/blender/create_iron_junction_control_tower.py -- \
  --output apps/web/public/assets/arena/iron-junction/iron-junction-control-tower.glb \
  --texture-dir tools/blender/generated-textures
```

`export_quizstrike_asset.py` applies transforms, embeds source images, keeps
textures at their authored size unless they exceed the explicit cap, and adds a
light decimation pass only when the triangle budget is exceeded. Use
`--upscale-small-textures` only for an asset with meaningful baked detail.

## 6. Add it to the game

1. Add the GLB and a `SOURCE.md` entry under the map-specific public asset
   directory.
2. Add a small manifest entry to the pilot map module.
3. Place the visual model in the map-specific imported-asset module.
4. Keep collision in the shared map definition as a box, cylinder, or other
   cheap proxy. Never use a detailed GLB mesh for multiplayer collision.
5. Use a cached loader and clone the loaded scene for repeated instances.

## 7. Validate in play

Check low, medium, and high quality. Confirm that the model does not block
objectives, spawn exits, sightlines, stairs, or bot routes. Capture an overview
and first-person view from the same locations as the before screenshots. Record
draw calls, triangles, textures, frame-time percentiles, and map download size.

If a GLB fails to load, the procedural map must remain playable and readable.
