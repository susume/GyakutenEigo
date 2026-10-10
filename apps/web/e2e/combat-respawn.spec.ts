import { expect, test, type WebSocketRoute } from "@playwright/test";
import { resolvePracticeRespawn, type GameSession } from "@quizstrike/shared";
import { createClassroom } from "./classroomFixture";

const socketEventName = (message: string | Buffer) => typeof message === "string" && message.startsWith("42")
  ? (JSON.parse(message.slice(message.indexOf("["))) as [string])[0]
  : undefined;

for (const mapId of ["lunar_relay", "temple_runoff"] as const) {
  test(`${mapId} respawn snaps the FPS camera and releases held fire`, async ({ page, request }, testInfo) => {
    const classroom = await createClassroom(request, { mapId, roundDurationSeconds: 120 });
    let transport: WebSocketRoute | undefined;
    let simulateLifecycle = false;
    let shots = 0;
    // Isolate the renderer lifecycle from combat timing. The server's real
    // eliminate/quiz/respawn flow is covered by its multiplayer integration test.
    await page.routeWebSocket("**/socket.io/**", socket => {
      transport = socket;
      const server = socket.connectToServer();
      socket.onMessage(message => {
        const event = socketEventName(message);
        if (event) {
          if (event === "fire_action") shots++;
          if (simulateLifecycle && ["fire_action", "player_position"].includes(event)) return;
        }
        server.send(message);
      });
      server.onMessage(message => {
        const event = socketEventName(message);
        if (simulateLifecycle && event) {
          if (["session_state", "player_state", "player_positions"].includes(event)) return;
        }
        socket.send(message);
      });
    });
    try {
      await page.goto(`/join?code=${classroom.code}`);
      await page.getByPlaceholder("Player name").fill("Respawn Browser");
      await page.getByRole("button", { name: "Join game", exact: true }).click();
      await expect(page.getByTestId("student-lobby-status")).toBeVisible();
      const authorization = { Authorization: `Bearer ${classroom.teacherToken}` };
      const started = await request.post(`/api/sessions/${classroom.code}/start`, { headers: authorization });
      expect(started.status()).toBe(200);
      const canvas = page.locator(".arena-canvas canvas");
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".game-announcement")).toBeHidden({ timeout: 15_000 });
      await expect.poll(() => Boolean(transport)).toBe(true);
      await expect.poll(async () => {
        const response = await request.get(`/api/sessions/${classroom.code}`, { headers: authorization });
        const { session } = await response.json() as { session: GameSession };
        return session.roundTransition?.phase;
      }, { timeout: 15_000 }).not.toBe("preparation");
      const snapshot = await request.get(`/api/sessions/${classroom.code}`, { headers: authorization });
      const { session } = await snapshot.json() as { session: GameSession };
      const player = { ...session.players[0]!, weapon: "quick_blaster", gear: "quick_blaster", snowballs: 100 };
      simulateLifecycle = true;
      const sendPlayer = (next: typeof player) => transport!.send(`42${JSON.stringify(["player_state", { players: [next] }])}`);
      sendPlayer(player);
      await expect(page.locator(".arena-frame")).toHaveAttribute("data-weapon-id", "quick_blaster");
      await canvas.evaluate(element => element.setAttribute("data-respawn-test-canvas", "same-renderer"));
      await page.keyboard.down("f");
      await expect.poll(() => shots).toBeGreaterThan(0);
      const eliminated = { ...player, isAlive: false, health: 0, respawnCorrectAnswers: 2 };
      sendPlayer(eliminated);
      await expect(page.getByRole("button", { name: "Buy gear", exact: true })).toBeDisabled();
      const respawn = resolvePracticeRespawn({ player: eliminated, settings: session.settings, isCorrect: true, preferredIndex: 10 });
      sendPlayer({ ...player, ...respawn.player });
      await expect(canvas).toHaveAttribute("data-player-x", respawn.player.x!.toFixed(3));
      await expect(canvas).toHaveAttribute("data-player-y", respawn.player.y!.toFixed(3));
      await expect(canvas).toHaveAttribute("data-player-z", respawn.player.z!.toFixed(3));
      await expect(canvas).toHaveAttribute("data-respawn-test-canvas", "same-renderer");
      await page.getByRole("button", { name: "Back to the game", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Arena menu" })).toBeHidden();
      const shotsAfterRespawn = shots;
      await page.waitForTimeout(600); // More than two automatic-fire cooldowns.
      expect(shots).toBe(shotsAfterRespawn);
      await page.keyboard.up("f");
      const initialX = Number(await canvas.getAttribute("data-player-x"));
      await page.keyboard.down("w");
      await expect.poll(async () => Math.abs(Number(await canvas.getAttribute("data-player-x")) - initialX)).toBeGreaterThan(1);
      await page.keyboard.up("w");
      await page.screenshot({ path: testInfo.outputPath(`${mapId}-after-respawn.png`) });
    } finally {
      await request.post(`/api/sessions/${classroom.code}/end`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    }
  });
}
