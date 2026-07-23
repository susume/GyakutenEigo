# Character Customization Phase 3 Integration Audit

## Outcome

Phase 3 closes the route-level automation gap identified after retention hardening. The Express/Socket.IO runtime can now be imported without automatically opening a port or starting background timers when `QUIZSTRIKE_NO_AUTOSTART=true`. Normal development and production startup behavior is unchanged.

`apps/server/src/appearanceFlow.integration.test.ts` starts the real HTTP server on an ephemeral loopback port and exercises the same middleware, parsers, JWT checks, stores, session maps, and lifecycle functions used in production.

## Automated classroom evidence

The end-to-end appearance flow verifies:

- a student token cannot change another student's appearance;
- processed PNG upload succeeds only through the authenticated player route;
- teacher metadata exposes ownership, size, and lifecycle data without image bytes;
- another student in the same room can read the private asset, while another room's token cannot;
- an uploaded decal can be attached to compact appearance state and survives the authenticated rejoin route;
- rapid repeated saves are rate-limited;
- match start locks customization;
- ending the session purges metadata, bytes, and the asset read path.

The classroom-capacity flow concurrently joins 40 unique students, rejects student 41, concurrently saves 40 allow-listed appearances, verifies the public session contains exactly 40 complete appearance records and no inline image/base64 payload, and confirms reconnect state for a representative student.

## Verification baseline

- workspace typecheck: passed;
- shared tests: 62 passed;
- server tests: 14 passed, including 2 real HTTP integration scenarios;
- web tests: 59 passed;
- total: 135 passed;
- production shared/server/web build: passed;
- `git diff --check`: passed.

The existing Vite warning for the approximately 505 kB Three.js chunk remains informational and is unrelated to this phase.

## Residual risk and next phase

The new harness validates server behavior and bounded synchronized state, but it does not render 40 WebGL characters, measure frame time or texture memory, drive real Socket.IO clients, or test browser camera/touch/accessibility behavior.

Phase 4 subsequently added a production-Chromium classroom flow and a 40-client Socket.IO load scenario with payload and propagation telemetry. Physical low-end GPU certification, a multi-browser/device matrix, camera/touch automation, and 40 simultaneously rendered browser clients remain open. Production GLB/UV art remains a separate art-pipeline dependency.
