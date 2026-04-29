ALTER TABLE "DailyMaintenanceRecord"
DROP CONSTRAINT "DailyMaintenanceRecord_truckId_inspectionDate_key";

ALTER TABLE "DailyMaintenanceRecord"
ADD CONSTRAINT "DailyMaintenanceRecord_driverId_truckId_inspectionDate_key"
UNIQUE ("driverId", "truckId", "inspectionDate");
