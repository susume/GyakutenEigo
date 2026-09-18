CREATE TYPE "SpeakingMode" AS ENUM ('practice', 'assessment');

ALTER TABLE "SpeakingActivity"
  ADD COLUMN "mode" "SpeakingMode" NOT NULL DEFAULT 'assessment',
  ADD COLUMN "supportSettingsJson" JSONB NOT NULL DEFAULT '{"showTargetExpressions":true,"showContext":true,"showTranscript":true,"allowReplay":true,"allowHelp":true}'::jsonb;
