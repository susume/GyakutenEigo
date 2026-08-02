# Online play and deployment runbook

Last verified: 2 August 2026

## Production topology

- Static web bundle: GitHub Pages/custom domain from 'apps/web/dist'.
- Node runtime: Render web service 'gyakuteneigo-api'.
- Database: Supabase project 'Quiz Strike Production', Sydney, PostgreSQL 17.6.
- API/socket URL: 'https://api.gyakuteneigo.com'.
- Optional hosted fallback: 'https://gyakuteneigo-api.onrender.com'.

The retired Render PostgreSQL database is not used. Render hosts compute only.

## Build and start commands

~~~powershell
npm ci
npm run build -w @quizstrike/shared
npm run build -w @quizstrike/server
npm run build -w @quizstrike/web
~~~

Render start command:

~~~text
npm start -w @quizstrike/server
~~~

The server startup command runs 'prisma migrate deploy' before listening. A
migration failure must stop deployment.

## Render environment

Set server-only values in Render:

~~~text
NODE_ENV=production
NODE_VERSION=22
PORT=4000
JWT_SECRET=<long random secret>
DATABASE_URL=<Supabase session-pooler URL>
CLIENT_ORIGIN=https://gyakuteneigo.com,https://www.gyakuteneigo.com,https://susume.github.io
TRUST_PROXY=true
RUNTIME_STORE=in-memory
~~~

Do not put 'DATABASE_URL', 'JWT_SECRET', or Supabase keys in the web build.

Use the Supabase session pooler on port 5432 for this long-running Node process.
Keep the URL private and server-only.

## Web build variables

Set these as GitHub Actions variables or the equivalent static-host build
environment:

~~~text
VITE_API_URL=https://api.gyakuteneigo.com
VITE_API_FALLBACK_URL=https://gyakuteneigo-api.onrender.com
VITE_BASE_PATH=/
~~~

If the web app is hosted under a repository path rather than a custom domain,
set 'VITE_BASE_PATH' to that path and configure the SPA fallback accordingly.

## GitHub Pages

The repository includes '.github/workflows/deploy-web.yml'. The workflow builds
shared and web packages, creates SPA fallback copies, and publishes 'apps/web/dist'.

After enabling GitHub Pages with GitHub Actions:

1. Set 'VITE_API_URL' and, if needed, 'VITE_API_FALLBACK_URL'.
2. Set 'PAGE_CUSTOM_DOMAIN' only when using a custom domain.
3. Verify the generated 'CNAME' and base path.
4. Confirm '/quiz-strike', '/join', and '/game' all resolve to the SPA.
5. Confirm the API has the deployed web origin in 'CLIENT_ORIGIN'.

## Classroom smoke test

Run this after a web or API deployment, and again after changes to live-room
UI, Socket.IO protocol, authentication, or the arena renderer:

1. Sign in as a teacher at '/quiz-strike' and open Library.
2. Choose a quiz, create a game with Zombie, Tag, or Flag mode, select an
   arena, and review Advanced Settings before creating the room.
3. Confirm the waiting room shows the join code/QR code, the student roster,
   and a visible green Start Game action once a learner joins.
4. Join with at least two learner browsers. Start the game and verify the Live
   Game Control header, round actions, scoreboard, event feed, and arena preview.
5. Open Spectator View. Confirm it is read-only, the learner picker opens as a
   scrollable list, and selecting a learner or using Previous/Next changes the
   followed learner and team without sending gameplay input.
6. End the game and verify the learning report appears in Reports. Confirm the
   report can be opened/exported and that history deletion remains teacher-only.

Spectator mode is a client presentation feature. It does not require a new
environment variable or Socket.IO command: the teacher receives the current
session projection, selects an eligible learner locally, and renders an
`ArenaPreview` with controls paused and disabled.

## Render deploy checklist

1. Confirm the branch/commit being deployed is intended.
2. Confirm the service remains a single instance with sticky room affinity.
3. Confirm 'DATABASE_URL' is the Supabase URL without printing it.
4. Deploy and inspect logs for:
   - Supabase pooler datasource;
   - all expected migrations;
   - 'No pending migrations to apply';
   - normalized restore counts;
   - 'Your service is live'.
5. Call '/api/health' and require 'ok: true' and 'storage: postgres'.
6. For schema/backfill changes, reconcile normalized counts, migration ledger,
   and RuntimeSnapshot checksum.
7. Retain the final backup through at least one production cycle.

After deployment, test both the custom-domain URL and the configured API origin
from a real classroom network. Verify WebSocket upgrade, reconnect behavior,
and the sticky single-instance room requirement before inviting a class.

## Safety and scaling limits

The server is authoritative and single-instance. Socket bindings, rooms, timers,
bots, in-memory leases, rate limits, event consumers, and decal bytes are
process-local. Redis/shared state adapters do not exist yet. Do not add replicas
until shared state, Socket.IO fan-out, leases, reconnect routing, rate limits,
and object storage are implemented and tested.

For the complete authority model, read [architecture.md](../architecture.md).
For current operator state, read [HANDOFF.md](../HANDOFF.md).
For the production migration record, read
[supabase-database-migration.md](supabase-database-migration.md).
