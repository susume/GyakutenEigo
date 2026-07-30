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
  description: "A rain-fed jungle sanctuary with three connected routes, broad shrine spawns, and contestable waterworks.",
  footprint: { width: scale(350), depth: scale(320) },
  districts: [
    "North Lane · Canopy Ruins",
    "Mid Lane · Processional Causeway",
    "South Lane · Cascade Runoff",
    "West Catch Basin",
    "Sunken Altar",
    "East Catch Basin",
    "Blue Shrine Court",
    "Red Shrine Court"
  ],
  routes: [
    "Canopy Trail · protected close-range flank",
    "Processional Causeway · fastest contested route",
    "Cascade Runoff · safer waterworks flank",
    "West Sluice · cross-lane rotation",
    "Altar Spillway · central rotation",
    "East Sluice · cross-lane rotation"
  ],
  palette: {
    sky: "#8db9a2",
    fog: "#7f9a82",
    floor: "#65745d",
    floorTexture: "floor",
    accent: "#61c7b3"
  }
};

const basalt = "#4e5a50";
const darkBasalt = "#35423d";
const oldStone = "#788174";
const paleStone = "#aeb29a";
const moss = "#586c49";
const deepMoss = "#3f563e";
const wood = "#594735";
const water = "#36a9aa";
const blue = "#377da0";
const red = "#9d4f48";

const rawBlocks: CitadelBlock[] = [
  // Continuous, readable arena edge with no escape seams.
  { id: "temple-north-boundary", x: 0, z: -157, w: 350, d: 6, h: 13, color: darkBasalt, style: "wall", collides: true },
  { id: "temple-south-boundary", x: 0, z: 157, w: 350, d: 6, h: 13, color: darkBasalt, style: "wall", collides: true },
  { id: "temple-west-boundary", x: -172, z: 0, w: 6, d: 320, h: 13, color: darkBasalt, style: "wall", collides: true },
  { id: "temple-east-boundary", x: 172, z: 0, w: 6, d: 320, h: 13, color: darkBasalt, style: "wall", collides: true },

  // Team courts: two offset shield walls create centre, north, and south exits.
  { id: "blue-shrine-screen-north", x: -116, z: -43, w: 7, d: 54, h: 10, color: basalt, style: "wall", collides: true },
  { id: "blue-shrine-screen-south", x: -116, z: 43, w: 7, d: 54, h: 10, color: basalt, style: "wall", collides: true },
  { id: "blue-shrine-house-north", label: "Blue Rain Shrine", x: -150, z: -72, w: 28, d: 18, h: 9, color: blue, style: "house", collides: true },
  { id: "blue-shrine-house-south", label: "Blue Storehouse", x: -150, z: 72, w: 28, d: 18, h: 8, color: oldStone, style: "house", collides: true },
  { id: "blue-centre-gate-pier", x: -108, z: 0, w: 8, d: 10, h: 8, color: paleStone, style: "gate", collides: true },
  { id: "red-shrine-screen-north", x: 116, z: -43, w: 7, d: 54, h: 10, color: basalt, style: "wall", collides: true },
  { id: "red-shrine-screen-south", x: 116, z: 43, w: 7, d: 54, h: 10, color: basalt, style: "wall", collides: true },
  { id: "red-shrine-house-north", label: "Red Rain Shrine", x: 150, z: -72, w: 28, d: 18, h: 9, color: red, style: "house", collides: true },
  { id: "red-shrine-house-south", label: "Red Storehouse", x: 150, z: 72, w: 28, d: 18, h: 8, color: oldStone, style: "house", collides: true },
  { id: "red-centre-gate-pier", x: 108, z: 0, w: 8, d: 10, h: 8, color: paleStone, style: "gate", collides: true },

  // North: staggered ruins create a protected flank without forming a maze.
  { id: "canopy-west-sanctum", label: "Canopy Sanctum", x: -82, z: -111, w: 30, d: 18, h: 11, color: moss, style: "ruin", collides: true },
  { id: "canopy-west-wall", x: -48, z: -87, w: 20, d: 8, h: 6, color: oldStone, style: "ruin", collides: true },
  { id: "canopy-orchid-shrine", label: "Orchid Court", x: 0, z: -119, w: 24, d: 22, h: 16, color: basalt, style: "tower", collides: true },
  { id: "canopy-east-wall", x: 48, z: -91, w: 20, d: 8, h: 6, color: oldStone, style: "ruin", collides: true },
  { id: "canopy-east-sanctum", label: "Canopy Sanctum", x: 82, z: -111, w: 30, d: 18, h: 11, color: moss, style: "ruin", collides: true },
  { id: "canopy-cover-west", x: -20, z: -84, w: 13, d: 7, h: 2.6, color: deepMoss, style: "ruin", collides: true },
  { id: "canopy-cover-east", x: 22, z: -82, w: 13, d: 7, h: 2.6, color: deepMoss, style: "ruin", collides: true },

  // Centre: fast causeway, offset cover, and a contestable altar with four ways around it.
  { id: "causeway-water-north", x: 0, z: -18, w: 212, d: 7, h: 0.22, y: 0.04, color: water, material: "water", style: "channel" },
  { id: "causeway-water-south", x: 0, z: 18, w: 212, d: 7, h: 0.22, y: 0.04, color: water, material: "water", style: "channel" },
  { id: "west-catch-basin", label: "West Catch Basin", x: -69, z: 0, w: 25, d: 25, h: 10, color: basalt, style: "tower", collides: true },
  { id: "east-catch-basin", label: "East Catch Basin", x: 69, z: 0, w: 25, d: 25, h: 10, color: basalt, style: "tower", collides: true },
  { id: "sunken-altar", label: "Sunken Altar", x: 0, z: 0, w: 24, d: 24, h: 7, color: paleStone, style: "tower", collides: true },
  { id: "causeway-cover-blue", x: -37, z: 8, w: 13, d: 7, h: 2.5, color: oldStone, style: "ruin", collides: true },
  { id: "causeway-cover-red", x: 37, z: -8, w: 13, d: 7, h: 2.5, color: oldStone, style: "ruin", collides: true },
  { id: "causeway-west-gate", x: -93, z: -30, w: 16, d: 7, h: 7, color: oldStone, style: "gate", collides: true },
  { id: "causeway-east-gate", x: 93, z: 30, w: 16, d: 7, h: 7, color: oldStone, style: "gate", collides: true },

  // South: runoff terraces and cistern houses create short-range pockets and broad rotations.
  { id: "cascade-water-upper", x: 0, z: 79, w: 214, d: 9, h: 0.24, y: 0.04, color: water, material: "water", style: "channel" },
  { id: "cascade-water-lower", x: 0, z: 125, w: 188, d: 12, h: 0.24, y: 0.04, color: "#238f99", material: "water", style: "channel" },
  { id: "west-cistern-house", label: "West Cistern", x: -78, z: 108, w: 30, d: 23, h: 10, color: moss, style: "house", collides: true },
  { id: "east-cistern-house", label: "East Cistern", x: 78, z: 108, w: 30, d: 23, h: 10, color: moss, style: "house", collides: true },
  { id: "cascade-garden-west", x: -31, z: 102, w: 20, d: 12, h: 5, color: oldStone, style: "ruin", collides: true },
  { id: "cascade-garden-east", x: 31, z: 104, w: 20, d: 12, h: 5, color: oldStone, style: "ruin", collides: true },
  { id: "cascade-altar", label: "Cascade Gardens", x: 0, z: 135, w: 22, d: 16, h: 13, color: darkBasalt, style: "tower", collides: true },
  { id: "runoff-cover-west", x: -103, z: 88, w: 14, d: 8, h: 2.4, color: wood, style: "bridge", material: "wood", collides: true },
  { id: "runoff-cover-east", x: 103, z: 88, w: 14, d: 8, h: 2.4, color: wood, style: "bridge", material: "wood", collides: true },

  // Thin non-colliding elevated silhouettes communicate old water infrastructure.
  { id: "west-overflow-aqueduct", x: -63, z: 55, w: 72, d: 5, h: 3, y: 12, color: oldStone, style: "bridge" },
  { id: "east-overflow-aqueduct", x: 63, z: 55, w: 72, d: 5, h: 3, y: 12, color: oldStone, style: "bridge" },
  { id: "temple-crown", x: 0, z: 48, w: 30, d: 26, h: 28, y: 15, color: darkBasalt, style: "tower" }
];

export const blocks = rawBlocks.map(scaleRect);

const rawCylinders: CitadelCylinder[] = [
  { id: "blue-rain-bell", x: -137, z: 0, radius: 3.4, h: 8, color: blue, collides: true },
  { id: "red-rain-bell", x: 137, z: 0, radius: 3.4, h: 8, color: red, collides: true },
  { id: "orchid-column-west", x: -14, z: -110, radius: 2.4, h: 9, color: paleStone, collides: true },
  { id: "orchid-column-east", x: 14, z: -110, radius: 2.4, h: 9, color: paleStone, collides: true },
  { id: "cascade-brazier-west", x: -17, z: 127, radius: 2.5, h: 4, color: basalt, collides: true },
  { id: "cascade-brazier-east", x: 17, z: 127, radius: 2.5, h: 4, color: basalt, collides: true }
];

export const cylinders = rawCylinders.map(scaleCylinder);

const rawFloorMarks: CitadelFloorMark[] = [
  { id: "temple-route-canopy", label: "CANOPY TRAIL", x: 0, z: -74, w: 74, d: 10, color: "#8fbf78" },
  { id: "temple-route-causeway", label: "PROCESSIONAL CAUSEWAY", x: 0, z: 0, w: 76, d: 10, color: "#b8c4a2" },
  { id: "temple-route-runoff", label: "CASCADE RUNOFF", x: 0, z: 72, w: 72, d: 10, color: "#5fc7c4" },
  { id: "temple-west-rotation", label: "WEST SLUICE", x: -70, z: 49, w: 42, d: 9, color: "#72a998", rotation: Math.PI / 2 },
  { id: "temple-east-rotation", label: "EAST SLUICE", x: 70, z: 49, w: 42, d: 9, color: "#72a998", rotation: Math.PI / 2 }
];

export const floorMarks = rawFloorMarks.map(scaleRect);

const rawProps: CitadelProp[] = [
  { id: "canopy-arch-west", kind: "arch", x: -103, z: -85, size: 11, h: 9, color: paleStone },
  { id: "canopy-arch-east", kind: "arch", x: 103, z: -85, size: 11, h: 9, color: paleStone, rotationY: Math.PI },
  { id: "altar-arch-north", kind: "arch", x: 0, z: -39, size: 13, h: 10, color: oldStone, rotationY: Math.PI / 2 },
  { id: "altar-arch-south", kind: "arch", x: 0, z: 39, size: 13, h: 10, color: oldStone, rotationY: -Math.PI / 2 },
  { id: "blue-banner", kind: "banner", x: -121, z: -13, size: 4, h: 11, color: blue, material: "cloth" },
  { id: "red-banner", kind: "banner", x: 121, z: 13, size: 4, h: 11, color: red, material: "cloth" },
  { id: "canopy-palm-west-a", kind: "palm", x: -126, z: -125, size: 6, h: 19, color: wood, material: "wood" },
  { id: "canopy-palm-west-b", kind: "palm", x: -55, z: -132, size: 7, h: 21, color: wood, material: "wood" },
  { id: "canopy-palm-east-a", kind: "palm", x: 126, z: -125, size: 6, h: 19, color: wood, material: "wood" },
  { id: "canopy-palm-east-b", kind: "palm", x: 55, z: -134, size: 7, h: 21, color: wood, material: "wood" },
  { id: "runoff-palm-west", kind: "palm", x: -126, z: 126, size: 6, h: 18, color: wood, material: "wood" },
  { id: "runoff-palm-east", kind: "palm", x: 126, z: 126, size: 6, h: 18, color: wood, material: "wood" },
  { id: "orchid-debris-west", kind: "debris", x: -33, z: -126, size: 7, h: 2, color: oldStone },
  { id: "orchid-debris-east", kind: "debris", x: 34, z: -126, size: 7, h: 2, color: oldStone },
  { id: "cascade-column-west", kind: "column", x: -48, z: 132, size: 4, h: 8, color: paleStone },
  { id: "cascade-column-east", kind: "column", x: 48, z: 132, size: 4, h: 8, color: paleStone },
  { id: "basin-lamp-west", kind: "lamp", x: -69, z: 20, size: 1.7, h: 7, color: "#7be0c6", material: "accent" },
  { id: "basin-lamp-east", kind: "lamp", x: 69, z: -20, size: 1.7, h: 7, color: "#7be0c6", material: "accent" },
  { id: "water-pipe-west", kind: "pipe", x: -88, z: 78, size: 3, h: 16, color: basalt, rotationY: Math.PI / 2 },
  { id: "water-pipe-east", kind: "pipe", x: 88, z: 78, size: 3, h: 16, color: basalt, rotationY: Math.PI / 2 }
];

export const props = rawProps.map(scalePoint);

const rawSigns: CitadelSign[] = [
  { id: "temple-sign-canopy", label: "CANOPY RUINS", x: 0, z: -143, color: "#a7d28c", rotationY: 0, y: 11 },
  { id: "temple-sign-altar", label: "SUN ALTAR", x: 0, z: 14, color: "#d4d6b4", rotationY: Math.PI / 2, y: 10 },
  { id: "temple-sign-cascade", label: "CASCADE GARDENS", x: 0, z: 145, color: "#7edbd2", rotationY: Math.PI, y: 11 },
  { id: "temple-sign-blue", label: "BLUE RAIN SHRINE", x: -163, z: 0, color: "#79c8e8", rotationY: Math.PI / 2, y: 8 },
  { id: "temple-sign-red", label: "RED RAIN SHRINE", x: 163, z: 0, color: "#ef9b8f", rotationY: -Math.PI / 2, y: 8 }
];

export const signs = rawSigns.map(scalePoint);
