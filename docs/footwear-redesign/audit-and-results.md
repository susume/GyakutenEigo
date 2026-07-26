# Footwear Customisation: Audit and Results

## 1. Badge removal

The retired Badge slot was a complete cosmetic system rather than UI-only data. `detailAccessoryId` was validated in the shared appearance schema, stored locally and on the server, synchronized in session snapshots, and rendered as shoulder, wrist, medal, compass, or star meshes.

The student-facing slot, shared IDs/catalog entries, rendering definitions, mesh builders, creator cards, randomization path, appearance resolver, and multiplayer signature have been removed. The chest decal socket remains as `ChestDecalSocket` because uploaded classroom artwork is a separate feature. `CharacterManager` also retains its unrelated overhead player-name sprite, historically named `badge`. Player rank, the Champion rank name, cosmetic XP, victory poses, and achievements are unchanged.

## 2. Footwear architecture

Appearance version 7 replaces `detailAccessoryId` with the compact `footwearId` field. `FOOTWEAR_CATALOG` is the central registry for ID, display name, description, visual type, transform metadata, team-accent behavior, and unlock level.

The procedural body remains one shared `THREE.SkinnedMesh`. `SharedSkinnedStudent` chooses exactly one footwear builder while composing the merged body geometry. Both feet are rigid-weighted to the existing left/right shin bones, matching the original Runners implementation without adding bones or changing animation. Replacing an appearance rebuilds the shared body with the selected footwear geometry; no old shoe remains underneath.

The body cache key includes footwear ID and team palette, so matching players reuse geometry while each style remains one draw call with the body. Footwear stays in the merged body at every LOD, while distant animation update frequency continues to use the existing LOD policy.

## 3. Initial footwear set

- `runners` — Runners — Light athletic shoes
- `army_boots` — Army Boots — Heavy-duty style
- `skate_shoes` — Skate Shoes — Classic street style
- `basketball_shoes` — Basketball Shoes — Court-ready high tops
- `sandals` — Sandals — Relaxed arena style
- `barefoot` — Barefoot — No shoes

All six are visual-only and currently unlock at level 1.

## 4. Team colour

Geometry is identical for Red and Blue. Neutral dark/armor layers remain dominant, while the existing uniform and accent palette drives small panels, cuffs, stripes, or straps. Basketball Shoes intentionally use the strongest team accent; Army Boots and Skate Shoes use restrained accents. Barefoot uses no team accent geometry.

## 5. Barefoot

Barefoot replaces the shoe with a rounded skin-material foot, heel mass, broad forefoot, and three simplified toe lobes. It uses the character system's existing skin material rather than introducing skin-tone customization or realistic anatomy. The heel/ankle overlaps the existing trouser termination so removing shoes does not reveal a gap.

## 6. Creator UI

Navigation is now Head, Back, Footwear, Victory. Footwear uses a shoe/footprint tab icon and a two-column by three-row card grid with larger representative icons, names, and descriptions. The panel explicitly states that footwear is cosmetic only. Selection is live and mutually exclusive.

The footwear camera framing is one step closer than the other categories but retains the full head, body, feet, and platform. Drag/zoom behavior remains available, and user interaction is not overridden after it begins.

## 7. Randomize and reset

Randomize independently chooses an unlocked Head, Back, Footwear, and Victory style. The browser QA pass observed five different footwear results over twelve randomizations. Reset Character restores the complete default appearance with `footwearId: "runners"` and no Badge value.

## 8. Multiplayer and migration

Only `footwearId` is transmitted. The existing authoritative appearance endpoint, session snapshot, late-join/rejoin state, respawn lifecycle, and `CharacterManager` appearance signature carry the new field automatically.

The server integration suite saves Army Boots, observes the ID in public session state, and verifies it after rejoin. The 40-player integration scenario rotates through all six footwear IDs and verifies a representative reconnect.

Existing version 1–6 profiles are sanitized to version 7. Legacy Badge/detail values are ignored; missing or invalid footwear becomes Runners. Existing local storage and persisted runtime snapshots already pass through this sanitizer.

## 9. Tests performed

- TypeScript typecheck for shared, server, web, and browser test sources
- Production builds for shared, server, and Vite web bundles
- 77 shared tests
- Full server suite, including real HTTP appearance flow and 40 authenticated Socket.IO clients
- 114 web tests
- Six-style registry, mutually exclusive merged geometry, ground plane, geometry sharing, and Red/Blue topology tests
- Idle, walk, sprint, crouch, aim, shoot, jump, respawn, and victory animation updates
- Required combinations:
  - Boy/shared human body + Runners
  - Fox + Army Boots
  - Panda + Skate Shoes
  - Samurai + Basketball Shoes
  - Ninja + Sandals
  - Great White + Barefoot
  - Robot + Army Boots
  - Girl + Runners
  - Boy + Skate Shoes
- Every combination tested with Blue and Red
- Live creator selection, auto-save, Randomize, Reset, category navigation, and browser console

The root `npm test` wrapper has a pre-existing Windows quoted-glob issue. The same package suites were run by explicitly enumerating their test files.

## 10. Visual review

The live creator was reviewed at 1366 × 768. Every style was captured from front, three-quarter front, side, three-quarter back, and back. Red/Blue front views were compared side by side.

The first pass exposed cropped feet in the existing preview framing. The camera was recalibrated so the full character and platform are now visible. All six styles meet the same platform plane without changing the character root. Army Boots intentionally overlap the trouser cuff; Sandals and Barefoot have continuous ankles with no white connector or floating trouser gap.

Runners, Skate Shoes, and Basketball Shoes are most distinct in side/three-quarter views: Runners are curved and compact, Skate Shoes are flatter and wider, and Basketball Shoes have a taller padded collar and stronger accent. The rifle can obscure part of the toes from dead front, but drag-to-rotate immediately exposes the full silhouette. No major floor-contact, detachment, or clipping issue remains.

Visual QA artifacts:

- `after/footwear-tab-final.png`
- `after/all-footwear-five-angle-grid.png`
- `after/footwear-blue-red-front-grid.png`
- `after/reference-implementation-comparison.png`
