// The noughts showcase (examples/noughts): Bolt answers X and O together, and the drawing waits for Bolt.
// Fast: no browser (browser/x9-noughts-browser.mjs plays the packed page). The game is copied to a folder outside the
// engine and pinned there, as a person would use it, then played in Node with its add-ons loaded.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { Player } from '../src/story.mjs';
import { modulePort } from '../src/host.mjs';
import { loadAddons } from '../tools/addons.mjs';
import { pin } from '../tools/addon.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const EXAMPLES = path.join(repo, 'engine', 'v2', 'addons', 'examples');
export const LINES = { row1: [0, 1, 2], row2: [3, 4, 5], row3: [6, 7, 8], col1: [0, 3, 6], col2: [1, 4, 7], col3: [2, 5, 8], diag1: [0, 4, 8], diag2: [2, 4, 6] };

// order: the cells easy Bolt takes first (the module's own list by default). The corner diagonals need Bolt to leave the
// centre and corners alone, so a test may copy the module with another list before it pins it.
export const DEFAULT_ORDER = '[4, 0, 2, 6, 8, 1, 3, 5, 7]';
export async function open(order = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-x9-'));
  fs.cpSync(path.join(EXAMPLES, 'addons'), path.join(dir, 'addons'), { recursive: true });
  fs.cpSync(path.join(EXAMPLES, 'noughts'), path.join(dir, 'noughts'), { recursive: true });
  if (order) {
    const f = path.join(dir, 'addons', 'example.noughts', 'index.mjs');
    const text = fs.readFileSync(f, 'utf8');
    ok(text.includes(`const ORDER = ${DEFAULT_ORDER}`), 'the module still has its order list');
    fs.writeFileSync(f, text.replace(`const ORDER = ${DEFAULT_ORDER}`, `const ORDER = ${order}`));
  }
  await pin(path.join(dir, 'noughts'));
  const src = await folderSource(path.join(dir, 'noughts'));
  const r = await checkExperience(src, schemas());
  eq(r.diags, [], 'the example checks clean');
  const loaded = await loadAddons(src, r.experience, { allow: Object.keys(r.experience.addons || {}) });
  const lock = Object.fromEntries(loaded.map(a => [a.pinned, a.digest]));
  const p = new Player(r.experience, { capabilities: Object.fromEntries(loaded.map(a => [a.id, modulePort({ lock })])) });
  ok(p.start().ok);
  return { p, dir };
}
export const ORDERS = [null, '[1, 3, 5, 7, 0, 2, 4, 6, 8]'];
const start = (p, level) => { ok(p.activate('pick', 'levels', level).ok); ok(p.activate('pick', 'go').ok); p.advance(600); eq(p.scene, 'game'); };
const wait = (p) => p.advance(3500); // Bolt's wait (0.55 to 1.15 s), reach (0.66 s) and ink (0.56 s) fit in this
const read = (p, n) => p.read('game', n);

// The same module the example pins, run here to find move lists: which cells X may play so that X wins on `line`.
export async function moduleTurn(order = null) {
  let text = fs.readFileSync(path.join(EXAMPLES, 'addons', 'example.noughts', 'index.mjs'), 'utf8');
  if (order) text = text.replace(`const ORDER = ${DEFAULT_ORDER}`, `const ORDER = ${order}`);
  const mod = await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
  return mod.make(() => {}).turn;
}
export const completed = (b) => Object.entries(LINES).filter(([, c]) => c.every(i => b[i] === 'X')).map(([id]) => id);

// A move list that ends with X completing exactly `line` (and nothing else), against Bolt at `level`.
export function find(turn, level, line, board = Array(9).fill(''), moves = []) {
  for (let c = 0; c < 9; c++) {
    if (board[c]) continue;
    const r = turn({ board, cell: c, level });
    const done = completed(r.board);
    if (r.winner === 'X') { if (done.length === 1 && done[0] === line) return [...moves, c]; continue; }
    if (r.winner) continue;
    const next = find(turn, level, line, r.board, [...moves, c]);
    if (next) return next;
  }
  return null;
}

export const tests = {
  async 'a full game plays at each of the three levels, and the page waits for Bolt'() {
    for (const [level, name] of [[1, 'easy'], [2, 'fair'], [3, 'hard']]) {
      const { p } = await open();
      start(p, name);
      eq(read(p, 'winner'), '');
      let moves = 0;
      while (!read(p, 'winner') && moves < 9) {
        const board = read(p, 'board');
        const cell = board.findIndex(c => !c);
        ok(p.activate('game', 'cells', `c${cell}`).ok, `level ${level}: a move on cell ${cell}`);
        moves++;
        wait(p);
      }
      ok(['X', 'O', 'draw'].includes(read(p, 'winner')), `level ${level} ends: ${read(p, 'winner')}`);
      if (level === 3) ok(read(p, 'winner') !== 'X', 'level 3 never loses');
    }
  },

  async 'Bolt\'s O waits for the thinking timer although the module answers X and O together'() {
    const { p } = await open();
    start(p, 'fair');
    ok(p.activate('game', 'cells', 'c0').ok);
    eq(read(p, 'board').filter(Boolean).length, 2, 'the board holds X and O at once');
    eq(read(p, 'thinkingNow'), true, 'but Bolt is still thinking');
    eq(read(p, 'mood'), 'thinking');
    eq(read(p, 'reachCell'), -1, 'the arm has not left its rest');
    ok(!p.activate('game', 'cells', 'c1').ok || read(p, 'board')[1] === '', 'a second pick while Bolt thinks changes nothing');
    p.advance(500); // under the shortest wait (550 ms)
    eq(read(p, 'thinkingNow'), true, 'still thinking after 500 ms');
    eq(read(p, 'reachCell'), -1, 'the arm still rests after 500 ms');
    p.advance(700); // past the longest wait (1150 ms): reaching or later
    const reply = read(p, 'reply');
    ok(reply >= 0 && read(p, 'board')[reply] === 'O');
    eq(read(p, 'reachCell'), reply, 'the arm reaches for the cell Bolt chose');
    p.advance(1300);
    eq(read(p, 'thinkingNow'), false, 'Bolt is done: your move');
    eq(read(p, 'reachCell'), -1, 'the arm goes back to rest');
  },

  async 'the winning line is found from the data table, for each of the eight lines'() {
    const turns = await Promise.all(ORDERS.map(moduleTurn));
    for (const [line, cells] of Object.entries(LINES)) {
      const k = turns.findIndex(t => find(t, 1, line));
      ok(k >= 0, `a game that ends with X on ${line}`);
      const moves = find(turns[k], 1, line);
      const { p } = await open(ORDERS[k]);
      start(p, 'easy');
      moves.forEach((c, k) => { ok(p.activate('game', 'cells', `c${c}`).ok, `${line}: move ${k + 1}`); if (k < moves.length - 1) wait(p); });
      eq(read(p, 'winner'), 'X', `${line}: X wins`);
      eq(read(p, 'winLine'), line, `${line}: the table names the line`);
      const b = read(p, 'board');
      ok(cells.every(i => b[i] === 'X'), `${line}: its three cells are X`);
      eq(read(p, 'mood'), 'dizzy', `${line}: Bolt is dizzy`);
      eq(read(p, 'wins'), 1, `${line}: the tally counts it`);
    }
  },

  async 'a win by Bolt, a draw, a taken cell and a new game'() {
    const { p } = await open();
    start(p, 'hard');
    // Hard Bolt never loses: play until it ends, then count whoever won.
    for (let i = 0; i < 9 && !read(p, 'winner'); i++) { p.activate('game', 'cells', `c${read(p, 'board').findIndex(c => !c)}`); wait(p); }
    const won = read(p, 'winner');
    ok(won === 'O' || won === 'draw', `hard ends in O or a draw: ${won}`);
    eq(read(p, 'mood'), won === 'O' ? 'happy' : 'shrug');
    if (won === 'O') { ok(['row1', 'row2', 'row3', 'col1', 'col2', 'col3', 'diag1', 'diag2'].includes(read(p, 'winLine'))); eq(read(p, 'losses'), 1); } else eq(read(p, 'draws'), 1);
    // A taken cell does nothing while a game is on: start another game first.
    ok(p.activate('game', 'again').ok);
    p.advance(1300);
    eq(read(p, 'board'), Array(9).fill(''), 'the paper is clean');
    eq(read(p, 'winner'), '');
    eq(read(p, 'wins') + read(p, 'losses') + read(p, 'draws'), 1, 'the tally is kept for the session');
    ok(p.activate('game', 'cells', 'c0').ok); wait(p);
    const before = read(p, 'board').join('|');
    p.activate('game', 'cells', 'c0');
    eq(read(p, 'board').join('|'), before, 'a taken cell changes nothing');
  },

  async 'Change level returns to the picker and the level is kept'() {
    const { p } = await open();
    start(p, 'hard');
    eq(read(p, 'level'), 3);
    ok(p.activate('game', 'change-level').ok); p.advance(600);
    eq(p.scene, 'pick');
    start(p, 'easy');
    eq(read(p, 'level'), 1);
  },
};
