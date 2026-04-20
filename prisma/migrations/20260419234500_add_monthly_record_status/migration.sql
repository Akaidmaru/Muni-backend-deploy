DO $$
BEGIN
  CREATE TYPE "MonthlyMaintenanceRecordStatus" AS ENUM ('PENDING', 'REVIEWED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "MonthlyMaintenanceRecord"
ADD COLUMN IF NOT EXISTS "status" "MonthlyMaintenanceRecordStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "MonthlyMaintenanceRecord" r
SET "status" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "MonthlyMaintenanceItem" i
    WHERE i."recordId" = r."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "MonthlyMaintenanceItem" i
    WHERE i."recordId" = r."id"
      AND LOWER(TRIM(COALESCE(i."status", ''))) IN ('regular', 'malo')
  ) THEN 'REVIEWED'::"MonthlyMaintenanceRecordStatus"
  ELSE 'PENDING'::"MonthlyMaintenanceRecordStatus"
END;
