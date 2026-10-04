/* ==========================================================================
   lib/sniff.js — מה הקובץ הזה באמת, ואיך קוראים אותו.

   סיומת של קובץ היא רק שם. בנקים וחברות אשראי נותנים "קובץ אקסל" שהוא לפעמים xlsx אמיתי,
   לפעמים דף HTML עם טבלה שנקרא ‎.xls, לפעמים XML של Excel 2003, ולפעמים טקסט מופרד בטאבים —
   ובקידוד שאינו UTF-8. לכן מסתכלים על התוכן:

     PK…                 ארכיון ZIP              ← xlsx
     D0 CF 11 E0         קובץ Excel בינארי ישן    ← הודעה ברורה: לשמור כ-xlsx
     ‎<?mso-application    XML Spreadsheet 2003    ← נקרא כאן
     ‎<table              HTML                    ← נקרא כאן (הטבלאות בלבד, כטקסט)
     כל השאר             טקסט מופרד              ← csv.js

   קידוד הטקסט מזוהה לפי הסדר: BOM, ‏UTF-16 בלי BOM, ‏UTF-8 תקין, ואם לא — עברית של Windows
   (windows-1255) או מערב-אירופית (windows-1252), לפי איך שהאותיות יושבות בטקסט.
   ========================================================================== */
window.P = window.P || {};

P.files = (function () {
  'use strict';

  const MAX_BYTES = 80 * 1024 * 1024;

  /* ---------- קידוד ---------- */
  const dec = (label, bytes, fatal) => new TextDecoder(label, fatal ? { fatal: true } : undefined).decode(bytes);

  /** @returns {{text: string, encoding: string}} */
  function decode(u8) {
    if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return { text: dec('utf-8', u8.subarray(3)), encoding: 'utf-8' };
    if (u8[0] === 0xff && u8[1] === 0xfe) return { text: dec('utf-16le', u8.subarray(2)), encoding: 'utf-16le' };
    if (u8[0] === 0xfe && u8[1] === 0xff) return { text: dec('utf-16be', u8.subarray(2)), encoding: 'utf-16be' };
    // UTF-16 בלי BOM: בטקסט עם ספרות, פסיקים ורווחים — כל בית שני הוא אפס
    const n = Math.min(u8.length, 4096);
    let zeroEven = 0, zeroOdd = 0;
    for (let i = 0; i < n; i++) if (u8[i] === 0) { if (i % 2) zeroOdd++; else zeroEven++; }
    if (n >= 8 && zeroOdd > n * 0.15 && zeroEven < n * 0.03) return { text: dec('utf-16le', u8), encoding: 'utf-16le' };
    if (n >= 8 && zeroEven > n * 0.15 && zeroOdd < n * 0.03) return { text: dec('utf-16be', u8), encoding: 'utf-16be' };
    try { return { text: dec('utf-8', u8, true), encoding: 'utf-8' }; } catch (e) { /* לא UTF-8 */ }
    // קידוד של בית אחד לתו. בעברית של Windows האותיות (‎0xE0–0xFA‎) באות ברצפים — מילים שלמות;
    // בטקסט מערב-אירופי אותם בתים הם אות מוטעמת בודדת בתוך מילה לטינית (é, ñ, ü).
    let runs = 0, lone = 0;
    const heb = (b) => b >= 0xe0 && b <= 0xfa, latin = (b) => (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a);
    const m = Math.min(u8.length, 200000);
    for (let i = 0; i < m; i++) {
      if (!heb(u8[i])) continue;
      if (heb(u8[i - 1]) || heb(u8[i + 1])) runs++;
      else if (latin(u8[i - 1]) || latin(u8[i + 1])) lone++;
    }
    const label = lone > runs ? 'windows-1252' : 'windows-1255';
    try { return { text: dec(label, u8), encoding: label }; }
    catch (e) { return { text: dec('utf-8', u8), encoding: 'utf-8' }; }
  }

  /* ---------- HTML: רק הטבלאות, ורק כטקסט ---------- */
  function htmlSheets(text) {
    if (typeof DOMParser !== 'function') throw new Error('הדפדפן הזה לא יכול לקרוא קובץ HTML.');
    // מסמך ש-DOMParser בונה אינו "חי": סקריפטים לא רצים בו ותמונות לא נטענות. לוקחים ממנו רק textContent.
    const doc = new DOMParser().parseFromString(text.replace(/<br\s*\/?>/gi, ' '), 'text/html');
    const sheets = [];
    Array.prototype.forEach.call(doc.querySelectorAll('table'), (table) => {
      const rows = [];
      Array.prototype.forEach.call(table.rows, (tr) => {
        const row = [];
        let ci = 0;
        Array.prototype.forEach.call(tr.cells, (cell) => {
          if (cell.querySelector('table')) { ci++; return; }                 // תא של טבלת מסגרת: התוכן שלו ייקרא כטבלה בפני עצמה
          const v = cell.textContent.replace(/[\s ]+/g, ' ').trim();
          if (v !== '' && ci < 16384) row[ci] = v;
          ci += Math.max(1, Math.min(cell.colSpan || 1, 64));
        });
        rows.push(row);
      });
      if (rows.some((r) => r.length)) sheets.push({ name: 'טבלה ' + (sheets.length + 1), rows: rows });
    });
    if (!sheets.length) throw new Error('לא נמצאה טבלה בקובץ.');
    return sheets;
  }

  /* ---------- XML Spreadsheet 2003 ---------- */
  function xmlSheets(text) {
    const unx = P.xlsx._internals.decodeXml;
    const xml = text.replace(/<(\/?)[A-Za-z_][\w.-]*:(?=[A-Za-z_])/g, '<$1');            // ‎<ss:Row> ‎→‎ <Row>‎
    const at = (tag, name) => { const m = new RegExp('(?:^|[\\s:])' + name + '="([^"]*)"').exec(tag); return m ? unx(m[1]) : null; };
    const sheets = [];
    const wsRe = /<Worksheet\b([^>]*)>([\s\S]*?)<\/Worksheet>/g;
    let w;
    while ((w = wsRe.exec(xml))) {
      const rows = [];
      const rowRe = /<Row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Row>)/g;
      let r, ri = 0;
      while ((r = rowRe.exec(w[2]))) {
        const jump = +at(r[1], 'Index');
        if (jump >= 1) ri = jump - 1;
        if (ri >= 1048576) break;
        const row = [];
        const cellRe = /<Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Cell>)/g;
        let c, ci = 0;
        while ((c = cellRe.exec(r[2] || ''))) {
          const to = +at(c[1], 'Index');
          if (to >= 1) ci = to - 1;
          const d = /<Data\b([^>]*)>([\s\S]*?)<\/Data>/.exec(c[2] || '');
          if (d && ci < 16384) {
            const raw = unx(d[2].replace(/<[^>]+>/g, '')).trim();                          // טקסט מעוצב: רק התווים
            if (raw !== '') {
              const num = at(d[1], 'Type') === 'Number' ? Number(raw) : NaN;
              row[ci] = Number.isNaN(num) ? raw : num;
            }
          }
          ci += 1 + (+at(c[1], 'MergeAcross') || 0);
        }
        rows[ri++] = row;
      }
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
      if (rows.some((x) => x.length)) sheets.push({ name: at(w[1], 'Name') || 'גיליון ' + (sheets.length + 1), rows: rows });
    }
    if (!sheets.length) throw new Error('לא נמצאו גיליונות בקובץ.');
    return sheets;
  }

  /**
   * קורא קובץ לפי התוכן שלו.
   * @param {string} name  שם הקובץ (להודעות בלבד — ההחלטה לפי התוכן)
   * @param {ArrayBuffer} buffer
   * @returns {Promise<Array<{name: string, rows: any[][]}>>}
   */
  async function read(name, buffer) {
    const u8 = new Uint8Array(buffer);
    if (!u8.length) throw new Error('הקובץ ריק.');
    if (u8.length > MAX_BYTES) throw new Error('הקובץ גדול מדי (' + Math.round(u8.length / 1048576) + 'MB). דוח תנועות שוקל בדרך כלל פחות ממגה-בייט אחד.');
    if (u8[0] === 0x50 && u8[1] === 0x4b) return P.xlsx.read(buffer);
    if (u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) {
      throw new Error('זה קובץ Excel בפורמט הישן (xls), או קובץ שמוגן בסיסמה. פתחו אותו באקסל, שמרו כ-xlsx או כ-CSV, וטענו שוב.');
    }
    if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) {
      throw new Error('זה קובץ PDF. צריך לייצא מהבנק את התנועות כקובץ Excel או CSV.');
    }
    const text = decode(u8).text;
    const head = text.slice(0, 4000).toLowerCase();
    if (head.indexOf('<?mso-application') !== -1 || head.indexOf('urn:schemas-microsoft-com:office:spreadsheet') !== -1) return xmlSheets(text);
    if (/<table[\s>]|<html[\s>]|<!doctype html/.test(head)) return htmlSheets(text);
    return P.csv.read(text);
  }

  return { read, decode, htmlSheets, xmlSheets };
})();
