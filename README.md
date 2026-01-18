# Go Platform - Online Go Spiel

Eine moderne Online-Go-Plattform (Weiqi/Baduk) mit Echtzeit-Multiplayer, Matchmaking und Rangsystem. Die Plattform ist zunächst als Web-Anwendung konzipiert, aber von Anfang an so entworfen, dass native iOS- und Android-Apps später dieselben Server-APIs nutzen können.

## 🎯 Produkt-Übersicht

### Features
- **Echtzeit-Multiplayer**: Spielen Sie Go gegen andere Spieler in Echtzeit über WebSockets
- **Matchmaking**: Automatisches Matching basierend auf Rating und Brettgröße
- **Flexible Brettgrößen**: Unterstützung für 9×9, 13×13 und 19×19 Bretter
- **Server-authoritative Regeln**: Alle Züge werden serverseitig validiert
- **Rangsystem**: Elo-basiertes Rating mit Kyu/Dan-Anzeige
- **Statistiken**: Tracking von Spielen, Siegen, Niederlagen und Winrate

### Geplante Features (nicht implementiert)
- KI-Analyse von Spielen
- Erweiterte Zeitkontrolle
- Turnier-Modus
- Chat-Funktion

## 🏗️ Architektur

### Technologie-Stack

**Backend:**
- Node.js mit Express
- WebSockets (ws) für Echtzeit-Kommunikation
- PostgreSQL für Datenpersistenz
- Elo-Rating-System mit Kyu/Dan-Mapping

**Frontend (Web):**
- React mit Vite
- WebSocket-Client für Echtzeit-Updates
- SVG-basierte Go-Board-Komponente

**Datenbank:**
- PostgreSQL mit strukturiertem Schema
- Automatische Statistik-Updates via Triggers

### Projektstruktur

```
goIndex/
├── server/                 # Backend-Server
│   ├── src/
│   │   ├── index.js       # Server-Einstiegspunkt
│   │   ├── websocket/      # WebSocket-Handler
│   │   ├── services/       # Business-Logik
│   │   │   ├── matchmaking.js
│   │   │   ├── gameManager.js
│   │   │   ├── goEngine.js
│   │   │   ├── rating.js
│   │   │   └── stats.js
│   │   ├── constants/      # Event-Typen
│   │   └── db/            # Datenbank-Verbindung
│   └── package.json
│
├── web_client/            # React Web-Frontend
│   ├── src/
│   │   ├── components/    # React-Komponenten
│   │   │   ├── MatchmakingView.jsx
│   │   │   ├── GameView.jsx
│   │   │   └── GoBoard.jsx
│   │   ├── services/      # WebSocket-Service
│   │   ├── constants/      # Event-Konstanten
│   │   └── App.jsx
│   └── package.json
│
└── db/                    # Datenbank-Schema
    └── schema.sql
```

## 🚀 Installation & Start

### Voraussetzungen
- Node.js (v18 oder höher)
- PostgreSQL (v12 oder höher)
- npm oder yarn

### 1. Datenbank einrichten

```bash
# PostgreSQL-Datenbank erstellen
createdb go_platform

# Schema importieren
psql go_platform < db/schema.sql
```

### 2. Backend-Server starten

```bash
cd server

# Dependencies installieren
npm install

# .env-Datei erstellen (basierend auf .env.example)
cp .env.example .env
# .env-Datei mit eigenen Datenbank-Credentials anpassen

# Server starten
npm start

# Oder im Development-Modus mit Auto-Reload
npm run dev
```

Der Server läuft standardmäßig auf:
- HTTP: `http://localhost:3001`
- WebSocket: `ws://localhost:3002/ws`

### 3. Web-Client starten

```bash
cd web_client

# Dependencies installieren
npm install

# Development-Server starten
npm run dev
```

Der Web-Client läuft auf `http://localhost:3000`

## 🔐 Authentifizierung

### Auth-Flow (MVP)

- Beim Betreten der Website wird ein Auth-Screen angezeigt.
- Optionen:
  - Einloggen (Username + Passwort)
  - Registrieren
  - Als Gast fortfahren
- Nach erfolgreichem Login/Gast-Login:
  - JWT-Token wird im `localStorage` unter `authToken` gespeichert.
  - User-Objekt wird unter `authUser` gespeichert (`id`, `username`, `isGuest`).

### Backend-Auth

- REST-Endpunkte:
  - `POST /auth/signup` – registriert einen neuen Benutzer.
  - `POST /auth/login` – loggt bestehenden Benutzer ein.
  - `POST /auth/guest` – erstellt Gast-Account.
  - `GET /auth/me` – gibt aktuellen Benutzer basierend auf JWT zurück.
- JWT:
  - Signatur: `signToken(userId)` mit `JWT_SECRET` aus `.env`.
  - Verifikation: `verifyToken(token)` für REST und WebSocket.

### Gäste vs Accounts

- Gäste:
  - `is_guest = TRUE`.
  - Kein Passwort, volle Spielfunktionalität.
  - Temporäre Usernames (z.B. `guest_xxx`).
- Accounts:
  - `is_guest = FALSE`.
  - Passwort-Hash mit `bcrypt`.
  - Eindeutiger Username.

### WebSocket-Auth

- Verbindungs-URL:

  ```
  ws://localhost:3001/ws?token=JWT_HIER
  ```

- Der Server validiert das JWT und setzt `socket.userId`.
- Client sendet keine `userId` mehr in Payloads.

### Logout

- Entfernt `authToken` und `authUser` aus `localStorage`.
- Trennt WebSocket-Verbindung.
- Navigiert zurück zum Auth-Screen.

## 📡 WebSocket API

Die Plattform nutzt WebSockets für alle Echtzeit-Kommunikation. Die API ist so gestaltet, dass sie sowohl von Web-Clients als auch von nativen Mobile-Apps verwendet werden kann.

### Verbindung
```
ws://localhost:3001/ws?token=JWT_HIER
```

### Event-Typen

#### Client → Server

**`join_queue`**
```json
{
  "type": "join_queue",
  "data": {
    "boardSize": 19,
    "timeControl": { "minutes": 10, "byoYomi": 30 }
  }
}
```

**`leave_queue`**
```json
{
  "type": "leave_queue",
  "data": {}
}
```

**`play_move`**
```json
{
  "type": "play_move",
  "data": {
    "gameId": "game_123",
    "x": 3,
    "y": 3,
    "pass": false
  }
}
```

**`resign`**
```json
{
  "type": "resign",
  "data": {
    "gameId": "game_123"
  }
}
```

#### Server → Client

**`match_found`**
```json
{
  "type": "match_found",
  "data": {
    "gameId": "game_123",
    "opponent": {
      "userId": "user_456",
      "rating": 1500
    },
    "boardSize": 19,
    "color": "black"
  }
}
```

**`move_accepted`**
```json
{
  "type": "move_accepted",
  "data": {
    "gameId": "game_123",
    "move": {
      "color": "black",
      "x": 3,
      "y": 3,
      "moveNumber": 1
    },
    "boardState": [...],
    "capturedStones": { "black": 0, "white": 0 },
    "turn": "white"
  }
}
```

**`game_ended`**
```json
{
  "type": "game_ended",
  "data": {
    "gameId": "game_123",
    "winner": "black",
    "reason": "resignation",
    "finalScore": { "black": 45.5, "white": 38.5 },
    "ratingChange": { "black": 15, "white": -15 }
  }
}
```

## 🏠 Post-Game Flow

### Screens

- `AuthScreen`:
  - Login-/Signup-Formular.
  - Button „Als Gast fortfahren“.
- `HomeScreen`:
  - Anzeige des eingeloggten Nutzers (oder „Gast“).
  - Button „Play Online“ startet Matchmaking.
- `GameScreen`:
  - Brett, Züge, Pass/Resign.
  - Empfängt `game_ended` Event.
- Endscreen:
  - Zeigt Winner, Score Black/White, Komi, Score Difference.
  - Button „Zurück zum Start“.

### Flow

1. Auth → Home.
2. Home → „Play Online“ → Matchmaking → neues Spiel.
3. Server sendet `game_ended`.
4. Client zeigt Endscreen und blockiert weitere Züge.
5. Klick auf „Zurück zum Start“:
   - Navigiert zurück zum Home-Screen.
   - Game-spezifischer Client-State wird durch Unmount bereinigt.
   - WebSocket-Verbindung für Auth bleibt bestehen.
6. Von Home kann erneut Matchmaking gestartet werden – ohne Reload der Seite.

Eine vollständige Dokumentation aller Events findet sich in `server/src/constants/events.js`.

## 📱 Mobile App Integration

Die Server-APIs sind so gestaltet, dass sie nahtlos von nativen Mobile-Apps (iOS/Android) verwendet werden können.

### Für Flutter-Apps:
```dart
// WebSocket-Verbindung
final channel = WebSocketChannel.connect(
  Uri.parse('ws://your-server.com:3002/ws')
);

// Event senden
channel.sink.add(jsonEncode({
  'type': 'join_queue',
  'data': {'boardSize': 19}
}));

// Events empfangen
channel.stream.listen((message) {
  final data = jsonDecode(message);
  // Handle event
});
```

### Für native iOS (Swift):
```swift
// WebSocket mit URLSessionWebSocketTask
let url = URL(string: "ws://your-server.com:3002/ws")!
let task = URLSession.shared.webSocketTask(with: url)
task.resume()

// Event senden
let message = URLSessionWebSocketTask.Message.string(
    """
    {
        "type": "join_queue",
        "data": {"boardSize": 19}
    }
    """
)
task.send(message) { error in
    // Handle error
}
```

### Für native Android (Kotlin):
```kotlin
// WebSocket mit OkHttp
val client = OkHttpClient()
val request = Request.Builder()
    .url("ws://your-server.com:3002/ws")
    .build()
val webSocket = client.newWebSocket(request, object : WebSocketListener() {
    override fun onMessage(webSocket: WebSocket, text: String) {
        // Handle message
    }
})

// Event senden
val message = """
    {
        "type": "join_queue",
        "data": {"boardSize": 19}
    }
""".trimIndent()
webSocket.send(message)
```

### Wichtige Hinweise für Mobile-Apps:
1. **WebSocket-Verbindung**: Nutzen Sie die gleiche WebSocket-URL wie der Web-Client
2. **Event-Format**: Alle Events verwenden das gleiche JSON-Format
3. **Reconnection**: Implementieren Sie automatische Wiederverbindung bei Verbindungsabbruch
4. **Authentication**: Aktuell noch nicht implementiert - wird später via JWT-Token hinzugefügt

## 🎮 Spielablauf

1. **Matchmaking**: Spieler wählt Brettgröße und tritt der Warteschlange bei
2. **Matching**: Server findet passenden Gegner basierend auf Rating
3. **Spielstart**: Beide Spieler erhalten Spiel-ID und ihre Farbe (Schwarz/Weiß)
4. **Zug-Validierung**: Jeder Zug wird serverseitig validiert (Regeln, Ko, Selbstmord)
5. **Spielende**: Spiel endet bei Aufgabe, Zeitüberschreitung oder beidseitigem Pass
6. **Rating-Update**: Elo-Ratings werden basierend auf Ergebnis aktualisiert

## 🗄️ Datenbank-Schema

Das Schema umfasst folgende Tabellen:
- **users**: Benutzer-Accounts
- **games**: Gespeicherte Spiele
- **moves**: Alle Züge eines Spiels
- **ratings**: Aktuelle Ratings der Spieler
- **rating_history**: Rating-Verlauf über Zeit
- **player_stats**: Statistiken (Spiele, Siege, Niederlagen, Winrate)

Details siehe `db/schema.sql`.

## 🎮 Go-Engine Implementierung

### Implementierte Regeln

Die Go-Engine implementiert vollständige server-authoritative Go-Regeln:

**✅ Implementiert:**
- **Legalitätsprüfung**: Alle Züge werden auf Gültigkeit geprüft
- **Liberties (Freiheiten)**: Gruppen-Erkennung via BFS, Liberty-Check
- **Captures (Gefangennahme)**: Automatische Entfernung von Gruppen ohne Liberties
- **Suicide-Verbot**: Züge, die nach Captures keine Liberties für die eigene Gruppe haben, werden abgelehnt
- **Ko-Regel**: Positional Superko via Zobrist Hashing
  - Verhindert Wiederholung von bereits gesehenen Board-Positionen
  - Verwendet Zobrist Hashing für effiziente Hash-Updates
  - `previousHashes` Set speichert alle bisherigen Board-Positionen
- **Pass-Handling**: Zwei aufeinanderfolgende Pässe beenden das Spiel
- **Turn-Handling**: Nur der aktuelle Spieler darf ziehen
- **Bounds-Checking**: Validierung von Koordinaten

**✅ Implementiert:**
- **Chinese Scoring (MVP)**: 
  - Automatische Score-Berechnung beim Spielende
  - Territoriums-Erkennung (einfache Fälle)
  - Komi-Berechnung (6.5 für 19×19, 0.5 für 9×9)
  - Spielende bei zwei aufeinanderfolgenden Pässen

**⚠️ MVP-Limitierungen:**
- **Seki** wird nicht erkannt (neutrale Gebiete werden ignoriert)
- Komplexe Territoriums-Fälle können ungenau sein
- Für Produktion sollte Seki-Erkennung hinzugefügt werden

### Ko-Variante

**Positional Superko** ist implementiert:
- Jede Board-Position wird via Zobrist Hash gespeichert
- Ein Zug, der eine bereits gesehene Position erzeugt, wird abgelehnt
- Stärker als Simple Ko (verhindert alle Position-Wiederholungen, nicht nur die letzte)

### Engine-Architektur

```
server/src/engine/
├── goEngine.js    # Haupt-Engine mit allen Regeln
└── zobrist.js     # Zobrist Hashing für Ko-Erkennung
```

Die Engine wird über `server/src/services/goEngine.js` (Wrapper) verwendet, der die Kompatibilität mit `gameManager.js` sicherstellt.

## 🔧 Entwicklung

### TODO-Liste (Implementierung noch ausstehend)

**Go-Engine:**
- [x] Vollständige Go-Regeln implementieren (Ko, Selbstmord, Gefangennahme)
- [x] Gruppen-Erkennung und Liberty-Check
- [ ] Endspiel-Scoring
- [ ] Seki-Erkennung

**Backend:**
- [ ] Datenbank-Integration vollständig implementieren
- [ ] JWT-Authentifizierung
- [ ] Zeitkontrolle implementieren
- [ ] Reconnection-Handling verbessern

**Frontend:**
- [ ] Spielende-Screen mit Ergebnissen
- [ ] Statistik-Dashboard
- [ ] Leaderboard
- [ ] Responsive Design für Mobile

**Mobile:**
- [ ] Flutter-App erstellen
- [ ] Native iOS-App erstellen
- [ ] Native Android-App erstellen

## 📝 Lizenz

MIT License

## 🤝 Beitragen

Dies ist ein Scaffold-Projekt. Beiträge sind willkommen! Bitte beachten Sie:
- Code sollte gut kommentiert sein
- TODOs markieren ausstehende Features
- WebSocket-Events müssen mit Server synchronisiert bleiben

---

**Hinweis**: Dies ist ein Grundgerüst (Scaffold). Viele Features sind als Platzhalter implementiert und müssen noch vollständig ausgebaut werden. Die Architektur ist jedoch so gestaltet, dass sie leicht erweiterbar ist.
