export const ANSWER_FEEDBACK_DURATION_MS = 1800;
const EXTENDED_ANSWER_FEEDBACK_DURATION_MS = 2400;
const LONG_ANSWER_FEEDBACK_DURATION_MS = 2800;

const codePointLength = (value: string | undefined) => Array.from(value?.trim() ?? "").length;

/** Keeps short answers fast while giving wrapped explanations enough reading time. */
export const getAnswerFeedbackDurationMs = ({
  selectedText,
  correctText,
  explanation,
  supportingText
}: {
  selectedText: string;
  correctText: string;
  explanation?: string;
  supportingText?: string;
}) => {
  const longestText = Math.max(
    codePointLength(selectedText),
    codePointLength(correctText),
    codePointLength(explanation),
    codePointLength(supportingText)
  );
  if (longestText > 140) return LONG_ANSWER_FEEDBACK_DURATION_MS;
  if (explanation?.trim() || supportingText?.trim() || longestText > 48) {
    return EXTENDED_ANSWER_FEEDBACK_DURATION_MS;
  }
  return ANSWER_FEEDBACK_DURATION_MS;
};
