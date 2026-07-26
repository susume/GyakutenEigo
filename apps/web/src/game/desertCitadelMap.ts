import {
  ARENA_SCALE,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y
} from "@quizstrike/shared";
export type {
  ArenaMapDefinition,
  CitadelBlock,
  CitadelCylinder,
  CitadelFloorMark,
  CitadelProp,
  CitadelSign
} from "./mapTypes";
import type {
  ArenaMapDefinition,
  CitadelBlock,
  CitadelCylinder,
  CitadelFloorMark,
  CitadelProp,
  CitadelSign
} from "./mapTypes";

const scaleArenaValue = (value: number) => Number((value * ARENA_SCALE).toFixed(2));
const scaleRect = <T extends { x: number; z: number; w: number; d: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z), w: scaleArenaValue(item.w), d: scaleArenaValue(item.d) }) as T;
const scaleCylinder = <T extends { x: number; z: number; radius: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z), radius: scaleArenaValue(item.radius) }) as T;
const scalePoint = <T extends { x: number; z: number }>(item: T): T =>
  ({ ...item, x: scaleArenaValue(item.x), z: scaleArenaValue(item.z) }) as T;

export const DESERT_CITADEL: ArenaMapDefinition = {
  title: "Desert Citadel",
  id: "desert_citadel",
  description: "A fortified trading city layered above an ancient canal, with a monumental citadel, bazaar roofs, and open palm ruins.",
  footprint: { width: scaleArenaValue(500), depth: scaleArenaValue(360) },
  districts: [
    "Lion Gate • Blue assembly court",
    "Grand Bazaar • covered market",
    "Blue Fountain • citadel courtyard",
    "Sun Hall • fortress interior",
    "Palm Ruins • outer flank",
    "Broken Aqueduct • canal route",
    "Founders' Passage • underground flank",
    "Rooftop District • limited upper route",
    "Sun Gate • Red assembly court"
  ],
  routes: [
    "Main Citadel Route • gates, fountain court, Sun Hall",
    "Bazaar Route • canopies, shop arcades, balconies",
    "Outer Ruins Route • dunes, broken arches, long-range pockets",
    "Canal Route • aqueduct channel and Founders' Passage",
    "Cross-connections • three stair courts and two rooftop links"
  ],
  palette: {
    sky: "#8fc9df",
    fog: "#d8bd86",
    floor: "#d7ad68",
    floorTexture: "sand",
    accent: "#efc56f"
  }
};

const warmStone = "#c89a5d";
const paleStone = "#dec187";
const goldStone = "#d2a45f";
const ochre = "#ad7546";
const darkStone = "#765238";
const terracotta = "#a95f43";
const timber = "#62432d";
const blue = "#287daf";
const red = "#ae4545";
const turquoise = "#2ca6af";
const water = "#249eb3";
const palmGreen = "#5e7f54";
const mainY = DESERT_CITADEL_MAIN_LEVEL_Y;
const roofY = DESERT_CITADEL_ROOFTOP_LEVEL_Y;
const centerAt = (floorY: number, height: number) => floorY + height / 2;

const rawFloorMarks: CitadelFloorMark[] = [
  { id: "route-main", label: "MAIN CITADEL ROUTE •", x: 0, z: 0, w: 430, d: 30, color: "#f0c879", y: mainY + 0.04 },
  { id: "route-bazaar", label: "GRAND BAZAAR •", x: -55, z: 76, w: 285, d: 30, color: "#d77b58", y: mainY + 0.04 },
  { id: "route-ruins", label: "PALM RUINS ↓", x: 0, z: -118, w: 410, d: 34, color: "#88aa72" },
  { id: "route-canal", label: "BROKEN AQUEDUCT ↓", x: 0, z: 133, w: 410, d: 18, color: "#43b9c7" },
  { id: "route-underground", label: "FOUNDERS' PASSAGE ↓", x: 0, z: 60, w: 220, d: 14, color: "#65c7cf" },
  { id: "route-rooftop-west", label: "BAZAAR ROOFS ↑", x: -105, z: 76, w: 92, d: 17, color: "#dfb357", y: roofY + 0.04 },
  { id: "route-rooftop-east", label: "SUN HALL ROOF ↑", x: 105, z: 58, w: 82, d: 17, color: "#efcd76", y: roofY + 0.04 },
  { id: "blue-base", label: "BLUE ASSEMBLY COURT", x: -218, z: 0, w: 46, d: 30, color: "#55b9ef", y: mainY + 0.04 },
  { id: "red-base", label: "RED ASSEMBLY COURT", x: 218, z: 0, w: 46, d: 30, color: "#ef7474", y: mainY + 0.04 }
];
export const floorMarks: CitadelFloorMark[] = rawFloorMarks.map(scaleRect);

const rawBlocks: CitadelBlock[] = [
  // Natural perimeter: a continuous silhouette with readable gate breaks.
  { id: "north-cliff-west", x: -150, z: -178, w: 200, d: 8, h: 11, color: darkStone, collides: true, style: "ruin" },
  { id: "north-cliff-east", x: 150, z: -178, w: 200, d: 8, h: 13, color: darkStone, collides: true, style: "ruin" },
  { id: "south-wall-west", x: -150, z: 178, w: 200, d: 8, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "south-wall-east", x: 150, z: 178, w: 200, d: 8, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "west-city-wall-north", x: -248, z: -112, w: 8, d: 132, h: 15, color: darkStone, collides: true, style: "wall" },
  { id: "west-city-wall-south", x: -248, z: 112, w: 8, d: 132, h: 15, color: darkStone, collides: true, style: "wall" },
  { id: "east-city-wall-north", x: 248, z: -112, w: 8, d: 132, h: 15, color: darkStone, collides: true, style: "wall" },
  { id: "east-city-wall-south", x: 248, z: 112, w: 8, d: 132, h: 15, color: darkStone, collides: true, style: "wall" },

  // Main-city terraces. These are visual slabs; floor selection owns movement.
  { id: "main-spine-floor", x: 0, z: 0, w: 444, d: 64, h: 1, y: mainY - 0.5, color: warmStone, material: "stone", style: "bridge" },
  { id: "blue-base-floor", x: -220, z: 0, w: 52, d: 150, h: 1, y: mainY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "red-base-floor", x: 220, z: 0, w: 52, d: 150, h: 1, y: mainY - 0.5, color: goldStone, material: "stone", style: "bridge" },
  { id: "courtyard-floor", x: 0, z: 28, w: 132, d: 118, h: 1, y: mainY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "bazaar-floor", x: -92, z: 78, w: 196, d: 72, h: 1, y: mainY - 0.5, color: warmStone, material: "stone", style: "bridge" },
  { id: "fortress-floor", x: 108, z: 70, w: 118, d: 88, h: 1, y: mainY - 0.5, color: goldStone, material: "stone", style: "bridge" },

  // Team bases: 20-player courts, four broad exits, screened objectives.
  { id: "blue-base-back", x: -240, z: 0, w: 5, d: 126, h: 13, y: centerAt(mainY, 13), color: darkStone, collides: true, style: "wall" },
  { id: "blue-base-north", x: -233, z: -74, w: 26, d: 5, h: 10, y: centerAt(mainY, 10), color: warmStone, collides: true, style: "wall" },
  { id: "blue-base-south", x: -233, z: 74, w: 26, d: 5, h: 10, y: centerAt(mainY, 10), color: warmStone, collides: true, style: "wall" },
  { id: "blue-objective-pavilion", label: "Blue Objective Pavilion", x: -226, z: 0, w: 20, d: 28, h: 8, y: centerAt(mainY, 8), color: paleStone, collides: true, style: "house" },
  { id: "blue-sight-screen-north", x: -196, z: -35, w: 6, d: 28, h: 8, y: centerAt(mainY, 8), color: blue, collides: true, style: "wall" },
  { id: "blue-sight-screen-south", x: -196, z: 35, w: 6, d: 28, h: 8, y: centerAt(mainY, 8), color: blue, collides: true, style: "wall" },
  { id: "red-base-back", x: 240, z: 0, w: 5, d: 126, h: 13, y: centerAt(mainY, 13), color: darkStone, collides: true, style: "wall" },
  { id: "red-base-north", x: 233, z: -74, w: 26, d: 5, h: 10, y: centerAt(mainY, 10), color: goldStone, collides: true, style: "wall" },
  { id: "red-base-south", x: 233, z: 74, w: 26, d: 5, h: 10, y: centerAt(mainY, 10), color: goldStone, collides: true, style: "wall" },
  { id: "red-objective-pavilion", label: "Red Objective Pavilion", x: 226, z: 0, w: 20, d: 28, h: 8, y: centerAt(mainY, 8), color: paleStone, collides: true, style: "house" },
  { id: "red-sight-screen-north", x: 196, z: -35, w: 6, d: 28, h: 8, y: centerAt(mainY, 8), color: red, collides: true, style: "wall" },
  { id: "red-sight-screen-south", x: 196, z: 35, w: 6, d: 28, h: 8, y: centerAt(mainY, 8), color: red, collides: true, style: "wall" },

  // Lion Gate and Sun Gate are landmarks, not choke-point boxes.
  { id: "lion-gate-north-pier", label: "Lion Gate", x: -174, z: -19, w: 10, d: 12, h: 17, y: centerAt(mainY, 17), color: ochre, collides: true, style: "tower" },
  { id: "lion-gate-south-pier", x: -174, z: 19, w: 10, d: 12, h: 17, y: centerAt(mainY, 17), color: ochre, collides: true, style: "tower" },
  { id: "lion-gate-lintel", x: -174, z: 0, w: 10, d: 28, h: 4, y: mainY + 16, color: paleStone, collides: true, style: "gate" },
  { id: "sun-gate-north-pier", label: "Sun Gate", x: 174, z: -19, w: 10, d: 12, h: 17, y: centerAt(mainY, 17), color: ochre, collides: true, style: "tower" },
  { id: "sun-gate-south-pier", x: 174, z: 19, w: 10, d: 12, h: 17, y: centerAt(mainY, 17), color: ochre, collides: true, style: "tower" },
  { id: "sun-gate-lintel", x: 174, z: 0, w: 10, d: 28, h: 4, y: mainY + 16, color: paleStone, collides: true, style: "gate" },

  // Blue Fountain courtyard: broken into pockets with five approaches.
  { id: "court-north-wall-west", x: -45, z: -51, w: 36, d: 5, h: 9, y: centerAt(mainY, 9), color: darkStone, collides: true, style: "wall" },
  { id: "court-north-wall-east", x: 45, z: -51, w: 36, d: 5, h: 9, y: centerAt(mainY, 9), color: darkStone, collides: true, style: "wall" },
  { id: "court-south-arcade-west", x: -47, z: 73, w: 30, d: 7, h: 10, y: centerAt(mainY, 10), color: warmStone, collides: true, style: "house" },
  { id: "court-south-arcade-east", x: 47, z: 73, w: 30, d: 7, h: 10, y: centerAt(mainY, 10), color: warmStone, collides: true, style: "house" },
  { id: "court-broken-wall-west", x: -55, z: 18, w: 6, d: 23, h: 5, y: centerAt(mainY, 5), color: ochre, collides: true, style: "ruin" },
  { id: "court-broken-wall-east", x: 55, z: -18, w: 6, d: 23, h: 5, y: centerAt(mainY, 5), color: ochre, collides: true, style: "ruin" },
  { id: "court-monument", label: "Sun Dial Monument", x: 25, z: 26, w: 9, d: 14, h: 7, y: centerAt(mainY, 7), color: terracotta, collides: true, style: "tower" },
  { id: "court-planter", x: -27, z: -24, w: 15, d: 9, h: 3, y: centerAt(mainY, 3), color: paleStone, collides: true, style: "wall" },

  // Grand Bazaar: props are against the edges, leaving two clean team lanes.
  { id: "bazaar-north-shops-west", label: "Grand Bazaar", x: -132, z: 49, w: 72, d: 12, h: 10, y: centerAt(mainY, 10), color: terracotta, collides: true, style: "house" },
  { id: "bazaar-north-shops-east", x: -62, z: 49, w: 52, d: 12, h: 9, y: centerAt(mainY, 9), color: goldStone, collides: true, style: "house" },
  { id: "bazaar-south-shops-west", x: -143, z: 105, w: 52, d: 12, h: 9, y: centerAt(mainY, 9), color: warmStone, collides: true, style: "house" },
  { id: "bazaar-south-shops-east", x: -74, z: 105, w: 58, d: 12, h: 10, y: centerAt(mainY, 10), color: paleStone, collides: true, style: "house" },
  { id: "bazaar-balcony-west", x: -146, z: 64, w: 35, d: 5, h: 3, y: mainY + 8, color: timber, material: "wood", style: "bridge" },
  { id: "bazaar-balcony-east", x: -70, z: 91, w: 32, d: 5, h: 3, y: mainY + 8, color: timber, material: "wood", style: "bridge" },
  { id: "bazaar-stall-west", label: "Spice Stall", x: -157, z: 80, w: 15, d: 6, h: 3, y: centerAt(mainY, 3), color: timber, collides: true, material: "wood", style: "stall" },
  { id: "bazaar-stall-east", label: "Rug Stall", x: -45, z: 91, w: 15, d: 6, h: 3, y: centerAt(mainY, 3), color: timber, collides: true, material: "wood", style: "stall" },

  // Monumental fortress interior with large halls and three entrances.
  { id: "sun-hall-north-west", label: "Sun Hall", x: 80, z: 35, w: 38, d: 7, h: 15, y: centerAt(mainY, 15), color: darkStone, collides: true, style: "house" },
  { id: "sun-hall-north-east", x: 142, z: 35, w: 32, d: 7, h: 15, y: centerAt(mainY, 15), color: darkStone, collides: true, style: "house" },
  { id: "sun-hall-south-west", x: 82, z: 110, w: 34, d: 7, h: 14, y: centerAt(mainY, 14), color: warmStone, collides: true, style: "house" },
  { id: "sun-hall-south-east", x: 145, z: 110, w: 27, d: 7, h: 14, y: centerAt(mainY, 14), color: warmStone, collides: true, style: "house" },
  { id: "sun-hall-east-north", x: 164, z: 54, w: 7, d: 30, h: 14, y: centerAt(mainY, 14), color: ochre, collides: true, style: "wall" },
  { id: "sun-hall-east-south", x: 164, z: 96, w: 7, d: 18, h: 14, y: centerAt(mainY, 14), color: ochre, collides: true, style: "wall" },
  { id: "sun-hall-guard-room", x: 124, z: 76, w: 24, d: 20, h: 8, y: centerAt(mainY, 8), color: paleStone, collides: true, style: "house" },
  { id: "sun-hall-stair-buttress", x: 77, z: 82, w: 8, d: 20, h: 7, y: centerAt(mainY, 7), color: terracotta, collides: true, style: "wall" },

  // Palm Ruins: low, broad cover breaks every Heavy Blaster line.
  { id: "ruins-wall-west", label: "Palm Ruins", x: -155, z: -123, w: 48, d: 7, h: 6, color: ochre, rotationY: 0.16, collides: true, style: "ruin" },
  { id: "ruins-foundation-west", x: -92, z: -99, w: 34, d: 18, h: 3, color: warmStone, rotationY: -0.12, collides: true, style: "ruin" },
  { id: "ruins-arch-center-west", x: -34, z: -132, w: 20, d: 8, h: 7, color: paleStone, collides: true, style: "ruin" },
  { id: "ruins-wall-center", x: 26, z: -105, w: 44, d: 7, h: 5, color: ochre, rotationY: 0.2, collides: true, style: "ruin" },
  { id: "ruins-foundation-east", x: 92, z: -139, w: 32, d: 20, h: 3, color: warmStone, rotationY: 0.1, collides: true, style: "ruin" },
  { id: "ruins-wall-east", x: 154, z: -110, w: 44, d: 7, h: 6, color: darkStone, rotationY: -0.18, collides: true, style: "ruin" },
  { id: "ruins-broken-tower", label: "Broken Aqueduct Tower", x: 205, z: -122, w: 18, d: 18, h: 18, color: darkStone, collides: true, style: "tower" },

  // Lower canal and underground passage. Upper slabs form a readable ceiling.
  { id: "canal-water", label: "Broken Aqueduct", x: 0, z: 133, w: 410, d: 15, h: 0.22, y: 0.08, color: water, material: "water", style: "channel" },
  { id: "canal-north-bank-west", x: -155, z: 119, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-north-bank-center", x: 0, z: 119, w: 80, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-north-bank-east", x: 155, z: 119, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-south-bank-west", x: -155, z: 147, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-south-bank-center", x: 0, z: 147, w: 80, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-south-bank-east", x: 155, z: 147, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-bridge-west", x: -118, z: 133, w: 28, d: 35, h: 1, y: mainY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "canal-bridge-center", x: 0, z: 133, w: 30, d: 35, h: 1, y: mainY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "canal-bridge-east", x: 118, z: 133, w: 28, d: 35, h: 1, y: mainY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "tunnel-north-wall-west", x: -68, z: 48, w: 78, d: 5, h: 5.5, y: 2.75, color: darkStone, collides: true, style: "channel" },
  { id: "tunnel-north-wall-east", x: 68, z: 48, w: 78, d: 5, h: 5.5, y: 2.75, color: darkStone, collides: true, style: "channel" },
  { id: "tunnel-south-wall-west", x: -68, z: 72, w: 78, d: 5, h: 5.5, y: 2.75, color: darkStone, collides: true, style: "channel" },
  { id: "tunnel-south-wall-east", x: 68, z: 72, w: 78, d: 5, h: 5.5, y: 2.75, color: darkStone, collides: true, style: "channel" },
  { id: "tunnel-water-rill", x: 0, z: 60, w: 214, d: 7, h: 0.18, y: 0.09, color: turquoise, material: "water", style: "channel" },
  { id: "tunnel-sight-break-west", x: -45, z: 59, w: 8, d: 11, h: 4.5, y: 2.25, color: ochre, collides: true, style: "ruin" },
  { id: "tunnel-sight-break-east", x: 45, z: 61, w: 8, d: 11, h: 4.5, y: 2.25, color: ochre, collides: true, style: "ruin" },

  // Ramps and stairs: broad, legible, and distributed across every route family.
  { id: "blue-ruins-ramp", x: -174, z: -86, w: 28, d: 28, h: 1, y: mainY / 2, rotationX: Math.atan(mainY / 28), color: warmStone, material: "stone", style: "bridge" },
  { id: "red-ruins-ramp", x: 174, z: -86, w: 28, d: 28, h: 1, y: mainY / 2, rotationX: Math.atan(mainY / 28), color: warmStone, material: "stone", style: "bridge" },
  { id: "canal-stair-west", x: -174, z: 111, w: 28, d: 24, h: 1, y: mainY / 2, rotationX: -Math.atan(mainY / 24), color: paleStone, material: "stone", style: "bridge" },
  { id: "canal-stair-center", x: 0, z: 111, w: 28, d: 24, h: 1, y: mainY / 2, rotationX: -Math.atan(mainY / 24), color: paleStone, material: "stone", style: "bridge" },
  { id: "canal-stair-east", x: 174, z: 111, w: 28, d: 24, h: 1, y: mainY / 2, rotationX: -Math.atan(mainY / 24), color: paleStone, material: "stone", style: "bridge" },
  { id: "tunnel-ramp-west", x: -122, z: 60, w: 26, d: 16, h: 1, y: mainY / 2, rotationZ: -Math.atan(mainY / 26), color: darkStone, material: "stone", style: "bridge" },
  { id: "tunnel-ramp-east", x: 122, z: 60, w: 26, d: 16, h: 1, y: mainY / 2, rotationZ: Math.atan(mainY / 26), color: darkStone, material: "stone", style: "bridge" },
  { id: "bazaar-roof-ramp", x: -148, z: 92, w: 24, d: 14, h: 1, y: (mainY + roofY) / 2, rotationZ: Math.atan((roofY - mainY) / 24), color: timber, material: "wood", style: "bridge" },
  { id: "sun-hall-roof-ramp", x: 143, z: 88, w: 24, d: 14, h: 1, y: (mainY + roofY) / 2, rotationZ: -Math.atan((roofY - mainY) / 24), color: paleStone, material: "stone", style: "bridge" },
  { id: "court-battlement-ramp", x: 0, z: -40, w: 18, d: 24, h: 1, y: (mainY + roofY) / 2, rotationX: -Math.atan((roofY - mainY) / 24), color: paleStone, material: "stone", style: "bridge" },

  // Limited upper plane with rails and sightline screens.
  { id: "bazaar-roof-west", x: -116, z: 76, w: 82, d: 34, h: 1, y: roofY - 0.5, color: terracotta, material: "stone", style: "bridge" },
  { id: "bazaar-roof-east", x: -52, z: 76, w: 38, d: 26, h: 1, y: roofY - 0.5, color: goldStone, material: "stone", style: "bridge" },
  { id: "sun-hall-roof", x: 112, z: 70, w: 88, d: 44, h: 1, y: roofY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "court-battlement", x: 0, z: -52, w: 88, d: 14, h: 1, y: roofY - 0.5, color: darkStone, material: "stone", style: "bridge" },
  { id: "roof-link-west", x: -63, z: 70, w: 30, d: 7, h: 1, y: roofY - 0.5, color: timber, material: "wood", style: "bridge" },
  { id: "roof-link-east", x: 51, z: 56, w: 34, d: 7, h: 1, y: roofY - 0.5, color: timber, material: "wood", style: "bridge" },
  { id: "bazaar-roof-screen", x: -92, z: 76, w: 8, d: 18, h: 5, y: centerAt(roofY, 5), color: blue, collides: true, style: "wall" },
  { id: "sun-hall-roof-screen", x: 112, z: 70, w: 8, d: 20, h: 5, y: centerAt(roofY, 5), color: red, collides: true, style: "wall" },
  { id: "court-upper-parapet-west", x: -44, z: -52, w: 4, d: 14, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-upper-parapet-east", x: 44, z: -52, w: 4, d: 14, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },

  // Sun Tower is a distant orientation landmark, intentionally decorative above its base.
  { id: "sun-tower-base", label: "Sun Tower", x: 63, z: -35, w: 19, d: 19, h: 20, y: centerAt(mainY, 20), color: ochre, collides: true, style: "tower" },
  { id: "sun-tower-crown", x: 63, z: -35, w: 13, d: 13, h: 28, y: mainY + 34, color: paleStone, style: "tower" }
];

export const blocks: CitadelBlock[] = rawBlocks.map(scaleRect);

const rawProps: CitadelProp[] = [
  { id: "lion-gate-arch", kind: "arch", x: -174, z: 0, size: 24, h: 18, y: mainY, color: paleStone, rotationY: Math.PI / 2 },
  { id: "sun-gate-arch", kind: "arch", x: 174, z: 0, size: 24, h: 18, y: mainY, color: paleStone, rotationY: Math.PI / 2 },
  { id: "court-column-west", kind: "column", x: -24, z: 18, size: 4, h: 9, y: mainY, color: paleStone },
  { id: "court-column-east", kind: "column", x: 24, z: -18, size: 4, h: 9, y: mainY, color: paleStone },
  { id: "court-blue-shade", kind: "shade", x: -38, z: 47, size: 18, h: 6, y: mainY, color: blue, material: "cloth" },
  { id: "court-red-shade", kind: "shade", x: 38, z: 47, size: 18, h: 6, y: mainY, color: red, material: "cloth" },
  { id: "bazaar-blue-canopy", kind: "shade", x: -132, z: 77, size: 23, h: 6, y: mainY, color: blue, material: "cloth" },
  { id: "bazaar-ochre-canopy", kind: "shade", x: -80, z: 77, size: 23, h: 6, y: mainY, color: "#d37a4d", material: "cloth" },
  { id: "bazaar-red-canopy", kind: "shade", x: -35, z: 77, size: 18, h: 6, y: mainY, color: red, material: "cloth" },
  { id: "bazaar-cart", kind: "cart", x: -172, z: 95, size: 8, h: 3, y: mainY, color: timber, material: "wood", rotationY: 0.22 },
  { id: "ruins-arch-west", kind: "arch", x: -118, z: -112, size: 15, h: 10, color: paleStone, rotationY: 0.12 },
  { id: "ruins-arch-east", kind: "arch", x: 118, z: -124, size: 15, h: 10, color: warmStone, rotationY: Math.PI },
  { id: "ruins-palm-west", kind: "palm", x: -70, z: -139, size: 6, h: 17, color: palmGreen, material: "wood" },
  { id: "ruins-palm-center", kind: "palm", x: 54, z: -128, size: 6, h: 16, color: palmGreen, material: "wood" },
  { id: "ruins-palm-east", kind: "palm", x: 176, z: -146, size: 6, h: 18, color: palmGreen, material: "wood" },
  { id: "canal-palm-west", kind: "palm", x: -210, z: 154, size: 5, h: 15, color: palmGreen, material: "wood" },
  { id: "canal-palm-east", kind: "palm", x: 210, z: 154, size: 5, h: 15, color: palmGreen, material: "wood" },
  { id: "canal-arch-west", kind: "arch", x: -118, z: 133, size: 17, h: 11, color: darkStone, rotationY: Math.PI / 2 },
  { id: "canal-arch-center", kind: "arch", x: 0, z: 133, size: 18, h: 12, color: paleStone, rotationY: Math.PI / 2 },
  { id: "canal-arch-east", kind: "arch", x: 118, z: 133, size: 17, h: 11, color: darkStone, rotationY: Math.PI / 2 },
  { id: "tunnel-lamp-west", kind: "lamp", x: -70, z: 60, size: 1.8, h: 4, color: "#ffd38a", material: "accent" },
  { id: "tunnel-lamp-center", kind: "lamp", x: 0, z: 60, size: 1.8, h: 4, color: "#8de4e3", material: "accent" },
  { id: "tunnel-lamp-east", kind: "lamp", x: 70, z: 60, size: 1.8, h: 4, color: "#ffd38a", material: "accent" },
  { id: "blue-base-banner", kind: "banner", x: -235, z: -54, size: 4, h: 11, y: mainY, color: blue, material: "cloth" },
  { id: "red-base-banner", kind: "banner", x: 235, z: 54, size: 4, h: 11, y: mainY, color: red, material: "cloth" },
  { id: "bazaar-roof-garden", kind: "tree", x: -114, z: 77, size: 4, h: 7, y: roofY, color: palmGreen, material: "wood" },
  { id: "bazaar-roof-shade", kind: "shade", x: -72, z: 76, size: 15, h: 5, y: roofY, color: blue, material: "cloth" },
  { id: "sun-hall-roof-shade", kind: "shade", x: 89, z: 69, size: 15, h: 5, y: roofY, color: "#d17a4b", material: "cloth" },
  { id: "sun-tower-banner", kind: "banner", x: 63, z: -35, size: 5, h: 15, y: mainY + 18, color: "#e4b64f", material: "cloth" }
];
export const props: CitadelProp[] = rawProps.map((item) => ({
  ...item,
  x: scaleArenaValue(item.x),
  z: scaleArenaValue(item.z),
  size: scaleArenaValue(item.size)
}));

const rawCylinders: CitadelCylinder[] = [
  { id: "blue-fountain-rim", label: "Blue Fountain", x: 0, z: 0, radius: 12, h: 2.4, y: mainY + 1.2, color: paleStone, collides: true },
  { id: "blue-fountain-water", x: 0, z: 0, radius: 8, h: 0.25, y: mainY + 1.32, color: turquoise, material: "water" },
  { id: "court-planter-palm", x: -27, z: -24, radius: 2.5, h: 5, y: mainY + 2.5, color: palmGreen },
  { id: "sun-hall-column-west", x: 96, z: 58, radius: 3, h: 13, y: mainY + 6.5, color: paleStone, collides: true },
  { id: "sun-hall-column-east", x: 142, z: 91, radius: 3, h: 13, y: mainY + 6.5, color: paleStone, collides: true },
  { id: "sun-tower-dome", x: 63, z: -35, radius: 12, h: 7, y: mainY + 50, color: goldStone },
  { id: "canal-pool-west", x: -205, z: 133, radius: 13, h: 0.2, y: 0.12, color: water, material: "water" },
  { id: "canal-pool-east", x: 205, z: 133, radius: 13, h: 0.2, y: 0.12, color: water, material: "water" }
];
export const cylinders: CitadelCylinder[] = rawCylinders.map(scaleCylinder);

const rawSigns: CitadelSign[] = [
  { id: "sign-blue", label: "BLUE BASE ←", x: -188, z: 28, color: "#7dd3fc", rotationY: Math.PI / 2, y: mainY + 7 },
  { id: "sign-red", label: "→ RED BASE", x: 188, z: -28, color: "#fda4af", rotationY: -Math.PI / 2, y: mainY + 7 },
  { id: "sign-court", label: "Blue Fountain •", x: 0, z: -38, color: "#67e8f9", y: mainY + 7 },
  { id: "sign-bazaar", label: "Grand Bazaar •", x: -106, z: 39, color: "#fdba74", y: mainY + 7 },
  { id: "sign-ruins", label: "Palm Ruins ↓", x: -24, z: -78, color: "#bef264", y: mainY + 7 },
  { id: "sign-canal", label: "Broken Aqueduct ↓", x: 25, z: 112, color: "#67e8f9", y: mainY + 7 },
  { id: "sign-tunnel", label: "Founders' Passage ↓", x: -108, z: 60, color: "#a5f3fc", y: mainY + 5, rotationY: Math.PI / 2 },
  { id: "sign-fortress", label: "Sun Hall •", x: 78, z: 20, color: "#fde68a", y: mainY + 8 },
  { id: "sign-roofs", label: "Bazaar Roofs ↑", x: -151, z: 105, color: "#fde68a", y: mainY + 7 },
  { id: "sign-sun-roof", label: "Sun Hall Roof ↑", x: 145, z: 105, color: "#fde68a", y: mainY + 7 }
];
export const signs: CitadelSign[] = rawSigns.map(scalePoint);
