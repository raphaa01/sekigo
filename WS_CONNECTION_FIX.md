# WebSocket Connection Fix - Summary

## Problem
- Frontend stuck on "Verbinde mit dem Server, bitte warten..."
- WebSocket never reaches ready state
- No error feedback to user

## Fixes Applied

### A) WS URL/Port Configuration
**Frontend (`web_client/src/services/websocket.js`):**
- Uses Vite proxy in dev: `ws://localhost:3000/ws` (proxied to `ws://localhost:3001/ws`)
- Direct connection in production: `ws://localhost:3001/ws`
- **Final WS URL (dev):** `ws://localhost:3000/ws` (via Vite proxy)

### B) Frontend WS Client Improvements
1. **Connection Timeout (5 seconds)**
   - If not connected after 5s, shows error message
   - Clears timeout on successful connection

2. **Error State Management**
   - `errorMessage` state tracks connection errors
   - `isConnecting` state tracks connection attempt
   - Clear error messages on retry

3. **Enhanced Logging**
   - "WS connecting to: <url>"
   - "WS open"
   - "WS close code=<code> reason=<reason>"
   - "WS error"

4. **Event Emitters**
   - `connecting` event when connection starts
   - `connection_timeout` event on timeout
   - `error` event with message

### C) Backend WS Logging
**Server (`server/src/websocket/handler.js`):**
- Logs remote address and request path on connection
- Logs close code and reason on disconnection
- Example: `[WebSocket] New connection attempt from ::1, path: /ws`

### D) UI Improvements
**Frontend (`web_client/src/components/MatchmakingView.jsx`):**
1. **Connection States:**
   - Shows "Verbinde mit Server..." while connecting
   - Shows error message + retry button on failure
   - Shows hint: "Starte Backend: cd server && npm start"

2. **Retry Functionality:**
   - "Erneut versuchen" button to reconnect
   - Clears error state on retry

3. **Auto-show UI:**
   - Once connected, immediately shows Matchmaking UI
   - No auth gate blocking

## Changed Files

1. `web_client/src/services/websocket.js`
   - Added connection timeout (5s)
   - Added error message tracking
   - Enhanced logging
   - Uses Vite proxy in dev mode

2. `web_client/src/components/MatchmakingView.jsx`
   - Added connection error state
   - Added retry button
   - Shows helpful error messages
   - Better connection state management

3. `server/src/websocket/handler.js`
   - Enhanced connection logging (address + path)
   - Enhanced disconnection logging (code + reason)

## Test Steps

### 1. Start Backend:
```powershell
cd server
npm start
```

**Expected output:**
```
Go Platform Server running on http://localhost:3001
[WebSocket Server] WebSocket server ready
```

### 2. Start Frontend:
```powershell
cd web_client
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:3000/
```

### 3. Open Browser:
```
http://localhost:3000
```

### Expected Behavior:

**If Backend is Running:**
- ✅ Shows "Verbinde mit Server..." for 1-2 seconds
- ✅ Then shows Matchmaking UI with board size selector
- ✅ Console shows: "WS open", "✅ Connected successfully"

**If Backend is NOT Running:**
- ⏳ Shows "Verbinde mit Server..." for 5 seconds
- ❌ Then shows error: "Konnte keine Verbindung zum Server herstellen. Läuft das Backend?"
- 🔄 Shows "Erneut versuchen" button
- 💡 Shows hint: "Starte Backend: cd server && npm start"

### Browser Console (Expected):

**Successful Connection:**
```
[Guest ID] Generated new guest ID: guest-abc123
[WebSocket Client] WS connecting to: ws://localhost:3000/ws (userId: guest-abc123)
[WebSocket Client] WS open
[WebSocket Client] ✅ Connected successfully
[WebSocket Client] Sending: {type: "set_user_id", data: {userId: "guest-abc123"}}
[WebSocket Client] Received: {type: "connected", data: {...}}
[MatchmakingView] ✅ WebSocket connected
```

**Failed Connection (Backend Down):**
```
[WebSocket Client] WS connecting to: ws://localhost:3000/ws (userId: guest-abc123)
[WebSocket Client] WS error: ...
[WebSocket Client] ❌ Connection timeout after 5 seconds
[MatchmakingView] ❌ Failed to connect: Konnte keine Verbindung zum Server herstellen...
```

### Server Logs (Expected):

**On Connection:**
```
[WebSocket] New connection attempt from ::1, path: /ws
[WebSocket] ✅ User guest-abc123 identified and registered
```

**On Disconnection:**
```
[WebSocket] 🔌 User guest-abc123 disconnected (code: 1000, reason: )
```

## Final WS URL

**Development (via Vite proxy):**
- Frontend connects to: `ws://localhost:3000/ws`
- Vite proxies to: `ws://localhost:3001/ws`
- Server listens on: `ws://localhost:3001/ws`

**Production:**
- Frontend connects directly to: `ws://localhost:3001/ws`
- Server listens on: `ws://localhost:3001/ws`

## Acceptance Criteria ✅

- ✅ When backend is running, frontend connects within 1-2 seconds
- ✅ Frontend leaves "waiting" screen after connection
- ✅ If backend is not running, clear error + Retry appears after 5 seconds
- ✅ No infinite spinner without explanation
- ✅ Retry button allows reconnection
- ✅ Helpful error messages guide user

Die WebSocket-Verbindung sollte jetzt zuverlässig funktionieren!
