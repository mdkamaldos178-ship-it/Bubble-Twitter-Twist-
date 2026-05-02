/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Home, ChevronRight, Settings, Volume2 } from 'lucide-react';
import { BUBBLE_RADIUS, COLORS, COLS, ROWS, Point, PowerUpType, LEVELS_COUNT } from './constants';
import { generateLevel } from './levels';
import { audioService } from './services/audioService';

// --- Types ---
interface BubbleData {
  color: string;
  row: number;
  col: number;
  powerUp?: PowerUpType;
}

// --- Utilities ---
const getBubbleCoords = (row: number, col: number, canvasWidth: number) => {
  const horizontalSpacing = BUBBLE_RADIUS * 2;
  const verticalSpacing = BUBBLE_RADIUS * Math.sqrt(3);
  const offset = row % 2 !== 0 ? BUBBLE_RADIUS : 0;
  
  // Center the grid
  const gridWidth = (COLS * horizontalSpacing);
  const startX = (canvasWidth - gridWidth) / 2 + BUBBLE_RADIUS;
  
  return {
    x: startX + col * horizontalSpacing + offset,
    y: BUBBLE_RADIUS + 10 + row * verticalSpacing
  };
};

const getRowColFromCoords = (x: number, y: number, canvasWidth: number) => {
  const verticalSpacing = BUBBLE_RADIUS * Math.sqrt(3);
  const row = Math.round((y - BUBBLE_RADIUS - 10) / verticalSpacing);
  const offset = row % 2 !== 0 ? BUBBLE_RADIUS : 0;
  const horizontalSpacing = BUBBLE_RADIUS * 2;
  const gridWidth = (COLS * horizontalSpacing);
  const startX = (canvasWidth - gridWidth) / 2 + BUBBLE_RADIUS;
  const col = Math.round((x - startX - offset) / horizontalSpacing);
  return { row, col };
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  type?: 'pop' | 'hit' | 'orphan';
}

// --- Game Component ---
export default function BubbleShooter() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'level-select' | 'win' | 'lose' | 'settings'>('menu');
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [settings, setSettings] = useState({ sound: true, vibration: true });
  const [unlockedLevel, setUnlockedLevel] = useState(1);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<(BubbleData | null)[][]>([]);
  const [nextBubbleColor, setNextBubbleColor] = useState(COLORS[0]);
  const [shooterBubble, setShooterBubble] = useState<{ x: number, y: number, color: string, vx: number, vy: number, powerUp?: PowerUpType } | null>(null);
  const [isShooting, setIsShooting] = useState(false);
  const [touchPos, setTouchPos] = useState<Point | null>(null);
  const shakeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  
  const animationFrameRef = useRef<number>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const saved = localStorage.getItem('bubble_blast_level');
    if (saved) setUnlockedLevel(parseInt(saved));
    
    if (settings.sound) audioService.startBGM();
  }, [settings.sound]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const initLevel = useCallback((levelIdx: number) => {
    const level = generateLevel(levelIdx);
    const newGrid: (BubbleData | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    
    level.layout.forEach((row, rIdx) => {
      row.forEach((colorIdx, cIdx) => {
        if (colorIdx !== null) {
          const powerUps: PowerUpType[] = ['bomb', 'lightning'];
          const powerUp = Math.random() > (0.95 - (levelIdx / 100)) ? powerUps[Math.floor(Math.random() * powerUps.length)] : undefined;
          newGrid[rIdx][cIdx] = {
            color: COLORS[colorIdx],
            row: rIdx,
            col: cIdx,
            powerUp
          };
        }
      });
    });
    
    setGrid(newGrid);
    setScore(0);
    setGameState('playing');
    setNextBubbleColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    setIsShooting(false);
    setShooterBubble(null);
  }, []);

  const handleShoot = useCallback(() => {
    if (isShooting || !touchPos || gameState !== 'playing') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = canvas.width / 2;
    const startY = canvas.height - 60;
    
    const dx = touchPos.x - startX;
    const dy = touchPos.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 10) return;

    const speed = 14;
    const powerUps: PowerUpType[] = ['bomb', 'rainbow', 'lightning'];
    const pUp = Math.random() > 0.96 ? powerUps[Math.floor(Math.random() * powerUps.length)] : undefined;
    
    setShooterBubble({
      x: startX,
      y: startY,
      color: pUp === 'rainbow' ? '#FFFFFF' : nextBubbleColor,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      powerUp: pUp
    });
    if (settings.sound) audioService.playShoot();
    setIsShooting(true);
    setNextBubbleColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }, [isShooting, touchPos, nextBubbleColor, gameState, settings.sound]);

  // Game Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const update = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Drawing state
      ctx.save();
      if (shakeRef.current > 0) {
        ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.1) shakeRef.current = 0;
      }

      // Draw Grid
      grid.forEach((row, rIdx) => {
        row.forEach((bubble, cIdx) => {
          if (bubble) {
            const { x, y } = getBubbleCoords(rIdx, cIdx, canvas.width);
            drawBubble(ctx, x, y, bubble.color, bubble.powerUp);
          }
        });
      });

      // Update & Draw Particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2; // gravity
          p.life -= 0.02;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0, 3 * p.life), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.fill();
          ctx.globalAlpha = 1;
      });

      // Draw Aim Line (Reflected)
      if (!isShooting && touchPos) {
          const startX = canvas.width / 2;
          const startY = canvas.height - 60;
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
          
          let curX = startX;
          let curY = startY;
          const dx = touchPos.x - startX;
          const dy = touchPos.y - startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let vx = (dx / dist) * 10;
          let vy = (dy / dist) * 10;
          
          ctx.moveTo(curX, curY);

          for (let i = 0; i < 300; i++) {
            curX += vx;
            curY += vy;
            
            if (curX < BUBBLE_RADIUS || curX > canvas.width - BUBBLE_RADIUS) {
              vx *= -1;
              ctx.lineTo(curX, curY);
            }
            
            // Check collision with bubbles for guide end
            let hit = false;
            for (let r = 0; r < ROWS; r++) {
              for (let c = 0; c < COLS; c++) {
                if (grid[r][c]) {
                  const { x, y } = getBubbleCoords(r, c, canvas.width);
                  if ((curX - x)**2 + (curY - y)**2 < (BUBBLE_RADIUS * 2)**2) {
                    hit = true;
                    break;
                  }
                }
              }
              if (hit) break;
            }
            if (hit || curY < BUBBLE_RADIUS) break;
          }
          ctx.lineTo(curX, curY);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Draw dot at end
          ctx.beginPath();
          ctx.arc(curX, curY, 4, 0, Math.PI * 2);
          ctx.fillStyle = nextBubbleColor;
          ctx.fill();
      }

      // Draw Next Bubble & Shooter
      const shooterX = canvas.width / 2;
      const shooterY = canvas.height - 60;
      if (!isShooting) {
          drawBubble(ctx, shooterX, shooterY, nextBubbleColor);
      }

      // Update & Draw Shooting Bubble
      if (shooterBubble) {
        shooterBubble.x += shooterBubble.vx;
        shooterBubble.y += shooterBubble.vy;

        if (shooterBubble.x < BUBBLE_RADIUS || shooterBubble.x > canvas.width - BUBBLE_RADIUS) {
          shooterBubble.vx *= -1;
        }

        drawBubble(ctx, shooterBubble.x, shooterBubble.y, shooterBubble.color, shooterBubble.powerUp);

        // Check Collisions
        let hit = false;
        
        // Ceiling collision
        if (shooterBubble.y <= BUBBLE_RADIUS) {
            hit = true;
        } else {
            // Check grid collision
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const bubble = grid[r][c];
                    if (bubble) {
                        const { x, y } = getBubbleCoords(r, c, canvas.width);
                        const distSq = (shooterBubble.x - x) ** 2 + (shooterBubble.y - y) ** 2;
                        if (distSq < (BUBBLE_RADIUS * 2) ** 2) {
                            hit = true;
                            break;
                        }
                    }
                }
                if (hit) break;
            }
        }

        if (hit) {
            handleHit(shooterBubble);
            setShooterBubble(null);
            setIsShooting(false);
        }

        // Out of bounds (fail safe)
        if (shooterBubble.y > canvas.height) {
            setShooterBubble(null);
            setIsShooting(false);
        }
      }
      
      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameRef.current!);
  }, [grid, shooterBubble, isShooting, touchPos, nextBubbleColor, gameState]);

  const handleHit = (sb: { x: number, y: number, color: string, powerUp?: PowerUpType }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const newGrid = [...grid.map(r => [...r])];
    let { row, col } = getRowColFromCoords(sb.x, sb.y, canvas.width);
    
    if (row < 0) row = 0;
    if (row >= ROWS) {
        setGameState('lose');
        return;
    }
    const maxCols = row % 2 !== 0 ? COLS - 1 : COLS;
    if (col < 0) col = 0;
    if (col >= maxCols) col = maxCols - 1;

    // Logic for Power-ups
    if (sb.powerUp === 'rainbow') {
        // Find nearest neighbor to match color
        const nbs = getNeighbors(row, col);
        const target = nbs.find(n => newGrid[n.row]?.[n.col]);
        if (target) sb.color = newGrid[target.row][target.col]!.color;
    }

    if (sb.powerUp === 'bomb') {
      audioService.playExplosion();
      shakeRef.current = 20;
      const affected = getNeighbors(row, col);
      affected.push({row, col});
      affected.forEach(p => {
        if (newGrid[p.row]?.[p.col]) {
          createParticles(p.row, p.col, newGrid[p.row][p.col]?.color || '#FFFFFF', 'pop');
          newGrid[p.row][p.col] = null;
        }
      });
      setScore(s => s + 500);
    } else if (sb.powerUp === 'lightning') {
        audioService.playExplosion();
        shakeRef.current = 10;
        for (let c = 0; c < COLS; c++) {
            if (newGrid[row][c]) {
                createParticles(row, c, newGrid[row][c]?.color || '#FFFFFF', 'pop');
                newGrid[row][c] = null;
            }
        }
        setScore(s => s + 300);
    } else {
        // Standard placement
        if (newGrid[row][col]) {
            const neighbors = getNeighbors(row, col);
            const empty = neighbors.find(n => !newGrid[n.row][n.col]);
            if (empty) { row = empty.row; col = empty.col; }
            else { setGameState('lose'); return; }
        }
        newGrid[row][col] = { color: sb.color, row, col, powerUp: sb.powerUp };
        
        const cluster = findCluster(newGrid, row, col, sb.color);
        if (cluster.length >= 3) {
            if (settings.sound) audioService.playPop();
            if (cluster.length > 5) shakeRef.current = cluster.length * 2;
            cluster.forEach(p => {
                createParticles(p.row, p.col, newGrid[p.row][p.col]?.color || COLORS[0], 'pop');
                newGrid[p.row][p.col] = null;
            });
            if (settings.vibration && 'vibrate' in navigator) navigator.vibrate(50);
            setScore(s => s + cluster.length * 10);
            
            const orphans = findOrphans(newGrid);
            orphans.forEach(p => {
                createParticles(p.row, p.col, newGrid[p.row][p.col]?.color || COLORS[0], 'orphan');
                newGrid[p.row][p.col] = null;
            });
            setScore(s => s + orphans.length * 20);
        } else {
            createParticles(row, col, sb.color, 'hit');
        }
    }

    setGrid(newGrid);
    
    // Win/Lose check
    const remaining = newGrid.flat().filter(b => b !== null).length;
    if (remaining === 0) {
        if (settings.sound) audioService.playWin();
        setGameState('win');
    } else if (row >= ROWS - 2) {
        if (settings.sound) audioService.playLose();
        setGameState('lose');
    }
  };

  const findCluster = (g: (BubbleData | null)[][], row: number, col: number, color: string) => {
    const cluster: { row: number, col: number }[] = [];
    const queue: { row: number, col: number }[] = [{ row, col }];
    const visited = new Set<string>();
    visited.add(`${row},${col}`);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      cluster.push(curr);

      const neighbors = getNeighbors(curr.row, curr.col);
      neighbors.forEach(n => {
        const nb = g[n.row]?.[n.col];
        if (nb && nb.color === color && !visited.has(`${n.row},${n.col}`)) {
          visited.add(`${n.row},${n.col}`);
          queue.push(n);
        }
      });
    }
    return cluster;
  };

  const findOrphans = (g: (BubbleData | null)[][]) => {
    const connectedToRoot = new Set<string>();
    const queue: { row: number, col: number }[] = [];

    // All bubbles in first row are connected
    for (let c = 0; c < COLS; c++) {
      if (g[0][c]) {
        queue.push({ row: 0, col: c });
        connectedToRoot.add(`0,${c}`);
      }
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = getNeighbors(curr.row, curr.col);
      neighbors.forEach(n => {
        if (g[n.row]?.[n.col] && !connectedToRoot.has(`${n.row},${n.col}`)) {
          connectedToRoot.add(`${n.row},${n.col}`);
          queue.push(n);
        }
      });
    }

    const orphans: { row: number, col: number }[] = [];
    g.forEach((row, r) => {
      row.forEach((b, c) => {
        if (b && !connectedToRoot.has(`${r},${c}`)) {
          orphans.push({ row: r, col: c });
        }
      });
    });
    return orphans;
  };

  const createParticles = (row: number, col: number, color: string, type: 'pop' | 'hit' | 'orphan') => {
    const { x, y } = getBubbleCoords(row, col, dimensions.width);
    const count = type === 'pop' ? 12 : type === 'hit' ? 4 : 6;
    for (let i = 0; i < count; i++) {
        particlesRef.current.push({
            x,
            y,
            vx: (Math.random() - 0.5) * (type === 'pop' ? 12 : 5),
            vy: (Math.random() - 0.5) * (type === 'pop' ? 12 : 5),
            life: 1,
            color: type === 'hit' ? '#FFFFFF' : color,
            type
        });
    }
  };

  const getNeighbors = (r: number, c: number) => {
    const neighbors: { row: number, col: number }[] = [];
    const isEven = r % 2 === 0;

    const dirs = isEven 
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];

    dirs.forEach(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        neighbors.push({ row: nr, col: nc });
      }
    });
    return neighbors;
  };

  const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, powerUp?: PowerUpType) => {
    ctx.beginPath();
    ctx.arc(x, y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (powerUp) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px sans-serif';
      const icon = powerUp === 'bomb' ? '💣' : powerUp === 'fire' ? '🔥' : powerUp === 'lightning' ? '⚡' : '🌈';
      ctx.fillText(icon, x, y);
    }

    // Shine
    ctx.beginPath();
    ctx.arc(x - BUBBLE_RADIUS / 2.5, y - BUBBLE_RADIUS / 2.5, BUBBLE_RADIUS / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    
    // Stroke
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // --- Touch End ---
  const handlePointerUp = (e: React.PointerEvent) => {
      handleShoot();
      setTouchPos(null);
  };

  // --- Screens ---

  const SettingsScreen = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white p-8">
      <div className="flex items-center gap-4 mb-12">
        <button onClick={() => setGameState('menu')} className="p-3 bg-slate-800 rounded-2xl">
           <Home size={24} />
        </button>
        <h2 className="text-3xl font-black italic tracking-tight">SETTINGS</h2>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Sound Effects</h3>
            <p className="text-sm text-slate-400">Pops, shoots, and musical jingles</p>
          </div>
          <button 
            onClick={() => setSettings(s => ({ ...s, sound: !s.sound }))}
            className={`w-14 h-8 rounded-full transition-colors relative ${settings.sound ? 'bg-blue-500' : 'bg-slate-600'}`}
          >
            <motion.div 
              animate={{ x: settings.sound ? 24 : 4 }}
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md" 
            />
          </button>
        </div>

        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Vibration</h3>
            <p className="text-sm text-slate-400">Haptic feedback on matches</p>
          </div>
          <button 
            onClick={() => setSettings(s => ({ ...s, vibration: !s.vibration }))}
            className={`w-14 h-8 rounded-full transition-colors relative ${settings.vibration ? 'bg-blue-500' : 'bg-slate-600'}`}
          >
            <motion.div 
              animate={{ x: settings.vibration ? 24 : 4 }}
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md" 
            />
          </button>
        </div>
      </div>

      <div className="mt-auto bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl">
         <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
           <Volume2 size={18} /> PRO TIP
         </h4>
         <p className="text-sm text-slate-300 leading-relaxed">
           Toggle vibration off to save battery during long sessions. Sound effects help you time your shots perfectly!
         </p>
      </div>
    </div>
  );

  const PublishModal = () => (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] text-center w-full max-w-sm space-y-6">
        <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto border border-purple-500/30">
           <Trophy className="text-purple-400" size={40} />
        </div>
        <h2 className="text-2xl font-black italic">PUBLISH TO STORE</h2>
        <p className="text-slate-400 text-sm">
          To publish this game to the **Google Play Store**, go to the **Settings** menu in the top-right of your AI Studio environment and select **"Export to GitHub"**. Then use Capacitor to build the Android app!
        </p>
        <button 
          onClick={() => setGameState('menu')}
          className="w-full bg-slate-800 font-bold py-4 rounded-2xl border border-slate-700"
        >
          GOT IT
        </button>
      </div>
    </motion.div>
  );

  const MenuScreen = () => (
    <div className="relative flex flex-col items-center justify-center h-full text-white bg-slate-950 overflow-hidden p-8">
      {/* Decorative Bubbles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full opacity-20 blur-xl"
          animate={{
            y: [-20, 20, -20],
            x: [-10, 10, -10],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 5 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            width: 100 + i * 50,
            height: 100 + i * 50,
            backgroundColor: COLORS[i % COLORS.length],
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}

      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center z-10"
      >
        <div className="mb-6 relative inline-block">
          <h1 className="text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-blue-400 via-purple-400 to-pink-500 italic">
             BUBBLE
          </h1>
          <h1 className="text-7xl font-black mb-2 tracking-tighter text-white/90 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">
             BLAST
          </h1>
        </div>
        <p className="text-slate-400 font-mono tracking-[0.3em] text-xs">MOBILE EDITION</p>
      </motion.div>

      <div className="flex flex-col space-y-4 w-full max-w-xs mt-12 z-10">
        <button 
          onClick={() => setGameState('level-select')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
        >
          <Play fill="white" size={24} /> START GAME
        </button>
        
        <div className="grid grid-cols-2 gap-4">
          <button 
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 border border-slate-700 active:scale-95 transition-transform"
            onClick={() => {
              // Custom logic to show export info
              alert("EXPORT INSTRUCTIONS:\n1. Click 'Settings' in AI Studio (Top-Right)\n2. Choose 'Export to GitHub' or 'Download ZIP'\n3. You now have the source code to publish!");
            }}
          >
            <ChevronRight className="rotate-90" size={24} /> EXPORT
          </button>
          <button 
            onClick={() => setGameState('settings')}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 border border-slate-700 active:scale-95 transition-transform"
          >
            <Settings size={24} /> SETTINGS
          </button>
        </div>

        <button 
          onClick={() => setGameState('win')} // Use win state or a modal to show publish info
          className="bg-gradient-to-r from-purple-600 to-pink-600 font-bold py-4 rounded-2xl shadow-lg shadow-purple-500/20 active:scale-95 transition-transform"
        >
           PUBLISH GAME
        </button>
      </div>
    </div>
  );

  const LevelSelectScreen = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-6 flex items-center gap-4">
        <button onClick={() => setGameState('menu')} className="p-2 bg-slate-800 rounded-full">
           <Home size={20} />
        </button>
        <h2 className="text-2xl font-bold">Levels</h2>
      </div>
      
      <div className="grid grid-cols-4 gap-3 p-6 overflow-y-auto">
        {Array.from({ length: LEVELS_COUNT }).map((_, idx) => {
          const isLocked = (idx + 1) > unlockedLevel;
          return (
            <button 
              key={idx}
              disabled={isLocked}
              onClick={() => {
                  setCurrentLevelIndex(idx);
                  initLevel(idx);
              }}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all group ${
                isLocked 
                ? 'bg-slate-900 border-slate-800 opacity-40' 
                : 'bg-slate-800 border-slate-700 hover:bg-blue-600 hover:border-blue-400'
              }`}
            >
              <span className="text-xl font-black">{idx + 1}</span>
              {isLocked ? <div className="text-[10px] grayscale opacity-50">🔒</div> : <span className="text-[8px] uppercase opacity-50 group-hover:opacity-100">Battle</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  const GameScreen = () => (
    <div 
      className="relative w-full h-full bg-slate-950 overflow-hidden touch-none"
      onPointerMove={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
              setTouchPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }
      }}
      onPointerDown={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
              setTouchPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }
      }}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setTouchPos(null)}
    >
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         {[...Array(3)].map((_, i) => (
           <motion.div
             key={i}
             className="absolute w-64 h-64 rounded-full filter blur-[120px]"
             animate={{
               x: ['-20%', '120%', '-20%'],
               y: ['120%', '-20%', '120%'],
             }}
             transition={{
               duration: 20 + i * 5,
               repeat: Infinity,
               ease: "linear"
             }}
             style={{
               background: i === 0 ? 'rgba(59, 130, 246, 0.15)' : i === 1 ? 'rgba(168, 85, 247, 0.15)' : 'rgba(236, 72, 153, 0.15)',
               left: `${i * 30}%`,
               top: `${i * 20}%`
             }}
           />
         ))}
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-800 flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
           <span className="font-mono text-sm">LVL {currentLevelIndex + 1}</span>
        </div>
        <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-800">
           <span className="font-mono text-sm">SCORE: {score}</span>
        </div>
        <button 
          onClick={() => setGameState('menu')}
          className="p-2 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-800 pointer-events-auto"
        >
          <Home size={18} />
        </button>
      </div>

      <canvas 
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />

      {/* Footer / Controls Hint */}
      <div className="absolute bottom-10 left-0 w-full flex flex-col items-center opacity-30 pointer-events-none">
         <p className="text-[10px] tracking-[0.2em] font-bold uppercase">Drag to aim • Release to shoot</p>
      </div>
    </div>
  );

  const ResultScreen = ({ type }: { type: 'win' | 'lose' }) => {
    useEffect(() => {
        if (type === 'win') {
            const next = currentLevelIndex + 2;
            if (next > unlockedLevel) {
                setUnlockedLevel(next);
                localStorage.setItem('bubble_blast_level', next.toString());
            }
        }
    }, [type]);

    return (
      <div className="flex flex-col items-center justify-center h-full text-white bg-slate-900/95 backdrop-blur-xl p-8 absolute inset-0 z-20">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className={type === 'win' ? "text-yellow-400" : "text-red-400"}>
             {type === 'win' ? <Trophy size={80} className="mx-auto" /> : <RotateCcw size={80} className="mx-auto" />}
          </div>
          <h2 className="text-5xl font-black uppercase tracking-tighter">
            {type === 'win' ? "Level Clear!" : "Game Over"}
          </h2>
          <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
             <p className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-1">Final Score</p>
             <p className="text-4xl font-mono">{score}</p>
          </div>
        </motion.div>

        <div className="mt-12 flex flex-col space-y-3 w-full max-w-xs">
          {type === 'win' && (
             <button 
               onClick={() => {
                   const next = (currentLevelIndex + 1) % LEVELS_COUNT;
                   setCurrentLevelIndex(next);
                   initLevel(next);
               }}
               className="bg-blue-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
             >
               NEXT LEVEL <ChevronRight size={20} />
             </button>
          )}
          <button 
             onClick={() => initLevel(currentLevelIndex)}
             className="bg-slate-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 border border-slate-700"
          >
            <RotateCcw size={20} /> REPLAY
          </button>
          <button 
             onClick={() => setGameState('menu')}
             className="text-slate-400 font-bold py-4"
          >
            BACK TO MENU
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black font-sans select-none touch-none overflow-hidden">
      <AnimatePresence mode="wait">
        {gameState === 'menu' && <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full"><MenuScreen /></motion.div>}
        {gameState === 'level-select' && <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full"><LevelSelectScreen /></motion.div>}
        {gameState === 'playing' && <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full"><GameScreen /></motion.div>}
        {gameState === 'settings' && <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full"><SettingsScreen /></motion.div>}
      </AnimatePresence>

      {(gameState === 'win' || gameState === 'lose') && <ResultScreen type={gameState} />}
      {gameState === 'win' && <PublishModal />}
    </div>
  );
}
