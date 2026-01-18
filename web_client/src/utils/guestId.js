/**
 * Guest User ID Generator
 * 
 * Generates a unique user ID per browser tab.
 * - deviceId: stored in localStorage (persists across reloads, shared across tabs)
 * - tabId: stored in sessionStorage (unique per tab, cleared when tab closes)
 * - userId: "guest-{deviceId}-{tabId}" (unique per tab)
 */

const DEVICE_ID_KEY = 'goPlatformDeviceId';
const TAB_ID_KEY = 'goPlatformTabId';

/**
 * Generate a UUID
 * @returns {string} UUID string
 */
function generateUUID() {
  try {
    return crypto.randomUUID();
  } catch (error) {
    // Fallback for older browsers
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Get or create a guest user ID (unique per tab)
 * @returns {string} Guest user ID (format: "guest-{deviceId}-{tabId}")
 */
export function getGuestUserId() {
  // Get or create deviceId (persists across reloads, shared across tabs)
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log('[Guest ID] Generated new deviceId:', deviceId);
  }

  // Get or create tabId (unique per tab, cleared when tab closes)
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = generateUUID();
    sessionStorage.setItem(TAB_ID_KEY, tabId);
    console.log('[Guest ID] Generated new tabId:', tabId);
  }

  const userId = `guest-${deviceId}-${tabId}`;
  console.log('[Guest ID] Current userId:', userId, '(deviceId:', deviceId, ', tabId:', tabId + ')');
  
  return userId;
}
