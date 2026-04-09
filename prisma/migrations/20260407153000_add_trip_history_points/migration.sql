-- CreateTable
CREATE TABLE "TripHistoryPoint" (
    "id" SERIAL NOT NULL,
    "tripHistoryId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripHistoryPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripHistoryPoint_tripHistoryId_idx" ON "TripHistoryPoint"("tripHistoryId");

-- CreateIndex
CREATE INDEX "TripHistoryPoint_tripHistoryId_id_idx" ON "TripHistoryPoint"("tripHistoryId", "id");

-- AddForeignKey
ALTER TABLE "TripHistoryPoint" ADD CONSTRAINT "TripHistoryPoint_tripHistoryId_fkey" FOREIGN KEY ("tripHistoryId") REFERENCES "TripHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;