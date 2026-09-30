import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CommunityCharacterPool } from "./characters/CommunityCharacterPool";
import { HudManager } from "./hud/HudManager";
import { ContextualVitalBar } from "./hud/ContextualVitalBar";
import { arenaAssetManager } from "./rendering/assets/ArenaAssetManager";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import "./modernization-lab.css";

export default function ModernizationLab() {
  const mount = useRef<HTMLDivElement>(null);
  const [manager] = useState(() => new HudManager());
  const [health, setHealth] = useState(100);
  const [energy, setEnergy] = useState(100);
  const [count, setCount] = useState(4);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState("");

  useEffect(() => {
    manager.dispatch({ type: "vitals", vitals: { health, maxHealth: 100, energy, maxEnergy: 100, alive: health > 0, active: true, alwaysVisible: false } });
  }, [manager, health, energy]);
  useEffect(() => () => manager.dispose(), [manager]);

  useEffect(() => {
    if (!mount.current) return;
    const target = mount.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#bfdbe0");
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 100);
    const viewingDistance = Math.max(7, Math.ceil(count / 4) * 1.9);
    camera.position.set(viewingDistance * .65, viewingDistance * .55, viewingDistance);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "CC0 character asset preview");
    target.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2;
    scene.add(new THREE.HemisphereLight("#e6f7ff", "#7a8765", 2.5));
    const sunlight = new THREE.DirectionalLight("#fff0d4", 3);
    sunlight.position.set(4, 8, 3);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    Object.assign(sunlight.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    sunlight.shadow.normalBias = .04;
    scene.add(sunlight);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: "#a4b996", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const pool = new CommunityCharacterPool();
    let disposed = false;
    let releasePalm = false;
    let avatars: Awaited<ReturnType<CommunityCharacterPool["create"]>>[] = [];
    setReady(false);
    setError("");
    void Promise.all(Array.from({ length: count }, () => pool.create())).then((instances) => {
      if (disposed) return;
      avatars = instances;
      instances.forEach((instance, index) => {
        instance.root.position.set((index % 4 - 1.5) * 1.4, 0, (Math.floor(index / 4) - Math.floor((count - 1) / 4) / 2) * 1.4);
        scene.add(instance.root);
      });
      setReady(true);
    }).catch((reason: unknown) => { if (!disposed) setError(reason instanceof Error ? reason.message : "Character could not load"); });
    const palmPath = "/assets/community/kenney-nature/palm.glb";
    void arenaAssetManager.loadAsset(palmPath).then((source) => {
      if (disposed) { arenaAssetManager.releaseAsset(palmPath); return; }
      releasePalm = true;
      [-5, 5].forEach((x) => { const tree = cloneSkeleton(source); tree.position.set(x, 0, -3); tree.scale.setScalar(3.4); scene.add(tree); });
    }).catch(() => { if (!disposed) setError("Backdrop unavailable; character preview remains usable."); });
    const resize = () => {
      const width = Math.max(1, target.clientWidth), height = Math.max(1, target.clientHeight);
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    let previous = performance.now(), lastStats = previous;
    renderer.setAnimationLoop(() => {
      const now = performance.now(), delta = Math.min(.05, (now - previous) / 1000);
      previous = now;
      avatars.forEach((instance, index) => instance.update(delta, index % 2 ? 1 : 0));
      controls.update();
      renderer.render(scene, camera);
      if (now - lastStats > 1000) {
        lastStats = now;
        setStats(`${avatars.length} characters · ${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.memory.geometries} shared geometries`);
      }
    });
    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      pool.dispose();
      if (releasePalm) arenaAssetManager.releaseAsset(palmPath);
      ground.geometry.dispose(); ground.material.dispose();
      sunlight.shadow.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [count]);

  return <main className="modernization-lab">
    <header><a href="/">GyakutenEigo</a><span>QuizStrike · Asset integration lab</span></header>
    <section className="modernization-lab-intro"><span>Public assets, working integration</span><h1>Character & HUD modernization</h1>
      <p>Kenney’s CC0 skater, shared skeleton-safe prefabs, Three.js camera controls, and Motion’s contextual vital bars.</p></section>
    <div className="modernization-lab-stage" ref={mount} />
    <div className="modernization-lab-status" role="status">{error || (ready ? stats || "Characters loaded" : "Loading licensed assets…")}</div>
    <section className="modernization-lab-controls"><div className="hud player-status-hud">
      <ContextualVitalBar manager={manager} kind="health" value={health} maximum={100} />
      <ContextualVitalBar manager={manager} kind="energy" value={energy} maximum={100} />
    </div><div className="modernization-lab-buttons">
      <button onClick={() => { manager.dispatch({ type: "combat" }); setHealth((value) => Math.max(0, value - 20)); }}>Take a hit</button>
      <button onClick={() => manager.dispatch({ type: "combat" })}>Fire</button>
      <button onClick={() => setEnergy((value) => Math.max(0, value - 20))}>Spend energy</button>
      <button onClick={() => { setHealth(100); setEnergy(100); }}>Recover & recharge</button>
      <label>Class size <select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={4}>4 avatars</option><option value={20}>20 avatars</option><option value={40}>40 avatars</option></select></label>
    </div><p>Drag to orbit. Full bars fade after a quiet period; combat and depleted vitals reveal them.</p></section>
    <footer><a href="https://kenney.nl/assets/animated-characters-protagonists">Character source · CC0</a><a href="https://kenney.nl/assets/nature-kit">Environment source · CC0</a><span>Development preview · existing game cosmetics remain available</span></footer>
  </main>;
}
