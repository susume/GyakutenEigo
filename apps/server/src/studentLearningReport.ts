import type {
  AnswerLog,
  Choice,
  PlayerSession,
  QuizSet,
  StudentAnswerAttempt
} from "@quizstrike/shared";

export interface BuildStudentLearningAttemptsInput {
  /** The GameSession.id; all rounds in one game share this value. */
  gameSessionId: string;
  playerSessionId: string;
  gameQuizSet?: QuizSet;
  allQuizSets?: Iterable<QuizSet>;
  answers: readonly AnswerLog[];
}

const isChoice = (value: string | undefined): value is Choice =>
  value === "A" || value === "B" || value === "C" || value === "D";

/**
 * Builds the student-facing answer history for one player in one game.
 *
 * Round transitions never change GameSession.id, so filtering on that
 * authoritative identifier deliberately keeps every round while excluding
 * other games and players. The quiz set is also restricted to the one set
 * attached to the GameSession; that is the current server architecture and
 * prevents stale global question lookups from leaking unrelated material.
 */
export const buildStudentLearningAttempts = ({
  gameSessionId,
  playerSessionId,
  gameQuizSet,
  allQuizSets,
  answers
}: BuildStudentLearningAttemptsInput): StudentAnswerAttempt[] => {
  const questionsById = new Map(gameQuizSet?.questions.map((question) => [question.id, question]) ?? []);
  const questionSetByQuestionId = new Map(
    [...(allQuizSets ?? (gameQuizSet ? [gameQuizSet] : []))]
      .flatMap((quiz) => quiz.questions.map((question) => [question.id, question.quizSetId] as const))
  );
  const seenAnswerIds = new Set<string>();

  return answers
    .filter((answer) => {
      if (answer.gameSessionId !== gameSessionId || answer.playerSessionId !== playerSessionId || seenAnswerIds.has(answer.id)) return false;
      seenAnswerIds.add(answer.id);
      return true;
    })
    .slice()
    .sort((left, right) => left.answeredAt.localeCompare(right.answeredAt) || left.id.localeCompare(right.id))
    .map((answer): StudentAnswerAttempt | undefined => {
      const question = questionsById.get(answer.questionId);
      const sourceQuizSetId = questionSetByQuestionId.get(answer.questionId);
      if (sourceQuizSetId && sourceQuizSetId !== gameQuizSet?.id) return undefined;
      const correctChoice = isChoice(answer.correctChoice)
        ? answer.correctChoice
        : question?.correctChoice;
      if (!correctChoice || !gameQuizSet) return undefined;

      return {
        id: answer.id,
        questionId: answer.questionId,
        quizSetId: gameQuizSet.id,
        selectedChoice: answer.selectedChoice,
        correctChoice,
        isCorrect: answer.isCorrect,
        answeredAt: answer.answeredAt
      };
    })
    .filter((answer): answer is StudentAnswerAttempt => Boolean(answer));
};

export type StudentLearningPlayer = Pick<PlayerSession, "id" | "nickname">;
