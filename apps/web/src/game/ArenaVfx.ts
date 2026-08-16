import * as THREE from "three";
import type { Team } from "@quizstrike/shared";

/**
 * Semantic VFX cues. Gameplay code should emit one of these events instead of
 * constructing a mesh, sprite or particle emitter itself.
 */
export type ArenaVfxKind =
  | "weapon_fire"
  | "tracer"
  | "impact"
  | "snowball_impact"
  | "player_hit"
  | "hit_confirm"
  | "damage_taken"
  | "footstep"
  | "answer_incorrect"
  | "reward_burst"
  | "purchase"
  | "shield"
  | "objective"
  | "flag_pickup"
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

export type ArenaVfxSurface = "stone" | "metal" | "sand" | "dirt" | "grass" | "water" | "snow" | "player";

export interface ArenaVfxEvent {
  kind: ArenaVfxKind;
  x: number;
  z: number;
  y?: number;
  team?: Team;
  color?: string;
  playerId?: string;
  surface?: ArenaVfxSurface;
  /** Local feedback gets the highest admission priority and longest view range. */
  local?: boolean;
  /** Optional event strength used by reward and objective cues. */
  intensity?: number;
  amount?: number;
}

type ArenaVfxListener = (event: ArenaVfxEvent) => void;
const listeners = new Set<ArenaVfxListener>();

export const emitArenaVfx = (event: ArenaVfxEvent) => listeners.forEach((listener) => listener(event));
export const subscribeArenaVfx = (listener: ArenaVfxListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export interface ArenaVfxTextures {
  muzzle?: THREE.Texture;
  trace?: THREE.Texture;
  spark?: THREE.Texture;
  smoke?: THREE.Texture;
  circle?: THREE.Texture;
  star?: THREE.Texture;
  magic?: THREE.Texture;
  snow?: THREE.Texture;
}

type ArenaVfxCategory = "ambient" | "micro" | "player" | "objective" | "round";
type ArenaVfxTextureKey = keyof ArenaVfxTextures;

export interface ArenaVfxStyle {
  lifetime: number;
  radius: number;
  ringOpacity: number;
  haloOpacity: number;
  rise: number;
  category: ArenaVfxCategory;
  priority: number;
  maxDistance: number;
  spriteCount: number;
  spriteKey?: ArenaVfxTextureKey;
  secondarySpriteKey?: ArenaVfxTextureKey;
  beam?: boolean;
}

const vfxStyles: Record<ArenaVfxKind, ArenaVfxStyle> = {
  weapon_fire: { lifetime: 190, radius: 0.9, ringOpacity: 0.48, haloOpacity: 0.18, rise: 0.2, category: "micro", priority: 1, maxDistance: 92, spriteCount: 2, spriteKey: "muzzle", secondarySpriteKey: "smoke" },
  tracer: { lifetime: 180, radius: 1.1, ringOpacity: 0, haloOpacity: 0.16, rise: 0.15, category: "micro", priority: 1, maxDistance: 110, spriteCount: 1, spriteKey: "trace" },
  impact: { lifetime: 300, radius: 1.25, ringOpacity: 0.54, haloOpacity: 0.14, rise: 0.62, category: "micro", priority: 2, maxDistance: 110, spriteCount: 2, spriteKey: "spark", secondarySpriteKey: "smoke" },
  snowball_impact: { lifetime: 360, radius: 1.4, ringOpacity: 0.42, haloOpacity: 0.2, rise: 0.7, category: "micro", priority: 2, maxDistance: 110, spriteCount: 2, spriteKey: "snow", secondarySpriteKey: "circle" },
  player_hit: { lifetime: 260, radius: 1.2, ringOpacity: 0.7, haloOpacity: 0.2, rise: 0.72, category: "micro", priority: 3, maxDistance: 125, spriteCount: 2, spriteKey: "spark", secondarySpriteKey: "circle" },
  hit_confirm: { lifetime: 220, radius: 1.05, ringOpacity: 0.74, haloOpacity: 0.16, rise: 0.4, category: "micro", priority: 4, maxDistance: 150, spriteCount: 1, spriteKey: "star" },
  damage_taken: { lifetime: 300, radius: 1.2, ringOpacity: 0.42, haloOpacity: 0.18, rise: 0.5, category: "micro", priority: 4, maxDistance: 150, spriteCount: 1, spriteKey: "circle" },
  footstep: { lifetime: 180, radius: 0.55, ringOpacity: 0.2, haloOpacity: 0.08, rise: 0.06, category: "ambient", priority: 0, maxDistance: 38, spriteCount: 1, spriteKey: "smoke" },
  answer_incorrect: { lifetime: 280, radius: 0.9, ringOpacity: 0.32, haloOpacity: 0.12, rise: 0.18, category: "player", priority: 3, maxDistance: 80, spriteCount: 1, spriteKey: "circle" },
  reward_burst: { lifetime: 620, radius: 1.8, ringOpacity: 0.62, haloOpacity: 0.28, rise: 1.25, category: "player", priority: 5, maxDistance: 150, spriteCount: 3, spriteKey: "magic", secondarySpriteKey: "star" },
  purchase: { lifetime: 440, radius: 1.35, ringOpacity: 0.5, haloOpacity: 0.22, rise: 0.9, category: "player", priority: 4, maxDistance: 100, spriteCount: 2, spriteKey: "circle", secondarySpriteKey: "star" },
  shield: { lifetime: 520, radius: 2.4, ringOpacity: 0.66, haloOpacity: 0.38, rise: 0.8, category: "player", priority: 3, maxDistance: 125, spriteCount: 2, spriteKey: "circle", secondarySpriteKey: "spark" },
  objective: { lifetime: 760, radius: 3.2, ringOpacity: 0.82, haloOpacity: 0.2, rise: 1.1, category: "objective", priority: 5, maxDistance: 220, spriteCount: 2, spriteKey: "circle", secondarySpriteKey: "star" },
  flag_pickup: { lifetime: 560, radius: 2.6, ringOpacity: 0.72, haloOpacity: 0.24, rise: 1.25, category: "objective", priority: 5, maxDistance: 220, spriteCount: 2, spriteKey: "magic", secondarySpriteKey: "star" },
  spawn: { lifetime: 720, radius: 3.8, ringOpacity: 0.7, haloOpacity: 0.28, rise: 1.6, category: "player", priority: 4, maxDistance: 150, spriteCount: 2, spriteKey: "magic", secondarySpriteKey: "circle" },
  elimination: { lifetime: 760, radius: 4.2, ringOpacity: 0.7, haloOpacity: 0.24, rise: 1.8, category: "player", priority: 5, maxDistance: 180, spriteCount: 3, spriteKey: "snow", secondarySpriteKey: "star" },
  victory: { lifetime: 1100, radius: 6, ringOpacity: 0.82, haloOpacity: 0.28, rise: 2.1, category: "round", priority: 7, maxDistance: 260, spriteCount: 3, spriteKey: "star", secondarySpriteKey: "magic", beam: true },
  defeat: { lifetime: 900, radius: 5.2, ringOpacity: 0.7, haloOpacity: 0.22, rise: 1.2, category: "round", priority: 6, maxDistance: 220, spriteCount: 2, spriteKey: "smoke", secondarySpriteKey: "circle" },
  healing: { lifetime: 740, radius: 2.8, ringOpacity: 0.72, haloOpacity: 0.3, rise: 1.7, category: "player", priority: 4, maxDistance: 150, spriteCount: 2, spriteKey: "magic", secondarySpriteKey: "circle" },
  flag_plant: { lifetime: 920, radius: 4, ringOpacity: 0.84, haloOpacity: 0.24, rise: 1.5, category: "objective", priority: 6, maxDistance: 240, spriteCount: 2, spriteKey: "circle", secondarySpriteKey: "magic" },
  flag_capture: { lifetime: 1100, radius: 5.6, ringOpacity: 0.9, haloOpacity: 0.32, rise: 2.2, category: "round", priority: 8, maxDistance: 280, spriteCount: 3, spriteKey: "star", secondarySpriteKey: "magic", beam: true },
  objective_progress: { lifetime: 560, radius: 2.7, ringOpacity: 0.56, haloOpacity: 0.16, rise: 0.9, category: "objective", priority: 3, maxDistance: 180, spriteCount: 1, spriteKey: "circle" },
  round_start: { lifetime: 1000, radius: 5.6, ringOpacity: 0.78, haloOpacity: 0.28, rise: 1.8, category: "round", priority: 8, maxDistance: 280, spriteCount: 3, spriteKey: "magic", secondarySpriteKey: "star", beam: true },
  round_end: { lifetime: 1100, radius: 6, ringOpacity: 0.76, haloOpacity: 0.26, rise: 2, category: "round", priority: 8, maxDistance: 280, spriteCount: 3, spriteKey: "star", secondarySpriteKey: "magic", beam: true },
  heavy_fire: { lifetime: 260, radius: 1.05, ringOpacity: 0.76, haloOpacity: 0.16, rise: 0.42, category: "micro", priority: 2, maxDistance: 110, spriteCount: 2, spriteKey: "muzzle", secondarySpriteKey: "trace" },
  zoom: { lifetime: 260, radius: 1.4, ringOpacity: 0.52, haloOpacity: 0.12, rise: 0.35, category: "player", priority: 1, maxDistance: 80, spriteCount: 1, spriteKey: "circle" },
  cooldown: { lifetime: 380, radius: 1.7, ringOpacity: 0.48, haloOpacity: 0.14, rise: 0.45, category: "micro", priority: 0, maxDistance: 80, spriteCount: 1, spriteKey: "circle" }
};

export const getArenaVfxStyle = (kind: ArenaVfxKind) => vfxStyles[kind];

export const getArenaVfxColor = (event: ArenaVfxEvent) => event.color ?? (
  event.kind === "weapon_fire" || event.kind === "heavy_fire" || event.kind === "tracer" ? "#b9f4ff"
    : event.kind === "defeat" || event.kind === "damage_taken" || event.kind === "answer_incorrect" ? "#fb7185"
    : event.kind === "reward_burst" || event.kind === "purchase" || event.kind === "victory" || event.kind === "round_end" ? "#facc15"
    : event.kind === "healing" || event.kind === "spawn" ? "#5eead4"
    : event.kind === "flag_plant" || event.kind === "flag_capture" || event.kind === "round_start" ? "#fde047"
    : event.kind === "cooldown" ? "#f59e0b"
    : event.kind === "shield" ? "#67e8f9"
    : event.kind === "snowball_impact" || event.surface === "snow" ? "#e0f2fe"
    : event.surface === "water" ? "#7dd3fc"
    : event.surface === "metal" ? "#dbeafe"
    : event.surface === "stone" ? "#cbd5e1"
    : event.surface === "sand" ? "#d6b77a"
    : event.surface === "dirt" ? "#b98b60"
    : event.surface === "grass" ? "#86efac"
    : event.team === "red" ? "#fb7185" : "#38bdf8"
);

const nowMs = () => typeof performance !== "undefined" ? performance.now() : Date.now();
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

interface VfxSlot {
  group: THREE.Group;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  core: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  sprites: THREE.Sprite[];
  startedAt: number;
  lifetime: number;
  radius: number;
  kind: ArenaVfxKind;
  category: ArenaVfxCategory;
  priority: number;
  intensity: number;
  spin: number;
  active: boolean;
}

export interface ArenaVfxBudget {
  maxActive: number;
  maxSprites: number;
  maxDistance: number;
}

export interface ArenaVfxStats {
  active: number;
  sprites: number;
  emitted: number;
  dropped: number;
  budget: ArenaVfxBudget;
}

export const getArenaVfxBudget = (detail: number): ArenaVfxBudget => {
  const normalizedDetail = Math.max(0, Math.min(2, Math.floor(detail)));
  return normalizedDetail === 0
    ? { maxActive: 6, maxSprites: 6, maxDistance: 120 }
    : normalizedDetail === 1
      ? { maxActive: 12, maxSprites: 24, maxDistance: 200 }
      : { maxActive: 16, maxSprites: 48, maxDistance: 280 };
};

export const getArenaVfxTextureKeys = (event: ArenaVfxEvent, style = getArenaVfxStyle(event.kind)): [ArenaVfxTextureKey | undefined, ArenaVfxTextureKey | undefined] => {
  if (event.kind === "footstep" && event.surface === "water") return ["circle", undefined];
  if (event.kind === "footstep" && event.surface === "metal") return ["spark", undefined];
  if (event.kind === "footstep" && event.surface === "snow") return ["snow", undefined];
  if (event.kind === "impact" && event.surface === "metal") return ["spark", "circle"];
  if (event.kind === "impact" && (event.surface === "sand" || event.surface === "stone")) return ["smoke", "spark"];
  if (event.kind === "impact" && event.surface === "water") return ["circle", "magic"];
  if (event.kind === "impact" && event.surface === "snow") return ["snow", "circle"];
  return [style.spriteKey, style.secondarySpriteKey];
};

export class ArenaVfxPool {
  private readonly slots: VfxSlot[];
  private readonly budget: ArenaVfxBudget;
  private readonly textures: ArenaVfxTextures;
  private readonly ringGeometry = new THREE.TorusGeometry(1, 0.075, 6, 20);
  private readonly coreGeometry = new THREE.OctahedronGeometry(0.34, 0);
  private readonly haloGeometry = new THREE.SphereGeometry(1, 10, 6);
  private readonly beamGeometry = new THREE.CylinderGeometry(0.72, 1, 1, 8, 1, true);
  private readonly viewPosition = new THREE.Vector3();
  private readonly colorScratch = new THREE.Color();
  private cursor = 0;
  private activeEffects = 0;
  private activeSprites = 0;
  private emittedCount = 0;
  private droppedCount = 0;
  private hasViewPosition = false;
  readonly maxActive: number;

  constructor(private readonly scene: THREE.Scene, detail: number, textures: ArenaVfxTextures = {}) {
    this.budget = getArenaVfxBudget(detail);
    this.maxActive = this.budget.maxActive;
    this.textures = textures;
    const spriteCapacity = this.budget.maxSprites / this.budget.maxActive;
    this.slots = Array.from({ length: this.budget.maxActive }, () => {
      const group = new THREE.Group();
      group.visible = false;
      group.renderOrder = 3;
      const ring = new THREE.Mesh(
        this.ringGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      ring.rotation.x = Math.PI / 2;
      const core = new THREE.Mesh(
        this.coreGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      core.position.y = 0.7;
      const halo = new THREE.Mesh(
        this.haloGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, wireframe: true, blending: THREE.AdditiveBlending })
      );
      halo.position.y = 0.8;
      const beam = new THREE.Mesh(
        this.beamGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      beam.position.y = 1.3;
      beam.visible = false;
      const sprites = Array.from({ length: spriteCapacity }, () => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        sprite.visible = false;
        return sprite;
      });
      group.add(ring, core, halo, beam, ...sprites);
      scene.add(group);
      return {
        group,
        ring,
        core,
        halo,
        beam,
        sprites,
        startedAt: 0,
        lifetime: 1,
        radius: 1,
        kind: "impact" as const,
        category: "micro" as const,
        priority: 0,
        intensity: 1,
        spin: 0,
        active: false
      };
    });
  }

  setViewPosition(position?: { x: number; y?: number; z: number }) {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) {
      this.hasViewPosition = false;
      return;
    }
    this.viewPosition.set(position.x, position.y ?? 0, position.z);
    this.hasViewPosition = true;
  }

  emit(event: ArenaVfxEvent, at = nowMs()) {
    if (!Number.isFinite(event.x) || !Number.isFinite(event.z)) return false;
    const style = getArenaVfxStyle(event.kind);
    if (this.hasViewPosition && !event.local) {
      const distance = Math.hypot(event.x - this.viewPosition.x, event.z - this.viewPosition.z);
      if (distance > Math.min(this.budget.maxDistance, style.maxDistance)) {
        this.droppedCount += 1;
        return false;
      }
    }
    const slot = this.findSlot(style.priority + (event.local ? 2 : 0), at);
    if (!slot) {
      this.droppedCount += 1;
      return false;
    }
    if (slot.active) this.releaseSlot(slot);
    const [primaryKey, secondaryKey] = getArenaVfxTextureKeys(event, style);
    const color = this.colorScratch.set(getArenaVfxColor(event));
    const intensity = Math.max(0.35, Math.min(1.5, event.intensity ?? 1));
    slot.kind = event.kind;
    slot.category = style.category;
    slot.priority = style.priority + (event.local ? 2 : 0);
    slot.startedAt = at;
    slot.lifetime = style.lifetime;
    slot.radius = style.radius;
    slot.intensity = intensity;
    slot.spin = (this.cursor * 0.73) % (Math.PI * 2);
    slot.group.position.set(event.x, event.y ?? (event.kind === "footstep" ? 0.05 : 0.12), event.z);
    slot.group.scale.setScalar(1);
    slot.group.visible = true;
    slot.ring.visible = style.ringOpacity > 0;
    slot.beam.visible = Boolean(style.beam);
    slot.ring.material.color.copy(color);
    slot.core.material.color.copy(color);
    slot.halo.material.color.copy(color);
    slot.beam.material.color.copy(color);
    slot.core.position.y = event.kind === "footstep" ? 0.05 : 0.7;
    slot.halo.position.y = event.kind === "footstep" ? 0.05 : 0.8;
    slot.beam.position.y = style.beam ? Math.max(1, style.rise * 0.7) : 1.3;
    slot.sprites.forEach((sprite, index) => {
      const material = sprite.material;
      const key = index === 0 ? primaryKey : secondaryKey;
      const texture = key ? this.textures[key] : undefined;
      if (texture) {
        const needsMappedShader = material.map === null;
        material.map = texture;
        if (needsMappedShader) material.needsUpdate = true;
      }
      material.color.copy(color);
      material.opacity = 0;
      sprite.visible = Boolean(texture) && index < style.spriteCount;
      sprite.position.set(0, index * 0.24, 0);
      material.rotation = slot.spin + index * 1.8;
    });
    slot.active = true;
    this.activeEffects += 1;
    this.activeSprites += this.countVisibleSprites(slot);
    this.emittedCount += 1;
    this.cursor = (this.cursor + 1) % this.slots.length;
    return true;
  }

  update(at = nowMs()) {
    this.slots.forEach((slot) => {
      if (!slot.active) return;
      const progress = clamp01((at - slot.startedAt) / slot.lifetime);
      if (progress >= 1) {
        this.releaseSlot(slot);
        return;
      }
      const style = getArenaVfxStyle(slot.kind);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const fade = progress < 0.16 ? progress / 0.16 : 1 - Math.pow(progress, 1.5);
      const pulse = slot.kind === "shield" || slot.kind === "healing" || slot.kind === "objective_progress"
        ? 0.82 + Math.sin(progress * Math.PI * 4) * 0.12
        : 1;
      const scale = Math.max(0.01, slot.radius * (0.22 + easeOut * 0.78) * pulse * slot.intensity);
      slot.ring.scale.setScalar(scale);
      slot.ring.material.opacity = Math.max(0, fade) * style.ringOpacity * slot.intensity;
      slot.halo.scale.setScalar(scale * (0.55 + progress * 0.35));
      slot.halo.material.opacity = Math.max(0, fade) * style.haloOpacity * slot.intensity;
      slot.core.scale.setScalar(Math.max(0.02, scale * 0.22));
      slot.core.material.opacity = Math.max(0, fade) * 0.8 * slot.intensity;
      slot.core.position.y = (slot.kind === "footstep" ? 0.05 : 0.45) + easeOut * style.rise;
      slot.beam.visible = Boolean(style.beam) && progress < 0.86;
      slot.beam.scale.set(scale * 0.22, Math.max(0.06, (1 - progress) * (1.3 + style.rise * 1.7)), scale * 0.22);
      slot.beam.material.opacity = Math.max(0, fade) * 0.28 * slot.intensity;
      slot.sprites.forEach((sprite, index) => {
        if (!sprite.visible) return;
        const material = sprite.material;
        const drift = (index + 1) * 0.12 * easeOut;
        sprite.position.x = Math.sin(slot.spin + progress * 5 + index) * drift;
        sprite.position.y = (index === 0 ? 0.34 : 0.58) + easeOut * style.rise * (0.64 + index * 0.2);
        sprite.position.z = Math.cos(slot.spin + progress * 4 + index) * drift;
        const size = scale * (index === 0 ? 0.72 : 0.48) * (1 - progress * 0.12);
        sprite.scale.set(size, size, 1);
        material.rotation = slot.spin + progress * (index % 2 === 0 ? 3.2 : -2.4) + index * 1.8;
        material.opacity = Math.max(0, fade) * (index === 0 ? 0.72 : 0.5) * slot.intensity;
      });
    });
  }

  get activeCount() {
    return this.activeEffects;
  }

  get particleCount() {
    return this.activeSprites;
  }

  getStats(): ArenaVfxStats {
    return {
      active: this.activeEffects,
      sprites: this.activeSprites,
      emitted: this.emittedCount,
      dropped: this.droppedCount,
      budget: this.budget
    };
  }

  dispose() {
    this.slots.forEach((slot) => {
      this.scene.remove(slot.group);
      slot.ring.material.dispose();
      slot.core.material.dispose();
      slot.halo.material.dispose();
      slot.beam.material.dispose();
      slot.sprites.forEach((sprite) => sprite.material.dispose());
    });
    this.ringGeometry.dispose();
    this.coreGeometry.dispose();
    this.haloGeometry.dispose();
    this.beamGeometry.dispose();
    this.activeEffects = 0;
    this.activeSprites = 0;
  }

  private findSlot(incomingPriority: number, at: number) {
    // Always consume available capacity before considering an eviction. The
    // previous single pass could replace the cursor slot even when a later
    // slot was inactive, reducing the visible effect count below the budget.
    for (let offset = 0; offset < this.slots.length; offset += 1) {
      const candidate = this.slots[(this.cursor + offset) % this.slots.length];
      if (!candidate.active) return candidate;
    }
    let replacement: VfxSlot | undefined;
    for (const candidate of this.slots) {
      if (incomingPriority < candidate.priority) continue;
      if (!replacement
        || candidate.priority < replacement.priority
        || (candidate.priority === replacement.priority && candidate.startedAt < replacement.startedAt)) {
        replacement = candidate;
      }
    }
    return replacement;
  }

  private releaseSlot(slot: VfxSlot) {
    if (!slot.active) return;
    this.activeEffects = Math.max(0, this.activeEffects - 1);
    this.activeSprites = Math.max(0, this.activeSprites - this.countVisibleSprites(slot));
    slot.active = false;
    slot.group.visible = false;
    slot.beam.visible = false;
    slot.sprites.forEach((sprite) => {
      sprite.visible = false;
      sprite.material.opacity = 0;
    });
  }

  private countVisibleSprites(slot: VfxSlot) {
    let count = 0;
    for (const sprite of slot.sprites) if (sprite.visible) count += 1;
    return count;
  }
}
