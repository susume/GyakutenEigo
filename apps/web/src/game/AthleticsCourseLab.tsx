import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ATHLETICS_STADIUM_COURSE, getAthleticsPointAtProgress, getAthleticsRouteTangent } from "@quizstrike/shared";
import { buildAthleticsStadiumScene } from "./athleticsStadiumBuilder";
import { createArenaSceneSetup } from "./sceneSetup";
import { ARENA_MAPS } from "./arenaMaps";
import { makeCanvasTexture, makeLabelTexture, seededRandom } from "./arenaTextures";
import { mountAthleticsImportedAssets } from "./athleticsImportedAssets";
import "./athletics-course-lab.css";

// Development-only viewer uses the actual game builder and shared collision
// layout, so course reviews cannot silently drift from the playable map.
export default function AthleticsCourseLab() {
  const mount = useRef<HTMLDivElement>(null);
  const changeView = useRef<(view: number) => void>(() => {});
  const [view, setView] = useState(-1);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!mount.current) return;
    const target = mount.current;
    const setup = createArenaSceneSetup({ mount: target, arenaMap: ARENA_MAPS.find((entry) => entry.id === "athletics_park")!,
      isFps: false, isZombieMode: false, isIronJunction: false, isTempleRunoff: false, activeQuality: "balanced" });
    if (!setup) { setError("WebGL is unavailable."); return; }
    const { scene, camera, renderer, qualityConfig } = setup;
    scene.fog = null;
    camera.far = 1400;
    const course = buildAthleticsStadiumScene({ scene, renderer, qualityConfig, isFps: false,
      activeQuality: "balanced", requiredLaps: 2, makeCanvasTexture, makeLabelTexture, seededRandom });
    const assetAbort = new AbortController();
    const assets = mountAthleticsImportedAssets({ scene, detail: qualityConfig.detail, isFps: false, signal: assetAbort.signal });
    void assets.then((result) => { if (!assetAbort.signal.aborted) renderer.domElement.dataset.assetsLoaded = String(result.loadedAssetIds.length); });
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxDistance = 650;
    const eye = new THREE.Vector3();
    let showGuide = false;
    changeView.current = (next) => {
      showGuide = next >= 0;
      if (next === -1) { camera.position.set(180, 225, 265); controls.target.set(0, 0, 6); }
      else if (next === -2) { camera.position.set(0, 410, 5); controls.target.set(0, 0, 4); }
      else if (next === 6) {
        showGuide = false;
        camera.position.set(-112, 104, 155); controls.target.set(-40, 24, 52);
      }
      else {
        const section = ATHLETICS_STADIUM_COURSE.sections[next]!;
        const point = getAthleticsPointAtProgress(section.startProgress);
        const tangent = getAthleticsRouteTangent(Math.min(1, section.startProgress + .001));
        eye.set(point.x, point.y + 4.21, point.z);
        camera.position.set(point.x - tangent.x * 15 + tangent.z * 10, point.y + 15, point.z - tangent.z * 15 - tangent.x * 10);
        controls.target.set(point.x + tangent.x * 25, point.y + 3, point.z + tangent.z * 25);
      }
      camera.updateProjectionMatrix(); controls.update();
    };
    changeView.current(-1);
    renderer.domElement.setAttribute("aria-label", "Redesigned athletics course preview");
    const resize = () => { const w = Math.max(1, target.clientWidth), h = Math.max(1, target.clientHeight);
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
    const observer = new ResizeObserver(resize); observer.observe(target); resize();
    const started = performance.now();
    renderer.setAnimationLoop(() => { course.athleticsUpdate((performance.now() - started) / 1000, showGuide ? eye : undefined, showGuide); controls.update(); renderer.render(scene, camera); });
    return () => {
      renderer.setAnimationLoop(null); observer.disconnect(); controls.dispose(); course.staticBatcher.dispose();
      assetAbort.abort(); void assets.then((result) => result.dispose());
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      scene.traverse((object) => { const mesh = object as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry);
        for (const material of mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : []) {
          materials.add(material); for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      geometries.forEach((entry) => entry.dispose()); materials.forEach((entry) => entry.dispose()); textures.forEach((entry) => entry.dispose());
      renderer.dispose(); renderer.domElement.remove(); changeView.current = () => {};
    };
  }, []);
  return <main className="athletics-course-lab">
    <header><span>QUIZSTRIKE · COURSE DESIGN REVIEW</span><h1>Skyline Athletics Circuit</h1>
      <p>Seven districts · a physical descent to the start/finish · seamless laps with no teleport or pause.</p></header>
    <nav aria-label="Course preview cameras">{[[-1, "Overview"], [-2, "Top down"], ...ATHLETICS_STADIUM_COURSE.sections.map((section, index) => [index, section.label])].map(([index, label]) =>
      <button key={index} aria-pressed={view === index} onClick={() => { setView(Number(index)); changeView.current(Number(index)); }}>{label}</button>)}</nav>
    {error && <p role="alert">{error}</p>}<div ref={mount} className="athletics-course-view" />
    <footer>{view >= 0 ? ATHLETICS_STADIUM_COURSE.sections[view]?.description : "Drag to orbit · scroll to zoom. White chevrons mark the main route; gold pads are optional expert shortcuts."}</footer>
  </main>;
}
