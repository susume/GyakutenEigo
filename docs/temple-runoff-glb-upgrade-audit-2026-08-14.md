# Temple Runoff GLB upgrade audit — 2026-08-14

## Existing map and gameplay truth

Temple Runoff is a 470 × 400 authored-unit, three-layer arena. Shared/server
obstacles define movement and projectile truth; `templeRunoffMap.ts` mirrors
those rectangles/circles for client collision. Authored stair flights connect
the canal (0), main temple level (8), and upper bridge/terraces (17). The
existing tests protect spawn sightlines, staggered canal cover, bridge cover,
under-bridge traversal, stairs, and client/server collision parity.

Those coordinates, floors, stair flights, spawn screens, cover positions, and
authoritative obstacles remain unchanged by this art pass.

## Presentation audit

- The Rain God landmark was visibly assembled from boxes, cones, and a cylinder.
- The Sun Bridge deck and cover read as modular boxes, with primitive cylinders and planks providing most of its story detail.
- Temple gatehouses and sluice mouths were solid rectangular masses without convincing masonry construction or hydraulic detail.
- The existing instanced edge vegetation and inexpensive waterfall planes were efficient and worth retaining.
- Gameplay-important blocks were already suitable collision proxies, but Temple Runoff lacked the Citadel-style imported-asset/fallback layer.

## Replacement classification

| Element | Classification | Decision |
| --- | --- | --- |
| Spawns, stairs, floors, canal cover, bridge cover | Gameplay geometry | Preserve exactly |
| Rain God cylinder | Gameplay collision + weak procedural visual | Hide visual; retain circle proxy; replace with GLB shrine |
| Bridge supports/parapets/altars | Gameplay collision + weak procedural visual | Hide visual; retain rectangles; replace with one GLB shell |
| Bridge deck | Traversable floor visual | Keep procedural deck as loading fallback; hide after GLB success |
| Red/Blue gatehouses | Gameplay collision + weak procedural visual | Hide visual; retain rectangles; reuse one mirrored GLB |
| East/West sluice mouths | Gameplay collision + weak procedural visual | Hide visual; retain rectangles; reuse one mirrored GLB |
| Edge vegetation and waterfalls | Visual-only and efficient | Retain hybrid procedural system |
| Minor trees, lamps, fallen idol, shrine arch | Visual-only landmarks | Retain; no indiscriminate prop expansion |

## Scale and collision

Blender outputs use QuizStrike world units at runtime scale 1. The player body
is 5.02 units high. The 15-unit gatehouse is therefore about three player
heights, while the 15.45-unit Rain God remains a strong multi-route landmark.
The bridge deck top remains exactly y=17 and its shell preserves the full
walkable width. The canal remains open at y=0 under the bridge.

Imported meshes are visual-only. Every structural replacement has a simple
authoritative proxy and a readable load-failure fallback. Covered/closed doors
and sluice grates deliberately avoid advertising false openings.

## Review viewpoints

With Temple Runoff open in FPS debug mode, append `templeView=<id>` to the URL:

- `blue-temple`
- `red-temple`
- `sun-bridge`
- `lower-canal`
- `rain-god`
- `jungle-ruins`
- `upper-terrace`
- `sluice-tunnels`

Each preset starts at actual QuizStrike FPS eye height and looks toward the
named landmark. They are debug-only and never override a normal match spawn.
