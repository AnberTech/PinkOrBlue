#!/usr/bin/env python3
"""PinkOrBlue sitesini üretir (depo kökünden):  python3 _src/build.py

- Tanıtım metinleri: _src/i18n/<dil>.json   (ana sayfa + oda oluşturucu sayfası başlıkları, SSS)
- Uygulama metinleri: _src/ui/<dil>.json    (ekranlardaki tüm yazılar; anahtarlar iki dilde aynı olmalı)
- Gizlilik/destek:    _src/legal/<dil>.json
- Stil: _src/site.css (sayfalara gömülür), JS: _src/js/*.js -> assets/js/
- Firebase: _src/firebase-config.json + DB_URL
Üretilen HTML dosyalarını elle düzenleme. Jekyll "_" ile başlayan klasörleri yayınlamaz.
"""
import datetime, html, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_src')
SITE = 'https://anbertech.github.io/PinkOrBlue/'
EMAIL = 'destek.anbertech@gmail.com'
DB_URL = 'https://pinkorblue-128d4-default-rtdb.europe-west1.firebasedatabase.app'
# kod, yerel ad, og:locale, yön, bayrak dosyası (NotHesaplayici/Kuafix ile aynı 17 dil)
ALL_LANGS = [
    ('tr', 'Türkçe', 'tr_TR', 'ltr', 'tr.svg'), ('en', 'English', 'en_US', 'ltr', 'en.svg'),
    ('ar', 'العربية', 'ar_AR', 'rtl', 'ar.svg'), ('de', 'Deutsch', 'de_DE', 'ltr', 'de.svg'),
    ('es', 'Español', 'es_ES', 'ltr', 'es.png'), ('fr', 'Français', 'fr_FR', 'ltr', 'fr.svg'),
    ('hi', 'हिन्दी', 'hi_IN', 'ltr', 'hi.svg'), ('id', 'Bahasa Indonesia', 'id_ID', 'ltr', 'id.svg'),
    ('it', 'Italiano', 'it_IT', 'ltr', 'it.svg'), ('ja', '日本語', 'ja_JP', 'ltr', 'ja.svg'),
    ('ko', '한국어', 'ko_KR', 'ltr', 'ko.svg'), ('ku', 'Kurdî', 'ku_TR', 'ltr', None),
    ('nl', 'Nederlands', 'nl_NL', 'ltr', 'nl.svg'), ('pl', 'Polski', 'pl_PL', 'ltr', 'pl.svg'),
    ('pt', 'Português', 'pt_BR', 'ltr', 'pt-br.svg'), ('ru', 'Русский', 'ru_RU', 'ltr', 'ru.svg'),
    ('zh-Hans', '简体中文', 'zh_CN', 'ltr', 'zh-hans.svg'),
]
# Yalnızca üç dosyası da hazır olan diller üretilir (yarım çeviri yayına çıkmaz)
LANGS = [l for l in ALL_LANGS if all(os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), k, l[0] + '.json')) for k in ('i18n', 'ui', 'legal'))]
LANG_INFO = {l[0]: l for l in ALL_LANGS}
DOC_SLUGS = {c: ('gizlilik', 'destek') if c == 'tr' else ('privacy', 'support') for c, *_ in ALL_LANGS}
INVITE_SLUG = {c: 'parti' if c == 'tr' else 'party' for c, *_ in ALL_LANGS}   # davet linkleri: önizlemesi davete özel, arama dışı
FEAT_ICONS = ['🎈', '🤫', '👆', '🔮', '🎮', '🔒']
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com" />\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
         '<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@400;600;700;800&display=swap&subset=latin-ext" rel="stylesheet" />')
FONTS_AR = '<link href="https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@600;800&display=swap" rel="stylesheet" />'
VER = datetime.datetime.now().strftime('%Y%m%d%H%M')


def e(s):
    return html.escape(str(s), quote=True)


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(rel, text):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(text)


def load(kind, code):
    return json.loads(read(os.path.join(SRC, kind, code + '.json')))


def ldir(code):
    return '' if code == 'tr' else code.lower() + '/'


def html_attrs(c):
    return f'lang="{c}" dir="{LANG_INFO[c][3]}"'


def url_home(c): return SITE + ldir(c)
def url_app(c, T): return SITE + ldir(c) + T[c]['fx_slug'] + '/'
def url_doc(c, i): return SITE + ldir(c) + DOC_SLUGS[c][i] + '/'


def check(T, U, L):
    errs = []
    keys = set(T['tr'])
    for c in T:
        if set(T[c]) != keys:
            errs.append(f'i18n/{c}: anahtar farkı {sorted(set(T[c]) ^ keys)}')
        for k, n in {'steps': 3, 'feats': 6, 'faq_home': 8}.items():
            if len(T[c][k]) != n:
                errs.append(f'i18n/{c}: {k} {n} adet olmalı')
        if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', T[c]['fx_slug']):
            errs.append(f'i18n/{c}: fx_slug ASCII küçük harf ve tire olmalı')
        for k, v in T[c].items():
            if isinstance(v, str) and '<' in v and k != '_note' and (not k.endswith('_html') or re.sub(r'</?(b|em|br)\s*/?>', '', v).count('<')):
                errs.append(f'i18n/{c}: {k} izin verilmeyen HTML')
    ukeys = set(U['tr'])
    for c in U:
        if set(U[c]) != ukeys:
            errs.append(f'ui/{c}: anahtar farkı {sorted(set(U[c]) ^ ukeys)}')
        for k in ukeys:
            a, b = re.findall(r'%[sd]', U['tr'][k]), re.findall(r'%[sd]', U[c][k])
            if a != b:
                errs.append(f'ui/{c}: {k} yer tutucular tr ile aynı sırada olmalı ({a} / {b})')
    for c in L:
        if len(L[c]['pv_sections']) != len(L['tr']['pv_sections']):
            errs.append(f'legal/{c}: bölüm sayısı farklı')
    if errs:
        sys.exit('HATA:\n  ' + '\n  '.join(errs))


def head(c, title, desc, url, base, alts, noindex=False, og_img='og.jpg'):
    links = ''.join(f'<link rel="alternate" hreflang="{k}" href="{e(v)}" />\n' for k, v in alts.items())
    if 'en' in alts:
        links += f'<link rel="alternate" hreflang="x-default" href="{e(alts["en"])}" />\n'
    og = SITE + 'assets/img/' + og_img
    return f'''<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}" />
{'<meta name="robots" content="noindex" />' if noindex else ''}
<meta name="theme-color" content="#FFF8EE" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#17121F" media="(prefers-color-scheme: dark)" />
<link rel="icon" type="image/png" sizes="64x64" href="{base}assets/img/favicon.png?v=3" />
<link rel="icon" type="image/png" sizes="32x32" href="{base}assets/img/favicon-32.png?v=3" />
<link rel="apple-touch-icon" href="{base}assets/img/icon-180.png" />
<link rel="manifest" href="{base}manifest.webmanifest" />
<link rel="canonical" href="{e(url)}" />
{links}<meta property="og:type" content="website" />
<meta property="og:site_name" content="PinkOrBlue" />
<meta property="og:locale" content="{dict((l[0], l[2]) for l in LANGS)[c]}" />
<meta property="og:title" content="{e(title)}" />
<meta property="og:description" content="{e(desc)}" />
<meta property="og:url" content="{e(url)}" />
<meta property="og:image" content="{og}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="{og}" />
{FONTS}
{FONTS_AR if c == 'ar' else ''}
<style>{read(os.path.join(SRC, 'site.css'))}</style>
<script data-goatcounter="https://anbertech.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>'''


def topbar(c, base, T, alts, sound=False):
    names = dict((l[0], l[1]) for l in LANGS)
    flag = lambda k: f'<img src="{base}assets/img/flags/{LANG_INFO[k][4]}" alt="" width="20" height="14" />' if LANG_INFO[k][4] else '<span class="noflag">🌐</span>'
    items = ''.join(f'<a href="{e(alts[k])}" hreflang="{k}" lang="{k}"{" aria-current=\"page\"" if k == c else ""}>{flag(k)}<span>{e(names[k])}</span></a>' for k, *_ in LANGS if k in alts)
    lang = (f'<details class="lang-menu"><summary aria-label="Language">{flag(c)}<b>{c.upper()}</b></summary><nav class="lang lm-list" aria-label="Language">{items}</nav></details>'
            '<script>(function(d){var m=d.querySelector(".lang-menu");if(!m)return;d.addEventListener("click",function(e){if(m.open&&!m.contains(e.target))m.open=false});'
            'd.addEventListener("keydown",function(e){if(e.key==="Escape"&&m.open){m.open=false;m.querySelector("summary").focus()}})})(document);</script>')
    snd = '<button class="icon-btn" id="sound" type="button">🔊</button>' if sound else ''
    splash = f'''<div id="splash" aria-hidden="true"><div class="sp-in"><img class="sp-b" src="{base}assets/img/balloon-icon-180.png" alt="" width="120" height="120" /><p class="sp-w"><b>Pink</b>Or<i>Blue</i></p><p class="sp-by">by <img class="am-d" src="{base}assets/img/anbertech.png" alt="" width="22" height="20" /><img class="am-l" src="{base}assets/img/anbertech-ink.png" alt="" width="22" height="20" /><span>Anber<em>Tech</em></span></p></div></div>
<script>(function(){{var s=document.getElementById("splash");try{{var r=document.referrer;if(r&&new URL(r).host===location.host&&sessionStorage.getItem("pob_sp")){{s.remove();return}}sessionStorage.setItem("pob_sp","1")}}catch(e){{}}document.documentElement.classList.add("sp-on");setTimeout(function(){{s.classList.add("out");document.documentElement.classList.remove("sp-on")}},1250);setTimeout(function(){{s.remove()}},1750);s.onclick=function(){{s.classList.add("out");document.documentElement.classList.remove("sp-on")}}}})();</script>'''
    return f'''{splash}<header class="top"><div class="wrap">
  <a class="logo" href="{base}{ldir(c)}"><img src="{base}assets/img/balloon-icon-180.png" alt="" width="34" height="34" /><span><b>Pink</b>Or<i>Blue</i></span></a>
  <span class="sp"></span>{lang}{snd}
</div></header>'''


def footer(c, base, T, L, compact=True):
    return f'''<footer class="mini"><div class="wrap">
  <a class="foot-brand" href="https://anbertech.github.io/" rel="noopener">© {datetime.date.today().year} <img class="am-d" src="{base}assets/img/anbertech.png" alt="" width="18" height="16" /><img class="am-l" src="{base}assets/img/anbertech-ink.png" alt="" width="18" height="16" /><span>Anber<em>Tech</em></span></a>
  <nav><a href="{base}{ldir(c)}{DOC_SLUGS[c][0]}/">{e(L[c]['pv_title'])}</a><a href="{base}{ldir(c)}{DOC_SLUGS[c][1]}/">{e(L[c]['sp_title'])}</a></nav>
</div></footer>'''


def jsonld(graph):
    return '<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'


ORG = {'@type': 'Organization', '@id': 'https://anbertech.github.io/#org', 'name': 'AnberTech', 'url': 'https://anbertech.github.io/', 'email': EMAIL}


def webapp(c, T):
    t = T[c]
    return {'@type': 'WebApplication', '@id': SITE + '#app', 'name': 'PinkOrBlue', 'url': url_app(c, T), 'applicationCategory': 'LifestyleApplication',
            'operatingSystem': 'Any (web browser)', 'inLanguage': c, 'description': t['meta_desc'], 'isAccessibleForFree': True,
            'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'}, 'publisher': {'@id': ORG['@id']}}


def faq_html(t):
    qa = ''.join(f'<details class="qa"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in t['faq_home'])
    return f'<section class="sec faq" aria-labelledby="faq-h"><div class="wrap"><p class="eyebrow">{e(t["faq_eyebrow"])}</p><h2 class="h2" id="faq-h">{e(t["faq_h2"])}</h2>{qa}</div></section>'


def how_html(t):
    steps = ''.join(f'<div class="step"><h3>{e(a)}</h3><p>{e(b)}</p></div>' for a, b in t['steps'])
    return f'<section class="sec" aria-labelledby="how-h"><div class="wrap"><p class="eyebrow">{e(t["how_eyebrow"])}</p><h2 class="h2" id="how-h">{e(t["how_h2"])}</h2><div class="steps">{steps}</div></div></section>'


def page_home(c, T, L):
    t, base = T[c], ('' if c == 'tr' else '../')
    alts = {k: url_home(k) for k, *_ in LANGS}
    app_href = f'{t["fx_slug"]}/'
    feats = ''.join(f'<div class="feat"><span class="fi" aria-hidden="true">{FEAT_ICONS[i]}</span><h3>{e(a)}</h3><p>{e(b)}</p></div>' for i, (a, b) in enumerate(t['feats']))
    ld = jsonld([ORG, {'@type': 'WebSite', '@id': SITE + '#site', 'name': 'PinkOrBlue', 'url': SITE, 'publisher': {'@id': ORG['@id']}, 'inLanguage': [k for k, *_ in LANGS]},
                 webapp(c, T), {'@type': 'WebPage', 'name': t['title'], 'url': url_home(c), 'inLanguage': c, 'isPartOf': {'@id': SITE + '#site'}, 'about': {'@id': SITE + '#app'}},
                 {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in t['faq_home']]}])
    return f'''<!doctype html>
<html {html_attrs(c)}>
<head>
{head(c, t['title'], t['meta_desc'], url_home(c), base, alts)}
{ld}
</head>
<body>
<a class="skip" href="#main">↓</a>
{topbar(c, base, T, alts)}
<main id="main">
<section class="hero"><div class="wrap">
  <div>
    <p class="eyebrow">{e(t['hero_eyebrow'])}</p>
    <h1>{t['hero_h1_html']}</h1>
    <p class="sub">{e(t['hero_sub'])}</p>
    <div class="cta"><a class="btn btn-gold" data-goatcounter-click="pob/{c.lower()}/ana-cta" href="{app_href}">🎈 {e(t['hero_cta'])}</a><span class="muted small">{e(t['hero_note'])}</span></div>
  </div>
  <div class="hero-art" aria-hidden="true">
    <img class="bp" src="{base}assets/img/balloon-pink.png" alt="" width="300" height="300" />
    <img class="bb" src="{base}assets/img/balloon-blue.png" alt="" width="300" height="300" />
    <img class="gf" src="{base}assets/img/gift.png" alt="" width="480" height="480" />
    <img class="st" src="{base}assets/img/stork.png" alt="" width="560" height="560" />
  </div>
</div></section>
{how_html(t)}
<section class="sec" aria-labelledby="ft-h"><div class="wrap"><p class="eyebrow">{e(t['feats_eyebrow'])}</p><h2 class="h2" id="ft-h">{e(t['feats_h2'])}</h2><div class="feats">{feats}</div></div></section>
<section class="sec"><div class="wrap"><div class="band"><h2>{e(t['fx_name'])}</h2><p class="muted">{e(t['fx_sub'])}</p><a class="btn btn-gold" data-goatcounter-click="pob/{c.lower()}/ana-cta2" href="{app_href}">🎈 {e(t['hero_cta'])}</a></div></div></section>
{faq_html(t)}
</main>
{footer(c, base, T, L)}
</body>
</html>
'''


def url_invite(c): return SITE + ldir(c) + INVITE_SLUG[c] + '/'


def page_app(c, T, U, L, fbcfg, invite=False):
    t, base = T[c], ('../' if c == 'tr' else '../../')
    if invite:
        alts = {k: url_invite(k) for k, *_ in LANGS}
        title, desc, url, og = t['inv_title'], t['inv_desc'], url_invite(c), f'og-invite-{c.lower()}.jpg'
    else:
        alts = {k: url_app(k, T) for k, *_ in LANGS}
        title, desc, url, og = t['fx_title'], t['fx_desc'], url_app(c, T), 'og.jpg'
    ld = '' if invite else jsonld([ORG, webapp(c, T), {'@type': 'WebPage', 'name': t['fx_title'], 'url': url_app(c, T), 'inLanguage': c, 'about': {'@id': SITE + '#app'}}])
    cfg = dict(fbcfg); cfg['databaseURL'] = DB_URL
    cfg = {k: cfg[k] for k in ('apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId', 'messagingSenderId')}
    paths = {'POB_INVITE': '../' + INVITE_SLUG[c] + '/', 'POB_CREATE': '../' + t['fx_slug'] + '/', 'POB_IS_INVITE': invite}
    adir = os.path.join(ROOT, 'assets', 'audio')
    paths['POB_AUDIO'] = sorted(f[:-4] for f in os.listdir(adir) if f.endswith('.mp3')) if os.path.isdir(adir) else []
    intro = '' if invite else f'''<div class="app-intro">
    <img src="{base}assets/img/stork.png" alt="" width="560" height="560" />
    <h1>{t['fx_h1_html']}</h1>
    <p class="muted">{e(t['fx_sub'])}</p>
  </div>'''
    seo = '' if invite else f'<div class="seo">\n{how_html(t)}\n{faq_html(t)}\n</div>'
    return f'''<!doctype html>
<html {html_attrs(c)}>
<head>
{head(c, title, desc, url, base, alts, noindex=invite, og_img=og)}
{ld}
<script>window.POB_FB={json.dumps(cfg)};window.POB_S={json.dumps(U[c], ensure_ascii=False).replace('</', '<\\/')};{''.join(f'window.{k}={json.dumps(v)};' for k, v in paths.items())}</script>
<script type="module" src="{base}assets/js/app.js?v={VER}"></script>
</head>
<body class="app-page" data-view="{'room' if invite else 'create'}">
<a class="skip" href="#app">↓</a>
{topbar(c, base, T, alts, sound=True)}
<main>
  {intro}
  <div id="app"><noscript><div class="card">JavaScript gerekli / JavaScript required.</div></noscript></div>
</main>
{seo}
{footer(c, base, T, L, compact=True)}
</body>
</html>
'''


def page_doc(c, i, T, L):
    t, l = T[c], L[c]
    base = '../' if c == 'tr' else '../../'
    alts = {k: url_doc(k, i) for k, *_ in LANGS}
    if i == 0:
        title, desc = l['pv_title'], l['pv_desc']
        secs = ''.join(f'<h2>{e(h)}</h2>{b}' for h, b in l['pv_sections'])
        body = f'<h1>{e(title)}</h1><p class="muted">{e(l["pv_updated"])} {e(l["pv_date"])}</p><div class="card">{secs}<p><a href="mailto:{EMAIL}">{EMAIL}</a></p></div>'
    else:
        title, desc = l['sp_title'], l['sp_desc']
        qa = ''.join(f'<details class="qa"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in t['faq_home'])
        body = f'<h1>{e(title)}</h1><div class="card"><p>{e(l["sp_text"])}</p><p><a class="btn btn-gold" href="mailto:{EMAIL}">✉️ {EMAIL}</a></p></div><section class="faq"><h2>{e(l["sp_faq"])}</h2>{qa}</section>'
    return f'''<!doctype html>
<html {html_attrs(c)}>
<head>
{head(c, title + ' – PinkOrBlue', desc, url_doc(c, i), base, alts)}
</head>
<body class="doc">
{topbar(c, base, T, alts)}
<main>{body}</main>
{footer(c, base, T, L)}
</body>
</html>
'''


def llms(T):
    return f'''# PinkOrBlue

> PinkOrBlue is a free, no-sign-up website for hosting a live online gender reveal party. Parents open a room and share one link with family and friends (designed for around 30 guests). Everyone votes Boy or Girl and can add guesses (birth date, weight, first letter). The waiting room shows by name who has voted and who is online; the votes themselves stay secret until the reveal. When the host (or a trusted person the host picks) starts the reveal, everyone taps their screen to inflate one giant balloon together, it pops, and the result appears on every screen in the same second. There is a mini game (Balloon Pop) for the wait. No ads, no accounts, no app to install; room data is deleted automatically 7 days after the party date.

Use it when someone wants to: host a virtual or long-distance gender reveal, include family who live in another city or country, run a boy-or-girl poll or "Team Pink vs Team Blue" vote among friends, add a game to a gender reveal party, or reveal the baby's gender to a group chat at the same time.

## Start a reveal room (web, free, no sign-up)

{chr(10).join(f"- {LANG_INFO[c][1]} ({c}): {url_app(c, T)}" for c, *_ in LANGS)}

## How it works

1. The host types a baby nickname and the reveal date, optionally adds a guest list, and enters the result secretly (or hands the secret to someone else, so the host is surprised too).
2. The host shares the room link (for example in a WhatsApp or family group chat).
3. Guests open the link in any browser, pick or type their name, vote Boy or Girl and add guesses.
4. The host starts the reveal: a synchronized 22-second show with countdown, collective balloon inflating and confetti plays for everyone at once, followed by a result card showing who guessed right.

## Key facts

- Price: free. No ads, no subscription.
- No account and no e-mail; guests only type a name (a nickname is fine).
- Works in any modern browser on phone, tablet or computer; nothing to download.
- Each family's room is separate with its own link; many families can use it at the same time.
- Privacy: stores only room details, guest names, votes, guesses and mini-game scores (Firebase Realtime Database, anonymous authentication). No ads or tracking cookies; only cookieless, anonymous visit counting (GoatCounter) with no names, votes or room data. All room data is deleted 7 days after the party date; the host can delete the room at any time.
- Not directed at children under 13.

## Pages

{chr(10).join(f"- {LANG_INFO[c][1]}: {url_home(c)}" for c, *_ in LANGS)}
- Privacy (EN): {url_doc('en', 0)}
- Gizlilik (TR): {url_doc('tr', 0)}

## Türkçe özet

PinkOrBlue, ücretsiz ve üyeliksiz bir online cinsiyet partisi sitesidir. Aile bir oda açıp linki paylaşır; misafirler "kız mı erkek mi" oylar ve tahmin yazar. Kimin oy verdiği isimleriyle görünür, oylar açılışa kadar gizli kalır. Kurucu açılışı başlatınca herkes ekrana dokunarak dev balonu birlikte şişirir ve sonuç herkesin ekranında aynı anda açılır. Uzaktaki aileler için uygundur. Reklam yok, uygulama indirmek gerekmez, veriler parti tarihinden 7 gün sonra silinir. Oda açmak için: {url_app('tr', T)}

Contact: {EMAIL}
'''


def main():
    T = {c: load('i18n', c) for c, *_ in LANGS}
    U = {c: load('ui', c) for c, *_ in LANGS}
    L = {c: load('legal', c) for c, *_ in LANGS}
    check(T, U, L)
    fbcfg = json.loads(read(os.path.join(SRC, 'firebase-config.json')))
    if not {'tr', 'en'} <= {c for c, *_ in LANGS}:
        sys.exit('HATA: tr ve en dil dosyaları zorunlu')
    for c, *_ in ALL_LANGS:   # kaldırılan dilin eski sayfaları yayında kalmasın
        d = os.path.join(ROOT, ldir(c))
        if c != 'tr' and c not in T and os.path.isdir(d) and os.path.exists(os.path.join(d, 'index.html')):
            shutil.rmtree(d); print('kaldırıldı:', ldir(c))
    for c, *_ in LANGS:
        paths = [T[c]['fx_slug'], INVITE_SLUG[c], *DOC_SLUGS[c]]
        if len(set(paths)) != len(paths):
            sys.exit(f'HATA: {c} adresleri çakışıyor: {paths}')
    urls = []
    for c, *_ in LANGS:
        write(ldir(c) + 'index.html', page_home(c, T, L)); urls.append(url_home(c))
        write(ldir(c) + T[c]['fx_slug'] + '/index.html', page_app(c, T, U, L, fbcfg)); urls.append(url_app(c, T))
        write(ldir(c) + INVITE_SLUG[c] + '/index.html', page_app(c, T, U, L, fbcfg, invite=True))
        for i in (0, 1):
            write(ldir(c) + DOC_SLUGS[c][i] + '/index.html', page_doc(c, i, T, L)); urls.append(url_doc(c, i))
    js = os.path.join(ROOT, 'assets', 'js'); os.makedirs(js, exist_ok=True)
    for f in os.listdir(os.path.join(SRC, 'js')):
        if f.endswith('.js'):
            src = read(os.path.join(SRC, 'js', f))
            src = re.sub(r'(from "\./[\w]+\.js)"', rf'\1?v={VER}"', src)
            write(f'assets/js/{f}', src)
    today = datetime.date.today().isoformat()
    sm = ''.join(f'<url><loc>{u}</loc><lastmod>{today}</lastmod></url>\n' for u in urls)
    write('sitemap.xml', f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{sm}</urlset>\n')
    write('llms.txt', llms(T))
    write('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n')
    write('manifest.webmanifest', json.dumps({'name': 'PinkOrBlue', 'short_name': 'PinkOrBlue', 'start_url': './' + T['tr']['fx_slug'] + '/', 'display': 'standalone',
                                              'background_color': '#FFF8EE', 'theme_color': '#FFF8EE',
                                              'icons': [{'src': 'assets/img/icon-180.png', 'sizes': '180x180', 'type': 'image/png'}, {'src': 'assets/img/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]}, indent=1))
    print(f'{len(urls)} sayfa üretildi, sürüm {VER}')


if __name__ == '__main__':
    main()
