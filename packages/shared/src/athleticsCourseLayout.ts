import type { AthleticsAccent, AthleticsCourseDefinition, AthleticsCourseSurface, AthleticsCourseTransition, AthleticsRoutePoint } from "./athleticsRace.js";

// A rectangular spiral: each district occupies its own strip of the stadium.
// No main-route landing passes above or below another district's landing.
const route: AthleticsRoutePoint[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ x: -12 * i, z: 123, y: 0 })),
  { x: -110, z: 103, y: 2 },
  ...Array.from({ length: 11 }, (_, i) => ({ x: -110, z: 93 - 10 * i, y: 2.45 + .455 * i })),
  { x: -102, z: -24, y: 8 }, { x: -114, z: -38, y: 9 },
  { x: -102, z: -52, y: 10 }, { x: -114, z: -66, y: 11 },
  { x: -102, z: -80, y: 12 }, { x: -110, z: -94, y: 13 },
  { x: -100, z: -94, y: 13.7 }, { x: -92, z: -94, y: 14.4 },
  { x: -84, z: -94, y: 15.1 }, { x: -76, z: -94, y: 15.8 },
  { x: -66, z: -94, y: 16.5 },
  ...[-54, -42, -14, -2, 10, 22, 50, 62, 74, 86].map((x) => ({ x, z: -94, y: 16.5 })),
  { x: 108, z: -94, y: 18 },
  ...Array.from({ length: 11 }, (_, i) => ({ x: 108, z: -78 + i * 16, y: 18.8 + i * .8 + (i >= 6 ? 5.2 : 0) })),
  ...[90, 72, 54, 36, 18, 0].map((x, i) => ({ x, z: 82, y: 33 + i })),
  { x: -15, z: 65, y: 38 }, { x: -15, z: 42, y: 38 },
  { x: -15, z: 19, y: 38 }, { x: -15, z: -3, y: 46 },
  { x: -30, z: -3, y: 46 }, { x: -42, z: -3, y: 46 }, { x: -54, z: -3, y: 46 },
  ...Array.from({ length: 64 }, (_, i) => ({ x: -54, z: 3.75 + i * 1.5, y: 46 * (1 - (i + 1) / 64) })),
  { x: -54, z: 105, y: 0 },
  ...[-42, -30, -18, -6].map((x) => ({ x, z: 105, y: 0 })),
  { x: 0, z: 105, y: 0 }
];

const checkpointIndices = [10, 21, 32, 43, 54, 64, route.length - 1];
const progressAt = (index: number) => {
  const lengths = route.slice(1).map((point, i) => Math.hypot(point.x - route[i]!.x, point.z - route[i]!.z));
  return lengths.slice(0, index).reduce((sum, length) => sum + length, 0) / lengths.reduce((sum, length) => sum + length, 0);
};
const idAt = (index: number) => `route-platform-${String(index + 1).padStart(3, "0")}`;
const surfaces: AthleticsCourseSurface[] = route.map((point, index) => {
  const checkpoint = checkpointIndices.includes(index);
  const headingPoint = checkpoint ? route[index + 1] ?? point : point;
  const previous = checkpoint ? point : route[index - 1] ?? { x: point.x + 1, z: point.z };
  const rotationY = Math.atan2(headingPoint.x - previous.x, headingPoint.z - previous.z);
  const dimensions = index === route.length - 1 ? [10, 10] : index >= 133 ? [8, 12]
    : index === 67 || index === 132 ? [12, 12] : index >= 68 && index <= 131 ? [10, 1.52]
      : index >= 65 ? [10, 12] : index === 0 ? [26, 24] : checkpoint ? [26, 18]
    : index <= 9 ? [16, 12] : index <= 20 ? [4, 10.1]
      : index <= 27 ? [12, 10] : index <= 31 ? [8, 12]
        : index <= 42 ? [12, 8] : index <= 53 ? [14, 12] : [14, 12];
  return {
    ...point, id: idAt(index), kind: checkpoint ? "checkpoint" : (index >= 11 && index <= 20) || (index >= 28 && index <= 31) || (index >= 68 && index <= 131) ? "stair" : "platform",
    width: dimensions[0]!, depth: dimensions[1]!,
    // Square stepping stones/stair treads stay on the grid; their outgoing
    // chevrons describe the zigzag, rather than rotating a whole district.
    rotationY: (index >= 22 && index <= 31) || index === 67 || (index >= 68 && index <= 132) || index === route.length - 1 ? 0 : rotationY,
    material: index >= 65 ? "stone" : index <= 9 ? "stone" : index <= 20 ? "wood" : index <= 31 ? "accent" : "metal",
    safe: checkpoint || index === 0
  };
});

const movingObstacles: AthleticsCourseDefinition["movingObstacles"] = [
  { id: "timing-shuttle-west", kind: "platform", x: -28, z: -94, y: 15.7, width: 8, depth: 12, height: .8, axis: "z", amplitude: 4, periodMs: 4400, material: "accent", jumpable: true },
  { id: "timing-shuttle-east", kind: "platform", x: 36, z: -94, y: 15.7, width: 8, depth: 12, height: .8, axis: "z", amplitude: 4, periodMs: 5200, phaseMs: 1200, material: "accent", jumpable: true },
  { id: "timing-swing-gate", kind: "barrier", x: 74, z: -94, y: 16.5, width: 2, depth: 7, height: 6, axis: "z", amplitude: 10, periodMs: 4800, material: "metal", jumpable: true },
  { id: "power-stairs-lift", kind: "elevator", x: 108, z: 10, y: 25, width: 12, depth: 8, height: .8, axis: "y", amplitude: 3, periodMs: 5400, material: "metal", jumpable: true },
  { id: "summit-finish-lift", kind: "elevator", x: -15, z: 8, y: 41.2, width: 12, depth: 8, height: .8, axis: "y", amplitude: 4, periodMs: 5800, material: "accent", jumpable: true }
];
const movingTransitions: Record<number, string> = { 34: "timing-shuttle-west", 38: "timing-shuttle-east", 41: "timing-swing-gate", 49: "power-stairs-lift", 63: "summit-finish-lift" };
const transitions: AthleticsCourseTransition[] = route.slice(0, -1).map((_, index) => ({
  id: `main-transition-${String(index + 1).padStart(3, "0")}`,
  fromSurfaceId: idAt(index), toSurfaceId: idAt(index + 1),
  type: index >= 64 ? "connected" : [49, 63].includes(index) ? "elevator"
    : [34, 38].includes(index) ? "moving_jump"
      : checkpointIndices.includes(index + 1) ? "checkpoint_entry"
        : index <= 20 || (index >= 27 && index <= 32) || index === 43 ? "connected"
          : index >= 55 ? "hard_jump" : (index >= 21 && index <= 26) || index === 54 ? "easy_jump" : "jump",
  ...(movingTransitions[index] ? { movingObstacleId: movingTransitions[index] } : {}),
  note: index >= 64 ? "Descend the connected stairs, steer around the posts, then run across the start/finish line." : index <= 8 ? "Sprint over low hurdles on the connected runway."
    : index <= 20 ? "Keep centred on the narrow balance beam."
      : [34, 38].includes(index) ? "Board the moving shuttle; this gap requires two jumps."
        : index === 41 ? "Wait for the gate to move off the landing, or pass around its side."
          : [49, 63].includes(index) ? "Board at the low point, ride up, then jump onto the exit." : undefined
}));
transitions.push({ id: "lap-join", fromSurfaceId: idAt(route.length - 1), toSurfaceId: idAt(0), type: "connected", note: "Keep running onto the start runway; lap changes never stop movement." });

const branch = (id: string, label: string, start: number, end: number, points: AthleticsRoutePoint[], size: number[]): AthleticsCourseDefinition["shortcuts"][number] => {
  const branchSurfaces: AthleticsCourseSurface[] = points.map((point, index) => ({ ...point,
    id: `shortcut-${id}-${index + 1}`, kind: "platform", width: size[0]!, depth: size[1]!, rotationY: 0, material: "accent" }));
  const ids = [idAt(start), ...branchSurfaces.map((surface) => surface.id), idAt(end)];
  return { id, label, startProgress: progressAt(start), endProgress: progressAt(end),
    route: [route[start]!, ...points, route[end]!], surfaces: branchSurfaces, routeWidth: 12,
    transitions: ids.slice(0, -1).map((fromSurfaceId, index) => ({ id: `${id}-${index}`, fromSurfaceId, toSurfaceId: ids[index + 1]!, type: "shortcut_jump" })) };
};

export const SKYLINE_CIRCUIT_COURSE: AthleticsCourseDefinition = {
  id: "stadium_loop", title: "Skyline Adventure Park",
  subtitle: "Seven athletic districts. One continuous circuit. Keep running across the start/finish line.",
  closedLoop: true, finishSurfaceIndex: 0,
  route, surfaces, transitions, checkpoints: checkpointIndices.map(progressAt),
  sections: [
    [0, 10, "hurdle-sprint", "Hurdle Sprint", "Build speed and clear the striped hurdles.", "cyan", "Sprint lanes"],
    [10, 21, "balance-canyon", "Balance Canyon", "Keep your balance on the narrow wooden beam.", "orange", "Balance beams"],
    [21, 32, "zigzag-steps", "Zigzag Steps", "Alternate your jumps, then run up the stair treads.", "lime", "Stepping stones"],
    [32, 43, "timing-traverse", "Timing Traverse", "Board two moving shuttles and time the sliding gate.", "violet", "Moving bridges"],
    [43, 54, "power-stairs", "Power Stairs", "Climb the broad ledges and ride the power lift.", "pink", "Climbing terraces"],
    [54, 64, "precision-summit", "Precision Summit", "Clear the long jumps and ride the final lift to the lookout.", "gold", "Summit lookout"],
    [64, route.length - 1, "skyline-descent", "Skyline Descent", "Run down the wide stairs, weave past the posts, then cross the finish without stopping.", "cyan", "Continuous return lane"]
  ].map(([start, end, id, label, description, accent, landmark]) => ({
    startProgress: progressAt(Number(start)), endProgress: progressAt(Number(end)),
    id: String(id), label: String(label), description: String(description), accent: accent as AthleticsAccent, landmark: String(landmark)
  })),
  shortcuts: [
    branch("stair-cut", "Stair corner cut", 26, 30, [{ x: -88, z: -80, y: 13.5 }], [8, 8]),
    branch("timing-bypass", "Expert shuttle bypass", 34, 36, [{ x: -22, z: -76, y: 16.5 }], [14, 14]),
    branch("summit-cut", "Summit corner cut", 59, 62, [{ x: 15, z: 61, y: 38 }, { x: 1, z: 48, y: 38 }], [10, 10])
  ],
  movingObstacles,
  challenges: [
    ...[2, 4, 6, 8].map((index) => ({ id: `sprint-hurdle-${index}`, kind: "hurdle" as const,
      x: route[index]!.x, z: route[index]!.z, y: route[index]!.y, width: 1, depth: 13, height: 1.2 })),
    ...[46, 48, 52].map((index) => ({ id: `slalom-post-${index}`, kind: "slalom" as const,
      x: route[index]!.x, z: route[index]!.z, y: route[index]!.y, width: 3, depth: 2.5, height: 6 })),
    ...[85, 103, 121].map((index) => ({ id: `descent-slalom-${index}`, kind: "slalom" as const,
      x: route[index]!.x, z: route[index]!.z, y: route[index]!.y, width: 2.2, depth: .65, height: 3.5 }))
  ],
  routeWidth: 18, finishThreshold: .982, bounds: { limitX: 140, limitZ: 140 }
};
