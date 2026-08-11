import type { AnswerLog, PlayerSession, Question } from "./index.js";

export interface LearningPulseQuestion {
  questionId: string;
  prompt: string;
  correct: number;
  attempts: number;
  accuracy: number;
}

export interface LearningPulse {
  classAccuracy: number | null;
  answersSubmitted: number;
  studentsNeedingReview: number;
  difficultQuestion?: LearningPulseQuestion;
  strongestQuestion?: LearningPulseQuestion;
}

type QuestionStats = { questionId: string; correct: number; attempts: number };

const safePrompt = (prompt: string) => {
  const normalized = prompt.replace(/\s+/gu, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 137).trimEnd()}…` : normalized;
};

const toQuestionMetric = (stats: QuestionStats, question: Question): LearningPulseQuestion => ({
  questionId: stats.questionId,
  prompt: safePrompt(question.prompt),
  correct: stats.correct,
  attempts: stats.attempts,
  accuracy: Math.round((stats.correct / stats.attempts) * 100)
});

/**
 * Builds the compact teacher overview from authoritative answer records. The
 * caller supplies the current session's question set so stale records from a
 * different game or imported quiz cannot contaminate the result.
 */
export const buildLearningPulse = ({
  sessionId,
  players,
  answers,
  questions,
  minQuestionAttempts = 3,
  reviewMinAttempts = 3,
  reviewAccuracyThreshold = 0.6
}: {
  sessionId: string;
  players: PlayerSession[];
  answers: AnswerLog[];
  questions: Question[];
  minQuestionAttempts?: number;
  reviewMinAttempts?: number;
  reviewAccuracyThreshold?: number;
}): LearningPulse => {
  const botIds = new Set(players.filter((player) => player.isBot).map((player) => player.id));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const seenAnswerIds = new Set<string>();
  const questionStats = new Map<string, QuestionStats>();
  const learnerStats = new Map<string, { correct: number; attempts: number }>();

  for (const answer of answers) {
    if (
      answer.gameSessionId !== sessionId
      || botIds.has(answer.playerSessionId)
      || seenAnswerIds.has(answer.id)
      || !questionById.has(answer.questionId)
    ) continue;
    seenAnswerIds.add(answer.id);
    const question = questionStats.get(answer.questionId) ?? { questionId: answer.questionId, correct: 0, attempts: 0 };
    question.attempts += 1;
    if (answer.isCorrect) question.correct += 1;
    questionStats.set(answer.questionId, question);
    const learner = learnerStats.get(answer.playerSessionId) ?? { correct: 0, attempts: 0 };
    learner.attempts += 1;
    if (answer.isCorrect) learner.correct += 1;
    learnerStats.set(answer.playerSessionId, learner);
  }

  const answersSubmitted = [...learnerStats.values()].reduce((total, learner) => total + learner.attempts, 0);
  const correctAnswers = [...learnerStats.values()].reduce((total, learner) => total + learner.correct, 0);
  const eligibleQuestions = [...questionStats.values()]
    .filter((stats) => stats.attempts >= Math.max(1, minQuestionAttempts))
    .map((stats) => toQuestionMetric(stats, questionById.get(stats.questionId)!));
  const difficultQuestion = [...eligibleQuestions].sort(
    (left, right) => left.accuracy - right.accuracy
      || right.attempts - left.attempts
      || left.prompt.localeCompare(right.prompt)
      || left.questionId.localeCompare(right.questionId)
  )[0];
  const strongestQuestion = [...eligibleQuestions].sort(
    (left, right) => right.accuracy - left.accuracy
      || right.attempts - left.attempts
      || left.prompt.localeCompare(right.prompt)
      || left.questionId.localeCompare(right.questionId)
  )[0];
  const studentsNeedingReview = [...learnerStats.values()].filter((learner) =>
    learner.attempts >= Math.max(1, reviewMinAttempts)
    && learner.correct / learner.attempts < reviewAccuracyThreshold
  ).length;

  return {
    classAccuracy: answersSubmitted === 0 ? null : Math.round((correctAnswers / answersSubmitted) * 100),
    answersSubmitted,
    studentsNeedingReview,
    ...(difficultQuestion ? { difficultQuestion } : {}),
    ...(strongestQuestion ? { strongestQuestion } : {})
  };
};
