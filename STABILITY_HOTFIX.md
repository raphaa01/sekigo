# Stability Hotfix: IdentityKey Unification + Matchmaking Decoupling

## Problem
System oscillates: sometimes matchmaking works but stats don't, sometimes vice versa. Identity/session handling is inconsistent across WS, REST, and queue keys.

## Solution
Enforce ONE identityKey format (`a:<uuid>` or `g:<guestId>`) everywhere and decouple matchmaking from DB/auth.

## Changed Files

### Backend

1. **`server/src/services/identity.js`**
   - Updated `getIdentityKey()` to use short prefixes: `a:` for account, `g:` for guest
   - Added `parseIdentityKey()` helper

2. **`server/src/websocket/handler.js`**
   - Stores `ws.identityKey` directly (format: `a:<uuid>` or `g:<guestId>`)
   - Connections stored by identityKey (not userId)
   - Never blocks guests - always allows connection
   - On hello message: sets `ws.identityKey = g:<guestId>`
   - All message handlers use identityKey

3. **`server/src/services/matchmaking.js`**
   - **NO DB CALLS** - removed rating lookup from joinQueue
   - Queue entries: `{identityKey, socketId, boardSize, joinedAt}` (no rating, no identity object)
   - `joinQueue(identityKey, ws, preferences)` - accepts identityKey string directly
   - Self-match prevention by identityKey comparison
   - Matching uses only time-in-queue (no rating checks)

4. **`server/src/services/gameManager.js`**
   - Updated to accept identityKey in objects
   - Stats updates use identityKey for sending

### Frontend

5. **`web_client/src/services/websocket.js`**
   - Sends `hello` message with `guestId` immediately on connect

6. **`web_client/src/components/MatchmakingView.jsx`**
   - Always includes `guestId` in `join_queue` message
   - Added debug UI showing WS status, guestId, identityKey
   - Stats fetching includes `X-Guest-Id` header

## IdentityKey Format

**Format:** `a:<uuid>` for accounts, `g:<guestId>` for guests

**Examples:**
- Account: `a:550e8400-e29b-41d4-a716-446655440000`
- Guest: `g:guest-abc123-def456-ghi789`

## Matchmaking Flow (No DB)

1. **WS Connect:**
   - If session cookie → `ws.identityKey = a:<userId>`
   - Else → wait for hello message

2. **Hello Message:**
   - Client sends `{type:"hello", guestId}`
   - Server sets `ws.identityKey = g:<guestId>`
   - Connection stored in `connections` map by identityKey

3. **Join Queue:**
   - Client sends `{type:"join_queue", boardSize, guestId}`
   - Server validates identityKey exists
   - Adds to queue: `{identityKey, socketId, boardSize, joinedAt}`
   - **NO RATING LOOKUP** - matchmaking is independent

4. **Matching:**
   - Find two different identityKeys in same boardSize queue
   - Check both sockets exist
   - Match if both waited ≥500ms
   - Extract userId from identityKey for game creation

5. **Disconnect:**
   - Remove identityKey from queue(s)
   - Remove connection from map

## Stats/Ranking (Independent)

- `/api/stats` uses identity resolution (session or X-Guest-Id header)
- Game end updates stats by identityKey:
  - `a:` prefix → DB
  - `g:` prefix → in-memory or guest_progress
- Stats failures do NOT affect matchmaking

## Debug UI

Shows at top of MatchmakingView:
- WS status (Connected/Connecting/Disconnected)
- GuestId
- IdentityKey (computed: `a:<uuid>` or `g:<guestId>`)

## Logging

### Backend:
- `[WebSocket] ✅ Account connected: identityKey=a:uuid, username=..., hasAccount=true`
- `[WebSocket] ✅ Guest connected: identityKey=g:guest-xxx, guestId=...`
- `[WebSocket] 📨 Message from a:uuid: join_queue`
- `[Matchmaking] ✅ a:uuid joined queue for 19x19 (queue length: 2)`
- `[Matchmaking] 🎮 Match found! a:uuid vs g:guest-xxx, board: 19x19, wait: 500ms`

### Frontend:
- `[Guest ID] Current userId: guest-xxx`
- `[WebSocket Client] Sending guestId to server: guest-xxx`
- `[MatchmakingView] Fetching stats: /api/stats?boardSize=19 (identity: account:uuid)`

## Test Steps

### 1. Guest vs Guest:
1. Open normal tab + incognito tab
2. Both show different guestId + identityKey in debug UI
3. Both click "Play Online" → Match found within 5s
4. **Expected**: Different identityKeys, match works

### 2. Account vs Guest:
1. Log in in one tab
2. Open second tab (guest, incognito)
3. Both click "Play Online" → Match found within 5s
4. **Expected**: `a:uuid` vs `g:guest-xxx`, match works

### 3. Two tabs same account:
1. Log in with same account in 2 tabs
2. Both show same identityKey: `a:uuid`
3. Both click "Play Online"
4. **Expected**: They do NOT match (self-match prevention by identityKey)

### 4. Stats independent:
1. Play game as guest
2. Stats may show 0 (in-memory)
3. Matchmaking still works
4. **Expected**: UI doesn't crash, matchmaking unaffected

## Acceptance Criteria ✅

- ✅ Matchmaking works without DB/auth
- ✅ Guests can always play (no token required)
- ✅ One identityKey format used everywhere
- ✅ Stats/ranking independent from matchmaking
- ✅ Self-match prevention works
- ✅ Debug UI shows identityKey

## Critical Constraints Met ✅

- ✅ Matchmaking NEVER requires DB or auth
- ✅ WS accepts guests WITHOUT token/cookie
- ✅ IdentityKey format: `a:<uuid>` or `g:<guestId>`
- ✅ Stats failures do NOT affect matchmaking
- ✅ Queue uses only identityKey + sockets
