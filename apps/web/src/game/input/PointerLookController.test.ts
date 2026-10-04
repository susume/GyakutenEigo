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

test("optional mouse dragging works without pointer lock and stops on release, modals and disposal", () => {
  const doc = new EventTarget() as EventTarget & { pointerLockElement?: HTMLElement };
  const element = Object.assign(new EventTarget(), { ownerDocument: doc }) as unknown as HTMLElement;
  let state = { yaw: 0, pitch: 0 }, enabled = true;
  const controller = new PointerLookController(element, {
    read: () => state, write: (next) => { state = next; }, enabled: () => enabled,
    sensitivity: () => 1, minPitch: -1.2, maxPitch: 1.2, dragFallback: true
  });
  const pointer = (target: EventTarget, type: string, x: number, y: number, buttons = 1) => {
    const event = new Event(type);
    Object.assign(event, { pointerType: "mouse", button: 0, buttons, pointerId: 7, clientX: x, clientY: y });
    target.dispatchEvent(event);
  };
  pointer(element, "pointerdown", 100, 100);
  pointer(doc, "pointermove", 110, 110);
  assert.ok(Math.abs(state.yaw + .022) < .000001);
  assert.ok(Math.abs(state.pitch + .018) < .000001);
  const previous = { ...state };
  pointer(doc, "pointerup", 110, 110, 0);
  pointer(doc, "pointermove", 200, 200);
  assert.deepEqual(state, previous);
  pointer(element, "pointerdown", 100, 100);
  enabled = false;
  pointer(doc, "pointermove", 200, 200);
  enabled = true;
  pointer(doc, "pointermove", 210, 210);
  assert.deepEqual(state, previous, "opening a modal cancels the old drag");
  pointer(element, "pointerdown", 100, 100);
  doc.pointerLockElement = element;
  pointer(doc, "pointermove", 200, 200);
  assert.deepEqual(state, previous, "locked mouse rotation must not run twice");
  doc.pointerLockElement = undefined;
  pointer(element, "pointerdown", 100, 100);
  controller.dispose();
  pointer(doc, "pointermove", 200, 200);
  assert.deepEqual(state, previous);
});
