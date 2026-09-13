-- Set-level assessment emphasis is persisted separately from the teacher-facing description.
ALTER TABLE "SpeakingSet" ADD COLUMN "focus" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SpeakingSession" ADD COLUMN "speakingSetFocusSnapshot" TEXT;
