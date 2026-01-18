/**
 * Matchmaking Service
 * 
 * Handles player queue management and match creation.
 * Matches players based on:
 * - Board size preference
 * - Rating proximity (Elo-based)
 * - Queue time (widen search over time)
 */

import { websocketHandler } from '../websocket/handler.js';
import { EventTypes } from '../constants/events.js';
import { gameManager } from './gameManager.js';

class MatchmakingService {
  constructor() {
    // Queue structure: Map<boardSize, Array<{identityKey, socketId, boardSize, joinedAt, rating?}>>
    // Note: rating is optional and fetched only when needed (not required for matching)
    this.queues = new Map();
    // Track queued users: Map<identityKey, {boardSize, joinedAt, socketId}>
    this.queuedUsers = new Map();
    this.matchmakingInterval = null;
    this.cleanupInterval = null;
  }

  /**
   * Initialize matchmaking service
   */
  initialize() {
    // Start matchmaking loop (check every 500ms for faster matching)
    this.matchmakingInterval = setInterval(() => {
      this.processQueues();
    }, 500);

    // Cleanup stale queue entries every 5 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleEntries();
    }, 5000);

    console.log('[Matchmaking] Service initialized (check interval: 500ms, cleanup: 5s)');
  }

  /**
   * Add player to matchmaking queue
   * @param {string} identityKey - Identity key in format "a:<uuid>" or "g:<guestId>"
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} preferences - Matchmaking preferences
   * @param {number} preferences.boardSize - Board size (9, 13, or 19)
   * @param {Object} preferences.timeControl - Optional time control settings
   */
  async joinQueue(identityKey, ws, preferences) {
    const { boardSize } = preferences;

    // Validate identityKey
    if (!identityKey || typeof identityKey !== 'string' || (!identityKey.startsWith('a:') && !identityKey.startsWith('g:'))) {
      console.warn('[Matchmaking] Invalid identityKey provided:', identityKey);
      websocketHandler.sendError(ws, 'Missing identity. Please send hello message first.');
      return;
    }

    // Validate boardSize
    if (![9, 13, 19].includes(boardSize)) {
      websocketHandler.sendError(ws, 'Invalid board size. Must be 9, 13, or 19.');
      return;
    }

    // NO RATING LOOKUP - matchmaking is independent of DB

    // Initialize queue for board size if it doesn't exist
    if (!this.queues.has(boardSize)) {
      this.queues.set(boardSize, []);
    }

    const queue = this.queues.get(boardSize);

    // Check if user is already in queue for this board size (by identityKey)
    const existingIndex = queue.findIndex(p => p.identityKey === identityKey);
    if (existingIndex !== -1) {
      // User is already in queue for this board size - return status (idempotent)
      console.log(`[Matchmaking] ${identityKey} already in queue for ${boardSize}x${boardSize}, returning status`);
      websocketHandler.sendToUser(identityKey, {
        type: EventTypes.QUEUE_JOINED,
        data: { 
          boardSize, 
          queuePosition: queue.length, 
          in_queue: true,
          status: 'already_in_queue'
        }
      });
      return;
    }

    // Check if user is in queue for a different board size
    for (const [otherBoardSize, otherQueue] of this.queues.entries()) {
      if (otherBoardSize !== boardSize) {
        const otherIndex = otherQueue.findIndex(p => p.identityKey === identityKey);
        if (otherIndex !== -1) {
          // Remove from previous queue
          otherQueue.splice(otherIndex, 1);
          console.log(`[Matchmaking] ${identityKey} switched from ${otherBoardSize}x${otherBoardSize} to ${boardSize}x${boardSize} queue`);
        }
      }
    }

    // Add to queue with identityKey (NO RATING, NO IDENTITY OBJECT)
    queue.push({
      identityKey,
      socketId: ws.identityKey, // Store identityKey as socketId reference
      boardSize,
      joinedAt: Date.now(),
      preferences
    });

    // Track in queuedUsers map by identityKey
    this.queuedUsers.set(identityKey, {
      boardSize,
      joinedAt: Date.now(),
      socketId: ws.identityKey
    });

    const queueSize = queue.length;
    console.log(`[Matchmaking] ✅ ${identityKey} joined queue for ${boardSize}x${boardSize} (queue length: ${queueSize})`);
    
    // Immediately try to process queues (don't wait for interval)
    this.processQueues();
    
    websocketHandler.sendToUser(identityKey, {
      type: EventTypes.QUEUE_JOINED,
      data: { boardSize, queuePosition: queueSize, in_queue: false }
    });
  }

  /**
   * Remove player from matchmaking queue (idempotent)
   * @param {string} identityKey - Identity key in format "a:<uuid>" or "g:<guestId>"
   */
  leaveQueue(identityKey) {
    if (!identityKey || typeof identityKey !== 'string') {
      console.warn('[Matchmaking] Invalid identityKey provided to leaveQueue:', identityKey);
      return;
    }

    let found = false;
    for (const [boardSize, queue] of this.queues.entries()) {
      const index = queue.findIndex(p => p.identityKey === identityKey);
      if (index !== -1) {
        queue.splice(index, 1);
        console.log(`[Matchmaking] ✅ ${identityKey} left queue for ${boardSize}x${boardSize}`);
        found = true;
        
        const ws = websocketHandler.getConnection(identityKey);
        if (ws) {
          websocketHandler.sendToUser(identityKey, {
            type: EventTypes.QUEUE_LEFT,
            data: { boardSize }
          });
        }
      }
    }
    
    // Remove from queuedUsers tracking
    this.queuedUsers.delete(identityKey);
    
    // Idempotent: always succeed, even if user wasn't in queue
    if (!found) {
      console.log(`[Matchmaking] ${identityKey} attempted to leave queue but was not in any queue`);
    }
  }

  /**
   * Remove user from queue (called on disconnect)
   * @param {string} identityKey - Identity key in format "a:<uuid>" or "g:<guestId>"
   */
  removeUser(identityKey) {
    console.log(`[Matchmaking] Removing ${identityKey} from all queues (disconnect)`);
    this.leaveQueue(identityKey);
  }

  /**
   * Clean up stale queue entries (users with no active socket or old entries)
   */
  cleanupStaleEntries() {
    const now = Date.now();
    const maxAge = 60000; // 60 seconds

    for (const [boardSize, queue] of this.queues.entries()) {
      const initialLength = queue.length;
      
      // Remove entries where socket doesn't exist or entry is too old
      for (let i = queue.length - 1; i >= 0; i--) {
        const entry = queue[i];
        const socket = websocketHandler.getConnection(entry.identityKey);
        const age = now - entry.joinedAt;
        
        if (!socket || age > maxAge) {
          console.log(`[Matchmaking] Removing stale entry: ${entry.identityKey} (socket: ${socket ? 'exists' : 'missing'}, age: ${Math.floor(age/1000)}s)`);
          queue.splice(i, 1);
          this.queuedUsers.delete(entry.identityKey);
        }
      }
      
      if (queue.length !== initialLength) {
        console.log(`[Matchmaking] Cleaned up ${initialLength - queue.length} stale entries from ${boardSize}x${boardSize} queue`);
      }
    }
  }

  /**
   * Process all queues and attempt to create matches
   */
  processQueues() {
    for (const [boardSize, queue] of this.queues.entries()) {
      if (queue.length < 2) {
        if (queue.length > 0) {
          console.log(`[Matchmaking] Queue for ${boardSize}x${boardSize}: ${queue.length} player(s) waiting`);
        }
        continue;
      }

      console.log(`[Matchmaking] Processing queue for ${boardSize}x${boardSize}: ${queue.length} players`);

      // NO SORTING NEEDED - matchmaking is independent of rating

      // Try to match players - find two DIFFERENT users (never match user with themselves by identityKey)
      if (queue.length >= 2) {
        // Find two different users (by identityKey)
        let player1 = null;
        let player2 = null;
        
        for (let i = 0; i < queue.length; i++) {
          for (let j = i + 1; j < queue.length; j++) {
            if (queue[i].identityKey !== queue[j].identityKey) {
              player1 = queue[i];
              player2 = queue[j];
              break;
            }
          }
          if (player1 && player2) break;
        }

        if (!player1 || !player2) {
          console.warn(`[Matchmaking] Cannot find two different users in queue for ${boardSize}x${boardSize}. Queue:`, queue.map(p => p.identityKey));
          continue;
        }

        // Ensure we never match a user with themselves (by identityKey)
        if (player1.identityKey === player2.identityKey) {
          console.error(`[Matchmaking] ERROR: Attempted to match ${player1.identityKey} with themselves!`);
          continue;
        }

        // Verify both sockets exist (by identityKey)
        const socket1 = websocketHandler.getConnection(player1.identityKey);
        const socket2 = websocketHandler.getConnection(player2.identityKey);
        
        if (!socket1 || !socket2) {
          console.warn(`[Matchmaking] One or both sockets missing: ${player1.identityKey} (${socket1 ? 'ok' : 'missing'}), ${player2.identityKey} (${socket2 ? 'ok' : 'missing'})`);
          // Remove entries with missing sockets
          if (!socket1) {
            const idx1 = queue.findIndex(p => p.identityKey === player1.identityKey);
            if (idx1 !== -1) queue.splice(idx1, 1);
            this.queuedUsers.delete(player1.identityKey);
          }
          if (!socket2) {
            const idx2 = queue.findIndex(p => p.identityKey === player2.identityKey);
            if (idx2 !== -1) queue.splice(idx2, 1);
            this.queuedUsers.delete(player2.identityKey);
          }
          continue;
        }

        // Calculate time in queue (NO RATING CHECK - matchmaking is independent of DB)
        const timeInQueue1 = Date.now() - player1.joinedAt;
        const timeInQueue2 = Date.now() - player2.joinedAt;
        const maxTime = Math.max(timeInQueue1, timeInQueue2);
        
        // MVP: Match immediately if both have been waiting at least 500ms
        // This ensures fast matching for testing
        if (maxTime >= 500) {
          console.log(`[Matchmaking] 🎮 Match found! ${player1.identityKey} vs ${player2.identityKey}, board: ${boardSize}x${boardSize}, wait: ${Math.floor(maxTime)}ms`);
          
          // Create match (extract userId from identityKey for gameManager)
          this.createMatch(player1, player2, boardSize);
          
          // Remove from queue (find indices to remove correct entries)
          const idx1 = queue.findIndex(p => p.identityKey === player1.identityKey);
          const idx2 = queue.findIndex(p => p.identityKey === player2.identityKey);
          if (idx1 !== -1) queue.splice(idx1, 1);
          if (idx2 !== -1 && idx2 !== idx1) {
            const adjustedIdx2 = idx2 > idx1 ? idx2 - 1 : idx2;
            queue.splice(adjustedIdx2, 1);
          }
          
          // Remove from queuedUsers tracking
          this.queuedUsers.delete(player1.identityKey);
          this.queuedUsers.delete(player2.identityKey);
          
          break;
        } else {
          console.log(`[Matchmaking] ⏳ Waiting for minimum queue time (${Math.floor(maxTime)}ms < 500ms)`);
        }
      }
    }
  }

  /**
   * Create a new game match
   * @param {Object} player1 - First player
   * @param {Object} player2 - Second player
   * @param {number} boardSize - Board size
   */
  async createMatch(player1, player2, boardSize) {
    // Randomly assign colors
    const blackPlayer = Math.random() < 0.5 ? player1 : player2;
    const whitePlayer = blackPlayer === player1 ? player2 : player1;

    // Extract userId from identityKey (remove prefix: 'a:' or 'g:')
    const blackUserId = blackPlayer.identityKey.substring(2); // Remove 'a:' or 'g:' prefix
    const whiteUserId = whitePlayer.identityKey.substring(2);

    // Create game (use extracted userIds and identityKeys)
    const game = await gameManager.createGame({
      blackPlayerId: blackUserId,
      whitePlayerId: whiteUserId,
      blackPlayerIdentityKey: blackPlayer.identityKey, // Store identityKey for WebSocket communication
      whitePlayerIdentityKey: whitePlayer.identityKey, // Store identityKey for WebSocket communication
      boardSize,
      timeControl: player1.preferences?.timeControl || null
    });

    // Notify both players (by identityKey)
    websocketHandler.sendToUser(blackPlayer.identityKey, {
      type: EventTypes.MATCH_FOUND,
      data: {
        gameId: game.id,
        opponent: {
          userId: whiteUserId
        },
        boardSize,
        color: 'black'
      }
    });

    websocketHandler.sendToUser(whitePlayer.identityKey, {
      type: EventTypes.MATCH_FOUND,
      data: {
        gameId: game.id,
        opponent: {
          userId: blackUserId
        },
        boardSize,
        color: 'white'
      }
    });

    console.log(`[Matchmaking] 🎮 Match created: gameId=${game.id}, black=${blackPlayer.identityKey} (${blackUserId}), white=${whitePlayer.identityKey} (${whiteUserId}), board=${boardSize}x${boardSize}`);
  }
}

export const matchmakingService = new MatchmakingService();
