/* ==========================================================================
   core/insights.js — סיכומים במילים ותובנות
   ---------------------------------------------------------------------------
   הופך מספרים למשפטים: "ירידה של 4% בהוצאות לעומת אוגוסט", "חסכת ₪420 בקניות".
   כל תובנה מקבלת ציון חשיבות; המסך מציג רק את המעטות והחשובות.
   הפעלים בגוף שני עבר ("הוצאת", "חסכת") — כתובים זהה לגבר ולאישה.
   ========================================================================== */
window.P = window.P || {};

P.insights = (function () {
  'use strict';
  const st = P.state, fmt = P.fmt;

  const monthKeys = () => st.months().map((m) => m.key);                 // מהחדש לישן
  const fullBefore = (key, n) => monthKeys().filter((k) => k < key && st.coverage(k).ratio >= 0.9).slice(0, n);

  /** החודש שהסקירה נפתחת עליו: האחרון — אלא אם יש בו פחות משבוע נתונים */
  function focusMonth() {
    const ks = monthKeys();
    if (!ks.length) return null;
    const cov = st.coverage(ks[0]);
    if (ks.length > 1 && (cov.covered < 7 || cov.ratio < 0.25)) return ks[1];
    return ks[0];
  }

  /** כל מה שצריך כדי לדבר על חודש אחד */
  function month(key) {
    const list = st.filter({ month: key });
    const totals = st.totals(list);
    const expense = list.filter((t) => t.amount < 0);
    const cats = st.byCategory(expense);
    const cov = st.coverage(key);
    const prevKey = fmt.addMonths(key, -1);
    const prevList = st.filter({ month: prevKey });
    const prev = prevList.length ? st.totals(prevList) : null;
    const prevCov = prevList.length ? st.coverage(prevKey) : null;
    const baseKeys = fullBefore(key, 3);
    const base = { months: baseKeys.length, outflow: 0, inflow: 0, byCat: P.dict() };
    baseKeys.forEach((k) => st.filter({ month: k }).forEach((t) => {
      if (t.amount < 0) { base.outflow -= t.amount; base.byCat[t.cat] = (base.byCat[t.cat] || 0) - t.amount; }
      else base.inflow += t.amount;
    }));
    if (base.months) {
      base.outflow /= base.months; base.inflow /= base.months;
      for (const c in base.byCat) base.byCat[c] /= base.months;
    }
    cats.forEach((c) => { c.avg = base.byCat[c.cat] || 0; c.delta = base.months ? c.sum - c.avg : null; });
    return { key: key, list: list, totals: totals, expense: expense, cats: cats, cov: cov,
      prevKey: prevKey, prev: prev, prevCov: prevCov, base: base,
      // היתרה היא של החשבון כולו — גם תנועות מקטגוריות שהוצאו מהסיכומים הזיזו אותה
      balance: st.lastBalance(st.filter({ month: key, all: true })) };
  }

  /** שניים-שלושה משפטים שמסכמים חודש */
  function summary(m) {
    const t = m.totals;
    if (!t.count) return ['אין תנועות בחודש הזה.'];
    const out = [];
    if (m.cov.partial && m.cov.isLast) {
      out.push('הנתונים מגיעים עד ' + fmt.dayWithMonth(m.cov.to) + ', כך שהחודש עוד לא נסגר.');
    } else if (m.prev && m.prev.outflow > 0 && !(m.prevCov && m.prevCov.partial)) {
      const d = (t.outflow - m.prev.outflow) / m.prev.outflow;
      const pn = fmt.monthOnly(m.prevKey);
      out.push(Math.abs(d) < 0.03 ? 'הוצאת בערך כמו ב' + pn + '.' : (d > 0 ? 'עלייה של ' : 'ירידה של ') + fmt.pct(d) + ' בהוצאות לעומת ' + pn + '.');
    } else if (m.base.months) {
      const d = (t.outflow - m.base.outflow) / m.base.outflow;
      out.push(Math.abs(d) < 0.03 ? 'בערך כמו בחודש רגיל.' : fmt.pct(d) + (d > 0 ? ' יותר' : ' פחות') + ' מבחודש רגיל.');
    }
    if (t.inflow > 0 && !st.spendOnly()) {
      out.push(t.net >= 0
        ? 'נכנסו ' + fmt.money(t.inflow) + ', כך שנשאר עודף של ' + fmt.money(t.net) + '.'
        : 'נכנסו ' + fmt.money(t.inflow) + ' — יצא יותר משנכנס, בפער של ' + fmt.money(t.net) + '.');
    }
    if (m.cats[0] && m.cats[0].cat !== P.cats.OTHER) out.push('הכי הרבה הלך ' + fmt.prefix('ל', m.cats[0].cat) + '.');
    return out;
  }

  /* ---------- תובנות לחודש ---------- */
  function cards(m, max) {
    const items = [];
    const t = m.totals;
    const counted = st.counted();

    // חיוב חריג בחודש הזה
    P.learn.anomalies(counted).filter((a) => a.tx.date.slice(0, 7) === m.key).slice(0, 1).forEach((a) => items.push({
      id: 'anom', score: 92, tone: 'bad', icon: { name: 'alert', color: 'var(--neg)' },
      title: 'חיוב חריג ' + fmt.prefix('ב', a.merchant),
      text: fmt.money(a.tx.amount) + ' ב-' + fmt.dayShort(a.tx.date) + ', פי ' + a.ratio.toFixed(1) + ' מהרגיל אצלם.',
      action: { type: 'tx', id: a.tx.id }
    }));

    // תנועות שמחכות לשיוך
    const pending = st.data.tx.filter((x) => x.cat === P.cats.OTHER);
    if (pending.length) {
      const groups = new Set(pending.map((x) => P.learn.merchantKey(x.desc))).size;
      items.push({
        id: 'pending', score: 85, tone: 'mark', icon: { cat: P.cats.OTHER },
        title: fmt.plural(pending.length, 'תנועה', 'תנועות', 'תנועה אחת') + ' מחכות לקטגוריה',
        text: 'מ-' + fmt.plural(groups, 'בית עסק', 'בתי עסק', 'בית עסק אחד') + '. שיוך אחד מטפל בכל התנועות של אותו עסק.',
        action: { type: 'route', hash: '#/assign' }
      });
    }

    // קטגוריות שזזו מול הממוצע
    if (m.base.months && !m.cov.partial) {
      const threshold = Math.max(200, m.base.outflow * 0.03);
      const set = new Set(m.cats.map((c) => c.cat).concat(Object.keys(m.base.byCat)));
      const movers = [];
      set.forEach((cat) => {
        if (cat === P.cats.OTHER || st.data.excluded[cat] || cat === 'העברות ומזומן' || cat === P.cats.SETTLEMENT) return;
        const now = (m.cats.find((c) => c.cat === cat) || {}).sum || 0;
        const avg = m.base.byCat[cat] || 0;
        const diff = now - avg;
        if (Math.abs(diff) < threshold) return;
        if (avg > 0 && Math.abs(diff / avg) < 0.25) return;
        movers.push({ cat: cat, now: now, avg: avg, diff: diff });
      });
      movers.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 2).forEach((mv) => {
        const up = mv.diff > 0;
        const period = m.base.months === 1 ? 'בחודש הקודם' : 'ב-' + m.base.months + ' החודשים הקודמים';
        items.push({
          id: 'cat:' + mv.cat, score: 70 + Math.min(18, Math.abs(mv.diff) / threshold), tone: up ? 'bad' : 'good', icon: { cat: mv.cat },
          title: up ? (mv.avg ? mv.cat + ': ' + fmt.pct(mv.diff / mv.avg) + ' יותר מהרגיל' : 'הוצאה חדשה על ' + mv.cat)
                    : 'חסכת ' + fmt.money(mv.diff) + ' ' + fmt.prefix('ב', mv.cat),
          text: fmt.money(mv.now) + ' החודש, לעומת ממוצע של ' + fmt.money(mv.avg) + ' ' + period + '.',
          action: { type: 'category', cat: mv.cat, month: m.key }
        });
      });
    }

    // עודף או גירעון
    if (t.inflow > 0 && !m.cov.partial && !st.spendOnly()) {
      const rate = t.net / t.inflow;
      if (rate >= 0.05) items.push({ id: 'save', score: 52, tone: 'good', icon: { name: 'wallet', color: 'var(--pos)' },
        title: 'נשאר לך ' + fmt.pct(rate) + ' מההכנסה', text: 'עודף של ' + fmt.money(t.net) + ' אחרי כל ההוצאות של ' + fmt.monthOnly(m.key) + '.',
        action: { type: 'month', key: m.key } });
      else if (t.net < 0) items.push({ id: 'deficit', score: 78, tone: 'bad', icon: { name: 'trendDown', color: 'var(--neg)' },
        title: 'יצא יותר משנכנס, בפער של ' + fmt.money(t.net), text: 'כדאי להציץ בקטגוריות שעלו החודש.',
        action: { type: 'month', key: m.key } });
    }

    // בתי עסק חדשים
    const first = P.dict();
    counted.forEach((x) => { if (x.amount >= 0) return; const k = P.learn.merchantKey(x.desc); if (!first[k] || x.date < first[k]) first[k] = x.date; });
    const bounds = st.dateBounds();
    if (bounds && bounds.first.slice(0, 7) < m.key) {
      const fresh = P.dict();
      m.expense.forEach((x) => { const k = P.learn.merchantKey(x.desc); if (first[k] && first[k].slice(0, 7) === m.key) { fresh[k] = fresh[k] || { sum: 0, tx: x }; fresh[k].sum -= x.amount; } });
      const top = Object.keys(fresh).map((k) => fresh[k]).filter((f) => f.sum >= Math.max(150, t.outflow * 0.015)).sort((a, b) => b.sum - a.sum)[0];
      if (top) items.push({ id: 'new', score: 46, tone: 'info', icon: { cat: top.tx.cat },
        title: 'בית עסק חדש: ' + top.tx.desc, text: fmt.money(top.sum) + ' החודש, בפעם הראשונה בנתונים שלך.',
        action: { type: 'merchant', key: P.learn.merchantKey(top.tx.desc) } });
    }

    // הוצאות קבועות
    const rec = P.learn.recurring(counted).filter((r) => r.active);
    if (rec.length >= 2) {
      const monthly = rec.reduce((a, r) => a + r.yearly / 12, 0);
      const ref = m.base.outflow || t.outflow;
      items.push({ id: 'recurring', score: 40, tone: 'info', icon: { name: 'repeat', color: 'var(--accent)' },
        title: 'הוצאות קבועות: כ-' + fmt.money(monthly) + ' בחודש',
        text: rec.length + ' חיובים שחוזרים בקביעות' + (ref ? ', בערך ' + fmt.pct(monthly / ref) + ' מההוצאה החודשית' : '') + '.',
        action: { type: 'recurring' } });
    }

    // ההוצאה הגדולה
    const big = m.expense.slice().sort((a, b) => a.amount - b.amount)[0];
    if (big) items.push({ id: 'big', score: 28, tone: 'info', icon: { cat: big.cat },
      title: 'ההוצאה הגדולה: ' + big.desc, text: fmt.money(big.amount) + ' ב-' + fmt.dayShort(big.date) + ', ' + big.cat + '.',
      action: { type: 'tx', id: big.id } });

    return items.sort((a, b) => b.score - a.score).slice(0, max || 4);
  }

  /* ---------- שנה ---------- */
  function year(y) {
    const list = st.filter({ year: y });
    const totals = st.totals(list);
    const months = st.months(y);
    const full = months.filter((mm) => !st.coverage(mm.key).partial);
    const ref = full.length ? full : months;
    const avg = ref.length ? ref.reduce((a, mm) => a + mm.outflow, 0) / ref.length : 0;
    const surplus = ref.filter((mm) => mm.net >= 0).length;
    const best = ref.slice().sort((a, b) => b.net - a.net)[0] || null;
    const worst = ref.slice().sort((a, b) => a.net - b.net)[0] || null;
    return { year: y, list: list, totals: totals, months: months, full: full, avg: avg, surplus: surplus, best: best, worst: worst };
  }

  /* ---------- משפטי מסקנה לגרפים ---------- */
  function flowTakeaway(months) {
    const ref = months.filter((mm) => !st.coverage(mm.key).partial);
    if (!ref.length) return '';
    if (st.spendOnly()) {
      const avg = ref.reduce((a, mm) => a + mm.outflow, 0) / ref.length;
      const hi = ref.slice().sort((a, b) => b.outflow - a.outflow)[0], lo = ref.slice().sort((a, b) => a.outflow - b.outflow)[0];
      let t = 'בממוצע יוצאים ' + fmt.money(avg) + ' בחודש.';
      if (ref.length > 1 && hi.key !== lo.key) t += ' החודש היקר ביותר: ' + fmt.monthOnly(hi.key) + ' (' + fmt.money(hi.outflow) + '). הזול ביותר: ' + fmt.monthOnly(lo.key) + ' (' + fmt.money(lo.outflow) + ').';
      return t;
    }
    const surplus = ref.filter((mm) => mm.net >= 0).length;
    const best = ref.slice().sort((a, b) => b.net - a.net)[0];
    const worst = ref.slice().sort((a, b) => a.net - b.net)[0];
    let s = 'ב-' + surplus + ' מתוך ' + ref.length + ' החודשים נשאר עודף.';
    if (best && best.net > 0) s += ' החודש הטוב ביותר: ' + fmt.monthOnly(best.key) + ' (' + fmt.signed(best.net) + ').';
    if (worst && worst.net < 0) s += ' המאתגר ביותר: ' + fmt.monthOnly(worst.key) + ' (' + fmt.signed(worst.net) + ').';
    return s;
  }
  function cumulativeTakeaway(months) {
    if (!months.length) return '';
    if (st.spendOnly()) {
      const out = months.reduce((a, mm) => a + mm.outflow, 0);
      return 'מתחילת התקופה יצאו ' + fmt.money(out) + ', ב-' + fmt.plural(months.length, 'חודש', 'חודשים', 'חודש אחד') + '.';
    }
    const total = months.reduce((a, mm) => a + mm.net, 0);
    return total >= 0 ? 'מתחילת התקופה הצטבר עודף של ' + fmt.money(total) + '.' : 'מתחילת התקופה הצטבר גירעון של ' + fmt.money(total) + '.';
  }
  function compositionTakeaway(cats) {
    const total = cats.reduce((a, c) => a + c.sum, 0);
    const real = cats.filter((c) => c.cat !== P.cats.OTHER);
    if (!real.length || !total) return '';
    let s = real[0].cat + ' לוקח ' + fmt.pct(real[0].sum / total) + ' מההוצאה.';
    if (real[1]) s += ' אחריו ' + real[1].cat + ' (' + fmt.pct(real[1].sum / total) + ')' + (real[2] ? ' ו' + real[2].cat + ' (' + fmt.pct(real[2].sum / total) + ')' : '') + '.';
    return s;
  }

  /** הוצאה יומיומית לפי יום בשבוע — בלי שכירות, חשבונות והעברות שמעוותות את התמונה */
  const NOT_EVERYDAY = ['דיור ושכירות', 'העברות ומזומן', 'חיובי אשראי', 'ביטוח ופיננסים', 'מיסים ואגרות', 'חשבונות ותשתיות'];
  function weekdays(list, from, to) {
    const sums = [0, 0, 0, 0, 0, 0, 0];
    const exp = list.filter((t) => t.amount < 0 && NOT_EVERYDAY.indexOf(t.cat) === -1);
    const sorted = exp.map((t) => -t.amount).sort((a, b) => a - b);
    const cap = sorted.length ? sorted[Math.floor(sorted.length * 0.98)] : Infinity;
    exp.forEach((t) => { if (-t.amount <= cap) sums[fmt.weekday(t.date)] += -t.amount; });
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const a = new Date(from), b = new Date(to);
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) counts[d.getDay()]++;
    return sums.map((s, i) => ({ day: i, total: s, avg: counts[i] ? s / counts[i] : 0 }));
  }
  function weekdayTakeaway(rows) {
    const valid = rows.filter((r) => r.avg > 0);
    if (valid.length < 3) return '';
    const top = valid.slice().sort((a, b) => b.avg - a.avg)[0];
    const avg = valid.reduce((s, r) => s + r.avg, 0) / valid.length;
    return 'יום ' + fmt.DAY_LONG[top.day] + ' הוא היום היקר: בממוצע ' + fmt.money(top.avg) + ', לעומת ' + fmt.money(avg) + ' ביום רגיל.';
  }

  /* ======================================================================
     הדמיות (ui/stories.js): העובדות שכל רצף מספר.
     כאן ולא בממשק — כדי שאפשר יהיה לבדוק אותן בלי דפדפן, ושמה שעל המסך יהיה בדיוק מה שבנתונים:
     הסכום שרץ הוא סכום העמודות שכבר צמחו, וכל פס הוא באורך האמיתי שלו.
     ====================================================================== */
  const pad2 = (n) => String(n).padStart(2, '0');

  /** סיפור של חודש: ההוצאה יום אחרי יום, לאן היא הלכה, שלושה רגעים, ומשפט שמסכם */
  function monthStory(key) {
    const m = month(key);
    const e = fmt.monthEdges(key);
    const days = new Array(e.days).fill(0), daily = new Array(e.days).fill(0), dailyCount = new Array(e.days).fill(0);
    m.expense.forEach((t) => {
      const d = +t.date.slice(8, 10) - 1;
      days[d] -= t.amount;
      // יום השיא נמדד בהוצאה יומיומית: יום השכירות הוא לא "יום יקר"
      if (NOT_EVERYDAY.indexOf(t.cat) === -1) { daily[d] -= t.amount; dailyCount[d]++; }
    });
    const t = m.totals;

    // השוואה: לחודש הקודם כשהוא מלא, אחרת לחודש רגיל — כמו המשפט שבסיכום
    let vs = null;
    if (!m.cov.partial) {
      const prevOk = m.prev && m.prev.outflow > 0 && !(m.prevCov && m.prevCov.partial);
      const ref = prevOk ? m.prev.outflow : m.base.months ? m.base.outflow : 0;
      if (ref > 0) {
        const d = (t.outflow - ref) / ref;
        const what = prevOk ? fmt.monthOnly(m.prevKey) : 'חודש רגיל';
        vs = { d: d, tone: Math.abs(d) < 0.03 ? 'flat' : d > 0 ? 'bad' : 'good',
          text: Math.abs(d) < 0.03 ? 'בערך כמו ' + fmt.prefix('ב', what) : (d > 0 ? '▲ ' : '▼ ') + fmt.pct(d) + ' לעומת ' + what };
      }
    }
    const spendDays = days.filter((v) => v > 0).length;
    const note = vs ? vs.text : m.cov.partial && m.cov.isLast ? 'הנתונים עד ' + fmt.dayWithMonth(m.cov.to)
      : fmt.plural(m.expense.length, 'הוצאה', 'הוצאות', 'הוצאה אחת') + ' ב-' + fmt.plural(spendDays, 'יום', 'ימים', 'יום אחד');

    // שלושה רגעים: ההוצאה הגדולה, המקום הקבוע, יום השיא — ובית עסק חדש כשאחד מהם חסר
    const moments = [];
    const big = m.expense.reduce((a, x) => (!a || x.amount < a.amount ? x : a), null);
    if (big) moments.push({ kind: 'big', label: 'ההוצאה הגדולה', cat: big.cat, title: big.desc, amount: -big.amount, sub: fmt.dayShort(big.date) + ' · ' + big.cat });
    const regular = st.byMerchant(m.expense).filter((g) => g.count >= 3).sort((a, b) => b.count - a.count || b.sum - a.sum)[0];
    if (regular) moments.push({ kind: 'regular', label: 'המקום הקבוע', cat: regular.cat, merchant: regular.label, title: regular.label, amount: regular.sum,
      sub: fmt.plural(regular.count, 'ביקור', 'ביקורים', 'ביקור אחד') + ' החודש' });
    let peak = -1;
    daily.forEach((v, i) => { if (v > 0 && (peak < 0 || v > daily[peak])) peak = i; });
    if (peak >= 0 && dailyCount[peak] > 1) moments.push({ kind: 'peak', label: 'יום השיא', icon: 'calendar', title: fmt.dayLong(key + '-' + pad2(peak + 1)), amount: daily[peak],
      sub: fmt.plural(dailyCount[peak], 'הוצאה', 'הוצאות', 'הוצאה אחת') + ' ביום אחד' });
    const bounds = st.dateBounds();
    if (moments.length < 3 && bounds && bounds.first.slice(0, 7) < key) {
      const first = P.dict();
      st.counted().forEach((x) => { if (x.amount < 0) { const k = P.learn.merchantKey(x.desc); if (!first[k] || x.date < first[k]) first[k] = x.date; } });
      const fresh = st.byMerchant(m.expense.filter((x) => (first[P.learn.merchantKey(x.desc)] || '').slice(0, 7) === key))[0];
      if (fresh && (!regular || fresh.key !== regular.key)) moments.push({ kind: 'new', label: 'חדש החודש', cat: fresh.cat, merchant: fresh.label, title: fresh.label, amount: fresh.sum, sub: 'בפעם הראשונה בנתונים שלך' });
    }

    return {
      key: key, total: t.outflow, count: m.expense.length, days: days, vs: vs, note: note, tone: vs ? vs.tone : 'flat',
      cats: m.cats.slice(0, 5).map((c) => Object.assign({ share: t.outflow ? c.sum / t.outflow : 0 }, c)),
      takeaway: compositionTakeaway(m.cats), moments: moments.slice(0, 3), lines: summary(m),
      partial: m.cov.partial, to: m.cov.to
    };
  }

  /**
   * השנה: עד 12 חודשים, מהישן לחדש. y = שנה קלנדרית ("2026"), או ריק — 12 החודשים האחרונים
   * (בלי חודש אחרון שיש בו פחות משבוע נתונים, כמו בסקירה).
   */
  function yearStory(y) {
    let list = st.months();                                      // מהחדש לישן
    if (y) list = list.filter((mm) => mm.key.slice(0, 4) === y);
    else if (list.length > 1) { const c = st.coverage(list[0].key); if (c.covered < 7 || c.ratio < 0.25) list = list.slice(1); }
    list = list.slice(0, 12).reverse();
    if (!list.length) return null;
    const months = list.map((mm) => ({ key: mm.key, outflow: mm.outflow, inflow: mm.inflow, net: mm.net, count: mm.count, partial: st.coverage(mm.key).partial }));
    const full = months.filter((mm) => !mm.partial);
    const ref = full.length ? full : months;
    const keys = new Set(months.map((mm) => mm.key));
    const exp = st.counted().filter((x) => x.amount < 0 && keys.has(x.date.slice(0, 7)));
    const only = st.spendOnly();
    const live = P.learn.recurring(st.counted()).filter((r) => r.active);
    return {
      year: y || null, months: months, from: months[0].key, to: months[months.length - 1].key,
      total: months.reduce((a, mm) => a + mm.outflow, 0),
      avg: ref.reduce((a, mm) => a + mm.outflow, 0) / ref.length,
      hi: ref.reduce((a, mm) => (mm.outflow > a.outflow ? mm : a), ref[0]),
      lo: ref.reduce((a, mm) => (mm.outflow < a.outflow ? mm : a), ref[0]),
      full: ref.length, surplus: only ? null : ref.filter((mm) => mm.net >= 0).length,
      cats: st.byCategory(exp), count: exp.length,
      fixed: live.reduce((a, r) => a + r.yearly / 12, 0), spendOnly: only
    };
  }

  /**
   * החיובים הקבועים, פרוסים על 12 החודשים הקרובים: מתי כל אחד צפוי לרדת, לפי הקצב שלו.
   * "הקרובים" מתחילים בחודש שאחרי סוף הנתונים — או בחודש האחרון עצמו, כשיש בו פחות משבוע נתונים
   * (דוח שהופק ב-01.10 עוד לא ראה את החיובים של אוקטובר). חיוב שהיה אמור לרדת לפני כן לא נספר פעמיים.
   * עד limit שורות; השאר מתקבצים לשורה אחת ("ועוד…").
   */
  function recurringYear(limit) {
    const live = P.learn.recurring(st.counted()).filter((r) => r.active).sort((a, b) => b.yearly - a.yearly);
    const b = st.dateBounds();
    if (live.length < 2 || !b) return null;
    const lastKey = b.last.slice(0, 7);
    const start = st.coverage(lastKey).covered < 7 ? lastKey : fmt.addMonths(lastKey, 1);
    const keys = [];
    for (let i = 0; i < 12; i++) keys.push(fmt.addMonths(start, i));
    const max = Math.max(2, limit || 6);
    const shown = live.length > max ? live.slice(0, max - 1) : live;
    const rest = live.slice(shown.length);
    const rows = shown.map((r) => ({ key: r.key, label: r.label, cat: r.cat, amount: r.amount, cadence: r.cadence, n: 1 }));
    if (rest.length) rows.push({ key: '', label: 'ועוד ' + fmt.plural(rest.length, 'חיוב', 'חיובים', 'חיוב אחד'), cat: null, rest: true,
      amount: rest.reduce((a, r) => a + r.amount, 0), cadence: '', n: rest.length });
    const cols = keys.map((k) => ({ key: k, parts: rows.map(() => 0), total: 0 }));
    const place = (r, row) => {
      const step = Math.max(1, Math.round(r.everyDays / 30.44));   // חודשי, דו-חודשי, רבעוני או שנתי — בחודשים שלמים
      for (let k = r.next.slice(0, 7); k <= keys[11]; k = fmt.addMonths(k, step)) {
        if (k < start) continue;
        const c = cols[keys.indexOf(k)];
        c.parts[row] += r.amount; c.total += r.amount;
      }
    };
    shown.forEach((r, i) => place(r, i));
    rest.forEach((r) => place(r, rows.length - 1));
    rows.forEach((row, i) => { row.year = cols.reduce((a, c) => a + c.parts[i], 0); });
    const total = cols.reduce((a, c) => a + c.total, 0);
    return { start: start, keys: keys, rows: rows, cols: cols, total: total, monthly: total / 12, count: live.length };
  }

  return { focusMonth, month, summary, cards, year, flowTakeaway, cumulativeTakeaway, compositionTakeaway, weekdays, weekdayTakeaway, NOT_EVERYDAY,
    monthStory, yearStory, recurringYear };
})();
