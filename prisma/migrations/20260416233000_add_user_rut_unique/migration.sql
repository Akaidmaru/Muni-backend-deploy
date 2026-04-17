-- Add required unique RUT field to users.
-- Existing users are backfilled with deterministic temporary values.
ALTER TABLE "User" ADD COLUMN "rut" TEXT;

UPDATE "User"
SET "rut" = 'TEMP-' || "id"::text
WHERE "rut" IS NULL;

ALTER TABLE "User" ALTER COLUMN "rut" SET NOT NULL;

CREATE UNIQUE INDEX "User_rut_key" ON "User"("rut");
