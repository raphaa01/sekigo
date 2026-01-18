# Email Column Fix Summary

## Problem behoben
- **DB-Fehler**: "null value in column "email" of relation "users" violates not-null constraint"
- Die `users` Tabelle hat eine `email` Spalte, die NOT NULL ist, aber wir versuchen keinen Wert einzufügen

## Lösung

### 1. INSERT Statement angepasst (`server/src/services/auth.js`)
- **Email-Handling**: Wenn `email` Spalte existiert, wird ein Wert gesetzt
- **Fallback**: Verwendet `username + '@go-platform.local'` als Email, wenn Spalte NOT NULL ist
- **Mehrere Fallbacks**: Behandelt verschiedene Kombinationen (mit/ohne email, mit/ohne is_guest)

### 2. SELECT Statements angepasst
- **findUserByUsername()**: Versucht alle Spalten zu selektieren, fällt zurück wenn Spalten fehlen
- **findUserById()**: Gleiche Fallback-Logik

### 3. Migration erstellt (`db/migrations/003_make_email_optional.sql`)
- **Email optional machen**: Setzt `email` Spalte auf nullable, wenn sie existiert
- **Sicher**: Prüft ob Spalte existiert, bevor sie geändert wird

## Geänderte Dateien

1. **`server/src/services/auth.js`**
   - INSERT Statement mit email-Handling
   - SELECT Statements mit email-Fallback

2. **`db/migrations/003_make_email_optional.sql`** (NEU)
   - Migration zum Optional-Machen der email Spalte

## DB-Migration ausführen

Um die `email` Spalte optional zu machen:

```sql
-- Option 1: Migration ausführen
psql -U postgres -d go_platform -f db/migrations/003_make_email_optional.sql

-- Option 2: Manuell
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
```

**Hinweis**: Der Code funktioniert auch ohne Migration (verwendet Fallback-Email), aber die Migration sollte ausgeführt werden für korrekte DB-Struktur.

## Test Steps

1. **Registrieren ohne Migration:**
   - Versuche zu registrieren
   - **Erwartet**: Erfolgreich (verwendet `username@go-platform.local` als Email)

2. **Registrieren mit Migration:**
   - Führe Migration aus
   - Versuche zu registrieren
   - **Erwartet**: Erfolgreich (email kann NULL sein)

## Acceptance Criteria ✅

- ✅ Registrieren funktioniert auch wenn `email` Spalte NOT NULL ist
- ✅ Nach Migration: `email` Spalte ist optional
- ✅ Keine "null value in column email" Fehler mehr
