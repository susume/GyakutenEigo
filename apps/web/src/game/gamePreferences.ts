export type ArenaQuality = "auto" | "performance" | "balanced" | "high";

export type GamePreferences = {
  arenaQuality: ArenaQuality;
  highContrastHud: boolean;
  gamepadEnabled: boolean;
  soundEnabled: boolean;
  sfxVolume: number;
  musicVolume: number;
  vibrationEnabled: boolean;
};

export const GAME_PREFERENCES_STORAGE_KEY = "quizstrike_game_preferences";

export const DEFAULT_GAME_PREFERENCES: GamePreferences = {
  arenaQuality: "auto",
  highContrastHud: false,
  gamepadEnabled: true,
  soundEnabled: true,
  sfxVolume: 0.86,
  musicVolume: 0.16,
  vibrationEnabled: true
};

const clampVolume = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;

export const normalizeGamePreferences = (stored: Partial<GamePreferences>): GamePreferences => ({
  arenaQuality: ["auto", "performance", "balanced", "high"].includes(stored.arenaQuality ?? "")
    ? stored.arenaQuality as ArenaQuality
    : DEFAULT_GAME_PREFERENCES.arenaQuality,
  highContrastHud: typeof stored.highContrastHud === "boolean" ? stored.highContrastHud : DEFAULT_GAME_PREFERENCES.highContrastHud,
  gamepadEnabled: typeof stored.gamepadEnabled === "boolean" ? stored.gamepadEnabled : DEFAULT_GAME_PREFERENCES.gamepadEnabled,
  soundEnabled: typeof stored.soundEnabled === "boolean" ? stored.soundEnabled : DEFAULT_GAME_PREFERENCES.soundEnabled,
  sfxVolume: clampVolume(stored.sfxVolume, DEFAULT_GAME_PREFERENCES.sfxVolume),
  musicVolume: clampVolume(stored.musicVolume, DEFAULT_GAME_PREFERENCES.musicVolume),
  vibrationEnabled: typeof stored.vibrationEnabled === "boolean" ? stored.vibrationEnabled : DEFAULT_GAME_PREFERENCES.vibrationEnabled
});

export const readGamePreferences = (): GamePreferences => {
  try {
    const raw = localStorage.getItem(GAME_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_PREFERENCES;
    const stored = JSON.parse(raw) as Partial<GamePreferences>;
    return normalizeGamePreferences(stored);
  } catch {
    return DEFAULT_GAME_PREFERENCES;
  }
};

export const writeGamePreferences = (preferences: GamePreferences) => {
  localStorage.setItem(GAME_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
};

export const resolveArenaQuality = (
  quality: ArenaQuality,
  devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio,
) => {
  if (quality !== "auto") return quality;
  return devicePixelRatio >= 1.75 ? "performance" : "balanced";
};
