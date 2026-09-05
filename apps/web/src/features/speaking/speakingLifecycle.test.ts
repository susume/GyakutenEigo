import assert from "node:assert/strict";
import test from "node:test";
import { mergeSpeakingTurns, nextSpeakingPollDelay, shouldAcceptSpeakingRevision, speakingTimerReference } from "./speakingLifecycle.js";

test("speaking lifecycle polling backs off with bounded jitter", () => {
  assert.equal(nextSpeakingPollDelay({ stablePolls: 0 }, () => 0), 1_750);
  assert.equal(nextSpeakingPollDelay({ stablePolls: 6 }, () => 1), 8_000);
  assert.equal(nextSpeakingPollDelay({ stablePolls: 4, urgent: true }, () => 0), 1_000);
});

test("speaking lifecycle rejects stale revisions and deduplicates transcript turns", () => {
  assert.equal(shouldAcceptSpeakingRevision(4, 3), false);
  assert.equal(shouldAcceptSpeakingRevision(4, 4), true);
  const turns = mergeSpeakingTurns(
    [{ id: "a", participantId: "p", speaker: "ai", text: "Old", createdAt: "2026-09-05T00:00:02.000Z" }],
    [
      { id: "a", participantId: "p", speaker: "ai", text: "Updated", createdAt: "2026-09-05T00:00:02.000Z" },
      { id: "b", participantId: "p", speaker: "student", text: "Hi", createdAt: "2026-09-05T00:00:01.000Z" }
    ]
  );
  assert.deepEqual(turns.map((turn) => turn.id), ["b", "a"]);
  assert.equal(turns[1]?.text, "Updated");
});

test("speaking lifecycle freezes the timer at participant or session terminal time", () => {
  assert.equal(speakingTimerReference({ status: "completed", finishedAt: "2026-09-05T00:01:00.000Z" }, { status: "active" }, Date.parse("2026-09-05T00:02:00.000Z")), "2026-09-05T00:01:00.000Z");
  assert.equal(speakingTimerReference({ status: "joined" }, { status: "ended", endedAt: "2026-09-05T00:03:00.000Z" }, Date.parse("2026-09-05T00:04:00.000Z")), "2026-09-05T00:03:00.000Z");
});
