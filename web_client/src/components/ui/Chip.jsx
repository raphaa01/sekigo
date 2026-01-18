import React from 'react';
import './Chip.css';

/**
 * Chip Component
 * 
 * Small badge/indicator component
 * Variants: default, success, warning, error, info
 */
function Chip({ children, variant = 'default', className = '', ...props }) {
  const classes = [
    'chip',
    `chip--${variant}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}

export default Chip;
