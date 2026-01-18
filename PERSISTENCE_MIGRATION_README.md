# Stats/Rating Persistence Migration

## Overview
This migration implements persistent storage for stats and ratings using a unified `user_key` system that works for both guests and accounts.

## Database Changes

### New Tables
- `unified_ratings`: Stores ratings for all users (guests and accounts) using `user_key`
- `unified_player_stats`: Stores statistics for all users using `user_key`

### User Key Format
- Guests: `g:<guestId>` (e.g., `g:guest-abc123`)
- Accounts: `a:<userUuid>` (e.g., `a:550e8400-e29b-41d4-a716-446655440000`)

## Migration Steps

1. **Run the migration SQL:**
   ```bash
   psql go_platform < db/migrations/002_unified_user_key.sql
   ```

2. **Verify migration:**
   ```sql
   -- Check unified tables exist
   SELECT COUNT(*) FROM unified_ratings;
   SELECT COUNT(*) FROM unified_player_stats;
   
   -- Check migrated data
   SELECT user_key, board_size, rating FROM unified_ratings LIMIT 10;
   SELECT user_key, board_size, games_played, wins, losses FROM unified_player_stats LIMIT 10;
   ```

## Code Changes

### Services Updated
- `server/src/services/stats.js`: Now uses `unified_player_stats` table
- `server/src/services/rating.js`: Now uses `unified_ratings` table

### Key Functions
- `toUserKey(userId)`: Converts `userId` to `user_key` format (`g:` or `a:` prefix)
- All DB queries now use `user_key` instead of separate `guest_id`/`user_id` columns

## Backward Compatibility

- Old tables (`ratings`, `player_stats`, `guest_progress`) are kept for reference
- Migration automatically copies existing data to unified tables
- New code uses unified tables exclusively

## Testing

1. **Play a game as guest:**
   - Start server
   - Play 1 game
   - Check stats show `games=1`

2. **Restart server:**
   ```bash
   # Stop server (Ctrl+C)
   cd server
   npm start
   ```

3. **Verify persistence:**
   - Refresh page
   - Stats should still show `games=1`
   - Rating should be preserved

4. **Verify matchmaking:**
   - Matchmaking should still work
   - New games should update stats correctly

## Troubleshooting

If stats reset after restart:
1. Check database connection is working
2. Verify migration ran successfully
3. Check server logs for DB errors
4. Verify `unified_ratings` and `unified_player_stats` tables exist
