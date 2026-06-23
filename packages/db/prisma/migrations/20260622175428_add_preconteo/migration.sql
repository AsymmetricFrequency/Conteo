-- CreateTable
CREATE TABLE "PreconteoMunicipio" (
    "id" TEXT NOT NULL,
    "eleccion" TEXT NOT NULL,
    "munCodigo" TEXT NOT NULL,
    "munNombre" TEXT NOT NULL,
    "deptCodigo" TEXT NOT NULL,
    "deptNombre" TEXT NOT NULL,
    "mesasTotal" INTEGER NOT NULL,
    "mesasEsc" INTEGER NOT NULL,
    "sufragantes" INTEGER NOT NULL,
    "votnul" INTEGER NOT NULL,
    "votblan" INTEGER NOT NULL,
    "numact" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreconteoMunicipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreconteoVoto" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "codcan" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "vot" INTEGER NOT NULL,
    "pvot" TEXT NOT NULL,

    CONSTRAINT "PreconteoVoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreconteoMunicipio_munCodigo_idx" ON "PreconteoMunicipio"("munCodigo");

-- CreateIndex
CREATE INDEX "PreconteoMunicipio_deptCodigo_idx" ON "PreconteoMunicipio"("deptCodigo");

-- CreateIndex
CREATE INDEX "PreconteoMunicipio_eleccion_idx" ON "PreconteoMunicipio"("eleccion");

-- CreateIndex
CREATE UNIQUE INDEX "PreconteoMunicipio_eleccion_munCodigo_numact_key" ON "PreconteoMunicipio"("eleccion", "munCodigo", "numact");

-- CreateIndex
CREATE INDEX "PreconteoVoto_snapshotId_idx" ON "PreconteoVoto"("snapshotId");

-- CreateIndex
CREATE INDEX "PreconteoVoto_cedula_idx" ON "PreconteoVoto"("cedula");

-- AddForeignKey
ALTER TABLE "PreconteoVoto" ADD CONSTRAINT "PreconteoVoto_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PreconteoMunicipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
