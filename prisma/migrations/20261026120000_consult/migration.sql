-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consultCheckRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Consult" (
    "id" TEXT NOT NULL,
    "emrKey" TEXT NOT NULL,
    "chartNo" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "sexAge" TEXT,
    "location" TEXT,
    "requestedAt" TEXT,
    "fromDept" TEXT,
    "fromDoctor" TEXT,
    "emergency" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT,
    "diagnosis" TEXT,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TEXT,
    "replyText" TEXT,
    "replyRequestedAt" TIMESTAMP(3),
    "replyStatus" TEXT,
    "replyMessage" TEXT,
    "replySavedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Consult_createdById_emrKey_key" ON "Consult"("createdById", "emrKey");

-- AddForeignKey
ALTER TABLE "Consult" ADD CONSTRAINT "Consult_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
