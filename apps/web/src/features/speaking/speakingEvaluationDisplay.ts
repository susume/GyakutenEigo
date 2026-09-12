import type { SpeakingEvaluation, SpeakingTurn } from "@quizstrike/shared";

export const exactUsefulEnglishItems = (
  evaluation: SpeakingEvaluation,
  turns: SpeakingTurn[],
) => evaluation.usefulEnglish.flatMap((item) => {
  const source = item.sourceTurnId
    ? turns.find((turn) => turn.id === item.sourceTurnId && turn.speaker === "student")
    : turns.find((turn) => turn.speaker === "student" && turn.text === item.said);
  // A source ID is authoritative; resolve the quote from the saved transcript.
  // Legacy items without IDs require an exact text match.
  return source
    ? [{ ...item, said: source.text, sourceTurnId: source.id }]
    : [];
}).filter((item, index, items) => items.findIndex((other) => other.sourceTurnId === item.sourceTurnId && other.try === item.try) === index);
