import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArenaHudOverlay } from "./hudOverlay";

const renderHud = (hitPulse: number, hitConfirmPulse: number) => renderToStaticMarkup(createElement(ArenaHudOverlay, {
  hitPulse,
  hitConfirmPulse,
  zoomLevel: 0,
  currentWeaponId: "starter_blaster",
  snowballs: 10,
  weaponCooldown: null,
  controlsDisabled: false,
  isPointerLocked: true,
  suppressHint: true,
  joystickElementRef: { current: null },
  onBeginTouchMove: () => undefined,
  onZoomFromTouch: () => undefined
}));

test("hit confirmation is a transient marker separate from the fire reticle", () => {
  const beforeHit = renderHud(0, 0);
  assert.doesNotMatch(beforeHit, /hit-confirm-marker/u);

  const afterHitAndAnotherShot = renderHud(1, 1);
  assert.match(afterHitAndAnotherShot, /class="crosshair fire"/u);
  assert.match(afterHitAndAnotherShot, /class="hit-confirm-marker"/u);
  assert.doesNotMatch(afterHitAndAnotherShot, /crosshair fire hit-confirm/u);
});
