ALTER TABLE "MonthlyMaintenanceRecord"
DROP CONSTRAINT IF EXISTS "MonthlyMaintenanceRecord_createdById_fkey";

DROP INDEX IF EXISTS "MonthlyMaintenanceRecord_createdById_idx";

ALTER TABLE "MonthlyMaintenanceRecord"
DROP COLUMN IF EXISTS "createdById";
