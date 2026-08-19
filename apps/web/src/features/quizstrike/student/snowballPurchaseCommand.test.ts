import assert from "node:assert/strict";
import test from "node:test";
import { buildSnowballPurchaseCommand } from "./snowballPurchaseCommand.js";

test("standard snowball packs keep the legacy empty command payload", () => {
  assert.deepEqual(buildSnowballPurchaseCommand("standard"), {});
});

test("bulk snowball packs opt into the packSize command field", () => {
  assert.deepEqual(buildSnowballPurchaseCommand("large"), { packSize: "large" });
});
