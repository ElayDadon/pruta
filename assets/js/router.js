/* ==========================================================================
   router.js — ניווט פנימי לפי כתובת (#/...). עובד גם בפתיחה ישירה של הקובץ.
   ---------------------------------------------------------------------------
   resolve()  מעבר עמוד: סוגר חלונות, מצייר מחדש עם הנפשת כניסה, גולל למעלה.
   refresh()  אותו עמוד, נתונים חדשים: מצייר מחדש במקום — בלי הנפשה, בלי
              לאבד את מיקום הגלילה ובלי לאבד את הפוקוס בשדה שמקלידים בו.
   כתובות ישנות (#/month/2026-09, #/charts) ממשיכות לעבוד.
   ========================================================================== */
window.P = window.P || {};

P.router = (function () {
  'use strict';
  let mount = null;
  let current = { name: null, shown: null, params: {}, page: null };

  function parse() {
    const raw = (location.hash || '#/').replace(/^#\/?/, '');
    const cut = raw.indexOf('?');
    const path = cut === -1 ? raw : raw.slice(0, cut);
    const query = cut === -1 ? '' : raw.slice(cut + 1);
    const parts = path.split('/').filter(Boolean);
    const params = {};
    query.split('&').forEach((kv) => {
      if (!kv) return;
      const i = kv.indexOf('=');
      const k = i === -1 ? kv : kv.slice(0, i), v = i === -1 ? '' : kv.slice(i + 1);
      try { params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { params[k] = v; }
    });
    let name = parts[0] || 'overview';
    if (name === 'home') name = 'overview';
    if (name === 'charts') name = 'insights';
    if (name === 'month' && parts[1]) { name = 'overview'; params.month = parts[1]; params.open = 'month'; }
    if (!P.pages[name] || name === 'welcome') name = 'overview';
    return { name: name, params: params };
  }

  function draw(isRefresh) {
    const m = parse();
    let page = P.pages[m.name], shown = m.name;
    if (page.needsData && !P.state.data.tx.length) { page = P.pages.welcome; shown = 'welcome'; }
    if (isRefresh && current.shown !== shown) isRefresh = false;        // למשל: ברוכים הבאים -> סקירה
    if (current.page && current.page !== page && current.page.leave) current.page.leave();
    current = { name: m.name, shown: shown, params: m.params, page: page };

    const y = window.scrollY;
    const focus = isRefresh ? P.layers.rememberFocus(mount) : null;
    P.kit.tip(null);
    mount.innerHTML = '';
    mount.classList.remove('view-enter', 'view-stagger');
    mount.setAttribute('data-page', shown);
    try {
      page.render(m.params, mount, { refresh: !!isRefresh });
      // בתוך "לחקור": פס לשוניות קטן בראש העמוד, כדי לעבור בין החלקים בלי לחזור
      if (inExplore(shown)) {
        const xnav = mount.insertBefore(P.pages.explore.nav(shown), mount.firstChild);
        // בטלפון הלשוניות גוללות הצידה: הלשונית הפעילה נכנסת למבט (רק בכניסה לעמוד — אז הוא בראש המסך)
        if (!isRefresh) requestAnimationFrame(() => { const a = xnav.querySelector('[aria-current="page"]'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'center' }); });
      }
    } catch (e) {
      console.error(e);
      mount.appendChild(P.ui.card({ body: P.ui.empty('משהו השתבש בעמוד הזה', String(e && e.message ? e.message : e), [
        P.kit.el('button.btn', { type: 'button', onclick: () => go('#/') }, 'חזרה לסקירה')]) }));
    }

    if (isRefresh) {
      // רענון של אותו עמוד: מה שכבר נראה לא נכנס שוב בהנפשה
      mount.querySelectorAll('[data-reveal]').forEach((n) => n.classList.add('is-in', 'is-still'));
      window.scrollTo(0, y);
      focus();
    } else {
      void mount.offsetWidth;
      // עם View Transitions הדפדפן מחליף את אזור התוכן בעצמו; בלעדיו — הדף "מתהפך" כמו קודם
      mount.classList.add(typeof document.startViewTransition === 'function' && !P.motion.reduced() ? 'view-stagger' : 'view-enter');
      Array.prototype.forEach.call(mount.children, (c, i) => c.style.setProperty('--step', Math.min(i, 6)));
      window.scrollTo(0, 0);
      if (m.params.open === 'month' && shown === 'overview') setTimeout(() => P.views.month(m.params.month), 250);
    }
    P.motion.reveal(mount);
    mark(m.name);
    document.title = (page.title ? page.title + ' · ' : '') + 'פרוטה';
  }

  /** העמודים שבתוך "לחקור": בניווט מסומן "לחקור", ומתחתיו החלק עצמו */
  const inExplore = (name) => !!(P.pages.explore && P.pages.explore.ROUTES.indexOf(name) !== -1);
  const navOf = (name) => (inExplore(name) ? 'explore' : name);

  /** סימון העמוד הפעיל בסרגל הצד ובסרגל התחתון */
  function mark(name) {
    if (P.premium) P.premium.workspace(current.shown || name);
    const top = navOf(name);
    document.querySelectorAll('[data-route]').forEach((a) => {
      if (a.getAttribute('data-route') === top) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-sub]').forEach((a) => {
      if (a.getAttribute('data-sub') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const more = document.querySelector('[data-more]');
    if (more) { if (['assign', 'rules', 'settings', 'about'].indexOf(name) !== -1) more.setAttribute('aria-current', 'page'); else more.removeAttribute('aria-current'); }
    // המשבצת שמסמנת את העמוד הפעיל מחליקה אל הקישור החדש
    const side = document.getElementById('side');
    if (side) side.classList.toggle('in-explore', top === 'explore');
    const pill = side && side.querySelector('.side__pill');
    if (pill) {
      side.classList.add('has-pill');
      // אחרי שהחלקים של "לחקור" נפתחו או נסגרו — הקישורים כבר במקומם החדש
      requestAnimationFrame(() => {
        const cur = side.querySelector('.navlink[aria-current="page"]');
        if (cur) { pill.style.setProperty('--y', cur.offsetTop + 'px'); pill.classList.add('is-on'); } else pill.classList.remove('is-on');
        requestAnimationFrame(() => pill.classList.remove('is-instant'));
      });
    }
  }

  /** opts.instant: בלי מעבר מונפש (למשל כשמסך מלא עומד לכסות את העמוד בכל מקרה) */
  function resolve(opts) {
    if (P.ui.popover) P.ui.popover.close();
    P.layers.dismissAll();
    if ((opts && opts.instant === true) || (P.fx && P.fx.isActive())) draw(false);
    else P.motion.transition(() => draw(false));
  }
  function refresh() {
    if (!mount || !current.page) return;
    if (P.ui.popover && P.ui.popover.isOpen()) { /* החלונית נשארת; העמוד שמאחוריה מתעדכן */ }
    draw(true);
  }

  /** מעבר עמוד מכל מקום — גם כשחלונות פתוחים */
  function go(hash) { P.layers.navigate(hash); }

  function start(mountEl) {
    mount = mountEl;
    window.addEventListener('hashchange', () => resolve());
    // קישור פנימי שנלחץ כשחלון פתוח: קודם מקפלים את החלונות, ואז עוברים
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href^="#/"]') : null;
      if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      const hash = a.getAttribute('href');
      if (P.layers.count()) { e.preventDefault(); P.layers.navigate(hash); }
      else if (location.hash === hash || (hash === '#/' && !location.hash)) { e.preventDefault(); resolve(); }
    });
    draw(false);
  }

  return { start, go, resolve, refresh, mark, get current() { return current; } };
})();
