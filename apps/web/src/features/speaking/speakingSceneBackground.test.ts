import assert from "node:assert/strict";
import test from "node:test";
import { statSync } from "node:fs";
import { SPEAKING_CORE_LIBRARY } from "@quizstrike/shared";
import { resolveSpeakingSceneBackground } from "./speakingSceneBackground.js";

test("built-in scenarios select matching environments by template ID", () => {
  for (const [id, environment] of [
    ["core-helping-a-tourist", "plaza"], ["core-ordering-food", "cafe"],
    ["core-talking-about-school-life", "school"], ["core-buying-clothes", "shop"],
    ["core-at-a-train-station", "station"], ["workplace-luxury-car-explain-vehicle", "showroom"]
  ]) {
    const task = SPEAKING_CORE_LIBRARY.find((item) => item.id === id)!;
    assert.ok(task, id);
    assert.equal(resolveSpeakingSceneBackground(task), `/assets/speaking/practice-${environment}.webp`, id);
  }
});

test("every built-in template has a local, lightweight environment asset", () => {
  for (const task of SPEAKING_CORE_LIBRARY) {
    const src = resolveSpeakingSceneBackground(task);
    assert.ok(src, task.id);
    const asset = statSync(new URL(`../../../public${src}`, import.meta.url));
    assert.ok(asset.size > 0 && asset.size < 200_000, `${task.id}: ${src}`);
  }
});

test("explicit scenario environment wins; missing environment and reference images stay neutral", () => {
  assert.equal(resolveSpeakingSceneBackground({ scenarioResources: { sourceTemplateId: "core-helping-a-tourist", sceneBackground: " /assets/speaking/custom-cafe.webp " } }), "/assets/speaking/custom-cafe.webp");
  assert.equal(resolveSpeakingSceneBackground({}), undefined);
  assert.equal(resolveSpeakingSceneBackground({ scenarioResources: { sourceTemplateId: "workplace-hotel-custom-task" } }), undefined);
  for (const type of ["map", "menu", "timetable", "chart", "other", "photo"] as const) {
    assert.equal(resolveSpeakingSceneBackground({ scenarioResources: {
      imageSrc: "/assets/speaking/scenario-restaurant.webp", context: { type, imageUrl: "/reference.webp" }
    } }), undefined);
  }
  for (const sceneBackground of ["https://example.com/environment.webp", "//example.com/environment.webp", "/\\example.com/environment.webp"]) {
    assert.equal(resolveSpeakingSceneBackground({ scenarioResources: { sceneBackground } }), undefined);
  }
});
