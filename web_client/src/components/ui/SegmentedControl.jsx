import React from 'react';
import './SegmentedControl.css';

/**
 * SegmentedControl Component
 * 
 * A segmented control for selecting between options (e.g., board sizes)
 */
function SegmentedControl({ options, value, onChange, className = '', ...props }) {
  return (
    <div className={`segmented-control ${className}`} {...props}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`segmented-control__option ${isSelected ? 'segmented-control__option--selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
