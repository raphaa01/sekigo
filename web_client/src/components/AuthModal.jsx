import React, { useState } from 'react';
import './AuthModal.css';

/**
 * Authentication Modal Component
 * 
 * Provides Login, Register, and Guest options in a modal dialog.
 */
function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { login, register } = await import('../services/auth.js');
      
      if (activeTab === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }

      // Success - close modal and refresh auth state
      setUsername('');
      setPassword('');
      setError(null);
      onAuthSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = () => {
    // Just close modal, no action needed
    onClose();
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Schließen">
          ×
        </button>

        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', color: '#2c3e50' }}>
          {activeTab === 'login' ? 'Einloggen' : 'Konto erstellen'}
        </h2>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #e0e0e0' }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'login' ? '2px solid #3498db' : '2px solid transparent',
              color: activeTab === 'login' ? '#3498db' : '#666',
              fontWeight: activeTab === 'login' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '1rem',
              marginBottom: '-2px'
            }}
          >
            Einloggen
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'register' ? '2px solid #3498db' : '2px solid transparent',
              color: activeTab === 'register' ? '#3498db' : '#666',
              fontWeight: activeTab === 'register' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '1rem',
              marginBottom: '-2px'
            }}
          >
            Registrieren
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c33',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>
              Benutzername
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={50}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
              placeholder="Benutzername"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
              placeholder="Passwort"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              fontWeight: '600',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: loading ? '#ccc' : '#3498db',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '1rem',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Bitte warten...' : (activeTab === 'login' ? 'Einloggen' : 'Konto erstellen')}
          </button>
        </form>

        {/* Guest continue button */}
        <button
          type="button"
          onClick={handleGuestContinue}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '0.9rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: 'white',
            color: '#666',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
        >
          Als Gast fortfahren
        </button>
      </div>
    </div>
  );
}

export default AuthModal;
