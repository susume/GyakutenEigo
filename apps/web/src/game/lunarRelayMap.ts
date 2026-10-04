import { LUNAR_RELAY_LAYOUT_BLOCKS, LUNAR_RELAY_STAIR_FLIGHTS, scaleArenaValue } from "@quizstrike/shared";
import type { ArenaMapDefinition, CitadelBlock, CitadelCylinder, CitadelFloorMark, CitadelProp, CitadelSign } from "./mapTypes";

export const LUNAR_RELAY: ArenaMapDefinition = {
  id: "lunar_relay",
  title: "Lunar Relay",
  description: "An off-world outpost under a ringed planet. Contest the relay bridge, slip through its underpass, or flank through the observatory and solar court.",
  districts: ["Observatory · sheltered north route", "Solar Court · cargo flank", "Relay Bridge · upper crossing"],
  routes: ["Observatory loop", "Service underpass", "Relay bridge", "Solar cargo flank"],
  footprint: { width: 480, depth: 360 },
  palette: { sky: "#111c35", fog: "#202d46", floor: "#8998ad", floorTexture: "sand", accent: "#85eed9" }
};

const stairBlocks: CitadelBlock[] = LUNAR_RELAY_STAIR_FLIGHTS.flatMap(flight =>
  Array.from({ length: flight.steps }, (_, index) => {
    const travel = (-0.5 + (index + 0.5) / flight.steps) * flight.length * flight.direction;
    const h = flight.startY + (flight.endY - flight.startY) * (index + 1) / flight.steps;
    return {
      id: `${flight.id}-step-${index + 1}`,
      x: flight.x + (flight.axis === "x" ? travel : 0),
      z: flight.z + (flight.axis === "z" ? travel : 0),
      w: flight.axis === "x" ? flight.length / flight.steps : flight.width,
      d: flight.axis === "z" ? flight.length / flight.steps : flight.width,
      h, y: h / 2, color: "#aebfd0", material: "metal", style: "stair", collides: true
    };
  }));

export const blocks: CitadelBlock[] = [
  ...LUNAR_RELAY_LAYOUT_BLOCKS.map(block => ({ ...block, material: "metal" as const })),
  ...stairBlocks
].map(block => ({ ...block, x: scaleArenaValue(block.x), z: scaleArenaValue(block.z), w: scaleArenaValue(block.w), d: scaleArenaValue(block.d) }));
export const cylinders: CitadelCylinder[] = [];
export const floorMarks: CitadelFloorMark[] = [];
export const props: CitadelProp[] = [];
export const signs: CitadelSign[] = [];
