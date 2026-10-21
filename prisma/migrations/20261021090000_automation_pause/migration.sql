-- CreateTable
CREATE TABLE "AutomationPause" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationPause_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationPause_createdById_idx" ON "AutomationPause"("createdById");

-- AddForeignKey
ALTER TABLE "AutomationPause" ADD CONSTRAINT "AutomationPause_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
