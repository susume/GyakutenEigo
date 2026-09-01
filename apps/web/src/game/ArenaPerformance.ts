import * as THREE from "three";

export interface ArenaPerformanceSnapshot {
  sampleSeconds: number;
  frames: number;
  fps: number;
  frameMsP50: number;
  frameMsP95: number;
  frameMsP99: number;
  worstFrameMs: number;
  longTasks: number;
  longestTaskMs: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  /** Conservative decoded RGBA estimate for textures reachable from scene materials. */
  textureMb?: number;
  geometries: number;
  shadowCasters: number;
  heapMb?: number;
  quality: string;
}

export type AdaptiveArenaQuality = "performance" | "balanced" | "high";

/**
 * Runtime guardrails for a complete arena frame. Environment kits carry a
 * smaller scene-only budget; these limits include characters, HUD-facing VFX,
 * and the active course as well.
 */
export type ArenaRenderBudget = {
  targetFps: number;
  maxFrameMsP95: number;
  maxDrawCalls: number;
  maxTriangles: number;
  maxTextureMb: number;
  maxShadowCasters: number;
  maxActiveParticles: number;
};

export const ARENA_RENDER_BUDGETS: Record<AdaptiveArenaQuality, ArenaRenderBudget> = {
  performance: {
    targetFps: 45,
    maxFrameMsP95: 26,
    maxDrawCalls: 1_250,
    maxTriangles: 500_000,
    maxTextureMb: 24,
    maxShadowCasters: 96,
    maxActiveParticles: 24
  },
  balanced: {
    targetFps: 55,
    maxFrameMsP95: 24,
    maxDrawCalls: 1_600,
    maxTriangles: 800_000,
    maxTextureMb: 32,
    maxShadowCasters: 224,
    maxActiveParticles: 48
  },
  high: {
    targetFps: 55,
    maxFrameMsP95: 24,
    maxDrawCalls: 2_000,
    maxTriangles: 1_100_000,
    maxTextureMb: 48,
    maxShadowCasters: 256,
    maxActiveParticles: 64
  }
};

export type ArenaBudgetSample = Pick<ArenaPerformanceSnapshot, "fps" | "frameMsP95" | "drawCalls" | "triangles" | "textureMb" | "shadowCasters"> & {
  activeParticles: number;
};

export type ArenaBudgetEvaluation = {
  withinBudget: boolean;
  violations: string[];
};

export const getArenaRenderBudget = (quality: AdaptiveArenaQuality) => ARENA_RENDER_BUDGETS[quality];

export const evaluateArenaBudget = (
  sample: ArenaBudgetSample,
  budget: ArenaRenderBudget
): ArenaBudgetEvaluation => {
  const violations: string[] = [];
  if (sample.fps < budget.targetFps) violations.push("fps");
  if (sample.frameMsP95 > budget.maxFrameMsP95) violations.push("frame-p95");
  if (sample.drawCalls > budget.maxDrawCalls) violations.push("draw-calls");
  if (sample.triangles > budget.maxTriangles) violations.push("triangles");
  if (sample.textureMb !== undefined && sample.textureMb > budget.maxTextureMb) violations.push("textures");
  if (sample.shadowCasters > budget.maxShadowCasters) violations.push("shadow-casters");
  if (sample.activeParticles > budget.maxActiveParticles) violations.push("particles");
  return { withinBudget: violations.length === 0, violations };
};

declare global {
  interface Window {
    __quizstrikeArenaProfile?: ArenaPerformanceSnapshot;
  }
}

const percentile = (sorted: number[], ratio: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
const FRAME_SAMPLE_LIMIT = 600;

const textureBytesPerPixel = (texture: THREE.Texture) => {
  if (texture instanceof THREE.CompressedTexture) return 1;
  if (texture.format === THREE.RedFormat) return 1;
  if (texture.format === THREE.RGFormat) return 2;
  if (texture.format === THREE.RGBFormat) return 3;
  return 4;
};

/**
 * Estimates decoded texture memory without pretending that WebGL exposes the
 * driver's real allocation. Shared maps are counted once and mipmaps use the
 * usual 4/3 multiplier when Three.js generates them.
 */
export const estimateSceneTextureBytes = (scene: THREE.Object3D) => {
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (!material) return;
      Object.values(material as THREE.Material & Record<string, unknown>).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });

  let bytes = 0;
  textures.forEach((texture) => {
    const image = texture.image as { width?: number; height?: number; data?: { byteLength?: number } } | undefined;
    const width = image?.width ?? 0;
    const height = image?.height ?? 0;
    const sourceBytes = image?.data?.byteLength;
    const baseBytes = sourceBytes && sourceBytes > 0
      ? sourceBytes
      : width > 0 && height > 0
        ? width * height * textureBytesPerPixel(texture)
        : 0;
    bytes += baseBytes * (texture.generateMipmaps ? 4 / 3 : 1);
  });
  return Math.round(bytes);
};

export const estimateSceneTextureMb = (scene: THREE.Object3D) =>
  Number((estimateSceneTextureBytes(scene) / 1048576).toFixed(1));

export class ArenaPerformanceCapture {
  private readonly frameTimes = new Array<number>(FRAME_SAMPLE_LIMIT);
  private frameCount = 0;
  private frameCursor = 0;
  private lastFrameAt = performance.now();
  private longTasks = 0;
  private longestTaskMs = 0;
  private observer?: PerformanceObserver;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly quality: string,
    private readonly scene?: THREE.Scene
  ) {
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      this.observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.longTasks += 1;
          this.longestTaskMs = Math.max(this.longestTaskMs, entry.duration);
        });
      });
      this.observer.observe({ type: "longtask", buffered: true });
    }
  }

  frame(now = performance.now()) {
    const duration = now - this.lastFrameAt;
    this.lastFrameAt = now;
    if (duration <= 0 || duration >= 1000) return;
    this.frameTimes[this.frameCursor] = duration;
    this.frameCursor = (this.frameCursor + 1) % FRAME_SAMPLE_LIMIT;
    this.frameCount = Math.min(FRAME_SAMPLE_LIMIT, this.frameCount + 1);
  }

  snapshot(_now = performance.now()): ArenaPerformanceSnapshot {
    const sorted = this.frameTimes.slice(0, this.frameCount).sort((a, b) => a - b);
    const seconds = Math.max(0.001, sorted.reduce((total, duration) => total + duration, 0) / 1000);
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    let shadowCasters = 0;
    if (this.renderer.shadowMap.enabled) {
      this.scene?.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh && mesh.castShadow) shadowCasters += 1;
      });
    }
    const snapshot: ArenaPerformanceSnapshot = {
      sampleSeconds: Number(seconds.toFixed(1)),
      frames: sorted.length,
      fps: Math.round(sorted.length / seconds),
      frameMsP50: Number(percentile(sorted, 0.5).toFixed(2)),
      frameMsP95: Number(percentile(sorted, 0.95).toFixed(2)),
      frameMsP99: Number(percentile(sorted, 0.99).toFixed(2)),
      worstFrameMs: Number((sorted.at(-1) ?? 0).toFixed(2)),
      longTasks: this.longTasks,
      longestTaskMs: Number(this.longestTaskMs.toFixed(1)),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      textures: this.renderer.info.memory.textures,
      textureMb: this.scene ? estimateSceneTextureMb(this.scene) : undefined,
      geometries: this.renderer.info.memory.geometries,
      shadowCasters,
      heapMb: memory.memory ? Number((memory.memory.usedJSHeapSize / 1048576).toFixed(1)) : undefined,
      quality: this.quality
    };
    window.__quizstrikeArenaProfile = snapshot;
    return snapshot;
  }

  dispose() {
    this.observer?.disconnect();
  }
}

export type QualityAdjustmentDirection = "lower" | "raise";
export type QualityAdjustment = {
  quality: AdaptiveArenaQuality;
  direction: QualityAdjustmentDirection;
};

const QUALITY_ORDER: AdaptiveArenaQuality[] = ["performance", "balanced", "high"];

/**
 * Uses sustained in-game frame samples with hysteresis. It deliberately does
 * not react to one slow frame or one loading spike.
 */
export class AutoGraphicsQualityController {
  private poorSamples = 0;
  private excellentSamples = 0;
  private lastChangeAt = Number.NEGATIVE_INFINITY;

  constructor(
    private currentQuality: AdaptiveArenaQuality,
    private readonly options: {
      poorSampleCount?: number;
      excellentSampleCount?: number;
      cooldownMs?: number;
      poorFps?: number;
      poorP95Ms?: number;
      excellentFps?: number;
      excellentP95Ms?: number;
    } = {}
  ) {}

  get quality() {
    return this.currentQuality;
  }

  update(snapshot: Pick<ArenaPerformanceSnapshot, "frames" | "sampleSeconds" | "fps" | "frameMsP95">, nowMs = performance.now()): QualityAdjustment | undefined {
    if (
      snapshot.frames < 30
      || snapshot.sampleSeconds < 0.75
      || !Number.isFinite(snapshot.fps)
      || !Number.isFinite(snapshot.frameMsP95)
    ) return undefined;

    const poor = snapshot.fps < (this.options.poorFps ?? 38) || snapshot.frameMsP95 > (this.options.poorP95Ms ?? 28);
    const excellent = snapshot.fps >= (this.options.excellentFps ?? 57) && snapshot.frameMsP95 <= (this.options.excellentP95Ms ?? 18);
    this.poorSamples = poor ? this.poorSamples + 1 : 0;
    this.excellentSamples = excellent ? this.excellentSamples + 1 : 0;
    if (nowMs - this.lastChangeAt < (this.options.cooldownMs ?? 20_000)) return undefined;

    if (this.poorSamples >= (this.options.poorSampleCount ?? 3)) {
      const index = QUALITY_ORDER.indexOf(this.currentQuality);
      if (index > 0) {
        this.currentQuality = QUALITY_ORDER[index - 1]!;
        this.lastChangeAt = nowMs;
        this.poorSamples = 0;
        this.excellentSamples = 0;
        return { quality: this.currentQuality, direction: "lower" };
      }
    }
    if (this.excellentSamples >= (this.options.excellentSampleCount ?? 8)) {
      const index = QUALITY_ORDER.indexOf(this.currentQuality);
      if (index < QUALITY_ORDER.length - 1) {
        this.currentQuality = QUALITY_ORDER[index + 1]!;
        this.lastChangeAt = nowMs;
        this.poorSamples = 0;
        this.excellentSamples = 0;
        return { quality: this.currentQuality, direction: "raise" };
      }
    }
    return undefined;
  }
}
