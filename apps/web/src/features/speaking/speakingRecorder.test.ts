import assert from "node:assert/strict";
import test from "node:test";
import { createSpeakingAudioRecorder, selectSpeakingAudioMimeType } from "./speakingRecorder.js";

test("Speaking recorder selects the first MIME type supported by the browser", () => {
  assert.equal(selectSpeakingAudioMimeType({ isTypeSupported: (mimeType) => mimeType === "audio/mp4" }), "audio/mp4");
  assert.equal(selectSpeakingAudioMimeType({ isTypeSupported: () => false }), "");
  assert.equal(selectSpeakingAudioMimeType(undefined), "");
});

test("Speaking recorder constructs MediaRecorder with the selected MIME type", () => {
  const runtime = globalThis as typeof globalThis & { MediaRecorder?: unknown };
  const original = runtime.MediaRecorder;
  class FakeMediaRecorder {
    static isTypeSupported(mimeType: string) { return mimeType === "audio/webm;codecs=opus"; }
    readonly mimeType = "audio/webm;codecs=opus";
    state = "inactive";
    constructor(readonly stream: MediaStream, readonly options?: { mimeType?: string }) {}
  }
  runtime.MediaRecorder = FakeMediaRecorder;
  try {
    const result = createSpeakingAudioRecorder({} as MediaStream);
    assert.equal(result.mimeType, "audio/webm;codecs=opus");
    assert.equal(result.recorder.options?.mimeType, "audio/webm;codecs=opus");
  } finally {
    if (original === undefined) delete runtime.MediaRecorder;
    else runtime.MediaRecorder = original;
  }
});
