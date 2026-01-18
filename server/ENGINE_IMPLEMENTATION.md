# Go Engine Implementation

## Übersicht

Die vollständige server-authoritative Go-Regellogik ist implementiert.

## Implementierte Features

### ✅ Vollständig implementiert

1. **Legalitätsprüfung**
   - Bounds-Checking (Koordinaten innerhalb des Bretts)
   - Occupied-Check (Feld muss leer sein)
   - Turn-Check (nur aktueller Spieler darf ziehen)

2. **Liberties & Groups**
   - BFS-basierte Gruppen-Erkennung
   - Liberty-Check für Gruppen
   - Automatische Gefangennahme von Gruppen ohne Liberties

3. **Suicide-Verbot**
   - Prüft, ob ein Zug nach Captures noch Liberties für die eigene Gruppe hat
   - Züge ohne Liberties werden abgelehnt (außer sie fangen Steine)

4. **Ko-Regel (Positional Superko)**
   - Zobrist Hashing für effiziente Hash-Updates
   - `previousHashes` Set speichert alle bisherigen Board-Positionen
   - Verhindert Wiederholung von bereits gesehenen Positionen
   - Stärker als Simple Ko

5. **Pass-Handling**
   - Zwei aufeinanderfolgende Pässe beenden das Spiel
   - `consecutivePasses` wird nach regulären Zügen zurückgesetzt

6. **Move Application**
   - Vollständige Board-Updates
   - Capture-Tracking
   - Hash-Updates für Ko-Erkennung
   - Turn-Wechsel

## Architektur

```
server/src/engine/
├── goEngine.js    # Haupt-Engine-Klasse
└── zobrist.js     # Zobrist Hashing für Ko-Erkennung

server/src/services/
└── goEngine.js    # Wrapper für Kompatibilität mit gameManager
```

## API

### GoEngine Klasse

```javascript
// Spiel erstellen
engine.createGameState(gameId, boardSize, komi?)

// Legalitätsprüfung
engine.isLegalMove(gameId, x, y, color) -> { ok: boolean, reason?: string }

// Zug anwenden
engine.applyMove(gameId, x, y, color) -> { state, captures, newHash }

// Pass
engine.passMove(gameId, color) -> { state, ended: boolean }

// Aktueller Spieler
engine.getCurrentPlayer(gameId) -> 'black' | 'white'

// Spielzustand abrufen
engine.getGameState(gameId) -> GameState | null
```

### Fehlercodes (move_rejected)

- `game_not_found`: Spiel existiert nicht
- `invalid_coordinates`: Koordinaten außerhalb des Bretts
- `position_occupied`: Feld bereits besetzt
- `not_your_turn`: Nicht am Zug
- `suicide_move`: Selbstmord-Zug (keine Liberties nach Captures)
- `ko_violation`: Ko-Verletzung (Position wurde bereits gesehen)

## Ko-Variante: Positional Superko

**Implementiert:** Positional Superko

- Jede Board-Position wird via Zobrist Hash gespeichert
- Ein Zug, der eine bereits gesehene Position erzeugt, wird abgelehnt
- Stärker als Simple Ko (verhindert alle Position-Wiederholungen)

**Alternative (nicht implementiert):**
- Simple Ko: Nur die letzte Position wird gespeichert
- Situational Superko: Nur Positionen mit gleicher Spieler-Reihenfolge

## Scoring (Chinese Scoring - MVP)

**Implementiert:**
- **Chinese Scoring (Area Scoring)**: 
  - Punkte = (Steine auf Brett) + (Territorium)
  - Territorium = leere Felder, die nur von einer Farbe berührt werden
  - Komi wird zu Weiß addiert (6.5 für 19×19, 0.5 für 9×9)
- **Spielende**: Zwei aufeinanderfolgende Pässe beenden das Spiel
- **Automatische Score-Berechnung** beim Spielende

**Hinweis (MVP-Limitierungen):**
- **Seki** wird nicht erkannt (neutrale Gebiete werden ignoriert)
- **Life/Death** wird nicht analysiert
- Komplexe Territoriums-Fälle können ungenau sein
- Für Produktion sollte Seki-Erkennung hinzugefügt werden

## Noch nicht implementiert

- **Seki-Erkennung**: Für korrektes Scoring in komplexen Fällen
- **Life/Death-Erkennung**: Für Endspiel-Analyse
- **Territory-Markierung**: Visuelle Anzeige von Territorium im Frontend
- **Handicap-Steine**: Für ungleiche Spielstärken

## Testing

Unit-Tests befinden sich in `server/tests/engine.rules.test.js`:

```bash
cd server
npm test
```

Tests decken ab:
- Einfache Captures
- Suicide-Verbot
- Ko-Regel
- Pass-Handling
- Legal Move Validation

## Integration

Die Engine ist vollständig in den WebSocket-Flow integriert:

1. Client sendet `play_move` Event
2. `gameManager.handleMove()` prüft Spiel-Status und Turn
3. `goEngine.isLegalMove()` prüft Legalität
4. Bei Legal: `goEngine.applyMove()` wendet Zug an
5. `move_accepted` wird an beide Clients gesendet
6. Bei Illegal: `move_rejected` mit Grund wird gesendet

## Performance

- Zobrist Hashing: O(1) Hash-Updates (nur betroffene Positionen)
- Gruppen-Erkennung: O(n) mit n = Anzahl Steine in Gruppe
- Ko-Check: O(1) Set-Lookup

Für typische Spiele (9×9 bis 19×19) ist die Performance ausreichend.
