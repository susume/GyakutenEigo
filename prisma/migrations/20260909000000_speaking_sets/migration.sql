-- Speaking Practice organization. Sets are independent containers: deleting a
-- set never deletes its reusable Performance Tests or classroom history.
CREATE TABLE "SpeakingSet" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpeakingSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpeakingSetActivity" (
    "setId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SpeakingSetActivity_pkey" PRIMARY KEY ("setId", "activityId")
);

CREATE INDEX "SpeakingSet_teacherId_updatedAt_idx" ON "SpeakingSet"("teacherId", "updatedAt");
CREATE INDEX "SpeakingSetActivity_activityId_position_idx" ON "SpeakingSetActivity"("activityId", "position");
CREATE INDEX "SpeakingSetActivity_setId_position_idx" ON "SpeakingSetActivity"("setId", "position");

ALTER TABLE "SpeakingSet"
  ADD CONSTRAINT "SpeakingSet_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpeakingSetActivity"
  ADD CONSTRAINT "SpeakingSetActivity_setId_fkey"
  FOREIGN KEY ("setId") REFERENCES "SpeakingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SpeakingSetActivity_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "SpeakingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
