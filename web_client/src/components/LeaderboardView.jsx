import React, { useState, useEffect } from 'react';
import Card from './ui/Card';
import Chip from './ui/Chip';
import './LeaderboardView.css';

/**
 * Leaderboard View Component
 * 
 * Displays top 10 players ranked by rating
 */
function LeaderboardView() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[LeaderboardView] Fetching leaderboard...');
      const response = await fetch('/api/leaderboard', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('[LeaderboardView] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeaderboardView] Error response:', errorText);
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[LeaderboardView] Received data:', data);
      console.log('[LeaderboardView] Players count:', data.players?.length || 0);
      
      setLeaderboard(data.players || []);
    } catch (err) {
      console.error('[LeaderboardView] Error fetching leaderboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRankDisplay = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const formatRank = (rating) => {
    // Match backend RANK_THRESHOLDS logic
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
    
    for (const threshold of RANK_THRESHOLDS) {
      if (rating >= threshold.min && rating <= threshold.max) {
        return threshold.rank;
      }
    }
    return '30k'; // Default fallback
  };

  if (loading) {
    return (
      <div className="leaderboard-view">
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Lade Rangliste...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-view">
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--color-error)' }}>Fehler: {error}</p>
            <button
              onClick={fetchLeaderboard}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Erneut versuchen
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="leaderboard-view">
      <Card>
        <h2 className="leaderboard-title">Rangliste</h2>
        <p className="leaderboard-subtitle">Top 10 Spieler nach Rating</p>
        
        {leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Noch keine Spieler in der Rangliste.</p>
          </div>
        ) : (
          <div className="leaderboard-list">
            {leaderboard.map((player, index) => (
              <div key={player.id || index} className="leaderboard-item">
                <div className="leaderboard-rank">
                  {getRankDisplay(index + 1)}
                </div>
                <div className="leaderboard-player">
                  <div className="leaderboard-username">
                    {player.username || (player.isGuest ? 'Gast' : 'Unbekannt')}
                  </div>
                  {player.isGuest && (
                    <Chip variant="default" size="sm">Gast</Chip>
                  )}
                </div>
                <div className="leaderboard-stats">
                  <div className="leaderboard-rating">
                    <span className="leaderboard-rating-value">{Math.round(player.rating)}</span>
                    <span className="leaderboard-rank-display">{formatRank(player.rating)}</span>
                  </div>
                  <div className="leaderboard-games">
                    {player.games || 0} Spiele
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default LeaderboardView;
