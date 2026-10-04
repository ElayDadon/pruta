/* ==========================================================================
   core/learn.js — המנוע הלומד.
   ---------------------------------------------------------------------------
   במקום להסתמך רק על מילון קבוע, המנוע קורא את הטבלה שלכם וכורה ממנה
   את מילות המפתח האמיתיות: אילו מילים חוזרות, אילו מהן באמת מזהות בית עסק,
   ואילו מהן מנבאות קטגוריה. משם הוא יודע:

     1. לקבץ תנועות לבית עסק אחד גם כשהתיאור משתנה בין שורה לשורה
     2. להציע קטגוריה לתנועה שלא זוהתה, לפי דמיון לתנועות שכבר מסווגות
     3. להציע כללים חדשים שנגזרים מהשיוכים שאתם עצמכם עשיתם
     4. לזהות הוראות קבע ומנויים לפי קצב החיובים
     5. לסמן חיוב חריג ביחס להיסטוריה של אותו בית עסק

   הכל מחושב מקומית, על הנתונים שבמחשב, בלי שום מודל חיצוני.
   ========================================================================== */
window.P = window.P || {};

P.learn = (function () {
  'use strict';

  /* רעש בנקאי: מילים שמופיעות בכל מקום ולא מזהות כלום */
  const STOP = new Set((
    'בעמ בע מ חברה שירותים ישראל תשלום תשלומים חיוב זיכוי כרטיס אשראי מספר מס עסקה עסקאות ' +
    'סניף בנק העברה העברת לחשבון מחשבון בגין עבור של את עם על אל כל לא דרך סה כ רגיל ' +
    'ltd inc llc co company payment card ref no the of and for from to via pos tel il israel ' +
    'אינטרנט online web app אפליקציה שובר קבלה חודש חודשי שנתי ' +
    'אביב תל ירושלים חיפה רעננה הרצליה נתניה אשדוד באר שבע פתח תקווה רמת גן גבעתיים בני ברק ' +
    'מרכז קניון סנטר רח רחוב שדרות כיכר הוראת קבע רכישה קניה עסקת ' +
    'aviv yafo jerusalem haifa herzliya netanya raanana holon rishon'
  ).split(/\s+/).filter(Boolean));

  /* מילה ראשונה שלא מספיקה לבדה לזהות בית עסק — מצרפים לה את המילה הבאה */
  const GENERIC_HEAD = new Set((
    'מסעדת מסעדה קפה בית חנות סופר מכולת מאפיית מאפיה משיכת חברת החזר מס דמי ביטוח קופת ' +
    'שכר מרכז מכון סטודיו מספרת קליניקת משרד עיריית מועצה רשות אגודת עמותת רב ' +
    'cafe restaurant shop store the bar pub market'
  ).split(/\s+/).filter(Boolean));

  /* מתווכי תשלום: השם האמיתי בא אחריהם */
  const PROCESSORS = new Set(['paypal', 'pp', 'sq', 'sumup', 'stripe', 'zettle', 'payoneer']);

  /* תבניות שאינן מידע: מספרי כרטיס, תאריכים, מספרי אסמכתא */
  const NOISE = /^(\d+|[a-z]\d+|\d+[a-z]|x+\d*|\*+\d*)$/i;

  function tokens(desc) {
    const out = [];
    const words = P.parse.norm(desc).split(' ');
    for (const w of words) {
      if (!w || w.length < 2) continue;
      if (NOISE.test(w)) continue;
      if (STOP.has(w)) continue;
      out.push(w);
    }
    return out;
  }

  /** חד-מילים ודו-מילים; הצמד תמיד חזק יותר מהמילה הבודדת */
  function terms(desc) {
    const t = tokens(desc);
    const out = t.slice();
    for (let i = 0; i < t.length - 1; i++) out.push(t[i] + ' ' + t[i + 1]);
    return out;
  }

  /* ---------- בניית מודל מכל התנועות ---------- */
  let cache = null;

  function invalidate() { cache = null; }

  function model(txs) {
    if (cache && cache.n === txs.length && cache.stamp === stampOf(txs)) return cache;

    const df = new Map();            // מונח -> בכמה תנועות הוא מופיע
    const docs = [];                 // לכל תנועה: רשימת מונחים ייחודיים
    for (const t of txs) {
      const set = new Set(terms(t.desc));
      docs.push(set);
      set.forEach((term) => df.set(term, (df.get(term) || 0) + 1));
    }
    const N = Math.max(1, txs.length);
    const idf = (term) => Math.log((N + 1) / ((df.get(term) || 0) + 1)) + 1;

    // אינדקס הפוך: מונח -> אינדקסי תנועות (רק למונחים שאינם נדירים מדי ולא נפוצים מדי)
    const index = new Map();
    df.forEach((count, term) => {
      if (count > N * 0.6) return;
      index.set(term, []);
    });
    docs.forEach((set, i) => set.forEach((term) => { const arr = index.get(term); if (arr) arr.push(i); }));

    const wOf = (term) => idf(term) * (term.indexOf(' ') > 0 ? 1.5 : 1);
    const norms = docs.map((set) => { let a = 0; set.forEach((term) => { const w = wOf(term); a += w * w; }); return Math.sqrt(a) || 1; });

    // מפתח בית העסק של כל תנועה — לזיהוי "אותו עסק, סניף אחר" בזמן הצעת קטגוריה
    const keys = txs.map((t) => merchantKey(t.desc));

    cache = { n: txs.length, stamp: stampOf(txs), txs: txs, df: df, idf: idf, wOf: wOf, docs: docs, norms: norms, index: index, keys: keys, N: N };
    return cache;
  }
  function stampOf(txs) {
    // המודל תלוי רק בתיאורים; הקטגוריות נקראות חיות מתוך התנועות עצמן
    let h = txs.length;
    const step = Math.max(1, Math.floor(txs.length / 80));
    for (let i = 0; i < txs.length; i += step) {
      const d = txs[i].desc || '';
      h = (h * 31 + d.length * 7 + (d.charCodeAt(0) || 0) + (d.charCodeAt(d.length - 1) || 0)) % 2147483647;
    }
    return h;
  }

  /* ---------- מפתח בית עסק ----------
   * בתיאורי בנק שם העסק כמעט תמיד בא ראשון, והסניף או העיר אחריו.
   * לכן המפתח הוא המילה המשמעותית הראשונה — ועוד מילה אם הראשונה כללית
   * ("מסעדת", "חברת") או קצרה מדי ("רב").
   */
  function headTokens(desc) {
    let t = tokens(desc);
    while (t.length > 1 && PROCESSORS.has(t[0])) t = t.slice(1);
    if (!t.length) return [];
    if (t.length > 1 && GENERIC_HEAD.has(t[0])) return t.slice(0, 2);
    return t.slice(0, 1);
  }
  function merchantKey(desc) {
    const h = headTokens(desc);
    return h.length ? h.join(' ') : (P.parse.norm(desc).slice(0, 24) || 'לא ידוע');
  }

  /** קיבוץ כל התנועות לבתי עסק */
  function merchants(txs, limit) {
    const map = new Map();
    txs.forEach((t) => {
      const k = merchantKey(t.desc);
      let g = map.get(k);
      if (!g) { g = { key: k, label: t.desc, cat: t.cat, sum: 0, count: 0, ids: [], dates: [], amounts: [], sample: t }; map.set(k, g); }
      g.sum += Math.abs(t.amount); g.count++; g.ids.push(t.id); g.dates.push(t.date); g.amounts.push(Math.abs(t.amount));
      if (t.desc.length < g.label.length) g.label = t.desc;
    });
    const rows = Array.from(map.values()).sort((a, b) => b.sum - a.sum);
    return limit ? rows.slice(0, limit) : rows;
  }

  /* ---------- הצעת קטגוריה לפי דמיון לתנועות שכבר מסווגות ---------- */
  function suggest(desc, txs, max) {
    const m = model(txs);
    const qTerms = Array.from(new Set(terms(desc)));
    if (!qTerms.length) return [];
    const qKey = merchantKey(desc);

    const score = new Map();         // אינדקס תנועה -> ניקוד דמיון
    let qNorm = 0;
    qTerms.forEach((term) => {
      const w = m.wOf(term);
      qNorm += w * w;
      const posting = m.index.get(term);
      if (!posting || posting.length > m.N * 0.4) return;
      posting.forEach((i) => score.set(i, (score.get(i) || 0) + w * w));
    });
    qNorm = Math.sqrt(qNorm) || 1;

    const byCat = new Map();
    score.forEach((s, i) => {
      const t = m.txs[i];
      if (!t.cat || t.cat === P.cats.OTHER || t.source === 'inferred' || t.source === 'none') return;
      // אותו בית עסק (אותה מילה מזהה בראש התיאור) הוא ראיה חזקה, גם כששאר התיאור שונה:
      // סניף אחר, עיר אחרת או מספר עסקה לא הופכים את "שופרסל" לעסק אחר.
      const sim = Math.max(s / (qNorm * m.norms[i]), m.keys[i] === qKey ? 0.5 : 0);
      if (sim < 0.12) return;
      const weight = sim * (t.source === 'manual' ? 2.2 : t.source === 'file' ? 1.5 : 1);   // שיוך ידני שלכם שווה יותר
      const cur = byCat.get(t.cat) || { cat: t.cat, score: 0, best: 0, example: t };
      cur.score += weight;
      if (sim > cur.best) { cur.best = sim; cur.example = t; }
      byCat.set(t.cat, cur);
    });

    const rows = Array.from(byCat.values()).sort((a, b) => b.score - a.score);
    const total = rows.reduce((s, r) => s + r.score, 0) || 1;
    return rows.slice(0, max || 3).map((r) => ({
      cat: r.cat,
      confidence: Math.min(0.99, r.score / total * Math.min(1, r.best * 2.2)),
      match: r.best,
      example: r.example
    })).filter((r) => r.confidence > 0.05);
  }

  /**
   * מילת המפתח לכלל חדש: תחילת שם העסק.
   * אם שתי המילים הראשונות כמעט תמיד מופיעות יחד ("רמי לוי"), לוקחים את הצמד —
   * הוא מדויק יותר ולא יתפוס בטעות עסקים אחרים.
   */
  function keywordFor(desc, txs) {
    const m = model(txs || (P.state ? P.state.data.tx : []));
    let t = tokens(desc);
    while (t.length > 1 && PROCESSORS.has(t[0])) t = t.slice(1);
    if (!t.length) return P.parse.clean(desc).slice(0, 18);
    let term = t[0];
    if (t.length > 1) {
      const pair = t[0] + ' ' + t[1];
      const dfOne = m.df.get(t[0]) || 0, dfPair = m.df.get(pair) || 0;
      if (GENERIC_HEAD.has(t[0]) || t[0].length <= 3 || (dfOne && dfPair / dfOne >= 0.7)) term = pair;
    }
    return findOriginal(desc, term) || term;
  }
  function findOriginal(desc, normTerm) {
    const words = P.parse.clean(desc).split(/\s+/);
    const parts = normTerm.split(' ');
    for (let i = 0; i < words.length; i++) {
      const slice = words.slice(i, i + parts.length).join(' ');
      if (P.parse.norm(slice) === normTerm) return slice;
    }
    return null;
  }

  /* ---------- הצעה לפי צורת ההוצאה ----------
   * כשאין דמיון בשם, עדיין יש רמז: סכום טיפוסי ותדירות. בית עסק שגובה
   * ארבעים שקל שלוש פעמים בשבוע דומה יותר לסופר או לבית קפה מאשר לביטוח.
   */
  function suggestByShape(group, txs, max) {
    const labeled = txs.filter((t) => t.amount < 0 && t.cat && t.cat !== P.cats.OTHER && t.source !== 'inferred' && t.source !== 'none');
    if (labeled.length < 20 || !group || !group.count) return [];
    const months = (dates) => {
      const s = dates.slice().sort();
      return Math.max(1, days(s[0], s[s.length - 1]) / 30.4);
    };
    const prof = new Map();
    merchants(labeled).forEach((g) => {
      let p = prof.get(g.cat);
      if (!p) { p = { amts: [], freqs: [] }; prof.set(g.cat, p); }
      p.amts.push(Math.log(1 + median(g.amounts)));
      p.freqs.push(Math.log(1 + g.count / months(g.dates)));
    });
    const a = Math.log(1 + median(group.amounts));
    const f = Math.log(1 + group.count / months(group.dates));
    const rows = [];
    prof.forEach((p, cat) => {
      if (p.amts.length < 2 || cat === P.cats.INCOME) return;
      rows.push({ cat: cat, dist: Math.abs(a - median(p.amts)) + 1.4 * Math.abs(f - median(p.freqs)) });
    });
    return rows.sort((x, y) => x.dist - y.dist).slice(0, max || 2).map((r) => r.cat);
  }

  /* ---------- כריית כללים: אילו מונחים מנבאים קטגוריה ---------- */
  /**
   * עובר על כל המונחים שמופיעים בתנועות מסווגות, ומחזיר רק כאלה
   * שכמעט תמיד מופיעים באותה קטגוריה — אלה מועמדים טובים לכלל קבוע.
   */
  function mineRules(txs, rules, opts) {
    const o = Object.assign({ minDocs: 2, minPurity: 0.86, max: 40 }, opts);
    const m = model(txs);
    const known = [];
    for (const cat in rules) rules[cat].forEach((k) => { const n = P.parse.norm(k); if (n) known.push(n); });
    const isKnown = (term) => known.some((k) => term === k || term.indexOf(k) !== -1);

    // לומדים רק ממה שתייגתם בעצמכם או ממה שהגיע מסווג בקובץ — כלל קיים לא צריך כלל נוסף
    const byTerm = new Map();
    txs.forEach((t, i) => {
      if (t.source !== 'manual' && t.source !== 'file') return;
      const head = headTokens(t.desc).join(' ');
      m.docs[i].forEach((term) => {
        if ((m.df.get(term) || 0) < o.minDocs || isKnown(term)) return;
        let e = byTerm.get(term);
        if (!e) { e = { term: term, total: 0, manual: 0, cats: new Map(), sum: 0, example: t, ids: new Set(), headHits: 0 }; byTerm.set(term, e); }
        e.total++; e.sum += Math.abs(t.amount); e.ids.add(i);
        if (t.source === 'manual') e.manual++;
        if (head === term || head.indexOf(term) === 0 || term.indexOf(head) === 0) e.headHits++;
        e.cats.set(t.cat, (e.cats.get(t.cat) || 0) + (t.source === 'manual' ? 2.5 : 1));
      });
    });

    const candidates = [];
    byTerm.forEach((e) => {
      if (e.total < o.minDocs) return;
      // המונח צריך להופיע כמעט רק בתנועות מהקטגוריה הזאת — גם בכל הטבלה, לא רק בתוויות
      const df = m.df.get(e.term) || e.total;
      let bestCat = null, bestVal = 0, totalVal = 0;
      e.cats.forEach((v, c) => { totalVal += v; if (v > bestVal) { bestVal = v; bestCat = c; } });
      const purity = (bestVal / totalVal) * Math.min(1, e.total / df + 0.25);
      if (purity < o.minPurity) return;
      candidates.push({
        keyword: findOriginal(e.example.desc, e.term) || e.term,
        term: e.term, cat: bestCat, docs: e.total, manual: e.manual,
        purity: Math.min(1, purity), sum: e.sum, ids: e.ids,
        strength: m.idf(e.term) * Math.log(1 + e.total) * (1 + e.manual) * purity * (1 + 2 * e.headHits / e.total) * (e.term.indexOf(' ') > 0 ? 1.3 : 1),
        example: e.example
      });
    });
    candidates.sort((a, b) => b.strength - a.strength);

    // מונחים שמכסים את אותן תנועות הם אותו כלל — שומרים רק את הטוב מכולם
    const out = [];
    for (const c of candidates) {
      const dup = out.some((k) => {
        if (k.cat !== c.cat) return false;
        let inter = 0; c.ids.forEach((i) => { if (k.ids.has(i)) inter++; });
        return inter / Math.min(c.ids.size, k.ids.size) >= 0.8;
      });
      if (!dup) out.push(c);
      if (out.length >= o.max) break;
    }
    return out.map((c) => { delete c.ids; return c; });
  }

  /* ---------- הוראות קבע ומנויים ---------- */
  function recurring(txs) {
    const groups = merchants(txs.filter((t) => t.amount < 0));
    const asOf = txs.reduce((m, t) => (t.date > m ? t.date : m), '');
    const out = [];
    groups.forEach((g) => {
      if (g.count < 3) return;
      const dates = g.dates.slice().sort();
      const gaps = [];
      for (let i = 1; i < dates.length; i++) gaps.push(days(dates[i - 1], dates[i]));
      if (!gaps.length) return;
      const med = median(gaps);
      if (med < 20 || med > 400) return;
      const spread = median(gaps.map((x) => Math.abs(x - med)));
      if (spread > Math.max(4, med * 0.22)) return;
      const span = days(dates[0], dates[dates.length - 1]);
      if (span < med * 2) return;

      const amts = g.amounts.slice().sort((a, b) => a - b);
      const medAmt = median(amts);
      const amtSpread = medAmt ? median(amts.map((x) => Math.abs(x - medAmt))) / medAmt : 1;
      if (amtSpread > 0.22) return;

      const cadence = med < 45 ? 'חודשי' : med < 100 ? 'דו-חודשי' : med < 200 ? 'רבעוני' : 'שנתי';
      const next = addDays(dates[dates.length - 1], Math.round(med));
      out.push({
        key: g.key, label: g.label, cat: g.cat, count: g.count,
        amount: medAmt, cadence: cadence, everyDays: Math.round(med),
        last: dates[dates.length - 1], next: next,
        // החיוב הבא כבר היה אמור להגיע מזמן ולא הגיע? כנראה שהמנוי הופסק
        active: !asOf || days(next, asOf) <= Math.max(12, med * 0.6),
        yearly: medAmt * (365 / med), ids: g.ids
      });
    });
    return out.sort((a, b) => (a.active === b.active ? b.yearly - a.yearly : a.active ? -1 : 1));
  }

  /* ---------- חיובים חריגים ---------- */
  function anomalies(txs, limit) {
    const groups = merchants(txs.filter((t) => t.amount < 0));
    const out = [];
    groups.forEach((g) => {
      if (g.count < 4) return;
      const sorted = g.amounts.slice().sort((a, b) => a - b);
      const med = median(sorted);
      if (!med) return;
      const mad = median(sorted.map((x) => Math.abs(x - med))) || med * 0.15;
      g.ids.forEach((id, i) => {
        const v = g.amounts[i];
        const z = (v - med) / (mad * 1.4826 || 1);
        if (z > 4 && v > med * 1.8 && v > 80) {
          const tx = txs.find((t) => t.id === id);
          if (tx) out.push({ tx: tx, merchant: g.label, usual: med, ratio: v / med, z: z });
        }
      });
    });
    out.sort((a, b) => b.ratio - a.ratio);
    return limit ? out.slice(0, limit) : out;
  }

  /* ---------- עזרים ---------- */
  function days(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function addDays(iso, n) {
    const d = new Date(iso); d.setDate(d.getDate() + n);
    return P.parse.isoDate(d);
  }
  function median(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  return { tokens, terms, headTokens, model, invalidate, merchantKey, merchants, suggest, suggestByShape, keywordFor, mineRules, recurring, anomalies, STOP };
})();
