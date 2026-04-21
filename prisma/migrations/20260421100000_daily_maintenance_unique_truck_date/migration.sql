-- Align daily maintenance uniqueness with business rule: one record per truck per day.
-- Drop old unique constraint (truck + driver + date), then create new one (truck + date).
ALTER TABLE "DailyMaintenanceRecord"
DROP CONSTRAINT IF EXISTS "DailyMaintenanceRecord_truckId_driverId_inspectionDate_key";

ALTER TABLE "DailyMaintenanceRecord"
ADD CONSTRAINT "DailyMaintenanceRecord_truckId_inspectionDate_key"
UNIQUE ("truckId", "inspectionDate");
