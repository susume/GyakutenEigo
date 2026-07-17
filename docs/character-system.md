# QuizStrike Character System

## Existing Architecture

The current game client is a React/Vite app using Three.js `0.178.0`. `ArenaPreview.tsx` owns scene creation, map rendering, the first-person camera, movement input, local collision against map cover, and lightweight multiplayer position rendering from `PlayerSession` state. The server/shared package already owns sessions, teams, player health, respawns, gear, and authoritative quiz/game rules. Socket.IO state synchronization sends gameplay state such as position and facing; character bones are not synchronized.

## Runtime Character Architecture

The character system lives in `apps/web/src/game/characters/` and is intentionally modular:

- `CharacterAppearance` centralizes Team Alpha and Team Bravo palettes, silhouettes, role variants, LOD thresholds, and hitbox specs.
- `CharacterFactory` builds reusable low-poly development placeholder characters and the first-person view model.
- `CharacterModel` owns the root Three.js group and coordinates animation, hitboxes, LOD, and lightweight audio stepping.
- `CharacterAnimator` reconstructs motion locally from speed/alive/firing state.
- `CharacterController` smooths remote network position and facing updates.
- `CharacterManager` creates, updates, hides, and animates remote player characters from `PlayerSession` data.
- `CharacterLOD` throttles animation by distance.
- `CharacterHitboxController` keeps gameplay hit regions separate from render meshes.
- `CharacterEquipment` builds modular weapon/backpack pieces.
- `CharacterNetworkState` documents the compact state that should cross the network.
- `CharacterAudio` is a footstep cadence hook for future spatial audio integration.

## Visual Direction

Team Alpha is a cool modern tactical unit: navy/slate uniform, blue accents, visor helmets, plate carriers, and compact radio packs.

Team Bravo is a warm rugged tactical group: sand/olive/brown clothing, orange accents, ridged helmets, longer rigs, and bedroll-style packs.

The current meshes are clearly labeled development placeholders made from simple low-poly geometry. They are designed for readability and integration, not final production art.

## Multiplayer Strategy

The client consumes existing `PlayerSession` state: id, team, position, facing, alive state, and gear. It never syncs bones. Movement animation is reconstructed locally from smoothed position deltas. The server should remain authoritative for damage, death, respawn, and final hit validation.

## Hitboxes

Hitbox regions are defined in `CharacterAppearance.ts`:

- head: `4.0x`
- torso: `1.0x`
- pelvis: `1.0x`
- arms: `0.75x`
- legs: `0.75x`

These are simplified boxes approximating the animated character. They are separate from the visual mesh and can be mirrored server-side.

## LOD And Performance

Initial LOD thresholds:

- LOD0: 0-15 meters, full equipment and every-frame animation
- LOD1: 15-35 meters, full equipment and normal animation
- LOD2: 35-70 meters, reduced equipment and half-rate animation
- LOD3: 70+ meters, minimal equipment and quarter-rate animation

The implementation reuses geometries and materials through `CharacterFactory`, smooths remote updates, and avoids bone/network replication. The next optimization pass should profile 40 simulated players in the rendered arena before tuning thresholds.

## Character Lab And Stress Testing

Open `/character-lab` in the web app during development to run the character test arena. This route is outside the normal student and teacher flow and uses generated session data only.

The lab supports stress presets for:

- 10 players
- 20 players
- 40 players
- 60 players

The generated scenario balances Team Alpha and Team Bravo, rotates through available gear variants, includes a small number of eliminated players, and can simulate periodic network movement. The arena debug overlay reports visible characters, alive characters, average smoothed movement speed, and LOD distribution in the format `LOD0/LOD1/LOD2/LOD3`.

## Production GLB Requirements

### Production art-bar decision

Imported artist-authored assets are a release gate for **final visual sign-off**, but not a prerequisite for technical production readiness. The current shared `THREE.SkinnedMesh` and code-authored variants are suitable for multiplayer integration, QA, and performance certification because the network schema, hitboxes, LODs, batching, and fallback behavior are already exercised.

The final art gate is therefore staged:

- **Required before final art/marketing sign-off:** an artist-authored shared student-athlete GLB, authored skeletal clips for the supported gameplay states, and authored LODs/attachments for the hero and close-range views.
- **Required where texture payload warrants it:** KTX2/Basis-compressed atlases with a tested fallback. KTX2 is a bandwidth/startup optimization, not a visual-quality requirement for every material.
- **Retained in production:** the code-authored mesh remains the deterministic fallback and may serve distant/low-quality representations when measurements show it is the better budget trade-off.

This means the project can ship an internal multiplayer milestone with the current assets, but cannot claim the final character art bar until the imported GLB/clip set passes silhouette, deformation, UV/texel-density, LOD, file-size, and device-performance review.

Place final assets under:

- `apps/web/public/assets/characters/shared/`
- `apps/web/public/assets/characters/team-alpha/`
- `apps/web/public/assets/characters/team-bravo/`
- `apps/web/public/assets/characters/animations/`

Use GLB where possible. Production characters should share a consistent humanoid skeleton, scale, forward axis, origin, and feet-at-ground placement.

Required bones:

- root, pelvis, spine, chest, neck, head
- left/right clavicle, upper arm, forearm, hand
- left/right thigh, shin, foot

Recommended attachment points:

- primary weapon, secondary weapon, muzzle
- left hand IK target, right hand IK target
- head accessory, backpack, tactical equipment

Required animation clips:

- idle, walk forward/backward, strafe left/right, run forward/backward
- crouch idle, crouch walk
- jump start, airborne, landing
- fire, reload, weapon switch
- hit reaction, death front, death back

Use texture atlases, PBR materials, browser-appropriate texture sizes, mesh compression where supported, and shared animation clips whenever practical.

## How To Add Real Characters

1. Add Team Alpha and Team Bravo GLB files to the asset directories above.
2. Keep the serialized appearance shape from `serializeCharacterAppearance` stable for multiplayer.
3. Extend `CharacterFactory` to load GLB assets asynchronously and fall back to the procedural placeholder if loading fails.
4. Bind weapon and backpack equipment to named attachment points instead of hard-coded placeholder transforms.
5. Replace procedural animation in `CharacterAnimator` with `AnimationMixer` state transitions while keeping the same external update inputs.

## Known Limitations

- Current bodies are procedural placeholders, not production-quality humanoid art.
- The animation system is procedural and does not yet use GLB skeletal clips.
- Hitboxes are client-side helpers today; authoritative server ray/hit validation still needs a matching implementation.
- Character stress testing is not yet automated beyond build/test verification.

## Recommended Next Phase

Extend the lab with optional hitbox visualization and frame-time capture, then integrate production GLB assets and replace procedural animation with shared `AnimationMixer` clips.
