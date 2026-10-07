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
    assert.ok(p.mouthOpen >= 0 && p.mouthOpen <= 0.67);
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
