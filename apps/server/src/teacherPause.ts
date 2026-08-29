import { isTeacherPaused, type GameSession } from "@quizstrike/shared";

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
    session.athletics = {
      ...session.athletics,
      startAt: shiftIso(session.athletics.startAt, pausedDurationMs)!
    };
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
