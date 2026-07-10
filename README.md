# GyakutenEigo

GyakutenEigo is a browser-based English learning site. Its first hosted game is Quiz-Strike, a classroom arena prototype where teachers create quiz sets, start private sessions, and students join with a code to answer questions, earn in-game money, and buy school-safe gear.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment defaults:

   ```bash
   copy .env.example .env
   ```

3. Optional database services:

   ```bash
   docker compose up -d
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. Start the local app:

   ```bash
   npm run dev
   ```

The frontend runs on `http://localhost:5173` and the backend runs on `http://localhost:4000`. The GyakutenEigo home page is `/`, and the Quiz-Strike game host page is `/quiz-strike`.

## Online Play

For a hosted playtest, deploy the GyakutenEigo web app and Quiz-Strike game server separately:

- Web app: build `apps/web` and host `apps/web/dist`.
- Game server: build and run `apps/server`.
- Set `VITE_API_URL` in the web build to the public server URL.
- Set `CLIENT_ORIGIN` on the server to the public web app URL.
- Set a real `JWT_SECRET` before running with `NODE_ENV=production`.

See [docs/online-play.md](docs/online-play.md) for the full GitHub and deployment checklist.

## Student Player and Load Time

The student player is the lightweight React + Three.js/WebGL arena at `/join` and `/game`. The host page for Quiz-Strike is `/quiz-strike`. It uses the same server-side quiz/economy/combat rules and loads as part of the normal web app.

Default play now starts in Flag Mode: Red Team carries the flag to the Blue base, while Blue Team defends and captures a placed flag. Zombie Mode is also available from the teacher session settings.

The current map is Desert Citadel, a large desert fortress and market-town blockout sized for classroom sessions of up to 40 students.

## Project Documentation

- [architecture.md](architecture.md) explains the system architecture, data flow, runtime components, deployment shape, and known risks.
- [docs/handoff-prompt.md](docs/handoff-prompt.md) is a copy/paste handoff prompt for another developer or coding agent.

## Current Vertical Slice

- Teacher signup and login
- Quiz set creation with multiple-choice questions
- Private session creation with generated join codes
- Student join by code and nickname
- Three.js student arena with FPS controls, live movement/fire socket events, minimap, HUD, quiz panel, buy menu, scoreboard, and mobile touch controls
- Default Flag Mode, selectable Zombie Mode, Heavy Snowball Launcher scope/echo behavior, and hold-Tab scoreboard columns for Tags, Respawns, and Question Accuracy
- Desert Citadel arena blockout with 24 protected spawns per team, 60 free-for-all spawn positions, capture zones, retrieve-item markers, district signs, and large-scale map bounds
- Live teacher roster
- Quiz answering with server-side money awards
- Practice-only quiz answers while eliminated
- Gear buying with server-side validation
- Simple bright low-poly arena with procedural decals
- Session results based on stored answer logs

## Desert Citadel Map

Desert Citadel is implemented in the React + Three.js/WebGL arena client. The shared package owns gameplay-scale data such as map bounds, team spawns, free-for-all spawns, capture zones, retrieve-item markers, delivery zones, and base buy zones. The web client owns the blockout geometry, labels, landmarks, materials, lighting, and collision boxes.

Relevant files:

- `packages/shared/src/index.ts`: arena limits, spawn tables, spawn selection, capture/retrieve metadata, base-zone checks.
- `apps/server/src/index.ts`: round-start, join, bot, and movement logic using the expanded spawn map.
- `apps/web/src/game/desertCitadelMap.ts`: Desert Citadel blockout pieces, signs, route labels, and landmarks.
- `apps/web/src/game/ArenaPreview.tsx`: Three.js renderer, collision checks, FPS camera controls, minimap overlay, overview preview, and player visuals.
- `packages/shared/src/sessionRules.test.ts`: spawn-count, arena-clamp, base-zone, and spawn-selection coverage.

To open and test:

1. Run `npm run dev`.
2. Open `http://localhost:5173/join` for the student flow or use the landing-page preview.
3. Create or join a session, start the round, then move through Desert Citadel with WASD/arrows and fire with F or click. Right click scopes supported gear, E interacts with the flag, and holding Tab shows the scoreboard.
4. Use the teacher dashboard bot button to add test players up to the configured session limit.

Implemented blockout coverage:

- Six districts: West Fortress, East Camp, Central Market, North Ruins, South Homes, and Aqueduct.
- Five major route families: north ruins, central market, south homes, aqueduct, and rooftop/wall route.
- Landmarks: citadel tower, old well, broken bridge, blue canopy, ruined watchtower, eastern wooden gate, buried statue, and glowing aqueduct chamber.
- Objective metadata: five capture zones, three retrieve items, and two team delivery zones.
- Performance-conscious simple geometry, reusable generated materials, limited shadows, static scenery without network synchronization.

Known limitations:

- This is a playable blockout, not a final art pass.
- Rooftop and aqueduct routes are represented with readable blockout geometry and collision, but the current player controller still uses mostly flat movement.
- Free-for-all spawn metadata is present for future mode support; the current live session flow remains team-based.

## Safety Note

This is an educational prototype. Schools should review privacy, safeguarding, accessibility, and local policy requirements before classroom deployment.

The current backend stores accounts, quiz sets, live sessions, and reports in memory. That is suitable for a first private online playtest, but data will reset when the server restarts. Persistent database storage should be added before serious classroom use.

## Design Rules

This project uses original school-safe terminology only: snow tags, snowball launchers, warmth, gear, arena, Blue Team, and Red Team. It does not include Counter-Strike assets, names, maps, sounds, realistic weapon names, blood, gore, public matchmaking, public chat, or voice chat.
