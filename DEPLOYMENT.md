# SekiGo - Kostenloses Hosting Guide

## Übersicht

Diese Anleitung zeigt, wie du SekiGo kostenlos hostest:
- **Backend**: Render.com (kostenlos)
- **Frontend**: Vercel.com (kostenlos)
- **Datenbank**: Neon.tech (kostenlos, PostgreSQL)

---

## Schritt 1: Datenbank einrichten (Neon.tech)

1. Gehe zu [neon.tech](https://neon.tech) und erstelle einen kostenlosen Account
2. Erstelle ein neues Projekt
3. Kopiere die **Connection String** (sieht aus wie: `postgresql://user:password@host/database`)
4. **Wichtig**: Füge `?sslmode=require` am Ende hinzu

### Migration ausführen

1. Verbinde dich mit deiner Neon-Datenbank (z.B. mit DBeaver, pgAdmin, oder `psql`)
2. Führe die Migrationen in dieser Reihenfolge aus:
   - `db/migrations/001_add_board_size_to_ratings_stats.sql`
   - `db/migrations/002_unified_user_key.sql` (falls vorhanden)
   - `db/migrations/003_guest_stats_ratings.sql`
   - `db/migrations/004_fix_schema_for_leaderboard.sql`

Oder führe `db/schema.sql` aus, wenn du eine frische Datenbank hast.

---

## Schritt 2: Backend auf Render.com hosten

### 2.1 Repository vorbereiten

1. Erstelle ein GitHub Repository und pushe deinen Code
2. Stelle sicher, dass `server/package.json` ein `start` Script hat

### 2.2 Render Service erstellen

1. Gehe zu [render.com](https://render.com) und erstelle einen Account
2. Klicke auf **"New +"** → **"Web Service"**
3. Verbinde dein GitHub Repository
4. Konfiguration:
   - **Name**: `sekigo-backend` (oder wie du willst)
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Root Directory**: `/server` (wichtig!)

### 2.3 Umgebungsvariablen setzen

In Render, gehe zu **Environment** und füge hinzu:

```
NODE_ENV=production
PORT=10000
DB_HOST=your-neon-host.neon.tech
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
JWT_SECRET=dein-super-geheimer-jwt-secret-min-32-zeichen
FRONTEND_URL=https://deine-vercel-app.vercel.app
```

**Wichtig**: 
- `PORT` sollte `10000` sein (Render Standard)
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` kommen von deiner Neon Connection String
- `JWT_SECRET` sollte ein langer, zufälliger String sein (mindestens 32 Zeichen)

### 2.4 Backend URL notieren

Nach dem Deploy erhältst du eine URL wie: `https://sekigo-backend.onrender.com`

---

## Schritt 3: Frontend auf Vercel.com hosten

### 3.1 Vercel Service erstellen

1. Gehe zu [vercel.com](https://vercel.com) und erstelle einen Account
2. Klicke auf **"Add New..."** → **"Project"**
3. Importiere dein GitHub Repository
4. Konfiguration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `web_client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3.2 Umgebungsvariablen setzen

In Vercel, gehe zu **Settings** → **Environment Variables** und füge hinzu:

```
VITE_API_BASE=https://sekigo-backend.onrender.com
VITE_WS_URL=wss://sekigo-backend.onrender.com
```

**Wichtig**: 
- Verwende `https://` für API (nicht `http://`)
- Verwende `wss://` für WebSocket (nicht `ws://`)

### 3.3 Vite Config anpassen

Stelle sicher, dass `web_client/vite.config.js` für Production konfiguriert ist:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_WS_URL || 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
```

---

## Schritt 4: CORS und WebSocket konfigurieren

### Backend CORS anpassen

In `server/src/index.js`, stelle sicher, dass CORS die Vercel-URL erlaubt:

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5173',
    ].filter(Boolean);
    
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true); // In Production alle Origins erlauben
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
```

---

## Schritt 5: WebSocket URL im Frontend

Stelle sicher, dass `web_client/src/services/websocket.js` die Production-URL verwendet:

```javascript
export function getWebSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // Production: Verwende die aktuelle Domain für WebSocket
  if (window.location.protocol === 'https:') {
    const wsUrl = window.location.hostname.includes('vercel.app')
      ? 'wss://sekigo-backend.onrender.com/ws'
      : `wss://${window.location.hostname}/ws`;
    return wsUrl;
  }
  
  // Development
  return 'ws://localhost:3001/ws';
}
```

---

## Schritt 6: Deploy und Testen

1. **Backend deployen**: Render startet automatisch nach jedem Git Push
2. **Frontend deployen**: Vercel startet automatisch nach jedem Git Push
3. **Testen**: 
   - Öffne deine Vercel-URL
   - Teste Login/Registrierung
   - Teste Matchmaking
   - Teste ein Spiel

---

## Kostenlose Limits

### Render (Backend)
- ✅ Kostenloser Tier verfügbar
- ⚠️ Service schläft nach 15 Minuten Inaktivität (erste Anfrage dauert ~30 Sekunden)
- 💡 Upgrade auf "Starter" ($7/Monat) für immer-on Service

### Vercel (Frontend)
- ✅ Vollständig kostenlos für persönliche Projekte
- ✅ Unbegrenzte Deployments
- ✅ Automatisches SSL

### Neon (Datenbank)
- ✅ Kostenloser Tier: 0.5 GB Storage, 1 Projekt
- ✅ Perfekt für kleine bis mittlere Projekte

---

## Alternative Optionen

### Option 2: Railway.app (All-in-One)

Railway kann Backend, Frontend und Datenbank hosten:

1. Gehe zu [railway.app](https://railway.app)
2. Erstelle ein neues Projekt
3. Füge Services hinzu:
   - PostgreSQL Database
   - Backend (Node.js)
   - Frontend (Static Site)

**Vorteil**: Alles an einem Ort  
**Nachteil**: Kostenloser Tier hat Limits (kostenloses Guthaben pro Monat)

### Option 3: Fly.io

1. Gehe zu [fly.io](https://fly.io)
2. Installiere `flyctl`
3. Deploy Backend und Frontend als separate Apps

**Vorteil**: Sehr flexibel  
**Nachteil**: Etwas komplexer zu setup

---

## Troubleshooting

### Backend startet nicht
- Prüfe Logs in Render Dashboard
- Stelle sicher, dass `PORT` auf `10000` gesetzt ist
- Prüfe, ob alle Environment Variables gesetzt sind

### WebSocket Verbindung fehlschlägt
- Stelle sicher, dass `VITE_WS_URL` mit `wss://` beginnt (nicht `ws://`)
- Prüfe CORS Einstellungen im Backend

### Datenbank Verbindung fehlschlägt
- Prüfe, ob `?sslmode=require` in der Connection String ist
- Stelle sicher, dass Neon IP Whitelist aktiviert ist (oder deaktiviert für alle IPs)

### Frontend kann Backend nicht erreichen
- Prüfe `VITE_API_BASE` Environment Variable
- Stelle sicher, dass CORS die Vercel-URL erlaubt

---

## Nützliche Links

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Railway Documentation](https://docs.railway.app)

---

## Support

Bei Problemen:
1. Prüfe die Logs in Render/Vercel Dashboard
2. Teste die API direkt: `https://sekigo-backend.onrender.com/api/stats`
3. Prüfe Browser Console für Frontend-Fehler
