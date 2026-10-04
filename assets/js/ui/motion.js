/* ==========================================================================
   ui/motion.js — מנוע התנועה
   ---------------------------------------------------------------------------
   עיקרון אחד: שום דבר לא "קופץ". דברים נכנסים, יוצאים, מתגלגלים או משנים צורה —
   ותמיד מאותו מקום שאליו העין כבר מסתכלת.

   timeline()   ציר זמן אחד לכל רצף: כל ההנפשות נרשמות עם זמן התחלה מוחלט,
                ולכן נשארות מסונכרנות, ואפשר לדלג לסוף בבת אחת.
   morph()      אלמנט אחד "הופך" לאחר (כרטיס חודש -> ראש החלון שנפתח ממנו).
   slide()      סימון שמחליק ממקומו הקודם (לשונית פעילה, בורר מקטעים).
   reveal()     בלוקים שנכנסים כשגוללים אליהם.
   tilt()       כרטיס שנוטה אחרי הסמן, עם ברק.
   countTo()    מספר שרץ לערכו.

   מי שביקש במערכת ההפעלה "הפחתת תנועה" מקבל את המצב הסופי מיד, בלי הנפשה.
   ========================================================================== */
window.P = window.P || {};

P.motion = (function () {
  'use strict';
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.hasAttribute('data-still');

  const ease = {
    out: 'cubic-bezier(.16, 1, .3, 1)',            // כניסה: מהיר ואז נרגע
    inOut: 'cubic-bezier(.65, 0, .35, 1)',         // מעבר ממקום למקום
    in: 'cubic-bezier(.5, 0, .9, .4)',             // יציאה
    back: 'cubic-bezier(.34, 1.56, .64, 1)',       // קפיצה קטנה מעבר ליעד
    // נחיתה של מטבע: שלוש קפיצות הולכות וקטנות
    bounce: 'linear(0, .004, .016, .035, .063, .098, .141, .191, .25, .316, .391, .473, .563, .66, .766, .879, 1, .957, .922, .895, .875, .863, .859, .863, .875, .895, .922, .957, 1, .988, .984, .988, 1)',
    spring: 'linear(0, .009, .035 2.1%, .141, .281 6.7%, .723 12.9%, .938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, .991, .977 51%, .974 53.8%, .975 57.1%, .997 69.8%, 1.003 76.9%, 1.004 83.8%, 1)'
  };
  // דפדפן ישן שלא מכיר linear(): נופל חזרה לעקומה רגילה
  const canLinear = !!(window.CSS && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)'));
  const E = (name) => ((name === 'bounce' || name === 'spring') && !canLinear ? ease.back : (ease[name] || name || ease.out));

  /* ======================================================================
     ציר זמן
     ====================================================================== */
  function timeline() {
    const anims = [], calls = [], timers = [];
    const seen = new WeakSet();
    let total = 0, started = false, done = false, resolveDone;
    const finished = new Promise((r) => { resolveDone = r; });

    /** el.animate עם זמן התחלה מוחלט (at) במילישניות */
    function add(node, keyframes, opts) {
      if (!node) return api;
      const o = Object.assign({ at: 0, duration: 600, easing: 'out' }, opts);
      // ההנפשה הראשונה של אלמנט קובעת גם את מצבו לפני שהתחילה (both). הבאות אחריה
      // רק "מחזיקות" את הסוף (forwards) — אחרת המצב ההתחלתי של האחרונה היה דורס את כל מה שלפניה.
      const fill = o.fill || (seen.has(node) ? 'forwards' : 'both');
      seen.add(node);
      const a = node.animate(keyframes, { delay: o.at, duration: o.duration, easing: E(o.easing), fill: fill, iterations: o.iterations || 1, direction: o.direction || 'normal' });
      a.pause();
      anims.push(a);
      if (o.iterations !== Infinity) total = Math.max(total, o.at + o.duration);
      return api;
    }
    /** אותה הנפשה לקבוצת אלמנטים, עם השהיה מדורגת */
    function stagger(nodes, keyframes, opts) {
      const o = Object.assign({ at: 0, each: 60 }, opts);
      Array.prototype.forEach.call(nodes, (n, i) => add(n, typeof keyframes === 'function' ? keyframes(n, i) : keyframes, Object.assign({}, o, { at: o.at + i * o.each })));
      return api;
    }
    function call(at, fn) { calls.push({ at: at, fn: fn, ran: false }); total = Math.max(total, at); return api; }
    function play() {
      if (started) return finished;
      started = true;
      const t0 = document.timeline.currentTime;
      anims.forEach((a) => { a.play(); try { a.startTime = t0; } catch (e) { /* דפדפן ישן */ } });   // כולן מאותו רגע בדיוק
      calls.forEach((c) => timers.push(setTimeout(() => { if (!c.ran && !done) { c.ran = true; c.fn(); } }, c.at)));
      timers.push(setTimeout(end, total + 30));
      return finished;
    }
    function end() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      resolveDone();
    }
    /** קפיצה לסוף: כל ההנפשות במצב הסופי, וכל הקריאות שעוד לא רצו — רצות */
    function finish() {
      if (done) return;
      anims.forEach((a) => { try { a.finish(); } catch (e) { /* אינסופית */ a.cancel(); } });
      calls.forEach((c) => { if (!c.ran) { c.ran = true; try { c.fn(); } catch (e) { console.error(e); } } });
      end();
    }
    function cancel() { anims.forEach((a) => a.cancel()); end(); }
    const api = { add, stagger, call, play, finish, cancel, finished, get duration() { return total; } };
    return api;
  }

  /* ======================================================================
     שינוי צורה בין שני אלמנטים (FLIP עם "רוח רפאים")
     ====================================================================== */
  /**
   * משכפל את from, מניח אותו בדיוק מעליו, ומנפיש אותו אל המלבן של to.
   * to מוסתר עד שהשכפול מגיע. מחזיר Promise.
   */
  function morph(from, to, opts) {
    const o = Object.assign({ duration: 520, easing: 'inOut', radius: null }, opts);
    if (reduced() || !from || !to || !from.isConnected || !to.isConnected) return Promise.resolve();
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve();
    const ghost = from.cloneNode(true);
    const cs = getComputedStyle(from), ct = getComputedStyle(to);
    ghost.removeAttribute('id');
    ghost.style.cssText += ';position:fixed;margin:0;z-index:400;pointer-events:none;left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;height:' + a.height +
      'px;border-radius:' + cs.borderRadius + ';overflow:hidden;contain:layout paint';
    document.body.appendChild(ghost);
    const prevTo = to.style.visibility, prevFrom = from.style.visibility;
    to.style.visibility = 'hidden';
    from.style.visibility = 'hidden';
    // מנפישים רוחב וגובה אמיתיים (ולא scale): כך צילום ב-object-fit נחתך מחדש בכל פריים ולא נמתח,
    // והפריים האחרון זהה בדיוק לאלמנט היעד.
    const anim = ghost.animate([
      { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', borderRadius: cs.borderRadius },
      { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', borderRadius: o.radius || ct.borderRadius }
    ], { duration: o.duration, easing: E(o.easing), fill: 'forwards' });
    // חלקים שקיימים רק במקור (למשל שם החודש על הכרטיס) מתעמעמים בדרך
    if (o.fade) ghost.querySelectorAll(o.fade).forEach((n) => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: o.duration * 0.55, fill: 'forwards' }));
    return anim.finished.catch(() => {}).then(() => {
      to.style.visibility = prevTo;
      const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' });
      return fade.finished.catch(() => {}).then(() => { ghost.remove(); from.style.visibility = prevFrom; });
    });
  }

  /* ======================================================================
     סימון שמחליק: זוכר איפה היה בפעם הקודמת (גם אם ה-DOM נבנה מחדש)
     ====================================================================== */
  const lastRect = {};
  /**
   * key: מזהה יציב של הסימון. node: האלמנט המסומן עכשיו. host: ההורה שביחס אליו מודדים.
   * מנפיש את node מהמלבן הקודם שנשמר תחת אותו key אל המקום הנוכחי.
   */
  function slide(key, node, host) {
    if (!node || !host) return;
    const h = host.getBoundingClientRect(), r = node.getBoundingClientRect();
    const now = { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height };
    const was = lastRect[key];
    lastRect[key] = now;
    if (!was || reduced() || !now.w || (Math.abs(was.x - now.x) < 1 && Math.abs(was.y - now.y) < 1 && Math.abs(was.w - now.w) < 1)) return;
    node.animate([
      { transform: 'translate(' + (was.x - now.x) + 'px,' + (was.y - now.y) + 'px) scale(' + (was.w / now.w) + ',' + (was.h / now.h) + ')' },
      { transform: 'none' }
    ], { duration: 420, easing: ease.out });
  }

  /* ======================================================================
     כניסה בגלילה
     ====================================================================== */
  let io = null;
  function reveal(root) {
    const nodes = (root || document).querySelectorAll('[data-reveal]:not(.is-in)');
    if (!nodes.length) return;
    if (reduced() || typeof IntersectionObserver !== 'function') { nodes.forEach((n) => n.classList.add('is-in', 'is-still')); return; }
    if (!io) io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    // ההשהיה המדורגת נספרת בתוך כל שורה של אלמנטים שנכנסים יחד, לא לאורך כל העמוד
    const seenRows = {};
    nodes.forEach((n) => { const row = Math.round(n.getBoundingClientRect().top / 40); seenRows[row] = (seenRows[row] || 0) + 1; n.style.setProperty('--ri', String(Math.min(seenRows[row] - 1, 6))); io.observe(n); });
  }

  /* ======================================================================
     הטיה אחרי הסמן
     ====================================================================== */
  function tilt(node, opts) {
    const o = Object.assign({ max: 7, lift: 6, glare: true }, opts);
    if (reduced() || !node || (window.matchMedia && window.matchMedia('(hover: none)').matches)) return node;
    let raf = 0;
    node.classList.add('tilt');
    if (o.glare && !node.querySelector('.tilt__glare')) node.appendChild(P.kit.el('span.tilt__glare', { 'aria-hidden': 'true' }));
    node.addEventListener('pointermove', (e) => {
      const r = node.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        node.style.setProperty('--rx', (-py * o.max).toFixed(2) + 'deg');
        node.style.setProperty('--ry', (px * o.max).toFixed(2) + 'deg');
        node.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
        node.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
        node.style.setProperty('--lift', o.lift + 'px');
      });
    });
    node.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      node.style.setProperty('--rx', '0deg'); node.style.setProperty('--ry', '0deg'); node.style.setProperty('--lift', '0px');
    });
    return node;
  }

  /* ======================================================================
     מספר שרץ לערכו
     ====================================================================== */
  function countTo(node, to, format, ms, from) {
    const f = format || ((v) => String(Math.round(v)));
    const start = from || 0;
    if (reduced() || !isFinite(to)) { node.textContent = f(to); return Promise.resolve(); }
    return new Promise((resolve) => {
      const dur = ms || 900, t0 = performance.now();
      (function step(t) {
        const p = Math.max(0, Math.min(1, (t - t0) / dur));    // הפריים הראשון יכול להגיע עם זמן מוקדם ברגע מ-t0
        const e = 1 - Math.pow(1 - p, 4);
        node.textContent = f(start + (to - start) * e);
        if (p < 1 && node.isConnected) requestAnimationFrame(step); else { node.textContent = f(to); resolve(); }
      })(t0);
    });
  }

  /** מעבר עמוד חלק (View Transitions) כשהדפדפן תומך; אחרת — פשוט מריץ */
  function transition(fn) {
    if (reduced() || typeof document.startViewTransition !== 'function') { fn(); return Promise.resolve(); }
    try {
      const vt = document.startViewTransition(() => { fn(); });
      return vt.finished.catch(() => {});
    } catch (e) { fn(); return Promise.resolve(); }
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

  return { reduced, ease, E, timeline, morph, slide, reveal, tilt, countTo, transition, wait };
})();
