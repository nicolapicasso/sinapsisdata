-- AlterTable
ALTER TABLE "reports" ADD COLUMN "slug" TEXT;
ALTER TABLE "reports" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "reports_projectId_slug_key" ON "reports"("projectId", "slug");
