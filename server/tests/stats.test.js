/**
 * Stats Tests
 * 
 * Tests for player statistics tracking
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { statsService } from '../src/services/stats.js';

describe('Stats Service', () => {
  beforeEach(() => {
    // Clear stats between tests
    // Note: This relies on internal state, might need to expose reset method
  });

  describe('Stats Recording', () => {
    test('should record win correctly', async () => {
      const userId = 'player_win';
      const boardSize = 19;

      await statsService.recordGameResult(userId, true, 15, boardSize);
      
      const stats = await statsService.getPlayerStats(userId, boardSize);
      
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(0);
      expect(stats.draws).toBe(0);
      expect(stats.winRate).toBe(100);
    });

    test('should record loss correctly', async () => {
      const userId = 'player_loss';
      const boardSize = 19;

      await statsService.recordGameResult(userId, false, -15, boardSize);
      
      const stats = await statsService.getPlayerStats(userId, boardSize);
      
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(1);
      expect(stats.draws).toBe(0);
      expect(stats.winRate).toBe(0);
    });

    test('should record draw correctly', async () => {
      const userId = 'player_draw';
      const boardSize = 19;

      await statsService.recordGameResult(userId, null, 0, boardSize);
      
      const stats = await statsService.getPlayerStats(userId, boardSize);
      
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.draws).toBe(1);
      expect(stats.winRate).toBe(0);
    });

    test('should calculate winrate correctly', async () => {
      const userId = 'player_winrate';
      const boardSize = 19;

      // 2 wins, 1 loss
      await statsService.recordGameResult(userId, true, 15, boardSize);
      await statsService.recordGameResult(userId, true, 12, boardSize);
      await statsService.recordGameResult(userId, false, -10, boardSize);
      
      const stats = await statsService.getPlayerStats(userId, boardSize);
      
      expect(stats.gamesPlayed).toBe(3);
      expect(stats.wins).toBe(2);
      expect(stats.losses).toBe(1);
      expect(stats.winRate).toBeCloseTo(66.67, 1);
    });

    test('should track highest rating', async () => {
      const userId = 'player_peak';
      const boardSize = 19;

      // Simulate rating increases
      await statsService.recordGameResult(userId, true, 15, boardSize);
      const stats1 = await statsService.getPlayerStats(userId, boardSize);
      const highest1 = stats1.highestRating;

      await statsService.recordGameResult(userId, true, 20, boardSize);
      const stats2 = await statsService.getPlayerStats(userId, boardSize);
      
      expect(stats2.highestRating).toBeGreaterThanOrEqual(highest1);
    });

    test('should maintain separate stats per board size', async () => {
      const userId = 'player_multi';
      
      await statsService.recordGameResult(userId, true, 15, 19);
      await statsService.recordGameResult(userId, false, -10, 9);
      
      const stats19 = await statsService.getPlayerStats(userId, 19);
      const stats9 = await statsService.getPlayerStats(userId, 9);
      
      expect(stats19.gamesPlayed).toBe(1);
      expect(stats19.wins).toBe(1);
      expect(stats9.gamesPlayed).toBe(1);
      expect(stats9.losses).toBe(1);
    });
  });
});
