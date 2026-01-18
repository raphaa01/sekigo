-- Migration: Add is_guest column to users table if it doesn't exist
-- This fixes the error: column "is_guest" of relation "users" does not exist

-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'is_guest'
    ) THEN
        ALTER TABLE users ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT FALSE;
        RAISE NOTICE 'Added is_guest column to users table';
    ELSE
        RAISE NOTICE 'Column is_guest already exists in users table';
    END IF;
END $$;
