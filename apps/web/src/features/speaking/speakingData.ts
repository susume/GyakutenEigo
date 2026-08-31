import {
  DEFAULT_SPEAKING_RUBRIC,
  SPEAKING_LIMITS,
  type SpeakingActivity,
  type SpeakingEvaluation
} from "@quizstrike/shared";

// These are static lesson templates and explicitly labeled home-page previews.
// Real activities, sessions, transcripts, and results come from speakingApi.
const now = () => new Date().toISOString();
const cloneRubric = () => DEFAULT_SPEAKING_RUBRIC.map((criterion) => ({ ...criterion }));

const template = (input: Omit<SpeakingActivity, "createdAt" | "updatedAt" | "rubric"> & { rubric?: SpeakingActivity["rubric"] }): SpeakingActivity => {
  const timestamp = now();
  return {
    ...input,
    rubric: input.rubric?.map((criterion) => ({ ...criterion })) ?? cloneRubric(),
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const SPEAKING_TEMPLATES: SpeakingActivity[] = [
  template({
    id: "template-restaurant",
    teacherId: "preview-template",
    title: "At the Restaurant",
    scenario: "The student is ordering lunch at a restaurant.",
    aiRole: "Restaurant worker",
    studentRole: "Customer",
    level: "elementary",
    difficulty: "normal",
    nativeLanguage: "ja",
    durationSeconds: 180,
    status: "ready",
    identifierMode: "nickname",
    targetExpressions: ["I'd like...", "Can I have...?", "How much is it?", "That's all, thank you."]
  }),
  template({
    id: "template-shopping",
    teacherId: "preview-template",
    title: "Shopping for Clothes",
    scenario: "The student wants to buy a T-shirt in a clothing store.",
    aiRole: "Shop assistant",
    studentRole: "Customer",
    level: "elementary",
    difficulty: "normal",
    nativeLanguage: "ja",
    durationSeconds: 300,
    status: "ready",
    identifierMode: "nickname",
    targetExpressions: ["I'd like...", "How much is it?", "Do you have...?", "Can I try it on?"]
  }),
  template({
    id: "template-directions",
    teacherId: "preview-template",
    title: "Asking for Directions",
    scenario: "The student is looking for the library and asks a helpful person.",
    aiRole: "Helpful local",
    studentRole: "Visitor",
    level: "beginner",
    difficulty: "easy",
    nativeLanguage: "ja",
    durationSeconds: 120,
    status: "ready",
    identifierMode: "anonymous",
    targetExpressions: ["Excuse me.", "Where is...?", "How can I get to...?", "Thank you."]
  }),
  template({
    id: "template-hobbies",
    teacherId: "preview-template",
    title: "Talking About Hobbies",
    scenario: "The student meets a new classmate and talks about hobbies.",
    aiRole: "New classmate",
    studentRole: "Student",
    level: "elementary",
    difficulty: "normal",
    nativeLanguage: "ja",
    durationSeconds: 180,
    status: "ready",
    identifierMode: "nickname",
    targetExpressions: ["I like...", "I enjoy...", "How about you?", "Me too!"]
  }),
  template({
    id: "template-weekend",
    teacherId: "preview-template",
    title: "Weekend Plans",
    scenario: "The student and a friend make plans for the weekend.",
    aiRole: "Friend",
    studentRole: "Student",
    level: "lower_intermediate",
    difficulty: "challenge",
    nativeLanguage: "ja",
    durationSeconds: 300,
    status: "ready",
    identifierMode: "nickname",
    targetExpressions: ["What are you going to do?", "Would you like to...?", "That sounds fun.", "How about Saturday?"]
  }),
  template({
    id: "template-introduction",
    teacherId: "preview-template",
    title: "Self Introduction",
    scenario: "The student meets someone new and shares a few things about themselves.",
    aiRole: "New friend",
    studentRole: "Student",
    level: "beginner",
    difficulty: "easy",
    nativeLanguage: "ja",
    durationSeconds: 120,
    status: "ready",
    identifierMode: "nickname",
    targetExpressions: ["My name is...", "I am from...", "I like...", "Nice to meet you."]
  })
];

/**
 * Used only by the clearly labeled home-page result preview. It is not read by
 * a live result route and is never used as a fallback for a real participant.
 */
export const makeDemoEvaluation = (participantId = "demo-participant"): SpeakingEvaluation => ({
  participantId,
  language: "ja",
  assessmentStatus: "scored",
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

export const formatDuration = (seconds: number) => {
  const bounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(bounded / 60)}:${String(bounded % 60).padStart(2, "0")}`;
};

export const previewActivityLimits = {
  maxDurationSeconds: SPEAKING_LIMITS.maxDurationSeconds,
  maxExpressions: SPEAKING_LIMITS.expressions
} as const;
