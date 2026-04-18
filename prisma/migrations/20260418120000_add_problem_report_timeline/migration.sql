-- CreateEnum
CREATE TYPE "ProblemReportEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'NOTE_ADDED', 'NOTE_AND_STATUS_CHANGED');

-- CreateTable
CREATE TABLE "ProblemReportTimeline" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "eventType" "ProblemReportEventType" NOT NULL,
    "previousStatus" "ProblemReportStatus" NOT NULL,
    "newStatus" "ProblemReportStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemReportTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProblemReportTimeline_reportId_idx" ON "ProblemReportTimeline"("reportId");

-- CreateIndex
CREATE INDEX "ProblemReportTimeline_actorId_idx" ON "ProblemReportTimeline"("actorId");

-- CreateIndex
CREATE INDEX "ProblemReportTimeline_createdAt_idx" ON "ProblemReportTimeline"("createdAt");

-- AddForeignKey
ALTER TABLE "ProblemReportTimeline" ADD CONSTRAINT "ProblemReportTimeline_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ProblemReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemReportTimeline" ADD CONSTRAINT "ProblemReportTimeline_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
