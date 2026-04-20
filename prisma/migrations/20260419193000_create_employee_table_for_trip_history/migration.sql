CREATE TABLE "Employee" (
  "id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Employee_name_idx" ON "Employee"("name");

INSERT INTO "Employee" ("id", "name", "active", "createdAt")
SELECT DISTINCT
  u."id",
  COALESCE(NULLIF(BTRIM(u."name"), ''), u."email"),
  true,
  u."createdAt"
FROM "User" u
WHERE u."role" = 'EMPLOYEE'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Employee" ("id", "name", "active", "createdAt")
SELECT DISTINCT
  u."id",
  COALESCE(NULLIF(BTRIM(u."name"), ''), u."email"),
  true,
  u."createdAt"
FROM "TripHistory" th
JOIN "User" u ON u."id" = th."employeeId"
ON CONFLICT ("id") DO NOTHING;

CREATE SEQUENCE "Employee_id_seq" OWNED BY "Employee"."id";
ALTER TABLE "Employee" ALTER COLUMN "id" SET DEFAULT nextval('"Employee_id_seq"');
SELECT setval('"Employee_id_seq"', COALESCE((SELECT MAX("id") FROM "Employee"), 1), true);

ALTER TABLE "TripHistory" DROP CONSTRAINT "TripHistory_employeeId_fkey";
ALTER TABLE "TripHistory"
  ADD CONSTRAINT "TripHistory_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
