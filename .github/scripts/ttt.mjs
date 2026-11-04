// Builds tic-tac-toe as linked pages: every reachable board is a file in play/,
// each square links to the page with the CPU's reply. No sign-in, no commits.
// Usage: node .github/scripts/ttt.mjs   (rewrites play/ and the README board)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

const winner = (b) => {
  for (const [a, c, d] of LINES) if (b[a] !== '-' && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.includes('-') ? null : 'draw';
};
const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

// Strong but beatable: always takes a win, usually blocks.
function cpuMove(b) {
  const open = [...b].map((v, i) => (v === '-' ? i : -1)).filter((i) => i >= 0);
  const find = (mark) => open.find((i) => winner(b.slice(0, i) + mark + b.slice(i + 1)) === mark) ?? -1;
  const win = find('O');
  if (win >= 0) return win;
  const block = find('X');
  if (block >= 0 && hash(b) % 4 !== 0) return block;
  return [4, 0, 2, 6, 8, 1, 3, 5, 7].find((i) => open.includes(i));
}

const play = (b, i) => {
  let n = b.slice(0, i) + 'X' + b.slice(i + 1);
  if (!winner(n)) { const c = cpuMove(n); n = n.slice(0, c) + 'O' + n.slice(c + 1); }
  return n;
};

const pages = new Map();
function explore(b) {
  if (pages.has(b)) return;
  pages.set(b, winner(b));
  if (winner(b)) return;
  for (let i = 0; i < 9; i++) if (b[i] === '-') explore(play(b, i));
}
const START = '---------';
explore(START);

function board(b, prefix, pagePrefix) {
  const w = winner(b);
  const img = (f, alt) => `<img src="${prefix}assets/${f}.svg" width="88" alt="${alt}" />`;
  const cell = (i) => {
    if (b[i] === 'X') return img('ttt-x', 'X');
    if (b[i] === 'O') return img('ttt-o', 'O');
    if (w) return img('ttt-off', 'empty');
    return `<a href="${pagePrefix}${play(b, i)}.md">${img(`ttt-${i + 1}`, `Play square ${i + 1}`)}</a>`;
  };
  return `<table>\n${[0, 3, 6].map((r) => `  <tr>${[r, r + 1, r + 2].map((i) => `<td>${cell(i)}</td>`).join('')}</tr>`).join('\n')}\n</table>`;
}

const status = {
  X: '🏆 **YOU WIN!** You beat the CPU.',
  O: '👾 **GAME OVER.** The CPU wins this round.',
  draw: '🤝 **DRAW.** Nobody wins.',
};

rmSync(new URL('play/', ROOT), { recursive: true, force: true });
mkdirSync(new URL('play/', ROOT));
for (const [b, w] of pages) {
  if (b === START) continue;
  const body = `<div align="center">

<img src="../assets/banner-play.svg" alt="Tic-tac-toe" width="100%" />

${board(b, '../', '')}

${w ? status[w] : '**YOUR TURN.** You are **X**. The CPU played **O**. Click a numbered square.'}

[▶ New game](../README.md#play) · [⬅ Back to my profile](https://github.com/apullenb)

</div>
`;
  writeFileSync(new URL(`play/${b}.md`, ROOT), body);
}

const section = `<!-- TTT:START -->
<div align="center">

${board(START, './', 'play/')}

**YOUR TURN.** You are **X**. Click a numbered square. The CPU answers instantly.

</div>
<!-- TTT:END -->`;
const readmeUrl = new URL('README.md', ROOT);
const readme = readFileSync(readmeUrl, 'utf8');
writeFileSync(readmeUrl, readme.replace(/<!-- TTT:START -->[\s\S]*<!-- TTT:END -->/, section));
console.log(`${pages.size - 1} pages`);
