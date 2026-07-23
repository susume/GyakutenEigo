# Character Customization Operations

## Configuration and deployment

No Prisma migration is required. Appearance and room policy are backward-compatible fields in the existing `RuntimeSnapshot` JSON. Deploy the shared package before the server and web builds with the normal commands in `docs/online-play.md`.

Defaults are privacy-first:

- standard creator: enabled;
- student image uploads: disabled;
- AI designs: disabled;
- approved presets: available;
- cross-session browser persistence: disabled;
- processed decal lifetime: current server process/current room only.

The upload route accepts only processed PNG or WebP bytes up to 384 KiB. Browser source files are limited to 5 MiB and 8192 pixels on either axis; output is at most 512 x 512. The Canvas redraw removes EXIF and GPS metadata. Original files are never sent or stored.

Decals live in a private bounded in-memory store, are addressed by UUID, require a valid room student token or owner-teacher JWT to read, and are not included in Socket.IO state. `PlayerSession.appearance.decalAssetId` is the only synchronized reference. Each room has a 32 MiB hard ceiling. Assets are deleted when the room ends, uploads are disabled, the teacher resets appearances, or the eight-hour retention window expires. Server restarts intentionally remove decals and stale snapshot IDs are stripped during hydration.

Teachers can review authenticated thumbnails, open a larger private preview, see active/pending state and byte usage, and remove one asset without clearing unrelated clothing choices. The metadata response never contains image bytes.

`SkinGenerationProvider.ts` is the AI integration contract. The shipped provider is deliberately unavailable and server policy is fail-closed. A future adapter must add authenticated server transport, approved styles, input/output moderation, deletion of temporary sources, and audit events before `aiEnabled` can ever become true. Never put a provider key in `VITE_*` variables.

## Manual multiplayer checklist

1. Create a room with customization enabled and uploads off. Join from two separate Chrome profiles.
2. Confirm both students start with a valid default, can change every enabled category, randomize, reset, save, and continue seeing room/team/join status.
3. Confirm each browser sees the other's saved colours, equipment, eyewear, and preset in the arena; verify one student's token cannot update the other player's route.
4. Reload one student browser and confirm the server appearance restores with the existing student token.
5. Start while a creator is open. Confirm controls disappear/lock, the last auto-saved appearance spawns, and gameplay/scoring/input are unchanged.
6. Enable uploads as teacher. Try the separate Upload and Camera paths with JPEG/PNG/WebP artwork, crop/scale/reposition/rotate, brightness/contrast, background removal, posterize, and outline. Confirm only the processed sticker reaches the server.
7. Open Sticker Review on the teacher page. Confirm authenticated thumbnails, enlarged preview, active/pending state, room byte usage, per-asset removal, Escape, focus restoration, and an empty state.
8. Try an SVG/executable, a spoofed MIME type, a file over 5 MiB, processed output over 384 KiB, rapid uploads, arbitrary asset IDs, another room's asset ID, and room-quota exhaustion. Confirm each fails safely with JSON errors.
9. Disable uploads and confirm active and pending decals are removed. Clear one player, reset everyone, and end the room; confirm byte usage returns to zero and remote clients update.
10. Set presets-only and confirm custom configurations are server-rejected while the three approved presets still save.
11. Disconnect/reconnect, join late, and repeat with two simultaneous editors. Confirm the complete `session_state` includes compact appearance only and no base64/image bytes.
12. Run the automated 40-student HTTP scenario, then run 40 rendered players in `/character-lab`. Record lobby FPS, renderer memory, WebSocket bytes, decal downloads, match-start time, and memory after repeated character/decal replacement.
13. Test Chrome on Windows, ChromeOS-equivalent throttling/integrated graphics, touch drag/camera input, keyboard navigation, dialog focus trapping, 200% browser zoom, reduced motion, and a hidden/background tab.

## Known limitations

- The repository has procedural development character art, not final artist-authored GLBs. There are no male/female meshes; the UI exposes only body/role silhouettes that really exist.
- The body has vertex colours and no production UV atlas. Scans are equipment/chest decals, not full-character skins.
- Background removal is a deterministic light-background threshold, not semantic segmentation.
- There is no content-moderation service or AI provider. Teachers must explicitly enable uploads and can clear submissions; production deployments that permit uploads should add an approved moderation queue and retention audit.
- Decals are intentionally ephemeral and disappear on room end, eight-hour expiry, or server restart. Durable school-managed assets need encrypted object storage, deletion jobs, authorization checks, and administrator policy.
- The app currently has no localization framework; creator labels use short English text and icons. Japanese localization should be added with the rest of the application rather than a one-off string system.
- Real HTTP capacity, 40 authenticated Socket.IO clients, and one production-Chromium student flow are automated. Forty simultaneously rendered browsers, physical GPU profiling, camera/touch input, and the wider browser/device matrix remain manual before classroom release.

## Recommended next work

Add production GLB/UV assets, an end-to-end Playwright classroom harness, Socket.IO/network/texture telemetry, Japanese localization, and—only after school approval—a moderated server-side generation adapter.
