# Go Platform Server

Backend-Server für die Go-Plattform.

## Umgebungsvariablen

Erstellen Sie eine `.env`-Datei im `server/`-Verzeichnis mit folgendem Inhalt:

```env
# Server Configuration
PORT=3001
WS_PORT=3002

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=go_platform
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Secret (for future authentication)
JWT_SECRET=your-secret-key-here
```

Passen Sie die Werte entsprechend Ihrer Umgebung an.
