-- AlterTable
ALTER TABLE "E14ActaIndex" ADD COLUMN     "auditedAt" TIMESTAMP(3),
ADD COLUMN     "auditedByEmail" TEXT,
ADD COLUMN     "auditedByName" TEXT,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedBy" TEXT;

-- CreateTable
CREATE TABLE "ConteoUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'AUDITOR',
    "actasAuditadas" INTEGER NOT NULL DEFAULT 0,
    "geminiKeyEncrypted" TEXT,
    "geminiKeyIv" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConteoUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConteoUser_email_key" ON "ConteoUser"("email");

-- CreateIndex
CREATE INDEX "ConteoUser_email_idx" ON "ConteoUser"("email");
