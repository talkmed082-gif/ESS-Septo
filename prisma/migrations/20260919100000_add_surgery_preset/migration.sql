-- CreateTable
CREATE TABLE "SurgeryPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surgeryTypeId" TEXT NOT NULL,
    "fieldValues" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurgeryPreset_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SurgeryPreset" ADD CONSTRAINT "SurgeryPreset_surgeryTypeId_fkey" FOREIGN KEY ("surgeryTypeId") REFERENCES "SurgeryType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryPreset" ADD CONSTRAINT "SurgeryPreset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
