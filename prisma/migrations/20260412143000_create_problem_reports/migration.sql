-- CreateEnum
CREATE TYPE "ProblemReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

-- CreateTable
CREATE TABLE "ProblemReport" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshot_key" TEXT,
    "status" "ProblemReportStatus" NOT NULL DEFAULT 'OPEN',
    "reporterId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProblemReport_reporterId_idx" ON "ProblemReport"("reporterId");

-- CreateIndex
CREATE INDEX "ProblemReport_status_idx" ON "ProblemReport"("status");

-- CreateIndex
CREATE INDEX "ProblemReport_createdAt_idx" ON "ProblemReport"("createdAt");

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
