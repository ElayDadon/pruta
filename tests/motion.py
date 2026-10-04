#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tests/motion.py — בדיקת התנועה של "פרוטה", פריים אחרי פריים.

הפתיח וקליטת הקובץ הם שני רצפים ארוכים עם עשרות אובייקטים שזזים יחד. "נראה לי בסדר" לא מספיק,
ולכן הבדיקה הזו פותחת דפדפן אמיתי, עוצרת את ציר הזמן, ומתקדמת בו בצעדים של 20 אלפיות שנייה
בתשע צורות מסך — מטלפון של 320 פיקסלים ועד מסך רחב. בכל צעד היא בודקת את הכללים של docs/MOTION.md:

  1. שום תג לא עובר מעל טקסט (הכיתוב, הסכום, המספרים, שמות העמודות).
  2. שום דבר לא יוצא מהמסך.
  3. בפתיח, אף תג לא עף מעל תג שכבר נח — ובמנוחה אף תג לא נוגע בשכנו.
  4. כל תג נוחת בעמודה של הקטגוריה שלו. (בטלפון צר מ-360 פיקסלים אין לתגים העליונים דרך מסביב לסכום;
     שם מותר לתג להימוג במקומו במקום לחצות אותו — ורק שם.)
  5. בסוף הפתיח המטבע נוחת על סמל האתר בדיוק של פיקסל.
  6. הסכום הרץ אף פעם לא מקדים את ההוצאות שעל המסך, ומסתיים בדיוק בסכום שלהן (נבדק בזמן אמת).
  7. עם "הפחתת תנועה" אין רצפים בכלל — וגם הכפתורים שפותחים אותם לא מופיעים.
  8. ההדמיות (ui/stories.js — סיפור החודש, סיפור השנה, הקבועות, הכל מסודר): בכל צעד, שום טקסט לא
     עולה על טקסט אחר, שום דבר שזז לא עובר מעל טקסט, ושום דבר לא יוצא מהמסך; כרטיסים ופוסטרים לא
     עוברים זה מעל זה; וב"הכל מסודר" כל בית עסק נוחת בעמודה של הקטגוריה שקיבל.

הרצה:   python3 tests/motion.py            (כל הבדיקות, כמה דקות)
        python3 tests/motion.py --quick    (שלוש צורות מסך)
דרישות: pip install playwright && playwright install chromium
        (זו הבדיקה היחידה בפרויקט שצריכה התקנה; האפליקציה עצמה ו-tests/run.js לא תלויות בכלום.
         כשאי אפשר להוריד את Chromium, הבדיקה רצה ב-Edge או ב-Chrome שכבר מותקנים במחשב.)
"""
import contextlib
import functools
import http.server
import os
import socket
import sys
import threading

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit('חסר Playwright:  pip install playwright && playwright install chromium')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENS = [(1440, 900), (1920, 1080), (1280, 600), (1024, 768), (768, 1024), (844, 390), (390, 844), (360, 640), (320, 568)]
QUICK = [(1440, 900), (844, 390), (390, 844)]
STEP = 20  # אלפיות שנייה בין דגימה לדגימה

# עוצר את כל ההנפשות של הבמה ומעביר אותן לרגע t בציר הזמן
SEEK = """(t) => document.getAnimations().forEach((a) => {
  try { if (a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.fx')) { a.pause(); a.currentTime = t; } } catch (e) {}
})"""

# מה שנמדד בכל צעד. מחזיר רשימה של הפרות: [סוג, אינדקס התג]
MEASURE = """(kind) => {
  const fx = document.querySelector('.fx');
  const box = (n) => n.getBoundingClientRect();
  const seen = (n) => { let o = 1; for (let e = n; e && e !== fx; e = e.parentNode) o *= +getComputedStyle(e).opacity; return o; };
  const cover = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const text = [];
  const add = (sel, name) => document.querySelectorAll(sel).forEach((n) => { if (seen(n) > 0.3) text.push([name, box(n)]); });
  if (kind === 'intro') { add('.fx__cap p', 'caption'); add('.fx__total .fig', 'total'); add('.fx__total small', 'total'); }
  else add('.fxstats', 'figures');            // כרטיס הקובץ מצויר מעל התגים: הם יוצאים מאחוריו
  if (kind === 'sorted') { add('.fxs__word h2', 'title'); add('.fx__tag p', 'caption'); }
  add('.fxbar__val', 'bar value'); add('.fxbar__name', 'bar name');
  const out = [], chips = [];
  document.querySelectorAll('.fxchip').forEach((c, i) => {
    const o = seen(c), r = box(c);
    if (o < 0.25 || !r.width) return;
    if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) out.push(['off screen', i]);
    text.forEach((t) => { if (cover(r, t[1]) > 24) out.push(['over ' + t[0], i]); });
    if (o > 0.5) chips.push([i, r]);
  });
  // תג מעל תג (מלבנים מכווצים ב-6 פיקסלים: לתג מוטה יש פינות ריקות)
  for (let a = 0; a < chips.length; a++) for (let b = a + 1; b < chips.length; b++) {
    const p = chips[a][1], q = chips[b][1];
    const w = Math.min(p.right, q.right) - Math.max(p.left, q.left) - 12, h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) - 12;
    if (w > 0 && h > 0 && w * h > 80) out.push(['chip over chip', chips[a][0]]);
  }
  return out;
}"""

# איפה כל תג נמצא ביחס לעמודה של הקטגוריה שלו (לפי הצבע, שהוא ייחודי לקטגוריה)
COLUMNS = """() => {
  const bars = [...document.querySelectorAll('.fxbar')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, w: r.width, c: getComputedStyle(b).getPropertyValue('--c').trim() }; });
  return [...document.querySelectorAll('.fxchip')].map((c) => {
    const r = c.getBoundingClientRect(), own = bars.filter((b) => b.c === getComputedStyle(c).getPropertyValue('--c').trim())[0];
    return { o: +getComputedStyle(c.parentNode).opacity, x: r.left + r.width / 2, y: r.top + r.height / 2, miss: own ? Math.abs(own.x - (r.left + r.width / 2)) - own.w / 2 : null };
  });
}"""

# הסכום הרץ מול ההוצאות שכבר יצאו מהמטבע, נדגם בכל פריים בזמן אמת: [זמן, הסכום המוצג, סכום ההוצאות שעל המסך, סכום כל ההוצאות]
SYNC = """() => {
  window.__sync = [];
  const fx = document.querySelector('.fx--intro'), num = (s) => +s.replace(/[^0-9]/g, '');
  const tick = () => {
    if (!fx.isConnected) return;
    const bar = document.querySelector('.fx__progress i'), t = parseFloat(getComputedStyle(bar).width) / bar.parentNode.getBoundingClientRect().width * 15000;
    if (t > 3300 && t < 6790) {
      let out = 0, all = 0;
      document.querySelectorAll('.fxchip').forEach((c) => { const v = num(c.querySelector('b').textContent); all += v; if (+getComputedStyle(c.parentNode).opacity > 0.05) out += v; });
      window.__sync.push([Math.round(t), num(document.querySelector('.fx__total .fig').textContent), out, all]);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}"""

# ההדמיות: מה שבכל צעד חייב להישאר קריא (text), ומה שזז (movers). מחזיר רשימה של הפרות
STORY_MEASURE = """(cfg) => {
  const fx = document.querySelector('.fx');
  const box = (n) => n.getBoundingClientRect();
  const seen = (n) => { let o = 1; for (let e = n; e && e !== fx; e = e.parentNode) o *= +getComputedStyle(e).opacity; return o; };
  const cover = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const vis = (sel, min) => [...fx.querySelectorAll(sel)].filter((n) => seen(n) > min).map((n) => [sel, box(n)]).filter((x) => x[1].width > 0 && x[1].height > 0);
  const text = cfg.text.flatMap((s) => vis(s, 0.3)), movers = cfg.movers.flatMap((s) => vis(s, 0.25));
  const out = [];
  text.concat(movers).forEach(([s, r]) => { if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) out.push('off screen: ' + s); });
  for (let i = 0; i < text.length; i++) for (let j = i + 1; j < text.length; j++) {
    if (text[i][0] !== text[j][0] && cover(text[i][1], text[j][1]) > 24) out.push(text[i][0] + ' over ' + text[j][0]);
  }
  movers.forEach(([s, r]) => text.forEach(([t, q]) => { if (cover(r, q) > 24) out.push(s + ' over ' + t); }));
  if (cfg.t < cfg.mmUntil) for (let a = 0; a < movers.length; a++) for (let b = a + 1; b < movers.length; b++) {
    const p = movers[a][1], q = movers[b][1];
    const w = Math.min(p.right, q.right) - Math.max(p.left, q.left) - 12, h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) - 12;
    if (w > 0 && h > 0 && w * h > 80) out.push(movers[a][0] + ' over ' + movers[b][0]);
  }
  return out;
}"""

# הדמיה: איך פותחים אותה, כמה היא נמשכת, מה בה טקסט ומה זז, ועד מתי בודקים שדברים שזזים לא עולים זה על זה
# (הבדיקה עוצרת את הטיימרים הארוכים, ולכן הסכום הרץ לא מתקדם בה. לפני המעבר עליה הוא מקבל את הערך
#  הסופי — הרחב ביותר — כך שכל פריים נבדק במקרה הגרוע.)
STORIES = [
    ('month', 'P.stories.month(P.insights.focusMonth())', 15400, {
        'final': 'P.fmt.money(P.insights.monthStory(P.insights.focusMonth()).total)',
        'text': ['.fx__word h1', '.fxm__sub p', '.fx__total .fig', '.fx__total small', '.fxm__chip', '.fxm__axis span',
                 '.fx__cap p', '.fxrow', '.fxm__take p', '.fxm__lines p'],
        'movers': ['.fxmo'], 'mmUntil': 11780}),                     # בסוף הכרטיסים מתכנסים אל המטבע — זו המטרה
    ('year', 'P.stories.year()', 16000, {
        'final': 'P.fmt.money(P.insights.yearStory().total)',
        'text': ['.fx__word h1', '.fxm__sub p', '.fx__total .fig', '.fx__total small', '.fxy__flag', '.fxy__avglabel',
                 '.fxy__labels span', '.fxrow', '.fxpill', '.fx__tag p'],
        'movers': ['.fxy__card'], 'mmUntil': 99999}),
    ('recurring', 'P.stories.recurring()', 11200, {
        'final': 'P.fmt.money(P.insights.recurringYear(6).total)',
        'text': ['.fx__cap p', '.fxr__chip', '.fx__total .fig', '.fx__total small', '.fxy__labels span', '.fxm__lines p'],
        'movers': ['.fxr__seg'], 'mmUntil': 99999}),
]
# "הכל מסודר": בתי העסק הגדולים בנתונים, כאילו סודרו עכשיו
SORTED = """P.stories.sorted(P.state.byMerchant(P.state.data.tx.filter((t) => t.amount < 0)).slice(0, 12)
  .map((g) => ({ label: g.label, cat: g.cat, count: g.count, sum: g.sum, rule: true })))"""
BUILT = "() => { const s = document.querySelector('.fx__stage'); return !!s && s.style.visibility !== 'hidden'; }"

# דוח בדוי לבדיקות (tests/samples) — נקלט בדיוק כמו קובץ שנגרר לחלון, דרך אותו מסלול באפליקציה
with open(os.path.join(ROOT, 'tests', 'samples', 'demo.csv'), encoding='utf-8') as _fh:
    SAMPLE_CSV = _fh.read()
LOAD_SAMPLE = "(text) => { P.app.importInputs([{ name: 'demo.csv', sheets: P.csv.read(text) }]); }"

HANDOFF = """() => {
  const c = document.querySelector('.fx__coin .coin').getBoundingClientRect();
  const m = [...document.querySelectorAll('.brand__mark')].filter((n) => n.offsetParent !== null)[0].getBoundingClientRect();
  return Math.max(Math.abs((c.left + c.width / 2) - (m.left + m.width / 2)), Math.abs((c.top + c.height / 2) - (m.top + m.height / 2)), Math.abs(c.width - m.width));
}"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    """שרת קבצים זמני על 127.0.0.1 בלבד, בפורט פנוי. (לא run.py — הבדיקה לא נוגעת בתיקיית data.)"""
    with contextlib.closing(socket.socket()) as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, 'http://127.0.0.1:%d/index.html' % port


def walk(page, kind, start, end):
    """עובר על הרצף בצעדים קטנים ומחזיר: הפרות לפי סוג, אילו תגים נחתו מחוץ לעמודה שלהם, ואילו נמוגו במקומם."""
    found, last, rest = {}, {}, {}
    for t in range(start, end + 1, STEP):
        page.evaluate(SEEK, t)
        for name, chip in page.evaluate(MEASURE, kind):
            if name == 'chip over chip' and (kind != 'intro' or t > 6780):
                continue        # כשהתגים מתכנסים לעמודות הם נערמים זה על זה — זו המטרה
            found[name] = found.get(name, 0) + 1
        for i, c in enumerate(page.evaluate(COLUMNS)):
            if c['o'] >= 0.5 and c['miss'] is not None:
                last[i] = c                             # המקום האחרון שבו התג נראה, לפני שנבלע בעמודה
                if kind == 'intro' and t <= 6780:
                    rest[i] = c                         # איפה התג נח לפני שהתחיל המיון
    off = [i for i, c in last.items() if c['miss'] > 4]
    stayed = [i for i in off if i in rest and abs(last[i]['x'] - rest[i]['x']) < 12 and abs(last[i]['y'] - rest[i]['y']) < 12]
    return found, [i for i in off if i not in stayed], stayed


def walk_story(page, cfg, duration, step=40):
    """עובר על הדמיה מתחילתה ועד סופה, ומחזיר את ההפרות לפי סוג"""
    found = {}
    for t in range(0, duration + 1, step):
        page.evaluate(SEEK, t)
        for name in page.evaluate(STORY_MEASURE, dict(cfg, t=t)):
            found[name] = found.get(name, 0) + 1
    return found


def start_story(page, js, kind):
    page.evaluate('() => { ' + js + '; }')
    page.wait_for_selector('.fx--' + kind, timeout=15000)
    page.wait_for_function(BUILT, timeout=15000)
    page.wait_for_timeout(150)


def end_story(page):
    page.keyboard.press('Escape')
    page.wait_for_selector('.fx', state='detached', timeout=8000)


def launch(pw):
    """Chromium של Playwright; ואם הוא לא הותקן (אין גישה להורדה) — Edge או Chrome שכבר במחשב"""
    try:
        return pw.chromium.launch()
    except Exception:
        for channel in ('msedge', 'chrome'):
            try:
                return pw.chromium.launch(channel=channel)
            except Exception:
                pass
        raise


def main():
    screens = QUICK if '--quick' in sys.argv else SCREENS
    httpd, url = serve()
    failures, checks = [], 0

    def check(name, good, detail=''):
        nonlocal checks
        checks += 1
        print(('  ✓ ' if good else '  ✗ ') + name + ('' if good else '   ' + str(detail)))
        if not good:
            failures.append(name)

    with sync_playwright() as pw:
        browser = launch(pw)
        for w, h in screens:
            print('\n%d×%d' % (w, h))
            touch = w < 900
            ctx = browser.new_context(viewport={'width': w, 'height': h}, locale='he-IL', is_mobile=touch, has_touch=touch, device_scale_factor=2 if touch else 1)
            page = ctx.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))

            # ---------- הפתיח ----------
            page.goto(url + '#/')
            page.wait_for_selector('.fx--intro', timeout=15000)
            page.wait_for_timeout(700)                                   # הגופנים נטענו והסצנה נבנתה
            found, missed, stayed = walk(page, 'intro', 3400, 9000)
            check('פתיח: שום תג לא מעל טקסט, מחוץ למסך, או מעל תג שנח', not found, found)
            check('פתיח: כל תג נוחת בעמודה של הקטגוריה שלו' + (' (%d נמוגו במקומם: אין דרך מסביב לסכום)' % len(stayed) if stayed else ''), not missed and (not stayed or w < 360), (missed, stayed))
            page.evaluate(SEEK, 14999)
            page.wait_for_timeout(120)
            off = page.evaluate(HANDOFF)
            check('פתיח: המטבע נוחת על סמל האתר (סטייה %.2f פיקסל)' % off, off <= 1, off)
            page.keyboard.press('Escape')
            page.wait_for_selector('.fx', state='detached', timeout=8000)

            # ---------- קליטת קובץ ----------
            # עוצרים את השעון של הרצף (הטיימרים הארוכים), כדי שלא יסתיים בזמן שעוברים עליו צעד-צעד
            page.evaluate("() => { const real = window.setTimeout; window.setTimeout = (fn, ms) => (ms >= 1000 ? 0 : real(fn, ms)); }")
            page.evaluate(LOAD_SAMPLE, SAMPLE_CSV)
            page.wait_for_selector('.fx--import', timeout=15000)
            page.wait_for_timeout(250)
            found, missed, _ = walk(page, 'import', 400, 4300)
            check('קליטה: שום תג לא מעל טקסט או מחוץ למסך', not found, found)
            check('קליטה: כל תנועה נוחתת בעמודה של הקטגוריה שלה', not missed, missed)
            # דוח חדש: מיד אחרי הקליטה — הסיפור של החודש השלם האחרון בו; אחריו הסיכום
            page.keyboard.press('Escape')
            page.wait_for_selector('.fx--month', timeout=8000)
            page.wait_for_function(BUILT, timeout=15000)
            check('דוח חדש: מיד אחרי הקליטה מגיע הסיפור של החודש השלם האחרון בו', page.evaluate("() => P.state.data.prefs.seen.indexOf('m:2026-09') !== -1"))
            end_story(page)
            page.wait_for_selector('.dialog.is-open', timeout=8000)
            page.evaluate('() => P.layers.dismissAll()')
            page.wait_for_timeout(400)

            # ---------- ההדמיות, על הנתונים שנטענו ----------
            for kind, js, duration, cfg in STORIES:
                start_story(page, js, kind)
                page.evaluate("() => { document.querySelector('.fx__total .fig').textContent = " + cfg['final'] + "; }")
                found = walk_story(page, cfg, duration)
                check('הדמיה "%s": שום טקסט לא עולה על טקסט, שום דבר לא עובר מעליו ולא יוצא מהמסך' % kind, not found, found)
                end_story(page)
            start_story(page, SORTED, 'sorted')
            found, missed, _ = walk(page, 'sorted', 0, 5600)
            check('הדמיה "sorted": שום תג לא מעל טקסט או מחוץ למסך', not found, found)
            check('הדמיה "sorted": כל בית עסק נוחת בעמודה של הקטגוריה שלו', not missed, missed)
            end_story(page)
            check('בלי שגיאות בדף', not errors, errors[:2])
            ctx.close()

        # ---------- הסכום הרץ, בזמן אמת ----------
        print('\nהסכום הרץ (בזמן אמת)')
        for w, h in ((1440, 900), (390, 844)):
            ctx = browser.new_context(viewport={'width': w, 'height': h}, locale='he-IL', is_mobile=w < 900, has_touch=w < 900)
            page = ctx.new_page()
            page.goto(url + '#/')
            page.wait_for_selector('.fx--intro', timeout=15000)
            page.evaluate(SYNC)
            page.wait_for_timeout(7600)
            rows = page.evaluate('() => window.__sync')
            ahead = [r for r in rows if r[1] > r[2] + 1]                  # מציג יותר ממה שכבר יצא מהמטבע
            back = [b for a, b in zip(rows, rows[1:]) if b[1] < a[1]]     # ירד
            check('%d×%d: הסכום אף פעם לא מקדים את ההוצאות שעל המסך, ולא יורד (%d דגימות)' % (w, h, len(rows)), len(rows) > 20 and not ahead and not back, (ahead + back)[:3])
            check('%d×%d: הסכום מסתיים בדיוק בסך כל ההוצאות' % (w, h), bool(rows) and rows[-1][1] == rows[-1][3], rows[-1:] )
            ctx.close()

        # ---------- הפחתת תנועה ----------
        print('\nהפחתת תנועה')
        ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, locale='he-IL', reduced_motion='reduce')
        page = ctx.new_page()
        page.goto(url + '#/')
        page.wait_for_selector('html.is-ready', timeout=15000)
        page.wait_for_timeout(600)
        check('אין פתיח', page.locator('.fx').count() == 0)
        page.evaluate(LOAD_SAMPLE, SAMPLE_CSV)
        page.wait_for_selector('.dialog.is-open', timeout=20000)
        check('אין רצף קליטה — ישר לסיכום', page.locator('.fx').count() == 0)
        page.evaluate('() => P.layers.dismissAll()')
        page.wait_for_timeout(500)
        ran = page.evaluate('async () => [await P.stories.month(P.insights.focusMonth()), await P.stories.year(), await P.stories.recurring()]')
        check('אין הדמיות, ואין כפתורים שפותחים אותן', ran == [False, False, False] and page.locator('.fx').count() == 0 and page.locator('.btnstory').count() == 0, ran)
        ctx.close()
        browser.close()

    httpd.shutdown()
    print('\n' + ('✗ %d נכשלו מתוך %d' % (len(failures), checks) if failures else '✓ %d בדיקות עברו, ב-%d צורות מסך' % (checks, len(screens))))
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
