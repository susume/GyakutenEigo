# Cloudflare same-origin API and Socket.IO setup

This repository keeps GitHub Pages as the static frontend and Render as the
Node/Express/Socket.IO backend. The Worker in
`infrastructure/cloudflare/src/index.ts` exposes only these live paths on the
public website origin:

```text
https://gyakuteneigo.com/api/*        -> Render backend
https://gyakuteneigo.com/socket.io/*  -> Render backend
```

All other paths continue to resolve to GitHub Pages. The student browser does
not receive or automatically fall back to the Render hostname.

## Before changing DNS

1. Open the current GitHub Pages settings and record the verified custom domain
   and HTTPS state. The current workflow defaults `PAGE_CUSTOM_DOMAIN` to
   `www.gyakuteneigo.com`; if the live canonical site is the apex
   `gyakuteneigo.com`, set the GitHub Actions variable to that value rather than
   changing it by guesswork.
2. Confirm the current Pages artifact still contains `CNAME` with the chosen
   canonical hostname. Do not remove the GitHub Pages project.
3. Add `gyakuteneigo.com` to Cloudflare and move the domain nameservers to
   Cloudflare only if the domain owner is ready to manage DNS there.
4. Preserve the existing GitHub Pages DNS target. Cloudflare Worker Routes need
   an existing DNS record for the hostname, and that record must be proxied
   (orange-clouded). Do not invent a new GitHub Pages target; copy the current
   verified record values from the DNS provider/GitHub Pages settings.

Cloudflare documents that Routes run in front of an existing origin and require
an active zone plus a proxied DNS record for the hostname:
[Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/).

## Deploy the Worker

The committed `infrastructure/cloudflare/wrangler.toml` contains the selective
routes for both the apex and `www` hostnames. If only one hostname is live,
remove the unused pair or leave them disabled until that hostname has a
proxied DNS record.

From the repository root:

```powershell
cd infrastructure/cloudflare
npx wrangler login
npx wrangler deploy
```

`BACKEND_ORIGIN` is a Worker environment variable. It is currently set to the
public Render origin in `wrangler.toml`; it contains no secret. If the Render
service changes, update that one binding and redeploy. Never put `JWT_SECRET`,
`DATABASE_URL`, teacher tokens, or player tokens in Worker variables or source.

To change it without committing a value, set the variable in the Cloudflare
Worker dashboard under Settings → Variables and Secrets, or deploy with the
equivalent Wrangler variable mechanism. Keep the value as an HTTPS origin with
no path, credentials, query string, or fragment.

Do not attach this Worker to `/*`. The fixed path guard and the route patterns
are intentionally limited to `/api/*` and `/socket.io/*`; the Pages site must
remain the origin for static files and SPA routes.

## DNS, TLS, and WebSockets

- Keep the GitHub Pages DNS records as the origin for the website and proxy the
  relevant hostname through Cloudflare.
- Use Cloudflare SSL/TLS mode **Full (strict)** after confirming that both
  GitHub Pages and the Render origin present valid HTTPS certificates.
- Keep WebSockets enabled in Cloudflare. The Worker forwards the original
  `Upgrade`, `Connection`, `Sec-WebSocket-*`, query string, and Socket.IO path;
  a successful upstream `101` response is returned directly.
- Socket.IO still starts with HTTP long polling and can upgrade to WebSocket.
  A network that blocks upgrades can remain functional through polling, though
  it may be less responsive.
- `/api/*` and `/socket.io/*` responses are explicitly marked `no-store` by the
  Worker. Do not add a cache rule for live game traffic.

Cloudflare’s Worker WebSocket support uses a fetch request carrying the
`Upgrade: websocket` header:
[WebSockets in Workers](https://developers.cloudflare.com/workers/examples/websockets/).

## Verify before inviting a class

Run these checks after DNS and Worker deployment:

```powershell
Invoke-WebRequest 'https://gyakuteneigo.com/api/health' -UseBasicParsing
curl.exe -i 'https://gyakuteneigo.com/socket.io/?EIO=4&transport=polling'
```

The health request should return JSON with `ok: true`. The Socket.IO request
should return an Engine.IO opening payload, not a GitHub Pages HTML document.
Then open `https://gyakuteneigo.com/check` on a school iPad and confirm Game API,
Realtime server, and WebSocket results. Finally join a real classroom room and
watch the browser network panel: normal game requests should be under the
website origin, never the Render hostname.

The backend still allows the configured direct diagnostic origins through
`CLIENT_ORIGIN` (`gyakuteneigo.com`, `www.gyakuteneigo.com`, and the GitHub Pages
origin), but normal classroom traffic should be same-origin.

## Free-plan consideration

This design does not require a paid Cloudflare feature. However, Cloudflare’s
current Workers Free plan has a **100,000 requests/day** account limit and a
10 ms CPU limit for a Worker invocation. A simple path proxy should fit the CPU
budget, but a busy school day with many students, polling fallbacks, and
reconnects can approach the request quota. Monitor Worker analytics before a
large rollout and move to the paid plan if the quota or operational headroom is
not sufficient. Cloudflare’s current limits are documented at
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

The WebSocket connection itself is billed as the initial upgrade request; do not
assume that one classroom connection is equivalent to one HTTP request for all
of its later traffic. Measure the actual school-day pattern.

## Rollback

1. If the Worker code is wrong, redeploy the previous Worker version or disable
   only the `/api/*` and `/socket.io/*` routes. Keep the Pages DNS and CNAME
   intact.
2. If the backend origin is temporarily unavailable, restore the previous
   `BACKEND_ORIGIN` binding and redeploy the Worker. Do not turn the Worker into
   a generic forwarder.
3. If the web build is wrong, redeploy the previous GitHub Pages artifact while
   keeping the compatible Worker version. The web and backend/proxy contracts
   should be rolled back together when a protocol change is involved.
4. A pre-proxy browser build that directly uses `api.gyakuteneigo.com` is a last
   resort for desktop diagnostics only; it is not a school-iPad solution because
   it reintroduces the multi-host failure mode.
