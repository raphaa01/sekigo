import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { websocketService } from '../services/websocket';
import { EventTypes } from '../constants/events';
import { useAuth } from '../App';
import GoBoard from './GoBoard';
import './GameView.css';

/**
 * Game View Component
 * 
 * Main game interface showing the Go board, game status, and controls.
 * Handles game state updates and move submission.
 */
function GameView() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);
  const [boardSize, setBoardSize] = useState(19);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [boardState, setBoardState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [moves, setMoves] = useState([]);
  const [blackPlayerInfo, setBlackPlayerInfo] = useState({ name: 'Schwarz', rating: 1500, rank: '30k' });
  const [whitePlayerInfo, setWhitePlayerInfo] = useState({ name: 'Weiß', rating: 1500, rank: '30k' });
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  useEffect(() => {
    // Connect if not already connected (no auth required in MVP)
    if (!websocketService.isConnected()) {
      websocketService.connect().then(() => {
        setIsConnected(true);
      }).catch((error) => {
        console.error('[GameView] Failed to connect:', error);
      });
    } else {
      setIsConnected(true);
    }

    // Listen for match found to set player color (when navigating from matchmaking)
    const unsubscribeMatchFound = websocketService.on(EventTypes.MATCH_FOUND, (data) => {
      console.log('[GameView] Match found event:', data);
      if (data.gameId === gameId) {
        setPlayerColor(data.color);
        setBoardSize(data.boardSize);
        setCurrentTurn('black'); // Game starts with black
      }
    });

    // Listen for game events
    const unsubscribeGameStarted = websocketService.on(EventTypes.GAME_STARTED, (data) => {
      if (data.gameId === gameId) {
        setBoardSize(data.boardSize);
        setCurrentTurn(data.currentTurn);
        // Request game state to get full board
        websocketService.send(EventTypes.REQUEST_GAME_STATE, { gameId });
      }
    });

    const unsubscribeGameState = websocketService.on(EventTypes.GAME_STATE, (data) => {
      if (data.gameId === gameId) {
        setGameState(data);
        setBoardSize(data.boardSize);
        setBoardState(data.boardState);
        setCurrentTurn(data.currentTurn);
        // Set player color if provided
        if (data.playerColor) {
          setPlayerColor(data.playerColor);
        }
        // Initialize moves from game state if available
        if (data.moves && Array.isArray(data.moves) && data.moves.length > 0) {
          const lastMoveData = data.moves[data.moves.length - 1];
          if (lastMoveData && lastMoveData.x !== undefined && lastMoveData.y !== undefined) {
            setLastMove({ x: lastMoveData.x, y: lastMoveData.y });
          }
          setMoves(data.moves);
        }
        
        // Fetch player info for both players
        if (data.blackPlayer && data.whitePlayer && data.playerColor) {
          // Determine which player is the opponent
          const opponentId = data.playerColor === 'black' ? data.whitePlayer : data.blackPlayer;
          const opponentColor = data.playerColor === 'black' ? 'white' : 'black';
          
          // Fetch opponent info immediately
          fetchPlayerInfo(opponentId, data.boardSize, opponentColor);
        }
      }
    });

    const unsubscribeMoveAccepted = websocketService.on(EventTypes.MOVE_ACCEPTED, (data) => {
      if (data.gameId === gameId) {
        setBoardState(data.boardState);
        setCurrentTurn(data.turn);
        // Track last move for highlighting
        if (data.move && data.move.x !== undefined && data.move.y !== undefined) {
          setLastMove({ x: data.move.x, y: data.move.y });
          setMoves((prev) => [...prev, { ...data.move, turn: data.turn }]);
        }
      }
    });

    const unsubscribeMoveRejected = websocketService.on(EventTypes.MOVE_REJECTED, (data) => {
      if (data.gameId === gameId) {
        alert(`Move rejected: ${data.reason}`);
      }
    });

    const unsubscribeResignationAccepted = websocketService.on(EventTypes.RESIGNATION_ACCEPTED, (data) => {
      if (data.gameId === gameId) {
        console.log('[GameView] Resignation accepted:', data);
        setShowResignConfirm(false);
        // Game will end, wait for GAME_ENDED event
      }
    });

    const unsubscribeGameEnded = websocketService.on(EventTypes.GAME_ENDED, (data) => {
      console.log('[GameView] GAME_ENDED event received:', data);
      if (data && data.gameId === gameId) {
        console.log('[GameView] ✅ Game ended event matches current game:', gameId);
        console.log('[GameView] Setting gameEnded=true, gameResult=', data);
        setGameEnded(true);
        setGameResult(data);
        setShowResignConfirm(false); // Close resign modal if still open
        // Disable board
        setCurrentTurn(null);
        
        // Fallback: if stats_update doesn't arrive within 1s, trigger stats refresh
        // (This is handled by MatchmakingView's stats_update listener, but we add fallback here)
        setTimeout(() => {
          console.log('[GameView] Game ended - stats should update via stats_update event');
        }, 1000);
      } else {
        console.warn('[GameView] GAME_ENDED event received but gameId mismatch:', data?.gameId, 'vs current:', gameId);
      }
    });

    // Request current game state
    if (isConnected && gameId) {
      websocketService.send(EventTypes.REQUEST_GAME_STATE, { gameId });
    }

    return () => {
      unsubscribeMatchFound();
      unsubscribeGameStarted();
      unsubscribeGameState();
      unsubscribeMoveAccepted();
      unsubscribeMoveRejected();
      unsubscribeResignationAccepted();
      unsubscribeGameEnded();
    };
  }, [gameId, isConnected]);

  /**
   * Fetch player information (name and stats) for a given player ID
   */
  const fetchPlayerInfo = async (playerId, boardSize, color) => {
    if (!playerId) return;
    
    try {
      // Use the new player-info API endpoint
      const response = await fetch(`/api/player-info?userId=${encodeURIComponent(playerId)}&boardSize=${boardSize}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const playerData = await response.json();
        const playerInfo = {
          name: playerData.username || (playerData.isGuest ? 'Gast' : 'Spieler'),
          rating: playerData.rating || 1500,
          rank: playerData.rank || '30k'
        };
        
        if (color === 'black') {
          setBlackPlayerInfo(playerInfo);
        } else {
          setWhitePlayerInfo(playerInfo);
        }
      } else {
        throw new Error(`Failed to fetch player info: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`[GameView] Error fetching player info for ${color}:`, error);
      // Set default
      const defaultInfo = {
        name: color === 'black' ? 'Schwarz' : 'Weiß',
        rating: 1500,
        rank: '30k'
      };
      if (color === 'black') {
        setBlackPlayerInfo(defaultInfo);
      } else {
        setWhitePlayerInfo(defaultInfo);
      }
    }
  };

  // Fetch own stats when playerColor and boardSize are available
  useEffect(() => {
    if (boardSize && playerColor && auth) {
      const fetchOwnStats = async () => {
        try {
          const { getGuestUserId } = await import('../utils/guestId');
          const guestId = auth.loggedIn ? null : getGuestUserId();
          let url = `/api/stats?boardSize=${boardSize}`;
          const headers = {
            'Content-Type': 'application/json'
          };
          
          if (guestId) {
            headers['X-Guest-Id'] = guestId;
            url += `&guestId=${encodeURIComponent(guestId)}`;
          }
          
          const response = await fetch(url, {
            credentials: 'include',
            headers
          });
          
          if (response.ok) {
            const statsData = await response.json();
            const updatedInfo = {
              name: auth.loggedIn && auth.user ? auth.user.username : 'Gast',
              rating: statsData.rating || 1500,
              rank: statsData.rankDisplay || '30k'
            };
            
            if (playerColor === 'black') {
              setBlackPlayerInfo(updatedInfo);
            } else {
              setWhitePlayerInfo(updatedInfo);
            }
          }
        } catch (error) {
          console.error('[GameView] Error fetching own stats:', error);
        }
      };
      
      fetchOwnStats();
    }
  }, [boardSize, playerColor, auth.loggedIn, auth.user]);

  const handleMove = (x, y) => {
    if (gameEnded) {
      return; // Game is over, no more moves
    }

    console.log('[GameView] handleMove called:', { x, y, isConnected, playerColor, currentTurn });
    
    if (!isConnected) {
      console.warn('[GameView] Not connected to server');
      alert('Not connected to server. Please wait...');
      return;
    }

    if (!gameId) {
      console.warn('[GameView] No gameId');
      return;
    }

    // Allow move if playerColor is not set yet (will be validated server-side)
    if (playerColor && currentTurn !== playerColor) {
      console.warn('[GameView] Not your turn', { playerColor, currentTurn });
      alert('Not your turn!');
      return;
    }

    console.log('[GameView] Sending move to server:', { gameId, x, y });
    websocketService.send(EventTypes.PLAY_MOVE, {
      gameId,
      x,
      y,
      pass: false
    });
  };

  const handlePass = () => {
    if (gameEnded || !isConnected) {
      return;
    }

    if (playerColor && currentTurn !== playerColor) {
      return;
    }

    websocketService.send(EventTypes.PLAY_MOVE, {
      gameId,
      pass: true
    });
  };

  const handleResign = () => {
    setShowResignConfirm(true);
  };

  const confirmResign = () => {
    console.log('[GameView] Confirming resign for game:', gameId);
    if (!gameId) {
      console.error('[GameView] Cannot resign: no gameId');
      alert('Fehler: Keine Spiel-ID gefunden.');
      setShowResignConfirm(false);
      return;
    }
    if (!websocketService.isConnected()) {
      console.error('[GameView] Cannot resign: not connected');
      alert('Nicht mit dem Server verbunden. Bitte warte...');
      setShowResignConfirm(false);
      return;
    }
    
    console.log('[GameView] Sending RESIGN event with gameId:', gameId);
    try {
      websocketService.send(EventTypes.RESIGN, { gameId });
      console.log('[GameView] ✅ Resign message sent successfully');
      setShowResignConfirm(false);
      
      // Fallback: If GAME_ENDED doesn't arrive within 2 seconds, show game end manually
      setTimeout(() => {
        if (!gameEnded) {
          console.warn('[GameView] GAME_ENDED event not received after 2s, showing game end manually');
          // Determine winner based on player color (opponent wins when we resign)
          const winner = playerColor === 'black' ? 'white' : 'black';
          setGameEnded(true);
          setGameResult({
            gameId,
            winner,
            reason: 'resignation',
            boardSize,
            finalScore: { black: 0, white: 0 },
            scoreDiff: 0
          });
        }
      }, 2000);
    } catch (error) {
      console.error('[GameView] ❌ Error sending resign:', error);
      alert('Fehler beim Senden der Aufgabe. Bitte versuche es erneut.');
      setShowResignConfirm(false);
    }
  };

  const cancelResign = () => {
    setShowResignConfirm(false);
  };

  const handleBackToHome = () => {
    // Reset all game state
    setGameState(null);
    setPlayerColor(null);
    setBoardSize(19);
    setCurrentTurn(null);
    setBoardState(null);
    setGameEnded(false);
    setGameResult(null);
    
    // Navigate back to home/matchmaking
    navigate('/');
  };

  // Debug: Log game state
  useEffect(() => {
    if (gameEnded) {
      console.log('[GameView] 🎮 Game ended state:', { gameEnded, gameResult, hasResult: !!gameResult });
    }
  }, [gameEnded, gameResult]);

  // Initialize empty board if no state yet
  const displayBoardState = boardState || (() => {
    const empty = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    return empty;
  })();

  if (!gameState && !boardState && !isConnected) {
    return (
      <div className="game-view">
        <div className="loading">Connecting to server...</div>
      </div>
    );
  }

  // Determine opponent and own player info based on playerColor
  const opponentInfo = playerColor === 'black' ? whitePlayerInfo : blackPlayerInfo;
  const ownInfo = playerColor === 'black' ? blackPlayerInfo : whitePlayerInfo;
  
  // Get own player name from auth if logged in
  const ownName = auth.loggedIn && auth.user ? auth.user.username : ownInfo.name;

  return (
    <div className="game-view">
      <div className="game-header">
        <div className="game-header__players">
          <div className="game-header__player game-header__player--opponent">
            <div className="game-header__player-name">{opponentInfo.name}</div>
            <div className="game-header__player-rank">{opponentInfo.rank} ({opponentInfo.rating})</div>
          </div>
          <div className="game-header__center">
            <div className="game-header__board-size">{boardSize}×{boardSize}</div>
            {!gameEnded && currentTurn && (
              <div className="game-header__turn">
                {currentTurn === 'black' ? '⚫' : '⚪'} {currentTurn === playerColor ? 'Dein Zug' : 'Gegner am Zug'}
              </div>
            )}
          </div>
          <div className="game-header__player game-header__player--own">
            <div className="game-header__player-name">{ownName}</div>
            <div className="game-header__player-rank">{ownInfo.rank} ({ownInfo.rating})</div>
          </div>
        </div>
      </div>

      {/* Resign Confirmation Modal */}
      {showResignConfirm && (
        <div className="resign-confirm-modal">
          <div className="resign-confirm-content">
            <h3 className="resign-confirm-title">Spiel aufgeben?</h3>
            <p className="resign-confirm-message">
              Möchtest du das Spiel wirklich aufgeben? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="resign-confirm-buttons">
              <button
                type="button"
                className="resign-confirm-button resign-confirm-button--cancel"
                onClick={cancelResign}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="resign-confirm-button resign-confirm-button--confirm"
                onClick={confirmResign}
              >
                Aufgeben
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game End Modal */}
      {gameEnded && gameResult && (
        <div className="game-end-modal" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="game-end-content" style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h2 style={{ marginTop: 0 }}>Spiel beendet</h2>
            <div className="game-result">
              <p className="winner" style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                {gameResult.winner 
                  ? `Gewinner: ${gameResult.winner === 'black' ? 'Schwarz' : 'Weiß'}`
                  : 'Unentschieden'}
              </p>
              <div className="scores" style={{ marginBottom: '1rem' }}>
                <div className="score-item" style={{ 
                  marginBottom: '0.75rem', 
                  padding: '0.5rem',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px'
                }}>
                  <span className="score-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>
                    Schwarz:
                  </span>
                  <span className="score-value" style={{ fontSize: '1.2rem', color: '#2c3e50' }}>
                    {gameResult.finalScore?.black?.toFixed(1) || '0.0'}
                  </span>
                </div>
                <div className="score-item" style={{ 
                  marginBottom: '0.75rem', 
                  padding: '0.5rem',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px'
                }}>
                  <span className="score-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>
                    Weiß:
                  </span>
                  <span className="score-value" style={{ fontSize: '1.2rem', color: '#2c3e50' }}>
                    {gameResult.finalScore?.white?.toFixed(1) || '0.0'}
                  </span>
                  {gameResult.komi > 0 && (
                    <span className="komi" style={{ 
                      display: 'block', 
                      marginTop: '0.25rem', 
                      fontSize: '0.85rem', 
                      color: '#666' 
                    }}>
                      (inkl. {gameResult.komi} Komi)
                    </span>
                  )}
                </div>
                {gameResult.scoreDiff !== undefined && gameResult.scoreDiff > 0 && (
                  <div className="score-diff" style={{ 
                    marginTop: '0.75rem', 
                    padding: '0.5rem',
                    backgroundColor: gameResult.winner === 'black' ? '#e8f5e9' : '#fff3e0',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    color: '#2c3e50'
                  }}>
                    Differenz: {gameResult.scoreDiff.toFixed(1)} Punkte
                  </div>
                )}
              </div>
              <p className="end-reason" style={{ color: '#666', fontSize: '0.9rem' }}>
                {gameResult.reason === 'two_passes' ? 'Zwei aufeinanderfolgende Pässe' : 
                 gameResult.reason === 'resignation' ? 'Aufgabe' : 
                 gameResult.reason || 'Unbekannt'}
              </p>
            </div>
            <button 
              type="button" 
              className="back-home-button" 
              onClick={handleBackToHome}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Zurück zum Start
            </button>
          </div>
        </div>
      )}

      <div className="game-content">
        <div className="board-container">
          <GoBoard
            size={boardSize}
            boardState={displayBoardState}
            onMove={handleMove}
            disabled={gameEnded || !isConnected || (playerColor ? currentTurn !== playerColor : false)}
            lastMove={lastMove}
            currentTurn={currentTurn || 'black'}
          />
        </div>

        <div className="game-controls">
          <div className="game-status">
            {gameEnded ? (
              <p className="game-ended">Game Ended</p>
            ) : (
              <>
                <p>Current Turn: <strong>{currentTurn || 'unknown'}</strong></p>
                {playerColor ? (
                  <p className={currentTurn === playerColor ? 'your-turn' : 'opponent-turn'}>
                    {currentTurn === playerColor ? 'Your turn' : "Opponent's turn"}
                  </p>
                ) : (
                  <p className="your-turn">Waiting for game to start...</p>
                )}
                <p>Your Color: <strong>{playerColor || 'not set'}</strong></p>
                <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
              </>
            )}
          </div>

          {!gameEnded && (
            <div className="control-buttons">
              <button
                onClick={handlePass}
                disabled={playerColor ? currentTurn !== playerColor : true}
                className="pass-button"
              >
                Pass
              </button>
              <button
                onClick={handleResign}
                className="resign-button"
              >
                Resign
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameView;
