from http.server import BaseHTTPRequestHandler
import json, base64, io, os
from PIL import Image, ImageDraw, ImageFont

# ── PAGE DIMENSIONS ──────────────────────────────────────────────────────────
DPI     = 250
PW      = int(11  * DPI)    # 2750
PH      = int(8.5 * DPI)    # 2125
CARD_H  = PH // 2            # 1062
BLANK_H = int(1.75 * DPI)   # 437

# ── COLORS ───────────────────────────────────────────────────────────────────
GOLD    = (244, 236, 211)    # #f4ecd3
BLACK   = (0,   0,   0)
WHITE   = (255, 255, 255)
GRAY    = (80,  80,  80)
LT_GRAY = (180, 180, 180)

# ── COLUMN LAYOUT ────────────────────────────────────────────────────────────
NAME_W  = int(1.1 * DPI)
N_DC    = 24   # H1-9, OUT, INT, H10-18, IN, TOT, HDP, NET  (no PUTTS)
DC_W    = (PW - NAME_W) // N_DC
TABLE_R = NAME_W + N_DC * DC_W

DCOL = {**{h: h for h in range(1, 10)},
        'OUT': 10, 'INT': 11,
        **{h: h + 2 for h in range(10, 19)},
        'IN': 21, 'TOT': 22, 'HDP': 23, 'NET': 24}

def clx(k): return NAME_W + (DCOL[k] - 1) * DC_W
def crx(k): return NAME_W +  DCOL[k]      * DC_W
def ccx(k): return clx(k) + DC_W // 2

HDR_H = int(0.148 * DPI)
SCR_H = int(0.300 * DPI)

# ── FONTS (bundled Liberation + DejaVu available on Vercel Linux) ─────────────
NARROW = '/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf'
DEJAVU = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def fnt(path, size):
    try:    return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

F18 = fnt(NARROW, 18)
F24 = fnt(NARROW, 24)
F17 = fnt(NARROW, 17)
FSY = fnt(DEJAVU,  14)
FLD = fnt(DEJAVU,  24)

# ── TEXT HELPERS ──────────────────────────────────────────────────────────────
def bbox(draw, txt, font):
    b = draw.textbbox((0, 0), txt, font=font)
    return b[2]-b[0], b[3]-b[1], b[0], b[1]

def tc(draw, txt, cx, cy, font, color=BLACK):
    w, h, x0, y0 = bbox(draw, txt, font)
    draw.text((cx - w//2 - x0, cy - h//2 - y0), txt, font=font, fill=color)

def tl(draw, txt, x, cy, font, color=BLACK, pad=8):
    _, h, x0, y0 = bbox(draw, txt, font)
    draw.text((x + pad - x0, cy - h//2 - y0), txt, font=font, fill=color)

def tr(draw, txt, rx, cy, font, color=BLACK, pad=8):
    w, h, x0, y0 = bbox(draw, txt, font)
    draw.text((rx - w - pad - x0, cy - h//2 - y0), txt, font=font, fill=color)

def get_strokes(hdcp, si):
    if hdcp < si: return 0
    return 2 if (hdcp > 18 and si <= hdcp - 18) else 1

def draw_dots(draw, n, hole, row_top):
    r, pad = 5, 7
    rx = crx(hole)
    cy = row_top + pad + r
    if n == 1:
        cx = rx - pad - r
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=BLACK)
    elif n == 2:
        cx2 = rx - pad - r
        cx1 = cx2 - 2*r - 3
        for cx in (cx1, cx2):
            draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=BLACK)

def draw_card(draw, group, card_top, course, event_config):
    PAR = course['par_per_hole']
    SI  = course['stroke_index']
    LD  = event_config.get('long_drive_hole')
    CTP = event_config.get('ctp_holes') or []

    players   = group['players']
    tee_names = list({p['tee'] for p in players})

    # Map tee name → yardage list from course.tees
    tee_map = {t['name'].upper(): t for t in course['tees']}

    ty = card_top + BLANK_H

    rows, y = [], ty
    rows.append(('HDR', y, HDR_H)); y += HDR_H
    for tee in tee_names:
        rows.append((tee, y, HDR_H)); y += HDR_H
    rows.append(('PAR',  y, HDR_H)); y += HDR_H
    rows.append(('HDCP', y, HDR_H)); y += HDR_H
    for pi in range(len(players)):
        rows.append(('SCR', y, SCR_H, pi)); y += SCR_H
    table_bot = y

    # Gold LD column fill
    if LD and LD in DCOL:
        gx = clx(LD)
        draw.rectangle([gx, ty, gx + DC_W, table_bot], fill=GOLD)

    for row in rows:
        rtype, ry, rh = row[0], row[1], row[2]
        cy = ry + rh // 2

        if rtype == 'HDR':
            tl(draw, 'HOLE', 0, cy, F18)
            for h in range(1, 10): tc(draw, str(h), ccx(h), cy, F18)
            tc(draw, 'OUT', ccx('OUT'), cy, F18)
            tc(draw, 'INT', ccx('INT'), cy, F18)
            for h in range(10, 19):
                txt = f'\u2605{h}' if h == LD else str(h)
                fuse = FSY if h == LD else F18
                tc(draw, txt, ccx(h), cy, fuse)
            tc(draw, 'IN',  ccx('IN'),  cy, F18)
            tc(draw, 'TOT', ccx('TOT'), cy, F18)
            tc(draw, 'HDP', ccx('HDP'), cy, F18)
            tc(draw, 'NET', ccx('NET'), cy, F18)

        elif rtype in tee_names:
            tee_data = tee_map.get(rtype.upper())
            if not tee_data: continue
            yds = tee_data['yardages']
            label = f"{rtype}  {tee_data['rating']}/{tee_data['slope']}"
            tl(draw, label, 0, cy, F18)
            for h in range(1, 10):  tc(draw, str(yds[h-1]),     ccx(h),     cy, F18)
            tc(draw, str(sum(yds[:9])),  ccx('OUT'), cy, F18)
            for h in range(10, 19): tc(draw, str(yds[h-1]),     ccx(h),     cy, F18)
            tc(draw, str(sum(yds[9:])),  ccx('IN'),  cy, F18)
            tc(draw, str(sum(yds)),      ccx('TOT'), cy, F18)

        elif rtype == 'PAR':
            tl(draw, 'PAR', 0, cy, F18)
            for h in range(1, 10):  tc(draw, str(PAR[h-1]),       ccx(h),     cy, F18)
            tc(draw, str(sum(PAR[:9])),  ccx('OUT'), cy, F18)
            for h in range(10, 19): tc(draw, str(PAR[h-1]),       ccx(h),     cy, F18)
            tc(draw, str(sum(PAR[9:])),  ccx('IN'),  cy, F18)
            tc(draw, str(sum(PAR)),      ccx('TOT'), cy, F18)

        elif rtype == 'HDCP':
            tl(draw, 'HDCP', 0, cy, F18)
            for h in range(1, 10):  tc(draw, str(SI[h-1]), ccx(h), cy, F18)
            for h in range(10, 19): tc(draw, str(SI[h-1]), ccx(h), cy, F18)

        elif rtype == 'SCR':
            pi = row[3]
            p  = players[pi]
            hdcp = p['course_handicap']
            dcy  = ry + SCR_H // 2
            label = f"{p['name']} ({p['flight']})"
            tl(draw, label, 0, dcy, F24, BLACK, pad=10)
            parts    = p['name'].split()
            initials = (parts[0][0] + parts[-1][0]).upper() if len(parts) > 1 else p['name'][:2].upper()
            tc(draw, initials,   ccx('INT'), dcy, F24, BLACK)
            tc(draw, str(hdcp),  ccx('HDP'), dcy, F24)
            for h in range(1, 19):
                s = get_strokes(hdcp, SI[h-1])
                if s: draw_dots(draw, s, h, ry)

    # Grid lines
    thick = {DCOL['OUT'], DCOL['INT'], DCOL['IN']}
    for row in rows:
        draw.line([0, row[1], TABLE_R, row[1]], fill=BLACK, width=1)
    draw.line([0, table_bot, TABLE_R, table_bot], fill=BLACK, width=2)
    draw.line([NAME_W, ty, NAME_W, table_bot], fill=BLACK, width=2)
    for i in range(1, N_DC + 1):
        x  = NAME_W + i * DC_W
        lw = 2 if i in thick else 1
        draw.line([x, ty, x, table_bot], fill=BLACK, width=lw)
    draw.rectangle([0, ty, TABLE_R, table_bot], outline=BLACK, width=2)

    # Group info strip
    event_name = event_config.get('name', '')
    event_date = event_config.get('date', '')
    info = f"Group {group['num']}   |   {group['time']}   |   {event_name} \u2014 {event_date}"
    tc(draw, info, PW // 2, ty - 22, F24)

    # Contest block (right-aligned)
    contest_y = table_bot + 35
    if CTP:
        holes_str = ', '.join(f'#{h}' for h in CTP)
        tr(draw, f'Closest to Pin - Holes {holes_str}', TABLE_R, contest_y, FLD, BLACK, pad=12)
        contest_y += 34
    if LD:
        tr(draw, f'Long Drive - Hole #{LD}', TABLE_R, contest_y, FLD, BLACK, pad=12)

    # Footer
    fpad = int(PW * 0.04)
    llen = 3 * DC_W
    fcy  = table_bot + 100
    tl(draw, 'Date:', fpad, fcy, F17, pad=0)
    dw, _, _, _ = bbox(draw, 'Date:', F17)
    lx = fpad + dw + 10
    draw.line([lx, fcy + 12, lx + llen, fcy + 12], fill=GRAY, width=2)
    ax = lx + llen + 60
    tl(draw, 'Attest:', ax, fcy, F17, pad=0)
    aw, _, _, _ = bbox(draw, 'Attest:', F17)
    lx2 = ax + aw + 10
    draw.line([lx2, fcy + 12, lx2 + llen, fcy + 12], fill=GRAY, width=2)


def generate_pages(groups, course, event_config):
    """Returns list of base64-encoded PNG strings, 2 groups per page."""
    pages = []
    for i in range(0, len(groups), 2):
        img  = Image.new('RGB', (PW, PH), WHITE)
        draw = ImageDraw.Draw(img)
        x = 0
        while x < PW:
            draw.line([x, CARD_H, min(x + 20, PW), CARD_H], fill=LT_GRAY, width=2)
            x += 32
        draw_card(draw, groups[i],     0,       course, event_config)
        if i + 1 < len(groups):
            draw_card(draw, groups[i + 1], CARD_H, course, event_config)
        buf = io.BytesIO()
        img.save(buf, format='PNG', dpi=(DPI, DPI))
        pages.append(base64.b64encode(buf.getvalue()).decode('utf-8'))
    return pages


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length  = int(self.headers.get('Content-Length', 0))
        body    = json.loads(self.rfile.read(length))

        groups       = body['groups']
        course       = body['course']
        event_config = body['event_config']

        pages = generate_pages(groups, course, event_config)

        response = json.dumps({'pages': pages}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(response))
        self.end_headers()
        self.wfile.write(response)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
