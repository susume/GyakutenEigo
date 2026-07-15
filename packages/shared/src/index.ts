export type Team = "blue" | "red";
export type SessionStatus = "waiting" | "active" | "paused" | "ended";
export type Choice = "A" | "B" | "C" | "D";
export type GameMode = "flag" | "zombie" | "classic";
export type ArenaMapId = "desert_citadel" | "iron_junction";
export type TeamAssignment = "players_choose" | "random";
export type PlayerRole = "human" | "zombie";
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

export interface SessionSettings {
  mapId: ArenaMapId;
  gameMode: GameMode;
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
  isAlive: boolean;
  health?: number;
  snowballs?: number;
  respawnCorrectAnswers?: number;
  isBot?: boolean;
  role?: PlayerRole;
  tags?: number;
  respawns?: number;
  connectionState?: "connected" | "disconnected";
  x?: number;
  z?: number;
  facing?: number;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  gear: string;
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
export const QUICK_BLASTER_RANGE = 48;
export const QUICK_BLASTER_COOLDOWN_MS = 150;
export const STARTER_BLASTER_RANGE = 36;

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  mapId: "desert_citadel",
  gameMode: "flag",
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
  deadPlayersEarnMoney: false
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
  value === "iron_junction" ? "iron_junction" : DEFAULT_SESSION_SETTINGS.mapId;

const sanitizeTeamAssignment = (value: unknown): TeamAssignment =>
  value === "random" || value === "players_choose" ? value : DEFAULT_SESSION_SETTINGS.teamAssignment;

export const sanitizeSessionSettings = (input: Partial<SessionSettings> = {}): SessionSettings => ({
  mapId: sanitizeArenaMap(input.mapId),
  gameMode: sanitizeGameMode(input.gameMode),
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
      : DEFAULT_SESSION_SETTINGS.deadPlayersEarnMoney
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
    ["Session Code", "Student", "Team", "Correct", "Wrong", "Accuracy %", "Current Money", "Quiz Money", "Score"],
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
    description: "Faster launches with lighter snowballs.",
    damage: 10,
    range: QUICK_BLASTER_RANGE,
    fireCooldownMs: QUICK_BLASTER_COOLDOWN_MS,
    autoFire: true
  },
  {
    id: "power_blaster",
    name: "Heavy Snowball Launcher",
    cost: 6000,
    description: "High-focus launcher with a deliberate rhythm, long reach, and right-click scope.",
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

export const isChoice = (value: unknown): value is Choice =>
  value === "A" || value === "B" || value === "C" || value === "D";

export const calculateAccuracy = (correct: number, wrong: number) => {
  const total = correct + wrong;
  return total === 0 ? 0 : Math.round((correct / total) * 100);
};

export type StartRoundResult = { ok: true } | { ok: false; reason: "no_real_players" | "session_ended" };

export const canStartRound = (session: Pick<GameSession, "players" | "status">): StartRoundResult => {
  if (session.status === "ended") return { ok: false, reason: "session_ended" };
  if (!session.players.some((player) => !player.isBot)) return { ok: false, reason: "no_real_players" };
  return { ok: true };
};

export const isRoundActive = (session: Pick<GameSession, "status">) => session.status === "active";

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
export const ARENA_SCALE = 0.62;
const scaleArenaValue = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleArenaPosition = <T extends { x: number; z: number }>(position: T): T =>
  ({ ...position, x: scaleArenaValue(position.x), z: scaleArenaValue(position.z) }) as T;
const scaleArenaRadius = <T extends { x: number; z: number; radius: number }>(position: T): T =>
  ({ ...scaleArenaPosition(position), radius: scaleArenaValue(position.radius) }) as T;

export const ARENA_LIMIT_X = scaleArenaValue(175);
export const ARENA_LIMIT_Z = scaleArenaValue(160);

export type GroundArenaPosition = Required<Pick<ArenaPosition, "x" | "z" | "facing">>;

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
    { id: "east-camp-f4", label: "Canopy Exit", x: 141, z: 36, facing: Math.PI / 2 }
  ]
};

export const TEAM_SPAWNS: Record<Team, SpawnPoint[]> = {
  blue: RAW_TEAM_SPAWNS.blue.map(scaleArenaPosition),
  red: RAW_TEAM_SPAWNS.red.map(scaleArenaPosition)
};

const IRON_JUNCTION_TEAM_SPAWNS: Record<Team, SpawnPoint[]> = {
  blue: TEAM_SPAWNS.blue.map((spawn) => ({ ...spawn, id: spawn.id.replace("west-fortress", "west-yard"), label: "West Signal Yard" })),
  red: TEAM_SPAWNS.red.map((spawn) => ({ ...spawn, id: spawn.id.replace("east-camp", "east-yard"), label: "East Signal Yard" }))
};

const teamSpawnsForMap = (mapId: ArenaMapId | string | undefined) =>
  mapId === "iron_junction" ? IRON_JUNCTION_TEAM_SPAWNS : TEAM_SPAWNS;

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

const RAW_SEARCH_RETRIEVE_ITEMS = [
  { id: "old-well-scroll", label: "Old Well Scroll", x: -8, z: -18 },
  { id: "ruins-tablet", label: "Ruins Tablet", x: 12, z: -126 },
  { id: "aqueduct-lamp", label: "Aqueduct Lamp", x: 0, z: 0 }
] as const;

export const SEARCH_RETRIEVE_ITEMS = RAW_SEARCH_RETRIEVE_ITEMS.map(scaleArenaPosition);

const RAW_SEARCH_RETRIEVE_DELIVERY_ZONES = {
  blue: { id: "blue-delivery", label: "West Fortress Delivery", x: -146, z: 0, radius: 18 },
  red: { id: "red-delivery", label: "East Camp Delivery", x: 146, z: 0, radius: 18 }
} as const;

export const SEARCH_RETRIEVE_DELIVERY_ZONES = {
  blue: scaleArenaRadius(RAW_SEARCH_RETRIEVE_DELIVERY_ZONES.blue),
  red: scaleArenaRadius(RAW_SEARCH_RETRIEVE_DELIVERY_ZONES.red)
} as const;

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
  return { x: spawn.x, z: spawn.z, facing: spawn.facing };
};

export const getTeamSpawnForMap = (mapId: ArenaMapId | string | undefined, team: Team, index = 0): GroundArenaPosition => {
  const spawns = teamSpawnsForMap(mapId)[team];
  const spawn = spawns[((index % spawns.length) + spawns.length) % spawns.length];
  return { x: spawn.x, z: spawn.z, facing: spawn.facing };
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
  return { x: selected.x, z: selected.z, facing: selected.facing };
};

export const getFreeForAllSpawn = (index = 0): GroundArenaPosition => {
  const spawn = FREE_FOR_ALL_SPAWNS[((index % FREE_FOR_ALL_SPAWNS.length) + FREE_FOR_ALL_SPAWNS.length) % FREE_FOR_ALL_SPAWNS.length];
  return { x: spawn.x, z: spawn.z, facing: spawn.facing };
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

export const isInsideTeamBase = (team: Team, position: ArenaPosition | undefined) => {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  const zone = TEAM_BASE_ZONES[team];
  return position.x >= zone.minX && position.x <= zone.maxX && position.z >= zone.minZ && position.z <= zone.maxZ;
};

export const clampArenaPosition = (
  position: ArenaPosition
): Required<Pick<ArenaPosition, "x" | "z" | "facing">> & Pick<ArenaPosition, "y"> => ({
  x: Math.min(ARENA_LIMIT_X, Math.max(-ARENA_LIMIT_X, Number.isFinite(position.x) ? position.x : 0)),
  z: Math.min(ARENA_LIMIT_Z, Math.max(-ARENA_LIMIT_Z, Number.isFinite(position.z) ? position.z : 0)),
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

export type ArenaObstacle =
  | { id: string; kind: "rect"; x: number; z: number; width: number; depth: number; jumpable?: boolean }
  | { id: string; kind: "circle"; x: number; z: number; radius: number; jumpable?: boolean };

const rectObstacle = (id: string, x: number, z: number, width: number, depth: number, jumpable = false): ArenaObstacle => ({
  id,
  kind: "rect",
  x: scaleArenaValue(x),
  z: scaleArenaValue(z),
  width: scaleArenaValue(width),
  depth: scaleArenaValue(depth),
  jumpable
});

const circleObstacle = (id: string, x: number, z: number, radius: number, jumpable = false): ArenaObstacle => ({
  id,
  kind: "circle",
  x: scaleArenaValue(x),
  z: scaleArenaValue(z),
  radius: scaleArenaValue(radius),
  jumpable
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
  rectObstacle("rooftop-center-gap-cover", 0, 66, 20, 8),
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
  rectObstacle("iron-north-retaining-wall", 0, -156, 350, 8),
  rectObstacle("iron-south-cliff-face", 0, 156, 350, 8),
  rectObstacle("iron-west-embankment", -169, 0, 8, 142),
  rectObstacle("iron-east-embankment", 169, 0, 8, 142),
  rectObstacle("west-signal-house", -151, -64, 24, 20),
  rectObstacle("west-freight-office", -151, 64, 26, 18),
  rectObstacle("east-signal-house", 151, -64, 24, 20),
  rectObstacle("east-freight-office", 151, 64, 26, 18),
  rectObstacle("depot-north-roof", 0, -151, 142, 6),
  rectObstacle("depot-south-wall-west", -86, -88, 48, 7),
  rectObstacle("depot-south-wall-east", 76, -88, 46, 7),
  rectObstacle("depot-railcar-west", -56, -119, 30, 10),
  rectObstacle("depot-railcar-east", 35, -133, 34, 10),
  rectObstacle("depot-control-booth", 0, -99, 20, 13),
  rectObstacle("depot-east-workshop", 78, -118, 22, 24),
  rectObstacle("depot-west-tool-cage", -91, -113, 12, 16),
  rectObstacle("gantry-foot-west", -28, -14, 9, 18),
  rectObstacle("gantry-foot-east", 28, 14, 9, 18),
  rectObstacle("sorting-booth", 0, 25, 21, 16),
  rectObstacle("mid-boxcar-north", -68, -22, 28, 10),
  rectObstacle("mid-boxcar-south", 60, 30, 30, 10),
  rectObstacle("mid-flatbed-cover", -20, 12, 22, 7, true),
  rectObstacle("switch-control-hut", 88, 0, 13, 14),
  rectObstacle("offset-cargo-container", 18, -28, 14, 9),
  rectObstacle("timber-shelter-west", -83, 90, 32, 18),
  rectObstacle("timber-shelter-east", 85, 100, 28, 18),
  rectObstacle("log-stack-west", -50, 100, 24, 10),
  rectObstacle("log-stack-east", 42, 124, 26, 10),
  rectObstacle("loader-cabin", -10, 105, 14, 13),
  rectObstacle("water-tower-base", 82, 116, 16, 16),
  rectObstacle("gorge-retaining-wall", 0, 151, 170, 7),
  rectObstacle("rock-outcrop-west", -117, 120, 18, 16),
  rectObstacle("rock-outcrop-east", 115, 88, 18, 14),
  rectObstacle("timber-drop-landing", 14, 82, 16, 8, true),
  circleObstacle("depot-hydraulic-west", -72, -128, 2),
  circleObstacle("depot-hydraulic-east", 51, -117, 2),
  circleObstacle("oil-drums-west", -100, -94, 3),
  circleObstacle("oil-drums-east", 104, 64, 3),
  circleObstacle("gorge-winch", -4, 133, 3)
];

const ARENA_OBSTACLES_BY_MAP: Record<ArenaMapId, ArenaObstacle[]> = {
  desert_citadel: ARENA_OBSTACLES,
  iron_junction: IRON_JUNCTION_OBSTACLES
};

export const getArenaObstacles = (mapId: ArenaMapId | string | undefined): ArenaObstacle[] =>
  ARENA_OBSTACLES_BY_MAP[mapId === "iron_junction" ? "iron_junction" : "desert_citadel"];

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
  gear
}: {
  player: Pick<PlayerSession, "isAlive" | "money" | "gear" | "health" | "team" | "x" | "z">;
  gear: GearItem;
}): GearPurchaseResult => {
  if (!player.isAlive) return { ok: false, reason: "player_eliminated" };
  if (player.gear === gear.id) {
    return {
      ok: true,
      alreadyEquipped: true,
      nextMoney: player.money,
      nextHealth: player.health,
      gearChanged: false
    };
  }
  if (gear.id === "starter_blaster") return { ok: false, reason: "starter_weapon" };
  if (!isInsideTeamBase(player.team, { x: player.x ?? getTeamSpawn(player.team).x, z: player.z ?? getTeamSpawn(player.team).z })) {
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

const segmentIntersectsObstacle = (start: ArenaPosition, end: ArenaPosition, obstacle: ArenaObstacle, padding = 0) => {
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

export const resolveProjectileTarget = ({
  attacker,
  candidates,
  requestedTargetId,
  obstacles = ARENA_OBSTACLES,
  range = TAG_RANGE,
  hitRadius = SNOWBALL_HIT_RADIUS
}: {
  attacker: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "z" | "facing">;
  candidates: Array<Pick<PlayerSession, "id" | "team" | "isAlive" | "connectionState" | "x" | "z" | "isBot">>;
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
    const target = {
      x: Number.isFinite(candidate.x) ? candidate.x! : 0,
      z: Number.isFinite(candidate.z) ? candidate.z! : 0
    };
    const hit = distanceToShotSegment({ origin, direction, target, range });
    if (hit.alongShot < 0 || hit.alongShot > range || hit.distance > hitRadius) continue;
    if (!hasLineOfSight({ from: origin, to: target, obstacles })) {
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
  radius = 0.45
}: {
  current: ArenaPosition;
  requested: ArenaPosition;
  elapsedMs: number;
  maxSpeed: number;
  obstacles?: readonly ArenaObstacle[];
  radius?: number;
}): AuthoritativeMovementResult => {
  const from = clampArenaPosition(current);
  const to = clampArenaPosition(requested);
  const elapsedSeconds = Math.max(0.05, Math.min(1, elapsedMs / 1000));
  const maxDistance = Math.max(0, maxSpeed * elapsedSeconds);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  const limited = distance > maxDistance && maxDistance > 0;
  const next = limited
    ? clampArenaPosition({
        x: from.x + (dx / distance) * maxDistance,
        z: from.z + (dz / distance) * maxDistance,
        y: to.y,
        facing: to.facing
      })
    : to;

  const canClearJumpable = (obstacle: ArenaObstacle) => obstacle.jumpable === true && Number(to.y) >= 5;
  if (obstacles.some((obstacle) => !canClearJumpable(obstacle) && segmentIntersectsObstacle(from, next, obstacle, radius))) {
    return { ...from, facing: to.facing, blocked: true };
  }

  return limited ? { ...next, limited: true } : next;
};

export type BotAttackTargetResult = { ok: true; targetId: string } | { ok: false; reason: "no_valid_target" };

export const resolveBotAttackTarget = ({
  bot,
  candidates,
  obstacles = ARENA_OBSTACLES,
  range = TAG_RANGE
}: {
  bot: Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "z">;
  candidates: Array<Pick<PlayerSession, "id" | "team" | "isAlive" | "connectionState" | "isBot" | "x" | "z">>;
  obstacles?: readonly ArenaObstacle[];
  range?: number;
}): BotAttackTargetResult => {
  if (!bot.isAlive) return { ok: false, reason: "no_valid_target" };
  const botPosition = { x: bot.x ?? 0, z: bot.z ?? 0 };
  let selected: { id: string; distance: number } | undefined;
  for (const candidate of candidates) {
    if (candidate.id === bot.id || candidate.isBot || candidate.connectionState === "disconnected" || !candidate.isAlive || candidate.team === bot.team) continue;
    const targetPosition = { x: candidate.x ?? 0, z: candidate.z ?? 0 };
    const distance = Math.hypot(targetPosition.x - botPosition.x, targetPosition.z - botPosition.z);
    if (distance > range || !hasLineOfSight({ from: botPosition, to: targetPosition, obstacles })) continue;
    if (!selected || distance < selected.distance) selected = { id: candidate.id, distance };
  }
  return selected ? { ok: true, targetId: selected.id } : { ok: false, reason: "no_valid_target" };
};

export const resolveBotRoamStep = ({
  current,
  desired,
  elapsedMs,
  speed,
  obstacles = ARENA_OBSTACLES
}: {
  current: ArenaPosition;
  desired: ArenaPosition;
  elapsedMs: number;
  speed: number;
  obstacles?: readonly ArenaObstacle[];
}): AuthoritativeMovementResult =>
  resolveAuthoritativeMovement({
    current,
    requested: desired,
    elapsedMs,
    maxSpeed: speed,
    obstacles
  });

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
      respawnCorrectAnswers: 0
    }
  };
};

export const resolveTagAction = ({
  attacker,
  target
}: {
  attacker: Pick<PlayerSession, "team" | "isAlive" | "gear" | "x" | "z">;
  target: Pick<PlayerSession, "team" | "isAlive" | "health" | "x" | "z">;
}): TagActionResult => {
  if (!attacker.isAlive) return { ok: false, reason: "attacker_eliminated" };
  if (!target.isAlive) return { ok: false, reason: "target_eliminated" };
  if (attacker.team === target.team) return { ok: false, reason: "same_team" };

  const attackerPosition = { x: attacker.x ?? 0, z: attacker.z ?? 0 };
  const targetPosition = { x: target.x ?? 0, z: target.z ?? 0 };
  const distance = Math.hypot(targetPosition.x - attackerPosition.x, targetPosition.z - attackerPosition.z);
  if (distance > getGearRange(attacker.gear)) return { ok: false, reason: "out_of_range" };

  const damage = getGearDamage(attacker.gear);
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

export const createInitialFlagState = (position: ArenaPosition): FlagState => ({
  state: "available",
  teamId: "red",
  position: { x: position.x, z: position.z, ...(position.y !== undefined ? { y: position.y } : {}) }
});

export const resolveFlagPickup = (flag: FlagState, player: Pick<PlayerSession, "id" | "team" | "isAlive">): FlagState => {
  if (!player.isAlive || player.team !== "red" || !["available", "dropped"].includes(flag.state)) return flag;
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
  player: Pick<PlayerSession, "id" | "team" | "isAlive">
): FlagState => {
  if (flag.state !== "placed" || player.team !== "blue" || !player.isAlive) return flag;
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
    team: chosenIds.has(player.id) ? "red" : "blue",
    gear: chosenIds.has(player.id) ? "starter_blaster" : player.gear,
    isAlive: true
  }) as T);
};

export type ZombieConversionResult =
  | { ok: true; player: PlayerSession; tagCredit: number }
  | { ok: false; reason: "attacker_not_zombie" | "target_not_human" | "attacker_eliminated" | "target_eliminated" };

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
  return {
    ok: true,
    tagCredit: 1,
    player: {
      ...target,
      role: "zombie",
      team: "red",
      gear: "starter_blaster",
      isAlive: true,
      health: DEFAULT_PLAYER_HEALTH,
      snowballs: DEFAULT_SESSION_SETTINGS.startingSnowballs,
      respawns: (target.respawns ?? 0) + 1,
      respawnCorrectAnswers: 0
    }
  };
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
