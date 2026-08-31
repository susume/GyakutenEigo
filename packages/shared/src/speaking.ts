import { z } from "zod";

export const SPEAKING_LEVELS = [
  "beginner",
  "elementary",
  "lower_intermediate",
  "intermediate"
] as const;

export type SpeakingLevel = (typeof SPEAKING_LEVELS)[number];

export const SPEAKING_LEVEL_LABELS: Record<SpeakingLevel, string> = {
  beginner: "Beginner",
  elementary: "Elementary",
  lower_intermediate: "Lower Intermediate",
  intermediate: "Intermediate"
};

export const SPEAKING_DIFFICULTIES = ["easy", "normal", "challenge"] as const;
export type SpeakingDifficulty = (typeof SPEAKING_DIFFICULTIES)[number];

export const SPEAKING_DIFFICULTY_LABELS: Record<SpeakingDifficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  challenge: "Challenge"
};

export const SPEAKING_NATIVE_LANGUAGES = ["ja", "en"] as const;
export type SpeakingNativeLanguage = (typeof SPEAKING_NATIVE_LANGUAGES)[number];

export const SPEAKING_NATIVE_LANGUAGE_LABELS: Record<SpeakingNativeLanguage, string> = {
  ja: "Japanese",
  en: "English"
};

export const SPEAKING_IDENTIFIER_MODES = ["anonymous", "nickname", "student_number"] as const;
export type SpeakingIdentifierMode = (typeof SPEAKING_IDENTIFIER_MODES)[number];

export const SPEAKING_IDENTIFIER_MODE_LABELS: Record<SpeakingIdentifierMode, string> = {
  anonymous: "Anonymous",
  nickname: "Nickname",
  student_number: "Student number"
};

// Activity status describes reusable lesson content. Classroom lifecycle is
// deliberately represented by SpeakingSessionStatus below.
export const SPEAKING_ACTIVITY_STATUSES = ["draft", "ready", "archived"] as const;
export type SpeakingActivityStatus = (typeof SPEAKING_ACTIVITY_STATUSES)[number];

export const SPEAKING_PARTICIPANT_STATUSES = ["joined", "in_progress", "evaluating", "completed", "error"] as const;
export type SpeakingParticipantStatus = (typeof SPEAKING_PARTICIPANT_STATUSES)[number];

export const SPEAKING_SESSION_STATUSES = ["ready", "active", "paused", "ended", "expired"] as const;
export type SpeakingSessionStatus = (typeof SPEAKING_SESSION_STATUSES)[number];

export const SPEAKING_PRACTICE_LANGUAGE = "en" as const;
export const SPEAKING_ASSESSMENT_STATUSES = ["scored", "insufficient_evidence"] as const;
export type SpeakingAssessmentStatus = (typeof SPEAKING_ASSESSMENT_STATUSES)[number];

export interface SpeakingRubricCriterion {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export const DEFAULT_SPEAKING_RUBRIC: SpeakingRubricCriterion[] = [
  {
    id: "communication",
    name: "Communication",
    description: "Can the student communicate what they want to say?",
    enabled: true
  },
  {
    id: "interaction",
    name: "Interaction",
    description: "Does the student respond and keep the conversation moving?",
    enabled: true
  },
  {
    id: "vocabulary",
    name: "Vocabulary",
    description: "Does the student use useful words and expressions?",
    enabled: true
  },
  {
    id: "grammar",
    name: "Grammar",
    description: "Are the student’s sentences understandable?",
    enabled: true
  },
  {
    id: "fluency",
    name: "Fluency / Comprehensibility",
    description: "Can the student communicate without too much difficulty?",
    enabled: true
  }
];

export interface SpeakingActivity {
  id: string;
  teacherId: string;
  title: string;
  scenario: string;
  aiRole: string;
  studentRole: string;
  level: SpeakingLevel;
  difficulty: SpeakingDifficulty;
  nativeLanguage: SpeakingNativeLanguage;
  durationSeconds: number;
  status: SpeakingActivityStatus;
  identifierMode: SpeakingIdentifierMode;
  targetExpressions: string[];
  rubric: SpeakingRubricCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface SpeakingParticipant {
  id: string;
  activityId: string;
  sessionId?: string;
  displayIdentifier?: string;
  /** Returned only to the joining browser once; public responses omit it. */
  anonymousToken?: string;
  startedAt?: string;
  finishedAt?: string;
  /** Milliseconds spent in finalized teacher pauses after this participant started. */
  pausedDurationMs: number;
  status: SpeakingParticipantStatus;
  helpCount: number;
}

export interface SpeakingSession {
  id: string;
  activityId: string;
  joinCode: string;
  createdAt: string;
  status: SpeakingSessionStatus;
  startedAt?: string;
  pausedAt?: string;
  endedAt?: string;
  expiresAt: string;
}

export interface SpeakingTurn {
  id: string;
  participantId: string;
  speaker: "ai" | "student";
  text: string;
  createdAt: string;
  audioDurationMs?: number;
  responseTimeMs?: number;
  usedHelp?: boolean;
  transcriptionConfidence?: number;
  /** Request id used to make retried student turns idempotent. */
  requestId?: string;
}

export interface SpeakingEvaluation {
  participantId: string;
  language: SpeakingNativeLanguage;
  assessmentStatus: SpeakingAssessmentStatus;
  notScoredReason?: string;
  scores: Record<string, number | null>;
  evidence: Record<string, string>;
  strengths: string[];
  improvements: string[];
  usefulEnglish: Array<{ said: string; try: string }>;
  overallMessage: string;
  createdAt: string;
}

export interface SpeakingParticipantResult {
  participant: SpeakingParticipant;
  session: SpeakingSession;
  activity: Pick<SpeakingActivity, "id" | "title" | "scenario" | "targetExpressions" | "nativeLanguage" | "rubric">;
  turns: SpeakingTurn[];
  evaluation?: SpeakingEvaluation;
}

export interface SpeakingCreateActivityInput {
  title: string;
  scenario: string;
  aiRole: string;
  studentRole: string;
  level: SpeakingLevel;
  difficulty: SpeakingDifficulty;
  nativeLanguage: SpeakingNativeLanguage;
  durationSeconds: number;
  identifierMode: SpeakingIdentifierMode;
  targetExpressions: string[];
  rubric: SpeakingRubricCriterion[];
}

export const SPEAKING_LIMITS = {
  title: 120,
  scenario: 800,
  role: 80,
  expression: 120,
  expressions: 12,
  rubricCriteria: 10,
  turnText: 1_200,
  maxDurationSeconds: 7 * 60,
  maxTurnSeconds: 30,
  maxTurns: 24,
  maxAudioBytes: 4 * 1024 * 1024,
  maxHelpCalls: 20,
  maxContextTurns: 8,
  sessionLifetimeSeconds: 8 * 60 * 60
} as const;

export const SpeakingRubricCriterionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  enabled: z.boolean()
});

export const SpeakingCreateActivityInputSchema = z.object({
  title: z.string().trim().min(1).max(SPEAKING_LIMITS.title),
  scenario: z.string().trim().min(1).max(SPEAKING_LIMITS.scenario),
  aiRole: z.string().trim().min(1).max(SPEAKING_LIMITS.role),
  studentRole: z.string().trim().min(1).max(SPEAKING_LIMITS.role),
  level: z.enum(SPEAKING_LEVELS),
  difficulty: z.enum(SPEAKING_DIFFICULTIES),
  nativeLanguage: z.enum(SPEAKING_NATIVE_LANGUAGES),
  durationSeconds: z.number().int().min(120).max(SPEAKING_LIMITS.maxDurationSeconds),
  identifierMode: z.enum(SPEAKING_IDENTIFIER_MODES),
  targetExpressions: z.array(z.string().trim().min(1).max(SPEAKING_LIMITS.expression)).max(SPEAKING_LIMITS.expressions),
  rubric: z.array(SpeakingRubricCriterionSchema).min(1).max(SPEAKING_LIMITS.rubricCriteria)
}).superRefine((input, context) => {
  if (!input.rubric.some((criterion) => criterion.enabled)) {
    context.addIssue({ code: "custom", message: "At least one rubric criterion must be enabled.", path: ["rubric"] });
  }
  if (new Set(input.rubric.map((criterion) => criterion.id)).size !== input.rubric.length) {
    context.addIssue({ code: "custom", message: "Rubric criterion IDs must be unique.", path: ["rubric"] });
  }
});

export const SpeakingJoinInputSchema = z.object({
  code: z.string().trim().toUpperCase().length(6),
  identifier: z.string().trim().max(80).optional()
});

export const SpeakingTurnInputSchema = z.object({
  text: z.string().trim().min(1).max(SPEAKING_LIMITS.turnText).optional()
});

export const SpeakingSessionStatusSchema = z.enum(SPEAKING_SESSION_STATUSES);

export const SpeakingEvaluationSchema = z.object({
  participantId: z.string().min(1),
  language: z.enum(SPEAKING_NATIVE_LANGUAGES),
  assessmentStatus: z.enum(SPEAKING_ASSESSMENT_STATUSES).default("scored"),
  notScoredReason: z.string().max(500).optional(),
  scores: z.record(z.string(), z.number().int().min(1).max(4).nullable()),
  evidence: z.record(z.string(), z.string().max(500)),
  strengths: z.array(z.string().max(300)).max(5),
  improvements: z.array(z.string().max(300)).max(5),
  usefulEnglish: z.array(z.object({ said: z.string().max(300), try: z.string().max(300) })).max(5),
  overallMessage: z.string().max(500),
  createdAt: z.string().min(1)
});

export const speakingActiveElapsedMs = (
  participant: Pick<SpeakingParticipant, "startedAt" | "pausedDurationMs">,
  session: Pick<SpeakingSession, "status" | "pausedAt">,
  referenceTime: string | number | Date
) => {
  if (!participant.startedAt) return 0;
  const startedAtMs = Date.parse(participant.startedAt);
  const referenceTimeMs = referenceTime instanceof Date
    ? referenceTime.getTime()
    : typeof referenceTime === "number" ? referenceTime : Date.parse(referenceTime);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(referenceTimeMs)) return 0;
  const finalizedPauseMs = Math.max(0, participant.pausedDurationMs ?? 0);
  const pausedAtMs = session.pausedAt ? Date.parse(session.pausedAt) : Number.NaN;
  const currentPauseMs = session.status === "paused" && Number.isFinite(pausedAtMs)
    ? Math.max(0, referenceTimeMs - pausedAtMs)
    : 0;
  return Math.max(0, referenceTimeMs - startedAtMs - finalizedPauseMs - currentPauseMs);
};

export const speakingRemainingSeconds = (
  participant: Pick<SpeakingParticipant, "startedAt" | "pausedDurationMs">,
  session: Pick<SpeakingSession, "status" | "pausedAt">,
  durationSeconds: number,
  referenceTime: string | number | Date
) => Math.max(0, Math.floor((durationSeconds * 1_000 - speakingActiveElapsedMs(participant, session, referenceTime)) / 1_000));

export const speakingOverallScore = (evaluation?: Pick<SpeakingEvaluation, "scores">) => {
  const scoredValues = evaluation ? Object.values(evaluation.scores).filter((score): score is number => typeof score === "number") : [];
  return scoredValues.length
    ? Math.round((scoredValues.reduce((sum, score) => sum + score, 0) / (scoredValues.length * 4)) * 100)
    : undefined;
};

export type SpeakingFeedbackCopy = {
  scoredHeadline: string;
  scoredSummary: string;
  insufficientEvidenceHeadline: string;
  insufficientEvidenceMessage: string;
  insufficientEvidenceReason: string;
  insufficientEvidenceStrength: string;
  insufficientEvidenceImprovement: string;
  notScored: string;
  notScoredDetail: string;
  evaluationUnavailable: string;
  evaluationUnavailableMessage: string;
  evaluationDetail: string;
  resultHeading: string;
  whatWentWell: string;
  tryNext: string;
  usefulEnglish: string;
  youSaid: string;
  tryLabel: string;
  speakingTurns: string;
  transcript: string;
  conversationEvidence: string;
  aiLabel: string;
  studentLabel: string;
  helpHint: string;
  helpEncouragement: string;
  noSpeechDetected: string;
  noUsefulEnglish: string;
};

export const speakingFeedbackCopy = (language: SpeakingNativeLanguage): SpeakingFeedbackCopy => language === "en"
  ? {
    scoredHeadline: "Great work!",
    scoredSummary: "You kept trying to communicate and move the conversation forward.",
    insufficientEvidenceHeadline: "Not enough speech to score this attempt.",
    insufficientEvidenceMessage: "There wasn't enough speech to score this attempt. Try saying one short sentence and try again.",
    insufficientEvidenceReason: "Not enough speaking evidence.",
    insufficientEvidenceStrength: "You can try the speaking activity again.",
    insufficientEvidenceImprovement: "Try saying one short sentence.",
    notScored: "Not scored",
    notScoredDetail: "Not enough speaking evidence.",
    evaluationUnavailable: "Evaluation unavailable",
    evaluationUnavailableMessage: "Your transcript is saved, but the evaluation provider did not return a result. Please ask your teacher to try again.",
    evaluationDetail: "Evaluation detail",
    resultHeading: "Your speaking result",
    whatWentWell: "What You Did Well",
    tryNext: "Try This Next Time",
    usefulEnglish: "Useful English",
    youSaid: "You said",
    tryLabel: "Try",
    speakingTurns: "speaking turns",
    transcript: "Transcript",
    conversationEvidence: "Conversation evidence",
    aiLabel: "AI",
    studentLabel: "Student",
    helpHint: "Use one short sentence, then ask the other person a question.",
    helpEncouragement: "It's okay to use your own words. Short, slow sentences can still communicate clearly.",
    noSpeechDetected: "No speech was detected in this attempt.",
    noUsefulEnglish: "No alternative phrase was needed for this attempt."
  }
  : {
    scoredHeadline: "よくできました！",
    scoredSummary: "まちがいを気にしすぎず、会話を続けられました。",
    insufficientEvidenceHeadline: "今回は評価できるだけの英語を聞くことができませんでした。",
    insufficientEvidenceMessage: "今回は評価できるだけの英語を聞くことができませんでした。短い文を1つ話して、もう一度チャレンジしてみましょう。",
    insufficientEvidenceReason: "評価できる発話が十分にありません。",
    insufficientEvidenceStrength: "もう一度話す練習にチャレンジできます。",
    insufficientEvidenceImprovement: "短い英語を1文話してみましょう。",
    notScored: "評価なし",
    notScoredDetail: "評価できる発話が十分にありません。",
    evaluationUnavailable: "評価を準備できませんでした",
    evaluationUnavailableMessage: "会話の記録は保存されていますが、評価を準備できませんでした。先生にもう一度試してもらいましょう。",
    evaluationDetail: "評価の詳細",
    resultHeading: "今回の結果",
    whatWentWell: "よくできたこと",
    tryNext: "次はこれを試そう",
    usefulEnglish: "役立つ英語",
    youSaid: "あなたの表現",
    tryLabel: "言い換え",
    speakingTurns: "発話",
    transcript: "会話記録",
    conversationEvidence: "会話の記録",
    aiLabel: "AI",
    studentLabel: "生徒",
    helpHint: "相手の質問に、短い英語で答えてみよう。",
    helpEncouragement: "自分の言葉で大丈夫です。短い文でも、ゆっくりでも伝わります。",
    noSpeechDetected: "声が聞こえなかったため、会話は始まりませんでした。",
    noUsefulEnglish: "今回は言い換えの提案はありません。"
  };
