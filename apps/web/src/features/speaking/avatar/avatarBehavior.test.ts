import assert from "node:assert/strict";
import test from "node:test";
import { speakingUiState, type SpeakingVoiceState } from "../speakingLifecycle.js";
import { AvatarBehavior, avatarMotionScale, speakingAvatarState, AVATAR_FRAME_INTERVAL_MS, AVATAR_MAX_PIXEL_RATIO } from "./avatarBehavior.js";

const randomSequence = () => {
  let seed = 42;
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
};

test("avatar follows existing conversation states, including playback and replay", () => {
  const cases: [SpeakingVoiceState, string][] = [
    ["ready", "idle"], ["ai_speaking", "speaking"], ["student_recording", "listening"],
    ["processing", "thinking"], ["finishing", "thinking"], ["evaluating", "thinking"],
    ["completed", "idle"], ["error", "idle"]
  ];
  for (const [voiceState, expected] of cases) assert.equal(speakingAvatarState(speakingUiState(voiceState)), expected);
  // Greeting/replies/replay share this lifecycle; end/cancel returns to ready.
  assert.equal(speakingAvatarState(speakingUiState("ai_speaking")), "speaking");
  assert.equal(speakingAvatarState(speakingUiState("ready")), "idle");
  assert.equal(speakingAvatarState("ai-speaking", true), "paused");
  assert.equal(speakingAvatarState("ready", true), "paused");
});

test("procedural speech has smooth, bounded vowels and natural silent intervals without boundary events", () => {
  const behavior = new AvatarBehavior(randomSequence());
  let audibleFrames = 0;
  let quietFrames = 0;
  let previous = 0;
  const vowels = new Set<number>();
  for (let i = 0; i < 600; i += 1) {
    const p = behavior.step(1 / 30, "speaking", false);
    assert.ok(p.mouthOpen >= 0 && p.mouthOpen <= 0.43, "Speech must avoid wide mouth openings");
    assert.ok(Math.abs(p.mouthOpen - previous) < 0.21);
    previous = p.mouthOpen;
    if (p.mouthOpen > 0.15) audibleFrames += 1;
    if (p.mouthOpen < 0.04) quietFrames += 1;
    for (let j = 0; j < p.mouth.length; j += 1) if (p.mouth[j]! > 0.15) vowels.add(j);
  }
  assert.ok(audibleFrames > 150);
  assert.ok(quietFrames > 20);
  assert.equal(vowels.size, 5);
});

test("idle, listening, thinking and paused release the mouth promptly after playback stops", () => {
  for (const state of ["idle", "listening", "thinking", "paused"] as const) {
    const behavior = new AvatarBehavior(() => 0.5);
    for (let i = 0; i < 5; i += 1) behavior.step(1 / 30, "speaking", false);
    const previous = behavior.pose.mouthOpen;
    assert.ok(previous > 0.2);
    behavior.step(1 / 30, state, false);
    assert.ok(behavior.pose.mouthOpen < previous);
    for (let i = 0; i < 6; i += 1) behavior.step(1 / 30, state, false);
    assert.ok(behavior.pose.mouthOpen < 0.001);
    assert.ok(behavior.pose.mouth.every((weight) => weight < 0.001));
  }
});

test("reduced motion minimizes portrait movement while retaining speech and blinking", () => {
  const normal = new AvatarBehavior(() => 0.5);
  const reduced = new AvatarBehavior(() => 0.5);
  let blinkSeen = false;
  let speechSeen = false;
  for (let i = 0; i < 100; i += 1) {
    const a = normal.step(1 / 30, "speaking", false);
    const b = reduced.step(1 / 30, "speaking", true);
    assert.ok(Math.abs(b.headPitch) <= Math.abs(a.headPitch) * 0.121 + 1e-6);
    assert.equal(a.mouthOpen, b.mouthOpen);
    blinkSeen ||= b.blink > 0.5;
    speechSeen ||= b.mouthOpen > 0.2;
  }
  assert.ok(blinkSeen && speechSeen);
  assert.equal(avatarMotionScale(true, true), 0.012);
  assert.ok(AVATAR_MAX_PIXEL_RATIO <= 1.5);
  assert.ok(1000 / AVATAR_FRAME_INTERVAL_MS <= 45);
});

test("a suspended tab cannot jump the visual pose forward by many seconds", () => {
  const resumed = new AvatarBehavior(() => 0.5);
  const bounded = new AvatarBehavior(() => 0.5);
  assert.deepEqual(resumed.step(3600, "speaking", false), bounded.step(0.1, "speaking", false));
});

test("the partner stays subtly friendly, with distinct smoothly approached state expressions", () => {
  const behavior = new AvatarBehavior(randomSequence());
  const settle = (state: Parameters<AvatarBehavior["step"]>[1]) => {
    for (let i = 0; i < 90; i += 1) behavior.step(1 / 30, state, false);
    return { happy: behavior.pose.happy, relaxed: behavior.pose.relaxed };
  };
  const idle = settle("idle");
  assert.ok(idle.happy > 0.04 && idle.happy < 0.1);
  const listening = settle("listening");
  assert.ok(listening.happy > idle.happy && listening.happy < 0.12);
  const speaking = settle("speaking");
  assert.ok(speaking.happy > idle.happy && speaking.happy < 0.15);
  const prior = behavior.pose.happy;
  behavior.step(1 / 30, "thinking", false);
  assert.ok(behavior.pose.happy < prior && behavior.pose.happy > 0.05, "No abrupt expression snap");
  const thinking = settle("thinking");
  assert.ok(thinking.happy > 0.02 && thinking.happy < idle.happy);
  assert.ok(thinking.relaxed > idle.relaxed);
  assert.ok(settle("paused").happy > 0.04);
});

test("non-speaking states never generate vowels, and speaking pauses vary in duration", () => {
  for (const state of ["idle", "listening", "thinking", "paused"] as const) {
    const behavior = new AvatarBehavior(randomSequence());
    for (let i = 0; i < 600; i += 1) {
      const pose = behavior.step(1 / 30, state, false);
      assert.equal(pose.mouthOpen, 0);
      assert.ok(pose.mouth.every((weight) => weight === 0));
    }
  }
  const behavior = new AvatarBehavior(randomSequence());
  const pauses = new Set<number>();
  let quietFrames = 0;
  for (let i = 0; i < 1800; i += 1) {
    if (behavior.step(1 / 30, "speaking", false).mouthOpen < 0.04) quietFrames += 1;
    else if (quietFrames) { pauses.add(quietFrames); quietFrames = 0; }
  }
  assert.ok(pauses.size >= 3, "Closed-mouth intervals must not repeat at a constant pace");
});

test("blinks close faster than they reopen and occasionally include one smaller second blink", () => {
  const behavior = new AvatarBehavior(() => 0.05);
  const bursts: number[][] = [];
  let burst: number[] = [];
  for (let i = 0; i < 1200; i += 1) {
    const blink = behavior.step(1 / 120, "idle", true).blink;
    if (blink > 0) burst.push(blink);
    else if (burst.length) { bursts.push(burst); burst = []; }
  }
  assert.ok(bursts.length >= 3);
  const first = bursts[0]!;
  const peak = first.indexOf(Math.max(...first));
  assert.ok(peak < first.length / 2, "The closed moment occurs early in an asymmetric blink");
  assert.ok(first.length - peak > peak * 1.5, "Reopening is slower than closing");
  assert.ok(Math.max(...bursts[1]!) >= 0.7 && Math.max(...bursts[1]!) < 0.8);
  assert.ok(Math.max(...bursts[2]!) > 0.95, "Double blinks do not recursively chain");
});

test("gaze and head movement stay conservative through all states and irregular acknowledgements", () => {
  for (const state of ["idle", "listening", "thinking", "speaking", "paused"] as const) {
    const behavior = new AvatarBehavior(randomSequence());
    let nods = 0;
    let nodding = false;
    let priorYaw = 0;
    for (let i = 0; i < 5400; i += 1) {
      const p = behavior.step(1 / 30, state, false);
      assert.ok(Math.abs(p.gazeYaw) <= 5 && Math.abs(p.gazePitch) <= 3);
      assert.ok(Math.abs(p.gazeYaw - priorYaw) < 0.4, "No darting gaze transitions");
      assert.ok(Math.abs(p.headPitch) < 0.025 && Math.abs(p.headYaw) < 0.025 && Math.abs(p.headRoll) < 0.035);
      assert.ok(Math.abs(p.breath) <= 0.0011);
      priorYaw = p.gazeYaw;
      const nowNodding = p.headPitch > 0.006;
      if (nowNodding && !nodding) nods += 1;
      nodding = nowNodding;
    }
    if (state === "listening") assert.ok(nods >= 3 && nods <= 12, `Only occasional acknowledgements: ${nods} in three minutes`);
  }
});

test("listening maintains stronger eye contact and thinking returns from a brief thoughtful glance", () => {
  const idle = new AvatarBehavior(() => 0.85);
  const listening = new AvatarBehavior(() => 0.85);
  let idleWander = 0;
  let attentiveWander = 0;
  for (let i = 0; i < 1800; i += 1) {
    idleWander += Math.abs(idle.step(1 / 30, "idle", false).gazeYaw);
    attentiveWander += Math.abs(listening.step(1 / 30, "listening", false).gazeYaw);
  }
  assert.ok(attentiveWander < idleWander * 0.3);
  const thinking = new AvatarBehavior(() => 0.5);
  for (let i = 0; i < 30; i += 1) thinking.step(1 / 30, "thinking", false);
  const early = Math.abs(thinking.pose.gazeYaw);
  assert.ok(early > 1 && thinking.pose.gazePitch < -0.5);
  for (let i = 0; i < 150; i += 1) thinking.step(1 / 30, "thinking", false);
  assert.ok(Math.abs(thinking.pose.gazeYaw) < early * 0.15);
});

test("seeded behavior is reproducible and reduced motion preserves facial warmth", () => {
  const normal = new AvatarBehavior(randomSequence());
  const replay = new AvatarBehavior(randomSequence());
  const reduced = new AvatarBehavior(randomSequence());
  let normalMovement = 0;
  let reducedMovement = 0;
  let blinkSeen = false;
  for (let i = 0; i < 1800; i += 1) {
    const a = normal.step(1 / 30, "listening", false);
    assert.deepEqual(replay.step(1 / 30, "listening", false), a);
    const b = reduced.step(1 / 30, "listening", true);
    assert.equal(a.happy, b.happy);
    assert.equal(a.blink, b.blink);
    normalMovement += Math.abs(a.headPitch) + Math.abs(a.headRoll) + Math.abs(a.breath) + Math.abs(a.gazeYaw);
    reducedMovement += Math.abs(b.headPitch) + Math.abs(b.headRoll) + Math.abs(b.breath) + Math.abs(b.gazeYaw);
    blinkSeen ||= b.blink > 0.8;
  }
  assert.ok(blinkSeen);
  assert.ok(reduced.pose.happy > 0.06);
  assert.ok(reducedMovement < normalMovement * 0.13);
});
