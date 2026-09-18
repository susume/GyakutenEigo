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

export const SPEAKING_MODES = ["practice", "assessment"] as const;
export type SpeakingMode = (typeof SPEAKING_MODES)[number];

export const SPEAKING_MODE_LABELS: Record<SpeakingMode, string> = {
  practice: "Practice",
  assessment: "Assessment"
};

export const SPEAKING_NATIVE_LANGUAGES = ["ja", "en"] as const;
export type SpeakingNativeLanguage = (typeof SPEAKING_NATIVE_LANGUAGES)[number];

export const SPEAKING_NATIVE_LANGUAGE_LABELS: Record<SpeakingNativeLanguage, string> = {
  ja: "Japanese",
  en: "English"
};

export const SPEAKING_CATEGORIES = [
  "Everyday Communication",
  "Shopping & Services",
  "Food & Restaurants",
  "Travel & Transportation",
  "School & Social Life",
  "Help & Problem Solving",
  "Opinions & Decisions",
  "Japan & Cultural Exchange"
] as const;

export type SpeakingCategory = (typeof SPEAKING_CATEGORIES)[number];

export const SPEAKING_COMMUNICATION_SKILLS = [
  "Asking questions",
  "Sharing information",
  "Describing",
  "Explaining",
  "Clarifying",
  "Requesting",
  "Comparing",
  "Giving reasons",
  "Recommending",
  "Making suggestions",
  "Giving opinions",
  "Negotiating",
  "Problem solving",
  "Follow-up questions"
] as const;

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

export const SPEAKING_GOAL_REQUIREMENT_STATUSES = ["completed", "partially_completed", "not_completed", "uncertain"] as const;
export type SpeakingGoalRequirementStatus = (typeof SPEAKING_GOAL_REQUIREMENT_STATUSES)[number];

export interface SpeakingGoalRequirement {
  requirement: string;
  status: SpeakingGoalRequirementStatus;
  /** IDs must refer to real transcript turns; the server filters provider output. */
  evidenceTurnIds: string[];
}

export interface SpeakingGoalCompletion {
  completed: boolean;
  requirements: SpeakingGoalRequirement[];
}

export interface SpeakingRubricCriterion {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export const SPEAKING_CONTEXT_TYPES = [
  "map",
  "menu",
  "subway",
  "timetable",
  "chart",
  "photo",
  "other"
] as const;

export type SpeakingContextType = (typeof SPEAKING_CONTEXT_TYPES)[number];

/** Optional, non-linguistic visual support for a speaking activity. */
export interface SpeakingContext {
  title?: string;
  description?: string;
  imageUrl?: string;
  alt?: string;
  type?: SpeakingContextType;
}

export interface SpeakingSupportSettings {
  showTargetExpressions: boolean;
  showContext: boolean;
  showTranscript: boolean;
  allowReplay: boolean;
  allowHelp: boolean;
}

export const DEFAULT_SPEAKING_PRACTICE_SUPPORT_SETTINGS: SpeakingSupportSettings = {
  showTargetExpressions: true,
  showContext: true,
  showTranscript: true,
  allowReplay: true,
  allowHelp: true
};

export const DEFAULT_SPEAKING_ASSESSMENT_SUPPORT_SETTINGS: SpeakingSupportSettings = {
  showTargetExpressions: true,
  showContext: true,
  showTranscript: false,
  allowReplay: false,
  allowHelp: false
};

/** Legacy activities had every existing support available. Keep that behaviour. */
export const LEGACY_SPEAKING_SUPPORT_SETTINGS: SpeakingSupportSettings = {
  ...DEFAULT_SPEAKING_PRACTICE_SUPPORT_SETTINGS
};

export const recommendedSpeakingSupportSettings = (mode: SpeakingMode): SpeakingSupportSettings => ({
  ...(mode === "practice"
    ? DEFAULT_SPEAKING_PRACTICE_SUPPORT_SETTINGS
    : DEFAULT_SPEAKING_ASSESSMENT_SUPPORT_SETTINGS)
});

/** Resolve missing/partial settings without hiding support from legacy records. */
export const resolveSpeakingSupportSettings = (
  settings?: Partial<SpeakingSupportSettings> | null
): SpeakingSupportSettings => ({
  ...LEGACY_SPEAKING_SUPPORT_SETTINGS,
  ...(settings ?? {})
});

/**
 * Scenario-owned learner support.  The fields are optional at the activity
 * boundary so older/custom activities can be read safely; the resolver below
 * supplies a neutral fallback for the student experience.
 */
export interface SpeakingScenarioResources {
  teacherFocus?: string;
  /** Teacher-facing organization metadata. It is optional for legacy records. */
  category?: string;
  communicationSkills?: string[];
  aiContext?: string;
  possibleComplication?: string;
  successConditions?: string[];
  builtIn?: boolean;
  sourceTemplateId?: string;
  openingLine?: string;
  studentGoal?: string;
  suggestedSteps?: string[];
  usefulVocabulary?: string[];
  referenceItems?: Array<{ label: string; detail?: string }>;
  imageSrc?: string;
  imageAlt?: string;
  /** Supported for scenario-owned authoring and legacy JSON records. */
  context?: SpeakingContext;
}

export type SpeakingResolvedScenarioResources = {
  teacherFocus?: string;
  category?: string;
  communicationSkills: string[];
  aiContext?: string;
  possibleComplication?: string;
  successConditions: string[];
  builtIn?: boolean;
  sourceTemplateId?: string;
  openingLine: string;
  studentGoal: string;
  suggestedSteps: string[];
  usefulVocabulary: string[];
  referenceItems: Array<{ label: string; detail?: string }>;
  imageSrc?: string;
  imageAlt?: string;
  context?: SpeakingContext;
};

export const DEFAULT_SPEAKING_SCENARIO_RESOURCES: SpeakingResolvedScenarioResources = {
  communicationSkills: [],
  successConditions: [],
  openingLine: "Hi! Nice to meet you. Can we talk?",
  studentGoal: "Keep the conversation moving with short, clear English.",
  suggestedSteps: [
    "Listen to your partner.",
    "Answer the question.",
    "Ask a related question.",
    "Use one target expression if possible.",
    "Continue naturally."
  ],
  usefulVocabulary: [
    "Could you repeat that, please?",
    "Let me think for a moment.",
    "Thank you."
  ],
  referenceItems: []
};

const boundedResourceText = (value: string | undefined, fallback: string, max = 240) =>
  (value?.trim().slice(0, max) || fallback);

const normalizeSpeakingContext = (context?: SpeakingContext): SpeakingContext | undefined => {
  if (!context) return undefined;
  const title = context.title?.trim().slice(0, 120);
  const description = context.description?.trim().slice(0, 240);
  const imageUrl = context.imageUrl?.trim().slice(0, 500);
  const alt = context.alt?.trim().slice(0, 160);
  const type = context.type && SPEAKING_CONTEXT_TYPES.includes(context.type) ? context.type : undefined;
  if (!title && !description && !imageUrl && !alt && !type) return undefined;
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(alt ? { alt } : {}),
    ...(type ? { type } : {})
  };
};

/** Resolve activity-owned support without guessing from an editable title. */
export const speakingScenarioResources = (
  resources?: SpeakingScenarioResources
): SpeakingResolvedScenarioResources => ({
  ...(resources?.teacherFocus?.trim() ? { teacherFocus: resources.teacherFocus.trim().slice(0, 500) } : {}),
  ...(resources?.category?.trim() ? { category: resources.category.trim().slice(0, 80) } : {}),
  communicationSkills: (resources?.communicationSkills ?? [])
    .map((skill) => skill.trim().slice(0, 80)).filter(Boolean).slice(0, 14),
  ...(resources?.aiContext?.trim() ? { aiContext: resources.aiContext.trim().slice(0, 500) } : {}),
  ...(resources?.possibleComplication?.trim() ? { possibleComplication: resources.possibleComplication.trim().slice(0, 500) } : {}),
  successConditions: (resources?.successConditions ?? [])
    .map((condition) => condition.trim().slice(0, 220)).filter(Boolean).slice(0, 8),
  ...(resources?.builtIn !== undefined ? { builtIn: resources.builtIn } : {}),
  ...(resources?.sourceTemplateId?.trim() ? { sourceTemplateId: resources.sourceTemplateId.trim().slice(0, 120) } : {}),
  openingLine: boundedResourceText(resources?.openingLine, DEFAULT_SPEAKING_SCENARIO_RESOURCES.openingLine),
  studentGoal: boundedResourceText(resources?.studentGoal, DEFAULT_SPEAKING_SCENARIO_RESOURCES.studentGoal),
  suggestedSteps: (resources?.suggestedSteps ?? DEFAULT_SPEAKING_SCENARIO_RESOURCES.suggestedSteps)
    .map((step) => step.trim().slice(0, 160)).filter(Boolean).slice(0, 8),
  usefulVocabulary: (resources?.usefulVocabulary ?? DEFAULT_SPEAKING_SCENARIO_RESOURCES.usefulVocabulary)
    .map((item) => item.trim().slice(0, 160)).filter(Boolean).slice(0, 16),
  referenceItems: (resources?.referenceItems ?? DEFAULT_SPEAKING_SCENARIO_RESOURCES.referenceItems)
    .flatMap((item) => {
      const label = item.label?.trim().slice(0, 120);
      return label ? [{ label, ...(item.detail?.trim() ? { detail: item.detail.trim().slice(0, 240) } : {}) }] : [];
    }).slice(0, 24),
  ...(resources?.imageSrc?.trim() ? { imageSrc: resources.imageSrc.trim().slice(0, 500) } : {}),
  ...(resources?.imageAlt?.trim() ? { imageAlt: resources.imageAlt.trim().slice(0, 160) } : {}),
  ...(normalizeSpeakingContext(resources?.context) ? { context: normalizeSpeakingContext(resources?.context) } : {})
});

export const DEFAULT_SPEAKING_RUBRIC: SpeakingRubricCriterion[] = [
  {
    id: "task_achievement",
    name: "Task Achievement",
    description: "Did the student accomplish the real-world communication goal?",
    enabled: true
  },
  {
    id: "interaction",
    name: "Interaction",
    description: "Did the student understand, respond, ask questions, clarify, and maintain communication?",
    enabled: true
  },
  {
    id: "language_range_control",
    name: "Language Range & Control",
    description: "How effectively did the student use the vocabulary and grammar available to them?",
    enabled: true
  },
  {
    id: "communication_fluency",
    name: "Communication & Fluency",
    description: "How clearly and successfully did the student express themselves?",
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
  mode: SpeakingMode;
  supportSettings: SpeakingSupportSettings;
  targetExpressions: string[];
  rubric: SpeakingRubricCriterion[];
  scenarioResources?: SpeakingScenarioResources;
  /** Activity-level visual support; scenarioResources.context remains a compatible alias. */
  context?: SpeakingContext;
  createdAt: string;
  updatedAt: string;
}

export const speakingContext = (
  activity: Pick<SpeakingActivity, "context" | "scenarioResources"> | undefined
): SpeakingContext | undefined => normalizeSpeakingContext(activity?.context ?? activity?.scenarioResources?.context);

export const speakingSupportSettings = (
  activity: Pick<SpeakingActivity, "supportSettings"> | undefined
): SpeakingSupportSettings => resolveSpeakingSupportSettings(activity?.supportSettings);

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
  /** Set after the browser completed the lightweight microphone preflight. */
  readyAt?: string;
  /** Last authenticated lifecycle touch from the student's browser. */
  lastSeenAt?: string;
}

export interface SpeakingSession {
  /** Immutable launch context; deliberately retained after a Set is deleted. */
  speakingSetId?: string;
  speakingSetNameSnapshot?: string;
  speakingSetFocusSnapshot?: string;
  id: string;
  activityId: string;
  joinCode: string;
  createdAt: string;
  status: SpeakingSessionStatus;
  startedAt?: string;
  pausedAt?: string;
  endedAt?: string;
  expiresAt: string;
  /** Monotonic lifecycle revision used to reject stale browser responses. */
  revision?: number;
}

/** Teacher-facing calendar dates must not depend on the server/browser timezone. */
export const speakingTeacherDate = (value: string | Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

export const isFinishedSpeakingSession = (status: string): boolean =>
  status === "ended" || status === "expired" || status === "completed";

export interface SpeakingSetSummary {
  id: string;
  name: string;
  description: string;
  /** Optional focus shared by tasks in this Set. */
  focus: string;
  activityCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpeakingSetDetail extends SpeakingSetSummary {
  activities: Array<{
    activity: SpeakingActivity;
    position: number;
    sessionCount: number;
    lastSessionAt?: string;
  }>;
}

export interface SpeakingLibraryItem {
  activity: SpeakingActivity;
  sessionCount: number;
  lastSessionAt?: string;
  latestSessionStatus?: SpeakingSessionStatus;
  activeSession?: SpeakingSession;
  setMemberships: SpeakingSetSummary[];
}

export interface SpeakingReportSummary {
  activity: Pick<SpeakingActivity, "id" | "title" | "scenario" | "rubric" | "mode" | "supportSettings">;
  session: SpeakingSession;
  setMemberships: SpeakingSetSummary[];
  participantCount: number;
  completedCount: number;
  needsReviewCount: number;
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
  usefulEnglish: Array<{ said: string; try: string; sourceTurnId?: string }>;
  goalCompletion?: SpeakingGoalCompletion;
  overallMessage: string;
  createdAt: string;
}

export interface SpeakingParticipantResult {
  participant: SpeakingParticipant;
  session: SpeakingSession;
  activity: Pick<SpeakingActivity, "id" | "title" | "scenario" | "targetExpressions" | "nativeLanguage" | "rubric" | "scenarioResources" | "context" | "mode" | "supportSettings">;
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
  /** Optional for older clients; the server resolves Assessment safely. */
  mode?: SpeakingMode;
  /** Optional for older clients; the server resolves legacy-compatible support. */
  supportSettings?: Partial<SpeakingSupportSettings>;
  targetExpressions: string[];
  rubric: SpeakingRubricCriterion[];
  scenarioResources?: SpeakingScenarioResources;
  context?: SpeakingContext;
}

export const SPEAKING_EVALUATION_JOB_STATUSES = ["queued", "running", "retrying", "completed", "failed"] as const;
export type SpeakingEvaluationJobStatus = (typeof SPEAKING_EVALUATION_JOB_STATUSES)[number];

export interface SpeakingEvaluationJob {
  id: string;
  participantId: string;
  status: SpeakingEvaluationJobStatus;
  attempt: number;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  leaseUntil?: string;
  lastErrorCode?: string;
  retryable?: boolean;
  nextRetryAt?: string;
  updatedAt: string;
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

export const SpeakingSupportSettingsSchema = z.object({
  showTargetExpressions: z.boolean(),
  showContext: z.boolean(),
  showTranscript: z.boolean(),
  allowReplay: z.boolean(),
  allowHelp: z.boolean()
});

const SpeakingContextSchema = z.object({
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(240).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  alt: z.string().trim().max(160).optional(),
  type: z.enum(SPEAKING_CONTEXT_TYPES).optional()
}).partial();

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
  mode: z.enum(SPEAKING_MODES).optional(),
  supportSettings: SpeakingSupportSettingsSchema.partial().optional(),
  targetExpressions: z.array(z.string().trim().min(1).max(SPEAKING_LIMITS.expression)).max(SPEAKING_LIMITS.expressions),
  rubric: z.array(SpeakingRubricCriterionSchema).min(1).max(SPEAKING_LIMITS.rubricCriteria),
  context: SpeakingContextSchema.optional(),
  scenarioResources: z.object({
    teacherFocus: z.string().trim().max(500).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    communicationSkills: z.array(z.string().trim().min(1).max(80)).max(14).optional(),
    aiContext: z.string().trim().min(1).max(500).optional(),
    possibleComplication: z.string().trim().min(1).max(500).optional(),
    successConditions: z.array(z.string().trim().min(1).max(220)).max(8).optional(),
    builtIn: z.boolean().optional(),
    sourceTemplateId: z.string().trim().min(1).max(120).optional(),
    openingLine: z.string().trim().min(1).max(240).optional(),
    studentGoal: z.string().trim().min(1).max(240).optional(),
    suggestedSteps: z.array(z.string().trim().min(1).max(160)).max(8).optional(),
    usefulVocabulary: z.array(z.string().trim().min(1).max(160)).max(16).optional(),
    referenceItems: z.array(z.object({ label: z.string().trim().min(1).max(120), detail: z.string().trim().max(240).optional() })).max(24).optional(),
    imageSrc: z.string().trim().min(1).max(500).optional(),
    imageAlt: z.string().trim().min(1).max(160).optional(),
    context: SpeakingContextSchema.optional()
  }).partial().optional()
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
  identifier: z.string().trim().max(80).optional(),
  /** Client-generated key so a retried join does not create another roster row. */
  requestId: z.string().trim().min(8).max(120).optional(),
  /** Tab-scoped secret allows recovery when the successful join response is lost. */
  joinToken: z.string().regex(/^[a-f0-9]{64}$/).optional()
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
  scores: z.record(z.string(), z.number().int().min(0).max(4).nullable()),
  evidence: z.record(z.string(), z.string().max(500)),
  strengths: z.array(z.string().max(300)).max(5),
  improvements: z.array(z.string().max(300)).max(5),
  usefulEnglish: z.array(z.object({ said: z.string().max(300), try: z.string().max(300), sourceTurnId: z.string().min(1).max(120).optional() })).max(5),
  goalCompletion: z.object({
    completed: z.boolean(),
    requirements: z.array(z.object({
      requirement: z.string().trim().min(1).max(300),
      status: z.enum(SPEAKING_GOAL_REQUIREMENT_STATUSES),
      evidenceTurnIds: z.array(z.string().min(1).max(120)).max(12)
    })).max(12)
  }).optional(),
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
  practiceCompleteHeadline: string;
  practiceCompleteMessage: string;
  assessmentCompletedHeadline: string;
  assessmentCompletedMessage: string;
  assessmentProgressHeadline: string;
  assessmentProgressMessage: string;
  assessmentFinishedHeadline: string;
  assessmentFinishedMessage: string;
  insufficientEvidenceHeadline: string;
  insufficientEvidenceMessage: string;
  insufficientEvidenceReason: string;
  insufficientEvidenceStrength: string;
  insufficientEvidenceImprovement: string;
  notScored: string;
  notScoredDetail: string;
  evaluationUnavailable: string;
  evaluationUnavailableMessage: string;
  evaluationPendingHeadline: string;
  evaluationPendingMessage: string;
  evaluationRetryingMessage: string;
  evaluationNeedsAttentionHeadline: string;
  evaluationNeedsAttentionMessage: string;
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
    scoredHeadline: "You communicated your idea.",
    scoredSummary: "You kept the conversation moving and used your English to communicate.",
    practiceCompleteHeadline: "Practice complete",
    practiceCompleteMessage: "Nice work — you used your English. See what went well and choose one thing to try next time.",
    assessmentCompletedHeadline: "You did it!",
    assessmentCompletedMessage: "You completed the speaking task and showed that you could use your English to communicate.",
    assessmentProgressHeadline: "Good progress",
    assessmentProgressMessage: "You completed the conversation and showed part of the task. See what worked and what to try next.",
    assessmentFinishedHeadline: "You finished the speaking task",
    assessmentFinishedMessage: "Your conversation is saved. See what you did well and one thing to work on next time.",
    insufficientEvidenceHeadline: "Not enough speech to score this attempt.",
    insufficientEvidenceMessage: "There wasn't enough speech to score this attempt. Try saying one short sentence and try again.",
    insufficientEvidenceReason: "Not enough speaking evidence.",
    insufficientEvidenceStrength: "You can try the speaking activity again.",
    insufficientEvidenceImprovement: "Try saying one short sentence.",
    notScored: "Not scored",
    notScoredDetail: "Not enough speaking evidence.",
    evaluationUnavailable: "Evaluation unavailable",
    evaluationUnavailableMessage: "Your transcript is saved, but the evaluation provider did not return a result. Please ask your teacher to try again.",
    evaluationPendingHeadline: "Your speaking task was submitted successfully.",
    evaluationPendingMessage: "Your conversation is safely saved. We’re preparing your feedback. This is taking a little longer than usual, so you do not need to do the task again.",
    evaluationRetryingMessage: "Your conversation is safely saved. We’re preparing your feedback again. You do not need to do the task again.",
    evaluationNeedsAttentionHeadline: "Your conversation is saved",
    evaluationNeedsAttentionMessage: "Your conversation is safely saved, but your teacher needs to check the feedback. You do not need to do the task again.",
    evaluationDetail: "Speaking evaluation",
    resultHeading: "Your speaking task",
    whatWentWell: "What You Did Well",
    tryNext: "Try This Next Time",
    usefulEnglish: "Useful English",
    youSaid: "You said",
    tryLabel: "Try",
    speakingTurns: "speaking turns",
    transcript: "Transcript",
    conversationEvidence: "Conversation evidence",
    aiLabel: "Speaking partner",
    studentLabel: "Student",
    helpHint: "Use one short sentence, then ask the other person a question.",
    helpEncouragement: "It's okay to use your own words. Short, slow sentences can still communicate clearly.",
    noSpeechDetected: "No speech was detected in this attempt.",
    noUsefulEnglish: "No alternative phrase was needed for this attempt."
  }
  : {
    scoredHeadline: "自分の考えを伝えられました。",
    scoredSummary: "英語を使って、会話を続けることができました。",
    practiceCompleteHeadline: "練習完了！",
    practiceCompleteMessage: "英語を使って伝えることができました。よくできたことと、次に試したいことを確認してみましょう。",
    assessmentCompletedHeadline: "課題を達成できました！",
    assessmentCompletedMessage: "授業で学んだ英語を使って、相手に伝えることができました。",
    assessmentProgressHeadline: "よい進歩です",
    assessmentProgressMessage: "会話を最後まで続け、課題の一部を達成できました。うまくいったことと、次に試すことを確認しましょう。",
    assessmentFinishedHeadline: "スピーキング課題を終えました",
    assessmentFinishedMessage: "会話の記録は保存されています。よくできたことと、次に取り組むことを確認しましょう。",
    insufficientEvidenceHeadline: "今回は評価できるだけの英語を聞くことができませんでした。",
    insufficientEvidenceMessage: "今回は評価できるだけの英語を聞くことができませんでした。短い文を1つ話して、もう一度チャレンジしてみましょう。",
    insufficientEvidenceReason: "評価できる発話が十分にありません。",
    insufficientEvidenceStrength: "もう一度話す練習にチャレンジできます。",
    insufficientEvidenceImprovement: "短い英語を1文話してみましょう。",
    notScored: "評価なし",
    notScoredDetail: "評価できる発話が十分にありません。",
    evaluationUnavailable: "評価を準備できませんでした",
    evaluationUnavailableMessage: "会話の記録は保存されていますが、評価を準備できませんでした。先生にもう一度試してもらいましょう。",
    evaluationPendingHeadline: "スピーキング課題を提出しました。",
    evaluationPendingMessage: "会話の記録は安全に保存されています。フィードバックを準備しています。少し時間がかかっていますが、もう一度課題をする必要はありません。",
    evaluationRetryingMessage: "会話の記録は安全に保存されています。フィードバックの準備をもう一度試しています。もう一度課題をする必要はありません。",
    evaluationNeedsAttentionHeadline: "会話の記録は保存されています",
    evaluationNeedsAttentionMessage: "会話の記録は安全に保存されていますが、フィードバックの準備に先生の確認が必要です。もう一度課題をする必要はありません。",
    evaluationDetail: "スピーキング評価",
    resultHeading: "今回のスピーキング課題",
    whatWentWell: "よくできたこと",
    tryNext: "次はこれを試そう",
    usefulEnglish: "役立つ英語",
    youSaid: "あなたの表現",
    tryLabel: "言い換え",
    speakingTurns: "発話",
    transcript: "会話記録",
    conversationEvidence: "会話の記録",
    aiLabel: "スピーキングパートナー",
    studentLabel: "生徒",
    helpHint: "相手の質問に、短い英語で答えてみよう。",
    helpEncouragement: "自分の言葉で大丈夫です。短い文でも、ゆっくりでも伝わります。",
    noSpeechDetected: "声が聞こえなかったため、会話は始まりませんでした。",
    noUsefulEnglish: "今回は言い換えの提案はありません。"
  };
