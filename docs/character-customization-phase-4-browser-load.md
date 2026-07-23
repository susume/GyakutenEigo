# Character Customization Phase 4 Browser and Socket.IO Audit

## Outcome

Phase 4 adds two durable classroom harnesses:

- `npm run test:load` starts the real server on an ephemeral port and connects 40 authenticated Socket.IO students;
- `npm run test:e2e` builds the production app, starts the built server and Vite preview, and runs a real Chromium student flow.

Playwright retains a trace, screenshot, and video on failure. Its browser/config files have a separate TypeScript check, and generated reports are ignored by Git.

## Socket.IO load evidence

The 40-client scenario verifies student-token binding, rejects a mismatched player/token binding, receives a complete room state on every client, propagates match start to all 40 clients, fans 39 peer movement updates to an observer, and reconnects a student after the server's disconnect grace period.

Hard assertions keep each full session state below 128 KiB, require at least 35 distinct movement senders under volatile delivery, and reject inline `data:image` content. The latest local run measured:

- 40 connections ready in 321 ms;
- match-start fan-out in 149 ms;
- reconnect in 6 ms;
- largest full room state: 41,028 bytes;
- observed movement senders: 39 of 39;
- observed movement application payload: 4,490 bytes.

These are regression observations, not service-level guarantees. CI and school-network latency will differ.

## Production browser evidence

The Chromium scenario creates a teacher, quiz, and room through the real API, joins through the visible student form, opens the real Three.js creator, changes an appearance, observes its auto-save request, reloads, confirms server-backed restoration, starts the match as the teacher, and requires an active `session_state` Socket.IO frame. It also asserts bounded socket frames, no inline image data, and no uncaught page errors.

The browser run uses `prefers-reduced-motion: reduce`. The creator now honors that preference by rendering on state or user changes without automatic rotation.

## Performance finding fixed

The first browser trace revealed that the waiting room loaded the full arena and the creator preview simultaneously. That created two WebGL contexts and delayed interaction under software rendering. The waiting room now defers the full arena until match start and uses only the focused character preview. This reduces lobby GPU/CPU work without changing authoritative session behavior.

## Remaining certification work

- run 40 rendered clients or an equivalent GPU workload on representative Chromebooks;
- record renderer memory and frame-time recovery after repeated decal/appearance replacement;
- add touch, camera/file chooser, keyboard dialog, and 200% zoom browser cases;
- expand Playwright to the approved ChromeOS/Edge/mobile-device matrix;
- run a longer Socket.IO soak on the intended school network.

Production GLB/UV assets and any moderated AI provider remain separate dependencies.
