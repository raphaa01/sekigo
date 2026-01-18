# 🚀 Quick Start Guide

## Schritt 1: Dependencies installieren

### Backend installieren:
```bash
cd server
npm install
```

### Frontend installieren:
```bash
cd ../web_client
npm install
```

## Schritt 2: PostgreSQL-Datenbank einrichten

### Option A: Mit psql (Windows/Linux/Mac)
```bash
# Datenbank erstellen
createdb go_platform

# Schema importieren
psql go_platform < ../db/schema.sql
```

### Option B: Mit pgAdmin oder anderem GUI
1. Erstelle eine neue Datenbank namens `go_platform`
2. Öffne die SQL-Konsole
3. Führe den Inhalt von `db/schema.sql` aus

### Option C: Ohne PostgreSQL (für erstes Testen)
- Die Datenbank-Verbindung wird beim Start fehlschlagen
- Aber der Server startet trotzdem (WebSocket funktioniert)
- Für vollständige Funktionalität wird PostgreSQL benötigt

## Schritt 3: Umgebungsvariablen konfigurieren

Erstelle eine `.env`-Datei im `server/`-Verzeichnis:

```bash
cd server
```

Erstelle die Datei `.env` mit folgendem Inhalt:

```env
PORT=3001
WS_PORT=3002

DB_HOST=localhost
DB_PORT=5432
DB_NAME=go_platform
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=your-secret-key-here-change-in-production
```

**Wichtig:** Passe `DB_USER` und `DB_PASSWORD` an deine PostgreSQL-Credentials an!

## Schritt 4: Server starten

```bash
cd server
npm start
```

Oder im Development-Modus mit Auto-Reload:
```bash
npm run dev
```

Du solltest sehen:
```
Go Platform Server running on http://localhost:3001
WebSocket server ready on ws://localhost:3002/ws
Database connection established
Matchmaking service initialized
Game manager initialized
```

## Schritt 5: Web-Client starten

Öffne ein **neues Terminal** und:

```bash
cd web_client
npm run dev
```

Du solltest sehen:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
```

## Schritt 6: Testen

1. Öffne `http://localhost:3000` im Browser
2. Du solltest die Matchmaking-Seite sehen
3. Wähle eine Brettgröße (9×9, 13×13 oder 19×19)
4. Klicke auf "Warteschlange beitreten"
5. **Für einen echten Test:** Öffne einen zweiten Browser-Tab/Incognito-Fenster und tritt ebenfalls der Warteschlange bei
6. Beide Spieler sollten automatisch gematcht werden

## 🔧 Troubleshooting

### "Database connection error"
- Prüfe, ob PostgreSQL läuft: `pg_isready`
- Prüfe die Credentials in `.env`
- Prüfe, ob die Datenbank existiert: `psql -l | grep go_platform`

### "Port already in use"
- Ändere `PORT` oder `WS_PORT` in der `.env`-Datei
- Oder beende den Prozess, der den Port belegt

### WebSocket-Verbindung schlägt fehl
- Prüfe, ob der Server läuft
- Prüfe die Browser-Konsole auf Fehler
- Prüfe, ob Firewall/Proxy WebSocket-Verbindungen blockiert

### "Cannot find module"
- Führe `npm install` in beiden Verzeichnissen aus
- Prüfe, ob `node_modules/` existiert

## 📝 Nächste Entwicklungsschritte

Nachdem das Grundgerüst läuft, sind die wichtigsten TODOs:

1. **Go-Engine vollständig implementieren:**
   - Ko-Regel
   - Selbstmord-Verbot
   - Gefangennahme von Steinen
   - Gruppen-Erkennung

2. **Datenbank-Integration:**
   - Alle `TODO: Save to database` Kommentare implementieren
   - User-Authentifizierung hinzufügen

3. **Frontend-Verbesserungen:**
   - Spielende-Screen
   - Statistik-Dashboard
   - Besseres Error-Handling

4. **Testing:**
   - Unit-Tests für Go-Engine
   - Integration-Tests für WebSocket-Events

## 🎮 Aktueller Status

✅ **Funktioniert:**
- WebSocket-Verbindung
- Matchmaking (basic)
- Board-Rendering
- Move-Submission (wird akzeptiert, aber noch nicht validiert)

⚠️ **Noch nicht implementiert:**
- Vollständige Go-Regeln (Ko, Selbstmord, etc.)
- Datenbank-Persistierung
- User-Authentifizierung
- Spielende-Logik (Scoring)
- Zeitkontrolle
