import assert from "node:assert/strict";
import test from "node:test";
import { getShopShortcut, getShopShortcutKey, SHOP_SHORTCUTS } from "./shopShortcuts.js";

test("shop shortcuts map B then 1-6 to every purchasable menu item", () => {
  assert.deepEqual(SHOP_SHORTCUTS.map(({ key, item }) => [key, item]), [
    ["1", "snowballs"],
    ["2", "quick_blaster"],
    ["3", "power_blaster"],
    ["4", "shield_vest"],
    ["5", "speed_shoes"],
    ["6", "snowballs_large"]
  ]);
  assert.equal(getShopShortcut("1")?.item, "snowballs");
  assert.equal(getShopShortcut("5")?.item, "speed_shoes");
  assert.equal(getShopShortcut("6")?.item, "snowballs_large");
  assert.equal(getShopShortcutKey("power_blaster"), "3");
});
