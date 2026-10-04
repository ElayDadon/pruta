/* ==========================================================================
   lib/csv.js — קורא טקסט מופרד (פסיק, נקודה-פסיק, טאב או קו אנכי) עם זיהוי מפריד אוטומטי,
   תמיכה בציטוטים, ב-BOM ובכל סוגי סוף השורה.
   ---------------------------------------------------------------------------
   מירכאות פותחות שדה מצוטט רק בתחילת שדה (כמו בתקן). באמצע שדה הן תו רגיל —
   חשוב במיוחד בעברית, שבה ראשי תיבות כמו בע"מ, סה"כ ו-ש"ח מופיעים בלי ציטוט.
   קובץ עם מירכאות לא מאוזנות נקרא שוב כשכל המירכאות הן תווים רגילים, כדי ששדה
   אחד פגום לא יבלע את שאר הקובץ.
   ========================================================================== */
window.P = window.P || {};

P.csv = (function () {
  'use strict';

  /*
   * המפריד נבחר לפי מה שהוא עושה לקובץ, לא לפי כמה פעמים התו מופיע: מפריד נכון נותן אותו מספר
   * עמודות בכל השורות, כולל שורת הכותרות. כך קובץ אירופי (נקודה-פסיק בין שדות, פסיק עשרוני בסכומים)
   * לא נקרא בטעות כמופרד בפסיקים, ותיאור שיש בו פסיקים לא מבלבל קובץ מופרד בטאבים.
   */
  const DELIMITERS = [',', ';', '\t', '|'];
  function pickDelimiter(text) {
    const head = text.slice(0, 20000);
    let best = ',', top = 0;
    DELIMITERS.forEach((d) => {
      if (head.indexOf(d) === -1) return;
      const rows = (parse(head, d, true) || parse(head, d, false)).slice(0, 80).filter((r) => r.some((c) => c.trim() !== ''));
      const freq = Object.create(null);
      rows.forEach((r) => { if (r.length > 1) freq[r.length] = (freq[r.length] || 0) + 1; });
      let cols = 0, lines = 0;
      for (const k in freq) if (freq[k] > lines || (freq[k] === lines && +k > cols)) { lines = freq[k]; cols = +k; }
      // קודם כל העקביות (כמה מהשורות חולקות את אותו מספר עמודות), ורק בשוויון — מי שנותן יותר עמודות
      const score = rows.length ? lines / rows.length + Math.min(cols, 50) / 1000 : 0;
      if (score > top) { top = score; best = d; }
    });
    return best;
  }

  /** quoting=false: כל המירכאות הן תווים רגילים. מחזיר null אם שדה מצוטט נשאר פתוח עד סוף הקובץ. */
  function parse(text, delim, quoting) {
    const rows = [];
    let row = [], cell = '', quoted = false, started = false;   // started: כבר נקרא תוכן בשדה הנוכחי
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else quoted = false;
        } else cell += ch;
      } else if (ch === '"' && quoting && !started) { quoted = true; started = true; cell = ''; }
      else if (ch === delim) { row.push(cell); cell = ''; started = false; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) { row.push(cell); rows.push(row); row = []; cell = ''; started = false; }   // סוף שורה: ‎\n‎, ‎\r\n‎, או ‎\r‎ לבדו (Mac ישן)
      else if (ch !== '\r') { cell += ch; if (ch !== ' ' && ch !== '\t') started = true; }
    }
    if (quoted) return null;
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function read(text) {
    text = String(text).replace(/^\ufeff/, '');
    // שורה ראשונה מהסוג "sep=;" היא הוראה לאקסל מהו המפריד — לא נתונים
    const hint = /^sep=(.)\r?\n?/i.exec(text);
    if (hint) text = text.slice(hint[0].length);
    const delim = hint ? hint[1] : pickDelimiter(text);
    const rows = parse(text, delim, true) || parse(text, delim, false);
    return [{ name: 'CSV', rows: rows.map((r) => r.map((c) => c.trim())) }];
  }

  return { read };
})();
