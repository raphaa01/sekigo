-- Migration: Add board_size to ratings and player_stats
-- Also add guest_progress table for guest stats migration

-- Drop old tables if they exist (for clean migration)
DROP TABLE IF EXISTS rating_history CASCADE;
DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;

-- Ratings table (per user per board size)
CREATE TABLE IF NOT EXISTS ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    rating INTEGER NOT NULL DEFAULT 1500,
    games_played INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, board_size)
);

-- Player statistics table (per user per board size)
CREATE TABLE IF NOT EXISTS player_stats (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0.00,
    highest_rating INTEGER DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, board_size)
);

-- Rating history table (for tracking rating changes over time)
CREATE TABLE IF NOT EXISTS rating_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    game_id UUID REFERENCES games(id) ON DELETE SET NULL,
    rating_before INTEGER NOT NULL,
    rating_after INTEGER NOT NULL,
    rating_change INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guest progress table (for migrating guest stats to accounts)
CREATE TABLE IF NOT EXISTS guest_progress (
    guest_id TEXT NOT NULL,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    rating INTEGER NOT NULL DEFAULT 1500,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0.00,
    highest_rating INTEGER DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guest_id, board_size)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ratings_user_board ON ratings(user_id, board_size);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON ratings(board_size, rating DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_user_board ON player_stats(user_id, board_size);
CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history(user_id, board_size);
CREATE INDEX IF NOT EXISTS idx_rating_history_game ON rating_history(game_id);
CREATE INDEX IF NOT EXISTS idx_guest_progress_guest ON guest_progress(guest_id);
