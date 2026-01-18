# Auth Removal - MVP Summary

## Was wurde entfernt

**Frontend:**
- Alle Auth-Checks und Token-Requirements entfernt
- `getStoredAuth()` Aufrufe entfernt
- Auth-Fehlermeldungen entfernt
- Token-Handling aus WebSocket entfernt

**Backend:**
- Token-Validierung bei WebSocket-Verbindung entfernt
- JWT-Verifizierung entfernt
- Server akzeptiert jetzt Verbindungen ohne Token

## Wie Guest UserId funktioniert

**Frontend (`web_client/src/utils/guestId.js`):**
- Generiert pro Tab eine eindeutige ID via `sessionStorage`
- Format: `guest-<uuid>` (z.B. `guest-123e4567-e89b-12d3-a456-426614174000`)
- Verwendet `crypto.randomUUID()` wenn verfügbar, sonst Fallback
- ID bleibt für die Tab-Session erhalten, ist aber pro Tab unterschiedlich

**WebSocket-Flow:**
1. Client verbindet ohne Token: `ws://localhost:3001/ws`
2. Nach Verbindung sendet Client: `{type: "set_user_id", data: {userId: "guest-..."}}`
3. Server registriert userId und speichert die Verbindung
4. Alle weiteren Messages enthalten userId im data-Objekt

## Geänderte Dateien

### Frontend:
1. `web_client/src/utils/guestId.js` (NEU)
   - Generiert per-Tab guest userId

2. `web_client/src/services/websocket.js`
   - Token-Handling entfernt
   - `getWebSocketUrl()` gibt jetzt URL ohne Token zurück
   - `getUserId()` Methode hinzugefügt
   - Sendet `set_user_id` nach Verbindung
   - Fügt userId automatisch zu allen Messages hinzu

3. `web_client/src/components/MatchmakingView.jsx`
   - Auth-Checks entfernt
   - `getStoredAuth()` Import entfernt
   - Auth-Fehlermeldungen entfernt
   - Verbindet direkt ohne Token-Check

4. `web_client/src/components/GameView.jsx`
   - Auth-Check entfernt
   - `getStoredAuth()` Import entfernt

### Backend:
1. `server/src/websocket/handler.js`
   - Token-Validierung entfernt
   - `verifyToken()` Import entfernt
   - Akzeptiert Verbindungen ohne Token
   - Behandelt `set_user_id` Message
   - Validiert userId (non-empty string)
   - Loggt userId bei Connect/Queue/Match

2. `server/src/services/matchmaking.js`
   - userId-Validierung hinzugefügt
   - Verbessertes Logging bei Match-Erstellung

## Testanleitung

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

### 3. Browser öffnen:
```
http://localhost:3000
```

### 4. Erwartetes Verhalten:
- ✅ Direkt zur Matchmaking-Seite (keine Auth-Screen)
- ✅ Keine "Authentifizierung nötig" Meldung
- ✅ WebSocket verbindet automatisch
- ✅ Guest userId wird generiert (siehe Browser-Konsole)

### 5. Matchmaking testen:
1. **Tab 1** (normal): `http://localhost:3000`
   - Brettgröße wählen (z.B. 19×19)
   - "Warteschlange beitreten" klicken
   - Sollte zeigen: "Suche nach Gegner..."

2. **Tab 2** (Inkognito): `http://localhost:3000`
   - Gleiche Brettgröße wählen
   - "Warteschlange beitreten" klicken

3. **Erwartetes Ergebnis:**
   - Innerhalb von 1-3 Sekunden: Beide Tabs erhalten `match_found`
   - Automatische Navigation zum Game-Screen

### Server-Logs (erwartet):
```
[WebSocket] New connection attempt from ::1
[WebSocket] ✅ User guest-abc123 identified and registered
[WebSocket] Received message from guest-abc123: join_queue { boardSize: 19 }
[Matchmaking] ✅ User guest-abc123 joined queue for 19x19 (queue size: 1)

[WebSocket] New connection attempt from ::1
[WebSocket] ✅ User guest-xyz789 identified and registered
[WebSocket] Received message from guest-xyz789: join_queue { boardSize: 19 }
[Matchmaking] ✅ User guest-xyz789 joined queue for 19x19 (queue size: 2)
[Matchmaking] Processing queue for 19x19: 2 players
[Matchmaking] 🎮 Match found! guest-abc123 (1500) vs guest-xyz789 (1500), diff: 0, board: 19x19
[Matchmaking] 🎮 Match created: gameId=game_123, black=guest-abc123, white=guest-xyz789, board=19x19
```

### Browser-Konsole (erwartet):
```
[Guest ID] Generated new guest ID: guest-abc123
[WebSocket Client] Connecting to: ws://localhost:3001/ws (userId: guest-abc123)
[WebSocket Client] ✅ Connected successfully
[WebSocket Client] Sending: {type: "set_user_id", data: {userId: "guest-abc123"}}
[WebSocket Client] Received: {type: "connected", data: {...}}
[MatchmakingView] ✅ WebSocket connected
[WebSocket Client] Sending: {type: "join_queue", data: {boardSize: 19, userId: "guest-abc123"}}
[WebSocket Client] Received: {type: "queue_joined", data: {...}}
[WebSocket Client] Received: {type: "match_found", data: {...}}
```

## Wichtige Hinweise

- **Keine Authentifizierung**: Die App funktioniert jetzt komplett ohne Login/Gast-Flow
- **Per-Tab UserId**: Jeder Tab hat eine eigene guest userId (via sessionStorage)
- **Zwei Tabs = Zwei verschiedene User**: Perfekt für Testing
- **Server-authoritative**: Server verwendet userId vom Socket, nicht vom Client-Payload (außer bei set_user_id)

Die App sollte jetzt direkt zur Matchmaking-Seite gehen und funktionieren!
