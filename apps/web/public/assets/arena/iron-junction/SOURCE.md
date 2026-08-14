# Iron Junction pilot asset provenance

These files are curated from Kenney's official CC0 asset packs. The source
packs include the original license files beside this document.

## Kenney Train Kit 1.1

- Creator: Kenney (additional credits: Guus Vermeulen, Tony Schaer)
- Source: https://kenney.nl/assets/train-kit
- License: Creative Commons Zero (CC0 1.0)
- Commercial use: allowed
- Modification: allowed
- Attribution: not required; QuizStrike keeps the creator credit for clarity
- Original format: FBX plus a GLB export in the official pack
- QuizStrike format: GLB
- QuizStrike changes: curated only the locomotive, boxcar, and blue/red container
  carriage models; runtime material roughness is normalized; models are scaled
  and oriented at the map integration point; collision remains the existing
  simple procedural box proxy.
- Acquired: 2026-08-14

Files:

| File | Source bytes | Runtime bytes |
| --- | ---: | ---: |
| `kenney-train-locomotive-a.glb` | 154,620 | 154,620 |
| `kenney-train-carriage-box.glb` | 98,768 | 98,768 |
| `kenney-train-carriage-container-blue.glb` | 116,192 | 116,192 |
| `kenney-train-carriage-container-red.glb` | 116,192 | 116,192 |

## Kenney Factory Kit 3.0

- Creator: Kenney
- Source: https://kenney.nl/assets/factory-kit
- License: Creative Commons Zero (CC0 1.0)
- Commercial use: allowed
- Modification: allowed
- Attribution: not required; QuizStrike keeps the creator credit for clarity
- Original format: FBX plus a GLB export in the official pack
- QuizStrike format: GLB
- QuizStrike changes: curated the crane hero piece; runtime materials are
  normalized; scale/orientation are authored for the maintenance depot; the
  existing procedural collision proxy is retained.
- Acquired: 2026-08-14

| File | Source bytes | Runtime bytes |
| --- | ---: | ---: |
| `kenney-factory-crane.glb` | 53,396 | 53,396 |

The source pack's official `License.txt` files are preserved as
`KENNEY_TRAIN_LICENSE.txt` and `KENNEY_FACTORY_LICENSE.txt`.

Both packs use the same shared color atlas. It remains at its native
512x512 resolution in `Textures/colormap.png` (12,684 bytes), because this flat
stylized atlas gains no meaningful visual detail from upscaling. The original
source copy is preserved as `Textures/colormap-source-512.png`; the runtime
loader and browser cache reuse one atlas URL for all four Kenney train assets.

## QuizStrike-authored Blender control tower

- Creator: QuizStrike project, authored in Blender 4.5.5 LTS
- Source: `tools/blender/create_iron_junction_control_tower.py`
- License: QuizStrike project-authored asset
- Original format: Blender Python-generated mesh and material atlas
- QuizStrike format: GLB with an embedded JPEG albedo texture
- QuizStrike changes: modeled the control-room silhouette, glazed windows,
  structural pylons, warning rails, roof signal mast, and signal lights. The
  asset is visual-only; existing map collision boxes remain authoritative.
- Hero texture: 2048x2048 baked industrial albedo, JPEG quality 88

| File | Runtime bytes |
| --- | ---: |
| `iron-junction-control-tower.glb` | 1,499,504 |

The hero working texture is retained at
`tools/blender/generated-textures/iron-junction-control-tower-albedo-2k.jpg`
for review and regeneration; the browser uses the embedded GLB copy.

Total pilot runtime payload for six GLBs plus the shared 512px atlas is
2,051,356 bytes, excluding source licenses and development-only texture files.
