/* ==========================================================================
   ui/blocks.js — אבני בניין לעמודים: כותרת עמוד, כרטיס, בורר מקטעים,
   משפט מסקנה, ומצב ריק. כל העמודים נבנים מאותם חלקים — וכך נראים אחידים.
   ========================================================================== */
window.P = window.P || {};
P.ui = P.ui || {};

(function () {
  'use strict';
  const el = P.kit.el, ic = P.icons;

  /** כותרת עמוד: כותרת, שורת הסבר ופעולות */
  P.ui.pageHead = function (title, lead, actions) {
    return el('div.page-head', null, [
      el('div.page-head__text', null, [P.premium ? el('span.page-eyebrow', { text: P.premium.eyebrow(P.router.current.shown) }) : null, el('h1', { text: title }), lead ? el('p', null, lead) : null]),
      actions && [].concat(actions).filter(Boolean).length ? el('div.page-head__actions', null, actions) : null
    ]);
  };

  /**
   * כרטיס. opts: { title, note, end: Node[], lead, body: Node|Node[], flush, foot: Node[], cls, id }
   */
  P.ui.card = function (opts) {
    const o = opts || {};
    const head = (o.title || o.end) ? el('div.card__head', null, [
      o.title ? el('h2.card__title', { text: o.title }) : null,
      o.note ? el('span.card__note', { text: o.note }) : null,
      o.end ? el('div.card__end', null, o.end) : null
    ]) : null;
    return el('section.card' + (o.cls ? '.' + o.cls : ''), { id: o.id || null }, [
      head,
      o.lead ? el('div.card__lead', null, o.lead) : null,
      o.body != null ? el('div.card__body' + (o.flush ? '.card__body--flush' : ''), null, o.body) : null,
      o.foot ? el('div.card__foot', null, o.foot) : null
    ]);
  };

  /** בורר מקטעים. items: [[key, label, count?]] */
  P.ui.seg = function (items, current, onPick, opts) {
    const o = opts || {};
    const thumb = el('i.seg__thumb', { 'aria-hidden': 'true' });
    const node = el('div.seg' + (o.lg ? '.seg--lg' : ''), { role: 'group', 'aria-label': o.label || null }, [thumb].concat(items.map(([k, label, count]) =>
      el('button', { type: 'button', 'aria-pressed': k === current ? 'true' : 'false', onclick: () => { if (k !== current) onPick(k); } },
        [label, count != null ? el('span.count', { text: P.fmt.count(count) }) : null]))));
    // הלשונית הלבנה מחליקה מהבחירה הקודמת אל הנוכחית — גם כשהעמוד נבנה מחדש בינתיים
    const key = 'seg:' + ((P.router && P.router.current && P.router.current.shown) || '') + ':' + (o.label || items.map((i) => i[0]).join('|'));
    requestAnimationFrame(() => {
      const btn = node.querySelector('button[aria-pressed="true"]');
      if (!btn || !node.isConnected || !btn.offsetWidth) return;
      thumb.style.left = btn.offsetLeft + 'px';
      thumb.style.width = btn.offsetWidth + 'px';
      node.classList.add('has-thumb');
      P.motion.slide(key, thumb, node);
    });
    return node;
  };

  /** משפט מסקנה מעל גרף: מה רואים כאן, במילים */
  P.ui.takeaway = function (text, icon) {
    if (!text) return null;
    return el('div.takeaway', null, [el('span.takeaway__icon', null, ic.svg(icon || 'spark', 16)), el('p', null, text)]);
  };

  /** מצב ריק עם איור */
  P.ui.empty = function (title, text, actions) {
    return el('div.empty', null, [
      el('div.empty__art', null, P.art.emptyArt()),
      el('b', { text: title }),
      text ? el('p', { text: text }) : null,
      actions ? el('div.row', null, actions) : null
    ]);
  };

  /** תג מסנן פעיל עם כפתור הסרה */
  P.ui.filterChip = function (label, onRemove, opts) {
    const o = opts || {};
    return el('span.fchip', { vars: { '--c': o.color || null } }, [
      o.tile || null,
      el('span', { text: label }),
      el('button', { type: 'button', 'aria-label': 'הסרת הסינון ' + label, title: 'הסרה', onclick: onRemove }, ic.svg('close', 12))
    ]);
  };
})();
