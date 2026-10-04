/* ==========================================================================
   pages/assign.js — לשיוך, כמשחק קצר: כל בית עסק מקבל בית, פעם אחת
   ---------------------------------------------------------------------------
   המטרה: לסדר את כל מה שמחכה כמה שיותר מהר, ובהנאה.
     · מה שהמנוע בטוח בו (דומה לתנועות שכבר סיווגת) — נסגר בלחיצה אחת, וניתן לביטול.
     · השאר: ערימת כרטיסים. לחיצה על קטגוריה — הכרטיס "עף" אל הקטגוריה, היא בולעת
       אותו ומונה שלה עולה, והכרטיס הבא עולה מהערימה. גרירה הצידה (או S) — דילוג.
     · למעלה: כמה כסף כבר קיבל מקום, וכמה נשאר. בסוף — "הכל מסודר".
   כל בחירה משייכת את כל התנועות של בית העסק, ויוצרת כלל להבא.
   מקלדת: 1–4 בוחרים, S מדלג.
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.assign = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons, art = P.art;
  // log: מה שסודר מאז שהתור התחיל — זה מה שההדמיה "הכל מסודר" מראה כשהתור מתרוקן.
  // sorted: כמה כסף קיבל מקום מאז, shownSorted: מה שהמונה הראה בפעם הקודמת (כדי שירוץ ממנו)
  const view = { tab: 'pending', current: null, skipped: [], makeRule: true, kw: P.dict(), done: 0, busy: false, entering: true, log: [],
    sorted: 0, shownSorted: 0, gained: P.dict() };
  let keyHandler = null;

  const BASIS = {
    similar: 'ההצעה מבוססת על תנועות דומות שכבר סווגו',
    words: 'ההצעה מבוססת על מילה מוכרת בתיאור',
    shape: 'ניחוש לפי הסכום והתדירות בלבד — כדאי לבדוק',
    none: 'אין למנוע הצעה הפעם'
  };

  function queue() {
    const groups = st.unassigned().sort((a, b) => b.sum - a.sum);
    // מי שדילגו עליו עובר לסוף התור
    return groups.filter((g) => view.skipped.indexOf(g.key) === -1).concat(groups.filter((g) => view.skipped.indexOf(g.key) !== -1));
  }
  /** בתי עסק שהמנוע בטוח בהם: ההצעה נלמדה מתנועות דומות שסיווגת בעצמך, בביטחון סביר */
  const isSure = (g) => g.basis === 'similar' && g.suggestions[0] && g.confidence >= 0.3;

  function render(params, mount, ctx) {
    if (!ctx.refresh) { view.entering = true; if (params.tab === 'inferred') view.tab = 'inferred'; }
    const groups = queue();
    const inferred = st.inferred();

    mount.appendChild(P.ui.pageHead('לשיוך',
      'כל בית עסק מקבל בית פעם אחת — וכל התנועות שלו מסתדרות. כל בחירה נשמרת ככלל, כך שבפעם הבאה זה קורה לבד.',
      (groups.length || inferred.length) ? [P.ui.seg([['pending', 'ממתינים', groups.length], ['inferred', 'הוצעו על ידי המנוע', inferred.length]], view.tab,
        (k) => { view.tab = k; view.entering = true; P.router.refresh(); }, { label: 'תצוגה' })] : null));

    if (view.tab === 'inferred') return drawInferred(mount, inferred);
    if (!groups.length) return mount.appendChild(doneState(inferred.length));

    if (!view.current || !groups.some((g) => g.key === view.current)) view.current = groups[0].key;
    const g = groups.find((x) => x.key === view.current);
    const sure = groups.filter(isSure);

    mount.appendChild(hud(groups));
    if (sure.length) mount.appendChild(quick(sure));
    const card = tcard(g, groups);
    swipe(card, () => skipNow(g));
    mount.appendChild(el('div.triage', null, [
      el('div.sgame__stage', null, [el('div.tstack', { 'data-left': String(Math.min(2, groups.length - 1)) }, card), el('p.sgame__hint', { text: 'גוררים את הכרטיס הצידה כדי לדלג' })]),
      queueCard(groups)
    ]));
    wireKeys(g);
  }

  /* ---------- הלוח: כמה כבר קיבל מקום, וכמה נשאר ---------- */
  function hud(groups) {
    const left = groups.reduce((a, x) => a + x.sum, 0);
    const total = view.sorted + left;
    const pct = total ? view.sorted / total : 0;
    const fig = el('b.fig', { text: fmt.money(view.shownSorted) });
    if (view.sorted !== view.shownSorted) { P.motion.countTo(fig, view.sorted, fmt.money, 700, view.shownSorted); view.shownSorted = view.sorted; }
    return el('section.sgame__hud', { 'aria-label': 'ההתקדמות' }, [
      el('div.sgame__score', null, [art.coin(34), el('div', null, [fig, el('span', { text: 'קיבלו מקום' + (view.done ? ' · ' + fmt.plural(view.done, 'בית עסק', 'בתי עסק', 'בית עסק אחד') : '') })])]),
      el('div.sgame__meter', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct * 100)) }, [
        el('i', { style: 'width:' + Math.max(2, pct * 100).toFixed(1) + '%' })
      ]),
      el('div.sgame__left', null, [el('b', { text: fmt.count(groups.length) }), el('span', { text: groups.length === 1 ? 'נשאר' : 'נשארו' }), el('small.fig', { text: fmt.money(left) })])
    ]);
  }

  /* ---------- מה שהמנוע בטוח בו: בלחיצה אחת ---------- */
  function quick(sure) {
    const n = sure.reduce((a, g) => a + g.count, 0);
    return el('section.sgame__quick', null, [
      el('span.sgame__quick-icon', null, ic.svg('spark', 22)),
      el('div.sgame__quick-main', null, [
        el('b', { text: 'המנוע בטוח ב-' + fmt.plural(sure.length, 'בית עסק', 'בתי עסק', 'בית עסק אחד') }),
        el('div.sgame__quick-list', null, sure.slice(0, 4).map((g) => el('span.sgame__pair', { vars: { '--c': st.tintOf(g.suggestions[0]) } }, [
          el('span', { text: g.label.length > 18 ? g.label.slice(0, 17) + '…' : g.label }), ic.svg('chevron', 12), art.tile(g.suggestions[0], 22), el('span', { text: g.suggestions[0] })
        ])).concat(sure.length > 4 ? [el('span.dim', { text: 'ועוד ' + fmt.count(sure.length - 4) })] : []))
      ]),
      el('button.btn.btn--primary', { type: 'button', onclick: () => sortAll(sure) }, [ic.svg('check', 15), 'לסדר ' + (sure.length === 1 ? 'אותו' : 'את כולם') + ' · ' + fmt.plural(n, 'תנועה', 'תנועות', 'תנועה אחת')])
    ]);
  }

  /* ---------- הכרטיס ---------- */
  function tcard(g, groups) {
    const dates = g.dates.slice().sort();
    const kw = view.kw[g.key] || g.keyword;
    const sugg = g.suggestions.slice(0, 3);
    const strong = g.basis === 'similar' || g.basis === 'words';
    const card = el('section.tcard' + (view.entering ? '.is-entering' : ''), { 'aria-label': 'שיוך ' + g.label });
    view.entering = false;

    const samples = g.ids.map((id) => st.data.tx.find((t) => t.id === id)).filter(Boolean)
      .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);

    const choices = sugg.map((c, i) => {
      const btn = el('button.choice' + (i === 0 && strong ? '.choice--best' : ''), {
        type: 'button', vars: { '--c': st.tintOf(c) }, onclick: () => commit(g, c, card, btn)
      }, [
        el('span.kbd', { text: String(i + 1) }),
        art.tile(c, 50),
        el('span', { text: c }),
        i === 0 && strong ? el('small', { text: 'הכי סביר' }) : (g.basis === 'shape' ? el('small', { text: 'ניחוש' }) : null),
        view.gained[c] ? el('span.choice__count', { title: 'סודרו לכאן עכשיו', text: '+' + fmt.count(view.gained[c]) }) : null
      ]);
      return btn;
    });
    const otherBtn = el('button.choice.choice--other', { type: 'button', onclick: () => pickOther(g, card, otherBtn) }, [
      el('span.kbd', { text: String(sugg.length + 1) }),
      el('span.choice__icon', null, ic.svg('grid', 22)),
      el('span', { text: 'קטגוריה אחרת' }),
      el('small', { text: 'או חדשה' })
    ]);

    const kwBtn = el('button.kwedit', { type: 'button', title: 'עריכת מילת המפתח', onclick: () => editKeyword(g, kwBtn) }, kw);
    const sw = el('button.switch', { type: 'button', role: 'switch', 'aria-checked': view.makeRule ? 'true' : 'false', 'aria-label': 'ליצור כלל להבא',
      onclick: () => { view.makeRule = !view.makeRule; sw.setAttribute('aria-checked', view.makeRule ? 'true' : 'false'); } });

    P.kit.append(card, [
      el('div.tcard__head', null, [
        art.avatar(g.label, P.cats.OTHER, 60),
        el('div', { style: 'min-width:0' }, [
          el('div.tcard__name', { text: g.label }),
          el('div.tcard__meta', null, [
            el('span', null, [el('b.fig', { text: fmt.money(g.sum) }), ' בסך הכל']),
            el('span', { text: fmt.plural(g.count, 'חיוב', 'חיובים', 'חיוב אחד') }),
            el('span.fig', { text: dates.length > 1 ? fmt.dayShort(dates[0]) + ' – ' + fmt.day(dates[dates.length - 1]) : fmt.day(dates[0]) })
          ])
        ])
      ]),
      el('div.tcard__samples', null, samples.map((t) => el('div.tcard__sample', null, [
        el('span', null, [el('span.dim', { text: fmt.dayShort(t.date) + ' · ' }), t.desc]),
        el('span.fig', { text: fmt.signed(t.amount, true) })
      ]))),
      el('div.tcard__q', null, ['לאיזו קטגוריה זה שייך?', el('small', { text: BASIS[g.basis] || '' })]),
      el('div.choices', { vars: { '--n': String(sugg.length + 1) } }, choices.concat([otherBtn])),
      el('div.tcard__foot', null, [
        el('label.tcard__rule', null, [sw, el('span', { text: 'מעכשיו, כל תיאור עם' }), kwBtn, el('span', { text: 'יסווג לבד' })]),
        el('span.spacer'),
        el('button.btn.btn--ghost', { type: 'button', onclick: () => skip(g, card) }, ['דילוג', el('span.kbd', { text: 'S' })])
      ])
    ]);
    return card;
  }

  /* ---------- התור בצד ---------- */
  function queueCard(groups) {
    const rows = groups.slice(0, 9).map((g) => el('button.lrow' + (g.key === view.current ? '.is-current' : ''), {
      type: 'button', 'aria-current': g.key === view.current ? 'true' : null, onclick: () => { view.current = g.key; view.entering = true; P.router.refresh(); }
    }, [
      art.avatar(g.label, P.cats.OTHER, 34),
      el('div.lrow__main', null, [
        el('div.lrow__title', null, el('span', { text: g.label })),
        el('div.lrow__meta', { text: fmt.plural(g.count, 'חיוב', 'חיובים', 'חיוב אחד') + (isSure(g) ? ' · המנוע בטוח' : '') })
      ]),
      el('div.lrow__aside', null, el('div.lrow__value.fig', { style: 'font-size:13.5px', text: fmt.money(g.sum) }))
    ]));
    return P.ui.card({
      cls: 'queue', title: 'בתור', note: groups.length > 9 ? 'ועוד ' + fmt.count(groups.length - 9) : null, flush: true,
      body: el('div.list', null, rows)
    });
  }

  /* ---------- תנועה: הכרטיס עף אל הקטגוריה שנבחרה ---------- */
  /** עותק של האות של בית העסק עף מהכרטיס אל האריח של הקטגוריה, שבולע אותו; "+N" עולה ממנו */
  function flyInto(card, btn, g, cat) {
    if (P.kit.reduced() || !btn || !btn.isConnected) return;
    const from = card.querySelector('.tcard__head .avatar'), to = btn.querySelector('.ctile');
    if (!from || !to) return;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const ghost = art.avatar(g.label, cat, a.width);
    ghost.classList.add('sflight');
    ghost.style.cssText += ';left:' + a.left + 'px;top:' + a.top + 'px';
    document.body.appendChild(ghost);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const lift = Math.min(90, Math.abs(dy) * 0.35 + 30);
    ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + (dx * 0.5).toFixed(1) + 'px,' + (dy * 0.5 - lift).toFixed(1) + 'px) scale(.9)', opacity: 1, offset: 0.5 },
      { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(.3)', opacity: 0.2 }
    ], { duration: 460, easing: P.motion.ease.inOut, fill: 'forwards' }).finished.catch(() => {}).then(() => ghost.remove());
    // הקטגוריה "בולעת": גל בצבע שלה, במקום שבו האריח נמצא (הוא עצמו מתחלף כשהכרטיס הבא נכנס)
    const burst = el('span.sburst', { vars: { '--c': st.tintOf(cat) } });
    burst.style.cssText += ';left:' + (b.left + b.width / 2) + 'px;top:' + (b.top + b.height / 2) + 'px;width:' + b.width + 'px;height:' + b.height + 'px';
    document.body.appendChild(burst);
    burst.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: 0.75, transform: 'translate(-50%,-50%) scale(1)', offset: 0.25 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.9)' }],
      { duration: 620, delay: 360, easing: 'ease-out', fill: 'both' }).finished.catch(() => {}).then(() => burst.remove());
    const plus = el('span.splus.fig', { text: '+' + fmt.money(g.sum) });
    plus.style.cssText = 'left:' + (b.left + b.width / 2) + 'px;top:' + b.top + 'px';
    document.body.appendChild(plus);
    plus.animate([{ opacity: 0, transform: 'translate(-50%, 0) scale(.8)' }, { opacity: 1, transform: 'translate(-50%, -18px) scale(1)', offset: 0.35 }, { opacity: 0, transform: 'translate(-50%, -46px) scale(1)' }],
      { duration: 900, delay: 380, easing: 'ease-out', fill: 'both' }).finished.catch(() => {}).then(() => plus.remove());
  }

  function leave(card, then, ms) {
    if (view.busy) return;
    view.busy = true;
    card.classList.add('is-leaving');
    setTimeout(() => { view.busy = false; view.entering = true; then(); }, P.kit.reduced() ? 0 : (ms || 230));
  }

  /** שיוך אחד: נרשם, נספר, ניתן לביטול — ובית העסק האחרון בתור מסיים במשחק */
  function record(g, cat, res) {
    const entry = { label: g.label, cat: cat, count: g.count, sum: g.sum, rule: !!res.keywordAdded };
    view.log.push(entry);
    view.done++; view.sorted += g.sum; view.gained[cat] = (view.gained[cat] || 0) + g.count;
    return entry;
  }
  function unrecord(entry) {
    view.log = view.log.filter((x) => x !== entry);
    view.done = Math.max(0, view.done - 1); view.sorted = Math.max(0, view.sorted - entry.sum);
    view.gained[entry.cat] = Math.max(0, (view.gained[entry.cat] || 0) - entry.count);
  }
  function finishIfDone() {
    // בית העסק האחרון בתור: כל מה שסודר נופל לקטגוריות שלו, והמטבע מטביע "הכל מסודר"
    if (st.data.tx.some((t) => t.cat === P.cats.OTHER)) return;
    const log = view.log;
    view.log = [];
    P.stories.sorted(log);
  }

  function commit(g, cat, card, btn) {
    const kw = view.makeRule ? (view.kw[g.key] || g.keyword) : null;
    flyInto(card, btn, g, cat);
    leave(card, () => {
      view.current = null;
      const res = st.assignUndoable(g.ids, cat, kw);
      const entry = record(g, cat, res);
      P.kit.toast(fmt.plural(g.count, 'תנועה', 'תנועות', 'תנועה אחת') + ' שויכו ' + fmt.prefix('ל', cat) + (res.keywordAdded ? ' · נוצר כלל "' + res.keywordAdded + '"' : ''), {
        undo: () => { res.undo(); unrecord(entry); view.current = g.key; view.entering = true; P.router.refresh(); }
      });
      finishIfDone();
    }, 260);
  }

  /** כל מה שהמנוע בטוח בו, בלחיצה אחת — וביטול אחד מחזיר את הכל */
  function sortAll(sure) {
    const done = sure.map((g) => {
      const cat = g.suggestions[0];
      const res = st.assignUndoable(g.ids, cat, view.makeRule ? (view.kw[g.key] || g.keyword) : null);
      return { res: res, entry: record(g, cat, res) };
    });
    view.current = null; view.entering = true;
    const n = sure.reduce((a, g) => a + g.count, 0);
    P.kit.toast(fmt.plural(sure.length, 'בית עסק סודר', 'בתי עסק סודרו', 'בית עסק אחד סודר') + ' · ' + fmt.plural(n, 'תנועה', 'תנועות', 'תנועה אחת'), {
      undo: () => { done.slice().reverse().forEach((d) => { d.res.undo(); unrecord(d.entry); }); view.entering = true; P.router.refresh(); }
    });
    finishIfDone();
  }

  function skip(g, card) {
    leave(card, () => skipNow(g));
  }
  function skipNow(g) {
    view.skipped = view.skipped.filter((k) => k !== g.key).concat([g.key]);
    view.current = null; view.entering = true;
    P.router.refresh();
  }

  /** גרירה הצידה מדלגת: הכרטיס נוטה עם האצבע, ומעבר לסף — עף מהמסך */
  function swipe(card, onSkip) {
    if (P.kit.reduced()) return;
    let x0 = null, dx = 0, id = null;
    card.addEventListener('pointerdown', (e) => {
      if (e.button || (e.target.closest && e.target.closest('button, input, a, label, .kwedit'))) return;
      x0 = e.clientX; dx = 0; id = e.pointerId;
      try { card.setPointerCapture(id); } catch (err) { /* דפדפן ישן */ }
      card.classList.add('is-drag');
    });
    card.addEventListener('pointermove', (e) => {
      if (x0 == null || e.pointerId !== id) return;
      dx = e.clientX - x0;
      card.style.transform = 'translateX(' + dx.toFixed(1) + 'px) rotate(' + (dx / 26).toFixed(2) + 'deg)';
      card.style.setProperty('--swipe', Math.min(1, Math.abs(dx) / 120).toFixed(2));
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null;
      card.classList.remove('is-drag');
      if (Math.abs(dx) > 120) {
        card.style.transition = 'transform .26s ease-in, opacity .26s';
        card.style.transform = 'translateX(' + Math.sign(dx) * (window.innerWidth * 0.8) + 'px) rotate(' + Math.sign(dx) * 16 + 'deg)';
        card.style.opacity = '0';
        setTimeout(onSkip, 220);
      } else {
        card.style.transition = 'transform .4s ' + P.motion.ease.back;
        card.style.transform = '';
        card.style.setProperty('--swipe', '0');
        setTimeout(() => { card.style.transition = ''; }, 420);
      }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  function pickOther(g, card, anchor) {
    P.ui.pickCategory(anchor, { current: P.cats.OTHER, suggestions: g.suggestions }).then((cat) => { if (cat) commit(g, cat, card, null); });
  }

  function editKeyword(g, anchor) {
    P.ui.popover(anchor, {
      width: 340,
      render: (node, api) => {
        const inp = el('input.input', { value: view.kw[g.key] || g.keyword, 'aria-label': 'מילת מפתח', autofocus: true });
        const save = () => { const v = P.parse.clean(inp.value); if (v) view.kw[g.key] = v; api.close(); P.router.refresh(); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
        node.appendChild(el('div.pop__body', { style: 'padding:14px' }, [
          el('div.lbl', { text: 'המילה שתזהה את בית העסק בפעם הבאה' }),
          inp,
          el('p.dim', { style: 'font-size:var(--fs-micro);margin:8px 0 0;line-height:1.5', text: 'כדאי מילה קצרה שמופיעה תמיד בתיאור, ולא מופיעה אצל עסקים אחרים.' })
        ]));
        node.appendChild(el('div.pop__foot', null, [el('button.btn.btn--primary.btn--sm', { type: 'button', onclick: save }, 'שמירה'), el('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: api.close }, 'ביטול')]));
      }
    });
  }

  /* ---------- מקלדת ---------- */
  function wireKeys(g) {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = (e) => {
      if (!document.querySelector('.tcard') || P.layers.count() || P.ui.popover.isOpen() || P.fx.isActive()) return;
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
      const card = document.querySelector('.tcard');
      const choices = card.querySelectorAll('.choice');
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= choices.length) { e.preventDefault(); choices[n - 1].click(); }
      else if (e.code === 'KeyS' || e.key === 's' || e.key === 'S' || e.key === 'ד') { e.preventDefault(); const cur = queue().find((x) => x.key === view.current); if (cur) skip(cur, card); }
    };
    document.addEventListener('keydown', keyHandler);
  }
  function leaveRoute() { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } }

  /* ---------- סווגו על ידי המנוע ---------- */
  function drawInferred(mount, list) {
    if (!list.length) {
      mount.appendChild(P.ui.card({ body: el('div.done', null, [
        el('div.done__art', null, art.doneArt('accent')),
        el('h2', { text: 'אין הצעות שמחכות' }),
        el('p', { text: 'המנוע משייך לבד רק כשהדמיון לתנועות שכבר סווגו גבוה מאוד. כל מה שהוא שייך יופיע כאן לאישור.' })
      ]) }));
      return;
    }
    const byCat = P.dict();
    list.forEach((t) => { (byCat[t.cat] = byCat[t.cat] || []).push(t.id); });
    mount.appendChild(el('div.callout', { style: 'margin-bottom:16px' }, [
      ic.svg('spark', 18),
      el('div.callout__text', null, [el('b', { text: 'המנוע סיווג ' + fmt.plural(list.length, 'תנועה', 'תנועות', 'תנועה אחת') + ' לבד, ' }), 'לפי דמיון לתנועות שכבר סווגו. אישור הופך אותן לשיוך קבוע; אפשר גם לתקן כל אחת בלחיצה על הקטגוריה שלה.']),
      el('button.btn.btn--primary.btn--sm', { type: 'button', onclick: () => {
        const undos = Object.keys(byCat).map((c) => st.assignUndoable(byCat[c], c).undo);
        P.kit.toast(fmt.plural(list.length, 'שיוך אושר', 'שיוכים אושרו', 'שיוך אחד אושר'), { undo: () => undos.reverse().forEach((u) => u()) });
      } }, [ic.svg('check', 14), 'אישור הכל'])
    ]));
    mount.appendChild(el('section.card.card--clip', null, P.ui.txList(list, { page: 60 })));
  }

  function doneState(inferredCount) {
    return P.ui.card({ body: el('div.done', null, [
      el('div.done__art', null, art.doneArt('pos')),
      el('h2', { text: 'הכל מסודר' }),
      el('p', { text: (view.sorted ? fmt.money(view.sorted) + ' קיבלו מקום. ' : '') + 'כל התנועות נמצאות בקטגוריה, וקבצים חדשים יסווגו לבד לפי הכללים שנוצרו בדרך.' }),
      el('div.row', { style: 'justify-content:center' }, [
        el('button.btn.btn--primary', { type: 'button', onclick: () => P.router.go('#/') }, 'לחודש שלי'),
        inferredCount ? el('button.btn', { type: 'button', onclick: () => { view.tab = 'inferred'; P.router.refresh(); } }, 'לבדוק את ההצעות של המנוע (' + inferredCount + ')') : el('button.btn', { type: 'button', onclick: () => P.router.go('#/categories') }, 'לקטגוריות')
      ])
    ]) });
  }

  return { render: render, leave: leaveRoute, title: 'לשיוך', needsData: true, isSure: isSure };
})();
