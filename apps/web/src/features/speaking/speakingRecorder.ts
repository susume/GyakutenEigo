export const SPEAKING_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/wav"
] as const;

export type SpeakingAudioActivityMonitor = {
  getSpeechDetected: () => boolean | undefined;
  dispose: () => void;
};

const SPEECH_ACTIVITY_THRESHOLD = 0.025;

/**
 * Detects whether the live microphone signal contains meaningful audio. This
 * is deliberately only a UX/mock-mode hint: production transcription still
 * decides whether the uploaded recording contains speech.
 */
export const createSpeakingAudioActivityMonitor = (stream: MediaStream): SpeakingAudioActivityMonitor => {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
    return { getSpeechDetected: () => undefined, dispose: () => undefined };
  }

  let audioContext: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  let frameId: number | undefined;
  let disposed = false;
  let speechDetected = false;

  try {
    audioContext = new window.AudioContext();
    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2_048;
    analyser.smoothingTimeConstant = 0.1;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const sample = () => {
      if (disposed || !analyser) return;
      analyser.getByteTimeDomainData(samples);
      let squaredTotal = 0;
      for (const sampleValue of samples) {
        const centered = (sampleValue - 128) / 128;
        squaredTotal += centered * centered;
      }
      const rms = Math.sqrt(squaredTotal / samples.length);
      if (rms >= SPEECH_ACTIVITY_THRESHOLD) speechDetected = true;
      frameId = window.requestAnimationFrame(sample);
    };
    void audioContext.resume().catch(() => undefined);
    frameId = window.requestAnimationFrame(sample);
  } catch {
    if (audioContext) void audioContext.close().catch(() => undefined);
    return { getSpeechDetected: () => undefined, dispose: () => undefined };
  }

  return {
    getSpeechDetected: () => speechDetected,
    dispose: () => {
      disposed = true;
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
      source?.disconnect();
      analyser?.disconnect();
      void audioContext?.close().catch(() => undefined);
    }
  };
};

export const selectSpeakingAudioMimeType = (mediaRecorder: Pick<typeof MediaRecorder, "isTypeSupported"> | undefined = typeof MediaRecorder === "undefined" ? undefined : MediaRecorder) => {
  if (!mediaRecorder?.isTypeSupported) return "";
  return SPEAKING_AUDIO_MIME_TYPES.find((mimeType) => mediaRecorder.isTypeSupported(mimeType)) ?? "";
};

export const createSpeakingAudioRecorder = (stream: MediaStream) => {
  if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder is not supported by this browser.");
  const mimeType = selectSpeakingAudioMimeType(MediaRecorder);
  if (mimeType) {
    try {
      return { recorder: new MediaRecorder(stream, { mimeType }), mimeType };
    } catch {
      // Some Safari versions report a MIME type as supported but reject it at
      // construction time. Let the browser choose its native format.
    }
  }
  return {
    recorder: new MediaRecorder(stream),
    mimeType: ""
  };
};
