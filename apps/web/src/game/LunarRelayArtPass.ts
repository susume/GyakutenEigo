import * as THREE from "three";
import { LUNAR_RELAY_LAYOUT_BLOCKS, LUNAR_RELAY_STAIR_FLIGHTS, scaleArenaValue } from "@quizstrike/shared";

type AddMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, surface?: string) => THREE.Mesh;

/** Architecture details sit on the shared cover; the skyline is outside bounds.
 * The original landmarks survive Low; small panels and stars scale by quality. */
export const addLunarRelayArtPass = (scene: THREE.Scene, addMesh: AddMesh, detail: number) => {
  const root = new THREE.Group();
  root.name = "lunar_relay_art";
  scene.add(root);
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, surface = "metal") => {
    const mesh = addMesh(root, new THREE.BoxGeometry(w, h, d), color, surface);
    mesh.position.set(x, y, z);
    return mesh;
  };

  // Quiet, broad flooring separates the routes; markings never act as cover.
  box(0, -.015, scaleArenaValue(-55), scaleArenaValue(310), .03, scaleArenaValue(30), "#59728c");
  box(0, -.015, scaleArenaValue(112), scaleArenaValue(312), .03, scaleArenaValue(78), "#718695");
  for (const z of [-70, -40]) box(0, .025, scaleArenaValue(z), scaleArenaValue(312), .04, .14, "#89b5c7", "accent");
  for (const z of [73, 151]) box(0, .025, scaleArenaValue(z), scaleArenaValue(312), .04, .14, "#d7af69", "accent");
  for (const side of [-1, 1]) {
    for (const z of [-120, -40, 40, 120]) {
      box(scaleArenaValue(side * 206), .015, scaleArenaValue(z), scaleArenaValue(48), .04, scaleArenaValue(22), side < 0 ? "#4c7190" : "#926879");
    }
    for (let i = 0; i < 10; i++) {
      box(scaleArenaValue(side * (20 + i * 15)), .03, scaleArenaValue(112), 3.2, .05, .2, "#dac293", "accent");
    }
  }

  for (const block of LUNAR_RELAY_LAYOUT_BLOCKS) {
    if (block.id.includes("deck") || block.id.includes("crossing") || block.id.includes("pier") || block.id.includes("bridge-rail")) continue;
    const x = scaleArenaValue(block.x), z = scaleArenaValue(block.z);
    const w = scaleArenaValue(block.w), d = scaleArenaValue(block.d);
    const bottom = (block.y ?? block.h / 2) - block.h / 2;
    // Flush bands and ribs keep familiar cover silhouettes at all quality levels.
    box(x, bottom + block.h - .2, z, w + .14, .35, d + .14, "#dae4e9");
    if (detail > 0) {
      for (const face of [-1, 1]) {
        box(x, bottom + block.h * .62, z + face * (d / 2 + .035), w * .84, .16, .07,
          block.id.includes("cargo") ? "#eee4c3" : "#87cfce", "accent");
      }
      if (block.id.includes("habitat") || block.id.includes("cargo")) {
        const ribs = Math.max(2, Math.floor(w / 5));
        for (let i = 0; i <= ribs; i++) for (const face of [-1, 1]) {
          box(x - w / 2 + i * w / ribs, bottom + block.h / 2, z + face * (d / 2 + .035), .16, block.h * .95, .12, "#dee5e5");
        }
      }
    }
  }

  for (const side of [-1, 1]) {
    const x = scaleArenaValue(side * 58);
    box(x, 20.3, 0, 3.2, .3, scaleArenaValue(26), "#85eed9", "accent");
    for (const z of [-11, 11]) box(x, 16, scaleArenaValue(z), 3.25, .5, 3.25, "#85eed9", "accent");
  }
  // Observatory canopy sits on its real overhead collider.
  const observatoryDome = addMesh(root, new THREE.SphereGeometry(1, detail === 0 ? 16 : 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), "#7bafbc", "metal");
  observatoryDome.position.set(0, 13, scaleArenaValue(-127));
  observatoryDome.scale.set(22, 12, 13);
  const observatoryRim = addMesh(root, new THREE.TorusGeometry(1, .025, 6, 36), "#85eed9", "accent");
  observatoryRim.position.copy(observatoryDome.position);
  observatoryRim.rotation.x = Math.PI / 2;
  observatoryRim.scale.set(22, 13, 1);
  for (const x of [-31, 31]) box(scaleArenaValue(x), 9.4, scaleArenaValue(-125), .1, 1.3, 23, "#85eed9", "accent");

  // Light strips mark all four real stair flights and their landings.
  for (const flight of LUNAR_RELAY_STAIR_FLIGHTS) {
    for (let i = 0; i < flight.steps; i += detail === 0 ? 4 : 2) {
      const travel = (-.5 + (i + .5) / flight.steps) * flight.length * flight.direction;
      const x = scaleArenaValue(flight.x + (flight.axis === "x" ? travel : 0));
      const z = scaleArenaValue(flight.z + (flight.axis === "z" ? travel : 0));
      box(x, (i + 1) / flight.steps * flight.endY + .035, z,
        flight.axis === "x" ? .13 : scaleArenaValue(flight.width) * .9, .07,
        flight.axis === "z" ? .13 : scaleArenaValue(flight.width) * .9, "#85eed9", "accent");
    }
  }
  for (const z of [-15, 15]) {
    box(0, 10.03, scaleArenaValue(z), scaleArenaValue(166), .07, .18, "#85eed9", "accent");
  }

  for (const side of [-1, 1]) {
    const x = scaleArenaValue(side * 100), z = scaleArenaValue(-116);
    const dome = addMesh(root, new THREE.SphereGeometry(1, detail === 0 ? 16 : 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), "#83a6b8", "metal");
    dome.position.set(x, 13, z);
    dome.scale.set(14, 8, 8.5);
    const rim = addMesh(root, new THREE.TorusGeometry(1, .035, 5, 32), "#d4e4e8", "metal");
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 13.2, z);
    rim.scale.set(14, 8.5, 1);
    for (const dz of [-8.73, 8.73]) box(x, 8.2, z + dz, 23, 2.7, .12, "#243a53");
    // The solar wings stay inside the matching five-unit-high cover footprint.
    const solarX = scaleArenaValue(side * 78), solarZ = scaleArenaValue(54);
    const cells = detail === 0 ? 4 : 8;
    for (let index = 0; index < cells; index++) {
      box(solarX - 9 + (index + .5) * 18 / cells, 5.04, solarZ,
        18 / cells - .14, .08, 4.6, index % 2 ? "#497c9c" : "#315b86");
    }
    // Beacon fins are placed on existing spawn screens, above player height.
    for (const rz of [-120, -40, 40, 120]) {
      const sx = scaleArenaValue(side * 172), sz = scaleArenaValue(rz);
      box(sx, 8.6, sz, 1.8, 1.2, 13, side < 0 ? "#87ceef" : "#ed9c96", "accent");
    }
    // A folded satellite boom above the habitat gives each base a silhouette.
    box(x, 24, z, .7, 10, .7, "#cad8e3");
    const receiver = addMesh(root, new THREE.TorusGeometry(4.5, .4, 6, 24), "#c9e2e8", "metal");
    receiver.position.set(x, 29, z);
    receiver.rotation.y = side * .45;
    box(x, 29, z, 1, 1, 1, "#85eed9", "accent");
  }

  // Tall orbital dish beyond the north wall: no invisible gameplay obstacle.
  const antenna = new THREE.Group();
  antenna.name = "lunar_relay_orbital_dish";
  antenna.position.set(0, 0, -142);
  root.add(antenna);
  const mast = addMesh(antenna, new THREE.CylinderGeometry(2, 4, 38, 8), "#8096ac", "metal");
  mast.position.y = 19;
  const dish = addMesh(antenna, new THREE.SphereGeometry(24, detail === 0 ? 16 : 28, 8, 0, Math.PI * 2, 0, .9), "#d6e3e9", "metal");
  dish.position.y = 21;
  dish.rotation.x = .55;
  const dishRing = addMesh(antenna, new THREE.TorusGeometry(19, .7, 6, 40), "#85eed9", "accent");
  dishRing.position.set(0, 35, 8.5);
  dishRing.rotation.x = Math.PI / 2 + .55;

  // Low draw-call lunar terrain: an apron and one instanced rock silhouette.
  const apron = addMesh(root, new THREE.BoxGeometry(570, .6, 470), "#73839a", "sand");
  apron.position.y = -.7;
  const rockCount = detail === 0 ? 20 : detail === 1 ? 32 : 44;
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: "#78879c", roughness: 1 }), rockCount);
  rocks.name = "lunar_relay_exterior_rocks";
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rockCount; i++) {
    const side = i % 4, along = Math.floor(i / 4) / Math.ceil(rockCount / 4) * 2 - 1;
    const radius = 12 + i % 4 * 5;
    dummy.position.set(side < 2 ? along * 210 : (side === 2 ? -1 : 1) * (180 + radius),
      2, side < 2 ? (side === 0 ? -1 : 1) * (140 + radius) : along * 155);
    dummy.scale.set(radius, 8 + i % 3 * 7, radius * .8);
    dummy.rotation.set(.2, i * .63, .15);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  root.add(rocks);

  // The ringed planet and star field are a sky layer, beyond the play space.
  const planetRoot = new THREE.Group();
  planetRoot.name = "lunar_relay_ringed_planet";
  planetRoot.position.set(-128, 82, -255);
  planetRoot.rotation.z = -.24;
  root.add(planetRoot);
  const planetGeometry = new THREE.SphereGeometry(62, detail === 0 ? 24 : 40, 24);
  const positions = planetGeometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const tint = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const latitude = positions.getY(i) / 62;
    const band = Math.sin(latitude * 25) * .04 + Math.sin(latitude * 47) * .02;
    const light = .58 + Math.max(0, (positions.getX(i) * -.7 + positions.getY(i) * .5 + positions.getZ(i) * .5) / 62) * .4;
    tint.setRGB((.85 + band) * light, (.65 + band) * light, (.57 + band) * light);
    tint.toArray(colors, i * 3);
  }
  planetGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  planetRoot.add(new THREE.Mesh(planetGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
  for (const [inner, outer, color] of [[77, 93, "#b5a4b9"], [95, 108, "#7e91ac"]] as const) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, detail === 0 ? 48 : 80),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = -Math.PI / 2 + .24;
    planetRoot.add(ring);
  }
  const starCount = detail === 0 ? 100 : detail === 1 ? 200 : 320;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const angle = i * 2.399963, y = 90 + (i * 73 % 230);
    const radius = Math.sqrt(430 * 430 - y * y);
    starPositions.set([Math.cos(angle) * radius, y, Math.sin(angle) * radius], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: "#d5e5ff", size: detail === 0 ? .9 : 1.1, fog: false, sizeAttenuation: true }));
  stars.name = "lunar_relay_stars";
  root.add(stars);
  return root;
};
