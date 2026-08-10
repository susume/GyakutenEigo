import type { Choice, StudentAnswerAttempt, StudentPracticeQuestion } from "./index.js";

export interface StudentQuestionStats {
  questionId: string;
  attempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  lastAnsweredAt?: string;
}

export interface StudentLearningSummary {
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  accuracy: number | null;
  uniqueQuestionsAttempted: number;
  questionsToReview: number;
  repeatedMistakes: number;
  questionStats: StudentQuestionStats[];
}

export interface BuildPracticeQuestionsInput {
  attempts: readonly StudentAnswerAttempt[];
  questions: readonly StudentPracticeQuestion[];
  maxQuestions?: number;
  seed?: string;
}

const CHOICES: Choice[] = ["A", "B", "C", "D"];

const choiceText = (question: StudentPracticeQuestion, choice: Choice) => question[`choice${choice}`];

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededShuffle = <T,>(items: readonly T[], seed: string): T[] => {
  const copy = [...items];
  let state = stableHash(seed) || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 16), 2246822519) >>> 0;
    const swapIndex = state % (index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
};

const compareDates = (left: string | undefined, right: string | undefined) => {
  const leftTime = left ? Date.parse(left) : Number.POSITIVE_INFINITY;
  const rightTime = right ? Date.parse(right) : Number.POSITIVE_INFINITY;
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
  return String(left ?? "").localeCompare(String(right ?? ""));
};

export const buildStudentLearningSummary = (
  attempts: readonly StudentAnswerAttempt[]
): StudentLearningSummary => {
  const questionStats = new Map<string, StudentQuestionStats>();
  let correctAttempts = 0;

  for (const attempt of attempts) {
    const existing = questionStats.get(attempt.questionId) ?? {
      questionId: attempt.questionId,
      attempts: 0,
      correctAttempts: 0,
      incorrectAttempts: 0
    };
    existing.attempts += 1;
    if (attempt.isCorrect) {
      correctAttempts += 1;
      existing.correctAttempts += 1;
    } else {
      existing.incorrectAttempts += 1;
    }
    if (!existing.lastAnsweredAt || compareDates(existing.lastAnsweredAt, attempt.answeredAt) < 0) {
      existing.lastAnsweredAt = attempt.answeredAt;
    }
    questionStats.set(attempt.questionId, existing);
  }

  const incorrectAttempts = attempts.length - correctAttempts;
  const stats = [...questionStats.values()];
  return {
    totalAttempts: attempts.length,
    correctAttempts,
    incorrectAttempts,
    accuracy: attempts.length === 0 ? null : Math.round((correctAttempts / attempts.length) * 100),
    uniqueQuestionsAttempted: stats.length,
    questionsToReview: stats.filter((stat) => stat.incorrectAttempts > 0).length,
    repeatedMistakes: stats.filter((stat) => stat.incorrectAttempts > 1).length,
    questionStats: stats
  };
};

/**
 * Selects unique questions for paper practice. Missed questions come first,
 * then the rest of the current set; the source question objects are cloned.
 */
export const buildStudentPracticeQuestions = ({
  attempts,
  questions,
  maxQuestions = 16,
  seed = "quizstrike-practice"
}: BuildPracticeQuestionsInput): StudentPracticeQuestion[] => {
  const safeLimit = Math.max(0, Math.floor(maxQuestions));
  if (safeLimit === 0) return [];

  const questionById = new Map<string, StudentPracticeQuestion>();
  for (const question of questions) {
    if (!questionById.has(question.id)) questionById.set(question.id, question);
  }

  const summary = buildStudentLearningSummary(attempts);
  const missedIds = new Set(
    summary.questionStats
      .filter((stat) => stat.incorrectAttempts > 0)
      .sort((left, right) =>
        right.incorrectAttempts - left.incorrectAttempts
        || right.attempts - left.attempts
        || compareDates(left.lastAnsweredAt, right.lastAnsweredAt)
        || left.questionId.localeCompare(right.questionId)
      )
      .map((stat) => stat.questionId)
  );
  const selectedIds: string[] = [];
  const addIfAvailable = (questionId: string) => {
    if (selectedIds.includes(questionId) || !questionById.has(questionId)) return;
    selectedIds.push(questionId);
  };

  // Mistakes are the highest-value review material, including repeated mistakes.
  for (const questionId of missedIds) addIfAvailable(questionId);
  // Use the set order for reinforcement and for students with few or no misses.
  for (const question of questions) addIfAvailable(question.id);
  // A deleted or unavailable source question can still be represented if the caller
  // supplied a snapshot in the question list.
  for (const attempt of attempts) addIfAvailable(attempt.questionId);

  return selectedIds.slice(0, safeLimit).map((questionId, index) => {
    const source = questionById.get(questionId)!;
    const shuffledChoices = seededShuffle(
      CHOICES.map((choice) => ({ choice, text: choiceText(source, choice) })),
      `${seed}:${source.id}:${index}`
    );
    const nextCorrectChoice = source.correctChoice
      ? CHOICES[shuffledChoices.findIndex((choice) => choice.choice === source.correctChoice)]
      : undefined;
    return {
      ...source,
      choiceA: shuffledChoices[0]?.text ?? source.choiceA,
      choiceB: shuffledChoices[1]?.text ?? source.choiceB,
      choiceC: shuffledChoices[2]?.text ?? source.choiceC,
      choiceD: shuffledChoices[3]?.text ?? source.choiceD,
      ...(nextCorrectChoice ? { correctChoice: nextCorrectChoice } : {})
    };
  });
};

const unsafeFilenameCharacters = /[<>:"/\\|?*]/g;

const replaceFilenameControlCharacters = (value: string) => Array.from(value, (character) => {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint < 32 ? "-" : character;
}).join("");

export const sanitizePracticeFilenamePart = (value: string, fallback = "Student") => {
  const sanitized = replaceFilenameControlCharacters(
    value
      .normalize("NFKC")
      .replace(unsafeFilenameCharacters, "-")
  )
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  const safe = sanitized.replace(/^[. -]+/g, "").slice(0, 80);
  return safe || fallback;
};

export const buildPracticeWorksheetFilename = (studentName: string, date = new Date()) => {
  const datePart = Number.isNaN(date.getTime()) ? "practice" : date.toISOString().slice(0, 10);
  return `QuizStrike-Practice-${sanitizePracticeFilenamePart(studentName)}-${datePart}.pdf`;
};
