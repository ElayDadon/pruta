/* Local-only visual spending atlas. Uses the same filtered transactions as overview. */
window.P = window.P || {};
P.studio = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt;
  function atlas(m) {
    const total = m.cats.reduce((sum, c) => sum + c.sum, 0);
    if (!total) return el('div');
    const top = m.cats.slice(0, 4);
    const rest = m.cats.slice(4).reduce((sum, c) => sum + c.sum, 0);
    const segments = top.concat(rest ? [{cat: 'שאר הקטגוריות', sum: rest, color: 'var(--c-rest)', rest: true}] : []);
    let angle = 0;
    const stops = segments.map(c => { const start = angle; angle += c.sum / total * 360; return `${c.color || P.state.tintOf(c.cat)} ${start}deg ${angle}deg`; });
    const center = el('div.atlas__center', null, [el('small', {text: 'סך ההוצאות'}), el('b.fig', {text: fmt.money(total)}), el('small', {text: fmt.monthName(m.key)})]);
    const ring = el('div.atlas__ring', {'aria-hidden': 'true', style: 'background:conic-gradient(' + stops.join(',') + ')'}, center);
    const legend = el('div.atlas__legend', null, segments.map(c => el('button.atlas__item', {
      type: 'button', onclick: () => c.rest ? P.router.go('#/categories?month=' + m.key) : P.views.category(c.cat, {month: m.key}),
      vars: {'--cat': c.color || P.state.tintOf(c.cat)}
    }, [el('span.atlas__dot'), el('span', {text: c.cat}), el('b.fig', {text: fmt.money(c.sum)}), el('small.fig', {text: Math.round(c.sum / total * 100) + '%'})])));
    const sums = {};
    m.expense.forEach(t => { sums[t.date] = (sums[t.date] || 0) - t.amount; });
    const [y, mo] = m.key.split('-').map(Number);
    const count = new Date(y, mo, 0).getDate(), offset = new Date(y, mo - 1, 1).getDay();
    const max = Math.max(1, ...Object.values(sums));
    const grid = el('div.atlas__calendar', {'aria-label': 'הוצאות לפי יום'});
    ['א','ב','ג','ד','ה','ו','ש'].forEach(d => grid.appendChild(el('span.atlas__weekday', {text:d})));
    for (let i = 0; i < offset; i++) grid.appendChild(el('span'));
    for (let day = 1; day <= count; day++) {
      const date = m.key + '-' + String(day).padStart(2, '0'), value = sums[date] || 0;
      const label = day + '/' + mo + ' · ' + (value ? fmt.money(value) : 'אין הוצאות בדוח');
      grid.appendChild(el('button.atlas__day', {type:'button', title:label, 'aria-label':label, 'data-level': value ? Math.min(4,Math.ceil(value/max*4)) : 0,
        vars:{'--heat':value ? (15 + 70 * value / max) + '%' : '0%'},
        onclick: () => P.ui.dialog({title: label, body: el('div', null, value ? m.expense.filter(t => t.date === date).map(t => el('button.atlas__receipt', { type:'button', onclick:()=>P.views.tx(t.id) }, [el('span', {text:t.desc}), el('b.fig', {text:fmt.money(-t.amount)})])) : el('p', {text:'בדוח שנטען לא מופיעות הוצאות בתאריך הזה.'}))})
      }, String(day)));
    }
    return el('section.atlas', {'aria-label':'מפת ההוצאות החודשית'}, [
      el('div.atlas__head', null, [el('div', null, [el('span.atlas__eyebrow', {text:'התמונה שמאחורי המספרים'}), el('h2', {text:'החודש, בפרוטרוט.'})]), el('a.atlas__badge', {href:'#/categories?month='+m.key}, ['לכל הקטגוריות',P.icons.svg('chevron', 13)])]),
      el('div.atlas__body', null, [el('div.atlas__distribution', null, [ring, legend]), el('div.atlas__activity', null, [el('h3', {text:'קצב ההוצאות'}), el('p', {text:'ככל שהיום כהה יותר, יצא בו יותר. לחיצה מציגה את התנועות.'}), grid, el('div.atlas__heatkey',{'aria-hidden':'true'},[el('span',{text:'מעט'}),[1,2,3,4].map(l=>el('i',{'data-level':l})),el('span',{text:'יותר'})]), el('small.atlas__caption', {text:'לפי הנתונים בדוח · ימים ריקים אינם בהכרח ימים ללא פעילות'})])])
    ]);
  }
  function localGuide() {
    return el('section.local-guide', null, [P.icons.svg('lock', 22), el('div', null, [el('b', {text:'קובץ אחד. המחשב שלך. השקט שלך.'}), el('p', {text:'פותחים, טוענים דוח ומתחילים. ללא הרשמה וללא חיבור לאינטרנט. בגישה ישירה הנתונים נשמרים בדפדפן הזה; כדאי להוריד גיבוי לפני החלפת דפדפן או מחשב.'})]), el('a.btn', {href:'#/settings'}, 'שמירה וגיבוי')]);
  }
  return {atlas, localGuide};
})();
