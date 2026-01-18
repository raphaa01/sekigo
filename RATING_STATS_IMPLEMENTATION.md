# Rating & Stats Implementation - Summary

## Status: ✅ Vollständig implementiert

Rating- und Stats-System ist implementiert mit Elo-ähnlichem System pro Board-Größe.

## Implementierung

### Backend

**1. Rating Service (`server/src/services/rating.js`):**
- **Pro Board-Größe Rating**: Jeder Spieler hat separate Ratings für 9×9, 13×13, 19×19
- **Elo-Update**: `R_new = R_old + K*(S - E)`
  - `S`: 1 für Sieg, 0.5 für Unentschieden, 0 für Niederlage
  - `E`: `1/(1+10^((opp-old)/400))` (Expected Score)
  - `K`: 24 wenn games_played < 30, sonst 16
- **Kyu/Dan Mapping**: Rating → Rank (z.B. 1500 → "1d", 1200 → "1k")
- **In-Memory Storage**: Für MVP (keine DB)

**2. Stats Service (`server/src/services/stats.js`):**
- **Stats pro Board-Größe**: Separate Stats für jede Board-Größe
- **Tracked Stats**:
  - `gamesPlayed`: Anzahl gespielter Spiele
  - `wins`: Siege
  - `losses`: Niederlagen
  - `draws`: Unentschieden
  - `winRate`: Winrate in Prozent
  - `highestRating`: Höchstes Rating erreicht
- **In-Memory Storage**: Für MVP

**3. Game Manager Integration (`server/src/services/gameManager.js`):**
- **Beim Spielende**:
  - Alle Spiele sind rated (MVP)
  - Ratings werden für beide Spieler aktualisiert
  - Stats werden für beide Spieler aktualisiert
  - `stats_update` Event wird an beide Spieler gesendet

**4. WebSocket Handler (`server/src/websocket/handler.js`):**
- `REQUEST_STATS` Handler hinzugefügt
- Sendet Stats für angeforderte Board-Größe

### Frontend

**1. MatchmakingView (Home Screen) (`web_client/src/components/MatchmakingView.jsx`):**
- **Player Panel**: Zeigt Stats für aktuelle Board-Größe
  - Rang (Kyu/Dan)
  - Rating (Zahl)
  - Spiele (W/L/D)
  - Winrate
- **Stats Update Handler**: Empfängt `stats_update` Events und aktualisiert UI
- **Board-Size-Wechsel**: Requested Stats beim Wechsel der Board-Größe

**2. Event Types (`web_client/src/constants/events.js`):**
- `STATS_UPDATE` hinzugefügt
- `REQUEST_STATS` hinzugefügt

### Tests

**1. `server/tests/rating.test.js`:**
- ✅ Rating-to-Rank Mapping
- ✅ Rating Updates (Win/Loss/Draw)
- ✅ K-Factor basierend auf games_played
- ✅ Pro Board-Größe Ratings

**2. `server/tests/stats.test.js`:**
- ✅ Stats Recording (Win/Loss/Draw)
- ✅ Winrate Berechnung
- ✅ Highest Rating Tracking
- ✅ Pro Board-Größe Stats

## Rated vs Casual Games

**MVP: Alle Spiele sind rated**
- Keine Unterscheidung zwischen rated/casual
- Alle Spiele aktualisieren Rating und Stats
- Keine Bots (alle Spiele sind human vs human)

**Zukünftige Erweiterung:**
- `game.rated` Flag könnte hinzugefügt werden
- Bots könnten als `rated=false` markiert werden
- Casual Games könnten Stats separat tracken

## Geänderte Dateien

1. **`server/src/services/rating.js`**
   - Pro Board-Größe Rating Storage
   - K-Factor basierend auf games_played
   - In-Memory Storage für MVP

2. **`server/src/services/stats.js`**
   - Pro Board-Größe Stats Storage
   - Vollständige Stats-Tracking
   - In-Memory Storage für MVP

3. **`server/src/services/gameManager.js`**
   - Rating/Stats Updates beim Spielende
   - `stats_update` Event Broadcasting
   - `sendPlayerStats()` Methode

4. **`server/src/websocket/handler.js`**
   - `REQUEST_STATS` Handler

5. **`server/src/constants/events.js`**
   - `STATS_UPDATE` Event
   - `REQUEST_STATS` Event

6. **`web_client/src/components/MatchmakingView.jsx`**
   - Player Panel mit Stats-Anzeige
   - Stats Update Handler
   - Board-Size-Wechsel Handler

7. **`web_client/src/constants/events.js`**
   - `STATS_UPDATE` Event
   - `REQUEST_STATS` Event

8. **`server/tests/rating.test.js`** (NEU)
   - Rating-Tests

9. **`server/tests/stats.test.js`** (NEU)
   - Stats-Tests

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

### 3. Rating/Stats testen:

**A) Erstes Spiel:**
1. Öffne 2 Tabs (normal + Inkognito)
2. Beide Tabs: `http://localhost:3000`
3. Tab 1: Board-Größe wählen (z.B. 19×19)
4. Tab 1: Player Panel sollte zeigen: "Noch keine Statistiken"
5. Tab 1: "Warteschlange beitreten"
6. Tab 2: Gleiche Board-Größe, "Warteschlange beitreten"
7. Match finden → Spiel startet

**B) Spiel beenden:**
1. Beide Spieler passen nacheinander
2. Game End Modal erscheint
3. "Zurück zum Start" klicken
4. **Erwartetes Ergebnis:**
   - Player Panel zeigt jetzt Stats:
     - Rang: z.B. "1d" oder "1k"
     - Rating: z.B. 1500 (oder geändert)
     - Spiele: 1
     - W/L/D: 1/0/0 oder 0/1/0
     - Winrate: 100% oder 0%

**C) Zweites Spiel:**
1. Nochmal match finden
2. Spiel beenden
3. **Erwartetes Ergebnis:**
   - Stats aktualisiert:
     - Spiele: 2
     - W/L/D aktualisiert
     - Winrate neu berechnet

**D) Board-Größe wechseln:**
1. Board-Größe auf 9×9 ändern
2. **Erwartetes Ergebnis:**
   - Player Panel zeigt: "Noch keine Statistiken für 9×9"
   - (Stats sind pro Board-Größe getrennt)

### 4. Tests ausführen:
```powershell
cd server
npm test -- rating.test.js
npm test -- stats.test.js
```

## Erwartetes Verhalten

- ✅ Ratings werden pro Board-Größe gespeichert
- ✅ K-Factor ist 24 für neue Spieler (< 30 Spiele), 16 für etablierte
- ✅ Stats werden korrekt aktualisiert (W/L/D, Winrate)
- ✅ Player Panel zeigt Stats für aktuelle Board-Größe
- ✅ Stats werden nach Spielende aktualisiert
- ✅ "Zurück zum Start" zeigt aktualisierte Stats
- ✅ Guest Identity funktioniert (userId aus sessionStorage)

## Beispiel-Rating-Updates

**Spieler 1 (1500) vs Spieler 2 (1500):**
- Beide gleich stark → Expected Score = 0.5 für beide
- Spieler 1 gewinnt:
  - Spieler 1: 1500 + 24*(1 - 0.5) = **1512** (+12)
  - Spieler 2: 1500 + 24*(0 - 0.5) = **1488** (-12)

**Spieler 1 (1600) vs Spieler 2 (1400):**
- Spieler 1 stärker → Expected Score ≈ 0.76 für Spieler 1
- Spieler 1 gewinnt:
  - Spieler 1: 1600 + 16*(1 - 0.76) = **1604** (+4)
  - Spieler 2: 1400 + 24*(0 - 0.24) = **1394** (-6)

Rating & Stats System ist vollständig implementiert!
