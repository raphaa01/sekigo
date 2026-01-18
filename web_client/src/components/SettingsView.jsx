import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from './ui/Card';
import './SettingsView.css';

/**
 * Settings View Component
 * 
 * Settings page with theme toggle
 */
function SettingsView() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="settings-view">
      <Card padding="lg">
        <h2 className="settings-view__title">Einstellungen</h2>
        
        <div className="settings-view__section">
          <h3 className="settings-view__section-title">Erscheinungsbild</h3>
          
          <div className="settings-view__option">
            <div className="settings-view__option-label">
              <span className="settings-view__option-name">Theme</span>
              <span className="settings-view__option-description">
                Wähle zwischen Dark Mode und Light Mode
              </span>
            </div>
            
            <div className="settings-view__theme-toggle">
              <button
                type="button"
                className={`settings-view__theme-button ${theme === 'dark' ? 'settings-view__theme-button--active' : ''}`}
                onClick={() => theme !== 'dark' && toggleTheme()}
              >
                <span className="settings-view__theme-icon">🌙</span>
                <span>Dark Mode</span>
              </button>
              <button
                type="button"
                className={`settings-view__theme-button ${theme === 'light' ? 'settings-view__theme-button--active' : ''}`}
                onClick={() => theme !== 'light' && toggleTheme()}
              >
                <span className="settings-view__theme-icon">☀️</span>
                <span>Light Mode</span>
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default SettingsView;
