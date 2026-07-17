import type { Team } from "@quizstrike/shared";

export type ArenaAnimationCue =
  | "hit"
  | "respawn"
  | "jump"
  | "land"
  | "flag_plant"
  | "flag_capture"
  | "victory"
  | "defeat";

export interface ArenaAnimationEvent {
  kind: ArenaAnimationCue;
  playerId?: string;
  team?: Team;
}

type ArenaAnimationListener = (event: ArenaAnimationEvent) => void;
const listeners = new Set<ArenaAnimationListener>();

export const emitArenaAnimation = (event: ArenaAnimationEvent) => listeners.forEach((listener) => listener(event));

export const subscribeArenaAnimation = (listener: ArenaAnimationListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
