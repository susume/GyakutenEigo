# QuizStrike visual production pass — 2026-07-17

This pass upgrades the procedural browser renderer while preserving the authoritative gameplay map, spawn tables, hitboxes, collision proxies, routes, and network protocol. It is a substantial production-minded procedural art pass, but it is not described as the final asset-authored art pass: bespoke character rigs, authored modular environment meshes, and compressed texture atlases remain future work.

## 1. Original visual audit

- The map silhouette and route layout were functional, but most visible structures still exposed their collision-box origins.
- Procedural textures carried dark albedo and were multiplied by dark material tints, crushing shaded walls toward black.
- Floating route billboards could become oversized first-person occluders.
- Characters read as angular tactical placeholders rather than school-safe athletic competitors.
- Starter, Quick, and Heavy launchers borrowed firearm-like construction language and did not fully communicate their snow-sport energy systems.
- First-person fire feedback was a single puff and sphere with little sense of charge, trail, or impact.
- The HUD was coherent but sat visually apart from the arena and used a heavy full-cross reticle.
- Auto quality could select High on ordinary-density displays, which was the wrong default for school hardware.

Gameplay-critical geometry identified during the audit:

- `packages/shared/src/index.ts` remains authoritative for bounds, spawns, team bases, capture/retrieve zones, movement checks, projectile resolution, and simplified server collision.
- `desertCitadelMap.ts` and `ironJunctionMap.ts` provide the client collision-bearing block definitions.
- The new trims, windows, supports, route props, objective pads, edge rocks, and team infrastructure are visual-only and do not alter collision dimensions.
- Character hitboxes and server damage multipliers are unchanged.

## 2. Art direction

The chosen direction is **modern educational esports in a repaired desert civic arena**: warm mineral architecture, cool water/technology accents, sports-uniform competitors, and equipment that reads as purpose-built snow-energy gear. Team color is concentrated on uniforms, objective equipment, spawn trim, and HUD accents instead of washing entire spaces red or blue.

The renderer now uses a neutral procedural surface-detail layer under material palette colors, a three-tone atmospheric sky, deterministic texture breakup, architectural courses and supports, controlled emissive technology accents, and restrained glass-like HUD panels.

## 3. Files and systems changed

- `apps/web/src/game/ArenaPreview.tsx`: deterministic material generation, neutral albedo pipeline, gradient sky, quality-aware detail tiers, structural modules, enhanced props, team beacons, answer-pad objective language, instanced boundary rocks, first-person projectile trail/impact reuse, safe first-person signage, renderer counters, and visual-QA fixes.
- `apps/web/src/game/characters/CharacterAppearance.ts`: brighter sports palettes while preserving stable team/variant serialization.
- `apps/web/src/game/characters/CharacterFactory.ts`: rounded athletic proportions, jersey panels, caps/headbands/hair variants, shoes, contact shadows, and improved first-person arms.
- `apps/web/src/game/characters/CharacterEquipment.ts`: three distinct classroom-safe energy/snow launcher silhouettes and sport-pack presentation.
- `apps/web/src/game/characters/CharacterAnimator.ts`: foot lift, torso lean, head motion, and weapon sway layered over responsive movement.
- `apps/web/src/styles.css`: compact segmented reticle, upgraded minimap glass, arena-integrated HUD, team/warmth accents, and mobile fallback.
- `apps/web/src/game/gamePreferences.ts` and `apps/web/src/App.tsx`: clear Low/Medium/High labels and a safer Auto policy.
- `apps/web/src/game/desertCitadelMap.ts`: school-safe location naming and environmental-story language.
- Related character/equipment/quality tests were updated to protect the new visual contracts.

## 4. Before and after evidence

| View | Before | After |
| --- | --- | --- |
| Active student gameplay | [before](before/04-gameplay-spawn.png) | [after — Medium spawn](after/04-gameplay-spawn.png) |
| Active student gameplay, High | [before](before/04-gameplay-spawn.png) | [after — High](after/05-gameplay-high.png) |
| 40-player overview | [before](before/03-character-lab.png) | [after](after/03-character-lab.png) |
| Product landing baseline | [before](before/01-home-landing.png) | The landing was already on its newer polished design and was intentionally not rebuilt in this pass. |

The gameplay pair is the closest retained first-person baseline. Exact camera coordinates differ because the live server restores the authoritative player position between rounds.

## 5. Performance results

Renderer work was sampled in a local Chrome development build at a 1280×720 viewport during a live two-client Flag session. These counters are useful for comparing presets; they are not a real Chromebook FPS certification.

| User preset | Internal tier | Pixel-ratio cap | FPS shadows | Draw calls sampled | Triangles sampled |
| --- | --- | ---: | --- | ---: | ---: |
| Low | `performance` | 1.0 | Off | 240 | 11,486 |
| Medium | `balanced` | 1.25 | Off | 486 | 15,676 |
| High | `high` | 1.75 | Off in FPS; overview only | 665 | 20,776 |

The automated browser was simultaneously capturing and instrumenting WebGL and reported inconsistent 1–13 FPS samples, so those readings are rejected as device-performance evidence. Real school-desktop and Chromebook measurements are still required before claiming 60 FPS / 30–45 FPS targets. Auto now selects Low on high-density displays and Medium otherwise; it no longer silently selects High.

## 6. Remaining placeholder art

- Collision-bearing environment bodies are still generated from boxes and cylinders under the new facade/detail layer.
- Characters are procedural Three.js meshes rather than authored skinned GLB models.
- Animation remains code-driven rather than motion-captured or clip-blended.
- Surface detail is generated canvas texture data rather than a compressed texture atlas/trim sheet set.
- Iron Junction benefits from the shared material, sky, prop, HUD, character, weapon, and quality work, but did not receive a map-specific composition pass in this change.
- Remote projectile travel, shield hits, healing, capture celebration, elimination, victory, and defeat still need complete event-driven VFX coverage.

## 7. Issues requiring custom artist-created assets

1. A shared student-athlete skeleton with authored idle, sprint, strafe, crouch, jump, land, carry, fire, knockout, respawn, and victory clips.
2. A modular Desert Citadel kit with bevelled walls, arches, gates, stairs, roof sets, damaged variants, and snap-safe collision proxies.
3. Atlas/trim-sheet materials for plaster, stone, timber, painted metal, fabric, decals, and team equipment, exported in compressed browser formats.
4. Authored first/third-person launcher meshes with consistent muzzle sockets and LODs.
5. A pooled event VFX library tied to authoritative hit, objective, healing, spawn, round, and result events.

## 8. Stability and gameplay retest

- Full repository tests pass: 56 shared, 5 server, and 47 web tests (108 total).
- Shared tests cover movement collision, jump clearance, projectile line of sight and cover, hit resolution, spawns, objective state, base-zone checks, team balance, and bot navigation.
- Production build passes for shared, server, and web packages.
- A local teacher and student connected through separate live browser tabs, joined the same room, advanced through multiple Flag rounds, and restored the authenticated student session after refresh.
- A live fire action was accepted by the server; ammunition synchronized from 10 to 9 and the miss response returned correctly.
- Flag interaction distance rejection was retested. A full manual pickup/place/capture race was not completed in this visual pass.
- No networking contracts, server movement metrics, collision sizes, hitboxes, objective coordinates, or route URLs were changed.

## 9. Recommended next visual improvements

1. Build and integrate the shared skinned student-athlete character set; it is the largest remaining perceived-quality gain.
2. Replace the facade-over-collider buildings with authored modular meshes while retaining the current invisible collision proxies.
3. Merge/batch static facade geometry and atlas materials to bring Medium below the current draw-call count before Chromebook certification.
4. Complete event-driven impact, shield, objective, spawn, elimination, and results VFX with pooling and strict screen-coverage budgets.
5. Give Iron Junction its own lighting, terrain-transition, landmark, and storytelling pass.
6. Run physical Chromebook, integrated-GPU desktop, Edge, and 40-player soak profiling with frame-time, GPU memory, and long-task capture.

