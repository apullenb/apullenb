# Pixel-art avatar: long light-brown hair, brown eyes, burgundy top, waving.
W, H = 32, 40
PAL = {
    'K': '#1A1A1A', 'H': '#C59B5A', 'h': '#9C7440', 'L': '#DDB879', 'S': '#F5B78E',
    's': '#E29A72', 'b': '#EE9C86', 'E': '#3B2416', 'W': '#FFFFFF', 'M': '#7A1020',
    'B': '#2A1A12', 'R': '#7C1424', 'r': '#5E0F1B', 'J': '#2F4A6E',
}


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        g[y][x] = c


def ellipse(g, cx, cy, rx, ry, c):
    for y in range(H):
        for x in range(W):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                g[y][x] = c


def rect(g, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(g, x, y, c)


def body(arm_up):
    g = blank()
    # long hair behind
    ellipse(g, 16, 13, 10.5, 11, 'H')
    rect(g, 6, 14, 10, 31, 'H')
    rect(g, 22, 14, 26, 31, 'H')
    for x, y in [(6, 32), (8, 32), (10, 32), (22, 32), (24, 32), (26, 32), (7, 33), (25, 33)]:
        put(g, x, y, 'H')
    for y in range(16, 31, 3):
        put(g, 8, y, 'h'); put(g, 24, y, 'h')
    # shadow behind neck
    rect(g, 11, 20, 21, 27, 'h')
    # shirt and neck
    rect(g, 10, 27, 22, 39, 'R')
    rect(g, 9, 29, 9, 39, 'R'); rect(g, 23, 29, 23, 39, 'R')
    rect(g, 14, 23, 18, 26, 'S')
    for i in range(3):
        rect(g, 14 + i, 27 + i, 18 - i, 27 + i, 'S')  # V-neck
    rect(g, 10, 35, 22, 35, 'r')
    # face
    ellipse(g, 16, 15.5, 7, 8, 'S')
    # bangs with side part
    rect(g, 9, 6, 23, 8, 'H')
    rect(g, 9, 9, 12, 10, 'H'); rect(g, 19, 9, 23, 11, 'H')
    rect(g, 9, 11, 9, 16, 'H'); rect(g, 23, 12, 23, 16, 'H')
    for x in range(12, 20):
        put(g, x, 5, 'L')
    put(g, 14, 6, 'L'); put(g, 15, 6, 'L'); put(g, 20, 7, 'h'); put(g, 21, 8, 'h')
    # brows, eyes, cheeks, mouth
    rect(g, 11, 12, 13, 12, 'B'); rect(g, 18, 12, 20, 12, 'B')
    for ex in (11, 18):
        rect(g, ex, 14, ex + 2, 15, 'E')
        put(g, ex + 1, 14, 'W')
        put(g, ex - 1, 13, 'K') if ex == 11 else put(g, ex + 3, 13, 'K')
    put(g, 16, 17, 's')
    rect(g, 10, 18, 11, 18, 'b'); rect(g, 21, 18, 22, 18, 'b')
    put(g, 13, 19, 'K'); rect(g, 14, 19, 18, 19, 'W'); put(g, 19, 19, 'K')
    put(g, 14, 20, 'K'); rect(g, 15, 20, 17, 20, 'M'); put(g, 18, 20, 'K'); rect(g, 15, 21, 17, 21, 'K')
    # waving arm (viewer's left), outlined against the hair
    if arm_up:
        path = [(8, 28), (7, 27), (6, 26), (5, 25), (5, 24), (4, 23), (4, 22), (3, 21)]
        hx, hy = 1, 15
    else:
        path = [(8, 28), (7, 27), (6, 26), (6, 25), (5, 24), (5, 23), (5, 22), (5, 21)]
        hx, hy = 3, 15
    arm = set()
    for x, y in path:
        arm |= {(x, y), (x + 1, y)}
    arm |= {(hx + i, hy + j) for i in range(4) for j in range(1, 5)}
    arm |= {(hx + i, hy) for i in (0, 1, 2, 3)} | {(hx + 4, hy + 3)}
    for x, y in arm:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in arm and 0 <= n[0] < W and 0 <= n[1] < H and g[n[1]][n[0]] in 'Hh':
                put(g, *n, 'K')
    for x, y in arm:
        put(g, x, y, 'S')
    for i in (1, 2):
        put(g, hx + i, hy, 'K')  # finger gaps
    rect(g, 8, 28, 10, 30, 'R'); put(g, 7, 28, 'R')  # sleeve
    return g


def outline(g):
    o = [row[:] for row in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] == '.':
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and g[ny][nx] != '.':
                        o[y][x] = 'K'
                        break
    return o


def rects(g, px, ox=0, oy=0):
    out = []
    for y, row in enumerate(g):
        x = 0
        while x < W:
            c = row[x]
            if c == '.':
                x += 1
                continue
            x2 = x
            while x2 + 1 < W and row[x2 + 1] == c:
                x2 += 1
            out.append(f'<rect x="{ox + x * px}" y="{oy + y * px}" width="{(x2 - x + 1) * px}" height="{px}" fill="{PAL[c]}"/>')
            x = x2 + 1
    return ''.join(out)


def frames(px, ox=0, oy=0):
    """Two waving frames; caller adds CSS classes f1/f2."""
    return (f'<g class="f1">{rects(outline(body(True)), px, ox, oy)}</g>'
            f'<g class="f2">{rects(outline(body(False)), px, ox, oy)}</g>')


WAVE_CSS = ('.f1{animation:f1 .8s steps(1) infinite}.f2{animation:f2 .8s steps(1) infinite}'
            '@keyframes f1{50%{opacity:0}}@keyframes f2{0%{opacity:0}50%{opacity:1}}')
