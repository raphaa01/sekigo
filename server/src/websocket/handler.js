/**
 * WebSocket Connection Handler
 * 
 * Manages all WebSocket connections and routes incoming messages
 * to the appropriate handlers based on message type.
 */

import { EventTypes } from '../constants/events.js';
import { matchmakingService } from '../services/matchmaking.js';
import { gameManager } from '../services/gameManager.js';
import { getUserFromToken } from '../services/auth.js';
import { getIdentityFromWs, getIdentityKey } from '../services/identity.js';
import cookie from 'cookie';

class WebSocketHandler {
  constructor() {
    this.connections = new Map(); // identityKey -> WebSocket
    this.pendingConnections = new Map(); // ws -> temporary storage until identityKey is set
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Request} req - HTTP request
   */
  async handleConnection(ws, req) {
    const remoteAddress = req.socket.remoteAddress || 'unknown';
    const requestUrl = req.url || '/';
    console.log(`[WebSocket] 🔌 New connection attempt from ${remoteAddress}, path: ${requestUrl}`);
    
    ws.isAlive = true;
    ws.identityKey = null; // Will be set from session or hello message
    ws.authUser = null; // Will be set if logged in
    ws.guestId = null; // Will be set if guest
    ws.userId = null; // Legacy: kept for backward compatibility

    // Try to get user from session cookie (priority: account identity)
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionToken = cookies.session;
    
    if (sessionToken) {
      try {
        const user = await getUserFromToken(sessionToken);
        if (user) {
          // Store authenticated user on socket
          ws.authUser = { id: user.id, username: user.username };
          ws.userId = user.id; // Legacy compatibility
          ws.username = user.username; // Legacy compatibility
          
          // Set identityKey with 'a:' prefix for account
          ws.identityKey = `a:${user.id}`;
          this.connections.set(ws.identityKey, ws);
          this.pendingConnections.delete(ws);
          
          console.log(`[WebSocket] ✅ Account connected: identityKey=${ws.identityKey}, username=${user.username}, hasAccount=true`);
          
          this.send(ws, {
            type: EventTypes.CONNECTED,
            data: { 
              message: 'Connected to Go Platform', 
              userId: user.id, 
              username: user.username,
              identityKey: ws.identityKey
            }
          });
          
          // Set up message handlers
          this.setupMessageHandlers(ws);
          return;
        }
      } catch (error) {
        console.warn('[WebSocket] Failed to authenticate from session:', error.message);
      }
    }
    
    // No valid session - wait for client to send guestId (DO NOT BLOCK)
    console.log('[WebSocket] No valid session, waiting for hello message with guestId (hasAccount=false)');
    this.pendingConnections.set(ws, { connectedAt: Date.now() });

    this.send(ws, {
      type: EventTypes.CONNECTED,
      data: { message: 'Connected to Go Platform. Please send hello with guestId.' }
    });

    // Set up message handlers (guests are allowed, no blocking)
    this.setupMessageHandlers(ws);
  }

  /**
   * Set up WebSocket message handlers
   */
  setupMessageHandlers(ws) {
    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message.toString());
        this.handleMessage(ws, parsed);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
      this.handleDisconnection(ws, code, reason ? reason.toString() : '');
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error(`[WebSocket] Error for user ${ws.userId}:`, error);
    });

    // Handle ping/pong for keepalive
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  /**
   * Route incoming messages to appropriate handlers
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Parsed message object
   */
  handleMessage(ws, message) {
    const { type, data } = message;

    // Handle hello/set_user_id message (from client on connect - for guests)
    if (type === 'hello' || type === 'set_user_id') {
      // If already authenticated via session (logged-in user), ignore guest ID
      if (ws.identityKey && ws.identityKey.startsWith('a:')) {
        console.log(`[WebSocket] Ignoring ${type} - already authenticated as account: ${ws.identityKey}`);
        this.send(ws, {
          type: EventTypes.CONNECTED,
          data: { 
            message: 'Connected to Go Platform', 
            userId: ws.authUser.id, 
            username: ws.authUser.username, 
            identityKey: ws.identityKey,
            alreadyAuthenticated: true 
          }
        });
        return;
      }

      // Extract guestId from message
      const guestId = data?.guestId || data?.userId;
      if (!guestId || typeof guestId !== 'string' || guestId.trim() === '') {
        console.warn(`[WebSocket] Invalid guestId provided in ${type}:`, guestId);
        this.sendError(ws, 'Invalid guestId. Must be a non-empty string.');
        return;
      }

      // Validate guest ID format
      if (!guestId.startsWith('guest-')) {
        console.warn(`[WebSocket] Guest ID should start with "guest-": ${guestId}`);
        // Allow it anyway, but log warning
      }

      // Set guest identity on socket with 'g:' prefix
      if (!ws.identityKey) {
        ws.guestId = guestId;
        ws.userId = guestId; // Legacy compatibility
        
        // Set identityKey with 'g:' prefix for guest
        ws.identityKey = `g:${guestId}`;
        this.connections.set(ws.identityKey, ws);
        this.pendingConnections.delete(ws);
        
        console.log(`[WebSocket] ✅ Guest connected: identityKey=${ws.identityKey}, guestId=${guestId}`);
        
        this.send(ws, {
          type: EventTypes.CONNECTED,
          data: { 
            message: 'Connected to Go Platform', 
            userId: guestId,
            identityKey: ws.identityKey
          }
        });
      } else {
        console.log(`[WebSocket] identityKey already set (${ws.identityKey}), ignoring ${type} with ${guestId}`);
      }
      return;
    }

    // For all other messages, require identityKey to be set
    if (!ws.identityKey) {
      console.warn(`[WebSocket] ❌ Message received before identityKey was set: ${type}. Waiting for hello message or session authentication.`);
      console.warn(`[WebSocket] Connection state: identityKey=${ws.identityKey}, authUser=${!!ws.authUser}, guestId=${ws.guestId}, pending=${this.pendingConnections.has(ws)}`);
      this.sendError(ws, 'Please send hello message with guestId first or log in');
      return;
    }

    console.log(`[WebSocket] 📨 Message from ${ws.identityKey}: ${type}`, data);

    switch (type) {
      case EventTypes.JOIN_QUEUE:
        const boardSize = data?.boardSize;
        if (![9, 13, 19].includes(boardSize)) {
          this.sendError(ws, 'Invalid board size. Must be 9, 13, or 19.');
          return;
        }
        
        // Check if identityKey is set
        if (!ws.identityKey) {
          console.warn(`[WebSocket] ❌ Cannot join queue: identityKey not set. Waiting for hello message.`);
          this.sendError(ws, 'Identity not set. Please send hello message first.');
          return;
        }
        
        // Use identityKey directly (no identity object needed)
        console.log(`[WebSocket] ${ws.identityKey} joining queue with boardSize: ${boardSize}`);
        matchmakingService.joinQueue(ws.identityKey, ws, { boardSize });
        break;

      case EventTypes.LEAVE_QUEUE:
        console.log(`[WebSocket] ${ws.identityKey} leaving queue`);
        matchmakingService.leaveQueue(ws.identityKey);
        break;

      case EventTypes.PLAY_MOVE:
        // Extract userId from identityKey for gameManager (backward compatibility)
        const userId = ws.identityKey.startsWith('a:') ? ws.authUser.id : ws.guestId;
        gameManager.handleMove({ id: userId, identityKey: ws.identityKey }, data);
        break;

      case EventTypes.RESIGN:
        const userIdResign = ws.identityKey.startsWith('a:') ? ws.authUser.id : ws.guestId;
        gameManager.handleResignation({ id: userIdResign, identityKey: ws.identityKey }, data);
        break;

      case EventTypes.REQUEST_GAME_STATE:
        const userIdState = ws.identityKey.startsWith('a:') ? ws.authUser.id : ws.guestId;
        gameManager.sendGameState({ id: userIdState, identityKey: ws.identityKey }, data);
        break;

      case EventTypes.REQUEST_STATS:
        const userIdStats = ws.identityKey.startsWith('a:') ? ws.authUser.id : ws.guestId;
        gameManager.sendPlayerStats({ id: userIdStats, identityKey: ws.identityKey }, data);
        break;

      default:
        console.warn(`[WebSocket] Unknown message type: ${type}`);
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  /**
   * Handle client disconnection
   * @param {WebSocket} ws - WebSocket connection
   */
  handleDisconnection(ws, code, reason) {
    if (ws.identityKey) {
      console.log(`[WebSocket] 🔌 ${ws.identityKey} disconnected (code: ${code}, reason: ${reason || 'none'})`);
      
      // Remove from matchmaking queue if present (by identityKey)
      matchmakingService.removeUser(ws.identityKey);

      // Handle game disconnection (extract userId for backward compatibility)
      const userId = ws.identityKey.startsWith('a:') ? ws.authUser?.id : ws.guestId;
      if (userId) {
        gameManager.handleDisconnection({ id: userId, identityKey: ws.identityKey });
      }

      // Remove connection by identityKey
      this.connections.delete(ws.identityKey);
    } else {
      // Clean up pending connection
      this.pendingConnections.delete(ws);
      console.log(`[WebSocket] 🔌 Anonymous connection closed (code: ${code}, reason: ${reason || 'none'})`);
    }
  }

  /**
   * Send message to a specific WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Message object
   */
  send(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send message to user by identityKey or identity object
   * @param {string|Object} identityKeyOrIdentity - IdentityKey string (e.g., "a:uuid" or "g:guest-xxx") or identity object
   * @param {Object} message - Message object
   */
  sendToUser(identityKeyOrIdentity, message) {
    let identityKey;
    
    if (typeof identityKeyOrIdentity === 'string') {
      // Direct identityKey string
      identityKey = identityKeyOrIdentity;
    } else if (identityKeyOrIdentity && identityKeyOrIdentity.identityKey) {
      // Object with identityKey property
      identityKey = identityKeyOrIdentity.identityKey;
    } else {
      // Try to get identityKey from identity object
      identityKey = getIdentityKey(identityKeyOrIdentity);
    }
    
    if (!identityKey) {
      console.warn(`[WebSocket] Cannot send message: invalid identityKey`, identityKeyOrIdentity);
      return;
    }
    
    const ws = this.connections.get(identityKey);
    if (ws) {
      console.log(`[WebSocket] 📤 Sending to ${identityKey}: ${message.type}`);
      this.send(ws, message);
    } else {
      console.warn(`[WebSocket] Cannot send to ${identityKey}: connection not found`);
    }
  }
  
  /**
   * Get WebSocket connection for identityKey or identity object
   * @param {string|Object} identityKeyOrIdentity - IdentityKey string or identity object
   * @returns {WebSocket|null}
   */
  getConnection(identityKeyOrIdentity) {
    let identityKey;
    
    if (typeof identityKeyOrIdentity === 'string') {
      // Check if it's already an identityKey format
      if (identityKeyOrIdentity.startsWith('a:') || identityKeyOrIdentity.startsWith('g:')) {
        identityKey = identityKeyOrIdentity;
      } else {
        // Legacy: try to find by userId string (try both prefixes)
        let ws = this.connections.get(`g:${identityKeyOrIdentity}`);
        if (!ws) {
          ws = this.connections.get(`a:${identityKeyOrIdentity}`);
        }
        return ws || null;
      }
    } else if (identityKeyOrIdentity && identityKeyOrIdentity.identityKey) {
      identityKey = identityKeyOrIdentity.identityKey;
    } else {
      identityKey = getIdentityKey(identityKeyOrIdentity);
    }
    
    return identityKey ? (this.connections.get(identityKey) || null) : null;
  }

  /**
   * Send error message to client
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} error - Error message
   */
  sendError(ws, error) {
    this.send(ws, {
      type: EventTypes.ERROR,
      data: { error }
    });
  }

  /**
   * Get WebSocket connection for user
   * @param {string} userId - User ID
   * @returns {WebSocket|null}
   */
  getConnection(userId) {
    return this.connections.get(userId) || null;
  }
}

export const websocketHandler = new WebSocketHandler();
