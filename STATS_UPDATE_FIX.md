# Stats Update Fix Summary

## Problem
Nach einem gespielten Spiel (als angemeldeter User) zeigen die Statistiken immer noch "null spiele gespielt" an.

## Root Cause
In `gameManager.js` wurden die falschen Feldnamen verwendet:
- `getPlayerStats()` gibt `currentRating` und `currentRank` zurück
- Aber `gameManager.js` verwendete `rating` und `rank`
- Das führte dazu, dass `undefined` Werte gesendet wurden

## Lösung

### 1. GameManager (`server/src/services/gameManager.js`)
- **Fix**: Korrigiere Feldnamen in `STATS_UPDATE` Events
  - `blackStats.rating` → `blackStats.currentRating || blackStats.rating || 1500`
  - `blackStats.rank` → `blackStats.currentRank || blackStats.rank || '30k'`
  - Gleiche Fixes für `whiteStats`
  - Gleiche Fixes in `sendPlayerStats()`
- **Ergebnis**: Korrekte Stats werden nach Spielende gesendet

## Geänderte Dateien

1. **`server/src/services/gameManager.js`**
   - Korrigiere Feldnamen in `endGame()` (2 Stellen: blackStats, whiteStats)
   - Korrigiere Feldnamen in `sendPlayerStats()`
   - Füge Fallback-Werte hinzu für Sicherheit

## Test Steps

1. **Als eingeloggter User:**
   - Logge dich ein
   - Spiele ein Spiel zu Ende (z.B. 2x Pass)
   - Gehe zu "Konto" Tab
   - **Erwartet**: Stats zeigen 1 Spiel, Win/Loss entsprechend, Rating aktualisiert

2. **Backend Logs prüfen:**
   - `[Stats] Updated account stats for {userId}` sollte erscheinen
   - `STATS_UPDATE` Event sollte korrekte Werte enthalten

## Acceptance Criteria ✅

- ✅ Stats werden nach Spielende korrekt aktualisiert (DB)
- ✅ `STATS_UPDATE` Event enthält korrekte Werte
- ✅ Frontend zeigt aktualisierte Stats an
