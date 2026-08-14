# Temple Runoff architecture source

## Source asset

- Asset: Ultimate Modular Ruins Pack
- Creator: Quaternius
- Official source: https://quaternius.com/packs/ultimatemodularruins.html
- Redistribution used for processing: https://poly.pizza/m/F2LAK03B0r
- Licence: CC0 1.0 / public domain dedication
- Licence checked: 2026-08-14
- Official source formats: FBX, OBJ, Blend
- Processing source format: GLB
- Processing source size: 7,965,364 bytes
- Processing source contact-sheet dimensions: 49.071 × 51.902 × 6.940 m
- Processing source measured triangle count: 141,198

The official Quaternius page identifies the pack as CC0 and permits personal
and commercial use. The Poly Pizza redistribution identifies the same creator,
pack, and CC0 status. QuizStrike does not ship the source contact sheet; it
ships only the four recomposed GLBs below.

## Optimized QuizStrike outputs

| Output | Purpose | Dimensions | Triangles | Size |
| --- | --- | ---: | ---: | ---: |
| `rain-god-shrine.glb` | Rain Court navigation landmark and readable cylinder-proxy shell | 8.500 × 8.500 × 15.510 m | 6,052 | 276,416 bytes |
| `sun-bridge-shell.glb` | Walkable bridge deck, collision-aligned supports/parapets/altars, restrained timber repairs | 28.176 × 71.920 × 22.000 m | 9,484 | 495,216 bytes |
| `temple-gatehouse.glb` | Reused sealed monumental gatehouse for both team complexes | 17.360 × 26.827 × 14.850 m | 10,220 | 618,320 bytes |
| `sluice-headwall.glb` | Reused closed drainage headwall with wet stone and oxidized grate details | 7.920 × 17.612 × 12.000 m | 2,250 | 141,360 bytes |

Optimized total: 1,531,312 bytes and 28,006 triangles. Runtime placement uses
four unique cache URLs for six instances: gatehouses and sluices share parsed
geometry and materials. Same-material Blender joins reduce each GLB to 5–6
mesh/material draws before renderer-level batching and culling.

## Blender changes

Generated with Blender 4.5.9 LTS and
`tools/blender/prepare_temple_runoff_assets.py`:

- removed the source contact-sheet camera, light, cube, root, and unused meshes;
- extracted only the guardian, covered-door, column, rail, support, overgrown-wall, and masonry motifs needed by the map;
- rebuilt each asset around the existing QuizStrike collision dimensions;
- applied transforms and corrected the Y-up source orientation;
- grounded and centered every export pivot;
- recomposed the source motifs into Temple-specific hydraulic architecture;
- replaced the source palette with a small wet-stone, moss, sun-stone, timber, oxidized-metal, and runoff material set;
- used low-segment bevels only on silhouette-relevant rain-eroded edges;
- joined same-material pieces to keep architectural detail draw-efficient;
- exported embedded binary GLB without cameras or lights.
