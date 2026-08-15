import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, LoaderCircle, RefreshCw, Wifi } from "lucide-react";
import { io } from "socket.io-client";
import { getApiUrl } from "../../api/client";
import { SOCKET_IO_PATH } from "../multiplayer/connection";
import "../../diagnostics.css";

type DiagnosticKey = "website" | "api" | "realtime" | "websocket" | "webgl" | "webgl2" | "storage" | "touch" | "audio";
type DiagnosticState = "checking" | "pass" | "fail" | "not-detected";
type DiagnosticKind = "network" | "capability" | "info";

type DiagnosticCheck = {
  key: DiagnosticKey;
  label: string;
  kind: DiagnosticKind;
  state: DiagnosticState;
  detail: string;
};

type DiagnosticResult = Pick<DiagnosticCheck, "state" | "detail">;

const createInitialChecks = (): DiagnosticCheck[] => [
  { key: "website", label: "Website", kind: "network", state: "checking", detail: "Waiting for this page to finish loading." },
  { key: "api", label: "Game API", kind: "network", state: "checking", detail: "Checking the same-origin game server path." },
  { key: "realtime", label: "Realtime server", kind: "network", state: "checking", detail: "Checking HTTP long polling." },
  { key: "websocket", label: "WebSocket", kind: "network", state: "checking", detail: "Checking whether this network permits a WebSocket upgrade." },
  { key: "webgl", label: "WebGL", kind: "capability", state: "checking", detail: "Checking browser graphics support." },
  { key: "webgl2", label: "WebGL2", kind: "capability", state: "checking", detail: "Checking newer browser graphics support." },
  { key: "storage", label: "Local Storage", kind: "capability", state: "checking", detail: "Checking whether the browser can save the player session." },
  { key: "touch", label: "Touch input", kind: "capability", state: "checking", detail: "Checking whether this device reports touch input." },
  { key: "audio", label: "Audio", kind: "capability", state: "checking", detail: "Checking browser audio support." }
];

const updateCheck = (checks: DiagnosticCheck[], key: DiagnosticKey, result: DiagnosticResult) =>
  checks.map((check) => check.key === key ? { ...check, ...result } : check);

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const checkApi = async (): Promise<DiagnosticResult> => {
  try {
    const response = await fetchWithTimeout(`${getApiUrl()}/api/health`, 8_000);
    if (!response.ok) return { state: "fail", detail: `The game server returned HTTP ${response.status}. It may be waking up or temporarily unavailable.` };
    const payload = await response.json().catch(() => ({})) as { ok?: boolean };
    if (payload.ok !== true) return { state: "fail", detail: "The game server responded, but its health check was not ready." };
    return { state: "pass", detail: "The game server responded through the page’s API path." };
  } catch (error) {
    return {
      state: "fail",
      detail: error instanceof DOMException && error.name === "AbortError"
        ? "The game server did not respond within 8 seconds."
        : "This device can open QuizStrike, but it cannot reach the game server on this network."
    };
  }
};

const checkSocketTransport = async (transport: "polling" | "websocket"): Promise<DiagnosticResult> =>
  new Promise((resolve) => {
    const socket = io(getApiUrl(), {
      path: SOCKET_IO_PATH,
      transports: [transport],
      upgrade: false,
      reconnection: false,
      timeout: 8_000,
      autoConnect: false
    });
    let finished = false;
    const finish = (result: DiagnosticResult) => {
      if (finished) return;
      finished = true;
      socket.removeAllListeners();
      socket.disconnect();
      resolve(result);
    };
    socket.once("connect", () => finish({
      state: "pass",
      detail: transport === "polling"
        ? "The realtime server accepted an HTTP long-polling connection."
        : "The network accepted a direct WebSocket connection."
    }));
    socket.once("connect_error", () => finish({
      state: "fail",
      detail: transport === "polling"
        ? "The realtime server could not be reached over HTTP long polling."
        : "The realtime server could not accept a WebSocket connection. Polling may still work."
    }));
    socket.connect();
  });

const inspectWebGl = () => {
  const canvas = document.createElement("canvas");
  const webgl = canvas.getContext("webgl") as WebGLRenderingContext | null;
  const webgl2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
  let rendererDetail = "Renderer details are hidden by this browser.";
  if (webgl) {
    try {
      const extension = webgl.getExtension("WEBGL_debug_renderer_info");
      const renderer = extension ? String(webgl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : "";
      if (renderer) {
        rendererDetail = /swiftshader|software|llvmpipe/i.test(renderer)
          ? "WebGL is available, but the browser reports a software renderer."
          : "WebGL is available with a hardware-capable renderer reported.";
      }
    } catch {
      // Renderer details are optional and can be blocked for privacy.
    }
  }
  canvas.remove();
  return {
    webgl: webgl
      ? { state: "pass" as const, detail: rendererDetail }
      : { state: "fail" as const, detail: "This browser could not create a WebGL graphics context." },
    webgl2: webgl2
      ? { state: "pass" as const, detail: "WebGL2 graphics support is available." }
      : { state: "fail" as const, detail: "WebGL2 is not available. The game may still work with WebGL." }
  };
};

const inspectLocalStorage = (): DiagnosticResult => {
  try {
    const key = "quizstrike_diagnostics_probe";
    localStorage.setItem(key, "ok");
    const available = localStorage.getItem(key) === "ok";
    localStorage.removeItem(key);
    return available
      ? { state: "pass", detail: "The browser can save the session token needed to reconnect." }
      : { state: "fail", detail: "The browser did not return a value it just stored." };
  } catch {
    return { state: "fail", detail: "Private browsing or school policy may be blocking Local Storage." };
  }
};

const inspectTouch = (): DiagnosticResult =>
  navigator.maxTouchPoints > 0 || "ontouchstart" in window
    ? { state: "pass", detail: `${navigator.maxTouchPoints || 1} touch point${navigator.maxTouchPoints === 1 ? "" : "s"} reported.` }
    : { state: "not-detected", detail: "This browser reports no touch input. That is normal on a desktop computer." };

const inspectAudio = (): DiagnosticResult => {
  try {
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) return { state: "fail", detail: "This browser does not provide the Web Audio API." };
    const context = new AudioContextConstructor();
    const state = context.state;
    void context.close().catch(() => undefined);
    return {
      state: "pass",
      detail: state === "suspended"
        ? "Audio is supported; Safari may require a tap before the first sound."
        : "The browser reports Web Audio support."
    };
  } catch {
    return { state: "fail", detail: "The browser blocked creation of an audio context." };
  }
};

const deviceLabel = () => {
  const userAgent = navigator.userAgent;
  if (/iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)) return "iPad / iPadOS";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/Android/i.test(userAgent)) return "Android device";
  return "Desktop or laptop";
};

const browserLabel = () => {
  const userAgent = navigator.userAgent;
  if (/CriOS/i.test(userAgent)) return "Chrome on iOS/iPadOS";
  if (/FxiOS/i.test(userAgent)) return "Firefox on iOS/iPadOS";
  if (/Edg/i.test(userAgent)) return "Microsoft Edge";
  if (/Chrome/i.test(userAgent)) return "Google Chrome";
  if (/Safari/i.test(userAgent) && /AppleWebKit/i.test(userAgent)) return "Safari";
  if (/Firefox/i.test(userAgent)) return "Firefox";
  return "Browser not identified";
};

const statusLabel = (check: DiagnosticCheck) => {
  if (check.state === "checking") return "Checking…";
  if (check.state === "pass") return check.kind === "network" ? "Connected" : "Available";
  if (check.state === "not-detected") return "Not detected";
  return "Failed";
};

export default function NetworkDiagnosticsPage() {
  const [checks, setChecks] = useState(createInitialChecks);
  const [isRunning, setIsRunning] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runChecks = useCallback(async () => {
    setIsRunning(true);
    setChecks(createInitialChecks());
    const webgl = inspectWebGl();
    setChecks((current) => updateCheck(updateCheck(current, "website", { state: "pass", detail: "This QuizStrike website page loaded successfully." }), "webgl", webgl.webgl));
    setChecks((current) => updateCheck(current, "webgl2", webgl.webgl2));
    setChecks((current) => updateCheck(current, "storage", inspectLocalStorage()));
    setChecks((current) => updateCheck(current, "touch", inspectTouch()));
    setChecks((current) => updateCheck(current, "audio", inspectAudio()));

    const api = await checkApi();
    setChecks((current) => updateCheck(current, "api", api));
    const realtime = await checkSocketTransport("polling");
    setChecks((current) => updateCheck(current, "realtime", realtime));
    const websocket = await checkSocketTransport("websocket");
    setChecks((current) => updateCheck(current, "websocket", websocket));
    setLastChecked(new Date());
    setIsRunning(false);
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const apiFailed = checks.some((check) => (check.key === "api" || check.key === "realtime") && check.state === "fail");
  const webSocketFailed = checks.find((check) => check.key === "websocket")?.state === "fail";

  return (
    <main className="diagnostics-page">
      <header className="diagnostics-header">
        <div>
          <p className="diagnostics-kicker">QuizStrike Classroom</p>
          <h1>School device check</h1>
          <p>Run this check on the school network before a class starts. It does not identify or track the student.</p>
        </div>
        <div className="diagnostics-actions">
          <a href="/join">Join a game</a>
          <button type="button" className="primary" onClick={() => void runChecks()} disabled={isRunning}>
            {isRunning ? <LoaderCircle size={17} className="diagnostics-spin" aria-hidden="true" /> : <RefreshCw size={17} aria-hidden="true" />}
            {isRunning ? "Checking…" : "Run check again"}
          </button>
        </div>
      </header>

      <section className={`diagnostics-callout ${apiFailed ? "is-failed" : webSocketFailed ? "is-warning" : "is-ready"}`} aria-live="polite">
        {apiFailed ? <AlertTriangle size={22} aria-hidden="true" /> : webSocketFailed ? <CircleHelp size={22} aria-hidden="true" /> : <CheckCircle2 size={22} aria-hidden="true" />}
        <div>
          <h2>{apiFailed ? "Game Server: FAILED" : webSocketFailed ? "Game Server: READY WITH A NETWORK LIMIT" : "Game Server: READY"}</h2>
          <p>
            {apiFailed
              ? "This device can open QuizStrike, but it cannot reach the multiplayer server. Please give this diagnostic result to your school IT administrator."
              : webSocketFailed
                ? "The school network may block WebSocket upgrades. QuizStrike can try HTTP long polling, but the connection may be less responsive."
                : "The main game paths are reachable from this device. You can continue with a classroom join test."}
          </p>
        </div>
      </section>

      <section className="diagnostics-panel" aria-labelledby="diagnostics-results-heading">
        <div className="diagnostics-panel-heading">
          <div>
            <p className="diagnostics-kicker">Connection and device results</p>
            <h2 id="diagnostics-results-heading">What this device can reach</h2>
          </div>
          <Wifi size={24} aria-hidden="true" />
        </div>
        <ul className="diagnostics-results">
          {checks.map((check) => (
            <li key={check.key} data-testid={`diagnostic-${check.key}`} className={`diagnostic-result is-${check.state}`}>
              <div className="diagnostic-result-title">
                <strong>{check.label}</strong>
                <span className="diagnostic-status">{statusLabel(check)}</span>
              </div>
              <p>{check.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="diagnostics-panel diagnostics-device-panel" aria-labelledby="diagnostics-device-heading">
        <div className="diagnostics-panel-heading">
          <div>
            <p className="diagnostics-kicker">Basic device information</p>
            <h2 id="diagnostics-device-heading">What the browser reports</h2>
          </div>
        </div>
        <dl className="diagnostics-device-grid">
          <div><dt>Device</dt><dd>{deviceLabel()}</dd></div>
          <div><dt>Browser</dt><dd>{browserLabel()}</dd></div>
          <div><dt>Viewport</dt><dd>{window.innerWidth} × {window.innerHeight} CSS pixels</dd></div>
          <div><dt>Touch points</dt><dd>{navigator.maxTouchPoints}</dd></div>
        </dl>
        <p className="diagnostics-privacy-note">Only basic capability information is shown. No device fingerprint or personal information is collected by this page.</p>
      </section>

      <footer className="diagnostics-footer">
        <span>{lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}.` : "Checking now…"}</span>
        <a href="/">Back to QuizStrike</a>
      </footer>
    </main>
  );
}
