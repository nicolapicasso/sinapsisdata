-- Fix missing columns in data_sources table
-- This migration adds columns that were missing from the previous migration

-- Create DataSourceStatus enum if not exists
DO $$ BEGIN
    CREATE TYPE "DataSourceStatus" AS ENUM ('CONNECTED', 'ERROR', 'EXPIRED', 'PENDING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add all required columns to data_sources if they don't exist
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
DO $$ BEGIN
    ALTER TABLE "data_sources" ALTER COLUMN "accessToken" SET NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "data_sources" ALTER COLUMN "refreshToken" SET NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "data_sources" ALTER COLUMN "accountId" SET NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "data_sources" ALTER COLUMN "accountName" SET NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;
