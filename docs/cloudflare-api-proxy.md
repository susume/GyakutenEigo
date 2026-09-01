# Cloudflare same-origin API and Socket.IO cutover

**Status:** prepared in source, not live as of 1 September 2026
**Canonical system source:** [`../SYSTEM.md`](../SYSTEM.md)

The Worker in `infrastructure/cloudflare/src/index.ts` is a narrow future proxy
for the static GitHub Pages site and the Render API. It is not currently the
website’s live request path. Today:

- `https://gyakuteneigo.com/` and `https://www.gyakuteneigo.com/` serve
  GitHub Pages;
- `https://api.gyakuteneigo.com/api/health` and the Render native hostname
  return the live API;
- `https://gyakuteneigo.com/api/health` and the `www` equivalent return
  GitHub Pages 404s;
- DNS remains delegated to `dns1.registrar-servers.com` and
  `dns2.registrar-servers.com`, not Cloudflare.

The current Pages build therefore uses the explicit compatibility origin:

~~~text
VITE_API_URL=https://gyakuteneigo-api.onrender.com
VITE_ALLOW_PRODUCTION_API_OVERRIDE=true
~~~

Do not change those values until the checks in this runbook pass.

## Intended routes

~~~text
https://gyakuteneigo.com/api/*        -> Render backend
https://gyakuteneigo.com/socket.io/*  -> Render backend
https://www.gyakuteneigo.com/api/*   -> Render backend
https://www.gyakuteneigo.com/socket.io/* -> Render backend
~~~

All other paths must continue to resolve to the GitHub Pages static site. The
Worker must never be attached to `/*`, become a generic forwarder, or receive
server secrets.

## Before DNS changes

1. Record the current GitHub Pages custom-domain and HTTPS state.
2. Preserve the Pages origin records and confirm the deployed artifact still
   contains the desired CNAME.
3. Confirm the domain owner is ready to manage DNS in Cloudflare and delegate
   the nameservers deliberately.
4. Add the domain to Cloudflare and create proxied DNS records for the website
   hostnames. Do not invent Pages targets; copy the verified current records.
5. Confirm the Render API origin remains healthy before changing the edge.

## Worker configuration

The committed `infrastructure/cloudflare/wrangler.toml` points
`BACKEND_ORIGIN` at:

~~~text
https://gyakuteneigo-api.onrender.com
~~~

Deploy from the Worker directory:

~~~powershell
cd infrastructure/cloudflare
npx wrangler login
npx wrangler deploy
~~~

If `BACKEND_ORIGIN` changes, update the Worker binding and redeploy. Keep the
value as an HTTPS origin with no path, credentials, query string, or fragment.
Never put `JWT_SECRET`, `DATABASE_URL`, provider keys, teacher tokens, player
tokens, or private decal data in Worker variables or source.

The implementation forwards request method, headers, query string, and body for
the two allowlisted path families. It preserves successful Socket.IO 101
responses and uses bounded API/socket timeouts. Responses are marked
`no-store`; live game traffic must not be cached.

## Cutover gates

Run these only after DNS and Worker deployment:

~~~powershell
Invoke-WebRequest https://gyakuteneigo.com/api/health -UseBasicParsing
Invoke-WebRequest https://www.gyakuteneigo.com/api/health -UseBasicParsing
curl.exe -i "https://gyakuteneigo.com/socket.io/?EIO=4&transport=polling"
curl.exe -i "https://www.gyakuteneigo.com/socket.io/?EIO=4&transport=websocket"
~~~

Require healthy JSON from every hostname that will be used and an Engine.IO
opening payload from the polling request. Then:

1. Open `/check` and confirm Game API, realtime, and WebSocket checks.
2. Sign in, create a room, join from two student browsers, and reconnect one.
3. Run a short current game and confirm reports.
4. Verify browser network requests use the website origin for both HTTP and
   Socket.IO.
5. Change the Pages build to same-origin mode:
   `VITE_ALLOW_PRODUCTION_API_OVERRIDE=false`; remove the direct
   `VITE_API_URL` compatibility value.
6. Re-run the release and classroom smoke checks.
7. Record the evidence, date, DNS state, Worker version, and commit in
   [`../SYSTEM.md`](../SYSTEM.md).

The server’s `CLIENT_ORIGIN` must continue to include every actual web origin
used during the transition. Same-origin mode is a browser build decision; it
does not remove the need for CORS and token checks on the API.

## Rollback

- If the Worker is wrong, disable only the API/socket routes or redeploy the
  previous Worker version.
- If the origin changes, restore the previous `BACKEND_ORIGIN` binding.
- If the web build is wrong, redeploy the previous Pages artifact and restore
  the direct API origin until the edge is healthy.
- Keep the Pages static site and DNS records intact during rollback.
- Do not use a generic proxy or expose provider/database credentials as a
  workaround.
