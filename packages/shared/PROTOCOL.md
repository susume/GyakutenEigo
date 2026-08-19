# QuizStrike Multiplayer Protocol

The canonical implementation is `packages/shared/src/protocol`. Both browser
and server import its schemas and types. Socket.IO is the transport; event names
are the transport discriminator and the canonical in-memory union uses the same
name as its `type` field.

## Version and compatibility

- Current protocol: **1**
- Canonical supported range: **1-1**
- Temporary rollout adapter: unversioned legacy clients are identified as
  version 0 when they send a known event before `client_hello`.
- Version 0 is not advertised and must be removed after the compatibility
  server and version-1 browser have completed one deployment cycle.
- An explicitly advertised unsupported version receives
  `protocol_error/UNSUPPORTED_VERSION` and is disconnected.

Client and server may deploy separately. Deploy the compatibility server first,
then the version-1 web client, verify handshake metrics, and remove the version-0
adapter in the next intentional protocol-major release.

## Connection lifecycle

1. Socket.IO connects.
2. Browser emits `client_hello`.
3. Server validates the message and version.
4. Server emits `server_hello`, including its clock and connection ID.
5. Browser emits `join_session_room` exactly once for that connection ID.
6. Server authenticates either the teacher JWT or student player token.
7. Server joins the socket to a role-scoped room and emits `session_state`.
   Students join the public gameplay room; authenticated teachers join the
   teacher-only room.
8. Reconnect repeats the handshake and authenticated room join. The returned
   snapshot is authoritative, role-scoped, and structurally validated by the
   browser.

### Handshake example

```json
{
  "type": "client_hello",
  "protocolVersion": 1,
  "clientVersion": "0.1.0"
}
```

```json
{
  "type": "server_hello",
  "protocolVersion": 1,
  "minimumSupportedVersion": 1,
  "maximumSupportedVersion": 1,
  "serverVersion": "0.1.0",
  "connectionId": "socket-id",
  "serverTime": 1785542400000
}
```

## Authentication and join-code flow

HTTP creates or joins a game and returns the existing teacher JWT or scoped
student player token. The socket does not accept a user ID as authentication.

Teacher join:

```json
{ "code": "ABC123", "teacherToken": "signed-token" }
```

Student join/reconnect:

```json
{
  "code": "ABC123",
  "playerId": "player-id",
  "playerToken": "signed-token"
}
```

Exactly one credential form is allowed. Join codes are case-insensitive. In the
current in-memory runtime-store mode, the load balancer must preserve room
affinity because the directory is process-local.

Teacher and student sockets receive separate projections. Public room snapshots
and `player_state` payloads are safe for students; teacher-room snapshots and
`player_state` payloads may include the derived `learningPulse`. The browser
must not infer teacher privileges from a payload; authorization is established
by the server-side credential used during room binding.

## Client commands

| Event / canonical `type` | Payload | Authentication | Notes |
| --- | --- | --- | --- |
| `client_hello` | protocol/build/capabilities | none | Must be first for v1 |
| `join_session_room` | code + teacher or student credentials | token | Establishes room binding |
| `answer_question` | `questionId`, `selectedChoice` | bound student | Acknowledged command |
| `buy_gear` | `gearId` | bound student | Acknowledged command |
| `buy_snowballs` | optional `packSize` (`standard` or `large`) | bound student | Acknowledged command; omit `packSize` for the backward-compatible standard pack |
| `player_position` | x/z, optional y/facing and posture flags | bound student | Volatile, range validated |
| `fire_action` | request ID, position/aim, optional target/zoom | bound student | Request ID deduplicated |
| `flag_action` | authoritative-position hint | bound student | Server resolves objective result |

Every command is runtime-validated at `realtime/protocolGateway.ts` before game
logic runs. Unknown events, invalid discriminators, missing fields, non-finite or
out-of-range numbers, invalid choices, unexpected fields, and payloads over 16
KiB are rejected. Invalid input does not enter gameplay or database services.

## Server events

| Event | Purpose |
| --- | --- |
| `server_hello` | Accepted protocol, supported range, connection ID, server time |
| `protocol_error` | Structured transport/validation/auth/state failure |
| `session_state` | Authoritative full match/reconnect snapshot |
| `player_state` | Changed players, objective state, recent feed events |
| `player_position` | One authoritative player transform |
| `player_positions` | Batched bot transforms |
| `flag_planted` | One-time global objective announcement |
| `freeze_streak_announcement` | One-time global streak announcement |
| `remote_weapon_fire` | Remote presentation cue |
| `world_impact` | Validated impact presentation cue |
| `game_event` | Gameplay event feed item |
| `damage_result` | Authoritative fire result |
| `elimination_update` | Authoritative elimination result |
| `player_removed` | Teacher removal / local exit instruction |
| `error_message` | Deprecated gameplay-facing error; retained during v1 migration |

`session_state` includes room/match lifecycle, round state, quiz settings,
players, scoreboard values, active flag state, announcements, deadlines, recent
events, `controlState`, the teacher pause timestamp when present, and
`serverTime`. Authenticated teacher snapshots additionally include the compact
`learningPulse`; student snapshots do not. Learning Pulse is derived from
authoritative current-session answer logs, excludes bots, and is not persisted
inside `RuntimeSnapshot`. Quiz answer correctness remains in the acknowledged
answer result and is never trusted from the client. Teacher pause/resume uses
the authenticated HTTP actions
`POST /api/sessions/:code/pause` and `POST /api/sessions/:code/resume`; those
actions preserve the existing round `status` and shift absolute deadlines by
the paused duration on resume.

## Flag lifecycle and late join

Flag state is server authoritative: available → carried/dropped → placed →
captured/expired/reset. A placed flag contains `placedAtMs` and `expiresAtMs` in
the snapshot. `flag_planted` is emitted through the room event bus with a stable
UUID event ID. Late joiners reconstruct the objective and local countdown from
the snapshot; they do not replay old audio automatically.

## Freeze streaks

The server increments streaks only after validated freezes, resets the frozen
player and round state, and emits milestone announcements for streaks 3-8.
Clients cannot submit streak counts. Each announcement has a UUID `eventId` and
server-generated `occurredAt`.

## Time convention

Protocol timestamps are Unix epoch **milliseconds**, generated authoritatively
by the server. Numeric fields use `At`, `Ms`, or established `*AtMs` suffixes.
Legacy durable/display timestamps inside `GameSession` remain ISO strings and
are explicitly documented as snapshot fields, not protocol clock samples.

The client estimates current server time from the latest snapshot/hello offset
and renders countdowns locally. The server sends deadlines, not one broadcast
per timer second.

## Event IDs and deduplication

One-time global events use UUIDs. High-frequency movement snapshots do not.
Browser announcement deduplication uses a 128-entry, two-minute TTL cache that
is cleared on leaving a match. Distributed consumers use a 512-entry,
five-minute TTL cache. Durable match-report writes additionally use the unique
`(teacherId, sessionId)` database constraint.

## Errors

```json
{
  "type": "protocol_error",
  "code": "INVALID_MESSAGE",
  "message": "The message payload is invalid.",
  "requestId": "optional-request-id",
  "recoverable": true,
  "occurredAt": 1785542400000
}
```

Codes are `INVALID_MESSAGE`, `MESSAGE_TOO_LARGE`, `UNKNOWN_MESSAGE`,
`UNSUPPORTED_VERSION`, `HANDSHAKE_REQUIRED`, `UNAUTHORIZED`, `INVALID_STATE`,
and `RATE_LIMITED`. Payloads never contain stack traces, SQL details, secrets,
other users' data, or internal instance addresses. `error_message` is deprecated
and will become feature-domain errors in a future compatible revision.

## Deployment order

1. Deploy database migrations/backfill independently of protocol traffic.
2. Deploy the server that accepts v1 plus the temporary inferred-v0 adapter.
3. Verify existing clients still join and invalid explicit versions fail.
4. Deploy the v1 browser.
5. Verify `client_hello`/`server_hello`, reconnect snapshot validation, flag
   announcements, and freeze-streak deduplication.
6. After one stable deployment cycle, remove inferred version 0 and its test.
