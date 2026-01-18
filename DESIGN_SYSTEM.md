# Design System - Chess.com-inspired Theme

## Overview
This design system provides a modern, app-like UI inspired by Chess.com with a dark theme and green accent colors.

## Color Palette

### Background & Surfaces
- **Primary Background**: `#1a1a1a` - Main app background
- **Secondary Background**: `#242424` - Header/panels
- **Tertiary Background**: `#2d2d2d` - Subtle surfaces
- **Card Background**: `#2a2a2a` - Card/panel surfaces
- **Hover Background**: `#333333` - Hover states

### Text Colors
- **Primary Text**: `#ffffff` - Main text
- **Secondary Text**: `#b3b3b3` - Secondary text
- **Tertiary Text**: `#808080` - Muted text
- **Muted Text**: `#666666` - Very muted text

### Primary Accent (Green)
- **Primary**: `#22c55e` - Main action color
- **Primary Hover**: `#16a34a` - Hover state
- **Primary Active**: `#15803d` - Active/pressed state
- **Primary Light**: `rgba(34, 197, 94, 0.1)` - Subtle backgrounds

### Secondary
- **Secondary**: `#4b5563` - Secondary actions
- **Secondary Hover**: `#6b7280`
- **Secondary Active**: `#374151`

### Status Colors
- **Success**: `#22c55e`
- **Warning**: `#f59e0b`
- **Error**: `#ef4444`
- **Info**: `#3b82f6`

## Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
```

### Font Sizes
- **xs**: `0.75rem` (12px)
- **sm**: `0.875rem` (14px)
- **base**: `1rem` (16px)
- **lg**: `1.125rem` (18px)
- **xl**: `1.25rem` (20px)
- **2xl**: `1.5rem` (24px)
- **3xl**: `1.875rem` (30px)
- **4xl**: `2.25rem` (36px)

### Font Weights
- **normal**: 400
- **medium**: 500
- **semibold**: 600
- **bold**: 700

## Spacing

- **xs**: `0.25rem` (4px)
- **sm**: `0.5rem` (8px)
- **md**: `1rem` (16px)
- **lg**: `1.5rem` (24px)
- **xl**: `2rem` (32px)
- **2xl**: `3rem` (48px)
- **3xl**: `4rem` (64px)

## Border Radius

- **sm**: `6px`
- **md**: `12px`
- **lg**: `16px`
- **xl**: `20px`
- **full**: `9999px`

## Shadows

- **sm**: `0 1px 2px rgba(0, 0, 0, 0.1)`
- **md**: `0 4px 6px rgba(0, 0, 0, 0.15)`
- **lg**: `0 10px 15px rgba(0, 0, 0, 0.2)`
- **xl**: `0 20px 25px rgba(0, 0, 0, 0.25)`

## Components

### Button
- **Variants**: `primary`, `secondary`, `danger`
- **Sizes**: `sm`, `md`, `lg`
- **Props**: `disabled`, `loading`, `fullWidth`

### Card
- Container component with rounded corners and shadow
- **Padding**: `none`, `sm`, `md`, `lg`

### Chip
- Small badge/indicator
- **Variants**: `default`, `success`, `warning`, `error`, `info`

### SegmentedControl
- For selecting between options (e.g., board sizes)
- Takes `options` array with `{value, label}`

### Toast
- Notification component
- **Variants**: `success`, `error`, `warning`, `info`
- Auto-dismisses after duration (default 5s)

## Layout

### Max Widths
- **Content**: `1200px`
- **Narrow**: `800px`

### Responsive Breakpoints
- **Mobile**: `< 768px`
- **Tablet**: `768px - 1024px`
- **Desktop**: `> 1024px`

## Usage

Import the theme CSS in your main CSS file:
```css
@import './styles/theme.css';
```

Use CSS variables in your components:
```css
.my-component {
  background-color: var(--color-bg-card);
  color: var(--color-text-primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
```

## Board UI Fixes

### Coordinate Mapping
- Fixed `pixelToIntersection` to account for `devicePixelRatio`
- Improved tolerance for edge intersections
- Better rounding algorithm for nearest neighbor

### Edge Clipping Prevention
- Padding set to `Math.max(stoneRadius + 8, stoneRadius * 1.5)`
- Container uses `overflow: visible`
- SVG uses `overflow: visible`

### Last Move Highlighting
- Added `lastMove` prop to `GoBoard`
- Highlights last move with golden ring (`#ffd700`)
- Ring radius: `stoneRadius * 1.15`

### Hover Preview
- Desktop: Semi-transparent circle with dashed border
- Mobile: Touch highlight (same as hover)
