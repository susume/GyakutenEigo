import {
  SpeakingEvaluationSchema,
  speakingFeedbackCopy,
  SPEAKING_PRACTICE_LANGUAGE,
  type SpeakingActivity,
  type SpeakingEvaluation,
  type SpeakingRubricCriterion,
  type SpeakingTurn
} from "@quizstrike/shared";
import { buildConversationPrompt, buildEvaluationPrompt, buildHelpPrompt } from "./speakingPrompts.js";

export interface TranscriptionInput {
  audio: Buffer;
  mimeType: string;
  languageHint?: string;
  /** Browser-side signal detection used only to make local mock audio honest. */
  speechDetected?: boolean;
  /** Only the explicit mock provider uses text input for contract tests. */
  text?: string;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
}

export interface TranscriptionProvider {
  /** Safe provider label for diagnostics. Custom test adapters may omit it. */
  providerName?: SpeakingProviderName;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export interface ConversationInput {
  activity: SpeakingActivity;
  turns: SpeakingTurn[];
  studentText: string;
  /** Prepared once by the route so prompt construction is measurable and not duplicated. */
  prompt?: string;
}

export interface ConversationProvider {
  respond(input: ConversationInput): Promise<string>;
}

export interface HelpProvider {
  hint(input: { activity: SpeakingActivity; turns: SpeakingTurn[]; latestStudentText?: string }): Promise<{ hint: string; english: string }>;
}

export interface EvaluationProvider {
  evaluate(input: {
    activity: SpeakingActivity;
    turns: SpeakingTurn[];
    participantId: string;
    timingMetadata?: { startedAt?: string; finishedAt?: string; durationSeconds?: number };
    helpMetadata?: { helpCount: number; helpedTurnCount: number };
  }): Promise<SpeakingEvaluation>;
}

export type SpeakingProviderOperation = "transcription" | "conversation" | "help" | "evaluation";
export type SpeakingProviderName = "mock" | "openai" | "gemini";
export type SpeakingProviderFailureKind = "timeout" | "rate_limit" | "authentication" | "bad_request" | "unavailable" | "network" | "invalid_response" | "unknown";

export class SpeakingProviderError extends Error {
  readonly failureKind: SpeakingProviderFailureKind;
  readonly status?: number;

  constructor(message: string, failureKind: SpeakingProviderFailureKind, status?: number) {
    super(message);
    this.name = "SpeakingProviderError";
    this.failureKind = failureKind;
    this.status = status;
  }
}

export const speakingProviderFailureDetails = (error: unknown): { kind: SpeakingProviderFailureKind; status?: number } =>
  error instanceof SpeakingProviderError
    ? { kind: error.failureKind, ...(error.status === undefined ? {} : { status: error.status }) }
    : { kind: "unknown" };

const failureKindForStatus = (status: number): SpeakingProviderFailureKind => {
  if (status === 401 || status === 403) return "authentication";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "unavailable";
  if (status >= 400) return "bad_request";
  return "unknown";
};

const providerHttpError = (provider: SpeakingProviderName, operation: SpeakingProviderOperation, status: number, message?: string) =>
  new SpeakingProviderError(message?.trim() || `${provider} ${operation} failed with ${status}.`, failureKindForStatus(status), status);

const DEFAULT_PROVIDER_TIMEOUTS_MS: Record<SpeakingProviderOperation, number> = {
  // These are deliberately bounded, but leave enough room for a classroom
  // tablet on an ordinary school network. A turn still has a separate timeout
  // for transcription and conversation, so no provider can wait indefinitely.
  transcription: 15_000,
  conversation: 12_000,
  help: 12_000,
  evaluation: 30_000
};

const providerTimeoutEnvironmentKey: Record<SpeakingProviderOperation, keyof NodeJS.ProcessEnv> = {
  transcription: "SPEAKING_TRANSCRIPTION_TIMEOUT_MS",
  conversation: "SPEAKING_CONVERSATION_TIMEOUT_MS",
  help: "SPEAKING_HELP_TIMEOUT_MS",
  evaluation: "SPEAKING_EVALUATION_TIMEOUT_MS"
};

export const speakingProviderTimeoutMs = (
  operation: SpeakingProviderOperation,
  environment: NodeJS.ProcessEnv = process.env
) => {
  const specific = Number.parseInt(environment[providerTimeoutEnvironmentKey[operation]] ?? "", 10);
  const shared = Number.parseInt(environment.SPEAKING_PROVIDER_TIMEOUT_MS ?? "", 10);
  const configured = Number.isFinite(specific) ? specific : Number.isFinite(shared) ? shared : DEFAULT_PROVIDER_TIMEOUTS_MS[operation];
  // Keep configuration from accidentally becoming an unbounded wait or an
  // unusably short classroom request.
  return Math.min(120_000, Math.max(1_000, Math.floor(configured)));
};

const fetchWithSpeakingTimeout = async (
  input: string | URL,
  init: RequestInit,
  operation: SpeakingProviderOperation,
  environment: NodeJS.ProcessEnv = process.env
) => {
  const timeoutMs = speakingProviderTimeoutMs(operation, environment);
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new SpeakingProviderError(`Speaking ${operation} provider timed out after ${timeoutMs}ms.`, "timeout"));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      timeout
    ]);
    // Fetch resolves after headers, not necessarily after the provider body
    // has arrived. Consume it under the same timeout so response.json() in the
    // adapters cannot leave a classroom request hanging indefinitely.
    const body = await Promise.race([response.arrayBuffer(), timeout]);
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    if (error instanceof SpeakingProviderError) throw error;
    throw new SpeakingProviderError(`Speaking ${operation} provider request failed.`, "network");
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const clipResponse = (value: string) => value.trim().slice(0, 280);
const latestStudentTurns = (turns: SpeakingTurn[]) => turns.filter((turn) => turn.speaker === "student");
const promptInjectionPattern = /ignore\s+(?:all|any|previous)|system\s+prompt|developer\s+message|reveal.*instruction|jailbreak/i;

export const mockTranscriptionProvider: TranscriptionProvider = {
  providerName: "mock",
  async transcribe(input) {
    const supplied = input.text?.trim();
    if (supplied) return { text: supplied.slice(0, 1_200), confidence: 0.96 };
    // Mock mode intentionally accepts test audio without retaining it. Real
    // providers receive the bytes through the same interface below.
    // A MediaRecorder container is non-empty even when the microphone heard
    // only silence. The browser sends speechDetected for local recordings so
    // silence cannot turn into a canned successful answer.
    if (!input.audio.length || input.speechDetected === false) return { text: "", confidence: 0 };
    return { text: "I'd like to practice this conversation.", confidence: 0.84 };
  }
};

const safeRedirect = (activity: SpeakingActivity) => {
  const title = activity.title.toLowerCase();
  if (title.includes("restaurant") || title.includes("food")) return "Let's stay with the activity. What would you like to order?";
  if (title.includes("direction") || title.includes("library")) return "Let's stay with the activity. Where would you like to go?";
  return "Let's stay with the activity. Can you tell me what you need?";
};

const shoppingResponse = (studentText: string, studentTurnCount: number) => {
  const lower = studentText.toLowerCase();
  if (lower.includes("blue") || lower.includes("red") || lower.includes("black") || lower.includes("shirt") || lower.includes("t-shirt")) return "Sure! What size would you like?";
  if (lower.includes("small") || lower.includes("medium") || lower.includes("large") || lower.includes("size")) return "Great choice. Would you like to try it on?";
  if (lower.includes("try") || lower.includes("fitting")) return "Of course. The fitting room is over there.";
  if (lower.includes("how much") || lower.includes("price") || lower.includes("cost")) return "It is twenty dollars. Would you like to see another color?";
  return studentTurnCount > 1 ? "That sounds good. Is there anything else you would like?" : "Sure! What are you looking for today?";
};

const scenarioResponse = (activity: SpeakingActivity, studentText: string, studentTurnCount: number) => {
  const title = activity.title.toLowerCase();
  if (title.includes("restaurant") || title.includes("food")) {
    const lower = studentText.toLowerCase();
    if (lower.includes("drink") || lower.includes("water")) return "Sure. Would you like anything to eat?";
    if (lower.includes("burger") || lower.includes("pizza") || lower.includes("order") || lower.includes("like")) return "Great. Would you like a drink with that?";
    return studentTurnCount > 1 ? "Thank you. Is that all for today?" : "Hello! What would you like to order?";
  }
  if (title.includes("direction") || title.includes("library")) return studentText.toLowerCase().includes("thank") ? "You are welcome. Have a nice day!" : "Go straight and turn left. Is that clear?";
  if (title.includes("hobb")) return studentTurnCount > 1 ? "That sounds fun! When do you do it?" : "Nice! What do you like to do in your free time?";
  if (title.includes("weekend")) return "That sounds fun. What will you do on Sunday?";
  if (title.includes("introduction")) return "Nice to meet you! What do you like?";
  return studentTurnCount > 1 ? "Thanks for telling me. Can you say a little more?" : "Hi! Can you tell me more?";
};

export const mockConversationProvider: ConversationProvider = {
  async respond(input) {
    if (promptInjectionPattern.test(input.studentText)) return safeRedirect(input.activity);
    const count = latestStudentTurns(input.turns).length;
    return clipResponse(input.activity.title.toLowerCase().includes("shopping") || input.activity.title.toLowerCase().includes("clothes") || input.activity.title.toLowerCase().includes("t-shirt")
      ? shoppingResponse(input.studentText, count)
      : scenarioResponse(input.activity, input.studentText, count));
  }
};

export const mockHelpProvider: HelpProvider = {
  async hint(input) {
    void buildHelpPrompt(input);
    const recentAi = [...input.turns].reverse().find((turn) => turn.speaker === "ai")?.text.toLowerCase() ?? "";
    const expressions = input.activity.targetExpressions;
    const selected = recentAi.includes("size")
      ? expressions.find((item) => /size|medium|small|large/i.test(item)) ?? "What size would you like?"
      : recentAi.includes("price") || recentAi.includes("much") || recentAi.includes("cost")
        ? expressions.find((item) => /price|much|cost/i.test(item)) ?? "How much is it?"
        : recentAi.includes("order") || recentAi.includes("eat")
          ? expressions.find((item) => /order|like|have/i.test(item)) ?? "I'd like..."
          : undefined;
    const english = selected ?? expressions[input.turns.filter((turn) => turn.speaker === "student").length % Math.max(1, expressions.length)] ?? "I'd like...";
    return input.activity.nativeLanguage === "en"
      ? { hint: "Use one short sentence, then ask the other person a question.", english }
      : { hint: "相手の質問に、短い英語で答えてみよう。", english };
  }
};

const mockReason = (criterion: SpeakingRubricCriterion, studentTurnCount: number, helpCount: number, language: SpeakingActivity["nativeLanguage"]) => {
  const japanese = language === "ja";
  if (criterion.id === "communication") return studentTurnCount > 0 ? (japanese ? "言いたいことを英語で伝えようとできました。" : "You tried to communicate your idea in English.") : (japanese ? "まだ英語で伝える場面がありませんでした。" : "There was not enough speech to show this skill.");
  if (criterion.id === "interaction") return studentTurnCount > 1 ? (japanese ? "相手の質問に答えて、会話を続けられました。" : "You responded and kept the conversation moving.") : (japanese ? "次は相手の質問に答えてみましょう。" : "Next time, try responding to the other person's question.");
  if (criterion.id === "vocabulary") return studentTurnCount > 0 ? (japanese ? "場面に合う英語の言葉を使えました。" : "You used words that fit the situation.") : (japanese ? "場面に合う英語を1つ使ってみましょう。" : "Try one English expression that fits the situation.");
  if (criterion.id === "grammar") return studentTurnCount > 0 ? (japanese ? "少し直すところがあっても、意味は伝わりました。" : "Your sentences communicated the meaning, even with small fixes to make.") : (japanese ? "短い文から練習してみましょう。" : "Start with one short sentence.");
  if (criterion.id !== "fluency") return studentTurnCount > 0 ? (japanese ? "この活動に合う英語を使って、課題に取り組めました。" : "You used English that fit this activity.") : (japanese ? "この活動に合う英語を1つ使ってみましょう。" : "Try one expression that fits this activity.");
  return helpCount > 0
    ? (japanese ? "ヒントを使いながら、最後まで話そうとできました。" : "You kept trying, even with support.")
    : (japanese ? "ゆっくりでも、最後まで話そうとできました。" : "You kept trying to speak clearly.");
};

export const mockEvaluationProvider: EvaluationProvider = {
  async evaluate(input) {
    void buildEvaluationPrompt({ activity: input.activity, turns: input.turns, rubric: input.activity.rubric, timingMetadata: input.timingMetadata, helpMetadata: input.helpMetadata });
    const studentTurns = latestStudentTurns(input.turns);
    const scores: Record<string, number | null> = {};
    const evidence: Record<string, string> = {};
    const noSpeech = studentTurns.length === 0;
    const copy = speakingFeedbackCopy(input.activity.nativeLanguage);
    const helpCount = input.helpMetadata?.helpCount ?? input.turns.filter((turn) => turn.usedHelp).length;
    for (const criterion of input.activity.rubric.filter((item) => item.enabled)) {
      scores[criterion.id] = noSpeech ? null : Math.min(4, Math.max(1, studentTurns.length >= 2 ? 4 : 3));
      evidence[criterion.id] = noSpeech ? copy.insufficientEvidenceReason : mockReason(criterion, studentTurns.length, helpCount, input.activity.nativeLanguage);
    }
    const evaluation: SpeakingEvaluation = {
      participantId: input.participantId,
      language: input.activity.nativeLanguage,
      assessmentStatus: noSpeech ? "insufficient_evidence" : "scored",
      ...(noSpeech ? { notScoredReason: copy.insufficientEvidenceReason } : {}),
      scores,
      evidence,
      strengths: noSpeech
        ? [copy.insufficientEvidenceStrength]
        : [copy.scoredSummary, copy.tryNext],
      improvements: noSpeech
        ? [copy.insufficientEvidenceImprovement]
        : [copy.tryNext],
      usefulEnglish: studentTurns.length > 0 ? [{ said: studentTurns[0]!.text, try: input.activity.targetExpressions[0] ?? "I'd like..." }] : [],
      overallMessage: noSpeech
        ? copy.insufficientEvidenceMessage
        : `${copy.scoredHeadline} ${copy.scoredSummary}`,
      createdAt: new Date().toISOString()
    };
    const parsed = SpeakingEvaluationSchema.safeParse(evaluation);
    if (!parsed.success) throw new Error("Mock evaluation did not match the speaking evaluation schema.");
    return parsed.data;
  }
};

const openAiKey = (environment: NodeJS.ProcessEnv = process.env) => environment.OPENAI_API_KEY?.trim() || environment.SPEAKING_OPENAI_API_KEY?.trim();
const openAiModel = (environment: NodeJS.ProcessEnv = process.env) => environment.SPEAKING_OPENAI_MODEL?.trim() || "gpt-4o-mini";

const openAiRequest = async (
  body: Record<string, unknown>,
  environment: NodeJS.ProcessEnv = process.env,
  operation: SpeakingProviderOperation = "conversation"
) => {
  const apiKey = openAiKey(environment);
  if (!apiKey) throw new Error("OpenAI Speaking providers require OPENAI_API_KEY or SPEAKING_OPENAI_API_KEY.");
  const response = await fetchWithSpeakingTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: openAiModel(environment), ...body })
  }, operation, environment);
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> };
  if (!response.ok) throw providerHttpError("openai", operation, response.status, payload.error?.message);
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new SpeakingProviderError("OpenAI returned an empty Speaking response.", "invalid_response");
  return content;
};

const geminiKey = (environment: NodeJS.ProcessEnv = process.env) => environment.GEMINI_API_KEY?.trim() || environment.SPEAKING_GEMINI_API_KEY?.trim();
const geminiModel = (environment: NodeJS.ProcessEnv = process.env) => environment.SPEAKING_GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
const geminiTranscriptionModel = (environment: NodeJS.ProcessEnv = process.env) => {
  const configured = environment.SPEAKING_GEMINI_TRANSCRIPTION_MODEL?.trim();
  // Migrate the former documented default automatically. It is a general
  // multimodal generation model, not Google's dedicated speech-to-text model.
  return !configured || configured === "gemini-2.5-flash-lite" ? "gemini-3.5-transcribe" : configured;
};

type GeminiResponsePayload = {
  error?: { message?: string };
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

const geminiRequest = async (
  model: string,
  body: Record<string, unknown>,
  environment: NodeJS.ProcessEnv = process.env,
  operation: SpeakingProviderOperation = "conversation"
) => {
  const apiKey = geminiKey(environment);
  if (!apiKey) throw new Error("Gemini Speaking providers require GEMINI_API_KEY or SPEAKING_GEMINI_API_KEY.");
  const response = await fetchWithSpeakingTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, operation, environment);
  const payload = await response.json().catch(() => ({})) as GeminiResponsePayload;
  if (!response.ok) throw providerHttpError("gemini", operation, response.status, payload.error?.message);
  const content = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
  if (!content) throw new SpeakingProviderError("Gemini returned an empty Speaking response.", "invalid_response");
  return content;
};

const normalizeAudioMimeType = (mimeType: string) => mimeType.split(";", 1)[0]?.trim() || "audio/webm";
const openAiTranscriptionModel = (environment: NodeJS.ProcessEnv = process.env) => environment.SPEAKING_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe";
const parseJsonResponse = <T>(raw: string): T => {
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? raw;
  return JSON.parse(fenced.trim()) as T;
};

export const openAiTranscriptionProvider: TranscriptionProvider = {
  providerName: "openai",
  async transcribe(input) {
    if (!input.audio.length) return { text: "", confidence: 0 };
    const form = new FormData();
    const audioBytes = new Uint8Array(input.audio.byteLength);
    audioBytes.set(input.audio);
    form.append("file", new Blob([audioBytes.buffer], { type: input.mimeType }), "speaking-audio");
    form.append("model", openAiTranscriptionModel());
    form.append("language", SPEAKING_PRACTICE_LANGUAGE);
    const apiKey = openAiKey();
    if (!apiKey) throw new Error("OpenAI transcription requires OPENAI_API_KEY or SPEAKING_OPENAI_API_KEY.");
    const response = await fetchWithSpeakingTimeout("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form }, "transcription");
    const payload = await response.json().catch(() => ({})) as { text?: string; error?: { message?: string } };
    if (!response.ok) throw providerHttpError("openai", "transcription", response.status, payload.error?.message);
    return { text: payload.text?.trim() ?? "" };
  }
};

export const openAiConversationProvider: ConversationProvider = {
  async respond(input) {
    const content = await openAiRequest({
      temperature: 0.4,
      max_tokens: 100,
      messages: [{ role: "system", content: input.prompt ?? buildConversationPrompt({ activity: input.activity, turns: input.turns, latestStudentText: input.studentText }) }]
    });
    return clipResponse(content);
  }
};

const helpSchema = { type: "object", additionalProperties: false, properties: { hint: { type: "string" }, english: { type: "string" } }, required: ["hint", "english"] };

export const openAiHelpProvider: HelpProvider = {
  async hint(input) {
    const raw = await openAiRequest({
      temperature: 0.3,
      max_tokens: 100,
      response_format: { type: "json_schema", json_schema: { name: "speaking_help", strict: true, schema: helpSchema } },
      messages: [{ role: "system", content: buildHelpPrompt(input) }]
    }, process.env, "help");
    const parsed = JSON.parse(raw) as { hint?: unknown; english?: unknown };
    if (typeof parsed.hint !== "string" || typeof parsed.english !== "string" || !parsed.hint.trim() || !parsed.english.trim()) throw new Error("Help provider returned invalid structured data.");
    return { hint: parsed.hint.trim().slice(0, 300), english: parsed.english.trim().slice(0, 160) };
  }
};

const evaluationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scores: { type: "object", additionalProperties: { anyOf: [{ type: "integer", minimum: 1, maximum: 4 }, { type: "null" }] } },
    evidence: { type: "object", additionalProperties: { type: "string" } },
    strengths: { type: "array", items: { type: "string" }, maxItems: 5 },
    improvements: { type: "array", items: { type: "string" }, maxItems: 5 },
    usefulEnglish: { type: "array", items: { type: "object", additionalProperties: false, properties: { said: { type: "string" }, try: { type: "string" } }, required: ["said", "try"] }, maxItems: 5 },
    overallMessage: { type: "string" }
  },
  required: ["scores", "evidence", "strengths", "improvements", "usefulEnglish", "overallMessage"]
};

export const openAiEvaluationProvider: EvaluationProvider = {
  async evaluate(input) {
    const raw = await openAiRequest({
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: "json_schema", json_schema: { name: "speaking_evaluation", strict: true, schema: evaluationSchema } },
      messages: [{ role: "system", content: buildEvaluationPrompt({ activity: input.activity, turns: input.turns, rubric: input.activity.rubric, timingMetadata: input.timingMetadata, helpMetadata: input.helpMetadata }) }]
    }, process.env, "evaluation");
    const output = JSON.parse(raw) as Omit<SpeakingEvaluation, "participantId" | "language" | "createdAt">;
    const assessmentStatus = Object.values(output.scores).some((score) => typeof score === "number") ? "scored" : "insufficient_evidence";
    const evaluation = { ...output, assessmentStatus, participantId: input.participantId, language: input.activity.nativeLanguage, createdAt: new Date().toISOString() };
    const parsed = SpeakingEvaluationSchema.safeParse(evaluation);
    if (!parsed.success) throw new Error("Evaluation provider returned invalid structured data.");
    return parsed.data;
  }
};

export const geminiTranscriptionProvider: TranscriptionProvider = {
  providerName: "gemini",
  async transcribe(input) {
    if (!input.audio.length) return { text: "", confidence: 0 };
    const apiKey = geminiKey();
    if (!apiKey) throw new Error("Gemini transcription requires GEMINI_API_KEY or SPEAKING_GEMINI_API_KEY.");
    const response = await fetchWithSpeakingTimeout("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: geminiTranscriptionModel(),
        input: [{
          type: "audio",
          data: input.audio.toString("base64"),
          mime_type: normalizeAudioMimeType(input.mimeType)
        }],
        generation_config: {
          transcription_config: {
            language_codes: [SPEAKING_PRACTICE_LANGUAGE],
            mode: { type: "verbatim" }
          }
        },
        store: false
      })
    }, "transcription");
    const payload = await response.json().catch(() => ({})) as {
      error?: { message?: string };
      errors?: Array<{ message?: string }>;
      status?: string;
      output_text?: string;
      steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    if (!response.ok) throw providerHttpError("gemini", "transcription", response.status, payload.error?.message);
    if (payload.status === "failed") throw new SpeakingProviderError(payload.errors?.[0]?.message ?? "Gemini transcription failed.", "unavailable");
    const modelOutput = payload.steps?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((content) => content.type === "text")
      .map((content) => content.text ?? "")
      .join("")
      .trim();
    const text = payload.output_text?.trim() || modelOutput || "";
    if (!payload.steps && payload.output_text === undefined) throw new SpeakingProviderError("Gemini transcription returned an invalid response.", "invalid_response");
    return { text: text.slice(0, 1_200) };
  }
};

export const geminiConversationProvider: ConversationProvider = {
  async respond(input) {
    const content = await geminiRequest(geminiModel(), {
      system_instruction: { parts: [{ text: input.prompt ?? buildConversationPrompt({ activity: input.activity, turns: input.turns, latestStudentText: input.studentText }) }] },
      contents: [{ role: "user", parts: [{ text: "Reply to the latest student turn as the speaking partner." }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 100 }
    });
    return clipResponse(content);
  }
};

export const geminiHelpProvider: HelpProvider = {
  async hint(input) {
    const raw = await geminiRequest(geminiModel(), {
      system_instruction: { parts: [{ text: buildHelpPrompt(input) }] },
      contents: [{ role: "user", parts: [{ text: "Return only a JSON object with exactly two string fields: hint and english." }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 100, responseMimeType: "application/json" }
    }, process.env, "help");
    const parsed = parseJsonResponse<{ hint?: unknown; english?: unknown }>(raw);
    if (typeof parsed.hint !== "string" || typeof parsed.english !== "string" || !parsed.hint.trim() || !parsed.english.trim()) throw new Error("Gemini Help provider returned invalid structured data.");
    return { hint: parsed.hint.trim().slice(0, 300), english: parsed.english.trim().slice(0, 160) };
  }
};

export const geminiEvaluationProvider: EvaluationProvider = {
  async evaluate(input) {
    const raw = await geminiRequest(geminiModel(), {
      system_instruction: {
        parts: [{
          text: [
            buildEvaluationPrompt({ activity: input.activity, turns: input.turns, rubric: input.activity.rubric, timingMetadata: input.timingMetadata, helpMetadata: input.helpMetadata }),
            "Return only valid JSON with exactly these fields: scores, evidence, strengths, improvements, usefulEnglish, and overallMessage.",
            "scores must contain only enabled rubric IDs with an integer from 1 to 4 or null. evidence must contain one short string for every score. usefulEnglish must be an array of objects with said and try strings."
          ].join("\n")
        }]
      },
      contents: [{ role: "user", parts: [{ text: "Return the completed evaluation as JSON only." }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 900, responseMimeType: "application/json" }
    }, process.env, "evaluation");
    const output = parseJsonResponse<Omit<SpeakingEvaluation, "participantId" | "language" | "createdAt">>(raw);
    const assessmentStatus = Object.values(output.scores).some((score) => typeof score === "number") ? "scored" : "insufficient_evidence";
    const evaluation = { ...output, assessmentStatus, participantId: input.participantId, language: input.activity.nativeLanguage, createdAt: new Date().toISOString() };
    const parsed = SpeakingEvaluationSchema.safeParse(evaluation);
    if (!parsed.success) throw new Error("Gemini Evaluation provider returned invalid structured data.");
    return parsed.data;
  }
};

export type SpeakingProviderRegistry = {
  transcription: TranscriptionProvider;
  conversation: ConversationProvider;
  help: HelpProvider;
  evaluation: EvaluationProvider;
};

export const createSpeakingProviders = (environment: NodeJS.ProcessEnv = process.env): SpeakingProviderRegistry => {
  const explicitMockMode = environment.SPEAKING_MOCK_MODE?.trim().toLowerCase() === "true";
  const production = environment.NODE_ENV?.trim().toLowerCase() === "production";
  const configuredAiMode = environment.SPEAKING_AI_PROVIDER?.trim().toLowerCase();
  const configuredTranscriptionMode = environment.SPEAKING_TRANSCRIPTION_PROVIDER?.trim().toLowerCase();
  if (!explicitMockMode && production && (!configuredAiMode || !configuredTranscriptionMode)) {
    throw new Error("Production Speaking requires SPEAKING_AI_PROVIDER and SPEAKING_TRANSCRIPTION_PROVIDER, or an explicit SPEAKING_MOCK_MODE=true override.");
  }
  const mockMode = explicitMockMode || (!production && !configuredAiMode && !configuredTranscriptionMode);
  const aiMode = mockMode ? "mock" : configuredAiMode || "mock";
  const transcriptionMode = mockMode ? "mock" : configuredTranscriptionMode || "mock";
  if (aiMode !== "mock" && aiMode !== "openai" && aiMode !== "gemini") throw new Error(`Unsupported SPEAKING_AI_PROVIDER: ${aiMode}.`);
  if (transcriptionMode !== "mock" && transcriptionMode !== "openai" && transcriptionMode !== "gemini") throw new Error(`Unsupported SPEAKING_TRANSCRIPTION_PROVIDER: ${transcriptionMode}.`);
  if ((aiMode === "openai" || transcriptionMode === "openai") && !openAiKey(environment)) throw new Error("Speaking OpenAI mode requires OPENAI_API_KEY or SPEAKING_OPENAI_API_KEY.");
  if ((aiMode === "gemini" || transcriptionMode === "gemini") && !geminiKey(environment)) throw new Error("Speaking Gemini mode requires GEMINI_API_KEY or SPEAKING_GEMINI_API_KEY.");
  return {
    transcription: transcriptionMode === "openai" ? openAiTranscriptionProvider : transcriptionMode === "gemini" ? geminiTranscriptionProvider : mockTranscriptionProvider,
    conversation: aiMode === "openai" ? openAiConversationProvider : aiMode === "gemini" ? geminiConversationProvider : mockConversationProvider,
    help: aiMode === "openai" ? openAiHelpProvider : aiMode === "gemini" ? geminiHelpProvider : mockHelpProvider,
    evaluation: aiMode === "openai" ? openAiEvaluationProvider : aiMode === "gemini" ? geminiEvaluationProvider : mockEvaluationProvider
  };
};
