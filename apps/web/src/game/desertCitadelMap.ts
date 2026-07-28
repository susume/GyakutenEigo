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
    "Rooftop District • limited upper route",
    "Sun Gate • Red assembly court"
  ],
  routes: [
    "North Lane • Palm Ruins and long-range cover",
    "Center Lane • gates, fountain court, and Sun Hall",
    "South Lane • Grand Bazaar and Broken Aqueduct",
    "Vertical connectors • four terrace stairs and two limited lookouts"
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
const groundY = 0;

const makeStairFlight = ({
  id,
  x,
  z,
  width,
  length,
  axis,
  direction,
  startY,
  endY,
  color,
  steps = 10
}: {
  id: string;
  x: number;
  z: number;
  width: number;
  length: number;
  axis: "x" | "z";
  direction: 1 | -1;
  startY: number;
  endY: number;
  color: string;
  steps?: number;
}): CitadelBlock[] =>
  Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    const travel = (-0.5 + (index + 0.5) / steps) * length * direction;
    const topY = startY + (endY - startY) * progress;
    const height = Math.max(0.65, topY - startY);
    return {
      id: `${id}-step-${index + 1}`,
      x: x + (axis === "x" ? travel : 0),
      z: z + (axis === "z" ? travel : 0),
      w: axis === "x" ? length / steps + 0.8 : width,
      d: axis === "z" ? length / steps + 0.8 : width,
      h: height,
      y: startY + height / 2,
      color,
      material: "stone",
      style: "bridge"
    };
  });

// The citadel teaches routes through architecture and color, not printed directions.
export const floorMarks: CitadelFloorMark[] = [];

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

  // Streets and team courts sit on the terrain; only the enclosed citadel is raised.
  { id: "main-street-paving", x: 0, z: 0, w: 444, d: 64, h: 0.3, y: -0.15, color: warmStone, material: "stone", style: "bridge" },
  { id: "blue-base-paving", x: -220, z: 0, w: 52, d: 150, h: 0.3, y: -0.15, color: paleStone, material: "stone", style: "bridge" },
  { id: "red-base-paving", x: 220, z: 0, w: 52, d: 150, h: 0.3, y: -0.15, color: goldStone, material: "stone", style: "bridge" },
  { id: "courtyard-floor", x: 0, z: 28, w: 132, d: 118, h: 1, y: mainY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "bazaar-paving", x: -92, z: 78, w: 196, d: 72, h: 0.3, y: -0.15, color: warmStone, material: "stone", style: "bridge" },
  { id: "fortress-floor", x: 108, z: 70, w: 118, d: 88, h: 1, y: mainY - 0.5, color: goldStone, material: "stone", style: "bridge" },

  // Solid foundations remove every accidental under-map route.
  { id: "court-foundation", x: 0, z: 28, w: 132, d: 118, h: 9.35, y: 4.675, color: darkStone, collides: true, style: "wall" },
  { id: "hall-foundation", x: 108, z: 70, w: 118, d: 88, h: 9.35, y: 4.675, color: darkStone, collides: true, style: "wall" },

  // Team bases: 20-player courts, four broad exits, screened objectives.
  { id: "blue-base-back", x: -240, z: 0, w: 5, d: 126, h: 13, y: centerAt(groundY, 13), color: darkStone, collides: true, style: "wall" },
  { id: "blue-base-north", x: -233, z: -74, w: 26, d: 5, h: 10, y: centerAt(groundY, 10), color: warmStone, collides: true, style: "wall" },
  { id: "blue-base-south", x: -233, z: 74, w: 26, d: 5, h: 10, y: centerAt(groundY, 10), color: warmStone, collides: true, style: "wall" },
  { id: "blue-objective-pavilion", label: "Blue Objective Pavilion", x: -226, z: 0, w: 20, d: 28, h: 8, y: centerAt(groundY, 8), color: paleStone, collides: true, style: "house" },
  { id: "blue-base-cover", x: -185, z: -56, w: 22, d: 5, h: 7, y: centerAt(groundY, 7), color: blue, collides: true, style: "wall" },
  { id: "red-base-back", x: 240, z: 0, w: 5, d: 126, h: 13, y: centerAt(groundY, 13), color: darkStone, collides: true, style: "wall" },
  { id: "red-base-north", x: 233, z: -74, w: 26, d: 5, h: 10, y: centerAt(groundY, 10), color: goldStone, collides: true, style: "wall" },
  { id: "red-base-south", x: 233, z: 74, w: 26, d: 5, h: 10, y: centerAt(groundY, 10), color: goldStone, collides: true, style: "wall" },
  { id: "red-objective-pavilion", label: "Red Objective Pavilion", x: 226, z: 0, w: 20, d: 28, h: 8, y: centerAt(groundY, 8), color: paleStone, collides: true, style: "house" },
  { id: "red-base-cover", x: 185, z: 56, w: 22, d: 5, h: 7, y: centerAt(groundY, 7), color: red, collides: true, style: "wall" },

  // Lion Gate and Sun Gate are landmarks, not choke-point boxes.
  { id: "lion-gate-north-pier", label: "Lion Gate", x: -174, z: -26, w: 10, d: 12, h: 17, y: centerAt(groundY, 17), color: ochre, collides: true, style: "tower" },
  { id: "lion-gate-south-pier", x: -174, z: 26, w: 10, d: 12, h: 17, y: centerAt(groundY, 17), color: ochre, collides: true, style: "tower" },
  { id: "lion-gate-lintel", x: -174, z: 0, w: 10, d: 40, h: 4, y: 16, color: paleStone, collides: true, style: "gate" },
  { id: "sun-gate-north-pier", label: "Sun Gate", x: 174, z: -26, w: 10, d: 12, h: 17, y: centerAt(groundY, 17), color: ochre, collides: true, style: "tower" },
  { id: "sun-gate-south-pier", x: 174, z: 26, w: 10, d: 12, h: 17, y: centerAt(groundY, 17), color: ochre, collides: true, style: "tower" },
  { id: "sun-gate-lintel", x: 174, z: 0, w: 10, d: 40, h: 4, y: 16, color: paleStone, collides: true, style: "gate" },

  // Low parapets define safe edges; every gap corresponds to a real stair.
  { id: "court-parapet-north-west", x: -40.5, z: -29.5, w: 51, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-parapet-north-east", x: 40.5, z: -29.5, w: 51, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-parapet-west-north", x: -64.5, z: -23, w: 3, d: 16, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-parapet-west-south", x: -64.5, z: 51, w: 3, d: 72, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-parapet-south-west", x: -40.5, z: 85.5, w: 51, d: 3, h: 3, y: centerAt(mainY, 3), color: warmStone, collides: true, style: "wall" },
  { id: "court-parapet-south-east", x: 32, z: 85.5, w: 34, d: 3, h: 3, y: centerAt(mainY, 3), color: warmStone, collides: true, style: "wall" },
  { id: "court-broken-wall-west", x: -55, z: 18, w: 6, d: 23, h: 5, y: centerAt(mainY, 5), color: ochre, collides: true, style: "ruin" },
  { id: "court-broken-wall-east", x: 55, z: -18, w: 6, d: 23, h: 5, y: centerAt(mainY, 5), color: ochre, collides: true, style: "ruin" },
  { id: "court-monument", label: "Sun Dial Monument", x: 25, z: 26, w: 9, d: 14, h: 7, y: centerAt(mainY, 7), color: terracotta, collides: true, style: "tower" },
  { id: "court-planter", x: -27, z: -24, w: 15, d: 9, h: 3, y: centerAt(mainY, 3), color: paleStone, collides: true, style: "wall" },

  // Grand Bazaar: one market street, edge cover, and one unmistakable lookout tower.
  { id: "bazaar-north-shops-west", label: "Grand Bazaar", x: -145, z: 49, w: 50, d: 12, h: 10, y: centerAt(groundY, 10), color: terracotta, collides: true, style: "house" },
  { id: "bazaar-north-shops-east", x: -114, z: 49, w: 40, d: 12, h: 9, y: centerAt(groundY, 9), color: goldStone, collides: true, style: "house" },
  { id: "bazaar-south-shops-west", x: -145, z: 105, w: 50, d: 12, h: 9, y: centerAt(groundY, 9), color: warmStone, collides: true, style: "house" },
  { id: "bazaar-south-shops-east", x: -114, z: 105, w: 40, d: 12, h: 10, y: centerAt(groundY, 10), color: paleStone, collides: true, style: "house" },
  { id: "bazaar-balcony-west", x: -145, z: 61, w: 34, d: 5, h: 3, y: 8, color: timber, material: "wood", style: "bridge" },
  { id: "bazaar-balcony-east", x: -108, z: 93, w: 32, d: 5, h: 3, y: 8, color: timber, material: "wood", style: "bridge" },
  { id: "bazaar-stall-west", label: "Spice Stall", x: -150, z: 80, w: 15, d: 6, h: 3, y: centerAt(groundY, 3), color: timber, collides: true, material: "wood", style: "stall" },
  { id: "bazaar-stall-east", label: "Rug Stall", x: -62, z: 96, w: 15, d: 6, h: 3, y: centerAt(groundY, 3), color: timber, collides: true, material: "wood", style: "stall" },
  { id: "bazaar-lookout-mass", x: -116, z: 76, w: 60, d: 32, h: 23.4, y: 11.7, color: terracotta, collides: true, style: "tower" },

  // Monumental fortress interior with large halls and three entrances.
  { id: "sun-hall-north-west", label: "Sun Hall", x: 85, z: 28, w: 38, d: 5, h: 15, y: centerAt(mainY, 15), color: darkStone, collides: true, style: "house" },
  { id: "sun-hall-north-east", x: 143.5, z: 28, w: 47, d: 5, h: 15, y: centerAt(mainY, 15), color: darkStone, collides: true, style: "house" },
  { id: "sun-hall-south-west", x: 82, z: 110, w: 34, d: 7, h: 14, y: centerAt(mainY, 14), color: warmStone, collides: true, style: "house" },
  { id: "sun-hall-south-east", x: 145, z: 110, w: 27, d: 7, h: 14, y: centerAt(mainY, 14), color: warmStone, collides: true, style: "house" },
  { id: "sun-hall-east-north", x: 164, z: 40, w: 7, d: 28, h: 14, y: centerAt(mainY, 14), color: ochre, collides: true, style: "wall" },
  { id: "sun-hall-east-south", x: 164, z: 100, w: 7, d: 28, h: 14, y: centerAt(mainY, 14), color: ochre, collides: true, style: "wall" },
  { id: "sun-hall-guard-room", x: 124, z: 76, w: 24, d: 20, h: 8, y: centerAt(mainY, 8), color: paleStone, collides: true, style: "house" },

  // Palm Ruins: low, broad cover breaks every Heavy Blaster line.
  { id: "ruins-wall-west", label: "Palm Ruins", x: -155, z: -123, w: 48, d: 7, h: 6, color: ochre, collides: true, style: "ruin" },
  { id: "ruins-foundation-west", x: -92, z: -99, w: 34, d: 18, h: 3, color: warmStone, collides: true, style: "ruin" },
  { id: "ruins-arch-center-west", x: -34, z: -132, w: 20, d: 8, h: 7, color: paleStone, collides: true, style: "ruin" },
  { id: "ruins-wall-center", x: 26, z: -105, w: 44, d: 7, h: 5, color: ochre, collides: true, style: "ruin" },
  { id: "ruins-foundation-east", x: 92, z: -139, w: 32, d: 20, h: 3, color: warmStone, collides: true, style: "ruin" },
  { id: "ruins-wall-east", x: 154, z: -110, w: 44, d: 7, h: 6, color: darkStone, collides: true, style: "ruin" },
  { id: "ruins-broken-tower", label: "Broken Aqueduct Tower", x: 205, z: -122, w: 18, d: 18, h: 18, color: darkStone, collides: true, style: "tower" },

  // Ground-level canal and passage: distinct route language without an accidental second map.
  { id: "canal-water", label: "Broken Aqueduct", x: 0, z: 133, w: 410, d: 15, h: 0.22, y: 0.08, color: water, material: "water", style: "channel" },
  { id: "canal-north-bank-west", x: -155, z: 119, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-north-bank-center", x: 0, z: 119, w: 80, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-north-bank-east", x: 155, z: 119, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-south-bank-west", x: -155, z: 147, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-south-bank-center", x: 0, z: 147, w: 80, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-south-bank-east", x: 155, z: 147, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "channel" },
  { id: "canal-bridge-west", x: -118, z: 133, w: 28, d: 35, h: 0.8, y: 0.45, color: paleStone, material: "stone", style: "bridge" },
  { id: "canal-bridge-center", x: 0, z: 133, w: 30, d: 35, h: 0.8, y: 0.45, color: paleStone, material: "stone", style: "bridge" },
  { id: "canal-bridge-east", x: 118, z: 133, w: 28, d: 35, h: 0.8, y: 0.45, color: paleStone, material: "stone", style: "bridge" },
  // Four monumental terrace stairs and two limited roof stairs. Repeated risers make direction obvious.
  ...makeStairFlight({ id: "citadel-west", x: -86, z: 0, width: 30, length: 40, axis: "x", direction: 1, startY: 0, endY: mainY, color: paleStone }),
  ...makeStairFlight({ id: "citadel-north", x: 0, z: -45, width: 30, length: 28, axis: "z", direction: 1, startY: 0, endY: mainY, color: paleStone }),
  ...makeStairFlight({ id: "citadel-south", x: 0, z: 101, width: 30, length: 28, axis: "z", direction: -1, startY: 0, endY: mainY, color: paleStone }),
  ...makeStairFlight({ id: "citadel-east", x: 185, z: 70, width: 30, length: 36, axis: "x", direction: -1, startY: 0, endY: mainY, color: paleStone }),
  ...makeStairFlight({ id: "bazaar-lookout", x: -181, z: 76, width: 24, length: 70, axis: "x", direction: 1, startY: 0, endY: roofY, color: goldStone, steps: 14 }),
  ...makeStairFlight({ id: "sun-hall-roof", x: 84, z: 81, width: 22, length: 44, axis: "x", direction: 1, startY: mainY, endY: roofY, color: paleStone, steps: 10 }),

  // High-contrast guide walls keep students on the mathematical ramp footprint.
  { id: "citadel-west-guide-north", x: -86, z: -16.5, w: 40, d: 3, h: 13, y: 6.5, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "citadel-west-guide-south", x: -86, z: 16.5, w: 40, d: 3, h: 13, y: 6.5, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "citadel-north-guide-west", x: -16.5, z: -45, w: 3, d: 28, h: 13, y: 6.5, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "citadel-north-guide-east", x: 16.5, z: -45, w: 3, d: 28, h: 13, y: 6.5, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "citadel-south-guide-west", x: -16.5, z: 101, w: 3, d: 28, h: 13, y: 6.5, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "citadel-south-guide-east", x: 16.5, z: 101, w: 3, d: 28, h: 13, y: 6.5, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "citadel-east-guide-north", x: 185, z: 53.5, w: 36, d: 3, h: 13, y: 6.5, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "citadel-east-guide-south", x: 185, z: 86.5, w: 36, d: 3, h: 13, y: 6.5, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "bazaar-lookout-guide-north", x: -181, z: 62.5, w: 70, d: 3, h: 26, y: 13, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "bazaar-lookout-guide-south", x: -181, z: 89.5, w: 70, d: 3, h: 26, y: 13, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "sun-hall-roof-guide-north", x: 84, z: 68.5, w: 44, d: 3, h: 16, y: 18, color: turquoise, material: "accent", collides: true, style: "wall" },
  { id: "sun-hall-roof-guide-south", x: 84, z: 93.5, w: 44, d: 3, h: 16, y: 18, color: turquoise, material: "accent", collides: true, style: "wall" },

  // Limited upper plane with rails and sightline screens.
  { id: "bazaar-roof-west", x: -116, z: 76, w: 60, d: 32, h: 1, y: roofY - 0.5, color: terracotta, material: "stone", style: "bridge" },
  { id: "sun-hall-roof", x: 112, z: 70, w: 88, d: 44, h: 1, y: roofY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "bazaar-roof-screen", x: -92, z: 76, w: 8, d: 18, h: 5, y: centerAt(roofY, 5), color: blue, collides: true, style: "wall" },
  { id: "sun-hall-roof-screen", x: 132, z: 68, w: 8, d: 16, h: 5, y: centerAt(roofY, 5), color: red, collides: true, style: "wall" },
  { id: "bazaar-roof-rail-north", x: -116, z: 61.5, w: 60, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "bazaar-roof-rail-south", x: -116, z: 90.5, w: 60, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "bazaar-roof-rail-east", x: -87.5, z: 76, w: 3, d: 32, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "sun-roof-rail-north", x: 112, z: 49.5, w: 88, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "sun-roof-rail-south", x: 132, z: 90.5, w: 48, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "sun-roof-rail-east", x: 154.5, z: 70, w: 3, d: 44, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "sun-roof-rail-west-north", x: 69.5, z: 59, w: 3, d: 22, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },

  // Sun Tower is a distant orientation landmark, intentionally decorative above its base.
  { id: "sun-tower-base", label: "Sun Tower", x: 63, z: -35, w: 19, d: 19, h: 20, y: centerAt(mainY, 20), color: ochre, collides: true, style: "tower" },
  { id: "sun-tower-crown", x: 63, z: -35, w: 13, d: 13, h: 28, y: mainY + 34, color: paleStone, style: "tower" }
];

export const blocks: CitadelBlock[] = rawBlocks.map(scaleRect);

const rawProps: CitadelProp[] = [
  // Route arches and banners are navigation beacons, always placed at a real entrance.
  { id: "lion-gate-arch", kind: "arch", x: -174, z: 0, size: 36, h: 18, y: 0, color: paleStone, rotationY: Math.PI / 2 },
  { id: "sun-gate-arch", kind: "arch", x: 174, z: 0, size: 36, h: 18, y: 0, color: paleStone, rotationY: Math.PI / 2 },
  { id: "citadel-west-lower-arch", kind: "arch", x: -105, z: 0, size: 27, h: 15, y: 0, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "citadel-west-upper-arch", kind: "arch", x: -66, z: 0, size: 27, h: 15, y: mainY, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "citadel-north-lower-arch", kind: "arch", x: 0, z: -59, size: 27, h: 15, y: 0, color: turquoise, material: "accent" },
  { id: "citadel-north-upper-arch", kind: "arch", x: 0, z: -31, size: 27, h: 15, y: mainY, color: turquoise, material: "accent" },
  { id: "citadel-south-lower-arch", kind: "arch", x: 0, z: 115, size: 27, h: 15, y: 0, color: turquoise, material: "accent" },
  { id: "citadel-south-upper-arch", kind: "arch", x: 0, z: 87, size: 27, h: 15, y: mainY, color: turquoise, material: "accent" },
  { id: "citadel-east-lower-arch", kind: "arch", x: 203, z: 70, size: 27, h: 15, y: 0, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "citadel-east-upper-arch", kind: "arch", x: 167, z: 70, size: 27, h: 15, y: mainY, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "bazaar-lookout-lower-arch", kind: "arch", x: -216, z: 76, size: 22, h: 14, y: 0, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "bazaar-lookout-upper-arch", kind: "arch", x: -146, z: 76, size: 22, h: 14, y: roofY, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "sun-hall-roof-lower-arch", kind: "arch", x: 62, z: 81, size: 20, h: 13, y: mainY, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "sun-hall-roof-upper-arch", kind: "arch", x: 106, z: 81, size: 20, h: 13, y: roofY, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "court-column-west", kind: "column", x: -24, z: 18, size: 4, h: 9, y: mainY, color: paleStone },
  { id: "court-column-east", kind: "column", x: 24, z: -18, size: 4, h: 9, y: mainY, color: paleStone },
  { id: "bazaar-blue-canopy", kind: "shade", x: -150, z: 80, size: 18, h: 6, y: 0, color: blue, material: "cloth" },
  { id: "bazaar-red-canopy", kind: "shade", x: -62, z: 96, size: 18, h: 6, y: 0, color: red, material: "cloth" },
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
  { id: "blue-base-banner", kind: "banner", x: -235, z: -54, size: 4, h: 11, y: 0, color: blue, material: "cloth" },
  { id: "red-base-banner", kind: "banner", x: 235, z: 54, size: 4, h: 11, y: 0, color: red, material: "cloth" },
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

export const signs: CitadelSign[] = [];
