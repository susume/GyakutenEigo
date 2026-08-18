import assert from "node:assert/strict";
import test from "node:test";
import { emptyEditorQuestion, questionsFromStudyList, reconcileEditorQuestions, validateEditorQuestions } from "./studySetEditorModel.js";

test("study-list import creates complete vocabulary questions", () => {
  const questions = questionsFromStudyList("environment - 環境\ngovernment - 政府\neconomy - 経済\nculture - 文化");
  assert.equal(questions.length, 4);
  const first = questions[0];
  assert.equal(first[`choice${first.correctChoice}`], "環境");
  assert.deepEqual(validateEditorQuestions(questions), {});
});

test("study-list import can move the correct answer away from the first position", () => {
  const questions = questionsFromStudyList(
    "environment - 環境\ngovernment - 政府\neconomy - 経済\nculture - 文化",
    () => 0
  );
  assert.equal(questions[0].correctChoice, "D");
  assert.equal(questions[0][`choice${questions[0].correctChoice}`], "環境");
});

test("short study-list imports still randomize across all four answer positions", () => {
  const questions = questionsFromStudyList("environment - 環境\ngovernment - 政府", () => 0);
  const first = questions[0];
  assert.equal(first.correctChoice, "D");
  assert.equal(first.choiceD, "環境");
  assert.equal(new Set([first.choiceA, first.choiceB, first.choiceC, first.choiceD]).size, 4);

  const unshuffled = questionsFromStudyList("environment - 環境\ngovernment - 政府", () => 1)[0];
  assert.equal(unshuffled.correctChoice, "A");
  assert.equal(unshuffled.choiceA, "環境");
});

test("inline validation names the incomplete question", () => {
  const first = emptyEditorQuestion();
  const second = { ...emptyEditorQuestion(), prompt: "Complete?", choiceA: "Yes", choiceB: "No", choiceC: "Maybe", choiceD: "Later" };
  const errors = validateEditorQuestions([first, second]);
  assert.match(errors[first.key], /Question 1/);
  assert.equal(errors[second.key], undefined);
});

test("save retry reconciliation adopts a question already persisted by the server", () => {
  const draft = {
    ...emptyEditorQuestion(),
    prompt: "What is the capital of Japan?",
    choiceA: "Tokyo",
    choiceB: "Osaka",
    choiceC: "Kyoto",
    choiceD: "Nagoya"
  };
  const persisted = {
    ...draft,
    id: "question-1",
    quizSetId: "set-1",
    createdAt: "2026-08-12T00:00:00.000Z",
    position: 0
  };
  const [reconciled] = reconcileEditorQuestions([draft], [persisted]);
  assert.equal(reconciled.id, "question-1");
  assert.equal(reconciled.key, "question-1");
});
