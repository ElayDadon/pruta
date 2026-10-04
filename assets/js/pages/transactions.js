/* ==========================================================================
   pages/transactions.js — כל התנועות
   שורת חיפוש אחת, בורר תקופה ומסננים בחלוניות, תגים למסננים הפעילים,
   ורשימה לפי ימים. לחיצה על תנועה פותחת את הפרטים שלה.
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.transactions = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons, art = P.art;
  const fresh = () => ({ q: '', month: null, from: null, to: null, periodLabel: null, cat: null, flow: null, source: null, list: { shown: 0 } });
  let view = fresh();
  let sort = 'date';

  function render(params, mount, ctx) {
    if (!ctx.refresh) {
      view = fresh();
      if (params.month) view.month = params.month;
      if (params.day) { view.from = view.to = params.day; view.periodLabel = fmt.dayLong(params.day); }
      if (params.cat) view.cat = params.cat;
      if (params.flow) view.flow = params.flow;
      if (params.source) view.source = params.source;
      if (params.q) view.q = params.q;
    }
    const b = st.dateBounds();
    mount.appendChild(P.ui.pageHead('תנועות',
      fmt.plural(st.data.tx.length, 'תנועה', 'תנועות', 'תנועה אחת') + ' מ-' + fmt.day(b.first) + ' עד ' + fmt.day(b.last) + '. לחיצה על תנועה פותחת אותה, ולחיצה על הקטגוריה מחליפה אותה.',
      [el('button.btn.btn--primary', { type: 'button', onclick: () => P.pages.plan.editor() }, [ic.svg('plus', 16), 'תנועה חדשה']), el('button.btn', { type: 'button', onclick: exportCsv }, [ic.svg('download', 16), 'ייצוא לאקסל'])]));

    // ---------- חיפוש ומסננים ----------
    const search = el('input', { type: 'search', value: view.q, placeholder: 'חיפוש לפי תיאור, הערה או אסמכתא…', 'aria-label': 'חיפוש תנועות', 'data-fk': 'tx-search' });
    const results = el('div');
    search.addEventListener('input', P.kit.debounce(() => { view.q = search.value; view.list.shown = 0; drawResults(results); }, 120));

    const periodBtn = el('button.btn', { type: 'button', 'aria-haspopup': 'dialog', onclick: () => periodPop(periodBtn) }, [ic.svg('calendar', 16), el('span', { text: periodText() }), ic.svg('chevronD', 14)]);
    const filterBtn = el('button.btn', { type: 'button', 'aria-haspopup': 'dialog', onclick: () => filterPop(filterBtn) }, [ic.svg('filter', 16), 'סינון', activeCount() ? el('span.navlink__badge', { style: 'margin:0;background:var(--accent);color:var(--on-accent)', text: String(activeCount()) }) : null]);
    mount.appendChild(el('div.txbar', null, [el('div.field.field--lg', null, [ic.svg('search', 18), search]), periodBtn, filterBtn]));

    mount.appendChild(results);
    drawResults(results);
  }

  function activeCount() { return (view.cat ? 1 : 0) + (view.flow ? 1 : 0) + (view.source ? 1 : 0); }

  function periodText() {
    if (view.month) return fmt.monthName(view.month);
    if (view.periodLabel) return view.periodLabel;
    return 'כל התקופה';
  }

  function current() {
    let list = st.filter({ all: true, month: view.month || undefined, from: view.from || undefined, to: view.to || undefined, cat: view.cat || undefined, flow: view.flow || undefined, q: view.q || undefined });
    if (view.source === 'pending') list = list.filter((t) => t.cat === P.cats.OTHER);
    else if (view.source) list = list.filter((t) => t.source === view.source);
    return list;
  }

  function drawResults(box) {
    box.innerHTML = '';
    const chips = [];
    if (view.month || view.from) chips.push(P.ui.filterChip(periodText(), () => { view.month = view.from = view.to = view.periodLabel = null; P.router.refresh(); }));
    if (view.cat) chips.push(P.ui.filterChip(view.cat, () => { view.cat = null; P.router.refresh(); }, { tile: art.tile(view.cat, 22) }));
    if (view.flow) chips.push(P.ui.filterChip(view.flow === 'out' ? 'רק הוצאות' : 'רק הכנסות', () => { view.flow = null; P.router.refresh(); }));
    if (view.source) chips.push(P.ui.filterChip({ manual: 'שויכו ידנית', file: 'קטגוריה מהקובץ', rule: 'לפי כלל', inferred: 'הוצעו על ידי המנוע', pending: 'ממתינות לשיוך' }[view.source] || view.source, () => { view.source = null; P.router.refresh(); }));
    if (view.q) chips.push(P.ui.filterChip('"' + view.q + '"', () => { view.q = ''; P.router.refresh(); }));
    if (chips.length > 1) chips.push(el('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => { const s = sort; view = fresh(); sort = s; P.router.refresh(); } }, 'ניקוי הכל'));
    if (chips.length) box.appendChild(el('div.txfilters', null, chips));

    const list = current();
    const tot = st.totals(list.filter((t) => !st.isExcluded(t)));
    const head = el('div.txhead', null, [
      el('div.txsum', null, [
        el('div', null, ['נמצאו', el('b', { text: fmt.count(list.length) })]),
        el('div', null, ['יצא', el('b.fig', { text: fmt.money(tot.outflow) })]),
        st.spendOnly() && !tot.inflow ? null : el('div', null, ['נכנס', el('b.fig', { text: fmt.money(tot.inflow) })]),
        st.spendOnly() ? null : el('div', null, ['מאזן', el('b.fig' + (tot.net >= 0 ? '.in' : ''), { text: fmt.signed(tot.net) })])
      ]),
      P.ui.seg([['date', 'לפי תאריך'], ['amount', 'לפי סכום']], sort, (k) => { sort = k; view.list.shown = 0; P.router.refresh(); }, { label: 'מיון' })
    ]);
    box.appendChild(el('section.card.card--clip', null, [head, P.ui.txList(list, { page: 80, sort: sort, state: view.list,
      empty: P.ui.empty('לא נמצאו תנועות', 'נסו מילה אחרת, או הסירו חלק מהמסננים.') })]));
  }

  /* ---------- חלונית תקופה ---------- */
  function periodPop(anchor) {
    const months = st.months();
    const b = st.dateBounds();
    const last = new Date(b.last);
    const iso = (d) => P.parse.isoDate(d);
    const back = (days) => { const d = new Date(last); d.setDate(d.getDate() - days + 1); return iso(d); };
    const presets = [
      ['all', 'כל התקופה', () => ({})],
      ['30', '30 הימים האחרונים', () => ({ from: back(30), to: b.last, periodLabel: '30 הימים האחרונים' })],
      ['90', '3 החודשים האחרונים', () => ({ from: back(91), to: b.last, periodLabel: '3 החודשים האחרונים' })],
      ['y', 'שנת ' + b.last.slice(0, 4), () => ({ from: b.last.slice(0, 4) + '-01-01', to: b.last.slice(0, 4) + '-12-31', periodLabel: 'שנת ' + b.last.slice(0, 4) })]
    ];
    P.ui.popover(anchor, {
      width: 320,
      render: (node, api) => {
        const set = (o) => { view.month = o.month || null; view.from = o.from || null; view.to = o.to || null; view.periodLabel = o.periodLabel || null; view.list.shown = 0; api.close(); P.router.refresh(); };
        const body = el('div.pop__body');
        body.appendChild(el('div.pop__list', null, presets.map(([k, l, f]) => el('button.pop__item', {
          type: 'button', 'aria-checked': (k === 'all' ? !view.month && !view.from : view.periodLabel === f().periodLabel) ? 'true' : 'false', onclick: () => set(f())
        }, l))));
        const byYear = {};
        months.forEach((m) => { (byYear[m.key.slice(0, 4)] = byYear[m.key.slice(0, 4)] || []).push(m); });
        Object.keys(byYear).sort().reverse().forEach((y) => {
          body.appendChild(el('div.pop__label', { text: y }));
          body.appendChild(el('div.pop__list', null, byYear[y].map((m) => el('button.pop__item', {
            type: 'button', 'aria-checked': view.month === m.key ? 'true' : 'false', onclick: () => set({ month: m.key })
          }, [el('span', { text: fmt.monthOnly(m.key) }), el('span.spacer'), el('span.fig.dim', { style: 'font-size:var(--fs-tiny)', text: fmt.money(m.outflow) })]))));
        });
        node.appendChild(body);
      }
    });
  }

  /* ---------- חלונית סינון ---------- */
  function filterPop(anchor) {
    P.ui.popover(anchor, {
      width: 360,
      render: (node, api) => {
        const body = el('div.pop__body');
        const apply = () => { view.list.shown = 0; api.close(); P.router.refresh(); };
        body.appendChild(el('div.pop__label', { text: 'סוג התנועה' }));
        body.appendChild(el('div', { style: 'padding:0 4px 8px' }, P.ui.seg([['', 'הכל'], ['out', 'הוצאות'], ['in', 'הכנסות']], view.flow || '', (k) => { view.flow = k || null; apply(); })));
        body.appendChild(el('div.pop__label', { text: 'מקור הקטגוריה' }));
        body.appendChild(el('div', { style: 'padding:0 4px 8px' }, P.ui.seg([['', 'הכל'], ['manual', 'ידני'], ['inferred', 'הוצע'], ['pending', 'ממתין']], view.source || '', (k) => { view.source = k || null; apply(); })));
        body.appendChild(el('div.pop__label', { text: 'קטגוריה' }));
        const counts = P.dict();
        st.data.tx.forEach((t) => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
        const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        body.appendChild(el('div.pop__list', null, [el('button.pop__item', { type: 'button', 'aria-checked': !view.cat ? 'true' : 'false', onclick: () => { view.cat = null; apply(); } }, 'כל הקטגוריות')].concat(
          cats.map((c) => el('button.pop__item', { type: 'button', 'aria-checked': view.cat === c ? 'true' : 'false', onclick: () => { view.cat = c; apply(); } }, [
            art.tile(c, 26), el('span', { text: c }), el('span.spacer'), el('span.dim', { style: 'font-size:var(--fs-micro)', text: fmt.count(counts[c]) })
          ])))));
        node.appendChild(body);
      }
    });
  }

  /* ---------- ייצוא ---------- */
  function exportCsv() {
    const list = current();
    const head = ['תאריך', 'תיאור', 'קטגוריה', 'סכום', 'מטבע', 'יתרה', 'אסמכתא', 'הערה'];
    // תא טקסט שמתחיל ב- = + - @ היה מתפרש באקסל כנוסחה. גרש בתחילתו משאיר אותו טקסט רגיל.
    const safe = (s) => { const v = String(s == null ? '' : s); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; };
    const rows = list.map((t) => [fmt.day(t.date), safe(t.desc), safe(t.cat), t.amount, safe(t.currency), t.balance == null ? '' : t.balance, safe(t.ref), safe(t.note)]);
    const csv = '﻿' + [head].concat(rows).map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    P.kit.download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'תנועות-' + new Date().toISOString().slice(0, 10) + '.csv');
    P.kit.toast(fmt.plural(list.length, 'תנועה', 'תנועות', 'תנועה אחת') + ' ירדו לקובץ CSV, שנפתח באקסל');
  }

  return { render: render, title: 'תנועות', needsData: true };
})();
