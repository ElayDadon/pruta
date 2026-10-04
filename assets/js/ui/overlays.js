/* ==========================================================================
   ui/overlays.js — כל החלונות שנפתחים מעל העמוד
   ---------------------------------------------------------------------------
   P.layers      מחסנית שכבות: גיליון מעל גיליון, חלון מעל גיליון.
                 כפתור "אחורה" של הדפדפן סוגר את השכבה העליונה — כמו באפליקציה.
   P.ui.sheet    גיליון צד (בטלפון: גיליון תחתון)
   P.ui.dialog   חלון מרכזי
   P.ui.popover  חלונית קטנה ליד כפתור (בטלפון: גיליון תחתון)
   ========================================================================== */
window.P = window.P || {};
P.ui = P.ui || {};

P.layers = (function () {
  'use strict';
  const el = P.kit.el;
  const stack = [];
  let host = null, veil = null, pendingNav = null, navTimer = 0;

  function ensure() {
    if (host) return host;
    host = el('div.layers');
    veil = el('div.veil', { onclick: () => close(top()) });
    host.appendChild(veil);
    document.body.appendChild(host);
    return host;
  }
  const top = () => stack[stack.length - 1] || null;

  function sync() {
    const n = stack.length;
    document.documentElement.classList.toggle('has-layer', n > 0);
    if (veil) veil.classList.toggle('is-on', n > 0);
    stack.forEach((l, i) => {
      const under = i < n - 1;
      l.node.classList.toggle('is-under', under);
      if (under) l.node.setAttribute('inert', ''); else l.node.removeAttribute('inert');
      l.node.style.zIndex = String(10 + i);
    });
  }

  /** layer = { node, onClose, refresh } */
  function open(layer) {
    ensure();
    layer.opener = document.activeElement;
    layer.pushed = false;
    layer.closing = false;
    host.appendChild(layer.node);
    stack.push(layer);
    sync();
    requestAnimationFrame(() => requestAnimationFrame(() => layer.node.classList.add('is-open')));
    try { history.pushState({ pruta: stack.length }, ''); layer.pushed = true; } catch (e) { layer.pushed = false; }
    setTimeout(() => focusFirst(layer.node), 60);
    return layer;
  }

  /** סגירה מבוקשת (כפתור, רקע, Esc): אם השכבה רשומה בהיסטוריה — דרך "אחורה" */
  function close(layer) {
    if (!layer || layer.closing) return;
    if (layer === top() && layer.pushed && history.state && history.state.pruta === stack.length) {
      layer.closing = true;
      history.back();
      return;
    }
    finish(layer);
  }

  function finish(layer) {
    const i = stack.indexOf(layer);
    if (i === -1) return;
    stack.splice(i, 1);
    layer.closing = true;
    layer.node.classList.remove('is-open', 'is-under');
    layer.node.classList.add('is-closing');
    setTimeout(() => layer.node.remove(), 320);
    sync();
    if (layer.onClose) { try { layer.onClose(); } catch (e) { console.error(e); } }
    const op = layer.opener;
    if (op && op.isConnected && typeof op.focus === 'function' && !stack.length) op.focus({ preventScroll: true });
    else if (stack.length) focusFirst(top().node);
  }

  /** סגירה של הכל בלי לגעת בהיסטוריה (למשל כשעוברים עמוד) */
  function dismissAll() { while (stack.length) finish(top()); }

  /**
   * מעבר עמוד כשיש חלונות פתוחים: קודם מקפלים את ההיסטוריה שלהם, ואז עוברים.
   * בכל רגע יש לכל היותר תנועה אחת בהיסטוריה "בדרך": אם חלון כבר ביקש להיסגר,
   * מחכים ל"אחורה" שלו ולא מוסיפים עוד אחד — אחרת היינו חוזרים צעד אחד יותר מדי,
   * והעמוד הקודם היה נעלם מההיסטוריה.
   */
  function navigate(hash) {
    const depth = (history.state && history.state.pruta) || 0;
    if (depth > 0 && stack.some((l) => l.pushed)) {
      const waiting = stack.some((l) => l.pushed && l.closing);
      pendingNav = hash;
      if (!waiting) history.go(-depth);
      // רשת ביטחון: אם הדפדפן לא חזר אחורה משום מה, לא נשארים תקועים עם חלון פתוח
      clearTimeout(navTimer);
      navTimer = setTimeout(() => { if (pendingNav) { dismissAll(); runPending(); } }, 1500);
      return;
    }
    dismissAll();
    go(hash);
  }
  const go = (hash) => { if (location.hash === hash) P.router.resolve(); else location.hash = hash; };
  function runPending() {
    const h = pendingNav; pendingNav = null;
    clearTimeout(navTimer);
    if (h) setTimeout(() => go(h), 0);
  }

  window.addEventListener('popstate', (e) => {
    const depth = (e.state && e.state.pruta) || 0;
    while (stack.length > depth) finish(top());
    if (pendingNav) {
      if (depth > 0) { history.go(-depth); return; }       // עוד רשומות של חלונות מתחת: ממשיכים לקפל
      dismissAll();
      runPending();
      return;
    }
    // חלון שביקש להיסגר ועדיין כאן: נחתנו על רשומה ישנה באותו עומק. הוא נסגר בכל מקרה.
    stack.filter((l) => l.closing).forEach(finish);
    // רשומה של חלון שכבר לא קיים (אחרי "קדימה", או אחרי רענון): יורדים ממנה, כדי ש"אחורה" הבא יעבוד כרגיל
    if (depth > stack.length) history.go(stack.length - depth);
  });
  // רענון הדף כשחלון היה פתוח משאיר את הסימון שלו על הרשומה הנוכחית. מנקים, כי החלון כבר איננו.
  try { if (history.state && history.state.pruta) history.replaceState(null, ''); } catch (e) { /* לא קריטי */ }

  document.addEventListener('keydown', (e) => {
    if (!stack.length) return;
    if (e.key === 'Escape') {
      if (P.ui.popover && P.ui.popover.isOpen()) return;
      e.preventDefault(); close(top());
    } else if (e.key === 'Tab') trap(e, top().node);
  });

  function focusables(node) {
    return Array.prototype.filter.call(
      node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'),
      (n) => n.offsetParent !== null || n === document.activeElement);
  }
  function focusFirst(node) {
    if (!node || !node.isConnected) return;
    const auto = node.querySelector('[autofocus]');
    const target = auto || node.querySelector('.sheet__close, .dialog__close') || focusables(node)[0];
    if (target) target.focus({ preventScroll: true });
  }
  function trap(e, node) {
    const items = focusables(node);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /**
   * שמירת פוקוס לאורך רענון: שדה עם data-fk שהיה בפוקוס יקבל אותו שוב
   * אחרי שהתוכן נבנה מחדש (למשל שדה "מילה חדשה" אחרי אנטר).
   */
  function rememberFocus(root) {
    const ae = document.activeElement;
    const fk = ae && root.contains(ae) ? ae.getAttribute('data-fk') : null;
    if (!fk) return () => {};
    let pos = null;
    try { pos = typeof ae.selectionStart === 'number' ? ae.selectionStart : null; } catch (e) { pos = null; }
    return function () {
      const n = root.querySelector('[data-fk="' + (window.CSS && CSS.escape ? CSS.escape(fk) : fk) + '"]');
      if (!n) return;
      n.focus({ preventScroll: true });
      if (pos != null && n.setSelectionRange) { try { const p = Math.min(pos, (n.value || '').length); n.setSelectionRange(p, p); } catch (e) { /* סוג שדה בלי בחירה */ } }
    };
  }

  /** רענון כל השכבות הפתוחות אחרי שינוי בנתונים */
  function refreshAll() { stack.forEach((l) => { if (l.refresh) { try { l.refresh(); } catch (e) { console.error(e); } } }); }

  return { open, close, finish, dismissAll, navigate, refreshAll, rememberFocus, top, count: () => stack.length };
})();

/* ==========================================================================
   גיליון צד
   opts: { title, size: 'sm'|'md'|'lg', render(body, api), foot(api) -> Node[], headEnd -> Node[], onClose }
   ========================================================================== */
P.ui.sheet = function (opts) {
  'use strict';
  const el = P.kit.el, ic = P.icons;
  const o = opts || {};
  const titleEl = el('div.sheet__title', { text: o.title || '' });
  const head = el('div.sheet__head', null, [
    el('button.sheet__close', { type: 'button', 'aria-label': 'סגירה', title: 'סגירה (Esc)', onclick: () => api.close() }, ic.svg('close', 18)),
    titleEl,
    el('div.sheet__headend')
  ]);
  const body = el('div.sheet__body');
  const footWrap = el('div.sheet__foot', { hidden: true });
  const morph = o.morphFrom && o.morphFrom.isConnected && !P.motion.reduced() ? o.morphFrom : null;
  const node = el('section.sheet.sheet--' + (o.size || 'md') + (morph ? '.sheet--morph' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || '' }, [head, body, footWrap]);

  body.addEventListener('scroll', () => head.classList.toggle('is-stuck', body.scrollTop > 40), { passive: true });

  const api = {
    node: node, body: body,
    close: () => P.layers.close(layer),
    setTitle: (t) => { titleEl.textContent = t; node.setAttribute('aria-label', t); },
    refresh: draw
  };
  function draw() {
    const keep = body.scrollTop;
    const focus = P.layers.rememberFocus(body);
    body.innerHTML = '';
    if (o.render) o.render(body, api);
    const headEnd = head.querySelector('.sheet__headend');
    headEnd.innerHTML = '';
    if (o.headEnd) P.kit.append(headEnd, o.headEnd(api));
    footWrap.innerHTML = '';
    const f = o.foot ? o.foot(api) : null;
    footWrap.hidden = !f || (Array.isArray(f) && !f.filter(Boolean).length);
    if (f) P.kit.append(footWrap, f);
    body.scrollTop = keep;
    focus();
  }
  api.first = true;
  node.classList.add('is-fresh');            // כניסה מדורגת של השורות — רק בפתיחה, לא בכל רענון
  draw();
  api.first = false;
  setTimeout(() => node.classList.remove('is-fresh'), 1400);
  const layer = { node: node, onClose: o.onClose, refresh: draw, kind: 'sheet' };
  P.layers.open(layer);
  // נפתח "מתוך" אלמנט: התמונה שלו עפה אל המקום המקביל בראש החלון
  if (morph) {
    const target = body.querySelector('[data-morph-target]');
    if (target) P.motion.morph(morph, target, { duration: 560, fade: '.poster__label' });
  }
  return api;
};

/* ==========================================================================
   חלון מרכזי
   opts: { title, subtitle, body: Node, actions: Node[], foot: Node|Node[], size: 'sm'|'md'|'wide',
           wide, flush, art: Node, center, headExtra: Node, onClose }
   ========================================================================== */
P.ui.dialog = function (opts) {
  'use strict';
  const el = P.kit.el, ic = P.icons;
  const o = opts || {};
  const size = o.wide ? 'wide' : (o.size || 'md');
  const node = el('section.dialog' + (size !== 'md' ? '.dialog--' + size : '') + (o.center ? '.dialog--center' : ''),
    { role: o.alert ? 'alertdialog' : 'dialog', 'aria-modal': 'true', 'aria-label': o.title || '' }, [
    o.art ? el('div.dialog__art', null, o.art) : null,
    el('div.dialog__head', null, [
      el('div.dialog__titles', null, [
        o.title ? el('h2.dialog__title', { text: o.title }) : null,
        o.subtitle ? el('div.dialog__sub', { text: o.subtitle }) : null
      ]),
      o.headExtra || null,
      o.center ? null : el('button.btn.btn--ghost.btn--icon.dialog__close', { type: 'button', 'aria-label': 'סגירה', onclick: () => api.close() }, ic.svg('close', 18))
    ]),
    el('div.dialog__body' + (o.flush ? '.dialog__body--flush' : ''), null, [
      o.body || null,
      o.actions ? el('div.row', { style: 'margin-top:20px' }, o.actions) : null
    ]),
    o.foot ? el('div.dialog__foot', null, o.foot) : null
  ]);
  const layer = { node: node, onClose: o.onClose, kind: 'dialog' };
  const api = { node: node, close: () => P.layers.close(layer) };
  P.layers.open(layer);
  return api;
};

/* ==========================================================================
   חלונית צפה — לא נרשמת בהיסטוריה; נסגרת בלחיצה בחוץ, Esc או גלילה
   opts: { width, render(body, api), placement: 'below'|'above', onClose }
   ========================================================================== */
P.ui.popover = (function () {
  'use strict';
  const el = P.kit.el;
  let current = null;

  function open(anchor, opts) {
    close();
    const o = opts || {};
    const node = el('div.pop', { role: 'dialog' });
    if (o.width) node.style.setProperty('--w', o.width + 'px');
    const api = { node: node, close: close, anchor: anchor };
    if (o.render) o.render(node, api);
    document.body.appendChild(node);
    place(node, anchor, o);
    current = { node: node, onClose: o.onClose, anchor: anchor };
    requestAnimationFrame(() => node.classList.add('is-open'));
    setTimeout(() => {
      document.addEventListener('pointerdown', outside, true);
      window.addEventListener('resize', close);
      window.addEventListener('scroll', onScroll, true);
      const f = node.querySelector('[autofocus], input, button');
      if (f) f.focus({ preventScroll: true });
    }, 0);
    return api;
  }
  function place(node, anchor, o) {
    if (window.innerWidth <= 720) return;               // בטלפון: CSS מצמיד לתחתית
    const r = anchor.getBoundingClientRect();
    const w = node.offsetWidth, h = node.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    // מיושר לקצה הימני של העוגן (התחלה בעברית)
    let left = r.right - w;
    left = Math.max(10, Math.min(left, vw - w - 10));
    let topPos = r.bottom + 8, oy = '0%';
    if (o.placement === 'above' || (topPos + h > vh - 10 && r.top - h - 8 > 10)) { topPos = r.top - h - 8; oy = '100%'; }
    topPos = Math.max(10, Math.min(topPos, vh - h - 10));
    node.style.left = left + 'px';
    node.style.top = topPos + 'px';
    node.style.setProperty('--ox', Math.round(((r.left + r.width / 2) - left) / w * 100) + '%');
    node.style.setProperty('--oy', oy);
  }
  function outside(e) { if (current && !current.node.contains(e.target) && !current.anchor.contains(e.target)) close(); }
  function onScroll(e) { if (current && !current.node.contains(e.target)) close(); }
  function close() {
    if (!current) return;
    const c = current; current = null;
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', onScroll, true);
    c.node.classList.remove('is-open'); c.node.classList.add('is-closing');
    setTimeout(() => c.node.remove(), 160);
    if (c.onClose) c.onClose();
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) { e.preventDefault(); const a = current.anchor; close(); if (a && a.focus) a.focus(); } });

  open.close = close;
  open.isOpen = () => !!current;
  return open;
})();
