import * as THREE from "three";
import type { PlayerSession } from "@quizstrike/shared";
import { CharacterController } from "./CharacterController.js";
import { CharacterFactory } from "./CharacterFactory.js";

export interface CharacterVisualState {
  x: number;
  z: number;
  facing: number;
}

export interface CharacterManagerOptions {
  isFps: boolean;
  currentPlayerId?: string;
  makeBadgeMaterial: (player: PlayerSession) => THREE.SpriteMaterial;
}

type CharacterRecord = {
  controller: CharacterController;
  badge: THREE.Sprite;
  ring?: THREE.Mesh;
};

export interface CharacterManagerStats {
  total: number;
  visible: number;
  alive: number;
  averageSpeed: number;
  lod: Record<"LOD0" | "LOD1" | "LOD2" | "LOD3", number>;
}

export class CharacterManager {
  private readonly records = new Map<string, CharacterRecord>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly factory: CharacterFactory,
    private readonly options: CharacterManagerOptions
  ) {}

  sync(players: PlayerSession[], getVisualState: (player: PlayerSession, index: number) => CharacterVisualState) {
    const seen = new Set<string>();
    players.forEach((player, index) => {
      if (this.options.isFps && player.id === this.options.currentPlayerId) return;
      seen.add(player.id);
      const state = getVisualState(player, index);
      const record = this.records.get(player.id);
      if (!record) {
        this.add(player, state);
        return;
      }
      record.controller.setTarget(state.x, state.z, state.facing, player.isAlive);
      record.badge.visible = true;
      if (record.ring) record.ring.visible = player.id === this.options.currentPlayerId;
    });

    for (const [playerId, record] of this.records) {
      if (seen.has(playerId)) continue;
      record.controller.model.root.visible = false;
      record.badge.visible = false;
      if (record.ring) record.ring.visible = false;
    }
  }

  update(delta: number, elapsed: number, camera: THREE.Camera) {
    for (const record of this.records.values()) {
      if (!record.controller.model.root.visible) continue;
      record.controller.update(delta, elapsed, camera);
      const { current, alive } = record.controller;
      record.badge.position.set(current.x, 6.2, current.z);
      record.badge.scale.set(alive ? 8.2 : 7.2, alive ? 3 : 2.6, 1);
      record.badge.lookAt(camera.position);
      if (record.ring) record.ring.position.set(current.x, 0.08, current.z);
    }
  }

  getStats(): CharacterManagerStats {
    const stats: CharacterManagerStats = {
      total: this.records.size,
      visible: 0,
      alive: 0,
      averageSpeed: 0,
      lod: { LOD0: 0, LOD1: 0, LOD2: 0, LOD3: 0 }
    };
    let speedTotal = 0;
    for (const record of this.records.values()) {
      if (!record.controller.model.root.visible) continue;
      stats.visible += 1;
      if (record.controller.alive) stats.alive += 1;
      stats.lod[record.controller.model.lod.level] += 1;
      speedTotal += record.controller.speed;
    }
    stats.averageSpeed = stats.visible === 0 ? 0 : Number((speedTotal / stats.visible).toFixed(2));
    return stats;
  }

  private add(player: PlayerSession, state: CharacterVisualState) {
    const model = this.factory.createCharacter({ playerId: player.id, team: player.team, gear: player.gear });
    const controller = new CharacterController(model, state.x, state.z, state.facing, player.isAlive);
    this.scene.add(model.root);

    const badge = new THREE.Sprite(this.options.makeBadgeMaterial(player));
    badge.position.set(state.x, 6.2, state.z);
    badge.scale.set(8.2, 3, 1);
    this.scene.add(badge);

    let ring: THREE.Mesh | undefined;
    if (player.id === this.options.currentPlayerId && !this.options.isFps) {
      ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.8, 0.25, 8, 42),
        new THREE.MeshBasicMaterial({ color: "#172033" })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(state.x, 0.08, state.z);
      this.scene.add(ring);
    }

    this.records.set(player.id, { controller, badge, ring });
  }
}
