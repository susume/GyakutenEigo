import {
  ARENA_LIMIT_X,
  ARENA_LIMIT_Z,
  DEFAULT_SESSION_SETTINGS,
  type GameSession,
  type PlayerSession,
  type Team
} from "@quizstrike/shared";

export const CHARACTER_STRESS_COUNTS = [10, 20, 40, 60] as const;
export type CharacterStressCount = (typeof CHARACTER_STRESS_COUNTS)[number];

const DEBUG_GEARS = [
  "starter_blaster",
  "quick_blaster",
  "power_blaster",
  "shield_vest",
  "speed_shoes"
] as const;

const clampStressCount = (count: number): CharacterStressCount => {
  if (count <= 10) return 10;
  if (count <= 20) return 20;
  if (count <= 40) return 40;
  return 60;
};

const wave = (index: number, tick: number, scale: number) => Math.sin(index * 1.73 + tick * 0.18) * scale;

const createDebugPlayer = (index: number, count: CharacterStressCount, tick: number): PlayerSession => {
  const team: Team = index % 2 === 0 ? "blue" : "red";
  const lane = Math.floor(index / 2);
  const rowSize = Math.max(5, Math.ceil(count / 8));
  const row = Math.floor(lane / rowSize);
  const column = lane % rowSize;
  const side = team === "blue" ? -1 : 1;
  const baseX = side * (ARENA_LIMIT_X * 0.56 - column * 4.8);
  const baseZ = -ARENA_LIMIT_Z * 0.62 + row * 9.2;
  const x = Math.max(-ARENA_LIMIT_X + 8, Math.min(ARENA_LIMIT_X - 8, baseX + wave(index, tick, 2.8)));
  const z = Math.max(-ARENA_LIMIT_Z + 8, Math.min(ARENA_LIMIT_Z - 8, baseZ + wave(index + 7, tick, 3.1)));
  const facing = Math.atan2(-x, -z) + wave(index + 2, tick, 0.18);
  const isAlive = index % 11 !== 0;

  return {
    id: `debug-${team}-${index}`,
    gameSessionId: "character-lab",
    nickname: `${team === "blue" ? "Alpha" : "Bravo"} ${String(index + 1).padStart(2, "0")}`,
    team,
    money: 16000,
    isAlive,
    health: isAlive ? 100 : 0,
    snowballs: 20,
    isBot: true,
    x: Number(x.toFixed(2)),
    z: Number(z.toFixed(2)),
    facing: Number(facing.toFixed(3)),
    score: Math.max(0, 30 - index),
    correctAnswers: 10 + (index % 6),
    wrongAnswers: index % 3,
    gear: DEBUG_GEARS[index % DEBUG_GEARS.length],
    joinedAt: "2026-07-08T00:00:00.000Z"
  };
};

export const createCharacterDebugSession = ({
  count,
  tick = 0
}: {
  count: number;
  tick?: number;
}): GameSession => {
  const stressCount = clampStressCount(count);
  return {
    id: "character-lab",
    teacherId: "debug-teacher",
    quizSetId: "debug-quiz",
    sessionCode: "LAB",
    status: "active",
    maxPlayers: stressCount,
    currentRound: 1,
    settings: {
      ...DEFAULT_SESSION_SETTINGS,
      maxPlayers: stressCount
    },
    players: Array.from({ length: stressCount }, (_, index) => createDebugPlayer(index, stressCount, tick)),
    events: [],
    createdAt: "2026-07-08T00:00:00.000Z",
    startedAt: "2026-07-08T00:00:00.000Z"
  };
};

export const summarizeCharacterDebugSession = (session: Pick<GameSession, "players">) => {
  const gear = new Set(session.players.map((player) => player.gear));
  return session.players.reduce(
    (summary, player) => {
      summary.total += 1;
      summary.teams[player.team] += 1;
      if (player.isAlive) summary.alive += 1;
      summary.gearTypes = gear.size;
      return summary;
    },
    { total: 0, alive: 0, gearTypes: 0, teams: { blue: 0, red: 0 } }
  );
};
