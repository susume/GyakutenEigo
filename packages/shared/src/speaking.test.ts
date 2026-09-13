import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPEAKING_RUBRIC, DEFAULT_SPEAKING_SCENARIO_RESOURCES, speakingScenarioResources, speakingTeacherDate } from "./speaking.js";
import { SPEAKING_CATEGORIES, SPEAKING_COMMUNICATION_SKILLS, SPEAKING_CORE_LIBRARY } from "./index.js";

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
  assert.equal(SPEAKING_CORE_LIBRARY.length, 30);
  assert.deepEqual(SPEAKING_CORE_LIBRARY.map((item) => item.title).sort(), [...expectedTitles].sort());
  assert.equal(new Set(SPEAKING_CORE_LIBRARY.map((item) => item.id)).size, 30);
  assert.deepEqual(new Set(SPEAKING_CORE_LIBRARY.map((item) => item.scenarioResources.category)), new Set(SPEAKING_CATEGORIES));
  for (const item of SPEAKING_CORE_LIBRARY) {
    assert.ok(item.scenario.length > 40);
    assert.ok(item.scenarioResources.aiContext);
    assert.ok(item.scenarioResources.possibleComplication);
    assert.ok((item.scenarioResources.successConditions?.length ?? 0) >= 2);
    assert.equal(item.scenarioResources.builtIn, true);
    assert.ok(item.scenarioResources.communicationSkills?.every((skill) => SPEAKING_COMMUNICATION_SKILLS.includes(skill as typeof SPEAKING_COMMUNICATION_SKILLS[number])));
  }
});
