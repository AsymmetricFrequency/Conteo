-- CreateTable
CREATE TABLE "E14ActaIndex" (
    "id" TEXT NOT NULL,
    "idTransmissionCode" TEXT NOT NULL,
    "idDepartmentCode" TEXT NOT NULL,
    "municipalityCode" TEXT NOT NULL,
    "idZoneCode" TEXT NOT NULL,
    "standCode" TEXT NOT NULL,
    "numberStand" TEXT NOT NULL,
    "expectedName" TEXT NOT NULL,
    "idCorporationCode" TEXT NOT NULL,
    "idStand" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pdfPath" TEXT,
    "ocrResult" JSONB,
    "ocrError" TEXT,
    "formId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "E14ActaIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "E14ActaIndex_idTransmissionCode_key" ON "E14ActaIndex"("idTransmissionCode");

-- CreateIndex
CREATE INDEX "E14ActaIndex_status_idx" ON "E14ActaIndex"("status");

-- CreateIndex
CREATE INDEX "E14ActaIndex_idDepartmentCode_idx" ON "E14ActaIndex"("idDepartmentCode");

-- CreateIndex
CREATE INDEX "E14ActaIndex_municipalityCode_idx" ON "E14ActaIndex"("municipalityCode");
