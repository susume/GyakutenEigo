import assert from "node:assert/strict";
import test from "node:test";
import { SPEAKING_CORE_LIBRARY } from "@quizstrike/shared";
import { coreFallbackActivities, isCompatibleCoreLibraryResponse } from "./speakingLibrary.js";

test("the complete built-in response is accepted", () => {
  const response = coreFallbackActivities();
  assert.equal(isCompatibleCoreLibraryResponse(response), true);
  assert.equal(response.length, 30);
});

test("partial, duplicate, and incompatible template responses fall back instead of replacing the library", () => {
  const response = coreFallbackActivities();
  assert.equal(isCompatibleCoreLibraryResponse(response.slice(0, 6)), false);
  assert.equal(isCompatibleCoreLibraryResponse([...response.slice(0, -1), response[0]]), false);
  assert.equal(isCompatibleCoreLibraryResponse(response.map((item) => ({ ...item, scenarioResources: { ...item.scenarioResources, builtIn: undefined } }))), false);
  assert.equal(isCompatibleCoreLibraryResponse(SPEAKING_CORE_LIBRARY.slice(0, 6)), false);
});
