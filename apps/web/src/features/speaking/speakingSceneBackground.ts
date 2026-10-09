import { SPEAKING_CORE_LIBRARY, speakingScenarioResources, type SpeakingActivity } from "@quizstrike/shared";

// Use environment-only artwork, keeping menus/maps and catalog illustrations
// in their reference panels. Stable template IDs survive edited task titles.
const scenarioEnvironments: Readonly<Record<string, string>> = {
  "core-helping-a-tourist": "plaza",
  "core-introducing-yourself": "school",
  "core-meeting-someone-new": "school",
  "core-talking-about-hobbies": "school",
  "core-talking-about-school-life": "school",
  "core-talking-about-daily-life": "school",
  "core-talking-about-a-past-experience": "school",
  "core-talking-about-future-plans": "school",
  "core-making-plans-with-a-friend": "cafe",
  "core-making-and-responding-to-invitations": "cafe",
  "core-buying-clothes": "shop",
  "core-shopping-for-everyday-items": "shop",
  "core-ordering-food": "cafe",
  "core-at-a-restaurant": "cafe",
  "core-asking-for-street-directions": "plaza",
  "core-giving-street-directions": "plaza",
  "core-asking-for-train-directions": "station",
  "core-giving-train-directions": "station",
  "core-using-public-transportation": "station",
  "core-at-a-train-station": "station",
  "core-introducing-your-hometown": "plaza",
  "core-introducing-japanese-culture": "plaza",
  "core-asking-for-help": "school",
  "core-lost-property": "school",
  "core-feeling-sick": "school",
  "core-making-requests-and-asking-permission": "school",
  "core-giving-advice": "school",
  "core-giving-an-opinion": "school",
  "core-choosing-between-options": "school",
  "core-solving-an-everyday-problem": "school"
};
const workplaceEnvironments: Readonly<Record<string, string>> = {
  "workplace-luxury-car-": "showroom",
  "workplace-hotel-": "hotel",
  "workplace-restaurant-": "cafe",
  "workplace-retail-": "shop",
  "workplace-tourism-": "plaza",
  "workplace-office-": "office"
};
const builtInTemplateIds = new Set(SPEAKING_CORE_LIBRARY.map((task) => task.id));

/** Missing or unsuitable environments use the CSS-lit neutral SpeakCheck scene. */
export function resolveSpeakingSceneBackground(activity: Pick<SpeakingActivity, "scenarioResources">): string | undefined {
  const resources = speakingScenarioResources(activity.scenarioResources);
  if (resources.sceneBackground) {
    // Local images share the app's availability/privacy; no remote scene service.
    return /^\/(?!\/)[^\\]*$/u.test(resources.sceneBackground) ? resources.sceneBackground : undefined;
  }
  const id = resources.sourceTemplateId;
  if (!id || !builtInTemplateIds.has(id)) return undefined;
  const environment = scenarioEnvironments[id] ?? Object.entries(workplaceEnvironments).find(([prefix]) => id.startsWith(prefix))?.[1];
  return environment ? `/assets/speaking/practice-${environment}.webp` : undefined;
}
