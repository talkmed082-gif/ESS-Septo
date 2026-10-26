-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consultTriggerToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_consultTriggerToken_key" ON "User"("consultTriggerToken");
