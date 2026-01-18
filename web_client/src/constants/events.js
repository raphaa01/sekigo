/**
 * WebSocket Event Type Constants
 * 
 * Must match server-side event types for proper communication.
 */

export const EventTypes = {
  // Connection events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',

  // Matchmaking events
  JOIN_QUEUE: 'join_queue',
  LEAVE_QUEUE: 'leave_queue',
  QUEUE_JOINED: 'queue_joined',
  QUEUE_LEFT: 'queue_left',
  MATCH_FOUND: 'match_found',
  MATCH_CANCELLED: 'match_cancelled',

  // Game events
  GAME_STARTED: 'game_started',
  GAME_STATE: 'game_state',
  PLAY_MOVE: 'play_move',
  MOVE_ACCEPTED: 'move_accepted',
  MOVE_REJECTED: 'move_rejected',
  REQUEST_GAME_STATE: 'request_game_state',
  GAME_ENDED: 'game_ended',
  RESIGN: 'resign',
  RESIGNATION_ACCEPTED: 'resignation_accepted',

  // Turn management
  TURN_CHANGED: 'turn_changed',
  PLAYER_PASSED: 'player_passed',
  
  // Stats events
  STATS_UPDATE: 'stats_update',
  REQUEST_STATS: 'request_stats'
};
