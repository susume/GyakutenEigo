# QuizStrike Handoff Prompt

You are taking over QuizStrike, a multiplayer quiz arena built as a TypeScript monorepo.

Project location:

- Root: `Quiz version CS 1 . 6`

What QuizStrike is:

- A browser-based game where teachers create quiz sessions and students join with a session code.
- Students answer multiple-choice questions to earn money, buy snowballs/gear, and play a snowball-tag arena.
- The project uses snowballs, warmth, gear, and classroom arena language. Do not use Counter-Strike assets, names, maps, realistic weapons, blood, gore, public matchmaking, public chat, or voice chat.

Architecture:

- `apps/web`: React + Vite teacher dashboard, student join flow, and Three.js/WebGL arena player.
- `apps/server`: Express + Socket.IO backend for auth, quiz sets, sessions, live movement, bots, snowball purchases, and snowball-tag resolution.
- `packages/shared`: shared TypeScript types and authoritative game/session rules.
- `architecture.md`: full architecture overview.
- `docs/online-play.md`: online deployment checklist.

Current state:

- Teacher signup/login, quiz creation, session creation, student join, reports, and CSV export exist.
- The browser arena uses a Desert Citadel map with open routes, corridors, objective areas, minimap support, snowball launcher, jump/crouch, finite snowballs, buy menu, HUD, scoreboard, and remote player/bot visuals.
- Teachers can add bots for testing.
- Hosted API routing is prepared for online play with `VITE_API_URL` and `CLIENT_ORIGIN`.
- GitHub CI exists at `.github/workflows/ci.yml`.
- `.gitignore` excludes dependencies, build outputs, local secrets, logs, generated audits, caches, and local databases.

Very important operational notes:

- This folder may not be initialized as a git repo yet.
- Do not commit `.env`, `node_modules`, `dist`, `.codex-run-logs`, `.tools`, generated audit folders, or local databases.
- The current backend stores users, quiz sets, sessions, reports, player tokens, and answers in memory. Data resets when the server restarts.
- For serious classroom deployment, the next major milestone is database persistence.

Verification commands:

- `npm run typecheck`
- `npm test`
- `npm run build`

Expected known warning:

- Vite may warn that a chunk is larger than 500 kB. That is currently expected because the frontend includes Three.js/game code.

Local development:

- `npm install`
- copy `.env.example` to `.env`
- `npm run dev`
- Web: `http://localhost:5173`
- Server: `http://localhost:4000`
- Student join route: `http://localhost:5173/join`

Online play setup:

- Deploy `apps/server` as the Node game server.
- Deploy `apps/web/dist` as the static web app.
- Build web with `VITE_API_URL` set to the public server URL.
- Run server with `NODE_ENV=production`, a real `JWT_SECRET`, `CLIENT_ORIGIN` set to the public web app URL, and `TRUST_PROXY=true` when behind a hosted proxy.
- See `docs/online-play.md`.

Recommended next priorities:

1. Add persistent database storage for teachers, quiz sets, sessions, players, player tokens, and answer logs.
2. Add seed/import/export paths so teachers do not lose quiz content.
3. Add production-grade rate limits and better auth/session logging.
4. Improve responsive and accessibility polish for teacher/student flows.
5. Add end-to-end smoke tests for teacher creates session -> student joins -> teacher starts -> student answers -> snowball purchase -> bot appears.

Recent important files to inspect first:

- `architecture.md`
- `docs/online-play.md`
- `README.md`
- `apps/server/src/index.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api/client.ts`
- `apps/web/src/game/ArenaPreview.tsx`
- `apps/web/src/game/desertCitadelMap.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/sessionRules.test.ts`
- `packages/shared/src/studentSecurity.test.ts`

When making changes:

- Prefer shared rule functions in `packages/shared` for gameplay logic.
- Keep server as the authority for money, score, snowballs, damage, eliminations, and answer validation.
- Do not trust client-submitted quiz answers, player position, target IDs, or ammo counts without server checks.
- Keep new UI consistent with the calm classroom dashboard style.
