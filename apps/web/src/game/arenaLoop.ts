import * as THREE from "three";

export type ArenaLoopFrame = {
  delta: number;
  elapsed: number;
  currentTime: number;
};

export const createArenaRenderLoop = (
  onFrame: (frame: ArenaLoopFrame) => void,
  maxDelta: number
) => {
  const clock = new THREE.Clock();
  let animationFrame = 0;
  let running = false;

  const tick = () => {
    if (!running) return;
    animationFrame = requestAnimationFrame(tick);
    const delta = Math.min(clock.getDelta(), maxDelta);
    onFrame({ delta, elapsed: clock.elapsedTime, currentTime: performance.now() });
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      clock.start();
      tick();
    },
    stop: () => {
      running = false;
      cancelAnimationFrame(animationFrame);
    }
  };
};
