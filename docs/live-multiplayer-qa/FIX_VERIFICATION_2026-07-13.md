# Current issue fix verification

Date: 2026-07-13 (Asia/Tokyo)
Target: local authorized development environment

The three issues from the continuation audit were fixed and verified against the running server.

## QA-LIVE-006 — cause-specific join errors

- The student join form no longer appends invalid-code guidance to every failure.
- Duplicate nicknames now suggest choosing another nickname.
- Full rooms now suggest asking the teacher to make space or joining another room.
- Invalid codes retain code-check guidance; connection failures retain connection guidance.
- Automated coverage: two web tests in `apps/web/src/studentJoinErrors.test.ts`.

## QA-LIVE-007 — active-room late joins

- `POST /api/sessions/:code/join` now rejects new identities after the round starts with `409` and `This session has already started.`.
- Existing students can still use the authenticated rejoin endpoint during an active round.
- Live API verification: a fresh identity submitted after `Round Active` received the expected `409` response and no roster entry.

## QA-LIVE-008 — disconnected-player cleanup

- Student Socket.IO room joins now authenticate the player identity and token.
- The server tracks all sockets for a player token and marks the player Offline only after the last socket closes.
- Disconnect cleanup immediately broadcasts `connectionState: disconnected`, drops a carried Flag, and records an Offline event.
- A five-second grace timer allows refresh/reconnect recovery before Flag/Zombie win reevaluation.
- Teacher active counts exclude disconnected players; authoritative target selection excludes them too.
- Live Socket.IO verification: a closed Classic player was marked disconnected, rejoined successfully, and a closed Flag carrier changed from `carried` to `dropped`; after grace, the one-round Flag session ended for Blue.

## Validation

- Shared tests: 48 passed.
- Web tests: 33 passed.
- Server typecheck: passed.
- Web typecheck: passed.
- Full shared/server/web production build: passed.
- `git diff --check`: passed.

## Remaining audit gaps

The broader audit remains bounded. Complete Flag placement/capture races, Zombie projectile conversion races, knocked-out refresh, host disconnect, hold/release scoreboard semantics, 40-player scale, long soak, real Chromebook performance, and socket mutation/replay remain unverified.
