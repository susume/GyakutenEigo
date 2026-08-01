type ArenaInputHandlers = {
  rendererElement: HTMLElement;
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  onMouseMove: (event: MouseEvent) => void;
  onBlur: () => void;
  onPointerLockChange: () => void;
  onPointerLockError: () => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onTouchPointerMove: (event: PointerEvent) => void;
  onTouchPointerUp: (event: PointerEvent) => void;
  onTouchPointerCancel: (event: PointerEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
};

/**
 * Installs the browser listeners used by the arena's live controls.
 * Keeping registration and teardown together makes the render loop responsible
 * only for input behavior, while preserving the existing event targets and
 * capture semantics.
 */
export const attachArenaInputListeners = ({
  rendererElement,
  onKeyDown,
  onKeyUp,
  onMouseMove,
  onBlur,
  onPointerLockChange,
  onPointerLockError,
  onPointerDown,
  onPointerUp,
  onTouchPointerMove,
  onTouchPointerUp,
  onTouchPointerCancel,
  onContextMenu
}: ArenaInputHandlers) => {
  const verifyPointerLock = window.setInterval(() => {
    onPointerLockChange();
  }, 300);

  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("blur", onBlur);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("pointerlockerror", onPointerLockError);
  rendererElement.addEventListener("pointerdown", onPointerDown);
  rendererElement.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointermove", onTouchPointerMove, { passive: false });
  window.addEventListener("pointerup", onTouchPointerUp);
  window.addEventListener("pointercancel", onTouchPointerCancel);
  rendererElement.addEventListener("contextmenu", onContextMenu);

  return () => {
    window.clearInterval(verifyPointerLock);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("pointerlockerror", onPointerLockError);
    rendererElement.removeEventListener("pointerdown", onPointerDown);
    rendererElement.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointermove", onTouchPointerMove);
    window.removeEventListener("pointerup", onTouchPointerUp);
    window.removeEventListener("pointercancel", onTouchPointerCancel);
    rendererElement.removeEventListener("contextmenu", onContextMenu);
    if (document.pointerLockElement === rendererElement) document.exitPointerLock();
  };
};
