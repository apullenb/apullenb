// Arcade high-score board from live GitHub numbers.
// Usage: GITHUB_TOKEN=... node scoreboard.mjs <user> <scores.svg> <achievements.svg> <weapons.svg>
import { readFileSync, writeFileSync } from 'node:fs';

const [user = 'apullenb', out = 'scoreboard.svg', achOut = 'achievements.svg', weaponsOut = 'weapons.svg'] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is required');

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'scoreboard' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const base = await gql(
  `query($login:String!){user(login:$login){createdAt
    pullRequests{totalCount}
    repositories(ownerAffiliations:OWNER,first:100,isFork:false){totalCount nodes{stargazerCount primaryLanguage{name} languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}}
    contributionsCollection{contributionYears}}}`,
  { login: user },
);
const years = [...base.user.contributionsCollection.contributionYears].sort();

const perYear = [];
const days = [];
for (const y of years) {
  const d = await gql(
    `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){
      contributionsCollection(from:$from,to:$to){totalCommitContributions restrictedContributionsCount
        contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}`,
    { login: user, from: `${y}-01-01T00:00:00Z`, to: `${y}-12-31T23:59:59Z` },
  );
  const c = d.user.contributionsCollection;
  const days_ = c.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  perYear.push({ year: y, total: days_.reduce((n, d) => n + d.contributionCount, 0), commits: c.totalCommitContributions + c.restrictedContributionsCount });
  days.push(...days_);
}

days.sort((a, b) => a.date.localeCompare(b.date));
const today = new Date().toISOString().slice(0, 10);
const past = days.filter((d) => d.date <= today);
let longest = 0, run = 0;
for (const d of past) { run = d.contributionCount ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0;
for (let i = past.length - 1; i >= 0; i--) {
  if (past[i].contributionCount) current++;
  else if (i === past.length - 1) continue; // today may not have commits yet
  else break;
}
const bestDay = Math.max(0, ...past.map((d) => d.contributionCount));
const activeDays = past.filter((d) => d.contributionCount).length;

const fmt = (n) => n.toLocaleString('en-US');
const xp = perYear.reduce((s, y) => s + y.total, 0);
// Level n needs 5*n^2 XP
const level = Math.floor(Math.sqrt(xp / 5));
const lvlFrom = 5 * level ** 2, lvlTo = 5 * (level + 1) ** 2;
const lvlPct = (xp - lvlFrom) / (lvlTo - lvlFrom);
const repos = base.user.repositories.nodes;
const languages = new Set(repos.map((r) => r.primaryLanguage?.name).filter(Boolean)).size;
const starCount = repos.reduce((n, r) => n + r.stargazerCount, 0);
const activeYears = perYear.filter((y) => y.total > 0).length;
const yearsPlayed = new Date().getUTCFullYear() - new Date(base.user.createdAt).getUTCFullYear();
const bestYearCommits = Math.max(0, ...perYear.map((y) => y.commits));
const scores = [
  [fmt(xp), 'CONTRIBUTIONS'],
  [fmt(perYear.reduce((s, y) => s + y.commits, 0)), 'COMMITS'],
  [fmt(base.user.pullRequests.totalCount), 'PULL REQUESTS'],
  [fmt(activeDays), 'DAYS PLAYED'],
  [fmt(bestDay), 'BEST DAY'],
  [`${fmt(longest)}D`, 'LONGEST STREAK'],
  [`${fmt(current)}D`, 'CURRENT STREAK'],
  [fmt(base.user.repositories.totalCount), 'REPOS BUILT'],
];

const font = readFileSync(new URL('./press-start-2p.woff2', import.meta.url)).toString('base64');
const C = { bg: '#0B0B1A', y: '#FFD300', c: '#2DE2E6', m: '#FF3864', g: '#39FF14', w: '#F5F5F5', dim: '#8B8BA7' };
const rankCol = [C.y, C.c, C.m, C.g, C.w, C.y, C.c, C.m];
const ord = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const W = 900, H = 400;
let rows = '';
scores.forEach(([score, name], i) => {
  const y = 128 + i * 30;
  rows += `<g class="row" style="animation-delay:${0.25 + i * 0.18}s">
<text x="40" y="${y}" fill="${rankCol[i]}">${ord[i]}</text>
<text x="300" y="${y}" fill="${C.w}" text-anchor="end">${esc(score)}</text>
<text x="330" y="${y}" fill="${rankCol[i]}">${esc(name)}</text></g>`;
});

// XP bars: contributions per year
const maxYear = Math.max(1, ...perYear.map((y) => y.total));
const bx = 600, bw = 230;
let bars = '';
const shown = perYear.slice(-8);
shown.forEach((y, i) => {
  const by = 128 + i * 30 - 12;
  const cells = Math.max(1, Math.round((y.total / maxYear) * 23));
  let blocks = '';
  for (let k = 0; k < 23; k++) {
    const on = k < cells;
    blocks += `<rect x="${bx + 52 + k * 10}" y="${by}" width="8" height="12" fill="${on ? (k > 17 ? C.m : k > 11 ? C.y : C.g) : '#1C1C33'}"${on ? ` class="xp" style="animation-delay:${0.4 + i * 0.12 + k * 0.03}s"` : ''}/>`;
  }
  bars += `<text x="${bx}" y="${by + 12}" fill="${C.dim}" font-size="11">${y.year}</text>${blocks}`;
});

const stars = Array.from({ length: 40 }, (_, i) => {
  const x = (i * 197) % W, y = (i * 89) % H;
  return `<rect x="${x}" y="${y}" width="2" height="2" fill="${[C.w, C.c, C.y][i % 3]}" class="tw" style="animation-delay:${(i % 7) * 0.4}s"/>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="High scores for ${esc(user)}: ${scores.map(([s, n]) => `${n.toLowerCase()} ${s}`).join(', ')}">
<style>
@font-face{font-family:'PS2P';src:url(data:font/woff2;base64,${font}) format('woff2');}
text{font-family:'PS2P',monospace;font-size:14px}
.row{opacity:0;animation:in .01s steps(1) forwards}
@keyframes in{to{opacity:1}}
.xp{opacity:0;animation:in .01s steps(1) forwards}
.blink{animation:bl 1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}
.tw{animation:tw 2.6s steps(2) infinite}
@keyframes tw{50%{opacity:.1}}
</style>
<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity=".25"/></pattern></defs>
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${stars}
<rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="${C.c}" stroke-width="4"/>
<text x="${W / 2}" y="48" fill="${C.y}" font-size="24" text-anchor="middle">HIGH SCORES</text>
<text x="40" y="78" fill="${C.m}" font-size="12">LVL ${level}</text>
${Array.from({ length: 40 }, (_, k) => `<rect x="${140 + k * 13}" y="66" width="11" height="12" fill="${k < Math.round(lvlPct * 40) ? C.g : '#1C1C33'}"/>`).join('')}
<text x="${W - 40}" y="78" fill="${C.dim}" font-size="10" text-anchor="end" class="blink">${fmt(lvlTo - xp)} XP TO LVL ${level + 1}</text>
<text x="40" y="100" fill="${C.dim}" font-size="10">RANK</text>
<text x="300" y="100" fill="${C.dim}" font-size="10" text-anchor="end">SCORE</text>
<text x="330" y="100" fill="${C.dim}" font-size="10">STAT</text>
<text x="${bx}" y="100" fill="${C.dim}" font-size="10">XP BY YEAR</text>
<line x1="570" y1="92" x2="570" y2="356" stroke="#2A2A4A" stroke-width="2" stroke-dasharray="4 4"/>
${rows}
${bars}
<text x="${W / 2}" y="${H - 22}" fill="${C.dim}" font-size="9" text-anchor="middle">UPDATED ${today} · GITHUB.COM/${esc(user.toUpperCase())}</text>
<rect width="${W}" height="${H}" fill="url(#scan)"/>
</svg>`;

writeFileSync(out, svg);
console.log(`wrote ${out}`);

const ach = [
  ['VETERAN', `${yearsPlayed}+ YEARS ON GITHUB`, yearsPlayed >= 5],
  ['1K CLUB', '1,000+ CONTRIBUTIONS', xp >= 1000],
  ['PR MACHINE', '100+ PULL REQUESTS', base.user.pullRequests.totalCount >= 100],
  ['BIG YEAR', '500+ IN ONE YEAR', bestYearCommits >= 500],
  ['COMBO X50', '50+ IN ONE DAY', bestDay >= 50],
  ['ON A ROLL', '7-DAY STREAK', longest >= 7],
  ['POLYGLOT', '5+ LANGUAGES', languages >= 5],
  ['BUILDER', '50+ REPOS', base.user.repositories.totalCount >= 50],
  ['NO QUIT', 'ACTIVE 5+ YEARS', activeYears >= 5],
  ['5K CLUB', '5,000+ CONTRIBUTIONS', xp >= 5000],
  ['UNSTOPPABLE', '30-DAY STREAK', longest >= 30],
  ['STAR POWER', '25+ STARS', starCount >= 25],
];
const got = ach.filter((a) => a[2]).length;
const AW = 900, cols = 4, tw = 204, th = 84, gap = 12, ox = 30, oy = 92;
const AH = oy + Math.ceil(ach.length / cols) * (th + gap) + 30;
// 8x8 pixel trophy
const trophy = ['.YYYYYY.', 'YYYYYYYY', 'YYYYYYYY', '.YYYYYY.', '..YYYY..', '...YY...', '..YYYY..', '.YYYYYY.'];
const sprite = (x, y, col) => trophy.flatMap((row, r) => [...row].map((ch, c) => (ch === 'Y' ? `<rect x="${x + c * 4}" y="${y + r * 4}" width="4" height="4" fill="${col}"/>` : ''))).join('');
const tiles = ach.map(([name, desc, ok], i) => {
  const x = ox + (i % cols) * (tw + gap), y = oy + Math.floor(i / cols) * (th + gap);
  const col = ok ? [C.y, C.c, C.m, C.g][i % 4] : '#3A3A55';
  return `<g class="tile" style="animation-delay:${0.2 + i * 0.12}s">
<rect x="${x}" y="${y}" width="${tw}" height="${th}" fill="${ok ? '#14142B' : '#0F0F20'}" stroke="${col}" stroke-width="3"/>
${sprite(x + 14, y + 26, col)}
<text x="${x + 56}" y="${y + 36}" fill="${ok ? C.w : '#55557A'}" font-size="11">${ok ? esc(name) : '???'}</text>
<text x="${x + 56}" y="${y + 58}" fill="${ok ? C.dim : '#3A3A55'}" font-size="7">${esc(desc)}</text>
${ok ? '' : `<text x="${x + tw - 12}" y="${y + 18}" fill="#55557A" font-size="8" text-anchor="end">LOCKED</text>`}
</g>`;
}).join('');
const achSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${AW}" height="${AH}" viewBox="0 0 ${AW} ${AH}" role="img" aria-label="Achievements: ${got} of ${ach.length} unlocked. ${ach.filter((a) => a[2]).map((a) => `${a[0].toLowerCase()} (${a[1].toLowerCase()})`).join(', ')}">
<style>
@font-face{font-family:'PS2P';src:url(data:font/woff2;base64,${font}) format('woff2');}
text{font-family:'PS2P',monospace}
.tile{opacity:0;animation:in .01s steps(1) forwards}
@keyframes in{to{opacity:1}}
.blink{animation:bl 1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}
</style>
<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity=".25"/></pattern></defs>
<rect width="${AW}" height="${AH}" fill="${C.bg}"/>
<rect x="6" y="6" width="${AW - 12}" height="${AH - 12}" fill="none" stroke="${C.y}" stroke-width="4"/>
<text x="${AW / 2}" y="46" fill="${C.y}" font-size="22" text-anchor="middle">ACHIEVEMENTS</text>
<text x="${AW / 2}" y="72" fill="${C.g}" font-size="11" text-anchor="middle" class="blink">${got}/${ach.length} UNLOCKED</text>
${tiles}
<rect width="${AW}" height="${AH}" fill="url(#scan)"/>
</svg>`;
writeFileSync(achOut, achSvg);
console.log(`wrote ${achOut}`);

// Weapons: how many owned repos use each language
const skip = new Set(['HTML', 'CSS', 'SCSS', 'Shell', 'Dockerfile', 'Makefile', 'Procfile', 'R', 'Cue', 'Gherkin', 'Smarty', 'PLpgSQL']);
const usage = new Map();
for (const r of repos) for (const e of r.languages.edges) {
  if (skip.has(e.node.name)) continue;
  const cur = usage.get(e.node.name) ?? { repos: 0, color: e.node.color ?? C.w };
  cur.repos += 1; usage.set(e.node.name, cur);
}
const langs = [...usage.entries()].sort((a, b) => b[1].repos - a[1].repos).slice(0, 6)
  .map(([name, v]) => ({ name, color: v.color, repos: v.repos }));
const classes = ['LEGENDARY', 'EPIC', 'RARE', 'RARE', 'UNCOMMON', 'UNCOMMON'];
const classCol = [C.y, C.m, C.c, C.c, C.g, C.g];
const WW = 900, rowH = 58, top = 96, WH = top + langs.length * rowH + 28;
const segs = 30;
const wrows = langs.map((l, i) => {
  const y = top + i * rowH;
  // bar length on a log-ish scale so small shares still show
  const lit = Math.max(1, Math.round((segs * l.repos) / langs[0].repos));
  const pct = `${l.repos} REPO${l.repos === 1 ? "" : "S"}`;
  const filled = Math.max(1, 5 - i);
  const star = ['..#..', '.###.', '#####', '.###.', '#.#.#'];
  const stars = Array.from({ length: 5 }, (_, n) => star.flatMap((row, r) => [...row].map((ch, c) => (ch === '#'
    ? `<rect x="${80 + 120 + n * 14 + c * 2}" y="${y + 34 + r * 2}" width="2" height="2" fill="${n < filled ? classCol[i] : '#2A2A4A'}"/>` : ''))).join('')).join('');
  let cells = '';
  for (let k = 0; k < segs; k++) {
    cells += `<rect x="${310 + k * 12}" y="${y + 20}" width="10" height="16" fill="${k < lit ? l.color : '#1C1C33'}"${k < lit ? ` class="xp" style="animation-delay:${0.3 + i * 0.15 + k * 0.025}s"` : ''}/>`;
  }
  return `<rect x="30" y="${y}" width="${WW - 60}" height="${rowH - 8}" fill="${i === 0 ? '#16162E' : '#0F0F22'}" stroke="${i === 0 ? C.y : '#24244A'}" stroke-width="2"/>
<rect x="44" y="${y + 14}" width="22" height="22" fill="${l.color}"/><rect x="48" y="${y + 18}" width="6" height="6" fill="#FFFFFF" opacity=".55"/>
<text x="80" y="${y + 26}" fill="${C.w}" font-size="13">${esc(l.name.toUpperCase())}</text>
<text x="80" y="${y + 42}" fill="${classCol[i]}" font-size="8">${classes[i]}</text>${stars}
${cells}
<text x="${WW - 46}" y="${y + 33}" fill="${C.w}" font-size="10" text-anchor="end">${pct}</text>`;
}).join('');
const wsvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WW}" height="${WH}" viewBox="0 0 ${WW} ${WH}" role="img" aria-label="Weapons of choice: ${langs.map((l) => `${l.name} in ${l.repos} repo${l.repos === 1 ? "" : "s"}`).join(', ')}">
<style>
@font-face{font-family:'PS2P';src:url(data:font/woff2;base64,${font}) format('woff2');}
text{font-family:'PS2P',monospace}
.xp{opacity:0;animation:in .01s steps(1) forwards}
@keyframes in{to{opacity:1}}
.blink{animation:bl 1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}
</style>
<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity=".25"/></pattern></defs>
<rect width="${WW}" height="${WH}" fill="${C.bg}"/>
<rect x="6" y="6" width="${WW - 12}" height="${WH - 12}" fill="none" stroke="${C.m}" stroke-width="4"/>
<text x="${WW / 2}" y="46" fill="${C.y}" font-size="22" text-anchor="middle">WEAPONS OF CHOICE</text>
<text x="${WW / 2}" y="72" fill="${C.c}" font-size="10" text-anchor="middle" class="blink">EQUIPPED: ${esc(langs[0]?.name.toUpperCase() ?? '')}</text>
${wrows}
<rect width="${WW}" height="${WH}" fill="url(#scan)"/>
</svg>`;
writeFileSync(weaponsOut, wsvg);
console.log(`wrote ${weaponsOut}`);
