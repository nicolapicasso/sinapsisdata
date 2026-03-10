-- CreateEnum (only if not exists)
DO $$ BEGIN
    CREATE TYPE "OptimizationActionType" AS ENUM ('NEGATIVE_KEYWORD', 'EXCLUDE_PLACEMENT', 'PAUSE_KEYWORD', 'ENABLE_KEYWORD', 'UPDATE_KEYWORD_BID', 'UPDATE_CAMPAIGN_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OptimizationActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DataSourceStatus" AS ENUM ('CONNECTED', 'ERROR', 'EXPIRED', 'PENDING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new values to DataSourceType enum if they don't exist
DO $$ BEGIN
    ALTER TYPE "DataSourceType" ADD VALUE IF NOT EXISTS 'GOOGLE_ADS';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "DataSourceType" ADD VALUE IF NOT EXISTS 'GOOGLE_ANALYTICS';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add ALL columns to data_sources if they don't exist
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "tokenExpiry" TIMESTAMP(3);
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "accountName" TEXT;
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "mccId" TEXT;
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "status" "DataSourceStatus" DEFAULT 'PENDING';
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "data_sources" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

-- Set default values for required columns that might be null
UPDATE "data_sources" SET "accessToken" = '' WHERE "accessToken" IS NULL;
UPDATE "data_sources" SET "refreshToken" = '' WHERE "refreshToken" IS NULL;
UPDATE "data_sources" SET "accountId" = '' WHERE "accountId" IS NULL;
UPDATE "data_sources" SET "accountName" = 'Unknown' WHERE "accountName" IS NULL;

-- Make required columns NOT NULL after setting defaults
ALTER TABLE "data_sources" ALTER COLUMN "accessToken" SET NOT NULL;
ALTER TABLE "data_sources" ALTER COLUMN "refreshToken" SET NOT NULL;
ALTER TABLE "data_sources" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "data_sources" ALTER COLUMN "accountName" SET NOT NULL;

-- CreateTable optimization_actions (only if not exists)
CREATE TABLE IF NOT EXISTS "optimization_actions" (
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

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    ALTER TABLE "optimization_actions" ADD CONSTRAINT "optimization_actions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "optimization_actions" ADD CONSTRAINT "optimization_actions_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "optimization_actions" ADD CONSTRAINT "optimization_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
