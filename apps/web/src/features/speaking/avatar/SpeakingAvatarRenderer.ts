import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import { AvatarRig } from "./AvatarRig";
import { AVATAR_FRAME_INTERVAL_MS, AVATAR_MAX_PIXEL_RATIO, type SpeakingAvatarState } from "./avatarBehavior";

/** Keep GPU creation/parsing replaceable for lifecycle tests without WebGL. */
export interface SpeakingAvatarRuntime {
  createRenderer: () => Pick<THREE.WebGLRenderer, "domElement" | "debug" | "outputColorSpace" | "setClearColor" | "setPixelRatio" | "setSize" | "render" | "dispose" | "forceContextLoss">;
  parseModel: (bytes: ArrayBuffer, baseUrl: string) => Promise<Pick<GLTF, "scene" | "userData">>;
}

const browserRuntime: SpeakingAvatarRuntime = {
  createRenderer: () => new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }),
  parseModel: (bytes, baseUrl) => {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => /^(data:|blob:)/u.test(url) ? url : localAvatarUrl(url, baseUrl));
    const loader = new GLTFLoader(manager);
    loader.register((parser) => new VRMLoaderPlugin(parser));
    return loader.parseAsync(bytes, baseUrl);
  }
};

const diagnose = (message: string, error: unknown) => {
  if (import.meta.env?.DEV) console.warn(message, error);
};

/** Models and external resources must be served locally by this application. */
export function localAvatarUrl(src: string, base: string) {
  const url = new URL(src, base);
  if (url.origin !== new URL(base).origin || !["http:", "https:"].includes(url.protocol)) {
    throw new Error("Speaking avatars must use a same-origin local asset");
  }
  return url.href;
}

/** One renderer per mounted portrait. State changes never recreate it. */
export function mountSpeakingAvatar(host: HTMLDivElement, modelSrc: string,
  getState: () => SpeakingAvatarState, onReady: () => void, onFailure: () => void,
  runtime: SpeakingAvatarRuntime = browserRuntime): () => void {
  let disposed = false;
  let renderer: ReturnType<SpeakingAvatarRuntime["createRenderer"]> | undefined;
  let vrm: VRM | undefined;
  let observer: ResizeObserver | undefined;
  let frameId: number | undefined;
  let loadTimeout: ReturnType<typeof setTimeout> | undefined;
  const removeListeners: (() => void)[] = [];
  const controller = new AbortController();

  const clean = (action: () => void) => {
    try { action(); }
    catch (error) { diagnose("SpeakCheck avatar cleanup failed.", error); }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    clearTimeout(loadTimeout);
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    clean(() => observer?.disconnect());
    for (const remove of removeListeners) clean(remove);
    // Dispose independently so one malformed model cannot prevent context cleanup.
    clean(() => { if (vrm) { vrm.scene.removeFromParent(); VRMUtils.deepDispose(vrm.scene); } });
    clean(() => renderer?.dispose());
    clean(() => renderer?.forceContextLoss());
    clean(() => renderer?.domElement.remove());
  };
  const fail = (error: unknown) => {
    if (disposed) return;
    diagnose("SpeakCheck avatar unavailable; using the image.", error);
    dispose();
    onFailure();
  };

  try {
    const modelUrl = localAvatarUrl(modelSrc, window.location.href);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    renderer = runtime.createRenderer();
    const activeRenderer = renderer;
    // Three normally only logs compile/link errors and continues with a blank
    // canvas. Throw here so the same render failure path restores the image.
    activeRenderer.debug.onShaderError = () => { throw new Error("Avatar shader compilation failed"); };
    activeRenderer.setClearColor(0x000000, 0);
    activeRenderer.outputColorSpace = THREE.SRGBColorSpace;
    activeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, AVATAR_MAX_PIXEL_RATIO));
    activeRenderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(activeRenderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc8d7ec, 2));
    const key = new THREE.DirectionalLight(0xfff4e8, 2.1);
    key.position.set(-1, 2, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdbeaff, 1);
    fill.position.set(2, 1, 1);
    scene.add(fill);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = reducedMotion.matches;
    let rig: AvatarRig | undefined;
    let lastFrame: number | undefined;
    let nextFrame: number | undefined;
    let portraitHeight = 0.7;
    const target = new THREE.Vector3();
    const resize = () => {
      if (disposed) return;
      try {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        activeRenderer.setSize(width, height, false);
        camera.aspect = width / height;
        // Reserve shoulder width on narrow canvases; no full-body thumbnail.
        const visibleHeight = Math.max(portraitHeight, portraitHeight * 0.85 / camera.aspect);
        const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        camera.near = Math.max(0.001, distance / 100);
        camera.far = Math.max(50, distance * 4);
        camera.position.set(target.x, target.y, target.z + distance);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
      } catch (error) { fail(error); }
    };
    const tick = (now: number) => {
      frameId = undefined;
      if (disposed || document.hidden || !rig) return;
      if (nextFrame === undefined || now >= nextFrame - 0.1) {
        const delta = lastFrame === undefined ? 1 / 30 : Math.min((now - lastFrame) / 1000, 0.1);
        // Preserve the deadline across display refreshes; resetting it to now
        // can accidentally reduce 30 FPS to 20 FPS on a 60 Hz display.
        nextFrame = now + AVATAR_FRAME_INTERVAL_MS - Math.max(0, (now - (nextFrame ?? now)) % AVATAR_FRAME_INTERVAL_MS);
        lastFrame = now;
        try {
          rig.update(delta, getState(), reduce);
          activeRenderer.render(scene, camera);
          if (disposed) return;
        } catch (error) { fail(error); return; }
      }
      frameId = requestAnimationFrame(tick);
    };
    const visibilityChanged = () => {
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      frameId = undefined;
      lastFrame = undefined;
      nextFrame = undefined;
      if (!document.hidden && rig && !disposed) frameId = requestAnimationFrame(tick);
    };
    const motionChanged = () => { reduce = reducedMotion.matches; };
    const contextLost = (event: Event) => {
      event.preventDefault();
      fail(new Error("Avatar WebGL context lost"));
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    removeListeners.push(() => document.removeEventListener("visibilitychange", visibilityChanged));
    reducedMotion.addEventListener("change", motionChanged);
    removeListeners.push(() => reducedMotion.removeEventListener("change", motionChanged));
    activeRenderer.domElement.addEventListener("webglcontextlost", contextLost);
    removeListeners.push(() => activeRenderer.domElement.removeEventListener("webglcontextlost", contextLost));
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize);
      observer.observe(host);
    } else {
      window.addEventListener("resize", resize);
      removeListeners.push(() => window.removeEventListener("resize", resize));
    }
    resize();
    if (disposed) return dispose;

    loadTimeout = setTimeout(() => fail(new Error("Local avatar load timed out")), 15_000);
    void (async () => {
      const response = await fetch(modelUrl, { signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) throw new Error(`Local avatar request failed (${response.status})`);
      const bytes = await response.arrayBuffer();
      if (disposed) return;
      const gltf = await runtime.parseModel(bytes, new URL(".", modelUrl).href);
      // Parsing cannot be aborted. A late result still owns GPU resources.
      if (disposed) { VRMUtils.deepDispose(gltf.scene); return; }
      const loaded = gltf.userData.vrm as VRM | undefined;
      if (!loaded || !loaded.humanoid.getRawBoneNode("head")) {
        VRMUtils.deepDispose(gltf.scene);
        throw new Error("Avatar asset is not a supported VRM humanoid");
      }
      vrm = loaded;
      VRMUtils.rotateVRM0(loaded);
      VRMUtils.removeUnnecessaryVertices(loaded.scene);
      VRMUtils.combineSkeletons(loaded.scene);
      loaded.scene.traverse((object) => { object.frustumCulled = false; });
      scene.add(loaded.scene);
      rig = new AvatarRig(loaded);
      rig.update(0, getState(), reduce);
      loaded.scene.updateMatrixWorld(true);
      const head = loaded.humanoid.getRawBoneNode("head")!.getWorldPosition(new THREE.Vector3());
      const chest = (loaded.humanoid.getRawBoneNode("chest") ?? loaded.humanoid.getRawBoneNode("spine"))
        ?.getWorldPosition(new THREE.Vector3());
      const bounds = new THREE.Box3().setFromObject(loaded.scene);
      const bodyHeight = bounds.max.y - bounds.min.y;
      if (!Number.isFinite(bodyHeight) || bodyHeight <= 0) throw new Error("Avatar has no visible geometry");
      const top = Math.max(head.y + bodyHeight * 0.09, bounds.max.y);
      const bottom = chest ? chest.y - bodyHeight * 0.06 : head.y - bodyHeight * 0.28;
      portraitHeight = Math.max(bodyHeight * 0.3, top - bottom) * 1.08;
      target.set(head.x, (top + bottom) / 2, head.z);
      resize();
      if (disposed) return;
      clearTimeout(loadTimeout);
      // Reveal only after the first successful draw (shader errors also fall back).
      activeRenderer.render(scene, camera);
      if (disposed) return;
      onReady();
      visibilityChanged();
    })().catch(fail);
  } catch (error) { fail(error); }
  return dispose;
}
