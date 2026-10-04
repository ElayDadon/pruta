/* ==========================================================================
   pages/insights.js — התמונה הגדולה, בארבע לשוניות
   בכל לשונית שני כרטיסים לכל היותר, ומעל כל גרף משפט שאומר מה רואים בו.
     תזרים · הרכב · הרגלים · קבועות וחריגים
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.insights = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons, art = P.art;
  const view = { tab: 'flow' };
  const TABS = [['flow', 'תזרים'], ['mix', 'הרכב'], ['habits', 'הרגלים'], ['fixed', 'קבועות וחריגים']];

  function render(params, mount, ctx) {
    if (params.tab && TABS.some((t) => t[0] === params.tab)) view.tab = params.tab;
    // הפעם הראשונה שרואים את ההוצאות הקבועות: השנה הקרובה שלהן, בהדמיה
    if (view.tab === 'fixed' && P.stories.firstTime('r') && P.stories.canRecurring()) setTimeout(() => { if (P.router.current.shown === 'insights' && view.tab === 'fixed' && P.stories.firstTime('r')) P.stories.recurring(); }, 380);
    mount.appendChild(P.ui.pageHead('תובנות', 'התמונה הגדולה. בכל לשונית — משפט שמסכם, וגרף שמראה.'));
    mount.appendChild(el('div.tabs.itabs', { role: 'tablist' }, TABS.map(([k, l]) => el('button', {
      type: 'button', role: 'tab', 'aria-selected': view.tab === k ? 'true' : 'false', onclick: () => { view.tab = k; P.router.refresh(); }
    }, l))));
    const panel = el('div.ipanel', { role: 'tabpanel' });
    ({ flow: flow, mix: mix, habits: habits, fixed: fixed })[view.tab](panel);
    mount.appendChild(panel);
  }

  /** החודשים המלאים האחרונים (עד 12), מהחדש לישן */
  function recentMonths(n) {
    return st.months().slice(0, n || 12);
  }

  /* ======================================================================
     תזרים
     ====================================================================== */
  function flow(panel) {
    const months = recentMonths(12);
    const only = st.spendOnly();                    // פירוט כרטיס אשראי: יש רק הוצאות
    panel.appendChild(P.ui.card({
      title: only ? 'ההוצאה, חודש אחר חודש' : 'יצא ונכנס, חודש אחר חודש', note: 'לחיצה על חודש פותחת אותו',
      lead: P.ui.takeaway(P.insights.flowTakeaway(months), 'chart'),
      body: P.charts.monthBars(months, { height: 260, spendOnly: only, onPick: (k) => P.views.month(k) })
    }));

    const old = months.slice().reverse();
    let acc = 0;
    const cum = old.map((m) => (acc += only ? m.outflow : m.net));
    panel.appendChild(P.ui.card({
      title: only ? 'ההוצאה המצטברת' : 'המאזן המצטבר', note: only ? 'כמה יצא מתחילת התקופה' : 'כמה נשאר (או חסר) מתחילת התקופה',
      lead: P.ui.takeaway(P.insights.cumulativeTakeaway(months), only ? 'chart' : acc >= 0 ? 'trendUp' : 'trendDown'),
      body: P.charts.lineChart([{ name: only ? 'הוצאה מצטברת' : 'מאזן מצטבר', values: cum, color: only ? 'var(--spend)' : acc >= 0 ? 'var(--pos)' : 'var(--neg)', area: true }],
        { labels: old.map((m) => fmt.monthShort(m.key)), tipLabels: old.map((m) => 'עד סוף ' + fmt.monthName(m.key)), height: 220, onPick: (i) => P.views.month(old[i].key) })
    }));
  }

  /* ======================================================================
     הרכב
     ====================================================================== */
  function mix(panel) {
    const months = recentMonths(12);
    const keys = months.map((m) => m.key);
    const list = st.counted().filter((t) => t.amount < 0 && keys.indexOf(t.date.slice(0, 7)) !== -1);
    const rows = st.byCategory(list);
    const top = rows.filter((r) => r.cat !== P.cats.OTHER).slice(0, 6);
    const REST = 'כל השאר';
    const cats = top.concat([{ cat: REST, color: 'var(--c-rest)' }]);
    const matrix = P.dict();
    cats.forEach((c) => { matrix[c.cat] = {}; });
    list.forEach((t) => {
      const c = top.some((x) => x.cat === t.cat) ? t.cat : REST;
      const k = t.date.slice(0, 7);
      matrix[c][k] = (matrix[c][k] || 0) - t.amount;
    });
    panel.appendChild(P.ui.card({
      title: 'הרכב ההוצאה', note: 'שש הקטגוריות הגדולות, וכל השאר',
      lead: P.ui.takeaway(P.insights.compositionTakeaway(rows), 'pie'),
      body: P.charts.stacked(keys, cats, matrix, { height: 280, onPick: (k) => P.views.month(k) })
    }));

    // מה עלה ומה ירד: שלושת החודשים המלאים האחרונים מול שלושת שלפניהם
    const full = months.filter((m) => !st.coverage(m.key).partial).map((m) => m.key);
    if (full.length >= 4) {
      const n = Math.min(3, Math.floor(full.length / 2));
      const recent = full.slice(0, n), before = full.slice(n, n * 2);
      const avgOf = (ks) => {
        const out = P.dict();
        st.counted().forEach((t) => { if (t.amount < 0 && ks.indexOf(t.date.slice(0, 7)) !== -1) out[t.cat] = (out[t.cat] || 0) - t.amount; });
        for (const c in out) out[c] /= ks.length;
        return out;
      };
      const a = avgOf(recent), b = avgOf(before);
      const skip = [P.cats.OTHER, P.cats.SETTLEMENT, 'העברות ומזומן'];
      const moves = Array.from(new Set(Object.keys(a).concat(Object.keys(b))))
        .filter((c) => skip.indexOf(c) === -1)
        .map((c) => ({ cat: c, now: a[c] || 0, was: b[c] || 0, diff: (a[c] || 0) - (b[c] || 0) }))
        .filter((m) => Math.abs(m.diff) >= 60 && (m.was === 0 || Math.abs(m.diff / m.was) >= 0.1));
      const ups = moves.filter((m) => m.diff > 0).sort((x, y) => y.diff - x.diff).slice(0, 3);
      const downs = moves.filter((m) => m.diff < 0).sort((x, y) => x.diff - y.diff).slice(0, 3);
      const label = (ks) => (ks.length === 1 ? fmt.monthOnly(ks[0]) : fmt.monthOnly(ks[ks.length - 1]) + '–' + fmt.monthOnly(ks[0]));
      const row = (m) => el('button.lrow', { type: 'button', vars: { '--c': st.tintOf(m.cat) }, onclick: () => P.views.category(m.cat) }, [
        art.tile(m.cat, 40),
        el('div.lrow__main', null, [
          el('div.lrow__title', null, el('span', { text: m.cat })),
          el('div.lrow__meta', null, [el('span.fig', { text: fmt.money(m.was) }), ic.svg('chevron', 12), el('span.fig', { text: fmt.money(m.now) }), ' בחודש'])
        ]),
        el('div.lrow__aside', null, [el('div.lrow__value.fig.' + (m.diff > 0 ? 'out' : 'in'), { text: (m.diff > 0 ? '+' : '−') + fmt.money(m.diff) }),
          el('div.lrow__sub', { text: m.was ? (m.diff > 0 ? 'עלייה של ' : 'ירידה של ') + fmt.pct(m.diff / m.was) : 'חדש' })])
      ]);
      const cols = [];
      if (ups.length) cols.push(el('div', null, [el('div.movers__label', null, [ic.svg('trendUp', 15), 'עלו']), el('div.list', null, ups.map(row))]));
      if (downs.length) cols.push(el('div', null, [el('div.movers__label.is-down', null, [ic.svg('trendDown', 15), 'ירדו']), el('div.list', null, downs.map(row))]));
      panel.appendChild(P.ui.card({
        title: 'מה השתנה', note: 'ממוצע חודשי: ' + label(recent) + ' לעומת ' + label(before),
        flush: true,
        body: cols.length ? el('div.movers', null, cols) : el('div.empty', { style: 'padding:30px' }, [el('b', { text: 'יציב' }), el('p', { text: 'אף קטגוריה לא זזה משמעותית.' })])
      }));
    }
  }

  /* ======================================================================
     הרגלים
     ====================================================================== */
  function habits(panel) {
    const b = st.dateBounds();
    const end = new Date(b.last);
    const span = window.innerWidth < 760 ? 6 : 12;                       // חודשים אחורה: שנה שלמה כשיש מקום
    const start = new Date(end); start.setMonth(start.getMonth() - span); start.setDate(start.getDate() + 1);
    const from = P.parse.isoDate(start) < b.first ? b.first : P.parse.isoDate(start);
    const list = st.filter({ from: from, to: b.last });

    const rows = P.insights.weekdays(list, from, b.last);
    panel.appendChild(P.ui.card({
      title: 'לפי יום בשבוע', note: 'הוצאה יומיומית ממוצעת, בלי שכירות, חשבונות והעברות',
      lead: P.ui.takeaway(P.insights.weekdayTakeaway(rows), 'calendar'),
      body: P.charts.weekdayBars(rows, { height: 220 })
    }));

    const byDay = {};
    list.forEach((t) => { if (t.amount < 0) byDay[t.date] = (byDay[t.date] || 0) - t.amount; });
    const days = Math.round((new Date(b.last) - new Date(from)) / 86400000) + 1;
    const quiet = days - Object.keys(byDay).length;
    const peak = Object.keys(byDay).sort((x, y) => byDay[y] - byDay[x])[0];
    const text = peak ? 'היום היקר ביותר היה ' + fmt.dayLong(peak) + ' (' + fmt.money(byDay[peak]) + ').' + (quiet > 0 ? ' ' + fmt.plural(quiet, 'יום', 'ימים', 'יום אחד') + ' עברו בלי שום הוצאה.' : '') : '';
    panel.appendChild(P.ui.card({
      title: span === 12 ? 'כל יום, שנה אחורה' : 'כל יום, חצי שנה אחורה', note: 'לחיצה על יום מציגה את התנועות שלו',
      lead: P.ui.takeaway(text, 'target'),
      body: P.charts.heatmap(list, { from: from, to: b.last, onPick: (iso) => P.router.go('#/transactions?day=' + iso) })
    }));
  }

  /* ======================================================================
     קבועות וחריגים
     ====================================================================== */
  function fixed(panel) {
    const counted = st.counted();
    const rec = P.learn.recurring(counted);
    const live = rec.filter((r) => r.active);
    const monthly = live.reduce((a, r) => a + r.yearly / 12, 0);
    const recRows = rec.slice(0, 7).map((r) => el('button.lrow', { type: 'button', onclick: () => P.views.merchant(r.key) }, [
      art.avatar(r.label, r.cat, 40),
      el('div.lrow__main', null, [
        el('div.lrow__title', null, [el('span', { text: r.label }), el('span.chip.chip--sm', { text: r.cadence }), r.active ? null : el('span.chip.chip--sm.chip--mark', { title: 'החיוב הבא היה אמור להגיע ולא הגיע', text: 'הופסק?' })]),
        el('div.lrow__meta', null, [el('span', { text: r.cat }), el('span', { text: r.active ? 'הבא בסביבות ' + fmt.dayWithMonth(r.next) : 'חיוב אחרון ב-' + fmt.day(r.last) })])
      ]),
      el('div.lrow__aside', null, [el('div.lrow__value.fig', { text: fmt.money(r.amount) }), el('div.lrow__sub', null, [el('span.fig', { text: fmt.money(r.yearly) }), ' בשנה'])])
    ]));
    panel.appendChild(P.ui.card({
      title: 'הוצאות קבועות', note: rec.length ? fmt.plural(live.length, 'חיוב פעיל', 'חיובים פעילים', 'חיוב פעיל אחד') + ' שחוזרים בקצב קבוע' : null,
      end: live.length >= 2 && P.stories.can() ? [P.stories.button('השנה הקרובה', () => P.stories.recurring(), 'btn--soft.btn--sm', 17)] : null,
      lead: rec.length ? P.ui.takeaway(['בערך ', el('b.fig', { text: fmt.money(monthly) }), ' יוצאים כל חודש על דברים קבועים — כ-', el('b.fig', { text: fmt.money(monthly * 12) }), ' בשנה.'], 'repeat') : null,
      flush: true,
      body: rec.length ? el('div.list', null, recRows) : el('div.empty', { style: 'padding:30px' }, [el('b', { text: 'עוד לא זוהו חיובים קבועים' }), el('p', { text: 'צריך לפחות שלושה חיובים מאותו עסק בקצב קבוע.' })]),
      foot: rec.length > 7 ? [el('button.card__more', { type: 'button', onclick: () => P.views.recurring() }, ['כל ' + fmt.count(rec.length) + ' החיובים הקבועים', ic.svg('chevron', 16)])] : null
    }));

    const anomalies = P.learn.anomalies(counted, 6);
    panel.appendChild(P.ui.card({
      title: 'חיובים חריגים', note: 'סכום גבוה בהרבה מהרגיל אצל אותו בית עסק',
      flush: true,
      body: anomalies.length ? el('div.list', null, anomalies.map((a) => el('button.lrow', { type: 'button', onclick: () => P.views.tx(a.tx.id) }, [
        art.tile(a.tx.cat, 40),
        el('div.lrow__main', null, [
          el('div.lrow__title', null, el('span', { text: a.merchant })),
          el('div.lrow__meta', null, [el('span', { text: fmt.day(a.tx.date) }), el('span', null, ['בדרך כלל ', el('span.fig', { text: fmt.money(a.usual) })])])
        ]),
        el('div.lrow__aside', null, [el('div.lrow__value.fig', { text: fmt.money(a.tx.amount) }), el('div.lrow__sub', { text: 'פי ' + a.ratio.toFixed(1) + ' מהרגיל' })])
      ]))) : el('div.empty', { style: 'padding:30px' }, [el('b', { text: 'לא נמצאו חיובים חריגים' }), el('p', { text: 'כל החיובים בטווח הרגיל של בתי העסק שלהם.' })])
    }));
  }

  return { render: render, title: 'תובנות', needsData: true };
})();
