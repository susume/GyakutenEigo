import type {
  AthleticsPhysicalSupport,
  AthleticsRecoveryReason
} from "@quizstrike/shared";

export type AthleticsFallDecision =
  | { recover: true; reason: AthleticsRecoveryReason }
  | { recover: false; reason: "authored_support" | "moving_support" | "park_floor_guard" | "airborne" | "settle_guard" | "not_fallen" };

export interface AthleticsFallDecisionInput {
  support: AthleticsPhysicalSupport;
  airborne: boolean;
  requestedY?: number;
  routeDistance: number;
  routeWidth: number;
  onRoute: boolean;
  belowRecoverableRoute: boolean;
  settleGuardActive?: boolean;
}

const isPlayableSupport = (support: AthleticsPhysicalSupport) =>
  support.kind === "main_surface"
  || support.kind === "shortcut_surface"
  || support.kind === "moving_platform";

/**
 * Fall authority is deliberately ordered around physical support. Route
 * projection is only a final fallback after airborne and floor handling.
 */
export const decideAthleticsFall = (input: AthleticsFallDecisionInput): AthleticsFallDecision => {
  if (input.support.kind === "main_surface" || input.support.kind === "shortcut_surface") {
    return { recover: false, reason: "authored_support" };
  }
  if (input.support.kind === "moving_platform") {
    return { recover: false, reason: "moving_support" };
  }
  if (input.settleGuardActive) {
    return { recover: false, reason: "settle_guard" };
  }
  if (input.airborne) {
    return { recover: false, reason: "airborne" };
  }
  if (input.support.kind === "park_floor") {
    return { recover: true, reason: "park_floor" };
  }
  if (Number.isFinite(input.requestedY) && Number(input.requestedY) < 0.5) {
    return { recover: true, reason: "below_world" };
  }
  if (input.routeDistance > input.routeWidth + 2.5 || !input.onRoute) {
    return { recover: true, reason: "outside_route_bounds" };
  }
  if (input.belowRecoverableRoute) {
    return { recover: true, reason: "below_recoverable_height" };
  }
  return { recover: false, reason: "not_fallen" };
};

export const isAthleticsPlayableSupport = isPlayableSupport;

export const isAthleticsCheckpointOccupied = (
  support: AthleticsPhysicalSupport,
  expectedSurfaceIndex: number | undefined
) => support.kind === "main_surface"
  && expectedSurfaceIndex !== undefined
  && support.surfaceIndex === expectedSurfaceIndex;

export const isAthleticsFinishOccupied = (
  support: AthleticsPhysicalSupport,
  finishSurfaceIndex: number
) => support.kind === "main_surface"
  && support.surfaceIndex === finishSurfaceIndex;
