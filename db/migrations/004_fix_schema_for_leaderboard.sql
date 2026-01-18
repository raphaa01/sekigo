-- Migration: Fix schema for leaderboard support
-- This migration updates the database schema to support board_size in ratings
-- and creates guest_ratings/guest_stats tables if they don't exist

-- Step 1: Check if ratings table has board_size, if not, add it
DO $$
BEGIN
    -- Check if board_size column exists in ratings
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ratings' AND column_name = 'board_size'
    ) THEN
        -- First, drop the old primary key if it exists
        ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_pkey;
        
        -- Add board_size column to ratings (nullable first)
        ALTER TABLE ratings ADD COLUMN board_size INTEGER;
        
        -- Update existing rows to have board_size = 19 (default)
        UPDATE ratings SET board_size = 19 WHERE board_size IS NULL;
        
        -- Add check constraint
        ALTER TABLE ratings ADD CONSTRAINT ratings_board_size_check CHECK (board_size IN (9, 13, 19));
        
        -- Make board_size NOT NULL after setting defaults
        ALTER TABLE ratings ALTER COLUMN board_size SET NOT NULL;
        ALTER TABLE ratings ALTER COLUMN board_size SET DEFAULT 19;
        
        -- Change primary key to include board_size
        ALTER TABLE ratings ADD PRIMARY KEY (user_id, board_size);
        
        -- Add index for leaderboard queries
        CREATE INDEX IF NOT EXISTS idx_ratings_rating_board ON ratings(board_size, rating DESC);
    END IF;
    
    -- Add games_played column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ratings' AND column_name = 'games_played'
    ) THEN
        ALTER TABLE ratings ADD COLUMN games_played INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Step 2: Check if player_stats has board_size, if not, add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'player_stats' AND column_name = 'board_size'
    ) THEN
        -- Drop old primary key if it exists
        ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS player_stats_pkey;
        
        -- Add board_size column to player_stats (nullable first)
        ALTER TABLE player_stats ADD COLUMN board_size INTEGER;
        
        -- Update existing rows
        UPDATE player_stats SET board_size = 19 WHERE board_size IS NULL;
        
        -- Add check constraint
        ALTER TABLE player_stats ADD CONSTRAINT player_stats_board_size_check CHECK (board_size IN (9, 13, 19));
        
        -- Make board_size NOT NULL
        ALTER TABLE player_stats ALTER COLUMN board_size SET NOT NULL;
        ALTER TABLE player_stats ALTER COLUMN board_size SET DEFAULT 19;
        
        -- Change primary key to include board_size
        ALTER TABLE player_stats ADD PRIMARY KEY (user_id, board_size);
    END IF;
END $$;

-- Step 3: Add highest_rating to player_stats if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'player_stats' AND column_name = 'highest_rating'
    ) THEN
        ALTER TABLE player_stats ADD COLUMN highest_rating INTEGER DEFAULT 1500;
    END IF;
END $$;

-- Step 4: Create guest_ratings table if it doesn't exist
CREATE TABLE IF NOT EXISTS guest_ratings (
    guest_key TEXT NOT NULL,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    rating INTEGER NOT NULL DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guest_key, board_size)
);

-- Step 5: Create guest_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS guest_stats (
    guest_key TEXT NOT NULL,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    avg_moves FLOAT DEFAULT 0.0,
    highest_rating INTEGER DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guest_key, board_size)
);

-- Step 6: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_ratings_key ON guest_ratings(guest_key, board_size);
CREATE INDEX IF NOT EXISTS idx_guest_ratings_rating ON guest_ratings(board_size, rating DESC);
CREATE INDEX IF NOT EXISTS idx_guest_stats_key ON guest_stats(guest_key, board_size);

-- Step 7: Ensure users table has is_guest column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_guest'
    ) THEN
        ALTER TABLE users ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;
