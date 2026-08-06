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
  { id: "west-city-wall-north", x: -248, z: -112, w: 8, d: 124, h: 15, color: darkStone, collides: true, style: "wall" },
  { id: "west-city-wall-south", x: -248, z: 112, w: 8, d: 124, h: 15, color: darkStone, collides: true, style: "wall" },
  { id: "east-city-wall-north", x: 248, z: -112, w: 8, d: 124, h: 15, color: darkStone, collides: true, style: "wall" },
  { id: "east-city-wall-south", x: 248, z: 112, w: 8, d: 124, h: 15, color: darkStone, collides: true, style: "wall" },

  // Lower plane paving and the raised Fountain Court.
  { id: "north-lane-paving", x: 0, z: -108, w: 444, d: 58, h: 0.3, y: -0.15, color: warmStone, material: "stone", style: "bridge" },
  { id: "south-lane-paving", x: 0, z: 126, w: 444, d: 56, h: 0.3, y: -0.15, color: goldStone, material: "stone", style: "bridge" },
  { id: "court-floor", x: 0, z: 24, w: 132, d: 120, h: 1, y: mainY - 0.5, color: paleStone, material: "stone", style: "bridge" },
  { id: "court-foundation", x: 0, z: 24, w: 132, d: 120, h: 9.35, y: 4.675, color: darkStone, collides: true, style: "wall" },

  // Four wide main-level connectors. The gate blocks frame the approach; the stair mouths stay open.
  ...DESERT_CITADEL_STAIR_FLIGHTS.slice(0, 4).flatMap((flight) => makeStairFlight(flight, paleStone)),

  // Spawn courts are broad enough for twenty players; the exit stays open so
  // the first movement decision is made by the lane layout, not a screen wall.
  { id: "blue-base-back", x: -240, z: 0, w: 5, d: 126, h: 13, color: darkStone, collides: true, style: "wall" },
  { id: "blue-base-north", x: -232, z: -74, w: 24, d: 5, h: 10, color: warmStone, collides: true, style: "wall" },
  { id: "blue-base-south", x: -232, z: 74, w: 24, d: 5, h: 10, color: warmStone, collides: true, style: "wall" },
  { id: "red-base-back", x: 240, z: 0, w: 5, d: 126, h: 13, color: darkStone, collides: true, style: "wall" },
  { id: "red-base-north", x: 232, z: -74, w: 24, d: 5, h: 10, color: goldStone, collides: true, style: "wall" },
  { id: "red-base-south", x: 232, z: 74, w: 24, d: 5, h: 10, color: goldStone, collides: true, style: "wall" },

  // Lion Gate and Sun Gate mark the center-lane transition without sealing it.
  { id: "lion-gate-north-pier", label: "Lion Gate", x: -86, z: -26, w: 10, d: 12, h: 17, color: ochre, collides: true, style: "tower" },
  { id: "lion-gate-south-pier", x: -86, z: 26, w: 10, d: 12, h: 17, color: ochre, collides: true, style: "tower" },
  { id: "lion-gate-lintel", x: -86, z: 0, w: 10, d: 40, h: 4, y: 16, color: paleStone, collides: true, style: "gate" },
  { id: "sun-gate-north-pier", label: "Sun Gate", x: 86, z: -26, w: 10, d: 12, h: 17, color: ochre, collides: true, style: "tower" },
  { id: "sun-gate-south-pier", x: 86, z: 26, w: 10, d: 12, h: 17, color: ochre, collides: true, style: "tower" },
  { id: "sun-gate-lintel", x: 86, z: 0, w: 10, d: 40, h: 4, y: 16, color: paleStone, collides: true, style: "gate" },

  // Main-level Fountain Court cover hierarchy: low walls, a monument, and one central readable landmark.
  { id: "court-parapet-north-west", x: -44, z: -36.5, w: 44, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true },
  { id: "court-parapet-north-east", x: 44, z: -36.5, w: 44, d: 3, h: 3, y: centerAt(mainY, 3), color: darkStone, collides: true },
  { id: "court-parapet-south-west", x: -44, z: 86.5, w: 44, d: 3, h: 3, y: centerAt(mainY, 3), color: warmStone, collides: true },
  { id: "court-parapet-south-east", x: 44, z: 86.5, w: 44, d: 3, h: 3, y: centerAt(mainY, 3), color: warmStone, collides: true },
  { id: "court-monument", label: "Sun Dial Monument", x: 0, z: 28, w: 10, d: 12, h: 7, y: centerAt(mainY, 7), color: terracotta, collides: true, style: "tower" },

  // Mirrored markets frame an open stair court, so the upper route has a
  // believable architectural entrance instead of a stair clipping through a
  // solid building proxy.
  { id: "west-market-mass-north", label: "West Market", x: -120, z: 64, w: 58, d: 6, h: 23.4, y: 11.7, color: terracotta, collides: true, style: "house" },
  { id: "west-market-mass-south", x: -120, z: 92, w: 58, d: 6, h: 23.4, y: 11.7, color: terracotta, collides: true, style: "house" },
  { id: "east-market-mass-north", label: "East Market", x: 120, z: 64, w: 58, d: 6, h: 23.4, y: 11.7, color: goldStone, collides: true, style: "house" },
  { id: "east-market-mass-south", x: 120, z: 92, w: 58, d: 6, h: 23.4, y: 11.7, color: goldStone, collides: true, style: "house" },
  { id: "west-market-roof", x: -120, z: 78, w: 58, d: 34, h: 1, y: roofY - 0.5, color: terracotta, material: "stone", style: "bridge" },
  { id: "east-market-roof", x: 120, z: 78, w: 58, d: 34, h: 1, y: roofY - 0.5, color: paleStone, material: "stone", style: "bridge" },
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
  { id: "ruins-obelisk", label: "Dawn Obelisk", x: 0, z: -128, w: 16, d: 16, h: 16, color: darkStone, collides: true, style: "tower" },
  { id: "ruins-obelisk-crown", x: 0, z: -128, w: 11, d: 11, h: 8, y: 20, color: paleStone, style: "tower" },

  // Dry caravan-yard cover keeps the lower route readable without a misplaced river.
  { id: "caravan-yard-cover-north-west", x: -155, z: 119, w: 90, d: 5, h: 5, color: darkStone, collides: true },
  { id: "caravan-yard-cover-north-center", x: 0, z: 119, w: 80, d: 5, h: 5, color: darkStone, collides: true },
  { id: "caravan-yard-cover-north-east", x: 155, z: 119, w: 90, d: 5, h: 5, color: darkStone, collides: true }
];

/**
 * Phase 3 traceability manifest. Keeping this list beside the authored map
 * makes the no-speculative-geometry rule executable in the map regression.
 * Stair pieces are covered by their shared flight IDs and exact step counts.
 */
export const DESERT_CITADEL_PHASE3_MANIFEST = {
  structureBlockIds: [
    "north-cliff-west", "north-cliff-east", "south-wall-west", "south-wall-east",
    "west-city-wall-north", "west-city-wall-south", "east-city-wall-north", "east-city-wall-south",
    "north-lane-paving", "south-lane-paving", "court-floor", "court-foundation",
    "blue-base-back", "blue-base-north", "blue-base-south", "red-base-back", "red-base-north", "red-base-south",
    "lion-gate-north-pier", "lion-gate-south-pier", "lion-gate-lintel", "sun-gate-north-pier", "sun-gate-south-pier", "sun-gate-lintel",
    "court-parapet-north-west", "court-parapet-north-east", "court-parapet-south-west", "court-parapet-south-east", "court-monument",
    "west-market-mass-north", "west-market-mass-south", "east-market-mass-north", "east-market-mass-south",
    "west-market-roof", "east-market-roof", "west-market-roof-rail-north", "west-market-roof-rail-south",
    "east-market-roof-rail-north", "east-market-roof-rail-south", "citadel-skywalk", "citadel-skywalk-rail-north", "citadel-skywalk-rail-south",
    "ruins-wall-west", "ruins-wall-east", "ruins-obelisk", "ruins-obelisk-crown",
    "caravan-yard-cover-north-west", "caravan-yard-cover-north-center", "caravan-yard-cover-north-east"
  ],
  stairFlightIds: DESERT_CITADEL_STAIR_FLIGHTS.map((flight) => flight.id),
  propIds: [
    "west-market-canopy", "east-market-canopy", "north-palm-west", "north-palm-east",
    "caravan-yard-palm-west", "caravan-yard-palm-east", "blue-base-banner", "red-base-banner", "obelisk-banner"
  ],
  cylinderIds: ["blue-fountain-rim", "blue-fountain-water", "caravan-yard-marker-west", "caravan-yard-marker-east"]
} as const;

export const blocks: CitadelBlock[] = rawBlocks.map(scaleRect);

const rawProps: CitadelProp[] = [
  { id: "west-market-canopy", kind: "shade", x: -145, z: 78, size: 18, h: 6, y: 0, color: blue, material: "cloth" },
  { id: "east-market-canopy", kind: "shade", x: 145, z: 78, size: 18, h: 6, y: 0, color: red, material: "cloth" },
  { id: "north-palm-west", kind: "palm", x: -70, z: -145, size: 6, h: 17, color: palmGreen, material: "wood" },
  { id: "north-palm-east", kind: "palm", x: 70, z: -145, size: 6, h: 17, color: palmGreen, material: "wood" },
  { id: "caravan-yard-palm-west", kind: "palm", x: -210, z: 154, size: 5, h: 15, color: palmGreen, material: "wood" },
  { id: "caravan-yard-palm-east", kind: "palm", x: 210, z: 154, size: 5, h: 15, color: palmGreen, material: "wood" },
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
  { id: "caravan-yard-marker-west", x: -205, z: 133, radius: 2.8, h: 0.5, y: 0.25, color: ochre, material: "stone" },
  { id: "caravan-yard-marker-east", x: 205, z: 133, radius: 2.8, h: 0.5, y: 0.25, color: ochre, material: "stone" }
];
export const cylinders: CitadelCylinder[] = rawCylinders.map(scaleCylinder);

export const signs: CitadelSign[] = [];
