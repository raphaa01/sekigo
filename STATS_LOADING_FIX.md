# Stats Loading Fix - Summary

## Problem behoben
- Stats wurden nur nach "Join Queue" angezeigt
- Beim initialen Seitenaufruf keine Stats sichtbar

## Lösung

### Backend

**1. REST Endpoint für Stats (`server/src/index.js`):**
- **GET `/api/stats?userId=...&boardSize=...`**
- Gibt zurück:
  ```json
  {
    "userId": "guest-...",
    "boardSize": 19,
    "rating": 1500,
    "rankDisplay": "1d",
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
- **Keine Auth erforderlich** (MVP)
- Erstellt Defaults wenn Stats nicht existieren (rating=1500, stats=0)

### Frontend

**1. Guest ID in localStorage (`web_client/src/utils/guestId.js`):**
- Geändert von `sessionStorage` zu `localStorage`
- Persistiert über Page-Reloads hinweg
- Gleiche userId bleibt erhalten

**2. Stats beim Laden fetchen (`web_client/src/components/MatchmakingView.jsx`):**
- `fetchStats()` Funktion: Fetcht Stats via REST API
- `useEffect(() => fetchStats(boardSize), [boardSize])`: Fetcht beim Mount und bei Board-Size-Wechsel
- **Unabhängig von Matchmaking**: Stats werden sofort geladen, nicht erst nach "Join Queue"

**3. Verbesserte UI:**
- **"Meine Statistiken" Panel**: Zentriertes Card-Design
- **Board-Size-Selector**: Segmented Buttons im Stats-Panel
- **Connection Status**: Kleiner Status-Dot (Verbunden/Getrennt)
- **"Play Online" Button**: Primärer Button für Matchmaking
- **Loading/Error States**: Zeigt Loading und Retry-Button bei Fehlern

**4. Stats Update Handler:**
- Empfängt `stats_update` Events (nach Spielende)
- Aktualisiert Stats-State
- Refresht auch via API für Konsistenz

## Geänderte Dateien

1. **`server/src/index.js`**
   - `GET /api/stats` Endpoint hinzugefügt
   - Import von `statsService`

2. **`web_client/src/utils/guestId.js`**
   - Geändert von `sessionStorage` zu `localStorage`

3. **`web_client/src/components/MatchmakingView.jsx`**
   - `fetchStats()` Funktion hinzugefügt
   - Stats werden beim Mount und bei Board-Size-Wechsel gefetcht
   - UI komplett überarbeitet: Stats-Panel, Board-Size-Selector, "Play Online" Button
   - Loading/Error States hinzugefügt

## Endpoint Details

**REST Endpoint:**
- **URL**: `GET /api/stats?userId=<userId>&boardSize=<9|13|19>`
- **Auth**: Keine erforderlich
- **Response**: JSON mit Stats-Daten
- **Defaults**: Wenn Stats nicht existieren → rating=1500, stats=0

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

### 3. Browser öffnen:
```
http://localhost:3000
```

### Erwartetes Verhalten:

**A) Initial Page Load:**
1. Seite lädt
2. **Innerhalb von 1-2 Sekunden**: "Meine Statistiken" Panel erscheint
3. Zeigt: Rang (z.B. "1d"), Rating (1500), Spiele (0), Winrate (0%)
4. Board-Size-Selector ist sichtbar (19×19 standardmäßig)
5. "Play Online" Button ist sichtbar

**B) Board-Size wechseln:**
1. Klicke auf 9×9 Button
2. **Stats werden sofort aktualisiert** (via API)
3. Zeigt Stats für 9×9 (können unterschiedlich sein)

**C) Matchmaking:**
1. Klicke "Play Online"
2. Matchmaking funktioniert wie vorher
3. Stats bleiben sichtbar während Matchmaking

**D) Nach Spielende:**
1. Spiel beenden
2. "Zurück zum Start" klicken
3. **Stats sind aktualisiert** (via `stats_update` Event + API Refresh)

## Acceptance Criteria ✅

- ✅ Stats erscheinen sofort beim Seitenaufruf (innerhalb 1-2s)
- ✅ Board-Size-Wechsel aktualisiert Stats sofort
- ✅ Matchmaking funktioniert unabhängig von Stats
- ✅ Keine Auth-Prompts
- ✅ Guest ID persistiert über Reloads (localStorage)
- ✅ UI sieht app-ähnlich aus (Cards, Buttons, Status-Dot)

## UI-Design

**Stats Panel:**
- Zentriertes Card-Design mit Schatten
- Board-Size-Selector als Segmented Buttons
- Stats in Grid-Layout (2 Spalten)
- Connection Status mit farbigem Dot

**Matchmaking Card:**
- Separates Card für "Online Spielen"
- "Play Online" als primärer Button
- Kein Board-Size-Selector mehr (ist im Stats-Panel)

Die Stats werden jetzt sofort beim Laden angezeigt!
