/* ==========================================================================
   ui/picker.js — בוחר קטגוריה ובוחר חודש
   בוחר הקטגוריה הוא רשת איורים עם חיפוש, הצעות בראש, ויצירת קטגוריה חדשה
   במקום — בלי לצאת מהחלונית.
   ========================================================================== */
window.P = window.P || {};
P.ui = P.ui || {};

/**
 * פותח בוחר קטגוריה ליד העוגן.
 * opts: { current, suggestions: [cat], title }
 * @returns {Promise<string|null>}
 */
P.ui.pickCategory = function (anchor, opts) {
  'use strict';
  const el = P.kit.el, st = P.state, ic = P.icons;
  const o = opts || {};
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); };

    // סדר: לפי כמה פעמים הקטגוריה בשימוש, ואז לפי א"ב
    const usage = P.dict();
    st.data.tx.forEach((t) => { usage[t.cat] = (usage[t.cat] || 0) + 1; });
    const all = Object.keys(st.data.rules).filter((c) => c !== P.cats.OTHER)
      .sort((a, b) => (usage[b] || 0) - (usage[a] || 0) || a.localeCompare(b, 'he'));
    const sugg = (o.suggestions || []).filter((c) => c && c !== o.current && all.indexOf(c) !== -1).slice(0, 3);

    P.ui.popover(anchor, {
      width: 380,
      onClose: () => finish(null),
      render: (node, api) => {
        const input = el('input', { type: 'search', placeholder: 'חיפוש קטגוריה…', 'aria-label': 'חיפוש קטגוריה', autofocus: true });
        const body = el('div.pop__body');
        node.appendChild(el('div.pop__head', null, el('div.field', null, [ic.svg('search', 16), input])));
        node.appendChild(body);
        node.appendChild(el('div.pop__foot', null, [
          el('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => newCat(input.value) }, [ic.svg('plus', 14), 'קטגוריה חדשה']),
          el('span.spacer'),
          o.current && o.current !== P.cats.OTHER ? el('span.dim', { style: 'font-size:var(--fs-micro)', text: 'כרגע: ' + o.current }) : null
        ]));

        function pick(cat) { finish(cat); api.close(); }
        function draw() {
          const q = P.parse.norm(input.value);
          body.innerHTML = '';
          const list = q ? all.filter((c) => P.parse.norm(c).indexOf(q) !== -1) : all;
          if (!q && sugg.length) {
            body.appendChild(el('div.pop__label', { text: 'מוצע' }));
            body.appendChild(el('div.picker__sugg', null, sugg.map((c) =>
              el('button', { type: 'button', onclick: () => pick(c) }, [P.art.tile(c, 24), c]))));
            body.appendChild(el('div.pop__label', { text: 'כל הקטגוריות' }));
          }
          if (!list.length) {
            body.appendChild(el('div.empty', { style: 'padding:18px 10px' }, [
              el('p', { text: 'אין קטגוריה בשם הזה.' }),
              el('button.btn.btn--soft.btn--sm', { type: 'button', onclick: () => newCat(input.value) }, 'יצירת "' + input.value.trim() + '"')
            ]));
            return;
          }
          const grid = el('div.picker__grid', { role: 'listbox', 'aria-label': 'קטגוריות' });
          list.forEach((c) => grid.appendChild(el('button.picker__tile', {
            type: 'button', role: 'option', 'aria-current': c === o.current ? 'true' : null, onclick: () => pick(c)
          }, [P.art.tile(c, 38), el('span', { text: c })])));
          body.appendChild(grid);
          wireArrows(grid);
        }
        function newCat(name) {
          body.innerHTML = '';
          const inp = el('input.input', { value: (name || '').trim(), placeholder: 'שם הקטגוריה', autofocus: true });
          const ok = el('button.btn.btn--primary.btn--sm', { type: 'button', onclick: create }, 'יצירה');
          function create() {
            const v = P.parse.clean(inp.value);
            if (!v) return;
            st.addCategory(v);
            pick(v);
          }
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
          body.appendChild(el('div.pop__label', { text: 'קטגוריה חדשה' }));
          body.appendChild(el('div.picker__new', null, [inp, ok]));
          setTimeout(() => inp.focus(), 0);
        }
        input.addEventListener('input', draw);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { const first = body.querySelector('.picker__sugg button, .picker__tile'); if (first) { e.preventDefault(); first.click(); } }
          if (e.key === 'ArrowDown') { const first = body.querySelector('.picker__tile'); if (first) { e.preventDefault(); first.focus(); } }
        });
        draw();
      }
    });
  });

  /** ניווט בחצים בתוך הרשת (שלוש עמודות, מימין לשמאל) */
  function wireArrows(grid) {
    grid.addEventListener('keydown', (e) => {
      const items = Array.prototype.slice.call(grid.children);
      const i = items.indexOf(document.activeElement);
      if (i === -1) return;
      const map = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 3, ArrowUp: -3 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const n = items[Math.max(0, Math.min(items.length - 1, i + map[e.key]))];
      if (n) n.focus();
    });
  }
};

/**
 * בוחר חודש: רשימת החודשים שיש בהם נתונים, לפי שנים.
 * @returns {Promise<string|null>}
 */
P.ui.pickMonth = function (anchor, opts) {
  'use strict';
  const el = P.kit.el, st = P.state, fmt = P.fmt;
  const o = opts || {};
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); };
    const months = st.months();
    const byYear = {};
    months.forEach((m) => { (byYear[m.key.slice(0, 4)] = byYear[m.key.slice(0, 4)] || []).push(m); });
    P.ui.popover(anchor, {
      width: 340,
      onClose: () => finish(null),
      render: (node, api) => {
        const body = el('div.pop__body');
        Object.keys(byYear).sort().reverse().forEach((y) => {
          body.appendChild(el('div.pop__label', { text: y }));
          body.appendChild(el('div.pop__list', null, byYear[y].map((m) => el('button.pop__item', {
            type: 'button', role: 'menuitemradio', 'aria-checked': m.key === o.current ? 'true' : 'false',
            onclick: () => { finish(m.key); api.close(); }
          }, [
            el('span', { text: fmt.monthOnly(m.key) }),
            el('span.spacer'),
            el('span.fig.dim', { style: 'font-size:var(--fs-tiny)', text: fmt.money(m.outflow) })
          ]))));
        });
        node.appendChild(body);
      }
    });
  });
};
