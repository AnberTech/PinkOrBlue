#!/usr/bin/env python3
"""Her dil için WhatsApp davet görseli (assets/img/og-invite-<dil>.jpg) üretir.
Başlık metni: _src/i18n/<dil>.json → "og_inv" (satırlar "|" ile ayrılır).
Kullanım (site/ kökünden):  python3 _src/og/make_og.py [dil ...]
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
ROOT = os.path.dirname(SRC)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
RTL = {"ar"}
FONTS = ("https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Baloo+Bhaijaan+2:wght@800"
         "&family=Noto+Sans+JP:wght@800&family=Noto+Sans+KR:wght@800&family=Noto+Sans+SC:wght@800&family=Nunito:wght@800&display=swap")
STACK = '"Baloo 2","Baloo Bhaijaan 2","Noto Sans JP","Noto Sans KR","Noto Sans SC",system-ui'

TPL = """<!doctype html><html lang="{lang}" dir="{dir}"><head><meta charset="utf-8">
<link href="{fonts}" rel="stylesheet">
<style>
body{{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Nunito,{stack};position:relative;
 background:radial-gradient(60% 80% at 10% 10%,#FFD6E5,transparent 70%),radial-gradient(60% 80% at 95% 95%,#CFE9FF,transparent 70%),#FFF8EE}}
.t{{position:absolute;left:66px;top:86px;width:620px;z-index:2;direction:{dir};text-align:{align}}}
h1{{margin:0;font:800 {size}px/{lh} {stack};letter-spacing:-1px;color:#2B2140}}
h1 span{{display:table;white-space:nowrap}}
[dir=rtl] h1 span{{margin-left:auto}}
h1 .a{{color:#E0457E}} h1 .b{{background:linear-gradient(90deg,#E0457E,#3A8FE0);-webkit-background-clip:text;color:transparent}} h1 .c{{color:#2B7FD4}}
.brand{{display:flex;align-items:center;gap:14px;margin-top:34px;direction:ltr;justify-content:{jc}}}
.brand img{{width:58px}}
.brand b{{font:800 44px/1 "Baloo 2";color:#2B2140}} .brand b i{{font-style:normal;color:#E0457E}} .brand b u{{text-decoration:none;color:#2B7FD4}}
.by{{display:flex;align-items:center;gap:10px;margin-top:12px;font:800 26px/1 Nunito;color:#6E6380;direction:ltr;justify-content:{jc}}}
.by img{{width:34px}} .by em{{font-style:normal;color:#B8962E}}
.st{{position:absolute;width:470px;right:20px;top:130px;filter:drop-shadow(0 20px 26px rgba(43,33,64,.2))}}
.bp{{position:absolute;width:150px;right:430px;top:44px;transform:rotate(-8deg)}}
.bb{{position:absolute;width:140px;right:10px;top:50px;transform:rotate(8deg)}}
</style></head><body>
<img class="bp" src="{img}balloon-pink.png"><img class="bb" src="{img}balloon-blue.png"><img class="st" src="{img}stork.png">
<div class="t"><h1>{lines}</h1>
<div class="brand"><img src="{img}balloon-icon-180.png"><b>Pink<i>Or</i><u>Blue</u></b></div>
<div class="by">by <img src="{img}anbertech-ink.png"> <span>Anber<em>Tech</em></span></div></div>
<script>
// en uzun satır 600 px'e sığana kadar küçült (yazı tipleri yüklendikten sonra)
document.fonts.ready.then(function(){{var h=document.querySelector("h1"),fs=parseFloat(getComputedStyle(h).fontSize);
var w=function(){{return Math.max.apply(null,[].map.call(h.children,function(s){{return s.getBoundingClientRect().width}}))}};
while(w()>600&&fs>40){{fs-=2;h.style.fontSize=fs+"px"}}}});
</script>
</body></html>"""


def make(lang):
    t = json.load(open(os.path.join(SRC, "i18n", lang + ".json"), encoding="utf-8"))
    parts = [p.strip() for p in t["og_inv"].split("|") if p.strip()][:3]
    longest = max(len(p) for p in parts)
    cjk = lang in ("ja", "ko", "zh-Hans")
    size = 112 if longest <= 9 else 100 if longest <= 12 else 88 if longest <= 14 else 76
    if cjk: size = min(size, 96 if longest <= 6 else 80)
    cls = ["a", "b", "c"][:len(parts)] if len(parts) == 3 else ["a", "c"]
    lines = "".join(f'<span class="{c}">{p}</span>' for c, p in zip(cls, parts))
    html = TPL.format(lang=lang, dir="rtl" if lang in RTL else "ltr", align="right" if lang in RTL else "left",
                      jc="flex-end" if lang in RTL else "flex-start", fonts=FONTS, stack=STACK, size=size,
                      lh="1.15" if lang in RTL or lang == "hi" else ".95", lines=lines,
                      img="file://" + os.path.join(ROOT, "assets", "img") + "/")
    with tempfile.TemporaryDirectory() as d:
        h = os.path.join(d, "og.html"); open(h, "w", encoding="utf-8").write(html)
        png = os.path.join(d, "og.png")
        subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--window-size=1200,630", "--virtual-time-budget=7000",
                        "--allow-file-access-from-files", f"--screenshot={png}", "file://" + h], capture_output=True)
        out = os.path.join(ROOT, "assets", "img", f"og-invite-{lang.lower()}.jpg")
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "86", png, "--out", out], capture_output=True)
    print("og:", lang, os.path.getsize(out))


if __name__ == "__main__":
    langs = sys.argv[1:] or [f[:-5] for f in sorted(os.listdir(os.path.join(SRC, "i18n"))) if f.endswith(".json")]
    for l in langs:
        make(l)
