# Auth UI Implementation Summary

## Problem behoben
- Keine sichtbare Login/Register/Gast UI auf der Website
- Auth-Backend existiert, aber Frontend zeigt keine Möglichkeit zum Einloggen

## Lösung

### 1. Auth Service (`web_client/src/services/auth.js`)
- **Cookie-basierte Requests**: Alle Requests verwenden `credentials: 'include'`
- **Endpunkte:**
  - `getCurrentUser()` → `GET /api/auth/me`
  - `register()` → `POST /api/auth/register`
  - `login()` → `POST /api/auth/login`
  - `logout()` → `POST /api/auth/logout`

### 2. Auth Context (`web_client/src/App.jsx`)
- **AuthContext**: Globaler Auth-State für die gesamte App
- **Auth State**: `{ loading, loggedIn, user }`
- **refreshAuth()**: Funktion zum Aktualisieren des Auth-States
- **Auto-Load**: Lädt Auth-State beim App-Start

### 3. Auth Modal (`web_client/src/components/AuthModal.jsx`)
- **Tabs**: "Einloggen" und "Registrieren"
- **Inputs**: Username, Password
- **Buttons:**
  - "Einloggen" / "Konto erstellen" → Ruft Backend auf
  - "Als Gast fortfahren" → Schließt Modal (keine Aktion)
- **Error Handling**: Zeigt Fehlermeldungen inline
- **Loading State**: Zeigt "Bitte warten..." während Request

### 4. MatchmakingView Updates (`web_client/src/components/MatchmakingView.jsx`)
- **Auth Header**: Zeigt oben "Eingeloggt als <username>" oder "Gast-Modus"
- **"Profil / Login" Button**: Öffnet AuthModal (wenn nicht eingeloggt)
- **"Abmelden" Button**: Logout-Funktion (wenn eingeloggt)
- **Stats Refresh**: Lädt Stats nach Login/Logout neu
- **fetchStats**: Unterstützt sowohl Account (Session) als auch Guest (userId param)

## Geänderte Dateien

1. **`web_client/src/services/auth.js`** (komplett neu geschrieben)
   - Cookie-basierte Requests
   - `getCurrentUser()`, `register()`, `login()`, `logout()`

2. **`web_client/src/App.jsx`**
   - AuthContext hinzugefügt
   - Auto-Load Auth-State beim Start

3. **`web_client/src/components/AuthModal.jsx`** (NEU)
   - Modal-Komponente mit Login/Register/Gast

4. **`web_client/src/components/AuthModal.css`** (NEU)
   - Styling für Modal

5. **`web_client/src/components/MatchmakingView.jsx`**
   - Auth Header hinzugefügt
   - AuthModal Integration
   - Stats Refresh nach Auth-Änderungen

## Verwendete Endpunkte

- `GET /api/auth/me` - Aktuellen User abrufen
- `POST /api/auth/register` - Konto erstellen
- `POST /api/auth/login` - Einloggen
- `POST /api/auth/logout` - Abmelden
- `GET /api/stats` - Stats abrufen (mit Session-Cookie oder userId param)

## Test Steps

### 1. Guest Flow (Standard):
1. Öffne `http://localhost:3000`
2. Siehe "Gast-Modus" + "Profil / Login" Button
3. Klicke "Profil / Login"
4. Klicke "Als Gast fortfahren"
5. Modal schließt, App bleibt spielbar

### 2. Register Flow:
1. Klicke "Profil / Login"
2. Wähle Tab "Registrieren"
3. Eingabe: Username (min 3 Zeichen), Password (min 6 Zeichen)
4. Klicke "Konto erstellen"
5. **Erwartet**: Modal schließt, Header zeigt "Eingeloggt als <username>"
6. Stats werden neu geladen (Account-Stats)

### 3. Login Flow:
1. Klicke "Profil / Login"
2. Wähle Tab "Einloggen"
3. Eingabe: Username + Password
4. Klicke "Einloggen"
5. **Erwartet**: Modal schließt, Header zeigt "Eingeloggt als <username>"
6. Stats werden neu geladen (Account-Stats)

### 4. Logout Flow:
1. Wenn eingeloggt: Klicke "Abmelden"
2. **Erwartet**: Header zeigt wieder "Gast-Modus" + "Profil / Login" Button
3. Stats werden neu geladen (Guest-Stats)

### 5. Error Handling:
1. Register mit bereits existierendem Username
2. **Erwartet**: Fehlermeldung "Username already taken"
3. Login mit falschem Passwort
4. **Erwartet**: Fehlermeldung "Invalid credentials"

## Acceptance Criteria ✅

- ✅ Website zeigt sichtbaren "Profil / Login" Button
- ✅ Klick öffnet Modal mit Login/Register/Gast
- ✅ Guest Flow funktioniert (Modal schließen, weiter spielen)
- ✅ Login ändert UI zu "Eingeloggt als ..." + Logout Button
- ✅ Keine Seite wird durch Auth blockiert (Auth ist optional)

## Design

- **Modal**: Zentriert, weißer Hintergrund, abgerundete Ecken
- **Tabs**: Unterstreichung für aktiven Tab
- **Buttons**: Moderne Farben (#3498db), Hover-Effekte
- **Error Messages**: Rote Box mit Fehlermeldung
- **Loading State**: Button zeigt "Bitte warten..." während Request
