/* ==========================================================================
   core/state.js — מצב האפליקציה, סיווג בשלושה שלבים, ושאילתות נגזרות.

   סדר ההכרעה לכל תנועה:
     1. שיוך ידני שלכם                      (manual)
     2. קטגוריה שהגיעה בקובץ עצמו            (file)
     3. כלל מילת מפתח                       (rule)
     4. היסק מהמנוע הלומד, אם הביטחון גבוה   (inferred)
     5. אחרת — ממתין לשיוך
   ========================================================================== */
window.P = window.P || {};

P.state = (function () {
  'use strict';

  const INFER_MIN = 0.55;          // סף ביטחון להחלה אוטומטית של היסק
  const INFER_LIMIT = 2500;        // תקרת תנועות להיסק, לשמירה על מהירות

  const dict = P.dict;             // מילון בלי אב-טיפוס: שמות קטגוריות ומזהים הם מפתחות חופשיים
  const S = {
    tx: [],
    budgets: dict(),
    rules: dict(),
    overrides: dict(),  // מזהה -> קטגוריה שנבחרה ידנית
    notes: dict(),      // מזהה -> הערה חופשית
    renames: dict(),    // מזהה -> תיאור שנערך
    meta: {},
    files: [],
    profiles: dict(),   // חתימת מבנה קובץ -> מיפוי עמודות שמור
    excluded: dict(),   // קטגוריות שלא נספרות בסיכומים (העברות פנימיות, חיובי אשראי מרוכזים)
    prefs: { theme: 'auto', infer: true }
  };

  const listeners = [];
  const subscribe = (fn) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); };
  function changed(reason) { listeners.forEach((fn) => fn(reason)); }

  /* ---------- מחזור חיים ---------- */
  /*
   * מה שנטען מהדיסק (קובץ הנתונים, גיבוי ששוחזר) לא מתקבל כמו שהוא: כל שדה נבדק
   * ומנוקה. קובץ פגום, ישן או ערוך ביד מאבד לכל היותר את השורות הפגומות —
   * ולא מפיל את האפליקציה בכל פתיחה.
   */
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max || 400) : '');
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  function cleanTx(t) {
    if (!isObj(t)) return null;
    const id = str(t.id, 80);
    const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount);
    if (!id || !ISO.test(t.date) || !isFinite(amount) || amount === 0) return null;
    const out = { id: id, date: t.date, desc: str(t.desc) || 'תנועה ללא תיאור', amount: amount,
      currency: str(t.currency, 12) || '₪', balance: typeof t.balance === 'number' && isFinite(t.balance) ? t.balance : null, ref: str(t.ref, 80) };
    const fc = str(t.fileCat, 40);
    if (fc) out.fileCat = fc;
    if (Number.isInteger(t.n) && t.n >= 0 && t.n < 100000) out.n = t.n;      // המקום בתוך היום, כפי שהיה בדוח
    return out;
  }
  /** מילון של מחרוזות (מזהה -> קטגוריה / הערה / תיאור) */
  function strDict(src, max) {
    const out = dict();
    if (isObj(src)) for (const k of Object.keys(src)) { const v = str(src[k], max); if (v) out[k] = v; }
    return out;
  }
  function cleanRules(src) {
    if (!isObj(src) || !Object.keys(src).length) return null;
    const out = dict();
    for (const cat of Object.keys(src)) {
      const name = P.parse.clean(cat).slice(0, 60);
      if (!name) continue;
      out[name] = (Array.isArray(src[cat]) ? src[cat] : []).map((k) => P.parse.clean(str(k, 80))).filter(Boolean);
    }
    return out;
  }
  function cleanFiles(src) {
    return (Array.isArray(src) ? src : []).filter(isObj).slice(0, 24).map((f) => ({
      name: str(f.name, 200) || 'קובץ', at: str(f.at, 40), added: +f.added || 0, skipped: +f.skipped || 0,
      from: ISO.test(f.from) ? f.from : undefined, to: ISO.test(f.to) ? f.to : undefined,
      kind: f.kind === 'card' ? 'card' : 'account', skippedRows: +f.skippedRows || 0, mapped: +f.mapped || 0
    }));
  }
  function cleanProfiles(src) {
    const out = dict();
    if (isObj(src)) for (const sig of Object.keys(src)) {
      const p = src[sig];
      if (!isObj(p) || !isObj(p.mapping)) continue;
      const mapping = {};
      for (const role of Object.keys(p.mapping)) { const i = p.mapping[role]; if (Number.isInteger(i) && i >= 0 && i < 500) mapping[role] = i; }
      out[sig] = { name: str(p.name, 200), headerRow: Number.isInteger(p.headerRow) ? p.headerRow : undefined, mapping: mapping,
        options: isObj(p.options) ? { signMode: str(p.options.signMode, 12), dateOrder: str(p.options.dateOrder, 6), decimal: str(p.options.decimal, 6), currency: str(p.options.currency, 12) } : {}, at: str(p.at, 40) };
      for (const k of Object.keys(out[sig].options)) if (!out[sig].options[k]) delete out[sig].options[k];
    }
    return out;
  }
  function cleanPrefs(src) {
    const p = isObj(src) ? src : {};
    return {
      theme: ['auto', 'light', 'dark'].indexOf(p.theme) !== -1 ? p.theme : 'auto',
      accent: str(p.accent, 20) || 'ink',
      intro: ['first', 'always', 'session', 'off'].indexOf(p.intro) !== -1 ? p.intro : 'first',
      // ההדמיות: בפעם הראשונה שמגיעים לכל מקום (ברירת המחדל), בכל פעם, או אף פעם. seen — המקומות שכבר הוצגו
      stories: ['first', 'always', 'off'].indexOf(p.stories) !== -1 ? p.stories : 'first',
      seen: (Array.isArray(p.seen) ? p.seen : []).filter((k) => typeof k === 'string' && k.length <= 40).slice(-400),
      infer: p.infer !== false
    };
  }

  function hydrate(data) {
    const d = isObj(data) ? data : {};
    const seen = new Set();
    S.tx = (Array.isArray(d.tx) ? d.tx : []).map(cleanTx).filter((t) => t && !seen.has(t.id) && seen.add(t.id));
    S.rules = cleanRules(d.rules) || P.cats.defaults();
    S.overrides = strDict(d.overrides, 60);
    S.notes = strDict(d.notes, 600);
    S.renames = strDict(d.renames, 400);
    S.meta = {};
    if (isObj(d.meta)) [['branch', 60], ['client', 120], ['bank', 60], ['account', 60], ['period', 80]].forEach(([k, max]) => { const v = str(d.meta[k], max); if (v) S.meta[k] = v; });
    S.files = cleanFiles(d.files);
    S.profiles = cleanProfiles(d.profiles);
    S.excluded = dict();
    if (isObj(d.excluded)) for (const k of Object.keys(d.excluded)) if (d.excluded[k]) S.excluded[k] = true;
    S.prefs = cleanPrefs(d.prefs);
    S.budgets = dict();
    if (isObj(d.budgets)) for (const k of Object.keys(d.budgets)) { const v = d.budgets[k]; if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e9) S.budgets[k] = v; }
    ensureCategories();
    reclassify();
  }

  function snapshot() {
    return {
      tx: S.tx.map((t) => ({
        id: t.id, date: t.date, desc: t.desc, amount: t.amount,
        currency: t.currency, balance: t.balance, ref: t.ref, fileCat: t.fileCat || undefined, n: t.n
      })),
      budgets: S.budgets, rules: S.rules, overrides: S.overrides, notes: S.notes, renames: S.renames,
      meta: S.meta, files: S.files, profiles: S.profiles, excluded: S.excluded, prefs: S.prefs
    };
  }

  /** כל קטגוריה שמופיעה בשיוך ידני או בקובץ חייבת להתקיים ברשימת הכללים */
  function ensureCategories() {
    if (!(P.cats.OTHER in S.rules)) S.rules[P.cats.OTHER] = [];
    for (const id in S.overrides) {
      const c = S.overrides[id];
      if (c && !(c in S.rules)) S.rules[c] = [];
    }
    S.tx.forEach((t) => {
      if (!t.fileCat) return;
      const mapped = P.cats.mapExternal(t.fileCat, S.rules);
      if (!mapped && !(t.fileCat in S.rules)) S.rules[t.fileCat] = [];
    });
  }

  /** קטגוריית הקובץ אחרי תרגום לשמות שלנו */
  const fileCatMemo = new Map();
  function resolveFileCat(fc) {
    if (!fc) return null;
    if (fileCatMemo.has(fc)) return fileCatMemo.get(fc);
    const v = P.cats.mapExternal(fc, S.rules) || (S.rules[fc] ? fc : null);
    fileCatMemo.set(fc, v);
    return v;
  }

  /*
   * צבע לכל קטגוריה — קבוע לכל האפליקציה.
   * נקבע לפי סך ההוצאה בכל הנתונים, ולא לפי הדירוג בתצוגה הנוכחית,
   * כדי שקטגוריה תהיה באותו צבע בכל עמוד, חודש וטווח.
   */
  let colorCache = null, tintCache = null;
  function rankedCats() {
    const spend = dict();
    S.tx.forEach((t) => { if (t.amount < 0 && !S.excluded[t.cat]) spend[t.cat] = (spend[t.cat] || 0) - t.amount; });
    const order = Object.keys(spend).sort((a, b) => spend[b] - spend[a]);
    Object.keys(S.rules).forEach((c) => { if (order.indexOf(c) === -1) order.push(c); });
    return order;
  }
  function colors() {
    if (colorCache) return colorCache;
    const order = rankedCats();
    colorCache = P.cats.colorMap(order);
    tintCache = P.cats.tintMap(order);
    return colorCache;
  }
  /** גוון הזהות של קטגוריה (אריח, כרטיס, שורה). ראו P.cats.tintMap */
  const tintOf = (cat) => {
    if (cat === P.cats.OTHER) return P.cats.PENDING;
    if (cat === P.cats.INCOME) return 'var(--pos)';
    colors();
    return (tintCache && tintCache[cat]) || P.cats.REST;
  };
  const colorOf = (cat) => {
    if (cat === P.cats.OTHER) return P.cats.PENDING;
    if (cat === P.cats.INCOME) return 'var(--pos)';
    return colors()[cat] || P.cats.REST;
  };

  /* ---------- כיסוי חודש ----------
   * האם יש לנו נתונים על כל ימי החודש? חודש ראשון או אחרון בקובץ הוא לרוב חלקי
   * (למשל דוח שנגמר ב-01.10 יוצר "אוקטובר" של יום אחד). */
  function coverage(key) {
    const b = knownBounds();
    const e = P.fmt.monthEdges(key);
    if (!b) return { ratio: 0, partial: true, from: e.from, to: e.to, days: e.days, covered: 0 };
    const from = b.first > e.from ? b.first : e.from;
    const to = b.last < e.to ? b.last : e.to;
    const covered = from > to ? 0 : Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    const ratio = covered / e.days;
    return { ratio: ratio, partial: ratio < 0.97, from: from, to: to, days: e.days, covered: covered, isLast: b.last <= e.to, isFirst: b.first >= e.from };
  }

  /**
   * הטווח שעליו יש לנו מידע: מהתנועה הראשונה עד האחרונה — ומורחב לפי תקופת הדוח
   * שנרשמה בכל קובץ. דוח שהופק ב-01.10 ואין בו תנועות ב-29–30.09 עדיין מכסה
   * את כל ספטמבר: פשוט לא היו תנועות בימים האלה.
   */
  function knownBounds() {
    const b = dateBounds();
    if (!b) return null;
    let first = b.first, last = b.last;
    S.files.forEach((f) => {
      if (f.from && f.from < first) first = f.from;
      if (f.to && f.to > last) last = f.to;
    });
    return { first: first, last: last };
  }
  /** תקופת הדוח מתוך הכותרת של הקובץ ("01.10.2025 - 01.10.2026"), אם יש */
  function periodOf(meta, list) {
    const dates = [];
    const m = String((meta && meta.period) || '').match(/\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}|\d{4}-\d{2}-\d{2}/g) || [];
    m.forEach((x) => { const d = P.parse.date(x); if (d) dates.push(d); });
    const today = P.parse.isoDate(new Date());
    const tx = list.map((t) => t.date).sort();
    if (!tx.length) return {};
    let from = tx[0], to = tx[tx.length - 1];
    if (dates.length >= 2) {
      dates.sort();
      // סומכים על הכותרת רק כשהיא עוטפת את התנועות, ולא מרחיקה אל העתיד
      if (dates[0] <= from) from = dates[0];
      const end = dates[dates.length - 1] > today ? today : dates[dates.length - 1];
      if (end >= to) to = end;
    }
    return { from: from, to: to };
  }

  /* ---------- בית עסק לפי מפתח ---------- */
  function merchantByKey(key, list) {
    const src = list || S.tx;
    const txs = src.filter((t) => P.learn.merchantKey(t.desc) === key);
    if (!txs.length) return null;
    const label = txs.reduce((a, t) => (t.desc.length < a.length ? t.desc : a), txs[0].desc);
    const cats = dict();
    txs.forEach((t) => { cats[t.cat] = (cats[t.cat] || 0) + 1; });
    const cat = Object.keys(cats).sort((a, b) => cats[b] - cats[a])[0];
    return { key: key, label: label, cat: cat, txs: txs, ids: txs.map((t) => t.id),
      sum: txs.reduce((a, t) => a + Math.abs(t.amount), 0), count: txs.length };
  }

  /**
   * שיוך שאפשר לבטל: מחזיר פונקציה שמחזירה את המצב הקודם —
   * את השיוכים הידניים שהיו לתנועות, ואת הכלל אם נוסף.
   */
  function assignUndoable(ids, cat, keyword) {
    const arr = Array.isArray(ids) ? ids : [ids];
    const before = dict();
    arr.forEach((id) => { before[id] = S.overrides[id]; });
    let addedKw = null;
    // cat === null פירושו "חזרה לסיווג אוטומטי": מוחקים את השיוך הידני ולא יוצרים כלל
    if (cat === null || cat === undefined) {
      arr.forEach((id) => { delete S.overrides[id]; });
      reclassify(); changed('assign');
      return { keywordAdded: null, undo: function () {
        arr.forEach((id) => { if (before[id] !== undefined) S.overrides[id] = before[id]; });
        reclassify(); changed('assign');
      } };
    }
    const hadCat = !!S.rules[cat];
    arr.forEach((id) => { S.overrides[id] = cat; });
    if (!hadCat) S.rules[cat] = [];
    if (keyword) {
      const kw = P.parse.clean(keyword);
      if (kw && !S.rules[cat].some((k) => P.parse.norm(k) === P.parse.norm(kw))) { S.rules[cat].push(kw); addedKw = kw; }
    }
    reclassify(); changed('assign');
    return { keywordAdded: addedKw, undo: function () {
      arr.forEach((id) => { if (before[id] === undefined) delete S.overrides[id]; else S.overrides[id] = before[id]; });
      if (addedKw && S.rules[cat]) S.rules[cat] = S.rules[cat].filter((k) => k !== addedKw);
      reclassify(); changed('assign');
    } };
  }

  /*
   * נתונים של הוצאות בלבד: פירוט כרטיס אשראי מכיל רק חיובים (ולפעמים זיכוי קטן).
   * בלי הכנסות אין משמעות ל"מאזן", "נשאר" או "חסר" — והמסכים מציגים במקומם נתוני הוצאה.
   */
  let spendOnlyCache = null;
  function spendOnly() {
    if (spendOnlyCache === null) {
      let out = 0, inc = 0;
      for (const t of S.tx) { if (S.excluded[t.cat]) continue; if (t.amount < 0) out -= t.amount; else inc += t.amount; }
      spendOnlyCache = out > 0 && inc < out * 0.1;
    }
    return spendOnlyCache;
  }

  function reclassify() {
    P.learn.invalidate();
    colorCache = null; tintCache = null; spendOnlyCache = null;
    fileCatMemo.clear();

    // שלב 1–3: הכרעות ודאיות
    for (const t of S.tx) {
      if (S.renames[t.id]) t.desc = S.renames[t.id];
      t.note = S.notes[t.id] || '';
      t.guess = null;
      if (S.overrides[t.id]) { t.cat = S.overrides[t.id]; t.source = 'manual'; }
      else if (t.fileCat && resolveFileCat(t.fileCat)) { t.cat = resolveFileCat(t.fileCat); t.source = 'file'; }
      else {
        const c = P.cats.classify(t.desc, t.amount, S.rules);
        t.cat = c;
        t.source = c === P.cats.OTHER ? 'none' : 'rule';
      }
      t.auto = t.source !== 'manual';
    }

    // שלב 4: היסק לתנועות שנשארו ללא קטגוריה
    if (S.prefs.infer !== false) {
      const unknown = S.tx.filter((t) => t.cat === P.cats.OTHER);
      const labeled = S.tx.length - unknown.length;
      if (unknown.length && unknown.length <= INFER_LIMIT && labeled >= 12) {
        for (const t of unknown) {
          const s = P.learn.suggest(t.desc, S.tx, 1)[0];
          if (!s) continue;
          t.guess = s;
          if (s.confidence >= INFER_MIN) { t.cat = s.cat; t.source = 'inferred'; }
        }
      }
    }

    // מהחדשה לישנה; בתוך אותו יום — בסדר שבו התנועות הופיעו בדוח של הבנק
    S.tx.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.n || 0) - (a.n || 0) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)));
  }

  /* ---------- ייבוא ---------- */
  function addTransactions(list, meta, fileName, extra) {
    const seen = new Set(S.tx.map((t) => t.id));
    let added = 0, dup = 0;
    for (const t of list) {
      if (seen.has(t.id)) { dup++; continue; }
      seen.add(t.id); S.tx.push(t); added++;
    }
    if (meta && Object.keys(meta).length) S.meta = Object.assign({}, S.meta, meta);
    if (added) S.files.unshift(cleanFiles([Object.assign({ name: fileName, at: new Date().toISOString(), added: added, skipped: dup }, periodOf(meta, list), extra || {})])[0]);
    S.files = S.files.slice(0, 24);
    ensureCategories();
    reclassify();
    changed('import');
    return { added: added, duplicates: dup };
  }

  /** ביטול טעינה: מסיר תנועות לפי מזהה, יחד עם כל מה שנשמר עליהן */
  function removeTransactions(ids, fileName) {
    const set = ids instanceof Set ? ids : new Set(ids);
    S.tx = S.tx.filter((t) => !set.has(t.id));
    set.forEach((id) => { delete S.overrides[id]; delete S.notes[id]; delete S.renames[id]; });
    if (fileName) { const i = S.files.findIndex((f) => f.name === fileName); if (i !== -1) S.files.splice(i, 1); }
    reclassify(); changed('import');
  }

  function setBudget(cat, value) {
    if (!(cat in S.rules)) throw new Error('קטגוריה לא קיימת');
    if (value === null) delete S.budgets[cat];
    else { if (!Number.isFinite(value) || value < 0 || value > 1e9) throw new Error('תקציב לא תקין'); S.budgets[cat] = value; }
    changed('budget');
  }
  function editTransaction(id, patch) {
    const old = S.tx.find(t => t.id === id);
    if (!old) throw new Error('התנועה לא נמצאה');
    const next = cleanTx(Object.assign({}, old, patch, {id}));
    if (!next || P.parse.date(next.date) !== next.date) throw new Error('תאריך או סכום לא תקינים');
    // A modified amount/date cannot retain an authoritative bank running balance.
    if (next.amount !== old.amount || next.date !== old.date) next.balance = null;
    S.tx[S.tx.indexOf(old)] = next;
    delete S.renames[id];
    reclassify(); changed('edit');
  }

  function saveProfile(signature, payload) { S.profiles[signature] = payload; changed('profile'); }
  function getProfile(signature) { return S.profiles[signature] || null; }

  /* ---------- עריכה ---------- */
  function assign(ids, cat) {
    const arr = Array.isArray(ids) ? ids : [ids];
    for (const id of arr) {
      if (cat === null) delete S.overrides[id];
      else S.overrides[id] = cat;
    }
    if (cat && !(cat in S.rules)) S.rules[cat] = [];
    reclassify(); changed('assign');
  }
  function setNote(id, text) {
    text = P.parse.clean(text);
    if (text) S.notes[id] = text; else delete S.notes[id];
    reclassify(); changed('edit');
  }
  function rename(id, desc) {
    desc = P.parse.clean(desc);
    const tx = S.tx.find((t) => t.id === id);
    if (!tx) return;
    if (desc && desc !== tx.desc) S.renames[id] = desc; else delete S.renames[id];
    if (desc) tx.desc = desc;
    reclassify(); changed('edit');
  }
  function addKeyword(cat, kw) {
    kw = P.parse.clean(kw);
    if (!kw) return false;
    if (!S.rules[cat]) S.rules[cat] = [];
    if (S.rules[cat].some((k) => P.parse.norm(k) === P.parse.norm(kw))) return false;
    S.rules[cat].push(kw);
    reclassify(); changed('rules');
    return true;
  }
  function removeKeyword(cat, index) { S.rules[cat].splice(index, 1); reclassify(); changed('rules'); }
  function addCategory(name) {
    name = P.parse.clean(name);
    if (!name || S.rules[name]) return false;
    S.rules[name] = []; changed('rules'); return true;
  }
  function removeCategory(name) {
    delete S.rules[name];
    delete S.budgets[name];
    for (const id in S.overrides) if (S.overrides[id] === name) delete S.overrides[id];
    S.tx.forEach((t) => { if (t.fileCat === name) delete t.fileCat; });
    reclassify(); changed('rules');
  }
  function resetRules() { S.rules = P.cats.defaults(); ensureCategories(); reclassify(); changed('rules'); }
  function wipe() { spendOnlyCache = null; S.tx = []; S.budgets = dict(); S.overrides = dict(); S.notes = dict(); S.renames = dict(); S.meta = {}; S.files = []; changed('wipe'); }
  function setPref(k, v) { S.prefs[k] = v; if (k === 'infer') reclassify(); changed('prefs'); }

  /* ---------- קטגוריות שלא נספרות ---------- */
  const isExcluded = (t) => !!S.excluded[t.cat];
  function setExcluded(cat, on) {
    if (on) S.excluded[cat] = true; else delete S.excluded[cat];
    colorCache = null; tintCache = null; spendOnlyCache = null;
    changed('rules');
  }
  /** כל התנועות שנספרות — הבסיס לכל סיכום וגרף */
  function counted() { return S.tx.filter((t) => !S.excluded[t.cat]); }

  /**
   * כפילות בין בנק לאשראי: אם נטען פירוט של כרטיס אשראי, וגם בדוח הבנק יש
   * שורות חיוב מרוכזות של אותו כרטיס, אותן הוצאות נספרות פעמיים.
   */
  function settlementRisk() {
    const cat = P.cats.SETTLEMENT;
    if (S.excluded[cat]) return null;
    const lines = S.tx.filter((t) => t.cat === cat && t.amount < 0);
    if (!lines.length) return null;
    const hasCardDetail = S.files.some((f) => f.kind === 'card');
    return { count: lines.length, sum: lines.reduce((a, t) => a - t.amount, 0), confirmed: hasCardDetail };
  }

  /* ---------- שאילתות ---------- */
  const monthOf = (t) => t.date.slice(0, 7);
  const yearOf = (t) => t.date.slice(0, 4);

  function filter(opts) {
    const o = opts || {};
    const q = o.q ? P.parse.norm(o.q) : '';
    return S.tx.filter((t) => {
      if (!o.all && S.excluded[t.cat]) return false;
      if (o.from && t.date < o.from) return false;
      if (o.to && t.date > o.to) return false;
      if (o.month && monthOf(t) !== o.month) return false;
      if (o.year && yearOf(t) !== o.year) return false;
      if (o.cat && t.cat !== o.cat) return false;
      if (o.flow === 'out' && t.amount >= 0) return false;
      if (o.flow === 'in' && t.amount <= 0) return false;
      if (q && P.parse.norm(t.desc + ' ' + (t.ref || '') + ' ' + (t.note || '')).indexOf(q) === -1) return false;
      return true;
    });
  }

  function totals(list) {
    let outflow = 0, inflow = 0;
    for (const t of list) { if (t.amount < 0) outflow -= t.amount; else inflow += t.amount; }
    return { outflow: outflow, inflow: inflow, net: inflow - outflow, count: list.length };
  }

  function months(year, list) {
    const src = list || counted();
    const map = {};
    for (const t of src) {
      if (year && yearOf(t) !== year) continue;
      const k = monthOf(t);
      if (!map[k]) map[k] = { key: k, outflow: 0, inflow: 0, count: 0 };
      if (t.amount < 0) map[k].outflow -= t.amount; else map[k].inflow += t.amount;
      map[k].count++;
    }
    return Object.values(map)
      .map((m) => Object.assign(m, { net: m.inflow - m.outflow }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }

  function years() { return Array.from(new Set(S.tx.map(yearOf))).sort().reverse(); }

  function byCategory(list) {
    const map = dict();
    for (const t of list) {
      const v = Math.abs(t.amount);
      if (!map[t.cat]) map[t.cat] = { cat: t.cat, sum: 0, count: 0 };
      map[t.cat].sum += v; map[t.cat].count++;
    }
    const rows = Object.values(map).sort((a, b) => b.sum - a.sum);
    rows.forEach((r) => { r.color = colorOf(r.cat); r.tint = tintOf(r.cat); });
    return rows;
  }

  /** קיבוץ לבתי עסק דרך המנוע הלומד */
  function byMerchant(list, limit) { return P.learn.merchants(list, limit); }

  /** התור של עמוד השיוך: בתי עסק שעדיין ללא קטגוריה, עם ההצעות שלהם */
  function unassigned() {
    const list = S.tx.filter((t) => t.cat === P.cats.OTHER);
    if (!list.length) return [];
    return P.learn.merchants(list).map((g) => {
      const sample = g.sample;
      const learned = P.learn.suggest(sample.desc, S.tx, 3).map((s) => s.cat);
      const dict = P.cats.suggest(sample.desc, S.rules, 3);
      const sugg = [];
      learned.concat(dict).forEach((c) => { if (c && sugg.indexOf(c) === -1) sugg.push(c); });
      let basis = learned.length ? 'similar' : dict.length ? 'words' : 'shape';
      if (!sugg.length) P.learn.suggestByShape(g, S.tx, 2).forEach((c) => sugg.push(c));
      if (!sugg.length) basis = 'none';
      return Object.assign(g, {
        suggestions: sugg.slice(0, 3),
        basis: basis,
        confidence: sample.guess ? sample.guess.confidence : 0,
        keyword: P.learn.keywordFor(sample.desc, S.tx)
      });
    });
  }

  /** תנועות שהמנוע שייך לבד וממתינות לאישורכם */
  function inferred() { return S.tx.filter((t) => t.source === 'inferred'); }

  function dateBounds() {
    if (!S.tx.length) return null;
    const dates = S.tx.map((t) => t.date).sort();
    return { first: dates[0], last: dates[dates.length - 1] };
  }

  /**
   * היתרה הסוגרת: היתרה שאחרי התנועה האחרונה. כשביום האחרון יש כמה תנועות, שרשרת היתרות עצמה
   * אומרת מי מהן אחרונה: כל תנועה מובילה מהיתרה שלפניה ליתרה שאחריה, והאחרונה היא היחידה
   * שאף תנועה אחרת לא ממשיכה ממנה. כשהשרשרת לא חד-משמעית (היום חזר לאותה יתרה, תנועה חסרה) —
   * לפי המקום של התנועה בדוח.
   */
  function lastBalance(list) {
    const withBal = (list || S.tx).filter((t) => typeof t.balance === 'number');
    if (!withBal.length) return null;
    const last = withBal.reduce((d, t) => (t.date > d ? t.date : d), withBal[0].date);
    const day = withBal.filter((t) => t.date === last);
    if (day.length > 1) {
      const agorot = (x) => Math.round(x * 100);
      const flow = new Map();                                  // יתרה -> כמה תנועות מגיעות אליה, פחות כמה יוצאות ממנה
      day.forEach((t) => {
        const to = agorot(t.balance), from = agorot(t.balance - t.amount);
        flow.set(to, (flow.get(to) || 0) + 1);
        flow.set(from, (flow.get(from) || 0) - 1);
      });
      const ends = Array.from(flow.keys()).filter((k) => flow.get(k) > 0);
      if (ends.length === 1 && flow.get(ends[0]) === 1) return day.find((t) => agorot(t.balance) === ends[0]);
    }
    return day.reduce((a, t) => ((t.n || 0) > (a.n || 0) ? t : a), day[0]);
  }

  /** היתרה שהייתה בחשבון לפני תאריך נתון, לפי התנועות שכבר כאן — או null כשאין ממה ללמוד */
  function balanceBefore(date) {
    const prior = lastBalance(S.tx.filter((t) => t.date < date));
    return prior ? prior.balance : null;
  }

  function sources() {
    const c = { manual: 0, file: 0, rule: 0, inferred: 0, none: 0 };
    S.tx.forEach((t) => { c[t.source] = (c[t.source] || 0) + 1; });
    return c;
  }

  return {
    data: S, setBudget, editTransaction, subscribe, changed, hydrate, snapshot, reclassify, ensureCategories,
    addTransactions, removeTransactions, saveProfile, getProfile,
    assign, setNote, rename, addKeyword, removeKeyword, addCategory, removeCategory, resetRules, wipe, setPref,
    filter, totals, months, years, byCategory, byMerchant, unassigned, inferred, dateBounds, lastBalance, balanceBefore, sources,
    monthOf, yearOf, knownBounds, INFER_MIN, isExcluded, setExcluded, counted, spendOnly, settlementRisk, colors, colorOf, tintOf, coverage, merchantByKey, assignUndoable
  };
})();
