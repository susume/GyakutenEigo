import assert from "node:assert/strict";
import test from "node:test";
import { buildLearningPulse, type AnswerLog, type PlayerSession, type Question } from "./index.js";

const question = (id: string, prompt: string): Question => ({
  id,
  quizSetId: "quiz-1",
  prompt,
  choiceA: "A",
  choiceB: "B",
  choiceC: "C",
  choiceD: "D",
  correctChoice: "A",
  createdAt: "2026-08-01T00:00:00.000Z"
});

const player = (id: string, isBot = false): PlayerSession => ({
  id,
  gameSessionId: "session-1",
  nickname: id,
  team: "blue",
  money: 0,
  isAlive: true,
  score: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  gear: "starter_blaster",
  joinedAt: "2026-08-01T00:00:00.000Z",
  ...(isBot ? { isBot: true } : {})
});

const answer = (id: string, playerSessionId: string, questionId: string, isCorrect: boolean, gameSessionId = "session-1"): AnswerLog => ({
  id,
  gameSessionId,
  playerSessionId,
  questionId,
  selectedChoice: isCorrect ? "A" : "B",
  correctChoice: "A",
  isCorrect,
  moneyAwarded: 0,
  answeredAt: `2026-08-01T00:00:0${id}Z`
});

test("learning pulse excludes bots and unrelated games", () => {
  const pulse = buildLearningPulse({
    sessionId: "session-1",
    players: [player("human"), player("bot", true)],
    questions: [question("q1", "Which sentence is correct?")],
    answers: [
      answer("1", "human", "q1", true),
      answer("2", "human", "q1", false),
      answer("3", "human", "q1", false),
      answer("4", "bot", "q1", true),
      answer("5", "human", "q1", true, "other-session")
    ]
  });
  assert.deepEqual(pulse.classAccuracy, 33);
  assert.equal(pulse.answersSubmitted, 3);
  assert.equal(pulse.studentsNeedingReview, 1);
  assert.equal(pulse.difficultQuestion?.attempts, 3);
});

test("duplicate records do not inflate repeated-round aggregation", () => {
  const repeated = answer("repeat", "human", "q1", true);
  const pulse = buildLearningPulse({
    sessionId: "session-1",
    players: [player("human")],
    questions: [question("q1", "Round question")],
    answers: [repeated, repeated, answer("round-2", "human", "q1", false), answer("round-3", "human", "q1", true)]
  });
  assert.equal(pulse.answersSubmitted, 3);
  assert.equal(pulse.classAccuracy, 67);
});

test("authoritative answers remain in the class pulse after a learner leaves the live roster", () => {
  const pulse = buildLearningPulse({
    sessionId: "session-1",
    players: [],
    questions: [question("q1", "Earlier participant question")],
    answers: [answer("1", "removed-human", "q1", true)]
  });
  assert.equal(pulse.answersSubmitted, 1);
  assert.equal(pulse.classAccuracy, 100);
});

test("difficult ranking is deterministic and ignores insufficient samples", () => {
  const answers = [
    answer("1", "human", "q1", false), answer("2", "human", "q1", true), answer("3", "human", "q1", false),
    answer("4", "human", "q2", false), answer("5", "human", "q2", true), answer("6", "human", "q2", false)
  ];
  const pulse = buildLearningPulse({
    sessionId: "session-1",
    players: [player("human")],
    questions: [question("q1", "Alpha"), question("q2", "Beta")],
    answers
  });
  assert.equal(pulse.difficultQuestion?.prompt, "Alpha");
  assert.equal(pulse.strongestQuestion?.prompt, "Alpha");
  const sparse = buildLearningPulse({
    sessionId: "session-1",
    players: [player("human")],
    questions: [question("q1", "Only one")],
    answers: [answer("1", "human", "q1", false)]
  });
  assert.equal(sparse.difficultQuestion, undefined);
});
