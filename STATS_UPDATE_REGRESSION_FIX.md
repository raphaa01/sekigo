# Stats Update Regression Fix

## Problem
After game end, stats do not update anymore (guest AND logged-in). Matchmaking works.

## Root Causes
1. Stats update handler only updates if `boardSize` matches exactly
2. No fallback to fetch stats after `game_end` event
3. Stats might be empty/undefined if response shape is unexpected

## Solution

### Frontend Changes

#### 1. MatchmakingView - Stats Update Handler (`web_client/src/components/MatchmakingView.jsx`)
- **Improved validation**: Checks for `stats` object existence
- **Better logging**: Logs all stats updates with identity info
- **Fallback for missing stats**: Fetches from API if `stats` object missing
- **Game end listener**: NEW - Listens for `GAME_ENDED` event and triggers `fetchStats()` after 300ms as fallback
- **Never empty stats**: Always uses defaults if data is invalid

#### 2. MatchmakingView - Stats Fetch (`web_client/src/components/MatchmakingView.jsx`)
- **Enhanced logging**: Logs API response and extracted values
- **Better error handling**: Always sets defaults on error
- **Response validation**: Ensures `stats` object exists before using

### Backend Changes

#### 3. Game Manager - Stats Update Broadcast (`server/src/services/gameManager.js`)
- **Enhanced logging**: Logs identity type, games, rating, boardSize when sending stats_update
- **Always sends**: Ensures stats_update is sent even if values are defaults

#### 4. Stats Endpoint (`server/src/index.js`)
- **Content-Type header**: Explicitly sets `application/json` to prevent HTML responses
- **Enhanced logging**: Logs rankDisplay in addition to games/rating

## Changed Files

1. **`web_client/src/components/MatchmakingView.jsx`**
   - Added `GAME_ENDED` listener for fallback stats refresh
   - Improved stats_update handler validation
   - Enhanced logging throughout
   - Better error handling

2. **`server/src/services/gameManager.js`**
   - Enhanced logging for stats_update sends

3. **`server/src/index.js`**
   - Added explicit Content-Type header
   - Enhanced logging

## Final /api/stats URL

**Frontend uses:**
- For accounts: `GET /api/stats?boardSize=19` (no userId, backend reads from session cookie)
- For guests: `GET /api/stats?boardSize=19&userId=guest-abc123-def456`

**Backend route:** `app.get('/api/stats', handleGetStats)`

## Example JSON Response

```json
{
  "identity": {
    "type": "account",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "testuser"
  },
  "boardSize": 19,
  "rating": 1524,
  "rankDisplay": "30k",
  "stats": {
    "games": 5,
    "wins": 3,
    "losses": 2,
    "draws": 0,
    "winrate": 60.0,
    "highestRating": 1550
  }
}
```

Or for guests:
```json
{
  "identity": {
    "type": "guest",
    "id": "guest-abc123-def456"
  },
  "boardSize": 19,
  "rating": 1500,
  "rankDisplay": "30k",
  "stats": {
    "games": 0,
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "winrate": 0,
    "highestRating": 1500
  }
}
```

## Test Steps

### 1. Guest Stats After Game End:
1. Open website (not logged in)
2. Open 2 tabs (normal + incognito)
3. Both click "Play Online" → Match found
4. Play game → Finish game (2x Pass)
5. Go to "Konto" tab in both tabs
6. **Expected**: Stats show 1 game, rating changed, wins/losses updated

### 2. Logged-in Stats After Game End:
1. Log in
2. Open 2 tabs (one logged in, one guest)
3. Both click "Play Online" → Match found
4. Play game → Finish game
5. Go to "Konto" tab (logged-in tab)
6. **Expected**: Stats show 1 game, rating changed, wins/losses updated

### 3. Page Reload Stats:
1. Log in (or stay as guest)
2. Refresh page
3. Go to "Konto" tab
4. **Expected**: Stats visible within 1-2s (never blank)

### 4. Console Logs Check:
- Browser console should show:
  - `[MatchmakingView] 🎮 Game ended event received: ...`
  - `[MatchmakingView] 📊 Stats update received: ...`
  - `[MatchmakingView] ✅ Updating stats from WS - ...`
  - `[MatchmakingView] ✅ Stats loaded for ...`
- Backend logs should show:
  - `[GameManager] 📊 Sending stats_update to ... - games: ..., rating: ...`
  - `[API] ✅ Stats response for ... - games: ..., rating: ..., rank: ...`

## Acceptance Criteria ✅

- ✅ Guest: after game_end, stats panel shows updated games/wins/losses
- ✅ Logged-in: same
- ✅ Page reload: stats panel loads within 1-2s (never blank)
- ✅ Matchmaking untouched and still works

## Critical Constraints Met ✅

- ✅ Matchmaking logic completely untouched
- ✅ Only stats loading/update logic changed
- ✅ Stats never empty (always defaults)
- ✅ Fallback mechanism in place
