-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgeryType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurgeryType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "chartNo" TEXT,
    "name" TEXT NOT NULL,
    "sex" TEXT,
    "birthDate" TIMESTAMP(3),
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "surgeryTypeId" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3),
    "side" TEXT,
    "diagnosis" TEXT,
    "planNote" TEXT,
    "planData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpRecord" (
    "id" TEXT NOT NULL,
    "opPlanId" TEXT NOT NULL,
    "operationDate" TIMESTAMP(3) NOT NULL,
    "surgeonName" TEXT NOT NULL,
    "assistantName" TEXT,
    "anesthesiaType" TEXT,
    "preOpDiagnosis" TEXT,
    "postOpDiagnosis" TEXT,
    "procedureName" TEXT,
    "findings" TEXT,
    "procedureDetail" TEXT,
    "recordData" JSONB,
    "complication" TEXT,
    "estimatedBloodLoss" TEXT,
    "specimen" TEXT,
    "postOpPlan" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SurgeryType_code_key" ON "SurgeryType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OpRecord_opPlanId_key" ON "OpRecord"("opPlanId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpPlan" ADD CONSTRAINT "OpPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpPlan" ADD CONSTRAINT "OpPlan_surgeryTypeId_fkey" FOREIGN KEY ("surgeryTypeId") REFERENCES "SurgeryType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpPlan" ADD CONSTRAINT "OpPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpRecord" ADD CONSTRAINT "OpRecord_opPlanId_fkey" FOREIGN KEY ("opPlanId") REFERENCES "OpPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpRecord" ADD CONSTRAINT "OpRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
