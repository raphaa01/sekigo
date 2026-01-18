import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { websocketService } from '../services/websocket';
import { EventTypes } from '../constants/events';
import { getGuestUserId } from '../utils/guestId';
import { useAuth } from '../App';
import { logout } from '../services/auth';
import AuthModal from './AuthModal';
import Button from './ui/Button';
import Card from './ui/Card';
import Chip from './ui/Chip';
import SegmentedControl from './ui/SegmentedControl';
import { useToast } from './ui/ToastContainer';
import { useTab } from './AppShell';
import SettingsView from './SettingsView';
import './MatchmakingView.css';

/**
 * Matchmaking View Component
 * 
 * Main home screen with tabs: "Spielen" (Matchmaking) and "Konto" (Account/Stats)
 */
function MatchmakingView({ onMatchFound }) {
  const { auth, refreshAuth } = useAuth();
  const { activeTab } = useTab(); // Get activeTab from AppShell context (tabs are in header)
  const [boardSize, setBoardSize] = useState(19);
  const [isInQueue, setIsInQueue] = useState(false);
  const [isJoining, setIsJoining] = useState(false); // Flag to prevent duplicate join_queue
  const [isConnected, setIsConnected] = useState(false);
  const [queuePosition, setQueuePosition] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // Initialize with safe defaults to prevent crashes
  const defaultStats = {
    rating: 1500,
    rankDisplay: '30k',
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winrate: 0,
    highestRating: 1500
  };
  
  const [playerStats, setPlayerStats] = useState(defaultStats);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const navigate = useNavigate();
  
  // Fetch stats from REST API
  const fetchStats = async (boardSizeToFetch) => {
    setStatsLoading(true);
    setStatsError(null);
    
    try {
      // Build URL: always include boardSize
      // For accounts: backend reads from session cookie (do NOT pass guestId)
      // For guests: pass guestId in X-Guest-Id header (preferred) or query param
      let url = `/api/stats?boardSize=${boardSizeToFetch}`;
      const guestId = getGuestUserId();
      
      const identityType = auth.loggedIn && auth.user ? 'account' : 'guest';
      const identityId = auth.loggedIn && auth.user ? auth.user.id : guestId;
      console.log(`[MatchmakingView] Fetching stats: ${url} (identity: ${identityType}:${identityId})`);
      
      // Build headers: always send X-Guest-Id for guests, credentials for accounts
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Always send guestId in header (backend will prioritize session cookie if logged in)
      headers['X-Guest-Id'] = guestId;
      
      // Also include in query for compatibility (only for guests)
      if (!auth.loggedIn || !auth.user) {
        url += `&guestId=${encodeURIComponent(guestId)}`;
      }
      
      console.log(`[MatchmakingView] Fetching stats - loggedIn: ${auth.loggedIn}, userId: ${auth.user?.id}, guestId: ${guestId}`);
      
      const response = await fetch(url, {
        credentials: 'include', // Important: send cookies for session (even for guests)
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to fetch stats: ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Use statusText if JSON parsing fails
        }
        console.error(`[MatchmakingView] Stats fetch failed: ${response.status} ${response.statusText}`, errorText);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Validate response shape - must have identity, stats object, etc.
      if (!data || typeof data !== 'object') {
        console.warn('[MatchmakingView] Invalid stats response, using defaults:', data);
        setPlayerStats(defaultStats);
        return;
      }
      
      // Ensure stats object exists (backend should always provide it)
      if (!data.stats || typeof data.stats !== 'object') {
        console.warn('[MatchmakingView] Missing stats object in response, using defaults:', data);
        setPlayerStats(defaultStats);
        return;
      }
      
      console.log(`[MatchmakingView] ✅ Stats loaded for ${data.identity?.type || 'unknown'}:${data.identity?.id || 'unknown'} - games: ${data.stats.games}, rating: ${data.rating}`);
      
      // Safely extract stats with defaults
      setPlayerStats({
        rating: data.rating ?? defaultStats.rating,
        rankDisplay: data.rankDisplay ?? defaultStats.rankDisplay,
        games: data.stats.games ?? defaultStats.games,
        wins: data.stats.wins ?? defaultStats.wins,
        losses: data.stats.losses ?? defaultStats.losses,
        draws: data.stats.draws ?? defaultStats.draws,
        winrate: data.stats.winrate ?? defaultStats.winrate,
        highestRating: data.stats.highestRating ?? defaultStats.highestRating
      });
    } catch (error) {
      console.error('[MatchmakingView] Error fetching stats:', error);
      setStatsError(error.message);
      setPlayerStats(defaultStats);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch stats on mount, when boardSize changes, or when auth state changes
  useEffect(() => {
    if (!auth.loading) {
      fetchStats(boardSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSize, auth.loggedIn, auth.user?.id, auth.loading]);

  useEffect(() => {
    // Connect to WebSocket
    console.log('[MatchmakingView] Attempting to connect WebSocket...');
    setIsConnecting(true);
    setConnectionError(null);
    
    websocketService.connect().then(() => {
      console.log('[MatchmakingView] ✅ WebSocket connected');
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
    }).catch((error) => {
      console.error('[MatchmakingView] ❌ Failed to connect:', error);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(error.message || 'Verbindungsfehler');
    });

    // Listen for connection events
    const unsubscribeConnecting = websocketService.on('connecting', () => {
      setIsConnecting(true);
      setConnectionError(null);
    });

    const unsubscribeConnected = websocketService.on('connected', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
    });

    const unsubscribeDisconnected = websocketService.on('disconnected', (data) => {
      setIsConnected(false);
      setIsInQueue(false); // Reset queue status on disconnect
      setIsJoining(false); // Clear joining flag on disconnect
      setQueuePosition(null);
      setIsConnecting(false);
      if (data?.code !== 1000) {
        setConnectionError('Verbindung getrennt. Versuche erneut...');
      }
    });

    const unsubscribeError = websocketService.on('error', (data) => {
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(data?.message || 'Verbindungsfehler');
    });

    const unsubscribeTimeout = websocketService.on('connection_timeout', (data) => {
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(data?.message || 'Verbindungs-Timeout');
    });

    // Listen for queue events
    const unsubscribeQueueJoined = websocketService.on(EventTypes.QUEUE_JOINED, (data) => {
      console.log('[MatchmakingView] Queue joined:', data);
      
      // Always clear joining flag when we get a response
      setIsJoining(false);
      
      // Set queue status based on server response
      if (data.in_queue) {
        // Already in queue - just update position, don't change isInQueue
        console.log('[MatchmakingView] Already in queue, updating position:', data.queuePosition);
        setQueuePosition(data.queuePosition);
        // Ensure isInQueue is true (might have been false if state was lost)
        setIsInQueue(true);
      } else {
        // Successfully joined queue
        setIsInQueue(true);
        setQueuePosition(data.queuePosition);
      }
    });

    const unsubscribeQueueLeft = websocketService.on(EventTypes.QUEUE_LEFT, () => {
      setIsInQueue(false);
      setIsJoining(false); // Clear joining flag too
      setQueuePosition(null);
    });

    // Listen for match found
    const unsubscribeMatchFound = websocketService.on(EventTypes.MATCH_FOUND, (data) => {
      console.log('[MatchmakingView] 🎮 Match found!', data);
      setIsInQueue(false);
      setIsJoining(false); // Clear joining flag on match found
      setQueuePosition(null);
      
      if (onMatchFound) {
        onMatchFound(data);
      }
      
      navigate(`/game/${data.gameId}`);
    });

    // Listen for server errors
    const unsubscribeServerError = websocketService.on(EventTypes.ERROR, (data) => {
      console.error('[MatchmakingView] Server error:', data.error);
      alert(`Fehler: ${data.error}`);
    });

    // Listen for stats updates (from game end or WS)
    const unsubscribeStatsUpdate = websocketService.on(EventTypes.STATS_UPDATE, (data) => {
      console.log('[MatchmakingView] 📊 Stats update received:', data);
      
      // Validate data shape
      if (!data || typeof data !== 'object') {
        console.warn('[MatchmakingView] Invalid stats_update payload:', data);
        return;
      }
      
      // Check if stats object exists
      if (!data.stats || typeof data.stats !== 'object') {
        console.warn('[MatchmakingView] Missing stats object in stats_update, fetching from API');
        // Fallback: fetch from API
        setTimeout(() => fetchStats(data.boardSize || boardSize), 200);
        return;
      }
      
      // Update stats if boardSize matches current view
      if (data.boardSize === boardSize) {
        console.log(`[MatchmakingView] ✅ Updating stats from WS - identity: ${data.identity?.type || 'unknown'}:${data.identity?.id || 'unknown'}, games: ${data.stats.games}, rating: ${data.rating}`);
        
        // Safely update stats with validation
        setPlayerStats({
          rating: data.rating ?? defaultStats.rating,
          rankDisplay: data.rankDisplay ?? defaultStats.rankDisplay,
          games: data.stats.games ?? defaultStats.games,
          wins: data.stats.wins ?? defaultStats.wins,
          losses: data.stats.losses ?? defaultStats.losses,
          draws: data.stats.draws ?? defaultStats.draws,
          winrate: data.stats.winrate ?? defaultStats.winrate,
          highestRating: data.stats.highestRating ?? defaultStats.highestRating
        });
      } else {
        console.log(`[MatchmakingView] Stats update for boardSize ${data.boardSize}, current view is ${boardSize} - ignoring`);
      }
    });
    
    // Listen for game_end events as fallback to trigger stats refresh
    const unsubscribeGameEnded = websocketService.on(EventTypes.GAME_ENDED, (data) => {
      console.log('[MatchmakingView] 🎮 Game ended event received:', data);
      
      if (data && data.boardSize) {
        // Debounce: only fetch if boardSize matches current view
        if (data.boardSize === boardSize) {
          console.log(`[MatchmakingView] Game ended for boardSize ${boardSize}, triggering stats refresh in 300ms`);
          // Fallback: fetch stats after game end (in case stats_update doesn't arrive)
          setTimeout(() => {
            console.log('[MatchmakingView] Fetching stats after game_end (fallback)');
            fetchStats(boardSize);
          }, 300);
        }
      }
    });

    // Cleanup on unmount and page unload
    const cleanup = () => {
      // Leave queue if still in queue or joining
      if (isInQueue || isJoining) {
        console.log('[MatchmakingView] Cleanup: leaving queue before unmount/unload');
        websocketService.send(EventTypes.LEAVE_QUEUE);
      }
    };

    // Cleanup on unmount
    const cleanupOnUnmount = () => {
      unsubscribeConnecting();
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeError();
      unsubscribeTimeout();
      unsubscribeQueueJoined();
      unsubscribeQueueLeft();
      unsubscribeMatchFound();
      unsubscribeServerError();
      unsubscribeStatsUpdate();
      unsubscribeGameEnded();
      
      cleanup();
    };

    // Cleanup on page unload/beforeunload
    const handleBeforeUnload = (e) => {
      cleanup();
      // Note: Modern browsers may ignore custom messages
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', cleanup); // For mobile browsers

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', cleanup);
      cleanupOnUnmount();
    };
  }, [navigate, onMatchFound, boardSize, isInQueue]);

  const handleRetry = () => {
    console.log('[MatchmakingView] Retrying connection...');
    setConnectionError(null);
    setIsConnecting(true);
    websocketService.clearError();
    websocketService.connect().then(() => {
      setIsConnected(true);
      setIsConnecting(false);
    }).catch((error) => {
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError(error.message || 'Verbindungsfehler');
    });
  };

  const handleJoinQueue = () => {
    if (!isConnected) {
      alert('Nicht mit Server verbunden. Bitte warten...');
      return;
    }

    // Prevent duplicate join_queue calls (check both flags)
    if (isInQueue || isJoining) {
      console.log('[MatchmakingView] Already in queue or joining, ignoring duplicate join request', { isInQueue, isJoining });
      return;
    }

    // Set joining flag BEFORE sending (prevents double clicks)
    setIsJoining(true);

    // Always include guestId for safety (even if logged in, backend will use session)
    const guestId = getGuestUserId();
    console.log('[MatchmakingView] Joining queue with boardSize:', boardSize, 'guestId:', guestId);
    
    websocketService.send(EventTypes.JOIN_QUEUE, {
      boardSize,
      guestId // Include for safety
    });
    
    // Note: isInQueue will be set to true only after server confirms with QUEUE_JOINED
  };

  const handleLeaveQueue = () => {
    console.log('[MatchmakingView] Leaving queue');
    websocketService.send(EventTypes.LEAVE_QUEUE);
    setIsInQueue(false);
    setIsJoining(false); // Clear joining flag
    setQueuePosition(null);
  };

  const handleLogout = async () => {
    await logout();
    await refreshAuth();
    fetchStats(boardSize);
  };

  return (
    <div className="matchmaking-view" style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}>
      {/* Spielen Tab Content */}
      {activeTab === 'spielen' && (
        <div>
          <div className="matchmaking-card" style={{
            padding: '1.5rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', color: '#2c3e50' }}>Online Spielen</h2>
            
            {/* Board Size Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>
                Brettgröße:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[9, 13, 19].map(size => (
                  <button
                    key={size}
                    onClick={() => setBoardSize(size)}
                    disabled={isInQueue || isJoining}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '2px solid',
                      borderColor: boardSize === size ? '#3498db' : '#e0e0e0',
                      borderRadius: '8px',
                      backgroundColor: boardSize === size ? '#e3f2fd' : 'white',
                      color: boardSize === size ? '#3498db' : '#666',
                      cursor: isInQueue ? 'not-allowed' : 'pointer',
                      fontWeight: boardSize === size ? '600' : '400',
                      transition: 'all 0.2s',
                      opacity: isInQueue ? 0.6 : 1
                    }}
                  >
                    {size}×{size}
                  </button>
                ))}
              </div>
            </div>
            
            {(!isConnected || isConnecting || connectionError) ? (
              <div className="connection-status">
                {isConnecting && !connectionError && (
                  <>
                    <p>Verbinde mit Server...</p>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                      Bitte warten...
                    </p>
                  </>
                )}
                {connectionError && (
                  <>
                    <p style={{ color: '#e74c3c', fontWeight: 'bold', marginBottom: '1rem' }}>
                      {connectionError}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                      Starte Backend: <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>cd server && npm start</code>
                    </p>
                    <button 
                      className="retry-button"
                      onClick={handleRetry}
                      style={{
                        padding: '0.75rem 1.5rem',
                        fontSize: '1rem',
                        border: 'none',
                        borderRadius: '4px',
                        background: '#3498db',
                        color: 'white',
                        cursor: 'pointer',
                        marginTop: '0.5rem'
                      }}
                    >
                      Erneut versuchen
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {!isInQueue ? (
                  <button 
                    className="join-queue-button"
                    onClick={handleJoinQueue}
                    disabled={!isConnected || isConnecting || isInQueue || isJoining}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      opacity: (!isConnected || isConnecting || isInQueue) ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#2874a6'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
                  >
                    Play Online
                  </button>
                ) : (
                  <div className="queue-status" style={{ textAlign: 'center', padding: '1rem' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#2c3e50' }}>
                      Du bist schon in der Warteschlange...
                    </p>
                    {queuePosition && (
                      <p className="queue-position" style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                        Position in Warteschlange: {queuePosition}
                      </p>
                    )}
                    <button 
                      className="leave-queue-button"
                      onClick={handleLeaveQueue}
                      style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1.5rem',
                        fontSize: '1rem',
                        border: '1px solid #e74c3c',
                        borderRadius: '4px',
                        background: 'white',
                        color: '#e74c3c',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s, color 0.2s'
                      }}
                      onMouseEnter={(e) => { e.target.style.backgroundColor = '#e74c3c'; e.target.style.color = 'white'; }}
                      onMouseLeave={(e) => { e.target.style.backgroundColor = 'white'; e.target.style.color = '#e74c3c'; }}
                    >
                      Warteschlange verlassen
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Login Hinweis für Gäste */}
          {!auth.loggedIn && !auth.loading && (
            <div className="login-hint" style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-info-light)',
              border: '1px solid var(--color-info-light-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '1rem' }}>ℹ️</span>
              <span>
                <strong>Hinweis:</strong> Melde dich an, um deinen Fortschritt zu speichern.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Einstellungen Tab Content */}
      {activeTab === 'einstellungen' && (
        <SettingsView />
      )}

      {/* Konto Tab Content */}
      {activeTab === 'konto' && (
        <div>
          {/* Auth Status */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                {auth.loading ? (
                  'Lade...'
                ) : auth.loggedIn && auth.user ? (
                  <span>Eingeloggt als <strong>{auth.user.username}</strong></span>
                ) : (
                  <span>Gast-Modus</span>
                )}
              </div>
              <div>
                {auth.loggedIn && auth.user ? (
                  <button
                    onClick={handleLogout}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.9rem',
                      border: '1px solid #e74c3c',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      color: '#e74c3c',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#e74c3c';
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.color = '#e74c3c';
                    }}
                  >
                    Abmelden
                  </button>
                ) : (
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.9rem',
                      border: '1px solid #3498db',
                      borderRadius: '4px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#2874a6'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
                  >
                    Registrieren / Einloggen
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Panel */}
          <div className="stats-panel" style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#2c3e50' }}>Meine Statistiken</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#22c55e' : '#e74c3c'
                }}></div>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {isConnected ? 'Verbunden' : 'Getrennt'}
                </span>
              </div>
            </div>
            
            {/* Board Size Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>
                Brettgröße:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[9, 13, 19].map(size => (
                  <button
                    key={size}
                    onClick={() => setBoardSize(size)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '2px solid',
                      borderColor: boardSize === size ? '#3498db' : '#e0e0e0',
                      borderRadius: '8px',
                      backgroundColor: boardSize === size ? '#e3f2fd' : 'white',
                      color: boardSize === size ? '#3498db' : '#666',
                      cursor: 'pointer',
                      fontWeight: boardSize === size ? '600' : '400',
                      transition: 'all 0.2s'
                    }}
                  >
                    {size}×{size}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Display */}
            {statsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                Lade Statistiken...
              </div>
            ) : statsError ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <p style={{ color: '#e74c3c', marginBottom: '0.5rem' }}>{statsError}</p>
                <button
                  onClick={() => fetchStats(boardSize)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.9rem',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Erneut versuchen
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Rang</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    {playerStats?.rankDisplay || '30k'}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Rating</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    {playerStats?.rating ?? 1500}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Spiele</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    {playerStats?.games ?? 0}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Winrate</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    {(playerStats?.winrate ?? 0).toFixed(1)}%
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Bilanz</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2c3e50' }}>
                    {playerStats?.wins ?? 0} Siege / {playerStats?.losses ?? 0} Niederlagen / {playerStats?.draws ?? 0} Unentschieden
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={async () => {
          await refreshAuth();
          fetchStats(boardSize);
        }}
      />
    </div>
  );
}

export default MatchmakingView;
