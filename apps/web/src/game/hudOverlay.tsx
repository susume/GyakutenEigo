import type { RefObject } from "react";

type WeaponCooldown = {
  startedAt: number;
  durationMs: number;
};

export const ArenaHudOverlay = ({
  hitPulse,
  zoomLevel,
  currentWeaponId,
  snowballs,
  weaponCooldown,
  controlsDisabled,
  isPointerLocked,
  suppressHint,
  joystickElementRef,
  onBeginTouchMove,
  onZoomFromTouch,
  onInteractFromTouch
}: {
  hitPulse: number;
  zoomLevel: number;
  currentWeaponId?: string;
  snowballs: number;
  weaponCooldown: WeaponCooldown | null;
  controlsDisabled: boolean;
  isPointerLocked: boolean;
  suppressHint: boolean;
  joystickElementRef: RefObject<HTMLButtonElement | null>;
  onBeginTouchMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onZoomFromTouch: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onInteractFromTouch: (() => void) | undefined;
}) => (
  <>
    {(currentWeaponId !== "power_blaster" || zoomLevel > 0) && (
      <div className={`${hitPulse % 2 === 0 ? "crosshair" : "crosshair fire"}${zoomLevel > 0 ? ` zoom zoom-level-${zoomLevel}` : ""}`} aria-hidden="true" />
    )}
    <div className="fps-ammo-counter" data-testid="fps-ammo-counter" aria-label={`${snowballs} snowballs left`}>
      <strong>{Math.max(0, Math.floor(snowballs))}</strong>
    </div>
    {weaponCooldown && (
      <div className="weapon-cooldown" aria-label="Weapon cooldown">
        <span key={weaponCooldown.startedAt} style={{ animationDuration: `${weaponCooldown.durationMs}ms` }} />
      </div>
    )}
    {!controlsDisabled && !isPointerLocked && !suppressHint && <div className="control-lock">WASD moves. Use the arrow keys or swipe to look around. Click the game to aim. F or left click plays. C changes Heavy Launcher zoom. E interacts with the flag.</div>}
    <div className="touch-controls" aria-label="Touch controls">
      <button ref={joystickElementRef} type="button" className="touch-joystick" aria-label="Movement joystick" disabled={controlsDisabled} onPointerDown={onBeginTouchMove}>
        <span aria-hidden="true" />
      </button>
      {(currentWeaponId === "power_blaster" || onInteractFromTouch) && (
        <div className="touch-action-group">
          {onInteractFromTouch && (
            <button
              type="button"
              className="touch-interact"
              disabled={controlsDisabled}
              aria-label="Interact with environment"
              aria-keyshortcuts="E"
              onClick={onInteractFromTouch}
            >
              <kbd aria-hidden="true">E</kbd>
              Interact
            </button>
          )}
          {currentWeaponId === "power_blaster" && (
            <button type="button" className="touch-zoom" disabled={controlsDisabled} onPointerDown={onZoomFromTouch}>
              <span aria-hidden="true">⌖</span>
              Zoom{zoomLevel > 0 ? ` ${zoomLevel === 1 ? "3×" : "7×"}` : ""}
            </button>
          )}
        </div>
      )}
    </div>
  </>
);
