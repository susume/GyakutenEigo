import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.SPEAKING_LATENCY_URL || "http://localhost:4000").replace(/\/$/u, "");
const sessionId = process.env.SPEAKING_LATENCY_SESSION_ID?.trim();
const token = process.env.SPEAKING_LATENCY_TOKEN?.trim();
const maxTurns = Math.max(1, Number.parseInt(process.env.SPEAKING_LATENCY_MAX_TURNS || "5", 10) || 5);

const mimeTypes = {
  ".webm": "audio/webm",
  ".mp4": "audio/mp4",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mpeg": "audio/mpeg"
};

const configuredFiles = process.env.SPEAKING_LATENCY_AUDIO_FILES
  ?.split(/[;,]/u)
  .map((file) => file.trim())
  .filter(Boolean);

const audioFiles = async () => {
  if (configuredFiles?.length) return configuredFiles.slice(0, maxTurns).map(resolve);
  const directory = process.env.SPEAKING_LATENCY_AUDIO_DIR?.trim();
  if (!directory) return [];
  const entries = await readdir(resolve(directory), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && mimeTypes[extname(entry.name).toLowerCase()])
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, maxTurns)
    .map((entry) => join(resolve(directory), entry.name));
};

const jsonOrEmpty = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const finiteNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : undefined;

const requestTurn = async (file, turnNumber) => {
  const bytes = await readFile(file);
  const extension = extname(file).toLowerCase();
  const mimeType = mimeTypes[extension];
  if (!mimeType) throw new Error(`Unsupported audio extension: ${extension || "(none)"}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40_000);
  const requestStartedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/speaking/sessions/${encodeURIComponent(sessionId)}/turn`, {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        "X-Speaking-Token": token,
        "X-Speaking-Turn-Id": `latency-${Date.now()}-${turnNumber}`
      },
      body: bytes,
      signal: controller.signal
    });
    const payload = await jsonOrEmpty(response);
    const clientTotalMs = Math.round(performance.now() - requestStartedAt);
    if (!response.ok) {
      console.log(JSON.stringify({ turn: turnNumber, file, status: response.status, clientTotalMs, error: payload.error || "request failed" }));
      return false;
    }
    const latency = payload.latency && typeof payload.latency === "object" ? payload.latency : {};
    // Print timings only. Do not print the response, which contains transcript
    // text, and do not print request headers or credentials.
    console.log(JSON.stringify({
      turn: turnNumber,
      file,
      clientTotalMs,
      audioBytes: finiteNumber(latency.audioBytes) ?? bytes.length,
      requestParsingMs: finiteNumber(latency.requestParsingMs),
      transcriptionMs: finiteNumber(latency.transcriptionMs),
      studentPersistenceMs: finiteNumber(latency.studentPersistenceMs),
      promptPreparationMs: finiteNumber(latency.promptPreparationMs),
      conversationMs: finiteNumber(latency.conversationMs),
      aiPersistenceMs: finiteNumber(latency.aiPersistenceMs),
      serverTotalMs: finiteNumber(latency.totalMs)
    }));
    return true;
  } finally {
    clearTimeout(timeoutId);
  }
};

const main = async () => {
  if (!sessionId || !token) throw new Error("Set SPEAKING_LATENCY_SESSION_ID and SPEAKING_LATENCY_TOKEN.");
  const files = await audioFiles();
  if (!files.length) throw new Error("Set SPEAKING_LATENCY_AUDIO_DIR or SPEAKING_LATENCY_AUDIO_FILES to one or more real audio recordings.");
  console.log(JSON.stringify({ warmup: "health", url: baseUrl }));
  const warmupStartedAt = performance.now();
  const warmupResponse = await fetch(`${baseUrl}/api/health`);
  console.log(JSON.stringify({ warmupStatus: warmupResponse.status, warmupMs: Math.round(performance.now() - warmupStartedAt) }));
  console.log("First turn is the cold-provider candidate; subsequent records are labeled turn 2, turn 3, and so on.");
  for (const [index, file] of files.entries()) {
    if (!(await requestTurn(file, index + 1))) process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Speaking latency measurement failed.");
  process.exitCode = 1;
});
