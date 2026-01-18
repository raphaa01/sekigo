import express from 'express';
import { signup, login, getUserFromToken } from '../services/auth.js';

const router = express.Router();

/**
 * Register a new account
 * POST /api/auth/register
 * Body: { username, password, guestId?, migrateProgress?, guestStatsPayload? }
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, guestId, migrateProgress = false, guestStatsPayload } = req.body || {};
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await signup(username, password, guestId, migrateProgress, guestStatsPayload);
    
    // Set httpOnly cookie
    res.cookie('session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ user: result.user, loggedIn: true });
  } catch (error) {
    console.error('[Auth] Signup error:', error);
    
    if (error.message === 'Username already taken') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('must be') || error.message.includes('can only contain')) {
      return res.status(400).json({ error: error.message });
    }
    
    // Return the actual error message if available, otherwise generic message
    const errorMessage = error.message || 'Signup failed';
    return res.status(400).json({ error: errorMessage });
  }
});

/**
 * Login to account
 * POST /api/auth/login
 * Body: { username, password, guestId?, migrateProgress?, guestStatsPayload? }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, guestId, migrateProgress = false, guestStatsPayload } = req.body || {};
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await login(username, password, guestId, migrateProgress, guestStatsPayload);
    
    // Set httpOnly cookie
    res.cookie('session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ user: result.user, loggedIn: true });
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: error.message });
    }
    console.error('[Auth] Login error:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

/**
 * Logout
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ loggedIn: false, message: 'Logged out successfully' });
});

/**
 * Get current user
 * GET /api/auth/me
 * Returns: { loggedIn: boolean, user: {id, username} | null }
 */
router.get('/me', async (req, res) => {
  try {
    // Try to get token from cookie first, then from Authorization header
    const token = req.cookies?.session || (req.headers.authorization?.split(' ')[1]);
    
    if (!token) {
      return res.json({ loggedIn: false, user: null });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      res.clearCookie('session');
      return res.json({ loggedIn: false, user: null });
    }

    res.json({ loggedIn: true, user });
  } catch (error) {
    console.error('[Auth] /me error:', error);
    res.json({ loggedIn: false, user: null });
  }
});

export default router;

