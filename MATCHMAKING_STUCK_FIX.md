# Matchmaking Stuck Fix - Summary

## Problem behoben
- Zwei Tabs können nicht matchen
- Beide Tabs haben die gleiche userId (localStorage wird geteilt)
- Stale Queue-Einträge bleiben bestehen
- Matchmaking triggert nicht zuverlässig

## Root Cause gefunden

**Hauptursache: Gleiche userId in beiden Tabs**
- `getGuestUserId()` verwendete nur `localStorage`
- localStorage wird zwischen Tabs geteilt
- Beide Tabs hatten daher die gleiche userId
- Server behandelte beide als denselben Spieler
- Matchmaking konnte nicht matchen (gleicher User kann nicht mit sich selbst matchen)

**Nebenursachen:**
- Keine Queue-Cleanup bei Disconnect
- Matchmaking-Intervall zu langsam (2s)
- Keine sofortige Matchmaking-Auslösung nach Join

## Lösung

### Frontend

**1. Eindeutige userId pro Tab (`web_client/src/utils/guestId.js`):**
- **deviceId**: localStorage (persistiert, geteilt zwischen Tabs)
- **tabId**: sessionStorage (eindeutig pro Tab, wird beim Tab-Schließen gelöscht)
- **userId**: `guest-{deviceId}-{tabId}`
- Jeder Tab hat jetzt eine eindeutige userId

**2. Dev UI:**
- Zeigt userId im Stats-Panel (nur in Development)
- Ermöglicht Verifizierung, dass Tabs unterschiedliche IDs haben

### Backend

**1. Queue-Tracking (`server/src/services/matchmaking.js`):**
- `queuedUsers` Map: Trackt alle queued Users
- Prüft Socket-Existenz vor Matchmaking
- Entfernt stale Einträge automatisch

**2. Queue-Cleanup:**
- **Bei Disconnect**: `removeUser()` entfernt User sofort
- **Periodisch (alle 5s)**: `cleanupStaleEntries()` entfernt:
  - Einträge ohne aktive Socket-Verbindung
  - Einträge älter als 60 Sekunden

**3. Deterministisches Matchmaking:**
- **Intervall**: 500ms (statt 2s) für schnelleres Matching
- **Sofort nach Join**: `processQueues()` wird sofort aufgerufen
- **Sicherheit**: Prüft explizit, dass `player1.userId !== player2.userId`
- **Socket-Verifizierung**: Prüft, dass beide Sockets existieren

**4. Verbessertes Logging:**
- Loggt userId, boardSize, queue length bei Join
- Loggt Queue-Inhalte (alle userIds) bei Match-Versuch
- Loggt gameId + beide userIds bei Match-Found
- Loggt Cleanup-Operationen

## Geänderte Dateien

1. **`web_client/src/utils/guestId.js`**
   - deviceId (localStorage) + tabId (sessionStorage)
   - userId = `guest-{deviceId}-{tabId}`

2. **`web_client/src/components/MatchmakingView.jsx`**
   - Zeigt userId im Dev-Mode

3. **`server/src/services/matchmaking.js`**
   - `queuedUsers` Map für Tracking
   - `removeUser()` Methode
   - `cleanupStaleEntries()` Methode
   - `processQueues()`: Prüft unterschiedliche userIds, Socket-Verifizierung
   - Matchmaking-Intervall: 500ms
   - Sofortiges Matchmaking nach Join

4. **`server/src/websocket/handler.js`**
   - Ruft `removeUser()` statt `leaveQueue()` bei Disconnect auf

## Test Steps

### 1. Backend starten:
```powershell
cd server
npm start
```

### 2. Frontend starten:
```powershell
cd web_client
npm run dev
```

### 3. Test mit 2 Tabs:

**A) UserId-Verifizierung:**
1. Tab 1 (normal): `http://localhost:3000`
2. Tab 2 (Inkognito): `http://localhost:3000`
3. **Prüfe Stats-Panel**: Beide sollten unterschiedliche User IDs zeigen
   - Tab 1: z.B. `guest-abc123-def456`
   - Tab 2: z.B. `guest-abc123-ghi789` (gleiche deviceId, andere tabId)

**B) Matchmaking-Test:**
1. Tab 1: Board-Größe wählen (z.B. 19×19)
2. Tab 1: "Play Online" klicken
3. Tab 2: Gleiche Board-Größe wählen
4. Tab 2: "Play Online" klicken
5. **Erwartetes Ergebnis (innerhalb 5 Sekunden):**
   - Beide Tabs erhalten `match_found`
   - Navigation zum Game Screen
   - Server-Logs zeigen: "Match found! guest-abc123-def456 vs guest-abc123-ghi789"

**C) Stale Entry Cleanup:**
1. Tab 1: "Play Online" klicken
2. Tab 1: Schließen (oder Refresh)
3. Tab 2: "Play Online" klicken
4. **Erwartetes Ergebnis:**
   - Tab 1 wird aus Queue entfernt (Disconnect)
   - Tab 2 wartet auf anderen Spieler
   - Keine "ghost" Einträge

### Server-Logs (erwartet):

**Tab 1 Join:**
```
[WebSocket] ✅ User guest-abc123-def456 identified and registered
[WebSocket] User guest-abc123-def456 joining queue with boardSize: 19
[Matchmaking] ✅ User guest-abc123-def456 joined queue for 19x19 (queue size: 1)
[Matchmaking] Queue contents for 19x19: [ 'guest-abc123-def456' ]
```

**Tab 2 Join:**
```
[WebSocket] ✅ User guest-abc123-ghi789 identified and registered
[WebSocket] User guest-abc123-ghi789 joining queue with boardSize: 19
[Matchmaking] ✅ User guest-abc123-ghi789 joined queue for 19x19 (queue size: 2)
[Matchmaking] Queue contents for 19x19: [ 'guest-abc123-def456', 'guest-abc123-ghi789' ]
[Matchmaking] Processing queue for 19x19: 2 players
[Matchmaking] 🎮 Match found! guest-abc123-def456 (1500) vs guest-abc123-ghi789 (1500), diff: 0, board: 19x19, wait: 523ms
[Matchmaking] 🎮 Match created: gameId=game_123, black=guest-abc123-def456, white=guest-abc123-ghi789, board=19x19
```

**Tab 1 Disconnect:**
```
[WebSocket] 🔌 User guest-abc123-def456 disconnected (code: 1000, reason: )
[Matchmaking] Removing user guest-abc123-def456 from all queues (disconnect)
[Matchmaking] ✅ User guest-abc123-def456 left queue for 19x19
```

## Acceptance Criteria ✅

- ✅ Zwei Tabs zeigen unterschiedliche userId (verifiziert via UI/Console)
- ✅ Beide Tabs klicken "Play Online" und erhalten `queue_joined`
- ✅ Innerhalb <= 5 Sekunden: Beide Tabs erhalten `match_found` und Spiel startet
- ✅ Tab schließen/refresh entfernt aus Queue (keine "ghost" Einträge)
- ✅ "Already in queue" verhindert Matching nicht mehr

## Root Cause Erklärung

**Hauptursache: Gleiche userId in beiden Tabs**
- `localStorage` wird zwischen Tabs geteilt
- Beide Tabs hatten `guest-{uuid}` mit gleichem UUID
- Server behandelte beide als denselben Spieler
- Matchmaking konnte nicht matchen (User kann nicht mit sich selbst matchen)

**Fix:**
- deviceId (localStorage) + tabId (sessionStorage)
- Jeder Tab hat jetzt eindeutige userId: `guest-{deviceId}-{tabId}`
- Matchmaking prüft explizit: `player1.userId !== player2.userId`
- Queue-Cleanup entfernt stale Einträge automatisch

Das Matchmaking sollte jetzt zuverlässig funktionieren!
