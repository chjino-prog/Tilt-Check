# 지주캡 계산시트(엑셀) 만들기 — 앱(src/calc)과 같은 식을 엑셀 함수로 넣는다
# 실행 : python tools/make_calc_sheet.py [저장 경로]
#   저장 경로를 안 주면  내 문서\TILT CHECK\TILTCHECK_지주캡_계산시트_<버전>.xlsx
# 식을 고치면 앱 식(src/calc/angle.ts · sign.ts · judge.ts · capcalc.ts)과 docs/계산식.md 를 같이 고치고,
# tools/check_calc_sheet.py 로 앱 값과 맞는지 확인한다.
import json
import os
import sys
import winreg

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
VERSION = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))['version']
ROWS = 40  # 캡 줄 수
FIRST = 13  # 첫 캡 줄

# ── 글꼴 : HD 글꼴이 깔려 있으면 쓰고, 없으면 맑은 고딕 (company-excel 규칙)
def installed_fonts():
    names = set()
    for root in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        try:
            k = winreg.OpenKey(root, r'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts')
        except OSError:
            continue
        i = 0
        while True:
            try:
                n = winreg.EnumValue(k, i)[0]
            except OSError:
                break
            names.add(n.split(' (')[0].strip().lower())
            i += 1
    return names


_f = installed_fonts()
HD = all(n in _f for n in ('hd light', 'hd medium', 'hd bold'))
F_BODY = 'HD Light' if HD else '맑은 고딕'
F_MED = 'HD Medium' if HD else '맑은 고딕'
F_BOLD = 'HD Bold' if HD else '맑은 고딕'

# ── 색 (company-excel 3장 — 뜻대로만)
NAVY, NAVY_BG = '1B2A4A', 'F4F6F9'
RED, RED_BG = 'D0342C', 'FDEEED'
ORANGE, ORANGE_BG = 'E08A00', 'FFF4E0'
GREEN, GREEN_BG = '2E8B4E', 'EAF6EE'
TEXT, SUB, LINE = '1F2328', '6B7280', 'D5DAE1'
INPUT_BG = 'FFFFFF'


def font(kind='body', size=10, color=TEXT, bold=False):
    name = {'body': F_BODY, 'med': F_MED, 'bold': F_BOLD}[kind]
    return Font(name=name, size=size, color=color, bold=bold or (not HD and kind != 'body'))


thin = Side(style='thin', color=LINE)
navy_side = Side(style='medium', color=NAVY)
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
fill = lambda c: PatternFill('solid', fgColor=c)
CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)
LEFT = Alignment(horizontal='left', vertical='center', wrap_text=True)

# ── 블록 값 (한 시트 = 한 블록). 이름 정의로 식에서 부른다
#   이름            칸   뜻
BLOCK = [
    ('BASIS', 'D5', '계산 기준', '현물', '현물 = 폰으로 잰 값 / 도면 = 도면 값'),
    ('TA_IN', 'D6', 'T.A', None, '현물 = 잰 경사 / 도면 = 도면 T.A'),
    ('FA_IN', 'D7', 'F.A', None, '크기만'),
    ('FA_LEAN', 'D8', 'FRAME 누운 쪽 (F.A 방향)', '선수', 'LONGL. 라인의 낮은 끝'),
    ('POSE', 'D9', '잴 때 지주캡이 보는 쪽', '바닥', '턴오버 후면 하늘'),
    ('TOL', 'D10', '합격 허용오차 (±°)', 3.0, 'A · B 편차 기준 (기본 3.0)'),
]
# 계산값 이름 (오른쪽에 계산해 둔다 — 라벨 I:L, 값 M)
DERIVED = [
    ('TA_C', 'M5', '계산에 쓰는 T.A (경사)', '=IF(ISNUMBER(TA_IN),IF(BASIS="도면",DEGREES(ASIN(SIN(RADIANS(ABS(TA_IN)))*COS(RADIANS(ABS(FA_IN))))),ABS(TA_IN)),"")'),
    ('FA_C', 'M6', '계산에 쓰는 F.A', '=IF(ISNUMBER(FA_IN),ABS(FA_IN),"")'),
    ('F_DIR', 'M7', 'F.A 방향 f (선수 +1, 선미 −1)', '=IF(FA_LEAN="선미",-1,1)'),
    ('U_SIGN', 'M8', '자세 부호 (바닥 +1, 하늘 −1)', '=IF(POSE="하늘",-1,1)'),
    ('SCALE', 'M9', '회전 환산 배율 1/sin T.A', '=IF(ISNUMBER(TA_C),1/SIN(RADIANS(TA_C)),"")'),
]

# ── 캡 줄 칸. (키, 머리, 폭, 식 또는 None(입력), 표시형식, 묶음)
#   식 안의 {키} 는 같은 줄의 그 칸으로 바뀐다. 묶음 : in = 입력, out = 결과, ref = 참고값, calc = 계산 과정(접힘)
R = lambda x: f'RADIANS({x})'
COLS = [
    ('no', '캡 No', 9, None, '@', 'in'),
    ('d', 'δ 도면\n(°)', 7, None, '0.00', 'in'),
    ('cd', '돌아간\n방향', 7, None, '@', 'in'),
    ('th', '외판 θ\n(°)', 7, None, '0.0', 'in'),
    ('a', 'A 실측\n(°)', 7.5, None, '0.00', 'in'),
    ('b', 'B 실측\n(°)', 7.5, None, '0.00', 'in'),
    ('bh', 'B\n높은 쪽', 7, None, '@', 'in'),
    # 결과
    ('nA', '정상 A\n(°)', 7.5, '=IF({ok},IF({miss},"—",{tA}),"")', '0.00', 'out'),
    ('nB', '정상 B\n(°)', 7.5, '=IF({ok},IF({miss},"—",ABS({tB})),"")', '0.00', 'out'),
    ('nBh', '정상 B\n높은 쪽', 7, '=IF({ok},IF({miss},"—",IF(ABS({tB})<0.005,"수평",IF(({tB}>0)=(F_DIR=-1),"선수","선미"))),"")', '@', 'out'),
    ('eA', 'A 편차\n(°)', 7.5, '=IF({ok},IF({miss},"—",{errA}),"")', '+0.00;-0.00;0.00', 'out'),
    ('eB', 'B 편차\n(°)', 7.5, '=IF({ok},IF({miss},"—",ABS({errB})),"")', '0.00', 'out'),
    ('eBt', 'B 편차\n더 높은 쪽', 9, '=IF({ok},IF({miss},"—",IF(ABS({errB})<0.005,"같음",IF(({errB}>0)=(F_DIR=-1),"선수","선미")&" 쪽")),"")', '@', 'out'),
    ('v', '판정', 8, '=IF({ok},IF({miss},"θ 미입력",IF({sus},"판정불가",IF(OR(ABS({errA})>TOL+1E-9,ABS({errB})>TOL+1E-9),"NG",IF(NOT({iok}),"주의",IF(ABS({rot})>TOL+1E-9,"주의","OK"))))),"")', '@', 'out'),
    ('why', '주의 사유', 40,
     '=IF({ok},IF({v}="θ 미입력","외판 기울기 θ 미입력 — 입력하면 판정",IF({v}="판정불가","방향 확인 — A 가 반대 방향 정상값에 더 맞음 (캡 방향 · F.A 방향 · 자세)",'
     'IF({v}="주의",IF({iok},"역산 회전각이 허용오차를 넘음 – 캡 회전 재확인","역산 불가")&IF(TA_C<24," · T.A 24° 미만 (회전 "&TEXT(SCALE,"0.0")&"배 증폭)",""),""))),"")', '@', 'out'),
    # 참고값
    ('rotv', '역산 회전\n(참고, °)', 8, '=IF({ok},IF({miss},"—",IF({iok},{rot},"역산 불가")),"")', '+0.00;-0.00;0.00', 'ref'),
    ('rott', '회전 설명 (참고)', 22,
     '=IF({ok},IF(OR({miss},NOT({iok})),"",IF(ABS({rot})<0.005,"도면과 같음",IF(ABS({d})<1E-9,IF({rot}>0,IF({c}=1,"선수","선미"),IF({c}=1,"선미","선수"))&" 쪽으로 "&TEXT(ABS({rot}),"0.00")&"° 돌아감",'
     'IF({c}=1,"선수","선미")&" 쪽으로 "&TEXT(ABS({rot}),"0.00")&"° "&IF({rot}>0,"더","덜")&" 돌아감"))),"")', '@', 'ref'),
    ('dRv', '실제 δ\n(참고, °)', 8, '=IF({ok},IF(OR({miss},NOT({iok})),"—",{dR}),"")', '0.00', 'ref'),
    ('arv', 'A 잔차\n(참고, °)', 8, '=IF({ok},IF(OR({miss},NOT({iok})),"—",{ar}),"")', '+0.00;-0.00;0.00', 'ref'),
    ('dBv', 'B 1°당\n변화 dB', 7, '=IF({ok},IF({miss},"—",{dB}),"")', '0.00', 'ref'),
    ('dAv', 'A 1°당\n변화 dA', 7, '=IF({ok},IF({miss},"—",{dA}),"")', '0.00', 'ref'),
    # 계산 과정 (접힘) — docs/계산식.md 2 ~ 7장
    ('ok', '입력 다 됨', 8, '=AND(ISNUMBER({d}),ISNUMBER({a}),ISNUMBER({b}),OR({bh}="선수",{bh}="선미",{bh}="수평"),ISNUMBER(TA_C),ISNUMBER(FA_C))', '@', 'calc'),
    ('c', '캡 방향 c', 7, '=IF(ABS(N({d}))<1E-9,1,IF({cd}="선미",-1,1))', '0', 'calc'),
    ('s', '회전 부호 s', 7, '={c}*F_DIR*U_SIGN', '0', 'calc'),
    ('miss', 'θ 미입력', 7, '=AND(ABS(N({d}))>=1E-9,NOT(ISNUMBER({th})))', '@', 'calc'),
    ('use', '외판 보정', 7, '=AND(ABS(N({d}))>=1E-9,ISNUMBER({th}),N({th})>0)', '@', 'calc'),
    ('dc', 'δc 상판', 8, f'=IF({{use}},DEGREES(ATAN(TAN({R("{d}")})/COS({R("{th}")}))),N({{d}}))', '0.0000', 'calc'),
    ('k', 'k = dδc/dδ', 8, f'=IF({{use}},(1+TAN({R("{d}")})^2)/COS({R("{th}")})/(1+TAN({R("{dc}")})^2),1)', '0.0000', 'calc'),
    ('tA', 'θA', 8, f'=IF({{ok}},DEGREES(ASIN(SIN({R("TA_C")})*COS({R("{dc}")})+{{s}}*SIN({R("FA_C")})*SIN({R("{dc}")}))),"")', '0.0000', 'calc'),
    ('tB', 'θB', 8, f'=IF({{ok}},DEGREES(ASIN(SIN({R("FA_C")})*COS({R("{dc}")})-{{s}}*SIN({R("TA_C")})*SIN({R("{dc}")}))),"")', '0.0000', 'calc'),
    ('dA', 'dA', 8, f'=IF({{ok}},ABS({{s}}*SIN({R("FA_C")})*COS({R("{dc}")})-SIN({R("TA_C")})*SIN({R("{dc}")}))/COS({R("{tA}")})*{{k}},"")', '0.0000', 'calc'),
    ('dB', 'dB', 8, f'=IF({{ok}},ABS(SIN({R("FA_C")})*SIN({R("{dc}")})+{{s}}*SIN({R("TA_C")})*COS({R("{dc}")}))/COS({R("{tB}")})*{{k}},"")', '0.0000', 'calc'),
    ('Bs', 'B 부호', 8, '=IF({ok},IF({bh}="수평",0,IF(({bh}="선수")=(F_DIR=-1),ABS({b}),-ABS({b}))),"")', '0.0000', 'calc'),
    ('As', 'A 부호', 8, '=IF({ok},IF({tA}<0,-ABS({a}),ABS({a})),"")', '0.0000', 'calc'),
    ('errA', 'A 편차', 8, '=IF({ok},{As}-{tA},"")', '0.0000', 'calc'),
    ('errB', 'B 편차', 8, '=IF({ok},{Bs}-{tB},"")', '0.0000', 'calc'),
    ('Rr', 'R', 8, f'=IF({{ok}},SQRT(SIN({R("FA_C")})^2+SIN({R("TA_C")})^2),"")', '0.0000', 'calc'),
    ('ratio', 'sinB / R', 8, f'=IF({{ok}},SIN({R("{Bs}")})/{{Rr}},"")', '0.0000', 'calc'),
    ('iok', '역산 됨', 7, '=IF({ok},ABS({ratio})<=1,FALSE)', '@', 'calc'),
    ('phi', 'φ', 8, f'=IF({{ok}},DEGREES(ATAN2(SIN({R("FA_C")}),{{s}}*SIN({R("TA_C")}))),"")', '0.0000', 'calc'),
    ('cc', 'c = acos', 8, '=IF({iok},DEGREES(ACOS({ratio})),"")', '0.0000', 'calc'),
    ('d1', 'δ1', 8, '=IF({iok},MOD({cc}-{phi}+180,360)-180,"")', '0.0000', 'calc'),
    ('d2', 'δ2', 8, '=IF({iok},MOD(-{cc}-{phi}+180,360)-180,"")', '0.0000', 'calc'),
    ('dcR', 'δc 실제', 8, '=IF({iok},IF(ABS(MOD({d1}-{dc}+180,360)-180)<=ABS(MOD({d2}-{dc}+180,360)-180),{d1},{d2}),"")', '0.0000', 'calc'),
    ('dR', 'δ 실제 (외판)', 8, f'=IF({{iok}},IF(AND({{use}},ABS({{dcR}})<90),DEGREES(ATAN(TAN({R("{dcR}")})*COS({R("{th}")}))),{{dcR}}),"")', '0.0000', 'calc'),
    ('rot', '회전오차', 8, '=IF({iok},IF(AND({use},ABS({dcR})>=90),MOD({dcR}-{dc}+180,360)-180,MOD({dR}-N({d})+180,360)-180),"")', '0.0000', 'calc'),
    ('aP', 'A 예측', 8, f'=IF({{iok}},DEGREES(ASIN(SIN({R("TA_C")})*COS({R("{dcR}")})+{{s}}*SIN({R("FA_C")})*SIN({R("{dcR}")}))),"")', '0.0000', 'calc'),
    ('ar', 'A 잔차', 8, '=IF({iok},{As}-{aP},"")', '0.0000', 'calc'),
    ('aF', 'A 반대 방향', 8, f'=IF({{ok}},DEGREES(ASIN(SIN({R("TA_C")})*COS({R("{dc}")})-{{s}}*SIN({R("FA_C")})*SIN({R("{dc}")}))),"")', '0.0000', 'calc'),
    ('sus', '방향 의심', 7, '=IF({ok},AND(ABS({tA}-{aF})>=0.4,ABS(ABS({a})-ABS({aF}))+0.3<ABS(ABS({a})-ABS({tA}))),FALSE)', '@', 'calc'),
]
KEYS = [c[0] for c in COLS]
COL = {k: get_column_letter(2 + i) for i, k in enumerate(KEYS)}  # A 열은 번호


def row_formula(src, r):
    out = src
    for k in sorted(KEYS, key=len, reverse=True):
        out = out.replace('{' + k + '}', f'{COL[k]}{r}')
    assert '{' not in out, out
    return out


def build(path):
    wb = Workbook()
    ws = wb.active
    ws.title = '계산'
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.outlinePr.summaryRight = False

    last = get_column_letter(1 + len(KEYS))
    out_last = COL['dAv']

    # ── 머리
    ws['A1'] = '정도 검사 · 계산시트'
    ws['A1'].font = font('med', 9, NAVY)
    ws['A2'] = 'SUPPORT CAP 각도 계산 (TILT CHECK 앱과 같은 식)'
    ws['A2'].font = font('bold', 20, NAVY)
    ws['A3'] = f'TILT CHECK {VERSION} · 흰 칸만 넣으면 결과가 나와요. 식 설명은 [계산식] 시트, 계산 과정은 위 [+] 를 눌러 펼쳐요'
    ws['A3'].font = font('body', 9, SUB)
    ws.row_dimensions[2].height = 30
    for c in range(1, 1 + len(KEYS) + 1):
        ws.cell(row=3, column=c).border = Border(bottom=navy_side)

    # ── 블록 값
    ws['A4'] = '블록 값 (한 시트 = 한 블록)'
    ws['A4'].font = font('med', 10, NAVY)
    ws['I4'] = '계산에 쓰는 값'
    ws['I4'].font = font('med', 10, NAVY)
    for name, ref, label, default, hint in BLOCK:
        col, row = ref[0], int(ref[1:])
        ws.row_dimensions[row].height = 22
        ws.merge_cells(f'A{row}:C{row}')
        lab = ws[f'A{row}']
        lab.value = label
        lab.font = font('med', 10)
        lab.alignment = Alignment(horizontal='left', vertical='center', indent=1)
        for cc in 'ABC':
            ws[f'{cc}{row}'].fill = fill(NAVY_BG)
            ws[f'{cc}{row}'].border = BOX
        ws.merge_cells(f'D{row}:E{row}')
        ws[f'E{row}'].border = BOX
        cell = ws[ref]
        cell.value = default
        cell.font = font('med', 11, NAVY)
        cell.alignment = CENTER
        cell.border = BOX
        cell.fill = fill(INPUT_BG)
        if name in ('TA_IN', 'FA_IN', 'TOL'):
            cell.number_format = '0.000' if name != 'TOL' else '0.0'
        ws.merge_cells(f'F{row}:H{row}')
        ws[f'F{row}'] = hint
        ws[f'F{row}'].font = font('body', 8, SUB)
        ws[f'F{row}'].alignment = Alignment(horizontal='left', vertical='center', wrap_text=True, indent=1)
        wb.defined_names[name] = DefinedName(name, attr_text=f"'계산'!${col}${row}")
    for name, ref, label, formula in DERIVED:
        col, row = ref[0], int(ref[1:])
        ws.merge_cells(f'I{row}:L{row}')
        ws[f'I{row}'] = label
        ws[f'I{row}'].font = font('body', 9, SUB)
        ws[f'I{row}'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
        c = ws[ref]
        c.value = formula
        c.font = font('med', 10)
        c.alignment = CENTER
        c.number_format = '0.000' if name in ('TA_C', 'FA_C') else ('0.00' if name == 'SCALE' else '0')
        c.fill = fill(NAVY_BG)
        wb.defined_names[name] = DefinedName(name, attr_text=f"'계산'!${col}${row}")

    # 고르는 칸
    dv = lambda items: DataValidation(type='list', formula1='"' + ','.join(items) + '"', allow_blank=True, showErrorMessage=True)
    v1 = dv(['현물', '도면'])
    v2 = dv(['선수', '선미'])
    v3 = dv(['바닥', '하늘'])
    v4 = dv(['선수', '선미', '수평'])
    vnum = DataValidation(type='decimal', operator='between', formula1='0', formula2='89.999', allow_blank=True, showErrorMessage=True,
                          errorTitle='각도', error='0 이상 90 미만으로 넣어주세요')
    vtol = DataValidation(type='decimal', operator='between', formula1='0.1', formula2='30', showErrorMessage=True, error='0.1 이상으로 넣어주세요')
    for v in (v1, v2, v3, v4, vnum, vtol):
        ws.add_data_validation(v)
    v1.add('D5')
    v2.add('D8')
    v3.add('D9')
    vtol.add('D10')
    vnum.add('D6')
    vnum.add('D7')

    # ── 캡 표 머리 (2줄 : 묶음 · 칸 이름)
    hr, hr2 = FIRST - 2, FIRST - 1
    groups = {'in': ('넣는 값', NAVY, 'FFFFFF'), 'out': ('결과 — 판정 = A · B 실측과 정상값 비교', NAVY, 'FFFFFF'),
              'ref': ('참고값 — 판정에는 안 씀', '6B7280', 'FFFFFF'), 'calc': ('계산 과정 (계산식 시트 순서)', 'D5DAE1', TEXT)}
    ws.cell(row=hr, column=1, value='').fill = fill(NAVY)
    ws.cell(row=hr2, column=1, value='번호')
    spans = {}
    for k, *_rest in COLS:
        g = _rest[-1]
        spans.setdefault(g, []).append(COL[k])
    for g, cols in spans.items():
        title, bg, fg = groups[g]
        ws.merge_cells(f'{cols[0]}{hr}:{cols[-1]}{hr}')
        c = ws[f'{cols[0]}{hr}']
        c.value = title
        c.font = font('med', 10, fg)
        c.alignment = Alignment(horizontal='left', vertical='center', indent=1)
        for col in cols:
            ws[f'{col}{hr}'].fill = fill(bg)
    ws.row_dimensions[hr].height = 20
    ws.row_dimensions[hr2].height = 34
    ws.column_dimensions['A'].width = 5
    for c in [ws.cell(row=hr2, column=1)] + [ws[f'{COL[k]}{hr2}'] for k in KEYS]:
        c.font = font('med', 9, NAVY)
        c.alignment = CENTER
        c.fill = fill(NAVY_BG)
        c.border = Border(bottom=navy_side, top=thin, left=thin, right=thin)
    for k, head, width, formula, fmt, g in COLS:
        ws[f'{COL[k]}{hr2}'] = head
        ws.column_dimensions[COL[k]].width = width
        if g == 'calc':
            ws.column_dimensions[COL[k]].outlineLevel = 1
            ws.column_dimensions[COL[k]].hidden = True
            ws[f'{COL[k]}{hr2}'].font = font('med', 8, SUB)

    # ── 캡 줄
    for i in range(ROWS):
        r = FIRST + i
        ws.row_dimensions[r].height = 26
        n = ws.cell(row=r, column=1, value=i + 1)
        n.font = font('body', 8, SUB)
        n.alignment = CENTER
        for k, head, width, formula, fmt, g in COLS:
            c = ws[f'{COL[k]}{r}']
            c.number_format = fmt
            c.border = BOX
            if formula is None:
                c.fill = fill(INPUT_BG)
                c.font = font('med', 10)
                c.alignment = CENTER
            else:
                c.value = row_formula(formula, r)
                c.alignment = LEFT if k in ('why', 'rott') else CENTER
                if g == 'out':
                    c.font = font('med' if k in ('eA', 'eB', 'v') else 'body', 10 if k != 'why' else 8)
                    c.fill = fill('FBFCFD')
                elif g == 'ref':
                    c.font = font('body', 9 if k != 'rott' else 8, SUB)
                else:
                    c.font = font('body', 8, SUB)
    rng = lambda k: f'{COL[k]}{FIRST}:{COL[k]}{FIRST + ROWS - 1}'
    v2b = dv(['선수', '선미'])
    ws.add_data_validation(v2b)
    v2b.add(rng('cd'))
    v4.add(rng('bh'))
    vnum.add(rng('d'))
    vnum.add(rng('th'))

    # 판정 색 (OK 초록 · 주의 주황 · NG 빨강 · 보류 회색)
    vcol = COL['v']
    whole = f'{vcol}{FIRST}:{vcol}{FIRST + ROWS - 1}'
    for word, fg, bg in (('OK', GREEN, GREEN_BG), ('주의', ORANGE, ORANGE_BG), ('NG', RED, RED_BG), ('판정불가', SUB, NAVY_BG), ('θ 미입력', SUB, NAVY_BG)):
        ws.conditional_formatting.add(whole, FormulaRule(formula=[f'${vcol}{FIRST}="{word}"'], font=Font(name=F_BOLD, color=fg, bold=not HD), fill=fill(bg)))
    # 허용오차를 넘은 편차는 빨강
    for k in ('eA', 'eB'):
        ws.conditional_formatting.add(rng(k), FormulaRule(formula=[f'AND(ISNUMBER({COL[k]}{FIRST}),ABS({COL[k]}{FIRST})>TOL+1E-9)'], font=Font(name=F_MED, color=RED, bold=not HD)))
    # 넘은 역산 회전은 주황
    ws.conditional_formatting.add(rng('rotv'), FormulaRule(formula=[f'AND(ISNUMBER({COL["rotv"]}{FIRST}),ABS({COL["rotv"]}{FIRST})>TOL+1E-9)'], font=Font(name=F_MED, color=ORANGE, bold=not HD)))

    ws.freeze_panes = f'{COL["d"]}{FIRST}'
    # 인쇄 : A3 가로, 결과까지 한 장 폭
    ws.print_area = f'A1:{out_last}{FIRST + ROWS - 1}'
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_A3
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = f'{hr}:{hr2}'
    ws.page_margins.left = ws.page_margins.right = 0.4

    explain(wb.create_sheet('계산식'))
    wb.calculation.fullCalcOnLoad = True
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wb.save(path)
    return path


def explain(ws):
    """식 설명 시트 — docs/계산식.md 를 엑셀 칸 이름으로"""
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 4
    ws.column_dimensions['B'].width = 26
    ws.column_dimensions['C'].width = 70
    ws.column_dimensions['D'].width = 40
    ws['B1'] = '지주캡 계산식'
    ws['B1'].font = font('bold', 20, NAVY)
    ws['B2'] = f'TILT CHECK {VERSION} 앱과 같은 식 · 모든 각도는 도(°). 엑셀 함수는 RADIANS / DEGREES 로 바꿔 계산'
    ws['B2'].font = font('body', 9, SUB)
    rows = [
        ('h', '0. 쓰는 법'),
        ('r', '① 블록 값', '[계산] 시트 위 흰 칸 : 계산 기준(현물/도면) · T.A · F.A · FRAME 누운 쪽 · 지주캡이 보는 쪽 · 합격 허용오차', '한 시트 = 한 블록 (블록마다 시트 복사)'),
        ('r', '② 캡 줄', '캡 No · δ · 돌아간 방향 · 외판 θ · A 실측 · B 실측 · B 높은 쪽 (선수/선미/수평)', '흰 칸만 넣는다'),
        ('r', '③ 결과', '정상 A · B, 편차, 판정(OK / 주의 / NG)과 주의 사유가 바로 나온다. 역산 회전 · 실제 δ · A 잔차는 참고값', ''),
        ('r', 'θ 나중에', 'δ 가 있는 캡은 θ 를 비워 두면 "θ 미입력". 나중에 θ 칸만 채우면 같은 실측값으로 판정이 나온다 (누운 외판은 0)', ''),
        ('h', '1. 넣는 값'),
        ('r', 'T.A', '현물 = 폰으로 잰 경사 그대로 / 도면 = 도면 T.A 를 경사로 바꿈 (2-1)', '계산 D6 → TA_C'),
        ('r', 'F.A', '크기만. FRAME 누운 쪽(F.A 방향) = LONGL. 라인의 낮은 끝', '계산 D7 · D8'),
        ('r', 'δ · 돌아간 방향', '도면 캡취부각도 (외판 면 위 각도) · 캡 WEB 외판 쪽 끝이 간 쪽. δ 0 캡은 방향 무관(선수로 계산)', '캡 줄'),
        ('r', '외판 θ', '캡이 있는 FR 단면에서 외판 접선과 A/B 수평선 사이 각. 누운 외판 0. δ 가 있는데 비우면 "θ 미입력" (잰 값만 두고 판정은 θ 입력 후)', '캡 줄'),
        ('r', 'A · B 실측', 'A = WEB 방향 (크기만), B = WEB 직각 (크기 + 높은 쪽 선수/선미/수평)', '캡 줄'),
        ('h', '2. 식에 넣기 전에 바꾸기'),
        ('r', '2-1 도면 T.A → 경사', 'TA = ASIN( SIN T.A도면 × COS F.A )   (도면 기준일 때만)', 'TA_C'),
        ('r', '2-2 회전 부호 s', 's = c × f × 자세   (c 캡 방향, f F.A 방향 : 선수 +1 / 선미 −1, 자세 : 바닥 +1 / 하늘 −1)', 'c · s 칸'),
        ('r', '2-3 캡 상판 δc', 'tan δ외판 = tan δc × cos θ  →  δc = ATAN( TAN δ ÷ COS θ )   (δ 0 · θ 없음 · θ 0 이면 δc = δ)', 'δc 상판'),
        ('r', '', '외판 길이방향(선수미 방향) 기울기는 뺀다 — 20° 까지 영향 0.2° 이하, 30° 에서 약 0.5°', ''),
        ('h', '3. 정상값'),
        ('r', '정상 A', 'θA = ASIN( SIN TA × COS δc + s × SIN F.A × SIN δc )', 'θA'),
        ('r', '정상 B', 'θB = ASIN( SIN F.A × COS δc − s × SIN TA × SIN δc )   θB > 0 이면 F.A 반대쪽이 높음', 'θB'),
        ('h', '4. 1° 당 변화 (도면 δ 1° 당)'),
        ('r', 'dA · dB', 'dA = | s·SIN F.A·COS δc − SIN TA·SIN δc | ÷ COS θA × k ,  dB = | SIN F.A·SIN δc + s·SIN TA·COS δc | ÷ COS θB × k', 'dA · dB'),
        ('r', 'k', 'k = dδc/dδ = (1 ÷ COS θ) × (1 ÷ COS² δ) ÷ (1 + TAN² δc)   (외판 보정이 없으면 1)', 'k'),
        ('h', '5. 판정 (A · B 현물 비교)'),
        ('r', 'B 부호', 'F.A 반대쪽이 높으면 +B, F.A 쪽이 높으면 −B, 수평 0', 'B 부호'),
        ('r', 'A 부호', '정상 A 부호를 따른다 (A 는 크기만 잼)', 'A 부호'),
        ('r', '편차', 'A 편차 = A부호 − θA ,  B 편차 = B부호 − θB', 'A 편차 · B 편차'),
        ('r', 'NG', '|A 편차| > 허용오차 또는 |B 편차| > 허용오차', '판정'),
        ('r', '주의', 'A · B 는 허용오차 안인데 |역산 회전| > 허용오차, 또는 역산 불가', '판정'),
        ('r', 'OK', '둘 다 아님', '판정'),
        ('r', '판정불가', '방향 점검(7)에 걸림 — 캡 방향 · F.A 방향 · 자세 중 하나가 반대로 들어간 것', '판정'),
        ('r', 'θ 미입력', 'δ 가 있는데 외판 θ 가 비어 있음 — θ 를 넣으면 같은 실측값으로 바로 판정', '판정'),
        ('h', '6. 역산 회전 (참고값 — 판정에는 안 씀)'),
        ('r', 'R · φ', 'R = √( SIN² F.A + SIN² TA ) ,  φ = ATAN2( SIN F.A , s × SIN TA )   (엑셀 ATAN2 는 x, y 순서)', 'R · φ'),
        ('r', 'δ1 · δ2', 'c = ACOS( SIN B부호 ÷ R ) ,  δ1 = c − φ ,  δ2 = −c − φ   (|SIN B부호 ÷ R| > 1 이면 역산 불가)', 'δ1 · δ2'),
        ('r', 'δc 실제', 'δ1 · δ2 중 δc 에 더 가까운 값 (−180 ~ 180 으로 맞춰 비교)', 'δc 실제'),
        ('r', 'δ 실제', 'δ실제 = ATAN( TAN δc실제 × COS θ )   (외판 위 각도, 외판 보정이 없으면 δc실제)', 'δ 실제'),
        ('r', '회전오차', 'δ실제 − δ   (+ = 캡 방향 쪽으로 더, − = 덜. δ 0 캡은 + = 선수 쪽)', '회전오차'),
        ('r', 'A 잔차', 'A 예측 = θA( δc실제 ) ,  A 잔차 = A부호 − A 예측', 'A 예측 · A 잔차'),
        ('r', '회전 환산 배율', '1 ÷ SIN TA — B 를 1° 잘못 재면 회전각은 이 배수로 커진다 (T.A 46.7° → 1.4배, 34.4° → 1.8배, 17.4° → 3.3배)', '계산 M9'),
        ('h', '7. 방향 점검'),
        ('r', '방향 의심', 'A반대 = θA 를 −s 로 계산.  |θA − A반대| ≥ 0.4° 이고  | |A| − |A반대| | + 0.3 < | |A| − |θA| |  이면 판정불가', '방향 의심'),
    ]
    r = 4
    for item in rows:
        if item[0] == 'h':
            r += 1
            c = ws.cell(row=r, column=2, value=item[1])
            c.font = font('bold', 12, NAVY)
            for col in (2, 3, 4):
                ws.cell(row=r, column=col).border = Border(bottom=navy_side)
            r += 1
            continue
        _, a, b, d = item
        ws.cell(row=r, column=2, value=a).font = font('med', 10)
        ws.cell(row=r, column=3, value=b).font = font('body', 10)
        ws.cell(row=r, column=4, value=d).font = font('body', 9, SUB)
        for col in (2, 3, 4):
            ws.cell(row=r, column=col).alignment = Alignment(vertical='top', wrap_text=True)
            ws.cell(row=r, column=col).border = Border(bottom=thin)
        r += 1
    ws.page_setup.orientation = 'portrait'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser('~'), 'Documents', 'TILT CHECK', f'TILTCHECK_지주캡_계산시트_{VERSION}.xlsx')
    print(build(out))
    print('글꼴 :', 'HD' if HD else '맑은 고딕 (HD 글꼴 없음)')
