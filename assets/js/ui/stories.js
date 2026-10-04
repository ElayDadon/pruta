/* ==========================================================================
   ui/stories.js — ההדמיות: רצפים קצרים שמספרים את הנתונים שלך
   ---------------------------------------------------------------------------
   אותה במה ואותה שפה של הפתיח (ui/fx.js) — המטבע, הגיליוש, התגים הלבנים —
   אבל כאן כל מה שזז הוא הנתונים האמיתיים:

   1. סיפור החודש (15 שניות)        מהכותרת בסקירה, ומראש חלון החודש.
   2. סיפור השנה (16 שניות)         מכרטיס השנה בסקירה, ומכל שנה בעמוד החודשים.
   3. הקבועות של השנה הקרובה (11)   מהתובנות, ומחלון ההוצאות הקבועות.
   4. הכל מסודר (5.6 שניות)         כשבית העסק האחרון בעמוד השיוך מקבל קטגוריה.

   הכללים של docs/MOTION.md חלים על כולם: ציר זמן אחד לכל רצף; תנועה רק כשהיא אומרת משהו;
   שום דבר לא עובר מעל טקסט (טקסט מופיע רק כשהדרך כבר פנויה); הסכום שרץ הוא תמיד בדיוק סכום
   מה שכבר על המסך; הפריסה נבנית מהמידות האמיתיות; דילוג בכל רגע — ובלי רצפים בכלל כשמערכת
   ההפעלה מבקשת פחות תנועה. אז גם הכפתורים שפותחים אותם לא מופיעים.
   העובדות עצמן (מה כל רצף מספר) מחושבות ב-core/insights.js, ונבדקות שם.
   ========================================================================== */
window.P = window.P || {};

P.stories = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, art = P.art, ic = P.icons, M = P.motion;
  const X = P.fx.parts, at = X.at, T = X.T, ticker = X.ticker;

  /** אפשר להציג הדמיה: יש נתונים, ומערכת ההפעלה לא ביקשה פחות תנועה */
  const can = () => !M.reduced() && P.state.data.tx.length > 0;
  const canRecurring = () => can() && !!P.insights.recurringYear();

  /* ======================================================================
     הזרימה: כל מקום מציג את עצמו בפעם הראשונה שמגיעים אליו — בלי לחפש כפתור.
       חודש שנפתח (מכל מקום)        → סיפור החודש, ובסופו חלון החודש     'm:2026-09'
       עמוד החודשים                  → סיפור השנה                          'y'
       ההוצאות הקבועות (חלון/לשונית) → השנה הקרובה שלהן, ובסופה החלון     'r'
       בית העסק האחרון בתור השיוך    → הכל מסודר (בכל פעם שהתור מתרוקן)
     ההגדרה stories: first (ברירת המחדל) · always · off. המקומות שכבר הוצגו נשמרים ב-prefs.seen,
     יחד עם שאר הנתונים — כך שגם אחרי שחזור מגיבוי לא חוזרים על עצמם. הכפתורים נשארים, לצפייה חוזרת.
     ====================================================================== */
  const mode = () => (P.state.data.prefs && P.state.data.prefs.stories) || 'first';
  const seenList = () => P.state.data.prefs.seen || [];
  /** האם להציג עכשיו, מעצמה, את ההדמיה של המקום הזה */
  function firstTime(key) {
    if (!can() || P.fx.isActive() || mode() === 'off') return false;
    return mode() === 'always' || seenList().indexOf(key) === -1;
  }
  function markSeen(key) { if (seenList().indexOf(key) === -1) P.state.setPref('seen', seenList().concat([key])); }
  /** אחרי הרצף: then רץ כשצפו עד הסוף — ועם always גם כשדילגו, או כשלא היה מה להציג (למשל חלון שביקשו לפתוח) */
  const after = (o) => (watched) => { if (o.then && (watched || o.always)) setTimeout(o.then, 60); return watched; };

  /* ======================================================================
     אבני בניין
     ====================================================================== */
  const hOf = (node) => node.firstChild.offsetHeight;          // הגודל של מה שיושב במחזיק ממורכז
  const wOf = (node) => node.firstChild.offsetWidth;
  /** הגבולות שבתוכם מניחים דברים: שוליים קבועים מלמעלה ומלמטה */
  function frame(vh, u) { const m = Math.max(18, 3 * u); return { top: -vh / 2 + m, bottom: vh / 2 - m }; }
  function coinOf(size) { const coin = art.coin(size); return { coin: coin, at: at('fx__coin', coin), size: size }; }
  function sealOf(seed, petals) { return at('fx__seal', art.seal({ seed: seed, color: '#fff', width: 0.32, petals: petals, quality: 'hi' })); }
  const caption = (text) => at('fx__cap.fx__cap--wrap', el('p', { text: text }));
  /** מחזיק שנשאר במקום אחד לאורך כל הרצף */
  const place = (tl, node, x, y) => tl.add(node, [{ transform: T(x, y) }, { transform: T(x, y) }], { at: 0, duration: 1 });
  /** נכנס במקום: מתבהר ועולה מעט */
  const rise = (tl, node, y, t, u, dur) => tl.add(node, [{ opacity: 0, transform: T(0, y + 2.2 * u) }, { opacity: 1, transform: T(0, y) }], { at: t, duration: dur || 550 });
  /** מתפוגג (ונשאר כך) */
  const out = (tl, nodes, t, dur) => nodes.forEach((n, i) => { if (n) tl.add(n, [{ opacity: 1 }, { opacity: 0 }], { at: t + i * 40, duration: dur || 300, easing: 'in', fill: 'forwards' }); });
  /** המטבע נופל, מסתובב ונוחת — כמו בפתיח */
  function drop(tl, c, y, t, vh) {
    tl.add(c.at, [{ transform: T(0, -vh * 0.75), opacity: 0 }, { transform: T(0, -vh * 0.75), opacity: 1, offset: 0.02 }, { transform: T(0, y), opacity: 1 }], { at: t, duration: 1250, easing: 'bounce' });
    tl.add(c.coin, [{ transform: 'rotateY(-900deg) rotateX(24deg)' }, { transform: 'rotateY(0deg) rotateX(0deg)' }], { at: t, duration: 1700, easing: 'out' });
  }
  const pulse = (tl, node, t, k) => tl.add(node, [{ transform: 'scale(1)' }, { transform: 'scale(' + (k || 1.1) + ')' }, { transform: 'scale(1)' }], { at: t, duration: 200, easing: 'out', fill: 'none' });
  /** שם גדול שעולה חלק אחר חלק: ספרות (משמאל לימין, כמו שכותבים מספר) או אותיות של מילה אחת, או מילים */
  function bigWord(text) {
    const digits = /^\d+$/.test(text), words = /\s/.test(text);
    const parts = (digits || !words ? text.split('') : text.split(/\s+/)).map((p) => el('span', { text: p }));
    return { at: at('fx__word', el('h1' + (words ? '.is-words' : ''), { 'aria-label': text, dir: digits ? 'ltr' : null }, parts)), parts: parts };
  }
  const letterIn = [{ opacity: 0, transform: 'translateY(60%) rotate(8deg)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }];
  /** האם שני מלבנים {l, r, t, b} נוגעים, עם מרווח */
  const hit = (a, b, gap) => a.l < b.r + gap && b.l < a.r + gap && a.t < b.b + gap && b.t < a.b + gap;
  const rectAt = (node, x, y) => ({ l: x - wOf(node) / 2, r: x + wOf(node) / 2, t: y - hOf(node) / 2, b: y + hOf(node) / 2 });

  /** שורת קטגוריה: איור, שם, פס באורך האמיתי, סכום וחלק מהשלם */
  function catRow(c, max) {
    const bar = el('i', { style: 'width:' + Math.max(1.5, c.sum / (max || 1) * 100).toFixed(1) + '%' });
    const aside = el('span.fxrow__aside', null, [el('b.fig', { text: fmt.money(c.sum) }), el('small', { text: fmt.pct(c.share) })]);
    const node = el('div.fxrow' + (c.cat === P.cats.OTHER ? '.is-pending' : ''), { vars: { '--c': c.tint || c.color } }, [
      c.rest ? el('span.ctile', { vars: { '--c': c.tint, '--s': '36px' } }, ic.svg('more', 18)) : art.tile(c.cat, 36, c.tint || c.color),
      el('span.fxrow__main', null, [el('span.fxrow__name', { text: c.cat }), el('span.fxrow__track', null, bar)]),
      aside
    ]);
    return { node: node, bar: bar, aside: aside };
  }

  /** כפתור שפותח הדמיה: מטבע קטן שמסתובב בריחוף, ושם הרצף. כשמבקשים פחות תנועה — אין כפתור */
  function button(text, onRun, cls, size) {
    if (M.reduced()) return null;
    return el('button.btn.btnstory' + (cls ? '.' + cls : ''), { type: 'button', title: 'הדמיה קצרה · אפשר לדלג בכל רגע', onclick: (e) => { e.stopPropagation(); onRun(); } },
      [el('span.btnstory__coin', null, art.coin(size || 20)), text]);
  }

  /* ======================================================================
     1. סיפור החודש — 15 שניות, בצבעים של החודש
        0.0  הצילום של החודש נפתח מאחור. המטבע נוחת, ושם החודש עולה אות אחר אות.
        2.6  כמה יצא: עמודה לכל יום, מימין לשמאל — והסכום גדל בדיוק בהוצאה של כל יום שצמח.
        6.0  לאן זה הלך: הקטגוריות הגדולות, כל פס באורך האמיתי שלו.
        9.1  שלושה רגעים: ההוצאה הגדולה, המקום הקבוע, יום השיא.
       11.9  הכרטיסים חוזרים אל המטבע, ומתחתיו המשפט שמסכם את החודש.
     ====================================================================== */
  function month(key, opts) {
    const o = opts || {};
    if (!can() || !key) return Promise.resolve(false).then(after(o));
    const d = P.insights.monthStory(key);
    if (!d.count) return Promise.resolve(false).then(after(o));
    markSeen('m:' + key);
    const info = P.posters.info(key);
    const img = el('img.fxm__img', { src: P.posters.src(key), alt: '', decoding: 'async', draggable: 'false', style: 'object-position:' + info.fx + '% ' + info.fy + '%' });
    const num = el('span.fxm__num', { text: key.slice(5, 7) });
    const backdrop = el('div.fxm__photo', { 'aria-hidden': 'true' }, [img, el('div.fxm__scrim'), num]);
    return P.fx.run('month', 'סיפור ' + fmt.monthName(key), (sc) => buildMonth(sc, d, img, num), { vars: P.posters.vars(key), backdrop: backdrop, images: [img] })
      .then(after(o));
  }

  function momentCard(mo, row) {
    const tint = mo.cat ? P.state.tintOf(mo.cat) : 'var(--m-mid)';
    const icon = mo.icon ? el('span.fxmo__icon', null, ic.svg(mo.icon, 24)) : mo.merchant ? art.avatar(mo.merchant, mo.cat, 48) : art.tile(mo.cat, 48, tint);
    const card = el('div.fxmo' + (row ? '.fxmo--row' : ''), { vars: { '--c': tint } }, [
      icon,
      el('div.fxmo__main', null, [el('span.fxmo__k', { text: mo.label }), el('b.fxmo__t', { text: mo.title }), el('span.fxmo__s', { text: mo.sub })]),
      el('span.fxmo__f.fig', { text: fmt.money(mo.amount) })
    ]);
    return { at: at('fxmo__at', card), card: card };
  }

  function buildMonth(sc, d, img, num) {
    const S = sc.S, tl = sc.tl, vw = sc.vw, vh = sc.vh, u = sc.u;
    const F = frame(vh, u), wide = vw >= 760 && vh >= 520;
    const name = fmt.monthOnly(d.key), n = +d.key.slice(5, 7);
    const D = 15400, s2 = 2600, s3 = 6000, s4 = 9100, s5 = 11900;

    /* ---------- אובייקטים ---------- */
    const c = coinOf(Math.round(Math.min(18 * u, 160)));
    const seal = sealOf(300 + n * 17, 6 + (n % 6));                      // החותם של החודש — אותו חותם שעל הפוסטר שלו
    const title = bigWord(name);
    const sub = at('fxm__sub', el('p', null, [el('b', { text: P.posters.info(d.key).word }), el('span', { text: d.key.slice(0, 4) })]));
    const fig = el('span.fig', { text: '₪0' });
    const running = ticker(fig, fmt.money);
    const total = at('fx__total', el('div', null, [el('small', { text: 'יצא החודש' }), fig]));
    const delta = at('fxm__delta', el('span.fxm__chip.is-' + d.tone, { text: d.note }));

    // עמודה לכל יום; היום הראשון מימין, כמו קריאה בעברית
    const nDays = d.days.length, maxDay = Math.max.apply(null, d.days.concat([1]));
    const chartW = Math.min(vw - 32, 880);
    const dayCols = d.days.map((v) => el('i' + (v > 0 ? '' : '.is-zero')));
    const daysBox = el('div.fxm__days', null, dayCols);
    const axis = el('div.fxm__axis', null, [1, 10, 20, nDays].map((k) => el('span', { style: 'right:' + ((k - 0.5) / nDays * 100).toFixed(2) + '%', text: String(k) })));
    const chart = at('', el('div', { style: 'width:' + chartW + 'px' }, [daysBox, axis]));

    const head3 = caption('לאן הלך הכסף');
    const rows = d.cats.map((x) => catRow(x, d.cats[0] ? d.cats[0].sum : 1));
    const rowsBox = el('div.fxrows', { style: 'width:' + Math.min(vw - 32, 620) + 'px' }, rows.map((r) => r.node));
    const rowsAt = at('', rowsBox);
    const take = at('fxm__take', el('p', { text: d.takeaway }));

    const head4 = caption(fmt.prefix('רגעים מ', name));
    const cards = d.moments.map((mo) => momentCard(mo, !wide));
    const lines = at('fxm__lines', el('p', { text: d.lines.join(' ') }));

    [seal, chart, rowsAt, take].concat(cards.map((k) => k.at), [total, delta, c.at, title.at, sub, head3, head4, lines]).forEach((x) => S.appendChild(x));

    /* ---------- פריסה, מהמידות האמיתיות ---------- */
    const coinS = c.size, small = 0.42, ts = 0.44;
    const tH = hOf(title.at), sH = hOf(sub), totH = hOf(total), dH = hOf(delta);
    // סצנה 1: מטבע, שם החודש ומילת החודש — קבוצה אחת באמצע
    const g1 = coinS + 2.6 * u + tH + 1.4 * u + sH;
    const coinY0 = -g1 / 2 - 2 * u + coinS / 2;
    const titleY0 = coinY0 + coinS / 2 + 2.6 * u + tH / 2;
    const subY = titleY0 + tH / 2 + 1.4 * u + sH / 2;
    // סצנה 2: המטבע הקטן למעלה, שם החודש מתחתיו ככותרת, הסכום והשינוי, ועמודות הימים בשאר הגובה
    const topY = F.top + coinS * small / 2;
    const capY = topY + coinS * small / 2 + 1.4 * u + tH * ts / 2;
    const totalY = capY + tH * ts / 2 + 1.6 * u + totH / 2;
    const deltaY = totalY + totH / 2 + 1.2 * u + dH / 2;
    const axisH = 24, chartTop = deltaY + dH / 2 + 3 * u;
    // בטלפון גבוה העמודות גדלות אל הגובה שנשאר, במקום להשאיר חצי מסך ריק
    const maxH = Math.max(40, Math.min(Math.max(28 * u, vh * 0.28), 280, F.bottom - axisH - chartTop));
    daysBox.style.height = maxH + 'px';
    dayCols.forEach((col, i) => { if (d.days[i] > 0) col.style.height = Math.max(3, maxH * d.days[i] / maxDay).toFixed(1) + 'px'; });
    const chartY = chartTop + (maxH + axisH) / 2 + Math.max(0, Math.min(4 * u, (F.bottom - chartTop - maxH - axisH) / 2));
    // סצנה 3: כותרת, וכמה שורות שנכנסות בגובה שנשאר
    const capH = hOf(head3), cap3 = topY + coinS * small / 2 + 1.6 * u + capH / 2;
    const rowsTop = cap3 + capH / 2 + 2.4 * u, takeH = hOf(take);
    const rowH = rows.length ? rows[0].node.offsetHeight : 0, rowGap = 10;
    const fit = rowH ? Math.floor((F.bottom - rowsTop - takeH - 2 * u + rowGap) / (rowH + rowGap)) : 0;
    rows.splice(Math.max(1, Math.min(fit, wide ? 5 : 4))).forEach((r) => r.node.remove());
    const rowsH = rowsBox.offsetHeight, rowsY = rowsTop + rowsH / 2;
    const takeY = rowsTop + rowsH + 2 * u + takeH / 2;
    // סצנה 4: שלושה כרטיסים זה לצד זה במניפה עדינה — או, בטלפון, בטור
    const cap4 = topY + coinS * small / 2 + 1.6 * u + hOf(head4) / 2;
    const cardsTop = cap4 + hOf(head4) / 2 + 2.6 * u;
    let pos;
    if (wide) {
      const cw = Math.min(250, (Math.min(vw, 1100) - 64 - 2 * 22) / 3);
      cards.forEach((k) => { k.card.style.width = cw + 'px'; });
      const ch = Math.max.apply(null, cards.map((k) => k.card.offsetHeight));
      cards.forEach((k) => { k.card.style.height = ch + 'px'; });
      const y = Math.min(cardsTop + ch / 2 + 2 * u, (cardsTop + F.bottom) / 2), mid = (cards.length - 1) / 2;
      pos = cards.map((k, i) => ({ x: (mid - i) * (cw + 22), y: y + Math.abs(i - mid) * 1.2 * u, r: (i - mid) * -4 }));   // הראשון מימין
    } else {
      const cw = Math.min(vw - 32, 420), gap = 12;
      cards.forEach((k) => { k.card.style.width = cw + 'px'; });
      const hs = cards.map((k) => k.card.offsetHeight);
      const stack = () => hs.reduce((a, h) => a + h + gap, -gap);
      while (cards.length > 1 && stack() > F.bottom - cardsTop) { cards.pop().at.remove(); hs.pop(); }
      let y = cardsTop + Math.max(0, (F.bottom - cardsTop - stack()) / 3);
      pos = cards.map((k, i) => { const p = { x: 0, y: y + hs[i] / 2, r: 0 }; y += hs[i] + gap; return p; });
    }
    // כל כרטיס עולה אל מקומו מעט מתחתיו, בטור שלו — כך אף כרטיס לא חוצה כרטיס אחר, ושום דבר לא נראה לפני שנכנס למסך
    const last = cards.length - 1;
    const lift = cards.length ? Math.max(8, Math.min(6 * u, vh / 2 - (pos[last].y + cards[last].card.offsetHeight / 2) - 2)) : 0;
    // סצנה 5: המטבע באמצע, והמשפט מתחתיו
    const linesH = hOf(lines);
    let C5 = -vh * 0.1;
    const over = C5 + coinS / 2 + 3 * u + linesH - F.bottom;
    if (over > 0) C5 -= over;
    const linesY = C5 + coinS / 2 + 3 * u + linesH / 2;

    /* ---------- סצנה 1: החודש נפתח (0 – 2.6) ---------- */
    tl.add(img, [{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'scale(1.06)' }], { at: 0, duration: 1800, easing: 'out' });
    tl.add(img, [{ transform: 'scale(1.06)' }, { transform: 'scale(1.16) translate3d(-1.5%, -1%, 0)' }], { at: 1800, duration: D - 1800, easing: 'linear' });
    tl.add(num, [{ opacity: 0, transform: 'translateY(8vmin)' }, { opacity: 1, transform: 'none' }], { at: 300, duration: 1500 });
    drop(tl, c, coinY0, 150, vh);
    tl.add(seal, [{ opacity: 0, transform: T(0, coinY0, 'scale(.35) rotate(-50deg)') }, { opacity: 0.4, transform: T(0, coinY0, 'scale(1) rotate(0deg)') }], { at: 900, duration: 1800 });
    place(tl, title.at, 0, titleY0);
    tl.stagger(title.parts, letterIn, { at: 1300, each: 80, duration: 650 });
    rise(tl, sub, subY, 1900, u);

    /* ---------- סצנה 2: כמה יצא (2.6 – 6.0) ---------- */
    out(tl, [sub], s2 - 100, 280);
    tl.add(c.at, [{ transform: T(0, coinY0) }, { transform: T(0, topY, 'scale(' + small + ')') }], { at: s2, duration: 750, easing: 'inOut' });
    tl.add(seal, [{ opacity: 0.4, transform: T(0, coinY0, 'scale(1)') }, { opacity: 0.12, transform: T(0, vh * 0.04, 'scale(1.5) rotate(20deg)') }], { at: s2, duration: 1400, easing: 'inOut' });
    tl.add(title.at, [{ transform: T(0, titleY0) }, { transform: T(0, capY, 'scale(' + ts + ')') }], { at: s2 + 60, duration: 720, easing: 'inOut' });
    // הסכום והעמודות מופיעים רק אחרי ששם החודש עבר את מקומם בדרך למעלה
    tl.add(total, [{ opacity: 0, transform: T(0, totalY, 'scale(.8)') }, { opacity: 1, transform: T(0, totalY) }], { at: s2 + 780, duration: 600, easing: 'back' });
    tl.add(chart, [{ opacity: 0, transform: T(0, chartY) }, { opacity: 1, transform: T(0, chartY) }], { at: s2 + 780, duration: 400 });
    const d0 = s2 + 980, span = 1900;
    d.days.forEach((v, i) => {
      if (!(v > 0)) return;
      const t = d0 + i * span / nDays;
      tl.add(dayCols[i], [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { at: t, duration: 420, easing: 'out' });
      tl.call(t + 140, () => running.add(v));                         // הסכום גדל בדיוק בהוצאה של היום שצמח
    });
    tl.call(d0 + span + 450, () => running.set(d.total));
    tl.add(delta, [{ opacity: 0, transform: T(0, deltaY + 8) }, { opacity: 1, transform: T(0, deltaY) }], { at: d0 + span + 450, duration: 500 });

    /* ---------- סצנה 3: לאן זה הלך (6.0 – 9.1) ---------- */
    out(tl, [title.at, total, delta, chart], s3 - 340, 320);          // הכותרת הישנה קודם: החדשה עולה בדיוק במקומה
    rise(tl, head3, cap3, s3, u);
    place(tl, rowsAt, 0, rowsY);
    rows.forEach((r, i) => {
      tl.add(r.node, [{ opacity: 0, transform: 'translateX(28px)' }, { opacity: 1, transform: 'none' }], { at: s3 + 200 + i * 120, duration: 520 });
      tl.add(r.bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { at: s3 + 380 + i * 120, duration: 950, easing: 'out' });
      tl.add(r.aside, [{ opacity: 0 }, { opacity: 1 }], { at: s3 + 700 + i * 120, duration: 420 });
    });
    rise(tl, take, takeY, s3 + 1500, u);

    /* ---------- סצנה 4: רגעים מהחודש (9.1 – 11.9) ---------- */
    out(tl, [head3, rowsAt, take], s4 - 330, 300);
    rise(tl, head4, cap4, s4, u);
    cards.forEach((k, i) => {
      const p = pos[i];
      tl.add(k.at, [{ opacity: 0, transform: T(p.x, p.y + lift, 'scale(.94) rotate(' + (p.r * 2) + 'deg)') }, { opacity: 1, transform: T(p.x, p.y, 'scale(1) rotate(' + p.r + 'deg)') }], { at: s4 + 150 + i * 160, duration: 800, easing: 'back' });
    });

    /* ---------- סצנה 5: השורה התחתונה (11.9 – 15.4) ---------- */
    out(tl, [head4], s5 - 300, 260);
    cards.forEach((k, i) => {
      const p = pos[i];
      tl.add(k.at, [{ opacity: 1, transform: T(p.x, p.y, 'rotate(' + p.r + 'deg)') }, { opacity: 0, transform: T(p.x * 0.2, C5, 'scale(.12) rotate(0deg)') }], { at: s5 - 100 + i * 70, duration: 520, easing: 'in' });
    });
    tl.add(c.at, [{ transform: T(0, topY, 'scale(' + small + ')') }, { transform: T(0, C5, 'scale(1)') }], { at: s5, duration: 800, easing: 'spring' });
    tl.add(c.coin, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }], { at: s5, duration: 900, easing: 'inOut', fill: 'none' });
    tl.add(seal, [{ opacity: 0.12, transform: T(0, vh * 0.04, 'scale(1.5) rotate(20deg)') }, { opacity: 0.4, transform: T(0, C5, 'scale(1) rotate(60deg)') }], { at: s5, duration: 900, easing: 'inOut' });
    rise(tl, lines, linesY, s5 + 650, u, 650);
    return D;
  }

  /* ======================================================================
     2. סיפור השנה — 16 שניות
        0.0  המטבע נוחת; השנה עולה ספרה אחר ספרה.
        2.7  פורטים את השנה: המטבע נשבר לחודשים — פוסטר לכל חודש, והסכום גדל בהוצאה של כל חודש שנחת.
        6.9  החודשים זה מול זה: עמודה בצבע של כל חודש, קו הממוצע, היקר והזול.
        9.9  לאן הלך הכסף: הסכום נכנס למרכז טבעת שמתמלאת, קטגוריה אחר קטגוריה.
       12.8  המטבע מתאחה, ומתחתיו השורה התחתונה של השנה.
     ====================================================================== */
  function year(y, opts) {
    const o = opts || {};
    if (!can()) return Promise.resolve(false).then(after(o));
    const d = P.insights.yearStory(y || null);
    if (!d || d.months.length < 2) return Promise.resolve(false).then(after(o));
    markSeen('y');
    const cards = d.months.map((mm) => {
      const poster = P.posters.month(mm.key, { size: 'card', label: true, eager: true });
      const card = el('div.fxy__card' + (mm.partial ? '.is-partial' : ''), null, [poster, el('b.fxy__amt.fig', { text: fmt.money(mm.outflow) })]);
      return { at: at('', card), card: card, img: poster.querySelector('img') };
    });
    return P.fx.run('year', y ? 'סיפור השנה ' + y : 'סיפור השנה', (sc) => buildYear(sc, d, cards), { images: cards.map((k) => k.img) })
      .then(after(o));
  }

  /** טבעת: קשת לכל קטגוריה, שמצוירת כשהיא מקבלת את התור שלה */
  function ring(segs, size) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-100 -100 200 200');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    const R = 84, gap = segs.length > 1 ? 0.025 : 0, total = segs.reduce((a, g) => a + g.sum, 0) || 1;
    const track = document.createElementNS(NS, 'circle');
    track.setAttribute('r', R); track.setAttribute('class', 'fxy__track');
    svg.appendChild(track);
    let a = -Math.PI / 2;
    const arcs = segs.map((g) => {
      const span = g.sum / total * Math.PI * 2;
      const a0 = a + gap / 2, a1 = a + Math.max(span - gap / 2, gap / 2 + 0.004);
      const p = (t) => (R * Math.cos(t)).toFixed(2) + ' ' + (R * Math.sin(t)).toFixed(2);
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M' + p(a0) + ' A' + R + ' ' + R + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + p(Math.min(a1, a0 + Math.PI * 1.999)));
      path.setAttribute('pathLength', '1');
      path.setAttribute('class', 'fxy__arc');
      path.style.stroke = g.color;
      svg.appendChild(path);
      a += span;
      return { el: path, frac: g.sum / total };
    });
    return { node: el('div.fxy__ring', null, svg), arcs: arcs };
  }

  function buildYear(sc, d, cards) {
    const S = sc.S, tl = sc.tl, vw = sc.vw, vh = sc.vh, u = sc.u;
    const F = frame(vh, u), n = d.months.length;
    const D = 16000, s2 = 2700, s3 = 6900, s4 = 9900, s5 = 12800;

    /* ---------- אובייקטים ---------- */
    const c = coinOf(Math.round(Math.min(20 * u, 170)));
    const seal = sealOf(42, 12);
    const title = bigWord(d.year || fmt.plural(n, 'חודש', 'חודשים', 'חודש אחד'));
    const sameYear = d.from.slice(0, 4) === d.to.slice(0, 4);
    const sub = at('fxm__sub', el('p', null, el('b', { text: (sameYear ? fmt.monthOnly(d.from) : fmt.monthName(d.from)) + ' – ' + fmt.monthName(d.to) })));
    const fig = el('span.fig', { text: '₪0' });
    const running = ticker(fig, fmt.money);
    const totLabel = el('small', { text: 'יצא ב-' + (d.year || fmt.plural(n, 'חודש', 'חודשים', 'חודש אחד')) });
    const total = at('fx__total', el('div', null, [totLabel, fig]));

    // שורת הסיום: עד שלושה מספרים, ומשפט
    const pillData = [['ממוצע לחודש', fmt.money(d.avg), true]];
    if (d.surplus != null) pillData.push(['חודשים עם עודף', d.surplus + ' מתוך ' + d.full]);
    if (d.fixed > 0) pillData.push(['הוצאות קבועות, בחודש', fmt.money(d.fixed), true]);
    if (pillData.length < 3) pillData.push(['הוצאות', fmt.count(d.count), true]);
    const pillEls = pillData.map((p) => el('div.fxpill', null, [el('span', { text: p[0] }), el('b' + (p[2] ? '.fig' : ''), { text: p[1] })]));
    const pills = at('', el('div.fxpills', null, pillEls));
    const tag = at('fx__tag', el('p', { text: 'כל פרוטה ופרוטה מצטרפת לחשבון גדול.' }));

    [seal, c.at].concat(cards.map((k) => k.at), [title.at, sub, pills, tag]).forEach((x) => S.appendChild(x));

    /* ---------- פריסה ---------- */
    const coinS = c.size, ks = 0.42;
    const tH = hOf(title.at), sH = hOf(sub);
    S.appendChild(total);
    fig.textContent = fmt.money(d.total);                                 // המידות של הסכום — ברוחב הסופי שלו, לא של ₪0
    const totH = hOf(total);
    // סצנה 1: השנה מעל המטבע, הטווח מתחתיו
    const g1 = tH + 2.4 * u + coinS + 2.4 * u + sH;
    const titleY0 = -g1 / 2 + tH / 2, C0 = -g1 / 2 + tH + 2.4 * u + coinS / 2, subY = C0 + coinS / 2 + 2.4 * u + sH / 2;
    // סצנה 2: השנה למעלה ככותרת, הסכום מתחתיה, והחודשים בכל השטח שנשאר
    const capY = F.top + tH * ks / 2;
    const totalY = capY + tH * ks / 2 + 1.2 * u + totH / 2;
    const gTop = totalY + totH / 2 + 3 * u, gBot = F.bottom, GH = gBot - gTop, gridCY = (gTop + gBot) / 2;
    const GW = Math.min(vw - 32, 1180), gap = Math.round(Math.max(8, Math.min(16, 1.6 * u)));
    // כמה טורים: הכי הרבה מקום לכל פוסטר, בלי יותר מארבע שורות
    let cols = n, rowsN = 1, cw = 0;
    [12, 6, 4, 3, 2, n].forEach((k) => {
      const r = Math.ceil(n / k);
      if (k > n || r > 4) return;
      const w = Math.min((GW - (k - 1) * gap) / k, ((GH - (r - 1) * gap) / r) / 0.8, 230);
      if (w > cw + 0.5) { cw = w; cols = k; rowsN = r; }
    });
    const ch = cw * 0.8;
    cards.forEach((k) => { k.card.style.width = cw.toFixed(1) + 'px'; k.card.style.height = ch.toFixed(1) + 'px'; });
    const slots = d.months.map((mm, i) => {
      const r = Math.floor(i / cols), k = i % cols, inRow = Math.min(cols, n - r * cols);
      return { x: ((inRow - 1) / 2 - k) * (cw + gap), y: gridCY + (r - (rowsN - 1) / 2) * (ch + gap) };   // הראשון מימין
    });
    // סצנה 3: עמודה לכל חודש
    const flagRoom = 50, labelsH = 26;
    const chartW = Math.min(GW, n * 84), pitch = chartW / n, colW = Math.max(9, Math.min(52, pitch * 0.62));
    const maxH = Math.max(60, GH - flagRoom - labelsH);
    const maxOut = Math.max.apply(null, d.months.map((mm) => mm.outflow).concat([1]));
    const hOfCol = (mm) => Math.max(4, maxH * mm.outflow / maxOut);
    const colEls = d.months.map((mm) => el('i.fxy__col' + (mm.partial ? '.is-partial' : ''), { vars: { '--mm': P.posters.info(mm.key).mid }, style: 'width:' + colW.toFixed(1) + 'px;height:' + hOfCol(mm).toFixed(1) + 'px' }));
    const avgLine = el('i.fxy__avg', { style: 'bottom:' + (maxH * d.avg / maxOut).toFixed(1) + 'px' });
    const chartAt = at('', el('div.fxy__chart', { style: 'width:' + chartW + 'px' }, [
      el('div.fxy__cols', { style: 'height:' + maxH + 'px' }, colEls.map((x) => el('span', { style: 'width:' + pitch + 'px' }, x)).concat([avgLine])),
      el('div.fxy__labels', null, d.months.map((mm) => el('span', { style: 'width:' + pitch + 'px', text: fmt.MONTH_SHORT[+mm.key.slice(5, 7) - 1] })))
    ]));
    const chartCY = gTop + flagRoom + (maxH + labelsH) / 2;
    const baseY = gTop + flagRoom + maxH;
    const colX = (i) => chartW / 2 - (i + 0.5) * pitch;                // הראשון מימין
    const flagOf = (label, mm) => at('', el('span.fxy__flag', null, [el('small', { text: label }), el('b.fig', { text: fmt.money(mm.outflow) })]));
    const flags = [];
    const hiI = d.months.indexOf(d.hi), loI = d.months.indexOf(d.lo);
    if (hiI > -1) flags.push({ at: flagOf('הכי יקר', d.hi), i: hiI });
    if (loI > -1 && loI !== hiI) flags.push({ at: flagOf('הכי זול', d.lo), i: loI });
    const avgLab = at('', el('span.fxy__avglabel', null, ['ממוצע', el('b.fig', { text: fmt.money(d.avg) })]));
    [chartAt, avgLab].concat(flags.map((f) => f.at)).forEach((x) => S.insertBefore(x, total));
    flags.forEach((f) => {
      const w = wOf(f.at), h = hOf(f.at);
      f.x = Math.max(-vw / 2 + 8 + w / 2, Math.min(vw / 2 - 8 - w / 2, colX(f.i)));
      f.y = baseY - hOfCol(d.months[f.i]) - 10 - h / 2;
      f.box = rectAt(f.at, f.x, f.y);
    });
    if (flags.length > 1 && hit(flags[0].box, flags[1].box, 6)) flags.pop().at.remove();
    // קו הממוצע: התווית בקצה השמאלי, ואם שם יושב דגל — בקצה הימני, ואם גם שם — בלי תווית
    const avgY = baseY - maxH * d.avg / maxOut - 8 - hOf(avgLab) / 2;
    let avgX = -chartW / 2 + wOf(avgLab) / 2;
    if (flags.some((f) => hit(f.box, rectAt(avgLab, avgX, avgY), 6))) avgX = chartW / 2 - wOf(avgLab) / 2;
    const avgShown = !flags.some((f) => hit(f.box, rectAt(avgLab, avgX, avgY), 6));
    if (!avgShown) avgLab.remove();
    // סצנה 4: טבעת והקטגוריות שלצידה (במסך צר: מתחתיה). כל קשת בטבעת היא שורה עם שם —
    // הצבע לא נושא לבד את הזהות: מה שלא נכנס לשורות מתקבץ לקשת אחת אפורה, "כל השאר", שגם היא שורה
    const side = vw >= 760 && GH >= 260;
    const ringD = Math.round(side ? Math.min(GH * 0.9, 300, vw * 0.3) : Math.min(vw - 96, GH * 0.46, 250));
    const share = (x) => Object.assign({ share: d.total ? x.sum / d.total : 0 }, x);
    const REST = { cat: 'כל השאר', rest: true, color: 'rgba(255,255,255,.4)', tint: 'var(--c-rest)' };
    const catRows = d.cats.slice(0, 4).map((x) => catRow(share(x), d.cats[0].sum));
    const rw = side ? Math.min(420, GW - ringD - 6 * u) : Math.min(vw - 32, 420);
    const rowsBox = el('div.fxrows', { style: 'width:' + rw + 'px' }, catRows.map((r) => r.node));
    const rowsAt = at('', rowsBox);
    S.insertBefore(rowsAt, total);
    const rowH = catRows[0] ? catRows[0].node.offsetHeight + 10 : 1;
    const room = side ? GH : gBot - (gTop + ringD + 3 * u);
    let keep = Math.max(1, Math.min(catRows.length, Math.floor((room + 10) / rowH)));
    const restOf = (k) => d.cats.slice(k).reduce((a, x) => a + x.sum, 0);
    if (restOf(keep) > 0 && keep >= Math.floor((room + 10) / rowH)) keep = Math.max(1, keep - 1);   // מקום לשורת "כל השאר"
    catRows.splice(keep).forEach((r) => r.node.remove());
    const restSum = restOf(keep);
    if (restSum > 0) {
      const rr = catRow(share(Object.assign({ sum: restSum }, REST)), d.cats[0].sum);
      rowsBox.appendChild(rr.node);
      catRows.push(rr);
    }
    const segs = d.cats.slice(0, keep).map((x) => ({ sum: x.sum, color: x.cat === P.cats.OTHER ? 'var(--mark)' : x.color }));
    if (restSum > 0) segs.push({ sum: restSum, color: REST.color });
    const R = ring(segs, ringD);
    const ringAt = at('', R.node);
    S.insertBefore(ringAt, rowsAt);
    let ringX = 0, ringY, rowsX = 0, rowsY;
    if (side) {
      const blockW = ringD + 6 * u + rw;
      ringX = blockW / 2 - ringD / 2; rowsX = -blockW / 2 + rw / 2; ringY = rowsY = gridCY;
    } else {
      ringY = gTop + ringD / 2;
      rowsY = ringY + ringD / 2 + 3 * u + rowsBox.offsetHeight / 2;
    }
    // הסכום עובר למרכז הטבעת: רק הספרות, בגודל שנכנס בחור שלה
    const figW = fig.offsetWidth, figOff = fig.offsetTop + fig.offsetHeight / 2;   // offsetTop נמדד ממרכז המחזיק
    const k = Math.min(1, (ringD * 0.62) / figW, (ringD * 0.4) / fig.offsetHeight);
    fig.textContent = '₪0';
    // סצנה 5: המטבע באמצע, המספרים והמשפט מתחתיו
    const pH = hOf(pills), tagH = hOf(tag);
    let C5 = -vh * 0.12;
    const over = C5 + coinS / 2 + 3 * u + pH + 2 * u + tagH - F.bottom;
    if (over > 0) C5 -= over;
    const pillsY = C5 + coinS / 2 + 3 * u + pH / 2, tagY = pillsY + pH / 2 + 2 * u + tagH / 2;

    /* ---------- סצנה 1: השנה (0 – 2.7) ---------- */
    drop(tl, c, C0, 150, vh);
    tl.add(seal, [{ opacity: 0, transform: T(0, C0, 'scale(.35) rotate(-50deg)') }, { opacity: 0.45, transform: T(0, C0, 'scale(1) rotate(0deg)') }], { at: 900, duration: 1900 });
    place(tl, title.at, 0, titleY0);
    tl.stagger(title.parts, letterIn, { at: 1450, each: title.parts.length > 4 ? 80 : 120, duration: 650 });   // אחרי שהמטבע סיים לקפוץ
    rise(tl, sub, subY, 2000, u);

    /* ---------- סצנה 2: פורטים את השנה (2.7 – 6.9) ---------- */
    out(tl, [sub], s2 - 150, 280);
    tl.add(title.at, [{ transform: T(0, titleY0) }, { transform: T(0, capY, 'scale(' + ks + ')') }], { at: s2, duration: 700, easing: 'inOut' });
    tl.add(c.at, [{ transform: T(0, C0) }, { transform: T(0, gridCY, 'scale(.8)') }], { at: s2 + 150, duration: 700, easing: 'inOut' });
    tl.add(seal, [{ opacity: 0.45, transform: T(0, C0, 'scale(1)') }, { opacity: 0.14, transform: T(0, gridCY, 'scale(1.4) rotate(25deg)') }], { at: s2, duration: 1400, easing: 'inOut' });
    tl.add(total, [{ opacity: 0, transform: T(0, totalY, 'scale(.8)') }, { opacity: 1, transform: T(0, totalY) }], { at: s2 + 720, duration: 600, easing: 'back' });
    // הרחוקים יוצאים ראשונים: אף פוסטר לא עובר מעל פוסטר שכבר נחת
    const dist = (s) => Math.hypot(s.x, (s.y - gridCY) * 1.25);
    const order = slots.map((s, i) => i).sort((a, b) => dist(slots[b]) - dist(slots[a]));
    const d0 = s2 + 1000, span = 2300;
    order.forEach((i, j) => {
      const s = slots[i], t = d0 + j * span / n, r0 = ((i * 53) % 13 - 6) * 2.5;
      tl.add(cards[i].at, [
        { opacity: 0, transform: T(0, gridCY, 'scale(.1) rotate(' + r0 + 'deg)') },
        { opacity: 1, offset: 0.12 },
        { transform: T(s.x, s.y, 'scale(1) rotate(0deg)') }
      ], { at: t, duration: 760, easing: 'out' });
      pulse(tl, c.coin, t);
      tl.call(t + 380, () => running.add(d.months[i].outflow));
    });
    // המטבע נפרט עד הסוף: אחרי החודש האחרון לא נשאר ממנו כלום
    tl.add(c.at, [{ opacity: 1, transform: T(0, gridCY, 'scale(.8)') }, { opacity: 0, transform: T(0, gridCY, 'scale(0)') }], { at: d0 + span - 150, duration: 420, easing: 'in' });
    tl.call(d0 + span + 500, () => running.set(d.total));

    /* ---------- סצנה 3: החודשים זה מול זה (6.9 – 9.9) ---------- */
    cards.forEach((k2, i) => tl.add(k2.at, [{ opacity: 1, transform: T(slots[i].x, slots[i].y, 'scale(1)') }, { opacity: 0, transform: T(slots[i].x, slots[i].y + 1.5 * u, 'scale(.92)') }], { at: s3 - 420 + i * 15, duration: 340, easing: 'in' }));
    tl.add(chartAt, [{ opacity: 0, transform: T(0, chartCY) }, { opacity: 1, transform: T(0, chartCY) }], { at: s3 + 100, duration: 350 });
    colEls.forEach((x, i) => tl.add(x, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { at: s3 + 200 + i * 75, duration: 900, easing: 'back' }));
    const cDone = s3 + 200 + n * 75 + 650;
    tl.add(avgLine, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { at: cDone - 300, duration: 700, easing: 'inOut' });
    if (avgShown) tl.add(avgLab, [{ opacity: 0, transform: T(avgX, avgY + 6) }, { opacity: 1, transform: T(avgX, avgY) }], { at: cDone + 350, duration: 450 });
    flags.forEach((f, j) => tl.add(f.at, [{ opacity: 0, transform: T(f.x, f.y + 10, 'scale(.9)') }, { opacity: 1, transform: T(f.x, f.y) }], { at: cDone + 100 + j * 160, duration: 500, easing: 'back' }));

    /* ---------- סצנה 4: לאן הלך הכסף (9.9 – 12.8) ---------- */
    out(tl, [chartAt, avgShown ? avgLab : null].concat(flags.map((f) => f.at)), s4 - 360, 320);
    tl.add(totLabel, [{ opacity: 1 }, { opacity: 0 }], { at: s4 - 200, duration: 250, fill: 'forwards' });
    tl.add(total, [{ transform: T(0, totalY) }, { transform: T(ringX, ringY - figOff * k, 'scale(' + k.toFixed(3) + ')') }], { at: s4 - 50, duration: 750, easing: 'inOut' });
    tl.add(ringAt, [{ opacity: 0, transform: T(ringX, ringY, 'scale(.9) rotate(-30deg)') }, { opacity: 1, transform: T(ringX, ringY) }], { at: s4 + 50, duration: 700 });
    place(tl, rowsAt, rowsX, rowsY);
    let acc = 0;
    R.arcs.forEach((a, i) => {
      const t = s4 + 450 + acc * 1500;
      tl.add(a.el, [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }], { at: t, duration: Math.max(60, a.frac * 1500), easing: 'linear' });
      const r = catRows[i];
      if (r) {
        tl.add(r.node, [{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { at: t + 120, duration: 500 });
        tl.add(r.bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { at: t + 260, duration: 800, easing: 'out' });
        tl.add(r.aside, [{ opacity: 0 }, { opacity: 1 }], { at: t + 560, duration: 400 });
      }
      acc += a.frac;
    });

    /* ---------- סצנה 5: השורה התחתונה (12.8 – 16.0) ---------- */
    out(tl, [ringAt, rowsAt, total, title.at], s5 - 360, 320);
    tl.add(c.at, [{ opacity: 0, transform: T(0, C5, 'scale(0)') }, { opacity: 1, transform: T(0, C5, 'scale(1)') }], { at: s5, duration: 700, easing: 'back' });
    tl.add(c.coin, [{ transform: 'rotateY(-360deg)' }, { transform: 'rotateY(0deg)' }], { at: s5, duration: 900, easing: 'out', fill: 'none' });
    tl.add(seal, [{ opacity: 0.14, transform: T(0, gridCY, 'scale(1.4) rotate(25deg)') }, { opacity: 0.45, transform: T(0, C5, 'scale(1) rotate(70deg)') }], { at: s5 - 100, duration: 1000, easing: 'inOut' });
    place(tl, pills, 0, pillsY);
    tl.stagger(pillEls, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { at: s5 + 500, each: 130, duration: 500 });
    rise(tl, tag, tagY, s5 + 1150, u);
    return D;
  }

  /* ======================================================================
     3. הקבועות של השנה הקרובה — 11 שניות
        0.0  המטבע נוחת למעלה; החיובים הקבועים מופיעים, כל אחד עם הסכום והקצב שלו.
        2.3  שנים-עשר חודשים, מימין לשמאל: בכל חודש נופל לעמודה שלו כל חיוב שצפוי לרדת בו
             (חודשי — בכל חודש, רבעוני — כל שלושה), החיוב ברשימה מהבהב, והסכום גדל בדיוק במה שנפל.
        7.9  השורה התחתונה: מה הגדול שבהם, וכמה זה בכל חודש.
     ====================================================================== */
  function recurring(opts) {
    const o = opts || {};
    if (!can()) return Promise.resolve(false).then(after(o));
    const d = P.insights.recurringYear(6);
    if (!d) return Promise.resolve(false).then(after(o));
    markSeen('r');
    return P.fx.run('recurring', 'ההוצאות הקבועות של השנה הקרובה', (sc) => buildRecurring(sc, d))
      .then(after(o));
  }

  function buildRecurring(sc, d) {
    const S = sc.S, tl = sc.tl, vw = sc.vw, vh = sc.vh, u = sc.u, F = frame(vh, u);
    const D = 11200, s2 = 2300, s3 = 7900, step = 400;

    /* ---------- אובייקטים ---------- */
    const c = coinOf(Math.round(Math.min(16 * u, 140)));
    const seal = sealOf(17, 9);
    const cap1 = caption('מה שיורד כל חודש, בלי שנשים לב');
    const tintOf = (r) => (r.rest ? 'var(--c-rest)' : P.state.tintOf(r.cat));
    const chips = d.rows.map((r) => el('div.fxchip.fxr__chip', { vars: { '--c': tintOf(r) } }, [
      r.rest ? el('span.ctile', { vars: { '--c': tintOf(r), '--s': '30px' } }, ic.svg('more', 16)) : art.tile(r.cat, 30, tintOf(r)),
      el('span.fxchip__label', { text: r.label }),
      el('b.fig', { text: fmt.money(r.amount) }),
      r.cadence ? el('small', { text: r.cadence }) : null
    ]));
    const list = el('div.fxr__list', { style: 'width:' + Math.min(vw - 32, 980) + 'px' }, chips);
    const listAt = at('', list);
    const fig = el('span.fig', { text: '₪0' });
    const running = ticker(fig, fmt.money);
    const total = at('fx__total.fx__total--sm', el('div', null, [el('small', { text: 'בשנה הקרובה' }), fig]));
    const top = d.rows[0];
    const verdict = at('fxm__lines', el('p', { text: (top.rest ? '' : 'הגדול שבהם: ' + top.label + ', ' + fmt.money(top.year) + ' בשנה. ') + 'ביחד — כ-' + fmt.money(d.monthly) + ' בכל חודש.' }));

    [seal, listAt, total, c.at, cap1, verdict].forEach((x) => S.appendChild(x));

    /* ---------- פריסה ---------- */
    const coinS = c.size, small = 0.5;
    const topY = F.top + coinS * small / 2;
    const cap1H = hOf(cap1), totH = hOf(total), labelsH = 24;
    const capY = topY + coinS * small / 2 + 1.4 * u + cap1H / 2;
    const chartTopFor = (lh) => capY + cap1H / 2 + 2.2 * u + lh + 2.2 * u + totH + 2.4 * u;
    // מסך נמוך: פחות חיובים ברשימה (העמודות עדיין סופרות את כולם)
    let listH = list.offsetHeight;
    while (F.bottom - labelsH - chartTopFor(listH) < 100 && chips.length > 2) { chips.pop().remove(); listH = list.offsetHeight; }
    const maxH = Math.max(60, Math.min(F.bottom - labelsH - chartTopFor(listH), 34 * u, 300));
    const listY = capY + cap1H / 2 + 2.2 * u + listH / 2;
    const totalY = listY + listH / 2 + 2.2 * u + totH / 2;
    const chartTop = totalY + totH / 2 + 2.4 * u, chartCY = chartTop + (maxH + labelsH) / 2;
    // המשפט שבסוף יושב במקום הכותרת והרשימה, שכבר התפוגגו — ואם הוא גבוה מהמקום, הוא קטן מעט
    const vTop = topY + coinS * small / 2 + 1.4 * u, vBot = totalY - totH / 2 - 1.2 * u;
    const verdictY = (vTop + vBot) / 2, vk = Math.max(0.72, Math.min(1, (vBot - vTop) / hOf(verdict)));

    // העמודות: חודש לכל עמודה, וחלק צבעוני לכל חיוב שיורד בו
    const chartW = Math.min(vw - 32, 900), pitch = chartW / 12, colW = Math.max(10, Math.min(46, pitch * 0.62));
    const maxCol = Math.max.apply(null, d.cols.map((col) => col.total).concat([1]));
    const segs = [];
    const slots = d.cols.map((col, ci) => {
      const box = el('span.fxr__col', { style: 'width:' + colW.toFixed(1) + 'px;height:' + maxH + 'px' });
      let y = 0;
      col.parts.forEach((v, ri) => {
        if (!(v > 0)) return;
        const h = Math.max(3, maxH * v / maxCol - 2);
        const seg = el('i.fxr__seg', { vars: { '--c': tintOf(d.rows[ri]) }, style: 'bottom:' + y.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px' });
        box.appendChild(seg);
        // נופל מתוך השטח של הגרף בלבד — לא מעל הסכום שמעליו
        segs.push({ el: seg, ci: ci, drop: Math.max(10, Math.min(60, maxH - y - h + 2 * u)) });
        y += h + 2;
      });
      return el('span.fxr__slot', { style: 'width:' + pitch + 'px' }, box);
    });
    const chartAt = at('', el('div.fxr__chart', { style: 'width:' + chartW + 'px' }, [
      el('div.fxr__cols', null, slots),
      el('div.fxy__labels', null, d.keys.map((k) => el('span', { style: 'width:' + pitch + 'px', text: fmt.MONTH_SHORT[+k.slice(5, 7) - 1] })))
    ]));
    S.insertBefore(chartAt, total);

    /* ---------- סצנה 1: החיובים (0 – 2.3) ---------- */
    tl.add(c.at, [{ transform: T(0, -vh * 0.7), opacity: 0 }, { transform: T(0, -vh * 0.7), opacity: 1, offset: 0.03 }, { transform: T(0, topY, 'scale(' + small + ')'), opacity: 1 }], { at: 150, duration: 900, easing: 'out' });
    tl.add(c.coin, [{ transform: 'rotateY(-720deg)' }, { transform: 'rotateY(0deg)' }], { at: 150, duration: 1300, easing: 'out' });
    tl.add(seal, [{ opacity: 0, transform: T(0, vh * 0.06, 'scale(.6) rotate(-40deg)') }, { opacity: 0.14, transform: T(0, vh * 0.06, 'scale(1.4) rotate(0deg)') }], { at: 500, duration: 1800 });
    rise(tl, cap1, capY, 800, u);
    place(tl, listAt, 0, listY);
    chips.forEach((ch, i) => tl.add(ch, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { at: 1250 + i * 90, duration: 600, easing: 'back' }));

    /* ---------- סצנה 2: השנה הקרובה, חודש אחר חודש (2.3 – 7.9) ---------- */
    rise(tl, total, totalY, s2 - 250, u);
    tl.add(chartAt, [{ opacity: 0, transform: T(0, chartCY) }, { opacity: 1, transform: T(0, chartCY) }], { at: s2 - 150, duration: 400 });
    d.cols.forEach((col, ci) => {
      const t = s2 + 200 + ci * step;
      segs.filter((sg) => sg.ci === ci).forEach((sg, j) => tl.add(sg.el, [
        { opacity: 0, transform: 'translateY(' + (-sg.drop) + 'px)' }, { opacity: 1, offset: 0.35 }, { transform: 'none' }
      ], { at: t + j * 55, duration: 460, easing: 'out' }));
      col.parts.forEach((v, ri) => { if (v > 0 && chips[ri]) pulse(tl, chips[ri], t, 1.06); });
      if (col.total) tl.call(t + 260, () => running.add(col.total));   // הסכום גדל בדיוק במה שנפל החודש
    });
    tl.call(s2 + 200 + 12 * step + 300, () => running.set(d.total));

    /* ---------- סצנה 3: השורה התחתונה (7.9 – 11.2) ---------- */
    out(tl, [cap1, listAt], s3 - 320, 300);
    tl.add(verdict, [{ opacity: 0, transform: T(0, verdictY + 2.2 * u, 'scale(' + vk + ')') }, { opacity: 1, transform: T(0, verdictY, 'scale(' + vk + ')') }], { at: s3 + 100, duration: 600 });
    pulse(tl, c.coin, s3 + 150, 1.18);
    tl.add(c.coin, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }], { at: s3 + 380, duration: 900, easing: 'inOut', fill: 'none' });
    tl.add(seal, [{ opacity: 0.14 }, { opacity: 0.3 }], { at: s3, duration: 900, fill: 'forwards' });
    return D;
  }

  /* ======================================================================
     4. הכל מסודר — 5.6 שניות, כשבית העסק האחרון בתור מקבל קטגוריה
        0.2  בתי העסק שסידרת עכשיו מופיעים יחד.
        1.1  כל אחד נופל לעמודה של הקטגוריה שקיבל (התחתונים קודם — אף אחד לא עובר מעל אחר).
        2.7  כמה בתי עסק, כמה תנועות, כמה כללים חדשים.
        3.7  המטבע מטביע את החותמת: הכל מסודר.
     log: [{ label, cat, count, sum, rule }]
     ====================================================================== */
  function sorted(log) {
    if (!can() || !log || !log.length || mode() === 'off') return Promise.resolve(false);
    return P.fx.run('sorted', 'הכל מסודר', (sc) => buildSorted(sc, log));
  }

  function buildSorted(sc, log) {
    const S = sc.S, tl = sc.tl, vw = sc.vw, vh = sc.vh, u = sc.u, narrow = vw < 700, F = frame(vh, u);
    const D = 5600;

    /* ---------- אובייקטים ---------- */
    const byCat = P.dict();
    log.forEach((g) => { (byCat[g.cat] = byCat[g.cat] || { cat: g.cat, n: 0 }).n += g.count; });
    const rows = Object.values(byCat).sort((a, b) => b.n - a.n).slice(0, narrow ? 4 : 6)
      .map((r) => ({ cat: r.cat, short: r.cat.split(' ')[0], color: P.state.tintOf(r.cat), value: r.n, label: fmt.count(r.n) }));
    const barW = Math.round(Math.min(narrow ? 17 * u : 12.5 * u, 120)), gapB = Math.round(narrow ? 3 * u : 3.4 * u);
    const B = X.bars(rows, { w: barW, gap: gapB, maxH: Math.round(Math.min(26 * u, vh * 0.26)), labelH: Math.round(barW * 0.42) + 34 });
    const barsY = vh * 0.2, barsAt = at('fx__barsat', B.node);
    const items = log.slice(-(narrow ? 8 : 12)).map((g) => ({ g: g, ci: rows.findIndex((r) => r.cat === g.cat) }));
    const chipAts = items.map((it) => at('fx__chipat', X.chip(it.g.cat, it.g.label.length > 16 ? it.g.label.slice(0, 15) + '…' : it.g.label, it.g.sum, P.state.tintOf(it.g.cat))));
    const rules = log.filter((g) => g.rule).length, txs = log.reduce((a, g) => a + g.count, 0);
    const figs = [[log.length, log.length === 1 ? 'בית עסק' : 'בתי עסק'], [txs, txs === 1 ? 'תנועה' : 'תנועות'], [rules, rules === 1 ? 'כלל חדש' : 'כללים חדשים']];
    const statNodes = figs.map((f) => ({ b: el('b.fig', { text: '0' }), v: f[0], label: f[1] }));
    const stats = at('fx__stats', el('div.fxstats', null, statNodes.map((s) => el('div', null, [s.b, el('span', { text: s.label })]))));
    const c = coinOf(Math.round(Math.min(18 * u, 150)));
    const seal = sealOf(9, 10);
    const word = at('fxs__word', el('h2', { text: 'הכל מסודר' }));
    const subw = at('fx__tag', el('p', { text: rules ? 'מעכשיו, בתי העסק האלה יסווגו לבד.' : 'כל התנועות נמצאות בקטגוריה.' }));

    [seal, barsAt].concat(chipAts, [stats, c.at, word, subw]).forEach((x) => S.appendChild(x));
    const barX = (ci) => B.cols[ci].node.offsetLeft + barW / 2;           // המקום האמיתי של העמודה (מימין לשמאל)

    /* ---------- פריסה: התגים בשורות, מעל העמודות ---------- */
    const H = chipAts.length ? chipAts[0].firstChild.offsetHeight : 40, gapX = 10, gapY = 12;
    const maxW = Math.min(vw - 32, 900);
    const barsTop = barsY - B.node.offsetHeight / 2;
    const room = barsTop - F.top - 2 * u;
    let widths, lines;
    const pack = () => {
      widths = chipAts.map((a) => a.firstChild.offsetWidth);
      lines = [[]];
      let lineW = 0;
      widths.forEach((w, i) => {
        if (lines[lines.length - 1].length && lineW + gapX + w > maxW) { lines.push([]); lineW = 0; }
        lineW += (lines[lines.length - 1].length ? gapX : 0) + w;
        lines[lines.length - 1].push(i);
      });
    };
    pack();
    // מסך קטן: כמה שנכנסים מעל העמודות — האחרונים שסודרו נשארים
    while (chipAts.length > 1 && lines.length * (H + gapY) - gapY > room) { chipAts.shift().remove(); items.shift(); pack(); }
    const cloudY = (F.top + barsTop) / 2;
    const slots = [];
    lines.forEach((line, r) => {
      const w = line.reduce((a, i) => a + widths[i], 0) + gapX * (line.length - 1);
      let x = w / 2;                                                      // מימין לשמאל
      line.forEach((i, k) => {
        slots[i] = { x: x - widths[i] / 2, y: cloudY + (r - (lines.length - 1) / 2) * (H + gapY), r: ((i * 53) % 9 - 4) * 0.8, row: r, k: k, n: line.length };
        x -= widths[i] + gapX;
      });
    });
    const coinY = -4 * u, wordY = coinY + c.size / 2 + 2.4 * u + hOf(word) / 2, subY = wordY + hOf(word) / 2 + 1.2 * u + hOf(subw) / 2;

    /* ---------- התגים מופיעים, ונופלים לעמודות ---------- */
    place(tl, barsAt, 0, barsY);
    chipAts.forEach((a, i) => tl.add(a, [{ opacity: 0, transform: T(slots[i].x, slots[i].y, 'scale(.6) rotate(' + slots[i].r + 'deg)') }, { opacity: 1, transform: T(slots[i].x, slots[i].y, 'scale(1) rotate(' + slots[i].r + 'deg)') }], { at: 200 + i * 55, duration: 520, easing: 'back' }));
    // השורה התחתונה נופלת ראשונה, ובתוך שורה — מהמרכז החוצה: אף תג לא עובר מעל תג שעוד מחכה
    const rank = (i) => -slots[i].row * 10 + Math.abs(slots[i].k - (slots[i].n - 1) / 2);
    const seq = chipAts.map((a, i) => i).sort((a, b) => rank(a) - rank(b));
    const landY = barsY - 3 * u;
    seq.forEach((i, j) => {
      const s = slots[i], ci = items[i].ci, hitCol = ci > -1, bx = hitCol ? barX(ci) : s.x;
      tl.add(chipAts[i], [
        { opacity: 1, transform: T(s.x, s.y, 'scale(1) rotate(' + s.r + 'deg)') },
        { opacity: hitCol ? 1 : 0.4, transform: T(s.x + (bx - s.x) * 0.5, s.y + (landY - s.y) * 0.45, 'scale(.85) rotate(' + (s.r * 2) + 'deg)'), offset: 0.45 },
        { opacity: hitCol ? 1 : 0, transform: T(bx, landY, 'scale(.55)'), offset: 0.86 },
        { opacity: 0, transform: T(bx, barsY + 3 * u, 'scale(.2)') }
      ], { at: 1100 + j * (1000 / seq.length), duration: 1050, easing: 'inOut' });
    });
    B.cols.forEach((b, i) => {
      tl.add(b.name, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { at: 700 + i * 90, duration: 450 });
      tl.add(b.col, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { at: 1500 + i * 120, duration: 1200, easing: 'spring' });
      tl.add(b.val, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { at: 2950 + i * 70, duration: 400 });
    });
    rise(tl, stats, cloudY, 2700, u);
    tl.call(2750, () => statNodes.forEach((s, i) => setTimeout(() => M.countTo(s.b, s.v, (v) => fmt.count(Math.round(v)), 800), i * 130)));

    /* ---------- החותמת ---------- */
    out(tl, [stats, barsAt], 3650, 300);
    tl.add(c.at, [{ opacity: 0, transform: T(0, coinY, 'scale(2.4)') }, { opacity: 1, transform: T(0, coinY, 'scale(1)') }], { at: 3750, duration: 520, easing: 'back' });
    tl.add(c.coin, [{ transform: 'rotateY(-360deg)' }, { transform: 'rotateY(0deg)' }], { at: 3750, duration: 700, easing: 'out' });
    tl.add(seal, [{ opacity: 0, transform: T(0, coinY, 'scale(.5) rotate(-40deg)') }, { opacity: 0.45, transform: T(0, coinY, 'scale(1) rotate(0deg)') }], { at: 3800, duration: 1000 });
    rise(tl, word, wordY, 3950, u, 500);
    rise(tl, subw, subY, 4150, u, 500);
    // מי שדילג: המספרים הסופיים
    tl.call(D - 100, () => statNodes.forEach((s) => { s.b.textContent = fmt.count(s.v); }));
    return D;
  }

  return { month, year, recurring, sorted, button, can, canRecurring, firstTime, mode };
})();
