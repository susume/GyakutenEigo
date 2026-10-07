import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Vector3 } from "three";
import { VRM, VRMExpression, VRMExpressionManager, VRMHumanoid, type VRMHumanBones } from "@pixiv/three-vrm";
import { mountSpeakingAvatar, type SpeakingAvatarRuntime } from "./SpeakingAvatarRenderer.js";
import type { SpeakingAvatarState } from "./avatarBehavior.js";

class TrackedTarget extends EventTarget {
  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
    const [name, callback] = args;
    if (callback) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name)!.add(callback);
    }
    super.addEventListener(...args);
  }
  override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>) {
    if (args[1]) this.listeners.get(args[0])?.delete(args[1]);
    super.removeEventListener(...args);
  }
  listenerCount() { return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0); }
}

function installGlobal(t: TestContext, name: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else Reflect.deleteProperty(globalThis, name);
  });
}

async function flushLoad() { for (let i = 0; i < 12; i += 1) await Promise.resolve(); }

/** An in-memory scene exercises real VRM pose/expression/disposal APIs, without a model file or GPU. */
function model(scale = 1) {
  const scene = new Group();
  const hips = new Object3D();
  const spine = new Object3D();
  const head = new Object3D();
  scene.add(hips); hips.add(spine); spine.add(head);
  hips.position.y = 0.9;
  spine.position.y = 0.4;
  head.position.y = 0.5;
  const humanoid = new VRMHumanoid({ hips: { node: hips }, spine: { node: spine }, head: { node: head } } as VRMHumanBones);
  scene.add(humanoid.normalizedHumanBonesRoot);
  const geometry = new BoxGeometry(0.5, 2, 0.2);
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.position.y = 1;
  scene.add(mesh);
  scene.scale.setScalar(scale);
  const expressions = new VRMExpressionManager();
  for (const name of ["aa", "blink"]) expressions.registerExpression(new VRMExpression(name));
  const vrm = new VRM({ scene, humanoid, expressionManager: expressions,
    meta: { metaVersion: "1", name: "Unit test scene", authors: [], licenseUrl: "" } });
  const disposed = { geometry: 0, material: 0 };
  geometry.addEventListener("dispose", () => { disposed.geometry += 1; });
  material.addEventListener("dispose", () => { disposed.material += 1; });
  return { scene, vrm, expressions, head, disposed };
}

function environment(t: TestContext) {
  const mounted: (() => void)[] = [];
  // Register GPU cleanup before the hooks that restore browser globals.
  t.after(() => { for (const dispose of mounted) dispose(); });
  const doc = Object.assign(new TrackedTarget(), { hidden: false });
  const media = Object.assign(new TrackedTarget(), { matches: false });
  const win = Object.assign(new TrackedTarget(), {
    location: { href: "https://school.example/speak/session/test" }, devicePixelRatio: 3, matchMedia: () => media
  });
  const canvas = Object.assign(new TrackedTarget(), {
    setAttribute: () => undefined,
    remove: () => { host.children.length = 0; }
  });
  const host = { clientWidth: 640, clientHeight: 280, children: [] as unknown[], appendChild: (child: unknown) => host.children.push(child) };
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let resize: (() => void) | undefined;
  let disconnected = 0;
  let draw = 0;
  let created = 0;
  let rendererDisposed = 0;
  let contextReleased = 0;
  let pixelRatio = 0;
  let camera: PerspectiveCamera | undefined;
  let renderAction: (() => void) | undefined;
  let signal: AbortSignal | undefined;
  const renderer: ReturnType<SpeakingAvatarRuntime["createRenderer"]> = {
    domElement: canvas as unknown as HTMLCanvasElement,
    debug: { checkShaderErrors: true, onShaderError: null }, outputColorSpace: "",
    setClearColor: () => undefined, setPixelRatio: (value) => { pixelRatio = value; }, setSize: () => undefined,
    render: (_scene, currentCamera) => { draw += 1; camera = currentCamera as PerspectiveCamera; renderAction?.(); },
    dispose: () => { rendererDisposed += 1; }, forceContextLoss: () => { contextReleased += 1; }
  };
  const asset = model();
  const runtime: SpeakingAvatarRuntime = {
    createRenderer: () => { created += 1; return renderer; },
    parseModel: async () => ({ scene: asset.scene, userData: { vrm: asset.vrm } })
  };
  installGlobal(t, "window", win);
  installGlobal(t, "document", doc);
  installGlobal(t, "ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() { /* Size is driven explicitly by tests. */ }
    disconnect() { disconnected += 1; }
  });
  installGlobal(t, "requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  installGlobal(t, "cancelAnimationFrame", (id: number) => frames.delete(id));
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  });
  let state: SpeakingAvatarState = "idle";
  let ready = 0;
  let failed = 0;
  const mount = () => {
    const dispose = mountSpeakingAvatar(host as unknown as HTMLDivElement, "/assets/speaking/avatar/default.vrm",
      () => state, () => { ready += 1; }, () => { failed += 1; }, runtime);
    mounted.push(dispose);
    return dispose;
  };
  const step = (now: number) => {
    const current = [...frames.values()]; frames.clear();
    for (const callback of current) callback(now);
  };
  return { doc, win, media, canvas, host, frames, runtime, renderer, asset, mount, step,
    resize: () => resize?.(), setState: (value: SpeakingAvatarState) => { state = value; },
    setRenderAction: (value: () => void) => { renderAction = value; },
    stats: () => ({ draw, created, rendererDisposed, contextReleased, pixelRatio, disconnected, ready, failed, signal, camera }) };
}

test("a loaded portrait uses one renderer across speech/listening/thinking and disposes all resources once", async (t) => {
  const env = environment(t);
  const dispose = env.mount(); t.after(dispose);
  await flushLoad();
  assert.equal(env.stats().ready, 1);
  assert.equal(env.stats().failed, 0);
  assert.equal(env.stats().pixelRatio, 1.5);
  assert.equal(env.host.children.length, 1);
  const projection = env.asset.head.getWorldPosition(new Vector3()).project(env.stats().camera!);
  assert.ok(Math.abs(projection.x) < 1 && Math.abs(projection.y) < 1 && Math.abs(projection.z) < 1);
  env.setState("speaking");
  let mouthSeen = false;
  for (let i = 0; i < 120; i += 1) {
    env.step(i * 1000 / 30);
    mouthSeen ||= env.asset.expressions.getValue("aa")! > 0.1;
  }
  assert.ok(mouthSeen);
  let now = 4000;
  for (const state of ["listening", "thinking", "paused"] as const) {
    env.setState(state);
    for (let i = 0; i < 12; i += 1) { env.step(now); now += 1000 / 30; }
    assert.ok(env.asset.expressions.getValue("aa")! < 0.001);
  }
  assert.equal(env.stats().created, 1);
  dispose(); dispose();
  assert.equal(env.frames.size, 0);
  assert.equal(env.host.children.length, 0);
  assert.equal(env.doc.listenerCount() + env.media.listenerCount() + env.canvas.listenerCount(), 0);
  assert.equal(env.stats().disconnected, 1);
  assert.equal(env.stats().rendererDisposed, 1);
  assert.equal(env.stats().contextReleased, 1);
  assert.equal(env.stats().signal!.aborted, true);
  assert.deepEqual(env.asset.disposed, { geometry: 1, material: 1 });
});

test("hidden tabs stop frames and resume once with a bounded delta", async (t) => {
  const env = environment(t);
  const deltas: number[] = [];
  const update = env.asset.vrm.update.bind(env.asset.vrm);
  t.mock.method(env.asset.vrm, "update", (delta: number) => { deltas.push(delta); update(delta); });
  const dispose = env.mount(); t.after(dispose);
  await flushLoad();
  env.step(0);
  env.doc.hidden = true;
  env.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(env.frames.size, 0);
  const draws = env.stats().draw;
  env.step(60_000);
  assert.equal(env.stats().draw, draws);
  env.doc.hidden = false;
  env.doc.dispatchEvent(new Event("visibilitychange"));
  env.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(env.frames.size, 1);
  env.step(60_100);
  assert.equal(env.stats().draw, draws + 1);
  assert.ok(deltas.at(-1)! <= 0.1);
});

for (const refreshRate of [60, 144]) {
  test(`the 30 FPS limit keeps its cadence on ${refreshRate} Hz displays`, async (t) => {
    const env = environment(t);
    const dispose = env.mount(); t.after(dispose);
    await flushLoad();
    const draws = env.stats().draw;
    for (let i = 0; i < refreshRate * 10; i += 1) env.step(i * 1000 / refreshRate);
    assert.ok(Math.abs(env.stats().draw - draws - 300) <= 1, `Rendered ${env.stats().draw - draws} frames in 10 seconds`);
    assert.equal(env.frames.size, 1);
  });
}

for (const failure of ["shader", "render", "context-during-first-draw", "context-after-ready", "render-after-ready", "update-after-ready"] as const) {
  test(`${failure} failure restores fallback and leaves no renderer or frames`, async (t) => {
    const env = environment(t);
    const afterReady = failure.endsWith("after-ready");
    if (!afterReady) env.setRenderAction(() => {
      if (failure === "shader") Reflect.apply(env.renderer.debug.onShaderError!, undefined, [null, null, null, null]);
      else if (failure === "render") throw new Error("Test draw failure");
      else env.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    const dispose = env.mount(); t.after(dispose);
    await flushLoad();
    if (failure === "context-after-ready") env.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    if (failure === "render-after-ready") env.setRenderAction(() => { throw new Error("Runtime draw failed"); });
    if (failure === "update-after-ready") t.mock.method(env.asset.vrm, "update", () => { throw new Error("Runtime pose failed"); });
    if (failure === "render-after-ready" || failure === "update-after-ready") env.step(0);
    assert.equal(env.stats().ready, afterReady ? 1 : 0);
    assert.equal(env.stats().failed, 1);
    assert.equal(env.host.children.length, 0);
    assert.equal(env.frames.size, 0);
    assert.equal(env.stats().contextReleased, 1);
    assert.deepEqual(env.asset.disposed, { geometry: 1, material: 1 });
    dispose();
    assert.equal(env.stats().failed, 1);
  });
}

test("an immediate mount/cleanup/remount ignores the stale fetch and starts only one loop", async (t) => {
  const env = environment(t);
  const parse = env.runtime.parseModel;
  let parsed = 0;
  env.runtime.parseModel = (...args) => { parsed += 1; return parse(...args); };
  const first = env.mount();
  first();
  const second = env.mount();
  await flushLoad();
  assert.equal(parsed, 1);
  assert.equal(env.stats().created, 2);
  assert.equal(env.stats().ready, 1);
  assert.equal(env.stats().failed, 0);
  assert.equal(env.frames.size, 1);
  assert.equal(env.host.children.length, 1);
  assert.deepEqual(env.asset.disposed, { geometry: 0, material: 0 });
  second();
  assert.equal(env.stats().rendererDisposed, 2);
  assert.equal(env.stats().contextReleased, 2);
  assert.deepEqual(env.asset.disposed, { geometry: 1, material: 1 });
});

for (const stop of ["unmount", "timeout"] as const) {
  test(`a parse completing after ${stop} disposes its model without reporting ready`, async (t) => {
    const env = environment(t);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let resolveParse!: (value: Awaited<ReturnType<SpeakingAvatarRuntime["parseModel"]>>) => void;
    env.runtime.parseModel = () => new Promise((resolve) => { resolveParse = resolve; });
    const dispose = env.mount(); t.after(dispose);
    await flushLoad();
    assert.ok(resolveParse);
    if (stop === "unmount") dispose(); else t.mock.timers.tick(15_000);
    resolveParse({ scene: env.asset.scene, userData: { vrm: env.asset.vrm } });
    await flushLoad();
    assert.equal(env.stats().ready, 0);
    assert.equal(env.stats().failed, stop === "timeout" ? 1 : 0);
    assert.equal(env.frames.size, 0);
    assert.equal(env.stats().signal!.aborted, true);
    assert.deepEqual(env.asset.disposed, { geometry: 1, material: 1 });
  });
}

test("partial initialization and cleanup errors still release the context and listeners", async (t) => {
  const env = environment(t);
  t.mock.method(env.media, "addEventListener", () => { throw new Error("Media listener failed"); });
  t.mock.method(env.renderer, "dispose", () => { throw new Error("Renderer cleanup failed"); });
  const dispose = env.mount(); t.after(dispose);
  await flushLoad();
  assert.equal(env.stats().failed, 1);
  assert.equal(env.doc.listenerCount(), 0);
  assert.equal(env.stats().contextReleased, 1);
  assert.equal(env.host.children.length, 0);
});

test("portrait resize adapts the camera clipping planes to model scale", async (t) => {
  const env = environment(t);
  const large = model(100);
  env.runtime.parseModel = async () => ({ scene: large.scene, userData: { vrm: large.vrm } });
  const dispose = env.mount(); t.after(dispose);
  await flushLoad();
  env.host.clientWidth = 240;
  env.resize();
  const camera = env.stats().camera!;
  const projection = large.head.getWorldPosition(new Vector3()).project(camera);
  assert.equal(env.stats().ready, 1);
  assert.equal(camera.aspect, 240 / 280);
  assert.ok(camera.far > 50);
  assert.ok(Math.abs(projection.x) < 1 && Math.abs(projection.y) < 1 && Math.abs(projection.z) < 1);
});
