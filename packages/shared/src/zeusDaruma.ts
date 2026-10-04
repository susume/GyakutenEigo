import { ATHLETICS_STADIUM_COURSE, getAthleticsCheckpointSurfaceIndex } from "./athleticsRace.js";
import type { AthleticsZeusState } from "./athleticsModes.js";

export const ZEUS_STOP_GRACE_MS = 650;
export const ZEUS_RESTART_GUARD_MS = 900;
export const ZEUS_CHANT_LEAD_MS = 1200;
export const ZEUS_CHANTS = {
  slow: { durationMs: 5083, path: "/assets/audio/zeus/slow.wav" },
  steady: { durationMs: 3867, path: "/assets/audio/zeus/steady.wav" },
  quick: { durationMs: 2845, path: "/assets/audio/zeus/quick.wav" }
} as const;
export type ZeusChantId = keyof typeof ZEUS_CHANTS;

// The sixth landing checkpoint ends the ascent, before the descent district.
export const ZEUS_SUMMIT_CHECKPOINT_COUNT = ATHLETICS_STADIUM_COURSE.sections.length - 1;
export const ZEUS_SUMMIT_SURFACE_INDEX = getAthleticsCheckpointSurfaceIndex(ZEUS_SUMMIT_CHECKPOINT_COUNT - 1, ATHLETICS_STADIUM_COURSE)!;
export const ZEUS_SUMMIT_PROGRESS = ATHLETICS_STADIUM_COURSE.checkpoints[ZEUS_SUMMIT_CHECKPOINT_COUNT - 1]!;

export const getZeusCycle = (seed: number, cycleIndex: number) => {
  const mix = Math.imul(seed ^ (cycleIndex + 1), 2654435761) >>> 0;
  const chantId: ZeusChantId = cycleIndex < 2 ? "slow" : (["slow", "steady", "quick"] as const)[mix % 3]!;
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
