/**
 * The speaking experience uses the browser's SpeechSynthesis provider for
 * presentation audio. Keep this list deliberately small and product-facing;
 * never render the browser's complete voice catalogue to learners.
 */

export const SPEAKING_VOICE_PREVIEW_TEXT = "Hi! I’m ready. Let’s practise English together.";
export const DEFAULT_SPEAKING_VOICE_PRESET_ID = "mika" as const;
export const SPEAKING_VOICE_PREFERENCE_STORAGE_KEY = "speaking-preferred-voice";

export type SpeakingVoicePreset = {
  readonly id: "mika" | "ken" | "alex";
  readonly displayName: string;
  readonly descriptor: string;
  readonly matchers: readonly RegExp[];
};

/**
 * Matchers describe high-quality, English-capable browser voices that are
 * known to be suitable for conversational practice. The actual provider ID
 * is resolved from SpeechSynthesisVoice.voiceURI at runtime, because browser
 * voice IDs differ between Windows, macOS, iPadOS and Chrome/Edge builds.
 */
export const APPROVED_ENGLISH_VOICES: readonly SpeakingVoicePreset[] = [
  {
    id: "mika",
    displayName: "Mika",
    descriptor: "Friendly",
    matchers: [
      /microsoft\s+(jenny|aria|ava|emma|susan)\b.*(?:natural|english)/iu,
      /microsoft\s+catherine\b.*english/iu,
      /google\s+us\s+english\s+female\b/iu,
      /samantha(?:\s+premium)?\b/iu,
      /microsoft\s+zira\b.*english/iu
    ]
  },
  {
    id: "ken",
    displayName: "Ken",
    descriptor: "Clear",
    matchers: [
      /microsoft\s+(guy|andrew|davis|david|mark|brian)\b.*(?:natural|english)/iu,
      /microsoft\s+james\b.*english/iu,
      /google\s+(?:us|uk)\s+english\s+male\b/iu,
      /alex(?:\s+premium)?\b/iu,
      /daniel(?:\s+premium)?\b/iu,
      /microsoft\s+(?:david|mark)\b.*english/iu
    ]
  },
  {
    id: "alex",
    displayName: "Alex",
    descriptor: "Calm",
    matchers: [
      /microsoft\s+(sonia|libby|hazel|ryan|george|moira|karen)\b.*(?:natural|english)/iu,
      /google\s+uk\s+english\s+female\b/iu,
      /karen(?:\s+premium)?\b/iu,
      /microsoft\s+(?:hazel|ryan)\b.*english/iu
    ]
  }
] as const;

export type ApprovedSpeakingVoicePresetId = (typeof APPROVED_ENGLISH_VOICES)[number]["id"];

export type CuratedSpeakingVoice = {
  readonly preset: SpeakingVoicePreset;
  readonly providerVoiceId: string;
  readonly voice: SpeechSynthesisVoice;
};

const voiceText = (voice: SpeechSynthesisVoice) => `${voice.name} ${voice.voiceURI}`.trim();

const isEnglishVoice = (voice: SpeechSynthesisVoice) => {
  const language = voice.lang.trim().replace(/_/gu, "-").toLowerCase();
  return language === "en" || language.startsWith("en-") || /\benglish\b/iu.test(voiceText(voice));
};

const voiceProviderId = (voice: SpeechSynthesisVoice) => voice.voiceURI.trim() || voice.name.trim();

const qualityBonus = (voice: SpeechSynthesisVoice) => {
  const text = voiceText(voice);
  const naturalBonus = /online\s*\(natural\)|\bnatural\b/iu.test(text) ? 40 : 0;
  const knownServiceBonus = /^(?:microsoft|google)\b/iu.test(text.trim()) ? 8 : 0;
  return naturalBonus + knownServiceBonus + (voice.default ? 1 : 0);
};

const bestVoiceForPreset = (preset: SpeakingVoicePreset, voices: readonly SpeechSynthesisVoice[], usedIds: ReadonlySet<string>) => {
  const candidates = voices
    .filter((voice) => isEnglishVoice(voice))
    .map((voice, index) => {
      const providerVoiceId = voiceProviderId(voice);
      const matcherIndex = preset.matchers.findIndex((matcher) => matcher.test(voiceText(voice)));
      return { voice, providerVoiceId, matcherIndex, index };
    })
    .filter((candidate) => candidate.matcherIndex >= 0 && candidate.providerVoiceId && !usedIds.has(candidate.providerVoiceId))
    .sort((left, right) => {
      const matcherDifference = left.matcherIndex - right.matcherIndex;
      if (matcherDifference) return matcherDifference;
      const qualityDifference = qualityBonus(right.voice) - qualityBonus(left.voice);
      return qualityDifference || left.index - right.index;
    });
  const selected = candidates[0];
  return selected ? { preset, providerVoiceId: selected.providerVoiceId, voice: selected.voice } : undefined;
};

/** Resolve at most one real browser voice per product-facing voice preset. */
export const getCuratedSpeakingVoices = (voices: readonly SpeechSynthesisVoice[]): CuratedSpeakingVoice[] => {
  const usedIds = new Set<string>();
  const curated: CuratedSpeakingVoice[] = [];
  for (const preset of APPROVED_ENGLISH_VOICES) {
    const selected = bestVoiceForPreset(preset, voices, usedIds);
    if (!selected) continue;
    usedIds.add(selected.providerVoiceId);
    curated.push(selected);
  }
  return curated;
};

export const getDefaultCuratedSpeakingVoice = (voices: readonly SpeechSynthesisVoice[]) => {
  const curated = getCuratedSpeakingVoices(voices);
  return curated.find((option) => option.preset.id === DEFAULT_SPEAKING_VOICE_PRESET_ID) ?? curated[0];
};

export const isApprovedSpeakingVoiceId = (providerVoiceId: string | undefined, voices: readonly SpeechSynthesisVoice[]) =>
  Boolean(providerVoiceId && getCuratedSpeakingVoices(voices).some((option) => option.providerVoiceId === providerVoiceId));

export const getBrowserSpeechSynthesis = (): SpeechSynthesis | undefined => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  return window.speechSynthesis;
};

export const readBrowserSpeechVoices = (): SpeechSynthesisVoice[] => {
  const synthesis = getBrowserSpeechSynthesis();
  if (!synthesis || typeof synthesis.getVoices !== "function") return [];
  try {
    return Array.from(synthesis.getVoices());
  } catch {
    return [];
  }
};

export const resolveCuratedSpeakingVoice = (providerVoiceId: string | undefined, voices = readBrowserSpeechVoices()) => {
  if (!providerVoiceId) return undefined;
  return getCuratedSpeakingVoices(voices).find((option) => option.providerVoiceId === providerVoiceId);
};

export const speakingVoiceSessionStorageKey = (sessionId: string) => `speaking-voice:${sessionId}`;

const readStorageValue = (storage: Storage | undefined, key: string) => {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as { providerVoiceId?: unknown };
      return typeof parsed.providerVoiceId === "string" ? parsed.providerVoiceId : raw;
    } catch {
      return raw;
    }
  } catch {
    return undefined;
  }
};

const sessionStorageIfAvailable = () => typeof sessionStorage === "undefined" ? undefined : sessionStorage;
const localStorageIfAvailable = () => typeof localStorage === "undefined" ? undefined : localStorage;

export const readSpeakingVoiceForSession = (sessionId: string) => readStorageValue(sessionStorageIfAvailable(), speakingVoiceSessionStorageKey(sessionId));
export const readSpeakingVoicePreference = () => readStorageValue(localStorageIfAvailable(), SPEAKING_VOICE_PREFERENCE_STORAGE_KEY);

export const persistSpeakingVoiceSelection = (sessionId: string, option: CuratedSpeakingVoice) => {
  const value = JSON.stringify({ presetId: option.preset.id, providerVoiceId: option.providerVoiceId });
  try { sessionStorageIfAvailable()?.setItem(speakingVoiceSessionStorageKey(sessionId), value); } catch { /* Storage can be disabled in private browsing. */ }
  try { localStorageIfAvailable()?.setItem(SPEAKING_VOICE_PREFERENCE_STORAGE_KEY, value); } catch { /* The active session remains authoritative. */ }
};

/** Return the approved session voice, falling back when a stored URI is stale. */
export const speakingVoiceIdForSession = (sessionId: string) => {
  const voices = readBrowserSpeechVoices();
  const current = readSpeakingVoiceForSession(sessionId);
  const valid = resolveCuratedSpeakingVoice(current, voices);
  if (valid) return valid.providerVoiceId;
  return getDefaultCuratedSpeakingVoice(voices)?.providerVoiceId;
};
