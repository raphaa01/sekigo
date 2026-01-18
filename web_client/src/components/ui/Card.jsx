import React from 'react';
import './Card.css';

/**
 * Card Component
 * 
 * A container component with rounded corners and shadow
 */
function Card({ children, className = '', padding = 'md', ...props }) {
  const classes = [
    'card',
    `card--padding-${padding}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export default Card;
