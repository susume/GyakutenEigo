import { Check, LoaderCircle, Play, UserRound, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserTtsProvider } from "./speakingProviders";
import { SPEAKING_VOICE_PREVIEW_TEXT, type CuratedSpeakingVoice } from "./speakingVoices";

type PreviewState = { providerVoiceId: string; phase: "loading" | "playing" } | undefined;

type SpeakingVoiceSelectorProps = {
  voices: CuratedSpeakingVoice[];
  selectedVoiceId?: string;
  previewDisabled?: boolean;
  onSelect: (voice: CuratedSpeakingVoice) => void;
};

export default function SpeakingVoiceSelector({ voices, selectedVoiceId, previewDisabled = false, onSelect }: SpeakingVoiceSelectorProps) {
  const [preview, setPreview] = useState<PreviewState>();
  const previewTokenRef = useRef(0);

  useEffect(() => {
    if (!previewDisabled) return;
    previewTokenRef.current += 1;
    browserTtsProvider.cancel();
    setPreview(undefined);
  }, [previewDisabled]);

  useEffect(() => () => {
    previewTokenRef.current += 1;
    browserTtsProvider.cancel();
  }, []);

  const previewVoice = useCallback(async (voice: CuratedSpeakingVoice) => {
    if (previewDisabled) return;
    const current = preview;
    const token = ++previewTokenRef.current;
    browserTtsProvider.cancel();
    if (current?.providerVoiceId === voice.providerVoiceId) {
      setPreview(undefined);
      return;
    }
    setPreview({ providerVoiceId: voice.providerVoiceId, phase: "loading" });
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    if (previewTokenRef.current !== token) return;
    setPreview({ providerVoiceId: voice.providerVoiceId, phase: "playing" });
    try {
      await browserTtsProvider.speak(SPEAKING_VOICE_PREVIEW_TEXT, {
        lang: voice.voice.lang || "en-US",
        rate: 0.9,
        voiceId: voice.providerVoiceId
      });
    } finally {
      if (previewTokenRef.current === token) setPreview(undefined);
    }
  }, [preview, previewDisabled]);

  return <section className="speaking-voice-selector" data-testid="speaking-voice-selector" aria-labelledby="speaking-voice-selector-title">
    <div className="speaking-voice-selector-heading">
      <span className="speaking-voice-selector-icon" aria-hidden="true"><Volume2 size={19} strokeWidth={2.2} /></span>
      <div>
        <h3 id="speaking-voice-selector-title">Choose AI voice</h3>
        <p>You can preview the voice before you begin.</p>
      </div>
    </div>
    {voices.length > 0 ? <div className="speaking-voice-grid" role="list" aria-label="Approved English voices">
      {voices.map((voice) => {
        const selected = voice.providerVoiceId === selectedVoiceId;
        const activePreview = preview?.providerVoiceId === voice.providerVoiceId;
        return <article className={`speaking-voice-card${selected ? " is-selected" : ""}`} data-testid={`speaking-voice-card-${voice.preset.id}`} key={voice.providerVoiceId} role="listitem">
          <button
            className="speaking-voice-card-select"
            type="button"
            aria-pressed={selected}
            aria-label={`Choose ${voice.preset.displayName} voice`}
            onClick={() => onSelect(voice)}
          >
            <span className={`speaking-voice-avatar speaking-voice-avatar-${voice.preset.id}`} aria-hidden="true"><UserRound size={26} strokeWidth={1.8} /></span>
            <span className="speaking-voice-card-copy"><strong>{voice.preset.displayName}</strong><small>{voice.preset.descriptor}</small></span>
          </button>
          <button
            className={`speaking-voice-preview${activePreview ? " is-active" : ""}`}
            type="button"
            aria-label={`${activePreview ? "Stop" : "Preview"} ${voice.preset.displayName} voice`}
            aria-busy={activePreview && preview?.phase === "loading"}
            disabled={previewDisabled}
            onClick={() => void previewVoice(voice)}
          >
            {activePreview && preview?.phase === "loading" ? <LoaderCircle size={17} className="speaking-spin" aria-hidden="true" /> : activePreview ? <Volume2 size={17} aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
          </button>
          {selected && <span className="speaking-voice-selected-check" aria-label="Selected voice"><Check size={14} strokeWidth={3} aria-hidden="true" /></span>}
        </article>;
      })}
    </div> : <p className="speaking-voice-unavailable" role="status">Voice choices are not available on this browser, so the default English voice will be used.</p>}
    <p className="speaking-voice-preview-status" role="status" aria-live="polite">{preview ? preview.phase === "loading" ? "Loading preview…" : "Playing preview…" : ""}</p>
  </section>;
}
