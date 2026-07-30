import {
  ARENA_SCALE,
  TEMPLE_RUNOFF_MAIN_LEVEL_Y,
  TEMPLE_RUNOFF_STAIR_FLIGHTS,
  TEMPLE_RUNOFF_UPPER_LEVEL_Y
} from "@quizstrike/shared";
import type { ArenaStairFlight } from "@quizstrike/shared";
import type {
  ArenaMapDefinition,
  CitadelBlock,
  CitadelCylinder,
  CitadelFloorMark,
  CitadelProp,
  CitadelSign
} from "./mapTypes";

const scale = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleRect = <T extends { x: number; z: number; w: number; d: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z), w: scale(item.w), d: scale(item.d) }) as T;
const scaleCylinder = <T extends { x: number; z: number; radius: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z), radius: scale(item.radius) }) as T;
const scalePoint = <T extends { x: number; z: number }>(item: T): T =>
  ({ ...item, x: scale(item.x), z: scale(item.z) }) as T;

export const TEMPLE_RUNOFF: ArenaMapDefinition = {
  id: "temple_runoff",
  title: "Temple Runoff 2.0",
  description: "A flooded jungle city built as three stacked combat layers around a clear ceremonial canal and its high central bridge.",
  footprint: { width: scale(470), depth: scale(400) },
  districts: [
    "Blue Temple Complex · western team staging",
    "Flooded Ceremonial Canal · continuous lower lane",
    "Rain Court · open main-level team fight",
    "Sun Bridge · iconic elevated crossing",
    "Jungle Ruins · close-range northern flank",
    "Upper Terrace · limited long-range position"
  ],
  routes: [
    "Lower Waterway · clean close-medium flanking lane",
    "Temple Street · broad primary combat route",
    "Jungle Ruins · broken-sightline quick-blaster flank",
    "Sun Bridge · elevated medium-long crossing",
    "Sluice Tunnels · protected river access",
    "Broken Ford · fast exposed cross-canal rotation"
  ],
  palette: {
    sky: "#80aaa1",
    fog: "#a4bcaa",
    floor: "#6f6b4d",
    floorTexture: "floor",
    accent: "#3aaea8"
  }
};

const sandstone = "#aa9162";
const sunStone = "#c5ab70";
const mossStone = "#697653";
const dampStone = "#4f6657";
const deepMoss = "#405542";
const darkStone = "#454c43";
const timber = "#6b4b31";
const water = "#399e9e";
const agedPlaster = "#b7a779";

const mainFloorCenter = TEMPLE_RUNOFF_MAIN_LEVEL_Y - 0.7;
const upperFloorCenter = TEMPLE_RUNOFF_UPPER_LEVEL_Y - 0.7;

const makeTempleStairFlight = (flight: ArenaStairFlight): CitadelBlock[] =>
  Array.from({ length: flight.steps }, (_, index) => {
    const progress = (index + 1) / flight.steps;
    const travel = (-0.5 + (index + 0.5) / flight.steps) * flight.length * flight.direction;
    const topY = flight.startY + (flight.endY - flight.startY) * progress;
    const height = topY - flight.startY;
    const jungleSide = flight.z < 0 || flight.x < 0;
    return {
      id: `${flight.id}-step-${index + 1}`,
      x: flight.x + (flight.axis === "x" ? travel : 0),
      z: flight.z + (flight.axis === "z" ? travel : 0),
      w: flight.axis === "x" ? flight.length / flight.steps + 0.6 : flight.width,
      d: flight.axis === "z" ? flight.length / flight.steps + 0.6 : flight.width,
      h: height,
      y: flight.startY + height / 2,
      color: jungleSide ? dampStone : sandstone,
      material: "stone",
      style: "stair"
    };
  });

const rawBlocks: CitadelBlock[] = [
  { id: "temple-north-cliff", label: "North Jungle Escarpment", x: 0, z: -196, w: 470, d: 8, h: 28, y: 14, color: darkStone, material: "stone", style: "wall", collides: true },
  { id: "temple-south-cliff", label: "South Temple Wall", x: 0, z: 196, w: 470, d: 8, h: 28, y: 14, color: deepMoss, material: "stone", style: "wall", collides: true },
  { id: "temple-west-cliff", x: -231, z: 0, w: 8, d: 400, h: 28, y: 14, color: darkStone, material: "stone", style: "wall", collides: true },
  { id: "temple-east-cliff", x: 231, z: 0, w: 8, d: 400, h: 28, y: 14, color: darkStone, material: "stone", style: "wall", collides: true },

  { id: "temple-main-north-floor", label: "Jungle Temple Level", x: 0, z: -122, w: 454, d: 148, h: 1.4, y: mainFloorCenter, color: mossStone, material: "stone", style: "sandbank" },
  { id: "temple-main-south-floor", label: "Rain Court Level", x: 0, z: 122, w: 454, d: 148, h: 1.4, y: mainFloorCenter, color: sandstone, material: "stone", style: "sandbank" },
  { id: "north-lip-far-west", x: -188.5, z: -36, w: 77, d: 24, h: 1.4, y: mainFloorCenter, color: mossStone, material: "stone", style: "sandbank" },
  { id: "north-lip-west", x: -94, z: -36, w: 56, d: 24, h: 1.4, y: mainFloorCenter, color: mossStone, material: "stone", style: "sandbank" },
  { id: "north-lip-center", x: 1.5, z: -36, w: 79, d: 24, h: 1.4, y: mainFloorCenter, color: mossStone, material: "stone", style: "sandbank" },
  { id: "north-lip-east", x: 95.5, z: -36, w: 53, d: 24, h: 1.4, y: mainFloorCenter, color: mossStone, material: "stone", style: "sandbank" },
  { id: "north-lip-far-east", x: 188.5, z: -36, w: 77, d: 24, h: 1.4, y: mainFloorCenter, color: mossStone, material: "stone", style: "sandbank" },
  { id: "south-lip-far-west", x: -188.5, z: 36, w: 77, d: 24, h: 1.4, y: mainFloorCenter, color: sandstone, material: "stone", style: "sandbank" },
  { id: "south-lip-west", x: -94, z: 36, w: 56, d: 24, h: 1.4, y: mainFloorCenter, color: sandstone, material: "stone", style: "sandbank" },
  { id: "south-lip-center", x: 1.5, z: 36, w: 79, d: 24, h: 1.4, y: mainFloorCenter, color: sandstone, material: "stone", style: "sandbank" },
  { id: "south-lip-east", x: 95.5, z: 36, w: 53, d: 24, h: 1.4, y: mainFloorCenter, color: sandstone, material: "stone", style: "sandbank" },
  { id: "south-lip-far-east", x: 188.5, z: 36, w: 77, d: 24, h: 1.4, y: mainFloorCenter, color: sandstone, material: "stone", style: "sandbank" },
  { id: "ceremonial-canal-water", label: "Lower Waterway", x: 0, z: 0, w: 404, d: 48, h: 0.16, y: 0.03, color: water, material: "water", style: "channel" },
  ...TEMPLE_RUNOFF_STAIR_FLIGHTS.flatMap(makeTempleStairFlight),

  { id: "canal-bank-north-far-west", x: -188.5, z: -25, w: 77, d: 5, h: 8, y: 4, color: dampStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-north-west", x: -94, z: -25, w: 56, d: 5, h: 8, y: 4, color: darkStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-north-center", x: 1.5, z: -25, w: 79, d: 5, h: 8, y: 4, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "canal-bank-north-east", x: 95.5, z: -25, w: 53, d: 5, h: 8, y: 4, color: dampStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-north-far-east", x: 188.5, z: -25, w: 77, d: 5, h: 8, y: 4, color: dampStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-south-far-west", x: -188.5, z: 25, w: 77, d: 5, h: 8, y: 4, color: darkStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-south-west", x: -94, z: 25, w: 56, d: 5, h: 8, y: 4, color: dampStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-south-center", x: 1.5, z: 25, w: 79, d: 5, h: 8, y: 4, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "canal-bank-south-east", x: 95.5, z: 25, w: 53, d: 5, h: 8, y: 4, color: mossStone, material: "stone", style: "wall", collides: true },
  { id: "canal-bank-south-far-east", x: 188.5, z: 25, w: 77, d: 5, h: 8, y: 4, color: mossStone, material: "stone", style: "wall", collides: true },

  { id: "sun-bridge-deck", label: "Sun Bridge", x: 0, z: 0, w: 36, d: 116, h: 1.4, y: upperFloorCenter, color: sunStone, material: "stone", style: "bridge" },
  { id: "sun-bridge-support-nw", x: -14, z: -35, w: 7, d: 8, h: 17, y: 8.5, color: darkStone, material: "stone", style: "tower", collides: true },
  { id: "sun-bridge-support-ne", x: 14, z: -35, w: 7, d: 8, h: 17, y: 8.5, color: darkStone, material: "stone", style: "tower", collides: true },
  { id: "sun-bridge-support-sw", x: -14, z: 35, w: 7, d: 8, h: 17, y: 8.5, color: dampStone, material: "stone", style: "tower", collides: true },
  { id: "sun-bridge-support-se", x: 14, z: 35, w: 7, d: 8, h: 17, y: 8.5, color: dampStone, material: "stone", style: "tower", collides: true },
  { id: "sun-parapet-west", x: -19, z: -18, w: 4, d: 44, h: 4, y: 19, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "sun-parapet-east", x: 19, z: 17, w: 4, d: 46, h: 4, y: 19, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "sun-bridge-altar-north", x: -7, z: -16, w: 10, d: 9, h: 5, y: 19.5, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "sun-bridge-altar-south", x: 7, z: 16, w: 10, d: 9, h: 5, y: 19.5, color: sunStone, material: "stone", style: "ruin", collides: true },

  { id: "upper-jungle-terrace", label: "Jungle Walkway", x: -68, z: -66, w: 100, d: 28, h: 1.4, y: upperFloorCenter, color: mossStone, material: "stone", style: "bridge" },
  { id: "upper-temple-terrace", label: "Temple Terrace", x: 68, z: 66, w: 100, d: 28, h: 1.4, y: upperFloorCenter, color: sandstone, material: "stone", style: "bridge" },
  { id: "upper-jungle-balustrade", x: -75, z: -82, w: 56, d: 4, h: 4, y: 19, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "upper-temple-balustrade", x: 75, z: 82, w: 56, d: 4, h: 4, y: 19, color: sandstone, material: "stone", style: "ruin", collides: true },

  { id: "blue-temple-gatehouse", label: "Blue Temple Complex", x: -204, z: -92, w: 28, d: 42, h: 15, y: 15.5, color: mossStone, material: "stone", style: "gate", collides: true },
  { id: "blue-temple-foundation", x: -204, z: 83, w: 30, d: 52, h: 12, y: 14, color: deepMoss, material: "stone", style: "ruin", collides: true },
  { id: "red-temple-gatehouse", label: "Red Temple Complex", x: 204, z: 92, w: 28, d: 42, h: 15, y: 15.5, color: sandstone, material: "stone", style: "gate", collides: true },
  { id: "red-temple-foundation", x: 204, z: -83, w: 30, d: 52, h: 12, y: 14, color: agedPlaster, material: "stone", style: "ruin", collides: true },

  // Broken gate screens stop direct fire into the four 5-player spawn rows.
  // Their alternating materials make each exit readable without changing the
  // existing spawn coordinates or sealing the broad routes between them.
  { id: "blue-jungle-spawn-screen", x: -174, z: -154, w: 8, d: 30, h: 9, y: 12.5, color: deepMoss, material: "stone", style: "ruin", collides: true },
  { id: "blue-canal-spawn-screen", x: -174, z: -52, w: 8, d: 24, h: 8, y: 12, color: dampStone, material: "stone", style: "wall", collides: true },
  { id: "blue-rain-spawn-screen", x: -174, z: 48, w: 8, d: 24, h: 8, y: 12, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "blue-temple-spawn-screen", x: -174, z: 154, w: 8, d: 30, h: 9, y: 12.5, color: agedPlaster, material: "stone", style: "wall", collides: true },
  { id: "red-jungle-spawn-screen", x: 174, z: -154, w: 8, d: 30, h: 9, y: 12.5, color: dampStone, material: "stone", style: "wall", collides: true },
  { id: "red-canal-spawn-screen", x: 174, z: -52, w: 8, d: 24, h: 8, y: 12, color: agedPlaster, material: "stone", style: "ruin", collides: true },
  { id: "red-rain-spawn-screen", x: 174, z: 48, w: 8, d: 24, h: 8, y: 12, color: sandstone, material: "stone", style: "wall", collides: true },
  { id: "red-temple-spawn-screen", x: 174, z: 154, w: 8, d: 30, h: 9, y: 12.5, color: mossStone, material: "stone", style: "ruin", collides: true },

  { id: "jungle-ruin-wall", label: "Jungle Ruins", x: -98, z: -132, w: 54, d: 8, h: 10, y: 13, color: deepMoss, material: "stone", style: "ruin", collides: true },
  { id: "jungle-root-cover", x: -42, z: -116, w: 22, d: 9, h: 5, y: 10.5, color: timber, material: "wood", style: "logstack", collides: true },
  { id: "north-collapsed-sanctum", x: 76, z: -132, w: 42, d: 16, h: 12, y: 14, color: dampStone, material: "stone", style: "ruin", collides: true },
  { id: "jungle-arcade-pier-west", x: -68, z: -88, w: 10, d: 34, h: 8, y: 12, color: mossStone, material: "stone", style: "tower", collides: true },
  { id: "jungle-arcade-pier-east", x: 28, z: -70, w: 10, d: 30, h: 8, y: 12, color: darkStone, material: "stone", style: "tower", collides: true },
  { id: "rain-court-wall-west", label: "Rain Court", x: -90, z: 112, w: 44, d: 8, h: 9, y: 12.5, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "rain-court-wall-east", x: 82, z: 118, w: 48, d: 8, h: 9, y: 12.5, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "rain-court-planter", x: 18, z: 125, w: 24, d: 12, h: 3.5, y: 9.75, color: agedPlaster, material: "stone", style: "ruin", collides: true },
  { id: "rain-arcade-pier-west", x: -28, z: 70, w: 10, d: 30, h: 8, y: 12, color: agedPlaster, material: "stone", style: "tower", collides: true },
  { id: "rain-arcade-pier-east", x: 68, z: 88, w: 10, d: 34, h: 8, y: 12, color: sandstone, material: "stone", style: "tower", collides: true },

  { id: "lower-broken-pillar", x: -72, z: 2, w: 10, d: 12, h: 5.5, y: 2.75, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "lower-collapsed-wall", x: 58, z: 17, w: 24, d: 7, h: 4.5, y: 2.25, color: dampStone, material: "stone", style: "ruin", collides: true },
  { id: "lower-submerged-ruin", x: 150, z: 7, w: 20, d: 10, h: 3.2, y: 1.6, color: darkStone, material: "stone", style: "rock", collides: true },
  { id: "lower-west-sluice-cover", x: -166, z: 10, w: 14, d: 8, h: 5, y: 2.5, color: darkStone, material: "stone", style: "ruin", collides: true },
  { id: "lower-west-tablet-cover", x: -24, z: -12, w: 16, d: 8, h: 4.5, y: 2.25, color: mossStone, material: "stone", style: "ruin", collides: true },
  { id: "lower-east-tablet-cover", x: 102, z: -11, w: 16, d: 8, h: 4.5, y: 2.25, color: sandstone, material: "stone", style: "ruin", collides: true },
  { id: "lower-east-sluice-cover", x: 184, z: 11, w: 12, d: 8, h: 5, y: 2.5, color: dampStone, material: "stone", style: "ruin", collides: true },
  { id: "west-broken-ford-a", label: "Broken Ford", x: -145, z: -8, w: 20, d: 12, h: 0.7, y: 0.35, color: sunStone, material: "stone", style: "bridge" },
  { id: "west-broken-ford-b", x: -145, z: 10, w: 20, d: 10, h: 0.7, y: 0.35, color: mossStone, material: "stone", style: "bridge" },
  { id: "east-wood-crossing", label: "Timber Crossing", x: 126, z: 0, w: 20, d: 48, h: 0.8, y: 7.6, color: timber, material: "wood", style: "bridge" },

  { id: "west-sluice-mouth", label: "West Sluice", x: -190, z: 0, w: 12, d: 28, h: 12, y: 6, color: darkStone, material: "stone", style: "gate", rotationY: Math.PI / 2 },
  { id: "east-sluice-mouth", label: "East Sluice", x: 190, z: 0, w: 12, d: 28, h: 12, y: 6, color: dampStone, material: "stone", style: "gate", rotationY: Math.PI / 2 }
];

export const blocks = rawBlocks.map(({ label: _label, ...block }) => scaleRect(block));

const rawCylinders: CitadelCylinder[] = [
  { id: "rain-god-statue", label: "Rain God", x: 0, z: 126, radius: 7, h: 17, y: 16.5, color: mossStone, material: "stone", collides: true },
  { id: "jungle-column-west", x: -126, z: -104, radius: 4, h: 12, y: 14, color: mossStone, material: "stone", collides: true },
  { id: "temple-column-east", x: 122, z: 111, radius: 4, h: 12, y: 14, color: sandstone, material: "stone", collides: true },
  { id: "canal-rock", x: 18, z: 12, radius: 5, h: 4.2, y: 2.1, color: darkStone, material: "stone", collides: true },
  { id: "upper-jungle-column", x: -94, z: -66, radius: 3, h: 8, y: 21, color: mossStone, material: "stone", collides: true },
  { id: "upper-temple-column", x: 96, z: 66, radius: 3, h: 8, y: 21, color: sandstone, material: "stone", collides: true }
];

export const cylinders = rawCylinders.map(({ label: _label, ...cylinder }) => scaleCylinder(cylinder));

const rawFloorMarks: CitadelFloorMark[] = [
  { id: "temple-route-river", label: "LOWER WATERWAY ↓", x: 0, z: 0, w: 116, d: 16, color: "#78d4cc", y: 0.09 },
  { id: "temple-route-jungle", label: "JUNGLE RUINS", x: -88, z: -151, w: 68, d: 14, color: "#a6cf87", y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 0.05 },
  { id: "temple-route-court", label: "RAIN COURT", x: 0, z: 126, w: 74, d: 14, color: "#e3c687", y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 0.05 },
  { id: "temple-route-bridge", label: "SUN BRIDGE ↑", x: 0, z: 0, w: 30, d: 52, color: "#f1d47c", y: TEMPLE_RUNOFF_UPPER_LEVEL_Y + 0.05 },
  { id: "temple-route-blue", label: "BLUE TEMPLE", x: -192, z: 0, w: 54, d: 14, color: "#7dd3fc", y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 0.05 },
  { id: "temple-route-red", label: "RED TEMPLE", x: 192, z: 0, w: 54, d: 14, color: "#fb9a72", y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 0.05 }
];

export const floorMarks: CitadelFloorMark[] = rawFloorMarks.slice(0, 0);

const rawProps: CitadelProp[] = [
  { id: "blue-standard", kind: "banner", x: -214, z: 0, size: 3.5, h: 12, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y, color: "#38bdf8", material: "cloth" },
  { id: "red-standard", kind: "banner", x: 214, z: 0, size: 3.5, h: 12, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y, color: "#fb7185", material: "cloth" },
  { id: "jungle-tree-west", kind: "palm", x: -158, z: -152, size: 8, h: 22, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y, color: timber, material: "wood" },
  { id: "jungle-tree-mid", kind: "tree", x: -22, z: -162, size: 8, h: 24, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y, color: timber, material: "wood" },
  { id: "court-tree-east", kind: "palm", x: 155, z: 148, size: 8, h: 22, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y, color: timber, material: "wood" },
  { id: "canal-lantern-west", kind: "lamp", x: -112, z: -20, size: 2, h: 7, y: 0, color: "#8be0cf", material: "accent" },
  { id: "canal-lantern-east", kind: "lamp", x: 104, z: 20, size: 2, h: 7, y: 0, color: "#8be0cf", material: "accent" },
  { id: "upper-sun-arch", kind: "arch", x: 0, z: -45, size: 10, h: 13, y: TEMPLE_RUNOFF_UPPER_LEVEL_Y, color: sunStone, material: "stone" },
  { id: "court-fallen-idol", kind: "debris", x: -36, z: 102, size: 8, h: 2, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y, color: mossStone, material: "stone" },
  { id: "jungle-shrine-arch", kind: "arch", x: -158, z: -108, size: 10, h: 12, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y, color: mossStone, material: "stone" }
];

export const props = rawProps.map(scalePoint);

const rawSigns: CitadelSign[] = [
  { id: "sign-river", label: "LOWER WATERWAY ↓", x: -34, z: -28, color: "#83ded5", y: 7 },
  { id: "sign-bridge", label: "SUN BRIDGE ↑", x: 0, z: -86, color: "#f2d77f", y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 8 },
  { id: "sign-jungle", label: "JUNGLE RUINS", x: -88, z: -174, color: "#a7d08d", y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 8 },
  { id: "sign-court", label: "RAIN COURT", x: 0, z: 160, color: "#e8cb8a", rotationY: Math.PI, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 8 },
  { id: "sign-blue", label: "BLUE TEMPLE", x: -219, z: 48, color: "#7dd3fc", rotationY: Math.PI / 2, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 8 },
  { id: "sign-red", label: "RED TEMPLE", x: 219, z: -48, color: "#fb9a72", rotationY: -Math.PI / 2, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + 8 }
];

export const signs: CitadelSign[] = rawSigns.slice(0, 0);
