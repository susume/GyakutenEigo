import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const audioFile = process.env.SPEAKING_E2E_WAV;
if (!audioFile) throw new Error("Set SPEAKING_E2E_WAV to an original WAV of: I like reading books. My favorite subject is English.");
const audio = (await readFile(audioFile)).toString("base64");
const browser = await chromium.launch({ executablePath: process.env.SPEAKCHECK_CHROME_PATH, headless: true });
try {
  const page = await browser.newPage();
  const origin = new URL(process.env.SPEAKCHECK_BENCHMARK_WEB_ORIGIN ?? "http://127.0.0.1:4194").origin;
  const harness = origin + "/__speakcheck-reading-benchmark";
  await page.route(harness, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>SpeakCheck reading benchmark</title>" }));
  await page.goto(harness);
  const models = (process.env.SPEAKCHECK_BENCHMARK_MODELS ?? "moonshine,tiny").split(",");
  const rounds = Number(process.env.SPEAKCHECK_BENCHMARK_ROUNDS ?? 3);
  for (const model of models) {
    const result = await page.evaluate(async ({ audio, model, rounds }) => {
      const { BrowserSpeechRecognizer } = await import("/src/features/speaking/localSpeech/browserSpeech.ts");
      const { readingBenchmarkMetrics } = await import("/src/features/speaking/localSpeech/diagnostics.ts");
      const engine = new BrowserSpeechRecognizer();
      const rate = 16_000;
      const og = Uint8Array.from(atob(audio), (value) => value.charCodeAt(0));
      const sample = (await new OfflineAudioContext(1, 1, rate).decodeAudioData(og.buffer)).getChannelData(0);
      const referenceText = "I like reading books. My favorite subject is English.";
      const metrics = (times) => {
        const sorted = [...times].sort((a, b) => a - b);
        return { median: +sorted[Math.ceil(sorted.length / 2) - 1].toFixed(2), p95: +sorted[Math.ceil(sorted.length * .95) - 1].toFixed(2) };
      };
      const options = { model, backend: "wasm" };
      const prepare = async (opts) => {
        const start = performance.now();
        const result = await engine.prepare(opts);
        return { ...result, totalMs: Math.round(performance.now() - start) };
      };
      const cold = await prepare(options);
      const measurements = [];
      const wave = (seconds) => {
        const length = seconds * rate;
        const data = new ArrayBuffer(44 + length * 2);
        const view = new DataView(data);
        for (const [offset, text] of [[0, "RIFF"], [8, "WAVEfmt "], [36, "data"]]) {
          [...text].forEach((value, i) => view.setUint8(offset + i, value.charCodeAt(0)));
        }
        view.setUint32(4, data.byteLength - 8, true);
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, rate, true);
        view.setUint32(28, rate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        view.setUint32(40, length * 2, true);
        const repetitions = Math.floor(length / sample.length);
        for (let i = 0; i < repetitions * sample.length; i++) view.setInt16(44 + i * 2, sample[i % sample.length] * 32767, true);
        return { blob: new Blob([data], { type: "audio/wav" }), reference: Array(repetitions).fill(referenceText).join(" ") };
      };
      for (const seconds of [15, 30, 60, 90]) {
        const { blob, reference } = wave(seconds);
        const runs = [];
        for (let i = 0; i < rounds; i++) {
          const start = performance.now();
          const recognized = await engine.transcribeReading(blob);
          const totalMs = performance.now() - start;
          const alignmentStart = performance.now();
          const alignment = readingBenchmarkMetrics(reference, reference, recognized.text);
          runs.push({ totalMs, inferenceMs: recognized.inferenceMs, alignmentMs: performance.now() - alignmentStart,
            wer: alignment.recognitionAgainstSpoken.wordErrorRate, status: recognized.status });
        }
        measurements.push({ seconds, localBytes: blob.size, rounds,
          totalMs: metrics(runs.map((run) => run.totalMs)), inferenceMs: metrics(runs.map((run) => run.inferenceMs)),
          threeAlignmentsMs: metrics(runs.map((run) => run.alignmentMs)), wordErrorRates: runs.map((run) => run.wer),
          statuses: runs.map((run) => run.status)
        });
      }
      const boundary = {};
      const empty = wave(1);
      boundary.silence = (await engine.transcribeReading(empty.blob)).status;
      for (const [key, blob] of [["tooLong", wave(91).blob], ["invalid", new Blob(["not audio"], { type: "audio/wav" })]]) {
        try { await engine.transcribeReading(blob); boundary[key] = "accepted"; }
        catch (error) { boundary[key] = error.code; }
      }
      engine.dispose();
      const warm = await prepare({ ...options, cachedOnly: true });
      engine.dispose();
      return { model, cold, warm, measurements, boundary };
    }, { audio, model, rounds });
    console.log(JSON.stringify(result));
  }
} finally { await browser.close(); }
