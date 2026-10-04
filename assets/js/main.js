/* ==========================================================================
   main.js — הרכבת האפליקציה: שלד, מראה, שמירה, טעינת קבצים וקיצורי מקלדת.
   ========================================================================== */
window.P = window.P || {};

P.app = (function () {
  'use strict';
  const el = P.kit.el, st = P.state, ic = P.icons, fmt = P.fmt;
  let sideEl = null, topEl = null, tabEl = null, mountEl = null, progressEl = null;
  let booted = false, shellSig = '';

  /* ======================================================================
     מראה: מצב בהיר/כהה וצבע מבטא
     ====================================================================== */
  const ACCENTS = [
    { key: 'ink', label: 'דיו ויער', a: '#123536', b: '#277c6a' },
    { key: 'teal', label: 'טורקיז', a: '#07594d', b: '#12a08b' },
    { key: 'amber', label: 'כתום', a: '#93400c', b: '#e2742a' },
    { key: 'violet', label: 'סגול', a: '#41259b', b: '#7c58ea' },
    { key: 'rose', label: 'פטל', a: '#8b2147', b: '#dd4b80' }
  ];
  const prefs = () => st.data.prefs || {};
  function currentTheme() {
    const p = prefs().theme || 'auto';
    if (p !== 'auto') return p;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function currentAccent() { return ACCENTS.some((a) => a.key === prefs().accent) ? prefs().accent : 'ink'; }
  function applyLook() {
    const root = document.documentElement;
    const mode = prefs().theme || 'auto', accent = currentAccent();
    if (mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
    if (accent === 'ink') root.removeAttribute('data-accent'); else root.setAttribute('data-accent', accent);
    // נשמר גם בצד, כדי שבטעינה הבאה הצבע הנכון יופיע מהרגע הראשון
    try { localStorage.setItem('pruta.look', JSON.stringify({ theme: mode, accent: accent, intro: P.fx.introMode() })); } catch (e) { /* אין אחסון */ }
  }
  function setTheme(mode) { st.setPref('theme', mode); applyLook(); }
  function toggleTheme() { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }
  function setAccent(key) { st.setPref('accent', key); applyLook(); }
  function setIntro(mode) { st.setPref('intro', mode); applyLook(); }
  function playIntro() { P.layers.dismissAll(); return P.fx.intro(); }

  function lookPop(anchor) {
    P.ui.popover(anchor, {
      width: 316, placement: 'above',
      render: (node, api) => {
        node.appendChild(el('div.pop__body', { style: 'padding:14px 14px 16px' }, [
          el('div.pop__label', { style: 'padding-inline:2px', text: 'צבע' }),
          el('div.swatches', { role: 'group', 'aria-label': 'צבע מבטא' }, ACCENTS.map((a) => el('button.swatch', {
            type: 'button', 'aria-pressed': a.key === currentAccent() ? 'true' : 'false', vars: { '--sw-a': a.a, '--sw-b': a.b },
            onclick: () => { api.close(); setAccent(a.key); }
          }, [el('i'), a.label]))),
          el('div.pop__label', { style: 'padding:16px 2px 8px', text: 'מצב תצוגה' }),
          P.ui.seg([['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']], prefs().theme || 'auto', (k) => { api.close(); setTheme(k); }, { label: 'מצב תצוגה' })
        ]));
      }
    });
  }

  /* ======================================================================
     שמירה
     ====================================================================== */
  function persist(immediate) {
    if (immediate) return P.store.write(st.snapshot());
    P.store.save(() => st.snapshot());
    return Promise.resolve();
  }

  /* ---------- כשהשמירה לא מצליחה, או כשהנתונים השתנו במקום אחר ---------- */
  let storageProblem = null, retryTimer = null;
  function storageChanged(info) {
    refreshShell();
    if (info.problem === storageProblem) return;
    const before = storageProblem;
    storageProblem = info.problem;
    clearInterval(retryTimer); retryTimer = null;
    if (info.problem === 'offline') {
      P.kit.toast('השמירה לתיקייה לא הצליחה — נראה שחלון ההרצה של פרוטה נסגר. השינויים נשמרים זמנית בדפדפן; הפעילו אותה שוב והם ייכתבו לקובץ.', { icon: 'alert', duration: 12000 });
      // מנסים שוב לבד: ברגע שחלון ההרצה חוזר, הכל נכתב לקובץ
      retryTimer = setInterval(() => { P.store.write(st.snapshot()).catch(() => {}); }, 4000);
    } else if (info.problem === 'stale') staleDialog();
    else if (before === 'offline') P.kit.toast('השמירה לתיקייה חזרה לפעול. הכל נשמר.', { icon: 'check' });
  }
  /** לשונית שנשארה מאחור: לא שומרת יותר, כדי לא לדרוס נתונים חדשים. הדרך היחידה קדימה היא לטעון אותם. */
  let staleOpen = false;
  function staleDialog() {
    if (staleOpen) return;
    staleOpen = true;
    P.layers.dismissAll();
    P.ui.dialog({
      size: 'sm', center: true, alert: true, title: 'הנתונים השתנו בלשונית אחרת',
      body: el('p.muted', { style: 'margin:0', text: 'פרוטה פתוחה גם בלשונית אחרת, ושם נשמרו נתונים חדשים יותר. כדי לא לדרוס אותם, הלשונית הזו הפסיקה לשמור.' }),
      foot: [el('button.btn.btn--primary', { type: 'button', onclick: () => location.reload() }, 'לטעון את הנתונים העדכניים')],
      // נסגר ב-Esc או בלחיצה בחוץ? נפתח שוב: כל עוד הלשונית מאחור, אין מה לעשות בה חוץ מלטעון מחדש
      onClose: () => { staleOpen = false; if (P.store.describe().problem === 'stale') setTimeout(staleDialog, 0); }
    });
  }

  function progress(p) {
    if (!progressEl) return;
    const bar = progressEl.firstElementChild;
    if (p == null) { bar.style.opacity = '0'; setTimeout(() => { if (bar.style.opacity === '0') bar.style.width = '0'; }, 300); return; }
    bar.style.opacity = '1';
    bar.style.width = Math.round(p * 100) + '%';
    if (p >= 1) setTimeout(() => progress(null), 320);
  }

  /* ======================================================================
     שלד: סרגל צד (מחשב), פס עליון וסרגל לשוניות (טלפון)
     ====================================================================== */
  /*
   * שלושה מקומות, וזהו: החודש שלי (מה קורה עכשיו), התוכנית (מה עושים עם זה), לחקור (כל השאר —
   * חודשים, קטגוריות, תנועות ותובנות, שנפתחים מתחת ל"לחקור" כשנמצאים בתוכו). הכלים — שיוך,
   * כללים, הגדרות — בקבוצה שקטה בתחתית, ובטלפון ב"עוד".
   */
  const NAV = [
    { items: [
      { route: 'overview', href: '#/', icon: 'home', label: 'החודש שלי' },
      { route: 'plan', href: '#/plan', icon: 'target', label: 'התוכנית' },
      { route: 'explore', href: '#/explore', icon: 'compass', label: 'לחקור', subs: [
        { route: 'months', href: '#/months', label: 'חודשים' },
        { route: 'categories', href: '#/categories', label: 'קטגוריות' },
        { route: 'transactions', href: '#/transactions', label: 'תנועות' },
        { route: 'insights', href: '#/insights', label: 'תובנות' }
      ] }
    ] },
    { label: 'כלים', tools: true, items: [
      { route: 'assign', href: '#/assign', icon: 'inbox', label: 'לשיוך', badge: true },
      { route: 'rules', href: '#/rules', icon: 'sliders', label: 'כללי סיווג' },
      { route: 'settings', href: '#/settings', icon: 'gear', label: 'הגדרות' },
      { route: 'about', href: '#/about', icon: 'seal', label: 'על פרוטה' }
    ] }
  ];
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');

  function pendingGroups() {
    const keys = new Set();
    st.data.tx.forEach((t) => { if (t.cat === P.cats.OTHER) keys.add(P.learn.merchantKey(t.desc)); });
    return keys.size;
  }

  function brand() {
    return el('a.brand', { href: '#/', 'aria-label': 'פרוטה — לחודש שלי' }, [
      el('span.brand__mark', { 'aria-hidden': 'true' }, P.art.coin()),
      el('span.brand__name', null, [el('b', { text: 'פרוטה' }), el('span', { text: 'כל ההוצאות, בפרוטרוט' })])
    ]);
  }

  function buildShell() {
    const pending = pendingGroups();
    const cur = P.router.current && P.router.current.name;
    const has = st.data.tx.length > 0;
    const info = P.store.describe();
    const meta = st.data.meta || {};

    /* ---------- סרגל צד ---------- */
    sideEl.innerHTML = '';
    sideEl.appendChild(el('span.side__pill.is-instant', { 'aria-hidden': 'true' }));
    sideEl.appendChild(brand());
    sideEl.appendChild(el('button.side__search', { type: 'button', onclick: () => P.palette.open(), 'aria-label': 'חיפוש מהיר' }, [
      ic.svg('search', 16), el('span', { text: 'חיפוש…' }), el('span.kbd', { text: isMac ? '⌘K' : 'Ctrl K' })]));
    NAV.forEach((g) => {
      sideEl.appendChild(el('nav.side__group' + (g.tools ? '.side__group--tools' : ''), { 'aria-label': g.label || 'ניווט ראשי' }, [
        g.label ? el('div.side__label', { text: g.label }) : null
      ].concat(g.items.map((it) => [
        el('a.navlink', { href: it.href, 'data-route': it.route }, [
          ic.svg(it.icon, g.tools ? 17 : 19), el('span', { text: it.label }),
          it.badge && pending ? el('span.navlink__badge', { title: fmt.plural(pending, 'בית עסק', 'בתי עסק', 'בית עסק אחד') + ' מחכים לקטגוריה', text: fmt.count(pending) }) : null
        ]),
        // מתחת ל"לחקור": החלקים שלו — גלויים רק כשנמצאים בתוכו (ראו router.mark)
        it.subs ? el('div.navsub', null, it.subs.map((s) => el('a.navsub__link', { href: s.href, 'data-sub': s.route }, s.label))) : null
      ]))));
    });

    const storageText = info.problem === 'offline' ? 'השמירה נכשלה' : info.problem === 'stale' ? 'לא מעודכן'
      : { server: 'נשמר בתיקייה', folder: 'נשמר בתיקייה', local: 'נשמר בדפדפן', memory: 'לא נשמר' }[info.mode];
    const storageTitle = info.problem === 'offline' ? 'חלון ההרצה של פרוטה לא עונה. השינויים שמורים זמנית בדפדפן.'
      : info.problem === 'stale' ? 'הנתונים השתנו בלשונית אחרת. צריך לטעון מחדש.' : info.label;
    const lookBtn = el('button.btn.btn--ghost.btn--sm.btn--icon', { type: 'button', title: 'צבע ומצב תצוגה', 'aria-label': 'צבע ומצב תצוגה', onclick: () => lookPop(lookBtn) }, ic.svg('palette', 17));
    sideEl.appendChild(el('div.side__foot', null, [
      el('button.btn.btn--primary.btn--block', { type: 'button', onclick: openFilePicker }, [ic.svg('upload', 17), 'טעינת קובץ']),
      has ? el('div.side__acct', null, [
        el('span.avatar', { vars: { '--c': 'var(--accent)', '--s': '36px' }, 'aria-hidden': 'true', text: P.art.initials(meta.client || 'פרוטה') }),
        el('div', { style: 'min-width:0' }, [
          el('b', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: meta.client || fmt.plural(st.data.tx.length, 'תנועה', 'תנועות', 'תנועה אחת') }),
          el('span', { text: meta.account ? 'חשבון ' + meta.account : fmt.plural(st.data.files.length, 'קובץ', 'קבצים', 'קובץ אחד') })
        ])
      ]) : null,
      el('div.side__meta', null, [
        el('a.storage', { href: '#/settings', 'data-mode': info.problem ? 'memory' : info.mode === 'server' ? 'folder' : info.mode, title: storageTitle }, [el('i'), storageText]),
        el('button.btn.btn--ghost.btn--sm.btn--icon', { type: 'button', title: 'מעבר בין בהיר לכהה', 'aria-label': 'מעבר בין בהיר לכהה', onclick: toggleTheme }, ic.svg(currentTheme() === 'dark' ? 'sun' : 'moon', 17)),
        lookBtn
      ])
    ]));

    /* ---------- פס עליון (טלפון) ---------- */
    topEl.innerHTML = '';
    topEl.appendChild(brand());
    topEl.appendChild(el('div.topbar__actions', null, [
      el('button.btn.btn--ghost.btn--icon', { type: 'button', 'aria-label': 'חיפוש', onclick: () => P.palette.open() }, ic.svg('search', 19)),
      el('button.btn.btn--soft.btn--icon', { type: 'button', 'aria-label': 'טעינת קובץ', onclick: openFilePicker }, ic.svg('upload', 19))
    ]));

    /* ---------- סרגל לשוניות (טלפון) ---------- */
    tabEl.innerHTML = '';
    NAV[0].items.forEach((it) => tabEl.appendChild(el('a.tab', { href: it.href, 'data-route': it.route }, [ic.svg(it.icon, 22), el('span', { text: it.label })])));
    tabEl.appendChild(el('button.tab', { type: 'button', 'data-more': '1', onclick: moreSheet }, [
      ic.svg('more', 22), el('span', { text: 'עוד' }), pending ? el('span.tab__badge', { text: fmt.count(pending) }) : null]));
    if (cur) P.router.mark(cur);
  }

  /** בונה מחדש את השלד רק כשמשהו שמוצג בו באמת השתנה */
  function refreshShell(force) {
    if (!sideEl) return;
    const info = P.store.describe(), meta = st.data.meta || {};
    const sig = [pendingGroups(), st.data.tx.length, st.data.files.length, meta.client, meta.account, info.mode, info.problem, currentTheme(), currentAccent()].join('|');
    if (!force && sig === shellSig) return;
    shellSig = sig;
    buildShell();
  }

  function moreSheet() {
    const pending = pendingGroups();
    const row = (icon, label, sub, run, badge) => el('button.lrow', { type: 'button', onclick: run }, [
      el('span.palette__icon', null, ic.svg(icon, 18)),
      el('div.lrow__main', null, [el('div.lrow__title', null, el('span', { text: label })), sub ? el('div.lrow__meta', { text: sub }) : null]),
      badge ? el('span.navlink__badge', { style: 'margin:0', text: badge }) : el('span.lrow__go', null, ic.svg('chevron', 18))
    ]);
    P.ui.sheet({
      size: 'sm', title: 'עוד',
      render: (body) => {
        body.appendChild(el('div.sheet__cover', { style: 'padding-bottom:6px' }, el('h2.sheet__h', { text: 'עוד' })));
        body.appendChild(el('div.list', null, [
          row('inbox', 'לשיוך', pending ? fmt.plural(pending, 'בית עסק', 'בתי עסק', 'בית עסק אחד') + ' מחכים' : 'הכל מסודר', () => P.layers.navigate('#/assign'), pending ? fmt.count(pending) : null),
          row('sliders', 'כללי סיווג', 'מילות מפתח לכל קטגוריה', () => P.layers.navigate('#/rules')),
          row('gear', 'הגדרות', 'מראה, שמירה וגיבוי', () => P.layers.navigate('#/settings')),
          row('seal', 'על פרוטה', 'הסיפור, העיצוב והקרדיטים', () => P.layers.navigate('#/about')),
          row(currentTheme() === 'dark' ? 'sun' : 'moon', currentTheme() === 'dark' ? 'מצב בהיר' : 'מצב כהה', null, toggleTheme)
        ]));
      }
    });
  }

  /* ======================================================================
     טעינת קבצים
     ====================================================================== */
  function openFilePicker() { document.getElementById('file-input').click(); }

  /** קורא קובץ לפי התוכן שלו, לא לפי הסיומת (ראו lib/sniff.js) */
  async function readFile(file) {
    return P.files.read(file.name, await file.arrayBuffer());
  }

  /** גיליונות שיש בהם תנועות: זוהו תאריך וסכום, ונבנית מהם לפחות תנועה אחת */
  function sheetsWithData(sheets) {
    return sheets.filter((sh) => {
      try {
        const a = P.detect.analyze(sh.rows);
        if (a.mapping.date == null || (a.mapping.amount == null && a.mapping.debit == null && a.mapping.credit == null)) return false;
        return P.parse.build(sh.rows, a.profile.headerRow, a.mapping, a.options).tx.length > 0;
      } catch (e) { return false; }
    });
  }

  /** בוחר את הגיליון עם הכי הרבה שורות נתונים שניתן לזהות */
  function bestSheet(sheets) {
    let best = { index: 0, analysis: null, count: -1 };
    sheets.forEach((sh, i) => {
      let a;
      try { a = P.detect.analyze(sh.rows); } catch (e) { return; }
      const n = a.profile.bodyCount || 0;
      const usable = a.mapping.date != null && (a.mapping.amount != null || a.mapping.debit != null || a.mapping.credit != null);
      const score = usable ? n + 1000 : n;
      if (score > best.count) best = { index: i, analysis: a, count: score };
    });
    return best;
  }

  /**
   * שלוש דרכים, מהמהירה לאיטית:
   *   1. מבנה שכבר מיפיתם פעם — נקלט מיד לפי המיפוי השמור.
   *   2. מבנה שזוהה בביטחון (כותרות מוכרות, סימן חיוב ודאי) — נקלט מיד.
   *   3. כל השאר — חלון המיפוי, עם ניחוש מוכן לאישור.
   */
  async function ingest(input, forceWizard) {
    const sheets = input.sheets;
    if (!sheets || !sheets.length) throw new Error('הקובץ ריק');
    const best = bestSheet(sheets);
    const a = best.analysis;
    const rows = sheets[best.index].rows;
    const saved = a ? st.getProfile(a.signature) : null;
    // היתרה שכבר ידועה מלפני הדוח הזה (מהחודש הקודם) נותנת גם לשורה הראשונה שלו יתרה להשוות אליה
    const withPast = (options) => Object.assign({}, options, { balanceBefore: st.balanceBefore });

    if (!forceWizard && saved && saved.mapping) {
      const headerRow = typeof saved.headerRow === 'number' ? saved.headerRow : a.profile.headerRow;
      try {
        const res = P.parse.build(rows, headerRow, saved.mapping, withPast(saved.options));
        // תנועה שהכיוון שלה הוערך (ולא נקרא מהקובץ) לא נקלטת בשקט — חלון המיפוי מציג אותה לאישור
        if (res.tx.length && !res.unsure.length) return { tx: res.tx, meta: P.parse.meta(rows, headerRow), skipped: res.skipped, mapping: saved.mapping, remembered: true,
          kind: P.detect.fileKind(P.detect.profile(rows, headerRow), saved.mapping, saved.options) };
      } catch (e) { /* המיפוי השמור כבר לא מתאים — ממשיכים */ }
    }
    if (!forceWizard && a && P.detect.confident(a)) {
      try {
        const res = P.parse.build(rows, a.profile.headerRow, a.mapping, withPast(a.options));
        if (res.tx.length && res.skipped <= Math.max(2, res.tx.length * 0.08) && !res.unsure.length) {
          return { tx: res.tx, meta: P.parse.meta(rows, a.profile.headerRow), skipped: res.skipped, mapping: a.mapping, auto: true,
            kind: P.detect.fileKind(a.profile, a.mapping, a.options) };
        }
      } catch (e) { /* נפתח את חלון המיפוי */ }
    }
    progress(null);
    return P.importer.open({ fileName: input.name, sheets: sheets, startSheet: best.index });
  }

  /** inputs: [{ name, sheets }] */
  async function importInputs(inputs, opts) {
    const o = opts || {};
    const res = { files: [], added: 0, duplicates: 0, ids: new Set(), redo: null };
    const failures = (o.failures || []).slice();
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      progress((i + 0.3) / inputs.length);
      try {
        const out = await ingest(input, o.forceWizard);
        if (!out) continue;                                   // בוטל בחלון המיפוי
        if (o.replace) st.removeTransactions(o.replace.ids, o.replace.name);   // מיפוי מחדש: הקליטה הקודמת מוחלפת
        const before = new Set(st.data.tx.map((t) => t.id));
        const r = st.addTransactions(out.tx, out.meta, input.name, { skippedRows: out.skipped, mapped: Object.keys(out.mapping || {}).length, kind: out.kind || 'account' });
        out.tx.forEach((t) => { if (!before.has(t.id)) res.ids.add(t.id); });
        res.added += r.added; res.duplicates += r.duplicates;
        res.files.push({ name: input.name, file: input.file || input.name, auto: !!out.auto, remembered: !!out.remembered, added: r.added });
      } catch (e) {
        console.error(e);
        failures.push(input.name + ' — ' + (e && e.message ? e.message : 'שגיאה לא צפויה'));
      }
      progress((i + 1) / inputs.length);
    }

    if (res.added) {
      await persist(true).catch(() => {});
      if (P.pages.overview.reset) P.pages.overview.reset();
      refreshShell();
      P.router.resolve({ instant: true });
      // קליטה אוטומטית של קובץ יחיד: אם משהו נראה לא נכון, אפשר לבטל ולמפות ידנית
      const f = res.files[0];
      if (res.files.length === 1 && (f.auto || f.remembered)) {
        const input = inputs.find((x) => x.name === f.name);
        const ids = new Set(res.ids);
        res.redo = () => importInputs([input], { forceWizard: true, replace: { ids: ids, name: f.name } });
      }
      progress(null);
      await P.fx.importSequence(res);        // התנועות "נופלות" לקטגוריות שלהן
      await finishedMonthStory(res);         // החודש השלם האחרון בדוח — הסיפור שלו, מיד
      P.views.importSummary(res);            // ואז הסיכום
    } else if (res.duplicates) {
      P.kit.toast('כל ' + fmt.count(res.duplicates) + ' התנועות בקובץ כבר קיימות — לא נוסף דבר');
    }
    if (failures.length) {
      P.ui.dialog({ size: 'sm', title: 'לא הצלחתי לקרוא', body: el('div.stack', { style: 'gap:10px' }, [
        el('p.muted', { style: 'margin:0', text: inputs.length > failures.length ? 'שאר הקבצים נקלטו כרגיל.' : 'אפשר לנסות קובץ אחר, או לשמור את הקובץ מחדש כ-xlsx או כ-csv.' }),
        el('ul', { style: 'margin:0;padding-inline-start:20px;font-size:var(--fs-small);color:var(--ink-2)' }, failures.map((t) => el('li', { text: t })))
      ]) });
    }
    progress(null);
    return res;
  }

  /**
   * דוח חדש: קודם הסיפור, אחר כך הלוח. החודש השלם האחרון שהדוח הביא מקבל את הסיפור שלו מיד אחרי
   * הקליטה — בפעם הראשונה בלבד (לפי הגדרת ההדמיות), ורק כשיש בו הוצאות.
   */
  function finishedMonthStory(res) {
    if (!P.stories || !res.ids.size) return Promise.resolve();
    const keys = Array.from(new Set(st.data.tx.filter((t) => res.ids.has(t.id) && t.amount < 0).map((t) => t.date.slice(0, 7)))).sort().reverse();
    const key = keys.find((k) => !st.coverage(k).partial);
    if (!key || !P.stories.firstTime('m:' + key)) return Promise.resolve();
    return P.stories.month(key);
  }

  async function importFiles(files) {
    const inputs = [], failures = [];
    for (let i = 0; i < files.length; i++) {
      progress((i + 0.5) / (files.length * 2));
      try {
        // קובץ שיש בו כמה טבלאות של תנועות — בכמה גיליונות, או זו מתחת לזו באותו גיליון (עסקאות בארץ
        // ועסקאות בחו"ל, שנה בכל גיליון): כל אחת מהן נקלטת עם הכותרות שלה, ולא רק הגדולה.
        // גיליונות בלי תנועות (שער, הסברים) לא משתתפים.
        const read = await readFile(files[i]);
        const sheets = [];
        read.forEach((sh) => {
          const parts = P.detect.tables(sh.rows);
          parts.forEach((rows, k) => sheets.push({ rows: rows, name: parts.length === 1 ? sh.name : (read.length > 1 ? sh.name + ' · ' : '') + 'טבלה ' + (k + 1) }));
        });
        const full = sheets.length > 1 ? sheetsWithData(sheets) : [];
        if (full.length > 1) full.forEach((sh) => inputs.push({ name: files[i].name + ' · ' + sh.name, file: files[i].name, sheets: [sh] }));
        else inputs.push({ name: files[i].name, sheets: sheets });
      } catch (e) { failures.push(files[i].name + ' — ' + (e && e.message ? e.message : 'לא ניתן לקרוא את הקובץ')); }
    }
    return importInputs(inputs, { failures: failures });
  }

  /* ======================================================================
     גיבוי ושחזור
     ====================================================================== */
  function backup() {
    const blob = new Blob([JSON.stringify(Object.assign({ app: 'pruta', version: 3 }, st.snapshot()), null, 1)], { type: 'application/json' });
    P.kit.download(blob, 'pruta-backup-' + new Date().toISOString().slice(0, 10) + '.json');
    P.kit.toast('קובץ הגיבוי ירד לתיקיית ההורדות');
  }
  function restore() {
    const input = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const f = input.files[0];
      input.remove();
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!Array.isArray(data.tx)) throw new Error('הקובץ אינו גיבוי של פרוטה');
        st.hydrate(data);
        applyLook();
        await persist(true);
        if (P.pages.overview.reset) P.pages.overview.reset();
        refreshShell(true);
        P.router.resolve();
        P.kit.toast('שוחזרו ' + fmt.plural(data.tx.length, 'תנועה', 'תנועות', 'תנועה אחת'));
      } catch (e) { P.kit.toast('השחזור נכשל: ' + e.message, { icon: 'alert' }); }
    });
    input.click();
  }

  /* ======================================================================
     גרירה וקיצורי מקלדת
     ====================================================================== */
  function wireDrop() {
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1;
    const hot = (on) => {
      const z = document.getElementById('dropzone');
      if (z) z.classList.toggle('is-hot', on);
      document.body.classList.toggle('is-dragging', on && !z);
    };
    document.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; hot(true); });
    document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    document.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; if (--depth <= 0) { depth = 0; hot(false); } });
    document.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; hot(false);
      if (e.dataTransfer.files.length) importFiles(Array.prototype.slice.call(e.dataTransfer.files));
    });
  }

  function wireKeys() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K')) { e.preventDefault(); P.palette.toggle(); return; }
      const t = e.target;
      const typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/' && !P.layers.count()) { e.preventDefault(); P.palette.open(); }
    });
  }

  /* ======================================================================
     אתחול
     ====================================================================== */
  async function boot() {
    if (booted) return; booted = true;
    sideEl = document.getElementById('side');
    topEl = document.getElementById('topbar');
    tabEl = document.getElementById('tabbar');
    mountEl = document.getElementById('view');
    progressEl = document.getElementById('progress');

    let data = {}, damaged = false;
    try { data = await P.store.init(); } catch (e) { /* ממשיכים ריק */ }
    // נתונים שמורים פגומים לא מפילים את האפליקציה: מתחילים ריק, ואפשר לשחזר מגיבוי
    try { st.hydrate(data && !data.cleared ? data : {}); }
    catch (e) { console.error(e); damaged = true; st.hydrate({}); }
    applyLook();
    refreshShell(true);
    P.router.start(mountEl);
    wireDrop();
    wireKeys();

    document.getElementById('file-input').addEventListener('change', (e) => {
      const files = Array.prototype.slice.call(e.target.files);
      e.target.value = '';
      if (files.length) importFiles(files);
    });

    // כל שינוי בנתונים: שמירה, ואז רענון אחד של השלד, העמוד והחלונות הפתוחים
    const repaint = P.kit.debounce(() => { refreshShell(); P.router.refresh(); P.layers.refreshAll(); }, 30);
    st.subscribe(() => { persist(); repaint(); });
    P.store.onChange(storageChanged);
    // לשונית אחרת של פרוטה שמרה נתונים: מציגים אותם גם כאן (בלי לשמור שוב — אלה כבר הנתונים השמורים)
    P.store.onExternal((fresh) => {
      try { st.hydrate(fresh && !fresh.cleared ? fresh : {}); } catch (e) { console.error(e); return; }
      P.layers.dismissAll();
      applyLook();
      if (P.pages.overview.reset) P.pages.overview.reset();
      refreshShell(true);
      P.router.resolve({ instant: true });
      P.kit.toast('הנתונים עודכנו לפי לשונית אחרת של פרוטה.', { icon: 'check' });
    });
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onScheme = () => refreshShell();
      if (mq.addEventListener) mq.addEventListener('change', onScheme); else if (mq.addListener) mq.addListener(onScheme);
    }

    // הפתיח: רץ מעל האתר שכבר מוכן מתחתיו, ובסופו המטבע נוחת על הסמל שבפינה
    if (P.fx.shouldPlayIntro()) { P.fx.markIntroSeen(); P.fx.intro(); }
    else document.documentElement.classList.remove('intro-pending');

    if (damaged) P.kit.toast('הנתונים השמורים לא נקראו כראוי. אפשר לשחזר מגיבוי בעמוד ההגדרות.', { icon: 'alert', duration: 9000 });
    const stored = P.store.describe();
    if (stored.notice && stored.notice.kind === 'damaged') {
      P.kit.toast('קובץ הנתונים היה פגום ולא נקרא. הוא לא נמחק — הוא שמור בצד (' + stored.notice.file + '), ואפשר לשחזר מגיבוי בעמוד ההגדרות.', { icon: 'alert', duration: 14000 });
    }
    if (stored.restored) {
      // שינויים מהפעם הקודמת שלא הגיעו לקובץ (חלון ההרצה נסגר באמצע): הם כבר על המסך, ועכשיו נכתבים לקובץ
      persist(true).then(() => P.kit.toast('שוחזרו שינויים שלא הספיקו להישמר בפעם הקודמת.', { icon: 'check', duration: 7000 })).catch(() => {});
    }
    if (!P.zip.supported()) P.kit.toast('הדפדפן הזה לא יודע לפתוח xlsx. אפשר לטעון csv, או לעבור לדפדפן עדכני.', { icon: 'alert', duration: 8000 });
    document.documentElement.classList.add('is-ready');
  }

  return {
    boot, importFiles, importInputs, openFilePicker, persist, progress, readFile,
    setTheme, toggleTheme, currentTheme, setAccent, currentAccent, applyLook, ACCENTS, setIntro, playIntro,
    backup, restore, refreshShell
  };
})();

document.addEventListener('DOMContentLoaded', P.app.boot);
