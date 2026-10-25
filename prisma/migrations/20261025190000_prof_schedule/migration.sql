-- CreateTable
CREATE TABLE "ProfSchedule" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "doctor" TEXT NOT NULL,
    "outpatient" INTEGER NOT NULL DEFAULT 0,
    "surgeries" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfSchedule_createdById_date_doctor_key" ON "ProfSchedule"("createdById", "date", "doctor");

-- AddForeignKey
ALTER TABLE "ProfSchedule" ADD CONSTRAINT "ProfSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
