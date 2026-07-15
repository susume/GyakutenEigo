import assert from "node:assert/strict";
import test from "node:test";
import { planRoundConclusion } from "./roundFlow.js";

test("Flag Mode plans a result intermission before the next round", () => {
  const result = planRoundConclusion({
    currentRound: 1,
    roundCount: 3,
    roundWins: { blue: 0, red: 0 },
    winner: "red",
    reason: "Red Team protected the flag"
  });

  assert.equal(result.eventMessage, "Red Team wins round 1: Red Team protected the flag.");
  assert.equal(result.nextRound, 2);
  assert.equal(result.matchResult, undefined);
  assert.deepEqual(result.roundWins, { blue: 0, red: 1 });
});

test("Classic Tag plans a winner and Game Over result on the final round", () => {
  const result = planRoundConclusion({
    currentRound: 2,
    roundCount: 2,
    roundWins: { blue: 1, red: 0 },
    winner: "blue",
    reason: "Higher team score when time expired"
  });

  assert.equal(result.nextRound, undefined);
  assert.equal(result.matchWinner, "blue");
  assert.equal(result.matchResult, "Blue Team wins the match 2-0.");
  assert.deepEqual(result.roundWins, { blue: 2, red: 0 });
});
