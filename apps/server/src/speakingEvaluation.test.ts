import assert from "node:assert/strict";
import test from "node:test";
import { SpeakingEvaluationSchema, type SpeakingActivity, type SpeakingEvaluation, type SpeakingTurn } from "@quizstrike/shared";
import { buildSpeakingInteractionMetadata, nextSpeakingEvaluationRetryAt, sanitizeSpeakingEvaluation, speakingGoalRequirements } from "./speakingEvaluation.js";
import { buildConversationPrompt, buildEvaluationPrompt } from "./speakingPrompts.js";

const activity = {
  id: "restaurant-regression",
  teacherId: "teacher-1",
  title: "At the Restaurant",
  scenario: "The student is ordering lunch at a restaurant.",
  aiRole: "Restaurant worker",
  studentRole: "Customer",
  level: "elementary",
  difficulty: "normal",
  nativeLanguage: "en",
  durationSeconds: 180,
  status: "ready",
  identifierMode: "nickname",
  targetExpressions: ["I'd like...", "Can I have...?", "How much is it?", "That's all, thank you."],
  scenarioResources: {
    studentGoal: "Order a meal, ask one question, and close the conversation politely.",
    suggestedSteps: ["Order a meal.", "Ask about one item.", "Thank the worker."],
    usefulVocabulary: ["menu", "burger", "water"],
    referenceItems: [{ label: "Burger", detail: "$8" }]
  },
  rubric: [
    { id: "communication", name: "Communication", description: "Communicate what you want.", enabled: true },
    { id: "interaction", name: "Interaction", description: "Keep the conversation moving.", enabled: true },
    { id: "vocabulary", name: "Vocabulary", description: "Use useful words.", enabled: true },
    { id: "grammar", name: "Grammar", description: "Make understandable sentences.", enabled: true },
    { id: "fluency", name: "Fluency / Comprehensibility", description: "Communicate without too much difficulty.", enabled: true }
  ],
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z"
} satisfies SpeakingActivity;

const turns: SpeakingTurn[] = [
  { id: "ai-1", participantId: "p-1", speaker: "ai", text: "What would you like?", createdAt: "2026-09-12T00:00:01.000Z" },
  { id: "student-1", participantId: "p-1", speaker: "student", text: "I want to burger.", createdAt: "2026-09-12T00:00:02.000Z", audioDurationMs: 850, transcriptionConfidence: 0.96 },
  { id: "ai-2", participantId: "p-1", speaker: "ai", text: "What would you like?", createdAt: "2026-09-12T00:00:03.000Z" },
  { id: "student-2", participantId: "p-1", speaker: "student", text: "I want cheeseburger.", createdAt: "2026-09-12T00:00:04.000Z", audioDurationMs: 760, transcriptionConfidence: 0.95 },
  { id: "ai-3", participantId: "p-1", speaker: "ai", text: "What would you like?", createdAt: "2026-09-12T00:00:05.000Z" },
  { id: "student-3", participantId: "p-1", speaker: "student", text: "I want water.", createdAt: "2026-09-12T00:00:06.000Z", audioDurationMs: 600, transcriptionConfidence: 0.95 }
];

const providerEvaluation = (overrides: Partial<SpeakingEvaluation> = {}): SpeakingEvaluation => ({
  participantId: "p-1",
  language: "en",
  assessmentStatus: "scored",
  scores: { communication: 4, interaction: 4, vocabulary: 4, grammar: 4, fluency: 4 },
  evidence: {
    communication: "The student ordered food.",
    interaction: "The student replied.",
    vocabulary: "The student used food words.",
    grammar: "The message was understandable.",
    fluency: "The student communicated clearly."
  },
  strengths: ["You kept trying."],
  improvements: [],
  usefulEnglish: [{ said: "I want burger.", try: "I'd like a burger, please.", sourceTurnId: "student-1" }],
  goalCompletion: {
    completed: true,
    requirements: [{ requirement: "Ask one question", status: "completed", evidenceTurnIds: ["fake-turn"] }]
  },
  overallMessage: "Good work.",
  createdAt: "2026-09-12T00:01:00.000Z",
  ...overrides
});

test("evaluation sanitizer preserves exact transcript evidence and caps overgenerous scoring", () => {
  const metadata = buildSpeakingInteractionMetadata(turns);
  assert.equal(metadata.repeatedQuestionCount, 0);
  const sanitized = sanitizeSpeakingEvaluation(providerEvaluation(), activity, turns, metadata);

  assert.equal(sanitized.goalCompletion?.completed, false);
  assert.equal(sanitized.goalCompletion?.requirements.some((item) => item.status === "not_completed" && /ask/i.test(item.requirement)), true);
  assert.ok(sanitized.goalCompletion?.requirements.every((item) => item.evidenceTurnIds.every((id) => turns.some((turn) => turn.id === id))));
  assert.equal(sanitized.scores.communication, 3);
  assert.equal(sanitized.scores.interaction, 3);
  assert.equal(sanitized.scores.grammar, 3);
  assert.equal(sanitized.scores.vocabulary, 3);
  assert.equal(sanitized.scores.fluency, 4);
  assert.equal(sanitized.usefulEnglish.some((item) => item.said === "I want burger."), false);
  assert.deepEqual(sanitized.usefulEnglish.find((item) => item.sourceTurnId === "student-1"), {
    said: "I want to burger.",
    try: "I'd like a burger, please.",
    sourceTurnId: "student-1"
  });
  assert.ok(sanitized.improvements.some((item) => /question/i.test(item)));
  assert.match(sanitized.evidence.interaction ?? "", /task/u);
});

test("interaction metadata does not mistake every normal follow-up for a repeated question", () => {
  const naturalExchange: SpeakingTurn[] = [
    turns[0]!,
    turns[1]!,
    { id: "ai-natural", participantId: "p-1", speaker: "ai", text: "Would you like a drink with that?", createdAt: "2026-09-12T00:00:03.000Z" }
  ];
  assert.equal(buildSpeakingInteractionMetadata(naturalExchange).repeatedQuestionCount, 0);
});

test("fluency and corrections stay cautious when timing or ASR evidence is weak", () => {
  const noTiming = turns.map(({ audioDurationMs: _audioDurationMs, ...turn }) => turn);
  const noTimingEvaluation = sanitizeSpeakingEvaluation(providerEvaluation(), activity, noTiming);
  assert.equal(noTimingEvaluation.scores.fluency, null);
  assert.match(noTimingEvaluation.evidence.fluency ?? "", /timing|流暢/u);

  const uncertainTurn: SpeakingTurn = { id: "student-uncertain", participantId: "p-1", speaker: "student", text: "Just oh.", createdAt: "2026-09-12T00:00:08.000Z", transcriptionConfidence: 0.4, audioDurationMs: 300 };
  const uncertain = sanitizeSpeakingEvaluation(providerEvaluation({ usefulEnglish: [{ said: uncertainTurn.text, try: "I'd like...", sourceTurnId: uncertainTurn.id }] }), { ...activity, scenarioResources: { studentGoal: "Say one sentence." } }, [uncertainTurn]);
  assert.deepEqual(uncertain.usefulEnglish, []);
  assert.equal(uncertain.scores.fluency, 4);
});

test("prompts include the task goal and independence guardrails", () => {
  const conversation = buildConversationPrompt({ activity, turns: turns.slice(0, 2), latestStudentText: turns[1]!.text });
  assert.match(conversation, /Order a meal, ask one question/u);
  assert.match(conversation, /performance test/u);
  assert.match(conversation, /Do not repeatedly ask/u);
  const evaluation = buildEvaluationPrompt({ activity, turns, rubric: activity.rubric, timingMetadata: { reliableAudioTiming: true, studentAudioDurationMs: 2_210 }, interactionMetadata: buildSpeakingInteractionMetadata(turns) });
  assert.match(evaluation, /sourceTurnId/u);
  assert.match(evaluation, /evidenceTurnIds/u);
  assert.match(evaluation, /Reference items/u);
  assert.match(evaluation, /semantic equivalents count; exact wording is not required/u);
});

test("retry policy is bounded and jittered around the documented schedule", () => {
  const now = "2026-09-12T00:00:00.000Z";
  assert.equal(nextSpeakingEvaluationRetryAt(now, 1, () => 0.5), "2026-09-12T00:00:10.000Z");
  assert.equal(nextSpeakingEvaluationRetryAt(now, 4, () => 0.5), "2026-09-12T00:05:00.000Z");
  assert.equal(nextSpeakingEvaluationRetryAt(now, 5, () => 0.5), undefined);
});

test("goal validation preserves semantic judgment and rejects fabricated or unrelated evidence", () => {
  const custom = { ...activity, scenarioResources: { studentGoal: "Describe your family and friends, and ask one question." } };
  assert.deepEqual(speakingGoalRequirements(custom), ["Describe your family and friends", "ask one question"]);
  const result = sanitizeSpeakingEvaluation(providerEvaluation({ goalCompletion: {
    completed: false,
    requirements: [
      { requirement: "ask one question", status: "completed", evidenceTurnIds: ["fake"] },
      { requirement: "Describe your family and friends", status: "not_completed", evidenceTurnIds: [] }
    ]
  } }), custom, turns);
  assert.deepEqual(result.goalCompletion?.requirements.map((item) => item.status), ["not_completed", "not_completed"]);

  const semanticTurns = [{ ...turns[1]!, text: "Could I get a cheeseburger, please?" }];
  const semanticActivity = { ...activity, scenarioResources: { studentGoal: "Order a meal." } };
  const semantic = sanitizeSpeakingEvaluation(providerEvaluation({ goalCompletion: {
    completed: true, requirements: [{ requirement: "Order a meal", status: "completed", evidenceTurnIds: ["student-1"] }]
  } }), semanticActivity, semanticTurns);
  assert.equal(semantic.goalCompletion?.completed, true);
  assert.equal(semantic.scores.communication, 4);
});

test("actual restaurant name repair is detected without penalizing normal menu follow-ups", () => {
  const exchange = [
    ["ai", "Can I get a name for the order?"], ["student", "Okay."],
    ["ai", "Okay, and what name should I put on the order?"], ["student", "Lucas"],
    ["ai", "Would you like a drink with your cheeseburger?"], ["student", "I want Coke too."],
    ["ai", "Would you like fries with your cheeseburger?"], ["student", "No thank you."]
  ].map(([speaker, text], index) => ({ ...turns[0]!, id: `repair-${index}`, speaker: speaker as SpeakingTurn["speaker"], text: text! }));
  assert.equal(buildSpeakingInteractionMetadata(exchange).repeatedQuestionCount, 1);
  const result = sanitizeSpeakingEvaluation(providerEvaluation(), activity, exchange);
  assert.equal(result.scores.interaction, 3);
  assert.match(result.evidence.interaction!, /repeated/);
});

test("added coaching stays within schema limits and low-confidence orders are not corrected", () => {
  const result = sanitizeSpeakingEvaluation(providerEvaluation({ improvements: Array.from({ length: 5 }, (_, i) => `Advice ${i}`) }), activity, turns);
  assert.equal(SpeakingEvaluationSchema.safeParse(result).success, true);
  assert.ok(result.improvements.some((item) => /question/.test(item)));
  const uncertain = turns.map((turn) => ({ ...turn, transcriptionConfidence: 0.2 }));
  const uncertainResult = sanitizeSpeakingEvaluation(providerEvaluation(), activity, uncertain);
  assert.equal(uncertainResult.scores.grammar, 4);
  assert.deepEqual(uncertainResult.usefulEnglish, []);
});

test("recording length cannot support pause claims anywhere in feedback", () => {
  const result = sanitizeSpeakingEvaluation(providerEvaluation({
    strengths: ["You spoke smoothly without hesitation."],
    improvements: ["Use fewer pauses."],
    overallMessage: "You spoke fluently.",
    evidence: { ...providerEvaluation().evidence, fluency: "There were few pauses." }
  }), activity, turns);
  assert.doesNotMatch(JSON.stringify(result), /smoothly|hesitation|few pauses|fluently/);
  const partialTiming = turns.map((turn, i) => i === 1 ? { ...turn, audioDurationMs: undefined } : turn);
  assert.equal(sanitizeSpeakingEvaluation(providerEvaluation(), activity, partialTiming).scores.fluency, null);
});
