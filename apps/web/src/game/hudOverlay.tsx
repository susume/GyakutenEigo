import type { RefObject } from "react";

type WeaponCooldown = {
  startedAt: number;
  durationMs: number;
};

export type AthleticsHudState = {
  startRemainingSeconds: number;
  remainingSeconds: number;
  questionIndex: number;
  questionCount: number;
  questionsPerLap: number;
  checkpointIndex: number;
  completedLaps: number;
  requiredLaps: number;
  routeProgress: number;
  rank: number;
  totalRacers: number;
  gateOpen: boolean;
  status: "racing" | "finished" | "dnf";
  sectionLabel: string;
};

const formatRaceTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

export const ArenaHudOverlay = ({
  hitPulse,
  hitConfirmPulse,
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
  onInteractFromTouch,
  onJumpFromTouch,
  athleticsHud
}: {
  hitPulse: number;
  hitConfirmPulse: number;
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
  onJumpFromTouch: (() => void) | undefined;
  athleticsHud?: AthleticsHudState;
}) => athleticsHud ? (
  <>
    <div className="athletics-hud" aria-label="Athletics race status">
      <div className="athletics-hud-topline">
        <span className="athletics-hud-kicker">Stadium Loop</span>
        <strong>{athleticsHud.startRemainingSeconds > 0 ? `GO in ${athleticsHud.startRemainingSeconds}` : formatRaceTime(athleticsHud.remainingSeconds)}</strong>
      </div>
      <div className="athletics-hud-mainline">
        <strong>{athleticsHud.status === "finished" ? `Finished #${athleticsHud.rank}` : athleticsHud.gateOpen ? "Gate open" : "Answer to unlock"}</strong>
        <span>{athleticsHud.sectionLabel}</span>
      </div>
      <div className="athletics-progress-track" aria-label={`${Math.round(athleticsHud.routeProgress * 100)} percent course progress`}>
        <span style={{ width: `${Math.round(Math.min(1, Math.max(0, athleticsHud.routeProgress)) * 100)}%` }} />
      </div>
      <div className="athletics-hud-stats">
        <span><small>Place</small><strong>{athleticsHud.rank}/{athleticsHud.totalRacers}</strong></span>
        <span><small>Lap</small><strong>{Math.min(athleticsHud.requiredLaps, athleticsHud.completedLaps + (athleticsHud.status === "finished" ? 0 : 1))}/{athleticsHud.requiredLaps}</strong></span>
        <span><small>Questions</small><strong>{athleticsHud.questionIndex}/{athleticsHud.questionCount}</strong></span>
        <span><small>Checkpoints</small><strong>{athleticsHud.checkpointIndex}/{Math.max(0, athleticsHud.questionsPerLap - 1)}</strong></span>
      </div>
    </div>
    {!controlsDisabled && !isPointerLocked && !suppressHint && <div className="control-lock athletics-control-lock">WASD moves · Space jumps · Arrow keys or swipe looks · touch players can use the jump button</div>}
    <div className="touch-controls athletics-touch-controls" aria-label="Touch controls">
      <button ref={joystickElementRef} type="button" className="touch-joystick" aria-label="Movement joystick" disabled={controlsDisabled} onPointerDown={onBeginTouchMove}>
        <span aria-hidden="true" />
      </button>
      {onJumpFromTouch && (
        <div className="touch-action-group">
          <button type="button" className="touch-jump" disabled={controlsDisabled} aria-label="Jump" onPointerDown={(event) => { event.preventDefault(); onJumpFromTouch(); }}>
            <kbd aria-hidden="true">Space</kbd>
            Jump
          </button>
        </div>
      )}
    </div>
  </>
) : (
  <>
    {(currentWeaponId !== "power_blaster" || zoomLevel > 0) && (
      <div
        className={`${hitPulse % 2 === 0 ? "crosshair" : "crosshair fire"}${zoomLevel > 0 ? ` zoom zoom-level-${zoomLevel}` : ""}`}
        aria-hidden="true"
      />
    )}
    {hitConfirmPulse > 0 && <div key={`hit-confirm-${hitConfirmPulse}`} className="hit-confirm-marker" aria-hidden="true" />}
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
