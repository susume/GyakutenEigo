import { FREEZE_STREAK_ANNOUNCEMENTS, type FreezeStreakAnnouncementKey } from "@quizstrike/shared";

export const incrementFreezeStreak = (current: number | undefined) =>
  Math.max(0, Math.floor(Number.isFinite(current) ? current! : 0)) + 1;

export const announcementForFreezeStreak = (streak: number): {
  key: FreezeStreakAnnouncementKey;
  phrase: string;
} | undefined => FREEZE_STREAK_ANNOUNCEMENTS[streak];
