/**
 * Game Manager Service
 * 
 * Manages active games, handles move validation, and game state updates.
 * Coordinates with Go Engine for rule validation.
 */

import { websocketHandler } from '../websocket/handler.js';
import { EventTypes } from '../constants/events.js';
import { goEngine } from './goEngine.js';
import { ratingService } from './rating.js';
import { statsService } from './stats.js';
import { db } from '../db/connection.js';

class GameManager {
  constructor() {
    // Active games: Map<gameId, Game>
    this.activeGames = new Map();
  }

  /**
   * Initialize game manager
   */
  initialize() {
    console.log('Game manager initialized');
    // TODO: Load active games from database on startup
  }

  /**
   * Create a new game
   * @param {Object} params - Game parameters
   * @param {string} params.blackPlayerId - Black player user ID
   * @param {string} params.whitePlayerId - White player user ID
   * @param {number} params.boardSize - Board size (9, 13, or 19)
   * @param {Object} params.timeControl - Optional time control
   * @returns {Object} Created game object
   */
  async createGame(params) {
    const { blackPlayerId, whitePlayerId, boardSize, timeControl, blackPlayerIdentityKey, whitePlayerIdentityKey } = params;

    // Initialize game state
    const game = {
      id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      blackPlayerId,
      whitePlayerId,
      blackPlayerIdentityKey, // Store identityKey for WebSocket communication
      whitePlayerIdentityKey, // Store identityKey for WebSocket communication
      boardSize,
      timeControl,
      currentTurn: 'black',
      moves: [],
      boardState: goEngine.createEmptyBoard(boardSize),
      capturedStones: { black: 0, white: 0 },
      status: 'active', // active, finished, abandoned
      createdAt: new Date(),
      lastMoveAt: new Date()
    };

    // Initialize Go engine for this game
    goEngine.initializeGame(game.id, boardSize);

    // Store game
    this.activeGames.set(game.id, game);

    // Save to database
    // TODO: Save game to database
    // await db.saveGame(game);

    // Notify both players that game has started
    this.broadcastToGame(game.id, {
      type: EventTypes.GAME_STARTED,
      data: {
        gameId: game.id,
        boardSize,
        blackPlayer: blackPlayerId,
        whitePlayer: whitePlayerId,
        currentTurn: 'black'
      }
    });

    // Immediately send game state to both players (so they can see the board)
    this.broadcastGameState(game.id);

    return game;
  }

  /**
   * Handle a move from a player
   * @param {string} userId - User ID of player making the move
   * @param {Object} moveData - Move data
   * @param {string} moveData.gameId - Game ID
   * @param {number} moveData.x - X coordinate (0-indexed)
   * @param {number} moveData.y - Y coordinate (0-indexed)
   * @param {boolean} moveData.pass - Whether this is a pass move
   */
  async handleMove(identity, moveData) {
    const { gameId, x, y, pass } = moveData;
    const game = this.activeGames.get(gameId);
    const userId = identity?.id || identity; // Support both identity object and legacy userId string

    if (!game) {
      websocketHandler.sendError(
        websocketHandler.getConnection(identity),
        'Game not found'
      );
      return;
    }

    // Determine player color
    const playerColor = game.blackPlayerId === userId ? 'black' : 
                       game.whitePlayerId === userId ? 'white' : null;

    if (!playerColor) {
      websocketHandler.sendError(
        websocketHandler.getConnection(identity),
        'You are not a player in this game'
      );
      return;
    }

    // Check if game is finished
    if (game.status === 'finished') {
      websocketHandler.sendToUser(userId, {
        type: EventTypes.MOVE_REJECTED,
        data: {
          gameId,
          reason: 'game_finished'
        }
      });
      return;
    }

    // Check if it's player's turn
    if (game.currentTurn !== playerColor) {
      websocketHandler.sendToUser(userId, {
        type: EventTypes.MOVE_REJECTED,
        data: {
          gameId,
          reason: 'not_your_turn'
        }
      });
      return;
    }

    // Validate move using Go engine
    let moveResult;
    if (pass) {
      moveResult = goEngine.handlePass(game.id, playerColor);
    } else {
      moveResult = goEngine.playMove(game.id, playerColor, x, y);
    }

    if (!moveResult.valid) {
      websocketHandler.sendToUser(userId, {
        type: EventTypes.MOVE_REJECTED,
        data: {
          gameId,
          reason: moveResult.reason
        }
      });
      return;
    }

    // Move is valid - update game state
    game.moves.push({
      color: playerColor,
      x: pass ? null : x,
      y: pass ? null : y,
      pass,
      moveNumber: game.moves.length + 1,
      timestamp: new Date()
    });

    // Update turn from engine state
    const engineState = goEngine.engine ? goEngine.engine.getGameState(game.id) : null;
    if (engineState) {
      game.currentTurn = engineState.currentPlayer;
    } else {
      game.currentTurn = playerColor === 'black' ? 'white' : 'black';
    }
    game.boardState = moveResult.boardState;
    game.capturedStones = moveResult.capturedStones;
    game.lastMoveAt = new Date();

    // Save move to database
    // TODO: Save move to database
    // await db.saveMove(gameId, game.moves[game.moves.length - 1]);

    // Check for game end conditions (from pass)
    if (moveResult.ended) {
      const gameEndResult = goEngine.checkGameEnd(game.id, moveResult);
      if (gameEndResult.ended) {
        await this.endGame(game.id, gameEndResult);
        return;
      }
    }

    // Broadcast move to both players
    this.broadcastToGame(game.id, {
      type: EventTypes.MOVE_ACCEPTED,
      data: {
        gameId,
        move: {
          color: playerColor,
          x: pass ? null : x,
          y: pass ? null : y,
          pass,
          moveNumber: game.moves.length
        },
        boardState: moveResult.boardState,
        capturedStones: moveResult.capturedStones,
        captures: moveResult.captures || [],
        turn: game.currentTurn
      }
    });
  }

  /**
   * Handle player resignation
   * @param {Object} identity - Identity object with id and identityKey
   * @param {Object} data - Resignation data
   * @param {string} data.gameId - Game ID
   */
  async handleResignation(identity, data) {
    const { gameId } = data;
    const game = this.activeGames.get(gameId);

    if (!game) {
      console.error(`[GameManager] Cannot resign: game ${gameId} not found`);
      return;
    }

    // Extract userId from identity object
    const userId = identity?.id || identity;
    
    // Check if player is in this game by comparing with blackPlayerId or whitePlayerId
    const playerColor = game.blackPlayerId === userId ? 'black' : 
                       game.whitePlayerId === userId ? 'white' : null;

    if (!playerColor) {
      console.error(`[GameManager] Cannot resign: player ${userId} is not in game ${gameId}`);
      console.log(`[GameManager] Game players: black=${game.blackPlayerId}, white=${game.whitePlayerId}`);
      return;
    }

    const winner = playerColor === 'black' ? 'white' : 'black';
    
    console.log(`[GameManager] Player ${userId} (${playerColor}) resigning from game ${gameId}. Winner: ${winner}`);

    await this.endGame(gameId, {
      ended: true,
      reason: EventTypes.GAME_END_REASON.RESIGNATION,
      winner
    });
  }

  /**
   * End a game and update ratings/stats
   * @param {string} gameId - Game ID
   * @param {Object} endResult - Game end result
   */
  async endGame(gameId, endResult) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    game.status = 'finished';
    game.endedAt = new Date();
    game.winner = endResult.winner;
    game.endReason = endResult.reason;

    // Calculate final score if needed
    // TODO: Implement scoring logic
    const finalScore = endResult.finalScore || { black: 0, white: 0 };

    // Update ratings (all games are rated in MVP)
    const winnerId = endResult.winner === 'black' ? game.blackPlayerId : 
                     endResult.winner === 'white' ? game.whitePlayerId : null;
    const ratingChanges = await ratingService.updateRatings(
      game.blackPlayerId,
      game.whitePlayerId,
      winnerId,
      game.boardSize
    );

    // Update statistics
    // endResult.winner is 'black' or 'white', not userId
    const blackWon = endResult.winner === 'black';
    const whiteWon = endResult.winner === 'white';
    
    // Log before updating
    const blackGuestKey = game.blackPlayerId.startsWith('guest-') ? `g:${game.blackPlayerId}` : null;
    const whiteGuestKey = game.whitePlayerId.startsWith('guest-') ? `g:${game.whitePlayerId}` : null;
    
    if (blackGuestKey) {
      console.log(`[GameManager] 🎮 Game end - updating black player: guestKey=${blackGuestKey}, boardSize=${game.boardSize}, won=${blackWon}, ratingChange=${ratingChanges.black}`);
    }
    if (whiteGuestKey) {
      console.log(`[GameManager] 🎮 Game end - updating white player: guestKey=${whiteGuestKey}, boardSize=${game.boardSize}, won=${whiteWon}, ratingChange=${ratingChanges.white}`);
    }
    
    await statsService.recordGameResult(
      game.blackPlayerId,
      blackWon,
      ratingChanges.black,
      game.boardSize
    );
    await statsService.recordGameResult(
      game.whitePlayerId,
      whiteWon,
      ratingChanges.white,
      game.boardSize
    );
    
    // Get updated stats for both players
    const blackStats = await statsService.getPlayerStats(game.blackPlayerId, game.boardSize);
    const whiteStats = await statsService.getPlayerStats(game.whitePlayerId, game.boardSize);

    // Get final board state from engine
    const engineState = goEngine.engine ? goEngine.engine.getGameState(gameId) : null;
    const finalBoard = engineState ? engineState.board : game.boardState;

    // Broadcast game end to both players
    const gameEndedMessage = {
      type: EventTypes.GAME_ENDED,
      data: {
        gameId,
        winner: endResult.winner,
        reason: endResult.reason,
        boardSize: game.boardSize,
        komi: endResult.komi || 0,
        finalBoard: finalBoard,
        finalScore: endResult.finalScore || finalScore,
        scoreDiff: endResult.scoreDiff || 0,
        ratingChange: {
          black: ratingChanges.black,
          white: ratingChanges.white
        }
      }
    };
    
    console.log(`[GameManager] 📢 Broadcasting GAME_ENDED to both players for game ${gameId}:`, gameEndedMessage);
    this.broadcastToGame(gameId, gameEndedMessage);
    
    // Send stats update to both players (same payload shape as /api/stats)
    const blackPayload = {
      identity: {
        type: game.blackPlayerId.startsWith('guest-') ? 'guest' : 'account',
        id: game.blackPlayerId
      },
      boardSize: game.boardSize,
      rating: blackStats.currentRating || blackStats.rating || 1500,
      rankDisplay: blackStats.currentRank || blackStats.rank || '30k',
      stats: {
        games: blackStats.gamesPlayed || 0,
        wins: blackStats.wins || 0,
        losses: blackStats.losses || 0,
        draws: blackStats.draws || 0,
        winrate: blackStats.winRate || 0,
        highestRating: blackStats.highestRating || blackStats.currentRating || 1500
      }
    };
    
    const whitePayload = {
      identity: {
        type: game.whitePlayerId.startsWith('guest-') ? 'guest' : 'account',
        id: game.whitePlayerId
      },
      boardSize: game.boardSize,
      rating: whiteStats.currentRating || whiteStats.rating || 1500,
      rankDisplay: whiteStats.currentRank || whiteStats.rank || '30k',
      stats: {
        games: whiteStats.gamesPlayed || 0,
        wins: whiteStats.wins || 0,
        losses: whiteStats.losses || 0,
        draws: whiteStats.draws || 0,
        winrate: whiteStats.winRate || 0,
        highestRating: whiteStats.highestRating || whiteStats.currentRating || 1500
      }
    };
    
    // Send stats_update to both players (ALWAYS send, even if defaults)
    console.log(`[GameManager] 📊 Sending stats_update to black player ${game.blackPlayerId} (${blackPayload.identity.type}) - games: ${blackPayload.stats.games}, rating: ${blackPayload.rating}, boardSize: ${game.boardSize}`);
    websocketHandler.sendToUser(game.blackPlayerId, {
      type: EventTypes.STATS_UPDATE,
      data: blackPayload
    });
    
    console.log(`[GameManager] 📊 Sending stats_update to white player ${game.whitePlayerId} (${whitePayload.identity.type}) - games: ${whitePayload.stats.games}, rating: ${whitePayload.rating}, boardSize: ${game.boardSize}`);
    websocketHandler.sendToUser(game.whitePlayerId, {
      type: EventTypes.STATS_UPDATE,
      data: whitePayload
    });

    // Save final game state to database
    // TODO: Update game in database
    // await db.updateGame(gameId, game);

    // Clean up
    this.activeGames.delete(gameId);
    goEngine.cleanupGame(gameId);
  }

  /**
   * Send current game state to requesting player
   * @param {string} userId - User ID
   * @param {Object} data - Request data
   * @param {string} data.gameId - Game ID
   */
  sendGameState(identity, data) {
    const { gameId } = data;
    const game = this.activeGames.get(gameId);
    const userId = identity?.id || identity; // Support both identity object and legacy userId string

    if (!game) {
      const ws = websocketHandler.getConnection(identity);
      if (ws) {
        websocketHandler.sendError(ws, 'Game not found');
      }
      return;
    }

    // Get current board state from engine (via internal engine instance)
    // Note: goEngine is a wrapper, we need to access the internal engine
    const engineState = goEngine.engine ? goEngine.engine.getGameState(gameId) : null;
    const currentBoardState = engineState ? engineState.board : game.boardState;

    // Determine player color
    const playerColor = game.blackPlayerId === userId ? 'black' : 
                       game.whitePlayerId === userId ? 'white' : null;

    // Use identityKey if available, fallback to userId
    const identityKey = identity?.identityKey || (typeof identity === 'string' && (identity.startsWith('a:') || identity.startsWith('g:')) ? identity : null) || userId;
    
    websocketHandler.sendToUser(identityKey, {
      type: EventTypes.GAME_STATE,
      data: {
        gameId,
        boardSize: game.boardSize,
        boardState: currentBoardState,
        currentTurn: game.currentTurn,
        moves: game.moves,
        capturedStones: game.capturedStones,
        blackPlayer: game.blackPlayerId,
        whitePlayer: game.whitePlayerId,
        playerColor: playerColor
      }
    });
  }

  /**
   * Broadcast game state to both players
   * @param {string} gameId - Game ID
   */
  broadcastGameState(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    // Get current board state
    const engineState = goEngine.engine ? goEngine.engine.getGameState(gameId) : null;
    const currentBoardState = engineState ? engineState.board : game.boardState;

    // Send to black player
    const blackIdentity = game.blackPlayerIdentityKey || game.blackPlayerId;
    websocketHandler.sendToUser(blackIdentity, {
      type: EventTypes.GAME_STATE,
      data: {
        gameId,
        boardSize: game.boardSize,
        boardState: currentBoardState,
        currentTurn: game.currentTurn,
        moves: game.moves,
        capturedStones: game.capturedStones,
        blackPlayer: game.blackPlayerId,
        whitePlayer: game.whitePlayerId,
        playerColor: 'black'
      }
    });

    // Send to white player
    const whiteIdentity = game.whitePlayerIdentityKey || game.whitePlayerId;
    websocketHandler.sendToUser(whiteIdentity, {
      type: EventTypes.GAME_STATE,
      data: {
        gameId,
        boardSize: game.boardSize,
        boardState: currentBoardState,
        currentTurn: game.currentTurn,
        moves: game.moves,
        capturedStones: game.capturedStones,
        blackPlayer: game.blackPlayerId,
        whitePlayer: game.whitePlayerId,
        playerColor: 'white'
      }
    });
  }

  /**
   * Handle player disconnection
   * @param {string} userId - User ID
   */
  handleDisconnection(identity) {
    const userId = identity?.id || identity; // Support both identity object and legacy userId string
    // Find all games where this user is playing
    for (const [gameId, game] of this.activeGames.entries()) {
      if (game.blackPlayerId === userId || game.whitePlayerId === userId) {
        // TODO: Implement timeout/abandonment logic
        // For now, just log
        console.log(`Player ${userId} disconnected from game ${gameId}`);
      }
    }
  }

  /**
   * Broadcast message to both players in a game
   * @param {string} gameId - Game ID
   * @param {Object} message - Message to broadcast
   */
  broadcastToGame(gameId, message) {
    const game = this.activeGames.get(gameId);
    if (!game) {
      console.error(`[GameManager] Cannot broadcast to game ${gameId}: game not found`);
      return;
    }

    // Use identityKey if available, fallback to userId (for backward compatibility)
    const blackIdentity = game.blackPlayerIdentityKey || game.blackPlayerId;
    const whiteIdentity = game.whitePlayerIdentityKey || game.whitePlayerId;
    
    console.log(`[GameManager] Broadcasting ${message.type} to game ${gameId}: black=${blackIdentity}, white=${whiteIdentity}`);
    
    websocketHandler.sendToUser(blackIdentity, message);
    websocketHandler.sendToUser(whiteIdentity, message);
  }

  /**
   * Get active game by ID
   * @param {string} gameId - Game ID
   * @returns {Object|null} Game object or null
   */
  getGame(gameId) {
    return this.activeGames.get(gameId) || null;
  }

  /**
   * Send player statistics to requesting player
   * @param {string} userId - User ID
   * @param {Object} data - Request data
   * @param {number} data.boardSize - Board size
   */
  async sendPlayerStats(identity, data) {
    const { boardSize = 19 } = data;
    const userId = identity?.id || identity; // Support both identity object and legacy userId string
    
    const stats = await statsService.getPlayerStats(userId, boardSize);
    
    // Determine identity kind
    const identityKind = identity?.kind || (userId.startsWith('guest-') ? 'guest' : 'account');
    
    const payload = {
      identity: {
        kind: identityKind,
        id: userId,
        ...(identity?.username && { username: identity.username })
      },
      boardSize,
      rating: stats.currentRating || stats.rating || 1500,
      rankDisplay: stats.currentRank || stats.rank || '30k',
      stats: {
        games: stats.gamesPlayed || 0,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        draws: stats.draws || 0,
        winrate: stats.winRate || 0,
        highestRating: stats.highestRating || stats.currentRating || 1500
      }
    };
    
    console.log(`[GameManager] 📊 Sending stats_update to ${identityKind}:${userId} - games: ${payload.stats.games}, rating: ${payload.rating}`);
    websocketHandler.sendToUser(identity, {
      type: EventTypes.STATS_UPDATE,
      data: payload
    });
  }
}

export const gameManager = new GameManager();
