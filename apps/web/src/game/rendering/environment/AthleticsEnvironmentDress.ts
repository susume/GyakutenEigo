import * as THREE from "three";

type AddBatchedBox = (
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.MeshStandardMaterial,
  surface?: "stone" | "wood" | "metal" | "sand" | "accent",
  rotation?: [number, number, number]
) => THREE.Mesh;

export type AthleticsDressMaterials = {
  turf: THREE.MeshStandardMaterial;
  turfLight: THREE.MeshStandardMaterial;
  track: THREE.MeshStandardMaterial;
  trackLine: THREE.MeshStandardMaterial;
  stadium: THREE.MeshStandardMaterial;
  stadiumDark: THREE.MeshStandardMaterial;
  stadiumRoof: THREE.MeshStandardMaterial;
  seatBlue: THREE.MeshStandardMaterial;
  seatCoral: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  cream: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  foliageLight: THREE.MeshStandardMaterial;
  trunk: THREE.MeshStandardMaterial;
  cyan: THREE.MeshStandardMaterial;
  orange: THREE.MeshStandardMaterial;
  lime: THREE.MeshStandardMaterial;
  violet: THREE.MeshStandardMaterial;
  pink: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
};

export type AthleticsEnvironmentDress = {
  root: THREE.Group;
  update: (nowMs: number) => void;
};

const addMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const addBox = (
  parent: THREE.Object3D,
  material: THREE.Material,
  size: [number, number, number],
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
) => addMesh(parent, new THREE.BoxGeometry(...size), material, position, rotation);

const addRoundedTrack = (
  parent: THREE.Object3D,
  material: THREE.Material,
  radius: number,
  width: number,
  scaleZ: number,
  y: number
) => {
  const track = addMesh(parent, new THREE.RingGeometry(radius, radius + width, 72), material, [0, y, 0], [-Math.PI / 2, 0, 0]);
  track.scale.z = scaleZ;
  track.receiveShadow = true;
  return track;
};

const addSeatRows = (
  root: THREE.Group,
  detail: number,
  seatBlue: THREE.MeshStandardMaterial,
  seatCoral: THREE.MeshStandardMaterial
) => {
  const seatGeometry = new THREE.BoxGeometry(2.5, 0.76, 1.55);
  const seatsPerRow = detail === 0 ? 14 : 22;
  const rowCount = detail === 0 ? 2 : 3;
  const totalSeats = seatsPerRow * rowCount;
  const blueSeats = new THREE.InstancedMesh(seatGeometry, seatBlue, Math.ceil(totalSeats / 2));
  const coralSeats = new THREE.InstancedMesh(seatGeometry, seatCoral, Math.floor(totalSeats / 2));
  const matrix = new THREE.Matrix4();
  let blueIndex = 0;
  let coralIndex = 0;
  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < seatsPerRow; column += 1) {
      const x = -((seatsPerRow - 1) * 5.5) / 2 + column * 5.5;
      const y = 3 + row * 3.2;
      const z = -109 - row * 4.2;
      matrix.makeTranslation(x, y, z);
      if ((column + row) % 2 === 0) blueSeats.setMatrixAt(blueIndex++, matrix);
      else coralSeats.setMatrixAt(coralIndex++, matrix);
    }
  }
  blueSeats.count = blueIndex;
  coralSeats.count = coralIndex;
  blueSeats.instanceMatrix.needsUpdate = true;
  coralSeats.instanceMatrix.needsUpdate = true;
  blueSeats.castShadow = false;
  coralSeats.castShadow = false;
  blueSeats.receiveShadow = true;
  coralSeats.receiveShadow = true;
  root.add(blueSeats, coralSeats);
};

const addGrandstand = (
  root: THREE.Group,
  detail: number,
  addBatchedBox: AddBatchedBox,
  materials: AthleticsDressMaterials
) => {
  const stand = new THREE.Group();
  stand.name = "athletics-north-grandstand";
  root.add(stand);
  const rows = detail === 0 ? 3 : 4;
  for (let row = 0; row < rows; row += 1) {
    addBatchedBox(
      [218 - row * 8, 3.2, 8.2],
      [0, 1.6 + row * 3.1, -119 - row * 3.9],
      row % 2 === 0 ? materials.stadium : materials.stadiumDark,
      "stone"
    );
  }
  addSeatRows(stand, detail, materials.seatBlue, materials.seatCoral);
  addBatchedBox([228, 1.2, 13], [0, 18, -126], materials.stadiumRoof, "metal", [0.025, 0, 0]);
  addBatchedBox([228, 0.34, 1.2], [0, 16.7, -119], materials.gold, "accent");

  const supportPositions = detail === 0 ? [-92, 0, 92] : [-98, -49, 0, 49, 98];
  supportPositions.forEach((x) => addBatchedBox([1.3, 19, 1.3], [x, 9.5, -125.6], materials.metal, "metal"));
};

const addSideStand = (
  root: THREE.Group,
  x: number,
  rotationY: number,
  detail: number,
  addBatchedBox: AddBatchedBox,
  materials: AthleticsDressMaterials
) => {
  const stand = new THREE.Group();
  stand.name = x < 0 ? "athletics-west-grandstand" : "athletics-east-grandstand";
  stand.rotation.y = rotationY;
  stand.position.x = x;
  root.add(stand);
  const toWorld = (localX: number, localZ: number): [number, number] => [
    x + Math.cos(rotationY) * localX + Math.sin(rotationY) * localZ,
    -Math.sin(rotationY) * localX + Math.cos(rotationY) * localZ
  ];
  const rows = detail === 2 ? 3 : 2;
  for (let row = 0; row < rows; row += 1) {
    const [rowX, rowZ] = toWorld(0, 0 - row * 3.7);
    addBatchedBox([112 - row * 8, 2.8, 7], [rowX, 1.4 + row * 2.8, rowZ], row % 2 ? materials.stadiumDark : materials.stadium, "stone", [0, rotationY, 0]);
  }
  const [roofX, roofZ] = toWorld(0, -4);
  addBatchedBox([120, 0.9, 10], [roofX, 10.6, roofZ], materials.stadiumRoof, "metal", [0, rotationY, 0]);
  const seatGeometry = new THREE.BoxGeometry(2, 0.62, 1.3);
  const seats = new THREE.InstancedMesh(seatGeometry, x < 0 ? materials.seatBlue : materials.seatCoral, detail === 0 ? 12 : 20);
  const matrix = new THREE.Matrix4();
  const count = seats.count;
  for (let index = 0; index < count; index += 1) {
    matrix.makeTranslation(-54 + index * (108 / Math.max(1, count - 1)), 3 + (index % rows) * 2.8, -7 - (index % rows) * 3.7);
    seats.setMatrixAt(index, matrix);
  }
  seats.instanceMatrix.needsUpdate = true;
  seats.castShadow = false;
  stand.add(seats);
};

const addScoreboard = (
  root: THREE.Group,
  addBatchedBox: AddBatchedBox,
  materials: AthleticsDressMaterials,
  makeLabelTexture?: (label: string, color?: string, background?: string) => THREE.CanvasTexture
) => {
  const board = new THREE.Group();
  board.name = "athletics-scoreboard";
  board.position.set(0, 0, -128);
  root.add(board);
  addBatchedBox([1.4, 30, 1.4], [-20, 15, -128], materials.metal, "metal");
  addBatchedBox([1.4, 30, 1.4], [20, 15, -128], materials.metal, "metal");
  const panel = addBox(board, materials.stadiumDark, [43, 13, 1.2], [0, 28, 0]);
  panel.castShadow = true;
  addBox(board, materials.gold, [39.5, 0.42, 0.14], [0, 34.05, -0.66]);
  addBox(board, materials.cyan, [0.42, 8.4, 0.14], [-19.2, 28, -0.66]);
  addBox(board, materials.orange, [0.42, 8.4, 0.14], [19.2, 28, -0.66]);
  if (makeLabelTexture) {
    const texture = makeLabelTexture("SKYLINE GAMES  •  RACE DAY", "#fff5d6", "#18324a");
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(37, 5.2),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    face.position.set(0, 28.6, -0.67);
    board.add(face);
  }
};

const addLightTowers = (
  root: THREE.Group,
  detail: number,
  addBatchedBox: AddBatchedBox,
  materials: AthleticsDressMaterials
) => {
  const positions: Array<[number, number, number]> = detail === 0
    ? [[-126, 0, -100], [126, 0, -100], [0, 0, -129]]
    : [[-126, 0, -100], [126, 0, -100], [-126, 0, 78], [126, 0, 78], [0, 0, -129]];
  positions.forEach(([x, y, z], index) => {
    const tower = new THREE.Group();
    tower.name = `athletics-light-tower-${index}`;
    tower.position.set(x, y, z);
    root.add(tower);
    addBatchedBox([1.1, 22, 1.1], [x, y + 11, z], materials.metal, "metal");
    addBatchedBox([7.2, 0.6, 1.1], [x, y + 21.4, z], materials.metal, "metal");
    const lamp = addBox(tower, materials.gold, [1.4, 0.5, 2.2], [0, 21, 0]);
    lamp.castShadow = false;
    if (detail > 0 && index < (detail === 2 ? positions.length : 3)) {
      const light = new THREE.PointLight("#ffe0a3", detail === 2 ? 8 : 5, 46, 2);
      light.position.set(0, 20.7, 0);
      tower.add(light);
    }
  });
};

const addVegetation = (
  root: THREE.Group,
  detail: number,
  materials: AthleticsDressMaterials,
  seededRandom: (seed: number) => () => number
) => {
  const count = detail === 0 ? 10 : detail === 1 ? 16 : 24;
  const trunkGeometry = new THREE.CylinderGeometry(0.7, 1.05, 7, 8);
  const foliageGeometry = new THREE.IcosahedronGeometry(4.4, 1);
  const trunks = new THREE.InstancedMesh(trunkGeometry, materials.trunk, count);
  const lightCount = Math.ceil(count / 3);
  const foliage = new THREE.InstancedMesh(foliageGeometry, materials.foliage, count - lightCount);
  const lightFoliage = new THREE.InstancedMesh(foliageGeometry, materials.foliageLight, lightCount);
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const random = seededRandom(82417);
  let foliageIndex = 0;
  let lightFoliageIndex = 0;
  for (let index = 0; index < count; index += 1) {
    const edge = index % 4;
    const progress = random() * 2 - 1;
    const x = edge === 0 ? -128 - random() * 5 : edge === 1 ? 128 + random() * 5 : progress * 128;
    const z = edge === 2 ? -126 - random() * 5 : edge === 3 ? 126 + random() * 5 : progress * 126;
    const y = 3.5;
    scale.set(0.8 + random() * 0.42, 0.9 + random() * 0.65, 0.8 + random() * 0.42);
    matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI, 0)), scale);
    trunks.setMatrixAt(index, new THREE.Matrix4().makeTranslation(x, 3.5, z));
    if (index % 3 === 0) lightFoliage.setMatrixAt(lightFoliageIndex++, matrix);
    else foliage.setMatrixAt(foliageIndex++, matrix);
  }
  trunks.instanceMatrix.needsUpdate = true;
  foliage.instanceMatrix.needsUpdate = true;
  lightFoliage.instanceMatrix.needsUpdate = true;
  foliage.count = foliageIndex;
  lightFoliage.count = lightFoliageIndex;
  trunks.castShadow = detail === 2;
  foliage.castShadow = detail === 2;
  lightFoliage.castShadow = detail === 2;
  trunks.receiveShadow = true;
  foliage.receiveShadow = true;
  lightFoliage.receiveShadow = true;
  root.add(trunks, foliage, lightFoliage);
};

const addBanners = (root: THREE.Group, detail: number, materials: AthleticsDressMaterials) => {
  const bannerMaterials = [materials.cyan, materials.orange, materials.lime, materials.violet, materials.pink, materials.gold];
  const banners: THREE.Group[] = [];
  const count = detail === 0 ? 4 : 8;
  for (let index = 0; index < count; index += 1) {
    const group = new THREE.Group();
    group.name = `athletics-banner-${index}`;
    const edge = index % 4;
    const progress = Math.floor(index / 4) * 0.5 + 0.25;
    const x = edge === 0 ? -132 : edge === 1 ? 132 : -110 + progress * 220;
    const z = edge === 2 ? -132 : edge === 3 ? 132 : -110 + progress * 220;
    group.position.set(x, 13, z);
    group.rotation.y = edge < 2 ? Math.PI / 2 : 0;
    const pole = addBox(group, materials.metal, [0.35, 13, 0.35], [0, -6.5, 0]);
    pole.castShadow = false;
    const banner = addMesh(
      group,
      new THREE.PlaneGeometry(4.2, 6.2, 6, 1),
      bannerMaterials[index % bannerMaterials.length],
      [0, -2.7, 0]
    );
    banner.castShadow = false;
    banner.receiveShadow = false;
    group.userData.banner = banner;
    root.add(group);
    banners.push(group);
  }
  return banners;
};

/**
 * Adds the authored stadium shell around the movement course. Its visuals are
 * deliberately non-collidable: the server and client continue to use the
 * compact rectangular Athletics proxies for movement and recovery.
 */
export const buildAthleticsEnvironmentDress = ({
  parent,
  detail,
  isFps,
  addBatchedBox,
  materials,
  seededRandom,
  makeLabelTexture
}: {
  parent: THREE.Group;
  detail: number;
  isFps: boolean;
  addBatchedBox: AddBatchedBox;
  materials: AthleticsDressMaterials;
  seededRandom: (seed: number) => () => number;
  makeLabelTexture?: (label: string, color?: string, background?: string) => THREE.CanvasTexture;
}) : AthleticsEnvironmentDress => {
  const root = new THREE.Group();
  root.name = "athletics-authored-stadium-dress";
  parent.add(root);

  // A layered oval track and field establish a recognizable sporting arena
  // beneath the floating route without changing any walkable surface.
  addRoundedTrack(root, materials.track, 78, 38, 0.74, 0.04);
  addRoundedTrack(root, materials.trackLine, 80.5, 0.62, 0.74, 0.085);
  addRoundedTrack(root, materials.trackLine, 91, 0.48, 0.74, 0.088);
  addRoundedTrack(root, materials.trackLine, 101.5, 0.48, 0.74, 0.091);
  const infield = addMesh(root, new THREE.CircleGeometry(77.5, 72), materials.turf, [0, 0.045, 0], [-Math.PI / 2, 0, 0]);
  infield.scale.z = 0.74;
  infield.receiveShadow = true;
  for (let index = -4; index <= 4; index += 1) {
    addBatchedBox([132, 0.07, 1.25], [0, 0.13, index * 9], index % 2 === 0 ? materials.turfLight : materials.turf, "sand");
  }

  addGrandstand(root, detail, addBatchedBox, materials);
  if (!isFps && detail > 0) {
    addSideStand(root, -123, Math.PI / 2, detail, addBatchedBox, materials);
    addSideStand(root, 123, -Math.PI / 2, detail, addBatchedBox, materials);
  }
  addScoreboard(root, addBatchedBox, materials, makeLabelTexture);
  addLightTowers(root, detail, addBatchedBox, materials);
  addVegetation(root, detail, materials, seededRandom);
  const banners = addBanners(root, detail, materials);

  // Small perimeter rails and sponsor blocks add scale while leaving the
  // actual route and course sightlines open.
  for (const x of [-110, 110]) {
    addBatchedBox([0.7, 2.4, 144], [x, 1.2, 0], materials.stadiumDark, "metal");
    for (let z = -105; z <= 105; z += 35) addBatchedBox([1.2, 3.4, 1.2], [x, 1.7, z], materials.gold, "accent");
  }

  return {
    root,
    update: (nowMs: number) => {
      banners.forEach((banner, index) => {
        const cloth = banner.userData.banner as THREE.Mesh | undefined;
        if (cloth) {
          cloth.rotation.z = Math.sin(nowMs * 0.0022 + index * 0.8) * 0.055;
          cloth.rotation.y = Math.sin(nowMs * 0.0017 + index) * 0.12;
        }
        banner.rotation.z = Math.sin(nowMs * 0.0014 + index * 0.6) * 0.018;
      });
    }
  };
};
