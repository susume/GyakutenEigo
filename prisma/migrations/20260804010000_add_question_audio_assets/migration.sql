CREATE TABLE "QuestionAudio" (
  "questionId" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionAudio_pkey" PRIMARY KEY ("questionId")
);

ALTER TABLE "QuestionAudio"
  ADD CONSTRAINT "QuestionAudio_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
