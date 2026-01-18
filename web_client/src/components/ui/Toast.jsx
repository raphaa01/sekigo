import React, { useEffect } from 'react';
import './Toast.css';

/**
 * Toast Component
 * 
 * A toast notification component
 * Variants: success, error, warning, info
 */
function Toast({ message, variant = 'info', onClose, duration = 5000 }) {
  useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={`toast toast--${variant}`}>
      <span className="toast__message">{message}</span>
      {onClose && (
        <button
          type="button"
          className="toast__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default Toast;
