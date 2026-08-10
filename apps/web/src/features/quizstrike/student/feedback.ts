/** Incorrect-answer baseline: enough time to read the selected/correct answers. */
export const ANSWER_FEEDBACK_DURATION_MS = 1800;
/** Correct answers only need a brief confirmation before the server-issued next question appears. */
export const CORRECT_ANSWER_FEEDBACK_DURATION_MS = 350;
const EXTENDED_ANSWER_FEEDBACK_DURATION_MS = 2400;
const LONG_ANSWER_FEEDBACK_DURATION_MS = 3400;
const VERY_LONG_ANSWER_FEEDBACK_DURATION_MS = 4200;

const codePointLength = (value: string | undefined) => Array.from(value?.trim() ?? "").length;

/** Keeps short answers fast while giving wrapped explanations enough reading time. */
export const getAnswerFeedbackDurationMs = ({
  isCorrect = false,
  selectedText,
  correctText,
  explanation,
  supportingText
}: {
  isCorrect?: boolean;
  selectedText: string;
  correctText: string;
  explanation?: string;
  supportingText?: string;
}) => {
  if (isCorrect) return CORRECT_ANSWER_FEEDBACK_DURATION_MS;

  const longestText = Math.max(
    codePointLength(selectedText),
    codePointLength(correctText),
    codePointLength(explanation),
    codePointLength(supportingText)
  );
  if (longestText > 280) return VERY_LONG_ANSWER_FEEDBACK_DURATION_MS;
  if (longestText > 140) return LONG_ANSWER_FEEDBACK_DURATION_MS;
  if (explanation?.trim() || supportingText?.trim() || longestText > 48) {
    return EXTENDED_ANSWER_FEEDBACK_DURATION_MS;
  }
  return ANSWER_FEEDBACK_DURATION_MS;
};
