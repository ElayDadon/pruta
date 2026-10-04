/* ==========================================================================
   pages/welcome.js — עמוד הפתיחה, כשעוד אין נתונים
   ---------------------------------------------------------------------------
   עמוד נחיתה של ממש: כותרת וקולאז' צילומים שזז אחרי הסמן, רצועת קטגוריות
   שנעה, שלושה שלבים, גלריה של 12 החודשים המעוצבים, ושלוש הבטחות.
   כל המסך הוא גם אזור גרירה: קובץ שנגרר לכאן נקלט מיד.
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.welcome = (function () {
  'use strict';
  const el = P.kit.el, ic = P.icons, art = P.art, fmt = P.fmt;

  const CATS = ['מזון ומכולת', 'מסעדות וקפה', 'תחבורה ודלק', 'דיור ושכירות', 'קניות וביגוד', 'בילויים ופנאי', 'נסיעות וחופשות',
    'מנויים ודיגיטל', 'חשבונות ותשתיות', 'בריאות ותרופות', 'ספורט וכושר', 'חינוך וילדים', 'חיות מחמד', 'מתנות ותרומות'];
  const TINTS = ['var(--c2)', 'var(--c3)', 'var(--c5)', 'var(--c1)', 'var(--c7)', 'var(--c4)', 'var(--c6)', 'var(--c8)', 'var(--x4)', 'var(--x5)', 'var(--x1)', 'var(--x3)', 'var(--x6)', 'var(--x2)'];

  function render(params, mount) {
    mount.appendChild(hero());
    mount.appendChild(P.studio.localGuide());
    mount.appendChild(marquee());
    mount.appendChild(el('div.wsteps', null, [
      step('export', '1', 'מורידים את הדוח', 'באפליקציה של הבנק: "דוח תנועות בחשבון" ← ייצוא לאקסל. מתאים גם לפירוט כרטיס אשראי.'),
      step('drop', '2', 'טוענים אותו לכאן', 'המנוע מזהה לבד איפה התאריך, התיאור והסכום, ומסווג כל תנועה לפי מילות מפתח ולפי מה שכבר למד.'),
      step('see', '3', 'רואים את התמונה', 'סיכום במילים לכל חודש, קטגוריות ובתי עסק, הוצאות קבועות וחיובים חריגים.')
    ]));
    mount.appendChild(months());
    mount.appendChild(promises());
    mount.appendChild(el('footer.landing-foot', { 'data-reveal': '' }, [
      el('span', null, [art.coin(22), ' פרוטה ועוד פרוטה מצטרפות לחשבון גדול.']),
      el('span.spacer'),
      el('button.card__more', { type: 'button', onclick: () => P.app.playIntro() }, [ic.svg('spark', 15), 'לצפות שוב בפתיח']),
      el('a.card__more', { href: '#/about' }, ['על פרוטה והעיצוב שלה', ic.svg('chevron', 15)])
    ]));
  }

  /* ---------- הכותרת והקולאז' ---------- */
  function hero() {
    const photo = (name, cls, cat, label, amount, tint) => el('figure.collage__card.' + cls, null, [
      el('img', { src: P.posters.life(name), alt: '', decoding: 'async', draggable: 'false' }),
      el('figcaption', null, [art.tile(cat, 28, tint), el('span', { text: label }), el('b.fig', { text: fmt.money(amount) })])
    ]);
    const collage = el('div.collage', { 'aria-hidden': 'true' }, [
      el('div.collage__seal', null, art.seal({ seed: 42, color: 'var(--accent)', width: 0.45, petals: 11, quality: 'lo' })),
      photo('beach', 'collage__card--a', 'נסיעות וחופשות', 'חופשה', 2340, 'var(--c6)'),
      photo('coffee', 'collage__card--b', 'מסעדות וקפה', 'קפה', 14, 'var(--c3)'),
      photo('market', 'collage__card--c', 'מזון ומכולת', 'סופר', 212, 'var(--c2)'),
      el('div.collage__stat', null, [
        el('span', { text: 'ספטמבר · יצא' }),
        el('b.fig', { text: '₪16,559' }),
        el('div.compbar', null, [['var(--c1)', 37], ['var(--c2)', 23], ['var(--c3)', 11], ['var(--c5)', 7], ['var(--c4)', 7], ['var(--c-rest)', 15]].map((c) => el('i', { vars: { '--c': c[0] }, style: 'flex-grow:' + c[1] }))),
        el('span.delta.delta--good', { text: '▼ 14% לעומת אוגוסט' })
      ]),
      el('div.collage__coin', null, art.coin(74))
    ]);

    const node = el('section.landing-hero', { id: 'dropzone' }, [
      art.band({ color: 'var(--accent)', lines: 16, seed: 11, width: 1400, height: 620, strokeWidth: 0.55, cls: 'landing-hero__band' }),
      el('div.landing-hero__text', null, [
        el('span.welcome__kicker', null, [ic.svg('lock', 15), 'פרטי לגמרי · רץ רק על המחשב שלך']),
        el('h1.welcome__title', null, ['לאן הולך הכסף?', el('br'), el('span.welcome__accent', { text: 'מכאן, רואים ברור.' })]),
        el('p.welcome__lead', { text: 'פרוטה קוראת את דוח התנועות מהבנק או מכרטיס האשראי, ומחזירה תמונה מסודרת: כל חודש בעיצוב משלו, לאן הלך הכסף, מה השתנה ומה חוזר. בלי חשבון, בלי ענן.' }),
        el('div.welcome__cta', null, [
          el('button.btn.btn--primary.btn--lg', { type: 'button', onclick: () => P.app.openFilePicker() }, [ic.svg('upload', 18), 'לייבא דוח ולהתחיל']),
          el('button.btn.btn--lg', { type: 'button', onclick: () => {
            const steps = document.querySelector('.wsteps');
            if (steps) steps.scrollIntoView({ behavior: P.motion.reduced() ? 'auto' : 'smooth', block: 'center' });
          } }, 'איך מוציאים את הדוח מהבנק')
        ]),
        el('p.welcome__note', null, [ic.svg('file', 16), 'או לגרור את הקובץ לכאן · אקסל או CSV, כמה קבצים יחד'])
      ]),
      collage
    ]);

    // הקולאז' זז מעט אחרי הסמן — כל שכבה בעומק אחר
    if (!P.motion.reduced()) {
      let raf = 0;
      node.addEventListener('pointermove', (e) => {
        const r = node.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { collage.style.setProperty('--px', px.toFixed(3)); collage.style.setProperty('--py', py.toFixed(3)); });
      });
      node.addEventListener('pointerleave', () => { collage.style.setProperty('--px', '0'); collage.style.setProperty('--py', '0'); });
    }
    return node;
  }

  /* ---------- רצועת הקטגוריות ---------- */
  function marquee() {
    const items = () => CATS.map((c, i) => el('span.marquee__item', { vars: { '--c': TINTS[i] } }, [art.tile(c, 30, TINTS[i]), c]));
    return el('section.marquee', { 'aria-label': 'קטגוריות שהמנוע מזהה לבד' }, [
      el('div.marquee__track', null, [el('div.marquee__set', null, items()), el('div.marquee__set', { 'aria-hidden': 'true' }, items())])
    ]);
  }

  function step(kind, n, title, text) {
    return el('div.wstep', { 'data-reveal': '' }, [
      el('div.wstep__art', null, art.stepArt(kind)),
      el('div.wstep__n', { text: 'שלב ' + n }),
      el('h3', { text: title }),
      el('p', { text: text })
    ]);
  }

  /* ---------- 12 החודשים ---------- */
  function months() {
    const order = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
    const cards = () => order.map((m) => el('div.mstrip__card', null, P.posters.month(m, { size: 'card', label: true, eager: true })));
    return el('section.landing-sec', null, [
      el('div.landing-sec__head', { 'data-reveal': '' }, [
        el('h2', { text: 'כל חודש בעיצוב משלו' }),
        el('p', { text: 'שנים-עשר פוסטרים: צילום עונתי, פלטה ומילה לכל חודש. הכותרת, הכרטיסים והחלונות מתלבשים בחודש שמסתכלים עליו.' })
      ]),
      el('div.mstrip', { 'data-reveal': 'zoom', 'aria-hidden': 'true' }, el('div.mstrip__track', null, [el('div.mstrip__set', null, cards()), el('div.mstrip__set', null, cards())]))
    ]);
  }

  /* ---------- שלוש הבטחות ---------- */
  function promises() {
    const card = (icon, color, title, text) => el('div.promise', { 'data-reveal': '', vars: { '--c': color } }, [
      el('span.promise__icon', null, ic.svg(icon, 22)),
      el('h3', { text: title }),
      el('p', { text: text })
    ]);
    return el('section.landing-sec', null, [
      el('div.landing-sec__head', { 'data-reveal': '' }, [el('h2', { text: 'מה מקבלים' })]),
      el('div.promises', null, [
        card('lock', 'var(--c2)', 'הכל נשאר אצלך', 'אין שרת, אין חשבון ואין שום בקשה לרשת. הנתונים נשמרים בקובץ אחד, בתיקייה של האפליקציה.'),
        card('spark', 'var(--c5)', 'מנוע שלומד', 'מילות מפתח, קטגוריות שמגיעות בקובץ, ודמיון לתנועות שכבר סווגו. כל שיוך מלמד אותו להבא.'),
        card('file', 'var(--c6)', 'כל קובץ, מכל בנק', 'אקסל או CSV, עם כל סדר עמודות. חלון מיפוי אחד מסדר את מה שלא זוהה לבד — והמבנה נזכר.')
      ])
    ]);
  }

  return { render: render, title: 'ברוכים הבאים' };
})();
