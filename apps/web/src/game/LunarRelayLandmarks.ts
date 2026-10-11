import * as THREE from "three";
import { scaleArenaValue } from "@quizstrike/shared";

type AddMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, surface?: string) => THREE.Mesh;

/** Relay hardware stays above the existing gantries. Terrain and the lander
 * stay beyond the walls; surface markings add no new gameplay obstacles. */
export const addLunarRelayLandmarks = (parent: THREE.Group, addMesh: AddMesh, detail: number) => {
  const segments = detail === 0 ? 24 : 56;
  const white = "#e0edf4", ink = "#23344c", cyan = "#85eed9", gold = "#dfad61";
  const group = (name: string, x = 0, y = 0, z = 0) => {
    const root = new THREE.Group();
    root.name = name;
    root.position.set(x, y, z);
    parent.add(root);
    return root;
  };
  const box = (root: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, color: string, surface = "metal") => {
    const mesh = addMesh(root, new THREE.BoxGeometry(w, h, d), color, surface);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const ring = (root: THREE.Group, radius: number, y: number, color: string) => {
    const mesh = addMesh(root, new THREE.RingGeometry(radius - .16, radius, segments), color, "accent");
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    return mesh;
  };

  // An orbital relay cage crowns the actual bridge: recognizable from either
  // team base and the north/south approaches, even on Low quality.
  const halo = group("lunar_relay_halo");
  for (const side of [-1, 1]) {
    box(halo, scaleArenaValue(side * 58), 36.5, 0, 3.1, 31, 3.1, white);
    box(halo, scaleArenaValue(side * 58), 36.5, 1.58, .6, 31, .06, cyan, "accent");
  }
  for (const [width, rotation, color] of [[scaleArenaValue(58), 0, white], [16, Math.PI / 2, cyan]] as const) {
    const frame = addMesh(halo, new THREE.TorusGeometry(1, .04, detail === 0 ? 3 : 5, segments), color, "metal");
    frame.position.y = 52;
    frame.scale.set(width, 29, width);
    frame.rotation.y = rotation;
  }
  const signal = addMesh(halo, new THREE.TorusGeometry(1, .012, 3, segments), cyan, "accent");
  signal.position.set(0, 52, 1.5);
  signal.scale.set(scaleArenaValue(55), 27.5, 1);

  const relayDeck = group("lunar_relay_deck_markings", 0, 10.035, 0);
  ring(relayDeck, 7.8, 0, cyan);
  ring(relayDeck, 6.8, .004, white);
  for (const side of [-1, 1]) {
    for (const x of [22, 44, 68]) {
      for (const angle of [-.65, .65]) {
        const chevron = box(relayDeck, scaleArenaValue(side * x), .01, Math.sign(angle) * .7, 2.3, .025, .16, cyan, "accent");
        chevron.rotation.y = side * angle;
      }
    }
  }
  const underpass = group("lunar_relay_underpass_markings", 0, .025, 0);
  ring(underpass, 8.5, 0, "#8aacc2");

  const solarCourt = group("lunar_relay_solar_court_markings", 0, .025, scaleArenaValue(112));
  ring(solarCourt, 9, 0, gold);
  for (const side of [-1, 1]) {
    box(solarCourt, scaleArenaValue(side * 78), .01, scaleArenaValue(-29), .16, .025, scaleArenaValue(58), gold, "accent");
    box(solarCourt, scaleArenaValue(side * 46), .01, 0, scaleArenaValue(64), .025, .16, gold, "accent");
    // Closed octagonal pressure hatches lie flush on the real airlock cover.
    const hatch = group(`lunar_relay_airlock_hatch_${side}`, scaleArenaValue(side * 142) - side * .04, 3.5, 0);
    hatch.rotation.y = -side * Math.PI / 2;
    addMesh(hatch, new THREE.RingGeometry(1.5, 2.2, 8), white, "metal");
    addMesh(hatch, new THREE.CircleGeometry(1.5, 8), ink, "metal");
    box(hatch, 0, -.3, .025, 1.8, .13, .03, cyan, "accent");
    box(hatch, 0, .45, .025, .16, 1.1, .03, white);
  }

  // A telescope gives the Observatory a different silhouette from habitats.
  const telescope = group("lunar_relay_observatory_telescope", 0, 25, scaleArenaValue(-127));
  telescope.rotation.z = .42;
  const barrel = addMesh(telescope, new THREE.CylinderGeometry(2.4, 3, 9, detail === 0 ? 8 : 16), white, "metal");
  barrel.position.y = 4.5;
  const lens = addMesh(telescope, new THREE.CylinderGeometry(2.05, 2.05, .12, detail === 0 ? 8 : 16), ink, "metal");
  lens.position.y = 9.04;

  // The southern horizon is a landing site, rather than another habitat row.
  const lander = group("lunar_relay_lander", 70, 0, 164);
  const body = addMesh(lander, new THREE.CylinderGeometry(10, 14, 10, 8), gold, "metal");
  body.position.y = 15;
  const cabin = addMesh(lander, new THREE.CylinderGeometry(8, 10, 11, 8), white, "metal");
  cabin.position.y = 25.5;
  box(lander, 0, 26, 8.8, 8, 3.2, .15, ink);
  const engine = addMesh(lander, new THREE.CylinderGeometry(2.5, 4, 5, 8, 1, true), ink, "metal");
  engine.position.y = 7.5;
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const start = new THREE.Vector3(x * 8, 12, z * 8), end = new THREE.Vector3(x * 19, 1, z * 19);
    const leg = addMesh(lander, new THREE.CylinderGeometry(.5, .7, start.distanceTo(end), 5), white, "metal");
    leg.position.copy(start).add(end).multiplyScalar(.5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    const foot = addMesh(lander, new THREE.CylinderGeometry(3.1, 3.7, .7, 8), gold, "metal");
    foot.position.set(x * 19, .35, z * 19);
  }
  for (const side of [-1, 1]) {
    box(lander, side * 18, 22, 0, 17, .35, 9, "#355b86");
    box(lander, side * 18, 22.2, 0, 17, .05, .13, cyan, "accent");
  }
  box(lander, 0, 34, 0, .3, 6, .3, white);

  const craters = group("lunar_relay_exterior_craters");
  for (const [x, z, radius] of [[-92, 163, 27], [182, -65, 23], [-185, 55, 25]] as const) {
    const rimGeometry = new THREE.RingGeometry(radius * .64, radius, detail === 0 ? 20 : 40);
    const positions = rimGeometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const distance = Math.hypot(positions.getX(i), positions.getY(i));
      positions.setZ(i, distance < radius * .8 ? -.2 : .45);
    }
    rimGeometry.computeVertexNormals();
    const rim = addMesh(craters, rimGeometry, "#8997ad", "sand");
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, -.12, z);
    const basin = addMesh(craters, new THREE.CircleGeometry(radius * .645, detail === 0 ? 20 : 40), "#48576e", "sand");
    basin.rotation.x = -Math.PI / 2;
    basin.position.set(x, -.325, z);
  }
};
