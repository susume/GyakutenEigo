import {
  DEFAULT_SPEAKING_RUBRIC,
  SPEAKING_LIMITS,
  type SpeakingActivity,
  type SpeakingCreateActivityInput,
  type SpeakingEvaluation,
  type SpeakingParticipant,
  type SpeakingTurn
} from "@quizstrike/shared";

export const SPEAKING_STORAGE_KEY = "gyakuten_eigo_speaking_mvp_v1";

export interface LocalSpeakingSession {
  participant: SpeakingParticipant;
  activityId: string;
  turns: SpeakingTurn[];
  evaluation?: SpeakingEvaluation;
}

export interface SpeakingLocalStore {
  activities: SpeakingActivity[];
  sessions: Record<string, LocalSpeakingSession>;
}

const now = () => new Date().toISOString();

const makeId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

const cloneRubric = () => DEFAULT_SPEAKING_RUBRIC.map((criterion) => ({ ...criterion }));

const activity = (input: Omit<SpeakingActivity, "createdAt" | "updatedAt" | "rubric"> & { rubric?: SpeakingActivity["rubric"] }): SpeakingActivity => {
  const timestamp = now();
  return {
    ...input,
    rubric: input.rubric?.map((criterion) => ({ ...criterion })) ?? cloneRubric(),
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const SPEAKING_TEMPLATES: SpeakingActivity[] = [
  activity({
    id: "template-restaurant",
    teacherId: "demo-teacher",
    title: "At the Restaurant",
    scenario: "The student is ordering lunch at a restaurant.",
    aiRole: "Restaurant worker",
    studentRole: "Customer",
    level: "elementary",
    difficulty: "normal",
    nativeLanguage: "ja",
    durationSeconds: 180,
    joinCode: "EAT456",
    status: "ready",
    identifierMode: "nickname",
    targetExpressions: ["I'd like...", "Can I have...?", "How much is it?", "That's all, thank you."]
  }),
  activity({
    id: "demo-shopping",
    teacherId: "demo-teacher",
    title: "Shopping for Clothes",
    scenario: "The student wants to buy a T-shirt in a clothing store.",
    aiRole: "Shop assistant",
    studentRole: "Customer",
    level: "elementary",
    difficulty: "normal",
    nativeLanguage: "ja",
    durationSeconds: 300,
    joinCode: "ABC123",
    status: "active",
    identifierMode: "nickname",
    targetExpressions: ["I'd like...", "How much is it?", "Do you have...?", "Can I try it on?"]
  }),
  activity({
    id: "template-directions",
    teacherId: "demo-teacher",
    title: "Asking for Directions",
    scenario: "The student is looking for the library and asks a helpful person.",
    aiRole: "Helpful local",
    studentRole: "Visitor",
    level: "beginner",
    difficulty: "easy",
    nativeLanguage: "ja",
    durationSeconds: 120,
    joinCode: "MAP789",
    status: "ready",
    identifierMode: "anonymous",
    targetExpressions: ["Excuse me.", "Where is...?", "How can I get to...?", "Thank you."]
  }),
  activity({
    id: "template-hobbies",
    teacherId: "demo-teacher",
    title: "Talking About Hobbies",
    scenario: "The student meets a new classmate and talks about hobbies.",
    aiRole: "New classmate",
    studentRole: "Student",
    level: "elementary",
    difficulty: "normal",
    nativeLanguage: "ja",
    durationSeconds: 180,
    joinCode: "PLAY12",
    status: "ready",
    identifierMode: "nickname",
    targetExpressions: ["I like...", "I enjoy...", "How about you?", "Me too!"]
  }),
  activity({
    id: "template-weekend",
    teacherId: "demo-teacher",
    title: "Weekend Plans",
    scenario: "The student and a friend make plans for the weekend.",
    aiRole: "Friend",
    studentRole: "Student",
    level: "lower_intermediate",
    difficulty: "challenge",
    nativeLanguage: "ja",
    durationSeconds: 300,
    joinCode: "PLAN34",
    status: "ready",
    identifierMode: "nickname",
    targetExpressions: ["What are you going to do?", "Would you like to...?", "That sounds fun.", "How about Saturday?"]
  }),
  activity({
    id: "template-introduction",
    teacherId: "demo-teacher",
    title: "Self Introduction",
    scenario: "The student meets someone new and shares a few things about themselves.",
    aiRole: "New friend",
    studentRole: "Student",
    level: "beginner",
    difficulty: "easy",
    nativeLanguage: "ja",
    durationSeconds: 120,
    joinCode: "HELLO5",
    status: "ready",
    identifierMode: "nickname",
    targetExpressions: ["My name is...", "I am from...", "I like...", "Nice to meet you."]
  })
];

const defaultActivity = () => SPEAKING_TEMPLATES.find((item) => item.id === "demo-shopping")!;

const demoParticipant = (): SpeakingParticipant => ({
  id: "demo-participant",
  activityId: "demo-shopping",
  displayIdentifier: "山田 花子",
  anonymousToken: "demo-student-token",
  startedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  finishedAt: new Date(Date.now() - 60_000).toISOString(),
  status: "completed",
  helpCount: 1
});

const demoTurns = (): SpeakingTurn[] => [
  { id: "demo-turn-1", participantId: "demo-participant", speaker: "ai", text: "Hi! Can I help you today?", createdAt: new Date(Date.now() - 230_000).toISOString() },
  { id: "demo-turn-2", participantId: "demo-participant", speaker: "student", text: "I want blue T-shirt.", createdAt: new Date(Date.now() - 208_000).toISOString(), transcriptionConfidence: 0.94 },
  { id: "demo-turn-3", participantId: "demo-participant", speaker: "ai", text: "Sure! What size would you like?", createdAt: new Date(Date.now() - 200_000).toISOString() },
  { id: "demo-turn-4", participantId: "demo-participant", speaker: "student", text: "Medium, please. Can I try it on?", createdAt: new Date(Date.now() - 164_000).toISOString(), usedHelp: true, transcriptionConfidence: 0.98 },
  { id: "demo-turn-5", participantId: "demo-participant", speaker: "ai", text: "Of course. The fitting room is over there.", createdAt: new Date(Date.now() - 156_000).toISOString() }
];

export const makeDemoEvaluation = (participantId = "demo-participant"): SpeakingEvaluation => ({
  participantId,
  language: "ja",
  scores: { communication: 4, interaction: 4, vocabulary: 4, grammar: 3, fluency: 3 },
  evidence: {
    communication: "ほしい色とサイズを伝えられました。",
    interaction: "質問に答えて、会話を続けられました。",
    vocabulary: "size や fitting room などの言葉を使えました。",
    grammar: "少し直すところはありますが、意味はよく伝わりました。",
    fluency: "ゆっくりでも、最後まで話そうとできました。"
  },
  strengths: ["ほしいTシャツの色とサイズを伝えられました。", "店員さんの質問に答えて、会話を続けられました。"],
  improvements: ["I want ... より I'd like ... を使うと、もっと自然です。"],
  usefulEnglish: [{ said: "I want blue T-shirt.", try: "I'd like a blue T-shirt, please." }],
  overallMessage: "よくできました！まちがいを気にしすぎず、会話を続けられました。",
  createdAt: now()
});

const defaultStore = (): SpeakingLocalStore => ({
  activities: SPEAKING_TEMPLATES.map((item) => ({ ...item, rubric: item.rubric.map((criterion) => ({ ...criterion })) })),
  sessions: {
    "demo-participant": {
      participant: demoParticipant(),
      activityId: "demo-shopping",
      turns: demoTurns(),
      evaluation: makeDemoEvaluation()
    }
  }
});

const isActivity = (value: unknown): value is SpeakingActivity => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SpeakingActivity>;
  return typeof candidate.id === "string" && typeof candidate.title === "string" && typeof candidate.joinCode === "string" && Array.isArray(candidate.targetExpressions) && Array.isArray(candidate.rubric);
};

export const loadSpeakingStore = (): SpeakingLocalStore => {
  const fallback = defaultStore();
  try {
    const raw = localStorage.getItem(SPEAKING_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SpeakingLocalStore>;
    const activities = Array.isArray(parsed.activities) ? parsed.activities.filter(isActivity) : [];
    const sessions = parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions as Record<string, LocalSpeakingSession> : {};
    const seededIds = new Set(activities.map((item) => item.id));
    const mergedActivities = [...activities, ...fallback.activities.filter((item) => !seededIds.has(item.id))];
    return { activities: mergedActivities, sessions: { ...fallback.sessions, ...sessions } };
  } catch {
    return fallback;
  }
};

export const saveSpeakingStore = (store: SpeakingLocalStore) => {
  try {
    localStorage.setItem(SPEAKING_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // The flow remains usable if storage is disabled or full.
  }
};

export const createActivity = (input: SpeakingCreateActivityInput, teacherId = "demo-teacher"): SpeakingActivity => {
  const timestamp = now();
  const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const joinCode = Array.from({ length: 6 }, () => codeAlphabet[Math.floor(Math.random() * codeAlphabet.length)]).join("");
  return {
    id: makeId("activity"),
    teacherId,
    title: input.title.trim().slice(0, SPEAKING_LIMITS.title),
    scenario: input.scenario.trim().slice(0, SPEAKING_LIMITS.scenario),
    aiRole: input.aiRole.trim().slice(0, SPEAKING_LIMITS.role),
    studentRole: input.studentRole.trim().slice(0, SPEAKING_LIMITS.role),
    level: input.level,
    difficulty: input.difficulty,
    nativeLanguage: input.nativeLanguage,
    durationSeconds: Math.min(SPEAKING_LIMITS.maxDurationSeconds, Math.max(120, Math.round(input.durationSeconds))),
    joinCode,
    status: "ready",
    identifierMode: input.identifierMode,
    targetExpressions: input.targetExpressions.map((expression) => expression.trim().slice(0, SPEAKING_LIMITS.expression)).filter(Boolean).slice(0, SPEAKING_LIMITS.expressions),
    rubric: input.rubric.filter((criterion) => criterion.enabled).slice(0, SPEAKING_LIMITS.rubricCriteria).map((criterion) => ({ ...criterion })),
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const activityByCode = (store: SpeakingLocalStore, code: string) => store.activities.find((item) => item.joinCode === code.trim().toUpperCase() && item.status !== "ended");

export const activityById = (store: SpeakingLocalStore, id: string) => store.activities.find((item) => item.id === id);

export const createLocalSession = (activity: SpeakingActivity, identifier: string): LocalSpeakingSession => {
  const participantId = makeId("participant");
  const participant: SpeakingParticipant = {
    id: participantId,
    activityId: activity.id,
    ...(identifier.trim() ? { displayIdentifier: identifier.trim().slice(0, 80) } : {}),
    anonymousToken: makeId("speaking-token"),
    startedAt: now(),
    status: "in_progress",
    helpCount: 0
  };
  const greeting: SpeakingTurn = {
    id: makeId("turn"),
    participantId,
    speaker: "ai",
    text: activity.id === "demo-shopping" ? "Hi! Can I help you today?" : `Hi! I'm your ${activity.aiRole}. Let's begin.`,
    createdAt: now()
  };
  return { participant, activityId: activity.id, turns: [greeting] };
};

export const appendTurn = (session: LocalSpeakingSession, turn: Omit<SpeakingTurn, "id" | "createdAt" | "participantId">): LocalSpeakingSession => ({
  ...session,
  turns: [...session.turns, { ...turn, id: makeId("turn"), participantId: session.participant.id, createdAt: now() }]
});

export const getActivityResult = (store: SpeakingLocalStore, participantId: string) => {
  const session = store.sessions[participantId];
  if (!session) return undefined;
  const activity = activityById(store, session.activityId) ?? defaultActivity();
  return { ...session, activity };
};

export const formatDuration = (seconds: number) => `${Math.floor(Math.max(0, Math.round(seconds)) / 60)}:${String(Math.max(0, Math.round(seconds)) % 60).padStart(2, "0")}`;
