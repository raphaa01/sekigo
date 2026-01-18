/**
 * Scoring Tests
 * 
 * Tests for Chinese scoring implementation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import GoEngine from '../src/engine/goEngine.js';

describe('Chinese Scoring', () => {
  let engine;
  let gameId;

  beforeEach(() => {
    engine = new GoEngine();
    gameId = 'test_game_scoring';
  });

  test('should calculate territory for Black', () => {
    // Create 9x9 game
    engine.createGameState(gameId, 9, 0.5);
    
    // Set up a simple scenario: Black surrounds a 3x3 territory
    // Place Black stones around (4,4) to create territory
    const state = engine.getGameState(gameId);
    
    // Place Black stones in a square around center
    engine.applyMove(gameId, 3, 3, 'black');
    engine.applyMove(gameId, 3, 4, 'black');
    engine.applyMove(gameId, 3, 5, 'black');
    engine.applyMove(gameId, 4, 3, 'black');
    engine.applyMove(gameId, 4, 5, 'black');
    engine.applyMove(gameId, 5, 3, 'black');
    engine.applyMove(gameId, 5, 4, 'black');
    engine.applyMove(gameId, 5, 5, 'black');
    
    // Now pass twice to end game
    engine.passMove(gameId, 'black');
    engine.passMove(gameId, 'white');
    
    const score = engine.scoreChinese(gameId);
    
    // Black should have territory at (4,4) = 1 point
    // Plus 8 stones = 8 points
    // Total: 9 points
    expect(score.black).toBeGreaterThan(8);
    expect(score.white).toBe(0.5); // Only komi
    expect(score.winner).toBe('black');
  });

  test('should handle neutral territory (touches both colors)', () => {
    // Create 9x9 game
    engine.createGameState(gameId, 9, 0.5);
    
    // Create a scenario where empty region touches both colors
    // Place Black on left, White on right, empty in middle
    engine.applyMove(gameId, 2, 4, 'black');
    engine.applyMove(gameId, 3, 4, 'black');
    engine.applyMove(gameId, 6, 4, 'white');
    engine.applyMove(gameId, 7, 4, 'white');
    
    // Pass twice to end
    engine.passMove(gameId, 'black');
    engine.passMove(gameId, 'white');
    
    const score = engine.scoreChinese(gameId);
    
    // The empty region in the middle (positions 4,4 and 5,4) should be neutral
    // Black: 2 stones, White: 2 stones
    // Territory should be neutral (0)
    expect(score.black).toBe(2); // Only stones
    expect(score.white).toBe(2.5); // 2 stones + 0.5 komi
    expect(score.winner).toBe('white'); // White wins due to komi
  });

  test('should apply komi correctly', () => {
    // Create 9x9 game with 0.5 komi
    engine.createGameState(gameId, 9, 0.5);
    
    // Place equal number of stones
    engine.applyMove(gameId, 0, 0, 'black');
    engine.applyMove(gameId, 0, 1, 'white');
    engine.applyMove(gameId, 1, 0, 'black');
    engine.applyMove(gameId, 1, 1, 'white');
    
    // Pass twice
    engine.passMove(gameId, 'black');
    engine.passMove(gameId, 'white');
    
    const score = engine.scoreChinese(gameId);
    
    // Both have 2 stones, no territory
    // Black: 2, White: 2 + 0.5 komi = 2.5
    expect(score.black).toBe(2);
    expect(score.white).toBe(2.5);
    expect(score.winner).toBe('white');
    expect(score.scoreDiff).toBe(0.5);
    expect(score.komi).toBe(0.5);
  });

  test('should calculate score with stones and territory', () => {
    // Create 9x9 game
    engine.createGameState(gameId, 9, 0.5);
    
    // Create a clear territory for Black
    // Black stones forming a corner territory
    engine.applyMove(gameId, 0, 0, 'black');
    engine.applyMove(gameId, 0, 1, 'black');
    engine.applyMove(gameId, 1, 0, 'black');
    // Position (1,1) is empty and surrounded by Black = territory
    
    // Pass twice
    engine.passMove(gameId, 'black');
    engine.passMove(gameId, 'white');
    
    const score = engine.scoreChinese(gameId);
    
    // Black: 3 stones + 1 territory = 4
    // White: 0 stones + 0.5 komi = 0.5
    expect(score.black).toBe(4);
    expect(score.white).toBe(0.5);
    expect(score.winner).toBe('black');
    expect(score.scoreDiff).toBe(3.5);
  });

  test('should handle 19x19 komi (6.5)', () => {
    // Create 19x19 game
    engine.createGameState(gameId, 19);
    
    // Place equal stones
    engine.applyMove(gameId, 0, 0, 'black');
    engine.applyMove(gameId, 0, 1, 'white');
    
    // Pass twice
    engine.passMove(gameId, 'black');
    engine.passMove(gameId, 'white');
    
    const score = engine.scoreChinese(gameId);
    
    // Both have 1 stone, no territory
    // Black: 1, White: 1 + 6.5 komi = 7.5
    expect(score.black).toBe(1);
    expect(score.white).toBe(7.5);
    expect(score.winner).toBe('white');
    expect(score.komi).toBe(6.5);
  });
});
