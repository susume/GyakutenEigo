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

  snapshot(now = performance.now()): ArenaPerformanceSnapshot {
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
