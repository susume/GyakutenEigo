import type { RefObject } from "react";

type WeaponCooldown = {
  startedAt: number;
  durationMs: number;
};

export const ArenaHudOverlay = ({
  hitPulse,
  zoomLevel,
  currentWeaponId,
  weaponCooldown,
  isDesertCitadel,
  isIronJunction,
  arenaTitle,
  controlsDisabled,
  isPointerLocked,
  suppressHint,
  joystickElementRef,
  onBeginTouchMove,
  onFireFromTouch
}: {
  hitPulse: number;
  zoomLevel: number;
  currentWeaponId?: string;
  weaponCooldown: WeaponCooldown | null;
  isDesertCitadel: boolean;
  isIronJunction: boolean;
  arenaTitle: string;
  controlsDisabled: boolean;
  isPointerLocked: boolean;
  suppressHint: boolean;
  joystickElementRef: RefObject<HTMLButtonElement | null>;
  onBeginTouchMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onFireFromTouch: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) => (
  <>
    {(currentWeaponId !== "power_blaster" || zoomLevel > 0) && (
      <div className={`${hitPulse % 2 === 0 ? "crosshair" : "crosshair fire"}${zoomLevel > 0 ? ` zoom zoom-level-${zoomLevel}` : ""}`} aria-hidden="true" />
    )}
    {weaponCooldown && (
      <div className="weapon-cooldown" aria-label="Weapon cooldown">
        <span key={weaponCooldown.startedAt} style={{ animationDuration: `${weaponCooldown.durationMs}ms` }} />
      </div>
    )}
    {!isDesertCitadel && !isIronJunction && <div className="fps-callout">{arenaTitle}</div>}
    {!controlsDisabled && !isPointerLocked && !suppressHint && <div className="control-lock">WASD moves. Use the arrow keys or swipe to look around. Click the game to aim. F or left click plays. C changes Heavy Launcher zoom. E interacts with the flag.</div>}
    <div className="touch-controls" aria-label="Touch controls">
      <button ref={joystickElementRef} type="button" className="touch-joystick" aria-label="Movement joystick" disabled={controlsDisabled} onPointerDown={onBeginTouchMove}>
        <span aria-hidden="true" />
      </button>
      <div className="touch-action-group">
        <span>Swipe to look · Tap the game to play</span>
        <button type="button" className="touch-fire" disabled={controlsDisabled} onPointerDown={onFireFromTouch}>Play</button>
      </div>
    </div>
  </>
);
