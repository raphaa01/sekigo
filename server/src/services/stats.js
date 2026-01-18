/**
 * Statistics Service
 * 
 * Manages player statistics:
 * - Total games played
 * - Wins/Losses
 * - Win rate
 * - Current rating
 * 
 * Supports both:
 * - Database persistence for logged-in accounts (UUID userId)
 * - In-memory storage for guests (guest-* userId)
 */

import { ratingService } from './rating.js';
import { db } from '../db/connection.js';
import { getIdentityKey } from './identity.js';

// In-memory storage for guests (cache only, not primary storage)
const guestStats = new Map(); // guestId -> Map<boardSize, stats>

/**
 * Check if userId is a guest (starts with "guest-")
 */
function isGuest(userId) {
  return typeof userId === 'string' && userId.startsWith('guest-');
}

/**
 * Convert userId to guest_key format for guests
 * Format: "g:<guestId>"
 */
function toGuestKey(userId) {
  if (!userId || typeof userId !== 'string') {
    return null;
  }
  
  // Already in guest_key format?
  if (userId.startsWith('g:')) {
    return userId;
  }
  
  // Convert to guest_key format
  if (isGuest(userId)) {
    return `g:${userId}`;
  }
  
  return null; // Not a guest
}

class StatsService {
  /**
   * Record a game result for a player
   * @param {string} userId - User ID
   * @param {boolean} won - Whether player won (null for draw)
   * @param {number} ratingChange - Rating change (+/-)
   * @param {number} boardSize - Board size
   * @returns {Promise<void>}
   */
  /**
   * Get guest stats from database
   * @param {string} guestKey - Guest key in format "g:<guestId>"
   * @param {number} boardSize - Board size
   * @returns {Promise<Object>} Stats object with defaults if missing
   */
  async getGuestStats(guestKey, boardSize) {
    try {
      const result = await db.query(
        'SELECT games, wins, losses, draws, avg_moves, highest_rating FROM guest_stats WHERE guest_key = $1 AND board_size = $2',
        [guestKey, boardSize]
      );
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          games: row.games || 0,
          wins: row.wins || 0,
          losses: row.losses || 0,
          draws: row.draws || 0,
          avgMoves: parseFloat(row.avg_moves) || 0.0,
          highestRating: row.highest_rating || 1500
        };
      }
      
      // Return defaults if missing
      return {
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        avgMoves: 0.0,
        highestRating: 1500
      };
    } catch (error) {
      console.error('[Stats] Error getting guest stats from DB:', error);
      return {
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        avgMoves: 0.0,
        highestRating: 1500
      };
    }
  }

  /**
   * Upsert guest stats to database
   * @param {string} guestKey - Guest key in format "g:<guestId>"
   * @param {number} boardSize - Board size
   * @param {Object} newStats - New stats object
   */
  async upsertGuestStats(guestKey, boardSize, newStats) {
    const { games, wins, losses, draws, avgMoves = 0.0, highestRating } = newStats;
    
    await db.query(
      `INSERT INTO guest_stats (guest_key, board_size, games, wins, losses, draws, avg_moves, highest_rating, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (guest_key, board_size) DO UPDATE
       SET games = EXCLUDED.games,
           wins = EXCLUDED.wins,
           losses = EXCLUDED.losses,
           draws = EXCLUDED.draws,
           avg_moves = EXCLUDED.avg_moves,
           highest_rating = EXCLUDED.highest_rating,
           updated_at = CURRENT_TIMESTAMP`,
      [guestKey, boardSize, games, wins, losses, draws, avgMoves, highestRating]
    );
  }

  async recordGameResult(userId, won, ratingChange, boardSize = 19) {
    if (isGuest(userId)) {
      // Guest: Use guest_stats table
      const guestKey = toGuestKey(userId);
      if (!guestKey) {
        console.error('[Stats] Invalid guest userId:', userId);
        return;
      }

      try {
        const currentRating = await ratingService.getRating(userId, boardSize);
        
        // Get existing stats from guest_stats table
        const existing = await this.getGuestStats(guestKey, boardSize);
        
        const newGames = existing.games + 1;
        const newWins = existing.wins + (won === true ? 1 : 0);
        const newLosses = existing.losses + (won === false ? 1 : 0);
        const newDraws = existing.draws + (won === null ? 1 : 0);
        const newHighest = Math.max(existing.highestRating, currentRating);
        
        // Upsert into guest_stats
        await this.upsertGuestStats(guestKey, boardSize, {
          games: newGames,
          wins: newWins,
          losses: newLosses,
          draws: newDraws,
          avgMoves: existing.avgMoves, // TODO: Calculate from game moves
          highestRating: newHighest
        });
        
        // Update in-memory cache (optional, for fast access)
        if (!guestStats.has(userId)) {
          guestStats.set(userId, new Map());
        }
        const userStats = guestStats.get(userId);
        userStats.set(boardSize, {
          gamesPlayed: newGames,
          wins: newWins,
          losses: newLosses,
          draws: newDraws,
          winRate: newGames > 0 ? (newWins / newGames) * 100 : 0,
          highestRating: newHighest
        });
        
        console.log(`[Stats] ✅ Updated guest stats: guestKey=${guestKey}, boardSize=${boardSize}, games=${newGames}, wins=${newWins}, losses=${newLosses}, rating=${currentRating}, ratingChange=${ratingChange > 0 ? '+' : ''}${ratingChange}`);
      } catch (error) {
        console.error('[Stats] Error updating guest stats in DB, falling back to in-memory:', error);
        // Fallback to in-memory (should not happen, but keep for safety)
        if (!guestStats.has(userId)) {
          guestStats.set(userId, new Map());
        }
        const userStats = guestStats.get(userId);
        
        if (!userStats.has(boardSize)) {
          const rating = await ratingService.getRating(userId, boardSize);
          userStats.set(boardSize, {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            highestRating: rating
          });
        }
        
        const stat = userStats.get(boardSize);
        stat.gamesPlayed++;
        
        if (won === true) {
          stat.wins++;
        } else if (won === false) {
          stat.losses++;
        } else {
          stat.draws++;
        }
        
        if (stat.gamesPlayed > 0) {
          stat.winRate = (stat.wins / stat.gamesPlayed) * 100;
        }
        
        const currentRating = await ratingService.getRating(userId, boardSize);
        if (currentRating > stat.highestRating) {
          stat.highestRating = currentRating;
        }
      }
    } else {
      // Account: Use unified_player_stats (or player_stats for backward compatibility)
      try {
        const currentRating = await ratingService.getRating(userId, boardSize);
        const currentGames = await ratingService.getGamesPlayed(userId, boardSize);
        
        // Get existing stats
        const existing = await db.query(
          'SELECT games_played, wins, losses, draws, highest_rating FROM player_stats WHERE user_id = $1 AND board_size = $2',
          [userId, boardSize]
        );
        
        const existingGames = existing.rows[0]?.games_played || 0;
        const existingWins = existing.rows[0]?.wins || 0;
        const existingLosses = existing.rows[0]?.losses || 0;
        const existingDraws = existing.rows[0]?.draws || 0;
        const existingHighest = existing.rows[0]?.highest_rating || currentRating;
        
        const newGames = existingGames + 1;
        const newWins = existingWins + (won === true ? 1 : 0);
        const newLosses = existingLosses + (won === false ? 1 : 0);
        const newDraws = existingDraws + (won === null ? 1 : 0);
        const newWinRate = newGames > 0 ? (newWins / newGames) * 100 : 0;
        const newHighest = Math.max(existingHighest, currentRating);
        
        await db.query(
          `INSERT INTO player_stats (user_id, board_size, games_played, wins, losses, draws, win_rate, highest_rating, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, board_size) DO UPDATE
           SET games_played = EXCLUDED.games_played,
               wins = EXCLUDED.wins,
               losses = EXCLUDED.losses,
               draws = EXCLUDED.draws,
               win_rate = EXCLUDED.win_rate,
               highest_rating = EXCLUDED.highest_rating,
               updated_at = CURRENT_TIMESTAMP`,
          [userId, boardSize, newGames, newWins, newLosses, newDraws, newWinRate, newHighest]
        );
        
        console.log(`[Stats] ✅ Updated account stats for ${userId} (${boardSize}x${boardSize}): ${won === true ? 'Win' : won === false ? 'Loss' : 'Draw'}, Rating: ${ratingChange > 0 ? '+' : ''}${ratingChange}`);
      } catch (error) {
        console.error('[Stats] Error updating stats in DB, falling back to in-memory:', error);
        // Fallback to in-memory
        if (!guestStats.has(userId)) {
          guestStats.set(userId, new Map());
        }
        const userStats = guestStats.get(userId);
        
        if (!userStats.has(boardSize)) {
          const rating = await ratingService.getRating(userId, boardSize);
          userStats.set(boardSize, {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            highestRating: rating
          });
        }
        
        const stat = userStats.get(boardSize);
        stat.gamesPlayed++;
        
        if (won === true) {
          stat.wins++;
        } else if (won === false) {
          stat.losses++;
        } else {
          stat.draws++;
        }
        
        if (stat.gamesPlayed > 0) {
          stat.winRate = (stat.wins / stat.gamesPlayed) * 100;
        }
        
        const currentRating = await ratingService.getRating(userId, boardSize);
        if (currentRating > stat.highestRating) {
          stat.highestRating = currentRating;
        }
      }
    }
  }

  /**
   * Get player statistics for a specific board size
   * @param {string} userId - User ID
   * @param {number} boardSize - Board size
   * @returns {Promise<Object>} Player statistics
   */
  async getPlayerStats(userId, boardSize = 19) {
    if (isGuest(userId)) {
      // Guest: Use guest_stats table
      const guestKey = toGuestKey(userId);
      if (!guestKey) {
        console.error('[Stats] Invalid guest userId:', userId);
        const rating = await ratingService.getRating(userId, boardSize);
        const rank = await ratingService.getPlayerRank(userId, boardSize);
        return {
          userId,
          boardSize,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          currentRating: rating,
          currentRank: rank,
          highestRating: rating
        };
      }

      try {
        const rating = await ratingService.getRating(userId, boardSize);
        const rank = await ratingService.getPlayerRank(userId, boardSize);
        
        // Get stats from guest_stats table
        const dbStats = await this.getGuestStats(guestKey, boardSize);
        
        // Update in-memory cache
        if (!guestStats.has(userId)) {
          guestStats.set(userId, new Map());
        }
        const userStats = guestStats.get(userId);
        userStats.set(boardSize, {
          gamesPlayed: dbStats.games,
          wins: dbStats.wins,
          losses: dbStats.losses,
          draws: dbStats.draws,
          winRate: dbStats.games > 0 ? (dbStats.wins / dbStats.games) * 100 : 0,
          highestRating: dbStats.highestRating
        });
        
        console.log(`[Stats] 📊 Retrieved guest stats: guestKey=${guestKey}, boardSize=${boardSize}, games=${dbStats.games}, wins=${dbStats.wins}, losses=${dbStats.losses}, rating=${rating}`);
        
        return {
          userId,
          boardSize,
          gamesPlayed: dbStats.games,
          wins: dbStats.wins,
          losses: dbStats.losses,
          draws: dbStats.draws,
          winRate: dbStats.games > 0 ? (dbStats.wins / dbStats.games) * 100 : 0,
          currentRating: rating,
          currentRank: rank,
          highestRating: dbStats.highestRating
        };
      } catch (error) {
        console.error('[Stats] Error getting guest stats from DB, falling back to in-memory:', error);
        // Fallback to in-memory
        if (!guestStats.has(userId)) {
          guestStats.set(userId, new Map());
        }
        const userStats = guestStats.get(userId);
        
        if (!userStats.has(boardSize)) {
          const rating = await ratingService.getRating(userId, boardSize);
          const rank = await ratingService.getPlayerRank(userId, boardSize);
          
          return {
            userId,
            boardSize,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            currentRating: rating,
            currentRank: rank,
            highestRating: rating
          };
        }
        
        const stat = userStats.get(boardSize);
        const rating = await ratingService.getRating(userId, boardSize);
        const rank = await ratingService.getPlayerRank(userId, boardSize);
        
        return {
          userId,
          boardSize,
          gamesPlayed: stat.gamesPlayed,
          wins: stat.wins,
          losses: stat.losses,
          draws: stat.draws,
          winRate: stat.winRate,
          currentRating: rating,
          currentRank: rank,
          highestRating: stat.highestRating
        };
      }
    } else {
      // Account: Use player_stats table
      try {
        const rating = await ratingService.getRating(userId, boardSize);
        const rank = await ratingService.getPlayerRank(userId, boardSize);
        
        const result = await db.query(
          'SELECT games_played, wins, losses, draws, win_rate, highest_rating FROM player_stats WHERE user_id = $1 AND board_size = $2',
          [userId, boardSize]
        );
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          return {
            userId,
            boardSize,
            gamesPlayed: row.games_played,
            wins: row.wins,
            losses: row.losses,
            draws: row.draws,
            winRate: parseFloat(row.win_rate) || 0,
            currentRating: rating,
            currentRank: rank,
            highestRating: row.highest_rating || rating
          };
        }
        
        // Return defaults if no stats exist
        return {
          userId,
          boardSize,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          currentRating: rating,
          currentRank: rank,
          highestRating: rating
        };
      } catch (error) {
        console.error('[Stats] Error getting stats from DB, falling back to in-memory:', error);
        // Fallback to in-memory
        if (!guestStats.has(userId)) {
          guestStats.set(userId, new Map());
        }
        const userStats = guestStats.get(userId);
        
        if (!userStats.has(boardSize)) {
          const rating = await ratingService.getRating(userId, boardSize);
          const rank = await ratingService.getPlayerRank(userId, boardSize);
          
          return {
            userId,
            boardSize,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            currentRating: rating,
            currentRank: rank,
            highestRating: rating
          };
        }
        
        const stat = userStats.get(boardSize);
        const rating = await ratingService.getRating(userId, boardSize);
        const rank = await ratingService.getPlayerRank(userId, boardSize);
        
        return {
          userId,
          boardSize,
          gamesPlayed: stat.gamesPlayed,
          wins: stat.wins,
          losses: stat.losses,
          draws: stat.draws,
          winRate: stat.winRate,
          currentRating: rating,
          currentRank: rank,
          highestRating: stat.highestRating
        };
      }
    }
  }

  /**
   * Get leaderboard (top players by rating across all board sizes)
   * Returns the highest rating for each player across all board sizes
   * @param {number} limit - Number of players to return
   * @returns {Promise<Array>} Array of player stats
   */
  async getLeaderboard(limit = 10) {
    try {
      console.log('[Stats] Fetching leaderboard...');
      
      // First, let's check what tables exist and what data is in them
      let ratingsCount = 0;
      let guestRatingsCount = 0;
      
      try {
        const checkRatings = await db.query(`SELECT COUNT(*) as count FROM ratings`);
        ratingsCount = parseInt(checkRatings.rows[0].count);
        console.log(`[Stats] Ratings table: ${ratingsCount} rows`);
      } catch (err) {
        console.error('[Stats] Error checking ratings table:', err.message);
      }
      
      try {
        const checkGuestRatings = await db.query(`SELECT COUNT(*) as count FROM guest_ratings`);
        guestRatingsCount = parseInt(checkGuestRatings.rows[0].count);
        console.log(`[Stats] Guest ratings table: ${guestRatingsCount} rows`);
      } catch (err) {
        console.error('[Stats] Error checking guest_ratings table:', err.message);
        console.log('[Stats] guest_ratings table might not exist yet');
      }
      
      // Get all ratings from accounts - try with board_size first
      let accountResult;
      try {
        // Check if board_size column exists
        const columnCheck = await db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'ratings' AND column_name = 'board_size'
        `);
        
        if (columnCheck.rows.length > 0) {
          // board_size exists - use it
          console.log('[Stats] board_size column exists in ratings table');
          accountResult = await db.query(
            `SELECT 
               u.id, 
               u.username, 
               r.rating,
               r.board_size,
               COALESCE(ps.games_played, 0) as games_played,
               COALESCE(ps.wins, 0) as wins,
               COALESCE(ps.losses, 0) as losses
             FROM users u
             JOIN ratings r ON r.user_id = u.id
             LEFT JOIN player_stats ps ON r.user_id = ps.user_id AND r.board_size = ps.board_size
             WHERE u.is_guest = FALSE
            `
          );
          console.log(`[Stats] Found ${accountResult.rows.length} account ratings (with board_size)`);
        } else {
          // board_size doesn't exist - try without it
          console.log('[Stats] board_size column does NOT exist in ratings table');
          
          // Check if is_guest column exists in users table
          const isGuestCheck = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_guest'
          `);
          
          if (isGuestCheck.rows.length > 0) {
            // is_guest exists
            accountResult = await db.query(
              `SELECT 
                 u.id, 
                 u.username, 
                 r.rating,
                 NULL as board_size,
                 COALESCE(ps.games_played, 0) as games_played,
                 COALESCE(ps.wins, 0) as wins,
                 COALESCE(ps.losses, 0) as losses
               FROM users u
               JOIN ratings r ON r.user_id = u.id
               LEFT JOIN player_stats ps ON r.user_id = ps.user_id
               WHERE u.is_guest = FALSE
              `
            );
          } else {
            // is_guest doesn't exist - assume all users in users table are accounts
            console.log('[Stats] is_guest column does NOT exist, assuming all users are accounts');
            accountResult = await db.query(
              `SELECT 
                 u.id, 
                 u.username, 
                 r.rating,
                 NULL as board_size,
                 COALESCE(ps.games_played, 0) as games_played,
                 COALESCE(ps.wins, 0) as wins,
                 COALESCE(ps.losses, 0) as losses
               FROM users u
               JOIN ratings r ON r.user_id = u.id
               LEFT JOIN player_stats ps ON r.user_id = ps.user_id
              `
            );
          }
          console.log(`[Stats] Found ${accountResult.rows.length} account ratings (without board_size)`);
        }
      } catch (err) {
        console.error('[Stats] ❌ Error querying account ratings:', err.message);
        console.error('[Stats] Error stack:', err.stack);
        accountResult = { rows: [] };
      }
      
      // Get all ratings from guests
      let guestResult = { rows: [] };
      try {
        // Check if guest_ratings table exists first
        const tableCheck = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'guest_ratings'
          )
        `);
        
        if (tableCheck.rows[0].exists) {
          guestResult = await db.query(
            `SELECT 
               gr.guest_key as id,
               NULL as username,
               gr.rating,
               gr.board_size,
               COALESCE(gs.games, 0) as games_played,
               COALESCE(gs.wins, 0) as wins,
               COALESCE(gs.losses, 0) as losses
             FROM guest_ratings gr
             LEFT JOIN guest_stats gs ON gr.guest_key = gs.guest_key AND gr.board_size = gs.board_size
            `
          );
          console.log(`[Stats] Found ${guestResult.rows.length} guest ratings`);
        } else {
          console.log('[Stats] guest_ratings table does not exist, skipping');
        }
      } catch (err) {
        console.error('[Stats] ❌ Error querying guest ratings:', err.message);
        console.error('[Stats] Error details:', err.stack);
        guestResult = { rows: [] };
      }
      
      // Combine accounts and guests, get max rating per player
      const allPlayers = new Map();
      
      // Process accounts - keep highest rating per user
      accountResult.rows.forEach(row => {
        const existing = allPlayers.get(row.id);
        if (!existing || row.rating > existing.rating) {
          allPlayers.set(row.id, {
            id: row.id,
            username: row.username,
            rating: row.rating,
            games_played: row.games_played,
            wins: row.wins,
            losses: row.losses,
            isGuest: false
          });
        }
      });
      
      // Process guests - keep highest rating per guest
      guestResult.rows.forEach(row => {
        const existing = allPlayers.get(row.id);
        if (!existing || row.rating > existing.rating) {
          allPlayers.set(row.id, {
            id: row.id,
            username: null,
            rating: row.rating,
            games_played: row.games_played,
            wins: row.wins,
            losses: row.losses,
            isGuest: true
          });
        }
      });
      
      console.log(`[Stats] Combined ${allPlayers.size} unique players`);
      
      // Sort by rating descending and limit
      const sorted = Array.from(allPlayers.values())
        .sort((a, b) => b.rating - a.rating)
        .slice(0, limit);
      
      console.log(`[Stats] Leaderboard: ${sorted.length} players found (showing top ${limit})`);
      if (sorted.length > 0) {
        console.log(`[Stats] Top player: ${sorted[0].username || 'Guest'} with rating ${sorted[0].rating}`);
      } else {
        console.log('[Stats] ⚠️ No players found in leaderboard!');
      }
      return sorted;
    } catch (error) {
      console.error('[Stats] Error getting leaderboard:', error);
      console.error('[Stats] Error details:', error.stack);
      return [];
    }
  }
}

export const statsService = new StatsService();
