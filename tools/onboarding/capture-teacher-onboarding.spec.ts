import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const onboardingRoot = join(process.cwd(), "tools", "onboarding");
const rawRoot = join(onboardingRoot, "raw");
const playwrightRawRoot = join(rawRoot, ".playwright");
const VIEWPORT = { width: 1920, height: 1080 } as const;

type Recording = {
  context: BrowserContext;
  page: Page;
  video: ReturnType<Page["video"]>;
  startedAt: number;
};

type StudentClient = {
  context: BrowserContext;
  page: Page;
};

const cursorCss = `
  .onboarding-cursor {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2147483647;
    width: 24px;
    height: 30px;
    pointer-events: none;
    transform: translate(-3px, -3px);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, .72));
  }
  .onboarding-cursor::before {
    position: absolute;
    inset: 0;
    background: #ffffff;
    clip-path: polygon(0 0, 0 86%, 28% 65%, 42% 100%, 54% 95%, 39% 59%, 82% 59%);
    content: "";
  }
  .onboarding-cursor-ring {
    position: fixed;
    z-index: 2147483646;
    width: 34px;
    height: 34px;
    border: 2px solid rgba(53, 199, 255, .9);
    border-radius: 50%;
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, -50%) scale(.4);
  }
  .onboarding-cursor-ring.is-pulsing { animation: onboarding-click .42s ease-out; }
  @keyframes onboarding-click {
    0% { opacity: .95; transform: translate(-50%, -50%) scale(.45); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.45); }
  }
`;

const installCursor = async (page: Page) => {
  await page.addStyleTag({ content: cursorCss });
  await page.evaluate(() => {
    document.querySelector(".onboarding-cursor")?.remove();
    document.querySelector(".onboarding-cursor-ring")?.remove();
    const cursor = document.createElement("div");
    cursor.className = "onboarding-cursor";
    cursor.setAttribute("aria-hidden", "true");
    const ring = document.createElement("div");
    ring.className = "onboarding-cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    document.body.append(cursor, ring);
    document.addEventListener("mousemove", (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      ring.style.left = `${event.clientX}px`;
      ring.style.top = `${event.clientY}px`;
    }, true);
    document.addEventListener("click", () => {
      ring.classList.remove("is-pulsing");
      void ring.offsetWidth;
      ring.classList.add("is-pulsing");
    }, true);
  });
};

const createRecording = async (browser: Browser, teacherToken?: string): Promise<Recording> => {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    recordVideo: { dir: playwrightRawRoot, size: VIEWPORT }
  });
  if (teacherToken) {
    await context.addInitScript((token) => {
      window.localStorage.setItem("quizstrike_token", token);
    }, teacherToken);
  }
  const page = await context.newPage();
  return { context, page, video: page.video(), startedAt: Date.now() };
};

const saveRecording = async (recording: Recording, filename: string) => {
  const outputPath = join(rawRoot, filename);
  await recording.context.close();
  if (!recording.video) throw new Error(`No Playwright video was created for ${filename}.`);
  await recording.video.saveAs(outputPath);
  return { path: outputPath, durationMs: Date.now() - recording.startedAt };
};

const createStudentClient = async (browser: Browser): Promise<StudentClient> => {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  return { context, page };
};

const waitForTeacherWorkspace = async (page: Page) => {
  await page.goto("/quiz-strike");
  const workspaceButton = page.getByRole("button", { name: "Teacher workspace", exact: true });
  await expect(workspaceButton).toBeVisible();
  await workspaceButton.click();
  await expect(page.getByText("Question library", { exact: true }).first()).toBeVisible();
  await installCursor(page);
};

const joinStudent = async (page: Page, code: string, nickname: string, team: "Blue" | "Red") => {
  await page.goto(`/join?code=${code}`);
  await expect(page.getByPlaceholder("Player name")).toBeVisible();
  await installCursor(page);
  await page.getByPlaceholder("Player name").fill(nickname);
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`${team} team`, "i") }).click();
  await page.waitForTimeout(650);
};

const openExistingLobby = async (page: Page, code: string) => {
  await waitForTeacherWorkspace(page);
  const sessionButton = page.getByRole("button", { name: new RegExp(`${code}\\s+\\d+ players`, "u") });
  await expect(sessionButton).toBeVisible();
  await sessionButton.click();
  await expect(page.getByText("Invite students", { exact: true })).toBeVisible();
};

test("capture the real teacher onboarding journey", async ({ browser }) => {
  await mkdir(rawRoot, { recursive: true });
  await mkdir(playwrightRawRoot, { recursive: true });
  const captured: Record<string, unknown> = {
    capturedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    terminology: {
      account: "Create account",
      library: "Question library",
      quiz: "Create question set / Create set",
      questions: "From a study list / Create questions",
      game: "Set up a game / Create game",
      lobby: "Invite students",
      joinMethods: ["Game code", "Student Join Link", "Scan to join"],
      start: "Start game"
    },
    clips: {}
  };

  const recordClip = (name: string, result: unknown) => {
    captured.clips = { ...(captured.clips as Record<string, unknown>), [name]: result };
  };

  const account = await createRecording(browser);
  let teacherToken = "";
  try {
    await account.page.goto("/quiz-strike");
    const createTeacherButton = account.page.getByRole("button", { name: "Create a teacher account", exact: true }).first();
    await expect(createTeacherButton).toBeVisible();
    await installCursor(account.page);
    await createTeacherButton.click();
    await expect(account.page.getByLabel("Your name")).toBeVisible();
    await account.page.getByLabel("Your name").fill("Ms. Smith");
    await account.page.getByLabel("Email").fill(`teacher-onboarding-${Date.now()}@example.test`);
    await account.page.locator("#teacher-password").fill("classroom-onboarding-pass");
    await account.page.waitForTimeout(500);
    await account.page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(account.page.getByText("Question library", { exact: true }).first()).toBeVisible();
    await account.page.waitForTimeout(1_100);
    teacherToken = await account.page.evaluate(() => window.localStorage.getItem("quizstrike_token") ?? "");
    if (!teacherToken) throw new Error("The signup flow did not persist a teacher token.");
  } finally {
    recordClip("01-account", await saveRecording(account, "01-account.webm"));
  }

  // Use the token created by the visible signup flow for all later scenes so
  // the recorded journey and the student room share one account.
  const fixture = { teacherToken };

  const quiz = await createRecording(browser, fixture.teacherToken);
  try {
    await waitForTeacherWorkspace(quiz.page);
    await quiz.page.getByRole("button", { name: "Create question set", exact: true }).first().click();
    await expect(quiz.page.getByLabel("Set name")).toBeVisible();
    await quiz.page.getByLabel("Set name").fill("Eiken Vocabulary Practice");
    await quiz.page.getByLabel("Description").fill("Short vocabulary review for the next class.");
    await quiz.page.getByRole("button", { name: "Create set", exact: true }).click();
    await expect(quiz.page.getByText("Active question set", { exact: true })).toBeVisible();
    await quiz.page.locator(".bulk-textarea").fill([
      "environment - The world around us",
      "experience - Knowledge gained by doing something",
      "promise - A commitment to do something",
      "method - A way of doing something"
    ].join("\n"));
    await quiz.page.getByRole("button", { name: "Create questions", exact: true }).click();
    await expect(quiz.page.getByText(/questions are ready to review/i)).toBeVisible();
    await expect(quiz.page.getByText(/4 questions/u).first()).toBeVisible();
    await quiz.page.waitForTimeout(1_600);
  } finally {
    recordClip("02-make-quiz", await saveRecording(quiz, "02-make-quiz.webm"));
  }

  const setup = await createRecording(browser, fixture.teacherToken);
  let sessionCode = "";
  try {
    await waitForTeacherWorkspace(setup.page);
    await setup.page.getByRole("button", { name: "Start a game", exact: true }).first().click();
    await expect(setup.page.getByRole("heading", { name: "Set up a game", exact: true })).toBeVisible();
    await expect(setup.page.getByRole("heading", { name: "Choose the game", exact: true })).toBeVisible();
    await setup.page.getByRole("button", { name: /^Team Tag:/u }).click();
    await setup.page.getByRole("button", { name: /^2 Arena$/u }).click();
    await expect(setup.page.getByRole("heading", { name: "Choose a map", exact: true })).toBeVisible();
    await setup.page.getByRole("button", { name: /^Desert Citadel:/u }).click();
    await setup.page.waitForTimeout(900);
    await setup.page.getByRole("button", { name: "Create game", exact: true }).click();
    await expect(setup.page.getByText("Invite students", { exact: true })).toBeVisible();
    sessionCode = (await setup.page.locator(".invite-code-block strong").textContent())?.trim() ?? "";
    if (!sessionCode) throw new Error("The created game did not display a session code.");
    await expect(setup.page.getByText("Student Join Link", { exact: true })).toBeVisible();
    await expect(setup.page.getByText("Scan to join", { exact: true })).toBeVisible();
    await setup.page.waitForTimeout(1_400);
  } finally {
    recordClip("03-create-game", await saveRecording(setup, "03-create-game.webm"));
  }

  const invite = await createRecording(browser, fixture.teacherToken);
  const recordedStudent = await createRecording(browser);
  const liveStudentClients: StudentClient[] = [];
  try {
    await openExistingLobby(invite.page, sessionCode);
    await joinStudent(recordedStudent.page, sessionCode, "Alex", "Blue");

    for (const [nickname, team] of [["Yuki", "Red"], ["Hana", "Blue"]] as const) {
      const client = await createStudentClient(browser);
      liveStudentClients.push(client);
      await joinStudent(client.page, sessionCode, nickname, team);
    }

    const roster = invite.page.locator(".waiting-student-roster");
    await expect(roster.getByText("Alex", { exact: true })).toBeVisible();
    await expect(roster.getByText("Yuki", { exact: true })).toBeVisible();
    await expect(roster.getByText("Hana", { exact: true })).toBeVisible();
    await invite.page.waitForTimeout(2_000);
  } finally {
    recordClip("04-invite-students", await saveRecording(invite, "04-invite-students.webm"));
    recordClip("student-join", await saveRecording(recordedStudent, "student-join.webm"));
  }

  const start = await createRecording(browser, fixture.teacherToken);
  try {
    await openExistingLobby(start.page, sessionCode);
    const startRoster = start.page.locator(".waiting-student-roster");
    await expect(startRoster.getByText("Yuki", { exact: true })).toBeVisible();
    await expect(startRoster.getByText("Hana", { exact: true })).toBeVisible();
    await start.page.waitForTimeout(700);
    await start.page.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(start.page.getByRole("heading", { name: "Run the live game", exact: true })).toBeVisible();
    await expect(start.page.locator(".arena-canvas canvas")).toBeVisible({ timeout: 30_000 });
    await start.page.waitForTimeout(4_500);
  } finally {
    recordClip("05-start-game", await saveRecording(start, "05-start-game.webm"));
    await Promise.all(liveStudentClients.map((client) => client.context.close()));
  }

  await writeFile(join(rawRoot, "capture-timings.json"), JSON.stringify(captured, null, 2), "utf8");
});
