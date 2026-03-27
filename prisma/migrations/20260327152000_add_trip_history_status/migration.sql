-- CreateEnum
CREATE TYPE "TripHistoryStatus" AS ENUM ('DRIVER_FILLING', 'EMPLOYEE_SIGNED', 'COMPLETED');

-- AlterTable
ALTER TABLE "TripHistory" ADD COLUMN "status" "TripHistoryStatus" NOT NULL DEFAULT 'DRIVER_FILLING';

-- Backfill status from current data
UPDATE "TripHistory"
SET "status" = CASE
  WHEN "endTime" IS NOT NULL THEN 'COMPLETED'::"TripHistoryStatus"
  WHEN "patientId" IS NOT NULL THEN 'EMPLOYEE_SIGNED'::"TripHistoryStatus"
  ELSE 'DRIVER_FILLING'::"TripHistoryStatus"
END;

-- CreateIndex
CREATE INDEX "TripHistory_status_idx" ON "TripHistory"("status");
