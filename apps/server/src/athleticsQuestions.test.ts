import assert from "node:assert/strict";
import test from "node:test";
import { getAthleticsQuestion } from "./athleticsQuestions.js";

const questions = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
type Bag = { questionOrder?: string[]; questionCursor?: number };

test("each student receives every question once before reshuffling, without a boundary repeat", () => {
  const state: Bag = {};
  let last: string | undefined;
  let previousOrder: string[] | undefined;
  for (let cycle = 0; cycle < 8; cycle++) {
    const order: string[] = [];
    for (let index = 0; index < questions.length; index++) {
      const question = getAthleticsQuestion(questions, state)!;
      assert.notEqual(question.id, last);
      assert.equal(getAthleticsQuestion(questions, state)?.id, question.id, "reading must keep the assignment");
      order.push(question.id);
      last = question.id;
      state.questionCursor = (state.questionCursor ?? 0) + 1;
    }
    assert.deepEqual([...order].sort(), questions.map((question) => question.id));
    if (previousOrder) assert.notDeepEqual(order, previousOrder);
    previousOrder = order;
  }
});

test("students get independent bags and serialized reconnect state retains the exact assignment", () => {
  const alpha: Bag = {};
  const bravo: Bag = {};
  getAthleticsQuestion(questions, alpha, () => 0);
  getAthleticsQuestion(questions, bravo, (max) => max - 1);
  assert.notDeepEqual(alpha.questionOrder, bravo.questionOrder);
  alpha.questionCursor = 2;
  const restored: Bag = JSON.parse(JSON.stringify(alpha));
  assert.equal(getAthleticsQuestion(questions, restored)?.id, alpha.questionOrder![2]);
  assert.deepEqual(restored, alpha);
});

test("reshuffling cannot replay the previous order even when random picks repeat", () => {
  const state: Bag = {};
  getAthleticsQuestion(questions, state, () => 0);
  const previous = [...state.questionOrder!];
  state.questionCursor = questions.length;
  getAthleticsQuestion(questions, state, () => 0);
  assert.notDeepEqual(state.questionOrder, previous);
  assert.notEqual(state.questionOrder![0], previous.at(-1));
});

test("small pools keep supplying questions and a changed pool replaces stale IDs", () => {
  for (const size of [0, 1, 2]) {
    const state: Bag = {};
    const pool = questions.slice(0, size);
    let last: string | undefined;
    for (let index = 0; index < 12; index++) {
      const question = getAthleticsQuestion(pool, state);
      if (size === 0) assert.equal(question, undefined);
      else {
        assert.ok(question);
        if (size > 1) assert.notEqual(question.id, last);
        last = question.id;
        state.questionCursor = (state.questionCursor ?? 0) + 1;
      }
    }
  }
  const state: Bag = { questionOrder: ["stale"], questionCursor: 0 };
  assert.ok(questions.includes(getAthleticsQuestion(questions, state)!));
  assert.equal(state.questionOrder!.length, questions.length);
});
