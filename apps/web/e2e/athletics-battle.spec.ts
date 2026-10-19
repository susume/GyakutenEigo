import { expect, test } from "@playwright/test";
import { createClassroom } from "./classroomFixture";
import { io as createSocket } from "socket.io-client";
import { ATHLETICS_BATTLE_CHARGE_MS } from "@quizstrike/shared";

test("battle keyboard and mouse holds cancel early and spend once after two seconds", async ({ page, request }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    const frequencies: number[] = [];
    (window as Window & { battleAudioAudit?: number[] }).battleAudioAudit = frequencies;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = original.call(this);
      const set = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
      oscillator.frequency.setValueAtTime = (frequency, at) => { frequencies.push(frequency); return set(frequency, at); };
      return oscillator;
    };
  });
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsBattleEnabled: true, roundDurationSeconds: 120 });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Battle Explorer");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  const charge = page.getByRole("button", { name: "Hold to charge energy blast", exact: true });
  await expect(charge).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator("#battle-charge-help")).toHaveText("Hold F, left mouse or this button for 2s");
  const energy = async () => {
    const response = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    const { session } = await response.json();
    return session.players[0].energy as number;
  };
  const initial = await energy();
  await page.keyboard.down("f");
  await expect(charge).toContainText("Charging");
  await page.waitForTimeout(500);
  await page.keyboard.up("f");
  await expect(charge).toContainText("Energy blast");
  expect(await energy()).toBe(initial);
  await page.keyboard.down("f");
  await page.waitForTimeout(1500);
  await expect(charge).toContainText("/ 2.0s");
  await expect(page.getByRole("progressbar", { name: "Blast charge" })).toHaveAttribute("aria-valuenow", /[1-9]\d/);
  await page.screenshot({ path: testInfo.outputPath("battle-charging.png") });
  await expect.poll(energy, { timeout: 6000, intervals: [30, 50, 100] }).toBe(initial - 100);
  await page.screenshot({ path: testInfo.outputPath("battle-release.png") });
  await page.waitForTimeout(500);
  expect(await energy()).toBe(initial - 100);
  await page.keyboard.up("f");
  const canvas = page.locator(".arena-canvas canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45);
  await page.mouse.down();
  await expect(charge).toContainText("Charging");
  await expect.poll(energy, { timeout: 6000 }).toBe(initial - 200);
  await page.mouse.up();
  const frequencies = await page.evaluate(() => (window as Window & { battleAudioAudit?: number[] }).battleAudioAudit ?? []);
  expect(frequencies).toContain(130);
  expect(frequencies).toContain(130 * 1.505);
  expect(frequencies).toContain(840);
  const errors = await page.locator(".arena-error").count();
  expect(errors).toBe(0);
});

test("a teacher's zero-cost setting allows blasts without spending energy", async ({ page, request }) => {
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsBattleEnabled: true, athleticsBattleEnergyCost: 0 });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Free Blast Explorer");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  const charge = page.getByRole("button", { name: "Hold to charge energy blast", exact: true });
  await expect(charge).toBeEnabled({ timeout: 30_000 });
  await expect(charge).toContainText("0 energy / blast");
  await page.keyboard.down("f");
  await expect(charge).toContainText("Charging");
  await expect(charge).toContainText("Energy blast", { timeout: 6000 });
  await expect(page.getByRole("status").filter({ hasText: "Energy blast fired. −0 energy." })).toBeVisible();
  await page.keyboard.up("f");
  const response = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  expect((await response.json()).session.players[0].energy).toBe(440);
  await expect(charge).toBeEnabled();
});

test.describe("Battle touch layout", () => {
test.use({ hasTouch: true });
test("battle touch button fits phones and tablets without covering movement controls", async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsBattleEnabled: true });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Touch Battle");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  const charge = page.getByRole("button", { name: "Hold to charge energy blast", exact: true });
  await expect(charge).toBeEnabled({ timeout: 30_000 });
  const bounds = (await charge.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  const checkControls = async () => {
    const battle = (await charge.boundingBox())!;
    for (const selector of [".touch-jump", ".touch-crouch", ".touch-question", ".touch-joystick"]) {
      const control = (await page.locator(selector).boundingBox())!;
      expect(battle.x >= control.x + control.width || battle.x + battle.width <= control.x || battle.y >= control.y + control.height || battle.y + battle.height <= control.y, `${selector} stays clear of the battle button`).toBe(true);
    }
    expect(battle.y).toBeGreaterThanOrEqual(0);
    expect(battle.y + battle.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  };
  await checkControls();
  await charge.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", button: 0 });
  await expect(charge).toContainText("Charging");
  await page.locator(".touch-joystick").dispatchEvent("pointerdown", { pointerId: 2, pointerType: "touch", button: 0, clientX: 65, clientY: 680 });
  await page.locator(".touch-joystick").dispatchEvent("pointerup", { pointerId: 2, pointerType: "touch", button: 0 });
  await expect(charge).toContainText("Charging");
  await page.locator(".arena-canvas canvas").dispatchEvent("pointercancel", { pointerId: 3, pointerType: "touch", button: 0 });
  await expect(charge).toContainText("Charging");
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath("battle-narrow-reduced-motion.png") });
  await charge.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", button: 0 });
  await expect(charge).toContainText("Energy blast");
  for (const viewport of [{ width: 812, height: 375 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await checkControls();
    await page.screenshot({ path: testInfo.outputPath(`battle-touch-${viewport.width}.png`) });
  }
});
});

test("Space on the focused blast button charges without also jumping", async ({ page, request }) => {
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsBattleEnabled: true });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Keyboard Battle");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  const charge = page.getByRole("button", { name: "Hold to charge energy blast", exact: true });
  await expect(charge).toBeEnabled({ timeout: 30_000 });
  const canvas = page.locator(".arena-canvas canvas");
  const originalY = await canvas.getAttribute("data-player-y");
  await charge.focus();
  await page.keyboard.down("Space");
  await expect(charge).toContainText("Charging");
  await page.waitForTimeout(450);
  await expect(canvas).toHaveAttribute("data-player-y", originalY!);
  await page.keyboard.up("Space");
  await expect(charge).toContainText("Energy blast");
  const snapshot = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  expect((await snapshot.json()).session.players[0].energy).toBe(440);
});

test("Hunters can turn to aim while remaining at their station", async ({ page, request, browser }) => {
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsMode: "hunters-runners", athleticsBattleEnabled: true, roundDurationSeconds: 120 });
  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  try {
    for (const [student, name] of [[page, "Aim Explorer"], [partner, "Station Partner"]] as const) {
      await student.goto(`/join?code=${classroom.code}`);
      await student.getByPlaceholder("Player name").fill(name);
      await student.getByRole("button", { name: "Join game", exact: true }).click();
      await expect(student.getByTestId("student-lobby-status")).toBeVisible();
    }
    await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    const snapshot = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    const hunterName = (await snapshot.json()).session.players.find((player: { athletics?: { role: string } }) => player.athletics?.role === "hunter").nickname;
    const hunter = hunterName === "Aim Explorer" ? page : partner;
    await hunter.bringToFront();
    await expect(hunter.getByRole("button", { name: "Hold to charge energy blast", exact: true })).toBeEnabled({ timeout: 30_000 });
    const canvas = hunter.locator(".arena-canvas canvas");
    const original = { x: await canvas.getAttribute("data-player-x"), z: await canvas.getAttribute("data-player-z"), yaw: Number(await canvas.getAttribute("data-player-facing")) };
    await hunter.keyboard.down("ArrowRight");
    await expect.poll(async () => Math.abs(Number(await canvas.getAttribute("data-player-facing")) - original.yaw)).toBeGreaterThan(0.3);
    await hunter.keyboard.up("ArrowRight");
    await expect(canvas).toHaveAttribute("data-player-x", original.x!);
    await expect(canvas).toHaveAttribute("data-player-z", original.z!);
  } finally { await partnerContext.close(); }
});

test("airborne stuns freeze the pose and stop their timer after movement returns", async ({ page, request }, testInfo) => {
  await page.addInitScript(() => {
    const set = window.setInterval.bind(window);
    const clear = window.clearInterval.bind(window);
    const active = new Set<number>();
    (window as Window & { battleTimerAudit?: () => number }).battleTimerAudit = () => active.size;
    window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      const id = set(handler, delay, ...args);
      if (delay === 100) active.add(Number(id));
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = (id) => { active.delete(Number(id)); clear(id); };
  });
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsBattleEnabled: true, roundDurationSeconds: 120 });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Stun Runner");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  const joined = await request.post(`/api/sessions/${classroom.code}/join`, { data: { nickname: "Blast Partner" } });
  const partner = await joined.json();
  const socket = createSocket("http://127.0.0.1:4000", { transports: ["websocket"], autoConnect: false, reconnection: false });
  const sessionState = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Battle partner did not connect.")), 5000);
    socket.once("session_state", () => { clearTimeout(timer); resolve(); });
    socket.on("connect", () => socket.emit("join_session_room", { code: classroom.code, playerId: partner.player.id, playerToken: partner.playerToken }));
  });
  socket.connect();
  let sequence = 0;
  const action = (name: string, facing = 0, pitch = 0) => new Promise<{ ok: boolean }>((resolve, reject) => {
    socket.timeout(5000).emit("athletics_action", { action: name, chargeId: "browser-stun", requestId: `browser-stun-${++sequence}`, x: 0, z: 0, facing, pitch },
      (error: Error | null, ack: { ok: boolean }) => error ? reject(error) : resolve(ack));
  });
  const snapshot = async () => {
    const response = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    return (await response.json()).session;
  };
  try {
    await sessionState;
    await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    await expect(page.getByRole("button", { name: "Hold to charge energy blast", exact: true })).toBeEnabled({ timeout: 30_000 });
    const timersBefore = await page.evaluate(() => (window as Window & { battleTimerAudit?: () => number }).battleTimerAudit!());
    const chargeAck = await action("battle_charge");
    expect(chargeAck, JSON.stringify(chargeAck)).toMatchObject({ ok: true });
    await page.waitForTimeout(ATHLETICS_BATTLE_CHARGE_MS + 50);
    await page.keyboard.press("Space");
    const canvas = page.locator(".arena-canvas canvas");
    await expect.poll(async () => Number(await canvas.getAttribute("data-player-y"))).toBeGreaterThan(4.6);
    await expect.poll(async () => {
      const target = (await snapshot()).players.find((player: { nickname: string }) => player.nickname === "Stun Runner");
      return target.jumping && target.y > 4.6;
    }, { intervals: [30, 50, 70] }).toBe(true);
    const state = await snapshot();
    const target = state.players.find((player: { nickname: string }) => player.nickname === "Stun Runner");
    const shooter = state.players.find((player: { id: string }) => player.id === partner.player.id);
    const dx = target.x - shooter.x; const dz = target.z - shooter.z;
    const pitch = Math.atan2(target.y - 1.5 - shooter.y, Math.hypot(dx, dz));
    expect((await action("battle_fire", Math.atan2(-dx, -dz), pitch)).ok).toBe(true);
    await expect(page.locator(".battle-stun-status")).toBeVisible();
    const stopped = (await snapshot()).players.find((player: { nickname: string }) => player.nickname === "Stun Runner");
    expect(stopped.jumping).toBe(true);
    await page.waitForTimeout(450);
    expect(Number(await canvas.getAttribute("data-player-y"))).toBeCloseTo(stopped.y, 1);
    await page.screenshot({ path: testInfo.outputPath("battle-airborne-stun.png") });
    await expect(page.locator(".battle-stun-status")).toBeHidden({ timeout: 5000 });
    await expect.poll(async () => page.evaluate(() => (window as Window & { battleTimerAudit?: () => number }).battleTimerAudit!())).toBe(timersBefore);
  } finally { socket.disconnect(); }
});

test("energy questions protect idle students and a recovered student gets three seconds of protection", async ({ page, request }, testInfo) => {
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsBattleEnabled: true, athleticsBattleEnergyCost: 0, roundDurationSeconds: 120 });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Protected Runner");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  const joined = await request.post(`/api/sessions/${classroom.code}/join`, { data: { nickname: "Shield Tester" } });
  const partner = await joined.json();
  const socket = createSocket("http://127.0.0.1:4000", { transports: ["websocket"], autoConnect: false, reconnection: false });
  const connected = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Shield test partner did not connect.")), 5000);
    socket.once("session_state", () => { clearTimeout(timer); resolve(); });
    socket.on("connect", () => socket.emit("join_session_room", { code: classroom.code, playerId: partner.player.id, playerToken: partner.playerToken }));
  });
  const impacts: { targetId?: string; immune?: boolean }[] = [];
  socket.on("athletics_battle_impact", (impact) => impacts.push(impact));
  socket.connect();
  let sequence = 0;
  const action = (name: string, chargeId: string, facing = 0, pitch = 0) => new Promise<{ ok: boolean }>((resolve, reject) => {
    socket.timeout(5000).emit("athletics_action", { action: name, chargeId, requestId: `question-protection-${++sequence}`, x: 0, z: 0, facing, pitch },
      (error: Error | null, ack: { ok: boolean }) => error ? reject(error) : resolve(ack));
  });
  const snapshot = async () => {
    const state = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    return (await state.json()).session;
  };
  const fireAtReader = async (chargeId: string) => {
    expect((await action("battle_charge", chargeId)).ok).toBe(true);
    await page.waitForTimeout(ATHLETICS_BATTLE_CHARGE_MS + 50);
    const state = await snapshot();
    const target = state.players.find((player: { nickname: string }) => player.nickname === "Protected Runner");
    const shooter = state.players.find((player: { id: string }) => player.id === partner.player.id);
    const dx = target.x - shooter.x; const dz = target.z - shooter.z;
    expect((await action("battle_fire", chargeId, Math.atan2(-dx, -dz), Math.atan2(target.y - 1.5 - shooter.y, Math.hypot(dx, dz)))).ok).toBe(true);
    return target;
  };
  try {
    await connected;
    await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    await expect(page.getByRole("button", { name: "Hold to charge energy blast", exact: true })).toBeEnabled({ timeout: 30_000 });
    await page.getByRole("button", { name: "Answer movement energy question", exact: true }).click();
    await expect(page.locator(".battle-study-status")).toContainText("Protected while answering");
    await page.screenshot({ path: testInfo.outputPath("battle-question-protection.png") });
    const reader = await fireAtReader("protected-shot");
    await expect.poll(() => impacts.some((impact) => impact.targetId === reader.id && impact.immune)).toBe(true);
    await expect(page.locator(".battle-stun-status")).toHaveCount(0);
    const protectedState = (await snapshot()).players.find((player: { id: string }) => player.id === reader.id);
    expect(protectedState.athletics.battleStudyPosition).toBeTruthy();
    expect(protectedState.athletics.battleStunnedUntil).toBeUndefined();
    await page.getByRole("button", { name: "Answer A: This one", exact: true }).click();
    await expect.poll(async () => (await snapshot()).players.find((player: { id: string }) => player.id === reader.id).energy).toBe(660);
    await expect(page.locator(".battle-study-status")).toBeVisible();
    await page.getByRole("button", { name: "Back to the game", exact: true }).click();
    await expect.poll(async () => (await snapshot()).players.find((player: { id: string }) => player.id === reader.id).athletics.battleStudyPosition).toBeFalsy();
    await fireAtReader("unprotected-shot");
    await expect(page.locator(".battle-stun-status")).toBeVisible();
    const stopped = (await snapshot()).players.find((player: { id: string }) => player.id === reader.id);
    expect(Date.parse(stopped.athletics.battleImmuneUntil) - Date.parse(stopped.athletics.battleStunnedUntil)).toBe(3000);
    await expect(page.locator(".battle-protection-status")).toContainText("Protected", { timeout: 5000 });
    await expect(page.locator(".battle-protection-glow")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("battle-recovery-protection.png") });
    await expect(page.locator(".battle-protection-status")).toHaveCount(0, { timeout: 5000 });
  } finally { socket.disconnect(); }
});
