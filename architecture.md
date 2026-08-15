# QuizStrike system architecture

Last verified: 15 August 2026
Repository: susume/GyakutenEigo
Baseline commit: 60bd853 (migration for school ipads)
Canonical operational handoff: HANDOFF.md

This is the current architecture for GyakutenEigo / QuizStrike. It separates
the live networking rollout from the intended Cloudflare design and records
the authority boundaries that future changes must preserve.

## 1. Deployment truth

The school-iPad update introduced a same-origin target, but the infrastructure
cutover has not happened yet.

| Concern | Verified state |
| --- | --- |
| Static frontend | GitHub Pages with the GyakutenEigo custom-domain artifact |
| Checked-in browser target | Same-origin /api/* and /socket.io/* by default |
| Live same-origin API | Not active: both public /api/health URLs returned 404 during verification |
| Backend | Render service gyakuteneigo-api; direct /api/health returned 200 with PostgreSQL storage |
| DNS | Registrar nameservers are still active, not Cloudflare nameservers |
| Cloudflare Worker | Implemented in infrastructure/cloudflare, not deployed to the live zone |
| Temporary recovery | Working-tree release configuration uses Render until the Worker route is verified |
| Database | Supabase PostgreSQL through server-side Prisma only |
| Runtime scale | One Render Node instance; process-local live-room authority |

The temporary Render origin is a rollout compatibility mode, not the school-safe
end state. Do not disable it until the public same-origin health check succeeds.
The CI guard in .github/workflows/deploy-web.yml is the cutover gate.

## 2. Intended system boundary

~~~mermaid
flowchart LR
  Student["Student browser"] --> Edge["gyakuteneigo.com"]
  Teacher["Teacher browser"] --> Edge
  Edge --> Pages["GitHub Pages static files"]
  Edge --> Worker["Cloudflare Worker routes"]
  Worker -->|"/api/* and /socket.io/*"| Server["Render Node service"]
  Server --> Prisma["Prisma repositories"]
  Prisma --> DB["Supabase PostgreSQL"]
~~~

During the migration window, the browser uses the explicit Render origin when
VITE_ALLOW_PRODUCTION_API_OVERRIDE=true. After DNS and Worker verification,
set that flag to false, remove VITE_API_URL, and make the website origin the
only browser-visible application origin.

## 3. Repository boundaries

| Area | Responsibility |
| --- | --- |
| apps/web | React/Vite browser app, teacher/student UX, API, Socket.IO, Three.js, diagnostics, Playwright |
| apps/server | Express API, Socket.IO gateway, auth, room authority, game orchestration, reports, persistence |
| packages/shared | Cross-runtime types, schemas, protocol messages, constants, bounds, pure rules |
| infrastructure/cloudflare | Narrow proxy for /api/* and /socket.io/*; never a generic forwarder |
| prisma | Database schema and ordered migrations |
| .github/workflows | GitHub Pages build/deploy and same-origin cutover guard |
| docs | Deployment procedures, device checks, feature contracts, and operations |

The server composition root is apps/server/src/runtime.ts. Keep it as the
dependency-wiring boundary; put new behavior in focused modules and inject
dependencies from the composition root.

## 4. Product surfaces

| Route | Owner | Purpose |
| --- | --- | --- |
| / | PublicHomepage.tsx | Public GyakutenEigo entry point |
| /quiz-strike | QuizStrikeApp.tsx | Teacher authentication, library, setup, reports, competitions, tournaments |
| /join?code=ROOM | StudentJoinScreen.tsx | Student code and nickname entry |
| /game | StudentExperience.tsx | Student lobby, live game, quiz, shop, scoreboard, reconnect |
| /check and /diagnostics | NetworkDiagnosticsPage.tsx | School network and device compatibility checks |
| /tournament-study/:id | Tournament pages | Released tournament study material |

GitHub Pages receives SPA fallback copies for browser routes. The API and
Socket.IO paths must be handled by the Worker after cutover, not by fake static
HTML pages.

## 5. Request architecture

### Current migration window

~~~text
Browser -> GitHub Pages for static files
Browser -> Render compatibility origin for API and Socket.IO
Render -> CORS-authenticated response
~~~

### Target school-safe path

~~~text
Browser -> Cloudflare edge on the website origin
Cloudflare -> GitHub Pages for static files
Cloudflare Worker -> Render for /api/* and /socket.io/*
Browser <- same-origin response
~~~

The client lives in apps/web/src/api/client.ts. API URLs resolve from
window.location.origin unless the explicit development/test or temporary
production override is enabled. Socket.IO uses the selected origin with path
/socket.io/, starts with polling, and permits WebSocket upgrade.

The Worker in infrastructure/cloudflare/src/index.ts:

- accepts only /api and /api/*;
- accepts only /socket.io and /socket.io/*;
- derives the destination from one HTTPS BACKEND_ORIGIN binding;
- preserves method, query, body, Authorization, X-Player-Token, and upgrade headers;
- returns upstream status and headers, marks live traffic no-store, and passes
  successful 101 WebSocket responses directly;
- uses a 25-second API timeout and 60-second Socket.IO timeout so normal
  Engine.IO polling heartbeats are not aborted.

## 6. Server composition and authority

The server is authoritative for every value that affects fairness or durable
classroom results. The browser sends intent and renders server projections.

| Server area | Current owner |
| --- | --- |
| Authentication | routes/authRoutes.ts; signed teacher JWTs |
| Teacher library | routes/teacherLibrary.ts, studySets.ts, quizSets.ts, questions.ts |
| Room lifecycle | routes/sessionRoutes.ts, realtime/roomAuthority.ts, roundRuntime.ts |
| Student operations | routes/playerRoutes.ts and appearanceRoutes.ts |
| Reports | routes/reports.ts and normalized repositories |
| Competitions | competitionDomain.ts and competitionRoutes.ts |
| Tournaments | tournamentDomain.ts and tournamentRoutes.ts |
| Realtime handshake | realtime/protocolGateway.ts |
| Disconnect behavior | connectionLifecycle.ts |
| Combat | combat.ts plus shared rules |
| Bots | botRuntime.ts, botAI.ts, botNavigation.ts |
| Round timing | roundRuntime.ts and roundFlow.ts |
| Live infrastructure | scaling/runtimeInfrastructure.ts |

There is one bot scheduler and one round/deadline scheduler. Do not create a
second hidden room runtime in a route or feature module.

### State ownership

| State | Authority | Durability |
| --- | --- | --- |
| Protocol types, schemas, bounds, pure rules | packages/shared | Source-controlled code |
| Teacher identity and library | Server and Prisma | Supabase PostgreSQL |
| Active room, players, timers, combat, objectives, bots | One room owner in Render memory | Checkpointed where required; not multi-instance safe |
| Answers, rounds, reports, history | Server persistence boundary | Normalized PostgreSQL models |
| RuntimeSnapshot | Recovery and compatibility checkpoint | PostgreSQL JSON; not new library source of truth |
| Teacher pause | Room runtime and checkpoint fields | controlState plus shifted deadlines |
| Learning Pulse | Server-derived teacher projection | Ephemeral/cache; excluded from student data |
| Socket bindings, dedupe, rate limits, question gates, decals | Render process | Cleared on lifecycle completion/restart |
| Camera, input, audio, VFX, UI | Browser | Never authoritative |

## 7. Protocol and gameplay flow

~~~mermaid
sequenceDiagram
  participant C as Client
  participant S as Socket.IO gateway
  participant A as Room authority
  participant D as Database
  C->>S: client_hello, protocol v1
  S-->>C: server_hello, connection id and clock
  C->>S: join_session_room, JWT or player token
  S->>A: Validate role, room, token, payload
  A-->>C: Role-scoped session_state
  C->>S: Intent: move, fire, answer, buy, objective
  S->>A: Schema, phase, bounds, cooldown, ownership checks
  A->>D: Persist answer/session/report data when required
  A-->>C: Authoritative snapshot and event/result
~~~

The protocol contract is packages/shared/PROTOCOL.md. The server temporarily
accepts an unversioned legacy client as inferred v0 for rollout compatibility;
explicit unsupported versions are rejected. Reconnect repeats the handshake and
receives a complete role-scoped snapshot.

Student question payloads omit correctChoice. The server does not trust client
identity, team, score, balance, answer correctness, target, damage, or position.
Student answers and purchases can use HTTP fallback when Socket.IO is unavailable;
ambiguous purchases must not be retried through both transports.

## 8. Game model

Rooms start in waiting, then use preparation or Zombie selection, buy phases,
active rounds, result transitions, and ended. Server epoch timestamps are the
source for deadlines; the browser only estimates countdown display.

controlState: teacher_paused is separate from round-result status. An owning
teacher can pause active gameplay, blocking movement, firing, answers,
purchases, bot ticks, and countdown progression. Resume shifts room deadlines by
the pause duration and survives reconnect.

| Mode | Authority |
| --- | --- |
| Classic Tag | Team freeze/tag, respawn, round result, quiz tie-breaking |
| Flag | Red pickup/carry/placement, Blue capture, hold countdown, timeout, disconnect drop |
| Zombie | Initial Red selection, human energy, conversion on valid elimination, match end |

Maps are Desert Citadel, The Iron Junction, and Temple Runoff. Each has authored
visual geometry, map-aware collision/navigation data, team spawns, objective
zones, and signs/props. Rendered meshes are not authoritative collision,
movement, or hit data.

Current equipment is Starter Snowball Launcher, Quick Snowball Launcher, Heavy
Snowball Launcher, Warm Vest, and Speed Boots. Weapon and perk slots are
independent. Rewards, money, snowballs, health, movement speed, range, damage,
cooldowns, and input bounds are shared/server-controlled. Freeze streaks are
emitted only after server-validated eliminations.

Appearance choices are room state by default. Decals are authenticated,
bounded, processed without EXIF/GPS data, kept outside snapshots, and cleaned
on player/session end, policy reset, expiry, or process restart. Supabase is not
browser storage, realtime, auth, or asset storage.

## 9. Browser and rendering architecture

Browser routing is in apps/web/src/BrowserApp.tsx. Teacher/product composition
is in QuizStrikeApp.tsx. Student live state and UI are in StudentExperience.tsx.
ArenaPreview.tsx composes the Three.js arena from focused map, character, input,
camera, loop, VFX, and audio modules.

The arena has one requestAnimationFrame loop. Cleanup must stop the loop, remove
resize/pointer/keyboard/visibility listeners, unsubscribe VFX and animation
handlers, dispose pooled resources and the renderer, and remove the canvas.
Socket snapshots must update live refs/state without remounting the whole scene.

The iPad work includes touch pointer controls, safe-area viewport metadata,
visibility/pageshow reconnect handling, WebGL context-loss handling, audio and
local-storage diagnostics, polling-first Socket.IO, and bounded checks at
/check. Automated Chromium iPad emulation is not proof of physical Safari.

## 10. Persistence and recovery

Prisma is the only application database client. Supabase PostgreSQL stores
teachers, classes, folders, quiz sets, questions, question audio, sessions,
players, answers, rounds, reports, competitions, tournaments, and normalized
related data.

The migration 20260805000000_harden_public_tables_rls protects application
tables from direct anon/authenticated access. RuntimeSnapshot supports recovery
and legacy compatibility; it is not a replacement for normalized new writes.
A process restart can restore selected room state, but process-local sockets,
timers, bot memory, rate limits, and ephemeral decals still require
reconnect/reconstruction.

## 11. Security invariants

- Teacher mutations require signed JWT authentication and ownership checks.
- Student HTTP and Socket.IO mutations require a room-scoped player token bound
  to player ID and session code.
- The Worker has a fixed path allowlist and fixed HTTPS origin binding; it is
  not an open proxy.
- Live API and Socket.IO traffic is no-store; authenticated responses are not
  cached.
- CORS uses explicit configured origins with credentials; it is not *.
- Secrets such as DATABASE_URL and JWT_SECRET are server-only. VITE_* values are
  public build inputs.
- Socket payloads are schema-validated, size-bounded, rate-limited where needed,
  and deduplicated by request/event IDs.
- Learning Pulse and private teacher data never enter the student projection.

## 12. Scaling boundary

The system is intentionally one Render instance. Do not add a second instance
until all of these exist and are integration-tested together:

1. shared room state and join-code directory;
2. distributed leases/fencing and owner takeover;
3. Socket.IO adapter and cross-instance fan-out;
4. reconnect routing to the current room owner;
5. distributed rate limits and request deduplication;
6. durable/object-backed decal storage;
7. split-brain, duplicate-event, restart, and two-instance tests.

RUNTIME_STORE=redis currently fails closed by design.

## 13. Safe change checklist

1. Update shared types/schemas/rules first when the contract changes.
2. Preserve server authority and role-scoped projections.
3. Update both HTTP and Socket.IO paths when an action has both transports.
4. Preserve reconnect, deduplication, timeout, and cleanup behavior.
5. Add or update server, shared, browser, proxy, and Playwright coverage.
6. Update HANDOFF.md, docs/online-play.md, and the relevant feature document.
7. Run release validation before deployment.

## 14. Validation baseline

The school-iPad implementation has local coverage for shared/server/web unit
tests, the Cloudflare Worker, same-origin resolution, failed API joins,
Socket.IO failure/recovery, iPad-sized Playwright flows, WebGL context loss,
and /check diagnostics.

~~~text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:load
npm run test:e2e
npx prisma validate
~~~

The local environment cannot prove Cloudflare DNS, the deployed Worker, or
physical Safari/iPad. Those require HANDOFF.md and docs/school-ipad-checklist.md.
