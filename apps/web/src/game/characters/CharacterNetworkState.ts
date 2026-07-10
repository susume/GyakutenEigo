import type { PlayerSession } from "@quizstrike/shared";

export interface CharacterNetworkState {
  id: string;
  x: number;
  z: number;
  facing: number;
  isAlive: boolean;
  team: PlayerSession["team"];
  gear: string;
}

export const toCharacterNetworkState = (
  player: PlayerSession,
  fallback: { x: number; z: number; facing: number }
): CharacterNetworkState => ({
  id: player.id,
  x: Number.isFinite(player.x) ? Number(player.x) : fallback.x,
  z: Number.isFinite(player.z) ? Number(player.z) : fallback.z,
  facing: Number.isFinite(player.facing) ? Number(player.facing) : fallback.facing,
  isAlive: player.isAlive,
  team: player.team,
  gear: player.gear
});
