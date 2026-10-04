/* ==========================================================================
   ui/palette.js — חיפוש מהיר (Ctrl+K או "/")
   ---------------------------------------------------------------------------
   חלון אחד שמגיע לכל דבר: עמוד, פעולה, חודש, קטגוריה, בית עסק או תנועה.
   מקלדת: חצים לבחירה, Enter לפתיחה, Esc לסגירה.
   אפשר גם לחפש סכום: "250" מוצא תנועות של ₪250 בערך.
   ========================================================================== */
window.P = window.P || {};

P.palette = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons, art = P.art;
  let layer = null;

  const PAGES = [
    { hash: '#/', icon: 'home', title: 'החודש שלי', sub: 'החודש במבט אחד', words: 'סקירה בית ראשי home' },
    { hash: '#/plan', icon: 'target', title: 'התוכנית', sub: 'יעדים, חריגות ומה אם', words: 'תקציב יעד תוכנית' },
    { hash: '#/explore', icon: 'compass', title: 'לחקור', sub: 'חודשים, קטגוריות, תנועות ותובנות', words: 'חקירה עוד' },
    { hash: '#/months', icon: 'calendar', title: 'חודשים', sub: 'כל חודש בכרטיס משלו', words: 'חודש שנה' },
    { hash: '#/categories', icon: 'grid', title: 'קטגוריות', sub: 'לאן הולך הכסף', words: 'קטגוריה' },
    { hash: '#/transactions', icon: 'list', title: 'תנועות', sub: 'חיפוש, סינון וייצוא', words: 'תנועה חיובים' },
    { hash: '#/insights', icon: 'chart', title: 'תובנות', sub: 'גרפים ומגמות', words: 'גרף גרפים מגמה' },
    { hash: '#/assign', icon: 'inbox', title: 'לשיוך', sub: 'מה שעוד לא סווג', words: 'שיוך ממתינות' },
    { hash: '#/rules', icon: 'sliders', title: 'כללי סיווג', sub: 'מילות מפתח לכל קטגוריה', words: 'כלל מילות מפתח' },
    { hash: '#/settings', icon: 'gear', title: 'הגדרות', sub: 'מראה, שמירה וגיבוי', words: 'הגדרה גיבוי צבע' }
  ];

  function actions() {
    const dark = P.app.currentTheme() === 'dark';
    const has = st.data.tx.length > 0;
    return [
      { icon: 'upload', title: 'טעינת קובץ', sub: 'אקסל או CSV, מכל בנק', words: 'ייבוא קובץ העלאה', run: () => P.app.openFilePicker() },
      { icon: dark ? 'sun' : 'moon', title: dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה', words: 'מצב כהה בהיר תצוגה', run: () => P.app.toggleTheme() },
      has ? { icon: 'repeat', title: 'הוצאות קבועות', sub: 'מנויים והוראות קבע שזוהו', words: 'קבועות מנויים הוראת קבע', run: () => P.views.recurring() } : null,
      // ההדמיות — רק כשיש נתונים, ורק כשמערכת ההפעלה לא מבקשת פחות תנועה
      P.stories.can() ? { icon: 'spark', title: 'סיפור החודש', sub: 'הדמיה של ' + P.fmt.monthName(P.insights.focusMonth()), words: 'הדמיה סיפור חודש סיכום', run: () => P.stories.month(P.insights.focusMonth()) } : null,
      P.stories.can() && st.months().length >= 2 ? { icon: 'spark', title: 'סיפור השנה', sub: 'הדמיה של 12 החודשים האחרונים', words: 'הדמיה סיפור שנה סיכום שנתי', run: () => P.stories.year() } : null,
      P.stories.can() ? { icon: 'spark', title: 'הקבועות של השנה הקרובה', sub: 'הדמיה של החיובים הקבועים', words: 'הדמיה קבועות מנויים תחזית', run: () => { if (P.stories.canRecurring()) P.stories.recurring(); else P.kit.toast('עוד לא זוהו מספיק חיובים קבועים — צריך לפחות שניים.'); } } : null,
      has ? { icon: 'download', title: 'הורדת גיבוי', sub: 'קובץ JSON עם כל הנתונים', words: 'גיבוי שמירה', run: () => P.app.backup() } : null
    ].filter(Boolean);
  }

  const has = (hay, q) => P.parse.norm(hay).indexOf(q) !== -1;

  /** בונה את קבוצות התוצאות לשאילתה */
  function search(raw) {
    const q = P.parse.norm(raw);
    const groups = [];
    const iconNode = (name, color) => el('span.palette__icon', { style: color ? 'color:' + color : null }, ic.svg(name, 18));

    // עמודים ופעולות
    const pages = PAGES.filter((p) => !q || has(p.title + ' ' + p.words, q));
    if (pages.length) groups.push({ label: 'עמודים', items: pages.map((p) => ({ icon: iconNode(p.icon), title: p.title, sub: p.sub, go: p.hash })) });
    const acts = actions().filter((a) => !q || has(a.title + ' ' + (a.words || ''), q));
    if (acts.length) groups.push({ label: 'פעולות', items: acts.map((a) => ({ icon: iconNode(a.icon, 'var(--accent-strong)'), title: a.title, sub: a.sub, run: a.run })) });
    if (!st.data.tx.length) return groups;

    // חודשים
    const months = st.months();
    const mm = q ? months.filter((m) => has(fmt.monthName(m.key) + ' ' + m.key, q)) : months.slice(0, 3);
    if (mm.length) groups.push({ label: q ? 'חודשים' : 'חודשים אחרונים', items: mm.slice(0, 4).map((m) => ({
      icon: iconNode('calendar'), title: fmt.monthName(m.key), sub: fmt.plural(m.count, 'תנועה', 'תנועות', 'תנועה אחת'),
      val: fmt.money(m.outflow), run: () => P.views.month(m.key)
    })) });
    if (!q) return groups;

    // קטגוריות
    const counts = P.dict();
    st.data.tx.forEach((t) => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    const cats = Object.keys(st.data.rules).filter((c) => has(c, q)).slice(0, 4);
    if (cats.length) groups.push({ label: 'קטגוריות', items: cats.map((c) => ({
      icon: art.tile(c, 36), title: c, sub: fmt.plural(counts[c] || 0, 'תנועה', 'תנועות', 'תנועה אחת'), run: () => P.views.category(c)
    })) });

    // סכום: "250" או "₪1,200"
    const num = parseFloat(String(raw).replace(/[₪,\s]/g, ''));
    const isAmount = /^[\s₪]*\d[\d,]*(\.\d+)?\s*$/.test(String(raw)) && isFinite(num) && num > 0;

    // בתי עסק
    if (!isAmount) {
      const shops = st.byMerchant(st.data.tx.filter((t) => has(t.desc, q))).slice(0, 5);
      if (shops.length) groups.push({ label: 'בתי עסק', items: shops.map((g) => ({
        icon: art.avatar(g.label, g.cat, 36), title: g.label, sub: g.cat + ' · ' + fmt.plural(g.count, 'חיוב', 'חיובים', 'חיוב אחד'),
        val: fmt.money(g.sum), run: () => P.views.merchant(g.key)
      })) });
    }

    // תנועות
    const txs = st.data.tx.filter((t) => isAmount
      ? Math.abs(Math.abs(t.amount) - num) <= Math.max(1, num * 0.005)
      : has(t.desc + ' ' + (t.note || '') + ' ' + (t.ref || ''), q)).slice(0, 7);
    if (txs.length) groups.push({ label: isAmount ? 'תנועות בסכום הזה' : 'תנועות', items: txs.map((t) => ({
      icon: art.tile(t.cat, 36), title: t.desc, sub: fmt.day(t.date) + ' · ' + t.cat,
      val: fmt.signed(t.amount, true), valIn: t.amount > 0, run: () => P.views.tx(t.id)
    })) });
    return groups;
  }

  function open(initial) {
    if (layer) return;
    let items = [], sel = 0, pending = null;
    const input = el('input', { type: 'search', placeholder: 'חיפוש תנועה, בית עסק, קטגוריה, חודש או סכום…', 'aria-label': 'חיפוש', autofocus: true, autocomplete: 'off', spellcheck: 'false' });
    const results = el('div.palette__results', { role: 'listbox', 'aria-label': 'תוצאות' });
    const node = el('section.palette', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'חיפוש מהיר' }, [
      el('div.palette__input', null, [ic.svg('search', 20), input, el('span.kbd', { text: 'Esc' })]),
      results,
      el('div.palette__hint', null, [
        el('span', null, [el('span.kbd', { text: '↑↓' }), 'ניווט']),
        el('span', null, [el('span.kbd', { text: 'Enter' }), 'פתיחה']),
        el('span', null, [el('span.kbd', { text: 'Esc' }), 'סגירה'])
      ])
    ]);

    function draw() {
      const groups = search(input.value);
      results.innerHTML = '';
      items = [];
      if (!groups.length) {
        results.appendChild(el('div.palette__empty', null, [el('b', { style: 'display:block;color:var(--ink);font-size:15px;margin-bottom:4px', text: 'לא נמצא כלום' }), 'נסו מילה אחרת, שם של חודש, או סכום.']));
        return;
      }
      groups.forEach((g) => {
        results.appendChild(el('div.palette__group', { text: g.label }));
        g.items.forEach((it) => {
          const i = items.length;
          const row = el('div.palette__item', { role: 'option', id: 'pal-' + i, 'aria-selected': 'false' }, [
            it.icon,
            el('div.lrow__main', null, [
              el('div.lrow__title', null, el('span', { text: it.title })),
              it.sub ? el('small', { text: it.sub }) : null
            ]),
            it.val ? el('span.palette__val.fig' + (it.valIn ? '.in' : ''), { text: it.val }) : null
          ]);
          row.addEventListener('mousemove', () => { if (sel !== i) select(i, false); });
          row.addEventListener('click', () => choose(i));
          results.appendChild(row);
          items.push({ node: row, item: it });
        });
      });
      select(Math.min(sel, items.length - 1), false);
    }
    function select(i, scroll) {
      if (!items.length) return;
      sel = (i + items.length) % items.length;
      items.forEach((x, k) => x.node.setAttribute('aria-selected', k === sel ? 'true' : 'false'));
      input.setAttribute('aria-activedescendant', 'pal-' + sel);
      if (scroll !== false) items[sel].node.scrollIntoView({ block: 'nearest' });
    }
    function choose(i) {
      const x = items[i];
      if (!x) return;
      // קודם נסגרים (כולל ההיסטוריה), ורק אז מבצעים — כך "אחורה" ממשיך לעבוד נכון
      pending = x.item.go ? () => P.layers.navigate(x.item.go) : x.item.run;
      P.layers.close(layer);
    }

    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    });

    if (initial) input.value = initial;
    draw();
    layer = P.layers.open({ node: node, kind: 'palette', onClose: () => {
      layer = null;
      if (pending) { const f = pending; pending = null; setTimeout(f, 30); }
    } });
  }

  function isOpen() { return !!layer; }
  function toggle() { if (layer) P.layers.close(layer); else open(); }

  return { open, toggle, isOpen };
})();
