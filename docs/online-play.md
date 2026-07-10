# Online Play Deployment

This guide prepares QuizStrike Classroom for a hosted multiplayer test.

Target domains:

- Web game: `https://www.gyakuteneigo.com`
- Game API/socket server: `https://api.gyakuteneigo.com`

## Recommended Hosting Shape

Use two hosted services:

1. Web app: a static Vite build from `apps/web`.
2. Game server: the Node server from `apps/server`.

The browser connects to the game server through `VITE_API_URL`. The student player is the React + Three.js/WebGL arena at `/join` and `/game`.

GitHub Pages can host the web game, but it cannot run the live Node/Socket.IO server. Host the server on a Node-capable host such as Render, Railway, Fly.io, or a VPS.

## Required Environment

Server:

```bash
NODE_ENV=production
PORT=4000
JWT_SECRET=replace-with-a-long-random-production-secret
CLIENT_ORIGIN=https://www.gyakuteneigo.com
TRUST_PROXY=true
```

Web build:

```bash
VITE_API_URL=https://api.gyakuteneigo.com
```

Use `.env.production.example` as the template for hosted environments.

## Build Commands

Install and verify:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Server:

```bash
npm run build -w @quizstrike/shared
npm run build -w @quizstrike/server
npm start -w @quizstrike/server
```

Web:

```bash
npm run build -w @quizstrike/web
```

Deploy `apps/web/dist` as the static site output.

## GitHub Pages Web Deployment

The repository includes `.github/workflows/deploy-web.yml`.

After the repository is pushed to GitHub:

1. Open the GitHub repository.
2. Go to Settings -> Pages.
3. Under Build and deployment, choose GitHub Actions.
4. Go to Actions -> Deploy Web.
5. Run the workflow, or push to `main`.
6. In Settings -> Pages, set the custom domain to `www.gyakuteneigo.com`.
7. Enable Enforce HTTPS when GitHub makes it available.

The workflow writes the `CNAME` file and a `404.html` SPA fallback into the Pages artifact during deployment.

## Domain DNS

Recommended DNS records:

| Host | Type | Value |
| --- | --- | --- |
| `www` | `CNAME` | `<your-github-username>.github.io` |
| `@` | `A` | `185.199.108.153` |
| `@` | `A` | `185.199.109.153` |
| `@` | `A` | `185.199.110.153` |
| `@` | `A` | `185.199.111.153` |
| `api` | `CNAME` | the server host target, for example `<your-render-service>.onrender.com` |

Use the exact `api` DNS value shown by your server host when you add `api.gyakuteneigo.com` as a custom domain.

## Render Server Example

For a first online playtest, Render is a straightforward Node host:

1. Create a Render account.
2. Click New -> Web Service.
3. Connect the GitHub repository.
4. Use these service settings:
   - Runtime: Node
   - Build command: `npm ci && npm run build -w @quizstrike/shared && npm run build -w @quizstrike/server`
   - Start command: `npm start -w @quizstrike/server`
5. Add environment variables:
   - `NODE_ENV=production`
   - `JWT_SECRET=<long-random-secret>`
   - `CLIENT_ORIGIN=https://www.gyakuteneigo.com`
   - `TRUST_PROXY=true`
   - `NODE_VERSION=22`
6. Deploy the service.
7. Open the service URL and confirm `/api/health` responds.
8. Add `api.gyakuteneigo.com` as a custom domain on the service.
9. Add the DNS record that Render shows for `api.gyakuteneigo.com`.
10. Wait for HTTPS verification to finish.

## GitHub Upload Checklist

Commit or upload:

- `apps`
- `docs`
- `packages`
- `prisma`
- `.github`
- `.env.example`
- `.env.production.example`
- `.gitignore`
- `architecture.md`
- `AUDIT.md`
- `docker-compose.yml`
- `package.json`
- `package-lock.json`
- `README.md`
- `tsconfig.base.json`

Do not commit or upload:

- `.env` or any secrets
- `node_modules`
- `dist`
- `.codex-run-logs`
- `.tools`
- `product-audit*`
- local databases

The `.gitignore` is set up for these defaults.

## Current Online Limitations

The current server uses in-memory storage. This is fine for a first hosted playtest, but it means:

- Teacher accounts, quiz sets, sessions, and reports disappear when the server restarts.
- Multiple server instances will not share sessions.
- A serious classroom deployment should move users, quiz sets, sessions, answers, and player tokens into the database before public use.

For a first private online test, run a single server instance and keep it awake during the lesson.
