export const SHOP_SHORTCUTS = [
  { key: "1", item: "snowballs" },
  { key: "2", item: "quick_blaster" },
  { key: "3", item: "power_blaster" },
  { key: "4", item: "shield_vest" },
  { key: "5", item: "speed_shoes" }
] as const;

export const getShopShortcut = (key: string) => SHOP_SHORTCUTS.find((shortcut) => shortcut.key === key);

export const getShopShortcutKey = (item: string) =>
  SHOP_SHORTCUTS.find((shortcut) => shortcut.item === item)?.key;
