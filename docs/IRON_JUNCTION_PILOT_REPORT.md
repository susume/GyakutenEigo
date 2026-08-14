# Iron Junction pilot visual transformation

## Architecture discovered

- Three.js `0.178.0` renders the arena in `ArenaPreview.tsx`.
- `arenaMapBuilder.ts` owns procedural visual geometry, materials, static
  batching, simple client colliders, objective pads, and team spawn circles.
- `ironJunctionMap.ts` defines the pilot's blocks, props, tracks, floors, and
  collision-bearing geometry. Server authority remains in
  `packages/shared/src/index.ts`.
- `ArenaStaticBatcher` merges compatible static facades into shared atlas
  batches; quality tiers are Low/Medium/High with auto adaptation.
- Characters, weapons, VFX, minimap, movement, bots, and networking already
  have separate systems. The player character was not replaced.
- Before this pass there was no GLB environment loader, map-specific GLB
  manifest, sourced environment asset provenance, or executable Blender
  authoring/export path.

## Pilot selection

Iron Junction was selected because its collision and route structure are already
strong, but its most important rail objects were still represented by broad
procedural boxes. A locomotive, crane, carriages, and district signage create a
large visible improvement without changing routes, spawn positions, objective
locations, or movement timing.

## Original visual / UX audit

1. The center “locomotive” read as a long dark rectangle rather than a train.
2. The freight and dispatch railcars had weak silhouettes at first-person range.
3. The maintenance depot had no tall object that made the district memorable.
4. The container yard was not legible as a cargo area.
5. The central rail yard lacked a named landmark that students could call out.
6. `signs` and `floorMarks` were empty for Iron Junction, so route language was
   mostly inferred from the minimap.
7. Similar blue-gray facades made the warehouse, dispatch, and depot districts
   blend together in a fast match.
8. Cover and decoration were both expressed as box-like masses, making their
   gameplay purpose harder to read.
9. The map's strong rail infrastructure was not visually repeated in the hero
   objects, only in the trackbed and rails.
10. Team colors helped spawn recognition but did not yet label the major route
    regions.
11. There was no external asset provenance trail for future environment work.
12. There was no cached, map-scoped GLB path for future assets to reuse.

## Art direction

See [QUIZSTRIKE_ART_DIRECTION.md](QUIZSTRIKE_ART_DIRECTION.md). The pilot uses
clean stylized railway-industrial shapes, warm warning accents, blue/red route
identity, and high-contrast district signs.

## Sourced and Blender-authored assets

Five curated GLBs are from Kenney's CC0 Train Kit 1.1 / Factory Kit 3.0. The
sixth GLB is a QuizStrike-authored Blender control-tower hero asset generated
by `tools/blender/create_iron_junction_control_tower.py`. Exact source pages,
license files, generated texture details, sizes, and changes are recorded in
`apps/web/public/assets/arena/iron-junction/SOURCE.md`.

## Player-visible changes

- A recognizable Kenney locomotive and boxcar now form a central train consist.
- Blue and red container carriages create a readable cargo-yard landmark.
- A tall maintenance crane gives the south-east depot a distinct skyline
  silhouette and a memorable callout.
- The central control landmark is now a Blender-authored tower with glazed
  windows, structural pylons, warning rails, roof signal mast, and a 2K baked
  industrial albedo instead of only procedural beams and a clock disk.
- Four restrained 3D signs name the central control, freight warehouse,
  maintenance depot, and dispatch station.
- Existing procedural railbeds, facades, lights, objective pads, and collision
  proxies remain as the performant fallback and gameplay layer.

## Environmental UX changes

Landmark names now match the map's existing districts. Players can say
“control tower,” “freight loading,” “maintenance crane,” or “dispatch platform”
instead of describing another generic box. The assets are placed beside existing
route geometry, not across stairs or objectives, and they do not change the
authoritative obstacle list.

## Before / after evidence

The retained baseline is
`audit/quizstrike-map-pass-baseline/03-iron-fps.png`. Earlier five-asset pilot
captures remain at `audit/quizstrike-map-pass-final/iron-junction-glb-overview-textured.png`
and `audit/quizstrike-map-pass-final/iron-junction-glb-fps.png`. The latest
Blender-hero first-person capture is
`audit/quizstrike-map-pass-final/iron-junction-blender-fps.png`; it includes the
updated renderer counters after the tower and shared atlas were added. The
browser route loaded the six-asset map without a visible runtime error.

## Texture and performance accounting

The pilot adds six GLBs plus one shared texture: about **2,051,356 bytes** of
runtime payload before browser compression. Four Kenney train assets reuse one
native 512px color atlas because upscaling its flat source artwork adds no
visible detail; the Blender hero tower carries one compressed 2K albedo inside
its 1.50 MB GLB. No texture was reduced below its authored/source resolution
merely to satisfy a generic low-quality budget. Low quality reduces
secondary geometry, lights, and effects while retaining the landmark asset;
Medium/High requests the complete six-asset set. The current renderer exposes
draw calls, triangles, textures, frame-time percentiles, and long-task counts through
`ArenaPerformanceCapture` and `window.__quizstrikeArenaProfile`.

One local browser sample after the Blender hero pass (40-player Character Lab,
Iron Junction, first-person, High) reported 43 FPS, 304.4 ms frame-time p95, 81
draw calls, and 338,638 triangles. This is a warm-up/dev-browser sample with
long tasks elevated during the asset transition, not a Chromebook certification
or a steady-state performance claim. The asset payload is intentionally
map-scoped. The next optimization step is measured device profiling, not
automatic texture downscaling.

The final physical Chromebook FPS numbers still need to be captured on target
hardware. No claim of a 60 FPS Chromebook result is made here.

## Technical architecture

- `arenaAssetLoader.ts` caches each GLB promise by URL and clones the shared
  scene for each map instance.
- `ironJunctionImportedAssets.ts` is map-scoped and quality-aware. Other maps do
  not download Iron Junction assets. Its detail tiers preserve the hero train,
  crane, and tower while reducing secondary sourced props on Low.
- Optional load failures log a warning and leave the procedural map playable.
- Imported geometry and materials are marked as shared so scene cleanup does
  not destroy the cache. Sign textures are disposed with the scene handle.
- Visual assets never become server collision. Existing simple boxes/cylinders
  remain authoritative.

## Tests and remaining work

Blender 4.5.5 LTS was installed as a portable local tool outside the repository.
The control tower was authored, exported, and validated headlessly: 32 meshes,
3,360 triangles, six materials, and one required 2048px image. The reusable
export script was also exercised on the sourced locomotive; its 512px source
atlas produced a validation guidance warning, which is intentional for this
flat common-prop atlas rather than evidence that it should be upscaled. The
promotion helper remains available for authored materials where 1K or 2K detail
is visibly justified.

The remaining gaps are physical-device profiling, a longer steady-state browser
sample, and extending the same Blender-first pipeline to the next map.

Recommended next map: **Temple Runoff**. Its water-control and temple route
structure has a clear identity opportunity, and a floodgate / statue / bridge
kit would create a similar hero-first improvement without touching the player
character or shared combat systems.
