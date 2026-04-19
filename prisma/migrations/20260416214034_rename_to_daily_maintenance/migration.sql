/*
  Warnings:

  - You are about to drop the column `patientId` on the `TripHistory` table. All the data in the column will be lost.
  - You are about to drop the `MaintenanceItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Patient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VehicleMaintenanceRecord` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MaintenanceItem" DROP CONSTRAINT "MaintenanceItem_recordId_fkey";

-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_destinationId_fkey";

-- DropForeignKey
ALTER TABLE "TripHistory" DROP CONSTRAINT "TripHistory_patientId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleMaintenanceRecord" DROP CONSTRAINT "VehicleMaintenanceRecord_driverId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleMaintenanceRecord" DROP CONSTRAINT "VehicleMaintenanceRecord_truckId_fkey";

-- DropIndex
DROP INDEX "TripHistory_patientId_idx";

-- AlterTable
ALTER TABLE "TripHistory" DROP COLUMN "patientId";

-- DropTable
DROP TABLE "MaintenanceItem";

-- DropTable
DROP TABLE "Patient";

-- DropTable
DROP TABLE "VehicleMaintenanceRecord";

-- CreateTable
CREATE TABLE "DailyMaintenanceRecord" (
    "id" SERIAL NOT NULL,
    "truckId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "inspectionDate" DATE NOT NULL,
    "inspectionTime" TEXT NOT NULL,
    "municipalLicense" TEXT NOT NULL,
    "currentMileage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMaintenanceItem" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "exists" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "DailyMaintenanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyMaintenanceRecord_truckId_idx" ON "DailyMaintenanceRecord"("truckId");

-- CreateIndex
CREATE INDEX "DailyMaintenanceRecord_driverId_idx" ON "DailyMaintenanceRecord"("driverId");

-- CreateIndex
CREATE INDEX "DailyMaintenanceRecord_inspectionDate_idx" ON "DailyMaintenanceRecord"("inspectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMaintenanceRecord_truckId_driverId_inspectionDate_key" ON "DailyMaintenanceRecord"("truckId", "driverId", "inspectionDate");

-- CreateIndex
CREATE INDEX "DailyMaintenanceItem_recordId_idx" ON "DailyMaintenanceItem"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMaintenanceItem_recordId_itemCode_key" ON "DailyMaintenanceItem"("recordId", "itemCode");

-- AddForeignKey
ALTER TABLE "DailyMaintenanceRecord" ADD CONSTRAINT "DailyMaintenanceRecord_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMaintenanceRecord" ADD CONSTRAINT "DailyMaintenanceRecord_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMaintenanceItem" ADD CONSTRAINT "DailyMaintenanceItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "DailyMaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
