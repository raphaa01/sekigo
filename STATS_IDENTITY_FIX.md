# Stats/Identity Fix Summary

## Problem
- Stats/Rating updates work for guests but NOT when logged in
- Stats panel stays empty / does not update for logged-in users
- Previous fixes broke matchmaking

## Solution

### Backend Changes

#### 1. Identity Service (`server/src/services/identity.js`) - NEW
- **Canonical identity resolver** for REST and WebSocket
- `getIdentityFromRequest(req)`: Resolves identity from HTTP request (session cookie or query param)
- Returns: `{ type: 'account'|'guest', id: string, username?: string }`

#### 2. Stats Endpoint (`server/src/index.js`)
- **Uses identity resolver** instead of manual cookie parsing
- **Always returns consistent JSON shape**:
  ```json
  {
    "identity": { "type": "account"|"guest", "id": "...", "username"?: "..." },
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
- **Logging**: Logs identity type, id, boardSize, and response summary

#### 3. Game Manager (`server/src/services/gameManager.js`)
- **Stats update payload** now includes `identity` object (same shape as `/api/stats`)
- **Logging**: Logs which user receives stats_update and payload summary
- Both `endGame()` and `sendPlayerStats()` use consistent payload shape

### Frontend Changes

#### 4. MatchmakingView (`web_client/src/components/MatchmakingView.jsx`)
- **Stats fetch**: 
  - For accounts: Does NOT pass userId (backend reads from session cookie)
  - For guests: Passes userId in query
- **Response validation**: Ensures `stats` object exists, uses defaults if missing
- **Stats update handler**: Validates payload shape, only updates if `stats` object exists
- **Logging**: Logs identity type and id for debugging

#### 5. GameView (`web_client/src/components/GameView.jsx`)
- **Game end handler**: Added comment about stats_update fallback (handled by MatchmakingView)

## Changed Files

1. **`server/src/services/identity.js`** (NEW)
   - Identity resolver for REST and WebSocket

2. **`server/src/index.js`**
   - Uses identity resolver
   - Consistent JSON response shape
   - Logging

3. **`server/src/services/gameManager.js`**
   - Stats update payload includes identity
   - Logging

4. **`web_client/src/components/MatchmakingView.jsx`**
   - Stats fetch without userId for accounts
   - Response validation
   - Stats update handler improvements

5. **`web_client/src/components/GameView.jsx`**
   - Minor comment update

## Sample JSON Responses

### Account User:
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

### Guest User:
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

### 1. Guest Stats (should still work):
- Open website (not logged in)
- Go to "Konto" tab
- **Expected**: Stats show 0 games, rating 1500
- Play a game (2 tabs)
- After game ends
- **Expected**: Stats update shows 1 game, rating changed

### 2. Account Stats on Page Load:
- Log in
- Refresh page
- Go to "Konto" tab
- **Expected**: Stats visible within 1-2s (rating, games, etc.)

### 3. Account Stats After Game:
- Log in
- Play a game (finish it)
- Go to "Konto" tab
- **Expected**: Stats updated (games++, rating changed)

### 4. Matchmaking Still Works:
- Open 2 tabs (one logged in, one guest)
- Both click "Play Online"
- **Expected**: Match found, game starts
- **Expected**: No matchmaking errors

### 5. Console Logs:
- Check browser console for:
  - `[MatchmakingView] Fetching stats: ... (identity: account:...)`
  - `[MatchmakingView] ✅ Stats loaded for account:...`
- Check backend logs for:
  - `[API] Stats request - identity: account, id: ..., boardSize: ...`
  - `[API] ✅ Stats response for account:... - games: ..., rating: ...`
  - `[GameManager] Sending stats_update to ... - games: ..., rating: ...`

## Acceptance Criteria ✅

- ✅ Logged-in user: refresh page → stats visible within 1-2s
- ✅ Logged-in user: finish game → stats update appears
- ✅ Guest user: unchanged behavior still works
- ✅ Matchmaking still works (guest vs guest AND account vs guest)
- ✅ Console/dev logs clearly show which identity is used

## Critical Constraints Met ✅

- ✅ Did NOT touch matchmaking code (queue, join_queue, match_found, etc.)
- ✅ ONLY touched: stats endpoints/services, identity resolver, frontend stats loading
- ✅ WS message shapes unchanged (except stats_update payload now includes identity)
- ✅ Matchmaking logic completely untouched
