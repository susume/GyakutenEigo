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
  checkpointCount: number;
  completedLaps: number;
  requiredLaps: number;
  routeProgress: number;
  rank: number;
  totalRacers: number;
  energy: number;
  maxEnergy: number;
  criticalEnergy: number;
  canAnswer: boolean;
  gateOpen: boolean;
  status: "racing" | "finished" | "dnf";
  recoveryActive?: boolean;
  recoveryCorrectAnswers?: number;
  recoveryRequiredAnswers?: number;
  sectionLabel: string;
  objectiveText: string;
};

const formatRaceTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

const ATHLETICS_ONBOARDING_MAX_PROGRESS = 0.05;

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
  onQuestionFromTouch,
  onToggleCrouchFromTouch,
  touchCrouchEnabled,
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
  onQuestionFromTouch: (() => void) | undefined;
  onToggleCrouchFromTouch: (() => void) | undefined;
  touchCrouchEnabled?: boolean;
  athleticsHud?: AthleticsHudState;
}) => athleticsHud ? (
  <>
    {athleticsHud.status === "racing" && athleticsHud.checkpointIndex === 0 && athleticsHud.routeProgress < ATHLETICS_ONBOARDING_MAX_PROGRESS && (
      <div className="athletics-onboarding" aria-label="Jump tutorial">
        <strong>JUMP ONTO THE GLOWING PLATFORMS</strong>
        <span>SPACE — JUMP · Tablet: tap JUMP</span>
      </div>
    )}
    {athleticsHud.recoveryActive && (
      <div className="athletics-recovery-banner" role="status" aria-live="assertive">
        <strong>You fell!</strong>
        <span>Answer 3 questions to get back on the course.</span>
        <b>Recovery Questions {athleticsHud.recoveryCorrectAnswers ?? 0} / {athleticsHud.recoveryRequiredAnswers ?? 3}</b>
      </div>
    )}
    <div className="athletics-hud" aria-label="Athletics race status">
      <div className="athletics-hud-topline">
        <span className="athletics-hud-kicker">Skyline Adventure Park</span>
        <strong>{athleticsHud.startRemainingSeconds > 0 ? `GO in ${athleticsHud.startRemainingSeconds}` : formatRaceTime(athleticsHud.remainingSeconds)}</strong>
      </div>
      <div className="athletics-hud-mainline">
          <strong>{athleticsHud.recoveryActive ? "Recovery challenge" : athleticsHud.status === "finished" ? `Finished #${athleticsHud.rank}` : athleticsHud.energy <= athleticsHud.criticalEnergy ? "Energy low" : "Jump forward"}</strong>
        <span>{athleticsHud.sectionLabel}</span>
      </div>
      <span className="athletics-hud-objective">{athleticsHud.objectiveText}</span>
      <div className="athletics-route-guide" aria-label="Course route guide">
        <span className="athletics-route-guide-icon" aria-hidden="true">
          {athleticsHud.status === "finished" ? "★" : athleticsHud.routeProgress < 0.075 && athleticsHud.checkpointIndex === 0 ? "↑" : "→"}
        </span>
        <span>
          <strong>
            {athleticsHud.status === "finished"
              ? "Summit finish reached"
              : athleticsHud.routeProgress < 0.075 && athleticsHud.checkpointIndex === 0
                ? athleticsHud.startRemainingSeconds > 0 ? "Ready on the start pad" : "Jump to the first platform"
                : `Next landing · Checkpoint ${Math.min(athleticsHud.checkpointCount, athleticsHud.checkpointIndex + 1)}`}
          </strong>
          <small>
            {athleticsHud.status === "finished"
              ? "Race complete"
              : athleticsHud.routeProgress < 0.075 && athleticsHud.checkpointIndex === 0
                ? athleticsHud.startRemainingSeconds > 0 ? "Wait for GO, then tap JUMP" : "Use the glowing edge and land safely"
                : "Read the next glowing edge; answer on any safe platform"}
          </small>
        </span>
      </div>
      <div className={`athletics-energy-meter${athleticsHud.energy <= athleticsHud.criticalEnergy ? " is-critical" : ""}`} aria-label={`${Math.round(athleticsHud.energy)} of ${athleticsHud.maxEnergy} movement energy`}>
        <div className="athletics-energy-heading">
          <span><span aria-hidden="true">⚡</span> Movement energy</span>
          <strong>{Math.round(athleticsHud.energy)} / {athleticsHud.maxEnergy}</strong>
        </div>
        <div className="athletics-energy-track"><span style={{ width: `${Math.round(Math.min(1, Math.max(0, athleticsHud.energy / Math.max(1, athleticsHud.maxEnergy))) * 100)}%` }} /></div>
      </div>
      {onQuestionFromTouch && (
        <button
          type="button"
          className="athletics-answer-button"
          disabled={controlsDisabled || !athleticsHud.canAnswer || athleticsHud.status !== "racing"}
          onClick={onQuestionFromTouch}
          aria-keyshortcuts="Q"
        >
          <span className="athletics-answer-icon" aria-hidden="true">?</span>
          <span>
            <strong>{athleticsHud.recoveryActive ? "Recovery Question" : "Answer Question"}</strong>
            <small>{athleticsHud.recoveryActive ? "Only correct answers count · 3 to return" : "Correct answers add +220 energy"}</small>
          </span>
          <kbd>Q</kbd>
        </button>
      )}
      <div className="athletics-progress-track" aria-label={`${Math.round(athleticsHud.routeProgress * 100)} percent course progress`}>
        <span style={{ width: `${Math.round(Math.min(1, Math.max(0, athleticsHud.routeProgress)) * 100)}%` }} />
      </div>
      <div className="athletics-hud-stats">
        <span><small>Place</small><strong>{athleticsHud.rank}/{athleticsHud.totalRacers}</strong></span>
        <span><small>Lap</small><strong>{Math.min(athleticsHud.requiredLaps, athleticsHud.completedLaps + (athleticsHud.status === "finished" ? 0 : 1))}/{athleticsHud.requiredLaps}</strong></span>
        <span><small>Questions</small><strong>{athleticsHud.questionIndex}/{athleticsHud.questionCount}</strong></span>
        <span><small>Checkpoints</small><strong>{athleticsHud.checkpointIndex}/{athleticsHud.checkpointCount}</strong></span>
      </div>
    </div>
    {!controlsDisabled && !isPointerLocked && !suppressHint && <div className="control-lock athletics-control-lock">WASD moves at full speed · Shift crouches · Space jumps · Arrow keys or swipe looks · touch players can use Crouch + Jump</div>}
    <div className="touch-controls athletics-touch-controls" aria-label="Touch controls">
      <button ref={joystickElementRef} type="button" className="touch-joystick" aria-label="Movement joystick" disabled={controlsDisabled} onPointerDown={onBeginTouchMove}>
        <span aria-hidden="true" />
      </button>
      {onQuestionFromTouch && (
        <button
          type="button"
          className="touch-question"
          disabled={controlsDisabled || !athleticsHud.canAnswer || athleticsHud.status !== "racing"}
          aria-label="Answer a movement energy question"
          onPointerDown={(event) => { event.preventDefault(); onQuestionFromTouch(); }}
        >
          <span aria-hidden="true">?</span>
          Answer
        </button>
      )}
      {(onJumpFromTouch || onToggleCrouchFromTouch) && (
        <div className="touch-action-group">
          {onToggleCrouchFromTouch && (
            <button
              type="button"
              className="touch-crouch"
              disabled={controlsDisabled}
              aria-label="Crouch"
              aria-keyshortcuts="Shift"
              aria-pressed={touchCrouchEnabled === true}
              onClick={onToggleCrouchFromTouch}
            >
              <kbd aria-hidden="true">SHIFT</kbd>
              Crouch
            </button>
          )}
          {onJumpFromTouch && (
            <button type="button" className="touch-jump" disabled={controlsDisabled} aria-label="Jump" aria-keyshortcuts="Space" onPointerDown={(event) => { event.preventDefault(); onJumpFromTouch(); }}>
              <kbd aria-hidden="true">SPACE</kbd>
              Jump
            </button>
          )}
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
    {!controlsDisabled && !isPointerLocked && !suppressHint && <div className="control-lock">WASD moves at full speed · Shift crouches · Space jumps · Arrow keys or swipe look · click to aim · F fires · C zooms · E interacts</div>}
    <div className="touch-controls" aria-label="Touch controls">
      <button ref={joystickElementRef} type="button" className="touch-joystick" aria-label="Movement joystick" disabled={controlsDisabled} onPointerDown={onBeginTouchMove}>
        <span aria-hidden="true" />
      </button>
      {(currentWeaponId === "power_blaster" || onInteractFromTouch || onJumpFromTouch || onToggleCrouchFromTouch) && (
        <div className="touch-action-group">
          {onToggleCrouchFromTouch && (
            <button
              type="button"
              className="touch-crouch"
              disabled={controlsDisabled}
              aria-label="Crouch"
              aria-keyshortcuts="Shift"
              aria-pressed={touchCrouchEnabled === true}
              onClick={onToggleCrouchFromTouch}
            >
              <kbd aria-hidden="true">SHIFT</kbd>
              Crouch
            </button>
          )}
          {onJumpFromTouch && (
            <button type="button" className="touch-jump" disabled={controlsDisabled} aria-label="Jump" aria-keyshortcuts="Space" onPointerDown={(event) => { event.preventDefault(); onJumpFromTouch(); }}>
              <kbd aria-hidden="true">SPACE</kbd>
              Jump
            </button>
          )}
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
