import assert from "node:assert/strict";
import test from "node:test";
import { isKeyboardEditingTarget, isSpaceShortcutEvent } from "./speakingKeyboard.js";

class FakeElement {
  constructor(private readonly selector: string, private readonly editable = false) {}
  isContentEditable = this.editable;
  matches(selector: string) { return selector.split(",").some((candidate) => candidate.trim() === this.selector); }
  closest(selector: string) { return this.matches(selector) ? this : null; }
}

test("space shortcut recognizes an unmodified physical spacebar press", () => {
  assert.equal(isSpaceShortcutEvent({ code: "Space", key: " ", repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false } as KeyboardEvent), true);
  assert.equal(isSpaceShortcutEvent({ code: "Space", key: " ", repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: true } as KeyboardEvent), false);
});

test("space shortcut respects IME composition and consumed events", () => {
  for (const patch of [{ isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }]) {
    assert.equal(isSpaceShortcutEvent({ code: "Space", key: " ", ...patch } as KeyboardEvent), false);
  }
});

test("global space shortcut yields to inputs and composed-path text editors", () => {
  const originalElement = globalThis.Element;
  Object.defineProperty(globalThis, "Element", { configurable: true, value: FakeElement });
  try {
    const input = new FakeElement("input");
    assert.equal(isKeyboardEditingTarget({ target: input, composedPath: () => [input] } as unknown as KeyboardEvent), true);

    const editor = new FakeElement("[role=\"textbox\"]");
    const wrapper = new FakeElement("div");
    assert.equal(isKeyboardEditingTarget({ target: wrapper, composedPath: () => [wrapper, editor] } as unknown as KeyboardEvent), true);

    const page = new FakeElement("main");
    assert.equal(isKeyboardEditingTarget({ target: page, composedPath: () => [page] } as unknown as KeyboardEvent), false);
  } finally {
    if (originalElement === undefined) delete (globalThis as { Element?: unknown }).Element;
    else Object.defineProperty(globalThis, "Element", { configurable: true, value: originalElement });
  }
});
