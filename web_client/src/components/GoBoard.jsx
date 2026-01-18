import React, { useState, useRef, useEffect } from 'react';
import './GoBoard.css';

/**
 * Go Board Component
 * 
 * Renders the Go board and handles stone placement.
 * 
 * Props:
 * - size: Board size (9, 13, or 19)
 * - boardState: 2D array representing current board state (null, 'black', 'white')
 * - onMove: Callback function when a move is made (x, y)
 * - disabled: Whether the board is disabled for input
 * - lastMove: {x, y} coordinates of the last move to highlight
 * - currentTurn: 'black' or 'white' - determines hover stone color
 */
function GoBoard({ size = 19, boardState, onMove, disabled = false, lastMove = null, currentTurn = 'black' }) {
  const [hoveredIntersection, setHoveredIntersection] = useState(null);
  const boardRef = useRef(null);
  const [boardRect, setBoardRect] = useState(null);

  // Calculate board dimensions with padding
  const baseCellSize = size === 9 ? 50 : size === 13 ? 40 : 30;
  const stoneRadius = baseCellSize * 0.4;
  // Ensure padding is at least stoneRadius to prevent edge clipping
  const padding = Math.max(stoneRadius + 8, stoneRadius * 1.5);
  
  // Grid area (without padding) - distance between first and last intersection
  const gridSize = (size - 1) * baseCellSize;
  const cellSize = gridSize / (size - 1);
  
  // Total board size including padding
  const boardWidth = gridSize + (padding * 2);
  const boardHeight = gridSize + (padding * 2);

  useEffect(() => {
    const updateRect = () => {
      if (boardRef.current) {
        setBoardRect(boardRef.current.getBoundingClientRect());
      }
    };
    
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [size]);

  /**
   * Convert pixel coordinates to intersection coordinates
   * Handles scaling, padding, and proper coordinate mapping
   * @param {number} clientX - Mouse X coordinate
   * @param {number} clientY - Mouse Y coordinate
   * @returns {Object|null} {x, y} or null if outside board
   */
  const pixelToIntersection = (clientX, clientY) => {
    if (!boardRect || !boardRef.current) return null;

    // Get SVG element
    const svg = boardRef.current;
    
    // Get actual SVG dimensions (accounting for viewBox scaling)
    const svgRect = svg.getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;
    
    // Calculate scale factors (viewBox might scale differently than CSS)
    const scaleX = boardWidth / svgWidth;
    const scaleY = boardHeight / svgHeight;
    
    // Convert client coordinates to SVG coordinates
    const x = (clientX - svgRect.left) * scaleX;
    const y = (clientY - svgRect.top) * scaleY;
    
    // Subtract padding to get grid coordinates (relative to first intersection)
    const gridX = x - padding;
    const gridY = y - padding;
    
    // Check if within grid bounds (with small tolerance for edge intersections)
    const tolerance = cellSize * 0.1;
    if (gridX < -tolerance || gridX > gridSize + tolerance || 
        gridY < -tolerance || gridY > gridSize + tolerance) {
      return null;
    }
    
    // Convert to intersection coordinates using nearest neighbor
    // gridX / cellSize gives us the intersection index (0, 1, 2, ..., size-1)
    let intersectionX = Math.round(gridX / cellSize);
    let intersectionY = Math.round(gridY / cellSize);
    
    // Clamp to valid board coordinates
    intersectionX = Math.max(0, Math.min(size - 1, intersectionX));
    intersectionY = Math.max(0, Math.min(size - 1, intersectionY));
    
    // Verify click is close enough to intersection
    const actualX = intersectionX * cellSize;
    const actualY = intersectionY * cellSize;
    const distanceX = Math.abs(gridX - actualX);
    const distanceY = Math.abs(gridY - actualY);
    const maxDistance = cellSize * 0.35; // Reasonable tolerance
    
    if (distanceX > maxDistance || distanceY > maxDistance) {
      return null;
    }
    
    return { x: intersectionX, y: intersectionY };
  };

  /**
   * Handle mouse click on board
   * @param {MouseEvent} e - Mouse event
   */
  const handleClick = (e) => {
    if (disabled) return;

    const intersection = pixelToIntersection(e.clientX, e.clientY);
    if (intersection) {
      const { x, y } = intersection;
      
      // Check if intersection is already occupied
      if (boardState && boardState[y] && boardState[y][x] !== null) {
        return;
      }

      onMove(x, y);
    }
  };

  /**
   * Handle mouse move for hover effect
   * @param {MouseEvent} e - Mouse event
   */
  const handleMouseMove = (e) => {
    if (disabled) {
      setHoveredIntersection(null);
      return;
    }

    const intersection = pixelToIntersection(e.clientX, e.clientY);
    if (intersection) {
      const { x, y } = intersection;
      
      // Only show hover if intersection is empty
      if (!boardState || !boardState[y] || boardState[y][x] === null) {
        setHoveredIntersection(intersection);
      } else {
        setHoveredIntersection(null);
      }
    } else {
      setHoveredIntersection(null);
    }
  };

  /**
   * Handle mouse leave
   */
  const handleMouseLeave = () => {
    setHoveredIntersection(null);
  };

  // Get star points (hoshi) positions for different board sizes
  const getStarPoints = () => {
    if (size === 19) {
      // 19x19: 9 points (3x3 grid)
      const starPositions = [3, 9, 15];
      const points = [];
      for (const x of starPositions) {
        for (const y of starPositions) {
          points.push({ x, y });
        }
      }
      return points;
    } else if (size === 13) {
      // 13x13: 5 points (corners and center)
      return [
        { x: 3, y: 3 },   // Top-left corner
        { x: 3, y: 9 },   // Top-right corner
        { x: 6, y: 6 },   // Center
        { x: 9, y: 3 },   // Bottom-left corner
        { x: 9, y: 9 }    // Bottom-right corner
      ];
    } else if (size === 9) {
      // 9x9: 5 points (corners and center)
      return [
        { x: 2, y: 2 },   // Top-left corner
        { x: 2, y: 6 },   // Top-right corner
        { x: 4, y: 4 },   // Center
        { x: 6, y: 2 },   // Bottom-left corner
        { x: 6, y: 6 }    // Bottom-right corner
      ];
    }
    return [];
  };

  const starPoints = getStarPoints();

  // Calculate intersection position (with padding)
  const getIntersectionPos = (x, y) => {
    return {
      x: padding + x * cellSize,
      y: padding + y * cellSize
    };
  };

  return (
    <div className="go-board-container">
      <svg
        ref={boardRef}
        className="go-board"
        width={boardWidth}
        height={boardHeight}
        viewBox={`0 0 ${boardWidth} ${boardHeight}`}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Board background */}
        <rect
          x="0"
          y="0"
          width={boardWidth}
          height={boardHeight}
          fill="#DCB35C"
        />

        {/* Grid lines (within padding area) */}
        {Array.from({ length: size }).map((_, i) => {
          const pos = getIntersectionPos(i, 0);
          const endPos = getIntersectionPos(i, size - 1);
          const hPos = getIntersectionPos(0, i);
          const hEndPos = getIntersectionPos(size - 1, i);
          
          return (
            <React.Fragment key={i}>
              {/* Vertical lines */}
              <line
                x1={pos.x}
                y1={pos.y}
                x2={endPos.x}
                y2={endPos.y}
                stroke="#000"
                strokeWidth="1"
              />
              {/* Horizontal lines */}
              <line
                x1={hPos.x}
                y1={hPos.y}
                x2={hEndPos.x}
                y2={hEndPos.y}
                stroke="#000"
                strokeWidth="1"
              />
            </React.Fragment>
          );
        })}

        {/* Star points (hoshi) */}
        {starPoints.map((point, idx) => {
          const pos = getIntersectionPos(point.x, point.y);
          return (
            <circle
              key={idx}
              cx={pos.x}
              cy={pos.y}
              r="3"
              fill="#000"
            />
          );
        })}

        {/* Existing stones */}
        {boardState && boardState.map((row, y) =>
          row.map((cell, x) => {
            if (cell === null) return null;
            const pos = getIntersectionPos(x, y);
            return (
              <circle
                key={`${x}-${y}`}
                cx={pos.x}
                cy={pos.y}
                r={stoneRadius}
                fill={cell === 'black' ? '#000' : '#fff'}
                stroke="#000"
                strokeWidth="1"
              />
            );
          })
        )}

        {/* Last move highlight */}
        {lastMove && lastMove.x !== undefined && lastMove.y !== undefined && (() => {
          const pos = getIntersectionPos(lastMove.x, lastMove.y);
          return (
            <circle
              cx={pos.x}
              cy={pos.y}
              r={stoneRadius * 1.15}
              fill="none"
              stroke="#ffd700"
              strokeWidth="3"
              opacity="0.8"
            />
          );
        })()}

        {/* Hover indicator */}
        {hoveredIntersection && !disabled && (() => {
          const pos = getIntersectionPos(hoveredIntersection.x, hoveredIntersection.y);
          const isBlack = currentTurn === 'black';
          return (
            <circle
              cx={pos.x}
              cy={pos.y}
              r={stoneRadius}
              fill={isBlack ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.3)"}
              stroke={isBlack ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.5)"}
              strokeWidth="2"
              strokeDasharray="4,4"
            />
          );
        })()}
      </svg>
    </div>
  );
}

export default GoBoard;
