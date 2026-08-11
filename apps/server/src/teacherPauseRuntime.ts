import { type GameSession, type PlayerQuestionGate, type Team } from "@quizstrike/shared";
import type { PlayerPositionHistory } from "./playerPositionHistory.js";

const memoryTimestampKeys = [
  "lastSeenAtMs",
  "visibleSinceAtMs",
  "lastAlertAtMs",
  "targetCommitUntilMs",
  "nextThinkAtMs"
] as const;

type PauseRuntimeMemory = Partial<Record<(typeof memoryTimestampKeys)[number], number>>;
type PauseRuntimeAlert = { createdAtMs: number };

const shiftTimestampMap = (values: Map<string, number>, playerIds: ReadonlySet<string>, deltaMs: number) => {
  for (const playerId of playerIds) {
    const value = values.get(playerId);
    if (value !== undefined) values.set(playerId, value + deltaMs);
  }
};

/** Shifts only ephemeral timers owned by the room that is being resumed. */
export const shiftTeacherPauseRuntimeTimers = <
  TMemory extends PauseRuntimeMemory,
  TAlert extends PauseRuntimeAlert
>({
  session,
  deltaMs,
  playerMoveTimestamps,
  playerNextFireAt,
  botRespawnAt,
  botNextAttackAt,
  playerQuestionGate,
  playerPositionHistory,
  botMemoryById,
  botAlertsBySession
}: {
  session: GameSession;
  deltaMs: number;
  playerMoveTimestamps: Map<string, number>;
  playerNextFireAt: Map<string, number>;
  botRespawnAt: Map<string, number>;
  botNextAttackAt: Map<string, number>;
  playerQuestionGate: PlayerQuestionGate;
  playerPositionHistory: PlayerPositionHistory;
  botMemoryById: Map<string, TMemory>;
  botAlertsBySession: Map<string, Map<Team, TAlert>>;
}) => {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
  const playerIds = new Set(session.players.map((player) => player.id));
  shiftTimestampMap(playerMoveTimestamps, playerIds, deltaMs);
  shiftTimestampMap(playerNextFireAt, playerIds, deltaMs);
  shiftTimestampMap(botRespawnAt, playerIds, deltaMs);
  shiftTimestampMap(botNextAttackAt, playerIds, deltaMs);
  playerQuestionGate.shiftTimestamps(deltaMs, playerIds);
  playerPositionHistory.shiftTimestamps(deltaMs, playerIds);

  for (const playerId of playerIds) {
    const memory = botMemoryById.get(playerId);
    if (!memory) continue;
    for (const key of memoryTimestampKeys) {
      const value = memory[key];
      if (typeof value === "number") memory[key] = value + deltaMs;
    }
  }

  for (const alert of botAlertsBySession.get(session.sessionCode)?.values() ?? []) {
    alert.createdAtMs += deltaMs;
  }
};
