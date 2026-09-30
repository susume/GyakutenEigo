import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { VRM } from "@pixiv/three-vrm";

/** Optional MToon/VRM path. Separate runtime objects per avatar, loaded only when requested. */
export async function loadVrmCharacter(url: string) {
  const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) { VRMUtils.deepDispose(gltf.scene); throw new Error("Asset is not a VRM humanoid"); }
  VRMUtils.rotateVRM0(vrm);
  VRMUtils.removeUnnecessaryVertices(vrm.scene);
  VRMUtils.combineSkeletons(vrm.scene);
  vrm.scene.traverse((object) => { object.frustumCulled = false; });
  let disposed = false;
  return {
    vrm,
    update: (delta: number) => { if (!disposed) vrm.update(Math.max(0, Math.min(delta, .05))); },
    dispose: () => { if (!disposed) { disposed = true; vrm.scene.removeFromParent(); VRMUtils.deepDispose(vrm.scene); } }
  };
}
