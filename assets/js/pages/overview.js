/* ==========================================================================
   pages/overview.js — החודש שלי: מה קורה עכשיו, במבט אחד
   ---------------------------------------------------------------------------
   למעלה, בלי לגלול: משפט, שלושה מספרים וצעד אחד לעשות. מתחת — רק שניים:
     1. כותרת הגיבור: כמה יצא החודש, המשפט שמסביר, ושלושה מספרים
     2. הצעד הבא — דבר אחד, הכי שווה לעשות עכשיו
     3. האטלס — לאן הלך הכסף, ויום אחרי יום
     4. שווה לדעת (עד שלושה) לצד "להמשיך לחקור" — שם גרים בתי העסק, השנה והמגמות
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.overview = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons, V = () => P.views;
  const view = { key: null, animated: null, shown: null };

  function render(params, mount, ctx) {
    const months = st.months();
    if (params.month && months.some((m) => m.key === params.month)) view.key = params.month;
    if (!view.key || !months.some((m) => m.key === view.key)) view.key = P.insights.focusMonth();
    const m = P.insights.month(view.key);

    mount.appendChild(el('h1.u-sr', { text: 'החודש שלך, במבט אחד' }));
    mount.appendChild(hero(m, months, ctx));
    mount.appendChild(P.premium.nextStep(m));
    const notes = notices();
    if (notes) mount.appendChild(notes);
    mount.appendChild(P.studio.atlas(m));
    mount.appendChild(el('div.ov-grid', null, [insights(m), onward(m, months)]));
  }

  function setMonth(key) {
    view.key = key;
    P.router.refresh();
  }

  /* ---------- כותרת הגיבור ---------- */
  function hero(m, months, ctx) {
    const keys = months.map((x) => x.key);                    // מהחדש לישן
    const i = keys.indexOf(m.key);
    const older = keys[i + 1] || null, newer = i > 0 ? keys[i - 1] : null;
    const first = String((st.data.meta && st.data.meta.client) || '').trim().split(/\s+/)[0];
    const lines = P.insights.summary(m);

    const fig = el('span.hero__fig.fig');
    if (!ctx.refresh && view.animated !== m.key) { view.animated = m.key; P.kit.countUp(fig, m.totals.outflow, fmt.money, 950); fig.classList.add('fig-settle'); }
    else fig.textContent = fmt.money(m.totals.outflow);

    const label = el('button.monthsw__label', { type: 'button', 'aria-label': 'בחירת חודש', onclick: () => {
      P.ui.pickMonth(label, { current: m.key }).then((k) => { if (k) setMonth(k); });
    } }, [fmt.monthName(m.key), ic.svg('chevronD', 16)]);

    const days = Math.max(1, new Set(m.expense.map((t) => t.date)).size);
    const biggest = m.expense.reduce((a, t) => Math.max(a, -t.amount), 0);
    // פירוט כרטיס אשראי הוא הוצאות בלבד: במקום "נכנס" ו"נשאר" — נתונים על ההוצאה עצמה
    const stats = st.spendOnly() ? [
      ['תנועות', fmt.count(m.expense.length)],
      ['ממוצע ליום', fmt.money(m.totals.outflow / days)],
      ['ההוצאה הגדולה', fmt.money(biggest)]
    ] : [
      ['נכנס', fmt.money(m.totals.inflow)],
      [m.totals.net >= 0 ? 'נשאר' : 'חסר', (m.totals.net >= 0 ? '' : '−') + fmt.money(m.totals.net)],
      m.balance ? ['יתרה בחשבון', fmt.moneyS(m.balance.balance)] : ['ממוצע ליום', fmt.money(m.totals.outflow / days)]
    ];

    // הכותרת "לובשת" את החודש: הפוסטר שלו ברקע, והצבעים שלו בכפתורים ובצל.
    // כשמחליפים חודש, הפוסטר הקודם מתמוסס אל החדש.
    const poster = P.posters.month(m.key, { size: 'hero', eager: true });
    const layers = [poster];
    if (ctx.refresh && view.shown && view.shown !== m.key && !P.motion.reduced()) {
      const old = P.posters.month(view.shown, { size: 'hero', eager: true });
      old.classList.add('is-leaving');
      poster.classList.add('is-entering');
      layers.push(old);
      setTimeout(() => old.remove(), 750);
    }
    view.shown = m.key;
    return el('section.hero', { 'aria-label': 'סיכום ' + fmt.monthName(m.key), vars: P.posters.vars(m.key) }, [
      layers,
      P.premium.heroVisual(m),
      el('div.hero__body', null, [
        el('div.hero__top', null, [
          el('div.hero__hello', { text: fmt.greeting() + (first ? ', ' + first : '') }),
          el('div.monthsw', null, [
            el('button', { type: 'button', 'aria-label': 'החודש הקודם', title: older ? fmt.monthName(older) : null, disabled: older ? null : true, onclick: () => setMonth(older) }, ic.svg('chevronR', 18)),
            label,
            el('button', { type: 'button', 'aria-label': 'החודש הבא', title: newer ? fmt.monthName(newer) : null, disabled: newer ? null : true, onclick: () => setMonth(newer) }, ic.svg('chevron', 18))
          ])
        ]),
        el('div.hero__label', null, [
          el('span', { text: 'יצא ב' + fmt.monthOnly(m.key) }),
          el('span.hero__word', { text: P.posters.info(m.key).word }),
          m.cov.partial && !m.cov.isLast ? el('span.chip.chip--sm', { text: 'חודש חלקי' }) : null   // לחודש האחרון המשפט כבר אומר את זה
        ]),
        fig,
        el('p.hero__summary', { text: lines.join(' ') }),
        el('div.hero__stats', null, stats.map(([k, v]) => el('div.hero__stat', null, [el('span', { text: k }), el('b.fig', { text: v })]))),
        el('div.hero__actions', null, [
          el('button.btn.btn--onhero', { type: 'button', onclick: () => V().month(m.key) }, [ic.svg('calendar', 16), 'פירוט החודש']),
          // ההדמיה מסתיימת בחלון החודש עצמו — אלא אם דילגו עליה
          m.expense.length ? P.stories.button('סיפור החודש', () => P.stories.month(m.key, { then: () => V().month(m.key, { direct: true }) }), 'btn--onhero-ghost') : null,
          el('button.btn.btn--onhero-ghost', { type: 'button', onclick: () => P.router.go('#/transactions?month=' + m.key) }, 'כל התנועות')
        ])
      ])
    ]);
  }

  /* ---------- הודעות חשובות בלבד ---------- */
  function notices() {
    const out = [];
    const risk = st.settlementRisk();
    if (risk && risk.confirmed) {
      out.push(el('div.callout.callout--mark', null, [ic.svg('alert', 18),
        el('div.callout__text', null, [el('b', { text: 'חיובי האשראי נספרים פעמיים. ' }),
          'טענת גם את פירוט הכרטיס, וגם בדוח הבנק יש ' + fmt.plural(risk.count, 'חיוב מרוכז', 'חיובים מרוכזים', 'חיוב מרוכז אחד') + ' בסך ' + fmt.money(risk.sum) + '.']),
        el('button.btn.btn--sm', { type: 'button', onclick: () => {
          st.setExcluded(P.cats.SETTLEMENT, true);
          P.kit.toast('חיובי האשראי המרוכזים לא נספרים יותר', { undo: () => st.setExcluded(P.cats.SETTLEMENT, false) });
        } }, 'לא לספור אותם')]));
    }
    if (P.store.describe().mode === 'memory') {
      out.push(el('div.callout.callout--bad', null, [ic.svg('alert', 18),
        el('div.callout__text', null, [el('b', { text: 'הנתונים לא נשמרים. ' }), 'הדפדפן חוסם שמירה מקומית. כדאי להפעיל דרך קובץ ההפעלה, או להוריד גיבוי לפני סגירה.']),
        el('button.btn.btn--sm', { type: 'button', onclick: () => P.app.backup() }, 'הורדת גיבוי')]));
    }
    return out.length ? el('div.notices', null, out) : null;
  }

  /* ---------- שווה לדעת ---------- */
  function insights(m) {
    const items = P.insights.cards(m, 3);
    return P.ui.card({
      title: 'שווה לדעת',
      note: items.length ? 'מה בלט ב' + fmt.monthOnly(m.key) : null,
      flush: true,
      body: items.length
        ? el('div.insights', null, items.map((it) => V().parts.insightRow(it)))
        : el('div.empty', { style: 'padding:34px 20px' }, [el('b', { text: 'חודש שקט' }), el('p', { text: 'שום דבר לא בלט — ההוצאות בטווח הרגיל שלך.' })])
    });
  }

  /* ---------- להמשיך לחקור: הדרך אל כל מה שלא צריך להיות כאן ---------- */
  function onward(m, months) {
    const shops = st.byMerchant(m.expense).length;
    const live = P.learn.recurring(st.counted()).filter((r) => r.active);
    const fixed = live.reduce((a, r) => a + r.yearly / 12, 0);
    const row = (icon, title, sub, run) => el('button.lrow', { type: 'button', onclick: run }, [
      el('span.palette__icon', null, ic.svg(icon, 18)),
      el('div.lrow__main', null, [el('div.lrow__title', null, el('span', { text: title })), sub ? el('div.lrow__meta', { text: sub }) : null]),
      el('span.lrow__go', null, ic.svg('chevron', 18))
    ]);
    return P.ui.card({
      title: 'להמשיך לחקור', note: 'כל השאר, במקום אחד', flush: true,
      body: el('div.list', null, [
        row('store', 'בתי העסק של ' + fmt.monthOnly(m.key), fmt.plural(shops, 'בית עסק', 'בתי עסק', 'בית עסק אחד') + ' · מהגדול לקטן', () => V().month(m.key, { tab: 'merchants' })),
        row('calendar', 'השנה, חודש אחר חודש', fmt.plural(months.length, 'חודש', 'חודשים', 'חודש אחד') + ' · כל חודש בעיצוב משלו', () => P.router.go('#/months')),
        live.length ? row('repeat', 'הוצאות קבועות', 'כ-' + fmt.money(fixed) + ' בחודש · ' + fmt.plural(live.length, 'חיוב', 'חיובים', 'חיוב אחד'), () => V().recurring()) : null,
        row('compass', 'כל הדרכים לחקור', 'קטגוריות, תנועות ותובנות', () => P.router.go('#/explore'))
      ])
    });
  }

  /** אחרי טעינת קובץ או שחזור: חוזרים לחודש העדכני */
  function reset() { view.key = null; view.animated = null; view.shown = null; }

  return { render: render, reset: reset, title: 'החודש שלי', needsData: true };
})();
