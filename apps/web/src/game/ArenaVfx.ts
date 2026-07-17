import * as THREE from "three";
import type { Team } from "@quizstrike/shared";

export type ArenaVfxKind = "impact" | "shield" | "objective" | "spawn" | "elimination" | "victory" | "defeat";

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

const colorForEvent = (event: ArenaVfxEvent) => event.color ?? (
  event.kind === "defeat" ? "#fb7185"
    : event.kind === "victory" ? "#facc15"
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
    slot.kind = event.kind;
    slot.startedAt = now;
    slot.lifetime = event.kind === "impact" ? 320 : event.kind === "shield" ? 520 : event.kind === "objective" ? 760 : event.kind === "elimination" ? 900 : 1100;
    slot.radius = event.kind === "impact" ? 1.2 : event.kind === "shield" ? 2.4 : event.kind === "objective" ? 3.2 : event.kind === "elimination" ? 4.2 : 6;
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
      const pulse = slot.kind === "shield" ? 0.78 + Math.sin(progress * Math.PI * 4) * 0.12 : 1;
      slot.group.scale.setScalar(Math.max(0.01, slot.radius * easeOut * pulse));
      slot.ring.material.opacity = (1 - progress) * (slot.kind === "objective" ? 0.82 : 0.66);
      slot.halo.material.opacity = (1 - progress) * (slot.kind === "shield" ? 0.38 : 0.18);
      slot.core.material.opacity = (1 - progress) * 0.78;
      slot.core.rotation.y += 0.08;
      slot.core.position.y = 0.45 + easeOut * (slot.kind === "elimination" ? 1.8 : 0.8);
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
