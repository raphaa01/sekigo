/**
 * Rating Service
 * 
 * Manages player ratings using Elo system and converts to Kyu/Dan display.
 * 
 * Supports both:
 * - Database persistence for logged-in accounts (UUID userId)
 * - In-memory storage for guests (guest-* userId)
 */

import { db } from '../db/connection.js';

// In-memory storage for guests (cache only, not primary storage)
const guestRatings = new Map(); // guestId -> Map<boardSize, rating>
const guestGamesPlayed = new Map(); // guestId -> Map<boardSize, count>

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

// Elo rating constants
const K_FACTOR_NEW = 24; // K-factor for players with < 30 games
const K_FACTOR_ESTABLISHED = 16; // K-factor for players with >= 30 games
const INITIAL_RATING = 1500; // Starting rating (approximately 1k-1d)

// Rating to rank mapping
const RANK_THRESHOLDS = [
  { rank: '30k', min: 0, max: 200 },
  { rank: '25k', min: 201, max: 400 },
  { rank: '20k', min: 401, max: 600 },
  { rank: '15k', min: 601, max: 800 },
  { rank: '10k', min: 801, max: 1000 },
  { rank: '5k', min: 1001, max: 1200 },
  { rank: '1k', min: 1201, max: 1500 },
  { rank: '1d', min: 1501, max: 1600 },
  { rank: '2d', min: 1601, max: 1700 },
  { rank: '3d', min: 1701, max: 1800 },
  { rank: '4d', min: 1801, max: 1900 },
  { rank: '5d', min: 1901, max: 2000 },
  { rank: '6d', min: 2001, max: 2100 },
  { rank: '7d', min: 2101, max: 2200 },
  { rank: '8d', min: 2201, max: 2300 },
  { rank: '9d', min: 2301, max: Infinity }
];

class RatingService {
  /**
   * Get player's current rating for a specific board size
   * @param {string} userId - User ID (UUID for accounts, guest-* for guests)
   * @param {number} boardSize - Board size (9, 13, or 19)
   * @returns {Promise<number>} Elo rating
   */
  /**
   * Get guest rating from database
   * @param {string} guestKey - Guest key in format "g:<guestId>"
   * @param {number} boardSize - Board size
   * @returns {Promise<number>} Rating (default 1500 if missing)
   */
  async getGuestRating(guestKey, boardSize) {
    try {
      const result = await db.query(
        'SELECT rating FROM guest_ratings WHERE guest_key = $1 AND board_size = $2',
        [guestKey, boardSize]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0].rating;
      }
      
      // No rating found - return default
      return INITIAL_RATING;
    } catch (error) {
      console.error('[Rating] Error getting guest rating from DB:', error);
      return INITIAL_RATING;
    }
  }

  /**
   * Upsert guest rating to database
   * @param {string} guestKey - Guest key in format "g:<guestId>"
   * @param {number} boardSize - Board size
   * @param {number} newRating - New rating value
   */
  async upsertGuestRating(guestKey, boardSize, newRating) {
    await db.query(
      `INSERT INTO guest_ratings (guest_key, board_size, rating, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (guest_key, board_size) DO UPDATE
       SET rating = EXCLUDED.rating,
           updated_at = CURRENT_TIMESTAMP`,
      [guestKey, boardSize, newRating]
    );
  }

  async getRating(userId, boardSize = 19) {
    if (isGuest(userId)) {
      // Guest: Use guest_ratings table
      const guestKey = toGuestKey(userId);
      if (!guestKey) {
        console.error('[Rating] Invalid guest userId:', userId);
        return INITIAL_RATING;
      }

      try {
        // Get rating from guest_ratings table
        const rating = await this.getGuestRating(guestKey, boardSize);
        
        // Update in-memory cache
        if (!guestRatings.has(userId)) {
          guestRatings.set(userId, new Map());
        }
        guestRatings.get(userId).set(boardSize, rating);
        
        return rating;
      } catch (error) {
        console.error('[Rating] Error getting guest rating from DB, falling back to in-memory:', error);
        // Fallback to in-memory
        if (!guestRatings.has(userId)) {
          guestRatings.set(userId, new Map());
        }
        const userRatings = guestRatings.get(userId);
        
        if (!userRatings.has(boardSize)) {
          userRatings.set(boardSize, INITIAL_RATING);
        }
        
        return userRatings.get(boardSize);
      }
    } else {
      // Account: Use ratings table
      try {
        const result = await db.query(
          'SELECT rating FROM ratings WHERE user_id = $1 AND board_size = $2',
          [userId, boardSize]
        );
        
        if (result.rows.length > 0) {
          return result.rows[0].rating;
        }
        
        // Create default entry
        await db.query(
          'INSERT INTO ratings (user_id, board_size, rating, games_played) VALUES ($1, $2, $3, 0) ON CONFLICT DO NOTHING',
          [userId, boardSize, INITIAL_RATING]
        );
        
        return INITIAL_RATING;
      } catch (error) {
        console.error('[Rating] Error getting rating from DB, falling back to in-memory:', error);
        // Fallback to in-memory
        if (!guestRatings.has(userId)) {
          guestRatings.set(userId, new Map());
        }
        const userRatings = guestRatings.get(userId);
        if (!userRatings.has(boardSize)) {
          userRatings.set(boardSize, INITIAL_RATING);
        }
        return userRatings.get(boardSize);
      }
    }
  }

  /**
   * Get number of games played for a board size
   * @param {string} userId - User ID
   * @param {number} boardSize - Board size
   * @returns {Promise<number>} Number of games played
   */
  async getGamesPlayed(userId, boardSize) {
    if (isGuest(userId)) {
      // Guest: Get from guest_stats table
      const guestKey = toGuestKey(userId);
      if (!guestKey) {
        return 0;
      }

      try {
        const result = await db.query(
          'SELECT games FROM guest_stats WHERE guest_key = $1 AND board_size = $2',
          [guestKey, boardSize]
        );
        
        if (result.rows.length > 0) {
          const gamesPlayed = result.rows[0].games || 0;
          // Update in-memory cache
          if (!guestGamesPlayed.has(userId)) {
            guestGamesPlayed.set(userId, new Map());
          }
          guestGamesPlayed.get(userId).set(boardSize, gamesPlayed);
          return gamesPlayed;
        }
        
        return 0;
      } catch (error) {
        console.error('[Rating] Error getting guest games played from DB, falling back to in-memory:', error);
        // Fallback to in-memory
        if (!guestGamesPlayed.has(userId)) {
          guestGamesPlayed.set(userId, new Map());
        }
        const userGames = guestGamesPlayed.get(userId);
        return userGames.get(boardSize) || 0;
      }
    } else {
      // Account: Use ratings table
      try {
        const result = await db.query(
          'SELECT games_played FROM ratings WHERE user_id = $1 AND board_size = $2',
          [userId, boardSize]
        );
        return result.rows[0]?.games_played || 0;
      } catch (error) {
        console.error('[Rating] Error getting games played from DB:', error);
        return 0;
      }
    }
  }

  /**
   * Update ratings after a game
   * @param {string} player1Id - First player ID
   * @param {string} player2Id - Second player ID
   * @param {string} winnerId - Winner's user ID (null for draw)
   * @param {number} boardSize - Board size (9, 13, or 19)
   * @returns {Promise<Object>} Rating changes for both players
   */
  async updateRatings(player1Id, player2Id, winnerId, boardSize = 19) {
    const rating1 = await this.getRating(player1Id, boardSize);
    const rating2 = await this.getRating(player2Id, boardSize);
    
    const games1 = await this.getGamesPlayed(player1Id, boardSize);
    const games2 = await this.getGamesPlayed(player2Id, boardSize);

    // Calculate K-factor based on games played
    const k1 = games1 < 30 ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED;
    const k2 = games2 < 30 ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED;

    // Calculate expected scores: E = 1/(1+10^((opp-old)/400))
    const expected1 = this.calculateExpectedScore(rating1, rating2);
    const expected2 = this.calculateExpectedScore(rating2, rating1);

    // Determine actual scores (1 for win, 0.5 for draw, 0 for loss)
    const actual1 = winnerId === null ? 0.5 : (player1Id === winnerId ? 1 : 0);
    const actual2 = winnerId === null ? 0.5 : (player2Id === winnerId ? 1 : 0);

    // Calculate new ratings: R_new = R_old + K*(S - E)
    const newRating1 = Math.round(rating1 + k1 * (actual1 - expected1));
    const newRating2 = Math.round(rating2 + k2 * (actual2 - expected2));

    // Calculate rating changes
    const change1 = newRating1 - rating1;
    const change2 = newRating2 - rating2;

    // Update storage (DB for accounts, in-memory for guests)
    await this._updateRatingStorage(player1Id, boardSize, newRating1, games1 + 1);
    await this._updateRatingStorage(player2Id, boardSize, newRating2, games2 + 1);

    return {
      [player1Id]: change1,
      [player2Id]: change2,
    };
  }

  /**
   * Internal: Update rating storage (DB or in-memory)
   */
  async _updateRatingStorage(userId, boardSize, newRating, gamesPlayed) {
    if (isGuest(userId)) {
      // Guest: Use guest_ratings table
      const guestKey = toGuestKey(userId);
      if (!guestKey) {
        console.error('[Rating] Invalid guest userId:', userId);
        return;
      }

      try {
        // Update rating in guest_ratings table
        await this.upsertGuestRating(guestKey, boardSize, newRating);
        
        // Update in-memory cache
        if (!guestRatings.has(userId)) {
          guestRatings.set(userId, new Map());
        }
        if (!guestGamesPlayed.has(userId)) {
          guestGamesPlayed.set(userId, new Map());
        }
        guestRatings.get(userId).set(boardSize, newRating);
        guestGamesPlayed.get(userId).set(boardSize, gamesPlayed);
        
        console.log(`[Rating] ✅ Updated guest rating: guestKey=${guestKey}, boardSize=${boardSize}, rating=${newRating}, gamesPlayed=${gamesPlayed}`);
      } catch (error) {
        console.error('[Rating] Error updating guest rating in DB, falling back to in-memory:', error);
        // Fallback to in-memory
        if (!guestRatings.has(userId)) {
          guestRatings.set(userId, new Map());
        }
        if (!guestGamesPlayed.has(userId)) {
          guestGamesPlayed.set(userId, new Map());
        }
        guestRatings.get(userId).set(boardSize, newRating);
        guestGamesPlayed.get(userId).set(boardSize, gamesPlayed);
      }
    } else {
      // Account: Use ratings table
      try {
        await db.query(
          `INSERT INTO ratings (user_id, board_size, rating, games_played, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, board_size) DO UPDATE
           SET rating = EXCLUDED.rating, games_played = EXCLUDED.games_played, updated_at = CURRENT_TIMESTAMP`,
          [userId, boardSize, newRating, gamesPlayed]
        );
      } catch (error) {
        console.error('[Rating] Error updating rating in DB:', error);
        // Fallback to in-memory
        if (!guestRatings.has(userId)) {
          guestRatings.set(userId, new Map());
        }
        if (!guestGamesPlayed.has(userId)) {
          guestGamesPlayed.set(userId, new Map());
        }
        guestRatings.get(userId).set(boardSize, newRating);
        guestGamesPlayed.get(userId).set(boardSize, gamesPlayed);
      }
    }
  }

  /**
   * Calculate expected score based on Elo ratings
   * @param {number} ratingA - Player A's rating
   * @param {number} ratingB - Player B's rating
   * @returns {number} Expected score (0-1)
   */
  calculateExpectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Convert Elo rating to Kyu/Dan rank string
   * @param {number} rating - Elo rating
   * @returns {string} Rank string (e.g., "5k", "1d", "9d")
   */
  ratingToRank(rating) {
    for (const threshold of RANK_THRESHOLDS) {
      if (rating >= threshold.min && rating <= threshold.max) {
        return threshold.rank;
      }
    }
    return '30k'; // Default fallback
  }

  /**
   * Get player's rank display string
   * @param {string} userId - User ID
   * @param {number} boardSize - Board size
   * @returns {Promise<string>} Rank string
   */
  async getPlayerRank(userId, boardSize = 19) {
    const rating = await this.getRating(userId, boardSize);
    return this.ratingToRank(rating);
  }

  /**
   * Get detailed rating information
   * @param {string} userId - User ID
   * @param {number} boardSize - Board size
   * @returns {Promise<Object>} Rating info with Elo and rank
   */
  async getRatingInfo(userId, boardSize = 19) {
    const rating = await this.getRating(userId, boardSize);
    const rank = this.ratingToRank(rating);
    
    return {
      rating,
      rank,
      display: rank
    };
  }
}

export const ratingService = new RatingService();
