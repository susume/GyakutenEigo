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
    targetExpressions: ["I'd like...", "Can I have...?", "How much is it?", "That's all, thank you."],
    scenarioResources: {
      openingLine: "Hello! What would you like to order?",
      studentGoal: "Order a meal, ask one question, and close the conversation politely.",
      suggestedSteps: ["Greet the restaurant worker.", "Order a meal.", "Ask about one item.", "Check your order.", "Thank the worker."],
      usefulVocabulary: ["menu", "still water", "I'd like…", "That's all, thank you."],
      referenceItems: [{ label: "Soup", detail: "$5" }, { label: "Sandwich", detail: "$8" }, { label: "Orange juice", detail: "$3" }],
      imageSrc: "/assets/speaking/ai-shop-assistant.png",
      imageAlt: "Speaking partner"
    }
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
    targetExpressions: ["I'd like...", "How much is it?", "Do you have...?", "Can I try it on?"],
    scenarioResources: {
      openingLine: "Hi! Can I help you find something today?",
      studentGoal: "Ask about an item, try it on, and decide what you would like.",
      suggestedSteps: ["Say what you are looking for.", "Ask about size or color.", "Ask the price.", "Ask to try it on.", "Thank the shop assistant."],
      usefulVocabulary: ["size", "color", "fitting room", "How much is it?"],
      referenceItems: [{ label: "Blue T-shirt", detail: "$18" }, { label: "Black hoodie", detail: "$35" }],
      imageSrc: "/assets/speaking/ai-shop-assistant.png",
      imageAlt: "Shop assistant"
    }
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
    targetExpressions: ["Excuse me.", "Where is...?", "How can I get to...?", "Thank you."],
    scenarioResources: {
      openingLine: "Hello! Are you looking for somewhere nearby?",
      studentGoal: "Ask for directions, check one detail, and thank your partner.",
      suggestedSteps: ["Say excuse me.", "Name the place you need.", "Ask how to get there.", "Check one direction.", "Thank your partner."],
      usefulVocabulary: ["library", "turn left", "turn right", "next to"]
    }
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
    targetExpressions: ["I like...", "I enjoy...", "How about you?", "Me too!"],
    scenarioResources: {
      openingLine: "Hi! What do you like to do in your free time?",
      studentGoal: "Share one hobby and ask your partner about theirs.",
      suggestedSteps: ["Share one hobby.", "Give one detail.", "Ask your partner a question.", "React to their answer.", "Keep the conversation going."],
      usefulVocabulary: ["free time", "usually", "on weekends", "How about you?"]
    }
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
    targetExpressions: ["What are you going to do?", "Would you like to...?", "That sounds fun.", "How about Saturday?"],
    scenarioResources: {
      openingLine: "Hi! Do you have any plans for the weekend?",
      studentGoal: "Suggest a plan, ask about timing, and respond to your partner.",
      suggestedSteps: ["Ask about plans.", "Suggest one activity.", "Ask about a day or time.", "Respond to the suggestion.", "Agree on a next step."],
      usefulVocabulary: ["Saturday", "Sunday", "available", "That sounds fun."]
    }
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
    targetExpressions: ["My name is...", "I am from...", "I like...", "Nice to meet you."],
    scenarioResources: {
      openingLine: "Hi! Nice to meet you. What is your name?",
      studentGoal: "Introduce yourself and ask your new partner one question.",
      suggestedSteps: ["Say your name.", "Share where you are from.", "Share one interest.", "Ask your partner a question.", "Say nice to meet you."],
      usefulVocabulary: ["name", "from", "school", "Nice to meet you."]
    }
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
