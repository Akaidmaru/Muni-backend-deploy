-- CreateTable
CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "destinationId" INTEGER NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Patient_destinationId_idx" ON "Patient"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_destinationId_name_key" ON "Patient"("destinationId", "name");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum
BEGIN;
UPDATE "User" SET "role" = 'EMPLOYEE' WHERE "role" = 'PATIENT';
CREATE TYPE "UserRole_new" AS ENUM ('EMPLOYEE', 'DRIVER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
COMMIT;
