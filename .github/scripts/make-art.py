import base64, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from avatar import frames, WAVE_CSS
out = sys.argv[1]
F = base64.b64encode(open(sys.argv[2],'rb').read()).decode()
FONT = f"@font-face{{font-family:'PS2P';src:url(data:font/woff2;base64,{F}) format('woff2');}}"
BG, Y, C, M, G, W = '#0B0B1A', '#FFD300', '#2DE2E6', '#FF3864', '#39FF14', '#F5F5F5'

def esc(s): return s.replace('&','&amp;').replace('<','&lt;')

random.seed(7)
stars = ''.join(f'<rect x="{random.randrange(0,900)}" y="{random.randrange(0,250)}" width="{random.choice([2,2,3,4])}" height="{random.choice([2,2,3,4])}" fill="{random.choice([W,C,Y,M])}" class="tw" style="animation-delay:{random.random()*3:.2f}s"/>' for _ in range(70))
# contribution-style pixel ground
tiles = ''
gp = ['#0E4429','#006D32','#26A641','#39D353','#161B22']
for i in range(0, 900, 12):
    for r in range(2):
        tiles += f'<rect x="{i}" y="{232+r*12}" width="10" height="10" fill="{random.choice(gp)}"/>'

title = f'''<svg xmlns="http://www.w3.org/2000/svg" width="900" height="260" viewBox="0 0 900 260" role="img" aria-label="Andrea Pullen, full-stack developer. Press start.">
<style>{FONT}
text{{font-family:'PS2P',monospace}}
.tw{{animation:tw 2.4s steps(2) infinite}}
@keyframes tw{{50%{{opacity:.15}}}}
.blink{{animation:bl 1.1s steps(1) infinite}}
@keyframes bl{{50%{{opacity:0}}}}
.scroll{{animation:sc 6s linear infinite}}
{WAVE_CSS}
@keyframes sc{{from{{transform:translateX(0)}}to{{transform:translateX(-24px)}}}}
</style>
<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity=".28"/></pattern></defs>
<rect width="900" height="260" fill="{BG}"/>
{stars}
<text x="24" y="30" font-size="12" fill="{M}">1UP</text>
<text x="450" y="30" font-size="12" fill="{W}" text-anchor="middle">HI-SCORE</text>
<text x="660" y="30" font-size="12" fill="{C}" text-anchor="end">2026</text>
<text x="384" y="104" font-size="44" fill="{M}" text-anchor="middle">ANDREA PULLEN</text>
<text x="380" y="100" font-size="44" fill="{Y}" text-anchor="middle">ANDREA PULLEN</text>
<text x="380" y="140" font-size="16" fill="{C}" text-anchor="middle">FULL-STACK TYPESCRIPT DEVELOPER</text>
<text x="380" y="188" font-size="18" fill="{G}" text-anchor="middle" class="blink">PRESS START</text>
<text x="380" y="216" font-size="10" fill="{W}" opacity=".7" text-anchor="middle">© 2020-2026 APULLENB   1 PLAYER</text>
<g class="scroll">{tiles}</g>
{frames(6, 724, 22)}
<rect width="900" height="260" fill="url(#scan)"/>
</svg>'''
open(os.path.join(out,'title.svg'),'w').write(title)


banners = {
 'player':   ('PLAYER SELECT', C),
 'items':    ('ITEMS &amp; POWER-UPS'.replace('&amp;','&'), G),
 'scores':   ('PLAYER STATS', M),
 'play':     ('YOUR TURN: TIC-TAC-TOE', Y),
 'arcade':   ('ARCADE: PICK A CABINET', C),
 'quests':   ('QUEST LOG', G),
}
for k,(label,col) in banners.items():
    w = 900
    pips = ''.join(f'<rect x="{x}" y="22" width="8" height="8" fill="{col}" opacity="{0.25+0.75*((x//12)%3==0)}"/>' for x in range(len(label)*16+70, w-16, 12))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="52" viewBox="0 0 {w} 52" role="img" aria-label="{esc(label)}">
<style>{FONT}text{{font-family:'PS2P',monospace}}.bl{{animation:bl 1s steps(1) infinite}}@keyframes bl{{50%{{opacity:0}}}}</style>
<rect width="{w}" height="52" rx="0" fill="{BG}"/>
<rect x="0" y="0" width="{w}" height="4" fill="{col}"/><rect x="0" y="48" width="{w}" height="4" fill="{col}" opacity=".35"/>
<text x="16" y="34" font-size="16" fill="{col}" class="bl">&#9654;</text>
<text x="44" y="34" font-size="16" fill="#F5F5F5">{esc(label)}</text>
{pips}
</svg>'''
    open(os.path.join(out,f'banner-{k}.svg'),'w').write(svg)
# tic-tac-toe tiles
def tile(inner, label):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88" role="img" aria-label="{label}">
<style>{FONT}text{{font-family:'PS2P',monospace}}.bl{{animation:bl 1.2s steps(1) infinite}}@keyframes bl{{50%{{opacity:.35}}}}</style>
<rect width="88" height="88" fill="{BG}"/><rect x="3" y="3" width="82" height="82" fill="none" stroke="#2A2A4A" stroke-width="6"/>{inner}</svg>'''
def pix(cells, col):
    return ''.join(f'<rect x="{14+x*10}" y="{14+y*10}" width="10" height="10" fill="{col}"/>' for x,y in cells)
X=[(i,i) for i in range(7)]+[(6-i,i) for i in range(7)]
O=[(x,y) for x in range(7) for y in range(7) if (x in (0,6) and 1<=y<=5) or (y in (0,6) and 1<=x<=5)]
open(os.path.join(out,'ttt-x.svg'),'w').write(tile(pix(X,M),'X'))
open(os.path.join(out,'ttt-o.svg'),'w').write(tile(pix(O,Y),'O'))
open(os.path.join(out,'ttt-off.svg'),'w').write(tile('','empty'))
for n in range(1,10):
    open(os.path.join(out,f'ttt-{n}.svg'),'w').write(tile(f'<text x="44" y="54" font-size="22" fill="{C}" text-anchor="middle" class="bl">{n}</text>',f'Square {n}: play here'))
print('ok')
