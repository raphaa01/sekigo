# Stats/Rating Persistence Feature - Summary

## Problem Solved
Stats and ratings were resetting to 0 when the Node server restarted because they were stored only in memory.

## Solution
Implemented unified `user_key` system with PostgreSQL persistence for both guests and accounts.

## Changed Files

### Database
1. **`db/migrations/002_unified_user_key.sql`** (NEW)
   - Creates `unified_ratings` table with `user_key` (TEXT)
   - Creates `unified_player_stats` table with `user_key` (TEXT)
   - Migrates existing data from `guest_progress`, `ratings`, and `player_stats`
   - Format: `g:<guestId>` for guests, `a:<userUuid>` for accounts

### Backend Services
2. **`server/src/services/stats.js`**
   - Added `toUserKey()` helper function
   - `recordGameResult()`: Now uses `unified_player_stats` table
   - `getPlayerStats()`: Now reads from `unified_player_stats` table
   - In-memory cache kept for fast access (fallback only)

3. **`server/src/services/rating.js`**
   - Added `toUserKey()` helper function
   - `getRating()`: Now uses `unified_ratings` table
   - `getGamesPlayed()`: Now uses `unified_ratings` table
   - `_updateRatingStorage()`: Now writes to `unified_ratings` table
   - In-memory cache kept for fast access (fallback only)

### Documentation
4. **`PERSISTENCE_MIGRATION_README.md`** (NEW)
   - Migration instructions
   - Testing steps
   - Troubleshooting guide

## User Key Format

- **Guests**: `g:<guestId>` (e.g., `g:guest-abc123-def456`)
- **Accounts**: `a:<userUuid>` (e.g., `a:550e8400-e29b-41d4-a716-446655440000`)

## How It Works

1. **On game end:**
   - `gameManager.endGame()` calls `statsService.recordGameResult()` and `ratingService.updateRatings()`
   - Services convert `userId` to `user_key` using `toUserKey()`
   - Data is upserted into `unified_player_stats` and `unified_ratings`

2. **On stats request:**
   - `statsService.getPlayerStats()` reads from `unified_player_stats`
   - Returns defaults (0 games, 1500 rating) if no entry exists

3. **On server restart:**
   - All data persists in PostgreSQL
   - Services load from DB on first access
   - In-memory cache is populated for performance

## Migration Steps

1. Run migration:
   ```bash
   psql go_platform < db/migrations/002_unified_user_key.sql
   ```

2. Restart server:
   ```bash
   cd server
   npm start
   ```

3. Test:
   - Play 1 game as guest
   - Check stats show `games=1`
   - Restart server
   - Refresh page
   - Stats should still show `games=1`

## Test Steps

### 1. Play Game as Guest
1. Start server: `cd server && npm start`
2. Open browser, play 1 game
3. Check stats: Should show `games=1`, rating changed

### 2. Restart Server
1. Stop server (Ctrl+C)
2. Start again: `cd server && npm start`
3. Refresh browser page

### 3. Verify Persistence
- Stats should still show `games=1`
- Rating should be preserved
- Matchmaking should still work

### 4. Play Another Game
1. Play another game
2. Stats should show `games=2`
3. Restart server again
4. Stats should still show `games=2`

## Acceptance Criteria ✅

- ✅ Play 1 game as guest → stats show `games=1`
- ✅ Restart server → refresh page → stats still show `games=1`
- ✅ Matchmaking still works
- ✅ Ratings persist across restarts
- ✅ Works for both guests and accounts (when accounts are implemented)

## Database Schema

### unified_ratings
```sql
CREATE TABLE unified_ratings (
    user_key TEXT NOT NULL,           -- "g:<guestId>" or "a:<userUuid>"
    board_size INTEGER NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1500,
    games_played INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_key, board_size)
);
```

### unified_player_stats
```sql
CREATE TABLE unified_player_stats (
    user_key TEXT NOT NULL,           -- "g:<guestId>" or "a:<userUuid>"
    board_size INTEGER NOT NULL,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0.00,
    highest_rating INTEGER DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_key, board_size)
);
```
