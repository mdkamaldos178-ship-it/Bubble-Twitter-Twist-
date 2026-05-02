/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Level, ROWS, COLS } from "./constants";

export const generateLevel = (id: number): Level => {
  const layout: (number | null)[][] = Array.from({ length: 6 }, (_, r) => {
    const isEven = r % 2 === 0;
    const cols = isEven ? COLS : COLS - 1;
    
    // Choose a pattern type based on level ID
    const patternType = id % 4;
    
    return Array.from({ length: cols }, (_, c) => {
      // Logic for different level archetypes
      if (patternType === 0) { // Alternating stripes
        return (r + c) % (2 + (id % 3)) === 0 ? null : (r + id) % 6;
      } else if (patternType === 1) { // Checkerboard
        return (r + c) % 2 === 0 ? (c % 6) : null;
      } else if (patternType === 2) { // V-Shape / Triangle
        const mid = cols / 2;
        return Math.abs(c - mid) < (r + 1) ? (r % 6) : null;
      } else { // Dense blocks
        return Math.random() > 0.3 ? (Math.floor(Math.random() * 6)) : null;
      }
    });
  });

  return {
    id,
    name: `Level ${id}`,
    layout,
  };
};

// Accessor for the first 1200 levels
export const LEVELS_COUNT = 1200;
