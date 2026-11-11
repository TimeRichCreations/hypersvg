// The add-on's own test: node tests/noughts.test.mjs (from this folder). It plays the module with a step counter, as
// the engine's executor does. The tests/ folder is not part of the add-on's digest.
import assert from 'node:assert/strict';
import { make } from '../index.mjs';

let steps = 0;
const api = make(() => { steps++; });
const empty = ['', '', '', '', '', '', '', '', ''];

// Level 1 takes the centre, then the first free corner.
let r = api.turn({ board: empty, cell: 0, level: 1 });
assert.deepEqual([r.reply, r.winner], [4, '']);
// Level 2 blocks a line: X holds 0 and 1, so O takes 2.
r = api.turn({ board: ['X', '', '', '', 'O', '', '', '', ''], cell: 1, level: 2 });
assert.equal(r.reply, 2);
// Level 3 never loses: play every game X can play against it.
function all(board) {
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    const t = api.turn({ board, cell: i, level: 3 });
    assert.notEqual(t.winner, 'X', `X won against level 3 from ${board.join(',')}`);
    if (!t.winner) all(t.board);
  }
}
all(empty);
// A taken cell changes nothing.
r = api.turn({ board: ['X', '', '', '', 'O', '', '', '', ''], cell: 4, level: 3 });
assert.equal(r.reply, -1);
console.log(`example.noughts: ok (${steps} steps)`);
