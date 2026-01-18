# Guest Stats/Rating Persistence Fix

## Problem
Stats and ratings were resetting to 0 when the Node server restarted because they were stored only in memory.

## Solution
Implemented PostgreSQL persistence for guest stats and ratings using dedicated `guest_stats` and `guest_ratings` tables with `guest_key` format (`g:<guestId>`).

## Changed Files

### Database
1. **`db/migrations/003_guest_stats_ratings.sql`** (NEW)
   - Creates `guest_ratings` table: `guest_key TEXT, board_size INT, rating INT, updated_at TIMESTAMP`
   - Creates `guest_stats` table: `guest_key TEXT, board_size INT, games INT, wins INT, losses INT, draws INT, avg_moves FLOAT, highest_rating INT, updated_at TIMESTAMP`
   - Migrates existing data from `guest_progress` and `unified_*` tables
   - Format: `guest_key = "g:<guestId>"` (e.g., `g:guest-abc123-def456`)

### Backend Services
2. **`server/src/services/stats.js`**
   - Added `toGuestKey()` helper: converts `userId` to `g:<guestId>` format
   - Added `getGuestStats(guestKey, boardSize)`: reads from `guest_stats` table, returns defaults if missing
   - Added `upsertGuestStats(guestKey, boardSize, newStats)`: upserts to `guest_stats` table
   - `recordGameResult()`: For guests, uses `guest_stats` table instead of unified table
   - `getPlayerStats()`: For guests, reads from `guest_stats` table
   - In-memory `guestStats` Map kept only as cache (not primary storage)
   - Added logging: `guestKey`, `boardSize`, `games`, `wins`, `losses`, `rating`, `ratingChange`

3. **`server/src/services/rating.js`**
   - Added `toGuestKey()` helper: converts `userId` to `g:<guestId>` format
   - Added `getGuestRating(guestKey, boardSize)`: reads from `guest_ratings` table, returns 1500 if missing
   - Added `upsertGuestRating(guestKey, boardSize, newRating)`: upserts to `guest_ratings` table
   - `getRating()`: For guests, uses `guest_ratings` table
   - `getGamesPlayed()`: For guests, reads from `guest_stats.games` column
   - `_updateRatingStorage()`: For guests, writes to `guest_ratings` table
   - In-memory `guestRatings` and `guestGamesPlayed` Maps kept only as cache
   - Added logging: `guestKey`, `boardSize`, `rating`, `gamesPlayed`

4. **`server/src/services/gameManager.js`**
   - Added logging in `endGame()`: logs `guestKey`, `boardSize`, `won`, `ratingChange` for both players

5. **`server/src/index.js`**
   - Added logging in `handleGetStats()`: logs `guestKey` for guest requests

### Frontend
6. **`web_client/src/utils/guestId.js`** (Already correct)
   - `getGuestUserId()`: Uses `localStorage` for `deviceId` (persists across reloads)
   - Uses `sessionStorage` for `tabId` (unique per tab)
   - Format: `guest-{deviceId}-{tabId}` (stable across page refreshes)

7. **`web_client/src/components/MatchmakingView.jsx`** (Already correct)
   - `fetchStats()`: Always sends `X-Guest-Id` header with `getGuestUserId()`
   - Fetches stats on page load via `useEffect`

## Database Schema

### guest_ratings
```sql
CREATE TABLE guest_ratings (
    guest_key TEXT NOT NULL,           -- "g:<guestId>"
    board_size INTEGER NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guest_key, board_size)
);
```

### guest_stats
```sql
CREATE TABLE guest_stats (
    guest_key TEXT NOT NULL,           -- "g:<guestId>"
    board_size INTEGER NOT NULL,
    games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    avg_moves FLOAT DEFAULT 0.0,
    highest_rating INTEGER DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guest_key, board_size)
);
```

## Migration Steps

1. **Run migration:**
   ```bash
   psql go_platform < db/migrations/003_guest_stats_ratings.sql
   ```

2. **Verify tables exist:**
   ```sql
   SELECT COUNT(*) FROM guest_ratings;
   SELECT COUNT(*) FROM guest_stats;
   ```

3. **Restart server:**
   ```bash
   cd server
   npm start
   ```

## How It Works

1. **Guest ID Generation (Frontend):**
   - `deviceId`: Stored in `localStorage` (persists across reloads, shared across tabs)
   - `tabId`: Stored in `sessionStorage` (unique per tab, cleared when tab closes)
   - `guestId`: `guest-{deviceId}-{tabId}` (stable across page refreshes in same tab)

2. **Stats/Rating Storage (Backend):**
   - `guestKey`: `g:<guestId>` (e.g., `g:guest-abc123-def456`)
   - Stats stored in `guest_stats` table
   - Ratings stored in `guest_ratings` table
   - UPSERT used for all writes (INSERT ... ON CONFLICT DO UPDATE)

3. **On Game End:**
   - `gameManager.endGame()` calls `statsService.recordGameResult()` and `ratingService.updateRatings()`
   - Services convert `userId` to `guestKey` using `toGuestKey()`
   - Data is upserted into `guest_stats` and `guest_ratings`
   - Logs: `guestKey`, `boardSize`, `won`, `rating`, `ratingChange`

4. **On Stats Request:**
   - `/api/stats` receives `X-Guest-Id` header
   - `statsService.getPlayerStats()` reads from `guest_stats` table
   - `ratingService.getRating()` reads from `guest_ratings` table
   - Returns defaults (0 games, 1500 rating) if no entry exists
   - Logs: `guestKey`, `boardSize`, `games`, `wins`, `losses`, `rating`

5. **On Server Restart:**
   - All data persists in PostgreSQL
   - Services load from DB on first access
   - In-memory cache is populated for performance

## Test Steps

### 1. Play Game as Guest
1. Start server: `cd server && npm start`
2. Open browser (Normal tab)
3. Play 1 game (match with another tab or player)
4. Check stats: Should show `games=1`, rating changed
5. Check server logs: Should show `guestKey`, `boardSize`, `games=1`, `rating`, `ratingChange`

### 2. Restart Server
1. Stop server (Ctrl+C)
2. Start again: `cd server && npm start`
3. Refresh browser page (same tab)

### 3. Verify Persistence
- Stats should still show `games=1` (NOT reset to 0)
- Rating should be preserved (NOT reset to 1500)
- Check server logs: Should show `guestKey`, `boardSize` when fetching stats

### 4. Play Another Game
1. Play another game
2. Stats should show `games=2`
3. Restart server again
4. Stats should still show `games=2`

### 5. Verify Matchmaking
- Matchmaking should still work
- Can match with other players
- Stats update correctly after each game

## Acceptance Criteria ✅

- ✅ Play 1 game as guest → stats show `games=1`
- ✅ Restart server → refresh page → stats still show `games=1` (NOT reset)
- ✅ Rating persists across restarts
- ✅ Matchmaking still works
- ✅ Logs show `guestKey` and `boardSize` on game_end and stats requests

## Troubleshooting

If stats still reset after restart:
1. Check migration ran: `SELECT COUNT(*) FROM guest_stats;`
2. Check server logs for DB errors
3. Verify `guestKey` format: Should be `g:guest-...`
4. Check database connection is working
5. Verify `guest_stats` and `guest_ratings` tables exist
