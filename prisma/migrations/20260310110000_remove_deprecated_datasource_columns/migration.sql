-- Remove deprecated columns from data_sources table
-- The 'name' and 'credentials' columns are from the initial schema
-- They've been replaced by accountName/accountId and accessToken/refreshToken

-- First drop the constraints if they exist
DO $$ BEGIN
    ALTER TABLE "data_sources" ALTER COLUMN "name" DROP NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "data_sources" ALTER COLUMN "credentials" DROP NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

-- Then drop the columns
ALTER TABLE "data_sources" DROP COLUMN IF EXISTS "name";
ALTER TABLE "data_sources" DROP COLUMN IF EXISTS "credentials";
ALTER TABLE "data_sources" DROP COLUMN IF EXISTS "config";
