-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sideNotation" TEXT NOT NULL DEFAULT 'full',
ADD COLUMN     "abbreviateRegions" BOOLEAN NOT NULL DEFAULT false;
