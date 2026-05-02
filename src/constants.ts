/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const BUBBLE_RADIUS = 18;
export const ROWS = 12;
export const COLS = 10;
export const COLORS = ["#FF5E5E", "#FFC75F", "#8EE38F", "#5F9FFF", "#A85FFF", "#FF5FB6"];

export interface Bubble {
  x: number;
  y: number;
  color: string;
  id: string;
  isShooting?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Level {
  id: number;
  name: string;
  layout: (number | null)[][]; // index into COLORS or null
}
