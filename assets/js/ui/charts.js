/* ==========================================================================
   ui/charts.js — גרפים ב-SVG, בלי ספריות.

   עקרונות:
   • כל גרף נמדד לפי רוחב המכל האמיתי ונבנה מחדש כשהוא משתנה.
   • הזמן זורם מימין לשמאל, כמו קריאה בעברית: הישן מימין, החדש משמאל.
     ציר הסכומים בצד ימין, בתחילת השורה.
   • סימנים דקים, פינה מעוגלת רק בקצה הנתון, רווח של 2px בין מילויים.
   • רשת וצירים חלשים; תוויות ישירות רק כשצריך; ריחוף על כל צורה,
     עם אזור מגע גבוה מהסימן עצמו.
   ========================================================================== */
window.P = window.P || {};

P.charts = (function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const el = P.kit.el;
  let uid = 0;

  /* ---------- יסודות ---------- */
  function svg(w, h, label) {
    const n = document.createElementNS(NS, 'svg');
    n.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    n.setAttribute('width', w);
    n.setAttribute('height', h);
    n.setAttribute('role', 'img');
    n.setAttribute('style', 'direction:ltr;display:block;overflow:visible');
    if (label) n.setAttribute('aria-label', label);
    return n;
  }
  function node(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  function text(parent, x, y, str, o) {
    const opt = o || {};
    const t = node('text', {
      x: x, y: y, fill: opt.fill || 'var(--ink-3)', 'font-size': opt.size || 11,
      'text-anchor': opt.anchor || 'middle', 'font-weight': opt.weight || null,
      direction: opt.rtl ? 'rtl' : null, 'unicode-bidi': opt.rtl ? 'embed' : null,
      style: 'font-variant-numeric:tabular-nums'
    });
    t.textContent = str;
    parent.appendChild(t);
    return t;
  }
  /** עמודה עם פינות מעוגלות רק בקצה העליון, מעוגנת לקו הבסיס */
  function barPath(x, y, w, h, r) {
    if (h <= 0) return '';
    r = Math.max(0, Math.min(r, w / 2, h));
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) +
      'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + -r + 'h' + (w - 2 * r) +
      'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'V' + (y + h) + 'Z';
  }
  /** צעד "עגול" לציר: 1, 2, 2.5, 5 כפול חזקת 10 */
  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  /** סולם עם קווי רשת בערכים עגולים בלבד (0, 5K, 10K…) */
  function scale(maxVal, minVal, count) {
    const lo0 = Math.min(0, minVal || 0);
    const hi0 = Math.max(maxVal || 0, lo0 + 1);
    const step = niceStep((hi0 - lo0) / (count || 4));
    const lo = Math.floor(lo0 / step) * step;
    const hi = Math.max(step, Math.ceil(hi0 / step) * step);
    const ticks = [];
    for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { lo: lo, hi: hi, ticks: ticks };
  }
  function niceMax(v) { return scale(v, 0, 4).hi; }
  function axisLabel(v) { return P.fmt.moneyShort(v); }

  /**
   * מכל רספונסיבי: בונה את הגרף לפי הרוחב בפועל, ובונה מחדש כשהרוחב משתנה.
   * build(width) מחזיר Node.
   */
  function frame(build, opts) {
    const o = opts || {};
    const holder = el('div.chart__frame');
    let lastW = 0;
    function draw(w) {
      w = Math.floor(w);
      if (!w || Math.abs(w - lastW) < 2) return;
      lastW = w;
      holder.innerHTML = '';
      holder.appendChild(build(w));
    }
    if (typeof ResizeObserver === 'function') {
      let raf = 0;
      const ro = new ResizeObserver((entries) => {
        if (!holder.isConnected && lastW) { ro.disconnect(); return; }   // העמוד הוחלף
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => draw(entries[0].contentRect.width));
      });
      ro.observe(holder);
    } else {
      draw(o.fallback || 640);
    }
    return holder;
  }

  function wrap(cls, children) {
    return el('div.chart' + (cls ? '.' + cls : ''), null, (children || []).filter(Boolean));
  }
  function legend(items) {
    return el('div.legend', null, items.map((it) => el('span', null, [
      el('i', { style: 'background:' + it.color + (it.dashed ? ';height:2px;border-radius:0' : '') }), it.label
    ])));
  }
  function empty(msg) { return el('div.empty', { text: msg || 'אין נתונים להצגה' }); }

  /**
   * תוויות ציר הזמן לא עולות זו על זו: כשהעמודות צפופות (טלפון), מסמנים רק כל עמודה שנייה או שלישית.
   * סופרים מהחודש האחרון, כך שהוא תמיד מסומן.
   */
  const labelEvery = (step) => Math.max(1, Math.ceil(50 / Math.max(1, step)));
  const showLabel = (i, n, every) => (n - 1 - i) % every === 0;

  /** פס ריחוף שקוף לכל עמודת זמן — מטרה גדולה מהסימן */
  function hitband(parent, x, w, top, h, html, onClick) {
    const band = node('rect', { x: x, y: top, width: w, height: h, fill: 'var(--ink)', opacity: 0, class: 'hit' });
    band.addEventListener('mouseenter', () => band.setAttribute('opacity', '0.035'));
    band.addEventListener('mouseleave', () => band.setAttribute('opacity', '0'));
    P.kit.bindTip(band, html);
    if (onClick) { band.style.cursor = 'pointer'; band.addEventListener('click', onClick); }
    parent.appendChild(band);
    return band;
  }

  function grid(s, W, PL, PR, PT, plot, sc) {
    sc.ticks.forEach((v) => {
      const y = PT + plot - plot * ((v - sc.lo) / (sc.hi - sc.lo));
      s.appendChild(node('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: v === 0 ? 'var(--rule-strong)' : 'var(--rule-soft)', 'stroke-width': 1 }));
      text(s, W - PR + 10, y + 4, (v < 0 ? '−' : '') + axisLabel(Math.abs(v)), { anchor: 'start', size: 10.5 });
    });
  }

  /* ======================================================================
     עמודות חודשיות: יצא מול נכנס
     ====================================================================== */
  function monthBars(months, opts) {
    const o = opts || {};
    const data = months.slice().reverse();                  // ישן -> חדש
    if (!data.length) return wrap('', empty());
    const H = o.height || 240;

    const chart = frame((W) => {
      const PT = 14, PB = 30, PL = 6, PR = 52;
      const plot = H - PT - PB;
      const n = data.length;
      const step = (W - PL - PR) / n;
      const sc = scale(Math.max(...data.map((m) => (o.spendOnly ? m.outflow : Math.max(m.outflow, m.inflow)))), 0, 4);
      const max = sc.hi;
      const bw = Math.max(5, Math.min(22, step * 0.28));
      const s = svg(W, H, 'יצא ונכנס לפי חודש');
      grid(s, W, PL, PR, PT, plot, sc);

      data.forEach((m, i) => {
        const xc = W - PR - (i + 0.5) * step;               // הישן מימין
        const ho = plot * (m.outflow / max), hi = plot * (m.inflow / max);
        if (o.highlight === m.key) s.insertBefore(node('rect', { x: xc - step / 2 + 3, y: PT - 6, width: step - 6, height: plot + 6, rx: 10, fill: 'var(--accent-soft)' }), s.firstChild);
        const dim = o.highlight && o.highlight !== m.key ? .55 : 1;
        if (o.spendOnly) {
          // נתוני הוצאות בלבד (פירוט כרטיס): עמודה אחת לחודש, בלי "נכנס" ובלי "מאזן"
          const w1 = Math.min(34, bw * 1.5);
          s.appendChild(node('path', { d: barPath(xc - w1 / 2, PT + plot - ho, w1, ho, 5), fill: 'var(--spend)', class: 'bar-mark', opacity: dim }));
        } else {
          s.appendChild(node('path', { d: barPath(xc + 1, PT + plot - ho, bw, ho, 4), fill: 'var(--spend)', class: 'bar-mark', opacity: dim }));
          s.appendChild(node('path', { d: barPath(xc - bw - 1, PT + plot - hi, bw, hi, 4), fill: 'var(--pos)', class: 'bar-mark', opacity: dim }));
        }
        if (showLabel(i, n, labelEvery(step))) text(s, xc, H - 10, P.fmt.monthShort(m.key), { rtl: true });
        hitband(s, xc - step / 2, step, PT, plot, () =>
          '<b>' + P.fmt.monthName(m.key) + '</b>' +
          'יצא <span class="fig">' + P.fmt.money(m.outflow) + '</span>' + (o.spendOnly ? ' · ' + m.count + ' תנועות' : '<br>' +
          'נכנס <span class="fig">' + P.fmt.money(m.inflow) + '</span><br>' +
          'מאזן <span class="fig">' + P.fmt.signed(m.net) + '</span>'),
          o.onPick ? () => o.onPick(m.key) : null);
      });
      return s;
    }, { fallback: 900 });

    return wrap('chart--enter', [chart, o.legend === false || o.spendOnly ? null : legend([{ label: 'יצא', color: 'var(--spend)' }, { label: 'נכנס', color: 'var(--pos)' }])]);
  }

  /* ======================================================================
     עמודות של סדרה אחת לאורך חודשים (למשל קטגוריה)
     ====================================================================== */
  function seriesBars(points, opts) {
    const o = opts || {};
    const data = points.slice();                             // [{key,value}] ישן -> חדש
    if (!data.length) return wrap('', empty());
    const H = o.height || 190, color = o.color || 'var(--spend)';

    const chart = frame((W) => {
      const PT = 12, PB = 30, PL = 6, PR = 52;
      const plot = H - PT - PB;
      const step = (W - PL - PR) / data.length;
      const sc = scale(Math.max(...data.map((d) => d.value)), 0, 4);
      const max = sc.hi;
      const bw = Math.max(6, Math.min(30, step * 0.5));
      const avg = data.reduce((a, d) => a + d.value, 0) / data.length;
      const s = svg(W, H, o.label || 'מגמה חודשית');
      grid(s, W, PL, PR, PT, plot, sc);

      data.forEach((d, i) => {
        const xc = W - PR - (i + 0.5) * step;
        const h = plot * (d.value / max);
        if (o.highlight === d.key) s.insertBefore(node('rect', { x: xc - step / 2 + 3, y: PT - 6, width: step - 6, height: plot + 6, rx: 10, fill: 'var(--accent-soft)' }), s.firstChild);
        const dim = o.highlight && o.highlight !== d.key ? .45 : 1;
        s.appendChild(node('path', { d: barPath(xc - bw / 2, PT + plot - h, bw, h, 4), fill: color, class: 'bar-mark', opacity: dim }));
        if (showLabel(i, data.length, labelEvery(step))) text(s, xc, H - 10, P.fmt.monthShort(d.key), { rtl: true });
        hitband(s, xc - step / 2, step, PT, plot, () =>
          '<b>' + P.fmt.monthName(d.key) + '</b><span class="fig">' + P.fmt.money(d.value) + '</span>' +
          (d.count ? ' · ' + d.count + ' תנועות' : ''), o.onPick ? () => o.onPick(d.key) : null);
      });
      // קו ממוצע עם תווית ישירה
      const ya = PT + plot - plot * (avg / max);
      s.appendChild(node('line', { x1: PL, y1: ya, x2: W - PR, y2: ya, stroke: 'var(--ink-3)', 'stroke-dasharray': '4 4', 'stroke-width': 1 }));
      // טקסט עברי שמעוגן משמאל: end = הקצה השמאלי של טקסט מימין לשמאל, כך שהוא נשאר בתוך הגרף
      text(s, PL + 2, ya - 6, 'ממוצע ' + P.fmt.money(avg), { anchor: 'end', size: 10.5, fill: 'var(--ink-2)', rtl: true });
      return s;
    }, { fallback: 700 });
    return wrap('chart--enter', [chart]);
  }

  /* ======================================================================
     קו: מגמה רציפה, עם קו עזר אנכי בריחוף
     ====================================================================== */
  function lineChart(series, opts) {
    const o = opts || {};
    const labels = o.labels || [];
    const live = series.filter((s) => s.values && s.values.length);
    if (!live.length || labels.length < 2) return wrap('', empty('אין מספיק נתונים לגרף'));
    const H = o.height || 220;

    const chart = frame((W) => {
      const PT = 16, PB = 30, PL = 8, PR = 56;
      const plot = H - PT - PB;
      const n = labels.length;
      const all = live.reduce((a, s) => a.concat(s.values.filter((v) => v != null)), []);
      const sc = scale(Math.max(...all), Math.min(0, ...all), 4);
      const max = sc.hi, min = sc.lo;
      const step = (W - PL - PR) / Math.max(1, n - 1);
      const x = (i) => W - PR - i * step;
      const y = (v) => PT + plot - plot * ((v - min) / (max - min || 1));
      const s = svg(W, H, o.label || 'מגמה');
      grid(s, W, PL, PR, PT, plot, sc);
      live.forEach((ser) => {
        const pts = ser.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
        const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        if (ser.area && pts.length > 1) {
          s.appendChild(node('path', { d: d + ' L' + pts[pts.length - 1][0] + ' ' + y(Math.max(0, min)) + ' L' + pts[0][0] + ' ' + y(Math.max(0, min)) + ' Z', fill: ser.color, class: 'line-fill', style: '--o:.08' }));
        }
        // קו רציף מצויר בהנפשה (pathLength=1 מאפשר זאת בלי למדוד את אורכו); קו מקווקו נשאר כמו שהוא
        s.appendChild(node('path', { d: d, fill: 'none', stroke: ser.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
          'stroke-dasharray': ser.dashed ? '5 5' : null, pathLength: ser.dashed ? null : 1, class: ser.dashed ? null : 'line-mark' }));
        if (ser.dots !== false) pts.forEach((p, pi) => s.appendChild(node('circle', { cx: p[0], cy: p[1], r: 3.2, fill: 'var(--surface)', stroke: ser.color, 'stroke-width': 2, class: 'line-dot', style: '--i:' + pi })));
      });
      const every = labelEvery(step);
      labels.forEach((l, i) => { if (showLabel(i, n, every)) text(s, x(i), H - 10, l, { rtl: true }); });

      // קו עזר וריחוף לכל נקודת זמן
      const guide = node('line', { x1: 0, x2: 0, y1: PT, y2: PT + plot, stroke: 'var(--ink-3)', 'stroke-width': 1, opacity: 0, 'stroke-dasharray': '2 3' });
      s.appendChild(guide);
      labels.forEach((l, i) => {
        const band = node('rect', { x: x(i) - step / 2, y: PT, width: Math.max(step, 8), height: plot, fill: 'transparent', style: o.onPick ? 'cursor:pointer' : '' });
        band.addEventListener('mouseenter', () => { guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('opacity', 1); });
        band.addEventListener('mouseleave', () => guide.setAttribute('opacity', 0));
        P.kit.bindTip(band, () => '<b>' + P.fmt.esc(o.tipLabels ? o.tipLabels[i] : l) + '</b>' + live.map((ser) =>
          ser.values[i] == null ? '' : P.fmt.esc(ser.name) + ' <span class="fig">' + P.fmt.money(ser.values[i]) + '</span>').filter(Boolean).join('<br>'));
        if (o.onPick) band.addEventListener('click', () => o.onPick(i));
        s.appendChild(band);
      });
      return s;
    }, { fallback: 700 });

    const parts = [chart];
    if (live.length > 1) parts.push(legend(live.map((s) => ({ label: s.name, color: s.color, dashed: s.dashed }))));
    return wrap('', parts);
  }

  /* ======================================================================
     קצב החודש: הוצאה מצטברת לפי יום, מול חודש טיפוסי
     ====================================================================== */
  function pace(monthKey, all, opts) {
    const o = opts || {};
    const cum = (key) => {
      const e = P.fmt.monthEdges(key);
      const daily = new Array(e.days).fill(0);
      all.forEach((t) => { if (t.amount < 0 && t.date.slice(0, 7) === key) daily[+t.date.slice(8, 10) - 1] += -t.amount; });
      let acc = 0;
      return daily.map((v) => (acc += v));
    };
    const cur = cum(monthKey);
    const lastDay = all.filter((t) => t.date.slice(0, 7) === monthKey).reduce((m, t) => Math.max(m, +t.date.slice(8, 10)), 0);
    const prevKeys = [];
    for (let i = 1; i <= 6; i++) {
      const k = P.fmt.addMonths(monthKey, -i);
      if (all.some((t) => t.date.slice(0, 7) === k)) prevKeys.push(k);
    }
    const days = cur.length;
    const base = new Array(days).fill(0);
    if (prevKeys.length) {
      prevKeys.forEach((k) => {
        const c = cum(k);
        for (let d = 0; d < days; d++) base[d] += c[Math.min(d, c.length - 1)] / prevKeys.length;
      });
    }
    const curVals = cur.map((v, i) => (i < lastDay ? v : null));
    const series = [{ name: P.fmt.monthName(monthKey), values: curVals, color: 'var(--spend)', area: true, dots: false }];
    if (prevKeys.length) series.push({ name: 'חודש טיפוסי (' + prevKeys.length + ' קודמים)', values: base, color: 'var(--ink-3)', dashed: true, dots: false });
    const labels = cur.map((_, i) => String(i + 1));
    const tips = cur.map((_, i) => (i + 1) + ' ב' + P.fmt.monthOnly(monthKey));

    const summary = (() => {
      if (!prevKeys.length || !lastDay) return null;
      const now = cur[lastDay - 1], usual = base[lastDay - 1];
      if (!usual) return null;
      const diff = (now - usual) / usual;
      return { now: now, usual: usual, diff: diff, day: lastDay };
    })();
    const node_ = lineChart(series, { labels: labels, tipLabels: tips, height: o.height || 220, label: 'קצב ההוצאה בחודש' });
    node_.summary = summary;
    return node_;
  }

  /* ======================================================================
     עמודות מוערמות: הרכב ההוצאה בכל חודש
     ====================================================================== */
  function stacked(monthKeys, cats, matrix, opts) {
    const o = opts || {};
    const order = monthKeys.slice().reverse();               // ישן -> חדש
    if (!order.length) return wrap('', empty());
    const H = o.height || 260;

    const chart = frame((W) => {
      const PT = 12, PB = 30, PL = 6, PR = 52;
      const plot = H - PT - PB;
      const step = (W - PL - PR) / order.length;
      const totals = order.map((k) => cats.reduce((a, c) => a + (matrix[c.cat][k] || 0), 0));
      const sc = scale(Math.max(...totals), 0, 4);
      const max = sc.hi;
      const bw = Math.max(8, Math.min(34, step * 0.56));
      const s = svg(W, H, 'הרכב ההוצאה לפי חודש');
      grid(s, W, PL, PR, PT, plot, sc);

      order.forEach((k, i) => {
        const xc = W - PR - (i + 0.5) * step;
        let acc = 0;
        const segs = [];
        cats.forEach((c) => {
          const v = matrix[c.cat][k] || 0;
          if (!v) return;
          const h = plot * (v / max);
          const yTop = PT + plot - plot * ((acc + v) / max);
          s.appendChild(node('rect', { x: xc - bw / 2, y: yTop, width: bw, height: Math.max(h - 2, 0.5), rx: 2, fill: c.color, class: 'bar-mark' }));
          segs.push([c, v]);
          acc += v;
        });
        if (showLabel(i, order.length, labelEvery(step))) text(s, xc, H - 10, P.fmt.monthShort(k), { rtl: true });
        hitband(s, xc - step / 2, step, PT, plot, () =>
          '<b>' + P.fmt.monthName(k) + ' · <span class="fig">' + P.fmt.money(acc) + '</span></b>' +
          segs.slice().reverse().map(([c, v]) => '<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + c.color + ';margin-inline-end:6px"></i>' +
            P.fmt.esc(c.cat) + ' <span class="fig">' + P.fmt.money(v) + '</span>').join('<br>'),
          o.onPick ? () => o.onPick(k) : null);
      });
      return s;
    }, { fallback: 900 });

    return wrap('chart--enter', [chart, legend(cats.map((c) => ({ label: c.cat, color: c.color })))]);
  }

  /* ======================================================================
     מפת חום: הוצאה בכל יום, שבוע לכל עמודה
     ====================================================================== */
  const RAMP = [0, 1, 2, 3, 4, 5].map((i) => 'var(--heat-' + i + ')');   // מוגדר ב-tokens.css, נפרד לבהיר ולכהה
  function heatmap(list, opts) {
    const o = opts || {};
    const byDay = {};
    list.forEach((t) => { if (t.amount < 0) byDay[t.date] = (byDay[t.date] || 0) + -t.amount; });
    const keys = Object.keys(byDay).sort();
    if (!keys.length) return wrap('', empty('אין הוצאות בטווח'));

    const start = new Date(o.from || keys[0]);
    const end = new Date(o.to || keys[keys.length - 1]);
    start.setDate(start.getDate() - start.getDay());          // מתחילים ביום ראשון
    const cells = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = P.parse.isoDate(d);
      cells.push({ iso: iso, dow: d.getDay(), day: d.getDate(), month: d.getMonth(), v: byDay[iso] || 0 });
    }
    const vals = cells.map((c) => c.v).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))] || 0;
    const stops = [q(0.2), q(0.4), q(0.6), q(0.78), q(0.92)];
    const level = (v) => { if (!v) return -1; for (let i = 0; i < stops.length; i++) if (v <= stops[i]) return i; return 5; };
    const weeks = Math.ceil(cells.length / 7);

    const chart = frame((W) => {
      const PR = 22, PT = 20, gap = 3;
      const cell = Math.max(7, Math.min(18, Math.floor((W - PR - 4) / weeks) - gap));
      const H = PT + 7 * (cell + gap);
      const usedW = weeks * (cell + gap) + PR;
      const s = svg(Math.max(W, usedW), H, 'מפת חום של הוצאה יומית');
      const right = Math.max(W, usedW) - PR;
      ['א', 'ג', 'ה', 'ש'].forEach((d, i) => text(s, right + 8, PT + (i * 2) * (cell + gap) + cell - 2, d, { anchor: 'start', size: 10 }));
      let lastMonth = -1;
      cells.forEach((c, i) => {
        const week = Math.floor(i / 7);
        const x = right - (week + 1) * (cell + gap);
        if (c.dow === 0 && c.month !== lastMonth && c.day <= 7) {
          text(s, x + cell, 11, P.fmt.MONTH_SHORT[c.month], { anchor: 'end', size: 10, rtl: true });
          lastMonth = c.month;
        }
        const lv = level(c.v);
        const r = node('rect', { x: x, y: PT + c.dow * (cell + gap), width: cell, height: cell, rx: Math.min(3, cell / 4), fill: lv < 0 ? 'var(--surface-3)' : RAMP[lv] });
        if (c.v) {
          P.kit.bindTip(r, () => '<b>' + P.fmt.day(c.iso) + '</b><span class="fig">' + P.fmt.money(c.v) + '</span>');
          if (o.onPick) { r.style.cursor = 'pointer'; r.addEventListener('click', () => o.onPick(c.iso)); }
        }
        s.appendChild(r);
      });
      const box = el('div', { style: 'overflow-x:auto' }, s);
      return box;
    }, { fallback: 900 });

    return wrap('', [chart, el('div.legend.legend--ramp', null, [
      el('span', { text: 'פחות' }),
      el('span.ramp', null, RAMP.map((c) => el('i', { style: 'background:' + c }))),
      el('span', { text: 'יותר' })
    ])]);
  }

  /* ======================================================================
     הוצאה יומית בתוך חודש
     ====================================================================== */
  function dayBars(monthKey, list, opts) {
    const o = opts || {};
    const edges = P.fmt.monthEdges(monthKey);
    const byDay = new Array(edges.days).fill(0), cnt = new Array(edges.days).fill(0);
    list.forEach((t) => { if (t.amount < 0) { const d = +t.date.slice(8, 10) - 1; byDay[d] += -t.amount; cnt[d]++; } });
    const H = o.height || 170;

    const chart = frame((W) => {
      const PT = 12, PB = 24, PL = 4, PR = 52;
      const plot = H - PT - PB;
      const step = (W - PL - PR) / edges.days;
      const sc = scale(Math.max(1, ...byDay), 0, 3);
      const max = sc.hi;
      const bw = Math.max(3, Math.min(16, step * 0.62));
      const s = svg(W, H, 'הוצאה יומית בחודש');
      grid(s, W, PL, PR, PT, plot, sc);
      for (let d = 0; d < edges.days; d++) {
        const xc = W - PR - (d + 0.5) * step;                 // יום 1 מימין
        const h = plot * (byDay[d] / max);
        if (byDay[d] > 0) s.appendChild(node('path', { d: barPath(xc - bw / 2, PT + plot - Math.max(h, 2), bw, Math.max(h, 2), 3), fill: 'var(--spend)', class: 'bar-mark' }));
        if (d === 0 || (d + 1) % 5 === 0) text(s, xc, H - 7, String(d + 1), { size: 10 });
        if (byDay[d] > 0) hitband(s, xc - step / 2, step, PT, plot, () =>
          '<b>' + (d + 1) + ' ב' + P.fmt.monthOnly(monthKey) + '</b><span class="fig">' + P.fmt.money(byDay[d]) + '</span> · ' + cnt[d] + ' תנועות',
          o.onPick ? () => o.onPick(d + 1) : null);
      }
      return s;
    }, { fallback: 700 });

    const parts = [chart];
    if (o.caption) parts.push(el('figcaption', { text: o.caption }));
    return wrap('chart--enter', parts);
  }

  /* ======================================================================
     טבעת קטגוריות
     ====================================================================== */
  function arcPath(cx, cy, r, a0, a1) {
    if (a1 - a0 >= Math.PI * 1.999) a1 = a0 + Math.PI * 1.999;
    const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const s = p(a0), e = p(a1);
    return 'M' + s[0].toFixed(2) + ' ' + s[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + e[0].toFixed(2) + ' ' + e[1].toFixed(2);
  }
  function donut(rows, opts) {
    const o = opts || {};
    const size = o.size || 200, thick = 22, r = (size - thick) / 2 - 1;
    const total = rows.reduce((a, d) => a + d.sum, 0);
    if (!total) return wrap('', empty('אין תנועות בטווח הזה'));

    const s = svg(size, size, 'פילוח לפי קטגוריה');
    s.style.overflow = 'visible';
    const hatchId = 'hatch' + (++uid);
    const defs = node('defs', {});
    const pat = node('pattern', { id: hatchId, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.appendChild(node('rect', { width: 6, height: 6, fill: 'var(--mark-soft)' }));
    pat.appendChild(node('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--mark)', 'stroke-width': 3 }));
    defs.appendChild(pat);
    s.appendChild(defs);

    const cx = size / 2, cy = size / 2;
    const gap = rows.length > 1 ? 0.022 : 0;
    let a = -Math.PI / 2;
    rows.forEach((d) => {
      const frac = d.sum / total;
      const span = frac * Math.PI * 2;
      const p = node('path', {
        d: arcPath(cx, cy, r, a + gap / 2, a + Math.max(span - gap / 2, 0.004)),
        stroke: d.cat === P.cats.OTHER ? 'url(#' + hatchId + ')' : d.color,
        'stroke-width': thick, fill: 'none', class: 'arc-mark', tabindex: '0',
        style: 'cursor:pointer;outline:none',
        'aria-label': d.cat + ': ' + P.fmt.money(d.sum) + ', ' + P.fmt.pct(frac)
      });
      p.addEventListener('mouseenter', () => p.setAttribute('stroke-width', thick + 5));
      p.addEventListener('mouseleave', () => p.setAttribute('stroke-width', thick));
      P.kit.bindTip(p, () => '<b>' + P.fmt.esc(d.cat) + '</b><span class="fig">' + P.fmt.money(d.sum) + '</span> · ' + P.fmt.pct(frac) + ' · ' + d.count + ' תנועות');
      if (o.onPick) p.addEventListener('click', () => o.onPick(d.cat));
      s.appendChild(p);
      a += span;
    });

    const center = el('div.donut__center', null, [
      el('div.fig.donut__fig', { text: P.fmt.money(total) }),
      el('div.donut__cap', { text: o.caption || (rows.length + ' קטגוריות') })
    ]);
    return wrap('chart--enter', [el('div.donut', { style: 'width:' + size + 'px;height:' + size + 'px' }, [s, center])]);
  }

  /* ======================================================================
     עמודות אופקיות: דירוג
     ====================================================================== */
  function hbar(rows, opts) {
    const o = opts || {};
    if (!rows.length) return wrap('', empty());
    const max = Math.max(...rows.map((r) => r.value), 1);
    const list = el('div.hbar');
    rows.forEach((r, i) => {
      const row = el('div.hbar__row', { role: o.onPick ? 'button' : null, tabindex: o.onPick ? '0' : null }, [
        el('span.hbar__rank', { text: String(i + 1) }),
        el('div.hbar__main', null, [
          el('div.hbar__label', { text: r.label }),
          el('div.hbar__track', null, el('i', { style: 'width:' + Math.max(1.5, (r.value / max) * 100) + '%;background:' + (r.color || 'var(--spend)') })),
          r.sub ? el('div.hbar__sub', { text: r.sub }) : null
        ].filter(Boolean)),
        el('span.hbar__val.fig', { text: P.fmt.money(r.value) })
      ]);
      if (o.onPick) row.addEventListener('click', () => o.onPick(r));
      list.appendChild(row);
    });
    return wrap('', [list]);
  }


  /* ======================================================================
     ימים בשבוע: ממוצע הוצאה יומיומית לכל יום, היום היקר מודגש
     ====================================================================== */
  function weekdayBars(rows, opts) {
    const o = opts || {};
    if (!rows.some((r) => r.avg > 0)) return wrap('', empty('אין מספיק נתונים'));
    const H = o.height || 210;
    const top = rows.reduce((m, r) => (r.avg > m.avg ? r : m), rows[0]);
    const chart = frame((W) => {
      const PT = 22, PB = 30, PL = 6, PR = 52;
      const plot = H - PT - PB;
      const step = (W - PL - PR) / 7;
      const sc = scale(Math.max(...rows.map((r) => r.avg)), 0, 3);
      const bw = Math.max(14, Math.min(46, step * 0.56));
      const s = svg(W, H, 'הוצאה ממוצעת לפי יום בשבוע');
      grid(s, W, PL, PR, PT, plot, sc);
      rows.forEach((r, i) => {
        const xc = W - PR - (i + 0.5) * step;              // ראשון מימין
        const h = plot * (r.avg / sc.hi);
        const isTop = r === top;
        s.appendChild(node('path', { d: barPath(xc - bw / 2, PT + plot - h, bw, h, 6), fill: isTop ? 'var(--accent)' : 'var(--spend)', opacity: isTop ? 1 : .55, class: 'bar-mark' }));
        text(s, xc, H - 9, P.fmt.DAY_SHORT[r.day], { size: 12, fill: isTop ? 'var(--ink)' : 'var(--ink-3)', weight: isTop ? 700 : null });
        if (isTop) text(s, xc, PT + plot - h - 7, P.fmt.money(r.avg), { size: 11.5, fill: 'var(--ink)', weight: 700 });
        hitband(s, xc - step / 2, step, PT, plot, () => '<b>יום ' + P.fmt.DAY_LONG[r.day] + '</b>בממוצע <span class="fig">' + P.fmt.money(r.avg) + '</span>');
      });
      return s;
    }, { fallback: 600 });
    return wrap('chart--enter', [chart]);
  }

  /* ======================================================================
     קו זעיר בלי צירים — לכרטיסי קטגוריות
     ====================================================================== */
  function sparkline(values, color, w, h) {
    const W = w || 96, H = h || 34;
    const s = svg(W, H, null);
    s.setAttribute('aria-hidden', 'true');
    const vals = values.length > 1 ? values : [values[0] || 0, values[0] || 0];
    const max = Math.max(...vals, 1);
    const x = (i) => W - 2 - (i * (W - 4)) / (vals.length - 1);   // ישן מימין
    const y = (v) => H - 3 - (v / max) * (H - 8);
    const d = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    s.appendChild(node('path', { d: d + ' L' + x(vals.length - 1) + ' ' + H + ' L' + x(0) + ' ' + H + ' Z', fill: color, opacity: .12 }));
    s.appendChild(node('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    s.appendChild(node('circle', { cx: x(vals.length - 1), cy: y(vals[vals.length - 1]), r: 3, fill: color }));
    return s;
  }

  /* ======================================================================
     פס הרכב: פס אחד מחולק לפי קטגוריות, עם מקרא
     ====================================================================== */
  function composition(rows, opts) {
    const o = opts || {};
    const total = rows.reduce((a, r) => a + r.sum, 0);
    if (!total) return el('div');
    const bar = el('div.compbar' + (o.large ? '.compbar--lg' : '') + '.grow-x', { role: 'img', 'aria-label': 'חלוקה לפי קטגוריה' });
    rows.forEach((r) => {
      const seg = el('i' + (r.cat === P.cats.OTHER ? '.is-pending' : ''), { vars: { '--c': r.color }, style: 'flex-grow:' + (r.sum / total).toFixed(5) });
      P.kit.bindTip(seg, () => '<b>' + P.fmt.esc(r.cat) + '</b><span class="fig">' + P.fmt.money(r.sum) + '</span> · ' + P.fmt.pct(r.sum / total));
      if (o.onPick && !r.isRest) { seg.style.cursor = 'pointer'; seg.addEventListener('click', () => o.onPick(r.cat)); }
      bar.appendChild(seg);
    });
    const out = el('div', null, [bar]);
    if (o.legend !== false) {
      out.appendChild(el('div.complegend', null, rows.slice(0, o.legendMax || 5).map((r) =>
        el('span', { vars: { '--c': r.color } }, [el('i' + (r.cat === P.cats.OTHER ? '.is-pending' : '')), r.cat, el('b', { text: P.fmt.pct(r.sum / total) })]))));
    }
    return out;
  }

  return { donut, monthBars, seriesBars, lineChart, pace, stacked, heatmap, dayBars, hbar, weekdayBars, sparkline, composition, barPath, niceMax, scale, frame };
})();
