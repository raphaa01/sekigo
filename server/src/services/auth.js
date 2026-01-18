import { db } from '../db/connection.js';
import bcrypt from 'bcryptjs';
import { signToken, verifyToken } from './jwt.js';

async function findUserByUsername(username) {
  try {
    // Try with all columns, fallback if columns don't exist
    let result;
    try {
      result = await db.query(
        'SELECT id, username, password_hash, is_guest, email, created_at FROM users WHERE username = $1',
        [username]
      );
    } catch (error) {
      // If columns don't exist, try without them
      if (error.message && (error.message.includes('is_guest') || error.message.includes('email'))) {
        try {
          result = await db.query(
            'SELECT id, username, password_hash, created_at FROM users WHERE username = $1',
            [username]
          );
        } catch (error2) {
          // Try with just basic columns
          result = await db.query(
            'SELECT id, username, password_hash FROM users WHERE username = $1',
            [username]
          );
        }
        // Add missing fields with defaults
        if (result.rows[0]) {
          if (!result.rows[0].is_guest) {
            result.rows[0].is_guest = false;
          }
        }
      } else {
        throw error;
      }
    }
    return result.rows[0] || null;
  } catch (error) {
    console.error('[Auth] Error finding user by username:', error);
    return null;
  }
}

async function findUserById(id) {
  try {
    // Try with all columns, fallback if columns don't exist
    let result;
    try {
      result = await db.query(
        'SELECT id, username, password_hash, is_guest, email, created_at FROM users WHERE id = $1',
        [id]
      );
    } catch (error) {
      // If columns don't exist, try without them
      if (error.message && (error.message.includes('is_guest') || error.message.includes('email'))) {
        try {
          result = await db.query(
            'SELECT id, username, password_hash, created_at FROM users WHERE id = $1',
            [id]
          );
        } catch (error2) {
          // Try with just basic columns
          result = await db.query(
            'SELECT id, username, password_hash FROM users WHERE id = $1',
            [id]
          );
        }
        // Add missing fields with defaults
        if (result.rows[0]) {
          if (!result.rows[0].is_guest) {
            result.rows[0].is_guest = false;
          }
        }
      } else {
        throw error;
      }
    }
    return result.rows[0] || null;
  } catch (error) {
    console.error('[Auth] Error finding user by id:', error);
    return null;
  }
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    isGuest: row.is_guest
  };
}

/**
 * Validate username and password
 */
function validateCredentials(username, password) {
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    throw new Error('Username must be at least 3 characters');
  }
  if (username.length > 50) {
    throw new Error('Username must be at most 50 characters');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  if (password.length > 100) {
    throw new Error('Password must be at most 100 characters');
  }
}

/**
 * Get guest progress from guest_progress table
 */
async function getGuestProgress(guestId) {
  try {
    const result = await db.query(
      'SELECT board_size, rating, games_played, wins, losses, draws, win_rate, highest_rating FROM guest_progress WHERE guest_id = $1',
      [guestId]
    );
    return result.rows;
  } catch (error) {
    console.error('[Auth] Error getting guest progress:', error);
    return [];
  }
}

/**
 * Migrate guest progress to account
 */
async function migrateGuestProgress(userId, guestId, guestStatsPayload = null) {
  try {
    // Get guest progress from DB or use provided payload
    let guestProgress = guestStatsPayload;
    if (!guestProgress) {
      const dbProgress = await getGuestProgress(guestId);
      guestProgress = {};
      for (const row of dbProgress) {
        guestProgress[row.board_size] = {
          rating: row.rating,
          gamesPlayed: row.games_played,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          winRate: row.win_rate,
          highestRating: row.highest_rating
        };
      }
    }

    // Migrate each board size
    for (const [boardSizeStr, stats] of Object.entries(guestProgress || {})) {
      const boardSize = parseInt(boardSizeStr, 10);
      if (![9, 13, 19].includes(boardSize)) continue;

      // Check if account already has stats for this board size
      const existingRating = await db.query(
        'SELECT rating, games_played FROM ratings WHERE user_id = $1 AND board_size = $2',
        [userId, boardSize]
      );
      const existingStats = await db.query(
        'SELECT games_played FROM player_stats WHERE user_id = $1 AND board_size = $2',
        [userId, boardSize]
      );

      const accountHasGames = existingStats.rows[0]?.games_played > 0;
      const guestHasGames = stats.gamesPlayed > 0;

      // Migration rule: if guest has games and account doesn't, migrate
      if (guestHasGames && !accountHasGames) {
        // Insert/update rating
        await db.query(
          `INSERT INTO ratings (user_id, board_size, rating, games_played)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, board_size) DO UPDATE
           SET rating = EXCLUDED.rating, games_played = EXCLUDED.games_played, updated_at = CURRENT_TIMESTAMP`,
          [userId, boardSize, stats.rating || 1500, stats.gamesPlayed || 0]
        );

        // Insert/update stats
        await db.query(
          `INSERT INTO player_stats (user_id, board_size, games_played, wins, losses, draws, win_rate, highest_rating)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id, board_size) DO UPDATE
           SET games_played = EXCLUDED.games_played,
               wins = EXCLUDED.wins,
               losses = EXCLUDED.losses,
               draws = EXCLUDED.draws,
               win_rate = EXCLUDED.win_rate,
               highest_rating = EXCLUDED.highest_rating,
               updated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            boardSize,
            stats.gamesPlayed || 0,
            stats.wins || 0,
            stats.losses || 0,
            stats.draws || 0,
            stats.winRate || 0,
            stats.highestRating || stats.rating || 1500
          ]
        );

        console.log(`[Auth] Migrated guest progress for ${guestId} -> ${userId} (${boardSize}x${boardSize})`);
      }
    }

    // Delete guest progress from DB
    await db.query('DELETE FROM guest_progress WHERE guest_id = $1', [guestId]);
  } catch (error) {
    console.error('[Auth] Error migrating guest progress:', error);
    // Don't throw - migration failure shouldn't block registration/login
  }
}

export async function signup(username, password, guestId = null, migrateProgress = false, guestStatsPayload = null) {
  validateCredentials(username, password);

  try {
    const existing = await findUserByUsername(username);
    if (existing) {
      throw new Error('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Try to insert with is_guest, fallback if column doesn't exist
    // Also handle email column if it exists (make it optional)
    let result;
    try {
      // First try with is_guest (and email if needed)
      result = await db.query(
        'INSERT INTO users (username, password_hash, is_guest, email) VALUES ($1, $2, FALSE, $3) RETURNING id, username, is_guest, created_at',
        [username, passwordHash, null] // email = null (optional)
      );
    } catch (error) {
      // If email column doesn't exist or is_guest doesn't exist, try different combinations
      if (error.message && error.message.includes('email')) {
        // email column exists but we can't set it to null, try with default or empty string
        try {
          result = await db.query(
            'INSERT INTO users (username, password_hash, is_guest, email) VALUES ($1, $2, FALSE, $3) RETURNING id, username, is_guest, created_at',
            [username, passwordHash, username + '@go-platform.local'] // Use username as email fallback
          );
        } catch (error2) {
          // If is_guest also doesn't exist
          if (error2.message && error2.message.includes('is_guest')) {
            result = await db.query(
              'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, created_at',
              [username, passwordHash, username + '@go-platform.local']
            );
            if (result.rows[0]) {
              result.rows[0].is_guest = false;
            }
          } else {
            throw error2;
          }
        }
      } else if (error.message && error.message.includes('is_guest')) {
        // is_guest doesn't exist, but email might
        try {
          result = await db.query(
            'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, created_at',
            [username, passwordHash, username + '@go-platform.local']
          );
          if (result.rows[0]) {
            result.rows[0].is_guest = false;
          }
        } catch (error2) {
          // Neither email nor is_guest exist
          result = await db.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
            [username, passwordHash]
          );
          if (result.rows[0]) {
            result.rows[0].is_guest = false;
          }
        }
      } else {
        throw error;
      }
    }

    if (!result.rows || result.rows.length === 0) {
      throw new Error('Failed to create user account');
    }

    const user = mapUser(result.rows[0]);
    const token = signToken(user.id);

    // Migrate guest progress if requested
    if (migrateProgress && guestId) {
      await migrateGuestProgress(user.id, guestId, guestStatsPayload);
    }

    return { user, token };
  } catch (error) {
    // Re-throw known errors
    if (error.message === 'Username already taken' || 
        error.message.includes('must be') || 
        error.message.includes('can only contain')) {
      throw error;
    }
    
    // Check if it's a DB connection error
    if (error.message && (error.message.includes('not initialized') || error.message.includes('ECONNREFUSED'))) {
      console.error('[Auth] Database connection error during signup:', error);
      throw new Error('Database connection failed. Please check if the database is running.');
    }
    
    // Generic error
    console.error('[Auth] Signup error:', error);
    throw new Error(error.message || 'Signup failed. Please try again.');
  }
}

export async function login(username, password, guestId = null, migrateProgress = false, guestStatsPayload = null) {
  const userRow = await findUserByUsername(username);
  // Check if user exists and is not a guest (is_guest might be undefined if column doesn't exist)
  if (!userRow || (userRow.is_guest === true)) {
    throw new Error('Invalid credentials');
  }

  if (!userRow.password_hash) {
    throw new Error('Invalid credentials');
  }

  const passwordMatches = await bcrypt.compare(password, userRow.password_hash);
  if (!passwordMatches) {
    throw new Error('Invalid credentials');
  }

  const user = mapUser(userRow);
  const token = signToken(user.id);

  // Migrate guest progress if requested
  if (migrateProgress && guestId) {
    await migrateGuestProgress(user.id, guestId, guestStatsPayload);
  }

  return { user, token };
}

export async function getUserFromId(id) {
  const row = await findUserById(id);
  return mapUser(row);
}

/**
 * Get user from JWT token (from cookie or header)
 */
export async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const decoded = verifyToken(token);
    return await getUserFromId(decoded.sub);
  } catch (error) {
    return null;
  }
}

