# Auth Implementation Summary

## Backend Changes

### 1. Database Schema (`db/migrations/001_add_board_size_to_ratings_stats.sql`)
- Updated `ratings` and `player_stats` tables to include `board_size` (composite primary key)
- Added `guest_progress` table for guest stats migration
- Added indexes for performance

### 2. Auth Service (`server/src/services/auth.js`)
- Added `validateCredentials()` for username/password validation
- Added `getGuestProgress()` to fetch guest stats from DB
- Added `migrateGuestProgress()` to migrate guest stats to account
- Updated `signup()` and `login()` to accept `guestId`, `migrateProgress`, and `guestStatsPayload`
- Added `getUserFromToken()` helper

### 3. Auth Routes (`server/src/routes/auth.js`)
- Updated to use cookie-based sessions (httpOnly cookies)
- `POST /api/auth/register` - Register with optional guest migration
- `POST /api/auth/login` - Login with optional guest migration
- `POST /api/auth/logout` - Clear session cookie
- `GET /api/auth/me` - Get current user from session

### 4. Server Index (`server/src/index.js`)
- Added CORS with credentials support
- Added cookie-parser middleware
- Updated `/api/stats` to support both logged-in users and guests

### 5. Rating Service (`server/src/services/rating.js`)
- Supports both DB (accounts) and in-memory (guests)
- `isGuest()` helper to detect guest userIds
- Fallback to in-memory if DB fails

### 6. Stats Service (`server/src/services/stats.js`)
- Supports both DB (accounts) and in-memory (guests)
- Fallback to in-memory if DB fails

### 7. WebSocket Handler (`server/src/websocket/handler.js`)
- Tries to authenticate from session cookie on connect
- Falls back to guest mode if no session
- Supports both logged-in users and guests

## Frontend Changes (TODO - Next Steps)

### 1. Auth Service (`web_client/src/services/auth.js`)
- Update to use cookie-based sessions (no localStorage token)
- Add `getCurrentUser()` that calls `/api/auth/me`
- Add `register()`, `login()`, `logout()` functions
- Remove token handling from localStorage

### 2. Auth UI Component (`web_client/src/components/AuthModal.jsx`)
- Create modal with Login/Register forms
- "Continue as Guest" button
- Migration prompt when guest has progress

### 3. App.jsx
- Add identity management (check `/api/auth/me` on load)
- Show AuthModal when needed
- Pass identity to child components

### 4. MatchmakingView
- Show username if logged in
- Show "Login/Register" button if guest
- Handle identity changes

## Test Steps

1. **Guest Play:**
   - Open app as guest
   - Play 1 game
   - Verify stats are stored (in-memory)

2. **Register with Migration:**
   - As guest with progress, click "Register"
   - Check "Keep my progress"
   - Verify account receives guest stats

3. **Login/Logout:**
   - Logout
   - Login again
   - Verify stats persist

4. **Matchmaking:**
   - Guest vs Guest
   - Account vs Account
   - Guest vs Account

## Files Changed

**Backend:**
- `db/migrations/001_add_board_size_to_ratings_stats.sql` (NEW)
- `server/src/services/auth.js`
- `server/src/routes/auth.js`
- `server/src/index.js`
- `server/src/services/rating.js`
- `server/src/services/stats.js`
- `server/src/websocket/handler.js`
- `server/package.json` (added cookie-parser, cors, cookie)

**Frontend:**
- (To be implemented)
