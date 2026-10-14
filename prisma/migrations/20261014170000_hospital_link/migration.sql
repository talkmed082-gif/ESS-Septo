-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tsaScanFrom" TEXT,
ADD COLUMN     "tsaScanRequestedAt" TIMESTAMP(3),
ADD COLUMN     "tsaScanTo" TEXT;

-- CreateTable
CREATE TABLE "TsaRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rangeFrom" TEXT NOT NULL,
    "rangeTo" TEXT NOT NULL,
    "found" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "held" JSONB NOT NULL DEFAULT '[]',
    "dups" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TsaRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutpatientList" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clinic" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutpatientList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TsaRun_createdById_createdAt_idx" ON "TsaRun"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutpatientList_createdById_date_key" ON "OutpatientList"("createdById", "date");

-- AddForeignKey
ALTER TABLE "TsaRun" ADD CONSTRAINT "TsaRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpatientList" ADD CONSTRAINT "OutpatientList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

