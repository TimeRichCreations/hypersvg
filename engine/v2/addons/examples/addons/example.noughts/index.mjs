// example.noughts: a noughts-and-crosses opponent, an outside logic module (door 1).
// A logic module is a pure function. It gets only step(), which it calls once per unit of work, and its inputs.
// It names no global, no clock and no random source, so the same inputs always give the same answer.

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7]; // centre, corners, edges

export function make(step) {
  const winner = (b) => {
    for (const [a, c, d] of LINES) { step(); if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]; }
    return b.includes('') ? '' : 'draw';
  };
  // The cell that completes a line for who, or -1.
  const finish = (b, who) => {
    for (const i of ORDER) {
      if (b[i]) continue;
      b[i] = who; const won = winner(b) === who; b[i] = '';
      if (won) return i;
    }
    return -1;
  };
  // Minimax: the score of the board for O to move (1 O wins, 0 draw, -1 X wins).
  const score = (b, toMove) => {
    step();
    const w = winner(b);
    if (w === 'O') return 1;
    if (w === 'X') return -1;
    if (w === 'draw') return 0;
    let best = toMove === 'O' ? -2 : 2;
    for (const i of ORDER) {
      if (b[i]) continue;
      b[i] = toMove; const s = score(b, toMove === 'O' ? 'X' : 'O'); b[i] = '';
      if (toMove === 'O' ? s > best : s < best) best = s;
    }
    return best;
  };
  const choose = (b, level) => {
    if (level >= 2) {
      const win = finish(b, 'O'); if (win >= 0) return win;
      const block = finish(b, 'X'); if (block >= 0) return block;
    }
    if (level >= 3) {
      let best = -1; let bestScore = -2;
      for (const i of ORDER) {
        if (b[i]) continue;
        b[i] = 'O'; const s = score(b, 'X'); b[i] = '';
        if (s > bestScore) { best = i; bestScore = s; }
      }
      return best;
    }
    for (const i of ORDER) if (!b[i]) return i;
    return -1;
  };
  return {
    turn({ board, cell, level }) {
      const b = board.slice();
      if (winner(b) || b[cell]) return { board: b, winner: winner(b), reply: -1 };
      b[cell] = 'X';
      if (winner(b)) return { board: b, winner: winner(b), reply: -1 };
      const reply = choose(b, level);
      b[reply] = 'O';
      return { board: b, winner: winner(b), reply };
    },
  };
}
