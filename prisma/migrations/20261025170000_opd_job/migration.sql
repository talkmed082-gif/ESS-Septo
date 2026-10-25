-- CreateTable
CREATE TABLE "OpdJob" (
    "id" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "chartNo" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "visit" TEXT NOT NULL DEFAULT '',
    "templateId" TEXT,
    "tasks" JSONB NOT NULL DEFAULT '{}',
    "practice" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "tries" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpdJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpdJob_createdById_visitDate_chartNo_key" ON "OpdJob"("createdById", "visitDate", "chartNo");

-- AddForeignKey
ALTER TABLE "OpdJob" ADD CONSTRAINT "OpdJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;