import { ATHLETICS_STADIUM_COURSE, getAthleticsCheckpointSurfaceIndex, getAthleticsRecoveryPosition, getAthleticsStartPosition, getAthleticsSurfaceRouteProgress, normalizeAthleticsEnergy } from "./athleticsRace.js";
import type { AthleticsZeusState } from "./athleticsModes.js";

export const ZEUS_STOP_GRACE_MS = 650;
export const ZEUS_RESTART_GUARD_MS = 900;
export const ZEUS_CHANT_LEAD_MS = 1200;
export const ZEUS_STRIKE_VISIBLE_MS = 1800;
export const ZEUS_CHANTS = {
  slow: { durationMs: 5125, path: "/assets/audio/zeus/child-slow.wav" },
  steady: { durationMs: 3746, path: "/assets/audio/zeus/child-steady.wav" },
  quick: { durationMs: 2794, path: "/assets/audio/zeus/child-quick.wav" },
  rush: { durationMs: 3365, path: "/assets/audio/zeus/child-rush.wav" },
  suspense: { durationMs: 4396, path: "/assets/audio/zeus/child-suspense.wav" },
  staccato: { durationMs: 4245, path: "/assets/audio/zeus/child-staccato.wav" }
} as const;
export type ZeusChantId = keyof typeof ZEUS_CHANTS;

// The sixth landing checkpoint ends the ascent, before the descent district.
export const ZEUS_SUMMIT_CHECKPOINT_COUNT = ATHLETICS_STADIUM_COURSE.sections.length - 1;
export const ZEUS_SUMMIT_SURFACE_INDEX = getAthleticsCheckpointSurfaceIndex(ZEUS_SUMMIT_CHECKPOINT_COUNT - 1, ATHLETICS_STADIUM_COURSE)!;
export const ZEUS_SUMMIT_PROGRESS = ATHLETICS_STADIUM_COURSE.checkpoints[ZEUS_SUMMIT_CHECKPOINT_COUNT - 1]!;

/** Completed checkpoints identify the current level. Drop back one level,
 * retaining all checkpoints before its start and exactly half the fuel. */
export const getZeusStrikeRecovery = ({ checkpointIndex, energy, laneIndex = 0, totalPlayers = 1 }: {
  checkpointIndex: number; energy: number | undefined; laneIndex?: number; totalPlayers?: number;
}) => {
  const currentLevel = Math.max(0, Math.min(ZEUS_SUMMIT_CHECKPOINT_COUNT - 1, Math.floor(Number.isFinite(checkpointIndex) ? checkpointIndex : 0)));
  const retainedCheckpoints = Math.max(0, currentLevel - 1);
  const surfaceIndex = retainedCheckpoints === 0 ? 0 : getAthleticsCheckpointSurfaceIndex(retainedCheckpoints - 1)!;
  return {
    checkpointIndex: retainedCheckpoints,
    surfaceIndex,
    routeProgress: getAthleticsSurfaceRouteProgress(surfaceIndex),
    energy: normalizeAthleticsEnergy(energy) / 2,
    spawn: surfaceIndex === 0 ? getAthleticsStartPosition(laneIndex, totalPlayers) : getAthleticsRecoveryPosition(surfaceIndex, laneIndex)
  };
};

export const getZeusCycle = (seed: number, cycleIndex: number) => {
  const mix = Math.imul(seed ^ (cycleIndex + 1), 2654435761) >>> 0;
  // A room-seeded shuffled bag guarantees every delivery is heard. Rotate the
  // bag each round to vary the order without repeating at the bag boundary.
  const chants = Object.keys(ZEUS_CHANTS) as ZeusChantId[];
  let random = seed >>> 0;
  for (let index = chants.length - 1; index > 0; index--) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const pick = random % (index + 1);
    [chants[index], chants[pick]] = [chants[pick]!, chants[index]!];
  }
  // The first varied chant must differ from the two slow teaching cycles.
  if (chants[0] === "slow") [chants[0], chants[1]] = [chants[1]!, chants[0]!];
  const variedIndex = Math.max(0, cycleIndex - 2);
  const chantId: ZeusChantId = cycleIndex < 2 ? "slow" : chants[(variedIndex + Math.floor(variedIndex / chants.length)) % chants.length]!;
  return { chantId, greenMs: ZEUS_CHANT_LEAD_MS + ZEUS_CHANTS[chantId].durationMs, redMs: 3600 + (mix % 4) * 400 };
};

export const startZeusGreen = (seed: number, cycleIndex: number, nowMs: number): AthleticsZeusState => {
  const cycle = getZeusCycle(seed, cycleIndex);
  return {
    phase: "green", cycleIndex, chantId: cycle.chantId,
    phaseStartedAt: new Date(nowMs).toISOString(),
    phaseEndsAt: new Date(nowMs + cycle.greenMs).toISOString(),
    // Retained for old persisted snapshots and older clients.
    attackIndex: cycleIndex, recentTargetIds: []
  };
};

/** Predict only the stop transition; movement resumes on a server snapshot. */
export const getZeusLight = (zeus: AthleticsZeusState | undefined, nowMs: number): "green" | "red" | "waiting" | "defeated" => {
  if (zeus?.phase === "defeated") return "defeated";
  if (zeus?.phase === "red") return "red";
  if (zeus?.phase === "green") return nowMs >= Date.parse(zeus.phaseEndsAt ?? "") ? "red" : "green";
  return "waiting";
};

export const isZeusStopEnforced = (zeus: AthleticsZeusState | undefined, nowMs: number) => {
  const graceAt = zeus?.graceEndsAt ? Date.parse(zeus.graceEndsAt) : Date.parse(zeus?.phaseEndsAt ?? "") + ZEUS_STOP_GRACE_MS;
  return getZeusLight(zeus, nowMs) === "red" && Number.isFinite(graceAt) && nowMs >= graceAt;
};
