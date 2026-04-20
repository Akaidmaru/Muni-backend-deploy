-- AlterTable
ALTER TABLE "TripHistory" ADD COLUMN     "driverId" INTEGER;

-- CreateIndex
CREATE INDEX "TripHistory_driverId_idx" ON "TripHistory"("driverId");

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
