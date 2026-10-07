import assert from "node:assert/strict";
import test from "node:test";
import { SPEAKING_CORE_LIBRARY } from "@quizstrike/shared";
import { resolveSpeakingSceneBackground } from "./speakingSceneBackground.js";

test("tourist environment is confined to its scenario; restaurant/car/school tasks use neutral", () => {
  const tourist = SPEAKING_CORE_LIBRARY.find((item) => item.id === "core-helping-a-tourist")!;
  assert.equal(resolveSpeakingSceneBackground(tourist), "/assets/speaking/practice-plaza.webp");
  for (const id of ["core-ordering-food", "core-talking-about-school-life", "workplace-luxury-car-explain-vehicle"]) {
    const task = SPEAKING_CORE_LIBRARY.find((item) => item.id === id)!;
    assert.ok(task, id);
    assert.equal(resolveSpeakingSceneBackground(task), undefined, id);
  }
});

test("explicit scenario environment wins; missing environment and reference images stay neutral", () => {
  assert.equal(resolveSpeakingSceneBackground({ scenarioResources: { sourceTemplateId: "core-helping-a-tourist", sceneBackground: " /assets/speaking/custom-cafe.webp " } }), "/assets/speaking/custom-cafe.webp");
  assert.equal(resolveSpeakingSceneBackground({}), undefined);
  for (const type of ["map", "menu", "timetable", "chart", "other", "photo"] as const) {
    assert.equal(resolveSpeakingSceneBackground({ scenarioResources: {
      imageSrc: "/assets/speaking/scenario-restaurant.webp", context: { type, imageUrl: "/reference.webp" }
    } }), undefined);
  }
  for (const sceneBackground of ["https://example.com/environment.webp", "//example.com/environment.webp", "/\\example.com/environment.webp"]) {
    assert.equal(resolveSpeakingSceneBackground({ scenarioResources: { sceneBackground } }), undefined);
  }
});
