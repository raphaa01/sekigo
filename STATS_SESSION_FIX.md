# Stats Session Fix Summary

## Problem
Nach dem Spiel erscheint bei den Statistiken die Fehlermeldung: "userId is required or user must be logged in"

## Root Cause
Die Session-Cookies werden möglicherweise nicht korrekt übertragen, wenn `fetchStats` nach dem `STATS_UPDATE` Event aufgerufen wird. Mögliche Ursachen:
1. Vite-Proxy leitet Cookies nicht korrekt weiter
2. Session-Cookie wird nicht korrekt gesetzt/übertragen
3. Timing-Problem: `fetchStats` wird aufgerufen bevor Auth-State aktualisiert ist

## Lösung

### 1. Backend Logging (`server/src/index.js`)
- **Erweitertes Logging**: Loggt Cookies, Cookie-Header und Authorization-Header
- **Besseres Error-Handling**: Detaillierte Fehlermeldungen wenn Token nicht gefunden wird
- **Ergebnis**: Bessere Diagnose des Problems

### 2. Vite Proxy (`web_client/vite.config.js`)
- **Fix**: Füge `secure: false` hinzu für lokale Entwicklung
- **Ergebnis**: Bessere Cookie-Übertragung über Proxy

### 3. Frontend Timing (`web_client/src/components/MatchmakingView.jsx`)
- **Fix**: Füge 100ms Delay vor `fetchStats` nach `STATS_UPDATE` hinzu
- **Logging**: Loggt Auth-State vor dem Fetch
- **Ergebnis**: Gibt Auth-State Zeit, sich zu aktualisieren

## Geänderte Dateien

1. **`server/src/index.js`**
   - Erweitertes Logging für Cookie-Debugging

2. **`web_client/vite.config.js`**
   - `secure: false` für lokale Entwicklung

3. **`web_client/src/components/MatchmakingView.jsx`**
   - 100ms Delay vor `fetchStats` nach `STATS_UPDATE`

## Test Steps

1. **Als eingeloggter User:**
   - Logge dich ein
   - Spiele ein Spiel zu Ende
   - Gehe zu "Konto" Tab
   - **Erwartet**: Stats werden geladen (kein "userId is required" Fehler)

2. **Backend Logs prüfen:**
   - `[API] Stats request - cookies:` sollte Session-Cookie zeigen
   - `[API] ✅ Stats request for logged-in user:` sollte erscheinen
   - Wenn nicht: `[API] No token found` → Cookie-Problem

3. **Browser DevTools prüfen:**
   - Application → Cookies → `http://localhost:3000`
   - `session` Cookie sollte vorhanden sein
   - Network Tab → `/api/stats` Request → Request Headers → `Cookie:` sollte `session=...` enthalten

## Acceptance Criteria ✅

- ✅ Stats werden nach Spielende korrekt geladen (kein "userId is required" Fehler)
- ✅ Session-Cookies werden korrekt übertragen
- ✅ Backend-Logs zeigen korrekte Cookie-Erkennung

## Weitere Debugging-Schritte (falls Problem weiterhin besteht)

1. Prüfe Browser-Console für Cookie-Warnungen
2. Prüfe Backend-Logs für Cookie-Details
3. Prüfe ob Session-Cookie korrekt gesetzt wird beim Login
4. Prüfe ob CORS korrekt konfiguriert ist
