import { z } from "zod";
import { alignSpeechTokens } from "./speechAlignment.js";

export const SPEAKING_READING_VERSION = "reading-alignment-v1";
export const SPEAKCHECK_MOONSHINE = { id: "onnx-community/moonshine-tiny-ONNX", revision: "a6da1241cd305dcd64eab1edbd615f2bb9aabb95" } as const;
export const SPEAKING_READING_MAX_SECONDS = 90;
export const SPEAKING_READING_MAX_TEXT = 4_000;

const label = z.string().trim().min(1).max(100);
export const SpeakingPassageInputSchema = z.object({
  grade: z.number().int().min(1).max(12),
  textbook: label, publisher: label.optional(), edition: label,
  unit: label, part: label, title: label.optional(),
  text: z.string().trim().min(1).max(3_000)
}).strict().refine((passage) => {
  const words = readingWords(passage.text);
  return words.length > 0 && words.length <= 350 && /[a-z]/iu.test(passage.text);
}, { path: ["text"], message: "Enter an English passage of up to 350 normalized words." });

export type SpeakingPassageInput = z.infer<typeof SpeakingPassageInputSchema>;
export const SpeakingPassageImportSchema = z.object({
  formatVersion: z.literal(1),
  passages: z.array(SpeakingPassageInputSchema).min(1).max(30)
}).strict().superRefine(({ passages }, context) => {
  const keys = new Set<string>();
  passages.forEach((passage, index) => {
    const key = speakingPassageKey(passage);
    if (keys.has(key)) context.addIssue({ code: "custom", path: ["passages", index], message: "Only one version per passage is allowed in an import." });
    keys.add(key);
  });
});

export const speakingPassageKey = (item: SpeakingPassageInput) => JSON.stringify(
  [item.grade, item.textbook, item.publisher ?? "", item.edition, item.unit, item.part]
    .map((value) => String(value).normalize("NFKC").toLowerCase())
);

export const SpeakingPassageSchema = SpeakingPassageInputSchema.safeExtend({
  id: z.string().min(1).max(120), version: z.number().int().positive()
});
export type SpeakingPassage = z.infer<typeof SpeakingPassageSchema>;
export const SpeakingReadingCriterionSchema = z.object({
  id: z.enum(["reading_accuracy", "pronunciation", "fluency", "expression"]),
  weight: z.number().int().min(0).max(100)
}).strict();
export const SpeakingReadingRubricSchema = z.array(SpeakingReadingCriterionSchema).length(4).refine(
  (items) => new Set(items.map((item) => item.id)).size === 4 && items.reduce((total, item) => total + item.weight, 0) === 100,
  "Use all four criteria and weights that add to 100."
);
export const speakingReadingCriteria = {
  reading_accuracy: { ja: "正確さ", en: "Reading accuracy" },
  pronunciation: { ja: "発音", en: "Pronunciation" },
  fluency: { ja: "流暢さ", en: "Fluency" },
  expression: { ja: "抑揚・表現", en: "Intonation and expression" }
};
export type SpeakingReadingCriterion = z.infer<typeof SpeakingReadingCriterionSchema>["id"];
export type SpeakingReadingRubric = z.infer<typeof SpeakingReadingRubricSchema>;
export const defaultSpeakingReadingRubric: SpeakingReadingRubric = [
  { id: "reading_accuracy", weight: 35 }, { id: "pronunciation", weight: 25 },
  { id: "fluency", weight: 25 }, { id: "expression", weight: 15 }
];
export const SpeakingReadingAssignmentSchema = z.object({ passage: SpeakingPassageSchema, rubric: SpeakingReadingRubricSchema }).strict();
export type SpeakingReadingAssignment = z.infer<typeof SpeakingReadingAssignmentSchema>;
export const SpeakingReadingTranscriptSchema = z.object({
  text: z.string().trim().min(1).max(SPEAKING_READING_MAX_TEXT).regex(/[a-z]/iu),
  uncertain: z.boolean(),
  durationMs: z.number().int().min(1).max(SPEAKING_READING_MAX_SECONDS * 1_000)
}).strict();

export const SpeakingReadingReviewSchema = z.object({
  expectedRevision: z.number().int().min(0).max(1_000),
  status: z.enum(["confirmed", "reopened"]),
  scores: z.partialRecord(SpeakingReadingCriterionSchema.shape.id, z.number().int().min(0).max(4).nullable()),
  comment: z.string().trim().max(1_000)
}).strict();
export type SpeakingReadingReviewInput = z.infer<typeof SpeakingReadingReviewSchema>;
export type SpeakingReadingReview = Omit<SpeakingReadingReviewInput, "expectedRevision"> & { revision: number; createdAt: string };

const contractions: Record<string, string> = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
  "it's": "it is", "he's": "he is", "she's": "she is", "that's": "that is",
  "i'll": "i will", "you'll": "you will", "we'll": "we will", "they'll": "they will",
  "i've": "i have", "we've": "we have", "they've": "they have",
  "can't": "can not", cannot: "can not", "won't": "will not", "don't": "do not",
  "doesn't": "does not", "didn't": "did not", "isn't": "is not", "aren't": "are not",
  "wasn't": "was not", "weren't": "were not", "couldn't": "could not", "shouldn't": "should not",
  "wouldn't": "would not", "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
  "let's": "let us"
};
const digits = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const tens = "zero ten twenty thirty forty fifty sixty seventy eighty ninety".split(" ");

export function readingWords(text: string): string[] {
  return (text.normalize("NFKC").toLowerCase().replace(/[‘’]/gu, "'")
    .match(/[a-z]+(?:'[a-z]+)?|[0-9]+/gu) ?? []).flatMap((word) => {
    if (Object.hasOwn(contractions, word)) return contractions[word]!.split(" ");
    if (/^(?:0|[1-9][0-9]?)$/u.test(word)) {
      const number = Number(word);
      if (number < 20) return [digits[number]!];
      return number % 10 ? [tens[Math.floor(number / 10)]!, digits[number % 10]!] : [tens[number / 10]!];
    }
    return [word];
  });
}

export type SpeakingReadingWord = {
  kind: "match" | "substitution" | "omission" | "insertion";
  reference?: string;
  recognized?: string;
  possibleRepetition?: boolean;
};

export function alignSpeakingReading(reference: string, transcript: string) {
  const actual = readingWords(transcript);
  const alignment = alignSpeechTokens(readingWords(reference), actual);
  let spokenIndex = 0;
  const words: SpeakingReadingWord[] = alignment.edits.map(({ kind, ...edit }) => {
    if (kind === "deletion") return { ...edit, kind: "omission" };
    const index = spokenIndex++;
    return kind === "insertion"
      ? { ...edit, kind, possibleRepetition: edit.recognized === actual[index - 1] || edit.recognized === actual[index + 1] }
      : { ...edit, kind };
  });
  const { referenceWords, substitutions, deletions: omissions, insertions } = alignment;
  const matches = referenceWords - substitutions - omissions;
  const lastReference = words.filter((word) => word.kind !== "insertion").at(-1);
  return {
    words, referenceWords, matches, substitutions, omissions, insertions,
    wordErrorRate: alignment.wordErrorRate ?? null,
    coverage: referenceWords ? (matches + substitutions) / referenceWords : null,
    possibleIncomplete: lastReference?.kind === "omission"
  };
}

export type SpeakingReadingAlignment = ReturnType<typeof alignSpeakingReading>;
