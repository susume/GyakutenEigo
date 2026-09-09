const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a",
  "summary",
  "[contenteditable=\"true\"]",
  "[contenteditable=\"\"]",
  "[role=\"textbox\"]",
  "[role=\"button\"]",
  "[data-keyboard-input]"
].join(",");

const isElement = (value: EventTarget | null): value is Element =>
  typeof Element !== "undefined" && value instanceof Element;

/**
 * Global shortcuts must yield to anything that behaves like a form control.
 * composedPath() is important for portals and shadow-root backed controls,
 * where target.closest() alone cannot see the full interaction ancestry.
 */
export const isKeyboardEditingTarget = (event: KeyboardEvent): boolean => {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  const candidates = [event.target, ...path];
  return candidates.some((candidate) => {
    if (!isElement(candidate)) return false;
    if (typeof HTMLElement !== "undefined" && candidate instanceof HTMLElement && candidate.isContentEditable) return true;
    return candidate.matches(EDITABLE_SELECTOR) || Boolean(candidate.closest(EDITABLE_SELECTOR));
  });
};

export const isSpaceShortcutEvent = (event: KeyboardEvent): boolean =>
  (event.code === "Space" || event.key === " ") && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
