export type Team = "blue" | "red";
export type SessionStatus = "waiting" | "active" | "paused" | "ended";
export type Choice = "A" | "B" | "C" | "D";
export type GameMode = "flag" | "zombie" | "classic";
export type ArenaMapId = "desert_citadel" | "iron_junction" | "temple_runoff";
export type TeamAssignment = "players_choose" | "random";
export type PlayerRole = "human" | "zombie";
export type BotDifficulty = "beginner" | "standard" | "advanced";
export type GameAnnouncementKind = "round_result" | "buy_phase" | "round_start" | "game_over";
export type RoundTransitionPhase = "result" | "buy";
export type FlagStateName =
  | "available"
  | "carried"
  | "dropped"
  | "being_placed"
  | "placed"
  | "being_captured"
  | "captured"
  | "expired"
  | "resetting";
export type GameEventType =
  | "join"
  | "start"
  | "answer"
  | "buy"
  | "tag"
  | "elimination"
  | "respawn"
  | "end"
  | "timer";

export interface TeacherUser {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "admin";
}

export interface ClassSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Question {
  id: string;
  quizSetId: string;
  prompt: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correctChoice: Choice;
  explanation?: string;
  difficulty?: string;
  createdAt: string;
}

export type PublicQuestion = Omit<Question, "correctChoice">;

export interface QuizSet {
  id: string;
  teacherId: string;
  classId?: string;
  title: string;
  description?: string;
  questions: Question[];
  createdAt: string;
}

export const APPEARANCE_VERSION = 4 as const;
export const APPEARANCE_MAX_JSON_BYTES = 2048;
export const APPEARANCE_UPDATE_COOLDOWN_MS = 750;
export const DECAL_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const DECAL_MAX_PROCESSED_BYTES = 384 * 1024;
export const DECAL_MAX_DIMENSION = 512;

export const CHARACTER_PRESETS = ["assault", "support", "sniper", "engineer", "medic", "heavy"] as const;
export const HEAD_STYLE_IDS = ["human", "fox", "panda", "bear", "rabbit", "robot"] as const;
export const BACK_ACCESSORY_IDS = [
  "none",
  "utility_pack",
  "compact_pack",
  "tech_pack",
  "trail_pack",
  "book_satchel",
  "rocket_pack",
  "team_pennant"
] as const;
export const DETAIL_ACCESSORY_IDS = [
  "none",
  "shoulder_badge",
  "wrist_device",
  "quiz_medal",
  "compass_badge",
  "champion_star"
] as const;
export const VICTORY_POSE_IDS = [
  "champion",
  "wave",
  "salute",
  "power"
] as const;

export type CharacterPreset = (typeof CHARACTER_PRESETS)[number];
export type PlayerHeadStyleId = (typeof HEAD_STYLE_IDS)[number];
export type PlayerBackAccessoryId = (typeof BACK_ACCESSORY_IDS)[number];
export type PlayerDetailAccessoryId = (typeof DETAIL_ACCESSORY_IDS)[number];
export type PlayerVictoryPoseId = (typeof VICTORY_POSE_IDS)[number];
export type CosmeticSlot = "head" | "back" | "detail" | "pose";

export interface CosmeticCatalogItem {
  id: string;
  slot: CosmeticSlot;
  name: string;
  description: string;
  unlockLevel: number;
}

export interface HeadStyleCatalogItem {
  id: PlayerHeadStyleId;
  name: string;
  description: string;
  unlockLevel: number;
}

export const HEAD_STYLE_CATALOG = [
  { id: "human", name: "Human", description: "Classic QuizStrike hero", unlockLevel: 1 },
  { id: "fox", name: "Fox", description: "Bright, quick and confident", unlockLevel: 1 },
  { id: "panda", name: "Panda", description: "Calm mascot energy", unlockLevel: 1 },
  { id: "bear", name: "Bear", description: "Bold and dependable", unlockLevel: 1 },
  { id: "rabbit", name: "Rabbit", description: "Alert and arena-ready", unlockLevel: 1 },
  { id: "robot", name: "Robot", description: "Friendly future fighter", unlockLevel: 1 }
] as const satisfies ReadonlyArray<HeadStyleCatalogItem>;

export const COSMETIC_CATALOG = [
  ...HEAD_STYLE_CATALOG.map((style) => ({ ...style, slot: "head" as const })),
  { id: "none", slot: "back", name: "No Back Gear", description: "Clean arena kit", unlockLevel: 1 },
  { id: "utility_pack", slot: "back", name: "Utility Pack", description: "Classic field pack", unlockLevel: 1 },
  { id: "compact_pack", slot: "back", name: "Compact Pack", description: "Light match kit", unlockLevel: 1 },
  { id: "tech_pack", slot: "back", name: "Tech Pack", description: "Signal-ready pack", unlockLevel: 1 },
  { id: "trail_pack", slot: "back", name: "Trail Pack", description: "Adventure roll", unlockLevel: 1 },
  { id: "book_satchel", slot: "back", name: "Book Satchel", description: "Study supplies", unlockLevel: 2 },
  { id: "rocket_pack", slot: "back", name: "Boost Pack", description: "Cosmetic thrusters", unlockLevel: 4 },
  { id: "team_pennant", slot: "back", name: "Team Pennant", description: "Carry your colours", unlockLevel: 5 },
  { id: "none", slot: "detail", name: "No Detail", description: "Simple uniform", unlockLevel: 1 },
  { id: "shoulder_badge", slot: "detail", name: "Team Crest", description: "Shoulder emblem", unlockLevel: 1 },
  { id: "wrist_device", slot: "detail", name: "Wrist Device", description: "Match tracker", unlockLevel: 2 },
  { id: "quiz_medal", slot: "detail", name: "Quiz Medal", description: "Knowledge award", unlockLevel: 3 },
  { id: "compass_badge", slot: "detail", name: "Compass Badge", description: "Explorer insignia", unlockLevel: 4 },
  { id: "champion_star", slot: "detail", name: "Champion Star", description: "Top-tier crest", unlockLevel: 5 },
  { id: "champion", slot: "pose", name: "Champion", description: "Two-arm celebration", unlockLevel: 1 },
  { id: "wave", slot: "pose", name: "Friendly Wave", description: "Classroom hello", unlockLevel: 1 },
  { id: "salute", slot: "pose", name: "Team Salute", description: "Ready for the round", unlockLevel: 2 },
  { id: "power", slot: "pose", name: "Power Pose", description: "Confident finish", unlockLevel: 3 }
] as const satisfies ReadonlyArray<CosmeticCatalogItem>;

export const COSMETIC_LEVEL_THRESHOLDS = [0, 300, 700, 1200, 1800] as const;
export const COSMETIC_LEVEL_NAMES = ["Rookie", "Scout", "Scholar", "Ace", "Champion"] as const;

export interface CosmeticProgress {
  xp: number;
  level: number;
  levelName: string;
  levelStartXp: number;
  nextLevelXp?: number;
  progressPercent: number;
}

export const getCosmeticProgress = (
  player: Pick<PlayerSession, "correctAnswers" | "tags" | "cosmeticXp">
): CosmeticProgress => {
  const xp = Number.isFinite(player.cosmeticXp)
    ? Math.max(0, Math.floor(player.cosmeticXp!))
    : Math.max(0, player.correctAnswers) * 100 + Math.max(0, player.tags ?? 0) * 75;
  let levelIndex = 0;
  for (let index = 0; index < COSMETIC_LEVEL_THRESHOLDS.length; index += 1) {
    if (xp >= COSMETIC_LEVEL_THRESHOLDS[index]) levelIndex = index;
  }
  const levelStartXp = COSMETIC_LEVEL_THRESHOLDS[levelIndex];
  const nextLevelXp = COSMETIC_LEVEL_THRESHOLDS[levelIndex + 1];
  return {
    xp,
    level: levelIndex + 1,
    levelName: COSMETIC_LEVEL_NAMES[levelIndex],
    levelStartXp,
    nextLevelXp,
    progressPercent: nextLevelXp === undefined
      ? 100
      : Math.round(((xp - levelStartXp) / (nextLevelXp - levelStartXp)) * 100)
  };
};

const catalogItem = (slot: CosmeticSlot, id: string) =>
  COSMETIC_CATALOG.find((item) => item.slot === slot && item.id === id);

export interface PlayerAppearance {
  characterPreset: CharacterPreset;
  headStyleId: PlayerHeadStyleId;
  backAccessoryId: PlayerBackAccessoryId;
  detailAccessoryId: PlayerDetailAccessoryId;
  victoryPoseId: PlayerVictoryPoseId;
  decalAssetId?: string;
  appearanceVersion: typeof APPEARANCE_VERSION;
}

export const getLockedAppearanceItems = (
  appearance: PlayerAppearance,
  level: number
): CosmeticCatalogItem[] => [
  catalogItem("head", appearance.headStyleId),
  catalogItem("back", appearance.backAccessoryId),
  catalogItem("detail", appearance.detailAccessoryId),
  catalogItem("pose", appearance.victoryPoseId)
].filter((item): item is (typeof COSMETIC_CATALOG)[number] => Boolean(item && item.unlockLevel > level));

export interface CharacterCustomizationSettings {
  enabled: boolean;
  uploadsEnabled: boolean;
  aiEnabled: boolean;
  presetsOnly: boolean;
  persistAcrossSessions: boolean;
}

export const DEFAULT_PLAYER_APPEARANCE: PlayerAppearance = {
  characterPreset: "assault",
  headStyleId: "human",
  backAccessoryId: "utility_pack",
  detailAccessoryId: "none",
  victoryPoseId: "champion",
  appearanceVersion: APPEARANCE_VERSION
};

export const SCHOOL_APPEARANCE_PRESETS = [
  { id: "captain", name: "Captain", appearance: DEFAULT_PLAYER_APPEARANCE },
  {
    id: "trailblazer",
    name: "Trailblazer",
    appearance: {
      ...DEFAULT_PLAYER_APPEARANCE,
      characterPreset: "support",
      headStyleId: "fox",
      backAccessoryId: "compact_pack",
      detailAccessoryId: "shoulder_badge",
      victoryPoseId: "wave"
    }
  },
  {
    id: "inventor",
    name: "Inventor",
    appearance: {
      ...DEFAULT_PLAYER_APPEARANCE,
      characterPreset: "engineer",
      headStyleId: "robot",
      backAccessoryId: "tech_pack",
      detailAccessoryId: "none"
    }
  },
  {
    id: "scout",
    name: "Scout",
    appearance: {
      ...DEFAULT_PLAYER_APPEARANCE,
      characterPreset: "sniper",
      headStyleId: "rabbit",
      backAccessoryId: "none",
      detailAccessoryId: "none"
    }
  },
  {
    id: "defender",
    name: "Defender",
    appearance: {
      ...DEFAULT_PLAYER_APPEARANCE,
      characterPreset: "heavy",
      headStyleId: "bear",
      backAccessoryId: "utility_pack",
      detailAccessoryId: "shoulder_badge"
    }
  },
  {
    id: "explorer",
    name: "Explorer",
    appearance: {
      ...DEFAULT_PLAYER_APPEARANCE,
      characterPreset: "medic",
      headStyleId: "panda",
      backAccessoryId: "trail_pack",
      detailAccessoryId: "none",
      victoryPoseId: "wave"
    }
  }
] as const satisfies ReadonlyArray<{ id: string; name: string; appearance: PlayerAppearance }>;

export const isApprovedAppearancePreset = (appearance: PlayerAppearance): boolean => {
  const comparable = { ...appearance, decalAssetId: undefined };
  return SCHOOL_APPEARANCE_PRESETS.some((preset) =>
    JSON.stringify({ ...preset.appearance, decalAssetId: undefined }) === JSON.stringify(comparable)
  );
};

export const DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS: CharacterCustomizationSettings = {
  enabled: true,
  uploadsEnabled: false,
  aiEnabled: false,
  presetsOnly: false,
  persistAcrossSessions: false
};

const isAllowed = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export const sanitizeCharacterCustomizationSettings = (
  input: Partial<CharacterCustomizationSettings> | undefined
): CharacterCustomizationSettings => ({
  enabled: typeof input?.enabled === "boolean" ? input.enabled : DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS.enabled,
  uploadsEnabled: typeof input?.uploadsEnabled === "boolean" ? input.uploadsEnabled : DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS.uploadsEnabled,
  aiEnabled: typeof input?.aiEnabled === "boolean" ? input.aiEnabled : DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS.aiEnabled,
  presetsOnly: typeof input?.presetsOnly === "boolean" ? input.presetsOnly : DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS.presetsOnly,
  persistAcrossSessions: typeof input?.persistAcrossSessions === "boolean"
    ? input.persistAcrossSessions
    : DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS.persistAcrossSessions
});

export const sanitizePlayerAppearance = (
  input: Partial<PlayerAppearance> | Record<string, unknown> | undefined
): PlayerAppearance => {
  const source = (input ?? {}) as Record<string, unknown>;
  const decalAssetId = typeof source.decalAssetId === "string" && /^[a-f0-9-]{36}$/.test(source.decalAssetId)
    ? source.decalAssetId
    : undefined;
  // Versions 1-3 stored pieces worn by an always-visible human head. The new
  // complete-head system intentionally maps every one of those pieces to the
  // safe human style rather than trying to stack or approximate old gear.
  const migratedHeadStyle: PlayerHeadStyleId = "human";
  const legacyAccessory = source.accessoryId;
  const migratedBackAccessory: PlayerBackAccessoryId =
    legacyAccessory === "shoulder_badge" ? "none"
      : isAllowed(BACK_ACCESSORY_IDS, legacyAccessory) ? legacyAccessory
        : source.backpackStyle === "radio_pack" ? "tech_pack"
          : source.backpackStyle === "bedroll" ? "trail_pack"
            : source.backpackStyle === "none" ? "none"
              : "utility_pack";
  const migratedDetailAccessory: PlayerDetailAccessoryId =
    legacyAccessory === "shoulder_badge" ? "shoulder_badge" : "none";
  return {
    characterPreset: isAllowed(CHARACTER_PRESETS, source.characterPreset) ? source.characterPreset : DEFAULT_PLAYER_APPEARANCE.characterPreset,
    headStyleId: isAllowed(HEAD_STYLE_IDS, source.headStyleId) ? source.headStyleId : migratedHeadStyle,
    backAccessoryId: isAllowed(BACK_ACCESSORY_IDS, source.backAccessoryId) ? source.backAccessoryId : migratedBackAccessory,
    detailAccessoryId: isAllowed(DETAIL_ACCESSORY_IDS, source.detailAccessoryId) ? source.detailAccessoryId : migratedDetailAccessory,
    victoryPoseId: isAllowed(VICTORY_POSE_IDS, source.victoryPoseId) ? source.victoryPoseId : "champion",
    ...(decalAssetId ? { decalAssetId } : {}),
    appearanceVersion: APPEARANCE_VERSION
  };
};

export const getPlayerAppearanceError = (input: unknown): string | undefined => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Appearance must be an object.";
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > APPEARANCE_MAX_JSON_BYTES) return "Appearance data is too large.";
  const source = input as Record<string, unknown>;
  const allowedKeys = new Set([
    "characterPreset", "headStyleId", "backAccessoryId", "detailAccessoryId", "victoryPoseId",
    "decalAssetId", "appearanceVersion"
  ]);
  if (Object.keys(source).some((key) => !allowedKeys.has(key))) return "Appearance contains an unsupported field.";
  if (source.appearanceVersion !== APPEARANCE_VERSION) return "Unsupported appearance version.";
  const checks: Array<[readonly string[], unknown, string]> = [
    [CHARACTER_PRESETS, source.characterPreset, "character preset"],
    [HEAD_STYLE_IDS, source.headStyleId, "head style"],
    [BACK_ACCESSORY_IDS, source.backAccessoryId, "back accessory"],
    [DETAIL_ACCESSORY_IDS, source.detailAccessoryId, "detail accessory"],
    [VICTORY_POSE_IDS, source.victoryPoseId, "victory pose"]
  ];
  const invalid = checks.find(([values, value]) => !isAllowed(values, value));
  if (invalid) return `Invalid ${invalid[2]}.`;
  if (source.decalAssetId !== undefined && (typeof source.decalAssetId !== "string" || !/^[a-f0-9-]{36}$/.test(source.decalAssetId))) {
    return "Invalid decal asset ID.";
  }
  return undefined;
};

export interface SessionSettings {
  mapId: ArenaMapId;
  gameMode: GameMode;
  botDifficulty: BotDifficulty;
  roundCount: number;
  flagHoldSeconds: number;
  teamAssignment: TeamAssignment;
  initialZombieCount?: number;
  startingMoney: number;
  startingSnowballs: number;
  correctAnswerReward: number;
  fastAnswerBonus: number;
  fastAnswerThresholdMs: number;
  wrongAnswerPenalty: number;
  snowballPackPrice: number;
  snowballsPerPack: number;
  roundDurationSeconds: number;
  maxPlayers: number;
  deadPlayersCanPractice: boolean;
  deadPlayersEarnMoney: boolean;
  characterCustomization: CharacterCustomizationSettings;
}

export interface GearItem {
  id: string;
  name: string;
  cost: number;
  description: string;
  damage?: number;
  range?: number;
  scopedHitRadius?: number;
  deepScopedHitRadius?: number;
  unscopedHitRadius?: number;
  speedBonus?: number;
  healthBonus?: number;
  fireCooldownMs?: number;
  autoFire?: boolean;
  zoomFovMultiplier?: number;
}

export interface PlayerSession {
  id: string;
  gameSessionId: string;
  nickname: string;
  team: Team;
  money: number;
  /** Total rewards earned from quiz answers in this session. */
  quizMoneyEarned?: number;
  /** Total money spent on shop purchases in this session. */
  moneySpent?: number;
  isAlive: boolean;
  health?: number;
  /** Zombie Mode running energy. Humans spend it while sprinting; correct answers restore it. */
  energy?: number;
  snowballs?: number;
  respawnCorrectAnswers?: number;
  isBot?: boolean;
  role?: PlayerRole;
  /** Set when a human is converted during Zombie Mode; initial zombies do not receive a timestamp. */
  zombieConvertedAt?: string;
  tags?: number;
  respawns?: number;
  /** Server-earned cosmetic progression, portable through a signed progress token. */
  cosmeticXp?: number;
  connectionState?: "connected" | "disconnected";
  x?: number;
  y?: number;
  z?: number;
  facing?: number;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  gear: string;
  /** Authoritative weapon slot. `gear` remains the current weapon for legacy clients. */
  weapon?: string;
  /** Independently equipped non-weapon gear such as the vest and shoes. */
  perks?: string[];
  appearance?: PlayerAppearance;
  joinedAt: string;
}

export interface GameEvent {
  id: string;
  type: GameEventType;
  message: string;
  createdAt: string;
  playerId?: string;
  targetId?: string;
  team?: Team;
}

export interface GameAnnouncement {
  id: string;
  kind: GameAnnouncementKind;
  title: string;
  message: string;
  detail?: string;
  expiresAt?: string;
}

export interface RoundTransition {
  nextRound: number;
  startsAt: string;
  /** Optional for compatibility with sessions saved before phased round transitions were introduced. */
  phase?: RoundTransitionPhase;
}

export interface GameSession {
  id: string;
  teacherId: string;
  classId?: string;
  quizSetId: string;
  sessionCode: string;
  status: SessionStatus;
  maxPlayers: number;
  currentRound: number;
  settings: SessionSettings;
  players: PlayerSession[];
  roundWins?: Record<Team, number>;
  flag?: FlagState;
  events?: GameEvent[];
  announcement?: GameAnnouncement;
  roundTransition?: RoundTransition;
  createdAt: string;
  startedAt?: string;
  endsAt?: string;
  endedAt?: string;
  /** Server clock captured when this session snapshot was sent to a client. */
  serverTime?: string;
}

export interface AnswerLog {
  id: string;
  gameSessionId: string;
  playerSessionId: string;
  questionId: string;
  selectedChoice: Choice;
  isCorrect: boolean;
  moneyAwarded: number;
  answeredAt: string;
  responseTimeMs?: number;
  context?: "main" | "practice";
}

export interface QuizResult {
  isCorrect: boolean;
  correctChoice: Choice;
  moneyAwarded: number;
  feedback: string;
  explanation?: string;
  player: PlayerSession;
  nextQuestion?: PublicQuestion;
  respawned?: boolean;
  respawnProgress?: number;
  respawnRequired?: number;
}

export interface SessionReport {
  session: GameSession;
  rows: SessionReportRow[];
  missedQuestions: Array<{
    questionId: string;
    prompt: string;
    misses: number;
  }>;
}

export interface SessionReportRow {
  nickname: string;
  team: Team;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
  money: number;
  quizMoney: number;
  score: number;
}

export interface FlagState {
  state: FlagStateName;
  teamId: Team;
  position: ArenaPosition;
  carrierId?: string;
  placedById?: string;
  capturedById?: string;
  interactionPlayerId?: string;
  progressStartedAtMs?: number;
  placedAtMs?: number;
  expiresAtMs?: number;
}

export interface ScoreboardRow {
  playerId: string;
  displayName: string;
  teamId: Team;
  role?: PlayerRole;
  tags: number;
  respawns: number;
  questionsCorrect: number;
  questionsAttempted: number;
  questionAccuracy: string;
  connectionState: "connected" | "disconnected";
  isBot: boolean;
  isLocalPlayer: boolean;
}

export const FLAG_MODE_DEFAULTS = {
  roundCount: 10,
  roundDurationSeconds: 180,
  flagHoldSeconds: 30
} as const;

export const HEAVY_GUN_DAMAGE = 100;
export const HEAVY_GUN_COOLDOWN_MS = 1500;
export const HEAVY_GUN_RANGE = 120;
export const HEAVY_GUN_UNSCOPED_HIT_RADIUS = 0.52;
export const HEAVY_GUN_SCOPED_HIT_RADIUS = 0.82;
export const HEAVY_GUN_DEEP_SCOPED_HIT_RADIUS = 0.98;
export const HEAVY_GUN_ZOOM_LEVEL_0_FOV = 72;
export const HEAVY_GUN_ZOOM_LEVEL_1_FOV = 46;
export const HEAVY_GUN_ZOOM_LEVEL_2_FOV = 30;
export const FLAG_INTERACTION_RADIUS = 7;
export const QUICK_BLASTER_RANGE = 48;
export const QUICK_BLASTER_COOLDOWN_MS = 250;
export const STARTER_BLASTER_RANGE = 36;

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  mapId: "desert_citadel",
  gameMode: "flag",
  botDifficulty: "standard",
  roundCount: FLAG_MODE_DEFAULTS.roundCount,
  flagHoldSeconds: FLAG_MODE_DEFAULTS.flagHoldSeconds,
  teamAssignment: "players_choose",
  startingMoney: 0,
  startingSnowballs: 10,
  correctAnswerReward: 400,
  fastAnswerBonus: 100,
  fastAnswerThresholdMs: 7000,
  wrongAnswerPenalty: 0,
  snowballPackPrice: 500,
  snowballsPerPack: 10,
  roundDurationSeconds: FLAG_MODE_DEFAULTS.roundDurationSeconds,
  maxPlayers: 20,
  deadPlayersCanPractice: true,
  deadPlayersEarnMoney: false,
  characterCustomization: DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS
};

export const RESPAWN_CORRECT_ANSWERS_REQUIRED = 3;

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
};

const sanitizeGameMode = (value: unknown): GameMode =>
  value === "zombie" || value === "classic" || value === "flag" ? value : DEFAULT_SESSION_SETTINGS.gameMode;

const sanitizeArenaMap = (value: unknown): ArenaMapId =>
  value === "iron_junction" || value === "temple_runoff" ? value : DEFAULT_SESSION_SETTINGS.mapId;

const sanitizeTeamAssignment = (value: unknown): TeamAssignment =>
  value === "random" || value === "players_choose" ? value : DEFAULT_SESSION_SETTINGS.teamAssignment;

const sanitizeBotDifficulty = (value: unknown): BotDifficulty =>
  value === "beginner" || value === "advanced" || value === "standard" ? value : DEFAULT_SESSION_SETTINGS.botDifficulty;

export const sanitizeSessionSettings = (input: Partial<SessionSettings> = {}): SessionSettings => ({
  mapId: sanitizeArenaMap(input.mapId),
  gameMode: sanitizeGameMode(input.gameMode),
  botDifficulty: sanitizeBotDifficulty(input.botDifficulty),
  roundCount: clampNumber(input.roundCount, DEFAULT_SESSION_SETTINGS.roundCount, 1, 30),
  flagHoldSeconds: clampNumber(input.flagHoldSeconds, DEFAULT_SESSION_SETTINGS.flagHoldSeconds, 5, 180),
  teamAssignment: sanitizeTeamAssignment(input.teamAssignment),
  initialZombieCount:
    input.initialZombieCount === undefined
      ? undefined
      : clampNumber(input.initialZombieCount, DEFAULT_SESSION_SETTINGS.initialZombieCount ?? 0, 0, 20),
  startingMoney: clampNumber(input.startingMoney, DEFAULT_SESSION_SETTINGS.startingMoney, 0, 16000),
  startingSnowballs: clampNumber(input.startingSnowballs, DEFAULT_SESSION_SETTINGS.startingSnowballs, 1, 99),
  correctAnswerReward: clampNumber(input.correctAnswerReward, DEFAULT_SESSION_SETTINGS.correctAnswerReward, 0, 5000),
  fastAnswerBonus: clampNumber(input.fastAnswerBonus, DEFAULT_SESSION_SETTINGS.fastAnswerBonus, 0, 5000),
  fastAnswerThresholdMs: clampNumber(
    input.fastAnswerThresholdMs,
    DEFAULT_SESSION_SETTINGS.fastAnswerThresholdMs,
    1000,
    30000
  ),
  wrongAnswerPenalty: clampNumber(input.wrongAnswerPenalty, DEFAULT_SESSION_SETTINGS.wrongAnswerPenalty, 0, 16000),
  snowballPackPrice: clampNumber(input.snowballPackPrice, DEFAULT_SESSION_SETTINGS.snowballPackPrice, 0, 5000),
  snowballsPerPack: clampNumber(input.snowballsPerPack, DEFAULT_SESSION_SETTINGS.snowballsPerPack, 1, 50),
  roundDurationSeconds: clampNumber(input.roundDurationSeconds, DEFAULT_SESSION_SETTINGS.roundDurationSeconds, 60, 3600),
  maxPlayers: clampNumber(input.maxPlayers, DEFAULT_SESSION_SETTINGS.maxPlayers, 2, 40),
  deadPlayersCanPractice:
    typeof input.deadPlayersCanPractice === "boolean"
      ? input.deadPlayersCanPractice
      : DEFAULT_SESSION_SETTINGS.deadPlayersCanPractice,
  deadPlayersEarnMoney:
    typeof input.deadPlayersEarnMoney === "boolean"
      ? input.deadPlayersEarnMoney
      : DEFAULT_SESSION_SETTINGS.deadPlayersEarnMoney,
  characterCustomization: sanitizeCharacterCustomizationSettings(input.characterCustomization)
});

export interface AnswerRewardInput {
  player: Pick<PlayerSession, "money" | "isAlive">;
  settings: SessionSettings;
  isCorrect: boolean;
  responseTimeMs?: number;
}

export interface AnswerRewardResult {
  moneyAwarded: number;
  nextMoney: number;
  scoreDelta: number;
  correctDelta: number;
  wrongDelta: number;
}

export const resolveAnswerReward = ({
  player,
  settings,
  isCorrect,
  responseTimeMs
}: AnswerRewardInput): AnswerRewardResult => {
  const fastBonus =
    responseTimeMs !== undefined &&
    Number.isFinite(responseTimeMs) &&
    responseTimeMs <= settings.fastAnswerThresholdMs;
  const aliveRewardAllowed = player.isAlive || settings.deadPlayersEarnMoney;

  if (isCorrect && aliveRewardAllowed) {
    const moneyAwarded = settings.correctAnswerReward + (fastBonus ? settings.fastAnswerBonus : 0);
    return {
      moneyAwarded,
      nextMoney: Math.min(16000, player.money + moneyAwarded),
      scoreDelta: 10 + (fastBonus ? 2 : 0),
      correctDelta: 1,
      wrongDelta: 0
    };
  }

  if (isCorrect) {
    return {
      moneyAwarded: 0,
      nextMoney: player.money,
      scoreDelta: 0,
      correctDelta: 1,
      wrongDelta: 0
    };
  }

  return {
    moneyAwarded: 0,
    nextMoney: player.isAlive ? Math.max(0, player.money - settings.wrongAnswerPenalty) : player.money,
    scoreDelta: 0,
    correctDelta: 0,
    wrongDelta: 1
  };
};

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
};

export const buildCsvReport = (report: SessionReport) => {
  const rows = [
    ["Session Code", "Student", "Team", "Correct", "Wrong", "Accuracy %", "Wallet", "Quiz Rewards", "Score"],
    ...report.rows.map((row) => [
      report.session.sessionCode,
      row.nickname,
      row.team,
      row.correctAnswers,
      row.wrongAnswers,
      row.accuracy,
      row.money,
      row.quizMoney,
      row.score
    ]),
    [],
    ["Most Missed Question", "Misses"],
    ...report.missedQuestions.map((question) => [question.prompt, question.misses])
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
};

export const isValidPlayerToken = (expectedToken: string | undefined, providedToken: string | undefined) =>
  Boolean(expectedToken && providedToken && expectedToken === providedToken);

export type QuestionGateResult =
  | { ok: true; responseTimeMs: number }
  | { ok: false; reason: "question_not_active" };

export class PlayerQuestionGate {
  private readonly activeQuestions = new Map<string, { questionId: string; servedAtMs: number }>();

  issue(playerId: string, questionId: string, servedAtMs = Date.now()) {
    this.activeQuestions.set(playerId, { questionId, servedAtMs });
  }

  consume(playerId: string, questionId: string, answeredAtMs = Date.now()): QuestionGateResult {
    const active = this.activeQuestions.get(playerId);
    if (!active || active.questionId !== questionId) {
      return { ok: false, reason: "question_not_active" };
    }

    this.activeQuestions.delete(playerId);
    return { ok: true, responseTimeMs: Math.max(0, answeredAtMs - active.servedAtMs) };
  }

  clear(playerId: string) {
    this.activeQuestions.delete(playerId);
  }
}

export const GEAR_ITEMS: GearItem[] = [
  {
    id: "starter_blaster",
    name: "Starter Snowball Launcher",
    cost: 0,
    description: "Steady launcher for close snow tags.",
    damage: 15,
    range: STARTER_BLASTER_RANGE,
    fireCooldownMs: 160
  },
  {
    id: "quick_blaster",
    name: "Quick Snowball Launcher",
    cost: 3000,
    description: "Automatic launcher with a controlled fire rhythm.",
    damage: 22,
    range: QUICK_BLASTER_RANGE,
    fireCooldownMs: QUICK_BLASTER_COOLDOWN_MS,
    autoFire: true
  },
  {
    id: "power_blaster",
    name: "Heavy Snowball Launcher",
    cost: 6000,
    description: "High-focus launcher with a deliberate rhythm, long reach, and C-key or right-click scope.",
    damage: HEAVY_GUN_DAMAGE,
    range: HEAVY_GUN_RANGE,
    scopedHitRadius: HEAVY_GUN_SCOPED_HIT_RADIUS,
    deepScopedHitRadius: HEAVY_GUN_DEEP_SCOPED_HIT_RADIUS,
    unscopedHitRadius: HEAVY_GUN_UNSCOPED_HIT_RADIUS,
    fireCooldownMs: HEAVY_GUN_COOLDOWN_MS,
    zoomFovMultiplier: HEAVY_GUN_ZOOM_LEVEL_1_FOV / HEAVY_GUN_ZOOM_LEVEL_0_FOV
  },
  {
    id: "shield_vest",
    name: "Warm Vest",
    cost: 1000,
    description: "+50 warmth for the current round.",
    damage: 15,
    range: STARTER_BLASTER_RANGE,
    fireCooldownMs: 160,
    healthBonus: 50
  },
  {
    id: "speed_shoes",
    name: "Speed Boots",
    cost: 1500,
    description: "+15% walk, sprint, and crouch speed.",
    damage: 15,
    range: STARTER_BLASTER_RANGE,
    fireCooldownMs: 160,
    speedBonus: 0.15
  }
];

export const WEAPON_GEAR_IDS = ["starter_blaster", "quick_blaster", "power_blaster"] as const;
export const PERK_GEAR_IDS = ["shield_vest", "speed_shoes"] as const;

export const isWeaponGearId = (gearId: string): boolean => (WEAPON_GEAR_IDS as readonly string[]).includes(gearId);
export const isPerkGearId = (gearId: string): boolean => (PERK_GEAR_IDS as readonly string[]).includes(gearId);

export const isChoice = (value: unknown): value is Choice =>
  value === "A" || value === "B" || value === "C" || value === "D";

export const calculateAccuracy = (correct: number, wrong: number) => {
  const total = correct + wrong;
  return total === 0 ? 0 : Math.round((correct / total) * 100);
};

/** Weighted class accuracy across attempted questions; null means nobody has answered yet. */
export const calculateClassAccuracy = (rows: Pick<SessionReportRow, "correctAnswers" | "wrongAnswers">[]) => {
  const correct = rows.reduce((total, row) => total + row.correctAnswers, 0);
  const attempted = rows.reduce((total, row) => total + row.correctAnswers + row.wrongAnswers, 0);
  return attempted === 0 ? null : Math.round((correct / attempted) * 100);
};

export type StartRoundResult = { ok: true } | { ok: false; reason: "no_real_players" | "session_ended" };

export const canStartRound = (session: Pick<GameSession, "players" | "status">): StartRoundResult => {
  if (session.status === "ended") return { ok: false, reason: "session_ended" };
  if (!session.players.some((player) => !player.isBot)) return { ok: false, reason: "no_real_players" };
  return { ok: true };
};

export const isRoundActive = (session: Pick<GameSession, "status">) => session.status === "active";

export const isRoundBuyPhase = (
  session: Pick<GameSession, "status" | "settings" | "roundTransition">
) => session.status === "paused"
  && session.settings.gameMode === "flag"
  && session.roundTransition?.phase === "buy";

export const isMainRoundAnswer = (answer: Pick<AnswerLog, "context">) => answer.context !== "practice";

export const buildReportRows = ({
  players,
  answers
}: {
  players: PlayerSession[];
  answers: AnswerLog[];
}): SessionReportRow[] =>
  players
    .filter((player) => !player.isBot)
    .map((player) => {
      const playerAnswers = answers.filter((answer) => answer.playerSessionId === player.id && isMainRoundAnswer(answer));
      const correctAnswers = playerAnswers.filter((answer) => answer.isCorrect).length;
      const wrongAnswers = playerAnswers.filter((answer) => !answer.isCorrect).length;
      return {
        nickname: player.nickname,
        team: player.team,
        correctAnswers,
        wrongAnswers,
        accuracy: calculateAccuracy(correctAnswers, wrongAnswers),
        money: player.money,
        quizMoney: playerAnswers.reduce((total, answer) => total + answer.moneyAwarded, 0),
        score: player.score
      };
    });

export const getRoundRemainingSeconds = (
  session: Pick<GameSession, "status" | "settings" | "startedAt" | "endsAt">,
  at = new Date().toISOString()
) => {
  if (session.status !== "active") return session.settings.roundDurationSeconds;
  const explicitEnd = session.endsAt ? Date.parse(session.endsAt) : Number.NaN;
  const start = session.startedAt ? Date.parse(session.startedAt) : Number.NaN;
  const end = Number.isFinite(explicitEnd)
    ? explicitEnd
    : Number.isFinite(start)
      ? start + session.settings.roundDurationSeconds * 1000
      : Date.parse(at) + session.settings.roundDurationSeconds * 1000;
  const nowMs = Date.parse(at);
  return Math.min(
    session.settings.roundDurationSeconds,
    Math.max(0, Math.ceil((end - nowMs) / 1000))
  );
};

export const resolveTeamRoundWinner = (
  players: Array<Pick<PlayerSession, "team" | "score" | "tags">>
): Team | undefined => {
  const totals = players.reduce(
    (result, player) => {
      result[player.team].score += player.score;
      result[player.team].tags += player.tags ?? 0;
      return result;
    },
    { blue: { score: 0, tags: 0 }, red: { score: 0, tags: 0 } }
  );
  if (totals.blue.score !== totals.red.score) return totals.blue.score > totals.red.score ? "blue" : "red";
  if (totals.blue.tags !== totals.red.tags) return totals.blue.tags > totals.red.tags ? "blue" : "red";
  return undefined;
};

export const resolvePracticeRespawn = ({
  player,
  settings,
  isCorrect,
  required = RESPAWN_CORRECT_ANSWERS_REQUIRED
}: {
  player: PlayerSession;
  settings: SessionSettings;
  isCorrect: boolean;
  required?: number;
}) => {
  if (player.isAlive || !settings.deadPlayersCanPractice) {
    return { player, respawned: false, progress: player.respawnCorrectAnswers ?? 0, required };
  }

  const progress = Math.min(required, Math.max(0, player.respawnCorrectAnswers ?? 0) + (isCorrect ? 1 : 0));
  if (progress < required) {
    return { player: { ...player, respawnCorrectAnswers: progress }, respawned: false, progress, required };
  }

  const spawn = getTeamSpawn(player.team);
  return {
    player: {
      ...player,
      ...spawn,
      isAlive: true,
      health: DEFAULT_PLAYER_HEALTH,
      snowballs: settings.startingSnowballs,
      respawnCorrectAnswers: 0
    },
    respawned: true,
    progress: required,
    required
  };
};

export interface ArenaPosition {
  x: number;
  z: number;
  y?: number;
  facing?: number;
}

export type TagRejectReason =
  | "attacker_eliminated"
  | "target_eliminated"
  | "same_team"
  | "out_of_range";

export type TagActionResult =
  | {
      ok: true;
      damage: number;
      nextHealth: number;
      eliminated: boolean;
      moneyAwarded: number;
      scoreDelta: number;
    }
  | { ok: false; reason: TagRejectReason };

export const DEFAULT_PLAYER_HEALTH = 100;
export const TAG_OPPONENT_BONUS = 100;
export const TAG_SCORE_DELTA = 5;
export const TAG_RANGE = 18;
export const SNOWBALL_HIT_RADIUS = 1.25;
export const ZOMBIE_HUMAN_MAX_ENERGY = 1000;
export const ZOMBIE_HUMAN_CORRECT_ENERGY = 100;
export const ZOMBIE_HUMAN_SPRINT_DRAIN_PER_SECOND = 20;
export const ZOMBIE_HUMAN_WALK_MAX_SPEED = 13;

export const canPlayerFireInMode = (gameMode: GameMode, role: PlayerRole | undefined) =>
  gameMode !== "zombie" || role === "zombie";

export const awardZombieHumanEnergy = ({
  gameMode,
  role,
  isCorrect,
  currentEnergy
}: {
  gameMode: GameMode;
  role: PlayerRole | undefined;
  isCorrect: boolean;
  currentEnergy: number | undefined;
}) => {
  const safeEnergy = Math.min(ZOMBIE_HUMAN_MAX_ENERGY, Math.max(0, Number(currentEnergy) || 0));
  if (gameMode !== "zombie" || role === "zombie" || !isCorrect) return safeEnergy;
  return Math.min(ZOMBIE_HUMAN_MAX_ENERGY, safeEnergy + ZOMBIE_HUMAN_CORRECT_ENERGY);
};

export const resolveZombieSprintEnergy = ({
  gameMode,
  role,
  sprinting,
  currentEnergy,
  elapsedMs,
  movedDistance
}: {
  gameMode: GameMode;
  role: PlayerRole | undefined;
  sprinting: boolean;
  currentEnergy: number | undefined;
  elapsedMs: number;
  movedDistance: number;
}) => {
  const safeEnergy = Math.min(ZOMBIE_HUMAN_MAX_ENERGY, Math.max(0, Number(currentEnergy) || 0));
  if (gameMode !== "zombie" || role === "zombie") {
    return { canSprint: true, nextEnergy: safeEnergy };
  }
  const canSprint = sprinting && safeEnergy > 0;
  if (!canSprint || movedDistance <= 0.05) return { canSprint, nextEnergy: safeEnergy };
  const elapsedSeconds = Math.max(0, Math.min(1, elapsedMs / 1000));
  return {
    canSprint,
    nextEnergy: Math.max(0, safeEnergy - ZOMBIE_HUMAN_SPRINT_DRAIN_PER_SECOND * elapsedSeconds)
  };
};
export const ARENA_SCALE = 0.62;
const scaleArenaValue = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleArenaPosition = <T extends { x: number; z: number }>(position: T): T =>
  ({ ...position, x: scaleArenaValue(position.x), z: scaleArenaValue(position.z) }) as T;
const scaleArenaRadius = <T extends { x: number; z: number; radius: number }>(position: T): T =>
  ({ ...scaleArenaPosition(position), radius: scaleArenaValue(position.radius) }) as T;

export const ARENA_LIMIT_X = scaleArenaValue(175);
export const ARENA_LIMIT_Z = scaleArenaValue(160);

export const ARENA_PLAYER_EYE_HEIGHT = 4.21;
export const ARENA_PLAYER_BODY_HEIGHT = 5.02;
export const TEMPLE_RUNOFF_MAIN_LEVEL_Y = 8;
export const TEMPLE_RUNOFF_UPPER_LEVEL_Y = 17;
export const IRON_JUNCTION_LOADING_LEVEL_Y = 8;
export const IRON_JUNCTION_OVERPASS_LEVEL_Y = 18;
// Compatibility aliases for older clients and saved diagnostics.
export const IRON_JUNCTION_HIGHLINE_LEVEL_Y = IRON_JUNCTION_LOADING_LEVEL_Y;
export const IRON_JUNCTION_CATWALK_LEVEL_Y = IRON_JUNCTION_OVERPASS_LEVEL_Y;
export const DESERT_CITADEL_ROOFTOP_LEVEL_Y = 6;
export const DESERT_CITADEL_CITADEL_LEVEL_Y = 12;

export type ArenaBounds = { limitX: number; limitZ: number };
export const TEMPLE_RUNOFF_BOUNDS: ArenaBounds = {
  limitX: scaleArenaValue(235),
  limitZ: scaleArenaValue(200)
};
export const IRON_JUNCTION_BOUNDS: ArenaBounds = {
  limitX: scaleArenaValue(280),
  limitZ: scaleArenaValue(250)
};

export const getArenaBounds = (mapId: ArenaMapId | string | undefined): ArenaBounds =>
  mapId === "temple_runoff"
    ? TEMPLE_RUNOFF_BOUNDS
    : mapId === "iron_junction"
      ? IRON_JUNCTION_BOUNDS
    : { limitX: ARENA_LIMIT_X, limitZ: ARENA_LIMIT_Z };

const isInsideRawRect = (
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
) => x >= minX - 1e-6 && x <= maxX + 1e-6 && z >= minZ - 1e-6 && z <= maxZ + 1e-6;

const templeRampHeight = (rawX: number, rawZ: number): number | undefined => {
  for (const centerX of [-136, -52, 55, 136]) {
    if (Math.abs(rawX - centerX) > 14) continue;
    if (rawZ >= -48 - 1e-6 && rawZ <= -24 + 1e-6) {
      const progress = Math.max(0, Math.min(1, (-24 - rawZ) / 24));
      return Number((TEMPLE_RUNOFF_MAIN_LEVEL_Y * progress).toFixed(3));
    }
    if (rawZ >= 24 - 1e-6 && rawZ <= 48 + 1e-6) {
      const progress = Math.max(0, Math.min(1, (rawZ - 24) / 24));
      return Number((TEMPLE_RUNOFF_MAIN_LEVEL_Y * progress).toFixed(3));
    }
  }
  if (Math.abs(rawX) <= 18 && rawZ >= -82 && rawZ < -58) {
    return Number((TEMPLE_RUNOFF_MAIN_LEVEL_Y + 9 * ((rawZ + 82) / 24)).toFixed(3));
  }
  if (Math.abs(rawX) <= 18 && rawZ > 58 && rawZ <= 82) {
    return Number((TEMPLE_RUNOFF_MAIN_LEVEL_Y + 9 * ((82 - rawZ) / 24)).toFixed(3));
  }
  if (rawX >= -148 && rawX < -118 && rawZ >= -80 && rawZ <= -52) {
    return Number((TEMPLE_RUNOFF_MAIN_LEVEL_Y + 9 * ((rawX + 148) / 30)).toFixed(3));
  }
  if (rawX > 118 && rawX <= 148 && rawZ >= 52 && rawZ <= 80) {
    return Number((TEMPLE_RUNOFF_MAIN_LEVEL_Y + 9 * ((148 - rawX) / 30)).toFixed(3));
  }
  return undefined;
};

const ironRampHeight = (rawX: number, rawZ: number): number | undefined => {
  if (rawZ >= -66 - 1e-6 && rawZ <= -48 + 1e-6 && rawX >= -218 && rawX <= -180) {
    return Number((IRON_JUNCTION_LOADING_LEVEL_Y * ((rawX + 218) / 38)).toFixed(3));
  }
  if (rawZ >= -82 - 1e-6 && rawZ <= -58 + 1e-6 && rawX >= 190 && rawX <= 220) {
    return Number((IRON_JUNCTION_LOADING_LEVEL_Y * ((220 - rawX) / 30)).toFixed(3));
  }
  if (rawZ >= 96 - 1e-6 && rawZ <= 116 + 1e-6 && rawX >= 163 && rawX <= 191) {
    return Number((IRON_JUNCTION_LOADING_LEVEL_Y * ((191 - rawX) / 28)).toFixed(3));
  }
  if (rawZ >= 15 && rawZ <= 35 && rawX >= -50 && rawX <= -20) {
    return Number((IRON_JUNCTION_LOADING_LEVEL_Y * ((rawX + 50) / 30)).toFixed(3));
  }
  if (rawX >= -115 && rawX <= -95 && rawZ >= -116 && rawZ <= -86) {
    return Number((IRON_JUNCTION_LOADING_LEVEL_Y + 10 * ((rawZ + 116) / 30)).toFixed(3));
  }
  if (rawX >= 70 && rawX <= 90 && rawZ >= 35 && rawZ <= 95) {
    return Number((IRON_JUNCTION_OVERPASS_LEVEL_Y - 10 * ((rawZ - 35) / 60)).toFixed(3));
  }
  if (rawZ >= 15 && rawZ <= 35 && rawX >= 125 && rawX <= 175) {
    return Number((IRON_JUNCTION_OVERPASS_LEVEL_Y * ((175 - rawX) / 50)).toFixed(3));
  }
  return undefined;
};

const desertRampHeight = (rawX: number, rawZ: number): number | undefined => {
  if (rawZ >= 62 - 1e-6 && rawZ <= 70 + 1e-6) {
    if (rawX >= -112 - 1e-6 && rawX <= -91 + 1e-6) {
      return Number((DESERT_CITADEL_ROOFTOP_LEVEL_Y * Math.max(0, Math.min(1, (rawX + 112) / 21))).toFixed(3));
    }
    if (rawX >= 91 - 1e-6 && rawX <= 112 + 1e-6) {
      return Number((DESERT_CITADEL_ROOFTOP_LEVEL_Y * Math.max(0, Math.min(1, (112 - rawX) / 21))).toFixed(3));
    }
  }
  if (Math.abs(rawX) <= 24 && rawZ >= 54 - 1e-6 && rawZ <= 70 + 1e-6) {
    return Number((DESERT_CITADEL_CITADEL_LEVEL_Y * Math.max(0, Math.min(1, (rawZ - 54) / 16))).toFixed(3));
  }
  return undefined;
};

/**
 * Returns every legitimate walkable surface at an X/Z coordinate, low to high.
 * Temple Runoff deliberately supports stacked surfaces at the same coordinate.
 */
export const getArenaFloorSurfaces = (
  mapId: ArenaMapId | string | undefined,
  x: number,
  z: number
): number[] => {
  if (mapId !== "temple_runoff" && mapId !== "iron_junction" && mapId !== "desert_citadel") return [0];
  const rawX = x / ARENA_SCALE;
  const rawZ = z / ARENA_SCALE;
  if (mapId === "iron_junction") {
    const ramp = ironRampHeight(rawX, rawZ);
    const surfaces = [0];
    if (
      isInsideRawRect(rawX, rawZ, -190, -70, -179, -115)
      || isInsideRawRect(rawX, rawZ, -180, -36, -66, -48)
      || isInsideRawRect(rawX, rawZ, 74, 190, -82, -58)
      || isInsideRawRect(rawX, rawZ, 23, 165, 96, 116)
      || isInsideRawRect(rawX, rawZ, -20, 40, 15, 35)
    ) surfaces.push(IRON_JUNCTION_LOADING_LEVEL_Y);
    if (
      isInsideRawRect(rawX, rawZ, -105, 125, 15, 35)
      || isInsideRawRect(rawX, rawZ, -71, 71, -21, -7)
      || isInsideRawRect(rawX, rawZ, -115, -95, -86, 15)
      || isInsideRawRect(rawX, rawZ, 109, 129, -62, 15)
    ) surfaces.push(IRON_JUNCTION_OVERPASS_LEVEL_Y);
    if (ramp !== undefined) surfaces.push(ramp);
    return [...new Set(surfaces)].sort((a, b) => a - b);
  }
  if (mapId === "desert_citadel") {
    const ramp = desertRampHeight(rawX, rawZ);
    if (ramp !== undefined) return [ramp];
    const surfaces = [0];
    if (isInsideRawRect(rawX, rawZ, -91, -19, 62, 70) || isInsideRawRect(rawX, rawZ, 19, 91, 62, 70)) {
      surfaces.push(DESERT_CITADEL_ROOFTOP_LEVEL_Y);
    }
    if (isInsideRawRect(rawX, rawZ, -24, 24, 70, 86)) surfaces.push(DESERT_CITADEL_CITADEL_LEVEL_Y);
    return [...new Set(surfaces)].sort((a, b) => a - b);
  }
  const ramp = templeRampHeight(rawX, rawZ);
  if (ramp !== undefined) return [ramp];

  const inRiver = isInsideRawRect(rawX, rawZ, -202, 202, -24, 24);
  const surfaces = [inRiver ? 0 : TEMPLE_RUNOFF_MAIN_LEVEL_Y];
  const onCentralBridge = isInsideRawRect(rawX, rawZ, -18, 18, -58, 58);
  const onNorthTerrace = isInsideRawRect(rawX, rawZ, -118, -18, -80, -52);
  const onSouthTerrace = isInsideRawRect(rawX, rawZ, 18, 118, 52, 80);
  const onTimberCrossing = isInsideRawRect(rawX, rawZ, 116, 136, -24, 24);
  if (onTimberCrossing) surfaces.push(TEMPLE_RUNOFF_MAIN_LEVEL_Y);
  if (onCentralBridge || onNorthTerrace || onSouthTerrace) surfaces.push(TEMPLE_RUNOFF_UPPER_LEVEL_Y);
  return [...new Set(surfaces)].sort((a, b) => a - b);
};

/**
 * Returns the walkable floor elevation at an arena position.
 * Temple Runoff has a lower river floor, two north ramps, two south ramps,
 * and a raised monument/courtyard tier everywhere else.
 */
export const getArenaGroundHeight = (
  mapId: ArenaMapId | string | undefined,
  x: number,
  z: number
): number => {
  const surfaces = getArenaFloorSurfaces(mapId, x, z);
  return surfaces[surfaces.length - 1] ?? 0;
};

export const getArenaGroundHeightForPlayer = (
  mapId: ArenaMapId | string | undefined,
  x: number,
  z: number,
  eyeY: number | undefined,
  eyeHeight = ARENA_PLAYER_EYE_HEIGHT,
  maxStepUp = 1
): number => {
  const surfaces = getArenaFloorSurfaces(mapId, x, z);
  if (!Number.isFinite(eyeY)) return surfaces[surfaces.length - 1] ?? 0;
  const footY = Number(eyeY) - eyeHeight;
  const reachable = surfaces.filter((surface) => surface <= footY + maxStepUp);
  return reachable[reachable.length - 1] ?? surfaces[0] ?? 0;
};

export const getArenaLevelLabel = (
  mapId: ArenaMapId | string | undefined,
  groundY: number
) => {
  if (mapId === "temple_runoff") {
    return groundY < TEMPLE_RUNOFF_MAIN_LEVEL_Y - 1
      ? "lower"
      : groundY < TEMPLE_RUNOFF_UPPER_LEVEL_Y - 1 ? "main" : "upper";
  }
  if (mapId === "iron_junction") {
    return groundY >= IRON_JUNCTION_OVERPASS_LEVEL_Y - 1
      ? "overpass"
      : groundY >= IRON_JUNCTION_LOADING_LEVEL_Y - 1 ? "loading" : "ground";
  }
  if (mapId === "desert_citadel") {
    return groundY >= DESERT_CITADEL_CITADEL_LEVEL_Y - 1 ? "citadel" : groundY >= DESERT_CITADEL_ROOFTOP_LEVEL_Y - 1 ? "rooftop" : "street";
  }
  return "main";
};

export const getArenaEyeHeight = (
  mapId: ArenaMapId | string | undefined,
  x: number,
  z: number
) => getArenaGroundHeight(mapId, x, z) + ARENA_PLAYER_EYE_HEIGHT;

export type GroundArenaPosition = Required<Pick<ArenaPosition, "x" | "z" | "facing">> & Pick<ArenaPosition, "y">;

export type SpawnPoint = GroundArenaPosition & {
  id: string;
  label: string;
};

const RAW_TEAM_SPAWNS: Record<Team, SpawnPoint[]> = {
  blue: [
    { id: "west-fortress-a1", label: "West Fortress Courtyard", x: -158, z: -36, facing: -Math.PI / 2 },
    { id: "west-fortress-a2", label: "West Fortress Courtyard", x: -149, z: -36, facing: -Math.PI / 2 },
    { id: "west-fortress-a3", label: "West Fortress Courtyard", x: -140, z: -36, facing: -Math.PI / 2 },
    { id: "west-fortress-a4", label: "West Fortress Courtyard", x: -131, z: -36, facing: -Math.PI / 2 },
    { id: "west-fortress-b1", label: "Armoury Court", x: -158, z: -22, facing: -Math.PI / 2 },
    { id: "west-fortress-b2", label: "Armoury Court", x: -149, z: -22, facing: -Math.PI / 2 },
    { id: "west-fortress-b3", label: "Armoury Court", x: -140, z: -22, facing: -Math.PI / 2 },
    { id: "west-fortress-b4", label: "Armoury Court", x: -131, z: -22, facing: -Math.PI / 2 },
    { id: "west-fortress-c1", label: "West Watch Wall", x: -158, z: -8, facing: -Math.PI / 2 },
    { id: "west-fortress-c2", label: "West Watch Wall", x: -149, z: -8, facing: -Math.PI / 2 },
    { id: "west-fortress-c3", label: "West Watch Wall", x: -140, z: -8, facing: -Math.PI / 2 },
    { id: "west-fortress-c4", label: "West Watch Wall", x: -131, z: -8, facing: -Math.PI / 2 },
    { id: "west-fortress-d1", label: "West Gate Yard", x: -158, z: 8, facing: -Math.PI / 2 },
    { id: "west-fortress-d2", label: "West Gate Yard", x: -149, z: 8, facing: -Math.PI / 2 },
    { id: "west-fortress-d3", label: "West Gate Yard", x: -140, z: 8, facing: -Math.PI / 2 },
    { id: "west-fortress-d4", label: "West Gate Yard", x: -131, z: 8, facing: -Math.PI / 2 },
    { id: "west-fortress-e1", label: "Hidden Tunnel Exit", x: -158, z: 22, facing: -Math.PI / 2 },
    { id: "west-fortress-e2", label: "Hidden Tunnel Exit", x: -149, z: 22, facing: -Math.PI / 2 },
    { id: "west-fortress-e3", label: "Hidden Tunnel Exit", x: -140, z: 22, facing: -Math.PI / 2 },
    { id: "west-fortress-e4", label: "Hidden Tunnel Exit", x: -131, z: 22, facing: -Math.PI / 2 },
    { id: "west-fortress-f1", label: "Upper Wall Stairs", x: -158, z: 36, facing: -Math.PI / 2 },
    { id: "west-fortress-f2", label: "Upper Wall Stairs", x: -149, z: 36, facing: -Math.PI / 2 },
    { id: "west-fortress-f3", label: "Upper Wall Stairs", x: -140, z: 36, facing: -Math.PI / 2 },
    { id: "west-fortress-f4", label: "Upper Wall Stairs", x: -131, z: 36, facing: -Math.PI / 2 }
  ],
  red: [
    { id: "east-camp-a1", label: "East Camp Courtyard", x: 158, z: -36, facing: Math.PI / 2 },
    { id: "east-camp-a2", label: "East Camp Courtyard", x: 149, z: -36, facing: Math.PI / 2 },
    { id: "east-camp-a3", label: "East Camp Courtyard", x: 140, z: -36, facing: Math.PI / 2 },
    { id: "east-camp-a4", label: "East Camp Courtyard", x: 131, z: -36, facing: Math.PI / 2 },
    { id: "east-camp-b1", label: "Stable Row", x: 158, z: -22, facing: Math.PI / 2 },
    { id: "east-camp-b2", label: "Stable Row", x: 149, z: -22, facing: Math.PI / 2 },
    { id: "east-camp-b3", label: "Stable Row", x: 140, z: -22, facing: Math.PI / 2 },
    { id: "east-camp-b4", label: "Stable Row", x: 131, z: -22, facing: Math.PI / 2 },
    { id: "east-camp-c1", label: "Eastern Wooden Gate", x: 158, z: -8, facing: Math.PI / 2 },
    { id: "east-camp-c2", label: "Eastern Wooden Gate", x: 149, z: -8, facing: Math.PI / 2 },
    { id: "east-camp-c3", label: "Eastern Wooden Gate", x: 140, z: -8, facing: Math.PI / 2 },
    { id: "east-camp-c4", label: "Eastern Wooden Gate", x: 131, z: -8, facing: Math.PI / 2 },
    { id: "east-camp-d1", label: "Supply Court", x: 158, z: 8, facing: Math.PI / 2 },
    { id: "east-camp-d2", label: "Supply Court", x: 149, z: 8, facing: Math.PI / 2 },
    { id: "east-camp-d3", label: "Supply Court", x: 140, z: 8, facing: Math.PI / 2 },
    { id: "east-camp-d4", label: "Supply Court", x: 131, z: 8, facing: Math.PI / 2 },
    { id: "east-camp-e1", label: "Caravan Yard", x: 158, z: 22, facing: Math.PI / 2 },
    { id: "east-camp-e2", label: "Caravan Yard", x: 149, z: 22, facing: Math.PI / 2 },
    { id: "east-camp-e3", label: "Caravan Yard", x: 140, z: 22, facing: Math.PI / 2 },
    { id: "east-camp-e4", label: "Caravan Yard", x: 131, z: 22, facing: Math.PI / 2 },
    { id: "east-camp-f1", label: "Canopy Exit", x: 158, z: 36, facing: Math.PI / 2 },
    { id: "east-camp-f2", label: "Canopy Exit", x: 149, z: 36, facing: Math.PI / 2 },
    { id: "east-camp-f3", label: "Canopy Exit", x: 140, z: 36, facing: Math.PI / 2 },
    { id: "east-camp-f4", label: "Canopy Exit", x: 138, z: 36, facing: Math.PI / 2 }
  ]
};

export const TEAM_SPAWNS: Record<Team, SpawnPoint[]> = {
  blue: RAW_TEAM_SPAWNS.blue.map(scaleArenaPosition),
  red: RAW_TEAM_SPAWNS.red.map(scaleArenaPosition)
};

const RAW_IRON_JUNCTION_BLUE_SPAWNS: SpawnPoint[] = [
  [-260, -72], [-252, -72], [-244, -72], [-236, -72], [-228, -72],
  [-260, -24], [-252, -24], [-244, -24], [-236, -24], [-228, -24],
  [-260, 24], [-252, 24], [-244, 24], [-236, 24], [-228, 24],
  [-260, 72], [-252, 72], [-244, 72], [-236, 72], [-228, 72]
].map(([x, z], index) => ({
  id: `blue-iron-${index + 1}`,
  label: ["Warehouse Gate", "Rail Gate", "Depot Gate", "Tunnel Gate"][Math.floor(index / 5)],
  x,
  z,
  facing: -Math.PI / 2
}));

export const IRON_JUNCTION_TEAM_SPAWNS: Record<Team, SpawnPoint[]> = {
  blue: RAW_IRON_JUNCTION_BLUE_SPAWNS.map(scaleArenaPosition).map((spawn) => ({
    ...spawn,
    y: ARENA_PLAYER_EYE_HEIGHT
  })),
  red: RAW_IRON_JUNCTION_BLUE_SPAWNS.map((spawn, index) => scaleArenaPosition({
    ...spawn,
    id: `red-iron-${index + 1}`,
    label: spawn.label.replace("Gate", "Approach"),
    x: -spawn.x,
    facing: Math.PI / 2
  })).map((spawn) => ({
    ...spawn,
    y: ARENA_PLAYER_EYE_HEIGHT
  }))
};

const RAW_TEMPLE_RUNOFF_BLUE_SPAWNS: SpawnPoint[] = [
  [-218, -154], [-210, -154], [-202, -154], [-194, -154], [-186, -154],
  [-218, -52], [-210, -52], [-202, -52], [-194, -52], [-186, -52],
  [-218, 48], [-210, 48], [-202, 48], [-194, 48], [-186, 48],
  [-218, 154], [-210, 154], [-202, 154], [-194, 154], [-186, 154]
].map(([x, z], index) => ({
  id: `blue-temple-${index + 1}`,
  label: ["Jungle Gate", "Canal Gate", "Rain Gate", "Temple Gate"][Math.floor(index / 5)],
  x,
  z,
  facing: -Math.PI / 2
}));

export const TEMPLE_RUNOFF_TEAM_SPAWNS: Record<Team, SpawnPoint[]> = {
  blue: RAW_TEMPLE_RUNOFF_BLUE_SPAWNS.map(scaleArenaPosition).map((spawn) => ({
    ...spawn,
    y: getArenaEyeHeight("temple_runoff", spawn.x, spawn.z)
  })),
  red: RAW_TEMPLE_RUNOFF_BLUE_SPAWNS.map((spawn, index) => scaleArenaPosition({
    ...spawn,
    id: `red-temple-${index + 1}`,
    label: spawn.label.replace("Gate", "Approach"),
    x: -spawn.x,
    facing: Math.PI / 2
  })).map((spawn) => ({
    ...spawn,
    y: getArenaEyeHeight("temple_runoff", spawn.x, spawn.z)
  }))
};

const TEAM_SPAWNS_BY_MAP: Record<ArenaMapId, Record<Team, SpawnPoint[]>> = {
  desert_citadel: TEAM_SPAWNS,
  iron_junction: IRON_JUNCTION_TEAM_SPAWNS,
  temple_runoff: TEMPLE_RUNOFF_TEAM_SPAWNS
};

export const getTeamSpawnsForMap = (mapId: ArenaMapId | string | undefined) =>
  TEAM_SPAWNS_BY_MAP[mapId === "iron_junction" || mapId === "temple_runoff" ? mapId : "desert_citadel"];

const teamSpawnsForMap = getTeamSpawnsForMap;

const RAW_FREE_FOR_ALL_SPAWNS: SpawnPoint[] = [
  { id: "ffa-west-outer-1", label: "West Outer Wall", x: -146, z: -78, facing: -0.9 },
  { id: "ffa-west-outer-2", label: "West Outer Wall", x: -146, z: 78, facing: -2.25 },
  { id: "ffa-west-gate-1", label: "West Gate", x: -116, z: -48, facing: -1.3 },
  { id: "ffa-west-gate-2", label: "West Gate", x: -116, z: 48, facing: -1.85 },
  { id: "ffa-west-wall-1", label: "West Wall Walk", x: -118, z: -4, facing: -1.57 },
  { id: "ffa-west-wall-2", label: "West Wall Walk", x: -126, z: 23, facing: -1.57 },
  { id: "ffa-fort-court-1", label: "Armoury Court", x: -138, z: -22, facing: -1.4 },
  { id: "ffa-fort-court-2", label: "Armoury Court", x: -139, z: 20, facing: -1.7 },
  { id: "ffa-fort-tunnel-1", label: "West Tunnel Exit", x: -106, z: 74, facing: -2.4 },
  { id: "ffa-fort-tower-1", label: "Western Watchtower", x: -96, z: -82, facing: -0.7 },
  { id: "ffa-north-ruins-1", label: "North Ruins", x: -84, z: -128, facing: -0.6 },
  { id: "ffa-north-ruins-2", label: "North Ruins", x: -48, z: -136, facing: -0.25 },
  { id: "ffa-north-ruins-3", label: "Dry Riverbed", x: -12, z: -124, facing: 0.15 },
  { id: "ffa-north-ruins-4", label: "Dry Riverbed", x: 28, z: -136, facing: 0.35 },
  { id: "ffa-north-ruins-5", label: "Broken Bridge", x: 64, z: -124, facing: 0.62 },
  { id: "ffa-north-ruins-6", label: "Ruined Watchtower", x: 112, z: -100, facing: 0.9 },
  { id: "ffa-market-1", label: "Central Market", x: -42, z: -42, facing: -0.6 },
  { id: "ffa-market-2", label: "Central Market", x: -12, z: -70, facing: -0.2 },
  { id: "ffa-market-3", label: "Old Well", x: 18, z: -48, facing: 0.2 },
  { id: "ffa-market-4", label: "Blue Canopy", x: 46, z: -38, facing: 0.58 },
  { id: "ffa-market-5", label: "Market Stalls", x: -58, z: -8, facing: -1.15 },
  { id: "ffa-market-6", label: "Market Stalls", x: -16, z: -20, facing: -0.4 },
  { id: "ffa-market-7", label: "Market Stalls", x: 16, z: -20, facing: 0.4 },
  { id: "ffa-market-8", label: "Market Stalls", x: 50, z: -8, facing: 1.15 },
  { id: "ffa-market-9", label: "Central Market", x: -38, z: 26, facing: -1.85 },
  { id: "ffa-market-10", label: "Old Well", x: -4, z: 30, facing: Math.PI },
  { id: "ffa-market-11", label: "Market Arch", x: 28, z: 42, facing: 2.6 },
  { id: "ffa-market-12", label: "Citadel Steps", x: 62, z: 28, facing: 2.2 },
  { id: "ffa-south-homes-1", label: "South Homes", x: -82, z: 82, facing: -2.4 },
  { id: "ffa-south-homes-2", label: "South Homes", x: -52, z: 100, facing: -2.8 },
  { id: "ffa-south-homes-3", label: "South Courtyard", x: -16, z: 116, facing: Math.PI },
  { id: "ffa-south-homes-4", label: "South Courtyard", x: 18, z: 104, facing: 2.8 },
  { id: "ffa-south-homes-5", label: "South Homes", x: 52, z: 116, facing: 2.4 },
  { id: "ffa-south-homes-6", label: "South Homes", x: 104, z: 118, facing: 2.2 },
  { id: "ffa-rooftop-1", label: "Rooftop Walk", x: -66, z: 66, facing: -2.15 },
  { id: "ffa-rooftop-2", label: "Rooftop Walk", x: -26, z: 70, facing: -2.9 },
  { id: "ffa-rooftop-3", label: "Rooftop Walk", x: 20, z: 70, facing: 2.9 },
  { id: "ffa-rooftop-4", label: "Rooftop Walk", x: 64, z: 66, facing: 2.15 },
  { id: "ffa-aqueduct-1", label: "Aqueduct West", x: -104, z: 0, facing: -1.57 },
  { id: "ffa-aqueduct-2", label: "Aqueduct West", x: -72, z: 0, facing: -1.57 },
  { id: "ffa-aqueduct-3", label: "Water Chamber", x: -36, z: 0, facing: -1.57 },
  { id: "ffa-aqueduct-4", label: "Water Chamber", x: 0, z: 0, facing: 0 },
  { id: "ffa-aqueduct-5", label: "Water Chamber", x: 36, z: 0, facing: 1.57 },
  { id: "ffa-aqueduct-6", label: "Aqueduct East", x: 72, z: 0, facing: 1.57 },
  { id: "ffa-aqueduct-7", label: "Aqueduct East", x: 104, z: 0, facing: 1.57 },
  { id: "ffa-east-gate-1", label: "Eastern Gate", x: 116, z: -48, facing: 1.3 },
  { id: "ffa-east-gate-2", label: "Eastern Gate", x: 116, z: 48, facing: 1.85 },
  { id: "ffa-east-wall-1", label: "Eastern Wall", x: 128, z: -4, facing: 1.57 },
  { id: "ffa-east-wall-2", label: "Eastern Wall", x: 126, z: 23, facing: 1.57 },
  { id: "ffa-camp-court-1", label: "Caravan Camp", x: 138, z: -22, facing: 1.4 },
  { id: "ffa-camp-court-2", label: "Caravan Camp", x: 139, z: 20, facing: 1.7 },
  { id: "ffa-east-tunnel-1", label: "East Tunnel Exit", x: 106, z: 74, facing: 2.4 },
  { id: "ffa-east-camp-outer-1", label: "East Camp Outer", x: 146, z: -78, facing: 0.9 },
  { id: "ffa-east-camp-outer-2", label: "East Camp Outer", x: 146, z: 78, facing: 2.25 },
  { id: "ffa-citadel-1", label: "Citadel Tower", x: -18, z: 54, facing: -2.6 },
  { id: "ffa-citadel-2", label: "Citadel Tower", x: 18, z: 54, facing: 2.6 },
  { id: "ffa-statue-1", label: "Buried Statue", x: -92, z: 126, facing: -2.25 },
  { id: "ffa-bridge-1", label: "Broken Bridge", x: 94, z: -128, facing: 0.75 },
  { id: "ffa-north-alley-1", label: "North Alley", x: -104, z: -44, facing: -1.05 },
  { id: "ffa-north-alley-2", label: "North Alley", x: 104, z: -44, facing: 1.05 }
];

export const FREE_FOR_ALL_SPAWNS: SpawnPoint[] = RAW_FREE_FOR_ALL_SPAWNS.map(scaleArenaPosition);

const RAW_CAPTURE_ZONES = [
  { id: "western-watchtower", label: "Western Watchtower", x: -118, z: -82, radius: 17 },
  { id: "central-market", label: "Central Market", x: 0, z: -10, radius: 24 },
  { id: "northern-ruins", label: "Northern Ruins", x: 0, z: -124, radius: 26 },
  { id: "southern-courtyard", label: "Southern Courtyard", x: 0, z: 112, radius: 22 },
  { id: "eastern-gate", label: "Eastern Gate", x: 122, z: -8, radius: 18 }
] as const;

export const CAPTURE_ZONES = RAW_CAPTURE_ZONES.map(scaleArenaRadius);
export const TEMPLE_RUNOFF_CAPTURE_ZONES = [
  { id: "jungle-ruins", label: "Jungle Ruins", x: scaleArenaValue(-112), z: scaleArenaValue(-132), radius: scaleArenaValue(22), y: TEMPLE_RUNOFF_MAIN_LEVEL_Y },
  { id: "lower-waterway", label: "Lower Waterway", x: scaleArenaValue(-72), z: 0, radius: scaleArenaValue(24), y: 0 },
  { id: "sun-bridge", label: "Sun Bridge", x: 0, z: scaleArenaValue(-18), radius: scaleArenaValue(18), y: TEMPLE_RUNOFF_UPPER_LEVEL_Y },
  { id: "rain-court", label: "Rain Court", x: 0, z: scaleArenaValue(126), radius: scaleArenaValue(25), y: TEMPLE_RUNOFF_MAIN_LEVEL_Y },
  { id: "temple-terrace", label: "Temple Terrace", x: scaleArenaValue(84), z: scaleArenaValue(66), radius: scaleArenaValue(18), y: TEMPLE_RUNOFF_UPPER_LEVEL_Y }
] as const;

export const IRON_JUNCTION_CAPTURE_ZONES = [
  { id: "iron-grand-junction", label: "Grand Rail Junction", x: scaleArenaValue(38), z: scaleArenaValue(64), radius: scaleArenaValue(25), y: 0 },
  { id: "iron-warehouse-loading", label: "Warehouse Loading Dock", x: scaleArenaValue(-108), z: scaleArenaValue(-57), radius: scaleArenaValue(20), y: IRON_JUNCTION_LOADING_LEVEL_Y },
  { id: "iron-maintenance-pit", label: "Maintenance Pit", x: scaleArenaValue(104), z: scaleArenaValue(151), radius: scaleArenaValue(22), y: 0 },
  { id: "iron-control-overpass", label: "Junction Overpass", x: scaleArenaValue(24), z: scaleArenaValue(25), radius: scaleArenaValue(18), y: IRON_JUNCTION_OVERPASS_LEVEL_Y },
  { id: "iron-mountain-tunnel", label: "Mountain Service Tunnel", x: scaleArenaValue(-35), z: scaleArenaValue(218), radius: scaleArenaValue(22), y: 0 }
] as const;

export const DESERT_CITADEL_CAPTURE_ZONES = [
  { id: "desert-market", label: "Central Market", x: 0, z: scaleArenaValue(-10), radius: scaleArenaValue(24), y: 0 },
  { id: "desert-waterworks", label: "Central Waterworks", x: 0, z: 0, radius: scaleArenaValue(20), y: 0 },
  { id: "desert-rooftop", label: "Service Arcades", x: 0, z: scaleArenaValue(66), radius: scaleArenaValue(24), y: DESERT_CITADEL_ROOFTOP_LEVEL_Y },
  { id: "desert-cistern-crown", label: "Cistern Crown", x: 0, z: scaleArenaValue(78), radius: scaleArenaValue(14), y: DESERT_CITADEL_CITADEL_LEVEL_Y },
  { id: "desert-ramparts", label: "North Ramparts", x: 0, z: scaleArenaValue(-124), radius: scaleArenaValue(22), y: 0 }
] as const;

export const getCaptureZonesForMap = (mapId: ArenaMapId | string | undefined) =>
  mapId === "temple_runoff"
    ? TEMPLE_RUNOFF_CAPTURE_ZONES
    : mapId === "iron_junction"
      ? IRON_JUNCTION_CAPTURE_ZONES
      : mapId === "desert_citadel"
        ? DESERT_CITADEL_CAPTURE_ZONES
        : CAPTURE_ZONES;

const RAW_SEARCH_RETRIEVE_ITEMS = [
  { id: "old-well-scroll", label: "Old Well Scroll", x: -8, z: -18 },
  { id: "ruins-tablet", label: "Ruins Tablet", x: 12, z: -126 },
  { id: "aqueduct-lamp", label: "Aqueduct Lamp", x: 0, z: 0 }
] as const;

export const SEARCH_RETRIEVE_ITEMS = RAW_SEARCH_RETRIEVE_ITEMS.map(scaleArenaPosition);
export const TEMPLE_RUNOFF_SEARCH_RETRIEVE_ITEMS = [
  { id: "river-tablet", label: "River Tablet", x: scaleArenaValue(-70), z: scaleArenaValue(3), y: 1.4 },
  { id: "rain-idol", label: "Rain Idol", x: scaleArenaValue(8), z: scaleArenaValue(142), y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 1.4 },
  { id: "sun-glyph", label: "Sun Glyph", x: 0, z: scaleArenaValue(-34), y: TEMPLE_RUNOFF_UPPER_LEVEL_Y + 1.4 }
] as const;

export const IRON_JUNCTION_SEARCH_RETRIEVE_ITEMS = [
  { id: "iron-switch-key", label: "Rail Switch Key", x: scaleArenaValue(112), z: scaleArenaValue(-17), y: 1.4 },
  { id: "iron-freight-manifest", label: "Freight Manifest", x: scaleArenaValue(-108), z: scaleArenaValue(-57), y: IRON_JUNCTION_LOADING_LEVEL_Y + 1.4 },
  { id: "iron-signal-lantern", label: "Signal Lantern", x: scaleArenaValue(24), z: scaleArenaValue(25), y: IRON_JUNCTION_OVERPASS_LEVEL_Y + 1.4 }
] as const;

export const DESERT_CITADEL_SEARCH_RETRIEVE_ITEMS = [
  { id: "desert-well-scroll", label: "Well Scroll", x: 0, z: scaleArenaValue(-16), y: 1.4 },
  { id: "desert-rooftop-seal", label: "Rooftop Seal", x: scaleArenaValue(-55), z: scaleArenaValue(66), y: DESERT_CITADEL_ROOFTOP_LEVEL_Y + 1.4 },
  { id: "desert-cistern-crown", label: "Cistern Crown Seal", x: 0, z: scaleArenaValue(78), y: DESERT_CITADEL_CITADEL_LEVEL_Y + 1.4 }
] as const;

export const getSearchRetrieveItemsForMap = (mapId: ArenaMapId | string | undefined) =>
  mapId === "temple_runoff"
    ? TEMPLE_RUNOFF_SEARCH_RETRIEVE_ITEMS
    : mapId === "iron_junction"
      ? IRON_JUNCTION_SEARCH_RETRIEVE_ITEMS
      : mapId === "desert_citadel"
        ? DESERT_CITADEL_SEARCH_RETRIEVE_ITEMS
        : SEARCH_RETRIEVE_ITEMS;

const RAW_SEARCH_RETRIEVE_DELIVERY_ZONES = {
  blue: { id: "blue-delivery", label: "West Fortress Delivery", x: -146, z: 0, radius: 18 },
  red: { id: "red-delivery", label: "East Camp Delivery", x: 146, z: 0, radius: 18 }
} as const;

export const SEARCH_RETRIEVE_DELIVERY_ZONES = {
  blue: scaleArenaRadius(RAW_SEARCH_RETRIEVE_DELIVERY_ZONES.blue),
  red: scaleArenaRadius(RAW_SEARCH_RETRIEVE_DELIVERY_ZONES.red)
} as const;
export const TEMPLE_RUNOFF_SEARCH_RETRIEVE_DELIVERY_ZONES = {
  blue: { id: "blue-temple-delivery", label: "Blue Temple Delivery", x: scaleArenaValue(-205), z: 0, radius: scaleArenaValue(20), y: TEMPLE_RUNOFF_MAIN_LEVEL_Y },
  red: { id: "red-temple-delivery", label: "Red Temple Delivery", x: scaleArenaValue(205), z: 0, radius: scaleArenaValue(20), y: TEMPLE_RUNOFF_MAIN_LEVEL_Y }
} as const;
export const IRON_JUNCTION_SEARCH_RETRIEVE_DELIVERY_ZONES = {
  blue: { id: "blue-iron-delivery", label: "Blue Assembly Delivery", x: scaleArenaValue(-248), z: 0, radius: scaleArenaValue(24), y: 0 },
  red: { id: "red-iron-delivery", label: "Red Assembly Delivery", x: scaleArenaValue(248), z: 0, radius: scaleArenaValue(24), y: 0 }
} as const;
export const DESERT_CITADEL_SEARCH_RETRIEVE_DELIVERY_ZONES = {
  blue: { id: "blue-desert-delivery", label: "West Gate Delivery", x: scaleArenaValue(-146), z: 0, radius: scaleArenaValue(18), y: 0 },
  red: { id: "red-desert-delivery", label: "East Gate Delivery", x: scaleArenaValue(146), z: 0, radius: scaleArenaValue(18), y: 0 }
} as const;

export const getSearchRetrieveDeliveryZonesForMap = (mapId: ArenaMapId | string | undefined) =>
  mapId === "temple_runoff"
    ? TEMPLE_RUNOFF_SEARCH_RETRIEVE_DELIVERY_ZONES
    : mapId === "iron_junction"
      ? IRON_JUNCTION_SEARCH_RETRIEVE_DELIVERY_ZONES
      : mapId === "desert_citadel"
        ? DESERT_CITADEL_SEARCH_RETRIEVE_DELIVERY_ZONES
        : SEARCH_RETRIEVE_DELIVERY_ZONES;

const isKnownPosition = (position: { x?: number; z?: number } | undefined): position is { x: number; z: number } =>
  Boolean(position && Number.isFinite(position.x) && Number.isFinite(position.z));

const distanceToClosestPlayer = (
  spawn: ArenaPosition,
  players: Array<Pick<PlayerSession, "x" | "z" | "team" | "isAlive">>,
  team?: Team
) => {
  let closest = Number.POSITIVE_INFINITY;
  for (const player of players) {
    if (team && player.team === team) continue;
    if (player.isAlive === false || !isKnownPosition(player)) continue;
    closest = Math.min(closest, Math.hypot(player.x - spawn.x, player.z - spawn.z));
  }
  return closest;
};

export const getTeamSpawn = (team: Team, index = 0): GroundArenaPosition => {
  const spawns = teamSpawnsForMap("desert_citadel")[team];
  const spawn = spawns[((index % spawns.length) + spawns.length) % spawns.length];
  return {
    x: spawn.x,
    z: spawn.z,
    facing: spawn.facing,
    ...(Number.isFinite(spawn.y) ? { y: spawn.y } : {})
  };
};

export const getTeamSpawnForMap = (mapId: ArenaMapId | string | undefined, team: Team, index = 0): GroundArenaPosition => {
  const spawns = teamSpawnsForMap(mapId)[team];
  const spawn = spawns[((index % spawns.length) + spawns.length) % spawns.length];
  return {
    x: spawn.x,
    z: spawn.z,
    facing: spawn.facing,
    ...(Number.isFinite(spawn.y) ? { y: spawn.y } : {})
  };
};

export const selectTeamSpawn = (
  team: Team,
  players: Array<Pick<PlayerSession, "x" | "z" | "team" | "isAlive">> = [],
  preferredIndex = 0
): GroundArenaPosition => selectTeamSpawnForMap("desert_citadel", team, players, preferredIndex);

export const selectTeamSpawnForMap = (
  mapId: ArenaMapId | string | undefined,
  team: Team,
  players: Array<Pick<PlayerSession, "x" | "z" | "team" | "isAlive">> = [],
  preferredIndex = 0
): GroundArenaPosition => {
  const spawns = teamSpawnsForMap(mapId)[team];
  if (players.length === 0) return getTeamSpawnForMap(mapId, team, preferredIndex);
  const scored = spawns.map((spawn, index) => {
    const enemyDistance = distanceToClosestPlayer(spawn, players, team);
    const teammateDistance = distanceToClosestPlayer(
      spawn,
      players.filter((player) => player.team === team),
    );
    return {
      spawn,
      index,
      score: Math.min(enemyDistance, 220) + Math.min(teammateDistance, 35) * 0.25 - Math.abs(index - preferredIndex) * 0.01
    };
  });
  scored.sort((a, b) => b.score - a.score);
  const selected = scored[0]?.spawn ?? spawns[0];
  return {
    x: selected.x,
    z: selected.z,
    facing: selected.facing,
    ...(Number.isFinite(selected.y) ? { y: selected.y } : {})
  };
};

export const getFreeForAllSpawn = (index = 0): GroundArenaPosition => {
  const spawn = FREE_FOR_ALL_SPAWNS[((index % FREE_FOR_ALL_SPAWNS.length) + FREE_FOR_ALL_SPAWNS.length) % FREE_FOR_ALL_SPAWNS.length];
  return {
    x: spawn.x,
    z: spawn.z,
    facing: spawn.facing,
    ...(Number.isFinite(spawn.y) ? { y: spawn.y } : {})
  };
};

export const selectFreeForAllSpawn = (
  players: Array<Pick<PlayerSession, "x" | "z" | "isAlive">> = [],
  recentSpawnIds: readonly string[] = []
): GroundArenaPosition => {
  const recent = new Set(recentSpawnIds);
  const scored = FREE_FOR_ALL_SPAWNS.map((spawn) => ({
    spawn,
    score: Math.min(distanceToClosestPlayer(spawn, players.map((player) => ({ ...player, team: "blue" as Team }))), 240) - (recent.has(spawn.id) ? 80 : 0)
  })).sort((a, b) => b.score - a.score);
  const selected = scored[0]?.spawn ?? FREE_FOR_ALL_SPAWNS[0];
  return { x: selected.x, z: selected.z, facing: selected.facing };
};

export const TEAM_BASE_ZONES: Record<Team, { minX: number; maxX: number; minZ: number; maxZ: number }> = {
  blue: { minX: scaleArenaValue(-170), maxX: scaleArenaValue(-112), minZ: scaleArenaValue(-70), maxZ: scaleArenaValue(70) },
  red: { minX: scaleArenaValue(112), maxX: scaleArenaValue(170), minZ: scaleArenaValue(-70), maxZ: scaleArenaValue(70) }
};

export const TEMPLE_RUNOFF_TEAM_BASE_ZONES: typeof TEAM_BASE_ZONES = {
  blue: { minX: scaleArenaValue(-228), maxX: scaleArenaValue(-174), minZ: scaleArenaValue(-176), maxZ: scaleArenaValue(176) },
  red: { minX: scaleArenaValue(174), maxX: scaleArenaValue(228), minZ: scaleArenaValue(-176), maxZ: scaleArenaValue(176) }
};
export const IRON_JUNCTION_TEAM_BASE_ZONES: typeof TEAM_BASE_ZONES = {
  blue: { minX: scaleArenaValue(-272), maxX: scaleArenaValue(-220), minZ: scaleArenaValue(-110), maxZ: scaleArenaValue(110) },
  red: { minX: scaleArenaValue(220), maxX: scaleArenaValue(272), minZ: scaleArenaValue(-110), maxZ: scaleArenaValue(110) }
};

export const getTeamBaseZones = (mapId: ArenaMapId | string | undefined) =>
  mapId === "temple_runoff"
    ? TEMPLE_RUNOFF_TEAM_BASE_ZONES
    : mapId === "iron_junction" ? IRON_JUNCTION_TEAM_BASE_ZONES : TEAM_BASE_ZONES;

export const isInsideTeamBase = (team: Team, position: ArenaPosition | undefined, mapId?: ArenaMapId | string) => {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  const zone = getTeamBaseZones(mapId)[team];
  return position.x >= zone.minX && position.x <= zone.maxX && position.z >= zone.minZ && position.z <= zone.maxZ;
};

export const clampArenaPosition = (
  position: ArenaPosition,
  mapId?: ArenaMapId | string
): Required<Pick<ArenaPosition, "x" | "z" | "facing">> & Pick<ArenaPosition, "y"> => ({
  x: Math.min(getArenaBounds(mapId).limitX, Math.max(-getArenaBounds(mapId).limitX, Number.isFinite(position.x) ? position.x : 0)),
  z: Math.min(getArenaBounds(mapId).limitZ, Math.max(-getArenaBounds(mapId).limitZ, Number.isFinite(position.z) ? position.z : 0)),
  ...(Number.isFinite(position.y) ? { y: position.y } : {}),
  facing: Number.isFinite(position.facing) ? position.facing! : 0
});

const getGearItem = (gearId: string) => GEAR_ITEMS.find((item) => item.id === gearId);

export const getGearDamage = (gearId: string) => getGearItem(gearId)?.damage ?? 20;

export const getGearFireCooldownMs = (gearId: string) => getGearItem(gearId)?.fireCooldownMs ?? 160;

export const isGearAutoFireEnabled = (gearId: string) => getGearItem(gearId)?.autoFire === true;

export const getGearRange = (gearId: string) => getGearItem(gearId)?.range ?? TAG_RANGE;

export const getGearHitRadius = (gearId: string, zoomLevel: number | boolean = true) => {
  const gear = getGearItem(gearId);
  if (!gear) return SNOWBALL_HIT_RADIUS;
  const normalizedZoomLevel = typeof zoomLevel === "boolean" ? (zoomLevel ? 1 : 0) : Math.max(0, Math.min(2, Math.floor(zoomLevel)));
  if (normalizedZoomLevel >= 2 && gear.deepScopedHitRadius !== undefined) return gear.deepScopedHitRadius;
  if (normalizedZoomLevel >= 1 && gear.scopedHitRadius !== undefined) return gear.scopedHitRadius;
  if (normalizedZoomLevel === 0 && gear.unscopedHitRadius !== undefined) return gear.unscopedHitRadius;
  return SNOWBALL_HIT_RADIUS;
};

export const getGearMoveSpeedMultiplier = (gearId: string) =>
  Number((1 + (getGearItem(gearId)?.speedBonus ?? 0)).toFixed(2));

export const getGearZoomFovMultiplier = (gearId: string) => getGearItem(gearId)?.zoomFovMultiplier ?? 1;

export const getPlayerWeaponId = (player: Pick<PlayerSession, "gear" | "weapon">): string =>
  player.weapon && isWeaponGearId(player.weapon)
    ? player.weapon
    : isWeaponGearId(player.gear)
      ? player.gear
      : "starter_blaster";

export const getPlayerWeaponIdForMode = (
  gameMode: GameMode,
  player: Pick<PlayerSession, "gear" | "weapon">
): string => gameMode === "zombie" ? "starter_blaster" : getPlayerWeaponId(player);

export const getPlayerPerks = (player: Pick<PlayerSession, "gear" | "perks">): string[] => {
  const equipped = (player.perks ?? []).filter(isPerkGearId);
  if (isPerkGearId(player.gear)) equipped.push(player.gear);
  return [...new Set(equipped)];
};

export const hasPlayerPerk = (player: Pick<PlayerSession, "gear" | "perks">, perkId: string): boolean =>
  getPlayerPerks(player).includes(perkId);

export const getPlayerHealthMax = (player: Pick<PlayerSession, "gear" | "perks">): number =>
  DEFAULT_PLAYER_HEALTH + (hasPlayerPerk(player, "shield_vest") ? 50 : 0);

export const getPlayerMoveSpeedMultiplier = (player: Pick<PlayerSession, "gear" | "weapon" | "perks">): number =>
  Number((getGearMoveSpeedMultiplier(getPlayerWeaponId(player)) * (hasPlayerPerk(player, "speed_shoes") ? 1.15 : 1)).toFixed(2));

export type ArenaObstacle =
  | { id: string; kind: "rect"; x: number; z: number; width: number; depth: number; jumpable?: boolean; minY?: number; maxY?: number }
  | { id: string; kind: "circle"; x: number; z: number; radius: number; jumpable?: boolean; minY?: number; maxY?: number };

const rectObstacle = (
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  jumpable = false,
  minY?: number,
  maxY?: number
): ArenaObstacle => ({
  id,
  kind: "rect",
  x: scaleArenaValue(x),
  z: scaleArenaValue(z),
  width: scaleArenaValue(width),
  depth: scaleArenaValue(depth),
  jumpable,
  ...(Number.isFinite(minY) ? { minY } : {}),
  ...(Number.isFinite(maxY) ? { maxY } : {})
});

const circleObstacle = (
  id: string,
  x: number,
  z: number,
  radius: number,
  jumpable = false,
  minY?: number,
  maxY?: number
): ArenaObstacle => ({
  id,
  kind: "circle",
  x: scaleArenaValue(x),
  z: scaleArenaValue(z),
  radius: scaleArenaValue(radius),
  jumpable,
  ...(Number.isFinite(minY) ? { minY } : {}),
  ...(Number.isFinite(maxY) ? { maxY } : {})
});

export const ARENA_OBSTACLES: ArenaObstacle[] = [
  rectObstacle("west-fort-inner-north", -112, -50, 5, 44),
  rectObstacle("west-fort-inner-south", -112, 42, 5, 28),
  rectObstacle("west-barracks", -150, -52, 25, 18),
  rectObstacle("west-armoury", -149, 52, 27, 18),
  rectObstacle("west-watchtower", -118, -82, 15, 15),
  rectObstacle("west-gate-shield", -122, -17, 9, 18),
  rectObstacle("east-camp-inner-north", 112, -50, 5, 44),
  rectObstacle("east-camp-inner-south", 112, 42, 5, 28),
  rectObstacle("east-stables", 149, -52, 28, 17),
  rectObstacle("east-storage", 149, 52, 26, 18),
  rectObstacle("east-wooden-gate", 118, -8, 6, 30),
  rectObstacle("east-carts", 126, 35, 18, 8),
  rectObstacle("market-west-shops", -58, -32, 12, 24),
  rectObstacle("market-east-shops", 58, -32, 12, 24),
  rectObstacle("market-north-shops", -22, -58, 44, 12),
  rectObstacle("market-south-shops", 24, 28, 46, 12),
  rectObstacle("market-stall-a", -32, -36, 14, 6, true),
  rectObstacle("market-stall-b", 34, -10, 14, 6, true),
  rectObstacle("market-stall-c", -8, 15, 13, 6, true),
  rectObstacle("market-crates-a", -45, -4, 8, 8, true),
  rectObstacle("market-crates-b", 44, 14, 8, 8, true),
  rectObstacle("citadel-base", 0, 50, 28, 24),
  rectObstacle("ruined-watchtower", 98, -98, 16, 16),
  rectObstacle("south-home-a", -88, 104, 22, 20),
  rectObstacle("south-home-b", -54, 122, 20, 18),
  rectObstacle("south-home-c", -20, 96, 22, 20),
  rectObstacle("south-home-d", 18, 122, 20, 18),
  rectObstacle("south-home-e", 54, 98, 22, 20),
  rectObstacle("south-home-f", 88, 118, 22, 19),
  rectObstacle("aqueduct-north-wall-west", -84, -10, 42, 4),
  rectObstacle("aqueduct-north-wall-midwest", -30, -10, 28, 4),
  rectObstacle("aqueduct-north-wall-mideast", 30, -10, 28, 4),
  rectObstacle("aqueduct-north-wall-east", 84, -10, 42, 4),
  rectObstacle("aqueduct-south-wall-west", -84, 10, 42, 4),
  rectObstacle("aqueduct-south-wall-midwest", -30, 10, 28, 4),
  rectObstacle("aqueduct-south-wall-mideast", 30, 10, 28, 4),
  rectObstacle("aqueduct-south-wall-east", 84, 10, 42, 4),
  rectObstacle("rooftop-center-gap-cover", 0, 44, 20, 8),
  rectObstacle("desert-west-rooftop-rail", -55, 62, 72, 1.2, false, 4, 9),
  rectObstacle("desert-east-rooftop-rail", 55, 62, 72, 1.2, false, 4, 9),
  rectObstacle("desert-citadel-platform-rail-west", -24, 78, 1.2, 16, false, 10, 15),
  rectObstacle("desert-citadel-platform-rail-east", 24, 78, 1.2, 16, false, 10, 15),
  rectObstacle("north-route-cover-a", -108, -82, 12, 8, true),
  rectObstacle("north-route-cover-b", -44, -88, 12, 8, true),
  rectObstacle("north-route-cover-c", 22, -90, 12, 8, true),
  rectObstacle("north-route-cover-d", 86, -78, 12, 8, true),
  rectObstacle("central-route-cover-a", -94, -14, 10, 8, true),
  rectObstacle("central-route-cover-b", 94, 16, 10, 8, true),
  rectObstacle("south-route-cover-a", -112, 94, 12, 8, true),
  rectObstacle("south-route-cover-b", 112, 94, 12, 8, true),
  circleObstacle("old-well", 0, -16, 10),
  circleObstacle("market-pottery-a", -30, -4, 3, true),
  circleObstacle("market-pottery-b", 34, -34, 3, true)
];

/** Simplified collision proxies for the Iron Junction props and architecture. */
export const IRON_JUNCTION_OBSTACLES: ArenaObstacle[] = [
  rectObstacle("iron-north-cliff", 0, -246, 560, 8, false, 0, 24),
  rectObstacle("iron-south-cliff", 0, 246, 560, 8, false, 0, 30),
  rectObstacle("iron-west-cliff", -276, 0, 8, 500, false, 0, 22),
  rectObstacle("iron-east-cliff", 276, 0, 8, 500, false, 0, 22),

  rectObstacle("blue-base-inner-north", -218, -92, 8, 42, false, 0, 14),
  rectObstacle("blue-base-inner-midnorth", -218, -55, 8, 16, false, 0, 14),
  rectObstacle("blue-base-inner-center", -218, 0, 8, 38, false, 0, 14),
  rectObstacle("blue-base-inner-midsouth", -218, 55, 8, 16, false, 0, 14),
  rectObstacle("blue-base-inner-south", -218, 92, 8, 42, false, 0, 14),
  rectObstacle("blue-base-sight-screen-north", -198, -58, 28, 7, false, 0, 9),
  rectObstacle("blue-base-sight-screen-south", -198, 58, 28, 7, false, 0, 9),
  rectObstacle("blue-objective-booth", -247, 0, 28, 32, false, 0, 10),
  rectObstacle("red-base-inner-north", 218, -92, 8, 42, false, 0, 14),
  rectObstacle("red-base-inner-midnorth", 218, -55, 8, 16, false, 0, 14),
  rectObstacle("red-base-inner-center", 218, 0, 8, 38, false, 0, 14),
  rectObstacle("red-base-inner-midsouth", 218, 55, 8, 16, false, 0, 14),
  rectObstacle("red-base-inner-south", 218, 92, 8, 42, false, 0, 14),
  rectObstacle("red-base-sight-screen-north", 198, -58, 28, 7, false, 0, 9),
  rectObstacle("red-base-sight-screen-south", 198, 58, 28, 7, false, 0, 9),
  rectObstacle("red-objective-booth", 247, 0, 28, 32, false, 0, 10),

  rectObstacle("warehouse-north-wall", -112, -190, 164, 8, false, 0, 20),
  rectObstacle("warehouse-west-wall", -194, -130, 8, 128, false, 0, 20),
  rectObstacle("warehouse-east-wall-north", -30, -164, 8, 44, false, 0, 20),
  rectObstacle("warehouse-east-wall-south", -30, -94, 8, 34, false, 0, 20),
  rectObstacle("warehouse-south-wall-west", -165, -66, 58, 8, false, 0, 15),
  rectObstacle("warehouse-south-wall-center", -92, -66, 40, 8, false, 0, 15),
  rectObstacle("warehouse-south-wall-east", -45, -66, 22, 8, false, 0, 15),
  rectObstacle("warehouse-office", -158, -157, 34, 26, false, 0, 9),
  rectObstacle("warehouse-conveyor", -87, -132, 52, 9, false, 0, 4),
  rectObstacle("warehouse-pillar-a", -126, -98, 4, 4, false, 0, 18),
  rectObstacle("warehouse-pillar-b", -72, -98, 4, 4, false, 0, 18),

  rectObstacle("dispatch-north-wall", 135, -188, 142, 8, false, 0, 16),
  rectObstacle("dispatch-east-wall", 206, -139, 8, 106, false, 0, 16),
  rectObstacle("dispatch-west-wall-north", 64, -164, 8, 42, false, 0, 16),
  rectObstacle("dispatch-west-wall-south", 64, -103, 8, 34, false, 0, 16),
  rectObstacle("dispatch-south-wall-west", 91, -86, 46, 8, false, 0, 13),
  rectObstacle("dispatch-south-wall-east", 178, -86, 48, 8, false, 0, 13),
  rectObstacle("dispatch-operations-room", 161, -149, 54, 38, false, 0, 10),
  rectObstacle("junction-control-lower", 58, -38, 34, 32, false, 0, 9),
  rectObstacle("junction-control-upper", 58, -38, 30, 28, false, 10, 18),

  rectObstacle("freight-train-west", -100, -42, 58, 13, false, 0, 8),
  rectObstacle("junction-locomotive", -8, 0, 70, 15, false, 0, 10),
  rectObstacle("freight-train-east", 105, 42, 60, 13, false, 0, 8),
  rectObstacle("damaged-railcar", -48, 82, 42, 13, false, 0, 7),
  rectObstacle("yard-cover-signal-box", 112, -17, 20, 18, false, 0, 7),
  rectObstacle("yard-platform-west", -155, 20, 54, 17, false, 0, 2),
  rectObstacle("yard-platform-east", 157, 66, 48, 17, false, 0, 2),

  rectObstacle("depot-east-wall", 190, 151, 8, 116, false, 0, 18),
  rectObstacle("depot-north-wall-west", 37, 96, 58, 8, false, 0, 17),
  rectObstacle("depot-north-wall-center", 106, 96, 38, 8, false, 0, 17),
  rectObstacle("depot-north-wall-east", 169, 96, 34, 8, false, 0, 17),
  rectObstacle("depot-south-wall-west", 40, 205, 64, 8, false, 0, 17),
  rectObstacle("depot-south-wall-east", 157, 205, 66, 8, false, 0, 17),
  rectObstacle("depot-west-wall-north", 4, 120, 8, 42, false, 0, 17),
  rectObstacle("depot-west-wall-south", 4, 181, 8, 40, false, 0, 17),
  rectObstacle("depot-side-office", 157, 174, 42, 35, false, 0, 9),
  rectObstacle("depot-machinery-bay", 48, 164, 31, 19, false, 0, 6),

  rectObstacle("tunnel-south-wall-west", -145, 234, 142, 8, false, 0, 15),
  rectObstacle("tunnel-south-wall-east", 18, 238, 164, 8, false, 0, 15),
  rectObstacle("tunnel-north-wall-a", -177, 194, 70, 8, false, 0, 13),
  rectObstacle("tunnel-north-wall-b", -78, 198, 52, 8, false, 0, 13),
  rectObstacle("tunnel-north-wall-c", 16, 202, 70, 8, false, 0, 13),
  rectObstacle("tunnel-north-wall-d", 110, 206, 52, 8, false, 0, 13),
  rectObstacle("tunnel-sight-break-west", -104, 216, 12, 16, false, 0, 8),
  rectObstacle("tunnel-sight-break-east", 54, 220, 12, 16, false, 0, 8),

  rectObstacle("overpass-support-west", -78, 25, 6, 6, false, 0, 18),
  rectObstacle("overpass-support-center", 18, 25, 6, 6, false, 0, 18),
  rectObstacle("overpass-support-east", 92, 25, 6, 6, false, 0, 18),
  rectObstacle("gantry-sight-screen", -6, 25, 36, 5, false, 17.5, 24.5),
  rectObstacle("overpass-north-rail-west", -77.5, 15, 55, 1.2, false, 18, 20.5),
  rectObstacle("overpass-north-rail-center", 5, 15, 70, 1.2, false, 18, 20.5),
  rectObstacle("overpass-north-rail-east", 92.5, 15, 65, 1.2, false, 18, 20.5),
  rectObstacle("overpass-south-rail-west", -77.5, 35, 55, 1.2, false, 18, 20.5),
  rectObstacle("overpass-south-rail-center", 5, 35, 70, 1.2, false, 18, 20.5),
  rectObstacle("overpass-south-rail-east", 92.5, 35, 65, 1.2, false, 18, 20.5),
  rectObstacle("warehouse-link-west-rail", -115, -35.5, 1.2, 101, false, 18, 20.5),
  rectObstacle("warehouse-link-east-rail", -95, -35.5, 1.2, 101, false, 18, 20.5),
  rectObstacle("dispatch-link-west-rail", 109, -22, 1.2, 80, false, 18, 20.5),
  rectObstacle("dispatch-link-east-rail", 129, -22, 1.2, 80, false, 18, 20.5),

  circleObstacle("yard-signal-base-west", -150, -18, 2.5, false, 0, 10),
  circleObstacle("yard-signal-base-east", 150, 18, 2.5, false, 0, 10),
  circleObstacle("depot-hydraulic-lift", 94, 172, 3, false, 0, 7),
  circleObstacle("dispatch-clock-column", 105, -130, 2.5, false, 0, 11)
];

/** Ground-plane collision proxies for Temple Runoff's playable architecture. */
export const TEMPLE_RUNOFF_OBSTACLES: ArenaObstacle[] = [
  rectObstacle("temple-north-cliff", 0, -196, 470, 8, false, 0, 28),
  rectObstacle("temple-south-cliff", 0, 196, 470, 8, false, 0, 28),
  rectObstacle("temple-west-cliff", -231, 0, 8, 400, false, 0, 28),
  rectObstacle("temple-east-cliff", 231, 0, 8, 400, false, 0, 28),
  rectObstacle("canal-bank-north-far-west", -188.5, -25, 77, 5, false, 0, 8),
  rectObstacle("canal-bank-north-west", -94, -25, 56, 5, false, 0, 8),
  rectObstacle("canal-bank-north-center", 1.5, -25, 79, 5, false, 0, 8),
  rectObstacle("canal-bank-north-east", 95.5, -25, 53, 5, false, 0, 8),
  rectObstacle("canal-bank-north-far-east", 188.5, -25, 77, 5, false, 0, 8),
  rectObstacle("canal-bank-south-far-west", -188.5, 25, 77, 5, false, 0, 8),
  rectObstacle("canal-bank-south-west", -94, 25, 56, 5, false, 0, 8),
  rectObstacle("canal-bank-south-center", 1.5, 25, 79, 5, false, 0, 8),
  rectObstacle("canal-bank-south-east", 95.5, 25, 53, 5, false, 0, 8),
  rectObstacle("canal-bank-south-far-east", 188.5, 25, 77, 5, false, 0, 8),
  rectObstacle("sun-bridge-support-nw", -14, -35, 7, 8, false, 0, 17),
  rectObstacle("sun-bridge-support-ne", 14, -35, 7, 8, false, 0, 17),
  rectObstacle("sun-bridge-support-sw", -14, 35, 7, 8, false, 0, 17),
  rectObstacle("sun-bridge-support-se", 14, 35, 7, 8, false, 0, 17),
  rectObstacle("sun-parapet-west", -19, -18, 4, 44, false, 17, 21),
  rectObstacle("sun-parapet-east", 19, 17, 4, 46, false, 17, 21),
  rectObstacle("upper-jungle-balustrade", -75, -82, 56, 4, false, 17, 21),
  rectObstacle("upper-temple-balustrade", 75, 82, 56, 4, false, 17, 21),
  rectObstacle("blue-temple-gatehouse", -204, -92, 28, 42, false, 8, 23),
  rectObstacle("blue-temple-foundation", -204, 83, 30, 52, false, 8, 20),
  rectObstacle("red-temple-gatehouse", 204, 92, 28, 42, false, 8, 23),
  rectObstacle("red-temple-foundation", 204, -83, 30, 52, false, 8, 20),
  rectObstacle("jungle-ruin-wall", -98, -132, 54, 8, false, 8, 18),
  rectObstacle("jungle-root-cover", -42, -116, 22, 9, true, 8, 13),
  rectObstacle("north-collapsed-sanctum", 76, -132, 42, 16, false, 8, 20),
  rectObstacle("rain-court-wall-west", -90, 112, 44, 8, false, 8, 17),
  rectObstacle("rain-court-wall-east", 82, 118, 48, 8, false, 8, 17),
  rectObstacle("rain-court-planter", 18, 125, 24, 12, true, 8, 11.5),
  rectObstacle("lower-broken-pillar", -72, 2, 10, 12, false, 0, 5.5),
  rectObstacle("lower-collapsed-wall", 58, 17, 24, 7, true, 0, 4.5),
  rectObstacle("lower-submerged-ruin", 150, 7, 20, 10, true, 0, 3.2),
  circleObstacle("rain-god-statue", 0, 126, 7, false, 8, 25),
  circleObstacle("jungle-column-west", -126, -104, 4, false, 8, 20),
  circleObstacle("temple-column-east", 122, 111, 4, false, 8, 20),
  circleObstacle("canal-rock", 18, 12, 5, true, 0, 4.2),
  circleObstacle("upper-jungle-column", -94, -66, 3, false, 17, 25),
  circleObstacle("upper-temple-column", 96, 66, 3, false, 17, 25)
];

const ARENA_OBSTACLES_BY_MAP: Record<ArenaMapId, ArenaObstacle[]> = {
  desert_citadel: ARENA_OBSTACLES,
  iron_junction: IRON_JUNCTION_OBSTACLES,
  temple_runoff: TEMPLE_RUNOFF_OBSTACLES
};

export const getArenaObstacles = (mapId: ArenaMapId | string | undefined): ArenaObstacle[] =>
  ARENA_OBSTACLES_BY_MAP[mapId === "iron_junction" || mapId === "temple_runoff" ? mapId : "desert_citadel"];

export type SnowballUseResult =
  | { ok: true; nextSnowballs: number }
  | { ok: false; reason: "attacker_eliminated" | "out_of_snowballs" };

export const resolveSnowballUse = (
  player: Pick<PlayerSession, "isAlive" | "snowballs">
): SnowballUseResult => {
  if (!player.isAlive) return { ok: false, reason: "attacker_eliminated" };
  const currentSnowballs = Math.floor(player.snowballs ?? DEFAULT_SESSION_SETTINGS.startingSnowballs);
  if (currentSnowballs <= 0) return { ok: false, reason: "out_of_snowballs" };
  return { ok: true, nextSnowballs: currentSnowballs - 1 };
};

export type SnowballPurchaseResult =
  | { ok: true; nextMoney: number; nextSnowballs: number; snowballsAdded: number }
  | { ok: false; reason: "player_eliminated" | "not_enough_money" };

export const resolveSnowballPurchase = ({
  player,
  settings
}: {
  player: Pick<PlayerSession, "isAlive" | "money" | "snowballs">;
  settings: Pick<SessionSettings, "snowballPackPrice" | "snowballsPerPack" | "startingSnowballs">;
}): SnowballPurchaseResult => {
  if (!player.isAlive) return { ok: false, reason: "player_eliminated" };
  if (player.money < settings.snowballPackPrice) return { ok: false, reason: "not_enough_money" };
  return {
    ok: true,
    nextMoney: player.money - settings.snowballPackPrice,
    nextSnowballs: (player.snowballs ?? settings.startingSnowballs) + settings.snowballsPerPack,
    snowballsAdded: settings.snowballsPerPack
  };
};

export type GearPurchaseResult =
  | {
      ok: true;
      alreadyEquipped: boolean;
      nextMoney: number;
      nextHealth?: number;
      gearChanged: boolean;
    }
  | { ok: false; reason: "player_eliminated" | "outside_base" | "not_enough_money" | "starter_weapon" };

export const resolveGearPurchase = ({
  player,
  gear,
  requireBase = true,
  mapId
}: {
  player: Pick<PlayerSession, "isAlive" | "money" | "gear" | "weapon" | "perks" | "health" | "team" | "x" | "z">;
  gear: GearItem;
  requireBase?: boolean;
  mapId?: ArenaMapId | string;
}): GearPurchaseResult => {
  if (!player.isAlive) return { ok: false, reason: "player_eliminated" };
  if (getPlayerWeaponId(player) === gear.id || hasPlayerPerk(player, gear.id)) {
    return {
      ok: true,
      alreadyEquipped: true,
      nextMoney: player.money,
      nextHealth: player.health,
      gearChanged: false
    };
  }
  if (gear.id === "starter_blaster") return { ok: false, reason: "starter_weapon" };
  if (requireBase && !isInsideTeamBase(player.team, { x: player.x ?? getTeamSpawnForMap(mapId, player.team).x, z: player.z ?? getTeamSpawnForMap(mapId, player.team).z }, mapId)) {
    return { ok: false, reason: "outside_base" };
  }
  if (player.money < gear.cost) return { ok: false, reason: "not_enough_money" };
  const nextHealth = gear.healthBonus
    ? Math.min(DEFAULT_PLAYER_HEALTH + gear.healthBonus, (player.health ?? DEFAULT_PLAYER_HEALTH) + gear.healthBonus)
    : player.health;
  return {
    ok: true,
    alreadyEquipped: false,
    nextMoney: player.money - gear.cost,
    nextHealth,
    gearChanged: true
  };
};

export type ProjectileTargetResult =
  | { ok: true; targetId: string }
  | { ok: false; reason: "attacker_eliminated" | "invalid_target" | "blocked_by_cover" | "no_valid_target" };

const expandRect = (obstacle: Extract<ArenaObstacle, { kind: "rect" }>, padding: number) => ({
  minX: obstacle.x - obstacle.width / 2 - padding,
  maxX: obstacle.x + obstacle.width / 2 + padding,
  minZ: obstacle.z - obstacle.depth / 2 - padding,
  maxZ: obstacle.z + obstacle.depth / 2 + padding
});

const pointInsideObstacle = (point: ArenaPosition, obstacle: ArenaObstacle, padding = 0) => {
  if (
    Number.isFinite(point.y)
    && (
      (Number.isFinite(obstacle.minY) && Number(point.y) < Number(obstacle.minY))
      || (Number.isFinite(obstacle.maxY) && Number(point.y) > Number(obstacle.maxY))
    )
  ) return false;
  if (obstacle.kind === "circle") {
    return Math.hypot(point.x - obstacle.x, point.z - obstacle.z) <= obstacle.radius + padding;
  }
  const rect = expandRect(obstacle, padding);
  return point.x >= rect.minX && point.x <= rect.maxX && point.z >= rect.minZ && point.z <= rect.maxZ;
};

const segmentIntersectsRect = (start: ArenaPosition, end: ArenaPosition, obstacle: Extract<ArenaObstacle, { kind: "rect" }>, padding = 0) => {
  const rect = expandRect(obstacle, padding);
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  let tMin = 0;
  let tMax = 1;
  for (const [origin, delta, min, max] of [
    [start.x, dx, rect.minX, rect.maxX],
    [start.z, dz, rect.minZ, rect.maxZ]
  ] as const) {
    if (Math.abs(delta) < 0.0001) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const inverse = 1 / delta;
    let t1 = (min - origin) * inverse;
    let t2 = (max - origin) * inverse;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
};

const distanceToShotSegment = ({
  origin,
  direction,
  target,
  range
}: {
  origin: ArenaPosition;
  direction: { x: number; z: number };
  target: ArenaPosition;
  range: number;
}) => {
  const targetX = target.x - origin.x;
  const targetZ = target.z - origin.z;
  const projection = targetX * direction.x + targetZ * direction.z;
  const clampedProjection = Math.min(range, Math.max(0, projection));
  const closestX = direction.x * clampedProjection;
  const closestZ = direction.z * clampedProjection;
  return {
    alongShot: projection,
    distance: Math.hypot(targetX - closestX, targetZ - closestZ)
  };
};

const segmentIntersectsObstacle = (start: ArenaPosition, end: ArenaPosition, obstacle: ArenaObstacle, padding = 0) => {
  if (Number.isFinite(start.y) && Number.isFinite(end.y)) {
    const segmentMinY = Math.min(Number(start.y), Number(end.y));
    const segmentMaxY = Math.max(Number(start.y), Number(end.y));
    if (Number.isFinite(obstacle.minY) && segmentMaxY < Number(obstacle.minY)) return false;
    if (Number.isFinite(obstacle.maxY) && segmentMinY > Number(obstacle.maxY)) return false;
  }
  if (pointInsideObstacle(start, obstacle, padding) || pointInsideObstacle(end, obstacle, padding)) return true;
  if (obstacle.kind === "rect") return segmentIntersectsRect(start, end, obstacle, padding);
  const range = Math.hypot(end.x - start.x, end.z - start.z);
  if (range <= 0.0001) return false;
  const direction = { x: (end.x - start.x) / range, z: (end.z - start.z) / range };
  return distanceToShotSegment({ origin: start, direction, target: obstacle, range }).distance <= obstacle.radius + padding;
};

export const hasLineOfSight = ({
  from,
  to,
  obstacles = ARENA_OBSTACLES,
  padding = 0
}: {
  from: ArenaPosition;
  to: ArenaPosition;
  obstacles?: readonly ArenaObstacle[];
  padding?: number;
}) => !obstacles.some((obstacle) => segmentIntersectsObstacle(from, to, obstacle, padding));

const distanceBetweenSegments = ({
  firstStart,
  firstEnd,
  secondStart,
  secondEnd
}: {
  firstStart: { x: number; z: number };
  firstEnd: { x: number; z: number };
  secondStart: { x: number; z: number };
  secondEnd: { x: number; z: number };
}) => {
  const firstDirection = { x: firstEnd.x - firstStart.x, z: firstEnd.z - firstStart.z };
  const secondDirection = { x: secondEnd.x - secondStart.x, z: secondEnd.z - secondStart.z };
  const offset = { x: firstStart.x - secondStart.x, z: firstStart.z - secondStart.z };
  const firstLengthSquared = firstDirection.x ** 2 + firstDirection.z ** 2;
  const secondLengthSquared = secondDirection.x ** 2 + secondDirection.z ** 2;
  const directionsDot = firstDirection.x * secondDirection.x + firstDirection.z * secondDirection.z;
  const firstOffsetDot = firstDirection.x * offset.x + firstDirection.z * offset.z;
  const secondOffsetDot = secondDirection.x * offset.x + secondDirection.z * offset.z;
  const denominator = firstLengthSquared * secondLengthSquared - directionsDot ** 2;
  let firstAmount = secondLengthSquared <= Number.EPSILON
    ? firstLengthSquared > 0 ? Math.min(1, Math.max(0, -firstOffsetDot / firstLengthSquared)) : 0
    : denominator > 0
      ? Math.min(1, Math.max(0, (directionsDot * secondOffsetDot - firstOffsetDot * secondLengthSquared) / denominator))
      : 0;
  let secondAmount = secondLengthSquared > 0
    ? (directionsDot * firstAmount + secondOffsetDot) / secondLengthSquared
    : 0;

  if (secondAmount < 0) {
    secondAmount = 0;
    firstAmount = firstLengthSquared > 0 ? Math.min(1, Math.max(0, -firstOffsetDot / firstLengthSquared)) : 0;
  } else if (secondAmount > 1) {
    secondAmount = 1;
    firstAmount = firstLengthSquared > 0
      ? Math.min(1, Math.max(0, (directionsDot - firstOffsetDot) / firstLengthSquared))
      : 0;
  }

  const firstPoint = {
    x: firstStart.x + firstDirection.x * firstAmount,
    z: firstStart.z + firstDirection.z * firstAmount
  };
  const secondPoint = {
    x: secondStart.x + secondDirection.x * secondAmount,
    z: secondStart.z + secondDirection.z * secondAmount
  };
  return {
    alongFirst: firstAmount,
    distance: Math.hypot(firstPoint.x - secondPoint.x, firstPoint.z - secondPoint.z),
    secondPoint
  };
};

export const resolveProjectileTarget = ({
  attacker,
  candidates,
  requestedTargetId,
  obstacles = ARENA_OBSTACLES,
  range = TAG_RANGE,
  hitRadius = SNOWBALL_HIT_RADIUS
}: {
  attacker: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "y" | "z" | "facing">;
  candidates: Array<
    Pick<PlayerSession, "id" | "team" | "isAlive" | "connectionState" | "x" | "y" | "z" | "isBot">
    & { previousX?: number; previousY?: number; previousZ?: number }
  >;
  requestedTargetId?: string;
  obstacles?: readonly ArenaObstacle[];
  range?: number;
  hitRadius?: number;
}): ProjectileTargetResult => {
  if (!attacker.isAlive) return { ok: false, reason: "attacker_eliminated" };
  if (requestedTargetId && !candidates.some((candidate) => candidate.id === requestedTargetId)) {
    return { ok: false, reason: "invalid_target" };
  }

  const origin = {
    x: Number.isFinite(attacker.x) ? attacker.x! : 0,
    y: Number.isFinite(attacker.y) ? attacker.y! : 0,
    z: Number.isFinite(attacker.z) ? attacker.z! : 0,
    facing: Number.isFinite(attacker.facing) ? attacker.facing : 0
  };
  const direction = {
    x: -Math.sin(origin.facing ?? 0),
    z: -Math.cos(origin.facing ?? 0)
  };

  let selected: { id: string; alongShot: number; distance: number } | undefined;
  let blockedByCover = false;
  for (const candidate of candidates) {
    if (candidate.id === attacker.id) continue;
    if (requestedTargetId && candidate.id !== requestedTargetId) continue;
    if (candidate.connectionState === "disconnected" || !candidate.isAlive || candidate.team === attacker.team) continue;
    if (Math.abs((candidate.y ?? 0) - origin.y) > 5.5) continue;
    const target = {
      x: Number.isFinite(candidate.x) ? candidate.x! : 0,
      y: Number.isFinite(candidate.y) ? candidate.y! : 0,
      z: Number.isFinite(candidate.z) ? candidate.z! : 0
    };
    const previousTarget = {
      x: Number.isFinite(candidate.previousX) ? candidate.previousX! : target.x,
      y: Number.isFinite(candidate.previousY) ? candidate.previousY! : target.y,
      z: Number.isFinite(candidate.previousZ) ? candidate.previousZ! : target.z
    };
    const rewoundHit = distanceBetweenSegments({
      firstStart: origin,
      firstEnd: {
        x: origin.x + direction.x * range,
        z: origin.z + direction.z * range
      },
      secondStart: previousTarget,
      secondEnd: target
    });
    const hit = {
      alongShot: rewoundHit.alongFirst * range,
      distance: rewoundHit.distance
    };
    if (hit.alongShot < 0 || hit.alongShot > range || hit.distance > hitRadius) continue;
    const rewindTarget = {
      x: rewoundHit.secondPoint.x,
      y: target.y,
      z: rewoundHit.secondPoint.z
    };
    if (!hasLineOfSight({ from: origin, to: rewindTarget, obstacles })) {
      blockedByCover = true;
      continue;
    }
    if (!selected || hit.alongShot < selected.alongShot) {
      selected = { id: candidate.id, alongShot: hit.alongShot, distance: hit.distance };
    }
  }

  if (selected) return { ok: true, targetId: selected.id };
  return { ok: false, reason: blockedByCover ? "blocked_by_cover" : "no_valid_target" };
};

export type AuthoritativeMovementResult = Required<Pick<ArenaPosition, "x" | "z" | "facing">> & Pick<ArenaPosition, "y"> & {
  limited?: true;
  blocked?: true;
};

export const resolveAuthoritativeMovement = ({
  current,
  requested,
  elapsedMs,
  maxSpeed,
  obstacles = ARENA_OBSTACLES,
  radius = 0.45,
  groundY = 0,
  mapId
}: {
  current: ArenaPosition;
  requested: ArenaPosition;
  elapsedMs: number;
  maxSpeed: number;
  obstacles?: readonly ArenaObstacle[];
  radius?: number;
  groundY?: number;
  mapId?: ArenaMapId | string;
}): AuthoritativeMovementResult => {
  const from = clampArenaPosition(current, mapId);
  const to = clampArenaPosition(requested, mapId);
  const elapsedSeconds = Math.max(0.05, Math.min(1, elapsedMs / 1000));
  const maxDistance = Math.max(0, maxSpeed * elapsedSeconds);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  const limited = distance > maxDistance && maxDistance > 0;
  if (distance > 0 && maxDistance <= 0) {
    return { ...from, facing: to.facing, limited: true };
  }
  const next = limited
    ? clampArenaPosition({
        x: from.x + (dx / distance) * maxDistance,
        z: from.z + (dz / distance) * maxDistance,
        y: to.y,
        facing: to.facing
      }, mapId)
    : to;

  const canClearJumpable = (obstacle: ArenaObstacle) => obstacle.jumpable === true && Number(to.y) - groundY >= 5;
  const movementIsBlocked = (start: ArenaPosition, end: ArenaPosition) => obstacles.some((obstacle) => {
    const eyeY = Number.isFinite(end.y) ? Number(end.y) : groundY + ARENA_PLAYER_EYE_HEIGHT;
    const bodyMinY = eyeY - ARENA_PLAYER_EYE_HEIGHT;
    const bodyMaxY = bodyMinY + ARENA_PLAYER_BODY_HEIGHT;
    if (Number.isFinite(obstacle.minY) && bodyMaxY < Number(obstacle.minY)) return false;
    if (Number.isFinite(obstacle.maxY) && bodyMinY > Number(obstacle.maxY)) return false;
    const horizontalStart = { ...start, y: undefined };
    const horizontalEnd = { ...end, y: undefined };
    if (canClearJumpable(obstacle) || !segmentIntersectsObstacle(horizontalStart, horizontalEnd, obstacle, radius)) return false;
    // A player whose last accepted point sits on the padded collision boundary
    // must be allowed to move back out instead of remaining trapped forever.
    return !(pointInsideObstacle(horizontalStart, obstacle, radius) && !pointInsideObstacle(horizontalEnd, obstacle, radius));
  });
  if (movementIsBlocked(from, next)) {
    // The FPS controller resolves X and Z independently so players slide around
    // cover. Mirror that ordering on the server to keep authoritative and visual
    // positions together when an intermediate volatile packet is skipped.
    let resolved = {
      ...from,
      ...(Number.isFinite(next.y) ? { y: next.y } : {}),
      facing: to.facing
    };
    const xStep = { ...resolved, x: next.x };
    if (!movementIsBlocked(resolved, xStep)) resolved = xStep;
    const zStep = { ...resolved, z: next.z };
    if (!movementIsBlocked(resolved, zStep)) resolved = zStep;
    if (resolved.x === from.x && resolved.z === from.z) {
      return { ...from, facing: to.facing, blocked: true };
    }
    return {
      ...resolved,
      blocked: true,
      ...(limited ? { limited: true as const } : {})
    };
  }

  return limited ? { ...next, limited: true } : next;
};

export type BotAttackTargetResult = { ok: true; targetId: string } | { ok: false; reason: "no_valid_target" };

export const resolveBotPursuitTarget = ({
  bot,
  candidates
}: {
  bot: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "y" | "z">;
  candidates: Array<Pick<PlayerSession, "id" | "team" | "isAlive" | "connectionState" | "isBot" | "x" | "y" | "z">>;
}): ArenaPosition | undefined => {
  if (!bot.isAlive) return undefined;
  const botPosition = { x: bot.x ?? 0, z: bot.z ?? 0 };
  let selected: { position: ArenaPosition; distance: number } | undefined;
  for (const candidate of candidates) {
    if (
      candidate.id === bot.id ||
      candidate.isBot ||
      candidate.connectionState === "disconnected" ||
      !candidate.isAlive ||
      candidate.team === bot.team
    ) continue;
    if (Math.abs((candidate.y ?? 0) - (bot.y ?? 0)) > 5.5) continue;
    const position = { x: candidate.x ?? 0, z: candidate.z ?? 0 };
    const distance = Math.hypot(position.x - botPosition.x, position.z - botPosition.z);
    if (!selected || distance < selected.distance) selected = { position, distance };
  }
  return selected?.position;
};

export const getRoundResetLoadout = ({
  player,
  startingSnowballs
}: {
  player: Pick<PlayerSession, "isAlive" | "gear" | "weapon" | "perks" | "snowballs">;
  startingSnowballs: number;
}) => {
  const weapon = player.isAlive ? getPlayerWeaponId(player) : "starter_blaster";
  const loadout: {
    gear: string;
    snowballs: number;
    weapon?: string;
    perks?: string[];
  } = {
    gear: weapon,
    snowballs: player.isAlive
      ? Math.max(0, Math.floor(Number.isFinite(player.snowballs) ? player.snowballs! : startingSnowballs))
      : Math.max(0, Math.floor(startingSnowballs))
  };
  if ("weapon" in player || "perks" in player) {
    loadout.weapon = weapon;
    loadout.perks = player.isAlive ? getPlayerPerks(player) : [];
  }
  return loadout;
};

export const resolveBotAttackTarget = ({
  bot,
  candidates,
  obstacles = ARENA_OBSTACLES,
  range = TAG_RANGE
}: {
  bot: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "y" | "z">;
  candidates: Array<Pick<PlayerSession, "id" | "team" | "isAlive" | "connectionState" | "isBot" | "x" | "y" | "z">>;
  obstacles?: readonly ArenaObstacle[];
  range?: number;
}): BotAttackTargetResult => {
  if (!bot.isAlive) return { ok: false, reason: "no_valid_target" };
  const botPosition = { x: bot.x ?? 0, y: bot.y ?? 0, z: bot.z ?? 0 };
  let selected: { id: string; distance: number } | undefined;
  for (const candidate of candidates) {
    if (candidate.id === bot.id || candidate.isBot || candidate.connectionState === "disconnected" || !candidate.isAlive || candidate.team === bot.team) continue;
    if (Math.abs((candidate.y ?? 0) - botPosition.y) > 5.5) continue;
    const targetPosition = { x: candidate.x ?? 0, y: candidate.y ?? 0, z: candidate.z ?? 0 };
    const distance = Math.hypot(targetPosition.x - botPosition.x, targetPosition.z - botPosition.z);
    if (distance > range || !hasLineOfSight({ from: botPosition, to: targetPosition, obstacles })) continue;
    if (!selected || distance < selected.distance) selected = { id: candidate.id, distance };
  }
  return selected ? { ok: true, targetId: selected.id } : { ok: false, reason: "no_valid_target" };
};

type BotNavigationNode = { key: string; ix: number; iz: number; x: number; y: number; z: number };
type BotNavigationGrid = {
  nodes: Map<string, BotNavigationNode>;
  neighborKeys: Map<string, string[]>;
  coordinateKeys: Map<string, string[]>;
};
const botNavigationGridCache = new WeakMap<object, Map<string, BotNavigationGrid>>();

export const findBotNavigationPath = ({
  from,
  to,
  obstacles = ARENA_OBSTACLES,
  cellSize = 6,
  padding = 0.7,
  mapId
}: {
  from: ArenaPosition;
  to: ArenaPosition;
  obstacles?: readonly ArenaObstacle[];
  cellSize?: number;
  padding?: number;
  mapId?: ArenaMapId | string;
}): Array<{ x: number; y?: number; z: number }> => {
  const start = clampArenaPosition(from, mapId);
  const goal = clampArenaPosition(to, mapId);
  start.y = Number.isFinite(start.y)
    ? start.y
    : getArenaGroundHeight(mapId, start.x, start.z) + ARENA_PLAYER_EYE_HEIGHT;
  goal.y = Number.isFinite(goal.y)
    ? goal.y
    : getArenaGroundHeightForPlayer(mapId, goal.x, goal.z, start.y, ARENA_PLAYER_EYE_HEIGHT, 1.4) + ARENA_PLAYER_EYE_HEIGHT;
  if (Math.abs(Number(start.y) - Number(goal.y)) <= 1.5 && hasLineOfSight({ from: start, to: goal, obstacles, padding })) {
    return [{ x: goal.x, y: goal.y, z: goal.z }];
  }

  const safeCellSize = Math.max(4, cellSize);
  const bounds = getArenaBounds(mapId);
  const minX = -bounds.limitX + padding;
  const minZ = -bounds.limitZ + padding;
  const xCount = Math.floor((bounds.limitX * 2 - padding * 2) / safeCellSize) + 1;
  const zCount = Math.floor((bounds.limitZ * 2 - padding * 2) / safeCellSize) + 1;
  const cacheKey = `${mapId ?? "default"}:${safeCellSize}:${padding}:${xCount}:${zCount}`;
  let gridVariants = botNavigationGridCache.get(obstacles as object);
  if (!gridVariants) {
    gridVariants = new Map();
    botNavigationGridCache.set(obstacles as object, gridVariants);
  }
  let grid = gridVariants.get(cacheKey);
  if (!grid) {
    const nodes = new Map<string, BotNavigationNode>();
    const coordinateKeys = new Map<string, string[]>();
    for (let ix = 0; ix < xCount; ix += 1) {
      for (let iz = 0; iz < zCount; iz += 1) {
        const point = { x: minX + ix * safeCellSize, z: minZ + iz * safeCellSize };
        for (const [levelIndex, surfaceY] of getArenaFloorSurfaces(mapId, point.x, point.z).entries()) {
          const eyePoint = { ...point, y: surfaceY + ARENA_PLAYER_EYE_HEIGHT };
          if (!hasLineOfSight({ from: eyePoint, to: eyePoint, obstacles, padding })) continue;
          const key = `${ix}:${iz}:${levelIndex}`;
          nodes.set(key, { key, ix, iz, ...eyePoint });
          const coordinateKey = `${ix}:${iz}`;
          const keysAtCoordinate = coordinateKeys.get(coordinateKey) ?? [];
          keysAtCoordinate.push(key);
          coordinateKeys.set(coordinateKey, keysAtCoordinate);
        }
      }
    }
    grid = { nodes, neighborKeys: new Map(), coordinateKeys };
    gridVariants.set(cacheKey, grid);
  }
  const { nodes } = grid;

  const nearestVisible = (point: ArenaPosition) => {
    const ranked = [...nodes.values()]
      .map((node) => ({ node, distance: Math.hypot(node.x - point.x, node.z - point.z) }))
      .sort((a, b) => a.distance - b.distance);
    const visible: typeof ranked = [];
    for (const entry of ranked) {
      if (Math.abs(Number(point.y) - entry.node.y) > 2.5) continue;
      if (!hasLineOfSight({ from: point, to: entry.node, obstacles, padding })) continue;
      visible.push(entry);
      if (visible.length >= 24) break;
    }
    return visible;
  };
  const starts = nearestVisible(start);
  const goalEntries = nearestVisible(goal);
  if (starts.length === 0 || goalEntries.length === 0) return [];

  const goalCosts = new Map(goalEntries.map(({ node, distance }) => [node.key, distance]));
  const open = new Set<string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  for (const { node, distance } of starts) {
    open.add(node.key);
    gScore.set(node.key, distance);
      fScore.set(node.key, distance + Math.hypot(goal.x - node.x, goal.z - node.z, Number(goal.y) - node.y));
  }

  let reachedKey: string | undefined;
  while (open.size > 0) {
    let currentKey: string | undefined;
    let currentScore = Number.POSITIVE_INFINITY;
    for (const key of open) {
      const score = fScore.get(key) ?? Number.POSITIVE_INFINITY;
      if (score < currentScore) {
        currentKey = key;
        currentScore = score;
      }
    }
    if (!currentKey) break;
    if (goalCosts.has(currentKey)) {
      reachedKey = currentKey;
      break;
    }
    open.delete(currentKey);
    const current = nodes.get(currentKey)!;
    let neighborKeys = grid.neighborKeys.get(currentKey);
    if (!neighborKeys) {
      neighborKeys = [];
      for (const [dx, dz] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] as const) {
        const candidateKeys =
          grid.coordinateKeys.get(`${current.ix + dx}:${current.iz + dz}`) ?? [];
        for (const candidateKey of candidateKeys) {
          const neighbor = nodes.get(candidateKey);
          if (!neighbor) continue;
          if (Math.abs(neighbor.y - current.y) > 3.6) continue;
          if (hasLineOfSight({ from: current, to: neighbor, obstacles, padding })) neighborKeys.push(neighbor.key);
        }
      }
      grid.neighborKeys.set(currentKey, neighborKeys);
    }
    for (const neighborKey of neighborKeys) {
      const neighbor = nodes.get(neighborKey)!;
      const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY)
        + Math.hypot(neighbor.x - current.x, neighbor.z - current.z, neighbor.y - current.y);
      if (tentative >= (gScore.get(neighbor.key) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(neighbor.key, currentKey);
      gScore.set(neighbor.key, tentative);
      fScore.set(neighbor.key, tentative + Math.hypot(goal.x - neighbor.x, goal.z - neighbor.z, Number(goal.y) - neighbor.y));
      open.add(neighbor.key);
    }
  }
  if (!reachedKey) return [];

  const rawPath: Array<{ x: number; y?: number; z: number }> = [];
  let pathKey: string | undefined = reachedKey;
  while (pathKey) {
    const node = nodes.get(pathKey);
    if (node) rawPath.unshift({ x: node.x, y: node.y, z: node.z });
    pathKey = cameFrom.get(pathKey);
  }
  rawPath.push({ x: goal.x, y: goal.y, z: goal.z });

  const smoothed: Array<{ x: number; y?: number; z: number }> = [];
  let anchor: ArenaPosition = start;
  let index = 0;
  while (index < rawPath.length) {
    let furthest = index;
    for (let candidate = rawPath.length - 1; candidate >= index; candidate -= 1) {
      if (hasLineOfSight({ from: anchor, to: rawPath[candidate], obstacles, padding })) {
        furthest = candidate;
        break;
      }
    }
    const waypoint = rawPath[furthest];
    smoothed.push(waypoint);
    anchor = waypoint;
    index = furthest + 1;
  }
  return smoothed;
};

export const resolveBotRoamStep = ({
  current,
  desired,
  elapsedMs,
  speed,
  obstacles = ARENA_OBSTACLES,
  detourDirection = 1,
  mapId
}: {
  current: ArenaPosition;
  desired: ArenaPosition;
  elapsedMs: number;
  speed: number;
  obstacles?: readonly ArenaObstacle[];
  detourDirection?: -1 | 1;
  mapId?: ArenaMapId | string;
}): AuthoritativeMovementResult => {
  const direct = resolveAuthoritativeMovement({
    current,
    requested: desired,
    elapsedMs,
    maxSpeed: speed,
    obstacles,
    mapId
  });
  if (!direct.blocked) return direct;

  const dx = desired.x - current.x;
  const dz = desired.z - current.z;
  const distance = Math.hypot(dx, dz);
  const detourDistance = Math.min(distance, Math.max(0, speed * (elapsedMs / 1000)));
  if (distance === 0 || detourDistance === 0) return direct;

  const heading = Math.atan2(dz, dx);
  const preferredOffsets = [
    Math.PI / 2,
    Math.PI / 3,
    Math.PI * 2 / 3,
    Math.PI / 6,
    Math.PI * 5 / 6
  ].map((angle) => angle * detourDirection);
  for (const angleOffset of [
    ...preferredOffsets,
    ...preferredOffsets.map((angle) => -angle),
    Math.PI
  ]) {
    const detour = resolveAuthoritativeMovement({
      current,
      requested: {
        x: current.x + Math.cos(heading + angleOffset) * detourDistance,
        z: current.z + Math.sin(heading + angleOffset) * detourDistance,
        facing: desired.facing
      },
      elapsedMs,
      maxSpeed: speed,
      obstacles,
      mapId
    });
    if (!detour.blocked) return detour;
  }

  return direct;
};

export const resolveBotRespawn = ({
  bot,
  spawn,
  nowMs,
  respawnAtMs,
  startingSnowballs
}: {
  bot: PlayerSession;
  spawn: GroundArenaPosition;
  nowMs: number;
  respawnAtMs?: number;
  startingSnowballs: number;
}): { respawned: false; player: PlayerSession } | { respawned: true; player: PlayerSession } => {
  if (!bot.isBot || bot.isAlive || respawnAtMs === undefined || nowMs < respawnAtMs) {
    return { respawned: false, player: bot };
  }
  return {
    respawned: true,
    player: {
      ...bot,
      ...spawn,
      isAlive: true,
      health: DEFAULT_PLAYER_HEALTH,
      snowballs: startingSnowballs,
      ...( "weapon" in bot || "perks" in bot
        ? { gear: "starter_blaster", weapon: "starter_blaster", perks: [] }
        : {}),
      respawnCorrectAnswers: 0
    }
  };
};

export const resolveTagAction = ({
  attacker,
  target
}: {
  attacker: Pick<PlayerSession, "team" | "isAlive" | "gear" | "weapon" | "x" | "z">;
  target: Pick<PlayerSession, "team" | "isAlive" | "health" | "x" | "z">;
}): TagActionResult => {
  if (!attacker.isAlive) return { ok: false, reason: "attacker_eliminated" };
  if (!target.isAlive) return { ok: false, reason: "target_eliminated" };
  if (attacker.team === target.team) return { ok: false, reason: "same_team" };

  const attackerPosition = { x: attacker.x ?? 0, z: attacker.z ?? 0 };
  const targetPosition = { x: target.x ?? 0, z: target.z ?? 0 };
  const distance = Math.hypot(targetPosition.x - attackerPosition.x, targetPosition.z - attackerPosition.z);
  const weaponId = getPlayerWeaponId(attacker);
  if (distance > getGearRange(weaponId)) return { ok: false, reason: "out_of_range" };

  const damage = getGearDamage(weaponId);
  const nextHealth = Math.max(0, (target.health ?? DEFAULT_PLAYER_HEALTH) - damage);
  const eliminated = nextHealth === 0;
  return {
    ok: true,
    damage,
    nextHealth,
    eliminated,
    moneyAwarded: eliminated ? TAG_OPPONENT_BONUS : 0,
    scoreDelta: eliminated ? TAG_SCORE_DELTA : 0
  };
};

export const randomizeBalancedTeams = <T extends Pick<PlayerSession, "id" | "team">>(
  players: readonly T[],
  seed = Date.now()
): T[] => {
  const eligible = [...players];
  const seededScore = (player: T) => {
    let hash = seed;
    for (let index = 0; index < player.id.length; index += 1) {
      hash = Math.imul(hash ^ player.id.charCodeAt(index), 2654435761);
    }
    return hash >>> 0;
  };
  const shuffled = eligible.sort((a, b) => seededScore(a) - seededScore(b));
  return shuffled.map((player, index) => ({ ...player, team: index % 2 === 0 ? "red" : "blue" }) as T);
};

export const selectLateJoinTeam = (
  players: readonly Pick<PlayerSession, "team">[],
  randomValue = Math.random()
): Team => {
  const blueCount = players.filter((player) => player.team === "blue").length;
  const redCount = players.filter((player) => player.team === "red").length;
  if (blueCount !== redCount) return blueCount < redCount ? "blue" : "red";
  return randomValue < 0.5 ? "blue" : "red";
};

export const createInitialFlagState = (position: ArenaPosition): FlagState => ({
  state: "available",
  teamId: "red",
  position: { x: position.x, z: position.z, ...(position.y !== undefined ? { y: position.y } : {}) }
});

const isPlayerNearFlag = (
  flag: Pick<FlagState, "position">,
  player: Pick<PlayerSession, "x" | "z">
) => Number.isFinite(player.x) && Number.isFinite(player.z)
  && Math.hypot(player.x! - flag.position.x, player.z! - flag.position.z) <= FLAG_INTERACTION_RADIUS;

export const resolveFlagPickup = (
  flag: FlagState,
  player: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "z">
): FlagState => {
  if (!player.isAlive || player.team !== "red" || !["available", "dropped"].includes(flag.state)) return flag;
  if (!isPlayerNearFlag(flag, player)) return flag;
  return { ...flag, state: "carried", carrierId: player.id, capturedById: undefined };
};

export const resolveFlagDropForPlayer = (
  flag: FlagState,
  player: Pick<PlayerSession, "id">,
  position: ArenaPosition
): FlagState => {
  if (flag.state !== "carried" || flag.carrierId !== player.id) return flag;
  return {
    ...flag,
    state: "dropped",
    carrierId: undefined,
    position: { x: position.x, z: position.z, ...(position.y !== undefined ? { y: position.y } : {}) }
  };
};

export const canPlaceFlag = (
  player: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "z">,
  flag: FlagState,
  position: ArenaPosition = { x: player.x ?? 0, z: player.z ?? 0 }
) =>
  player.isAlive &&
  player.team === "red" &&
  flag.state === "carried" &&
  flag.carrierId === player.id &&
  isInsideTeamBase("blue", position);

export const resolveFlagPlacement = ({
  flag,
  player,
  nowMs,
  holdSeconds
}: {
  flag: FlagState;
  player: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "z">;
  nowMs: number;
  holdSeconds: number;
}): FlagState => {
  const position = { x: player.x ?? flag.position.x, z: player.z ?? flag.position.z };
  if (!canPlaceFlag(player, flag, position)) return flag;
  return {
    ...flag,
    state: "placed",
    carrierId: undefined,
    placedById: player.id,
    placedAtMs: nowMs,
    expiresAtMs: nowMs + Math.max(1, holdSeconds) * 1000,
    position
  };
};

export const resolveFlagCapture = (
  flag: FlagState,
  player: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "z">
): FlagState => {
  if (flag.state !== "placed" || player.team !== "blue" || !player.isAlive) return flag;
  if (!isPlayerNearFlag(flag, player)) return flag;
  return { ...flag, state: "captured", capturedById: player.id };
};

export const resolveFlagCountdown = (
  flag: FlagState,
  nowMs: number
): { winner?: Team; reason?: "flag_protected" | "flag_captured" } => {
  if (flag.state === "captured") return { winner: "blue", reason: "flag_captured" };
  if (flag.state === "placed" && flag.expiresAtMs !== undefined && nowMs >= flag.expiresAtMs) {
    return { winner: "red", reason: "flag_protected" };
  }
  return {};
};

export const getDefaultInitialZombieCount = (participantCount: number) => {
  const safeCount = Math.max(0, Math.floor(participantCount));
  if (safeCount <= 1) return safeCount;
  return Math.min(safeCount - 1, Math.max(1, Math.floor(safeCount / 4)));
};

export const selectInitialZombies = <T extends PlayerSession>(
  players: readonly T[],
  requestedCount?: number,
  seed = Date.now()
): T[] => {
  const eligible = players.filter((player) => player.connectionState !== "disconnected");
  const zombieCount = Math.min(
    Math.max(0, requestedCount ?? getDefaultInitialZombieCount(eligible.length)),
    Math.max(0, eligible.length - 1)
  );
  const chosenIds = new Set(randomizeBalancedTeams(eligible, seed).slice(0, zombieCount).map((player) => player.id));
  return players.map((player) => ({
    ...player,
    role: chosenIds.has(player.id) ? "zombie" : "human",
    zombieConvertedAt: undefined,
    team: chosenIds.has(player.id) ? "red" : "blue",
    energy: chosenIds.has(player.id) ? ZOMBIE_HUMAN_MAX_ENERGY : 0,
    gear: chosenIds.has(player.id) ? "starter_blaster" : player.gear,
    weapon: chosenIds.has(player.id) ? "starter_blaster" : player.weapon,
    perks: chosenIds.has(player.id) ? [] : player.perks,
    isAlive: true
  }) as T);
};

export type ZombieConversionResult =
  | { ok: true; player: PlayerSession; tagCredit: number }
  | { ok: false; reason: "attacker_not_zombie" | "target_not_human" | "attacker_eliminated" | "target_eliminated" | "target_not_knocked_out" };

export const resolveZombieConversion = ({
  attacker,
  target
}: {
  attacker: PlayerSession;
  target: PlayerSession;
}): ZombieConversionResult => {
  if (!attacker.isAlive) return { ok: false, reason: "attacker_eliminated" };
  if (!target.isAlive) return { ok: false, reason: "target_eliminated" };
  if (attacker.role !== "zombie") return { ok: false, reason: "attacker_not_zombie" };
  if (target.role !== "human") return { ok: false, reason: "target_not_human" };
  if ((target.health ?? DEFAULT_PLAYER_HEALTH) > 0) return { ok: false, reason: "target_not_knocked_out" };
  return {
    ok: true,
    tagCredit: 1,
    player: {
      ...target,
      role: "zombie",
      team: "red",
      energy: ZOMBIE_HUMAN_MAX_ENERGY,
      gear: "starter_blaster",
      isAlive: true,
      health: DEFAULT_PLAYER_HEALTH,
      snowballs: DEFAULT_SESSION_SETTINGS.startingSnowballs,
      respawns: (target.respawns ?? 0) + 1,
      respawnCorrectAnswers: 0
    }
  };
};

/**
 * Ranks Zombie Mode's strongest survivors. Humans who lasted until time
 * expired rank first, followed by the most recently converted humans. Initial
 * zombies are excluded because they did not survive as humans during the game.
 */
export const getZombieBestPlayers = (players: readonly PlayerSession[], limit = 6): PlayerSession[] => {
  const safeLimit = Math.max(0, Math.floor(limit));
  const humans = players
    .filter((player) => player.role !== "zombie" && player.connectionState !== "disconnected")
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  const converted = players
    .filter((player) => player.role === "zombie" && Boolean(player.zombieConvertedAt))
    .sort((a, b) => Date.parse(b.zombieConvertedAt!) - Date.parse(a.zombieConvertedAt!));
  return [...humans, ...converted].slice(0, safeLimit);
};

export const buildScoreboardRows = (
  players: readonly PlayerSession[],
  localPlayerId?: string
): ScoreboardRow[] =>
  players.map((player) => {
    const questionsCorrect = Math.max(0, player.correctAnswers);
    const questionsAttempted = Math.max(0, player.correctAnswers + player.wrongAnswers);
    const percentage = questionsAttempted === 0 ? 0 : Math.round((questionsCorrect / questionsAttempted) * 100);
    return {
      playerId: player.id,
      displayName: player.nickname,
      teamId: player.team,
      role: player.role,
      tags: player.tags ?? player.score,
      respawns: player.respawns ?? 0,
      questionsCorrect,
      questionsAttempted,
      questionAccuracy: questionsAttempted === 0 ? "-" : `${questionsCorrect} / ${questionsAttempted} (${percentage}%)`,
      connectionState: player.connectionState ?? "connected",
      isBot: player.isBot === true,
      isLocalPlayer: player.id === localPlayerId
    };
  });
