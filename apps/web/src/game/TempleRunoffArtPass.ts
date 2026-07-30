import * as THREE from "three";

const FERN_POSITIONS = [
  [-101, -128, 0.9], [-75, -139, 1.15], [-24, -143, 0.8], [28, -142, 1.05], [76, -137, 0.95], [107, -126, 1.2],
  [-103, 117, 1.1], [-56, 142, 0.85], [-24, 118, 1.05], [25, 119, 0.9], [58, 140, 1.15], [105, 118, 0.95]
] as const;

export const addTempleRunoffArtPass = (
  scene: THREE.Scene,
  materialFor: (color: string, material?: string) => THREE.Material,
  detail: number
) => {
  const group = new THREE.Group();
  group.name = "temple_runoff_environment";

  if (detail > 0) {
    const fernGeometry = new THREE.ConeGeometry(1.7, 0.12, 5);
    const ferns = new THREE.InstancedMesh(fernGeometry, materialFor("#4f7549", "accent"), FERN_POSITIONS.length * 3);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const size = new THREE.Vector3();
    let instance = 0;
    FERN_POSITIONS.forEach(([x, z, scale], patch) => {
      for (let leaf = 0; leaf < 3; leaf += 1) {
        position.set(x + (leaf - 1) * 1.4, 0.12, z + ((patch + leaf) % 2) * 1.1);
        quaternion.setFromEuler(new THREE.Euler(0.2, leaf * 2.1 + patch * 0.35, 0.4));
        size.set(scale, scale, scale);
        matrix.compose(position, quaternion, size);
        ferns.setMatrixAt(instance, matrix);
        instance += 1;
      }
    });
    ferns.instanceMatrix.needsUpdate = true;
    group.add(ferns);
  }

  if (detail === 2) {
    const mistMaterial = new THREE.MeshBasicMaterial({
      color: "#b9e3d5",
      transparent: true,
      opacity: 0.1,
      depthWrite: false
    });
    for (const [x, z, width] of [[-55, 80, 58], [0, 124, 72], [55, 80, 58]] as const) {
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(width, 8), mistMaterial);
      mist.position.set(x, 1.2, z);
      mist.rotation.x = -Math.PI / 2;
      group.add(mist);
    }
  }

  scene.add(group);
  return group;
};
