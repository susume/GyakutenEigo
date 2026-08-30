# Athletics Adventure Park asset manifest

Updated 2026-08-30.

This manifest covers the external 3D assets shipped with the compact Skyline
Adventure Park redesign. The assets are scenery: authoritative movement still
uses the authored platform rectangles and moving obstacle proxies in
`packages/shared/src/athleticsRace.ts`.

## License verification

| Asset family | Creator | Source | License | License URL | Verified |
| --- | --- | --- | --- | --- | --- |
| Ferris Wheel | CreativeTrio | [Poly Pizza asset page](https://poly.pizza/m/6CepsZjXBw) · [direct GLB](https://static.poly.pizza/e05d9829-a115-4fcd-93c4-172a964eee16.glb) | Public Domain / CC0 as listed by the source | [Poly Pizza asset license](https://poly.pizza/m/6CepsZjXBw) | 2026-08-30 |
| Coaster Kit pieces | Kenney | [Kenney Coaster Kit](https://kenney.nl/assets/coaster-kit) | Creative Commons Zero (CC0 1.0) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 2026-08-30 |

The downloaded Kenney package included its own `License.txt`; it grants
personal, educational, and commercial use under CC0. Attribution is not
required, but the project credits Kenney in this manifest. The Ferris Wheel
source page identifies the model as Public Domain/CC0 and credits CreativeTrio.

## Shipped outputs

Every output below is a GLB under
`apps/web/public/assets/athletics/`. Triangle counts and texture sizes are
from the repository Blender validation pass on the exported output.

| Runtime file | Intended use | Original source | Blender-exported size | Local bounds (W × H × D) | Triangles | Textures |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `creative-trio-ferris-wheel.glb` | Grounded hero Ferris wheel landmark at the Ferris & Coaster chapter | 841,568 B | 862,444 B | 1.005 × 1.135 × 0.208 | 10,672 | None; the source contained an empty image slot, so the mesh-only export avoids a broken texture request |
| `kenney-park-entrance.glb` | Entrance silhouette behind the tutorial start pad | 85,968 B | 68,124 B | 3.085 × 1.155 × 2.435 | 942 | 512 × 512 colormap |
| `kenney-stall-food.glb` | Midway carnival stall | 36,308 B | 33,784 B | 1.042 × 1.2 × 1.545 | 380 | 512 × 512 colormap |
| `kenney-stall-drinks.glb` | Midway carnival stall variant | 26,052 B | 26,720 B | 1.0 × 1.2 × 1.88 | 274 | 512 × 512 colormap |
| `kenney-coaster-steel-straight.glb` | Coaster maintenance deck segments | 48,484 B | 42,280 B | 0.7 × 4.0 × 0.3 | 564 | 512 × 512 colormap |
| `kenney-coaster-steel-curve.glb` | Coaster turn segment | 58,320 B | 49,076 B | 2.7 × 4.0 × 0.3 | 684 | 512 × 512 colormap |
| `kenney-coaster-train.glb` | Coaster recognition and moving-cart read | 60,428 B | 50,492 B | 0.7 × 1.3 × 0.617 | 668 | 512 × 512 colormap |
| `kenney-support-large.glb` | Two non-collidable coaster support silhouettes stretched from floor to track | 5,692 B | 12,864 B | 0.479 × 0.479 × 1.0 | 44 | 512 × 512 colormap |

The resulting runtime set is 1,145,784 bytes across eight GLBs. The larger
Ferris model is loaded only for the Athletics scene; it is not part of the
initial QuizStrike page bundle.

## Blender preparation

The source GLBs were downloaded into a temporary working directory, inspected,
and passed through the existing repository scripts:

```text
tools/blender/export_quizstrike_asset.py
tools/blender/validate_quizstrike_asset.py
```

For each asset the pipeline:

1. imported the GLB into Blender 4.5.3 LTS;
2. removed non-mesh scene objects and applied source rotation/scale transforms;
3. normalized roughness/metalness within the exporter’s stylized-web limits;
4. preserved/packed available textures and enforced a 2K maximum texture cap;
5. checked triangle count, material count, UVs, applied scale, and generic names;
6. exported a browser-ready GLB.

None of these assets exceeded the 50,000-triangle export budget, so no
decimation was necessary. Kenney’s source atlases remain 512 × 512 because
they are intentionally small flat-color atlases; they are not upscaled. The
Ferris source advertised an image slot with no image data, so the processed
output is deliberately mesh-only rather than shipping a broken texture.

## Runtime integration and collision boundary

`apps/web/src/game/athleticsImportedAssets.ts` mounts the assets lazily after
the Athletics scene is created. The Ferris mesh is scaled to approximately
52 world units wide and placed at `(-72, 35.2, 28)` so its measured local
minimum Y reaches the floor. The coaster track pieces sit at approximately
`y=42–46`; their support assets use an authored `[4.1, 42, 4.1]` scale vector
from `y=0` to the track deck. Stalls are placed at `y=0` beside the low midway.
Low-detail/performance settings skip selected secondary coaster pieces, and
every load is optional: if a GLB fails, the named procedural fallback remains
visible and the race continues.

The imported roots are visual-only. The park does not derive collision from
GLB triangles. Main platforms, three shortcuts, six moving obstacles, and the
park boundary are simple authored collision proxies shared by the server and
client. Rectangular platform proxies retain their authored `rotationY` and the
client uses the same oriented footprint for support/blocking checks.
Decorative stalls, Ferris geometry, coaster pieces, and supports do not add
physics bodies.

## Credits

* Ferris Wheel: CreativeTrio via Poly Pizza, Public Domain/CC0.
* Coaster Kit pieces: Kenney, CC0 1.0.
* QuizStrike’s authored course, platform edge treatment, chapter signs,
  lighting, fallback structures, and collision proxies remain project-owned.
