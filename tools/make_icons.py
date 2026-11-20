# 앱 아이콘 만들기 : 토스 파랑 바탕 + 기울어진 수평계
# 실행 : python tools/make_icons.py  → public/icons/*.png
from PIL import Image, ImageDraw
import os

BLUE = (49, 130, 246, 255)
WHITE = (255, 255, 255, 255)
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)


def draw(size, rounded=True, scale=1.0):
    S = 1024  # 크게 그린 뒤 줄여서 테두리를 부드럽게
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle((0, 0, S, S), radius=int(S * 0.225), fill=BLUE)
    else:
        d.rectangle((0, 0, S, S), fill=BLUE)
    # 수평계 (기울어진 둥근 막대)
    bar = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    b = ImageDraw.Draw(bar)
    w, h = int(S * 0.66 * scale), int(S * 0.24 * scale)
    x0, y0 = (S - w) // 2, (S - h) // 2
    b.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=h // 2, fill=WHITE)
    # 기포 창
    cw, ch = int(h * 1.25), int(h * 0.56)
    cx0, cy0 = (S - cw) // 2, (S - ch) // 2
    b.rounded_rectangle((cx0, cy0, cx0 + cw, cy0 + ch), radius=ch // 2, fill=BLUE)
    r = int(ch * 0.32)
    bx = S // 2 + int(cw * 0.18)
    b.ellipse((bx - r, S // 2 - r, bx + r, S // 2 + r), fill=WHITE)
    bar = bar.rotate(14, resample=Image.BICUBIC, center=(S // 2, S // 2))
    img.alpha_composite(bar)
    return img.resize((size, size), Image.LANCZOS)


draw(192).save(os.path.join(OUT, 'icon-192.png'))
draw(512).save(os.path.join(OUT, 'icon-512.png'))
draw(512, rounded=False, scale=0.8).save(os.path.join(OUT, 'icon-maskable-512.png'))
# 아이폰은 투명 모서리를 검게 칠하므로 꽉 찬 사각형
draw(180, rounded=False).save(os.path.join(OUT, 'apple-touch-icon.png'))
print('ok')
