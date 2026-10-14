-- CreateTable
CREATE TABLE "PcJobStatus" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "lastOk" BOOLEAN NOT NULL,
    "lastMessage" TEXT,
    "lastFailureAt" TIMESTAMP(3),
    "lastFailure" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PcJobStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PcJobStatus_createdById_job_key" ON "PcJobStatus"("createdById", "job");

-- AddForeignKey
ALTER TABLE "PcJobStatus" ADD CONSTRAINT "PcJobStatus_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

