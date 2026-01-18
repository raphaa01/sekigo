/**
 * Rating Tests
 * 
 * Tests for Elo rating system and Kyu/Dan mapping
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ratingService } from '../src/services/rating.js';

describe('Rating Service', () => {
  beforeEach(() => {
    // Clear ratings between tests
    // Note: This relies on internal state, might need to expose reset method
  });

  describe('Rating to Rank Mapping', () => {
    test('should map rating to correct Kyu/Dan rank', () => {
      expect(ratingService.ratingToRank(100)).toBe('30k');
      expect(ratingService.ratingToRank(500)).toBe('20k');
      expect(ratingService.ratingToRank(900)).toBe('10k');
      expect(ratingService.ratingToRank(1300)).toBe('1k');
      expect(ratingService.ratingToRank(1550)).toBe('1d');
      expect(ratingService.ratingToRank(1650)).toBe('2d');
      expect(ratingService.ratingToRank(2000)).toBe('5d');
      expect(ratingService.ratingToRank(2500)).toBe('9d');
    });

    test('should return default rank for edge cases', () => {
      expect(ratingService.ratingToRank(-100)).toBe('30k');
      expect(ratingService.ratingToRank(5000)).toBe('9d');
    });
  });

  describe('Rating Updates', () => {
    test('should update ratings correctly for win', async () => {
      const player1 = 'player1';
      const player2 = 'player2';
      const boardSize = 19;

      // Both start at 1500
      const initialRating1 = await ratingService.getRating(player1, boardSize);
      const initialRating2 = await ratingService.getRating(player2, boardSize);
      expect(initialRating1).toBe(1500);
      expect(initialRating2).toBe(1500);

      // Player 1 wins
      const changes = await ratingService.updateRatings(player1, player2, player1, boardSize);

      const newRating1 = await ratingService.getRating(player1, boardSize);
      const newRating2 = await ratingService.getRating(player2, boardSize);

      // Winner should gain rating, loser should lose rating
      expect(newRating1).toBeGreaterThan(initialRating1);
      expect(newRating2).toBeLessThan(initialRating2);
      expect(changes[player1]).toBeGreaterThan(0);
      expect(changes[player2]).toBeLessThan(0);
    });

    test('should use correct K-factor based on games played', async () => {
      const player1 = 'player_new';
      const player2 = 'player_established';
      const boardSize = 19;

      // Player 2 has 30+ games (simulate by calling updateRatings multiple times)
      for (let i = 0; i < 30; i++) {
        await ratingService.updateRatings(player2, 'dummy', player2, boardSize);
      }

      const initialRating1 = await ratingService.getRating(player1, boardSize);
      const initialRating2 = await ratingService.getRating(player2, boardSize);

      // Player 1 wins (new player, K=24)
      await ratingService.updateRatings(player1, player2, player1, boardSize);

      const newRating1 = await ratingService.getRating(player1, boardSize);
      const newRating2 = await ratingService.getRating(player2, boardSize);

      const change1 = newRating1 - initialRating1;
      const change2 = initialRating2 - newRating2;

      // New player should have larger change (K=24 vs K=16)
      // Note: This is approximate since expected score also matters
      expect(Math.abs(change1)).toBeGreaterThanOrEqual(Math.abs(change2));
    });

    test('should handle draw correctly', async () => {
      const player1 = 'player1_draw';
      const player2 = 'player2_draw';
      const boardSize = 19;

      const initialRating1 = await ratingService.getRating(player1, boardSize);
      const initialRating2 = await ratingService.getRating(player2, boardSize);

      // Draw (winnerId = null)
      const changes = await ratingService.updateRatings(player1, player2, null, boardSize);

      const newRating1 = await ratingService.getRating(player1, boardSize);
      const newRating2 = await ratingService.getRating(player2, boardSize);

      // Both should have small changes (towards expected score)
      expect(Math.abs(newRating1 - initialRating1)).toBeLessThan(20);
      expect(Math.abs(newRating2 - initialRating2)).toBeLessThan(20);
    });
  });

  describe('Per-Board-Size Ratings', () => {
    test('should maintain separate ratings per board size', async () => {
      const player = 'player_multi';
      
      const rating19 = await ratingService.getRating(player, 19);
      const rating9 = await ratingService.getRating(player, 9);
      
      expect(rating19).toBe(1500);
      expect(rating9).toBe(1500);

      // Update rating for 19x19
      await ratingService.updateRatings(player, 'opponent', player, 19);
      
      const newRating19 = await ratingService.getRating(player, 19);
      const newRating9 = await ratingService.getRating(player, 9);
      
      expect(newRating19).not.toBe(1500);
      expect(newRating9).toBe(1500); // Should still be initial
    });
  });
});
