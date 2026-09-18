import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPEAKING_ASSESSMENT_SUPPORT_SETTINGS, DEFAULT_SPEAKING_PRACTICE_SUPPORT_SETTINGS, DEFAULT_SPEAKING_RUBRIC, DEFAULT_SPEAKING_SCENARIO_RESOURCES, SpeakingCreateActivityInputSchema, recommendedSpeakingSupportSettings, resolveSpeakingSupportSettings, speakingScenarioResources, speakingTeacherDate } from "./speaking.js";
import { SPEAKING_COMMUNICATION_SKILLS, SPEAKING_CORE_LIBRARY, SCHOOL_ENGLISH_LIBRARY, WORKPLACE_ENGLISH_LIBRARY, SPEAKING_LIBRARY_CATEGORY_DEFINITIONS, SPEAKING_LIBRARY_COLLECTIONS } from "./index.js";

const countBy = <T>(items: T[], key: (item: T) => string): Record<string, number> => items.reduce<Record<string, number>>((counts, item) => {
  const value = key(item);
  counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}, {});

test("teacher calendar dates use Japan midnight rather than UTC or host timezone", () => {
  assert.equal(speakingTeacherDate("2026-09-09T15:30:00Z"), "2026-09-10");
  assert.equal(speakingTeacherDate("2026-09-09T14:59:59Z"), "2026-09-09");
  assert.equal(speakingTeacherDate("2026-12-31T15:00:00Z"), "2027-01-01");
});

test("the default speaking rubric has the four assessment criteria", () => {
  assert.deepEqual(DEFAULT_SPEAKING_RUBRIC.map((criterion) => criterion.id), ["task_achievement", "interaction", "language_range_control", "communication_fluency"]);
  assert.deepEqual(DEFAULT_SPEAKING_RUBRIC.map((criterion) => criterion.name), ["Task Achievement", "Interaction", "Language Range & Control", "Communication & Fluency"]);
  assert.equal(DEFAULT_SPEAKING_RUBRIC.every((criterion) => criterion.enabled), true);
});

test("speaking scenario support resolves neutral defaults without title inference", () => {
  const resources = speakingScenarioResources({ openingLine: "", studentGoal: "", suggestedSteps: [], usefulVocabulary: [] });
  assert.equal(resources.openingLine, DEFAULT_SPEAKING_SCENARIO_RESOURCES.openingLine);
  assert.equal(resources.studentGoal, DEFAULT_SPEAKING_SCENARIO_RESOURCES.studentGoal);
  assert.deepEqual(resources.suggestedSteps, []);
  assert.deepEqual(resources.usefulVocabulary, []);
  assert.deepEqual(resources.referenceItems, []);
});

test("speaking scenario support bounds teacher-authored reference material", () => {
  const resources = speakingScenarioResources({
    openingLine: "A custom opening",
    suggestedSteps: Array.from({ length: 12 }, (_, index) => `Step ${index}`),
    usefulVocabulary: Array.from({ length: 20 }, (_, index) => `Word ${index}`),
    referenceItems: Array.from({ length: 30 }, (_, index) => ({ label: `Item ${index}`, detail: "detail" }))
  });
  assert.equal(resources.openingLine, "A custom opening");
  assert.equal(resources.suggestedSteps.length, 8);
  assert.equal(resources.usefulVocabulary.length, 16);
  assert.equal(resources.referenceItems.length, 24);
});

test("speaking modes expose explicit recommendations and preserve legacy support", () => {
  assert.deepEqual(recommendedSpeakingSupportSettings("practice"), DEFAULT_SPEAKING_PRACTICE_SUPPORT_SETTINGS);
  assert.deepEqual(recommendedSpeakingSupportSettings("assessment"), DEFAULT_SPEAKING_ASSESSMENT_SUPPORT_SETTINGS);
  assert.deepEqual(resolveSpeakingSupportSettings(undefined), {
    showTargetExpressions: true,
    showContext: true,
    showTranscript: true,
    allowReplay: true,
    allowHelp: true
  });
  const parsed = SpeakingCreateActivityInputSchema.parse({
    title: "A task",
    scenario: "A classroom situation.",
    aiRole: "Partner",
    studentRole: "Student",
    level: "beginner",
    difficulty: "easy",
    nativeLanguage: "en",
    durationSeconds: 120,
    identifierMode: "nickname",
    mode: "assessment",
    supportSettings: { showTranscript: true },
    targetExpressions: [],
    rubric: DEFAULT_SPEAKING_RUBRIC
  });
  assert.equal(parsed.mode, "assessment");
  assert.deepEqual(parsed.supportSettings, { showTranscript: true });
  assert.throws(() => SpeakingCreateActivityInputSchema.parse({
    title: "A task",
    scenario: "A classroom situation.",
    aiRole: "Partner",
    studentRole: "Student",
    level: "beginner",
    difficulty: "easy",
    nativeLanguage: "en",
    durationSeconds: 120,
    identifierMode: "nickname",
    mode: "test",
    targetExpressions: [],
    rubric: DEFAULT_SPEAKING_RUBRIC
  }));
});

test("core speaking library contains complete, categorized junior-high scenarios", () => {
  const expectedTitles = [
    "Introducing Yourself",
    "Meeting Someone New",
    "Talking About Hobbies",
    "Talking About School Life",
    "Talking About Daily Life",
    "Talking About a Past Experience",
    "Talking About Future Plans",
    "Making Plans With a Friend",
    "Making and Responding to Invitations",
    "Buying Clothes",
    "Shopping for Everyday Items",
    "Ordering Food",
    "At a Restaurant",
    "Asking for Street Directions",
    "Giving Street Directions",
    "Asking for Train Directions",
    "Giving Train Directions",
    "Using Public Transportation",
    "At a Train Station",
    "Helping a Tourist",
    "Introducing Your Hometown",
    "Introducing Japanese Culture",
    "Asking for Help",
    "Lost Property",
    "Feeling Sick",
    "Making Requests and Asking Permission",
    "Giving Advice",
    "Giving an Opinion",
    "Choosing Between Options",
    "Solving an Everyday Problem"
  ];
  assert.equal(SCHOOL_ENGLISH_LIBRARY.length, 30);
  assert.equal(SPEAKING_CORE_LIBRARY.length, 79);
  assert.deepEqual(SCHOOL_ENGLISH_LIBRARY.map((item) => item.title).sort(), [...expectedTitles].sort());
  assert.equal(new Set(SCHOOL_ENGLISH_LIBRARY.map((item) => item.id)).size, 30);
  assert.deepEqual(new Set(SCHOOL_ENGLISH_LIBRARY.map((item) => item.scenarioResources.category)), new Set(SPEAKING_LIBRARY_CATEGORY_DEFINITIONS.filter((category) => category.collectionId === "school-english").map((category) => category.name)));
  for (const item of SCHOOL_ENGLISH_LIBRARY) {
    assert.ok(item.scenario.length > 40);
    assert.ok(item.scenarioResources.aiContext);
    assert.ok(item.scenarioResources.possibleComplication);
    assert.ok((item.scenarioResources.successConditions?.length ?? 0) >= 2);
    assert.equal(item.scenarioResources.builtIn, true);
    assert.ok(item.scenarioResources.communicationSkills?.every((skill) => SPEAKING_COMMUNICATION_SKILLS.includes(skill as typeof SPEAKING_COMMUNICATION_SKILLS[number])));
  }
});

test("the canonical library has two collections and the requested category counts", () => {
  assert.deepEqual(SPEAKING_LIBRARY_COLLECTIONS, ["school-english", "workplace-english"]);
  assert.equal(new Set(SPEAKING_LIBRARY_COLLECTIONS).size, 2);
  assert.equal(WORKPLACE_ENGLISH_LIBRARY.length, 49);
  assert.equal(new Set(SPEAKING_CORE_LIBRARY.map((item) => item.id)).size, 79);
  const byCollection = countBy(SPEAKING_CORE_LIBRARY, (item) => item.scenarioResources.libraryCollection ?? "missing");
  assert.equal(byCollection["school-english"], 30);
  assert.equal(byCollection["workplace-english"], 49);
  const workplaceCounts = countBy(WORKPLACE_ENGLISH_LIBRARY, (item) => item.scenarioResources.category ?? "missing");
  assert.deepEqual(workplaceCounts, {
    "Luxury Car Sales": 9,
    "Hotels & Hospitality": 8,
    "Restaurants & Cafés": 8,
    "Retail & Customer Service": 8,
    "Tourism & Visitor Support": 8,
    "Office & Business": 8
  });
  assert.equal(new Set(SPEAKING_LIBRARY_CATEGORY_DEFINITIONS.map((category) => category.id)).size, 14);
  assert.equal(SPEAKING_LIBRARY_CATEGORY_DEFINITIONS.every((category) => SPEAKING_LIBRARY_COLLECTIONS.includes(category.collectionId)), true);
  for (const item of SPEAKING_CORE_LIBRARY) {
    const resources = item.scenarioResources;
    const category = SPEAKING_LIBRARY_CATEGORY_DEFINITIONS.find((definition) => definition.id === resources.categoryId);
    assert.ok(resources.libraryCollection);
    assert.ok(category);
    assert.equal(category.collectionId, resources.libraryCollection);
    assert.equal(category.name, resources.category);
    assert.equal(resources.sourceTemplateId, item.id);
  }
});

test("every workplace built-in is a complete assessment-compatible speaking task", () => {
  const taskIds = new Set<string>();
  for (const item of WORKPLACE_ENGLISH_LIBRARY) {
    assert.equal(taskIds.has(item.id), false, item.id);
    taskIds.add(item.id);
    assert.equal(item.scenarioResources.libraryCollection, "workplace-english");
    assert.ok(item.scenarioResources.categoryId);
    assert.ok(item.scenarioResources.category);
    assert.ok(item.scenarioResources.aiContext);
    assert.ok(item.scenarioResources.possibleComplication);
    assert.ok(item.scenarioResources.openingLine);
    assert.ok(item.scenarioResources.studentGoal);
    assert.ok((item.scenarioResources.successConditions?.length ?? 0) >= 3);
    assert.ok((item.scenarioResources.communicationSkills?.length ?? 0) > 0);
    assert.ok(item.targetExpressions.length > 0);
    assert.equal(item.mode, "assessment");
    assert.deepEqual(item.supportSettings, DEFAULT_SPEAKING_ASSESSMENT_SUPPORT_SETTINGS);
    assert.equal(item.scenarioResources.builtIn, true);
    assert.equal(item.scenarioResources.sourceTemplateId, item.id);
    assert.equal(item.rubric.some((criterion) => criterion.enabled), true);
    assert.doesNotThrow(() => SpeakingCreateActivityInputSchema.parse(item));
    assert.ok(item.scenarioResources.communicationSkills?.every((skill) => SPEAKING_COMMUNICATION_SKILLS.includes(skill as typeof SPEAKING_COMMUNICATION_SKILLS[number])));
  }
  assert.equal(taskIds.size, 49);
});
