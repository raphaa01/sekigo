# Identity Unification Fix

## Problem
After adding auth, the system oscillates: sometimes matchmaking works but ranking/stats don't, sometimes vice versa. This indicates inconsistent identity/session handling between REST, WebSocket, and DB.

## Solution
Unified identity system with canonical identity resolution across all layers.

## Changed Files

### Backend

1. **`server/src/services/identity.js`** - Complete rewrite
   - Uses `kind` instead of `type` (values: `'account'` or `'guest'`)
   - `getIdentityFromRequest(req)`: Resolves from session cookie → X-Guest-Id header → query param
   - `getIdentityFromWs(ws, msg)`: Resolves from ws.authUser → ws.guestId → message data
   - `getIdentityKey(identity)`: Returns `${kind}:${id}` format

2. **`server/src/websocket/handler.js`** - Updated to use identity system
   - Stores `ws.authUser` (from session) and `ws.guestId` (from hello message)
   - Connections stored by `identityKey` format: `account:uuid` or `guest:guest-xxx`
   - Handles `hello` message (preferred) and `set_user_id` (legacy)
   - All message handlers use identity objects

3. **`server/src/services/matchmaking.js`** - Updated to use identityKey
   - Queue entries use `identityKey` instead of `userId`
   - Self-match prevention uses `identityKey` comparison
   - All methods accept identity objects

4. **`server/src/index.js`** - Updated stats endpoint
   - Uses `getIdentityFromRequest` with `kind` format
   - Response uses `kind` instead of `type`
   - Added `/api/debug/identity` endpoint

5. **`server/src/services/gameManager.js`** - Updated to accept identity objects
   - All methods accept identity objects (with backward compatibility for userId strings)
   - `endGame` sends stats_update with `kind` format
   - `sendPlayerStats` uses identity objects

### Frontend

6. **`web_client/src/services/websocket.js`** - Updated to send hello message
   - Sends `hello` message with `guestId` instead of `set_user_id`

7. **`web_client/src/components/MatchmakingView.jsx`** - Updated stats fetching
   - Sends `X-Guest-Id` header for guests
   - Handles `kind` and `type` in identity (backward compatibility)
   - Enhanced logging

## IdentityKey Format

**Format:** `${kind}:${id}`

**Examples:**
- Account: `account:550e8400-e29b-41d4-a716-446655440000`
- Guest: `guest:guest-abc123-def456-ghi789`

## Identity Resolution Priority

### REST (`getIdentityFromRequest`):
1. Session cookie → Account identity
2. `X-Guest-Id` header → Guest identity
3. `guestId` query param → Guest identity
4. `userId` query param (legacy) → Guest identity

### WebSocket (`getIdentityFromWs`):
1. `ws.authUser` (from session cookie) → Account identity
2. `ws.guestId` (from hello message) → Guest identity
3. `ws.userId` (legacy) → Guest if starts with "guest-", else Account
4. Message data `guestId` → Guest identity

## Example JSON Response from /api/stats

```json
{
  "identity": {
    "kind": "account",
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
    "kind": "guest",
    "id": "guest-abc123-def456-ghi789"
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

### 1. Guest vs Guest:
1. Open 2 tabs (normal + incognito)
2. Both click "Play Online" → Match found
3. Play game → Finish game (2x Pass)
4. Go to "Konto" tab in both tabs
5. **Expected**: Stats show 1 game, rating changed, wins/losses updated

### 2. Account vs Guest:
1. Log in in one tab
2. Open second tab (guest, incognito)
3. Both click "Play Online" → Match found
4. Play game → Finish game
5. Go to "Konto" tab (logged-in tab)
6. **Expected**: Stats show 1 game, rating changed, wins/losses updated
7. Refresh page → **Expected**: Stats persist (still show 1 game)

### 3. Account vs Account:
1. Log in with account A in tab 1
2. Log in with account B in tab 2 (different account)
3. Both click "Play Online" → Match found
4. Play game → Finish game
5. **Expected**: Both accounts' stats update and persist

### 4. Two tabs same account:
1. Log in with same account in 2 tabs
2. Both click "Play Online"
3. **Expected**: They do NOT match each other (self-match prevention by identityKey)

### 5. No "token required" for guests:
1. Open website (not logged in)
2. Click "Play Online"
3. **Expected**: Can join queue and play without any login

## Debug Endpoint

**GET `/api/debug/identity`**

Returns current identity resolved from request:
```json
{
  "identity": {
    "kind": "account",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "testuser"
  },
  "identityKey": "account:550e8400-e29b-41d4-a716-446655440000",
  "message": "Identity resolved successfully"
}
```

## Logging

### Backend Logs:
- `[Identity] ✅ Resolved account from session: ...`
- `[Identity] ✅ Resolved guest from header/query: ...`
- `[WebSocket] ✅ Account connected: account:uuid`
- `[WebSocket] ✅ Guest connected: guest:guest-xxx`
- `[Matchmaking] ✅ account:uuid (account) joined queue for 19x19`
- `[Matchmaking] 🎮 Match found! account:uuid vs guest:guest-xxx`
- `[API] 📊 Stats request - identity: account:uuid, boardSize: 19`
- `[GameManager] 📊 Sending stats_update to black player account:uuid`

### Frontend Logs:
- `[MatchmakingView] Fetching stats: /api/stats?boardSize=19 (identity: account:uuid)`
- `[MatchmakingView] ✅ Stats loaded for account:uuid - games: 5, rating: 1524`
- `[MatchmakingView] ✅ Updating stats from WS - identity: account:uuid, games: 6, rating: 1530`

## Acceptance Criteria ✅

- ✅ Guest vs Guest: Stats update after game end
- ✅ Account vs Guest: Stats update and persist after refresh
- ✅ Account vs Account: Both stats update and persist
- ✅ Two tabs same account: Never match each other
- ✅ No "token required" for guests: Can always play

## Critical Constraints Met ✅

- ✅ Matchmaking logic unchanged (only identityKey format)
- ✅ Self-match prevention works by identityKey
- ✅ Stats/rating work for both guests and accounts
- ✅ Identity resolution is deterministic and logged
- ✅ Backward compatibility maintained (legacy userId strings still work)
