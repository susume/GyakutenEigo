import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type StaticSurface = "stone" | "wood" | "metal" | "sand" | "gravel" | "cloth" | "accent";

const surfaceTile: Record<StaticSurface, [number, number]> = {
  stone: [0, 1],
  wood: [1, 1],
  metal: [0, 0],
  sand: [1, 0],
  gravel: [1, 0],
  cloth: [0, 1],
  accent: [0, 0]
};

const normalizeSurface = (surface: string): StaticSurface =>
  surface === "wood" || surface === "metal" || surface === "sand" || surface === "gravel" || surface === "cloth" || surface === "accent"
    ? surface
    : "stone";

export const makeSurfaceAtlas = (textures: {
  stone: THREE.Texture;
  wood: THREE.Texture;
  metal: THREE.Texture;
  sand: THREE.Texture;
}) => {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 2048;
  const context = canvas.getContext("2d")!;
  context.drawImage(textures.metal.image as CanvasImageSource, 0, 0, 1024, 1024);
  context.drawImage(textures.sand.image as CanvasImageSource, 1024, 0, 1024, 1024);
  context.drawImage(textures.stone.image as CanvasImageSource, 0, 1024, 1024, 1024);
  context.drawImage(textures.wood.image as CanvasImageSource, 1024, 1024, 1024, 1024);
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.wrapS = THREE.ClampToEdgeWrapping;
  atlas.wrapT = THREE.ClampToEdgeWrapping;
  return atlas;
};

export class ArenaStaticBatcher {
  private readonly materials = new Map<StaticSurface, THREE.MeshStandardMaterial>();

  constructor(private readonly atlas: THREE.Texture, private readonly castShadow: boolean) {}

  private materialFor(surfaceName: string) {
    const surface = normalizeSurface(surfaceName);
    const cached = this.materials.get(surface);
    if (cached) return cached;
    const isMetal = surface === "metal";
    const isAccent = surface === "accent";
    const options: THREE.MeshStandardMaterialParameters = {
      color: "#ffffff",
      map: this.atlas,
      bumpScale: isMetal ? 0.018 : 0.045,
      roughness: isMetal ? 0.46 : surface === "cloth" ? 0.88 : 0.72,
      metalness: isMetal ? 0.58 : 0.02,
      vertexColors: true,
      emissive: isAccent ? "#ffffff" : "#000000",
      emissiveIntensity: isAccent ? 0.1 : 0
    };
    if (surface !== "cloth" && !isAccent) options.bumpMap = this.atlas;
    const material = new THREE.MeshStandardMaterial(options);
    material.name = `arena_atlas_${surface}`;
    this.materials.set(surface, material);
    return material;
  }

  prepare(mesh: THREE.Mesh, color: string, surfaceName: string) {
    const surface = normalizeSurface(surfaceName);
    const sourceGeometry = mesh.geometry;
    const geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
    const tint = new THREE.Color(color);
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let index = 0; index < colors.length; index += 3) {
      colors[index] = tint.r;
      colors[index + 1] = tint.g;
      colors[index + 2] = tint.b;
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
    if (uv) {
      const [tileX, tileY] = surfaceTile[surface];
      for (let index = 0; index < uv.count; index += 1) {
        uv.setXY(index, 0.02 + tileX * 0.5 + uv.getX(index) * 0.46, 0.02 + tileY * 0.5 + uv.getY(index) * 0.46);
      }
      uv.needsUpdate = true;
    }
    mesh.geometry = geometry;
    sourceGeometry.dispose();
    mesh.material = this.materialFor(surface);
    mesh.userData.staticFacade = true;
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = true;
    return mesh;
  }

  flush(scene: THREE.Scene) {
    scene.updateMatrixWorld(true);
    const groups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; sources: THREE.Mesh[] }>();
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.userData.staticFacade || Array.isArray(mesh.material)) return;
      const entry = groups.get(mesh.material.uuid) ?? { material: mesh.material, geometries: [], sources: [] };
      entry.geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
      entry.sources.push(mesh);
      groups.set(mesh.material.uuid, entry);
    });
    let sourceMeshes = 0;
    let batchMeshes = 0;
    groups.forEach((entry) => {
      if (entry.geometries.length === 0) return;
      const geometry = mergeGeometries(entry.geometries, false);
      if (!geometry) return;
      const batch = new THREE.Mesh(geometry, entry.material);
      batch.name = `static_facade_batch_${entry.material.name}`;
      batch.castShadow = this.castShadow;
      batch.receiveShadow = true;
      scene.add(batch);
      entry.sources.forEach((source) => {
        source.parent?.remove(source);
        source.geometry.dispose();
      });
      sourceMeshes += entry.sources.length;
      batchMeshes += 1;
    });
    return { sourceMeshes, batchMeshes };
  }

  dispose() {
    this.materials.forEach((material) => material.dispose());
    this.atlas.dispose();
  }
}
