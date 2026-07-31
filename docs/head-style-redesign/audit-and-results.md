# QuizStrike Complete Head Style Redesign

## Root cause

The procedural `THREE.SkinnedMesh` permanently included a human cranium, jaw, ears, nose, and brows. `CharacterFactory` then attached every cap, helmet, mask, hood, or beanie as another object under the same `Head` bone. The rigging was valid, but the visible result could only be an unchanged human head with a second silhouette stacked over it.

## Existing architecture audit

- `SharedSkinnedStudent.ts` builds one rigid-weighted procedural skinned mesh and a 13-bone skeleton. The `Head` bone is parented to the torso and is animated by `CharacterAnimator`.
- `CharacterFactory` is used by both `CharacterPreview` in the lobby and `CharacterManager` in gameplay.
- `CharacterManager` rebuilds a player's model when the serialized appearance changes and disposes the removed model.
- `CharacterHitboxController` owns a fixed gameplay head box derived from `CHARACTER_HITBOXES`; render meshes are not used for collision or damage.
- The FPS local world character is excluded by `CharacterManager`. `ArenaPreview` renders a separate arms-and-weapon view model attached to the camera.
- `PlayerSession.appearance` is already part of authoritative session snapshots. The same state supports lobby updates, match transition, late join, reconnect, bots, and optional browser persistence.
- No GLB/GLTF character or animal-head assets are present. The initial styles therefore use bounded procedural placeholders designed to be replaceable.

## Architecture

- The shared skinned body is now deliberately headless while retaining its existing `Head` bone and neck geometry.
- `CharacterHeadStyles.ts` is the visual registry. Every definition has one stable ID, one builder or future asset field, and centralized position/rotation/scale calibration.
- `CharacterFactory` attaches exactly one `HeadStyle_*` group to `HeadSocket`.
- The initial IDs are `human`, `fox`, `panda`, `bear`, `rabbit`, and `robot`.
- All styles use the same forward direction (face toward local `-Z`), head-bone origin, scale convention, approximate eye line, and neck overlap.
- Neutral animal/robot materials preserve player identity while the unchanged uniform and armour continue to own Red/Blue team readability.
- A developer-only `?characterSockets=1` view now includes the head origin axes and cosmetic envelope.
- An unknown or failed style logs a warning and builds `human`.

## Cosmetic data and compatibility

Appearance version 4 stores:

```ts
{
  headStyleId: "fox"
}
```

Only this stable string is serialized. Meshes, geometry, materials, and Three.js objects never cross the network.

Versions 1-3 stored accessory-era values such as `headOption: "visor"` or legacy helmet/eyewear fields. Sanitization maps all of those values to `headStyleId: "human"` and upgrades the record to version 4. Existing body, back, badge, victory, and safe decal choices continue through the existing migration rules.

## Multiplayer

No second transport was added. The server validates `headStyleId` through the shared allow-list, writes the sanitized `PlayerAppearance` onto the existing `PlayerSession`, and broadcasts the normal session snapshot. Lobby preview, match transition, remote players, reconnects, late joins, bots, and optional cross-session browser persistence therefore use the same state and the same character factory.

## Files changed

- `packages/shared/src/index.ts` — version 4 schema, stable style IDs/catalog, presets, validation, and legacy migration.
- `packages/shared/src/appearance.test.ts` — schema, rejection, unlock, and legacy migration coverage.
- `apps/web/src/game/characters/CharacterHeadStyles.ts` — complete-head registry, initial six visual builders, calibration, fallback, and debug envelope.
- `apps/web/src/game/characters/SharedSkinnedStudent.ts` — removes the permanently baked human head while retaining the rig and neck.
- `apps/web/src/game/characters/CharacterFactory.ts` — attaches one complete head and exposes debug alignment.
- `apps/web/src/game/characters/CharacterAccessories.ts` — removes the obsolete head-accessory builders; back and detail systems remain.
- `apps/web/src/game/characters/CharacterAppearance.ts` — resolves and serializes `headStyleId`.
- `apps/web/src/ui/CharacterCreator.tsx` — shared style presentation and corrected preview framing.
- `apps/web/src/ui/PremiumCharacterCreator.tsx` — Head Style language and immediate complete-head selection.
- `apps/web/src/styles.css` — compact explanatory copy styling.
- Character, performance, and real HTTP/Socket.IO tests — complete-head, fallback, hitbox, sharing, rapid replacement, 40-player, reconnect, and snapshot coverage.

## Adding Tiger

1. Add `"tiger"` to `HEAD_STYLE_IDS` and its name/description/unlock metadata to `HEAD_STYLE_CATALOG` in `packages/shared/src/index.ts`.
2. Add a `createTiger(materials)` builder in `CharacterHeadStyles.ts`, or set its future cached GLB asset path after the project's first shared head-asset loader is introduced.
3. Add `tiger` to `HEAD_STYLE_REGISTRY` with its centralized `position`, `rotation`, and `scale`.
4. Add a UI icon mapping in `CharacterCreator.tsx`.
5. Run the bounded-envelope, fallback, rapid-switch, 40-character, multiplayer, and visual-angle checks. No gameplay, hitbox, camera, or networking code should change.

## Verification

- Full workspace typecheck: passed.
- Production build: passed.
- Focused automated coverage: 24 tests passed, including real HTTP and Socket.IO flows with 40 authenticated clients.
- Rapid Human/Fox/Panda/Bear/Rabbit/Robot replacement: one scene character and one primary head after every change.
- Two players with the same style: distinct scene nodes with shared immutable resources.
- Invalid style: safe Human fallback with a developer warning.
- Fixed headshot region: unchanged `4x` region and dimensions.
- Lobby-to-match transition, reconnect, late snapshot, and 40-player state: passed through the existing appearance integration suite.
- Clean browser load after implementation: no console warnings or errors.
- First-person match: arms and weapon only; no local head geometry entered the camera.
- Vertical movement/respawn: the active complete head stayed attached at non-zero world height and through the respawn cue.
- Visual checks: front, back, left, right, front three-quarter, rear three-quarter, Red/Blue, walk, crouch, aim, and six-player match.

The repository's top-level `npm test` launcher still has a pre-existing Windows glob issue: the quoted `src/**/*.test.ts` pattern is not expanded by `cmd.exe`. Tests were run with the same `tsx --test` runner using explicit paths.

## Visual review

The initial preview framing clipped Rabbit ears and the Robot antenna. The camera target, distance, and zoom bounds were corrected, then the affected styles and angles were recaptured.

Accepted screenshots are in `docs/head-style-redesign/after/`. The complete heads keep their mass close to the former human envelope; Rabbit ears and the Robot antenna use the permitted moderate vertical extension. The lower face shapes overlap the collar/neck area without a floating gap. Red and Blue remain immediately distinguishable.

## Follow-up recommendations

- Replace the procedural placeholders with artist-authored GLB heads after defining one cached head-asset loader and approving an art export contract.
- Give all final assets a consistent facial-expression language and texture budget.
- Add a dedicated close-range head-style row to Character Lab so all styles can be compared simultaneously without creating a classroom.
- Fix the Windows test glob in workspace scripts separately.
