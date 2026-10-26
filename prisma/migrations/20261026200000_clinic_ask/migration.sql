-- CreateTable
CREATE TABLE "ClinicAsk" (
    "id" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "chartNo" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "answer" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ClinicAsk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicAsk_createdById_status_idx" ON "ClinicAsk"("createdById", "status");

-- AddForeignKey
ALTER TABLE "ClinicAsk" ADD CONSTRAINT "ClinicAsk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
