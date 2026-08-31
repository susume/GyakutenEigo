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
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export interface ConversationProvider {
  respond(input: { activity: SpeakingActivity; turns: SpeakingTurn[]; studentText: string }): Promise<string>;
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

const clipResponse = (value: string) => value.trim().slice(0, 280);
const latestStudentTurns = (turns: SpeakingTurn[]) => turns.filter((turn) => turn.speaker === "student");
const promptInjectionPattern = /ignore\s+(?:all|any|previous)|system\s+prompt|developer\s+message|reveal.*instruction|jailbreak/i;

export const mockTranscriptionProvider: TranscriptionProvider = {
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
    void buildConversationPrompt({ activity: input.activity, turns: input.turns, latestStudentText: input.studentText });
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

const openAiRequest = async (body: Record<string, unknown>, environment: NodeJS.ProcessEnv = process.env) => {
  const apiKey = openAiKey(environment);
  if (!apiKey) throw new Error("OpenAI Speaking providers require OPENAI_API_KEY or SPEAKING_OPENAI_API_KEY.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: openAiModel(environment), ...body })
  });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> };
  if (!response.ok) throw new Error(payload.error?.message ?? `OpenAI request failed with ${response.status}.`);
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty Speaking response.");
  return content;
};

export const openAiTranscriptionProvider: TranscriptionProvider = {
  async transcribe(input) {
    if (!input.audio.length) return { text: "", confidence: 0 };
    const form = new FormData();
    const audioBytes = new Uint8Array(input.audio.byteLength);
    audioBytes.set(input.audio);
    form.append("file", new Blob([audioBytes.buffer], { type: input.mimeType }), "speaking-audio");
    form.append("model", process.env.SPEAKING_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe");
    form.append("language", SPEAKING_PRACTICE_LANGUAGE);
    const apiKey = openAiKey();
    if (!apiKey) throw new Error("OpenAI transcription requires OPENAI_API_KEY or SPEAKING_OPENAI_API_KEY.");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    const payload = await response.json().catch(() => ({})) as { text?: string; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? `OpenAI transcription failed with ${response.status}.`);
    return { text: payload.text?.trim() ?? "" };
  }
};

export const openAiConversationProvider: ConversationProvider = {
  async respond(input) {
    const content = await openAiRequest({
      temperature: 0.4,
      max_tokens: 100,
      messages: [{ role: "system", content: buildConversationPrompt({ activity: input.activity, turns: input.turns, latestStudentText: input.studentText }) }]
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
    });
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
    });
    const output = JSON.parse(raw) as Omit<SpeakingEvaluation, "participantId" | "language" | "createdAt">;
    const assessmentStatus = Object.values(output.scores).some((score) => typeof score === "number") ? "scored" : "insufficient_evidence";
    const evaluation = { ...output, assessmentStatus, participantId: input.participantId, language: input.activity.nativeLanguage, createdAt: new Date().toISOString() };
    const parsed = SpeakingEvaluationSchema.safeParse(evaluation);
    if (!parsed.success) throw new Error("Evaluation provider returned invalid structured data.");
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
  if (aiMode !== "mock" && aiMode !== "openai") throw new Error(`Unsupported SPEAKING_AI_PROVIDER: ${aiMode}.`);
  if (transcriptionMode !== "mock" && transcriptionMode !== "openai") throw new Error(`Unsupported SPEAKING_TRANSCRIPTION_PROVIDER: ${transcriptionMode}.`);
  if ((aiMode === "openai" || transcriptionMode === "openai") && !openAiKey(environment)) throw new Error("Speaking OpenAI mode requires OPENAI_API_KEY or SPEAKING_OPENAI_API_KEY.");
  return {
    transcription: transcriptionMode === "openai" ? openAiTranscriptionProvider : mockTranscriptionProvider,
    conversation: aiMode === "openai" ? openAiConversationProvider : mockConversationProvider,
    help: aiMode === "openai" ? openAiHelpProvider : mockHelpProvider,
    evaluation: aiMode === "openai" ? openAiEvaluationProvider : mockEvaluationProvider
  };
};
