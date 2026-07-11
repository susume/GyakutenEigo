-- Preserve the existing lightweight runtime state between server restarts.
CREATE TABLE "RuntimeSnapshot" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeSnapshot_pkey" PRIMARY KEY ("id")
);
