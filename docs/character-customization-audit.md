# Lobby Character Creator: Codebase Audit

## Relevant architecture

- `apps/web/src/App.tsx` is the React 19 application shell. `SessionManager` owns teacher session setup and live-room controls; `StudentExperience` owns join, local reconnect storage, the Socket.IO subscription, the waiting-room overlay, and the lobby-to-match transition.
- `apps/web/src/api/client.ts` is the only HTTP client. It selects the configured Vite API origin, adds teacher JWTs or `X-Player-Token`, and exposes `teacherApi` and `studentApi`.
- `apps/server/src/index.ts` is the Express 5 and Socket.IO 4 server. It keeps authoritative sessions in memory, optionally mirrors the complete runtime snapshot into PostgreSQL through Prisma, signs eight-hour student JWTs, and coalesces `session_state` broadcasts into 75 ms windows.
- `packages/shared/src/index.ts` contains the wire/domain types and reusable validation/game rules. `GameSession.players` carries the complete `PlayerSession` records sent to teachers and students.
- `prisma/schema.prisma` contains normalized account/session models, but live gameplay currently persists through the JSON `RuntimeSnapshot`; the normalized `PlayerSession` table is not the live source of truth.
- `apps/web/src/game/ArenaPreview.tsx` owns the Three.js scene and creates one `CharacterFactory` and `CharacterManager` per arena.
- `apps/web/src/game/characters/CharacterFactory.ts` builds the actual procedural in-game character and first-person weapon model. `SharedSkinnedStudent.ts` creates one rigid-weighted `THREE.SkinnedMesh`; `CharacterEquipment.ts` creates modular weapons and backpack shapes.
- `CharacterAppearance.ts` currently derives an appearance from team, player id, and gear. It already has allow-listed variants, helmet styles, backpack styles, team palettes, and compact serialization.
- `CharacterManager.sync` creates remote characters and reconstructs animation locally from position updates. Bones and textures are never sent over the network.

## Player and lobby flow

1. `StudentExperience.join` calls `POST /api/sessions/:code/join` with a classroom nickname.
2. The server validates the room and nickname, balances the team, creates a `PlayerSession`, signs a scoped student token, broadcasts `session_state`, and returns the player, session, token, and first question.
3. The browser stores only `{sessionCode, playerId, playerToken}` in `quizstrike_student_session`. On reload, `StudentExperience` calls the authenticated `rejoin` route and restores the authoritative player from the server.
4. The student joins a Socket.IO room with code, player id, and token. The server binds the socket to that exact player. Lobby and game state changes are sent as compact `session_state` snapshots; movement uses separate volatile `player_position` events.
5. While `session.status === "waiting"`, the same arena is mounted with controls disabled and `pre-round-card` shows room/team status. Team selection calls the token-protected team endpoint.
6. `SessionManager.start` calls the teacher-only start route. The server prepares all round state and broadcasts the session. `StudentExperience` sees the waiting-to-active transition, closes the waiting presentation naturally, and enables arena input.
7. `ArenaPreview` passes `session.players` into `CharacterManager.sync`. The manager creates a character from `player.id`, `team`, and `gear`. Reconnect restores the same `PlayerSession`, so any new appearance field on that record will survive reconnect and match transition.

## Existing assets and rendering constraints

- There are no GLB/GLTF character assets in the repository. The production-art directories documented in `docs/character-system.md` are future integration points.
- The current shared body is skinned, but procedural and coloured with baked vertex colours. It does not have an authored UV layout suitable for arbitrary full-character textures.
- Existing modular silhouettes can safely support body/role preset, helmet, backpack, team accents, clothing colours, footwear colour, and small code-authored eyewear.
- A scan can safely be attached as a small plane on the chest or backpack. Full-body skins would require a production UV contract and are out of scope for this asset set.
- Material/geometry caches already exist. Appearance colours must remain allow-listed to avoid unbounded shader/material variants with a 40-player classroom.

## Safest integration points

- Add `PlayerAppearance` and `CharacterCustomizationSettings` plus pure sanitizers in `packages/shared/src/index.ts`.
- Store sanitized appearance directly on `PlayerSession`, and customization policy in `SessionSettings`. This automatically uses existing lobby snapshots, persistence, start transition, late join, and reconnect paths.
- Add authenticated appearance/decal endpoints beside the existing team and rejoin endpoints. Keep the server authoritative and reject updates outside the waiting state or policy.
- Extend `CharacterAppearance`, `CharacterFactory`, and `CharacterManager` rather than creating a second game renderer. A small lobby preview may instantiate the same `CharacterFactory` in its own lightweight scene.
- Extend `SessionManager` with session defaults and live moderation actions; ownership is already enforced on all teacher routes.

## Risks and controls

- Appearance updates can amplify full-session broadcasts. Debounce client edits, require explicit save, rate-limit writes, cap serialized JSON, and continue using the existing 75 ms broadcast coalescer.
- A unique colour per student would defeat material reuse. Use a short shared colour allow-list and shared geometry/material cache keys.
- Uploaded images may contain faces, names, location metadata, or offensive material. Do not retain originals. Decode and redraw in the browser (stripping EXIF), cap dimensions and bytes, inspect file signatures server-side, use unguessable IDs, scope assets to the room, require a player token, and keep uploads off by default.
- The current runtime snapshot is JSON and is unsuitable for binary assets. Decals should be ephemeral room assets by default; only their opaque ID belongs in player state.
- There is no moderation or approved AI provider. AI controls must stay disabled and the browser must never receive a service key.
- The app has no localization framework. Initial copy should be short, icon-assisted, keyboard-accessible English consistent with the existing UI; localization keys are a follow-up.

## Reuse instead of rebuild

The implementation reuses the student JWT boundary, teacher ownership middleware, room broadcasts, runtime snapshot, reconnect storage, lobby status UI, session settings form, procedural skinned character, modular equipment, material caches, LOD manager, and existing lazy-loaded Three.js bundle.
