import { decodeLocalAudio, LocalSpeechError } from "./audio";
import { defaultLocalSpeechModel, type LocalSpeechModel } from "./models";
import type { LocalSpeechBackend, LocalSpeechPreparation, LocalSpeechProgress, LocalTranscript, SpeechWorkerRequest, SpeechWorkerResponse } from "./protocol";

type Options = { signal?: AbortSignal; onProgress?: (progress: LocalSpeechProgress) => void };
type PrepareOptions = Options & { model?: LocalSpeechModel; backend?: LocalSpeechBackend; cachedOnly?: boolean };
type Completed = Extract<SpeechWorkerResponse, { type: "prepared" | "transcribed" }>;

export class BrowserSpeechRecognizer {
  private worker?: Worker;
  private preparation?: LocalSpeechPreparation;
  private pending?: (error: unknown) => void;

  dispose() {
    this.pending?.(new DOMException("Speech recognition cancelled", "AbortError"));
    this.reset();
  }

  private reset() {
    this.worker?.terminate();
    this.worker = undefined;
    this.preparation = undefined;
  }

  private request(message: SpeechWorkerRequest, timeoutMs: number, options: Options): Promise<Completed> {
    options.signal?.throwIfAborted();
    if (this.pending) throw new LocalSpeechError("busy");
    const worker = this.worker ??= new Worker(new URL("./speech.worker.ts", import.meta.url), { type: "module" });
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.pending = undefined;
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        options.signal?.removeEventListener("abort", abort);
      };
      const fail = (error: unknown) => {
        cleanup();
        this.reset();
        reject(error);
      };
      const abort = () => fail(options.signal?.reason);
      const timer = setTimeout(() => fail(new LocalSpeechError("timeout")), timeoutMs);
      this.pending = fail;
      options.signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = ({ data }: MessageEvent<SpeechWorkerResponse>) => {
        if (data.type === "progress") options.onProgress?.(data.progress);
        else if (data.type === "error") fail(new LocalSpeechError(data.code));
        else {
          cleanup();
          resolve(data);
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        fail(new LocalSpeechError("model"));
      };
      worker.onmessageerror = () => fail(new LocalSpeechError("model"));
      try {
        worker.postMessage(message, message.type === "transcribe" ? [message.samples.buffer as ArrayBuffer] : []);
      } catch {
        fail(new LocalSpeechError("model"));
      }
    });
  }

  async prepare(options: PrepareOptions = {}) {
    const { model = defaultLocalSpeechModel, backend, cachedOnly = false, signal } = options;
    signal?.throwIfAborted();
    if (this.pending) throw new LocalSpeechError("busy");
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined" || typeof OfflineAudioContext === "undefined" || !globalThis.isSecureContext) {
      throw new LocalSpeechError("unsupported");
    }
    if (this.preparation?.model === model && (this.preparation.modelCached || cachedOnly) && (!backend || this.preparation.backend === backend)) return this.preparation;
    this.reset();
    const candidates: LocalSpeechBackend[] = backend ? [backend] : "gpu" in navigator ? ["webgpu", "wasm"] : ["wasm"];
    let failure: unknown;
    for (const candidate of candidates) {
      try {
        const timeoutMs = candidate === "webgpu" ? 25_000 : cachedOnly ? 45_000 : 180_000;
        const response = await this.request({ type: "prepare", model, backend: candidate, cachedOnly }, timeoutMs, options);
        if (response.type !== "prepared") throw new LocalSpeechError("model");
        this.preparation = response.preparation;
        return response.preparation;
      } catch (error) {
        signal?.throwIfAborted();
        failure = error;
        if (error instanceof LocalSpeechError && ["prepare", "busy"].includes(error.code)) break;
      }
    }
    throw failure;
  }

  async transcribe(blob: Blob, maxSeconds: number, options: Options = {}): Promise<LocalTranscript> {
    if (!this.preparation) throw new LocalSpeechError("prepare");
    const { samples, durationMs } = await decodeLocalAudio(blob, maxSeconds, options.signal);
    const response = await this.request({ type: "transcribe", samples, durationMs }, 45_000, options);
    if (response.type !== "transcribed") throw new LocalSpeechError("model");
    return response.transcript;
  }
}

export const speakCheckRecognizer = new BrowserSpeechRecognizer();
