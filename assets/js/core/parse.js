/* ==========================================================================
   core/parse.js — נירמול ערכים ובניית תנועות לפי מיפוי עמודות.
   אין כאן הנחה על מספר עמודות או על סדרן: הכל מגיע כמיפוי מפורש
   (מה-detect או מהמשתמש באשף הייבוא).
   ========================================================================== */
window.P = window.P || {};

/**
 * מילון "נקי": אובייקט בלי אב-טיפוס. כל מקום שבו המפתח מגיע מהנתונים — שם קטגוריה,
 * שם בית עסק — משתמש בו, כדי ששם כמו "constructor" או "__proto__" יהיה מפתח רגיל לכל דבר.
 */
P.dict = function (src) { return Object.assign(Object.create(null), src || {}); };

P.parse = (function () {
  'use strict';

  /* ---------- טקסט ---------- */
  const BIDI = /[‎‏‪-‮⁦-⁩ ]/g;
  const clean = (s) => String(s == null ? '' : (s instanceof Date ? isoDate(s) : s)).replace(BIDI, ' ').replace(/\s+/g, ' ').trim();
  const norm = (s) => clean(s).replace(/["'`״׳]/g, '').replace(/[-–—_\/\\.,()*#:;!?+|\[\]{}<>@%=~^]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  /* ---------- סכומים ---------- */
  const CURRENCY = /(₪|\$|€|£|¥|ש"ח|ש״ח|שח|ils|nis|usd|eur|gbp)/gi;
  const NUMERIC = /^[-\u2212+(]?(\d{1,3}([.,'\s]\d{3})+|\d+)([.,]\d+)?\)?[-\u2212]?$/;

  /** האם הערך הוא מספר "אמיתי" — ולא טקסט שיש בו ספרות, כמו "ויזה 4417" */
  function isNumeric(v) {
    if (typeof v === 'number') return Number.isFinite(v);
    if (v == null || v instanceof Date) return false;
    const s = clean(v).replace(CURRENCY, '').replace(/\s+/g, '');
    return s.length > 0 && NUMERIC.test(s);
  }

  function amount(v, decimal) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (v instanceof Date) return null;
    if (!isNumeric(v)) return null;
    let s = clean(v);
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/[-−–—־]/.test(s)) neg = true;
    if (/\b(cr|זכות)\b/i.test(s)) neg = false;
    s = s.replace(/[^0-9.,]/g, '');
    if (!/[0-9]/.test(s)) return null;

    if (decimal === ',') s = s.replace(/\./g, '').replace(',', '.');
    else if (decimal === '.') s = s.replace(/,/g, '');
    else {
      const dot = s.lastIndexOf('.'), com = s.lastIndexOf(',');
      if (dot > -1 && com > -1) s = dot > com ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
      else if (com > -1) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    }
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return neg ? -Math.abs(n) : n;
  }

  /* ---------- תאריכים ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const key = isoDate;

  // שמות חודשים, באנגלית ובעברית. מילה מתאימה כשהיא השם המלא או קיצור שלו (שלוש אותיות ומעלה): Mar, March, מרץ, במרץ
  const MONTHS = [['january', 'ינואר'], ['february', 'פברואר'], ['march', 'מרץ', 'מרס'], ['april', 'אפריל'], ['may', 'מאי'], ['june', 'יוני'], ['july', 'יולי'],
    ['august', 'אוגוסט'], ['september', 'ספטמבר'], ['october', 'אוקטובר'], ['november', 'נובמבר'], ['december', 'דצמבר']];
  function monthOf(word) {
    const w = String(word).toLowerCase().replace(/^ב(?=[א-ת]{3})/, '');
    if (w.length < 3) return 0;
    if (w === 'sept') return 9;
    for (let i = 0; i < 12; i++) if (MONTHS[i].some((name) => name.indexOf(w) === 0)) return i + 1;
    return 0;
  }
  // יום בשבוע לפני התאריך ("יום א' 01/03/2026", "Sun, 01/03/2026") הוא קישוט, לא חלק מהתאריך
  const WEEKDAY = /^(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|[א-ו]['׳]?|ש['׳]?|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs?|rsday)?|fri(?:day)?|sat(?:urday)?)[,.]?\s+(?=\d)/i;
  const year4 = (y) => (y < 100 ? y + (y < 70 ? 2000 : 1900) : y);

  function date(v, order) {
    if (v instanceof Date && !isNaN(v)) return isoDate(v);
    if (typeof v === 'number') return (v > 20000 && v < 80000) ? isoDate(P.xlsx.serialToDate(v)) : null;
    const full = clean(v).replace(WEEKDAY, '');
    if (!full) return null;
    const s = full.split(' ')[0].split('T')[0];

    let m = /^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/.exec(s);
    if (m) return mk(+m[1], +m[2], +m[3]);

    m = /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})$/.exec(s);
    if (m) {
      let a = +m[1], b = +m[2];
      const y = year4(+m[3]);
      let day = a, mon = b;
      if (order === 'mdy') { day = b; mon = a; }
      else if (order === 'dmy') { day = a; mon = b; }
      else { if (a > 12 && b <= 12) { day = a; mon = b; } else if (b > 12 && a <= 12) { day = b; mon = a; } }
      return mk(y, mon, day);
    }

    // חודש במילים: "01-Mar-2026", "1 במרץ 2026", "March 1, 2026"
    m = /^(\d{1,2})[\s.\-\/]+([A-Za-zא-ת]{3,})['׳.]?,?[\s.\-\/]+(\d{2,4})(?![\dA-Za-zא-ת])/.exec(full);
    if (m && monthOf(m[2])) return mk(year4(+m[3]), monthOf(m[2]), +m[1]);
    m = /^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?![\dA-Za-zא-ת])/.exec(full);
    if (m && monthOf(m[1])) return mk(+m[3], monthOf(m[1]), +m[2]);

    // שמונה ספרות רצופות: 20260301
    m = typeof v === 'string' && /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    if (m && +m[1] >= 1990 && +m[1] <= 2100) return mk(+m[1], +m[2], +m[3]);
    return null;
  }
  function mk(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const dt = new Date(y, m - 1, d);
    // תאריך שלא קיים (31.02) לא "מתגלגל" לחודש הבא — הוא פשוט לא תאריך
    return isNaN(dt) || dt.getMonth() !== m - 1 || dt.getDate() !== d ? null : isoDate(dt);
  }

  /* ---------- מזהה יציב ---------- */
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }

  /* ---------- פרטי החשבון שמעל הכותרות ---------- */
  const META = [
    ['branch',  /^(מספר סניף|סניף)$/],
    ['client',  /^(שם לקוח|שם הלקוח|לקוח|שם בעל החשבון)$/],
    ['bank',    /^(בנק|שם בנק)$/],
    ['account', /^(מספר חשבון|חשבון|מס חשבון|account)$/],
    ['period',  /^(תקופת הדוח|תקופה|טווח תאריכים)$/]
  ];
  function meta(rows, headerRow) {
    const out = {};
    const until = headerRow > 0 ? Math.min(headerRow, 16) : 0;
    for (let i = 0; i < until; i++) {
      const row = rows[i] || [];
      for (let c = 0; c < row.length; c++) {
        const label = norm(row[c]);
        if (!label || label.length > 26) continue;
        for (const [name, re] of META) {
          if (out[name] || !re.test(label)) continue;
          for (let j = c + 1; j < Math.min(row.length, c + 4); j++) {
            if (row[j] != null && String(row[j]).trim() !== '') { out[name] = clean(row[j]); break; }
          }
        }
      }
    }
    return out;
  }

  /* ---------- מה עמודת היתרה מספרת ---------- */
  const INFLOW_HINT = /(משכורת|שכר עבודה|salary|payroll|זיכוי|החזר|קצבת|גמלת|מענק|refund|dividend|דיבידנד)/;
  const TOL = 0.006;                                    // חצי אגורה: הבנק מדויק עד האגורה, והחישוב כאן בנקודה צפה

  /** הסכום כפי שהוא כתוב בשורה, לפני כל החלטה על סימן: עמודת הסכום, או זכות פחות חובה */
  function rawAmount(row, m, decimal) {
    if (m.debit != null || m.credit != null) {
      const deb = Math.abs(amount(m.debit != null ? row[m.debit] : null, decimal) || 0);
      const cre = Math.abs(amount(m.credit != null ? row[m.credit] : null, decimal) || 0);
      return deb || cre ? cre - deb : null;
    }
    return m.amount != null ? amount(row[m.amount], decimal) : null;
  }

  /**
   * ההפרש בין שתי יתרות עוקבות הוא התנועה עצמה. מזה לומדים, בלי לנחש:
   *   – אם מינוס בעמודת הסכום הוא הוצאה, או דווקא להפך;
   *   – מה הכיוון של כל שורה כשהסכומים כתובים בלי סימן בכלל;
   *   – באיזה סדר התנועות כתובות בתוך כל יום;
   *   – ואם עמודה היא בכלל יתרה.
   *
   * "עוקבות" תלוי בסדר, ובנקים מייצאים בכל דרך: מהישן לחדש, מהחדש לישן, ולפעמים ימים בסדר אחד
   * והתנועות שבתוך היום בסדר ההפוך. לכן קוראים את הקובץ בארבע דרכים — כמו שהוא, הפוך, וכל אחת
   * מהן גם אחרי מיון לפי יום — ובוחרים את הדרך שמסבירה הכי הרבה שורות. שורה שיש בה יתרה בלי סכום
   * ("יתרת פתיחה") משמשת עוגן לשורה שאחריה; ואם כבר ידועה היתרה שלפני הדוח (מהדוח של החודש הקודם,
   * דרך o.balanceBefore) — היא העוגן של התנועה הראשונה.
   *
   * רק השכנה הקודמת מכריעה. חיפוש "היתרה שממנה השורה יצאה" בכל הקובץ נשמע מפתה, אבל כשסכומים חוזרים
   * (100, 100, 200) הוא מוצא גם את היתרה שאחרי — ושורה שכיוונה לא ידוע עדיפה על שורה שכיוונה שגוי.
   *
   * @param {any[][]} rows
   * @param {number} headerRow
   * @param {Object} mapping   {amount | debit, credit, date?}
   * @param {number} balanceCol
   * @param {{decimal?: string, dateOrder?: string, balanceBefore?: (isoDate: string) => (number|null)}} [o]
   * @returns {{order: ('asc'|'desc'|null), same: number, opp: number, pairs: number, count: number,
   *            negatives: number, dir: Object<number, number>, unknown: number}}
   *   order: 'asc' כשבתוך כל יום התנועות כתובות מהמוקדמת למאוחרת, 'desc' כשלהפך, null כשאי אפשר לדעת.
   *   same/opp: בכמה שורות ההפרש שווה לסכום כפי שהוא כתוב, ובכמה הוא שווה לו בסימן הפוך.
   *   dir: לכל שורה שכיוונה ידוע — ‎+1‎ נכנס, ‎−1‎ יצא.
   */
  function balanceTrail(rows, headerRow, mapping, balanceCol, o) {
    o = o || {};
    const list = [];
    for (let i = Math.max(0, headerRow + 1); i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const bal = amount(row[balanceCol], o.decimal);
      if (bal == null) continue;
      list.push({ i: i, amt: rawAmount(row, mapping, o.decimal), bal: bal, day: mapping.date != null ? date(row[mapping.date], o.dateOrder) : null });
    }
    const moves = list.filter((x) => x.amt);
    const none = { order: null, same: 0, opp: 0, pairs: 0, count: moves.length, negatives: moves.filter((x) => x.amt < 0).length, dir: Object.create(null), unknown: moves.length };
    // היתרה שהייתה בחשבון לפני היום הראשון של הדוח, אם היא כבר ידועה
    const firstDay = list.reduce((d, x) => (x.day && (!d || x.day < d) ? x.day : d), '');
    const known = firstDay && typeof o.balanceBefore === 'function' ? o.balanceBefore(firstDay) : null;
    const opening = typeof known === 'number' && isFinite(known) ? [{ i: -1, amt: null, bal: known, day: '' }] : [];
    if (list.length + opening.length < 2 || !moves.length) return none;

    // שורה בלי תאריך ("יתרת פתיחה") שייכת ליום של השכנה שלה
    for (let k = 1; k < list.length; k++) if (!list[k].day) list[k].day = list[k - 1].day;
    for (let k = list.length - 2; k >= 0; k--) if (!list[k].day) list[k].day = list[k + 1].day;
    list.forEach((x) => { x.day = x.day || ''; });

    const byDay = (seq) => seq.map((x, k) => [x, k]).sort((a, b) => (a[0].day < b[0].day ? -1 : a[0].day > b[0].day ? 1 : a[1] - b[1])).map((p) => p[0]);
    const flipped = list.slice().reverse();
    const ways = [['asc', list], ['desc', flipped], ['asc', byDay(list)], ['desc', byDay(flipped)]].map((w) => [w[0], opening.concat(w[1])]);
    const walk = (seq) => {
      const dir = Object.create(null);
      let same = 0, opp = 0, pairs = 0;
      for (let k = 1; k < seq.length; k++) {
        const cur = seq[k];
        if (!cur.amt) continue;
        pairs++;
        const diff = cur.bal - seq[k - 1].bal;
        if (Math.abs(diff - cur.amt) < TOL) { same++; dir[cur.i] = diff > 0 ? 1 : -1; }
        else if (Math.abs(diff + cur.amt) < TOL) { opp++; dir[cur.i] = diff > 0 ? 1 : -1; }
      }
      return { same: same, opp: opp, pairs: pairs, dir: dir, hits: same + opp };
    };
    const read = ways.map((w) => walk(w[1]));
    const top = Math.max.apply(null, read.map((r) => r.hits));
    none.pairs = read[0].pairs;
    if (!top) return none;

    const tied = read.map((r, k) => k).filter((k) => read[k].hits === top);
    let chosen = tied[0];
    if (tied.some((k) => ways[k][0] !== ways[chosen][0])) {
      // שני כיווני קריאה מסבירים אותו מספר שורות (למשל כשכל הסכומים זהים) — התאריכים מכריעים
      const first = list[0].day, last = list[list.length - 1].day;
      if (first === last) return none;
      chosen = tied.filter((k) => ways[k][0] === (first < last ? 'asc' : 'desc'))[0];
    }
    const w = read[chosen];
    return {
      order: ways[chosen][0], same: w.same, opp: w.opp, pairs: w.pairs, count: moves.length,
      negatives: none.negatives, dir: w.dir, unknown: moves.filter((x) => !w.dir[x.i]).length
    };
  }

  /* ---------- בניית תנועות לפי מיפוי ---------- */
  /**
   * @param {any[][]} rows      כל שורות הגיליון
   * @param {number} headerRow  אינדקס שורת הכותרות, או 1- אם אין
   * @param {Object} mapping    {date, desc, amount, debit, credit, kind, balance, currency, ref}
   * @param {Object} options    {signMode:'neg-out'|'pos-out'|'kind'|'balance', dateOrder, decimal, currency, balanceBefore}
   * @returns {{tx: Object[], warnings: Object, skipped: number, unsure: string[]}}
   *   unsure: מזהי התנועות שהכיוון שלהן (נכנס/יצא) הוערך ולא נקרא מהקובץ — רק במצב 'balance'.
   */
  function build(rows, headerRow, mapping, options) {
    const o = Object.assign({ signMode: 'neg-out', dateOrder: 'auto', decimal: 'auto', currency: '₪' }, options);
    const m = mapping || {};
    const out = [];
    const warn = { noDate: 0, noAmount: 0, zero: 0, guessed: 0 };
    const seen = Object.create(null);
    const split = m.debit != null || m.credit != null;

    if (m.date == null) throw new Error('צריך לבחור עמודת תאריך.');
    if (m.amount == null && !split) throw new Error('צריך לבחור עמודת סכום, או עמודות חובה/זכות.');
    const byBalance = o.signMode === 'balance' && !split;
    if (byBalance && m.balance == null) throw new Error('כדי לקבוע את הכיוון לפי היתרה צריך לבחור עמודת יתרה.');

    const trail = m.balance != null ? balanceTrail(rows, headerRow, m, m.balance, o) : null;
    const keys = [];                                      // התיאור כפי שהוא בקובץ, לכל תנועה (חלק מהמזהה)
    const pending = [];                                   // [תנועה, תיאור מנורמל] — שורות שהיתרה לא הכריעה את כיוונן
    const lean = Object.create(null);                     // תיאור -> לאן נוטות התנועות שכיוונן ידוע
    let net = 0;

    for (let i = Math.max(0, headerRow + 1); i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.some((v) => v != null && String(v).trim() !== '')) continue;

      const d = date(row[m.date], o.dateOrder);
      if (!d) { warn.noDate++; continue; }

      let amt = rawAmount(row, m, o.decimal), open = false;
      if (amt != null && !split) {
        if (byBalance) {
          const dir = trail.dir[i];
          if (dir) amt = dir * Math.abs(amt);
          else if (amt) open = true;
        } else if (o.signMode === 'pos-out') amt = -amt;
        else if (o.signMode === 'kind' && m.kind != null) {
          const dir = P.detect.describeKind(row[m.kind]);
          if (dir) amt = dir * Math.abs(amt);
        }
      }
      if (amt == null) { warn.noAmount++; continue; }
      if (amt === 0) { warn.zero++; continue; }

      const desc = m.desc != null ? clean(row[m.desc]) : '';
      const ref = m.ref != null ? clean(row[m.ref]) : '';
      const currency = (m.currency != null && row[m.currency] ? clean(row[m.currency]) : '') || o.currency || '₪';
      const balance = m.balance != null ? amount(row[m.balance], o.decimal) : null;

      const tx = { id: '', date: d, desc: desc || 'תנועה ללא תיאור', amount: amt, currency: currency, balance: balance, ref: ref };
      // קטגוריה שכבר קיימת בקובץ — המקור האמין ביותר אחרי שיוך ידני
      if (m.category != null) {
        const fc = clean(row[m.category]);
        if (fc && fc.length <= 40) tx.fileCat = fc;
      }
      if (byBalance) {
        const who = norm(desc), dir = amt > 0 ? 1 : -1;
        if (open) pending.push([tx, who]);
        else { lean[who] = (lean[who] || 0) + dir; net += dir; }
      }
      out.push(tx);
      keys.push(desc);
    }

    // שורה שאין לה יתרה קודמת להשוות אליה (בדרך כלל הראשונה בדוח): הולכים לפי תנועות אחרות
    // עם אותו תיאור, אחר כך לפי מילה שמעידה על כסף שנכנס, ואם אין — לפי הרוב.
    // זו הערכה ולא קריאה מהקובץ, ולכן היא מדווחת (unsure) וחלון המיפוי מציג אותה לאישור.
    pending.forEach(([tx, who]) => {
      const dir = Math.sign(lean[who] || 0) || (INFLOW_HINT.test(who) ? 1 : 0) || (net > 0 ? 1 : -1);
      tx.amount = dir * Math.abs(tx.amount);
      warn.guessed++;
    });

    out.forEach((tx, k) => {
      const base = [tx.date, tx.amount.toFixed(2), keys[k], tx.ref].join('|');
      seen[base] = (seen[base] || 0) + 1;
      tx.id = hash(base + '#' + seen[base]);
    });

    // המקום של כל תנועה בתוך היום שלה, מהמוקדמת למאוחרת. הסדר נלמד משרשרת היתרות,
    // ובלי יתרה — מהתאריך של השורה הראשונה מול האחרונה.
    const newestFirst = trail && trail.order ? trail.order === 'desc' : out.length > 1 && out[0].date > out[out.length - 1].date;
    const inDay = Object.create(null);
    (newestFirst ? out.slice().reverse() : out).forEach((tx) => { tx.n = inDay[tx.date] = inDay[tx.date] == null ? 0 : inDay[tx.date] + 1; });

    return { tx: out, warnings: warn, skipped: warn.noDate + warn.noAmount + warn.zero, unsure: pending.map((p) => p[0].id) };
  }

  /** ניתוח אוטומטי מלא: בוחר את הגיליון הטוב ביותר ובונה ממנו תנועות */
  function transactions(sheets) {
    let best = null;
    for (const sh of sheets) {
      let a;
      try { a = P.detect.analyze(sh.rows); } catch (e) { continue; }
      if (a.mapping.date == null) continue;
      if (a.mapping.amount == null && a.mapping.debit == null && a.mapping.credit == null) continue;
      const score = (a.profile.bodyCount || 0);
      if (!best || score > best.score) best = { sheet: sh, analysis: a, score: score };
    }
    if (!best) throw new Error('לא הצלחתי לזהות עמודות של תאריך וסכום. פתחו את אשף הייבוא ובחרו אותן ידנית.');
    const a = best.analysis;
    const res = build(best.sheet.rows, a.profile.headerRow, a.mapping, a.options);
    return {
      tx: res.tx,
      meta: meta(best.sheet.rows, a.profile.headerRow),
      sheet: best.sheet.name,
      skipped: res.skipped,
      analysis: a
    };
  }

  return { clean, norm, amount, isNumeric, date, key, isoDate, hash, meta, build, transactions, balanceTrail };
})();
