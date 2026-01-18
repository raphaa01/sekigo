/**
 * Go Engine - Full Rule Implementation
 * 
 * Implements complete Go rules:
 * - Legal move validation (liberties, suicide, ko)
 * - Stone capture
 * - Pass handling
 * - Ko detection via Zobrist hashing (positional superko)
 * 
 * Ko Variant: Positional Superko
 * - Tracks all previous board positions via hash
 * - Prevents repeating any previous board position
 */

import ZobristHasher from './zobrist.js';

class GoEngine {
  constructor() {
    // Game states: Map<gameId, GameState>
    this.gameStates = new Map();
  }

  /**
   * Create a new game state
   * @param {string} gameId - Game ID
   * @param {number} boardSize - Board size (9, 13, or 19)
   * @param {number} komi - Komi for white (default 6.5 for 19x19, 0.5 for 9x9)
   */
  createGameState(gameId, boardSize, komi = null) {
    if (![9, 13, 19].includes(boardSize)) {
      throw new Error(`Invalid board size: ${boardSize}. Must be 9, 13, or 19.`);
    }

    // Set komi based on board size if not provided
    // Standard komi: 19x19 = 6.5, 13x13 = 6.5, 9x9 = 0.5
    if (komi === null) {
      komi = boardSize === 19 ? 6.5 : boardSize === 13 ? 6.5 : 0.5;
    }

    const hasher = new ZobristHasher(boardSize);
    const board = this.createEmptyBoard(boardSize);
    const boardHash = hasher.hashBoard(board);

    const gameState = {
      gameId,
      boardSize,
      komi,
      board,
      currentPlayer: 'black', // Black plays first
      moveNumber: 0,
      moveHistory: [],
      previousHashes: new Set([hasher.hashToString(boardHash)]), // Store initial empty board
      hasher,
      consecutivePasses: 0,
      capturedStones: { black: 0, white: 0 },
      lastKoHash: null // Hash of board before last move (for simple ko detection)
    };

    this.gameStates.set(gameId, gameState);
    return gameState;
  }

  /**
   * Create an empty board
   * @param {number} size - Board size
   * @returns {Array<Array<string|null>>} 2D array representing board
   */
  createEmptyBoard(size) {
    return Array(size).fill(null).map(() => Array(size).fill(null));
  }

  /**
   * Get current player
   * @param {string} gameId - Game ID
   * @returns {string} 'black' or 'white'
   */
  getCurrentPlayer(gameId) {
    const state = this.gameStates.get(gameId);
    if (!state) {
      throw new Error(`Game ${gameId} not found`);
    }
    return state.currentPlayer;
  }

  /**
   * Check if a move is legal
   * @param {string} gameId - Game ID
   * @param {number} x - X coordinate (0-indexed)
   * @param {number} y - Y coordinate (0-indexed)
   * @param {string} color - 'black' or 'white'
   * @returns {{ ok: boolean, reason?: string }}
   */
  isLegalMove(gameId, x, y, color) {
    const state = this.gameStates.get(gameId);
    if (!state) {
      return { ok: false, reason: 'game_not_found' };
    }

    // Check bounds
    if (x < 0 || x >= state.boardSize || y < 0 || y >= state.boardSize) {
      return { ok: false, reason: 'invalid_coordinates' };
    }

    // Check if position is occupied
    if (state.board[y][x] !== null) {
      return { ok: false, reason: 'position_occupied' };
    }

    // Check if it's player's turn
    if (state.currentPlayer !== color) {
      return { ok: false, reason: 'not_your_turn' };
    }

    // Place stone temporarily to check captures and suicide
    const testBoard = state.board.map(row => [...row]);
    testBoard[y][x] = color;

    // Check for captures (opponent groups without liberties)
    const capturedGroups = this.findCapturedGroups(testBoard, x, y, color);
    
    // Remove captured stones temporarily
    const boardAfterCapture = testBoard.map(row => [...row]);
    for (const group of capturedGroups) {
      for (const pos of group) {
        boardAfterCapture[pos.y][pos.x] = null;
      }
    }

    // Check if placed stone's group has liberties after captures
    const placedGroup = this.getGroup(boardAfterCapture, x, y, color);
    const hasLiberties = this.groupHasLiberties(boardAfterCapture, placedGroup);

    // If no captures and no liberties, it's suicide
    if (capturedGroups.length === 0 && !hasLiberties) {
      return { ok: false, reason: 'suicide_move' };
    }

    // Check Ko (positional superko)
    // Calculate what the board would look like after this move
    const boardHash = state.hasher.hashBoard(boardAfterCapture);
    const hashString = state.hasher.hashToString(boardHash);

    if (state.previousHashes.has(hashString)) {
      return { ok: false, reason: 'ko_violation' };
    }

    return { ok: true };
  }

  /**
   * Apply a move to the game state
   * @param {string} gameId - Game ID
   * @param {number} x - X coordinate (0-indexed)
   * @param {number} y - Y coordinate (0-indexed)
   * @param {string} color - 'black' or 'white'
   * @returns {{ state: GameState, captures: Array<{x, y}>, newHash: string }}
   */
  applyMove(gameId, x, y, color) {
    const state = this.gameStates.get(gameId);
    if (!state) {
      throw new Error(`Game ${gameId} not found`);
    }

    // Validate move
    const validation = this.isLegalMove(gameId, x, y, color);
    if (!validation.ok) {
      throw new Error(`Illegal move: ${validation.reason}`);
    }

    // Get current hash before move
    const currentHash = state.hasher.hashBoard(state.board);
    const currentHashString = state.hasher.hashToString(currentHash);

    // Place stone
    state.board[y][x] = color;

    // Find and remove captured groups
    const capturedGroups = this.findCapturedGroups(state.board, x, y, color);
    const allCaptures = [];
    let totalCaptured = 0;

    for (const group of capturedGroups) {
      for (const pos of group) {
        state.board[pos.y][pos.x] = null;
        allCaptures.push({ x: pos.x, y: pos.y });
        totalCaptured++;
      }
    }

    // Update captured stones count
    if (color === 'black') {
      state.capturedStones.black += totalCaptured;
    } else {
      state.capturedStones.white += totalCaptured;
    }

    // Calculate new board hash
    const newHash = state.hasher.hashBoard(state.board);
    const newHashString = state.hasher.hashToString(newHash);

    // Store hash in previous hashes (for ko detection)
    state.previousHashes.add(newHashString);
    state.lastKoHash = currentHashString;

    // Update game state
    state.moveNumber++;
    state.moveHistory.push({
      color,
      x,
      y,
      moveNumber: state.moveNumber,
      captures: allCaptures.length
    });
    state.currentPlayer = color === 'black' ? 'white' : 'black';
    state.consecutivePasses = 0;

    return {
      state,
      captures: allCaptures,
      newHash: newHashString
    };
  }

  /**
   * Handle a pass move
   * @param {string} gameId - Game ID
   * @param {string} color - 'black' or 'white'
   * @returns {{ state: GameState, ended: boolean }}
   */
  passMove(gameId, color) {
    const state = this.gameStates.get(gameId);
    if (!state) {
      throw new Error(`Game ${gameId} not found`);
    }

    // Check if it's player's turn
    if (state.currentPlayer !== color) {
      throw new Error('Not your turn');
    }

    state.consecutivePasses++;
    state.moveNumber++;
    state.moveHistory.push({
      color,
      pass: true,
      moveNumber: state.moveNumber
    });
    state.currentPlayer = color === 'black' ? 'white' : 'black';

    // Game ends if both players pass consecutively
    const ended = state.consecutivePasses >= 2;
    
    if (ended) {
      state.status = 'finished';
    }

    return {
      state,
      ended
    };
  }

  /**
   * Calculate Chinese Scoring
   * 
   * Chinese Scoring (Area Scoring):
   * - Points = (Stones on board) + (Territory controlled)
   * - Territory = empty intersections surrounded by one color
   * - Komi is added to white's score
   * 
   * Note: This is an MVP implementation. Complex cases like Seki are not handled.
   * 
   * @param {string} gameId - Game ID
   * @returns {{ black: number, white: number, winner: 'black'|'white'|null, scoreDiff: number }}
   */
  scoreChinese(gameId) {
    const state = this.gameStates.get(gameId);
    if (!state) {
      throw new Error(`Game ${gameId} not found`);
    }

    const board = state.board;
    const boardSize = state.boardSize;
    const komi = state.komi || 0;

    // Count stones on board
    let blackStones = 0;
    let whiteStones = 0;

    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (board[y][x] === 'black') {
          blackStones++;
        } else if (board[y][x] === 'white') {
          whiteStones++;
        }
      }
    }

    // Find territory (empty regions)
    const visited = Array(boardSize).fill(null).map(() => Array(boardSize).fill(false));
    let blackTerritory = 0;
    let whiteTerritory = 0;

    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (board[y][x] === null && !visited[y][x]) {
          // Found an empty region, analyze it
          const region = this.getEmptyRegion(board, x, y, boardSize, visited);
          const territoryOwner = this.analyzeTerritory(board, region, boardSize);
          
          if (territoryOwner === 'black') {
            blackTerritory += region.length;
          } else if (territoryOwner === 'white') {
            whiteTerritory += region.length;
          }
          // If territoryOwner is null, it's neutral (touches both colors or neither)
        }
      }
    }

    // Calculate scores
    const scoreBlack = blackStones + blackTerritory;
    const scoreWhite = whiteStones + whiteTerritory + komi;
    const scoreDiff = scoreBlack - scoreWhite;

    // Determine winner
    let winner = null;
    if (scoreDiff > 0) {
      winner = 'black';
    } else if (scoreDiff < 0) {
      winner = 'white';
    }

    return {
      black: scoreBlack,
      white: scoreWhite,
      winner,
      scoreDiff: Math.abs(scoreDiff),
      komi
    };
  }

  /**
   * Get all empty intersections in a connected region
   * @param {Array<Array<string|null>>} board - Board state
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} boardSize - Board size
   * @param {Array<Array<boolean>>} visited - Visited matrix
   * @returns {Array<{x, y}>} Array of positions in the region
   */
  getEmptyRegion(board, startX, startY, boardSize, visited) {
    if (board[startY][startX] !== null) {
      return [];
    }

    const region = [];
    const queue = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const pos = queue.shift();
      const key = `${pos.x},${pos.y}`;

      if (visited[pos.y][pos.x]) continue;
      visited[pos.y][pos.x] = true;

      if (board[pos.y][pos.x] === null) {
        region.push(pos);

        // Check adjacent positions
        const adjacent = this.getAdjacentPositions(pos.x, pos.y, boardSize);
        for (const adj of adjacent) {
          if (!visited[adj.y][adj.x] && board[adj.y][adj.x] === null) {
            queue.push(adj);
          }
        }
      }
    }

    return region;
  }

  /**
   * Analyze territory to determine ownership
   * @param {Array<Array<string|null>>} board - Board state
   * @param {Array<{x, y}>} region - Empty region
   * @param {number} boardSize - Board size
   * @returns {'black'|'white'|null} Territory owner, or null if neutral
   */
  analyzeTerritory(board, region, boardSize) {
    const touchingColors = new Set();

    for (const pos of region) {
      const adjacent = this.getAdjacentPositions(pos.x, pos.y, boardSize);
      for (const adj of adjacent) {
        const stone = board[adj.y][adj.x];
        if (stone === 'black') {
          touchingColors.add('black');
        } else if (stone === 'white') {
          touchingColors.add('white');
        }
      }
    }

    // If only one color touches the region, it's that color's territory
    if (touchingColors.size === 1) {
      return touchingColors.has('black') ? 'black' : 'white';
    }

    // If both colors or neither touch it, it's neutral
    return null;
  }

  /**
   * Find all groups that would be captured by placing a stone
   * @param {Array<Array<string|null>>} board - Board state
   * @param {number} x - X coordinate of placed stone
   * @param {number} y - Y coordinate of placed stone
   * @param {string} color - Color of placed stone
   * @returns {Array<Array<{x, y}>>} Array of captured groups
   */
  findCapturedGroups(board, x, y, color) {
    const opponentColor = color === 'black' ? 'white' : 'black';
    const capturedGroups = [];
    const checked = new Set();

    // Check all adjacent opponent stones
    const adjacent = this.getAdjacentPositions(x, y, board.length);
    for (const pos of adjacent) {
      if (board[pos.y][pos.x] === opponentColor) {
        const key = `${pos.x},${pos.y}`;
        if (!checked.has(key)) {
          const group = this.getGroup(board, pos.x, pos.y, opponentColor);
          
          // Mark all positions as checked
          for (const gPos of group) {
            checked.add(`${gPos.x},${gPos.y}`);
          }

          // If group has no liberties, it's captured
          if (!this.groupHasLiberties(board, group)) {
            capturedGroups.push(group);
          }
        }
      }
    }

    return capturedGroups;
  }

  /**
   * Get all stones in a connected group
   * @param {Array<Array<string|null>>} board - Board state
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} color - Stone color
   * @returns {Array<{x, y}>} Array of positions in the group
   */
  getGroup(board, x, y, color) {
    if (board[y][x] !== color) {
      return [];
    }

    const group = [];
    const visited = new Set();
    const queue = [{ x, y }];
    const boardSize = board.length;

    while (queue.length > 0) {
      const pos = queue.shift();
      const key = `${pos.x},${pos.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (board[pos.y][pos.x] === color) {
        group.push(pos);
        
        // Check adjacent positions
        const adjacent = this.getAdjacentPositions(pos.x, pos.y, boardSize);
        for (const adj of adjacent) {
          const adjKey = `${adj.x},${adj.y}`;
          if (!visited.has(adjKey) && board[adj.y][adj.x] === color) {
            queue.push(adj);
          }
        }
      }
    }

    return group;
  }

  /**
   * Check if a group has any liberties
   * @param {Array<Array<string|null>>} board - Board state
   * @param {Array<{x, y}>} group - Group of stones
   * @returns {boolean} True if group has at least one liberty
   */
  groupHasLiberties(board, group) {
    const boardSize = board.length;
    const checked = new Set();

    for (const pos of group) {
      const adjacent = this.getAdjacentPositions(pos.x, pos.y, boardSize);
      for (const adj of adjacent) {
        const key = `${adj.x},${adj.y}`;
        if (!checked.has(key)) {
          checked.add(key);
          if (board[adj.y][adj.x] === null) {
            return true; // Found a liberty
          }
        }
      }
    }

    return false; // No liberties found
  }

  /**
   * Get adjacent positions (up, down, left, right)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} boardSize - Board size
   * @returns {Array<{x, y}>} Array of adjacent positions
   */
  getAdjacentPositions(x, y, boardSize) {
    const adjacent = [];
    if (x > 0) adjacent.push({ x: x - 1, y });
    if (x < boardSize - 1) adjacent.push({ x: x + 1, y });
    if (y > 0) adjacent.push({ x, y: y - 1 });
    if (y < boardSize - 1) adjacent.push({ x, y: y + 1 });
    return adjacent;
  }

  /**
   * Get current game state
   * @param {string} gameId - Game ID
   * @returns {GameState|null}
   */
  getGameState(gameId) {
    return this.gameStates.get(gameId) || null;
  }

  /**
   * Clean up game state
   * @param {string} gameId - Game ID
   */
  cleanupGame(gameId) {
    this.gameStates.delete(gameId);
  }
}

export default GoEngine;
