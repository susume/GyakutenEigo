import assert from "node:assert/strict";
import test from "node:test";
import { resolveSiteLanguage } from "./siteLanguage.js";

test("explicit site selection takes priority over browser languages", () => {
  assert.equal(resolveSiteLanguage("ja", ["en-AU"]), "ja");
  assert.equal(resolveSiteLanguage("en", ["ja-JP"]), "en");
});

test("first supported browser language chooses the initial translation", () => {
  assert.equal(resolveSiteLanguage(null, ["ja-JP", "en"]), "ja");
  assert.equal(resolveSiteLanguage(null, ["en-AU", "ja"]), "en");
  assert.equal(resolveSiteLanguage("invalid", ["fr-FR", "JA-jp"]), "ja");
  assert.equal(resolveSiteLanguage(null, ["fr"]), "en");
  assert.equal(resolveSiteLanguage(null, []), "en");
});
