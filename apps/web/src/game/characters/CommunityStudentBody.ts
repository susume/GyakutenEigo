import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CharacterMaterials } from "./CharacterEquipment";

export const COMMUNITY_STUDENT_URL = "assets/community/quizstrike-student/student.glb";

/** The public body is rebound offline to the same skeleton that owns gameplay and cosmetic sockets. */
export function buildCommunityStudentGeometry(source: THREE.BufferGeometry, previous: THREE.BufferGeometry, colors: THREE.Color[]) {
  const body = source.index ? source.toNonIndexed() : source.clone();
  const regions = body.getAttribute("_qs_region");
  if (!regions) throw new Error("Imported body is missing its palette regions");
  const bodyColors = new Float32Array(regions.count * 3);
  for (let i = 0; i < regions.count; i++) colors[Math.round(regions.getX(i))].toArray(bodyColors, i * 3);
  body.setAttribute("color", new THREE.BufferAttribute(bodyColors, 3));
  body.deleteAttribute("_qs_region");
  body.setAttribute("skinIndex", new THREE.Float32BufferAttribute(Array.from(body.getAttribute("skinIndex").array), 4));
  body.clearGroups();

  // Preserve the player's selected footwear, whose original skin indices use this same 13-bone rig.
  const legacy = previous.index ? previous.toNonIndexed() : previous;
  const positions = legacy.getAttribute("position");
  const weights = legacy.getAttribute("skinWeight"), joints = legacy.getAttribute("skinIndex");
  const selected: number[] = [];
  for (let i = 0; i < positions.count; i += 3) {
    if ([i, i + 1, i + 2].every(vertex => positions.getY(vertex) <= .23 && [11, 12].includes(joints.getX(vertex)) && weights.getX(vertex) > .5)) selected.push(i, i + 1, i + 2);
  }
  if (!selected.length) { if (legacy !== previous) legacy.dispose(); body.computeBoundingBox(); body.computeBoundingSphere(); return body; }
  const feet = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "color", "skinIndex", "skinWeight"]) {
    const attribute = legacy.getAttribute(name), data: number[] = [];
    for (const vertex of selected) for (let component = 0; component < attribute.itemSize; component++) data.push(attribute.getComponent(vertex, component));
    feet.setAttribute(name, new THREE.Float32BufferAttribute(data, attribute.itemSize));
  }
  const combined = mergeGeometries([body, feet]);
  body.dispose(); feet.dispose(); if (legacy !== previous) legacy.dispose();
  if (!combined) throw new Error("Unable to merge imported body and selected footwear");
  combined.computeBoundingBox(); combined.computeBoundingSphere();
  return combined;
}

export class CommunityStudentBodyLibrary {
  private pending?: Promise<THREE.BufferGeometry>;
  private readonly variants = new Map<string, THREE.BufferGeometry>();
  private readonly material = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: .86, metalness: .01, flatShading: true });
  private disposed = false;
  private warned = false;

  constructor(private readonly load: () => Promise<GLTF> = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(`${import.meta.env?.BASE_URL ?? "/"}${COMMUNITY_STUDENT_URL}`)) {}

  private loadGeometry() {
    if (!this.pending) this.pending = this.load().then(gltf => {
      let source: THREE.BufferGeometry | undefined;
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object instanceof THREE.SkinnedMesh) source = object.geometry;
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
      });
      if (!source) throw new Error("Community student body is missing");
      if (this.disposed) { source.dispose(); throw new Error("Body library disposed during loading"); }
      return source;
    });
    return this.pending;
  }

  async attach(mesh: THREE.SkinnedMesh, owner: THREE.Object3D, materials: CharacterMaterials, footwearId: string) {
    owner.userData.characterModelLoading = true;
    try {
      const source = await this.loadGeometry();
      if (this.disposed || owner.userData.disposed) return;
      const colors = [materials.uniform.color, materials.cloth.color, materials.skin.color, materials.dark.color];
      const key = `${footwearId}:${colors.map(color => color.getHexString()).join(":")}`;
      let geometry = this.variants.get(key);
      if (!geometry) { geometry = buildCommunityStudentGeometry(source, mesh.geometry, colors); this.variants.set(key, geometry); }
      (mesh.userData.releaseSharedStudentBody as (() => void) | undefined)?.();
      delete mesh.userData.releaseSharedStudentBody;
      mesh.geometry = geometry; mesh.material = this.material;
      mesh.name = "community_student_gameplay_body";
      mesh.userData.geometryStats = { ...mesh.userData.geometryStats, triangles: geometry.getAttribute("position").count / 3 };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      owner.userData.characterModelSource = "kenney-retargeted";
    } catch (error) {
      if (!this.disposed && !this.warned) { this.warned = true; console.warn("[QuizStrike] community body unavailable; using built-in fallback", error); }
    } finally { owner.userData.characterModelLoading = false; }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.variants.forEach(geometry => geometry.dispose()); this.variants.clear(); this.material.dispose();
    void this.pending?.then(geometry => geometry.dispose()).catch(() => undefined);
  }
}
