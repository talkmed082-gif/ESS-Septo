-- CreateTable
CREATE TABLE "DutyRoster" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "empNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "time" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyRoster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DutyRoster_createdById_date_idx" ON "DutyRoster"("createdById", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DutyRoster_createdById_date_empNo_kind_key" ON "DutyRoster"("createdById", "date", "empNo", "kind");

-- AddForeignKey
ALTER TABLE "DutyRoster" ADD CONSTRAINT "DutyRoster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
