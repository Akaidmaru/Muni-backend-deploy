/*
  Warnings:

  - The values [CLIENT] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('PATIENT', 'EMPLOYEE', 'DRIVER', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'PATIENT';
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "occupationId" INTEGER,
ALTER COLUMN "role" SET DEFAULT 'PATIENT';

-- CreateTable
CREATE TABLE "Occupation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Occupation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
