import * as THREE from "three";
import { ATHLETICS_BATTLE_CHARGE_MS, ATHLETICS_BATTLE_CHARGE_EXPIRES_MS, ATHLETICS_BATTLE_RADIUS, ATHLETICS_BATTLE_RANGE, ATHLETICS_BATTLE_SPEED, getAthleticsBattleBlastPosition, getAthleticsBattleProtection, type AthleticsBattlePoint, type GameSession } from "@quizstrike/shared";

export interface BattleImpactCue { blastId: string; position: AthleticsBattlePoint; targetId?: string }
const impactListeners = new Set<(cue: BattleImpactCue) => void>();
export const emitAthleticsBattleImpact = (cue: BattleImpactCue) => impactListeners.forEach((listener) => listener(cue));

/** Shared geometry and bounded pools keep classroom volleys inexpensive. No dynamic lights. */
export const createAthleticsBattleVfx = (scene: THREE.Scene, reducedMotion = false) => {
  const root = new THREE.Group();
  root.name = "athletics-battle-vfx";
  scene.add(root);
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  const torus = new THREE.TorusGeometry(1, 0.045, 5, 28);
  const star = new THREE.OctahedronGeometry(0.18);
  const material = (color: number, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const makeOrb = () => {
    const group = new THREE.Group();
    const core = new THREE.Mesh(sphere, material(0xf0feff));
    core.scale.setScalar(0.34);
    const glow = new THREE.Mesh(sphere, material(0x45dbff, 0.2));
    glow.scale.setScalar(0.8);
    const rings = [new THREE.Mesh(torus, material(0x91eaff, 0.86)), new THREE.Mesh(torus, material(0xc89cff, 0.7))];
    rings[0].rotation.x = Math.PI / 2;
    rings[1].rotation.y = Math.PI / 3;
    const trail = Array.from({ length: 6 }, (_, index) => {
      const mesh = new THREE.Mesh(sphere, material(index % 2 ? 0xaf92ff : 0x51ddff, 0.36 - index * 0.045));
      mesh.scale.setScalar(0.32 - index * 0.035);
      mesh.position.z = (index + 1) * 0.72;
      return mesh;
    });
    group.add(core, glow, ...rings, ...trail);
    group.visible = false;
    root.add(group);
    return { group, rings, trail, key: "" };
  };
  const shots = Array.from({ length: 48 }, makeOrb);
  const charges = Array.from({ length: 40 }, makeOrb);
  shots.forEach((item, index) => { item.group.name = `battle-projectile-${index}`; });
  charges.forEach((item, index) => { item.group.name = `battle-charge-${index}`; });
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
  let currentSession: GameSession | null | undefined;
  let sessionKey: string | undefined;
  const resolvedBlasts = new Set<string>();
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
  const assign = (pool: typeof shots, keys: Set<string>) => {
    for (const item of pool) if (!keys.has(item.key)) { item.key = ""; item.group.visible = false; }
  };
  return {
    update(session: GameSession | null | undefined, nowMs: number, local?: { playerId: string; position: AthleticsBattlePoint; facing: number; pitch: number; progress: number | null }) {
      const nextKey = session ? `${session.id}:${session.currentRound}:${session.athletics?.modeRound ?? 1}` : undefined;
      if (sessionKey !== nextKey) {
        resolvedBlasts.clear();
        impacts.forEach((item) => { item.startedAt = -Infinity; item.group.visible = false; });
        sessionKey = nextKey;
      }
      currentSession = session;
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
        const position = getAthleticsBattleBlastPosition(blast, nowMs);
        item.group.visible = true;
        item.group.position.set(position.x, position.y, position.z);
        item.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(blast.direction.x, blast.direction.y, blast.direction.z));
        item.group.scale.setScalar(ATHLETICS_BATTLE_RADIUS / 0.34);
        item.rings[0].rotation.z = reducedMotion ? 0 : nowMs * 0.012;
        item.rings[1].rotation.z = reducedMotion ? 0 : -nowMs * 0.009;
        item.trail.forEach((mesh) => { mesh.visible = true; });
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
        const progress = isLocal ? local!.progress ?? 0 : Math.max(0, Math.min(1, (nowMs - Date.parse(player.athletics?.battleChargeStartedAt ?? "")) / ATHLETICS_BATTLE_CHARGE_MS));
        const facing = isLocal ? local!.facing : player.facing ?? 0;
        const eye = isLocal ? local!.position : { x: player.x ?? 0, y: player.y ?? 4.21, z: player.z ?? 0 };
        const pitch = isLocal ? local!.pitch : 0;
        const distance = isLocal ? 2.8 : 1.5;
        item.group.position.set(eye.x - Math.sin(facing) * distance + Math.cos(facing) * (isLocal ? 0.4 : 0), eye.y - 0.55 + Math.sin(pitch) * distance, eye.z - Math.cos(facing) * distance - Math.sin(facing) * (isLocal ? 0.4 : 0));
        item.group.visible = true;
        item.group.scale.setScalar(isLocal ? 0.16 + progress * 0.28 : 0.25 + progress * 0.85);
        item.rings[0].rotation.z = reducedMotion ? 0 : nowMs * (0.002 + progress * 0.006);
        item.rings[1].rotation.x = reducedMotion ? 0 : nowMs * 0.004;
        item.trail.forEach((mesh) => { mesh.visible = false; });
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
      resolvedBlasts.clear();
      const materials = new Set<THREE.Material>();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) materials.add(object.material as THREE.Material);
      });
      materials.forEach((item) => item.dispose());
      sphere.dispose(); torus.dispose(); star.dispose();
      root.removeFromParent();
    }
  };
};
