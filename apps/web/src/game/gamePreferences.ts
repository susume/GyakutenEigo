export type ArenaQuality = "auto" | "performance" | "balanced" | "high";

export type GamePreferences = {
  arenaQuality: ArenaQuality;
  gamepadEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
};

export const GAME_PREFERENCES_STORAGE_KEY = "quizstrike_game_preferences";

export const DEFAULT_GAME_PREFERENCES: GamePreferences = {
  arenaQuality: "auto",
  gamepadEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true
};

export const readGamePreferences = (): GamePreferences => {
  try {
    const raw = localStorage.getItem(GAME_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_PREFERENCES;
    const stored = JSON.parse(raw) as Partial<GamePreferences>;
    return {
      arenaQuality: ["auto", "performance", "balanced", "high"].includes(stored.arenaQuality ?? "")
        ? stored.arenaQuality as ArenaQuality
        : DEFAULT_GAME_PREFERENCES.arenaQuality,
      gamepadEnabled: typeof stored.gamepadEnabled === "boolean" ? stored.gamepadEnabled : DEFAULT_GAME_PREFERENCES.gamepadEnabled,
      soundEnabled: typeof stored.soundEnabled === "boolean" ? stored.soundEnabled : DEFAULT_GAME_PREFERENCES.soundEnabled,
      vibrationEnabled: typeof stored.vibrationEnabled === "boolean" ? stored.vibrationEnabled : DEFAULT_GAME_PREFERENCES.vibrationEnabled
    };
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
  return devicePixelRatio > 1.5 ? "balanced" : "high";
};
