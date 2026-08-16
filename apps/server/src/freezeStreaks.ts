import { FREEZE_STREAK_ANNOUNCEMENTS, type FreezeStreakAnnouncementKey } from "@quizstrike/shared";

export const MAX_FREEZE_STREAK_ANNOUNCEMENT = 8;

export const incrementFreezeStreak = (current: number | undefined) =>
  Math.max(0, Math.floor(Number.isFinite(current) ? current! : 0)) + 1;

export const announcementForFreezeStreak = (streak: number): {
  key: FreezeStreakAnnouncementKey;
  phrase: string;
} | undefined => {
  if (!Number.isFinite(streak)) return undefined;
  const normalizedStreak = Math.max(0, Math.floor(streak));
  const announcementStreak = Math.min(MAX_FREEZE_STREAK_ANNOUNCEMENT, normalizedStreak);
  return FREEZE_STREAK_ANNOUNCEMENTS[announcementStreak];
};
