import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPracticeWorksheetFilename,
  buildStudentLearningSummary,
  buildStudentPracticeQuestions,
  type Choice,
  type Question,
  type StudentAnswerAttempt,
  type StudentPracticeQuestion
} from "./index.js";

const makeQuestion = (id: string, prompt = `Question ${id}`): Question => ({
  id,
  quizSetId: "set-1",
  prompt,
  choiceA: "A answer",
  choiceB: "B answer",
  choiceC: "C answer",
  choiceD: "D answer",
  correctChoice: "B",
  explanation: "Optional teacher explanation",
  createdAt: "2026-08-10T00:00:00.000Z"
});

const makeAttempt = (overrides: Partial<StudentAnswerAttempt> = {}): StudentAnswerAttempt => ({
  id: "attempt-1",
  questionId: "q-1",
  quizSetId: "set-1",
  selectedChoice: "B",
  correctChoice: "B",
  isCorrect: true,
  answeredAt: "2026-08-10T00:00:00.000Z",
  moneyAwarded: 200,
  ...overrides
});

test("student learning summary retains selected/correct answers and counts repeated mistakes", () => {
  const attempts = [
    makeAttempt({ id: "correct-1", questionId: "q-1", selectedChoice: "B", correctChoice: "B", isCorrect: true }),
    makeAttempt({ id: "wrong-1", questionId: "q-2", selectedChoice: "A", correctChoice: "C", isCorrect: false }),
    makeAttempt({ id: "wrong-2", questionId: "q-2", selectedChoice: "D", correctChoice: "C", isCorrect: false, answeredAt: "2026-08-10T00:01:00.000Z" }),
    makeAttempt({ id: "correct-2", questionId: "q-3", selectedChoice: "A", correctChoice: "A", isCorrect: true })
  ];
  const summary = buildStudentLearningSummary(attempts);

  assert.equal(attempts[1]!.selectedChoice, "A");
  assert.equal(attempts[1]!.correctChoice, "C");
  assert.deepEqual(
    {
      totalAttempts: summary.totalAttempts,
      correctAttempts: summary.correctAttempts,
      incorrectAttempts: summary.incorrectAttempts,
      accuracy: summary.accuracy,
      uniqueQuestionsAttempted: summary.uniqueQuestionsAttempted,
      questionsToReview: summary.questionsToReview,
      repeatedMistakes: summary.repeatedMistakes
    },
    {
      totalAttempts: 4,
      correctAttempts: 2,
      incorrectAttempts: 2,
      accuracy: 50,
      uniqueQuestionsAttempted: 3,
      questionsToReview: 1,
      repeatedMistakes: 1
    }
  );
});

test("zero-answer, perfect, and zero-score summaries are safe", () => {
  assert.deepEqual(buildStudentLearningSummary([]), {
    totalAttempts: 0,
    correctAttempts: 0,
    incorrectAttempts: 0,
    accuracy: null,
    uniqueQuestionsAttempted: 0,
    questionsToReview: 0,
    repeatedMistakes: 0,
    questionStats: []
  });
  const perfect = buildStudentLearningSummary([
    makeAttempt({ questionId: "q-1" }),
    makeAttempt({ id: "perfect-2", questionId: "q-2" })
  ]);
  assert.equal(perfect.accuracy, 100);
  assert.equal(perfect.questionsToReview, 0);
  const zero = buildStudentLearningSummary([
    makeAttempt({ questionId: "q-1", selectedChoice: "A", isCorrect: false }),
    makeAttempt({ id: "zero-2", questionId: "q-2", selectedChoice: "D", isCorrect: false })
  ]);
  assert.equal(zero.accuracy, 0);
  assert.equal(zero.questionsToReview, 2);
});

test("practice selection prioritizes repeated mistakes, fills from the set, and is deterministic", () => {
  const sourceQuestions = [makeQuestion("q-1"), makeQuestion("q-2"), makeQuestion("q-3")];
  const attempts = [
    makeAttempt({ questionId: "q-2", selectedChoice: "A", isCorrect: false }),
    makeAttempt({ id: "repeat", questionId: "q-2", selectedChoice: "D", isCorrect: false }),
    makeAttempt({ id: "right", questionId: "q-1" })
  ];
  const first = buildStudentPracticeQuestions({ attempts, questions: sourceQuestions, maxQuestions: 3, seed: "fixed" });
  const second = buildStudentPracticeQuestions({ attempts, questions: sourceQuestions, maxQuestions: 3, seed: "fixed" });

  assert.deepEqual(first, second);
  assert.deepEqual(first.map((question) => question.id), ["q-2", "q-1", "q-3"]);
  const shuffledCorrectChoice = first[0]!.correctChoice;
  assert.ok(shuffledCorrectChoice);
  assert.equal(first[0]![`choice${shuffledCorrectChoice as Choice}`], "B answer");
  assert.deepEqual(sourceQuestions[1], makeQuestion("q-2"));
});

test("public filler questions shuffle without acquiring private answer keys", () => {
  const {
    correctChoice: _correctChoice,
    explanation: _explanation,
    ...publicQuestion
  } = makeQuestion("q-public");
  const source: StudentPracticeQuestion = publicQuestion;
  const result = buildStudentPracticeQuestions({
    attempts: [],
    questions: [source],
    seed: "public-filler"
  });

  assert.equal(result.length, 1);
  assert.equal("correctChoice" in result[0]!, false);
  assert.equal("explanation" in result[0]!, false);
  assert.deepEqual(source, publicQuestion);
});

test("practice selection supports 100% and 0% scores without duplicating questions", () => {
  const questions = [makeQuestion("q-1"), makeQuestion("q-2"), makeQuestion("q-3")];
  const perfect = buildStudentPracticeQuestions({
    attempts: [makeAttempt({ questionId: "q-1" })],
    questions,
    maxQuestions: 10,
    seed: "perfect"
  });
  const zero = buildStudentPracticeQuestions({
    attempts: [makeAttempt({ questionId: "q-1", isCorrect: false, selectedChoice: "A" })],
    questions,
    maxQuestions: 10,
    seed: "zero"
  });
  assert.deepEqual(perfect.map((question) => question.id), ["q-1", "q-2", "q-3"]);
  assert.deepEqual(zero.map((question) => question.id), ["q-1", "q-2", "q-3"]);
  assert.equal(new Set(zero.map((question) => question.id)).size, zero.length);
});

test("worksheet filenames use a safe display name and never expose internal ids", () => {
  assert.equal(
    buildPracticeWorksheetFilename("Peter / class 7", new Date("2026-08-10T00:00:00.000Z")),
    "QuizStrike-Practice-Peter - class 7-2026-08-10.pdf"
  );
  assert.equal(
    buildPracticeWorksheetFilename("..\\", new Date("2026-08-10T00:00:00.000Z")),
    "QuizStrike-Practice-Student-2026-08-10.pdf"
  );
});
