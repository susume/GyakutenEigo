import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArenaHudOverlay, type AthleticsHudState } from "./hudOverlay.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const renderHud = ({
  hitPulse = 0,
  hitConfirmPulse = 0,
  onInteractFromTouch,
  onJumpFromTouch,
  onToggleSprintFromTouch,
  touchSprintEnabled = false,
  athleticsHud
}: {
  hitPulse?: number;
  hitConfirmPulse?: number;
  onInteractFromTouch?: () => void;
  onJumpFromTouch?: () => void;
  onToggleSprintFromTouch?: () => void;
  touchSprintEnabled?: boolean;
  athleticsHud?: AthleticsHudState;
} = {}) => renderToStaticMarkup(React.createElement(ArenaHudOverlay, {
  hitPulse,
  hitConfirmPulse,
  zoomLevel: 0,
  currentWeaponId: "starter_blaster",
  snowballs: 10,
  weaponCooldown: null,
  controlsDisabled: false,
  isPointerLocked: false,
  suppressHint: true,
  joystickElementRef: React.createRef<HTMLButtonElement>(),
  onBeginTouchMove: () => undefined,
  onZoomFromTouch: () => undefined,
  onInteractFromTouch,
  onJumpFromTouch,
  onToggleSprintFromTouch,
  touchSprintEnabled,
  athleticsHud
}));

test("touch HUD exposes an accessible environment interaction control when flag interaction is available", () => {
  const html = renderHud({ onInteractFromTouch: () => undefined });
  assert.match(html, /aria-label="Interact with environment"/);
  assert.match(html, /aria-keyshortcuts="E"/);
  assert.match(html, />Interact<\/button>/);
});

test("touch HUD hides the interaction control outside interactive game modes", () => {
  assert.doesNotMatch(renderHud(), /Interact with environment/);
});

test("hit confirmation is a transient marker separate from the fire reticle", () => {
  const beforeHit = renderHud();
  assert.doesNotMatch(beforeHit, /hit-confirm-marker/u);

  const afterHitAndAnotherShot = renderHud({ hitPulse: 1, hitConfirmPulse: 1 });
  assert.match(afterHitAndAnotherShot, /class="crosshair fire"/u);
  assert.match(afterHitAndAnotherShot, /class="hit-confirm-marker"/u);
  assert.doesNotMatch(afterHitAndAnotherShot, /crosshair fire hit-confirm/u);
});

test("athletics HUD explains where to start the course", () => {
  const html = renderHud({
    athleticsHud: {
      startRemainingSeconds: 0,
      remainingSeconds: 420,
      questionIndex: 0,
      questionCount: 12,
      questionsPerLap: 4,
      checkpointIndex: 0,
      checkpointCount: 6,
      completedLaps: 0,
      requiredLaps: 3,
      routeProgress: 0,
      rank: 1,
      totalRacers: 1,
      energy: 1000,
      maxEnergy: 1000,
      criticalEnergy: 150,
      canAnswer: true,
      gateOpen: true,
      status: "racing",
      sectionLabel: "Park Entrance",
      objectiveText: "Jump from platform to platform."
    }
  });
  assert.match(html, /aria-label="Course route guide"/u);
  assert.match(html, /Jump to the first platform/u);
  assert.match(html, /JUMP ONTO THE GLOWING PLATFORMS/u);
  assert.match(html, /SPACE — JUMP/u);
});

test("athletics touch controls expose the jump action", () => {
  const html = renderHud({
    onJumpFromTouch: () => undefined,
    athleticsHud: {
      startRemainingSeconds: 0,
      remainingSeconds: 240,
      questionIndex: 0,
      questionCount: 8,
      questionsPerLap: 8,
      checkpointIndex: 0,
      checkpointCount: 6,
      completedLaps: 0,
      requiredLaps: 1,
      routeProgress: 0,
      rank: 1,
      totalRacers: 1,
      energy: 1000,
      maxEnergy: 1000,
      criticalEnergy: 150,
      canAnswer: true,
      gateOpen: true,
      status: "racing",
      sectionLabel: "Park Entrance",
      objectiveText: "Jump from platform to platform."
    }
  });
  assert.match(html, /class="touch-jump"/u);
  assert.match(html, /aria-label="Jump"/u);
  assert.match(html, />Jump<\/button>/u);
  assert.match(html, />SPACE<\/kbd>/u);
});

test("athletics touch controls expose a sprint toggle for long jumps", () => {
  const html = renderHud({
    onJumpFromTouch: () => undefined,
    onToggleSprintFromTouch: () => undefined,
    touchSprintEnabled: true,
    athleticsHud: {
      startRemainingSeconds: 0,
      remainingSeconds: 240,
      questionIndex: 0,
      questionCount: 8,
      questionsPerLap: 8,
      checkpointIndex: 0,
      checkpointCount: 6,
      completedLaps: 0,
      requiredLaps: 1,
      routeProgress: 0.2,
      rank: 1,
      totalRacers: 1,
      energy: 1000,
      maxEnergy: 1000,
      criticalEnergy: 150,
      canAnswer: true,
      gateOpen: true,
      status: "racing",
      sectionLabel: "Midway Mayhem",
      objectiveText: "Jump from platform to platform."
    }
  });
  assert.match(html, /class="touch-sprint"/u);
  assert.match(html, /aria-label="Sprint"/u);
  assert.match(html, /aria-keyshortcuts="Shift"/u);
  assert.match(html, /aria-pressed="true"/u);
  assert.match(html, />Sprint<\/button>/u);
});

test("athletics onboarding fades after the opening jump sequence", () => {
  const html = renderHud({
    athleticsHud: {
      startRemainingSeconds: 0,
      remainingSeconds: 230,
      questionIndex: 0,
      questionCount: 8,
      questionsPerLap: 8,
      checkpointIndex: 0,
      checkpointCount: 6,
      completedLaps: 0,
      requiredLaps: 1,
      routeProgress: 0.06,
      rank: 1,
      totalRacers: 1,
      energy: 800,
      maxEnergy: 1000,
      criticalEnergy: 150,
      canAnswer: true,
      gateOpen: true,
      status: "racing",
      sectionLabel: "Park Entrance",
      objectiveText: "Jump from platform to platform."
    }
  });
  assert.doesNotMatch(html, /JUMP ONTO THE GLOWING PLATFORMS/u);
});
