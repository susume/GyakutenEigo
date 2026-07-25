import assert from "node:assert/strict";
import test from "node:test";
import { resolveFlagCapture, resolveFlagPlacement, type FlagState, type PlayerSession } from "@quizstrike/shared";
import {
  BOT_DIFFICULTIES,
  chooseBotRole,
  chooseBotTarget,
  createBotMemory,
  isTargetInsideBotAwareness,
  resolveBotAim,
  resolveBotPerceptionFocus,
  resolveBotSpacingGoal,
  resolveBotState,
  shouldAdvanceBotPatrolRoute,
  shouldBotAttemptFlagInteraction
} from "./botAI.js";

test("bot roles react to flag urgency instead of staying fixed", () => {
  assert.equal(chooseBotRole({
    gameMode: "flag",
    team: "red",
    flagState: "carried",
    flagCarrierTeam: "red",
    index: 0,
    teammateCount: 4,
    remainingSeconds: 90,
    personality: "supportive"
  }), "escort");
  assert.equal(chooseBotRole({
    gameMode: "flag",
    team: "blue",
    flagState: "carried",
    flagCarrierTeam: "red",
    index: 1,
    teammateCount: 4,
    remainingSeconds: 90,
    personality: "objective"
  }), "defender");
});

test("target selection respects target commitment but switches to a much greater threat", () => {
  const candidates = [
    { id: "committed", distance: 12, health: 100, visible: true, isFlagCarrier: false, attackingObjective: false, alliesNearTarget: 0 },
    { id: "carrier", distance: 22, health: 100, visible: true, isFlagCarrier: false, attackingObjective: false, alliesNearTarget: 0 }
  ];
  assert.equal(chooseBotTarget({
    candidates,
    currentTargetId: "committed",
    nowMs: 100,
    commitUntilMs: 1000,
    role: "attacker",
    personality: "aggressive",
    weaponRange: 36
  })?.id, "committed");
  assert.equal(chooseBotTarget({
    candidates: candidates.map((candidate) => candidate.id === "carrier"
      ? { ...candidate, isFlagCarrier: true, attackingObjective: true }
      : candidate),
    currentTargetId: "committed",
    nowMs: 100,
    commitUntilMs: 1000,
    role: "interceptor",
    personality: "objective",
    weaponRange: 36
  })?.id, "carrier");
});

test("reaction and difficulty keep aim imperfect and non-instant", () => {
  const memory = createBotMemory("aim-bot", 0, 0);
  memory.targetId = "target";
  memory.lastSeenTargetId = "target";
  memory.lastSeenAtMs = 0;
  const aim = resolveBotAim({
    memory,
    from: { x: 0, z: 0 },
    target: { x: 20, z: 0 },
    currentFacing: 0,
    profile: BOT_DIFFICULTIES.beginner,
    distance: 20,
    nowMs: 1000
  });
  assert.notEqual(aim.desiredFacing, Math.atan2(-20, 0));
  assert.ok(Math.abs(aim.facing) <= BOT_DIFFICULTIES.beginner.aimTurnRadians + 0.001);
});

test("bots retreat from danger unless the objective is urgent", () => {
  assert.equal(resolveBotState({
    current: "engage_enemy",
    health: 15,
    maxHealth: 100,
    targetVisible: true,
    hasLastKnownTarget: true,
    objectiveUrgent: false,
    role: "attacker",
    personality: "cautious",
    alliesNearby: 0,
    enemiesVisible: 2,
    flankAvailable: true,
    randomValue: 0.9
  }), "retreat");
  assert.equal(resolveBotState({
    current: "engage_enemy",
    health: 15,
    maxHealth: 100,
    targetVisible: true,
    hasLastKnownTarget: true,
    objectiveUrgent: true,
    role: "interceptor",
    personality: "cautious",
    alliesNearby: 0,
    enemiesVisible: 2,
    flankAvailable: false,
    randomValue: 0.9
  }), "take_cover");
});

test("a flag carrier attempts placement after leaving the original pickup position", () => {
  const carrier = {
    id: "carrier",
    team: "red",
    isAlive: true,
    x: -88,
    z: 0
  } satisfies Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "z">;
  const carriedFlag = {
    state: "carried",
    teamId: "red",
    carrierId: carrier.id,
    position: { x: 98, z: -74 }
  } satisfies FlagState;

  assert.equal(shouldBotAttemptFlagInteraction({
    flagState: "carried",
    carrierId: carriedFlag.carrierId,
    botId: carrier.id,
    botPosition: carrier,
    flagPosition: carriedFlag.position,
    interactionRadius: 7
  }), true);
  assert.equal(resolveFlagPlacement({
    flag: carriedFlag,
    player: carrier,
    nowMs: 10_000,
    holdSeconds: 30
  }).state, "placed");
  assert.equal(shouldBotAttemptFlagInteraction({
    flagState: "carried",
    carrierId: carriedFlag.carrierId,
    botId: "escort",
    botPosition: carrier,
    flagPosition: carriedFlag.position,
    interactionRadius: 7
  }), false);
});

test("bots cannot instantly capture a newly placed flag", () => {
  const interaction = {
    flagState: "placed" as const,
    botId: "blue-defender",
    botPosition: { x: -88, z: 0 },
    flagPosition: { x: -88, z: 0 },
    interactionRadius: 7,
    placedAtMs: 10_000,
    captureDelayMs: BOT_DIFFICULTIES.standard.objectiveCaptureDelayMs
  };

  assert.equal(shouldBotAttemptFlagInteraction({
    ...interaction,
    nowMs: 14_499
  }), false);
  assert.equal(shouldBotAttemptFlagInteraction({
    ...interaction,
    nowMs: 14_500
  }), true);
});

test("Blue cannot capture a flag that Red merely dropped", () => {
  const droppedFlag = {
    state: "dropped",
    teamId: "red",
    position: { x: 0, z: 0 }
  } satisfies FlagState;
  const blue = {
    id: "blue",
    team: "blue",
    isAlive: true,
    x: 0,
    z: 0
  } satisfies Pick<PlayerSession, "id" | "team" | "isAlive" | "x" | "z">;

  assert.equal(resolveFlagCapture(droppedFlag, blue).state, "dropped");
});

test("overlapping bots receive deterministic separation goals", () => {
  const sharedPosition = { x: -88, z: 0 };
  const teammates = [
    { id: "alpha", ...sharedPosition },
    { id: "bravo", ...sharedPosition }
  ];
  const alphaGoal = resolveBotSpacingGoal({
    botId: "alpha",
    botPosition: sharedPosition,
    desired: sharedPosition,
    teammates
  });
  const bravoGoal = resolveBotSpacingGoal({
    botId: "bravo",
    botPosition: sharedPosition,
    desired: sharedPosition,
    teammates
  });

  assert.notDeepEqual(alphaGoal, sharedPosition);
  assert.notDeepEqual(bravoGoal, sharedPosition);
  assert.notDeepEqual(alphaGoal, bravoGoal);
});

test("patrolling bots advance after reaching a route point instead of parking forever", () => {
  assert.equal(shouldAdvanceBotPatrolRoute({
    state: "patrol",
    hasTarget: false,
    distanceToGoal: 3.9
  }), true);
  assert.equal(shouldAdvanceBotPatrolRoute({
    state: "patrol",
    hasTarget: true,
    distanceToGoal: 0
  }), false);
  assert.equal(shouldAdvanceBotPatrolRoute({
    state: "defend_objective",
    hasTarget: false,
    distanceToGoal: 0
  }), false);
});

test("bots notice enemies at close range even outside their forward view", () => {
  assert.equal(isTargetInsideBotAwareness({ distance: 8, inFieldOfView: false }), true);
  assert.equal(isTargetInsideBotAwareness({ distance: 18, inFieldOfView: false }), false);
  assert.equal(isTargetInsideBotAwareness({ distance: 18, inFieldOfView: true }), true);
});

test("bot perception preserves acquisition time until reaction completes", () => {
  const acquired = resolveBotPerceptionFocus({
    visibleTargetIds: ["player"],
    nowMs: 1000,
    reactionMs: 500
  });
  assert.deepEqual(acquired, {
    focusId: "player",
    visibleSinceAtMs: 1000,
    reacted: false
  });
  assert.deepEqual(resolveBotPerceptionFocus({
    visibleTargetIds: ["player"],
    currentTargetId: acquired.focusId,
    visibleSinceAtMs: acquired.visibleSinceAtMs,
    nowMs: 1500,
    reactionMs: 500
  }), {
    focusId: "player",
    visibleSinceAtMs: 1000,
    reacted: true
  });
  assert.deepEqual(resolveBotPerceptionFocus({
    visibleTargetIds: [],
    currentTargetId: "player",
    visibleSinceAtMs: 1000,
    nowMs: 1500,
    reactionMs: 500
  }), { reacted: false });
});
