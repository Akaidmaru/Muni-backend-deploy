-- AlterTable
ALTER TABLE "TripHistory" ADD COLUMN "patientId" INTEGER;

-- CreateIndex
CREATE INDEX "TripHistory_patientId_idx" ON "TripHistory"("patientId");

-- AddForeignKey
ALTER TABLE "TripHistory" ADD CONSTRAINT "TripHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
