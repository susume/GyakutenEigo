# Desert Citadel imported props

Runtime instancing multiplies the car and lamps by `3.25`, and the walk-in
bazaar stalls by `4.0`, to match the authored QuizStrike player body (5.02
world units tall). This keeps the realistic proportions while preventing
imported props from appearing miniature beside the playable characters.

Processed on 2026-08-14 with Blender 4.5.5 LTS using
`tools/blender/prepare_desert_citadel_prop.py`. All three assets are CC0:
commercial use, modification, and redistribution are allowed; attribution is
not required.

## Covered service car

- Asset: Covered Car
- Creator: MP
- Source: https://polyhaven.com/a/covered_car
- License: CC0 1.0, https://polyhaven.com/license
- Original format: Poly Haven 1K glTF with embedded PBR dependencies
- Original download size: 2,349,276 bytes
- Original dimensions: 1.789 × 4.3803 × 1.4111 m
- Original triangles: 12,592
- QuizStrike file: `covered-service-car.glb`
- QuizStrike size: 2,371,040 bytes
- Final dimensions: 1.797 × 4.4 × 1.4175 m
- Final triangles: 12,592
- Blender changes: removed helper objects, applied transforms, normalized the
  ground-centred pivot and width to the documented 4.4 m, embedded the 1K PBR
  textures, and normalized real-time roughness/metalness.

## Street lamp

- Asset: Street Lamp 01
- Creator: Josh Dean
- Source: https://polyhaven.com/a/street_lamp_01
- License: CC0 1.0, https://polyhaven.com/license
- Original format: Poly Haven 1K glTF with PBR dependencies
- Original download size: 2,166,163 bytes
- Original dimensions: 0.7043 × 0.3865 × 3.8706 m
- Original triangles: 30,610
- QuizStrike file: `street-lamp.glb`
- QuizStrike size: 2,813,004 bytes
- Final dimensions: 0.7097 × 0.3894 × 3.9 m
- Final triangles: 23,999
- Blender changes: removed helper objects, normalized the ground-centred pivot
  and height to the documented 3.9 m, embedded the 1K PBR textures, and reduced
  small unseen detail while preserving the cast-iron silhouette.

## Bazaar stall

- Asset: Stall 3
- Creator: Taha Arslan / ShareTextures
- Source: https://www.sharetextures.com/models/building/stall_3
- License: CC0 1.0, https://www.sharetextures.com/p/license
- Original format: Blender `.blend` plus 1K PBR texture set
- Original download size: 55,397,310-byte blend + 15,205,445-byte texture ZIP
- Original dimensions: 5.7904 × 4.0691 × 3.1884 m
- Original triangles: 604,830 (604,878 after adding the counter)
- QuizStrike file: `bazaar-stall.glb`
- QuizStrike size: 2,040,224 bytes
- Final dimensions: 5.7895 × 4.0768 × 3.1922 m
- Final triangles: 18,046
- Blender changes: relinked the official 1K base-color, normal, roughness and
  metallic maps; grounded and centred the pivot; added a restrained cedar
  counter with a 3.64-world-unit waist-height top that visually explains the
  market frontage; removed helper
  objects; decimated sub-pixel rope/cloth detail; and embedded JPEG-compressed
  PBR textures in one browser-ready GLB.
