/* ==========================================================================
   pages/categories.js — לאן הולך הכסף
   משפט אחד שמסכם, פס הרכב אחד, וכרטיס לכל קטגוריה עם מגמה קטנה.
   כל כרטיס פותח את חלון הקטגוריה: מגמה, בתי עסק, מילות מפתח ותנועות.
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.categories = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, art = P.art, ic = P.icons;
  const view = { period: '12m', month: null, flow: 'out' };

  /** הטווח לפי הבחירה. "12 חודשים" מסתיים בחודש האחרון שיש בו מספיק נתונים */
  function range() {
    const focus = view.month || P.insights.focusMonth();
    const b = st.dateBounds();
    if (view.period === 'month') return { opts: { month: focus }, label: fmt.monthName(focus), from: focus, to: focus };
    if (view.period === 'all') return { opts: {}, label: 'כל התקופה', from: b.first.slice(0, 7), to: b.last.slice(0, 7) };
    const n = view.period === '3m' ? 3 : 12;
    const first = b.first.slice(0, 7);
    let from = fmt.addMonths(focus, -(n - 1));
    if (from < first) from = first;
    const sameYear = from.slice(0, 4) === focus.slice(0, 4);
    return {
      opts: { from: from + '-01', to: fmt.monthEdges(focus).to }, from: from, to: focus,
      label: (sameYear ? fmt.monthOnly(from) : fmt.monthName(from)) + ' – ' + fmt.monthName(focus)
    };
  }

  function render(params, mount, ctx) {
    if (!ctx.refresh) {
      if (params.month) { view.period = 'month'; view.month = params.month; }
      else if (view.period === 'month' && !params.keep) view.month = null;
    }
    const r = range();
    const flowOut = view.flow === 'out';
    const inFlow = (t) => (flowOut ? t.amount < 0 : t.amount > 0);
    const list = st.filter(r.opts).filter(inFlow);
    const rows = st.byCategory(list);
    const total = rows.reduce((a, c) => a + c.sum, 0);
    const focus = view.month || P.insights.focusMonth();

    const periodSeg = P.ui.seg([['month', fmt.monthOnly(focus)], ['3m', '3 חודשים'], ['12m', '12 חודשים'], ['all', 'הכל']], view.period,
      (k) => { view.period = k; P.router.refresh(); }, { label: 'תקופה' });
    const flowSeg = P.ui.seg([['out', 'הוצאות'], ['in', 'הכנסות']], view.flow, (k) => { view.flow = k; P.router.refresh(); }, { label: 'סוג' });
    mount.appendChild(P.ui.pageHead('קטגוריות', [r.label + ' · ', el('span.fig', { text: fmt.money(total) }), ' ' + (flowOut ? 'הוצאות' : 'הכנסות')], [periodSeg, flowSeg]));

    if (!rows.length) {
      mount.appendChild(P.ui.card({ body: P.ui.empty(flowOut ? 'אין הוצאות בטווח הזה' : 'אין הכנסות בטווח הזה', 'נסו טווח אחר.') }));
      return;
    }

    const focusCards = P.premium.categoryFocus(rows, total, flowOut, { month: view.period === 'month' ? focus : undefined });
    if (focusCards) mount.appendChild(focusCards);

    // ---------- משפט ופס הרכב ----------
    const top = rows.slice(0, 7);
    const rest = rows.slice(7).reduce((a, c) => a + c.sum, 0);
    const comp = rest ? top.concat([{ cat: 'שאר הקטגוריות', sum: rest, color: 'var(--c-rest)', isRest: true }]) : top;
    mount.appendChild(el('section.card.cat-summary', null, [
      el('p', null, sentence(rows, total, flowOut)),
      P.charts.composition(comp, { large: true, legendMax: 6, onPick: (cat) => open(cat) })
    ]));

    // ---------- הכרטיסים ----------
    const months = monthsBetween(fmt.addMonths(r.to, -5), r.to);
    const series = P.dict();
    st.counted().forEach((t) => {
      if (!inFlow(t)) return;
      const k = t.date.slice(0, 7);
      const i = months.indexOf(k);
      if (i === -1) return;
      (series[t.cat] = series[t.cat] || months.map(() => 0))[i] += Math.abs(t.amount);
    });
    const pending = rows.find((c) => c.cat === P.cats.OTHER);
    const ordered = (pending ? [pending] : []).concat(rows.filter((c) => c.cat !== P.cats.OTHER));
    const grid = el('div.cgrid');
    ordered.forEach((c) => grid.appendChild(card(c, total, series[c.cat] || [], flowOut)));

    // קטגוריות שהוצאו מהספירה — בסוף, מעומעמות
    const hidden = st.byCategory(st.filter(Object.assign({ all: true }, r.opts)).filter((t) => inFlow(t) && st.isExcluded(t)));
    hidden.forEach((c) => grid.appendChild(card(c, 0, [], flowOut, true)));
    mount.appendChild(grid);
  }

  function sentence(rows, total, flowOut) {
    const real = rows.filter((r) => r.cat !== P.cats.OTHER);
    const pending = rows.find((r) => r.cat === P.cats.OTHER);
    const out = [];
    if (real.length) {
      out.push(flowOut ? 'הכי הרבה הולך ' : 'הכי הרבה נכנס ');
      out.push(el('b', { text: flowOut ? fmt.prefix('ל', real[0].cat) : fmt.prefix('מ', real[0].cat) }));
      out.push(' — ' + fmt.pct(real[0].sum / total) + (flowOut ? ' מההוצאות.' : ' מההכנסות.'));
      if (real[1]) {
        out.push(' אחר כך ', el('b', { text: real[1].cat }), ' (' + fmt.pct(real[1].sum / total) + ')');
        if (real[2]) out.push(' ו', el('b', { text: real[2].cat }), ' (' + fmt.pct(real[2].sum / total) + ')');
        out.push('.');
      }
    }
    if (pending) out.push(' עוד ', el('b.fig', { text: fmt.money(pending.sum) }), ' מחכים לקטגוריה.');
    return out;
  }

  function card(c, total, values, flowOut, excluded) {
    const isPending = c.cat === P.cats.OTHER;
    const share = total ? c.sum / total : 0;
    const tile = art.tile(c.cat, 44, excluded ? 'var(--ink-4)' : c.tint);
    const node = el('button.ccard.lift' + (isPending ? '.ccard--pending' : '') + (excluded ? '.ccard--excluded' : ''), {
      type: 'button', 'data-reveal': '', vars: { '--c': excluded ? 'var(--ink-4)' : c.tint }, 'aria-label': c.cat + ', ' + fmt.money(c.sum),
      onclick: () => (isPending ? P.router.go('#/assign') : open(c.cat, tile))
    }, [
      el('div.ccard__top', null, [
        tile,
        el('div', { style: 'min-width:0' }, [
          el('div.ccard__name', { text: isPending ? 'מחכות לקטגוריה' : c.cat }),
          el('div.ccard__count', { text: fmt.plural(c.count, 'תנועה', 'תנועות', 'תנועה אחת') })
        ]),
        excluded ? el('span.badge', { style: 'margin-inline-start:auto' }, [ic.svg('eyeOff', 12), 'לא נספר']) : null,
        isPending ? el('span.chip.chip--mark.chip--sm', { style: 'margin-inline-start:auto' }, ['לשיוך', ic.svg('chevron', 12)]) : null
      ]),
      el('div.ccard__mid', null, [
        el('div', null, [
          el('div.ccard__fig.fig', { text: fmt.money(c.sum) }),
          el('div.ccard__share', { text: excluded ? 'לא נכלל בסיכומים' : (share < 0.005 ? 'פחות מ-1%' : fmt.pct(share)) + (flowOut ? ' מההוצאות' : ' מההכנסות') })
        ]),
        values.some((v) => v > 0) ? el('span.ccard__spark', { title: 'שישה חודשים אחרונים' }, P.charts.sparkline(values, excluded ? 'var(--ink-4)' : c.tint, 96, 34)) : null
      ]),
      el('div.ccard__foot', null, [el('span', { text: values.some(v => v > 0) ? 'מגמה · 6 חודשים' : 'לפירוט התנועות' }), ic.svg('chevron', 14)]),
      excluded ? null : el('div.ccard__bar', null, el('i', { style: 'width:' + Math.max(1.5, share * 100).toFixed(1) + '%' }))
    ]);
    return node;
  }

  function open(cat, from) {
    P.views.category(cat, { month: view.period === 'month' ? (view.month || P.insights.focusMonth()) : undefined, from: from });
  }

  function monthsBetween(a, b) {
    const out = [];
    for (let k = a; k <= b; k = fmt.addMonths(k, 1)) out.push(k);
    return out;
  }

  return { render: render, title: 'קטגוריות', needsData: true };
})();
