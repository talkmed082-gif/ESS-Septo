-- AlterTable
ALTER TABLE "User" ADD COLUMN "erCheckDate" TEXT,
ADD COLUMN "erCheckRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ErVisit" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "chartNo" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "sexAge" TEXT,
    "arrivedAt" TEXT,
    "dept" TEXT,
    "complaint" TEXT,
    "resident" TEXT,
    "dischargedAt" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "call" TEXT,
    "arrive" TEXT,
    "end" TEXT,
    "oncallStatus" TEXT,
    "oncallRequestedAt" TIMESTAMP(3),
    "oncallMessage" TEXT,
    "oncallSavedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErVisit_createdById_date_chartNo_key" ON "ErVisit"("createdById", "date", "chartNo");

-- AddForeignKey
ALTER TABLE "ErVisit" ADD CONSTRAINT "ErVisit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
