-- Migration: Make email column optional (allow NULL) if it exists
-- This fixes the error: null value in column "email" of relation "users" violates not-null constraint

DO $$
BEGIN
    -- Check if email column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'email'
    ) THEN
        -- Make email column nullable if it's not already
        ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
        RAISE NOTICE 'Made email column nullable in users table';
    ELSE
        RAISE NOTICE 'Column email does not exist in users table';
    END IF;
END $$;
