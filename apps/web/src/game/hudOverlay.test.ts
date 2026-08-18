import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArenaHudOverlay } from "./hudOverlay.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const renderHud = (onInteractFromTouch: (() => void) | undefined) => renderToStaticMarkup(React.createElement(ArenaHudOverlay, {
  hitPulse: 0,
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
  onInteractFromTouch
}));

test("touch HUD exposes an accessible environment interaction control when flag interaction is available", () => {
  const html = renderHud(() => undefined);
  assert.match(html, /aria-label="Interact with environment"/);
  assert.match(html, /aria-keyshortcuts="E"/);
  assert.match(html, />Interact<\/button>/);
});

test("touch HUD hides the interaction control outside interactive game modes", () => {
  assert.doesNotMatch(renderHud(undefined), /Interact with environment/);
});
