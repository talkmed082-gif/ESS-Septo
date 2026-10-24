-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clinicSchedule" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "RxBundle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'adult',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RxBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientCare" (
    "id" TEXT NOT NULL,
    "chartNo" TEXT NOT NULL,
    "planType" TEXT,
    "nextVisit" TEXT,
    "nextVisitLabel" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientCare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RxBundle_createdById_idx" ON "RxBundle"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "PatientCare_createdById_chartNo_key" ON "PatientCare"("createdById", "chartNo");

-- AddForeignKey
ALTER TABLE "RxBundle" ADD CONSTRAINT "RxBundle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCare" ADD CONSTRAINT "PatientCare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

