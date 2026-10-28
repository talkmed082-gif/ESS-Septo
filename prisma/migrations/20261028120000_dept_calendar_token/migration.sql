-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deptCalendarToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_deptCalendarToken_key" ON "User"("deptCalendarToken");
