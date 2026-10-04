#!/usr/bin/env node
/* ==========================================================================
   tests/run.js — בדיקות למנוע של "פרוטה" (קריאת קבצים, זיהוי עמודות, סיווג,
   למידה, סיכומים). רצות ב-Node בלי שום תלות:   node tests/run.js

   קובצי המנוע (assets/js/core, lib) הם סקריפטים רגילים לדפדפן, בלי מודולים.
   כאן הם נטענים לתוך הקשר מבודד שמדמה את window — אותו קוד בדיוק שרץ בדפדפן.
   ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { console, TextDecoder, TextEncoder, Blob, Response, DecompressionStream, Intl, Date, Math, JSON, parseFloat, parseInt, isNaN, isFinite, setTimeout, clearTimeout };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
['lib/zip.js', 'lib/xlsx.js', 'lib/csv.js', 'lib/sniff.js', 'core/parse.js', 'core/detect.js', 'core/categories.js', 'core/learn.js', 'ui/format.js', 'core/state.js', 'core/insights.js']
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8'), ctx, { filename: f }));
const P = ctx.P;

/* ---------- מריץ בדיקות קטן ---------- */
let passed = 0; const failed = [];
let group = '';
const section = (name) => { group = name; console.log('\n' + name); };
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed.push(group + ' › ' + name + '\n      ' + String(e && e.message).split('\n')[0]); console.log('  ✗ ' + name + '\n      ' + String(e && e.message).split('\n')[0]); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function eq(actual, expected, what) { if (!same(actual, expected)) throw new Error((what ? what + ': ' : '') + 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)); }
function ok(cond, what) { if (!cond) throw new Error(what || 'expected a truthy value'); }
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.005 : tol);
const plain = (s) => String(s).replace(/[⁦-⁩‎‏]/g, '');

/* ---------- עזרים ---------- */
const sample = (name) => path.join(ROOT, 'tests', 'samples', name);   // דוחות בדויים: שמות, חשבונות וסכומים מומצאים
const readCsv = (name) => P.csv.read(fs.readFileSync(sample(name), 'utf8'));
async function readXlsx(name) {
  const buf = fs.readFileSync(sample(name));
  return P.xlsx.read(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
/** אותו מסלול כמו באפליקציה: ניתוח הגיליון, ובניית תנועות לפי המיפוי שזוהה */
function ingest(sheets) {
  const rows = sheets[0].rows;
  const a = P.detect.analyze(rows);
  const res = P.parse.build(rows, a.profile.headerRow, a.mapping, a.options);
  return { rows, analysis: a, tx: res.tx, skipped: res.skipped, meta: P.parse.meta(rows, a.profile.headerRow) };
}
const csvOf = (lines) => P.csv.read(lines.join('\n'));
function freshState(tx, name) { P.state.hydrate({}); if (tx) P.state.addTransactions(tx, {}, name || 'test.csv'); return P.state; }

(async () => {
  /* ====================================================================== */
  section('קריאת ערכים (parse)');
  test('סכומים: אלפים, עשרוני, מינוס, סוגריים, מטבע', () => {
    const A = P.parse.amount;
    eq(A('1,234.50'), 1234.5); eq(A('1.234,50'), 1234.5); eq(A('-45'), -45); eq(A('45-'), -45);
    eq(A('(120.00)'), -120); eq(A('₪ 1,000'), 1000); eq(A('−12.5'), -12.5); eq(A('12,5'), 12.5);
    eq(A('1,234'), 1234); eq(A(77.1), 77.1); eq(A(''), null); eq(A(null), null);
  });
  test('טקסט עם ספרות אינו סכום', () => {
    eq(P.parse.amount('ויזה 4417'), null); eq(P.parse.isNumeric('TLV MARKET 4471'), false); eq(P.parse.isNumeric('1,204.10'), true);
  });
  test('מפריד עשרוני מפורש גובר על הניחוש', () => { eq(P.parse.amount('1.234', ','), 1234); eq(P.parse.amount('1,234', '.'), 1234); });
  test('תאריכים: סדרים ומפרידים שונים', () => {
    const D = P.parse.date;
    eq(D('05/03/2026'), '2026-03-05'); eq(D('5.3.26'), '2026-03-05'); eq(D('2026-03-05'), '2026-03-05');
    eq(D('03/25/2026'), '2026-03-25', 'יום > 12 מכריע'); eq(D('03/05/2026', 'mdy'), '2026-03-05');
    eq(D('2026-03-05T10:20:00'), '2026-03-05'); eq(D(new Date(2026, 2, 5)), '2026-03-05');
  });
  test('תאריכים: חודש במילים (אנגלית ועברית), יום בשבוע לפני התאריך, שמונה ספרות רצופות', () => {
    const D = P.parse.date;
    ['01-Mar-2026', '1 Mar 2026', 'Mar 1, 2026', 'March 1st, 2026', '1 במרץ 2026', '1 מרץ 2026', '01 מרס 26', 'יום א 01/03/2026', "יום א' 1.3.2026", 'Sun, 01/03/2026', 'Sunday 2026-03-01', '20260301', '01/03/2026 יום ראשון', '2026-03-01T22:30:00+03:00']
      .forEach((v) => eq(D(v), '2026-03-01', v));
    eq(D('15 בדצמבר 2025'), '2025-12-15'); eq(D('3-Sept-2025'), '2025-09-03'); eq(D('31 ביוני 2026'), null, 'אין 31 ביוני');
    [20260301, '46082', '12345678', 'חשמל 01/03/2026', 'March 2026', '1 Marble 2026x', 'שופרסל דיל', 'May'].forEach((v) => eq(D(v), null, JSON.stringify(v)));
  });
  test('תאריך שלא קיים נדחה ולא "מתגלגל" לחודש הבא', () => { eq(P.parse.date('31/02/2026'), null); eq(P.parse.date('00/01/2026'), null); eq(P.parse.date('שלום'), null); });
  test('נירמול טקסט: רווחים, גרשיים, סימני כיווניות', () => {
    eq(P.parse.clean('  שופרסל ‏  דיל  '), 'שופרסל דיל'); eq(P.parse.norm('WOLT*TEL-AVIV  (IL)'), 'wolt tel aviv il'); eq(P.parse.norm('בע"מ'), 'בעמ');
  });
  test('מזהה תנועה יציב ושונה בין תנועות', () => { eq(P.parse.hash('a|b'), P.parse.hash('a|b')); ok(P.parse.hash('a|b') !== P.parse.hash('a|c')); });

  /* ====================================================================== */
  section('קריאת קבצים (csv, xlsx)');
  test('CSV: מירכאות, פסיק בתוך שדה, שורות ריקות ו-BOM', () => {
    const rows = P.csv.read('﻿תאריך,תיאור,סכום\n01/02/2026,"קפה, מאפה ו""עוד""",-32.5\n\n02/02/2026,חניה,-12\n')[0].rows;
    eq(rows[0][0], 'תאריך'); eq(rows[1][1], 'קפה, מאפה ו"עוד"'); eq(rows.filter((r) => r && r.length > 1).length, 3);
  });
  test('CSV: נקודה-פסיק או טאב כמפריד מזוהים לבד', () => {
    eq(P.csv.read('a;b;c\n1;2;3')[0].rows[1], ['1', '2', '3']); eq(P.csv.read('a\tb\n1\t2')[0].rows[1], ['1', '2']);
  });
  test('CSV: המפריד נבחר לפי עקביות העמודות — פסיק עשרוני או פסיקים בתיאור לא מבלבלים', () => {
    const cols = (text) => P.csv.read(text)[0].rows.map((r) => r.length);
    eq(cols('Datum;Text;Betrag;Saldo\n01.03.2026;Kaffee;-12,50;987,50\n02.03.2026;Tanken;-1.200,00;-212,50'), [4, 4, 4], 'נקודה-פסיק עם פסיק עשרוני');
    eq(cols('תאריך\tתיאור\tסכום\n01/03/2026\tקפה, מאפה, ועוד, ועוד\t-12,50\n02/03/2026\tדלק, שמן, מים, אוויר\t-200,00'), [3, 3, 3], 'טאבים, ופסיקים בתוך התיאור');
    eq(cols('תאריך|תיאור|סכום\n01/03/2026|קפה|-12.50'), [3, 3], 'קו אנכי');
    eq(cols('תאריך,תיאור,סכום\n01/03/2026,"קפה; מאפה",-12.50\n02/03/2026,"דלק; שמן",-200'), [3, 3, 3], 'פסיקים, ונקודה-פסיק בתוך התיאור');
  });
  test('CSV: סוף שורה של Mac ישן (‎\\r‎ בלבד), ושורת "sep=;" של אקסל', () => {
    eq(P.csv.read('תאריך,תיאור,סכום\r01/03/2026,קפה,-12.50\r02/03/2026,דלק,-200\r')[0].rows.length, 3);
    const hinted = P.csv.read('sep=;\r\nתאריך;תיאור;סכום\r\n01/03/2026;קפה;-12,50\r\n')[0].rows;
    eq(hinted[0], ['תאריך', 'תיאור', 'סכום']); eq(hinted.length, 2);
    eq(P.csv.read('תאריך,תיאור,סכום\n01/03/2026,"קפה\nשורה שנייה",-12.50\n')[0].rows[1][1], 'קפה\nשורה שנייה', 'ירידת שורה בתוך שדה מצוטט נשארת בתוך השדה');
  });
  const demoCsv = ingest(readCsv('demo.csv'));
  const demoXlsx = ingest(await readXlsx('demo.xlsx'));
  test('דוח חשבון (CSV): שורת הכותרות, העמודות ופרטי החשבון מזוהים לבד', () => {
    const a = demoCsv.analysis;
    eq(a.profile.headerRow, 5); eq(a.options.signMode, 'neg-out');
    eq([a.mapping.date, a.mapping.desc, a.mapping.amount, a.mapping.currency, a.mapping.balance, a.mapping.ref], [0, 1, 2, 3, 4, 5]);
    ok(P.detect.confident(a), 'אמור להיקלט בלי חלון המיפוי');
    ok(demoCsv.meta.client && demoCsv.meta.account && demoCsv.meta.period, 'פרטי החשבון');
  });
  test('דוח חשבון: 804 תנועות, בלי שורות שדולגו, והסכומים מסתדרים', () => {
    eq(demoCsv.tx.length, 804); eq(demoCsv.skipped, 0);
    const out = demoCsv.tx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0), inc = demoCsv.tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    ok(near(out, 212731, 1) && near(inc, 215232, 1), 'out ' + out.toFixed(0) + ' in ' + inc.toFixed(0));
    eq(new Set(demoCsv.tx.map((t) => t.id)).size, 804, 'מזהים ייחודיים');
  });
  test('אותו דוח כ-XLSX נותן בדיוק אותן תנועות (ולכן טעינה כפולה לא מכפילה)', () => {
    eq(demoXlsx.tx.length, 804);
    const ids = new Set(demoCsv.tx.map((t) => t.id));
    eq(demoXlsx.tx.filter((t) => ids.has(t.id)).length, 804);
  });
  const card = ingest(await readXlsx('credit-card-example.xlsx'));
  test('פירוט כרטיס אשראי: סכום חיובי = הוצאה, ועמודת קטגוריה מהקובץ', () => {
    eq(card.analysis.options.signMode, 'pos-out'); ok(card.analysis.mapping.category != null, 'עמודת קטגוריה');
    ok(card.tx.length > 20 && card.tx.every((t) => t.amount < 0)); ok(card.tx.filter((t) => t.fileCat).length > card.tx.length * 0.8);
    eq(P.detect.fileKind(card.analysis.profile, card.analysis.mapping, card.analysis.options), 'card');
  });
  const bank = ingest(await readXlsx('bank-debit-credit-example.xlsx'));
  test('דוח בנק עם עמודות חובה וזכות נפרדות', () => {
    ok(bank.analysis.mapping.debit != null && bank.analysis.mapping.credit != null && bank.analysis.mapping.amount == null);
    ok(bank.tx.some((t) => t.amount > 0) && bank.tx.some((t) => t.amount < 0)); eq(bank.skipped, 0);
  });
  const en = ingest(readCsv('english-card-example.csv'));
  test('קובץ באנגלית: כותרות מזוהות, תאריכים בסדר אמריקאי נקראים נכון', () => {
    ok(en.tx.length > 10 && en.skipped === 0); eq(en.analysis.options.dateOrder, 'mdy');
    ok(en.tx.some((t) => t.date === '2026-01-13' && t.desc === 'ZARA'), '01/13/2026 הוא 13 בינואר'); ok(en.tx.every((t) => t.date >= '2026-01-01' && t.date <= '2026-08-31'));
    eq(en.analysis.options.signMode, 'pos-out'); eq(en.tx.filter((t) => t.amount > 0).map((t) => t.desc), ['REFUND ZARA', 'REFUND ZARA', 'REFUND ZARA'], 'חיובים הם הוצאות, וזיכויים נשארים זיכויים');
  });
  test('קובץ בלי שורת כותרות: העמודות מזוהות לפי התוכן', () => {
    const r = ingest(csvOf(['01/02/2026,פז דלק,-211.68', '03/02/2026,שופרסל,-90.10', '04/02/2026,ארומה,-21', '09/02/2026,רמי לוי,-340.5', '11/02/2026,סופר פארם,-64']));
    eq(r.analysis.profile.headerRow, -1); eq(r.tx.length, 5); eq(r.tx.find((t) => t.desc === 'פז דלק').amount, -211.68);
  });
  test('שורות סיכום וזבל מדולגות, ולא נספרות כתנועות', () => {
    const r = ingest(csvOf(['תאריך,תיאור,סכום', '01/02/2026,קפה,-12', 'סה"כ,,−12', ',,', '02/02/2026,חניה,-8', '03/02/2026,מכולת,-55.2']));
    eq(r.tx.length, 3); ok(r.skipped >= 1);
  });
  test('שתי תנועות זהות באותו יום נשמרות שתיהן', () => {
    const r = ingest(csvOf(['תאריך,תיאור,סכום', '01/02/2026,קפה,-12', '01/02/2026,קפה,-12', '02/02/2026,חניה,-8']));
    eq(r.tx.length, 3); eq(new Set(r.tx.map((t) => t.id)).size, 3);
  });

  /* ====================================================================== */
  section('קבצים כמו שבנקים באמת נותנים (tests/fixtures)');
  // אותו דוח קטן — 12 תנועות — נכתב על ידי תוכנות שונות, בפורמטים ובקידודים שונים (tests/make-fixtures.py).
  // כל קובץ עובר את המסלול של האפליקציה: זיהוי לפי התוכן, בחירת הגיליון, זיהוי העמודות, בניית התנועות.
  const fixture = (name) => { const b = fs.readFileSync(path.join(__dirname, 'fixtures', name)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
  async function importFixture(name) {
    const sheets = await P.files.read(name, fixture(name));
    let best = null;
    sheets.forEach((sh) => {
      let a; try { a = P.detect.analyze(sh.rows); } catch (e) { return; }
      const usable = a.mapping.date != null && (a.mapping.amount != null || a.mapping.debit != null || a.mapping.credit != null);
      const score = (a.profile.bodyCount || 0) + (usable ? 1000 : 0);
      if (!best || score > best.score) best = { a: a, rows: sh.rows, score: score, sheet: sh.name };
    });
    const res = P.parse.build(best.rows, best.a.profile.headerRow, best.a.mapping, best.a.options);
    const tx = res.tx.slice().sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    return {
      n: tx.length, skipped: res.skipped, sure: P.detect.confident(best.a), sheet: best.sheet, tx: tx,
      out: +tx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0).toFixed(2), inc: +tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0).toFixed(2),
      first: tx[0].date, last: tx[tx.length - 1].date, descs: tx.map((t) => t.desc), meta: P.parse.meta(best.rows, best.a.profile.headerRow)
    };
  }
  const WRITERS = {
    'xlsxwriter-dates.xlsx': 'xlsxwriter: מחרוזות משותפות, תאי תאריך אמיתיים, תאים ממוזגים',
    'openpyxl-datetime.xlsx': 'openpyxl: תאריך עם שעה, שני גיליונות, שורות קפואות',
    'libreoffice.xlsx': 'LibreOffice (ניב XML אחר)',
    'pandas.xlsx': 'pandas, כותרות באנגלית',
    'date1904.xlsx': 'מערכת התאריכים של 1904 (Mac ישן)',
    'prefixed-namespace.xlsx': 'תגיות עם קידומת ‎<x:row>‎ (מייצאים ב-.NET)',
    'second-sheet-debit-credit.xlsx': 'הנתונים בגיליון השני, חובה וזכות בעמודות נפרדות, שתי עמודות תאריך',
    'spreadsheetml-2003.xls': 'XML Spreadsheet 2003 בשם ‎.xls',
    'windows-1255.csv': 'CSV בקידוד עברית של Windows',
    'utf8-bom.csv': 'CSV ב-UTF-8 עם BOM',
    'utf16-tabs.txt': 'טקסט Unicode של Excel: ‏UTF-16 מופרד בטאבים',
    'utf16-no-bom.csv': 'UTF-16 בלי BOM'
  };
  for (const name of Object.keys(WRITERS)) {
    let got = null, err = null;
    try { got = await importFixture(name); } catch (e) { err = e; }
    test(WRITERS[name], () => {
      if (err) throw err;
      eq([got.n, got.skipped, got.out, got.inc, got.first, got.last], [12, 0, 7031.57, 29140, '2026-03-01', '2026-04-03']);
      ok(got.sure, 'המבנה אמור להיות מזוהה בביטחון, בלי לשאול');
      ok(got.descs.indexOf('שופרסל דיל רמת גן 123') !== -1 && got.descs.indexOf('סופר-פארם, סניף "עזריאלי"') !== -1 && got.descs.indexOf('NETFLIX.COM') !== -1, 'תיאורים: ' + JSON.stringify(got.descs.slice(0, 3)));
    });
  }
  const withMeta = await importFixture('xlsxwriter-dates.xlsx'), secondSheet = await importFixture('second-sheet-debit-credit.xlsx'), latin = await importFixture('windows-1252-latin.csv');
  test('פרטי החשבון שמעל הטבלה נקראים גם מקובץ Excel "אמיתי"', () => { eq(withMeta.meta, { branch: '905', client: 'ישראל ישראלי', bank: 'פפר', account: '44718', period: '01/03/2026 - 03/04/2026' }); });
  test('כמה גיליונות: נבחר זה שיש בו תנועות; שתי עמודות תאריך: נבחר תאריך התנועה ולא תאריך הערך', () => { eq(secondSheet.sheet, 'עובר ושב'); eq(secondSheet.first, '2026-03-01'); });
  test('קידוד: עברית של Windows, מערב-אירופית, UTF-8 ו-UTF-16 מזוהים לפי התוכן', () => {
    const enc = (name) => P.files.decode(new Uint8Array(fixture(name))).encoding;
    eq([enc('windows-1255.csv'), enc('windows-1252-latin.csv'), enc('utf8-bom.csv'), enc('utf16-tabs.txt'), enc('utf16-no-bom.csv'), enc('spreadsheetml-2003.xls')], ['windows-1255', 'windows-1252', 'utf-8', 'utf-16le', 'utf-16le', 'utf-8']);
    eq(latin.n, 4); ok(latin.descs.indexOf('Señor Taco') !== -1 && latin.descs.indexOf('Crème brûlée') !== -1, JSON.stringify(latin.descs));
  });
  let biff = null; try { await P.files.read('binary-biff.xls', fixture('binary-biff.xls')); } catch (e) { biff = String(e.message); }
  let pdf = null; try { await P.files.read('statement.pdf', new TextEncoder().encode('%PDF-1.7 ...').buffer); } catch (e) { pdf = String(e.message); }
  let empty = null; try { await P.files.read('empty.csv', new ArrayBuffer(0)); } catch (e) { empty = String(e.message); }
  test('קובץ שאי אפשר לקרוא נדחה עם הסבר מה לעשות: xls בינארי, PDF, קובץ ריק', () => {
    ok(biff && /xls/.test(biff) && /xlsx/.test(biff), biff); ok(pdf && /PDF/.test(pdf), pdf); ok(empty && /ריק/.test(empty), empty);
  });

  /* ====================================================================== */
  section('מבנים של בנקים וחברות אשראי');
  // אותן 18 תנועות, בכותרות ובסידור העמודות של כל גוף — פעם מהישן לחדש ופעם מהחדש לישן.
  // בכל מבנה נבדק שהעמודות זוהו, שהכיוון של כל תנועה נכון (לפי הסכומים), ושהקליטה לא שואלת כשאין מה לשאול.
  const TRUE_TX = [
    ['2026-03-01', 'משכורת חברת הייטק בעמ', 14250], ['2026-03-01', 'שופרסל דיל רמת גן', -312.4], ['2026-03-02', 'הוראת קבע שכר דירה', -4800],
    ['2026-03-03', 'פז תחנת דלק', -250], ['2026-03-03', 'ארומה תל אביב', -38], ['2026-03-05', 'חברת החשמל', -412.75], ['2026-03-07', 'BIT העברה מדנה', 120],
    ['2026-03-08', 'רמי לוי שיווק השקמה', -540.1], ['2026-03-09', 'נטפליקס', -54.9], ['2026-03-10', 'ארומה תל אביב', -38], ['2026-03-12', 'סופר פארם', -89.9],
    ['2026-03-14', 'משיכת מזומן כספומט', -400], ['2026-03-15', 'החזר מס הכנסה', 860], ['2026-03-17', 'פנגו חניה', -22], ['2026-03-19', 'שופרסל דיל רמת גן', -287.35],
    ['2026-03-21', 'ביטוח לאומי', -310], ['2026-03-24', 'רכבת ישראל', -27.5], ['2026-03-28', 'קפה גרג', -46]
  ];
  const OPENING = 5230.55, r2 = (x) => Math.round(x * 100) / 100, ilDate = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  const sums = (tx) => [tx.length, r2(tx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0)), r2(tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0))];
  const WANT = [18, 7628.9, 15230];
  function statement(order) {
    let b = OPENING;
    const list = TRUE_TX.map((t, i) => { b = r2(b + t[2]); return { d: ilDate(t[0]), iso: t[0], desc: t[1], amt: t[2], bal: b, ref: String(10230 + i * 7) }; });
    return order === 'desc' ? list.reverse() : list;
  }
  /** אותו מסלול כמו ב-main.js: ניתוח, בנייה, והאם זה נקלט בלי חלון המיפוי */
  function take(rows) {
    const a = P.detect.analyze(rows), res = P.parse.build(rows, a.profile.headerRow, a.mapping, a.options);
    const names = {}; for (const k in a.mapping) names[k] = a.profile.columns[a.mapping[k]].name;
    return { a: a, res: res, tx: res.tx, names: names, sign: a.options.signMode, basis: a.signBasis, sums: sums(res.tx),
      auto: P.detect.confident(a) && !res.unsure.length && res.skipped <= Math.max(2, res.tx.length * 0.08), kind: P.detect.fileKind(a.profile, a.mapping, a.options) };
  }
  const PEPPER_META = [['דוח תנועות בחשבון'], ['מספר סניף', '', '123'], ['שם לקוח', '', 'ישראל ישראלי'], ['בנק', '', 'פפר'], ['מספר חשבון', '', '456789'], ['תקופת הדוח', '', '01/03/2026 - 31/03/2026'], []];
  const BANKS = {
    'פפר: סכום עם מינוס': { meta: PEPPER_META, head: ['תאריך', 'תיאור', 'סכום', 'מטבע', 'יתרה', 'אסמכתא'], row: (t) => [t.d, t.desc, t.amt, '₪', t.bal, t.ref], cols: { date: 'תאריך', desc: 'תיאור', amount: 'סכום', balance: 'יתרה', currency: 'מטבע', ref: 'אסמכתא' } },
    'פפר: טקסט, מינוס בסוף המספר': { meta: PEPPER_META, head: ['תאריך', 'תיאור', 'סכום', 'מטבע', 'יתרה', 'אסמכתא'], row: (t) => [t.d, t.desc, Math.abs(t.amt).toFixed(2) + (t.amt < 0 ? '-' : ''), 'ILS', t.bal.toFixed(2), t.ref], cols: { amount: 'סכום', balance: 'יתרה' } },
    'לאומי: בחובה / בזכות': { head: ['תאריך', 'תאריך ערך', 'תיאור', 'אסמכתא', 'בחובה', 'בזכות', 'היתרה בש"ח'], row: (t) => [t.d, t.d, t.desc, t.ref, t.amt < 0 ? -t.amt : '', t.amt > 0 ? t.amt : '', t.bal], cols: { date: 'תאריך', debit: 'בחובה', credit: 'בזכות', balance: 'היתרה בש"ח' } },
    'הפועלים: חובה / זכות': { head: ['תאריך', 'הפעולה', 'פרטים', 'אסמכתא', 'חובה', 'זכות', 'יתרה בש"ח', 'תאריך ערך', 'לטובת', 'עבור'], row: (t) => [t.d, t.desc, '', t.ref, t.amt < 0 ? -t.amt : '', t.amt > 0 ? t.amt : '', t.bal, t.d, '', ''], cols: { date: 'תאריך', debit: 'חובה', credit: 'זכות', desc: 'הפעולה' } },
    'דיסקונט: ₪ זכות/חובה': { meta: [['עובר ושב'], ['תנועות אחרונות'], []], head: ['תאריך', 'יום ערך', 'תיאור התנועה', '₪ זכות/חובה ', '₪ יתרה ', 'אסמכתה', 'עמלה', 'ערוץ ביצוע'], row: (t) => [t.d, t.d, t.desc, t.amt, t.bal, t.ref, '', 'אינטרנט'], cols: { date: 'תאריך', amount: '₪ זכות/חובה', balance: '₪ יתרה', ref: 'אסמכתה' } },
    'מזרחי: זכות לפני חובה': { head: ['תאריך', 'תאריך ערך', 'סוג תנועה', 'זכות', 'חובה', "יתרה בש''ח", 'אסמכתא'], row: (t) => [t.d, t.d, t.desc, t.amt > 0 ? t.amt : '', t.amt < 0 ? -t.amt : '', t.bal, t.ref], cols: { debit: 'חובה', credit: 'זכות', desc: 'סוג תנועה' } },
    'הבינלאומי: אפסים במקום תאים ריקים, ועמודת סוג': { head: ['תאריך', 'סוג פעולה', 'תיאור', 'אסמכתא', 'חובה', 'זכות', 'יתרה'], row: (t) => [t.d, t.amt < 0 ? 'חיוב' : 'זיכוי', t.desc, t.ref, t.amt < 0 ? -t.amt : 0, t.amt > 0 ? t.amt : 0, t.bal], cols: { debit: 'חובה', credit: 'זכות', desc: 'תיאור' } },
    'סכום בלי סימן + עמודה שכתוב בה חובה/זכות': { head: ['תאריך', 'תיאור', 'סכום', 'חובה/זכות', 'יתרה'], row: (t) => [t.d, t.desc, Math.abs(t.amt), t.amt < 0 ? 'חובה' : 'זכות', t.bal], cols: { amount: 'סכום', kind: 'חובה/זכות', balance: 'יתרה' }, sign: 'kind' },
    'אנגלית: Amount + Balance': { head: ['Date', 'Description', 'Amount', 'Currency', 'Balance'], row: (t) => [t.iso, t.desc, t.amt, 'ILS', t.bal], cols: { amount: 'Amount', balance: 'Balance', currency: 'Currency' } },
    'אנגלית: Paid out / Paid in': { head: ['Date', 'Transaction type', 'Description', 'Paid out', 'Paid in', 'Balance'], row: (t) => [t.d, t.amt < 0 ? 'DEB' : 'CR', t.desc, t.amt < 0 ? -t.amt : '', t.amt > 0 ? t.amt : '', t.bal], cols: { debit: 'Paid out', credit: 'Paid in', desc: 'Description', currency: undefined } },
    'גרמנית: כותרות לא מוכרות, לפי התוכן בלבד': { head: ['Buchungstag', 'Empfänger', 'Umsatz', 'Kontostand'], row: (t) => [t.d.replace(/\//g, '.'), t.desc, t.amt, t.bal], cols: { date: 'Buchungstag', amount: 'Umsatz', balance: 'Kontostand' }, wizard: true }
  };
  for (const name of Object.keys(BANKS)) {
    test(name, () => {
      const B = BANKS[name];
      ['asc', 'desc'].forEach((order) => {
        const got = take((B.meta || []).concat([B.head], statement(order).map(B.row)));
        eq(got.sums, WANT, order + ': תנועות, יצא, נכנס');
        for (const role in B.cols) eq(got.names[role], B.cols[role], order + ': העמודה של ' + role);
        eq(got.sign, B.sign || 'neg-out', order + ': סימן החיוב');
        ok(got.basis !== 'majority', order + ': ההחלטה על הכיוון נשענת על ' + got.basis + ', לא על ניחוש');
        eq(got.auto, !B.wizard, order + ': קליטה בלי לשאול');
        eq(got.kind, 'account', order);
      });
    });
  }
  // כרטיסי אשראי: חיוב הוא מספר חיובי, זיכוי שלילי, ואין יתרה
  const CARD_TX = TRUE_TX.filter((t) => t[2] < 0 && !/הוראת|משיכת|ביטוח/.test(t[1])).map((t) => ({ d: ilDate(t[0]), iso: t[0], desc: t[1], amt: -t[2] })).concat([{ d: '20/03/2026', iso: '2026-03-20', desc: 'זיכוי - סופר פארם', amt: -45 }]);
  const CARD_WANT = [CARD_TX.length, r2(CARD_TX.filter((t) => t.amt > 0).reduce((s, t) => s + t.amt, 0)), 45];
  const CARDS = {
    'מקס': { meta: [['כל המשתמשים (1)'], ['03/2026'], [], ['עסקאות במועד החיוב']], head: ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב', 'מטבע חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי', 'תאריך חיוב', 'הערות'],
      row: (t) => [t.d.replace(/\//g, '-'), t.desc, 'מזון וצריכה', '4417', 'רגילה', t.amt, '₪', t.amt, '₪', '10-04-2026', ''], cols: { date: 'תאריך עסקה', desc: 'שם בית העסק', amount: 'סכום חיוב', currency: 'מטבע חיוב', category: 'קטגוריה' } },
    'כאל': { meta: [['פירוט עסקאות לחשבון 12-345-678901'], ['ויזה 4417'], []], head: ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'סוג עסקה', 'ענף', 'הערות'],
      row: (t) => [t.d, t.desc, '₪ ' + t.amt.toFixed(2), '₪ ' + t.amt.toFixed(2), 'רגילה', 'מזון ומשקאות', ''], cols: { date: 'תאריך עסקה', amount: 'סכום חיוב', category: 'ענף' } },
    'ישראכרט': { meta: [['מסטרקארד - 1234'], ['עסקאות בארץ'], []], head: ['תאריך רכישה', 'שם בית עסק', 'סכום עסקה', 'מטבע עסקה', 'סכום חיוב', 'מטבע חיוב', "מס' שובר", 'פירוט נוסף'],
      row: (t) => [t.d, t.desc, t.amt, '₪', t.amt, '₪', '00' + Math.round(Math.abs(t.amt) * 7919), ''], cols: { date: 'תאריך רכישה', amount: 'סכום חיוב', currency: 'מטבע חיוב', ref: "מס' שובר" } },
    'כרטיס באנגלית (Card Member)': { head: ['Date', 'Description', 'Card Member', 'Account #', 'Amount'], row: (t) => [t.iso.slice(5, 7) + '/' + t.iso.slice(8, 10) + '/' + t.iso.slice(0, 4), t.desc, 'I ISRAELI', '-41007', t.amt], cols: { amount: 'Amount' } }
  };
  test('כרטיסי אשראי: מקס, כאל, ישראכרט וכרטיס באנגלית — חיוב חיובי הוא הוצאה, בלי לשאול', () => {
    for (const name of Object.keys(CARDS)) {
      const C = CARDS[name], got = take((C.meta || []).concat([C.head], CARD_TX.map(C.row)));
      eq(got.sums, CARD_WANT, name);
      for (const role in C.cols) eq(got.names[role], C.cols[role], name + ': העמודה של ' + role);
      eq([got.sign, got.basis, got.kind, got.auto], ['pos-out', 'header', 'card', true], name);
      eq(got.names.balance, undefined, name + ': עמודה מספרית שאינה יתרה (ארבע ספרות הכרטיס, מספר שובר) לא נקראת כיתרה');
    }
  });
  test('סכומים חיוביים בלי יתרה ובלי כותרת של "חיוב": הכיוון הוא ניחוש, ולכן נפתח חלון המיפוי', () => {
    const got = take([['תאריך', 'תיאור', 'סכום']].concat(statement('asc').map((t) => [t.d, t.desc, Math.abs(t.amt)])));
    eq([got.sign, got.basis, got.auto], ['pos-out', 'majority', false]);
  });
  test('עמודה של מילים קצרות אינה "מטבע" אם הערכים אינם מטבעות', () => {
    const got = take([['Date', 'Description', 'Type', 'Amount']].concat(statement('asc').map((t) => [t.iso, t.desc, t.amt < 0 ? 'POS' : 'TRF', t.amt])));
    eq(got.names.currency, undefined); ok(got.tx.every((t) => t.currency === '₪'));
  });
  test('חודש בלי אף הכנסה: עמודת "זכות" ריקה, ועדיין אלה חובה וזכות', () => {
    const rows = [['תאריך', 'תיאור', 'חובה', 'זכות', 'יתרה']].concat(statement('desc').filter((t) => t.amt < 0).map((t) => [t.d, t.desc, -t.amt, '', t.bal]));
    const got = take(rows);
    eq([got.names.debit, got.names.credit, got.basis, got.auto], ['חובה', 'זכות', 'columns', true]); eq(got.sums, [15, 7628.9, 0]);
  });
  test('קובץ בלי כותרות: תנועה שהתיאור שלה נשמע כמו כותרת ("זיכוי...") לא הופכת לשורת כותרות', () => {
    const rows = statement('asc').map((t, i) => [t.d, i === 6 ? 'זיכוי מחנות' : i === 9 ? 'חיוב כרטיס' : t.desc, t.amt, t.bal]);
    const got = take(rows);
    eq(got.a.profile.headerRow, -1); eq(got.sums, WANT); eq([got.a.mapping.date, got.a.mapping.desc, got.a.mapping.amount, got.a.mapping.balance], [0, 1, 2, 3]);
  });

  test('שתי טבלאות באותו גיליון, עם עמודות שונות: כל אחת נקראת לפי הכותרות שלה', () => {
    const rows = [['מסטרקארד - 1234'], ['עסקאות בארץ'],
      ['תאריך רכישה', 'שם בית עסק', 'סכום עסקה', 'מטבע עסקה', 'סכום חיוב', 'מטבע חיוב', "מס' שובר"],
      ['01/03/2026', 'שופרסל', 312.4, '₪', 312.4, '₪', '0011'], ['03/03/2026', 'פז', 250, '₪', 250, '₪', '0012'], ['', '', '', 'סך חיוב בש"ח', 562.4], [],
      ['עסקאות בחו"ל'],
      ['תאריך רכישה', 'תאריך חיוב', 'שם בית עסק', 'מטבע מקורי', 'סכום מקורי', 'מטבע לחיוב', 'סכום חיוב'],
      ['02/03/2026', '10/04/2026', 'AMAZON.COM', '$', 49.99, '₪', 187.33], ['07/03/2026', '10/04/2026', 'NETFLIX.COM', '$', 14.99, '₪', 54.9]];
    const parts = P.detect.tables(rows);
    eq(parts.map((r) => r.length), [6, 5], 'השורה "עסקאות בחו"ל" שייכת לטבלה השנייה');
    const home = take(parts[0]), abroad = take(parts[1]);
    eq([home.auto, abroad.auto], [true, true], 'שתיהן נקלטות בלי לשאול');
    eq(home.tx.map((t) => [t.desc, t.amount]), [['שופרסל', -312.4], ['פז', -250]]);
    eq(abroad.tx.map((t) => [t.date, t.desc, t.amount, t.currency]), [['2026-03-02', 'AMAZON.COM', -187.33, '₪'], ['2026-03-07', 'NETFLIX.COM', -54.9, '₪']], 'סכום החיוב בשקלים, לא הסכום המקורי בדולרים');
    // בלי החלוקה רק אחת משתי הטבלאות הייתה נקראת — והשנייה נעלמת בשקט
    eq(take(rows).tx.length, 2, 'הבדיקה עצמה: בלי חלוקה נקראת רק טבלה אחת');
  });
  test('כותרת שחוזרת על עצמה (בראש כל עמוד) אינה טבלה חדשה, וגיליון רגיל נשאר כמו שהוא', () => {
    const head = ['תאריך', 'תיאור', 'סכום', 'יתרה'];
    const rows = PEPPER_META.concat([head], statement('asc').slice(0, 9).map((t) => [t.d, t.desc, t.amt, t.bal]), [head], statement('asc').slice(9).map((t) => [t.d, t.desc, t.amt, t.bal]));
    eq(P.detect.tables(rows).length, 1); eq(take(rows).sums, WANT);
    eq(P.detect.tables(readCsv('demo.csv')[0].rows).length, 1);
  });

  /* ====================================================================== */
  section('מה עמודת היתרה מספרת');
  const unsignedRows = (order, extra) => [['תאריך', 'תיאור', 'סכום', 'יתרה']].concat(extra && order === 'asc' ? [extra] : [], statement(order).map((t) => [t.d, t.desc, Math.abs(t.amt), t.bal]), extra && order === 'desc' ? [extra] : []);
  test('סכומים בלי סימן: הכיוון של כל תנועה נקרא מהיתרה, בשני סדרי השורות', () => {
    ['asc', 'desc'].forEach((order) => {
      const got = take(unsignedRows(order));
      eq([got.sign, got.basis], ['balance', 'balance'], order); eq(got.sums, WANT, order);
    });
  });
  test('לתנועה הראשונה בדוח אין יתרה קודמת: היא מסומנת כהערכה, והקליטה עוברת דרך חלון המיפוי', () => {
    const got = take(unsignedRows('desc'));
    eq(got.res.unsure.length, 1); eq(got.tx.find((t) => t.id === got.res.unsure[0]).desc, 'משכורת חברת הייטק בעמ'); eq(got.auto, false);
    // בלי רמז בתיאור ובלי תנועה דומה — לפי הרוב, כלומר הוצאה; והיא עדיין מסומנת
    const rows = unsignedRows('asc'); rows[1][1] = 'העברה';
    const blind = take(rows);
    eq(blind.res.unsure.length, 1); eq(blind.tx[0].amount, -14250);
  });
  test('שורת "יתרת פתיחה" בקובץ נותנת גם לתנועה הראשונה יתרה קודמת — ואז אין מה לשאול', () => {
    ['asc', 'desc'].forEach((order) => {
      const got = take(unsignedRows(order, ['01/03/2026', 'יתרת פתיחה', '', OPENING]));
      eq([got.res.unsure.length, got.auto], [0, true], order); eq(got.sums, WANT, order);
    });
  });
  test('הדוח של החודש הבא: היתרה שכבר ידועה מהחודש הקודם מסבירה גם את התנועה הראשונה שלו', () => {
    const st = freshState(take(unsignedRows('desc', ['01/03/2026', 'יתרת פתיחה', '', OPENING])).tx);
    const closing = st.lastBalance().balance;
    eq(st.balanceBefore('2026-04-01'), closing); eq(st.balanceBefore('2026-03-01'), null);
    const april = [['תאריך', 'תיאור', 'סכום', 'יתרה'], ['02/04/2026', 'קפה', 20, r2(closing + 9000 - 20)], ['01/04/2026', 'העברה', 9000, r2(closing + 9000)]];
    const a = P.detect.analyze(april);
    const alone = P.parse.build(april, a.profile.headerRow, a.mapping, a.options);
    const after = P.parse.build(april, a.profile.headerRow, a.mapping, Object.assign({}, a.options, { balanceBefore: st.balanceBefore }));
    eq([alone.unsure.length, alone.tx[1].amount], [1, -9000], 'בלי היסטוריה: הערכה, ומסומנת');
    eq([after.unsure.length, after.tx[1].amount, after.tx[0].amount], [0, 9000, -20], 'עם היסטוריה: נקרא מהיתרה');
    // דוח שלא ממשיך את הקודם (חסר חודש באמצע): היתרה הישנה לא מתאימה, והשורה נשארת מסומנת
    const june = [['תאריך', 'תיאור', 'סכום', 'יתרה'], ['01/06/2026', 'העברה', 9000, r2(closing + 12345.67)], ['02/06/2026', 'קפה', 20, r2(closing + 12325.67)]];
    const j = P.detect.analyze(june);
    eq(P.parse.build(june, j.profile.headerRow, j.mapping, Object.assign({}, j.options, { balanceBefore: st.balanceBefore })).unsure.length, 1);
  });
  test('סימן הפוך (חיוב חיובי, זיכוי שלילי) עם יתרה: היתרה מכריעה, לא הרוב', () => {
    // רוב התנועות כאן הכנסות, כך ש"הסימן הנפוץ" היה טועה
    let b = 100; const list = [['01/03/2026', 'ריבית', 40], ['02/03/2026', 'הפקדה', 500], ['03/03/2026', 'עמלה', -12], ['04/03/2026', 'הפקדה', 300], ['05/03/2026', 'ריבית', 2.5]].map((t) => { b = r2(b + t[2]); return [t[0], t[1], -t[2], b]; });
    const got = take([['תאריך', 'תיאור', 'סכום', 'יתרה']].concat(list));
    eq([got.sign, got.basis, got.auto], ['pos-out', 'balance', true]); eq(got.sums, [5, 12, 842.5]);
  });
  test('ימים מהחדש לישן, ובתוך היום מהמוקדם למאוחר: השרשרת עדיין נקראת נכון', () => {
    const days = []; statement('asc').forEach((t) => { if (!days.length || days[days.length - 1][0].d !== t.d) days.push([]); days[days.length - 1].push(t); });
    const mixed = [].concat.apply([], days.slice().reverse());
    const t = P.parse.balanceTrail([['תאריך', 'תיאור', 'סכום', 'יתרה']].concat(mixed.map((x) => [x.d, x.desc, Math.abs(x.amt), x.bal])), 0, { date: 0, amount: 2 }, 3);
    eq([t.order, t.same + t.opp, t.unknown], ['asc', 17, 1]);
    eq(take([['תאריך', 'תיאור', 'סכום', 'יתרה']].concat(mixed.map((x) => [x.d, x.desc, x.amt, x.bal]))).sums, WANT);
  });
  test('שורה חסרה באמצע הדוח: התנועה שאחריה לא מוסברת, ולא מקבלת כיוון "ודאי"', () => {
    const list = statement('asc'); list.splice(7, 1);
    const got = take([['תאריך', 'תיאור', 'סכום', 'יתרה']].concat(list.map((t) => [t.d, t.desc, Math.abs(t.amt), t.bal])));
    eq(got.res.unsure.length, 2);
    const sure = got.tx.filter((t) => got.res.unsure.indexOf(t.id) === -1);
    ok(sure.every((t) => { const src = list.find((x) => x.desc === t.desc && Math.abs(x.amt) === Math.abs(t.amount)); return Math.sign(src.amt) === Math.sign(t.amount); }), 'כל תנועה שלא סומנה — בכיוון הנכון');
  });
  test('סדר התנועות בתוך היום נשמר כמו בבנק, והיתרה הסוגרת היא של התנועה האחרונה באמת', () => {
    // ארבע תנועות ביום האחרון, ואחת מהן מחזירה את היתרה למקום שבו כבר הייתה
    let b = 1000; const day = [['30/03/2026', 'סופר', -100], ['31/03/2026', 'קפה', -20], ['31/03/2026', 'החזר', 20], ['31/03/2026', 'דלק', -200], ['31/03/2026', 'מסעדה', -130]].map((t) => { b += t[2]; return [t[0], t[1], t[2], b]; });
    ['asc', 'desc'].forEach((order) => {
      const rows = [['תאריך', 'תיאור', 'סכום', 'יתרה']].concat(order === 'asc' ? day : day.slice().reverse());
      const st = freshState(take(rows).tx);
      eq(st.data.tx.map((t) => t.desc), ['מסעדה', 'דלק', 'החזר', 'קפה', 'סופר'], order + ': מהחדשה לישנה');
      eq(st.lastBalance().balance, 570, order);
      st.hydrate(JSON.parse(JSON.stringify(st.snapshot())));
      eq(st.data.tx.map((t) => t.desc), ['מסעדה', 'דלק', 'החזר', 'קפה', 'סופר'], order + ': גם אחרי שמירה וטעינה');
      eq(P.insights.month('2026-03').balance.balance, 570, order + ': יתרת סוף החודש');
    });
  });
  test('יתרת סוף החודש היא של החשבון כולו, גם כשהתנועה האחרונה שייכת לקטגוריה שהוצאה מהסיכומים', () => {
    const st = freshState(take([['תאריך', 'תיאור', 'סכום', 'יתרה'], ['30/03/2026', 'סופר', -100, 900], ['31/03/2026', 'העברה לחיסכון', -500, 400]]).tx);
    st.assign(st.data.tx.find((t) => t.desc === 'העברה לחיסכון').id, 'חיסכון'); st.setExcluded('חיסכון', true);
    eq(P.insights.month('2026-03').balance.balance, 400);
  });
  test('1,120 דוחות אקראיים בשבעה מבנים ובארבעה סדרי שורות: קליטה בלי לשאול אינה טועה אף פעם', () => {
    let seed = 20260301; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, pick = (a) => a[Math.floor(rnd() * a.length)];
    const SHOPS = ['שופרסל דיל', 'רמי לוי', 'ארומה', 'פז תחנת דלק', 'נטפליקס', 'סופר פארם', 'חברת החשמל', 'פנגו חניה', 'זיכוי מחנות', 'חיוב כרטיס'], INC = ['משכורת', 'העברה מאמא BIT', 'החזר מס הכנסה'];
    const HEAD = ['תאריך', 'תיאור', 'סכום', 'יתרה'];
    const FORMS = {
      signed: [HEAD, (t) => [t.d, t.desc, t.amt, t.bal]], unsigned: [HEAD, (t) => [t.d, t.desc, Math.abs(t.amt), t.bal]], inverted: [HEAD, (t) => [t.d, t.desc, -t.amt, t.bal]],
      split: [['תאריך', 'תיאור', 'חובה', 'זכות', 'יתרה'], (t) => [t.d, t.desc, t.amt < 0 ? -t.amt : '', t.amt > 0 ? t.amt : '', t.bal]],
      text: [HEAD, (t) => [t.d, t.desc, (t.amt < 0 ? '-' : '') + Math.abs(t.amt).toLocaleString('en-US', { minimumFractionDigits: 2 }), t.bal.toLocaleString('en-US', { minimumFractionDigits: 2 })]],
      nohead: [null, (t) => [t.d, t.desc, t.amt, t.bal]], foreign: [['Buchungstag', 'Verwendungszweck', 'Umsatz', 'Kontostand'], (t) => [t.d.replace(/\//g, '.'), t.desc, t.amt, t.bal]]
    };
    let files = 0, autos = 0;
    for (let iter = 0; iter < 40; iter++) {
      const round = rnd() < 0.3, n = pick([2, 3, 6, 12, 40, 90]);
      let day = 1, month = 1, b = r2(rnd() * 8000 - 1000);
      const list = [];
      for (let i = 0; i < n; i++) {
        if (rnd() < 0.5) { day += 1 + Math.floor(rnd() * 3); if (day > 28) { day = 1; month++; } }
        const inc = rnd() < 0.15, amt = (inc ? 1 : -1) * (round ? pick([50, 100, 100, 200]) : r2(5 + rnd() * (inc ? 9000 : 600)));
        b = r2(b + amt);
        list.push({ d: String(day).padStart(2, '0') + '/' + String(month).padStart(2, '0') + '/2026', desc: inc ? pick(INC) : pick(SHOPS), amt: amt, bal: b });
      }
      const want = [n, r2(list.filter((t) => t.amt < 0).reduce((s, t) => s - t.amt, 0)), r2(list.filter((t) => t.amt > 0).reduce((s, t) => s + t.amt, 0))];
      const days = []; list.forEach((t) => { if (!days.length || days[days.length - 1][0].d !== t.d) days.push([]); days[days.length - 1].push(t); });
      const ORDERS = { asc: list, desc: list.slice().reverse(), 'days-desc': [].concat.apply([], days.slice().reverse()), 'days-asc': [].concat.apply([], days.map((d) => d.slice().reverse())) };
      const decidable = days.length > 1 || new Set(list.map((t) => Math.abs(t.amt))).size > 1;      // יום אחד וסכום אחד: שני הסדרים עקביים
      for (const form in FORMS) for (const order in ORDERS) {
        const src = ORDERS[order], rows = (FORMS[form][0] ? [FORMS[form][0]] : []).concat(src.map(FORMS[form][1]));
        const got = take(rows), tag = form + ' ' + order + ' n=' + n + (round ? ' עגול' : '');
        const unsure = new Set(got.res.unsure);
        files++;
        if (got.auto) { autos++; eq(got.sums, want, tag + ': נקלט אוטומטית'); }
        if (['signed', 'split', 'text', 'foreign'].indexOf(form) !== -1 && n >= 3 && decidable) eq(got.sums, want, tag);
        if (form === 'unsigned' && got.sign === 'balance' && order.indexOf('days') !== 0) ok(got.tx.every((t, i) => unsure.has(t.id) || Math.sign(t.amount) === Math.sign(src[i].amt)), tag + ': תנועה שלא סומנה כהערכה היא בכיוון הנכון');
        if (same(got.sums, want) && got.a.mapping.balance != null && decidable && n >= 3) {
          const st = freshState(got.tx);
          eq(st.lastBalance().balance, list[n - 1].bal, tag + ': יתרה סוגרת');
          if (new Set(list.map((t) => Math.abs(t.amt))).size > 1) eq(st.data.tx.map((t) => t.balance), list.slice().reverse().map((t) => t.bal), tag + ': הסדר בתוך היום');
        }
      }
    }
    eq(files, 1120); ok(autos > 400, 'רק ' + autos + ' נקלטו אוטומטית');
  });

  /* ====================================================================== */
  section('סיווג ומצב (state)');
  test('טעינה: כל התנועות נכנסות, וטעינה חוזרת לא מוסיפה כלום', () => {
    const st = freshState();
    eq(st.addTransactions(demoCsv.tx, demoCsv.meta, 'demo.csv'), { added: 804, duplicates: 0 });
    eq(st.addTransactions(demoXlsx.tx, demoXlsx.meta, 'demo.xlsx'), { added: 0, duplicates: 804 });
    eq(st.data.tx.length, 804); eq(st.data.files.length, 1);
  });
  test('רוב התנועות מסווגות לבד, והשאר ממתינות', () => {
    const st = freshState(demoCsv.tx);
    const src = st.sources(); eq(src.manual, 0); ok(src.rule > 650, 'rule ' + src.rule); eq(src.none + src.inferred + src.rule + src.file, 804);
    eq(st.data.tx.filter((t) => t.cat === P.cats.OTHER).length, src.none);
    eq(st.data.tx.find((t) => /שופרסל/.test(t.desc)).cat, 'מזון ומכולת'); eq(st.data.tx.find((t) => /משכורת/.test(t.desc)).cat, 'הכנסות');
  });
  test('שיוך בית עסק שלם + כלל, וביטול שמחזיר הכל', () => {
    const st = freshState(demoCsv.tx);
    const g = st.unassigned().sort((a, b) => b.sum - a.sum)[0];
    const before = st.data.tx.filter((t) => t.cat === P.cats.OTHER).length, kws = st.data.rules['קניות וביגוד'].length;
    const res = st.assignUndoable(g.ids, 'קניות וביגוד', g.keyword);
    eq(st.data.tx.filter((t) => t.cat === P.cats.OTHER).length, before - g.count); eq(res.keywordAdded, g.keyword);
    ok(g.ids.every((id) => st.data.tx.find((t) => t.id === id).source === 'manual'));
    res.undo();
    eq(st.data.tx.filter((t) => t.cat === P.cats.OTHER).length, before); eq(st.data.rules['קניות וביגוד'].length, kws);
  });
  test('שיוך ידני גובר על כלל, ו"חזרה לסיווג אוטומטי" מבטלת אותו', () => {
    const st = freshState(demoCsv.tx);
    const t = st.data.tx.find((x) => /שופרסל/.test(x.desc));
    st.assignUndoable([t.id], 'מתנות ותרומות'); eq(st.data.tx.find((x) => x.id === t.id).cat, 'מתנות ותרומות');
    st.assignUndoable([t.id], null); eq(st.data.tx.find((x) => x.id === t.id).cat, 'מזון ומכולת'); eq(st.data.tx.find((x) => x.id === t.id).source, 'rule');
  });
  test('מילת מפתח חדשה מסווגת מיד; הסרה מחזירה לממתינות', () => {
    const st = freshState(demoCsv.tx);
    const pending = st.data.tx.filter((t) => /TLV MARKET/.test(t.desc)); ok(pending.length > 10 && pending.every((t) => t.cat === P.cats.OTHER));
    ok(st.addKeyword('מזון ומכולת', 'TLV MARKET')); ok(st.data.tx.filter((t) => /TLV MARKET/.test(t.desc)).every((t) => t.cat === 'מזון ומכולת'));
    eq(st.addKeyword('מזון ומכולת', 'tlv market'), false, 'כפילות, גם באותיות אחרות');
    st.removeKeyword('מזון ומכולת', st.data.rules['מזון ומכולת'].indexOf('TLV MARKET')); ok(st.data.tx.filter((t) => /TLV MARKET/.test(t.desc)).every((t) => t.cat === P.cats.OTHER));
  });
  test('קטגוריה שהוצאה מהספירה לא נכנסת לסיכומים', () => {
    const st = freshState(demoCsv.tx);
    const all = st.totals(st.counted()).outflow, rent = st.filter({ cat: 'דיור ושכירות' }).reduce((s, t) => s - t.amount, 0);
    st.setExcluded('דיור ושכירות', true); ok(near(st.totals(st.counted()).outflow, all - rent, 0.01)); eq(st.filter({ cat: 'דיור ושכירות' }).length, 0);
    ok(st.filter({ cat: 'דיור ושכירות', all: true }).length > 0); st.setExcluded('דיור ושכירות', false); ok(near(st.totals(st.counted()).outflow, all, 0.01));
  });
  test('חודשים, כיסוי חודש וחודש המיקוד', () => {
    const st = freshState(); st.addTransactions(demoCsv.tx, demoCsv.meta, 'demo.csv');
    const months = st.months(); eq(months.length, 12); eq(months[0].key, '2026-09'); eq(months[11].key, '2025-10');
    eq(st.coverage('2026-09').partial, false, 'דוח שמסתיים ב-01.10 מכסה את כל ספטמבר'); eq(P.insights.focusMonth(), '2026-09');
    ok(near(months.reduce((s, m) => s + m.outflow, 0), 212731, 1));
  });
  test('קובץ הוצאות בלבד (כרטיס אשראי) מזוהה, וחוזר למצב מלא כשנטען גם דוח בנק', () => {
    const st = freshState(card.tx, 'card.xlsx'); eq(st.spendOnly(), true);
    st.addTransactions(bank.tx, bank.meta, 'bank.xlsx'); eq(st.spendOnly(), false);
  });
  test('ביטול טעינה מסיר את התנועות ואת מה שנשמר עליהן', () => {
    const st = freshState(demoCsv.tx, 'demo.csv'); st.addTransactions(card.tx, {}, 'card.xlsx');
    st.assignUndoable([card.tx[0].id], 'מתנות ותרומות'); st.setNote(card.tx[1].id, 'הערה');
    st.removeTransactions(new Set(card.tx.map((t) => t.id)), 'card.xlsx');
    eq(st.data.tx.length, 804); eq(Object.keys(st.data.overrides).length, 0); eq(Object.keys(st.data.notes).length, 0); eq(st.data.files.map((f) => f.name), ['demo.csv']);
  });
  test('שמירה וטעינה מחדש נותנות אותו מצב בדיוק', () => {
    const st = freshState(demoCsv.tx, 'demo.csv');
    const t = st.data.tx[5]; st.assignUndoable([t.id], 'מתנות ותרומות', 'מילת בדיקה'); st.setNote(t.id, 'הערה'); st.rename(t.id, 'שם חדש'); st.setExcluded('העברות ומזומן', true); st.setPref('accent', 'teal');
    const snap = JSON.parse(JSON.stringify(st.snapshot())), cats = st.data.tx.map((x) => x.id + ':' + x.cat).sort();
    st.hydrate(snap);
    eq(st.data.tx.map((x) => x.id + ':' + x.cat).sort(), cats); const r = st.data.tx.find((x) => x.id === t.id);
    eq([r.desc, r.note, r.source], ['שם חדש', 'הערה', 'manual']); eq(st.data.prefs.accent, 'teal'); ok(st.data.excluded['העברות ומזומן']); ok(same(JSON.parse(JSON.stringify(st.snapshot())), snap));
  });

  /* ====================================================================== */
  section('עמידות: נתונים פגומים ושמות בעייתיים');
  test('קובץ שמור פגום לא מפיל את הטעינה — נשארות רק השורות התקינות', () => {
    const st = P.state;
    st.hydrate({ tx: [{ id: 'a', date: '2026-01-05', desc: 'תקין', amount: -10 }, { id: 'b', date: null, desc: 'בלי תאריך', amount: -5 }, { id: 'c', date: '2026-01-06', amount: 'לא מספר' },
      null, 'מחרוזת', { id: 'a', date: '2026-01-07', desc: 'מזהה כפול', amount: -1 }, { id: 'd', date: '2026-13-45x', amount: -3 }, { id: 'e', date: '2026-01-09', desc: 42, amount: '-7.5' }],
      rules: 'לא אובייקט', overrides: ['מערך'], notes: null, files: { not: 'array' }, profiles: 7, excluded: 'x', prefs: { theme: 'ורוד', accent: {}, intro: 5 } });
    eq(st.data.tx.map((t) => t.id).sort(), ['a', 'e']); eq(st.data.tx.find((t) => t.id === 'e').amount, -7.5); eq(st.data.tx.find((t) => t.id === 'e').desc, '42');
    ok(Object.keys(st.data.rules).length > 15, 'כללי ברירת המחדל'); eq(st.data.files, []); eq(st.data.prefs.theme, 'auto'); eq(st.data.prefs.accent, 'ink');
    [undefined, null, 5, 'x', [], { tx: 'x' }].forEach((bad) => { st.hydrate(bad); eq(st.data.tx.length, 0); });
  });
  test('שמות כמו "constructor" ו-"__proto__" הם קטגוריות ובתי עסק רגילים', () => {
    const names = ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'];
    const lines = ['תאריך,תיאור,סכום,קטגוריה'];
    for (let m = 1; m <= 4; m++) names.forEach((n, i) => lines.push('0' + (i + 1) + '/0' + m + '/2026,' + n + ',-' + (10 * (i + 1) + m) + ',' + names[(i + 1) % names.length]));
    const r = ingest(csvOf(lines)); const st = freshState(r.tx);
    eq(st.data.tx.length, 20); names.forEach((n) => ok(Object.keys(st.data.rules).indexOf(n) !== -1, 'קטגוריה ' + n));
    eq(st.byCategory(st.data.tx).length, names.length); eq(st.byMerchant(st.data.tx).length, names.length);
    st.assignUndoable([st.data.tx[0].id], 'constructor', 'toString'); ok(st.addKeyword('__proto__', 'valueOf'));
    st.setExcluded('constructor', true); st.setExcluded('constructor', false); P.insights.cards(P.insights.month(P.insights.focusMonth()), 4);
    st.hydrate(JSON.parse(JSON.stringify(st.snapshot()))); names.forEach((n) => ok(Object.keys(st.data.rules).indexOf(n) !== -1, 'אחרי שמירה: ' + n));
    eq(({}).polluted, undefined); eq(Object.prototype.toString.call({}), '[object Object]'); eq(({}).constructor, Object);
  });

  // קובץ xlsx זעיר שנבנה כאן ביד (ZIP בלי דחיסה), כדי לבדוק גם קבצים שלא יצאו מאקסל — כולל פגומים וזדוניים
  function zipOf(files, tamper) {
    const enc = new TextEncoder(), parts = [], central = [];
    let at = 0;
    Object.keys(files).forEach((name) => {
      const n = enc.encode(name), d = enc.encode(files[name]);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint32(18, d.length, true); local.setUint32(22, d.length, true); local.setUint16(26, n.length, true);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint32(20, d.length, true); cd.setUint32(24, d.length, true); cd.setUint16(28, n.length, true); cd.setUint32(42, at, true);
      if (tamper) tamper(name, cd);
      parts.push(new Uint8Array(local.buffer), n, d); central.push(new Uint8Array(cd.buffer), n);
      at += 30 + n.length + d.length;
    });
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true); end.setUint32(12, cdSize, true); end.setUint32(16, at, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]), out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
    let o = 0; all.forEach((c) => { out.set(c, o); o += c.length; });
    return out.buffer;
  }
  const tinyXlsx = (sheetData, tamper) => zipOf({
    'xl/workbook.xml': '<workbook><sheets><sheet name="גיליון" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData>' + sheetData + '</sheetData></worksheet>'
  }, tamper);
  const attempt = async (buf) => { try { return { rows: (await P.xlsx.read(buf))[0].rows }; } catch (e) { return { error: String(e && e.message) }; } };
  const text = (ref, v) => '<c r="' + ref + '" t="inlineStr"><is><t>' + v + '</t></is></c>';
  const gap = await attempt(tinyXlsx('<row r="1">' + text('A1', 'תאריך') + text('B1', 'סכום') + '</row><row r="2" spans="1:2"/><row r="3">' + text('A3', '05/03/2026') + '<c r="B3"><v>-42.5</v></c></row>'));
  test('גיליון Excel: שורה ריקה שנסגרת בעצמה לא "בולעת" את השורה שאחריה', () => {
    ok(!gap.error, gap.error); eq(gap.rows.length, 3); eq(gap.rows[0], ['תאריך', 'סכום']); eq(gap.rows[1], []); eq(gap.rows[2], ['05/03/2026', -42.5]);
  });
  const hostile = await attempt(tinyXlsx('<row r="99999999999"><c r="A1"><v>1</v></c></row><row r="2"><c r="ZZZZZZZ2"><v>7</v></c>' + text('B2', 'א&#x110000;ב&#xD800;ג&#65;&amp;') + '</row>'));
  test('גיליון Excel: מיקום מחוץ לגבולות הגיליון ותו לא חוקי נזרקים, והקריאה ממשיכה', () => {
    ok(!hostile.error, hostile.error); ok(hostile.rows.length <= 2, 'שורות: ' + hostile.rows.length); eq(hostile.rows[1][1], 'אבגA&'); eq(hostile.rows[1].length, 2);
  });
  const emptyStrings = await attempt(zipOf({
    'xl\\workbook.xml': '<workbook><sheets><sheet name="גיליון" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl\\_rels\\workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl\\sharedStrings.xml': '<sst><si/><si><t>תאריך</t></si><si><r><t/></r><r><t xml:space="preserve">קפה </t></r><r><t>גרג</t></r></si><si><t/></si><si><t>סכום</t></si></sst>',
    'xl\\worksheets\\sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1" t="s"><v>4</v></c><c r="C1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>-18</v></c><c r="C2" t="s"><v>3</v></c><c r="D2" t="inlineStr"><is><r><t/></r><r><t>הערה</t></r></is></c></row></sheetData></worksheet>'
  }));
  test('גיליון Excel: מחרוזת ריקה (‎<si/>‎, ‎<t/>‎) לא מזיזה את המחרוזות שאחריה; נתיבים עם לוכסן הפוך נקראים', () => {
    ok(!emptyStrings.error, emptyStrings.error); eq(emptyStrings.rows[0], ['תאריך', 'סכום']); eq(emptyStrings.rows[1], ['קפה גרג', -18, , 'הערה']);
  });
  const notZip = await attempt(new TextEncoder().encode('זה לא קובץ אקסל, רק טקסט שמתחזה לאחד').buffer);
  const cut = await attempt(tinyXlsx('<row r="1">' + text('A1', 'x') + '</row>').slice(0, 60));
  const badOffset = await attempt(tinyXlsx('<row r="1">' + text('A1', 'x') + '</row>', (name, cd) => { if (/sheet1/.test(name)) cd.setUint32(42, 0x7fffffff, true); }));
  const badSize = await attempt(tinyXlsx('<row r="1">' + text('A1', 'x') + '</row>', (name, cd) => { if (/sheet1/.test(name)) cd.setUint32(20, 0x7ffffff0, true); }));
  test('ארכיון שאינו ZIP, קטוע, או שמצביע אל מחוץ לקובץ — נדחה בהודעה, בלי לקרוס', () => {
    [notZip, cut, badOffset, badSize].forEach((r, i) => { ok(r.error && !r.rows, 'מקרה ' + i + ' היה אמור להידחות'); ok(/ארכיון|גיליונות|רשומה/.test(r.error), 'מקרה ' + i + ': ' + r.error); });
  });

  /* ====================================================================== */
  section('המנוע הלומד (learn)');
  const st = freshState(); st.addTransactions(demoCsv.tx, demoCsv.meta, 'demo.csv');
  test('סניפים שונים של אותה רשת מתקבצים לבית עסק אחד', () => {
    eq(P.learn.merchantKey('פז יעלים דלק'), P.learn.merchantKey('פז גלילות')); eq(P.learn.merchantKey('PAYPAL *SPOTIFY'), 'spotify');
    ok(P.learn.merchantKey('שופרסל דיל רמת אביב') !== P.learn.merchantKey('רמי לוי שיווק השקמה'));
    const g = st.byMerchant(st.data.tx.filter((t) => /wolt/i.test(t.desc))); eq(g.length, 1); eq(g[0].count, 90);
  });
  test('חיובים קבועים מזוהים לפי הקצב, עם הסכום והתדירות', () => {
    const rec = P.learn.recurring(st.counted());
    const rent = rec.find((r) => /שכר דירה/.test(r.label)); ok(rent, 'שכר דירה'); eq(rent.cadence, 'חודשי'); ok(near(rent.amount, 6200, 1)); ok(rent.active);
    ok(rec.some((r) => /spotify/i.test(r.label)) && rec.some((r) => /netflix/i.test(r.label)));
    ok(!rec.some((r) => /שופרסל|wolt/i.test(r.label)), 'קניות תכופות אינן "חיוב קבוע"');
  });
  test('חיוב חריג: גבוה בהרבה מהרגיל אצל אותו בית עסק', () => {
    const an = P.learn.anomalies(st.counted(), 6); ok(an.length >= 1 && an.length <= 6);
    an.forEach((a) => ok(a.ratio >= 2.5 && Math.abs(a.tx.amount) > a.usual, a.merchant + ' ×' + a.ratio));
  });
  test('הצעת קטגוריה לפי תנועות דומות שכבר סווגו', () => {
    const s = P.learn.suggest('שופרסל אקספרס דיזנגוף', st.data.tx, 3); ok(s.length && s[0].cat === 'מזון ומכולת', JSON.stringify(s.map((x) => x.cat)));
    eq(P.learn.suggest('משהו שלא נראה מעולם xyzq', st.data.tx, 3).length, 0);
  });
  test('מילת המפתח המוצעת קצרה ומזהה, בלי מספרי סניף', () => {
    eq(P.learn.keywordFor('TLV MARKET 4471', st.data.tx), 'TLV MARKET'); eq(P.learn.keywordFor('רמי לוי שיווק השקמה', st.data.tx), 'רמי לוי');
  });
  test('כריית כללים: אחרי שיוכים ידניים, המנוע מציע את הכלל בעצמו', () => {
    const s2 = freshState(demoCsv.tx);
    const g = s2.unassigned().find((x) => /TLV MARKET/.test(x.label)); s2.assignUndoable(g.ids, 'מזון ומכולת');
    const mined = P.learn.mineRules(s2.data.tx, s2.data.rules, { minDocs: 2, minPurity: 0.88, max: 6 });
    const hit = mined.find((r) => /tlv market/i.test(r.keyword)); ok(hit && hit.cat === 'מזון ומכולת' && hit.docs === g.count, JSON.stringify(mined.map((r) => r.keyword)));
  });
  test('ביצועים: 10,000 תנועות מסווגות בפחות משתי שניות', () => {
    const big = []; for (let i = 0; i < 10000; i++) { const t = demoCsv.tx[i % 804]; big.push(Object.assign({}, t, { id: t.id + '-' + i })); }
    const t0 = Date.now(); freshState(big); const ms = Date.now() - t0; ok(ms < 2000, ms + 'ms');
  });

  /* ====================================================================== */
  section('סיכומים במילים (insights, format)');
  freshState(); P.state.addTransactions(demoCsv.tx, demoCsv.meta, 'demo.csv');
  test('סיכום חודש: שינוי מהחודש הקודם, עודף או גירעון, והקטגוריה המובילה', () => {
    const lines = P.insights.summary(P.insights.month('2026-09')).map(plain);
    eq(lines.length, 3); ok(/ירידה של 14% בהוצאות לעומת אוגוסט/.test(lines[0]), lines[0]); ok(/נכנסו ₪18,310.*עודף של ₪1,751/.test(lines[1]), lines[1]); ok(/לדיור ושכירות/.test(lines[2]), lines[2]);
    ok(/יצא יותר משנכנס, בפער של ₪1,037/.test(P.insights.summary(P.insights.month('2026-08')).map(plain).join(' ')));
  });
  test('עד ארבע תובנות לחודש, ממוינות לפי חשיבות, ולכל אחת פעולה', () => {
    const cards = P.insights.cards(P.insights.month('2026-06'), 4); ok(cards.length >= 2 && cards.length <= 4);
    for (let i = 1; i < cards.length; i++) ok(cards[i - 1].score >= cards[i].score); cards.forEach((c) => ok(c.title && c.text && c.action && c.action.type));
  });
  test('קובץ הוצאות בלבד: בלי "עודף", "גירעון" או "נכנסו"', () => {
    freshState(card.tx, 'card.xlsx');
    const months = P.state.months(); const text = months.map((m) => P.insights.summary(P.insights.month(m.key)).join(' ')).join(' ') + P.insights.flowTakeaway(months) + P.insights.cumulativeTakeaway(months) +
      months.map((m) => P.insights.cards(P.insights.month(m.key), 4).map((c) => c.title + c.text).join(' ')).join(' ');
    ok(!/עודף|גירעון|נכנסו|שנכנס/.test(text), plain(text).slice(0, 200)); ok(/בממוצע יוצאים/.test(P.insights.flowTakeaway(months)));
  });
  test('פורמט: כסף, אחוזים, רבים, אותיות שימוש', () => {
    const f = P.fmt; eq(f.money(-1234.5), '₪1,235'); eq(plain(f.signed(-1037)), '−₪1,037'); eq(plain(f.signed(1751)), '+₪1,751'); eq(plain(f.signed(-12.5, true)), '−₪12.50');
    eq(f.pct(0.1449), '14%'); eq(f.plural(1, 'תנועה', 'תנועות'), 'תנועה אחת'); eq(f.plural(2, 'תנועה', 'תנועות'), '2 תנועות'); eq(f.plural(1, 'חודש', 'חודשים', 'חודש אחד'), 'חודש אחד');
    eq(f.prefix('ל', 'דיור ושכירות'), 'לדיור ושכירות'); eq(f.prefix('ל', 'Netflix'), 'ל-Netflix'); eq(f.monthName('2026-09'), 'ספטמבר 2026'); eq(f.addMonths('2026-01', -1), '2025-12');
    eq(f.esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
  });
  test('סכום עם סימן עטוף בבידוד כיווני, כדי שלא יתהפך בתוך משפט בעברית', () => { ok(/^⁦.*⁩$/.test(P.fmt.signed(-5))); });

  /* ====================================================================== */
  section('הדמיות: העובדות שכל רצף מספר (insights)');
  freshState(); P.state.addTransactions(demoCsv.tx, demoCsv.meta, 'demo.csv');
  test('סיפור החודש: הסכום שרץ הוא בדיוק סכום הימים, והקטגוריות והרגעים אמיתיים', () => {
    const s = P.insights.monthStory('2026-09'), m = P.insights.month('2026-09');
    eq(s.days.length, 30); ok(near(s.days.reduce((a, v) => a + v, 0), s.total, 0.01), 'ימים מול סך'); ok(near(s.total, m.totals.outflow, 0.01));
    eq(plain(s.note), '▼ 14% לעומת אוגוסט'); eq(s.tone, 'good');
    ok(s.cats.length <= 5 && s.cats.every((c, i) => !i || s.cats[i - 1].sum >= c.sum)); eq(s.cats[0].cat, 'דיור ושכירות');
    eq(s.moments.map((x) => x.kind).join(','), 'big,regular,peak');
    ok(near(s.moments[0].amount, Math.max(...m.expense.map((t) => -t.amount)), 0.01), 'ההוצאה הגדולה');
    eq(s.lines.length, 3);
  });
  test('סיפור השנה: 12 החודשים האחרונים מהישן לחדש, וסכום החודשים שווה לסכום הקטגוריות', () => {
    const y = P.insights.yearStory();
    eq(y.months.length, 12); eq(y.from, '2025-10'); eq(y.to, '2026-09');
    ok(y.months.every((x, i, a) => !i || a[i - 1].key < x.key));
    ok(near(y.total, y.cats.reduce((a, c) => a + c.sum, 0), 0.05)); ok(y.hi.outflow >= y.avg && y.lo.outflow <= y.avg); eq(y.surplus, 7);
    eq(P.insights.yearStory('2026').months.length, 9);
  });
  test('הקבועות של השנה הקרובה: 12 חודשים מהחודש שאחרי הנתונים, וחיוב חודשי יורד בכל אחד', () => {
    const r = P.insights.recurringYear(6);
    eq(r.start, '2026-10'); eq(r.keys.length, 12); ok(near(r.total, r.cols.reduce((a, c) => a + c.total, 0), 0.01));
    const rent = r.rows.findIndex((x) => /שכר דירה/.test(x.label)); ok(rent > -1, 'שכר דירה');
    ok(r.cols.every((c) => near(c.parts[rent], 6200, 1)), 'שכר דירה בכל חודש'); ok(near(r.monthly, r.total / 12, 0.01));
  });
  test('קובץ הוצאות בלבד: גם בסיפור החודש בלי "עודף" או "נכנסו"', () => {
    freshState(card.tx, 'card.xlsx');
    const s = P.insights.monthStory(P.insights.focusMonth());
    ok(s.count > 0); ok(!/עודף|גירעון|נכנסו/.test(s.lines.join(' ')), plain(s.lines.join(' ')));
  });

  /* ====================================================================== */
  section('צבע (tokens.css)');
  {
    // סימולציה של עיוורון צבעים (Machado, Oliveira & Fernandes 2009, חומרה מלאה) ומרחק צבע CIEDE2000
    const CVD = {
      'ראייה רגילה': [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      'פרוטנופיה': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
      'דאוטרנופיה': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
      'טריטנופיה': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
    };
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const seen = (hex, m) => { const l = rgb(hex).map(lin); return m.map((row) => Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))); };
    const lab = (l) => {
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const x = f((0.4124564 * l[0] + 0.3575761 * l[1] + 0.1804375 * l[2]) / 0.95047), y = f(0.2126729 * l[0] + 0.7151522 * l[1] + 0.0721750 * l[2]), z = f((0.0193339 * l[0] + 0.1191920 * l[1] + 0.9503041 * l[2]) / 1.08883);
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const deg = (r) => r * 180 / Math.PI, rad = (d) => d * Math.PI / 180;
    function dE(p, q) {
      const C1 = Math.hypot(p[1], p[2]), C2 = Math.hypot(q[1], q[2]), Cb = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
      const a1 = (1 + G) * p[1], a2 = (1 + G) * q[1], c1 = Math.hypot(a1, p[2]), c2 = Math.hypot(a2, q[2]);
      const hue = (a, b) => (a || b ? (deg(Math.atan2(b, a)) + 360) % 360 : 0), h1 = hue(a1, p[2]), h2 = hue(a2, q[2]);
      const dh = c1 * c2 === 0 ? 0 : (Math.abs(h2 - h1) <= 180 ? h2 - h1 : (h2 - h1 > 180 ? h2 - h1 - 360 : h2 - h1 + 360));
      const dL = q[0] - p[0], dC = c2 - c1, dH = 2 * Math.sqrt(c1 * c2) * Math.sin(rad(dh / 2)), Lb = (p[0] + q[0]) / 2, Cp = (c1 + c2) / 2;
      const hb = c1 * c2 === 0 ? h1 + h2 : (Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2));
      const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) + 0.32 * Math.cos(rad(3 * hb + 6)) - 0.20 * Math.cos(rad(4 * hb - 63));
      const Sl = 1 + 0.015 * Math.pow(Lb - 50, 2) / Math.sqrt(20 + Math.pow(Lb - 50, 2)), Sc = 1 + 0.045 * Cp, Sh = 1 + 0.015 * Cp * T;
      const Rt = -2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7))) * Math.sin(rad(60 * Math.exp(-Math.pow((hb - 275) / 25, 2))));
      return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
    }
    const css = fs.readFileSync(path.join(ROOT, 'assets/css/tokens.css'), 'utf8');
    const defs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => { const all = css.match(new RegExp('--c' + n + ':\\s*#[0-9a-fA-F]{6}', 'g')) || []; return all.map((d) => d.slice(d.indexOf('#'))); });
    const closest = (colors, m) => { let min = Infinity; colors.forEach((a, i) => colors.forEach((b, j) => { if (j > i) min = Math.min(min, dE(lab(seen(a, m)), lab(seen(b, m)))); })); return min; };
    test('שמונה צבעי קטגוריות, אותם צבעים בבהיר ובכהה', () => { defs.forEach((d, i) => eq(d.length, 1, '--c' + (i + 1) + ' מוגדר פעם אחת')); });
    const palette = defs.map((d) => d[0]);
    test('מרחק צבע: שחור מול לבן 100, וצבע מול עצמו 0 (בדיקת החישוב עצמו)', () => {
      ok(near(dE(lab(seen('#000000', CVD['ראייה רגילה'])), lab(seen('#ffffff', CVD['ראייה רגילה']))), 100, 0.01)); eq(dE(lab([0.2, 0.4, 0.6]), lab([0.2, 0.4, 0.6])), 0);
      ok(closest(['#3d7be6', '#8a63e6'], CVD['דאוטרנופיה']) < 3, 'כחול וסגול בבהירות דומה מתמזגים בדאוטרנופיה — הסימולציה חייבת לתפוס את זה');
    });
    test('צבעי הקטגוריות נבדלים זה מזה גם בעיוורון צבעים (ΔE2000 ≥ 11, כמו בפלטת Okabe–Ito)', () => {
      const got = {}; Object.keys(CVD).forEach((k) => { got[k] = +closest(palette, CVD[k]).toFixed(1); });
      ok(got['ראייה רגילה'] >= 18 && got['פרוטנופיה'] >= 11 && got['דאוטרנופיה'] >= 11 && got['טריטנופיה'] >= 11, JSON.stringify(got));
    });
  }

  /* ---------- סיכום ---------- */
  console.log('\n' + (failed.length ? '✗ ' + failed.length + ' נכשלו, ' : '✓ ') + passed + ' עברו');
  if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
