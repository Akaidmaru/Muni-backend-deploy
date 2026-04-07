-- CreateTable
CREATE TABLE "VehicleMaintenanceRecord" (
    "id" SERIAL NOT NULL,
    "truckId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspectionTime" TEXT NOT NULL,
    "municipalLicense" TEXT NOT NULL,
    "currentMileage" DOUBLE PRECISION NOT NULL,
    "technicalReviewStatus" TEXT NOT NULL,
    "circulationPermitStatus" TEXT NOT NULL,
    "insuranceStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceItem" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "exists" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "MaintenanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleMaintenanceRecord_truckId_idx" ON "VehicleMaintenanceRecord"("truckId");

-- CreateIndex
CREATE INDEX "VehicleMaintenanceRecord_driverId_idx" ON "VehicleMaintenanceRecord"("driverId");

-- CreateIndex
CREATE INDEX "VehicleMaintenanceRecord_inspectionDate_idx" ON "VehicleMaintenanceRecord"("inspectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMaintenanceRecord_truckId_driverId_inspectionDate_key" ON "VehicleMaintenanceRecord"("truckId", "driverId", "inspectionDate");

-- CreateIndex
CREATE INDEX "MaintenanceItem_recordId_idx" ON "MaintenanceItem"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceItem_recordId_itemCode_key" ON "MaintenanceItem"("recordId", "itemCode");

-- AddForeignKey
ALTER TABLE "VehicleMaintenanceRecord" ADD CONSTRAINT "VehicleMaintenanceRecord_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenanceRecord" ADD CONSTRAINT "VehicleMaintenanceRecord_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceItem" ADD CONSTRAINT "MaintenanceItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "VehicleMaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
