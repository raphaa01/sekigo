# Queue Status Fix

## Problem
- "Du bist schon in der Warteschlange" wird angezeigt, auch wenn der Benutzer nicht in der Queue ist
- Matchmaking und Stats funktionieren nicht gleichzeitig für Konten

## Root Cause
1. `matchmaking.js` hatte noch die alte Signatur `joinQueue(identity, preferences)` statt `joinQueue(identityKey, ws, preferences)`
2. Queue-Status wurde nicht korrekt zurückgesetzt wenn `in_queue: true` gesendet wurde
3. Stats-Endpoint konnte X-Guest-Id Header nicht lesen (CORS)

## Fixes

### Backend
1. **`server/src/services/matchmaking.js`**
   - Aktualisiert auf neue Signatur: `joinQueue(identityKey, ws, preferences)`
   - Entfernt DB-Aufrufe (kein Rating-Lookup mehr)
   - Queue-Einträge enthalten nur: `{identityKey, socketId, boardSize, joinedAt}`
   - Sendet `in_queue: true` wenn Benutzer bereits in Queue ist

2. **`server/src/index.js`**
   - CORS erlaubt jetzt `X-Guest-Id` Header

### Frontend
3. **`web_client/src/components/MatchmakingView.jsx`**
   - Behandelt `in_queue: true` korrekt - setzt `isInQueue` nicht auf true
   - Sendet immer `X-Guest-Id` Header für Stats (auch für eingeloggte Benutzer)
   - Reset Queue-Status bei Disconnect

## Test
1. Klicke auf "Play Online" → sollte in Queue gehen
2. Klicke erneut → sollte "already in queue" zeigen, aber Button sollte funktionieren
3. Verlasse Queue → sollte korrekt zurückgesetzt werden
4. Stats sollten für eingeloggte Benutzer funktionieren
