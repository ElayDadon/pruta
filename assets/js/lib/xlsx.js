/* ==========================================================================
   lib/xlsx.js — קורא גיליונות Excel (.xlsx/.xlsm) ומחזיר רשת תאים.
   מטפל במחרוזות משותפות, תאריכים לפי סגנון התא, ZIP64 ותאים ריקים.

   קובצי xlsx נכתבים על ידי הרבה תוכנות, וכל אחת בניב קצת אחר. מה שנתמך כאן נבדק מול
   קבצים שנכתבו ב-Excel, LibreOffice, openpyxl, xlsxwriter ו-pandas (tests/fixtures):
     · מחרוזות משותפות (sharedStrings) ומחרוזות בתוך התא (inlineStr)
     · תאריכים כמספר סידורי עם סגנון תאריך, כולל שעה, וכולל מערכת התאריכים של 1904 (Mac ישן)
     · תאריכים כטקסט ISO ‏(t="d")
     · תגיות עם קידומת מרחב שמות (‎<x:row>‎), כפי שכותבים חלק מהמייצאים ב-‎.NET
     · כמה גיליונות, נתיבים מוחלטים ויחסיים ב-rels
   ========================================================================== */
window.P = window.P || {};

P.xlsx = (function () {
  'use strict';

  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  /** גבולות הגיליון של Excel. תא שמצהיר על מיקום מעבר להם הוא קובץ פגום (או זדוני), ולא נקרא. */
  const MAX_ROW = 1048576, MAX_COL = 16384;

  /** מסיר קידומות מרחב שמות משמות התגיות (‎<x:row> ‎→‎ <row>‎). מאפיינים כמו r:id לא משתנים. */
  const bare = (xml) => (xml && xml.indexOf(':') !== -1 ? xml.replace(/<(\/?)[A-Za-z_][\w.-]*:(?=[A-Za-z_])/g, '<$1') : xml);

  function decodeXml(s) {
    return String(s).replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, g) => {
      if (g[0] !== '#') return ENT[g];
      const code = g[1] === 'x' || g[1] === 'X' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';   // קוד תו לא חוקי: מדלגים, לא קורסים
    });
  }
  function attr(tag, name) {
    const m = new RegExp('\\b' + name + '="([^"]*)"').exec(tag);
    return m ? decodeXml(m[1]) : null;
  }
  function colIndex(ref) {
    let n = 0;
    for (const ch of ref) {
      const c = ch.toUpperCase();
      if (c < 'A' || c > 'Z') break;
      n = n * 26 + (c.charCodeAt(0) - 64);
    }
    return n - 1;
  }
  /** מספר סידורי של Excel -> Date מקומי (אפוך 1899-12-30, כולל באג השנה המעוברת 1900) */
  function serialToDate(v) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
  }

  /** כל קטעי הטקסט (‎<t>‎) שבתוך תא או מחרוזת משותפת, מחוברים. קטע ריק (‎<t/>‎) הוא קטע ריק — לא פתיחה של הבא אחריו. */
  function textRuns(xml) {
    let s = '';
    const tr = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g;
    let t;
    while ((t = tr.exec(xml))) if (t[1]) s += decodeXml(t[1]);
    return s;
  }

  function parseSharedStrings(xml) {
    const out = [];
    if (!xml) return out;
    // מחרוזת ריקה שנסגרת בעצמה (<si/>) נבדקת קודם — אחרת היא "בולעת" את המחרוזת שאחריה, וכל האינדקסים זזים
    const si = /<si\b[^>]*\/>|<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = si.exec(xml))) out.push(textRuns((m[1] || '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')));       // הגייה פונטית (יפנית) אינה חלק מהטקסט
    return out;
  }

  function parseStyles(xml) {
    const builtinDate = new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58]);
    const custom = {};
    if (xml) {
      const nf = /<numFmt\b[^>]*\/>/g; let m;
      while ((m = nf.exec(xml))) {
        const id = attr(m[0], 'numFmtId'), code = attr(m[0], 'formatCode');
        if (id != null && code != null) custom[+id] = code;
      }
    }
    const xfs = [];
    const block = xml && /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
    if (block) {
      const xf = /<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g; let m;
      while ((m = xf.exec(block[1]))) {
        const id = /numFmtId="(\d+)"/.exec(m[1]);
        xfs.push(id ? +id[1] : 0);
      }
    }
    function isDateId(id) {
      if (builtinDate.has(id)) return true;
      const c = custom[id];
      if (!c) return false;
      const clean = c.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '').replace(/\\./g, '');
      return /[ymd]/i.test(clean);
    }
    return { isDate: (i) => isDateId(xfs[i] || 0) };
  }

  function parseSheet(xml, shared, styles, date1904) {
    const shift = date1904 ? 1462 : 0;                   // ההפרש בימים בין שתי מערכות התאריכים של Excel
    const rows = [];
    // שורה ריקה שנסגרת בעצמה (<row …/>) נבדקת קודם — אחרת היא "בולעת" את השורה שאחריה
    const rowRe = /<row\b([^>]*)\/>|<row\b([^>]*)>([\s\S]*?)<\/row>/g;
    let r;
    while ((r = rowRe.exec(xml))) {
      const rAttrs = r[1] != null ? r[1] : (r[2] || '');
      const body = r[3] || '';
      const rowNum = (/\br="(\d+)"/.exec(rAttrs) || [])[1];
      if (rowNum && !(+rowNum >= 1 && +rowNum <= MAX_ROW)) continue;
      const arr = [];
      const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let c, auto = 0;
      while ((c = cellRe.exec(body))) {
        const a = c[1] || '', inner = c[2] || '';
        const ref = attr(a, 'r');
        const ci = ref ? colIndex(ref) : auto;
        if (!(ci >= 0 && ci < MAX_COL)) continue;
        auto = ci + 1;
        const t = attr(a, 't'), sIdx = attr(a, 's');
        let val = null;
        if (t === 'inlineStr') val = textRuns(inner);
        else {
          const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
          if (v) {
            const raw = decodeXml(v[1]);
            if (t === 's') val = shared[+raw] != null ? shared[+raw] : '';
            else if (t === 'b') val = raw === '1';
            else if (t === 'e' || t === 'str' || t === 'd') val = raw;         // d: תאריך כטקסט ISO
            else {
              const num = raw.trim() === '' ? NaN : Number(raw);
              if (Number.isNaN(num)) val = raw;
              else if (styles && sIdx != null && styles.isDate(+sIdx) && num + shift > 20000 && num + shift < 80000) val = serialToDate(num + shift);
              else val = num;
            }
          }
        }
        if (val !== null && val !== '') arr[ci] = val;
      }
      if (!rowNum && rows.length >= MAX_ROW) break;
      rows[rowNum ? +rowNum - 1 : rows.length] = arr;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    return rows;
  }

  /** @returns {Promise<Array<{name:string, rows:any[][]}>>} */
  async function read(arrayBuffer) {
    const zip = await P.zip.open(arrayBuffer);
    const dec = new TextDecoder('utf-8');
    const names = zip.names();
    // שמות החלקים ב-ZIP תלויי רישיות, ויש מייצאים שכותבים SharedStrings.xml — מחפשים בלי תלות ברישיות
    const pick = (n) => (zip.has(n) ? n : names.find((x) => x.toLowerCase() === n.toLowerCase()) || n);
    const txt = async (n) => { const d = await zip.get(pick(n)); return d ? bare(dec.decode(d)) : null; };
    const inXl = (target) => 'xl/' + String(target || '').replace(/^\//, '').replace(/^xl\//, '');

    // ZIP שאינו xlsx: אומרים מה הוא, במקום "לא נמצאו גיליונות"
    const sheetFiles = names.filter((n) => /^xl\/worksheets\/[^/]+\.xml$/i.test(n)).sort();
    if (!zip.has(pick('xl/workbook.xml'))) {
      if (zip.has('xl/workbook.bin')) throw new Error('זה קובץ Excel בינארי (xlsb). שמרו אותו באקסל כ-xlsx או כ-CSV, וטענו שוב.');
      if (zip.has('content.xml') && zip.has('mimetype')) throw new Error('זה קובץ OpenDocument (ods). שמרו אותו כ-xlsx או כ-CSV, וטענו שוב.');
      if (zip.has('word/document.xml')) throw new Error('זה מסמך Word, לא גיליון. צריך לייצא מהבנק קובץ Excel או CSV.');
      if (!sheetFiles.length) throw new Error('הקובץ אינו גיליון Excel (xlsx).');
    }

    const wb = await txt('xl/workbook.xml');
    const rels = await txt('xl/_rels/workbook.xml.rels');
    const relMap = Object.create(null);
    let sharedPath = 'xl/sharedStrings.xml', stylesPath = 'xl/styles.xml';
    if (rels) {
      const re = /<Relationship\b[^>]*>/g; let m;
      while ((m = re.exec(rels))) {
        const type = attr(m[0], 'Type') || '', target = attr(m[0], 'Target');
        relMap[attr(m[0], 'Id')] = target;
        if (/\/sharedStrings$/i.test(type) && target) sharedPath = inXl(target);
        else if (/\/styles$/i.test(type) && target) stylesPath = inXl(target);
      }
    }
    const shared = parseSharedStrings(await txt(sharedPath));
    const styles = parseStyles(await txt(stylesPath));
    const pr = wb && /<workbookPr\b[^>]*>/.exec(wb);
    const date1904 = !!pr && /\bdate1904="(1|true)"/.test(pr[0]);

    const sheets = [];
    if (wb) {
      const re = /<sheet\b[^>]*>/g; let m;
      while ((m = re.exec(wb))) {
        const rid = attr(m[0], 'r:id') || (/\b[\w.-]+:id="([^"]*)"/.exec(m[0]) || [])[1] || attr(m[0], 'id');
        const target = relMap[rid];
        sheets.push({ name: attr(m[0], 'name') || 'גיליון', path: target ? inXl(target) : sheetFiles[sheets.length] || 'xl/worksheets/sheet1.xml' });
      }
    }
    // בלי workbook.xml תקין: קוראים את קובצי הגיליונות עצמם, לפי הסדר
    if (!sheets.length) sheetFiles.forEach((n, i) => sheets.push({ name: 'גיליון ' + (i + 1), path: n }));

    const out = [];
    for (const s of sheets) {
      const xml = await txt(s.path);
      if (xml == null) continue;
      out.push({ name: s.name, rows: parseSheet(xml, shared, styles, date1904) });
    }
    if (!out.length) throw new Error('לא נמצאו גיליונות בקובץ');
    return out;
  }

  return { read, serialToDate, _internals: { parseSheet, parseStyles, parseSharedStrings, decodeXml } };
})();
