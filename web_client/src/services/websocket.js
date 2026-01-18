/**
 * WebSocket Service
 * 
 * Manages WebSocket connection to the game server.
 * Handles connection, reconnection, and message routing.
 * 
 * MVP: No authentication required - uses guest userId per tab.
 */

import { EventTypes } from '../constants/events';
import { getGuestUserId } from '../utils/guestId.js';

class WebSocketService {
  constructor() {
    this.ws = null;
    // Use Vite proxy in dev, direct connection in production
    const isDev = import.meta.env.DEV;
    this.baseUrl = isDev ? 'ws://localhost:3000/ws' : 'ws://localhost:3001/ws';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.isConnecting = false;
    this.userId = null; // Store userId for this connection
    this.connectionTimeout = null;
    this.errorMessage = null;
  }

  /**
   * Get WebSocket URL (no token required in MVP)
   * @returns {string} WebSocket URL
   */
  getWebSocketUrl() {
    return this.baseUrl;
  }

  /**
   * Get current user ID (guest ID per tab)
   * @returns {string} User ID
   */
  getUserId() {
    if (!this.userId) {
      this.userId = getGuestUserId();
    }
    return this.userId;
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve();
    }

    // Clear any existing timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.isConnecting = true;
    this.errorMessage = null;
    this.emit('connecting');

    return new Promise((resolve, reject) => {
      try {
        const url = this.getWebSocketUrl();
        const userId = this.getUserId();
        console.log('[WebSocket Client] WS connecting to:', url, `(userId: ${userId})`);
        
        this.ws = new WebSocket(url);

        // Set connection timeout (5 seconds)
        this.connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            console.error('[WebSocket Client] ❌ Connection timeout after 5 seconds');
            this.ws.close();
            this.isConnecting = false;
            this.errorMessage = 'Konnte keine Verbindung zum Server herstellen. Läuft das Backend?';
            this.emit('connection_timeout', { message: this.errorMessage });
            this.emit('error', { message: this.errorMessage });
            reject(new Error(this.errorMessage));
          }
        }, 5000);

        this.ws.onopen = () => {
          console.log('[WebSocket Client] WS open');
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          
          console.log('[WebSocket Client] ✅ Connected successfully');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.errorMessage = null;
          
          // Send guestId to server immediately after connection (as hello message)
          const guestId = this.getUserId();
          console.log('[WebSocket Client] Sending guestId to server:', guestId);
          // Send as 'hello' message with guestId (preferred) or 'set_user_id' (legacy)
          this.send('hello', { guestId });
          
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('[WebSocket Client] Received:', message);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket Client] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket Client] WS error:', error);
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          this.isConnecting = false;
          this.errorMessage = 'Verbindungsfehler. Stelle sicher, dass der Server läuft.';
          this.emit('error', { error, message: this.errorMessage });
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log(`[WebSocket Client] WS close code=${event.code} reason="${event.reason || 'none'}"`);
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          this.isConnecting = false;
          
          // Set error message if not already set
          if (!this.errorMessage && event.code !== 1000) {
            this.errorMessage = event.reason || `Verbindung geschlossen (Code: ${event.code})`;
          }
          
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Only auto-reconnect if it was a clean close or unexpected close
          if (event.code !== 1000) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error('[WebSocket Client] Exception during connection:', error);
        this.isConnecting = false;
        this.errorMessage = `Verbindungsfehler: ${error.message}`;
        this.emit('error', { error, message: this.errorMessage });
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect to server
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection will be attempted again
      });
    }, this.reconnectDelay);
  }

  /**
   * Send message to server
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  send(type, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket Client] Cannot send: not connected');
      return;
    }

    // Always include userId in messages (except set_user_id itself)
    const message = { 
      type, 
      data: type !== 'set_user_id' ? { ...data, userId: this.getUserId() } : data
    };
    console.log('[WebSocket Client] Sending:', message);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Handle incoming message from server
   * @param {Object} message - Parsed message
   */
  handleMessage(message) {
    const { type, data } = message;
    
    // Emit to specific event listeners
    this.emit(type, data);
    
    // Also emit to 'message' listeners for general handling
    this.emit('message', { type, data });
  }

  /**
   * Subscribe to WebSocket events
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get error message if connection failed
   * @returns {string|null}
   */
  getErrorMessage() {
    return this.errorMessage;
  }

  /**
   * Clear error message
   */
  clearError() {
    this.errorMessage = null;
  }
}

export const websocketService = new WebSocketService();
