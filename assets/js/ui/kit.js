/* ==========================================================================
   ui/kit.js — כלים קטנים: בניית אלמנטים, הודעות עם "ביטול", תזכיר ריחוף,
   ספירה עולה של מספרים, הורדת קבצים.
   ========================================================================== */
window.P = window.P || {};

P.kit = (function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /** el('div.a.b', {attrs}, [children|string|null]) */
  function el(spec, attrs, kids) {
    const parts = String(spec).split('.');
    const node = document.createElement(parts.shift() || 'div');
    if (parts.length) node.className = parts.join(' ');
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = (node.className ? node.className + ' ' : '') + v;
      else if (k === 'style' && typeof v === 'string') node.style.cssText += ';' + v;     // מוסיף, לא דורס — כך vars ו-style חיים יחד בכל סדר
      else if (k === 'vars') { for (const n in v) if (v[n] != null) node.style.setProperty(n, v[n]); }
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    append(node, kids);
    return node;
  }
  function append(node, kids) {
    if (kids == null) return node;
    (Array.isArray(kids) ? kids : [kids]).forEach((c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) return append(node, c);
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }
  const txt = (s) => document.createTextNode(s == null ? '' : String(s));

  /* ---------- הודעות צפות ---------- */
  let toastHost = null;
  /**
   * toast('נשמר') או toast('3 תנועות שויכו', { undo: fn, actions: [{label, run}], icon, duration })
   */
  function toast(msg, opts) {
    const o = opts || {};
    if (!toastHost) { toastHost = el('div.toasts', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastHost); }
    while (toastHost.children.length > 2) toastHost.firstChild.remove();
    const actions = (o.actions || []).slice();
    if (o.undo) actions.push({ label: 'ביטול', run: o.undo });
    let timer;
    const node = el('div.toast', null, [
      P.icons ? P.icons.svg(o.icon || 'check', 18) : null,
      el('div.toast__msg', { text: msg }),
      actions.map((a) => el('button.toast__act', { type: 'button', onclick: () => { close(); a.run(); } }, a.label))
    ]);
    function close() { clearTimeout(timer); node.classList.remove('is-on'); node.style.opacity = '0'; setTimeout(() => node.remove(), 200); }
    toastHost.appendChild(node);
    requestAnimationFrame(() => node.classList.add('is-on'));
    timer = setTimeout(close, o.duration || (actions.length ? 7000 : 3600));
    node.addEventListener('mouseenter', () => clearTimeout(timer));
    node.addEventListener('mouseleave', () => { timer = setTimeout(close, 2400); });
    return close;
  }

  /* ---------- תזכיר ריחוף משותף לגרפים ---------- */
  let tipEl = null;
  function tip(html, x, y) {
    if (!tipEl) { tipEl = el('div.tip', { role: 'presentation' }); document.body.appendChild(tipEl); }
    if (html == null) { tipEl.classList.remove('is-on'); return; }
    tipEl.innerHTML = html;
    tipEl.classList.add('is-on');
    const r = tipEl.getBoundingClientRect();
    let left = Math.max(8, Math.min(x - r.width / 2, window.innerWidth - r.width - 8));
    let top = y - r.height - 14;
    if (top < 8) top = y + 18;
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }
  function bindTip(node, htmlFn) {
    node.addEventListener('mousemove', (e) => tip(htmlFn(), e.clientX, e.clientY));
    node.addEventListener('mouseleave', () => tip(null));
    node.addEventListener('focus', () => { const r = node.getBoundingClientRect(); tip(htmlFn(), r.left + r.width / 2, r.top); });
    node.addEventListener('blur', () => tip(null));
  }

  /* ---------- ספירה עולה ---------- */
  function countUp(node, to, format, ms) {
    const f = format || ((v) => String(Math.round(v)));
    if (reduced() || !isFinite(to)) { node.textContent = f(to); return; }
    const dur = ms || 900, t0 = performance.now();
    node.textContent = f(0);
    function step(t) {
      const p = Math.max(0, Math.min(1, (t - t0) / dur));      // הפריים הראשון יכול להגיע עם זמן מוקדם ברגע מ-t0
      const e = 1 - Math.pow(1 - p, 4);
      node.textContent = f(to * e);
      if (p < 1 && node.isConnected) requestAnimationFrame(step);
      else node.textContent = f(to);
    }
    requestAnimationFrame(step);
  }

  /* ---------- שונות ---------- */
  function download(blob, name) {
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  function debounce(fn, ms) { let t; return function () { const args = arguments, self = this; clearTimeout(t); t = setTimeout(() => fn.apply(self, args), ms); }; }
  function onActivate(node, fn) {
    node.addEventListener('click', fn);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } });
    return node;
  }

  /* ---------- תאימות לאחור: חלון ואישור ---------- */
  function modal(title, bodyNode, actions, opts) {
    const o = opts || {};
    return P.ui.dialog({ title: title, subtitle: o.subtitle, body: bodyNode, actions: actions, wide: o.wide, flush: o.flush, headExtra: o.headExtra, foot: o.foot, onClose: o.onClose });
  }
  function confirmBox(title, message, confirmLabel, onConfirm, danger) {
    let d;
    const ok = el('button.btn' + (danger ? '.btn--danger' : '.btn--primary'), { type: 'button', onclick: () => { d.close(); onConfirm(); } }, confirmLabel);
    const cancel = el('button.btn.btn--ghost', { type: 'button', onclick: () => d.close() }, 'ביטול');
    d = P.ui.dialog({ title: title, body: el('p.muted', { style: 'margin:0', text: message }), foot: [ok, cancel], size: 'sm' });
    return d;
  }

  return { $, $$, el, append, txt, toast, tip, bindTip, countUp, download, debounce, onActivate, modal, confirmBox, reduced };
})();
