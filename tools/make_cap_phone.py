# 지주캡에 폰 대는 법 — 입체(등각) 그림 만들기 → public/cap-phone.svg
# 실행 : python tools/make_cap_phone.py  (그림을 고칠 때만 다시 돌린다)
import math, os

C = math.cos(math.radians(30))
S = 0.5
SC = 0.85

def P(o, x, y, z, s=SC):
    return (o[0] + C * s * (x - y), o[1] + S * s * (x + y) - s * z)

def pts(o, lst):
    return ' '.join('%.1f,%.1f' % P(o, *p) for p in lst)

OUT = []
def add(s):
    OUT.append(s)

LINE = '#55606E'
def poly(o, lst, fill, stroke=LINE, sw=0.8):
    add('<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (pts(o, lst), fill, stroke, sw))

def box(o, x0, x1, y0, y1, z0, z1, top, front, right, stroke=LINE):
    poly(o, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], top, stroke)
    poly(o, [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], front, stroke)
    poly(o, [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], right, stroke)

PL_TOP, PL_FRONT, PL_RIGHT = '#ECEFF3', '#C9D0DA', '#B7C0CD'
WEB_FRONT, WEB_TOP, WEB_RIGHT = '#C9D2DE', '#E6EAF0', '#AEB8C6'
BR_FACE, BR_EDGE = '#B4BFCD', '#DCE2E9'
PH_BODY, PH_TOP, PH_SIDE, PH_SCREEN, PH_CAM = '#2F3238', '#4A4F58', '#202328', '#3B82C4', '#0D0F12'

def cap(o, L=220, W=120, frame=False):
    box(o, 0, L, 0, W, -8, 0, PL_TOP, PL_FRONT, PL_RIGHT)          # 주판
    box(o, 0, L, 18, 23, 0, 110, WEB_TOP, WEB_FRONT, WEB_RIGHT)    # WEB
    if frame:  # FRAME 선 (WEB 과 δ 만큼 어긋남), 브라켓 오른쪽만 보임
        t = math.tan(math.radians(12))
        a = P(o, 114, 23 + 4 * t, 0); b = P(o, 220, 23 + 110 * t, 0)
        add('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#E24B4A" stroke-width="1.6" stroke-dasharray="6 4"/>' % (a + b))
    mid = L / 2
    # 브라켓 (가운데, WEB 에 직각) : 빗변 띠 + 오른쪽 면
    poly(o, [(mid - 3, 23, 70), (mid + 3, 23, 70), (mid + 3, 80, 0), (mid - 3, 80, 0)], BR_EDGE)
    poly(o, [(mid + 3, 23, 0), (mid + 3, 23, 70), (mid + 3, 80, 0)], BR_FACE)

def phone_standing_x(o, x0, x1, y0, z0=0, h=34, t=5, cam_end='x1'):
    """긴 축이 x 방향, 긴 옆면이 바닥, 화면이 +y(앞)를 봄"""
    y1 = y0 + t
    box(o, x0, x1, y0, y1, z0, z0 + h, PH_TOP, PH_BODY, PH_SIDE, stroke='#15171A')
    poly(o, [(x0 + 3.5, y1, z0 + 3), (x1 - 3.5, y1, z0 + 3), (x1 - 3.5, y1, z0 + h - 3), (x0 + 3.5, y1, z0 + h - 3)], PH_SCREEN, stroke='none')
    cx = x1 - 7 if cam_end == 'x1' else x0 + 7
    c = P(o, cx, y1, z0 + h / 2)
    add('<circle cx="%.1f" cy="%.1f" r="2" fill="%s"/>' % (c[0], c[1], PH_CAM))

def phone_upright(o, x0, y0, w=34, L=70, t=5):
    """긴 축이 위아래(z), 화면이 +y(앞)를 봄 — 틀린 자세"""
    x1, y1 = x0 + w, y0 + t
    box(o, x0, x1, y0, y1, 0, L, PH_TOP, PH_BODY, PH_SIDE, stroke='#15171A')
    poly(o, [(x0 + 3, y1, 3), (x1 - 3, y1, 3), (x1 - 3, y1, L - 3), (x0 + 3, y1, L - 3)], PH_SCREEN, stroke='none')
    c = P(o, x0 + w / 2, y1, L - 7)
    add('<circle cx="%.1f" cy="%.1f" r="2" fill="%s"/>' % (c[0], c[1], PH_CAM))
    return P(o, x0 + w / 2, y1, L / 2)

def phone_lying_y(o, x0, x1, y0, y1, t=5):
    """긴 축이 y 방향, 화면이 위, 머리(카메라)는 y0 쪽"""
    box(o, x0, x1, y0, y1, 0, t, PH_BODY, PH_SIDE, PH_SIDE, stroke='#15171A')
    poly(o, [(x0 + 3, y0 + 3.5, t), (x1 - 3, y0 + 3.5, t), (x1 - 3, y1 - 3.5, t), (x0 + 3, y1 - 3.5, t)], PH_SCREEN, stroke='none')
    c = P(o, (x0 + x1) / 2, y0 + 7, t)
    add('<circle cx="%.1f" cy="%.1f" r="2" fill="%s"/>' % (c[0], c[1], PH_CAM))

def phone_lying_x(o, x0, x1, y0, y1, t=5):
    """긴 축이 x 방향, 화면이 위, 머리는 x1 쪽"""
    box(o, x0, x1, y0, y1, 0, t, PH_BODY, PH_SIDE, PH_SIDE, stroke='#15171A')
    poly(o, [(x0 + 3.5, y0 + 3, t), (x1 - 3.5, y0 + 3, t), (x1 - 3.5, y1 - 3, t), (x0 + 3.5, y1 - 3, t)], PH_SCREEN, stroke='none')
    c = P(o, x1 - 7, (y0 + y1) / 2, t)
    add('<circle cx="%.1f" cy="%.1f" r="2" fill="%s"/>' % (c[0], c[1], PH_CAM))


def phone_standing_y(o, x0, y0, y1, h=34, t=5):
    x1 = x0 + t
    box(o, x0, x1, y0, y1, 0, h, PH_TOP, PH_SIDE, PH_BODY, stroke='#15171A')
    poly(o, [(x1, y0 + 3.5, 3), (x1, y1 - 3.5, 3), (x1, y1 - 3.5, h - 3), (x1, y0 + 3.5, h - 3)], PH_SCREEN, stroke='none')
    c = P(o, x1, y0 + 7, h / 2)
    add('<circle cx="%.1f" cy="%.1f" r="2" fill="%s"/>' % (c[0], c[1], PH_CAM))

def arrow3(o, a, b, color):
    p, q = P(o, *a), P(o, *b)
    add('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2.2" marker-start="url(#arrow)" marker-end="url(#arrow)"/>' % (p + q + (color,)))

def leader(x1, y1, x2, y2):
    add('<line class="leader" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (x1, y1, x2, y2))
    add('<circle cx="%.1f" cy="%.1f" r="2" fill="var(--t)"/>' % (x2, y2))

def text(x, y, s, cls='ts', anchor=None, group=None):
    a = ' text-anchor="%s"' % anchor if anchor else ''
    t = '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, s)
    if group:
        t = '<g class="%s">%s</g>' % (group, t)
    add(t)

H = 612
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 %d" role="img">' % H)
# 단독 그림 : 앱 밝기와 상관없이 흰 바탕 (측정 방향 그림 cap-guide 와 같은 느낌)
add('<style>text{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}'
    '.ts{font-size:12px;fill:#5F5E5A}.th{font-size:14px;font-weight:600;fill:#2C2C2A}'
    '.leader{stroke:#9C9A92;stroke-width:.7;stroke-dasharray:3 3;fill:none}'
    '.c-blue>rect{fill:#E6F1FB;stroke:#185FA5}.c-blue>text{fill:#0C447C}'
    '.c-coral>rect{fill:#FAECE7;stroke:#993C1D}.c-coral>text{fill:#712B13}</style>')
add('<rect width="680" height="%d" rx="16" fill="#FFFFFF"/>' % H)
add('<title>지주캡에 폰 대는 법 (입체)</title>')
add('<desc>위 왼쪽 A : 폰을 긴 옆면이 주판에 닿게 세워 뒷면을 WEB 에 기대고, 긴 축이 WEB 과 평행. FRAME 선을 따라 대면 틀림. '
    '위 오른쪽 B : 폰을 긴 옆면이 주판에 닿게 세워 뒷면을 가운데 브라켓에 기대고, 긴 축이 WEB 과 직각, 카메라 쪽 머리를 선수로. '
    '아래 왼쪽 : 폰 긴 축을 위아래로 세워 WEB 면에 대면 틀림. 아래 오른쪽 : 세운 폰을 권장, 눕힌 폰은 뒷면이 평평할 때만.</desc>')
add('<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>')

# ── 머리말 (CAP-GUIDE 처럼)
add('<g class="c-blue"><rect x="40" y="20" width="108" height="26" rx="6" stroke-width="0.5"/><text class="th" x="94" y="33" text-anchor="middle" dominant-baseline="central">A · T/A 방향</text></g>')
text(156, 38, '주판 위 · WEB 과 평행')
add('<g class="c-coral"><rect x="352" y="20" width="108" height="26" rx="6" stroke-width="0.5"/><text class="th" x="406" y="33" text-anchor="middle" dominant-baseline="central">B · F/A 방향</text></g>')
text(468, 38, '주판 위 · 브라켓과 평행')

# ── A 판
oA = (133, 150)
cap(oA, frame=True)
phone_standing_x(oA, 6, 76, 23.5)
arrow3(oA, (6, 48, 0), (76, 48, 0), '#378ADD')
# 이름표
p = P(oA, 30, 28.5, 22); text(44, 112, '세운 폰', 'th'); leader(96, 108, p[0], p[1])
p = P(oA, 8, 23, 100); text(68, 76, 'WEB'); leader(100, 72, p[0], p[1])
p = P(oA, 110, 23, 70); text(198, 92, '브라켓'); leader(214, 96, p[0], p[1])
p = P(oA, 30, 100, 0); text(44, 252, '주판'); leader(60, 242, p[0], p[1])
p = P(oA, 170, 23 + 60 * math.tan(math.radians(12)), 0); text(170, 326, 'FRAME 선 — 따라 재면 ✕'); leader(232, 314, p[0], p[1])

# ── B 판
oB = (445, 150)
cap(oB)
phone_standing_y(oB, 113.5, 30, 100)
arrow3(oB, (134, 30, 0), (134, 100, 0), '#D85A30')
p = P(oB, 118.5, 80, 17); text(470, 326, '세운 폰 · 카메라 쪽 → 선수', 'ts'); leader(486, 314, p[0], p[1])
# 선수 화살표 (−y 방향)
q0 = (572, 112); q1 = (q0[0] + C * 40, q0[1] - S * 40)
add('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="var(--s)" stroke-width="1.5" marker-end="url(#arrow)"/>' % (q0 + q1))
text(q1[0] + 6, q1[1] + 4, '선수')

# ── 아래 왼쪽 : 틀린 자세
text(185, 372, '✕ 긴 축을 위아래로 세우기', 'th', 'middle')
oX = (150, 467)
box(oX, 0, 150, 0, 70, -6, 0, PL_TOP, PL_FRONT, PL_RIGHT)
box(oX, 0, 150, 12, 17, 0, 95, WEB_TOP, WEB_FRONT, WEB_RIGHT)
c = phone_upright(oX, 55, 17.5)
add('<g stroke="#E24B4A" stroke-width="3" stroke-linecap="round"><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/></g>'
    % (c[0] - 11, c[1] - 11, c[0] + 11, c[1] + 11, c[0] + 11, c[1] - 11, c[0] - 11, c[1] + 11))
text(185, 594, 'WEB 판 위 선 하나 — 대는 방향마다 값이 달라요', 'ts', 'middle')

# ── 아래 오른쪽 : 자세 보기
text(500, 372, '폰 자세', 'th', 'middle')
oS = (408, 468)
box(oS, -8, 80, -14, 20, -4, 0, PL_TOP, PL_FRONT, PL_RIGHT)
phone_standing_x(oS, 0, 70, 0)
oL = (557.5, 460)
box(oL, -8, 80, -8, 42, -4, 0, PL_TOP, PL_FRONT, PL_RIGHT)
phone_lying_x(oL, 0, 70, 0, 34)
text(432, 534, '세운 폰 — 권장', 'th', 'middle'); text(432, 552, '긴 옆면이 주판에', 'ts', 'middle')
text(574, 534, '눕힌 폰 — 주의', 'th', 'middle'); text(574, 552, '뒷면이 평평할 때만', 'ts', 'middle')
text(503, 576, '화면 속 검은 점 = 카메라 쪽(폰 머리)', 'ts', 'middle')
text(503, 594, '어느 자세든 긴 축은 선 방향으로', 'ts', 'middle')
add('</svg>')

svg = '\n'.join(OUT).replace('var(--t)', '#9C9A92').replace('var(--s)', '#73726C')
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'cap-phone.svg')
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write(svg + '\n')
print('저장 :', os.path.normpath(out), len(svg))
