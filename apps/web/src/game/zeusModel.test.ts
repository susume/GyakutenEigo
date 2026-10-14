import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { attachZeusModel, ZEUS_MODEL_PATH, type ZeusModelAssets } from "./zeusModel";
import { createAthleticsModeVisuals } from "./athleticsModeVisuals";
import type { GameSession } from "@quizstrike/shared";

test("the bundled museum scan parses with the game loader and stays within its download and geometry budgets", async () => {
  const bytes = await readFile(new URL(`../../public${ZEUS_MODEL_PATH}`, import.meta.url));
  const provenance = JSON.parse(await readFile(new URL("../../public/assets/zeus/provenance.json", import.meta.url), "utf8"));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), provenance.sha256);
  assert.ok(bytes.length < 600_000);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  assert.ok(json.buffers.every((buffer: { uri?: string }) => !buffer.uri), "geometry is bundled rather than relying on the museum server");
  assert.equal(json.images?.length ?? 0, 0, "no remote texture dependencies");
  const { scene } = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, "");
  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.y - 4.5) < 0.02, "the STL's up axis is corrected");
  let triangles = 0;
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    triangles += object.geometry.index.count / 3;
    assert.ok(object.geometry.getAttribute("normal"), "the sculpture has smooth surface normals");
  });
  assert.equal(triangles, provenance.triangles);
  assert.ok(triangles <= 40_000);
});

const fixture = () => {
  const geometry = new THREE.BoxGeometry(2, 4.5, 2);
  const material = new THREE.MeshStandardMaterial();
  const source = new THREE.Group();
  source.add(new THREE.Mesh(geometry, material));
  let releases = 0;
  let geometryDisposals = 0;
  let materialDisposals = 0;
  geometry.addEventListener("dispose", () => geometryDisposals++);
  material.addEventListener("dispose", () => materialDisposals++);
  const assets: ZeusModelAssets = {
    load: async (path) => { assert.equal(path, ZEUS_MODEL_PATH); return source; },
    release: (path) => { assert.equal(path, ZEUS_MODEL_PATH); releases++; }
  };
  return { source, geometry, material, assets, stats: () => ({ releases, geometryDisposals, materialDisposals }) };
};

test("leaving and reentering an arena preserves cached geometry and disposes each instance's materials once", async () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) {
    const scene = new THREE.Scene();
    const visuals = createAthleticsModeVisuals({ scene, mode: "zeus", camera: new THREE.PerspectiveCamera(), zeusAssets: f.assets });
    await visuals.ready;
    const model = scene.getObjectByName("athletics-zeus-model")!;
    assert.equal(model.rotation.y, Math.PI, "the museum scan's -Z front is corrected for STOP");
    const mesh = model.getObjectByProperty("isMesh", true) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    assert.equal(mesh.geometry, f.geometry);
    assert.notEqual(mesh.material, f.material);
    assert.equal(mesh.material.fog, false);
    assert.equal(mesh.material.depthTest, true);
    assert.equal(mesh.layers.mask, 2, "meshes loaded later must join the sky pass");
    let instanceDisposals = 0;
    mesh.material.addEventListener("dispose", () => instanceDisposals++);
    const cloud = scene.getObjectByName("athletics-zeus-sky")!.children.find((object) => object instanceof THREE.Mesh) as THREE.Mesh;
    let cloudDisposals = 0;
    cloud.geometry.addEventListener("dispose", () => cloudDisposals++);
    visuals.dispose();
    visuals.dispose();
    assert.equal(instanceDisposals, 1);
    assert.equal(cloudDisposals, 1, "shared cloud geometry is released once, even on repeated cleanup");
    assert.equal(scene.children.length, 0);
    assert.deepEqual(f.stats(), { releases: i + 1, geometryDisposals: 0, materialDisposals: 0 });
  }
});

test("a slow model download cannot attach after the game has been left", async () => {
  const f = fixture();
  let finish!: (source: THREE.Group) => void;
  const pending = new Promise<THREE.Group>((resolve) => { finish = resolve; });
  const head = new THREE.Group();
  const sky = new THREE.Group();
  const model = attachZeusModel(head, sky, 1, { ...f.assets, load: () => pending });
  model.dispose();
  finish(f.source);
  await model.ready;
  assert.equal(head.children.length, 0);
  assert.equal(sky.userData.modelStatus, "disposed");
  assert.deepEqual(f.stats(), { releases: 1, geometryDisposals: 0, materialDisposals: 0 });
});

test("an unavailable model leaves the GO/STOP rules usable without restoring the old cartoon face", async () => {
  const f = fixture();
  const scene = new THREE.Scene();
  const visuals = createAthleticsModeVisuals({ scene, mode: "zeus", zeusAssets: { ...f.assets, load: async () => { throw new Error("offline"); } } });
  await visuals.ready;
  assert.equal(visuals.getModelStatus!(), "unavailable");
  const session = { athletics: { zeus: { phase: "green", phaseStartedAt: new Date(0).toISOString(), phaseEndsAt: new Date(7000).toISOString() } } } as GameSession;
  visuals.update(session, 7500);
  assert.equal(scene.getObjectByName("athletics-zeus-sky")!.userData.light, "red");
  assert.equal(scene.getObjectByName("athletics-zeus-head")!.children.length, 0);
  visuals.dispose();
  assert.equal(f.stats().releases, 1);
});
