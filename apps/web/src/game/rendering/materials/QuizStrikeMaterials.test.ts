import assert from "node:assert/strict";
import test from "node:test";
import { createQuizStrikeMaterial, styleForArenaSurface } from "./QuizStrikeMaterials";

test("surface vocabulary maps to the shared stylized material system", () => {
  assert.equal(styleForArenaSurface("stone"), "stone");
  assert.equal(styleForArenaSurface("gravel"), "sand");
  assert.equal(styleForArenaSurface("wood"), "wood");
  assert.equal(styleForArenaSurface("metal"), "metal");
  assert.equal(styleForArenaSurface("cloth"), "fabric");
  assert.equal(styleForArenaSurface("vegetation"), "vegetation");
  assert.equal(styleForArenaSurface("emissive"), "emissive");
});

test("material response stays inside the authored readability range", () => {
  const material = createQuizStrikeMaterial("metal", {
    color: "#ff8b4d",
    roughness: 2,
    metalness: -1,
    envMapIntensity: 4
  });

  assert.equal(material.roughness, 0.96);
  assert.equal(material.metalness, 0);
  assert.equal(material.envMapIntensity, 1.25);
  material.dispose();
});

test("emissive accents preserve their authored color", () => {
  const material = createQuizStrikeMaterial("emissive", { color: "#4de7ff", emissiveIntensity: 0.42 });
  assert.equal(material.emissive.getHexString(), "4de7ff");
  assert.equal(material.emissiveIntensity, 0.42);
  material.dispose();
});
