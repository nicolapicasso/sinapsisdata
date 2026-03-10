-- CreateEnum
CREATE TYPE "OptimizationActionType" AS ENUM ('NEGATIVE_KEYWORD', 'EXCLUDE_PLACEMENT', 'PAUSE_KEYWORD', 'ENABLE_KEYWORD', 'UPDATE_KEYWORD_BID', 'UPDATE_CAMPAIGN_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN');

-- CreateEnum
CREATE TYPE "OptimizationActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED');

-- DropEnum (unused types from previous schema)
DROP TYPE IF EXISTS "DataSourceType";
DROP TYPE IF EXISTS "DataSourceStatus";

-- CreateEnum (recreate with correct values)
CREATE TYPE "DataSourceType" AS ENUM ('GOOGLE_ADS', 'GOOGLE_ANALYTICS');
CREATE TYPE "DataSourceStatus" AS ENUM ('CONNECTED', 'ERROR', 'EXPIRED', 'PENDING');

-- AlterTable: Update data_sources structure
-- First, drop the old table if it exists and has no data
-- If data exists, you'll need a more careful migration

-- Drop existing data_sources table (safe for new deployments)
DROP TABLE IF EXISTS "data_sources";

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "DataSourceType" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "mccId" TEXT,
    "metadata" JSONB,
    "status" "DataSourceStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optimization_actions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "OptimizationActionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "targetEntity" JSONB NOT NULL,
    "claudeReason" TEXT NOT NULL,
    "metrics" JSONB,
    "status" "OptimizationActionStatus" NOT NULL DEFAULT 'PENDING',
    "userComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "optimization_actions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_actions" ADD CONSTRAINT "optimization_actions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_actions" ADD CONSTRAINT "optimization_actions_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_actions" ADD CONSTRAINT "optimization_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
