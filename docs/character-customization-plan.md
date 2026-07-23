# Lobby Character Creator: Staged Implementation Plan

## Stage 1: shared contract and validation

- Modify `packages/shared/src/index.ts` with compact allow-listed `PlayerAppearance`, `CharacterCustomizationSettings`, defaults, size limits, and sanitizers.
- Add `appearance?: PlayerAppearance` to `PlayerSession` and customization policy to `SessionSettings` with backward-compatible defaults for old runtime snapshots.
- Add shared unit tests for malformed values, arbitrary URLs, invalid colours, and policy defaults.

## Stage 2: authoritative server and asset lifecycle

- Modify `apps/server/src/index.ts` to assign a valid default on join/bot creation and sanitize hydrated snapshots.
- Add a token-protected player appearance update endpoint with waiting-room enforcement, per-player rate limiting, and a small JSON limit.
- Add an upload endpoint for already-processed PNG/WebP bytes. Inspect magic bytes and declared MIME type, cap bytes, require room authorization, create an unguessable asset ID, and store only the processed result in an ephemeral private map.
- Add a room-scoped decal read endpoint with immutable private caching semantics and no directory listing.
- Add teacher-owned policy, clear-player, remove-decal, and reset-all endpoints. Lock all customization at match start. AI enablement is rejected unless a server provider is configured.
- Delete a player's replaced decal and clear ephemeral room assets when they are no longer referenced.

## Stage 3: actual renderer integration

- Modify `CharacterAppearance.ts` to merge a validated player selection with team-required accent colours.
- Modify `CharacterFactory.ts`, `CharacterEquipment.ts`, and `CharacterManager.ts` so the in-game character uses the chosen preset, helmet, backpack, eyewear, clothes, footwear, and optional badge texture.
- Recreate only a player's model when the compact appearance signature changes. Keep geometry/material reuse and dispose only instance-owned decal textures/materials.
- Keep safe defaults when configuration or a decal request is missing.

## Stage 4: student lobby experience

- Create a lazy-loaded character creator component and a lightweight preview that uses `CharacterFactory`, pauses while the document is hidden, supports pointer drag and wheel/pinch-safe zoom, and caps device pixel ratio.
- Add preset, randomize, reset, save, saved-state feedback, and responsive controls without hiding room/team/player status.
- On match start, lock controls; the last server-confirmed appearance is already the spawn appearance. Unsaved local edits are auto-saved when the waiting state begins transitioning where the request can still be accepted; otherwise the previous valid server value is the fallback.
- Cache non-decal preferences in local storage only when the teacher enables future-session persistence.

## Stage 5: scan-to-decal

- Create a local Canvas editor for upload/camera input, crop/scale/reposition, 90-degree rotate, brightness, contrast, posterize, simple light-background removal, and sticker outline.
- Decode with browser APIs, reject large/invalid input early, redraw to a maximum controlled resolution, and export PNG/WebP. Canvas export removes EXIF/location metadata; the original is never uploaded.
- Upload only the processed bytes. Show privacy copy encouraging drawings and patterns, never private photos or personal information.
- Define a disabled `SkinGenerationProvider` interface and configuration hook. No AI request is exposed until an authenticated, moderated backend provider exists.

## Stage 6: teacher controls and verification

- Add create-session toggles for customization, uploads, presets-only, and browser persistence. AI remains visibly unavailable unless the backend reports a configured provider.
- Add live clear/remove/reset actions and compact appearance/decal status in the roster.
- Add unit tests for validation, image-processing helpers, appearance signatures, and server policy helpers. Run typecheck, tests, and production build.
- Document configuration, privacy lifecycle, deployment (no schema migration because live state uses `RuntimeSnapshot`), a two-browser multiplayer checklist, 40-player checks, and known limitations.

## Failure behavior

Invalid or rate-limited updates retain the previous server appearance. Missing or failed decal textures render without a decal. Upload/AI policy failures do not block joining or match start. Old sessions are hydrated with default policy and players receive deterministic default appearances.
