-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "content" TEXT,
    "authorName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ESS',
    "emrRegDate" TEXT,
    "emrRegSeq" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_patientId_emrRegDate_emrRegSeq_key" ON "Reminder"("patientId", "emrRegDate", "emrRegSeq");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
