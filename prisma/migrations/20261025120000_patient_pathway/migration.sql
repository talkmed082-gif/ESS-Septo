-- CreateTable
CREATE TABLE "PatientPathway" (
    "id" TEXT NOT NULL,
    "chartNo" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "proposedStageId" TEXT,
    "proposedReason" TEXT,
    "startedAt" TEXT NOT NULL,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitSummary" (
    "id" TEXT NOT NULL,
    "chartNo" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "pathwayId" TEXT,
    "stageId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientPathway_createdById_chartNo_pathwayId_key" ON "PatientPathway"("createdById", "chartNo", "pathwayId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitSummary_createdById_chartNo_visitDate_key" ON "VisitSummary"("createdById", "chartNo", "visitDate");

-- AddForeignKey
ALTER TABLE "PatientPathway" ADD CONSTRAINT "PatientPathway_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSummary" ADD CONSTRAINT "VisitSummary_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;