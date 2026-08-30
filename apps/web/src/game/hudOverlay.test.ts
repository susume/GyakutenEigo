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
  athleticsHud
}: {
  hitPulse?: number;
  hitConfirmPulse?: number;
  onInteractFromTouch?: () => void;
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
      checkpointCount: 9,
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
      objectiveText: "Run, jump, and keep climbing."
    }
  });
  assert.match(html, /aria-label="Course route guide"/u);
  assert.match(html, /GO — run through the cyan gate/u);
  assert.match(html, /Follow the lane arrows to Checkpoint 1/u);
});
