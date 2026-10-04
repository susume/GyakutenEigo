import { isTeacherPaused, ZEUS_STOP_GRACE_MS, type GameSession } from "@quizstrike/shared";

export type TeacherPauseResult =
  | { ok: true; changed: boolean; pausedAt?: string; pausedDurationMs?: number }
  | { ok: false; reason: "not_pausable" | "invalid_pause_time" };

const shiftIso = (value: string | undefined, deltaMs: number) => {
  if (!value) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed + deltaMs).toISOString() : value;
};

const shiftNumber = (value: number | undefined, deltaMs: number) =>
  value === undefined ? value : value + deltaMs;

/** Enters an explicit teacher attention state without changing the round phase. */
export const pauseSessionForTeacher = (session: GameSession, nowMs = Date.now()): TeacherPauseResult => {
  if (session.status === "waiting" || session.status === "ended") return { ok: false, reason: "not_pausable" };
  if (isTeacherPaused(session)) return { ok: true, changed: false, pausedAt: session.teacherPausedAt };
  if (!Number.isFinite(nowMs)) return { ok: false, reason: "invalid_pause_time" };
  session.controlState = "teacher_paused";
  session.teacherPausedAt = new Date(nowMs).toISOString();
  return { ok: true, changed: true, pausedAt: session.teacherPausedAt };
};

/** Resumes the previous phase and moves every absolute deadline past the pause. */
export const resumeSessionForTeacher = (session: GameSession, nowMs = Date.now()): TeacherPauseResult => {
  if (!isTeacherPaused(session)) return { ok: true, changed: false };
  const pausedAtMs = Date.parse(session.teacherPausedAt ?? "");
  if (!Number.isFinite(pausedAtMs) || !Number.isFinite(nowMs)) return { ok: false, reason: "invalid_pause_time" };
  const pausedDurationMs = Math.max(0, nowMs - pausedAtMs);
  session.startedAt = shiftIso(session.startedAt, pausedDurationMs);
  session.endsAt = shiftIso(session.endsAt, pausedDurationMs);
  if (session.athletics) {
    const race = session.athletics;
    race.startAt = shiftIso(race.startAt, pausedDurationMs)!;
    if (race.zeus) {
      race.zeus.phaseStartedAt = shiftIso(race.zeus.phaseStartedAt, pausedDurationMs);
      race.zeus.phaseEndsAt = shiftIso(race.zeus.phaseEndsAt, pausedDurationMs);
      race.zeus.graceEndsAt = shiftIso(race.zeus.graceEndsAt, pausedDurationMs);
      if (race.zeus.phase === "red") race.zeus.graceEndsAt = new Date(Math.max(nowMs + ZEUS_STOP_GRACE_MS, Date.parse(race.zeus.graceEndsAt ?? "") || 0)).toISOString();
      race.zeus.nextAttackAt = shiftIso(race.zeus.nextAttackAt, pausedDurationMs);
      if (race.zeus.currentAttack) {
        race.zeus.currentAttack.warningStartedAt = shiftIso(race.zeus.currentAttack.warningStartedAt, pausedDurationMs)!;
        race.zeus.currentAttack.strikeAt = shiftIso(race.zeus.currentAttack.strikeAt, pausedDurationMs)!;
      }
    }
    if (race.chaos) {
      race.chaos.nextWaveAt = shiftIso(race.chaos.nextWaveAt, pausedDurationMs)!;
      for (const hazard of race.chaos.activeHazards) {
        hazard.spawnAt = shiftIso(hazard.spawnAt, pausedDurationMs)!;
        hazard.expiresAt = shiftIso(hazard.expiresAt, pausedDurationMs)!;
      }
      if (race.chaos.currentEvent) {
        race.chaos.currentEvent.startedAt = shiftIso(race.chaos.currentEvent.startedAt, pausedDurationMs)!;
        race.chaos.currentEvent.expiresAt = shiftIso(race.chaos.currentEvent.expiresAt, pausedDurationMs)!;
      }
    }
    for (const player of session.players) {
      const athletics = player.athletics;
      if (!athletics) continue;
      for (const key of ["recoverySettleUntil", "lapTransitionUntil", "respawnPenaltyUntil", "wrongAnswerPenaltyUntil", "dashUntil", "jumpBoostUntil", "knockbackResistUntil", "staggerUntil", "zeusFrozenUntil", "zeusRestartUntil"] as const) {
        athletics[key] = shiftIso(athletics[key], pausedDurationMs);
      }
      athletics.lastSupportedAtMs = shiftNumber(athletics.lastSupportedAtMs, pausedDurationMs);
    }
  }
  if (session.roundTransition) {
    session.roundTransition = {
      ...session.roundTransition,
      startsAt: shiftIso(session.roundTransition.startsAt, pausedDurationMs)!
    };
  }
  if (session.announcement) {
    session.announcement = {
      ...session.announcement,
      expiresAt: shiftIso(session.announcement.expiresAt, pausedDurationMs)
    };
  }
  if (session.flag) {
    session.flag = {
      ...session.flag,
      progressStartedAtMs: shiftNumber(session.flag.progressStartedAtMs, pausedDurationMs),
      placedAtMs: shiftNumber(session.flag.placedAtMs, pausedDurationMs),
      expiresAtMs: shiftNumber(session.flag.expiresAtMs, pausedDurationMs)
    };
  }
  session.controlState = "running";
  session.teacherPausedAt = undefined;
  return { ok: true, changed: true, pausedDurationMs };
};
