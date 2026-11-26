import type { LocalSpeechModel } from "./models";

export type LocalSpeechBackend = "webgpu" | "wasm";
export type LocalSpeechProgress =
  | { stage: "loading"; backend: LocalSpeechBackend }
  | { stage: "download"; loaded: number; total: number }
  | { stage: "processing" };

export type LocalSpeechPreparation = {
  backend: LocalSpeechBackend;
  model: LocalSpeechModel;
  initMs: number;
  cached: boolean;
  modelCached: boolean;
  downloadedBytes: number;
};

export type LocalTranscript = {
  text: string;
  status: "recognized" | "uncertain" | "no-speech";
  backend: LocalSpeechBackend;
  model: LocalSpeechModel;
  durationMs: number;
  inferenceMs: number;
  chunks?: Array<{ text: string; startSeconds: number; endSeconds: number }>;
};

export type SpeechWorkerRequest =
  | { type: "prepare"; model: LocalSpeechModel; backend?: LocalSpeechBackend; cachedOnly: boolean }
  | { type: "transcribe"; samples: Float32Array; durationMs: number };

export type SpeechWorkerResponse =
  | { type: "progress"; progress: LocalSpeechProgress }
  | { type: "prepared"; preparation: LocalSpeechPreparation }
  | { type: "transcribed"; transcript: LocalTranscript }
  | { type: "error"; code: "model" | "prepare" };
