# QuizStrike Character Rebuild — Audit and Results

## Outcome

The lobby layout is preserved, student-controlled colours are removed end to end, team palettes are authoritative, the colour area is now a six-choice accessory panel, and the shared procedural character has been rebuilt as a more human 13-bone stylized athlete.

## Codebase audit

### Appearance and networking

- `packages/shared/src/index.ts` defines the cross-client/server `PlayerAppearance` contract, defaults, presets, sanitizer, and validation.
- `apps/server/src/index.ts` uses the shared validator for appearance writes and publishes the sanitized appearance in session state.
- `apps/server/src/appearanceFlow.integration.test.ts` exercises HTTP and Socket.IO identity, persistence, locking, reconnect, late join, and 40-player state fan-out.
- `apps/web/src/ui/PremiumCharacterCreator.tsx` owns creator draft state, Randomize, Reset, save feedback, and team-aware preview input.
- `apps/web/src/game/characters/CharacterAppearance.ts` resolves the authoritative team palette and the cosmetic silhouette.

### Character rendering

- `apps/web/src/game/characters/CharacterFactory.ts` is the shared lobby/gameplay construction pipeline.
- `apps/web/src/game/characters/SharedSkinnedStudent.ts` builds the merged skinned body.
- `apps/web/src/game/characters/CharacterModel.ts` owns LOD, hitbox updates, animation, audio, and equipment visibility.
- `apps/web/src/game/characters/CharacterAnimator.ts` drives idle, locomotion, crouch, firing recoil, objective, knockout, and event poses.
- `apps/web/src/game/characters/CharacterEquipment.ts` builds the launcher variants and their muzzle/support anchors.
- `apps/web/src/ui/CharacterCreator.tsx` renders the same `CharacterFactory` model in the lobby preview.

### Hitboxes

The visual mesh is not the gameplay collider. Existing server-compatible head, torso, pelvis, arm, and leg hitbox constants remain in `CharacterAppearance.ts`, and `CharacterHitboxController` continues to update them independently from the cosmetic mesh.

## Why the old character stayed blocky

The old asset used one merged skinned mesh, but its visible anatomy was still dominated by rigid box-like pieces and a coarse nine-bone pose. Smoothing, materials, and lighting could soften edges but could not change the square chest, cylindrical head, single-piece limbs, missing neck/jaw, or undifferentiated thighs and shins. The limitation was geometric and anatomical, not presentational.

## Chosen upgrade strategy

A procedural rebuild was safer than introducing a new GLB because the existing factory already feeds both the lobby and live match, carries team materials, controls LOD, shares equipment, and preserves server hitboxes. The rebuild therefore keeps that pipeline and replaces the body construction itself:

- lathed tapered chest, waist, and pelvis;
- layered cranium, jaw, ears, nose, and brow;
- defined neck and sloped shoulders;
- distinct upper arms, elbows, forearms, hands, and thumbs;
- distinct thighs, knees, shins, ankles, heels, and toes;
- 13 bones instead of nine;
- one merged skinned body and one body material.

## Appearance schema migration

Version 2 stores only:

```ts
interface PlayerAppearance {
  characterPreset: CharacterPreset;
  headOption: PlayerHeadOption;
  accessoryId: PlayerAccessoryId;
  decalAssetId?: string;
  appearanceVersion: 2;
}
```

The sanitizer migrates version 1 helmet/eyewear/backpack choices to the closest new head/accessory option and discards all old colour values. Direct network payloads containing legacy colour fields or an unsupported version are rejected. Existing saved profiles normalize safely to version 2.

## Team-colour enforcement

`TEAM_APPEARANCE` in `CharacterAppearance.ts` is the single palette authority. The resolver always derives uniform, armour, cloth, accent, dark, visor, and skin colours from the current team. Presets and accessories receive those resolved materials; no colour is stored in the appearance payload. Team switch, reconnect, and late join therefore all recompute the correct palette from server team state.

## Accessory socket architecture

`CharacterAccessories.ts` defines six one-at-a-time cosmetic choices:

- None
- Utility pack
- Compact pack
- Tech pack
- Trail pack
- Shoulder badge

Definitions contain a socket plus local position, rotation, and scale. The factory creates `HeadSocket`, `FaceSocket`, `BackSocket`, `ShoulderSocket`, `ChestBadgeSocket`, and `HipSocket` on real skeleton bones. Head options and accessories inherit animation from those bones and do not affect hitboxes or statistics.

## Weapon attachment

The weapon is parented to `RightHandWeaponSocket` and uses weapon-specific local mount transforms. Each launcher exposes named `MuzzleSocket` and `LeftHandSupport` anchors. The revised upper-arm and forearm pose brings both hands around the launcher while keeping the barrel clear of the torso and away from the camera.

## Files changed or created

- `packages/shared/src/index.ts`
- `packages/shared/src/appearance.test.ts`
- `apps/server/src/appearanceFlow.integration.test.ts`
- `apps/web/src/ui/PremiumCharacterCreator.tsx`
- `apps/web/src/ui/CharacterCreator.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/game/characters/CharacterAppearance.ts`
- `apps/web/src/game/characters/CharacterAppearance.test.ts`
- `apps/web/src/game/characters/SharedSkinnedStudent.ts`
- `apps/web/src/game/characters/CharacterAccessories.ts`
- `apps/web/src/game/characters/CharacterAccessories.test.ts`
- `apps/web/src/game/characters/CharacterEquipment.ts`
- `apps/web/src/game/characters/CharacterEquipment.test.ts`
- `apps/web/src/game/characters/CharacterFactory.ts`
- `apps/web/src/game/characters/CharacterFactory.performance.test.ts`
- `apps/web/src/game/characters/CharacterModel.ts`
- `apps/web/src/game/characters/CharacterAnimator.ts`
- `apps/web/src/game/characters/CharacterAnimator.test.ts`
- `design-qa.md`

## Visual evidence

- Final lobby: `after/lobby-final-wide.png`
- Reference comparison: `design-comparison.png`
- Flat-grey comparison: `silhouette-comparison.png`
- Turnarounds: `after/view-front.png`, `view-left.png`, `view-right.png`, `view-rear.png`, `view-three-quarter.png`, and `view-rear-three-quarter.png`
- Teams: `after/team-red.png` and `after/team-blue.png`
- Accessories: `after/accessory-*.png`
- Poses: `after/pose-walk.png`, `pose-crouch.png`, and `pose-aim.png`

## Multiplayer and performance results

- 40 authenticated Socket.IO clients: passed.
- Connection: 222 ms.
- Start fan-out: 100 ms.
- Reconnect: 4 ms.
- Largest initial room state: 32,748 bytes.
- Movement fan-out payload: 4,490 bytes.
- 40 model construction: 692 ms in the automated Node test.
- Shared resources for 40 players across both teams: two body geometries and two body materials.
- Per body: 4,314 triangles, 12,942 vertices, 13 bones, one skinned mesh, one body material.
- Sampled lobby preview: 14 draw calls, 6,738 rendered triangles, 12 geometries, two textures, 1.25 pixel ratio.
- Preview resolution remains clamped to 1.5 device-pixel ratio and rendering pauses while the document is hidden.

## Known limitations

- The model remains procedural rather than an authored GLB.
- Rigid per-part weights prioritize predictable cost over soft joint deformation.
- The left support hand uses a tuned pose and named target, not runtime IK.
- Hardware FPS was not measured on a physical Chromebook; the delivered checks cover construction time, resource sharing, draw/triangle budgets, network load, and automated regression behaviour.
