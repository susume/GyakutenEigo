import { randomInt } from "node:crypto";
import type { AthleticsPlayerState } from "@quizstrike/shared";

type QuestionBag = Pick<AthleticsPlayerState, "questionOrder" | "questionCursor">;

/** Reading/rejoining never advances the bag; only an accepted correct answer does. */
export const getAthleticsQuestion = <T extends { id: string }>(
  questions: readonly T[],
  state: QuestionBag,
  pickIndex: (exclusiveMax: number) => number = randomInt
): T | undefined => {
  if (questions.length === 0) return undefined;
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const cursor = state.questionCursor ?? 0;
  const previous = state.questionOrder;
  if (!previous || previous.length !== questions.length || cursor >= previous.length
    || previous.some((id) => !questionsById.has(id))) {
    const order = questions.map((question) => question.id);
    for (let index = order.length - 1; index > 0; index--) {
      const pick = pickIndex(index + 1);
      [order[index], order[pick]] = [order[pick]!, order[index]!];
    }
    // Do not repeat the last completed question at the start of a new bag.
    if (order.length > 1 && order[0] === previous?.at(-1)) {
      const pick = 1 + pickIndex(order.length - 1);
      [order[0], order[pick]] = [order[pick]!, order[0]!];
    }
    // Three or more questions can also avoid replaying the previous order.
    if (order.length > 2 && order.every((id, index) => id === previous?.[index])) {
      [order[1], order[2]] = [order[2]!, order[1]!];
    }
    state.questionOrder = order;
    state.questionCursor = 0;
  }
  return questionsById.get(state.questionOrder![state.questionCursor ?? 0]!);
};
