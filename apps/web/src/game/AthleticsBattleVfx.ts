import * as THREE from "three";
import { ATHLETICS_BATTLE_CHARGE_MS, ATHLETICS_BATTLE_CHARGE_EXPIRES_MS, ATHLETICS_BATTLE_RADIUS, ATHLETICS_BATTLE_RANGE, ATHLETICS_BATTLE_SPEED, getAthleticsBattleBlastPosition, getAthleticsBattleProtection, type AthleticsBattleBlast, type AthleticsBattlePoint, type GameSession } from "@quizstrike/shared";

export interface BattleImpactCue { blastId: string; position: AthleticsBattlePoint; targetId?: string }
const impactListeners = new Set<(cue: BattleImpactCue) => void>();
const launchListeners = new Set<(blast: AthleticsBattleBlast) => void>();
export const emitAthleticsBattleImpact = (cue: BattleImpactCue) => impactListeners.forEach((listener) => listener(cue));
export const emitAthleticsBattleLaunch = (blast: AthleticsBattleBlast) => launchListeners.forEach((listener) => listener(blast));

/** Draw the complete casting seal in one mesh, without a downloaded texture. */
const createCastingSigilGeometry = () => {
  const vertices: number[] = [];
  const stroke = (ax: number, ay: number, bx: number, by: number, width = 0.018) => {
    const length = Math.hypot(bx - ax, by - ay);
    const dx = -(by - ay) / length * width / 2;
    const dy = (bx - ax) / length * width / 2;
    vertices.push(ax + dx, ay + dy, 0, ax - dx, ay - dy, 0, bx + dx, by + dy, 0,
      bx + dx, by + dy, 0, ax - dx, ay - dy, 0, bx - dx, by - dy, 0);
  };
  for (const radius of [1.12, 1.48]) {
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2; const b = (i + 1) / 72 * Math.PI * 2;
      stroke(Math.cos(a) * radius, Math.sin(a) * radius, Math.cos(b) * radius, Math.sin(b) * radius);
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2; const b = (i + 2) / 6 * Math.PI * 2;
    stroke(Math.cos(a) * 0.94, Math.sin(a) * 0.94, Math.cos(b) * 0.94, Math.sin(b) * 0.94, 0.012);
  }
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const runeStroke = (ax: number, ay: number, bx: number, by: number) => stroke(
      Math.cos(angle) * (1.3 + ay) - Math.sin(angle) * ax, Math.sin(angle) * (1.3 + ay) + Math.cos(angle) * ax,
      Math.cos(angle) * (1.3 + by) - Math.sin(angle) * bx, Math.sin(angle) * (1.3 + by) + Math.cos(angle) * bx);
    runeStroke(0, -0.1, 0, 0.1);
    runeStroke(-0.07, 0.02, 0, 0.1);
    runeStroke(0, 0.1, 0.07, 0.02);
    runeStroke(i % 2 ? -0.07 : 0.07, -0.06, 0, 0);
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
};

/** Shared geometry and bounded pools keep classroom volleys inexpensive. No dynamic lights. */
export const createAthleticsBattleVfx = (scene: THREE.Scene, reducedMotion = false, camera?: THREE.PerspectiveCamera) => {
  const root = new THREE.Group();
  root.name = "athletics-battle-vfx";
  scene.add(root);
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const torus = new THREE.TorusGeometry(1, 0.045, 5, 28);
  const star = new THREE.OctahedronGeometry(0.18);
  const sigilGeometry = createCastingSigilGeometry();
  const glowPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
    const offset = (y * 64 + x) * 4;
    glowPixels.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - radius) ** 2)], offset);
  }
  const glowTexture = new THREE.DataTexture(glowPixels, 64, 64);
  glowTexture.needsUpdate = true;
  const material = (color: number, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const aura = (color: number, opacity: number) => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const particlePose = new THREE.Object3D();
  const forward = new THREE.Vector3(0, 0, -1);
  const direction = new THREE.Vector3();
  const makeOrb = (projectile: boolean) => {
    const group = new THREE.Group();
    const core = new THREE.Mesh(sphere, material(0xf0feff));
    core.scale.setScalar(0.34);
    const shell = new THREE.Mesh(sphere, material(0x45dbff, 0.18));
    shell.scale.setScalar(0.65);
    const glow = aura(0x55cfff, 0.95);
    glow.scale.set(4.4, 4.4, 1);
    const rings = [new THREE.Mesh(torus, material(0x8ef5ff, 0.9)), new THREE.Mesh(torus, material(0xc09aff, 0.8))];
    rings[0].scale.setScalar(0.8);
    rings[0].rotation.x = Math.PI / 3;
    rings[1].scale.setScalar(1.04);
    rings[1].rotation.y = Math.PI / 3;
    const sigil = projectile ? undefined : new THREE.Mesh(sigilGeometry, material(0xc9b1ff, 0.8));
    if (sigil) { sigil.material.side = THREE.DoubleSide; sigil.position.z = 0.12; sigil.name = "battle-casting-sigil"; }
    const particles = new THREE.InstancedMesh(projectile ? sphere : star, material(0xffffff, projectile ? 0.4 : 0.65), projectile ? 8 : 12);
    particles.name = projectile ? "battle-comet-trail" : "battle-gathering-energy";
    particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Particle positions change inside a small fixed envelope; avoid stale bounds.
    particles.frustumCulled = false;
    for (let i = 0; i < particles.count; i++) particles.setColorAt(i, new THREE.Color(i % 2 ? 0xb494ff : 0x69eaff));
    group.add(core, shell, glow, ...rings, particles);
    if (sigil) group.add(sigil);
    group.visible = false;
    root.add(group);
    return { group, shell, glow, rings, sigil, particles, key: "" };
  };
  const shots = Array.from({ length: 48 }, () => makeOrb(true));
  const charges = Array.from({ length: 40 }, () => makeOrb(false));
  shots.forEach((item, index) => { item.group.name = `battle-projectile-${index}`; });
  charges.forEach((item, index) => { item.group.name = `battle-charge-${index}`; });
  const launches = Array.from({ length: 12 }, (_, index) => {
    const group = new THREE.Group();
    group.name = `battle-launch-${index}`;
    const rings = [new THREE.Mesh(torus, material(0xb0f5ff)), new THREE.Mesh(torus, material(0xc09aff))];
    const flash = aura(0x8eeaff, 0.7);
    flash.scale.set(3.2, 3.2, 1);
    group.add(...rings, flash);
    group.visible = false;
    root.add(group);
    return { group, rings, flash, startedAt: -Infinity };
  });
  const stuns = Array.from({ length: 40 }, () => {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(torus, material(0xc8a4ff, 0.85));
    ring.rotation.x = Math.PI / 2;
    ring.scale.setScalar(1.12);
    group.add(ring);
    for (let index = 0; index < 5; index++) {
      const mesh = new THREE.Mesh(star, material(index % 2 ? 0xbca3ff : 0xb0f3ff));
      const angle = index / 5 * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 1.12, Math.sin(angle * 2) * 0.1, Math.sin(angle) * 1.12);
      group.add(mesh);
    }
    group.visible = false;
    root.add(group);
    return group;
  });
  stuns.forEach((group, index) => { group.name = `battle-stun-${index}`; });
  const protections = Array.from({ length: 40 }, (_, index) => {
    const group = new THREE.Group();
    group.name = `battle-protection-${index}`;
    const shell = new THREE.Mesh(sphere, material(0x64e8ff, 0.08));
    const outlineMaterial = material(0x9fffee, 0.28);
    outlineMaterial.wireframe = true;
    const outline = new THREE.Mesh(sphere, outlineMaterial);
    const ring = new THREE.Mesh(torus, material(0xb4fff2, 0.7));
    ring.rotation.x = Math.PI / 2;
    ring.scale.setScalar(1.15);
    group.add(shell, outline, ring);
    group.visible = false;
    root.add(group);
    return { group, shell, outline, ring };
  });
  const impacts = Array.from({ length: 12 }, () => {
    const group = new THREE.Group();
    const rings = [new THREE.Mesh(torus, material(0x82eeff)), new THREE.Mesh(torus, material(0xc99cff))];
    rings[1].rotation.x = Math.PI / 2;
    group.add(...rings);
    const sparks = Array.from({ length: 14 }, (_, index) => {
      const spark = new THREE.Mesh(star, material(index % 2 ? 0x8beaff : 0xddc2ff));
      const angle = index * 2.39996;
      const y = 1 - index / 6.5;
      const radial = Math.sqrt(Math.max(0, 1 - y * y));
      spark.position.set(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
      group.add(spark);
      return spark;
    });
    group.visible = false;
    root.add(group);
    return { group, rings, sparks, startedAt: -Infinity };
  });
  impacts.forEach((item, index) => { item.group.name = `battle-impact-${index}`; });
  let cursor = 0;
  let launchCursor = 0;
  let currentSession: GameSession | null | undefined;
  let sessionKey: string | undefined;
  let frameNowMs = 0;
  let frameAt = 0;
  const resolvedBlasts = new Set<string>();
  const launchedBlasts = new Set<string>();
  const startLaunch = (blast: AthleticsBattleBlast, nowMs: number) => {
    if (launchedBlasts.has(blast.id)) return;
    launchedBlasts.add(blast.id);
    if (launchedBlasts.size > 128) launchedBlasts.delete(launchedBlasts.values().next().value!);
    // Events give immediate feedback even if a nearby wall absorbs the shot
    // before the next snapshot. Old snapshots must never replay the release.
    if (nowMs - blast.launchedAt >= 420) return;
    const launch = launches[launchCursor++ % launches.length];
    launch.startedAt = blast.launchedAt;
    direction.set(blast.direction.x, blast.direction.y, blast.direction.z);
    launch.group.position.set(blast.origin.x, blast.origin.y, blast.origin.z).addScaledVector(direction, 3);
    launch.group.quaternion.setFromUnitVectors(forward, direction);
  };
  const onLaunch = (blast: AthleticsBattleBlast) => {
    if (!currentSession?.settings.athleticsBattleEnabled || currentSession.status !== "active") return;
    startLaunch(blast, frameNowMs + performance.now() - frameAt);
  };
  const onImpact = (cue: BattleImpactCue) => {
    if (!currentSession?.settings.athleticsBattleEnabled || currentSession.status !== "active") return;
    if (resolvedBlasts.has(cue.blastId)) return;
    resolvedBlasts.add(cue.blastId);
    // Bound deduplication memory for long classes, including reconnect replays.
    if (resolvedBlasts.size > 128) resolvedBlasts.delete(resolvedBlasts.values().next().value!);
    const item = impacts[cursor++ % impacts.length];
    item.startedAt = performance.now();
    item.group.position.set(cue.position.x, cue.position.y, cue.position.z);
    item.group.visible = true;
    const shot = shots.find((item) => item.key === cue.blastId);
    if (shot) { shot.group.visible = false; shot.key = ""; }
  };
  impactListeners.add(onImpact);
  launchListeners.add(onLaunch);
  const assign = (pool: typeof shots, keys: Set<string>) => {
    for (const item of pool) if (!keys.has(item.key)) { item.key = ""; item.group.visible = false; }
  };
  return {
    update(session: GameSession | null | undefined, nowMs: number, local?: { playerId: string; position: AthleticsBattlePoint; facing: number; pitch: number; progress: number | null }) {
      const nextKey = session ? `${session.id}:${session.currentRound}:${session.athletics?.modeRound ?? 1}` : undefined;
      if (sessionKey !== nextKey) {
        resolvedBlasts.clear();
        launchedBlasts.clear();
        impacts.forEach((item) => { item.startedAt = -Infinity; item.group.visible = false; });
        launches.forEach((item) => { item.startedAt = -Infinity; item.group.visible = false; });
        sessionKey = nextKey;
      }
      currentSession = session;
      frameNowMs = nowMs;
      frameAt = performance.now();
      root.visible = session?.settings.athleticsBattleEnabled === true && session.status === "active";
      if (!root.visible) return;
      const blasts = (session?.athletics?.battleBlasts ?? []).filter((blast) =>
        !resolvedBlasts.has(blast.id) && nowMs >= blast.launchedAt
        && (nowMs - blast.launchedAt) * ATHLETICS_BATTLE_SPEED / 1000 < ATHLETICS_BATTLE_RANGE);
      assign(shots, new Set(blasts.map((blast) => blast.id)));
      for (const blast of blasts) {
        const item = shots.find((item) => item.key === blast.id) ?? shots.find((item) => !item.key);
        if (!item) continue;
        item.key = blast.id;
        const age = nowMs - blast.launchedAt;
        startLaunch(blast, nowMs);
        direction.set(blast.direction.x, blast.direction.y, blast.direction.z);
        const position = getAthleticsBattleBlastPosition(blast, nowMs);
        item.group.visible = true;
        item.group.position.set(position.x, position.y, position.z);
        item.group.quaternion.setFromUnitVectors(forward, direction);
        item.group.scale.setScalar(ATHLETICS_BATTLE_RADIUS / 0.34);
        item.rings[0].rotation.z = reducedMotion ? 0 : nowMs * 0.012;
        item.rings[1].rotation.z = reducedMotion ? 0 : -nowMs * 0.009;
        // A tapered, overlapping comet wake stays behind the fixed launch ray.
        const trailLength = Math.min(8, age * ATHLETICS_BATTLE_SPEED / 1000) / item.group.scale.x;
        for (let i = 0; i < item.particles.count; i++) {
          const fraction = (i + 1) / item.particles.count;
          const width = 0.56 * (1 - fraction * 0.8);
          particlePose.position.set(0, 0, fraction * trailLength);
          particlePose.rotation.set(0, 0, 0);
          particlePose.scale.set(width, width, trailLength / item.particles.count * 1.15);
          particlePose.updateMatrix();
          item.particles.setMatrixAt(i, particlePose.matrix);
        }
        item.particles.instanceMatrix.needsUpdate = true;
      }
      const players = session?.players ?? [];
      const chargingPlayers = players.filter((player) => {
        if (player.connectionState === "disconnected") return false;
        if (player.id === local?.playerId) return local.progress !== null;
        const elapsed = nowMs - Date.parse(player.athletics?.battleChargeStartedAt ?? "");
        return elapsed >= 0 && elapsed <= ATHLETICS_BATTLE_CHARGE_EXPIRES_MS;
      });
      assign(charges, new Set(chargingPlayers.map((player) => player.id)));
      for (const player of chargingPlayers) {
        const item = charges.find((item) => item.key === player.id) ?? charges.find((item) => !item.key);
        if (!item) continue;
        item.key = player.id;
        const isLocal = player.id === local?.playerId;
        const progress = THREE.MathUtils.clamp(isLocal ? local!.progress ?? 0 : (nowMs - Date.parse(player.athletics?.battleChargeStartedAt ?? "")) / ATHLETICS_BATTLE_CHARGE_MS, 0, 1);
        const facing = isLocal ? local!.facing : player.facing ?? 0;
        const eye = isLocal ? local!.position : { x: player.x ?? 0, y: player.y ?? 4.21, z: player.z ?? 0 };
        const pitch = isLocal ? local!.pitch : 0;
        const narrow = isLocal && (camera?.aspect ?? 1.6) < 1;
        const distance = isLocal ? 3 : 1.5;
        const side = isLocal ? (narrow ? 0.18 : 0.75) : 0;
        direction.set(-Math.sin(facing) * Math.cos(pitch), Math.sin(pitch), -Math.cos(facing) * Math.cos(pitch));
        item.group.position.set(eye.x + Math.cos(facing) * side, eye.y - (narrow ? 0.2 : 0.65), eye.z - Math.sin(facing) * side).addScaledVector(direction, distance);
        item.group.quaternion.setFromUnitVectors(forward, direction);
        item.group.visible = true;
        item.group.scale.setScalar(isLocal ? (narrow ? 0.26 + progress * 0.22 : 0.42 + progress * 0.4) : 0.45 + progress * 0.9);
        item.glow.material.opacity = 0.5 + progress * 0.5;
        item.shell.material.opacity = 0.12 + progress * 0.2;
        item.sigil!.material.opacity = 0.25 + progress * 0.65;
        item.sigil!.rotation.z = reducedMotion ? 0 : -nowMs * 0.0005;
        item.rings[0].rotation.z = reducedMotion ? 0 : nowMs * (0.002 + progress * 0.006);
        item.rings[1].rotation.x = reducedMotion ? 0 : nowMs * 0.003;
        item.particles.visible = !reducedMotion;
        for (let i = 0; i < item.particles.count && !reducedMotion; i++) {
          const gather = (nowMs / 850 + i / item.particles.count) % 1;
          const angle = i * 2.39996 + nowMs * 0.0018 + gather * 2;
          const radius = 0.25 + (1 - gather) * (1.5 - progress * 0.35);
          particlePose.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(angle * 2) * 0.4);
          particlePose.rotation.set(angle, angle, 0);
          particlePose.scale.setScalar((0.45 + progress * 0.4) * (1 - gather * 0.6));
          particlePose.updateMatrix();
          item.particles.setMatrixAt(i, particlePose.matrix);
        }
        item.particles.instanceMatrix.needsUpdate = !reducedMotion;
      }
      for (const item of launches) {
        const amount = (nowMs - item.startedAt) / (reducedMotion ? 240 : 420);
        item.group.visible = amount >= 0 && amount < 1;
        if (!item.group.visible) continue;
        item.group.scale.setScalar(reducedMotion ? 0.8 : 0.35 + amount * 1.45);
        item.rings.forEach((ring, index) => {
          ring.scale.setScalar(1 + index * 0.3);
          ring.position.z = reducedMotion ? 0 : index * amount * 0.7;
          ring.material.opacity = (1 - amount) * 0.85;
        });
        item.flash.material.opacity = (1 - amount) * 0.65;
      }
      stuns.forEach((group, index) => {
        const player = players[index];
        group.visible = Boolean(player && nowMs < Date.parse(player.athletics?.battleStunnedUntil ?? "") && player.id !== local?.playerId);
        if (group.visible && player) {
          group.position.set(player.x ?? 0, (player.y ?? 4.21) + 0.9, player.z ?? 0);
          group.rotation.y = reducedMotion ? 0 : nowMs * 0.0018;
        }
      });
      protections.forEach((item, index) => {
        const player = players[index];
        const protection = player ? getAthleticsBattleProtection(player, nowMs) : undefined;
        item.group.visible = Boolean(player && player.id !== local?.playerId && (protection === "studying" || protection === "recovery"));
        if (!item.group.visible || !player) return;
        const height = player.crouching ? 3.1 : 4.9;
        item.group.position.set(player.x ?? 0, (player.y ?? 4.21) - (player.crouching ? 2.65 : 4.21) + height / 2, player.z ?? 0);
        item.shell.scale.set(1.05, height / 2, 1.05);
        item.outline.scale.copy(item.shell.scale);
        item.ring.position.y = -height / 2 + 0.18;
        item.group.rotation.y = reducedMotion ? 0 : nowMs * 0.0007;
        const fade = protection === "recovery" ? Math.min(1, Math.max(0, Date.parse(player.athletics?.battleImmuneUntil ?? "") - nowMs) / 600) : 1;
        item.shell.material.opacity = 0.08 * fade;
        item.outline.material.opacity = 0.28 * fade;
        item.ring.material.opacity = 0.7 * fade;
        item.outline.material.color.setHex(protection === "studying" ? 0x9fffee : 0x9fdfff);
      });
      const effectNow = performance.now();
      for (const item of impacts) {
        const amount = (effectNow - item.startedAt) / (reducedMotion ? 260 : 650);
        item.group.visible = amount >= 0 && amount < 1;
        if (!item.group.visible) continue;
        const radius = reducedMotion ? 1.3 : 0.4 + amount * 3.6;
        item.group.scale.setScalar(radius);
        item.rings.forEach((ring) => { ring.material.opacity = (1 - amount) * 0.8; });
        item.sparks.forEach((spark) => { spark.visible = !reducedMotion; spark.material.opacity = (1 - amount) * 0.85; });
      }
    },
    dispose() {
      impactListeners.delete(onImpact);
      launchListeners.delete(onLaunch);
      resolvedBlasts.clear();
      launchedBlasts.clear();
      const materials = new Set<THREE.Material>();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) materials.add(object.material as THREE.Material);
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      materials.forEach((item) => item.dispose());
      sphere.dispose(); torus.dispose(); star.dispose(); sigilGeometry.dispose(); glowTexture.dispose();
      root.removeFromParent();
    }
  };
};
