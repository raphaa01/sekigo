/**
 * Main entry point for the SekiGo Server
 * 
 * This server handles:
 * - HTTP API endpoints (for future REST API usage)
 * - WebSocket connections for real-time gameplay
 * - Matchmaking and game state management
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { matchmakingService } from './services/matchmaking.js';
import { gameManager } from './services/gameManager.js';
import { websocketHandler } from './websocket/handler.js';
import { initDatabase } from './db/connection.js';
import authRouter from './routes/auth.js';
import { statsService } from './services/stats.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Id'] // Allow X-Guest-Id header
}));

// Request logging (dev-friendly)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
  });
}

// Middleware
app.use(express.json());
app.use(cookieParser());

// Auth routes
app.use('/api/auth', authRouter);

// Legacy endpoints (redirect to /api/auth/me)
app.get('/me', (req, res) => res.redirect('/api/auth/me'));
app.get('/api/me', (req, res) => res.redirect('/api/auth/me'));

// Stats endpoint - supports both logged-in users and guests
async function handleGetStats(req, res) {
  try {
    const boardSizeParam = req.query.boardSize;
    
    // Validate boardSize
    if (!boardSizeParam) {
      return res.status(400).json({ error: 'boardSize is required' });
    }
    
    const boardSize = parseInt(boardSizeParam, 10);
    if (isNaN(boardSize) || ![9, 13, 19].includes(boardSize)) {
      return res.status(400).json({ error: 'boardSize must be 9, 13, or 19' });
    }
    
    // Get identity using canonical resolver
    const { getIdentityFromRequest } = await import('./services/identity.js');
    const identity = await getIdentityFromRequest(req);
    
    if (!identity) {
      console.error(`[API] ❌ No identity found for stats request (boardSize: ${boardSize})`);
      return res.status(400).json({ error: 'User identity is required. Please log in or provide guestId.' });
    }
    
    const guestKey = identity.kind === 'guest' ? `g:${identity.id}` : null;
    console.log(`[API] 📊 Stats request - identity: ${identity.kind}:${identity.id}, boardSize: ${boardSize}${guestKey ? `, guestKey: ${guestKey}` : ''}`);
    
    // Get stats using identity.id
    const stats = await statsService.getPlayerStats(identity.id, boardSize);
    
    // Ensure we ALWAYS return the same JSON shape with defaults
    const response = {
      identity: {
        kind: identity.kind,
        id: identity.id,
        ...(identity.username && { username: identity.username })
      },
      boardSize: boardSize,
      rating: stats?.currentRating || stats?.rating || 1500,
      rankDisplay: stats?.currentRank || stats?.rank || '30k',
      stats: {
        games: stats?.gamesPlayed || 0,
        wins: stats?.wins || 0,
        losses: stats?.losses || 0,
        draws: stats?.draws || 0,
        winrate: stats?.winRate || 0,
        highestRating: stats?.highestRating || stats?.currentRating || 1500
      }
    };
    
    console.log(`[API] ✅ Stats response for ${identity.kind}:${identity.id} - games: ${response.stats.games}, rating: ${response.rating}, rank: ${response.rankDisplay}`);
    
    // Ensure response is always valid JSON (never HTML/404 page)
    res.setHeader('Content-Type', 'application/json');
    res.json(response);
  } catch (error) {
    console.error('[API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

app.get('/api/stats', handleGetStats);

// Player info endpoint - get player info (username, rating, rank) by userId
async function handleGetPlayerInfo(req, res) {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const boardSize = parseInt(req.query.boardSize || '19', 10);
    if (isNaN(boardSize) || ![9, 13, 19].includes(boardSize)) {
      return res.status(400).json({ error: 'boardSize must be 9, 13, or 19' });
    }
    
    // Check if user is a guest
    const isGuest = userId && userId.startsWith('guest-');
    
    if (isGuest) {
      // For guests, get stats
      const stats = await statsService.getPlayerStats(userId, boardSize);
      const rating = await (await import('./services/rating.js')).ratingService.getRating(userId, boardSize);
      const rank = await (await import('./services/rating.js')).ratingService.getPlayerRank(userId, boardSize);
      
      return res.json({
        userId,
        username: null, // Guests don't have usernames
        isGuest: true,
        rating: stats?.currentRating || rating || 1500,
        rank: stats?.currentRank || rank || '30k'
      });
    } else {
      // For accounts, get username from database
      const { db } = await import('./db/connection.js');
      const userResult = await db.query('SELECT id, username FROM users WHERE id = $1', [userId]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = userResult.rows[0];
      const stats = await statsService.getPlayerStats(userId, boardSize);
      const rating = await (await import('./services/rating.js')).ratingService.getRating(userId, boardSize);
      const rank = await (await import('./services/rating.js')).ratingService.getPlayerRank(userId, boardSize);
      
      return res.json({
        userId,
        username: user.username,
        isGuest: false,
        rating: stats?.currentRating || rating || 1500,
        rank: stats?.currentRank || rank || '30k'
      });
    }
  } catch (error) {
    console.error('[API] Error fetching player info:', error);
    res.status(500).json({ error: 'Failed to fetch player info' });
  }
}

app.get('/api/player-info', handleGetPlayerInfo);

// Debug endpoint: returns current identity (dev only)
app.get('/api/debug/identity', async (req, res) => {
  try {
    const { getIdentityFromRequest } = await import('./services/identity.js');
    const identity = await getIdentityFromRequest(req);
    
    if (!identity) {
      return res.json({ 
        identity: null,
        message: 'No identity resolved. Provide session cookie or X-Guest-Id header.'
      });
    }
    
    res.json({
      identity: {
        kind: identity.kind,
        id: identity.id,
        ...(identity.username && { username: identity.username })
      },
      identityKey: `${identity.kind}:${identity.id}`,
      message: 'Identity resolved successfully'
    });
  } catch (error) {
    console.error('[API] Error in debug/identity:', error);
    res.status(500).json({ error: 'Failed to resolve identity' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// JSON 404 for unknown /api routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize database connection (optional - server will still work without DB)
try {
  await initDatabase();
} catch (error) {
  console.warn('Database connection failed, continuing without database:', error.message);
  console.warn('Note: Some features may not work without database');
}

// Initialize services
matchmakingService.initialize();
gameManager.initialize();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log(`[WebSocket Server] New connection attempt from ${req.socket.remoteAddress}`);
  websocketHandler.handleConnection(ws, req);
});

wss.on('error', (error) => {
  console.error('[WebSocket Server] Error:', error);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`SekiGo Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}/ws`);
});
