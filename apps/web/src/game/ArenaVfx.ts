import * as THREE from "three";
import type { Team } from "@quizstrike/shared";

export type ArenaVfxKind =
  | "impact"
  | "shield"
  | "objective"
  | "spawn"
  | "elimination"
  | "victory"
  | "defeat"
  | "healing"
  | "flag_plant"
  | "flag_capture"
  | "objective_progress"
  | "round_start"
  | "round_end"
  | "heavy_fire"
  | "zoom"
  | "cooldown";

export interface ArenaVfxEvent {
  kind: ArenaVfxKind;
  x: number;
  z: number;
  y?: number;
  team?: Team;
  color?: string;
}

type ArenaVfxListener = (event: ArenaVfxEvent) => void;
const listeners = new Set<ArenaVfxListener>();

export const emitArenaVfx = (event: ArenaVfxEvent) => listeners.forEach((listener) => listener(event));
export const subscribeArenaVfx = (listener: ArenaVfxListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

interface VfxSlot {
  group: THREE.Group;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  core: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  startedAt: number;
  lifetime: number;
  radius: number;
  kind: ArenaVfxKind;
  active: boolean;
}

export interface ArenaVfxStyle {
  lifetime: number;
  radius: number;
  ringOpacity: number;
  haloOpacity: number;
  rise: number;
}

const vfxStyles: Record<ArenaVfxKind, ArenaVfxStyle> = {
  impact: { lifetime: 320, radius: 1.2, ringOpacity: 0.66, haloOpacity: 0.18, rise: 0.8 },
  shield: { lifetime: 520, radius: 2.4, ringOpacity: 0.66, haloOpacity: 0.38, rise: 0.8 },
  objective: { lifetime: 760, radius: 3.2, ringOpacity: 0.82, haloOpacity: 0.2, rise: 1.1 },
  spawn: { lifetime: 900, radius: 3.8, ringOpacity: 0.7, haloOpacity: 0.28, rise: 1.6 },
  elimination: { lifetime: 900, radius: 4.2, ringOpacity: 0.7, haloOpacity: 0.24, rise: 1.8 },
  victory: { lifetime: 1100, radius: 6, ringOpacity: 0.82, haloOpacity: 0.28, rise: 2.1 },
  defeat: { lifetime: 1100, radius: 5.2, ringOpacity: 0.7, haloOpacity: 0.22, rise: 1.2 },
  healing: { lifetime: 740, radius: 2.8, ringOpacity: 0.72, haloOpacity: 0.3, rise: 1.7 },
  flag_plant: { lifetime: 920, radius: 4, ringOpacity: 0.84, haloOpacity: 0.24, rise: 1.5 },
  flag_capture: { lifetime: 1100, radius: 5.6, ringOpacity: 0.9, haloOpacity: 0.32, rise: 2.2 },
  objective_progress: { lifetime: 560, radius: 2.7, ringOpacity: 0.56, haloOpacity: 0.16, rise: 0.9 },
  round_start: { lifetime: 1000, radius: 5.6, ringOpacity: 0.78, haloOpacity: 0.28, rise: 1.8 },
  round_end: { lifetime: 1100, radius: 6, ringOpacity: 0.76, haloOpacity: 0.26, rise: 2 },
  heavy_fire: { lifetime: 280, radius: 1.65, ringOpacity: 0.76, haloOpacity: 0.16, rise: 0.5 },
  zoom: { lifetime: 260, radius: 1.4, ringOpacity: 0.52, haloOpacity: 0.12, rise: 0.35 },
  cooldown: { lifetime: 380, radius: 1.7, ringOpacity: 0.48, haloOpacity: 0.14, rise: 0.45 }
};

export const getArenaVfxStyle = (kind: ArenaVfxKind) => vfxStyles[kind];

const colorForEvent = (event: ArenaVfxEvent) => event.color ?? (
  event.kind === "defeat" ? "#fb7185"
    : event.kind === "victory" ? "#facc15"
      : event.kind === "healing" ? "#6ee7b7"
        : event.kind === "flag_plant" || event.kind === "flag_capture" || event.kind === "round_start" ? "#fde047"
          : event.kind === "cooldown" ? "#f59e0b"
      : event.kind === "shield" ? "#67e8f9"
        : event.team === "red" ? "#fb7185" : "#38bdf8"
);

export class ArenaVfxPool {
  private readonly slots: VfxSlot[];
  private cursor = 0;
  readonly maxActive: number;

  constructor(private readonly scene: THREE.Scene, detail: number) {
    this.maxActive = detail === 0 ? 6 : detail === 1 ? 12 : 16;
    this.slots = Array.from({ length: this.maxActive }, () => {
      const group = new THREE.Group();
      group.visible = false;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.075, 6, 20),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      ring.rotation.x = Math.PI / 2;
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34, 0),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      core.position.y = 0.7;
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 6),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, wireframe: true, blending: THREE.AdditiveBlending })
      );
      halo.position.y = 0.8;
      group.add(ring, core, halo);
      scene.add(group);
      return { group, ring, core, halo, startedAt: 0, lifetime: 1, radius: 1, kind: "impact" as const, active: false };
    });
  }

  emit(event: ArenaVfxEvent, now = performance.now()) {
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % this.slots.length;
    const color = new THREE.Color(colorForEvent(event));
    const style = getArenaVfxStyle(event.kind);
    slot.kind = event.kind;
    slot.startedAt = now;
    slot.lifetime = style.lifetime;
    slot.radius = style.radius;
    slot.group.position.set(event.x, event.y ?? 0.12, event.z);
    slot.group.scale.setScalar(0.01);
    slot.group.visible = true;
    slot.active = true;
    slot.ring.material.color.copy(color);
    slot.core.material.color.copy(color);
    slot.halo.material.color.copy(color);
  }

  update(now: number) {
    this.slots.forEach((slot) => {
      if (!slot.active) return;
      const progress = Math.min(1, (now - slot.startedAt) / slot.lifetime);
      if (progress >= 1) {
        slot.active = false;
        slot.group.visible = false;
        return;
      }
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const style = getArenaVfxStyle(slot.kind);
      const pulsing = slot.kind === "shield" || slot.kind === "healing" || slot.kind === "objective_progress";
      const pulse = pulsing ? 0.78 + Math.sin(progress * Math.PI * 4) * 0.12 : 1;
      slot.group.scale.setScalar(Math.max(0.01, slot.radius * easeOut * pulse));
      slot.ring.material.opacity = (1 - progress) * style.ringOpacity;
      slot.halo.material.opacity = (1 - progress) * style.haloOpacity;
      slot.core.material.opacity = (1 - progress) * 0.78;
      slot.core.rotation.y += 0.08;
      slot.ring.rotation.z = slot.kind === "cooldown" ? progress * Math.PI * 2 : 0;
      slot.core.position.y = 0.45 + easeOut * style.rise;
    });
  }

  get activeCount() {
    return this.slots.reduce((count, slot) => count + Number(slot.active), 0);
  }

  dispose() {
    this.slots.forEach((slot) => {
      this.scene.remove(slot.group);
      slot.ring.geometry.dispose();
      slot.core.geometry.dispose();
      slot.halo.geometry.dispose();
      slot.ring.material.dispose();
      slot.core.material.dispose();
      slot.halo.material.dispose();
    });
  }
}
