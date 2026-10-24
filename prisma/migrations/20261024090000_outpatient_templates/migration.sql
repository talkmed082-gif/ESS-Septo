-- CreateTable
CREATE TABLE "OutpatientTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'symptom',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "firstCc" TEXT NOT NULL DEFAULT '',
    "firstPi" TEXT NOT NULL DEFAULT '',
    "firstRos" TEXT NOT NULL DEFAULT '',
    "firstPe" TEXT NOT NULL DEFAULT '',
    "firstAssessment" TEXT NOT NULL DEFAULT '',
    "firstPlan" TEXT NOT NULL DEFAULT '',
    "followSubjective" TEXT NOT NULL DEFAULT '',
    "followObjective" TEXT NOT NULL DEFAULT '',
    "followAssessment" TEXT NOT NULL DEFAULT '',
    "followPlan" TEXT NOT NULL DEFAULT '',
    "setOrders" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutpatientTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmrSetOrder" (
    "id" TEXT NOT NULL,
    "ownerEmpNo" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "lines" JSONB,
    "createdById" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmrSetOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutpatientTemplate_createdById_idx" ON "OutpatientTemplate"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "EmrSetOrder_createdById_ownerEmpNo_key_key" ON "EmrSetOrder"("createdById", "ownerEmpNo", "key");

-- AddForeignKey
ALTER TABLE "OutpatientTemplate" ADD CONSTRAINT "OutpatientTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmrSetOrder" ADD CONSTRAINT "EmrSetOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
