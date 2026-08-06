import {
  ARENA_SCALE,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  DESERT_CITADEL_STAIR_FLIGHTS
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
  description: "A fortified desert trade city split by a fountain citadel, a palm-lined north road, and a dry caravan yard below the market roofs.",
  footprint: { width: scaleArenaValue(500), depth: scaleArenaValue(360) },
  districts: [
    "West Assembly Court — Blue spawn and Lion Gate",
    "East Assembly Court — Red spawn and Sun Gate",
    "Palm Ruins — north long-range lane",
    "Fountain Court — raised main battle space",
    "West Market — bazaar-side combat district",
    "East Market — caravan-side combat district",
    "South Caravan Yard — lower rotation lane",
    "Citadel Skywalk — shared upper counter-route"
  ],
  routes: [
    "North Lane — palm ruins and obelisk cover",
    "Center Lane — gates, fountain court, and terrace stairs",
    "South Lane — markets, caravan yard, and low cover",
    "Rotations — west/east main stairs plus the open south yard",
    "Upper Route — mirrored market stairs and the Citadel Skywalk"
  ],
  palette: {
    sky: "#8fc9df",
    fog: "#d8bd86",
    floor: "#d7ad68",
    floorTexture: "sand",
    accent: "#2ca6af"
  }
};

const warmStone = "#c89a5d";
const paleStone = "#dec187";
const goldStone = "#d2a45f";
const ochre = "#ad7546";
const darkStone = "#765238";
const terracotta = "#a95f43";
const blue = "#287daf";
const red = "#ae4545";
const turquoise = "#2ca6af";
const palmGreen = "#5e7f54";
const mainY = DESERT_CITADEL_MAIN_LEVEL_Y;
const roofY = DESERT_CITADEL_ROOFTOP_LEVEL_Y;
const centerAt = (floorY: number, height: number) => floorY + height / 2;

const makeStairFlight = (flight: (typeof DESERT_CITADEL_STAIR_FLIGHTS)[number], color: string): CitadelBlock[] =>
  Array.from({ length: flight.steps }, (_, index) => {
    const progress = (index + 1) / flight.steps;
    const travel = (-0.5 + (index + 0.5) / flight.steps) * flight.length * flight.direction;
    const topY = flight.startY + (flight.endY - flight.startY) * progress;
    const height = Math.max(0.65, topY - flight.startY);
    return {
      id: `${flight.id}-step-${index + 1}`,
      x: flight.x + (flight.axis === "x" ? travel : 0),
      z: flight.z + (flight.axis === "z" ? travel : 0),
      w: flight.axis === "x" ? flight.length / flight.steps + 0.8 : flight.width,
      d: flight.axis === "z" ? flight.length / flight.steps + 0.8 : flight.width,
      h: height,
      y: flight.startY + height / 2,
      color,
      material: "stone",
      style: "stair"
    };
  });

// Navigation is taught by repeated architecture, color, and silhouette rather than floating labels.
export const floorMarks: CitadelFloorMark[] = [];

const rawBlocks: CitadelBlock[] = [
  // Perimeter walls keep the skyline memorable and make all escapes deterministic.
  { id: "north-cliff-west", x: -150, z: -178, w: 200, d: 8, h: 11, color: darkStone, collides: true, style: "ruin" },
  { id: "north-cliff-east", x: 150, z: -178, w: 200, d: 8, h: 13, color: darkStone, collides: true, style: "ruin" },
  { id: "south-wall-west", x: -150, z: 178, w: 200, d: 8, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "south-wall-east", x: 150, z: 178, w: 200, d: 8, h: 12, color: darkStone, collides: true, style: "wall" },
  { id: "west-city-wall-north", x: -248, z: -112, w: 8, d: 132, h: 15, color: darkStone, collides: true, style: "wall" },
  { id: "west-city-wall-south", x: -248, z: 112, w: 8, d: 132, h: 15, color: darkStone, collides: true, style: "wall" },
  { id: "east-city-wall-north", x: 248, z: -112, w: 8, d: 132, h: 15, color: darkStone, collides: true, style: "wall" },
  { id: "east-city-wall-south", x: 248, z: 112, w: 8, d: 132, h: 15, color: darkStone, collides: true, style: "wall" },

  // Lower plane paving and the raised Fountain Court.
  { id: "north-lane-paving", x: 0, z: -108, w: 444, d: 58, h: 0.3, y: -0.15, color: warmStone, material: "stone", style: "bridge" },
  { id: "south-lane-paving", x: 0, z: 126, w: 444, d: 56, h: 0.3, y: -0.15, color: goldStone, material: "stone", style: "bridge" },
  { id: "court-floor", x: 0, z: 24, w: 132, d: 120, h: 1, y: mainY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "court-foundation", x: 0, z: 24, w: 132, d: 120, h: 9.35, y: 4.675, color: darkStone, collides: true, style: "wall" },

  // Four wide main-level connectors. Each landing is framed by a real arch.
  ...DESERT_CITADEL_STAIR_FLIGHTS.slice(0, 4).flatMap((flight) => makeStairFlight(flight, paleStone)),

  // Spawn courts are broad enough for twenty players and screened by architecture.
  { id: "blue-base-back", x: -240, z: 0, w: 5, d: 126, h: 13, color: darkStone, collides: true, style: "wall" },
  { id: "blue-base-north", x: -233, z: -74, w: 26, d: 5, h: 10, color: warmStone, collides: true, style: "wall" },
  { id: "blue-base-south", x: -233, z: 74, w: 26, d: 5, h: 10, color: warmStone, collides: true, style: "wall" },
  { id: "blue-objective-pavilion", label: "Blue Objective Pavilion", x: -226, z: 0, w: 20, d: 28, h: 8, color: paleStone, collides: true, style: "house" },
  { id: "blue-base-screen-north", x: -194, z: -50, w: 6, d: 30, h: 9, color: paleStone, collides: true, style: "ruin" },
  { id: "blue-base-screen-south", x: -194, z: 50, w: 6, d: 30, h: 9, color: paleStone, collides: true, style: "ruin" },
  { id: "red-base-back", x: 240, z: 0, w: 5, d: 126, h: 13, color: darkStone, collides: true, style: "wall" },
  { id: "red-base-north", x: 233, z: -74, w: 26, d: 5, h: 10, color: goldStone, collides: true, style: "wall" },
  { id: "red-base-south", x: 233, z: 74, w: 26, d: 5, h: 10, color: goldStone, collides: true, style: "wall" },
  { id: "red-objective-pavilion", label: "Red Objective Pavilion", x: 226, z: 0, w: 20, d: 28, h: 8, color: paleStone, collides: true, style: "house" },
  { id: "red-base-screen-north", x: 194, z: -50, w: 6, d: 30, h: 9, color: paleStone, collides: true, style: "ruin" },
  { id: "red-base-screen-south", x: 194, z: 50, w: 6, d: 30, h: 9, color: paleStone, collides: true, style: "ruin" },

  // Lion Gate and Sun Gate mark the center-lane transition without sealing it.
  { id: "lion-gate-north-pier", label: "Lion Gate", x: -86, z: -26, w: 10, d: 12, h: 17, color: ochre, collides: true, style: "tower" },
  { id: "lion-gate-south-pier", x: -86, z: 26, w: 10, d: 12, h: 17, color: ochre, collides: true, style: "tower" },
  { id: "lion-gate-lintel", x: -86, z: 0, w: 10, d: 40, h: 4, y: 16, color: paleStone, collides: true, style: "gate" },
  { id: "sun-gate-north-pier", label: "Sun Gate", x: 86, z: -26, w: 10, d: 12, h: 17, color: ochre, collides: true, style: "tower" },
  { id: "sun-gate-south-pier", x: 86, z: 26, w: 10, d: 12, h: 17, color: ochre, collides: true, style: "tower" },
  { id: "sun-gate-lintel", x: 86, z: 0, w: 10, d: 40, h: 4, y: 16, color: paleStone, collides: true, style: "gate" },

  // Main-level Fountain Court cover hierarchy: low walls, a monument, and one central readable landmark.
  { id: "court-parapet-north-west", x: -44, z: -36.5, w: 44, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-parapet-north-east", x: 44, z: -36.5, w: 44, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-parapet-south-west", x: -44, z: 86.5, w: 44, d: 3, h: 3, y: centerAt(mainY, 3), color: warmStone, collides: true, style: "wall" },
  { id: "court-parapet-south-east", x: 44, z: 86.5, w: 44, d: 3, h: 3, y: centerAt(mainY, 3), color: warmStone, collides: true, style: "wall" },
  { id: "court-parapet-west-north", x: -64.5, z: -26, w: 3, d: 12, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-parapet-west-south", x: -64.5, z: 48, w: 3, d: 48, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-parapet-east-north", x: 64.5, z: -26, w: 3, d: 12, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-parapet-east-south", x: 64.5, z: 48, w: 3, d: 48, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "court-broken-wall-west", x: -34, z: 20, w: 6, d: 24, h: 5, y: centerAt(mainY, 5), color: ochre, collides: true, style: "ruin" },
  { id: "court-broken-wall-east", x: 34, z: 20, w: 6, d: 24, h: 5, y: centerAt(mainY, 5), color: ochre, collides: true, style: "ruin" },
  { id: "court-monument", label: "Sun Dial Monument", x: 0, z: 28, w: 10, d: 12, h: 7, y: centerAt(mainY, 7), color: terracotta, collides: true, style: "tower" },
  { id: "court-planter", x: 0, z: -12, w: 14, d: 8, h: 3, y: centerAt(mainY, 3), color: paleStone, collides: true, style: "wall" },

  // Mirrored markets frame an open stair court, so the upper route has a
  // believable architectural entrance instead of a stair clipping through a
  // solid building proxy.
  { id: "west-market-mass-north", label: "West Market", x: -120, z: 64, w: 58, d: 6, h: 23.4, y: 11.7, color: terracotta, collides: true, style: "house" },
  { id: "west-market-mass-south", x: -120, z: 92, w: 58, d: 6, h: 23.4, y: 11.7, color: terracotta, collides: true, style: "house" },
  { id: "east-market-mass-north", label: "East Market", x: 120, z: 64, w: 58, d: 6, h: 23.4, y: 11.7, color: goldStone, collides: true, style: "house" },
  { id: "east-market-mass-south", x: 120, z: 92, w: 58, d: 6, h: 23.4, y: 11.7, color: goldStone, collides: true, style: "house" },
  { id: "west-market-roof", x: -120, z: 78, w: 58, d: 34, h: 1, y: roofY - 0.5, color: terracotta, material: "stone", style: "bridge" },
  { id: "east-market-roof", x: 120, z: 78, w: 58, d: 34, h: 1, y: roofY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "west-market-roof-screen", x: -108, z: 78, w: 8, d: 8, h: 5, y: centerAt(roofY, 5), color: blue, collides: true, style: "wall" },
  { id: "east-market-roof-screen", x: 108, z: 78, w: 8, d: 8, h: 5, y: centerAt(roofY, 5), color: red, collides: true, style: "wall" },
  { id: "west-market-roof-rail-north", x: -120, z: 61.5, w: 58, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "west-market-roof-rail-south", x: -120, z: 94.5, w: 58, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "east-market-roof-rail-north", x: 120, z: 61.5, w: 58, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "east-market-roof-rail-south", x: 120, z: 94.5, w: 58, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "citadel-skywalk", label: "Citadel Skywalk", x: 0, z: 78, w: 180, d: 20, h: 1, y: roofY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "citadel-skywalk-rail-north", x: 0, z: 68, w: 180, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  { id: "citadel-skywalk-rail-south", x: 0, z: 88, w: 180, d: 3, h: 3, y: centerAt(roofY, 3), color: darkStone, collides: true, style: "wall" },
  ...DESERT_CITADEL_STAIR_FLIGHTS.slice(4).flatMap((flight) => makeStairFlight(flight, goldStone)),

  // North lane cover breaks heavy sightlines into small, readable duels.
  { id: "ruins-wall-west", label: "Palm Ruins", x: -150, z: -116, w: 48, d: 7, h: 6, color: ochre, collides: true, style: "ruin" },
  { id: "ruins-wall-east", x: 150, z: -116, w: 48, d: 7, h: 6, color: darkStone, collides: true, style: "ruin" },
  { id: "ruins-foundation-west", x: -92, z: -136, w: 34, d: 18, h: 3, color: warmStone, collides: true, style: "ruin" },
  { id: "ruins-foundation-east", x: 92, z: -136, w: 34, d: 18, h: 3, color: warmStone, collides: true, style: "ruin" },
  { id: "ruins-arch-center-west", x: -42, z: -110, w: 18, d: 8, h: 7, color: paleStone, collides: true, style: "ruin" },
  { id: "ruins-arch-center-east", x: 42, z: -110, w: 18, d: 8, h: 7, color: paleStone, collides: true, style: "ruin" },
  { id: "ruins-obelisk", label: "Dawn Obelisk", x: 0, z: -128, w: 16, d: 16, h: 16, color: darkStone, collides: true, style: "tower" },
  { id: "ruins-obelisk-crown", x: 0, z: -128, w: 11, d: 11, h: 8, y: 20, color: paleStone, style: "tower" },

  // Dry caravan-yard cover keeps the lower route readable without a misplaced river.
  { id: "caravan-yard-cover-north-west", x: -155, z: 119, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "wall" },
  { id: "caravan-yard-cover-north-center", x: 0, z: 119, w: 80, d: 5, h: 5, color: darkStone, collides: true, style: "wall" },
  { id: "caravan-yard-cover-north-east", x: 155, z: 119, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "wall" },
  { id: "caravan-yard-cover-south-west", x: -155, z: 147, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "wall" },
  { id: "caravan-yard-cover-south-center", x: 0, z: 147, w: 80, d: 5, h: 5, color: darkStone, collides: true, style: "wall" },
  { id: "caravan-yard-cover-south-east", x: 155, z: 147, w: 90, d: 5, h: 5, color: darkStone, collides: true, style: "wall" }
];

export const blocks: CitadelBlock[] = rawBlocks.map(scaleRect);

const rawProps: CitadelProp[] = [
  { id: "lion-gate-arch", kind: "arch", x: -86, z: 0, size: 36, h: 18, y: 0, color: paleStone, rotationY: Math.PI / 2 },
  { id: "sun-gate-arch", kind: "arch", x: 86, z: 0, size: 36, h: 18, y: 0, color: paleStone, rotationY: Math.PI / 2 },
  { id: "west-main-lower-arch", kind: "arch", x: -106, z: 0, size: 27, h: 15, y: 0, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "west-main-upper-arch", kind: "arch", x: -66, z: 0, size: 27, h: 15, y: mainY, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "east-main-lower-arch", kind: "arch", x: 106, z: 0, size: 27, h: 15, y: 0, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "east-main-upper-arch", kind: "arch", x: 66, z: 0, size: 27, h: 15, y: mainY, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "north-main-lower-arch", kind: "arch", x: 0, z: -72, size: 27, h: 15, y: 0, color: turquoise, material: "accent" },
  { id: "north-main-upper-arch", kind: "arch", x: 0, z: -38, size: 27, h: 15, y: mainY, color: turquoise, material: "accent" },
  { id: "south-main-lower-arch", kind: "arch", x: 0, z: 117, size: 27, h: 15, y: 0, color: turquoise, material: "accent" },
  { id: "south-main-upper-arch", kind: "arch", x: 0, z: 83, size: 27, h: 15, y: mainY, color: turquoise, material: "accent" },
  { id: "west-market-lower-arch", kind: "arch", x: -228, z: 78, size: 22, h: 14, y: 0, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "west-market-upper-arch", kind: "arch", x: -132, z: 78, size: 22, h: 14, y: roofY, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "east-market-lower-arch", kind: "arch", x: 228, z: 78, size: 22, h: 14, y: 0, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "east-market-upper-arch", kind: "arch", x: 132, z: 78, size: 22, h: 14, y: roofY, color: turquoise, material: "accent", rotationY: Math.PI / 2 },
  { id: "skywalk-beacon", kind: "arch", x: 0, z: 78, size: 24, h: 14, y: roofY, color: turquoise, material: "accent" },
  { id: "west-market-canopy", kind: "shade", x: -145, z: 78, size: 18, h: 6, y: 0, color: blue, material: "cloth" },
  { id: "east-market-canopy", kind: "shade", x: 145, z: 78, size: 18, h: 6, y: 0, color: red, material: "cloth" },
  { id: "north-palm-west", kind: "palm", x: -70, z: -145, size: 6, h: 17, color: palmGreen, material: "wood" },
  { id: "north-palm-east", kind: "palm", x: 70, z: -145, size: 6, h: 17, color: palmGreen, material: "wood" },
  { id: "caravan-yard-palm-west", kind: "palm", x: -210, z: 154, size: 5, h: 15, color: palmGreen, material: "wood" },
  { id: "caravan-yard-palm-east", kind: "palm", x: 210, z: 154, size: 5, h: 15, color: palmGreen, material: "wood" },
  { id: "ruins-arch-west", kind: "arch", x: -118, z: -112, size: 15, h: 10, color: paleStone, rotationY: 0.12 },
  { id: "ruins-arch-east", kind: "arch", x: 118, z: -112, size: 15, h: 10, color: warmStone, rotationY: Math.PI - 0.12 },
  { id: "blue-base-banner", kind: "banner", x: -235, z: -54, size: 4, h: 11, y: 0, color: blue, material: "cloth" },
  { id: "red-base-banner", kind: "banner", x: 235, z: 54, size: 4, h: 11, y: 0, color: red, material: "cloth" },
  { id: "obelisk-banner", kind: "banner", x: 0, z: -128, size: 5, h: 15, y: 16, color: "#e4b64f", material: "cloth" }
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
  { id: "court-planter-palm", x: 0, z: -12, radius: 2.5, h: 5, y: mainY + 2.5, color: palmGreen },
  { id: "court-column-west", x: -24, z: 48, radius: 3, h: 13, y: mainY + 6.5, color: paleStone, collides: true },
  { id: "court-column-east", x: 24, z: 48, radius: 3, h: 13, y: mainY + 6.5, color: paleStone, collides: true },
  { id: "caravan-yard-marker-west", x: -205, z: 133, radius: 2.8, h: 0.5, y: 0.25, color: ochre, material: "stone" },
  { id: "caravan-yard-marker-east", x: 205, z: 133, radius: 2.8, h: 0.5, y: 0.25, color: ochre, material: "stone" }
];
export const cylinders: CitadelCylinder[] = rawCylinders.map(scaleCylinder);

export const signs: CitadelSign[] = [];
