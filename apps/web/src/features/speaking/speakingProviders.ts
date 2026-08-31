export interface SpeakOptions {
  lang?: string;
  rate?: number;
}

export interface TTSProvider {
  speak(text: string, options?: SpeakOptions): Promise<void>;
  cancel(): void;
}

let activeSpeech: { resolve: () => void; utterance: SpeechSynthesisUtterance } | undefined;

const resolveActiveSpeech = (utterance?: SpeechSynthesisUtterance) => {
  const current = activeSpeech;
  if (!current || (utterance && current.utterance !== utterance)) return;
  activeSpeech = undefined;
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
      activeSpeech = { resolve, utterance };
      utterance.onend = () => resolveActiveSpeech(utterance);
      utterance.onerror = () => resolveActiveSpeech(utterance);
      window.speechSynthesis.speak(utterance);
    });
  },
  cancel() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    resolveActiveSpeech();
  }
};
