import assert from "node:assert/strict";
import test from "node:test";
import { cancelSpeakingAudioCapture, createSpeakingAudioRecorder, selectSpeakingAudioMimeType, stopSpeakingAudioCapture, type SpeakingAudioCapture } from "./speakingRecorder.js";

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

test("cancelling a speaking capture stops every resource without submitting", () => {
  let stopCount = 0;
  let trackStopCount = 0;
  let monitorDisposeCount = 0;
  let submitted = false;
  const recorder = {
    state: "recording" as RecordingState,
    stop() {
      stopCount += 1;
      this.state = "inactive";
      submitted = capture.submitOnStop;
      capture.onstop?.();
    },
    onstop: undefined as (() => void) | undefined
  } as unknown as MediaRecorder & { onstop?: () => void };
  const capture = {
    recorder,
    stream: { getTracks: () => [{ stop: () => { trackStopCount += 1; } }] } as unknown as MediaStream,
    timeoutId: 0,
    activityMonitor: { getSpeechDetected: () => true, dispose: () => { monitorDisposeCount += 1; } },
    requestId: "cancel-test",
    startedAtMs: Date.now(),
    submitOnStop: true
  } satisfies SpeakingAudioCapture;
  recorder.onstop = () => { submitted = capture.submitOnStop; };

  cancelSpeakingAudioCapture(capture);

  assert.equal(stopCount, 1);
  assert.equal(trackStopCount, 1);
  assert.equal(monitorDisposeCount, 1);
  assert.equal(submitted, false);
  assert.equal(capture.submitOnStop, false);
});

test("an intentional speaking stop keeps submission enabled", () => {
  let submitted = false;
  const recorder = {
    state: "recording" as RecordingState,
    stop() {
      this.state = "inactive";
      submitted = capture.submitOnStop;
    }
  } as unknown as MediaRecorder;
  const capture = {
    recorder,
    stream: { getTracks: () => [] } as unknown as MediaStream,
    timeoutId: 0,
    activityMonitor: { getSpeechDetected: () => true, dispose: () => undefined },
    requestId: "stop-test",
    startedAtMs: Date.now(),
    submitOnStop: false
  } satisfies SpeakingAudioCapture;

  stopSpeakingAudioCapture(capture);

  assert.equal(submitted, true);
  assert.equal(capture.submitOnStop, true);
});
