/**
 * Go Engine Service - Wrapper
 * 
 * Wraps the full Go engine implementation for use by gameManager.
 * Provides compatibility layer between gameManager and engine.
 */

import GoEngine from '../engine/goEngine.js';

class GoEngineService {
  constructor() {
    this.engine = new GoEngine();
  }


  /**
   * Initialize a new game
   * @param {string} gameId - Game ID
   * @param {number} boardSize - Board size (9, 13, or 19)
   */
  initializeGame(gameId, boardSize) {
    this.engine.createGameState(gameId, boardSize);
  }

  /**
   * Create an empty board (for compatibility)
   * @param {number} size - Board size
   * @returns {Array<Array<string|null>>} 2D array representing board
   */
  createEmptyBoard(size) {
    return Array(size).fill(null).map(() => Array(size).fill(null));
  }

  /**
   * Play a move and validate it
   * @param {string} gameId - Game ID
   * @param {string} color - 'black' or 'white'
   * @param {number} x - X coordinate (0-indexed)
   * @param {number} y - Y coordinate (0-indexed)
   * @returns {Object} Move result
   */
  playMove(gameId, color, x, y) {
    try {
      // Check if move is legal first
      const validation = this.engine.isLegalMove(gameId, x, y, color);
      if (!validation.ok) {
        return { valid: false, reason: validation.reason };
      }

      // Apply the move
      const result = this.engine.applyMove(gameId, x, y, color);
      const state = result.state;

      return {
        valid: true,
        boardState: state.board,
        capturedStones: { ...state.capturedStones },
        captures: result.captures,
        newHash: result.newHash
      };
    } catch (error) {
      return { valid: false, reason: error.message || 'invalid_move' };
    }
  }

  /**
   * Handle a pass move
   * @param {string} gameId - Game ID
   * @param {string} color - 'black' or 'white'
   * @returns {Object} Pass result
   */
  handlePass(gameId, color) {
    try {
      const result = this.engine.passMove(gameId, color);
      const state = result.state;

      return {
        valid: true,
        boardState: state.board,
        capturedStones: { ...state.capturedStones },
        consecutivePasses: state.consecutivePasses,
        ended: result.ended
      };
    } catch (error) {
      return { valid: false, reason: error.message || 'invalid_pass' };
    }
  }

  /**
   * Check if game should end
   * @param {string} gameId - Game ID
   * @param {Object} lastMoveResult - Result of last move
   * @returns {Object} Game end check result
   */
  checkGameEnd(gameId, lastMoveResult) {
    const state = this.engine.getGameState(gameId);
    if (!state) {
      return { ended: false };
    }

    // Check if ended flag is set (from pass)
    if (lastMoveResult.ended === true) {
      // Calculate final score using Chinese scoring
      const scoreResult = this.engine.scoreChinese(gameId);
      
      return {
        ended: true,
        reason: 'two_passes',
        winner: scoreResult.winner,
        finalScore: {
          black: scoreResult.black,
          white: scoreResult.white
        },
        scoreDiff: scoreResult.scoreDiff,
        komi: scoreResult.komi
      };
    }

    return { ended: false };
  }

  /**
   * Clean up game state when game ends
   * @param {string} gameId - Game ID
   */
  cleanupGame(gameId) {
    this.engine.cleanupGame(gameId);
  }
}

export const goEngine = new GoEngineService();
