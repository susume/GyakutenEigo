# QuizStrike public asset integration

Implemented 30 September 2026. This work targets QuizStrike inside GyakutenEigo; SpeakCheck remains a separate application.

## Runtime and implementation status

QuizStrike is a React 19 / Three.js r178 browser game with Express and Socket.IO. The server owns movement validation, collision, damage, energy, rounds, and objectives. The client owns presentation and input prediction. Unity Input System/Cinemachine and Unreal Enhanced Input/CommonUI require their respective engines; importing their C# or Unreal assets here would not provide a working browser integration.

| Area | Public package or asset | Working integration |
| --- | --- | --- |
| First-person mouse look | [Three.js PointerLockControls, r178](https://github.com/mrdoob/three.js/blob/r178/examples/jsm/controls/PointerLockControls.js) | Live arena, proxy camera adapter, sensitivity preference, modal gating |
| Asset inspection camera | [Three.js OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls) | Development integration lab |
| Contextual HUD | [Motion useAnimate](https://motion.dev/docs/react-use-animate), pinned 13.4.6 | Live combat Health and Zombie human Energy bars |
| Character | [Kenney Animated Characters Protagonists](https://kenney.nl/assets/animated-characters-protagonists), CC0 | **Default live gameplay body**, retargeted offline to the existing 13-bone rig; retains customization and procedural animation |
| Weapon models | [Kenney Blaster Kit 2.1](https://kenney.nl/assets/blaster-kit), CC0 | Three distinct GLBs replace starter/quick/heavy weapons in **first person and third person**, including creator preview |
| Environment | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit), CC0 | Eight palms mounted in live Temple Runoff and Desert Citadel exteriors at balanced/high detail |
| Asset processing | [glTF Transform](https://github.com/donmccurdy/glTF-Transform), pinned CLI 4.5.1 | Repeatable animation resampling and Meshopt compression |
| Optional toon humanoid shader | [pixiv/three-vrm](https://github.com/pixiv/three-vrm), pinned 3.5.5, MIT | Real lazy VRMLoaderPlugin/MToon adapter; typechecked, no third-party VRM model bundled or visually validated |
| Higher-detail character candidate | [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), CC0 | Sourced/documented candidate, not downloaded or installed |

The imported body and blasters now load by default through `CharacterFactory`, which is used by live matches and the player creator. The original meshes are synchronous failure fallbacks. The development lab still inspects the original foreign rig; it is not the gameplay implementation.

## Chromebook, notebook, and tablet HUD

`device-hud.css` scopes the compact combat HUD to the actual game, preserving the separate Athletics HUD. Keyboard players get clustered bottom-left vitals, a short keyboard legend, labeled 48-pixel menu buttons, a centered timer, and a 148-pixel expandable map. Touch players get top-left vitals, a thumb joystick, dedicated Throw/Crouch/Jump buttons, and a 132-pixel expandable map. Notifications are kept away from controls. The redundant weapon-mounted ammo bubble is removed from the combat HUD.

`useArenaInputMode` starts from the primary pointer media query, then follows real pointer and gameplay-key activity. A touchscreen Chromebook does not keep tablet buttons when using its keyboard. Settings persist an Auto / Always show / Hide override, and changing modes does not rebuild the renderer. Full health remains readable at 72% idle opacity; combat, low vitals, and high contrast restore full emphasis.

## Event-driven HUD manager

Implementation: `apps/web/src/game/hud/HudManager.ts`, `ContextualVitalBar.tsx`, and `contextual-hud.css`. Live hooks are in `StudentExperience.tsx`.

Each local player owns one stable HudManager. Its external-store subscriptions notify React only when visibility or combat state changes. It schedules one next deadline, rather than polling in the render loop. Repeated identical server snapshots do not extend the idle deadline.

The actual production hook dispatches authoritative vitals and local/confirmed combat events:

```ts
hudManager.dispatch({ type: "vitals", vitals: {
  health: player.health ?? (player.isAlive ? 100 : 0), maxHealth: getPlayerHealthMax(player),
  energy: player.energy, maxEnergy: ZOMBIE_HUMAN_MAX_ENERGY,
  alive: player.isAlive, active: session.status === "active",
  alwaysVisible: !gamePreferences.contextualHud || gamePreferences.highContrastHud
} });
hudManager.dispatch({ type: "combat" });
```

The real component uses Motion's scoped Web Animations API integration:

```ts
const [scope, animate] = useAnimate<HTMLDivElement>(); // motion/react-mini
const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
const animation = animate(scope.current, { opacity: visible ? 1 : .72 }, {
  duration: reducedMotion ? 0 : visible ? .12 : .4
});
// Effect cleanup:
animation.stop();
```

Visibility policy:

- Firing, confirmed hits, and reduced health reveal both bars for five seconds. Further combat extends that deadline.
- Vital changes and entry into an active/alive state reveal bars for 2.5 seconds.
- Each depleted bar remains visible independently until restored. Inactive, eliminated, paused, high-contrast, and explicitly always-visible contexts keep bars visible.
- Health capacity comes from the shared `getPlayerHealthMax` rule, including Warm Vest and Speed Boots. A boosted player can have 200 HP; displaying or fading against a hardcoded 100 would lose that information.
- Numbers, labelled meters, and low-vital styling remain available; opacity does not remove values from assistive technology. Bars contain no focusable controls.
- OS reduced-motion preference makes opacity changes immediate. Settings lets the player disable contextual fading entirely.
- Money, score, timers, and objectives stay visible. Athletics retains its mode-specific race/energy HUD. The game's resource is Energy; no server stamina mechanic was invented.
- The live status row has individual compact cards and a transparent wrapper, so de-emphasizing Health does not leave an opaque empty panel over the arena. Card positions remain stable while bars fade.

Native browser timers must be called through wrappers, rather than as methods on a clock object. A browser smoke test caught that receiver-binding error, and the regression suite now covers it.

## Input and camera configuration

`PointerLookController.ts` constructs actual `new PointerLockControls(proxyCamera, canvas)`, subscribes to its `change` event, sets `pointerSpeed`, and calls `dispose()` on teardown. It uses a proxy PerspectiveCamera because the arena's physical camera also includes recoil, zoom, spectator state, touch input, and gamepad look.

The capture-phase mouse listener synchronizes current yaw/pitch and enabled state before Three's listener runs. Euler order is YXZ; aim is radians. It preserves the game's original horizontal .0022 and vertical .0018 radians per mouse unit at sensitivity 1.0, and clamps to the existing gameplay pitch limits. The old mouse rotation listener was removed to avoid applying input twice. Existing canvas pointer-lock user gestures are retained.

The settings slider stores sensitivity in the existing preferences key, migrates older saves to 1.0, and clamps values to .2–2.5. Touch and standard-mapped gamepad look use the same preference. Gamepad look uses a radial .18 dead zone and radians per second multiplied by frame delta; a .05-second clamp prevents large camera jumps after a stall. Tests compare 30/60/120 Hz. Nonstandard gamepads are ignored rather than guessed. Movement retains the existing gameplay speed/collision controller and digital movement semantics.

## Reproduce the character pipeline

Dependencies are pinned in `apps/web/package.json` and the workspace lockfile. Use the repository's supported Node version (`^20.19.0 || >=22.13.0`). Run commands from the repository root:

```powershell
npm ci
# Download and extract the official Kenney pack, then provide its local directory:
node scripts/assets/import-kenney-character.mjs C:\Assets\kenney_animated-characters-protagonists
node scripts/assets/optimize-community-character.mjs
npm run dev
```

Open `http://localhost:5173/modernization-lab`. This is a development-only route and its lab chunk is excluded from production builds. The lab exercises the actual distributed GLB, PNG atlas, Meshopt decoding, skeleton cloning, animation blending, HUD manager, and pool teardown, rather than rendering a stand-in model.

The importer uses real `FBXLoader.parse` and `GLTFExporter.parseAsync`. It combines `Model/characterMedium.fbx` with the pack's `idle.fbx`, `run.fbx`, and `jump.fbx`. It selects the matching named clips and removes root/hips translation tracks so clips cannot move the authoritative player root. It normalizes the rest bounds to 2.05 local units and grounds the feet at zero. The source FBX includes a zero-opacity material; the importer replaces it with an opaque MeshStandardMaterial, roughness .85, metalness zero.

The glTF Transform script executes `resample` and `meshopt` with structured subprocess arguments. It writes the final file only after both commands succeed, and updates a SHA-256 provenance record. The exported 692,340-byte GLB becomes 213,180 bytes. The separate 1024×1024 PNG remains an atlas, loaded once per pool with SRGBColorSpace and `flipY = false`. Its GPU cost is about 5.33 MiB including a full RGBA8 mip chain, shared across avatars.

`CommunityCharacterPool.ts` uses these real Three APIs:

```ts
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const prefab = await loader.loadAsync(url);
prefab.scene.updateMatrixWorld(true);
const avatar = cloneSkeleton(prefab.scene); // SkeletonUtils.clone
const mixer = new THREE.AnimationMixer(avatar);
const action = mixer.clipAction(prefab.animations[0]);
action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
```

The implementation shares parsed geometry, materials, clips, and texture; skeletons and mixers belong to individual avatars. Animation transitions call `crossFadeFrom`. The network transform belongs on `instance.root`; `instance.update(delta, speed, jumping, animate)` owns only visual animation. Skipped animation frames accumulate time so a reduced update cadence does not slow locomotion clips. Releasing one avatar disposes its skeleton and mixer, without disposing shared mesh resources. Disposing the pool releases its owned resources and handles in-flight loads.

Each character has 1,604 triangles and one material draw. Forty characters cost 64,160 character triangles. Browser evidence: the lab's 40 avatars, two palms, and floor report **45 draw calls, 64,534 triangles, four shared geometries**. These are visible-pass renderer counters, not total shadow-pass work, a frame-rate guarantee, or a measurement on school iPads. Each rig still has its own CPU animation and bone palette cost.

### Live gameplay retargeting and scaling

Run from the repository root:

```powershell
node node_modules/tsx/dist/cli.mjs scripts/assets/retarget-kenney-student.mjs
node scripts/assets/import-kenney-blasters.mjs C:\Assets\kenney_blaster-kit_2.1
```

The retargeter bakes the source mesh's bind-space correction with Three's `SkinnedMesh.applyBoneTransform`, turns its +Z facing to the game's −Z, remaps weighted limb axes to the existing rest joints, and consolidates skin weights into 13 gameplay bones. Hands use their own 0.06-unit calibration rather than the shin's 0.3-unit calibration. The shipped body has 852 triangles before selected footwear is merged; its GLB is approximately 134 KiB and needs no texture download. Semantic vertex palette regions retain team jerseys, trousers, skin and gloves. The original custom head and selected footwear remain on the established rig.

`CommunityStudentBodyLibrary` loads once per factory and caches combined geometry by footwear and palette. Each avatar keeps its own skeleton and existing CharacterAnimator/CharacterLOD. Geometry and materials are shared, and releasing one avatar does not dispose another's body. Late adoption checks both factory disposal and departed owners. Bone textures are disposed when avatars leave. Factory disposal owns the imported geometry/material lifetime.

`CommunityWeaponLibrary` uses `GLTFLoader.loadAsync` and shared static prefab clones. glTF Transform's NodeIO embeds the palette texture, flattens and joins the source static meshes. The starter/quick/heavy GLBs are about 37/28/35 KiB. Geometry is normalized to the existing muzzle Z, while rear grip, support, shoulder, sight, recoil, projectile effects and zoom anchors remain stable. Legacy detail layers are disabled after successful adoption so CharacterLOD cannot reveal the old gun over the replacement. Loading failure keeps the original visible meshes.

The final actor still uses CharacterFactory's 2.45 scale and existing silhouette scaling, animation, accessories, hitbox methods, and multiplayer sync. Imported geometry never changes authoritative collision or damage eligibility. First-person sleeve/hand primitives and custom cosmetic heads remain existing artwork; those were not represented as imported assets.

Desert Citadel keeps its collision and cover layout, with clearer blue daylight and the same CC0 palm kit used for Temple Runoff. Its backdrop palms are 28 units high so their crowns clear the outer walls; placement stays beyond playable bounds. The kit is omitted at Low detail. This is an environment art refresh, not a replacement map layout.

### Higher-detail bases and MToon

[Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) provides humanoid bases, glTF/FBX formats, and compatibility with its Universal Animation Library. The author states an average 13k triangles. Forty such bodies alone would be roughly 520k triangles before map, equipment, or effects, so author lower-detail LODs and keep atlas/material counts small. The free Standard edition is a subset; Source includes additional engine projects, shaders, and .blend files. Select the exact free download and retain its license before importing.

`loadVrmCharacter.ts` provides an optional real MToon/VRM path:

```ts
const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
loader.register(parser => new VRMLoaderPlugin(parser));
const gltf = await loader.loadAsync(url);
const vrm = gltf.userData.vrm;
VRMUtils.rotateVRM0(vrm);
VRMUtils.combineSkeletons(vrm.scene);
vrm.update(delta);
```

The helper also rejects non-VRM input, calls removeUnnecessaryVertices, and deep-disposes its owned runtime. Use a separately licensed humanoid asset; the SDK's MIT license does not license arbitrary VRM characters. MToon materials are handled by the loader plugin. Do not paste Unity URP shader code or Unreal Substrate graphs into Three. Retarget animation using the humanoid mapping, and avoid cloning a VRM scene without rebuilding its humanoid, spring-bone, expression, and material runtime references. This initial adapter disables frustum culling to avoid animated bounds clipping; classroom rollout requires validated skinned bounds and LOD/shadow policy. It has not been exercised with a real VRM model yet.

## Environmental assets and maps

The Nature Kit palm is included with its original license and SHA-256 provenance. It is 186 triangles with two material primitives and no textures. `CommunityEnvironment.ts` normalizes source height 1.51459062 to 12 world units, places eight trees beyond movement limit X plus 16, and mounts through the existing reference-counted EnvironmentKitLoader/GLTFLoader pipeline. Budget: 1,488 triangles and up to 16 visible-pass draws before culling, zero texture allocation. Performance detail skips them; FPS mode disables their shadow casting. These palms are decoration, not colliders or cover.

For a map rebuild, use the repository's shared map definition as the gameplay source of truth. Change server/client collision surfaces, bounds, team spawns, objectives, and bot navigation together, then fit public modular architecture to those dimensions. A GLB visual wall without a shared collider creates misleading cover; moving a staircase without matching ground queries produces teleporting or stuck players. Store meter/world-unit conversion once at the kit root rather than scaling individual collision values ad hoc.

Use the existing static batching/InstancedMesh path for repeated non-skinned props with compatible geometry and materials. Keep skinned actors in a separate pool. Bake decorative lighting when appropriate, reuse atlases, avoid per-leaf transparency and unnecessary shadows, and measure the complete map with active players/effects at each arena quality tier. Meshopt reduces transfer/decode payload; it does not lower triangle count. Create actual LOD geometry separately.

## Validation and evidence

Automated coverage includes HUD deadlines and cleanup, browser timer receivers, unchanged network snapshots, accessibility visibility, preference migration/clamps, gamepad frame-rate independence/dead zone/stall handling, real PointerLockControls event/disposal behavior, actual compressed GLB decoding and independent skeletons, root-motion isolation, and decorative placement/draw budget.

Browser checks cover independent idle/run animation, 4→40→4 pool rebuilds, shared geometry counts, combat interruption, depleted-vital persistence, full-vital fading, and responsive lab layout. Screenshots are beside this file. The lab is a fixture for visual/load validation; it does not certify the optional VRM path or replace multiplayer device/load tests.

Live multiplayer verification used local Temple Runoff sessions: firing consumed ammunition and interrupted a faded Health bar; the settings modal blocked firing; sensitivity changed from 1.00 to 1.05; high contrast restored the idle bar. Purchasing Warm Vest and Speed Boots changed the authoritative HUD from 100/100 to 170/170 and 200/200. Test preferences were restored afterward and the active arena emitted no console warnings/errors. Earlier integration result: **288 web tests passed**, web typecheck passed, repository lint passed, and web production build passed. The build retains the Three.js chunk-size warning. `npm audit` also reports existing advisories; all flagged package versions match the starting lockfile, and this work does not repair those dependencies.

```powershell
npm run test -w @quizstrike/web
npm run typecheck -w @quizstrike/web
npm run lint
npm run build -w @quizstrike/web
```

No engine migration, server rules change, or deployment is part of this change. Upstream licenses and source provenance are distributed under `apps/web/public/assets/community/`.

## Device-focused live verification

Local multiplayer review uses the real Desert Citadel arena with eight bots and the live starter blaster. The tablet Throw button changed authoritative ammo from 10 to 9. Keyboard activity hid the touch controls. Screenshots for notebook, landscape tablet, portrait tablet and the actual player creator are saved beside this guide. These are browser viewport checks, not physical Chromebook/iPad performance certification. The shipped-body regression decodes the exact GLB, checks all bone indices and normalized weights, verifies bounds and footwear, confirms geometry sharing, and rejects late adoption onto a departed avatar.

Current device-focused validation: **290 web tests passed**; web typecheck (including e2e TypeScript), repository lint and web production build passed. The existing Three.js chunk-size warning remains.

Final live evidence: eight remote avatars reported `data-imported-characters="8"`. Map expand/shrink was verified after restoring pointer input to the title button. Fox head and Army Boots were saved and rendered on the imported body in the real player creator with no console warnings/errors. Automatic touch preference was restored and the local review sessions were ended. Browser automation produced a nonfatal PointerLockControls error while an earlier blocked map click reached the canvas; keyboard look and touch input remained usable. Pointer lock should still be checked on physical devices.
