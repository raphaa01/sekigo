import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { websocketService } from '../services/websocket';
import Chip from './ui/Chip';
import './AppShell.css';

// Tab Context for sharing activeTab between AppShell and MatchmakingView
const TabContext = React.createContext({
  activeTab: 'spielen',
  setActiveTab: () => {}
});

export const useTab = () => React.useContext(TabContext);

/**
 * AppShell Component
 * 
 * Main layout wrapper with top bar
 */
function AppShell({ children }) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isConnected, setIsConnected] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('spielen');

  React.useEffect(() => {
    const checkConnection = () => {
      setIsConnected(websocketService.isConnected());
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleLogoClick = () => {
    navigate('/');
  };

  // Only show tabs on home page
  const isHomePage = location.pathname === '/';

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="app-shell">
        <header className="app-shell__header">
          <div className="app-shell__header-content">
            <button
              type="button"
              className="app-shell__logo"
              onClick={handleLogoClick}
            >
              <span className="app-shell__logo-icon">⚫</span>
              <span className="app-shell__logo-text">SekiGo</span>
            </button>
            
            <div className="app-shell__header-right">
              {isHomePage && (
                <div className="app-shell__tabs">
                  <button
                    type="button"
                    className={`app-shell__tab ${activeTab === 'spielen' ? 'app-shell__tab--active' : ''}`}
                    onClick={() => setActiveTab('spielen')}
                  >
                    Spielen
                  </button>
                  <button
                    type="button"
                    className={`app-shell__tab ${activeTab === 'konto' ? 'app-shell__tab--active' : ''}`}
                    onClick={() => setActiveTab('konto')}
                  >
                    Konto
                  </button>
                  <button
                    type="button"
                    className={`app-shell__tab ${activeTab === 'rangliste' ? 'app-shell__tab--active' : ''}`}
                    onClick={() => setActiveTab('rangliste')}
                  >
                    Rangliste
                  </button>
                  <button
                    type="button"
                    className={`app-shell__tab ${activeTab === 'einstellungen' ? 'app-shell__tab--active' : ''}`}
                    onClick={() => setActiveTab('einstellungen')}
                  >
                    Einstellungen
                  </button>
                </div>
              )}
              
              <Chip variant={isConnected ? 'success' : 'error'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Chip>
              
              {auth.loggedIn && auth.user ? (
                <button
                  type="button"
                  className="app-shell__user"
                  onClick={() => {
                    if (isHomePage) {
                      setActiveTab('konto');
                    } else {
                      navigate('/');
                      // Use setTimeout to ensure navigation completes before setting tab
                      setTimeout(() => setActiveTab('konto'), 0);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <span className="app-shell__username">{auth.user.username}</span>
                </button>
              ) : (
                <Chip variant="default">Guest</Chip>
              )}
            </div>
          </div>
        </header>
        
        <main className="app-shell__main">
          {children}
        </main>
      </div>
    </TabContext.Provider>
  );
}

export default AppShell;
