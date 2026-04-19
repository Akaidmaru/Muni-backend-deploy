-- Manual local alignment for non-destructive upgrade from legacy schema
-- to the current backend schema expectations.

-- 1) User: add rut (required+unique in current schema) and ensure values
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "rut" TEXT;

UPDATE "User"
SET "rut" = 'TEMP-RUT-' || "id"::text
WHERE "rut" IS NULL OR BTRIM("rut") = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'User_rut_key'
  ) THEN
    CREATE UNIQUE INDEX "User_rut_key" ON "User" ("rut");
  END IF;
END $$;

ALTER TABLE "User"
  ALTER COLUMN "rut" SET NOT NULL;

-- 2) UserRole: add new enum value used by backend
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'PENDING_APPROVAL'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'PENDING_APPROVAL';
  END IF;
END $$;

-- 3) Truck: fields expected by current schema
ALTER TABLE "Truck"
  ADD COLUMN IF NOT EXISTS "brand" TEXT,
  ADD COLUMN IF NOT EXISTS "year" INTEGER,
  ADD COLUMN IF NOT EXISTS "seatCount" INTEGER;

-- 4) Daily maintenance tables (new schema)
CREATE TABLE IF NOT EXISTS "DailyMaintenanceRecord" (
  "id" SERIAL PRIMARY KEY,
  "truckId" INTEGER NOT NULL,
  "driverId" INTEGER NOT NULL,
  "inspectionDate" DATE NOT NULL,
  "inspectionTime" TEXT NOT NULL,
  "municipalLicense" TEXT NOT NULL,
  "currentMileage" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailyMaintenanceRecord_truckId_fkey'
  ) THEN
    ALTER TABLE "DailyMaintenanceRecord"
      ADD CONSTRAINT "DailyMaintenanceRecord_truckId_fkey"
      FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailyMaintenanceRecord_driverId_fkey'
  ) THEN
    ALTER TABLE "DailyMaintenanceRecord"
      ADD CONSTRAINT "DailyMaintenanceRecord_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DailyMaintenanceRecord_truckId_driverId_inspectionDate_key"
  ON "DailyMaintenanceRecord"("truckId", "driverId", "inspectionDate");
CREATE INDEX IF NOT EXISTS "DailyMaintenanceRecord_truckId_idx"
  ON "DailyMaintenanceRecord"("truckId");
CREATE INDEX IF NOT EXISTS "DailyMaintenanceRecord_driverId_idx"
  ON "DailyMaintenanceRecord"("driverId");
CREATE INDEX IF NOT EXISTS "DailyMaintenanceRecord_inspectionDate_idx"
  ON "DailyMaintenanceRecord"("inspectionDate");

CREATE TABLE IF NOT EXISTS "DailyMaintenanceItem" (
  "id" SERIAL PRIMARY KEY,
  "recordId" INTEGER NOT NULL,
  "itemCode" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "exists" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailyMaintenanceItem_recordId_fkey'
  ) THEN
    ALTER TABLE "DailyMaintenanceItem"
      ADD CONSTRAINT "DailyMaintenanceItem_recordId_fkey"
      FOREIGN KEY ("recordId") REFERENCES "DailyMaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DailyMaintenanceItem_recordId_itemCode_key"
  ON "DailyMaintenanceItem"("recordId", "itemCode");
CREATE INDEX IF NOT EXISTS "DailyMaintenanceItem_recordId_idx"
  ON "DailyMaintenanceItem"("recordId");

-- 5) Monthly maintenance tables (new schema)
CREATE TABLE IF NOT EXISTS "MonthlyMaintenanceRecord" (
  "id" SERIAL PRIMARY KEY,
  "truckId" INTEGER NOT NULL,
  "monthKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MonthlyMaintenanceRecord_truckId_fkey'
  ) THEN
    ALTER TABLE "MonthlyMaintenanceRecord"
      ADD CONSTRAINT "MonthlyMaintenanceRecord_truckId_fkey"
      FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyMaintenanceRecord_truckId_monthKey_key"
  ON "MonthlyMaintenanceRecord"("truckId", "monthKey");
CREATE INDEX IF NOT EXISTS "MonthlyMaintenanceRecord_truckId_idx"
  ON "MonthlyMaintenanceRecord"("truckId");
CREATE INDEX IF NOT EXISTS "MonthlyMaintenanceRecord_monthKey_idx"
  ON "MonthlyMaintenanceRecord"("monthKey");

CREATE TABLE IF NOT EXISTS "MonthlyMaintenanceItem" (
  "id" SERIAL PRIMARY KEY,
  "recordId" INTEGER NOT NULL,
  "weekIndex" INTEGER NOT NULL,
  "itemCode" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MonthlyMaintenanceItem_recordId_fkey'
  ) THEN
    ALTER TABLE "MonthlyMaintenanceItem"
      ADD CONSTRAINT "MonthlyMaintenanceItem_recordId_fkey"
      FOREIGN KEY ("recordId") REFERENCES "MonthlyMaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyMaintenanceItem_recordId_weekIndex_itemCode_key"
  ON "MonthlyMaintenanceItem"("recordId", "weekIndex", "itemCode");
CREATE INDEX IF NOT EXISTS "MonthlyMaintenanceItem_recordId_idx"
  ON "MonthlyMaintenanceItem"("recordId");
CREATE INDEX IF NOT EXISTS "MonthlyMaintenanceItem_weekIndex_idx"
  ON "MonthlyMaintenanceItem"("weekIndex");

-- 6) Optional data copy from legacy maintenance tables if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'VehicleMaintenanceRecord'
  ) THEN
    INSERT INTO "DailyMaintenanceRecord"
      ("id", "truckId", "driverId", "inspectionDate", "inspectionTime", "municipalLicense", "currentMileage", "createdAt", "updatedAt")
    SELECT
      v."id",
      v."truckId",
      v."driverId",
      v."inspectionDate",
      v."inspectionTime",
      v."municipalLicense",
      v."currentMileage",
      v."createdAt",
      v."updatedAt"
    FROM "VehicleMaintenanceRecord" v
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'MaintenanceItem'
  ) THEN
    INSERT INTO "DailyMaintenanceItem"
      ("id", "recordId", "itemCode", "itemName", "category", "exists", "status", "notes")
    SELECT
      m."id",
      m."recordId",
      m."itemCode",
      m."itemName",
      m."category",
      m."exists",
      m."status",
      m."notes"
    FROM "MaintenanceItem" m
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- 7) Reset sequences after explicit id inserts
SELECT setval(
  pg_get_serial_sequence('"DailyMaintenanceRecord"', 'id'),
  COALESCE((SELECT MAX("id") FROM "DailyMaintenanceRecord"), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('"DailyMaintenanceItem"', 'id'),
  COALESCE((SELECT MAX("id") FROM "DailyMaintenanceItem"), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('"MonthlyMaintenanceRecord"', 'id'),
  COALESCE((SELECT MAX("id") FROM "MonthlyMaintenanceRecord"), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('"MonthlyMaintenanceItem"', 'id'),
  COALESCE((SELECT MAX("id") FROM "MonthlyMaintenanceItem"), 1),
  true
);
