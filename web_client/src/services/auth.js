/**
 * Authentication Service
 * 
 * Handles authentication using cookie-based sessions.
 * All requests include credentials to send/receive cookies.
 */

const API_BASE_URL = '/api';

/**
 * Make a request with credentials (cookies)
 */
async function requestJson(path, options = {}) {
  const response = await fetch(API_BASE_URL + path, {
    ...options,
    credentials: 'include', // Important: send/receive cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const contentType = response.headers.get('Content-Type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (!isJson) {
    const text = await response.text();
    const snippet = text.slice(0, 120);
    const message = `Server antwortete nicht mit JSON (Status ${response.status}). Inhalt: ${snippet}`;
    throw new Error(message);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Antwort konnte nicht als JSON geparst werden.');
  }

  if (!response.ok) {
    const errorMessage = typeof data === 'object' && data && data.error ? data.error : 'Anfrage fehlgeschlagen';
    throw new Error(errorMessage);
  }

  return data;
}

/**
 * Get current user from session
 * @returns {Promise<{loggedIn: boolean, user: {id, username} | null}>}
 */
export async function getCurrentUser() {
  try {
    const data = await requestJson('/auth/me');
    return {
      loggedIn: data.loggedIn || false,
      user: data.user || null
    };
  } catch (error) {
    console.error('[Auth] Error fetching current user:', error);
    return {
      loggedIn: false,
      user: null
    };
  }
}

/**
 * Register a new account
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {string} guestId - Optional guest ID for migration
 * @param {boolean} migrateProgress - Whether to migrate guest progress
 * @param {Object} guestStatsPayload - Optional guest stats payload
 * @returns {Promise<{user: {id, username}}>}
 */
export async function register(username, password, guestId = null, migrateProgress = false, guestStatsPayload = null) {
  const data = await requestJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      guestId,
      migrateProgress,
      guestStatsPayload
    })
  });
  return data;
}

/**
 * Login to account
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {string} guestId - Optional guest ID for migration
 * @param {boolean} migrateProgress - Whether to migrate guest progress
 * @param {Object} guestStatsPayload - Optional guest stats payload
 * @returns {Promise<{user: {id, username}}>}
 */
export async function login(username, password, guestId = null, migrateProgress = false, guestStatsPayload = null) {
  const data = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      guestId,
      migrateProgress,
      guestStatsPayload
    })
  });
  return data;
}

/**
 * Logout
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await requestJson('/auth/logout', {
      method: 'POST'
    });
  } catch (error) {
    console.error('[Auth] Error logging out:', error);
    // Continue even if logout fails
  }
}
