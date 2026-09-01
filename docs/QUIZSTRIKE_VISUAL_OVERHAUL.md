# QuizStrike visual overhaul — production-quality Three.js foundation

Date: 2026-09-01

This pass establishes the reusable rendering seams and proves them on one
vertical slice: Athletics / Skyline Adventure Park. Gameplay authority,
movement, questions, scoring, multiplayer payloads, and the other arenas were
left intact. The visual work is deliberately additive so future maps can move
from procedural blockout to authored environments without another renderer
rewrite.

## 1. Audit

The primary entry point is `apps/web/src/game/ArenaPreview.tsx`. It creates the
renderer, camera, map scene, character sync, pooled VFX, input loop, and
performance capture. `sceneSetup.ts` owns renderer quality settings;
`arenaMapBuilder.ts` and the map-specific builders create visible geometry and
collision proxies; imported GLBs were previously loaded by a small global
loader. Characters already use a shared `CharacterFactory`, `CharacterManager`,
`CharacterController`, `CharacterModel`, animator, cosmetics, and distance LOD.
`ArenaVfx.ts` already provides a bounded pooled effect layer and
`ArenaStaticBatch.ts` already provides atlas-backed static batching.

The main visual limitations were composition and lifecycle consistency, not a
missing game loop: map builders mixed lighting and material creation locally,
Athletics had attraction assets but lacked a coherent stadium shell, and the
old loader cached by URL but did not expose a complete pack/release contract.
The course itself remains intentionally simple and collision-backed; it is
separate from the non-collidable stadium dressing introduced here.

The following systems were preserved rather than rewritten:

- server-authoritative movement, round progression, questions, scoring,
  objectives, and multiplayer synchronization;
- the existing shared character and animation architecture;
- pooled VFX admission/culling and the existing static atlas batcher;
- all existing map collision definitions and optional-asset fallback behavior.

Post-processing was also audited. The renderer already uses sRGB output and
ACES tone mapping. No heavy composer stack was added: restrained fog, tone
mapping, shared lighting, and selective shadows provide the visual depth while
keeping a clean removable path for a later tablet-tested FXAA/bloom pass.

## 2. Architecture

The new rendering foundation is organized as follows:

```text
apps/web/src/game/rendering/
  assets/
    ArenaAssetManager.ts
  environment/
    EnvironmentKit.ts
    EnvironmentKitLoader.ts
    AthleticsEnvironmentDress.ts
  lighting/
    QuizStrikeLighting.ts
  materials/
    QuizStrikeMaterials.ts
```

`ArenaAssetManager` is the page-scoped source-of-truth for GLBs. It owns one
promise per URL, Meshopt decoder setup, progress, pack registration, reference
counts, source disposal, and clone-safe instantiation. Existing map mounts use
`arenaAssetLoader.ts` as a compatibility facade, so the refactor does not force
all maps to change at once.

`EnvironmentKit` is a data-driven map-facing contract. It divides a kit into
architecture, terrain, props, vegetation, and effects and carries detail gates,
fallback names, authored transforms, and scene-only budgets. A map references
`environmentKitId`; the map builder does not know how GLTF loading works.

`EnvironmentKitLoader` registers a kit as an asset pack, mounts only assets
allowed by the current quality detail, hides a named fallback only after a
successful load, and releases every acquired source reference on teardown.
Late loads after teardown are released immediately.

`QuizStrikeMaterials` provides controlled stone, sand, wood, metal, fabric,
vegetation, painted, emissive, and water responses. `QuizStrikeLighting` owns
the common hemisphere, key sun, colored fill, fog, and shadow-camera policy.
`AthleticsEnvironmentDress` is the first reusable dressing layer: it adds
stadium composition without participating in movement collision.

## 3. Files changed

Important additions:

- `apps/web/src/game/rendering/assets/ArenaAssetManager.ts`
- `apps/web/src/game/rendering/environment/EnvironmentKit.ts`
- `apps/web/src/game/rendering/environment/EnvironmentKitLoader.ts`
- `apps/web/src/game/rendering/environment/AthleticsEnvironmentDress.ts`
- `apps/web/src/game/rendering/lighting/QuizStrikeLighting.ts`
- `apps/web/src/game/rendering/materials/QuizStrikeMaterials.ts`
- focused tests beside the new material, lighting, environment-kit, and budget
  modules;
- this report and the existing Athletics asset manifest.

Important integrations:

- `apps/web/src/game/ArenaPreview.tsx` now publishes asset, performance, and
  budget diagnostics and passes the shared lighting/environment context;
- `apps/web/src/game/sceneSetup.ts` creates the standard lighting rig and
  applies a map-aware shadow policy: Athletics gets soft shadows at balanced
  quality, while the legacy arenas reserve that pass for high quality;
- `apps/web/src/game/athleticsStadiumBuilder.ts` consumes the shared material
  vocabulary and authored Athletics dressing layer;
- `apps/web/src/game/athleticsImportedAssets.ts` is now a kit-backed wrapper;
- `apps/web/src/game/arenaMaps.ts`, `mapTypes.ts`, and `mapLoader.ts` expose the
  optional kit reference;
- `ironJunctionImportedAssets.ts`, `desertCitadelImportedAssets.ts`, and
  `templeRunoffImportedAssets.ts` now release their acquired cached references;
- `ArenaPerformance.ts` contains explicit quality budgets and evaluates frame
  samples against them;
- `CharacterModel.ts` limits character shadow casting to the nearest LOD0
  silhouettes, keeping the balanced shadow pass selective.

## 4. Athletics vertical slice

The selected slice is Athletics because it already had a coherent route and a
small licensed attraction asset set, but its overview lacked the visual cues of
a sporting venue. The new `athletics-authored-stadium-dress` adds:

- a layered red oval track, three lane markings, green infield, and subtle
  field striping;
- a north grandstand with stepped structure, roof, supports, and blue/coral
  instanced seats, plus lower-detail side stands in overview mode;
- an elevated `SKYLINE GAMES · RACE DAY` scoreboard and restrained stadium light
  towers;
- perimeter rails, colored sponsor blocks, animated banners, and deterministic
  instanced low-poly trees around the course boundary;
- the existing Ferris wheel, entrance, stalls, coaster track/train/supports,
  and optional asset fallbacks mounted through the generic environment-kit
  loader.

The dressing is visual-only. The authoritative Athletics route, jump surfaces,
moving platforms, and recovery rules remain unchanged. Large visible surfaces
use the ring/circle/instanced/GLB composition layer; the remaining course
platforms are intentionally readable gameplay geometry and are identified as
the next art debt rather than presented as finished environment assets.

Visual QA was performed in the Character Lab at
`/character-lab?cleanPreview=1&athleticsProgress=0.28` with a local Chrome
runtime. The final capture is stored at
`.codex-map-preview/athletics-final-overview.png` for local review. Compared
with the baseline, the same view now reads as a stadium: the oval, field,
stands, scoreboard, light towers, trees, signage, and attraction silhouettes
establish a clear hierarchy instead of a floating collection of boxes. The
capture reported no page errors and loaded all eight unique GLB paths.

## 5. Asset pipeline

`ArenaAssetManager` supports the requested lifecycle:

- `loadAsset` / `getCachedAsset` for shared source scenes;
- `registerPack`, `loadAssetPack`, `preloadAssetPack`, and
  `releaseAssetPack` for map bundles;
- `THREE.Cache` plus a URL-keyed promise to avoid duplicate fetch/parse work;
- `SkeletonUtils.clone` for clone-safe animated instances while retaining
  shared geometry/material resources;
- progress counters for loaded, total, failed, and active assets;
- reference-counted release and explicit `unloadAsset` /
  `unloadUnusedAssets` disposal;
- named fallback objects that remain visible on optional load failure.

The Athletics kit contains 10 placements and 8 unique GLBs. The unique runtime
set is 1,145,784 bytes, each file is below 1 MB, and the existing
`docs/ATHLETICS_ASSET_MANIFEST.md` records the source/licensing information
(CC0/Public Domain sources). Detail gates load four placements at performance
detail and all ten at balanced/high detail.

Meshopt decoding is configured in the manager for compressed GLBs and future
packs. No Draco or KTX2/Basis transcoder was added in this pass because the
current Athletics files do not require a new transcoding dependency; the small
binary set and manifest byte gate remain the current loading guardrail.
Runtime `renderer.info.memory.textures` is captured as a texture count, and the
performance capture now adds a conservative scene texture estimate: unique
reachable maps, decoded RGBA bytes, and mip overhead. This is useful for
quality-budget comparisons, but it is not a driver-level GPU allocation
profiler; the environment kit's explicit 16 MB target remains a guardrail, not
a claim about exact GPU allocation.

## 6. Lighting and shadows

Every arena now enters through the same configurable rig:

```text
hemisphere ambient + key directional sun + colored directional fill
                     + fog + ACES/sRGB output
```

Athletics uses a sky-blue background, pale aqua haze, warm sunlight, and a
cooler fill to separate characters and course accents without crushed blacks.
The rig has map-specific profiles for the existing environments while keeping
the same ownership and shadow policy.

At balanced/high overview quality the Athletics sun uses PCF soft shadows with
bounded camera extents, negative bias, and normal bias. The existing arenas
keep balanced quality shadow-free for the 40-player classroom stress case and
enable the same pass at high quality; performance mode disables it everywhere.
Character models only cast from their nearest LOD0 silhouette; farther
characters remain receivers/visuals but do not add expensive shadow casters.
Decorative banners, seats, and lamps opt out where their shadow would not
improve readability. The debug dataset reports active shadow-caster count.

## 7. Character and animation system

The existing character architecture already matches the intended direction:
one shared body/skeleton construction path, team palette, clothing and
accessory configuration, shared equipment geometry, procedural blended
locomotion, one-shot cues, replicated verticality, and distance-based LOD.
The overhaul keeps that system intact and extends its rendering contract only
where useful for the shared shadow budget. Existing tests cover idle/walk/run,
sprint, crouch, jump/fall/land, hit, defeated, celebration, objective carry,
cosmetic motion, team palettes, and reduced LOD.

The next character phase should add authored animation clips only where the
current procedural blend cannot communicate a state (notably climb/dodge),
while retaining the current fallback/procedural path and multiplayer-safe
appearance serialization.

## 8. Performance

The following captures use the same local Chrome harness and the same
Character Lab Athletics scenario. They are directional development numbers,
not a substitute for a representative Japanese school-tablet device matrix.

| Metric | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| Static source meshes | 171 | 225 | authored stadium dressing adds composition sources |
| Static batches | 5 | 5 | batching remains stable |
| Draw calls | 1,377 | 1,415 | +38 / +2.8% in the richer overview |
| Triangles | 570,604 | 575,266 | +4,662 / +0.8% |
| FPS | 78 | 58–69 | shadow-enabled balanced captures vary by local load |
| Frame p95 | 16.8 ms | 18.5–22.3 ms | within the balanced 24 ms guardrail on the final capture |
| Long tasks | 7 | 3–5 | browser-run variability; no new page error |
| Unique Athletics GLBs | not kit-mounted | 8 / 8 loaded | deferred map-specific payload |
| Runtime texture count | not captured | 58 | renderer info count, not decoded bytes |
| Estimated scene texture footprint | not captured | 23.7 MB | conservative decoded RGBA estimate in the balanced Athletics capture |
| Active shadow casters | not captured | 188 | final balanced capture with 40-character lab |

The runtime budgets are explicit in `ArenaPerformance.ts`:

- performance: 1,250 draw calls, 500k triangles, 24 MB texture target,
  96 shadow casters, 24 active particles;
- balanced: 1,600 draw calls, 800k triangles, 32 MB texture target,
  224 shadow casters, 48 active particles;
- high: 2,000 draw calls, 1.1M triangles, 48 MB texture target,
  256 shadow casters, 64 active particles.

Each profile also has a target FPS and p95 frame-time guardrail. The canvas
dataset exposes the measured values and a comma-separated violation list for
the existing development diagnostics. The kit-level Athletics target remains
180 scene draw calls, 350k scene triangles, and 16 MB texture payload; the
complete-frame budgets are intentionally higher because they include players,
the route, UI-facing VFX, and other runtime objects.

## 9. Tests and verification

Final local checks:

- `npm run typecheck -w @quizstrike/web` — passed;
- `npm run lint` — passed;
- `npm test` — passed: 133 shared, 116 server, 246 web, and 7 proxy tests;
- `npm run build` — passed: shared, server, and web production builds;
- web production build: 1,884 modules transformed; the existing Three.js
  chunk is 569.96 kB / 146.24 kB gzip and retains the repository's existing
  large-chunk warning;
- `npm run test:e2e -w @quizstrike/web` — 16 passed, 2 failed. The two
  failures are existing teacher-side assertions outside the changed rendering
  path: Speaking expected `Create an activity` after a redirect but landed on
  the teacher home, and Study Sets timed out waiting for `Create`. The
  Athletics desktop test, the iPad-like arena shell/touch tests, join/realtime
  flows, and the remaining E2E cases passed. The Speaking test was also rerun
  in isolation and reproduced the same teacher-home result.
- Final targeted arena rerun, `npx playwright test e2e/athletics.spec.ts
  e2e/ipad.spec.ts`, passed all 3 desktop/iPad arena tests after the shadow
  budget change.

Focused rendering regression coverage includes material clamping and emissive
colors, shared Athletics lighting ownership, kit categories/detail gates,
unique asset counts, fallback behavior, and render-budget evaluation. Existing
map, movement, character, VFX, multiplayer, and classroom suites remain green.

## 10. Remaining visual debt

This is a foundation plus one slice, not a claim that every arena is finished.
The main remaining debt is:

- the Athletics route platforms and several simple course obstacles are still
  procedural gameplay geometry; they should be replaced incrementally with
  authored modular sports assets while preserving their current colliders;
- Desert Citadel, Iron Junction, and Temple Runoff still depend on their
  existing procedural map surfaces, with only their current imported landmark
  layers routed through the shared loader facade;
- there is no driver-level GPU texture-allocation profiler or KTX2 pipeline
  yet; runtime diagnostics provide a conservative scene-footprint estimate;
- the 40-player balanced stress view still exceeds the new complete-frame
  texture/FPS guardrails on the legacy Desert Citadel and Iron Junction
  landmark layers; their dedicated texture reduction pass is separate from
  the Athletics slice, which is within its balanced texture budget;
- the post-processing audit is complete, but no optional FXAA/bloom/SSAO stack
  has been enabled;
- vegetation is currently a deterministic low-poly instanced layer, not a
  library of authored grass/shrub/palm assets;
- the environment kit registry needs additional map kits before callers can
  preload every arena by ID.

These are explicit follow-up items rather than hidden placeholders.

## 11. Next phase

The highest-value next step is to author the Athletics route kit around the
existing collision proxies: modular start gate, hurdles, vault blocks,
checkpoint arches, and summit structures, with one shared sports-material
atlas and LOD variants. Then add a real asset-memory report and a small device
matrix covering iPad-like Safari/Chrome, Android Chrome, and a school laptop.
After that, promote the same kit contract to Desert Citadel: one coherent
architectural family, deterministic prop variation, palms/reeds, dust/fire
effects, and visibility-aware shadow receivers. Keep the current server and
collision contracts unchanged while each visible module is replaced.
