import * as THREE from "three";
import type { Team } from "@quizstrike/shared";

/** Gameplay emits semantic cues; the renderer owns their visual treatment. */
export type ArenaVfxKind =
  | "weapon_fire" | "quick_fire" | "tracer" | "impact" | "snowball_impact" | "player_hit"
  | "hit_confirm" | "damage_taken" | "footstep" | "answer_incorrect"
  | "reward_burst" | "purchase" | "shield" | "objective" | "flag_pickup"
  | "spawn" | "elimination" | "victory" | "defeat" | "healing"
  | "flag_plant" | "flag_capture" | "objective_progress" | "round_start"
  | "round_end" | "heavy_fire" | "zoom" | "cooldown";

export type ArenaVfxSurface = "stone" | "metal" | "sand" | "dirt" | "grass" | "water" | "snow" | "player";
export type ArenaVfxAnchor = "world" | "ground" | "torso" | "head" | "muzzle";

export interface ArenaVfxEvent {
  kind: ArenaVfxKind;
  x: number;
  z: number;
  y?: number;
  team?: Team;
  color?: string;
  playerId?: string;
  /** The scene feature this cue follows when it belongs to a player. */
  anchor?: ArenaVfxAnchor;
  surface?: ArenaVfxSurface;
  /** Local feedback gets the highest admission priority and longest view range. */
  local?: boolean;
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
export type ArenaVfxProfile = "muzzle" | "quick_muzzle" | "tracer" | "impact" | "snow" | "hit" | "dust" | "feedback" | "reward" | "purchase" | "shield" | "objective" | "spawn" | "elimination" | "celebration" | "healing";

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
  profile: ArenaVfxProfile;
}

const vfxStyles: Record<ArenaVfxKind, ArenaVfxStyle> = {
  weapon_fire: { lifetime: 90, radius: 0.72, ringOpacity: 0, haloOpacity: 0, rise: 0.22, category: "micro", priority: 1, maxDistance: 92, spriteCount: 2, spriteKey: "muzzle", secondarySpriteKey: "smoke", profile: "muzzle" },
  quick_fire: { lifetime: 75, radius: 0.58, ringOpacity: 0, haloOpacity: 0, rise: 0.18, category: "micro", priority: 1, maxDistance: 92, spriteCount: 2, spriteKey: "muzzle", secondarySpriteKey: "spark", profile: "quick_muzzle" },
  tracer: { lifetime: 100, radius: 0.58, ringOpacity: 0, haloOpacity: 0, rise: 0.12, category: "micro", priority: 1, maxDistance: 110, spriteCount: 1, spriteKey: "trace", profile: "tracer" },
  impact: { lifetime: 300, radius: 1, ringOpacity: 0.2, haloOpacity: 0, rise: 0.62, category: "micro", priority: 2, maxDistance: 110, spriteCount: 4, spriteKey: "spark", secondarySpriteKey: "smoke", profile: "impact" },
  snowball_impact: { lifetime: 440, radius: 1.2, ringOpacity: 0.18, haloOpacity: 0.1, rise: 0.82, category: "micro", priority: 2, maxDistance: 110, spriteCount: 6, spriteKey: "snow", secondarySpriteKey: "spark", profile: "snow" },
  player_hit: { lifetime: 260, radius: 0.92, ringOpacity: 0.12, haloOpacity: 0, rise: 0.72, category: "micro", priority: 3, maxDistance: 125, spriteCount: 4, spriteKey: "spark", secondarySpriteKey: "circle", profile: "hit" },
  hit_confirm: { lifetime: 190, radius: 0.68, ringOpacity: 0, haloOpacity: 0, rise: 0.3, category: "micro", priority: 4, maxDistance: 150, spriteCount: 2, spriteKey: "star", secondarySpriteKey: "spark", profile: "hit" },
  damage_taken: { lifetime: 260, radius: 0.82, ringOpacity: 0, haloOpacity: 0, rise: 0.4, category: "micro", priority: 4, maxDistance: 150, spriteCount: 2, spriteKey: "circle", secondarySpriteKey: "spark", profile: "hit" },
  footstep: { lifetime: 280, radius: 0.5, ringOpacity: 0.08, haloOpacity: 0, rise: 0.2, category: "ambient", priority: 0, maxDistance: 38, spriteCount: 2, spriteKey: "smoke", profile: "dust" },
  answer_incorrect: { lifetime: 300, radius: 0.72, ringOpacity: 0.14, haloOpacity: 0, rise: 0.18, category: "player", priority: 3, maxDistance: 80, spriteCount: 1, spriteKey: "circle", profile: "feedback" },
  reward_burst: { lifetime: 720, radius: 1.55, ringOpacity: 0.34, haloOpacity: 0.14, rise: 1.55, category: "player", priority: 5, maxDistance: 150, spriteCount: 6, spriteKey: "star", secondarySpriteKey: "magic", profile: "reward" },
  purchase: { lifetime: 540, radius: 1.15, ringOpacity: 0.28, haloOpacity: 0.1, rise: 1.05, category: "player", priority: 4, maxDistance: 100, spriteCount: 4, spriteKey: "circle", secondarySpriteKey: "star", profile: "purchase" },
  shield: { lifetime: 650, radius: 1.5, ringOpacity: 0.34, haloOpacity: 0.18, rise: 1.05, category: "player", priority: 3, maxDistance: 125, spriteCount: 4, spriteKey: "circle", secondarySpriteKey: "spark", profile: "shield" },
  objective: { lifetime: 900, radius: 2.35, ringOpacity: 0.48, haloOpacity: 0.18, rise: 2.2, category: "objective", priority: 5, maxDistance: 220, spriteCount: 6, spriteKey: "circle", secondarySpriteKey: "star", beam: true, profile: "objective" },
  flag_pickup: { lifetime: 620, radius: 1.7, ringOpacity: 0.34, haloOpacity: 0.12, rise: 1.45, category: "objective", priority: 5, maxDistance: 220, spriteCount: 4, spriteKey: "magic", secondarySpriteKey: "star", profile: "objective" },
  spawn: { lifetime: 760, radius: 1.8, ringOpacity: 0.36, haloOpacity: 0.15, rise: 1.85, category: "player", priority: 4, maxDistance: 150, spriteCount: 6, spriteKey: "magic", secondarySpriteKey: "circle", beam: true, profile: "spawn" },
  elimination: { lifetime: 820, radius: 2.15, ringOpacity: 0.2, haloOpacity: 0.08, rise: 1.85, category: "player", priority: 5, maxDistance: 180, spriteCount: 6, spriteKey: "snow", secondarySpriteKey: "star", profile: "elimination" },
  victory: { lifetime: 1100, radius: 3.2, ringOpacity: 0.48, haloOpacity: 0.18, rise: 2.8, category: "round", priority: 7, maxDistance: 260, spriteCount: 6, spriteKey: "star", secondarySpriteKey: "magic", beam: true, profile: "celebration" },
  defeat: { lifetime: 900, radius: 2.6, ringOpacity: 0.3, haloOpacity: 0.12, rise: 1.4, category: "round", priority: 6, maxDistance: 220, spriteCount: 4, spriteKey: "smoke", secondarySpriteKey: "circle", profile: "celebration" },
  healing: { lifetime: 760, radius: 1.45, ringOpacity: 0.26, haloOpacity: 0.12, rise: 1.8, category: "player", priority: 4, maxDistance: 150, spriteCount: 5, spriteKey: "magic", secondarySpriteKey: "circle", profile: "healing" },
  flag_plant: { lifetime: 900, radius: 2.5, ringOpacity: 0.5, haloOpacity: 0.18, rise: 2.4, category: "objective", priority: 6, maxDistance: 240, spriteCount: 6, spriteKey: "circle", secondarySpriteKey: "magic", beam: true, profile: "objective" },
  flag_capture: { lifetime: 1100, radius: 3.4, ringOpacity: 0.58, haloOpacity: 0.2, rise: 3, category: "round", priority: 8, maxDistance: 280, spriteCount: 6, spriteKey: "star", secondarySpriteKey: "magic", beam: true, profile: "celebration" },
  objective_progress: { lifetime: 560, radius: 1.55, ringOpacity: 0.26, haloOpacity: 0.1, rise: 1.2, category: "objective", priority: 3, maxDistance: 180, spriteCount: 3, spriteKey: "circle", secondarySpriteKey: "magic", profile: "objective" },
  round_start: { lifetime: 1000, radius: 3.1, ringOpacity: 0.52, haloOpacity: 0.18, rise: 2.6, category: "round", priority: 8, maxDistance: 280, spriteCount: 6, spriteKey: "magic", secondarySpriteKey: "star", beam: true, profile: "celebration" },
  round_end: { lifetime: 1100, radius: 3.2, ringOpacity: 0.5, haloOpacity: 0.16, rise: 2.7, category: "round", priority: 8, maxDistance: 280, spriteCount: 6, spriteKey: "star", secondarySpriteKey: "magic", beam: true, profile: "celebration" },
  heavy_fire: { lifetime: 115, radius: 0.86, ringOpacity: 0, haloOpacity: 0, rise: 0.34, category: "micro", priority: 2, maxDistance: 110, spriteCount: 3, spriteKey: "muzzle", secondarySpriteKey: "smoke", profile: "muzzle" },
  zoom: { lifetime: 240, radius: 0.7, ringOpacity: 0, haloOpacity: 0, rise: 0.22, category: "player", priority: 1, maxDistance: 80, spriteCount: 1, spriteKey: "circle", profile: "feedback" },
  cooldown: { lifetime: 380, radius: 0.82, ringOpacity: 0.12, haloOpacity: 0, rise: 0.3, category: "micro", priority: 0, maxDistance: 80, spriteCount: 1, spriteKey: "circle", profile: "feedback" }
};

export const getArenaVfxStyle = (kind: ArenaVfxKind) => vfxStyles[kind];

export const getArenaWeaponVfxKind = (gearId?: string): "weapon_fire" | "quick_fire" | "heavy_fire" =>
  gearId === "power_blaster" ? "heavy_fire" : gearId === "quick_blaster" ? "quick_fire" : "weapon_fire";

/** Keeps gameplay code semantic: character sync resolves these to animated world positions. */
export const getArenaVfxAnchor = (event: Pick<ArenaVfxEvent, "kind" | "anchor">): ArenaVfxAnchor => event.anchor ?? (
  event.kind === "weapon_fire" || event.kind === "quick_fire" || event.kind === "heavy_fire" || event.kind === "tracer" ? "muzzle"
    : event.kind === "impact" ? "world"
      : event.kind === "snowball_impact" || event.kind === "player_hit" || event.kind === "hit_confirm" || event.kind === "damage_taken" || event.kind === "shield" || event.kind === "answer_incorrect" || event.kind === "zoom" || event.kind === "cooldown" ? "torso"
        : "ground"
);
const teamColor = (team?: Team) => team === "red" ? "#fb7185" : "#38bdf8";

export const getArenaVfxColor = (event: ArenaVfxEvent) => event.color ?? (
  event.kind === "weapon_fire" || event.kind === "heavy_fire" || event.kind === "tracer" ? "#b9f4ff"
    : event.kind === "quick_fire" ? "#fef08a"
    : event.kind === "defeat" || event.kind === "damage_taken" || event.kind === "answer_incorrect" ? "#fb7185"
    : event.kind === "reward_burst" || event.kind === "purchase" || event.kind === "round_end" ? "#facc15"
    : event.kind === "victory" ? (event.team ? teamColor(event.team) : "#facc15")
    : event.kind === "healing" || event.kind === "spawn" ? "#5eead4"
    : event.kind === "flag_plant" || event.kind === "flag_capture" || event.kind === "flag_pickup" || event.kind === "objective" || event.kind === "objective_progress" || event.kind === "round_start" ? teamColor(event.team)
    : event.kind === "cooldown" ? "#f59e0b"
    : event.kind === "shield" ? "#67e8f9"
    : event.kind === "snowball_impact" || event.surface === "snow" ? "#e0f2fe"
    : event.surface === "water" ? "#7dd3fc"
    : event.surface === "metal" ? "#dbeafe"
    : event.surface === "stone" ? "#cbd5e1"
    : event.surface === "sand" ? "#d6b77a"
    : event.surface === "dirt" ? "#b98b60"
    : event.surface === "grass" ? "#86efac"
    : teamColor(event.team)
);

const nowMs = () => typeof performance !== "undefined" ? performance.now() : Date.now();
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_SPRITES_PER_EFFECT = 6;
type ParticleMotion = "flash" | "ballistic" | "rise" | "orbit" | "converge" | "static";

interface VfxParticle {
  sprite: THREE.Sprite;
  motion: ParticleMotion;
  originX: number;
  originY: number;
  originZ: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  gravity: number;
  orbitRadius: number;
  angle: number;
  startSize: number;
  endSize: number;
  stretchX: number;
  stretchY: number;
  delay: number;
  spin: number;
  opacity: number;
}

interface VfxSlot {
  group: THREE.Group;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  echoRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  particles: VfxParticle[];
  startedAt: number;
  lifetime: number;
  radius: number;
  kind: ArenaVfxKind;
  category: ArenaVfxCategory;
  priority: number;
  intensity: number;
  seedAngle: number;
  active: boolean;
}

export interface ArenaVfxBudget { maxActive: number; maxSprites: number; maxDistance: number; }
export interface ArenaVfxStats { active: number; sprites: number; emitted: number; dropped: number; budget: ArenaVfxBudget; }

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
  if (event.kind === "impact" && (event.surface === "sand" || event.surface === "stone" || event.surface === "dirt")) return ["smoke", "spark"];
  if (event.kind === "impact" && event.surface === "water") return ["circle", "magic"];
  if (event.kind === "impact" && event.surface === "snow") return ["snow", "spark"];
  return [style.spriteKey, style.secondarySpriteKey];
};

const usesNormalBlending = (key?: ArenaVfxTextureKey) => key === "smoke" || key === "snow";

export class ArenaVfxPool {
  private readonly slots: VfxSlot[];
  private budget: ArenaVfxBudget;
  private readonly textures: ArenaVfxTextures;
  private readonly ringGeometry = new THREE.TorusGeometry(1, 0.045, 6, 28);
  private readonly beamGeometry = new THREE.CylinderGeometry(0.22, 0.42, 1, 12, 1, true);
  private readonly viewPosition = new THREE.Vector3();
  private readonly colorScratch = new THREE.Color();
  private cursor = 0;
  private activeEffects = 0;
  private activeSprites = 0;
  private emittedCount = 0;
  private droppedCount = 0;
  private hasViewPosition = false;

  constructor(private readonly scene: THREE.Scene, detail: number, textures: ArenaVfxTextures = {}) {
    this.budget = getArenaVfxBudget(detail);
    this.textures = textures;
    this.slots = Array.from({ length: this.budget.maxActive }, () => {
      const group = new THREE.Group();
      group.visible = false;
      group.renderOrder = 3;
      const makeRing = () => {
        const ring = new THREE.Mesh(
          this.ringGeometry,
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.04;
        return ring;
      };
      const ring = makeRing();
      const echoRing = makeRing();
      const beam = new THREE.Mesh(
        this.beamGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
      );
      beam.visible = false;
      const particles = Array.from({ length: MAX_SPRITES_PER_EFFECT }, () => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        sprite.visible = false;
        return {
          sprite,
          motion: "static" as ParticleMotion,
          originX: 0, originY: 0, originZ: 0,
          velocityX: 0, velocityY: 0, velocityZ: 0,
          gravity: 0, orbitRadius: 0, angle: 0,
          startSize: 0.2, endSize: 0.1,
          stretchX: 1, stretchY: 1,
          delay: 0, spin: 0, opacity: 0.7
        };
      });
      group.add(ring, echoRing, beam, ...particles.map((particle) => particle.sprite));
      scene.add(group);
      return {
        group, ring, echoRing, beam, particles,
        startedAt: 0, lifetime: 1, radius: 1,
        kind: "impact" as const,
        category: "micro" as const,
        priority: 0, intensity: 1, seedAngle: 0, active: false
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
    const slot = this.findSlot(style.priority + (event.local ? 2 : 0));
    if (!slot) {
      this.droppedCount += 1;
      return false;
    }
    if (slot.active) this.releaseSlot(slot);

    const [primaryKey, secondaryKey] = getArenaVfxTextureKeys(event, style);
    const color = this.colorScratch.set(getArenaVfxColor(event));
    const intensity = Math.max(0.35, Math.min(1.35, event.intensity ?? 1));
    slot.kind = event.kind;
    slot.category = style.category;
    slot.priority = style.priority + (event.local ? 2 : 0);
    slot.startedAt = at;
    slot.lifetime = style.lifetime;
    slot.radius = style.radius;
    slot.intensity = intensity;
    slot.seedAngle = (this.cursor * 1.137) % (Math.PI * 2);
    slot.group.position.set(event.x, event.y ?? (event.kind === "footstep" ? 0.04 : 0.12), event.z);
    slot.group.visible = true;
    slot.ring.visible = style.ringOpacity > 0;
    slot.echoRing.visible = style.haloOpacity > 0;
    slot.beam.visible = Boolean(style.beam);
    slot.ring.material.color.copy(color);
    slot.echoRing.material.color.copy(color);
    slot.beam.material.color.copy(color);
    slot.ring.material.opacity = 0;
    slot.echoRing.material.opacity = 0;
    slot.beam.material.opacity = 0;

    const availableSprites = Math.max(0, this.budget.maxSprites - this.activeSprites);
    const spriteCount = Math.min(style.spriteCount, slot.particles.length, availableSprites);
    slot.particles.forEach((particle, index) => {
      const key = index % 2 === 0 ? primaryKey : (secondaryKey ?? primaryKey);
      const texture = key ? this.textures[key] : undefined;
      const material = particle.sprite.material;
      const blending = usesNormalBlending(key) ? THREE.NormalBlending : THREE.AdditiveBlending;
      if (material.map !== texture || material.blending !== blending) {
        material.map = texture ?? null;
        material.blending = blending;
        material.needsUpdate = true;
      }
      material.color.copy(color);
      material.opacity = 0;
      material.rotation = slot.seedAngle + index * 0.7;
      particle.sprite.visible = Boolean(texture) && index < spriteCount;
      this.configureParticle(particle, style.profile, index, slot.seedAngle, style.radius);
    });

    slot.active = true;
    this.activeEffects += 1;
    this.activeSprites += this.countVisibleSprites(slot);
    this.emittedCount += 1;
    this.cursor = (this.cursor + 1) % Math.max(1, Math.min(this.budget.maxActive, this.slots.length));
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
      const ringFade = Math.pow(1 - progress, 1.7);
      const ringScale = Math.max(0.02, slot.radius * (0.16 + easeOut * 0.84) * slot.intensity);
      slot.ring.scale.setScalar(ringScale);
      slot.ring.material.opacity = ringFade * style.ringOpacity * slot.intensity;

      const echoProgress = clamp01((progress - 0.12) / 0.88);
      const echoScale = Math.max(0.02, slot.radius * (0.1 + (1 - Math.pow(1 - echoProgress, 2)) * 0.72) * slot.intensity);
      slot.echoRing.scale.setScalar(echoScale);
      slot.echoRing.material.opacity = echoProgress > 0 ? Math.pow(1 - echoProgress, 2) * style.haloOpacity * slot.intensity : 0;

      if (style.beam) {
        const beamHeight = Math.max(1.2, style.rise * 1.7) * (0.82 + Math.sin(progress * Math.PI) * 0.18);
        const beamRadius = Math.min(0.42, 0.12 + slot.radius * 0.045) * (1 - progress * 0.35) * slot.intensity;
        slot.beam.visible = progress < 0.86;
        slot.beam.position.y = beamHeight / 2;
        slot.beam.scale.set(beamRadius, beamHeight, beamRadius);
        slot.beam.material.opacity = Math.sin(Math.min(1, progress / 0.16) * Math.PI / 2) * Math.pow(1 - progress, 1.4) * 0.2 * slot.intensity;
      }

      slot.particles.forEach((particle) => this.updateParticle(particle, progress, slot.lifetime, slot.intensity));
    });
  }

  get activeCount() { return this.activeEffects; }
  get particleCount() { return this.activeSprites; }
  get maxActive() { return this.budget.maxActive; }

  getStats(): ArenaVfxStats {
    return { active: this.activeEffects, sprites: this.activeSprites, emitted: this.emittedCount, dropped: this.droppedCount, budget: this.budget };
  }

  /** Clear round-scoped effects while retaining the pool's GPU resources. */
  reset() {
    this.slots.forEach((slot) => this.releaseSlot(slot));
    this.cursor = 0;
    this.hasViewPosition = false;
  }

  /** Change transient effect detail without reallocating the pool. */
  setDetail(detail: number) {
    const requested = getArenaVfxBudget(detail);
    const nextBudget = {
      ...requested,
      maxActive: Math.min(requested.maxActive, this.slots.length)
    };
    if (
      nextBudget.maxActive === this.budget.maxActive
      && nextBudget.maxSprites === this.budget.maxSprites
      && nextBudget.maxDistance === this.budget.maxDistance
    ) return;
    this.reset();
    this.budget = nextBudget;
  }

  dispose() {
    this.slots.forEach((slot) => {
      this.scene.remove(slot.group);
      slot.ring.material.dispose();
      slot.echoRing.material.dispose();
      slot.beam.material.dispose();
      slot.particles.forEach((particle) => particle.sprite.material.dispose());
    });
    this.ringGeometry.dispose();
    this.beamGeometry.dispose();
    this.activeEffects = 0;
    this.activeSprites = 0;
  }

  private configureParticle(particle: VfxParticle, profile: ArenaVfxProfile, index: number, seedAngle: number, radius: number) {
    const angle = seedAngle + index * GOLDEN_ANGLE;
    const jitter = ((index * 37 + this.cursor * 23) % 101) / 100;
    const radialX = Math.cos(angle);
    const radialZ = Math.sin(angle);
    Object.assign(particle, {
      motion: "static" as ParticleMotion,
      originX: 0, originY: 0.24, originZ: 0,
      velocityX: 0, velocityY: 0, velocityZ: 0,
      gravity: 0, orbitRadius: 0, angle,
      startSize: 0.2, endSize: 0.08,
      stretchX: 1, stretchY: 1,
      delay: 0,
      spin: (index % 2 === 0 ? 1 : -1) * (0.8 + jitter),
      opacity: 0.72
    });

    switch (profile) {
      case "muzzle":
        if (index === 0) Object.assign(particle, { motion: "flash", originY: 0, startSize: 0.12, endSize: radius * 0.82, stretchX: 1.18, stretchY: 0.86, opacity: 0.92, spin: 1.8 });
        else Object.assign(particle, { motion: "rise", originY: 0, velocityX: radialX * 0.12, velocityY: 0.8, velocityZ: radialZ * 0.12, startSize: 0.18, endSize: 0.42, delay: 0.08, opacity: 0.3, spin: 0.45 });
        break;
      case "quick_muzzle":
        if (index === 0) Object.assign(particle, { motion: "flash", originY: 0, startSize: 0.08, endSize: radius * 0.62, stretchX: 1.45, stretchY: 0.72, opacity: 0.98, spin: -2.2 });
        else Object.assign(particle, { motion: "rise", originY: 0, velocityX: radialX * 0.16, velocityY: 0.56, velocityZ: radialZ * 0.16, startSize: 0.12, endSize: 0.26, delay: 0.04, opacity: 0.42, spin: -0.8 });
        break;
      case "tracer":
        Object.assign(particle, { motion: "flash", originY: 0, startSize: 0.08, endSize: radius, stretchX: 0.15, stretchY: 1.5, opacity: 0.8, spin: 0 });
        break;
      case "impact":
        if (index % 2 === 0) Object.assign(particle, { motion: "ballistic", originY: 0.08, velocityX: radialX * (1.6 + jitter * 0.9), velocityY: 0.9 + jitter * 0.7, velocityZ: radialZ * (1.6 + jitter * 0.9), gravity: 3.2, startSize: 0.24, endSize: 0.04, stretchX: 0.62, stretchY: 1.35, delay: index * 0.012, opacity: 0.86, spin: 3.4 });
        else Object.assign(particle, { motion: "rise", originY: 0.04, velocityX: radialX * 0.18, velocityY: 0.72, velocityZ: radialZ * 0.18, startSize: 0.2, endSize: 0.5, delay: 0.03, opacity: 0.32, spin: 0.35 });
        break;
      case "snow":
        Object.assign(particle, { motion: "ballistic", originX: radialX * 0.12, originY: 0, originZ: radialZ * 0.12, velocityX: radialX * (1.1 + jitter), velocityY: 1.35 + jitter * 1.1, velocityZ: radialZ * (1.1 + jitter), gravity: 2.8, startSize: 0.24 + jitter * 0.1, endSize: 0.09, delay: index * 0.018, opacity: 0.82, spin: 1.4 });
        break;
      case "hit":
        if (index === 0) Object.assign(particle, { motion: "flash", originY: 0, startSize: 0.12, endSize: 0.8, opacity: 1.12, spin: 1.4 });
        else Object.assign(particle, { motion: "ballistic", originY: 0, velocityX: radialX * (1.45 + jitter), velocityY: 0.65 + jitter * 0.8, velocityZ: radialZ * (1.45 + jitter), gravity: 1.8, startSize: 0.2, endSize: 0.04, stretchX: 0.68, stretchY: 1.25, delay: index * 0.012, opacity: 0.92, spin: 3.2 });
        break;
      case "dust":
        Object.assign(particle, { motion: "rise", originX: radialX * radius * 0.2, originY: 0.03, originZ: radialZ * radius * 0.2, velocityX: radialX * 0.16, velocityY: 0.24 + jitter * 0.16, velocityZ: radialZ * 0.16, startSize: 0.16, endSize: 0.4, delay: index * 0.06, opacity: 0.24, spin: 0.5 });
        break;
      case "feedback":
        Object.assign(particle, { motion: "flash", originY: 0, startSize: 0.08, endSize: radius * 0.52, opacity: 0.46, spin: 0.6 });
        break;
      case "reward":
        Object.assign(particle, { motion: "ballistic", originX: radialX * 0.2, originY: 0.65, originZ: radialZ * 0.2, velocityX: radialX * (0.5 + jitter * 0.65), velocityY: 2.5 + jitter, velocityZ: radialZ * (0.5 + jitter * 0.65), gravity: 2, startSize: 0.2 + jitter * 0.08, endSize: 0.08, delay: index * 0.045, opacity: 0.82, spin: 2.2 });
        break;
      case "purchase":
        Object.assign(particle, { motion: "orbit", originY: 0.6 + index * 0.22, orbitRadius: radius * (0.55 + jitter * 0.2), velocityY: 1.8, startSize: 0.18, endSize: 0.08, delay: index * 0.045, opacity: 0.72, spin: 3.4 });
        break;
      case "shield":
        Object.assign(particle, { motion: "orbit", originY: -1.05 + (index % 3) * 1.05, orbitRadius: radius * 0.52, velocityY: 0.2, startSize: 0.2, endSize: 0.14, delay: index * 0.025, opacity: 0.55, spin: index % 2 === 0 ? 3 : -3 });
        break;
      case "objective":
        Object.assign(particle, { motion: "rise", originX: radialX * radius * 0.28, originY: 0.12, originZ: radialZ * radius * 0.28, velocityX: radialX * 0.08, velocityY: 1 + jitter * 0.72, velocityZ: radialZ * 0.08, startSize: 0.2, endSize: 0.1, delay: index * 0.055, opacity: 0.72, spin: 1.6 });
        break;
      case "spawn":
        Object.assign(particle, { motion: "converge", originY: 0.08, orbitRadius: radius * (0.55 + jitter * 0.18), velocityY: 3.5, startSize: 0.2, endSize: 0.08, delay: index * 0.04, opacity: 0.68, spin: index % 2 === 0 ? 2.5 : -2.5 });
        break;
      case "elimination":
        Object.assign(particle, { motion: "ballistic", originX: radialX * 0.18, originY: 2, originZ: radialZ * 0.18, velocityX: radialX * (1.35 + jitter * 1.45), velocityY: 2.1 + jitter * 1.6, velocityZ: radialZ * (1.35 + jitter * 1.45), gravity: 3.6, startSize: 0.28, endSize: 0.08, delay: index * 0.025, opacity: 0.82, spin: 2.8 });
        break;
      case "celebration":
        Object.assign(particle, { motion: "ballistic", originX: radialX * radius * 0.12, originY: 0.18, originZ: radialZ * radius * 0.12, velocityX: radialX * (0.85 + jitter), velocityY: 3.4 + jitter * 1.7, velocityZ: radialZ * (0.85 + jitter), gravity: 3.5, startSize: 0.24 + jitter * 0.08, endSize: 0.08, delay: index * 0.055, opacity: 0.82, spin: 3.1 });
        break;
      case "healing":
        Object.assign(particle, { motion: "orbit", originY: 0.35 + index * 0.2, orbitRadius: radius * (0.38 + jitter * 0.14), velocityY: 3.1, startSize: 0.18, endSize: 0.08, delay: index * 0.045, opacity: 0.68, spin: index % 2 === 0 ? 2.4 : -2.4 });
        break;
    }
    const sizeMultiplier = profile === "muzzle" || profile === "quick_muzzle" || profile === "tracer" ? 2
      : profile === "dust" ? 2.2
        : profile === "impact" || profile === "snow" || profile === "hit" ? 4
          : profile === "elimination" || profile === "celebration" ? 3.5
            : 3;
    particle.startSize *= sizeMultiplier;
    particle.endSize *= sizeMultiplier;
    particle.sprite.position.set(particle.originX, particle.originY, particle.originZ);
    particle.sprite.scale.set(0.01, 0.01, 1);
  }

  private updateParticle(particle: VfxParticle, progress: number, lifetime: number, intensity: number) {
    if (!particle.sprite.visible) return;
    const localProgress = clamp01((progress - particle.delay) / Math.max(0.01, 1 - particle.delay));
    const material = particle.sprite.material;
    if (localProgress <= 0) {
      material.opacity = 0;
      return;
    }
    const seconds = localProgress * lifetime / 1000;
    const easeOut = 1 - Math.pow(1 - localProgress, 3);
    let x = particle.originX;
    let y = particle.originY;
    let z = particle.originZ;
    if (particle.motion === "ballistic") {
      x += particle.velocityX * seconds;
      y += particle.velocityY * seconds - particle.gravity * seconds * seconds * 0.5;
      z += particle.velocityZ * seconds;
    } else if (particle.motion === "rise") {
      x += particle.velocityX * seconds;
      y += particle.velocityY * seconds;
      z += particle.velocityZ * seconds;
    } else if (particle.motion === "orbit" || particle.motion === "converge") {
      const convergence = particle.motion === "converge" ? 1 - easeOut * 0.88 : 1 - easeOut * 0.34;
      const orbitAngle = particle.angle + particle.spin * localProgress;
      x = Math.cos(orbitAngle) * particle.orbitRadius * convergence;
      z = Math.sin(orbitAngle) * particle.orbitRadius * convergence;
      y += particle.velocityY * localProgress;
    }
    particle.sprite.position.set(x, y, z);

    const baseSize = particle.motion === "flash"
      ? particle.startSize + Math.sin(localProgress * Math.PI) * particle.endSize
      : mix(particle.startSize, particle.endSize, easeOut);
    const size = Math.max(0.01, baseSize * intensity);
    particle.sprite.scale.set(size * particle.stretchX, size * particle.stretchY, 1);
    material.rotation = particle.angle + particle.spin * localProgress;
    const fadeIn = Math.min(1, localProgress / 0.1);
    const fadeOut = particle.motion === "flash" ? Math.pow(1 - localProgress, 1.5) : Math.pow(1 - localProgress, 1.1);
    material.opacity = fadeIn * fadeOut * particle.opacity * intensity;
  }

  private findSlot(incomingPriority: number) {
    const slotCount = Math.min(this.budget.maxActive, this.slots.length);
    if (slotCount === 0) return undefined;
    for (let offset = 0; offset < slotCount; offset += 1) {
      const candidate = this.slots[(this.cursor + offset) % slotCount];
      if (!candidate.active) return candidate;
    }
    let replacement: VfxSlot | undefined;
    for (let index = 0; index < slotCount; index += 1) {
      const candidate = this.slots[index]!;
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
    slot.particles.forEach((particle) => {
      particle.sprite.visible = false;
      particle.sprite.material.opacity = 0;
    });
  }

  private countVisibleSprites(slot: VfxSlot) {
    let count = 0;
    for (const particle of slot.particles) if (particle.sprite.visible) count += 1;
    return count;
  }
}
