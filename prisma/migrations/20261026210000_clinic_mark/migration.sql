-- CreateTable
CREATE TABLE "ClinicMark" (
    "id" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "chartNo" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3),
    "done" BOOLEAN,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicMark_createdById_visitDate_chartNo_key" ON "ClinicMark"("createdById", "visitDate", "chartNo");

-- AddForeignKey
ALTER TABLE "ClinicMark" ADD CONSTRAINT "ClinicMark_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
