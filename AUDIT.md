# QuizStrike Classroom Audit

Date: 2026-07-03

## Current Architecture

- Monorepo with npm workspaces: `apps/web`, `apps/server`, and `packages/shared`.
- Frontend: React 19, Vite 7, TypeScript, Three.js, Socket.IO client, lucide-react, plain CSS.
- Backend: Express 5, Socket.IO, JWT auth, bcrypt password hashing, in-memory Maps for users/classes/quizzes/sessions/answers.
- Data model: Prisma schema exists for Postgres, but the running server does not use Prisma yet.
- Game rendering: Three.js WebGL arena with procedural textures, sprites, FPS camera, pointer lock, WASD movement, collision against simple cover boxes, HUD, quiz panel, buy menu, and scoreboard.
- Networking: Socket.IO broadcasts session state and accepts player position relays. Core money, answer, and purchase logic is handled by HTTP routes on the server.
- Teacher UI: Single React dashboard with auth, quiz creation, paste-to-quiz import, live session creation/control, roster, and reports.
- Student UI: Join-code flow, FPS arena view, quiz answering, buy menu, scoreboard, and server-backed money updates.

## Priority Findings

### Critical

- Runtime persistence is in memory, so teacher accounts, quiz sets, sessions, and reports disappear on server restart despite the Prisma schema.
- Student identity is only `playerId`; answer and buy routes do not use a signed student session token, so a student could guess or reuse another player ID inside a known session.
- The old unauthenticated demo elimination endpoint allowed any client to toggle a player's alive state.
- Fast-answer bonus uses client-submitted timing. This is useful for prototype feedback but not secure enough for graded rewards.

### High

- Teacher session settings were not bounded before session creation; unsafe values could create broken games or extreme rewards.
- Socket.IO position relays do not authenticate the player socket or bind socket IDs to joined players.
- The game is a playable movement prototype, not a full authoritative multiplayer FPS loop: no server hit validation, respawn rules, ammo counts, round timer enforcement, or real player transforms.
- Teacher dashboard is functional but not yet at Gimkit/Blooket-quality depth: no class roster management, game history filters, assignments, late-join lock, random names, team controls, weapon availability, pause, kick, reset, or detailed analytics filters.

### Medium

- App UI is mostly one large `App.tsx`, making continued product growth harder to maintain.
- Mobile is blocked with a desktop notice; no touch controls.
- WebGL error handling and low/medium/high/auto graphics settings are missing.
- Reports lack CSV export before this pass and do not separate academic performance from gameplay performance in enough detail.
- Accessibility needs work: pointer-lock game controls need better keyboard help, focus states, reduced-motion review, and table/form polish.

### Low

- Existing design is clean but visually modest for a 2026 classroom game platform.
- Generated/procedural assets are lightweight and school-safe, but the arena still needs more environmental polish, loading states, and feedback animation.
- README covers local setup but not production deployment in detail.

## Implementation Plan

### Phase 1: Stabilize Game Loop and Core Gameplay

- Add loading/error states for WebGL asset support.
- Improve HUD, death/respawn clarity, round timer display, and FPS feedback.
- Add graphics quality modes and lower-device fallback.

### Phase 2: Secure Answer/Money/Shop Logic

- Keep reward, penalty, and purchase math server-owned and covered by tests.
- Add student session tokens and bind sockets to joined players.
- Replace client-submitted fast timing with server-issued question timestamps.
- Persist sessions, answers, purchases, and reports through Prisma/Postgres.

### Phase 3: Teacher Dashboard Redesign

- Split the dashboard into smaller components and refine visual hierarchy.
- Add richer session settings: late joining, random names, teams, weapon availability, blood/gore default off, low-violence mode, and graphics defaults.
- Add class/player roster and reusable question library management.

### Phase 4: Live Hosting and Reports

- Add pause/end/kick/reset controls.
- Add live progress view, report filters, CSV export, per-question analytics, and clearer academic/gameplay separation.
- Add assignments/practice mode if scope allows.

### Phase 5: Polish, Testing, and Deployment

- Add unit and integration tests for the main classroom flows.
- Add browser smoke tests.
- Expand README with production env vars, deployment, browser support, and WebSocket notes.
- Run performance checks and document known limitations.

## Changes Started In This Pass

- Added shared tests for session settings, answer reward logic, and CSV report export.
- Centralized reward and session-setting rules in `packages/shared`.
- Wired the server to use sanitized settings and shared reward logic.
- Added authenticated CSV report export.
- Removed the unauthenticated demo elimination route and button.

## Phase 2 Security Changes

- Added private student session tokens returned only to the joining student.
- Required the student token for question fetch, answer submission, and gear purchases.
- Added a one-active-question gate so students can only answer the currently issued question.
- Moved fast-answer timing to the server-issued question timestamp instead of trusting client-submitted timing.
- Added tests for student token validation and question replay prevention.
