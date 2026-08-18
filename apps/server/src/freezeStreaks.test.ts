import assert from "node:assert/strict";
import test from "node:test";
import { announcementForFreezeStreak, incrementFreezeStreak } from "./freezeStreaks.js";

test("freeze streak announcements stay at Godlike after the highest threshold", () => {
  let streak = 0;
  const phrases: string[] = [];
  for (let index = 0; index < 9; index += 1) {
    streak = incrementFreezeStreak(streak);
    const announcement = announcementForFreezeStreak(streak);
    if (announcement) phrases.push(announcement.phrase);
  }
  assert.deepEqual(phrases, [
    "He's heating up!",
    "Dominating!",
    "Unstoppable!",
    "Wicked Sick!",
    "Muh-Muh-Muh-Monster!",
    "Guh-Guh-Guh-Godlike!",
    "Guh-Guh-Guh-Godlike!"
  ]);
  assert.equal(announcementForFreezeStreak(9)?.key, "STREAK_GODLIKE");
});

test("invalid or reset streak values start again at one", () => {
  assert.equal(incrementFreezeStreak(undefined), 1);
  assert.equal(incrementFreezeStreak(-4), 1);
  assert.equal(incrementFreezeStreak(3.8), 4);
  assert.equal(incrementFreezeStreak(8), 9, "the authoritative streak keeps counting beyond the final announcement rank");
});
