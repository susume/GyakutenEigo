import type { QuizSet, RecognitionBadge, RecognitionSummary } from "@quizstrike/shared";

export const CONTRIBUTION_POINTS = {
  firstStudySet: 20,
  validStudySet: 5,
  publishStudySet: 5,
  completedGame: 2,
  uniqueTeacherUse: 5,
  usageMilestones: {
    10: 10,
    25: 15,
    50: 25,
    100: 50
  }
} as const;

export const RECOGNITION_LEVELS = [
  { name: "Teacher", minimumPoints: 0 },
  { name: "Contributor", minimumPoints: 50 },
  { name: "Helpful Teacher", minimumPoints: 150 },
  { name: "Community Educator", minimumPoints: 350 },
  { name: "QuizStrike Mentor", minimumPoints: 750 }
] as const;

export const RECOGNITION_BADGES = {
  FIRST_SET: { name: "First Set", description: "Created your first Study Set." },
  SHARING_KNOWLEDGE: { name: "Sharing Knowledge", description: "Published your first public Study Set." },
  CLASSROOM_REGULAR: { name: "Classroom Regular", description: "Hosted 10 completed QuizStrike games." },
  HELPFUL_TEACHER: { name: "Helpful Teacher", description: "Another teacher used one of your Study Sets." },
  COMMUNITY_FAVORITE: { name: "Community Favorite", description: "25 different teachers used your Study Sets." },
  QUIZSTRIKE_MENTOR: { name: "QuizStrike Mentor", description: "100 unique teacher uses across your public Study Sets." }
} as const;

export type RecognitionStats = Pick<RecognitionSummary, "points" | "studySetsCreated" | "publicSetsShared" | "gamesHosted" | "studentsReached" | "teachersUsingSets" | "totalSetUses"> & {
  badgeRows?: Array<{ id: string; badgeId: string; earnedAt: string }>;
};

export const isMeaningfulStudySet = (quizSet: Pick<QuizSet, "title" | "questions">) => {
  const titleIsValid = quizSet.title.trim().length >= 2;
  const validQuestions = quizSet.questions.filter((question) => (
    question.prompt.trim()
    && question.choiceA.trim()
    && question.choiceB.trim()
    && question.choiceC.trim()
    && question.choiceD.trim()
    && ["A", "B", "C", "D"].includes(question.correctChoice)
  ));
  return titleIsValid && validQuestions.length >= 2 && validQuestions.length === quizSet.questions.length;
};

export const getRecognitionLevel = (points: number) => {
  let current: (typeof RECOGNITION_LEVELS)[number] = RECOGNITION_LEVELS[0]!;
  for (const level of RECOGNITION_LEVELS) {
    if (points >= level.minimumPoints) current = level;
  }
  const next = RECOGNITION_LEVELS.find((level) => level.minimumPoints > points);
  return {
    name: current.name,
    ...(next ? { nextLevel: next.name, nextLevelPoints: next.minimumPoints } : {})
  };
};

export const badgeIdsForStats = (stats: RecognitionStats) => {
  const ids: string[] = [];
  if (stats.studySetsCreated >= 1) ids.push("FIRST_SET");
  if (stats.publicSetsShared >= 1) ids.push("SHARING_KNOWLEDGE");
  if (stats.gamesHosted >= 10) ids.push("CLASSROOM_REGULAR");
  if (stats.teachersUsingSets >= 1) ids.push("HELPFUL_TEACHER");
  if (stats.teachersUsingSets >= 25) ids.push("COMMUNITY_FAVORITE");
  if (stats.teachersUsingSets >= 100) ids.push("QUIZSTRIKE_MENTOR");
  return ids;
};

export const buildRecognitionSummary = (stats: RecognitionStats): RecognitionSummary => {
  const level = getRecognitionLevel(stats.points);
  const knownBadges = new Map((stats.badgeRows ?? []).map((badge) => [badge.badgeId, badge]));
  const badges: RecognitionBadge[] = [...knownBadges.keys()].flatMap((badgeId) => {
      const definition = RECOGNITION_BADGES[badgeId as keyof typeof RECOGNITION_BADGES];
      const row = knownBadges.get(badgeId);
      return definition && row
        ? [{ id: badgeId, name: definition.name, description: definition.description, earnedAt: row.earnedAt }]
        : [];
    });
  return {
    points: stats.points,
    level: level.name,
    ...(level.nextLevel ? { nextLevel: level.nextLevel, nextLevelPoints: level.nextLevelPoints } : {}),
    studySetsCreated: stats.studySetsCreated,
    publicSetsShared: stats.publicSetsShared,
    gamesHosted: stats.gamesHosted,
    studentsReached: stats.studentsReached,
    teachersUsingSets: stats.teachersUsingSets,
    totalSetUses: stats.totalSetUses,
    badges
  };
};
