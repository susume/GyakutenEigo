import { expect, test, type Page, type Route } from "@playwright/test";

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

async function mockStudentSession(page: Page, id: string, data: ReturnType<typeof makeSessionData>) {
  await page.addInitScript((sessionId: string) => {
    sessionStorage.setItem(`speaking-token:${sessionId}`, "student-layout-test-token");
  }, id);
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel: () => undefined,
      getVoices: () => [],
      speak: (utterance: { onend?: () => void }) => setTimeout(() => utterance.onend?.(), 0)
    } });
  });
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
        expect(layout.waiting?.height).toBe(44);
        expect(layout.micDisabled).toBe(true);
        expect(layout.finishDisabled).toBe(true);
      } else {
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
