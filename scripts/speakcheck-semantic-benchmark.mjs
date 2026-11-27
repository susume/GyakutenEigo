import { performance } from "node:perf_hooks";
import { pipeline, env } from "@huggingface/transformers";
import { structuredProgress } from "../apps/server/src/speakingStructured.ts";

const model = "Xenova/all-MiniLM-L6-v2";
const revision = "751bff37182d3f1213fa05d7196b954e230abad9";
const samples = [
  ["I like soccer.", "I love football.", true],
  ["I like soccer.", "I don't like soccer.", false],
  ["I ate breakfast.", "I didn't eat breakfast.", false],
  ["I went to Kyoto on Sunday.", "I went to Kyoto on Monday.", false],
  ["I bought two apples.", "I bought three apples.", false],
  ["I went to the shopping mall.", "I went shopping.", true],
  ["I played soccer.", "Soccer. With my friends.", true],
  ["I played soccer.", "I play soccer yesterday.", true],
  ["I went to Kyoto.", "My cousin went to Kyoto.", false],
  ["I went to Kyoto.", "I stayed home.", false]
];
const numbers = (values) => {
  const ordered = values.toSorted((a, b) => a - b);
  return { median: ordered[Math.ceil(ordered.length / 2) - 1], p95: ordered[Math.ceil(ordered.length * .95) - 1] };
};
const report = (values) => Object.fromEntries(Object.entries(numbers(values)).map(([key, value]) => [key, +value.toFixed(3)]));
const ruleTimes = { v1: [], v2: [] };
const rules = samples.map(([anchor, answer]) => {
  const decisions = [];
  for (const version of ["v1", "v2"]) {
    const plan = { ...(version === "v2" ? { version: 2 } : {}), steps: [{ question: "Can you tell me what you did?", objective: "Express the indicated meaning", kind: "answer", concepts: [anchor] }] };
    const turns = [{ id: "1", participantId: "synthetic", speaker: "student", text: answer, createdAt: "" }];
    for (let round = 0; round < 100; round++) {
      const start = performance.now();
      const result = structuredProgress(plan, turns);
      ruleTimes[version].push(performance.now() - start);
      if (round === 0) decisions.push(result.evidence.has(0));
    }
  }
  return decisions;
});
console.log(JSON.stringify({ deterministicMs: { v1: report(ruleTimes.v1), v2: report(ruleTimes.v2) } }));
env.allowLocalModels = false;
env.cacheDir = process.env.SPEAKCHECK_BENCHMARK_CACHE ?? env.cacheDir;
const baselineRss = process.memoryUsage().rss;
const start = performance.now();
const progress = new Map();
const embed = await pipeline("feature-extraction", model, {
  revision, dtype: "q8", device: "cpu",
  progress_callback(event) { if (event.status === "progress") progress.set(event.file, event.loaded); }
});
const initMs = performance.now() - start;
const loadedRss = process.memoryUsage().rss;
const embeddingTimes = [];
const vector = async (text) => {
  const started = performance.now();
  const tensor = await embed(text, { pooling: "mean", normalize: true });
  embeddingTimes.push(performance.now() - started);
  return tensor.data;
};
const results = [];
for (const [index, [anchor, answer, sameMeaning]] of samples.entries()) {
  const left = await vector(anchor);
  const right = await vector(answer);
  const cosine = left.reduce((total, value, offset) => total + value * right[offset], 0);
  results.push({ anchor, answer, sameMeaning, cosine: +cosine.toFixed(3), v1Match: rules[index][0], v2Match: rules[index][1] });
}
console.log(JSON.stringify({
  model, revision, environment: "Node CPU, synthetic examples only",
  bytesFetched: [...progress.values()].reduce((total, bytes) => total + bytes, 0),
  initMs: Math.round(initMs), embeddingMs: report(embeddingTimes),
  baselineRssBytes: baselineRss, initializedRssBytes: loadedRss, finalRssBytes: process.memoryUsage().rss,
  results
}, null, 2));
await embed.dispose();
