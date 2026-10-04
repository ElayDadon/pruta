/* ==========================================================================
   ui/txlist.js — רשימת תנועות לפי ימים, כמו באפליקציית בנק טובה
   כל שורה: איור הקטגוריה, שם, קטגוריה (לחיצה = החלפה במקום), סכום.
   לחיצה על השורה פותחת את פרטי התנועה.
   ========================================================================== */
window.P = window.P || {};
P.ui = P.ui || {};

(function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons;

  const SOURCE = {
    manual: { text: 'ידני', title: 'שיוך ידני שלכם' },
    file: { text: 'מהקובץ', title: 'הקטגוריה הגיעה בקובץ' },
    inferred: { text: 'הוצע', title: 'המנוע הציע לפי תנועות דומות', cls: '.badge--accent' }
  };

  /**
   * @param {Array} list
   * @param {Object} opts { page, sort: 'date'|'amount', group: bool, empty: Node, state: {shown} }
   */
  function txList(list, opts) {
    const o = opts || {};
    const step = o.page || 80;
    // o.state שומר כמה שורות נפתחו, כדי שרענון של העמוד לא יקפל את הרשימה
    let shown = Math.max(step, (o.state && o.state.shown) || 0);
    const wrap = el('div.txlist');

    function sorted() {
      if (o.sort === 'amount') return list.slice().sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      return list.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : Math.abs(b.amount) - Math.abs(a.amount)));
    }

    function draw() {
      wrap.innerHTML = '';
      const rows = sorted();
      if (!rows.length) {
        wrap.appendChild(o.empty || el('div.empty', null, [el('div.empty__art', null, P.art.emptyArt()), el('b', { text: 'אין תנועות כאן' }), el('p', { text: 'נסו לשנות את הסינון או את טווח התאריכים.' })]));
        return;
      }
      const slice = rows.slice(0, shown);
      const grouped = o.group !== false && o.sort !== 'amount';
      if (grouped) {
        const dayTotals = {};
        rows.forEach((t) => { if (t.amount < 0 && !st.isExcluded(t)) dayTotals[t.date] = (dayTotals[t.date] || 0) - t.amount; });
        let cur = null;
        slice.forEach((t) => {
          if (t.date !== cur) {
            cur = t.date;
            wrap.appendChild(el('div.txday', null, [
              el('span', null, el('b', { text: fmt.dayLong(t.date) })),
              dayTotals[t.date] ? el('span.fig', { text: fmt.moneyS(-dayTotals[t.date]) }) : null
            ]));
          }
          wrap.appendChild(row(t, false));
        });
      } else {
        slice.forEach((t) => wrap.appendChild(row(t, true)));
      }
      if (rows.length > slice.length) {
        wrap.appendChild(el('div.txmore', null, el('button.btn.btn--soft.btn--sm', {
          type: 'button', onclick: () => { shown += step; if (o.state) o.state.shown = shown; draw(); }
        }, 'עוד ' + fmt.count(Math.min(step, rows.length - slice.length)) + ' תנועות')));
      }
    }

    function row(t, showDate) {
      const pending = t.cat === P.cats.OTHER;
      const src = SOURCE[t.source];
      const chip = el('button.catchip' + (pending ? '.catchip--pending' : ''), {
        type: 'button', title: 'החלפת קטגוריה', vars: { '--c': st.tintOf(t.cat) },
        onclick: (e) => { e.stopPropagation(); quickPick(chip, t); }
      }, [el('i'), pending ? 'בחירת קטגוריה' : t.cat]);
      const r = el('div.txrow' + (st.isExcluded(t) ? '.is-excluded' : ''), {
        role: 'button', tabindex: '0', 'aria-label': t.desc + ', ' + fmt.signed(t.amount, true) + ', ' + fmt.day(t.date)
      }, [
        P.art.tile(t.cat, 40),
        el('div.txrow__main', null, [
          el('div.txrow__desc', null, [el('span', { text: t.desc, title: t.desc }),
            src ? el('span.badge' + (src.cls || ''), { title: src.title }, [src.cls ? ic.svg('spark', 11) : null, src.text]) : null]),
          el('div.txrow__meta', null, [chip, t.note ? el('span.txrow__note', { text: t.note }) : null])
        ]),
        el('div.txrow__aside', null, [
          el('div.txrow__amt.fig' + (t.amount > 0 ? '.in' : ''), { text: fmt.signed(t.amount, true) }),
          showDate ? el('div.txrow__date', { text: fmt.day(t.date) }) : null
        ])
      ]);
      P.kit.onActivate(r, () => P.views.tx(t.id));
      return r;
    }

    draw();
    return wrap;
  }

  /** החלפת קטגוריה מהירה מתוך השורה */
  function quickPick(anchor, t) {
    const sugg = P.learn.suggest(t.desc, st.data.tx, 3).map((s) => s.cat).concat(P.cats.suggest(t.desc, st.data.rules, 3));
    P.ui.pickCategory(anchor, { current: t.cat, suggestions: sugg }).then((cat) => { if (cat && cat !== t.cat) applyChange(t, cat); });
  }

  /**
   * שיוך תנועה אחת — ואם יש עוד תנועות מאותו בית עסק, הצעה להחיל על כולן
   * (וליצור כלל) ישירות מתוך ההודעה. הכל ניתן לביטול.
   */
  function applyChange(t, cat) {
    const key = P.learn.merchantKey(t.desc);
    const res = st.assignUndoable([t.id], cat);
    const siblings = st.data.tx.filter((x) => x.id !== t.id && P.learn.merchantKey(x.desc) === key && x.cat !== cat);
    if (!siblings.length) { P.kit.toast('שויך ' + fmt.prefix('ל', cat), { undo: res.undo }); return; }
    const kw = P.learn.keywordFor(t.desc, st.data.tx);
    P.kit.toast('שויך ' + fmt.prefix('ל', cat) + '. יש עוד ' + fmt.plural(siblings.length, 'תנועה', 'תנועות', 'תנועה אחת') + ' מאותו בית עסק.', {
      duration: 9000,
      actions: [{ label: 'להחיל על כולן', run: () => {
        const all = st.assignUndoable(siblings.map((s) => s.id), cat, kw);
        P.kit.toast(fmt.plural(siblings.length + 1, 'תנועה', 'תנועות') + ' שויכו ' + fmt.prefix('ל', cat) + (all.keywordAdded ? ', ונוצר כלל "' + kw + '"' : ''), {
          undo: () => { all.undo(); res.undo(); }
        });
      } }],
      undo: res.undo
    });
  }

  P.ui.txList = txList;
  P.ui.applyChange = applyChange;
  P.ui.quickPick = quickPick;
})();
