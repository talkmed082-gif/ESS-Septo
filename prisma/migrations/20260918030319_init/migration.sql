-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SurgeryType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chartNo" TEXT,
    "name" TEXT NOT NULL,
    "sex" TEXT,
    "birthDate" DATETIME,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Patient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "surgeryTypeId" TEXT NOT NULL,
    "plannedDate" DATETIME,
    "side" TEXT,
    "diagnosis" TEXT,
    "planNote" TEXT,
    "planData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpPlan_surgeryTypeId_fkey" FOREIGN KEY ("surgeryTypeId") REFERENCES "SurgeryType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OpPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opPlanId" TEXT NOT NULL,
    "operationDate" DATETIME NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpRecord_opPlanId_fkey" FOREIGN KEY ("opPlanId") REFERENCES "OpPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SurgeryType_code_key" ON "SurgeryType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OpRecord_opPlanId_key" ON "OpRecord"("opPlanId");
