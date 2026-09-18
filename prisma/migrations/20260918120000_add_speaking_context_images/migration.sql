CREATE TABLE "SpeakingContextImage" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SpeakingContextImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpeakingContextImage_teacherId_createdAt_idx" ON "SpeakingContextImage"("teacherId", "createdAt");
CREATE INDEX "SpeakingContextImage_deletedAt_idx" ON "SpeakingContextImage"("deletedAt");

ALTER TABLE "SpeakingContextImage" ADD CONSTRAINT "SpeakingContextImage_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
