import assert from "node:assert/strict";
import test from "node:test";
import { alignSpeakingReading, SpeakingPassageImportSchema, SpeakingReadingTranscriptSchema } from "./speakingReading.js";

test("aligns contractions, hyphens, numbers, punctuation, and capitalization", () => {
  const result = alignSpeakingReading("I didn’t buy twenty-one books. We can’t buy 12.", "i did not buy 21 books! we can not buy twelve");
  assert.equal(result.matches, result.referenceWords);
  assert.equal(result.wordErrorRate, 0);
});

test("tracks omissions, substitutions, repetitions and incomplete endings", () => {
  const result = alignSpeakingReading("It was a lovely day. We walked home together.", "It was was a nice day. We walked.");
  assert.equal(result.substitutions, 1);
  assert.equal(result.insertions, 1);
  assert.equal(result.omissions, 2);
  assert.equal(result.matches, 6);
  assert.equal(result.coverage, 7 / 9);
  assert.equal(result.wordErrorRate, 4 / 9);
  assert.ok(result.possibleIncomplete);
  assert.ok(result.words.some((word) => word.possibleRepetition));
  assert.equal(alignSpeakingReading("I drew a map.", "").coverage, 0);
});

test("validates import structure, uniqueness, and duration without fabricating confidence", () => {
  const item = { grade: 1, textbook: "Original", edition: "2026", unit: "1", part: "A", text: "I drew a map." };
  assert.ok(SpeakingPassageImportSchema.safeParse({ formatVersion: 1, passages: [item] }).success);
  assert.equal(SpeakingPassageImportSchema.safeParse({ formatVersion: 1, passages: [item, { ...item, textbook: "ORIGINAL" }] }).success, false);
  assert.equal(SpeakingPassageImportSchema.safeParse({ formatVersion: 1, passages: [{ ...item, text: "word ".repeat(351) }] }).success, false);
  assert.equal(SpeakingReadingTranscriptSchema.safeParse({ text: "Words", uncertain: true, durationMs: 90_001 }).success, false);
  assert.equal(SpeakingReadingTranscriptSchema.safeParse({ text: "Words", uncertain: true, durationMs: 1, confidence: 1 }).success, false);
});
