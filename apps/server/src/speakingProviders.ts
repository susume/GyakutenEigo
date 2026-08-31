import {
  SpeakingEvaluationSchema,
  type SpeakingActivity,
  type SpeakingEvaluation,
  type SpeakingRubricCriterion,
  type SpeakingTurn
} from "@quizstrike/shared";
import { buildConversationPrompt, buildEvaluationPrompt, buildHelpPrompt } from "./speakingPrompts.js";

export interface TranscriptionResult {
  text: string;
  confidence: number;
}

export interface ConversationProvider {
  respond(input: { activity: SpeakingActivity; turns: SpeakingTurn[]; studentText: string }): Promise<string>;
}

export interface EvaluationProvider {
  evaluate(input: { activity: SpeakingActivity; turns: SpeakingTurn[]; participantId: string }): Promise<SpeakingEvaluation>;
}

const clipResponse = (value: string) => value.trim().slice(0, 280);

export const mockTranscriptionProvider = {
  async transcribe(input: { text?: string; hasAudio?: boolean }): Promise<TranscriptionResult> {
    const supplied = input.text?.trim();
    if (supplied) return { text: supplied.slice(0, 1_200), confidence: 0.96 };
    // A server-side mock keeps audio submissions testable without storing raw audio.
    return { text: input.hasAudio ? "I'd like to practice this conversation." : "", confidence: input.hasAudio ? 0.84 : 0 };
  }
};

const latestStudentTurns = (turns: SpeakingTurn[]) => turns.filter((turn) => turn.speaker === "student");

const promptInjectionPattern = /ignore\s+(?:all|any|previous)|system\s+prompt|developer\s+message|reveal.*instruction|jailbreak/i;

const safeRedirect = (activity: SpeakingActivity) => {
  const title = activity.title.toLowerCase();
  if (title.includes("restaurant") || title.includes("food")) return "Let's stay with the activity. What would you like to order?";
  if (title.includes("direction") || title.includes("library")) return "Let's stay with the activity. Where would you like to go?";
  return "Let's stay with the activity. Can you tell me what you need?";
};

const shoppingResponse = (studentText: string, studentTurnCount: number) => {
  const lower = studentText.toLowerCase();
  if (lower.includes("blue") || lower.includes("red") || lower.includes("black") || lower.includes("shirt") || lower.includes("t-shirt")) {
    return "Sure! What size would you like?";
  }
  if (lower.includes("small") || lower.includes("medium") || lower.includes("large") || lower.includes("size")) {
    return "Great choice. Would you like to try it on?";
  }
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
  if (title.includes("direction") || title.includes("library")) {
    if (studentText.toLowerCase().includes("thank")) return "You are welcome. Have a nice day!";
    return "Go straight and turn left. Is that clear?";
  }
  if (title.includes("hobb")) return studentTurnCount > 1 ? "That sounds fun! When do you do it?" : "Nice! What do you like to do in your free time?";
  if (title.includes("weekend")) return "That sounds fun. What will you do on Sunday?";
  if (title.includes("introduction")) return "Nice to meet you! What do you like?";
  return studentTurnCount > 1 ? "Thanks for telling me. Can you say a little more?" : "Hi! Can you tell me more?";
};

export const mockConversationProvider: ConversationProvider = {
  async respond(input) {
    // Keep prompt construction behind the provider boundary so a production
    // adapter can send the same structured context without touching React.
    void buildConversationPrompt({ activity: input.activity, turns: input.turns, latestStudentText: input.studentText });
    if (promptInjectionPattern.test(input.studentText)) return safeRedirect(input.activity);
    return clipResponse(
      input.activity.title.toLowerCase().includes("shopping") || input.activity.title.toLowerCase().includes("clothes") || input.activity.title.toLowerCase().includes("t-shirt")
        ? shoppingResponse(input.studentText, latestStudentTurns(input.turns).length)
        : scenarioResponse(input.activity, input.studentText, latestStudentTurns(input.turns).length)
    );
  }
};

export const mockHelpProvider = {
  async hint(input: { activity: SpeakingActivity; latestStudentText?: string }) {
    void buildHelpPrompt(input);
    const firstExpression = input.activity.targetExpressions[0] ?? "I'd like...";
    if (input.activity.nativeLanguage === "en") return { hint: "Use one short sentence, then ask the other person a question.", english: firstExpression };
    return { hint: "言いたいことを短い文で言ってみよう。", english: firstExpression };
  }
};

const mockReason = (criterion: SpeakingRubricCriterion, studentTurnCount: number, helpCount: number) => {
  if (criterion.id === "communication") return studentTurnCount > 0 ? "言いたいことを英語で伝えようとできました。" : "まだ英語で伝える場面がありませんでした。";
  if (criterion.id === "interaction") return studentTurnCount > 1 ? "相手の質問に答えて、会話を続けられました。" : "次は相手の質問に答えてみましょう。";
  if (criterion.id === "vocabulary") return studentTurnCount > 0 ? "場面に合う英語の言葉を使えました。" : "場面に合う英語を1つ使ってみましょう。";
  if (criterion.id === "grammar") return studentTurnCount > 0 ? "少し直すところはあっても、意味は伝わりました。" : "短い文から練習してみましょう。";
  return helpCount > 0 ? "ヒントを使いながら、最後まで話そうとできました。" : "ゆっくりでも、最後まで話そうとできました。";
};

export const mockEvaluationProvider: EvaluationProvider = {
  async evaluate(input) {
    void buildEvaluationPrompt({ activity: input.activity, turns: input.turns, rubric: input.activity.rubric });
    const studentTurns = latestStudentTurns(input.turns);
    const scores: Record<string, number> = {};
    const evidence: Record<string, string> = {};
    const noSpeech = studentTurns.length === 0;
    for (const criterion of input.activity.rubric.filter((item) => item.enabled)) {
      scores[criterion.id] = noSpeech ? 1 : Math.min(4, Math.max(1, studentTurns.length >= 2 ? 4 : 3));
      evidence[criterion.id] = noSpeech ? "No speech was detected in this attempt." : mockReason(criterion, studentTurns.length, input.turns.filter((turn) => turn.usedHelp).length);
    }
    const evaluation: SpeakingEvaluation = {
      participantId: input.participantId,
      language: input.activity.nativeLanguage,
      scores,
      evidence,
      strengths: noSpeech
        ? [input.activity.nativeLanguage === "ja" ? "もう一度話す練習にチャレンジできます。" : "You can try the speaking activity again."]
        : studentTurns.length > 0
        ? ["相手の話を聞いて、自分の言いたいことを伝えられました。", "まちがいを気にしすぎず、会話を続けられました。"]
        : ["これから話す練習を始められます。"],
      improvements: noSpeech
        ? [input.activity.nativeLanguage === "ja" ? "短い英語を1文話してみましょう。" : "Try saying one short sentence."]
        : studentTurns.length > 1
        ? ["次は、あなたからも相手に1つ質問してみましょう。"]
        : ["短い英語で答えて、もう一度話してみましょう。"],
      usefulEnglish: studentTurns.length > 0
        ? [{ said: studentTurns[0]!.text, try: input.activity.targetExpressions[0] ?? "I'd like..." }]
        : [],
      overallMessage: noSpeech
        ? (input.activity.nativeLanguage === "ja" ? "声が聞こえませんでした。短い英語を1文話して、もう一度試してみましょう。" : "We couldn't hear any speech. Try one short sentence and try again.")
        : input.activity.nativeLanguage === "en"
        ? "Nice work! You kept trying to communicate."
        : "よくできました！まちがいを気にしすぎず、会話を続けられました。",
      createdAt: new Date().toISOString()
    };
    const parsed = SpeakingEvaluationSchema.safeParse(evaluation);
    if (!parsed.success) throw new Error("Mock evaluation did not match the speaking evaluation schema.");
    return parsed.data as SpeakingEvaluation;
  }
};
