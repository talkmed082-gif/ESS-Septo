-- AlterTable
ALTER TABLE "User" ADD COLUMN "importToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_importToken_key" ON "User"("importToken");
