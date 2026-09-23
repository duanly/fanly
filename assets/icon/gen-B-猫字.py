# -*- coding: utf-8 -*-
"""方案 B2：「猫」字 + 猫耳圆章"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SS = 4
D  = 1024
C  = D * SS
def s(v): return int(round(v * SS))

BRAND_A = (255, 132, 74)
BRAND_B = (250, 49, 45)
CREAM   = (255, 249, 242)
GOLD_A  = (255, 208, 92)
GOLD_B  = (245, 166, 35)
PINK    = (255, 138, 138)
CHAR    = (243, 78, 51)

FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"

bg = Image.new("RGB", (C, C), BRAND_A)
dr = ImageDraw.Draw(bg)
for y in range(C):
    t = y / (C - 1)
    dr.line([(0, y), (C, y)], fill=tuple(
        int(BRAND_A[i] + (BRAND_B[i] - BRAND_A[i]) * t) for i in range(3)))
bg = bg.convert("RGBA")

deco = Image.new("RGBA", (C, C), (0, 0, 0, 0))
dd = ImageDraw.Draw(deco)
for rad in (300, 400, 500, 600):
    dd.ellipse([s(512 - rad), s(478 - rad), s(512 + rad), s(478 + rad)],
               outline=(255, 255, 255, 26), width=s(3))
bg = Image.alpha_composite(bg, deco)
d = ImageDraw.Draw(bg)

CX, CY, R = 512, 478, 256

# 投影
sh = Image.new("RGBA", (C, C), (0, 0, 0, 0))
ImageDraw.Draw(sh).ellipse([s(CX - R), s(CY - R + 16), s(CX + R), s(CY + R + 16)],
                           fill=(120, 20, 10, 105))
sh = sh.filter(ImageFilter.GaussianBlur(s(12)))
bg = Image.alpha_composite(bg, sh)
d = ImageDraw.Draw(bg)

# 耳朵（先画，底部被圆章盖住）
def ear(pts, inner):
    d.polygon([(s(x), s(y)) for x, y in pts], fill=CREAM)
    d.polygon([(s(x), s(y)) for x, y in inner], fill=PINK)

ear([(318, 330), (350, 150), (494, 268)],
    [(352, 312), (368, 214), (444, 276)])
ear([(706, 330), (674, 150), (530, 268)],
    [(672, 312), (656, 214), (580, 276)])

# 圆章
d.ellipse([s(CX - R), s(CY - R), s(CX + R), s(CY + R)], fill=CREAM)

# 胡须
def whisker(x1, y1, x2, y2, w=9):
    d.line([(s(x1), s(y1)), (s(x2), s(y2))], fill=CREAM, width=s(w))
for dy, drop in ((-46, -18), (6, 0), (58, 20)):
    whisker(258, 486 + dy, 108, 462 + dy + drop)
    whisker(766, 486 + dy, 916, 462 + dy + drop)

# 「猫」
font = ImageFont.truetype(FONT, s(310), index=2)
d.text((s(CX), s(CY + 6)), "猫", font=font, fill=CHAR, anchor="mm")

# 金币
box = (628, 662, 868, 902)
cs = Image.new("RGBA", (C, C), (0, 0, 0, 0))
ImageDraw.Draw(cs).ellipse([s(box[0] + 6), s(box[1] + 12), s(box[2] + 6), s(box[3] + 12)],
                           fill=(90, 20, 10, 115))
cs = cs.filter(ImageFilter.GaussianBlur(s(8)))
bg = Image.alpha_composite(bg, cs)
d = ImageDraw.Draw(bg)

d.ellipse([s(v) for v in box], fill=GOLD_B)
d.ellipse([s(box[0] + 16), s(box[1] + 16), s(box[2] - 16), s(box[3] - 16)], fill=GOLD_A)
d.ellipse([s(box[0] + 30), s(box[1] + 30), s(box[2] - 30), s(box[3] - 30)],
          outline=GOLD_B, width=s(7))
yf = ImageFont.truetype(FONT, s(130), index=2)
d.text((s((box[0] + box[2]) / 2), s((box[1] + box[3]) / 2)), "¥",
       font=yf, fill=(196, 108, 12), anchor="mm")

mask = Image.new("L", (C, C), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, C - 1, C - 1], radius=s(225), fill=255)
out = Image.new("RGBA", (C, C), (0, 0, 0, 0))
out.paste(bg, (0, 0), mask)
for size in (1024, 512, 256, 180, 120, 64):
    out.resize((size, size), Image.LANCZOS).save(f"/root/icon/icon-b2-rounded-{size}.png")
sq = bg.convert("RGB")
for size in (1024, 512, 256, 180, 120, 64):
    sq.resize((size, size), Image.LANCZOS).save(f"/root/icon/icon-b2-square-{size}.png")
print("B2 done")
