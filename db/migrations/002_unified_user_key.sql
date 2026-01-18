-- Migration: Unified user_key system for stats and ratings
-- This migration creates unified tables that work for both guests and accounts
-- using user_key format: "g:<guestId>" for guests, "a:<userUuid>" for accounts

-- Create unified ratings table with user_key
CREATE TABLE IF NOT EXISTS unified_ratings (
    user_key TEXT NOT NULL,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    rating INTEGER NOT NULL DEFAULT 1500,
    games_played INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_key, board_size)
);

-- Create unified player_stats table with user_key
CREATE TABLE IF NOT EXISTS unified_player_stats (
    user_key TEXT NOT NULL,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0.00,
    highest_rating INTEGER DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_key, board_size)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_ratings_user_key ON unified_ratings(user_key, board_size);
CREATE INDEX IF NOT EXISTS idx_unified_ratings_rating ON unified_ratings(board_size, rating DESC);
CREATE INDEX IF NOT EXISTS idx_unified_player_stats_user_key ON unified_player_stats(user_key, board_size);

-- Migrate existing guest_progress data to unified_player_stats
-- Convert guest_id to user_key format: "g:<guestId>"
INSERT INTO unified_player_stats (user_key, board_size, games_played, wins, losses, draws, win_rate, highest_rating, updated_at)
SELECT 
    'g:' || guest_id as user_key,
    board_size,
    games_played,
    wins,
    losses,
    draws,
    win_rate,
    highest_rating,
    updated_at
FROM guest_progress
ON CONFLICT (user_key, board_size) DO NOTHING;

-- Migrate existing guest_progress ratings to unified_ratings
INSERT INTO unified_ratings (user_key, board_size, rating, games_played, updated_at)
SELECT 
    'g:' || guest_id as user_key,
    board_size,
    rating,
    games_played,
    updated_at
FROM guest_progress
ON CONFLICT (user_key, board_size) DO NOTHING;

-- Migrate existing account ratings to unified_ratings
-- Convert user_id (UUID) to user_key format: "a:<userUuid>"
INSERT INTO unified_ratings (user_key, board_size, rating, games_played, updated_at)
SELECT 
    'a:' || user_id::text as user_key,
    board_size,
    rating,
    games_played,
    updated_at
FROM ratings
ON CONFLICT (user_key, board_size) DO NOTHING;

-- Migrate existing account player_stats to unified_player_stats
INSERT INTO unified_player_stats (user_key, board_size, games_played, wins, losses, draws, win_rate, highest_rating, updated_at)
SELECT 
    'a:' || user_id::text as user_key,
    board_size,
    games_played,
    wins,
    losses,
    draws,
    win_rate,
    COALESCE(highest_rating, 1500) as highest_rating,
    updated_at
FROM player_stats
ON CONFLICT (user_key, board_size) DO NOTHING;

-- Note: Old tables (ratings, player_stats, guest_progress) are kept for backward compatibility
-- but new code should use unified_ratings and unified_player_stats
