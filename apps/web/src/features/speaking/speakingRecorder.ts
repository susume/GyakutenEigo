export const SPEAKING_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/wav"
] as const;

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
