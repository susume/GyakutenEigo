# GyakutenEigo / Quiz Strike Handoff Prompt

You are taking over the `susume/GyakutenEigo` repository. It is a TypeScript monorepo with a public English-learning site named GyakutenEigo and a separate private classroom multiplayer game named Quiz Strike.

## Product and live URLs

- GyakutenEigo landing page: `https://www.gyakuteneigo.com/`
- Quiz Strike host/teacher entry: `https://www.gyakuteneigo.com/quiz-strike/`
- Student join: `https://www.gyakuteneigo.com/join/`
- Student arena: `https://www.gyakuteneigo.com/game/`
- Live API and Socket.IO server: `https://api.gyakuteneigo.com/`
- Health check: `https://api.gyakuteneigo.com/api/health`

The apex URL, `https://gyakuteneigo.com`, can also be used by visitors. It is an allowed frontend origin even if the site ultimately redirects to `www`.

## What the game does

Teachers create accounts, build multiple-choice quiz sets, create private sessions, and share a generated code. Students join with a code and a classroom-safe nickname, answer questions to earn in-game money, buy gear or snowballs, and play a live Three.js arena. Teachers can add bots for testing, monitor the roster, end the session, review results, and export CSV.

The default game is Flag Mode: Red Team carries the flag to Blue base, then protects it while Blue tries to capture it. Zombie Mode is also selectable. Flag/Zombie objectives, quiz economics, purchases, tagging, eliminations, respawns, movement validation, and player-token checks are server-authoritative.

Use only the existing school-safe language: snowballs, snowball launchers, warmth, gear, arena, Blue Team, and Red Team. Do not introduce Counter-Strike assets/names/maps, realistic weapons, blood, gore, public matchmaking, public chat, or voice chat.

## Project structure

- `apps/web`: React + Vite web app. Includes the landing site, Quiz Strike entry, teacher dashboard, student join flow, Three.js/WebGL arena, and mobile controls.
- `apps/server`: Node, Express, and Socket.IO API. It owns teacher auth, quiz/session data, bots, reports, and authoritative game simulation.
- `packages/shared`: shared types, rules, map scale/spawns, validation, report helpers, and deterministic game logic.
- `architecture.md`: current system and deployment reference. Read this first.
- `docs/online-play.md`: step-by-step deployment guide.
- `.github/workflows/deploy-web.yml`: GitHub Pages web deployment.

Important source files:

- `apps/web/src/App.tsx`
- `apps/web/src/api/client.ts`
- `apps/web/src/game/ArenaPreview.tsx`
- `apps/web/src/game/desertCitadelMap.ts`
- `apps/server/src/index.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/sessionRules.test.ts`
- `packages/shared/src/studentSecurity.test.ts`

## Current production deployment

The web app is hosted by GitHub Pages on `www.gyakuteneigo.com`. The API/socket server runs on Render as the `gyakuteneigo-api` service, using `api.gyakuteneigo.com`. DNS is managed through Namecheap.

GitHub Pages builds the web app with:

```text
VITE_API_URL=https://api.gyakuteneigo.com
VITE_BASE_PATH=/
PAGE_CUSTOM_DOMAIN=www.gyakuteneigo.com
```

Render uses:

```text
Build: npm ci --include=dev && npm run build -w @quizstrike/shared && npm run build -w @quizstrike/server
Start: npm start -w @quizstrike/server
```

Its required environment variables are:

```text
NODE_ENV=production
NODE_VERSION=22
JWT_SECRET=<secret stored only in Render>
TRUST_PROXY=true
CLIENT_ORIGIN=http://www.gyakuteneigo.com,https://www.gyakuteneigo.com,http://gyakuteneigo.com,https://gyakuteneigo.com
```

Keep all four `CLIENT_ORIGIN` values unless the corresponding public URL is retired. Both Express and Socket.IO use this allow-list; a missing HTTPS origin causes browser errors such as inability to create an account or connect to the game server.

The `api` DNS record is a CNAME to `gyakuteneigo-api.onrender.com`. The Render custom-domain page must report verification and an issued HTTPS certificate.

## Known operational limits

- All teacher accounts, quizzes, sessions, answer logs, and player tokens are in memory. Any Render restart, redeploy, or sleep clears them.
- The Render Free plan may take a while to wake after inactivity. The first API request can be slow; retry only after the service has started.
- The system is single-instance only. Do not scale to multiple server processes without persistent storage and shared Socket.IO state.
- GitHub Pages can host the static web app, but it cannot host the Node/Socket.IO game server.
- The web bundle may warn that it exceeds 500 kB because it contains Three.js. Treat that as an expected warning, not a failed build.

## Working rules

- Preserve the GyakutenEigo landing page at `/`. Quiz Strike belongs at `/quiz-strike`; it is not the site root.
- Prefer existing helpers in `packages/shared` for game logic. Do not duplicate or move authoritative rule decisions into the browser.
- Keep the server authoritative for answers, money, snowballs, gear, player movement, targets, tagging, eliminations, respawns, and objectives.
- Do not trust client-provided answers, ammo counts, coordinates, target IDs, or player tokens without server validation.
- Do not commit `.env`, secrets, `node_modules`, `dist`, build caches, local databases, or generated audit artifacts.
- There may be user changes in the worktree. Inspect and preserve them; do not reset or discard unrelated work.

## Local development and verification

```bash
npm install
copy .env.example .env
npm run dev
```

Local web: `http://localhost:5173`
Local API: `http://localhost:4000`

Before committing code changes, run:

```bash
npm run typecheck
npm test
npm run build
```

For deployment verification, use two separate browser sessions: create a teacher account at the Quiz Strike page, create a session, join as a student in the other session, then start the round and confirm live roster/game updates. Check `https://api.gyakuteneigo.com/api/health` first when diagnosing connection issues.

## Recommended next work

1. Add persistent storage for teachers, quiz sets, sessions, players, player tokens, and reports.
2. Add quiz import/export or seed flows so content survives service restarts.
3. Add end-to-end smoke tests covering teacher signup, session creation, student join, round start, quiz answer, purchase, and report export.
4. Add durable logging, monitoring, rate limits, and session revocation.
5. Continue accessibility and mobile polish without weakening the existing live-game controls.
