-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('REGISTRADURIA_OFICIAL', 'PRECONTEO', 'TESTIGO_FOTO', 'DATOS_ABIERTOS', 'CARGA_MANUAL');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "EstadoHallazgo" AS ENUM ('PENDIENTE', 'EN_REVISION', 'DESCARTADO', 'CONFIRMADO', 'RECLAMADO');

-- CreateTable
CREATE TABLE "Eleccion" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "vuelta" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,

    CONSTRAINT "Eleccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL,
    "departamentoCodigo" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "municipioCodigo" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "zonaCodigo" TEXT NOT NULL,
    "puestoCodigo" TEXT NOT NULL,
    "puesto" TEXT,
    "mesa" TEXT NOT NULL,
    "ubicacionKey" TEXT NOT NULL,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidato" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "partido" TEXT,

    CONSTRAINT "Candidato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormE14" (
    "id" TEXT NOT NULL,
    "formType" TEXT NOT NULL DEFAULT 'E14_PRESIDENCIA',
    "source" "SourceType" NOT NULL,
    "eleccionId" TEXT NOT NULL,
    "mesaId" TEXT NOT NULL,
    "totalSufragantesE11" JSONB NOT NULL,
    "votosEnBlanco" JSONB NOT NULL,
    "votosNulos" JSONB NOT NULL,
    "votosNoMarcados" JSONB NOT NULL,
    "totalVotosUrna" JSONB NOT NULL,
    "juradosEsperados" INTEGER,
    "juradosFirmasPresentes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormE14_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatoVoto" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "candidatoId" TEXT NOT NULL,
    "value" INTEGER,
    "confidence" DOUBLE PRECISION,
    "hasAmendment" BOOLEAN NOT NULL DEFAULT false,
    "illegible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CandidatoVoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidencia" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceUrl" TEXT,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "fileName" TEXT,
    "byteSize" INTEGER,

    CONSTRAINT "Evidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extraccion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "ocrProvider" TEXT NOT NULL,
    "ocrVersion" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL,
    "overallConfidence" DOUBLE PRECISION,

    CONSTRAINT "Extraccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationReport" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "maxSeverity" "Severity",
    "resumen" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "message" TEXT NOT NULL,
    "fields" TEXT[],
    "details" JSONB,
    "estado" "EstadoHallazgo" NOT NULL DEFAULT 'PENDIENTE',
    "revisadoPor" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Eleccion_tipo_vuelta_fecha_key" ON "Eleccion"("tipo", "vuelta", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_ubicacionKey_key" ON "Mesa"("ubicacionKey");

-- CreateIndex
CREATE INDEX "Mesa_municipioCodigo_idx" ON "Mesa"("municipioCodigo");

-- CreateIndex
CREATE INDEX "Mesa_departamentoCodigo_idx" ON "Mesa"("departamentoCodigo");

-- CreateIndex
CREATE UNIQUE INDEX "Candidato_externalId_key" ON "Candidato"("externalId");

-- CreateIndex
CREATE INDEX "FormE14_mesaId_idx" ON "FormE14"("mesaId");

-- CreateIndex
CREATE INDEX "FormE14_source_idx" ON "FormE14"("source");

-- CreateIndex
CREATE INDEX "CandidatoVoto_candidatoId_idx" ON "CandidatoVoto"("candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatoVoto_formId_candidatoId_key" ON "CandidatoVoto"("formId", "candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidencia_formId_key" ON "Evidencia"("formId");

-- CreateIndex
CREATE INDEX "Evidencia_sha256_idx" ON "Evidencia"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "Extraccion_formId_key" ON "Extraccion"("formId");

-- CreateIndex
CREATE INDEX "ValidationReport_formId_idx" ON "ValidationReport"("formId");

-- CreateIndex
CREATE INDEX "ValidationReport_maxSeverity_idx" ON "ValidationReport"("maxSeverity");

-- CreateIndex
CREATE INDEX "Finding_reportId_idx" ON "Finding"("reportId");

-- CreateIndex
CREATE INDEX "Finding_severity_idx" ON "Finding"("severity");

-- CreateIndex
CREATE INDEX "Finding_category_idx" ON "Finding"("category");

-- CreateIndex
CREATE INDEX "Finding_estado_idx" ON "Finding"("estado");

-- CreateIndex
CREATE INDEX "JobLog_queue_status_idx" ON "JobLog"("queue", "status");

-- CreateIndex
CREATE INDEX "JobLog_jobId_idx" ON "JobLog"("jobId");

-- AddForeignKey
ALTER TABLE "FormE14" ADD CONSTRAINT "FormE14_eleccionId_fkey" FOREIGN KEY ("eleccionId") REFERENCES "Eleccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormE14" ADD CONSTRAINT "FormE14_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatoVoto" ADD CONSTRAINT "CandidatoVoto_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormE14"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatoVoto" ADD CONSTRAINT "CandidatoVoto_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "Candidato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormE14"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extraccion" ADD CONSTRAINT "Extraccion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormE14"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationReport" ADD CONSTRAINT "ValidationReport_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormE14"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ValidationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
