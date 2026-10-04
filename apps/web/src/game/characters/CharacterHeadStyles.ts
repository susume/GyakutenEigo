import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PlayerHeadStyleId } from "@quizstrike/shared";
import type { CharacterMaterials } from "./CharacterEquipment.js";
import { characterArtMaterial } from "./CharacterArtMaterial.js";

export interface HeadStyleDefinition {
  id: PlayerHeadStyleId;
  asset?: string;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
  create: (materials: CharacterMaterials) => THREE.Group;
}

const sphere = new THREE.SphereGeometry(0.5, 32, 24);
const helmetDome = new THREE.SphereGeometry(0.5, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
const softSphere = sphere;
const cone = new THREE.ConeGeometry(0.5, 1, 24);
const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
const roundedBox = new RoundedBoxGeometry(1, 1, 1, 5, 0.14);
const torus = new THREE.TorusGeometry(0.5, 0.1, 12, 36);
const faceGeometry = sphere.clone();
const facePositions = faceGeometry.getAttribute("position");
for (let i = 0; i < facePositions.count; i++) {
  const y = facePositions.getY(i);
  // One continuous cheek-to-chin surface avoids overlapping jaw seams.
  const jaw = THREE.MathUtils.smoothstep(-y, 0.03, 0.5);
  facePositions.setX(i, facePositions.getX(i) * (1 - jaw * 0.2));
}
faceGeometry.computeVertexNormals();

const neutral = {
  fox: characterArtMaterial("#df7446", 0.66, 0.02),
  foxCream: characterArtMaterial("#ffe0b5", 0.70, 0.02),
  pandaWhite: characterArtMaterial("#f4f0e8", 0.69, 0.02),
  bear: characterArtMaterial("#9a6746", 0.70, 0.02),
  bearMuzzle: characterArtMaterial("#d7aa78", 0.72, 0.02),
  rabbit: characterArtMaterial("#e8ddd0", 0.72, 0.02),
  rabbitInner: characterArtMaterial("#dca5a8", 0.72, 0.02),
  robot: characterArtMaterial("#aab7c3", 0.43, 0.3),
  robotDark: characterArtMaterial("#263746", 0.50, 0.18),
  boyHair: characterArtMaterial("#172b3d", 0.66, 0.02),
  boyHairHighlight: characterArtMaterial("#31546b", 0.62, 0.02),
  girlHair: characterArtMaterial("#793f52", 0.69, 0.02),
  girlHairHighlight: characterArtMaterial("#b86a7e", 0.66, 0.02),
  boyIris: characterArtMaterial("#29bad0", 0.40, 0.02),
  girlIris: characterArtMaterial("#9968d8", 0.40, 0.02),
  blush: characterArtMaterial("#f2a4ad", 0.74, 0.02),
  hairClip: characterArtMaterial("#ffd56a", 0.48, 0.08),
  ninjaCloth: characterArtMaterial("#202832", 0.77, 0.02),
  ninjaFold: characterArtMaterial("#35404d", 0.74, 0.02),
  samuraiIron: characterArtMaterial("#26323e", 0.52, 0.16),
  shark: characterArtMaterial("#66899a", 0.66, 0.02),
  sharkLight: characterArtMaterial("#dce4df", 0.70, 0.02),
  zombieSkin: characterArtMaterial("#79ad39", 0.72, 0.02),
  zombieSkinDark: characterArtMaterial("#3f6f2c", 0.75, 0.02),
  zombieEye: characterArtMaterial("#f5df83", 0.54, 0.02),
  zombieIris: characterArtMaterial("#a97916", 0.46, 0.02),
  zombieBrain: characterArtMaterial("#e0a649", 0.69, 0.02),
  zombieMouth: characterArtMaterial("#351f24", 0.77, 0.02),
  zombieTooth: characterArtMaterial("#eadc9b", 0.67, 0.02),
  dark: characterArtMaterial("#27232a", 0.66, 0.02),
  eyeWhite: characterArtMaterial("#fffdf7", 0.51, 0.02)
} as const;

const add = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  // Small layered facial details use material shading; coarse self-shadow maps
  // otherwise leave jagged seams across the cheeks and eyes.
  mesh.receiveShadow = false;
  mesh.userData.preserveSharedResources = true;
  parent.add(mesh);
  return mesh;
};

// Sculpted ribbons and curved ink strokes give each style a drawn silhouette.
const strokeCache = new Map<string, THREE.BufferGeometry>();
const stroke = (group: THREE.Group, points: number[][], material: THREE.Material, radius = 0.009) => {
  const key = JSON.stringify([points, radius]);
  let geometry = strokeCache.get(key);
  if (!geometry) {
    geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), 20, radius, 8, false);
    strokeCache.set(key, geometry);
  }
  return add(group, geometry, material, [0, 0, 0], [1, 1, 1]);
};

const hairLockGeometry = new THREE.LatheGeometry([
  new THREE.Vector2(0.01, -0.5), new THREE.Vector2(0.18, -0.4),
  new THREE.Vector2(0.31, -0.2), new THREE.Vector2(0.34, 0.08),
  new THREE.Vector2(0.27, 0.3), new THREE.Vector2(0.14, 0.45), new THREE.Vector2(0, 0.52)
], 24);

const addEyes = (
  group: THREE.Group, materials: CharacterMaterials, y: number, z: number,
  spacing = 0.1, scale: [number, number, number] = [0.045, 0.065, 0.032]
) => {
  for (const side of [-1, 1]) {
    const x = side * spacing;
    add(group, sphere, neutral.dark, [x, y, z + 0.003], [scale[0] * 1.8, scale[1] * 1.65, scale[2]]);
    add(group, sphere, neutral.eyeWhite, [x, y, z - 0.008], [scale[0] * 1.55, scale[1] * 1.4, scale[2]]);
    add(group, sphere, materials.visor, [x, y - 0.002, z - 0.028], [scale[0] * 1.12, scale[1] * 1.16, scale[2] * 0.8]);
    add(group, sphere, neutral.dark, [x, y - 0.004, z - 0.04], [scale[0] * 0.72, scale[1] * 0.95, scale[2] * 0.6]);
    add(group, sphere, neutral.eyeWhite, [x - 0.012, y + 0.017, z - 0.053], [0.016, 0.021, 0.008]);
    add(group, sphere, neutral.eyeWhite, [x + 0.009, y - 0.016, z - 0.052], [0.007, 0.009, 0.005]);
  }
};

const smile = (group: THREE.Group, y = -0.17, z = -0.315, width = 0.09) =>
  stroke(group, [[-width, y + 0.02, z], [0, y, z - 0.006], [width, y + 0.02, z]], neutral.dark, 0.007);

const markMotionNode = (
  object: THREE.Object3D,
  kind: "hairCrown" | "hairFringe" | "hairLock",
  index = 0,
  side = 0
) => {
  object.userData.cosmeticMotionNode = kind;
  object.userData.motionIndex = index;
  object.userData.motionSide = side;
  object.userData.baseRotation = [object.rotation.x, object.rotation.y, object.rotation.z];
  return object;
};

const createAnimeFace = (materials: CharacterMaterials, style: "boy" | "girl") => {
  const group = new THREE.Group();
  const girl = style === "girl";
  add(group, faceGeometry, materials.skin, [0, 0.015, 0], [0.61, 0.68, 0.56]);
  for (const side of [-1, 1]) {
    add(group, sphere, materials.skin, [side * 0.3, 0.01, 0], [0.105, 0.15, 0.09]);
    add(group, sphere, neutral.blush, [side * 0.323, 0.015, -0.024], [0.022, 0.065, 0.043]);
    const x = side * 0.115;
    add(group, sphere, neutral.dark, [x, 0.065, -0.257], [0.106, girl ? 0.13 : 0.115, 0.024]);
    add(group, sphere, neutral.eyeWhite, [x, 0.06, -0.266], [0.094, girl ? 0.117 : 0.102, 0.028]);
    add(group, sphere, girl ? neutral.girlIris : neutral.boyIris, [x, 0.056, -0.285], [0.062, girl ? 0.081 : 0.071, 0.02]);
    add(group, sphere, neutral.dark, [x, 0.06, -0.299], [0.032, 0.054, 0.012]);
    add(group, sphere, neutral.eyeWhite, [x - 0.013, 0.084, -0.31], [0.022, 0.025, 0.008]);
    add(group, sphere, neutral.eyeWhite, [x + 0.018, 0.033, -0.31], [0.009, 0.011, 0.006]);
    stroke(group, [[x - 0.056, 0.152, -0.274], [x, 0.163, -0.282], [x + 0.053, 0.15, -0.278]], girl ? neutral.girlHair : neutral.boyHair, 0.009);
    add(group, sphere, neutral.blush, [side * 0.19, -0.058, -0.215], [0.065, 0.022, 0.012]);
    if (girl) stroke(group, [[x + side * 0.046, 0.104, -0.29], [x + side * 0.071, 0.118, -0.288]], neutral.dark, 0.006);
  }
  add(group, sphere, materials.skin, [0, -0.022, -0.291], [0.055, 0.065, 0.065]);
  smile(group, -0.139, -0.253, 0.064);
  return group;
};

const createBoy = (materials: CharacterMaterials) => {
  const group = createAnimeFace(materials, "boy");
  const crown = markMotionNode(new THREE.Group(), "hairCrown");
  crown.name = "BoyHairCrown";
  group.add(crown);
  add(crown, sphere, neutral.boyHair, [0, 0.243, 0.07], [0.66, 0.36, 0.62]);
  for (const side of [-1, 1]) {
    add(crown, sphere, neutral.boyHair, [side * 0.257, 0.14, 0.038], [0.2, 0.35, 0.3]);
    add(crown, hairLockGeometry, neutral.boyHairHighlight, [side * 0.28, 0.105, -0.12], [0.12, 0.19, 0.13], [0.24, 0, side * 0.2]);
  }
  // Swept broad locks replace the former row of triangular spikes.
  const locks = [[-0.25,0.24,-0.19,-0.8],[-0.13,0.28,-0.25,-0.84],[0.01,0.3,-0.26,-0.88],[0.15,0.26,-0.24,-0.9],[0.26,0.2,-0.18,-0.96]];
  locks.forEach(([x,y,z,tilt], index) => {
    const lock = markMotionNode(new THREE.Group(), "hairFringe", index, Math.sign(x));
    lock.position.set(x,y,z); lock.rotation.z = tilt;
    lock.userData.baseRotation = [0,0,tilt]; crown.add(lock);
    add(lock,hairLockGeometry,index === 2 ? neutral.boyHairHighlight : neutral.boyHair,[0,0,0],[0.32,0.29,0.19],[0.28,0,0]);
  });
  return group;
};

const createGirl = (materials: CharacterMaterials) => {
  const group = createAnimeFace(materials, "girl");
  const crown = markMotionNode(new THREE.Group(), "hairCrown");
  crown.name = "GirlHairCrown"; group.add(crown);
  add(crown, sphere, neutral.girlHair, [0,0.235,0.09],[0.68,0.43,0.61]);
  add(crown, sphere, neutral.girlHair, [0,-0.07,0.19],[0.63,0.58,0.37]);
  for (const side of [-1,1]) {
    for (let index=0;index<2;index++) {
      const lock=markMotionNode(new THREE.Group(),"hairLock",index,side);
      lock.position.set(side*(0.27+index*0.03),0.075-index*0.14,0.005+index*0.075);
      lock.rotation.z=side*(0.12+index*0.08); lock.userData.baseRotation=[0,0,lock.rotation.z];
      crown.add(lock);
      add(lock,hairLockGeometry,index ? neutral.girlHairHighlight : neutral.girlHair,[0,0,0],[0.24,0.54,0.32],[0.12,0,Math.PI]);
    }
  }
  [[-0.19,0.26,-0.25,-0.34],[-0.065,0.31,-0.27,-0.33],[0.075,0.3,-0.27,-0.36],[0.21,0.23,-0.235,-0.4]].forEach(([x,y,z,tilt],i)=>{
    const lock=markMotionNode(new THREE.Group(),"hairFringe",i,Math.sign(x));
    lock.position.set(x,y,z); lock.rotation.z=tilt; lock.userData.baseRotation=[0,0,tilt]; crown.add(lock);
    add(lock,hairLockGeometry,i === 1 ? neutral.girlHairHighlight : neutral.girlHair,[0,0,0],[0.23,0.32,0.15],[0.2,0,0]);
  });
  add(group,roundedBox,neutral.hairClip,[0.29,0.24,-0.17],[0.11,0.035,0.035],[0.1,0,0.45]);
  add(group,sphere,neutral.hairClip,[0.288,0.28,-0.17],[0.065,0.065,0.022]);
  return group;
};

const createFox = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.fox, [0, 0.015, 0], [0.68, 0.66, 0.6]);
  add(group, softSphere, neutral.foxCream, [0, -0.12, -0.055], [0.48, 0.35, 0.45]);
  for (const side of [-1, 1]) {
    add(group, cone, neutral.fox, [side * 0.205, 0.36, 0.015], [0.28, 0.38, 0.24], [0, 0, -side * 0.12]);
    add(group, cone, neutral.rabbitInner, [side * 0.205, 0.365, -0.025], [0.14, 0.25, 0.12], [0, 0, -side * 0.12]);
  }
  add(group, sphere, neutral.foxCream, [0, -0.055, -0.3], [0.36, 0.23, 0.2]);
  add(group, sphere, neutral.dark, [0, -0.03, -0.405], [0.12, 0.09, 0.07]);
  addEyes(group, materials, 0.085, -0.285, 0.11, [0.038, 0.058, 0.026]);

  for (const side of [-1, 1]) {
    add(group, hairLockGeometry, neutral.foxCream, [side * 0.25, -0.105, -0.13], [0.24, 0.25, 0.17], [0, 0, side * -1.15]);
    stroke(group, [[side*0.064,-0.09,-0.4],[side*0.14,-0.13,-0.365],[side*0.2,-0.11,-0.34]], neutral.dark, 0.006);
    add(group, sphere, neutral.foxCream, [side*0.11,0.19,-0.236],[0.07,0.035,0.014],[0,0,side*0.22]);
  }
  return group;
};

const createPanda = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.pandaWhite, [0, 0.01, 0], [0.7, 0.7, 0.62]);
  add(group, sphere, neutral.dark, [-0.27, 0.275, 0.015], [0.22, 0.22, 0.17]);
  add(group, sphere, neutral.dark, [0.27, 0.275, 0.015], [0.22, 0.22, 0.17]);
  for (const side of [-1, 1]) {
    add(group, sphere, neutral.dark, [side * 0.105, 0.075, -0.292], [0.2, 0.28, 0.08], [0, 0, side * 0.18]);
  }
  addEyes(group, materials, 0.075, -0.335, 0.105, [0.027, 0.04, 0.021]);
  add(group, sphere, neutral.pandaWhite, [0, -0.105, -0.31], [0.34, 0.22, 0.16]);
  add(group, sphere, neutral.dark, [0, -0.075, -0.39], [0.1, 0.075, 0.055]);

  smile(group, -0.19, -0.353, 0.076);
  for (const side of [-1,1]) add(group,sphere,neutral.blush,[side*0.22,-0.08,-0.246],[0.07,0.026,0.012]);
  add(group,hairLockGeometry,neutral.dark,[0.03,0.35,0],[0.12,0.17,0.13],[0,0,-0.5]);
  return group;
};

const createBear = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.bear, [0, 0, 0], [0.72, 0.68, 0.62]);
  add(group, sphere, neutral.bear, [-0.27, 0.26, 0.01], [0.22, 0.22, 0.17]);
  add(group, sphere, neutral.bear, [0.27, 0.26, 0.01], [0.22, 0.22, 0.17]);
  add(group, sphere, neutral.bearMuzzle, [0, -0.085, -0.3], [0.42, 0.28, 0.2]);
  add(group, sphere, neutral.dark, [0, -0.045, -0.405], [0.11, 0.08, 0.06]);
  addEyes(group, materials, 0.09, -0.3, 0.11, [0.034, 0.052, 0.024]);

  smile(group, -0.19, -0.358, 0.084);
  for (const side of [-1,1]) {
    add(group,sphere,neutral.bearMuzzle,[side*0.273,0.275,-0.06],[0.115,0.13,0.045]);
    add(group,sphere,neutral.bearMuzzle,[side*0.11,0.19,-0.255],[0.095,0.026,0.013]);
  }
  return group;
};

const createRabbit = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.rabbit, [0, -0.035, 0], [0.64, 0.68, 0.57]);
  for (const side of [-1, 1]) {
    add(group, sphere, neutral.rabbit, [side * 0.145, 0.395, 0.02], [0.22, 0.48, 0.16], [0, 0, side * 0.08]);
    add(group, sphere, neutral.rabbitInner, [side * 0.145, 0.405, -0.065], [0.1, 0.35, 0.055], [0, 0, side * 0.08]);
  }
  add(group, softSphere, neutral.rabbit, [0, -0.14, -0.045], [0.48, 0.36, 0.44]);
  add(group, sphere, neutral.eyeWhite, [0, -0.08, -0.3], [0.25, 0.18, 0.13]);
  add(group, sphere, neutral.rabbitInner, [0, -0.055, -0.38], [0.085, 0.065, 0.05]);
  addEyes(group, materials, 0.075, -0.285, 0.11, [0.035, 0.055, 0.025]);

  smile(group,-0.16,-0.32,0.064);
  add(group,roundedBox,neutral.eyeWhite,[0,-0.19,-0.32],[0.045,0.065,0.035]);
  for (const side of [-1,1]) {
    add(group,sphere,neutral.blush,[side*0.21,-0.065,-0.23],[0.065,0.025,0.013]);
    for(let i=0;i<2;i++) stroke(group,[[side*0.17,-0.105-i*0.028,-0.27],[side*0.27,-0.085-i*0.033,-0.2]],neutral.rabbitInner,0.004);
  }
  return group;
};

const createRobot = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, roundedBox, neutral.robot, [0, 0, 0], [0.62, 0.62, 0.56]);
  add(group, roundedBox, neutral.robotDark, [0, 0.055, -0.305], [0.46, 0.28, 0.055]);
  for (const x of [-0.11, 0.11]) {
    add(group, roundedBox, materials.visor, [x, 0.07, -0.345], [0.12, 0.075, 0.028]);
  }
  add(group, roundedBox, materials.dark, [0, -0.13, -0.325], [0.2, 0.035, 0.025]);
  add(group, cylinder, neutral.robotDark, [0, 0.39, 0.015], [0.045, 0.22, 0.045]);
  add(group, sphere, materials.accent, [0, 0.52, 0.015], [0.12, 0.12, 0.12]);
  add(group, torus, materials.accent, [0, -0.295, 0], [0.5, 0.22, 0.46], [Math.PI / 2, 0, 0]);

  for (const side of [-1,1]) {
    add(group,cylinder,neutral.robotDark,[side*0.33,0,0],[0.12,0.075,0.12],[0,0,Math.PI/2]);
    add(group,cylinder,materials.accent,[side*0.373,0,0],[0.085,0.025,0.085],[0,0,Math.PI/2]);
    add(group,roundedBox,neutral.eyeWhite,[side*0.12,0.086,-0.365],[0.045,0.028,0.01]);
  }
  for(let i=0;i<3;i++) add(group,roundedBox,materials.accent,[-0.08+i*0.08,-0.21,-0.3],[0.044,0.018,0.018]);
  stroke(group,[[-0.085,-0.105,-0.345],[0,-0.145,-0.346],[0.085,-0.105,-0.345]],materials.visor,0.01);
  return group;
};

const createSamurai = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, materials.skin, [0, -0.055, -0.005], [0.57, 0.58, 0.52]);
  addEyes(group, materials, 0.005, -0.27, 0.085, [0.032, 0.048, 0.023]);
  add(group, helmetDome, neutral.samuraiIron, [0, 0.08, 0.035], [0.68, 0.62, 0.62]);
  add(group, cylinder, neutral.samuraiIron, [0, 0.11, 0.02], [0.7, 0.11, 0.65]);
  add(group, roundedBox, neutral.samuraiIron, [-0.34, -0.08, 0.035], [0.12, 0.29, 0.32], [0, 0, -0.08]);
  add(group, roundedBox, neutral.samuraiIron, [0.34, -0.08, 0.035], [0.12, 0.29, 0.32], [0, 0, 0.08]);
  add(group, roundedBox, materials.accent, [-0.07, 0.4, -0.285], [0.06, 0.3, 0.055], [0, 0, -0.42]);
  add(group, roundedBox, materials.accent, [0.07, 0.4, -0.285], [0.06, 0.3, 0.055], [0, 0, 0.42]);
  add(group, roundedBox, materials.dark, [0, -0.16, -0.285], [0.28, 0.055, 0.035]);

  for(const side of [-1,1]) {
    for(let i=0;i<3;i++) add(group,roundedBox,i===2 ? materials.accent : neutral.samuraiIron,[side*0.3,-0.06-i*0.075,0.05],[0.16,0.055,0.34],[0,0,side*0.14]);
    stroke(group,[[side*0.04,0.026,-0.29],[side*0.09,0.046,-0.29],[side*0.14,0.035,-0.285]],neutral.dark,0.007);
  }
  add(group,sphere,neutral.hairClip,[0,0.275,-0.285],[0.13,0.13,0.045]);
  return group;
};

const createNinja = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.ninjaCloth, [0, 0.015, 0.02], [0.64, 0.68, 0.58]);
  add(group, roundedBox, materials.skin, [0, 0.075, -0.29], [0.43, 0.16, 0.055]);
  addEyes(group, materials, 0.08, -0.335, 0.09, [0.032, 0.044, 0.022]);
  add(group, roundedBox, neutral.ninjaCloth, [0, -0.12, -0.31], [0.52, 0.26, 0.07], [-0.08, 0, 0]);
  add(group, torus, neutral.ninjaFold, [0, 0.27, 0.02], [0.55, 0.2, 0.5], [Math.PI / 2, 0, 0]);
  add(group, roundedBox, neutral.ninjaFold, [0.29, -0.05, 0.23], [0.11, 0.35, 0.11], [0.18, 0, -0.28]);

  stroke(group,[[-0.19,-0.07,-0.355],[0,-0.13,-0.361],[0.19,-0.07,-0.355]],neutral.ninjaFold,0.006);
  add(group,roundedBox,materials.accent,[0,0.264,-0.245],[0.18,0.052,0.03]);
  for(const side of [-1,1]) stroke(group,[[side*0.03,0.13,-0.34],[side*0.085,0.145,-0.34],[side*0.14,0.13,-0.335]],neutral.dark,0.006);
  add(group,hairLockGeometry,materials.accent,[0.2,-0.14,0.27],[0.12,0.35,0.055],[0,0,-0.7]);
  return group;
};

const createGreatWhite = (_materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, sphere, neutral.shark, [0, 0.02, -0.025], [0.67, 0.6, 0.69]);
  add(group, softSphere, neutral.shark, [0, -0.015, -0.3], [0.55, 0.4, 0.5]);
  add(group, softSphere, neutral.sharkLight, [0, -0.17, -0.315], [0.5, 0.25, 0.42]);
  add(group, cone, neutral.shark, [0, 0.42, 0.12], [0.15, 0.28, 0.14], [0.18, 0, 0]);
  for (const side of [-1, 1]) {
    add(group, sphere, neutral.dark, [side * 0.19, 0.095, -0.405], [0.045, 0.052, 0.032]);
    for (let index = 0; index < 2; index += 1) {
      add(group, roundedBox, neutral.dark, [side * (0.29 + index * 0.025), -0.055 - index * 0.06, -0.22], [0.025, 0.07, 0.045], [0, 0, side * 0.18]);
    }
  }
  add(group, roundedBox, neutral.dark, [0, -0.17, -0.475], [0.34, 0.07, 0.035]);
  for (const x of [-0.21, -0.105, 0, 0.105, 0.21]) {
    add(group, cone, neutral.eyeWhite, [x, -0.17, -0.515], [0.035, 0.075, 0.03], [Math.PI, 0, 0]);
  }

  for(const side of [-1,1]) {
    add(group,sphere,neutral.eyeWhite,[side*0.183,0.108,-0.421],[0.018,0.022,0.009]);
    add(group,sphere,neutral.sharkLight,[side*0.175,0.168,-0.372],[0.09,0.026,0.022],[0,0,side*0.16]);
  }
  return group;
};

const createZombie = (materials: CharacterMaterials) => {
  const group = new THREE.Group();
  add(group, softSphere, neutral.zombieSkin, [0, 0.02, 0.015], [0.68, 0.66, 0.59], [0, 0, -0.04]);
  add(group, softSphere, neutral.zombieSkinDark, [0.02, -0.14, -0.02], [0.59, 0.42, 0.5], [0, 0, 0.05]);
  add(group, sphere, neutral.zombieSkin, [-0.34, 0.015, 0], [0.12, 0.17, 0.1]);
  add(group, sphere, neutral.zombieSkin, [0.34, 0.015, 0.02], [0.14, 0.2, 0.11]);

  const eyes = [
    { x: -0.13, y: 0.09, scale: [0.115, 0.14, 0.052] as [number, number, number] },
    { x: 0.13, y: 0.12, scale: [0.18, 0.21, 0.065] as [number, number, number] }
  ];
  eyes.forEach(({ x, y, scale }, index) => {
    add(group, sphere, neutral.zombieEye, [x, y, -0.31], scale);
    add(group, sphere, neutral.zombieIris, [x + (index === 0 ? -0.012 : 0.018), y - 0.008, -0.366], [scale[0] * 0.35, scale[1] * 0.35, 0.025]);
    add(group, sphere, materials.dark, [x + (index === 0 ? -0.012 : 0.018), y - 0.008, -0.386], [scale[0] * 0.16, scale[1] * 0.16, 0.014]);
  });

  add(group, cone, neutral.zombieSkinDark, [0.005, -0.015, -0.345], [0.055, 0.09, 0.05], [-Math.PI / 2, 0, 0]);
  add(group, softSphere, neutral.zombieMouth, [0.015, -0.19, -0.345], [0.4, 0.18, 0.075], [0, 0, 0.08]);
  add(group, roundedBox, neutral.zombieSkin, [0.03, -0.31, -0.29], [0.46, 0.14, 0.18], [0, 0, 0.08]);
  for (const [x, y, tilt] of [[-0.2, -0.13, -0.08], [-0.055, -0.12, 0.04], [0.15, -0.14, 0.1], [-0.12, -0.25, Math.PI + 0.08], [0.08, -0.26, Math.PI - 0.08]] as const) {
    add(group, cone, neutral.zombieTooth, [x, y, -0.425], [0.045, 0.09, 0.04], [0, 0, tilt]);
  }

  add(group, softSphere, neutral.zombieBrain, [0.17, 0.36, -0.15], [0.25, 0.11, 0.09], [0, 0, -0.18]);
  for (const x of [0.05, 0.14, 0.23]) {
    add(group, sphere, neutral.zombieBrain, [x, 0.4 - Math.abs(x - 0.14) * 0.22, -0.205], [0.075, 0.055, 0.025]);
  }
  for (const [x, tilt] of [[-0.24, -0.35], [-0.08, -0.12], [0.29, 0.34]] as const) {
    add(group, cone, neutral.dark, [x, 0.43, 0.02], [0.035, 0.22, 0.035], [0, 0, tilt]);
  }
  return group;
};

export const HEAD_STYLE_REGISTRY: Record<PlayerHeadStyleId, HeadStyleDefinition> = {
  boy_short_hair: { id: "boy_short_hair", position: [0, -0.005, 0], rotation: [0, 0, 0], scale: [0.98, 0.98, 0.98], create: createBoy },
  girl_mid_hair: { id: "girl_mid_hair", position: [0, -0.01, 0.015], rotation: [0, 0, 0], scale: [0.94, 0.94, 0.94], create: createGirl },
  fox: { id: "fox", position: [0, -0.005, 0.005], rotation: [0, 0, 0], scale: [0.98, 0.98, 0.98], create: createFox },
  panda: { id: "panda", position: [0, -0.015, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createPanda },
  bear: { id: "bear", position: [0, -0.02, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createBear },
  rabbit: { id: "rabbit", position: [0, -0.015, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createRabbit },
  great_white: { id: "great_white", position: [0, -0.025, -0.005], rotation: [0, 0, 0], scale: [0.94, 0.94, 0.94], create: createGreatWhite },
  robot: { id: "robot", position: [0, 0, 0.005], rotation: [0, 0, 0], scale: [0.96, 0.96, 0.96], create: createRobot },
  samurai: { id: "samurai", position: [0, -0.015, 0.02], rotation: [0, 0, 0], scale: [0.92, 0.92, 0.92], create: createSamurai },
  ninja: { id: "ninja", position: [0, -0.01, 0.005], rotation: [0, 0, 0], scale: [0.98, 0.98, 0.98], create: createNinja }
};

const finishHead = (definition: HeadStyleDefinition, group: THREE.Group) => {
  group.name = `HeadStyle_${definition.id}`;
  group.position.set(...definition.position);
  group.rotation.set(...definition.rotation);
  group.scale.set(...definition.scale);
  group.userData.headStyleId = definition.id;
  group.userData.primaryHeadVisual = true;
  return group;
};

export const createHeadStyle = (
  requestedId: PlayerHeadStyleId | string,
  materials: CharacterMaterials
): THREE.Group => {
  const requested = HEAD_STYLE_REGISTRY[requestedId as PlayerHeadStyleId];
  if (!requested) {
    console.warn(`[QuizStrike] Unknown head style "${requestedId}". Falling back to "boy_short_hair".`);
    const fallback = finishHead(HEAD_STYLE_REGISTRY.boy_short_hair, HEAD_STYLE_REGISTRY.boy_short_hair.create(materials));
    fallback.userData.fallbackFrom = requestedId;
    return fallback;
  }
  try {
    return finishHead(requested, requested.create(materials));
  } catch (error) {
    console.warn(`[QuizStrike] Head style "${requestedId}" failed to build. Falling back to "boy_short_hair".`, error);
    const fallback = finishHead(HEAD_STYLE_REGISTRY.boy_short_hair, HEAD_STYLE_REGISTRY.boy_short_hair.create(materials));
    fallback.userData.fallbackFrom = requestedId;
    return fallback;
  }
};

/** Game-mode-only head; it is intentionally excluded from the customization registry. */
export const createZombieHeadStyle = (materials: CharacterMaterials): THREE.Group => {
  const group = createZombie(materials);
  group.name = "HeadStyle_zombie";
  group.position.set(0, -0.015, 0.005);
  group.scale.setScalar(0.96);
  group.userData.headStyleId = "zombie";
  group.userData.primaryHeadVisual = true;
  group.userData.gameModeOnly = "zombie";
  return group;
};

export const createHeadStyleDebugEnvelope = () => {
  const group = new THREE.Group();
  group.name = "HeadStyleDebugEnvelope";
  const material = new THREE.MeshBasicMaterial({
    color: "#5fffe1",
    transparent: true,
    opacity: 0.28,
    wireframe: true,
    depthTest: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), material);
  mesh.scale.set(0.76, 0.84, 0.7);
  mesh.userData.disposeWithCharacterGeometry = true;
  mesh.userData.disposeWithCharacterMaterial = true;
  group.add(mesh);
  group.add(new THREE.AxesHelper(0.42));
  return group;
};
