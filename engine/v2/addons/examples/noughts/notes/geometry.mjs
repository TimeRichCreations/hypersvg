// Shared numbers for the noughts drawings and for Bolt's arm. Plain data and plain maths: no dependencies.
// The stage is one fixed picture (Bolt, the paper, the arm) in its own 600 by 640 space. Each frame places the stage
// with one static transform, so the arm's angles are the same in every frame.

export const STAGE = { w: 600, h: 640 };

// The paper and the grid.
export const SHEET = { x: 150, y: 336, w: 300, h: 292 };
export const CELL = 86;
export const K = CELL / 108; // the marks were drawn for a 108 cell
export const GRID = { x: 171, y: 356 }; // top left of the 3 by 3 grid
export const CX = [0, 1, 2].map(c => GRID.x + CELL / 2 + c * CELL);
export const CY = [0, 1, 2].map(r => GRID.y + CELL / 2 + r * CELL);
export const cellCentre = (i) => [CX[i % 3], CY[Math.floor(i / 3)]];

// Bolt.
export const HEAD = { x: 300, y: 96, w: 150, h: 116 };
export const SHOULDER = [216, 214]; // the arm's turning point (viewer's left)
export const TIP0 = 60; // with the hand not slid out, the pen tip is this far from the shoulder along the arm
export const WRIST0 = 24; // and the wrist is this far
export const PEN = TIP0 - WRIST0;
export const TUBE_MAX = 440; // the longest the drawn tube can be

const deg = (r) => r * 180 / Math.PI;

// The telescoping arm hangs straight down at angle 0 and turns clockwise for positive angles. To put the pen tip on a
// target it turns to face it and slides the hand out by `slide` (the distance minus TIP0).
export function pose(target) {
  const [sx, sy] = SHOULDER;
  const dx = target[0] - sx; const dy = target[1] - sy;
  return { angle: deg(Math.atan2(-dx, dy)), slide: Math.max(0, Math.hypot(dx, dy) - TIP0) };
}

// Where the pen tip goes for each cell (a little above the middle, where an O starts).
export const penTarget = (i) => { const [x, y] = cellCentre(i); return [x + 2, y - 24]; };

export const armTable = () => Array.from({ length: 9 }, (_, i) => pose(penTarget(i)));
// Rest: the arm hangs from the shoulder, down and a little out, and the hand rests on the desk beside the paper.
export const restPose = () => ({ angle: 28, slide: 60 });

export const r1 = (n) => Math.round(n * 10) / 10;
