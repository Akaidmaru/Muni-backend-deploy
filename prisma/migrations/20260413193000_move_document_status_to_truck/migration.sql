-- Move document status fields from VehicleMaintenanceRecord to Truck
ALTER TABLE "Truck"
ADD COLUMN "technicalReviewStatus" TEXT NOT NULL DEFAULT 'No tiene',
ADD COLUMN "circulationPermitStatus" TEXT NOT NULL DEFAULT 'No tiene',
ADD COLUMN "insuranceStatus" TEXT NOT NULL DEFAULT 'No tiene',
ADD COLUMN "emissionsStatus" TEXT NOT NULL DEFAULT 'No tiene';

-- Backfill Truck document statuses using the latest maintenance record per truck
WITH latest_record AS (
  SELECT DISTINCT ON ("truckId")
    "truckId",
    "technicalReviewStatus",
    "circulationPermitStatus",
    "insuranceStatus"
  FROM "VehicleMaintenanceRecord"
  ORDER BY "truckId", "inspectionDate" DESC, "createdAt" DESC
)
UPDATE "Truck" t
SET
  "technicalReviewStatus" = COALESCE(lr."technicalReviewStatus", t."technicalReviewStatus"),
  "circulationPermitStatus" = COALESCE(lr."circulationPermitStatus", t."circulationPermitStatus"),
  "insuranceStatus" = COALESCE(lr."insuranceStatus", t."insuranceStatus")
FROM latest_record lr
WHERE t."id" = lr."truckId";

ALTER TABLE "VehicleMaintenanceRecord"
DROP COLUMN "technicalReviewStatus",
DROP COLUMN "circulationPermitStatus",
DROP COLUMN "insuranceStatus";
