# QuizStrike Waiting Room — Audit and Implementation Plan

## Current-state audit

### Entry and lifecycle

- `StudentExperience` in `apps/web/src/App.tsx` owns join/rejoin, polling, Socket.IO synchronization, student identity, authoritative session/player updates, and waiting-to-match routing.
- The former waiting room reused the global game HUD and action bar while placing the character creator inside the same stage. This produced the crowded white panel, duplicated status information, and internal scrolling shown in the supplied screenshots.
- The redesign keeps the existing route and session lifecycle. Only presentation branches on `session.status === "waiting"`; active rounds still mount `ArenaPreview` and the full combat HUD.

### Appearance schema and persistence

- `PlayerAppearance` in `packages/shared/src/index.ts` remains the canonical multiplayer-safe schema.
- `PUT /api/sessions/:code/players/:playerId/appearance` in `apps/server/src/index.ts` still performs player-token authorization, waiting-room locking, policy enforcement, validation, sanitization, rate limiting, decal ownership checks, authoritative state updates, and broadcast.
- The new creator does not add arbitrary client fields. It maps visual choices back to the existing preset, helmet, eyewear, backpack, shoe, colour, decal, and version fields.

### Team selection

- Team choice continues through the authoritative `chooseTeam` API. The client now ignores no-op selections, applies a short input guard, and disables both team controls while a request is in flight.
- Team counts are derived from connected session players and update with the existing session synchronization.

### Character and equipment

- `CharacterFactory.createCharacter` remains the shared construction path for the lobby preview and in-match characters.
- `SharedSkinnedStudent` builds a lightweight merged, seven-weight-index-compatible skinned body. Geometry was refined with rounded/tapered primitive forms while preserving collider and animation assumptions.
- Weapon placement previously depended on root-space offsets. The launcher is now mounted under a named right-hand bone socket with data-driven per-weapon transforms, a named muzzle, and a named left-hand support target.
- Backpack equipment is attached to the torso bone rather than the character root.

## Implemented plan

1. Split the waiting room from the in-match HUD and action bar.
2. Replace duplicated status blocks with one compact instruction/team header.
3. Build a 60/40 lobby creator that fits at 1366 × 768 without internal scrolling.
4. Reduce customization to four visible categories: preset, main colour, head option, and accessory.
5. Expand school-safe presets from three to six while preserving the server schema.
6. Upgrade the 3D stage with lighting, platform, restrained idle presentation, drag/pinch/wheel controls, reset, responsive sizing, and cleanup.
7. Refine the procedural character silhouette and move equipment to named sockets.
8. Add debounced autosave with explicit states, permanent-error retry, and one automatic cooldown retry.
9. Preserve waiting-room policy controls, sanitization, decals, Socket.IO updates, and teacher start behavior.
10. Validate with browser interaction, side/rear socket inspection, production build, and the full automated suite.

## Result

The waiting room is now visually and structurally distinct from the match, uses the existing real-time architecture, and retains one canonical appearance definition across preview and gameplay.
