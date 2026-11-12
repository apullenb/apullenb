// Profile graphics from GitHub activity.
// Usage: GITHUB_TOKEN=... node scoreboard.mjs <user> <scores.svg> <achievements.svg> <weapons.svg>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
    mergedPRs:pullRequests(states:MERGED){totalCount}
    openPRs:pullRequests(states:OPEN){totalCount}
    closedPRs:pullRequests(states:CLOSED){totalCount}
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
const bestDay = Math.max(0, ...past.map((d) => d.contributionCount));
const activeDays = past.filter((d) => d.contributionCount).length;

const fmt = (n) => n.toLocaleString('en-US');
const xp = perYear.reduce((s, y) => s + y.total, 0);
const repos = base.user.repositories.nodes;
const languages = new Set(repos.map((r) => r.primaryLanguage?.name).filter(Boolean)).size;
const starCount = repos.reduce((n, r) => n + r.stargazerCount, 0);
const activeYears = perYear.filter((y) => y.total > 0).length;
const yearsPlayed = new Date().getUTCFullYear() - new Date(base.user.createdAt).getUTCFullYear();
const bestYearCommits = Math.max(0, ...perYear.map((y) => y.commits));
const font = readFileSync(new URL('./press-start-2p.woff2', import.meta.url)).toString('base64');
const C = { bg: '#0B0B1A', y: '#FFD300', c: '#2DE2E6', m: '#FF3864', g: '#39FF14', w: '#F5F5F5', dim: '#8B8BA7' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const stats = [
  [fmt(xp), 'Contributions'],
  [fmt(activeDays), 'Active days'],
  [fmt(base.user.pullRequests.totalCount), 'Pull requests'],
  [fmt(base.user.repositories.totalCount), 'Repositories'],
];
const yearsShown = perYear.slice(-8);
const maxYear = Math.max(1, ...yearsShown.map(({ total }) => total));
const height = 199 + yearsShown.length * 28;
const cards = stats.map(([value, label], i) => {
  const x = 24 + i * 170;
  return `<rect x="${x}" y="22" width="162" height="86" rx="11" class="card"/>
<text x="${x + 14}" y="63" class="value">${value}</text>
<text x="${x + 14}" y="89" class="label">${label}</text>`;
}).join('\n');
const yearRows = yearsShown.map(({ year, total }, i) => {
  const y = 164 + i * 28;
  return `<text x="26" y="${y + 11}" class="label">${year}</text>
<rect x="92" y="${y}" width="510" height="12" rx="6" class="track"/>
<rect x="92" y="${y}" width="${(510 * total / maxYear).toFixed(1)}" height="12" rx="6" fill="url(#activity)"/>
<text x="694" y="${y + 11}" text-anchor="end" class="count">${fmt(total)}</text>`;
}).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height}" viewBox="0 0 720 ${height}" role="img" aria-labelledby="title desc">
<title id="title">GitHub activity</title>
<desc id="desc">${stats.map(([value, label]) => `${value} ${label.toLowerCase()}`).join(', ')}. Contributions by year: ${yearsShown.map(({ year, total }) => `${year}: ${fmt(total)}`).join(', ')}.</desc>
<style>
text{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.surface{fill:#f8f9ff;stroke:#d8dbea}
.card{fill:#fff;stroke:#d8dbea}
.track{fill:#e6e8f4}
.value{fill:#26234e;font-size:34px;font-weight:700}
.heading{fill:#26234e;font-size:19px;font-weight:650}
.label,.count{fill:#4e526c;font-size:16px}
.count{font-weight:600}
.date{fill:#4e526c;font-size:13px}
@media (prefers-color-scheme:dark){
  .surface{fill:#141724;stroke:#343a51}
  .card{fill:#1e2234;stroke:#343a51}
  .track{fill:#292e44}
  .value,.heading{fill:#f0edff}
  .label,.count,.date{fill:#bfc6df}
}
</style>
<defs><linearGradient id="activity"><stop stop-color="#6d53d2"/><stop offset="1" stop-color="#527ee9"/></linearGradient></defs>
<rect x=".5" y=".5" width="719" height="${height - 1}" rx="17" class="surface"/>
${cards}
<text x="26" y="141" class="heading">Contributions by year</text>
${yearRows}
<text x="694" y="${height - 19}" text-anchor="end" class="date">Updated ${today}</text>
</svg>`;
writeFileSync(out, svg);
console.log(`wrote ${out}`);

const chartWidth = 350;
const chartHeight = 182;
function diagram({ file, label, summary, description, art }) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-labelledby="title desc">
<title id="title">${esc(label)}. ${esc(summary)}</title>
<desc id="desc">${esc(description)}</desc>
<style>
svg{--ink:#172033;--muted:#526078;--rule:#cbd5e1;--bar:#2456a6;--soft:#dce7f6}
text{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums}
.title{font-size:15px;font-weight:700;fill:var(--ink)}
.label,.summary{font-size:11px;fill:var(--muted)}
.count{font-size:11px;font-weight:650;fill:var(--ink)}
.rule{stroke:var(--rule)}
.bar{fill:var(--bar)}
.empty{fill:var(--soft)}
@media(prefers-color-scheme:dark){svg{--ink:#edf2fb;--muted:#aebdd4;--rule:#38465d;--bar:#82adf7;--soft:#263752}}
</style>
<text x="8" y="22" class="title">${esc(label)}</text>
<text x="342" y="22" text-anchor="end" class="summary">${esc(summary)}</text>
<path d="M8 33H342" class="rule"/>
${art}
</svg>`;
  writeFileSync(join(dirname(out), file), markup);
}

const chartYears = perYear.slice(-8);
const peak = Math.max(1, ...chartYears.map(({ total }) => total));
const columns = chartYears.map(({ year, total }, i) => {
  const x = 12 + i * (332 / chartYears.length);
  const height = Math.round(75 * total / peak);
  return `<rect x="${x.toFixed(1)}" y="${142 - height}" width="24" height="${height}" class="bar" opacity="${i === chartYears.length - 1 ? 1 : .68}"/>
<text x="${(x + 12).toFixed(1)}" y="${135 - height}" class="count" text-anchor="middle">${fmt(total)}</text>
<text x="${(x + 12).toFixed(1)}" y="158" class="label" text-anchor="middle">${year}</text>`;
}).join('\n');
diagram({
  file: 'contributions-by-year.svg', label: 'Contributions by year', summary: `${fmt(xp)} total`,
  description: chartYears.map(({ year, total }) => `${year}: ${fmt(total)}`).join(', ') + '. Latest year is year to date.',
  art: `<path d="M8 142H342" class="rule"/>${columns}<text x="8" y="177" class="label">Latest year is year to date</text>`,
});

const now = new Date(`${today}T00:00:00Z`);
const start = new Date(now);
start.setUTCDate(start.getUTCDate() - now.getUTCDay() - 25 * 7);
const countsByDate = new Map(past.map(({ date, contributionCount }) => [date, contributionCount]));
const calendarCells = [];
const monthLabels = [];
let previousMonth;
let windowActiveDays = 0;
for (const day = new Date(start); day <= now; day.setUTCDate(day.getUTCDate() + 1)) {
  const i = calendarCells.length;
  const x = 35 + Math.floor(i / 7) * 11.8;
  const y = 60 + (i % 7) * 12;
  const count = countsByDate.get(day.toISOString().slice(0, 10)) ?? 0;
  windowActiveDays += Number(count > 0);
  const opacity = count >= 20 ? 1 : count >= 10 ? .75 : count >= 5 ? .53 : .32;
  calendarCells.push(`<rect x="${x.toFixed(1)}" y="${y}" width="9" height="9" class="${count ? 'bar' : 'empty'}" opacity="${count ? opacity : 1}"/>`);
  if (i % 7 === 0 && day.getUTCMonth() !== previousMonth) {
    previousMonth = day.getUTCMonth();
    if (x < 317 && (i > 0 || day.getUTCDate() <= 21)) monthLabels.push(`<text x="${x.toFixed(1)}" y="53" class="label">${day.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}</text>`);
  }
}
const legend = [.32, .53, .75, 1].map((opacity, i) => `<rect x="${272 + i * 11}" y="155" width="9" height="9" class="bar" opacity="${opacity}"/>`).join('');
diagram({
  file: 'contribution-calendar.svg', label: 'Contribution calendar', summary: `${fmt(activeDays)} active days total`,
  description: `Daily contributions over the last 26 calendar weeks. ${windowActiveDays} days had contributions. Stronger color indicates more contributions.`,
  art: `${monthLabels.join('')}${calendarCells.join('')}<text x="8" y="80" class="label">Mon</text><text x="8" y="104" class="label">Wed</text><text x="8" y="128" class="label">Fri</text><text x="8" y="164" class="label">${windowActiveDays} active days in this window</text><text x="245" y="164" class="label">Less</text>${legend}<text x="317" y="164" class="label">More</text>`,
});

function horizontalBars(rows) {
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return rows.map(([name, count], i) => {
    const y = 58 + 22 * i;
    return `<text x="8" y="${y}" class="label">${esc(name)}</text>
<rect x="102" y="${y - 9}" width="204" height="9" class="empty"/>
<rect x="102" y="${y - 9}" width="${(204 * count / max).toFixed(1)}" height="9" class="bar"/>
<text x="342" y="${y}" text-anchor="end" class="count">${fmt(count)}</text>`;
  }).join('\n');
}

const prRows = [
  ['Merged', base.user.mergedPRs.totalCount],
  ['Open', base.user.openPRs.totalCount],
  ['Closed', base.user.closedPRs.totalCount],
];
diagram({
  file: 'pull-requests-by-status.svg', label: 'Pull requests by status', summary: `${fmt(base.user.pullRequests.totalCount)} total`,
  description: prRows.map(([name, count]) => `${name}: ${count}`).join(', '),
  art: `${horizontalBars(prRows)}<text x="8" y="137" class="label">Closed counts pull requests that were never merged</text>`,
});

const languageCounts = new Map();
for (const repo of repos) {
  const name = repo.primaryLanguage?.name ?? 'Unclassified';
  languageCounts.set(name, (languageCounts.get(name) ?? 0) + 1);
}
const rankedLanguages = [...languageCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const languageRows = rankedLanguages.slice(0, 4);
if (rankedLanguages.length > 4) languageRows.push(['Other', rankedLanguages.slice(4).reduce((sum, [, count]) => sum + count, 0)]);
const repoCount = base.user.repositories.totalCount;
const repoScope = repos.length < repoCount ? `${fmt(repos.length)} of ${fmt(repoCount)} owned repos shown` : 'Owned repositories, excluding forks';
diagram({
  file: 'repositories-by-language.svg', label: 'Repositories by primary language', summary: `${fmt(repoCount)} total`,
  description: `${repoScope}. ${languageRows.map(([name, count]) => `${name}: ${count}`).join(', ')}`,
  art: `${horizontalBars(languageRows)}<text x="8" y="169" class="label">${repoScope}</text>`,
});

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
