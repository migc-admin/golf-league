from http.server import BaseHTTPRequestHandler
import json, base64, io, os
from PIL import Image, ImageDraw, ImageFont
import qrcode

# ── PAGE DIMENSIONS — 300 DPI, 1 group per page (full 11×8.5") ───────────────
DPI     = 300
PW      = int(11  * DPI)    # 3300
PH      = int(8.5 * DPI)    # 2550
BLANK_H = int(1.5 * DPI)    # 450 — banner strip (QR + event info)

# ── COLORS ───────────────────────────────────────────────────────────────────
GOLD    = (244, 236, 211)
BLACK   = (0,   0,   0)
WHITE   = (255, 255, 255)
GRAY    = (80,  80,  80)
LT_GRAY = (180, 180, 180)

# ── COLUMN LAYOUT ────────────────────────────────────────────────────────────
NAME_W  = int(2.6 * DPI)          # 780 — wide enough for long names at 42pt
N_DC    = 24
DC_W    = (PW - NAME_W) // N_DC   # ~106
TABLE_R = NAME_W + N_DC * DC_W

DCOL = {**{h: h for h in range(1, 10)},
        'OUT': 10, 'INT': 11,
        **{h: h + 2 for h in range(10, 19)},
        'IN': 21, 'TOT': 22, 'HDP': 23, 'NET': 24}

def clx(k): return NAME_W + (DCOL[k] - 1) * DC_W
def crx(k): return NAME_W +  DCOL[k]      * DC_W
def ccx(k): return clx(k) + DC_W // 2

# Row heights — 1.75× the original 250 DPI sizes
HDR_H = 131   # was 75
SCR_H = 184   # was 105

# ── FONTS — 1.75× original pt sizes at 300 DPI ───────────────────────────────
# px = pt × DPI/72  |  18pt×1.75=31.5pt → 131px  |  24pt×1.75=42pt → 175px
NARROW = '/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf'
DEJAVU = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def fnt(path, size):
    try:    return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

F18 = fnt(NARROW, 131)  # ~31pt — headers, yardages, par, hdcp
F24 = fnt(NARROW, 175)  # ~42pt — player names
F17 = fnt(NARROW, 121)  # ~29pt — footer labels
FSY = fnt(DEJAVU,   90)  # ~22pt — LD star symbol
FLD = fnt(DEJAVU,  133)  # ~32pt — contest footer text

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
    r, pad = 7, 10
    rx = crx(hole)
    cy = row_top + pad + r
    if n == 1:
        cx = rx - pad - r
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=BLACK)
    elif n == 2:
        cx2 = rx - pad - r
        cx1 = cx2 - 2*r - 4
        for cx in (cx1, cx2):
            draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=BLACK)

def draw_card(img, draw, group, card_top, course, event_config):
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

    # ── Banner area (BLANK_H strip above the table) ─────────────────
    event_name  = event_config.get('name', '')
    event_date  = event_config.get('date', '')
    scoring_url = group.get('scoring_url', '')
    group_code  = group.get('code', '')

    banner_cy = card_top + BLANK_H // 2  # vertical center of banner

    # QR code — left-aligned in banner if URL is available
    QR_SIZE = int(BLANK_H * 0.88)   # slightly smaller than strip height
    qr_x    = int(0.25 * DPI)       # left margin
    qr_right = qr_x                  # updated below if QR is drawn

    if scoring_url:
        qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=1)
        qr.add_data(scoring_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color='black', back_color='white').convert('RGB')
        qr_img = qr_img.resize((QR_SIZE, QR_SIZE), Image.LANCZOS)
        qr_top = card_top + (BLANK_H - QR_SIZE) // 2
        img.paste(qr_img, (qr_x, qr_top))
        qr_right = qr_x + QR_SIZE

        # Group code text centered below the QR
        if group_code:
            code_font  = fnt(NARROW, 59)   # ~17pt — fits under QR
            code_label = f'Access Code: {group_code}'
            cw, ch, cx0, cy0 = bbox(draw, code_label, code_font)
            code_cx = qr_x + QR_SIZE // 2
            code_y  = qr_top + QR_SIZE + 10
            draw.text((code_cx - cw // 2 - cx0, code_y - cy0), code_label, font=code_font, fill=BLACK)

    # Event + group info — centered in the portion to the right of the QR
    text_cx = qr_right + (PW - qr_right) // 2
    group_line = f"Group {group['num']}   ·   {group['time']}"
    event_line = f"{event_name}  —  {event_date}"
    tc(draw, group_line, text_cx, banner_cy - 55, F24)
    tc(draw, event_line, text_cx, banner_cy + 55, F18)

    # Contest block (right-aligned, below table)
    contest_y = table_bot + 50
    if CTP:
        holes_str = ', '.join(f'#{h}' for h in CTP)
        tr(draw, f'Closest to Pin - Holes {holes_str}', TABLE_R, contest_y, FLD, BLACK, pad=12)
        contest_y += 55
    if LD:
        tr(draw, f'Long Drive - Hole #{LD}', TABLE_R, contest_y, FLD, BLACK, pad=12)

    # Footer (date / attest signature lines)
    fpad = int(PW * 0.04)
    llen = 4 * DC_W
    fcy  = table_bot + 130
    tl(draw, 'Date:', fpad, fcy, F17, pad=0)
    dw, _, _, _ = bbox(draw, 'Date:', F17)
    lx = fpad + dw + 14
    draw.line([lx, fcy + 16, lx + llen, fcy + 16], fill=GRAY, width=2)
    ax = lx + llen + 80
    tl(draw, 'Attest:', ax, fcy, F17, pad=0)
    aw, _, _, _ = bbox(draw, 'Attest:', F17)
    lx2 = ax + aw + 14
    draw.line([lx2, fcy + 16, lx2 + llen, fcy + 16], fill=GRAY, width=2)


def generate_pages(groups, course, event_config):
    """Returns list of base64-encoded PNG strings, 1 group per page."""
    pages = []
    for group in groups:
        img  = Image.new('RGB', (PW, PH), WHITE)
        draw = ImageDraw.Draw(img)
        draw_card(img, draw, group, 0, course, event_config)
        buf = io.BytesIO()
        img.save(buf, format='PNG', dpi=(DPI, DPI))
        pages.append(base64.b64encode(buf.getvalue()).decode('utf-8'))
    return pages


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
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
        except Exception as e:
            import traceback
            msg = traceback.format_exc().encode()
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', len(msg))
            self.end_headers()
            self.wfile.write(msg)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
