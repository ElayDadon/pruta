/* ==========================================================================
   pages/settings.js — הגדרות
   מראה (צבע ומצב), איפה הנתונים נשמרים, גיבוי ושחזור, הסיווג החכם,
   מבני קבצים שנזכרו, היסטוריית טעינה, ומחיקה.
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.settings = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt, st = P.state, ic = P.icons;

  const SOURCES = [
    ['manual', 'שיוך ידני', 'var(--accent)'],
    ['file', 'קטגוריה מהקובץ', 'var(--c7)'],
    ['rule', 'כלל מילת מפתח', 'var(--c2)'],
    ['inferred', 'הוצע על ידי המנוע', 'var(--c5)'],
    ['none', 'ממתין לשיוך', 'var(--mark)']
  ];

  function render(params, mount) {
    const info = P.store.describe();
    mount.appendChild(P.ui.pageHead('הגדרות', 'הכל נשאר במחשב הזה. אין חשבון, אין שרת מרוחק, ואין שום בקשה לרשת.'));
    const wrap = el('div.settings');

    /* ---------- מראה ---------- */
    const accent = P.app.currentAccent();
    const theme = st.data.prefs.theme || 'auto';
    wrap.appendChild(group('מראה', [
      srow('צבע', 'צבע המבטא של הכפתורים, הכותרת והחותמות. צבעי הקטגוריות לא משתנים.',
        el('div.swatches', { role: 'group', 'aria-label': 'צבע מבטא' }, P.app.ACCENTS.map((a) => el('button.swatch', {
          type: 'button', 'aria-pressed': a.key === accent ? 'true' : 'false', vars: { '--sw-a': a.a, '--sw-b': a.b }, onclick: () => P.app.setAccent(a.key)
        }, [el('i'), a.label])))),
      srow('בהיר או כהה', 'אוטומטי הולך לפי הגדרת המערכת.',
        P.ui.seg([['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']], theme, (k) => P.app.setTheme(k), { label: 'מצב תצוגה', lg: true })),
      srow('פתיח', '15 שניות של תנועה שמספרות מה פרוטה עושה. כברירת מחדל הוא מוצג בביקור הראשון בלבד; אפשר לדלג בכל רגע.', [
        P.ui.seg([['first', 'בביקור הראשון'], ['session', 'פעם בביקור'], ['always', 'בכל פתיחה'], ['off', 'כבוי']], P.fx.introMode(), (k) => P.app.setIntro(k), { label: 'פתיח', lg: true }),
        el('button.btn.btn--soft', { type: 'button', onclick: () => P.app.playIntro() }, [ic.svg('spark', 16), 'לצפות עכשיו'])
      ]),
      srow('הדמיות', 'כל מקום מציג את עצמו בפעם הראשונה שמגיעים אליו: חודש שנפתח — הסיפור שלו; עמוד החודשים — סיפור השנה; ההוצאות הקבועות — השנה הקרובה שלהן; וכשבית העסק האחרון מקבל קטגוריה — "הכל מסודר". אפשר לדלג בכל רגע.', [
        P.motion.reduced() ? el('p.dim', { style: 'margin:0;font-size:var(--fs-small)', text: 'כבויות: מערכת ההפעלה מבקשת פחות תנועה.' })
          : P.ui.seg([['first', 'בפעם הראשונה'], ['always', 'בכל פעם'], ['off', 'כבוי']], P.stories.mode(), (k) => st.setPref('stories', k), { label: 'הדמיות', lg: true }),
        P.motion.reduced() || !st.data.tx.length ? null : el('div.row', null, [
          P.stories.button('סיפור החודש', () => P.stories.month(P.insights.focusMonth()), 'btn--soft'),
          st.months().length >= 2 ? P.stories.button('סיפור השנה', () => P.stories.year(), 'btn--soft') : null,
          P.stories.canRecurring() ? P.stories.button('הקבועות של השנה הקרובה', () => P.stories.recurring(), 'btn--soft') : null
        ]),
        !P.motion.reduced() && (st.data.prefs.seen || []).length ? el('button.card__more', { type: 'button', onclick: () => {
          const was = st.data.prefs.seen;
          st.setPref('seen', []);
          P.kit.toast('ההדמיות יוצגו שוב בפעם הבאה שמגיעים לכל מקום', { undo: () => st.setPref('seen', was) });
        } }, 'להציג שוב את כולן, מההתחלה') : null
      ])
    ]));

    /* ---------- נתונים ---------- */
    const where = {
      server: 'כל שינוי נכתב מיד לקובץ data/' + P.store.FILE + ' בתיקיית האפליקציה, עם גיבויים מתחלפים.',
      folder: 'כל שינוי נכתב לקובץ ' + P.store.FILE + ' בתיקייה שבחרת.',
      local: 'כרגע הנתונים בזיכרון הדפדפן במחשב הזה. כדי שיישמרו כקובץ בתיקיית האפליקציה, הפעילו אותה דרך קובץ ההפעלה (start), או בחרו תיקייה.',
      memory: 'אין אחסון קבוע. הורידו גיבוי לפני סגירת החלון.'
    }[info.mode];
    wrap.appendChild(group('הנתונים שלך', [
      srow('איפה זה נשמר', 'מיקום הקובץ שבו יושבות התנועות, הכללים והשיוכים.', [
        el('span.storage', { 'data-mode': info.mode === 'server' || info.mode === 'folder' ? 'folder' : info.mode, style: 'font-size:var(--fs-small);color:var(--ink)' }, [el('i'), info.label]),
        el('p.dim', { style: 'margin:0;font-size:var(--fs-tiny);line-height:1.6;max-width:60ch', text: where }),
        info.mode !== 'server' && info.canPickFolder ? el('button.btn', { type: 'button', onclick: pickFolder }, [ic.svg('folder', 16), info.mode === 'folder' ? 'בחירת תיקייה אחרת' : 'בחירת תיקייה לשמירה']) : null
      ]),
      srow('גיבוי ושחזור', 'קובץ אחד שמכיל הכל. שימושי למעבר בין מחשבים.', [
        el('div.row', null, [
          el('button.btn.btn--primary', { type: 'button', onclick: () => P.app.backup() }, [ic.svg('download', 16), 'הורדת גיבוי']),
          el('button.btn', { type: 'button', onclick: () => P.app.restore() }, [ic.svg('upload', 16), 'שחזור מגיבוי'])
        ]),
        el('dl.kv', null, [
          el('dt', { text: 'תנועות' }), el('dd', { text: fmt.count(st.data.tx.length) }),
          el('dt', { text: 'קטגוריות' }), el('dd', { text: fmt.count(Object.keys(st.data.rules).length) }),
          el('dt', { text: 'שיוכים ידניים' }), el('dd', { text: fmt.count(Object.keys(st.data.overrides).length) }),
          el('dt', { text: 'נשמר לאחרונה' }), el('dd', { text: info.lastSaved ? fmt.relative(info.lastSaved) : '—' })
        ])
      ])
    ]));

    /* ---------- סיווג חכם ---------- */
    const inferOn = st.data.prefs.infer !== false;
    const src = st.sources();
    const totalTx = st.data.tx.length;
    const sw = el('button.switch', { type: 'button', role: 'switch', 'aria-checked': inferOn ? 'true' : 'false', 'aria-label': 'סיווג חכם',
      onclick: () => { st.setPref('infer', !inferOn); P.kit.toast(inferOn ? 'הסיווג החכם כבוי' : 'הסיווג החכם פעיל'); } });
    wrap.appendChild(group('סיווג', [
      srow('סיווג חכם', 'כשאין כלל מתאים, המנוע משווה את התיאור לתנועות שכבר סווגו ומשלים לבד כשהביטחון גבוה.', [
        el('label.check', null, [sw, el('span', { text: inferOn ? 'פעיל' : 'כבוי' })])
      ]),
      totalTx ? srow('איך סווגו התנועות', 'לחיצה על שורה מציגה את התנועות שלה.', [
        el('div.srcbar', { role: 'img', 'aria-label': 'חלוקת התנועות לפי מקור הסיווג' }, SOURCES.map(([k, , c]) => (src[k] ? el('i', { style: 'flex:' + src[k] + ' 0 0;background:' + c }) : null))),
        el('div.srclist', null, SOURCES.map(([k, label, c]) => el('button.srclist__row', { type: 'button', disabled: src[k] ? null : true,
          onclick: () => P.router.go('#/transactions?source=' + (k === 'none' ? 'pending' : k)) }, [
          el('i', { style: 'background:' + c }), el('span', { text: label }), el('span.spacer'),
          el('b', { text: fmt.count(src[k] || 0) }), el('span.dim', { text: fmt.pct((src[k] || 0) / totalTx) })
        ])))
      ]) : null
    ]));

    /* ---------- קבצים ---------- */
    const profiles = Object.keys(st.data.profiles || {});
    const fileRows = [];
    if (profiles.length) fileRows.push(srow('מבני קבצים שנזכרו', 'קובץ באותו מבנה ייקלט בלי לשאול שוב.', profiles.map((sig) => {
      const pr = st.data.profiles[sig];
      return el('div.filerow', null, [
        ic.svg('file', 18),
        el('div', { style: 'min-width:0;flex:1' }, [
          el('b', { text: pr.name || 'מבנה שמור' }),
          el('span', { text: fmt.plural(Object.keys(pr.mapping || {}).length, 'עמודה ממופה', 'עמודות ממופות', 'עמודה ממופה אחת') + (pr.at ? ' · ' + fmt.relative(pr.at) : '') })
        ]),
        el('button.btn.btn--sm.btn--ghost', { type: 'button', onclick: () => {
          const keep = st.data.profiles[sig];
          delete st.data.profiles[sig]; st.changed('profile');
          P.kit.toast('המבנה נשכח. בפעם הבאה ייפתח חלון המיפוי.', { undo: () => { st.data.profiles[sig] = keep; st.changed('profile'); } });
        } }, 'לשכוח')
      ]);
    })));
    if (st.data.files.length) fileRows.push(srow('קבצים שנטענו', 'הטעינות האחרונות. תנועה שכבר קיימת לא נספרת פעמיים.', st.data.files.slice(0, 8).map((f) => el('div.filerow', null, [
      ic.svg(f.kind === 'card' ? 'wallet' : 'file', 18),
      el('div', { style: 'min-width:0;flex:1' }, [
        el('b', { text: f.name }),
        el('span', { text: fmt.plural(f.added, 'תנועה', 'תנועות', 'תנועה אחת') + (f.skipped ? ' · ' + fmt.count(f.skipped) + ' כפולות דולגו' : '') + ' · ' + fmt.relative(f.at) })
      ])
    ]))));
    if (fileRows.length) wrap.appendChild(group('קבצים', fileRows));

    /* ---------- מחיקה ---------- */
    wrap.appendChild(group('אזור רגיש', [
      srow('מחיקת כל הנתונים', 'מוחק את התנועות, השיוכים והכללים מהמחשב הזה. אי אפשר לבטל — כדאי להוריד גיבוי קודם.',
        el('button.btn.btn--danger', { type: 'button', onclick: wipe }, [ic.svg('trash', 16), 'מחיקת הכל']))
    ]));

    mount.appendChild(wrap);
    mount.appendChild(el('p.dim', { style: 'margin:22px 4px 0;font-size:var(--fs-tiny);display:flex;gap:16px;flex-wrap:wrap' }, [
      el('span', null, [el('span.kbd', { text: 'Ctrl' }), ' ', el('span.kbd', { text: 'K' }), ' חיפוש מהיר']),
      el('span', null, [el('span.kbd', { text: 'Esc' }), ' סגירת חלון']),
      el('span', { text: 'כפתור "אחורה" של הדפדפן סוגר את החלון העליון' })
    ]));
  }

  function group(title, rows) {
    return el('section', null, [
      el('h2.settings__title', { text: title }),
      el('div.card', null, rows.filter(Boolean))
    ]);
  }
  function srow(title, desc, ctl) {
    return el('div.srow', null, [
      el('div', null, [el('h3', { text: title }), el('p', { text: desc })]),
      el('div.srow__ctl', null, ctl)
    ]);
  }

  function pickFolder() {
    P.store.pickFolder()
      .then(() => P.app.persist(true))
      .then(() => { P.kit.toast('מעכשיו הנתונים נשמרים בקובץ ' + P.store.FILE + ' בתיקייה שבחרת'); P.router.refresh(); })
      .catch((e) => { if (e && e.name !== 'AbortError') P.kit.toast(e.message || 'בחירת התיקייה בוטלה', { icon: 'alert' }); });
  }

  function wipe() {
    P.kit.confirmBox('למחוק את כל הנתונים?',
      'כל התנועות, השיוכים והכללים יימחקו מהמחשב הזה. הפעולה לא ניתנת לביטול.',
      'מחיקת הכל', async () => {
        st.wipe(); st.resetRules();
        await P.store.clear();
        const saved = await P.app.persist(true).then(() => true, () => false);
        P.router.go('#/');
        P.kit.toast(saved ? 'הנתונים נמחקו' : 'הנתונים נמחקו מהמסך, אבל השמירה לא הצליחה', saved ? undefined : { icon: 'alert' });
      }, true);
  }

  return { render: render, title: 'הגדרות' };
})();
