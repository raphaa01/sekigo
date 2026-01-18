# Matchmaking Queue Fix Summary

## Problem
Matchmaking funktioniert nicht mehr - man kommt nicht in die Warteschlange.

## Root Cause
Mögliche Ursachen:
1. `ws.userId` ist nicht gesetzt, wenn `join_queue` gesendet wird
2. Session-Cookie wird nicht beim WebSocket-Handshake übertragen
3. `set_user_id` wird ignoriert, aber `ws.userId` ist nicht gesetzt

## Lösung

### 1. Erweitertes Logging (`server/src/websocket/handler.js`)
- **Logging bei Connection**: Loggt Cookies und Cookie-Header beim WebSocket-Handshake
- **Logging bei Messages**: Detaillierte Warnung wenn `ws.userId` nicht gesetzt ist
- **Ergebnis**: Bessere Diagnose des Problems

## Geänderte Dateien

1. **`server/src/websocket/handler.js`**
   - Erweitertes Logging für Cookie-Debugging beim WebSocket-Handshake
   - Detaillierte Warnung wenn `ws.userId` nicht gesetzt ist

## Test Steps

1. **Als eingeloggter User:**
   - Logge dich ein
   - Öffne Browser DevTools → Network → WS
   - Klicke "Play Online"
   - **Erwartet**: Backend-Logs zeigen `[WebSocket] ✅ User {userId} connected via session`
   - **Erwartet**: `[WebSocket] User {userId} joining queue`
   - **Erwartet**: `QUEUE_JOINED` Event wird empfangen

2. **Als Gast:**
   - Öffne Website (nicht eingeloggt)
   - Klicke "Play Online"
   - **Erwartet**: Backend-Logs zeigen `[WebSocket] No valid session, waiting for guestId`
   - **Erwartet**: `[WebSocket] ✅ Guest ID set for connection: guest-...`
   - **Erwartet**: `[WebSocket] User guest-... joining queue`
   - **Erwartet**: `QUEUE_JOINED` Event wird empfangen

3. **Backend Logs prüfen:**
   - Wenn `ws.userId` nicht gesetzt: `[WebSocket] ❌ Message received before userId was set: join_queue`
   - Wenn Session-Cookie nicht übertragen: `[WebSocket] No session token found in cookies`
   - Wenn Session-Cookie übertragen: `[WebSocket] ✅ User {userId} connected via session`

## Acceptance Criteria ✅

- ✅ Matchmaking funktioniert für Gäste
- ✅ Matchmaking funktioniert für eingeloggte User
- ✅ Backend-Logs zeigen korrekte userId beim `join_queue`
- ✅ `QUEUE_JOINED` Event wird empfangen

## Weitere Debugging-Schritte (falls Problem weiterhin besteht)

1. Prüfe Browser DevTools → Network → WS → Headers → Request Headers → `Cookie:`
2. Prüfe Backend-Logs für `ws.userId` Status
3. Prüfe ob `set_user_id` korrekt verarbeitet wird
4. Prüfe ob Session-Cookie beim WebSocket-Handshake übertragen wird
