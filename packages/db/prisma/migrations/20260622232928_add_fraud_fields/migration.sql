-- AlterTable
ALTER TABLE "E14ActaIndex" ADD COLUMN     "fraudFlags" JSONB,
ADD COLUMN     "fraudSeverity" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- CreateIndex
CREATE INDEX "E14ActaIndex_fraudSeverity_idx" ON "E14ActaIndex"("fraudSeverity");
