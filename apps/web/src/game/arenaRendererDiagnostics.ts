import * as THREE from "three";

export type ArenaRendererDiagnosticsSnapshot = {
  rendererInstanceId: string;
  rendererCreateCount: number;
  rendererDisposeCount: number;
  webglContextLostCount: number;
  webglContextRestoreCount: number;
  currentRound?: number;
  playerCount: number;
  graphicsQuality: string;
};

export type ArenaRendererDiagnosticsHandle = {
  snapshot: () => ArenaRendererDiagnosticsSnapshot;
  update: (values: Partial<Pick<ArenaRendererDiagnosticsSnapshot, "currentRound" | "playerCount" | "graphicsQuality">>) => void;
  contextLost: (metrics: { geometries: number; textures: number; drawCalls: number; triangles: number; devicePixelRatio: number; canvasWidth: number; canvasHeight: number }) => void;
  contextRestored: () => void;
  dispose: () => void;
};

declare global {
  interface Window {
    __quizstrikeArenaRenderer?: ArenaRendererDiagnosticsSnapshot;
  }
}

let nextRendererInstanceId = 0;
let rendererCreateCount = 0;
let rendererDisposeCount = 0;
let webglContextLostCount = 0;
let webglContextRestoreCount = 0;

const publish = (renderer: THREE.WebGLRenderer, state: ArenaRendererDiagnosticsSnapshot) => {
  renderer.domElement.dataset.rendererInstanceId = state.rendererInstanceId;
  renderer.domElement.dataset.rendererCreateCount = String(state.rendererCreateCount);
  renderer.domElement.dataset.rendererDisposeCount = String(state.rendererDisposeCount);
  renderer.domElement.dataset.webglContextLostCount = String(state.webglContextLostCount);
  renderer.domElement.dataset.webglContextRestoreCount = String(state.webglContextRestoreCount);
  renderer.domElement.dataset.currentRound = state.currentRound === undefined ? "" : String(state.currentRound);
  renderer.domElement.dataset.playerCount = String(state.playerCount);
  renderer.domElement.dataset.graphicsQuality = state.graphicsQuality;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    window.__quizstrikeArenaRenderer = { ...state };
  }
};

export const registerArenaRenderer = (
  renderer: THREE.WebGLRenderer,
  initial: Pick<ArenaRendererDiagnosticsSnapshot, "currentRound" | "playerCount" | "graphicsQuality">
): ArenaRendererDiagnosticsHandle => {
  rendererCreateCount += 1;
  const state: ArenaRendererDiagnosticsSnapshot = {
    rendererInstanceId: `arena-renderer-${++nextRendererInstanceId}`,
    rendererCreateCount,
    rendererDisposeCount,
    webglContextLostCount,
    webglContextRestoreCount,
    ...initial
  };
  let disposed = false;

  const publishState = () => publish(renderer, state);
  const update = (values: Partial<Pick<ArenaRendererDiagnosticsSnapshot, "currentRound" | "playerCount" | "graphicsQuality">>) => {
    if (disposed) return;
    Object.assign(state, values, {
      rendererCreateCount,
      rendererDisposeCount,
      webglContextLostCount,
      webglContextRestoreCount
    });
    publishState();
  };

  publishState();

  return {
    snapshot: () => ({ ...state }),
    update,
    contextLost: (metrics) => {
      if (disposed) return;
      webglContextLostCount += 1;
      Object.assign(state, {
        webglContextLostCount,
        rendererCreateCount,
        rendererDisposeCount
      });
      publishState();
      if (import.meta.env.DEV) {
        console.warn("[QuizStrike] WebGL context lost", {
          ...metrics,
          rendererInstanceId: state.rendererInstanceId,
          currentRound: state.currentRound,
          playerCount: state.playerCount,
          graphicsQuality: state.graphicsQuality
        });
      }
    },
    contextRestored: () => {
      if (disposed) return;
      webglContextRestoreCount += 1;
      Object.assign(state, {
        webglContextRestoreCount,
        rendererCreateCount,
        rendererDisposeCount,
        webglContextLostCount
      });
      publishState();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      rendererDisposeCount += 1;
      state.rendererDisposeCount = rendererDisposeCount;
      if (import.meta.env.DEV && typeof window !== "undefined") {
        window.__quizstrikeArenaRenderer = { ...state };
      }
    }
  };
};

