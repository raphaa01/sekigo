-- Go Platform Database Schema
-- PostgreSQL database schema for the online Go platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    black_player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    white_player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    board_size INTEGER NOT NULL CHECK (board_size IN (9, 13, 19)),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'abandoned')),
    winner VARCHAR(10) CHECK (winner IN ('black', 'white')),
    end_reason VARCHAR(20) CHECK (end_reason IN ('resignation', 'score', 'time_out', 'abandonment')),
    final_score_black DECIMAL(5, 1),
    final_score_white DECIMAL(5, 1),
    time_control JSONB, -- Store time control settings as JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    last_move_at TIMESTAMP
);

-- Moves table
CREATE TABLE IF NOT EXISTS moves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    move_number INTEGER NOT NULL,
    color VARCHAR(10) NOT NULL CHECK (color IN ('black', 'white')),
    x INTEGER CHECK (x IS NULL OR (x >= 0 AND x < 19)), -- NULL for pass moves
    y INTEGER CHECK (y IS NULL OR (y >= 0 AND y < 19)), -- NULL for pass moves
    is_pass BOOLEAN NOT NULL DEFAULT FALSE,
    captured_stones INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, move_number)
);

-- Ratings table (stores current rating for each user)
CREATE TABLE IF NOT EXISTS ratings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL DEFAULT 1500, -- Elo rating
    rank_display VARCHAR(10), -- Cached rank display (e.g., "5k", "1d")
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rating history table (for tracking rating changes over time)
CREATE TABLE IF NOT EXISTS rating_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID REFERENCES games(id) ON DELETE SET NULL,
    rating_before INTEGER NOT NULL,
    rating_after INTEGER NOT NULL,
    rating_change INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player statistics table
CREATE TABLE IF NOT EXISTS player_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0, -- For future support
    win_rate DECIMAL(5, 2) DEFAULT 0.00, -- Percentage
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_moves_game_id ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_moves_game_move_number ON moves(game_id, move_number);
CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history(user_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_game ON rating_history(game_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON ratings(rating DESC); -- For leaderboard queries

-- Function to update player stats automatically
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stats when a game ends
    IF NEW.status = 'finished' AND OLD.status = 'active' THEN
        -- Update black player stats
        INSERT INTO player_stats (user_id, games_played, wins, losses, win_rate)
        VALUES (
            NEW.black_player_id,
            1,
            CASE WHEN NEW.winner = 'black' THEN 1 ELSE 0 END,
            CASE WHEN NEW.winner = 'white' THEN 1 ELSE 0 END,
            0
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
            games_played = player_stats.games_played + 1,
            wins = player_stats.wins + CASE WHEN NEW.winner = 'black' THEN 1 ELSE 0 END,
            losses = player_stats.losses + CASE WHEN NEW.winner = 'white' THEN 1 ELSE 0 END,
            win_rate = CASE 
                WHEN (player_stats.games_played + 1) > 0 
                THEN (player_stats.wins + CASE WHEN NEW.winner = 'black' THEN 1 ELSE 0 END)::DECIMAL / (player_stats.games_played + 1) * 100
                ELSE 0
            END,
            updated_at = CURRENT_TIMESTAMP;

        -- Update white player stats
        INSERT INTO player_stats (user_id, games_played, wins, losses, win_rate)
        VALUES (
            NEW.white_player_id,
            1,
            CASE WHEN NEW.winner = 'white' THEN 1 ELSE 0 END,
            CASE WHEN NEW.winner = 'black' THEN 1 ELSE 0 END,
            0
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
            games_played = player_stats.games_played + 1,
            wins = player_stats.wins + CASE WHEN NEW.winner = 'white' THEN 1 ELSE 0 END,
            losses = player_stats.losses + CASE WHEN NEW.winner = 'black' THEN 1 ELSE 0 END,
            win_rate = CASE 
                WHEN (player_stats.games_played + 1) > 0 
                THEN (player_stats.wins + CASE WHEN NEW.winner = 'white' THEN 1 ELSE 0 END)::DECIMAL / (player_stats.games_played + 1) * 100
                ELSE 0
            END,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update stats when game ends
CREATE TRIGGER trigger_update_player_stats
    AFTER UPDATE ON games
    FOR EACH ROW
    WHEN (NEW.status = 'finished' AND OLD.status = 'active')
    EXECUTE FUNCTION update_player_stats();
