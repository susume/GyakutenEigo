import { speakingScenarioResources, type SpeakingActivity } from "@quizstrike/shared";

// Reuse the existing environment only for the scenario it was made for.
// The square catalog illustrations contain people/functional references and
// would compete with the partner, so they are deliberately not backdrops.
const scenarioEnvironments: Readonly<Record<string, string>> = {
  "core-helping-a-tourist": "/assets/speaking/practice-plaza.webp"
};

/** Missing or unsuitable environments use the CSS-lit neutral SpeakCheck scene. */
export function resolveSpeakingSceneBackground(activity: Pick<SpeakingActivity, "scenarioResources">): string | undefined {
  const resources = speakingScenarioResources(activity.scenarioResources);
  if (resources.sceneBackground) {
    // Local images share the app's availability/privacy; no remote scene service.
    return /^\/(?!\/)[^\\]*$/u.test(resources.sceneBackground) ? resources.sceneBackground : undefined;
  }
  return resources.sourceTemplateId ? scenarioEnvironments[resources.sourceTemplateId] : undefined;
}
