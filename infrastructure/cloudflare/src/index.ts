export interface CloudflareProxyEnv {
  BACKEND_ORIGIN?: string;
}

export const SOCKET_IO_PROXY_PATH = "/socket.io/";
const API_PROXY_TIMEOUT_MS = 25_000;
// Engine.IO's default heartbeat can hold a polling request for roughly
// 45 seconds (25s ping interval + 20s ping timeout).
const SOCKET_IO_PROXY_TIMEOUT_MS = 60_000;

export type ProxyFetcher = (request: Request) => Promise<Response>;

const isPathUnder = (pathname: string, prefix: string) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix);

export const isProxyPath = (pathname: string) =>
  isPathUnder(pathname, "/api/") || isPathUnder(pathname, SOCKET_IO_PROXY_PATH);

export const getProxyTimeoutMs = (pathname: string) =>
  isPathUnder(pathname, SOCKET_IO_PROXY_PATH)
    ? SOCKET_IO_PROXY_TIMEOUT_MS
    : API_PROXY_TIMEOUT_MS;

export const resolveBackendUrl = (requestUrl: string, backendOrigin: string) => {
  const backend = new URL(backendOrigin.trim());
  if (
    backend.protocol !== "https:"
    || backend.username
    || backend.password
    || backend.pathname !== "/"
    || backend.search
    || backend.hash
  ) {
    throw new Error("BACKEND_ORIGIN must be an HTTPS origin without credentials or a path.");
  }

  const incoming = new URL(requestUrl);
  return new URL(`${incoming.pathname}${incoming.search}`, backend);
};

const jsonResponse = (body: Record<string, string>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });

/**
 * Proxy only QuizStrike's API and Socket.IO paths. The route configuration
 * should match those paths, while this guard prevents accidental open-proxy
 * behavior if the Worker is attached more broadly later.
 */
export const proxyRequest = async (
  request: Request,
  env: CloudflareProxyEnv,
  fetcher: ProxyFetcher = (upstreamRequest) => fetch(upstreamRequest)
): Promise<Response> => {
  const requestUrl = new URL(request.url);
  if (!isProxyPath(requestUrl.pathname)) return fetcher(request);

  if (!env.BACKEND_ORIGIN?.trim()) return jsonResponse({ error: "Game server proxy is not configured." }, 500);

  let backendUrl: URL;
  try {
    backendUrl = resolveBackendUrl(request.url, env.BACKEND_ORIGIN);
  } catch {
    return jsonResponse({ error: "Game server proxy configuration is invalid." }, 500);
  }

  const headers = new Headers(request.headers);
  // The upstream host must be derived from BACKEND_ORIGIN. All application
  // headers—including Authorization and X-Player-Token—remain intact.
  headers.delete("host");
  headers.delete("content-length");

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    getProxyTimeoutMs(requestUrl.pathname)
  );
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    signal: controller.signal
  };
  // Cloudflare accepts a request body stream directly. Node's Fetch
  // implementation additionally requires the duplex hint when running the
  // same handler in the unit tests.
  const requestInit = init as RequestInit & { duplex?: "half" };
  requestInit.duplex = "half";
  if (request.method !== "GET" && request.method !== "HEAD") requestInit.body = request.body;

  try {
    const upstream = await fetcher(new Request(backendUrl, requestInit));

    // A 101 response carries Cloudflare's WebSocket handle. Returning it
    // directly preserves the upgrade instead of trying to reconstruct it as
    // an ordinary Response (which would destroy the live connection).
    if (upstream.status === 101) return upstream;

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return jsonResponse({ error: "The game server did not respond in time." }, 504);
    }
    return jsonResponse({ error: "The game server is temporarily unavailable." }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
};

export default {
  fetch(request: Request, env: CloudflareProxyEnv) {
    return proxyRequest(request, env);
  }
};
