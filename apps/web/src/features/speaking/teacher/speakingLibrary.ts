import {
  DEFAULT_SPEAKING_RUBRIC,
  recommendedSpeakingSupportSettings,
  resolveSpeakingSupportSettings,
  SPEAKING_CORE_LIBRARY,
  SPEAKING_LIBRARY_CATEGORY_DEFINITIONS,
  SPEAKING_LIBRARY_COLLECTIONS,
  SpeakingCreateActivityInputSchema,
  type SpeakingActivity
} from "@quizstrike/shared";

const expectedCoreIds = new Set(SPEAKING_CORE_LIBRARY.map((template) => template.id));
const expectedRubricIds = DEFAULT_SPEAKING_RUBRIC.map((criterion) => criterion.id);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

/**
 * The local library is the compatibility floor for the teacher dashboard.
 * Accept a server response only when it is the same complete, built-in
 * collection. This prevents an older server from replacing the known library
 * with a partial response, and avoids merging two versions of the catalog.
 */
export const isCompatibleCoreLibraryResponse = (value: unknown): value is SpeakingActivity[] => {
  if (!Array.isArray(value) || value.length !== expectedCoreIds.size) return false;
  const seenIds = new Set<string>();
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !expectedCoreIds.has(candidate.id) || seenIds.has(candidate.id)) return false;
    if (!SpeakingCreateActivityInputSchema.safeParse(candidate).success) return false;
    if (!isRecord(candidate.scenarioResources)) return false;
    const resources = candidate.scenarioResources;
    if (resources.builtIn !== true || typeof resources.libraryCollection !== "string" || !SPEAKING_LIBRARY_COLLECTIONS.includes(resources.libraryCollection as typeof SPEAKING_LIBRARY_COLLECTIONS[number]) || typeof resources.categoryId !== "string" || typeof resources.category !== "string" || !Array.isArray(resources.communicationSkills) || resources.communicationSkills.length === 0 || !Array.isArray(resources.successConditions) || resources.successConditions.length < 3 || typeof resources.openingLine !== "string" || !resources.openingLine.trim() || typeof resources.studentGoal !== "string" || !resources.studentGoal.trim() || !Array.isArray(candidate.targetExpressions) || candidate.targetExpressions.length === 0 || resources.sourceTemplateId !== candidate.id) return false;
    const category = SPEAKING_LIBRARY_CATEGORY_DEFINITIONS.find((definition) => definition.id === resources.categoryId);
    if (!category || category.collectionId !== resources.libraryCollection || category.name !== resources.category) return false;
    if (!Array.isArray(candidate.rubric) || candidate.rubric.length !== expectedRubricIds.length || candidate.rubric.some((criterion, index) => !isRecord(criterion) || criterion.id !== expectedRubricIds[index])) return false;
    seenIds.add(candidate.id);
  }
  return seenIds.size === expectedCoreIds.size;
};

export const coreFallbackActivities = (): SpeakingActivity[] => SPEAKING_CORE_LIBRARY.map((template) => ({
  ...template,
  teacherId: "speaking-template",
  status: "ready",
  mode: template.mode ?? "assessment",
  supportSettings: resolveSpeakingSupportSettings(template.supportSettings ?? recommendedSpeakingSupportSettings("assessment")),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
}));
