/*
  Warnings:

  - You are about to drop the column `destiny` on the `Route` table. All the data in the column will be lost.
  - Added the required column `destination` to the `Route` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Route" DROP COLUMN "destiny",
ADD COLUMN     "destination" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Destination" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripHistory" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "startKm" DOUBLE PRECISION NOT NULL,
    "endKm" DOUBLE PRECISION,
    "truckId" INTEGER NOT NULL,
    "destinationId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Destination_name_key" ON "Destination"("name");

-- CreateIndex
CREATE INDEX "TripHistory_date_idx" ON "TripHistory"("date");

-- CreateIndex
CREATE INDEX "TripHistory_truckId_idx" ON "TripHistory"("truckId");

-- CreateIndex
CREATE INDEX "TripHistory_destinationId_idx" ON "TripHistory"("destinationId");

-- CreateIndex
CREATE INDEX "TripHistory_employeeId_idx" ON "TripHistory"("employeeId");

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
