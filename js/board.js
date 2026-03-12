/**
 * Ludo Board Renderer
 * Draws the complete Ludo board on an HTML5 Canvas
 * and handles token click detection
 */

const Board = (() => {
  // ── Constants ─────────────────────────────────────────────────────────────
  const BOARD_SIZE = 600;
  const CELL = BOARD_SIZE / 15;  // 15x15 grid
  const H = CELL / 2;

  // Player colors
  const COLORS = {
    red:    '#E53935',
    blue:   '#1E88E5',
    green:  '#43A047',
    yellow: '#FFB300',
  };

  const COLORS_LIGHT = {
    red:    '#FFCDD2',
    blue:   '#BBDEFB',
    green:  '#C8E6C9',
    yellow: '#FFF9C4',
  };

  const SAFE_COLOR = '#90EE90';

  // The 52-square main track as [col, row] positions on the 15x15 grid
  // Starting from Red's first square (col=6, row=13) going clockwise
  const TRACK_CELLS = [
    // Red path going up (col 6, rows 13→7)
    [6,13],[6,12],[6,11],[6,10],[6,9],[6,8],
    // Top-left corner area
    [6,7],[5,6],[4,6],[3,6],[2,6],[1,6],
    // Blue's entry
    [0,6],
    // Blue path going right (row 6, cols 0→6)
    [1,8],[2,8],[3,8],[4,8],[5,8],
    // Top-right corner area
    [6,8],[6,7],
    // WAIT — let me use standard layout
    // I'll recompute this properly below
    [7,6],[8,6],
  ];

  // Proper 52-cell track around the board
  // Red starts at index 0, Blue at 13, Green at 26, Yellow at 39
  const MAIN_TRACK = buildTrack();

  function buildTrack() {
    // 15x15 grid. The path goes:
    // Red start: col=6, row=13 (bottom of left column)
    // Going up the left column (col 6), then right along top, down right column, left along bottom
    const t = [];

    // Red vertical (col 6, rows 13 down to 7 → going up so rows decrease)
    for (let r = 13; r >= 7; r--) t.push([6, r]);   // 0-6  (7 cells, but 0-6 = 7)

    // Wait, standard Ludo has exactly 52 squares. Let me lay them out carefully.
    // The board is 15x15. Colored zones are 6x6. Middle column/row width = 3.
    // Safe squares are at positions where colors change direction.

    const track = [];

    // Bottom-left home zone: cols 0-5, rows 9-14
    // Top-left home zone: cols 0-5, rows 0-5
    // Top-right home zone: cols 9-14, rows 0-5
    // Bottom-right home zone: cols 9-14, rows 9-14
    // Center: cols 6-8, rows 6-8

    // Path: starting at (6,13) — Red's exit from base
    // Going UP along col 6
    for (let r = 13; r >= 7; r--) track.push([6, r]);   // 7 cells: indices 0-6

    // Turn left, go RIGHT along row 6
    for (let c = 5; c >= 0; c--) track.push([c, 6]);     // 6 cells: 7-12

    // Blue's start square at (0,6) — already added, index 12
    // Turn down, go DOWN along col 0 → actually col goes to col 1 area
    // Standard Ludo: after (0,6), path goes (0,8)
    for (let r = 7; r <= 8; r++) track.push([0, r]);     // 2 cells: 13-14... 

    // Actually let me use a well-known coordinate list for a standard 15x15 Ludo board
    return buildStandardTrack();
  }

  function buildStandardTrack() {
    // Using standard Ludo 15x15 grid coordinates (0-indexed from top-left)
    // Each cell is identified by [col, row]
    const track = [
      // RED's start segment (coming out of red base, going up left column)
      [6,14],[6,13],[6,12],[6,11],[6,10],[6,9], // 0-5: up left col
      // Top-left corner
      [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],       // 6-11: going left on row 8
      // Blue's entry row
      [0,7],                                      // 12: Blue start square
      [0,6],                                      // 13: (safe)
      [1,6],[2,6],[3,6],[4,6],[5,6],              // 14-18: going right on row 6
      // Top area
      [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],        // 19-24: going up col 6
      // Green's entry
      [7,0],                                      // 25: (safe)
      [8,0],                                      // 26: Green start square
      [8,1],[8,2],[8,3],[8,4],[8,5],              // 27-31: going down col 8
      // Right side
      [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],   // 32-37: going right row 6
      // Yellow's entry
      [14,7],                                     // 38: (safe)
      [14,8],                                     // 39: Yellow start square
      [13,8],[12,8],[11,8],[10,8],[9,8],           // 40-44: going left row 8
      // Bottom right corner
      [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],   // 45-50: going down col 8
      // Red's entry
      [7,14],                                     // 51: (safe, Red home entry)
    ];
    return track;
  }

  // Home column cells for each color (leading to center)
  const HOME_COLUMNS = {
    red:    [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],   // going up col 7
    blue:   [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],       // going right row 7
    green:  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],       // going down col 7
    yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],   // going left row 7
  };

  // Base positions (token start positions in the colored home areas)
  const BASE_POSITIONS = {
    red:    [[1,10],[3,10],[1,12],[3,12]],
    blue:   [[1,1],[3,1],[1,3],[3,3]],
    green:  [[10,1],[12,1],[10,3],[12,3]],
    yellow: [[10,10],[12,10],[10,12],[12,12]],
  };

  // Safe squares indices on the main track
  const SAFE_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

  // ── State ──────────────────────────────────────────────────────────────────
  let canvas, ctx;
  let gameState = null;
  let myColor = null;
  let validMoves = [];
  let onTokenClick = null;
  let animating = false;

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(canvasEl, clickCallback) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onTokenClick = clickCallback;

    canvas.addEventListener('click', handleClick);

    // Initial empty board
    drawBoard(null);
  }

  // ── Main draw ──────────────────────────────────────────────────────────────
  function draw(state, myCol, validMoveIds) {
    gameState = state;
    myColor = myCol;
    validMoves = validMoveIds || [];
    drawBoard(state);
  }

  function drawBoard(state) {
    const W = canvas.width;
    const H_full = canvas.height;
    ctx.clearRect(0, 0, W, H_full);

    drawBackground();
    drawGrid();
    drawColorZones();
    drawHomePaths();
    drawSafeMarkers();
    drawCenterHome();
    drawArrows();

    if (state) {
      drawAllTokens(state);
    }
  }

  function drawBackground() {
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 15; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, BOARD_SIZE);
      ctx.moveTo(0, i * CELL); ctx.lineTo(BOARD_SIZE, i * CELL);
      ctx.stroke();
    }
  }

  function fillCell(col, row, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(col * CELL + 0.5, row * CELL + 0.5, CELL - 1, CELL - 1);
    ctx.globalAlpha = 1;
  }

  function strokeCell(col, row, color, lw = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.strokeRect(col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2);
  }

  function drawColorZones() {
    // Red zone (bottom-left): cols 0-5, rows 9-14
    fillCell(0, 9, COLORS.red, 0.9);
    for (let c = 0; c < 6; c++)
      for (let r = 9; r < 15; r++)
        fillCell(c, r, COLORS.red);

    // Blue zone (top-left): cols 0-5, rows 0-5
    for (let c = 0; c < 6; c++)
      for (let r = 0; r < 6; r++)
        fillCell(c, r, COLORS.blue);

    // Green zone (top-right): cols 9-14, rows 0-5
    for (let c = 9; c < 15; c++)
      for (let r = 0; r < 6; r++)
        fillCell(c, r, COLORS.green);

    // Yellow zone (bottom-right): cols 9-14, rows 9-14
    for (let c = 9; c < 15; c++)
      for (let r = 9; r < 15; r++)
        fillCell(c, r, COLORS.yellow);

    // White inner areas (the actual base circles)
    const zones = [
      { c: 0, r: 9, color: COLORS.red },
      { c: 0, r: 0, color: COLORS.blue },
      { c: 9, r: 0, color: COLORS.green },
      { c: 9, r: 9, color: COLORS.yellow },
    ];

    zones.forEach(({ c, r, color }) => {
      // Inner white circle area
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const x = (c + 0.5) * CELL + CELL;
      const y = (r + 0.5) * CELL + CELL;
      ctx.beginPath();
      ctx.arc(x, y, CELL * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Draw base token circles
    Object.keys(BASE_POSITIONS).forEach(color => {
      BASE_POSITIONS[color].forEach(([bc, br]) => {
        const x = (bc + 0.5) * CELL;
        const y = (br + 0.5) * CELL;
        ctx.beginPath();
        ctx.arc(x, y, CELL * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });
  }

  function drawHomePaths() {
    // Red home column (col 7, rows 13→8): red gradient
    for (let r = 8; r <= 13; r++) fillCell(7, r, '#FFCDD2');

    // Blue home column (row 7, cols 1→6): blue
    for (let c = 1; c <= 6; c++) fillCell(c, 7, '#BBDEFB');

    // Green home column (col 7, rows 1→6): green
    for (let r = 1; r <= 6; r++) fillCell(7, r, '#C8E6C9');

    // Yellow home column (row 7, cols 8→13): yellow
    for (let c = 8; c <= 13; c++) fillCell(c, 7, '#FFF9C4');

    // Main track cells — white background
    MAIN_TRACK.forEach(([c, r]) => {
      fillCell(c, r, '#ffffff');
      strokeCell(c, r, 'rgba(0,0,0,0.1)');
    });

    // Safe squares
    SAFE_INDICES.forEach(i => {
      if (i < MAIN_TRACK.length) {
        const [c, r] = MAIN_TRACK[i];
        fillCell(c, r, SAFE_COLOR);
      }
    });
  }

  function drawSafeMarkers() {
    // Star on safe squares
    SAFE_INDICES.forEach(i => {
      if (i < MAIN_TRACK.length) {
        const [c, r] = MAIN_TRACK[i];
        drawStar(ctx, (c + 0.5) * CELL, (r + 0.5) * CELL, 5, CELL * 0.32, CELL * 0.14, '#2e7d32');
      }
    });
  }

  function drawStar(ctx, cx, cy, points, outer, inner, color) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawCenterHome() {
    // Center 3x3 triangle area (cols 6-8, rows 6-8)
    // Draw 4 triangles meeting in center
    const cx = 7.5 * CELL;
    const cy = 7.5 * CELL;
    const s = 3 * CELL;
    const h2 = s / 2;

    const triangles = [
      { points: [[6*CELL,6*CELL],[9*CELL,6*CELL],[cx,cy]], color: COLORS.blue },
      { points: [[6*CELL,9*CELL],[9*CELL,9*CELL],[cx,cy]], color: COLORS.yellow },
      { points: [[6*CELL,6*CELL],[6*CELL,9*CELL],[cx,cy]], color: COLORS.red },
      { points: [[9*CELL,6*CELL],[9*CELL,9*CELL],[cx,cy]], color: COLORS.green },
    ];

    triangles.forEach(({ points, color }) => {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      ctx.lineTo(points[1][0], points[1][1]);
      ctx.lineTo(points[2][0], points[2][1]);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Center house icon
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold ${CELL * 0.7}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠', cx, cy);
  }

  function drawArrows() {
    // Small arrows showing direction on the colored start squares
    const arrows = [
      { pos: MAIN_TRACK[0], dir: 'up', color: COLORS.red },
      { pos: MAIN_TRACK[13], dir: 'right', color: COLORS.blue },
      { pos: MAIN_TRACK[26], dir: 'down', color: COLORS.green },
      { pos: MAIN_TRACK[39], dir: 'left', color: COLORS.yellow },
    ];

    // Color the start squares
    const startColors = {
      0: COLORS_LIGHT.red,
      13: COLORS_LIGHT.blue,
      26: COLORS_LIGHT.green,
      39: COLORS_LIGHT.yellow,
    };

    [0, 13, 26, 39].forEach(i => {
      const [c, r] = MAIN_TRACK[i];
      fillCell(c, r, startColors[i]);
    });
  }

  function drawAllTokens(state) {
    if (!state || !state.tokens) return;

    Object.keys(state.tokens).forEach(color => {
      state.tokens[color].forEach((token, idx) => {
        drawToken(token, color, idx, state);
      });
    });

    // Highlight valid moves with pulse ring
    if (myColor && state.tokens[myColor] && validMoves.length > 0) {
      state.tokens[myColor].forEach(token => {
        if (validMoves.includes(token.id)) {
          const pos = getTokenScreenPos(token, myColor, state.tokens[myColor]);
          if (pos) {
            drawValidHighlight(pos.x, pos.y);
          }
        }
      });
    }
  }

  function getTokenScreenPos(token, color, allTokens) {
    if (token.state === 'base') {
      // Count how many base tokens of same color share the base spot
      const baseIndex = token.id;
      const [bc, br] = BASE_POSITIONS[color][baseIndex];
      return { x: (bc + 0.5) * CELL, y: (br + 0.5) * CELL };
    }

    if (token.state === 'home') {
      // At center
      return { x: 7.5 * CELL, y: 7.5 * CELL };
    }

    if (token.homePos >= 0) {
      // In home column
      const homeCol = HOME_COLUMNS[color];
      if (homeCol && homeCol[token.homePos]) {
        const [c, r] = homeCol[token.homePos];
        return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
      }
    }

    if (token.trackPos >= 0 && token.trackPos < MAIN_TRACK.length) {
      const [c, r] = MAIN_TRACK[token.trackPos];
      return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
    }

    return null;
  }

  function drawToken(token, color, idx, state) {
    const pos = getTokenScreenPos(token, color, state.tokens[color]);
    if (!pos) return;

    const radius = CELL * 0.35;
    const x = pos.x;
    const y = pos.y;

    // Handle stacking — offset tokens that share the same cell
    let offsetX = 0, offsetY = 0;
    if (token.state !== 'base' && token.state !== 'home') {
      const sameCell = state.tokens[color].filter(t =>
        t.id !== token.id && t.state === token.state &&
        t.trackPos === token.trackPos && t.homePos === token.homePos
      );
      if (sameCell.length > 0) {
        const stackIdx = sameCell.findIndex(t => t.id > token.id) + 1;
        offsetX = stackIdx * CELL * 0.15;
        offsetY = stackIdx * CELL * 0.15;
      }
    }

    const fx = x + offsetX;
    const fy = y + offsetY;

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    // Token body
    ctx.beginPath();
    ctx.arc(fx, fy, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[color];
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Inner circle (lighter)
    ctx.beginPath();
    ctx.arc(fx, fy, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();

    // Token number
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = `bold ${radius * 0.8}px 'Nunito', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(token.id + 1, fx, fy);
  }

  function drawValidHighlight(x, y) {
    const now = Date.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);
    ctx.beginPath();
    ctx.arc(x, y, CELL * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Animate
    requestAnimationFrame(() => drawBoard(gameState));
  }

  // ── Click handling ─────────────────────────────────────────────────────────
  function handleClick(e) {
    if (!gameState || !myColor || validMoves.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Check if clicked on a valid token
    const myTokens = gameState.tokens[myColor];
    if (!myTokens) return;

    for (const token of myTokens) {
      if (!validMoves.includes(token.id)) continue;

      const pos = getTokenScreenPos(token, myColor, myTokens);
      if (!pos) continue;

      const dist = Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2);
      if (dist <= CELL * 0.45) {
        if (onTokenClick) onTokenClick(token.id);
        return;
      }
    }
  }

  // Public API
  return { init, draw, drawBoard };
})();
