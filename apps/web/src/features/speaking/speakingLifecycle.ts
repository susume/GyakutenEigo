import type { SpeakingParticipant, SpeakingSession, SpeakingTurn } from "@quizstrike/shared";

export type SpeakingPollState = {
  stablePolls: number;
  urgent?: boolean;
};

/** Stable sessions poll less often; jitter prevents a classroom-wide thundering herd. */
export const nextSpeakingPollDelay = ({ stablePolls, urgent = false }: SpeakingPollState, random = Math.random) => {
  const base = urgent ? 1_000 : Math.min(8_000, 2_000 + Math.max(0, stablePolls) * 1_000);
  const jitter = urgent ? 0 : Math.round((random() - 0.5) * 500);
  return Math.min(8_000, Math.max(750, base + jitter));
};

export const shouldAcceptSpeakingRevision = (currentRevision: number, nextRevision: number) => nextRevision >= currentRevision;

export const mergeSpeakingTurns = (current: SpeakingTurn[], incoming: SpeakingTurn[]) => {
  const byId = new Map(current.map((turn) => [turn.id, turn]));
  for (const turn of incoming) byId.set(turn.id, turn);
  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
};

export const speakingTimerReference = (
  participant: Pick<SpeakingParticipant, "status" | "finishedAt">,
  session: Pick<SpeakingSession, "status" | "endedAt">,
  now: number
) => {
  if (["evaluating", "completed", "error"].includes(participant.status) && participant.finishedAt) return participant.finishedAt;
  if (["ended", "expired"].includes(session.status) && session.endedAt) return session.endedAt;
  return now;
};
