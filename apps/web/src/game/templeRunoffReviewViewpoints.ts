import {
  ARENA_PLAYER_EYE_HEIGHT,
  ARENA_SCALE,
  TEMPLE_RUNOFF_MAIN_LEVEL_Y,
  TEMPLE_RUNOFF_UPPER_LEVEL_Y
} from "@quizstrike/shared";

export type TempleRunoffReviewViewpointId =
  | "blue-temple"
  | "red-temple"
  | "sun-bridge"
  | "lower-canal"
  | "rain-god"
  | "jungle-ruins"
  | "upper-terrace"
  | "sluice-tunnels";

export type TempleRunoffReviewViewpoint = {
  id: TempleRunoffReviewViewpointId;
  label: string;
  position: [number, number, number];
  yaw: number;
  pitch: number;
};

const s = (value: number) => value * ARENA_SCALE;
const eye = (ground: number) => ground + ARENA_PLAYER_EYE_HEIGHT;
const facing = (fromX: number, fromZ: number, toX: number, toZ: number) =>
  Math.atan2(fromX - toX, fromZ - toZ);

const viewpoint = (
  id: TempleRunoffReviewViewpointId,
  label: string,
  x: number,
  groundY: number,
  z: number,
  targetX: number,
  targetZ: number,
  pitch = 0.04
): TempleRunoffReviewViewpoint => ({
  id,
  label,
  position: [s(x), eye(groundY), s(z)],
  yaw: facing(s(x), s(z), s(targetX), s(targetZ)),
  pitch
});

export const TEMPLE_RUNOFF_REVIEW_VIEWPOINTS: readonly TempleRunoffReviewViewpoint[] = [
  viewpoint("blue-temple", "Blue Temple entrance", -168, TEMPLE_RUNOFF_MAIN_LEVEL_Y, -92, -204, -92, 0.06),
  viewpoint("red-temple", "Red Temple entrance", 168, TEMPLE_RUNOFF_MAIN_LEVEL_Y, 92, 204, 92, 0.06),
  viewpoint("sun-bridge", "Sun Bridge deck", 0, TEMPLE_RUNOFF_UPPER_LEVEL_Y, -42, 0, 12),
  viewpoint("lower-canal", "Lower canal beneath bridge", -42, 0, 4, 0, 0, 0.02),
  viewpoint("rain-god", "Rain God landmark", 0, TEMPLE_RUNOFF_MAIN_LEVEL_Y, 92, 0, 126, 0.22),
  viewpoint("jungle-ruins", "Jungle Ruins", -142, TEMPLE_RUNOFF_MAIN_LEVEL_Y, -112, -92, -132),
  viewpoint("upper-terrace", "Upper Temple Terrace", 118, TEMPLE_RUNOFF_UPPER_LEVEL_Y, 66, 64, 66),
  viewpoint("sluice-tunnels", "West sluice tunnel", -154, 0, 0, -190, 0, 0.08)
];

export const getTempleRunoffReviewViewpoint = (id: string | null) =>
  TEMPLE_RUNOFF_REVIEW_VIEWPOINTS.find((candidate) => candidate.id === id);
