/**
 * WebSocket Event Type Constants
 * 
 * Defines all message types used for communication between client and server.
 * These events are designed to be platform-agnostic (Web, iOS, Android).
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
  REQUEST_STATS: 'request_stats',
  
  // Game end reasons
  GAME_END_REASON: {
    RESIGNATION: 'resignation',
    TIME_OUT: 'time_out',
    SCORE: 'score',
    TWO_PASSES: 'two_passes',
    ABANDONMENT: 'abandonment'
  }
};

/**
 * Example message structures for documentation:
 * 
 * JOIN_QUEUE:
 * {
 *   type: 'join_queue',
 *   data: {
 *     boardSize: 19,  // 9, 13, or 19
 *     timeControl: { minutes: 10, byoYomi: 30 } // optional
 *   }
 * }
 * 
 * MATCH_FOUND:
 * {
 *   type: 'match_found',
 *   data: {
 *     gameId: 'game_123',
 *     opponent: { userId: 'user_456', username: 'opponent', rating: 1500 },
 *     boardSize: 19,
 *     color: 'black' // or 'white'
 *   }
 * }
 * 
 * PLAY_MOVE:
 * {
 *   type: 'play_move',
 *   data: {
 *     gameId: 'game_123',
 *     x: 3,
 *     y: 3,
 *     pass: false
 *   }
 * }
 * 
 * MOVE_ACCEPTED:
 * {
 *   type: 'move_accepted',
 *   data: {
 *     gameId: 'game_123',
 *     move: { x: 3, y: 3, color: 'black', moveNumber: 1 },
 *     boardState: [...], // current board state
 *     capturedStones: [...], // stones captured this move
 *     turn: 'white'
 *   }
 * }
 * 
 * MOVE_REJECTED:
 * {
 *   type: 'move_rejected',
 *   data: {
 *     gameId: 'game_123',
 *     reason: 'invalid_move' | 'not_your_turn' | 'ko_violation' | 'suicide_move'
 *   }
 * }
 * 
 * GAME_ENDED:
 * {
 *   type: 'game_ended',
 *   data: {
 *     gameId: 'game_123',
 *     winner: 'black' | 'white' | null,
 *     reason: 'resignation' | 'score' | 'time_out' | 'abandonment',
 *     finalScore: { black: 45.5, white: 38.5 },
 *     ratingChange: { black: +15, white: -15 }
 *   }
 * }
 */
