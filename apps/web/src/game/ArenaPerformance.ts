import type * as THREE from "three";

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
  geometries: number;
  heapMb?: number;
  quality: string;
}

declare global {
  interface Window {
    __quizstrikeArenaProfile?: ArenaPerformanceSnapshot;
  }
}

const percentile = (sorted: number[], ratio: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
const FRAME_SAMPLE_LIMIT = 600;

export class ArenaPerformanceCapture {
  private readonly frameTimes = new Array<number>(FRAME_SAMPLE_LIMIT);
  private frameCount = 0;
  private frameCursor = 0;
  private lastFrameAt = performance.now();
  private longTasks = 0;
  private longestTaskMs = 0;
  private observer?: PerformanceObserver;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly quality: string) {
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
      geometries: this.renderer.info.memory.geometries,
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

export type AdaptiveArenaQuality = "performance" | "balanced" | "high";
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
