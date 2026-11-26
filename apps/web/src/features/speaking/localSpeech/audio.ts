export const LOCAL_SAMPLE_RATE = 16_000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export class LocalSpeechError extends Error {
  constructor(readonly code: "unsupported" | "decode" | "too-long" | "too-large" | "timeout" | "model" | "busy" | "prepare") {
    super(code);
    this.name = "LocalSpeechError";
  }
}

// The gate rejects very quiet or nearly constant input. It leaves the waveform
// intact and cannot distinguish all kinds of background sound from speech.
export function hasLikelySpeech(samples: Float32Array) {
  const frameSize = LOCAL_SAMPLE_RATE / 50;
  let activeFrames = 0;
  let peakRms = 0;
  let weakestRms = Infinity;
  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    let squareSum = 0;
    for (let offset = 0; offset < frameSize; offset++) squareSum += samples[start + offset]! ** 2;
    const rms = Math.sqrt(squareSum / frameSize);
    if (rms >= 0.002) activeFrames++;
    peakRms = Math.max(peakRms, rms);
    weakestRms = Math.min(weakestRms, rms);
  }
  return activeFrames >= 5 && peakRms >= weakestRms * 1.7;
}

export async function decodeLocalAudio(blob: Blob, maxSeconds: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!blob.size) throw new LocalSpeechError("decode");
  if (blob.size > MAX_FILE_BYTES) throw new LocalSpeechError("too-large");
  if (typeof OfflineAudioContext === "undefined") throw new LocalSpeechError("unsupported");
  const context = new OfflineAudioContext(1, 1, LOCAL_SAMPLE_RATE);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  let audio: AudioBuffer;
  try {
    const bytes = await blob.arrayBuffer();
    signal?.throwIfAborted();
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new LocalSpeechError("timeout")), 12_000);
      abort = () => reject(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
    });
    audio = await Promise.race([context.decodeAudioData(bytes), limit]);
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof LocalSpeechError) throw error;
    throw new LocalSpeechError("decode");
  } finally {
    clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
  }
  signal?.throwIfAborted();
  if (audio.duration > maxSeconds) throw new LocalSpeechError("too-long");
  // decodeAudioData resamples to the context rate. Average stereo channels.
  const samples = new Float32Array(audio.length);
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const data = audio.getChannelData(channel);
    for (let i = 0; i < data.length; i++) samples[i] = samples[i]! + data[i]! / audio.numberOfChannels;
  }
  return { samples, durationMs: Math.round(audio.duration * 1_000) };
}
