/* ==========================================================================
   pages/months.js — כל החודשים, כרטיס לכל חודש
   בראש כל כרטיס הפוסטר של החודש (צילום עונתי, פלטה ומילה משלו); מתחתיו הסכום,
   השינוי מהחודש שלפניו, מה נשאר, ופס ההרכב. לחיצה: הפוסטר "עף" אל ראש חלון החודש.
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.months = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state;

  function render(params, mount, ctx) {
    const all = st.months();
    // הפעם הראשונה בעמוד החודשים: סיפור השנה, ואחריו העמוד שמתחתיו — וכל חודש שנפתח מכאן יספר את שלו
    if (!(ctx && ctx.refresh) && all.length >= 2 && P.stories.firstTime('y')) setTimeout(() => { if (P.router.current.shown === 'months' && P.stories.firstTime('y')) P.stories.year(); }, 420);
    const b = st.dateBounds();
    mount.appendChild(P.ui.pageHead('חודשים',
      fmt.plural(all.length, 'חודש', 'חודשים', 'חודש אחד') + ' של נתונים, מ' + fmt.monthName(b.first.slice(0, 7)) + ' עד ' + fmt.monthName(b.last.slice(0, 7)) + '. לחיצה על חודש פותחת את הפירוט המלא.'));

    const story = P.premium.monthStory(all);
    if (story) mount.appendChild(story);

    st.years().forEach((y) => {
      const yi = P.insights.year(y);
      mount.appendChild(el('section.year-sec', null, [
        el('div.year-head', null, [
          el('h2', { text: y }),
          el('div.yearline', null, st.spendOnly() ? [
            el('div', null, ['יצא', el('b.fig', { text: fmt.money(yi.totals.outflow) })]),
            yi.months.length > 1 ? el('div', null, ['ממוצע לחודש', el('b.fig', { text: fmt.money(yi.avg) })]) : null,
            el('div', null, ['תנועות', el('b', { text: fmt.count(yi.totals.count) })])
          ] : [
            el('div', null, ['יצא', el('b.fig', { text: fmt.money(yi.totals.outflow) })]),
            el('div', null, ['נכנס', el('b.fig', { text: fmt.money(yi.totals.inflow) })]),
            el('div', null, ['מאזן', el('b.fig' + (yi.totals.net >= 0 ? '.in' : ''), { text: fmt.signed(yi.totals.net) })]),
            yi.months.length > 1 ? el('div', null, ['ממוצע לחודש', el('b.fig', { text: fmt.money(yi.avg) })]) : null
          ]),
          yi.months.length > 1 ? P.stories.button('סיפור השנה', () => P.stories.year(y), 'btn--soft.btn--sm', 17) : null
        ]),
        el('div.mgrid', null, yi.months.map((m) => card(m, all)))
      ]));
    });
  }

  function card(m, all) {
    const cov = st.coverage(m.key);
    const list = st.filter({ month: m.key }).filter((t) => t.amount < 0);
    const cats = st.byCategory(list);
    const prev = all.find((x) => x.key === fmt.addMonths(m.key, -1));
    const prevFull = prev && !st.coverage(prev.key).partial && !cov.partial;
    const top = cats.slice(0, 6);
    const rest = cats.slice(6).reduce((a, c) => a + c.sum, 0);
    const comp = rest ? top.concat([{ cat: 'שאר הקטגוריות', sum: rest, color: 'var(--c-rest)', isRest: true }]) : top;
    const poster = P.posters.month(m.key, { size: 'card', label: true });

    const node = el('button.mcard', { type: 'button', 'data-reveal': '', 'aria-label': fmt.monthName(m.key) + ', יצא ' + fmt.money(m.outflow),
      onclick: () => P.views.month(m.key, { from: poster }) }, [
      poster,
      cov.partial ? el('span.chip.chip--sm.mcard__badge', { text: cov.isLast ? 'עד ' + fmt.dayShort(cov.to) : 'חלקי' }) : null,
      el('div.mcard__body', null, [
        el('span.mcard__label', { text: 'סך ההוצאות' }),
        el('span.mcard__fig.fig', { text: fmt.money(m.outflow) }),
        el('div.mcard__sub', null, [
          prevFull ? P.views.parts.deltaChip(m.outflow, prev.outflow, { title: 'לעומת ' + fmt.monthOnly(prev.key) }) : null,
          m.inflow > 0 && !st.spendOnly()
            ? el('span.' + (m.net >= 0 ? 'in' : 'out'), { style: 'font-weight:650' }, [m.net >= 0 ? 'נשאר ' : 'חסר ', el('span.fig', { text: fmt.money(m.net) })])
            : el('span', { text: fmt.plural(m.count, 'תנועה', 'תנועות', 'תנועה אחת') })
        ]),
        comp.length ? el('div.mcard__comp', null, P.charts.composition(comp, { legend: false })) : null
      ])
    ]);
    return P.motion.tilt(node, { max: 2, lift: 3 });
  }

  return { render: render, title: 'חודשים', needsData: true };
})();
