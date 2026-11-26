CREATE TYPE "SpeakingLocalSpeechReadiness" AS ENUM ('preparing', 'downloading', 'ready', 'issue', 'alternative');

ALTER TABLE "SpeakingSession" ADD COLUMN "localTranscription" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SpeakingParticipant" ADD COLUMN "localSpeechReadiness" "SpeakingLocalSpeechReadiness";
ALTER TABLE "SpeakingTurn"
  ADD COLUMN "clientTranscribed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "transcriptionUncertain" BOOLEAN NOT NULL DEFAULT false;
