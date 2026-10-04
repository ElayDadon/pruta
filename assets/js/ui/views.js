/* ==========================================================================
   ui/views.js — החלונות שנפתחים מכל מקום באפליקציה
   ---------------------------------------------------------------------------
   חודש · קטגוריה · בית עסק · תנועה · הוצאות קבועות · סיכום ייבוא
   כל חלון מתעדכן לבד כשהנתונים משתנים, ונפתח מעל העמוד בלי לאבד את המקום.
   ========================================================================== */
window.P = window.P || {};

P.views = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons, art = P.art;

  /* ======================================================================
     חלקים משותפים
     ====================================================================== */
  function stat(label, value, opts) {
    const o = opts || {};
    return el('div.stat', null, [
      el('div.stat__label', { text: label }),
      el('span.stat__value.fig' + (o.tone ? '.' + o.tone : ''), { text: value }),
      o.sub ? el('div.stat__sub', null, o.sub) : null
    ]);
  }
  /** תג שינוי: עלייה בהוצאה מסומנת באדום, ירידה בירוק */
  function deltaChip(now, before, opts) {
    const o = opts || {};
    if (!before || !isFinite(now)) return null;
    const d = (now - before) / before;
    if (!isFinite(d)) return null;
    if (Math.abs(d) < 0.03) return el('span.delta.delta--flat', { text: 'ללא שינוי' });
    const bad = o.higherIsGood ? d < 0 : d > 0;
    return el('span.delta.' + (bad ? 'delta--bad' : 'delta--good'), { title: o.title || null, text: (d > 0 ? '▲ ' : '▼ ') + fmt.pct(d) });
  }
  /** שורת קטגוריה: איור, שם, פס יחסי, סכום ושינוי */
  function catRow(c, max, opts) {
    const o = opts || {};
    const tint = c.tint || c.color;
    const r = el('button.lrow' + (c.cat === P.cats.OTHER ? '.is-pending' : ''), { type: 'button', vars: { '--c': tint }, onclick: o.onClick || (() => category(c.cat, { month: o.month })) }, [
      c.isRest ? el('span.ctile', { vars: { '--c': tint } }, ic.svg('more', 18)) : art.tile(c.cat, 40, tint),
      el('div.lrow__main', null, [
        el('div.lrow__title', null, [el('span', { text: c.cat }), o.showDelta && c.delta != null && c.avg ? deltaChip(c.sum, c.avg, { title: 'לעומת הממוצע' }) : null]),
        el('div.lrow__bar', null, el('i', { style: 'width:' + Math.max(2, (c.sum / max) * 100).toFixed(1) + '%' }))
      ]),
      el('div.lrow__aside', null, [
        el('div.lrow__value.fig', { text: fmt.money(c.sum) }),
        el('div.lrow__sub', { text: o.share != null ? fmt.pct(c.sum / o.share) : fmt.plural(c.count, 'תנועה', 'תנועות', 'תנועה אחת') })
      ])
    ]);
    return r;
  }
  function merchantRow(g, opts) {
    const o = opts || {};
    return el('button.lrow', { type: 'button', onclick: () => merchant(g.key) }, [
      o.rank ? el('span.lrow__rank', { text: String(o.rank) }) : null,
      art.avatar(g.label, g.cat, 40),
      el('div.lrow__main', null, [
        el('div.lrow__title', null, el('span', { text: g.label })),
        el('div.lrow__meta', null, [el('span', { text: g.cat }), el('span', { text: fmt.plural(g.count, 'חיוב', 'חיובים', 'חיוב אחד') })])
      ]),
      el('div.lrow__aside', null, [el('div.lrow__value.fig', { text: fmt.money(g.sum) }), el('div.lrow__sub', null, [el('span.fig', { text: fmt.money(g.sum / g.count) }), ' לחיוב'])])
    ]);
  }
  function insightRow(item) {
    const iconNode = item.icon.cat ? art.tile(item.icon.cat, 42) : el('span.insight__icon', { vars: { '--c': item.icon.color } }, ic.svg(item.icon.name, 20));
    return el('button.insight', { type: 'button', onclick: () => run(item.action) }, [
      iconNode,
      el('div.insight__main', null, [el('div.insight__title', { text: item.title }), el('div.insight__text', { text: item.text })]),
      el('span.insight__go', null, ic.svg('chevron', 18))
    ]);
  }
  function run(action) {
    if (!action) return;
    if (action.type === 'tx') tx(action.id);
    else if (action.type === 'category') category(action.cat, { month: action.month });
    else if (action.type === 'month') month(action.key);
    else if (action.type === 'merchant') merchant(action.key);
    else if (action.type === 'recurring') recurring();
    else if (action.type === 'route') P.layers.navigate(action.hash);
  }
  function tabs(items, current, onPick) {
    return el('div.tabs', { role: 'tablist' }, items.map(([k, label, count]) => el('button', {
      type: 'button', role: 'tab', 'aria-selected': k === current ? 'true' : 'false', onclick: () => onPick(k)
    }, [label, count != null ? el('span.count', { text: fmt.count(count) }) : null])));
  }
  function coverArt(seed, kind) {
    const wrap = el('div.sheet__cover-art');
    const b = art.band({ color: kind === 'hero' ? '#fff' : 'currentColor', lines: 14, seed: seed, width: 900, height: 260 });
    b.style.cssText = 'inset:0;width:100%;height:100%;opacity:' + (kind === 'hero' ? .28 : .16);
    wrap.appendChild(b);
    const s = art.seal({ seed: seed, color: kind === 'hero' ? '#fff' : 'currentColor', quality: 'lo', width: .55 });
    s.style.cssText = 'width:300px;height:300px;left:-90px;top:-70px;opacity:' + (kind === 'hero' ? .3 : .22);
    wrap.appendChild(s);
    return wrap;
  }
  const monthsIn = (fromKey, toKey) => {
    const out = [];
    for (let k = fromKey; k <= toKey; k = fmt.addMonths(k, 1)) out.push(k);
    return out;
  };

  /* ======================================================================
     חודש
     ====================================================================== */
  function month(key0, opts) {
    // הפעם הראשונה שפותחים חודש — מכל מקום: קודם הסיפור שלו, ובסופו (גם כשמדלגים) החלון עצמו
    if (!(opts && opts.direct) && P.stories && P.stories.firstTime('m:' + key0)) {
      P.stories.month(key0, { then: () => month(key0, Object.assign({}, opts, { direct: true })), always: true });
      return null;
    }
    let key = key0, tab = (opts && opts.tab) || 'overview', drawn = null;
    return P.ui.sheet({
      size: 'lg', title: fmt.monthName(key), morphFrom: opts && opts.from,
      // ההדמיה רצה מעל החלון, וכשהיא נגמרת החלון עדיין כאן
      headEnd: () => (st.filter({ month: key, flow: 'out' }).length ? [P.stories.button('סיפור החודש', () => P.stories.month(key), 'btn--sm', 17)] : null),
      render: (body, api) => {
        const m = P.insights.month(key);
        api.setTitle(fmt.monthName(key));
        const lines = P.insights.summary(m);
        const poster = P.posters.month(key, { size: 'cover', eager: true });
        poster.setAttribute('data-morph-target', '');
        const cover = el('div.sheet__cover.sheet__cover--photo', { vars: P.posters.vars(key) }, [
          poster,
          el('div.sheet__kicker', null, [
            el('span', { text: m.cov.partial ? 'עד ' + fmt.dayWithMonth(m.cov.to) : fmt.range(m.cov.from, m.cov.to) }),
            el('span.chip.chip--sm', { text: P.posters.info(key).word }),
            m.cov.partial ? el('span.chip.chip--sm', { text: 'חודש חלקי' }) : null
          ]),
          el('h2.sheet__h', { text: fmt.monthName(key) }),
          el('div.sheet__fig.fig', { text: fmt.money(m.totals.outflow) }),
          el('p.sheet__sub', { text: lines.join(' ') })
        ]);
        // פתיחה ראשונה: הסכום רץ למעלה. מעבר לחודש אחר בתוך החלון: הפוסטר החדש "נכנס" והטקסט אחריו.
        if (api.first) P.motion.countTo(cover.querySelector('.sheet__fig'), m.totals.outflow, fmt.money, opts && opts.from ? 1500 : 900);
        else if (drawn && drawn !== key) { poster.classList.add('is-entering'); cover.classList.add('is-swapping'); P.motion.countTo(cover.querySelector('.sheet__fig'), m.totals.outflow, fmt.money, 600); }
        drawn = key;
        body.appendChild(cover);

        const days = Math.max(1, new Set(m.expense.map((t) => t.date)).size);
        const big = m.expense.slice().sort((a, b) => a.amount - b.amount)[0];
        const prevFull = m.prev && m.prev.outflow > 0 && !(m.prevCov && m.prevCov.partial) && !m.cov.partial;
        // נתוני הוצאות בלבד (פירוט כרטיס): בלי "נכנס" ו"מאזן", שאין להם משמעות בלי הכנסות
        body.appendChild(el('div.sheet__section', null, el('div.stats', null, (st.spendOnly() ? [
          stat('תנועות', fmt.count(m.expense.length), { sub: prevFull ? [deltaChip(m.totals.outflow, m.prev.outflow), 'בהוצאה, לעומת ' + fmt.monthOnly(m.prevKey)] : null }),
          stat('ממוצע ליום עם הוצאה', fmt.money(m.totals.outflow / days), { sub: [fmt.plural(days, 'יום', 'ימים', 'יום אחד')] }),
          big ? stat('ההוצאה הגדולה', fmt.money(big.amount), { sub: [big.desc.length > 22 ? big.desc.slice(0, 21) + '…' : big.desc] }) : null
        ] : [
          stat('נכנס', fmt.money(m.totals.inflow), { sub: m.prev ? [deltaChip(m.totals.inflow, m.prev.inflow, { higherIsGood: true }), 'לעומת ' + fmt.monthOnly(m.prevKey)] : null }),
          stat('מאזן', fmt.signed(m.totals.net), { tone: m.totals.net >= 0 ? 'in' : 'out' }),
          stat('ממוצע ליום עם הוצאה', fmt.money(m.totals.outflow / days), { sub: [fmt.plural(days, 'יום', 'ימים', 'יום אחד')] }),
          m.balance ? stat('יתרה בסוף החודש', fmt.moneyS(m.balance.balance), { tone: m.balance.balance < 0 ? 'out' : '', sub: ['נכון ל-' + fmt.dayShort(m.balance.date)] }) : null
        ]).filter(Boolean))));

        const all = st.filter({ month: key, all: true });
        const merchants = st.byMerchant(m.expense);
        body.appendChild(el('div.sheet__tabs', null, tabs([['overview', 'סקירה'], ['tx', 'תנועות', all.length], ['merchants', 'בתי עסק', merchants.length]], tab, (k) => { tab = k; api.refresh(); })));

        if (tab === 'overview') {
          body.appendChild(el('div.sheet__section', null, [
            el('h3.sheet__section-title', null, ['הוצאה יום-יום', el('span.card__note', { text: 'ריחוף על עמודה מציג את הסכום' })]),
            P.charts.dayBars(key, m.list, { height: 170 })
          ]));
          const pace = P.charts.pace(key, st.counted(), { height: 190 });
          if (pace.summary) {
            const s = pace.summary, same = Math.abs(s.diff) < 0.04;
            body.appendChild(el('div.sheet__section', null, [
              el('h3.sheet__section-title', null, ['הקצב לעומת חודש רגיל', el('span.card__note', { text: same ? 'בערך כמו תמיד' : (s.diff > 0 ? 'מהר מהרגיל' : 'לאט מהרגיל') })]),
              el('p.muted', { style: 'margin:0 0 10px', text: 'עד ה-' + s.day + ' בחודש הוצאת ' + fmt.money(s.now) + ', לעומת ' + fmt.money(s.usual) + ' בחודש רגיל באותה נקודה.' }),
              pace
            ]));
          }
          const max = m.cats[0] ? m.cats[0].sum : 1;
          body.appendChild(el('div.sheet__section', null, [
            el('h3.sheet__section-title', null, ['לאן הלך הכסף', el('span.card__note', { text: m.base.months ? 'התגים משווים לממוצע שלך' : '' })]),
            m.cats.length ? P.charts.composition(m.cats, { legend: false }) : null,
            el('div.list.sheet__flush', { style: 'margin-top:10px' }, m.cats.map((c) => catRow(c, max, { month: key, showDelta: true })))
          ]));
        } else if (tab === 'tx') {
          body.appendChild(el('div', null, P.ui.txList(all, { page: 60 })));
        } else {
          body.appendChild(el('div.list', { style: 'padding:8px 0' }, merchants.length ? merchants.map((g, i) => merchantRow(g, { rank: i + 1 })) : el('div.empty', { text: 'אין הוצאות בחודש הזה' })));
        }
      },
      foot: (api) => {
        const keys = st.months().map((x) => x.key);
        const prev = fmt.addMonths(key, -1), next = fmt.addMonths(key, 1);
        return [
          el('button.btn', { type: 'button', disabled: keys.indexOf(prev) === -1 ? true : null, onclick: () => { key = prev; api.body.scrollTop = 0; api.refresh(); } }, [ic.svg('chevronR', 16), fmt.monthOnly(prev)]),
          el('button.btn', { type: 'button', disabled: keys.indexOf(next) === -1 ? true : null, onclick: () => { key = next; api.body.scrollTop = 0; api.refresh(); } }, [fmt.monthOnly(next), ic.svg('chevron', 16)]),
          el('span.spacer'),
          el('button.btn.btn--ghost', { type: 'button', onclick: () => { api.close(); P.layers.navigate('#/transactions?month=' + key); } }, 'בעמוד התנועות')
        ];
      }
    });
  }

  /* ======================================================================
     קטגוריה
     ====================================================================== */
  function category(cat, opts) {
    const o = opts || {};
    let scope = o.month ? 'month' : '12m';
    let thenMonth = null;                       // חודש שנבחר בגרף: נפתח רק אחרי שהחלון הזה באמת נסגר
    const anchorMonth = o.month || P.insights.focusMonth();
    return P.ui.sheet({
      size: 'md', title: cat, morphFrom: o.from,
      onClose: () => { if (thenMonth) { const k = thenMonth; thenMonth = null; setTimeout(() => month(k), 80); } },
      render: (body, api) => {
        if (!st.data.rules[cat] && !st.data.tx.some((t) => t.cat === cat)) { body.appendChild(el('div.empty', { style: 'padding-top:90px' }, [el('b', { text: 'הקטגוריה כבר לא קיימת' })])); return; }
        const b = st.dateBounds() || { first: anchorMonth + '-01', last: anchorMonth + '-28' };
        const range = scope === 'month' ? { month: anchorMonth } : scope === '12m'
          ? { from: P.parse.isoDate(new Date(new Date(b.last).getTime() - 365 * 86400000)), to: b.last } : {};
        const all = st.filter(Object.assign({ all: true }, range));
        const mine = all.filter((t) => t.cat === cat);
        const isIncome = cat === P.cats.INCOME || (mine.length && mine.every((t) => t.amount > 0));
        const sum = mine.reduce((a, t) => a + Math.abs(t.amount), 0);
        const totalOut = all.filter((t) => t.amount < 0 && !st.isExcluded(t)).reduce((a, t) => a - t.amount, 0);
        const color = st.tintOf(cat);
        const excluded = !!st.data.excluded[cat];

        // מגמה: 12 חודשים אחרונים תמיד, עם הדגשת החודש שנבחר
        const lastKey = b.last.slice(0, 7);
        const firstKey = fmt.addMonths(lastKey, -11) > b.first.slice(0, 7) ? fmt.addMonths(lastKey, -11) : b.first.slice(0, 7);
        const series = monthsIn(firstKey, lastKey).map((k) => {
          const xs = st.data.tx.filter((t) => t.cat === cat && t.date.slice(0, 7) === k);
          return { key: k, value: xs.reduce((a, t) => a + Math.abs(t.amount), 0), count: xs.length };
        });
        const monthsWith = series.filter((p) => p.value > 0).length;
        const avg = series.length ? series.reduce((a, p) => a + p.value, 0) / series.length : 0;

        const bigTile = art.tile(cat, 64, color);
        bigTile.setAttribute('data-morph-target', '');
        body.appendChild(el('div.sheet__cover.sheet__cover--photo', { vars: { '--c': color } }, [
          P.posters.cover(cat, color),
          el('div.sheet__media', null, [bigTile, el('div', null, [
            el('div.sheet__kicker', null, el('div.seg', null, [['month', fmt.monthOnly(anchorMonth)], ['12m', '12 חודשים'], ['all', 'הכל']].map(([k, l]) =>
              el('button', { type: 'button', 'aria-pressed': scope === k ? 'true' : 'false', onclick: () => { scope = k; api.refresh(); } }, l)))),
            el('h2.sheet__h', { text: cat })
          ])]),
          el('div.sheet__fig.fig', { text: fmt.money(sum) }),
          el('p.sheet__sub', { text: !mine.length ? 'אין תנועות בטווח הזה.'
            : (isIncome ? fmt.plural(mine.length, 'תנועה', 'תנועות', 'תנועה אחת') + ' של כסף נכנס.'
              : (totalOut ? fmt.pct(sum / totalOut) + ' מההוצאה בטווח, ' : '') + fmt.plural(mine.length, 'תנועה', 'תנועות', 'תנועה אחת') + '. בממוצע ' + fmt.money(avg) + ' לחודש.') })
        ]));

        body.appendChild(el('div.sheet__section', null, [
          el('h3.sheet__section-title', null, ['חודש אחר חודש', el('span.card__note', { text: monthsWith + ' מתוך ' + series.length + ' חודשים' })]),
          P.charts.seriesBars(series, { color: color, height: 180, highlight: scope === 'month' ? anchorMonth : null, onPick: (k) => { thenMonth = k; api.close(); } })
        ]));

        const merchants = st.byMerchant(mine, 6);
        if (merchants.length) body.appendChild(el('div.sheet__section', null, [
          el('h3.sheet__section-title', { text: 'בתי העסק' }),
          el('div.list.sheet__flush', null, merchants.map((g, i) => merchantRow(g, { rank: i + 1 })))
        ]));

        if (cat !== P.cats.OTHER) body.appendChild(el('div.sheet__section', null, [
          el('h3.sheet__section-title', null, ['מילות מפתח', el('span.card__note', { text: 'תנועה שמכילה אחת מהן תסווג לכאן' })]),
          keywordEditor(cat),
          el('label.check', { style: 'margin-top:16px' }, [
            el('button.switch', { type: 'button', role: 'switch', 'aria-checked': excluded ? 'false' : 'true', onclick: () => {
              st.setExcluded(cat, !excluded);
              P.kit.toast(excluded ? cat + ' נספר שוב בסיכומים' : cat + ' לא ייספר בסיכומים ובגרפים');
            } }),
            el('span', { text: 'נספר בסיכומים ובגרפים' })
          ]),
          el('p.dim', { style: 'font-size:var(--fs-tiny);margin:6px 0 0', text: 'כבו למשל להעברות בין החשבונות שלכם, או לחיובי אשראי מרוכזים כשטענתם גם את פירוט הכרטיס.' })
        ]));
        else body.appendChild(el('div.sheet__section', null, el('div.callout.callout--mark', null, [ic.svg('inbox', 18),
          el('div.callout__text', { text: 'כאן נוחת כל מה שהמנוע לא זיהה. הדרך המהירה לסדר: עמוד השיוך, בית עסק אחד בכל פעם.' }),
          el('button.btn.btn--sm', { type: 'button', onclick: () => { api.close(); P.layers.navigate('#/assign'); } }, 'לשיוך')])));

        body.appendChild(el('div.sheet__section', { style: 'padding-bottom:0' }, el('h3.sheet__section-title', null, ['התנועות', el('span.card__note', { text: fmt.count(mine.length) })])));
        body.appendChild(el('div.sheet__flush', { style: 'margin:0' }, P.ui.txList(mine, { page: 40 })));
      }
    });
  }

  function keywordEditor(cat) {
    const kws = st.data.rules[cat] || [];
    const box = el('div.kws', { style: 'padding-top:0' });
    kws.forEach((k, i) => box.appendChild(el('span.kw', null, [k, el('button', { type: 'button', 'aria-label': 'הסרת ' + k, onclick: () => {
      st.removeKeyword(cat, i);
      P.kit.toast('"' + k + '" הוסר', { undo: () => st.addKeyword(cat, k) });
    } }, ic.svg('close', 12))])));
    const inp = el('input.kw-add', { placeholder: '+ מילה חדשה ואנטר', 'aria-label': 'הוספת מילת מפתח', 'data-fk': 'kw-add:' + cat });
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const v = inp.value.trim(); if (!v) return;
      if (st.addKeyword(cat, v)) P.kit.toast('"' + v + '" נוסף ' + fmt.prefix('ל', cat));
      else P.kit.toast('המילה כבר קיימת');
    });
    box.appendChild(inp);
    return box;
  }

  /* ======================================================================
     בית עסק
     ====================================================================== */
  function merchant(key) {
    return P.ui.sheet({
      size: 'md', title: '',
      render: (body, api) => {
        const g = st.merchantByKey(key);
        if (!g) { body.appendChild(el('div.empty', { style: 'padding-top:90px' }, [el('b', { text: 'לא נמצאו תנועות' })])); return; }
        api.setTitle(g.label);
        const color = st.tintOf(g.cat);
        const dates = g.txs.map((t) => t.date).sort();
        const rec = P.learn.recurring(g.txs).find((r) => r.key === key);
        const chip = el('button.catchip' + (g.cat === P.cats.OTHER ? '.catchip--pending' : ''), { type: 'button', vars: { '--c': color }, style: 'height:28px;font-size:var(--fs-small);padding:0 12px',
          onclick: () => {
            const sugg = P.learn.suggest(g.label, st.data.tx, 3).map((s) => s.cat).concat(P.cats.suggest(g.label, st.data.rules, 3));
            P.ui.pickCategory(chip, { current: g.cat, suggestions: sugg }).then((cat) => {
              if (!cat || cat === g.cat) return;
              const kw = P.learn.keywordFor(g.label, st.data.tx);
              const res = st.assignUndoable(g.ids, cat, kw);
              P.kit.toast(fmt.plural(g.count, 'תנועה', 'תנועות', 'תנועה אחת') + ' שויכו ' + fmt.prefix('ל', cat) + (res.keywordAdded ? ', ונוצר כלל "' + kw + '"' : ''), { undo: res.undo });
            });
          } }, [el('i'), g.cat === P.cats.OTHER ? 'בחירת קטגוריה' : g.cat, ic.svg('chevronD', 14)]);

        body.appendChild(el('div.sheet__cover.sheet__cover--photo', { vars: { '--c': color } }, [
          P.posters.cover(g.cat, color),
          el('div.sheet__media', null, [art.avatar(g.label, g.cat, 64), el('div', { style: 'min-width:0' }, [
            el('div.sheet__kicker', null, [chip, rec ? el('span.chip.chip--accent.chip--sm', null, [ic.svg('repeat', 12), 'חיוב ' + rec.cadence]) : null]),
            el('h2.sheet__h', { text: g.label })
          ])]),
          el('div.sheet__fig.fig', { text: fmt.money(g.sum) }),
          el('p.sheet__sub', { text: fmt.plural(g.count, 'חיוב', 'חיובים', 'חיוב אחד') + ', בממוצע ' + fmt.money(g.sum / g.count) + ' לחיוב. ' +
            (dates.length > 1 ? 'מ-' + fmt.day(dates[0]) + ' עד ' + fmt.day(dates[dates.length - 1]) + '.' : 'ב-' + fmt.day(dates[0]) + '.') +
            (rec && rec.active ? ' החיוב הבא צפוי בסביבות ' + fmt.dayWithMonth(rec.next) + '.' : '') })
        ]));

        const b = st.dateBounds();
        const lastKey = b.last.slice(0, 7);
        const firstKey = fmt.addMonths(lastKey, -11) > b.first.slice(0, 7) ? fmt.addMonths(lastKey, -11) : b.first.slice(0, 7);
        const series = monthsIn(firstKey, lastKey).map((k) => {
          const xs = g.txs.filter((t) => t.date.slice(0, 7) === k);
          return { key: k, value: xs.reduce((a, t) => a + Math.abs(t.amount), 0), count: xs.length };
        });
        body.appendChild(el('div.sheet__section', null, [el('h3.sheet__section-title', { text: 'חודש אחר חודש' }), P.charts.seriesBars(series, { color: color, height: 170 })]));
        body.appendChild(el('div.sheet__section', { style: 'padding-bottom:0' }, el('h3.sheet__section-title', null, ['החיובים', el('span.card__note', { text: fmt.count(g.count) })])));
        body.appendChild(el('div.sheet__flush', { style: 'margin:0' }, P.ui.txList(g.txs, { page: 40 })));
      }
    });
  }

  /* ======================================================================
     תנועה
     ====================================================================== */
  function tx(id) {
    return P.ui.sheet({
      size: 'sm', title: 'תנועה',
      render: (body, api) => {
        const t = st.data.tx.find((x) => x.id === id);
        if (!t) { body.appendChild(el('div.empty', { style: 'padding-top:90px' }, [el('b', { text: 'התנועה לא נמצאה' })])); return; }
        api.setTitle(t.desc);
        const color = st.tintOf(t.cat);
        const rule = P.cats.explain(t.desc, st.data.rules);
        const reason = {
          manual: 'שיוך ידני שלכם',
          file: 'הקטגוריה הגיעה בקובץ' + (t.fileCat && t.fileCat !== t.cat ? ' ("' + t.fileCat + '")' : ''),
          rule: rule ? 'כלל: התיאור מכיל "' + rule.kw + '"' : 'כלל מילת מפתח',
          inferred: 'המנוע הציע לפי תנועות דומות' + (t.guess && t.guess.example ? ', למשל "' + t.guess.example.desc + '"' : ''),
          none: 'עדיין לא סווג'
        }[t.source] || '—';

        body.appendChild(el('div.sheet__cover.sheet__cover--tint', { vars: { '--c': color } }, [
          el('div.sheet__media', null, [art.tile(t.cat, 56, color), el('div', { style: 'min-width:0' }, [
            el('div.sheet__kicker', { text: fmt.dayLong(t.date) }),
            el('h2.sheet__h', { style: 'font-size:22px', text: t.desc })
          ])]),
          el('div.sheet__fig.fig' + (t.amount > 0 ? '.in' : ''), { text: fmt.signed(t.amount, true) })
        ]));

        const sugg = P.learn.suggest(t.desc, st.data.tx, 4).map((s) => s.cat).concat(P.cats.suggest(t.desc, st.data.rules, 3))
          .filter((c, i, a) => c && c !== t.cat && a.indexOf(c) === i).slice(0, 3);
        const pickBtn = el('button.btn.btn--sm', { type: 'button', onclick: () => {
          P.ui.pickCategory(pickBtn, { current: t.cat, suggestions: sugg }).then((cat) => { if (cat && cat !== t.cat) P.ui.applyChange(t, cat); });
        } }, [ic.svg('grid', 14), 'קטגוריה אחרת']);
        body.appendChild(el('div.sheet__section', null, [
          el('h3.sheet__section-title', { text: 'קטגוריה' }),
          el('div.row', { style: 'gap:10px' }, [
            el('span.catchip' + (t.cat === P.cats.OTHER ? '.catchip--pending' : ''), { vars: { '--c': color }, style: 'height:30px;font-size:var(--fs-small);padding:0 12px' }, [el('i'), t.cat]),
            pickBtn
          ]),
          sugg.length ? el('div.picker__sugg', { style: 'padding:12px 0 0' }, [el('span.dim', { style: 'font-size:var(--fs-tiny);align-self:center', text: 'אולי:' })].concat(
            sugg.map((c) => el('button', { type: 'button', onclick: () => P.ui.applyChange(t, c) }, [art.tile(c, 24), c])))) : null,
          el('p.dim', { style: 'font-size:var(--fs-tiny);margin:12px 0 0', text: 'למה כאן? ' + reason })
        ]));

        const desc = el('input.input', { value: t.desc, 'aria-label': 'תיאור', 'data-fk': 'tx-desc' });
        desc.addEventListener('change', () => { if (desc.value.trim() && desc.value.trim() !== t.desc) { st.rename(t.id, desc.value); P.kit.toast('התיאור עודכן'); } });
        const note = el('textarea.input', { placeholder: 'למשל: החזר מדני, הוצאה עסקית, מתנה ליום הולדת', 'aria-label': 'הערה', 'data-fk': 'tx-note' });
        note.value = t.note || '';
        note.addEventListener('change', () => { if ((note.value || '') !== (t.note || '')) { st.setNote(t.id, note.value); P.kit.toast('ההערה נשמרה'); } });
        body.appendChild(el('div.sheet__section', null, [
          el('h3.sheet__section-title', { text: 'פרטים' }),
          el('div.stack', { style: 'gap:12px' }, [
            el('div', null, [el('label.lbl', { text: 'תיאור' }), desc]),
            el('div', null, [el('label.lbl', { text: 'הערה' }), note])
          ]),
          el('dl.kv', { style: 'margin-top:18px' }, [
            el('dt', { text: 'תאריך' }), el('dd', { text: fmt.day(t.date) }),
            typeof t.balance === 'number' ? [el('dt', { text: 'יתרה אחרי' }), el('dd', null, el('span.fig', { text: fmt.moneyS(t.balance) }))] : null,
            t.ref ? [el('dt', { text: 'אסמכתא' }), el('dd', { text: t.ref })] : null,
            t.currency && t.currency !== '₪' && t.currency !== 'ILS' ? [el('dt', { text: 'מטבע' }), el('dd', { text: t.currency })] : null
          ])
        ]));
      },
      foot: (api) => {
        const t = st.data.tx.find((x) => x.id === id);
        if (!t) return null;
        return [
          el('button.btn.btn--primary', { type: 'button', onclick: () => P.pages.plan.editor(t) }, 'עריכת תנועה'),
          el('button.btn', { type: 'button', onclick: () => merchant(P.learn.merchantKey(t.desc)) }, [ic.svg('store', 16), 'כל החיובים בבית העסק']),
          el('span.spacer'),
          t.source === 'manual' ? el('button.btn.btn--ghost', { type: 'button', onclick: () => { const r = st.assignUndoable([t.id], null); P.kit.toast('חזר לסיווג אוטומטי', { undo: r.undo }); } }, 'סיווג אוטומטי') : null
        ];
      }
    });
  }

  /* ======================================================================
     הוצאות קבועות
     ====================================================================== */
  function recurring(opts) {
    // בפעם הראשונה: השנה הקרובה של החיובים הקבועים, ובסופה החלון
    if (!(opts && opts.direct) && P.stories && P.stories.firstTime('r') && P.stories.canRecurring()) {
      P.stories.recurring({ then: () => recurring({ direct: true }), always: true });
      return null;
    }
    return P.ui.sheet({
      size: 'md', title: 'הוצאות קבועות',
      render: (body) => {
        const rec = P.learn.recurring(st.counted());
        const live = rec.filter((r) => r.active);
        const monthly = live.reduce((a, r) => a + r.yearly / 12, 0);
        body.appendChild(el('div.sheet__cover.sheet__cover--hero', null, [
          coverArt(17, 'hero'),
          el('div.sheet__kicker', { text: 'זוהו לפי קצב החיובים' }),
          el('h2.sheet__h', { text: 'הוצאות קבועות' }),
          el('div.sheet__fig.fig', { text: fmt.money(monthly) }),
          el('p.sheet__sub', { text: rec.length ? 'בחודש, מתוך ' + fmt.plural(live.length, 'חיוב פעיל', 'חיובים פעילים', 'חיוב פעיל אחד') + '. בשנה: כ-' + fmt.money(monthly * 12) + '.' + (rec.length > live.length ? ' ' + fmt.plural(rec.length - live.length, 'חיוב', 'חיובים', 'חיוב אחד') + ' כנראה הופסקו.' : '') : 'עוד לא זוהו חיובים שחוזרים בקצב קבוע.' }),
          live.length >= 2 && P.stories.can() ? el('div', { style: 'margin-top:16px' }, P.stories.button('השנה הקרובה, בהדמיה', () => P.stories.recurring(), 'btn--onhero-ghost')) : null
        ]));
        body.appendChild(el('div.list', { style: 'padding:8px 0' }, rec.map((r) => el('button.lrow', { type: 'button', onclick: () => merchant(r.key) }, [
          art.avatar(r.label, r.cat, 42),
          el('div.lrow__main', null, [
            el('div.lrow__title', null, [el('span', { text: r.label }), el('span.chip.chip--sm', { text: r.cadence }), r.active ? null : el('span.chip.chip--sm.chip--mark', { text: 'הופסק?' })]),
            el('div.lrow__meta', null, [el('span', { text: r.cat }), el('span', { text: r.active ? 'הבא בסביבות ' + fmt.dayWithMonth(r.next) : 'חיוב אחרון ב-' + fmt.day(r.last) })])
          ]),
          el('div.lrow__aside', null, [el('div.lrow__value.fig', { text: fmt.money(r.amount) }), el('div.lrow__sub', null, [el('span.fig', { text: fmt.money(r.yearly) }), ' בשנה'])])
        ]))));
      }
    });
  }

  /* ======================================================================
     סיכום אחרי ייבוא
     ====================================================================== */
  function importSummary(res) {
    const pending = st.data.tx.filter((t) => t.cat === P.cats.OTHER);
    const groups = new Set(pending.map((t) => P.learn.merchantKey(t.desc))).size;
    const newTx = st.data.tx.filter((t) => res.ids.has(t.id));
    const auto = newTx.filter((t) => t.cat !== P.cats.OTHER).length;
    const months = new Set(newTx.map((t) => t.date.slice(0, 7)));
    const dates = newTx.map((t) => t.date).sort();
    let d, next = null;
    const then = (fn) => { next = fn; d.close(); };
    const go = (hash) => then(() => P.layers.navigate(hash));
    d = P.ui.dialog({
      size: 'sm', center: true, art: art.doneArt('accent'),
      onClose: () => { if (next) { const f = next; next = null; setTimeout(f, 120); } },
      title: new Set(res.files.map((f) => f.file || f.name)).size > 1 ? fmt.count(new Set(res.files.map((f) => f.file || f.name)).size) + ' קבצים נקלטו' : 'הקובץ נקלט',
      body: el('div', null, [
        el('p.muted', { style: 'margin:0', text: fmt.plural(res.added, 'תנועה חדשה', 'תנועות חדשות', 'תנועה חדשה אחת') + (dates.length ? (months.size > 1 ? ', ' + fmt.prefix('מ', fmt.monthName(dates[0].slice(0, 7))) + ' עד ' + fmt.monthName(dates[dates.length - 1].slice(0, 7)) : ' ' + fmt.prefix('מ', fmt.monthName(dates[0].slice(0, 7)))) : '') + '.' }),
        el('div.impsum__grid', null, [
          stat('סווגו אוטומטית', newTx.length ? fmt.pct(auto / newTx.length) : '—', { sub: [fmt.count(auto) + ' מתוך ' + fmt.count(newTx.length)] }),
          stat('מחכות לקטגוריה', fmt.count(pending.length), { sub: [groups ? 'מ-' + fmt.plural(groups, 'בית עסק', 'בתי עסק', 'בית עסק אחד') : 'הכל מסודר'] }),
          stat('חודשים', fmt.count(months.size)),
          stat('כפילויות שדולגו', fmt.count(res.duplicates))
        ]),
        el('div.impsum__files', { text: res.files.map((f) => f.name).join(', ') }),
        // קליטה אוטומטית: אם המספרים לא נראים נכון, אפשר למפות את העמודות ביד
        res.redo ? el('button.card__more', { type: 'button', style: 'margin-top:10px;font-size:var(--fs-tiny)', onclick: () => then(res.redo) },
          'המספרים לא נראים נכון? מיפוי ידני של העמודות') : null
      ]),
      foot: [
        el('button.btn.btn--primary', { type: 'button', autofocus: true, onclick: () => go('#/') }, 'לחודש שלי'),
        pending.length ? el('button.btn', { type: 'button', onclick: () => go('#/assign') }, [ic.svg('inbox', 16), 'לשיוך (' + groups + ')']) : null
      ].filter(Boolean)
    });
    return d;
  }

  return { month, category, merchant, tx, recurring, importSummary, run, parts: { stat, deltaChip, catRow, merchantRow, insightRow, tabs, coverArt } };
})();
