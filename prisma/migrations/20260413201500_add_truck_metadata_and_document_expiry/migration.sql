-- Add truck metadata
ALTER TABLE "Truck"
ADD COLUMN "brand" TEXT,
ADD COLUMN "year" INTEGER,
ADD COLUMN "seatCount" INTEGER;

-- Add document expiry dates
ALTER TABLE "Truck"
ADD COLUMN "technicalReviewExpiresAt" DATE,
ADD COLUMN "circulationPermitExpiresAt" DATE,
ADD COLUMN "insuranceExpiresAt" DATE,
ADD COLUMN "emissionsExpiresAt" DATE;
