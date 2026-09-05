export interface SpeakOptions {
  lang?: string;
  rate?: number;
}

export interface TTSProvider {
  speak(text: string, options?: SpeakOptions): Promise<void>;
  cancel(): void;
}

let activeSpeech: { resolve: () => void; utterance: SpeechSynthesisUtterance; timeoutId: ReturnType<typeof setTimeout> } | undefined;

const resolveActiveSpeech = (utterance?: SpeechSynthesisUtterance) => {
  const current = activeSpeech;
  if (!current || (utterance && current.utterance !== utterance)) return;
  activeSpeech = undefined;
  clearTimeout(current.timeoutId);
  current?.resolve();
};

/** Browser TTS is presentation only; transcripts and AI decisions stay server-side. */
export const browserTtsProvider: TTSProvider = {
  speak(text, options = {}) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();
    resolveActiveSpeech();
    window.speechSynthesis.cancel();
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang ?? "en-US";
      utterance.rate = options.rate ?? 0.92;
      const timeoutId = setTimeout(() => {
        if (activeSpeech?.utterance !== utterance) return;
        window.speechSynthesis.cancel();
        resolveActiveSpeech(utterance);
      }, 30_000);
      activeSpeech = { resolve, utterance, timeoutId };
      utterance.onend = () => resolveActiveSpeech(utterance);
      utterance.onerror = () => resolveActiveSpeech(utterance);
      try { window.speechSynthesis.speak(utterance); }
      catch { resolveActiveSpeech(utterance); }
    });
  },
  cancel() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    resolveActiveSpeech();
  }
};
