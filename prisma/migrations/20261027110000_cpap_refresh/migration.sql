-- AlterTable
ALTER TABLE "User" ADD COLUMN     "outpatientRefreshDate" TEXT,
ADD COLUMN     "outpatientRefreshAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PatientCare" ADD COLUMN     "cpap" JSONB;
