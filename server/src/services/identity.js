/**
 * Identity Service
 * 
 * Provides canonical identity resolution for REST and WebSocket requests.
 * Returns consistent identity objects for accounts and guests.
 * 
 * Identity format: { kind: 'account'|'guest', id: string, username?: string }
 * IdentityKey format: `${kind}:${id}`
 */

import { getUserFromToken } from './auth.js';
import cookie from 'cookie';

/**
 * Get identity from REST request (HTTP)
 * Priority: session cookie/JWT > X-Guest-Id header > userId query param
 * @param {Object} req - Express request object
 * @returns {Promise<{kind: 'account'|'guest', id: string, username?: string}|null>}
 */
export async function getIdentityFromRequest(req) {
  // 1. Try to get from session cookie/JWT first
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionToken = cookies.session || req.headers.authorization?.split(' ')[1];
  
  if (sessionToken) {
    try {
      const user = await getUserFromToken(sessionToken);
      if (user) {
        console.log(`[Identity] ✅ Resolved account from session: ${user.id} (${user.username})`);
        return {
          kind: 'account',
          id: user.id,
          username: user.username
        };
      }
    } catch (error) {
      console.warn('[Identity] Session token invalid, falling back to guest:', error.message);
      // Token invalid, fall through to guest
    }
  }
  
  // 2. Fall back to guest ID from header or query parameter
  const guestId = req.headers['x-guest-id'] || req.query.guestId || req.query.userId;
  if (guestId && typeof guestId === 'string' && guestId.trim() !== '') {
    // Validate guest ID format (should start with "guest-")
    if (guestId.startsWith('guest-')) {
      console.log(`[Identity] ✅ Resolved guest from header/query: ${guestId}`);
      return {
        kind: 'guest',
        id: guestId
      };
    } else {
      console.warn(`[Identity] Invalid guest ID format (should start with "guest-"): ${guestId}`);
    }
  }
  
  // No identity found
  console.log('[Identity] ❌ No identity resolved from request');
  return null;
}

/**
 * Get identity from WebSocket connection
 * Priority: ws.authUser (from session) > ws.guestId > message.guestId
 * @param {Object} ws - WebSocket connection object
 * @param {Object} msg - Optional message data (for guestId fallback)
 * @returns {{kind: 'account'|'guest', id: string, username?: string}|null}
 */
export function getIdentityFromWs(ws, msg = null) {
  // 1. Check if authenticated user exists (from session cookie during handshake)
  if (ws.authUser) {
    console.log(`[Identity] ✅ Resolved account from WS authUser: ${ws.authUser.id} (${ws.authUser.username})`);
    return {
      kind: 'account',
      id: ws.authUser.id,
      username: ws.authUser.username
    };
  }
  
  // 2. Check if guestId is stored on socket
  if (ws.guestId) {
    console.log(`[Identity] ✅ Resolved guest from WS guestId: ${ws.guestId}`);
    return {
      kind: 'guest',
      id: ws.guestId
    };
  }
  
  // 3. Fallback: try to get from message data
  const guestIdFromMsg = msg?.guestId || msg?.userId;
  if (guestIdFromMsg && typeof guestIdFromMsg === 'string' && guestIdFromMsg.startsWith('guest-')) {
    console.warn(`[Identity] ⚠️ Resolved guest from message data (ws.guestId not set): ${guestIdFromMsg}`);
    return {
      kind: 'guest',
      id: guestIdFromMsg
    };
  }
  
  // 4. Legacy: check ws.userId (for backward compatibility)
  if (ws.userId) {
    if (ws.userId.startsWith('guest-')) {
      console.log(`[Identity] ✅ Resolved guest from WS userId (legacy): ${ws.userId}`);
      return {
        kind: 'guest',
        id: ws.userId
      };
    } else {
      // Assume it's an account UUID
      console.log(`[Identity] ✅ Resolved account from WS userId (legacy): ${ws.userId}`);
      return {
        kind: 'account',
        id: ws.userId,
        username: ws.username || undefined
      };
    }
  }
  
  console.warn('[Identity] ❌ No identity resolved from WebSocket');
  return null;
}

/**
 * Generate identityKey from identity object
 * Format: `a:<uuid>` for accounts, `g:<guestId>` for guests
 * @param {Object} identity - Identity object
 * @returns {string|null}
 */
export function getIdentityKey(identity) {
  if (!identity || !identity.kind || !identity.id) {
    return null;
  }
  // Use short prefix: 'a' for account, 'g' for guest
  const prefix = identity.kind === 'account' ? 'a' : 'g';
  return `${prefix}:${identity.id}`;
}

/**
 * Parse identityKey to get kind and id
 * @param {string} identityKey - Identity key in format `a:<uuid>` or `g:<guestId>`
 * @returns {{kind: 'account'|'guest', id: string}|null}
 */
export function parseIdentityKey(identityKey) {
  if (!identityKey || typeof identityKey !== 'string') {
    return null;
  }
  
  const [prefix, ...idParts] = identityKey.split(':');
  if (!prefix || idParts.length === 0) {
    return null;
  }
  
  const id = idParts.join(':'); // Handle case where id contains ':'
  
  if (prefix === 'a') {
    return { kind: 'account', id };
  } else if (prefix === 'g') {
    return { kind: 'guest', id };
  }
  
  return null;
}
