import {
  SPEAKCHECK_MOONSHINE, SPEAKING_READING_VERSION, alignSpeakingReading, speakingReadingCriteria,
  type SpeakingEvaluation, type SpeakingNativeLanguage, type SpeakingReadingAssignment, type SpeakingTurn
} from "@quizstrike/shared";

export function assessSpeakingReading(
  assignment: SpeakingReadingAssignment, language: SpeakingNativeLanguage, turn: SpeakingTurn | undefined,
  participantId: string, createdAt: string
): SpeakingEvaluation {
  const ja = language === "ja";
  const alignment = alignSpeakingReading(assignment.passage.text, turn?.text ?? "");
  const hasEvidence = !!turn && !turn.transcriptionUncertain && alignment.referenceWords > 0;
  // Experimental text-alignment bands. Each edit is counted once.
  const accuracy = Math.max(0, 1 - (alignment.wordErrorRate ?? 1));
  const level = accuracy >= .95 ? 4 : accuracy >= .8 ? 3 : accuracy >= .65 ? 2 : accuracy >= .4 ? 1 : 0;
  const review = ja ? "先生による確認が必要です。" : "Teacher review is needed.";
  const basis = ja ? "教科書の英文と端末の文字起こしを比較しました。" : "This estimate compares the reference and the device transcript.";
  const criteria = assignment.rubric.filter((item) => item.weight > 0);
  const scored = hasEvidence && criteria.some((item) => item.id === "reading_accuracy");
  const scores = Object.fromEntries(criteria.map(({ id }) => [id, id === "reading_accuracy" && scored ? level : null]));
  const evidence = Object.fromEntries(criteria.map(({ id }) => [id, id === "reading_accuracy" && scored ? basis : review]));
  return {
    participantId, language, createdAt, scores, evidence,
    assessmentStatus: scored ? "scored" : "insufficient_evidence",
    ...(!scored ? { notScoredReason: review } : {}),
    overallMessage: ja ? "AIによる仮評価です。マークされた単語は、文字起こしの違いを示しています。" : "Provisional result. Marked words show differences in the transcript.",
    strengths: hasEvidence && alignment.matches > 0
      ? [ja ? `${alignment.matches}語が一致しました。` : `${alignment.matches} words matched the passage.`] : [],
    improvements: [!hasEvidence
      ? (ja ? "先生と一緒に録音を確認しましょう。" : "Ask your teacher to help check the recording.")
      : alignment.possibleIncomplete
        ? (ja ? "録音を聞いて、最後まで読めているか確認しましょう。" : "Listen back and check whether you reached the end.")
        : alignment.wordErrorRate === 0
          ? (ja ? "次は意味のまとまりごとに区切って読んでみましょう。" : "Next, practise reading in short phrases that make sense together.")
          : (ja ? "録音を聞き、マークされた箇所を確認しましょう。" : "Listen back and check the marked differences.")],
    usefulEnglish: [],
    assessmentEvidence: {
      version: 1, algorithm: SPEAKING_READING_VERSION, source: "client_transcript",
      expectedRecognizer: `${SPEAKCHECK_MOONSHINE.id}@${SPEAKCHECK_MOONSHINE.revision}`,
      uncertainTurnIds: turn?.transcriptionUncertain ? [turn.id] : [],
      criteria: Object.fromEntries(criteria.map(({ id }) => [id, {
        turnIds: id === "reading_accuracy" && turn ? [turn.id] : [],
        rule: id === "reading_accuracy" ? "normalized_word_edit_distance" : "teacher_observation",
        reviewRequired: true
      }])),
      reading: { passageId: assignment.passage.id, passageVersion: assignment.passage.version, alignment, ...(turn?.audioDurationMs ? { durationMs: turn.audioDurationMs } : {}) }
    }
  };
}

export function readingActivityRubric(assignment: SpeakingReadingAssignment, language: SpeakingNativeLanguage) {
  return assignment.rubric.map(({ id, weight }) => ({
    id, name: speakingReadingCriteria[id][language], description: "", enabled: weight > 0
  }));
}
