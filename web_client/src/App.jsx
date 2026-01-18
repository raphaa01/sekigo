import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MatchmakingView from './components/MatchmakingView';
import GameView from './components/GameView';
import ImpressumView from './components/ImpressumView';
import AppShell from './components/AppShell';
import Footer from './components/Footer';
import { ToastProvider } from './components/ui/ToastContainer';
import { ThemeProvider } from './contexts/ThemeContext';
import { getCurrentUser } from './services/auth';
import './App.css';

// Auth Context
const AuthContext = createContext({
  auth: { loading: true, loggedIn: false, user: null },
  refreshAuth: () => {}
});

export const useAuth = () => useContext(AuthContext);

function App() {
  const [auth, setAuth] = useState({ loading: true, loggedIn: false, user: null });

  const refreshAuth = async () => {
    setAuth(prev => ({ ...prev, loading: true }));
    const authState = await getCurrentUser();
    setAuth({ ...authState, loading: false });
  };

  // Load auth state on mount
  useEffect(() => {
    refreshAuth();
  }, []);

  return (
    <ThemeProvider>
      <AuthContext.Provider value={{ auth, refreshAuth }}>
        <ToastProvider>
          <Router>
            <AppShell>
              <Routes>
                <Route path="/" element={<MatchmakingView />} />
                <Route path="/game/:gameId" element={<GameView />} />
                <Route path="/impressum" element={<ImpressumView />} />
              </Routes>
              <Footer />
            </AppShell>
          </Router>
        </ToastProvider>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

export default App;
