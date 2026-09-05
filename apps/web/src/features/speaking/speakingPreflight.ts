import { createSpeakingAudioActivityMonitor } from "./speakingRecorder";

/** Permission is not evidence of signal. Always release the test stream. */
export async function testSpeakingMicrophone(signal: AbortSignal, onSignal: () => void): Promise<boolean | undefined> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  let monitor: ReturnType<typeof createSpeakingAudioActivityMonitor> | undefined;
  try {
    signal.throwIfAborted();
    monitor = createSpeakingAudioActivityMonitor(stream);
    return await new Promise<boolean | undefined>((resolve, reject) => {
      const started = Date.now();
      const cleanup = () => { clearInterval(timer); signal.removeEventListener("abort", abort); };
      const abort = () => { cleanup(); reject(new DOMException("Microphone check cancelled", "AbortError")); };
      const timer = setInterval(() => {
        const detected = monitor!.getSpeechDetected();
        if (detected === true) onSignal();
        if (detected === true || detected === undefined || Date.now() - started >= 5_000) {
          cleanup();
          resolve(detected);
        }
      }, 100);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
  } finally {
    monitor?.dispose();
    stream.getTracks().forEach((track) => track.stop());
  }
}
