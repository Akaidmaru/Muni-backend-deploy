CREATE TABLE "MonthlyMaintenanceRecord" (
    "id" SERIAL NOT NULL,
    "truckId" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyMaintenanceItem" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "MonthlyMaintenanceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyMaintenanceRecord_truckId_monthKey_key"
ON "MonthlyMaintenanceRecord"("truckId", "monthKey");

CREATE INDEX "MonthlyMaintenanceRecord_truckId_idx"
ON "MonthlyMaintenanceRecord"("truckId");

CREATE INDEX "MonthlyMaintenanceRecord_monthKey_idx"
ON "MonthlyMaintenanceRecord"("monthKey");

CREATE INDEX "MonthlyMaintenanceRecord_createdById_idx"
ON "MonthlyMaintenanceRecord"("createdById");

CREATE UNIQUE INDEX "MonthlyMaintenanceItem_recordId_weekIndex_itemCode_key"
ON "MonthlyMaintenanceItem"("recordId", "weekIndex", "itemCode");

CREATE INDEX "MonthlyMaintenanceItem_recordId_idx"
ON "MonthlyMaintenanceItem"("recordId");

CREATE INDEX "MonthlyMaintenanceItem_weekIndex_idx"
ON "MonthlyMaintenanceItem"("weekIndex");

ALTER TABLE "MonthlyMaintenanceRecord"
ADD CONSTRAINT "MonthlyMaintenanceRecord_truckId_fkey"
FOREIGN KEY ("truckId") REFERENCES "Truck"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyMaintenanceRecord"
ADD CONSTRAINT "MonthlyMaintenanceRecord_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyMaintenanceItem"
ADD CONSTRAINT "MonthlyMaintenanceItem_recordId_fkey"
FOREIGN KEY ("recordId") REFERENCES "MonthlyMaintenanceRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
