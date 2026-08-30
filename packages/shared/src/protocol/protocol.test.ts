import assert from "node:assert/strict";
import test from "node:test";
import {
  BoundedEventIdCache,
  FlagPlantedEventSchema,
  PROTOCOL_VERSION,
  createClientHello,
  isSupportedProtocolVersion,
  validateClientCommand,
  validateSessionSnapshot
} from "./index.js";

test("canonical client messages validate and retain their discriminator", () => {
  const hello = validateClientCommand("client_hello", createClientHello("test-client"));
  assert.equal(hello.success, true);
  if (hello.success) assert.equal(hello.data.type, "client_hello");

  const movement = validateClientCommand("player_position", {
    x: 12,
    y: 2,
    z: -8,
    facing: Math.PI,
    crouching: true,
    movementSequence: 17,
    movementEpoch: 2
  });
  assert.equal(movement.success, true);
  if (movement.success) {
    assert.equal(movement.data.type, "player_position");
    assert.equal(movement.data.movementSequence, 17);
    assert.equal(movement.data.movementEpoch, 2);
  }
  assert.equal(validateClientCommand("player_position", {
    x: 12,
    z: -8,
    facing: Math.PI,
    sprinting: true
  }).success, false, "the removed sprinting field should no longer be accepted");

  const bulkSnowballs = validateClientCommand("buy_snowballs", { packSize: "large" });
  assert.equal(bulkSnowballs.success, true);
  assert.equal(validateClientCommand("buy_snowballs", {}).success, true);
  assert.equal(validateClientCommand("buy_snowballs", { packSize: "oversized" }).success, false);
});

test("unknown, missing, out-of-range, and oversized client messages fail safely", () => {
  assert.deepEqual(validateClientCommand("not_real", {}), {
    success: false,
    code: "UNKNOWN_MESSAGE",
    message: "The message type is not supported."
  });
  assert.equal(validateClientCommand("fire_action", { x: 0, z: 0 }).success, false);
  assert.equal(validateClientCommand("player_position", { x: 100_000, z: 0 }).success, false);
  const oversized = validateClientCommand("buy_gear", { gearId: "x".repeat(20_000) });
  assert.equal(oversized.success, false);
  if (!oversized.success) assert.equal(oversized.code, "MESSAGE_TOO_LARGE");
});

test("protocol version support is explicit", () => {
  assert.equal(PROTOCOL_VERSION, 1);
  assert.equal(isSupportedProtocolVersion(PROTOCOL_VERSION), true);
  assert.equal(isSupportedProtocolVersion(0), false);
  assert.equal(isSupportedProtocolVersion(PROTOCOL_VERSION + 1), false);
});

test("one-time event schemas enforce timestamp order and serialization", () => {
  const event = {
    type: "flag_planted" as const,
    eventId: "event-1",
    objectiveId: "objective-1",
    plantedByPlayerId: "player-1",
    plantedAt: 1_000,
    expiresAt: 31_000
  };
  assert.deepEqual(FlagPlantedEventSchema.parse(JSON.parse(JSON.stringify(event))), event);
  assert.equal(FlagPlantedEventSchema.safeParse({ ...event, expiresAt: 999 }).success, false);
});

test("bounded event IDs reject duplicates, expire, and clear", () => {
  let current = 1_000;
  const cache = new BoundedEventIdCache(2, 100, () => current);
  assert.equal(cache.accept("one"), true);
  assert.equal(cache.accept("one"), false);
  assert.equal(cache.accept("two"), true);
  assert.equal(cache.accept("three"), true);
  assert.equal(cache.size, 2);
  current += 101;
  assert.equal(cache.accept("two"), true);
  cache.clear();
  assert.equal(cache.size, 0);
});

test("reconnect snapshots receive structural runtime validation", () => {
  const snapshot = {
    id: "session-1",
    teacherId: "teacher-1",
    quizSetId: "quiz-1",
    sessionCode: "ABC123",
    status: "active",
    maxPlayers: 40,
    currentRound: 1,
    settings: { gameMode: "flag" },
    players: [],
    createdAt: new Date(0).toISOString()
  };
  assert.equal(validateSessionSnapshot(snapshot).success, true);
  assert.equal(validateSessionSnapshot({
    ...snapshot,
    learningPulse: {
      classAccuracy: 75,
      answersSubmitted: 8,
      studentsNeedingReview: 1,
      difficultQuestion: { questionId: "q1", prompt: "Question", correct: 3, attempts: 4, accuracy: 75 }
    }
  }).success, true);
  assert.equal(validateSessionSnapshot({
    ...snapshot,
    learningPulse: { classAccuracy: 150, answersSubmitted: -1, studentsNeedingReview: 0 }
  }).success, false);
  assert.equal(validateSessionSnapshot({ ...snapshot, players: "invalid" }).success, false);
});
