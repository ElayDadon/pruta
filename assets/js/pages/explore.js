/* ==========================================================================
   pages/explore.js — לחקור: כל מה שמאחורי החודש
   ---------------------------------------------------------------------------
   בניווט שלושה מקומות בלבד: החודש שלי · התוכנית · לחקור. כאן — ארבע דלתות:
   חודשים (לאורך זמן), קטגוריות (לפי נושא), תנועות (פרט אחרי פרט) ותובנות (דפוסים).
   כל דלת מראה טעימה אמיתית מהנתונים, כך שכבר בעמוד הזה רואים משהו — ולא רק רשימת קישורים.
   בתוך כל אחד מהעמודים האלה פס לשוניות קטן (nav) עובר ביניהם, בלי לחזור לכאן.
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.explore = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons, art = P.art;

  const PARTS = [
    { route: 'months', hash: '#/months', icon: 'calendar', label: 'חודשים', sub: 'הסיפור לאורך זמן' },
    { route: 'categories', hash: '#/categories', icon: 'grid', label: 'קטגוריות', sub: 'לאן הולך הכסף' },
    { route: 'transactions', hash: '#/transactions', icon: 'list', label: 'תנועות', sub: 'כל פרט במקום' },
    { route: 'insights', hash: '#/insights', icon: 'chart', label: 'תובנות', sub: 'דפוסים ומגמות' }
  ];
  const ROUTES = PARTS.map((p) => p.route);
  const go = (hash) => P.router.go(hash);

  function render(params, mount) {
    const recent = st.months().slice(0, 12);                    // מהחדש לישן
    mount.appendChild(P.ui.pageHead('לחקור', 'כל מה שמאחורי החודש: לאורך זמן, לפי נושא, ותנועה אחרי תנועה.'));
    mount.appendChild(el('div.xdoors', null, [monthsDoor(recent), catsDoor(recent), txDoor(), insightsDoor(recent)]));
    mount.appendChild(extras());
  }

  /** דלת: כותרת שהיא קישור, טעימה מהנתונים (לחיצה עליה גם פותחת), ושורת מסקנה */
  function door(part, taste, line) {
    return el('section.xdoor', { 'data-reveal': '', 'aria-label': part.label }, [
      el('a.xdoor__head', { href: part.hash }, [
        el('span.xdoor__icon', null, ic.svg(part.icon, 20)),
        el('span.xdoor__titles', null, [el('b', { text: part.label }), el('span', { text: part.sub })]),
        ic.svg('chevron', 16)
      ]),
      el('div.xdoor__taste', { onclick: (e) => { if (!e.target.closest('input, button, a')) go(part.hash); } }, taste),
      line ? el('p.xdoor__line', null, line) : null
    ]);
  }

  /* ---------- חודשים: מניפה של הפוסטרים האחרונים ---------- */
  function monthsDoor(recent) {
    const full = recent.filter((m) => !st.coverage(m.key).partial);
    const ref = full.length ? full : recent;
    const avg = ref.length ? ref.reduce((a, m) => a + m.outflow, 0) / ref.length : 0;
    // החדש ביותר מקדימה ומימין — מאיפה שמתחילים לקרוא
    const fan = el('div.xfan', { 'aria-hidden': 'true' }, recent.slice(0, 4).map((m, i, a) =>
      el('div.xfan__card', { style: '--i:' + i + ';--n:' + a.length }, [P.posters.month(m.key, { size: 'card', label: true }), el('b.xfan__amt.fig', { text: fmt.money(m.outflow) })])));
    return door(PARTS[0], fan, [fmt.plural(st.months().length, 'חודש', 'חודשים', 'חודש אחד') + ' של נתונים · בממוצע ', el('b.fig', { text: fmt.money(avg) }), ' לחודש']);
  }

  /* ---------- קטגוריות: הגדולות, ופס ההרכב של השנה ---------- */
  function catsDoor(recent) {
    const keys = new Set(recent.map((m) => m.key));
    const rows = st.byCategory(st.counted().filter((t) => t.amount < 0 && keys.has(t.date.slice(0, 7))));
    const total = rows.reduce((a, c) => a + c.sum, 0);
    const top = rows.filter((c) => c.cat !== P.cats.OTHER).slice(0, 4);
    const rest = rows.slice(6).reduce((a, c) => a + c.sum, 0);
    const comp = rows.slice(0, 6).concat(rest ? [{ cat: 'שאר הקטגוריות', sum: rest, color: 'var(--c-rest)', isRest: true }] : []);
    const taste = el('div.xcats', null, [
      el('div.xcats__tiles', null, top.map((c) => el('span.xcats__tile', { vars: { '--c': c.tint } }, [art.tile(c.cat, 44, c.tint), el('small', { text: total ? fmt.pct(c.sum / total) : '' })]))),
      P.charts.composition(comp, { legend: false })
    ]);
    return door(PARTS[1], taste, top[0] ? ['הכי הרבה הולך ', el('b', { text: fmt.prefix('ל', top[0].cat) }), ' — ' + fmt.pct(top[0].sum / (total || 1)) + ' מההוצאה'] : null);
  }

  /* ---------- תנועות: מחפשים ישר מכאן ---------- */
  function txDoor() {
    const input = el('input', { type: 'search', placeholder: 'תיאור, הערה או סכום…', 'aria-label': 'חיפוש תנועות' });
    const search = () => { const q = input.value.trim(); go('#/transactions' + (q ? '?q=' + encodeURIComponent(q) : '')); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    const b = st.dateBounds();
    const taste = el('div.xsearch', null, [
      el('div.field.field--lg', null, [ic.svg('search', 18), input]),
      el('button.btn.btn--primary', { type: 'button', onclick: search }, 'חיפוש')
    ]);
    return door(PARTS[2], taste, [el('b', { text: fmt.count(st.data.tx.length) }), ' תנועות, מ-' + fmt.day(b.first) + ' עד ' + fmt.day(b.last)]);
  }

  /* ---------- תובנות: קו ההוצאה החודשית, וכמה מזה קבוע ---------- */
  /** קו ההוצאה החודשית: מהישן (מימין) לחדש (משמאל), בין הנמוך לגבוה של התקופה — כדי שהעליות והירידות ייראו */
  function trend(values) {
    const NS = 'http://www.w3.org/2000/svg', W = 320, H = 74, n = values.length;
    const lo = Math.min.apply(null, values), hi = Math.max.apply(null, values), span = hi - lo || 1;
    const x = (i) => W - 4 - (i * (W - 8)) / Math.max(1, n - 1), y = (v) => H - 8 - ((v - lo) / span) * (H - 18);
    const d = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'xspark'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path d="' + d + ' L' + x(n - 1).toFixed(1) + ' ' + H + ' L' + x(0).toFixed(1) + ' ' + H + ' Z" class="xspark__area"/>' +
      '<path d="' + d + '" class="xspark__line" pathLength="1"/>';
    return svg;
  }

  function insightsDoor(recent) {
    const old = recent.slice().reverse();
    const spark = old.length > 1 ? trend(old.map((m) => m.outflow)) : null;
    const live = P.learn.recurring(st.counted()).filter((r) => r.active);
    const monthly = live.reduce((a, r) => a + r.yearly / 12, 0);
    const taste = el('div.xinsight', null, [spark, el('div.xinsight__axis', null, old.length ? [el('span', { text: fmt.monthShort(old[0].key) }), el('span', { text: fmt.monthShort(old[old.length - 1].key) })] : null)]);
    return door(PARTS[3], taste, live.length ? ['הוצאות קבועות: כ-', el('b.fig', { text: fmt.money(monthly) }), ' בחודש'] : ['ההוצאה החודשית, חודש אחר חודש']);
  }

  /* ---------- עוד שלושה דברים שמחפשים מכאן ---------- */
  function extras() {
    const pending = new Set(st.data.tx.filter((t) => t.cat === P.cats.OTHER).map((t) => P.learn.merchantKey(t.desc))).size;
    const item = (icon, label, sub, run, badge) => el('button.xextra', { type: 'button', onclick: run }, [
      el('span.xextra__icon', null, ic.svg(icon, 18)), el('span', null, [el('b', { text: label }), el('small', { text: sub })]),
      badge ? el('span.navlink__badge', { style: 'margin:0', text: badge }) : ic.svg('chevron', 15)
    ]);
    return el('div.xextras', { 'data-reveal': '' }, [
      item('repeat', 'הוצאות קבועות', 'מנויים והוראות קבע', () => P.views.recurring()),
      pending ? item('inbox', 'לשיוך', fmt.plural(pending, 'בית עסק', 'בתי עסק', 'בית עסק אחד') + ' מחכים', () => go('#/assign'), fmt.count(pending)) : null,
      item('sliders', 'כללי סיווג', 'מילות מפתח לכל קטגוריה', () => go('#/rules'))
    ]);
  }

  /** פס הלשוניות שבראש כל אחד מעמודי "לחקור" */
  function nav(current) {
    return el('nav.xnav', { 'aria-label': 'לחקור' }, [
      el('a.xnav__back', { href: '#/explore' }, [ic.svg('compass', 15), 'לחקור']),
      el('div.xnav__tabs', null, PARTS.map((p) => el('a.xnav__tab', { href: p.hash, 'aria-current': p.route === current ? 'page' : null }, [ic.svg(p.icon, 15), p.label])))
    ]);
  }

  return { render: render, nav: nav, ROUTES: ROUTES, title: 'לחקור', needsData: true };
})();
