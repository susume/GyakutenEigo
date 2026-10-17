import assert from "node:assert/strict";
import test from "node:test";
import { ATHLETICS_MODES, ATHLETICS_BATTLE_CHARGE_MS, ATHLETICS_BATTLE_ENERGY_COST, ATHLETICS_BATTLE_STUN_MS, ATHLETICS_BATTLE_IMMUNITY_MS,
  DEFAULT_SESSION_SETTINGS, getAthleticsBattleProtection, getAthleticsObstacles, getAthleticsStartPosition, sanitizeSessionSettings, validateClientCommand,
  type AthleticsActionCommand, type AthleticsMode, type GameSession, type PlayerSession } from "@quizstrike/shared";
import { advanceAthleticsBattle, canUseAthleticsBattle, handleAthleticsBattleAction } from "./athleticsBattleAuthority.js";
import { pauseSessionForTeacher, resumeSessionForTeacher } from "./teacherPause.js";

const now = Date.parse("2026-10-17T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const player = (id: string, z = 0): PlayerSession => ({
  id, gameSessionId: "battle-room", nickname: id, team: "blue", money: 0, isAlive: true, connectionState: "connected",
  energy: 440, x: 0, y: 150, z, facing: 0, score: 0, correctAnswers: 0, wrongAnswers: 0, gear: "starter_blaster", joinedAt: iso(now),
  athletics: { questionIndex: 0, checkpointIndex: 0, routeProgress: 0, gateOpen: true, falls: 0, lastSafeCheckpointIndex: 0,
    checkpointSplitsMs: [], completedLaps: 0, lapSplitsMs: [], status: "racing", role: "runner" }
});
const fixture = (mode: AthleticsMode = "classic"): GameSession => ({
  id: "battle-room", teacherId: "teacher", quizSetId: "quiz", sessionCode: "BATTLE", status: "active", controlState: "running",
  currentRound: 1, maxPlayers: 8, settings: { ...DEFAULT_SESSION_SETTINGS, gameMode: "athletics", athleticsMode: mode, athleticsBattleEnabled: true },
  players: [player("shooter"), player("target", -12)], createdAt: iso(now),
  athletics: { courseId: "stadium_loop", mode, questionsPerLap: 3, questionCount: 3, requiredLaps: 1, status: "running", startAt: iso(now), finishOrder: [] }
});
const command = (action: AthleticsActionCommand["action"], chargeId = "charge-1", extra: Partial<AthleticsActionCommand> = {}): AthleticsActionCommand => ({
  type: "athletics_action", action, chargeId, requestId: `${action}-${chargeId}`, x: 999, z: 999, y: 999, facing: 0, pitch: 0, ...extra
});
const launch = (session: GameSession, at = now) => {
  const shooter = session.players[0];
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_charge"), at).ok, true);
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_fire"), at + ATHLETICS_BATTLE_CHARGE_MS).ok, true);
};

test("battle settings default off, sanitize strictly, and support every Athletics variant", () => {
  for (const mode of ATHLETICS_MODES) {
    assert.equal(sanitizeSessionSettings({ gameMode: "athletics", athleticsMode: mode }).athleticsBattleEnabled, false);
    assert.equal(sanitizeSessionSettings({ gameMode: "athletics", athleticsMode: mode, athleticsBattleEnabled: true }).athleticsBattleEnabled, true);
    assert.equal(sanitizeSessionSettings({ gameMode: "athletics", athleticsMode: mode }).athleticsBattleEnergyCost, 100);
    assert.equal(sanitizeSessionSettings({ gameMode: "athletics", athleticsMode: mode, athleticsBattleEnergyCost: 250 }).athleticsBattleEnergyCost, 250);
    assert.equal(sanitizeSessionSettings({ gameMode: "athletics", athleticsMode: mode, athleticsBattleEnergyCost: 0 }).athleticsBattleEnergyCost, 0);
  }
  assert.equal(sanitizeSessionSettings({ gameMode: "classic", athleticsBattleEnabled: true }).athleticsBattleEnabled, undefined);
  assert.equal(sanitizeSessionSettings({ gameMode: "classic", athleticsBattleEnergyCost: 250 }).athleticsBattleEnergyCost, undefined);
  assert.equal(sanitizeSessionSettings({ gameMode: "athletics", athleticsBattleEnabled: "true" as unknown as boolean }).athleticsBattleEnabled, false);
  assert.equal(validateClientCommand("athletics_action", command("battle_charge")).success, true);
  assert.equal(validateClientCommand("athletics_action", { ...command("battle_fire"), chargeId: undefined }).success, false);
  assert.equal(validateClientCommand("athletics_action", { ...command("battle_study_start"), chargeId: undefined }).success, true);
  assert.equal(validateClientCommand("athletics_action", { ...command("battle_study_end"), chargeId: undefined }).success, true);
});

for (const mode of ATHLETICS_MODES) test(`${mode}: stationary readers are protected without energy and cannot charge until they close the question`, () => {
  const session = fixture(mode); const reader = session.players[1];
  Object.assign(reader, getAthleticsStartPosition(1, 2));
  reader.energy = 0;
  assert.equal(handleAthleticsBattleAction(session, reader, command("battle_study_start"), now).ok, true);
  assert.deepEqual(reader.athletics!.battleStudyPosition, { x: reader.x, y: reader.y, z: reader.z });
  assert.equal(getAthleticsBattleProtection(reader, now), "studying");
  assert.equal(canUseAthleticsBattle(session, reader, now), false);
  assert.equal(handleAthleticsBattleAction(session, reader, command("battle_charge"), now).ok, false);
  assert.equal(handleAthleticsBattleAction(session, reader, command("battle_study_end"), now + 100).ok, true);
  assert.equal(getAthleticsBattleProtection(reader, now + 100), undefined);
  assert.equal(canUseAthleticsBattle(session, reader, now + 100), true);
  reader.jumping = true;
  assert.equal(handleAthleticsBattleAction(session, reader, command("battle_study_start"), now + 200).ok, false);
  reader.jumping = false;
  reader.y = 150;
  assert.equal(handleAthleticsBattleAction(session, reader, command("battle_study_start"), now + 200).ok, false, "readers must be supported, not floating above the course");
});

test("reading absorbs a blast, ends on movement, and never lets a miss hit someone behind the reader", () => {
  const session = fixture(); const reader = session.players[1];
  session.players.push(player("far", -22));
  reader.athletics!.battleStudyPosition = { x: reader.x!, y: reader.y!, z: reader.z! };
  launch(session);
  const blast = { ...session.athletics!.battleBlasts![0] };
  assert.equal(advanceAthleticsBattle(session, now + 3400).impacts[0]?.immune, true);
  assert.equal(reader.athletics!.battleStunnedUntil, undefined);
  assert.equal(session.players[2].athletics!.battleStunnedUntil, undefined);
  reader.x = 0.4;
  session.athletics!.battleBlasts = [{ ...blast, id: "after-move", launchedAt: now + 3500, distance: 0 }];
  assert.equal(advanceAthleticsBattle(session, now + 3800).impacts[0]?.targetId, reader.id);
  assert.equal(reader.athletics!.battleStudyPosition, undefined);
  assert.equal(reader.athletics!.battleStunnedUntil, iso(now + 3800 + ATHLETICS_BATTLE_STUN_MS));
});

test("hit protection lasts three full seconds after movement returns and repeated hits cannot refresh it", () => {
  const session = fixture(); launch(session);
  const blast = { ...session.athletics!.battleBlasts![0] }; const target = session.players[1];
  const hitAt = now + 3300;
  advanceAthleticsBattle(session, hitAt);
  const stunEnd = hitAt + ATHLETICS_BATTLE_STUN_MS;
  const immunityEnd = stunEnd + 3000;
  assert.equal(ATHLETICS_BATTLE_IMMUNITY_MS, 3000);
  assert.equal(target.athletics!.battleImmuneUntil, iso(immunityEnd));
  assert.equal(getAthleticsBattleProtection(target, stunEnd - 1), "stunned");
  assert.equal(getAthleticsBattleProtection(target, stunEnd), "recovery");
  for (const at of [stunEnd + 2000, immunityEnd - 1, immunityEnd]) {
    session.athletics!.battleBlasts = [{ ...blast, id: `at-${at}`, launchedAt: at - 300, distance: 0 }];
    const impact = advanceAthleticsBattle(session, at).impacts[0];
    if (at < immunityEnd) {
      assert.equal(impact?.immune, true);
      assert.equal(target.athletics!.battleImmuneUntil, iso(immunityEnd), "blocked hits do not restart the protection timer");
      assert.equal(target.athletics!.battleStunnedUntil, iso(stunEnd));
    } else {
      assert.equal(impact?.immune, undefined);
      assert.equal(target.athletics!.battleStunnedUntil, iso(at + ATHLETICS_BATTLE_STUN_MS));
    }
  }
});

test("every Athletics mode charges the teacher's configured cost, including free blasts and the energy cap", () => {
  for (const mode of ATHLETICS_MODES) for (const cost of [0, 25, 250, 1000]) {
    const session = fixture(mode); const shooter = session.players[0];
    session.settings.athleticsBattleEnergyCost = cost;
    shooter.energy = cost;
    launch(session);
    assert.equal(shooter.energy, 0, `${mode}: a ${cost}-energy blast spends exactly the configured amount`);
    assert.equal(session.athletics!.battleBlasts!.length, 1);
    assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_fire"), now + 3100).ok, false, "replaying a free blast still requires another charge");
  }
  const legacy = fixture(); delete legacy.settings.athleticsBattleEnergyCost;
  launch(legacy);
  assert.equal(legacy.players[0].energy, 340, "existing rooms without the new setting retain their original cost");
});

test("insufficient energy cannot start or finish a charge at the configured cost", () => {
  const session = fixture(); const shooter = session.players[0];
  session.settings.athleticsBattleEnergyCost = 250;
  shooter.energy = 249;
  assert.deepEqual(handleAthleticsBattleAction(session, shooter, command("battle_charge"), now), {
    ok: false, message: "Answer for energy. A blast costs 250 energy."
  });
  shooter.energy = 300;
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_charge"), now).ok, true);
  shooter.energy = 249;
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_fire"), now + 3000).ok, false);
  assert.equal(shooter.energy, 249);
  assert.equal(shooter.athletics!.battleChargeId, undefined);
  assert.equal(session.athletics!.battleBlasts?.length ?? 0, 0);
});

for (const mode of ATHLETICS_MODES) test(`${mode}: full charge spends exactly 100 energy, hits classmates of either role, and cannot stun-lock`, () => {
  const session = fixture(mode);
  session.players[1].athletics!.role = "hunter";
  launch(session);
  assert.equal(session.players[0].energy, 440 - ATHLETICS_BATTLE_ENERGY_COST);
  const blast = session.athletics!.battleBlasts![0];
  assert.equal(blast.origin.x, 0, "forged action coordinates cannot move the shot origin");
  assert.equal(blast.origin.y, 150, "the shot travels through the crosshair instead of parallel below it");
  const hitAt = now + 3300;
  const { impacts, changedPlayers } = advanceAthleticsBattle(session, hitAt);
  assert.equal(impacts[0]?.targetId, "target");
  assert.equal(session.athletics!.battleBlasts!.length, 0);
  const target = session.players[1];
  assert.equal(target.athletics!.battleStunnedUntil, iso(hitAt + ATHLETICS_BATTLE_STUN_MS));
  assert.equal(target.x, 0); assert.equal(target.z, -12, "a stun does not knock a student off the course");
  assert.ok(changedPlayers.has(target));
  assert.equal(canUseAthleticsBattle(session, target, hitAt + 2499), false);
  assert.equal(canUseAthleticsBattle(session, target, hitAt + 2500), true);
  const originalUntil = target.athletics!.battleStunnedUntil;
  session.athletics!.battleBlasts = [{ ...blast, id: "second", distance: 0, launchedAt: hitAt }];
  advanceAthleticsBattle(session, hitAt + 300);
  assert.equal(target.athletics!.battleStunnedUntil, originalUntil);
});

test("early fire, fabricated charge IDs, repeated starts, and replayed fire cannot spend energy", () => {
  const session = fixture(); const shooter = session.players[0];
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_fire"), now).ok, false);
  handleAthleticsBattleAction(session, shooter, command("battle_charge"), now);
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_fire"), now + 2999).ok, false);
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_fire", "forged"), now + 3000).ok, false);
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_charge", "other"), now + 1500).ok, false);
  assert.equal(shooter.athletics!.battleChargeStartedAt, iso(now));
  assert.equal(shooter.energy, 440);
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_fire"), now + 3000).ok, true);
  assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_fire"), now + 3001).ok, false);
  assert.equal(shooter.energy, 340);
});

test("release, lost energy, disconnection, recovery, and expiry cancel charges without payment", () => {
  for (const reason of ["cancel", "energy", "disconnect", "recovery", "expiry"] as const) {
    const session = fixture(); const shooter = session.players[0];
    handleAthleticsBattleAction(session, shooter, command("battle_charge"), now);
    if (reason === "cancel") handleAthleticsBattleAction(session, shooter, command("battle_cancel"), now + 1000);
    if (reason === "energy") shooter.energy = 99;
    if (reason === "disconnect") shooter.connectionState = "disconnected";
    if (reason === "recovery") shooter.athletics!.recoveryActive = true;
    advanceAthleticsBattle(session, now + (reason === "expiry" ? 6001 : 3000));
    assert.equal(handleAthleticsBattleAction(session, shooter, command("battle_fire"), now + 3100).ok, false, reason);
    assert.equal(shooter.energy, reason === "energy" ? 99 : 440, reason);
  }
});

test("disabled, countdown, paused, finished and frozen players cannot charge", () => {
  const cases = [
    (s: GameSession) => { s.settings.athleticsBattleEnabled = false; },
    (s: GameSession) => { s.athletics!.status = "countdown"; },
    (s: GameSession) => { s.controlState = "teacher_paused"; },
    (s: GameSession) => { s.status = "ended"; },
    (s: GameSession) => { s.players[0].athletics!.status = "finished"; },
    (s: GameSession) => { s.players[0].athletics!.zeusFrozen = true; }
  ];
  for (const mutate of cases) {
    const session = fixture(); mutate(session);
    assert.equal(handleAthleticsBattleAction(session, session.players[0], command("battle_charge"), now).ok, false);
  }
});

test("swept collision chooses the first body, misses dodges and respects height and course obstacles", () => {
  const session = fixture(); session.players.push(player("far", -22));
  launch(session);
  assert.equal(advanceAthleticsBattle(session, now + 3600).impacts[0]?.targetId, "target");
  const dodge = fixture(); launch(dodge); dodge.players[1].x = 8;
  assert.equal(advanceAthleticsBattle(dodge, now + 3500).impacts.length, 0);
  assert.equal(advanceAthleticsBattle(dodge, now + 5000).impacts[0]?.targetId, undefined);
  assert.equal(dodge.athletics!.battleBlasts!.length, 0);
  const level = fixture(); launch(level); level.players[1].y = 140;
  assert.equal(advanceAthleticsBattle(level, now + 3400).impacts.length, 0);
  const blocked = fixture();
  const obstacle = getAthleticsObstacles(now).find((item) => item.kind === "rect" && item.minY !== undefined && item.maxY !== undefined)!;
  assert.ok(obstacle && obstacle.kind === "rect");
  const centerY = (obstacle.minY! + obstacle.maxY!) / 2;
  blocked.players[0].x = obstacle.x; blocked.players[0].y = centerY; blocked.players[0].z = obstacle.z + obstacle.depth / 2 + 3;
  blocked.players[1].x = obstacle.x; blocked.players[1].y = centerY; blocked.players[1].z = obstacle.z - obstacle.depth / 2 - 3;
  launch(blocked);
  const result = advanceAthleticsBattle(blocked, now + 4700);
  assert.equal(result.impacts[0]?.targetId, undefined, "course geometry blocks the blast");
  assert.equal(blocked.players[1].athletics!.battleStunnedUntil, undefined);
});

for (const mode of ATHLETICS_MODES) test(`${mode}: off-axis students are not acquired, even with an explicit target ID`, () => {
  const session = fixture(mode);
  const shooter = session.players[0]; const target = session.players[1];
  target.x = 0.8;
  handleAthleticsBattleAction(session, shooter, command("battle_charge"), now);
  handleAthleticsBattleAction(session, shooter, command("battle_fire", "charge-1", { targetId: target.id }), now + 3000);
  assert.deepEqual(session.athletics!.battleBlasts![0].direction, { x: -0, y: 0, z: -1 });
  const result = advanceAthleticsBattle(session, now + 3400);
  assert.equal(result.impacts.length, 0, "a near miss does not snap to the student standing in front");
  assert.equal(target.athletics!.battleStunnedUntil, undefined);
  assert.equal(session.athletics!.battleBlasts!.length, 1, "a missed shot keeps flying along its original ray");
});

test("a student can sidestep a launched blast and turning the shooter cannot steer it", () => {
  const session = fixture(); const shooter = session.players[0]; const target = session.players[1];
  launch(session);
  const blast = session.athletics!.battleBlasts![0];
  const direction = { ...blast.direction };
  assert.equal(advanceAthleticsBattle(session, now + 3100).impacts.length, 0, "hits wait for projectile travel");
  target.x = 0.8;
  shooter.facing = Math.PI / 2; shooter.x = 20;
  assert.equal(advanceAthleticsBattle(session, now + 3400).impacts.length, 0);
  assert.deepEqual(blast.origin, { x: 0, y: 150, z: 0 });
  assert.deepEqual(blast.direction, direction);
  target.x = 0;
  assert.equal(advanceAthleticsBattle(session, now + 3500).impacts.length, 0, "returning after the shot passes does not trigger a delayed hit");
  assert.equal(advanceAthleticsBattle(session, now + 5000).impacts[0]?.targetId, undefined);
  assert.equal(target.athletics!.battleStunnedUntil, undefined);
});

test("manual aim can lead a moving student and pitched shots keep their launch angle", () => {
  const session = fixture(); const shooter = session.players[0]; const target = session.players[1];
  target.x = 3; target.z = -24;
  handleAthleticsBattleAction(session, shooter, command("battle_charge"), now);
  const pitch = 0.15;
  handleAthleticsBattleAction(session, shooter, command("battle_fire", "charge-1", { pitch }), now + 3000);
  const blast = session.athletics!.battleBlasts![0];
  assert.equal(blast.direction.y, Math.sin(pitch));
  assert.equal(blast.direction.z, -Math.cos(pitch));
  assert.equal(advanceAthleticsBattle(session, now + 3200).impacts.length, 0);
  target.x = 0;
  target.y = shooter.y! + 24 * Math.tan(pitch) + 1;
  assert.equal(advanceAthleticsBattle(session, now + 3600).impacts[0]?.targetId, target.id, "only entering the manually aimed flight path produces a hit");
});

test("teacher pause cancels unfinished charges and preserves remaining stun and projectile travel", () => {
  const session = fixture(); launch(session);
  const target = session.players[1]; target.athletics!.battleStunnedUntil = iso(now + 5500);
  handleAthleticsBattleAction(session, session.players[0], command("battle_charge", "second"), now + 3100);
  pauseSessionForTeacher(session, now + 3200);
  assert.equal(session.players[0].athletics!.battleChargeStartedAt, undefined);
  assert.equal(advanceAthleticsBattle(session, now + 13200).impacts.length, 0);
  resumeSessionForTeacher(session, now + 13200);
  assert.equal(session.athletics!.battleBlasts![0].launchedAt, now + 13000);
  assert.equal(target.athletics!.battleStunnedUntil, iso(now + 15500));
});

test("stun immunity prevents another stun while the first student's body still stops the blast", () => {
  const session = fixture(); session.players.push(player("far", -22));
  const target = session.players[1];
  target.athletics!.battleImmuneUntil = iso(now + 6000);
  launch(session);
  const { impacts } = advanceAthleticsBattle(session, now + 3600);
  assert.equal(impacts[0]?.targetId, target.id);
  assert.equal(impacts[0]?.immune, true);
  assert.equal(target.athletics!.battleStunnedUntil, undefined);
  assert.equal(session.players[2].athletics!.battleStunnedUntil, undefined);
  assert.equal(session.athletics!.battleBlasts!.length, 0);
});
