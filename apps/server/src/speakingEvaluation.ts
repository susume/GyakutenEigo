import {
  speakingFeedbackCopy,
  speakingScenarioResources,
  type SpeakingActivity,
  type SpeakingEvaluation,
  type SpeakingGoalCompletion,
  type SpeakingGoalRequirement,
  type SpeakingTurn
} from "@quizstrike/shared";

/** Bump when the evaluator's evidence contract or scoring guardrails change. */
export const SPEAKING_EVALUATOR_PROMPT_VERSION = "2026-09-12-goal-v1";

export const SPEAKING_EVALUATION_MAX_ATTEMPTS = 5;
export const SPEAKING_EVALUATION_RETRY_DELAYS_MS = [10_000, 30_000, 120_000, 300_000] as const;

export type SpeakingInteractionMetadata = {
  studentTurnCount: number;
  independentResponseCount: number;
  helpedTurnCount: number;
  aiRepairPromptCount: number;
  repeatedQuestionCount: number;
  reliableAudioTurnCount: number;
};

const questionLike = (value: string) => /\?|(?:^|[.!?,]\s+)(?:what|where|when|who|why|how|can|could|do|does|is|are|will|would|may)\b/iu.test(value.trim());
const repairLike = (value: string) => /\b(?:could you repeat|say that again|one more time|what do you mean|did you say|can you clarify)\b/iu.test(value);
const normalizedQuestion = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9' ]/giu, " ").replace(/\s+/gu, " ").trim();

/**
 * Metadata is intentionally aggregate. It gives the evaluator enough context
 * to distinguish a genuine short success from a loop or a Help-led answer,
 * without putting raw transcript content into logs.
 */
export const buildSpeakingInteractionMetadata = (turns: SpeakingTurn[]): SpeakingInteractionMetadata => {
  const studentTurns = turns.filter((turn) => turn.speaker === "student" && turn.text.trim());
  const aiQuestions = turns.filter((turn) => turn.speaker === "ai" && (questionLike(turn.text) || turn.text.includes("?")));
  let repeatedQuestionCount = 0;
  for (let index = 1; index < aiQuestions.length; index += 1) {
    const current = aiQuestions[index]!;
    const previous = aiQuestions[index - 1]!;
    const between = turns.slice(turns.indexOf(previous) + 1, turns.indexOf(current)).filter((turn) => turn.speaker === "student");
    const unanswered = between.length > 0 && between.every((turn) => /^(?:okay|ok|yes|no|uh|um)[.!?]?$/iu.test(turn.text.trim()));
    const sameNameRequest = /\bname\b/iu.test(current.text) && /\bname\b/iu.test(previous.text);
    // Repeated wording alone can be normal scaffolding by the AI. Only flag
    // an unanswered information request, never a valid yes/no answer.
    const informationRequest = /\b(?:what|where|when|who|why|how|name)\b/iu.test(previous.text);
    if (unanswered && informationRequest && (sameNameRequest || normalizedQuestion(current.text) === normalizedQuestion(previous.text))) repeatedQuestionCount += 1;
  }
  return {
    studentTurnCount: studentTurns.length,
    independentResponseCount: studentTurns.filter((turn) => !turn.usedHelp).length,
    helpedTurnCount: studentTurns.filter((turn) => turn.usedHelp).length,
    aiRepairPromptCount: turns.filter((turn) => turn.speaker === "ai" && repairLike(turn.text)).length,
    repeatedQuestionCount,
    reliableAudioTurnCount: studentTurns.filter((turn) => Number.isFinite(turn.audioDurationMs) && (turn.audioDurationMs ?? 0) >= 100).length
  };
};

export const speakingEvaluationRetryDelayMs = (attempt: number, random = Math.random) => {
  const base = SPEAKING_EVALUATION_RETRY_DELAYS_MS[Math.min(Math.max(1, Math.floor(attempt)), SPEAKING_EVALUATION_RETRY_DELAYS_MS.length) - 1] ?? SPEAKING_EVALUATION_RETRY_DELAYS_MS.at(-1)!;
  const sampled = random();
  const jitterSource = Number.isFinite(sampled) ? sampled : 0.5;
  const jitter = 0.8 + Math.min(1, Math.max(0, jitterSource)) * 0.4;
  return Math.round(base * jitter);
};

export const nextSpeakingEvaluationRetryAt = (now: string, attempt: number, random = Math.random) => {
  if (attempt >= SPEAKING_EVALUATION_MAX_ATTEMPTS) return undefined;
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) return undefined;
  return new Date(nowMs + speakingEvaluationRetryDelayMs(attempt, random)).toISOString();
};

const cleanSentence = (value: string) => value.trim().replace(/[.。!?！]+$/u, "").trim();

export const speakingGoalRequirements = (activity: SpeakingActivity): string[] => {
  const goal = speakingScenarioResources(activity.scenarioResources).studentGoal.trim();
  const pieces = goal.split(/[,;]|\band\s+(?=(?:ask|close|finish|order|describe|explain|tell|say|give|choose|introduce|compare|share)\b)/iu).map(cleanSentence).map((piece) => piece.replace(/^and\s+/iu, "")).filter(Boolean);
  return (pieces.length ? pieces : [goal]).slice(0, 8);
};

const requiresQuestion = (requirement: string) => /\bask\s+(?:one|a|an|\d+|some|two|three)\s+(?:\w+\s+)?questions?\b/iu.test(requirement);

const deriveGoalCompletion = (activity: SpeakingActivity, turns: SpeakingTurn[], evaluation: SpeakingEvaluation): SpeakingGoalCompletion => {
  const studentTurns = turns.filter((turn) => turn.speaker === "student" && turn.text.trim());
  const requirements: SpeakingGoalRequirement[] = speakingGoalRequirements(activity).map((requirement) => {
    const source = evaluation.goalCompletion?.requirements.find((item) => cleanSentence(item.requirement).toLocaleLowerCase() === requirement.toLocaleLowerCase());
    const evidence = [...new Set(source?.evidenceTurnIds ?? [])].filter((id) => studentTurns.some((turn) => turn.id === id));
    let status: SpeakingGoalRequirement["status"] = source?.status ?? "uncertain";
    if ((status === "completed" || status === "partially_completed") && !evidence.length) status = "uncertain";
    // Reject a demonstrably absent question, but leave semantic goal judgment
    // to the evaluator. A food noun or any two words cannot prove completion.
    if (requiresQuestion(requirement) && studentTurns.length && !studentTurns.some((turn) => questionLike(turn.text))) {
      status = "not_completed";
      evidence.length = 0;
    }
    return { requirement, status, evidenceTurnIds: evidence };
  });
  return { completed: requirements.length > 0 && requirements.every((item) => item.status === "completed"), requirements };
};

const scoreOrNull = (score: number | null | undefined) => typeof score === "number" && Number.isInteger(score) && score >= 1 && score <= 4 ? score : null;
const appendUnique = (items: string[], value: string) => value && !items.includes(value) ? [...items, value] : items;
const unsupportedTimingClaim = (text: string) => /\b(?:smooth(?:ly)?|hesitat\w*|pauses?|without stopping|fluent(?:ly)?)\b|流暢|流ちょう|すらすら|スラスラ|ためら|よどみ|間を空け|途切れ/iu.test(text);

const foodCorrection = (text: string) => {
  const match = text.match(/\b(?:a|an)?\s*(burger|cheeseburger|sandwich|soup|pizza|salad|noodles|rice|juice|coffee|tea|water)\b/iu);
  if (!match?.[1]) return undefined;
  const item = match[1].toLocaleLowerCase();
  return `I'd like ${/^(?:soup|salad|rice|juice|coffee|tea|water)$/u.test(item) ? "some " : "a "}${item}, please.`;
};

const malformedFoodOrder = (text: string) => /\bI\s+want\s+(?:to\s+)?(?:burger|cheeseburger|sandwich|pizza)\b/iu.test(text);
const uncertainAsrFragment = (turn: SpeakingTurn) => (turn.transcriptionConfidence !== undefined && turn.transcriptionConfidence < 0.65) || (turn.transcriptionConfidence === undefined && /^(?:just\s+)?(?:oh|uh|um|okay|ok|yeah|yes|no)\.?$/iu.test(turn.text.trim()));

const safeSourceItems = (evaluation: SpeakingEvaluation, studentTurns: SpeakingTurn[]) => (Array.isArray(evaluation.usefulEnglish) ? evaluation.usefulEnglish : []).flatMap((item) => {
  const source = item.sourceTurnId
    ? studentTurns.find((turn) => turn.id === item.sourceTurnId)
    : studentTurns.find((turn) => turn.text === item.said);
  if (!source || typeof item.try !== "string" || !item.try.trim() || uncertainAsrFragment(source)) return [];
  return [{ said: source.text, try: item.try.trim().slice(0, 300), sourceTurnId: source.id }];
});

/**
 * Apply deterministic evidence rules after any provider output. The provider
 * can suggest useful feedback, but it cannot rewrite the student's words,
 * score a missing requirement, or turn missing timing into a fluency claim.
 */
export const sanitizeSpeakingEvaluation = (
  evaluation: SpeakingEvaluation,
  activity: SpeakingActivity,
  turns: SpeakingTurn[],
  interactionMetadata = buildSpeakingInteractionMetadata(turns)
): SpeakingEvaluation => {
  const copy = speakingFeedbackCopy(activity.nativeLanguage);
  const studentTurns = turns.filter((turn) => turn.speaker === "student" && turn.text.trim());
  const sourceScores = evaluation.scores && typeof evaluation.scores === "object" ? evaluation.scores : {};
  const sourceEvidence = evaluation.evidence && typeof evaluation.evidence === "object" ? evaluation.evidence : {};
  const goalCompletion = deriveGoalCompletion(activity, turns, evaluation);
  const questionRequirementMissing = goalCompletion.requirements.some((item) => requiresQuestion(item.requirement) && item.status === "not_completed");
  const incompleteGoal = goalCompletion.requirements.some((item) => item.status !== "completed");
  const malformedOrder = studentTurns.some((turn) => !uncertainAsrFragment(turn) && malformedFoodOrder(turn.text));
  const repeatedStarter = studentTurns.filter((turn) => /^I\s+(?:want|like|need)\b/iu.test(turn.text.trim())).length >= 3;
  const reliableAudio = studentTurns.length > 0 && interactionMetadata.reliableAudioTurnCount === studentTurns.length;
  const scores: Record<string, number | null> = {};
  const evidence: Record<string, string> = {};
  for (const criterion of activity.rubric.filter((item) => item.enabled)) {
    let score = scoreOrNull(sourceScores[criterion.id]);
    let criterionEvidence = typeof sourceEvidence[criterion.id] === "string" ? sourceEvidence[criterion.id].trim().slice(0, 500) : copy.insufficientEvidenceReason;
    if (unsupportedTimingClaim(criterionEvidence)) {
      criterionEvidence = activity.nativeLanguage === "ja" ? "会話の記録をもとに評価しました。音声の間やためらいは判断していません。" : "Assessed from the conversation record; recording duration does not establish speech rhythm.";
    }
    if (!studentTurns.length) {
      score = null;
      criterionEvidence = copy.insufficientEvidenceReason;
    }
    if (criterion.id === "fluency" && !reliableAudio) {
      score = null;
      criterionEvidence = activity.nativeLanguage === "ja"
        ? "音声の長さを確認できないため、流暢さは評価しません。"
        : "Fluency was not scored because reliable audio timing was not available; pauses were not judged.";
    }
    if ((criterion.id === "communication" && incompleteGoal) || (criterion.id === "interaction" && (questionRequirementMissing || interactionMetadata.repeatedQuestionCount > 0))) {
      if (score !== null) score = Math.min(score, 3);
      criterionEvidence = criterion.id === "interaction" && interactionMetadata.repeatedQuestionCount > 0
        ? activity.nativeLanguage === "ja"
          ? "相手が質問を言い直す場面があったため、ひとりで会話を進めたとは言い切れません。"
          : "The partner repeated a question, so this was not treated as fully independent interaction."
        : activity.nativeLanguage === "ja"
          ? "目標をすべて達成したと確認できないため、この項目は控えめに評価しました。"
          : "The transcript does not confirm completion of every task requirement.";
    }
    if (criterion.id === "grammar" && malformedOrder) {
      if (score !== null) score = Math.min(score, 3);
      criterionEvidence = activity.nativeLanguage === "ja"
        ? "注文の文は伝わりました。冠詞と文の形をもう少し練習しましょう。"
        : "Your order was understandable. Practice the article and sentence shape in the example below.";
    }
    if (criterion.id === "vocabulary" && repeatedStarter) {
      if (score !== null) score = Math.min(score, 3);
      criterionEvidence = activity.nativeLanguage === "ja"
        ? "同じ始め方が何度か続きました。別の言い方も試しましょう。"
        : "You used the same sentence starter several times; try one different phrase next time.";
    }
    scores[criterion.id] = score;
    evidence[criterion.id] = criterionEvidence;
  }

  let usefulEnglish = safeSourceItems(evaluation, studentTurns);
  const malformedSource = studentTurns.find((turn) => !uncertainAsrFragment(turn) && malformedFoodOrder(turn.text));
  if (malformedSource && !uncertainAsrFragment(malformedSource)) {
    const correction = foodCorrection(malformedSource.text);
    if (correction && !usefulEnglish.some((item) => item.sourceTurnId === malformedSource.id)) {
      usefulEnglish = [...usefulEnglish, { said: malformedSource.text, try: correction, sourceTurnId: malformedSource.id }];
    }
  }
  usefulEnglish = usefulEnglish.slice(0, 5);

  const providerImprovements = (Array.isArray(evaluation.improvements) ? evaluation.improvements : []).filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => Boolean(item) && !unsupportedTimingClaim(item));
  let improvements: string[] = [];
  if (questionRequirementMissing) {
    improvements = appendUnique(improvements, activity.nativeLanguage === "ja" ? "「How much is it?」のような簡単な質問を1つしてみましょう。" : "Try asking one simple question, such as “How much is it?”");
  }
  if (interactionMetadata.repeatedQuestionCount > 0) {
    improvements = appendUnique(improvements, activity.nativeLanguage === "ja" ? "質問が分からないときは、「Could you repeat that, please?」と言ってから答えてみましょう。" : "If a question is unclear, say “Could you repeat that, please?” and then answer it.");
  }
  if (malformedSource && !uncertainAsrFragment(malformedSource)) {
    improvements = appendUnique(improvements, activity.nativeLanguage === "ja" ? "「I'd like a burger, please.」のように言ってみましょう。" : "Try: “I’d like a burger, please.”");
  }
  if (repeatedStarter) {
    improvements = appendUnique(improvements, activity.nativeLanguage === "ja" ? "文の始め方を変えて、「I'd like…」なども使ってみましょう。" : "Try a different sentence starter, such as “I’d like…”.");
  }

  const hasNumericScore = Object.values(scores).some((score) => typeof score === "number");
  return {
    ...evaluation,
    participantId: evaluation.participantId,
    language: activity.nativeLanguage,
    assessmentStatus: hasNumericScore ? "scored" : "insufficient_evidence",
    ...(hasNumericScore ? { notScoredReason: undefined } : { notScoredReason: copy.insufficientEvidenceReason }),
    scores,
    evidence,
    strengths: (Array.isArray(evaluation.strengths) ? evaluation.strengths : []).filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => Boolean(item) && !unsupportedTimingClaim(item)).slice(0, 5),
    improvements: [...new Set([...improvements, ...providerImprovements])].slice(0, 5),
    usefulEnglish,
    goalCompletion,
    overallMessage: studentTurns.length && typeof evaluation.overallMessage === "string" ? unsupportedTimingClaim(evaluation.overallMessage) ? (activity.nativeLanguage === "ja" ? "会話に取り組みました。次に使える表現を確認しましょう。" : "You took part in the conversation. Review the expressions to try next time.") : evaluation.overallMessage.trim().slice(0, 500) : copy.insufficientEvidenceMessage
  };
};
