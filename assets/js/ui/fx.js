/* ==========================================================================
   ui/fx.js — שני רצפי התנועה הגדולים
   ---------------------------------------------------------------------------
   1. הפתיח (15 שניות): הסיפור של המוצר, בלי מילה אחת מיותרת.
        0.0  מטבע אחד נופל, מסתובב ונוחת. סביבו נמתחות טבעות של שטר.   "פרוטה"
        2.8  מהמטבע יוצאות הוצאות קטנות של יום-יום, והסכום רץ למעלה.    "פרוטה ועוד פרוטה…"
        6.8  ההוצאות ממוינות לעמודות לפי קטגוריה.                      "…מצטרפות לחשבון גדול."
       10.6  שלושה רגעים מהחיים — ומאחוריהם, החודשים המעוצבים.         "רואים לאן הולך הכסף."
       13.4  הכל מתכנס חזרה למטבע, והמטבע עף למקומו בפינת המסך.        "כל ההוצאות, בפרוטרוט."
      המטבע הוא החוט המקשר: הוא פותח, הוא המקור, והוא מה שנשאר בסוף כסמל האתר.

   2. קליטת קובץ (כ-5 שניות): אותה שפה, עם הנתונים האמיתיים שנטענו —
      התנועות יוצאות מהקובץ, נופלות לעמודות של הקטגוריות שלהן, והמספרים נספרים.

   3. run(): הבמה עצמה, לשאר ההדמיות (סיפור החודש, השנה, הקבועות, "הכל מסודר") — ui/stories.js.

   מה ששומר על הרצפים נקיים:
     · שום דבר לא עף מעל טקסט. route() מחשב לכל תג מסלול שעוקף את הכיתוב ואת הסכום.
     · אף תג לא עובר מעל תג שכבר נח: סדר היציאה נבחר לפי המקום (הרחוקים קודם, מהמרכז החוצה).
     · הפריסה נבנית מהמידות האמיתיות של הטקסט, אחרי שהגופנים נטענו — ולכן היא נכונה בכל גודל מסך.
     · הסכום שרץ הוא תמיד בדיוק סכום ההוצאות שכבר נחתו, וכל תג נוחת בעמודה של הקטגוריה שלו.

   שניהם ניתנים לדילוג בכל רגע (כפתור, לחיצה או Esc), ושניהם מדלגים על עצמם
   כשבמערכת ההפעלה מוגדרת "הפחתת תנועה".
   ========================================================================== */
window.P = window.P || {};

P.fx = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, M = P.motion, art = P.art;
  let active = null;

  /* ---------- אבני בניין ---------- */
  /** מחזיק ממורכז: כל אובייקט בסצנה יושב בנקודת האמצע, ומונפש רק ב-transform */
  const at = (cls, kids) => el('div.fx__at' + (cls ? '.' + cls : ''), null, kids);
  const T = (x, y, extra) => 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) ' + (extra || '');

  function chip(cat, label, amount, color) {
    return el('div.fxchip', { vars: { '--c': color } }, [
      art.tile(cat, 30, color),
      el('span.fxchip__label', { text: label }),
      el('b.fig', { text: fmt.money(amount) })
    ]);
  }

  /** גודל הבמה: רוחב החלון בלי רצועת פס הגלילה (שנשארת שמורה בצד) — זה השטח שהבמה באמת תופסת, ומרכזו הוא מרכז הסצנה */
  const viewport = () => ({ w: document.documentElement.clientWidth || window.innerWidth, h: window.innerHeight });

  /** המלבן שאלמנט תופס כשהוא ממורכז ב-(cx, cy) — יחסית למרכז הבמה, לפי הגודל האמיתי שלו */
  const boxOf = (node, cx, cy) => ({ l: cx - node.offsetWidth / 2, r: cx + node.offsetWidth / 2, t: cy - node.offsetHeight / 2, b: cy + node.offsetHeight / 2 });
  /** אותו דבר לחלק פנימי של אובייקט שמרכזו ב-(cx, cy): offsetLeft/Top נמדדים מהמחזיק הממורכז, ולא מושפעים מההנפשה */
  const partOf = (node, cx, cy) => ({ l: cx + node.offsetLeft, r: cx + node.offsetLeft + node.offsetWidth, t: cy + node.offsetTop, b: cy + node.offsetTop + node.offsetHeight });

  /**
   * מסלול טיסה שלא עובר מעל טקסט.
   * התג יוצא מהמקור הצידה בקשת, יורד ב"נתיב" שמחוץ לכל מה שצריך להישאר קריא (blocks), ונכנס למקומו.
   * כשיש דרך ישירה ונקייה — קשת אחת. המסלול נדגם לנקודות, והדפדפן משלים ביניהן: כך מתקבלת עקומה חלקה אחת.
   *   a, b    {x, y, s, r} — מיקום יחסית למרכז, קנה מידה, סיבוב במעלות
   *   o       { w, h (גודל התג), side (‎-1 / 1), halfW (חצי רוחב המסך), blocks: [{l, r, t, b}], sf (קנה המידה בזמן המעקף), visible }
   * מחזיר keyframes, או null כשאין מקום לעקוף (מסך צר מאוד) — ואז הקורא בוחר מסלול פשוט.
   */
  function route(a, b, o) {
    const side = o.side, pad = 8, W = o.w, H = o.h, lim = o.halfW - 4, RAD = Math.PI / 180;
    const half = (s, r) => { const c = Math.abs(Math.cos(r * RAD)), n = Math.abs(Math.sin(r * RAD)); return [(W * c + H * n) * s / 2, (W * n + H * c) * s / 2]; };
    const touch = (p, k) => { const e = half(p.s, p.r); return p.x + e[0] > k.l - 3 && p.x - e[0] < k.r + 3 && p.y + e[1] > k.t - 3 && p.y - e[1] < k.b + 3; };
    // מקום שנוגע במכשול כבר במנוחה (פינה של תג מוטה) לא פוסל את המסלול: ממש ליד הקצה הזה המכשול הזה לא נבדק
    const atStart = o.blocks.filter((k) => touch(a, k)), atEnd = o.blocks.filter((k) => touch(b, k));
    const hits = (p, fromStart, toEnd) => {
      if (Math.abs(p.x) + half(p.s, p.r)[0] > o.halfW) return true;                  // יצא מהמסך
      return o.blocks.some((k) => !(fromStart < 24 && atStart.indexOf(k) > -1) && !(toEnd < 24 && atEnd.indexOf(k) > -1) && touch(p, k));
    };
    const top = Math.min.apply(null, o.blocks.map((k) => k.t)), bot = Math.max.apply(null, o.blocks.map((k) => k.b));
    const reach = Math.max.apply(null, o.blocks.map((k) => (side > 0 ? k.r : -k.l)));  // עד לאן מגיע המכשול הרחב ביותר, בצד הזה
    const tiltR = Math.abs(b.r) + 3;                                                    // ההטיה שנשארת לתג בזמן המעקף
    const unit = half(1, tiltR);                                                        // חצי רוחב וחצי גובה של התג המוטה, בגודל מלא
    const sf = Math.min(o.sf, (lim - pad - reach) / (2 * unit[0]));                     // הגודל שבו התג עובר בין המכשול לשולי המסך

    function make(X, arcH, single) {
      const xl = side * X, pts = [];
      for (let k = 0; k <= 8; k++) {                                                   // רבע אליפסה: יוצאים אופקית, מגיעים אנכית
        const th = k / 8 * Math.PI / 2;
        pts.push({ x: a.x + (xl - a.x) * Math.sin(th), y: a.y + arcH * (1 - Math.cos(th)), seg: 0 });
      }
      if (!single) {
        const yArc = a.y + arcH, yL = Math.min(Math.max(yArc, bot + pad + unit[1] * sf), b.y);
        if (yL > yArc + 1) pts.push({ x: xl, y: yL, seg: 1 });                         // ירידה ישרה בנתיב
        for (let k = 1; k <= 5; k++) {                                                 // כניסה למקום: קודם זזים פנימה, ורק אז גדלים
          const t = k / 5, e = t * t * (3 - 2 * t);
          pts.push({ x: xl + (b.x - xl) * e, y: yL + (b.y - yL) * t, seg: 2, t: t });
        }
      }
      let len = 0;
      pts[0].d = 0;
      for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); pts[i].d = len; }
      const dArc = pts[8].d || 1;
      pts.forEach((p) => {
        p.p = len ? p.d / len : 1;
        if (single) p.s = a.s + (b.s - a.s) * Math.pow(p.p, 1.3);
        else p.s = p.seg === 0 ? a.s + (sf - a.s) * Math.min(1, p.d / dArc) : p.seg === 1 ? sf : sf + (b.s - sf) * p.t * p.t;
        p.r = b.r + (a.r - b.r) * Math.pow(1 - p.p, 4);                                 // הסיבוב נרגע מהר: ליד טקסט התג כבר כמעט ישר
      });
      return pts;
    }
    // בודקים את המסלול כפי שהדפדפן ינגן אותו: גם בין הנקודות. הקצוות עצמם (המקור והמקום) נתונים, ולא נבדקים.
    function clean(pts) {
      const len = pts[pts.length - 1].d;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i];
        for (let j = (i === 1 ? 1 : 0); j <= 4; j++) {
          if (i === pts.length - 1 && j === 4) break;
          const t = j / 4, d = p.d + (q.d - p.d) * t;
          if (hits({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, s: p.s + (q.s - p.s) * t, r: p.r + (q.r - p.r) * t }, d, len - d)) return false;
        }
      }
      return true;
    }
    const frames = (pts) => pts.map((p, i) => ({
      offset: +Math.min(1, p.p).toFixed(4), opacity: o.visible || i ? 1 : 0,
      transform: T(p.x, p.y, 'scale(' + p.s.toFixed(3) + ') rotate(' + p.r.toFixed(1) + 'deg)')
    }));

    // 1. קשת אחת, ישר למקום — כשהיא ממילא עוברת מחוץ למכשולים
    if (Math.abs(b.x - a.x) > 1 && Math.sign(b.x - a.x) === side) {
      const one = make(Math.abs(b.x), b.y - a.y, true);
      if (clean(one)) return frames(one);
    }
    // 2. דרך נתיב צדדי: הקשת הגבוהה ביותר שעדיין לא נוגעת בפינת המכשול
    if (sf < 0.3) return null;
    const X = Math.min(Math.max(Math.abs(b.x), Math.abs(a.x), reach + pad + unit[0] * sf), lim - unit[0] * sf);
    let lo = Math.max(4, top - pad - unit[1] * sf - a.y);
    const hi = Math.max(lo, Math.min(bot + pad + unit[1] * sf, b.y) - a.y);
    let best = make(X, hi, false);
    if (!clean(best)) {
      best = make(X, lo, false);
      if (!clean(best)) return null;
      let up = hi;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + up) / 2, c = make(X, mid, false);
        if (clean(c)) { best = c; lo = mid; } else up = mid;
      }
    }
    return frames(best);
  }

  /**
   * מונה שמוסיפים לו תוך כדי ריצה: כל הוספה מזיזה את היעד, והמספר המוצג "רודף" אחריו.
   * כך הסכום שעל המסך הוא תמיד בדיוק סכום ההוצאות שכבר נחתו.
   */
  function ticker(node, format) {
    let shown = 0, target = 0, raf = 0, last = 0;
    const step = (now) => {
      // אותו קצב בכל קצב רענון. הזמן של הפריים יכול להיות מוקדם ברגע מהרגע שבו נקראה add —
      // ובלי הרצפה באפס המספר היה זז לרגע אחורה
      const k = 1 - Math.pow(0.0025, Math.max(0, Math.min(64, now - last)) / 1000 * 3.4);
      last = now;
      shown += (target - shown) * k;
      if (Math.abs(target - shown) < 0.5) { shown = target; raf = 0; } else raf = requestAnimationFrame(step);
      node.textContent = format(shown);
    };
    return {
      add: (v) => { target += v; if (!raf && node.isConnected) { last = performance.now(); raf = requestAnimationFrame(step); } },
      set: (v) => { if (raf) cancelAnimationFrame(raf); raf = 0; target = shown = v; node.textContent = format(v); }
    };
  }

  /** האם שני מלבנים מוטים נוגעים (משפט הציר המפריד). מלבן: {x, y, w, h, r} — מרכז, גודל וזווית במעלות; gap — המרווח שחייב להישאר ביניהם */
  function touching(A, B, gap) {
    const RAD = Math.PI / 180;
    const corners = (q) => {
      const c = Math.cos(q.r * RAD), s = Math.sin(q.r * RAD), hw = (q.w + gap) / 2, hh = (q.h + gap) / 2;
      return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map((p) => [q.x + p[0] * c - p[1] * s, q.y + p[0] * s + p[1] * c]);
    };
    const a = corners(A), b = corners(B);
    return [A.r, A.r + 90, B.r, B.r + 90].every((deg) => {
      const ax = [Math.cos(deg * RAD), Math.sin(deg * RAD)];
      const pa = a.map((p) => p[0] * ax[0] + p[1] * ax[1]), pb = b.map((p) => p[0] * ax[0] + p[1] * ax[1]);
      return Math.max.apply(null, pa) >= Math.min.apply(null, pb) && Math.max.apply(null, pb) >= Math.min.apply(null, pa);
    });
  }

  function stage(kind, onSkip, label) {
    const bandSvg = art.band({ color: '#fff', lines: 18, seed: 23, width: 1600, height: 900, strokeWidth: 0.6, cls: 'fx__band' });
    const body = el('div.fx__stage');
    const skip = el('button.fx__skip', { type: 'button', onclick: (e) => { e.stopPropagation(); onSkip(); } }, [P.icons.svg('chevron', 16), 'דילוג']);
    const bar = el('i');
    const node = el('div.fx.fx--' + kind, { role: 'dialog', 'aria-modal': 'true', 'aria-label': label || (kind === 'intro' ? 'פתיח' : 'קליטת הקובץ') }, [
      el('div.fx__bg', null, [bandSvg, el('div.fx__glow')]),
      body, skip, el('div.fx__progress', null, bar)
    ]);
    return { node: node, body: body, bar: bar, skip: skip };
  }

  /** עמודות לפי קטגוריה. rows: [{cat, color, value, label}] */
  function bars(rows, geo) {
    const max = Math.max.apply(null, rows.map((r) => r.value).concat([1]));
    const wrap = el('div.fxbars', { style: 'gap:' + geo.gap + 'px;height:' + (geo.maxH + geo.labelH) + 'px' });
    const cols = rows.map((r) => {
      const h = Math.max(geo.maxH * 0.12, geo.maxH * (r.value / max));
      const col = el('i.fxbar__col', { style: 'height:' + h.toFixed(0) + 'px' });
      const val = el('span.fxbar__val.fig', { text: r.label });
      const name = el('span.fxbar__name', null, [art.tile(r.cat, Math.round(geo.w * 0.42), r.color), el('span', { text: r.short || r.cat })]);
      const node = el('div.fxbar', { vars: { '--c': r.color }, style: 'width:' + geo.w + 'px' }, [val, col, name]);
      wrap.appendChild(node);
      return { node: node, col: col, val: val, name: name, h: h };
    });
    return { node: wrap, cols: cols };
  }

  function mount(st) {
    document.body.appendChild(st.node);
    document.documentElement.classList.add('has-fx');
    document.documentElement.classList.remove('intro-pending');
  }
  function unmount(st) {
    st.node.remove();
    document.documentElement.classList.remove('has-fx', 'fx-out');
    active = null;
  }
  /** הבמה מתחילה להתפוגג: גם שולי המסך חוזרים לצבע האתר */
  const leaving = () => document.documentElement.classList.add('fx-out');

  /* ======================================================================
     1. הפתיח
     ====================================================================== */
  const DEMO = [
    ['מסעדות וקפה', 'קפה של בוקר', 14], ['תחבורה ודלק', 'חניה', 25], ['מזון ומכולת', 'סופר', 212], ['מסעדות וקפה', 'משלוח', 108],
    ['מנויים ודיגיטל', 'סטרימינג', 55], ['תחבורה ודלק', 'דלק', 260], ['קניות וביגוד', 'נעליים', 349], ['מזון ומכולת', 'ירקן', 64],
    ['בילויים ופנאי', 'סרט', 46], ['מסעדות וקפה', 'פיצה', 72], ['מנויים ודיגיטל', 'מוזיקה', 22], ['מזון ומכולת', 'מאפייה', 38],
    ['תחבורה ודלק', 'רכבת', 27], ['קניות וביגוד', 'חולצה', 119], ['בילויים ופנאי', 'הופעה', 180], ['מסעדות וקפה', 'גלידה', 24]
  ];
  const DEMO_COLORS = { 'מזון ומכולת': 'var(--c2)', 'מסעדות וקפה': 'var(--c3)', 'תחבורה ודלק': 'var(--c5)', 'קניות וביגוד': 'var(--c7)', 'בילויים ופנאי': 'var(--c4)', 'מנויים ודיגיטל': 'var(--c6)' };
  const SHORT = { 'מזון ומכולת': 'מזון', 'מסעדות וקפה': 'מסעדות', 'תחבורה ודלק': 'תחבורה', 'קניות וביגוד': 'קניות', 'בילויים ופנאי': 'בילויים', 'מנויים ודיגיטל': 'מנויים' };

  function intro() {
    if (active) return active.promise;
    if (M.reduced()) { document.documentElement.classList.remove('intro-pending'); return Promise.resolve(); }

    const view = viewport(), vw = view.w, vh = view.h, u = Math.min(vw, vh) / 100, narrow = vw < 700;
    const tl = M.timeline();
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    let skipped = false, playing = false;
    const skip = () => { skipped = true; if (playing) tl.finish(); };
    const st = stage('intro', skip);
    const S = st.body;

    /* ---------- אובייקטים ---------- */
    const coinSize = Math.round(Math.min(24 * u, 220));
    const coin = art.coin(coinSize);
    const coinAt = at('fx__coin', coin);
    const seal = at('fx__seal', art.seal({ seed: 42, color: '#fff', width: 0.32, petals: 12, quality: 'hi' }));
    const letters = 'פרוטה'.split('').map((ch) => el('span', { text: ch }));
    const word = at('fx__word', el('h1', { 'aria-label': 'פרוטה' }, letters));
    const cap1 = at('fx__cap', el('p', { text: 'פרוטה ועוד פרוטה…' }));
    const cap2 = at('fx__cap', el('p', { text: '…מצטרפות לחשבון גדול.' }));
    const cap3 = at('fx__cap', el('p', { text: 'רואים לאן הולך הכסף.' }));
    const cap4 = at('fx__cap', el('p', { text: 'וכל חודש — בעיצוב משלו.' }));
    const totalFig = el('span.fig', { text: '₪0' });
    const totalLabel = el('small', { text: 'החודש יצא' });
    const running = ticker(totalFig, fmt.money);
    const total = at('fx__total', el('div', null, [totalLabel, totalFig]));
    const tag = at('fx__tag', el('p', { text: 'כל ההוצאות, בפרוטרוט.' }));
    // כל ההוצאות נוצרות מראש; כמה מהן ייכנסו למסך — נקבע בזמן הבנייה, לפי המידות האמיתיות
    let chips = DEMO.slice(0, narrow ? 10 : 16).map((d) => at('fx__chipat', chip(d[0], d[1], d[2], DEMO_COLORS[d[0]])));
    const barsAt = at('fx__barsat');

    // שלושה רגעים מהחיים; מאחורי כל אחד — פוסטר של חודש
    const cw = Math.round(Math.min(narrow ? 30 * u : 25 * u, 250)), chH = Math.round(cw * 1.26);
    const LIFE = [['coffee', 'מסעדות וקפה', 'קפה של בוקר', 14, 3], ['beach', 'נסיעות וחופשות', 'חופשה באוגוסט', 2340, 8], ['market', 'מזון ומכולת', 'קניות לשבת', 212, 12]];
    const cards = LIFE.map((l) => {
      const front = el('div.fxcard__face', null, [
        el('img', { src: P.posters.life(l[0]), alt: '', decoding: 'async' }),
        el('div.fxcard__label', null, [art.tile(l[1], 30, 'var(--c' + (LIFE.indexOf(l) * 2 + 2) + ')'), el('span', { text: l[2] }), el('b.fig', { text: fmt.money(l[3]) })])
      ]);
      const back = el('div.fxcard__face.fxcard__face--back', null, P.posters.month(l[4], { size: 'card', label: true, eager: true }));
      const card = el('div.fxcard' + (cw < 130 ? '.fxcard--xs' : cw < 215 ? '.fxcard--sm' : ''), { style: 'width:' + cw + 'px;height:' + chH + 'px' }, [front, back]);   // כרטיס צר: התווית בשתי שורות
      return { at: at('fx__cardat', card), card: card, img: front.querySelector('img') };
    });

    [seal, barsAt, total].concat(chips, cards.map((c) => c.at), [coinAt, word, cap1, cap2, cap3, cap4, tag]).forEach((n) => S.appendChild(n));
    S.style.visibility = 'hidden';                   // עד שהסצנה נבנית — רק הרקע
    mount(st);
    active = { promise: promise };

    /*
     * הסצנה נבנית רק אחרי שהגופנים נטענו: הפריסה והמסלולים מחושבים לפי הגודל האמיתי של הכיתוב,
     * של הסכום ושל כל תג — וגופן חלופי היה נותן מידות אחרות.
     */
    function build() {
      /* ---------- פריסה: ההוצאות מסתדרות בשורות מעל הסכום ומתחתיו, בין הכיתוב לתחתית המסך ---------- */
      const topY = -vh * 0.37, capY = -vh * 0.25, midY = vh * 0.05;        // המטבע הקטן · הכיתוב · הסכום
      const capBox = boxOf(cap1.firstChild, 0, capY);
      const H = chips[0].firstChild.offsetHeight, half = total.firstChild.offsetHeight / 2;
      const rowGap = Math.max(H + 12, 6.4 * u);
      const upY = midY - half - H / 2 - 12, downY = midY + half + H / 2 + 20;    // השורה הקרובה לסכום, מכל צד
      const rowsUp = Math.floor((upY - (capBox.b + 10 + H / 2)) / rowGap) + 1;
      const rowsDown = Math.floor((vh / 2 - 16 - H / 2 - downY) / rowGap) + 1;
      const rows = Math.max(1, Math.min(rowsUp, rowsDown));
      // כמה טורים: הכי הרבה שנכנסים בלי שתג ייגע בשכנו או ייצא מהמסך
      const widths = chips.map((c) => c.firstChild.offsetWidth);
      const gapX = narrow ? 10 : 14;
      let cols = narrow ? 2 : 4, n, perSide, widest, rowW;
      const rowOf = (i) => { const up = i < perSide, k = up ? i : i - perSide; return { up: up, r: Math.floor(k / cols), c: k % cols, size: Math.min(cols, (up ? perSide : n - perSide) - Math.floor(k / cols) * cols) }; };
      const rowWidth = (i, g) => { const q = rowOf(i); let w = -g; for (let j = i - q.c; j < i - q.c + q.size; j++) w += widths[j] + g; return w; };
      for (; cols >= 1; cols--) {
        n = Math.max(2, Math.min(chips.length, rows * cols * 2));
        perSide = Math.ceil(n / 2);
        widest = Math.max.apply(null, widths.slice(0, n));
        rowW = 0;                                                          // השורה הרחבה ביותר, כשהתגים צמודים זה לזה
        for (let i = 0; i < n; i++) rowW = Math.max(rowW, rowWidth(i, gapX));
        if (cols === 1 || rowW <= vw - 16) break;
      }
      chips.slice(n).forEach((c) => c.remove());
      chips = chips.slice(0, n);
      const data = DEMO.slice(0, n), sum = data.reduce((a, d) => a + d[2], 0);
      // במסך רחב הפיזור אוורירי: מרווח קבוע בין מרכזי התגים, והשורות מוזזות זו מזו כמו לבנים.
      // במסך צר אין לזה מקום: כל שורה נארזת לפי הרוחב האמיתי של התגים שבה, וממורכזת.
      let pitch = 0;                                                       // המרווח הקטן ביותר בין מרכזים שבו אף זוג שכנים לא נוגע
      for (let i = 1; i < n; i++) if (rowOf(i).c > 0) pitch = Math.max(pitch, (widths[i] + widths[i - 1]) / 2 + gapX);
      const airy = cols > 1 ? 2 * Math.min(vw / 2 - widest / 2 - 1.5 * u - 16, 66 * u) / (cols - 1) : 0;
      const roomy = airy >= pitch, brick = roomy ? Math.max(0.82, pitch / airy) : 1;
      const gapT = gapX + Math.max(0, Math.min(18, (vw - 16 - rowW) / Math.max(1, cols - 1)));      // במסך צר: מה שנשאר מתחלק בין התגים
      let loose = 1;                                                       // כמה "חופש" יש לתגים: הטיה והזזה קלה. מצטמצם אם משהו נוגע
      const slot = (i) => {
        const q = rowOf(i);
        let x, jitter = 0;
        if (roomy) {
          jitter = ((i * 37) % 11 - 5) / 5 * Math.max(0, Math.min(1.5 * u, (airy * brick - pitch) / 2)) * loose;
          x = (q.c - (q.size - 1) / 2) * airy * (q.r % 2 ? brick : 1) + jitter;
        } else {
          x = -rowWidth(i, gapT) / 2 + widths[i] / 2;
          for (let j = i - q.c; j < i; j++) x += widths[j] + gapT;
        }
        return { x: x, y: (q.up ? upY - q.r * rowGap : downY + q.r * rowGap) + jitter * 0.5, rot: ((i * 53) % 13 - 6) * loose * (roomy ? 1 : 0.6) };
      };
      totalFig.textContent = fmt.money(sum);                              // המידות של הסכום — ברוחב הסופי שלו
      const totBox = [partOf(totalFig, 0, midY), partOf(totalLabel, 0, midY)];
      totalFig.textContent = '₪0';
      const still = [capBox].concat(totBox).map((k) => ({ x: (k.l + k.r) / 2, y: (k.t + k.b) / 2, w: k.r - k.l, h: k.b - k.t, r: 0 }));
      for (let pass = 0; pass < 6; pass++) {
        const rects = chips.map((c, i) => { const s = slot(i); return { x: s.x, y: s.y, w: widths[i], h: H, r: s.rot }; });
        if (!rects.some((a, i) => still.some((k) => touching(a, k, 6)) || rects.some((b, j) => j > i && touching(a, b, 6)))) break;
        loose *= 0.6;
      }
      const slots = chips.map((c, i) => slot(i));

      // עמודות: סכום לכל קטגוריה מתוך אותן הוצאות
      const byCat = {};
      data.forEach((d) => { byCat[d[0]] = (byCat[d[0]] || 0) + d[2]; });
      const catRows = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).slice(0, narrow ? 4 : 6)
        .map((c) => ({ cat: c, short: SHORT[c], color: DEMO_COLORS[c], value: byCat[c], label: fmt.money(byCat[c]) }));
      const barW = Math.round(Math.min(narrow ? 17 * u : 12.5 * u, 120)), gap = Math.round(narrow ? 3 * u : 3.4 * u);
      const B = bars(catRows, { w: barW, gap: gap, maxH: Math.round(Math.min(30 * u, vh * 0.3)), labelH: Math.round(barW * 0.42) + 34 });
      barsAt.appendChild(B.node);
      const barsY = vh * 0.13;
      const barX = (ci) => B.cols[ci].node.offsetLeft + barW / 2;          // המקום האמיתי של העמודה (מימין לשמאל), לא חישוב
      // יעד הנחיתה של המטבע בסוף: סמל האתר (בסרגל הצד, או בפס העליון בטלפון)
      const marks = Array.prototype.filter.call(document.querySelectorAll('.brand__mark'), (m) => m.offsetParent !== null);
      const mark = marks[0] ? marks[0].getBoundingClientRect() : null;

      /* ---------- סצנה 1: המטבע (0 – 2.8) ---------- */
      const C0 = -5 * u;                               // גובה המטבע במרכז
      tl.add(st.bar, [{ width: '0%' }, { width: '100%' }], { at: 0, duration: 15000, easing: 'linear' });
      tl.add(coinAt, [{ transform: T(0, -vh * 0.75), opacity: 0 }, { transform: T(0, -vh * 0.75), opacity: 1, offset: 0.02 }, { transform: T(0, C0), opacity: 1 }], { at: 150, duration: 1250, easing: 'bounce' });
      tl.add(coin, [{ transform: 'rotateY(-900deg) rotateX(24deg)' }, { transform: 'rotateY(0deg) rotateX(0deg)' }], { at: 150, duration: 1700, easing: 'out' });
      tl.add(seal, [{ opacity: 0, transform: T(0, C0, 'scale(.35) rotate(-50deg)') }, { opacity: 0.5, transform: T(0, C0, 'scale(1) rotate(0deg)') }], { at: 1000, duration: 1900, easing: 'out' });
      tl.add(word, [{ transform: T(0, 15 * u) }, { transform: T(0, 15 * u) }], { at: 0, duration: 1 });
      tl.stagger(letters, [{ opacity: 0, transform: 'translateY(60%) rotate(8deg)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { at: 1350, each: 95, duration: 700, easing: 'out' });

      /* ---------- סצנה 2: פרוטה ועוד פרוטה (2.8 – 6.8) ---------- */
      tl.add(word, [{ opacity: 1, transform: T(0, 15 * u) }, { opacity: 0, transform: T(0, 9 * u, 'scale(.9)') }], { at: 2800, duration: 450, easing: 'in' });
      tl.add(coinAt, [{ transform: T(0, C0) }, { transform: T(0, topY, 'scale(.42)') }], { at: 2850, duration: 800, easing: 'inOut' });
      tl.add(seal, [{ opacity: 0.5, transform: T(0, C0, 'scale(1)') }, { opacity: 0.16, transform: T(0, vh * 0.02, 'scale(1.5) rotate(20deg)') }], { at: 2850, duration: 1400, easing: 'inOut' });
      tl.add(cap1, [{ opacity: 0, transform: T(0, capY + 3 * u) }, { opacity: 1, transform: T(0, capY) }], { at: 3450, duration: 600 });   // אחרי שהמטבע חלף על פניו בדרכו למעלה
      tl.add(total, [{ opacity: 0, transform: T(0, midY, 'scale(.8)') }, { opacity: 1, transform: T(0, midY) }], { at: 3350, duration: 600, easing: 'back' });
      // סדר היציאה נבחר כך שאף הוצאה לא עפה מעל הוצאה שכבר נחה: קודם השורות הרחוקות, ובתוך שורה — מהמרכז החוצה, פעם שמאל ופעם ימין.
      const rank = (i) => { const q = rowOf(i), mid = (q.size - 1) / 2; return (q.up ? 100 + q.r * 10 : 50 - q.r * 10) + Math.abs(q.c - mid) + (q.c > mid ? 0.25 : 0); };
      const seq = chips.map((c, i) => i).sort((a, b) => rank(a) - rank(b));
      seq.forEach((i, k) => {
        const c = chips[i], s = slots[i], lower = i >= perSide, t0 = 3600 + k * (2250 / n), dur = lower ? 1050 : 900;    // המטבע מגיע למעלה ב-3.65
        const side = Math.abs(s.x) < 1 ? (k % 2 ? 1 : -1) : Math.sign(s.x);
        // כל הוצאה יוצאת מהמטבע הצידה ויורדת למקומה מסביב לכיתוב (ומי שיעדה למטה — גם מסביב לסכום), בלי לחצות אותם
        const frames = route({ x: 0, y: topY, s: 0.15, r: -30 }, { x: s.x, y: s.y, s: 1, r: s.rot },
          { w: widths[i], h: H, side: side, halfW: vw / 2, blocks: lower ? [capBox].concat(totBox) : [capBox], sf: 0.8 }) || [
          // מסך צר מאוד, שאין בו מקום לעקוף: מסלול ישיר
          { opacity: 0, transform: T(0, topY, 'scale(.15) rotate(-30deg)') },
          { opacity: 1, transform: T(s.x * 0.55, topY + (s.y - topY) * 0.45 - 6 * u, 'scale(' + (lower ? 0.6 : 0.8) + ') rotate(' + (s.rot * 2).toFixed(1) + 'deg)'), offset: 0.45 },
          { opacity: 1, transform: T(s.x, s.y, 'scale(1) rotate(' + s.rot.toFixed(1) + 'deg)') }
        ];
        tl.add(c, frames, { at: t0, duration: dur, easing: 'out' });
        // כל הוצאה שיוצאת "מקפיצה" את המטבע, וכשהיא נוחתת — הסכום גדל בדיוק בסכום שלה
        tl.add(coin, [{ transform: 'scale(1)' }, { transform: 'scale(1.09)' }, { transform: 'scale(1)' }], { at: t0, duration: 170, easing: 'out', fill: 'none' });
        tl.call(t0 + dur * 0.34, () => running.add(data[i][2]));
      });

      /* ---------- סצנה 3: מצטרפות לחשבון גדול (6.8 – 10.6) ---------- */
      tl.add(cap1, [{ opacity: 1 }, { opacity: 0 }], { at: 6500, duration: 300, fill: 'forwards' });
      // הכיתוב השני נכנס במקומו (בלי לעלות מלמטה): השורה העליונה של ההוצאות עוד נחה ממש מתחתיו
      tl.add(cap2, [{ opacity: 0, transform: T(0, capY, 'scale(.96)') }, { opacity: 1, transform: T(0, capY) }], { at: 6700, duration: 600 });
      // ההוצאות יורדות אל "קו המיון" שמתחת לסכום ומחליקות לאורכו, כל אחת לעמודה של הקטגוריה שלה.
      // אלה שמעל הסכום עוקפות אותו מהצדדים, והסכום עולה ומפנה את המרכז רק אחרי שהן יצאו מדרכו.
      tl.add(total, [{ transform: T(0, midY) }, { transform: T(0, -vh * 0.11, 'scale(.62)') }], { at: 7100, duration: 650, easing: 'inOut' });
      tl.add(barsAt, [{ transform: T(0, barsY) }, { transform: T(0, barsY) }], { at: 0, duration: 1 });
      tl.call(6800, () => running.set(sum));
      // שתי הקבוצות יוצאות יחד, ובכל אחת — הקרובות למרכז ראשונות: הן אלה שעומדות בדרכו של הסכום
      const leave = [];
      [chips.map((c, i) => i).filter((i) => i < perSide), chips.map((c, i) => i).filter((i) => i >= perSide)]
        .forEach((group) => group.sort((a, b) => Math.abs(slots[a].x) - Math.abs(slots[b].x)).forEach((i, k) => { leave[i] = k; }));
      chips.forEach((c, i) => {
        const s = slots[i], ci = Math.max(0, catRows.findIndex((r) => r.cat === data[i][0]));
        const hit = catRows.some((r) => r.cat === data[i][0]);              // במסך צר מוצגות רק הקטגוריות הגדולות; השאר מתפוגגות בדרך
        const upper = i < perSide, side = Math.abs(s.x) < 1 ? (i % 2 ? 1 : -1) : Math.sign(s.x);
        const land = { x: barX(ci), y: Math.max(barsY - 2 * u, totBox[0].b + 14 + H * 0.31), s: 0.5, r: 0 };
        const sink = { opacity: 0, transform: T(land.x, land.y + 6 * u, 'scale(.2)') };
        let frames = upper ? route({ x: s.x, y: s.y, s: 1, r: s.rot }, land, { w: widths[i], h: H, side: side, halfW: vw / 2, blocks: totBox, sf: 0.62, visible: true }) : null;
        if (frames) frames.forEach((f) => { f.offset = +(f.offset * 0.82).toFixed(4); if (!hit) f.opacity = +(1 - Math.pow(f.offset / 0.82, 2)).toFixed(3); });
        else if (upper) {
          // מסך צר מאוד, שאין בו דרך מסביב לסכום: ההוצאה מתכווצת ונמוגה במקומה, במקום לחצות אותו
          frames = [{ opacity: 1, transform: T(s.x, s.y, 'scale(1) rotate(' + s.rot.toFixed(1) + 'deg)') }, { opacity: 0, transform: T(s.x, s.y + 8, 'scale(.7) rotate(0deg)'), offset: 0.4 }];
        } else frames = [{ opacity: 1, transform: T(s.x, s.y, 'scale(1) rotate(' + s.rot.toFixed(1) + 'deg)') }, { opacity: hit ? 1 : 0, transform: T(land.x, land.y, 'scale(.5) rotate(0deg)'), offset: 0.82 }];
        frames.push(sink);
        tl.add(c, frames, { at: 6800 + leave[i] * 40, duration: upper ? 900 : 760, easing: 'inOut' });
      });
      B.cols.forEach((b, i) => {
        tl.add(b.col, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { at: 7500 + i * 130, duration: 1100, easing: 'spring' });
        tl.add(b.name, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { at: 7950 + i * 110, duration: 500 });   // אחרי שההוצאות שנחו כאן יצאו לדרכן
        tl.add(b.val, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { at: 8400 + i * 120, duration: 500 });
      });

      /* ---------- סצנה 4: רגעים מהחיים, וחודשים מעוצבים (10.6 – 13.4) ---------- */
      [barsAt, total, cap2].forEach((node, i) => tl.add(node, [{ opacity: 1 }, { opacity: 0 }], { at: 10250 + i * 60, duration: 380, easing: 'in', fill: 'forwards' }));
      tl.add(seal, [{ opacity: 0.16 }, { opacity: 0.3 }], { at: 10300, duration: 800, fill: 'forwards' });
      tl.add(cap3, [{ opacity: 0, transform: T(0, capY + 3 * u) }, { opacity: 1, transform: T(0, capY) }], { at: 10600, duration: 600 });
      const fan = [[-1, -7], [0, 0], [1, 7]];
      const spread = Math.min(cw * 1.06, vw * 0.31), cardsY = vh * 0.09;
      cards.forEach((c, i) => {
        const x = fan[i][0] * spread, rot = fan[i][1], y = cardsY + Math.abs(fan[i][0]) * 2.5 * u;
        tl.add(c.at, [{ opacity: 0, transform: T(x * 0.3, vh * 0.7, 'rotate(' + rot * 3 + 'deg)') }, { opacity: 1, transform: T(x, y, 'rotate(' + rot + 'deg)') }], { at: 10650 + i * 140, duration: 1000, easing: 'spring' });
        tl.add(c.img, [{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { at: 10650 + i * 140, duration: 2600, easing: 'out' });
        tl.add(c.card, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], { at: 12000 + i * 130, duration: 800, easing: 'inOut' });
        tl.add(c.at, [{ opacity: 1, transform: T(x, y, 'rotate(' + rot + 'deg)') }, { opacity: 0, transform: T(x * 0.2, C0, 'scale(.12) rotate(0deg)') }], { at: 13250 + i * 60, duration: 520, easing: 'in' });
      });
      tl.add(cap3, [{ opacity: 1 }, { opacity: 0 }], { at: 11950, duration: 280, fill: 'forwards' });
      tl.add(cap4, [{ opacity: 0, transform: T(0, capY + 3 * u) }, { opacity: 1, transform: T(0, capY) }], { at: 12150, duration: 550 });
      tl.add(cap4, [{ opacity: 1 }, { opacity: 0 }], { at: 13200, duration: 300, fill: 'forwards' });

      /* ---------- סצנה 5: חזרה למטבע, ומסירה לאתר (13.4 – 15.0) ---------- */
      tl.add(coinAt, [{ transform: T(0, topY, 'scale(.42)') }, { transform: T(0, C0, 'scale(1)') }], { at: 13300, duration: 800, easing: 'spring' });
      tl.add(coin, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }], { at: 13300, duration: 900, easing: 'inOut', fill: 'none' });
      tl.add(seal, [{ opacity: 0.3, transform: T(0, vh * 0.02, 'scale(1.5) rotate(20deg)') }, { opacity: 0.5, transform: T(0, C0, 'scale(1) rotate(60deg)') }], { at: 13300, duration: 900, easing: 'inOut' });
      tl.add(word, [{ opacity: 0, transform: T(0, 17 * u, 'scale(.94)') }, { opacity: 1, transform: T(0, 15 * u) }], { at: 13700, duration: 550 });
      tl.add(tag, [{ opacity: 0, transform: T(0, 25.5 * u) }, { opacity: 1, transform: T(0, 23.5 * u) }], { at: 13950, duration: 550 });
      // המסירה: הרקע נעלם, והמטבע עף בדיוק אל הסמל שבפינה
      const exitAt = 14450;
      [word, tag, seal].forEach((node) => tl.add(node, [{ opacity: 1 }, { opacity: 0 }], { at: exitAt, duration: 300, easing: 'in', fill: 'forwards' }));
      tl.add(st.node.querySelector('.fx__bg'), [{ opacity: 1 }, { opacity: 0 }], { at: exitAt + 100, duration: 450, easing: 'inOut' });
      tl.call(exitAt + 100, leaving);
      tl.add(st.skip, [{ opacity: 1 }, { opacity: 0 }], { at: exitAt, duration: 200, fill: 'forwards' });
      tl.add(st.bar.parentNode, [{ opacity: 1 }, { opacity: 0 }], { at: exitAt, duration: 200, fill: 'forwards' });
      if (mark) {
        const box = S.getBoundingClientRect();                             // מרכז הבמה בפועל — ממנו נמדד המרחק אל הסמל
        const dx = mark.left + mark.width / 2 - (box.left + box.width / 2), dy = mark.top + mark.height / 2 - (box.top + box.height / 2);
        tl.add(coinAt, [{ transform: T(0, C0, 'scale(1)') }, { transform: T(dx, dy, 'scale(' + (mark.width / coinSize).toFixed(4) + ')') }], { at: exitAt, duration: 550, easing: 'inOut' });
      } else {
        tl.add(coinAt, [{ opacity: 1, transform: T(0, C0) }, { opacity: 0, transform: T(0, C0, 'scale(.6)') }], { at: exitAt, duration: 500, easing: 'in' });
      }
    }

    /* ---------- הפעלה, דילוג וסיום ---------- */
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } };
    document.addEventListener('keydown', onKey, true);
    st.node.addEventListener('click', skip);
    setTimeout(() => st.skip.focus({ preventScroll: true }), 50);

    const done = () => { document.removeEventListener('keydown', onKey, true); unmount(st); resolve(); };
    const start = () => {
      if (skipped) return done();                    // דילגו עוד לפני שהתחיל
      build();
      S.style.visibility = '';
      playing = true;
      tl.play().then(() => {
        const out = skipped ? st.node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished.catch(() => {}) : Promise.resolve();
        return out.then(done);
      });
    };
    // מחכים לגופנים ולצילומים (כולם קבצים מקומיים), כדי שהמידות יהיו אמיתיות והפריים הראשון שלם
    const F = document.fonts;
    const face = (weight, family, text) => (F && F.load ? F.load(weight + ' 40px "' + family + '"', text).catch(() => {}) : Promise.resolve());
    const ready = [face(700, 'Frank Ruhl Libre', 'פרוטה'), face(900, 'Frank Ruhl Libre', 'פרוטה'), face(800, 'Heebo', '₪1,234'), face(600, 'Heebo', 'פרוטה'), F && F.ready ? F.ready : Promise.resolve()]
      .concat(cards.map((c) => (c.img.decode ? c.img.decode().catch(() => {}) : Promise.resolve())));
    Promise.race([Promise.all(ready), new Promise((r) => setTimeout(r, 900))]).then(start);
    return promise;
  }

  /* ======================================================================
     2. קליטת קובץ
     res: { files: [{name}], added, duplicates, ids: Set }
     ====================================================================== */
  function importSequence(res) {
    if (active || M.reduced() || !res || !res.ids || !res.ids.size) return Promise.resolve();
    const st0 = P.state;
    const txs = st0.data.tx.filter((t) => res.ids.has(t.id));
    const spend = txs.filter((t) => t.amount < 0);
    if (spend.length < 4) return Promise.resolve();

    const view = viewport(), vw = view.w, vh = view.h, u = Math.min(vw, vh) / 100, narrow = vw < 700;
    const tl = M.timeline();
    let resolve, skipped = false;
    const promise = new Promise((r) => { resolve = r; });
    const st = stage('import', () => { skipped = true; tl.finish(); });
    const S = st.body;

    // הקטגוריות הגדולות בקובץ הזה, לפי מספר התנועות
    const byCat = P.dict();
    spend.forEach((t) => { (byCat[t.cat] = byCat[t.cat] || { cat: t.cat, n: 0, sum: 0, tx: [] }); byCat[t.cat].n++; byCat[t.cat].sum -= t.amount; byCat[t.cat].tx.push(t); });
    const rows = Object.values(byCat).sort((a, b) => b.n - a.n).slice(0, narrow ? 4 : 6).map((r) => ({
      cat: r.cat, short: r.cat === P.cats.OTHER ? 'ממתין' : r.cat.split(' ')[0], color: st0.tintOf(r.cat), value: r.n, label: fmt.count(r.n), tx: r.tx
    }));
    const barW = Math.round(Math.min(narrow ? 17 * u : 12.5 * u, 120)), gap = Math.round(narrow ? 3 * u : 3.4 * u);
    const B = bars(rows, { w: barW, gap: gap, maxH: Math.round(Math.min(26 * u, vh * 0.26)), labelH: Math.round(barW * 0.42) + 34 });
    const barsY = vh * 0.2;
    const barsAt = at('fx__barsat', B.node);

    // דוגמאות אמיתיות מהקובץ: שלוש מכל קטגוריה, בסדר מעורבב
    const picks = [];
    for (let k = 0; k < 3; k++) rows.forEach((r, ci) => { const t = r.tx[Math.floor((k + 0.5) * r.tx.length / 3)]; if (t) picks.push({ t: t, ci: ci, color: r.color }); });
    const sample = picks.slice(0, narrow ? 10 : 18);
    const chips = sample.map((p) => at('fx__chipat', chip(p.t.cat, p.t.desc.length > 16 ? p.t.desc.slice(0, 15) + '…' : p.t.desc, p.t.amount, p.color)));

    const months = new Set(txs.map((t) => t.date.slice(0, 7))).size;
    const auto = txs.filter((t) => t.cat !== P.cats.OTHER).length;
    const sources = new Set(res.files.map((f) => f.file || f.name));        // חוברת עם כמה גיליונות היא קובץ אחד
    const name = sources.size > 1 ? fmt.count(sources.size) + ' קבצים' : sources.values().next().value;
    const file = at('fx__file', el('div.fxfile', null, [
      el('span.fxfile__icon', null, P.icons.svg('file', 26)),
      el('div', null, [el('b', { text: name }), el('span.fxfile__sub', { text: 'קוראת את התנועות…' })]),
      el('i.fxfile__scan')
    ]));
    const figs = [
      { v: txs.length, f: (v) => fmt.count(Math.round(v)), label: 'תנועות' },
      { v: months, f: (v) => fmt.count(Math.round(v)), label: months === 1 ? 'חודש' : 'חודשים' },
      { v: txs.length ? auto / txs.length : 0, f: (v) => fmt.pct(v), label: 'סווגו לבד' }
    ];
    const statNodes = figs.map((g) => { const b = el('b.fig', { text: g.f(0) }); return { b: b, node: el('div', null, [b, el('span', { text: g.label })]), g: g }; });
    const stats = at('fx__stats', el('div.fxstats', null, statNodes.map((s) => s.node)));
    const coin = art.coin(Math.round(Math.min(18 * u, 150)));
    const coinAt = at('fx__coin', coin);

    [barsAt].concat(chips, [file, stats, coinAt]).forEach((n) => S.appendChild(n));
    mount(st);
    active = { promise: promise };
    const barX = (ci) => B.cols[ci].node.offsetLeft + barW / 2;            // המקום האמיתי של העמודה (מימין לשמאל), לא חישוב

    const fileY = -vh * 0.32, statsY = -vh * 0.12, D = 5000;
    tl.add(st.bar, [{ width: '0%' }, { width: '100%' }], { at: 0, duration: D, easing: 'linear' });
    tl.add(st.node.querySelector('.fx__bg'), [{ opacity: 0 }, { opacity: 1 }], { at: 0, duration: 300 });
    tl.add(file, [{ opacity: 0, transform: T(0, fileY - 8 * u, 'scale(.9)') }, { opacity: 1, transform: T(0, fileY) }], { at: 100, duration: 650, easing: 'spring' });
    tl.add(file.querySelector('.fxfile__scan'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-440%)' }], { at: 500, duration: 1900, easing: 'inOut' });
    tl.add(barsAt, [{ transform: T(0, barsY) }, { transform: T(0, barsY) }], { at: 0, duration: 1 });
    // סדר הדברים שומר על מסך נקי: קודם כל התנועות יורדות לעמודות, ורק כשהדרך פנויה מופיעים המספרים
    chips.forEach((c, i) => {
      const p = sample[i], t0 = 600 + i * (1300 / chips.length);
      const lim = Math.max(0, vw / 2 - c.firstChild.offsetWidth / 2 - 12);          // גם באמצע הדרך התג נשאר כולו בתוך המסך
      const side = (i % 2 ? 1 : -1) * (6 + (i * 29) % 12) * u * (narrow ? 0.6 : 1);
      const mx = Math.max(-lim, Math.min(lim, barX(p.ci) * 0.5 + side));
      tl.add(c, [
        { opacity: 0, transform: T(0, fileY, 'scale(.3)') },
        { opacity: 1, transform: T(mx, fileY + (barsY - fileY) * 0.42, 'scale(1) rotate(' + ((i * 53) % 13 - 6) + 'deg)'), offset: 0.42 },
        { opacity: 1, transform: T(barX(p.ci), barsY - 3 * u, 'scale(.55)'), offset: 0.86 },
        { opacity: 0, transform: T(barX(p.ci), barsY + 3 * u, 'scale(.2)') }
      ], { at: t0, duration: 1100, easing: 'inOut' });
    });
    B.cols.forEach((b, i) => {
      tl.add(b.name, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { at: 500 + i * 90, duration: 450 });
      tl.add(b.col, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { at: 1500 + i * 120, duration: 1300, easing: 'spring' });
      tl.add(b.val, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { at: 3050 + i * 70, duration: 400 });      // אחרי שהתנועה האחרונה נחתה
    });
    tl.add(stats, [{ opacity: 0, transform: T(0, statsY + 3 * u) }, { opacity: 1, transform: T(0, statsY) }], { at: 2500, duration: 550 });
    tl.call(2550, () => statNodes.forEach((s, i) => setTimeout(() => M.countTo(s.b, s.g.v, s.g.f, 950), i * 140)));
    tl.add(file.querySelector('.fxfile__sub'), [{ opacity: 1 }, { opacity: 0.35 }], { at: 2500, duration: 250 });
    // החותמת: המטבע נוחת במרכז, והכל מתכנס אליו
    [file, stats, barsAt].forEach((n) => tl.add(n, [{ opacity: 1 }, { opacity: 0 }], { at: 4100, duration: 300, easing: 'out', fill: 'forwards' }));   // מפנים את המרכז לפני שהמטבע נוחת בו
    tl.add(coinAt, [{ opacity: 0, transform: T(0, -2 * u, 'scale(2.4)') }, { opacity: 1, transform: T(0, -2 * u, 'scale(1)') }], { at: 4150, duration: 520, easing: 'back' });
    tl.add(coin, [{ transform: 'rotateY(-360deg)' }, { transform: 'rotateY(0deg)' }], { at: 4150, duration: 700, easing: 'out' });
    tl.add(st.node, [{ opacity: 1 }, { opacity: 0 }], { at: 4700, duration: 300, easing: 'in' });
    tl.call(4700, leaving);

    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); skipped = true; tl.finish(); } };
    document.addEventListener('keydown', onKey, true);
    st.node.addEventListener('click', () => { skipped = true; tl.finish(); });
    tl.play().then(() => {
      document.removeEventListener('keydown', onKey, true);
      // מי שדילג: הערכים הסופיים, ומיד החוצה
      statNodes.forEach((s) => { s.b.textContent = s.g.f(s.g.v); });
      unmount(st);
      resolve();
    });
    return promise;
  }

  /* ======================================================================
     3. במה לרצפים נוספים (ui/stories.js)
     אותה במה ואותם כללים: ציר זמן אחד, דילוג בכל רגע (כפתור, לחיצה, Esc, Enter, רווח),
     ובלי רצף בכלל כשמערכת ההפעלה מבקשת פחות תנועה.
     build(sc) בונה את הסצנה על sc.tl רק אחרי שהגופנים והצילומים נטענו, כדי שהפריסה תיבנה
     מהמידות האמיתיות; sc = { S, tl, st, vw, vh, u }. מחזיר את משך הרצף, והבמה מתפוגגת בסופו.
     opts: { vars (משתני צבע לבמה), backdrop (שכבת רקע), images (לחכות שייטענו) }
     מחזיר Promise<boolean>: true כשהרצף נצפה עד הסוף, false כשדילגו עליו או שלא רץ.
     ====================================================================== */
  function run(kind, label, build, opts) {
    const o = opts || {};
    if (active || M.reduced()) return Promise.resolve(false);
    const view = viewport(), vw = view.w, vh = view.h;
    const tl = M.timeline();
    let resolve, skipped = false, playing = false;
    const promise = new Promise((r) => { resolve = r; });
    const skip = () => { skipped = true; if (playing) tl.finish(); };
    const st = stage(kind, skip, label);
    if (o.vars) Object.keys(o.vars).forEach((k) => st.node.style.setProperty(k, o.vars[k]));
    if (o.backdrop) { const bg = st.node.querySelector('.fx__bg'); bg.insertBefore(o.backdrop, bg.firstChild); }
    st.body.style.visibility = 'hidden';               // עד שהסצנה נבנית — רק הרקע
    mount(st);
    active = { promise: promise };

    // הרצף יכול לרוץ מעל חלון פתוח: המקשים שלו לא מגיעים לחלון שמתחתיו
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); skip(); }
      else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('keydown', onKey, true);
    st.node.addEventListener('click', skip);
    setTimeout(() => st.skip.focus({ preventScroll: true }), 50);

    const done = () => { document.removeEventListener('keydown', onKey, true); unmount(st); resolve(!skipped); };
    const start = () => {
      if (skipped) return done();
      let D;
      try { D = build({ S: st.body, tl: tl, st: st, vw: vw, vh: vh, u: Math.min(vw, vh) / 100 }) || tl.duration; }
      catch (e) { console.error(e); skipped = true; return done(); }
      tl.add(st.bar, [{ width: '0%' }, { width: '100%' }], { at: 0, duration: D, easing: 'linear' });
      tl.add(st.node, [{ opacity: 1 }, { opacity: 0 }], { at: D - 420, duration: 420, easing: 'inOut' });
      tl.call(D - 420, leaving);
      st.body.style.visibility = '';
      playing = true;
      tl.play().then(() => {
        const out = skipped ? st.node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' }).finished.catch(() => {}) : Promise.resolve();
        return out.then(done);
      });
    };
    const F = document.fonts;
    const face = (weight, family, text) => (F && F.load ? F.load(weight + ' 40px "' + family + '"', text).catch(() => {}) : Promise.resolve());
    const ready = [face(700, 'Frank Ruhl Libre', label), face(900, 'Frank Ruhl Libre', label + ' 2026'), face(800, 'Heebo', '₪1,234'), face(600, 'Heebo', label), F && F.ready ? F.ready : Promise.resolve()]
      .concat((o.images || []).map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
    Promise.race([Promise.all(ready), new Promise((r) => setTimeout(r, 1200))]).then(start);
    return promise;
  }

  /* ---------- מתי להציג את הפתיח ---------- */
  /* first (ברירת המחדל): רק בביקור הראשון אי-פעם — מי שחוזר כל שבוע לבדוק הוצאות לא צריך לראות
     שוב 15 שניות של פתיח; אפשר לצפות בו שוב מההגדרות בכל רגע. session: פעם בביקור. */
  function introMode() {
    const p = (P.state.data.prefs && P.state.data.prefs.intro) || 'first';
    return ['first', 'always', 'session', 'off'].indexOf(p) === -1 ? 'first' : p;
  }
  function shouldPlayIntro() {
    if (M.reduced() || /[?&#]intro=0/.test(location.href)) return false;
    const mode = introMode();
    if (mode === 'off') return false;
    if (mode === 'always') return true;
    try { return mode === 'first' ? !localStorage.getItem('pruta.introSeen') : !sessionStorage.getItem('pruta.intro'); } catch (e) { return true; }
  }
  function markIntroSeen() {
    try { sessionStorage.setItem('pruta.intro', '1'); localStorage.setItem('pruta.introSeen', '1'); } catch (e) { /* אין אחסון */ }
  }

  return {
    intro, importSequence, run, shouldPlayIntro, markIntroSeen, introMode, isActive: () => !!active,
    // אבני הבניין, לרצפים שב-ui/stories.js
    parts: { at, T, chip, ticker, bars, boxOf, partOf, route, touching }
  };
})();
