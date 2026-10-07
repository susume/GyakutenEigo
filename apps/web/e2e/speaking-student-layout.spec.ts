import { expect, test, type Page, type Route } from "@playwright/test";
import { SPEAKING_CORE_LIBRARY } from "@quizstrike/shared";
import { writeFile } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:4173";
type SessionStatus = "ready" | "active";
type SpeakingMode = "practice" | "assessment";
type SupportSettings = {
  showTargetExpressions: boolean;
  showContext: boolean;
  showTranscript: boolean;
  allowReplay: boolean;
  allowHelp: boolean;
};

const activityBase = {
  id: "student-layout-activity",
  title: "Helping a Tourist",
  scenario: "A visitor asks for a recommendation.",
  aiRole: "Tourist",
  studentRole: "Local guide",
  level: "beginner",
  difficulty: "easy",
  nativeLanguage: "en",
  durationSeconds: 240,
  identifierMode: "nickname",
  targetExpressions: ["I recommend…", "You should visit…", "It is near…"],
  rubric: [],
  scenarioResources: {
    openingLine: "Hello. Could you recommend somewhere interesting nearby?",
    studentGoal: "Recommend a nearby place clearly.",
    suggestedSteps: [],
    usefulVocabulary: [],
    referenceItems: [],
    imageSrc: "/assets/speaking/scenario-directions.webp",
    imageAlt: "A tourist asking for directions"
  },
  context: {
    title: "City map",
    description: "Use this map to help your answer.",
    imageUrl: "/assets/speaking/context-tourist-map.webp",
    alt: "Illustrated city map",
    type: "map"
  }
};

function makeSessionData(id: string, status: SessionStatus, mode: SpeakingMode, supportSettings: SupportSettings) {
  const now = new Date().toISOString();
  const startedAt = status === "active" ? now : undefined;
  const session = {
    id,
    activityId: activityBase.id,
    joinCode: "LAYOUT1",
    status,
    createdAt: now,
    ...(startedAt ? { startedAt } : {}),
    expiresAt: new Date(Date.now() + 225_000).toISOString(),
    revision: 1
  };
  const participant = {
    id: `${id}-participant`,
    activityId: activityBase.id,
    sessionId: id,
    status: status === "active" ? "in_progress" : "joined",
    pausedDurationMs: 0,
    helpCount: 0,
    ...(startedAt ? { startedAt } : {})
  };
  return {
    activity: { ...activityBase, mode, supportSettings },
    participant,
    session,
    turns: [{
      id: `${id}-turn`,
      participantId: participant.id,
      speaker: "ai",
      text: activityBase.scenarioResources.openingLine,
      createdAt: now
    }]
  };
}

async function mockStudentSession(page: Page, id: string, data: Omit<ReturnType<typeof makeSessionData>, "activity"> & { activity: object }, holdSpeech = false, nativeSpeech = false) {
  await page.addInitScript((sessionId: string) => {
    sessionStorage.setItem(`speaking-token:${sessionId}`, "student-layout-test-token");
  }, id);
  if (!nativeSpeech) await page.addInitScript((hold: boolean) => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel: () => undefined,
      getVoices: () => [],
      speak: (utterance: { onend?: () => void }) => hold
        ? window.addEventListener("speaking-test-tts-end", () => utterance.onend?.(), { once: true })
        : setTimeout(() => utterance.onend?.(), 0)
    } });
  }, holdSpeech);
  await page.route("**/api/speaking/sessions/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.endsWith(`/sessions/${id}`) && !path.endsWith(`/sessions/${id}/status`)) {
      await route.continue();
      return;
    }
    if (path.endsWith("/status")) {
      await route.fulfill({ json: { participant: data.participant, session: data.session, revision: 1 } });
      return;
    }
    await route.fulfill({ json: data });
  });
}

test("workplace reference sheets and keywords are usable without a context image", async ({ page }, testInfo) => {
  const id = "workplace-reference-support";
  const task = SPEAKING_CORE_LIBRARY.find((item) => item.id === "workplace-luxury-car-explain-vehicle")!;
  const data = makeSessionData(id, "active", "assessment", {
    showTargetExpressions: true, showContext: true, showTranscript: false, allowReplay: false, allowHelp: false
  });
  await mockStudentSession(page, id, { ...data, activity: { ...task, supportSettings: data.activity.supportSettings }, turns: [{ ...data.turns[0]!, text: task.scenarioResources.openingLine! }] });

  for (const width of [1366, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${baseUrl}/speak/session/${id}`);
    await expect(page.locator(".speaking-student-screen-ready")).toBeVisible();
    await page.getByRole("button", { name: "Open Context support" }).click();
    const contextPanel = page.getByRole("tabpanel", { name: "Context", exact: true });
    await expect(contextPanel.getByRole("heading", { name: "Task information" })).toBeVisible();
    await expect(contextPanel).toContainText("18,500 km");
    await expect(contextPanel).toContainText("¥7,480,000");
    await expect(contextPanel).toContainText("Brake-pad replacement date");
    await expect(contextPanel).not.toContainText("No context image");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await contextPanel.evaluate((panel) => { panel.scrollTop = panel.scrollHeight; });
    await expect(contextPanel.getByText(/Brake-pad replacement date/)).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`workplace-reference-${width}.png`) });
    await page.getByRole("tab", { name: "Useful English", exact: true }).click();
    const languagePanel = page.getByRole("tabpanel", { name: "Useful English", exact: true });
    await expect(languagePanel).toContainText("Useful keywords");
    await expect(languagePanel).toContainText("brake pads");
    await expect(languagePanel).toContainText("You do not need to use every expression or keyword");
    await page.getByRole("button", { name: "Close support panel" }).click();
    await expect(page.getByRole("button", { name: "Tap to speak" })).toBeVisible();
  }
});

for (const failure of ["missing-model", "invalid-model", "unavailable-webgl"] as const) {
  test(`local avatar ${failure} fallback preserves speech, replay and student controls`, async ({ page }, testInfo) => {
    const id = `avatar-${failure}`;
    const data = makeSessionData(id, "active", "practice", {
      showTargetExpressions: true, showContext: true, showTranscript: true, allowReplay: true, allowHelp: true
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await mockStudentSession(page, id, data, true);
    await page.route("**/assets/speaking/avatar/default.vrm", (route) => failure === "invalid-model"
      ? route.fulfill({ contentType: "model/gltf+json", body: JSON.stringify({ asset: { version: "2.0" }, scenes: [{ nodes: [] }], scene: 0, nodes: [] }) })
      : route.fulfill({ status: 404, body: "No local model" }));
    if (failure === "unavailable-webgl") {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
          if (contextId.startsWith("webgl")) return null;
          return Reflect.apply(original, this, [contextId, ...args]);
        } as typeof original;
      });
    }
    let releaseTurn: (() => void) | undefined;
    if (failure === "missing-model") {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
          getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] })
        } });
        class FakeMediaRecorder {
          static isTypeSupported = () => true;
          state = "inactive";
          mimeType = "audio/webm";
          ondataavailable?: (event: { data: Blob }) => void;
          onstop?: () => void;
          start() { this.state = "recording"; }
          stop() {
            this.state = "inactive";
            this.ondataavailable?.({ data: new Blob(["mock student recording"], { type: this.mimeType }) });
            this.onstop?.();
          }
        }
        Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
      });
      const turnGate = new Promise<void>((resolve) => { releaseTurn = resolve; });
      await page.route(`**/api/speaking/sessions/${id}/turn`, async (route) => {
        await turnGate;
        const studentTurn = { ...data.turns[0]!, id: "avatar-student-turn", speaker: "student", text: "You should visit the park." };
        const aiTurn = { ...data.turns[0]!, id: "avatar-ai-reply", text: "Thank you. How can I get there?" };
        await route.fulfill({ json: { studentTurn, aiTurn, session: data.session } });
      });
    }
    await page.route(`**/api/speaking/sessions/${id}/help`, (route) => route.fulfill({ json: { hint: "Recommend a nearby place.", english: "You should visit the park.", helpCount: 1 } }));
    await page.goto(`${baseUrl}/speak/session/${id}`);
    const avatar = page.locator(".speaking-avatar");
    await expect(avatar).toHaveCount(1);
    await expect(avatar).toHaveAttribute("aria-hidden", "true");
    await expect(avatar).toHaveAttribute("data-avatar-status", "fallback");
    await expect(avatar.locator("img")).toBeVisible();
    await expect(avatar.locator("canvas")).toHaveCount(0);
    await expect(page.locator(".speaking-transcript-card canvas")).toHaveCount(0);
    await expect(page.locator(".speaking-turn-avatar-ai img")).toHaveAttribute("src", "/assets/speaking/ai-shop-assistant.png");

    // Greeting -> end, Replay -> stop, Replay -> end all use existing voice state.
    await expect(avatar).toHaveAttribute("data-avatar-state", "speaking");
    await page.evaluate(() => window.dispatchEvent(new Event("speaking-test-tts-end")));
    await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
    await expect(page.getByRole("button", { name: "Tap to speak", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Replay latest partner message" }).click();
    await expect(avatar).toHaveAttribute("data-avatar-state", "speaking");
    await page.getByRole("button", { name: "Stop playback", exact: true }).click();
    await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
    await page.getByRole("button", { name: "Replay current partner message" }).click();
    await expect(avatar).toHaveAttribute("data-avatar-state", "speaking");
    await page.evaluate(() => window.dispatchEvent(new Event("speaking-test-tts-end")));
    await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
    await expect(page.getByRole("button", { name: "Finish practice", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Ask for a hint" }).click();
    await expect(page.locator(".speaking-help-response")).toContainText("You should visit the park.");
    await page.getByRole("button", { name: "Open Context support" }).click();
    await expect(page.getByRole("tabpanel", { name: "Context", exact: true }).getByRole("img", { name: "Illustrated city map" })).toBeVisible();
    await page.getByRole("button", { name: "Close support panel" }).click();
    if (failure === "missing-model") {
      await page.getByRole("button", { name: "Tap to speak", exact: true }).click();
      await expect(avatar).toHaveAttribute("data-avatar-state", "listening");
      await page.getByRole("button", { name: "Stop speaking", exact: true }).click();
      await expect(avatar).toHaveAttribute("data-avatar-state", "thinking");
      releaseTurn!();
      await expect(avatar).toHaveAttribute("data-avatar-state", "speaking");
      await expect(page.locator(".speaking-transcript-card")).toContainText("Thank you. How can I get there?");
      await page.evaluate(() => window.dispatchEvent(new Event("speaking-test-tts-end")));
      await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
      await expect(avatar).toHaveAttribute("data-avatar-status", "fallback");
      await expect(page.getByRole("button", { name: "Finish practice", exact: true })).toBeEnabled();
    }
    await expect(page.getByRole("button", { name: "Tap to speak", exact: true })).toBeInViewport();
    const desktopSize = await avatar.boundingBox();
    expect(desktopSize!.height).toBeGreaterThan(120);
    const fallbackSize = await avatar.locator("img").boundingBox();
    expect(fallbackSize!.height).toBeLessThanOrEqual(desktopSize!.height + 1);
    if (failure === "missing-model") {
      // A hint adds another row. Short classroom displays must allow scrolling
      // rather than clipping the hint or conversation beneath the portrait.
      await page.getByRole("button", { name: "Ask for a hint" }).click();
      await expect(page.locator(".speaking-help-response")).toContainText("You should visit the park.");
      for (const height of [600, 700, 720, 768]) {
        await page.setViewportSize({ width: 1366, height });
        const center = page.locator(".speaking-student-center");
        const layout = await center.evaluate((element) => ({
          contentHeight: element.scrollHeight, height: element.clientHeight,
          overflow: getComputedStyle(element).overflowY
        }));
        expect(layout.contentHeight <= layout.height + 1 || ["auto", "scroll"].includes(layout.overflow),
          `Conversation content is clipped at 1366×${height}`).toBe(true);
        await page.locator(".speaking-transcript-card").scrollIntoViewIfNeeded();
        await expect(page.getByRole("heading", { name: "Conversation", exact: true })).toBeInViewport();
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.getByRole("button", { name: "Tap to speak", exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`${failure}-mobile.png`) });
    if (failure === "missing-model") {
      let feedbackReady = false;
      const result = { ...data, session: { ...data.session, status: "ended" }, participant: { ...data.participant, status: "evaluating" } };
      await page.route(`**/api/speaking/sessions/${id}/finish`, (route) => route.fulfill({
        status: 202, json: { result, evaluationStatus: "running" }
      }));
      await page.route(`**/api/speaking/results/${data.participant.id}`, (route) => route.fulfill({ json: {
        result: { ...result, participant: { ...result.participant, status: feedbackReady ? "completed" : "evaluating" },
          evaluation: feedbackReady ? {
            participantId: data.participant.id, language: "en", assessmentStatus: "scored", scores: { communication: 3 },
            evidence: { communication: "You recommended a place." }, strengths: ["You recommended a place."],
            improvements: [], usefulEnglish: [], overallMessage: "You recommended a place.", createdAt: new Date().toISOString()
          } : undefined },
        evaluationStatus: feedbackReady ? "completed" : "running"
      } }));
      await page.getByRole("button", { name: "Finish practice", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/speak/result/${data.participant.id}$`));
      await expect(page.locator(".speaking-evaluation-status-card")).toBeVisible();
      await expect(page.locator(".speaking-avatar")).toHaveCount(0);
      feedbackReady = true;
      await page.getByRole("button", { name: "Refresh status", exact: true }).click();
      await expect(page.locator(".speaking-result-panel")).toContainText("You recommended a place.");
    }
    expect(pageErrors).toEqual([]);
  });
}

async function readLayout(page: Page) {
  return page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      header: read(".speaking-student-header"),
      controls: read(".speaking-student-controls"),
      mic: read(".speaking-student-mic"),
      waiting: read(".speaking-session-waiting-note"),
      transcriptCount: document.querySelectorAll(".speaking-transcript-card").length,
      sidebarCount: document.querySelectorAll(".speaking-student-sidebar").length,
      replayCount: document.querySelectorAll(".speaking-replay-button").length,
      markCount: document.querySelectorAll(".speaking-student-brand .speaking-brand-mark").length,
      logoImageCount: document.querySelectorAll(".speaking-student-brand .speaking-brand-logo").length,
      micDisabled: document.querySelector(".speaking-student-mic")?.hasAttribute("disabled") ?? false,
      finishDisabled: document.querySelector(".speaking-student-timer button")?.hasAttribute("disabled") ?? false
    };
  });
}

type AvatarProbe = {
  contexts: number;
  frames: number;
  mouth: number[];
  vowelPeaks: number[];
  blinkPeak: number;
};

function observeAvatarWebGL() {
  // Observe real GPU uniforms without exposing renderer internals in production.
  // The pinned model's facial morphs are blink=12 and vowels=36..40.
  const probe: AvatarProbe = { contexts: 0, frames: 0, mouth: [], vowelPeaks: [0, 0, 0, 0, 0], blinkPeak: 0 };
  (window as unknown as { avatarProbe: AvatarProbe }).avatarProbe = probe;
  const contexts = new WeakSet<object>();
  const originalContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
    const context = Reflect.apply(originalContext, this, [contextId, ...args]);
    if (contextId.startsWith("webgl") && context && !contexts.has(context)) {
      contexts.add(context);
      probe.contexts += 1;
    }
    return context;
  } as typeof originalContext;
  const locations = new WeakMap<WebGLUniformLocation, string>();
  const gl = WebGL2RenderingContext.prototype;
  const originalLocation = gl.getUniformLocation;
  gl.getUniformLocation = function (program, name) {
    const location = originalLocation.call(this, program, name);
    if (location) locations.set(location, name);
    return location;
  };
  const originalUniform = gl.uniform1fv;
  gl.uniform1fv = function (location, values, ...rest) {
    if (location && locations.get(location)?.startsWith("morphTargetInfluences")) {
      const weights = Array.from(values);
      if (weights.length >= 41) {
        probe.mouth = weights.slice(36, 41);
        probe.blinkPeak = Math.max(probe.blinkPeak, weights[12]!);
        probe.mouth.forEach((value, index) => { probe.vowelPeaks[index] = Math.max(probe.vowelPeaks[index]!, value); });
      }
    }
    return Reflect.apply(originalUniform, this, [location, values, ...rest]);
  };
  const originalClear = gl.clear;
  gl.clear = function (mask) {
    if ((this.canvas as HTMLCanvasElement).closest(".speaking-avatar")) probe.frames += 1;
    return originalClear.call(this, mask);
  };
}

test("bundled VRM renders real facial animation through the student speech lifecycle", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1366, height: 768 });
  const id = "bundled-vrm-lifecycle";
  const data = makeSessionData(id, "active", "practice", {
    showTargetExpressions: true, showContext: true, showTranscript: true, allowReplay: true, allowHelp: true
  });
  const errors: string[] = [];
  const failedResources: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", (request) => failedResources.push(request.url()));
  page.on("response", (response) => { if (response.status() >= 400) failedResources.push(response.url()); });
  await mockStudentSession(page, id, data, true);
  await page.addInitScript(observeAvatarWebGL);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] })
    } });
    class FakeMediaRecorder {
      static isTypeSupported = () => true;
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["student recording"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
  });
  let releaseTurn!: () => void;
  const turnGate = new Promise<void>((resolve) => { releaseTurn = resolve; });
  await page.route(`**/api/speaking/sessions/${id}/turn`, async (route) => {
    await turnGate;
    await route.fulfill({ json: {
      studentTurn: { ...data.turns[0]!, id: "real-vrm-student", speaker: "student", text: "You should visit the park." },
      aiTurn: { ...data.turns[0]!, id: "real-vrm-reply", text: "Thank you. How can I get there?" }, session: data.session
    } });
  });
  const readProbe = () => page.evaluate(() => (window as unknown as { avatarProbe: AvatarProbe }).avatarProbe);
  const expectClosedMouth = () => expect.poll(async () => Math.max(...(await readProbe()).mouth), { timeout: 1_500 }).toBeLessThan(0.01);
  await page.goto(`${baseUrl}/speak/session/${id}`);
  const avatar = page.locator(".speaking-avatar");
  await expect(avatar).toHaveAttribute("data-avatar-status", "ready", { timeout: 20_000 });
  await expect(avatar.locator("img")).toHaveCount(0);
  await expect(avatar.locator("canvas")).toHaveCount(1);
  const canvas = await avatar.locator("canvas").elementHandle();
  await expect(avatar).toHaveAttribute("data-avatar-state", "speaking");
  await expect.poll(async () => (await readProbe()).vowelPeaks.every((peak) => peak > 0.15), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await readProbe()).blinkPeak, { timeout: 10_000 }).toBeGreaterThan(0.7);
  await page.screenshot({ path: testInfo.outputPath("real-vrm-speaking-desktop.png") });
  await page.evaluate(() => window.dispatchEvent(new Event("speaking-test-tts-end")));
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
  await expectClosedMouth();
  await page.screenshot({ path: testInfo.outputPath("real-vrm-idle-desktop.png") });

  const before = await page.evaluate(() => ({ frames: (window as unknown as { avatarProbe: AvatarProbe }).avatarProbe.frames, time: performance.now() }));
  await page.waitForTimeout(2_000);
  const after = await page.evaluate(() => ({ frames: (window as unknown as { avatarProbe: AvatarProbe }).avatarProbe.frames, time: performance.now() }));
  const fps = (after.frames - before.frames) * 1000 / (after.time - before.time);
  expect(fps).toBeGreaterThan(5);
  expect(fps).toBeLessThanOrEqual(32);
  const performancePath = testInfo.outputPath("real-vrm-performance.json");
  await writeFile(performancePath, JSON.stringify({ fps, ...await readProbe() }, null, 2));
  await testInfo.attach("real-vrm-performance", { path: performancePath, contentType: "application/json" });

  await page.getByRole("button", { name: "Replay latest partner message" }).click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "speaking");
  await expect.poll(async () => Math.max(...(await readProbe()).mouth)).toBeGreaterThan(0.15);
  await page.getByRole("button", { name: "Stop playback", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
  await expectClosedMouth();
  await page.getByRole("button", { name: "Tap to speak", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "listening");
  await expectClosedMouth();
  await page.screenshot({ path: testInfo.outputPath("real-vrm-listening.png") });
  await page.getByRole("button", { name: "Stop speaking", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "thinking");
  await expectClosedMouth();
  await page.screenshot({ path: testInfo.outputPath("real-vrm-thinking.png") });
  releaseTurn();
  await expect(avatar).toHaveAttribute("data-avatar-state", "speaking");
  await expect.poll(async () => Math.max(...(await readProbe()).mouth)).toBeGreaterThan(0.15);
  await page.evaluate(() => window.dispatchEvent(new Event("speaking-test-tts-end")));
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
  await expectClosedMouth();

  for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(avatar).toHaveAttribute("data-avatar-status", "ready");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await expect(page.getByRole("button", { name: "Tap to speak", exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`real-vrm-idle-${viewport.width}.png`) });
    await page.locator(".speaking-transcript-card").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "Conversation", exact: true })).toBeInViewport();
  }
  expect(await avatar.locator("canvas").evaluate((element, original) => element === original, canvas)).toBe(true);
  // Playwright forces pages to remain focused/visible, even in headed runs.
  // Exercise the visibility event explicitly against the real loaded renderer.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenFrames = (await readProbe()).frames;
  await page.waitForTimeout(500);
  expect((await readProbe()).frames).toBe(hiddenFrames);
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await readProbe()).frames).toBeGreaterThan(hiddenFrames);
  expect((await readProbe()).contexts).toBe(1);
  expect(errors).toEqual([]);
  expect(failedResources).toEqual([]);
});

test("bundled VRM follows native browser SpeechSynthesis replay, end and cancellation", async ({ page }, testInfo) => {
  const id = "bundled-vrm-native-tts";
  const data = makeSessionData(id, "active", "practice", {
    showTargetExpressions: true, showContext: true, showTranscript: true, allowReplay: true, allowHelp: true
  });
  await mockStudentSession(page, id, data, false, true);
  await page.addInitScript(observeAvatarWebGL);
  await page.addInitScript(() => {
    const events = { started: 0, ended: 0 };
    (window as unknown as { nativeSpeechEvents: typeof events }).nativeSpeechEvents = events;
    const nativeSpeak = speechSynthesis.speak;
    speechSynthesis.speak = function (utterance) {
      utterance.addEventListener("start", () => { events.started += 1; });
      utterance.addEventListener("end", () => { events.ended += 1; });
      return nativeSpeak.call(this, utterance);
    };
  });
  await page.goto(`${baseUrl}/speak/session/${id}`);
  const avatar = page.locator(".speaking-avatar");
  await expect(avatar).toHaveAttribute("data-avatar-status", "ready", { timeout: 20_000 });
  const hasLocalEnglishVoice = await page.evaluate(() => new Promise<boolean>((resolve) => {
    const available = () => speechSynthesis.getVoices().some((voice) => voice.localService && /^en/iu.test(voice.lang));
    if (available()) { resolve(true); return; }
    const finish = () => {
      clearTimeout(timer);
      speechSynthesis.removeEventListener("voiceschanged", changed);
      resolve(available());
    };
    const changed = () => { if (available()) finish(); };
    const timer = setTimeout(finish, 2_000);
    speechSynthesis.addEventListener("voiceschanged", changed);
  }));
  test.skip(!hasLocalEnglishVoice, "This browser/OS has no installed local English SpeechSynthesis voice");
  // Autoplay can be blocked until a user gesture. Explicit replay exercises
  // the unchanged native provider after the real model has loaded.
  const stop = page.getByRole("button", { name: "Stop playback", exact: true });
  if (await stop.isVisible()) await stop.click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
  const starts = await page.evaluate(() => (window as unknown as { nativeSpeechEvents: { started: number } }).nativeSpeechEvents.started);
  await page.getByRole("button", { name: "Replay latest partner message" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { nativeSpeechEvents: { started: number } }).nativeSpeechEvents.started)).toBeGreaterThan(starts);
  await expect(avatar).toHaveAttribute("data-avatar-state", "speaking");
  await expect.poll(() => page.evaluate(() => Math.max(...(window as unknown as { avatarProbe: AvatarProbe }).avatarProbe.mouth))).toBeGreaterThan(0.3);
  await page.screenshot({ path: testInfo.outputPath("real-vrm-native-tts.png") });
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle", { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => Math.max(...(window as unknown as { avatarProbe: AvatarProbe }).avatarProbe.mouth))).toBeLessThan(0.01);
  expect(await page.evaluate(() => (window as unknown as { nativeSpeechEvents: { ended: number } }).nativeSpeechEvents.ended)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Replay latest partner message" }).click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "speaking");
  await stop.click();
  await expect(avatar).toHaveAttribute("data-avatar-state", "idle");
  await expect.poll(() => page.evaluate(() => Math.max(...(window as unknown as { avatarProbe: AvatarProbe }).avatarProbe.mouth))).toBeLessThan(0.01);
  await expect(avatar.locator("canvas")).toHaveCount(1);
});

test("student Speaking layout keeps active and waiting states balanced", async ({ browser }, testInfo) => {
  const cases = [
    {
      id: "student-layout-active-practice",
      status: "active" as const,
      mode: "practice" as const,
      viewport: { width: 1680, height: 942 },
      supportSettings: { showTargetExpressions: true, showContext: true, showTranscript: true, allowReplay: true, allowHelp: true },
      screenshot: "active-practice-1680x942.png"
    },
    {
      id: "student-layout-active-practice-1536",
      status: "active" as const,
      mode: "practice" as const,
      viewport: { width: 1536, height: 864 },
      supportSettings: { showTargetExpressions: true, showContext: true, showTranscript: true, allowReplay: true, allowHelp: true },
      screenshot: "active-practice-1536x864.png"
    },
    {
      id: "student-layout-active-practice-1280",
      status: "active" as const,
      mode: "practice" as const,
      viewport: { width: 1280, height: 800 },
      supportSettings: { showTargetExpressions: true, showContext: true, showTranscript: true, allowReplay: true, allowHelp: true },
      screenshot: "active-practice-1280x800.png"
    },
    {
      id: "student-layout-waiting-assessment",
      status: "ready" as const,
      mode: "assessment" as const,
      viewport: { width: 1366, height: 768 },
      supportSettings: { showTargetExpressions: true, showContext: true, showTranscript: false, allowReplay: false, allowHelp: false },
      screenshot: "waiting-assessment-1366x768.png"
    },
    {
      id: "student-layout-active-assessment",
      status: "active" as const,
      mode: "assessment" as const,
      viewport: { width: 1366, height: 768 },
      supportSettings: { showTargetExpressions: true, showContext: true, showTranscript: false, allowReplay: false, allowHelp: false },
      screenshot: "active-assessment-1366x768.png"
    },
    {
      id: "student-layout-no-support",
      status: "active" as const,
      mode: "assessment" as const,
      viewport: { width: 1024, height: 768 },
      supportSettings: { showTargetExpressions: false, showContext: false, showTranscript: false, allowReplay: false, allowHelp: false },
      screenshot: "active-no-support-1024x768.png"
    },
    {
      id: "student-layout-active-mobile",
      status: "active" as const,
      mode: "practice" as const,
      viewport: { width: 390, height: 844 },
      supportSettings: { showTargetExpressions: true, showContext: true, showTranscript: true, allowReplay: true, allowHelp: true },
      screenshot: "active-practice-390x844.png"
    }
  ];

  for (const scenario of cases) {
    const context = await browser.newContext({ viewport: scenario.viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    try {
      const data = makeSessionData(scenario.id, scenario.status, scenario.mode, scenario.supportSettings);
      await mockStudentSession(page, scenario.id, data);
      await page.goto(`${baseUrl}/speak/session/${scenario.id}`);
      await expect(page.locator(".speaking-student-screen-ready")).toBeVisible();

      const layout = await readLayout(page);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport.width);
      expect(layout.header).not.toBeNull();
      expect(layout.controls).not.toBeNull();
      expect(layout.mic).not.toBeNull();
      const micCenter = layout.mic!.left + layout.mic!.width / 2;
      const controlsCenter = layout.controls!.left + layout.controls!.width / 2;
      expect(Math.abs(micCenter - controlsCenter)).toBeLessThanOrEqual(1);
      expect(layout.markCount).toBe(1);
      expect(layout.logoImageCount).toBe(0);

      await expect(page.locator(".speaking-student-mode")).toHaveText(scenario.mode === "practice" ? "Practice" : "Assessment");
      if (scenario.status === "ready") {
        await expect(page.locator(".speaking-avatar")).toHaveAttribute("data-avatar-state", "paused");
        expect(layout.waiting?.height).toBe(44);
        expect(layout.micDisabled).toBe(true);
        expect(layout.finishDisabled).toBe(true);
      } else {
        await expect(page.locator(".speaking-avatar")).toHaveAttribute("data-avatar-state", "idle");
        expect(layout.waiting).toBeNull();
        expect(layout.micDisabled).toBe(false);
        expect(layout.finishDisabled).toBe(false);
      }
      expect(layout.transcriptCount).toBe(scenario.supportSettings.showTranscript ? 1 : 0);
      expect(layout.sidebarCount).toBe(scenario.supportSettings.showTargetExpressions || scenario.supportSettings.showContext ? 1 : 0);
      expect(layout.replayCount).toBe(scenario.supportSettings.allowReplay ? 1 : 0);

      await page.screenshot({ path: testInfo.outputPath(scenario.screenshot), fullPage: false });
    } finally {
      await context.close();
    }
  }
});
