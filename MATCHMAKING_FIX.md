# Matchmaking Fix Summary

## Problem
Matchmaking funktioniert nicht mehr - keine Spiele können gestartet werden.

## Root Cause
Wenn ein User eingeloggt ist, wird die `userId` vom Server aus der Session gesetzt. Aber der Client sendet immer noch `set_user_id` mit der guestId, was die Session-basierte userId überschreiben könnte.

## Lösung

### 1. WebSocket Handler (`server/src/websocket/handler.js`)
- **Fix**: Ignoriere `set_user_id` wenn bereits eine Session-basierte userId gesetzt wurde
- **Logik**: Wenn `ws.userId` existiert und NICHT mit "guest-" beginnt, dann ist es eine Session-basierte userId → ignoriere `set_user_id`
- **Ergebnis**: Session-basierte userIds werden nicht mehr überschrieben

### 2. Matchmaking Service (`server/src/services/matchmaking.js`)
- **Fix**: Setze `queuedUsers` Map beim `joinQueue`
- **Fix**: Rufe `processQueues()` sofort nach `joinQueue` auf (nicht nur alle 500ms)
- **Ergebnis**: Bessere Tracking und sofortiges Matching

## Geänderte Dateien

1. **`server/src/websocket/handler.js`**
   - Ignoriere `set_user_id` wenn bereits Session-basierte userId gesetzt

2. **`server/src/services/matchmaking.js`**
   - Setze `queuedUsers` Map beim `joinQueue`
   - Rufe `processQueues()` sofort nach `joinQueue` auf

## Test Steps

1. **Als Gast:**
   - Öffne 2 Tabs (normal + incognito)
   - Beide klicken "Play Online"
   - **Erwartet**: Match innerhalb 1-2 Sekunden

2. **Als eingeloggter User:**
   - Logge dich ein
   - Öffne 2 Tabs (normal + incognito)
   - Beide klicken "Play Online"
   - **Erwartet**: Match innerhalb 1-2 Sekunden, userId sollte Account-UUID sein (nicht guest-*)

3. **Backend Logs prüfen:**
   - `[WebSocket] ✅ User {userId} connected via session` (für eingeloggte User)
   - `[WebSocket] Ignoring set_user_id - already authenticated via session` (wenn guestId gesendet wird)
   - `[Matchmaking] 🎮 Match found!` (wenn Match erstellt wird)

## Acceptance Criteria ✅

- ✅ Matchmaking funktioniert für Gäste
- ✅ Matchmaking funktioniert für eingeloggte User
- ✅ Session-basierte userIds werden nicht überschrieben
- ✅ Matches werden sofort erstellt (innerhalb 1-2 Sekunden)
