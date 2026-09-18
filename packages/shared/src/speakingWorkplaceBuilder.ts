import {
  DEFAULT_SPEAKING_ASSESSMENT_SUPPORT_SETTINGS,
  DEFAULT_SPEAKING_RUBRIC,
  type SpeakingCategory,
  type SpeakingCommunicationSkill,
  type SpeakingCreateActivityInput,
  type SpeakingDifficulty,
  type SpeakingLibraryCategoryId
} from "./speaking.js";
import type { SpeakingCoreLibraryItem } from "./speakingSchoolLibrary.js";

export type WorkplaceSeed = {
  id: string;
  title: string;
  category: SpeakingCategory;
  categoryId: SpeakingLibraryCategoryId;
  scenario: string;
  aiRole: string;
  studentRole: string;
  goal: string;
  aiContext: string;
  skills: SpeakingCommunicationSkill[];
  complication: string;
  conditions: string[];
  openingLine: string;
  steps: string[];
  vocabulary: string[];
  targetExpressions: string[];
  durationSeconds: number;
  difficulty?: SpeakingDifficulty;
  referenceItems?: Array<{ label: string; detail?: string }>;
};

/** Build a complete, image-optional workplace task with shared safe defaults. */
export const workplace = (seed: WorkplaceSeed): SpeakingCoreLibraryItem => {
  const id = `workplace-${seed.id}`;
  const input: SpeakingCreateActivityInput = {
    title: seed.title,
    scenario: seed.scenario,
    aiRole: seed.aiRole,
    studentRole: seed.studentRole,
    level: "lower_intermediate",
    difficulty: seed.difficulty ?? "normal",
    nativeLanguage: "ja",
    durationSeconds: seed.durationSeconds,
    identifierMode: "nickname",
    mode: "assessment",
    supportSettings: { ...DEFAULT_SPEAKING_ASSESSMENT_SUPPORT_SETTINGS },
    targetExpressions: [...seed.targetExpressions],
    rubric: DEFAULT_SPEAKING_RUBRIC.map((criterion) => ({ ...criterion })),
    scenarioResources: {
      libraryCollection: "workplace-english",
      categoryId: seed.categoryId,
      category: seed.category,
      communicationSkills: [...seed.skills],
      aiContext: seed.aiContext,
      possibleComplication: seed.complication,
      successConditions: [...seed.conditions],
      openingLine: seed.openingLine,
      studentGoal: seed.goal,
      suggestedSteps: [...seed.steps],
      usefulVocabulary: [...seed.vocabulary],
      referenceItems: seed.referenceItems?.map((item) => ({ ...item })) ?? [],
      builtIn: true,
      sourceTemplateId: id
    }
  };
  return { id, ...input, scenarioResources: { ...input.scenarioResources } };
};

