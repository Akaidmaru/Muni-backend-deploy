-- CreateEnum
CREATE TYPE "DailyMaintenanceRecordStatus" AS ENUM ('PENDING', 'REVIEWED');

-- AlterTable
ALTER TABLE "DailyMaintenanceRecord"
ADD COLUMN "status" "DailyMaintenanceRecordStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill: records without Regular/Malo become REVIEWED.
UPDATE "DailyMaintenanceRecord" r
SET "status" = 'REVIEWED'
WHERE NOT EXISTS (
  SELECT 1
  FROM "DailyMaintenanceItem" i
  WHERE i."recordId" = r."id"
    AND LOWER(COALESCE(i."status", '')) IN ('regular', 'malo')
);
