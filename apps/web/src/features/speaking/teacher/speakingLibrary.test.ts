import assert from "node:assert/strict";
import test from "node:test";
import { SPEAKING_CORE_LIBRARY, speakingContext } from "@quizstrike/shared";
import { coreFallbackActivities, isCompatibleCoreLibraryResponse } from "./speakingLibrary.js";

test("the complete built-in response is accepted", () => {
  const response = coreFallbackActivities();
  assert.equal(isCompatibleCoreLibraryResponse(response), true);
  assert.equal(response.length, 79);
});

test("school scenarios retain their visual contexts while workplace scenarios stay image-optional", () => {
  const school = SPEAKING_CORE_LIBRARY.filter((activity) => activity.scenarioResources?.libraryCollection === "school-english");
  const workplace = SPEAKING_CORE_LIBRARY.filter((activity) => activity.scenarioResources?.libraryCollection === "workplace-english");
  assert.equal(school.length, 30);
  assert.equal(workplace.length, 49);
  const contexts = school.map((activity) => speakingContext(activity));

  assert.equal(contexts.every((context) => Boolean(context?.title && context.description && context.imageUrl && context.alt)), true);
  assert.equal(new Set(contexts.map((context) => context?.title)).size, 30);
  assert.equal(new Set(contexts.map((context) => context?.imageUrl)).size >= 5, true);
  assert.equal(workplace.every((activity) => !speakingContext(activity)), true);
});

test("context visuals match the scenarios that need specific reference items", () => {
  const contextFor = (id: string) => speakingContext(SPEAKING_CORE_LIBRARY.find((activity) => activity.id === `core-${id}`));
  const supplies = contextFor("shopping-for-everyday-items");
  assert.match(`${supplies?.title} ${supplies?.alt}`, /school|notebook|pen|tape/i);
  assert.match(supplies?.imageUrl ?? "", /school-supplies/u);
  const restaurant = contextFor("at-a-restaurant");
  assert.match(`${restaurant?.title} ${restaurant?.alt}`, /curry|pasta|fruit|lunch/i);
  assert.match(restaurant?.imageUrl ?? "", /restaurant-menu/u);
  const directions = contextFor("asking-for-street-directions");
  assert.match(`${directions?.title} ${directions?.alt}`, /library/i);
  assert.match(directions?.imageUrl ?? "", /library-map/u);
});

test("partial, duplicate, and incompatible template responses fall back instead of replacing the library", () => {
  const response = coreFallbackActivities();
  assert.equal(isCompatibleCoreLibraryResponse(response.slice(0, 6)), false);
  assert.equal(isCompatibleCoreLibraryResponse([...response.slice(0, -1), response[0]]), false);
  assert.equal(isCompatibleCoreLibraryResponse(response.map((item) => ({ ...item, scenarioResources: { ...item.scenarioResources, builtIn: undefined } }))), false);
  assert.equal(isCompatibleCoreLibraryResponse(SPEAKING_CORE_LIBRARY.slice(0, 6)), false);
});

test("the fallback exposes collection and category metadata for cross-collection search", () => {
  const response = coreFallbackActivities();
  const car = response.find((item) => item.title === "Buying a Used Car for the Dealership");
  const allergy = response.find((item) => item.title === "Handling Dietary Questions");
  assert.equal(car?.scenarioResources?.libraryCollection, "workplace-english");
  assert.equal(car?.scenarioResources?.category, "Luxury Car Sales");
  assert.equal(allergy?.scenarioResources?.category, "Restaurants & Cafés");
  assert.match(response.filter((item) => `${item.title} ${item.scenario} ${item.scenarioResources?.usefulVocabulary?.join(" ")}`.toLocaleLowerCase()).map((item) => item.title).join(" "), /Buying a Used Car for the Dealership/u);
  assert.match(response.filter((item) => `${item.title} ${item.scenario} ${item.scenarioResources?.usefulVocabulary?.join(" ")}`.toLocaleLowerCase()).map((item) => item.title).join(" "), /Handling Dietary Questions/u);
});
