/* ==========================================================================
   boot.js — רץ בראש הדף, לפני הציור הראשון.
   מחיל את הצבע והמצב (בהיר/כהה) שנבחרו, כדי שלא יהבהב צבע אחר; ואם הפתיח עומד
   לרוץ — המסך מתחיל כהה, כדי שהאתר לא יהבהב לפניו.
   קובץ נפרד ולא סקריפט בתוך הדף, כדי שמדיניות האבטחה (CSP) תוכל לאסור כל קוד מוטמע.
   ========================================================================== */
(function () {
  'use strict';
  try {
    var root = document.documentElement;
    var look = JSON.parse(localStorage.getItem('pruta.look') || '{}') || {};
    if (look.theme === 'light' || look.theme === 'dark') root.setAttribute('data-theme', look.theme);
    if (/^(teal|amber|violet|rose)$/.test(look.accent || '')) root.setAttribute('data-accent', look.accent);

    // first: רק בביקור הראשון אי-פעם (ברירת המחדל) · session: פעם בביקור · always · off
    var mode = ['first', 'always', 'session', 'off'].indexOf(look.intro) !== -1 ? look.intro : 'first';
    var seen = false;
    try { seen = mode === 'first' ? !!localStorage.getItem('pruta.introSeen') : !!sessionStorage.getItem('pruta.intro'); } catch (e) { /* אין אחסון */ }
    if (mode === 'first') mode = 'session';
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var skip = /[?&#]intro=0/.test(location.href);
    if (!still && !skip && (mode === 'always' || (mode === 'session' && !seen))) root.classList.add('intro-pending');
  } catch (e) { /* בלי אחסון מקומי: ברירות המחדל */ }
})();
