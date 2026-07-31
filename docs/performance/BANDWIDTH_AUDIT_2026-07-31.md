# QuizStrike Classroom Bandwidth Audit — 2026-07-31

Date: 2026-07-31

Scope: the current workspace root, including `apps/web`, `apps/server`, `packages/shared`, deployment configuration, and frontend static assets.

## Current networking architecture

QuizStrike uses a separately hosted Vite/React/Three.js frontend and an Express + Socket.IO server. The static web build and its 3,008,175 bytes of public assets are deployed by the frontend workflow; Express does not mount a static directory. Render therefore serves the API, Socket.IO, reports, and authenticated custom decal bytes, but not the map code, audio pack, hero image, or normal web bundle.

The server is authoritative for movement bounds, combat, health, eliminations, money, quiz answers, purchases, teams, objectives, bots, respawns, rounds, and scores. Clients predict their own presentation and reconstruct animation locally.

### Client to server

| Transport/event | Phase | Frequency | Current payload/fan-out notes |
| --- | --- | ---: | --- |
| `POST /api/sessions/:code/join` | Lobby | Once per join | Returns a full `GameSession`, player, token, and first question. |
| `GET /api/sessions/:code` | Lobby | **1/sec per connected student** | Redundant with `session_state`; returns the full session without access control. |
| Teacher CRUD/session/report routes | Teacher workflow | User driven | Dashboard returns all sessions owned by the teacher; no recurring teacher HTTP poll. |
| Appearance/decal routes | Lobby | User driven | JSON appearance is bounded; decal upload is capped at 384 KiB processed. |
| `join_session_room` | Lobby/reconnect | **Twice on initial connection** | Both teacher and student clients emit before `connect` and again in the `connect` handler. Student form authenticates; teacher string form does not. |
| `player_position` | Active match | At most 1/180 ms while moved/turned, about 5.56/sec/player | Change gated by 0.3 distance or 0.08 radians. Sends code, player ID, JWT, x/y/z/facing. |
| `fire_action` | Active match | User driven; weapon cooldown 250 ms to 1,500 ms | Sends code, player ID, JWT, UUID, position, target, scope state. Server validates authoritatively. |
| `flag_action` | Flag match | User driven | Sends identity token and position; server validates objective state. |
| `answer_question`, `buy_gear`, `buy_snowballs` | Active/buy phase | User driven | Acknowledged Socket.IO command with authenticated HTTP fallback. |

Socket.IO uses its default transport negotiation: HTTP long-polling initially, with WebSocket upgrade when available. No code forces WebSocket-only operation. Default reconnection and heartbeat behavior are unchanged. The client exposes connection failure state but has no transport diagnostics.

### Server to client

| Event | Audience | Frequency | Payload notes |
| --- | --- | ---: | --- |
| `session_state` | All sockets in one session room | Join/reconnect and every `broadcastSession`; coalesced within 75 ms | Full session: settings, all players and appearances, up to 40 events, flag, round state, timestamps. Measured at 41,028 bytes for 40 players. |
| `player_position` | Every other socket in the session, including teacher | Up to 5.56/sec/moving human | Compact player ID + x/z/facing. Measured average application packet about 115 bytes. Volatile. |
| `remote_weapon_fire` | Every other socket in the session, including teacher | Every accepted shot | Spawn/presentation information only; clients simulate effects locally. No projectile position stream exists. |
| `damage_result` | Attacker and target only | Validated/rejected shot | Focused authoritative combat result. |
| `elimination_update` | Attacker and target only | Elimination | Focused reward/frozen state. |
| `world_impact` | Whole session | Validated hit | Small impact position/effect packet. |
| `game_event` | Whole room for global/elimination events; otherwise involved players | Event driven | Feed item is also retained in the next 40 full snapshots. |
| `error_message` | Requesting socket | Rejected action | Small user-facing error. |

Bots run on the server every 450 ms (2.22 Hz). If any live bot moves, the server mutates all bot positions and calls `broadcastSession` once, sending the entire session to every room socket. Bot attacks also enter the normal combat path.

The server persists the entire runtime snapshot to PostgreSQL after a one-second debounce. This is database egress rather than Render HTTP/Socket.IO outbound, but movement deliberately does not schedule persistence; full session broadcasts do.

## Major bandwidth sources

### Critical

1. **Connected-lobby full-state polling.** Forty students request a roughly 41 KiB session every second even while Socket.IO is connected: about 1.64 MB/sec, or 985 MB per ten minutes of waiting-room time, before HTTP headers.
2. **Full-session bot tick.** Any bot causes a roughly 41 KiB `session_state` every 450 ms to every human and teacher. With 20 humans, 20 bots, and one teacher this is about 1.91 MB/sec or 3.45 GB over 30 minutes. With 39 humans, one bot, and one teacher it is about 3.65 MB/sec or 6.56 GB over 30 minutes.
3. **Full-session broadcast after every accepted shot.** At 40 students plus a teacher, one 41,028-byte snapshot costs about 1.68 MB of Render outbound. The default ten starting snowballs permit 400 accepted shots before refills, which can produce about 673 MB of snapshots alone.

### High

4. **Human movement multiplication.** Forty continuously moving students at 5.56 updates/sec, 39 peers, and a connected teacher produce about 8,889 deliveries/sec. At the measured 115 bytes this is about 1.02 MB/sec: 613 MB/10 minutes, 1.23 GB/20 minutes, or 1.84 GB/30 minutes. This is already a compact delta and low tick rate; the waste is teacher delivery and quadratic all-peer fan-out.
5. **Full snapshots for answers and purchases.** Every accepted answer or purchase broadcasts about 41 KiB to the whole room even though only one `PlayerSession` changed.

### Medium

6. Duplicate initial `join_session_room` messages return two full snapshots to every opening teacher/student socket, about 3.28 MB for 40 students instead of 1.64 MB.
7. Movement, fire, and flag intents repeat the room code, player ID, and signed player JWT after the socket has already been authenticated and bound. This is primarily client-to-server waste and repeated JWT verification CPU, not Render outbound.
8. Teacher sockets receive movement, weapon, and impact presentation events that the dashboard does not consume.

### Low

9. HTTP response compression middleware is absent. Socket.IO polling compression uses Engine.IO defaults; WebSocket per-message deflate is not enabled.
10. Reports, dashboard reads, decal metadata, and health checks are user driven and not material during normal matches.

## Bugs found

- Both socket clients register a cleanly disposed effect, but each performs a duplicate initial room join.
- The connected waiting room polls full state despite receiving the same authoritative state over Socket.IO.
- The teacher socket subscribes with only a room code. Anyone who knows a code can use the same form and receive that room's full snapshots.
- `GET /api/sessions/:code` exposes a full session without a teacher or player credential.
- High-frequency gameplay broadcasts share the teacher/session room, so the teacher receives packets it never handles.
- Any number of moving bots triggers full-state broadcasting at the global bot tick.
- Accepted misses and rejected target selections spend a snowball and broadcast the full room solely to synchronize a small player change.

No cross-match `io.emit` or unscoped global broadcast was found. Every application broadcast uses a session-code room or explicit player socket IDs. Multiple teachers' sessions are therefore logically separated by room code, subject to the unauthenticated room-join/read defects above.

No duplicate React listeners survive cleanup: both socket effects disconnect their instance, and all recurring UI timers clear on cleanup. There is one Socket.IO instance per selected teacher session and one per active student session.

## Static and response audit

- Frontend public assets: 3,008,175 bytes across 38 files.
- Largest asset: `quizstrike-classroom-hero.png`, 2,682,588 bytes.
- These assets are in `apps/web/public` and the GitHub Pages/frontend build; the Express server has no `express.static` route.
- Custom decals are the only image bytes intentionally served by Render, are authenticated, bounded, cached privately for one hour, and fetched when an appearance references them.
- The largest recurring API/socket response is the unprojected `GameSession`. The 40-player load test measured 41,028 bytes.

## Baseline estimate

The load harness measured:

- 40 Socket.IO clients connected in 203 ms.
- Match-start state reached all clients in 130 ms.
- Largest 40-player full state: 41,028 bytes.
- 39 movement updates observed as 4,490 bytes total, about 115 bytes each.

The following active-match baseline is deterministic movement traffic only and assumes all 40 students move continuously at the existing cap with a teacher dashboard connected. Combat, answers, purchases, reconnects, Socket.IO framing, TCP/TLS/IP headers, and bots are excluded:

| Duration | Client to server application payload | Render outbound application payload |
| --- | ---: | ---: |
| 10 minutes | about 50 MB with the current repeated JWT packet | about 613 MB |
| 20 minutes | about 101 MB | about 1.23 GB |
| 30 minutes | about 151 MB | about 1.84 GB |

Those are modeled maxima for continuous meaningful movement, not measured production usage. Actual production contribution percentages require the new aggregated counters or Render telemetry. Event-driven combat and answer rates must not be invented; their exact marginal costs are reported above instead.

## Recommended fixes

| Fix | Impact | Risk | Difficulty |
| --- | --- | --- | --- |
| Stop lobby HTTP polling while Socket.IO is healthy; retain slow disconnected fallback | Critical | Low | Low |
| Remove duplicate initial room joins | High at connect/reconnect storms | Low | Low |
| Split authenticated student gameplay traffic from teacher session-state traffic | High | Low-medium | Medium |
| Replace bot-tick full snapshots with one batched volatile bot-position delta | Critical with bots | Low-medium | Medium |
| Replace answer/purchase/combat full snapshots with player-state deltas | Critical during action | Medium | Medium |
| Trust the already authenticated socket binding for gameplay intents | Medium upstream/CPU | Low | Low |
| Authenticate teacher room joins and full-session HTTP reads | Isolation/security | Low-medium | Medium |
| Add aggregated, flag-controlled network counters and transport diagnostics | Measurement | Low | Medium |
| Enable thresholded HTTP compression for JSON/report responses | Medium for fallback/initial state | Low | Low |
| Spatial/interest management for movement | Potentially high | High | High; intentionally deferred |
| Binary movement protocol | Low relative to fan-out | Medium | Medium; intentionally deferred |

## Changes implemented

### 1. Connected lobby polling

Problem: every waiting student fetched the full session once per second while the socket already supplied authoritative updates.

Existing behavior: 40 students × 41,028 bytes × 1/sec was about 1.64 MB/sec of response bodies.

Change: polling is disabled while Socket.IO is healthy. If the socket reports a connection failure, an authenticated fallback read runs immediately and then every five seconds.

Expected reduction: 100% of steady connected-lobby polling; 80% during a room-wide socket outage.

Gameplay risk: low. Socket state remains primary and the disconnected fallback remains available.

Test: the production browser classroom flow passed; authenticated and anonymous full-state reads are covered by integration tests.

### 2. Duplicate room joins and room authentication

Problem: teacher and student clients queued a room join before connection and sent it again from `connect`; the teacher form required only a room code.

Existing behavior: two full snapshots on initial connect, and a code-holder could subscribe as a teacher.

Change: clients join only from `connect`. Teacher payloads now include the teacher JWT and the server verifies session ownership. Full HTTP session reads require the owning teacher or a valid player token.

Expected reduction: 50% of initial socket snapshot deliveries, with stronger match isolation.

Gameplay risk: low; reconnect still invokes the same `connect` handler.

Test: the 40-client test confirms one authenticated join per socket; unauthenticated joins and reads receive no state.

### 3. Student-only gameplay room

Problem: movement, remote-fire, and impact presentation packets used the teacher/session room.

Existing behavior: a connected teacher received high-frequency packets the dashboard never handled.

Change: authenticated students join an additional `<session>:players` room. Movement, weapon presentation, impacts, and bot positions use that room; authoritative roster/score/round deltas continue to reach the teacher.

Expected reduction: one recipient from every gameplay broadcast. At 40 moving students this is 2.5% of movement outbound.

Gameplay risk: low; no student recipient is removed.

Test: the 40-client integration test receives all 39 peer movement senders and asserts zero teacher movement deliveries.

### 4. Bound-socket gameplay intents

Problem: every movement, fire, and flag packet repeated the room code, player UUID, and signed JWT after the room join had already authenticated the socket.

Existing behavior: a representative movement envelope was about 377 bytes with identity material.

Change: those events resolve the already verified server-side binding and send only gameplay fields.

Expected reduction: roughly 80% of client-to-server movement application bytes; it also removes per-movement JWT verification.

Gameplay risk: low; unbound sockets are rejected, and reconnect rebinds before sending.

Test: 1-, 10-, 20-, and 40-client authenticated movement fan-out passed with slim payloads.

### 5. Bot position batches

Problem: any bot movement caused a full `session_state` every 450 ms.

Existing behavior: a 20-human/20-bot room plus teacher was about 1.91 MB/sec from bot snapshots alone.

Change: one volatile `player_positions` packet contains only changed bot IDs and transforms. Bot health, ammo, respawn, and combat changes use authoritative player deltas.

Expected reduction: a measured one-bot batch is 163 bytes. A representative 20-bot batch is about 2.2 KiB, producing about 98 KB/sec to 20 students, approximately 95% below the former 1.91 MB/sec. Teachers no longer receive bot transforms.

Gameplay risk: low-medium. Tick rate and client rendering cadence remain 450 ms; only the envelope changed.

Test: integration test observed one 163-byte batch and zero full snapshots for a bot tick.

### 6. Focused player-state deltas

Problem: a shot, answer, or purchase changed one or two players but broadcast the full 41 KiB session.

Existing behavior: one full broadcast to 40 students plus a teacher cost about 1.68 MB. Four hundred default starting shots could cost about 673 MB before refills.

Change: `player_state` contains only changed authoritative `PlayerSession` records, the flag when relevant, and at most two recent feed events. Clients merge by player/event ID.

Expected reduction: the measured one-player delta is 1,247 bytes. At 41 recipients that is about 51 KB, roughly 97% below a full snapshot. A two-player combat delta remains about 95% smaller.

Gameplay risk: medium. Full snapshots still cover join/reconnect/round lifecycle; focused deltas preserve health, money, score, ammo, equipment, appearance, flag, and recent event updates.

Test: answer flow measured a 1,247-byte focused delta; all unit, integration, load, build, and browser tests passed.

### 7. Compression and instrumentation

Problem: Express responses had no compression middleware and there was no application-level traffic meter.

Change: HTTP and Engine.IO polling payloads larger than 1 KiB are compressed. WebSocket per-message deflate remains disabled to avoid CPU overhead on tiny real-time packets. `NETWORK_DEBUG=true` enables one aggregated report per interval with direction, event, messages, messages/sec, bytes, bytes/sec, average, largest, and transport observations.

Expected reduction: compression benefits full HTTP reads, reports, dashboard data, and long-polling fallback. Exact savings vary with client negotiation and payload contents.

Gameplay risk: low. The meter is off by default and never logs individual packets.

Test: a debug 1/10/20/40 run recorded 75 WebSocket observations and aggregate event totals without per-packet logging.

## Before versus after

### Deterministic 40-student movement ceiling

This comparison uses the measured 115-byte movement payload, the existing 180 ms movement cap, continuous meaningful movement by all 40 students, and one connected teacher. It excludes event-envelope and transport headers consistently on both sides.

| Duration | Before outbound | After outbound | Reduction |
| --- | ---: | ---: | ---: |
| 10 minutes | about 613 MB | about 598 MB | 2.5% |
| 20 minutes | about 1.23 GB | about 1.20 GB | 2.5% |
| 30 minutes | about 1.84 GB | about 1.79 GB | 2.5% |

Movement remains quadratic because every student must currently see every other student. The implementation intentionally does not lower the already modest 5.56 Hz cap or add risky interest management.

### 40-student, 30-minute modeled match with starting ammunition

Assumptions: the movement ceiling above, one teacher, no bots, exactly the 400 accepted shots supplied by the default ten starting snowballs, no refills, and misses represented by a one-player state change.

| | Before | After |
| --- | ---: | ---: |
| Movement | about 1.84 GB | about 1.79 GB |
| Shot state synchronization | about 673 MB | about 20 MB |
| Total modeled application payload | about 2.51 GB | about 1.81 GB |
| Reduction |  | about 28% |

This is a deliberately declared workload model, not production telemetry. Fewer simultaneously moving students improve both totals; more purchased snowballs increase the savings from focused deltas.

### 20-human/20-bot, 30-minute bot-motion component

| Before | After | Reduction |
| ---: | ---: | ---: |
| about 3.45 GB | about 174 MB | about 95% |

This isolates bot motion only. Combat and human movement are separate.

### Waiting room

| State | Before | After |
| --- | ---: | ---: |
| 40 connected students | about 1.64 MB/sec | 0 recurring HTTP bytes/sec |
| 40 students during socket outage | about 1.64 MB/sec | about 0.33 MB/sec |

## Load evidence

Latest normal load run:

| Clients | Connect | Start fan-out | Peer positions observed | Process CPU (user/system) | Observed heap delta |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 7 ms | 89 ms | 0 | 15/0 ms | +0.5 MB |
| 10 | 43 ms | 96 ms | 9 | 46/0 ms | +4.6 MB |
| 20 | 55 ms | 99 ms | 19 | 109/16 ms | +12.4 MB |
| 40 | 135 ms | 110 ms | 39 | 328/93 ms | +9.5 MB |

Heap deltas are noisy process snapshots affected by garbage collection and are not steady-state memory certification. The 40-client reconnect completed in 5 ms. A debug run measured outbound movement envelopes averaging 135 bytes including event name, and slim inbound movement envelopes averaging 67 bytes for the harness values.

## Remaining opportunities intentionally not implemented

- Spatial/interest management could materially reduce quadratic movement fan-out, but requires visibility/range design and classroom gameplay validation.
- A binary movement protocol would save JSON overhead but is not justified before fan-out is addressed.
- WebSocket-only transport was not forced because school-network compatibility must be verified first. Aggregated transport observations can now show whether polling persists.
- WebSocket per-message deflate remains off because the recurring packets are now small; enable it only if production counters show large snapshots still dominate and Render CPU has headroom.
- The full `GameSession` remains relatively large at lifecycle boundaries. A versioned public/session projection would reduce join/reconnect bytes but is a broader protocol change.
- Decal relocation to object storage/CDN was not attempted because bytes are private, bounded, uncommon, and tied to the current authenticated lifecycle.
- Production contribution percentages remain unknown until `NETWORK_DEBUG` is enabled briefly on Render or equivalent provider telemetry is collected. Code-derived event costs are reported without inventing action rates.
