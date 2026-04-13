-- CreateEnum
CREATE TYPE "TruckStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PlateChangeReason" AS ENUM ('LOGISTICA', 'AVERIA');

-- AlterTable
ALTER TABLE "Truck"
ADD COLUMN "status" "TruckStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "TruckPlateChangeLog" (
    "id" SERIAL NOT NULL,
    "truckId" INTEGER NOT NULL,
    "changedByUserId" INTEGER NOT NULL,
    "reason" "PlateChangeReason" NOT NULL,
    "observations" TEXT NOT NULL,
    "previousStatus" "TruckStatus" NOT NULL,
    "newStatus" "TruckStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TruckPlateChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TruckPlateChangeLog_truckId_idx" ON "TruckPlateChangeLog"("truckId");

-- CreateIndex
CREATE INDEX "TruckPlateChangeLog_changedByUserId_idx" ON "TruckPlateChangeLog"("changedByUserId");

-- CreateIndex
CREATE INDEX "TruckPlateChangeLog_createdAt_idx" ON "TruckPlateChangeLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TruckPlateChangeLog" ADD CONSTRAINT "TruckPlateChangeLog_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckPlateChangeLog" ADD CONSTRAINT "TruckPlateChangeLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
