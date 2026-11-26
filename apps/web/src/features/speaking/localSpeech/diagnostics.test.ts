import assert from "node:assert/strict";
import test from "node:test";
import { hasLikelySpeech, LOCAL_SAMPLE_RATE } from "./audio.js";
import { speechBenchmarkMetrics, speechWordErrorRate } from "./diagnostics.js";

test("benchmark distinguishes edit types and empty speech controls", () => {
  const result = speechBenchmarkMetrics("um i like red books", "i like blue books books", false);
  assert.deepEqual([result.substitutions, result.insertions, result.deletions], [1, 1, 1]);
  assert.equal(result.wordErrorRate, 0.6);
  assert.equal(result.referencePatterns.fillers, 1);
  assert.equal(result.recognizedPatterns.adjacentRepeats, 1);
  assert.equal(speechBenchmarkMetrics("expected words", "", false).missedSpeech, true);
  assert.equal(speechBenchmarkMetrics("", "unwanted words", true).hallucinatedSpeech, true);
});

test("energy gate rejects silence and stationary sound without changing the waveform", () => {
  const quiet = new Float32Array(LOCAL_SAMPLE_RATE);
  assert.equal(hasLikelySpeech(quiet), false);
  const background = Float32Array.from(quiet, (_, index) => 0.05 * Math.sin(2 * Math.PI * (index % 16) / 16));
  assert.equal(hasLikelySpeech(background), false);
  const varying = background.slice();
  varying.fill(0, 0, LOCAL_SAMPLE_RATE / 4);
  const original = varying.slice();
  assert.equal(hasLikelySpeech(varying), true);
  assert.deepEqual(varying, original);
});

test("diagnostics measure word substitutions, omissions, and insertions", () => {
  assert.equal(speechWordErrorRate("I like reading books.", "I like reading books"), 0);
  assert.equal(speechWordErrorRate("I like reading books.", "I love books now"), 0.75);
  assert.equal(speechWordErrorRate("I don’t know.", "I don't know"), 0);
  assert.equal(speechWordErrorRate("", "some speech"), undefined);
});
