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
  scores: Record<string, number>;
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
  scores: z.record(z.string(), z.number().int().min(1).max(4)),
  evidence: z.record(z.string(), z.string().max(500)),
  strengths: z.array(z.string().max(300)).max(5),
  improvements: z.array(z.string().max(300)).max(5),
  usefulEnglish: z.array(z.object({ said: z.string().max(300), try: z.string().max(300) })).max(5),
  overallMessage: z.string().max(500),
  createdAt: z.string().min(1)
});
