# Queue Duplicate Join Fix

## Problem
- "Already in queue" message when pressing Play button
- UI can get stuck in queue state
- No cleanup on page unload/reload

## Solution
Prevent duplicate `join_queue` calls and add proper cleanup.

## Changed Files

### Frontend

1. **`web_client/src/components/MatchmakingView.jsx`**
   - Added `isJoining` state flag to prevent duplicate clicks
   - `handleJoinQueue`: Sets `isJoining` BEFORE sending (prevents double clicks)
   - `QUEUE_JOINED` handler: Clears `isJoining` flag, handles `in_queue: true` correctly
   - `QUEUE_LEFT` handler: Clears both `isInQueue` and `isJoining`
   - `disconnected` handler: Resets both flags
   - `MATCH_FOUND` handler: Clears `isJoining` flag
   - Added cleanup on page unload: `beforeunload` and `pagehide` events send `leave_queue`
   - Button disabled when `isJoining` is true
   - Board size selector disabled when `isJoining` is true

### Backend

2. **`server/src/services/matchmaking.js`**
   - Already returns `QUEUE_JOINED` with `in_queue: true` when user is already queued (idempotent, NOT an error)
   - Added `status: 'already_in_queue'` to response data

3. **`server/src/websocket/handler.js`**
   - Already removes user from queue on disconnect via `matchmakingService.removeUser(ws.identityKey)`

## How It Works

### Frontend Flow:
1. User clicks "Play Online"
2. `handleJoinQueue` checks: `if (isInQueue || isJoining) return;`
3. Sets `isJoining = true` (prevents duplicate clicks)
4. Sends `join_queue` message
5. Server responds with `QUEUE_JOINED`:
   - If `in_queue: false` → Sets `isInQueue = true`, clears `isJoining`
   - If `in_queue: true` → Updates position, ensures `isInQueue = true`, clears `isJoining`
6. On page unload: Sends `leave_queue` to clean up server state

### Backend Flow:
1. Receives `join_queue` message
2. Checks if `identityKey` already in queue
3. If yes: Returns `QUEUE_JOINED` with `in_queue: true` (idempotent, NOT error)
4. If no: Adds to queue, returns `QUEUE_JOINED` with `in_queue: false`
5. On disconnect: Automatically removes from queue

## Test Steps

### 1. Double Click Prevention:
1. Click "Play Online" button
2. Immediately click again (within 100ms)
3. **Expected**: Only ONE `join_queue` message sent, button disabled during join

### 2. Already in Queue:
1. Click "Play Online" → Wait for `QUEUE_JOINED`
2. Click "Play Online" again
3. **Expected**: Server returns `in_queue: true`, UI shows correct position, no error

### 3. Page Reload Cleanup:
1. Click "Play Online" → Wait for `QUEUE_JOINED`
2. Reload page (F5 or Ctrl+R)
3. **Expected**: 
   - `beforeunload` event fires → sends `leave_queue`
   - Server removes user from queue
   - After reload, user is NOT in queue

### 4. Disconnect Cleanup:
1. Click "Play Online" → Wait for `QUEUE_JOINED`
2. Close browser tab or disconnect network
3. **Expected**: Server's `handleDisconnection` removes user from queue

### 5. Leave Queue Button:
1. Click "Play Online" → Wait for `QUEUE_JOINED`
2. Click "Warteschlange verlassen" button
3. **Expected**: 
   - Sends `leave_queue`
   - UI resets: `isInQueue = false`, `isJoining = false`
   - Button changes back to "Play Online"

## Acceptance Criteria ✅

- ✅ Double click on "Play Online" → Only one `join_queue` sent
- ✅ Already in queue → Returns status, no error
- ✅ Page reload → User removed from queue
- ✅ Disconnect → User removed from queue
- ✅ Leave Queue button → Works correctly
- ✅ UI never gets stuck in queue state
