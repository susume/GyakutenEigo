import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { hasLikelySpeech } from "./audio";
import { localSpeechCache, localSpeechModelFiles, localSpeechModels, type LocalSpeechModel } from "./models";
import type { LocalSpeechBackend, LocalTranscript, SpeechWorkerRequest, SpeechWorkerResponse } from "./protocol";

const config = env.backends.onnx.wasm!;
config.numThreads = 1;
config.wasmPaths = {
  mjs: new URL("../../../../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs", import.meta.url).href,
  wasm: new URL("../../../../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm", import.meta.url).href
};

env.useBrowserCache = false;
const host = import.meta.env.VITE_SPEAKING_MODEL_HOST?.trim() || "https://huggingface.co";
env.remoteHost = new URL(host, self.location.origin).href;
// A cache-only miss must fail locally, including when the browser evicts a file.
env.localModelPath = "data:,";

let engine: { model: LocalSpeechModel; backend: LocalSpeechBackend; pipeline: AutomaticSpeechRecognitionPipeline } | undefined;
const send = (data: SpeechWorkerResponse) => self.postMessage(data);

async function prepare(model: LocalSpeechModel, backend: LocalSpeechBackend, cachedOnly: boolean) {
  const candidate = localSpeechModels[model];
  if (cachedOnly && !globalThis.caches) return send({ type: "error", code: "prepare" });
  const cache = await globalThis.caches?.open(localSpeechCache);
  env.useCustomCache = !!cache;
  env.customCache = cache ?? null;
  env.allowLocalModels = cachedOnly;
  env.allowRemoteModels = !cachedOnly;
  const base = new URL(`${candidate.id}/resolve/${candidate.revision}/`, env.remoteHost.replace(/\/?$/u, "/"));
  const hits = await Promise.all(localSpeechModelFiles.map(async (file) => !!await cache?.match(new URL(file, base))));
  const cached = hits.every(Boolean);
  if (cachedOnly && !cached) return send({ type: "error", code: "prepare" });
  const loaded = new Map<string, number>();
  const cachedFiles = new Set(localSpeechModelFiles.filter((_, index) => hits[index]));
  const started = performance.now();
  send({ type: "progress", progress: { stage: "loading", backend } });
  const recognizer = await pipeline("automatic-speech-recognition", candidate.id, {
    dtype: "q8",
    device: backend,
    revision: candidate.revision,
    progress_callback(event) {
      if (event.status !== "progress") return;
      loaded.set(event.file, event.loaded);
      if (!cachedFiles.has(event.file)) {
        const remainingBytes = [...loaded].reduce((total, [file, bytes]) => total + (cachedFiles.has(file) ? 0 : bytes), 0);
        send({ type: "progress", progress: { stage: "download", loaded: remainingBytes, total: candidate.bytes } });
      }
    }
  });
  engine = { model, backend, pipeline: recognizer };
  const downloadedBytes = [...loaded].reduce((total, [file, bytes]) => total + (cachedFiles.has(file) ? 0 : bytes), 0);
  const modelCached = (await Promise.all(localSpeechModelFiles.map(async (file) => !!await cache?.match(new URL(file, base))))).every(Boolean);
  send({ type: "prepared", preparation: { backend, model, cached, modelCached, downloadedBytes, initMs: Math.round(performance.now() - started) } });
}

async function transcribe(samples: Float32Array, durationMs: number) {
  if (!engine) return send({ type: "error", code: "prepare" });
  const { backend, model } = engine;
  const base: LocalTranscript = { status: "no-speech", text: "", backend, model, durationMs, inferenceMs: 0 };
  if (!hasLikelySpeech(samples)) return send({ type: "transcribed", transcript: base });
  send({ type: "progress", progress: { stage: "processing" } });
  const started = performance.now();
  const tokenLimit = Math.max(24, Math.min(192, Math.ceil(durationMs / 100) + 12));
  const output = await engine.pipeline(samples, {
    max_new_tokens: tokenLimit,
    ...(localSpeechModels[model].timestamps ? { return_timestamps: true, no_speech_threshold: 0.6, logprob_threshold: -1 } : {})
  });
  const result = Array.isArray(output) ? output[0] : output;
  const text = (result?.text ?? "").replace(/\[(?:music|noise|silence|applause|inaudible)\]|\((?:music|noise|silence|applause|inaudible)\)/giu, "").trim();
  const chunks = result?.chunks?.flatMap(({ text, timestamp: [startSeconds, endSeconds] }) =>
    typeof endSeconds === "number" && Number.isFinite(startSeconds) && Number.isFinite(endSeconds)
      && startSeconds >= 0 && endSeconds > startSeconds && endSeconds <= durationMs / 1_000 + 0.25
      ? [{ text, startSeconds, endSeconds }] : []);
  send({ type: "transcribed", transcript: {
    ...base,
    text,
    status: !/\p{L}/u.test(text) ? "no-speech" : text.split(/\s+/u).length === 1 ? "uncertain" : "recognized",
    inferenceMs: Math.round(performance.now() - started),
    ...(chunks?.length ? { chunks } : {})
  } });
}

self.onmessage = ({ data }: MessageEvent<SpeechWorkerRequest>) => {
  const operation = data.type === "prepare"
    ? prepare(data.model, data.backend ?? "wasm", data.cachedOnly)
    : transcribe(data.samples, data.durationMs);
  void operation.catch(() => send({ type: "error", code: "model" }));
};
