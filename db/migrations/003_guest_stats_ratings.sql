-- Migration: Guest stats and ratings persistence
-- Creates dedicated tables for guest stats and ratings using guest_key format

-- Guest ratings table
CREATE TABLE IF NOT EXISTS guest_ratings (
    guest_key TEXT NOT NULL,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    rating INTEGER NOT NULL DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guest_key, board_size)
);

-- Guest stats table
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_ratings_key ON guest_ratings(guest_key, board_size);
CREATE INDEX IF NOT EXISTS idx_guest_stats_key ON guest_stats(guest_key, board_size);

-- Migrate existing guest_progress data to new tables
-- Convert guest_id to guest_key format: "g:<guestId>"
INSERT INTO guest_ratings (guest_key, board_size, rating, updated_at)
SELECT 
    'g:' || guest_id as guest_key,
    board_size,
    rating,
    updated_at
FROM guest_progress
ON CONFLICT (guest_key, board_size) DO NOTHING;

INSERT INTO guest_stats (guest_key, board_size, games, wins, losses, draws, highest_rating, updated_at)
SELECT 
    'g:' || guest_id as guest_key,
    board_size,
    games_played as games,
    wins,
    losses,
    draws,
    highest_rating,
    updated_at
FROM guest_progress
ON CONFLICT (guest_key, board_size) DO NOTHING;

-- Migrate from unified tables if they exist
INSERT INTO guest_ratings (guest_key, board_size, rating, updated_at)
SELECT 
    user_key as guest_key,
    board_size,
    rating,
    updated_at
FROM unified_ratings
WHERE user_key LIKE 'g:%'
ON CONFLICT (guest_key, board_size) DO NOTHING;

INSERT INTO guest_stats (guest_key, board_size, games, wins, losses, draws, highest_rating, updated_at)
SELECT 
    user_key as guest_key,
    board_size,
    games_played as games,
    wins,
    losses,
    draws,
    highest_rating,
    updated_at
FROM unified_player_stats
WHERE user_key LIKE 'g:%'
ON CONFLICT (guest_key, board_size) DO NOTHING;
