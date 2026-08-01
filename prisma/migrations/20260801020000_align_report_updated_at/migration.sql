-- Prisma owns @updatedAt values on writes. The temporary default in the
-- preceding additive migration was needed only to populate existing rows.
ALTER TABLE "Report" ALTER COLUMN "updatedAt" DROP DEFAULT;
