/*
  Warnings:

  - Made the column `endTime` on table `TripHistory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `endKm` on table `TripHistory` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "TripHistory" DROP CONSTRAINT "TripHistory_destinationId_fkey";

-- DropForeignKey
ALTER TABLE "TripHistory" DROP CONSTRAINT "TripHistory_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "TripHistory" DROP CONSTRAINT "TripHistory_truckId_fkey";

-- AlterTable
ALTER TABLE "TripHistory" ALTER COLUMN "endTime" SET NOT NULL,
ALTER COLUMN "endKm" SET NOT NULL;

-- AlterTable
ALTER TABLE "Truck" ADD COLUMN     "mileage" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
