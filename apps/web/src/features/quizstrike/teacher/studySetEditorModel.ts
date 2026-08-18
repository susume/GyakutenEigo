import type { Choice, Question } from "@quizstrike/shared";

export type EditorQuestion = {
  key: string;
  id?: string;
  prompt: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correctChoice: Choice;
  explanation: string;
  difficulty: string;
  audioUrl: string;
};

let draftSequence = 0;
const draftKey = () => `draft-question-${Date.now()}-${++draftSequence}`;

export const emptyEditorQuestion = (): EditorQuestion => ({
  key: draftKey(),
  prompt: "",
  choiceA: "",
  choiceB: "",
  choiceC: "",
  choiceD: "",
  correctChoice: "A",
  explanation: "",
  difficulty: "",
  audioUrl: ""
});

export const editorQuestionFromQuestion = (question: Question): EditorQuestion => ({
  key: question.id,
  id: question.id,
  prompt: question.prompt,
  choiceA: question.choiceA,
  choiceB: question.choiceB,
  choiceC: question.choiceC,
  choiceD: question.choiceD,
  correctChoice: question.correctChoice,
  explanation: question.explanation ?? "",
  difficulty: question.difficulty ?? "",
  audioUrl: question.audioUrl ?? ""
});

const questionFingerprint = (question: Pick<EditorQuestion, "prompt" | "choiceA" | "choiceB" | "choiceC" | "choiceD" | "correctChoice" | "explanation" | "difficulty" | "audioUrl">) => JSON.stringify([
  question.prompt.trim(),
  question.choiceA.trim(),
  question.choiceB.trim(),
  question.choiceC.trim(),
  question.choiceD.trim(),
  question.correctChoice,
  question.explanation.trim(),
  question.difficulty.trim(),
  question.audioUrl.trim()
]);

/**
 * Reconnects local drafts to questions that reached the server before a save
 * response failed. This keeps a retry from creating the same question twice.
 */
export const reconcileEditorQuestions = (drafts: EditorQuestion[], persisted: Question[]) => {
  const unused = new Map(persisted.map((question) => [question.id, question]));
  return drafts.map((draft) => {
    const byId = draft.id ? unused.get(draft.id) : undefined;
    const match = byId ?? [...unused.values()].find((question) => questionFingerprint({
      ...editorQuestionFromQuestion(question),
      audioUrl: question.audioUrl ?? ""
    }) === questionFingerprint(draft));
    if (!match) return draft;
    unused.delete(match.id);
    return editorQuestionFromQuestion(match);
  });
};

const splitStudyLine = (line: string) => {
  for (const separator of ["\t", " | ", " - ", " – ", " — ", ": ", " -- ", " = "]) {
    const index = line.indexOf(separator);
    if (index > 0) {
      const term = line.slice(0, index).trim();
      const definition = line.slice(index + separator.length).trim();
      if (term && definition) return { term, definition };
    }
  }
  return undefined;
};

const shuffle = <T,>(items: T[], random: () => number) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
    const swapIndex = Math.floor(randomValue * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
};

const fallbackAnswers = [
  "Review this term again",
  "No matching definition",
  "Not one of the imported definitions"
];

export const questionsFromStudyList = (text: string, random: () => number = Math.random): EditorQuestion[] => {
  const entries = text.split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[).]\s*/, ""))
    .filter(Boolean)
    .map(splitStudyLine)
    .filter((entry): entry is { term: string; definition: string } => Boolean(entry));
  if (entries.length < 2) return [];
  return entries.slice(0, 80).map((entry, index) => {
    const distractors = [...new Set(
      [1, 2, 3]
        .map((offset) => entries[(index + offset) % entries.length]?.definition)
        .filter((value): value is string => Boolean(value) && value !== entry.definition)
    )];
    const unshuffledAnswers = [entry.definition, ...distractors];
    let fallbackIndex = 0;
    while (unshuffledAnswers.length < 4) {
      const base = fallbackAnswers[fallbackIndex % fallbackAnswers.length]!;
      const cycle = Math.floor(fallbackIndex / fallbackAnswers.length);
      const fallback = cycle === 0 ? base : `${base} ${cycle + 1}`;
      fallbackIndex += 1;
      if (!unshuffledAnswers.includes(fallback)) unshuffledAnswers.push(fallback);
    }
    const answers = shuffle(unshuffledAnswers.slice(0, 4), random);
    const correctChoice = (["A", "B", "C", "D"] as const)[answers.indexOf(entry.definition)] ?? "A";
    return {
      ...emptyEditorQuestion(),
      prompt: `What matches “${entry.term}”?`,
      choiceA: answers[0],
      choiceB: answers[1],
      choiceC: answers[2],
      choiceD: answers[3],
      correctChoice,
      explanation: entry.definition,
      difficulty: "Imported"
    };
  });
};

export const isBlankEditorQuestion = (question: EditorQuestion) =>
  !question.prompt.trim()
  && !question.choiceA.trim()
  && !question.choiceB.trim()
  && !question.choiceC.trim()
  && !question.choiceD.trim();

export const validateEditorQuestions = (questions: EditorQuestion[]) => {
  const errors: Record<string, string> = {};
  questions.forEach((question, index) => {
    if (!question.prompt.trim()) errors[question.key] = `Question ${index + 1} needs question text.`;
    else if (![question.choiceA, question.choiceB, question.choiceC, question.choiceD].every((choice) => choice.trim())) {
      errors[question.key] = `Question ${index + 1} needs four answers.`;
    } else {
      const correct = ({ A: question.choiceA, B: question.choiceB, C: question.choiceC, D: question.choiceD } as const)[question.correctChoice];
      if (!correct.trim()) errors[question.key] = `Question ${index + 1} needs a correct answer.`;
    }
  });
  return errors;
};
