import assert from "node:assert/strict";
import test from "node:test";
import { PointerLookController } from "./PointerLookController";

test("real Three pointer controls preserve aim sensitivity, block modal input and clean up", () => {
  const doc = new EventTarget() as EventTarget & { pointerLockElement?: HTMLElement };
  const element = { ownerDocument: doc } as unknown as HTMLElement;
  let state = { yaw: 0, pitch: 0 }, enabled = true;
  const controller = new PointerLookController(element, {
    read: () => state, write: (next) => { state = next; }, enabled: () => enabled,
    sensitivity: () => 1, minPitch: -1.2, maxPitch: 1.2
  });
  doc.pointerLockElement = element;
  doc.dispatchEvent(new Event("pointerlockchange"));
  const move = () => { const event = new Event("mousemove"); Object.assign(event, { movementX: 10, movementY: 10 }); doc.dispatchEvent(event); };
  move();
  assert.ok(Math.abs(state.yaw + .022) < .000001);
  assert.ok(Math.abs(state.pitch + .018) < .000001);
  const previous = { ...state };
  enabled = false; move(); assert.deepEqual(state, previous);
  enabled = true; controller.dispose(); move(); assert.deepEqual(state, previous);
});
