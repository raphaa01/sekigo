# Scoring Guide - Chinese Scoring MVP

## Übersicht

Das Go-Platform verwendet **Chinese Scoring (Area Scoring)** als MVP-Implementierung.

## Wie Scoring funktioniert

### Chinese Scoring Formel

```
Punkte = (Steine auf Brett) + (Territorium)
```

- **Steine auf Brett**: Anzahl der eigenen Steine, die noch auf dem Brett sind
- **Territorium**: Leere Felder, die eindeutig von einer Farbe umschlossen sind
- **Komi**: Wird zu Weiß addiert (6.5 für 19×19, 0.5 für 9×9)

### Beispiel

```
Black: 45 Steine + 12 Territorium = 57 Punkte
White: 38 Steine + 15 Territorium + 6.5 Komi = 59.5 Punkte
→ White gewinnt mit 2.5 Punkten
```

## Spielende

Das Spiel endet automatisch, wenn:
- Beide Spieler nacheinander passen (zwei aufeinanderfolgende Pässe)

Nach dem Spielende:
1. Server berechnet automatisch den Score
2. `game_end` Event wird an beide Clients gesendet
3. Frontend zeigt Endscreen mit Ergebnis

## MVP-Limitierungen

### Was funktioniert:
- ✅ Einfache Territoriums-Erkennung (nur eine Farbe berührt)
- ✅ Komi-Berechnung
- ✅ Gewinner-Bestimmung

### Was nicht funktioniert (für später):
- ❌ **Seki**: Neutrale Gebiete werden ignoriert
- ❌ **Komplexe Territoriums-Fälle**: Wenn beide Farben ein Gebiet berühren, wird es als neutral behandelt
- ❌ **Life/Death-Analyse**: Tote Steine werden nicht automatisch entfernt

### Beispiel für Limitierung

```
[. . .]
[. B W]
[. . .]
```

Dieses Gebiet wird als **neutral** behandelt, da beide Farben es berühren. In der Realität könnte es zu einer Farbe gehören, je nach Kontext.

## Testing

### Scoring testen:

1. **Einfaches Spiel:**
   - Spiele ein kurzes Spiel (9×9 empfohlen)
   - Beide Spieler passen nacheinander
   - Endscreen sollte Score anzeigen

2. **Komi testen:**
   - Spiele ein 19×19 Spiel
   - Beide passen sofort
   - White sollte 6.5 Punkte mehr haben als Black (bei gleicher Anzahl Steine)

3. **Territorium testen:**
   - Erstelle ein einfaches Territorium (z.B. 3×3 Bereich)
   - Umzingle es mit einer Farbe
   - Beide passen
   - Territorium sollte zu der umzingelnden Farbe zählen

## Zukünftige Verbesserungen

1. **Seki-Erkennung**: Identifiziere neutrale Gebiete korrekt
2. **Life/Death**: Entferne tote Steine automatisch
3. **Territory-Markierung**: Zeige Territorium visuell im Frontend
4. **Japanese Scoring**: Alternative Scoring-Methode als Option
