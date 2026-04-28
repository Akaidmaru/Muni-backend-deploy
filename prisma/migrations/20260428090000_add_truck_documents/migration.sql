-- CreateEnum
CREATE TYPE "TruckDocumentType" AS ENUM (
    'TECHNICAL_REVIEW',
    'CIRCULATION_PERMIT',
    'INSURANCE',
    'EMISSIONS'
);

-- CreateTable
CREATE TABLE "TruckDocument" (
    "id" SERIAL NOT NULL,
    "truckId" INTEGER NOT NULL,
    "documentType" "TruckDocumentType" NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TruckDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TruckDocument_truckId_idx" ON "TruckDocument"("truckId");

-- CreateIndex
CREATE INDEX "TruckDocument_documentType_idx" ON "TruckDocument"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "TruckDocument_truckId_documentType_key" ON "TruckDocument"("truckId", "documentType");

-- AddForeignKey
ALTER TABLE "TruckDocument"
ADD CONSTRAINT "TruckDocument_truckId_fkey"
FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
