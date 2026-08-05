export type Team = "blue" | "red";
export * from "./protocol/index.js";
export type SessionStatus = "waiting" | "active" | "paused" | "ended";
export type Choice = "A" | "B" | "C" | "D";
export type GameMode = "flag" | "zombie" | "classic";
export type ArenaMapId = "desert_citadel" | "iron_junction" | "temple_runoff";
export type TeamAssignment = "players_choose" | "random";
export type PlayerRole = "human" | "zombie";
export type BotDifficulty = "beginner" | "standard" | "advanced";
export type GameAnnouncementKind = "round_result" | "buy_phase" | "preparation" | "round_start" | "game_over";
export type RoundTransitionPhase = "result" | "preparation" | "zombie_selection" | "buy";
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

export type GameplayAnnouncementKey =
  | "FLAG_PLANTED"
  | "STREAK_HEATING_UP"
  | "STREAK_DOMINATING"
  | "STREAK_UNSTOPPABLE"
  | "STREAK_WICKED_SICK"
  | "STREAK_MONSTER"
  | "STREAK_GODLIKE";

export type FreezeStreakAnnouncementKey = Exclude<GameplayAnnouncementKey, "FLAG_PLANTED">;

export interface FlagPlantedEvent {
  type: "flag_planted";
  eventId: string;
  objectiveId: string;
  plantedByPlayerId: string;
  plantedAt: number;
  expiresAt: number;
}

export interface FreezeStreakAnnouncementEvent {
  type: "freeze_streak_announcement";
  eventId: string;
  playerId: string;
  playerName: string;
  streak: number;
  announcementKey: FreezeStreakAnnouncementKey;
  occurredAt: number;
}

export const FREEZE_STREAK_ANNOUNCEMENTS: Record<
  number,
  { key: FreezeStreakAnnouncementKey; phrase: string }
> = {
  3: { key: "STREAK_HEATING_UP", phrase: "He's heating up!" },
  4: { key: "STREAK_DOMINATING", phrase: "Dominating!" },
  5: { key: "STREAK_UNSTOPPABLE", phrase: "Unstoppable!" },
  6: { key: "STREAK_WICKED_SICK", phrase: "Wicked Sick!" },
  7: { key: "STREAK_MONSTER", phrase: "Muh-Muh-Muh-Monster!" },
  8: { key: "STREAK_GODLIKE", phrase: "Guh-Guh-Guh-Godlike!" }
};
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
  /** Optional teacher-provided audio for reading or pronouncing the question. */
  audioUrl?: string;
  createdAt: string;
}

export const QUESTION_AUDIO_URL_MAX_LENGTH = 2_048;

export const isValidQuestionAudioUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > QUESTION_AUDIO_URL_MAX_LENGTH) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export type PublicQuestion = Omit<Question, "correctChoice">;

export interface QuizSet {
  id: string;
  teacherId: string;
  classId?: string;
  folderId?: string;
  title: string;
  description?: string;
  questions: Question[];
  createdAt: string;
  updatedAt?: string;
}

export interface QuizFolder {
  id: string;
  teacherId: string;
  parentId?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportMetadata {
  id: string;
  teacherId: string;
  sessionId: string;
  sessionCode: string;
  quizSetId?: string;
  quizSetName: string;
  displayName: string;
  createdAt: string;
}

export const APPEARANCE_VERSION = 7 as const;
export const APPEARANCE_MAX_JSON_BYTES = 2048;
export const APPEARANCE_UPDATE_COOLDOWN_MS = 750;
export const DECAL_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const DECAL_MAX_PROCESSED_BYTES = 384 * 1024;
export const DECAL_MAX_DIMENSION = 512;

export const HEAD_STYLE_IDS = [
  "boy_short_hair",
  "girl_mid_hair",
  "fox",
  "panda",
  "bear",
  "rabbit",
  "great_white",
  "robot",
  "samurai",
  "ninja"
] as const;
export const BACK_ACCESSORY_IDS = [
  "none",
  "utility_pack",
  "angel_wings",
  "demon_wings",
  "devil_tail",
  "samurai_sword",
  "twin_swords",
  "boost_pack",
  "arena_cape",
  "snowboard"
] as const;
export const FOOTWEAR_IDS = [
  "runners",
  "army_boots",
  "skate_shoes",
  "basketball_shoes",
  "sandals",
  "barefoot"
] as const;
export const VICTORY_POSE_IDS = [
  "champion",
  "wave",
  "salute",
  "power"
] as const;

export type PlayerHeadStyleId = (typeof HEAD_STYLE_IDS)[number];
export type PlayerBackAccessoryId = (typeof BACK_ACCESSORY_IDS)[number];
export type PlayerFootwearId = (typeof FOOTWEAR_IDS)[number];
export type PlayerVictoryPoseId = (typeof VICTORY_POSE_IDS)[number];
export type CosmeticSlot = "head" | "back" | "footwear" | "pose";

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

export interface FootwearCatalogItem {
  id: PlayerFootwearId;
  name: string;
  description: string;
  visualType: PlayerFootwearId;
  scale: readonly [number, number, number];
  offset: readonly [number, number, number];
  rotation: readonly [number, number, number];
  teamAccent: "subtle" | "balanced" | "strong" | "none";
  unlockLevel: number;
}

export const HEAD_STYLE_CATALOG = [
  { id: "boy_short_hair", name: "Short Hair", description: "A classic starting style", unlockLevel: 1 },
  { id: "girl_mid_hair", name: "Mid-Length Hair", description: "A classic starting style", unlockLevel: 1 },
  { id: "fox", name: "Fox", description: "Bright, quick and confident", unlockLevel: 1 },
  { id: "panda", name: "Panda", description: "Calm mascot energy", unlockLevel: 1 },
  { id: "bear", name: "Bear", description: "Bold and dependable", unlockLevel: 1 },
  { id: "rabbit", name: "Rabbit", description: "Alert and arena-ready", unlockLevel: 1 },
  { id: "great_white", name: "Great White", description: "Calm, bold, and hard to miss", unlockLevel: 1 },
  { id: "robot", name: "Robot", description: "A friendly future style", unlockLevel: 1 },
  { id: "samurai", name: "Samurai", description: "A focused warrior style", unlockLevel: 1 },
  { id: "ninja", name: "Ninja", description: "A quiet, quick style", unlockLevel: 1 }
] as const satisfies ReadonlyArray<HeadStyleCatalogItem>;

export const FOOTWEAR_CATALOG = [
  {
    id: "runners",
    name: "Runners",
    description: "Light and ready to move",
    visualType: "runners",
    scale: [1, 1, 1],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
    teamAccent: "balanced",
    unlockLevel: 1
  },
  {
    id: "army_boots",
    name: "Army Boots",
    description: "A sturdy, grounded style",
    visualType: "army_boots",
    scale: [1, 1, 1],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
    teamAccent: "subtle",
    unlockLevel: 1
  },
  {
    id: "skate_shoes",
    name: "Skate Shoes",
    description: "A relaxed street style",
    visualType: "skate_shoes",
    scale: [1, 1, 1],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
    teamAccent: "subtle",
    unlockLevel: 1
  },
  {
    id: "basketball_shoes",
    name: "Basketball Shoes",
    description: "A bright court style",
    visualType: "basketball_shoes",
    scale: [1, 1, 1],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
    teamAccent: "strong",
    unlockLevel: 1
  },
  {
    id: "sandals",
    name: "Sandals",
    description: "An easygoing summer style",
    visualType: "sandals",
    scale: [1, 1, 1],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
    teamAccent: "balanced",
    unlockLevel: 1
  },
  {
    id: "barefoot",
    name: "Barefoot",
    description: "A simple, barefoot look",
    visualType: "barefoot",
    scale: [1, 1, 1],
    offset: [0, 0, 0],
    rotation: [0, 0, 0],
    teamAccent: "none",
    unlockLevel: 1
  }
] as const satisfies ReadonlyArray<FootwearCatalogItem>;

export const COSMETIC_CATALOG = [
  ...HEAD_STYLE_CATALOG.map((style) => ({ ...style, slot: "head" as const })),
  { id: "none", slot: "back", name: "No Back Gear", description: "Keep it simple", unlockLevel: 1 },
  { id: "utility_pack", slot: "back", name: "Utility Pack", description: "Classic field pack", unlockLevel: 1 },
  { id: "angel_wings", slot: "back", name: "Angel Wings", description: "Take flight", unlockLevel: 1 },
  { id: "demon_wings", slot: "back", name: "Demon Wings", description: "A bold, dramatic look", unlockLevel: 1 },
  { id: "devil_tail", slot: "back", name: "Devil Tail", description: "Mischievous style", unlockLevel: 1 },
  { id: "samurai_sword", slot: "back", name: "Samurai Sword", description: "Warrior style", unlockLevel: 1 },
  { id: "twin_swords", slot: "back", name: "Twin Swords", description: "Double warrior style", unlockLevel: 1 },
  { id: "boost_pack", slot: "back", name: "Boost Pack", description: "Ready for launch", unlockLevel: 1 },
  { id: "arena_cape", slot: "back", name: "Arena Cape", description: "A champion’s finish", unlockLevel: 1 },
  { id: "snowboard", slot: "back", name: "Snowboard", description: "Slope ready", unlockLevel: 1 },
  ...FOOTWEAR_CATALOG.map((footwear) => ({ ...footwear, slot: "footwear" as const })),
  { id: "champion", slot: "pose", name: "Champion", description: "Two-arm celebration", unlockLevel: 1 },
  { id: "wave", slot: "pose", name: "Friendly Wave", description: "A friendly hello", unlockLevel: 1 },
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
  headStyleId: PlayerHeadStyleId;
  backAccessoryId: PlayerBackAccessoryId;
  footwearId: PlayerFootwearId;
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
  catalogItem("footwear", appearance.footwearId),
  catalogItem("pose", appearance.victoryPoseId)
].filter((item): item is (typeof COSMETIC_CATALOG)[number] => Boolean(item && item.unlockLevel > level));

export interface CharacterCustomizationSettings {
  enabled: boolean;
  uploadsEnabled: boolean;
  aiEnabled: boolean;
  persistAcrossSessions: boolean;
}

export const DEFAULT_PLAYER_APPEARANCE: PlayerAppearance = {
  headStyleId: "boy_short_hair",
  backAccessoryId: "none",
  footwearId: "runners",
  victoryPoseId: "champion",
  appearanceVersion: APPEARANCE_VERSION
};

export const DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS: CharacterCustomizationSettings = {
  enabled: true,
  uploadsEnabled: false,
  aiEnabled: false,
  persistAcrossSessions: false
};

const isAllowed = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export const sanitizeCharacterCustomizationSettings = (
  input: (Partial<CharacterCustomizationSettings> & { presetsOnly?: boolean }) | undefined
): CharacterCustomizationSettings => ({
  enabled: typeof input?.enabled === "boolean" ? input.enabled : DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS.enabled,
  uploadsEnabled: typeof input?.uploadsEnabled === "boolean" ? input.uploadsEnabled : DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS.uploadsEnabled,
  aiEnabled: typeof input?.aiEnabled === "boolean" ? input.aiEnabled : DEFAULT_CHARACTER_CUSTOMIZATION_SETTINGS.aiEnabled,
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
  // Versions 1-5 could store the retired Human style or pieces worn by its
  // generic base. Map those records once to Boy, the new neutral default.
  const migratedHeadStyle: PlayerHeadStyleId = "boy_short_hair";
  const legacyAccessory = source.accessoryId;
  const legacyBackAccessory = source.backAccessoryId;
  const migratedBackAccessory: PlayerBackAccessoryId =
    legacyAccessory === "shoulder_badge" ? "none"
      : isAllowed(BACK_ACCESSORY_IDS, legacyBackAccessory) ? legacyBackAccessory
        : legacyBackAccessory === "rocket_pack" ? "boost_pack"
          : legacyBackAccessory === "team_pennant" ? "arena_cape"
            : ["utility_pack", "compact_pack", "tech_pack", "trail_pack", "book_satchel"].includes(String(legacyBackAccessory))
              ? "utility_pack"
        : source.backpackStyle === "radio_pack" ? "utility_pack"
          : source.backpackStyle === "bedroll" ? "utility_pack"
            : source.backpackStyle === "none" ? "none"
              : DEFAULT_PLAYER_APPEARANCE.backAccessoryId;
  return {
    headStyleId: isAllowed(HEAD_STYLE_IDS, source.headStyleId) ? source.headStyleId : migratedHeadStyle,
    backAccessoryId: migratedBackAccessory,
    footwearId: isAllowed(FOOTWEAR_IDS, source.footwearId) ? source.footwearId : "runners",
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
    "headStyleId", "backAccessoryId", "footwearId", "victoryPoseId",
    "decalAssetId", "appearanceVersion"
  ]);
  if (Object.keys(source).some((key) => !allowedKeys.has(key))) return "Appearance contains an unsupported field.";
  if (source.appearanceVersion !== APPEARANCE_VERSION) return "Unsupported appearance version.";
  const checks: Array<[readonly string[], unknown, string]> = [
    [HEAD_STYLE_IDS, source.headStyleId, "head style"],
    [BACK_ACCESSORY_IDS, source.backAccessoryId, "back accessory"],
    [FOOTWEAR_IDS, source.footwearId, "footwear"],
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
  /** Quiz rewards earned since the current round's preparation began. */
  roundQuizMoneyEarned?: number;
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
  /** Opponents frozen during the current round. */
  roundTags?: number;
  respawns?: number;
  /** Practice or bot respawns completed during the current round. */
  roundRespawns?: number;
  /** Server-earned cosmetic progression, portable through a signed progress token. */
  cosmeticXp?: number;
  connectionState?: "connected" | "disconnected";
  x?: number;
  y?: number;
  z?: number;
  facing?: number;
  /** Live visual posture replicated to other arena clients. */
  crouching?: boolean;
  /** True between takeoff and landing for remote jump animation. */
  jumping?: boolean;
  /** Server-owned uninterrupted freeze streak for the current round. */
  freezeStreak?: number;
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
  /** Stable objective identity for authoritative events and late joiners. */
  objectiveId?: string;
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

export const HEAVY_GUN_COST = 9000;
export const HEAVY_GUN_DAMAGE = 80;
export const HEAVY_GUN_COOLDOWN_MS = 1500;
export const HEAVY_GUN_RANGE = 150;
export const HEAVY_GUN_UNSCOPED_HIT_RADIUS = 0.52;
export const HEAVY_GUN_SCOPED_HIT_RADIUS = 0.82;
export const HEAVY_GUN_DEEP_SCOPED_HIT_RADIUS = 0.98;
export const HEAVY_GUN_ZOOM_LEVEL_0_FOV = 72;
export const HEAVY_GUN_ZOOM_LEVEL_1_FOV = 40;
export const HEAVY_GUN_ZOOM_LEVEL_2_FOV = 20;
export const FLAG_INTERACTION_RADIUS = 7;
export const QUICK_BLASTER_RANGE = 48;
export const QUICK_BLASTER_COOLDOWN_MS = 250;
export const STARTER_BLASTER_RANGE = 36;
export const STARTER_BLASTER_DAMAGE = 20;
export const QUICK_BLASTER_DAMAGE = 20;
export const WARM_VEST_HEALTH_BONUS = 70;
export const SPEED_SHOES_HEALTH_BONUS = 30;

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
    damage: STARTER_BLASTER_DAMAGE,
    range: STARTER_BLASTER_RANGE,
    fireCooldownMs: 160
  },
  {
    id: "quick_blaster",
    name: "Quick Snowball Launcher",
    cost: 4000,
    description: "Automatic launcher with a controlled fire rhythm.",
    damage: QUICK_BLASTER_DAMAGE,
    range: QUICK_BLASTER_RANGE,
    fireCooldownMs: QUICK_BLASTER_COOLDOWN_MS,
    autoFire: true
  },
  {
    id: "power_blaster",
    name: "Heavy Snowball Launcher",
    cost: HEAVY_GUN_COST,
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
    description: "+70 warmth for the current round.",
    damage: STARTER_BLASTER_DAMAGE,
    range: STARTER_BLASTER_RANGE,
    fireCooldownMs: 160,
    healthBonus: WARM_VEST_HEALTH_BONUS
  },
  {
    id: "speed_shoes",
    name: "Speed Boots",
    cost: 1500,
    description: "+30 warmth and 30% walk, sprint, and crouch speed.",
    damage: STARTER_BLASTER_DAMAGE,
    range: STARTER_BLASTER_RANGE,
    fireCooldownMs: 160,
    speedBonus: 0.3,
    healthBonus: SPEED_SHOES_HEALTH_BONUS
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

export const isRoundPreparationPhase = (
  session: Pick<GameSession, "status" | "settings" | "roundTransition">
) => session.status === "paused"
  && (session.settings.gameMode === "flag" || session.settings.gameMode === "classic")
  && (session.roundTransition?.phase === "preparation" || session.roundTransition?.phase === "buy");

/** Compatibility alias for clients and saved sessions created before the phase was renamed. */
export const isRoundBuyPhase = isRoundPreparationPhase;

export const isZombieSelectionPhase = (
  session: Pick<GameSession, "status" | "settings" | "roundTransition">
) => session.status === "paused"
  && session.settings.gameMode === "zombie"
  && session.roundTransition?.phase === "zombie_selection";

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
  players: Array<Pick<
    PlayerSession,
    "team" | "tags" | "respawns" | "quizMoneyEarned" | "roundTags" | "roundRespawns" | "roundQuizMoneyEarned"
  >>
): Team | undefined => {
  const totals = players.reduce(
    (result, player) => {
      result[player.team].tags += player.roundTags ?? player.tags ?? 0;
      result[player.team].respawns += player.roundRespawns ?? player.respawns ?? 0;
      result[player.team].quizMoneyEarned += player.roundQuizMoneyEarned ?? player.quizMoneyEarned ?? 0;
      return result;
    },
    {
      blue: { tags: 0, respawns: 0, quizMoneyEarned: 0 },
      red: { tags: 0, respawns: 0, quizMoneyEarned: 0 }
    }
  );
  if (totals.blue.tags !== totals.red.tags) return totals.blue.tags > totals.red.tags ? "blue" : "red";
  if (totals.blue.respawns !== totals.red.respawns) return totals.blue.respawns > totals.red.respawns ? "blue" : "red";
  if (totals.blue.quizMoneyEarned !== totals.red.quizMoneyEarned) {
    return totals.blue.quizMoneyEarned > totals.red.quizMoneyEarned ? "blue" : "red";
  }
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
export const TAG_OPPONENT_BONUS = 400;
export const TAG_SCORE_DELTA = 5;
export const TAG_RANGE = 18;
export const SNOWBALL_HIT_RADIUS = 1.25;
// Raised platforms can sit more than 20 units above nearby ground targets.
// Keep enough vertical aim range for close-range shots between those floors.
export const ARENA_MIN_AIM_PITCH = -1.2;
export const ARENA_MAX_AIM_PITCH = 1.2;
export const clampArenaAimPitch = (pitch: number | undefined) =>
  Number.isFinite(pitch)
    ? Math.max(ARENA_MIN_AIM_PITCH, Math.min(ARENA_MAX_AIM_PITCH, Number(pitch)))
    : 0;
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
export const ARENA_PLAYER_CROUCH_EYE_HEIGHT = 2.65;
export const ARENA_PLAYER_BODY_HEIGHT = 5.02;
export const TEMPLE_RUNOFF_MAIN_LEVEL_Y = 8;
export const TEMPLE_RUNOFF_UPPER_LEVEL_Y = 17;
export const IRON_JUNCTION_LOADING_LEVEL_Y = 8;
export const IRON_JUNCTION_OVERPASS_LEVEL_Y = 18;
// Compatibility aliases for older clients and saved diagnostics.
export const IRON_JUNCTION_HIGHLINE_LEVEL_Y = IRON_JUNCTION_LOADING_LEVEL_Y;
export const IRON_JUNCTION_CATWALK_LEVEL_Y = IRON_JUNCTION_OVERPASS_LEVEL_Y;
export const DESERT_CITADEL_MAIN_LEVEL_Y = 10;
export const DESERT_CITADEL_ROOFTOP_LEVEL_Y = 24;
// Kept as a compatibility alias for older clients and saved diagnostics.
export const DESERT_CITADEL_CITADEL_LEVEL_Y = DESERT_CITADEL_ROOFTOP_LEVEL_Y;

export type ArenaStairFlight = {
  id: string;
  x: number;
  z: number;
  width: number;
  length: number;
  axis: "x" | "z";
  direction: 1 | -1;
  startY: number;
  endY: number;
  steps: number;
};
export type IronJunctionStairFlight = ArenaStairFlight;

/**
 * Shared station stair definitions keep the visible flight, player floor
 * resolver, server movement, and bot navigation on the same authored profile.
 * Every riser is 0.75 units or lower so the FPS controller can climb without
 * jumping while still reading as a real stair.
 */
export const IRON_JUNCTION_STAIR_FLIGHTS = [
  { id: "warehouse-loading-west-stairs", x: -199, z: -57, width: 18, length: 38, axis: "x", direction: 1, startY: 0, endY: IRON_JUNCTION_LOADING_LEVEL_Y, steps: 12 },
  { id: "warehouse-loading-east-stairs", x: -17, z: -57, width: 18, length: 38, axis: "x", direction: -1, startY: 0, endY: IRON_JUNCTION_LOADING_LEVEL_Y, steps: 12 },
  { id: "dispatch-platform-east-stairs", x: 205, z: -70, width: 24, length: 30, axis: "x", direction: -1, startY: 0, endY: IRON_JUNCTION_LOADING_LEVEL_Y, steps: 12 },
  { id: "dispatch-platform-west-stairs", x: 59, z: -70, width: 24, length: 30, axis: "x", direction: 1, startY: 0, endY: IRON_JUNCTION_LOADING_LEVEL_Y, steps: 12 },
  { id: "depot-platform-east-stairs", x: 177, z: 106, width: 20, length: 28, axis: "x", direction: -1, startY: 0, endY: IRON_JUNCTION_LOADING_LEVEL_Y, steps: 12 },
  { id: "junction-transfer-west-stairs", x: -35, z: 25, width: 20, length: 30, axis: "x", direction: 1, startY: 0, endY: IRON_JUNCTION_LOADING_LEVEL_Y, steps: 12 },
  { id: "warehouse-footbridge-stairs", x: -105, z: -101, width: 20, length: 30, axis: "z", direction: 1, startY: IRON_JUNCTION_LOADING_LEVEL_Y, endY: IRON_JUNCTION_OVERPASS_LEVEL_Y, steps: 15 },
  { id: "overpass-east-stairs", x: 150, z: 25, width: 20, length: 50, axis: "x", direction: -1, startY: 0, endY: IRON_JUNCTION_OVERPASS_LEVEL_Y, steps: 24 },
  { id: "depot-footbridge-stairs", x: 80, z: 65, width: 20, length: 60, axis: "z", direction: -1, startY: IRON_JUNCTION_LOADING_LEVEL_Y, endY: IRON_JUNCTION_OVERPASS_LEVEL_Y, steps: 15 }
] as const satisfies readonly IronJunctionStairFlight[];

/**
 * Temple Runoff uses physical stone stairs for every level change. River
 * flights rise 8 units over 12 steps; Upper flights rise 9 units over 14
 * steps. Every riser stays below the controller's 0.8-unit step limit.
 */
export const TEMPLE_RUNOFF_STAIR_FLIGHTS = [
  ...[-136, -52, 55, 136].flatMap((x): ArenaStairFlight[] => [
    { id: `river-stairs-north-${x}`, x, z: -36, width: 28, length: 24, axis: "z", direction: -1, startY: 0, endY: TEMPLE_RUNOFF_MAIN_LEVEL_Y, steps: 12 },
    { id: `river-stairs-south-${x}`, x, z: 36, width: 28, length: 24, axis: "z", direction: 1, startY: 0, endY: TEMPLE_RUNOFF_MAIN_LEVEL_Y, steps: 12 }
  ]),
  { id: "sun-bridge-stairs-north", x: 0, z: -70, width: 36, length: 24, axis: "z", direction: 1, startY: TEMPLE_RUNOFF_MAIN_LEVEL_Y, endY: TEMPLE_RUNOFF_UPPER_LEVEL_Y, steps: 14 },
  { id: "sun-bridge-stairs-south", x: 0, z: 70, width: 36, length: 24, axis: "z", direction: -1, startY: TEMPLE_RUNOFF_MAIN_LEVEL_Y, endY: TEMPLE_RUNOFF_UPPER_LEVEL_Y, steps: 14 },
  { id: "upper-jungle-stairs", x: -133, z: -66, width: 28, length: 30, axis: "x", direction: 1, startY: TEMPLE_RUNOFF_MAIN_LEVEL_Y, endY: TEMPLE_RUNOFF_UPPER_LEVEL_Y, steps: 14 },
  { id: "upper-temple-stairs", x: 133, z: 66, width: 28, length: 30, axis: "x", direction: -1, startY: TEMPLE_RUNOFF_MAIN_LEVEL_Y, endY: TEMPLE_RUNOFF_UPPER_LEVEL_Y, steps: 14 }
] as const satisfies readonly ArenaStairFlight[];

export type ArenaBounds = { limitX: number; limitZ: number };
export const TEMPLE_RUNOFF_BOUNDS: ArenaBounds = {
  limitX: scaleArenaValue(235),
  limitZ: scaleArenaValue(200)
};
export const IRON_JUNCTION_BOUNDS: ArenaBounds = {
  limitX: scaleArenaValue(280),
  limitZ: scaleArenaValue(250)
};
export const DESERT_CITADEL_BOUNDS: ArenaBounds = {
  limitX: scaleArenaValue(250),
  limitZ: scaleArenaValue(180)
};

export const getArenaBounds = (mapId: ArenaMapId | string | undefined): ArenaBounds =>
  mapId === "temple_runoff"
    ? TEMPLE_RUNOFF_BOUNDS
    : mapId === "iron_junction"
      ? IRON_JUNCTION_BOUNDS
      : mapId === "desert_citadel"
        ? DESERT_CITADEL_BOUNDS
        : { limitX: ARENA_LIMIT_X, limitZ: ARENA_LIMIT_Z };

const isInsideRawRect = (
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
) => x >= minX - 1e-6 && x <= maxX + 1e-6 && z >= minZ - 1e-6 && z <= maxZ + 1e-6;

const stairFlightHeight = (
  flights: readonly ArenaStairFlight[],
  rawX: number,
  rawZ: number
): number | undefined => {
  for (const flight of flights) {
    const along = flight.axis === "x" ? rawX : rawZ;
    const across = flight.axis === "x" ? rawZ : rawX;
    const centerAlong = flight.axis === "x" ? flight.x : flight.z;
    const centerAcross = flight.axis === "x" ? flight.z : flight.x;
    if (Math.abs(across - centerAcross) > flight.width / 2 + 1e-6) continue;
    const startAlong = centerAlong - flight.direction * flight.length / 2;
    const progress = ((along - startAlong) * flight.direction) / flight.length;
    if (progress < -1e-6 || progress > 1 + 1e-6) continue;
    if (progress <= 1e-6) return flight.startY;
    const stepIndex = Math.min(
      flight.steps,
      Math.max(1, Math.ceil(progress * flight.steps - 1e-6))
    );
    return Number((
      flight.startY
      + (flight.endY - flight.startY) * (stepIndex / flight.steps)
    ).toFixed(3));
  }
  return undefined;
};

const templeStairHeight = (rawX: number, rawZ: number): number | undefined =>
  stairFlightHeight(TEMPLE_RUNOFF_STAIR_FLIGHTS, rawX, rawZ);

const ironStairHeight = (rawX: number, rawZ: number): number | undefined =>
  stairFlightHeight(IRON_JUNCTION_STAIR_FLIGHTS, rawX, rawZ);

const desertRampHeight = (rawX: number, rawZ: number): number | undefined => {
  // Four broad, orthogonal flights connect the ground to the citadel terrace.
  if (rawX >= -106 && rawX <= -66 && Math.abs(rawZ) <= 15) {
    return Number((DESERT_CITADEL_MAIN_LEVEL_Y * ((rawX + 106) / 40)).toFixed(3));
  }
  if (Math.abs(rawX) <= 15 && rawZ >= -59 && rawZ <= -31) {
    return Number((DESERT_CITADEL_MAIN_LEVEL_Y * ((rawZ + 59) / 28)).toFixed(3));
  }
  if (Math.abs(rawX) <= 15 && rawZ >= 87 && rawZ <= 115) {
    return Number((DESERT_CITADEL_MAIN_LEVEL_Y * ((115 - rawZ) / 28)).toFixed(3));
  }
  if (rawX >= 167 && rawX <= 203 && rawZ >= 55 && rawZ <= 85) {
    return Number((DESERT_CITADEL_MAIN_LEVEL_Y * ((203 - rawX) / 36)).toFixed(3));
  }
  // The bazaar lookout rises directly from the market; the Sun Hall roof rises from the terrace.
  if (rawX >= -216 && rawX <= -146 && rawZ >= 64 && rawZ <= 88) {
    return Number((DESERT_CITADEL_ROOFTOP_LEVEL_Y * ((rawX + 216) / 70)).toFixed(3));
  }
  if (rawX >= 62 && rawX <= 106 && rawZ >= 70 && rawZ <= 92) {
    return Number((DESERT_CITADEL_MAIN_LEVEL_Y + (DESERT_CITADEL_ROOFTOP_LEVEL_Y - DESERT_CITADEL_MAIN_LEVEL_Y)
      * ((rawX - 62) / 44)).toFixed(3));
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
    const stair = ironStairHeight(rawX, rawZ);
    const surfaces = [0];
    if (
      isInsideRawRect(rawX, rawZ, -190, -70, -179, -115)
      || isInsideRawRect(rawX, rawZ, -180, -36, -66, -48)
      || isInsideRawRect(rawX, rawZ, 74, 190, -82, -58)
      || isInsideRawRect(rawX, rawZ, 23, 165, 96, 116)
      || isInsideRawRect(rawX, rawZ, -20, 40, 15, 35)
    ) surfaces.push(IRON_JUNCTION_LOADING_LEVEL_Y);
    // The two solid transfer platforms are intentionally jump-accessible cover.
    // Treat their tops as real support surfaces for both client and server.
    if (
      isInsideRawRect(rawX, rawZ, -182, -128, 11.5, 28.5)
      || isInsideRawRect(rawX, rawZ, 133, 181, 57.5, 74.5)
    ) surfaces.push(2);
    if (
      isInsideRawRect(rawX, rawZ, -105, 125, 15, 35)
      || isInsideRawRect(rawX, rawZ, -71, 71, -21, -7)
      || isInsideRawRect(rawX, rawZ, -115, -95, -86, 15)
      || isInsideRawRect(rawX, rawZ, 109, 129, -62, 15)
    ) surfaces.push(IRON_JUNCTION_OVERPASS_LEVEL_Y);
    if (stair !== undefined) surfaces.push(stair);
    return [...new Set(surfaces)].sort((a, b) => a - b);
  }
  if (mapId === "desert_citadel") {
    const ramp = desertRampHeight(rawX, rawZ);
    if (ramp !== undefined) return [ramp];
    const onCitadelTerrace =
      isInsideRawRect(rawX, rawZ, -66, 66, -31, 87)
      || isInsideRawRect(rawX, rawZ, 49, 167, 26, 114);
    const onBazaarRooftop = isInsideRawRect(rawX, rawZ, -146, -86, 60, 92);
    const onSunHallRooftop = isInsideRawRect(rawX, rawZ, 68, 156, 48, 92);
    // The courtyard and bazaar lookout are solid masses, not playable undercrofts.
    // Sun Hall deliberately retains its main-floor interior beneath the roof.
    if (onBazaarRooftop) return [DESERT_CITADEL_ROOFTOP_LEVEL_Y];
    if (onSunHallRooftop) return [DESERT_CITADEL_MAIN_LEVEL_Y, DESERT_CITADEL_ROOFTOP_LEVEL_Y];
    if (onCitadelTerrace) return [DESERT_CITADEL_MAIN_LEVEL_Y];
    return [0];
  }
  const stair = templeStairHeight(rawX, rawZ);
  if (stair !== undefined) return [stair];

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
 * Temple Runoff has a lower river floor, eight broad river stair flights,
 * four Upper connections, and a raised monument/courtyard tier everywhere else.
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
  if (reachable.length > 0) return reachable[reachable.length - 1];
  // Desert Citadel's raised structures are solid. A ground-level player who
  // probes their footprint must stay on ground so the foundation collider can
  // reject the move instead of being lifted onto the terrace.
  if (mapId === "desert_citadel" && (surfaces[0] ?? 0) >= DESERT_CITADEL_MAIN_LEVEL_Y) return 0;
  return surfaces[0] ?? 0;
};

/**
 * Finds a safe floor only when a Desert Citadel player is already inside a
 * solid raised structure below its lowest legitimate surface. This is recovery,
 * not traversal: callers should apply it to the last accepted position.
 */
export const getArenaRecoveryGroundHeight = (
  mapId: ArenaMapId | string | undefined,
  x: number,
  z: number,
  eyeY: number | undefined,
  eyeHeight = ARENA_PLAYER_EYE_HEIGHT
): number | undefined => {
  if (mapId !== "desert_citadel" || !Number.isFinite(eyeY)) return undefined;
  const surfaces = getArenaFloorSurfaces(mapId, x, z);
  const lowest = surfaces[0] ?? 0;
  const footY = Number(eyeY) - eyeHeight;
  if (
    (lowest === DESERT_CITADEL_MAIN_LEVEL_Y || lowest === DESERT_CITADEL_ROOFTOP_LEVEL_Y)
    && footY < lowest - 1.5
  ) return lowest;
  return undefined;
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
    return groundY >= DESERT_CITADEL_ROOFTOP_LEVEL_Y - 1
      ? "upper"
      : groundY >= DESERT_CITADEL_MAIN_LEVEL_Y - 1 ? "citadel" : "ground";
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
  blue: [-58, -42, -26, 26, 42].flatMap((z, row) =>
    [-232, -223, -214, -205].map((x, column) => ({
      id: `blue-citadel-${row + 1}-${column + 1}`,
      label: "Blue Assembly Court",
      x,
      z,
      facing: -Math.PI / 2
    }))
  ),
  red: [-42, -26, 26, 42, 58].flatMap((z, row) =>
    [232, 223, 214, 205].map((x, column) => ({
      id: `red-citadel-${row + 1}-${column + 1}`,
      label: "Red Assembly Court",
      x,
      z,
      facing: Math.PI / 2
    }))
  )
};

export const TEAM_SPAWNS: Record<Team, SpawnPoint[]> = {
  blue: RAW_TEAM_SPAWNS.blue.map(scaleArenaPosition).map((spawn) => ({
    ...spawn,
    y: ARENA_PLAYER_EYE_HEIGHT
  })),
  red: RAW_TEAM_SPAWNS.red.map(scaleArenaPosition).map((spawn) => ({
    ...spawn,
    y: ARENA_PLAYER_EYE_HEIGHT
  }))
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
  { id: "ffa-west-outer-2", label: "Bazaar Lookout", x: -146, z: 78, y: DESERT_CITADEL_ROOFTOP_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: -2.25 },
  { id: "ffa-west-gate-1", label: "West Gate", x: -116, z: -48, facing: -1.3 },
  { id: "ffa-west-gate-2", label: "West Gate", x: -116, z: 32, facing: -1.85 },
  { id: "ffa-west-wall-1", label: "West Wall Walk", x: -118, z: -4, facing: -1.57 },
  { id: "ffa-west-wall-2", label: "West Wall Walk", x: -126, z: 23, facing: -1.57 },
  { id: "ffa-fort-court-1", label: "Armoury Court", x: -138, z: -22, facing: -1.4 },
  { id: "ffa-fort-court-2", label: "Armoury Court", x: -139, z: 20, facing: -1.7 },
  { id: "ffa-fort-tunnel-1", label: "West Ruins Ramp", x: -100, z: -85, facing: -2.4 },
  { id: "ffa-fort-tower-1", label: "Western Watchtower", x: -96, z: -82, facing: -0.7 },
  { id: "ffa-north-ruins-1", label: "North Ruins", x: -84, z: -128, facing: -0.6 },
  { id: "ffa-north-ruins-2", label: "North Ruins", x: -48, z: -136, facing: -0.25 },
  { id: "ffa-north-ruins-3", label: "Dry Riverbed", x: -12, z: -124, facing: 0.15 },
  { id: "ffa-north-ruins-4", label: "Dry Riverbed", x: 28, z: -136, facing: 0.35 },
  { id: "ffa-north-ruins-5", label: "Broken Bridge", x: 64, z: -124, facing: 0.62 },
  { id: "ffa-north-ruins-6", label: "Ruined Watchtower", x: 112, z: -100, facing: 0.9 },
  { id: "ffa-market-1", label: "Central Market", x: -42, z: -42, facing: -0.6 },
  { id: "ffa-market-2", label: "Central Market", x: -12, z: -70, facing: -0.2 },
  { id: "ffa-market-3", label: "Old Well", x: 24, z: -48, facing: 0.2 },
  { id: "ffa-market-4", label: "Blue Canopy", x: 46, z: -38, facing: 0.58 },
  { id: "ffa-market-5", label: "Citadel Terrace", x: -58, z: -8, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: -1.15 },
  { id: "ffa-market-6", label: "Citadel Terrace", x: -16, z: -20, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: -0.4 },
  { id: "ffa-market-7", label: "Citadel Terrace", x: 16, z: -20, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 0.4 },
  { id: "ffa-market-8", label: "Citadel Terrace", x: 50, z: -8, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 1.15 },
  { id: "ffa-market-9", label: "Fountain Court", x: -38, z: 26, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: -1.85 },
  { id: "ffa-market-10", label: "Fountain Court", x: -4, z: 30, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: Math.PI },
  { id: "ffa-market-11", label: "Fountain Court", x: 28, z: 42, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 2.6 },
  { id: "ffa-market-12", label: "Sun Hall Court", x: 62, z: 28, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 2.2 },
  { id: "ffa-south-homes-1", label: "South Homes", x: -50, z: 100, facing: -2.4 },
  { id: "ffa-south-homes-2", label: "Canal Approach", x: -30, z: 105, facing: -2.8 },
  { id: "ffa-south-homes-3", label: "Canal Road", x: -50, z: 158, facing: Math.PI },
  { id: "ffa-south-homes-4", label: "South Courtyard", x: 24, z: 104, facing: 2.8 },
  { id: "ffa-south-homes-5", label: "Canal Approach", x: 52, z: 130, facing: 2.4 },
  { id: "ffa-south-homes-6", label: "South Homes", x: 104, z: 118, facing: 2.2 },
  { id: "ffa-rooftop-1", label: "Fountain Terrace", x: -58, z: 66, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: -2.15 },
  { id: "ffa-rooftop-2", label: "Fountain Terrace", x: -26, z: 70, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: -2.9 },
  { id: "ffa-rooftop-3", label: "Fountain Terrace", x: 20, z: 70, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 2.9 },
  { id: "ffa-rooftop-4", label: "Sun Hall Terrace", x: 64, z: 66, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 2.15 },
  { id: "ffa-aqueduct-1", label: "West Stair Court", x: -120, z: 0, facing: -1.57 },
  { id: "ffa-aqueduct-2", label: "West Stair Court", x: -112, z: 28, facing: -1.57 },
  { id: "ffa-aqueduct-3", label: "Citadel Court", x: -36, z: 0, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: -1.57 },
  { id: "ffa-aqueduct-4", label: "South Terrace", x: 0, z: 55, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 0 },
  { id: "ffa-aqueduct-5", label: "Citadel Court", x: 36, z: 0, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 1.57 },
  { id: "ffa-aqueduct-6", label: "Aqueduct East", x: 72, z: 0, facing: 1.57 },
  { id: "ffa-aqueduct-7", label: "Aqueduct East", x: 104, z: 0, facing: 1.57 },
  { id: "ffa-east-gate-1", label: "Eastern Gate", x: 116, z: -48, facing: 1.3 },
  { id: "ffa-east-gate-2", label: "Sun Hall Roof", x: 138, z: 58, y: DESERT_CITADEL_ROOFTOP_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 1.85 },
  { id: "ffa-east-wall-1", label: "Eastern Wall", x: 128, z: -4, facing: 1.57 },
  { id: "ffa-east-wall-2", label: "Eastern Wall", x: 126, z: 23, facing: 1.57 },
  { id: "ffa-camp-court-1", label: "Caravan Camp", x: 138, z: -22, facing: 1.4 },
  { id: "ffa-camp-court-2", label: "Caravan Camp", x: 139, z: 20, facing: 1.7 },
  { id: "ffa-east-tunnel-1", label: "East Ruins Ramp", x: 100, z: -85, facing: 2.4 },
  { id: "ffa-east-camp-outer-1", label: "East Camp Outer", x: 146, z: -78, facing: 0.9 },
  { id: "ffa-east-camp-outer-2", label: "Sun Hall Roof", x: 146, z: 78, y: DESERT_CITADEL_ROOFTOP_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 2.25 },
  { id: "ffa-citadel-1", label: "Citadel Terrace", x: -18, z: 54, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: -2.6 },
  { id: "ffa-citadel-2", label: "Citadel Terrace", x: 18, z: 54, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, facing: 2.6 },
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
  { id: "iron-dispatch-platform", label: "Dispatch Platform", x: scaleArenaValue(132), z: scaleArenaValue(-70), radius: scaleArenaValue(20), y: IRON_JUNCTION_LOADING_LEVEL_Y },
  { id: "iron-maintenance-pit", label: "Maintenance Pit", x: scaleArenaValue(104), z: scaleArenaValue(151), radius: scaleArenaValue(22), y: 0 },
  { id: "iron-control-overpass", label: "Junction Overpass", x: scaleArenaValue(24), z: scaleArenaValue(25), radius: scaleArenaValue(18), y: IRON_JUNCTION_OVERPASS_LEVEL_Y },
  { id: "iron-mountain-tunnel", label: "Mountain Service Tunnel", x: scaleArenaValue(-35), z: scaleArenaValue(218), radius: scaleArenaValue(22), y: 0 }
] as const;

export const DESERT_CITADEL_CAPTURE_ZONES = [
  { id: "desert-blue-fountain", label: "Blue Fountain Court", x: 0, z: scaleArenaValue(18), radius: scaleArenaValue(25), y: DESERT_CITADEL_MAIN_LEVEL_Y },
  { id: "desert-grand-bazaar", label: "Grand Bazaar", x: scaleArenaValue(-76), z: scaleArenaValue(78), radius: scaleArenaValue(16), y: 0 },
  { id: "desert-sun-hall", label: "Sun Hall", x: scaleArenaValue(108), z: scaleArenaValue(72), radius: scaleArenaValue(22), y: DESERT_CITADEL_MAIN_LEVEL_Y },
  { id: "desert-broken-aqueduct", label: "Broken Aqueduct", x: 0, z: scaleArenaValue(133), radius: scaleArenaValue(24), y: 0 },
  { id: "desert-palm-ruins", label: "Palm Ruins", x: 0, z: scaleArenaValue(-118), radius: scaleArenaValue(24), y: 0 },
  { id: "desert-rooftops", label: "Bazaar Rooftops", x: scaleArenaValue(-105), z: scaleArenaValue(76), radius: scaleArenaValue(18), y: DESERT_CITADEL_ROOFTOP_LEVEL_Y }
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
  { id: "desert-fountain-scroll", label: "Fountain Scroll", x: 0, z: scaleArenaValue(18), y: DESERT_CITADEL_MAIN_LEVEL_Y + 1.4 },
  { id: "desert-aqueduct-tablet", label: "Aqueduct Tablet", x: 0, z: scaleArenaValue(133), y: 1.4 },
  { id: "desert-rooftop-seal", label: "Rooftop Seal", x: scaleArenaValue(-105), z: scaleArenaValue(76), y: DESERT_CITADEL_ROOFTOP_LEVEL_Y + 1.4 }
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
  blue: { id: "blue-desert-delivery", label: "Blue Assembly Delivery", x: scaleArenaValue(-235), z: scaleArenaValue(58), radius: scaleArenaValue(10), y: 0 },
  red: { id: "red-desert-delivery", label: "Red Assembly Delivery", x: scaleArenaValue(235), z: scaleArenaValue(-58), radius: scaleArenaValue(10), y: 0 }
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
  return {
    x: selected.x,
    z: selected.z,
    facing: selected.facing,
    ...(Number.isFinite(selected.y) ? { y: selected.y } : {})
  };
};

export const TEAM_BASE_ZONES: Record<Team, { minX: number; maxX: number; minZ: number; maxZ: number }> = {
  blue: { minX: scaleArenaValue(-246), maxX: scaleArenaValue(-194), minZ: scaleArenaValue(-75), maxZ: scaleArenaValue(75) },
  red: { minX: scaleArenaValue(194), maxX: scaleArenaValue(246), minZ: scaleArenaValue(-75), maxZ: scaleArenaValue(75) }
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

export const SPAWN_SHOP_RADIUS = scaleArenaValue(18);

export const isNearTeamSpawn = (
  team: Team,
  position: ArenaPosition | undefined,
  mapId?: ArenaMapId | string,
  radius = SPAWN_SHOP_RADIUS
) => Boolean(
  position
  && Number.isFinite(position.x)
  && Number.isFinite(position.z)
  && getTeamSpawnsForMap(mapId)[team].some(
    (spawn) => Math.hypot(position.x - spawn.x, position.z - spawn.z) <= Math.max(0, radius)
  )
);

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
  DEFAULT_PLAYER_HEALTH + (hasPlayerPerk(player, "shield_vest") ? (getGearItem("shield_vest")?.healthBonus ?? 0) : 0)
    + (hasPlayerPerk(player, "speed_shoes") ? (getGearItem("speed_shoes")?.healthBonus ?? 0) : 0);

export const getPlayerMoveSpeedMultiplier = (player: Pick<PlayerSession, "gear" | "weapon" | "perks">): number =>
  Number((getGearMoveSpeedMultiplier(getPlayerWeaponId(player)) * (hasPlayerPerk(player, "speed_shoes") ? getGearMoveSpeedMultiplier("speed_shoes") : 1)).toFixed(2));

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
  // Perimeter architecture.
  rectObstacle("north-cliff-west", -150, -178, 200, 8, false, 0, 11),
  rectObstacle("north-cliff-east", 150, -178, 200, 8, false, 0, 13),
  rectObstacle("south-wall-west", -150, 178, 200, 8, false, 0, 12),
  rectObstacle("south-wall-east", 150, 178, 200, 8, false, 0, 12),
  rectObstacle("west-city-wall-north", -248, -112, 8, 132, false, 0, 15),
  rectObstacle("west-city-wall-south", -248, 112, 8, 132, false, 0, 15),
  rectObstacle("east-city-wall-north", 248, -112, 8, 132, false, 0, 15),
  rectObstacle("east-city-wall-south", 248, 112, 8, 132, false, 0, 15),

  // Blue and Red assembly courts remain on the ground plane.
  rectObstacle("blue-base-back", -240, 0, 5, 126, false, 0, 13),
  rectObstacle("blue-base-north", -233, -74, 26, 5, false, 0, 10),
  rectObstacle("blue-base-south", -233, 74, 26, 5, false, 0, 10),
  rectObstacle("blue-objective-pavilion", -226, 0, 20, 28, false, 0, 8),
  rectObstacle("blue-base-cover", -185, -56, 22, 5, false, 0, 7),
  rectObstacle("red-base-back", 240, 0, 5, 126, false, 0, 13),
  rectObstacle("red-base-north", 233, -74, 26, 5, false, 0, 10),
  rectObstacle("red-base-south", 233, 74, 26, 5, false, 0, 10),
  rectObstacle("red-objective-pavilion", 226, 0, 20, 28, false, 0, 8),
  rectObstacle("red-base-cover", 185, 56, 22, 5, false, 0, 7),

  // Landmark gates and the main courtyard.
  rectObstacle("lion-gate-north-pier", -174, -26, 10, 12, false, 0, 17),
  rectObstacle("lion-gate-south-pier", -174, 26, 10, 12, false, 0, 17),
  rectObstacle("lion-gate-lintel", -174, 0, 10, 40, false, 14, 18),
  rectObstacle("sun-gate-north-pier", 174, -26, 10, 12, false, 0, 17),
  rectObstacle("sun-gate-south-pier", 174, 26, 10, 12, false, 0, 17),
  rectObstacle("sun-gate-lintel", 174, 0, 10, 40, false, 14, 18),
  rectObstacle("court-foundation", 0, 28, 132, 118, false, 0, 9.35),
  rectObstacle("hall-foundation", 108, 70, 118, 88, false, 0, 9.35),
  rectObstacle("court-parapet-north-west", -40.5, -29.5, 51, 3, false, DESERT_CITADEL_MAIN_LEVEL_Y, 13),
  rectObstacle("court-parapet-north-east", 40.5, -29.5, 51, 3, false, DESERT_CITADEL_MAIN_LEVEL_Y, 13),
  rectObstacle("court-parapet-west-north", -64.5, -23, 3, 16, false, DESERT_CITADEL_MAIN_LEVEL_Y, 13),
  rectObstacle("court-parapet-west-south", -64.5, 51, 3, 72, false, DESERT_CITADEL_MAIN_LEVEL_Y, 13),
  rectObstacle("court-parapet-south-west", -40.5, 85.5, 51, 3, false, DESERT_CITADEL_MAIN_LEVEL_Y, 13),
  rectObstacle("court-parapet-south-east", 32, 85.5, 34, 3, false, DESERT_CITADEL_MAIN_LEVEL_Y, 13),
  rectObstacle("citadel-west-guide-north", -86, -16.5, 40, 3, false, 0, 13),
  rectObstacle("citadel-west-guide-south", -86, 16.5, 40, 3, false, 0, 13),
  rectObstacle("citadel-north-guide-west", -16.5, -45, 3, 28, false, 0, 13),
  rectObstacle("citadel-north-guide-east", 16.5, -45, 3, 28, false, 0, 13),
  rectObstacle("citadel-south-guide-west", -16.5, 101, 3, 28, false, 0, 13),
  rectObstacle("citadel-south-guide-east", 16.5, 101, 3, 28, false, 0, 13),
  rectObstacle("citadel-east-guide-north", 185, 53.5, 36, 3, false, 0, 13),
  rectObstacle("citadel-east-guide-south", 185, 86.5, 36, 3, false, 0, 13),
  rectObstacle("bazaar-lookout-guide-north", -181, 62.5, 70, 3, false, 0, 26),
  rectObstacle("bazaar-lookout-guide-south", -181, 89.5, 70, 3, false, 0, 26),
  rectObstacle("sun-hall-roof-guide-north", 84, 68.5, 44, 3, false, DESERT_CITADEL_MAIN_LEVEL_Y, 26),
  rectObstacle("sun-hall-roof-guide-south", 84, 93.5, 44, 3, false, DESERT_CITADEL_MAIN_LEVEL_Y, 26),
  rectObstacle("court-broken-wall-west", -55, 18, 6, 23, true, DESERT_CITADEL_MAIN_LEVEL_Y, 15),
  rectObstacle("court-broken-wall-east", 55, -18, 6, 23, true, DESERT_CITADEL_MAIN_LEVEL_Y, 15),
  rectObstacle("court-monument", 25, 26, 9, 14, false, DESERT_CITADEL_MAIN_LEVEL_Y, 17),
  rectObstacle("court-planter", -27, -24, 15, 9, true, DESERT_CITADEL_MAIN_LEVEL_Y, 13),
  circleObstacle("blue-fountain-rim", 0, 0, 12, false, DESERT_CITADEL_MAIN_LEVEL_Y, 12.4),

  // Bazaar and fortress interiors.
  rectObstacle("bazaar-north-shops-west", -145, 49, 50, 12, false, 0, 10),
  rectObstacle("bazaar-north-shops-east", -114, 49, 40, 12, false, 0, 9),
  rectObstacle("bazaar-south-shops-west", -145, 105, 50, 12, false, 0, 9),
  rectObstacle("bazaar-south-shops-east", -114, 105, 40, 12, false, 0, 10),
  rectObstacle("bazaar-stall-west", -150, 80, 15, 6, true, 0, 3),
  rectObstacle("bazaar-stall-east", -62, 96, 15, 6, true, 0, 3),
  rectObstacle("bazaar-lookout-mass", -116, 76, 60, 32, false, 0, 23.4),
  rectObstacle("sun-hall-north-west", 85, 28, 38, 5, false, DESERT_CITADEL_MAIN_LEVEL_Y, 25),
  rectObstacle("sun-hall-north-east", 143.5, 28, 47, 5, false, DESERT_CITADEL_MAIN_LEVEL_Y, 25),
  rectObstacle("sun-hall-south-west", 82, 110, 34, 7, false, DESERT_CITADEL_MAIN_LEVEL_Y, 24),
  rectObstacle("sun-hall-south-east", 145, 110, 27, 7, false, DESERT_CITADEL_MAIN_LEVEL_Y, 24),
  rectObstacle("sun-hall-east-north", 164, 40, 7, 28, false, DESERT_CITADEL_MAIN_LEVEL_Y, 24),
  rectObstacle("sun-hall-east-south", 164, 100, 7, 28, false, DESERT_CITADEL_MAIN_LEVEL_Y, 24),
  rectObstacle("sun-hall-guard-room", 124, 76, 24, 20, false, DESERT_CITADEL_MAIN_LEVEL_Y, 18),
  rectObstacle("sun-tower-base", 63, -35, 19, 19, false, DESERT_CITADEL_MAIN_LEVEL_Y, 30),
  circleObstacle("sun-hall-column-west", 96, 58, 3, false, DESERT_CITADEL_MAIN_LEVEL_Y, 23),
  circleObstacle("sun-hall-column-east", 142, 91, 3, false, DESERT_CITADEL_MAIN_LEVEL_Y, 23),

  // Palm Ruins use low cover and short sightline blockers.
  rectObstacle("ruins-wall-west", -155, -123, 48, 7, false, 0, 6),
  rectObstacle("ruins-foundation-west", -92, -99, 34, 18, true, 0, 3),
  rectObstacle("ruins-arch-center-west", -34, -132, 20, 8, false, 0, 7),
  rectObstacle("ruins-wall-center", 26, -105, 44, 7, true, 0, 5),
  rectObstacle("ruins-foundation-east", 92, -139, 32, 20, true, 0, 3),
  rectObstacle("ruins-wall-east", 154, -110, 44, 7, false, 0, 6),
  rectObstacle("ruins-broken-tower", 205, -122, 18, 18, false, 0, 18),

  // Canal and Founders' Passage remain ground-level route families.
  rectObstacle("canal-north-bank-west", -155, 119, 90, 5, false, 0, 5),
  rectObstacle("canal-north-bank-center", 0, 119, 80, 5, false, 0, 5),
  rectObstacle("canal-north-bank-east", 155, 119, 90, 5, false, 0, 5),
  rectObstacle("canal-south-bank-west", -155, 147, 90, 5, false, 0, 5),
  rectObstacle("canal-south-bank-center", 0, 147, 80, 5, false, 0, 5),
  rectObstacle("canal-south-bank-east", 155, 147, 90, 5, false, 0, 5),
  // Upper-level counterplay screens and parapets.
  rectObstacle("bazaar-roof-screen", -92, 76, 8, 18, false, DESERT_CITADEL_ROOFTOP_LEVEL_Y, DESERT_CITADEL_ROOFTOP_LEVEL_Y + 5),
  rectObstacle("sun-hall-roof-screen", 132, 68, 8, 16, false, DESERT_CITADEL_ROOFTOP_LEVEL_Y, DESERT_CITADEL_ROOFTOP_LEVEL_Y + 5),
  rectObstacle("bazaar-roof-rail-north", -116, 61.5, 60, 3, false, DESERT_CITADEL_ROOFTOP_LEVEL_Y, 27),
  rectObstacle("bazaar-roof-rail-south", -116, 90.5, 60, 3, false, DESERT_CITADEL_ROOFTOP_LEVEL_Y, 27),
  rectObstacle("bazaar-roof-rail-east", -87.5, 76, 3, 32, false, DESERT_CITADEL_ROOFTOP_LEVEL_Y, 27),
  rectObstacle("sun-roof-rail-north", 112, 49.5, 88, 3, false, DESERT_CITADEL_ROOFTOP_LEVEL_Y, 27),
  rectObstacle("sun-roof-rail-south", 132, 90.5, 48, 3, false, DESERT_CITADEL_ROOFTOP_LEVEL_Y, 27),
  rectObstacle("sun-roof-rail-east", 154.5, 70, 3, 44, false, DESERT_CITADEL_ROOFTOP_LEVEL_Y, 27),
  rectObstacle("sun-roof-rail-west-north", 69.5, 59, 3, 22, false, DESERT_CITADEL_ROOFTOP_LEVEL_Y, 27)
];

/** Simplified collision proxies for the Iron Junction props and architecture. */
export const IRON_JUNCTION_OBSTACLES: ArenaObstacle[] = [
  rectObstacle("iron-north-cliff", 0, -246, 560, 8, false, 0, 24),
  rectObstacle("iron-south-cliff", 0, 246, 560, 8, false, 0, 30),
  rectObstacle("iron-west-cliff", -276, 0, 8, 500, false, 0, 22),
  rectObstacle("iron-east-cliff", 276, 0, 8, 500, false, 0, 22),

  rectObstacle("blue-base-inner-north", -218, -92, 8, 42, false, 0, 14),
  rectObstacle("blue-warehouse-stair-gate-north", -218, -68.5, 8, 3, false, 0, 14),
  rectObstacle("blue-warehouse-stair-gate-south", -218, -45, 8, 4, false, 0, 14),
  rectObstacle("blue-base-inner-center", -218, 0, 8, 38, false, 0, 14),
  rectObstacle("blue-base-inner-midsouth", -218, 55, 8, 16, false, 0, 14),
  rectObstacle("blue-base-inner-south", -218, 92, 8, 42, false, 0, 14),
  rectObstacle("blue-base-sight-screen-north", -198, -34, 28, 7, false, 0, 9),
  rectObstacle("blue-base-sight-screen-south", -198, 58, 28, 7, false, 0, 9),
  rectObstacle("blue-objective-booth", -247, 0, 28, 32, false, 0, 10),
  rectObstacle("red-base-inner-north", 218, -98, 8, 30, false, 0, 14),
  rectObstacle("red-dispatch-stair-gate-south", 218, -51, 8, 8, false, 0, 14),
  rectObstacle("red-base-inner-center", 218, 0, 8, 38, false, 0, 14),
  rectObstacle("red-base-inner-midsouth", 218, 55, 8, 16, false, 0, 14),
  rectObstacle("red-base-inner-south", 218, 92, 8, 42, false, 0, 14),
  rectObstacle("red-base-sight-screen-north", 198, -34, 28, 7, false, 0, 9),
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

  rectObstacle("depot-east-wall-south", 190, 163.5, 8, 91, false, 0, 18),
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
  rectObstacle("overpass-north-rail-west", -72, 15, 44, 1.2, false, 18, 20.5),
  rectObstacle("overpass-north-rail-center", 5, 15, 70, 1.2, false, 18, 20.5),
  rectObstacle("overpass-north-rail-east", 83.5, 15, 47, 1.2, false, 18, 20.5),
  rectObstacle("overpass-south-rail-west", -77.5, 35, 55, 1.2, false, 18, 20.5),
  rectObstacle("overpass-south-rail-center", 5, 35, 70, 1.2, false, 18, 20.5),
  rectObstacle("overpass-south-rail-depot-west", 64, 35, 8, 1.2, false, 18, 20.5),
  rectObstacle("overpass-south-rail-depot-east", 108.5, 35, 33, 1.2, false, 18, 20.5),
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
  rectObstacle("sun-bridge-altar-north", -7, -16, 10, 9, true, 17, 22),
  rectObstacle("sun-bridge-altar-south", 7, 16, 10, 9, true, 17, 22),
  rectObstacle("upper-jungle-balustrade", -75, -82, 56, 4, false, 17, 21),
  rectObstacle("upper-temple-balustrade", 75, 82, 56, 4, false, 17, 21),
  rectObstacle("blue-temple-gatehouse", -204, -92, 28, 42, false, 8, 23),
  rectObstacle("blue-temple-foundation", -204, 83, 30, 52, false, 8, 20),
  rectObstacle("red-temple-gatehouse", 204, 92, 28, 42, false, 8, 23),
  rectObstacle("red-temple-foundation", 204, -83, 30, 52, false, 8, 20),
  rectObstacle("blue-jungle-spawn-screen", -174, -154, 8, 30, false, 8, 17),
  rectObstacle("blue-canal-spawn-screen", -174, -52, 8, 24, false, 8, 16),
  rectObstacle("blue-rain-spawn-screen", -174, 48, 8, 24, false, 8, 16),
  rectObstacle("blue-temple-spawn-screen", -174, 154, 8, 30, false, 8, 17),
  rectObstacle("red-jungle-spawn-screen", 174, -154, 8, 30, false, 8, 17),
  rectObstacle("red-canal-spawn-screen", 174, -52, 8, 24, false, 8, 16),
  rectObstacle("red-rain-spawn-screen", 174, 48, 8, 24, false, 8, 16),
  rectObstacle("red-temple-spawn-screen", 174, 154, 8, 30, false, 8, 17),
  rectObstacle("jungle-ruin-wall", -98, -132, 54, 8, false, 8, 18),
  rectObstacle("jungle-root-cover", -42, -116, 22, 9, true, 8, 13),
  rectObstacle("north-collapsed-sanctum", 76, -132, 42, 16, false, 8, 20),
  rectObstacle("jungle-arcade-pier-west", -68, -88, 10, 34, false, 8, 16),
  rectObstacle("jungle-arcade-pier-east", 28, -70, 10, 30, false, 8, 16),
  rectObstacle("rain-court-wall-west", -90, 112, 44, 8, false, 8, 17),
  rectObstacle("rain-court-wall-east", 82, 118, 48, 8, false, 8, 17),
  rectObstacle("rain-court-planter", 18, 125, 24, 12, true, 8, 11.5),
  rectObstacle("rain-arcade-pier-west", -28, 70, 10, 30, false, 8, 16),
  rectObstacle("rain-arcade-pier-east", 68, 88, 10, 34, false, 8, 16),
  rectObstacle("lower-broken-pillar", -72, 2, 10, 12, false, 0, 5.5),
  rectObstacle("lower-collapsed-wall", 58, 17, 24, 7, true, 0, 4.5),
  rectObstacle("lower-submerged-ruin", 150, 7, 20, 10, true, 0, 3.2),
  rectObstacle("lower-west-sluice-cover", -166, 10, 14, 8, false, 0, 5),
  rectObstacle("lower-west-tablet-cover", -24, -12, 16, 8, true, 0, 4.5),
  rectObstacle("lower-east-tablet-cover", 102, -11, 16, 8, true, 0, 4.5),
  rectObstacle("lower-east-sluice-cover", 184, 11, 12, 8, false, 0, 5),
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
  const purchasePosition = {
    x: player.x ?? getTeamSpawnForMap(mapId, player.team).x,
    z: player.z ?? getTeamSpawnForMap(mapId, player.team).z
  };
  if (requireBase
    && !isInsideTeamBase(player.team, purchasePosition, mapId)
    && !isNearTeamSpawn(player.team, purchasePosition, mapId)) {
    return { ok: false, reason: "outside_base" };
  }
  if (player.money < gear.cost) return { ok: false, reason: "not_enough_money" };
  const nextPerks = isPerkGearId(gear.id) ? [...getPlayerPerks(player), gear.id] : getPlayerPerks(player);
  const nextHealth = gear.healthBonus
    ? Math.min(
        getPlayerHealthMax({ ...player, perks: nextPerks }),
        (player.health ?? DEFAULT_PLAYER_HEALTH) + gear.healthBonus
      )
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

const segmentRectIntersectionInterval = (
  start: ArenaPosition,
  end: ArenaPosition,
  obstacle: Extract<ArenaObstacle, { kind: "rect" }>,
  padding = 0
): [number, number] | undefined => {
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
      if (origin < min || origin > max) return undefined;
      continue;
    }
    const inverse = 1 / delta;
    let t1 = (min - origin) * inverse;
    let t2 = (max - origin) * inverse;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return undefined;
  }
  return [tMin, tMax];
};

const segmentCircleIntersectionInterval = (
  start: ArenaPosition,
  end: ArenaPosition,
  obstacle: Extract<ArenaObstacle, { kind: "circle" }>,
  padding = 0
): [number, number] | undefined => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const offsetX = start.x - obstacle.x;
  const offsetZ = start.z - obstacle.z;
  const radius = obstacle.radius + padding;
  const a = dx * dx + dz * dz;
  if (a <= 0.000001) {
    return offsetX * offsetX + offsetZ * offsetZ <= radius * radius
      ? [0, 1]
      : undefined;
  }
  const b = 2 * (offsetX * dx + offsetZ * dz);
  const c = offsetX * offsetX + offsetZ * offsetZ - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return undefined;
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  const tMin = Math.max(0, Math.min(first, second));
  const tMax = Math.min(1, Math.max(first, second));
  return tMin <= tMax ? [tMin, tMax] : undefined;
};

const segmentIntersectsObstacle = (start: ArenaPosition, end: ArenaPosition, obstacle: ArenaObstacle, padding = 0) => {
  const horizontalInterval = obstacle.kind === "rect"
    ? segmentRectIntersectionInterval(start, end, obstacle, padding)
    : segmentCircleIntersectionInterval(start, end, obstacle, padding);
  if (!horizontalInterval) return false;
  if (!Number.isFinite(start.y) || !Number.isFinite(end.y)) return true;

  const [tMin, tMax] = horizontalInterval;
  const startY = Number(start.y);
  const dy = Number(end.y) - startY;
  const entryY = startY + dy * tMin;
  const exitY = startY + dy * tMax;
  const intervalMinY = Math.min(entryY, exitY);
  const intervalMaxY = Math.max(entryY, exitY);
  if (Number.isFinite(obstacle.minY) && intervalMaxY < Number(obstacle.minY)) return false;
  if (Number.isFinite(obstacle.maxY) && intervalMinY > Number(obstacle.maxY)) return false;
  return true;
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
    alongSecond: secondLengthSquared > Number.EPSILON ? secondAmount : 1,
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
  hitRadius = SNOWBALL_HIT_RADIUS,
  aimPitch
}: {
  attacker: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "y" | "z" | "facing">;
  candidates: Array<
    Pick<PlayerSession, "id" | "team" | "isAlive" | "connectionState" | "x" | "y" | "z" | "isBot" | "crouching">
    & { previousX?: number; previousY?: number; previousZ?: number }
  >;
  requestedTargetId?: string;
  obstacles?: readonly ArenaObstacle[];
  range?: number;
  hitRadius?: number;
  aimPitch?: number;
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
  const pitch = clampArenaAimPitch(aimPitch);
  const horizontalAim = Math.cos(pitch);
  const direction = {
    x: -Math.sin(origin.facing ?? 0) * horizontalAim,
    y: Math.sin(pitch),
    z: -Math.cos(origin.facing ?? 0) * horizontalAim
  };

  let selected: { id: string; alongShot: number; distance: number } | undefined;
  let blockedByCover = false;
  for (const candidate of candidates) {
    if (candidate.id === attacker.id) continue;
    if (requestedTargetId && candidate.id !== requestedTargetId) continue;
    if (candidate.connectionState === "disconnected" || !candidate.isAlive || candidate.team === attacker.team) continue;
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
    const alongShot = rewoundHit.alongFirst * range;
    const shotY = origin.y + direction.y * alongShot;
    const targetEyeHeight = candidate.crouching === true
      ? ARENA_PLAYER_CROUCH_EYE_HEIGHT
      : ARENA_PLAYER_EYE_HEIGHT;
    const rewoundEyeY = previousTarget.y
      + (target.y - previousTarget.y) * rewoundHit.alongSecond;
    const targetBodyMinY = rewoundEyeY - targetEyeHeight + 0.08;
    const targetBodyMaxY = targetBodyMinY + ARENA_PLAYER_BODY_HEIGHT;
    const verticalDistance = shotY < targetBodyMinY
      ? targetBodyMinY - shotY
      : shotY > targetBodyMaxY
        ? shotY - targetBodyMaxY
        : 0;
    const hit = {
      alongShot,
      distance: Math.hypot(rewoundHit.distance, verticalDistance)
    };
    if (hit.alongShot < 0 || hit.alongShot > range || hit.distance > hitRadius) continue;
    const shotPoint = {
      x: origin.x + direction.x * hit.alongShot,
      y: shotY,
      z: origin.z + direction.z * hit.alongShot
    };
    if (!hasLineOfSight({ from: origin, to: shotPoint, obstacles })) {
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
  eyeHeight = ARENA_PLAYER_EYE_HEIGHT,
  mapId
}: {
  current: ArenaPosition;
  requested: ArenaPosition;
  elapsedMs: number;
  maxSpeed: number;
  obstacles?: readonly ArenaObstacle[];
  radius?: number;
  groundY?: number;
  eyeHeight?: number;
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
        ...(Number.isFinite(from.y) && Number.isFinite(to.y)
          ? { y: Number(from.y) + (Number(to.y) - Number(from.y)) * (maxDistance / distance) }
          : Number.isFinite(to.y) ? { y: to.y } : {}),
        facing: to.facing
      }, mapId)
    : to;

  const canClearJumpable = (obstacle: ArenaObstacle) => obstacle.jumpable === true && Number(to.y) - groundY >= 5;
  const movementIsBlocked = (start: ArenaPosition, end: ArenaPosition) => obstacles.some((obstacle) => {
    const eyeY = Number.isFinite(end.y) ? Number(end.y) : groundY + eyeHeight;
    const bodyMinY = eyeY - eyeHeight;
    const bodyMaxY = bodyMinY + ARENA_PLAYER_BODY_HEIGHT;
    const verticalContactTolerance = 0.1;
    if (Number.isFinite(obstacle.minY) && bodyMaxY <= Number(obstacle.minY) + verticalContactTolerance) return false;
    if (Number.isFinite(obstacle.maxY) && bodyMinY >= Number(obstacle.maxY) - verticalContactTolerance) return false;
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
  const hasNavigationClearance = (from: ArenaPosition, to: ArenaPosition) => {
    if (!hasLineOfSight({ from, to, obstacles, padding })) return false;
    if (!Number.isFinite(from.y) || !Number.isFinite(to.y)) return true;
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const sampleCount = Math.max(1, Math.ceil(distance / 3));
    for (let sample = 0; sample <= sampleCount; sample += 1) {
      const progress = sample / sampleCount;
      const eyeY = Number(from.y) + (Number(to.y) - Number(from.y)) * progress;
      const footY = eyeY - ARENA_PLAYER_EYE_HEIGHT;
      const point = {
        x: from.x + (to.x - from.x) * progress,
        z: from.z + (to.z - from.z) * progress
      };
      // Eye-level line-of-sight above catches tall and overhead architecture;
      // this foot sample adds the low cover that would stop the player's body.
      if (obstacles.some((obstacle) => pointInsideObstacle({ ...point, y: footY + 0.08 }, obstacle, padding))) return false;
    }
    return true;
  };
  if (Math.abs(Number(start.y) - Number(goal.y)) <= 1.5 && hasNavigationClearance(start, goal)) {
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
          if (!hasNavigationClearance(eyePoint, eyePoint)) continue;
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
      if (!hasNavigationClearance(point, entry.node)) continue;
      visible.push(entry);
      if (visible.length >= 24) break;
    }
    return visible;
  };
  const starts = nearestVisible(start);
  const goalEntries = nearestVisible(goal);
  if (starts.length === 0 || goalEntries.length === 0) return [];

  const goalCosts = new Map(goalEntries.map(({ node, distance }) => [node.key, distance]));
  type OpenEntry = { key: string; score: number };
  const open: OpenEntry[] = [];
  const pushOpen = (entry: OpenEntry) => {
    open.push(entry);
    let entryIndex = open.length - 1;
    while (entryIndex > 0) {
      const parentIndex = Math.floor((entryIndex - 1) / 2);
      if (open[parentIndex].score <= entry.score) break;
      open[entryIndex] = open[parentIndex];
      entryIndex = parentIndex;
    }
    open[entryIndex] = entry;
  };
  const popOpen = (): OpenEntry | undefined => {
    const first = open[0];
    const last = open.pop();
    if (!first || !last || open.length === 0) return first;
    let entryIndex = 0;
    while (true) {
      const leftIndex = entryIndex * 2 + 1;
      const rightIndex = leftIndex + 1;
      if (leftIndex >= open.length) break;
      const childIndex = rightIndex < open.length && open[rightIndex].score < open[leftIndex].score
        ? rightIndex
        : leftIndex;
      if (open[childIndex].score >= last.score) break;
      open[entryIndex] = open[childIndex];
      entryIndex = childIndex;
    }
    open[entryIndex] = last;
    return first;
  };
  const closed = new Set<string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  for (const { node, distance } of starts) {
    gScore.set(node.key, distance);
    const score = distance + Math.hypot(goal.x - node.x, goal.z - node.z, Number(goal.y) - node.y);
    fScore.set(node.key, score);
    pushOpen({ key: node.key, score });
  }

  let reachedKey: string | undefined;
  while (open.length > 0) {
    const currentEntry = popOpen();
    if (!currentEntry) break;
    const currentKey = currentEntry.key;
    if (
      closed.has(currentKey)
      || currentEntry.score > (fScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 0.000001
    ) continue;
    if (goalCosts.has(currentKey)) {
      reachedKey = currentKey;
      break;
    }
    closed.add(currentKey);
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
          if (hasNavigationClearance(current, neighbor)) neighborKeys.push(neighbor.key);
        }
      }
      grid.neighborKeys.set(currentKey, neighborKeys);
    }
    for (const neighborKey of neighborKeys) {
      const neighbor = nodes.get(neighborKey);
      if (!neighbor || closed.has(neighborKey)) continue;
      const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY)
        + Math.hypot(neighbor.x - current.x, neighbor.z - current.z, neighbor.y - current.y);
      if (tentative >= (gScore.get(neighbor.key) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(neighbor.key, currentKey);
      gScore.set(neighbor.key, tentative);
      const score = tentative + Math.hypot(goal.x - neighbor.x, goal.z - neighbor.z, Number(goal.y) - neighbor.y);
      fScore.set(neighbor.key, score);
      pushOpen({ key: neighbor.key, score });
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
      if (
        candidate > index
        && Math.hypot(
          rawPath[candidate].x - Number(anchor.x),
          rawPath[candidate].z - Number(anchor.z)
        ) > 36
      ) continue;
      // Do not smooth across a large elevation change. Keeping intermediate
      // ramp nodes stops bots from lowering their body while still over the
      // solid platform that supports the upper floor.
      if (
        candidate > index
        && Number.isFinite(anchor.y)
        && Number.isFinite(rawPath[candidate].y)
        && Math.abs(Number(anchor.y) - Number(rawPath[candidate].y)) > 1.5
      ) continue;
      if (hasNavigationClearance(anchor, rawPath[candidate])) {
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

export const createInitialFlagState = (position: ArenaPosition, objectiveId = "red-flag"): FlagState => ({
  state: "available",
  teamId: "red",
  objectiveId,
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
  const desiredCount = requestedCount === undefined || requestedCount <= 0
    ? getDefaultInitialZombieCount(eligible.length)
    : requestedCount;
  const zombieCount = Math.min(
    Math.max(0, desiredCount),
    Math.max(0, eligible.length - 1)
  );
  const chosenIds = new Set(randomizeBalancedTeams(eligible, seed).slice(0, zombieCount).map((player) => player.id));
  return players.map((player) => ({
    ...player,
    role: chosenIds.has(player.id) ? "zombie" : "human",
    zombieConvertedAt: undefined,
    team: chosenIds.has(player.id) ? "red" : "blue",
    energy: chosenIds.has(player.id) ? ZOMBIE_HUMAN_MAX_ENERGY : Math.max(0, player.energy ?? 0),
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
