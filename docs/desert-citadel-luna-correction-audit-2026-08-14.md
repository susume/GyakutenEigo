# Desert Citadel Luna correction audit — 2026-08-14

## Audit scope

This audit covers the Desert Citadel overview and the Ground, Citadel, and
Lookout first-person test states shown in the four screenshots supplied by the
user. The goal is a readable competitive map where visible geometry agrees
with gameplay collision and decorative elements never masquerade as objectives,
cover, or navigation UI.

## Overall verdict

The previous pass introduced a second visual layer that was not tied to the
authored map manifest. It made the arena less trustworthy: solid-looking doors
and buildings had no collision, large signs overrode the existing no-label
rule, duplicated props interrupted sightlines, and exterior cone meshes read as
floating triangles. The correction removes that freestanding layer and keeps
only shallow construction detail attached to the perimeter walls.

## Numbered flow audit

1. **Overview — unhealthy before, healthy after.**
   - Before: four large cone/mesa meshes floated beyond the map shell and had no
     gameplay meaning. The extra rampart asset also replaced visuals at a
     different position from its authoritative collision block.
   - Fix: removed distant terrain and stopped mounting the imported rampart
     model. The overview now contains only the authored map footprint, grounded
     dunes, and manifest-backed structures.
   - Evidence: user screenshot `Screenshot 2026-08-14 092957.png`; corrected
     capture `.codex-map-audit/2026-08-14-luna-correction/01-overview.png`.

2. **Ground route — unhealthy before, healthy after.**
   - Before: a solid gate/door panel and duplicated market structure sat in the
     route but were decorative only. Players could walk through geometry that
     looked impassable.
   - Fix: removed all art-pass gates, market stalls, houses, pottery, and the
     duplicate cistern canopy. Ground combat now uses the same visible cover
     that supplies collision.
   - Evidence: user screenshot `Screenshot 2026-08-14 093328.png`; corrected
     capture `.codex-map-audit/2026-08-14-luna-correction/02-ground.png`.

3. **Citadel route — unhealthy before, healthy after.**
   - Before: a large `DRY CISTERN` billboard was visible from the rear, so its
     text rendered backwards. It also violated the explicit no-area-label rule.
   - Fix: removed the entire 3D district-sign system and added regression tests
     requiring all Desert Citadel blocks, cylinders, floor marks, and sign arrays
     to remain label-free.
   - Evidence: user screenshot `Screenshot 2026-08-14 093436.png`; corrected
     capture `.codex-map-audit/2026-08-14-luna-correction/03-citadel.png`.

4. **Central landmark and Lookout — poor before, healthy after.**
   - Before: the pink sundial core read as a large arbitrary silo and blocked a
     disproportionate part of the view. The imported upper-rampart model hid a
     fallback collider at a different position.
   - Fix: reduced the non-colliding sundial core from a five-unit radius to a
     narrow 1.25-unit stone gnomon and removed the imported model mount. The
     authoritative sundial ring, Crown cover, stairs, and parapets are unchanged.
   - Evidence: user screenshot `Screenshot 2026-08-14 093510.png`; corrected
     capture `.codex-map-audit/2026-08-14-luna-correction/04-lookout.png`.

## UX and accessibility findings

- **Trust:** visible obstacles must match collision. The removed decorative
  doors/buildings failed this basic game-space contract.
- **Hierarchy:** district billboards dominated the weapon view and minimap even
  though they were not objectives. Removing them restores combat hierarchy.
- **Clarity:** decorative cones outside the shell resembled markers or broken
  geometry. Their removal eliminates false affordances.
- **Contrast:** the retained wall courses and recessed openings are shallow,
  wall-bound details; they improve surface reading without becoming targets.
- **Assistive technology:** the visible 3D labels are gone, while semantic names
  inside the minimap SVG remain available to screen readers. Screenshot review
  cannot verify keyboard movement, pointer lock, or full screen-reader gameplay.
- **Cursor note:** the black arrow with a white halo in the supplied screenshots
  is the captured mouse cursor, not a map marker. The beige exterior triangles
  were map geometry and have been removed.

## Code corrections

- Replaced `desertCitadelArtPass.ts` with perimeter-wall-only detail.
- Removed the Desert Citadel imported-asset mount and its cleanup lifecycle.
- Removed all district-sign texture creation and sign geometry.
- Removed freestanding gates, houses, market props, waterworks props, and distant
  terrain from the art pass.
- Removed latent block/cylinder labels from the map definition.
- Reduced the sundial core and added regression coverage against labels and a
  sightline-blocking core.
- Retained the Sand 03 PBR ground treatment on Medium/High and the lightweight
  procedural fallback on Low.

## Verification

- Corrected screenshots inspected for Overview, Ground, Citadel, and Lookout.
- Fresh browser console: no warnings or errors.
- High-quality 40-player Ground sample: 53 FPS, 261 draw calls, 387,040
  triangles, five static batches.
- High-quality 40-player Lookout sample: 42 FPS, 655 draw calls, 493,052
  triangles, five static batches.
- `npm run typecheck -w @quizstrike/web` — passed.
- Focused Desert Citadel tests — 11/11 passed.
- Full web suite — 170/170 passed.
- `npm run build` — passed.

## Evidence limits

The audit proves the four supplied views and the Character Lab stress state. It
does not claim complete accessibility compliance or replace a live multiplayer
session with multiple human players and input devices.
