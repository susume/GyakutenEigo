import { useEffect, useState, type RefObject } from "react";
import { getChaosAbilityLabel, type AthleticsAbility, type AthleticsMode, type AthleticsRole } from "@quizstrike/shared";

type WeaponCooldown = {
  startedAt: number;
  durationMs: number;
};

export type AthleticsHudState = {
  mode?: AthleticsMode;
  modeLabel?: string;
  role?: AthleticsRole;
  startRemainingSeconds: number;
  remainingSeconds: number;
  checkpointIndex: number;
  completedLaps: number;
  requiredLaps: number;
  routeProgress: number;
  rank: number;
  totalRacers: number;
  energy: number;
  maxEnergy: number;
  criticalEnergy: number;
  canAnswer: boolean;
  status: "racing" | "finished" | "dnf";
  recoveryActive?: boolean;
  recoveryCorrectAnswers?: number;
  recoveryRequiredAnswers?: number;
  hunterAmmo?: number;
  hunterHits?: number;
  abilityCharge?: number;
  abilityMax?: number;
  abilityReady?: AthleticsAbility;
  shieldCharges?: number;
  zeusFrozen?: boolean;
  zeusWarningSeconds?: number;
  remainingRunners?: number;
  chaosEventLabel?: string;
};

const formatRaceTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

const ATHLETICS_ONBOARDING_MAX_PROGRESS = 0.05;
const ATHLETICS_ONBOARDING_DURATION_MS = 4200;

const formatPlace = (rank: number) => {
  const safeRank = Math.max(1, Math.round(rank));
  const lastTwoDigits = safeRank % 100;
  const suffix = lastTwoDigits >= 11 && lastTwoDigits <= 13
    ? "th"
    : safeRank % 10 === 1
      ? "st"
      : safeRank % 10 === 2
        ? "nd"
        : safeRank % 10 === 3
          ? "rd"
          : "th";
  return `${safeRank}${suffix}`;
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
  onQuestionFromTouch,
  onFireFromTouch,
  onAbilityFromTouch,
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
  onFireFromTouch: (() => void) | undefined;
  onAbilityFromTouch: (() => void) | undefined;
  onToggleCrouchFromTouch: (() => void) | undefined;
  touchCrouchEnabled?: boolean;
  athleticsHud?: AthleticsHudState;
}) => {
  const athleticsOnboardingEligible = Boolean(
    athleticsHud
    && athleticsHud.status === "racing"
    && !athleticsHud.recoveryActive
    && athleticsHud.checkpointIndex === 0
    && athleticsHud.routeProgress < ATHLETICS_ONBOARDING_MAX_PROGRESS
  );
  const hasAthleticsHud = Boolean(athleticsHud);
  const [athleticsOnboardingDismissed, setAthleticsOnboardingDismissed] = useState(false);

  useEffect(() => {
    if (!hasAthleticsHud) return;
    if (!athleticsOnboardingEligible) {
      setAthleticsOnboardingDismissed(true);
      return;
    }
    setAthleticsOnboardingDismissed(false);
    const timeout = window.setTimeout(() => setAthleticsOnboardingDismissed(true), ATHLETICS_ONBOARDING_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [athleticsOnboardingEligible, hasAthleticsHud]);

  if (athleticsHud) {
    const energyPercent = Math.round(Math.min(1, Math.max(0, athleticsHud.energy / Math.max(1, athleticsHud.maxEnergy))) * 100);
    const lap = Math.min(athleticsHud.requiredLaps, athleticsHud.completedLaps + (athleticsHud.status === "finished" ? 0 : 1));
    const isVariant = athleticsHud.mode !== undefined && athleticsHud.mode !== "classic";

    return (
      <>
        {athleticsOnboardingEligible && !athleticsOnboardingDismissed && (
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
        {isVariant && athleticsHud.mode === "zeus" && athleticsHud.zeusFrozen && (
          <div className="athletics-mode-banner athletics-zeus-freeze" role="status" aria-live="assertive">
            <strong>LIGHTNING FREEZE</strong>
            <span>Answer correctly to break the charge.</span>
          </div>
        )}
        <div className="athletics-hud" data-testid="athletics-compact-hud" aria-label="Athletics race status">
          {isVariant && (
            <div className="athletics-variant-header">
              <strong>{athleticsHud.modeLabel ?? athleticsHud.mode?.toUpperCase()}</strong>
              <span className={`athletics-role athletics-role-${athleticsHud.role ?? "runner"}`}>{athleticsHud.role === "hunter" ? "HUNTER" : "RUNNER"}</span>
            </div>
          )}
          <div className="athletics-hud-header">
            <div className="athletics-energy-label">
              <span className="athletics-energy-icon" aria-hidden="true">⚡</span>
              <span>Movement energy</span>
            </div>
            <div className={`athletics-hud-time${athleticsHud.startRemainingSeconds > 0 ? " is-countdown" : ""}`} role="timer" aria-label={`Race time remaining ${formatRaceTime(athleticsHud.remainingSeconds)}`}>
              <span>Time</span>
              <strong>{athleticsHud.startRemainingSeconds > 0 ? `GO in ${athleticsHud.startRemainingSeconds}` : formatRaceTime(athleticsHud.remainingSeconds)}</strong>
            </div>
          </div>
          <div className={`athletics-energy-meter${athleticsHud.energy <= athleticsHud.criticalEnergy ? " is-critical" : ""}`} role="meter" aria-label={`${Math.round(athleticsHud.energy)} of ${athleticsHud.maxEnergy} movement energy`} aria-valuemin={0} aria-valuemax={athleticsHud.maxEnergy} aria-valuenow={Math.round(athleticsHud.energy)}>
            <div className="athletics-energy-track"><span style={{ width: `${energyPercent}%` }} /></div>
            <strong>{Math.round(athleticsHud.energy)} / {athleticsHud.maxEnergy}</strong>
          </div>
          <div className="athletics-hud-stats">
            <span>
              <span className="athletics-stat-icon" aria-hidden="true">🏆</span>
              <span><small>Place</small><strong>{formatPlace(athleticsHud.rank)} / {athleticsHud.totalRacers}</strong></span>
            </span>
            <span>
              <span className="athletics-stat-icon athletics-stat-icon-lap" aria-hidden="true">↻</span>
              <span><small>Lap</small><strong>{lap} / {athleticsHud.requiredLaps}</strong></span>
            </span>
          </div>
          {isVariant && (
            <div className="athletics-variant-stats">
              {athleticsHud.role === "hunter" ? (
                <span><small>Foam ammo</small><strong>{athleticsHud.hunterAmmo ?? 0}</strong><em>{athleticsHud.hunterHits ?? 0} hits</em></span>
              ) : (
                <span><small>Ability</small><strong>{athleticsHud.abilityCharge ?? 0} / {athleticsHud.abilityMax ?? 3}</strong><em>{athleticsHud.abilityReady ? getChaosAbilityLabel(athleticsHud.abilityReady) : "Charging"}</em></span>
              )}
              {athleticsHud.mode === "hunters-runners" && athleticsHud.role !== "hunter" && (
                <span><small>Runners left</small><strong>{athleticsHud.remainingRunners ?? 0}</strong></span>
              )}
              {athleticsHud.mode === "chaos-climb" && (
                <>
                  <span><small>Shields</small><strong>{athleticsHud.shieldCharges ?? 0}</strong></span>
                  <span><small>Event</small><strong>{athleticsHud.chaosEventLabel ?? "Watch"}</strong></span>
                </>
              )}
              {athleticsHud.mode === "zeus" && (
                <span><small>Lightning</small><strong>{athleticsHud.zeusFrozen ? "Frozen" : athleticsHud.zeusWarningSeconds ? `${athleticsHud.zeusWarningSeconds}s` : "Watch"}</strong></span>
              )}
            </div>
          )}
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
              {onFireFromTouch && athleticsHud.role === "hunter" && (
                <button type="button" className="touch-fire" disabled={controlsDisabled} aria-label="Throw foam ball" onPointerDown={(event) => { event.preventDefault(); onFireFromTouch(); }}>
                  <kbd aria-hidden="true">F</kbd>
                  Throw
                </button>
              )}
              {onAbilityFromTouch && athleticsHud.role !== "hunter" && athleticsHud.abilityReady && (
                <button type="button" className="touch-ability" disabled={controlsDisabled || (athleticsHud.abilityCharge ?? 0) < (athleticsHud.abilityMax ?? 3)} aria-label={`Use ${getChaosAbilityLabel(athleticsHud.abilityReady)}`} onPointerDown={(event) => { event.preventDefault(); onAbilityFromTouch(); }}>
                  <kbd aria-hidden="true">A</kbd>
                  {getChaosAbilityLabel(athleticsHud.abilityReady)}
                </button>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
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
};
