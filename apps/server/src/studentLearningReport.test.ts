import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerLog, QuizSet } from "@quizstrike/shared";
import { buildStudentLearningAttempts } from "./studentLearningReport.js";

const quizSet: QuizSet = {
  id: "set-current-game",
  teacherId: "teacher-1",
  title: "Current game set",
  questions: [
    {
      id: "question-a",
      quizSetId: "set-current-game",
      prompt: "Question A",
      choiceA: "A",
      choiceB: "B",
      choiceC: "C",
      choiceD: "D",
      correctChoice: "A",
      createdAt: "2026-08-10T00:00:00.000Z"
    },
    {
      id: "question-b",
      quizSetId: "set-current-game",
      prompt: "Question B",
      choiceA: "A",
      choiceB: "B",
      choiceC: "C",
      choiceD: "D",
      correctChoice: "B",
      createdAt: "2026-08-10T00:00:01.000Z"
    }
  ],
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z"
};

const unrelatedQuizSet: QuizSet = {
  ...quizSet,
  id: "set-unrelated",
  title: "Unrelated set",
  questions: [{ ...quizSet.questions[0]!, id: "unrelated-question", quizSetId: "set-unrelated" }]
};

const makeAnswer = (overrides: Partial<AnswerLog> = {}): AnswerLog => ({
  id: "answer-1",
  gameSessionId: "game-a",
  playerSessionId: "student-a",
  questionId: "question-a",
  selectedChoice: "A",
  correctChoice: "A",
  isCorrect: true,
  moneyAwarded: 400,
  answeredAt: "2026-08-10T00:00:00.000Z",
  context: "main",
  ...overrides
});

test("student history aggregates every round in the current GameSession", () => {
  const answers = [
    ...Array.from({ length: 5 }, (_, index) => makeAnswer({ id: `round-1-${index}`, answeredAt: `2026-08-10T00:0${index}:00.000Z` })),
    ...Array.from({ length: 6 }, (_, index) => makeAnswer({ id: `round-2-${index}`, answeredAt: `2026-08-10T00:1${index}:00.000Z`, isCorrect: index < 4 })),
    ...Array.from({ length: 7 }, (_, index) => makeAnswer({ id: `round-3-${index}`, answeredAt: `2026-08-10T00:2${index}:00.000Z`, isCorrect: index < 6 }))
  ];

  const attempts = buildStudentLearningAttempts({
    gameSessionId: "game-a",
    playerSessionId: "student-a",
    gameQuizSet: quizSet,
    allQuizSets: [quizSet, unrelatedQuizSet],
    answers
  });

  assert.equal(attempts.length, 18);
  assert.equal(attempts.filter((attempt) => attempt.isCorrect).length, 15);
  assert.equal(attempts.filter((attempt) => !attempt.isCorrect).length, 3);
});

test("student history excludes previous games, other students, and unrelated question sets", () => {
  const attempts = buildStudentLearningAttempts({
    gameSessionId: "game-a",
    playerSessionId: "student-a",
    gameQuizSet: quizSet,
    allQuizSets: [quizSet, unrelatedQuizSet],
    answers: [
      makeAnswer({ id: "current-game", questionId: "question-a" }),
      makeAnswer({ id: "previous-game", gameSessionId: "game-before" }),
      makeAnswer({ id: "other-student", playerSessionId: "student-b" }),
      makeAnswer({ id: "unrelated-question", questionId: "unrelated-question" })
    ]
  });

  assert.deepEqual(attempts.map((attempt) => attempt.id), ["current-game"]);
});

test("quiz-set isolation uses the containing set even when an imported question has a stale quizSetId", () => {
  const staleImportedSet: QuizSet = {
    ...unrelatedQuizSet,
    questions: [{
      ...unrelatedQuizSet.questions[0]!,
      id: "stale-imported-question",
      quizSetId: quizSet.id
    }]
  };
  const attempts = buildStudentLearningAttempts({
    gameSessionId: "game-a",
    playerSessionId: "student-a",
    gameQuizSet: quizSet,
    allQuizSets: [quizSet, staleImportedSet],
    answers: [makeAnswer({ id: "stale-import", questionId: "stale-imported-question" })]
  });

  assert.deepEqual(attempts, []);
});

test("a duplicate question id in another set cannot hide a current-game question", () => {
  const duplicateIdSet: QuizSet = {
    ...unrelatedQuizSet,
    questions: [{ ...unrelatedQuizSet.questions[0]!, id: "question-a" }]
  };
  const attempts = buildStudentLearningAttempts({
    gameSessionId: "game-a",
    playerSessionId: "student-a",
    gameQuizSet: quizSet,
    allQuizSets: [quizSet, duplicateIdSet],
    answers: [makeAnswer({ id: "current-question-with-duplicate", questionId: "question-a" })]
  });

  assert.deepEqual(attempts.map((attempt) => attempt.id), ["current-question-with-duplicate"]);
});

test("historical correctChoice snapshots survive question edits and reconnect ordering", () => {
  const attempts = buildStudentLearningAttempts({
    gameSessionId: "game-a",
    playerSessionId: "student-a",
    gameQuizSet: quizSet,
    answers: [
      makeAnswer({ id: "later", answeredAt: "2026-08-10T00:02:00.000Z", correctChoice: "B", selectedChoice: "A", isCorrect: false }),
      makeAnswer({ id: "earlier", answeredAt: "2026-08-10T00:01:00.000Z", correctChoice: "A" })
    ]
  });

  assert.deepEqual(attempts.map((attempt) => attempt.id), ["earlier", "later"]);
  assert.equal(attempts[1]?.correctChoice, "B");
});

test("a reconnect cannot duplicate an earlier answer log", () => {
  const answer = makeAnswer({ id: "reconnect-safe" });
  const attempts = buildStudentLearningAttempts({
    gameSessionId: "game-a",
    playerSessionId: "student-a",
    gameQuizSet: quizSet,
    answers: [answer, { ...answer }, makeAnswer({ id: "later-answer", answeredAt: "2026-08-10T00:01:00.000Z" })]
  });

  assert.deepEqual(attempts.map((attempt) => attempt.id), ["reconnect-safe", "later-answer"]);
});
