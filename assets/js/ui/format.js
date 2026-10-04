/* ==========================================================================
   ui/format.js — מספרים, תאריכים, שמות חודשים וימים, ודקדוק עברי קטן.
   ========================================================================== */
window.P = window.P || {};

P.fmt = (function () {
  'use strict';

  const MONTH_LONG = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const MONTH_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
  const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const DAY_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  const nf0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- כסף ---------- */
  function money(n) { return '₪' + nf0.format(Math.round(Math.abs(n || 0))) ; }
  /* סכום עם סימן נעטף בבידוד כיווני (LRI…PDI): כך "(+₪1,751)" נשאר שלם גם בתוך משפט בעברית */
  const iso = (s) => '\u2066' + s + '\u2069';
  function moneyS(n) { return n < 0 ? iso('−' + money(n)) : money(n); }
  function money2(n) { return '₪' + nf2.format(Math.abs(n || 0)); }
  function moneyShort(n) {
    const v = Math.abs(n || 0);
    if (v >= 1000000) return '₪' + nf1.format(Math.round(v / 100000) / 10) + 'M';
    if (v >= 1000) return '₪' + nf1.format(Math.round(v / 100) / 10) + 'K';
    return '₪' + nf0.format(Math.round(v));
  }
  /** סכום עם סימן מפורש: + לנכנס, − ליוצא. הסימן נושא את המשמעות ולא רק הצבע */
  function signed(n, exact) { return iso((n >= 0 ? '+' : '−') + (exact ? money2(n) : money(n))); }
  function pct(n, digits) {
    const d = digits == null ? 0 : digits;
    return (Math.abs(n) * 100).toFixed(d).replace(/\.0+$/, '') + '%';
  }
  function count(n) { return nf0.format(n || 0); }

  /* ---------- תאריכים ---------- */
  const parts = (k) => String(k).split('-').map(Number);
  function day(k) { const p = String(k).split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function dayShort(k) { const p = String(k).split('-'); return p[2] + '.' + p[1]; }
  function dayLong(k) {
    const [y, m, d] = parts(k);
    const dt = new Date(y, m - 1, d);
    return 'יום ' + DAY_LONG[dt.getDay()] + ', ' + d + ' ב' + MONTH_LONG[m - 1];
  }
  function dayWithMonth(k) { const [, m, d] = parts(k); return d + ' ב' + MONTH_LONG[m - 1]; }
  function monthName(k) { const [y, m] = parts(k); return MONTH_LONG[m - 1] + ' ' + y; }
  function monthOnly(k) { return MONTH_LONG[parts(k)[1] - 1]; }
  function monthShort(k) { const [y, m] = parts(k); return MONTH_SHORT[m - 1] + ' ' + String(y).slice(2); }
  function range(a, b) { return day(a) + ' – ' + day(b); }
  function rangeShort(a, b) { return dayShort(a) + ' – ' + dayShort(b); }
  function weekday(k) { const [y, m, d] = parts(k); return new Date(y, m - 1, d).getDay(); }

  function addMonths(k, delta) {
    const [y, m] = parts(k);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monthEdges(k) {
    const [y, m] = parts(k);
    const first = new Date(y, m - 1, 1), last = new Date(y, m, 0);
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return { from: iso(first), to: iso(last), days: last.getDate(), firstWeekday: first.getDay() };
  }
  function relative(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'עכשיו';
    if (diff < 3600) return 'לפני ' + Math.round(diff / 60) + ' דק׳';
    if (diff < 86400) return 'לפני ' + Math.round(diff / 3600) + ' שע׳';
    const d = Math.round(diff / 86400);
    return d === 1 ? 'אתמול' : 'לפני ' + d + ' ימים';
  }

  /* ---------- דקדוק ---------- */
  /** אות שימוש לפני שם: "ל" + "דיור" = "לדיור", אבל "ל-Netflix" */
  function prefix(letter, word) {
    const w = String(word || '');
    return /^[א-ת]/.test(w) ? letter + w : letter + '-' + w;
  }
  /** "תנועה אחת" / "2 תנועות" */
  function plural(n, one, many, oneWord) {
    if (n === 1) return oneWord || (one + ' אחת');
    return count(n) + ' ' + many;
  }
  function greeting(date) {
    const h = (date || new Date()).getHours();
    if (h >= 5 && h < 12) return 'בוקר טוב';
    if (h >= 12 && h < 17) return 'צהריים טובים';
    if (h >= 17 && h < 22) return 'ערב טוב';
    return 'לילה טוב';
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  return {
    money, moneyS, money2, moneyShort, signed, pct, count,
    day, dayShort, dayLong, dayWithMonth, monthName, monthOnly, monthShort, range, rangeShort, weekday,
    addMonths, monthEdges, relative, prefix, plural, greeting, esc,
    MONTH_LONG, MONTH_SHORT, DAY_SHORT, DAY_LONG
  };
})();
