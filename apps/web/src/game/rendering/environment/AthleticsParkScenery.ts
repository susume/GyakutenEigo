import * as THREE from "three";
import type { AthleticsDressMaterials } from "./AthleticsEnvironmentDress";

type SceneryBox = (size: [number, number, number], position: [number, number, number], material: THREE.MeshStandardMaterial,
  surface?: "stone" | "wood" | "metal" | "sand" | "accent", rotation?: [number, number, number]) => THREE.Mesh;

const instance = (root: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material,
  placements: Array<{ position: [number, number, number]; scale: [number, number, number]; rotation?: number }>) => {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  mesh.name = name;
  const transform = new THREE.Object3D();
  placements.forEach((placement, index) => {
    transform.position.set(...placement.position); transform.scale.set(...placement.scale);
    transform.rotation.set(0, placement.rotation ?? 0, 0); transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
};

/** Authored park props. All stay outside the shared course's jump corridors. */
export const buildAthleticsParkScenery = (root: THREE.Group, detail: number, materials: AthleticsDressMaterials, box: SceneryBox) => {
  const accents = [materials.cyan, materials.orange, materials.lime, materials.violet, materials.pink, materials.gold];
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: "#a3cf9a", roughness: .96 }));
  meadow.name = "athletics-surrounding-meadow";
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.y = -1.25;
  meadow.receiveShadow = true;
  root.add(meadow);
  // Festival wall panels replace the featureless dark perimeter without
  // lowering the visible wall below its existing collision boundary.
  for (let index = 0; index < 12; index += 1) {
    const coordinate = -121 + index * 22;
    const color = accents[Math.floor(index / 2) % accents.length]!;
    box([20, 3.2, .12], [coordinate, 7.7, 137.94], color, "accent");
    box([20, 3.2, .12], [coordinate, 7.7, -137.94], color, "accent");
    box([.12, 3.2, 20], [-137.94, 7.7, coordinate], color, "accent");
    box([.12, 3.2, 20], [137.94, 7.7, coordinate], color, "accent");
  }
  box([280, .38, 4.2], [0, 11.1, 140], materials.cream, "sand");
  box([280, .38, 4.2], [0, 11.1, -140], materials.cream, "sand");
  box([4.2, .38, 280], [-140, 11.1, 0], materials.cream, "sand");
  box([4.2, .38, 280], [140, 11.1, 0], materials.cream, "sand");

  const hillMaterial = new THREE.MeshStandardMaterial({ color: "#7fbfac", roughness: .96, flatShading: true });
  const hillCount = detail === 0 ? 8 : 12;
  instance(root, "athletics-distant-hills", new THREE.ConeGeometry(1, 1, 7), hillMaterial,
    Array.from({ length: hillCount }, (_, index) => {
      const angle = index / hillCount * Math.PI * 2;
      const height = 22 + (index % 4) * 9;
      return { position: [Math.cos(angle) * 245, height / 2 - 4, Math.sin(angle) * 245] as [number, number, number],
        scale: [38 + (index % 3) * 9, height, 34] as [number, number, number], rotation: angle };
    }));
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: "#f1fbfa", fog: false });
  const cloudPlacements = Array.from({ length: detail === 0 ? 6 : 10 }, (_, index) => {
    const angle = index * 2.4;
    return Array.from({ length: 3 }, (_, puff) => ({
      position: [Math.cos(angle) * 240 + (puff - 1) * 15, 85 + (index % 3) * 18 + (puff === 1 ? 3 : 0), Math.sin(angle) * 240] as [number, number, number],
      scale: [18, puff === 1 ? 9 : 6, 8] as [number, number, number]
    }));
  }).flat();
  instance(root, "athletics-cloud-bank", new THREE.SphereGeometry(1, 8, 6), cloudMaterial, cloudPlacements).receiveShadow = false;

  // The canyon has recognizable rock banks, with an eight-unit clearance
  // from the beam edge and no tall decoration across its sightline.
  const rockMaterial = new THREE.MeshStandardMaterial({ color: "#e7b58c", roughness: .96, flatShading: true });
  instance(root, "athletics-canyon-rocks", new THREE.DodecahedronGeometry(1), rockMaterial,
    [-123, -97].flatMap((x, bank) => [18, 39, 60, 81].map((z, index) => ({
      position: [x, 1.6, z + bank * 3] as [number, number, number],
      scale: [3.4, 2.8 + index % 2, 6] as [number, number, number], rotation: index * .7
    }))));

  // Garden islands and shade pavilions occupy the empty infield rather
  // than filling landing gaps with apparently walkable scenery.
  const gardens: Array<[number, number]> = [[-82, 44], [80, 48], [10, 20]];
  for (const [index, [x, z]] of gardens.entries()) {
    const accent = accents[index * 2 + 1]!;
    box([13, .8, 10], [x, .4, z], materials.cream, "sand");
    box([11.8, .1, 8.8], [x, .86, z], materials.turfLight, "sand");
    for (const side of [-1, 1]) box([.35, 7, .35], [x + side * 5.5, 3.5, z], materials.metal, "metal");
    box([14, .3, 11], [x, 7.15, z], accent, "accent", [0, 0, -.08]);
    box([8, .5, 1.8], [x, 1.5, z + 6.5], materials.trunk, "wood");
  }

  // A lookout silhouette gives the high terraces a destination visible
  // from the stairs. Its foot sits beyond the east edge of the race lane.
  const lookout = new THREE.Group(); lookout.name = "athletics-summit-lookout"; root.add(lookout);
  for (const x of [127, 133]) for (const z of [70, 76]) box([.75, 40, .75], [x, 20, z], materials.stadiumDark, "stone");
  box([11, .8, 12], [130, 40.4, 73], materials.cream, "sand");
  for (const x of [127, 133]) for (const z of [70, 76]) box([.4, 6, .4], [x, 43.7, z], materials.gold, "accent");
  box([13, .45, 14], [130, 46.9, 73], materials.gold, "accent");
  box([.35, 9, .35], [130, 51.5, 73], materials.metal, "metal");
  box([4, 2, .15], [132, 54, 73], materials.pink, "accent");

  // In-world start bunting is static and sits above the player's view.
  const pennantGeometry = new THREE.BufferGeometry();
  pennantGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, 0, 0, 0, -2.2, 0, 1, 0, 0], 3));
  pennantGeometry.computeVertexNormals();
  const pennant = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: .85, side: THREE.DoubleSide });
  const flags = instance(root, "athletics-start-pennants", pennantGeometry, pennant,
    Array.from({ length: 30 }, (_, index) => ({ position: [-113 + index * 7.8, 15 - Math.sin(index / 29 * Math.PI) * 1.2, 136] as [number, number, number], scale: [1, 1, 1] as [number, number, number] })));
  for (let index = 0; index < flags.count; index += 1) flags.setColorAt(index, accents[index % accents.length]!.color);
  if (flags.instanceColor) flags.instanceColor.needsUpdate = true;
  flags.receiveShadow = false;
};
