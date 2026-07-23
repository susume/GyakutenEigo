# Character Customization Post-Implementation Audit

## Audit scope and evidence

This review covers the current uncommitted character-customization implementation across the shared schema, Express/Socket.IO server, React lobby, Three.js renderer, image processor, teacher controls, tests, and deployment documentation. The baseline was rechecked with `git diff --check`, workspace typechecking, 128 automated tests, a production build, and authenticated live API smoke flows.

## What is sound

- **Authoritative identity boundary:** student appearance and upload routes bind the room, player ID, and signed student token. A student cannot update another player. Teacher moderation routes use the existing owner JWT middleware.
- **Compact synchronization:** only allow-listed `PlayerAppearance` data and opaque UUIDs enter `PlayerSession`; image bytes never enter `session_state` or movement messages.
- **Safe defaults and compatibility:** old runtime snapshots are sanitized, every player gets a valid default, arbitrary URLs/fields/colours are rejected, and failed texture loads render the normal character without blocking a match.
- **Renderer integration:** the implementation extends `CharacterFactory`, `CharacterManager`, the shared skinned body, existing equipment, and existing scene synchronization. It does not introduce a separate gameplay character stack.
- **Resource discipline:** appearance signatures rebuild only the changed character; replaced textures, instance-owned geometry, badges, and character records are disposed. Shared body variants are reference-counted and cache-bounded.
- **Privacy-default image flow:** original files remain local, Canvas redraw removes EXIF/location metadata, output dimensions/bytes are capped, server magic/structure/dimension checks reject spoofed content, uploads default off, and AI is fail-closed.
- **Lobby continuity:** room status, team choice, joined count, start transition, reconnect, and gameplay state remain in the existing student flow. The creator lazy-loads and pauses rendering in hidden tabs.

## Findings

### P1 — room image retention is incomplete

`finishSession` does not remove room decals, upload/appearance rate maps are never cleared, and disabling uploads/resetting everyone removes referenced decals but may leave a just-uploaded unreferenced decal. An abandoned waiting room can therefore retain processed image bytes until the server process restarts. This is the largest privacy and memory gap.

### P1 — teacher moderation does not actually preview submissions

The live teacher roster reports “sticker submitted,” but its `Sticker` button removes the sticker rather than previewing it. The overview arena may show a very small applied chest badge, but it is not a practical moderation surface. The UI needs authenticated thumbnails, explicit View/Remove actions, byte/time metadata, and an empty state.

### P1 — restored snapshots retain stale decal IDs

Binary decals intentionally are not persisted, while `PlayerSession.appearance.decalAssetId` is in the runtime snapshot. After restart, the server restores a reference to an asset that cannot exist. Rendering falls back safely, but every client makes a guaranteed 404 request and the stale state remains visible to moderation controls.

### P2 — no room-level asset quota or expiry

Per-player upload replacement and rate limiting bound abuse partially, but there is no explicit room-byte ceiling or maximum retention age. The intended 40-player case should have a measured hard cap independent of client behaviour.

### P2 — parser failures are inconsistent

`express.raw` and `express.json` size failures are not normalized by a JSON error handler. The web client then receives a generic error instead of the age-appropriate upload-size message used by normal validation failures.

### P2 — editor modal accessibility is incomplete

The decal editor has dialog semantics but does not focus the dialog, trap Tab, restore focus, or close on Escape. Upload and camera capture are also combined into one input with `capture="environment"`, which can remove the normal file choice on some touch browsers.

### P2 — endpoint behaviour is smoke-tested, not automated

Pure schema and file inspection have automated coverage, while room isolation, rate limiting, start locking, moderation, lifecycle cleanup, and authenticated asset reads rely on the manual checklist/live smoke command. The server’s monolithic startup currently makes route-level tests expensive.

## Next phase decision

The next phase is **Moderation and Retention Hardening**, because it closes the remaining student-image privacy risks without requiring unavailable production GLBs, an external moderation service, or an AI provider.

Scope:

1. Introduce a tested bounded decal store with room quotas, replacement rules, expiry, metadata listing, and room/player cleanup.
2. Purge room assets at session end, upload disable, and reset-all; strip stale IDs during hydration.
3. Add a teacher-only metadata endpoint and authenticated thumbnail gallery with explicit preview/remove controls.
4. Normalize parser/size failures to JSON.
5. Complete dialog focus/Escape/Tab behaviour and separate Upload from Camera controls.
6. Add unit tests for quota, expiry, cleanup, and metadata safety, then repeat full verification.

Deferred after this phase: production GLB/UV art, Japanese localization infrastructure, Playwright multi-browser/load automation, durable encrypted object storage, and any moderated AI adapter.

## Phase 2 completion

Implemented after this audit:

- bounded 32 MiB room stores with eight-hour expiry and tested pending-asset replacement;
- cleanup on room end, upload disable, reset-all, player clear, and expiry;
- stale decal removal during runtime-snapshot hydration;
- teacher-only metadata listing, authenticated thumbnails, enlarged review, and per-asset removal;
- consistent JSON body-size/parse failures;
- editor focus trap, Escape, focus restoration, body-scroll lock, and separate Upload/Camera controls;
- five new server unit tests covering quota, metadata privacy, replacement, cleanup, and expiry.

Phase 3 subsequently closed the HTTP route-level gap with an import-safe server lifecycle, a complete authenticated appearance/decal integration flow, and a concurrent 40-student capacity scenario. Socket.IO load, rendered browser/WebGL multiplayer, and device telemetry remain manual and are tracked in `character-customization-phase-3-testing.md`.
