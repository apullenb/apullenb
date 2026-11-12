// Profile graphics from GitHub activity.
// Usage: GITHUB_TOKEN=... node scoreboard.mjs <user> <scores.svg> <achievements.svg> <weapons.svg>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateSync } from 'node:zlib';

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

function profileGraphic(file, width, height, title, description, art) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title><desc id="desc">${esc(description)}</desc>
<style>
text{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums}
.ink{fill:#f3f0ff}.dim{fill:#a6abc6}.accent{fill:#80edce}.rule{stroke:#2e3652}
</style>
<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="15" fill="#111424" stroke="#303956"/>
${art}
</svg>`;
  writeFileSync(join(dirname(out), file), markup);
}

const todayUtc = new Date(`${today}T00:00:00Z`);
const mapStart = new Date(todayUtc);
mapStart.setUTCDate(mapStart.getUTCDate() - todayUtc.getUTCDay() - 52 * 7);
const countByDate = new Map(past.map(({ date, contributionCount }) => [date, contributionCount]));
const tiles3d = [];
let mapTotal = 0;
let mapPeak = 0;
for (const day = new Date(mapStart); day <= todayUtc; day.setUTCDate(day.getUTCDate() + 1)) {
  const date = day.toISOString().slice(0, 10);
  const count = countByDate.get(date) ?? 0;
  const week = Math.floor(tiles3d.length / 7);
  const weekday = day.getUTCDay();
  mapTotal += count;
  mapPeak = Math.max(mapPeak, count);
  tiles3d.push({ date, count, week, weekday, x: 77 + week * 12.55 - weekday * 8.1, y: 157 + week * 3.3 + weekday * 6.4 });
}

const weeklyContributions = Array(53).fill(0);
for (const { week, count } of tiles3d) weeklyContributions[week] += count;
const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const quarterHues = [259, 282, 321, 175];
const projectTile = ({ x, y, count, week, date }) => {
  const level = Math.log1p(count) / Math.log1p(Math.max(1, mapPeak));
  const h = count ? 5 + 58 * level : 0;
  const top = y - h;
  const hue = quarterHues[Math.min(3, Math.floor(week / 13.25))];
  const points = (offset) => [[x, top + offset], [x + 11.4, top + 3 + offset], [x + 4.1, top + 8.7 + offset], [x - 7.3, top + 5.7 + offset]];
  const polygon = (coords, fill) => `<polygon points="${coords.map(([a,b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}" fill="${fill}"/>`;
  const upper = points(0);
  const lower = points(h + 1.9);
  const fill = (light) => count ? `hsl(${hue},72%,${light}%)` : '#252e4a';
  const label = dayLabel.format(new Date(`${date}T00:00:00Z`));
  return `<g><title>${label} · ${fmt(count)} ${count === 1 ? 'contribution' : 'contributions'} · ${fmt(weeklyContributions[week])} this week</title>${polygon([upper[3], upper[2], lower[2], lower[3]], count ? fill(29 + 10 * level) : '#14192d')}${polygon([upper[2], upper[1], lower[1], lower[2]], count ? fill(43 + 11 * level) : '#1a2139')}${polygon(upper, fill(55 + 22 * level))}</g>`;
};
const blocks3d = [...tiles3d].sort((a,b) => a.y - b.y).map(projectTile).join('');
const monthTicks = [0, 13, 26, 39, 51].map((week) => {
  const tile = tiles3d[week * 7];
  if (!tile) return '';
  const x = tile.x - 48;
  const y = tile.y + 48;
  const label = new Date(`${tile.date}T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `<path d="M${x} ${y}l-5 5" stroke="#626c8b"/><text x="${x - 6}" y="${y + 16}" class="mono dim" font-size="11" text-anchor="middle">${label}</text>`;
}).join('');
const mapPeriod = `${tiles3d[0].date} to ${today}`;
profileGraphic('profile-contribution-map.svg', 760, 420, 'Contribution terrain', `${fmt(mapTotal)} GitHub contributions from ${mapPeriod}. Each tile is a day. Taller columns represent more contributions on a logarithmic scale.`, `
<defs><linearGradient id="edge"><stop stop-color="#a898ff"/><stop offset=".55" stop-color="#f68bca"/><stop offset="1" stop-color="#70ebd4"/></linearGradient></defs>
<path d="M20 88H740" stroke="url(#edge)" stroke-opacity=".62"/>
<text x="23" y="47" class="ink" font-size="32" font-weight="720" letter-spacing="-.7">Contribution terrain</text>
<text x="24" y="71" class="mono dim" font-size="12">${mapPeriod} · 53 calendar weeks</text>
<text x="736" y="47" text-anchor="end" class="mono accent" font-size="25" font-weight="700">${fmt(mapTotal)}</text>
<text x="736" y="69" text-anchor="end" class="mono dim" font-size="11">CONTRIBUTIONS</text>
${blocks3d}${monthTicks}
<text x="24" y="396" class="mono dim" font-size="11">One tile per day · Taller blocks show more contributions</text>
<path d="M24 406H736" class="rule"/>
`);

const overview = [
  ['Contributions', fmt(xp)], ['Active days', fmt(activeDays)],
  ['Best streak', `${fmt(longest)} days`], ['Pull requests opened', fmt(base.user.pullRequests.totalCount)],
  ['Repositories owned', fmt(base.user.repositories.totalCount)],
];
const portrait = inflateSync(Buffer.from('eNp1VkuO6zAM2/cUAYJs/DuADQO5UbZe+eyPpOQknTfj+bWdkJIoWva2/bVKKSkVW5+/n6p5zpyrlj//+YOupDZj5ONYrTVC8Dv9Biipttoyn8cTWHjSEcD+AgEAmcwZQ5jNkhEq682vcQSJET+9zyb+pudSasIBX/+DsQogIpBRVSSLpIi1+if1Z46E9cniWUbLVgxRDqwesNUvoERDNGo2XbcV8I4pJF58I2sGrPd4jesKHcl6qknafkG/gypmjj0c57kfxwhdCeCh8hs2fWMB7DHsggKMpfCzMcUFbkveH3HR776gjh5XCDGbUE3Z028EvwMXBo5znD/AY5XemKvQHvoNThXNaa/AK3Gim0Kr1tQ88a/QjFyjRx74etChZ1ZtDZOJzZlveJ1QFyoHS/gVnYUzpjUNr1z0Nxya9RxHR4P6uNel1QmX4r6H7E167VFq3mcPNc7UgpDolRzOb+FbcoJ2E3y+dT/Oiz3K0pv7AngQwe7Urln1looI3gmw/uvc4TJ80W1oYwxViSGT6hWkZbpU688KJhLYpRl+U/TeAw1LK74IPAUxPASoAHt5t86fh0kX1upsoMV1hiYjvxxABeBaxr/2Xdo/bXDvJt8tTD/5RlwExYaopD9Iw7jDXMRiQJDKvWXaUvQlAiTAcEgBGl6HgqIL4VoZiOFl/dWFL4qKsVa3OADjjkf3O9K43MVwqMuXm2WzNLnr4DjF1LgOZsC4+DIprSOgILQ6h0nyRWEHxHWex8Ukrs4FrDfipkj1yWMNUT93uJNjHKSYNZgWBIJHL60SlK39rFlafC612xWaYePc4Ykx2ziWG5YzFkexuVBdXc5wS/DjiXAW7FyXqXITMKUsLxiJ741VD11vJDmHfUAM0Txbm/2JNpO5PT0Tn6j2prmucpelbjTHpcYEbfOpU0VjqSQnURY8BP28IAkNNo1GA4r7rGt38x881XVCLRI/s60sJKTuFI4/HmOw5iVhKErMxW4RqgirrVGlJJKXBQaU8uElwqcgRvZwjquDZCtNJJRmulntR8dWchZJgpe6GKDWYVMbHHVNM3o/riOn+gSUZTR50k3CUcAP56nxAXFi2b5Y5DBzqMYoU1HXVc1WynN3GDaB0Jhmm4ED0F1fV2/sglL433TfzfiHpZQtnotkludko+9jdJJktyHlYDe8dJPw7dZQi8uaX3eXYMava47aWVbulZKTbCTkPDZdQ3uNaSPRfpEafp49LCsT8oR1GoOkbuW5DZEl8haYfP/W+s7EN7E44s1BkuLdQTlWD4ZmcZ+rR+k/iq1hlhxWi/LYij43CswT+bW53e3b8/ehVrY69udYDj2JmS3M1uCeKcV9QfHBXNKdRAz2nO96ZSCHgCFnnbJJjrBpJodu/PUPtSCK2w==', 'base64')).toString('ascii').split('\n');
const asciiRamp = ' .,:;-~+=*ox%#@';
const tones = ['#151829','#56658d','#6476a4','#7587b6','#8997c5','#9da9d0','#aeb5d9','#bebce0','#cbc2e4','#dbc9e2','#e4cde1','#ecd3e5','#f3dce8','#f9e7ef','#fff1f4'];
const face = portrait.map((line, row) => {
  const chars = [...line].flatMap((char, col) => char === ' ' ? [] : [`<tspan x="${(12 + col * 5.95).toFixed(1)}" fill="${tones[asciiRamp.indexOf(char)]}">${char}</tspan>`]).join('');
  return `<text y="${(16 + row * 9.15).toFixed(1)}">${chars}</text>`;
}).join('');
profileGraphic('profile-ascii-large.svg', 430, 465, 'Andrea Pullen in ASCII', 'Large ASCII portrait of Andrea Pullen based on her GitHub avatar.', `
<g class="mono" font-size="10">${face}</g>
`);

const intro = 'I build full-stack TypeScript apps and look for ways AI can make them more useful.';
const aiWork = [
  'I work on features that generate images, interpret visual inputs,',
  'and turn model responses into structured data.',
];
const workflowSteps = [
  ['Draft', 'The model produces an initial result', '#a9a3ff'],
  ['Verify', 'Tested code checks the output', '#80edce'],
  ['Approve', 'A person signs off before release', '#ffc49b'],
];
const workflowArt = workflowSteps.map(([label, detail, color], i) => {
  const x = 23 + i * 244;
  return `<rect x="${x}" y="149" width="226" height="47" rx="7" fill="#1b2037" stroke="#343d5b"/>
<text x="${x + 12}" y="168" class="mono" fill="${color}" font-size="13" font-weight="700">${label}</text>
<text x="${x + 12}" y="185" class="dim" font-size="11">${detail}</text>
${i < 2 ? `<path d="M${x + 230} 173h10m-4-4 4 4-4 4" fill="none" stroke="#a6abc6"/>` : ''}`;
}).join('');
const introDescription = [intro, ...aiWork, 'For outputs that need review, the model drafts, tested code checks the output, and a person approves it.'].join(' ');
profileGraphic('profile-ai-intro.svg', 760, 214, 'What I build', introDescription, `
<text x="23" y="29" class="mono accent" font-size="13" font-weight="700">$ what-i-build</text>
<path d="M23 39H737" class="rule"/>
<text x="23" y="66" class="ink" font-size="17" font-weight="650">${intro}</text>
<text x="23" y="90" class="dim" font-size="15">${aiWork[0]}</text>
<text x="23" y="111" class="dim" font-size="15">${aiWork[1]}</text>
<text x="23" y="136" class="mono dim" font-size="11">FOR AI OUTPUTS THAT NEED REVIEW</text>
${workflowArt}
`);

const terminalRows = overview.map(([label, value], i) => {
  const y = 81 + i * 31;
  return `<text x="19" y="${y}" class="mono dim" font-size="12">${label}</text><text x="185" y="${y}" class="mono ink" font-size="15" text-anchor="end">${value}</text>`;
}).join('');
const weeklyTotals = Array(12).fill(0);
for (const { week, count } of tiles3d) {
  if (week >= 41) weeklyTotals[week - 41] += count;
}
const weeklyPeak = Math.max(1, ...weeklyTotals);
const wavePoints = weeklyTotals.map((count, index) => [211 + index * 8, 170 - 74 * count / weeklyPeak]);
const wave = wavePoints.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L');
const [endX, endY] = wavePoints.at(-1);
const weeklyTotal = weeklyTotals.reduce((sum, count) => sum + count, 0);
profileGraphic('profile-github-stats-compact.svg', 320, 270, 'GitHub stats', overview.map(([label, value]) => `${label}: ${value}`).join(', ') + `. ${fmt(weeklyTotal)} contributions over the last 12 calendar weeks.`, `
<defs><linearGradient id="signal" x2="0" y2="1"><stop stop-color="#80edce" stop-opacity=".31"/><stop offset="1" stop-color="#80edce" stop-opacity="0"/></linearGradient></defs>
<path d="M1 44H319M198 63V222M19 235H301" class="rule"/>
<text x="19" y="28" class="mono accent" font-size="14" font-weight="700">&gt; GitHub stats</text>
<text x="301" y="28" class="mono dim" font-size="11" text-anchor="end">ALL TIME</text>
${terminalRows}
<text x="211" y="81" class="mono dim" font-size="10">12 WEEKS</text>
<path d="M211 96H299M211 121H299M211 146H299M211 171H299" class="rule" stroke-dasharray="2 4"/>
<path d="M${wave} L${endX} 171 H211Z" fill="url(#signal)"/>
<path d="M${wave}" fill="none" stroke="#80edce" stroke-width="2" stroke-linejoin="round"/>
<circle cx="${endX}" cy="${endY.toFixed(1)}" r="3" fill="#80edce"/>
<text x="211" y="202" class="mono accent" font-size="17" font-weight="700">${fmt(weeklyTotal)}</text>
<text x="211" y="220" class="mono dim" font-size="10">CONTRIBUTIONS</text>
<text x="19" y="254" class="mono dim" font-size="10">Repository count excludes forks</text>
`);

const primaryLanguages = new Map();
for (const repo of repos) {
  const name = repo.primaryLanguage?.name ?? 'Unclassified';
  primaryLanguages.set(name, (primaryLanguages.get(name) ?? 0) + 1);
}
const ranked = [...primaryLanguages].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const spectrum = ranked.slice(0, 4);
if (ranked.length > 4) spectrum.push(['Other', ranked.slice(4).reduce((sum,[,count]) => sum + count, 0)]);
const colors = ['#9f9bff','#67dbc5','#ef91bc','#ffc484','#8097c8'];
const circumference = 2 * Math.PI * 45;
let ringOffset = 0;
const ring = spectrum.map(([, count], i) => {
  const length = circumference * count / repos.length;
  const segment = `<circle cx="81" cy="113" r="45" fill="none" stroke="${colors[i]}" stroke-width="14" stroke-dasharray="${Math.max(0,length - 2)} ${circumference}" stroke-dashoffset="${-ringOffset}" transform="rotate(-90 81 113)"/>`;
  ringOffset += length;
  return segment;
}).join('');
const languageLegend = spectrum.map(([label,count], i) => {
  const y = 78 + i * 21;
  return `<rect x="155" y="${y - 8}" width="8" height="8" rx="2" fill="${colors[i]}"/><text x="172" y="${y}" class="mono dim" font-size="12">${esc(label)}</text><text x="349" y="${y}" class="mono ink" font-size="12" text-anchor="end">${fmt(count)}</text>`;
}).join('');
const repoSample = repos.length < base.user.repositories.totalCount ? `${fmt(repos.length)} repositories sampled` : 'One primary language per owned repo';
profileGraphic('profile-language-spectrum.svg', 370, 218, 'Language mix', spectrum.map(([label,count]) => `${label}: ${count}`).join(', ') + '. ' + repoSample, `
<path d="M1 42H369M18 190H352" class="rule"/>
<text x="18" y="27" class="mono accent" font-size="14" font-weight="700">&gt; Language mix</text>
<text x="350" y="27" class="mono dim" font-size="11" text-anchor="end">BY REPOSITORY</text>
<circle cx="81" cy="113" r="45" fill="none" stroke="#292f49" stroke-width="14"/>${ring}
<text x="81" y="119" class="mono ink" font-size="21" text-anchor="middle">${fmt(repos.length)}</text>
<text x="81" y="137" class="mono dim" font-size="10" text-anchor="middle">REPOS</text>
${languageLegend}<text x="18" y="207" class="mono dim" font-size="10">${repoSample}</text>
`);

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
