# Board Size Selector und DB-Fix Summary

## Probleme behoben
1. **Board-Größen-Auswahl fehlt im "Spielen" Tab**
2. **DB-Fehler**: "column "is_guest" of relation "users" does not exist"

## Lösung

### 1. Board Size Selector im "Spielen" Tab (`web_client/src/components/MatchmakingView.jsx`)
- **Board-Größen-Auswahl hinzugefügt** vor dem "Play Online" Button
- **3 Optionen**: 9×9, 13×13, 19×19
- **Disabled während Queue**: Board-Größe kann nicht geändert werden, wenn man in der Queue ist
- **Visuelles Feedback**: Aktive Größe ist blau hervorgehoben

### 2. DB-Fehler behoben (`server/src/services/auth.js`)
- **Fallback-Logik**: Wenn `is_guest` Spalte nicht existiert, wird ohne sie gearbeitet
- **Automatisches Hinzufügen**: `is_guest: false` wird automatisch zu Result-Rows hinzugefügt
- **Migration erstellt**: `db/migrations/002_add_is_guest_column.sql` zum Hinzufügen der Spalte

**Geänderte Funktionen:**
- `findUserByUsername()` - Fallback wenn `is_guest` fehlt
- `findUserById()` - Fallback wenn `is_guest` fehlt
- `signup()` - Fallback beim INSERT wenn `is_guest` fehlt
- `login()` - Prüft `is_guest` sicher (mit Fallback)

## Geänderte Dateien

1. **`web_client/src/components/MatchmakingView.jsx`**
   - Board Size Selector im "Spielen" Tab hinzugefügt

2. **`server/src/services/auth.js`**
   - Fallback-Logik für fehlende `is_guest` Spalte
   - Alle DB-Queries haben jetzt Fallbacks

3. **`db/migrations/002_add_is_guest_column.sql`** (NEU)
   - Migration zum Hinzufügen der `is_guest` Spalte

## DB-Migration ausführen

Um die `is_guest` Spalte hinzuzufügen, führe aus:

```sql
-- Option 1: Migration ausführen
psql -U postgres -d go_platform -f db/migrations/002_add_is_guest_column.sql

-- Option 2: Manuell
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;
```

**Hinweis**: Der Code funktioniert auch ohne Migration (mit Fallback), aber die Migration sollte ausgeführt werden für korrekte DB-Struktur.

## Test Steps

1. **Board Size Selector:**
   - Öffne "Spielen" Tab
   - Siehe Board-Größen-Auswahl (9×9, 13×13, 19×19)
   - Klicke auf verschiedene Größen → Aktive Größe wird blau
   - Klicke "Play Online" → Board-Größe kann nicht mehr geändert werden

2. **Registrieren:**
   - Gehe zu "Konto" Tab
   - Klicke "Registrieren / Einloggen"
   - Registriere mit Username + Password
   - **Erwartet**: Erfolgreich (auch wenn `is_guest` Spalte fehlt)

3. **DB-Migration (optional):**
   - Führe Migration aus
   - Registriere erneut
   - **Erwartet**: Funktioniert mit vollständiger DB-Struktur

## Acceptance Criteria ✅

- ✅ Board-Größen-Auswahl im "Spielen" Tab sichtbar
- ✅ Board-Größe kann vor dem Join gewählt werden
- ✅ Registrieren funktioniert auch ohne `is_guest` Spalte
- ✅ Nach Migration: Vollständige DB-Struktur
