import type { SpeakingActivity, SpeakingEvaluation, SpeakingTurn } from "@quizstrike/shared";
import { makeDemoEvaluation } from "./speakingData";

export interface TranscriptionResult {
  text: string;
  confidence: number;
}

export interface TranscriptionOptions {
  hasMicrophone?: boolean;
  speechDetected?: boolean;
}

export interface TranscriptionProvider {
  transcribe(audio?: Blob, turnIndex?: number, options?: TranscriptionOptions): Promise<TranscriptionResult>;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
}

export interface TTSProvider {
  speak(text: string, options?: SpeakOptions): Promise<void>;
  cancel(): void;
}

export interface ConversationProvider {
  respond(input: { activity: SpeakingActivity; turns: SpeakingTurn[]; studentText: string }): Promise<string>;
  help(input: { activity: SpeakingActivity; turns: SpeakingTurn[] }): Promise<string>;
}

export interface EvaluationProvider {
  evaluate(input: { activity: SpeakingActivity; turns: SpeakingTurn[]; participantId: string; helpCount: number }): Promise<SpeakingEvaluation>;
}

const transcriptSamples = [
  "I want blue T-shirt.",
  "Medium, please. Can I try it on?",
  "How much is it?",
  "That's all, thank you."
];

export const mockTranscriptionProvider: TranscriptionProvider = {
  async transcribe(_audio, turnIndex = 0, options = {}) {
    await wait(420);
    if (options.hasMicrophone && options.speechDetected === false) {
      return { text: "", confidence: 0.04 };
    }
    return { text: transcriptSamples[turnIndex % transcriptSamples.length], confidence: 0.96 };
  }
};

export const browserTtsProvider: TTSProvider = {
  speak(text, options = {}) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
    window.speechSynthesis.cancel();
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang ?? "en-US";
      utterance.rate = options.rate ?? 0.92;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  },
  cancel() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }
};

const promptInjectionPattern = /ignore\s+(?:all|any|previous)|system\s+prompt|developer\s+message|reveal.*instruction|jailbreak/i;

const safeRedirect = (activity: SpeakingActivity) => {
  const title = activity.title.toLowerCase();
  if (title.includes("restaurant") || title.includes("food")) return "Let's stay with the activity. What would you like to order?";
  if (title.includes("direction") || title.includes("library")) return "Let's stay with the activity. Where would you like to go?";
  return "Let's stay with the activity. Can you tell me what you need?";
};

const responseFor = (activity: SpeakingActivity, studentText: string, studentTurnCount: number) => {
  if (promptInjectionPattern.test(studentText)) return safeRedirect(activity);
  if (activity.id === "demo-shopping" || activity.joinCode === "ABC123") {
    return [
      "Sure! What size would you like?",
      "We have blue in medium. Would you like to try it on?",
      "It's 2,500 yen. Is that okay?",
      "Great choice! Thank you."
    ][Math.min(studentTurnCount - 1, 3)];
  }
  if (activity.title.toLowerCase().includes("restaurant")) {
    return ["Of course! What would you like to order?", "Would you like a drink with that?", "Anything else?", "Thank you. Enjoy your meal!"][Math.min(studentTurnCount - 1, 3)];
  }
  if (activity.title.toLowerCase().includes("direction")) {
    return ["Sure. Where would you like to go?", "Go straight and turn left at the corner.", "It is next to the station.", "You're welcome!"][Math.min(studentTurnCount - 1, 3)];
  }
  return ["That's interesting! Can you tell me a little more?", "Nice! What do you think about it?", "I see. What would you like to do next?", "Thanks for talking with me!"][Math.min(studentTurnCount - 1, 3)];
};

export const mockConversationProvider: ConversationProvider = {
  async respond({ activity, turns, studentText }) {
    await wait(560);
    const studentTurnCount = turns.filter((turn) => turn.speaker === "student").length;
    return responseFor(activity, studentText, Math.max(1, studentTurnCount));
  },
  async help({ activity }) {
    await wait(280);
    return activity.targetExpressions[0] ?? "Could you say that again, please?";
  }
};

export const mockEvaluationProvider: EvaluationProvider = {
  async evaluate({ activity, turns, participantId }) {
    await wait(640);
    const studentTurns = turns.filter((turn) => turn.speaker === "student").length;
    const evaluation = makeDemoEvaluation(participantId);
    if (studentTurns === 0) {
      const noSpeechMessage = activity.nativeLanguage === "ja"
        ? "声が聞こえませんでした。短い英語を1文話して、もう一度試してみましょう。"
        : "We couldn't hear any speech. Try one short sentence and try again.";
      return {
        ...evaluation,
        language: activity.nativeLanguage,
        scores: Object.fromEntries(activity.rubric.filter((criterion) => criterion.enabled).map((criterion) => [criterion.id, 1])),
        strengths: [activity.nativeLanguage === "ja" ? "もう一度話す練習にチャレンジできます。" : "You can try the speaking activity again."],
        improvements: [activity.nativeLanguage === "ja" ? "短い英語を1文話してみましょう。" : "Try saying one short sentence."],
        usefulEnglish: [],
        overallMessage: noSpeechMessage,
        createdAt: new Date().toISOString()
      };
    }
    const scale = studentTurns >= 3 ? 0 : -1;
    return {
      ...evaluation,
      language: activity.nativeLanguage,
      scores: Object.fromEntries(activity.rubric.filter((criterion) => criterion.enabled).map((criterion) => [criterion.id, Math.max(2, Math.min(4, (evaluation.scores[criterion.id] ?? 3) + scale))])),
      usefulEnglish: studentTurns > 0 ? evaluation.usefulEnglish : [],
      createdAt: new Date().toISOString()
    };
  }
};

export const wait = (durationMs: number) => new Promise<void>((resolve) => setTimeout(resolve, durationMs));
