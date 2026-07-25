import { ARENA_SCALE } from "@quizstrike/shared";
import type { ArenaMapDefinition, CitadelBlock, CitadelCylinder, CitadelFloorMark, CitadelProp, CitadelSign } from "./mapTypes";

const scale = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleRect = <T extends { x: number; z: number; w: number; d: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z), w: scale(item.w), d: scale(item.d) }) as T;
const scaleCylinder = <T extends { x: number; z: number; radius: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z), radius: scale(item.radius) }) as T;
const scalePoint = <T extends { x: number; z: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z) }) as T;

export const TEMPLE_RUNOFF: ArenaMapDefinition = {
  id: "temple_runoff",
  title: "Temple Runoff",
  description: "A rain-soaked jungle sanctuary where a sun bridge, flooded canal, temple court, and root-choked trail create four distinct combat rhythms.",
  footprint: { width: scale(350), depth: scale(320) },
  districts: [
    "Sun Bridge · exposed upper crossing",
    "Flooded Canal · fast lower route",
    "Rain Court · broad central brawl",
    "Rootway · protected jungle flank",
    "Sluice Tunnels · hidden rotation",
    "Survey Camp · outer landmark"
  ],
  routes: [
    "Sun Bridge · medium-long range",
    "Flooded Canal · fast close-medium route",
    "Rain Court · flexible team-fight lane",
    "Rootway · safer close-range flank",
    "Sluice Tunnels · two underground links",
    "Broken Causeway · risky cross-lane shortcut"
  ],
  palette: {
    sky: "#6fa5a0",
    fog: "#8db3a3",
    floor: "#756947",
    floorTexture: "floor",
    accent: "#2bb9b0"
  }
};

const sandstone = "#a98b55";
const sunStone = "#c4a565";
const mossStone = "#65704b";
const deepMoss = "#3f563f";
const darkStone = "#4b4c3c";
const timber = "#755033";
const water = "#35b8b3";
const canvas = "#c06b4d";

/**
 * Authored in the same 350 × 320 source grid as the other arenas, then scaled once.
 * Colliding block IDs and dimensions are mirrored in the shared authoritative proxies.
 */
const rawBlocks: CitadelBlock[] = [
  { id: "temple-north-cliff", label: "North Escarpment", x: 0, z: -156, w: 350, d: 8, h: 18, color: darkStone, material: "stone", style: "wall", collides: true },
  { id: "temple-south-cliff", label: "South Jungle Wall", x: 0, z: 156, w: 350, d: 8, h: 16, color: deepMoss, material: "stone", style: "wall", collides: true },
  { id: "temple-west-cliff", x: -171, z: 0, w: 8, d: 320, h: 16, color: darkStone, material: "stone", style: "wall", collides: true },
  { id: "temple-east-cliff", x: 171, z: 0, w: 8, d: 320, h: 16, color: darkStone, material: "stone", style: "wall", collides: true },

  { id: "blue-base-screen-north", label: "Blue Shrine", x: -128, z: -144, w: 7, d: 22, h: 10, color: mossStone, material: "stone", style: "wall", collides: true },
  { id: "blue-base-screen-a", x: -128, z: -77, w: 7, d: 30, h: 10, color: mossStone, material: "stone", style: "wall", collides: true },
  { id: "blue-base-screen-b", x: -128, z: -5, w: 7, d: 30, h: 10, color: mossStone, material: "stone", style: "wall", collides: true },
  { id: "blue-base-screen-c", x: -128, z: 66, w: 7, d: 28, h: 10, color: mossStone, material: "stone", style: "wall", collides: true },
  { id: "blue-base-screen-south", x: -128, z: 140, w: 7, d: 24, h: 10, color: mossStone, material: "stone", style: "wall", collides: true },
  { id: "red-base-screen-north", label: "Red Expedition", x: 128, z: -144, w: 7, d: 22, h: 10, color: sandstone, material: "stone", style: "wall", collides: true },
  { id: "red-base-screen-a", x: 128, z: -77, w: 7, d: 30, h: 10, color: sandstone, material: "stone", style: "wall", collides: true },
  { id: "red-base-screen-b", x: 128, z: -5, w: 7, d: 30, h: 10, color: sandstone, material: "stone", style: "wall", collides: true },
  { id: "red-base-screen-c", x: 128, z: 66, w: 7, d: 28, h: 10, color: sandstone, material: "stone", style: "wall", collides: true },
  { id: "red-base-screen-south", x: 128, z: 140, w: 7, d: 24, h: 10, color: sandstone, material: "stone", style: "wall", collides: true },
  { id: "blue-spawn-idol", x: -151, z: 8, w: 13, d: 17, h: 7, color: deepMoss, material: "stone", style: "ruin", collides: true },
  { id: "red-spawn-pavilion", x: 151, z: 8, w: 14, d: 17, h: 7, color: timber, material: "wood", style: "shed", collides: true },

  { id: "sun-bridge-deck-west", label: "Sun Bridge", x: -76, z: -112, w: 78, d: 18, h: 0.55, y: 0.08, color: sunStone, material: "stone", style: "bridge" },
  { id: "sun-bridge-deck-mid", x: 5, z: -112, w: 70, d: 18, h: 0.55, y: 0.08, color: sunStone, material: "stone", style: "bridge" },
  { id: "sun-bridge-deck-east", x: 78, z: -112, w: 62, d: 18, h: 0.55, y: 0.08, color: sunStone, material: "stone", style: "bridge" },
  { id: "sun-parapet-west-a", x: -91, z: -124, w: 35, d: 5, h: 5, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "sun-parapet-west-b", x: -41, z: -100, w: 24, d: 5, h: 4, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "sun-parapet-mid-a", x: -3, z: -124, w: 20, d: 5, h: 5, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "sun-parapet-mid-b", x: 37, z: -100, w: 22, d: 5, h: 4, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "sun-parapet-east", x: 88, z: -124, w: 34, d: 5, h: 5, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "sun-repair-screen", x: 69, z: -110, w: 13, d: 7, h: 3.2, color: timber, material: "wood", style: "bridge", collides: true },

  { id: "canal-water", label: "Flooded Canal", x: 0, z: -43, w: 252, d: 26, h: 0.18, y: 0.02, color: water, material: "water", style: "channel" },
  { id: "canal-bank-north-west", x: -88, z: -61, w: 68, d: 6, h: 5, color: darkStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-north-mid", x: 0, z: -61, w: 46, d: 6, h: 4, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "canal-bank-north-east", x: 88, z: -61, w: 68, d: 6, h: 5, color: darkStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-south-west", x: -83, z: -25, w: 58, d: 6, h: 5, color: mossStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-south-mid", x: 10, z: -25, w: 52, d: 6, h: 4, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "canal-bank-south-east", x: 91, z: -25, w: 50, d: 6, h: 5, color: mossStone, material: "stone", style: "wall", collides: true },
  { id: "canal-pillar-cover-west", x: -46, z: -43, w: 9, d: 9, h: 7, color: sandstone, material: "stone", style: "tower", collides: true },
  { id: "canal-pillar-cover-east", x: 46, z: -43, w: 9, d: 9, h: 7, color: mossStone, material: "stone", style: "tower", collides: true },
  { id: "canal-debris-cover", x: 5, z: -46, w: 15, d: 7, h: 2.4, color: timber, material: "wood", style: "bridge", collides: true },

  { id: "court-northwest-ruin", label: "Rain Court", x: -78, z: 18, w: 32, d: 10, h: 8, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "court-northeast-ruin", x: 78, z: 16, w: 30, d: 10, h: 8, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "court-southwest-ruin", x: -76, z: 61, w: 28, d: 10, h: 7, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "court-southeast-ruin", x: 76, z: 60, w: 34, d: 10, h: 7, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "court-altar-west", x: -28, z: 39, w: 16, d: 9, h: 2.8, color: sunStone, material: "stone", style: "ruin", collides: true },
  { id: "court-altar-east", x: 32, z: 30, w: 16, d: 9, h: 2.8, color: sunStone, material: "stone", style: "ruin", collides: true },

  { id: "rootway-cave-west", label: "Rootway", x: -92, z: 112, w: 35, d: 18, h: 8, color: darkStone, material: "stone", style: "ruin", collides: true },
  { id: "rootway-log-west", x: -48, z: 99, w: 25, d: 8, h: 4, color: timber, material: "wood", style: "logstack", collides: true },
  { id: "rootway-idol-mid", x: -6, z: 120, w: 15, d: 14, h: 7, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "rootway-survey-camp", label: "Survey Camp", x: 48, z: 101, w: 27, d: 17, h: 6, color: canvas, material: "cloth", style: "shed", collides: true },
  { id: "rootway-rock-east", x: 91, z: 124, w: 28, d: 17, h: 7, color: darkStone, material: "stone", style: "rock", collides: true },
  { id: "rootway-boardwalk", x: 72, z: 112, w: 24, d: 8, h: 0.6, y: 0.06, color: timber, material: "wood", style: "bridge" },

  { id: "west-sluice-mouth", label: "West Sluice", x: -105, z: -2, w: 13, d: 15, h: 8, color: darkStone, material: "stone", style: "gate" },
  { id: "east-sluice-mouth", label: "East Sluice", x: 105, z: -2, w: 13, d: 15, h: 8, color: darkStone, material: "stone", style: "gate" },
  { id: "broken-causeway", label: "Broken Causeway", x: 3, z: 86, w: 28, d: 7, h: 0.7, y: 0.06, color: sunStone, material: "stone", style: "bridge" }
];

export const blocks = rawBlocks.map(scaleRect);

const rawCylinders: CitadelCylinder[] = [
  { id: "rain-god-statue", label: "Rain God Statue", x: 0, z: 37, radius: 8, h: 16, color: mossStone, material: "stone", collides: true },
  { id: "sun-monument-west", x: -67, z: -112, radius: 4, h: 11, color: sunStone, material: "stone", collides: true },
  { id: "sun-monument-east", x: 29, z: -112, radius: 4, h: 10, color: sandstone, material: "stone", collides: true },
  { id: "court-column-west", x: -48, z: 48, radius: 3, h: 9, color: sandstone, material: "stone", collides: true },
  { id: "court-column-east", x: 52, z: 47, radius: 3, h: 9, color: mossStone, material: "stone", collides: true },
  { id: "canal-drain-west", x: -80, z: -43, radius: 3, h: 4, color: darkStone, material: "stone", collides: true },
  { id: "canal-drain-east", x: 83, z: -43, radius: 3, h: 4, color: darkStone, material: "stone", collides: true }
];

export const cylinders = rawCylinders.map(scaleCylinder);

const rawFloorMarks: CitadelFloorMark[] = [
  { id: "temple-route-sun", label: "SUN BRIDGE", x: 0, z: -112, w: 82, d: 13, color: "#f5d477" },
  { id: "temple-route-canal", label: "FLOODED CANAL", x: 0, z: -43, w: 86, d: 13, color: "#74e1d8" },
  { id: "temple-route-court", label: "RAIN COURT", x: 0, z: 37, w: 78, d: 14, color: "#e4bd78" },
  { id: "temple-route-root", label: "ROOTWAY", x: 0, z: 112, w: 74, d: 13, color: "#8fc47d" },
  { id: "temple-west-sluice", label: "SLUICE TUNNEL", x: -103, z: 10, w: 32, d: 10, color: "#77d7cf", rotation: Math.PI / 2 },
  { id: "temple-east-sluice", label: "HIDDEN DOOR", x: 103, z: 10, w: 32, d: 10, color: "#d9c18b", rotation: Math.PI / 2 }
];

export const floorMarks = rawFloorMarks.map(scaleRect);

const rawProps: CitadelProp[] = [
  { id: "sun-arch-west", kind: "arch", x: -112, z: -112, size: 10, h: 12, color: sandstone, material: "stone", rotationY: Math.PI / 2 },
  { id: "sun-arch-east", kind: "arch", x: 112, z: -112, size: 10, h: 12, color: sandstone, material: "stone", rotationY: Math.PI / 2 },
  { id: "canal-arch-west", kind: "arch", x: -113, z: -43, size: 12, h: 10, color: darkStone, material: "stone", rotationY: Math.PI / 2 },
  { id: "canal-arch-east", kind: "arch", x: 113, z: -43, size: 12, h: 10, color: darkStone, material: "stone", rotationY: Math.PI / 2 },
  { id: "court-column-a", kind: "column", x: -22, z: 13, size: 4, h: 10, color: sandstone, material: "stone" },
  { id: "court-column-b", kind: "column", x: 23, z: 61, size: 4, h: 8, color: mossStone, material: "stone" },
  { id: "court-pottery-west", kind: "debris", x: -52, z: 29, size: 6, h: 1.6, color: "#9b5a3c", material: "stone" },
  { id: "court-pottery-east", kind: "debris", x: 57, z: 29, size: 6, h: 1.6, color: "#a96a42", material: "stone" },
  { id: "bridge-repair-crates", kind: "crate", x: 78, z: -99, size: 4, h: 5, color: timber, material: "wood" },
  { id: "survey-crates", kind: "crate", x: 59, z: 91, size: 4, h: 5, color: timber, material: "wood" },
  { id: "survey-awning", kind: "shade", x: 46, z: 126, size: 9, h: 6, color: canvas, material: "cloth" },
  { id: "blue-standard", kind: "banner", x: -150, z: -57, size: 3.5, h: 10, color: "#38bdf8", material: "cloth" },
  { id: "red-standard", kind: "banner", x: 150, z: -57, size: 3.5, h: 10, color: "#fb7185", material: "cloth" },
  { id: "rootway-tree-west", kind: "palm", x: -113, z: 132, size: 7, h: 18, color: timber, material: "wood" },
  { id: "rootway-tree-east", kind: "palm", x: 114, z: 95, size: 7, h: 19, color: timber, material: "wood" },
  { id: "court-tree-west", kind: "palm", x: -105, z: 52, size: 6, h: 17, color: timber, material: "wood" },
  { id: "court-tree-east", kind: "palm", x: 106, z: 53, size: 6, h: 17, color: timber, material: "wood" },
  { id: "sun-debris-west", kind: "debris", x: -18, z: -101, size: 7, h: 1.8, color: sandstone, material: "stone" },
  { id: "rootway-fallen-idol", kind: "debris", x: -31, z: 127, size: 8, h: 2, color: mossStone, material: "stone" },
  { id: "canal-lamp-west", kind: "lamp", x: -99, z: -23, size: 2, h: 7, color: "#6be4d8", material: "accent" },
  { id: "canal-lamp-east", kind: "lamp", x: 97, z: -63, size: 2, h: 7, color: "#6be4d8", material: "accent" }
];

export const props = rawProps.map(scalePoint);

const rawSigns: CitadelSign[] = [
  { id: "sign-sun", label: "SUN BRIDGE", x: -4, z: -128, color: "#f6d67d", rotationY: 0, y: 8 },
  { id: "sign-canal", label: "FLOODED CANAL", x: 0, z: -62, color: "#7be5dc", rotationY: 0, y: 7 },
  { id: "sign-court", label: "RAIN GOD COURT", x: 0, z: 66, color: "#ebc986", rotationY: Math.PI, y: 9 },
  { id: "sign-root", label: "ROOTWAY", x: 0, z: 142, color: "#9fd28d", rotationY: Math.PI, y: 8 },
  { id: "sign-blue", label: "BLUE SHRINE", x: -127, z: 84, color: "#7dd3fc", rotationY: Math.PI / 2, y: 8 },
  { id: "sign-red", label: "RED EXPEDITION", x: 127, z: 84, color: "#fb9a72", rotationY: -Math.PI / 2, y: 8 }
];

export const signs = rawSigns.map(scalePoint);
