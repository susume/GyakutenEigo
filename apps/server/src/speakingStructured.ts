import type { SpeakingActivity, SpeakingEvaluation, SpeakingGoalRequirement, SpeakingStructuredPlan, SpeakingTurn } from "@quizstrike/shared";

const stopWords = new Set("i me my we our a an the this that is am are was were it of to in on for do did you".split(" "));
const equivalents: Record<string, string> = {
  liked: "like", love: "like", loved: "like", enjoy: "like", enjoyed: "like",
  went: "go", traveled: "go", travelled: "go", visited: "go",
  ate: "eat", had: "eat", purchased: "buy", bought: "buy",
  football: "soccer", movies: "movie", films: "movie", film: "movie", books: "book"
};
const words = (text: string) => text.normalize("NFKC").toLowerCase().match(/[a-z]+(?:'[a-z]+)?|[0-9]+/gu) ?? [];
const concepts = (text: string) => words(text).filter((word) => !stopWords.has(word)).map((word) => Object.hasOwn(equivalents, word) ? equivalents[word]! : word);
const close = "Thank you for talking with me. You can finish now.";
const clarification = /^(?:(?:could|can|would) you (?:repeat|say that again)|(?:please )?say that again|what do you mean|sorry[.?! ]*$)/iu;
const question = /\?|^(?:what|where|when|why|who|how|can|could|would|do|does|did|is|are|have)\b/iu;

export function defaultStructuredPlan(activity: SpeakingActivity): SpeakingStructuredPlan {
  const opening = activity.scenarioResources?.openingLine?.trim();
  const goals = activity.scenarioResources?.successConditions ?? [];
  const detail = activity.difficulty === "easy" ? "Can you tell me one more thing?" : "Why, or can you give an example?";
  return { steps: [
    { question: opening?.slice(0, 180) || "Can you tell me about this topic?", objective: goals[0]?.slice(0, 180) || "Respond to the opening question", concepts: [], kind: "answer" },
    { question: detail, objective: goals[1]?.slice(0, 180) || "Add a relevant detail", concepts: [], kind: "answer" },
    ...(activity.difficulty === "easy" ? [] : [{ question: "What would you like to ask me?", objective: "Ask the partner a question", concepts: [], kind: "question" as const }])
  ] };
}

function matches(text: string, cues: string[]) {
  const tokens = new Set(concepts(text));
  return cues.some((cue) => {
    const expected = concepts(cue);
    return expected.length > 0 && expected.every((word) => tokens.has(word));
  });
}

/** Replays the persisted answers so recovery and evaluation use the same evidence. */
export function structuredProgress(plan: SpeakingStructuredPlan, turns: SpeakingTurn[]) {
  const evidence = new Map<number, string[]>();
  let index = 0;
  let repaired = false;
  let followUp = false;
  let reply = plan.steps[0]!.question;
  const questionEvidence: string[] = [];
  for (const turn of turns) {
    const step = plan.steps[index];
    if (!step || turn.speaker !== "student") continue;
    const text = turn.text.trim().replace(/[’‘]/gu, "'");
    const askedToRepeat = clarification.test(text);
    const asksQuestion = question.test(text);
    const prompt = followUp ? step.followUp! : step.question;
    const polarAnswer = /^(?:yes|no)\b/iu.test(text) && /^(?:do|did|does|can|could|is|are|have|has|would|will)\b/iu.test(prompt);
    const hasContent = polarAnswer || concepts(text).some((word) => !/^(?:yes|no|um|uh|okay|ok|hmm)$/u.test(word));
    const recognized = !turn.transcriptionUncertain && hasContent && !askedToRepeat;
    if (recognized && asksQuestion) questionEvidence.push(turn.id);
    const cueMatch = recognized && !asksQuestion && !/\b(?:not|never|\w+n't)\b/iu.test(text) && matches(text, step.concepts);
    // Generic prompts can advance the dialogue even when the response needs
    // human review. Only authored cues or an explicit question supply scores.
    const countsAsEvidence = step.kind === "question" ? recognized && asksQuestion : cueMatch;
    if (countsAsEvidence) evidence.set(index, [...(evidence.get(index) ?? []), turn.id]);
    if ((!recognized || (step.kind === "question" && !asksQuestion)) && !repaired) {
      repaired = true;
      reply = `Let me ask again. ${prompt}`;
      continue;
    }
    if (cueMatch && step.followUp && !followUp) {
      followUp = true;
      repaired = false;
      reply = step.followUp;
      continue;
    }
    index++;
    repaired = false;
    followUp = false;
    reply = plan.steps[index]?.question ?? close;
  }
  return { reply, evidence, questionEvidence, complete: index === plan.steps.length };
}

export function assessStructuredConversation(plan: SpeakingStructuredPlan, activity: SpeakingActivity, turns: SpeakingTurn[], participantId: string, createdAt: string): SpeakingEvaluation {
  const { evidence, questionEvidence } = structuredProgress(plan, turns);
  const ja = activity.nativeLanguage === "ja";
  const review = ja ? "先生による確認が必要です。" : "Teacher review is needed.";
  const requirements: SpeakingGoalRequirement[] = plan.steps.map((step, index) => {
    const evidenceTurnIds = evidence.get(index) ?? [];
    return { requirement: step.objective, status: evidenceTurnIds.length ? "completed" : "uncertain", evidenceTurnIds };
  });
  const confirmed = requirements.filter((goal) => goal.status === "completed").length;
  const scores: SpeakingEvaluation["scores"] = {};
  const descriptions: SpeakingEvaluation["evidence"] = {};
  for (const criterion of activity.rubric.filter((item) => item.enabled)) {
    const score = criterion.id === "task_achievement" && confirmed === requirements.length
      ? 4
      : criterion.id === "interaction" && questionEvidence.length > 0 ? 3 : null;
    scores[criterion.id] = score;
    descriptions[criterion.id] = criterion.id === "interaction" && score !== null
      ? ja ? "会話の記録に、生徒からの質問がありました。" : "The device transcript contains a student question."
      : criterion.id === "task_achievement" && confirmed > 0
        ? `${ja ? `${confirmed}件の目標に対応する発言が記録されました。` : `Device transcripts supplied evidence for ${confirmed} objective(s).`}${score === null ? ` ${review}` : ""}`
        : review;
  }
  const scored = Object.values(scores).some((score) => score !== null);
  return {
    participantId, language: activity.nativeLanguage, createdAt, scores, evidence: descriptions,
    assessmentStatus: scored ? "scored" : "insufficient_evidence",
    ...(!scored ? { notScoredReason: review } : {}),
    goalCompletion: { completed: confirmed === requirements.length, requirements },
    overallMessage: ja ? "端末の文字起こしを使った暫定結果です。先生が発言と評価を確認します。" : "This provisional result uses device transcripts. Your teacher can review the evidence.",
    strengths: confirmed ? [ja ? "会話の目標につながる内容を伝えました。" : "You gave information that supported a conversation objective."] : [],
    improvements: [ja ? "答えに理由や具体例を一つ添えてみましょう。" : "Try adding a reason or an example to your answer."],
    usefulEnglish: []
  };
}
