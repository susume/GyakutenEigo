import assert from "node:assert/strict";
import test from "node:test";
import { SCHOOL_ENGLISH_LIBRARY, WORKPLACE_ENGLISH_LIBRARY } from "./speakingCoreLibrary.js";
import { SCHOOL_TEXTBOOK_ALIGNMENTS, SCHOOL_TEXTBOOK_VOCABULARY } from "./speakingSchoolTextbookAlignment.js";
import { SpeakingCreateActivityInputSchema, speakingScenarioResources } from "./speaking.js";

test("every school task retains textbook support through activity validation and normalization", () => {
  assert.equal(Object.keys(SCHOOL_TEXTBOOK_ALIGNMENTS).length, SCHOOL_ENGLISH_LIBRARY.length);
  const books = new Set<number>();
  for (const task of SCHOOL_ENGLISH_LIBRARY) {
    const alignment = SCHOOL_TEXTBOOK_ALIGNMENTS[task.id.replace(/^core-/u, "")]!;
    assert.ok(alignment, task.id);
    const parsed = SpeakingCreateActivityInputSchema.parse(task);
    const normalized = speakingScenarioResources(parsed.scenarioResources);
    assert.deepEqual(normalized.textbookReferences, alignment.references, task.id);
    assert.equal(normalized.exampleDialogue, alignment.exampleDialogue, task.id);
    assert.ok(normalized.studentGoal.includes(alignment.goalAddition), task.id);
    assert.ok((normalized.exampleDialogue?.split("\n").length ?? 0) >= 6, task.id);
    assert.match(normalized.exampleDialogue!, /^You:|^Partner:/u);
    for (const reference of alignment.references) books.add(reference.book);
    for (const word of alignment.words) {
      assert.ok(word.meaning && word.page && word.section, `${task.id}: ${word.word}`);
      assert.ok(normalized.usefulVocabulary.some((value) => value.split(/\s+(?:\/|—)\s+/u)[0]!.toLocaleLowerCase() === word.word.toLocaleLowerCase()), `${task.id}: ${word.word}`);
    }
  }
  assert.deepEqual([...books].sort(), [1, 2, 3]);
  assert.ok(WORKPLACE_ENGLISH_LIBRARY.every((task) => !task.scenarioResources.exampleDialogue && !task.scenarioResources.textbookReferences));
});

test("train vocabulary selects the actual transport senses and HWG keeps its original map and class support", () => {
  assert.equal(SCHOOL_TEXTBOOK_VOCABULARY.change!.meaning, "（電車など）を乗りかえる");
  assert.equal(SCHOOL_TEXTBOOK_VOCABULARY.stop!.meaning, "停留所、駅");
  assert.equal(SCHOOL_TEXTBOOK_VOCABULARY.take!.page, "77");
  assert.equal(SCHOOL_TEXTBOOK_VOCABULARY.may!.book, 2);
  const hwg = SCHOOL_ENGLISH_LIBRARY.find((task) => task.id === "core-hwg-giving-train-directions")!;
  assert.equal(hwg.context?.imageUrl, "/assets/speaking/context-hwg-tokyo-train-map.png");
  assert.equal(hwg.targetExpressions.length, 12);
  assert.ok(hwg.scenarioResources.usefulVocabulary?.includes("How long does it take? — どのくらい時間がかかりますか"));
  assert.ok(hwg.scenarioResources.textbookReferences?.some((reference) => reference.book === 2 && reference.pages === "77" && reference.pdfPages.includes(41)));
});
