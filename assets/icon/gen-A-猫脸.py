"""方案 A：手绘风猫脸 + ¥ 金币。纯矢量绘制，任何尺寸都清晰。"""
from PIL import Image, ImageDraw, ImageFilter
import math

SS = 4                      # 超采样倍数，抗锯齿
S = 1024
W = S * SS

BRAND_A = (255, 132, 74)
BRAND_B = (250, 49, 45)
CREAM   = (255, 249, 242)
INK     = (60, 30, 22)
GOLD_A  = (255, 208, 92)
GOLD_B  = (245, 166, 35)
PINK    = (255, 138, 138)

def gradient(size, a, b):
    g = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(g)
    for i in range(size * 2):
        t = i / (size * 2 - 1)
        d.line([(i, 0), (0, i)],
               fill=tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3)))
    return g

def P(x, y):
    """设计稿按 1024 画，这里放大到超采样画布"""
    return (x * SS, y * SS)

def poly(d, pts, **kw):
    d.polygon([P(*p) for p in pts], **kw)

def ellipse(d, box, **kw):
    x0, y0, x1, y1 = box
    d.ellipse([P(x0, y0), P(x1, y1)], **kw)

def line(d, pts, width=1, **kw):
    d.line([P(*p) for p in pts], width=width * SS, **kw)

img = gradient(W, BRAND_A, BRAND_B).convert('RGBA')

# 背景同心圆
deco = Image.new('RGBA', (W, W), (0, 0, 0, 0))
dd = ImageDraw.Draw(deco)
for r, a in ((470, 20), (360, 16), (250, 13)):
    dd.ellipse([P(512 - r, 512 - r), P(512 + r, 512 + r)],
               outline=(255, 255, 255, a), width=20 * SS)
img = Image.alpha_composite(img, deco)

d = ImageDraw.Draw(img)

# ── 猫耳（先画，被脸盖住底部）──
poly(d, [(318, 352), (352, 196), (486, 300)], fill=CREAM)
poly(d, [(706, 352), (672, 196), (538, 300)], fill=CREAM)
# 耳内粉色
poly(d, [(360, 330), (378, 250), (448, 302)], fill=PINK)
poly(d, [(664, 330), (646, 250), (576, 302)], fill=PINK)

# ── 脸 ──
ellipse(d, (286, 250, 738, 664), fill=CREAM)

# ── 眼睛：竖瞳，返利 App 要显得机灵 ──
for cx in (424, 600):
    ellipse(d, (cx - 40, 404, cx + 40, 496), fill=INK)
    ellipse(d, (cx - 13, 418, cx + 13, 482), fill=(255, 255, 255))
    ellipse(d, (cx - 20, 412, cx - 4, 432), fill=(255, 255, 255))

# ── 鼻子和嘴 ──
poly(d, [(492, 520), (532, 520), (512, 546)], fill=PINK)
line(d, [(512, 546), (512, 564)], width=9, fill=INK)
d.arc([P(462, 534), P(512, 594)], 290, 70, fill=INK, width=9 * SS)
d.arc([P(512, 534), P(562, 594)], 110, 250, fill=INK, width=9 * SS)

# ── 胡须 ──
for sx, dx in ((300, -1), (724, 1)):
    for dy, spread in ((-28, -18), (4, 0), (36, 18)):
        line(d, [(512 + dx * 96, 520 + dy),
                 (512 + dx * 232, 520 + dy + spread)], width=7, fill=INK)

# ── 金币：¥ 说明这是返利 App ──
coin = Image.new('RGBA', (W, W), (0, 0, 0, 0))
cd = ImageDraw.Draw(coin)
cd.ellipse([P(606, 620), P(842, 856)], fill=GOLD_B)
cd.ellipse([P(616, 624), P(832, 840)], fill=GOLD_A)
cd.ellipse([P(642, 650), P(806, 814)], outline=GOLD_B, width=8 * SS)
# ¥ 符号
cx, cy = 724, 732
cd.line([P(cx - 42, cy - 52), P(cx, cy - 2)], fill=GOLD_B, width=15 * SS)
cd.line([P(cx + 42, cy - 52), P(cx, cy - 2)], fill=GOLD_B, width=15 * SS)
cd.line([P(cx, cy - 2), P(cx, cy + 56)], fill=GOLD_B, width=15 * SS)
cd.line([P(cx - 36, cy + 10), P(cx + 36, cy + 10)], fill=GOLD_B, width=13 * SS)
cd.line([P(cx - 36, cy + 34), P(cx + 36, cy + 34)], fill=GOLD_B, width=13 * SS)

# 金币投影
a = coin.split()[3].point(lambda v: v * 55 // 100)
sh = Image.new('RGBA', coin.size, (120, 25, 12, 0)); sh.putalpha(a)
sh = sh.filter(ImageFilter.GaussianBlur(14 * SS))
img.alpha_composite(sh, (0, 6 * SS))
img.alpha_composite(coin)

# ── 圆角裁切 ──
mask = Image.new('L', (W, W), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=225 * SS, fill=255)

out = Image.new('RGBA', (W, W), (0, 0, 0, 0))
out.paste(img, (0, 0), mask)
out = out.resize((S, S), Image.LANCZOS)

out.save('icon-a2-rounded-1024.png')
for s in (512, 256, 180, 120, 64):
    out.resize((s, s), Image.LANCZOS).save(f'icon-a2-rounded-{s}.png')

sq = img.resize((S, S), Image.LANCZOS).convert('RGB')
sq.save('icon-a2-square-1024.png')
for s in (512, 256, 180, 120, 64):
    sq.resize((s, s), Image.LANCZOS).save(f'icon-a2-square-{s}.png')
print('A done')
