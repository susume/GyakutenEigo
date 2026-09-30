import type { EnvironmentKit } from "./EnvironmentKit";
import { mountEnvironmentKit } from "./EnvironmentKitLoader";
import type { Scene } from "three";

/** Decorative backdrop stays beyond authoritative map bounds; never creates invisible cover. */
export function communityBackdropKit(limitX: number, limitZ: number, height = 12): EnvironmentKit {
  const vegetation: EnvironmentKit["vegetation"] = [-1, 1].flatMap((side) => [-.7, -.25, .25, .7].map((along, index) => ({
    id: `community-palm-${side}-${index}`, path: "/assets/community/kenney-nature/palm.glb",
    category: "vegetation" as const, position: [side * (limitX + 16), 0, along * limitZ] as [number, number, number],
    scale: height / 1.51459062, rotationY: index * 1.2, minimumDetail: 1
  })));
  return { id: "community-temple-backdrop", title: "Kenney palm backdrop", description: "CC0 exterior vegetation",
    architecture: [], terrain: [], props: [], effects: [], vegetation,
    budget: { targetDrawCalls: 16, targetTriangles: 1488, targetTextureMb: 0 } };
}

export function mountCommunityBackdrop(scene: Scene, limitX: number, limitZ: number, detail: number, isFps: boolean, signal: AbortSignal, height = 12) {
  return mountEnvironmentKit({ scene, kit: communityBackdropKit(limitX, limitZ, height), detail, isFps, signal });
}
