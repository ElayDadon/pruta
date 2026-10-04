/* ==========================================================================
   core/detect.js — זיהוי מבנה של כל קובץ טבלאי, לא רק של דוח פפר.
   מנתח כל עמודה (כמה ממנה תאריכים, כמה מספרים, כמה ייחודית), מנחש איפה
   שורת הכותרות, איזו עמודה היא מה, ואיזה סימן מייצג חיוב — ומחזיר הכל
   כהצעה שהמשתמש יכול לתקן באשף הייבוא.
   ========================================================================== */
window.P = window.P || {};

P.detect = (function () {
  'use strict';

  const ROLES = [
    { key: 'date',     label: 'תאריך',        required: true,  hint: 'מתי בוצעה התנועה' },
    { key: 'desc',     label: 'תיאור',        required: false, hint: 'שם בית העסק או הפעולה' },
    { key: 'amount',   label: 'סכום',         required: false, hint: 'עמודה אחת עם חיובים וזיכויים' },
    { key: 'debit',    label: 'חובה',         required: false, hint: 'אם החיובים בעמודה נפרדת' },
    { key: 'credit',   label: 'זכות',         required: false, hint: 'אם הזיכויים בעמודה נפרדת' },
    { key: 'kind',     label: 'סוג תנועה',    required: false, hint: 'עמודה שכתוב בה חובה/זכות' },
    { key: 'balance',  label: 'יתרה',         required: false, hint: 'היתרה אחרי התנועה' },
    { key: 'currency', label: 'מטבע',         required: false, hint: 'ברירת מחדל: ₪' },
    { key: 'ref',      label: 'אסמכתא',       required: false, hint: 'מספר האסמכתא או הזיהוי' },
    { key: 'category', label: 'קטגוריה בקובץ', required: false, hint: 'אם הקובץ כבר מסווג — נשתמש בזה' }
  ];

  const NAME_HINTS = {
    date:     [/^(תאריך|תאריך ערך|ת ערך|יום ערך|תאריך עסקה|תאריך חיוב|תאריך הפעולה|date|value date|booking date|transaction date|posted|datum|fecha)/],
    desc:     [/(תיאור|פירוט|פרטים|שם בית העסק|בית עסק|שם העסק|תנועה|פעולה|הפעולה|נמען|ספק|מוטב|description|narrative|details|merchant|payee|memo|omschrijving|beschreibung|verwendungszweck|libell|concepto|descrip)/],
    amount:   [/^(סכום|סכום התנועה|סכום בשח|סכום חיוב|זכות חובה|חובה זכות|amount|sum|value|total|bedrag|betrag|montant|importe)/],
    debit:    [/^ב?(חובה|חיוב|סכום חובה|סכום בחובה|סכום חיוב|משיכה|משיכות|debit|withdrawal|paid out|money out)/],
    credit:   [/^ב?(זכות|זיכוי|סכום זכות|סכום בזכות|סכום זיכוי|הפקדה|הפקדות|credit|deposit|paid in|money in)/],
    kind:     [/^(סוג|סוג תנועה|סוג הפעולה|סוג פעולה|חובה זכות|זכות חובה|type|dc|direction)/],
    balance:  [/(יתרה|balance|saldo|solde|kontostand)/],
    currency: [/^(מטבע|סוג מטבע|currency|ccy)/],
    ref:      [/(אסמכת|אישור|שובר|מזהה|reference|(^| )(ref|id)( |$))/],
    category: [/^(קטגוריה|סיווג|ענף|תחום|קבוצה|category|mcc|merchant category|סוג הוצאה|נושא)/]
  };

  const OUTFLOW_WORDS = /^(חובה|חיוב|ח|משיכה|הוצאה|debit|dbit|dr|d|withdrawal|out|-)$/i;
  const INFLOW_WORDS = /^(זכות|זיכוי|ז|הפקדה|הכנסה|credit|crdt|cr|c|deposit|in|\+)$/i;
  // ערכים של עמודת מטבע: סימן, שם, או קוד מוכר. שלוש אותיות סתם ("DEB") אינן מטבע
  const CURRENCY_VALUE = /^(₪|\$|€|£|¥|ש"ח|ש״ח|שח|שקל|שקלים|שקל חדש|דולר|אירו|יורו|ils|nis|usd|eur|gbp|chf|jpy|cad|aud|cny|sek|nok|dkk|pln|czk|huf|try|thb|rub|inr|brl|mxn|zar|aed|egp|jod|ron|bgn|nzd|sgd|hkd|krw|gel|uah)$/i;

  function letter(i) {
    let s = '';
    i += 1;
    while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  const isBlank = (v) => v == null || String(v).trim() === '';

  /** כמה "דמוי נתונים" שורה נראית: יחס התאים שהם תאריך או מספר */
  function dataScore(row) {
    let filled = 0, dataish = 0;
    for (const v of row) {
      if (isBlank(v)) continue;
      filled++;
      if (v instanceof Date || P.parse.date(v) || P.parse.isNumeric(v)) dataish++;
    }
    return filled ? dataish / filled : 0;
  }

  /** תאריך, מספר או טקסט — לכל תא; שתי שורות "באותה צורה" כשרוב התאים שלהן מאותו סוג */
  const cellType = (v) => (isBlank(v) ? '' : typeof v === 'number' ? 'n' : v instanceof Date || P.parse.date(v) ? 'd' : P.parse.isNumeric(v) ? 'n' : 't');
  function sameShape(a, b) {
    let same = 0, n = 0;
    for (let c = 0; c < Math.max(a.length, b.length); c++) {
      const x = cellType(a[c]), y = cellType(b[c]);
      if (!x && !y) continue;
      n++;
      if (x === y) same++;
    }
    return n > 0 && same / n >= 0.75;
  }
  /** השורה הלא-ריקה הקרובה, למעלה (step = -1) או למטה (step = 1) */
  function neighbour(rows, i, step) {
    for (let j = i + step; j >= 0 && j < rows.length && Math.abs(j - i) <= 6; j += step) {
      if (rows[j] && rows[j].some((v) => !isBlank(v))) return rows[j];
    }
    return null;
  }

  /** מחפש את שורת הכותרות: שורת טקסט קצר שמתחתיה עמודות עקביות */
  function guessHeaderRow(rows) {
    const limit = Math.min(rows.length, 60);
    let best = { row: -1, score: -Infinity };
    for (let i = 0; i < limit; i++) {
      const row = rows[i] || [];
      const filled = row.filter((v) => !isBlank(v)).length;
      if (filled < 2) continue;
      if (dataScore(row) >= 0.5) continue;                 // שורה שרובה תאריכים ומספרים היא נתונים
      // שורה שמעליה ומתחתיה שורות נתונים באותה צורה יושבת בתוך הנתונים — זו תנועה שהתיאור שלה
      // נשמע כמו כותרת ("זיכוי...", "חיוב..."), לא כותרת
      const up = neighbour(rows, i, -1), down = neighbour(rows, i, 1);
      if (up && down && dataScore(up) > 0.5 && dataScore(down) > 0.5 && sameShape(up, down)) continue;

      let score = 0;
      const textish = row.filter((v) => !isBlank(v) && !(v instanceof Date) && !P.parse.isNumeric(v) && !P.parse.date(v) && String(v).trim().length <= 34).length;
      score += textish * 1.4;
      score -= dataScore(row) * 8;                       // אם השורה עצמה נתונים — זו לא כותרת

      // כמה שמות מוכרים יש בה
      let hints = 0;
      for (const v of row) {
        const n = P.parse.norm(v);
        if (!n) continue;
        for (const key in NAME_HINTS) if (NAME_HINTS[key].some((re) => re.test(n))) { hints++; break; }
      }
      score += hints * 3.5;

      // האם מתחתיה יש גוף נתונים אמיתי
      let below = 0, seen = 0;
      for (let j = i + 1; j < Math.min(rows.length, i + 16); j++) {
        const r = rows[j] || [];
        if (!r.filter((v) => !isBlank(v)).length) continue;
        seen++; below += dataScore(r);
      }
      if (seen) score += (below / seen) * 10;
      score -= i * 0.12;                                  // בשוויון, מעדיפים את המוקדמת

      if (score > best.score) best = { row: i, score: score };
    }
    // אין כותרות בכלל? הנתונים מתחילים בשורה הראשונה
    if (best.row < 0 || best.score < 4) {
      const firstData = rows.findIndex((r) => r && dataScore(r) > 0.5);
      if (firstData === 0) return -1;
    }
    return best.row < 0 ? 0 : best.row;
  }

  /** שורת כותרות של טבלת תנועות: רק טקסט, ויש בה גם שם של עמודת תאריך וגם שם של עמודת סכום */
  function looksLikeHeader(row) {
    if (!row) return false;
    let filled = 0, dateName = false, amountName = false;
    for (const v of row) {
      if (isBlank(v)) continue;
      filled++;
      if (cellType(v) !== 't') return false;
      const n = P.parse.norm(v).replace(/^[₪$€£]\s*/, '');
      if (NAME_HINTS.date.some((re) => re.test(n))) dateName = true;
      else if (NAME_HINTS.amount.concat(NAME_HINTS.debit, NAME_HINTS.credit).some((re) => re.test(n))) amountName = true;
    }
    return filled >= 3 && dateName && amountName;
  }

  /**
   * גיליון שיש בו כמה טבלאות זו מתחת לזו — עסקאות בארץ, ומתחתיהן עסקאות בחו"ל עם עמודות אחרות.
   * כל טבלה צריכה את שורת הכותרות שלה; קריאה של השנייה לפי העמודות של הראשונה הייתה מציבה
   * "סכום מקורי" בדולרים במקום "סכום חיוב". מחזיר את הגיליון מחולק לטבלאות (או כמו שהוא, כשיש אחת).
   * כותרת שחוזרת על עצמה (בראש כל עמוד) אינה טבלה חדשה.
   * @param {any[][]} rows
   * @returns {any[][][]}
   */
  function tables(rows) {
    const starts = [];
    let last = null;
    for (let i = 0; i < rows.length; i++) {
      if (!looksLikeHeader(rows[i])) continue;
      const key = rows[i].map((v) => P.parse.norm(v)).join('|');
      if (last === null) { last = key; continue; }
      if (key === last) continue;
      const below = neighbour(rows, i, 1);
      if (!below || dataScore(below) === 0) continue;       // אין מתחתיה נתונים — זו לא טבלה
      // שורות הכותרת שמעל הטבלה ("עסקאות בחו"ל") שייכות לה, לא לסוף הטבלה הקודמת
      let at = i;
      while (at > 0 && dataScore(rows[at - 1] || []) === 0 && !looksLikeHeader(rows[at - 1])) at--;
      starts.push(at); last = key;
    }
    if (!starts.length) return [rows];
    const out = [];
    let from = 0;
    starts.concat([rows.length]).forEach((to) => { out.push(rows.slice(from, to)); from = to; });
    return out;
  }

  /** פרופיל לכל עמודה: שמות, דוגמאות ויחסי טיפוסים */
  function profile(rows, headerRow) {
    if (headerRow == null) headerRow = guessHeaderRow(rows);
    const start = headerRow + 1;
    const width = rows.reduce((m, r) => Math.max(m, (r || []).length), 0);
    const head = headerRow >= 0 ? (rows[headerRow] || []) : [];
    // שורת כותרות שחוזרת בהמשך הקובץ (בראש כל עמוד) אינה נתונים, ולא נספרת כשמאפיינים את העמודות
    const text = (v) => String(v == null ? '' : v).trim();
    const lead = head.findIndex((v) => !isBlank(v));
    const isHeadAgain = (r) => lead >= 0 && text(r[lead]) === text(head[lead]) && head.every((v, c) => text(v) === text(r[c]));
    const body = rows.slice(start).filter((r) => r && r.some((v) => !isBlank(v)) && !isHeadAgain(r));
    const sampleRows = body.slice(0, 220);

    const columns = [];
    for (let c = 0; c < width; c++) {
      const vals = sampleRows.map((r) => r[c]);
      const filled = vals.filter((v) => !isBlank(v));
      const dates = filled.filter((v) => v instanceof Date || P.parse.date(v)).length;
      const nums = filled.filter((v) => P.parse.isNumeric(v)).length;
      const parsedNums = filled.filter((v) => P.parse.isNumeric(v)).map((v) => P.parse.amount(v)).filter((n) => n != null);
      const neg = parsedNums.filter((n) => n < 0).length;
      const distinct = new Set(filled.map((v) => String(v).trim())).size;
      const avgLen = filled.length ? filled.reduce((s, v) => s + String(v).trim().length, 0) / filled.length : 0;
      const dirWords = filled.filter((v) => describeKind(v) !== 0).length;
      const curWords = filled.filter((v) => CURRENCY_VALUE.test(P.parse.clean(v))).length;
      const intLike = parsedNums.length ? parsedNums.filter((n) => Number.isInteger(n) && Math.abs(n) >= 1000).length / parsedNums.length : 0;
      const magnitude = parsedNums.length ? parsedNums.reduce((s, n) => s + Math.abs(n), 0) / parsedNums.length : 0;

      columns.push({
        index: c,
        letter: letter(c),
        name: headerRow >= 0 && !isBlank(head[c]) ? P.parse.clean(head[c]) : 'עמודה ' + letter(c),
        named: headerRow >= 0 && !isBlank(head[c]),
        samples: filled.slice(0, 5).map((v) => v instanceof Date ? P.parse.date(v) : P.parse.clean(v)),
        count: filled.length,
        fillRatio: sampleRows.length ? filled.length / sampleRows.length : 0,
        dateRatio: filled.length ? dates / filled.length : 0,
        numRatio: filled.length ? nums / filled.length : 0,
        negRatio: parsedNums.length ? neg / parsedNums.length : 0,
        distinct: distinct,
        distinctRatio: filled.length ? distinct / filled.length : 0,
        avgLen: avgLen,
        intLike: intLike,
        magnitude: magnitude,
        dirRatio: filled.length ? dirWords / filled.length : 0,
        curRatio: filled.length ? curWords / filled.length : 0
      });
    }
    return { headerRow: headerRow, columns: columns, rows: rows, bodyCount: body.length };
  }

  function nameScore(col, role) {
    if (!col.named) return 0;
    const n = P.parse.norm(col.name).replace(/^[₪$€£]\s*/, '');
    const hints = NAME_HINTS[role] || [];
    for (const re of hints) if (re.test(n)) return 10;
    return 0;
  }

  /** ניחוש איזו עמודה ממלאת איזה תפקיד */
  function guessMapping(prof) {
    const cols = prof.columns.filter((c) => c.count > 0);
    const map = {};
    const taken = new Set();
    const take = (role, col) => { if (col) { map[role] = col.index; taken.add(col.index); } };
    const free = () => cols.filter((c) => !taken.has(c.index));
    const bestBy = (fn) => {
      let best = null, bs = -Infinity;
      free().forEach((c) => { const s = fn(c); if (s > bs) { bs = s; best = c; } });
      return bs > 0 ? best : null;
    };

    // 1. תאריך — יחס תאריכים גבוה. כשיש כמה עמודות תאריך, מעדיפים את תאריך התנועה עצמה
    //    ("תאריך", "תאריך עסקה") על פני תאריך הערך או תאריך החיוב.
    take('date', bestBy((c) => {
      if (c.dateRatio <= 0.6) return -1;
      const n = c.named ? P.parse.norm(c.name) : '';
      const own = /^(תאריך|date)$|עסקה|רכישה|פעולה|transaction|purchase|trade/.test(n) ? 2 : /ערך|חיוב|value|billing|posted|posting|charge|settle/.test(n) ? -2 : 0;
      return c.dateRatio * 10 + nameScore(c, 'date') + own;
    }));

    // 2. חובה/זכות נפרדות. עמודה ריקה נחשבת גם היא: בחודש בלי אף זיכוי, עמודת "זכות" נשארת ריקה —
    //    והיא עדיין מה שמבדיל בין "חובה וזכות" לבין עמודת סכום אחת.
    const side = (role) => {
      let best = null, bs = 0;
      prof.columns.forEach((c) => {
        if (taken.has(c.index) || !(c.count === 0 || c.numRatio > 0.5)) return;
        const s = nameScore(c, role) + (c.count ? 1 : 0);
        if (s > bs && nameScore(c, role) > 0) { bs = s; best = c; }
      });
      return best;
    };
    const debit = side('debit'), credit = side('credit');
    if (debit && credit && debit !== credit && (debit.count || credit.count)) { take('debit', debit); take('credit', credit); }

    // 3. סכום — עמודה מספרית, רצוי עם שליליים, לא היתרה. עמודה שעמודה אחרת היא היתרה הרצה שלה
    //    היא סכום גם בלי שם מוכר — זה עובד בכל שפה.
    if (map.debit == null) {
      const numeric = free().filter((c) => c.numRatio >= 0.75);
      const hasRunningBalance = (c) => numeric.length <= 8 && numeric.some((y) => y !== c && trailOf(prof, { amount: c.index, date: map.date }, y.index).strong);
      take('amount', bestBy((c) => {
        if (c.numRatio < 0.75) return -1;
        let s = nameScore(c, 'amount') + c.numRatio * 3;
        if (c.named && /(חיוב|בשח|בש ח|charged|billed|billing)/.test(P.parse.norm(c.name))) s += 3;
        if (c.negRatio > 0.05 && c.negRatio < 0.98) s += 5;     // גם חיובים וגם זיכויים
        if (nameScore(c, 'balance')) s -= 12;
        if (c.intLike > 0.9 && c.distinctRatio > 0.9) s -= 6;   // כנראה אסמכתא
        if (hasRunningBalance(c)) s += 8;
        return s;
      }));
    }

    // 4. יתרה — לפי השם, או לפי ההתנהגות: ההפרש בין שורות סמוכות שווה לסכום התנועה.
    //    עמודה מספרית גדולה בלי אחד מאלה (ארבע הספרות של הכרטיס, מספר שובר) אינה יתרה.
    take('balance', bestBy((c) => {
      if (c.numRatio < 0.75) return -1;
      const named = nameScore(c, 'balance');
      const behaves = trailOf(prof, map, c.index).strong;
      return named || behaves ? named + (behaves ? 8 : 0) + 1 : -1;
    }));

    // 5. אסמכתא — מספרים שלמים ייחודיים, או שם מתאים
    take('ref', bestBy((c) => {
      let s = nameScore(c, 'ref');
      if (c.numRatio > 0.9 && c.intLike > 0.8 && c.distinctRatio > 0.85) s += 4;
      return s;
    }));

    // 6. סוג תנועה — עמודה שכתוב בה חובה/זכות וכדומה. לפני המטבע: גם שם יש מעט ערכים קצרים
    take('kind', bestBy((c) => {
      if (c.dirRatio < 0.6 || c.distinct > 8) return -1;      // הערכים חייבים להיות חובה/זכות וכדומה
      return nameScore(c, 'kind') + 6 * c.dirRatio;
    }));

    // 7. מטבע — לפי השם, או עמודה שהערכים בה הם מטבעות (₪, ILS, USD)
    take('currency', bestBy((c) => {
      let s = nameScore(c, 'currency');
      if (c.curRatio >= 0.8 && c.distinct <= 6) s += 3;
      if (s > 0 && c.named && /חיוב|charged|billed/.test(P.parse.norm(c.name))) s += 2;
      return s;
    }));

    // 8. תיאור — הטקסט הארוך והמגוון ביותר
    take('desc', bestBy((c) => {
      if (c.numRatio > 0.7 || c.dateRatio > 0.5) return -1;
      return nameScore(c, 'desc') + Math.min(c.avgLen, 40) * 0.3 + c.distinctRatio * 4 + c.fillRatio * 2;
    }));

    // 9. קטגוריה שכבר קיימת בקובץ — רק כשהעמודה נקראת כך במפורש.
    //    טעות כאן יקרה (היא גוברת על הכללים), ולכן לא מנחשים לפי תוכן בלבד.
    take('category', bestBy((c) => {
      const s = nameScore(c, 'category');
      if (!s || c.numRatio > 0.5 || c.dateRatio > 0.5) return -1;
      return s;
    }));

    return map;
  }

  /**
   * עדות היתרה לעמודה אחת (ראו P.parse.balanceTrail), על מדגם של השורות הראשונות.
   * strong: מספיק כדי להכריע שעמודה היא יתרה. some: מספיק כדי ללמוד ממנה את סימן החיוב.
   */
  function trailOf(prof, mapping, balanceCol) {
    const until = prof.headerRow + 1 + 400;
    const rows = prof.rows.length > until ? prof.rows.slice(0, until) : prof.rows;
    const t = P.parse.balanceTrail(rows, prof.headerRow, mapping, balanceCol);
    const hits = t.same + t.opp;
    t.some = !!t.order && hits >= 1 && hits >= t.pairs * 0.6;
    t.strong = t.some && hits >= 3;
    return t;
  }

  const CARD_NAMES = /(בית העסק|בית עסק|סכום חיוב|ענף|מועד חיוב|merchant|card member|cardholder)/;
  const allNames = (prof) => (prof ? prof.columns : []).map((c) => P.parse.norm(c.name)).join(' | ');

  /**
   * מה מייצג הוצאה בעמודת הסכום, ועל מה ההחלטה נשענת:
   *   columns   חובה וזכות בעמודות נפרדות — אין מה להחליט
   *   kind      עמודה שכתוב בה חובה/זכות
   *   balance   עמודת היתרה מאשרת: ההפרש בין יתרות סמוכות הוא התנועה עצמה
   *   header    הכותרות אומרות שזה חיוב ("סכום חיוב", פירוט כרטיס)
   *   majority  ניחוש: בחשבון פרטי ההוצאות רבות מההכנסות, ולכן הסימן הנפוץ הוא סימן ההוצאה
   *
   * המצב 'balance' הוא לקובץ שהסכומים בו כתובים בלי סימן בכלל: הכיוון של כל שורה נקרא מהיתרה.
   * @returns {{mode: 'neg-out'|'pos-out'|'kind'|'balance', basis: string}}
   */
  function signOf(prof, mapping) {
    if (mapping.debit != null || mapping.credit != null) return { mode: 'neg-out', basis: 'columns' };
    if (mapping.amount == null) return { mode: 'neg-out', basis: 'majority' };
    if (mapping.kind != null) return { mode: 'kind', basis: 'kind' };
    if (mapping.balance != null) {
      const t = trailOf(prof, mapping, mapping.balance);
      const hits = t.same + t.opp, oneWay = !t.same || !t.opp;
      if (t.order && hits) {
        // אין אף מינוס בעמודה: ייתכן שהסכומים כתובים בלי סימן בכלל, ואז אין "סימן חיוב" אחד לכל הקובץ —
        // הכיוון של כל שורה נקרא מהיתרה שלה
        if (!t.negatives && (t.some || !oneWay)) return { mode: 'balance', basis: 'balance' };
        // יש סימנים, וכל השורות שהיתרה מסבירה מסכימות ביניהן. מספיקות שלוש כאלה גם כשהשאר לא מוסברות
        // (דוח שממוין מהחדש לישן לפי ימים, אבל בתוך היום מהמוקדם למאוחר)
        if (t.negatives && oneWay && (t.some || hits >= 3)) return { mode: t.opp ? 'pos-out' : 'neg-out', basis: 'balance' };
        if (t.negatives && t.some) return { mode: t.opp > t.same ? 'pos-out' : 'neg-out', basis: 'majority' };
      }
    }
    const col = prof.columns[mapping.amount];
    const mode = col && col.negRatio < 0.5 ? 'pos-out' : 'neg-out';
    const charge = mode === 'pos-out' && col && ((col.named && /(חיוב|charge|billed|debit)/.test(P.parse.norm(col.name))) || CARD_NAMES.test(allNames(prof)));
    return { mode: mode, basis: charge ? 'header' : 'majority' };
  }
  function guessSign(prof, mapping) { return signOf(prof, mapping).mode; }

  /** האם היום לפני החודש? נקבע לפי ערכים שלא יכולים להיות חודש */
  function guessDateOrder(prof, mapping) {
    if (mapping.date == null) return 'auto';
    const rows = prof.rows.slice(prof.headerRow + 1);
    let dFirst = 0, mFirst = 0;
    for (const r of rows) {
      if (!r) continue;
      const v = r[mapping.date];
      if (v instanceof Date) return 'auto';
      const m = /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/.exec(P.parse.clean(v));
      if (!m) continue;
      if (+m[1] > 12) dFirst++;
      if (+m[2] > 12) mFirst++;
    }
    if (mFirst > dFirst) return 'mdy';
    return 'auto';
  }

  /** חתימה יציבה של מבנה הקובץ, לשמירת מיפוי לפעם הבאה */
  function signature(prof) {
    const names = prof.columns.filter((c) => c.count > 0 || c.named).map((c) => P.parse.norm(c.name)).join('|');
    return P.parse.hash(prof.headerRow + '::' + names);
  }

  function describeKind(value) {
    const v = P.parse.clean(value);
    if (OUTFLOW_WORDS.test(v)) return -1;
    if (INFLOW_WORDS.test(v)) return 1;
    return 0;
  }

  /** האם זה פירוט כרטיס אשראי (ולא דוח עו"ש)? חשוב לזיהוי כפילויות */
  function fileKind(prof, mapping, options) {
    if (mapping && mapping.category != null) return 'card';
    if (options && options.signMode === 'pos-out') return 'card';
    if (CARD_NAMES.test(allNames(prof)) && !(mapping && mapping.balance != null)) return 'card';
    return 'account';
  }

  /**
   * האם אפשר לייבא בלי לשאול? רק כשהתאריך, התיאור והסכום זוהו לפי שם הכותרת שלהם
   * (ולא רק לפי התוכן), הערכים בעמודות תואמים, והכיוון של כל תנועה אינו ניחוש:
   * חובה וזכות בעמודות נפרדות, יתרה שמאשרת את הסימן, כותרת שאומרת "חיוב", או עמודת סוג
   * שכל ערכיה מוכרים. מינוס שמופיע ברוב השורות נקרא כהוצאה; כל השאר נפתח בחלון המיפוי.
   */
  function confident(a) {
    if (!a || !a.profile || a.profile.headerRow < 0 || a.profile.bodyCount < 1) return false;
    const m = a.mapping, cols = a.profile.columns;
    const named = (role, idx) => idx != null && cols[idx] && nameScore(cols[idx], role) > 0;
    if (!named('date', m.date) || !named('desc', m.desc)) return false;
    if (cols[m.date].dateRatio < 0.9) return false;
    if (named('debit', m.debit) && named('credit', m.credit)) return true;
    if (!named('amount', m.amount) || cols[m.amount].numRatio < 0.9) return false;
    const basis = a.signBasis || signOf(a.profile, m).basis;
    if (basis === 'balance' || basis === 'header') return true;
    if (basis === 'kind') return m.kind != null && cols[m.kind].dirRatio >= 0.98;
    return a.options.signMode === 'neg-out';
  }

  /** ניתוח מלא בבת אחת */
  function analyze(rows) {
    const headerRow = guessHeaderRow(rows);
    const prof = profile(rows, headerRow);
    const mapping = guessMapping(prof);
    const sign = signOf(prof, mapping);
    return {
      profile: prof,
      mapping: mapping,
      options: {
        signMode: sign.mode,
        dateOrder: guessDateOrder(prof, mapping),
        currency: '₪'
      },
      signBasis: sign.basis,
      signature: signature(prof)
    };
  }

  return { ROLES, analyze, confident, fileKind, profile, tables, guessHeaderRow, guessMapping, guessSign, signOf, guessDateOrder, signature, letter, describeKind };
})();
