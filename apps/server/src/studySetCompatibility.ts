import type { QuizSet } from "@quizstrike/shared";

const validStatus = new Set(["DRAFT", "ACTIVE", "ARCHIVED"] as const);

/**
 * Old runtime snapshots predate Study Set visibility and explicit question
 * ordering. Normalize them at the boundary without replacing IDs or changing
 * ownership. Unknown visibility is deliberately private.
 */
export const normalizeLegacyStudySet = (quizSet: QuizSet): QuizSet => ({
  ...quizSet,
  visibility: quizSet.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE",
  status: quizSet.status && validStatus.has(quizSet.status) ? quizSet.status : "ACTIVE",
  questions: quizSet.questions.map((question, index) => ({
    ...question,
    position: Number.isSafeInteger(question.position) && question.position! >= 0 ? question.position : index
  })).sort((left, right) =>
    (left.position ?? 0) - (right.position ?? 0)
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id)
  )
});
