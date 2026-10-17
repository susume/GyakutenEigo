import {
  ATHLETICS_BATTLE_CHARGE_EXPIRES_MS, ATHLETICS_BATTLE_CHARGE_MS,
  ATHLETICS_BATTLE_IMMUNITY_MS,
  ATHLETICS_BATTLE_RADIUS, ATHLETICS_BATTLE_RANGE, ATHLETICS_BATTLE_SPEED,
  ATHLETICS_BATTLE_STUN_MS, ATHLETICS_PLAYER_EYE_HEIGHT,
  clampArenaAimPitch, getAthleticsBattleBlastPosition, getAthleticsBattleBodyContact, getAthleticsBattleProtection,
  getAthleticsObstacles, getAthleticsPhysicalSupport, hasLineOfSight, isAthleticsBattleStudying, isTeacherPaused, normalizeAthleticsEnergy, sanitizeAthleticsBattleEnergyCost,
  type AthleticsActionCommand, type AthleticsBattlePoint, type GameSession, type PlayerSession
} from "@quizstrike/shared";

const active = (deadline: string | undefined, nowMs: number) => Boolean(deadline && nowMs < Date.parse(deadline));
export const clearAthleticsBattleCharge = (player: PlayerSession) => {
  if (!player.athletics) return;
  player.athletics.battleChargeId = undefined;
  player.athletics.battleChargeStartedAt = undefined;
};
export const clearAthleticsBattleStudy = (player: PlayerSession) => {
  if (player.athletics) player.athletics.battleStudyPosition = undefined;
};
export const canUseAthleticsBattle = (session: GameSession, player: PlayerSession, nowMs: number) =>
  session.settings.gameMode === "athletics" && session.settings.athleticsBattleEnabled === true
  && session.status === "active" && !isTeacherPaused(session) && session.athletics?.status === "running"
  && nowMs >= Date.parse(session.athletics.startAt) && player.isAlive && player.connectionState !== "disconnected"
  && player.athletics?.status === "racing" && !player.athletics.recoveryActive && !player.athletics.zeusFrozen && !player.athletics.battleStudyPosition
  && ![player.athletics.battleStunnedUntil, player.athletics.staggerUntil, player.athletics.zeusRestartUntil,
    player.athletics.respawnPenaltyUntil, player.athletics.wrongAnswerPenaltyUntil, player.athletics.lapTransitionUntil]
    .some((deadline) => active(deadline, nowMs));

export const handleAthleticsBattleAction = (session: GameSession, player: PlayerSession, command: AthleticsActionCommand, nowMs: number) => {
  const athletics = player.athletics;
  if (!athletics || !session.athletics || !session.settings.athleticsBattleEnabled) return { ok: false, message: "Battle mode is switched off." };
  if (command.action === "battle_study_end") {
    clearAthleticsBattleStudy(player);
    return { ok: true, message: "Question protection ended." };
  }
  if (command.action === "battle_study_start") {
    const position = { x: player.x ?? 0, y: player.y ?? ATHLETICS_PLAYER_EYE_HEIGHT, z: player.z ?? 0 };
    const supported = athletics.role === "hunter" || getAthleticsPhysicalSupport(position, undefined, player.crouching ? 2.65 : ATHLETICS_PLAYER_EYE_HEIGHT, nowMs).kind !== "airborne";
    if (session.status !== "active" || isTeacherPaused(session) || !["running", "countdown"].includes(session.athletics.status)
      || !player.isAlive || player.connectionState === "disconnected" || athletics.status !== "racing" || athletics.recoveryActive || player.jumping || !supported) {
      return { ok: false, message: "Land on a platform before opening a question." };
    }
    clearAthleticsBattleCharge(player);
    athletics.battleStudyPosition = position;
    return { ok: true, message: "Protected while answering." };
  }
  if (command.action === "battle_cancel") {
    if (athletics.battleChargeId === command.chargeId) clearAthleticsBattleCharge(player);
    return { ok: true, message: "Charge cancelled. No energy spent." };
  }
  if (!canUseAthleticsBattle(session, player, nowMs)) {
    clearAthleticsBattleCharge(player);
    return { ok: false, message: "You cannot charge a blast right now." };
  }
  const energyCost = sanitizeAthleticsBattleEnergyCost(session.settings.athleticsBattleEnergyCost);
  if (normalizeAthleticsEnergy(player.energy) < energyCost) {
    clearAthleticsBattleCharge(player);
    return { ok: false, message: `Answer for energy. A blast costs ${energyCost} energy.` };
  }
  if (command.action === "battle_charge") {
    // Repeated starts cannot reset or bypass the three-second server clock.
    if (!athletics.battleChargeStartedAt || nowMs - Date.parse(athletics.battleChargeStartedAt) > ATHLETICS_BATTLE_CHARGE_EXPIRES_MS) {
      athletics.battleChargeId = command.chargeId;
      athletics.battleChargeStartedAt = new Date(nowMs).toISOString();
    }
    return { ok: athletics.battleChargeId === command.chargeId, message: "Charging energy blast…" };
  }
  const elapsed = nowMs - Date.parse(athletics.battleChargeStartedAt ?? "");
  if (athletics.battleChargeId !== command.chargeId || !Number.isFinite(elapsed) || elapsed < ATHLETICS_BATTLE_CHARGE_MS || elapsed > ATHLETICS_BATTLE_CHARGE_EXPIRES_MS) {
    return { ok: false, message: "Hold for three full seconds to charge a blast." };
  }
  const facing = typeof command.facing === "number" && Number.isFinite(command.facing) ? command.facing : player.facing ?? 0;
  const pitch = clampArenaAimPitch(command.pitch ?? 0);
  // Use the crosshair ray exactly once at launch. Target IDs, nearby players,
  // and later aim changes never alter a blast's direction or destination.
  const direction = { x: -Math.sin(facing) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(facing) * Math.cos(pitch) };
  player.facing = facing;
  player.energy = normalizeAthleticsEnergy(player.energy) - energyCost;
  clearAthleticsBattleCharge(player);
  session.athletics.battleBlasts ??= [];
  session.athletics.battleBlasts.push({
    id: `${player.id}:${command.chargeId}`, playerId: player.id,
    origin: { x: player.x ?? 0, y: player.y ?? ATHLETICS_PLAYER_EYE_HEIGHT, z: player.z ?? 0 },
    direction, launchedAt: nowMs, distance: 0
  });
  return { ok: true, message: `Energy blast fired. −${energyCost} energy.` };
};

export interface AthleticsBattleImpact {
  blastId: string;
  playerId: string;
  targetId?: string;
  position: AthleticsBattlePoint;
  stunnedUntil?: string;
  immune?: boolean;
}

export const advanceAthleticsBattle = (session: GameSession, nowMs: number) => {
  const impacts: AthleticsBattleImpact[] = [];
  const changedPlayers = new Set<PlayerSession>();
  const race = session.athletics;
  if (!race || isTeacherPaused(session)) return { impacts, changedPlayers };
  for (const player of session.players) {
    const state = player.athletics;
    if (state?.battleStudyPosition && (!session.settings.athleticsBattleEnabled || session.status !== "active" || !["running", "countdown"].includes(race.status) || state.status !== "racing"
      || state.recoveryActive || !isAthleticsBattleStudying(player))) {
      clearAthleticsBattleStudy(player);
      changedPlayers.add(player);
    }
    if (state?.battleChargeStartedAt && (!canUseAthleticsBattle(session, player, nowMs)
      || nowMs - Date.parse(state.battleChargeStartedAt) > ATHLETICS_BATTLE_CHARGE_EXPIRES_MS)) {
      clearAthleticsBattleCharge(player);
      changedPlayers.add(player);
    }
  }
  if (!race.battleBlasts?.length) return { impacts, changedPlayers };
  if (!session.settings.athleticsBattleEnabled || race.status !== "running" || session.status !== "active") {
    race.battleBlasts = [];
    return { impacts, changedPlayers };
  }
  const obstacles = getAthleticsObstacles(nowMs);
  race.battleBlasts = race.battleBlasts.filter((blast) => {
    const from = {
      x: blast.origin.x + blast.direction.x * blast.distance,
      y: blast.origin.y + blast.direction.y * blast.distance,
      z: blast.origin.z + blast.direction.z * blast.distance
    };
    const to = getAthleticsBattleBlastPosition(blast, nowMs);
    const targets = session.players.flatMap((target) => {
      const state = target.athletics;
      if (target.id === blast.playerId || target.connectionState === "disconnected" || !target.isAlive || state?.status !== "racing"
        || state.recoveryActive || state.zeusFrozen || active(state.zeusRestartUntil, nowMs)) return [];
      const fraction = getAthleticsBattleBodyContact(from, to, { x: target.x ?? 0, y: target.y ?? ATHLETICS_PLAYER_EYE_HEIGHT, z: target.z ?? 0 }, target.crouching);
      return fraction === undefined ? [] : [{ target, fraction }];
    }).sort((a, b) => a.fraction - b.fraction);
    const hit = targets[0];
    const contact = hit ? {
      x: from.x + (to.x - from.x) * hit.fraction,
      y: from.y + (to.y - from.y) * hit.fraction,
      z: from.z + (to.z - from.z) * hit.fraction
    } : to;
    const blocked = !hasLineOfSight({ from: { ...from, facing: 0 }, to: { ...contact, facing: 0 }, obstacles, padding: ATHLETICS_BATTLE_RADIUS });
    if (hit && !blocked) {
      const state = hit.target.athletics!;
      if (getAthleticsBattleProtection(hit.target, nowMs)) {
        // Immunity stops the stun, not the physical projectile. Do not let a
        // volley pass through this student and hit someone standing behind them.
        impacts.push({ blastId: blast.id, playerId: blast.playerId, targetId: hit.target.id, position: contact, immune: true });
        return false;
      }
      state.battleStunnedUntil = new Date(nowMs + ATHLETICS_BATTLE_STUN_MS).toISOString();
      state.battleImmuneUntil = new Date(nowMs + ATHLETICS_BATTLE_STUN_MS + ATHLETICS_BATTLE_IMMUNITY_MS).toISOString();
      clearAthleticsBattleCharge(hit.target);
      changedPlayers.add(hit.target);
      impacts.push({ blastId: blast.id, playerId: blast.playerId, targetId: hit.target.id, position: contact, stunnedUntil: state.battleStunnedUntil });
      return false;
    }
    blast.distance = Math.min(ATHLETICS_BATTLE_RANGE, Math.max(0, nowMs - blast.launchedAt) * ATHLETICS_BATTLE_SPEED / 1000);
    if (blocked || blast.distance >= ATHLETICS_BATTLE_RANGE) {
      let position = to;
      if (blocked) {
        let near = 0; let far = 1;
        for (let step = 0; step < 9; step++) {
          const fraction = (near + far) / 2;
          const sample = { x: from.x + (contact.x - from.x) * fraction, y: from.y + (contact.y - from.y) * fraction, z: from.z + (contact.z - from.z) * fraction };
          if (hasLineOfSight({ from: { ...from, facing: 0 }, to: { ...sample, facing: 0 }, obstacles, padding: ATHLETICS_BATTLE_RADIUS })) near = fraction;
          else far = fraction;
        }
        position = { x: from.x + (contact.x - from.x) * near, y: from.y + (contact.y - from.y) * near, z: from.z + (contact.z - from.z) * near };
      }
      impacts.push({ blastId: blast.id, playerId: blast.playerId, position });
      return false;
    }
    return true;
  });
  return { impacts, changedPlayers };
};
