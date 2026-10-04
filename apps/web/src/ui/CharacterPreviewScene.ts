import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { PlayerAppearance, Team } from "@quizstrike/shared";
import { CharacterFactory } from "../game/characters/CharacterFactory";
import type { CharacterModel } from "../game/characters/CharacterModel";

export type WardrobeView = "outfit" | "portrait" | "back" | "footwear";

/** One context and one shared factory for the lifetime of the preview. */
export class CharacterPreviewScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly factory: CharacterFactory;
  private readonly observer: ResizeObserver;
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly owned: THREE.Mesh[] = [];
  private model?: CharacterModel;
  private signature = "";
  private frame = 0;
  private previousTime = 0;
  private view: WardrobeView = "outfit";
  private yaw = Math.PI - 0.34;
  private distance = 11;
  private zoom = 1;
  private targetY = 2.5;
  private poseStarted = -Infinity;
  private posePreview = false;
  private disposed = false;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private readonly pointers = new Map<number, { x: number; y: number }>();

  constructor(private readonly mount: HTMLDivElement, team: Team, loadDecalTexture: (id: string) => Promise<THREE.Texture | null>) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance",
      preserveDrawingBuffer: new URLSearchParams(window.location.search).has("catalogCapture") });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.mount.appendChild(this.renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.45;
    room.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight("#cfe6ff", "#5d5477", 1.45));
    const key = new THREE.DirectionalLight("#fff1dc", 3.2);
    key.position.set(-3.5, 7, 5); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 8, bottom: -3, near: 0.5, far: 22 });
    key.shadow.normalBias = 0.025; key.shadow.bias = -0.0001;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#bdc8ff", 1.5);
    fill.position.set(5, 3, 3); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(team === "blue" ? "#70e3ff" : "#ffb594", 3);
    rim.position.set(1, 5, -4); this.scene.add(rim);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.4, 0.16, 80),
      new THREE.MeshStandardMaterial({ color: "#152445", roughness: 0.38, metalness: 0.25 }));
    platform.position.y = -0.24; platform.receiveShadow = true;
    this.scene.add(platform); this.owned.push(platform);
    const platformRing = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.024, 12, 80),
      new THREE.MeshBasicMaterial({ color: team === "blue" ? "#78dcff" : "#ffa488" }));
    platformRing.rotation.x = Math.PI / 2; platformRing.position.y = -0.152;
    this.scene.add(platformRing); this.owned.push(platformRing);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.33; ground.receiveShadow = true;
    this.scene.add(ground); this.owned.push(ground);
    this.factory = new CharacterFactory({ loadDecalTexture: async id => {
      const texture = await loadDecalTexture(id);
      // The factory attaches the returned map in the next microtask. Schedule a
      // paint afterwards so uploaded badges also appear with reduced motion.
      requestAnimationFrame(() => this.draw());
      return texture;
    } });
    this.observer = new ResizeObserver(() => { this.resize(); this.draw(); });
    this.observer.observe(mount); this.resize();
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("pointercancel", this.pointerUp);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    document.addEventListener("visibilitychange", this.visibilityChange);
    this.reducedMotion.addEventListener("change", this.motionChange);
    this.frame = requestAnimationFrame(this.animate);
  }

  setAppearance(appearance: PlayerAppearance, team: Team, showWeapon: boolean, allowCombatAccessories = true) {
    const signature = JSON.stringify([appearance, team, showWeapon, allowCombatAccessories]);
    if (signature === this.signature) return;
    this.signature = signature;
    if (this.model) { this.scene.remove(this.model.root); this.model.dispose(); }
    this.model = this.factory.createCharacter({ playerId: "wardrobe-preview", team, appearance, gear: "starter_blaster", showWeapon, allowCombatAccessories });
    this.scene.add(this.model.root);
    this.mount.dataset.appearance = JSON.stringify(appearance);
    this.mount.dataset.modelSource = this.model.root.userData.characterModelSource;
    this.resize();
    const requestedPose = new URLSearchParams(window.location.search).get("characterPose");
    if (this.posePreview || requestedPose === "victory") this.playPose();
    else {
      if (requestedPose === "jump" || requestedPose === "respawn") this.model.triggerAnimation(requestedPose);
      else if (requestedPose === "shoot") this.model.triggerAnimation("fire");
      this.draw();
    }
  }

  setView(view: WardrobeView, pose: boolean) {
    if (this.view !== view) {
      this.view = view; this.zoom = 1;
      this.yaw = view === "back" ? 0.3 : Math.PI - (view === "footwear" ? 0.55 : 0.34);
    }
    const requested = new URLSearchParams(window.location.search).get("characterView");
    const angles: Record<string, number> = { front: Math.PI, rear: 0, left: Math.PI / 2, right: -Math.PI / 2,
      "three-quarter": Math.PI - 0.55, "rear-three-quarter": 0.55 };
    if (requested && requested in angles) this.yaw = angles[requested];
    const changed = this.posePreview !== pose; this.posePreview = pose;
    this.resize();
    if (pose && changed) this.playPose(); else this.draw();
  }

  reset() { this.zoom = 1; this.yaw = this.view === "back" ? 0.3 : Math.PI - 0.34; this.resize(); this.draw(); }
  rotate(direction: number) { this.yaw += direction * Math.PI / 8; this.draw(); }
  changeZoom(direction: number) { this.zoom = THREE.MathUtils.clamp(this.zoom + direction * 0.1, 0.7, 1.6); this.resize(); this.draw(); }
  playPose() {
    if (!this.model) return;
    this.model.triggerAnimation("victory"); this.poseStarted = performance.now();
    if (this.reducedMotion.matches) {
      for (let i = 0; i < 25; i++) this.step(1 / 60, 0.55);
      this.draw(false);
    } else this.draw();
  }

  private resize() {
    const width = Math.max(1, this.mount.clientWidth), height = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false);
    this.targetY = this.view === "portrait" ? 4.47 : this.view === "footwear" ? 0.68 : this.posePreview ? 2.85 : 2.5;
    const visibleHeight = this.view === "portrait" ? 2.9 : this.view === "footwear" ? 2.5 : this.posePreview ? 7.2 : 6.6;
    const visibleWidth = this.view === "portrait" ? 2.5 : this.view === "footwear" ? 2.8 : this.model?.appearance.customization.backAccessoryId.includes("wings") ? 6.8 : 3.8;
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.distance = Math.max(visibleHeight / (2 * tangent), visibleWidth / (2 * tangent * this.camera.aspect)) / this.zoom;
    this.camera.position.set(0, this.targetY + (this.view === "footwear" ? 0.8 : 0.25), this.distance);
    this.camera.lookAt(0, this.targetY, 0);
  }

  private step(delta: number, elapsed: number) {
    if (!this.model) return;
    const params = new URLSearchParams(window.location.search);
    const pose = params.get("characterPose");
    const speed = pose === "walk" ? 3.2 : pose === "sprint" ? 5.4 : 0;
    this.model.root.rotation.y = this.yaw;
    this.model.update({ camera: this.camera, delta, elapsed, speed, forwardSpeed: speed, alive: true,
      aimPitch: pose === "aim" ? -0.18 : 0, crouching: pose === "crouch", firing: pose === "shoot" });
  }
  private draw(update = true) {
    if (this.disposed || !this.model) return;
    if (update) this.step(1 / 60, this.reducedMotion.matches ? 0 : performance.now() / 1000);
    this.renderer.render(this.scene, this.camera);
    this.mount.dataset.renderStats = JSON.stringify({ calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, pixelRatio: this.renderer.getPixelRatio() });
    this.mount.dataset.ready = "true";
  }
  private animate = (time: number) => {
    if (this.disposed || document.hidden) return;
    if (!this.reducedMotion.matches) {
      const delta = Math.min(0.05, (time - (this.previousTime || time - 16)) / 1000);
      this.previousTime = time;
      // Replay the chosen flourish occasionally while browsing poses.
      if (this.posePreview && time - this.poseStarted > 3400) this.playPose();
      this.step(delta, time / 1000); this.draw(false);
      this.frame = requestAnimationFrame(this.animate);
    }
  };
  private visibilityChange = () => {
    cancelAnimationFrame(this.frame); this.previousTime = 0;
    if (!document.hidden) { this.draw(); this.frame = requestAnimationFrame(this.animate); }
  };
  private motionChange = () => { cancelAnimationFrame(this.frame); this.draw(); this.frame = requestAnimationFrame(this.animate); };
  private pointerDown = (event: PointerEvent) => {
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent) => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    if (this.pointers.size > 1) {
      const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const old = Math.hypot(previous.x - other.x, previous.y - other.y);
        const next = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        this.zoom = THREE.MathUtils.clamp(this.zoom + (next - old) * 0.003, 0.7, 1.6); this.resize();
      }
    } else this.yaw += (event.clientX - previous.x) * 0.009;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); this.draw();
  };
  private pointerUp = (event: PointerEvent) => { this.pointers.delete(event.pointerId); };
  private wheel = (event: WheelEvent) => {
    event.preventDefault(); this.zoom = THREE.MathUtils.clamp(this.zoom - event.deltaY * 0.0008, 0.7, 1.6);
    this.resize(); this.draw();
  };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    document.removeEventListener("visibilitychange", this.visibilityChange);
    this.reducedMotion.removeEventListener("change", this.motionChange);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.pointerDown); canvas.removeEventListener("pointermove", this.pointerMove);
    canvas.removeEventListener("pointerup", this.pointerUp); canvas.removeEventListener("pointercancel", this.pointerUp);
    canvas.removeEventListener("wheel", this.wheel);
    this.model?.dispose(); this.factory.dispose(); this.environment.dispose();
    this.scene.traverse(object => { if (object instanceof THREE.DirectionalLight) object.shadow.dispose(); });
    for (const mesh of this.owned) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
    this.renderer.dispose(); this.renderer.forceContextLoss(); canvas.remove();
  }
}
