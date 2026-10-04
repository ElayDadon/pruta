/* ==========================================================================
   pages/rules.js — כללי הסיווג
   כל קטגוריה היא שורה אחת שנפתחת: מילות המפתח שלה, האם היא נספרת,
   ומחיקה. למעלה — מה שהמנוע למד לבד מהטבלה, כהצעות בלחיצה אחת.
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.rules = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons, art = P.art;
  const view = { q: '', open: P.dict() };

  function render(params, mount, ctx) {
    if (!ctx.refresh) { view.q = ''; if (params.cat) { view.open = P.dict(); view.open[params.cat] = true; } }
    const cats = Object.keys(st.data.rules);
    const kwTotal = cats.reduce((a, c) => a + st.data.rules[c].length, 0);

    mount.appendChild(P.ui.pageHead('כללי סיווג',
      'תנועה מקבלת את הקטגוריה של מילת המפתח הארוכה ביותר שמופיעה בתיאור שלה. שיוך ידני גובר תמיד על כלל.',
      [el('button.btn', { type: 'button', onclick: (e) => addCategory(e.currentTarget) }, [ic.svg('plus', 16), 'קטגוריה חדשה']),
        el('button.btn.btn--ghost', { type: 'button', onclick: reset }, 'איפוס לברירת המחדל')]));

    const learned = mined();
    if (learned) mount.appendChild(learned);

    const search = el('input', { type: 'search', value: view.q, placeholder: 'חיפוש קטגוריה או מילת מפתח…', 'aria-label': 'חיפוש בכללים', 'data-fk': 'rules-search' });
    const listBox = el('div.rlist');
    search.addEventListener('input', P.kit.debounce(() => { view.q = search.value; drawList(listBox); }, 100));
    mount.appendChild(el('div.section__head', { style: 'margin-top:28px' }, [
      el('h2.section__title', { text: 'כל הקטגוריות' }),
      el('span.section__note', { text: fmt.count(cats.length) + ' קטגוריות · ' + fmt.count(kwTotal) + ' מילות מפתח' }),
      el('div.field.section__act', { style: 'width:min(300px,100%)' }, [ic.svg('search', 16), search])
    ]));
    mount.appendChild(listBox);
    drawList(listBox);
  }

  /* ---------- מה שהמנוע למד ---------- */
  function mined() {
    let rows = [];
    try { rows = P.learn.mineRules(st.data.tx, st.data.rules, { minDocs: 2, minPurity: 0.88, max: 6 }); } catch (e) { rows = []; }
    if (!rows.length) return null;
    return P.ui.card({
      title: 'המנוע למד מהטבלה שלך', note: 'מילים שחוזרות בתיאורים, ותמיד באותה קטגוריה',
      flush: true,
      end: rows.length > 1 ? [el('button.btn.btn--soft.btn--sm', { type: 'button', onclick: () => {
        let n = 0; rows.forEach((r) => { if (st.addKeyword(r.cat, r.keyword)) n++; });
        P.kit.toast(fmt.plural(n, 'כלל נוסף', 'כללים נוספו', 'כלל אחד נוסף'));
      } }, [ic.svg('check', 14), 'להוסיף את כולם'])] : null,
      body: el('div.list', null, rows.map((r) => el('div.lrow', { style: 'cursor:default' }, [
        art.tile(r.cat, 40),
        el('div.lrow__main', null, [
          el('div.lrow__title', null, [el('span', null, [el('span.kwedit', { style: 'cursor:default;display:inline-flex;align-items:center', text: r.keyword }), ' ', ic.svg('chevron', 14), ' ' + r.cat])]),
          el('div.lrow__meta', null, [
            el('span', { text: fmt.plural(r.docs, 'תנועה', 'תנועות', 'תנועה אחת') }),
            el('span.fig', { text: fmt.money(r.sum) }),
            el('span', { text: r.manual ? 'נלמד מ-' + fmt.plural(r.manual, 'שיוך', 'שיוכים', 'שיוך אחד') + ' שלך' : 'נלמד מהקובץ' })
          ])
        ]),
        el('button.btn.btn--sm', { type: 'button', onclick: () => {
          if (st.addKeyword(r.cat, r.keyword)) P.kit.toast('הכלל "' + r.keyword + '" נוסף ' + fmt.prefix('ל', r.cat));
        } }, [ic.svg('plus', 14), 'הוספה'])
      ])))
    });
  }

  /* ---------- רשימת הקטגוריות ---------- */
  function drawList(box) {
    box.innerHTML = '';
    const counts = P.dict(), spend = P.dict();
    st.data.tx.forEach((t) => { counts[t.cat] = (counts[t.cat] || 0) + 1; if (t.amount < 0) spend[t.cat] = (spend[t.cat] || 0) - t.amount; });
    const q = P.parse.norm(view.q);
    let cats = Object.keys(st.data.rules).sort((a, b) => (spend[b] || 0) - (spend[a] || 0) || (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b, 'he'));
    if (q) cats = cats.filter((c) => P.parse.norm(c).indexOf(q) !== -1 || st.data.rules[c].some((k) => P.parse.norm(k).indexOf(q) !== -1));
    if (!cats.length) { box.appendChild(el('section.card', null, P.ui.empty('לא נמצא כלל כזה', 'אין קטגוריה או מילת מפתח שמתאימה לחיפוש.'))); return; }
    cats.forEach((c) => box.appendChild(row(c, counts[c] || 0, spend[c] || 0, q)));
  }

  function row(cat, count, spend, q) {
    const kws = st.data.rules[cat] || [];
    const excluded = !!st.data.excluded[cat];
    const isOther = cat === P.cats.OTHER;
    const hit = q && kws.some((k) => P.parse.norm(k).indexOf(q) !== -1);
    const node = el('details.rrow' + (excluded ? '.rrow--excluded' : ''), { open: (view.open[cat] || hit) ? true : null });
    // זוכרים מה פתוח רק כשהמשתמש פתח בעצמו — כך רענון אחרי הוספת מילה לא סוגר את השורה
    const remember = () => setTimeout(() => { if (node.open) view.open[cat] = true; else delete view.open[cat]; }, 0);

    node.appendChild(el('summary', { onclick: remember, onkeyup: remember }, [
      art.tile(cat, 40, excluded ? 'var(--ink-4)' : undefined),
      el('div', { style: 'min-width:0' }, [
        el('div.rrow__name', { text: cat }),
        el('div.rrow__meta', null, [
          isOther ? 'כאן נוחת מה שלא זוהה' : fmt.plural(kws.length, 'מילת מפתח', 'מילות מפתח', 'מילת מפתח אחת'),
          ' · ' + fmt.plural(count, 'תנועה', 'תנועות', 'תנועה אחת'),
          spend ? [' · ', el('span.fig', { text: fmt.money(spend) })] : null
        ])
      ]),
      el('div.rrow__end', null, [
        excluded ? el('span.badge', null, [ic.svg('eyeOff', 12), 'לא נספר']) : null,
        el('span.rrow__chev', null, ic.svg('chevron', 18))
      ])
    ]));

    const body = el('div.rrow__body');
    if (isOther) {
      body.appendChild(el('p.dim', { style: 'margin:14px 0 0;font-size:var(--fs-small)', text: 'לקטגוריה הזאת אין מילות מפתח. היא מתרוקנת כשמשייכים את התנועות שבה.' }));
      body.appendChild(el('div.rrow__actions', null, el('button.btn.btn--sm.btn--soft', { type: 'button', onclick: () => P.router.go('#/assign') }, [ic.svg('inbox', 14), 'לעמוד השיוך'])));
    } else {
      const box = el('div.kws');
      kws.forEach((k, i) => box.appendChild(el('span.kw' + (q && P.parse.norm(k).indexOf(q) !== -1 ? '.is-hit' : ''), null, [k, el('button', { type: 'button', 'aria-label': 'הסרת ' + k, title: 'הסרה', onclick: () => {
        st.removeKeyword(cat, i);
        P.kit.toast('"' + k + '" הוסר ' + fmt.prefix('מ', cat), { undo: () => st.addKeyword(cat, k) });
      } }, ic.svg('close', 12))])));
      const inp = el('input.kw-add', { placeholder: '+ מילה חדשה ואנטר', 'aria-label': 'הוספת מילת מפתח ' + fmt.prefix('ל', cat), 'data-fk': 'kw:' + cat });
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const v = inp.value.trim(); if (!v) return;
        if (st.addKeyword(cat, v)) P.kit.toast('"' + v + '" נוסף ' + fmt.prefix('ל', cat));
        else { P.kit.toast('המילה כבר קיימת בקטגוריה'); inp.select(); }
      });
      box.appendChild(inp);
      body.appendChild(box);
      const sw = el('button.switch', { type: 'button', role: 'switch', 'aria-checked': excluded ? 'false' : 'true', onclick: () => {
        st.setExcluded(cat, !excluded);
        P.kit.toast(excluded ? cat + ' נספר שוב בסיכומים' : cat + ' לא ייספר בסיכומים ובגרפים', { undo: () => st.setExcluded(cat, excluded) });
      } });
      body.appendChild(el('div.rrow__actions', null, [
        el('label.check', { style: 'margin-inline-end:auto', title: 'כבו למשל להעברות בין החשבונות שלכם, או לחיובי אשראי מרוכזים כשטענתם גם את פירוט הכרטיס' }, [sw, el('span', { text: 'נספר בסיכומים ובגרפים' })]),
        count ? el('button.btn.btn--sm', { type: 'button', onclick: () => P.views.category(cat) }, 'פתיחת הקטגוריה') : null,
        el('button.btn.btn--sm.btn--danger', { type: 'button', onclick: () => removeCategory(cat, count) }, [ic.svg('trash', 14), 'מחיקה'])
      ]));
    }
    node.appendChild(body);
    return node;
  }

  /* ---------- פעולות ---------- */
  function addCategory(anchor) {
    P.ui.popover(anchor, {
      width: 340,
      render: (node, api) => {
        const inp = el('input.input', { placeholder: 'למשל: רכב, ילדים, עסק', 'aria-label': 'שם הקטגוריה', autofocus: true });
        const create = () => {
          const v = P.parse.clean(inp.value);
          if (!v) return;
          if (st.data.rules[v]) { P.kit.toast('קטגוריה בשם הזה כבר קיימת'); return; }
          view.open[v] = true;
          st.addCategory(v);
          api.close();
          P.kit.toast('הקטגוריה "' + v + '" נוספה. עכשיו אפשר לתת לה מילות מפתח.');
        };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
        node.appendChild(el('div.pop__body', { style: 'padding:14px' }, [el('div.lbl', { text: 'שם הקטגוריה החדשה' }), inp]));
        node.appendChild(el('div.pop__foot', null, [el('button.btn.btn--primary.btn--sm', { type: 'button', onclick: create }, 'יצירה'), el('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: api.close }, 'ביטול')]));
      }
    });
  }

  function removeCategory(cat, count) {
    P.kit.confirmBox('למחוק את ' + cat + '?',
      count ? fmt.plural(count, 'תנועה', 'תנועות', 'תנועה אחת') + ' יחזרו לסיווג אוטומטי, ומילות המפתח של הקטגוריה יימחקו.' : 'הקטגוריה ומילות המפתח שלה יימחקו.',
      'מחיקה', () => { st.removeCategory(cat); P.kit.toast('הקטגוריה נמחקה'); }, true);
  }

  function reset() {
    P.kit.confirmBox('לחזור לכללי ברירת המחדל?',
      'כל מילות המפתח והקטגוריות שהוספת יימחקו. שיוכים ידניים של תנועות יישמרו.',
      'איפוס', () => { st.resetRules(); P.kit.toast('הכללים אופסו'); }, true);
  }

  return { render: render, title: 'כללי סיווג' };
})();
