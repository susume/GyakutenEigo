import type { SnowballPackSize } from "@quizstrike/shared";

export const buildSnowballPurchaseCommand = (packSize: SnowballPackSize) =>
  packSize === "large" ? { packSize } : {};
