/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Level, ROWS, COLS, COLORS } from "./constants";

export const generateLevel = (id: number): Level => {
  const complexity = Math.min(10, 4 + Math.floor(id / 5));
  const patternType = id % 4;

  const layout: (number | null)[][] = Array.from({ length: complexity }, (_, r) => {
    const isEven = r % 2 === 0;
    const cols = isEven ? COLS : COLS - 1;
    
    return Array.from({ length: cols }, (_, c) => {
      if (patternType === 0) { // Alternating stripes
        return (r + c) % (2 + (id % 3)) === 0 ? null : (r + id) % COLORS.length;
      } else if (patternType === 1) { // Checkerboard
        return (r + c) % 2 === 0 ? (c % COLORS.length) : null;
      } else if (patternType === 2) { // V-Shape / Triangle
        const mid = cols / 2;
        return Math.abs(c - mid) < (r + 1) ? (r % COLORS.length) : null;
      } else { // Dense blocks
        return Math.random() > 0.3 ? (Math.floor(Math.random() * COLORS.length)) : null;
      }
    });
  });

  return {
    id,
    name: `Level ${id + 1}`,
    layout,
  };
};

export const LEVELS_COUNT = 54;
