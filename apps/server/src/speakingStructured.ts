import { SPEAKCHECK_MOONSHINE, readingWords, type SpeakingActivity, type SpeakingEvaluation, type SpeakingGoalRequirement, type SpeakingStructuredPlan, type SpeakingTurn } from "@quizstrike/shared";

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
const polarPrompt = /^(?:do|did|does|can|could|is|are|have|has|would|will|were|was)\b/iu;
const needsHelp = /^(?:i (?:do not|don't) (?:understand|know)|i (?:can not|can't) hear|(?:please )?repeat|pardon|one more time)\b/iu;
const correction = /\b(?:sorry,? i mean|i mean|actually)\b[ ,]*/iu;
const otherPerson = /^(?:he|she|they|my [a-z]+) (?:likes?|loves?|went|goes?|played|plays?|bought|buys?|ate|eats?|stayed|stays?)\b/u;
const learnerForms: Record<string, string> = { played: "play", plays: "play", stayed: "stay", stays: "stay", shopping: "shop" };
const adaptiveConcepts = (text: string) => concepts(text).map((word) => Object.hasOwn(learnerForms, word) ? learnerForms[word]! : word);
const supportsCue = (response: string[], cue: string) => {
  const expected = adaptiveConcepts(readingWords(cue).join(" "));
  return expected.length > 0 && response.some((_, index) =>
    expected.every((word, offset) => response[index + offset] === word)
  );
};

function adaptiveProgress(plan: SpeakingStructuredPlan, turns: SpeakingTurn[]) {
  const evidence = new Map<number, string[]>();
  const questionEvidence: string[] = [];
  const uncertainTurnIds: string[] = [];
  let index = 0;
  let attempted = 0;
  let repaired = false;
  let branch: string | undefined;
  let reply = plan.steps[0]!.question;
  let complete = false;
  for (const turn of turns) {
    if (complete || turn.speaker !== "student") continue;
    const step = plan.steps[index]!;
    const utterance = turn.text.trim().replace(/[’‘]/gu, "'");
    const clause = utterance.split(correction).filter((part) => part.trim()).at(-1) ?? "";
    const correctsPrevious = !!branch && correction.test(utterance) && correction.exec(utterance)?.index === 0;
    const normalized = readingWords(clause).join(" ");
    const prompt = branch ?? step.question;
    const polar = polarPrompt.test(prompt);
    const asksQuestion = question.test(clause) && !/^(?:yes|no)\b/iu.test(clause);
    const unavailable = turn.transcriptionUncertain || clarification.test(clause) || needsHelp.test(normalized)
      || !concepts(clause).some((word) => !/^(?:yes|no|um|uh|okay|ok|hmm)$/u.test(word)) && !/^(?:yes|no)\b/u.test(polar ? normalized : "");
    if (unavailable) uncertainTurnIds.push(turn.id);
    const negative = /(?:^no\b|\b(?:not|never|nothing|nowhere|nobody)\b)/u.test(normalized);
    const response = adaptiveConcepts(normalized);
    const ownExperience = !/\byou\b/iu.test(step.question) || !otherPerson.test(normalized);
    const primary = !unavailable && !asksQuestion && ownExperience && step.concepts.some((cue) => supportsCue(response, cue));
    const alternate = !unavailable && !asksQuestion && ownExperience && step.alternateConcepts?.some((cue) => supportsCue(response, cue));
    if (correctsPrevious && !unavailable && !asksQuestion && (primary || alternate)) {
      evidence.delete(index);
      branch = undefined;
    }
    const supported = !unavailable && (step.kind === "question" ? asksQuestion
      : !branch && !asksQuestion && (negative ? step.acceptsNegative && (polar || primary || alternate) : primary || alternate || polar && /^yes\b/u.test(normalized)));
    if (supported) {
      evidence.set(index, [turn.id]);
      if (step.kind === "question") questionEvidence.push(turn.id);
    }
    attempted++;
    const nextBranch = !branch && !unavailable && !asksQuestion
      ? negative ? step.negativeFollowUp : alternate ? step.alternateFollowUp ?? step.followUp : primary ? step.followUp : undefined
      : undefined;
    if (nextBranch) {
      branch = nextBranch;
      repaired = false;
      reply = nextBranch;
    } else if (!repaired && (unavailable || (step.kind === "question" && !asksQuestion) ||
      (!branch && !supported && !negative && (step.concepts.length || step.alternateConcepts?.length)))) {
      repaired = true;
      reply = step.clarification ?? `Let me ask again. ${prompt}`;
    } else {
      index++;
      branch = undefined;
      repaired = false;
      reply = plan.steps[index]?.question ?? close;
    }
    complete = index === plan.steps.length || attempted >= (plan.maxResponses ?? 11)
      || (!branch && plan.completeAfter !== undefined && evidence.size >= plan.completeAfter);
    if (complete) reply = close;
  }
  return { reply, evidence, questionEvidence, complete, uncertainTurnIds };
}

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
  if (plan.version === 2) return adaptiveProgress(plan, turns);
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
  return { reply, evidence, questionEvidence, complete: index === plan.steps.length, uncertainTurnIds: [] };
}

export function assessStructuredConversation(plan: SpeakingStructuredPlan, activity: SpeakingActivity, turns: SpeakingTurn[], participantId: string, createdAt: string): SpeakingEvaluation {
  const { evidence, questionEvidence, uncertainTurnIds } = structuredProgress(plan, turns);
  const ja = activity.nativeLanguage === "ja";
  const review = ja ? "先生による確認が必要です。" : "Teacher review is needed.";
  const requirements: SpeakingGoalRequirement[] = plan.steps.map((step, index) => {
    const evidenceTurnIds = evidence.get(index) ?? [];
    return { requirement: step.objective, status: evidenceTurnIds.length ? "completed" : "uncertain", evidenceTurnIds };
  });
  const confirmed = requirements.filter((goal) => goal.status === "completed").length;
  const target = plan.version === 2 ? plan.completeAfter ?? requirements.length : requirements.length;
  const scores: SpeakingEvaluation["scores"] = {};
  const descriptions: SpeakingEvaluation["evidence"] = {};
  for (const criterion of activity.rubric.filter((item) => item.enabled)) {
    const score = criterion.id === "task_achievement" && confirmed >= target
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
    goalCompletion: { completed: confirmed >= target, requirements },
    ...(plan.version === 2 ? { assessmentEvidence: {
      version: 1, algorithm: "structured-rules-v2", source: "client_transcript",
      expectedRecognizer: `${SPEAKCHECK_MOONSHINE.id}@${SPEAKCHECK_MOONSHINE.revision}`,
      criteria: Object.fromEntries(Object.entries(scores).map(([id]) => [id, {
        turnIds: id === "task_achievement" ? [...evidence.values()].flat() : id === "interaction" ? questionEvidence : [],
        rule: id === "task_achievement" ? "authored_objectives" : id === "interaction" ? "requested_question" : "insufficient_evidence",
        reviewRequired: true
      }])),
      uncertainTurnIds
    } } : {}),
    overallMessage: ja ? "端末の文字起こしを使った暫定結果です。先生が発言と評価を確認します。" : "This provisional result uses device transcripts. Your teacher can review the evidence.",
    strengths: confirmed ? [ja ? "会話の目標につながる内容を伝えました。" : "You gave information that supported a conversation objective."] : [],
    improvements: [ja ? "答えに理由や具体例を一つ添えてみましょう。" : "Try adding a reason or an example to your answer."],
    usefulEnglish: []
  };
}
