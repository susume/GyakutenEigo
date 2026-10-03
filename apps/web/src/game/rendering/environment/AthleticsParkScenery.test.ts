import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ATHLETICS_STADIUM_COURSE } from "@quizstrike/shared";
import { ArenaStaticBatcher } from "../../ArenaStaticBatch";
import { buildAthleticsEnvironmentDress, type AthleticsDressMaterials } from "./AthleticsEnvironmentDress";
import { buildAthleticsParkScenery } from "./AthleticsParkScenery";

const keys = ["turf", "turfLight", "track", "trackLine", "stadium", "stadiumDark", "stadiumRoof", "seatBlue", "seatCoral",
  "metal", "cream", "foliage", "foliageLight", "trunk", "cyan", "orange", "lime", "violet", "pink", "gold"];
const materials = Object.fromEntries(keys.map(key => [key, new THREE.MeshStandardMaterial()])) as AthleticsDressMaterials;
const addBox = (root: THREE.Group) => (size: [number, number, number], position: [number, number, number], material: THREE.Material,
  _surface?: string, rotation: [number, number, number] = [0, 0, 0]) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position); mesh.rotation.set(...rotation); root.add(mesh); return mesh;
};

test("park scenery leaves the playable surfaces and jump headroom clear", () => {
  const root = new THREE.Group();
  buildAthleticsParkScenery(root, 1, materials, addBox(root));
  root.updateMatrixWorld(true);
  const surfaces = [...ATHLETICS_STADIUM_COURSE.surfaces, ...ATHLETICS_STADIUM_COURSE.shortcuts.flatMap(shortcut => shortcut.surfaces)];
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const sceneryBounds: THREE.Box3[] = [];
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const instanced = mesh as THREE.InstancedMesh;
      const matrix = new THREE.Matrix4();
      for (let index = 0; index < instanced.count; index += 1) {
        instanced.getMatrixAt(index, matrix);
        sceneryBounds.push(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix.premultiply(mesh.matrixWorld)));
      }
    } else sceneryBounds.push(new THREE.Box3().setFromObject(mesh));
    for (const bounds of sceneryBounds) for (const surface of surfaces) {
      const angle = surface.rotationY ?? 0;
      const halfX = (Math.abs(Math.cos(angle)) * surface.width + Math.abs(Math.sin(angle)) * surface.depth) / 2;
      const halfZ = (Math.abs(Math.sin(angle)) * surface.width + Math.abs(Math.cos(angle)) * surface.depth) / 2;
      const runningSpace = new THREE.Box3(new THREE.Vector3(surface.x - halfX, surface.y, surface.z - halfZ),
        new THREE.Vector3(surface.x + halfX, surface.y + 9, surface.z + halfZ));
      assert.equal(bounds.intersectsBox(runningSpace), false, `${mesh.name || "Scenery"} blocks ${surface.id}`);
    }
  });
});

test("Low keeps scenery instanced with less than 5000 added triangles", () => {
  const root = new THREE.Group();
  buildAthleticsParkScenery(root, 0, materials, addBox(root));
  let triangles = 0;
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const count = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3 * count;
    assert.equal(mesh.castShadow, false);
  });
  assert.ok(triangles < 5000, `Scenery budget exceeded: ${triangles}`);
  assert.equal((root.getObjectByName("athletics-cloud-bank") as THREE.InstancedMesh).count, 18);
  assert.equal((root.getObjectByName("athletics-start-pennants") as THREE.InstancedMesh).count, 30);
});

test("stadium oval, tree crowns and scoreboard face use their visible axes", () => {
  const root = new THREE.Group();
  const dress = buildAthleticsEnvironmentDress({ parent: root, detail: 0, isFps: true, materials,
    addBatchedBox: addBox(root), seededRandom: () => () => .5, makeLabelTexture: () => new THREE.CanvasTexture({} as HTMLCanvasElement) });
  const track = dress.root.children.find(object => (object as THREE.Mesh).geometry?.type === "RingGeometry");
  assert.equal(track?.scale.y, .74);
  const board = root.getObjectByName("athletics-scoreboard")!;
  const face = board.children.find(object => (object as THREE.Mesh).geometry?.type === "PlaneGeometry")!;
  assert.ok(face.position.z > .6, "The sign must face the infield");
  const crown = dress.root.children.find(object => (object as THREE.Mesh).geometry?.type === "IcosahedronGeometry") as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4(); crown.getMatrixAt(0, matrix);
  assert.equal(new THREE.Vector3().setFromMatrixPosition(matrix).y, 14);
});

test("athletics painted batch response does not change other maps", () => {
  const atlas = new THREE.Texture();
  const standard = new ArenaStaticBatcher(atlas, false);
  const athletics = new ArenaStaticBatcher(atlas, false, { metalness: .08, bumpScale: 0 });
  const prepare = (batch: ArenaStaticBatcher) => batch.prepare(new THREE.Mesh(new THREE.BoxGeometry()), "#ffffff", "metal").material as THREE.MeshStandardMaterial;
  assert.equal(prepare(standard).metalness, .58);
  const painted = prepare(athletics);
  assert.equal(painted.metalness, .08);
  assert.equal(painted.bumpScale, 0);
});
