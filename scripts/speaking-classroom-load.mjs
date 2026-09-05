import { performance } from "node:perf_hooks";

const baseUrl = (process.env.SPEAKING_LOAD_BASE_URL || "http://127.0.0.1:4000").replace(/\/$/u, "");
const joinCode = process.env.SPEAKING_LOAD_CODE?.trim();
const requestedCount = Number.parseInt(process.env.SPEAKING_LOAD_COUNT || "40", 10);
const count = Math.min(60, Math.max(1, Number.isFinite(requestedCount) ? requestedCount : 40));
const textMode = process.env.SPEAKING_LOAD_TEXT === "true";
const trueBurst = process.env.SPEAKING_LOAD_TRUE_BURST === "true";
const startTeacherSession = process.env.SPEAKING_LOAD_START_SESSION === "true";
const teacherToken = process.env.SPEAKING_LOAD_TEACHER_TOKEN?.trim();
const configuredSessionId = process.env.SPEAKING_LOAD_SESSION_ID?.trim();
const requestTimeoutMs = Math.max(5_000, Number.parseInt(process.env.SPEAKING_LOAD_REQUEST_TIMEOUT_MS || "60000", 10) || 60_000);
const evaluationWaitMs = Math.max(5_000, Number.parseInt(process.env.SPEAKING_LOAD_EVALUATION_WAIT_MS || "30000", 10) || 30_000);

if (!joinCode) throw new Error("Set SPEAKING_LOAD_CODE to an open Speaking Practice session code.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values, fraction) => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
};
const statusCounts = (records) => records.reduce((counts, record) => {
  const key = String(record.status);
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});

const allRequests = [];
const request = async ({ phase, path, method = "GET", body, token, requestId, teacher = false, record = true }) => {
  const headers = new Headers();
  if (token) headers.set("X-Speaking-Token", token);
  if (requestId) headers.set("X-Speaking-Turn-Id", requestId);
  if (teacher && teacherToken) headers.set("Authorization", `Bearer ${teacherToken}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  const startedAt = performance.now();
  let status = 0;
  let data = {};
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    status = response.status;
    const text = await response.text();
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 160) }; }
  } catch (error) {
    data = { error: error instanceof Error ? error.name : "request failed" };
  } finally {
    clearTimeout(timeoutId);
  }
  const result = { phase, status, data, durationMs: Math.round(performance.now() - startedAt) };
  if (record) allRequests.push(result);
  return result;
};

const reportPhase = (phase, records, extra = {}) => {
  const latencies = records.map((record) => record.durationMs);
  const report = {
    phase,
    requests: records.length,
    statusCounts: statusCounts(records),
    successful: records.filter((record) => record.status >= 200 && record.status < 300).length,
    rateLimited429: records.filter((record) => record.status === 429).length,
    errorRate: records.length ? Number((records.filter((record) => record.status < 200 || record.status >= 400).length / records.length).toFixed(4)) : 0,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies.length ? Math.max(...latencies) : undefined
    },
    ...extra
  };
  console.log(JSON.stringify(report));
  return report;
};

const runBatch = async (phase, tasks) => {
  const records = await Promise.all(tasks.map((task) => task()));
  reportPhase(phase, records);
  return records;
};

const skipped = (phase, reason) => {
  console.log(JSON.stringify({ phase, skipped: true, reason }));
  return [];
};

const readWorkloadMetrics = async () => {
  if (!teacherToken) return undefined;
  const result = await request({ phase: "diagnostics", path: "/api/speaking/diagnostics/workload", teacher: true, record: false });
  return result.status === 200 && result.data?.metrics ? result.data.metrics : undefined;
};

const main = async () => {
  const memoryBefore = process.memoryUsage();
  console.log(JSON.stringify({ baseUrl, count, textMode, trueBurst, startTeacherSession, sharedIp: "127.0.0.1", note: "Run against a disposable classroom session; tokens stay in memory and are never printed." }));
  const workloadSamples = [];

  const joins = await runBatch("phase-1-join", Array.from({ length: count }, (_, index) => () => request({
    phase: "phase-1-join",
    path: "/api/speaking/join",
    method: "POST",
    body: { code: joinCode, identifier: `Load student ${index + 1}`, requestId: `load-join-${Date.now()}-${index + 1}` }
  })));
  const participants = joins
    .filter((result) => result.status === 201 && result.data?.participant?.id && result.data?.token)
    .map((result) => ({ id: result.data.participant.id, token: result.data.token, sessionId: result.data.session?.id }));
  const sessionId = configuredSessionId || participants[0]?.sessionId;
  const sample = await readWorkloadMetrics();
  if (sample) workloadSamples.push(sample);
  if (!sessionId || !participants.length) {
    skipped("phase-2-start", "No successful join supplied a session and participant token.");
    skipped("phase-3-turns", "No successful participants.");
    skipped("phase-4-help-mix", "No successful participants.");
    skipped("phase-5-finish-evaluation", "No successful participants.");
    console.log(JSON.stringify({ summary: { totalHttpRequests: allRequests.length, memory: { beforeRss: memoryBefore.rss, afterRss: process.memoryUsage().rss }, workload: workloadSamples.at(-1) || "not available" } }));
    process.exitCode = 1;
    return;
  }

  if (startTeacherSession && teacherToken) {
    const start = await request({ phase: "phase-2-teacher-start", path: `/api/speaking/sessions/${encodeURIComponent(sessionId)}/start-session`, method: "POST", teacher: true });
    console.log(JSON.stringify({ phase: "phase-2-teacher-start", status: start.status, latencyMs: start.durationMs }));
  }
  const starts = await runBatch("phase-2-start", participants.map((participant) => () => request({
    phase: "phase-2-start",
    path: `/api/speaking/sessions/${encodeURIComponent(sessionId)}/start`,
    method: "POST",
    token: participant.token
  })));
  const startSample = await readWorkloadMetrics();
  if (startSample) workloadSamples.push(startSample);

  let turnRecords = [];
  let duplicateRetrySuccesses = 0;
  let duplicatePairMismatches = 0;
  if (!textMode) {
    skipped("phase-3-turns", "Set SPEAKING_LOAD_TEXT=true; text input is a local/mock-only test mode and is not a real-provider claim.");
    skipped("phase-4-help-mix", "Set SPEAKING_LOAD_TEXT=true to run mixed text turns and Help requests.");
  } else {
    turnRecords = await runBatch("phase-3-turns", participants.map((participant, index) => () => sleep(trueBurst ? 0 : (index * 37) % 1_000).then(() => request({
      phase: "phase-3-turns",
      path: `/api/speaking/sessions/${encodeURIComponent(sessionId)}/turn`,
      method: "POST",
      token: participant.token,
      requestId: `load-turn-${index + 1}`,
      body: { text: `This is load-test answer ${index + 1}.` }
    }))));
    const duplicateCandidates = turnRecords
      .map((record, index) => ({ record, participant: participants[index] }))
      .filter((item) => item.record.status === 200)
      .slice(0, Math.min(5, participants.length));
    const duplicateRecords = await Promise.all(duplicateCandidates.map(({ participant }, index) => request({
      phase: "duplicate-turn-retry",
      path: `/api/speaking/sessions/${encodeURIComponent(sessionId)}/turn`,
      method: "POST",
      token: participant.token,
      requestId: `load-turn-${participants.indexOf(participant) + 1}`,
      body: { text: `This is load-test answer ${participants.indexOf(participant) + 1}.` },
      // The browser's request id is represented by the header in production;
      // this script records the retry count even when a deployment rejects
      // text input before it can reach idempotency.
      record: true
    })));
    reportPhase("duplicate-turn-retry", duplicateRecords, { duplicateTurnAttempts: duplicateRecords.length, duplicateTurnSuccesses: duplicateRecords.filter((record) => record.status === 200).length });
    duplicateRetrySuccesses = duplicateRecords.filter((record) => record.status === 200).length;
    duplicatePairMismatches = duplicateRecords.filter((record, index) => {
      const original = duplicateCandidates[index].record;
      return record.status !== 200 || record.data?.studentTurn?.id !== original.data?.studentTurn?.id || record.data?.aiTurn?.id !== original.data?.aiTurn?.id;
    }).length;
    const mixedRecords = await runBatch("phase-4-help-mix", participants.map((participant, index) => () => sleep(trueBurst ? 0 : (index * 53) % 1_000).then(() => index % 4 === 0
      ? request({ phase: "phase-4-help-mix", path: `/api/speaking/sessions/${encodeURIComponent(sessionId)}/help`, method: "POST", token: participant.token })
      : request({ phase: "phase-4-help-mix", path: `/api/speaking/sessions/${encodeURIComponent(sessionId)}/turn`, method: "POST", token: participant.token, requestId: `load-mixed-turn-${index + 1}`, body: { text: `A second mixed answer from student ${index + 1}.` } }))));
    const mixedSample = await readWorkloadMetrics();
    if (mixedSample) workloadSamples.push(mixedSample);
    void starts;
    void mixedRecords;
  }

  const finishes = await runBatch("phase-5-finish", participants.map((participant) => () => request({
    phase: "phase-5-finish",
    path: `/api/speaking/sessions/${encodeURIComponent(sessionId)}/finish`,
    method: "POST",
    token: participant.token
  })));
  const finishSample = await readWorkloadMetrics();
  if (finishSample) workloadSamples.push(finishSample);

  const pending = new Map(participants.map((participant) => [participant.id, participant]));
  const evaluationStartedAt = Date.now();
  let evaluationPolls = 0;
  while (pending.size && Date.now() - evaluationStartedAt < evaluationWaitMs) {
    evaluationPolls += 1;
    const results = await Promise.all([...pending.values()].map((participant) => request({
      phase: "phase-5-evaluation-poll",
      path: `/api/speaking/results/${encodeURIComponent(participant.id)}`,
      token: participant.token
    })));
    for (const result of results) {
      if (result.status === 200 && (result.data?.evaluationStatus === "completed" || result.data?.result?.evaluation)) {
        pending.delete(result.data.result.participant.id);
      }
    }
    if (pending.size) await sleep(1_000);
  }
  const evaluationPollRecords = allRequests.filter((record) => record.phase === "phase-5-evaluation-poll");
  reportPhase("phase-5-evaluation-poll", evaluationPollRecords, { evaluationPolls, evaluationCompleted: participants.length - pending.size, evaluationPending: pending.size });
  const endSample = await readWorkloadMetrics();
  if (endSample) workloadSamples.push(endSample);

  const finalMemory = process.memoryUsage();
  console.log(JSON.stringify({
    summary: {
      successfulJoins: joins.filter((record) => record.status === 201).length,
      join429s: joins.filter((record) => record.status === 429).length,
      successfulStarts: starts.filter((record) => record.status >= 200 && record.status < 300).length,
      successfulFinishes: finishes.filter((record) => record.status >= 200 && record.status < 300).length,
      duplicateRetrySuccesses,
      duplicatePairMismatches,
      evaluationCompleted: participants.length - pending.size,
      evaluationPending: pending.size,
      totalHttpRequests: allRequests.length,
      loadClientMemory: { beforeRss: memoryBefore.rss, afterRss: finalMemory.rss, beforeHeapUsed: memoryBefore.heapUsed, afterHeapUsed: finalMemory.heapUsed },
      serverMemory: "not measured",
      databaseLoad: "not measured",
      workload: workloadSamples.length ? workloadSamples.at(-1) : "not available (set SPEAKING_LOAD_TEACHER_TOKEN)",
      peakWorkload: workloadSamples.length ? {
        peakQueueDepth: Math.max(...workloadSamples.map((metrics) => metrics.peakQueueDepth || 0)),
        peakActive: Math.max(...workloadSamples.map((metrics) => metrics.peakActive || 0))
      } : "not available"
    }
  }));
  if (!textMode || participants.length !== count || pending.size || duplicatePairMismatches || allRequests.some((record) => record.status < 200 || record.status >= 300)) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Speaking classroom load failed.");
  process.exitCode = 1;
});
